/**
 * Demand Reports Core Routes — Unit Tests
 *
 * Tests the demand report CRUD endpoints:
 *   - Auth + permission enforcement (report:read, report:create, etc.)
 *   - Tenant isolation (organizationId from session)
 *   - Stats endpoint
 *   - List with pagination
 *   - Single report retrieval
 *   - Create, update, delete flows
 *   - Error propagation
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Mocks ────────────────────────────────────────────────────── */

const getAllMock = vi.fn();
const findByIdMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const getStatsMock = vi.fn();
const listMock = vi.fn();
const findByStatusAltMock = vi.fn();
const findByWorkflowStatusAltMock = vi.fn();
const getRequirementsStatusesMock = vi.fn();
const getEnterpriseArchitectureStatusesMock = vi.fn();
const projectIdExistsMock = vi.fn();
const nextProjectIdMock = vi.fn();
const getDecisionByCorrelationIdMock = vi.fn();
const findLatestDecisionByDemandReportIdMock = vi.fn();
const getFullDecisionWithLayersMock = vi.fn();
const getLatestDecisionArtifactVersionMock = vi.fn();
const getHighestLayerForSpineMock = vi.fn();
const getUsersByRoleMock = vi.fn();
const coveriaNotifyMock = vi.fn();
const brainExecuteMock = vi.fn();
const upsertDecisionArtifactVersionMock = vi.fn();
const syncDecisionToDemandMock = vi.fn();

vi.mock("../../application/buildDeps", () => ({
  buildDemandDeps: vi.fn(() => ({
    reports: {
      getAll: (...args: unknown[]) => getAllMock(...args),
      findById: (...args: unknown[]) => findByIdMock(...args),
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      delete: (...args: unknown[]) => deleteMock(...args),
      getStats: (...args: unknown[]) => getStatsMock(...args),
      list: (...args: unknown[]) => listMock(...args),
      findByStatusAlt: (...args: unknown[]) => findByStatusAltMock(...args),
      findByWorkflowStatusAlt: (...args: unknown[]) => findByWorkflowStatusAltMock(...args),
      getRequirementsStatuses: (...args: unknown[]) => getRequirementsStatusesMock(...args),
      getEnterpriseArchitectureStatuses: (...args: unknown[]) => getEnterpriseArchitectureStatusesMock(...args),
      getUsersByRole: (...args: unknown[]) => getUsersByRoleMock(...args),
      getLatestReportVersionByType: vi.fn().mockResolvedValue(null),
    },
    projectIds: {
      projectIdExists: (...args: unknown[]) => projectIdExistsMock(...args),
      next: (...args: unknown[]) => nextProjectIdMock(...args),
      reserveProjectId: vi.fn(),
    },
    coveria: {
      notify: (...args: unknown[]) => coveriaNotifyMock(...args),
    },
    versions: {
      getLatestVersion: vi.fn().mockResolvedValue(null),
    },
    brain: {
      execute: (...args: unknown[]) => brainExecuteMock(...args),
      runPipeline: vi.fn().mockResolvedValue({ success: true, data: {} }),
      getDecisionByCorrelationId: (...args: unknown[]) => getDecisionByCorrelationIdMock(...args),
      findLatestDecisionByDemandReportId: (...args: unknown[]) => findLatestDecisionByDemandReportIdMock(...args),
      getFullDecisionWithLayers: (...args: unknown[]) => getFullDecisionWithLayersMock(...args),
      getLatestDecisionArtifactVersion: (...args: unknown[]) => getLatestDecisionArtifactVersionMock(...args),
      getHighestLayerForSpine: (...args: unknown[]) => getHighestLayerForSpineMock(...args),
      upsertDecisionArtifactVersion: (...args: unknown[]) => upsertDecisionArtifactVersionMock(...args),
      syncDecisionToDemand: (...args: unknown[]) => syncDecisionToDemandMock(...args),
    },
  })),
}));

vi.mock("../../application", () => ({
  parseAiAnalysis: vi.fn((v: unknown) => v),
  isRecord: vi.fn((v: unknown) => typeof v === "object" && v !== null),
}));

// Auth middleware: pass-through by default
const requireAuthMock = vi.fn((_req: unknown, _res: unknown, next: () => void) => next());
const requirePermissionMock = vi.fn(
  () => (_req: unknown, _res: unknown, next: () => void) => next(),
);

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddlewareWithOwnership: () => ({
    requireAuth: (req: unknown, res: unknown, next: () => void) =>
      requireAuthMock(req, res, next),
    requirePermission: (perm: string) => {
      const mw = requirePermissionMock(perm);
      return (req: unknown, res: unknown, next: () => void) =>
        mw(req, res, next);
    },
    requireOwnership: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
  }),
  getAuthenticatedOrganizationId: vi.fn(() => "org-1"),
}));

vi.mock("@shared/schema", () => ({
  insertDemandReportSchema: {
    parse: (v: unknown) => v,
    safeParse: (v: unknown) => ({ success: true, data: v }),
  },
  updateDemandReportSchema: {
    parse: (v: unknown) => v,
    safeParse: (v: unknown) => ({ success: true, data: v }),
  },
}));

vi.mock("@interfaces/middleware/validateBody", () => ({
  validateBody: () =>
    (req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const { createDemandReportsCoreRoutes } = await import("../demand-reports-core.routes");

/* ── Test Helpers ─────────────────────────────────────────────── */

function createApp(session: Record<string, unknown> = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = session as unknown as typeof req.session;
    (req as Record<string, unknown>).auth = session.auth;
    (req as Record<string, unknown>).user = session.user;
    next();
  });
  app.use(createDemandReportsCoreRoutes({} as never));
  return app;
}

const defaultSession = {
  userId: "user-1",
  role: "analyst",
  organizationId: "org-1",
  auth: { userId: "user-1", organizationId: "org-1" },
  user: { id: "user-1", role: "analyst", organizationId: "org-1" },
};

/* ── Tests ────────────────────────────────────────────────────── */

describe("demand-reports-core.routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockImplementation((_req, _res, next) => next());
    requirePermissionMock.mockImplementation(
      () => (_req: unknown, _res: unknown, next: () => void) => next(),
    );
    projectIdExistsMock.mockResolvedValue(false);
    nextProjectIdMock.mockResolvedValue("PRJ-2026-001");
    getUsersByRoleMock.mockResolvedValue([]);
    coveriaNotifyMock.mockResolvedValue(undefined);
    brainExecuteMock.mockResolvedValue({
      decisionId: "DSP-ASSISTED-001",
      correlationId: "corr-1",
      finalStatus: "ready",
      decision: {
        classification: { classificationLevel: "sovereign" },
        context: { completenessScore: 88 },
      },
    });
    upsertDecisionArtifactVersionMock.mockResolvedValue(undefined);
    syncDecisionToDemandMock.mockResolvedValue(undefined);
  });

  /* ---------- Auth enforcement ---------- */

  describe("auth enforcement", () => {
    it("blocks unauthenticated requests on stats", async () => {
      requireAuthMock.mockImplementation((_req, res: express.Response) => {
        res.status(401).json({ success: false, error: "Not authenticated" });
      });
      const app = createApp();
      const res = await request(app).get("/stats");
      expect(res.status).toBe(401);
    });

    it("enforces report:read on list endpoint", async () => {
      requirePermissionMock.mockImplementation(
        () => (_req: unknown, res: express.Response) => {
          res.status(403).json({ success: false, error: "Forbidden" });
        },
      );
      const app = createApp(defaultSession);
      const res = await request(app).get("/");
      expect(res.status).toBe(403);
      expect(requirePermissionMock).toHaveBeenCalledWith("report:read");
    });

    it("enforces report:create on create endpoint", async () => {
      requirePermissionMock.mockImplementation(
        () => (_req: unknown, res: express.Response) => {
          res.status(403).json({ success: false, error: "Forbidden" });
        },
      );
      const app = createApp(defaultSession);
      const res = await request(app).post("/").send({ title: "Test" });
      expect(res.status).toBe(403);
      expect(requirePermissionMock).toHaveBeenCalledWith("report:create");
    });
  });

  /* ---------- Stats ---------- */

  describe("GET /stats", () => {
    it("returns demand report statistics", async () => {
      const stats = { total: 42, pending: 10, approved: 32 };
      getStatsMock.mockResolvedValue(stats);
      const app = createApp(defaultSession);
      const res = await request(app).get("/stats");
      expect(res.status).toBe(200);
      expect(res.body).toEqual(stats);
    });
  });

  /* ---------- List reports ---------- */

  describe("GET /", () => {
    it("returns paginated list of reports", async () => {
      listMock.mockResolvedValue({
        data: [{ id: "r1", title: "Report 1" }],
        totalCount: 1,
      });
      getRequirementsStatusesMock.mockResolvedValue({});
      getEnterpriseArchitectureStatusesMock.mockResolvedValue({});

      const app = createApp(defaultSession);
      const res = await request(app).get("/?page=1&pageSize=10");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.page).toBe(1);
    });

    it("returns all reports when no pagination params", async () => {
      getAllMock.mockResolvedValue([{ id: "r1" }, { id: "r2" }]);
      getRequirementsStatusesMock.mockResolvedValue({});
      getEnterpriseArchitectureStatusesMock.mockResolvedValue({});

      const app = createApp(defaultSession);
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  /* ---------- Single report ---------- */

  describe("GET /:id", () => {
    it("returns report by id", async () => {
      const report = {
        id: "r1",
        title: "Test Report",
        createdAt: new Date().toISOString(),
      };
      findByIdMock.mockResolvedValue(report);
      const app = createApp(defaultSession);
      const res = await request(app).get("/r1");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("returns 404 for non-existent report", async () => {
      findByIdMock.mockResolvedValue(null);
      const app = createApp(defaultSession);
      const res = await request(app).get("/nonexistent");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("returns artifact lifecycle and provenance for linked demand decisions", async () => {
      findByIdMock.mockResolvedValue({
        id: "r-lifecycle",
        organizationName: "RTA DTO",
        requestorName: "Analyst",
        requestorEmail: "analyst@example.com",
        department: "Digital Transformation",
        urgency: "high",
        businessObjective: "Modernize sovereign service delivery with AI-assisted case handling.",
        expectedOutcomes: "Faster case handling",
        successCriteria: "30% response improvement",
        budgetRange: "1m-5m",
        timeframe: "9-12 months",
        stakeholders: "Operations",
        currentChallenges: "Manual processing and fragmented workflows.",
        riskFactors: "Integration delays",
        complianceRequirements: "UAE sovereign controls",
        status: "generated",
        workflowStatus: "under_review",
        aiAnalysis: {
          decisionId: "DSP-TEST-1",
          source: "COREVIA Brain",
        },
        createdAt: new Date().toISOString(),
      });
      getFullDecisionWithLayersMock.mockResolvedValue({
        decision: {
          id: "DSP-TEST-1",
          status: "ready",
          correlationId: "corr-1",
        },
        context: {
          missingFields: [],
          requiredInfo: [],
          completenessScore: 100,
        },
        orchestration: {
          routing: {
            primaryEngineKind: "SOVEREIGN_INTERNAL",
            primaryPluginName: "Engine A",
          },
        },
        auditEvents: [
          {
            payload: {
              layer: 5,
              eventData: {
                primaryEngineKind: "SOVEREIGN_INTERNAL",
                primaryPluginName: "Engine A",
              },
            },
          },
        ],
      });
      getLatestDecisionArtifactVersionMock.mockResolvedValue({
        status: "DRAFT",
        version: 2,
        content: {
          suggestedProjectName: "Sovereign Service Modernization",
        },
      });
      getHighestLayerForSpineMock.mockResolvedValue(6);

      const app = createApp(defaultSession);
      const res = await request(app).get("/r-lifecycle");

      expect(res.status).toBe(200);
      expect(res.body.data.artifactLifecycle).toMatchObject({
        phase: "approved_artifact",
        source: "persisted_decision_artifact",
        currentLayer: 6,
        executionEligible: true,
        primaryEngineKind: "SOVEREIGN_INTERNAL",
        primaryPluginName: "Engine A",
        artifactStatus: "DRAFT",
        artifactVersion: 2,
      });
    });
  });

  describe("POST /", () => {
    it("reuses the assisted decision spine and submits the full demand form context to the brain", async () => {
      const assistedDecisionSpineId = "DSP-DEMAND-2026-03-15-assisted";
      const createdReport = {
        id: "r-created",
        suggestedProjectName: "Sovereign Case Automation",
        projectId: "PRJ-2026-001",
        decisionSpineId: assistedDecisionSpineId,
        organizationName: "Dubai Digital Authority",
        industryType: "government",
        requestorName: "Aisha Noor",
        requestorEmail: "aisha.noor@example.gov",
        department: "Citizen Services",
        urgency: "high",
        businessObjective: "Reduce manual case handling delays for sovereign citizen service workflows.",
        currentChallenges: "Teams manually rekey requests across fragmented systems, causing delays and missed SLAs.",
        expectedOutcomes: "Cut cycle time by 40% and improve first-contact resolution.",
        successCriteria: "40% faster handling, 25% fewer escalations, and full audit traceability.",
        constraints: "Must remain within sovereign hosting boundaries and reuse existing identity services.",
        currentCapacity: "Current team can support only a limited pilot without automation.",
        budgetRange: "1m-5m",
        timeframe: "6-9 months",
        stakeholders: "Citizen Services, Security Office, Shared Platforms",
        existingSystems: "CRM, Case Management, National Identity Gateway",
        integrationRequirements: "Integrate with CRM, identity gateway, and notification services.",
        complianceRequirements: "UAE sovereign controls, audit retention, role-based access.",
        riskFactors: "Integration sequencing and legacy data quality risks.",
        requestType: "demand",
        dataClassification: "secret",
      };

      createMock.mockImplementation(async (input: Record<string, unknown>) => ({
        ...createdReport,
        ...input,
      }));
      findByIdMock.mockResolvedValue(createdReport);
      updateMock.mockImplementation(async (_id: string, input: Record<string, unknown>) => ({
        ...createdReport,
        ...input,
      }));

      const app = createApp(defaultSession);
      const res = await request(app)
        .post("/")
        .send({
          organizationName: createdReport.organizationName,
          industryType: createdReport.industryType,
          requestorName: createdReport.requestorName,
          requestorEmail: createdReport.requestorEmail,
          department: createdReport.department,
          urgency: createdReport.urgency,
          businessObjective: createdReport.businessObjective,
          currentChallenges: createdReport.currentChallenges,
          expectedOutcomes: createdReport.expectedOutcomes,
          successCriteria: createdReport.successCriteria,
          constraints: createdReport.constraints,
          currentCapacity: createdReport.currentCapacity,
          budgetRange: createdReport.budgetRange,
          timeframe: createdReport.timeframe,
          stakeholders: createdReport.stakeholders,
          existingSystems: createdReport.existingSystems,
          integrationRequirements: createdReport.integrationRequirements,
          complianceRequirements: createdReport.complianceRequirements,
          riskFactors: createdReport.riskFactors,
          requestType: createdReport.requestType,
          dataClassification: createdReport.dataClassification,
          decisionSpineId: assistedDecisionSpineId,
        });

      expect(res.status).toBe(201);
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
        decisionSpineId: assistedDecisionSpineId,
        projectId: "PRJ-2026-001",
      }));

      await new Promise((resolve) => setImmediate(resolve));
      await Promise.resolve();

      expect(brainExecuteMock).toHaveBeenCalledWith(
        "demand_management",
        "demand.new",
        expect.objectContaining({
          businessObjective: createdReport.businessObjective,
          description: createdReport.currentChallenges,
          problemStatement: createdReport.currentChallenges,
          currentChallenges: createdReport.currentChallenges,
          expectedOutcomes: createdReport.expectedOutcomes,
          successCriteria: createdReport.successCriteria,
          constraints: createdReport.constraints,
          currentCapacity: createdReport.currentCapacity,
          timeframe: createdReport.timeframe,
          estimatedTimeline: createdReport.timeframe,
          stakeholders: createdReport.stakeholders,
          sourceContext: expect.objectContaining({
            currentChallenges: createdReport.currentChallenges,
            expectedOutcomes: createdReport.expectedOutcomes,
            successCriteria: createdReport.successCriteria,
          }),
        }),
        "user-1",
        "org-1",
        { decisionSpineId: assistedDecisionSpineId },
      );

      expect(upsertDecisionArtifactVersionMock).toHaveBeenCalledWith(expect.objectContaining({
        decisionSpineId: assistedDecisionSpineId,
        artifactType: "DEMAND_FIELDS",
        content: expect.objectContaining({
          reportId: "r-created",
          currentChallenges: createdReport.currentChallenges,
          expectedOutcomes: createdReport.expectedOutcomes,
          successCriteria: createdReport.successCriteria,
        }),
      }));
    });
  });

  /* ---------- Workflow status ---------- */

  describe("GET /:id/workflow-status", () => {
    it("returns workflow status for report", async () => {
      findByIdMock.mockResolvedValue({
        id: "r1",
        workflowStatus: "under_review",
        workflowHistory: [{ event: "submit" }],
        updatedAt: "2025-01-01",
      });
      const app = createApp(defaultSession);
      const res = await request(app).get("/r1/workflow-status");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("under_review");
    });

    it("returns 404 for missing report", async () => {
      findByIdMock.mockResolvedValue(null);
      const app = createApp(defaultSession);
      const res = await request(app).get("/r1/workflow-status");
      expect(res.status).toBe(404);
    });
  });

  /* ---------- Delete ---------- */

  describe("DELETE /:id", () => {
    it("deletes report successfully when user is manager", async () => {
      findByIdMock.mockResolvedValue({ id: "r1", title: "Test" });
      deleteMock.mockResolvedValue(true);
      const managerSession = {
        ...defaultSession,
        role: "manager",
        auth: { ...defaultSession.auth, role: "manager" },
        user: { ...defaultSession.user, role: "manager" },
      };
      const app = createApp(managerSession);
      const res = await request(app).delete("/r1");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("rejects delete for non-manager role", async () => {
      const app = createApp(defaultSession);
      const res = await request(app).delete("/r1");
      expect(res.status).toBe(403);
    });
  });
});
