/**
 * Demand Conversion Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const listConversionRequestsMock = vi.fn();
const getConversionRequestMock = vi.fn();
const getConversionStatsMock = vi.fn();
const createConversionRequestMock = vi.fn();
const approveConversionRequestMock = vi.fn();
const rejectConversionRequestMock = vi.fn();

vi.mock("../../application", () => ({
  listConversionRequests: (...a: unknown[]) => listConversionRequestsMock(...a),
  getConversionRequest: (...a: unknown[]) => getConversionRequestMock(...a),
  getConversionStats: (...a: unknown[]) => getConversionStatsMock(...a),
  createConversionRequest: (...a: unknown[]) => createConversionRequestMock(...a),
  approveConversionRequest: (...a: unknown[]) => approveConversionRequestMock(...a),
  rejectConversionRequest: (...a: unknown[]) => rejectConversionRequestMock(...a),
  StorageDemandReportRepository: vi.fn(),
  StorageConversionRequestRepository: vi.fn(),
  StoragePortfolioProjectCreator: vi.fn(),
  StorageNotificationSender: vi.fn(),
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

const { createDemandConversionRoutes } = await import("../demand-conversion.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createDemandConversionRoutes({} as never));
  return app;
}

const ok = (data: unknown) => ({ success: true as const, data });

beforeEach(() => vi.clearAllMocks());

describe("Demand Conversion Routes", () => {
  it("GET / — lists conversion requests", async () => {
    listConversionRequestsMock.mockResolvedValue(ok([]));
    const res = await request(createApp()).get("/").expect(200);
    expect(res.body.success).toBe(true);
  });

  it("GET /stats — returns conversion stats", async () => {
    getConversionStatsMock.mockResolvedValue(ok({ total: 5 }));
    await request(createApp()).get("/stats").expect(200);
  });

  it("GET /:id — returns conversion request", async () => {
    getConversionRequestMock.mockResolvedValue(ok({ id: "c1" }));
    await request(createApp()).get("/c1").expect(200);
  });

  it("POST / — creates conversion request", async () => {
    createConversionRequestMock.mockResolvedValue(ok({ id: "c2" }));
    await request(createApp()).post("/").send({ demandId: "d1", projectName: "P" }).expect(201);
  });

  it("PUT /:id/approve — approves conversion", async () => {
    approveConversionRequestMock.mockResolvedValue(ok({ approved: true }));
    await request(createApp()).put("/c1/approve").send({}).expect(200);
  });

  it("PUT /:id/reject — rejects conversion", async () => {
    rejectConversionRequestMock.mockResolvedValue(ok({ rejected: true }));
    await request(createApp()).put("/c1/reject").send({ rejectionReason: "Not suitable" }).expect(200);
  });
});
