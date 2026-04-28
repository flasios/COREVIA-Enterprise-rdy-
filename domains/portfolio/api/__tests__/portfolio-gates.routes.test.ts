/**
 * Portfolio Gates Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, vi, beforeEach } from "vitest";

const getPendingGatesMock = vi.fn();
const getGateHistoryMock = vi.fn();
const approveGateMock = vi.fn();
const rejectGateMock = vi.fn();
const getProjectGatesMock = vi.fn();
const createGateMock = vi.fn();

vi.mock("../../application/buildDeps", () => ({
  buildGatesDeps: () => ({}),
}));

vi.mock("../../application", () => ({
  getPendingGates: (...a: unknown[]) => getPendingGatesMock(...a),
  getGateHistory: (...a: unknown[]) => getGateHistoryMock(...a),
  approveGate: (...a: unknown[]) => approveGateMock(...a),
  rejectGate: (...a: unknown[]) => rejectGateMock(...a),
  getProjectGates: (...a: unknown[]) => getProjectGatesMock(...a),
  createGate: (...a: unknown[]) => createGateMock(...a),
  updateGate: vi.fn(() => ok(null)),
  deleteGate: vi.fn(() => ok(null)),
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
  updateProjectGateSchema: {},
}));

const { createPortfolioGatesRoutes } = await import("../portfolio-gates.routes");

const ok = (data: unknown) => ({ success: true as const, data, status: 200 });

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createPortfolioGatesRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Portfolio Gates Routes", () => {
  it("GET /gates/pending — returns pending gates", async () => {
    getPendingGatesMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/gates/pending").expect(200);
  });

  it("GET /gates/history — returns gate history", async () => {
    getGateHistoryMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/gates/history").expect(200);
  });

  it("POST /gates/:id/approve — approves gate", async () => {
    approveGateMock.mockResolvedValue(ok(null));
    await request(createApp()).post("/gates/g1/approve").send({ comments: "OK" }).expect(200);
  });

  it("POST /gates/:id/reject — rejects gate", async () => {
    rejectGateMock.mockResolvedValue(ok(null));
    await request(createApp()).post("/gates/g1/reject").send({ comments: "No" }).expect(200);
  });

  it("GET /projects/:projectId/gates — returns project gates", async () => {
    getProjectGatesMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/projects/p1/gates").expect(200);
  });

  it("POST /projects/:projectId/gates — creates gate", async () => {
    createGateMock.mockResolvedValue(ok({ id: "g2" }));
    await request(createApp()).post("/projects/p1/gates").send({ name: "G2" }).expect(200);
  });
});
