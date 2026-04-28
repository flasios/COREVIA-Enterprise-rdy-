/**
 * Tender Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const generateTenderMock = vi.fn();
const listTendersMock = vi.fn();
const getTenderMock = vi.fn();
const getTendersByDemandMock = vi.fn();
const updateTenderPackageMock = vi.fn();
const getNotificationsByRoleMock = vi.fn();
const getUserNotificationsMock = vi.fn();
const markNotificationReadMock = vi.fn();
const markAllNotificationsReadMock = vi.fn();
const listSlaRulesMock = vi.fn();
const createSlaRuleMock = vi.fn();
const getSlaMetricsMock = vi.fn();
const getSlaDeadlinesMock = vi.fn();
const getSlaAssignmentMock = vi.fn();
const createSlaAssignmentMock = vi.fn();
const getAlertsMock = vi.fn();
const resolveAlertMock = vi.fn();
const checkEscalationsMock = vi.fn();
const getEscalationStatusMock = vi.fn();
const listRfpVersionsMock = vi.fn();
const getLatestRfpVersionMock = vi.fn();
const createRfpVersionMock = vi.fn();
const getRfpVersionMock = vi.fn();
const updateRfpVersionMock = vi.fn();
const deleteRfpVersionMock = vi.fn();
const listTenderVendorsMock = vi.fn();
const createTenderVendorMock = vi.fn();
const updateTenderVendorMock = vi.fn();
const deleteTenderVendorMock = vi.fn();
const listTenderProposalsMock = vi.fn();
const createTenderProposalMock = vi.fn();
const updateTenderProposalMock = vi.fn();
const deleteTenderProposalMock = vi.fn();
const listTenderCriteriaMock = vi.fn();
const getDefaultCriteriaMock = vi.fn();
const createTenderCriterionMock = vi.fn();
const updateTenderCriterionMock = vi.fn();
const deleteTenderCriterionMock = vi.fn();
const listTenderScoresMock = vi.fn();
const createTenderScoreMock = vi.fn();
const updateTenderScoreMock = vi.fn();
const getTenderEvaluationMock = vi.fn();
const createTenderEvaluationMock = vi.fn();
const updateTenderEvaluationMock = vi.fn();

vi.mock("../../application", () => ({
  generateTender: (...a: unknown[]) => generateTenderMock(...a),
  listTenders: (...a: unknown[]) => listTendersMock(...a),
  getTender: (...a: unknown[]) => getTenderMock(...a),
  getTendersByDemand: (...a: unknown[]) => getTendersByDemandMock(...a),
  updateTenderPackage: (...a: unknown[]) => updateTenderPackageMock(...a),
  getNotificationsByRole: (...a: unknown[]) => getNotificationsByRoleMock(...a),
  getUserNotifications: (...a: unknown[]) => getUserNotificationsMock(...a),
  markNotificationRead: (...a: unknown[]) => markNotificationReadMock(...a),
  markAllNotificationsRead: (...a: unknown[]) => markAllNotificationsReadMock(...a),
  listSlaRules: (...a: unknown[]) => listSlaRulesMock(...a),
  createSlaRule: (...a: unknown[]) => createSlaRuleMock(...a),
  getSlaMetrics: (...a: unknown[]) => getSlaMetricsMock(...a),
  getSlaDeadlines: (...a: unknown[]) => getSlaDeadlinesMock(...a),
  getSlaAssignment: (...a: unknown[]) => getSlaAssignmentMock(...a),
  createSlaAssignment: (...a: unknown[]) => createSlaAssignmentMock(...a),
  getAlerts: (...a: unknown[]) => getAlertsMock(...a),
  resolveAlert: (...a: unknown[]) => resolveAlertMock(...a),
  checkEscalations: (...a: unknown[]) => checkEscalationsMock(...a),
  getEscalationStatus: (...a: unknown[]) => getEscalationStatusMock(...a),
  listRfpVersions: (...a: unknown[]) => listRfpVersionsMock(...a),
  getLatestRfpVersion: (...a: unknown[]) => getLatestRfpVersionMock(...a),
  createRfpVersion: (...a: unknown[]) => createRfpVersionMock(...a),
  getRfpVersion: (...a: unknown[]) => getRfpVersionMock(...a),
  updateRfpVersion: (...a: unknown[]) => updateRfpVersionMock(...a),
  deleteRfpVersion: (...a: unknown[]) => deleteRfpVersionMock(...a),
  listTenderVendors: (...a: unknown[]) => listTenderVendorsMock(...a),
  createTenderVendor: (...a: unknown[]) => createTenderVendorMock(...a),
  updateTenderVendor: (...a: unknown[]) => updateTenderVendorMock(...a),
  deleteTenderVendor: (...a: unknown[]) => deleteTenderVendorMock(...a),
  listTenderProposals: (...a: unknown[]) => listTenderProposalsMock(...a),
  createTenderProposal: (...a: unknown[]) => createTenderProposalMock(...a),
  updateTenderProposal: (...a: unknown[]) => updateTenderProposalMock(...a),
  deleteTenderProposal: (...a: unknown[]) => deleteTenderProposalMock(...a),
  listTenderCriteria: (...a: unknown[]) => listTenderCriteriaMock(...a),
  getDefaultCriteria: (...a: unknown[]) => getDefaultCriteriaMock(...a),
  createTenderCriterion: (...a: unknown[]) => createTenderCriterionMock(...a),
  updateTenderCriterion: (...a: unknown[]) => updateTenderCriterionMock(...a),
  deleteTenderCriterion: (...a: unknown[]) => deleteTenderCriterionMock(...a),
  listTenderScores: (...a: unknown[]) => listTenderScoresMock(...a),
  createTenderScore: (...a: unknown[]) => createTenderScoreMock(...a),
  updateTenderScore: (...a: unknown[]) => updateTenderScoreMock(...a),
  getTenderEvaluation: (...a: unknown[]) => getTenderEvaluationMock(...a),
  createTenderEvaluation: (...a: unknown[]) => createTenderEvaluationMock(...a),
  updateTenderEvaluation: (...a: unknown[]) => updateTenderEvaluationMock(...a),
}));

vi.mock("../../application/buildDeps", () => ({
  buildTenderDeps: vi.fn(() => ({})),
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

vi.mock("@shared/schema/intelligence", () => ({
  insertTenderSlaRuleSchema: { partial: () => ({}) },
  updateRfpDocumentVersionSchema: { partial: () => ({}) },
}));

vi.mock("@shared/schema/governance", () => ({
  insertVendorParticipantSchema: { partial: () => ({}) },
  insertVendorProposalSchema: { partial: () => ({}) },
  insertEvaluationCriteriaSchema: { partial: () => ({}) },
  insertProposalScoreSchema: { partial: () => ({}) },
  insertVendorEvaluationSchema: { partial: () => ({}) },
}));

const { createTenderRouter } = await import("../tender.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createTenderRouter({} as never));
  return app;
}

const ok = (data: unknown) => ({ success: true as const, data });

beforeEach(() => vi.clearAllMocks());

describe("Tender Routes", () => {
  /* ── Core CRUD ──────────────────────────────── */

  describe("POST /generate/:demandId", () => {
    it("generates tender", async () => {
      generateTenderMock.mockResolvedValue(ok({ id: "t1" }));
      await request(createApp()).post("/generate/d1").expect(200);
    });
  });

  describe("GET /", () => {
    it("lists tenders", async () => {
      listTendersMock.mockResolvedValue(ok([{ id: "t1" }]));
      const res = await request(createApp()).get("/").expect(200);
      expect(res.body.data).toEqual([{ id: "t1" }]);
    });
  });

  describe("GET /:id", () => {
    it("returns tender by id", async () => {
      getTenderMock.mockResolvedValue(ok({ id: "t1" }));
      await request(createApp()).get("/t1").expect(200);
    });
  });

  describe("GET /demand/:demandId", () => {
    it("returns tenders by demand", async () => {
      getTendersByDemandMock.mockResolvedValue(ok([{ id: "t1" }]));
      await request(createApp()).get("/demand/d1").expect(200);
    });
  });

  describe("PATCH /:id", () => {
    it("updates tender package", async () => {
      updateTenderPackageMock.mockResolvedValue(ok({ id: "t1", status: "approved" }));
      await request(createApp()).patch("/t1").send({ status: "approved" }).expect(200);
    });
  });

  /* ── Notifications ──────────────────────────── */

  describe("GET /notifications/role/:role", () => {
    it("returns role notifications", async () => {
      getNotificationsByRoleMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/notifications/role/manager").expect(200);
    });
  });

  describe("GET /notifications/user", () => {
    it("returns user notifications", async () => {
      getUserNotificationsMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/notifications/user").expect(200);
    });
  });

  describe("PATCH /notifications/:id/read", () => {
    it("marks notification read", async () => {
      markNotificationReadMock.mockResolvedValue(ok(null));
      await request(createApp()).patch("/notifications/n1/read").expect(200);
    });
  });

  describe("POST /notifications/read-all", () => {
    it("marks all notifications read", async () => {
      markAllNotificationsReadMock.mockResolvedValue(ok(null));
      await request(createApp()).post("/notifications/read-all").expect(200);
    });
  });

  /* ── SLA ─────────────────────────────────────── */

  describe("GET /sla/rules", () => {
    it("lists SLA rules", async () => {
      listSlaRulesMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/sla/rules").expect(200);
    });
  });

  describe("POST /sla/rules", () => {
    it("creates SLA rule", async () => {
      createSlaRuleMock.mockResolvedValue(ok({ id: "sr1" }));
      await request(createApp()).post("/sla/rules").send({}).expect(200);
    });
  });

  describe("GET /sla/metrics", () => {
    it("returns SLA metrics", async () => {
      getSlaMetricsMock.mockResolvedValue(ok({ compliance: 0.95 }));
      await request(createApp()).get("/sla/metrics").expect(200);
    });
  });

  /* ── Alerts ──────────────────────────────────── */

  describe("GET /alerts", () => {
    it("returns alerts", async () => {
      getAlertsMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/alerts").expect(200);
    });
  });

  describe("POST /alerts/:id/resolve", () => {
    it("resolves alert", async () => {
      resolveAlertMock.mockResolvedValue(ok({ resolved: true }));
      await request(createApp()).post("/alerts/a1/resolve").send({ resolution: "Fixed" }).expect(200);
    });
  });

  /* ── RFP Versions ────────────────────────────── */

  describe("GET /:id/versions", () => {
    it("lists RFP versions", async () => {
      listRfpVersionsMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/t1/versions").expect(200);
    });
  });

  describe("POST /:id/versions", () => {
    it("creates RFP version", async () => {
      createRfpVersionMock.mockResolvedValue(ok({ id: "v1" }));
      await request(createApp())
        .post("/t1/versions")
        .send({ versionNumber: "1.0.0", majorVersion: 1, minorVersion: 0 })
        .expect(200);
    });
  });

  /* ── Vendors ─────────────────────────────────── */

  describe("GET /vendors/:demandId", () => {
    it("lists vendors", async () => {
      listTenderVendorsMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/vendors/d1").expect(200);
    });
  });

  describe("POST /vendors", () => {
    it("creates vendor", async () => {
      createTenderVendorMock.mockResolvedValue(ok({ id: "v1" }));
      await request(createApp()).post("/vendors").send({}).expect(200);
    });
  });

  describe("DELETE /vendors/:id", () => {
    it("deletes vendor", async () => {
      deleteTenderVendorMock.mockResolvedValue(ok(null));
      await request(createApp()).delete("/vendors/v1").expect(200);
    });
  });

  /* ── Proposals ───────────────────────────────── */

  describe("GET /proposals/:demandId", () => {
    it("lists proposals", async () => {
      listTenderProposalsMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/proposals/d1").expect(200);
    });
  });

  describe("DELETE /proposals/:id", () => {
    it("deletes proposal", async () => {
      deleteTenderProposalMock.mockResolvedValue(ok(null));
      await request(createApp()).delete("/proposals/p1").expect(200);
    });
  });

  /* ── Criteria ────────────────────────────────── */

  describe("GET /criteria/:demandId", () => {
    it("lists criteria", async () => {
      listTenderCriteriaMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/criteria/d1").expect(200);
    });
  });

  describe("GET /criteria/defaults", () => {
    it("returns default criteria", async () => {
      getDefaultCriteriaMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/criteria/defaults").expect(200);
    });
  });

  /* ── Scores ──────────────────────────────────── */

  describe("GET /scores/:proposalId", () => {
    it("lists scores", async () => {
      listTenderScoresMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/scores/p1").expect(200);
    });
  });

  /* ── Evaluation ──────────────────────────────── */

  describe("GET /evaluation/:demandId", () => {
    it("returns evaluation", async () => {
      getTenderEvaluationMock.mockResolvedValue(ok({ score: 85 }));
      await request(createApp()).get("/evaluation/d1").expect(200);
    });
  });
});
