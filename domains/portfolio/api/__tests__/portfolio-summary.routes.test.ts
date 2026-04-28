/**
 * Portfolio Summary Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getManagementSummaryMock = vi.fn();

vi.mock("../../application/buildDeps", () => ({
  buildSummaryDeps: () => ({}),
}));

vi.mock("../../application", () => ({
  getManagementSummary: (...a: unknown[]) => getManagementSummaryMock(...a),
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

const { createPortfolioSummaryRoutes } = await import("../portfolio-summary.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createPortfolioSummaryRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Portfolio Summary Routes", () => {
  it("GET /projects/:projectId/management-summary — returns summary", async () => {
    getManagementSummaryMock.mockResolvedValue({ success: true, data: { score: 85 } });
    const res = await request(createApp()).get("/projects/p1/management-summary");
    expect(res.status).toBe(200);
  });

  it("GET /projects/:projectId/management-summary — error forwarded", async () => {
    getManagementSummaryMock.mockResolvedValue({ success: false, status: 404, error: "Not found" });
    const res = await request(createApp()).get("/projects/p1/management-summary");
    expect(res.status).toBe(404);
  });
});
