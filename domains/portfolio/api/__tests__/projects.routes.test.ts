/**
 * Projects Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

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

vi.mock("@shared/schema/portfolio", () => ({
  WORKSPACE_PATHS: ["standard", "agile", "enterprise"],
}));

const { createProjectsRoutes } = await import("../projects.routes");

function createApp(storageMock: Record<string, unknown>, userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createProjectsRoutes(storageMock as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Projects Routes", () => {
  it("POST /from-demand — 400 when no demandId", async () => {
    const storage = {};
    const res = await request(createApp(storage)).post("/from-demand").send({});
    expect(res.status).toBe(400);
  });

  it("POST /from-demand — 404 when demand report not found", async () => {
    const storage = { getDemandReport: vi.fn().mockResolvedValue(null) };
    const res = await request(createApp(storage)).post("/from-demand").send({ demandId: "d999" });
    expect(res.status).toBe(404);
  });

  it("POST /from-demand — 400 when demand not approved", async () => {
    const storage = {
      getDemandReport: vi.fn().mockResolvedValue({ workflowStatus: "draft" }),
    };
    const res = await request(createApp(storage)).post("/from-demand").send({ demandId: "d1" });
    expect(res.status).toBe(400);
  });

  it("POST /from-demand — returns existing project if already converted", async () => {
    const existingProject = { id: "proj1", demandReportId: "d1" };
    const storage = {
      getDemandReport: vi.fn().mockResolvedValue({ workflowStatus: "approved" }),
      getAllPortfolioProjects: vi.fn().mockResolvedValue([existingProject]),
    };
    const res = await request(createApp(storage)).post("/from-demand").send({ demandId: "d1" });
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe("proj1");
  });
});
