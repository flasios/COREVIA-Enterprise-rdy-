import { describe, it, expect } from "vitest";
import {
  computeOverallHealth,
  isLatencyAcceptable,
  isHealthCheckStale,
} from "../domain";
import type { ComponentHealth } from "../domain";

describe("platform domain", () => {
  describe("computeOverallHealth", () => {
    it("healthy when all components healthy", () => {
      const components: ComponentHealth[] = [
        { component: "database", status: "healthy", lastCheckedAt: new Date() },
        { component: "cache", status: "healthy", lastCheckedAt: new Date() },
      ];
      expect(computeOverallHealth(components)).toBe("healthy");
    });

    it("degraded when any component degraded", () => {
      const components: ComponentHealth[] = [
        { component: "database", status: "healthy", lastCheckedAt: new Date() },
        { component: "cache", status: "degraded", lastCheckedAt: new Date() },
      ];
      expect(computeOverallHealth(components)).toBe("degraded");
    });

    it("unhealthy when any component unhealthy", () => {
      const components: ComponentHealth[] = [
        { component: "database", status: "unhealthy", lastCheckedAt: new Date() },
        { component: "cache", status: "degraded", lastCheckedAt: new Date() },
      ];
      expect(computeOverallHealth(components)).toBe("unhealthy");
    });

    it("unhealthy for empty components", () => {
      expect(computeOverallHealth([])).toBe("unhealthy");
    });
  });

  describe("isLatencyAcceptable", () => {
    it("acceptable latency for database < 100ms", () => {
      expect(isLatencyAcceptable("database", 50)).toBe(true);
    });

    it("unacceptable latency for database > 100ms", () => {
      expect(isLatencyAcceptable("database", 150)).toBe(false);
    });

    it("acceptable latency for cache < 10ms", () => {
      expect(isLatencyAcceptable("cache", 5)).toBe(true);
    });

    it("ai_engine allows up to 5000ms", () => {
      expect(isLatencyAcceptable("ai_engine", 3000)).toBe(true);
    });
  });

  describe("isHealthCheckStale", () => {
    it("false for recent check", () => {
      expect(isHealthCheckStale(new Date())).toBe(false);
    });

    it("true for old check", () => {
      const old = new Date(Date.now() - 120_000);
      expect(isHealthCheckStale(old)).toBe(true);
    });
  });
});
