/**
 * Brain Routes — Unit Tests
 *
 * Tests the AI brain execution endpoint:
 *   - POST /ai/run: session auth, success, error forwarding
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const executeBrainRunMock = vi.fn();

vi.mock("../../application", () => ({
  executeBrainRun: (...a: unknown[]) => executeBrainRunMock(...a),
  buildBrainDeps: vi.fn(() => ({ deps: true })),
}));

vi.mock("@interfaces/middleware/validateBody", () => ({
  validateBody: () => (req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

const { createBrainRoutes } = await import("../brain.routes");

function createApp(userId?: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    next();
  });
  app.use(createBrainRoutes());
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Brain Routes", () => {
  describe("POST /ai/run", () => {
    it("returns success result", async () => {
      executeBrainRunMock.mockResolvedValue({ success: true, data: { output: "result" } });
      const res = await request(createApp("u1"))
        .post("/ai/run")
        .send({ prompt: "test" })
        .expect(200);
      expect(res.body).toEqual({ success: true, output: "result" });
    });

    it("returns error on failure", async () => {
      executeBrainRunMock.mockResolvedValue({ success: false, status: 400, error: "Bad input", details: "missing" });
      const res = await request(createApp("u1"))
        .post("/ai/run")
        .send({ prompt: "" })
        .expect(400);
      expect(res.body).toEqual({ success: false, error: "Bad input", details: "missing" });
    });

    it("passes userId and orgId from session", async () => {
      executeBrainRunMock.mockResolvedValue({ success: true, data: {} });
      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        req.session = { userId: "u1", organizationId: "org1" } as unknown as typeof req.session;
        next();
      });
      app.use(createBrainRoutes());
      await request(app).post("/ai/run").send({ prompt: "x" });
      expect(executeBrainRunMock).toHaveBeenCalledWith(
        expect.anything(), { prompt: "x" }, "u1", "org1",
      );
    });
  });
});
