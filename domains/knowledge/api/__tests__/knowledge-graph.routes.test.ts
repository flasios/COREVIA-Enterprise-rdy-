/**
 * Knowledge Graph Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getGraphDataMock = vi.fn();
const getGraphStatsMock = vi.fn();
const processDocumentForGraphMock = vi.fn();
const getEntityByIdMock = vi.fn();
const searchEntitiesMock = vi.fn();
const verifyEntityMock = vi.fn();
const deleteEntityMock = vi.fn();

vi.mock("../../application", () => ({
  buildKnowledgeGraphDeps: vi.fn(() => ({})),
  getGraphData: (...a: unknown[]) => getGraphDataMock(...a),
  getGraphStats: (...a: unknown[]) => getGraphStatsMock(...a),
  processDocumentForGraph: (...a: unknown[]) => processDocumentForGraphMock(...a),
  getEntityById: (...a: unknown[]) => getEntityByIdMock(...a),
  searchEntities: (...a: unknown[]) => searchEntitiesMock(...a),
  verifyEntity: (...a: unknown[]) => verifyEntityMock(...a),
  deleteEntity: (...a: unknown[]) => deleteEntityMock(...a),
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

const { createKnowledgeGraphRoutes } = await import("../knowledge-graph.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    next();
  });
  app.use(createKnowledgeGraphRoutes({} as never));
  return app;
}

const ok = (data: unknown) => ({ success: true as const, data });

beforeEach(() => vi.clearAllMocks());

describe("Knowledge Graph Routes", () => {
  describe("GET /", () => {
    it("returns graph data", async () => {
      getGraphDataMock.mockResolvedValue(ok({ nodes: [], edges: [] }));
      const res = await request(createApp()).get("/").expect(200);
      expect(res.body.data).toEqual({ nodes: [], edges: [] });
    });
  });

  describe("GET /stats", () => {
    it("returns graph stats", async () => {
      getGraphStatsMock.mockResolvedValue(ok({ entityCount: 10, relationshipCount: 5 }));
      const res = await request(createApp()).get("/stats").expect(200);
      expect(res.body.data).toEqual({ entityCount: 10, relationshipCount: 5 });
    });
  });

  describe("POST /process/:documentId", () => {
    it("processes document for graph", async () => {
      processDocumentForGraphMock.mockResolvedValue(ok({ entitiesCreated: 3 }));
      const res = await request(createApp()).post("/process/doc1").expect(200);
      expect(res.body.data).toEqual({ entitiesCreated: 3 });
    });
  });

  describe("GET /entity/:entityId", () => {
    it("returns entity by id", async () => {
      getEntityByIdMock.mockResolvedValue(ok({ id: "e1", name: "Test" }));
      const res = await request(createApp()).get("/entity/e1").expect(200);
      expect(res.body.data).toEqual({ id: "e1", name: "Test" });
    });
  });

  describe("POST /search", () => {
    it("searches entities", async () => {
      searchEntitiesMock.mockResolvedValue(ok([{ id: "e1" }]));
      const res = await request(createApp())
        .post("/search")
        .send({ query: "test", limit: 5 })
        .expect(200);
      expect(res.body.data).toEqual([{ id: "e1" }]);
    });
  });

  describe("POST /entity/:entityId/verify", () => {
    it("verifies entity", async () => {
      verifyEntityMock.mockResolvedValue(ok({ verified: true }));
      await request(createApp()).post("/entity/e1/verify").expect(200);
    });
  });

  describe("DELETE /entity/:entityId", () => {
    it("deletes entity", async () => {
      deleteEntityMock.mockResolvedValue(ok(null));
      await request(createApp()).delete("/entity/e1").expect(200);
    });
  });
});
