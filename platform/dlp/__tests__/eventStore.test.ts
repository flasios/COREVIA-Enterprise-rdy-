/**
 * DLP Event Store — Unit Tests
 *
 * Tests the in-memory ring buffer, event recording, filtering,
 * stats aggregation, and pattern definitions.
 *
 * @module platform
 */

import { describe, it, expect } from "vitest";
import {
  recordDlpEvent,
  getDlpEvents,
  getDlpStats,
  getDlpPatternDefinitions,
  type DlpEvent,
} from "../eventStore";

// ── Helper ──────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<Omit<DlpEvent, "id" | "timestamp">> = {}) {
  return {
    type: "response_scan" as const,
    severity: "info" as const,
    path: "/api/test",
    method: "GET",
    findings: [],
    action: "allowed" as const,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("DLP Event Store", () => {
  describe("recordDlpEvent", () => {
    it("returns a complete event with id and timestamp", () => {
      const event = recordDlpEvent(makeEvent());
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.type).toBe("response_scan");
      expect(event.action).toBe("allowed");
    });

    it("generates unique IDs", () => {
      const e1 = recordDlpEvent(makeEvent());
      const e2 = recordDlpEvent(makeEvent());
      expect(e1.id).not.toBe(e2.id);
    });

    it("assigns ISO timestamp", () => {
      const event = recordDlpEvent(makeEvent());
      expect(() => new Date(event.timestamp)).not.toThrow();
      expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
    });

    it("preserves metadata", () => {
      const event = recordDlpEvent(makeEvent({
        userId: "u123",
        findings: [{ pattern: "email_address", severity: "medium", count: 3 }],
        metadata: { browser: "Chrome" },
      }));
      expect(event.userId).toBe("u123");
      expect(event.findings).toHaveLength(1);
      expect(event.metadata?.browser).toBe("Chrome");
    });
  });

  describe("getDlpEvents", () => {
    it("returns events newest first", () => {
      const e1 = recordDlpEvent(makeEvent({ path: "/first" }));
      const e2 = recordDlpEvent(makeEvent({ path: "/second" }));
      const events = getDlpEvents();
      const idx1 = events.findIndex((e) => e.id === e1.id);
      const idx2 = events.findIndex((e) => e.id === e2.id);
      expect(idx2).toBeLessThan(idx1); // e2 (newer) comes first
    });

    it("respects limit", () => {
      for (let i = 0; i < 10; i++) {
        recordDlpEvent(makeEvent());
      }
      const events = getDlpEvents({ limit: 3 });
      expect(events.length).toBeLessThanOrEqual(3);
    });

    it("filters by type", () => {
      recordDlpEvent(makeEvent({ type: "export_blocked" }));
      recordDlpEvent(makeEvent({ type: "response_scan" }));
      const events = getDlpEvents({ type: "export_blocked" });
      expect(events.every((e) => e.type === "export_blocked")).toBe(true);
    });

    it("filters by severity", () => {
      recordDlpEvent(makeEvent({ severity: "critical" }));
      recordDlpEvent(makeEvent({ severity: "low" }));
      const events = getDlpEvents({ severity: "critical" });
      expect(events.every((e) => e.severity === "critical")).toBe(true);
    });

    it("filters by action", () => {
      recordDlpEvent(makeEvent({ action: "blocked" }));
      recordDlpEvent(makeEvent({ action: "allowed" }));
      const events = getDlpEvents({ action: "blocked" });
      expect(events.every((e) => e.action === "blocked")).toBe(true);
    });

    it("filters by since timestamp", () => {
      const before = new Date().toISOString();
      recordDlpEvent(makeEvent({ path: "/after-since" }));
      const events = getDlpEvents({ since: before });
      expect(events.some((e) => e.path === "/after-since")).toBe(true);
    });
  });

  describe("getDlpStats", () => {
    it("returns counter totals", () => {
      const stats = getDlpStats();
      expect(stats.totalScans).toBeGreaterThan(0);
      expect(typeof stats.totalBlocked).toBe("number");
      expect(typeof stats.totalRedacted).toBe("number");
      expect(typeof stats.totalClean).toBe("number");
      expect(typeof stats.totalExportBlocked).toBe("number");
    });

    it("aggregates findings by pattern", () => {
      recordDlpEvent(makeEvent({
        findings: [
          { pattern: "email_address", severity: "medium", count: 5 },
          { pattern: "credit_card", severity: "critical", count: 2 },
        ],
      }));
      const stats = getDlpStats();
      expect(stats.byPattern["email_address"]).toBeGreaterThanOrEqual(5);
    });

    it("aggregates by severity", () => {
      recordDlpEvent(makeEvent({ severity: "high" }));
      const stats = getDlpStats();
      expect(stats.bySeverity["high"]).toBeGreaterThanOrEqual(1);
    });

    it("tracks top paths", () => {
      for (let i = 0; i < 5; i++) {
        recordDlpEvent(makeEvent({ path: "/api/hot-path" }));
      }
      const stats = getDlpStats();
      expect(stats.topPaths.some((p) => p.path === "/api/hot-path")).toBe(true);
    });

    it("tracks top users", () => {
      for (let i = 0; i < 3; i++) {
        recordDlpEvent(makeEvent({ userId: "power-user-42" }));
      }
      const stats = getDlpStats();
      expect(stats.topUsers.some((u) => u.userId === "power-user-42")).toBe(true);
    });

    it("includes hourly buckets", () => {
      recordDlpEvent(makeEvent());
      const stats = getDlpStats();
      expect(stats.byHour.length).toBeGreaterThanOrEqual(1);
      expect(stats.byHour[0]).toHaveProperty("scans");
    });

    it("includes windowStart", () => {
      const stats = getDlpStats();
      expect(stats.windowStart).toBeDefined();
      expect(() => new Date(stats.windowStart)).not.toThrow();
    });
  });

  describe("getDlpPatternDefinitions", () => {
    it("returns all 11 patterns", () => {
      const patterns = getDlpPatternDefinitions();
      expect(patterns).toHaveLength(11);
    });

    it("each pattern has required fields", () => {
      const patterns = getDlpPatternDefinitions();
      for (const p of patterns) {
        expect(p.name).toBeDefined();
        expect(p.severity).toBeDefined();
        expect(p.description).toBeDefined();
      }
    });

    it("includes UAE-specific patterns", () => {
      const patterns = getDlpPatternDefinitions();
      const names = patterns.map((p) => p.name);
      expect(names).toContain("emirates_id");
      expect(names).toContain("uae_passport");
      expect(names).toContain("uae_phone");
    });

    it("includes credential patterns", () => {
      const patterns = getDlpPatternDefinitions();
      const names = patterns.map((p) => p.name);
      expect(names).toContain("api_key_generic");
      expect(names).toContain("jwt_token");
      expect(names).toContain("private_key");
      expect(names).toContain("connection_string");
    });
  });
});
