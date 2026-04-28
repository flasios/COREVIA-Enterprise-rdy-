import { count, desc, eq } from "drizzle-orm";
import { db as defaultDb } from "@platform/db";
import {
  aiConversations,
  aiMessages,
  demandReports,
  portfolioProjects,
  projectKpis,
  projectMilestones,
  projectRisks,
  wbsTasks,
} from "@shared/schema";
import type {
  AssistantConversationStore,
  AssistantConversationSummary,
  AssistantMessageSummary,
} from "../domain/ports";

type DrizzleDb = typeof defaultDb;

export class DrizzleAssistantConversationStore implements AssistantConversationStore {
  constructor(private readonly db: DrizzleDb = defaultDb) {}

  async createConversation(data: {
    userId: string;
    title: string;
    mode: string;
    contextType?: string;
    contextId?: string;
  }): Promise<string | null> {
    const [newConversation] = await this.db
      .insert(aiConversations)
      .values({
        userId: data.userId,
        title: data.title,
        mode: data.mode,
        contextType: data.contextType,
        contextId: data.contextId,
      })
      .returning({ id: aiConversations.id });

    return newConversation?.id ?? null;
  }

  async getRecentMessages(conversationId: string, limit: number): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
    const rows = await this.db
      .select({ role: aiMessages.role, content: aiMessages.content })
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(desc(aiMessages.createdAt))
      .limit(limit);

    return rows.reverse().filter(
      (row): row is { role: "user" | "assistant"; content: string } =>
        (row.role === "user" || row.role === "assistant") && typeof row.content === "string",
    );
  }

  async appendMessages(conversationId: string, messages: Array<{ role: "user" | "assistant"; content: string; model?: string }>): Promise<void> {
    if (messages.length === 0) {
      return;
    }

    await this.db.insert(aiMessages).values(
      messages.map((message) => ({
        conversationId,
        role: message.role,
        content: message.content,
        model: message.model,
      })),
    );
  }

  async listConversations(userId: string, limit: number): Promise<AssistantConversationSummary[]> {
    return this.db
      .select({
        id: aiConversations.id,
        title: aiConversations.title,
        mode: aiConversations.mode,
        contextType: aiConversations.contextType,
        contextId: aiConversations.contextId,
        updatedAt: aiConversations.updatedAt,
      })
      .from(aiConversations)
      .where(eq(aiConversations.userId, userId))
      .orderBy(desc(aiConversations.updatedAt))
      .limit(limit);
  }

  async listMessages(conversationId: string, limit: number): Promise<AssistantMessageSummary[]> {
    return this.db
      .select({
        id: aiMessages.id,
        role: aiMessages.role,
        content: aiMessages.content,
        createdAt: aiMessages.createdAt,
      })
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(aiMessages.createdAt)
      .limit(limit);
  }

  async getContextSummary(surface?: string, entityId?: string): Promise<Record<string, number>> {
    if ((surface === "workspace" || surface === "ea") && entityId) {
      const [tasks, risks, milestones] = await Promise.all([
        this.db.select({ n: count() }).from(wbsTasks).where(eq(wbsTasks.projectId, entityId)),
        this.db.select({ n: count() }).from(projectRisks).where(eq(projectRisks.projectId, entityId)),
        this.db.select({ n: count() }).from(projectMilestones).where(eq(projectMilestones.projectId, entityId)),
      ]);
      return { tasks: tasks[0]?.n ?? 0, risks: risks[0]?.n ?? 0, milestones: milestones[0]?.n ?? 0 };
    }

    if (surface === "performance") {
      const [kpis] = await this.db.select({ n: count() }).from(projectKpis);
      return { kpis: kpis?.n ?? 0 };
    }

    if (surface === "pmo") {
      const [projects, demands] = await Promise.all([
        this.db.select({ n: count() }).from(portfolioProjects),
        this.db.select({ n: count() }).from(demandReports),
      ]);
      return { projects: projects[0]?.n ?? 0, demands: demands[0]?.n ?? 0 };
    }

    if (surface === "demand" && entityId) {
      const [demand] = await this.db
        .select({
          currentChallenges: demandReports.currentChallenges,
          expectedOutcomes: demandReports.expectedOutcomes,
          successCriteria: demandReports.successCriteria,
          budgetRange: demandReports.budgetRange,
          timeframe: demandReports.timeframe,
          stakeholders: demandReports.stakeholders,
          existingSystems: demandReports.existingSystems,
          integrationRequirements: demandReports.integrationRequirements,
          complianceRequirements: demandReports.complianceRequirements,
          riskFactors: demandReports.riskFactors,
          urgency: demandReports.urgency,
          workflowStatus: demandReports.workflowStatus,
          createdAt: demandReports.createdAt,
        })
        .from(demandReports)
        .where(eq(demandReports.id, entityId))
        .limit(1);

      if (!demand) return { demands: 0 };

      const missingFields = [
        demand.currentChallenges,
        demand.expectedOutcomes,
        demand.successCriteria,
        demand.budgetRange,
        demand.timeframe,
        demand.stakeholders,
        demand.existingSystems,
        demand.integrationRequirements,
        demand.complianceRequirements,
        demand.riskFactors,
      ].filter((value) => value === null || value === undefined || String(value).trim().length === 0).length;

      const ageHours = Math.max(0, Math.round((Date.now() - new Date(demand.createdAt).getTime()) / 36_000) / 10);
      const urgency = String(demand.urgency || "").toLowerCase();
      const slaTargetHours = urgency === "critical" ? 24 : urgency === "high" ? 48 : urgency === "medium" ? 72 : 120;
      const paused = ["deferred", "rejected"].includes(String(demand.workflowStatus || ""));

      return {
        demands: 1,
        missingFields,
        slaHoursRemaining: paused ? 0 : Math.round((slaTargetHours - ageHours) * 10) / 10,
      };
    }

    return {};
  }

  async saveMessageFeedback(messageId: string, feedback: "up" | "down"): Promise<void> {
    await this.db
      .update(aiMessages)
      .set({ structuredOutput: { feedback } })
      .where(eq(aiMessages.id, messageId));
  }
}
