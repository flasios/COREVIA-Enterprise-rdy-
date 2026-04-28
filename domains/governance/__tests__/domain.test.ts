import { describe, it, expect } from "vitest";
import {
  evaluateGateChecks,
  canActivatePolicyPack,
  requiresGovernanceSignoff,
  computeGovernanceMaturity,
  computeSlaStatus,
  determineEscalation,
  scoreVendorProposal,
  canDeprecatePolicyPack,
} from "../domain";
import type { GateCheckResult } from "../domain";

describe("governance domain", () => {
  describe("evaluateGateChecks", () => {
    it("passes when all mandatory pass", () => {
      const checks: GateCheckResult[] = [
        { checkId: "1", checkName: "A", passed: true, mandatory: true },
        { checkId: "2", checkName: "B", passed: false, mandatory: false },
      ];
      const result = evaluateGateChecks(checks);
      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(1);
    });

    it("fails when mandatory fails", () => {
      const checks: GateCheckResult[] = [
        { checkId: "1", checkName: "A", passed: false, mandatory: true },
      ];
      const result = evaluateGateChecks(checks);
      expect(result.passed).toBe(false);
      expect(result.mandatoryFailed).toHaveLength(1);
    });
  });

  describe("canActivatePolicyPack", () => {
    it("true for draft with rules", () => {
      expect(canActivatePolicyPack({ status: "draft", rulesCount: 5 })).toBe(true);
    });

    it("false for active pack", () => {
      expect(canActivatePolicyPack({ status: "active", rulesCount: 5 })).toBe(false);
    });

    it("false for draft with no rules", () => {
      expect(canActivatePolicyPack({ status: "draft", rulesCount: 0 })).toBe(false);
    });
  });

  describe("requiresGovernanceSignoff", () => {
    it("business_case requires signoff", () => {
      expect(requiresGovernanceSignoff("business_case")).toBe(true);
    });

    it("random artifact does not", () => {
      expect(requiresGovernanceSignoff("meeting_notes")).toBe(false);
    });
  });

  describe("computeGovernanceMaturity", () => {
    it("1mm with no gates", () => {
      expect(computeGovernanceMaturity(0, 0, 50)).toBe(1);
    });

    it("scales with gates and compliance", () => {
      const score = computeGovernanceMaturity(8, 10, 80);
      expect(score).toBeGreaterThan(3);
      expect(score).toBeLessThanOrEqual(5);
    });
  });

  describe("computeSlaStatus", () => {
    it("on_track within SLA", () => {
      const start = new Date(Date.now() - 2 * 86400000); // 2 days ago
      expect(computeSlaStatus(start, "initial_review")).toBe("on_track");
    });

    it("breached past SLA", () => {
      const start = new Date(Date.now() - 10 * 86400000); // 10 days ago
      expect(computeSlaStatus(start, "initial_review")).toBe("breached");
    });

    it("at_risk near SLA", () => {
      const start = new Date(Date.now() - 4 * 86400000 - 12 * 3600000); // 4.5 days ago (90% of 5 day SLA)
      expect(computeSlaStatus(start, "initial_review")).toBe("at_risk");
    });
  });

  describe("determineEscalation", () => {
    it("none when on_track", () => {
      expect(determineEscalation("on_track", 0)).toBe("none");
    });

    it("manager for 1-2 days overdue", () => {
      expect(determineEscalation("breached", 1)).toBe("manager");
    });

    it("director for 3-5 days overdue", () => {
      expect(determineEscalation("breached", 4)).toBe("director");
    });

    it("executive for > 5 days overdue", () => {
      expect(determineEscalation("breached", 7)).toBe("executive");
    });
  });

  describe("scoreVendorProposal", () => {
    it("calculates weighted score", () => {
      const score = scoreVendorProposal({
        technicalScore: 80,
        financialScore: 90,
        experienceScore: 70,
        complianceScore: 100,
      });
      // 80*0.4 + 90*0.3 + 70*0.2 + 100*0.1 = 32 + 27 + 14 + 10 = 83
      expect(score).toBe(83);
    });

    it("accepts custom weights", () => {
      const score = scoreVendorProposal(
        { technicalScore: 100, financialScore: 0, experienceScore: 0, complianceScore: 0 },
        { technical: 1, financial: 0, experience: 0, compliance: 0 },
      );
      expect(score).toBe(100);
    });
  });

  describe("canDeprecatePolicyPack", () => {
    it("true when active with replacement and no active checks", () => {
      expect(canDeprecatePolicyPack({ status: "active", hasReplacementActive: true, activeGateChecks: 0 })).toBe(true);
    });

    it("false without replacement", () => {
      expect(canDeprecatePolicyPack({ status: "active", hasReplacementActive: false, activeGateChecks: 0 })).toBe(false);
    });

    it("false with active gate checks", () => {
      expect(canDeprecatePolicyPack({ status: "active", hasReplacementActive: true, activeGateChecks: 3 })).toBe(false);
    });
  });
});
