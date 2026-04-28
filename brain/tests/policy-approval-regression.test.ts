import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetActivePolicyPacks } = vi.hoisted(() => ({
  mockGetActivePolicyPacks: vi.fn(),
}));

vi.mock("../storage", () => ({
  coreviaStorage: {
    getActivePolicyPacks: mockGetActivePolicyPacks,
  },
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
  getControlPlaneState: vi.fn(() => ({
    policyMode: "enforce",
  })),
}));

import { Layer3PolicyOps } from "../layers/layer3-policyops";
import { Layer7Validation } from "../layers/layer7-validation";

describe("policy approval enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carries registry require_approval rules into the policy result", async () => {
    mockGetActivePolicyPacks.mockResolvedValue([
      {
        packId: "approval-thresholds",
        name: "Approval Thresholds",
        version: "1.0.0",
        rules: [
          {
            ruleId: "APR-001",
            name: "Confidential requires approval",
            condition: { field: "classification.classificationLevel", operator: "eq", value: "confidential" },
            action: "require_approval",
            reason: "Confidential decisions require governance approval",
          },
        ],
      },
    ]);

    const layer = new Layer3PolicyOps();
    const result = await layer.execute({
      decisionId: "DEC-POLICY-1",
      correlationId: "COR-POLICY-1",
      input: {
        serviceId: "demand",
        routeKey: "demand.generate",
        rawInput: {},
        userId: "user-1",
        timestamp: new Date().toISOString(),
      },
      classification: {
        classificationLevel: "confidential",
        constraints: {
          allowCloudProcessing: false,
          allowExternalModels: false,
          requireHitl: true,
        },
        classifiedBy: "test",
      },
    } as never);

    expect(result.success).toBe(true);
    expect(result.shouldContinue).toBe(true);
    expect(result.data).toMatchObject({
      result: "require_approval",
      approvalRequired: true,
      approvalReasons: expect.arrayContaining(["Confidential decisions require governance approval"]),
    });
    expect(result.auditEvent.eventType).toBe("policy_requires_approval");
  });

  it("downgrades registry require_approval for derivative artifact runs under an approved demand spine", async () => {
    mockGetActivePolicyPacks.mockResolvedValue([
      {
        packId: "approval-thresholds",
        name: "Approval Thresholds",
        version: "1.0.0",
        rules: [
          {
            ruleId: "APR-REQ-001",
            name: "Confidential requires approval",
            condition: { field: "classification.classificationLevel", operator: "eq", value: "confidential" },
            action: "require_approval",
            reason: "Confidential decisions require governance approval",
          },
        ],
      },
    ]);

    const layer = new Layer3PolicyOps();
    const result = await layer.execute({
      decisionId: "DEC-POLICY-REQ-1",
      correlationId: "COR-POLICY-REQ-1",
      input: {
        serviceId: "requirements_analysis",
        routeKey: "requirements.generate",
        rawInput: { parentDemandApproved: true, parentDecisionSpineId: "DSP-APPROVED-1" },
        normalizedInput: { parentDemandApproved: true, parentDecisionSpineId: "DSP-APPROVED-1" },
        userId: "user-1",
        timestamp: new Date().toISOString(),
      },
      classification: {
        classificationLevel: "confidential",
        constraints: {
          allowCloudProcessing: false,
          allowExternalModels: false,
          requireHitl: true,
        },
        classifiedBy: "test",
      },
    } as never);

    expect(result.success).toBe(true);
    expect(result.shouldContinue).toBe(true);
    expect(result.data).toMatchObject({
      result: "allow",
      approvalRequired: false,
      policiesEvaluated: [
        expect.objectContaining({
          result: "allow",
          reason: expect.stringContaining("bypassed: governance already approved"),
        }),
      ],
    });
  });

  it("forces Layer 7 HITL when policy requires approval even if thresholds pass", async () => {
    const layer = new Layer7Validation();
    const result = await layer.execute({
      decisionId: "DEC-POLICY-2",
      classification: {
        classificationLevel: "public",
        constraints: {
          allowCloudProcessing: true,
          allowExternalModels: true,
          requireHitl: false,
        },
      },
      policy: {
        result: "require_approval",
        policiesEvaluated: [],
        approvalRequired: true,
        approvalReasons: ["Registry approval threshold matched"],
      },
      advisory: {
        overallConfidence: 95,
        options: [{ optionId: "opt-1" }, { optionId: "opt-2" }],
        risks: [{ riskId: "risk-1" }],
        evidence: [{ evidenceId: "ev-1" }],
        proposedActions: [],
      },
      input: {
        normalizedInput: { estimatedBudget: 1000 },
      },
    } as never);

    expect(result.success).toBe(true);
    expect(result.status).toBe("validation");
    expect(result.data).toMatchObject({ status: "pending" });
    expect(result.auditEvent.eventData).toMatchObject({
      requiresHitl: true,
      policyApprovalRequired: true,
      policyApprovalReasons: ["Registry approval threshold matched"],
    });
  });

  it("does not force Layer 7 HITL for derivative artifacts under an approved parent spine", async () => {
    const layer = new Layer7Validation();
    const result = await layer.execute({
      decisionId: "DEC-POLICY-3",
      classification: {
        classificationLevel: "confidential",
        constraints: {
          allowCloudProcessing: false,
          allowExternalModels: false,
          requireHitl: true,
        },
      },
      policy: {
        result: "require_approval",
        policiesEvaluated: [],
        approvalRequired: true,
        approvalReasons: ["Registry approval threshold matched"],
      },
      advisory: {
        overallConfidence: 95,
        options: [{ optionId: "opt-1" }, { optionId: "opt-2" }],
        risks: [{ riskId: "risk-1" }],
        evidence: [{ evidenceId: "ev-1" }],
        proposedActions: [],
      },
      input: {
        rawInput: { parentDemandApproved: true, parentDecisionSpineId: "DSP-APPROVED-1" },
        normalizedInput: { parentDemandApproved: true, parentDecisionSpineId: "DSP-APPROVED-1" },
      },
    } as never);

    expect(result.success).toBe(true);
    expect(result.status).toBe("action_execution");
    expect(result.data).toMatchObject({ status: "approved" });
    expect(result.auditEvent.eventData).toMatchObject({
      requiresHitl: false,
      policyApprovalRequired: true,
    });
  });
});
