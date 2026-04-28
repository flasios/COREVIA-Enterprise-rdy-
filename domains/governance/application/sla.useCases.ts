import type { TenderDeps } from "./buildDeps";
import type { GovResult } from "./shared";


// ── SLA management ────────────────────────────────────────────────

export async function listSlaRules(
  deps: Pick<TenderDeps, "storage">,
): Promise<GovResult> {
  const rules = await deps.storage.getTenderSlaRules();
  return { success: true, data: rules };
}


export async function createSlaRule(
  deps: Pick<TenderDeps, "storage">,
  body: Record<string, unknown>,
): Promise<GovResult> {
  const rule = await deps.storage.createTenderSlaRule(body);
  return { success: true, data: rule };
}


export async function getSlaMetrics(
  deps: Pick<TenderDeps, "storage">,
): Promise<GovResult> {
  const metrics = await deps.storage.getTenderSlaMetrics();
  return { success: true, data: metrics };
}


export async function getSlaDeadlines(
  deps: Pick<TenderDeps, "storage">,
  days: number,
): Promise<GovResult> {
  const deadlines = await deps.storage.getUpcomingDeadlines(days);
  return { success: true, data: deadlines };
}


export async function getSlaAssignment(
  deps: Pick<TenderDeps, "storage">,
  tenderId: string,
): Promise<GovResult> {
  const assignment = await deps.storage.getTenderSlaAssignment(tenderId);
  return { success: true, data: assignment || null };
}


/**
 * Create SLA assignment — computes deadlines from rule hours.
 */
export async function createSlaAssignment(
  deps: Pick<TenderDeps, "storage">,
  tenderId: string,
  body: { ruleId?: string; tenderType?: string },
): Promise<GovResult> {
  const { ruleId, tenderType } = body;

  const rule = ruleId
    ? await deps.storage.getTenderSlaRuleById(ruleId)
    : await deps.storage.getTenderSlaRuleByType(tenderType || "standard");

  if (!rule) return { success: false, error: "No SLA rule found for this tender type", status: 400 };

  const now = new Date();
  const submissionDeadline = new Date(now.getTime() + rule.submissionDeadlineHours * 60 * 60 * 1000);
  const reviewDeadline = new Date(submissionDeadline.getTime() + rule.reviewDeadlineHours * 60 * 60 * 1000);
  const approvalDeadline = new Date(reviewDeadline.getTime() + rule.approvalDeadlineHours * 60 * 60 * 1000);

  const assignment = await deps.storage.createTenderSlaAssignment({
    tenderId,
    ruleId: rule.id,
    currentPhase: "draft",
    status: "on_track",
    submissionDeadline,
    reviewDeadline,
    approvalDeadline,
  });

  return { success: true, data: assignment };
}
