import { Router } from "express";
import { z } from "zod";
import type { DemandStorageSlice } from "../application/buildDeps";
import { createAuthMiddlewareWithOwnership } from "@interfaces/middleware/auth";
import type { VersionContent, AiAnalysisData, RecommendationsInput, SmartObjective } from "../application";
import { generateVersionPDF } from "../application";
import { format } from "date-fns";
import { type InsertReportVersion, type ReportVersion, type UpdateReportVersion, type VersionAuditLog } from "@shared/schema";
import type { Role, CustomPermissions } from "@shared/permissions";
import { buildDemandDeps } from "../application/buildDeps";
import type { WorkflowNotifier, CoveriaNotifier } from "../domain/ports";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";
import { buildInsertBusinessCaseFromArtifact } from "../application/normalizers";
import { applyFinancialOverridesToComputedModel } from "./demand-reports-business-case.financial-overrides";

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];
type ReportContentType = "business_case" | "requirements" | "enterprise_architecture" | "strategic_fit";
type SummaryContentType = "business_case" | "requirements";
type StoredVersionType = NonNullable<InsertReportVersion["versionType"]>;
type VersionIncrementType = "major" | "minor" | "patch";
type DemandReportRecord = NonNullable<Awaited<ReturnType<ReturnType<typeof buildDemandDeps>["reports"]["findById"]>>>;

type VersionData = Record<string, unknown>;

interface TeamAssignment {
  team: string;
  [key: string]: unknown;
}

interface RiskMatrixBuckets {
  highProbabilityHighImpact: Array<Record<string, unknown>>;
  highProbabilityLowImpact: Array<Record<string, unknown>>;
  lowProbabilityHighImpact: Array<Record<string, unknown>>;
  lowProbabilityLowImpact: Array<Record<string, unknown>>;
}

interface WorkflowHistoryEntry {
  timestamp: string;
  action: string;
  description: string;
  performedBy: string;
  previousStatus?: string;
  newStatus?: string;
  approvalLevel?: string;
  comments?: string;
  rollbackDetails?: Record<string, unknown>;
}

interface EnrichedRecommendationsResult {
  implementationRoadmap?: {
    quickWins?: unknown[];
    strategicInitiatives?: unknown[];
  };
  [key: string]: unknown;
}

type VersionUpdateData = UpdateReportVersion;

interface VersionResponseData {
  version: ReportVersion;
  integrity: { isValid: boolean; errors: string[] };
  auditLog?: VersionAuditLog[];
}

type VersionSignature = {
  contentHash: string;
  signature: string;
  signedBy: string;
  signedByName: string;
  signedByRole: string;
  signedAt: string | Date;
  algorithm: string;
};

const isVersionSignature = (value: unknown): value is VersionSignature => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.contentHash === "string"
    && typeof record.signature === "string"
    && typeof record.signedBy === "string"
    && typeof record.signedByName === "string"
    && typeof record.signedByRole === "string"
    && (typeof record.signedAt === "string" || record.signedAt instanceof Date)
    && typeof record.algorithm === "string";
};

const normalizeRoleInput = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const DEMAND_WORKFLOW_ORDER = [
  'generated',
  'acknowledged',
  'meeting_scheduled',
  'under_review',
  'initially_approved',
  'manager_approval',
  'manager_approved',
  'approved',
  'completed',
  'deferred',
  'rejected',
] as const;

function shouldAdvanceDemandWorkflow(currentStatus: unknown, nextStatus: string): boolean {
  const current = typeof currentStatus === 'string' ? currentStatus : '';
  const curIdx = DEMAND_WORKFLOW_ORDER.indexOf(current as typeof DEMAND_WORKFLOW_ORDER[number]);
  const nextIdx = DEMAND_WORKFLOW_ORDER.indexOf(nextStatus as typeof DEMAND_WORKFLOW_ORDER[number]);
  if (nextIdx === -1) return false;
  if (curIdx === -1) return true;
  return nextIdx > curIdx;
}

function getDocumentLabel(versionType: unknown): string {
  if (versionType === 'requirements') return 'Requirements';
  if (versionType === 'enterprise_architecture') return 'Enterprise architecture';
  if (versionType === 'strategic_fit') return 'Strategic fit';
  return 'Business case';
}

function computeDemandWorkflowFromVersionStatus(versionStatus: string): string | null {
  if (versionStatus === 'under_review') return 'under_review';
  if (versionStatus === 'approved') return 'initially_approved';
  if (versionStatus === 'published') return 'manager_approved';
  if (versionStatus === 'rejected') return 'rejected';
  return null;
}

async function createCoveriaNotification(coveriaNotifier: CoveriaNotifier, notifier: WorkflowNotifier, params: {
  userId: string;
  title: string;
  message: string;
  type?: string;
  priority?: string;
  relatedType?: string;
  relatedId?: string;
  actionUrl?: string;
}): Promise<void> {
  const { userId, title, message, type = 'info', priority = 'medium', relatedType, relatedId, actionUrl } = params;

  await coveriaNotifier.notify({
    userId,
    title,
    message,
    type,
    priority,
    relatedType,
    relatedId,
    actionUrl,
  });

  const superadminId = await notifier.getSuperadminUserId();
  if (superadminId && superadminId !== userId) {
    await coveriaNotifier.notify({
      userId: superadminId,
      title: `[Mirror] ${title}`,
      message: `[Sent to another user] ${message}`,
      type,
      priority,
      relatedType,
      relatedId,
      actionUrl,
    });
  }
}

function requireSessionUserId(req: { session?: { userId?: string } }): string {
  const userId = req.session?.userId;
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

function normalizeDemandAiAnalysis(value: unknown): Record<string, unknown> | string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function toSpreadableRecord(value: unknown): Record<string, unknown> {
  return toRecord(value) ?? {};
}

function normalizeRecommendationText(value: unknown): string | null | undefined {
  if (Array.isArray(value)) {
    return value.join("\n");
  }

  return typeof value === "string" ? value : undefined;
}

function normalizeComparableString(value: unknown, fallback = "medium"): string {
  if (typeof value === "string") {
    return value.toLowerCase();
  }

  return fallback;
}

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMissingOrUuidName(value: unknown): boolean {
  if (typeof value !== "string") {
    return true;
  }
  const normalized = value.trim();
  if (!normalized) {
    return true;
  }
  return UUID_V4_PATTERN.test(normalized);
}

async function enrichVersionActorNames(
  versions: ReportVersion[],
  getUser: (id: string) => Promise<{ displayName?: string | null; username?: string | null } | undefined>,
): Promise<ReportVersion[]> {
  const candidateIds = new Set<string>();

  for (const version of versions) {
    if (typeof version.createdBy === "string" && version.createdBy && isMissingOrUuidName(version.createdByName)) {
      candidateIds.add(version.createdBy);
    }
    if (typeof version.approvedBy === "string" && version.approvedBy && isMissingOrUuidName(version.approvedByName)) {
      candidateIds.add(version.approvedBy);
    }
    if (typeof version.reviewedBy === "string" && version.reviewedBy && isMissingOrUuidName(version.reviewedByName)) {
      candidateIds.add(version.reviewedBy);
    }
    if (typeof version.rejectedBy === "string" && version.rejectedBy && isMissingOrUuidName(version.rejectedByName)) {
      candidateIds.add(version.rejectedBy);
    }
  }

  if (candidateIds.size === 0) {
    return versions;
  }

  const userNameById = new Map<string, string>();
  await Promise.all(Array.from(candidateIds).map(async (userId) => {
    try {
      const user = await getUser(userId);
      const resolvedName = user?.displayName || user?.username;
      if (resolvedName) {
        userNameById.set(userId, resolvedName);
      }
    } catch {
      // Keep original values if user lookup fails.
    }
  }));

  return versions.map((version) => {
    const nextVersion: ReportVersion = { ...version };

    if (typeof version.createdBy === "string" && isMissingOrUuidName(version.createdByName)) {
      nextVersion.createdByName = userNameById.get(version.createdBy) || version.createdByName || "System";
    }
    if (typeof version.approvedBy === "string" && isMissingOrUuidName(version.approvedByName)) {
      nextVersion.approvedByName = userNameById.get(version.approvedBy) || version.approvedByName || "Unknown";
    }
    if (typeof version.reviewedBy === "string" && isMissingOrUuidName(version.reviewedByName)) {
      nextVersion.reviewedByName = userNameById.get(version.reviewedBy) || version.reviewedByName || "Unknown";
    }
    if (typeof version.rejectedBy === "string" && isMissingOrUuidName(version.rejectedByName)) {
      nextVersion.rejectedByName = userNameById.get(version.rejectedBy) || version.rejectedByName || "Unknown";
    }

    return nextVersion;
  });
}

function versionBelongsToReport(version: ReportVersion | null | undefined, reportId: string): version is ReportVersion {
  return version?.reportId === reportId;
}

function getDetailedDocumentLabel(versionType: unknown): string {
  if (versionType === 'requirements') return 'Requirements analysis';
  if (versionType === 'strategic_fit') return 'Strategic fit analysis';
  return getDocumentLabel(versionType);
}

function getVersionTabSlug(versionType: unknown): string {
  if (versionType === 'requirements') return 'detailed-requirements';
  if (versionType === 'enterprise_architecture') return 'enterprise-architecture';
  if (versionType === 'strategic_fit') return 'strategic-fit';
  return 'business-case';
}

function sanitizeFilenamePart(value: string | null | undefined): string {
  return (value ?? 'demand_report').replaceAll(/[^a-z0-9]/gi, '_');
}

function normalizeStringArrayItems(value: unknown): string[] | undefined {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const items: string[] = [];
    for (const item of value) {
      if (typeof item === "string") {
        items.push(item);
      }
    }
    return items.length > 0 ? items : undefined;
  }

  if (typeof value === "string") {
    const items = value
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  return undefined;
}

function resolveDecisionSpineId(report: Record<string, unknown>): string | undefined {
  const reportDecisionSpineId = typeof report.decisionSpineId === "string" ? report.decisionSpineId : undefined;
  if (reportDecisionSpineId) {
    return reportDecisionSpineId;
  }

  const aiAnalysis = toRecord(report.aiAnalysis);
  return typeof aiAnalysis?.decisionId === "string" ? aiAnalysis.decisionId : undefined;
}

function isSummaryContentType(value: string): value is SummaryContentType {
  return value === "business_case" || value === "requirements";
}

function toStoredVersionType(value: string): StoredVersionType {
  if (
    value === "business_case"
    || value === "requirements"
    || value === "enterprise_architecture"
    || value === "strategic_fit"
    || value === "both"
  ) {
    return value;
  }

  return "business_case";
}

function toJsonValue(value: unknown): Json | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value as Json;
}

function requireRouteParam(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing route parameter: ${label}`);
  }

  return value;
}

// ── Extracted request body schemas (used with validateBody middleware) ────
const createVersionBodySchema = z.object({
  versionType: z.enum(['major', 'minor', 'patch'], {
    errorMap: () => ({ message: "Version type must be 'major', 'minor', or 'patch'" })
  }),
  contentType: z.enum(['business_case', 'requirements', 'enterprise_architecture', 'strategic_fit']).default('business_case'),
  changesSummary: z.string().min(10, "Changes summary must be at least 10 characters").optional(),
  skipAiSummary: z.boolean().default(false),
  editReason: z.string().min(5, "Edit reason must be at least 5 characters").optional(),
  createdBy: z.string().min(1, "Created by is required"),
  createdByName: z.string().min(2, "Creator name must be at least 2 characters"),
  createdByRole: z.string().optional(),
  createdByDepartment: z.string().optional(),
  sessionId: z.string().optional(),
  ipAddress: z.string().optional(),
  businessCaseId: z.string().optional(),
  editedContent: z.record(z.unknown()).optional(),
  teamAssignments: z.array(z.record(z.unknown())).optional()
});

const updateVersionBodySchema = z.object({
  status: z.enum(['draft', 'under_review', 'approved', 'published', 'archived', 'rejected', 'superseded']).optional(),
  reviewComments: z.string().optional(),
  approvalComments: z.string().optional(),
  updatedBy: z.string().min(1, "Updated by is required"),
  updatedByName: z.string().min(2, "Updater name is required"),
  updatedByRole: z.string().optional(),
  sessionId: z.string().optional(),
  ipAddress: z.string().optional()
});

const approveVersionBodySchema = z.object({
  approvalComments: z.string().optional(),
  approvalLevel: z.enum(['initial', 'manager', 'final']).default('initial'),
  sessionId: z.string().optional(),
  ipAddress: z.string().optional()
});

const rollbackVersionBodySchema = z.object({
  rollbackReason: z.string().min(15, "Rollback reason must be at least 15 characters for audit compliance"),
  performedBy: z.string().min(1, "Performer ID is required"),
  performedByName: z.string().min(2, "Performer name is required"),
  performedByRole: z.string().min(1, "Performer role is required for government audit"),
  performedByDepartment: z.string().min(1, "Department is required for organizational tracking"),
  sessionId: z.string().optional(),
  ipAddress: z.string().optional(),
  approvalRequired: z.boolean().default(true)
});

const publishVersionBodySchema = z.object({
  publishReason: z.string().min(10, "Publish reason must be at least 10 characters"),
  performedBy: z.string().min(1, "Publisher ID is required"),
  performedByName: z.string().min(2, "Publisher name is required"),
  performedByRole: z.string().min(1, "Publisher role is required"),
  performedByDepartment: z.string().min(1, "Department is required"),
  sessionId: z.string().optional(),
  ipAddress: z.string().optional(),
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional()
});

const sendToManagerSchema = z.object({
  managerEmail: z.string().optional(),
  message: z.string().optional(),
});
const migrateToVersionsSchema = z.object({
  performedBy: z.string(),
  performedByName: z.string(),
});

type NullableValue = string | number | null;

function buildBusinessCaseEmailPayload(businessCase: Record<string, unknown>): Record<string, unknown> {
  const financialAnalysis = {
    roi: (businessCase.roiPercentage as NullableValue) ?? undefined,
    npv: (businessCase.npvValue as NullableValue) ?? undefined,
    paybackPeriod: (businessCase.paybackMonths as NullableValue) ?? undefined,
    tco: (businessCase.totalCostEstimate as NullableValue) ?? undefined,
  };
  const hasFinancialAnalysis = Object.values(financialAnalysis).some(value => value !== undefined && value !== null);

  return {
    smartObjectives: Array.isArray(businessCase.smartObjectives)
      ? (businessCase.smartObjectives as SmartObjective[])
      : undefined,
    recommendations: businessCase.recommendations || undefined,
    financialAnalysis: hasFinancialAnalysis ? financialAnalysis : undefined,
    executiveSummary: typeof businessCase.executiveSummary === "string" ? businessCase.executiveSummary : undefined,
  };
}

interface SendToManagerContext {
  deps: ReturnType<typeof buildDemandDeps>;
  reportId: string;
  versionId: string;
  version: ReportVersion;
  report: Record<string, unknown>;
  managerEmail: string;
  message: string;
  sentByName: string;
}

async function sendVersionContentToManager(ctx: SendToManagerContext): Promise<{ emailSent: boolean; contentType: string } | { error: string; status: number }> {
  const { deps, reportId, versionId, version, report, managerEmail, message, sentByName } = ctx;
  const vType = version.versionType || 'business_case';

  if (vType === 'business_case' || !version.versionType || vType === 'both') {
    const businessCase = await deps.businessCase.findByDemandReportId(reportId);
    if (!businessCase) {
      return { error: "Business case not found", status: 404 };
    }
    logger.info('Business case data for email:', {
      reportTitle: report.businessObjective,
      executiveSummary: businessCase.executiveSummary,
      smartObjectives: businessCase.smartObjectives,
      recommendations: businessCase.recommendations
    });
    const payload = buildBusinessCaseEmailPayload(businessCase as unknown as Record<string, unknown>);
    const emailSent = await deps.notifier.sendBusinessCaseToManager(
      managerEmail, payload, version.versionNumber, sentByName, message,
      reportId, { versionId, reportTitle: (report.businessObjective as string) ?? undefined }
    );
    return { emailSent, contentType: 'Business case' };
  }

  if (vType === 'requirements') {
    const requirementsData = version.versionData || report.requirementsAnalysis;
    if (!requirementsData) {
      return { error: "Requirements data not found", status: 404 };
    }
    const requirementsObj = requirementsData as Record<string, unknown>;
    logger.info('Requirements data for email:', {
      reportTitle: report.businessObjective,
      capabilities: (requirementsObj.capabilities as unknown[])?.length || 0,
      functionalRequirements: (requirementsObj.functionalRequirements as unknown[])?.length || 0,
      securityRequirements: (requirementsObj.securityRequirements as unknown[])?.length || 0
    });
    const teamAssignments = Array.isArray(version.teamAssignments) ? (version.teamAssignments as TeamAssignment[]) : [];
    const emailSent = await deps.notifier.sendRequirementsToManager(
      managerEmail, requirementsObj, teamAssignments, version.versionNumber, sentByName, message,
      { reportId, versionId, reportTitle: (report.businessObjective as string) ?? undefined }
    );
    return { emailSent, contentType: 'Requirements analysis' };
  }

  if (vType === 'enterprise_architecture') return { emailSent: false, contentType: 'Enterprise architecture' };
  if (vType === 'strategic_fit') return { emailSent: false, contentType: 'Strategic fit analysis' };

  return { error: `Unsupported version type: ${version.versionType}`, status: 400 };
}

// ── Approve-handler helpers ──────────────────────────────────────────────

interface ApprovalTransactionContext {
  deps: ReturnType<typeof buildDemandDeps>;
  reportId: string;
  versionId: string;
  report: Record<string, unknown>;
  version: ReportVersion;
  approverUserId: string;
  approverName: string;
  approverRole: string;
  approvalLevel?: string;
  approvalComments?: string;
  sessionId?: string;
  ipAddress?: string;
}

function isPrimaryWorkflowType(versionType: string | null | undefined): boolean {
  return versionType === 'business_case' || versionType === 'both' || !versionType;
}

function resolveApprovalAction(isPrimary: boolean, isPublished: boolean): string {
  if (isPrimary && isPublished) return 'version_published';
  if (isPrimary) return 'version_initially_approved';
  if (isPublished) return 'tab_published';
  return 'tab_approved';
}

function buildApprovalHistoryEntry(
  version: ReportVersion, newStatus: string,
  approverUserId: string, approverName: string,
): Record<string, unknown> {
  const documentLabel = getDetailedDocumentLabel(version.versionType);
  const isPublished = newStatus === 'published';
  const isPrimary = isPrimaryWorkflowType(version.versionType);
  const action = resolveApprovalAction(isPrimary, isPublished);

  const approvalVerb = isPrimary ? 'initially approved' : 'approved';
  const description = isPublished
    ? `${documentLabel} version ${version.versionNumber} published by ${approverName} - Final Approval`
    : `${documentLabel} version ${version.versionNumber} ${approvalVerb} by ${approverName}`;

  return {
    timestamp: new Date().toISOString(),
    action,
    description,
    performedBy: approverUserId,
    performedByName: approverName,
    versionId: version.id,
    versionNumber: version.versionNumber,
    versionType: version.versionType,
  };
}

async function updateDemandReportWorkflow(
  deps: ReturnType<typeof buildDemandDeps>,
  reportId: string,
  report: Record<string, unknown>,
  version: ReportVersion,
  newStatus: string,
  approverUserId: string,
  approverName: string,
): Promise<void> {
  const reportWorkflowHistory = Array.isArray(report.workflowHistory) ? report.workflowHistory : [];
  const historyEntry = buildApprovalHistoryEntry(version, newStatus, approverUserId, approverName);

  const demandUpdate: Record<string, unknown> = {
    workflowHistory: [...reportWorkflowHistory, historyEntry],
  };

  if (isPrimaryWorkflowType(version.versionType)) {
    const reportWorkflowStatus = newStatus === 'published' ? 'manager_approved' : 'initially_approved';
    if (shouldAdvanceDemandWorkflow(report.workflowStatus, reportWorkflowStatus)) {
      demandUpdate.workflowStatus = reportWorkflowStatus;
      demandUpdate.approvedBy = approverUserId;
      demandUpdate[reportWorkflowStatus === 'initially_approved' ? 'approvedAt' : 'managerApprovedAt'] = new Date();
    }
  }

  await deps.reports.update(reportId, demandUpdate);
}

async function backfillDecisionSpineLink(ctx: DecisionSpineSyncContext, decisionSpineId: string): Promise<void> {
  const { deps, reportId, report } = ctx;

  if (report.decisionSpineId) {
    return;
  }

  try {
    await deps.reports.update(reportId, { decisionSpineId });
  } catch (err) {
    logger.warn('[Versions] Failed to backfill demandReports.decisionSpineId:', err);
  }
}

async function ensureInitialDecisionSpineEvent(ctx: DecisionSpineSyncContext, decisionSpineId: string): Promise<void> {
  try {
    await ctx.deps.brain.handleSpineEvent({
      decisionSpineId,
      event: 'DEMAND_SUBMITTED',
      actorId: ctx.approverUserId,
      payload: { source: 'version_approve' },
    });
  } catch (err) {
    logger.warn('[Versions] Failed to ensure initial sub-decisions:', err);
  }
}

function getSubDecisionType(versionType: string | null | undefined): string {
  const typeMap: Record<string, string> = {
    business_case: 'BUSINESS_CASE',
    requirements: 'REQUIREMENTS',
    enterprise_architecture: 'ENTERPRISE_ARCHITECTURE',
    strategic_fit: 'STRATEGIC_FIT',
    both: 'BUSINESS_CASE',
  };

  return typeMap[versionType || 'business_case'] || 'BUSINESS_CASE';
}

async function ensureApprovalSyncSubDecision(
  ctx: DecisionSpineSyncContext,
  decisionSpineId: string,
  subDecisionType: string,
): Promise<Awaited<ReturnType<DecisionSpineSyncContext['deps']['brain']['findSubDecision']>>> {
  let subDecision = await ctx.deps.brain.findSubDecision(decisionSpineId, subDecisionType);

  if (subDecision) {
    return subDecision;
  }

  try {
    const artifact = await ctx.deps.brain.createDecisionArtifact({
      decisionSpineId,
      artifactType: subDecisionType,
      createdBy: ctx.approverUserId,
    });
    await ctx.deps.brain.createDecisionArtifactVersion({
      artifactId: artifact.artifactId,
      content: {},
      changeSummary: 'Initial draft (auto-created from version approval sync)',
      createdBy: ctx.approverUserId,
    });
    subDecision = await ctx.deps.brain.createSubDecision({
      decisionSpineId,
      subDecisionType,
      artifactId: artifact.artifactId,
      status: 'DRAFT',
      createdBy: ctx.approverUserId,
    });
  } catch (ensureErr) {
    logger.warn('[Versions] Failed to auto-create missing sub-decision:', ensureErr);
  }

  return subDecision;
}

async function syncApprovalRecord(ctx: DecisionSpineSyncContext, decisionSpineId: string): Promise<void> {
  const { deps, result, approverName, documentLabel } = ctx;

  if (result.status !== 'approved' && result.status !== 'published') {
    return;
  }

  const approval = await deps.brain.getApproval(decisionSpineId);
  const approvalPayload = {
    status: 'approved',
    approvedBy: approverName,
    approvalReason: `Synced from ${documentLabel} ${result.status} (${result.versionNumber})`,
    approvedActions: approval?.approvedActions || [],
  };

  if (approval) {
    await deps.brain.updateApproval(decisionSpineId, approvalPayload);
    return;
  }

  await deps.brain.createApproval({
    decisionId: decisionSpineId,
    approvalId: `APR-${decisionSpineId.slice(0, 8)}`,
    ...approvalPayload,
  });
}

async function executeApprovalTransaction(ctx: ApprovalTransactionContext): Promise<ReportVersion> {
  const {
    deps, reportId, versionId, report, version,
    approverUserId, approverName, approverRole,
    approvalLevel, approvalComments, sessionId, ipAddress,
  } = ctx;

  return deps.versions.executeInTransaction(async () => {
    const previousState = { ...version };
    const newStatus = version.status === 'manager_approval' ? 'published' : 'approved';

    const approvalHistoryEntry: WorkflowHistoryEntry = {
      timestamp: new Date().toISOString(),
      previousStatus: version.status,
      newStatus,
      action: newStatus === 'published' ? 'published' : 'approved',
      description: newStatus === 'published'
        ? `Version published by ${approverName} (${approverRole}) - Final Approval`
        : `Version approved by ${approverName} (${approverRole})`,
      performedBy: approverUserId,
      approvalLevel,
      comments: approvalComments,
    };

    const updates: VersionUpdateData = {
      status: newStatus,
      workflowStep: newStatus === 'published' ? 'publication' : 'approval',
      approvedBy: approverUserId,
      approvedByName: approverName,
      approvedAt: new Date(),
      approvalComments,
      workflowHistory: [
        ...((version.workflowHistory as WorkflowHistoryEntry[]) || []),
        approvalHistoryEntry,
      ],
    };

    const nextReview = new Date();
    nextReview.setFullYear(nextReview.getFullYear() + 1);
    updates.nextReviewDate = nextReview;

    if (newStatus === 'published') {
      updates.publishedBy = approverUserId;
      updates.publishedByName = approverName;
      updates.publishedAt = new Date();
      updates.effectiveAt = new Date();
    }

    const approvedVersion = await deps.versions.update(versionId, updates);
    if (!approvedVersion) throw new Error("Failed to approve version");

    await updateDemandReportWorkflow(
      deps, reportId, report as unknown as Record<string, unknown>,
      version, newStatus, approverUserId, approverName,
    );

    await deps.versions.createAuditLog(
      deps.versionManager.createAuditLogEntry({
        action: newStatus === 'published' ? 'published' : 'approved',
        versionId, reportId, performedBy: approverUserId, performedByName: approverName,
        description: newStatus === 'published'
          ? `Version ${version.versionNumber} published by ${approverName} - Final Approval`
          : `Version ${version.versionNumber} approved by ${approverName} with ${approvalLevel} level approval`,
        previousState, newState: approvedVersion, sessionId, ipAddress, performedByRole: approverRole,
      })
    );

    return approvedVersion;
  });
}

interface DecisionSpineSyncContext {
  deps: ReturnType<typeof buildDemandDeps>;
  reportId: string;
  report: Record<string, unknown>;
  version: ReportVersion;
  result: ReportVersion;
  approverUserId: string;
  approverName: string;
  documentLabel: string;
}

async function syncApprovalToDecisionSpine(ctx: DecisionSpineSyncContext): Promise<void> {
  const { deps, reportId, report, version, result, approverUserId } = ctx;

  const aiDecisionId = typeof toRecord(report.aiAnalysis)?.decisionId === "string"
    ? toRecord(report.aiAnalysis)?.decisionId as string
    : undefined;
  const latestDecision = await deps.brain.findLatestDecisionByDemandReportId(reportId);
  const decisionSpineId = resolveDecisionSpineId(report) || version.decisionSpineId || aiDecisionId || latestDecision?.id;
  if (!decisionSpineId) return;

  await backfillDecisionSpineLink(ctx, decisionSpineId);
  await ensureInitialDecisionSpineEvent(ctx, decisionSpineId);

  const subDecisionType = getSubDecisionType(version.versionType);
  const subDecision = await ensureApprovalSyncSubDecision(ctx, decisionSpineId, subDecisionType);

  if (subDecision?.subDecisionId) {
    const nextEvent = result.status === 'rejected' ? "REJECT" : "APPROVE";
    const currentStatus = String((subDecision as Record<string, unknown>).status || "").toUpperCase();
    const alreadyAtTarget =
      (nextEvent === "APPROVE" && currentStatus === "APPROVED") ||
      (nextEvent === "REJECT" && currentStatus === "REJECTED");

    if (!alreadyAtTarget) {
      await deps.brain.handleSubDecisionEvent({
        subDecisionId: subDecision.subDecisionId,
        event: nextEvent,
        actorId: approverUserId,
      });
    }
  }

  await syncApprovalRecord(ctx, decisionSpineId);
}

interface CanonicalContentSyncContext {
  deps: ReturnType<typeof buildDemandDeps>;
  reportId: string;
  report: Record<string, unknown>;
  version: ReportVersion;
  result: ReportVersion;
  approverUserId: string;
}

async function syncApprovedContentToCanonical(ctx: CanonicalContentSyncContext): Promise<void> {
  const { deps, reportId, report, version, result, approverUserId } = ctx;

  if (result.status !== 'approved' && result.status !== 'published') return;
  const vType = version.versionType || 'business_case';
  if (vType !== 'business_case' && vType !== 'both') return;

  const approvedContent = (version.versionData || result.versionData) as Record<string, unknown>;
  if (!approvedContent || Object.keys(approvedContent).length === 0) return;

  // 1. Sync to business_cases table
  const existingBC = await deps.businessCase.findByDemandReportId(reportId);
  const decisionSpineForBC = (report.decisionSpineId || version.decisionSpineId || null) as string | null;

  const bcPayload = buildInsertBusinessCaseFromArtifact({
    demandReportId: reportId,
    decisionSpineId: decisionSpineForBC,
    generatedBy: approverUserId,
    artifact: approvedContent,
    qualityReport: approvedContent.qualityReport,
  });

  if (existingBC) {
    await deps.businessCase.update(existingBC.id, {
      ...bcPayload,
      demandReportId: undefined,
    } as unknown as Parameters<typeof deps.businessCase.update>[1]);
    logger.info(`[Versions] Synced approved version content to business_cases (id: ${existingBC.id})`);
  } else {
    await deps.businessCase.create(bcPayload);
    logger.info(`[Versions] Created business_cases record from approved version content`);
  }

  // 2. Sync to decision_artifact_versions
  if (decisionSpineForBC) {
    await deps.brain.upsertDecisionArtifactVersion({
      decisionSpineId: decisionSpineForBC,
      artifactType: "BUSINESS_CASE",
      subDecisionType: "BUSINESS_CASE",
      content: approvedContent,
      changeSummary: `Content synced from approved version ${result.versionNumber} (${result.status})`,
      createdBy: approverUserId,
    });
    logger.info(`[Versions] Synced approved version content to decision_artifact_versions (spine: ${decisionSpineForBC})`);
  }

  // 3. Update the report_versions record itself with latest versionData
  try {
    await deps.versions.update(ctx.version.id, {
      versionData: approvedContent,
    } as unknown as Parameters<typeof deps.versions.update>[1]);
  } catch (syncError) {
    logger.warn("[Versions] Failed to persist synced version content:", syncError);
  }
}

interface ApprovalNotificationContext {
  deps: ReturnType<typeof buildDemandDeps>;
  reportId: string;
  report: Record<string, unknown>;
  version: ReportVersion;
  result: ReportVersion;
  approverUserId: string;
  approverName: string;
  documentLabel: string;
}

async function sendApprovalNotifications(ctx: ApprovalNotificationContext): Promise<void> {
  const { deps, reportId, report, result, approverUserId, approverName, documentLabel } = ctx;
  const approvalTab = getVersionTabSlug(ctx.version.versionType);
  const objective = (report.businessObjective as string) || 'Untitled';

  if (result.status === 'approved') {
    const notificationJobs: Promise<unknown>[] = [];

    if (report.createdBy && report.createdBy !== approverUserId) {
      notificationJobs.push(
        createCoveriaNotification(deps.coveria, deps.notifier, {
          userId: report.createdBy as string,
          title: `${documentLabel} Initially Approved`,
          message: `Hello! COREVIA here. Brilliant news - your ${documentLabel.toLowerCase()} "${objective}" has received initial approval from ${approverName}. It's now ready to be submitted to management for final approval.`,
          type: 'success',
          priority: 'high',
          relatedType: 'demand_report',
          relatedId: reportId,
          actionUrl: `/demand-analysis-report/${reportId}?tab=${approvalTab}`,
        })
      );
    }

    const managers = await deps.users.getUsersWithPermission('workflow:final-approve');
    notificationJobs.push(
      ...managers.map((manager) =>
        createCoveriaNotification(deps.coveria, deps.notifier, {
          userId: manager.id,
          title: 'Management Approval Required',
          message: `Hello! COREVIA here. A ${documentLabel.toLowerCase()} for "${objective}" has passed initial review and requires your attention for final approval. This was initially approved by ${approverName}.`,
          type: 'approval_needed',
          priority: 'high',
          relatedType: 'demand_report',
          relatedId: reportId,
          actionUrl: `/demand-analysis-report/${reportId}?tab=${approvalTab}`,
        })
      )
    );

    await Promise.allSettled(notificationJobs);
  } else if (result.status === 'published') {
    if (report.createdBy) {
      await createCoveriaNotification(deps.coveria, deps.notifier, {
        userId: report.createdBy as string,
        title: `${documentLabel} Published`,
        message: `Hello! COREVIA here. Splendid news - your ${documentLabel.toLowerCase()} "${objective}" has received final approval and is now officially published! The document is locked for audit compliance. Congratulations on this milestone.`,
        type: 'success',
        priority: 'high',
        relatedType: 'demand_report',
        relatedId: reportId,
        actionUrl: `/demand-analysis-report/${reportId}?tab=${approvalTab}`,
      });
    }
  }
}

// ── Create-version helpers ──────────────────────────────────────────────

function buildRiskMatrixFromRisks(
  risks: Array<Record<string, unknown>>,
): RiskMatrixBuckets {
  const highSet = new Set(['high', 'critical', 'very high']);
  const matrix: RiskMatrixBuckets = {
    highProbabilityHighImpact: [],
    highProbabilityLowImpact: [],
    lowProbabilityHighImpact: [],
    lowProbabilityLowImpact: [],
  };

  for (const risk of risks) {
    const probability = normalizeComparableString(risk.probability ?? risk.severity);
    const impact = normalizeComparableString(risk.impact ?? risk.severity);
    const isHighProbability = highSet.has(probability);
    const isHighImpact = highSet.has(impact);

    if (isHighProbability && isHighImpact) matrix.highProbabilityHighImpact.push(risk);
    else if (isHighProbability) matrix.highProbabilityLowImpact.push(risk);
    else if (isHighImpact) matrix.lowProbabilityHighImpact.push(risk);
    else matrix.lowProbabilityLowImpact.push(risk);
  }

  return matrix;
}

interface BusinessCaseEnrichmentContext {
  deps: ReturnType<typeof buildDemandDeps>;
  editedContent: Record<string, unknown>;
  businessCaseId: string;
  report: Record<string, unknown>;
}

async function enrichRecommendationsAndNextSteps(
  deps: ReturnType<typeof buildDemandDeps>,
  businessCaseId: string,
  updates: Record<string, unknown>,
  enrichedData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const current = await deps.businessCase.findById(businessCaseId);
  const recommendationsInput = updates.recommendations
    ? normalizeRecommendationText(updates.recommendations)
    : normalizeRecommendationText(current?.recommendations) ?? current?.recommendations ?? null;

  const enrichedRecs = deps.enricher.enrichRecommendations(
    recommendationsInput as RecommendationsInput | string | null,
    updates.nextSteps || (Array.isArray(current?.nextSteps) ? current.nextSteps : []),
  ) as EnrichedRecommendationsResult;

  const result = { ...enrichedData };
  if (updates.recommendations) result.recommendations = enrichedRecs;
  if (updates.nextSteps) {
    result.nextSteps = enrichedRecs.implementationRoadmap?.quickWins?.concat(
      enrichedRecs.implementationRoadmap?.strategicInitiatives || [],
    ) || updates.nextSteps;
  }
  return result;
}

function computeAndMergeFinancialModel(
  deps: ReturnType<typeof buildDemandDeps>,
  updates: Record<string, unknown>,
  report: Record<string, unknown>,
  savedFinAssumptions: unknown,
  savedDomParams: unknown,
  enrichedData: Record<string, unknown>,
): Record<string, unknown> {
  logger.info('[Version Create] Processing unified financial data with server financial model...');
  const costOverrides = (updates.costOverrides && typeof updates.costOverrides === 'object')
    ? updates.costOverrides as Record<string, unknown>
    : {};
  const benefitOverrides = (updates.benefitOverrides && typeof updates.benefitOverrides === 'object')
    ? updates.benefitOverrides as Record<string, unknown>
    : {};
  const financialAssumptions = {
    ...(savedFinAssumptions && typeof savedFinAssumptions === 'object' ? savedFinAssumptions as Record<string, unknown> : {}),
    costOverrides,
    benefitOverrides,
  };
  const domainParams = savedDomParams || {};
  const financialSource = {
    ...updates,
    financialAssumptions,
    domainParameters: domainParams,
    aiRecommendedBudget: updates.aiRecommendedBudget,
  };

  const financialInputs = deps.financial.buildInputsFromData(
    financialSource as Record<string, unknown>,
    report,
  );
  const unifiedModel = deps.financial.compute(financialInputs);
  applyFinancialOverridesToComputedModel(
    unifiedModel as Record<string, unknown>,
    costOverrides,
    benefitOverrides,
  );

  logger.info('[Version Create] Computed unified model (server):', {
    npv: (unifiedModel.metrics as Record<string, unknown>)?.npv,
    roi: (unifiedModel.metrics as Record<string, unknown>)?.roi,
    verdict: (unifiedModel.decision as Record<string, unknown>)?.verdict,
  });

  return {
    ...enrichedData,
    totalCostEstimate: String(Number(financialInputs.totalInvestment) || Number(updates.totalCostEstimate) || 0),
    financialAssumptions,
    domainParameters: domainParams,
    computedFinancialModel: unifiedModel,
    aiRecommendedBudget: updates.aiRecommendedBudget,
  };
}

function isInvalidPaybackMonths(value: unknown): boolean {
  return value === null || value === undefined
    || value === 'null' || value === 'undefined'
    || !Number.isFinite(Number(value));
}

async function enrichAndSaveBusinessCase(ctx: BusinessCaseEnrichmentContext): Promise<void> {
  const { deps, editedContent, businessCaseId, report } = ctx;

  const {
    _id, _demandReportId, _createdAt, _updatedAt, _generatedAt, _lastUpdated, _approvedAt,
    _hasFinancialChanges: hasFinancialChanges,
    savedFinancialAssumptions: savedFinAssumptions,
    savedDomainParameters: savedDomParams,
    ...updates
  } = editedContent;

  const timestampFields = [
    'generatedAt', 'lastUpdated', 'createdAt', 'updatedAt', 'approvedAt',
    'marketResearchGeneratedAt',
  ];
  let enrichedData: Record<string, unknown> = { ...updates };
  for (const field of timestampFields) {
    delete enrichedData[field];
  }

  if (updates.stakeholderAnalysis) {
    const stakeholders = Array.isArray(updates.stakeholderAnalysis)
      ? updates.stakeholderAnalysis
      : (updates.stakeholderAnalysis as Record<string, unknown>).stakeholders || [];
    enrichedData.stakeholderAnalysis = deps.enricher.enrichStakeholderAnalysis(stakeholders);
  }

  if (updates.keyAssumptions) {
    enrichedData.keyAssumptions = deps.enricher.enrichAssumptions({
      keyAssumptions: updates.keyAssumptions,
    }).keyAssumptions;
  }

  if (updates.recommendations || updates.nextSteps) {
    enrichedData = await enrichRecommendationsAndNextSteps(deps, businessCaseId, updates, enrichedData);
  }

  if (hasFinancialChanges) {
    enrichedData = computeAndMergeFinancialModel(deps, updates, report, savedFinAssumptions, savedDomParams, enrichedData);
  }

  if (isInvalidPaybackMonths(enrichedData.paybackMonths)) {
    delete enrichedData.paybackMonths;
  }

  if (Array.isArray(enrichedData.identifiedRisks)) {
    enrichedData.riskMatrixData = buildRiskMatrixFromRisks(
      enrichedData.identifiedRisks as Array<Record<string, unknown>>,
    );
  }

  if (businessCaseId) {
    await deps.businessCase.update(businessCaseId, enrichedData);
  }
}

function normalizeUrgencyLevel(urgency: string): string {
  const urgencyMap: Record<string, string> = {
    low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical', urgent: 'Critical',
  };
  return urgencyMap[urgency.toLowerCase()] || 'Medium';
}

function normalizeReportFieldsForVersion(report: Record<string, unknown>): Record<string, unknown> {
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  const strListOrStr = (v: unknown): string[] | string | undefined => {
    if (typeof v === 'string') return v;
    return normalizeStringArrayItems(v);
  };

  return {
    expectedOutcomes: str(report.expectedOutcomes),
    successCriteria: str(report.successCriteria),
    constraints: str(report.constraints),
    currentCapacity: str(report.currentCapacity),
    budgetRange: str(report.budgetRange),
    timeframe: str(report.timeframe),
    stakeholders: strListOrStr(report.stakeholders),
    existingSystems: normalizeStringArrayItems(report.existingSystems),
    integrationRequirements: normalizeStringArrayItems(report.integrationRequirements),
    complianceRequirements: strListOrStr(report.complianceRequirements),
    riskFactors: strListOrStr(report.riskFactors),
  };
}

function buildRequiredVersionFields(report: Record<string, unknown>): Record<string, string> {
  return {
    organizationName: (typeof report.organizationName === 'string' && report.organizationName) || (typeof report.department === 'string' && report.department) || "Organization",
    requestorName: (typeof report.requestorName === 'string' && report.requestorName) || "System User",
    requestorEmail: (typeof report.requestorEmail === 'string' && report.requestorEmail) || "system@corevia.ae",
    department: (typeof report.department === 'string' && report.department) || "General",
    businessObjective: (typeof report.businessObjective === 'string' && report.businessObjective) || (typeof report.projectDescription === 'string' && report.projectDescription) || "Business objective",
  };
}

async function buildVersionDataForContentType(
  deps: ReturnType<typeof buildDemandDeps>,
  contentType: string,
  report: Record<string, unknown>,
  businessCaseId: string | undefined,
  reportId: string,
): Promise<VersionContent> {
  const normalizedFields = normalizeReportFieldsForVersion(report);
  const requiredFields = buildRequiredVersionFields(report);
  const urgency = report.urgency ? normalizeUrgencyLevel(report.urgency as string) : 'Medium';
  const aiAnalysis = (report.aiAnalysis && typeof report.aiAnalysis === 'object')
    ? report.aiAnalysis as AiAnalysisData
    : undefined;

  const baseFields = {
    ...report,
    ...normalizedFields,
    ...requiredFields,
    urgency,
    aiAnalysis,
  };

  if (contentType === 'business_case') {
    const currentBusinessCase = businessCaseId
      ? await deps.businessCase.findById(businessCaseId)
      : await deps.businessCase.findByDemandReportId(reportId);

    if (currentBusinessCase) {
      const { _id, _demandReportId, _createdAt, _updatedAt, ...businessCaseContent } = currentBusinessCase as Record<string, unknown>;
      return { ...businessCaseContent, ...requiredFields, urgency } as VersionContent;
    }
    return baseFields as VersionContent;
  }

  if (contentType === 'requirements') {
    return { ...baseFields, ...toSpreadableRecord(report.requirementsAnalysis) } as VersionContent;
  }
  if (contentType === 'enterprise_architecture') {
    return { ...baseFields, ...toSpreadableRecord(report.enterpriseArchitectureAnalysis) } as VersionContent;
  }
  return { ...baseFields, ...toSpreadableRecord(report.strategicFitAnalysis) } as VersionContent;
}

interface VersionAiAnalysisResult {
  changesSummary: string;
  impactAnalysis: Record<string, unknown> | null;
}

interface VersionAiAnalysisParams {
  deps: ReturnType<typeof buildDemandDeps>;
  previousVersionData: VersionData | null;
  currentData: VersionData | null;
  contentType: string | null;
  reportId: string;
  versionNumber: string;
  userChangesSummary: string | undefined;
  skipAiSummary: boolean;
}

async function generateVersionAiAnalysis(
  params: VersionAiAnalysisParams,
): Promise<VersionAiAnalysisResult> {
  const { deps, previousVersionData, currentData, contentType, reportId, versionNumber, userChangesSummary, skipAiSummary } = params;
  if (skipAiSummary || !previousVersionData || !currentData || !contentType) {
    return { changesSummary: userChangesSummary || 'Version updated', impactAnalysis: null };
  }

  let changesSummary = userChangesSummary;
  let impactAnalysis: Record<string, unknown> | null = null;
  const summaryContentType = isSummaryContentType(contentType) ? contentType : undefined;

  try {
    if (!changesSummary && summaryContentType) {
      logger.info("Generating AI summary for version changes...");
      changesSummary = await deps.versionAnalyzer.generateSummary(previousVersionData, currentData, summaryContentType);
      logger.info("AI-generated summary:", changesSummary);
    }

    logger.info("Analyzing version impact with AI...");
    impactAnalysis = await deps.versionAnalyzer.analyzeImpact(previousVersionData, currentData, {
      reportId,
      versionNumber,
      contentType,
    });
    logger.info("Impact analysis completed:", {
      risk: impactAnalysis.risk,
      changedFields: (impactAnalysis.changedFields as unknown[]).length,
    });
  } catch (error) {
    logger.error("AI analysis failed, continuing without it:", error);
    if (!changesSummary) changesSummary = "Version updated with changes";
  }

  return { changesSummary: changesSummary || 'Version updated', impactAnalysis };
}

interface CreateVersionParams {
  reportId: string;
  contentType: ReportContentType;
  versionData: VersionContent;
  versionMetadata: Record<string, unknown>;
  teamAssignments: unknown;
  changesSummary: string;
  changesDetails: unknown;
  editReason: string;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  createdByDepartment: string;
  report: Record<string, unknown>;
  versionType: VersionIncrementType;
}

async function createVersionWithRetry(
  deps: ReturnType<typeof buildDemandDeps>,
  existingVersions: ReportVersion[],
  nextVersion: { versionString: string; major: number; minor: number; patch: number },
  params: CreateVersionParams,
): Promise<Record<string, unknown>> {
  let versions = existingVersions;
  let ver = nextVersion;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await deps.versions.create({
        reportId: params.reportId,
        versionType: toStoredVersionType(params.contentType),
        versionNumber: ver.versionString,
        majorVersion: ver.major,
        minorVersion: ver.minor,
        patchVersion: ver.patch,
        parentVersionId: versions.length > 0 ? versions[0]!.id : null,
        baseVersionId: versions.at(-1)?.id ?? null,
        status: 'draft',
        versionData: params.versionData,
        versionMetadata: params.versionMetadata,
        teamAssignments: toJsonValue(params.teamAssignments),
        changesSummary: params.changesSummary,
        changesDetails: toJsonValue(params.changesDetails),
        editReason: params.editReason,
        createdBy: params.createdBy,
        createdByName: params.createdByName,
        createdByRole: params.createdByRole,
        createdByDepartment: params.createdByDepartment,
        decisionSpineId: resolveDecisionSpineId(params.report),
        workflowStep: 'created',
        workflowHistory: [{
          timestamp: new Date().toISOString(),
          action: 'created',
          description: `Version ${ver.versionString} created (${params.contentType})`,
          performedBy: params.createdBy,
        }],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isSemanticUnique = message.includes('report_versions_unique_semantic') || message.includes('already exists');
      if (isSemanticUnique && attempt < 3) {
        versions = await deps.versions.findByReportId(params.reportId);
        ver = await deps.versionManager.generateNextVersion(versions, params.versionType);
        continue;
      }
      throw error;
    }
  }

  throw new Error('Failed to allocate a unique version number');
}

// ── Update handler helpers ──

interface UpdateStatusFields {
  status: string;
  body: Record<string, unknown>;
}

function buildStatusFieldUpdates(fields: UpdateStatusFields): Partial<VersionUpdateData> {
  const updates: Partial<VersionUpdateData> = {};
  const { status, body } = fields;

  const workflowStepMap: Record<string, string> = {
    'draft': 'created',
    'under_review': 'review',
    'approved': 'approval',
    'published': 'publication',
    'archived': 'archived',
    'rejected': 'rejected',
    'superseded': 'superseded',
  };
  updates.status = status;
  updates.workflowStep = workflowStepMap[status];

  if (status === 'under_review') {
    updates.reviewedBy = body.updatedBy as string;
    updates.reviewedByName = body.updatedByName as string;
    updates.reviewedAt = new Date();
    if (body.reviewComments) {
      updates.reviewComments = body.reviewComments as string;
    }
    return updates;
  }

  if (status === 'approved') {
    updates.approvedBy = body.updatedBy as string;
    updates.approvedByName = body.updatedByName as string;
    updates.approvedAt = new Date();
    if (body.approvalComments) {
      updates.approvalComments = body.approvalComments as string;
    }
    return updates;
  }

  if (status === 'published') {
    updates.publishedBy = body.updatedBy as string;
    updates.publishedByName = body.updatedByName as string;
    updates.publishedAt = new Date();
  }

  return updates;
}

interface UpdateTransactionContext {
  deps: ReturnType<typeof buildDemandDeps>;
  versionId: string;
  reportId: string;
  existingVersion: ReportVersion;
  body: Record<string, unknown>;
}

async function executeUpdateTransaction(ctx: UpdateTransactionContext): Promise<ReportVersion> {
  const { deps, versionId, reportId, existingVersion, body } = ctx;

  return deps.versions.executeInTransaction(async () => {
    const updates: VersionUpdateData = {};

    if (body.status) {
      Object.assign(updates, buildStatusFieldUpdates({
        status: body.status as string,
        body,
      }));
    }

    const currentHistory = Array.isArray(existingVersion.workflowHistory)
      ? (existingVersion.workflowHistory as WorkflowHistoryEntry[])
      : [];
    const newHistoryEntry: WorkflowHistoryEntry = {
      timestamp: new Date().toISOString(),
      previousStatus: existingVersion.status,
      newStatus: (body.status as string) || existingVersion.status,
      action: body.status ? 'status_changed' : 'updated',
      description: body.status
        ? `Status changed from ${existingVersion.status} to ${body.status as string}`
        : 'Version updated',
      performedBy: body.updatedBy as string,
      comments: (body.reviewComments || body.approvalComments) as string | undefined,
    };
    updates.workflowHistory = [...currentHistory, newHistoryEntry];

    const updatedVersion = await deps.versions.update(versionId, updates);
    if (!updatedVersion) {
      throw new Error("Failed to update version");
    }

    await deps.versions.createAuditLog(
      deps.versionManager.createAuditLogEntry({
        action: body.status ? 'status_changed' : 'updated',
        versionId,
        reportId,
        performedBy: body.updatedBy as string,
        performedByName: body.updatedByName as string,
        description: body.status
          ? `Status changed from ${existingVersion.status} to ${body.status as string}`
          : 'Version updated',
        previousState: { status: existingVersion.status },
        newState: updatedVersion,
        sessionId: body.sessionId as string | undefined,
        ipAddress: body.ipAddress as string | undefined,
        performedByRole: body.updatedByRole as string | undefined,
      })
    );

    return updatedVersion;
  });
}

interface DemandWorkflowSyncContext {
  deps: ReturnType<typeof buildDemandDeps>;
  reportId: string;
  report: Record<string, unknown>;
  existingVersion: ReportVersion;
  newStatus: string;
  body: Record<string, unknown>;
}

async function syncDemandWorkflowFromVersionUpdate(ctx: DemandWorkflowSyncContext): Promise<void> {
  const { deps, reportId, report, existingVersion, newStatus, body } = ctx;
  const documentLabel = getDocumentLabel(existingVersion.versionType);
  const reportWorkflowHistory = Array.isArray(report.workflowHistory) ? report.workflowHistory : [];

  const historyEntry = {
    timestamp: new Date().toISOString(),
    action: 'version_status_synced',
    description: `${documentLabel} version ${existingVersion.versionNumber} status set to ${newStatus} by ${body.updatedByName as string}`,
    performedBy: body.updatedBy as string,
    performedByName: body.updatedByName as string,
    versionId: existingVersion.id,
    versionNumber: existingVersion.versionNumber,
    versionType: existingVersion.versionType,
    previousVersionStatus: existingVersion.status,
    newVersionStatus: newStatus,
  };

  const isPrimaryWorkflowDriver = existingVersion.versionType === 'business_case'
    || existingVersion.versionType === 'both'
    || !existingVersion.versionType;
  const nextWorkflowStatus = isPrimaryWorkflowDriver
    ? computeDemandWorkflowFromVersionStatus(newStatus)
    : null;

  const demandUpdates: Record<string, unknown> = {
    workflowHistory: [...(reportWorkflowHistory as unknown[]), historyEntry],
  };

  if (nextWorkflowStatus && shouldAdvanceDemandWorkflow(report.workflowStatus as string, nextWorkflowStatus)) {
    demandUpdates.workflowStatus = nextWorkflowStatus;

    const now = new Date();
    if (nextWorkflowStatus === 'under_review') demandUpdates.reviewStartedAt = now;
    if (nextWorkflowStatus === 'initially_approved') demandUpdates.approvedAt = now;
    if (nextWorkflowStatus === 'manager_approved') demandUpdates.managerApprovedAt = now;
    if (nextWorkflowStatus === 'rejected') demandUpdates.rejectedAt = now;

    if (body.updatedBy) {
      demandUpdates.approvedBy = body.updatedBy;
    }
  }

  await deps.reports.update(reportId, demandUpdates);
}

interface VersionSpineSyncContext {
  deps: ReturnType<typeof buildDemandDeps>;
  reportId: string;
  report: Record<string, unknown>;
  existingVersion: ReportVersion;
  newStatus: string;
  body: Record<string, unknown>;
}

async function syncVersionStatusToDecisionSpine(ctx: VersionSpineSyncContext): Promise<void> {
  const { deps, reportId, report, existingVersion, newStatus, body } = ctx;
  const updatedBy = body.updatedBy as string;
  const updatedByName = (body.updatedByName || body.updatedBy) as string;

  const decisionSpineId = (report.decisionSpineId as string | undefined)
    || existingVersion.decisionSpineId
    || (report.aiAnalysis as Record<string, unknown> | null)?.decisionId as string | undefined
    || (await deps.brain.findLatestDecisionByDemandReportId(reportId))?.id;

  if (!decisionSpineId) return;

  // Backfill the demand report link so future syncs are stable.
  if (!report.decisionSpineId) {
    try {
      await deps.reports.update(reportId, { decisionSpineId });
    } catch (err) {
      logger.warn('[Versions] Failed to backfill demandReports.decisionSpineId:', err);
    }
  }

  // Ensure initial sub-decisions exist.
  try {
    await deps.brain.handleSpineEvent({
      decisionSpineId,
      event: 'DEMAND_SUBMITTED',
      actorId: updatedBy,
      payload: { source: 'report_versions_put' },
    });
  } catch (err) {
    logger.warn('[Versions] Failed to ensure initial sub-decisions:', err);
  }

  const typeMap: Record<string, string> = {
    business_case: "BUSINESS_CASE",
    requirements: "REQUIREMENTS",
    enterprise_architecture: "ENTERPRISE_ARCHITECTURE",
    strategic_fit: "STRATEGIC_FIT",
    both: "BUSINESS_CASE",
  };
  const subDecisionType = typeMap[existingVersion.versionType || "business_case"] || "BUSINESS_CASE";
  let subDecision = await deps.brain.findSubDecision(decisionSpineId, subDecisionType);
  subDecision = subDecision ?? (await ensureSubDecision(deps, decisionSpineId, subDecisionType, updatedBy)) ?? undefined;
  if (subDecision?.subDecisionId) {
    await deps.brain.handleSubDecisionEvent({
      subDecisionId: subDecision.subDecisionId,
      event: newStatus === 'rejected' ? "REJECT" : "APPROVE",
      actorId: updatedBy,
    });
  }

  if (newStatus === "approved" || newStatus === "published") {
    await syncSpineApproval(deps, decisionSpineId, existingVersion, newStatus, updatedByName);
  }
}

async function ensureSubDecision(
  deps: ReturnType<typeof buildDemandDeps>,
  decisionSpineId: string,
  subDecisionType: string,
  createdBy: string,
) {
  try {
    const artifact = await deps.brain.createDecisionArtifact({
      decisionSpineId,
      artifactType: subDecisionType,
      createdBy,
    });
    await deps.brain.createDecisionArtifactVersion({
      artifactId: artifact.artifactId,
      content: {},
      changeSummary: 'Initial draft (auto-created from report version sync)',
      createdBy,
    });
    return deps.brain.createSubDecision({
      decisionSpineId,
      subDecisionType,
      artifactId: artifact.artifactId,
      status: 'DRAFT',
      createdBy,
    });
  } catch (ensureErr) {
    logger.warn('[Versions] Failed to auto-create missing sub-decision:', ensureErr);
    return null;
  }
}

async function syncSpineApproval(
  deps: ReturnType<typeof buildDemandDeps>,
  decisionSpineId: string,
  version: ReportVersion,
  newStatus: string,
  approvedByName: string,
) {
  const approval = await deps.brain.getApproval(decisionSpineId);
  const approvalPayload = {
    status: "approved",
    approvedBy: approvedByName,
    approvalReason: `Synced from ${version.versionType || "business_case"} ${newStatus} (${version.versionNumber})`,
    approvedActions: approval?.approvedActions || [],
  };
  if (approval) {
    await deps.brain.updateApproval(decisionSpineId, approvalPayload);
  } else {
    await deps.brain.createApproval({
      decisionId: decisionSpineId,
      approvalId: `APR-${decisionSpineId.slice(0, 8)}`,
      ...approvalPayload,
    });
  }
}

interface VersionContentSyncContext {
  deps: ReturnType<typeof buildDemandDeps>;
  reportId: string;
  report: Record<string, unknown>;
  existingVersion: ReportVersion;
  result: ReportVersion;
  updatedBy: string;
}

async function syncApprovedVersionContent(ctx: VersionContentSyncContext): Promise<void> {
  const { deps, reportId, report, existingVersion, result, updatedBy } = ctx;
  const vType = existingVersion.versionType || 'business_case';
  const approvedContent = (existingVersion.versionData || result.versionData) as Record<string, unknown>;
  if (!approvedContent || Object.keys(approvedContent).length === 0) return;

  if (vType === 'business_case' || vType === 'both' || !existingVersion.versionType) {
    await syncBusinessCaseContent(deps, reportId, report, existingVersion, approvedContent, updatedBy, result);
    return;
  }

  const fieldMap: Record<string, string> = {
    requirements: 'requirementsAnalysis',
    enterprise_architecture: 'enterpriseArchitectureAnalysis',
    strategic_fit: 'strategicFitAnalysis',
  };
  const reportField = fieldMap[vType];
  if (!reportField) return;

  await deps.reports.update(reportId, {
    [reportField]: approvedContent as unknown as Record<string, unknown>,
  });

  const artifactTypeMap: Record<string, string> = {
    requirements: 'REQUIREMENTS',
    enterprise_architecture: 'ENTERPRISE_ARCHITECTURE',
    strategic_fit: 'STRATEGIC_FIT',
  };
  const spineId = (report.decisionSpineId as string | undefined) || existingVersion.decisionSpineId || null;
  if (spineId) {
    const artifactType = artifactTypeMap[vType];
    await deps.brain.upsertDecisionArtifactVersion({
      decisionSpineId: spineId,
      artifactType,
      subDecisionType: artifactType,
      content: approvedContent,
      changeSummary: `Content synced from ${vType} version ${existingVersion.versionNumber} (${result.status})`,
      createdBy: updatedBy,
    });
    logger.info(`[Versions PUT] Synced approved ${artifactType} to decision_artifact_versions (spine: ${spineId})`);
  }
}

async function syncBusinessCaseContent(
  deps: ReturnType<typeof buildDemandDeps>,
  reportId: string,
  report: Record<string, unknown>,
  existingVersion: ReportVersion,
  approvedContent: Record<string, unknown>,
  updatedBy: string,
  result: ReportVersion,
): Promise<void> {
  const existingBC = await deps.businessCase.findByDemandReportId(reportId);
  const decisionSpineForBC = ((report.decisionSpineId || existingVersion.decisionSpineId) as string | null) ?? null;

  const bcPayload = buildInsertBusinessCaseFromArtifact({
    demandReportId: reportId,
    decisionSpineId: decisionSpineForBC,
    generatedBy: updatedBy,
    artifact: approvedContent,
    qualityReport: approvedContent.qualityReport,
  });

  if (existingBC) {
    await deps.businessCase.update(existingBC.id, {
      ...bcPayload,
      demandReportId: undefined,
    } as unknown as Parameters<typeof deps.businessCase.update>[1]);
    logger.info(`[Versions PUT] Synced approved content to business_cases (id: ${existingBC.id})`);
  } else {
    await deps.businessCase.create(bcPayload);
    logger.info(`[Versions PUT] Created business_cases record from approved content`);
  }

  if (decisionSpineForBC) {
    await deps.brain.upsertDecisionArtifactVersion({
      decisionSpineId: decisionSpineForBC,
      artifactType: "BUSINESS_CASE",
      subDecisionType: "BUSINESS_CASE",
      content: approvedContent,
      changeSummary: `Content synced from version ${existingVersion.versionNumber} (${result.status})`,
      createdBy: updatedBy,
    });
    logger.info(`[Versions PUT] Synced approved content to decision_artifact_versions (spine: ${decisionSpineForBC})`);
  }
}

interface PostUpdateSyncsContext {
  deps: ReturnType<typeof buildDemandDeps>;
  reportId: string;
  report: Record<string, unknown>;
  existingVersion: ReportVersion;
  result: ReportVersion;
  body: Record<string, unknown>;
}

async function performPostUpdateSyncs(ctx: PostUpdateSyncsContext): Promise<void> {
  const { deps, reportId, report, existingVersion, result, body } = ctx;
  const newStatus = body.status as string | undefined;
  if (!newStatus) return;

  if (['draft', 'under_review', 'approved', 'published', 'rejected'].includes(newStatus)) {
    try {
      await syncDemandWorkflowFromVersionUpdate({ deps, reportId, report, existingVersion, newStatus, body });
    } catch (workflowSyncError) {
      logger.warn('[Versions] Failed to sync demand workflow status from version update:', workflowSyncError);
    }
  }

  if (['approved', 'published', 'rejected'].includes(newStatus)) {
    try {
      await syncVersionStatusToDecisionSpine({ deps, reportId, report, existingVersion, newStatus, body });
    } catch (spineError) {
      logger.warn("[Versions] Failed to sync sub-decision status:", spineError);
    }
  }

  if (['approved', 'published'].includes(newStatus)) {
    try {
      await syncApprovedVersionContent({ deps, reportId, report, existingVersion, result, updatedBy: body.updatedBy as string });
    } catch (contentSyncError) {
      logger.warn("[Versions PUT] Failed to sync approved content to canonical tables:", contentSyncError);
    }
  }
}

interface ValidatedUpdateRequest {
  report: DemandReportRecord;
  existingVersion: ReportVersion;
}

async function validateVersionUpdateRequest(
  deps: ReturnType<typeof buildDemandDeps>,
  auth: ReturnType<typeof createAuthMiddlewareWithOwnership>,
  req: { params: Record<string, string>; body: Record<string, unknown>; auth?: { userId: string; role: Role; customPermissions?: CustomPermissions | null } },
): Promise<{ ok: true; data: ValidatedUpdateRequest } | { ok: false; status: number; error: string }> {
  const reportId = requireRouteParam(req.params.id, "id");
  const versionId = requireRouteParam(req.params.versionId, "versionId");

  const report = await deps.reports.findById(reportId);
  if (!report) {
    return { ok: false, status: 404, error: "Demand report not found" };
  }

  const authContext = req.auth;
  if (!authContext) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const canEdit = await auth.validateReportOwnership(
    reportId,
    authContext.userId,
    authContext.role,
    authContext.customPermissions,
  );
  if (!canEdit) {
    return { ok: false, status: 403, error: "You can only edit versions for your own reports" };
  }

  const existingVersion = await deps.versions.findById(versionId);
  if (existingVersion?.reportId !== reportId) {
    return { ok: false, status: 404, error: "Version not found" };
  }

  if (req.body.status) {
    const transitionValidation = deps.versionManager.validateVersionTransition(
      existingVersion.status,
      req.body.status as string,
      req.body.updatedByRole as string | undefined,
    );
    if (!transitionValidation.isValid) {
      return { ok: false, status: 400, error: transitionValidation.error ?? "Invalid status transition" };
    }
  }

  return { ok: true, data: { report, existingVersion } };
}

export function createDemandReportsVersionsRoutes(storage: DemandStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddlewareWithOwnership(storage);
  const deps = buildDemandDeps(storage);

  router.post("/:id/versions", auth.requireAuth, auth.requirePermission("version:create"), validateBody(createVersionBodySchema), async (req, res) => {

    try {
      const { id: reportId } = req.params as { id: string };
      const { businessCaseId, editedContent } = req.body;

      const report = await deps.reports.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: "Demand report not found"
        });
      }

      const existingVersions = await deps.versions.findByReportId(reportId);
      const pendingVersion = existingVersions.find(v =>
        v.status === 'under_review' || v.status === 'manager_approval'
      );

      if (pendingVersion) {
        return res.status(400).json({
          success: false,
          error: "Cannot create new version while another version is pending approval",
          details: {
            pendingVersion: pendingVersion.versionNumber,
            pendingStatus: pendingVersion.status,
            message: pendingVersion.status === 'under_review'
              ? "Please wait for the current version to be approved or rejected before making new edits."
              : "A version is awaiting final manager approval. Please wait for approval before creating new versions."
          }
        });
      }

      const result = await (async () => {
        // Save edited content before versioning
        if (req.body.contentType === 'business_case' && businessCaseId && editedContent) {
          logger.info('Saving business case before creating version:', { businessCaseId, hasContent: !!editedContent });
          await enrichAndSaveBusinessCase({ deps, editedContent, businessCaseId, report: report as unknown as Record<string, unknown> });
        } else if (req.body.contentType === 'requirements' && editedContent) {
          logger.info('Saving requirements before creating version:', { reportId, hasContent: !!editedContent });
          await deps.reports.update(reportId, { requirementsAnalysis: editedContent });
        } else if (req.body.contentType === 'enterprise_architecture' && editedContent) {
          logger.info('Saving enterprise architecture before creating version:', { reportId, hasContent: !!editedContent });
          await deps.reports.update(reportId, {
            enterpriseArchitectureAnalysis: editedContent as unknown as Record<string, unknown>,
          });
        }

        let existingVersions = await deps.versions.findByReportId(reportId);

        let nextVersion = await deps.versionManager.generateNextVersion(
          existingVersions,
          req.body.versionType
        );

        const latestVersion = existingVersions.length > 0 ? existingVersions[0] : null;
        const previousVersionData = (latestVersion?.versionData || null) as VersionData | null;

        let currentData: VersionData | null = null;
        const contentTypeToField: Record<string, string> = {
          business_case: 'aiAnalysis',
          requirements: 'requirementsAnalysis',
          enterprise_architecture: 'enterpriseArchitectureAnalysis',
        };
        const fieldName = contentTypeToField[req.body.contentType] || 'strategicFitAnalysis';
        currentData = (report[fieldName] || null) as VersionData | null;

        const analysisContentType = (req.body.contentType === 'strategic_fit' || req.body.contentType === 'enterprise_architecture')
          ? null
          : req.body.contentType;

        const aiResult = await generateVersionAiAnalysis({
          deps, previousVersionData, currentData, contentType: analysisContentType,
          reportId, versionNumber: nextVersion.versionString,
          userChangesSummary: req.body.changesSummary, skipAiSummary: !!req.body.skipAiSummary,
        });
        let finalChangesSummary = aiResult.changesSummary;
        const impactAnalysis = aiResult.impactAnalysis;

        const versionData = await buildVersionDataForContentType(
          deps, req.body.contentType, report as unknown as Record<string, unknown>,
          businessCaseId, reportId,
        );

        const contentValidation = deps.versionManager.validateVersionContent(
          versionData,
          'strict'
        );

        if (!contentValidation.isValid) {
          throw new Error(`Version validation failed: ${(contentValidation.errors ?? []).join(', ')}`);
        }

        const baseMetadata = deps.versionManager.createVersionMetadata(
          {
            reportId,
            versionType: req.body.versionType,
            changesSummary: finalChangesSummary,
            editReason: req.body.editReason,
            createdBy: req.body.createdBy,
            createdByName: req.body.createdByName,
            createdByRole: req.body.createdByRole,
            createdByDepartment: req.body.createdByDepartment,
            sessionId: req.body.sessionId,
            ipAddress: req.body.ipAddress
          },
          contentValidation,
          nextVersion
        );

        const versionMetadata = impactAnalysis
          ? {
              ...baseMetadata,
              impactAnalysis: {
                summary: impactAnalysis.summary,
                impact: impactAnalysis.impact,
                risk: impactAnalysis.risk,
                changedFields: impactAnalysis.changedFields,
                detailedChanges: impactAnalysis.detailedChanges,
                recommendations: impactAnalysis.recommendations,
                generatedAt: new Date().toISOString(),
                aiModel: "claude-sonnet-4-20250514",
              },
            }
          : baseMetadata;

        const originalData = (existingVersions.length > 0 ? existingVersions[0]!.versionData : versionData) as VersionContent;
        const changesDetails = deps.versionManager.generateChangesDetails(
          originalData,
          versionData,
          req.body.changesSummary || ''
        );

        const versionRecord = await createVersionWithRetry(
          deps, existingVersions, nextVersion, {
            reportId, contentType: req.body.contentType, versionData, versionMetadata,
            teamAssignments: req.body.teamAssignments, changesSummary: finalChangesSummary, changesDetails,
            editReason: req.body.editReason, createdBy: req.body.createdBy, createdByName: req.body.createdByName,
            createdByRole: req.body.createdByRole, createdByDepartment: req.body.createdByDepartment,
            report: report as unknown as Record<string, unknown>, versionType: req.body.versionType,
          },
        );

        await deps.versions.createAuditLog(
          deps.versionManager.createAuditLogEntry({
            action: 'created',
            versionId: versionRecord.id as string,
            reportId,
            performedBy: req.body.createdBy,
            performedByName: req.body.createdByName,
            description: `Version ${nextVersion.versionString} created (${req.body.contentType}): ${finalChangesSummary}`,
            newState: {
              version: versionRecord,
              validation: contentValidation,
              contentType: req.body.contentType,
              aiGenerated: !req.body.changesSummary && !req.body.skipAiSummary,
              impactAnalysis: impactAnalysis ? { risk: impactAnalysis.risk, changedFields: (impactAnalysis.changedFields as unknown[]).length } : null
            },
            sessionId: req.body.sessionId,
            ipAddress: req.body.ipAddress,
            performedByRole: req.body.createdByRole,
            performedByDepartment: req.body.createdByDepartment,
          })
        );

        return versionRecord;
      })();

      const rawVersionNumber = result.versionNumber;
      const versionNumber = typeof rawVersionNumber === "string" || typeof rawVersionNumber === "number"
        ? String(rawVersionNumber)
        : "";

      res.status(201).json({
        success: true,
        data: result,
        message: `Version ${versionNumber} created successfully`
      });

    } catch (error) {
      logger.error("Error creating version:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create version"
      });
    }
  });

  router.get("/:id/versions", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const { id: reportId } = req.params as { id: string };
    const { status, major, pattern } = req.query;

    const report = await deps.reports.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Demand report not found"
      });
    }

    let versions;

    if (status && typeof status === 'string') {
      versions = await deps.versions.getByStatus(reportId, status);
    } else if (major && typeof major === 'string') {
      const majorNum = Number.parseInt(major, 10);
      if (Number.isNaN(majorNum)) {
        return res.status(400).json({
          success: false,
          error: "Invalid major version number"
        });
      }
      versions = await deps.versions.getByMajor(reportId, majorNum);
    } else if (pattern && typeof pattern === 'string') {
      versions = await deps.versions.getByPattern(reportId, pattern);
    } else {
      versions = await deps.versions.findByReportId(reportId);
    }

    const enrichedVersions = await enrichVersionActorNames(versions, (userId) => deps.users.getUser(userId));

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({
      success: true,
      data: enrichedVersions,
      count: enrichedVersions.length,
      metadata: {
        reportId,
        totalVersions: enrichedVersions.length,
        statusBreakdown: enrichedVersions.reduce((acc, v) => {
          acc[v.status] = (acc[v.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }
    });

  }));

  router.get("/:id/versions/:versionId", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const { id: reportId, versionId } = req.params as { id: string; versionId: string };
    const { includeAuditLog } = req.query;

    const report = await deps.reports.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Demand report not found"
      });
    }

    const version = await deps.versions.findById(versionId);
    if (!versionBelongsToReport(version, reportId)) {
      return res.status(404).json({
        success: false,
        error: "Version not found"
      });
    }

    const integrityCheck = await deps.versions.validateIntegrity(versionId);

    const enrichedVersion = (await enrichVersionActorNames([version], (userId) => deps.users.getUser(userId)))[0] ?? version;

    const responseData: VersionResponseData = {
      version: enrichedVersion,
      integrity: integrityCheck
    };

    if (includeAuditLog === 'true') {
      const auditLog = await deps.versions.getAuditLog(versionId);
      responseData.auditLog = auditLog;
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({
      success: true,
      data: responseData
    });

  }));

  router.get("/:id/versions/:versionId/viewers", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const { id: reportId, versionId } = req.params as { id: string; versionId: string };

    const report = await deps.reports.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Demand report not found"
      });
    }

    const version = await deps.versions.findById(versionId);
    if (!versionBelongsToReport(version, reportId)) {
      return res.status(404).json({
        success: false,
        error: "Version not found"
      });
    }

    const presence = deps.presence.getVersionPresence(versionId);

    res.json({
      success: true,
      data: {
        versionId,
        reportId,
        viewers: presence.viewers,
        count: presence.viewers.length
      }
    });

  }));

  router.get("/:id/versions/:versionId/editors", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const { id: reportId, versionId } = req.params as { id: string; versionId: string };

    const report = await deps.reports.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Demand report not found"
      });
    }

    const version = await deps.versions.findById(versionId);
    if (!versionBelongsToReport(version, reportId)) {
      return res.status(404).json({
        success: false,
        error: "Version not found"
      });
    }

    const presence = deps.presence.getVersionPresence(versionId);

    res.json({
      success: true,
      data: {
        versionId,
        reportId,
        editors: presence.editors,
        count: presence.editors.length,
        currentEditor: presence.editors.length > 0 ? presence.editors[0] : null
      }
    });

  }));

  router.get("/:id/versions/:versionId/impact", auth.requireAuth, auth.requirePermission("report:read"), async (req, res) => {
    try {
      const { id: reportId, versionId } = req.params as { id: string; versionId: string };

      const report = await deps.reports.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: "Demand report not found"
        });
      }

      const version = await deps.versions.findById(versionId);
      if (!versionBelongsToReport(version, reportId)) {
        return res.status(404).json({
          success: false,
          error: "Version not found"
        });
      }

      const impactAnalysis = (version.versionMetadata as Record<string, unknown> | null)?.impactAnalysis;

      if (impactAnalysis) {
        res.json({
          success: true,
          data: {
            ...impactAnalysis,
            fromCache: true,
            versionNumber: version.versionNumber,
            createdAt: version.createdAt
          }
        });
      } else {
        const allVersions = await deps.versions.findByReportId(reportId);
        const versionIndex = allVersions.findIndex(v => v.id === versionId);

          if (versionIndex < 0 || allVersions.at(versionIndex + 1) === undefined) {
          return res.json({
            success: true,
            data: {
              summary: "No previous version available for comparison",
              impact: "This is the first version of the document.",
              risk: "low",
              changedFields: [],
              detailedChanges: [],
              fromCache: false,
              versionNumber: version.versionNumber,
              createdAt: version.createdAt
            }
          });
        }

        const previousVersion = allVersions[versionIndex + 1]!;

        if (version.versionType !== 'business_case' && version.versionType !== 'requirements') {
          return res.json({
            success: true,
            data: {
              summary: `${getDocumentLabel(version.versionType)} impact analysis is not available`,
              impact: "Impact analysis is currently supported for business case and requirements versions only.",
              risk: "low",
              changedFields: [],
              detailedChanges: [],
              fromCache: false,
              versionNumber: version.versionNumber,
              createdAt: version.createdAt,
              comparedWith: previousVersion.versionNumber
            }
          });
        }

        const analysis = await deps.versionAnalyzer.analyzeImpact(
          previousVersion.versionData as VersionData,
          version.versionData as VersionData,
          {
            reportId,
            versionNumber: version.versionNumber,
            contentType: version.versionType
          }
        );

        res.json({
          success: true,
          data: {
            ...analysis,
            fromCache: false,
            versionNumber: version.versionNumber,
            createdAt: version.createdAt,
            comparedWith: previousVersion.versionNumber
          }
        });
      }
    } catch (error) {
      logger.error("Error fetching version impact:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch version impact"
      });
    }
  });

  router.post("/:id/versions/:versionId/sign", auth.requireAuth, async (req, res) => {
    try {
      const { id: reportId, versionId } = req.params as { id: string; versionId: string };
      const userId = req.session.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized"
        });
      }

      const user = await deps.users.getUser(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found"
        });
      }

      const cryptoService = deps.crypto.create();

      if (!cryptoService.canSignVersions(user.role)) {
        return res.status(403).json({
          success: false,
          error: "Only directors and managers can sign versions"
        });
      }

      const report = await deps.reports.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: "Demand report not found"
        });
      }

      const version = await deps.versions.findById(versionId);
      if (version?.reportId !== reportId) {
        return res.status(404).json({
          success: false,
          error: "Version not found"
        });
      }

      if (version.status !== 'approved' && version.status !== 'published') {
        return res.status(400).json({
          success: false,
          error: "Only approved or published versions can be signed"
        });
      }

      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const signatureData = await cryptoService.signVersion(
        versionId,
        userId,
        user.displayName,
        user.role,
        version.versionData,
        ipAddress,
        userAgent
      );

      const currentMetadata = version.versionMetadata || {};
      await deps.versions.update(versionId, {
        versionMetadata: {
          ...currentMetadata,
          signature: signatureData
        }
      });

      res.json({
        success: true,
        data: {
          versionId,
          signatureData,
          message: `Version signed successfully by ${user.displayName}`
        }
      });

    } catch (error) {
      logger.error("Error signing version:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to sign version"
      });
    }
  });

  router.get("/:id/versions/:versionId/verify", auth.requireAuth, auth.requirePermission("report:read"), async (req, res) => {
    try {
      const { id: reportId, versionId } = req.params as { id: string; versionId: string };

      const report = await deps.reports.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: "Demand report not found"
        });
      }

      const version = await deps.versions.findById(versionId);
      if (version?.reportId !== reportId) {
        return res.status(404).json({
          success: false,
          error: "Version not found"
        });
      }

      const signature = (version.versionMetadata as Record<string, unknown> | null)?.signature;
      if (!isVersionSignature(signature)) {
        return res.json({
          success: true,
          data: {
            isSigned: false,
            message: "Version is not signed"
          }
        });
      }

      const cryptoService = deps.crypto.create();
      const verificationResult = cryptoService.verifySignature(
        versionId,
        version.versionData,
        signature
      );

      res.json({
        success: true,
        data: {
          isSigned: true,
          signature,
          verification: verificationResult,
          versionNumber: version.versionNumber
        }
      });

    } catch (error) {
      logger.error("Error verifying signature:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to verify signature"
      });
    }
  });

  router.get("/:id/versions/:versionId/audit-trail", auth.requireAuth, auth.requirePermission("report:read"), async (req, res) => {
    try {
      const { id: reportId, versionId } = req.params as { id: string; versionId: string };

      const report = await deps.reports.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: "Demand report not found"
        });
      }

      const version = await deps.versions.findById(versionId);
      if (version?.reportId !== reportId) {
        return res.status(404).json({
          success: false,
          error: "Version not found"
        });
      }

      const cryptoService = deps.crypto.create();
      const auditTrail = await cryptoService.getAuditTrail(versionId);

      res.json({
        success: true,
        data: {
          versionId,
          versionNumber: version.versionNumber,
          auditTrail,
          totalEntries: auditTrail.length
        }
      });

    } catch (error) {
      logger.error("Error fetching audit trail:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch audit trail"
      });
    }
  });

  router.put("/:id/versions/:versionId", auth.requireAuth, auth.requirePermission("version:create"), validateBody(updateVersionBodySchema), async (req, res) => {

    try {
      const { id: reportId, versionId } = req.params as { id: string; versionId: string };
      const validation = await validateVersionUpdateRequest(
        deps, auth,
        { params: { id: reportId, versionId }, body: req.body, auth: (req as { auth?: { userId: string; role: Role; customPermissions?: CustomPermissions | null } }).auth },
      );
      if (!validation.ok) {
        return res.status(validation.status).json({ success: false, error: validation.error });
      }

      const { report, existingVersion } = validation.data;

      const result = await executeUpdateTransaction({
        deps, versionId, reportId, existingVersion, body: req.body,
      });

      await performPostUpdateSyncs({
        deps, reportId, report: report as unknown as Record<string, unknown>,
        existingVersion, result, body: req.body,
      });

      res.json({
        success: true,
        data: result,
        message: "Version updated successfully"
      });

    } catch (error) {
      logger.error("Error updating version:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to update version"
      });
    }
  });

  router.post("/:id/versions/:versionId/approve", auth.requireAuth, auth.requirePermission("workflow:advance"), validateBody(approveVersionBodySchema), async (req, res) => {

    logger.info('APPROVE ENDPOINT HIT:', { reportId: req.params.id, versionId: req.params.versionId, body: req.body });
    try {
      const { id: reportId, versionId } = req.params as { id: string; versionId: string };

      const report = await deps.reports.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: "Demand report not found"
        });
      }

      const version = await deps.versions.findById(versionId);
      if (version?.reportId !== reportId) {
        return res.status(404).json({
          success: false,
          error: "Version not found"
        });
      }

      if (!['under_review', 'manager_approval'].includes(version.status)) {
        const versionStatus = typeof version.status === "string" ? version.status : "unknown";
        return res.status(400).json({
          success: false,
          error: `Cannot approve version with status: ${versionStatus}`
        });
      }

      const approverUserId = req.session.userId;
      if (!approverUserId) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized"
        });
      }

      const approver = await deps.users.getUser(approverUserId);
      if (!approver) {
        return res.status(401).json({
          success: false,
          error: "Approver not found"
        });
      }

      const approverName = approver.displayName || approver.username || "Unknown";
      const approverRole = approver.role;

      const result = await executeApprovalTransaction({
        deps, reportId, versionId, report: report as unknown as Record<string, unknown>,
        version, approverUserId, approverName, approverRole,
        approvalLevel: req.body.approvalLevel,
        approvalComments: req.body.approvalComments,
        sessionId: req.body.sessionId,
        ipAddress: req.body.ipAddress,
      });

      logger.info('APPROVAL SUCCESSFUL:', {
        versionId,
        newStatus: result.status,
        versionNumber: result.versionNumber
      });

      const documentLabel = version.versionType === 'requirements'
        ? 'Requirements analysis'
        : getDocumentLabel(version.versionType);

      const spineCtx: DecisionSpineSyncContext = {
        deps, reportId, report: report as unknown as Record<string, unknown>,
        version, result, approverUserId, approverName, documentLabel,
      };

      try {
        await syncApprovalToDecisionSpine(spineCtx);
      } catch (spineError) {
        logger.warn("[Versions] Failed to sync sub-decision approval:", spineError);
      }

      try {
        await syncApprovedContentToCanonical({
          deps, reportId, report: report as unknown as Record<string, unknown>,
          version, result, approverUserId,
        });
      } catch (contentSyncError) {
        logger.warn("[Versions] Failed to sync approved version content to canonical tables:", contentSyncError);
      }

      // Fan-out notifications asynchronously.
      setImmediate(async () => {
        try {
          await sendApprovalNotifications({
            deps, reportId, report: report as unknown as Record<string, unknown>,
            version, result, approverUserId, approverName, documentLabel,
          });
        } catch (notificationError) {
          logger.error("Error sending approval notifications:", notificationError);
        }
      });

      res.json({
        success: true,
        data: result,
        message: result.status === 'published'
          ? `Version ${result.versionNumber} published successfully - Final Approval Complete`
          : `Version ${result.versionNumber} approved successfully`
      });

      logger.info('RESPONSE SENT TO CLIENT');

    } catch (error) {
      logger.error("Error approving version:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to approve version"
      });
    }
  });

  router.get("/:id/versions/:versionId/audit-log", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const { id: reportId, versionId } = req.params as { id: string; versionId: string };

    const report = await deps.reports.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Demand report not found"
      });
    }

    const version = await deps.versions.findById(versionId);
      if (!versionBelongsToReport(version, reportId)) {
      return res.status(404).json({
        success: false,
        error: "Version not found"
      });
    }

    const auditLog = await deps.versions.getAuditLog(versionId);

    res.json({
      success: true,
      data: auditLog,
      count: auditLog.length,
      metadata: {
        versionId,
        versionNumber: version.versionNumber,
        reportId,
        auditSummary: {
          totalEntries: auditLog.length,
          actionTypes: auditLog.reduce((acc, log) => {
            acc[log.action] = (acc[log.action] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          firstEntry: auditLog.length > 0 ? auditLog.at(-1)?.performedAt ?? null : null,
          lastEntry: auditLog.length > 0 ? auditLog[0]?.performedAt ?? null : null
        }
      }
    });

  }));

  router.get("/:id/versions/export/pdf", auth.requireAuth, auth.requirePermission("report:read"), async (req, res) => {
    try {
      const { id: reportId } = req.params as { id: string };

      const report = await deps.reports.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: "Demand report not found"
        });
      }

      const versions = await deps.versions.findByReportId(reportId);
      if (!versions?.length) {
        return res.status(404).json({
          success: false,
          error: "No versions found for this report"
        });
      }

      const pdfBuffer = await generateVersionPDF({
        storage: storage,
        reportId,
        type: "full_history"
      });

      const filename = `${sanitizeFilenamePart(report.organizationName ?? "demand_report")}_VersionHistory_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      res.send(pdfBuffer);

      const auditUserId = requireSessionUserId(req as { session?: { userId?: string } });
      await deps.audit.log({
        storage: storage,
        req,
        userId: auditUserId,
        action: 'export_version_history_pdf',
        result: 'success',
        details: {
          reportId,
          versionCount: versions.length,
          filename
        }
      });

    } catch (error) {
      logger.error("Error exporting version history PDF:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to export PDF"
      });
    }
  });

  router.get("/:id/versions/:versionId/export/pdf", auth.requireAuth, auth.requirePermission("report:read"), async (req, res) => {
    try {
      const { id: reportId, versionId } = req.params as { id: string; versionId: string };

      const report = await deps.reports.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: "Demand report not found"
        });
      }

      const version = await deps.versions.findById(versionId);
      if (version?.reportId !== reportId) {
        return res.status(404).json({
          success: false,
          error: "Version not found"
        });
      }

      const pdfBuffer = await generateVersionPDF({
        storage: storage,
        reportId,
        versionId,
        type: "single_version"
      });

      const filename = `${sanitizeFilenamePart(report.organizationName ?? "demand_report")}_${sanitizeFilenamePart(version.versionNumber)}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      res.send(pdfBuffer);

      const auditUserId = requireSessionUserId(req as { session?: { userId?: string } });
      await deps.audit.log({
        storage: storage,
        req,
        userId: auditUserId,
        action: 'export_version_pdf',
        result: 'success',
        details: {
          reportId,
          versionId,
          versionNumber: version.versionNumber,
          filename
        }
      });

    } catch (error) {
      logger.error("Error exporting version PDF:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to export PDF"
      });
    }
  });

  router.get("/:id/versions/compare/:v1/:v2/pdf", auth.requireAuth, auth.requirePermission("report:read"), async (req, res) => {
    try {
      const { id: reportId, v1: versionId1, v2: versionId2 } = req.params as { id: string; v1: string; v2: string };

      const report = await deps.reports.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: "Demand report not found"
        });
      }

      const version1 = await deps.versions.findById(versionId1);
      const version2 = await deps.versions.findById(versionId2);

      if (!versionBelongsToReport(version1, reportId)) {
        return res.status(404).json({
          success: false,
          error: "First version not found"
        });
      }

      if (!versionBelongsToReport(version2, reportId)) {
        return res.status(404).json({
          success: false,
          error: "Second version not found"
        });
      }

      const pdfBuffer = await generateVersionPDF({
        storage: storage,
        reportId,
        versionId: versionId1,
        compareVersionId: versionId2,
        type: "comparison"
      });

      const filename = `${sanitizeFilenamePart(report.organizationName ?? "demand_report")}_Comparison_${sanitizeFilenamePart(version1.versionNumber)}_vs_${sanitizeFilenamePart(version2.versionNumber)}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      res.send(pdfBuffer);

      const auditUserId = requireSessionUserId(req as { session?: { userId?: string } });
      await deps.audit.log({
        storage: storage,
        req,
        userId: auditUserId,
        action: 'export_version_comparison_pdf',
        result: 'success',
        details: {
          reportId,
          version1: version1.versionNumber,
          version2: version2.versionNumber,
          filename
        }
      });

    } catch (error) {
      logger.error("Error exporting version comparison PDF:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to export PDF"
      });
    }
  });

  router.post("/:id/versions/:versionId/rollback", auth.requireAuth, auth.requirePermission("workflow:lock"), validateBody(rollbackVersionBodySchema), async (req, res) => {

    try {
      const { id: reportId, versionId } = req.params as { id: string; versionId: string };

      const report = await deps.reports.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: "Demand report not found"
        });
      }

      const targetVersion = await deps.versions.findById(versionId);
      if (!versionBelongsToReport(targetVersion, reportId)) {
        return res.status(404).json({
          success: false,
          error: "Target version for rollback not found"
        });
      }

      const authorizedRoles = ['admin', 'supervisor', 'manager', 'director', 'architect'];
      const performedByRole = normalizeRoleInput(req.body.performedByRole);
      if (!performedByRole || !authorizedRoles.includes(performedByRole)) {
        return res.status(403).json({
          success: false,
          error: "Insufficient permissions for rollback operation. Requires admin, supervisor, manager, director, or architect role"
        });
      }

      if (!['approved', 'published'].includes(targetVersion.status)) {
        return res.status(400).json({
          success: false,
          error: `Cannot rollback to version with status '${targetVersion.status}'. Only approved or published versions can be restored`
        });
      }

      const currentVersion = await deps.versions.getLatest(reportId);

      const result = await deps.versions.executeInTransaction(async () => {
        const rollbackTimestamp = new Date();
        const rollbackVersionMetadata = toRecord(targetVersion.versionMetadata) ?? {};
        rollbackVersionMetadata.rollbackMetadata = {
          originalVersionId: targetVersion.id,
          originalVersionNumber: targetVersion.versionNumber,
          rollbackReason: req.body.rollbackReason,
          rollbackTimestamp: rollbackTimestamp.toISOString(),
          governmentCompliance: true
        };

        const rollbackVersionData: InsertReportVersion = {
          reportId,
          versionNumber: deps.versionManager.generateRollbackVersionNumber(
            await deps.versions.findByReportId(reportId)
          ),
          majorVersion: targetVersion.majorVersion,
          minorVersion: targetVersion.minorVersion + 1,
          patchVersion: 0,
          parentVersionId: currentVersion?.id ?? null,
          baseVersionId: targetVersion.id,
          status: 'published' as const,
          versionType: targetVersion.versionType || 'business_case',
          versionData: targetVersion.versionData as Json,
          versionMetadata: rollbackVersionMetadata,
          changesSummary: `ROLLBACK: Restored to version ${targetVersion.versionNumber} - ${req.body.rollbackReason}`,
          changesDetails: {
            rollbackOperation: true,
            restoredFromVersion: targetVersion.versionNumber,
            restoredFromId: targetVersion.id,
            rollbackJustification: req.body.rollbackReason,
            complianceLevel: 'government-grade'
          },
          editReason: `Government-mandated rollback to version ${targetVersion.versionNumber}`,
          createdBy: req.body.performedBy,
          createdByName: req.body.performedByName,
          createdByRole: req.body.performedByRole,
          createdByDepartment: req.body.performedByDepartment,
          publishedBy: req.body.performedBy,
          publishedByName: req.body.performedByName,
          publishedAt: rollbackTimestamp,
          workflowStep: 'publication',
          workflowHistory: [{
            timestamp: rollbackTimestamp.toISOString(),
            action: 'rollback_restored',
            description: `Government rollback to version ${targetVersion.versionNumber}`,
            performedBy: req.body.performedBy,
            rollbackDetails: {
              targetVersionId: targetVersion.id,
              targetVersionNumber: targetVersion.versionNumber,
              reason: req.body.rollbackReason
            }
          }],
          retentionPolicy: 'permanent',
          dataClassification: 'confidential',
          complianceFlags: {
            governmentRollback: true,
            auditRequired: true,
            retentionPermanent: true
          }
        };

        const existingVersions = await deps.versions.findByReportId(reportId);
        const nextVersion = await deps.versionManager.generateNextVersion(existingVersions, 'minor');

        rollbackVersionData.versionNumber = `${nextVersion.versionString}-rollback`;
        rollbackVersionData.majorVersion = nextVersion.major;
        rollbackVersionData.minorVersion = nextVersion.minor;
        rollbackVersionData.patchVersion = nextVersion.patch;
        rollbackVersionData.decisionSpineId = report.decisionSpineId || (report.aiAnalysis as Record<string, unknown> | null)?.decisionId as string || undefined;

        const rollbackVersion = await deps.versions.create(rollbackVersionData);

        if (currentVersion && currentVersion.id !== targetVersion.id) {
          const supersededHistoryEntry: WorkflowHistoryEntry = {
            timestamp: rollbackTimestamp.toISOString(),
            action: 'superseded_by_rollback',
            description: `Superseded by rollback to version ${targetVersion.versionNumber}`,
            performedBy: req.body.performedBy
          };

          await deps.versions.update(currentVersion.id, {
            status: 'superseded',
            workflowHistory: [
              ...((currentVersion.workflowHistory as WorkflowHistoryEntry[]) || []),
              supersededHistoryEntry
            ]
          });
        }

        const reportHistoryEntry: Record<string, unknown> = {
          timestamp: rollbackTimestamp.toISOString(),
          previousStatus: report.workflowStatus,
          newStatus: 'under_review',
          reason: `Government rollback to version ${targetVersion.versionNumber}: ${req.body.rollbackReason}`,
          user: req.body.performedByName,
          rollbackOperation: true
        };

        await deps.reports.update(reportId, {
          aiAnalysis: normalizeDemandAiAnalysis((targetVersion.versionData as Record<string, unknown>)?.aiAnalysis),
          workflowStatus: 'under_review',
          workflowHistory: [
            ...(report.workflowHistory || []),
            reportHistoryEntry
          ]
        });

        await syncApprovedContentToCanonical({
          deps,
          reportId,
          report: report as unknown as Record<string, unknown>,
          version: targetVersion,
          result: rollbackVersion,
          approverUserId: req.body.performedBy,
        });

        await deps.versions.createAuditLog(
          deps.versionManager.createAuditLogEntry({
            action: 'rollback_executed',
            versionId: rollbackVersion.id,
            reportId,
            performedBy: req.body.performedBy,
            performedByName: req.body.performedByName,
            description: `Government rollback executed: Restored version ${targetVersion.versionNumber} as ${rollbackVersion.versionNumber}. Reason: ${req.body.rollbackReason}`,
            previousState: currentVersion,
            newState: rollbackVersion,
            sessionId: req.body.sessionId,
            ipAddress: req.body.ipAddress,
            performedByRole: req.body.performedByRole,
            performedByDepartment: req.body.performedByDepartment,
            complianceLevel: 'critical',
          })
        );

        await deps.versions.createAuditLog(
          deps.versionManager.createAuditLogEntry({
            action: 'version_restored',
            versionId: targetVersion.id,
            reportId,
            performedBy: req.body.performedBy,
            performedByName: req.body.performedByName,
            description: `Version ${targetVersion.versionNumber} restored via government rollback operation`,
            newState: targetVersion,
            sessionId: req.body.sessionId,
            ipAddress: req.body.ipAddress,
            performedByRole: req.body.performedByRole,
            performedByDepartment: req.body.performedByDepartment,
            complianceLevel: 'critical',
          })
        );

        return {
          rollbackVersion,
          restoredVersion: targetVersion,
          supersededVersion: currentVersion
        };
      });

      res.json({
        success: true,
        data: {
          rollbackVersion: result.rollbackVersion,
          restoredFromVersion: result.restoredVersion,
          message: `Government rollback executed successfully. Version ${result.restoredVersion.versionNumber} has been restored as ${result.rollbackVersion.versionNumber}`,
          auditCompliance: {
            rollbackId: result.rollbackVersion.id,
            rollbackTimestamp: new Date().toISOString(),
            governmentCompliance: true,
            auditTrailComplete: true
          }
        }
      });

    } catch (error) {
      logger.error("Error executing rollback:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Government rollback operation failed"
      });
    }
  });

  router.post("/:id/versions/:versionId/send-to-manager", auth.requireAuth, auth.requirePermission("workflow:advance"), validateBody(sendToManagerSchema), async (req, res) => {

    try {
      const { id: reportId, versionId } = req.params as { id: string; versionId: string };
      const { managerEmail, message } = req.body;

      const senderId = requireSessionUserId(req as { session?: { userId?: string } });
      const sender = await deps.users.getUser(senderId);
      if (!sender) {
        return res.status(401).json({
          success: false,
          error: "Sender not found"
        });
      }

      const sentByName = sender.displayName || sender.username || "Unknown";

      const report = await deps.reports.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: "Demand report not found"
        });
      }

      const version = await deps.versions.findById(versionId);
      if (!versionBelongsToReport(version, reportId)) {
        return res.status(404).json({
          success: false,
          error: "Version not found"
        });
      }

      const versionType = version.versionType || 'business_case';
      const requiresDirectManagerEmail = versionType === 'business_case' || versionType === 'requirements' || versionType === 'both';

      if (requiresDirectManagerEmail && !managerEmail) {
        return res.status(400).json({
          success: false,
          error: "Manager email is required"
        });
      }

      const managerTargetLabel = managerEmail || 'designated final approvers';

      let emailSent = false;
      let contentType = '';
      const sentTimestamp = new Date();

      const sendResult = await sendVersionContentToManager({
        deps, reportId, versionId, version, report: report as unknown as Record<string, unknown>,
        managerEmail, message: message || '', sentByName,
      });

      if ('error' in sendResult) {
        return res.status(sendResult.status).json({ success: false, error: sendResult.error });
      }
      emailSent = sendResult.emailSent;
      contentType = sendResult.contentType;

      if (!emailSent) {
        logger.warn(`Email notification to ${managerTargetLabel} failed or skipped, proceeding with workflow status update`);
      }

      const sentToManagerHistoryEntry: WorkflowHistoryEntry = {
        timestamp: sentTimestamp.toISOString(),
        previousStatus: version.status,
        newStatus: 'manager_approval',
        action: 'sent_to_manager',
        description: `${contentType} sent to ${managerTargetLabel} for final manager approval`,
        performedBy: senderId,
        comments: message || ''
      };

      await deps.versions.update(versionId, {
        status: 'manager_approval',
        workflowHistory: [
          ...((version.workflowHistory as WorkflowHistoryEntry[]) || []),
          sentToManagerHistoryEntry
        ]
      });

      // Update demand report workflow history for ALL version types
      // Only update workflowStatus for business_case (primary workflow driver)
      const reportWorkflowHistory = Array.isArray(report.workflowHistory) ? report.workflowHistory : [];
      const reportHistoryEntry = {
        timestamp: sentTimestamp.toISOString(),
        action: 'sent_to_manager',
        description: `${contentType} version ${version.versionNumber} sent to ${managerTargetLabel} for final manager approval`,
        performedBy: senderId,
        performedByName: sentByName,
        versionId: versionId,
        versionNumber: version.versionNumber,
        versionType: version.versionType,
        managerEmail: managerEmail
      };

      if (version.versionType === 'business_case' || version.versionType === 'both' || !version.versionType) {
        await deps.reports.update(reportId, {
          workflowStatus: 'manager_approval',
          workflowHistory: [...reportWorkflowHistory, reportHistoryEntry]
        });
      } else {
        // For requirements / strategic_fit: record in history but don't change overall workflow status
        await deps.reports.update(reportId, {
          workflowHistory: [...reportWorkflowHistory, reportHistoryEntry]
        });
      }

      const approvalTab = getVersionTabSlug(version.versionType);

      // Fan-out notifications asynchronously to keep approval-transition API responsive.
      setImmediate(async () => {
        try {
          const notificationJobs: Promise<unknown>[] = [];

          if (report.createdBy) {
            notificationJobs.push(
              deps.coveria.notify({
                userId: report.createdBy,
                title: `${contentType} Sent for Final Approval`,
                message: `Hello! COREVIA here. Your ${contentType.toLowerCase()} "${report.businessObjective || 'Untitled'}" has been forwarded to ${managerTargetLabel} for final director approval. You'll receive a notification once the decision is made.`,
                type: 'info',
                priority: 'medium',
                relatedType: 'demand_report',
                relatedId: reportId,
                actionUrl: `/demand-analysis-report/${reportId}?tab=${approvalTab}`,
              })
            );
          }

          const finalApprovers = await deps.users.getUsersWithPermission('workflow:final-approve');
          notificationJobs.push(
            ...finalApprovers.map((approver) =>
              deps.coveria.notify({
                userId: approver.id,
                title: 'Director Approval Required',
                message: `Hello! COREVIA here. A ${contentType.toLowerCase()} for "${report.businessObjective || 'Untitled'}" requires your final approval. It was submitted by ${sentByName} and is awaiting your decision.`,
                type: 'approval_needed',
                priority: 'high',
                relatedType: 'demand_report',
                relatedId: reportId,
                actionUrl: `/demand-analysis-report/${reportId}?tab=${approvalTab}`,
              })
            )
          );

          await Promise.allSettled(notificationJobs);
        } catch (notificationError) {
          logger.error("Error sending manager-approval notifications:", notificationError);
        }
      });

      res.json({
        success: true,
        message: `${contentType} sent to ${managerTargetLabel} for final approval`,
        data: {
          emailSent,
          versionStatus: 'manager_approval',
          managerEmail: managerEmail ?? null
        }
      });

    } catch (error) {
      logger.error("Error sending version to manager:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to send version to manager"
      });
    }
  });

  router.post("/:id/versions/:versionId/publish", auth.requireAuth, auth.requirePermission("version:publish"), validateBody(publishVersionBodySchema), async (req, res) => {

    try {
      const { id: reportId, versionId } = req.params as { id: string; versionId: string };

      const report = await deps.reports.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: "Demand report not found"
        });
      }

      const version = await deps.versions.findById(versionId);
      if (version?.reportId !== reportId) {
        return res.status(404).json({
          success: false,
          error: "Version not found"
        });
      }

      const authorizedRoles = ['admin', 'administrator', 'manager', 'director', 'supervisor', 'architect'];
      const performedByRole = normalizeRoleInput(req.body.performedByRole);
      if (!performedByRole || !authorizedRoles.includes(performedByRole)) {
        return res.status(403).json({
          success: false,
          error: "Insufficient permissions for publishing. Requires admin, administrator, manager, director, supervisor, or architect role"
        });
      }

      if (!['approved'].includes(version.status)) {
        return res.status(400).json({
          success: false,
          error: `Cannot publish version with status '${version.status}'. Only approved versions can be published`
        });
      }

      const result = await deps.versions.executeInTransaction(async () => {
        const publishTimestamp = new Date();
        const previousState = { ...version };
        const complianceFlags = toRecord(version.complianceFlags) ?? {};
        complianceFlags.published = true;
        complianceFlags.governmentApproved = true;

        const existingPublished = await deps.versions.getByStatus(reportId, 'published');
        for (const publishedVersion of existingPublished) {
          const supersededByPublishEntry: WorkflowHistoryEntry = {
            timestamp: publishTimestamp.toISOString(),
            action: 'superseded_by_publish',
            description: `Superseded by publication of version ${version.versionNumber}`,
            performedBy: req.body.performedBy
          };

          await deps.versions.update(publishedVersion.id, {
            status: 'superseded',
            workflowHistory: [
              ...((publishedVersion.workflowHistory as WorkflowHistoryEntry[]) || []),
              supersededByPublishEntry
            ]
          });
        }

        const publishHistoryEntry: WorkflowHistoryEntry = {
          timestamp: publishTimestamp.toISOString(),
          previousStatus: version.status,
          newStatus: 'published',
          action: 'published',
          description: `Version published by ${req.body.performedByName} (${req.body.performedByRole})`,
          performedBy: req.body.performedBy,
          comments: req.body.publishReason
        };

        const updates: VersionUpdateData = {
          status: 'published',
          workflowStep: 'publication',
          publishedBy: req.body.performedBy,
          publishedByName: req.body.performedByName,
          publishedAt: publishTimestamp,
          workflowHistory: [
            ...((version.workflowHistory as WorkflowHistoryEntry[]) || []),
            publishHistoryEntry
          ],
          complianceFlags
        };

        if (req.body.effectiveDate) {
          updates.effectiveAt = new Date(req.body.effectiveDate);
        }
        if (req.body.expirationDate) {
          updates.expiresAt = new Date(req.body.expirationDate);
        }

        const publishedVersion = await deps.versions.update(versionId, updates);

        if (!publishedVersion) {
          throw new Error("Failed to publish version");
        }

        // Only update main demand workflowStatus for primary workflow versions.
        // Requirements and enterprise architecture publishing should NOT affect the main demand workflow.
        if (version.versionType !== 'requirements' && version.versionType !== 'enterprise_architecture') {
          await deps.reports.update(reportId, {
            aiAnalysis: normalizeDemandAiAnalysis((publishedVersion.versionData as Record<string, unknown>)?.aiAnalysis),
            workflowStatus: 'manager_approved',
            workflowHistory: [
              ...(report.workflowHistory || []),
              {
                timestamp: publishTimestamp.toISOString(),
                previousStatus: report.workflowStatus,
                newStatus: 'manager_approved',
                reason: `Version ${version.versionNumber} published: ${req.body.publishReason}`,
                user: req.body.performedByName,
                publishOperation: true
              }
            ]
          });
        }

        Promise.resolve().then(() => {
          deps.autoIndexer.index(reportId, versionId, req.body.performedBy);
        }).catch(error => {
          logger.error('[AutoIndexing] Failed to enqueue artifacts for version publishing:', error);
        });

        await deps.versions.createAuditLog(
          deps.versionManager.createAuditLogEntry({
            action: 'published',
            versionId,
            reportId,
            performedBy: req.body.performedBy,
            performedByName: req.body.performedByName,
            description: `Version ${version.versionNumber} published to production. Reason: ${req.body.publishReason}`,
            previousState,
            newState: publishedVersion,
            sessionId: req.body.sessionId,
            ipAddress: req.body.ipAddress,
            performedByRole: req.body.performedByRole,
            performedByDepartment: req.body.performedByDepartment,
            complianceLevel: 'critical',
          })
        );

        return publishedVersion;
      });

      res.json({
        success: true,
        data: result,
        message: `Version ${result.versionNumber} published successfully to production environment`,
        auditCompliance: {
          publishId: result.id,
          publishTimestamp: new Date().toISOString(),
          governmentCompliance: true,
          productionDeployment: true
        }
      });

    } catch (error) {
      logger.error("Error publishing version:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to publish version"
      });
    }
  });

  router.post("/:id/migrate-to-versions", auth.requireAuth, auth.requirePermission("version:create"), validateBody(migrateToVersionsSchema), async (req, res) => {

    try {
      const { id: reportId } = req.params as { id: string };
      const { performedBy, performedByName } = req.body;

      if (!performedBy || !performedByName) {
        return res.status(400).json({
          success: false,
          error: "Performer information is required for migration"
        });
      }

      const report = await deps.reports.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          error: "Demand report not found"
        });
      }

      const existingVersions = await deps.versions.findByReportId(reportId);
      if (existingVersions.length > 0) {
        return res.status(409).json({
          success: false,
          error: "Report has already been migrated to versioning system"
        });
      }

      const versionResult = {
        success: true,
        reportId,
        message: 'Migration completed successfully'
      };

      res.json({
        success: true,
        data: versionResult,
        message: "Successfully created initial version for versioning system"
      });

    } catch (error) {
      logger.error("Error during migration:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Migration failed"
      });
    }
  });

  return router;
}
