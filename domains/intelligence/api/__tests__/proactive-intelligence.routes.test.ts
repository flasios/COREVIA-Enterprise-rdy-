/**
 * Proactive Intelligence Routes — Unit Tests
 *
 * Tests proactive intelligence endpoints:
 *   - Session auth on all endpoints
 *   - Anomalies, risk predictions, daily briefing
 *   - Workflow execution, auto-alerts
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const detectAnomaliesMock = vi.fn();
const calculateRiskPredictionsMock = vi.fn();
const generateDailyBriefingMock = vi.fn();
const executeWorkflowMock = vi.fn();
const createAutoAlertsMock = vi.fn();

vi.mock("../../application", () => ({
  detectAnomalies: (...a: unknown[]) => detectAnomaliesMock(...a),
  calculateRiskPredictions: (...a: unknown[]) => calculateRiskPredictionsMock(...a),
  generateDailyBriefing: (...a: unknown[]) => generateDailyBriefingMock(...a),
  executeWorkflow: (...a: unknown[]) => executeWorkflowMock(...a),
  createAutoAlerts: (...a: unknown[]) => createAutoAlertsMock(...a),
  buildProactiveDeps: vi.fn(() => ({ deps: true })),
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

const { createProactiveIntelligenceRoutes } = await import("../proactive-intelligence.routes");

function createApp(userId?: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    next();
  });
  app.use(createProactiveIntelligenceRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Proactive Intelligence Routes", () => {
  describe("auth enforcement", () => {
    it("rejects unauthenticated GET /anomalies", async () => {
      await request(createApp()).get("/anomalies").expect(401);
    });
    it("rejects unauthenticated GET /risk-predictions", async () => {
      await request(createApp()).get("/risk-predictions").expect(401);
    });
    it("rejects unauthenticated POST /execute-workflow", async () => {
      await request(createApp()).post("/execute-workflow").send({ steps: [] }).expect(401);
    });
  });

  describe("GET /anomalies", () => {
    it("returns detected anomalies", async () => {
      detectAnomaliesMock.mockResolvedValue({ success: true, anomalies: [] });
      const res = await request(createApp("u1")).get("/anomalies").expect(200);
      expect(res.body).toEqual({ success: true, anomalies: [] });
    });
  });

  describe("GET /risk-predictions", () => {
    it("returns risk predictions", async () => {
      calculateRiskPredictionsMock.mockResolvedValue({ success: true, risks: [] });
      await request(createApp("u1")).get("/risk-predictions").expect(200);
    });
  });

  describe("GET /daily-briefing", () => {
    it("returns daily briefing", async () => {
      generateDailyBriefingMock.mockResolvedValue({ success: true, briefing: {} });
      await request(createApp("u1")).get("/daily-briefing").expect(200);
    });
  });

  describe("POST /execute-workflow", () => {
    it("executes workflow", async () => {
      executeWorkflowMock.mockResolvedValue({ success: true, data: { executed: true } });
      const res = await request(createApp("u1"))
        .post("/execute-workflow")
        .send({ steps: [{ action: "notify" }] })
        .expect(200);
      expect(res.body).toEqual({ success: true, data: { executed: true } });
    });

    it("forwards workflow error", async () => {
      executeWorkflowMock.mockResolvedValue({ success: false, status: 400, error: "Invalid step" });
      await request(createApp("u1")).post("/execute-workflow").send({ steps: [] }).expect(400);
    });
  });

  describe("POST /auto-alerts", () => {
    it("creates auto alerts", async () => {
      createAutoAlertsMock.mockResolvedValue({ success: true, count: 3 });
      const res = await request(createApp("u1")).post("/auto-alerts").expect(200);
      expect(res.body).toEqual({ success: true, count: 3 });
    });
  });
});
