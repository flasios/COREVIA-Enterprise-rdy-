/**
 * Demand Reports Requirements Routes — Unit Tests
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
      generateRequirements: vi.fn().mockResolvedValue({ success: true, data: { requirements: [] } }),
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
  normalizeRequirementsForUI: vi.fn((data: unknown) => data),
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

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@interfaces/middleware/timeout", () => ({
  TIMEOUTS: { AI_GENERATION: 120000 },
}));

vi.mock("@domains/intelligence/infrastructure", () => ({
  marketResearchService: { research: vi.fn().mockResolvedValue({ data: [] }) },
}));

const { createDemandReportsRequirementsRoutes } = await import("../demand-reports-requirements.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createDemandReportsRequirementsRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Demand Reports Requirements Routes", () => {
  it("POST /:id/generate-requirements — route wired", async () => {
    const res = await request(createApp())
      .post("/r1/generate-requirements")
      .send({});
    expect([200, 500]).toContain(res.status);
  });

  it("GET /:id/requirements — route wired", async () => {
    const res = await request(createApp()).get("/r1/requirements");
    expect([200, 500]).toContain(res.status);
  });

  it("POST /:id/requirements/market-research — route wired", async () => {
    const res = await request(createApp())
      .post("/r1/requirements/market-research")
      .send({});
    expect([200, 500]).toContain(res.status);
  });
});
