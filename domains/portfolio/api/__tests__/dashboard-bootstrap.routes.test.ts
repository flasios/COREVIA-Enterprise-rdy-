/**
 * Dashboard Bootstrap Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchDashboardBootstrapMock = vi.fn();
const fetchIntelligenceBootstrapMock = vi.fn();

vi.mock("../../application", () => ({
  fetchDashboardBootstrap: (...a: unknown[]) => fetchDashboardBootstrapMock(...a),
  fetchIntelligenceBootstrap: (...a: unknown[]) => fetchIntelligenceBootstrapMock(...a),
}));

vi.mock("@interfaces/middleware/cache", () => ({
  apiCache: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { createDashboardBootstrapRoutes } = await import("../dashboard-bootstrap.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    next();
  });
  app.use(createDashboardBootstrapRoutes());
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Dashboard Bootstrap Routes", () => {
  it("GET /bootstrap — returns dashboard data", async () => {
    fetchDashboardBootstrapMock.mockResolvedValue({
      notifications: [],
      portfolioTotal: 5,
      demandTotal: 10,
      decisionsTotal: 3,
      todayEvents: 1,
    });
    const res = await request(createApp()).get("/bootstrap");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.portfolio.totalProjects).toBe(5);
  });

  it("GET /bootstrap — 401 when no session", async () => {
    const app = express();
    app.use(express.json());
    app.use(createDashboardBootstrapRoutes());
    const res = await request(app).get("/bootstrap");
    expect(res.status).toBe(401);
  });

  it("GET /intelligence-bootstrap — returns intelligence data", async () => {
    fetchIntelligenceBootstrapMock.mockResolvedValue({
      knowledgeDocs: 42,
      eventsTotal: 100,
    });
    const res = await request(createApp()).get("/intelligence-bootstrap");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stats.knowledgeDocuments).toBe(42);
  });

  it("GET /intelligence-bootstrap — 401 without session", async () => {
    const app = express();
    app.use(express.json());
    app.use(createDashboardBootstrapRoutes());
    const res = await request(app).get("/intelligence-bootstrap");
    expect(res.status).toBe(401);
  });
});
