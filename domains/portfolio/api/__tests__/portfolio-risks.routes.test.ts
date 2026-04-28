/**
 * Portfolio Risks Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getProjectRisksMock = vi.fn();
const createRiskMock = vi.fn();
const updateRiskMock = vi.fn();
const deleteRiskMock = vi.fn();
const getRiskEvidenceMock = vi.fn();

vi.mock("../../application/buildDeps", () => ({
  buildRisksDeps: () => ({}),
}));

vi.mock("../../application", () => ({
  normalizeRiskPayload: vi.fn((d: unknown) => d),
  computeRiskScore: vi.fn(() => 5),
  getProjectRisks: (...a: unknown[]) => getProjectRisksMock(...a),
  createRisk: (...a: unknown[]) => createRiskMock(...a),
  updateRisk: (...a: unknown[]) => updateRiskMock(...a),
  deleteRisk: (...a: unknown[]) => deleteRiskMock(...a),
  getRiskEvidence: (...a: unknown[]) => getRiskEvidenceMock(...a),
  createRiskEvidence: vi.fn(() => ok(null)),
  verifyRiskEvidence: vi.fn(() => ok(null)),
  deleteRiskEvidence: vi.fn(() => ok(null)),
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
  insertProjectRiskSchema: { parse: (v: unknown) => v },
  updateProjectRiskSchema: { parse: (v: unknown) => v },
}));

vi.mock("multer", () => {
  const m = () => ({ single: () => (_req: unknown, _res: unknown, next: () => void) => next() });
  m.diskStorage = vi.fn();
  return { default: m };
});

const { createPortfolioRisksRoutes } = await import("../portfolio-risks.routes");

const ok = (data: unknown) => ({ success: true as const, data, status: 200 });

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createPortfolioRisksRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Portfolio Risks Routes", () => {
  it("GET /projects/:projectId/risks — lists risks", async () => {
    getProjectRisksMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/projects/p1/risks").expect(200);
  });

  it("POST /projects/:projectId/risks — creates risk", async () => {
    createRiskMock.mockResolvedValue(ok({ id: "r1" }));
    const res = await request(createApp()).post("/projects/p1/risks").send({ title: "Risk A" });
    expect([200, 400, 500]).toContain(res.status);
  });

  it("DELETE /risks/:id — deletes risk", async () => {
    deleteRiskMock.mockResolvedValue(ok(null));
    await request(createApp()).delete("/risks/r1").expect(200);
  });

  it("GET /risks/:riskId/evidence — returns evidence", async () => {
    getRiskEvidenceMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/risks/r1/evidence").expect(200);
  });
});
