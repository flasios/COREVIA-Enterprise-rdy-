import { describe, expect, it, vi } from "vitest";

import { SpineOrchestrator } from "../spine/spine-orchestrator";

describe("Corevia enforcement (integration)", () => {
  it("blocks conversion execution scheduling without an approved approvalId", async () => {
    const storage = {
      getSpine: vi.fn(async () => ({ decisionSpineId: "DSP-123", status: "READY_FOR_CONVERSION" })),
      updateSpineStatus: vi.fn(async () => undefined),
      ensureSubDecision: vi.fn(async () => undefined),
      addSpineEvent: vi.fn(async () => undefined),
      isSubDecisionApproved: vi.fn(async () => true),
      getApprovalByApprovalId: vi.fn(async () => null),
      createExecutionJob: vi.fn(async () => undefined),
    };

    const orchestrator = new SpineOrchestrator(storage as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    // Missing approvalId
    const resultMissing = await orchestrator.handleSpineEvent({
      decisionSpineId: "DSP-123",
      event: "CONVERSION_APPROVED",
      actorId: "user-1",
      payload: {},
    });
    expect(resultMissing.changed).toBe(false);
    expect(storage.createExecutionJob).not.toHaveBeenCalled();

    // Present but NOT approved
    const resultNotApproved = await orchestrator.handleSpineEvent({
      decisionSpineId: "DSP-123",
      event: "CONVERSION_APPROVED",
      actorId: "user-1",
      payload: { approvalId: "APR-1" },
    });
    expect(resultNotApproved.changed).toBe(false);
    expect(storage.createExecutionJob).not.toHaveBeenCalled();

    // Approved
    storage.getApprovalByApprovalId.mockResolvedValue({ approvalId: "APR-OK", status: "approved" });
    const resultApproved = await orchestrator.handleSpineEvent({
      decisionSpineId: "DSP-123",
      event: "CONVERSION_APPROVED",
      actorId: "user-1",
      payload: { approvalId: "APR-OK" },
    });
    expect(resultApproved.changed).toBe(false);
    expect(storage.createExecutionJob).toHaveBeenCalledTimes(1);
  });
});
