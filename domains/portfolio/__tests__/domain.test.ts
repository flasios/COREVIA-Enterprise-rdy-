import { describe, it, expect } from "vitest";
import {
  computeProjectHealth,
  canAdvanceGate,
  assessBudgetVariance,
  computeEarnedValue,
  nextPhase,
  canApproveGate,
  computeRiskScore,
  phaseIndex,
  isPhaseBeforeOrEqual,
  canLockBaseline,
  baselineChangeRequiresApproval,
  canApproveChangeRequest,
  needsPortfolioRebalancing,
} from "../domain";

describe("portfolio domain", () => {
  describe("computeProjectHealth", () => {
    it("on_track for small variance", () => {
      expect(computeProjectHealth(0.02, 0.03)).toBe("on_track");
    });

    it("at_risk for moderate variance", () => {
      expect(computeProjectHealth(0.10, 0.05)).toBe("at_risk");
    });

    it("critical for large variance", () => {
      expect(computeProjectHealth(0.20, 0.05)).toBe("critical");
    });
  });

  describe("canAdvanceGate", () => {
    it("allows advancement when checks pass and owner approved", () => {
      expect(canAdvanceGate({ mandatoryChecksPassed: true, ownerApproved: true, decision: "go" })).toBe(true);
    });

    it("blocks when mandatory checks fail", () => {
      expect(canAdvanceGate({ mandatoryChecksPassed: false, ownerApproved: true, decision: "go" })).toBe(false);
    });

    it("blocks when owner not approved", () => {
      expect(canAdvanceGate({ mandatoryChecksPassed: true, ownerApproved: false, decision: "go" })).toBe(false);
    });

    it("allows conditional advancement", () => {
      expect(canAdvanceGate({ mandatoryChecksPassed: true, ownerApproved: true, decision: "conditional" })).toBe(true);
    });

    it("blocks no_go", () => {
      expect(canAdvanceGate({ mandatoryChecksPassed: true, ownerApproved: true, decision: "no_go" })).toBe(false);
    });
  });

  describe("assessBudgetVariance", () => {
    it("within_tolerance for small variance", () => {
      expect(assessBudgetVariance(1000, 1020)).toBe("within_tolerance");
    });

    it("warning for moderate variance", () => {
      expect(assessBudgetVariance(1000, 1100)).toBe("warning");
    });

    it("critical for large variance", () => {
      expect(assessBudgetVariance(1000, 1200)).toBe("critical");
    });

    it("within_tolerance for zero budget", () => {
      expect(assessBudgetVariance(0, 100)).toBe("within_tolerance");
    });
  });

  describe("computeEarnedValue", () => {
    it("computes correct metrics", () => {
      const ev = computeEarnedValue(100000, 50, 60000, 50000);
      expect(ev.earnedValue).toBe(50000);
      expect(ev.costVariance).toBe(-10000);
      expect(ev.scheduleVariance).toBe(0);
      expect(ev.cpi).toBeCloseTo(0.833, 2);
      expect(ev.spi).toBe(1);
    });

    it("includes tcpi", () => {
      const ev = computeEarnedValue(100000, 50, 60000, 50000);
      expect(ev.tcpi).toBeDefined();
      expect(typeof ev.tcpi).toBe("number");
    });
  });

  describe("nextPhase", () => {
    it("initiation → planning", () => {
      expect(nextPhase("initiation")).toBe("planning");
    });

    it("closure → null", () => {
      expect(nextPhase("closure")).toBeNull();
    });
  });

  describe("canApproveGate", () => {
    it("director can approve execution gate", () => {
      expect(canApproveGate("director", "execution")).toBe(true);
    });

    it("member cannot approve any gate", () => {
      expect(canApproveGate("member", "initiation")).toBe(false);
    });

    it("pmo can approve closure gate", () => {
      expect(canApproveGate("pmo", "closure")).toBe(true);
    });
  });

  describe("computeRiskScore", () => {
    it("low risk for small values", () => {
      expect(computeRiskScore(1, 2).level).toBe("low");
    });

    it("critical for high values", () => {
      expect(computeRiskScore(5, 5).level).toBe("critical");
    });

    it("caps at 25", () => {
      expect(computeRiskScore(10, 10).score).toBe(25);
    });
  });

  describe("phaseIndex & isPhaseBeforeOrEqual", () => {
    it("initiation has index 0", () => {
      expect(phaseIndex("initiation")).toBe(0);
    });

    it("closure has index 4", () => {
      expect(phaseIndex("closure")).toBe(4);
    });

    it("planning is before execution", () => {
      expect(isPhaseBeforeOrEqual("planning", "execution")).toBe(true);
    });

    it("execution is not before planning", () => {
      expect(isPhaseBeforeOrEqual("execution", "planning")).toBe(false);
    });
  });

  describe("canLockBaseline", () => {
    it("can lock in planning with WBS", () => {
      expect(canLockBaseline("planning", true)).toBe(true);
    });

    it("cannot lock in initiation", () => {
      expect(canLockBaseline("initiation", true)).toBe(false);
    });

    it("cannot lock without WBS", () => {
      expect(canLockBaseline("planning", false)).toBe(false);
    });
  });

  describe("baselineChangeRequiresApproval", () => {
    it("scope change on locked baseline requires approval", () => {
      expect(baselineChangeRequiresApproval(true, "scope")).toBe(true);
    });

    it("resource change on locked baseline does not require approval", () => {
      expect(baselineChangeRequiresApproval(true, "resource")).toBe(false);
    });

    it("no approval needed when not locked", () => {
      expect(baselineChangeRequiresApproval(false, "scope")).toBe(false);
    });
  });

  describe("canApproveChangeRequest", () => {
    it("director can approve budget change in execution", () => {
      expect(canApproveChangeRequest("budget", "execution", "director")).toBe(true);
    });

    it("PM cannot approve budget change in execution", () => {
      expect(canApproveChangeRequest("budget", "execution", "project_manager")).toBe(false);
    });

    it("PM can approve schedule change", () => {
      expect(canApproveChangeRequest("schedule", "planning", "project_manager")).toBe(true);
    });
  });

  describe("needsPortfolioRebalancing", () => {
    it("true when CPI < 0.8", () => {
      expect(needsPortfolioRebalancing(0.7, 1.0)).toBe(true);
    });

    it("false when both above 0.8", () => {
      expect(needsPortfolioRebalancing(0.9, 0.9)).toBe(false);
    });
  });
});
