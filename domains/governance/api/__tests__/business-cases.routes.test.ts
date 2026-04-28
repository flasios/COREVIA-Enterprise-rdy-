/**
 * Business Cases Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getBusinessCaseMock = vi.fn();

vi.mock("../../application", () => ({
  getBusinessCase: (...a: unknown[]) => getBusinessCaseMock(...a),
}));

vi.mock("../../application/buildDeps", () => ({
  buildBusinessCaseDeps: vi.fn(() => ({})),
}));

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  }),
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

const { createBusinessCasesRoutes } = await import("../business-cases.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    next();
  });
  app.use(createBusinessCasesRoutes({} as never));
  return app;
}

const ok = (data: unknown) => ({ success: true as const, data });

beforeEach(() => vi.clearAllMocks());

describe("Business Cases Routes", () => {
  describe("GET /:id", () => {
    it("returns business case", async () => {
      getBusinessCaseMock.mockResolvedValue(ok({ id: "bc1", title: "Case A" }));
      const res = await request(createApp()).get("/bc1").expect(200);
      expect(res.body.data).toEqual({ id: "bc1", title: "Case A" });
    });

    it("returns 404 for missing case", async () => {
      getBusinessCaseMock.mockResolvedValue({ success: false, status: 404, error: "Not found" });
      await request(createApp()).get("/bad").expect(404);
    });
  });
});
