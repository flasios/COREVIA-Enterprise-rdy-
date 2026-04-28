/**
 * Portfolio Metadata Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, vi, beforeEach } from "vitest";

const addDependencyMock = vi.fn();
const deleteDependencyMock = vi.fn();
const addAssumptionMock = vi.fn();
const addConstraintMock = vi.fn();

vi.mock("../../application/buildDeps", () => ({
  buildMetadataDeps: () => ({}),
}));

vi.mock("../../application", () => ({
  addDependency: (...a: unknown[]) => addDependencyMock(...a),
  updateDependency: vi.fn(() => ok(null)),
  deleteDependency: (...a: unknown[]) => deleteDependencyMock(...a),
  addAssumption: (...a: unknown[]) => addAssumptionMock(...a),
  updateAssumption: vi.fn(() => ok(null)),
  deleteAssumption: vi.fn(() => ok(null)),
  addConstraint: (...a: unknown[]) => addConstraintMock(...a),
  updateConstraint: vi.fn(() => ok(null)),
  deleteConstraint: vi.fn(() => ok(null)),
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

const { createPortfolioMetadataRoutes } = await import("../portfolio-metadata.routes");

const ok = (data: unknown) => ({ success: true as const, data, status: 200 });

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createPortfolioMetadataRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Portfolio Metadata Routes", () => {
  it("POST /projects/:projectId/dependencies — creates dependency", async () => {
    addDependencyMock.mockResolvedValue(ok({ id: "dep1" }));
    await request(createApp()).post("/projects/p1/dependencies").send({}).expect(200);
  });

  it("DELETE /projects/:projectId/dependencies/:id — deletes", async () => {
    deleteDependencyMock.mockResolvedValue(ok(null));
    await request(createApp()).delete("/projects/p1/dependencies/dep1").expect(200);
  });

  it("POST /projects/:projectId/assumptions — creates assumption", async () => {
    addAssumptionMock.mockResolvedValue(ok({ id: "a1" }));
    await request(createApp()).post("/projects/p1/assumptions").send({}).expect(200);
  });

  it("POST /projects/:projectId/constraints — creates constraint", async () => {
    addConstraintMock.mockResolvedValue(ok({ id: "c1" }));
    await request(createApp()).post("/projects/p1/constraints").send({}).expect(200);
  });
});
