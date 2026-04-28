/**
 * Analytics Routes — Unit Tests
 *
 * Tests intelligence analytics endpoints:
 *   - Auth + permission enforcement (knowledge:analytics, report:read)
 *   - Summary, trends, documents, gaps, ROI, refresh
 *   - Portfolio health, demand forecast, Monte Carlo, integration status
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getAnalyticsSummaryMock = vi.fn();
const getAnalyticsTrendsMock = vi.fn();
const getTopDocumentsMock = vi.fn();
const detectKnowledgeGapsMock = vi.fn();
const calculateROIMock = vi.fn();
const refreshAnalyticsMock = vi.fn();
const getPortfolioHealthMock = vi.fn();
const getDemandForecastMock = vi.fn();
const runMonteCarloSimulationMock = vi.fn();
const getIntegrationStatusMock = vi.fn();
const getDemandPlanServiceMock = vi.fn();

vi.mock("../../application", () => ({
  getAnalyticsSummary: (...a: unknown[]) => getAnalyticsSummaryMock(...a),
  getAnalyticsTrends: (...a: unknown[]) => getAnalyticsTrendsMock(...a),
  getTopDocuments: (...a: unknown[]) => getTopDocumentsMock(...a),
  detectKnowledgeGaps: (...a: unknown[]) => detectKnowledgeGapsMock(...a),
  calculateROI: (...a: unknown[]) => calculateROIMock(...a),
  refreshAnalytics: (...a: unknown[]) => refreshAnalyticsMock(...a),
  getPortfolioHealth: (...a: unknown[]) => getPortfolioHealthMock(...a),
  getDemandForecast: (...a: unknown[]) => getDemandForecastMock(...a),
  runMonteCarloSimulation: (...a: unknown[]) => runMonteCarloSimulationMock(...a),
  getIntegrationStatus: (...a: unknown[]) => getIntegrationStatusMock(...a),
  getDemandPlanService: (...a: unknown[]) => getDemandPlanServiceMock(...a),
  buildAnalyticsDeps: vi.fn(() => ({ deps: true })),
}));

const requireAuthMock = vi.fn((_req: unknown, _res: unknown, next: () => void) => next());
const requirePermissionMock = vi.fn(
  () => (_req: unknown, _res: unknown, next: () => void) => next(),
);

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (req: unknown, res: unknown, next: () => void) =>
      requireAuthMock(req, res, next),
    requirePermission: (perm: string) => {
      const mw = requirePermissionMock(perm);
      return (req: unknown, res: unknown, next: () => void) => mw(req, res, next);
    },
  }),
}));

vi.mock("@interfaces/middleware/cacheResponse", () => ({
  cacheResponse: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  CACHE_PROFILES: { analytics: {} },
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { createAnalyticsRoutes } = await import("../analytics.routes");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId: "u1" } as unknown as typeof req.session;
    next();
  });
  app.use(createAnalyticsRoutes({} as never));
  return app;
}

const ok = (data: unknown) => ({ success: true as const, data });

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockImplementation((_r: unknown, _s: unknown, n: () => void) => n());
  requirePermissionMock.mockImplementation(() => (_r: unknown, _s: unknown, n: () => void) => n());
});

describe("Analytics Routes", () => {
  describe("auth enforcement", () => {
    it("rejects unauthenticated GET /summary", async () => {
      requireAuthMock.mockImplementation((_r: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) =>
        res.status(401).json({ error: "Unauthorized" }),
      );
      await request(createApp()).get("/summary").expect(401);
    });
  });

  describe("permission wiring", () => {
    it("requires knowledge:analytics for GET /summary", async () => {
      getAnalyticsSummaryMock.mockResolvedValue(ok({}));
      await request(createApp()).get("/summary");
      expect(requirePermissionMock).toHaveBeenCalledWith("knowledge:analytics");
    });

    it("requires report:read for GET /portfolio-health", async () => {
      getPortfolioHealthMock.mockResolvedValue(ok({}));
      await request(createApp()).get("/portfolio-health");
      expect(requirePermissionMock).toHaveBeenCalledWith("report:read");
    });
  });

  describe("GET /summary", () => {
    it("returns analytics summary", async () => {
      getAnalyticsSummaryMock.mockResolvedValue({ success: true, total: 100 });
      const res = await request(createApp()).get("/summary").expect(200);
      expect(res.body).toEqual({ success: true, total: 100 });
    });
  });

  describe("GET /trends", () => {
    it("returns analytics trends", async () => {
      getAnalyticsTrendsMock.mockResolvedValue({ success: true, data: [] });
      await request(createApp()).get("/trends?metric=queries&days=7").expect(200);
      expect(getAnalyticsTrendsMock).toHaveBeenCalledWith(expect.anything(), "queries", 7);
    });
  });

  describe("GET /documents", () => {
    it("returns top documents", async () => {
      getTopDocumentsMock.mockResolvedValue({ success: true, data: [] });
      await request(createApp()).get("/documents?sortBy=citations&limit=5").expect(200);
      expect(getTopDocumentsMock).toHaveBeenCalledWith(expect.anything(), "citations", 5);
    });
  });

  describe("GET /gaps", () => {
    it("detects knowledge gaps", async () => {
      detectKnowledgeGapsMock.mockResolvedValue({ success: true, gaps: [] });
      await request(createApp()).get("/gaps").expect(200);
    });
  });

  describe("GET /roi", () => {
    it("calculates ROI", async () => {
      calculateROIMock.mockResolvedValue({ success: true, roi: 5.2 });
      await request(createApp()).get("/roi?days=30&hourlyRate=75").expect(200);
      expect(calculateROIMock).toHaveBeenCalledWith(expect.anything(), 30, 75);
    });
  });

  describe("POST /refresh", () => {
    it("refreshes analytics", async () => {
      refreshAnalyticsMock.mockResolvedValue({ success: true });
      await request(createApp()).post("/refresh").expect(200);
    });
  });

  describe("GET /portfolio-health", () => {
    it("returns portfolio health", async () => {
      getPortfolioHealthMock.mockResolvedValue({ success: true, health: "good" });
      await request(createApp()).get("/portfolio-health").expect(200);
    });
  });

  describe("GET /demand-forecast", () => {
    it("returns demand forecast", async () => {
      getDemandForecastMock.mockResolvedValue({ success: true, forecast: [] });
      await request(createApp()).get("/demand-forecast").expect(200);
    });
  });

  describe("GET /monte-carlo-simulation", () => {
    it("runs simulation", async () => {
      runMonteCarloSimulationMock.mockResolvedValue({ success: true, results: {} });
      await request(createApp()).get("/monte-carlo-simulation").expect(200);
    });
  });

  describe("GET /integration-status", () => {
    it("returns integration status", async () => {
      getIntegrationStatusMock.mockResolvedValue({ success: true, integrations: [] });
      await request(createApp()).get("/integration-status").expect(200);
    });
  });

  describe("GET /demand-plan-service", () => {
    it("returns demand plan service", async () => {
      getDemandPlanServiceMock.mockResolvedValue({ success: true, plan: {} });
      await request(createApp()).get("/demand-plan-service").expect(200);
    });
  });
});
