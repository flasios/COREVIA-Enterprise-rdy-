/**
 * AI Assistant Routes — Unit Tests
 *
 * Tests the Coveria AI assistant endpoints:
 *   - Session auth enforcement on all endpoints
 *   - Chat, execute-action, conversations CRUD
 *   - Tasks, reminders, documents CRUD
 *   - Notifications, Coveria intelligence, daily briefing
 *   - Record interaction, response prefix, EA advisory
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const quickChatMock = vi.fn();
const recordCoveriaInteractionMock = vi.fn();
const getCoveriaIntelligenceStateMock = vi.fn();
const getCoveriaInsightsMock = vi.fn();
const dismissCoveriaInsightMock = vi.fn();
const getCoveriaDailyBriefingMock = vi.fn();
const getCoveriaResponsePrefixMock = vi.fn();
const generateEaAdvisoryWithExternalAiMock = vi.fn();

const createConversationMock = vi.fn();
const getConversationsMock = vi.fn();
const getConversationMock = vi.fn();
const getMessagesMock = vi.fn();
const chatMock = vi.fn();
const archiveConversationMock = vi.fn();
const getNotificationsMock = vi.fn();
const markNotificationReadMock = vi.fn();
const dismissNotificationMock = vi.fn();

const itemsCreateMock = vi.fn();
const itemsFindByUserAndTypeMock = vi.fn();
const itemsUpdateMock = vi.fn();
const itemsDeleteMock = vi.fn();

const getRepoUserMock = vi.fn();
const createNotificationRepoMock = vi.fn();
const getDemandReportMock = vi.fn();

vi.mock("../../application", () => ({
  quickChat: (...a: unknown[]) => quickChatMock(...a),
  recordCoveriaInteraction: (...a: unknown[]) => recordCoveriaInteractionMock(...a),
  getCoveriaIntelligenceState: (...a: unknown[]) => getCoveriaIntelligenceStateMock(...a),
  getCoveriaInsights: (...a: unknown[]) => getCoveriaInsightsMock(...a),
  dismissCoveriaInsight: (...a: unknown[]) => dismissCoveriaInsightMock(...a),
  getCoveriaDailyBriefing: (...a: unknown[]) => getCoveriaDailyBriefingMock(...a),
  getCoveriaResponsePrefix: (...a: unknown[]) => getCoveriaResponsePrefixMock(...a),
  generateEaAdvisoryWithExternalAi: (...a: unknown[]) => generateEaAdvisoryWithExternalAiMock(...a),
  EaExternalAdvisorRequestSchema: { parse: (v: unknown) => v },
  responsePrefixSchema: { parse: (v: unknown) => v },
  buildAIAssistantDeps: vi.fn(() => ({
    aiAssistant: {
      createConversation: (...a: unknown[]) => createConversationMock(...a),
      getConversations: (...a: unknown[]) => getConversationsMock(...a),
      getConversation: (...a: unknown[]) => getConversationMock(...a),
      getMessages: (...a: unknown[]) => getMessagesMock(...a),
      chat: (...a: unknown[]) => chatMock(...a),
      archiveConversation: (...a: unknown[]) => archiveConversationMock(...a),
      getNotifications: (...a: unknown[]) => getNotificationsMock(...a),
      markNotificationRead: (...a: unknown[]) => markNotificationReadMock(...a),
      dismissNotification: (...a: unknown[]) => dismissNotificationMock(...a),
      getProactiveInsights: vi.fn().mockResolvedValue([]),
    },
    items: {
      create: (...a: unknown[]) => itemsCreateMock(...a),
      findByUserAndType: (...a: unknown[]) => itemsFindByUserAndTypeMock(...a),
      update: (...a: unknown[]) => itemsUpdateMock(...a),
      delete: (...a: unknown[]) => itemsDeleteMock(...a),
    },
    repo: {
      getUser: (...a: unknown[]) => getRepoUserMock(...a),
      createNotification: (...a: unknown[]) => createNotificationRepoMock(...a),
      getDemandReport: (...a: unknown[]) => getDemandReportMock(...a),
    },
    coveriaIntelligence: {
      recordInteraction: vi.fn().mockResolvedValue(undefined),
    },
    dashboard: {
      getRecentBrainEvents: vi.fn().mockResolvedValue([]),
      createAiNotification: vi.fn().mockResolvedValue({ id: "notif1" }),
      getDemandCount: vi.fn().mockResolvedValue(10),
      getProjectCount: vi.fn().mockResolvedValue(5),
      getCompletedDemandCount: vi.fn().mockResolvedValue(3),
      searchBrainEvents: vi.fn().mockResolvedValue([]),
      searchDemands: vi.fn().mockResolvedValue([]),
      upsertBrainArtifact: vi.fn().mockResolvedValue({}),
      saveMarketResearchToBusinessCase: vi.fn().mockResolvedValue({}),
    },
    externalAI: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  }),
}));

vi.mock("@interfaces/middleware/validateBody", () => ({
  validateBody: () => (req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@brain", () => ({
  redactionGateway: {
    classify: vi.fn(),
    redactObject: vi.fn().mockReturnValue({ redacted: {}, stats: { totalRedactions: 0 } }),
  },
}));

vi.mock("@platform/decision/decisionOrchestrator", () => ({
  decisionOrchestrator: {
    intake: vi.fn().mockResolvedValue({ canProceedToReasoning: true, requestNumber: "R1" }),
  },
}));

const { createAIAssistantRoutes } = await import("../ai-assistant.routes");

function createApp(userId?: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    next();
  });
  app.use(createAIAssistantRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("AI Assistant Routes", () => {
  /* ── Auth enforcement ─────────────────────────────────────── */

  describe("auth enforcement", () => {
    it("rejects unauthenticated POST /chat", async () => {
      await request(createApp()).post("/chat").send({ message: "hi" }).expect(401);
    });
    it("rejects unauthenticated POST /execute-action", async () => {
      await request(createApp()).post("/execute-action").send({ actionType: "report" }).expect(401);
    });
    it("rejects unauthenticated GET /conversations", async () => {
      await request(createApp()).get("/conversations").expect(401);
    });
    it("rejects unauthenticated GET /tasks", async () => {
      await request(createApp()).get("/tasks").expect(401);
    });
    it("rejects unauthenticated GET /notifications", async () => {
      await request(createApp()).get("/notifications").expect(401);
    });
  });

  /* ── Chat ──────────────────────────────────────────────────── */

  describe("POST /chat", () => {
    it("returns chat response", async () => {
      quickChatMock.mockResolvedValue({ success: true, data: { response: "Hello!" } });
      const res = await request(createApp("u1"))
        .post("/chat")
        .send({ message: "hi" })
        .expect(200);
      expect(res.body).toEqual({ success: true, response: "Hello!" });
    });

    it("forwards chat failure", async () => {
      quickChatMock.mockResolvedValue({ success: false, status: 503, error: "LLM down" });
      await request(createApp("u1")).post("/chat").send({ message: "hi" }).expect(503);
    });
  });

  /* ── Execute action ────────────────────────────────────────── */

  describe("POST /execute-action", () => {
    it("executes report action", async () => {
      const res = await request(createApp("u1"))
        .post("/execute-action")
        .send({ actionType: "report", actionData: {} })
        .expect(200);
      expect(res.body.success).toBe(true);
    });

    it("creates alert notification", async () => {
      createNotificationRepoMock.mockResolvedValue({ id: "n1" });
      await request(createApp("u1"))
        .post("/execute-action")
        .send({ actionType: "alert", actionData: { title: "Test", message: "msg" } })
        .expect(200);
      expect(createNotificationRepoMock).toHaveBeenCalled();
    });
  });

  /* ── Conversations ─────────────────────────────────────────── */

  describe("POST /conversations", () => {
    it("creates conversation", async () => {
      createConversationMock.mockResolvedValue({ id: "c1" });
      const res = await request(createApp("u1"))
        .post("/conversations")
        .send({ title: "Test" })
        .expect(200);
      expect(res.body).toEqual({ success: true, data: { id: "c1" } });
    });
  });

  describe("GET /conversations", () => {
    it("lists conversations", async () => {
      getConversationsMock.mockResolvedValue([{ id: "c1" }]);
      const res = await request(createApp("u1")).get("/conversations").expect(200);
      expect(res.body.data).toEqual([{ id: "c1" }]);
    });
  });

  describe("GET /conversations/:id", () => {
    it("returns conversation", async () => {
      getConversationMock.mockResolvedValue({ id: "c1", title: "Test" });
      const res = await request(createApp("u1")).get("/conversations/c1").expect(200);
      expect(res.body.data).toEqual({ id: "c1", title: "Test" });
    });

    it("returns 404 for missing conversation", async () => {
      getConversationMock.mockResolvedValue(null);
      await request(createApp("u1")).get("/conversations/bad").expect(404);
    });
  });

  describe("POST /conversations/:id/chat", () => {
    it("sends message in conversation", async () => {
      getRepoUserMock.mockResolvedValue({ displayName: "Alice" });
      chatMock.mockResolvedValue({ response: "Sure!" });
      const res = await request(createApp("u1"))
        .post("/conversations/c1/chat")
        .send({ message: "help me" })
        .expect(200);
      expect(res.body.data).toEqual({ response: "Sure!" });
    });
  });

  describe("DELETE /conversations/:id", () => {
    it("archives conversation", async () => {
      archiveConversationMock.mockResolvedValue(undefined);
      await request(createApp("u1")).delete("/conversations/c1").expect(200);
      expect(archiveConversationMock).toHaveBeenCalledWith("c1");
    });
  });

  /* ── Tasks ─────────────────────────────────────────────────── */

  describe("POST /tasks", () => {
    it("creates task", async () => {
      itemsCreateMock.mockResolvedValue({ id: "task1" });
      const res = await request(createApp("u1"))
        .post("/tasks")
        .send({ title: "Do thing" })
        .expect(200);
      expect(res.body.data).toEqual({ id: "task1" });
    });
  });

  describe("GET /tasks", () => {
    it("lists tasks", async () => {
      itemsFindByUserAndTypeMock.mockResolvedValue([{ id: "task1" }]);
      const res = await request(createApp("u1")).get("/tasks").expect(200);
      expect(res.body.data).toEqual([{ id: "task1" }]);
    });
  });

  describe("PATCH /tasks/:id", () => {
    it("updates task", async () => {
      itemsUpdateMock.mockResolvedValue({ id: "task1", isDismissed: true });
      const res = await request(createApp("u1"))
        .patch("/tasks/task1")
        .send({ completed: true })
        .expect(200);
      expect(res.body.data.completed).toBe(true);
    });

    it("returns 404 for missing task", async () => {
      itemsUpdateMock.mockResolvedValue(null);
      await request(createApp("u1")).patch("/tasks/bad").send({ completed: true }).expect(404);
    });
  });

  describe("DELETE /tasks/:id", () => {
    it("deletes task", async () => {
      itemsDeleteMock.mockResolvedValue(undefined);
      await request(createApp("u1")).delete("/tasks/task1").expect(200);
    });
  });

  /* ── Reminders ─────────────────────────────────────────────── */

  describe("POST /reminders", () => {
    it("creates reminder", async () => {
      itemsCreateMock.mockResolvedValue({ id: "r1" });
      await request(createApp("u1")).post("/reminders").send({}).expect(200);
    });
  });

  describe("GET /reminders", () => {
    it("lists reminders", async () => {
      itemsFindByUserAndTypeMock.mockResolvedValue([]);
      await request(createApp("u1")).get("/reminders").expect(200);
    });
  });

  /* ── Documents ─────────────────────────────────────────────── */

  describe("POST /documents", () => {
    it("creates document", async () => {
      itemsCreateMock.mockResolvedValue({ id: "d1" });
      await request(createApp("u1")).post("/documents").send({}).expect(200);
    });
  });

  describe("GET /documents", () => {
    it("lists documents", async () => {
      itemsFindByUserAndTypeMock.mockResolvedValue([]);
      await request(createApp("u1")).get("/documents").expect(200);
    });
  });

  describe("PATCH /documents/:id", () => {
    it("updates document", async () => {
      itemsUpdateMock.mockResolvedValue({ id: "d1", title: "Updated" });
      await request(createApp("u1")).patch("/documents/d1").send({ title: "Updated" }).expect(200);
    });

    it("returns 404 for missing document", async () => {
      itemsUpdateMock.mockResolvedValue(null);
      await request(createApp("u1")).patch("/documents/bad").send({ title: "x" }).expect(404);
    });
  });

  /* ── Notifications (AI Assistant) ──────────────────────────── */

  describe("GET /notifications", () => {
    it("returns notifications", async () => {
      getNotificationsMock.mockResolvedValue([{ id: "n1" }]);
      const res = await request(createApp("u1")).get("/notifications").expect(200);
      expect(res.body.data).toEqual([{ id: "n1" }]);
    });
  });

  describe("PATCH /notifications/:id/read", () => {
    it("marks notification read", async () => {
      markNotificationReadMock.mockResolvedValue(undefined);
      await request(createApp("u1")).patch("/notifications/n1/read").expect(200);
    });
  });

  describe("PATCH /notifications/:id/dismiss", () => {
    it("dismisses notification", async () => {
      dismissNotificationMock.mockResolvedValue(undefined);
      await request(createApp("u1")).patch("/notifications/n1/dismiss").expect(200);
    });
  });

  /* ── Coveria Intelligence ──────────────────────────────────── */

  describe("GET /coveria/intelligence-state", () => {
    it("returns intelligence state", async () => {
      getCoveriaIntelligenceStateMock.mockResolvedValue({ success: true, data: { mood: "focused" } });
      const res = await request(createApp("u1")).get("/coveria/intelligence-state").expect(200);
      expect(res.body.data).toEqual({ mood: "focused" });
    });
  });

  describe("GET /coveria/insights", () => {
    it("returns insights", async () => {
      getCoveriaInsightsMock.mockResolvedValue({ success: true, data: [{ id: "i1" }] });
      const res = await request(createApp("u1")).get("/coveria/insights").expect(200);
      expect(res.body.data).toEqual([{ id: "i1" }]);
    });
  });

  describe("POST /coveria/insights/:id/dismiss", () => {
    it("dismisses insight", async () => {
      dismissCoveriaInsightMock.mockResolvedValue({ success: true, data: { dismissed: true } });
      await request(createApp("u1")).post("/coveria/insights/i1/dismiss").expect(200);
    });
  });

  describe("GET /coveria/daily-briefing", () => {
    it("returns daily briefing", async () => {
      getCoveriaDailyBriefingMock.mockResolvedValue({ success: true, data: { summary: "All good" } });
      const res = await request(createApp("u1")).get("/coveria/daily-briefing").expect(200);
      expect(res.body.data).toEqual({ summary: "All good" });
    });
  });

  /* ── Interaction recording ─────────────────────────────────── */

  describe("POST /coveria/record-interaction", () => {
    it("records interaction", async () => {
      recordCoveriaInteractionMock.mockResolvedValue({ success: true });
      const res = await request(createApp("u1"))
        .post("/coveria/record-interaction")
        .send({ userInput: "hi", coveriaResponse: "hello" })
        .expect(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("POST /coveria/response-prefix", () => {
    it("generates response prefix", async () => {
      getCoveriaResponsePrefixMock.mockReturnValue({ success: true, data: { prefix: "🎯" } });
      const res = await request(createApp("u1"))
        .post("/coveria/response-prefix")
        .send({ isUrgent: true })
        .expect(200);
      expect(res.body.data).toEqual({ prefix: "🎯" });
    });
  });

  /* ── EA Advisory ───────────────────────────────────────────── */

  describe("POST /ea-external-advisor", () => {
    it("generates EA advisory", async () => {
      generateEaAdvisoryWithExternalAiMock.mockResolvedValue({
        payload: { advice: "migrate" },
        provider: "openai",
      });
      const res = await request(createApp("u1"))
        .post("/ea-external-advisor")
        .send({ focus: "all", context: {} })
        .expect(200);
      expect(res.body.success).toBe(true);
    });

    it("forwards advisory failure", async () => {
      generateEaAdvisoryWithExternalAiMock.mockRejectedValue(new Error("LLM error"));
      await request(createApp("u1"))
        .post("/ea-external-advisor")
        .send({ focus: "all" })
        .expect(500);
    });
  });
});
