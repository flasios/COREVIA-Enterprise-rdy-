/**
 * Knowledge Insights Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getInsightDashboardMock = vi.fn();
const getActiveAlertsMock = vi.fn();
const listInsightEventsMock = vi.fn();
const getInsightEventByIdMock = vi.fn();
const acknowledgeEventMock = vi.fn();
const resolveEventMock = vi.fn();
const dismissEventMock = vi.fn();
const runGapDetectionMock = vi.fn();
const generateInsightsMock = vi.fn();
const listInsightRulesMock = vi.fn();
const createInsightRuleMock = vi.fn();
const evaluateInsightRuleMock = vi.fn();
const toggleInsightRuleMock = vi.fn();
const deleteInsightRuleMock = vi.fn();

vi.mock("../../application", () => ({
  buildKnowledgeInsightsDeps: vi.fn(() => ({})),
  getInsightDashboard: (...a: unknown[]) => getInsightDashboardMock(...a),
  getActiveAlerts: (...a: unknown[]) => getActiveAlertsMock(...a),
  listInsightEvents: (...a: unknown[]) => listInsightEventsMock(...a),
  getInsightEventById: (...a: unknown[]) => getInsightEventByIdMock(...a),
  acknowledgeEvent: (...a: unknown[]) => acknowledgeEventMock(...a),
  resolveEvent: (...a: unknown[]) => resolveEventMock(...a),
  dismissEvent: (...a: unknown[]) => dismissEventMock(...a),
  runGapDetection: (...a: unknown[]) => runGapDetectionMock(...a),
  generateInsights: (...a: unknown[]) => generateInsightsMock(...a),
  listInsightRules: (...a: unknown[]) => listInsightRulesMock(...a),
  createInsightRule: (...a: unknown[]) => createInsightRuleMock(...a),
  evaluateInsightRule: (...a: unknown[]) => evaluateInsightRuleMock(...a),
  toggleInsightRule: (...a: unknown[]) => toggleInsightRuleMock(...a),
  deleteInsightRule: (...a: unknown[]) => deleteInsightRuleMock(...a),
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

const { createKnowledgeInsightsRoutes } = await import("../knowledge-insights.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    next();
  });
  app.use(createKnowledgeInsightsRoutes({} as never));
  return app;
}

const ok = (data: unknown) => ({ success: true as const, data });

beforeEach(() => vi.clearAllMocks());

describe("Knowledge Insights Routes", () => {
  describe("GET /dashboard", () => {
    it("returns insight dashboard", async () => {
      getInsightDashboardMock.mockResolvedValue(ok({ totalEvents: 5 }));
      const res = await request(createApp()).get("/dashboard").expect(200);
      expect(res.body.data).toEqual({ totalEvents: 5 });
    });
  });

  describe("GET /alerts", () => {
    it("returns active alerts", async () => {
      getActiveAlertsMock.mockResolvedValue(ok([{ id: "a1" }]));
      const res = await request(createApp()).get("/alerts").expect(200);
      expect(res.body.data).toEqual([{ id: "a1" }]);
    });
  });

  describe("GET /events", () => {
    it("lists insight events", async () => {
      listInsightEventsMock.mockResolvedValue(ok([{ id: "ev1" }]));
      const res = await request(createApp()).get("/events").expect(200);
      expect(res.body.data).toEqual([{ id: "ev1" }]);
    });
  });

  describe("GET /events/:eventId", () => {
    it("returns event by id", async () => {
      getInsightEventByIdMock.mockResolvedValue(ok({ id: "ev1", category: "risk" }));
      const res = await request(createApp()).get("/events/ev1").expect(200);
      expect(res.body.data).toEqual({ id: "ev1", category: "risk" });
    });
  });

  describe("POST /events/:eventId/acknowledge", () => {
    it("acknowledges event", async () => {
      acknowledgeEventMock.mockResolvedValue(ok({ acknowledged: true }));
      await request(createApp()).post("/events/ev1/acknowledge").expect(200);
    });
  });

  describe("POST /events/:eventId/resolve", () => {
    it("resolves event", async () => {
      resolveEventMock.mockResolvedValue(ok({ resolved: true }));
      await request(createApp())
        .post("/events/ev1/resolve")
        .send({ resolutionNotes: "Fixed" })
        .expect(200);
    });
  });

  describe("POST /events/:eventId/dismiss", () => {
    it("dismisses event", async () => {
      dismissEventMock.mockResolvedValue(ok({ dismissed: true }));
      await request(createApp())
        .post("/events/ev1/dismiss")
        .send({ reason: "Not relevant" })
        .expect(200);
    });
  });

  describe("POST /analyze-gaps", () => {
    it("runs gap detection", async () => {
      runGapDetectionMock.mockResolvedValue(ok({ gaps: [] }));
      const res = await request(createApp()).post("/analyze-gaps").expect(200);
      expect(res.body.data).toEqual({ gaps: [] });
    });
  });

  describe("POST /generate", () => {
    it("generates insights", async () => {
      generateInsightsMock.mockResolvedValue(ok({ generated: 3 }));
      await request(createApp()).post("/generate").expect(200);
    });
  });

  describe("GET /rules", () => {
    it("lists insight rules", async () => {
      listInsightRulesMock.mockResolvedValue(ok([{ id: "r1" }]));
      const res = await request(createApp()).get("/rules").expect(200);
      expect(res.body.data).toEqual([{ id: "r1" }]);
    });
  });

  describe("POST /rules", () => {
    it("creates insight rule", async () => {
      createInsightRuleMock.mockResolvedValue(ok({ id: "r2" }));
      await request(createApp())
        .post("/rules")
        .send({ name: "High risk", ruleType: "threshold", conditions: {}, actions: {} })
        .expect(200);
    });
  });

  describe("POST /rules/:ruleId/evaluate", () => {
    it("evaluates insight rule", async () => {
      evaluateInsightRuleMock.mockResolvedValue(ok({ triggered: false }));
      await request(createApp()).post("/rules/r1/evaluate").expect(200);
    });
  });

  describe("PATCH /rules/:ruleId/toggle", () => {
    it("toggles insight rule", async () => {
      toggleInsightRuleMock.mockResolvedValue(ok({ isActive: false }));
      await request(createApp())
        .patch("/rules/r1/toggle")
        .send({ isActive: false })
        .expect(200);
    });
  });

  describe("DELETE /rules/:ruleId", () => {
    it("deletes insight rule", async () => {
      deleteInsightRuleMock.mockResolvedValue(ok(null));
      await request(createApp()).delete("/rules/r1").expect(200);
    });
  });
});
