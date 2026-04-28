/**
 * Demand Analysis Routes — Unit Tests
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const engineMock = {
  generateDemandFields: vi.fn(),
  rawEnhanceObjective: vi.fn(),
  rawClassifyRequest: vi.fn(),
  rawComprehensiveAnalysis: vi.fn(),
  batchAnalyze: vi.fn(),
  getStatistics: vi.fn(),
  clearCache: vi.fn(),
};

const brainMock = {
  getLatestDecisionArtifactVersion: vi.fn(),
  getHighestLayerForSpine: vi.fn(),
  getFullDecisionWithLayers: vi.fn(),
};

vi.mock("../../application/buildDeps", () => ({
  buildDemandDeps: () => ({ brain: brainMock }),
}));

vi.mock("../../application", () => ({
  LegacyDemandAnalysisEngine: vi.fn().mockImplementation(() => engineMock),
}));

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  }),
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: (reason?: unknown) => void) =>
    Promise.resolve().then(() => fn(req, res, next)).catch(next),
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { createDemandAnalysisRoutes } = await import("../demand-analysis.routes");

function createApp(userId = "u1") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId } as unknown as typeof req.session;
    next();
  });
  app.use(createDemandAnalysisRoutes({} as never));
  return app;
}

beforeEach(() => vi.clearAllMocks());

const robustDemandDraft = {
  organizationName: "RTA DTO",
  department: "Digital Transformation",
  industryType: "government",
  enhancedBusinessObjective: "RTA DTO should establish an AI-powered CRM platform to unify citizen interactions, automate service workflows, and improve case resolution performance across customer touchpoints. The initiative should create a governed operating model for service agents, supervisors, and analytics teams so customer data remains sovereign while enabling faster response times. Delivery should include phased integration with existing channels, measurable service KPIs, and implementation controls for adoption and compliance.",
  suggestedProjectName: "AI-Powered CRM Modernization",
  currentChallenges: "Customer engagement data is fragmented across channels, resulting in incomplete service histories and slower case resolution. Manual routing and inconsistent workflows reduce agent productivity and make it difficult to enforce service standards. Leadership lacks reliable operational insights to prioritize improvements and manage customer experience outcomes.",
  expectedOutcomes: ["Unified customer view", "Reduced resolution time", "Improved service consistency"],
  successCriteria: ["20% faster response time", "90% SLA compliance"],
  timeframe: "9-12 months",
  budgetRange: "AED 3 million",
  stakeholders: ["Customer service leadership", "Digital transformation office"],
  riskFactors: ["Data migration complexity"],
  constraints: ["Sovereign hosting requirement"],
  integrationRequirements: ["ERP integration"],
  complianceRequirements: ["Government data retention controls"],
  existingSystems: ["Contact center platform"],
  assumptions: ["Business owners will support process redesign"],
};

describe("Demand Analysis Routes", () => {
  it("POST /generate-fields — returns generated fields when governance context is ready", async () => {
    engineMock.generateDemandFields.mockResolvedValue({ success: true, data: robustDemandDraft });
    brainMock.getFullDecisionWithLayers.mockResolvedValue({
      decision: { id: 'DEC-1', status: 'ready' },
      context: {
        missingFields: [],
        requiredInfo: [],
        completenessScore: 100,
      },
      status: 'ready',
      orchestration: {
        routing: {
          primaryEngineKind: 'EXTERNAL_HYBRID',
          primaryPluginId: 'engine-hybrid',
          primaryPluginName: 'External Hybrid Engine',
        },
        redactionMode: 'MASK',
      },
      auditEvents: [
        {
          payload: {
            layer: 2,
            eventData: {
              level: 'internal',
              riskLevel: 'medium',
              constraints: {
                allowExternalModels: true,
                allowCloudProcessing: true,
              },
            },
          },
        },
        {
          payload: {
            layer: 5,
            eventData: {
              primaryEngineKind: 'EXTERNAL_HYBRID',
              primaryPluginId: 'engine-hybrid',
              primaryPluginName: 'External Hybrid Engine',
              redactionMode: 'MASK',
            },
          },
        },
        {
          payload: {
            layer: 6,
            eventData: {
              usedHybridEngine: true,
              usedInternalEngine: true,
            },
          },
        },
      ],
    });
    brainMock.getHighestLayerForSpine.mockResolvedValue(6);

    const res = await request(createApp())
      .post("/generate-fields")
      .send({ businessObjective: "We want to modernize our legacy systems for better performance" });

    expect(res.status).toBe(200);
    expect(res.body.data.suggestedProjectName).toBe(robustDemandDraft.suggestedProjectName);
    expect(res.body.engineTelemetry.primaryEngineKind).toBe('EXTERNAL_HYBRID');
    expect(res.body.engineTelemetry.reasoningCompleted).toBe(true);
  });

  it("POST /generate-fields — returns the draft while Layer 4 clarification remains required", async () => {
    engineMock.generateDemandFields.mockResolvedValue({ success: true, data: robustDemandDraft });
    brainMock.getLatestDecisionArtifactVersion.mockResolvedValue({
      status: 'DRAFT',
      version: 1,
      content: robustDemandDraft,
    });
    brainMock.getFullDecisionWithLayers.mockResolvedValue({
      decision: { id: 'DEC-1', status: 'needs_info' },
      context: {
        missingFields: ['budgetRange'],
        requiredInfo: [{ field: 'budgetRange', description: 'Confirm the budget envelope.' }],
        completenessScore: 72,
      },
      status: 'needs_info',
      auditEvents: [
        {
          payload: {
            layer: 2,
            eventData: {
              level: 'internal',
              riskLevel: 'medium',
              constraints: {
                allowExternalModels: true,
                allowCloudProcessing: true,
              },
            },
          },
        },
      ],
    });
    brainMock.getHighestLayerForSpine.mockResolvedValue(4);

    const res = await request(createApp())
      .post("/generate-fields")
      .send({ businessObjective: "We want to modernize our legacy systems for better performance" });

    expect(res.status).toBe(200);
    expect(res.body.requiresClarification).toBe(true);
    expect(res.body.generationBlocked).toBe(false);
    expect(res.body.data.suggestedProjectName).toBe(robustDemandDraft.suggestedProjectName);
    expect(res.body.decisionFeedback.missingFields).toEqual(['budgetRange']);
  });

  it("POST /generate-fields — returns live generated field suggestions even when no artifact is persisted yet", async () => {
    engineMock.generateDemandFields.mockResolvedValue({ success: true, data: robustDemandDraft });
    brainMock.getLatestDecisionArtifactVersion.mockResolvedValue(undefined);
    brainMock.getFullDecisionWithLayers.mockResolvedValue({
      decision: { id: 'DEC-4', status: 'needs_info' },
      context: {
        missingFields: ['timeframe'],
        requiredInfo: [{ field: 'timeframe', description: 'Confirm the target delivery horizon.' }],
        completenessScore: 68,
      },
      status: 'needs_info',
      auditEvents: [],
    });
    brainMock.getHighestLayerForSpine.mockResolvedValue(4);

    const res = await request(createApp())
      .post('/generate-fields')
      .send({ businessObjective: 'Modernize customer service operations with AI-assisted case handling' });

    expect(res.status).toBe(200);
    expect(res.body.requiresClarification).toBe(true);
    expect(res.body.generationBlocked).toBe(false);
    expect(res.body.data.suggestedProjectName).toBe(robustDemandDraft.suggestedProjectName);
    expect(res.body.decisionFeedback.missingFields).toEqual(['timeframe']);
  });

  it("POST /generate-fields — rejects fallback-marked brain drafts", async () => {
    engineMock.generateDemandFields.mockResolvedValue({
      success: true,
      provider: 'brain',
      data: {
        ...robustDemandDraft,
        meta: { fallback: true },
      },
    });

    const res = await request(createApp())
      .post('/generate-fields')
      .send({ businessObjective: 'Create a unified citizen services intake portal for municipal permits and complaints' });

    expect(res.status).toBe(409);
    expect(res.body.provider).toBe('none');
    expect(res.body.failureKind).toBe('degraded_ai_output');
    expect(res.body.fallbackReason).toContain('fallback draft content');
  });

  it("POST /generate-fields — validation error for short objective", async () => {
    await request(createApp())
      .post("/generate-fields")
      .send({ businessObjective: "hi" })
      .expect(400);
  });

  it("POST /generate-fields — policy block returns structured fallback details", async () => {
    engineMock.generateDemandFields.mockResolvedValue({
      success: false,
      error: "Sovereign data cannot be processed by external models",
      failureKind: "policy_blocked",
      failureDetails: {
        stoppedAtLayer: 3,
        classificationLevel: "sovereign",
        riskLevel: "critical",
      },
    });

    const res = await request(createApp())
      .post("/generate-fields")
      .send({ businessObjective: "Process sovereign citizen case files with external AI" });

    expect(res.status).toBe(409);
    expect(res.body.failureKind).toBe("policy_blocked");
    expect(res.body.fallbackReason).toContain("Sovereign data cannot be processed by external models");
    expect(res.body.message).toContain("local-only processing");
  });

  it("POST /generate-fields — soft timeout returns pending brain status instead of 409", async () => {
    engineMock.generateDemandFields.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, data: robustDemandDraft }), 5100)),
    );
    brainMock.getLatestDecisionArtifactVersion.mockResolvedValue(undefined);
    brainMock.getHighestLayerForSpine.mockResolvedValue(6);
    brainMock.getFullDecisionWithLayers.mockResolvedValue({ status: 'reasoning' });

    const previousTimeout = process.env.COREVIA_DEMAND_ANALYSIS_SOFT_TIMEOUT_MS;
    process.env.COREVIA_DEMAND_ANALYSIS_SOFT_TIMEOUT_MS = '5000';

    try {
      const res = await request(createApp())
        .post('/generate-fields')
        .send({ businessObjective: 'Develop a sovereign AI-powered CRM for government service delivery' });

      expect(res.status).toBe(202);
      expect(res.body.pending).toBe(true);
      expect(res.body.provider).toBe('brain');
      expect(res.body.decisionSpineId).toMatch(/^DSP-DEMAND-/);
    } finally {
      process.env.COREVIA_DEMAND_ANALYSIS_SOFT_TIMEOUT_MS = previousTimeout;
    }
  }, 10000);

  it("GET /generate-fields/status — returns completed artifact when available", async () => {
    brainMock.getLatestDecisionArtifactVersion.mockResolvedValue({
      status: 'DRAFT',
      version: 1,
      content: robustDemandDraft,
    });
    brainMock.getFullDecisionWithLayers.mockResolvedValue({
      decision: { id: 'DEC-2', status: 'ready' },
      context: {
        missingFields: [],
        requiredInfo: [],
        completenessScore: 100,
      },
      status: 'ready',
    });
    brainMock.getHighestLayerForSpine.mockResolvedValue(6);

    const res = await request(createApp())
      .get('/generate-fields/status')
      .query({ decisionSpineId: 'DSP-DEMAND-TEST', businessObjective: 'Modernize CRM delivery' });

    expect(res.status).toBe(200);
    expect(res.body.pending).toBe(false);
    expect(res.body.data.suggestedProjectName).toBe(robustDemandDraft.suggestedProjectName);
  });

  it("GET /generate-fields/status — unwraps nested demand artifact content payloads", async () => {
    brainMock.getLatestDecisionArtifactVersion.mockResolvedValue({
      status: 'DRAFT',
      version: 2,
      content: {
        content: robustDemandDraft,
        telemetry: { usedHybridEngine: true },
      },
    });
    brainMock.getFullDecisionWithLayers.mockResolvedValue({
      decision: { id: 'DEC-2', status: 'ready' },
      context: {
        missingFields: [],
        requiredInfo: [],
        completenessScore: 100,
      },
      status: 'ready',
    });
    brainMock.getHighestLayerForSpine.mockResolvedValue(8);

    const res = await request(createApp())
      .get('/generate-fields/status')
      .query({ decisionSpineId: 'DSP-DEMAND-TEST', businessObjective: 'Modernize CRM delivery' });

    expect(res.status).toBe(200);
    expect(res.body.pending).toBe(false);
    expect(res.body.data.suggestedProjectName).toBe(robustDemandDraft.suggestedProjectName);
    expect(res.body.data.currentChallenges).toBe(robustDemandDraft.currentChallenges);
  });

  it("GET /generate-fields/status — returns artifact plus review requirement when Layer 4 is not satisfied", async () => {
    brainMock.getLatestDecisionArtifactVersion.mockResolvedValue({
      status: 'DRAFT',
      version: 1,
      content: robustDemandDraft,
    });
    brainMock.getFullDecisionWithLayers.mockResolvedValue({
      decision: { id: 'DEC-2', status: 'needs_info' },
      context: {
        missingFields: ['timeframe'],
        requiredInfo: [{ field: 'timeframe', description: 'Confirm the target delivery horizon.' }],
        completenessScore: 80,
      },
      status: 'needs_info',
    });
    brainMock.getHighestLayerForSpine.mockResolvedValue(4);

    const res = await request(createApp())
      .get('/generate-fields/status')
      .query({ decisionSpineId: 'DSP-DEMAND-TEST', businessObjective: 'Modernize CRM delivery' });

    expect(res.status).toBe(200);
    expect(res.body.requiresClarification).toBe(true);
    expect(res.body.generationBlocked).toBe(false);
    expect(res.body.data.suggestedProjectName).toBe(robustDemandDraft.suggestedProjectName);
    expect(res.body.decisionFeedback.missingFields).toEqual(['timeframe']);
  });

  it("GET /generate-fields/status — ignores fallback-marked artifacts", async () => {
    brainMock.getLatestDecisionArtifactVersion.mockResolvedValue({
      status: 'DRAFT',
      version: 1,
      content: {
        ...robustDemandDraft,
        meta: { fallback: true },
      },
    });
    brainMock.getFullDecisionWithLayers.mockResolvedValue({
      decision: { id: 'DEC-2', status: 'needs_info' },
      context: {
        missingFields: ['timeframe'],
        requiredInfo: [{ field: 'timeframe', description: 'Confirm the target delivery horizon.' }],
        completenessScore: 80,
      },
      status: 'needs_info',
    });
    brainMock.getHighestLayerForSpine.mockResolvedValue(4);

    const res = await request(createApp())
      .get('/generate-fields/status')
      .query({ decisionSpineId: 'DSP-DEMAND-TEST', businessObjective: 'Modernize CRM delivery' });

    expect(res.status).toBe(200);
    expect(res.body.requiresClarification).toBe(true);
    expect(res.body.data).toBeUndefined();
    expect(res.body.decisionFeedback.missingFields).toEqual(['timeframe']);
  });

  it("GET /generate-fields/status — returns deferred advisory drafts when no persisted artifact exists", async () => {
    brainMock.getLatestDecisionArtifactVersion.mockResolvedValue(undefined);
    brainMock.getFullDecisionWithLayers.mockResolvedValue({
      decision: { id: 'DEC-2', status: 'needs_info' },
      advisory: {
        generatedArtifacts: {
          DEMAND_FIELDS: robustDemandDraft,
        },
      },
      context: {
        missingFields: ['timeframe'],
        requiredInfo: [{ field: 'timeframe', description: 'Confirm the target delivery horizon.' }],
        completenessScore: 80,
      },
      status: 'needs_info',
    });
    brainMock.getHighestLayerForSpine.mockResolvedValue(6);

    const res = await request(createApp())
      .get('/generate-fields/status')
      .query({ decisionSpineId: 'DSP-DEMAND-TEST', businessObjective: 'Modernize CRM delivery' });

    expect(res.status).toBe(200);
    expect(res.body.pending).toBe(false);
    expect(res.body.requiresClarification).toBe(true);
    expect(res.body.data.suggestedProjectName).toBe(robustDemandDraft.suggestedProjectName);
    expect(res.body.artifactStatus).toBe('DEFERRED');
  });

  it("GET /generate-fields/status — resolves terminal soft-timeout runs without polling forever", async () => {
    brainMock.getLatestDecisionArtifactVersion.mockResolvedValue(undefined);
    brainMock.getFullDecisionWithLayers.mockResolvedValue({
      decision: { id: 'DEC-3', status: 'completed', finalStatus: 'completed' },
      status: 'completed',
      finalStatus: 'completed',
      context: {
        missingFields: [],
        requiredInfo: [],
        completenessScore: 100,
      },
    });
    brainMock.getHighestLayerForSpine.mockResolvedValue(6);

    const res = await request(createApp())
      .get('/generate-fields/status')
      .query({ decisionSpineId: 'DSP-DEMAND-TEST', businessObjective: 'Modernize CRM delivery' });

    expect(res.status).toBe(200);
    expect(res.body.pending).toBe(false);
    expect(res.body.data).toEqual({});
    expect(res.body.finalStatus).toBe('completed');
  });

  it("POST /generate-fields — cache key includes request context", async () => {
    engineMock.generateDemandFields.mockResolvedValue({ success: true, data: robustDemandDraft });

    const objective = "Develop a sovereign AI-powered CRM for government service delivery";
    const first = await request(createApp())
      .post("/generate-fields")
      .send({ businessObjective: objective, organizationName: "RTA DTO", additionalContext: { budgetRange: '100k-500k' } });
    const second = await request(createApp())
      .post("/generate-fields")
      .send({ businessObjective: objective, organizationName: "RTA DTO", additionalContext: { budgetRange: '1m-5m' } });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(false);
    expect(engineMock.generateDemandFields).toHaveBeenCalledTimes(2);
  });

  it("POST /generate-fields — forwards explicit dataClassification when accessLevel is absent", async () => {
    engineMock.generateDemandFields.mockResolvedValue({ success: true, data: robustDemandDraft });
    brainMock.getFullDecisionWithLayers.mockResolvedValue({
      decision: { id: 'DEC-3', status: 'ready' },
      context: { missingFields: [], requiredInfo: [], completenessScore: 100 },
    });
    brainMock.getHighestLayerForSpine.mockResolvedValue(6);

    const res = await request(createApp())
      .post('/generate-fields')
      .send({
        businessObjective: 'Generate an internal operations dashboard for shared services teams',
        dataClassification: 'internal',
      });

    expect(res.status).toBe(200);
    expect(engineMock.generateDemandFields).toHaveBeenCalledWith(
      'Generate an internal operations dashboard for shared services teams',
      'u1',
      'internal',
      expect.any(String),
      undefined,
      {},
    );
  });

  it("POST /generate-fields — degraded AI draft is not cached and returns an error without template fallback", async () => {
    engineMock.generateDemandFields.mockResolvedValue({
      success: true,
      provider: "brain",
      data: {
        enhancedBusinessObjective: "Develop crm system with ai power",
        suggestedProjectName: "Untitled",
        currentChallenges: "Current operational challenges related to: Develop crm system with ai power",
        expectedOutcomes: [],
        successCriteria: [],
        stakeholders: [],
        riskFactors: [],
        constraints: [],
        integrationRequirements: [],
        complianceRequirements: [],
        existingSystems: [],
        assumptions: [],
      },
    });

    const objective = "Develop crm system with ai power";
    const first = await request(createApp())
      .post("/generate-fields")
      .send({ businessObjective: objective, generationMode: "ai_only" });
    const second = await request(createApp())
      .post("/generate-fields")
      .send({ businessObjective: objective, generationMode: "ai_only" });

    expect(first.status).toBe(409);
    expect(first.body.provider).toBe("none");
    expect(first.body.failureKind).toBe("degraded_ai_output");
    expect(second.status).toBe(409);
    expect(engineMock.generateDemandFields).toHaveBeenCalledTimes(2);
  });

  it("POST /enhance-objective — success", async () => {
    engineMock.rawEnhanceObjective.mockResolvedValue({ success: true, data: { enhanced: "better" } });
    await request(createApp())
      .post("/enhance-objective")
      .send({ objective: "We want to implement a new customer relationship management system" })
      .expect(200);
  });

  it("POST /classify — success", async () => {
    engineMock.rawClassifyRequest.mockResolvedValue({ success: true, data: { type: "project" } });
    await request(createApp())
      .post("/classify")
      .send({ businessObjective: "classify this demand" })
      .expect(200);
  });

  it("POST /comprehensive — success", async () => {
    engineMock.rawComprehensiveAnalysis.mockResolvedValue({ success: true, data: {} });
    await request(createApp())
      .post("/comprehensive")
      .send({ businessObjective: "comprehensive analysis of our digital transformation initiative" })
      .expect(200);
  });

  it("GET /statistics — returns stats", async () => {
    engineMock.getStatistics.mockReturnValue({ totalRequests: 10 });
    await request(createApp()).get("/statistics").expect(200);
  });

  it("DELETE /cache — clears cache", async () => {
    engineMock.clearCache.mockReturnValue(undefined);
    await request(createApp()).delete("/cache").expect(200);
  });

  it("GET /health — returns health", async () => {
    await request(createApp()).get("/health").expect(200);
  });
});
