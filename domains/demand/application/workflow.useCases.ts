import type { DemandAllDeps } from "./buildDeps";
import type { BrainApprovalRecord } from "../domain/ports";
import { DemandResult, parseAiAnalysis } from "./shared";
import { logger } from "@platform/logging/Logger";
import { eventBus } from "@platform/events";


// ══════════════════════════════════════════════════════════════════════
// Workflow Use-Cases
// ══════════════════════════════════════════════════════════════════════

export interface WorkflowUpdateInput {
  workflowStatus: string;
  decisionReason?: string;
  rejectionCategory?: string;
  deferredUntil?: string;
  approvedBy?: string;
  meetingDate?: string;
  meetingNotes?: string;
  managerEmail?: string;
}

export interface DemandCorrectionInput {
  updates: Record<string, unknown>;
  changeSummary?: string;
}


export interface WorkflowUserContext {
  userId: string;
  userRole?: string;
}


function buildDeferredRevisionNotes(deferredUntil?: string): string {
  if (deferredUntil) {
    return `Deferred from Demand Management portal until ${deferredUntil}`;
  }
  return "Deferred from Demand Management portal";
}

function resolveApprovalActionFromStatus(status: string | undefined, fallback: string | undefined): string | undefined {
  if (status === "approved") return "approve";
  if (status === "rejected") return "reject";
  if (status === "revised") return "revise";
  return fallback;
}

function resolveNotificationType(finalStatus: string): string {
  if (finalStatus === "acknowledged") return "meeting_request";
  if (finalStatus === "initially_approved") return "manager_approval";
  return "status_update";
}

function isHumanPauseStatus(status: string): boolean {
  return status === "deferred";
}

/** Robust budget parsing — handles "AED 60M", "AED 5-10M", "5,000,000", etc. */
function parseBudgetAmount(budgetRange: string): number {
  const hasMillion = /M(?:illion)?/i.test(budgetRange);
  const hasBillion = /B(?:illion)?/i.test(budgetRange);
  const hasThousand = /K|Thousand/i.test(budgetRange) && !hasMillion && !hasBillion;

  const numberPattern = /[\d,]+(?:\.\d+)?/g;
  const rawNumbers = budgetRange.match(numberPattern);

  if (!rawNumbers || rawNumbers.length === 0) return 0;

  const firstNum = Number.parseFloat(rawNumbers[0].replaceAll(",", ""));
  if (hasBillion) return firstNum * 1_000_000_000;
  if (hasMillion) return firstNum * 1_000_000;
  if (hasThousand) return firstNum * 1_000;
  return firstNum;
}

function normalizeDemandClassificationForPipeline(value: unknown): "public" | "internal" | "confidential" | "sovereign" | undefined {
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


async function getGovernanceBudgetThreshold(): Promise<number> {
  return 100_000;
}

type WorkflowDeps = Pick<DemandAllDeps, "reports" | "brain" | "governance" | "notifier" | "versions">;

const CORRECTION_ALLOWED_STATUSES = new Set(["deferred", "rejected", "requires_more_info"]);
const CORRECTION_FIELD_KEYS = new Set([
  "suggestedProjectName",
  "industryType",
  "urgency",
  "businessObjective",
  "currentChallenges",
  "expectedOutcomes",
  "successCriteria",
  "constraints",
  "currentCapacity",
  "budgetRange",
  "timeframe",
  "stakeholders",
  "existingSystems",
  "integrationRequirements",
  "complianceRequirements",
  "riskFactors",
  "requestType",
  "dataClassification",
]);

function normalizeCorrectionText(value: unknown): string | undefined | null {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickCorrectionUpdates(updates: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (!CORRECTION_FIELD_KEYS.has(key)) continue;
    const normalized = normalizeCorrectionText(value);
    if (normalized !== undefined) picked[key] = normalized;
  }
  return picked;
}

function buildDemandFieldsCorrectionArtifact(report: Record<string, unknown>, correctionUpdates: Record<string, unknown>) {
  const merged = { ...report, ...correctionUpdates };
  const text = (key: string) => normalizeCorrectionText(merged[key]) || undefined;

  return {
    reportId: merged.id,
    organizationName: text("organizationName"),
    department: text("department"),
    industryType: text("industryType"),
    enhancedBusinessObjective: text("businessObjective"),
    suggestedProjectName: text("suggestedProjectName"),
    currentChallenges: text("currentChallenges"),
    expectedOutcomes: text("expectedOutcomes"),
    successCriteria: text("successCriteria"),
    timeframe: text("timeframe"),
    budgetRange: text("budgetRange"),
    stakeholders: text("stakeholders"),
    riskFactors: text("riskFactors"),
    constraints: text("constraints"),
    integrationRequirements: text("integrationRequirements"),
    complianceRequirements: text("complianceRequirements"),
    existingSystems: text("existingSystems"),
    currentCapacity: text("currentCapacity"),
    requestType: text("requestType"),
    dataClassification: text("dataClassification"),
    correction: {
      correctedFields: Object.keys(correctionUpdates),
      submittedAt: new Date().toISOString(),
    },
  };
}

function resolveReportDecisionId(reportId: string, report: Record<string, unknown>, aiAnalysis: ReturnType<typeof parseAiAnalysis>) {
  return typeof report.decisionSpineId === "string" && report.decisionSpineId
    ? report.decisionSpineId
    : typeof aiAnalysis.decisionId === "string" && aiAnalysis.decisionId
      ? aiAnalysis.decisionId
      : reportId;
}

function isCorrectionBypassAttempt(currentStatus: unknown, input: WorkflowUpdateInput): boolean {
  return input.workflowStatus === "acknowledged" && CORRECTION_ALLOWED_STATUSES.has(String(currentStatus || ""));
}

async function checkGovernanceGuard(
  deps: WorkflowDeps,
  reportId: string,
  report: Record<string, unknown>,
  input: WorkflowUpdateInput,
  user: WorkflowUserContext,
): Promise<DemandResult<null> | null> {
  const advancementStatuses = ["acknowledged", "meeting_scheduled", "under_review", "initially_approved", "manager_approved", "approved", "completed"];
  if (!advancementStatuses.includes(input.workflowStatus)) return null;

  // Only check governance for statuses beyond initial acknowledgement
  // Acknowledgement is independent of Brain Layer 7 approval and should not be blocked
  if (input.workflowStatus !== "acknowledged") {
    const pendingDecisionRequests = await deps.governance.findPendingApprovalsBySourceId(reportId);
    if (pendingDecisionRequests.length > 0) {
      const pendingNumbers = pendingDecisionRequests.map((r) => r.requestNumber).join(", ");
      return {
        success: false,
        error: `Cannot advance workflow while governance approval is pending. ${pendingDecisionRequests.length} pending: ${pendingNumbers}.`,
        status: 409,
      };
    }
  }

  const budgetGuardResult = await checkHighBudgetGovernance(deps, reportId, report, input, user);
  return budgetGuardResult;
}

function resolveGovernanceContext(report: Record<string, unknown>, aiAnalysis: Record<string, unknown>) {
  const suggestedProjectName = typeof report.suggestedProjectName === "string" ? report.suggestedProjectName : "";
  const businessObjective = typeof report.businessObjective === "string" ? report.businessObjective : "";
  const projectId = typeof report.projectId === "string" ? report.projectId : "";
  const organizationName = typeof report.organizationName === "string" ? report.organizationName : undefined;
  const departmentName = typeof report.department === "string" ? report.department : undefined;

  let intentTitle = "Demand request";
  if (suggestedProjectName.trim()) {
    intentTitle = suggestedProjectName;
  } else if (businessObjective) {
    intentTitle = businessObjective;
  }

  const normalizedClassification = normalizeDemandClassificationForPipeline(
    report.dataClassification || aiAnalysis.classificationLevel || aiAnalysis.classification,
  );

  return {
    suggestedProjectName,
    businessObjective,
    projectId,
    organizationName,
    departmentName,
    intentTitle,
    normalizedClassification,
    demandTitle: suggestedProjectName || projectId,
  };
}

async function checkHighBudgetGovernance(
  deps: WorkflowDeps,
  reportId: string,
  report: Record<string, unknown>,
  input: WorkflowUpdateInput,
  user: WorkflowUserContext,
): Promise<DemandResult<null> | null> {
  if (input.workflowStatus !== "acknowledged" || report.workflowStatus !== "generated") return null;

  const budgetRange = (report.budgetRange || report.estimatedBudget || "") as string;
  const budgetAmount = parseBudgetAmount(String(budgetRange));
  const budgetThreshold = await getGovernanceBudgetThreshold();
  if (budgetAmount < budgetThreshold) return null;

  const approvedRequests = await deps.governance.findApprovedBySourceId(reportId);
  if (approvedRequests.length > 0) return null;

  // Architectural rule: a demand spine approved at Layer 7 is the canonical governance gate
  // for the whole spine. Acknowledging the demand must NOT spawn a second HITL approval —
  // that's what the user reported as duplicate PMO Director prompts. Short-circuit when the
  // spine itself already carries an approved/conditional approval record.
  try {
    const aiAnalysisProbe = parseAiAnalysis(report.aiAnalysis);
    const probeSpineId = (report.decisionSpineId as string | undefined)
      || (typeof aiAnalysisProbe.decisionId === "string" ? aiAnalysisProbe.decisionId : undefined)
      || (await deps.brain.findLatestDecisionByDemandReportId(reportId))?.id;
    if (probeSpineId) {
      const existingApproval = await deps.brain.getApproval(probeSpineId);
      const status = existingApproval?.status ? String(existingApproval.status).toLowerCase() : "";
      if (existingApproval && status !== "pending" && status !== "rejected") {
        logger.info(
          `[Governance Check] Spine ${probeSpineId} already has approval (status=${status || "n/a"}); skipping duplicate high-budget HITL gate`,
        );
        return null;
      }
    }
  } catch (probeErr) {
    logger.warn("[Governance Check] Spine approval probe failed; falling through to intake", probeErr);
  }

  try {
    const aiAnalysis = parseAiAnalysis(report.aiAnalysis);
    const resolvedSpineId = report.decisionSpineId || aiAnalysis.decisionId || (await deps.brain.findLatestDecisionByDemandReportId(reportId))?.id;
    const ctx = resolveGovernanceContext(report, aiAnalysis);
    const decisionSpineId = typeof resolvedSpineId === "string" ? resolvedSpineId : undefined;
    const classificationFields = ctx.normalizedClassification ? {
      dataClassification: ctx.normalizedClassification,
      classificationLevel: ctx.normalizedClassification,
      accessLevel: ctx.normalizedClassification,
    } : {};

    const intakeResult = await deps.governance.intake(
      {
        intent: `Acknowledge high-budget demand: ${ctx.intentTitle}`,
        decisionType: "business_case",
        financialImpact: budgetAmount >= 10_000_000 ? "critical" : "high",
        financialAmount: budgetAmount,
        regulatoryRisk: "medium",
        urgency: report.urgency === "critical" ? "critical" : "normal",
        sourceType: "demand_report",
        sourceId: reportId,
        ...classificationFields,
        sourceContext: {
          demandTitle: ctx.demandTitle,
          department: ctx.departmentName,
          organization: ctx.organizationName,
          budgetRange,
          businessObjective: ctx.businessObjective,
          ...classificationFields,
        },
      },
      {
        userId: user.userId,
        userRole: user.userRole,
        organizationId: ctx.organizationName,
        departmentId: ctx.departmentName,
        decisionSpineId,
      },
    );

    if (intakeResult.governance?.action === "require_approval" || intakeResult.governance?.action === "escalate") {
      return {
        success: false,
        error: `High-budget demand requires governance approval. Budget AED ${budgetAmount.toLocaleString()} exceeds threshold AED ${budgetThreshold.toLocaleString()}.`,
        status: 202,
      };
    }
  } catch (error) {
    logger.error("[Governance Check] Error creating decision request:", error);
  }

  return null;
}

function buildWorkflowUpdateData(report: Record<string, unknown>, input: WorkflowUpdateInput): Record<string, unknown> {
  const workflowEntry = {
    timestamp: new Date().toISOString(),
    previousStatus: report.workflowStatus || "generated",
    newStatus: input.workflowStatus,
    reason: input.decisionReason,
    user: input.approvedBy || "System",
    ...(input.rejectionCategory && { rejectionCategory: input.rejectionCategory }),
    ...(input.deferredUntil && { deferredUntil: input.deferredUntil }),
    ...(input.meetingDate && { meetingDate: input.meetingDate }),
  };

  const existingHistory = Array.isArray(report.workflowHistory) ? report.workflowHistory : [];
  const updateData: Record<string, unknown> = {
    workflowStatus: input.workflowStatus,
    workflowHistory: [...(existingHistory as unknown[]), workflowEntry],
    updatedAt: new Date(),
  };

  const now = new Date();
  const timestampMap: Record<string, string> = {
    acknowledged: "acknowledgedAt",
    meeting_scheduled: "meetingScheduledAt",
    under_review: "reviewStartedAt",
    approved: "approvedAt",
    initially_approved: "approvedAt",
    manager_approved: "managerApprovedAt",
    completed: "completedAt",
    rejected: "rejectedAt",
    deferred: "deferredAt",
  };
  const tsField = timestampMap[input.workflowStatus];
  if (tsField) updateData[tsField] = now;
  if (input.workflowStatus === "generated" && !report.submittedAt) updateData.submittedAt = now;

  if (input.decisionReason) updateData.decisionReason = input.decisionReason;
  if (input.rejectionCategory) updateData.rejectionCategory = input.rejectionCategory;
  if (input.deferredUntil) updateData.deferredUntil = new Date(input.deferredUntil);
  if (input.approvedBy) updateData.approvedBy = input.approvedBy;
  if (input.meetingDate) {
    updateData.meetingDate = new Date(input.meetingDate);
    updateData.meetingScheduled = true;
  }
  if (input.meetingNotes) updateData.meetingNotes = input.meetingNotes;
  if (input.managerEmail) updateData.managerEmail = input.managerEmail;

  return updateData;
}

function findLinkedDecisionId(decisions: Array<{ id: string; inputData: unknown }>, reportId: string): string | undefined {
  const matching = decisions.find((d) => {
    const inp = typeof d.inputData === "string"
      ? (() => { try { return JSON.parse(d.inputData) as Record<string, unknown>; } catch { return null; } })()
      : d.inputData;
    return !!inp && typeof inp === "object" && (inp as Record<string, unknown>).demandReportId === reportId;
  });
  return matching?.id;
}

async function syncWorkflowToBrainConsole(
  deps: WorkflowDeps,
  reportId: string,
  report: Record<string, unknown>,
  input: WorkflowUpdateInput,
  user: WorkflowUserContext,
): Promise<boolean> {
  const aiAnalysis = parseAiAnalysis(report.aiAnalysis);
  let linkedDecisionId = aiAnalysis?.decisionId;

  if (!linkedDecisionId) {
    const allDecisions = await deps.brain.listDecisions();
    linkedDecisionId = findLinkedDecisionId(
      allDecisions.map((decision) => ({ id: decision.id, inputData: decision.inputData ?? {} })),
      reportId,
    );
  }

  if (!linkedDecisionId) return false;

  let existingApproval: BrainApprovalRecord | undefined;
  try {
    existingApproval = await deps.brain.getApproval(linkedDecisionId);
  } catch (approvalErr) {
    logger.warn(`[Reverse Sync] Could not read approval for decision ${linkedDecisionId}:`, approvalErr);
  }

  const pendingDecisionSpineApproval =
    input.workflowStatus === "acknowledged" &&
    existingApproval &&
    existingApproval.status !== "approved";

  const statusMap: Record<string, string> = {
    acknowledged: pendingDecisionSpineApproval ? "validation" : "memory",
    rejected: "rejected",
    under_review: "validation",
    initially_approved: "completed",
    manager_approved: "completed",
  };
  const brainStatus = statusMap[input.workflowStatus];
  if (brainStatus) {
    await deps.brain.updateDecision(linkedDecisionId, {
      status: brainStatus,
      completedAt: ["rejected", "completed", "memory"].includes(brainStatus) ? new Date() : undefined,
    });
  }

  const approvalMap: Record<string, Record<string, unknown>> = {
    rejected: { status: "rejected", rejectionReason: input.decisionReason || "Rejected from Demand Management portal", approvedBy: user.userId },
    initially_approved: { status: "approved", approvedBy: user.userId, approvalReason: input.decisionReason || "Initial approval from Demand Management portal" },
    manager_approved: { status: "approved", approvedBy: user.userId, approvalReason: input.decisionReason || "Final approval from Demand Management portal" },
  };
  const approvalUpdate = approvalMap[input.workflowStatus];

  if (approvalUpdate) {
    try {
      if (existingApproval) await deps.brain.updateApproval(linkedDecisionId, approvalUpdate);
    } catch (approvalErr) {
      logger.warn(`[Reverse Sync] Could not update approval for decision ${linkedDecisionId}:`, approvalErr);
    }
  }

  await deps.brain.addAuditEvent(
    linkedDecisionId, aiAnalysis.correlationId || "", 7,
    `demand_workflow_${input.workflowStatus}`,
    { source: "demand-portal", workflowStatus: input.workflowStatus, reason: input.decisionReason, demandReportId: reportId },
    user.userId,
  );

  const approvalStatus = typeof approvalUpdate?.status === "string" ? approvalUpdate.status : aiAnalysis?.approvalStatus;
  const approvedBy = typeof approvalUpdate?.approvedBy === "string" ? approvalUpdate.approvedBy : aiAnalysis?.approvedBy;
  const approvalReason = typeof approvalUpdate?.approvalReason === "string" ? approvalUpdate.approvalReason : aiAnalysis?.approvalReason;
  const rejectionReason = typeof approvalUpdate?.rejectionReason === "string" ? approvalUpdate.rejectionReason : aiAnalysis?.rejectionReason;
  const revisionNotes = typeof approvalUpdate?.revisionNotes === "string" ? approvalUpdate.revisionNotes : aiAnalysis?.revisionNotes;

  const mergedAnalysis = {
    ...aiAnalysis,
    decisionId: linkedDecisionId,
    approvalAction: resolveApprovalActionFromStatus(approvalStatus, aiAnalysis?.approvalAction),
    approvalStatus,
    approvedBy,
    approvalReason,
    rejectionReason,
    revisionNotes,
    updatedAt: new Date().toISOString(),
  };
  if (isHumanPauseStatus(input.workflowStatus)) {
    mergedAnalysis.revisionNotes = input.decisionReason || buildDeferredRevisionNotes(input.deferredUntil);
  }
  await deps.reports.update(reportId, { aiAnalysis: mergedAnalysis });
  return true;
}

interface WorkflowNotificationContext {
  deps: WorkflowDeps;
  reportId: string;
  report: Record<string, unknown>;
  updatedReport: unknown;
  input: WorkflowUpdateInput;
  finalStatus: string;
}

async function sendWorkflowNotifications(ctx: WorkflowNotificationContext): Promise<boolean> {
  const { deps, reportId, report, updatedReport, input, finalStatus } = ctx;
  const requestorEmail = (report.requestorEmail || "") as string;
  const requestorName = (report.requestorName || "Requester") as string;
  const objectiveTitle = (report.businessObjective || "Digital Transformation Request") as string;
  const organizationName = (report.organizationName || "Organization") as string;

  let notificationSent = false;

  switch (finalStatus) {
    case "acknowledged":
      notificationSent = await deps.notifier.sendMeetingRequest(requestorEmail, requestorName, objectiveTitle, organizationName, reportId);
      break;
    case "initially_approved":
      if (input.managerEmail || report.managerEmail) {
        notificationSent = await deps.notifier.sendManagerApproval(
          input.managerEmail || (report.managerEmail as string), objectiveTitle, organizationName, requestorName, reportId,
        );
      }
      if (notificationSent) {
        await deps.notifier.sendWorkflowStatus(requestorEmail, requestorName, objectiveTitle, organizationName, finalStatus, input.decisionReason || "Your request has received initial approval and is being reviewed by management.", reportId);
      }
      break;
    case "converted":
    case "manager_approved":
    case "deferred":
    case "rejected":
    case "under_review":
    case "meeting_scheduled":
      notificationSent = await deps.notifier.sendWorkflowStatus(
        requestorEmail, requestorName, objectiveTitle, organizationName, finalStatus,
        input.decisionReason || (finalStatus === "converted" ? "Your request has been approved and converted to a portfolio project." : ""),
        reportId,
      );
      break;
  }

  if (notificationSent && updatedReport) {
    const existingNotifications = Array.isArray((updatedReport as Record<string, unknown>).notificationsSent)
      ? (updatedReport as Record<string, unknown>).notificationsSent as unknown[]
      : [];
    const logEntry = deps.notifier.createNotificationLogEntry(
      resolveNotificationType(finalStatus),
      requestorEmail, true,
    );
    await deps.reports.update(reportId, { notificationsSent: [...existingNotifications, logEntry] });
  }

  return notificationSent;
}

async function emitWorkflowDomainEvents(
  reportId: string,
  previousStatus: string,
  newStatus: string,
  input: WorkflowUpdateInput,
  user: WorkflowUserContext,
): Promise<void> {
  const eventMeta = { actorId: user.userId };

  await eventBus.emit(
    "demand.DemandWorkflowAdvanced",
    { demandReportId: reportId, previousStatus, newStatus },
    eventMeta,
  );

  if (newStatus === "approved" || newStatus === "manager_approved") {
    await eventBus.emit("demand.DemandApproved", { demandReportId: reportId }, eventMeta);
  } else if (newStatus === "rejected") {
    await eventBus.emit("demand.DemandRejected", { demandReportId: reportId, reason: input.decisionReason }, eventMeta);
  } else if (newStatus === "deferred") {
    await eventBus.emit("demand.DemandDeferred", { demandReportId: reportId, deferredUntil: input.deferredUntil }, eventMeta);
  }
}

export async function updateWorkflowStatus(
  deps: WorkflowDeps,
  reportId: string,
  input: WorkflowUpdateInput,
  user: WorkflowUserContext,
): Promise<DemandResult<{ report: unknown; notificationSent: boolean; brainSyncCompleted: boolean }>> {
  if (!input.workflowStatus) {
    return { success: false, error: "Workflow status is required", status: 400 };
  }

  const report = await deps.reports.findById(reportId);
  if (!report) return { success: false, error: "Demand report not found", status: 404 };

  if (isCorrectionBypassAttempt(report.workflowStatus, input)) {
    return {
      success: false,
      error: "Please complete the requested information before resubmitting this demand.",
      status: 409,
    };
  }

  const governanceBlock = await checkGovernanceGuard(deps, reportId, report as unknown as Record<string, unknown>, input, user);
  if (governanceBlock) return governanceBlock as DemandResult<{ report: unknown; notificationSent: boolean; brainSyncCompleted: boolean }>;

  const updateData = buildWorkflowUpdateData(report as unknown as Record<string, unknown>, input);
  const updatedReport = await deps.reports.update(reportId, updateData);

  let brainSyncCompleted = false;
  try {
    brainSyncCompleted = await syncWorkflowToBrainConsole(deps, reportId, report as unknown as Record<string, unknown>, input, user);
  } catch (reverseSyncError) {
    logger.error("[Reverse Sync] Error syncing to Brain Console:", reverseSyncError);
  }

  const finalStatus = (updateData.workflowStatus as string) || input.workflowStatus;
  let notificationSent = false;
  try {
    notificationSent = await sendWorkflowNotifications({
      deps, reportId, report: report as unknown as Record<string, unknown>,
      updatedReport, input, finalStatus,
    });
  } catch (notificationError) {
    logger.error("Error sending notification:", notificationError);
  }

  const previousStatus = typeof report.workflowStatus === "string" ? report.workflowStatus : "generated";
  await emitWorkflowDomainEvents(reportId, previousStatus, finalStatus, input, user);

  // When acknowledged for the first time, mark auto-generation in progress and fire background BC generation.
  // Governance gate: BOTH human acknowledgement AND a recorded PMO/Director Decision-Spine approval are
  // required before the Brain produces the BUSINESS_CASE artifact. Acknowledging alone must not generate
  // downstream artifacts — that flow violates the L7 HITL contract.
  if (finalStatus === "acknowledged" && previousStatus !== "acknowledged") {
    let spineApproved = false;
    try {
      const aiAnalysisForApproval = parseAiAnalysis((updatedReport as Record<string, unknown>)?.aiAnalysis);
      const decisionId = aiAnalysisForApproval?.decisionId;
      if (decisionId) {
        const approval = await deps.brain.getApproval(decisionId);
        spineApproved = Boolean(approval && approval.status === "approved");
      }
    } catch (approvalErr) {
      logger.warn("[Workflow] Could not resolve spine approval state for BC auto-gen gate:", approvalErr);
    }

    if (!spineApproved) {
      try {
        const currentAnalysis = parseAiAnalysis((updatedReport as Record<string, unknown>)?.aiAnalysis);
        await deps.reports.update(reportId, {
          aiAnalysis: {
            ...currentAnalysis,
            businessCaseAutoGenerating: false,
            businessCasePendingApproval: true,
            businessCaseAutoTriggeredAt: null,
          },
        } as Record<string, unknown>);
      } catch (gateErr) {
        logger.warn("[Workflow] Could not mark BC pending PMO approval:", gateErr);
      }
    } else {
      // Spine is approved AND user has acknowledged. The Business Case tab is now
      // unlocked, but we deliberately DO NOT auto-generate the BC artifact. Each
      // AI invocation must be tied to an explicit human action so the audit trail
      // cleanly distinguishes "PMO approved the demand" from "user requested a
      // Business Case to be generated". The user must click Generate Business
      // Case in the BC tab to start the L7-governed BC pipeline.
      try {
        const currentAnalysis = parseAiAnalysis((updatedReport as Record<string, unknown>)?.aiAnalysis);
        await deps.reports.update(reportId, {
          aiAnalysis: {
            ...currentAnalysis,
            businessCaseAutoGenerating: false,
            businessCasePendingApproval: false,
            businessCaseReadyForGeneration: true,
            businessCaseAutoTriggeredAt: null,
          },
        } as Record<string, unknown>);
      } catch (bgErr) {
        logger.warn("[Workflow] Could not mark BC ready for manual generation:", bgErr);
      }
    }
  }

  return { success: true, data: { report: updatedReport, notificationSent, brainSyncCompleted } };
}

export async function submitDemandCorrection(
  deps: WorkflowDeps,
  reportId: string,
  input: DemandCorrectionInput,
  user: WorkflowUserContext,
): Promise<DemandResult<{ report: unknown; version: unknown | null; brainArtifact: unknown | null }>> {
  const report = await deps.reports.findById(reportId);
  if (!report) return { success: false, error: "Demand report not found", status: 404 };

  const currentStatus = String(report.workflowStatus || "generated");
  if (!CORRECTION_ALLOWED_STATUSES.has(currentStatus)) {
    return {
      success: false,
      error: "Correction loop is only available for deferred, rejected, or needs-more-info demands.",
      status: 409,
    };
  }

  const correctionUpdates = pickCorrectionUpdates(input.updates || {});
  if (Object.keys(correctionUpdates).length === 0) {
    return { success: false, error: "At least one correction field is required.", status: 400 };
  }

  const now = new Date();
  const changeSummary = input.changeSummary?.trim() || `Corrected demand fields after ${currentStatus}`;
  const previousHistory = Array.isArray(report.workflowHistory) ? report.workflowHistory : [];
  const aiAnalysis = parseAiAnalysis(report.aiAnalysis);
  const decisionSpineId = resolveReportDecisionId(reportId, report as unknown as Record<string, unknown>, aiAnalysis);

  const workflowEntry = {
    timestamp: now.toISOString(),
    previousStatus: currentStatus,
    newStatus: "generated",
    reason: changeSummary,
    user: user.userId,
    correction: {
      correctedFields: Object.keys(correctionUpdates),
      sourceStatus: currentStatus,
    },
  };

  const mergedAnalysis = {
    ...aiAnalysis,
    decisionId: aiAnalysis.decisionId || decisionSpineId,
    approvalStatus: "revised",
    approvalAction: "revise",
    revisionNotes: changeSummary,
    correctionLoop: {
      status: "resubmitted",
      sourceStatus: currentStatus,
      correctedFields: Object.keys(correctionUpdates),
      resubmittedAt: now.toISOString(),
      resubmittedBy: user.userId,
    },
    updatedAt: now.toISOString(),
  };

  const updatedReport = await deps.reports.update(reportId, {
    ...correctionUpdates,
    workflowStatus: "generated",
    decisionReason: changeSummary,
    deferredUntil: null,
    rejectionCategory: null,
    acknowledgedAt: null,
    reviewStartedAt: null,
    updatedAt: now,
    workflowHistory: [...previousHistory, workflowEntry],
    aiAnalysis: mergedAnalysis,
  });

  const correctionArtifact = buildDemandFieldsCorrectionArtifact(
    updatedReport as unknown as Record<string, unknown>,
    {},
  );

  let brainArtifact: unknown | null = null;
  try {
    const demandFieldsResult = await deps.brain.upsertDecisionArtifactVersion({
      decisionSpineId,
      artifactType: "DEMAND_FIELDS",
      subDecisionType: "DEMAND_FIELDS",
      content: correctionArtifact,
      changeSummary,
      createdBy: user.userId,
    });
    brainArtifact = demandFieldsResult;

    const demandRequestResult = await deps.brain.upsertDecisionArtifactVersion({
      decisionSpineId,
      artifactType: "DEMAND_REQUEST",
      subDecisionType: "DEMAND_REQUEST",
      content: {
        reportId,
        demandReport: updatedReport,
        correction: {
          correctedFields: Object.keys(correctionUpdates),
          submittedAt: now.toISOString(),
          sourceWorkflowStatus: currentStatus,
        },
      },
      changeSummary,
      createdBy: user.userId,
    });

    for (const result of [demandFieldsResult, demandRequestResult]) {
      const artifactId = (result as unknown as { artifact?: { artifactId?: string } })?.artifact?.artifactId;
      if (artifactId) {
        await deps.brain.updateDecisionArtifactStatus(artifactId, "APPROVED");
      }
    }
    await deps.brain.updateDecision(decisionSpineId, { status: "memory" });
    await deps.brain.addAuditEvent(
      decisionSpineId,
      String(aiAnalysis.correlationId || ""),
      4,
      "demand_correction_resubmitted",
      { demandReportId: reportId, correctedFields: Object.keys(correctionUpdates), changeSummary },
      user.userId,
    );
    await deps.brain.recordSpineEvent(decisionSpineId, "DEMAND_CORRECTION_RESUBMITTED", user.userId, {
      demandReportId: reportId,
      correctedFields: Object.keys(correctionUpdates),
      artifactTypes: ["DEMAND_FIELDS", "DEMAND_REQUEST"],
      sourceWorkflowStatus: currentStatus,
      nextWorkflowGate: "human_acknowledgement",
    });
  } catch (brainError) {
    logger.error("[Demand Correction] Failed to update Brain artifact lineage:", brainError);
    return { success: false, error: "Correction version was created, but Brain artifact lineage update failed.", status: 500 };
  }

  try {
    await sendWorkflowNotifications({
      deps,
      reportId,
      report: report as unknown as Record<string, unknown>,
      updatedReport,
      input: { workflowStatus: "generated", decisionReason: changeSummary },
      finalStatus: "generated",
    });
  } catch (notificationError) {
    logger.warn("[Demand Correction] Correction notification failed:", notificationError);
  }

  await emitWorkflowDomainEvents(reportId, currentStatus, "generated", {
    workflowStatus: "generated",
    decisionReason: changeSummary,
  }, user);

  return { success: true, data: { report: updatedReport, version: null, brainArtifact } };
}


export async function getWorkflowHistory(
  deps: Pick<DemandAllDeps, "reports">,
  reportId: string,
): Promise<DemandResult<unknown[]>> {
  const report = await deps.reports.findById(reportId);
  if (!report) return { success: false, error: "Demand report not found", status: 404 };
  return { success: true, data: Array.isArray(report.workflowHistory) ? report.workflowHistory : [] };
}


/** Generate COREVIA's analysis insight based on demand & specialist role. */
export function generateCoveriaInsight(report: { urgency?: string | null; budgetRange?: string | null }, specialistRole: string): string {
  const urgency = report.urgency?.toLowerCase() || "medium";
  const budgetRange = report.budgetRange || "";
  const roleInsights: Record<string, string> = {
    "Finance Analyst": `This request involves budget considerations of ${budgetRange || "significant scope"}. Your expertise in financial analysis and ROI assessment would be invaluable for ensuring fiscal responsibility.`,
    "Technical Analyst": `The technical complexity of this ${urgency} priority request requires your expertise to evaluate implementation feasibility and technology alignment.`,
    "Security Analyst": `This initiative may have security implications that require your assessment to ensure compliance with UAE cybersecurity standards.`,
    "Business Analyst": `Your insights into business process optimization would help evaluate the strategic alignment and expected outcomes of this request.`,
    "Project Analyst": `This ${urgency} priority request needs your expertise to assess resource requirements and timeline feasibility.`,
    "Compliance Analyst": `Please review this request for regulatory compliance and alignment with government policies.`,
    "Data Analyst": `This request may involve data considerations that require your expertise in data governance and analytics.`,
    "QA Analyst": `Quality assurance considerations for this initiative require your professional assessment.`,
    "Infrastructure Engineer": `Technical infrastructure requirements for this request need your expert evaluation.`,
  };
  return roleInsights[specialistRole] || `This ${urgency} priority request requires your specialized expertise as a ${specialistRole}. Please review the demand details and provide your professional assessment.`;
}


export async function notifyCoveriaSpecialist(
  deps: Pick<DemandAllDeps, "reports" | "notifier">,
  reportId: string,
  data: {
    specialistEmail: string;
    specialistName?: string;
    specialistRole: string;
    coveriaInsight?: string;
  },
): Promise<DemandResult<{ notificationSent: boolean; message: string }>> {
  if (!data.specialistEmail || !data.specialistRole) {
    return { success: false, error: "Specialist email and role are required", status: 400 };
  }

  const report = await deps.reports.findById(reportId);
  if (!report) return { success: false, error: "Demand report not found", status: 404 };

  const insight = data.coveriaInsight || generateCoveriaInsight(report, data.specialistRole);

  const notificationSent = await deps.notifier.sendSpecialistNotification(
    data.specialistEmail,
    data.specialistName || "Specialist",
    data.specialistRole,
    report.businessObjective || "Digital Transformation Request",
    report.organizationName || "Organization",
    { urgency: report.urgency || "medium", insight, reportId },
  );

  if (notificationSent) {
    const existingNotifications = Array.isArray(report.notificationsSent) ? report.notificationsSent : [];
    const logEntry = deps.notifier.createNotificationLogEntry("coveria_specialist", data.specialistEmail, true);
    await deps.reports.update(reportId, { notificationsSent: [...existingNotifications, logEntry] });
  }

  return {
    success: true,
    data: {
      notificationSent,
      message: notificationSent
        ? `COREVIA has notified the ${data.specialistRole} successfully`
        : "Failed to send notification",
    },
  };
}
