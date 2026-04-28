/**
 * Intelligence — Proactive-Intelligence adapter
 */
import type { ProactiveIntelligencePort, WorkflowStepDto } from "../domain/ports";
import { proactiveIntelligence } from "./proactiveIntelligenceService";

export class LegacyProactiveIntelligence implements ProactiveIntelligencePort {
  private get svc() {
    return proactiveIntelligence;
  }

  async getProactiveInsights(): Promise<unknown> {
    return this.svc.getProactiveInsights();
  }

  async generateNotifications(userId: string): Promise<unknown> {
    return this.svc.generateNotifications(userId);
  }

  async detectAnomalies(): Promise<unknown> {
    return this.svc.detectAnomalies();
  }

  async calculateRiskScores(): Promise<unknown> {
    return this.svc.calculateRiskScores();
  }

  async generateDailyBriefing(): Promise<unknown> {
    return this.svc.generateDailyBriefing();
  }

  async executeWorkflowChain(steps: WorkflowStepDto[], userId: string): Promise<unknown> {
    return this.svc.executeWorkflowChain(
      steps as unknown as Array<{ action: string; params: Record<string, unknown> }>,
      userId,
    );
  }

  async createAutomaticAlerts(userId: string): Promise<unknown> {
    return this.svc.createAutomaticAlerts(userId);
  }
}
