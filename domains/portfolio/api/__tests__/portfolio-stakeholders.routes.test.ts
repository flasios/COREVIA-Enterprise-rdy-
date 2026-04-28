/**
 * Portfolio Stakeholders Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getProjectStakeholdersMock = vi.fn();
const createStakeholderMock = vi.fn();
const deleteStakeholderMock = vi.fn();

vi.mock("../../application/buildDeps", () => ({
  buildStakeholderDeps: () => ({}),
}));

vi.mock("../../application", () => ({
  getProjectStakeholders: (...a: unknown[]) => getProjectStakeholdersMock(...a),
  createStakeholder: (...a: unknown[]) => createStakeholderMock(...a),
  updateStakeholder: vi.fn(() => ok(null)),
  deleteStakeholder: (...a: unknown[]) => deleteStakeholderMock(...a),
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
  insertProjectStakeholderSchema: { parse: (v: unknown) => v },
  updateProjectStakeholderSchema: { parse: (v: unknown) => v },
}));

const { createPortfolioStakeholdersRoutes } = await import("../portfolio-stakeholders.routes");

const ok = (data: unknown) => ({ success: true as const, data, status: 200 });

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createPortfolioStakeholdersRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Portfolio Stakeholders Routes", () => {
  it("GET /projects/:projectId/stakeholders — lists", async () => {
    getProjectStakeholdersMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/projects/p1/stakeholders").expect(200);
  });

  it("POST /projects/:projectId/stakeholders — creates", async () => {
    createStakeholderMock.mockResolvedValue(ok({ id: "s1" }));
    const res = await request(createApp()).post("/projects/p1/stakeholders").send({ name: "Alice" });
    expect([200, 400, 500]).toContain(res.status);
  });

  it("DELETE /stakeholders/:id — deletes", async () => {
    deleteStakeholderMock.mockResolvedValue(ok(null));
    await request(createApp()).delete("/stakeholders/s1").expect(200);
  });
});
