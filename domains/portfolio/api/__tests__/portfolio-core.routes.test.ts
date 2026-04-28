/**
 * Portfolio Core Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getPortfolioStatsMock = vi.fn();
const getPortfolioSummaryMock = vi.fn();
const getAllProjectsMock = vi.fn();
const getMyProjectsMock = vi.fn();
const getMyTasksMock = vi.fn();
const getMyStatsMock = vi.fn();
const getPipelineMock = vi.fn();
const getProjectByIdMock = vi.fn();
const updateProjectMock = vi.fn();
const createProjectFromDemandMock = vi.fn();
const transitionProjectPhaseMock = vi.fn();
const getPhaseHistoryMock = vi.fn();
const getTeamRecommendationsMock = vi.fn();
const getResourceAlignmentMock = vi.fn();
const getProjectMilestonesMock = vi.fn();
const createMilestoneMock = vi.fn();
const getPendingChangeRequestsMock = vi.fn();
const getAllChangeRequestsMock = vi.fn();
const getProjectKpisMock = vi.fn();

vi.mock("../../application/buildDeps", () => ({
  buildCoreDeps: () => ({}),
}));

vi.mock("../../application", () => ({
  getPortfolioStats: (...a: unknown[]) => getPortfolioStatsMock(...a),
  getPortfolioSummary: (...a: unknown[]) => getPortfolioSummaryMock(...a),
  getAllProjects: (...a: unknown[]) => getAllProjectsMock(...a),
  getMyProjects: (...a: unknown[]) => getMyProjectsMock(...a),
  getMyTasks: (...a: unknown[]) => getMyTasksMock(...a),
  getMyStats: (...a: unknown[]) => getMyStatsMock(...a),
  getPipeline: (...a: unknown[]) => getPipelineMock(...a),
  getProjectById: (...a: unknown[]) => getProjectByIdMock(...a),
  updateProject: (...a: unknown[]) => updateProjectMock(...a),
  createProjectFromDemand: (...a: unknown[]) => createProjectFromDemandMock(...a),
  transitionProjectPhase: (...a: unknown[]) => transitionProjectPhaseMock(...a),
  assignProjectManager: vi.fn(() => ok(null)),
  assignSponsor: vi.fn(() => ok(null)),
  assignFinancialDirector: vi.fn(() => ok(null)),
  assignSteeringCommitteeMember: vi.fn(() => ok(null)),
  sendCharterForSignature: vi.fn(() => ok(null)),
  signCharter: vi.fn(() => ok(null)),
  saveCharter: vi.fn(() => ok(null)),
  saveGovernanceStructure: vi.fn(() => ok(null)),
  sendCharterReminder: vi.fn(() => ok(null)),
  getPhaseHistory: (...a: unknown[]) => getPhaseHistoryMock(...a),
  getTeamRecommendations: (...a: unknown[]) => getTeamRecommendationsMock(...a),
  getResourceAlignment: (...a: unknown[]) => getResourceAlignmentMock(...a),
  createMilestone: (...a: unknown[]) => createMilestoneMock(...a),
  getProjectMilestones: (...a: unknown[]) => getProjectMilestonesMock(...a),
  updateMilestone: vi.fn(() => ok(null)),
  deleteMilestone: vi.fn(() => ok(null)),
  getUpcomingMilestones: vi.fn(() => ok([])),
  getProjectChangeRequests: vi.fn(() => ok([])),
  getPendingChangeRequests: (...a: unknown[]) => getPendingChangeRequestsMock(...a),
  getAllChangeRequests: (...a: unknown[]) => getAllChangeRequestsMock(...a),
  createChangeRequest: vi.fn(() => ok({ id: "cr1" })),
  getChangeRequestById: vi.fn(() => ok({ id: "cr1" })),
  updateChangeRequest: vi.fn(() => ok(null)),
  submitChangeRequest: vi.fn(() => ok(null)),
  reviewChangeRequest: vi.fn(() => ok(null)),
  approveChangeRequest: vi.fn(() => ok(null)),
  rejectChangeRequest: vi.fn(() => ok(null)),
  implementChangeRequest: vi.fn(() => ok(null)),
  deleteChangeRequest: vi.fn(() => ok(null)),
  createKpi: vi.fn(() => ok({ id: "k1" })),
  getProjectKpis: (...a: unknown[]) => getProjectKpisMock(...a),
  updateKpi: vi.fn(() => ok(null)),
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

vi.mock("@interfaces/middleware/sendPaginated", () => ({
  sendPaginated: (_req: unknown, res: { json: (d: unknown) => void }, result: { success: boolean; data?: unknown }) => {
    if (result.success) res.json(result);
  },
}));

const { createPortfolioCoreRoutes } = await import("../portfolio-core.routes");

const ok = (data: unknown) => ({ success: true as const, data, status: 200 });

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createPortfolioCoreRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Portfolio Core Routes", () => {
  it("GET /stats — returns stats", async () => {
    getPortfolioStatsMock.mockResolvedValue(ok({ total: 5 }));
    await request(createApp()).get("/stats").expect(200);
  });

  it("GET /summary — returns summary", async () => {
    getPortfolioSummaryMock.mockResolvedValue(ok({ summary: {} }));
    await request(createApp()).get("/summary").expect(200);
  });

  it("GET /projects — lists projects", async () => {
    getAllProjectsMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/projects").expect(200);
  });

  it("GET /my-projects — returns user projects", async () => {
    getMyProjectsMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/my-projects").expect(200);
  });

  it("GET /pipeline — returns pipeline", async () => {
    getPipelineMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/pipeline").expect(200);
  });

  it("GET /projects/:id — returns project", async () => {
    getProjectByIdMock.mockResolvedValue(ok({ id: "p1" }));
    await request(createApp()).get("/projects/p1").expect(200);
  });

  it("PATCH /projects/:id — updates project", async () => {
    updateProjectMock.mockResolvedValue(ok({ id: "p1" }));
    await request(createApp()).patch("/projects/p1").send({ name: "updated" }).expect(200);
  });

  it("POST /projects — creates project from demand", async () => {
    createProjectFromDemandMock.mockResolvedValue(ok({ id: "p2" }));
    const res = await request(createApp()).post("/projects").send({ demandReportId: "d1" });
    expect([200, 201]).toContain(res.status);
  });

  it("POST /projects/:id/transition — transitions phase", async () => {
    transitionProjectPhaseMock.mockResolvedValue(ok({ phase: "execution" }));
    await request(createApp()).post("/projects/p1/transition").send({ targetPhase: "execution" }).expect(200);
  });

  it("GET /projects/:id/history — returns phase history", async () => {
    getPhaseHistoryMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/projects/p1/history").expect(200);
  });

  it("GET /projects/:id/milestones — returns milestones", async () => {
    getProjectMilestonesMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/projects/p1/milestones").expect(200);
  });

  it("POST /projects/:id/milestones — creates milestone", async () => {
    createMilestoneMock.mockResolvedValue(ok({ id: "m1" }));
    await request(createApp()).post("/projects/p1/milestones").send({ name: "M1" }).expect(201);
  });

  it("GET /change-requests/pending — returns pending CRs", async () => {
    getPendingChangeRequestsMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/change-requests/pending").expect(200);
  });

  it("GET /projects/:id/kpis — returns KPIs", async () => {
    getProjectKpisMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/projects/p1/kpis").expect(200);
  });
});
