import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  allowedTransitions,
  isTerminalStatus,
  timestampFieldForStatus,
  parseBudgetAmount,
  classifyFinancialImpact,
  requiresGovernanceReview,
  canSubmitForConversion,
  canDeleteReport,
  computeConversionStats,
  canResubmitDeferred,
  validateWorkflowTransition,
  demandBudget,
  demandUrgency,
  isReviewable,
  isEditable,
} from "../domain";
import type { DemandReport, DemandConversionRequest } from "../domain";

describe("demand domain", () => {
  // ── Workflow State Machine ─────────────────────────────────────

  describe("isValidTransition", () => {
    it("allows generated → acknowledged", () => {
      expect(isValidTransition("generated", "acknowledged")).toBe(true);
    });

    it("allows under_review → initially_approved", () => {
      expect(isValidTransition("under_review", "initially_approved")).toBe(true);
    });

    it("allows deferred → acknowledged (resubmit)", () => {
      expect(isValidTransition("deferred", "acknowledged")).toBe(true);
    });

    it("rejects acknowledged → completed (skip)", () => {
      expect(isValidTransition("acknowledged", "completed")).toBe(false);
    });

    it("rejects archived → anything", () => {
      expect(isValidTransition("archived", "acknowledged")).toBe(false);
    });

    it("returns false for unknown status", () => {
      expect(isValidTransition("unknown_status", "acknowledged")).toBe(false);
    });
  });

  describe("allowedTransitions", () => {
    it("returns correct transitions for generated", () => {
      expect(allowedTransitions("generated")).toEqual(["acknowledged", "rejected"]);
    });

    it("returns empty array for archived", () => {
      expect(allowedTransitions("archived")).toEqual([]);
    });
  });

  describe("isTerminalStatus", () => {
    it("archived is terminal", () => {
      expect(isTerminalStatus("archived")).toBe(true);
    });

    it("approved is not terminal", () => {
      expect(isTerminalStatus("approved")).toBe(false);
    });
  });

  describe("timestampFieldForStatus", () => {
    it("maps acknowledged to acknowledgedAt", () => {
      expect(timestampFieldForStatus("acknowledged")).toBe("acknowledgedAt");
    });

    it("returns null for unknown status", () => {
      expect(timestampFieldForStatus("generated")).toBeNull();
    });
  });

  // ── Budget Parsing ─────────────────────────────────────────────

  describe("parseBudgetAmount", () => {
    it("parses 'AED 60M' as 60,000,000", () => {
      expect(parseBudgetAmount("AED 60M")).toBe(60_000_000);
    });

    it("parses '5,000,000' as 5,000,000", () => {
      expect(parseBudgetAmount("5,000,000")).toBe(5_000_000);
    });

    it("parses 'AED 1.5B' as 1,500,000,000", () => {
      expect(parseBudgetAmount("AED 1.5B")).toBe(1_500_000_000);
    });

    it("parses 'AED 500K' as 500,000", () => {
      expect(parseBudgetAmount("AED 500K")).toBe(500_000);
    });

    it("returns 0 for empty string", () => {
      expect(parseBudgetAmount("")).toBe(0);
    });
  });

  describe("classifyFinancialImpact", () => {
    it("critical for amounts >= 10M", () => {
      expect(classifyFinancialImpact(10_000_000)).toBe("critical");
    });

    it("high for amounts >= 100K", () => {
      expect(classifyFinancialImpact(100_000)).toBe("high");
    });

    it("medium for amounts >= 50K", () => {
      expect(classifyFinancialImpact(50_000)).toBe("medium");
    });

    it("low for amounts < 50K", () => {
      expect(classifyFinancialImpact(10_000)).toBe("low");
    });
  });

  describe("requiresGovernanceReview", () => {
    it("true for budget above threshold", () => {
      expect(requiresGovernanceReview(200_000)).toBe(true);
    });

    it("false for budget below threshold", () => {
      expect(requiresGovernanceReview(50_000)).toBe(false);
    });

    it("respects custom threshold", () => {
      expect(requiresGovernanceReview(50_000, 30_000)).toBe(true);
    });
  });

  // ── Domain Policies ───────────────────────────────────────────

  describe("canSubmitForConversion", () => {
    it("true for approved workflow status", () => {
      expect(canSubmitForConversion({ workflowStatus: "initially_approved" } as DemandReport)).toBe(true);
    });

    it("true for approved status", () => {
      expect(canSubmitForConversion({ status: "approved" } as DemandReport)).toBe(true);
    });

    it("false for draft", () => {
      expect(canSubmitForConversion({ workflowStatus: "generated", status: "draft" } as DemandReport)).toBe(false);
    });
  });

  describe("canDeleteReport", () => {
    it("super_admin can delete any report", () => {
      expect(canDeleteReport({ status: "approved" } as DemandReport, "u1", "super_admin")).toBe(true);
    });

    it("owner can delete own draft", () => {
      expect(canDeleteReport({ createdBy: "u1", status: "draft" } as DemandReport, "u1", "member")).toBe(true);
    });

    it("member cannot delete others' report", () => {
      expect(canDeleteReport({ createdBy: "u2", status: "draft" } as DemandReport, "u1", "member")).toBe(false);
    });
  });

  describe("computeConversionStats", () => {
    it("computes correct stats", () => {
      const requests = [
        { status: "pending" },
        { status: "approved" },
        { status: "rejected" },
        { status: "pending" },
      ] as DemandConversionRequest[];
      const stats = computeConversionStats(requests);
      expect(stats.total).toBe(4);
      expect(stats.pending).toBe(2);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
    });
  });

  // ── Entity Behavior ───────────────────────────────────────────

  describe("demandBudget", () => {
    it("extracts budget from budgetRange", () => {
      expect(demandBudget({ budgetRange: "AED 5M" } as DemandReport)).toBe(5_000_000);
    });
  });

  describe("demandUrgency", () => {
    it("returns typed urgency", () => {
      expect(demandUrgency({ urgency: "high" } as DemandReport)).toBe("high");
    });

    it("defaults to medium for invalid", () => {
      expect(demandUrgency({ urgency: "foo" } as DemandReport)).toBe("medium");
    });

    it("defaults to medium for null", () => {
      expect(demandUrgency({ urgency: null } as DemandReport)).toBe("medium");
    });
  });

  describe("isReviewable", () => {
    it("true for under_review", () => {
      expect(isReviewable({ workflowStatus: "under_review" } as DemandReport)).toBe(true);
    });

    it("false for generated", () => {
      expect(isReviewable({ workflowStatus: "generated" } as DemandReport)).toBe(false);
    });
  });

  describe("isEditable", () => {
    it("true for draft", () => {
      expect(isEditable({ workflowStatus: "draft" } as DemandReport)).toBe(true);
    });

    it("false for approved", () => {
      expect(isEditable({ workflowStatus: "approved" } as DemandReport)).toBe(false);
    });
  });

  describe("canResubmitDeferred", () => {
    it("false if not deferred", () => {
      expect(canResubmitDeferred({ workflowStatus: "approved" } as DemandReport)).toBe(false);
    });

    it("true if deferred with no date", () => {
      expect(canResubmitDeferred({ workflowStatus: "deferred" } as DemandReport)).toBe(true);
    });

    it("true if deferred and past date", () => {
      const past = new Date(Date.now() - 86400000);
      expect(canResubmitDeferred({ workflowStatus: "deferred", deferredUntil: past } as DemandReport)).toBe(true);
    });
  });

  describe("validateWorkflowTransition", () => {
    it("valid transition passes", () => {
      expect(validateWorkflowTransition("generated", "acknowledged", {}).valid).toBe(true);
    });

    it("invalid transition fails", () => {
      const result = validateWorkflowTransition("generated", "completed", {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Cannot transition");
    });

    it("rejection requires reason", () => {
      const result = validateWorkflowTransition("under_review", "rejected", {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain("decision reason");
    });

    it("rejection with reason passes", () => {
      expect(validateWorkflowTransition("under_review", "rejected", { decisionReason: "budget" }).valid).toBe(true);
    });
  });
});
