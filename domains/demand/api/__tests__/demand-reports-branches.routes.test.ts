/**
 * Demand Reports Branches Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, vi, beforeEach } from "vitest";

const createBranchMock = vi.fn();
const listBranchesMock = vi.fn();
const getBranchTreeMock = vi.fn();
const getBranchMock = vi.fn();
const updateBranchMock = vi.fn();
const deleteBranchMock = vi.fn();
const createBranchMergeMock = vi.fn();
const listMergesMock = vi.fn();

vi.mock("../../application/buildDeps", () => ({
  buildDemandDeps: () => ({}),
}));

vi.mock("../../application", () => ({
  createBranch: (...a: unknown[]) => createBranchMock(...a),
  listBranches: (...a: unknown[]) => listBranchesMock(...a),
  getBranchTree: (...a: unknown[]) => getBranchTreeMock(...a),
  getBranch: (...a: unknown[]) => getBranchMock(...a),
  updateBranch: (...a: unknown[]) => updateBranchMock(...a),
  deleteBranch: (...a: unknown[]) => deleteBranchMock(...a),
  createBranchMerge: (...a: unknown[]) => createBranchMergeMock(...a),
  listMerges: (...a: unknown[]) => listMergesMock(...a),
}));

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddlewareWithOwnership: () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    validateReportOwnership: () => true,
  }),
}));

vi.mock("@interfaces/middleware/validateBody", () => ({
  validateBody: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { createDemandReportsBranchesRoutes } = await import("../demand-reports-branches.routes");

const ok = (data: unknown) => ({ success: true as const, data, status: 200 });

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId, role: "admin", customPermissions: {} } as unknown as typeof req.auth;
    next();
  });
  app.use(createDemandReportsBranchesRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Demand Reports Branches Routes", () => {
  it("POST /:id/branches — creates branch (201)", async () => {
    createBranchMock.mockResolvedValue(ok({ id: "b1" }));
    await request(createApp()).post("/r1/branches").send({ name: "feature" }).expect(201);
  });

  it("GET /:id/branches — lists branches", async () => {
    listBranchesMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/r1/branches").expect(200);
  });

  it("GET /:id/branches/tree — returns branch tree", async () => {
    getBranchTreeMock.mockResolvedValue(ok({ branches: [] }));
    await request(createApp()).get("/r1/branches/tree").expect(200);
  });

  it("GET /:id/branches/:branchId — returns a branch", async () => {
    getBranchMock.mockResolvedValue(ok({ id: "b1", name: "feature" }));
    await request(createApp()).get("/r1/branches/b1").expect(200);
  });

  it("PATCH /:id/branches/:branchId — updates branch", async () => {
    updateBranchMock.mockResolvedValue(ok({ id: "b1" }));
    await request(createApp()).patch("/r1/branches/b1").send({ name: "new-name" }).expect(200);
  });

  it("DELETE /:id/branches/:branchId — deletes branch", async () => {
    deleteBranchMock.mockResolvedValue(ok(null));
    await request(createApp()).delete("/r1/branches/b1").expect(200);
  });

  it("POST /:id/branches/:branchId/merge — merges branch", async () => {
    createBranchMergeMock.mockResolvedValue(ok({ merged: true }));
    await request(createApp()).post("/r1/branches/b1/merge").send({ targetBranchId: "main" }).expect(201);
  });

  it("GET /:id/merges — lists merges", async () => {
    listMergesMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/r1/merges").expect(200);
  });
});
