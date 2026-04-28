import { db } from "@platform/db";
import { logger } from "@platform/logging/Logger";
import { aiNotifications } from "@shared/schema";
import { brainEvents } from "@shared/schemas/corevia/tables";
import { and, desc, eq, sql } from "drizzle-orm";

export interface InsightData {
  id: string;
  message: string;
  type: string;
  userId?: string;
  createdAt: string;
  dismissed: boolean;
}

export class CoveriaIntelligenceService {
  private interactionCount = 0;

  async recordInteraction(
    userInput: string,
    coveriaResponse: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    this.interactionCount++;
    try {
      await db.insert(brainEvents).values({
        correlationId: null,
        decisionSpineId: null,
        eventType: "coveria_interaction",
        actorId: (metadata?.userId as string) || undefined,
        payload: {
          userInput: userInput.substring(0, 500),
          responseLength: coveriaResponse.length,
          metadata: metadata || {},
          recordedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      logger.error("[CoveriaIntelligence] Failed to record interaction:", err);
    }
  }

  async getIntelligenceState(): Promise<Record<string, unknown>> {
    try {
      const [interactionCount] = await db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(brainEvents)
        .where(eq(brainEvents.eventType, "coveria_interaction"));

      const [pendingCount] = await db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(aiNotifications)
        .where(and(eq(aiNotifications.type, "insight"), eq(aiNotifications.isRead, false)));

      return {
        isActive: true,
        totalInteractions: interactionCount?.count ?? this.interactionCount,
        insightsPending: pendingCount?.count ?? 0,
        lastUpdated: new Date().toISOString(),
      };
    } catch {
      return {
        isActive: true,
        totalInteractions: this.interactionCount,
        insightsPending: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  async getPendingInsightsForUser(userId: string): Promise<InsightData[]> {
    try {
      const notifications = await db
        .select()
        .from(aiNotifications)
        .where(
          and(
            eq(aiNotifications.userId, userId),
            eq(aiNotifications.type, "insight"),
            eq(aiNotifications.isRead, false),
            eq(aiNotifications.isDismissed, false),
          ),
        )
        .orderBy(desc(aiNotifications.createdAt))
        .limit(20);

      return notifications.map((notification) => ({
        id: String(notification.id),
        message: notification.message,
        type: notification.relatedType || "insight",
        userId: notification.userId,
        createdAt: notification.createdAt?.toISOString() || new Date().toISOString(),
        dismissed: notification.isDismissed ?? false,
      }));
    } catch (err) {
      logger.error("[CoveriaIntelligence] Failed to fetch insights:", err);
      return [];
    }
  }

  async dismissInsightForUser(insightId: string, _userId: string): Promise<boolean> {
    try {
      const [updated] = await db
        .update(aiNotifications)
        .set({ isDismissed: true })
        .where(eq(aiNotifications.id, insightId))
        .returning();

      return !!updated;
    } catch (err) {
      logger.error("[CoveriaIntelligence] Failed to dismiss insight:", err);
      return false;
    }
  }

  async generateDailyBriefing(userId: string): Promise<Record<string, unknown>> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayEvents = await db
        .select()
        .from(brainEvents)
        .where(sql`${brainEvents.occurredAt} >= ${today.toISOString()}::timestamptz`)
        .orderBy(desc(brainEvents.occurredAt))
        .limit(100);

      let blocked = 0;
      let allowed = 0;
      let errors = 0;
      let policyChecks = 0;
      let _intakes = 0;
      const decisions = new Set<string>();

      for (const event of todayEvents) {
        const eventType = event.eventType || "";
        if (event.decisionSpineId) {
          decisions.add(event.decisionSpineId);
        }
        if (eventType.includes("blocked")) {
          blocked++;
        } else if (eventType.includes("allowed") || eventType.includes("completed")) {
          allowed++;
        }
        if (eventType.includes("failed") || eventType.includes("error")) {
          errors++;
        }
        if (eventType.includes("policy")) {
          policyChecks++;
        }
        if (eventType.includes("intake") || eventType.includes("signal")) {
          _intakes++;
        }
      }

      const items: unknown[] = [];

      if (decisions.size > 0) {
        items.push({
          type: "stat",
          title: "Decisions Processed",
          value: decisions.size,
          description: `${decisions.size} unique decision(s) entered the pipeline today`,
        });
      }
      if (blocked > 0) {
        items.push({
          type: "alert",
          title: "Policy Blocks",
          value: blocked,
          description: `${blocked} decision(s) were blocked by governance policies`,
        });
      }
      if (errors > 0) {
        items.push({
          type: "warning",
          title: "Pipeline Errors",
          value: errors,
          description: `${errors} error(s) occurred during processing`,
        });
      }
      if (policyChecks > 0) {
        items.push({
          type: "info",
          title: "Policy Evaluations",
          value: policyChecks,
          description: `${policyChecks} policy check(s) executed across Layer 3`,
        });
      }
      if (allowed > 0) {
        items.push({
          type: "success",
          title: "Approved & Completed",
          value: allowed,
          description: `${allowed} decision(s) passed governance and completed`,
        });
      }

      const summaryParts: string[] = [];
      if (decisions.size > 0) {
        summaryParts.push(`${decisions.size} decision(s) processed`);
      }
      if (blocked > 0) {
        summaryParts.push(`${blocked} blocked`);
      }
      if (allowed > 0) {
        summaryParts.push(`${allowed} completed`);
      }
      if (errors > 0) {
        summaryParts.push(`${errors} error(s)`);
      }

      return {
        userId,
        date: new Date().toISOString().split("T")[0],
        summary:
          summaryParts.length > 0
            ? `Today's activity: ${summaryParts.join(", ")}.`
            : "No pipeline activity recorded today. The system is idle.",
        items,
        totalEvents: todayEvents.length,
        uniqueDecisions: decisions.size,
      };
    } catch (err) {
      logger.error("[CoveriaIntelligence] Failed to generate briefing:", err);
      return {
        userId,
        date: new Date().toISOString().split("T")[0],
        summary: "Unable to generate briefing - database query failed.",
        items: [],
      };
    }
  }

  getResponsePrefix(data: { isUrgent?: boolean; isGoodNews?: boolean; isBadNews?: boolean }): string {
    if (data.isUrgent) {
      return "Urgent: ";
    }
    if (data.isGoodNews) {
      return "";
    }
    if (data.isBadNews) {
      return "Note: ";
    }
    return "";
  }
}

export const coveriaIntelligence = new CoveriaIntelligenceService();