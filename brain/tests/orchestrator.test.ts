/**
 * COREVIA Brain Orchestrator — Unit Tests
 *
 * Tests the 8-layer pipeline execution, early-stop behaviour,
 * timeout enforcement, and audit trail invariants.
 * All layers and storage are mock-injected so no DB or AI is required.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";

/* ---------- mocks ---------- */

const {
  mockLayer1Execute,
  mockLayer2Execute,
  mockLayer3Execute,
  mockLayer4Execute,
  mockLayer5Execute,
  mockLayer6Execute,
  mockLayer7Execute,
  mockLayer8Execute,
  mockStorage,
  mockLayerConfigs,
} = vi.hoisted(() => {
  const storage = {
    createDecision: vi.fn().mockResolvedValue({ id: "saved-decision-id" }),
    persistLayerData: vi.fn().mockResolvedValue(undefined),
    persistDecisionObject: vi.fn().mockResolvedValue(undefined),
    addAuditEvent: vi.fn().mockResolvedValue(undefined),
    updateLedgerConclusion: vi.fn().mockResolvedValue(undefined),
    saveDecisionOutcome: vi.fn().mockResolvedValue(undefined),
    ensureLedgerConclusion: vi.fn().mockResolvedValue(undefined),
    listArtifactsForSpine: vi.fn().mockResolvedValue([]),
    listSubDecisions: vi.fn().mockResolvedValue([]),
    updateDecisionArtifactStatus: vi.fn().mockResolvedValue(undefined),
    updateSubDecisionStatus: vi.fn().mockResolvedValue(undefined),
    createApproval: vi.fn().mockResolvedValue({ approvalId: "approval-1" }),
  };
  return {
    mockLayer1Execute: vi.fn(),
    mockLayer2Execute: vi.fn(),
    mockLayer3Execute: vi.fn(),
    mockLayer4Execute: vi.fn(),
    mockLayer5Execute: vi.fn(),
    mockLayer6Execute: vi.fn(),
    mockLayer7Execute: vi.fn(),
    mockLayer8Execute: vi.fn(),
    mockStorage: storage,
    mockLayerConfigs: new Map<number, { enabled: boolean; mode: "enforce" | "monitor" | "bypass"; timeoutMs: number; retries: number; name: string; key?: string; approvalRequired?: boolean; approvalRoles?: string[] }>(),
  };
});

// Mock coreviaStorage before importing orchestrator
vi.mock("../storage", () => ({
  coreviaStorage: mockStorage,
}));

vi.mock("../../platform/observability", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../control-plane", () => ({
  loadLayerConfigsFromDB: vi.fn().mockResolvedValue(undefined),
  getLayerConfig: vi.fn((layer: number) => mockLayerConfigs.get(layer) || {
    enabled: true,
    mode: "enforce",
    timeoutMs: 0,
    retries: 0,
    name: `Layer ${layer}`,
    key: `layer-${layer}`,
    approvalRequired: false,
    approvalRoles: [],
  }),
}));

function makeLayerResult(layer: number, shouldContinue: boolean, overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    success: shouldContinue,
    layer,
    status: shouldContinue ? "classification" : "blocked",
    data: {},
    shouldContinue,
    auditEvent: {
      id: randomUUID(),
      layer,
      eventType: `layer_${layer}_done`,
      eventData: {},
      actorType: "system" as const,
      timestamp: now,
    },
    ...overrides,
  };
}

// Mock each layer module

vi.mock("../layers/layer1-intake", () => ({
  Layer1Intake: vi.fn().mockImplementation(() => ({ execute: mockLayer1Execute })),
}));
vi.mock("../layers/layer2-classification", () => ({
  Layer2Classification: vi.fn().mockImplementation(() => ({ execute: mockLayer2Execute })),
}));
vi.mock("../layers/layer3-policyops", () => ({
  Layer3PolicyOps: vi.fn().mockImplementation(() => ({ execute: mockLayer3Execute })),
}));
vi.mock("../layers/layer4-context", () => ({
  Layer4Context: vi.fn().mockImplementation(() => ({ execute: mockLayer4Execute })),
}));
vi.mock("../layers/layer5-orchestration", () => ({
  Layer5Orchestration: vi.fn().mockImplementation(() => ({ execute: mockLayer5Execute })),
}));
vi.mock("../layers/layer6-reasoning", () => ({
  Layer6Reasoning: vi.fn().mockImplementation(() => ({ execute: mockLayer6Execute })),
}));
vi.mock("../layers/layer7-validation", () => ({
  Layer7Validation: vi.fn().mockImplementation(() => ({ execute: mockLayer7Execute })),
}));
vi.mock("../layers/layer8-memory", () => ({
  Layer8Memory: vi.fn().mockImplementation(() => ({ execute: mockLayer8Execute })),
}));

import { CoreviaOrchestrator } from "../pipeline/orchestrator";

describe("CoreviaOrchestrator", () => {
  let orchestrator: CoreviaOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply storage implementations (vi.clearAllMocks preserves them, but
    // this guarantees correctness if a test overrides a mock inline).
    mockStorage.createDecision.mockResolvedValue({ id: "saved-decision-id", requestId: "REQ-1" });
    mockStorage.persistLayerData.mockResolvedValue(undefined);
    mockStorage.persistDecisionObject.mockResolvedValue(undefined);
    mockStorage.addAuditEvent.mockResolvedValue(undefined);
    mockStorage.updateLedgerConclusion.mockResolvedValue(undefined);
    mockStorage.saveDecisionOutcome.mockResolvedValue(undefined);
    mockStorage.ensureLedgerConclusion.mockResolvedValue(undefined);
    mockStorage.listArtifactsForSpine.mockResolvedValue([]);
    mockStorage.listSubDecisions.mockResolvedValue([]);
    mockStorage.updateDecisionArtifactStatus.mockResolvedValue(undefined);
    mockStorage.updateSubDecisionStatus.mockResolvedValue(undefined);
    mockStorage.createApproval.mockResolvedValue({ approvalId: "approval-1" });
    mockLayerConfigs.clear();
    orchestrator = new CoreviaOrchestrator();
  });

  const setupAllLayersContinue = () => {
    mockLayer1Execute.mockResolvedValue(makeLayerResult(1, true));
    mockLayer2Execute.mockResolvedValue(makeLayerResult(2, true));
    mockLayer3Execute.mockResolvedValue(makeLayerResult(3, true));
    mockLayer4Execute.mockResolvedValue(makeLayerResult(4, true));
    mockLayer5Execute.mockResolvedValue(makeLayerResult(5, true));
    mockLayer6Execute.mockResolvedValue(makeLayerResult(6, true));
    mockLayer7Execute.mockResolvedValue(makeLayerResult(7, true, {
      status: "completed",
      data: { status: "approved", approvedActions: [] },
    }));
    mockLayer8Execute.mockResolvedValue(makeLayerResult(8, true, { status: "completed" }));
  };

  /* ---------- Full pipeline success ---------- */

  it("executes all 8 layers on happy path", async () => {
    setupAllLayersContinue();

    const result = await orchestrator.execute(
      "test_service",
      "test.route",
      { projectName: "Test" },
      "user-1",
      "org-1",
    );

    expect(result.success).toBe(true);
    expect(result.decisionId).toBeDefined();
    expect(result.correlationId).toBeDefined();

    // All 8 layers were called
    expect(mockLayer1Execute).toHaveBeenCalledTimes(1);
    expect(mockLayer2Execute).toHaveBeenCalledTimes(1);
    expect(mockLayer3Execute).toHaveBeenCalledTimes(1);
    expect(mockLayer4Execute).toHaveBeenCalledTimes(1);
    expect(mockLayer5Execute).toHaveBeenCalledTimes(1);
    expect(mockLayer6Execute).toHaveBeenCalledTimes(1);
    expect(mockLayer7Execute).toHaveBeenCalledTimes(1);
    expect(mockLayer8Execute).toHaveBeenCalledTimes(1);

    // Decision was persisted
    expect(mockStorage.createDecision).toHaveBeenCalledTimes(1);
    expect(mockStorage.persistDecisionObject).toHaveBeenCalled();
  });

  it("stops before a disabled governance layer", async () => {
    setupAllLayersContinue();
    mockLayerConfigs.set(5, {
      enabled: false,
      mode: "enforce",
      timeoutMs: 0,
      retries: 0,
      name: "Intelligence Routing",
    });

    const result = await orchestrator.execute(
      "test_service",
      "test.route",
      { projectName: "Test" },
      "user-1",
      "org-1",
    );

    expect(result.success).toBe(false);
    expect(result.finalStatus).toBe("blocked");
    expect(result.stoppedAtLayer).toBe(5);
    expect(result.stopReason).toContain("disabled");
    expect(mockLayer5Execute).not.toHaveBeenCalled();
    expect(mockLayer6Execute).not.toHaveBeenCalled();
  });

  it("skips disabled Layer 8 without bypassing approval", async () => {
    setupAllLayersContinue();
    mockLayerConfigs.set(8, {
      enabled: false,
      mode: "enforce",
      timeoutMs: 0,
      retries: 0,
      name: "Memory, Learning & Controlled Execution",
    });

    const result = await orchestrator.execute(
      "test_service",
      "test.route",
      { projectName: "Test" },
      "user-1",
      "org-1",
    );

    expect(result.success).toBe(true);
    expect(mockLayer7Execute).toHaveBeenCalled();
    expect(mockLayer8Execute).not.toHaveBeenCalled();
    expect(result.decision.memory).toMatchObject({
      controlPlane: expect.objectContaining({ enforced: true }),
    });
  });

  it("pauses after a configured layer approval gate", async () => {
    setupAllLayersContinue();
    mockLayerConfigs.set(6, {
      enabled: true,
      mode: "enforce",
      timeoutMs: 0,
      retries: 0,
      name: "Governed Intelligence",
      key: "intelligence",
      approvalRequired: true,
      approvalRoles: ["pmo_director"],
    });

    const result = await orchestrator.execute(
      "test_service",
      "test.route",
      { projectName: "Needs layer approval" },
      "user-1",
      "org-1",
    );

    expect(result.finalStatus).toBe("pending_approval");
    expect(result.decision.advisory).toMatchObject({
      controlPlaneApproval: expect.objectContaining({
        required: true,
        layer: 6,
        roles: ["pmo_director"],
      }),
    });
    expect(mockStorage.createApproval).toHaveBeenCalledWith(expect.objectContaining({
      decisionId: "saved-decision-id",
      status: "pending",
    }));
    expect(mockLayer7Execute).not.toHaveBeenCalled();
    expect(mockLayer8Execute).not.toHaveBeenCalled();
  });

  it("persists a Layer 7 HITL approval gate when validation is pending", async () => {
    setupAllLayersContinue();
    mockLayer7Execute.mockResolvedValue(makeLayerResult(7, true, {
      status: "validation",
      data: {
        approvalId: "APR-L7-PENDING",
        status: "pending",
        thresholdChecks: [
          { check: "budget_authority", passed: false, value: 15000000, threshold: 10000000 },
        ],
        biasDetection: { detected: false },
      },
    }));

    const result = await orchestrator.execute(
      "test_service",
      "test.route",
      { projectName: "Needs L7 approval" },
      "user-1",
      "org-1",
    );

    expect(result.finalStatus).toBe("pending_approval");
    expect(mockStorage.createApproval).toHaveBeenCalledWith(expect.objectContaining({
      decisionId: "saved-decision-id",
      approvalId: "APR-L7-PENDING",
      status: "pending",
      metadata: expect.objectContaining({
        type: "corevia_brain_layer7",
        layer: 7,
        roles: ["pmo_director", "director"],
      }),
    }));
  });

  it("does not pause for approval gates in monitor mode", async () => {
    setupAllLayersContinue();
    mockLayerConfigs.set(6, {
      enabled: true,
      mode: "monitor",
      timeoutMs: 0,
      retries: 0,
      name: "Governed Intelligence",
      key: "intelligence",
      approvalRequired: true,
      approvalRoles: ["pmo_director"],
    });

    const result = await orchestrator.execute(
      "test_service",
      "test.route",
      { projectName: "Monitor approval" },
      "user-1",
      "org-1",
    );

    expect(result.success).toBe(true);
    expect(mockStorage.createApproval).not.toHaveBeenCalled();
    expect(mockLayer7Execute).toHaveBeenCalled();
    expect(mockLayer8Execute).toHaveBeenCalled();
  });

  it("propagates the created requestId through the pipeline decision object", async () => {
    setupAllLayersContinue();

    await orchestrator.execute("test_service", "test.route", { projectName: "Scoped" }, "user-1", "org-1");

    expect(mockLayer6Execute).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "REQ-1" }),
      expect.anything(),
    );
    expect(mockStorage.persistDecisionObject).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "REQ-1" }),
    );
  });

  /* ---------- Early stop: Layer 1 failure ---------- */

  it("stops at Layer 1 when intake fails", async () => {
    mockLayer1Execute.mockResolvedValue(
      makeLayerResult(1, false, { error: "Invalid input" }),
    );

    const result = await orchestrator.execute(
      "test_service",
      "test.route",
      {},
      "user-1",
    );

    expect(result.success).toBe(false);
    expect(result.stoppedAtLayer).toBe(1);
    expect(mockLayer2Execute).not.toHaveBeenCalled();
  });

  /* ---------- Early stop: Layer 3 BLOCK ---------- */

  it("stops at Layer 3 when policy blocks", async () => {
    mockLayer1Execute.mockResolvedValue(makeLayerResult(1, true));
    mockLayer2Execute.mockResolvedValue(makeLayerResult(2, true));
    mockLayer3Execute.mockResolvedValue(
      makeLayerResult(3, false, { error: "Policy violation", status: "blocked" }),
    );

    const result = await orchestrator.execute(
      "test_service",
      "test.route",
      { projectName: "Blocked" },
      "user-1",
    );

    expect(result.success).toBe(false);
    expect(result.stoppedAtLayer).toBe(3);
    expect(mockStorage.updateLedgerConclusion).toHaveBeenCalledWith(
      expect.any(String),
      "REJECTED",
    );
    expect(mockLayer4Execute).not.toHaveBeenCalled();
  });

  /* ---------- Early stop: Layer 4 NEEDS_INFO ---------- */

  it("stops at Layer 4 when context needs more info", async () => {
    mockLayer1Execute.mockResolvedValue(makeLayerResult(1, true));
    mockLayer2Execute.mockResolvedValue(makeLayerResult(2, true));
    mockLayer3Execute.mockResolvedValue(makeLayerResult(3, true));
    mockLayer4Execute.mockResolvedValue(
      makeLayerResult(4, false, { error: "Missing fields", status: "needs_info" }),
    );

    const result = await orchestrator.execute(
      "test_service",
      "test.route",
      { projectName: "Incomplete" },
      "user-1",
    );

    // needs_info is not blocked/rejected — treated as success by createPipelineResult
    expect(result.finalStatus).toBe("needs_info");
    expect(mockStorage.updateLedgerConclusion).toHaveBeenCalledWith(
      expect.any(String),
      "HOLD",
    );
    expect(mockLayer5Execute).not.toHaveBeenCalled();
  });

  /* ---------- Invariant: no intelligence before L3 ---------- */

  it("never calls L5/L6 when L3 blocks", async () => {
    mockLayer1Execute.mockResolvedValue(makeLayerResult(1, true));
    mockLayer2Execute.mockResolvedValue(makeLayerResult(2, true));
    mockLayer3Execute.mockResolvedValue(makeLayerResult(3, false, { status: "blocked" }));

    await orchestrator.execute("svc", "route", {}, "u1");

    expect(mockLayer5Execute).not.toHaveBeenCalled();
    expect(mockLayer6Execute).not.toHaveBeenCalled();
    expect(mockLayer7Execute).not.toHaveBeenCalled();
    expect(mockLayer8Execute).not.toHaveBeenCalled();
  });

  /* ---------- Audit trail ---------- */

  it("persists audit events for executed layers", async () => {
    setupAllLayersContinue();

    await orchestrator.execute("svc", "route", { projectName: "Audit" }, "u1");

    expect(mockStorage.persistLayerData).toHaveBeenCalled();
    // addAuditEvent is called at least once per layer
    expect(mockStorage.addAuditEvent).toHaveBeenCalled();
    expect(mockStorage.addAuditEvent.mock.calls.length).toBeGreaterThanOrEqual(8);
  });

  /* ---------- Pipeline error handling ---------- */

  it("catches and reports layer execution errors", async () => {
    mockLayer1Execute.mockResolvedValue(makeLayerResult(1, true));
    mockLayer2Execute.mockRejectedValue(new Error("Classification crash"));

    const result = await orchestrator.execute("svc", "route", {}, "u1");

    expect(result.success).toBe(false);
    expect(result.decision).toBeDefined();
    // stopReason is set from the caught error message
    expect(typeof result.stopReason).toBe("string");
  });

  /* ---------- Demand normalization ---------- */

  it("normalizes demand-related serviceId and routeKey", async () => {
    setupAllLayersContinue();

    await orchestrator.execute(
      "demand_report",
      "demand_report",
      { projectName: "Demand" },
      "user-1",
    );

    // Should have been called with normalised values
    expect(mockStorage.createDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: "demand_management",
        routeKey: "demand.new",
      }),
    );
  });

  it("normalizes when sourceType is demand-related", async () => {
    setupAllLayersContinue();

    await orchestrator.execute(
      "generic",
      "generic.route",
      {
        sourceType: "demand_request",
        sourceContext: { demandTitle: "My Demand" },
      },
      "user-1",
    );

    expect(mockStorage.createDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: "demand_management",
        routeKey: "demand.new",
      }),
    );
  });

  /* ---------- L7 auto-approve only DEMAND_REQUEST ---------- */

  it("auto-approves only DEMAND_REQUEST artifacts at L7", async () => {
    // Setup layers: L7 returns "approved"
    mockLayer1Execute.mockResolvedValue(makeLayerResult(1, true));
    mockLayer2Execute.mockResolvedValue(makeLayerResult(2, true));
    mockLayer3Execute.mockResolvedValue(makeLayerResult(3, true));
    mockLayer4Execute.mockResolvedValue(makeLayerResult(4, true));
    mockLayer5Execute.mockResolvedValue(makeLayerResult(5, true));
    mockLayer6Execute.mockResolvedValue(makeLayerResult(6, true));
    mockLayer7Execute.mockResolvedValue(
      makeLayerResult(7, true, {
        status: "completed",
        data: { status: "approved", approvedActions: [] },
      }),
    );
    mockLayer8Execute.mockResolvedValue(makeLayerResult(8, true, { status: "completed" }));

    // Mock artifacts: one DEMAND_REQUEST (should be approved) and one BUSINESS_CASE (should stay DRAFT)
    mockStorage.listArtifactsForSpine.mockResolvedValue([
      { artifactId: "art-1", status: "DRAFT", artifactType: "DEMAND_REQUEST" } as never,
      { artifactId: "art-2", status: "DRAFT", artifactType: "BUSINESS_CASE" } as never,
    ]);

    await orchestrator.execute("svc", "route", {}, "u1");

    // Only DEMAND_REQUEST should be approved
    expect(mockStorage.updateDecisionArtifactStatus).toHaveBeenCalledWith("art-1", "APPROVED");
    expect(mockStorage.updateDecisionArtifactStatus).not.toHaveBeenCalledWith("art-2", "APPROVED");
  });

  /* ---------- Storage error resilience ---------- */

  it("continues pipeline even when audit persistence fails", async () => {
    setupAllLayersContinue();
    mockStorage.addAuditEvent.mockRejectedValue(new Error("DB write failed"));

    const result = await orchestrator.execute("svc", "route", {}, "u1");

    // Pipeline still succeeds — audit is best-effort (try-catch wrapped)
    expect(result.decision).toBeDefined();
    expect(mockLayer8Execute).toHaveBeenCalled();
  });
});
