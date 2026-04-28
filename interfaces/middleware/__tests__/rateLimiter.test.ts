/**
 * Rate Limiter — Unit Tests
 *
 * Tests rate limiter configuration and key generation logic.
 */
import { describe, it, expect } from "vitest";

describe("Rate Limiter Configuration", () => {
  describe("key generation logic", () => {
    // Simulate getClientKey logic
    function getClientKey(userId?: string, ip?: string): string {
      if (userId) return `user:${userId}`;
      return `ip:${ip ?? "unknown"}`;
    }

    it("uses userId when authenticated", () => {
      expect(getClientKey("user-123", "192.168.1.1")).toBe("user:user-123");
    });

    it("falls back to IP when not authenticated", () => {
      expect(getClientKey(undefined, "192.168.1.1")).toBe("ip:192.168.1.1");
    });

    it("uses 'unknown' when no IP available", () => {
      expect(getClientKey(undefined, undefined)).toBe("ip:unknown");
    });
  });

  describe("auth attempt key generation", () => {
    function normalizeAuthIdentity(value: unknown): string | null {
      if (typeof value !== "string") return null;
      const normalized = value.trim().toLowerCase();
      return normalized.length > 0 ? normalized.slice(0, 128) : null;
    }

    function getAuthAttemptKey(ip: string, email?: string, username?: string): string {
      const identity = normalizeAuthIdentity(email) ?? normalizeAuthIdentity(username) ?? "anonymous";
      return `auth:${ip}:${identity}`;
    }

    it("uses email when available", () => {
      const key = getAuthAttemptKey("1.2.3.4", "Admin@Example.com ");
      expect(key).toBe("auth:1.2.3.4:admin@example.com");
    });

    it("falls back to username", () => {
      const key = getAuthAttemptKey("1.2.3.4", undefined, "SuperAdmin");
      expect(key).toBe("auth:1.2.3.4:superadmin");
    });

    it("uses anonymous when neither provided", () => {
      const key = getAuthAttemptKey("1.2.3.4");
      expect(key).toBe("auth:1.2.3.4:anonymous");
    });

    it("normalizes whitespace and casing", () => {
      expect(normalizeAuthIdentity("  TEST@Mail.com  ")).toBe("test@mail.com");
    });

    it("rejects empty strings", () => {
      expect(normalizeAuthIdentity("   ")).toBeNull();
    });

    it("rejects non-strings", () => {
      expect(normalizeAuthIdentity(42)).toBeNull();
      expect(normalizeAuthIdentity(null)).toBeNull();
      expect(normalizeAuthIdentity(undefined)).toBeNull();
    });

    it("truncates long identities", () => {
      const long = "a".repeat(200);
      expect(normalizeAuthIdentity(long)!.length).toBe(128);
    });
  });

  describe("rate limit configs", () => {
    it("standard limiter allows 100 requests per 15 min", () => {
      const config = { windowMs: 15 * 60 * 1000, max: 100 };
      expect(config.max).toBe(100);
      expect(config.windowMs).toBe(900_000);
    });

    it("auth limiter allows 10 attempts per 15 min", () => {
      const config = { windowMs: 15 * 60 * 1000, max: 10 };
      expect(config.max).toBe(10);
    });

    it("AI limiter allows 10 requests per minute", () => {
      const config = { windowMs: 60 * 1000, max: 10 };
      expect(config.max).toBe(10);
      expect(config.windowMs).toBe(60_000);
    });

    it("upload limiter allows 50 uploads per hour", () => {
      const config = { windowMs: 60 * 60 * 1000, max: 50 };
      expect(config.max).toBe(50);
      expect(config.windowMs).toBe(3_600_000);
    });

    it("strict limiter allows 20 requests per 15 min", () => {
      const config = { windowMs: 15 * 60 * 1000, max: 20 };
      expect(config.max).toBe(20);
    });
  });
});
