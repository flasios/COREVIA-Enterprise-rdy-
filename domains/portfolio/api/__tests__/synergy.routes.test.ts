/**
 * Synergy Routes — Unit Tests
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

vi.mock("@interfaces/middleware/pagination", () => ({
  sendPaginated: (_req: unknown, res: { json: (d: unknown) => void }, data: unknown) => (res as { json: (d: unknown) => void }).json(data),
}));

const { createSynergyOpportunitiesRoutes, createSynergyDetectionRoutes } = await import("../synergy.routes");

function createOpportunitiesApp(storageMock: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId: "u1" } as unknown as typeof req.session;
    next();
  });
  app.use(createSynergyOpportunitiesRoutes(storageMock as never));
  return app;
}

function createDetectionApp(storageMock: Record<string, unknown>, synergyMock: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId: "u1" } as unknown as typeof req.session;
    next();
  });
  app.use(createSynergyDetectionRoutes(storageMock as never, { synergy: synergyMock } as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("Synergy Opportunities Routes", () => {
  it("GET / — lists all synergy opportunities", async () => {
    const storage = { getAllSynergyOpportunities: vi.fn().mockResolvedValue([]) };
    const res = await request(createOpportunitiesApp(storage)).get("/");
    expect(res.status).toBe(200);
  });

  it("GET /:id — returns single synergy", async () => {
    const synergy = { id: "s1", status: "pending" };
    const storage = { getSynergyOpportunity: vi.fn().mockResolvedValue(synergy) };
    const res = await request(createOpportunitiesApp(storage)).get("/s1");
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe("s1");
  });

  it("GET /:id — 404 when not found", async () => {
    const storage = { getSynergyOpportunity: vi.fn().mockResolvedValue(null) };
    const res = await request(createOpportunitiesApp(storage)).get("/s999");
    expect(res.status).toBe(404);
  });

  it("PATCH /:id — updates synergy status", async () => {
    const storage = { updateSynergyOpportunity: vi.fn().mockResolvedValue(undefined) };
    const res = await request(createOpportunitiesApp(storage)).patch("/s1").send({ status: "validated" });
    expect(res.status).toBe(200);
  });
});

describe("Synergy Detection Routes", () => {
  it("POST /:id/detect-synergies — 404 when demand not found", async () => {
    const storage = { getDemandReport: vi.fn().mockResolvedValue(null) };
    const res = await request(createDetectionApp(storage, {})).post("/d1/detect-synergies");
    expect(res.status).toBe(404);
  });

  it("POST /:id/detect-synergies — no matches returns empty", async () => {
    const storage = { getDemandReport: vi.fn().mockResolvedValue({ id: "d1" }) };
    const synergy = { detectSynergies: vi.fn().mockResolvedValue([]) };
    const res = await request(createDetectionApp(storage, synergy)).post("/d1/detect-synergies");
    expect(res.status).toBe(200);
    expect(res.body.data.matches).toEqual([]);
  });
});
