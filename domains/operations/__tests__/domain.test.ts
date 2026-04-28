import { describe, it, expect } from "vitest";
import {
  computeAllocationStatus,
  ratePerformance,
  computeVelocity,
  canAssignResource,
  computeSchedulePerformance,
  computeBurnRate,
  estimateDaysRemaining,
  requiresCostApproval,
} from "../domain";
import type { ResourceCapacity } from "../domain";

describe("operations domain", () => {
  describe("computeAllocationStatus", () => {
    it("available when no allocation", () => {
      expect(computeAllocationStatus(0, 40)).toBe("available");
    });

    it("partially_allocated for < 80%", () => {
      expect(computeAllocationStatus(20, 40)).toBe("partially_allocated");
    });

    it("fully_allocated for 80-100%", () => {
      expect(computeAllocationStatus(35, 40)).toBe("fully_allocated");
    });

    it("overallocated for > 100%", () => {
      expect(computeAllocationStatus(50, 40)).toBe("overallocated");
    });
  });

  describe("ratePerformance", () => {
    it("exceeds for high CPI/SPI", () => {
      expect(ratePerformance(1.1, 1.1)).toBe("exceeds");
    });

    it("meets for normal CPI/SPI", () => {
      expect(ratePerformance(0.95, 0.95)).toBe("meets");
    });

    it("below for low CPI/SPI", () => {
      expect(ratePerformance(0.8, 0.8)).toBe("below");
    });

    it("critical for very low CPI/SPI", () => {
      expect(ratePerformance(0.5, 0.5)).toBe("critical");
    });
  });

  describe("computeVelocity", () => {
    it("correct velocity", () => {
      expect(computeVelocity(20, 10)).toBe(2);
    });

    it("0 for zero days", () => {
      expect(computeVelocity(20, 0)).toBe(0);
    });
  });

  describe("canAssignResource", () => {
    it("true with enough hours", () => {
      expect(canAssignResource({ availableHours: 8 } as ResourceCapacity)).toBe(true);
    });

    it("false with insufficient hours", () => {
      expect(canAssignResource({ availableHours: 2 } as ResourceCapacity)).toBe(false);
    });
  });

  describe("computeSchedulePerformance", () => {
    it("1.0 for on-schedule", () => {
      expect(computeSchedulePerformance(100, 50, 50)).toBe(1);
    });

    it("> 1 for ahead of schedule", () => {
      expect(computeSchedulePerformance(100, 50, 70)).toBeGreaterThan(1);
    });

    it("< 1 for behind schedule", () => {
      expect(computeSchedulePerformance(100, 50, 30)).toBeLessThan(1);
    });
  });

  describe("computeBurnRate", () => {
    it("correct calculation", () => {
      expect(computeBurnRate(10000, 10)).toBe(1000);
    });

    it("0 for zero days", () => {
      expect(computeBurnRate(10000, 0)).toBe(0);
    });
  });

  describe("estimateDaysRemaining", () => {
    it("correct estimate", () => {
      expect(estimateDaysRemaining(100000, 50000, 5000)).toBe(10);
    });

    it("Infinity when no burn rate", () => {
      expect(estimateDaysRemaining(100000, 50000, 0)).toBe(Infinity);
    });

    it("0 when budget spent", () => {
      expect(estimateDaysRemaining(100000, 100000, 5000)).toBe(0);
    });
  });

  describe("requiresCostApproval", () => {
    it("true for large amount", () => {
      expect(requiresCostApproval(60000)).toBe(true);
    });

    it("false for small amount", () => {
      expect(requiresCostApproval(10000)).toBe(false);
    });

    it("respects custom threshold", () => {
      expect(requiresCostApproval(10000, 5000)).toBe(true);
    });
  });
});
