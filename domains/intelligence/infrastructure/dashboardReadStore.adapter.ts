/**
 * Intelligence Module — Dashboard Read Store Adapter
 *
 * Cross-module read-only queries for executive briefing,
 * goals, NLQ, anomaly detection, and proactive notifications.
 */
import { sql } from "drizzle-orm";
import { desc, count } from "drizzle-orm";
import { db as defaultDb } from "@platform/db";
import { aiNotifications, demandReports, portfolioProjects } from "@shared/schema";
import { brainEvents } from "@shared/schemas/corevia/tables";
import type { DashboardReadStore, BrainEventSummary, AiItemRecord } from "../domain/ports";

type DrizzleDb = typeof defaultDb;

function toBrainEvent(row: typeof brainEvents.$inferSelect): BrainEventSummary {
  return {
    eventType: row.eventType,
    decisionSpineId: row.decisionSpineId,
    occurredAt: row.occurredAt,
    payload: (row.payload ?? null) as Record<string, unknown> | null,
    eventId: row.eventId,
    correlationId: row.correlationId,
  };
}

export class DrizzleDashboardReadStore implements DashboardReadStore {
  constructor(private readonly db: DrizzleDb = defaultDb) {}

  async getDemandCount(): Promise<number> {
    const [row] = await this.db.select({ count: count() }).from(demandReports);
    return Number(row!.count);
  }

  async getCompletedDemandCount(): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(demandReports)
      .where(sql`${demandReports.workflowStatus} IN ('completed', 'approved')`);
    return Number(row?.count || 0);
  }

  async getProjectCount(): Promise<number> {
    const [row] = await this.db.select({ count: count() }).from(portfolioProjects);
    return Number(row!.count);
  }

  async getRecentBrainEvents(hours: number, limit?: number): Promise<BrainEventSummary[]> {
    let query = this.db
      .select()
      .from(brainEvents)
      .where(sql`${brainEvents.occurredAt} >= (now() - interval '1 hour' * ${hours})`)
      .orderBy(desc(brainEvents.occurredAt));
    if (limit) {
      query = query.limit(limit) as typeof query;
    }
    const rows = await query;
    return rows.map(toBrainEvent);
  }

  async searchDemands(
    keywords: string[],
  ): Promise<Array<{ id: string; suggestedProjectName: string | null; workflowStatus: string | null }>> {
    const searchPattern = keywords.join(" | ");
    const rows = await this.db
      .select()
      .from(demandReports)
      .where(
        sql`to_tsvector('english', COALESCE(${demandReports.suggestedProjectName}, '') || ' ' || COALESCE(${demandReports.businessObjective}, '')) @@ to_tsquery('english', ${searchPattern})`,
      )
      .limit(10)
      .catch(() => []);

    return (rows as Array<{ id: string; suggestedProjectName: string | null; workflowStatus: string | null }>).map(
      (d) => ({ id: d.id, suggestedProjectName: d.suggestedProjectName, workflowStatus: d.workflowStatus }),
    );
  }

  async searchBrainEvents(keyword: string, limit: number): Promise<BrainEventSummary[]> {
    const rows = await this.db
      .select()
      .from(brainEvents)
      .where(sql`${brainEvents.eventType}::text ILIKE ${"%" + keyword + "%"}`)
      .orderBy(desc(brainEvents.occurredAt))
      .limit(limit)
      .catch(() => []);
    return rows.map(toBrainEvent);
  }

  async createAiNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    priority?: string;
    relatedType?: string | null;
    relatedId?: string | null;
    actionUrl?: string | null;
  }): Promise<AiItemRecord> {
    const [row] = await this.db
      .insert(aiNotifications)
      .values({
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        priority: data.priority || "medium",
        relatedType: data.relatedType ?? null,
        relatedId: data.relatedId ?? null,
        actionUrl: data.actionUrl ?? null,
      })
      .returning();
    const r = row!;
    return {
      id: r.id,
      userId: r.userId,
      type: r.type || "",
      title: r.title,
      message: r.message,
      priority: r.priority || "medium",
      isRead: r.isRead,
      isDismissed: r.isDismissed,
      relatedType: r.relatedType,
      relatedId: r.relatedId,
      actionUrl: r.actionUrl,
      createdAt: r.createdAt ?? null,
    };
  }

  async saveMarketResearchToBusinessCase(
    demandReportId: string,
    result: unknown,
  ): Promise<void> {
    await this.db.execute(sql`
      UPDATE business_cases
      SET market_research = ${JSON.stringify(result)}::jsonb,
          market_research_generated_at = NOW()
      WHERE demand_report_id = ${demandReportId}
    `);
  }

  async upsertBrainArtifact(data: {
    decisionSpineId: string;
    artifactType: string;
    subDecisionType: string;
    content: Record<string, unknown>;
    changeSummary: string;
    createdBy: string;
  }): Promise<void> {
    // Dynamic import to avoid circular dependency at module load
    const { coreviaStorage } = await import("@brain");
    await coreviaStorage.upsertDecisionArtifactVersion({
      decisionSpineId: data.decisionSpineId,
      artifactType: data.artifactType,
      subDecisionType: data.subDecisionType,
      content: data.content,
      changeSummary: data.changeSummary,
      createdBy: data.createdBy,
    });
  }
}
