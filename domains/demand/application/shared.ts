import type {
  DemandReportRepository,
  ConversionRequestRepository,
  DemandAnalysisEngine,
  PortfolioProjectCreator,
  NotificationSender,
} from "../domain";
import type { DemandAllDeps } from "./buildDeps";


// ── Legacy Deps (kept for existing conversion use-cases) ───────────

export interface DemandDeps {
  reports: DemandReportRepository;
  conversions: ConversionRequestRepository;
  analysis: DemandAnalysisEngine;
  projects?: PortfolioProjectCreator;
  notifications?: NotificationSender;
}


// ── Result Type ────────────────────────────────────────────────────

export type DemandResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status: number };


// ══════════════════════════════════════════════════════════════════════
// Shared Helpers (deduplicated from route files)
// ══════════════════════════════════════════════════════════════════════

export interface DemandAiAnalysis {
  decisionId?: string;
  correlationId?: string;
  approvalAction?: string;
  approvalStatus?: string;
  approvedBy?: string;
  approvalReason?: string;
  rejectionReason?: string;
  revisionNotes?: string;
  [key: string]: unknown;
}


export function parseAiAnalysis(aiAnalysis: unknown): DemandAiAnalysis {
  if (!aiAnalysis) return {};
  if (typeof aiAnalysis === "string") {
    try {
      const parsed = JSON.parse(aiAnalysis);
      return typeof parsed === "object" && parsed !== null ? (parsed as DemandAiAnalysis) : {};
    } catch {
      return {};
    }
  }
  return aiAnalysis as DemandAiAnalysis;
}


export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}


export interface VersionLike {
  majorVersion?: number | string | null;
  minorVersion?: number | string | null;
  patchVersion?: number | string | null;
  versionType?: string | null;
  status?: string | null;
  createdAt?: string | Date | null;
}


export function asVersionLike(value: unknown): VersionLike {
  return (typeof value === "object" && value !== null ? value : {}) as VersionLike;
}


// ══════════════════════════════════════════════════════════════════════
// Classification + Parent-Approval Inheritance Helpers
// (Shared by demand BC / Requirements / Strategic-Fit / EA routes so
//  Layer 2 sees the right classification and Layer 7 honors parent
//  governance instead of opening a new HITL gate per child artifact.)
// ══════════════════════════════════════════════════════════════════════

export type NormalizedClassification = "public" | "internal" | "confidential" | "sovereign";

export function normalizeDemandClassificationForPipeline(value: unknown): NormalizedClassification | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  switch (value.trim().toLowerCase()) {
    case "public":
      return "public";
    case "internal":
      return "internal";
    case "confidential":
      return "confidential";
    case "secret":
    case "top_secret":
    case "top-secret":
    case "sovereign":
      return "sovereign";
    default:
      return undefined;
  }
}

/**
 * Build the normalized classification fields expected by Brain Layer 2 / Layer 6
 * routing policy. Without these, Layer 2 falls back to content analysis and
 * CONFIDENTIAL/SOVEREIGN demands can be silently reclassified as INTERNAL,
 * which would route Engine A (sovereign-only) work to Engine B (External Hybrid)
 * and breach the data-classification contract.
 */
export function getDemandClassificationFields(demandReport: Record<string, unknown>) {
  const aiAnalysis = (demandReport.aiAnalysis as Record<string, unknown> | null) || null;
  const normalizedClassification = normalizeDemandClassificationForPipeline(
    demandReport.dataClassification || aiAnalysis?.classificationLevel || aiAnalysis?.classification,
  );

  if (!normalizedClassification) {
    return {} as Record<string, NormalizedClassification>;
  }

  return {
    dataClassification: normalizedClassification,
    classificationLevel: normalizedClassification,
    accessLevel: normalizedClassification,
  };
}


export type ParentApprovalState =
  | { kind: "none" }
  | { kind: "approved"; approvalId: string | null }
  | { kind: "pending"; approvalId: string | null };

/**
 * Resolve the spine-level approval state for a parent demand decision so
 * derivative artifact generation (BC / Requirements / Strategic-Fit / EA)
 * can:
 *   1. Short-circuit on `pending` — never re-run the full pipeline against
 *      a spine that already has an open Layer-7 HITL gate (this is what
 *      caused the "processing in background" stall).
 *   2. Inherit on `approved` — pass `parentDemandApproved=true` so Layer 7
 *      skips re-gating the child request (avoiding a 2nd / 3rd duplicate
 *      PMO approval row for the same decision spine).
 */
export async function resolveParentApprovalState(
  brain: { getApproval: (decisionId: string) => Promise<{ id?: string; status?: string;[key: string]: unknown } | null | undefined> },
  decisionSpineId: string | undefined | null,
): Promise<ParentApprovalState> {
  if (!decisionSpineId) {
    return { kind: "none" };
  }
  try {
    const existing = await brain.getApproval(decisionSpineId);
    const status = String(existing?.status || "").toLowerCase();
    const approvalId =
      typeof existing?.id === "string"
        ? existing.id
        : typeof (existing as Record<string, unknown> | null | undefined)?.approvalId === "string"
          ? ((existing as Record<string, unknown>).approvalId as string)
          : null;
    if (status === "pending") return { kind: "pending", approvalId };
    if (status === "approved") return { kind: "approved", approvalId };
    return { kind: "none" };
  } catch {
    return { kind: "none" };
  }
}


/**
 * Compute the next global version number across all version types for a report.
 * Increments the patch number from the latest version found.
 */
export function getNextGlobalReportVersion(versions: unknown[]) {
  const latest = [...versions].sort((a: unknown, b: unknown) => {
    const vA = asVersionLike(a), vB = asVersionLike(b);
    const aMajor = Number(vA.majorVersion ?? 0), bMajor = Number(vB.majorVersion ?? 0);
    if (aMajor !== bMajor) return bMajor - aMajor;
    const aMinor = Number(vA.minorVersion ?? 0), bMinor = Number(vB.minorVersion ?? 0);
    if (aMinor !== bMinor) return bMinor - aMinor;
    return Number(vB.patchVersion ?? 0) - Number(vA.patchVersion ?? 0);
  })[0] as VersionLike | undefined;

  if (!latest) return { majorVersion: 1, minorVersion: 0, patchVersion: 0, versionNumber: "v1.0.0" };

  const majorVersion = Number(latest.majorVersion ?? 1);
  const minorVersion = Number(latest.minorVersion ?? 0);
  const patchVersion = Number(latest.patchVersion ?? 0) + 1;
  return { majorVersion, minorVersion, patchVersion, versionNumber: `v${majorVersion}.${minorVersion}.${patchVersion}` };
}


/**
 * Create a version safely with retry on version collision.
 */
export async function createReportVersionSafely(
  versions: Pick<DemandAllDeps, "versions">["versions"],
  reportId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const allVersions = await versions.findByReportId(reportId);
    const nextVer = getNextGlobalReportVersion(allVersions);

    try {
      return await versions.create({
        reportId,
        ...nextVer,
        ...payload,
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("report_versions_unique_semantic") || attempt === 3) {
        throw error;
      }
    }
  }

  throw new Error("Failed to allocate a unique report version");
}
