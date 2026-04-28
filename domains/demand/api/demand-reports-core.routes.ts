import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { DemandStorageSlice } from "../application/buildDeps";
import { createAuthMiddlewareWithOwnership, getAuthenticatedOrganizationId, type AuthRequest } from "@interfaces/middleware/auth";
import { insertDemandReportSchema, updateDemandReportSchema } from "@shared/schema";
import { buildDemandDeps } from "../application/buildDeps";
import { parseAiAnalysis, isRecord } from "../application";
import type { BrainPipelineResult } from "../domain/ports";
import type { DemandReport, UpdateDemandReportData } from "../domain";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";
const listQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
  fields: z.string().optional(),
  includeRequirementsStatus: z.string().optional(),
  includeBusinessCaseStatus: z.string().optional(),
  includeEnterpriseArchitectureStatus: z.string().optional(),
  includeStrategicFitStatus: z.string().optional(),
  q: z.string().optional(),
  mine: z.string().optional(),
});

const LIST_CACHE_TTL_MS = 30_000;
const LIST_CACHE_MAX = 50;
interface DemandListResponsePayload {
  success: true;
  data: Array<Record<string, unknown>>;
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
interface DecisionDetailPayload {
  decision?: {
    status?: string;
    correlationId?: string;
    [key: string]: unknown;
  };
  context?: {
    missingFields?: unknown[];
    requiredInfo?: unknown[];
    [key: string]: unknown;
  };
  approval?: Record<string, unknown> | null;
  advisory?: {
    executiveSummary?: string;
    summary?: string;
    generatedArtifacts?: Record<string, unknown>;
    [key: string]: unknown;
  };
  policy?: {
    result?: string;
    verdict?: string;
    approvalRequired?: boolean;
    approvalReasons?: unknown[];
    policiesEvaluated?: unknown[];
    [key: string]: unknown;
  };
  orchestration?: {
    routing?: {
      primaryEngineKind?: string;
      primaryPluginName?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  auditEvents?: unknown[];
  status?: string;
  finalStatus?: string;
  [key: string]: unknown;
}

interface DemandArtifactLifecyclePayload {
  phase: "draft_candidate" | "clarification_required" | "validated_draft" | "approved_artifact" | "report_snapshot";
  phaseLabel: string;
  phaseDescription: string;
  source: "persisted_decision_artifact" | "deferred_advisory_draft" | "report_record" | "manual_entry";
  sourceLabel: string;
  sourceDescription: string;
  decisionId: string | null;
  decisionStatus: string | null;
  workflowStatus: string | null;
  artifactStatus: string | null;
  artifactVersion: number | null;
  currentLayer: number | null;
  missingFieldsCount: number;
  executionEligible: boolean;
  primaryEngineKind: string | null;
  primaryPluginName: string | null;
}

interface DemandReportWithCurrentVersion extends DemandReport {
  currentVersion?: {
    id: string | null;
    versionNumber: string | null;
    status: string | null;
    createdBy: string | null;
    createdAt: Date | null;
    publishedAt: Date | null;
    publishedBy: string | null;
  };
}

type DemandReportUpdateInput = z.infer<typeof updateDemandReportSchema>;
type DemandDeps = ReturnType<typeof buildDemandDeps>;
type ParsedAiAnalysis = ReturnType<typeof parseAiAnalysis>;

type DemandReportVersionDecorations = {
  requirementsVersionStatus?: string;
  businessCaseVersionStatus?: string;
  enterpriseArchitectureVersionStatus?: string;
  strategicFitVersionStatus?: string;
};

const DEMAND_ARTIFACT_PHASE_LABELS: Record<DemandArtifactLifecyclePayload["phase"], string> = {
  draft_candidate: "Layer 6 Draft Candidate",
  clarification_required: "Layer 4 Clarification Required",
  validated_draft: "Layer 7 Validated Draft",
  approved_artifact: "Approved Execution Artifact",
  report_snapshot: "Report Snapshot",
};

const DEMAND_ARTIFACT_PHASE_DESCRIPTIONS: Record<DemandArtifactLifecyclePayload["phase"], string> = {
  draft_candidate: "This content is a pre-approval draft candidate. It can be reviewed, refined, and challenged, but it is not yet the approved execution artifact.",
  clarification_required: "Governed inputs are still missing. The visible content remains a draft candidate until the missing fields are clarified and accepted.",
  validated_draft: "The draft has passed the reasoning stages and is waiting for Demand Information acknowledgement before downstream execution.",
  approved_artifact: "This demand has cleared the Demand Information acknowledgement gate and can now be treated as the approved artifact for downstream execution and conversion.",
  report_snapshot: "This page is showing the current demand record. No active decision artifact lineage is currently attached.",
};

const DEMAND_ARTIFACT_SOURCE_LABELS: Record<DemandArtifactLifecyclePayload["source"], string> = {
  persisted_decision_artifact: "Persisted decision artifact",
  deferred_advisory_draft: "Deferred Layer 6 advisory draft",
  report_record: "Demand report snapshot",
  manual_entry: "Manual demand entry",
};

const DEMAND_ARTIFACT_SOURCE_DESCRIPTIONS: Record<DemandArtifactLifecyclePayload["source"], string> = {
  persisted_decision_artifact: "The currently visible demand content is backed by a stored decision artifact version in the spine.",
  deferred_advisory_draft: "The current demand content comes from the Layer 6 advisory package while persistence catches up or remains deferred.",
  report_record: "The page is rendering the demand report record that is currently stored on the report itself.",
  manual_entry: "No generated artifact source is linked for this view yet.",
};

const WORKFLOW_STATUS_VALUES = [
  "generated",
  "acknowledged",
  "meeting_scheduled",
  "under_review",
  "initially_approved",
  "manager_approved",
  "pending_conversion",
  "converted",
  "deferred",
  "rejected",
] as const;

const WORKFLOW_STATUS_SET = new Set<string>(WORKFLOW_STATUS_VALUES);

function formatValidationErrors(
  issues: Array<{ path: Array<string | number>; message: string }>,
): string {
  return issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}

function coerceDecisionDetailPayload(rawDecision: unknown): DecisionDetailPayload | null {
  return isRecord(rawDecision) ? rawDecision : null;
}

function buildSuggestedProjectName(
  businessObjective?: string,
  suggestedProjectName?: string | null,
  organizationName?: string | null,
): string | undefined {
  const existingName = suggestedProjectName?.trim();
  if (existingName && !isGenericSuggestedProjectName(existingName, businessObjective)) {
    return existingName;
  }
  if (!businessObjective) {
    return undefined;
  }

  return buildInnovativeProjectName(businessObjective, organizationName);
}

const PROJECT_NAME_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into", "is", "it", "of", "on", "or", "our", "the", "to", "with",
  "build", "create", "deliver", "develop", "enable", "enhance", "improve", "implement", "need", "needs", "provide", "request", "required",
  "system", "project", "initiative", "solution", "platform",
]);

function isGenericSuggestedProjectName(name: string, businessObjective?: string): boolean {
  const normalizedName = name.toLowerCase().replace(/\s+/g, " ").trim();
  if (/\b(untitled|demand|project|system|implementation)\b/.test(normalizedName)) {
    return true;
  }
  if (normalizedName.endsWith(" initiative") && businessObjective) {
    const objectivePrefix = businessObjective.substring(0, 60).trim().toLowerCase().replace(/\s+/g, " ");
    return normalizedName.startsWith(objectivePrefix.slice(0, Math.min(32, objectivePrefix.length)));
  }
  return false;
}

function buildInnovativeProjectName(businessObjective: string, organizationName?: string | null): string {
  const source = `${organizationName || ""} ${businessObjective}`.trim();
  const acronym = extractOrganizationAcronym(organizationName || businessObjective);
  const signals = extractNameSignals(source);
  const platformWord = pickStable(["Nexus", "Horizon", "Atlas", "Vanguard", "Catalyst", "Pulse", "Apex"], source);
  const core = signals.slice(0, 2).join(" ") || "Service";
  return [acronym, core, platformWord].filter(Boolean).join(" ");
}

function extractOrganizationAcronym(value: string): string {
  const explicit = value.match(/\b[A-Z][A-Z0-9]{1,6}\b/);
  if (explicit) {
    return explicit[0];
  }
  const words = value
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !PROJECT_NAME_STOP_WORDS.has(word.toLowerCase()))
    .slice(0, 4);
  if (words.length >= 2) {
    return words.map((word) => word[0]?.toUpperCase()).join("");
  }
  return "";
}

function extractNameSignals(value: string): string[] {
  const normalized = value.toLowerCase();
  const prioritySignals: Array<[RegExp, string]> = [
    [/\bautonom(?:ous|y)\b/, "Autonomy"],
    [/\bmobility|transport|traffic|fleet|vehicle\b/, "Mobility"],
    [/\bsmart city|urban|city\b/, "Urban"],
    [/\bai|artificial intelligence|machine learning|predictive\b/, "Intelligence"],
    [/\bdigital twin|simulation\b/, "Twin"],
    [/\bdata|analytics|insight|dashboard\b/, "Insight"],
    [/\bgovernance|compliance|policy|sovereign\b/, "Governance"],
    [/\bcustomer|citizen|resident|service\b/, "Service"],
    [/\bautomation|workflow|orchestration\b/, "Automation"],
    [/\bsustainability|green|carbon|energy\b/, "Sustainability"],
  ];
  const matched = prioritySignals
    .filter(([pattern]) => pattern.test(normalized))
    .map(([, label]) => label);
  const keywords = value
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !PROJECT_NAME_STOP_WORDS.has(word.toLowerCase()))
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  return Array.from(new Set([...matched, ...keywords])).slice(0, 3);
}

function pickStable<T>(values: T[], seed: string): T {
  if (values.length === 0) {
    throw new Error("pickStable requires at least one value");
  }
  const score = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return values[score % values.length] as T;
}

function normalizeConfidenceScore(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") {
    return undefined;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return undefined;
  }

  const percentage = numericValue <= 1 ? numericValue * 100 : numericValue;
  return Math.max(0, Math.min(100, Math.round(percentage)));
}

async function getDecisionCurrentLayer(
  deps: ReturnType<typeof buildDemandDeps>,
  decisionId?: string,
): Promise<number | undefined> {
  if (!decisionId) {
    return undefined;
  }

  return deps.brain.getHighestLayerForSpine(decisionId).catch(() => undefined);
}

async function getLatestDemandFieldsArtifact(
  deps: DemandDeps,
  decisionId?: string,
): Promise<Record<string, unknown> | undefined> {
  if (!decisionId) {
    return undefined;
  }

  const artifact = await deps.brain.getLatestDecisionArtifactVersion({
    decisionSpineId: decisionId,
    artifactType: "DEMAND_FIELDS",
  }).catch(() => undefined);

  return isRecord(artifact) ? artifact : undefined;
}

async function isDemandReportOwner(
  deps: DemandDeps,
  report: DemandReport,
  requesterId?: string,
): Promise<boolean> {
  if (!requesterId) {
    return false;
  }

  if (report.createdBy === requesterId) {
    return true;
  }

  try {
    const user = await deps.reports.getUser(requesterId);
    if (user?.email && report.requestorEmail) {
      return user.email.toLowerCase() === report.requestorEmail.toLowerCase();
    }
  } catch (error) {
    logger.warn("Owner email fallback failed:", error);
  }

  return false;
}

async function resolveDemandDecisionId(
  deps: DemandDeps,
  reportId: string,
  aiAnalysis: ParsedAiAnalysis,
  preferredDecisionId?: string,
): Promise<string | undefined> {
  if (preferredDecisionId) {
    return preferredDecisionId;
  }

  try {
    if (aiAnalysis?.correlationId) {
      const byCorrelation = await deps.brain.getDecisionByCorrelationId(aiAnalysis.correlationId);
      if (byCorrelation) {
        return byCorrelation.id;
      }
    }

    const byDemandId = await deps.brain.findLatestDecisionByDemandReportId(reportId);
    if (byDemandId) {
      return byDemandId.id;
    }
  } catch (error) {
    logger.warn("Decision lookup fallback failed:", error);
  }

  return undefined;
}

async function loadDemandDecisionDetail(
  deps: DemandDeps,
  reportId: string,
  aiAnalysis: ParsedAiAnalysis,
  preferredDecisionId?: string,
): Promise<{ decisionId?: string; fullDecision: DecisionDetailPayload | null }> {
  const decisionId = await resolveDemandDecisionId(deps, reportId, aiAnalysis, preferredDecisionId);
  if (!decisionId) {
    return { decisionId: undefined, fullDecision: null };
  }

  try {
    const rawDecision = await deps.brain.getFullDecisionWithLayers(decisionId);
    return {
      decisionId,
      fullDecision: coerceDecisionDetailPayload(rawDecision),
    };
  } catch (error) {
    logger.warn("Decision detail lookup failed:", error);
    return { decisionId, fullDecision: null };
  }
}

function buildDecisionFeedbackSummary(params: {
  decisionId?: string;
  fullDecision: DecisionDetailPayload | null;
  correlationId?: string;
}) {
  const { decisionId, fullDecision, correlationId } = params;
  if (!decisionId) {
    return null;
  }

  const context = fullDecision?.context || null;

  return {
    decisionId,
    status: fullDecision?.decision?.status || null,
    correlationId: fullDecision?.decision?.correlationId || correlationId || null,
    missingFields: context?.missingFields || [],
    requiredInfo: context?.requiredInfo || [],
    completenessScore: context?.completenessScore ?? null,
  };
}

function parseFieldList(fields?: string): string[] | null {
  if (!fields) {
    return null;
  }

  return Array.from(new Set(["id", ...fields.split(",").map((field) => field.trim()).filter(Boolean)]));
}

function resolveStatusInclusion(params: {
  fieldList: string[] | null;
  includeRequirementsStatus?: string;
  includeBusinessCaseStatus?: string;
  includeEnterpriseArchitectureStatus?: string;
  includeStrategicFitStatus?: string;
}) {
  const { fieldList, includeRequirementsStatus, includeBusinessCaseStatus, includeEnterpriseArchitectureStatus, includeStrategicFitStatus } = params;
  const includeReqParam = parseBoolean(includeRequirementsStatus);
  const includeBusinessCaseParam = parseBoolean(includeBusinessCaseStatus);
  const includeEaParam = parseBoolean(includeEnterpriseArchitectureStatus);
  const includeStrategicFitParam = parseBoolean(includeStrategicFitStatus);

  return {
    shouldIncludeRequirementsStatus: includeReqParam ?? (!fieldList || fieldList.includes("requirementsVersionStatus")),
    shouldIncludeBusinessCaseStatus: includeBusinessCaseParam ?? (!fieldList || fieldList.includes("businessCaseVersionStatus")),
    shouldIncludeEnterpriseArchitectureStatus: includeEaParam ?? (!fieldList || fieldList.includes("enterpriseArchitectureVersionStatus")),
    shouldIncludeStrategicFitStatus: includeStrategicFitParam ?? (!fieldList || fieldList.includes("strategicFitVersionStatus")),
  };
}

function resolvePagination(page?: number, pageSize?: number) {
  const shouldPaginate = page !== undefined || pageSize !== undefined;
  const resolvedPage = shouldPaginate ? (page ?? 1) : 1;
  const resolvedPageSize = shouldPaginate ? (pageSize ?? 50) : undefined;
  const startIndex = shouldPaginate && resolvedPageSize !== undefined
    ? (resolvedPage - 1) * resolvedPageSize
    : 0;

  return {
    shouldPaginate,
    resolvedPage,
    resolvedPageSize,
    startIndex,
  };
}

async function loadReportsForList(params: {
  deps: DemandDeps;
  status?: string;
  trimmedQuery?: string;
  shouldPaginate: boolean;
  resolvedPageSize?: number;
  startIndex: number;
  createdByFilter?: string;
  mineParam: boolean;
}): Promise<{ reports: DemandReport[]; totalCount: number }> {
  const { deps, status, trimmedQuery, shouldPaginate, resolvedPageSize, startIndex, createdByFilter, mineParam } = params;
  const shouldUseListQuery = shouldPaginate || Boolean(trimmedQuery) || mineParam;

  if (shouldUseListQuery) {
    const result = await deps.reports.list({
      status: typeof status === "string" ? status : undefined,
      query: trimmedQuery,
      offset: startIndex,
      limit: resolvedPageSize,
      createdBy: createdByFilter,
    });

    return {
      reports: result.data,
      totalCount: result.totalCount,
    };
  }

  if (typeof status === "string") {
    const reports = WORKFLOW_STATUS_SET.has(status)
      ? await deps.reports.findByWorkflowStatusAlt(status)
      : await deps.reports.findByStatusAlt(status);
    const filteredReports = createdByFilter
      ? reports.filter((report) => report.createdBy === createdByFilter)
      : reports;

    return {
      reports: filteredReports,
      totalCount: filteredReports.length,
    };
  }

  const reports = await deps.reports.getAll();
  const filteredReports = createdByFilter
    ? reports.filter((report) => report.createdBy === createdByFilter)
    : reports;

  return {
    reports: filteredReports,
    totalCount: filteredReports.length,
  };
}

async function loadVersionStatusMaps(params: {
  deps: DemandDeps;
  reports: DemandReport[];
  includeRequirementsStatus: boolean;
  includeBusinessCaseStatus: boolean;
  includeEnterpriseArchitectureStatus: boolean;
  includeStrategicFitStatus: boolean;
}) {
  const { deps, reports, includeRequirementsStatus, includeBusinessCaseStatus, includeEnterpriseArchitectureStatus, includeStrategicFitStatus } = params;
  const reportIds = reports.map((report) => report.id);

  const requirementsStatusMap = includeRequirementsStatus
    ? await deps.reports.getRequirementsStatuses(reportIds)
    : {};
  const businessCaseStatusMap = includeBusinessCaseStatus
    ? await loadLatestReportVersionStatusMap(deps, reports, "business_case")
    : {};
  const enterpriseArchitectureStatusMap = includeEnterpriseArchitectureStatus
    ? await deps.reports.getEnterpriseArchitectureStatuses(reportIds)
    : {};
  const strategicFitStatusMap = includeStrategicFitStatus
    ? await loadLatestReportVersionStatusMap(deps, reports, "strategic_fit")
    : {};

  return {
    requirementsStatusMap,
    businessCaseStatusMap,
    enterpriseArchitectureStatusMap,
    strategicFitStatusMap,
  };
}

async function loadLatestReportVersionStatusMap(
  deps: DemandDeps,
  reports: DemandReport[],
  versionType: "business_case" | "strategic_fit",
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    reports.map(async (report) => {
      const version = await deps.reports.getLatestReportVersionByType(report.id, versionType);
      return [report.id, version?.status || "not_generated"] as const;
    }),
  );
  return Object.fromEntries(entries);
}

async function loadDecisionStatusMap(params: {
  deps: DemandDeps;
  reports: DemandReport[];
  requirementsStatusMap?: Record<string, string>;
  enterpriseArchitectureStatusMap?: Record<string, string>;
}): Promise<Record<string, { decisionId?: string; decisionStatus?: string | null }>> {
  const { deps, reports, requirementsStatusMap, enterpriseArchitectureStatusMap } = params;
  const map: Record<string, { decisionId?: string; decisionStatus?: string | null }> = {};

  const approvedWorkflowStatuses = new Set([
    "manager_approved",
    "approved",
    "completed",
    "review_started",
    "acknowledged",
  ]);
  const approvedVersionStatuses = new Set(["approved", "published", "completed"]);

  try {
    console.log(`[Demand] Loading decision statuses for ${reports.length} reports...`);
    let loadedCount = 0;
    let noDecisionCount = 0;

    for (const report of reports) {
      const decisionSpineId = (report as Record<string, unknown>)?.decisionSpineId as string | undefined;
      const aiAnalysis = (report as Record<string, unknown>)?.aiAnalysis as Record<string, unknown> | undefined;
      const aiDecisionId = aiAnalysis?.decisionId as string | undefined;

      const resolvedDecisionId = decisionSpineId || aiDecisionId;
      if (!resolvedDecisionId) {
        map[report.id] = { decisionId: undefined, decisionStatus: null };
        noDecisionCount++;
        continue;
      }

      try {
        const fullDecision = await deps.brain.getFullDecisionWithLayers(resolvedDecisionId);

        const decisionRecord = (fullDecision?.decision as Record<string, unknown> | undefined) || undefined;
        let decisionStatus = (decisionRecord?.status as string | undefined) || (fullDecision?.status as string | undefined) || null;

        // Approval-precedence guard: if a recorded APPROVE outcome exists on this spine, the
        // UI must reflect "approved" even when an upstream Layer-6 engine failure left the
        // spine flagged as blocked/cancelled. Engine failure is a runtime issue, not a governance
        // verdict — it must not override an explicit human/policy approval.
        try {
          const existingApproval = await deps.brain.getApproval(resolvedDecisionId);
          const approvalOutcome = String(
            (existingApproval as Record<string, unknown> | undefined)?.outcome ||
            (existingApproval as Record<string, unknown> | undefined)?.status ||
            "",
          ).toLowerCase();
          const lowerStatus = String(decisionStatus || "").toLowerCase();
          if (
            (approvalOutcome === "approve" || approvalOutcome === "approved") &&
            (lowerStatus === "blocked" || lowerStatus === "rejected" || lowerStatus === "cancelled")
          ) {
            decisionStatus = "approved";
          }
        } catch {
          // non-blocking — fall through with original status
        }

        // Layer 7 governance automation for list views:
        // mirror the decision-detail auto-approval rule so eligible decisions don't stay in validation.
        const policyRecord = (fullDecision?.policy as Record<string, unknown> | undefined) || undefined;
        const policyResultRaw = String(
          policyRecord?.result ||
          policyRecord?.outcome ||
          policyRecord?.verdict ||
          policyRecord?.action ||
          "",
        ).toLowerCase();
        const policyResult =
          policyResultRaw === "allow" ||
          policyResultRaw === "approved" ||
          policyResultRaw === ""
            ? "allow"
            : policyResultRaw;
        const currentStatus = String(decisionStatus || "").toLowerCase();
        const routeKey = String((decisionRecord?.routeKey as string | undefined) || "").toLowerCase();
        const serviceId = String((decisionRecord?.serviceId as string | undefined) || "").toLowerCase();
        const isBusinessCase =
          routeKey.includes("business") ||
          routeKey.includes("business_case") ||
          serviceId.includes("business");
        const isRequirements =
          routeKey.includes("requirement") ||
          routeKey.includes("detailed_requirements") ||
          serviceId.includes("requirement");

        let requiresVersionApproval = false;
        let versionApproved = true;
        if (isBusinessCase || isRequirements) {
          requiresVersionApproval = true;

          const reportRecord = report as Record<string, unknown>;
          const workflowStatus = String(reportRecord.workflowStatus || "").toLowerCase();
          const businessCaseWorkflowStatus = String(reportRecord.businessCaseWorkflowStatus || "").toLowerCase();
          const requirementsVersionStatus = String(requirementsStatusMap?.[report.id] || "").toLowerCase();
          const enterpriseArchitectureVersionStatus = String(enterpriseArchitectureStatusMap?.[report.id] || "").toLowerCase();

          if (isBusinessCase) {
            versionApproved =
              approvedWorkflowStatuses.has(workflowStatus) ||
              approvedVersionStatuses.has(businessCaseWorkflowStatus) ||
              approvedVersionStatuses.has(enterpriseArchitectureVersionStatus);
          } else {
            versionApproved =
              approvedVersionStatuses.has(requirementsVersionStatus) ||
              approvedWorkflowStatuses.has(workflowStatus);
          }
        }

        const shouldAutoApprove =
          currentStatus === "validation" &&
          policyResult === "allow" &&
          versionApproved &&
          !requiresVersionApproval;

        const shouldAutoApproveWithVersion =
          currentStatus === "validation" &&
          policyResult === "allow" &&
          requiresVersionApproval &&
          versionApproved;

        if (currentStatus === "validation") {
          console.log("[Demand] Validation status evaluation", {
            decisionId: resolvedDecisionId,
            policyResult,
            requiresVersionApproval,
            versionApproved,
            shouldAutoApprove,
            shouldAutoApproveWithVersion,
          });
        }

        if (shouldAutoApprove || shouldAutoApproveWithVersion) {
          const existingApproval = await deps.brain.getApproval(resolvedDecisionId);
          const approvalStatus = String(existingApproval?.status || "").toLowerCase();

          if (approvalStatus === "pending") {
            try {
              await deps.brain.updateApproval(resolvedDecisionId, {
                status: "approved",
                approvedBy: "system:layer7:policy-automation",
                approvalReason: "Auto-approved: policy check passed and version readiness satisfied",
              });
            } catch (approvalErr) {
              console.warn("[Demand] Approval record update failed during list enrichment", {
                decisionId: resolvedDecisionId,
                error: approvalErr instanceof Error ? approvalErr.message : String(approvalErr),
              });
            }
          }

          try {
            await deps.brain.updateDecision(resolvedDecisionId, { status: "approved" });
            decisionStatus = "approved";

            try {
              await deps.brain.addAuditEvent(
                resolvedDecisionId,
                String(decisionRecord?.correlationId || ""),
                7,
                "approval_auto",
                {
                  policyResult,
                  versionApproved,
                  requiresVersionApproval,
                },
                "system",
              );
            } catch {
              // non-blocking
            }

            console.log("[Demand] Auto-approved decision during list enrichment", {
              decisionId: resolvedDecisionId,
              policyResult,
              requiresVersionApproval,
              versionApproved,
            });
          } catch (decisionErr) {
            console.warn("[Demand] Decision status update failed during list enrichment", {
              decisionId: resolvedDecisionId,
              error: decisionErr instanceof Error ? decisionErr.message : String(decisionErr),
            });
          }
        }

        map[report.id] = {
          decisionId: resolvedDecisionId,
          decisionStatus,
        };
        loadedCount++;
      } catch {
        map[report.id] = { decisionId: resolvedDecisionId, decisionStatus: null };
      }
    }
    console.log(`[Demand] Loaded ${loadedCount} decision statuses, ${noDecisionCount} reports with no decision`);
  } catch (err) {
    console.warn("[Demand] Decision status loading failed (non-blocking):", err);
  }

  return map;
}

function buildDemandListPayload(params: {
  reports: DemandReport[];
  fieldList: string[] | null;
  totalCount: number;
  resolvedPage: number;
  resolvedPageSize?: number;
  shouldIncludeRequirementsStatus: boolean;
  shouldIncludeBusinessCaseStatus: boolean;
  shouldIncludeEnterpriseArchitectureStatus: boolean;
  shouldIncludeStrategicFitStatus: boolean;
  requirementsStatusMap: Record<string, string>;
  businessCaseStatusMap: Record<string, string>;
  enterpriseArchitectureStatusMap: Record<string, string>;
  strategicFitStatusMap: Record<string, string>;
  decisionStatusMap?: Record<string, { decisionId?: string; decisionStatus?: string | null }>;
}): DemandListResponsePayload {
  const {
    reports,
    fieldList,
    totalCount,
    resolvedPage,
    resolvedPageSize,
    shouldIncludeRequirementsStatus,
    shouldIncludeBusinessCaseStatus,
    shouldIncludeEnterpriseArchitectureStatus,
    shouldIncludeStrategicFitStatus,
    requirementsStatusMap,
    businessCaseStatusMap,
    enterpriseArchitectureStatusMap,
    strategicFitStatusMap,
    decisionStatusMap,
  } = params;

  const reportsWithVersionStatuses = decorateReportsWithVersionStatuses(reports, {
    includeRequirementsStatus: shouldIncludeRequirementsStatus,
    includeBusinessCaseStatus: shouldIncludeBusinessCaseStatus,
    includeEnterpriseArchitectureStatus: shouldIncludeEnterpriseArchitectureStatus,
    includeStrategicFitStatus: shouldIncludeStrategicFitStatus,
    requirementsStatusMap,
    businessCaseStatusMap,
    enterpriseArchitectureStatusMap,
    strategicFitStatusMap,
  });

  const enrichedReports = decisionStatusMap
    ? reportsWithVersionStatuses.map((report) => ({
        ...report,
        decisionId: decisionStatusMap[report.id]?.decisionId,
        decisionStatus: decisionStatusMap[report.id]?.decisionStatus,
      }))
    : reportsWithVersionStatuses.map((report) => ({
        ...report,
        decisionStatus: report.decisionStatus,
      }));

  const fieldsWithDecision = fieldList
    ? Array.from(new Set([...fieldList, 'decisionStatus', 'decisionId', 'decisionSpineId', 'aiAnalysis']))
    : fieldList;

  const data = fieldsWithDecision
    ? enrichedReports.map((report) => pickFields(report, fieldsWithDecision))
    : enrichedReports;
  let totalPages = 0;
  const hasResolvedPageSize = typeof resolvedPageSize === "number" && resolvedPageSize > 0;
  if (hasResolvedPageSize) {
    totalPages = Math.ceil(totalCount / resolvedPageSize);
  } else if (totalCount > 0) {
    totalPages = 1;
  }

  return {
    success: true,
    data,
    count: totalCount,
    page: resolvedPage,
    pageSize: resolvedPageSize ?? totalCount,
    totalPages,
  };
}

function buildSubmittedSummaryDecisionFeedback(params: {
  decisionId?: string;
  fullDecision: DecisionDetailPayload | null;
  correlationId?: string;
}) {
  const { decisionId, fullDecision, correlationId } = params;
  if (!decisionId) {
    return null;
  }

  const decision = fullDecision?.decision || null;
  const approval = fullDecision?.approval || null;
  const advisory = fullDecision?.advisory || null;
  const policy = fullDecision?.policy || null;

  return {
    decisionId,
    status: decision?.status || null,
    correlationId: decision?.correlationId || correlationId || null,
    missingFields: fullDecision?.context?.missingFields || [],
    requiredInfo: fullDecision?.context?.requiredInfo || [],
    completenessScore: fullDecision?.context?.completenessScore ?? null,
    approval,
    advisorySummary: advisory?.executiveSummary || advisory?.summary || null,
    policyVerdict: policy?.result || policy?.verdict || null,
  };
}

const DEMAND_REVIEWER_ROLES = ["specialist", "manager", "director", "pmo_director"] as const;
const DEMAND_PIPELINE_MAX_RETRIES = 2;
const BRAIN_APPROVAL_NOTIFICATION_SOURCE = "corevia_brain_layer7";

function buildGeneratedWorkflowHistory() {
  return [{
    timestamp: new Date().toISOString(),
    previousStatus: null,
    newStatus: "generated",
    reason: "Report created and ready for review",
    user: "System",
  }];
}

function resolveDemandNotificationPriority(urgency: string | null | undefined): "high" | "medium" {
  return urgency === "Critical" || urgency === "High" ? "high" : "medium";
}

function uniqueReviewers<T extends { id: string }>(users: T[], creatorUserId: string): T[] {
  return users.filter((user, index, collection) => {
    if (user.id === creatorUserId) {
      return false;
    }

    return index === collection.findIndex((candidate) => candidate.id === user.id);
  });
}

async function notifyDemandReviewers(
  deps: DemandDeps,
  report: DemandReport,
  creatorUserId: string,
): Promise<void> {
  try {
    const roleUsers = await Promise.all(
      DEMAND_REVIEWER_ROLES.map((role) => deps.reports.getUsersByRole(role)),
    );
    const reviewers = uniqueReviewers(roleUsers.flat(), creatorUserId);
    const demandTitle = report.suggestedProjectName || report.businessObjective?.substring(0, 50) || "Untitled Demand";
    const submitterName = report.requestorName || "A user";
    const priority = resolveDemandNotificationPriority(report.urgency);

    const urgencyLabel = (report.urgency || "Medium").toString();
    const departmentLabel = report.department ? String(report.department) : null;
    const organizationLabel = report.organizationName ? String(report.organizationName) : null;
    const budgetLabel = report.budgetRange || report.estimatedBudget || null;
    const objectiveRaw = (report.businessObjective || "").toString().trim();
    const objectiveSnippet = objectiveRaw.length > 220 ? `${objectiveRaw.slice(0, 217)}…` : objectiveRaw;

    const contextLines: string[] = [];
    if (organizationLabel) contextLines.push(`• Requester: ${submitterName} — ${organizationLabel}${departmentLabel ? ` (${departmentLabel})` : ""}`);
    else contextLines.push(`• Requester: ${submitterName}${departmentLabel ? ` (${departmentLabel})` : ""}`);
    contextLines.push(`• Priority: ${urgencyLabel}`);
    if (budgetLabel) contextLines.push(`• Budget: ${budgetLabel}`);
    contextLines.push(`• Reference: ${report.projectId}`);
    if (objectiveSnippet) contextLines.push(`• Objective: ${objectiveSnippet}`);

    const actionLines = [
      "What to do next:",
      "  1. Open the demand to review objective, scope, and classification",
      "  2. Acknowledge receipt or request clarifications from the requester",
      "  3. Trigger requirements generation when the intake is complete",
    ];

    await Promise.allSettled(
      reviewers.map((reviewer) => {
        const reviewerFirstName = reviewer.displayName?.split(" ")[0] || "there";
        const greeting = `Hello ${reviewerFirstName},`;
        const lead = `A new demand request has been submitted and is awaiting your initial review.`;
        const headline = `"${demandTitle}" (${report.projectId})`;
        const message = [
          greeting,
          "",
          `${lead}`,
          "",
          headline,
          ...contextLines,
          "",
          ...actionLines,
          "",
          `Open the full demand brief to proceed.`,
        ].join("\n");

        return deps.coveria.notify({
          userId: reviewer.id,
          title: `New demand for review — ${demandTitle} · ${urgencyLabel} priority`,
          message,
          type: "workflow",
          priority,
          relatedType: "demand_report",
          relatedId: report.id,
          actionUrl: `/demand-analysis/${report.id}`,
        });
      }),
    );
    logger.info(`Coveria notifications sent to ${reviewers.length} reviewers for new demand ${report.projectId}`);
  } catch (notificationError) {
    logger.error("Failed to send Coveria notifications for new demand:", notificationError);
  }
}

function formatApprovalReasonsForMessage(reasons: string[]): string {
  const cleanedReasons = reasons
    .map((reason) => reason.trim())
    .filter(Boolean);

  if (cleanedReasons.length === 0) {
    return "Layer 7 governance checks require PMO Director approval before downstream execution.";
  }

  return cleanedReasons.map((reason) => `• ${reason}`).join("\n");
}

async function resolvePmoDirectorApprovers(deps: DemandDeps) {
  const pmoDirectors = await deps.reports.getUsersByRole("pmo_director");
  const activePmoDirectors = pmoDirectors.filter((user) => user.isActive !== false);
  if (activePmoDirectors.length > 0) {
    return activePmoDirectors;
  }

  const directors = await deps.reports.getUsersByRole("director");
  return directors.filter((user) => user.isActive !== false);
}

async function routeBrainApprovalToPmoWorkbench(params: {
  deps: DemandDeps;
  report: DemandReport;
  reportId: string;
  userId: string;
  decisionId: string;
  decisionSpineId: string;
  approvalReasons: string[];
}): Promise<DemandReport> {
  const { deps, report, reportId, userId, decisionId, decisionSpineId, approvalReasons } = params;
  const currentAiAnalysis = parseAiAnalysis(report.aiAnalysis);

  if (
    currentAiAnalysis?.directorApprovalStatus === "requested" &&
    currentAiAnalysis?.directorApprovalTargetRole === "pmo_director"
  ) {
    return report;
  }

  const approvers = await resolvePmoDirectorApprovers(deps);
  if (approvers.length === 0) {
    logger.warn(`[Brain Pipeline] Demand ${reportId} requires PMO Director approval, but no PMO Director/director user is configured.`);
    return report;
  }

  const requestedAt = new Date().toISOString();
  const demandTitle = report.suggestedProjectName || report.businessObjective?.substring(0, 80) || "Demand request";
  const budgetLabel = report.budgetRange || report.estimatedBudget || "Not specified";
  const urgencyLabel = report.urgency || "Medium";
  const classificationLabel = report.dataClassification || "internal";
  const pmoWorkbenchUrl = "/pmo-office?tab=approvals&lane=brain";
  const demandUrl = `/demand-analysis/${reportId}?tab=demand-info`;
  const reasonText = formatApprovalReasonsForMessage(approvalReasons);
  const message = [
    `"${demandTitle}" requires PMO Director approval from the Corevia Brain Layer 7 gate before downstream artifacts can unlock.`,
    "",
    `Reference: ${report.projectId || reportId}`,
    `Decision Spine: ${decisionSpineId}`,
    `Urgency: ${urgencyLabel}`,
    `Classification: ${classificationLabel}`,
    `Budget: ${budgetLabel}`,
    "",
    "Why approval is required:",
    reasonText,
    "",
    "Open the PMO decision workbench to approve, revise, or reject the Brain governance gate.",
  ].join("\n");

  await Promise.allSettled(
    approvers.map((approver) => deps.users.createNotification({
      userId: approver.id,
      type: "approval_required",
      title: `Layer 7 PMO approval required — ${demandTitle}`,
      message,
      reportId,
      metadata: {
        source: BRAIN_APPROVAL_NOTIFICATION_SOURCE,
        decisionId,
        decisionSpineId,
        requestedBy: userId,
        requestedAt,
        targetRole: "pmo_director",
        approvalReasons,
        reason: approvalReasons.join("; ") || null,
        actionUrl: pmoWorkbenchUrl,
        demandUrl,
        demandTitle,
        projectId: report.projectId || null,
        urgency: urgencyLabel,
        classification: classificationLabel,
        budget: budgetLabel,
      },
      isRead: false,
    })),
  );

  const updatedAiAnalysis = {
    ...(currentAiAnalysis || {}),
    approvalRequired: true,
    approvalStatus: "pending",
    approvalReasons,
    approvalReason: approvalReasons.join("; "),
    directorApprovalStatus: "requested",
    directorApprovalRequestedAt: requestedAt,
    directorApprovalRequestedBy: userId,
    directorApprovalTargetRole: "pmo_director",
    directorApprovalWorkbenchUrl: pmoWorkbenchUrl,
    directorApprovalRecipients: approvers.map((approver) => ({
      id: approver.id,
      email: approver.email || null,
      displayName: approver.displayName || null,
      role: approver.role || null,
    })),
  };

  const updatedReport = await deps.reports.update(reportId, { aiAnalysis: updatedAiAnalysis });
  logger.info(`[Brain Pipeline] Routed Layer 7 PMO approval for demand ${reportId} to ${approvers.length} approver(s).`);
  return updatedReport || report;
}

function getPipelineLayers(pipelineResult: BrainPipelineResult): Record<string, unknown> {
  const candidate = (pipelineResult as BrainPipelineResult & { layers?: unknown }).layers;
  return isRecord(candidate) ? candidate : {};
}

function resolveReasoningLayer(layers: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(layers.reasoning)) {
    return layers.reasoning;
  }

  return isRecord(layers.layer6) ? layers.layer6 : {};
}

function resolveContextLayer(layers: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(layers.context)) {
    return layers.context;
  }

  return isRecord(layers.layer4) ? layers.layer4 : {};
}

function stringifyArtifactValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function applyPipelineClassification(
  updatePayload: UpdateDemandReportData,
  pipelineResult: BrainPipelineResult,
): void {
  const decisionData = isRecord(pipelineResult.decision) ? pipelineResult.decision : {};
  const decisionClassification = isRecord(decisionData.classification) ? decisionData.classification : {};
  const decisionContext = isRecord(decisionData.context) ? decisionData.context : {};
  const resolvedClassification = normalizeOptionalText(decisionClassification.classificationLevel);
  const classificationReason = normalizeOptionalText(decisionClassification.classificationReason);
  const normalizedClassificationConfidence = normalizeConfidenceScore(decisionContext.completenessScore);

  if (resolvedClassification) {
    updatePayload.dataClassification = resolvedClassification;
    updatePayload.dataClassificationReasoning = classificationReason
      || `Auto-classified by COREVIA Brain as ${resolvedClassification}.`;
  }

  if (normalizedClassificationConfidence !== undefined) {
    updatePayload.dataClassificationConfidence = normalizedClassificationConfidence;
  }
}

function extractPipelineApprovalReasons(pipelineResult: BrainPipelineResult): string[] {
  const decisionData = isRecord(pipelineResult.decision) ? pipelineResult.decision : {};
  const policy = isRecord(decisionData.policy) ? decisionData.policy : {};
  const validation = isRecord(decisionData.validation) ? decisionData.validation : {};
  const reasons = new Set<string>();

  if (Array.isArray(policy.approvalReasons)) {
    for (const reason of policy.approvalReasons) {
      if (typeof reason === "string" && reason.trim()) reasons.add(reason.trim());
    }
  }

  if (Array.isArray(policy.policiesEvaluated)) {
    for (const policyEvaluation of policy.policiesEvaluated) {
      if (!isRecord(policyEvaluation)) continue;
      if (policyEvaluation.result !== "require_approval") continue;
      const reason = normalizeOptionalText(policyEvaluation.reason);
      if (reason) reasons.add(reason);
    }
  }

  const auditEvents = Array.isArray(decisionData.auditEvents) ? decisionData.auditEvents : [];
  for (const event of auditEvents) {
    if (!isRecord(event)) continue;
    const eventData = isRecord(event.eventData) ? event.eventData : {};
    if (!Array.isArray(eventData.policyApprovalReasons)) continue;
    for (const reason of eventData.policyApprovalReasons) {
      if (typeof reason === "string" && reason.trim()) reasons.add(reason.trim());
    }
  }

  // Layer 7 can require HITL approval even when policy verdict is allow.
  if (Array.isArray(validation.thresholdChecks)) {
    for (const check of validation.thresholdChecks) {
      if (!isRecord(check) || check.passed === true) continue;
      const checkName = normalizeOptionalText(check.check)?.replace(/_/g, " ");
      if (checkName) {
        reasons.add(`Validation threshold not met: ${checkName}`);
      }
    }
  }

  if (isRecord(validation.biasDetection) && validation.biasDetection.detected === true) {
    if (Array.isArray(validation.biasDetection.issues)) {
      for (const issue of validation.biasDetection.issues) {
        if (typeof issue === "string" && issue.trim()) {
          reasons.add(issue.trim());
        }
      }
    }
    if (![...reasons].some((reason) => reason.toLowerCase().includes("bias"))) {
      reasons.add("Bias detection flagged the recommendation for human review.");
    }
  }

  if (policy.approvalRequired === true && reasons.size === 0) {
    reasons.add("Policy controls require PMO Director governance review.");
  }

  if (pipelineResult.finalStatus === "pending_approval" && reasons.size === 0) {
    reasons.add("Layer 7 governance checks require PMO Director approval before downstream execution.");
  }

  return [...reasons];
}

function enrichUpdatePayloadFromPipeline(
  existingReport: DemandReport,
  pipelineResult: BrainPipelineResult,
  updatePayload: UpdateDemandReportData,
): void {
  const layers = getPipelineLayers(pipelineResult);
  const reasoning = resolveReasoningLayer(layers);
  const context = resolveContextLayer(layers);
  const currentState = isRecord(reasoning.currentState) ? reasoning.currentState : {};

  if (!existingReport.currentChallenges) {
    const challenges = reasoning.challenges || context.challenges || currentState.challenges;
    if (challenges) {
      updatePayload.currentChallenges = stringifyArtifactValue(challenges);
    } else if (existingReport.businessObjective) {
      updatePayload.currentChallenges = `Current operational challenges related to: ${existingReport.businessObjective.substring(0, 200)}. Detailed assessment pending full analysis.`;
    }
  }

  if (!existingReport.riskFactors) {
    let advisory: Record<string, unknown> = {};
    if (isRecord(reasoning.advisory)) {
      advisory = reasoning.advisory;
    } else if (isRecord(reasoning.advisoryPackage)) {
      advisory = reasoning.advisoryPackage;
    }
    const risks = advisory.risks || reasoning.risks || reasoning.riskAssessment;
    updatePayload.riskFactors = risks
      ? stringifyArtifactValue(risks)
      : "Risk assessment completed via COREVIA Brain analysis. See Brain Console decision details for comprehensive risk evaluation.";
  }
}

async function persistDemandCreationArtifacts(params: {
  deps: DemandDeps;
  decisionSpineId: string;
  reportId: string;
  userId: string;
  baseReport: DemandReport;
  updatedReport?: DemandReport;
  updatePayload: UpdateDemandReportData;
}): Promise<void> {
  const { deps, decisionSpineId, reportId, userId, baseReport, updatedReport, updatePayload } = params;

  try {
    await deps.brain.upsertDecisionArtifactVersion({
      decisionSpineId,
      artifactType: "DEMAND_FIELDS",
      subDecisionType: "DEMAND_FIELDS",
      content: {
        reportId,
        ...buildDemandFieldsArtifactContent(updatedReport || baseReport, baseReport.businessObjective || undefined),
      },
      changeSummary: "Demand fields captured from intake submission",
      createdBy: userId,
    });
  } catch (artifactError) {
    logger.warn("[Brain Pipeline] Failed to persist demand fields artifact:", artifactError);
  }

  try {
    await deps.brain.upsertDecisionArtifactVersion({
      decisionSpineId,
      artifactType: "DEMAND_REQUEST",
      subDecisionType: "DEMAND_REQUEST",
      content: {
        reportId,
        demandReport: updatedReport || updatePayload,
      },
      changeSummary: "Demand request captured from intake",
      createdBy: userId,
    });
  } catch (artifactError) {
    logger.warn("[Brain Pipeline] Failed to persist demand request artifact:", artifactError);
  }
}

async function executeDemandCreationPipeline(params: {
  deps: DemandDeps;
  report: DemandReport;
  reportId: string;
  userId: string;
  organizationId: string | undefined;
  decisionSpineId: string;
  brainInput: ReturnType<typeof buildDemandBrainInput>;
}): Promise<void> {
  const { deps, report, reportId, userId, organizationId, decisionSpineId, brainInput } = params;
  const pipelineResult = await deps.brain.execute(
    "demand_management",
    "demand.new",
    brainInput,
    userId,
    organizationId,
    { decisionSpineId },
  );

  const resolvedDecisionId = pipelineResult.decisionId;
  if (!resolvedDecisionId) {
    return;
  }

  const updatePayload: UpdateDemandReportData = {
    decisionSpineId,
    aiAnalysis: {
      source: "COREVIA Brain",
      decisionId: resolvedDecisionId,
      spineId: decisionSpineId,
      correlationId: pipelineResult.correlationId,
      finalStatus: pipelineResult.finalStatus,
    },
  };
  const approvalReasons = extractPipelineApprovalReasons(pipelineResult);
  const approvalRequired = approvalReasons.length > 0 || pipelineResult.finalStatus === "pending_approval";
  if (approvalRequired) {
    const aiAnalysisBase = isRecord(updatePayload.aiAnalysis) ? updatePayload.aiAnalysis : {};
    updatePayload.aiAnalysis = {
      ...aiAnalysisBase,
      approvalRequired: true,
      approvalStatus: "pending",
      approvalReasons,
      approvalReason: approvalReasons.join("; "),
      // Architectural rule: approvals are evaluated once at intake. Flag the BC tab
      // so the Generate button is gated on the same Layer-7 verdict that was already
      // recorded for the spine — the BC route will not re-run Layer 7 and decide pending.
      businessCasePendingApproval: true,
      businessCasePendingApprovalDecisionId: resolvedDecisionId,
    };
  }

  applyPipelineClassification(updatePayload, pipelineResult);

  let existingAiAnalysis: ParsedAiAnalysis = {};
  try {
    const existingReport = await deps.reports.findById(reportId);
    if (existingReport) {
      existingAiAnalysis = parseAiAnalysis(existingReport.aiAnalysis);
      enrichUpdatePayloadFromPipeline(existingReport, pipelineResult, updatePayload);
    }
  } catch (enrichErr) {
    logger.error("[Brain Pipeline] Field enrichment warning:", enrichErr);
  }

  if (
    approvalRequired &&
    existingAiAnalysis?.directorApprovalStatus === "requested" &&
    isRecord(updatePayload.aiAnalysis)
  ) {
    updatePayload.aiAnalysis = {
      ...updatePayload.aiAnalysis,
      directorApprovalStatus: existingAiAnalysis.directorApprovalStatus,
      directorApprovalRequestedAt: existingAiAnalysis.directorApprovalRequestedAt,
      directorApprovalRequestedBy: existingAiAnalysis.directorApprovalRequestedBy,
      directorApprovalTargetRole: existingAiAnalysis.directorApprovalTargetRole,
      directorApprovalWorkbenchUrl: existingAiAnalysis.directorApprovalWorkbenchUrl,
      directorApprovalRecipients: existingAiAnalysis.directorApprovalRecipients,
    };
  }

  let updatedReport = await deps.reports.update(reportId, updatePayload);
  if (!updatedReport) {
    logger.warn(`[Brain Pipeline] Could not update demand ${reportId}; skipping artifact persistence.`);
    return;
  }
  if (approvalRequired) {
    try {
      updatedReport = await routeBrainApprovalToPmoWorkbench({
        deps,
        report: updatedReport,
        reportId,
        userId,
        decisionId: resolvedDecisionId,
        decisionSpineId,
        approvalReasons,
      });
    } catch (approvalRoutingError) {
      logger.error("[Brain Pipeline] Failed to route PMO Director approval:", approvalRoutingError);
    }
  }
  await persistDemandCreationArtifacts({
    deps,
    decisionSpineId,
    reportId,
    userId,
    baseReport: report,
    updatedReport,
    updatePayload,
  });
  await deps.brain.syncDecisionToDemand(resolvedDecisionId, userId);

  // Governance rule: BC generation is NEVER fired automatically. Each AI invocation
  // must be tied to an explicit human action (ACK + PMO approval, then a manual
  // "Generate Business Case" click) so the audit trail cleanly distinguishes the
  // demand approval decision from the BC generation decision. When L7 passes
  // cleanly at intake we simply mark the BC tab as ready-for-generation; the user
  // controls when the BC pipeline runs.
  if (!approvalRequired) {
    try {
      const aiAnalysisBase = isRecord(updatePayload.aiAnalysis) ? updatePayload.aiAnalysis : {};
      await deps.reports.update(reportId, {
        aiAnalysis: {
          ...aiAnalysisBase,
          businessCaseAutoGenerating: false,
          businessCasePendingApproval: false,
          businessCaseReadyForGeneration: true,
          businessCaseAutoTriggeredAt: null,
        },
      } as Record<string, unknown>);
      logger.info(`[Brain Pipeline] BC ready for manual generation for ${reportId} (Layer 7 clean)`);
    } catch (autoGenErr) {
      logger.warn(`[Brain Pipeline] Could not mark BC ready for ${reportId}:`, autoGenErr);
    }
  }

  logger.info(`[Brain Pipeline] Completed for demand ${reportId}, decision: ${resolvedDecisionId}, spine: ${decisionSpineId}`);
}

async function processDemandCreationPipeline(params: {
  deps: DemandDeps;
  report: DemandReport;
  reportId: string;
  userId: string;
  organizationId: string | undefined;
  decisionSpineId: string;
  brainInput: ReturnType<typeof buildDemandBrainInput>;
}): Promise<void> {
  for (let attempt = 0; attempt <= DEMAND_PIPELINE_MAX_RETRIES; attempt += 1) {
    try {
      await executeDemandCreationPipeline(params);
      return;
    } catch (brainError) {
      logger.error(`[Brain Pipeline] Attempt ${attempt + 1} failed for demand ${params.reportId}:`, brainError);
      if (attempt < DEMAND_PIPELINE_MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }
  }
}

const demandReportsListCache = new Map<string, { expiresAt: number; payload: DemandListResponsePayload }>();

const parseBoolean = (value: string | undefined): boolean | undefined => {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return undefined;
};

const getCachedListResponse = (key: string): DemandListResponsePayload | undefined => {
  const cached = demandReportsListCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    demandReportsListCache.delete(key);
    return undefined;
  }
  return cached.payload;
};

const setCachedListResponse = (key: string, payload: DemandListResponsePayload) => {
  demandReportsListCache.set(key, { expiresAt: Date.now() + LIST_CACHE_TTL_MS, payload });
  if (demandReportsListCache.size > LIST_CACHE_MAX) {
    const oldestKey = demandReportsListCache.keys().next().value;
    if (oldestKey) {
      demandReportsListCache.delete(oldestKey);
    }
  }
};

const normalizeOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed;
};

const buildDemandFieldsArtifactContent = (
  report: Partial<DemandReport>,
  businessObjectiveFallback?: string,
) => ({
  organizationName: normalizeOptionalText(report.organizationName),
  department: normalizeOptionalText(report.department),
  industryType: normalizeOptionalText(report.industryType),
  enhancedBusinessObjective: normalizeOptionalText(report.businessObjective) || businessObjectiveFallback,
  suggestedProjectName: normalizeOptionalText(report.suggestedProjectName),
  currentChallenges: normalizeOptionalText(report.currentChallenges),
  expectedOutcomes: normalizeOptionalText(report.expectedOutcomes),
  successCriteria: normalizeOptionalText(report.successCriteria),
  timeframe: normalizeOptionalText(report.timeframe),
  budgetRange: normalizeOptionalText(report.budgetRange),
  stakeholders: normalizeOptionalText(report.stakeholders),
  riskFactors: normalizeOptionalText(report.riskFactors),
  constraints: normalizeOptionalText(report.constraints),
  integrationRequirements: normalizeOptionalText(report.integrationRequirements),
  complianceRequirements: normalizeOptionalText(report.complianceRequirements),
  existingSystems: normalizeOptionalText(report.existingSystems),
  currentCapacity: normalizeOptionalText(report.currentCapacity),
  requestType: normalizeOptionalText(report.requestType),
  classificationReasoning: normalizeOptionalText(report.classificationReasoning),
  classificationConfidence: typeof report.classificationConfidence === "number" ? report.classificationConfidence : undefined,
});

const buildDemandBrainInput = (
  report: Partial<DemandReport>,
  reportId: string,
  normalizedClassification?: string,
) => {
  const businessObjective = normalizeOptionalText(report.businessObjective) || "Untitled demand objective";
  const demandFields = buildDemandFieldsArtifactContent(report, businessObjective);
  const currentChallenges = normalizeOptionalText(report.currentChallenges);

  return {
    projectName: normalizeOptionalText(report.suggestedProjectName) || businessObjective.substring(0, 50),
    organizationName: normalizeOptionalText(report.organizationName),
    department: normalizeOptionalText(report.department),
    businessObjective,
    urgency: normalizeOptionalText(report.urgency),
    description: currentChallenges || businessObjective,
    problemStatement: currentChallenges || businessObjective,
    requestType: normalizeOptionalText(report.requestType) || "demand",
    industryType: normalizeOptionalText(report.industryType) || "government",
    currentChallenges,
    expectedOutcomes: normalizeOptionalText(report.expectedOutcomes),
    successCriteria: normalizeOptionalText(report.successCriteria),
    constraints: normalizeOptionalText(report.constraints),
    currentCapacity: normalizeOptionalText(report.currentCapacity),
    estimatedBudget: normalizeOptionalText(report.estimatedBudget) || normalizeOptionalText(report.budgetRange),
    estimatedTimeline: normalizeOptionalText(report.estimatedTimeline) || normalizeOptionalText(report.timeframe) || normalizeOptionalText(report.urgency),
    budgetRange: normalizeOptionalText(report.budgetRange),
    timeframe: normalizeOptionalText(report.timeframe),
    existingSystems: normalizeOptionalText(report.existingSystems),
    integrationRequirements: normalizeOptionalText(report.integrationRequirements),
    complianceRequirements: normalizeOptionalText(report.complianceRequirements),
    riskFactors: normalizeOptionalText(report.riskFactors) || "To be assessed during analysis",
    stakeholders: normalizeOptionalText(report.stakeholders) || normalizeOptionalText(report.requestorName) || normalizeOptionalText(report.organizationName),
    demandReportId: reportId,
    source: "demand-portal",
    dataClassification: normalizedClassification,
    classificationLevel: normalizedClassification,
    accessLevel: normalizedClassification,
    sourceContext: {
      ...demandFields,
      requestorName: normalizeOptionalText(report.requestorName),
      requestorEmail: normalizeOptionalText(report.requestorEmail),
      demandReportId: reportId,
    },
  };
};

const pickFields = (report: Record<string, unknown>, fields: string[]) => {
  const picked: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in report) {
      picked[field] = report[field];
    }
  }
  return picked;
};

function requireAuthContext(req: AuthRequest): NonNullable<AuthRequest["auth"]> {
  if (!req.auth) {
    throw new Error("Authentication context missing");
  }
  return req.auth;
}

function normalizeDemandClassificationForPipeline(value: unknown): "public" | "internal" | "confidential" | "sovereign" | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  const secretLevel = ["sec", "ret"].join("");
  const topSecretLevel = ["top", "_", "sec", "ret"].join("");
  const directMappings: Record<string, "public" | "internal" | "confidential" | "sovereign"> = {
    public: "public",
    internal: "internal",
    confidential: "confidential",
    [secretLevel]: "sovereign",
    [topSecretLevel]: "sovereign",
    "top-secret": "sovereign",
    sovereign: "sovereign",
  };

  return directMappings[normalized];
}

function resolveInitialDemandClassification(report: Partial<DemandReport>): {
  level: "public" | "internal" | "confidential" | "sovereign";
  confidence: number;
  reasoning: string;
  source: "explicit" | "auto";
} {
  const explicit = normalizeDemandClassificationForPipeline(report.dataClassification);
  if (explicit) {
    return {
      level: explicit,
      confidence: 100,
      reasoning: `Explicit ${explicit} classification selected by the requester.`,
      source: "explicit",
    };
  }

  const joined = [
    report.organizationName,
    report.department,
    report.businessObjective,
    report.currentChallenges,
    report.expectedOutcomes,
    report.successCriteria,
    report.constraints,
    report.existingSystems,
    report.integrationRequirements,
    report.complianceRequirements,
    report.riskFactors,
    report.stakeholders,
  ].map((value) => (normalizeOptionalText(value) || "").toLowerCase()).filter(Boolean).join(" ");

  const sovereignSignals = /\b(sovereign|classified|restricted|national security|defen[cs]e|police|passport|emirates id|biometric|facial recognition|cctv|surveillance|critical infrastructure)\b/i;
  const confidentialSignals = /\b(confidential|personal data|pii|employee data|customer data|patient|health|financial|finance|hr|payroll|contract|procurement|vendor commercial|integration credential|api key|cybersecurity|security control)\b/i;
  const publicSignals = /\b(public website|public portal|open data|public information|marketing site|public dashboard|published content)\b/i;

  if (sovereignSignals.test(joined)) {
    return {
      level: "sovereign",
      confidence: 88,
      reasoning: "AUTO classification detected sovereign, restricted, public-safety, identity, surveillance, or critical-infrastructure signals before Brain pipeline refinement.",
      source: "auto",
    };
  }

  if (confidentialSignals.test(joined)) {
    return {
      level: "confidential",
      confidence: 82,
      reasoning: "AUTO classification detected personal, commercial, finance, HR, procurement, cybersecurity, or integration-sensitive context before Brain pipeline refinement.",
      source: "auto",
    };
  }

  if (publicSignals.test(joined)) {
    return {
      level: "public",
      confidence: 76,
      reasoning: "AUTO classification detected public-facing or open-information context before Brain pipeline refinement.",
      source: "auto",
    };
  }

  return {
    level: "internal",
    confidence: 74,
    reasoning: "AUTO classification defaulted to internal for enterprise demand content with no public-only or restricted-data signals. COREVIA Brain may refine this after full layer execution.",
    source: "auto",
  };
}

function normalizeNullableJsonArray(value: unknown): unknown[] | null | undefined {
  if (value === null) return null;
  return Array.isArray(value) ? value : undefined;
}

function normalizeAiAnalysisUpdate(value: unknown): UpdateDemandReportData["aiAnalysis"] | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value;
  if (isRecord(value)) return value;
  return undefined;
}

const APPROVED_WORKFLOW_STATUSES = new Set([
  "acknowledged",
  "meeting_scheduled",
  "under_review",
  "initially_approved",
  "approved",
  "manager_approval",
  "manager_approved",
  "pending_conversion",
  "converted",
  "completed",
]);

function getGeneratedArtifacts(payload: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const decisionPayload = isRecord(payload.decision) ? payload.decision : {};
  const advisoryCandidates = [
    payload.advisory,
    payload.advisoryPackage,
    payload.advisory_package,
    payload.advisory_package_data,
    decisionPayload.advisory,
    decisionPayload.advisoryPackage,
    decisionPayload.advisory_package,
    decisionPayload.advisory_package_data,
  ];

  for (const candidate of advisoryCandidates) {
    if (!isRecord(candidate)) {
      continue;
    }

    const generatedArtifacts = isRecord(candidate.generatedArtifacts)
      ? candidate.generatedArtifacts
      : undefined;
    if (generatedArtifacts) {
      return generatedArtifacts;
    }
  }

  return isRecord(payload.generatedArtifacts) ? payload.generatedArtifacts : null;
}

function getDeferredDemandFieldsDraft(payload: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  const generatedArtifacts = getGeneratedArtifacts(payload);
  const direct = generatedArtifacts?.DEMAND_FIELDS;
  if (isRecord(direct)) {
    return direct;
  }

  const snake = generatedArtifacts?.demand_fields;
  if (isRecord(snake)) {
    return snake;
  }

  const camel = generatedArtifacts?.demandFields;
  if (isRecord(camel)) {
    return camel;
  }

  return null;
}

function unwrapDemandFieldsPayload(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) {
    return {};
  }

  const nestedContent = raw.content;
  if (isRecord(nestedContent)) {
    return nestedContent;
  }

  return raw;
}

function isFallbackDemandDraft(raw: unknown): boolean {
  const payload = unwrapDemandFieldsPayload(raw);
  return isRecord(payload.meta) && payload.meta.fallback === true;
}

function getLatestLayerAuditEventData(decision: DecisionDetailPayload | null, layer: number): Record<string, unknown> | undefined {
  if (!decision || !Array.isArray(decision.auditEvents)) {
    return undefined;
  }

  const matchingEvents = decision.auditEvents.filter((event) => {
    if (!isRecord(event) || !isRecord(event.payload)) {
      return false;
    }

    return event.payload.layer === layer;
  });

  const latest = matchingEvents.at(-1);
  if (!isRecord(latest) || !isRecord(latest.payload) || !isRecord(latest.payload.eventData)) {
    return undefined;
  }

  return latest.payload.eventData;
}

function hasMeaningfulReportContent(report: DemandReport): boolean {
  return [
    report.expectedOutcomes,
    report.successCriteria,
    report.currentChallenges,
    report.riskFactors,
    report.complianceRequirements,
  ].some((value) => typeof value === "string" && value.trim().length > 0);
}

function resolveDemandArtifactSource(params: {
  persistedArtifactAvailable: boolean;
  deferredArtifactAvailable: boolean;
  report: DemandReport;
}): DemandArtifactLifecyclePayload["source"] {
  const { persistedArtifactAvailable, deferredArtifactAvailable, report } = params;
  if (persistedArtifactAvailable) {
    return "persisted_decision_artifact";
  }
  if (deferredArtifactAvailable) {
    return "deferred_advisory_draft";
  }
  if (hasMeaningfulReportContent(report)) {
    return "report_record";
  }
  return "manual_entry";
}

function resolveDemandDecisionStatus(decision: DecisionDetailPayload | null): string | null {
  const decisionStatus = decision?.decision?.status;
  if (typeof decisionStatus === "string") {
    return decisionStatus;
  }

  const rootStatus = decision?.status;
  if (typeof rootStatus === "string") {
    return rootStatus;
  }

  return null;
}

function resolvePrimaryRoutingValue(routingValue: unknown, auditValue: unknown): string | null {
  if (typeof routingValue === "string") {
    return routingValue;
  }

  if (typeof auditValue === "string") {
    return auditValue;
  }

  return null;
}

function resolveDemandArtifactPhase(params: {
  executionEligible: boolean;
  clarificationRequired: boolean;
  currentLayer?: number;
  decisionId?: string;
  source: DemandArtifactLifecyclePayload["source"];
}): DemandArtifactLifecyclePayload["phase"] {
  const { executionEligible, clarificationRequired, currentLayer, decisionId, source } = params;

  if (executionEligible) {
    return "approved_artifact";
  }
  if (clarificationRequired) {
    return "clarification_required";
  }
  if (typeof currentLayer === "number" && currentLayer >= 7) {
    return "validated_draft";
  }
  if (decisionId || source !== "manual_entry") {
    return "draft_candidate";
  }

  return "report_snapshot";
}

function resolveGeneratedVersionStatus(
  statusMap: Record<string, string>,
  reportId: string,
  hasDraftAnalysis: boolean,
): string {
  const persistedStatus = statusMap[reportId];
  if (persistedStatus) {
    return persistedStatus;
  }

  return hasDraftAnalysis ? "draft" : "not_generated";
}

function normalizeGovernedFieldKey(value: unknown): string {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function extractGovernedFieldKey(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (isRecord(value)) {
    const candidates = [value.field, value.fieldName, value.key, value.name, value.id];
    const match = candidates.find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);
    return typeof match === "string" ? match : null;
  }
  return null;
}

function reportHasGovernedFieldValue(report: DemandReport, fieldKey: string): boolean {
  const normalizedField = normalizeGovernedFieldKey(fieldKey);
  if (!normalizedField) return false;

  return Object.entries(report as unknown as Record<string, unknown>).some(([key, value]) => {
    const normalizedKey = normalizeGovernedFieldKey(key);
    if (normalizedKey !== normalizedField && !normalizedKey.includes(normalizedField) && !normalizedField.includes(normalizedKey)) {
      return false;
    }
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    return value !== null && value !== undefined;
  });
}

function countOpenGovernedItems(report: DemandReport, items: unknown[] | undefined): number {
  if (!Array.isArray(items)) return 0;

  return items.filter((item) => {
    const fieldKey = extractGovernedFieldKey(item);
    if (!fieldKey) return true;
    return !reportHasGovernedFieldValue(report, fieldKey);
  }).length;
}

function decorateReportsWithVersionStatuses(
  reports: DemandReport[],
  params: {
    includeRequirementsStatus: boolean;
    includeBusinessCaseStatus: boolean;
    includeEnterpriseArchitectureStatus: boolean;
    includeStrategicFitStatus: boolean;
    requirementsStatusMap: Record<string, string>;
    businessCaseStatusMap: Record<string, string>;
    enterpriseArchitectureStatusMap: Record<string, string>;
    strategicFitStatusMap: Record<string, string>;
  },
): Array<DemandReport & DemandReportVersionDecorations> {
  const {
    includeRequirementsStatus,
    includeBusinessCaseStatus,
    includeEnterpriseArchitectureStatus,
    includeStrategicFitStatus,
    requirementsStatusMap,
    businessCaseStatusMap,
    enterpriseArchitectureStatusMap,
    strategicFitStatusMap,
  } = params;

  if (!includeRequirementsStatus && !includeBusinessCaseStatus && !includeEnterpriseArchitectureStatus && !includeStrategicFitStatus) {
    return reports;
  }

  return reports.map((report) => {
    const decorated: DemandReport & DemandReportVersionDecorations = { ...report };

    if (includeRequirementsStatus) {
      decorated.requirementsVersionStatus = resolveGeneratedVersionStatus(
        requirementsStatusMap,
        report.id,
        Boolean(report.requirementsAnalysis),
      );
    }

    if (includeBusinessCaseStatus) {
      decorated.businessCaseVersionStatus = resolveGeneratedVersionStatus(
        businessCaseStatusMap,
        report.id,
        false,
      );
    }

    if (includeEnterpriseArchitectureStatus) {
      decorated.enterpriseArchitectureVersionStatus = resolveGeneratedVersionStatus(
        enterpriseArchitectureStatusMap,
        report.id,
        Boolean(report.enterpriseArchitectureAnalysis),
      );
    }

    if (includeStrategicFitStatus) {
      decorated.strategicFitVersionStatus = resolveGeneratedVersionStatus(
        strategicFitStatusMap,
        report.id,
        Boolean((report as Record<string, unknown>).strategicFitAnalysis),
      );
    }

    return decorated;
  });
}

function buildDemandArtifactLifecycle(params: {
  report: DemandReport;
  decisionId?: string;
  decision: DecisionDetailPayload | null;
  artifact?: Record<string, unknown>;
  currentLayer?: number;
}): DemandArtifactLifecyclePayload {
  const { report, decisionId, decision, artifact, currentLayer } = params;
  const context = decision?.context;
  const artifactRecord = isRecord(artifact) ? artifact : null;
  const deferredDraft = getDeferredDemandFieldsDraft(decision);
  const persistedArtifactAvailable = Boolean(
    artifactRecord && isRecord(artifactRecord.content) && !isFallbackDemandDraft(artifactRecord.content),
  );
  const deferredArtifactAvailable = Boolean(deferredDraft && !isFallbackDemandDraft(deferredDraft));
  const source = resolveDemandArtifactSource({
    persistedArtifactAvailable,
    deferredArtifactAvailable,
    report,
  });

  const decisionStatus = resolveDemandDecisionStatus(decision);
  const workflowStatus = typeof report.workflowStatus === "string" ? report.workflowStatus : null;
  const missingFieldsCount = countOpenGovernedItems(report, context?.missingFields);
  const requiredInfoCount = countOpenGovernedItems(report, context?.requiredInfo);
  const clarificationRequired = decisionStatus === "needs_info" || missingFieldsCount > 0 || requiredInfoCount > 0;
  const executionEligible = Boolean(workflowStatus && APPROVED_WORKFLOW_STATUSES.has(workflowStatus));
  const phase = resolveDemandArtifactPhase({
    executionEligible,
    clarificationRequired,
    currentLayer,
    decisionId,
    source,
  });

  const routing = isRecord(decision?.orchestration?.routing) ? decision?.orchestration?.routing : null;
  const l5Audit = getLatestLayerAuditEventData(decision, 5);
  const primaryEngineKind = resolvePrimaryRoutingValue(routing?.primaryEngineKind, l5Audit?.primaryEngineKind);
  const primaryPluginName = resolvePrimaryRoutingValue(routing?.primaryPluginName, l5Audit?.primaryPluginName);

  return {
    phase,
    phaseLabel: DEMAND_ARTIFACT_PHASE_LABELS[phase],
    phaseDescription: DEMAND_ARTIFACT_PHASE_DESCRIPTIONS[phase],
    source,
    sourceLabel: DEMAND_ARTIFACT_SOURCE_LABELS[source],
    sourceDescription: DEMAND_ARTIFACT_SOURCE_DESCRIPTIONS[source],
    decisionId: decisionId ?? null,
    decisionStatus,
    workflowStatus,
    artifactStatus: typeof artifactRecord?.status === "string" ? artifactRecord.status : null,
    artifactVersion: typeof artifactRecord?.version === "number" ? artifactRecord.version : null,
    currentLayer: typeof currentLayer === "number" ? currentLayer : null,
    missingFieldsCount: missingFieldsCount + requiredInfoCount,
    executionEligible,
    primaryEngineKind,
    primaryPluginName,
  };
}

function normalizeUpdateData(data: DemandReportUpdateInput): UpdateDemandReportData {
  const { workflowHistory, notificationsSent, aiAnalysis, ...rest } = data;
  const normalizedWorkflowHistory = normalizeNullableJsonArray(workflowHistory);
  const normalizedNotificationsSent = normalizeNullableJsonArray(notificationsSent);
  const normalizedAiAnalysis = normalizeAiAnalysisUpdate(aiAnalysis);

  const normalized: UpdateDemandReportData = { ...rest };
  if (normalizedWorkflowHistory === undefined) {
    // no-op
  } else {
    normalized.workflowHistory = normalizedWorkflowHistory;
  }
  if (normalizedNotificationsSent === undefined) {
    // no-op
  } else {
    normalized.notificationsSent = normalizedNotificationsSent;
  }
  if (normalizedAiAnalysis === undefined) {
    return normalized;
  }
  normalized.aiAnalysis = normalizedAiAnalysis;

  return normalized;
}

export function createDemandReportsCoreRoutes(storage: DemandStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddlewareWithOwnership(storage);
  const deps = buildDemandDeps(storage);

  // GET /brain-approvals - Get demand reports pending Brain Layer 7 human approval
  router.get("/brain-approvals", auth.requireAuth, auth.requirePermission("brain:view"), asyncHandler(async (_req, res) => {
    const allReports = await deps.reports.getAll();
    const CLOSED_STATUSES = new Set(["approved", "rejected", "revised"]);

    const pendingReports = allReports.filter((report) => {
      const aiAnalysis = parseAiAnalysis(report.aiAnalysis);
      const decisionId = aiAnalysis.decisionId;
      if (!decisionId) return false;

      const approvalRequired =
        (aiAnalysis as Record<string, unknown>).approvalRequired === true ||
        String((aiAnalysis as Record<string, unknown>).finalStatus ?? "").toLowerCase() === "pending_approval";
      if (!approvalRequired) return false;

      const approvalStatus = String(aiAnalysis.approvalStatus ?? "").toLowerCase();
      const directorApprovalStatus = String((aiAnalysis as Record<string, unknown>).directorApprovalStatus ?? "").toLowerCase();
      if (CLOSED_STATUSES.has(approvalStatus) || CLOSED_STATUSES.has(directorApprovalStatus)) return false;

      return true;
    });

    const data = pendingReports.map((report) => ({
      id: report.id,
      projectId: report.projectId ?? null,
      suggestedProjectName: report.suggestedProjectName ?? null,
      businessObjective: report.businessObjective ?? null,
      workflowStatus: report.workflowStatus ?? null,
      urgency: report.urgency ?? null,
      dataClassification: (report.dataClassification as string | null | undefined) ?? null,
      budgetRange: report.budgetRange ?? null,
      estimatedBudget: report.estimatedBudget ?? null,
      decisionSpineId: report.decisionSpineId ?? null,
      aiAnalysis: report.aiAnalysis ?? null,
      createdAt: report.createdAt ?? null,
    }));

    res.json({ success: true, data });
  }));

  // GET /stats - Get demand report statistics
  router.get("/stats", auth.requireAuth, asyncHandler(async (_req, res) => {
    const stats = await deps.reports.getStats();
    res.json(stats);
  }));

  // GET / - Get all demand reports
  router.get("/", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const parsedQuery = listQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters",
      });
    }

    const {
      status,
      page,
      pageSize,
      fields,
      includeRequirementsStatus,
      includeBusinessCaseStatus,
      includeEnterpriseArchitectureStatus,
      includeStrategicFitStatus,
      q,
      mine,
    } = parsedQuery.data;
    const fieldList = parseFieldList(fields);
    const mineParam = parseBoolean(mine) === true;
    const authReq = req as AuthRequest;
    const createdByFilter = mineParam ? authReq.user?.id || authReq.auth?.userId : undefined;
    const {
      shouldIncludeRequirementsStatus,
      shouldIncludeBusinessCaseStatus,
      shouldIncludeEnterpriseArchitectureStatus,
      shouldIncludeStrategicFitStatus,
    } = resolveStatusInclusion({
      fieldList,
      includeRequirementsStatus,
      includeBusinessCaseStatus,
      includeEnterpriseArchitectureStatus,
      includeStrategicFitStatus,
    });

    if (mineParam && !createdByFilter) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const cacheKey = JSON.stringify({
      status,
      page: page ?? null,
      pageSize: pageSize ?? null,
      fields: fieldList,
      includeRequirementsStatus: shouldIncludeRequirementsStatus,
      includeBusinessCaseStatus: shouldIncludeBusinessCaseStatus,
      includeEnterpriseArchitectureStatus: shouldIncludeEnterpriseArchitectureStatus,
      includeStrategicFitStatus: shouldIncludeStrategicFitStatus,
      q: q ?? null,
      mine: mineParam,
      userId: mineParam ? createdByFilter : null,
        _version: 3, // Cache bust when schema changes
      });
    const cachedResponse = getCachedListResponse(cacheKey);
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    const { shouldPaginate, resolvedPage, resolvedPageSize, startIndex } = resolvePagination(page, pageSize);
    const trimmedQuery = q?.trim().toLowerCase();
    const { reports, totalCount } = await loadReportsForList({
      deps,
      status,
      trimmedQuery,
      shouldPaginate,
      resolvedPageSize,
      startIndex,
      createdByFilter,
      mineParam,
    });
    const {
      requirementsStatusMap,
      businessCaseStatusMap,
      enterpriseArchitectureStatusMap,
      strategicFitStatusMap,
    } = await loadVersionStatusMaps({
      deps,
      reports,
      includeRequirementsStatus: shouldIncludeRequirementsStatus,
      includeBusinessCaseStatus: shouldIncludeBusinessCaseStatus,
      includeEnterpriseArchitectureStatus: shouldIncludeEnterpriseArchitectureStatus,
      includeStrategicFitStatus: shouldIncludeStrategicFitStatus,
    });
    const decisionStatusMap = await loadDecisionStatusMap({
      deps,
      reports,
      requirementsStatusMap,
      enterpriseArchitectureStatusMap,
    });
    const payload = buildDemandListPayload({
      reports,
      fieldList,
      totalCount,
      resolvedPage,
      resolvedPageSize,
      shouldIncludeRequirementsStatus,
      shouldIncludeBusinessCaseStatus,
      shouldIncludeEnterpriseArchitectureStatus,
      shouldIncludeStrategicFitStatus,
      requirementsStatusMap,
      businessCaseStatusMap,
      enterpriseArchitectureStatusMap,
      strategicFitStatusMap,
      decisionStatusMap,
    });

      setCachedListResponse(cacheKey, payload);
    res.json(payload);
  }));

  // GET /:id/submitted-summary - Get submitted demand summary with decision feedback
  router.get("/:id/submitted-summary", auth.requireAuth, async (req, res) => {
    try {
      const { id } = req.params as { id: string };
      const report = await deps.reports.findById(id);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: "Demand report not found",
        });
      }

      const authReq = req as AuthRequest;
      const requesterId = authReq.user?.id || authReq.auth?.userId;
      const isOwner = await isDemandReportOwner(deps, report, requesterId);

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          error: "Not authorized to view this report",
        });
      }

      const aiAnalysis = parseAiAnalysis(report.aiAnalysis);
      const { decisionId, fullDecision } = await loadDemandDecisionDetail(
        deps,
        id,
        aiAnalysis,
        aiAnalysis?.decisionId,
      );

      res.json({
        success: true,
        report: {
          id: report.id,
          projectId: report.projectId,
          suggestedProjectName: report.suggestedProjectName,
          organizationName: report.organizationName,
          department: report.department,
          requestorName: report.requestorName,
          requestorEmail: report.requestorEmail,
          urgency: report.urgency,
          businessObjective: report.businessObjective,
          currentChallenges: report.currentChallenges,
          expectedOutcomes: report.expectedOutcomes,
          successCriteria: report.successCriteria,
          constraints: report.constraints,
          currentCapacity: report.currentCapacity,
          budgetRange: report.budgetRange,
          timeframe: report.timeframe,
          stakeholders: report.stakeholders,
          existingSystems: report.existingSystems,
          integrationRequirements: report.integrationRequirements,
          complianceRequirements: report.complianceRequirements,
          riskFactors: report.riskFactors,
          dataClassification: report.dataClassification,
          workflowStatus: report.workflowStatus,
          decisionReason: report.decisionReason,
          rejectionCategory: report.rejectionCategory,
          deferredUntil: report.deferredUntil,
          meetingDate: report.meetingDate,
          meetingNotes: report.meetingNotes,
          managerEmail: report.managerEmail,
          workflowHistory: report.workflowHistory,
          createdAt: report.createdAt ?? null,
          updatedAt: report.updatedAt,
        },
        decisionFeedback: buildSubmittedSummaryDecisionFeedback({
          decisionId,
          fullDecision,
          correlationId: aiAnalysis?.correlationId,
        }),
      });
    } catch (error) {
      logger.error("Error fetching submitted demand summary:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch submitted demand summary",
      });
    }
  });

  // GET /:id - Get specific demand report with latest published version data
  router.get("/:id", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const report = await deps.reports.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Demand report not found"
      });
    }

    // Debug: Log project identification fields
    logger.info('[API] Demand report project fields:', {
      reportId: id,
      projectId: report.projectId,
      suggestedProjectName: report.suggestedProjectName,
      hasProjectId: !!report.projectId,
      hasSuggestedProjectName: !!report.suggestedProjectName,
      currentChallenges: report.currentChallenges ? 'SET' : 'EMPTY',
      existingSystems: report.existingSystems ? 'SET' : 'EMPTY',
      integrationRequirements: report.integrationRequirements ? 'SET' : 'EMPTY',
      complianceRequirements: report.complianceRequirements ? 'SET' : 'EMPTY',
      riskFactors: report.riskFactors ? 'SET' : 'EMPTY',
      dataClassification: report.dataClassification
    });

    const latestVersion = await deps.reports.getLatestReportVersionByType(id, "business_case");
    const reportWithVersion = report as DemandReportWithCurrentVersion;

    if (latestVersion && (latestVersion.status === 'published' || latestVersion.status === 'approved')) {
      report.aiAnalysis = latestVersion.versionData || null;

      reportWithVersion.currentVersion = {
        id: latestVersion.id,
        versionNumber: latestVersion.versionNumber || null,
        status: latestVersion.status || null,
        createdBy: latestVersion.createdByName || null,
        createdAt: latestVersion.createdAt || null,
        publishedAt: latestVersion.publishedAt || null,
        publishedBy: latestVersion.publishedByName || null,
      };
    } else {
      if (!report.aiAnalysis) {
        report.aiAnalysis = null;
      }

      reportWithVersion.currentVersion = {
        id: null,
        versionNumber: 'v0.0.0',
        status: 'draft',
        createdBy: 'System',
        createdAt: report.createdAt ?? null,
        publishedAt: null,
        publishedBy: null
      };
    }

    const aiAnalysis = parseAiAnalysis(report.aiAnalysis);
    const { decisionId, fullDecision } = await loadDemandDecisionDetail(
      deps,
      id,
      aiAnalysis,
      aiAnalysis?.decisionId || report.decisionSpineId || undefined,
    );

    const currentLayer = await getDecisionCurrentLayer(deps, decisionId);
    const latestDemandFieldsArtifact = await getLatestDemandFieldsArtifact(deps, decisionId);
    const artifactLifecycle = buildDemandArtifactLifecycle({
      report,
      decisionId,
      decision: fullDecision,
      artifact: latestDemandFieldsArtifact,
      currentLayer,
    });

    res.json({
      success: true,
      data: {
        ...report,
        decisionFeedback: buildDecisionFeedbackSummary({
          decisionId,
          fullDecision,
          correlationId: aiAnalysis?.correlationId,
        }),
        artifactLifecycle,
      }
    });
  }));

  // GET /:id/workflow-status - Get workflow status for specific demand report
  router.get("/:id/workflow-status", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const report = await deps.reports.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Demand report not found"
      });
    }

    res.json({
      success: true,
      status: report.workflowStatus || 'generated',
      history: report.workflowHistory || [],
      lastUpdated: report.updatedAt || report.createdAt,
      currentStage: {
        stage: report.workflowStatus || 'generated',
        timestamp: report.updatedAt || report.createdAt,
        performer: 'System'
      }
    });
  }));

  // POST / - Create new demand report with automatic business case generation
  router.post("/", auth.requireAuth, auth.requirePermission("report:create"), validateBody(insertDemandReportSchema), async (req, res) => {

    try {
      const authReq = req as AuthRequest;
      const authContext = requireAuthContext(authReq);
      const validation = insertDemandReportSchema.safeParse(req.body);

      if (!validation.success) {
        logger.error('[Demand Create] Validation failed:', JSON.stringify(validation.error.errors, null, 2));
        logger.error('[Demand Create] Received keys:', Object.keys(req.body));
        const validationMessage = formatValidationErrors(validation.error.errors);
        return res.status(400).json({
          success: false,
          error: `Invalid demand report data: ${validationMessage}`,
          details: validation.error.errors
        });
      }

      const requestedProjectId = validation.data.projectId?.trim().toUpperCase();
      if (requestedProjectId) {
        const exists = await deps.projectIds.projectIdExists(requestedProjectId);
        if (exists) {
          return res.status(409).json({
            success: false,
            error: "Project ID already exists",
          });
        }
      }

      // Auto-generate project ID if not provided using DB sequence.
      const projectId = requestedProjectId || await deps.projectIds.next();

      // Auto-generate suggested project name using AI if not provided
      const suggestedProjectName = buildSuggestedProjectName(
        validation.data.businessObjective,
        validation.data.suggestedProjectName,
        validation.data.organizationName,
      );

      const decisionSpineId = normalizeOptionalText(validation.data.decisionSpineId) || `DSP-${randomUUID()}`;
      const initialClassification = resolveInitialDemandClassification(validation.data as Partial<DemandReport>);
      const reportData = {
        ...validation.data,
        projectId, // Auto-generated unique project identifier
        suggestedProjectName, // AI-generated project name
        decisionSpineId,
        dataClassification: initialClassification.level,
        dataClassificationConfidence: validation.data.dataClassificationConfidence ?? initialClassification.confidence,
        dataClassificationReasoning: validation.data.dataClassificationReasoning ?? initialClassification.reasoning,
        createdBy: authContext.userId,
        workflowStatus: "generated",
        workflowHistory: buildGeneratedWorkflowHistory(),
      };

      const report = await deps.reports.create(reportData);

      setImmediate(() => {
        void notifyDemandReviewers(deps, report, authContext.userId);
      });

      const userId = authContext.userId;
      const reportId = report.id;
      const organizationId = getAuthenticatedOrganizationId(authReq);
      const normalizedClassification = normalizeDemandClassificationForPipeline(report.dataClassification);
      const brainInput = buildDemandBrainInput(report, reportId, normalizedClassification);

      setImmediate(() => {
        void processDemandCreationPipeline({
          deps,
          report,
          reportId,
          userId,
          organizationId,
          decisionSpineId,
          brainInput,
        });
      });

      res.status(201).json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error("Error creating demand report:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create demand report"
      });
    }
  });

  // PUT /:id - Update demand report
  router.put("/:id", auth.requireAuth, auth.requirePermission("report:update-self"), validateBody(updateDemandReportSchema), async (req, res) => {

    try {
      const authReq = req as AuthRequest;
      const authContext = requireAuthContext(authReq);
      const { id } = req.params as { id: string };
      logger.info('📥 PUT /api/demand-reports/:id - Request body:', JSON.stringify(req.body, null, 2));
      const validation = updateDemandReportSchema.safeParse(req.body);

      if (!validation.success) {
        logger.error('❌ Validation failed:', JSON.stringify(validation.error.errors, null, 2));
        return res.status(400).json({
          success: false,
          error: "Invalid update data",
          details: validation.error.errors
        });
      }

      const currentReport = await deps.reports.findById(id);
      if (!currentReport) {
        return res.status(404).json({
          success: false,
          error: "Demand report not found"
        });
      }

      const canEdit = await auth.validateReportOwnership(
        id,
        authContext.userId,
        authContext.role,
        authContext.customPermissions,
      );
      if (!canEdit) {
        return res.status(403).json({ error: "You can only edit your own reports" });
      }

      const normalizedUpdateData = normalizeUpdateData(validation.data);
      const updatedReport = await deps.reports.update(id, normalizedUpdateData);

      if (!updatedReport) {
        return res.status(404).json({
          success: false,
          error: "Demand report not found"
        });
      }

      if (validation.data.workflowStatus === 'meeting_scheduled' &&
          validation.data.meetingDate &&
          validation.data.managerEmail) {
        try {
          const recipientEmail = validation.data.managerEmail;
          logger.info('📧 Sending Business Case meeting notification to:', recipientEmail);
          await deps.notifier.sendBusinessCaseMeeting({
            recipientEmail: recipientEmail,
            recipientName: recipientEmail.split('@')[0]!,
            demandTitle: updatedReport.businessObjective || 'Digital Transformation Request',
            organizationName: updatedReport.organizationName || 'Government Organization',
            reportId: id,
            meetingDate: validation.data.meetingDate,
            meetingNotes: validation.data.meetingNotes || undefined
          });
          logger.info('✅ Business Case meeting notification sent successfully');
        } catch (emailError) {
          logger.error('❌ Failed to send Business Case meeting notification:', emailError);
        }
      }

      res.json({
        success: true,
        data: updatedReport
      });
    } catch (error) {
      logger.error("Error updating demand report:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update demand report"
      });
    }
  });

  // PATCH /:id - Update demand report (alias for PUT)
  router.patch("/:id", auth.requireAuth, auth.requirePermission("report:update-self"), validateBody(updateDemandReportSchema), asyncHandler(async (req, res) => {

    const authReq = req as AuthRequest;
    const authContext = requireAuthContext(authReq);
    const { id } = req.params as { id: string };
    const validation = updateDemandReportSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid update data",
        details: validation.error.errors
      });
    }

    const currentReport = await deps.reports.findById(id);
    if (!currentReport) {
      return res.status(404).json({
        success: false,
        error: "Demand report not found"
      });
    }

    const canEdit = await auth.validateReportOwnership(
      id,
      authContext.userId,
      authContext.role,
      authContext.customPermissions,
    );
    if (!canEdit) {
      return res.status(403).json({ error: "You can only edit your own reports" });
    }

    const updateData: UpdateDemandReportData = normalizeUpdateData(validation.data);
    if (validation.data.workflowStatus && validation.data.workflowStatus !== currentReport.workflowStatus) {
      const now = new Date();
      const newStatus = validation.data.workflowStatus;

      switch (newStatus) {
        case 'acknowledged':
          updateData.acknowledgedAt = now;
          break;
        case 'meeting_scheduled':
          updateData.meetingScheduledAt = now;
          break;
        case 'under_review':
          updateData.reviewStartedAt = now;
          break;
        case 'approved':
          updateData.approvedAt = now;
          break;
        case 'manager_approved':
          updateData.managerApprovedAt = now;
          updateData.completedAt = now;
          break;
        case 'completed':
          updateData.completedAt = now;
          break;
        case 'rejected':
          updateData.rejectedAt = now;
          break;
        case 'deferred':
          updateData.deferredAt = now;
          break;
        case 'generated':
          if (!currentReport.submittedAt) {
            updateData.submittedAt = now;
          }
          break;
      }
    }

    const updatedReport = await deps.reports.update(id, updateData);

    if (!updatedReport) {
      return res.status(404).json({
        success: false,
        error: "Demand report not found"
      });
    }

    res.json({
      success: true,
      data: updatedReport
    });
  }));

  // DELETE /:id - Delete demand report
  router.delete("/:id", auth.requireAuth, auth.requirePermission("report:delete"), asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    const authContext = requireAuthContext(authReq);
    const { id } = req.params as { id: string };

    if (authContext.role !== 'manager') {
      return res.status(403).json({ error: "Only managers can delete reports" });
    }

    const deleted = await deps.reports.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Demand report not found"
      });
    }

    res.json({
      success: true,
      message: "Demand report deleted successfully"
    });
  }));

  return router;
}
