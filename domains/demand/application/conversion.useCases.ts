import type {
  DemandConversionRequest,
  ConversionStats,
  SubmitConversionData,
} from "../domain";
import { computeConversionStats, canSubmitForConversion } from "../domain";
import { DemandDeps, DemandResult } from "./shared";
import { logger } from "@platform/logging/Logger";
import { WORKSPACE_PATHS, type WorkspacePath } from "@shared/schema/portfolio";
import { eventBus } from "@platform/events";


// ── Conversion Use-Cases ───────────────────────────────────────────

export async function getConversionStats(
  deps: Pick<DemandDeps, "conversions">,
): Promise<DemandResult<ConversionStats>> {
  const all = await deps.conversions.findAll();
  return { success: true, data: computeConversionStats(all) };
}


export async function submitForConversion(
  deps: Pick<DemandDeps, "reports" | "conversions">,
  demandId: string,
  requestedBy: string,
  notes?: string,
): Promise<DemandResult<DemandConversionRequest>> {
  const report = await deps.reports.findById(demandId);
  if (!report) {
    return { success: false, error: "Demand report not found", status: 404 };
  }

  if (!canSubmitForConversion(report)) {
    return { success: false, error: "Report must be approved before conversion", status: 400 };
  }

  const existing = await deps.conversions.findByDemandId(demandId);
  if (existing) {
    return { success: false, error: "Conversion request already exists", status: 409 };
  }

  const request = await deps.conversions.create({ demandId, requestedBy, notes });
  return { success: true, data: request };
}


// ── Extended Conversion Use-Cases ──────────────────────────────────

export async function listConversionRequests(
  deps: Pick<DemandDeps, "conversions">,
  status?: string,
): Promise<DemandResult<DemandConversionRequest[]>> {
  const requests = status
    ? await deps.conversions.findByStatus(status)
    : await deps.conversions.findAll();
  return { success: true, data: requests };
}


export async function getConversionRequest(
  deps: Pick<DemandDeps, "conversions">,
  id: string,
): Promise<DemandResult<DemandConversionRequest>> {
  const request = await deps.conversions.findById(id);
  if (!request) {
    return { success: false, error: "Conversion request not found", status: 404 };
  }
  return { success: true, data: request };
}


export async function createConversionRequest(
  deps: Pick<DemandDeps, "reports" | "conversions" | "notifications">,
  input: {
    demandId: string;
    projectName?: string;
    projectDescription?: string;
    priority?: string;
    proposedBudget?: number;
    proposedStartDate?: string;
    proposedEndDate?: string;
    conversionData?: Record<string, unknown>;
    userId?: string;
    userDisplayName?: string;
    userName?: string;
  },
): Promise<DemandResult<DemandConversionRequest>> {
  const demand = await deps.reports.findById(input.demandId);
  if (!demand) {
    return { success: false, error: "Demand report not found", status: 404 };
  }

  if (!canSubmitForConversion(demand)) {
    return {
      success: false,
      error: "Demand must be approved before it can be converted to a project",
      status: 400,
    };
  }

  const existing = await deps.conversions.findByDemandId(input.demandId);
  if (existing && existing.status === "pending") {
    return { success: false, error: "A conversion request is already pending for this demand", status: 400 };
  }

  const resolvedProjectName = input.projectName || demand.businessObjective;
  if (!resolvedProjectName) {
    return { success: false, error: "Project name is required to convert a demand to a project", status: 400 };
  }

  const submitData: SubmitConversionData = {
    demandId: input.demandId,
    decisionSpineId: demand.decisionSpineId as string | undefined,
    projectName: resolvedProjectName,
    projectDescription: input.projectDescription || (demand.expectedOutcomes as string | undefined),
    priority: input.priority || "medium",
    proposedBudget: input.proposedBudget?.toString(),
    proposedStartDate: input.proposedStartDate,
    proposedEndDate: input.proposedEndDate,
    requestedBy: input.userId,
    requestedByName: input.userDisplayName || input.userName || null,
    status: "pending",
    conversionData: input.conversionData || {},
  };

  const request = await deps.conversions.createFull(submitData);

  await deps.reports.update(input.demandId, { workflowStatus: "pending_conversion" });

  // Fire notifications (non-blocking)
  if (deps.notifications) {
    deps.notifications.notifyApprovers(input.userId, {
      type: "approval_required",
      title: "Project Conversion Request",
      message: `New project conversion request: "${resolvedProjectName}" requires your approval.`,
      metadata: {
        entityType: "demand_conversion",
        entityId: request.id,
        projectName: resolvedProjectName,
        requestedBy: input.userDisplayName || input.userName || null,
        priority: input.priority || "medium",
        link: "/pmo-office",
      },
    }).catch((err: unknown) => logger.error("Notification error:", err));
  }

  return { success: true, data: request };
}


export async function approveConversionRequest(
  deps: Pick<DemandDeps, "reports" | "conversions" | "projects">,
  id: string,
  reviewer: { userId?: string; displayName?: string; userName?: string },
  decisionNotes?: string,
): Promise<DemandResult<{ request: DemandConversionRequest; project: Record<string, unknown> }>> {
  const request = await deps.conversions.findById(id);
  if (!request) {
    return { success: false, error: "Conversion request not found", status: 404 };
  }

  const reqRecord = request as unknown as Record<string, unknown>;
  if (request.status !== "pending" && request.status !== "under_review") {
    return { success: false, error: "Only pending or under_review requests can be approved", status: 400 };
  }

  const demand = await deps.reports.findById(request.demandId);
  if (!demand) {
    return { success: false, error: "Original demand not found", status: 404 };
  }

  const timestamp = Date.now().toString(36).toUpperCase();
  const projectCode = `PRJ-${new Date().getFullYear()}-${timestamp}`;

  const extractWorkspacePath = (rec: Record<string, unknown>): string => {
    const candidates: unknown[] = [
      rec?.conversionData,
      rec?.conversion_data,
    ];
    for (const c of candidates) {
      if (!c) continue;
      if (typeof c === "string") {
        try {
          const parsed = JSON.parse(c) as Record<string, unknown>;
          const v = typeof parsed?.workspacePath === "string" ? parsed.workspacePath : "";
          if (v) return v;
        } catch {
          // ignore
        }
      }
      if (typeof c === "object") {
        const obj = c as Record<string, unknown>;
        const v = typeof obj?.workspacePath === "string" ? obj.workspacePath : "";
        if (v) return v;
      }
    }
    return "";
  };

  const requestedWorkspacePath = extractWorkspacePath(reqRecord);
  const workspacePath: WorkspacePath = (WORKSPACE_PATHS as readonly string[]).includes(requestedWorkspacePath)
    ? (requestedWorkspacePath as WorkspacePath)
    : "standard";

  if (!deps.projects) {
    return { success: false, error: "Portfolio project creator not configured", status: 500 };
  }

  const project = await deps.projects.createProject({
    demandReportId: request.demandId,
    decisionSpineId: demand.decisionSpineId as string | undefined,
    projectCode,
    projectName: reqRecord.projectName as string,
    projectDescription: (reqRecord.projectDescription as string) || "",
    projectType: "transformation",
    priority: ((reqRecord.priority as string) || "medium") as "critical" | "high" | "medium" | "low",
    workspacePath,
    currentPhase: "intake",
    healthStatus: "on_track",
    approvedBudget: reqRecord.proposedBudget as string | undefined,
    plannedStartDate: reqRecord.proposedStartDate as string | undefined,
    plannedEndDate: reqRecord.proposedEndDate as string | undefined,
    createdBy: reviewer.userId || "system",
  });

  const updatedRequest = await deps.conversions.update(id, {
    status: "approved",
    reviewedBy: reviewer.userId as unknown as string,
    reviewedAt: new Date(),
    reviewedByName: reviewer.displayName || reviewer.userName,
    decisionNotes,
    createdProjectId: project.id,
  } as Partial<DemandConversionRequest>);

  await deps.reports.update(request.demandId, { workflowStatus: "converted" });

  // ── Emit domain events ──────────────────────────────────────────
  const demandId = request.demandId;
  const meta = { actorId: reviewer.userId };
  void eventBus.emit("demand.ConversionApproved", { demandReportId: demandId, projectId: project.id }, meta);
  void eventBus.emit("portfolio.ProjectCreated", { projectId: project.id, demandReportId: demandId }, meta);

  return { success: true, data: { request: updatedRequest!, project } };
}


export async function rejectConversionRequest(
  deps: Pick<DemandDeps, "reports" | "conversions">,
  id: string,
  reviewer: { userId?: string; displayName?: string; userName?: string },
  rejectionReason?: string,
  decisionNotes?: string,
): Promise<DemandResult<DemandConversionRequest>> {
  const request = await deps.conversions.findById(id);
  if (!request) {
    return { success: false, error: "Conversion request not found", status: 404 };
  }

  if (request.status !== "pending" && request.status !== "under_review") {
    return { success: false, error: "Only pending or under_review requests can be rejected", status: 400 };
  }

  const updatedRequest = await deps.conversions.update(id, {
    status: "rejected",
    reviewedBy: reviewer.userId as unknown as string,
    reviewedAt: new Date(),
    reviewedByName: reviewer.displayName || reviewer.userName,
    rejectionReason: rejectionReason || "No reason provided",
    decisionNotes,
  } as Partial<DemandConversionRequest>);

  await deps.reports.update(request.demandId, { workflowStatus: "approved" });

  return { success: true, data: updatedRequest! };
}
