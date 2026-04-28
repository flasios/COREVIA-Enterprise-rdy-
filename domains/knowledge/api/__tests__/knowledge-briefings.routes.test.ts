/**
 * Knowledge Briefings Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const listBriefingsMock = vi.fn();
const createBriefingMock = vi.fn();
const getBriefingByIdMock = vi.fn();
const publishBriefingMock = vi.fn();
const archiveBriefingMock = vi.fn();
const deleteBriefingMock = vi.fn();
const generateWeeklyDigestMock = vi.fn();

vi.mock("../../application", () => ({
  buildKnowledgeBriefingsDeps: vi.fn(() => ({})),
  listBriefings: (...a: unknown[]) => listBriefingsMock(...a),
  createBriefing: (...a: unknown[]) => createBriefingMock(...a),
  getBriefingById: (...a: unknown[]) => getBriefingByIdMock(...a),
  publishBriefing: (...a: unknown[]) => publishBriefingMock(...a),
  archiveBriefing: (...a: unknown[]) => archiveBriefingMock(...a),
  deleteBriefing: (...a: unknown[]) => deleteBriefingMock(...a),
  generateWeeklyDigest: (...a: unknown[]) => generateWeeklyDigestMock(...a),
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

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { createKnowledgeBriefingsRoutes } = await import("../knowledge-briefings.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId, role: "manager", organizationId: "org1" } as unknown as typeof req.session;
    next();
  });
  app.use(createKnowledgeBriefingsRoutes({} as never));
  return app;
}

const ok = (data: unknown) => ({ success: true as const, data });

beforeEach(() => vi.clearAllMocks());

describe("Knowledge Briefings Routes", () => {
  describe("GET /", () => {
    it("lists briefings", async () => {
      listBriefingsMock.mockResolvedValue(ok([{ id: "b1" }]));
      const res = await request(createApp()).get("/").expect(200);
      expect(res.body.data).toEqual([{ id: "b1" }]);
    });
  });

  describe("POST /", () => {
    it("creates briefing", async () => {
      createBriefingMock.mockResolvedValue(ok({ id: "b2" }));
      const res = await request(createApp())
        .post("/")
        .send({ title: "Weekly", briefingType: "digest" })
        .expect(200);
      expect(res.body.data).toEqual({ id: "b2" });
    });
  });

  describe("GET /:briefingId", () => {
    it("returns briefing by id", async () => {
      getBriefingByIdMock.mockResolvedValue(ok({ id: "b1", title: "Report" }));
      const res = await request(createApp()).get("/b1").expect(200);
      expect(res.body.data).toEqual({ id: "b1", title: "Report" });
    });
  });

  describe("POST /:briefingId/publish", () => {
    it("publishes briefing", async () => {
      publishBriefingMock.mockResolvedValue(ok({ id: "b1", status: "published" }));
      await request(createApp()).post("/b1/publish").expect(200);
    });
  });

  describe("POST /:briefingId/archive", () => {
    it("archives briefing", async () => {
      archiveBriefingMock.mockResolvedValue(ok({ id: "b1", status: "archived" }));
      await request(createApp()).post("/b1/archive").expect(200);
    });
  });

  describe("DELETE /:briefingId", () => {
    it("deletes briefing", async () => {
      deleteBriefingMock.mockResolvedValue(ok(null));
      await request(createApp()).delete("/b1").expect(200);
    });
  });

  describe("POST /weekly-digest", () => {
    it("generates weekly digest", async () => {
      generateWeeklyDigestMock.mockResolvedValue(ok({ briefingId: "b3" }));
      const res = await request(createApp()).post("/weekly-digest").expect(200);
      expect(res.body.data).toEqual({ briefingId: "b3" });
    });
  });
});
