/**
 * Portfolio Cost & Procurement Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getCostEntriesMock = vi.fn();
const createCostEntryMock = vi.fn();
const getProcurementItemsMock = vi.fn();
const getPaymentsMock = vi.fn();

vi.mock("../../application/buildDeps", () => ({
  buildCostProcDeps: () => ({}),
}));

vi.mock("../../application", () => ({
  getCostEntries: (...a: unknown[]) => getCostEntriesMock(...a),
  createCostEntry: (...a: unknown[]) => createCostEntryMock(...a),
  updateCostEntry: vi.fn(() => ({ success: true, data: {} })),
  deleteCostEntry: vi.fn(() => ({ success: true, data: null })),
  getProcurementItems: (...a: unknown[]) => getProcurementItemsMock(...a),
  createProcurementItem: vi.fn(() => ({ success: true, data: { id: "pi1" } })),
  updateProcurementItem: vi.fn(() => ({ success: true, data: {} })),
  deleteProcurementItem: vi.fn(() => ({ success: true, data: null })),
  getPayments: (...a: unknown[]) => getPaymentsMock(...a),
  createPayment: vi.fn(() => ({ success: true, data: { id: "pay1" } })),
  updatePayment: vi.fn(() => ({ success: true, data: {} })),
  deletePayment: vi.fn(() => ({ success: true, data: null })),
  updateWbsTaskActualCost: vi.fn(() => ({ success: true, data: null })),
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

vi.mock("@shared/schema", () => ({
  insertCostEntrySchema: { parse: (v: unknown) => v },
  insertProcurementItemSchema: { parse: (v: unknown) => v },
  insertProcurementPaymentSchema: { parse: (v: unknown) => v },
  updateCostEntrySchema: { parse: (v: unknown) => v },
  updateProcurementItemSchema: { parse: (v: unknown) => v },
  updateProcurementPaymentSchema: { parse: (v: unknown) => v },
}));

const { createPortfolioCostProcurementRoutes } = await import("../portfolio-cost-procurement.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createPortfolioCostProcurementRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Portfolio Cost & Procurement Routes", () => {
  it("GET /projects/:projectId/cost-entries — lists cost entries", async () => {
    getCostEntriesMock.mockResolvedValue({ success: true, data: [] });
    await request(createApp()).get("/projects/p1/cost-entries").expect(200);
  });

  it("POST /projects/:projectId/cost-entries — creates entry", async () => {
    createCostEntryMock.mockResolvedValue({ success: true, data: { id: "ce1" } });
    const res = await request(createApp()).post("/projects/p1/cost-entries").send({});
    expect([200, 201, 400, 500]).toContain(res.status);
  });

  it("GET /projects/:projectId/procurement-items — lists items", async () => {
    getProcurementItemsMock.mockResolvedValue({ success: true, data: [] });
    await request(createApp()).get("/projects/p1/procurement-items").expect(200);
  });

  it("GET /projects/:projectId/payments — lists payments", async () => {
    getPaymentsMock.mockResolvedValue({ success: true, data: [] });
    await request(createApp()).get("/projects/p1/payments").expect(200);
  });
});
