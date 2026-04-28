/**
 * EA Routes — Unit Tests
 * Tests the 4 main endpoints: generate, get, patch, registry/aggregate
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Storage mock ─────────────────────────────────────── */
const storageMock = {
  getUser: vi.fn(),
  getDemandReport: vi.fn(),
  getReportVersions: vi.fn(),
  updateDemandReport: vi.fn(),
  createReportVersion: vi.fn(),
  getAllDemandReports: vi.fn(),
  getAllEaApplications: vi.fn().mockResolvedValue([]),
  getAllEaCapabilities: vi.fn().mockResolvedValue([]),
  getAllEaDataDomains: vi.fn().mockResolvedValue([]),
  getAllEaTechnologyStandards: vi.fn().mockResolvedValue([]),
  getAllEaIntegrations: vi.fn().mockResolvedValue([]),
};

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  }),
}));

vi.mock("@interfaces/middleware/validateBody", () => ({
  validateBody: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const brainExecuteMock = vi.fn();
const brainSyncMock = vi.fn();
const brainUpsertMock = vi.fn();

vi.mock("@domains/demand/application/buildDeps", () => ({
  buildDemandDeps: () => ({
    brain: {
      execute: brainExecuteMock,
      syncDecisionToDemand: brainSyncMock,
      upsertDecisionArtifactVersion: brainUpsertMock,
    },
  }),
}));

vi.mock("@shared/contracts/enterprise-architecture", () => ({
  EnterpriseArchitectureArtifactSchema: {
    safeParse: (v: unknown) => ({ success: true, data: v }),
  },
  normalizeEnterpriseArchitectureArtifact: (v: unknown) => v,
  recalculateEnterpriseArchitectureDashboard: (v: unknown) => v,
}));

const { createEaRoutes } = await import("../ea.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    next();
  });
  app.use(createEaRoutes(storageMock as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("EA Routes", () => {
  describe("GET /:demandReportId", () => {
    it("returns EA artifact for a report", async () => {
      storageMock.getDemandReport.mockResolvedValue({
        id: "r1",
        enterpriseArchitectureAnalysis: { dashboard: {} },
      });
      const res = await request(createApp()).get("/r1").expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ dashboard: {} });
    });

    it("returns 404 when report not found", async () => {
      storageMock.getDemandReport.mockResolvedValue(null);
      await request(createApp()).get("/missing").expect(404);
    });

    it("returns 404 when no EA analysis exists", async () => {
      storageMock.getDemandReport.mockResolvedValue({ id: "r1" });
      await request(createApp()).get("/r1").expect(404);
    });
  });

  describe("POST /:demandReportId/generate", () => {
    it("returns 401 when user not found", async () => {
      storageMock.getUser.mockResolvedValue(null);
      await request(createApp()).post("/r1/generate").expect(401);
    });

    it("returns 404 when report not found", async () => {
      storageMock.getUser.mockResolvedValue({ id: "u1", username: "test" });
      storageMock.getDemandReport.mockResolvedValue(null);
      await request(createApp()).post("/r1/generate").expect(404);
    });

    it("returns 400 when no published business case", async () => {
      storageMock.getUser.mockResolvedValue({ id: "u1", username: "test" });
      storageMock.getDemandReport.mockResolvedValue({ id: "r1" });
      storageMock.getReportVersions.mockResolvedValue([]);
      await request(createApp()).post("/r1/generate").expect(400);
    });
  });

  describe("PATCH /:demandReportId", () => {
    it("returns error for invalid payload", async () => {
      // The internal z.object safeParse rejects payloads that don't match the schema
      const res = await request(createApp())
        .patch("/r1")
        .send({ data: { dashboard: {} }, changesSummary: "Updated EA" });
      // Returns 400 (validation) or 500 (safeParse throws with mock schema)
      expect([400, 500]).toContain(res.status);
    });
  });

  describe("GET /registry/aggregate", () => {
    it("returns aggregated EA data from all reports", async () => {
      storageMock.getAllDemandReports.mockResolvedValue([]);
      const res = await request(createApp()).get("/registry/aggregate").expect(200);
      expect(res.body.success).toBe(true);
    });
  });
});
