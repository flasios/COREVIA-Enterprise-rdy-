/**
 * RAG Routes — Unit Tests
 *
 * Tests RAG agent endpoints:
 *   - Auth enforcement
 *   - POST /agents/:domain, GET /agents, POST /orchestrate
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const runRagAgentMock = vi.fn();
const listRagAgentsMock = vi.fn();
const orchestrateMultiAgentMock = vi.fn();

vi.mock("../../application", () => ({
  runRagAgent: (...a: unknown[]) => runRagAgentMock(...a),
  listRagAgents: (...a: unknown[]) => listRagAgentsMock(...a),
  orchestrateMultiAgent: (...a: unknown[]) => orchestrateMultiAgentMock(...a),
  buildRagDeps: vi.fn(() => ({ deps: true })),
}));

const requireAuthMock = vi.fn((_req: unknown, _res: unknown, next: () => void) => next());

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (req: unknown, res: unknown, next: () => void) =>
      requireAuthMock(req, res, next),
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

const { createRAGRoutes } = await import("../rag.routes");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId: "u1", role: "manager" } as unknown as typeof req.session;
    next();
  });
  app.use(createRAGRoutes({} as never));
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockImplementation((_r: unknown, _s: unknown, n: () => void) => n());
});

describe("RAG Routes", () => {
  describe("auth enforcement", () => {
    it("rejects unauthenticated POST /agents/knowledge", async () => {
      requireAuthMock.mockImplementation((_r: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) =>
        res.status(401).json({ error: "Unauthorized" }),
      );
      await request(createApp()).post("/agents/knowledge").send({ query: "test" }).expect(401);
    });
  });

  describe("POST /agents/:domain", () => {
    it("runs RAG agent for domain", async () => {
      runRagAgentMock.mockResolvedValue({ success: true, data: { answer: "found" } });
      const res = await request(createApp())
        .post("/agents/knowledge")
        .send({ query: "find docs" })
        .expect(200);
      expect(res.body).toEqual({ success: true, data: { answer: "found" } });
    });

    it("forwards error", async () => {
      runRagAgentMock.mockResolvedValue({ success: false, status: 400, error: "Bad query" });
      await request(createApp()).post("/agents/knowledge").send({ query: "" }).expect(400);
    });
  });

  describe("GET /agents", () => {
    it("lists available agents", async () => {
      listRagAgentsMock.mockReturnValue({ success: true, agents: ["knowledge", "demand"] });
      const res = await request(createApp()).get("/agents").expect(200);
      expect(res.body.agents).toEqual(["knowledge", "demand"]);
    });
  });

  describe("POST /orchestrate", () => {
    it("orchestrates multi-agent query", async () => {
      orchestrateMultiAgentMock.mockResolvedValue({ success: true, data: { combined: true } });
      const res = await request(createApp())
        .post("/orchestrate")
        .send({ query: "complex analysis" })
        .expect(200);
      expect(res.body).toEqual({ success: true, data: { combined: true } });
    });

    it("forwards orchestration error", async () => {
      orchestrateMultiAgentMock.mockResolvedValue({ success: false, status: 500, error: "Failed" });
      await request(createApp()).post("/orchestrate").send({ query: "x" }).expect(500);
    });
  });
});
