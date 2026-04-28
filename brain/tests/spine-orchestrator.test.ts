/**
 * COREVIA Brain Spine Orchestrator — Unit Tests
 *
 * Tests the governance state machine (SpineOrchestrator)
 * covering spine event transitions, sub-decision lifecycle,
 * closure phase, and learning trigger — all with mocked storage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SpineOrchestrator } from "../spine/spine-orchestrator";

vi.mock("../../platform/observability", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

/* ---------- Mock storage ---------- */

function createMockStorage() {
  return {
    getSpine: vi.fn(),
    updateSpineStatus: vi.fn().mockResolvedValue(undefined),
    addSpineEvent: vi.fn().mockResolvedValue(undefined),
    ensureInitialSubDecisions: vi.fn().mockResolvedValue(undefined),
    findSubDecision: vi.fn().mockResolvedValue(null),
    createDecisionArtifact: vi.fn().mockResolvedValue({ artifactId: "art-1" }),
    createDecisionArtifactVersion: vi.fn().mockResolvedValue(undefined),
    createSubDecision: vi.fn().mockResolvedValue({ subDecisionId: "sub-1" }),
    createSubDecisionApproval: vi.fn().mockResolvedValue(undefined),
    updateSubDecisionStatus: vi.fn().mockResolvedValue(undefined),
    updateDecisionArtifactStatus: vi.fn().mockResolvedValue(undefined),
    getLatestArtifactVersionId: vi.fn().mockResolvedValue("ver-1"),
    listSubDecisions: vi.fn().mockResolvedValue([]),
    isSubDecisionApproved: vi.fn().mockResolvedValue(false),
    areSubDecisionsApproved: vi.fn().mockResolvedValue(false),
    hasSucceededExecution: vi.fn().mockResolvedValue(false),
    getApprovalByApprovalId: vi.fn().mockResolvedValue(null),
    getLatestApprovalForSubDecisionType: vi.fn().mockResolvedValue(null),
    createExecutionJob: vi.fn().mockResolvedValue(undefined),
    saveExecution: vi.fn().mockResolvedValue(undefined),
    getProjectRefForDecision: vi.fn().mockResolvedValue(null),
    updateLedgerProjectRef: vi.fn().mockResolvedValue(undefined),
    ensureLedgerConclusion: vi.fn().mockResolvedValue(undefined),
    getSubDecision: vi.fn(),
    canStartProjectWork: vi.fn().mockResolvedValue(true),
    getSpineOverview: vi.fn().mockResolvedValue(null),
    createLearningAssetFromArtifact: vi.fn().mockResolvedValue(undefined),
    incrementJourneyLearningCount: vi.fn().mockResolvedValue(undefined),
    createJourney: vi.fn().mockResolvedValue(undefined),
    updateSpineJourney: vi.fn().mockResolvedValue(undefined),
    getJourney: vi.fn(),
    updateJourneyStatus: vi.fn().mockResolvedValue(undefined),
    updateJourneyClosure: vi.fn().mockResolvedValue(undefined),
    createSpine: vi.fn().mockResolvedValue(undefined),
  } as unknown as ConstructorParameters<typeof SpineOrchestrator>[0];
}

describe("SpineOrchestrator", () => {
  let storage: ReturnType<typeof createMockStorage>;
  let orch: SpineOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = createMockStorage();
    orch = new SpineOrchestrator(storage as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* =========== handleSpineEvent =========== */

  describe("handleSpineEvent", () => {
    it("transitions CREATED → IN_PROGRESS on DEMAND_SUBMITTED", async () => {
      vi.mocked(storage.getSpine).mockResolvedValue({
        decisionSpineId: "sp-1",
        status: "CREATED",
      });

      const result = await orch.handleSpineEvent({
        decisionSpineId: "sp-1",
        event: "DEMAND_SUBMITTED",
        actorId: "user-1",
      });

      expect(result.state).toBe("IN_PROGRESS");
      expect(result.changed).toBe(true);
      expect(storage.updateSpineStatus).toHaveBeenCalledWith("sp-1", "IN_PROGRESS");
    });

    it("transitions IN_PROGRESS → NEEDS_REVISION on SUBDECISION_REJECTED", async () => {
      vi.mocked(storage.getSpine).mockResolvedValue({
        decisionSpineId: "sp-1",
        status: "IN_PROGRESS",
      });

      const result = await orch.handleSpineEvent({
        decisionSpineId: "sp-1",
        event: "SUBDECISION_REJECTED",
        actorId: "user-1",
      });

      expect(result.state).toBe("NEEDS_REVISION");
      expect(result.changed).toBe(true);
    });

    it("transitions IN_PROGRESS → READY_FOR_STRATEGIC_FIT when all required sub-decisions approved", async () => {
      vi.mocked(storage.getSpine).mockResolvedValue({
        decisionSpineId: "sp-1",
        status: "IN_PROGRESS",
      });
      vi.mocked(storage.listSubDecisions).mockResolvedValue([
        { subDecisionId: "sd-1", subDecisionType: "BUSINESS_CASE", status: "APPROVED" },
        { subDecisionId: "sd-2", subDecisionType: "REQUIREMENTS", status: "APPROVED" },
      ] as never);

      const result = await orch.handleSpineEvent({
        decisionSpineId: "sp-1",
        event: "SUBDECISION_APPROVED",
        actorId: "user-1",
      });

      expect(result.state).toBe("READY_FOR_STRATEGIC_FIT");
      expect(result.changed).toBe(true);
    });

    it("stays IN_PROGRESS when only some required sub-decisions are approved", async () => {
      vi.mocked(storage.getSpine).mockResolvedValue({
        decisionSpineId: "sp-1",
        status: "IN_PROGRESS",
      });
      vi.mocked(storage.listSubDecisions).mockResolvedValue([
        { subDecisionId: "sd-1", subDecisionType: "BUSINESS_CASE", status: "APPROVED" },
        { subDecisionId: "sd-2", subDecisionType: "REQUIREMENTS", status: "DRAFT" },
      ] as never);

      const result = await orch.handleSpineEvent({
        decisionSpineId: "sp-1",
        event: "SUBDECISION_APPROVED",
        actorId: "user-1",
      });

      expect(result.state).toBe("IN_PROGRESS");
      expect(result.changed).toBe(false);
    });

    it("transitions NEEDS_REVISION → IN_PROGRESS on SUBDECISION_RESUBMITTED", async () => {
      vi.mocked(storage.getSpine).mockResolvedValue({
        decisionSpineId: "sp-1",
        status: "NEEDS_REVISION",
      });

      const result = await orch.handleSpineEvent({
        decisionSpineId: "sp-1",
        event: "SUBDECISION_RESUBMITTED",
        actorId: "user-1",
      });

      expect(result.state).toBe("IN_PROGRESS");
      expect(result.changed).toBe(true);
    });

    it("transitions READY_FOR_STRATEGIC_FIT → READY_FOR_CONVERSION on SF_APPROVED", async () => {
      vi.mocked(storage.getSpine).mockResolvedValue({
        decisionSpineId: "sp-1",
        status: "READY_FOR_STRATEGIC_FIT",
      });

      const result = await orch.handleSpineEvent({
        decisionSpineId: "sp-1",
        event: "SF_APPROVED",
        actorId: "user-1",
      });

      expect(result.state).toBe("READY_FOR_CONVERSION");
      expect(result.changed).toBe(true);
    });

    it("transitions READY_FOR_STRATEGIC_FIT → NEEDS_REVISION on SF_REJECTED", async () => {
      vi.mocked(storage.getSpine).mockResolvedValue({
        decisionSpineId: "sp-1",
        status: "READY_FOR_STRATEGIC_FIT",
      });

      const result = await orch.handleSpineEvent({
        decisionSpineId: "sp-1",
        event: "SF_REJECTED",
        actorId: "user-1",
      });

      expect(result.state).toBe("NEEDS_REVISION");
      expect(result.changed).toBe(true);
    });

    it("transitions CONCLUDED → COMPLETED on OUTCOME_RECORDED", async () => {
      vi.mocked(storage.getSpine).mockResolvedValue({
        decisionSpineId: "sp-1",
        status: "CONCLUDED",
      });

      const result = await orch.handleSpineEvent({
        decisionSpineId: "sp-1",
        event: "OUTCOME_RECORDED",
        actorId: "user-1",
      });

      expect(result.state).toBe("COMPLETED");
      expect(result.changed).toBe(true);
      expect(storage.ensureLedgerConclusion).toHaveBeenCalledWith("sp-1", "COMPLETED");
    });

    it("allows SPINE_CANCELLED from any non-CONCLUDED state", async () => {
      vi.mocked(storage.getSpine).mockResolvedValue({
        decisionSpineId: "sp-1",
        status: "IN_PROGRESS",
      });

      const result = await orch.handleSpineEvent({
        decisionSpineId: "sp-1",
        event: "SPINE_CANCELLED",
        actorId: "admin-1",
      });

      expect(result.state).toBe("CANCELLED");
      expect(result.changed).toBe(true);
    });

    it("throws when spine not found", async () => {
      vi.mocked(storage.getSpine).mockResolvedValue(null);

      await expect(orch.handleSpineEvent({
        decisionSpineId: "sp-missing",
        event: "DEMAND_SUBMITTED",
      })).rejects.toThrow("Decision spine not found");
    });

    it("auto-transitions CREATED → IN_PROGRESS on sub-decision events", async () => {
      // First call: spine is CREATED, second call (re-process): spine is IN_PROGRESS
      vi.mocked(storage.getSpine)
        .mockResolvedValueOnce({ decisionSpineId: "sp-1", status: "CREATED" })
        .mockResolvedValueOnce({ decisionSpineId: "sp-1", status: "IN_PROGRESS" });
      vi.mocked(storage.listSubDecisions).mockResolvedValue([
        { subDecisionId: "sd-1", subDecisionType: "BUSINESS_CASE", status: "DRAFT" },
      ] as never);

      await orch.handleSpineEvent({
        decisionSpineId: "sp-1",
        event: "SUBDECISION_APPROVED",
        actorId: "user-1",
      });

      // Should have auto-transitioned to IN_PROGRESS, then processed the event
      expect(storage.updateSpineStatus).toHaveBeenCalledWith("sp-1", "IN_PROGRESS");
    });
  });

  /* =========== handleSubDecisionEvent =========== */

  describe("handleSubDecisionEvent", () => {
    it("transitions DRAFT → IN_REVIEW on SUBMIT_FOR_REVIEW", async () => {
      vi.mocked(storage.getSubDecision).mockResolvedValue({
        subDecisionId: "sd-1",
        decisionSpineId: "sp-1",
        subDecisionType: "BUSINESS_CASE",
        artifactId: "art-1",
        status: "DRAFT",
      });
      vi.mocked(storage.getSpine).mockResolvedValue({ decisionSpineId: "sp-1", status: "IN_PROGRESS" });
      vi.mocked(storage.listSubDecisions).mockResolvedValue([]);

      const result = await orch.handleSubDecisionEvent({
        subDecisionId: "sd-1",
        event: "SUBMIT_FOR_REVIEW",
        actorId: "user-1",
      });

      expect(result.state).toBe("IN_REVIEW");
      expect(result.changed).toBe(true);
      expect(storage.updateSubDecisionStatus).toHaveBeenCalledWith("sd-1", "IN_REVIEW");
    });

    it("transitions IN_REVIEW → APPROVED on APPROVE", async () => {
      vi.mocked(storage.getSubDecision).mockResolvedValue({
        subDecisionId: "sd-1",
        decisionSpineId: "sp-1",
        subDecisionType: "BUSINESS_CASE",
        artifactId: "art-1",
        status: "IN_REVIEW",
      });
      vi.mocked(storage.getSpine).mockResolvedValue({ decisionSpineId: "sp-1", status: "IN_PROGRESS" });
      vi.mocked(storage.listSubDecisions).mockResolvedValue([]);

      const result = await orch.handleSubDecisionEvent({
        subDecisionId: "sd-1",
        event: "APPROVE",
        actorId: "reviewer-1",
      });

      expect(result.state).toBe("APPROVED");
      expect(result.changed).toBe(true);
      expect(storage.createSubDecisionApproval).toHaveBeenCalled();
      expect(storage.updateDecisionArtifactStatus).toHaveBeenCalledWith("art-1", "APPROVED");
    });

    it("transitions IN_REVIEW → DRAFT on REVISE", async () => {
      vi.mocked(storage.getSubDecision).mockResolvedValue({
        subDecisionId: "sd-1",
        decisionSpineId: "sp-1",
        subDecisionType: "REQUIREMENTS",
        artifactId: "art-1",
        status: "IN_REVIEW",
      });

      const result = await orch.handleSubDecisionEvent({
        subDecisionId: "sd-1",
        event: "REVISE",
        actorId: "reviewer-1",
      });

      expect(result.state).toBe("DRAFT");
      expect(result.changed).toBe(true);
      expect(storage.updateDecisionArtifactStatus).toHaveBeenCalledWith("art-1", "DRAFT");
    });

    it("transitions IN_REVIEW → REJECTED on REJECT", async () => {
      vi.mocked(storage.getSubDecision).mockResolvedValue({
        subDecisionId: "sd-1",
        decisionSpineId: "sp-1",
        subDecisionType: "BUSINESS_CASE",
        artifactId: "art-1",
        status: "IN_REVIEW",
      });
      vi.mocked(storage.getSpine).mockResolvedValue({ decisionSpineId: "sp-1", status: "IN_PROGRESS" });
      vi.mocked(storage.listSubDecisions).mockResolvedValue([]);

      const result = await orch.handleSubDecisionEvent({
        subDecisionId: "sd-1",
        event: "REJECT",
        actorId: "reviewer-1",
      });

      expect(result.state).toBe("REJECTED");
      expect(result.changed).toBe(true);
      expect(storage.updateDecisionArtifactStatus).toHaveBeenCalledWith("art-1", "REJECTED");
    });

    it("transitions APPROVED → SUPERSEDED on EDIT_NEW_VERSION", async () => {
      vi.mocked(storage.getSubDecision).mockResolvedValue({
        subDecisionId: "sd-1",
        decisionSpineId: "sp-1",
        subDecisionType: "BUSINESS_CASE",
        artifactId: "art-1",
        status: "APPROVED",
      });
      vi.mocked(storage.createSubDecision).mockResolvedValue({
        subDecisionId: "sd-new",
        decisionSpineId: "sp-1",
        subDecisionType: "BUSINESS_CASE",
        artifactId: "art-1",
        status: "DRAFT",
      });

      const result = await orch.handleSubDecisionEvent({
        subDecisionId: "sd-1",
        event: "EDIT_NEW_VERSION",
        actorId: "user-1",
        payload: { content: { updated: true }, changeSummary: "v2" },
      });

      expect(result.state).toBe("DRAFT");
      expect(result.changed).toBe(true);
      expect(result.subDecisionId).toBe("sd-new");
      expect(storage.updateSubDecisionStatus).toHaveBeenCalledWith("sd-1", "SUPERSEDED");
      expect(storage.createDecisionArtifactVersion).toHaveBeenCalled();
    });

    it("throws when sub-decision not found", async () => {
      vi.mocked(storage.getSubDecision).mockResolvedValue(null);

      await expect(orch.handleSubDecisionEvent({
        subDecisionId: "sd-missing",
        event: "APPROVE",
      })).rejects.toThrow("Sub-decision not found");
    });

    it("blocks project lifecycle types when ledger/project ref missing", async () => {
      vi.mocked(storage.getSubDecision).mockResolvedValue({
        subDecisionId: "sd-1",
        decisionSpineId: "sp-1",
        subDecisionType: "WBS",
        artifactId: "art-1",
        status: "DRAFT",
      });
      vi.mocked(storage.canStartProjectWork).mockResolvedValue(false);

      const result = await orch.handleSubDecisionEvent({
        subDecisionId: "sd-1",
        event: "SUBMIT_FOR_REVIEW",
        actorId: "user-1",
      });

      expect(result.state).toBe("DRAFT");
      expect(result.changed).toBe(false);
    });
  });

  /* =========== Closure phase =========== */

  describe("handleClosureEvent", () => {
    it("transitions closure spine to NEEDS_REVISION on CLOSURE_SUBDECISION_REJECTED", async () => {
      vi.mocked(storage.getSpine).mockResolvedValue({
        decisionSpineId: "sp-closure-1",
        status: "IN_PROGRESS",
        decisionPhase: "CLOSURE",
      });

      const result = await orch.handleClosureEvent({
        closureSpineId: "sp-closure-1",
        event: "CLOSURE_SUBDECISION_REJECTED",
        actorId: "reviewer-1",
      });

      expect(result.state).toBe("NEEDS_REVISION");
      expect(result.journeyCompleted).toBe(false);
    });

    it("transitions closure spine to CONCLUDED when all required closures approved", async () => {
      vi.mocked(storage.getSpine).mockResolvedValue({
        decisionSpineId: "sp-closure-1",
        status: "IN_PROGRESS",
        decisionPhase: "CLOSURE",
        journeyId: "jrn-1",
      });
      vi.mocked(storage.listSubDecisions).mockResolvedValue([
        { subDecisionId: "sd-1", subDecisionType: "CLOSURE_REPORT", status: "APPROVED" },
        { subDecisionId: "sd-2", subDecisionType: "LESSONS_LEARNED", status: "APPROVED" },
      ] as never);

      const result = await orch.handleClosureEvent({
        closureSpineId: "sp-closure-1",
        event: "CLOSURE_SUBDECISION_APPROVED",
        actorId: "reviewer-1",
      });

      expect(result.state).toBe("CONCLUDED");
      expect(result.journeyCompleted).toBe(true);
      expect(storage.updateJourneyStatus).toHaveBeenCalledWith("jrn-1", "COMPLETED");
    });

    it("throws when spine is not closure phase", async () => {
      vi.mocked(storage.getSpine).mockResolvedValue({
        decisionSpineId: "sp-1",
        status: "IN_PROGRESS",
        decisionPhase: "DEMAND",
      });

      await expect(orch.handleClosureEvent({
        closureSpineId: "sp-1",
        event: "CLOSURE_SUBDECISION_APPROVED",
      })).rejects.toThrow("not a closure-phase spine");
    });
  });

  /* =========== Journey management =========== */

  describe("createJourney", () => {
    it("creates a journey and links spine", async () => {
      const result = await orch.createJourney({
        title: "New Project Journey",
        demandSpineId: "sp-1",
        createdBy: "user-1",
      });

      expect(result.journeyId).toMatch(/^JRN-/);
      expect(storage.createJourney).toHaveBeenCalled();
      expect(storage.updateSpineJourney).toHaveBeenCalledWith("sp-1", result.journeyId, "DEMAND");
    });
  });

  describe("initiateClosurePhase", () => {
    it("creates a closure spine and links to journey", async () => {
      vi.mocked(storage.getJourney).mockResolvedValue({
        journeyId: "jrn-1",
        status: "PROJECT_ACTIVE",
        title: "Test Project",
      });

      const result = await orch.initiateClosurePhase({
        journeyId: "jrn-1",
        actorId: "pmo-1",
      });

      expect(result.closureSpineId).toMatch(/^SPX-CLOSURE-/);
      expect(storage.createSpine).toHaveBeenCalled();
      expect(storage.updateJourneyClosure).toHaveBeenCalledWith("jrn-1", result.closureSpineId);
      expect(storage.updateJourneyStatus).toHaveBeenCalledWith("jrn-1", "CLOSURE_PHASE");
    });

    it("throws when journey not found", async () => {
      vi.mocked(storage.getJourney).mockResolvedValue(null);

      await expect(orch.initiateClosurePhase({
        journeyId: "jrn-missing",
      })).rejects.toThrow("not found");
    });

    it("throws when journey is in wrong state", async () => {
      vi.mocked(storage.getJourney).mockResolvedValue({
        journeyId: "jrn-1",
        status: "COMPLETED",
      });

      await expect(orch.initiateClosurePhase({
        journeyId: "jrn-1",
      })).rejects.toThrow("cannot initiate closure");
    });
  });
});
