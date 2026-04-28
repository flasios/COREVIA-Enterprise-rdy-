/**
 * Knowledge Module — LegacyBriefingService
 * Wraps the singleton briefingService behind the BriefingServicePort.
 */
import type { ExecutiveBriefing } from "@shared/schema";
import type { BriefingServicePort } from "../domain/ports";
import { briefingService } from "./briefing";

export class LegacyBriefingService implements BriefingServicePort {
  async listBriefings(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return briefingService.listBriefings(params) as unknown as Record<string, unknown>;
  }
  async createBriefing(title: string, briefingType: string, scope: Record<string, unknown>, userId: string, customTopic?: string): Promise<ExecutiveBriefing> {
    return briefingService.createBriefing(title, briefingType as "custom" | "weekly_digest" | "topic_deep_dive" | "trend_analysis" | "gap_assessment", scope, userId, customTopic) as unknown as ExecutiveBriefing;
  }
  async getBriefingById(id: string): Promise<ExecutiveBriefing | null> {
    return briefingService.getBriefingById(id) as unknown as ExecutiveBriefing | null;
  }
  async publishBriefing(id: string): Promise<ExecutiveBriefing> {
    return briefingService.publishBriefing(id) as unknown as ExecutiveBriefing;
  }
  async archiveBriefing(id: string): Promise<ExecutiveBriefing> {
    return briefingService.archiveBriefing(id) as unknown as ExecutiveBriefing;
  }
  async deleteBriefing(id: string) {
    return briefingService.deleteBriefing(id);
  }
  async generateWeeklyDigest(userId: string): Promise<ExecutiveBriefing> {
    return briefingService.generateWeeklyDigest(userId) as unknown as ExecutiveBriefing;
  }
}
