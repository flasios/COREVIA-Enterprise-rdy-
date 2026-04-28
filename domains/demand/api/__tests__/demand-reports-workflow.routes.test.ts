/**
 * Demand Reports Workflow Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const updateWorkflowStatusMock = vi.fn();
const getWorkflowHistoryMock = vi.fn();
const notifyCoveriaSpecialistMock = vi.fn();

vi.mock("../../application/buildDeps", () => ({
  buildDemandDeps: () => ({ reports: {}, brain: {}, versions: {}, businessCase: {} }),
}));

vi.mock("../../application", () => ({
  updateWorkflowStatus: (...a: unknown[]) => updateWorkflowStatusMock(...a),
  getWorkflowHistory: (...a: unknown[]) => getWorkflowHistoryMock(...a),
  notifyCoveriaSpecialist: (...a: unknown[]) => notifyCoveriaSpecialistMock(...a),
}));

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  }),
}));

vi.mock("@interfaces/middleware/validateBody", () => ({
  validateBody: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { createDemandReportsWorkflowRoutes } = await import("../demand-reports-workflow.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    (req as unknown as Record<string, unknown>).user = { id: userId, role: "admin" };
    req.auth = { userId, role: "admin" } as unknown as typeof req.auth;
    next();
  });
  app.use(createDemandReportsWorkflowRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Demand Reports Workflow Routes", () => {
  describe("PUT /:id/workflow", () => {
    it("updates workflow status", async () => {
      updateWorkflowStatusMock.mockResolvedValue({
        success: true, data: { report: { id: "r1" }, notificationSent: false, brainSyncCompleted: false },
      });
      const res = await request(createApp()).put("/r1/workflow").send({ status: "submitted" }).expect(200);
      expect(res.body.success).toBe(true);
    });

    it("returns error on failure", async () => {
      updateWorkflowStatusMock.mockResolvedValue({ success: false, status: 400, error: "Invalid" });
      await request(createApp()).put("/r1/workflow").send({}).expect(400);
    });
  });

  describe("GET /:id/workflow-history", () => {
    it("returns workflow history", async () => {
      getWorkflowHistoryMock.mockResolvedValue({ success: true, data: [{ action: "submitted" }] });
      const res = await request(createApp()).get("/r1/workflow-history").expect(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("POST /:id/coveria-notify-specialist", () => {
    it("notifies specialist", async () => {
      notifyCoveriaSpecialistMock.mockResolvedValue({ success: true, data: { sent: true } });
      await request(createApp()).post("/r1/coveria-notify-specialist").send({}).expect(200);
    });
  });
});
