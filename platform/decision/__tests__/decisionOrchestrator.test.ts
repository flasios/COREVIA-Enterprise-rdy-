import { beforeEach, describe, expect, it, vi } from "vitest";

const executeMock = vi.fn();

vi.mock("@brain", () => ({
  coreviaOrchestrator: {
    execute: (...args: unknown[]) => executeMock(...args),
  },
}));

vi.mock("@platform/logging/Logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { decisionOrchestrator } from "../decisionOrchestrator";

describe("decisionOrchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves sovereign classification for demand governance intake", async () => {
    executeMock.mockResolvedValue({
      finalStatus: "approved",
      decisionId: "DSP-1",
      correlationId: "corr-1",
    });

    await decisionOrchestrator.intake(
      {
        intent: "Acknowledge sovereign demand",
        decisionType: "business_case",
        sourceType: "demand_report",
        dataClassification: "sovereign",
        sourceContext: {
          demandTitle: "Sovereign AI Assistant",
          businessObjective: "Support DHA incident command",
          department: "Emergency Response",
          organization: "Dubai Health Authority",
          budgetRange: "1m-5m",
          classificationLevel: "sovereign",
          accessLevel: "sovereign",
        },
      },
      {
        userId: "u1",
        organizationId: "org-1",
        decisionSpineId: "DSP-1",
      },
    );

    expect(executeMock).toHaveBeenCalledWith(
      "demand_management",
      "demand.new",
      expect.objectContaining({
        dataClassification: "sovereign",
        classificationLevel: "sovereign",
        accessLevel: "sovereign",
      }),
      "u1",
      "org-1",
      { decisionSpineId: "DSP-1" },
    );
  });
});