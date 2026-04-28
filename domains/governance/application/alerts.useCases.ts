import type { TenderDeps } from "./buildDeps";
import type { GovResult } from "./shared";
import type { InsertTenderAlert, InsertTenderNotification, InsertTenderSlaAssignment } from "@shared/schema";
import { logger } from "@platform/logging/Logger";


// ── Alerts ────────────────────────────────────────────────────────

export async function getAlerts(
  deps: Pick<TenderDeps, "storage">,
  filters: { tenderId?: string; status?: string; severity?: string },
): Promise<GovResult> {
  const alerts = await deps.storage.getTenderAlerts(filters);
  return { success: true, data: alerts };
}


export async function resolveAlert(
  deps: Pick<TenderDeps, "storage">,
  alertId: string,
  userId: string,
  resolution: string,
): Promise<GovResult> {
  await deps.storage.resolveTenderAlert(alertId, userId, resolution);
  return { success: true, data: null };
}


/**
 * Check and create escalation alerts for SLA breaches / at-risk deadlines.
 */
export async function checkEscalations(
  deps: Pick<TenderDeps, "storage">,
): Promise<GovResult> {
  const now = new Date();
  const warningThresholdHours = 24;

  const pendingAssignments = await deps.storage.getSlaAssignmentsByStatus("on_track");
  const atRiskAssignments = await deps.storage.getSlaAssignmentsByStatus("at_risk");
  const allAssignments = [...pendingAssignments, ...atRiskAssignments];
  const alertsCreated: unknown[] = [];

  for (const assignment of allAssignments) {
    const submissionDeadline = assignment.submissionDeadline ? new Date(assignment.submissionDeadline as string) : null;
    const reviewDeadline = assignment.reviewDeadline ? new Date(assignment.reviewDeadline as string) : null;

    // Check submission deadline
    if (assignment.currentPhase === "draft" && submissionDeadline) {
      const hoursUntil = (submissionDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);
      const tid = assignment.tenderId as string;
      const aid = assignment.id as string;

      if (hoursUntil <= 0) {
        const alert = await deps.storage.createTenderAlert({ tenderId: tid, slaAssignmentId: aid, alertType: "deadline_missed", phase: "draft", severity: "critical", title: "Submission Deadline Breached", description: "The submission deadline for this tender has been exceeded. Immediate action required.", status: "active" } as Partial<InsertTenderAlert>);
        alertsCreated.push(alert);
        await deps.storage.createTenderNotification({ tenderId: tid, recipientRole: "director", type: "escalation_deadline_breach", title: "URGENT: RFP Submission Deadline Breached", message: "Escalation: The submission deadline has been exceeded. Please review immediately.", priority: "urgent", metadata: { alertType: "deadline_breached", phase: "submission" } } as Partial<InsertTenderNotification>);
        await deps.storage.updateTenderSlaAssignment(aid, { status: "breached" } as Partial<InsertTenderSlaAssignment>);
      } else if (hoursUntil <= warningThresholdHours && assignment.status !== "at_risk") {
        const alert = await deps.storage.createTenderAlert({ tenderId: tid, slaAssignmentId: aid, alertType: "sla_at_risk", phase: "draft", severity: "warning", title: "Submission Deadline Approaching", description: `The submission deadline is in ${Math.round(hoursUntil)} hours. Please expedite review.`, status: "active" } as Partial<InsertTenderAlert>);
        alertsCreated.push(alert);
        await deps.storage.createTenderNotification({ tenderId: tid, recipientRole: "demand_manager", type: "deadline_reminder", title: "Submission Deadline Approaching", message: `Reminder: Only ${Math.round(hoursUntil)} hours until submission deadline.`, priority: "high" } as Partial<InsertTenderNotification>);
        await deps.storage.updateTenderSlaAssignment(aid, { status: "at_risk" } as Partial<InsertTenderSlaAssignment>);
      }
    }

    // Check review deadline
    if (assignment.currentPhase === "review" && reviewDeadline) {
      const hoursUntil = (reviewDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);
      const tid = assignment.tenderId as string;
      const aid = assignment.id as string;

      if (hoursUntil <= 0) {
        const alert = await deps.storage.createTenderAlert({ tenderId: tid, slaAssignmentId: aid, alertType: "deadline_missed", phase: "review", severity: "critical", title: "Review Deadline Breached", description: "The review deadline has been exceeded. Escalating to management.", status: "active" } as Partial<InsertTenderAlert>);
        alertsCreated.push(alert);
        await deps.storage.createTenderNotification({ tenderId: tid, recipientRole: "director", type: "escalation_deadline_breach", title: "URGENT: RFP Review Deadline Breached", message: "Escalation: Review deadline exceeded. Immediate attention required.", priority: "urgent" } as Partial<InsertTenderNotification>);
        await deps.storage.updateTenderSlaAssignment(aid, { status: "breached" } as Partial<InsertTenderSlaAssignment>);
      } else if (hoursUntil <= warningThresholdHours && assignment.status !== "at_risk") {
        const alert = await deps.storage.createTenderAlert({ tenderId: tid, slaAssignmentId: aid, alertType: "sla_at_risk", phase: "review", severity: "warning", title: "Review Deadline Approaching", description: `The review deadline is in ${Math.round(hoursUntil)} hours.`, status: "active" } as Partial<InsertTenderAlert>);
        alertsCreated.push(alert);
        await deps.storage.createTenderNotification({ tenderId: tid, recipientRole: "procurement_officer", type: "deadline_reminder", title: "Review Deadline Approaching", message: `Only ${Math.round(hoursUntil)} hours until review deadline.`, priority: "high" } as Partial<InsertTenderNotification>);
        await deps.storage.updateTenderSlaAssignment(aid, { status: "at_risk" } as Partial<InsertTenderSlaAssignment>);
      }
    }
  }

  logger.info(`[Escalation Check] Processed ${allAssignments.length} assignments, created ${alertsCreated.length} alerts`);
  return { success: true, data: { processedCount: allAssignments.length, alertsCreated: alertsCreated.length } };
}


export async function getEscalationStatus(
  deps: Pick<TenderDeps, "storage">,
): Promise<GovResult> {
  const metrics = await deps.storage.getTenderSlaMetrics();
  const upcomingDeadlines = await deps.storage.getUpcomingDeadlines(3);
  const activeAlerts = await deps.storage.getTenderAlerts({ status: "active" });

  return {
    success: true,
    data: {
      metrics,
      upcomingDeadlinesCount: upcomingDeadlines.length,
      upcomingDeadlines: upcomingDeadlines.slice(0, 5),
      activeAlertsCount: activeAlerts.length,
      criticalAlerts: activeAlerts.filter((a) => (a as Record<string, unknown>).severity === "critical").length,
      warningAlerts: activeAlerts.filter((a) => (a as Record<string, unknown>).severity === "warning").length,
    },
  };
}
