import type { GatesDeps } from "./buildDeps";
import type { GovResult, PhaseOverviewItem } from "./shared";
import { logger } from "@platform/logging/Logger";
import { eventBus } from "@platform/events";


// ════════════════════════════════════════════════════════════════════
// GATES USE-CASES (12)
// ════════════════════════════════════════════════════════════════════

export async function getGateCatalog(
  deps: Pick<GatesDeps, "orchestrator">,
  phase?: string,
): Promise<GovResult> {
  const catalog = await deps.orchestrator.getGateCatalog(phase);
  return { success: true, data: catalog };
}


/** Seed the gate check catalog with 8 default governance criteria. */
export async function seedGateCatalog(
  deps: Pick<GatesDeps, "catalogWriter">,
): Promise<GovResult> {
  const defaultChecks: Record<string, unknown>[] = [
    { phase: 'initiation', category: 'governance', name: 'Project Manager Assigned', description: 'A qualified Project Manager must be assigned to lead the project.', isRequired: true, isCritical: true, weight: 15, autoVerify: true, verificationField: 'projectManager' },
    { phase: 'initiation', category: 'governance', name: 'Executive Sponsor Assigned', description: 'An Executive Sponsor must be designated to provide strategic oversight.', isRequired: true, isCritical: true, weight: 15, autoVerify: true, verificationField: 'sponsor' },
    { phase: 'initiation', category: 'financial', name: 'Financial Director Assigned', description: 'A Financial Director must be assigned for budget approval authority.', isRequired: true, isCritical: true, weight: 15, autoVerify: true, verificationField: 'financialDirector' },
    { phase: 'initiation', category: 'financial', name: 'Budget Approved', description: 'Project budget must be defined and approved.', isRequired: true, isCritical: true, weight: 20, autoVerify: true, verificationField: 'totalBudget' },
    { phase: 'initiation', category: 'approvals', name: 'Charter Fully Signed', description: 'Project Charter must be signed by all 3 signatories: Project Manager, Financial Director, and Executive Sponsor.', isRequired: true, isCritical: true, weight: 25, autoVerify: true, verificationField: 'charterStatus' },
    { phase: 'initiation', category: 'financial', name: 'Financial Director Signature', description: 'Financial Director has reviewed and signed the charter, confirming budget approval.', isRequired: true, isCritical: true, weight: 20, autoVerify: true, verificationField: 'charterSignatures.financial_director' },
    { phase: 'planning', category: 'documentation', name: 'WBS Defined', description: 'Work Breakdown Structure must be created with clear deliverables.', isRequired: true, isCritical: false, weight: 15, autoVerify: true, verificationField: 'wbsTasks' },
    { phase: 'planning', category: 'resources', name: 'Team Resources Allocated', description: 'Team members must be assigned to project tasks.', isRequired: true, isCritical: false, weight: 15, autoVerify: true, verificationField: 'wbsResourcesAssigned' },
  ];
  const inserted = await deps.catalogWriter.seedDefaultChecks(defaultChecks);
  return { success: true, data: { message: `Seeded ${inserted} gate check criteria including financial governance checks.` } };
}


export async function getPendingApprovals(
  deps: Pick<GatesDeps, "orchestrator">,
): Promise<GovResult> {
  const pending = await deps.orchestrator.getPendingApprovals();
  return { success: true, data: pending };
}


export async function getGateReadiness(
  deps: Pick<GatesDeps, "orchestrator">,
  projectId: string,
): Promise<GovResult> {
  const report = await deps.orchestrator.evaluateGateReadiness(projectId);
  return { success: true, data: report };
}


export async function getGateOverview(
  deps: Pick<GatesDeps, "orchestrator">,
  projectId: string,
): Promise<GovResult> {
  const overview = await deps.orchestrator.getGateOverview(projectId);

  // Debug logging for phase status
  logger.info(`[Gate Overview] Project ${projectId}: currentPhase=${overview.currentPhase}`);
  overview.phases.forEach((p) => {
    const phase = p as PhaseOverviewItem;
    logger.info(`[Gate Overview]   ${phase.phase}: status=${phase.status}, readiness=${phase.readinessScore}%`);
  });

  return { success: true, data: overview };
}


export async function getGateUnlockStatus(
  deps: Pick<GatesDeps, "orchestrator">,
  projectId: string,
): Promise<GovResult> {
  const status = await deps.orchestrator.getPhaseUnlockStatus(projectId);
  return { success: true, data: status };
}


export async function getProjectGate(
  deps: Pick<GatesDeps, "orchestrator">,
  projectId: string,
): Promise<GovResult> {
  const gate = await deps.orchestrator.getProjectGate(projectId);
  return { success: true, data: gate };
}


/**
 * Request gate approval — validates phase match and sends Coveria notification.
 */
export async function requestGateApproval(
  deps: Pick<GatesDeps, "orchestrator" | "project">,
  projectId: string,
  requestedPhase: string | undefined,
  userId: string | undefined,
): Promise<GovResult> {
  // Phase mismatch guard
  if (requestedPhase) {
    const currentGate = await deps.orchestrator.getProjectGate(projectId);
    if (currentGate && currentGate.currentPhase !== requestedPhase) {
      return {
        success: false,
        error: `Phase mismatch: requested ${requestedPhase} but current phase is ${currentGate.currentPhase}`,
        status: 400,
      };
    }
  }

  const result = await deps.orchestrator.requestGateApproval(projectId, userId);

  // Create Coveria notification on success
  if (result.success && userId) {
    try {
      const project = await deps.project.getProject(projectId);
      const gate = await deps.orchestrator.getProjectGate(projectId);
      if (project && gate) {
        const cp = gate.currentPhase ?? "";
        const phaseLabel = cp.charAt(0).toUpperCase() + cp.slice(1);
        const isResubmission = String(result.message ?? "").includes("resubmitted");
        await deps.project.createNotification({
          userId,
          title: isResubmission ? "Gate Resubmitted for Approval" : "Gate Approval Submitted",
          message: isResubmission
            ? `Splendid! Your ${phaseLabel} gate has been resubmitted to PMO for review. I'll notify you when there's an update.`
            : `Brilliant! Your ${phaseLabel} gate approval request has been submitted to PMO for review. I'll notify you when there's an update.`,
          type: "approval_needed",
        });
      }
    } catch (notifyError) {
      logger.warn("[Gate System] Failed to create notification:", notifyError);
    }
  }

  // Return the raw result — the route will forward it directly
  return { success: true, data: result };
}


/**
 * Process gate approval decision — notifies ALL stakeholders.
 */
export async function processGateApproval(
  deps: Pick<GatesDeps, "orchestrator" | "project">,
  projectId: string,
  body: { fromPhase: string; toPhase: string; decision: string; comments?: string; conditions?: unknown },
  approverId: string | undefined,
): Promise<GovResult> {
  const { fromPhase, toPhase, decision, comments, conditions } = body;

  if (!fromPhase || !toPhase || !decision) {
    return { success: false, error: "Missing required fields: fromPhase, toPhase, decision", status: 400 };
  }

  const result = await deps.orchestrator.processGateApproval({
    projectId,
    fromPhase,
    toPhase,
    decision,
    approverId,
    comments,
    conditions,
  });

  // Notify ALL stakeholders on success
  if (result.success) {
    const project = await deps.project.getProject(projectId);
    const phaseLabel = fromPhase.charAt(0).toUpperCase() + fromPhase.slice(1);
    const nextPhaseLabel = toPhase.charAt(0).toUpperCase() + toPhase.slice(1);

    if (project) {
      try {
        const stakeholderIds: string[] = [];

        if (project.projectManager && typeof project.projectManager === "string") stakeholderIds.push(project.projectManager);
        if (project.sponsor && typeof project.sponsor === "string") stakeholderIds.push(project.sponsor);
        if (project.financialDirector && typeof project.financialDirector === "string") stakeholderIds.push(project.financialDirector);
        if (approverId && !stakeholderIds.includes(approverId)) stakeholderIds.push(approverId);

        const projectStakeholders = await deps.project.getProjectStakeholders(projectId);
        if (Array.isArray(projectStakeholders)) {
          for (const s of projectStakeholders) {
            if (s.userId && typeof s.userId === "string" && !stakeholderIds.includes(s.userId)) {
              stakeholderIds.push(s.userId);
            }
          }
        }

        const superAdmins = await deps.project.getUsersByRole("super_admin");
        for (const admin of superAdmins) {
          if (admin?.id && !stakeholderIds.includes(admin.id)) stakeholderIds.push(admin.id);
        }

        logger.info(`[Coveria] Phase ${decision}: Notifying ${stakeholderIds.length} stakeholders for project ${project.projectName}`);

        for (const userId of stakeholderIds) {
          if (decision === "approved") {
            await deps.project.createNotification({
              userId,
              title: `Phase Completed: ${phaseLabel} Gate Approved`,
              message: `Splendid news! The ${phaseLabel} phase gate has been approved for "${project.projectName}". The project is now advancing to the ${nextPhaseLabel} phase.`,
              type: "insight",
              metadata: { coveriaMessage: true, projectId, phase: fromPhase, nextPhase: toPhase },
            });
          } else if (decision === "rejected") {
            await deps.project.createNotification({
              userId,
              title: `Gate Rejected: ${phaseLabel} Phase`,
              message: `I'm afraid the ${phaseLabel} gate for "${project.projectName}" has been rejected. ${comments ? `PMO feedback: "${comments}". ` : ""}The team can address the concerns and resubmit when ready.`,
              type: "deadline",
              metadata: { coveriaMessage: true, projectId, phase: fromPhase },
            });
          } else if (decision === "deferred") {
            await deps.project.createNotification({
              userId,
              title: `Gate Deferred: ${phaseLabel} Phase`,
              message: `The ${phaseLabel} gate decision for "${project.projectName}" has been deferred. ${comments ? `PMO notes: "${comments}". ` : ""}I'll keep monitoring and notify you when there's an update.`,
              type: "suggestion",
              metadata: { coveriaMessage: true, projectId, phase: fromPhase },
            });
          }
        }
      } catch (notifyError) {
        logger.warn("[Gate System] Failed to create stakeholder notifications:", notifyError);
      }
    }
  }

  // ── Emit domain event ──
  if (decision === "approved") {
    void eventBus.emit("governance.GateApproved", { projectId, gateName: fromPhase, phase: fromPhase }, { actorId: approverId ?? "system" });
  } else if (decision === "rejected") {
    void eventBus.emit("governance.GateRejected", { projectId, gateName: fromPhase, reason: comments ?? "" }, { actorId: approverId ?? "system" });
  }

  return { success: true, data: result };
}


export async function updateGateCheck(
  deps: Pick<GatesDeps, "orchestrator">,
  checkId: string,
  body: { status?: string; notes?: string; failureReason?: string },
  verifiedBy: string | undefined,
): Promise<GovResult> {
  const result = await deps.orchestrator.updateCheckResult(checkId, {
    status: body.status,
    notes: body.notes,
    failureReason: body.failureReason,
    verifiedBy,
  });

  void eventBus.emit("governance.GateCheckCompleted", { projectId: checkId, result: body.status || "unknown" }, { actorId: verifiedBy });

  return { success: true, data: result };
}


export async function getGateHistory(
  deps: Pick<GatesDeps, "orchestrator">,
  projectId: string,
): Promise<GovResult> {
  const history = await deps.orchestrator.getGateHistory(projectId);
  return { success: true, data: history };
}


export async function getGateAuditLog(
  deps: Pick<GatesDeps, "orchestrator">,
  projectId: string,
  limit: number,
): Promise<GovResult> {
  const audit = await deps.orchestrator.getAuditLog(projectId, limit);
  return { success: true, data: audit };
}
