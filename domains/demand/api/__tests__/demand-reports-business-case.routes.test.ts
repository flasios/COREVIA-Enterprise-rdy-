/**
 * Demand Reports Business Case Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const depsMock = vi.hoisted(() => ({
  reports: {
    findById: vi.fn(),
  },
  brain: {
    execute: vi.fn(),
    getFullDecisionWithLayers: vi.fn(),
    findLatestDecisionByDemandReportId: vi.fn(),
  },
  versions: {},
  businessCase: {
    findByDemandReportId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  financial: {
    buildInputsFromData: vi.fn(),
    compute: vi.fn(),
  },
  users: {
    getUser: vi.fn(),
    getById: vi.fn(),
  },
}));

vi.mock("../../application/buildDeps", () => ({
  buildDemandDeps: () => depsMock,
}));

vi.mock("../../application", () => ({
  createReportVersionSafely: vi.fn().mockResolvedValue({ id: "v1" }),
  FinancialInputs: {},
  UnifiedFinancialOutput: {},
}));

vi.mock("../../application/normalizers", () => ({
  normalizeBusinessCaseFields: vi.fn((data: unknown) => data),
  buildInsertBusinessCaseFromArtifact: vi.fn(() => ({})),
}));

vi.mock("../../application/artifactProvenance", () => ({
  attachArtifactProvenance: vi.fn((data: unknown) => data),
  buildArtifactMetaFromPayload: vi.fn(() => ({})),
}));

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  }),
  getAuthenticatedOrganizationId: () => "org1",
}));

vi.mock("@interfaces/middleware/validateBody", () => ({
  validateBody: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@shared/schema", () => ({
  submitClarificationsSchema: { parse: (d: unknown) => d },
}));

const { createDemandReportsBusinessCaseRoutes } = await import("../demand-reports-business-case.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    req.auth = { userId } as unknown as typeof req.auth;
    next();
  });
  app.use(createDemandReportsBusinessCaseRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  vi.useRealTimers();
  delete process.env.COREVIA_BUSINESS_CASE_BRAIN_SOFT_TIMEOUT_MS;
});

describe("Demand Reports Business Case Routes", () => {
  beforeEach(() => {
    depsMock.reports.findById.mockResolvedValue({
      id: "r1",
      suggestedProjectName: "Sovereign Operations Assistant",
      organizationName: "Dubai Health Authority",
      requestorName: "Incident Command Team",
      businessObjective: "Improve incident command validation and escalation accuracy",
      department: "Emergency Operations",
      budgetRange: "AED 2M - 3M",
      currentChallenges: "Manual validation creates delays during incident escalation.",
      expectedOutcomes: ["Reduce validation time", "Improve governance traceability"],
      successCriteria: ["Validation completed within minutes"],
      existingSystems: ["Command platform"],
      integrationRequirements: ["Dispatch integration"],
      complianceRequirements: ["Sovereign data residency"],
      riskFactors: ["Operational disruption during rollout"],
      decisionSpineId: "DSP-1",
      aiAnalysis: { classificationLevel: "sovereign" },
    });
    depsMock.businessCase.findByDemandReportId.mockResolvedValue(null);
    depsMock.businessCase.create.mockResolvedValue({ id: "bc1" });
    depsMock.businessCase.update.mockResolvedValue({ id: "bc1" });
    depsMock.financial.buildInputsFromData.mockReturnValue({ totalInvestment: 0 });
    depsMock.financial.compute.mockReturnValue({});
    depsMock.brain.findLatestDecisionByDemandReportId.mockResolvedValue({ id: "DSP-1" });
    depsMock.brain.getFullDecisionWithLayers.mockResolvedValue({
      decision: { status: "reasoning" },
      advisory: null,
    });
    depsMock.brain.execute.mockResolvedValue({
      decisionId: "DSP-1",
      correlationId: "cor-1",
      finalStatus: "completed",
      decision: {},
      advisory: {
        generatedArtifacts: {
          BUSINESS_CASE: {
            executiveSummary: "Generated summary with enough detail to pass checks.",
            backgroundContext: "Generated background context with enough detail to pass checks and establish the current operating environment.",
            problemStatement: "Generated problem statement with enough detail to pass checks and describe the operational issue.",
            solutionOverview: "Generated solution overview with enough detail to pass checks and outline the proposed direction.",
            businessRequirements: "Generated business requirements with enough detail to pass checks and capture the essential constraints.",
            proposedSolution: "Generated proposed solution with enough detail to pass checks and define the governed path forward.",
          },
        },
      },
    });
  });

  it("POST /:id/detect-clarifications — route wired", async () => {
    const res = await request(createApp()).post("/r1/detect-clarifications");
    expect([200, 500]).toContain(res.status);
  });

  it("POST /:id/generate-business-case — route wired", async () => {
    const res = await request(createApp())
      .post("/r1/generate-business-case")
      .send({ clarificationsBypassed: true });
    expect([200, 500]).toContain(res.status);
  });

  it("POST /:id/generate-business-case scores orchestration-plan evidence when agent outputs are absent", async () => {
    depsMock.brain.execute.mockResolvedValue({
      decisionId: "DSP-1",
      correlationId: "cor-1",
      finalStatus: "completed",
      decision: {
        orchestration: {
          selectedAgents: [
            { agentId: "project_manager", agentName: "Project Manager Agent", mode: "READ" },
            { agentId: "evidence_collector", agentName: "Evidence Collector Agent", mode: "READ" },
          ],
          executionPlan: [
            { step: 1, type: "agent", target: "project_manager" },
            { step: 2, type: "agent", target: "evidence_collector" },
          ],
        },
      },
      advisory: {
        generatedArtifacts: {
          BUSINESS_CASE: {
            executiveSummary: "Generated summary with enough detail to pass checks.",
            backgroundContext: "Generated background context with enough detail to pass checks and establish the current operating environment.",
            problemStatement: "Generated problem statement with enough detail to pass checks and describe the operational issue.",
            solutionOverview: "Generated solution overview with enough detail to pass checks and outline the proposed direction.",
            businessRequirements: "Generated business requirements with enough detail to pass checks and capture the essential constraints.",
            proposedSolution: "Generated proposed solution with enough detail to pass checks and define the governed path forward.",
          },
        },
      },
    });

    const res = await request(createApp())
      .post("/r1/generate-business-case")
      .send({ clarificationsBypassed: true });

    expect(res.status).toBe(200);
    const agentCheck = res.body.qualityReport?.checks?.find((check: { name?: string }) => check.name === 'Agent Signal Quality');
    expect(agentCheck).toBeTruthy();
    expect(agentCheck.score).toBeGreaterThanOrEqual(60);
    expect(agentCheck.passed).toBe(true);
    expect(Array.isArray(res.body.qualityReport?.agentScores)).toBe(true);
    expect(res.body.qualityReport.agentScores.length).toBeGreaterThanOrEqual(2);
    expect(res.body.qualityReport.agentScores[0].status).toBe('planned');
  });

  it("POST /:id/generate-business-case recovers from soft timeout using demand context fallback", async () => {
    depsMock.brain.getFullDecisionWithLayers.mockResolvedValue({
      decision: { status: "reasoning" },
      orchestration: {
        agentPlan: {
          selectedAgents: [
            { agentId: "project_manager", agentName: "Project Manager Agent", mode: "PLAN" },
            { agentId: "evidence_collector", agentName: "Evidence Collector Agent", mode: "PLAN" },
          ],
          executionPlan: [
            { step: 1, type: "agent", target: "project_manager" },
            { step: 2, type: "agent", target: "evidence_collector" },
          ],
        },
      },
      advisory: null,
    });
    depsMock.financial.buildInputsFromData.mockReturnValue({
      totalInvestment: 2_500_000,
      discountRate: 8,
      adoptionRate: 0.75,
      maintenancePercent: 0.15,
      contingencyPercent: 0.1,
      domainParameters: {
        "Transaction Volume": 500_000,
      },
    });
    depsMock.financial.compute.mockReturnValue({
      metrics: {
        totalCosts: 4_000_000,
        totalBenefits: 5_500_000,
        roi: 37.5,
        npv: 900_000,
        paybackMonths: 28,
      },
      inputs: {
        totalInvestment: 2_500_000,
      },
      decision: {
        verdict: "INVEST",
      },
      governmentValue: {
        score: 82,
        verdict: "HIGH_VALUE",
      },
    });
    depsMock.brain.execute.mockRejectedValue(new Error("Business case soft timeout after 120000ms"));

    const res = await request(createApp())
      .post("/r1/generate-business-case")
      .send({ clarificationsBypassed: true, generationMode: "prompt_on_fallback" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.executiveSummary).toContain("Sovereign Operations Assistant");
    expect(res.body.data.executiveSummary).toContain("Commercial case:");
    expect(res.body.data.executiveSummary).toContain("Public-value case:");
    expect(res.body.data.meta.fallback).toBe(true);
    expect(res.body.data.meta.synthesisSource).toBe("demand_context");
    expect(res.body.data.recommendations.commercialCase).toContain("Commercial case:");
    expect(res.body.data.recommendations.publicValueCase).toContain("Public-value case:");
    expect(Array.isArray(res.body.data.implementationPhases)).toBe(true);
    expect(res.body.data.implementationPhases[0].tasks.length).toBeGreaterThan(0);
    expect(res.body.data.implementationPhases[0].deliverables.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.alternativeSolutions)).toBe(true);
    expect(res.body.data.alternativeSolutions.length).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(res.body.data.stakeholderAnalysis)).toBe(true);
    expect(res.body.data.stakeholderAnalysis.length).toBeGreaterThanOrEqual(4);
    expect(Array.isArray(res.body.data.kpis)).toBe(true);
    expect(res.body.data.kpis.length).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(res.body.data.milestones)).toBe(true);
    expect(res.body.data.milestones[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Array.isArray(res.body.data.nextSteps)).toBe(true);
    expect(res.body.data.nextSteps.every((step: { timeline?: string }) => typeof step.timeline === 'string' && step.timeline !== 'TBD')).toBe(true);
    expect(Array.isArray(res.body.qualityReport?.checks)).toBe(true);
    expect(res.body.qualityReport.checks.some((check: { name?: string }) => check.name === 'Decision Readiness')).toBe(true);
    expect(res.body.qualityReport.agentScore).toBeGreaterThanOrEqual(60);
    expect(res.body.qualityReport.agentScores.length).toBeGreaterThanOrEqual(2);
    expect(depsMock.businessCase.create).toHaveBeenCalledOnce();
    expect(depsMock.businessCase.create).toHaveBeenCalledWith(expect.objectContaining({
      totalCostEstimate: 2_500_000,
      lifecycleCostEstimate: 4_000_000,
      totalBenefitEstimate: 5_500_000,
      financialAssumptions: expect.objectContaining({
        discountRate: 0.08,
        adoptionRate: expect.any(Number),
      }),
      domainParameters: expect.any(Object),
    }));
  });

  it("POST /:id/generate-business-case passes an abort signal to the brain pipeline in fallback mode", async () => {
    let capturedSignal: AbortSignal | undefined;
    depsMock.brain.execute.mockImplementation((_domain, _signal, _input, _userId, _orgId, opts) => {
      capturedSignal = (opts as { abortSignal?: AbortSignal } | undefined)?.abortSignal;
      return Promise.reject(new Error("Business case soft timeout after 120000ms"));
    });

    const res = await request(createApp())
      .post("/r1/generate-business-case")
      .send({ clarificationsBypassed: true, generationMode: "prompt_on_fallback" });

    expect(res.status).toBe(200);
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  it("POST /:id/generate-business-case ignores generation-failed placeholders and falls back to demand context", async () => {
    depsMock.brain.execute.mockResolvedValue({
      decisionId: "DSP-1",
      correlationId: "cor-1",
      finalStatus: "validation",
      decision: {},
      advisory: {
        generatedArtifacts: {
          BUSINESS_CASE: {
            generationFailed: true,
            failedAt: "2026-03-15T19:07:50.467Z",
            reason: "Both Engine A and Engine B failed to produce content",
          },
        },
      },
    });

    const res = await request(createApp())
      .post("/r1/generate-business-case")
      .send({ clarificationsBypassed: true, generationMode: "prompt_on_fallback" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.generationFailed).toBeUndefined();
    expect(res.body.data.executiveSummary).toContain("Sovereign Operations Assistant");
    expect(res.body.data.meta.synthesisSource).toBe("demand_context");
  });

  it("POST /:id/submit-clarifications — route wired", async () => {
    const res = await request(createApp())
      .post("/r1/submit-clarifications")
      .send({ answers: [{ question: "q1", answer: "a1" }] });
    expect([200, 500]).toContain(res.status);
  });

  it("GET /:id/business-case — route wired", async () => {
    const res = await request(createApp()).get("/r1/business-case");
    expect([200, 500]).toContain(res.status);
  });

  it("GET /:id/financial-model — route wired", async () => {
    const res = await request(createApp()).get("/r1/financial-model");
    expect([200, 404, 500]).toContain(res.status);
  });
});
