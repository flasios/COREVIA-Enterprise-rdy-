import { describe, it, expect } from "vitest";
import {
  computeComplianceScore,
  buildScorecard,
  requiresRemediation,
  isAuditReady,
  remediationSla,
  remediationPriority,
  meetsFrameworkThreshold,
  riskAdjustedScore,
} from "../domain";
import type { ComplianceControl, ComplianceScorecard } from "../domain";

describe("compliance domain", () => {
  const makeControl = (overrides: Partial<ComplianceControl>): ComplianceControl => ({
    id: "c1",
    framework: "iso27001",
    controlId: "A.1.1",
    title: "Test",
    description: "Test control",
    status: "met",
    evidenceRequired: true,
    evidenceProvided: true,
    ...overrides,
  });

  describe("computeComplianceScore", () => {
    it("100 for all met", () => {
      const controls = [makeControl({ status: "met" }), makeControl({ status: "met" })];
      expect(computeComplianceScore(controls)).toBe(100);
    });

    it("50 for all partially_met", () => {
      const controls = [makeControl({ status: "partially_met" })];
      expect(computeComplianceScore(controls)).toBe(50);
    });

    it("excludes not_applicable", () => {
      const controls = [
        makeControl({ status: "met" }),
        makeControl({ status: "not_applicable" }),
      ];
      expect(computeComplianceScore(controls)).toBe(100);
    });

    it("100 for empty list", () => {
      expect(computeComplianceScore([])).toBe(100);
    });
  });

  describe("buildScorecard", () => {
    it("builds correct scorecard", () => {
      const controls = [
        makeControl({ status: "met", framework: "iso27001" }),
        makeControl({ status: "not_met", framework: "iso27001" }),
        makeControl({ status: "met", framework: "nist" }),
      ];
      const sc = buildScorecard("iso27001", controls);
      expect(sc.totalControls).toBe(2);
      expect(sc.met).toBe(1);
      expect(sc.notMet).toBe(1);
      expect(sc.score).toBe(50);
    });
  });

  describe("requiresRemediation", () => {
    it("true for not_met with evidence required", () => {
      expect(requiresRemediation(makeControl({ status: "not_met", evidenceRequired: true }))).toBe(true);
    });

    it("false for met", () => {
      expect(requiresRemediation(makeControl({ status: "met" }))).toBe(false);
    });
  });

  describe("isAuditReady", () => {
    it("true when all scores >= 85", () => {
      const scorecards: ComplianceScorecard[] = [
        { framework: "iso27001", totalControls: 10, met: 9, partiallyMet: 1, notMet: 0, notApplicable: 0, score: 95 },
      ];
      expect(isAuditReady(scorecards)).toBe(true);
    });

    it("false when any score < 85", () => {
      const scorecards: ComplianceScorecard[] = [
        { framework: "iso27001", totalControls: 10, met: 9, partiallyMet: 1, notMet: 0, notApplicable: 0, score: 95 },
        { framework: "nist", totalControls: 10, met: 5, partiallyMet: 0, notMet: 5, notApplicable: 0, score: 50 },
      ];
      expect(isAuditReady(scorecards)).toBe(false);
    });

    it("false for empty scorecards", () => {
      expect(isAuditReady([])).toBe(false);
    });
  });

  describe("remediationSla", () => {
    it("critical = 7 days", () => {
      expect(remediationSla("critical")).toBe(7);
    });

    it("observation = 90 days", () => {
      expect(remediationSla("observation")).toBe(90);
    });
  });

  describe("remediationPriority", () => {
    it("critical finding is always urgent", () => {
      expect(remediationPriority("critical", "iso27001")).toBe("urgent");
    });

    it("major under UAE IA is urgent", () => {
      expect(remediationPriority("major", "uae_ia")).toBe("urgent");
    });

    it("major under ISO is high", () => {
      expect(remediationPriority("major", "iso27001")).toBe("high");
    });

    it("observation is low", () => {
      expect(remediationPriority("observation", "iso27001")).toBe("low");
    });
  });

  describe("meetsFrameworkThreshold", () => {
    it("UAE IA requires 90%", () => {
      expect(meetsFrameworkThreshold("uae_ia", 89)).toBe(false);
      expect(meetsFrameworkThreshold("uae_ia", 90)).toBe(true);
    });

    it("ISO requires 85%", () => {
      expect(meetsFrameworkThreshold("iso27001", 84)).toBe(false);
      expect(meetsFrameworkThreshold("iso27001", 85)).toBe(true);
    });
  });

  describe("riskAdjustedScore", () => {
    it("weights evidence-required controls higher", () => {
      const controls = [
        makeControl({ status: "met", evidenceRequired: true }),
        makeControl({ status: "not_met", evidenceRequired: false }),
      ];
      // evidence-required met (1.5) + non-evidence not_met (0) = 1.5/2.5 = 60%
      expect(riskAdjustedScore(controls)).toBe(60);
    });

    it("100 for empty", () => {
      expect(riskAdjustedScore([])).toBe(100);
    });
  });
});
