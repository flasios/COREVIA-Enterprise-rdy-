/**
 * Shared helpers, instances, and Zod schemas used across COREVIA Brain route files.
 */
import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { coreviaStorage } from "../storage";
import { SpineOrchestrator } from "../spine/spine-orchestrator";
import { storage } from "../../interfaces/storage";
import { logger } from "../../platform/observability";

// ── Singleton instances ────────────────────────────────────────────────
export const spineOrchestrator = new SpineOrchestrator(coreviaStorage);

// ── UUID check ─────────────────────────────────────────────────────────
export function isUuid(value: string | undefined | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// ── Pagination ─────────────────────────────────────────────────────────
export function parsePaginationValue(value: unknown, defaultValue: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return defaultValue;
  return Math.floor(parsed);
}

// ── User clearance from request ────────────────────────────────────────
export function getUserClearanceLevel(req: Request): "public" | "internal" | "confidential" | "sovereign" {
  const user = (req as unknown as { user?: Record<string, unknown> }).user;
  if (!user) return "public";

  const role = user.role || user.userRole || "";
  const clearance = user.clearance || user.securityClearance || "";

  if (clearance === "sovereign" || role === "admin" || role === "super_admin") {
    return "sovereign";
  }
  if (clearance === "confidential" || role === "department_head" || role === "pmo_lead") {
    return "confidential";
  }
  if (clearance === "internal" || role === "analyst" || role === "reviewer") {
    return "internal";
  }
  return "public";
}

// ── Tenant-scoped spine access guard ───────────────────────────────────
export async function enforceTenantDecisionSpineAccess(
  req: Request,
  res: Response,
  decisionSpineId: string,
): Promise<boolean> {
  const tenant = req.tenant as
    | { organizationId?: string | null; isSystemAdmin?: boolean }
    | undefined;
  if (!tenant || tenant.isSystemAdmin) return true;

  const tenantOrgId = tenant.organizationId || null;
  if (!tenantOrgId) {
    res.status(403).json({ success: false, error: "Organization context required" });
    return false;
  }

  const reqForOrg = await coreviaStorage.getLatestRequestForOrganization(decisionSpineId, tenantOrgId);
  if (!reqForOrg) {
    res.status(404).json({ success: false, error: "Decision not found" });
    return false;
  }

  return true;
}

// ── Version approval readiness (business case / requirements) ──────────
export async function getVersionApprovalReadiness(
  decisionId: string,
  decision: Record<string, unknown>,
): Promise<{
  requiresVersionApproval: boolean;
  versionApproved: boolean;
  versionType: string | null;
  versionStatus: string | null;
  versionNumber: string | null;
  demandReportId: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  message: string;
}> {
  const routeKey = String(decision.routeKey || "").toLowerCase();
  const serviceId = String(decision.serviceId || "").toLowerCase();
  const isBusinessCase =
    routeKey.includes("business") || routeKey.includes("business_case") || serviceId.includes("business");
  const isRequirements =
    routeKey.includes("requirement") ||
    routeKey.includes("detailed_requirements") ||
    serviceId.includes("requirement");

  if (!isBusinessCase && !isRequirements) {
    return {
      requiresVersionApproval: false,
      versionApproved: true,
      versionType: null,
      versionStatus: null,
      versionNumber: null,
      demandReportId: null,
      approvedBy: null,
      approvedAt: null,
      message: "Version approval not required for this decision type",
    };
  }

  const versionType = isBusinessCase ? "business_case" : "requirements";

  try {
    const reports = await storage.getAllDemandReports();
    const inputData = (decision.normalizedInput || decision.inputData || decision.input || {}) as Record<string, unknown>;
    const projectName = String((inputData as Record<string, unknown>).suggestedProjectName || (inputData as Record<string, unknown>).projectName || (inputData as Record<string, unknown>).title || "");

    let linkedReport = reports.find((r: Record<string, unknown>) => {
      const analysis = r.aiAnalysis as Record<string, unknown> | null;
      return analysis?.decisionId === decisionId;
    });

    if (!linkedReport && projectName) {
      const normalizedName = projectName.trim().toLowerCase();
      linkedReport = reports.find(
        (r: Record<string, unknown>) => ((r.suggestedProjectName as string) || "").trim().toLowerCase() === normalizedName,
      );
    }

    if (!linkedReport) {
      return {
        requiresVersionApproval: true,
        versionApproved: false,
        versionType,
        versionStatus: null,
        versionNumber: null,
        demandReportId: null,
        approvedBy: null,
        approvedAt: null,
        message: `No linked demand report found. ${isBusinessCase ? "Business case" : "Requirements"} must be generated and director-approved before execution.`,
      };
    }

    const versions = await storage.getReportVersions(linkedReport.id);
    const relevantVersions = versions.filter((v: Record<string, unknown>) => v.versionType === versionType);

    if (relevantVersions.length === 0) {
      return {
        requiresVersionApproval: true,
        versionApproved: false,
        versionType,
        versionStatus: null,
        versionNumber: null,
        demandReportId: linkedReport.id,
        approvedBy: null,
        approvedAt: null,
        message: `No ${isBusinessCase ? "business case" : "requirements"} versions found. Create and get director approval before executing actions.`,
      };
    }

    const sortedVersions = relevantVersions.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const aMajor = Number(a.majorVersion ?? 0);
      const bMajor = Number(b.majorVersion ?? 0);
      if (bMajor !== aMajor) return bMajor - aMajor;
      const aMinor = Number(a.minorVersion ?? 0);
      const bMinor = Number(b.minorVersion ?? 0);
      if (bMinor !== aMinor) return bMinor - aMinor;
      return Number(b.patchVersion ?? 0) - Number(a.patchVersion ?? 0);
    });

    const approvedVersion = sortedVersions.find(
      (v: Record<string, unknown>) => v.status === "published" || v.status === "approved",
    );
    const latestVersion = approvedVersion || sortedVersions[0]!;
    const versionLabel = `${Number(latestVersion.majorVersion ?? 1)}.${Number(latestVersion.minorVersion ?? 0)}.${Number(latestVersion.patchVersion ?? 0)}`;

    const isVersionApproved = latestVersion.status === "published" || latestVersion.status === "approved";

    const reportWorkflowStatus = (linkedReport as Record<string, unknown>).workflowStatus as string || "";
    const businessCaseWorkflowStatus = (linkedReport as Record<string, unknown>).businessCaseWorkflowStatus as string || "";
    const approvedWorkflowStatuses = [
      "manager_approved",
      "approved",
      "completed",
      "review_started",
      "acknowledged",
    ];
    const approvedBCStatuses = ["approved", "published", "completed"];
    const isDirectorApproved = isBusinessCase
      ? approvedWorkflowStatuses.includes(reportWorkflowStatus) ||
        approvedBCStatuses.includes(businessCaseWorkflowStatus) ||
        isVersionApproved
      : isVersionApproved;

    const label = isBusinessCase ? "Business case" : "Requirements";

    const displayStatus = isDirectorApproved && !isVersionApproved ? "approved" : String(latestVersion.status ?? "");
    const approvedByName: string | null =
      String(latestVersion.approvedByName ||
      latestVersion.approvedBy ||
      latestVersion.publishedByName ||
      (linkedReport as Record<string, unknown>).approvedBy ||
      "") || null;
    const approvedAtDate =
      latestVersion.approvedAt ||
      latestVersion.publishedAt ||
      (linkedReport as Record<string, unknown>).approvedAt ||
      (linkedReport as Record<string, unknown>).managerApprovedAt ||
      null;

    return {
      requiresVersionApproval: true,
      versionApproved: isDirectorApproved,
      versionType,
      versionStatus: displayStatus,
      versionNumber: versionLabel,
      demandReportId: linkedReport.id,
      approvedBy: approvedByName,
      approvedAt: approvedAtDate ? new Date(String(approvedAtDate)).toISOString() : null,
      message: isDirectorApproved
        ? `${label} v${versionLabel} approved${approvedByName ? ` by ${approvedByName}` : ""}. Ready for execution.`
        : `${label} v${versionLabel} is "${String(latestVersion.status)}". Director approval required before executing actions.`,
    };
  } catch (error) {
    logger.warn("[COREVIA] Version readiness check error:", error);
    return {
      requiresVersionApproval: true,
      versionApproved: false,
      versionType,
      versionStatus: null,
      versionNumber: null,
      demandReportId: null,
      approvedBy: null,
      approvedAt: null,
      message: "Could not verify version approval status. Please check the business case workflow.",
    };
  }
}

// ── Policy-pack multer setup ───────────────────────────────────────────
export const policyUploadDir = path.resolve("uploads", "policy-packs");
if (!fs.existsSync(policyUploadDir)) {
  fs.mkdirSync(policyUploadDir, { recursive: true });
}

export const policyPackAllowedExtensions = [
  ".pdf", ".json", ".yaml", ".yml", ".txt", ".xml", ".csv", ".docx", ".xlsx",
];

export const policyUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, policyUploadDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e6);
      const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, uniqueSuffix + "-" + safeName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/json",
      "text/yaml",
      "application/x-yaml",
      "text/plain",
      "application/xml",
      "text/xml",
      "text/csv",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `File type ${file.mimetype} not supported. Accepted: PDF, JSON, YAML, XML, CSV, TXT, DOCX, XLSX`,
        ),
      );
    }
  },
});
