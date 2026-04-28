import type { WorkflowStepDto } from "../domain/ports";
import type { ProactiveDeps } from "./buildDeps";
import type { IntelResult } from "./shared";


// ========================================================================
//  PROACTIVE INTELLIGENCE USE-CASES
// ========================================================================

export async function detectAnomalies(
  deps: Pick<ProactiveDeps, "proactive">,
): Promise<IntelResult<unknown>> {
  const anomalies = await deps.proactive.detectAnomalies();
  return { success: true, data: anomalies };
}


export async function calculateRiskPredictions(
  deps: Pick<ProactiveDeps, "proactive">,
): Promise<IntelResult<unknown>> {
  const predictions = await deps.proactive.calculateRiskScores();
  return { success: true, data: predictions };
}


export async function generateDailyBriefing(
  deps: Pick<ProactiveDeps, "proactive">,
): Promise<IntelResult<unknown>> {
  const briefing = await deps.proactive.generateDailyBriefing();
  return { success: true, data: briefing };
}


export async function executeWorkflow(
  deps: Pick<ProactiveDeps, "proactive">,
  steps: unknown,
  userId: string,
): Promise<IntelResult<unknown>> {
  if (!steps || !Array.isArray(steps)) {
    return { success: false, error: "Workflow steps are required", status: 400 };
  }
  const result = await deps.proactive.executeWorkflowChain(steps as WorkflowStepDto[], userId);
  return { success: true, data: result };
}


export async function createAutoAlerts(
  deps: Pick<ProactiveDeps, "proactive">,
  userId: string,
): Promise<IntelResult<{ alertsCreated: unknown }>> {
  const alertsCreated = await deps.proactive.createAutomaticAlerts(userId);
  return { success: true, data: { alertsCreated } };
}
