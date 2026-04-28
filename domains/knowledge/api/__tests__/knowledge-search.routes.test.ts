/**
 * Knowledge Search Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const semanticSearchMock = vi.fn();
const hybridSearchMock = vi.fn();
const enhancedSearchMock = vi.fn();
const enhancedAskMock = vi.fn();
const askMock = vi.fn();
const getSuggestionsMock = vi.fn();

vi.mock("../../application", () => ({
  buildKnowledgeSearchDeps: vi.fn(() => ({})),
  semanticSearch: (...a: unknown[]) => semanticSearchMock(...a),
  hybridSearch: (...a: unknown[]) => hybridSearchMock(...a),
  enhancedSearch: (...a: unknown[]) => enhancedSearchMock(...a),
  enhancedAsk: (...a: unknown[]) => enhancedAskMock(...a),
  ask: (...a: unknown[]) => askMock(...a),
  getSuggestions: (...a: unknown[]) => getSuggestionsMock(...a),
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

const { createKnowledgeSearchRoutes } = await import("../knowledge-search.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId, role: "analyst", organizationId: "org1" } as unknown as typeof req.session;
    next();
  });
  app.use(createKnowledgeSearchRoutes({} as never));
  return app;
}

const ok = (data: unknown) => ({ success: true as const, data });

beforeEach(() => vi.clearAllMocks());

describe("Knowledge Search Routes", () => {
  describe("POST /search", () => {
    it("performs semantic search", async () => {
      semanticSearchMock.mockResolvedValue(ok([{ id: "d1", score: 0.9 }]));
      const res = await request(createApp())
        .post("/search")
        .send({ query: "governance policy" })
        .expect(200);
      expect(res.body.data).toEqual([{ id: "d1", score: 0.9 }]);
    });
  });

  describe("POST /hybrid-search", () => {
    it("performs hybrid search", async () => {
      hybridSearchMock.mockResolvedValue(ok([{ id: "d2" }]));
      const res = await request(createApp())
        .post("/hybrid-search")
        .send({ query: "data protection" })
        .expect(200);
      expect(res.body.data).toEqual([{ id: "d2" }]);
    });
  });

  describe("POST /enhanced-search", () => {
    it("performs enhanced search", async () => {
      enhancedSearchMock.mockResolvedValue(ok({ results: [], summary: "No results" }));
      const res = await request(createApp())
        .post("/enhanced-search")
        .send({ query: "risk assessment" })
        .expect(200);
      expect(res.body.data).toEqual({ results: [], summary: "No results" });
    });
  });

  describe("POST /enhanced-ask", () => {
    it("performs enhanced ask", async () => {
      enhancedAskMock.mockResolvedValue(ok({ answer: "Yes, aligned." }));
      const res = await request(createApp())
        .post("/enhanced-ask")
        .send({ query: "Is this aligned?" })
        .expect(200);
      expect(res.body.data).toEqual({ answer: "Yes, aligned." });
    });
  });

  describe("POST /ask", () => {
    it("asks knowledge base", async () => {
      askMock.mockResolvedValue(ok({ answer: "42" }));
      const res = await request(createApp())
        .post("/ask")
        .send({ query: "What is the answer?" })
        .expect(200);
      expect(res.body.data).toEqual({ answer: "42" });
    });
  });

  describe("GET /suggestions", () => {
    it("returns suggestions", async () => {
      getSuggestionsMock.mockResolvedValue(ok([{ title: "Suggestion 1" }]));
      const res = await request(createApp()).get("/suggestions?stage=requirements").expect(200);
      expect(res.body.data).toEqual([{ title: "Suggestion 1" }]);
    });
  });
});
