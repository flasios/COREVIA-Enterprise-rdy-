import type { AnalyticsDeps } from "./buildDeps";
import type { IntelResult } from "./shared";


// ========================================================================
//  ANALYTICS USE-CASES
// ========================================================================

export async function getAnalyticsSummary(
  deps: Pick<AnalyticsDeps, "analytics">,
  days: number,
): Promise<IntelResult<unknown>> {
  const summary = await deps.analytics.getAnalyticsSummary(days);
  return { success: true, data: summary };
}


export async function getAnalyticsTrends(
  deps: Pick<AnalyticsDeps, "analytics">,
  metric: string,
  days: number,
): Promise<IntelResult<unknown>> {
  const trends = await deps.analytics.getTrends(metric, days);
  return { success: true, data: trends };
}


export async function getTopDocuments(
  deps: Pick<AnalyticsDeps, "analytics">,
  sortBy: string,
  limit: number,
): Promise<IntelResult<unknown>> {
  const documents = await deps.analytics.getTopDocuments(sortBy, limit);
  return { success: true, data: documents };
}


export async function detectKnowledgeGaps(
  deps: Pick<AnalyticsDeps, "analytics">,
  limit: number,
): Promise<IntelResult<unknown>> {
  const gaps = await deps.analytics.detectKnowledgeGaps(limit);
  return { success: true, data: gaps };
}


export async function calculateROI(
  deps: Pick<AnalyticsDeps, "analytics">,
  days: number,
  hourlyRate: number,
): Promise<IntelResult<unknown>> {
  const roi = await deps.analytics.calculateROI(days, hourlyRate);
  return { success: true, data: roi };
}


export async function refreshAnalytics(
  deps: Pick<AnalyticsDeps, "analytics">,
): Promise<IntelResult<unknown>> {
  const result = await deps.analytics.refreshAnalytics();
  return { success: true, data: result };
}


export async function getPortfolioHealth(
  deps: Pick<AnalyticsDeps, "portfolio" | "storage">,
): Promise<IntelResult<unknown>> {
  const health = await deps.portfolio.getPortfolioHealth(deps.storage);
  return { success: true, data: health };
}


export async function getDemandForecast(
  deps: Pick<AnalyticsDeps, "portfolio" | "storage">,
): Promise<IntelResult<unknown>> {
  const forecast = await deps.portfolio.getDemandForecast(deps.storage);
  return { success: true, data: forecast };
}


export async function runMonteCarloSimulation(
  deps: Pick<AnalyticsDeps, "portfolio" | "storage">,
  constraints: Record<string, unknown>,
): Promise<IntelResult<unknown>> {
  const simulation = await deps.portfolio.runMonteCarloSimulation(deps.storage, constraints);
  return { success: true, data: simulation };
}


export async function getIntegrationStatus(
  deps: Pick<AnalyticsDeps, "portfolio" | "storage">,
): Promise<IntelResult<unknown>> {
  const status = await deps.portfolio.getIntegrationStatus(deps.storage);
  return { success: true, data: status };
}


export async function getDemandPlanService(
  deps: Pick<AnalyticsDeps, "portfolio" | "storage">,
): Promise<IntelResult<unknown>> {
  const plan = await deps.portfolio.getDemandPlanService(deps.storage);
  return { success: true, data: plan };
}
