/**
 * Intelligence Module — AI Assistant Routes (buildDeps)
 *
 * Canonical AI assistant route composition for the intelligence domain.
 * All service calls go through deps.* adapters.
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import type { AIAssistantStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";

import {
  buildAIAssistantDeps,
  buildProactiveDeps,
  quickChat,
  recordCoveriaInteraction,
  getCoveriaIntelligenceState,
  getCoveriaInsights,
  dismissCoveriaInsight,
  getCoveriaDailyBriefing,
  getCoveriaResponsePrefix,
  generateEaAdvisoryWithExternalAi,
  EaExternalAdvisorRequestSchema,
  generateDailyBriefing as generateProactiveDailyBriefing,
} from "../application";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";
import { redactionGateway } from "@brain";
import { decisionOrchestrator } from "@platform/decision/decisionOrchestrator";

/* ─── Zod schemas ─────────────────────────────────────────────── */

const chatSchema = z.object({
  message: z.string().min(1),
  isFirstMessage: z.boolean().optional(),
  conversationHistory: z.array(z.record(z.unknown())).optional(),
  context: z.string().optional(),
  entityId: z.string().optional(),
  conversationId: z.string().uuid().optional(),
});

const executeActionSchema = z.object({
  actionType: z.string().min(1),
  actionData: z.record(z.unknown()).optional(),
});

const createConversationSchema = z.object({
  title: z.string().optional(),
  mode: z.string().optional(),
  contextType: z.string().optional(),
  contextId: z.string().optional(),
});

const conversationChatSchema = z.object({
  message: z.string().min(1),
});

const createTaskSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.string().optional(),
  dueDate: z.string().optional(),
});

const updateTaskSchema = z.object({
  completed: z.boolean().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

const createReminderSchema = z.object({
  title: z.string().optional(),
  message: z.string().optional(),
  remindAt: z.string().optional(),
});

const updateReminderSchema = z.object({
  dismissed: z.boolean(),
});

const createDocumentSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  documentType: z.string().optional(),
});

const updateDocumentSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
});

const generateEmailSchema = z.object({
  subject: z.string().optional(),
  context: z.string().optional(),
  tone: z.string().optional(),
});

const generatePolicySchema = z.object({
  policyType: z.string().optional(),
  department: z.string().optional(),
  scope: z.string().optional(),
});

const generatePlaybookSchema = z.object({
  processName: z.string().optional(),
  steps: z.array(z.record(z.unknown())).optional(),
  audience: z.string().optional(),
});

const querySchema = z.object({
  question: z.string().min(1),
});

const createWorkflowSchema = z.object({
  name: z.string().optional(),
  trigger: z.record(z.unknown()).optional(),
  actions: z.array(z.record(z.unknown())).optional(),
  enabled: z.boolean().optional(),
});

const recordInteractionSchema = z.object({
  userInput: z.string().min(1).max(10000),
  coveriaResponse: z.string().min(1).max(50000),
  satisfaction: z.number().min(1).max(5).optional(),
  wasHelpful: z.boolean().optional(),
  topic: z.string().max(100).optional(),
  messageId: z.string().max(100).optional(),
});

const responsePrefixSchema = z.object({
  isUrgent: z.boolean().optional(),
  isGoodNews: z.boolean().optional(),
  isBadNews: z.boolean().optional(),
});

type MarketResearchResult = {
  projectContext?: { focusArea?: string; keyObjectives?: string[]; targetCapabilities?: string[] };
  globalMarket?: { marketSize?: string; growthRate?: string; keyTrends?: string[]; topCountries?: unknown[]; majorPlayers?: unknown[]; technologyLandscape?: string[] };
  uaeMarket?: { marketSize?: string; growthRate?: string; governmentInitiatives?: string[]; localPlayers?: unknown[]; opportunities?: string[]; regulatoryConsiderations?: string[] };
  suppliers?: unknown[];
  useCases?: unknown[];
  competitiveAnalysis?: { directCompetitors?: string[]; indirectCompetitors?: string[]; marketGaps?: string[] };
  recommendations?: string[];
  riskFactors?: string[];
  generatedAt?: string;
  [key: string]: unknown;
};

async function resolveDecisionSpineIdForReport(
  deps: ReturnType<typeof buildAIAssistantDeps>,
  reportId: string,
): Promise<string | null> {
  const report = await deps.repo.getDemandReport(reportId);
  if (!report) return null;
  const reportRecord = report as Record<string, unknown>;
  return typeof reportRecord.decisionSpineId === "string" ? reportRecord.decisionSpineId : null;
}

type UnifiedNotificationItem = {
  id: string;
  source: "system" | "ai" | "tender" | "brain";
  category: string;
  title: string;
  message: string;
  priority: string;
  isRead: boolean;
  isDismissed: boolean;
  actionUrl: string | null;
  relatedType: string | null;
  relatedId: string | null;
  metadata: unknown;
  createdAt: Date | string;
};

/* ─── Route factory ───────────────────────────────────────────── */

export function createAIAssistantRoutes(storage: AIAssistantStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildAIAssistantDeps(storage);
  const proactiveDeps = buildProactiveDeps();

  // ──────────────────── Quick chat ────────────────────
  router.post("/chat", validateBody(chatSchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const { message, isFirstMessage, conversationHistory, context } = req.body;
      const result = await quickChat(deps, message, req.session.userId, isFirstMessage, conversationHistory, context);
      if (!result.success) return res.status(result.status).json({ error: result.error });

      // Record interaction for Coveria's learning (fire-and-forget)
      deps.coveriaIntelligence
        .recordInteraction(message, result.data.response, {
          userId: req.session.userId,
          topic: context || "general",
        })
        .catch((err) =>
          logger.warn("[CoveriaIntelligence] Failed to record interaction:", err),
        );

      res.json({ success: true, response: result.data.response });
    } catch (error) {
      logger.error("[AI Assistant] Error in quick chat:", error);
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  // ──────────────────── Quick chat (streaming) ────────────────────
  router.post("/chat/stream", validateBody(chatSchema), async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const { message, isFirstMessage, conversationHistory, context, entityId, conversationId: incomingConvId } = req.body;
      const user = await deps.repo.getUser(req.session.userId);
      const userName = (user as Record<string, unknown> | null)?.displayName as string || "there";

      // ── Tier 3: Conversation persistence ─────────────────────────────────
      let convId = incomingConvId;
      let persistedHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

      if (!convId) {
        convId = await deps.conversations.createConversation({
          userId: req.session.userId,
          title: message.slice(0, 80),
          mode: context || 'general',
          contextType: entityId ? context || 'general' : undefined,
          contextId: entityId ?? undefined,
        });
      } else {
        persistedHistory = await deps.conversations.getRecentMessages(convId as string, 20);
      }

      // Use DB history when available, fall back to client-provided history
      const history = persistedHistory.length > 0 ? persistedHistory :
        Array.isArray(conversationHistory)
          ? conversationHistory.filter((m: unknown): m is { role: 'user' | 'assistant'; content: string } => {
              if (typeof m !== "object" || m === null) return false;
              const c = m as { role?: unknown; content?: unknown };
              return typeof c.role === "string" && typeof c.content === "string";
            })
          : [];

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      // Emit conversation ID so frontend can persist it
      if (convId) {
        res.write(`data: ${JSON.stringify({ type: 'conv_id', id: convId })}\n\n`);
      }

      let fullResponse = "";

      await deps.aiAssistant.quickChatStream(
        message,
        req.session.userId,
        userName,
        isFirstMessage ?? false,
        history,
        context || "",
        (token: string) => {
          fullResponse += token;
          res.write(`data: ${JSON.stringify({ t: token })}\n\n`);
        },
        (event) => {
          // Emit tool activity, follow-up, and file_ready events to the frontend
          const payload: Record<string, unknown> = { type: event.type, name: event.name, summary: event.summary };
          if (event.items) payload.items = event.items;
          if (event.url) payload.url = event.url;
          if (event.filename) payload.filename = event.filename;
          if (event.format) payload.format = event.format;
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        },
        entityId,
      );

      res.write("data: [DONE]\n\n");
      res.end();

      // ── Persist messages to DB ──────────────────────────────────────────
      if (convId && fullResponse) {
        await deps.conversations.appendMessages(convId, [
          { role: 'user', content: message },
          { role: 'assistant', content: fullResponse, model: 'claude-sonnet-4-20250514' },
        ]).catch((err) => logger.warn("[Advisor] Failed to persist messages:", err));
      }

      // Fire-and-forget learning record
      deps.coveriaIntelligence
        .recordInteraction(message, fullResponse, { userId: req.session.userId, topic: context || "general" })
        .catch((err) => logger.warn("[CoveriaIntelligence] Failed to record stream interaction:", err));
    } catch (error) {
      logger.error("[AI Assistant] Error in streaming chat:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process message" });
      } else {
        res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
        res.end();
      }
    }
  });

  // ──────────────────── Advisor control-plane config ────────────────────
  // Lightweight in-process config store for the unified advisor.
  // Surfaces can be toggled on/off and access-controlled from the Brain console.

  interface AdvisorSurfaceConfig {
    id: string;
    label: string;
    description: string;
    enabled: boolean;
    allowedRoles: string[];
    streamingEnabled: boolean;
    maxTokens: number;
    context: string;
  }

  const DEFAULT_SURFACES: AdvisorSurfaceConfig[] = [
    { id: "pmo", label: "PMO Office", description: "Portfolio management and project intelligence", enabled: true, allowedRoles: ["admin", "manager", "analyst"], streamingEnabled: true, maxTokens: 400, context: "pmo-office" },
    { id: "demand", label: "Demand Submissions", description: "Demand intake and quality improvement", enabled: true, allowedRoles: ["admin", "manager", "analyst", "user"], streamingEnabled: true, maxTokens: 1500, context: "demand_submissions" },
    { id: "home", label: "Home / Dashboard", description: "General workspace assistant on the homepage", enabled: true, allowedRoles: ["admin", "manager", "analyst", "user"], streamingEnabled: false, maxTokens: 400, context: "general" },
    { id: "workspace", label: "Workspace", description: "Project workspace intelligence assistant", enabled: true, allowedRoles: ["admin", "manager", "analyst", "user"], streamingEnabled: false, maxTokens: 400, context: "workspace" },
    { id: "performance", label: "Performance Management", description: "KPI and performance analytics assistant", enabled: true, allowedRoles: ["admin", "manager"], streamingEnabled: false, maxTokens: 400, context: "performance" },
    { id: "ea", label: "Enterprise Architecture", description: "EA advisory and architecture guidance", enabled: true, allowedRoles: ["admin"], streamingEnabled: false, maxTokens: 1500, context: "ea" },
  ];

  // Runtime mutable config — survives for the lifetime of the process
  const advisorConfig: {
    globalEnabled: boolean;
    model: string;
    surfaces: AdvisorSurfaceConfig[];
    updatedAt: string;
    updatedBy: string | null;
  } = {
    globalEnabled: true,
    model: "claude-sonnet-4-20250514",
    surfaces: DEFAULT_SURFACES,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
  };

  router.get("/advisor/config", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    res.json({ success: true, data: advisorConfig });
  });

  router.patch("/advisor/config", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const body = req.body as Record<string, unknown>;
      if (typeof body.globalEnabled === "boolean") advisorConfig.globalEnabled = body.globalEnabled;
      if (typeof body.model === "string" && body.model.length > 0) advisorConfig.model = body.model;
      if (Array.isArray(body.surfaces)) {
        for (const incoming of body.surfaces as Partial<AdvisorSurfaceConfig>[]) {
          const existing = advisorConfig.surfaces.find(s => s.id === incoming.id);
          if (existing) {
            if (typeof incoming.enabled === "boolean") existing.enabled = incoming.enabled;
            if (typeof incoming.streamingEnabled === "boolean") existing.streamingEnabled = incoming.streamingEnabled;
            if (typeof incoming.maxTokens === "number") existing.maxTokens = incoming.maxTokens;
            if (Array.isArray(incoming.allowedRoles)) existing.allowedRoles = incoming.allowedRoles as string[];
          }
        }
      }
      advisorConfig.updatedAt = new Date().toISOString();
      advisorConfig.updatedBy = req.session.userId;
      logger.info(`[AdvisorConfig] Updated by ${req.session.userId}`);
      res.json({ success: true, data: advisorConfig });
    } catch (error) {
      logger.error("[AdvisorConfig] Update failed:", error);
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  router.post("/advisor/config/reset", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    advisorConfig.surfaces = DEFAULT_SURFACES.map(s => ({ ...s }));
    advisorConfig.globalEnabled = true;
    advisorConfig.model = "claude-sonnet-4-20250514";
    advisorConfig.updatedAt = new Date().toISOString();
    advisorConfig.updatedBy = req.session.userId;
    res.json({ success: true, data: advisorConfig });
  });

  // ── Tier 3: Proactive briefing endpoint ──────────────────────────────────
  router.get("/advisor/briefing", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const result = await generateProactiveDailyBriefing(proactiveDeps);
      if (!result.success) return res.status(result.status).json({ error: result.error });
      res.json({ success: true, data: result.data });
    } catch (error) {
      logger.error("[Advisor Briefing] Failed:", error);
      res.status(500).json({ error: "Failed to generate briefing" });
    }
  });

  // ── Tier 3: Conversation history endpoint ────────────────────────────────
  router.get("/advisor/conversations", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const conversations = await deps.conversations.listConversations(req.session.userId, 20);
      res.json({ success: true, data: conversations });
    } catch (error) {
      logger.error("[Advisor Conversations] Failed:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  router.get("/advisor/conversations/:id/messages", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const messages = await deps.conversations.listMessages(req.params.id as string, 100);
      res.json({ success: true, data: messages });
    } catch (error) {
      logger.error("[Advisor Messages] Failed:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // ── Context transparency summary ─────────────────────────────────────────
  // Returns live item counts for the advisor header pills.
  router.get("/advisor/context-summary", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    const { surface, entityId } = req.query as { surface?: string; entityId?: string };
    try {
      const counts = await deps.conversations.getContextSummary(surface, entityId);
      res.json({ success: true, data: counts });
    } catch (error) {
      logger.error("[Advisor Context Summary] Failed:", error);
      res.status(500).json({ error: "Failed to fetch context summary" });
    }
  });

  // ── Message feedback (thumbs up/down) ────────────────────────────────────
  router.patch("/messages/:messageId/feedback", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    const { feedback } = req.body as { feedback?: string };
    if (feedback !== 'up' && feedback !== 'down') {
      return res.status(400).json({ error: "feedback must be 'up' or 'down'" });
    }
    try {
      await deps.conversations.saveMessageFeedback(req.params.messageId as string, feedback);
      res.json({ success: true });
    } catch (error) {
      logger.error("[Advisor Feedback] Failed:", error);
      res.status(500).json({ error: "Failed to save feedback" });
    }
  });

  router.post("/execute-action", validateBody(executeActionSchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const { actionType, actionData } = req.body;
      logger.info(`[Coveria] Executing action: ${actionType}`, actionData);

      let result;
      switch (actionType) {
        case "approved_agent_action": {
          const user = await deps.repo.getUser(req.session.userId);
          const userName = (user as Record<string, unknown> | null)?.displayName as string || "there";
          const prompt = typeof actionData?.prompt === "string" ? actionData.prompt : "";
          const context = typeof actionData?.context === "string" ? actionData.context : "pmo-office";
          const idempotencyKey = typeof actionData?.idempotencyKey === "string" ? actionData.idempotencyKey : undefined;
          const preselectedToolCalls = Array.isArray(actionData?.preselectedToolCalls)
            ? actionData.preselectedToolCalls
                .map((call: unknown) => {
                  const record = (call && typeof call === "object") ? (call as Record<string, unknown>) : null;
                  return {
                    name: typeof record?.name === "string" ? record.name : "",
                    input: record?.input && typeof record.input === "object" && !Array.isArray(record.input)
                      ? record.input as Record<string, unknown>
                      : {},
                  };
                })
                .filter((call: { name: string; input: Record<string, unknown> }) => call.name.length > 0)
            : undefined;
          result = await deps.aiAssistant.executeApprovedAction(
            prompt,
            req.session.userId,
            userName,
            context,
            idempotencyKey,
            preselectedToolCalls,
          );
          break;
        }
        case "report":
          logger.info("[Coveria] Generating report:", actionData);
          result = { success: true, message: "Report generation initiated" };
          break;
        case "alert":
          await deps.repo.createNotification({
            userId: req.session.userId,
            type: "coveria_alert",
            title: actionData?.title || "Coveria Alert",
            message: actionData?.message || "",
          });
          result = { success: true, message: "Alert created" };
          break;
        default:
          result = { success: true, message: "Action acknowledged" };
      }

      res.json({ success: true, result });
    } catch (error) {
      logger.error("[AI Assistant] Error executing action:", error);
      res.status(500).json({ error: "Failed to execute action" });
    }
  });

  // ──────────────────── Conversations ────────────────────
  router.post("/conversations", validateBody(createConversationSchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const { title, mode, contextType, contextId } = req.body;
      const conversation = await deps.aiAssistant.createConversation(
        req.session.userId,
        title,
        mode,
        contextType,
        contextId,
      );
      res.json({ success: true, data: conversation });
    } catch (error) {
      logger.error("[AI Assistant] Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  router.get("/conversations", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const conversations = await deps.aiAssistant.getConversations(req.session.userId);
      res.json({ success: true, data: conversations });
    } catch (error) {
      logger.error("[AI Assistant] Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  router.get("/conversations/:id", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const conversation = await deps.aiAssistant.getConversation(req.params.id as string);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json({ success: true, data: conversation });
    } catch (error) {
      logger.error("[AI Assistant] Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  router.get("/conversations/:id/messages", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const messages = await deps.aiAssistant.getMessages(req.params.id as string);
      res.json({ success: true, data: messages });
    } catch (error) {
      logger.error("[AI Assistant] Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  router.post("/conversations/:id/chat", validateBody(conversationChatSchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const user = await deps.repo.getUser(req.session.userId);
      const userName = (user as Record<string, unknown> | null)?.displayName as string || "there";

      const result = await deps.aiAssistant.chat(
        req.params.id as string,
        message,
        req.session.userId,
        userName,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error("[AI Assistant] Error in chat:", error);
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  router.delete("/conversations/:id", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      await deps.aiAssistant.archiveConversation(req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      logger.error("[AI Assistant] Error archiving conversation:", error);
      res.status(500).json({ error: "Failed to archive conversation" });
    }
  });

  // ──────────────────── Tasks ────────────────────
  router.post("/tasks", validateBody(createTaskSchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const { title, description, priority, dueDate } = req.body;
      const task = await deps.items.create({
        userId: req.session.userId,
        type: "task",
        title: title || "Untitled Task",
        message: description || "",
        priority: priority || "medium",
        relatedType: "task",
        relatedId: dueDate || null,
      });
      res.json({ success: true, data: task });
    } catch (error) {
      logger.error("[AI Assistant] Error creating task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  router.get("/tasks", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const tasks = await deps.items.findByUserAndType(req.session.userId, "task");
      res.json({ success: true, data: tasks });
    } catch (error) {
      logger.error("[AI Assistant] Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  router.patch("/tasks/:id", validateBody(updateTaskSchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const { completed, title, description } = req.body;
      const updateData: { title?: string; message?: string; isDismissed?: boolean } = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.message = description;
      if (completed !== undefined) updateData.isDismissed = !!completed;

      const updated = await deps.items.update(req.params.id as string, req.session.userId, updateData);
      if (!updated) return res.status(404).json({ error: "Task not found" });
      res.json({ success: true, data: { ...updated, completed: updated.isDismissed } });
    } catch (error) {
      logger.error("[AI Assistant] Error updating task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  router.delete("/tasks/:id", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      await deps.items.delete(req.params.id as string, req.session.userId);
      res.json({ success: true });
    } catch (error) {
      logger.error("[AI Assistant] Error deleting task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // ──────────────────── Reminders ────────────────────
  router.post("/reminders", validateBody(createReminderSchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const { title, message, remindAt } = req.body;
      const reminder = await deps.items.create({
        userId: req.session.userId,
        type: "reminder",
        title: title || "Reminder",
        message: message || "",
        priority: "medium",
        relatedType: "reminder",
        relatedId: remindAt || null,
      });
      res.json({ success: true, data: reminder });
    } catch (error) {
      logger.error("[AI Assistant] Error creating reminder:", error);
      res.status(500).json({ error: "Failed to create reminder" });
    }
  });

  router.get("/reminders", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const reminders = await deps.items.findByUserAndType(req.session.userId, "reminder");
      res.json({ success: true, data: reminders });
    } catch (error) {
      logger.error("[AI Assistant] Error fetching reminders:", error);
      res.status(500).json({ error: "Failed to fetch reminders" });
    }
  });

  router.patch("/reminders/:id", validateBody(updateReminderSchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const { dismissed } = req.body;
      const updated = await deps.items.update(req.params.id as string, req.session.userId, { isDismissed: !!dismissed });
      if (!updated) return res.status(404).json({ error: "Reminder not found" });
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error("[AI Assistant] Error updating reminder:", error);
      res.status(500).json({ error: "Failed to update reminder" });
    }
  });

  // ──────────────────── Notifications ────────────────────
  router.get("/notifications", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const unreadOnly = req.query.unreadOnly === "true";
      const notifs = await deps.aiAssistant.getNotifications(req.session.userId, unreadOnly);
      res.json({ success: true, data: notifs });
    } catch (error) {
      logger.error("[AI Assistant] Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  router.patch("/notifications/:id/read", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      await deps.aiAssistant.markNotificationRead(req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      logger.error("[AI Assistant] Error marking notification read:", error);
      res.status(500).json({ error: "Failed to mark notification read" });
    }
  });

  router.patch("/notifications/:id/dismiss", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      await deps.aiAssistant.dismissNotification(req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      logger.error("[AI Assistant] Error dismissing notification:", error);
      res.status(500).json({ error: "Failed to dismiss notification" });
    }
  });

  router.post("/notifications/read-all", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      await deps.items.markAllReadByUser(req.session.userId);
      res.json({ success: true, message: "All notifications marked as read" });
    } catch (error) {
      logger.error("[AI Assistant] Error marking all notifications read:", error);
      res.status(500).json({ error: "Failed to mark all notifications read" });
    }
  });

  // ──────────────────── Documents ────────────────────
  router.post("/documents", validateBody(createDocumentSchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const { title, content, documentType } = req.body;
      const doc = await deps.items.create({
        userId: req.session.userId,
        type: "document",
        title: title || "Untitled Document",
        message: content || "",
        priority: "low",
        relatedType: documentType || "general",
      });
      res.json({ success: true, data: doc });
    } catch (error) {
      logger.error("[AI Assistant] Error creating document:", error);
      res.status(500).json({ error: "Failed to create document" });
    }
  });

  router.get("/documents", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const documents = await deps.items.findByUserAndType(req.session.userId, "document");
      res.json({ success: true, data: documents });
    } catch (error) {
      logger.error("[AI Assistant] Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  router.get("/documents/:id", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const doc = await deps.items.findOneByIdAndUser(req.params.id as string, req.session.userId, "document");
      if (!doc) return res.status(404).json({ error: "Document not found" });
      res.json({ success: true, data: doc });
    } catch (error) {
      logger.error("[AI Assistant] Error fetching document:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  router.patch("/documents/:id", validateBody(updateDocumentSchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const { title, content } = req.body;
      const updateData: { title?: string; message?: string } = {};
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.message = content;
      const updated = await deps.items.update(req.params.id as string, req.session.userId, updateData);
      if (!updated) return res.status(404).json({ error: "Document not found" });
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error("[AI Assistant] Error updating document:", error);
      res.status(500).json({ error: "Failed to update document" });
    }
  });

  // ──────────────────── Quick Actions (generate templates) ────────────────────
  router.post("/generate/email", validateBody(generateEmailSchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const { subject, context, tone } = req.body;
      const emailTemplate = {
        subject: subject || "Follow-up",
        body: `Dear Team,\n\nI wanted to follow up regarding ${context || "our recent discussion"}.\n\n${tone === "formal" ? "Please find the relevant details outlined below." : "Here are the key points to consider."}\n\n[Key points from context]\n\nPlease let me know if you have any questions.\n\nBest regards`,
        generatedAt: new Date().toISOString(),
      };
      res.json({ success: true, data: emailTemplate });
    } catch (error) {
      logger.error("[AI Assistant] Error generating email:", error);
      res.status(500).json({ error: "Failed to generate email" });
    }
  });

  router.post("/generate/policy", validateBody(generatePolicySchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const { policyType, department, scope } = req.body;
      const policyTemplate = {
        title: `${policyType || "General"} Policy - ${department || "Organization"}`,
        sections: [
          { heading: "1. Purpose & Scope", content: `This policy defines the ${scope || "operational"} guidelines for ${department || "all departments"}.` },
          { heading: "2. Definitions", content: "Key terms used throughout this policy." },
          { heading: "3. Policy Statement", content: `All ${policyType || "operational"} activities must comply with the following guidelines.` },
          { heading: "4. Responsibilities", content: "Roles and responsibilities for policy adherence." },
          { heading: "5. Compliance & Enforcement", content: "Non-compliance procedures and escalation path." },
          { heading: "6. Review & Revision", content: "This policy shall be reviewed annually." },
        ],
        generatedAt: new Date().toISOString(),
      };
      res.json({ success: true, data: policyTemplate });
    } catch (error) {
      logger.error("[AI Assistant] Error generating policy:", error);
      res.status(500).json({ error: "Failed to generate policy" });
    }
  });

  router.post("/generate/playbook", validateBody(generatePlaybookSchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const { processName, steps, audience } = req.body;
      const playbookTemplate = {
        title: `${processName || "Process"} Playbook`,
        audience: audience || "All Teams",
        steps: steps || [
          { step: 1, title: "Initiation", description: "Begin the process by gathering requirements and stakeholder alignment." },
          { step: 2, title: "Planning", description: "Create a detailed plan with timelines, resources, and risk assessment." },
          { step: 3, title: "Execution", description: "Execute the plan following governance guidelines and checkpoints." },
          { step: 4, title: "Review", description: "Conduct review and lessons learned session." },
          { step: 5, title: "Closure", description: "Document outcomes, archive artifacts, and close the process." },
        ],
        generatedAt: new Date().toISOString(),
      };
      res.json({ success: true, data: playbookTemplate });
    } catch (error) {
      logger.error("[AI Assistant] Error generating playbook:", error);
      res.status(500).json({ error: "Failed to generate playbook" });
    }
  });

  // ──────────────────── Proactive intelligence ────────────────────
  router.post("/generate-notifications", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const recentEvents = await deps.dashboard.getRecentBrainEvents(24, 10);

      const generated: unknown[] = [];
      for (const event of recentEvents) {
        if (event.eventType === "policy_block" || event.eventType === "risk_flagged") {
          const notif = await deps.dashboard.createAiNotification({
            userId: req.session.userId,
            type: "proactive_alert",
            title: `Action Required: ${event.eventType === "policy_block" ? "Policy Block Detected" : "Risk Flagged"}`,
            message: `Decision ${event.decisionSpineId} triggered ${event.eventType}. Review recommended.`,
            priority: "high",
            relatedType: "proactive_engine",
            relatedId: String(event.eventId),
          });
          generated.push(notif);
        }
      }
      res.json({ success: true, data: { generated: generated.length, notifications: generated } });
    } catch (error) {
      logger.error("[AI Assistant] Error generating notifications:", error);
      res.status(500).json({ error: "Failed to generate proactive notifications" });
    }
  });

  router.get("/insights", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const insights = await deps.aiAssistant.getProactiveInsights(req.session.userId);
      res.json({ success: true, data: insights });
    } catch (error) {
      logger.error("[AI Assistant] Error fetching insights:", error);
      res.status(500).json({ error: "Failed to fetch insights" });
    }
  });

  // ──────────────────── Executive briefing ────────────────────
  router.get("/briefing", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const demandTotal = await deps.dashboard.getDemandCount();
      const projectTotal = await deps.dashboard.getProjectCount();
      const todayEvents = await deps.dashboard.getRecentBrainEvents(24, 20);

      const blockedCount = todayEvents.filter((e) => e.eventType?.includes("block")).length;
      const allowedCount = todayEvents.filter(
        (e) => e.eventType?.includes("allow") || e.eventType?.includes("pass"),
      ).length;

      const briefing = {
        date: new Date().toISOString().split("T")[0],
        summary: `Today: ${todayEvents.length} brain events processed, ${demandTotal} demand intakes tracked, ${projectTotal} portfolio projects managed.`,
        highlights: [
          { type: "stat", label: "Active Demands", value: demandTotal },
          { type: "stat", label: "Portfolio Projects", value: projectTotal },
          { type: "stat", label: "Today's Events", value: todayEvents.length },
          ...(blockedCount > 0
            ? [{ type: "alert", label: "Policy Blocks Today", value: blockedCount }]
            : []),
          { type: "stat", label: "Decisions Allowed", value: allowedCount },
        ],
        recentEvents: todayEvents.slice(0, 5).map((e) => ({
          type: e.eventType,
          decisionId: e.decisionSpineId,
          timestamp: e.occurredAt,
        })),
        generatedAt: new Date().toISOString(),
      };
      res.json({ success: true, data: briefing });
    } catch (error) {
      logger.error("[AI Assistant] Error generating briefing:", error);
      res.status(500).json({ error: "Failed to generate executive briefing" });
    }
  });

  // ──────────────────── Natural language query ────────────────────
  router.post("/query", validateBody(querySchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const { question } = req.body;
      if (!question || typeof question !== "string") {
        return res.status(400).json({ error: "question field is required" });
      }

      const keywords = question
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 2);

      const matchingDemands = await deps.dashboard.searchDemands(keywords);

      const matchingEvents = await deps.dashboard.searchBrainEvents(keywords[0] || "", 10);

      res.json({
        success: true,
        data: {
          question,
          answer:
            matchingDemands.length > 0
              ? `Found ${matchingDemands.length} demand(s) matching your query.`
              : `No direct matches found. ${matchingEvents.length} related events discovered.`,
          demands: matchingDemands.map((d) => ({
            id: d.id,
            title: d.suggestedProjectName,
            status: d.workflowStatus,
          })),
          events: matchingEvents.slice(0, 5).map((e) => ({
            type: e.eventType,
            decisionId: e.decisionSpineId,
            time: e.occurredAt,
          })),
          searchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("[AI Assistant] Error processing query:", error);
      res.status(500).json({ error: "Failed to process natural language query" });
    }
  });

  // ──────────────────── Anomaly detection ────────────────────
  router.get("/anomalies", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const last24h = await deps.dashboard.getRecentBrainEvents(24);

      const anomalies: unknown[] = [];

      const blocks = last24h.filter((e) => e.eventType?.includes("block"));
      if (blocks.length > 5) {
        anomalies.push({
          type: "high_block_rate",
          severity: "warning",
          message: `${blocks.length} policy blocks in last 24 hours — unusually high`,
          count: blocks.length,
          detectedAt: new Date().toISOString(),
        });
      }

      const errors = last24h.filter(
        (e) => e.eventType?.includes("error") || e.eventType?.includes("fail"),
      );
      if (errors.length > 3) {
        anomalies.push({
          type: "error_spike",
          severity: "critical",
          message: `${errors.length} errors detected in last 24 hours`,
          count: errors.length,
          detectedAt: new Date().toISOString(),
        });
      }

      const last6h = last24h.filter((e) => {
        const t = new Date(e.occurredAt!).getTime();
        return t >= Date.now() - 6 * 60 * 60 * 1000;
      });
      if (last24h.length > 10 && last6h.length === 0) {
        anomalies.push({
          type: "activity_gap",
          severity: "info",
          message: "No brain events in last 6 hours despite prior activity",
          detectedAt: new Date().toISOString(),
        });
      }

      res.json({
        success: true,
        data: { anomalies, analyzedEvents: last24h.length, period: "24h" },
      });
    } catch (error) {
      logger.error("[AI Assistant] Error detecting anomalies:", error);
      res.status(500).json({ error: "Failed to detect anomalies" });
    }
  });

  // ──────────────────── Goals ────────────────────
  router.get("/goals", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const totalDemands = await deps.dashboard.getDemandCount();
      const completed = await deps.dashboard.getCompletedDemandCount();
      const projectCount = await deps.dashboard.getProjectCount();

      const goals = [
        {
          id: "demand-processing",
          name: "Demand Processing",
          target: Math.max(totalDemands, 10),
          current: totalDemands,
          unit: "demands",
          progress: totalDemands > 0 ? Math.round((completed / totalDemands) * 100) : 0,
        },
        {
          id: "portfolio-growth",
          name: "Portfolio Growth",
          target: Math.max(projectCount + 5, 10),
          current: projectCount,
          unit: "projects",
          progress: Math.min(
            Math.round(
              (projectCount / Math.max(projectCount + 5, 10)) * 100,
            ),
            100,
          ),
        },
      ];

      res.json({ success: true, data: goals });
    } catch (error) {
      logger.error("[AI Assistant] Error fetching goals:", error);
      res.status(500).json({ error: "Failed to fetch goals" });
    }
  });

  // ──────────────────── Preferences ────────────────────
  router.get("/preferences", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const prefs = await deps.items.findByUserAndType(req.session.userId, "preference");

      const defaultPrefs = {
        notificationFrequency: "realtime",
        briefingTime: "09:00",
        insightCategories: ["risk", "policy", "performance"],
        theme: "system",
      };

      const storedPrefs = prefs[0]?.message ? JSON.parse(prefs[0].message) : {};
      res.json({ success: true, data: { ...defaultPrefs, ...storedPrefs } });
    } catch (error) {
      logger.error("[AI Assistant] Error fetching preferences:", error);
      res.status(500).json({ error: "Failed to fetch preferences" });
    }
  });

  // ──────────────────── Workflows ────────────────────
  router.post("/workflows", validateBody(createWorkflowSchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const { name, trigger, actions, enabled } = req.body;
      const workflow = await deps.items.create({
        userId: req.session.userId,
        type: "workflow",
        title: name || "Untitled Workflow",
        message: JSON.stringify({ trigger, actions, enabled: enabled !== false }),
        priority: "medium",
        relatedType: "workflow",
      });
      res.json({ success: true, data: workflow });
    } catch (error) {
      logger.error("[AI Assistant] Error creating workflow:", error);
      res.status(500).json({ error: "Failed to create workflow" });
    }
  });

  // ──────────────────── Test notifications ────────────────────
  router.post("/test-notifications", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const userId = req.session.userId;
      const _user = await deps.repo.getUser(userId);
      const results: unknown[] = [];

      await deps.repo.createNotification({ userId, type: "system_alert", title: "System Alert Test", message: "This is a test system alert notification from Coveria." });
      results.push({ type: "system_alert", status: "sent" });

      await deps.repo.createNotification({ userId, type: "task_assigned", title: "New Task Assigned", message: "You have been assigned a new task: Review Business Case for Digital Transformation Project." });
      results.push({ type: "task_assigned", status: "sent" });

      await deps.repo.createNotification({ userId, type: "status_changed", title: "Demand Status Updated", message: 'Demand PRJ-2025-001 has been moved to "Under Review" status.' });
      results.push({ type: "status_changed", status: "sent" });

      await deps.repo.createNotification({ userId, type: "approval_required", title: "Approval Required", message: "Business Case v2.0 requires your approval before proceeding to the next phase." });
      results.push({ type: "approval_required", status: "sent" });

      await deps.repo.createNotification({ userId, type: "meeting_scheduled", title: "Meeting Scheduled", message: "A review meeting has been scheduled for tomorrow at 10:00 AM Dubai time." });
      results.push({ type: "meeting_scheduled", status: "sent" });

      await deps.repo.createNotification({ userId, type: "risk_alert", title: "Risk Alert: Project Delay", message: "Project AV Nexus is at risk of delay. Current timeline variance: 15% behind schedule." });
      results.push({ type: "risk_alert", status: "sent" });

      await deps.repo.createNotification({ userId, type: "budget_warning", title: "Budget Warning", message: "Project spending has reached 85% of allocated budget. Review recommended." });
      results.push({ type: "budget_warning", status: "sent" });

      await deps.repo.createNotification({ userId, type: "coveria_insight", title: "Coveria Intelligence Insight", message: "Analysis complete: 3 projects show synergy opportunities with potential savings of AED 2.5M." });
      results.push({ type: "coveria_insight", status: "sent" });

      await deps.repo.createNotification({ userId, type: "section_assigned", title: "Section Assigned for Review", message: 'You have been assigned to review the "Financial Analysis" section of Business Case BC-2025-003.' });
      results.push({ type: "section_assigned", status: "sent" });

      await deps.repo.createNotification({ userId, type: "gate_approval", title: "Gate Approval Request", message: "Project PRJ-2025-002 has requested gate approval to transition from Planning to Execution phase." });
      results.push({ type: "gate_approval", status: "sent" });

      await deps.dashboard.createAiNotification({ userId, type: "insight", title: "AI Daily Briefing Ready", message: "Your daily intelligence briefing is ready. 2 critical items require attention.", priority: "high", actionUrl: "/portfolio" });
      results.push({ type: "ai_notification_briefing", status: "sent" });

      await deps.dashboard.createAiNotification({ userId, type: "suggestion", title: "Anomaly Detected", message: "Unusual pattern detected: Project PRJ-2025-003 has had no activity for 14 days.", priority: "medium" });
      results.push({ type: "ai_notification_anomaly", status: "sent" });

      logger.info("[Test Notifications] Sent", results.length, "test notifications to user", userId);

      res.json({
        success: true,
        message: `Successfully sent ${results.length} test notifications`,
        notifications: results,
      });
    } catch (error) {
      logger.error("[AI Assistant] Error sending test notifications:", error);
      res.status(500).json({ error: "Failed to send test notifications" });
    }
  });

  // ──────────────────── Market research ────────────────────
  router.post(
    "/market-research",
    auth.requireAuth,
    auth.requirePermission("business-case:generate"),
    async (req: Request, res: Response) => {
      try {
        const {
          projectName,
          projectDescription,
          projectType,
          organization,
          estimatedBudget,
          businessCaseSummary,
          archetype,
          objectives,
          scope,
          strategicAlignment,
          expectedBenefits,
          demandReportId,
        } = req.body;

        if (!projectName || !projectDescription) {
          return res.status(400).json({ error: "Project name and description are required" });
        }

        const userId = req.session.userId!;

        if (demandReportId) {
          const demandReport = await deps.repo.getDemandReport(demandReportId);
          if (!demandReport) {
            return res.status(404).json({ error: "Demand report not found" });
          }
          const businessCase = await deps.repo.getBusinessCaseByDemandReportId(demandReportId);
          if (!businessCase) {
            return res.status(400).json({
              error: "Business case must be created before saving market research",
            });
          }
        }

        // ========== COREVIA BRAIN GOVERNANCE ==========
        // Market research still uses a direct structured-LLM generator for latency reasons,
        // but Brain governance must approve the request before any provider call occurs.
        const demandReport = demandReportId
          ? await deps.repo.getDemandReport(demandReportId)
          : undefined;
        const resolvedDecisionSpineId = (demandReport as Record<string, unknown> | undefined)?.decisionSpineId as string | undefined;

        const governance = await decisionOrchestrator.intake(
          {
            intent: `Generate market research for ${projectName}`,
            decisionType: "market_research_generate",
            financialImpact: estimatedBudget ? "medium" : "low",
            urgency: "medium",
            sourceType: "market_research",
            sourceContext: {
              projectName,
              projectDescription,
              projectType,
              organization,
              estimatedBudget,
              businessCaseSummary,
              archetype,
              objectives,
              demandReportId,
              decisionSpineId: resolvedDecisionSpineId,
            },
          },
          {
            userId,
            organizationId: (req.session as unknown as Record<string, unknown>)?.organizationId as string | undefined,
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || undefined,
            decisionSpineId: resolvedDecisionSpineId,
          },
        );

        if (!governance.canProceedToReasoning) {
          return res.status(403).json({
            error: "Market research request blocked by Corevia Brain governance",
            message: governance.blockedReason || "Request blocked by governance",
            decisionBrain: {
              requestNumber: governance.requestNumber,
              status: "blocked",
            },
          });
        }

        const brainResult: Record<string, unknown> & { decisionId?: string; correlationId?: string; finalStatus?: string; decision?: Record<string, unknown> } = {
          decisionId: governance.requestId,
          correlationId: governance.requestNumber,
          finalStatus: "governed_direct_llm",
          decision: {
            policy: {
              governanceApproved: true,
              requestNumber: governance.requestNumber,
            },
            context: {
              decisionSpineId: resolvedDecisionSpineId,
            },
          },
        };

        logger.info(`[MarketResearch] Generating market research for: ${projectName}`);
        logger.info(`[MarketResearch] Objectives received: ${objectives?.length || 0}`);
        logger.info(`[MarketResearch] Scope inScope items: ${scope?.inScope?.length || 0}`);
        logger.info(`[MarketResearch] Benefits received: ${expectedBenefits?.length || 0}`);
        logger.info(`[MarketResearch] DemandReportId for saving: ${demandReportId || "none"}`);

        // Call MarketResearchService directly (single LLM call, no brain pipeline overhead)
        let result: MarketResearchResult;
        try {
          const researchRequest = {
            projectName,
            projectDescription,
            projectType,
            organization,
            estimatedBudget,
            businessCaseSummary,
            archetype,
            objectives,
            scope,
            strategicAlignment,
            expectedBenefits,
            decisionGovernance: {
              approved: true,
              requestNumber: governance.requestNumber,
            },
          };
          result = await deps.marketResearch.generateMarketResearch(researchRequest) as MarketResearchResult;
        } catch (llmError) {
          logger.error("[MarketResearch] LLM service failed:", llmError);
          // Build a minimal result so the user at least gets something
          result = {
            projectContext: {
              focusArea: projectName || "Project",
              keyObjectives: objectives || [],
              targetCapabilities: [],
            },
            globalMarket: {
              marketSize: "Market data unavailable — AI service did not respond in time",
              growthRate: "N/A",
              keyTrends: [],
              topCountries: [],
              majorPlayers: [],
              technologyLandscape: [],
            },
            uaeMarket: {
              marketSize: "UAE market data unavailable",
              growthRate: "N/A",
              governmentInitiatives: [],
              localPlayers: [],
              opportunities: [],
              regulatoryConsiderations: [],
            },
            suppliers: [],
            useCases: [],
            competitiveAnalysis: {
              directCompetitors: [],
              indirectCompetitors: [],
              marketGaps: [],
            },
            recommendations: ["AI market research generation encountered an issue. Please try again or provide more project details."],
            riskFactors: [],
            generatedAt: new Date().toISOString(),
          };
        }
        const globalPlayerCount = Array.isArray(result.globalMarket?.majorPlayers)
          ? result.globalMarket.majorPlayers.length
          : 0;
        const uaePlayerCount = Array.isArray(result.uaeMarket?.localPlayers)
          ? result.uaeMarket.localPlayers.length
          : 0;
        const useCaseCount = Array.isArray(result.useCases) ? result.useCases.length : 0;

        logger.info(
          `[MarketResearch] Successfully generated research with ${globalPlayerCount} global players, ${uaePlayerCount} UAE players, ${useCaseCount} use cases`,
        );

        if (demandReportId) {
          try {
            await deps.dashboard.saveMarketResearchToBusinessCase(demandReportId, result);
            logger.info(
              `[MarketResearch] Saved research to business case for demand: ${demandReportId}`,
            );
            const decisionSpineId = resolvedDecisionSpineId || brainResult.decisionId;
            if (decisionSpineId) {
              await deps.dashboard.upsertBrainArtifact({
                decisionSpineId,
                artifactType: "MARKET_RESEARCH",
                subDecisionType: "MARKET_RESEARCH",
                content: result as unknown as Record<string, unknown>,
                changeSummary: "Market research generated",
                createdBy: userId,
              });
            }
          } catch (saveError) {
            logger.error("[MarketResearch] Failed to save research:", saveError);
          }
        }

        logger.info(`========== COREVIA BRAIN COMPLETE ==========\n`);

        if (!res.headersSent) {
          res.json({
            success: true,
            data: result,
            decisionBrain: {
              decisionId: brainResult.decisionId,
              correlationId: brainResult.correlationId,
              status: brainResult.finalStatus,
              governance: brainResult.decision?.policy,
              readiness: brainResult.decision?.context,
            },
          });
        }
      } catch (error) {
        // Guard against double-response (e.g., DLP middleware may have already sent response)
        if (res.headersSent) {
          logger.warn("[MarketResearch] Response already sent, skipping error response");
          return;
        }

        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        logger.error("[MarketResearch] Error generating market research:", errorMsg);

        // Provide specific, actionable error messages
        let userMessage: string;
        let statusCode = 500;
        if (errorMsg.includes("permission") || errorMsg.includes("unauthorized") || errorMsg.includes("403")) {
          userMessage = "You do not have permission to generate market research. Contact your administrator.";
          statusCode = 403;
        } else if (errorMsg.includes("pipeline failed") || errorMsg.includes("orchestrator")) {
          userMessage = "The AI pipeline is temporarily unavailable. Please try again in a few minutes.";
        } else if (errorMsg.includes("not produce") || errorMsg.includes("empty")) {
          userMessage = "The AI pipeline did not produce market research results. Please try regenerating.";
        } else if (errorMsg.includes("timeout") || errorMsg.includes("ETIMEDOUT") || errorMsg.includes("timed out")) {
          userMessage = "The request timed out. The AI service may be under heavy load. Please try again.";
        } else if (errorMsg.includes("rate limit") || errorMsg.includes("429")) {
          userMessage = "AI service rate limit reached. Please wait a moment and try again.";
          statusCode = 429;
        } else {
          userMessage = `Market research generation failed: ${errorMsg.substring(0, 200)}`;
        }

        res.status(statusCode).json({
          error: "Failed to generate market research",
          message: userMessage,
        });
      }
    },
  );

  router.post(
    "/ea-external-advisor",
    auth.requireAuth,
    auth.requirePermission("ai:execution-advisor"),
    validateBody(EaExternalAdvisorRequestSchema),
    async (req: Request, res: Response) => {
      try {
        const parsedReq = EaExternalAdvisorRequestSchema.parse(req.body);
        const focus = parsedReq.focus || "all";

        const rawContext = parsedReq.context || {};
        const redacted = redactionGateway.redactObject(rawContext, true);
        const anonymizedContext = redacted.redacted;

        logger.info("[EA External Advisor] Generating advisory package", {
          focus,
          reportId: parsedReq.reportId || null,
          redactions: redacted.stats.totalRedactions,
          userId: req.session.userId,
        });

        const governance = await decisionOrchestrator.intake(
          {
            intent: `Generate EA external advisory (${focus})`,
            decisionType: "ea_external_advisory",
            financialImpact: "low",
            urgency: "low",
            sourceType: "ea_external_advisory",
            sourceContext: {
              focus,
              reportId: parsedReq.reportId || null,
              redactionCount: redacted.stats.totalRedactions,
              anonymizedKeys: Object.keys(anonymizedContext).slice(0, 25),
            },
          },
          {
            userId: req.session.userId!,
            organizationId: (req.session as unknown as Record<string, unknown>)?.organizationId as string | undefined,
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || undefined,
          },
        );

        const governanceBlocked = !governance.canProceedToReasoning;

        if (governanceBlocked) {
          logger.warn("[EA External Advisor] Governance blocked advisory route; continuing with anonymized advisory-only generation", {
            requestNumber: governance.requestNumber,
            blockedReason: governance.blockedReason || null,
            reportId: parsedReq.reportId || null,
            userId: req.session.userId,
          });
        }

        const { payload, provider } = await generateEaAdvisoryWithExternalAi(deps.externalAI, focus, anonymizedContext);
        const savedPayload = {
          ...payload,
          externalProvider: provider,
          anonymized: true,
          generatedAt: new Date().toISOString(),
        };

        let persisted = false;
        let decisionSpineId: string | null = null;

        if (parsedReq.reportId) {
          decisionSpineId = await resolveDecisionSpineIdForReport(deps, parsedReq.reportId);
          if (decisionSpineId) {
            await deps.dashboard.upsertBrainArtifact({
              decisionSpineId,
              artifactType: "EA_EXTERNAL_ADVISORY",
              subDecisionType: "EA_EXTERNAL_ADVISORY",
              content: savedPayload as unknown as Record<string, unknown>,
              changeSummary: `EA external advisory generated (${focus})`,
              createdBy: req.session.userId!,
            });
            persisted = true;
          }
        }

        return res.json({
          success: true,
          data: savedPayload,
          meta: {
            focus,
            redactionStats: redacted.stats,
            reportId: parsedReq.reportId || null,
            requestNumber: governance.requestNumber,
            decisionSpineId,
            persisted,
            governance: {
              advisoryOnlyBypass: governanceBlocked,
              status: governanceBlocked ? "bypassed" : "approved",
              blockedReason: governanceBlocked ? (governance.blockedReason || "Request blocked by governance") : null,
            },
          },
        });
      } catch (error) {
        logger.error("[EA External Advisor] Error:", error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Failed to generate EA external advisory",
        });
      }
    },
  );

  router.get(
    "/ea-external-advisor/latest/:reportId",
    auth.requireAuth,
    auth.requirePermission("ai:execution-advisor"),
    async (req: Request, res: Response) => {
      try {
        const reportId = String(req.params.reportId || "").trim();
        if (!reportId) {
          return res.status(400).json({ success: false, error: "reportId is required" });
        }

        const decisionSpineId = await resolveDecisionSpineIdForReport(deps, reportId);
        if (!decisionSpineId) {
          return res.json({ success: true, data: null });
        }

        const { coreviaStorage } = await import("@brain");
        const latest = await coreviaStorage.getLatestDecisionArtifactVersion({
          decisionSpineId,
          artifactType: "EA_EXTERNAL_ADVISORY",
        });

        if (!latest) {
          return res.json({ success: true, data: null });
        }

        return res.json({
          success: true,
          data: latest.content,
          meta: {
            decisionSpineId,
            artifactVersionId: latest.artifactVersionId,
            version: latest.version,
            savedAt: latest.createdAt,
          },
        });
      } catch (error) {
        logger.error("[EA External Advisor] Failed to load latest advisory:", error);
        return res.status(500).json({ success: false, error: "Failed to load latest EA external advisory" });
      }
    },
  );

  // ============================================================================
  // COVERIA INTELLIGENCE ROUTES
  // ============================================================================

  router.post("/coveria/record-interaction", validateBody(recordInteractionSchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const result = await recordCoveriaInteraction(deps, req.body);
      if (!result.success) return res.status(result.status).json({ error: result.error, details: result.details });
      res.json({ success: true, message: "Interaction recorded for learning" });
    } catch (error) {
      logger.error("[CoveriaIntelligence] Error recording interaction:", error);
      res.status(500).json({ error: "Failed to record interaction" });
    }
  });

  router.get("/coveria/intelligence-state", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const result = await getCoveriaIntelligenceState(deps);
      res.json({ success: true, data: result.success ? result.data : null });
    } catch (error) {
      logger.error("[CoveriaIntelligence] Error getting intelligence state:", error);
      res.status(500).json({ error: "Failed to get intelligence state" });
    }
  });

  router.get("/coveria/insights", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const result = await getCoveriaInsights(deps, req.session.userId);
      res.json({ success: true, data: result.success ? result.data : null });
    } catch (error) {
      logger.error("[CoveriaIntelligence] Error getting insights:", error);
      res.status(500).json({ error: "Failed to get insights" });
    }
  });

  router.post("/coveria/insights/:id/dismiss", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const insightId = req.params.id;
    if (!insightId || insightId.length > 100) {
      return res.status(400).json({ error: "Invalid insight ID" });
    }

    try {
      const result = await dismissCoveriaInsight(deps, insightId, req.session.userId);
      if (result.success && !result.data.dismissed) {
        return res.status(404).json({ error: "Insight not found or not authorized" });
      }
      res.json({ success: true, message: "Insight dismissed" });
    } catch (error) {
      logger.error("[CoveriaIntelligence] Error dismissing insight:", error);
      res.status(500).json({ error: "Failed to dismiss insight" });
    }
  });

  router.get("/coveria/daily-briefing", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const result = await getCoveriaDailyBriefing(deps, req.session.userId);
      res.json({ success: true, data: result.success ? result.data : null });
    } catch (error) {
      logger.error("[CoveriaIntelligence] Error generating daily briefing:", error);
      res.status(500).json({ error: "Failed to generate daily briefing" });
    }
  });

  router.post("/coveria/response-prefix", validateBody(responsePrefixSchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const validatedData = responsePrefixSchema.parse(req.body);
      const result = getCoveriaResponsePrefix(deps, validatedData);
      res.json({ success: true, data: result.success ? result.data : null });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("[CoveriaIntelligence] Error getting response prefix:", error);
      res.status(500).json({ error: "Failed to get response prefix" });
    }
  });

  // ──────────────────── Unified notification hub ────────────────────
  router.get("/unified-notifications", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const userId = req.session.userId;
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const sourceFilter = req.query.source as string | undefined;
      const unreadOnly = req.query.unreadOnly === "true";

      const results: UnifiedNotificationItem[] = [];

      // 1) System notifications
      if (!sourceFilter || sourceFilter === "system") {
        const items = await deps.notifHub.getSystemNotifications(userId, limit, unreadOnly);
        results.push(...items);
      }

      // 2) AI notifications
      if (!sourceFilter || sourceFilter === "ai") {
        const items = await deps.notifHub.getAiNotifications(userId, limit, unreadOnly);
        results.push(...items);
      }

      // 3) Tender notifications
      if (!sourceFilter || sourceFilter === "tender") {
        const items = await deps.notifHub.getTenderNotifications(userId, limit, unreadOnly);
        results.push(...items);
      }

      // 4) Brain events
      if (!sourceFilter || sourceFilter === "brain") {
        const items = await deps.notifHub.getBrainEventNotifications(Math.min(limit, 30));
        results.push(...items);
      }

      // Sort notifications by createdAt descending
      results.sort(
        (a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return dateB.getTime() - dateA.getTime();
        }
      );
      const finalResults = results.slice(0, limit);

      const unreadCounts = {
        system: results.filter((r) => r.source === "system" && !r.isRead).length,
        ai: results.filter((r) => r.source === "ai" && !r.isRead).length,
        tender: results.filter((r) => r.source === "tender" && !r.isRead).length,
        brain: 0,
      };

      res.json({
        success: true,
        data: finalResults,
        meta: {
          total: finalResults.length,
          unreadCounts,
          totalUnread: unreadCounts.system + unreadCounts.ai + unreadCounts.tender,
        },
      });
    } catch (error) {
      logger.error("[AI Assistant] Error fetching unified notifications:", error);
      res.status(500).json({ error: "Failed to fetch unified notifications" });
    }
  });

  router.patch("/unified-notifications/:id/read", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const id = req.params.id as string;
      const source = req.query.source as string;

      if (source === "ai") {
        await deps.notifHub.markAiNotificationRead(id);
      } else if (source === "tender") {
        await deps.notifHub.markTenderNotificationRead(id);
      } else {
        await deps.repo.markNotificationAsRead(id);
      }

      res.json({ success: true });
    } catch (error) {
      logger.error("[AI Assistant] Error marking unified notification read:", error);
      res.status(500).json({ error: "Failed to mark notification read" });
    }
  });

  router.post("/unified-notifications/read-all", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const userId = req.session.userId;
      await Promise.all([
        deps.repo.markAllNotificationsAsRead(userId),
        deps.notifHub.markAllRead(userId),
      ]);

      res.json({ success: true, message: "All notifications marked as read" });
    } catch (error) {
      logger.error("[AI Assistant] Error marking all unified notifications read:", error);
      res.status(500).json({ error: "Failed to mark all read" });
    }
  });

  // ──────────────────── AI-generated file exports ────────────────────────────
  // Serves PDF / Excel files generated by export_pdf_report / export_excel_report tools.
  // Filename is validated to prevent path traversal — only simple alphanumeric + _ - . allowed.

  router.get("/exports/:filename", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { filename } = req.params;

    // Strict filename validation — no path traversal, no hidden files
    if (!filename || !/^[a-zA-Z0-9_\-. ]+$/.test(filename) || filename.startsWith('.')) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    const exportDirs = [
      process.env.COREVIA_EXPORTS_DIR,
      path.resolve(process.cwd(), 'app_data', 'exports'),
      path.resolve(process.cwd(), 'uploads', 'exports'),
      '/tmp/corevia-exports',
    ].filter((v): v is string => typeof v === 'string' && v.length > 0);

    let filePath: string | null = null;
    for (const exportsDir of exportDirs) {
      const candidate = path.resolve(exportsDir, filename);
      // Ensure the resolved path stays inside the candidate exports dir
      if (!candidate.startsWith(exportsDir + path.sep) && candidate !== exportsDir) continue;
      if (fs.existsSync(candidate)) {
        filePath = candidate;
        break;
      }
    }

    if (!filePath) {
      return res.status(404).json({ error: "File not found" });
    }

    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.csv': 'text/csv',
    };
    const contentType = mimeTypes[ext] ?? 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-cache');
    fs.createReadStream(filePath).pipe(res);
  });

  return router;
}
