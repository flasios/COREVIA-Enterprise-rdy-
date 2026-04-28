/**
 * Compliance Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const runComplianceCheckMock = vi.fn();
const getComplianceStatusMock = vi.fn();
const getComplianceRunHistoryMock = vi.fn();
const applyComplianceFixMock = vi.fn();
const listComplianceRulesMock = vi.fn();

vi.mock("../../application/useCases", () => ({
  runComplianceCheck: (...a: unknown[]) => runComplianceCheckMock(...a),
  getComplianceStatus: (...a: unknown[]) => getComplianceStatusMock(...a),
  getComplianceRunHistory: (...a: unknown[]) => getComplianceRunHistoryMock(...a),
  applyComplianceFix: (...a: unknown[]) => applyComplianceFixMock(...a),
  listComplianceRules: (...a: unknown[]) => listComplianceRulesMock(...a),
}));

vi.mock("../../application/buildDeps", () => ({
  buildComplianceDeps: vi.fn(() => ({})),
}));

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  }),
}));

vi.mock("@interfaces/middleware/validateBody", () => ({
  validateBody: () => (req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@interfaces/middleware/pagination", () => ({
  sendPaginated: (_req: unknown, res: { json: (v: unknown) => void }, data: unknown) => res.json(data),
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { createComplianceRouter } = await import("../compliance.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createComplianceRouter({} as never));
  return app;
}

const ok = (data: unknown) => ({ success: true as const, data });

beforeEach(() => vi.clearAllMocks());

describe("Compliance Routes", () => {
  describe("POST /run/:reportId", () => {
    it("runs compliance check", async () => {
      runComplianceCheckMock.mockResolvedValue(ok({ runId: "r1", violations: 0 }));
      const res = await request(createApp()).post("/run/rpt1").send({}).expect(200);
      expect(res.body.data).toEqual({ runId: "r1", violations: 0 });
    });
  });

  describe("GET /status/:reportId", () => {
    it("returns compliance status", async () => {
      getComplianceStatusMock.mockResolvedValue(ok({ status: "compliant" }));
      const res = await request(createApp()).get("/status/rpt1").expect(200);
      expect(res.body.data).toEqual({ status: "compliant" });
    });
  });

  describe("GET /runs/:reportId", () => {
    it("returns run history", async () => {
      getComplianceRunHistoryMock.mockResolvedValue(ok([{ id: "run1" }]));
      const res = await request(createApp()).get("/runs/rpt1").expect(200);
      expect(res.body.data).toEqual([{ id: "run1" }]);
    });
  });

  describe("POST /apply-fix/:violationId", () => {
    it("applies compliance fix", async () => {
      applyComplianceFixMock.mockResolvedValue(ok({ message: "Fixed" }));
      const res = await request(createApp()).post("/apply-fix/42").expect(200);
      expect(res.body.message).toBe("Fixed");
    });
  });

  describe("GET /rules", () => {
    it("lists compliance rules", async () => {
      listComplianceRulesMock.mockResolvedValue(ok([{ id: "rule1", name: "Data Privacy" }]));
      const res = await request(createApp()).get("/rules").expect(200);
      expect(res.body.data).toEqual([{ id: "rule1", name: "Data Privacy" }]);
    });
  });
});
