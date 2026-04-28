import { describe, it, expect } from "vitest";
import {
  requiresManualApproval,
  escalationLevel,
  canApproveDecision,
  isFullyProcessed,
  isTerminal,
  isGovernanceUseCase,
  isValidSpineTransition,
  toConfidenceLevel,
  canAutoApprove,
  minimumLayersRequired,
} from "../domain";

describe("intelligence domain", () => {
  describe("requiresManualApproval", () => {
    it("sovereign always requires approval", () => {
      expect(requiresManualApproval("sovereign", "low")).toBe(true);
    });

    it("confidential + critical requires approval", () => {
      expect(requiresManualApproval("confidential", "critical")).toBe(true);
    });

    it("public + low does not require approval", () => {
      expect(requiresManualApproval("public", "low")).toBe(false);
    });

    it("critical risk always requires approval", () => {
      expect(requiresManualApproval("internal", "critical")).toBe(true);
    });
  });

  describe("escalationLevel", () => {
    it("sovereign → ciso", () => {
      expect(escalationLevel("sovereign", "low")).toBe("ciso");
    });

    it("confidential + high → director", () => {
      expect(escalationLevel("confidential", "high")).toBe("director");
    });

    it("internal + high → manager", () => {
      expect(escalationLevel("internal", "high")).toBe("manager");
    });

    it("public + low → none", () => {
      expect(escalationLevel("public", "low")).toBe("none");
    });
  });

  describe("canApproveDecision", () => {
    it("super_admin can approve anything", () => {
      expect(canApproveDecision("super_admin", "sovereign", "critical")).toBe(true);
    });

    it("director can approve confidential+high", () => {
      expect(canApproveDecision("director", "confidential", "high")).toBe(true);
    });

    it("member cannot approve", () => {
      expect(canApproveDecision("member", "public", "medium")).toBe(false);
    });
  });

  describe("isFullyProcessed", () => {
    it("true for layer 8", () => {
      expect(isFullyProcessed(8)).toBe(true);
    });

    it("false for layer 5", () => {
      expect(isFullyProcessed(5)).toBe(false);
    });

    it("false for null", () => {
      expect(isFullyProcessed(null)).toBe(false);
    });
  });

  describe("isTerminal", () => {
    it("approved is terminal", () => {
      expect(isTerminal("approved")).toBe(true);
    });

    it("processing is not terminal", () => {
      expect(isTerminal("processing")).toBe(false);
    });
  });

  describe("isGovernanceUseCase", () => {
    it("demand_management is governance", () => {
      expect(isGovernanceUseCase("demand_management")).toBe(true);
    });

    it("rag is not governance", () => {
      expect(isGovernanceUseCase("rag")).toBe(false);
    });
  });

  describe("isValidSpineTransition", () => {
    it("created → processing is valid", () => {
      expect(isValidSpineTransition("created", "processing")).toBe(true);
    });

    it("created → approved is invalid", () => {
      expect(isValidSpineTransition("created", "approved")).toBe(false);
    });

    it("pending_approval → approved is valid", () => {
      expect(isValidSpineTransition("pending_approval", "approved")).toBe(true);
    });

    it("executed → anything is invalid", () => {
      expect(isValidSpineTransition("executed", "created")).toBe(false);
    });
  });

  describe("toConfidenceLevel", () => {
    it("very_high for >= 0.9", () => {
      expect(toConfidenceLevel(0.95)).toBe("very_high");
    });

    it("high for 0.7-0.89", () => {
      expect(toConfidenceLevel(0.75)).toBe("high");
    });

    it("medium for 0.5-0.69", () => {
      expect(toConfidenceLevel(0.55)).toBe("medium");
    });

    it("very_low for < 0.3", () => {
      expect(toConfidenceLevel(0.1)).toBe("very_low");
    });
  });

  describe("canAutoApprove", () => {
    it("public + low + non-governance = auto-approve", () => {
      expect(canAutoApprove("public", "low", "rag")).toBe(true);
    });

    it("sovereign always requires human", () => {
      expect(canAutoApprove("sovereign", "low", "rag")).toBe(false);
    });

    it("governance use-case always requires human", () => {
      expect(canAutoApprove("public", "low", "demand_management")).toBe(false);
    });
  });

  describe("minimumLayersRequired", () => {
    it("governance needs 8 layers", () => {
      expect(minimumLayersRequired("demand_management")).toBe(8);
    });

    it("excluded uses need 4 layers", () => {
      expect(minimumLayersRequired("rag")).toBe(4);
    });

    it("other uses need 6 layers", () => {
      expect(minimumLayersRequired("some_custom")).toBe(6);
    });
  });
});
