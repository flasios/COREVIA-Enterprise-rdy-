/**
 * Vendor Evaluation Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const listEvalVendorsMock = vi.fn();
const createEvalVendorMock = vi.fn();
const updateEvalVendorMock = vi.fn();
const deleteEvalVendorMock = vi.fn();
const listEvalProposalsMock = vi.fn();
const processProposalMock = vi.fn();
const listEvalCriteriaMock = vi.fn();
const createEvalCriterionMock = vi.fn();
const listEvalScoresMock = vi.fn();
const evaluateVendorsMock = vi.fn();
const getLatestEvaluationMock = vi.fn();

vi.mock("../../application", () => ({
  listEvalVendors: (...a: unknown[]) => listEvalVendorsMock(...a),
  createEvalVendor: (...a: unknown[]) => createEvalVendorMock(...a),
  updateEvalVendor: (...a: unknown[]) => updateEvalVendorMock(...a),
  deleteEvalVendor: (...a: unknown[]) => deleteEvalVendorMock(...a),
  listEvalProposals: (...a: unknown[]) => listEvalProposalsMock(...a),
  processProposal: (...a: unknown[]) => processProposalMock(...a),
  listEvalCriteria: (...a: unknown[]) => listEvalCriteriaMock(...a),
  createEvalCriterion: (...a: unknown[]) => createEvalCriterionMock(...a),
  listEvalScores: (...a: unknown[]) => listEvalScoresMock(...a),
  evaluateVendors: (...a: unknown[]) => evaluateVendorsMock(...a),
  getLatestEvaluation: (...a: unknown[]) => getLatestEvaluationMock(...a),
}));

vi.mock("../../application/buildDeps", () => ({
  buildVendorEvalDeps: vi.fn(() => ({
    security: {
      enforce: vi.fn(),
      logRejection: vi.fn(),
      safeUnlink: vi.fn(),
    },
    db: {
      createProposal: vi.fn(),
      updateVendorStatus: vi.fn(),
    },
  })),
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

vi.mock("multer", () => {
  const middleware = (_req: unknown, _res: unknown, next: () => void) => next();
  const multerFn = () => ({ single: () => middleware });
  multerFn.diskStorage = vi.fn();
  return { default: multerFn };
});

const { createVendorEvaluationRouter } = await import("../vendor-evaluation.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createVendorEvaluationRouter({} as never));
  return app;
}

const ok = (data: unknown) => ({ success: true as const, data });

beforeEach(() => vi.clearAllMocks());

describe("Vendor Evaluation Routes", () => {
  describe("GET /vendors/:demandReportId", () => {
    it("lists evaluation vendors", async () => {
      listEvalVendorsMock.mockResolvedValue(ok([{ id: "v1" }]));
      const res = await request(createApp()).get("/vendors/dr1").expect(200);
      expect(res.body.data).toEqual([{ id: "v1" }]);
    });
  });

  describe("POST /vendors", () => {
    it("creates evaluation vendor", async () => {
      createEvalVendorMock.mockResolvedValue(ok({ id: "v2" }));
      await request(createApp()).post("/vendors").send({ name: "Vendor A" }).expect(200);
    });
  });

  describe("PATCH /vendors/:id", () => {
    it("updates evaluation vendor", async () => {
      updateEvalVendorMock.mockResolvedValue(ok({ id: "v1", name: "Updated" }));
      await request(createApp()).patch("/vendors/v1").send({ name: "Updated" }).expect(200);
    });
  });

  describe("DELETE /vendors/:id", () => {
    it("deletes evaluation vendor", async () => {
      deleteEvalVendorMock.mockResolvedValue(ok(null));
      await request(createApp()).delete("/vendors/v1").expect(200);
    });
  });

  describe("GET /proposals/:demandReportId", () => {
    it("lists proposals", async () => {
      listEvalProposalsMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/proposals/dr1").expect(200);
    });
  });

  describe("POST /proposals/:proposalId/process", () => {
    it("processes proposal", async () => {
      processProposalMock.mockResolvedValue(ok({ status: "processed" }));
      await request(createApp()).post("/proposals/p1/process").expect(200);
    });

    it("returns 202 for queued proposals", async () => {
      processProposalMock.mockResolvedValue(ok({ status: "queued" }));
      await request(createApp()).post("/proposals/p1/process").expect(202);
    });
  });

  describe("GET /criteria/:demandReportId", () => {
    it("lists evaluation criteria", async () => {
      listEvalCriteriaMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/criteria/dr1").expect(200);
    });
  });

  describe("POST /criteria", () => {
    it("creates criterion", async () => {
      createEvalCriterionMock.mockResolvedValue(ok({ id: "c1" }));
      await request(createApp()).post("/criteria").send({ name: "Cost" }).expect(200);
    });
  });

  describe("GET /scores/:proposalId", () => {
    it("lists scores", async () => {
      listEvalScoresMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/scores/p1").expect(200);
    });
  });

  describe("POST /evaluate/:demandReportId", () => {
    it("runs vendor evaluation", async () => {
      evaluateVendorsMock.mockResolvedValue(ok({ winner: "v1" }));
      await request(createApp()).post("/evaluate/dr1").expect(200);
    });
  });

  describe("GET /evaluation/:demandReportId", () => {
    it("returns latest evaluation", async () => {
      getLatestEvaluationMock.mockResolvedValue(ok({ id: "e1", score: 92 }));
      const res = await request(createApp()).get("/evaluation/dr1").expect(200);
      expect(res.body.data).toEqual({ id: "e1", score: 92 });
    });
  });
});
