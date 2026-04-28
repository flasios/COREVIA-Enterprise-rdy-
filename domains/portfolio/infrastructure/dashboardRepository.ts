/**
 * Dashboard Bootstrap Repository — Infrastructure Adapter
 *
 * Encapsulates all raw DB queries needed by the dashboard-bootstrap API route
 * so the API layer doesn't import db or drizzle-orm directly.
 */
import { db } from "@platform/db";
import {
  notifications,
  portfolioProjects,
  demandReports,
} from "@shared/schema";
import { brainEvents, decisionSpines } from "@shared/schemas/corevia/tables";
import { desc, eq, sql, count } from "drizzle-orm";

export interface DashboardBootstrapData {
  notifications: unknown[];
  portfolioTotal: number;
  demandTotal: number;
  decisionsTotal: number;
  todayEvents: number;
}

export interface IntelligenceBootstrapData {
  knowledgeDocs: number;
  eventsTotal: number;
}

export async function fetchDashboardBootstrap(
  userId: string,
  organizationId?: string | null,
): Promise<DashboardBootstrapData> {
  const [
    recentNotifications,
    portfolioCount,
    demandCount,
    decisionCount,
    todayEventCount,
  ] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(10),

    organizationId
      ? db.execute(
          sql`SELECT count(*) as count FROM portfolio_projects WHERE organization_id = ${organizationId}`,
        )
      : db.select({ count: count() }).from(portfolioProjects),

    organizationId
      ? db.execute(
          sql`SELECT count(*) as count FROM demand_reports WHERE organization_id = ${organizationId}`,
        )
      : db.select({ count: count() }).from(demandReports),

    db
      .select({ count: count() })
      .from(decisionSpines)
      .where(
        sql`${decisionSpines.title} NOT LIKE 'rag.%'
          AND ${decisionSpines.title} NOT LIKE 'reasoning.%'
          AND ${decisionSpines.title} NOT LIKE 'version_impact.%'
          AND ${decisionSpines.title} NOT LIKE 'demand.new'
          AND length(${decisionSpines.title}) > 10`,
      ),

    db
      .select({ count: count() })
      .from(brainEvents)
      .where(
        sql`${brainEvents.occurredAt} >= (now() - interval '24 hours')`,
      ),
  ]);

  const portfolioTotal = Array.isArray(portfolioCount)
    ? (portfolioCount[0]?.count || 0)
    : ((portfolioCount as any).rows?.[0]?.count || 0); // eslint-disable-line @typescript-eslint/no-explicit-any
  const demandTotal = Array.isArray(demandCount)
    ? (demandCount[0]?.count || 0)
    : ((demandCount as any).rows?.[0]?.count || 0); // eslint-disable-line @typescript-eslint/no-explicit-any
  const decisionsTotal = Number(decisionCount[0]?.count || 0);
  const todayEvents = Number(todayEventCount[0]?.count || 0);

  return {
    notifications: recentNotifications,
    portfolioTotal: Number(portfolioTotal),
    demandTotal: Number(demandTotal),
    decisionsTotal,
    todayEvents,
  };
}

export async function fetchIntelligenceBootstrap(): Promise<IntelligenceBootstrapData> {
  const [knowledgeDocCount, totalBrainEvents] = await Promise.all([
    db
      .execute(sql`SELECT count(*) as count FROM knowledge_documents`)
      .catch(() => [{ count: 0 }]),
    db.select({ count: count() }).from(brainEvents),
  ]);

  const knowledgeDocs = Number(
    Array.isArray(knowledgeDocCount)
      ? (knowledgeDocCount[0]?.count || 0)
      : ((knowledgeDocCount as any).rows?.[0]?.count || 0), // eslint-disable-line @typescript-eslint/no-explicit-any
  );
  const eventsTotal = Number(totalBrainEvents[0]?.count || 0);

  return { knowledgeDocs, eventsTotal };
}
