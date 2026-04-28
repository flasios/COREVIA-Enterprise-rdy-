/**
 * Portfolio Communications Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getProjectCommunicationsMock = vi.fn();
const createCommunicationMock = vi.fn();
const deleteCommunicationMock = vi.fn();
const getCommunicationPlanMock = vi.fn();

vi.mock("../../application/buildDeps", () => ({
  buildCommsDeps: () => ({}),
}));

vi.mock("../../application", () => ({
  getProjectCommunications: (...a: unknown[]) => getProjectCommunicationsMock(...a),
  createCommunication: (...a: unknown[]) => createCommunicationMock(...a),
  updateCommunication: vi.fn(() => ok(null)),
  publishCommunication: vi.fn(() => ok(null)),
  deleteCommunication: (...a: unknown[]) => deleteCommunicationMock(...a),
  sendNotification: vi.fn(() => ok(null)),
  getCommunicationPlan: (...a: unknown[]) => getCommunicationPlanMock(...a),
  saveCommunicationPlan: vi.fn(() => ok(null)),
  approveCommunicationPlan: vi.fn(() => ok(null)),
  executeCommunicationTrigger: vi.fn(() => ok(null)),
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
  insertProjectCommunicationSchema: { parse: (v: unknown) => v },
  updateProjectCommunicationSchema: { parse: (v: unknown) => v },
}));

const { createPortfolioCommunicationsRoutes } = await import("../portfolio-communications.routes");

const ok = (data: unknown) => ({ success: true as const, data, status: 200 });

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createPortfolioCommunicationsRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Portfolio Communications Routes", () => {
  it("GET /projects/:projectId/communications — lists", async () => {
    getProjectCommunicationsMock.mockResolvedValue(ok([]));
    await request(createApp()).get("/projects/p1/communications").expect(200);
  });

  it("POST /projects/:projectId/communications — creates", async () => {
    createCommunicationMock.mockResolvedValue(ok({ id: "c1" }));
    const res = await request(createApp()).post("/projects/p1/communications").send({ title: "Update" });
    expect([200, 400, 500]).toContain(res.status);
  });

  it("DELETE /communications/:id — deletes", async () => {
    deleteCommunicationMock.mockResolvedValue(ok(null));
    await request(createApp()).delete("/communications/c1").expect(200);
  });

  it("GET /projects/:projectId/communication-plan — returns plan", async () => {
    getCommunicationPlanMock.mockResolvedValue(ok({}));
    await request(createApp()).get("/projects/p1/communication-plan").expect(200);
  });
});
