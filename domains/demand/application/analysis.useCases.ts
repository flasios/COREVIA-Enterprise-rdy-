import { DemandDeps, DemandResult } from "./shared";


// ── Analysis Use-Cases ─────────────────────────────────────────────

export async function generateDemandFields(
  deps: Pick<DemandDeps, "analysis">,
  objective: string,
  context?: Record<string, unknown>,
): Promise<DemandResult<Record<string, unknown>>> {
  const result = await deps.analysis.generateFields(objective, context);
  return { success: true, data: result };
}


export async function enhanceDemandObjective(
  deps: Pick<DemandDeps, "analysis">,
  objective: string,
): Promise<DemandResult<{ enhanced: string }>> {
  const enhanced = await deps.analysis.enhanceObjective(objective);
  return { success: true, data: { enhanced } };
}


export async function classifyDemandRequest(
  deps: Pick<DemandDeps, "analysis">,
  objective: string,
  context?: Record<string, unknown>,
): Promise<DemandResult<Record<string, unknown>>> {
  const classification = await deps.analysis.classifyRequest(objective, context);
  return { success: true, data: classification };
}


export async function runComprehensiveAnalysis(
  deps: Pick<DemandDeps, "analysis">,
  data: Record<string, unknown>,
): Promise<DemandResult<Record<string, unknown>>> {
  const result = await deps.analysis.runComprehensiveAnalysis(data);
  return { success: true, data: result };
}
