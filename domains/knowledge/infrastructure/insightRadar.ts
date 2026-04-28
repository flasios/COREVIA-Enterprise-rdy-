/**
 * Knowledge Module — LegacyInsightRadar
 * Wraps the singleton insightRadarService behind the InsightRadarPort.
 */
import type { InsightEvent, InsightRule } from "@shared/schema";
import type { InsightRadarPort } from "../domain/ports";
import { insightRadarService } from "./insightRadarService";

export class LegacyInsightRadar implements InsightRadarPort {
  async getDashboard(): Promise<Record<string, unknown>> { return insightRadarService.getDashboard() as unknown as Record<string, unknown>; }
  async getActiveAlerts(params: Record<string, unknown>): Promise<Record<string, unknown>> { return insightRadarService.getActiveAlerts(params) as unknown as Record<string, unknown>; }
  async listEvents(params: Record<string, unknown>): Promise<Record<string, unknown>> { return insightRadarService.listEvents(params) as unknown as Record<string, unknown>; }
  async getEventById(eventId: string): Promise<InsightEvent | null> { return insightRadarService.getEventById(eventId) as unknown as InsightEvent | null; }
  async acknowledgeEvent(eventId: string, userId: string): Promise<InsightEvent> { return insightRadarService.acknowledgeEvent(eventId, userId) as unknown as InsightEvent; }
  async resolveEvent(eventId: string, userId: string, notes: string): Promise<InsightEvent> { return insightRadarService.resolveEvent(eventId, userId, notes) as unknown as InsightEvent; }
  async dismissEvent(eventId: string, userId: string, reason: string): Promise<InsightEvent> { return insightRadarService.dismissEvent(eventId, userId, reason) as unknown as InsightEvent; }
  async runGapDetection(userId: string): Promise<Record<string, unknown>> { return insightRadarService.runGapDetection(userId) as unknown as Record<string, unknown>; }
  async generateProactiveInsights(): Promise<Array<Record<string, unknown>>> { return insightRadarService.generateProactiveInsights() as unknown as Array<Record<string, unknown>>; }
  async saveInsightsAsEvents(insights: Array<Record<string, unknown>>): Promise<InsightEvent[]> {
    return (insightRadarService.saveInsightsAsEvents as (i: unknown[]) => Promise<unknown[]>)(insights) as unknown as InsightEvent[];
  }
  async getActiveRules(): Promise<InsightRule[]> { return insightRadarService.getActiveRules() as unknown as InsightRule[]; }
  async createRule(data: Record<string, unknown>): Promise<InsightRule> {
    return (insightRadarService.createRule as (d: Record<string, unknown>) => Promise<unknown>)(data) as unknown as InsightRule;
  }
  async evaluateRule(ruleId: string): Promise<InsightEvent[]> { return insightRadarService.evaluateRule(ruleId) as unknown as InsightEvent[]; }
  async toggleRule(ruleId: string, isActive: boolean): Promise<InsightRule> { return insightRadarService.toggleRule(ruleId, isActive) as unknown as InsightRule; }
  async deleteRule(ruleId: string) { return insightRadarService.deleteRule(ruleId); }
}
