/**
 * Intelligence — Analytics Service adapter
 */
import type { AnalyticsServicePort, PortfolioAnalyticsPort } from "../domain/ports";
import type { AIAssistantStorageSlice } from "../application/buildDeps";
import { createAnalyticsService } from "./analyticsService";
import * as legacyAnalytics from "./legacy-analytics";

export class LegacyAnalyticsService implements AnalyticsServicePort {
  private svc: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  constructor(storage: AIAssistantStorageSlice) {
    this.svc = createAnalyticsService(storage);
  }

  async getAnalyticsSummary(days: number) { return this.svc.getAnalyticsSummary(days); }
  async getTrends(metric: string, days: number) { return this.svc.getTrends(metric, days); }
  async getTopDocuments(sortBy: string, limit: number) { return this.svc.getTopDocuments(sortBy, limit); }
  async detectKnowledgeGaps(limit: number) { return this.svc.detectKnowledgeGaps(limit); }
  async calculateROI(days: number, hourlyRate: number) { return this.svc.calculateROI(days, hourlyRate); }
  async refreshAnalytics() { return this.svc.refreshAnalytics(); }
}

export class LegacyPortfolioAnalytics implements PortfolioAnalyticsPort {
  async getPortfolioHealth(storage: unknown) {
    return legacyAnalytics.getPortfolioHealth(storage as Parameters<typeof legacyAnalytics.getPortfolioHealth>[0]);
  }
  async getDemandForecast(storage: unknown) {
    return legacyAnalytics.getDemandForecast(storage as Parameters<typeof legacyAnalytics.getDemandForecast>[0]);
  }
  async runMonteCarloSimulation(storage: unknown, constraints: Record<string, unknown>) {
    return legacyAnalytics.runMonteCarloSimulation(
      storage as Parameters<typeof legacyAnalytics.runMonteCarloSimulation>[0],
      constraints as Parameters<typeof legacyAnalytics.runMonteCarloSimulation>[1],
    );
  }
  async getIntegrationStatus(storage: unknown) {
    return legacyAnalytics.getIntegrationStatus(storage as Parameters<typeof legacyAnalytics.getIntegrationStatus>[0]);
  }
  async getDemandPlanService(storage: unknown) {
    return legacyAnalytics.getDemandPlanService(storage as Parameters<typeof legacyAnalytics.getDemandPlanService>[0]);
  }
}
