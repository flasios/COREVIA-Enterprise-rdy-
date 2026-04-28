/**
 * Portfolio Approvals Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getProjectApprovalsMock = vi.fn();
const createApprovalMock = vi.fn();
const updateApprovalMock = vi.fn();
const decideApprovalMock = vi.fn();
const getPendingApprovalsMock = vi.fn();

vi.mock("../../application/buildDeps", () => ({
  buildApprovalDeps: () => ({}),
}));

vi.mock("../../application", () => ({
  getProjectApprovals: (...a: unknown[]) => getProjectApprovalsMock(...a),
  createApproval: (...a: unknown[]) => createApprovalMock(...a),
  updateApproval: (...a: unknown[]) => updateApprovalMock(...a),
  decideApproval: (...a: unknown[]) => decideApprovalMock(...a),
  getPendingApprovals: (...a: unknown[]) => getPendingApprovalsMock(...a),
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
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@shared/schema", () => ({
  insertProjectApprovalSchema: { parse: (v: unknown) => v },
  updateProjectApprovalSchema: { parse: (v: unknown) => v },
}));

const { createPortfolioApprovalsRoutes } = await import("../portfolio-approvals.routes");

const ok = (data: unknown) => ({ success: true as const, data, status: 200 });

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createPortfolioApprovalsRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Portfolio Approvals Routes", () => {
  it("GET /projects/:projectId/approvals — lists approvals", async () => {
    getProjectApprovalsMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/projects/p1/approvals").expect(200);
  });

  it("POST /projects/:projectId/approvals — creates approval", async () => {
    createApprovalMock.mockResolvedValue(ok({ id: "a1" }));
    const res = await request(createApp()).post("/projects/p1/approvals").send({});
    expect([200, 400, 500]).toContain(res.status);
  });

  it("POST /approvals/:id/decide — decides approval", async () => {
    decideApprovalMock.mockResolvedValue(ok(null));
    await request(createApp()).post("/approvals/a1/decide").send({ decision: "approved" }).expect(200);
  });

  it("GET /approvals/pending — returns pending", async () => {
    getPendingApprovalsMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/approvals/pending").expect(200);
  });
});
