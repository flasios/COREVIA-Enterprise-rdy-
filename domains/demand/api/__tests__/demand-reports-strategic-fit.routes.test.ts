/**
 * Demand Reports Strategic Fit Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../application/buildDeps", () => ({
  buildDemandDeps: () => ({
    reports: {
      getById: vi.fn().mockResolvedValue({ id: "r1", title: "Test" }),
    },
    brain: {
      generateStrategicFit: vi.fn().mockResolvedValue({ success: true, data: {} }),
      regenerateStrategicFit: vi.fn().mockResolvedValue({ success: true, data: {} }),
    },
    versions: {
      listByReport: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
    },
    businessCase: {
      getByReportId: vi.fn().mockResolvedValue(null),
    },
  }),
}));

vi.mock("../../application", () => ({
  asVersionLike: (v: unknown) => v as Record<string, unknown>,
  createReportVersionSafely: vi.fn().mockResolvedValue({ id: "v1" }),
}));

vi.mock("../../application/normalizers", () => ({
  normalizeStrategicFitForUI: vi.fn((data: unknown) => data),
}));

vi.mock("../../application/artifactProvenance", () => ({
  attachArtifactProvenance: vi.fn((data: unknown) => data),
  buildArtifactMetaFromPayload: vi.fn(() => ({})),
}));

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  }),
  getAuthenticatedOrganizationId: () => "org1",
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

const { createDemandReportsStrategicFitRoutes } = await import("../demand-reports-strategic-fit.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createDemandReportsStrategicFitRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Demand Reports Strategic Fit Routes", () => {
  it("POST /:id/generate-strategic-fit — route wired", async () => {
    const res = await request(createApp())
      .post("/r1/generate-strategic-fit")
      .send({});
    expect([200, 500]).toContain(res.status);
  });

  it("GET /:id/strategic-fit — route wired", async () => {
    const res = await request(createApp()).get("/r1/strategic-fit");
    expect([200, 500]).toContain(res.status);
  });

  it("PATCH /:id/strategic-fit — route wired", async () => {
    const res = await request(createApp())
      .patch("/r1/strategic-fit")
      .send({ data: { score: 0.8 }, changesSummary: "updated" });
    expect([200, 400, 500]).toContain(res.status);
  });

  it("POST /:id/regenerate-strategic-fit — route wired", async () => {
    const res = await request(createApp())
      .post("/r1/regenerate-strategic-fit")
      .send({});
    expect([200, 500]).toContain(res.status);
  });
});
