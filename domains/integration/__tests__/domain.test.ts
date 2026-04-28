import { describe, it, expect } from "vitest";
import {
  isConnectorHealthy,
  computeReliabilityScore,
  shouldAutoDisable,
  validateConnectorConfig,
  averageSyncDuration,
  needsHealthCheck,
  recommendedConnectorStatus,
} from "../domain";
import type { ConnectorConfig, SyncResult } from "../domain";

describe("integration domain", () => {
  describe("isConnectorHealthy", () => {
    it("true for active connector", () => {
      expect(isConnectorHealthy({ status: "active" } as ConnectorConfig)).toBe(true);
    });

    it("false for error connector", () => {
      expect(isConnectorHealthy({ status: "error" } as ConnectorConfig)).toBe(false);
    });
  });

  describe("computeReliabilityScore", () => {
    it("100 for no results", () => {
      expect(computeReliabilityScore([])).toBe(100);
    });

    it("correct score for mixed results", () => {
      const results: SyncResult[] = [
        { recordsSynced: 90, recordsFailed: 10 } as SyncResult,
      ];
      expect(computeReliabilityScore(results)).toBe(90);
    });

    it("0 for all failures", () => {
      const results: SyncResult[] = [
        { recordsSynced: 0, recordsFailed: 10 } as SyncResult,
      ];
      expect(computeReliabilityScore(results)).toBe(0);
    });
  });

  describe("shouldAutoDisable", () => {
    it("false for fewer than 3 results", () => {
      expect(shouldAutoDisable([{ recordsSynced: 0, recordsFailed: 10 } as SyncResult])).toBe(false);
    });

    it("true when reliability < 50% over 5 syncs", () => {
      const bad = Array(5).fill(null).map(() => ({ recordsSynced: 2, recordsFailed: 8 }) as SyncResult);
      expect(shouldAutoDisable(bad)).toBe(true);
    });

    it("false when reliability > 50%", () => {
      const good = Array(5).fill(null).map(() => ({ recordsSynced: 8, recordsFailed: 2 }) as SyncResult);
      expect(shouldAutoDisable(good)).toBe(false);
    });
  });

  describe("validateConnectorConfig", () => {
    it("valid config passes", () => {
      const result = validateConnectorConfig({
        name: "Test",
        baseUrl: "https://example.com",
        type: "rest",
        authMethod: "bearer",
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("missing fields fail", () => {
      const result = validateConnectorConfig({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("averageSyncDuration", () => {
    it("0 for no results", () => {
      expect(averageSyncDuration([])).toBe(0);
    });

    it("calculates average correctly", () => {
      const t1 = new Date("2024-01-01T00:00:00Z");
      const t2 = new Date("2024-01-01T00:01:00Z"); // 60s
      const t3 = new Date("2024-01-01T00:02:00Z");
      const t4 = new Date("2024-01-01T00:04:00Z"); // 120s
      const results: SyncResult[] = [
        { startedAt: t1, completedAt: t2 } as SyncResult,
        { startedAt: t3, completedAt: t4 } as SyncResult,
      ];
      expect(averageSyncDuration(results)).toBe(90_000); // 90s average
    });
  });

  describe("needsHealthCheck", () => {
    it("true for error status", () => {
      expect(needsHealthCheck({ status: "error" } as ConnectorConfig)).toBe(true);
    });

    it("true for no last sync", () => {
      expect(needsHealthCheck({ status: "active" } as ConnectorConfig)).toBe(true);
    });

    it("true if last sync had failures", () => {
      expect(needsHealthCheck(
        { status: "active" } as ConnectorConfig,
        { recordsFailed: 5 } as SyncResult,
      )).toBe(true);
    });
  });

  describe("recommendedConnectorStatus", () => {
    it("error when reliability < 50%", () => {
      expect(recommendedConnectorStatus("active", 30)).toBe("error");
    });

    it("active when recovering from error and reliability > 80%", () => {
      expect(recommendedConnectorStatus("error", 85)).toBe("active");
    });

    it("keeps current status otherwise", () => {
      expect(recommendedConnectorStatus("active", 75)).toBe("active");
    });
  });
});
