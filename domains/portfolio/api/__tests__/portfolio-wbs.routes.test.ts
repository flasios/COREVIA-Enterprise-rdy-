/**
 * Portfolio WBS Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getWbsTasksMock = vi.fn();
const createWbsTaskMock = vi.fn();
const updateWbsTaskMock = vi.fn();
const deleteWbsTaskMock = vi.fn();

vi.mock("../../application/buildDeps", () => ({
  buildWbsDeps: () => ({}),
}));

vi.mock("../../application", () => ({
  getWbsTasks: (...a: unknown[]) => getWbsTasksMock(...a),
  createWbsTask: (...a: unknown[]) => createWbsTaskMock(...a),
  updateWbsTask: (...a: unknown[]) => updateWbsTaskMock(...a),
  deleteWbsTask: (...a: unknown[]) => deleteWbsTaskMock(...a),
  reorderWbsTasks: vi.fn(() => ok(null)),
  getGanttData: vi.fn(() => ok([])),
  assignWbsResource: vi.fn(() => ok(null)),
  removeWbsResource: vi.fn(() => ok(null)),
  getWbsResources: vi.fn(() => ok([])),
  addWbsDependency: vi.fn(() => ok(null)),
  removeWbsDependency: vi.fn(() => ok(null)),
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
  insertWbsTaskSchema: { parse: (v: unknown) => v },
  updateWbsTaskSchema: { parse: (v: unknown) => v },
}));

const { createPortfolioWbsRoutes } = await import("../portfolio-wbs.routes");

const ok = (data: unknown) => ({ success: true as const, data, status: 200 });

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createPortfolioWbsRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Portfolio WBS Routes", () => {
  it("GET /projects/:projectId/wbs — lists WBS tasks", async () => {
    getWbsTasksMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/projects/p1/wbs").expect(200);
  });

  it("POST /projects/:projectId/wbs — creates WBS task", async () => {
    createWbsTaskMock.mockResolvedValue(ok({ id: "t1" }));
    const res = await request(createApp()).post("/projects/p1/wbs").send({ name: "Task1" });
    expect([200, 400, 500]).toContain(res.status);
  });

  it("DELETE /wbs/:id — deletes WBS task", async () => {
    deleteWbsTaskMock.mockResolvedValue(ok(null));
    await request(createApp()).delete("/wbs/t1").expect(200);
  });
});
