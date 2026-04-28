/**
 * Intelligence — Coveria Intelligence adapter
 */
import type { CoveriaIntelligencePort } from "../domain/ports";
import { coveriaIntelligence } from "./coveriaIntelligenceService";

export class LegacyCoveriaIntelligence implements CoveriaIntelligencePort {
  private get svc() {
    return coveriaIntelligence;
  }

  async recordInteraction(
    userInput: string,
    coveriaResponse: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    await this.svc.recordInteraction(userInput, coveriaResponse, meta);
  }

  async getIntelligenceState() {
    return this.svc.getIntelligenceState();
  }

  async getPendingInsightsForUser(userId: string) {
    return this.svc.getPendingInsightsForUser(userId);
  }

  async dismissInsightForUser(insightId: string, userId: string): Promise<boolean> {
    return this.svc.dismissInsightForUser(insightId, userId);
  }

  async generateDailyBriefing(userId: string) {
    return this.svc.generateDailyBriefing(userId);
  }

  getResponsePrefix(data: Record<string, unknown>): string {
    return this.svc.getResponsePrefix(data);
  }
}
