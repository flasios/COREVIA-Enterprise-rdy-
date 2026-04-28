/**
 * AI Routes — Unit Tests
 *
 * Tests the intelligence AI endpoints:
 *   - Session auth enforcement on all endpoints
 *   - Evidence evaluation, email, task guidance
 *   - Deployment strategy, translate, coveria demand
 *   - Provider status, health, set-default
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const evaluateEvidenceMock = vi.fn();
const sendEvidenceEmailMock = vi.fn();
const getTaskCompletionGuidanceMock = vi.fn();
const generateDeploymentStrategyMock = vi.fn();
const translateTextMock = vi.fn();
const coveriaGenerateDemandMock = vi.fn();

vi.mock("../../application", () => ({
  evaluateEvidence: (...a: unknown[]) => evaluateEvidenceMock(...a),
  sendEvidenceEmail: (...a: unknown[]) => sendEvidenceEmailMock(...a),
  getTaskCompletionGuidance: (...a: unknown[]) => getTaskCompletionGuidanceMock(...a),
  generateDeploymentStrategy: (...a: unknown[]) => generateDeploymentStrategyMock(...a),
  translateText: (...a: unknown[]) => translateTextMock(...a),
  coveriaGenerateDemand: (...a: unknown[]) => coveriaGenerateDemandMock(...a),
  buildAIDeps: vi.fn(() => ({
    providerStatus: { checkAvailability: vi.fn().mockResolvedValue({ anthropic: true, openai: false, falcon: false }) },
  })),
}));

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
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

const { createAIRoutes } = await import("../ai.routes");

function createApp(userId?: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    next();
  });
  app.use(createAIRoutes({} as never));
  return app;
}

const ok = (data: unknown) => ({ success: true as const, data });
const fail = (status: number, error: string) => ({ success: false as const, status, error });

beforeEach(() => vi.clearAllMocks());

describe("AI Routes", () => {
  describe("auth enforcement", () => {
    it("rejects unauthenticated POST /evaluate-evidence", async () => {
      await request(createApp()).post("/evaluate-evidence").send({}).expect(401);
    });
    it("rejects unauthenticated POST /send-evidence-email", async () => {
      await request(createApp()).post("/send-evidence-email").send({ recipientEmail: "a@b.c" }).expect(401);
    });
  });

  describe("POST /evaluate-evidence", () => {
    it("returns analysis on success", async () => {
      evaluateEvidenceMock.mockResolvedValue(ok({ score: 90 }));
      const res = await request(createApp("u1")).post("/evaluate-evidence").send({}).expect(200);
      expect(res.body).toEqual({ success: true, analysis: { score: 90 } });
    });

    it("forwards failure", async () => {
      evaluateEvidenceMock.mockResolvedValue(fail(400, "Invalid"));
      await request(createApp("u1")).post("/evaluate-evidence").send({}).expect(400);
    });
  });

  describe("POST /send-evidence-email", () => {
    it("sends email on success", async () => {
      sendEvidenceEmailMock.mockResolvedValue(ok({ sent: true }));
      const res = await request(createApp("u1"))
        .post("/send-evidence-email")
        .send({ recipientEmail: "a@b.c" })
        .expect(200);
      expect(res.body).toEqual({ sent: true });
    });
  });

  describe("POST /task-completion-advisor", () => {
    it("returns guidance", async () => {
      getTaskCompletionGuidanceMock.mockResolvedValue(ok({ steps: [] }));
      const res = await request(createApp("u1"))
        .post("/task-completion-advisor")
        .send({})
        .expect(200);
      expect(res.body).toEqual({ success: true, guidance: { steps: [] } });
    });
  });

  describe("POST /deployment-strategy", () => {
    it("returns recommendation", async () => {
      generateDeploymentStrategyMock.mockReturnValue(ok({ strategy: "blue-green" }));
      const res = await request(createApp("u1"))
        .post("/deployment-strategy")
        .send({})
        .expect(200);
      expect(res.body).toEqual({ success: true, recommendation: { strategy: "blue-green" } });
    });
  });

  describe("POST /translate", () => {
    it("translates text", async () => {
      translateTextMock.mockResolvedValue(ok({ translatedText: "مرحبا" }));
      const res = await request(createApp("u1"))
        .post("/translate")
        .send({ text: "hello", from: "en", to: "ar" })
        .expect(200);
      expect(res.body).toEqual({ success: true, translatedText: "مرحبا" });
    });
  });

  describe("POST /coveria-generate-demand", () => {
    it("generates demand", async () => {
      coveriaGenerateDemandMock.mockResolvedValue(ok({ demandId: "d1" }));
      const res = await request(createApp("u1"))
        .post("/coveria-generate-demand")
        .send({ description: "Need a system" })
        .expect(200);
      expect(res.body).toEqual({ success: true, demandId: "d1" });
    });
  });

  describe("GET /providers/status", () => {
    it("returns provider status", async () => {
      const res = await request(createApp("u1")).get("/providers/status").expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.providers).toBeDefined();
    });

    it("rejects unauthenticated", async () => {
      await request(createApp()).get("/providers/status").expect(401);
    });
  });

  describe("GET /providers/health", () => {
    it("returns health check", async () => {
      const res = await request(createApp("u1")).get("/providers/health").expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.health).toBeDefined();
    });
  });

  describe("POST /providers/set-default", () => {
    it("sets default provider", async () => {
      const res = await request(createApp("u1"))
        .post("/providers/set-default")
        .send({ provider: "anthropic" })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.provider).toBe("anthropic");
    });
  });
});
