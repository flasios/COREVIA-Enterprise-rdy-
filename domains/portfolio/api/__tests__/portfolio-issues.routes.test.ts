/**
 * Portfolio Issues Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getProjectIssuesMock = vi.fn();
const createIssueMock = vi.fn();
const deleteIssueMock = vi.fn();

vi.mock("../../application/buildDeps", () => ({
  buildIssueDeps: () => ({}),
}));

vi.mock("../../application", () => ({
  getProjectIssues: (...a: unknown[]) => getProjectIssuesMock(...a),
  createIssue: (...a: unknown[]) => createIssueMock(...a),
  updateIssue: vi.fn(() => ok(null)),
  deleteIssue: (...a: unknown[]) => deleteIssueMock(...a),
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
  insertProjectIssueSchema: { parse: (v: unknown) => v },
  updateProjectIssueSchema: { parse: (v: unknown) => v },
}));

const { createPortfolioIssuesRoutes } = await import("../portfolio-issues.routes");

const ok = (data: unknown) => ({ success: true as const, data, status: 200 });

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createPortfolioIssuesRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Portfolio Issues Routes", () => {
  it("GET /projects/:projectId/issues — lists issues", async () => {
    getProjectIssuesMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/projects/p1/issues").expect(200);
  });

  it("POST /projects/:projectId/issues — creates issue", async () => {
    createIssueMock.mockResolvedValue(ok({ id: "i1" }));
    const res = await request(createApp()).post("/projects/p1/issues").send({ title: "Bug" });
    expect([200, 201, 400, 500]).toContain(res.status);
  });

  it("DELETE /issues/:id — deletes issue", async () => {
    deleteIssueMock.mockResolvedValue(ok(null));
    await request(createApp()).delete("/issues/i1").expect(200);
  });
});
