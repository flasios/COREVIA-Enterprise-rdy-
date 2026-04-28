import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateWorkflowStatus } from "../workflow.useCases";

describe("workflow.useCases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves sovereign classification when acknowledging a high-budget demand", async () => {
    const findById = vi
      .fn()
      .mockResolvedValueOnce({
        id: "r1",
        workflowStatus: "generated",
        budgetRange: "1m-5m",
        dataClassification: "sovereign",
        decisionSpineId: "DSP-123",
        suggestedProjectName: "Sovereign AI Assistant",
        businessObjective: "Support DHA incident command",
        organizationName: "Dubai Health Authority",
        department: "Emergency Response",
        urgency: "high",
        aiAnalysis: {
          decisionId: "DSP-123",
          classificationLevel: "sovereign",
        },
      });

    const intake = vi.fn().mockResolvedValue({
      governance: {
        action: "require_approval",
      },
      requestId: "gov-1",
      requestNumber: "REQ-1",
      status: "pending_approval",
    });

    const result = await updateWorkflowStatus(
      {
        reports: {
          findById,
          update: vi.fn(),
        },
        brain: {
          findLatestDecisionByDemandReportId: vi.fn(),
          approveDecision: vi.fn(),
          syncDecisionToDemand: vi.fn(),
          getPendingGovernanceApprovals: vi.fn(),
        },
        governance: {
          findPendingApprovalsBySourceId: vi.fn().mockResolvedValue([]),
          findApprovedBySourceId: vi.fn().mockResolvedValue([]),
          intake,
        },
        notifier: {
          sendWorkflowStatusNotification: vi.fn(),
          createNotificationLogEntry: vi.fn(),
          sendSpecialistNotification: vi.fn(),
        },
      } as never,
      "r1",
      { workflowStatus: "acknowledged" },
      { userId: "u1", userRole: "admin" },
    );

    expect(result.success).toBe(false);
    expect(intake).toHaveBeenCalledWith(
      expect.objectContaining({
        dataClassification: "sovereign",
        classificationLevel: "sovereign",
        accessLevel: "sovereign",
        sourceContext: expect.objectContaining({
          dataClassification: "sovereign",
          classificationLevel: "sovereign",
          accessLevel: "sovereign",
        }),
      }),
      expect.any(Object),
    );
  });
});