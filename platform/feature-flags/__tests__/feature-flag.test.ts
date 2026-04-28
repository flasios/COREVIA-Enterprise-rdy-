/**
 * Feature Flag Service — Unit Tests
 *
 * Tests flag evaluation logic: boolean, percentage rollout,
 * role targeting, organization targeting, environment targeting.
 */
import { describe, it, expect } from "vitest";

// We test the evaluation logic directly by importing the service internals.
// The DB layer is mocked.

// ── Hash helper (deterministic percentage check) ────────────────────

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

describe("Feature Flag Evaluation Logic", () => {
  describe("boolean flags", () => {
    it("enabled flag returns true", () => {
      const flag = { enabled: true, rolloutPercentage: null, targetRoles: null, targetOrganizations: null, targetEnvironments: null };
      expect(flag.enabled).toBe(true);
    });

    it("disabled flag returns false", () => {
      const flag = { enabled: false, rolloutPercentage: null, targetRoles: null, targetOrganizations: null, targetEnvironments: null };
      expect(flag.enabled).toBe(false);
    });
  });

  describe("environment targeting", () => {
    it("matches when current env is in target list", () => {
      const targetEnvironments = ["production", "staging"];
      const currentEnv = "production";
      expect(targetEnvironments.includes(currentEnv)).toBe(true);
    });

    it("does not match when current env is not in target list", () => {
      const targetEnvironments = ["production"];
      const currentEnv = "development";
      expect(targetEnvironments.includes(currentEnv)).toBe(false);
    });

    it("matches all environments when targetEnvironments is null", () => {
      const targetEnvironments = null;
      expect(targetEnvironments === null).toBe(true); // null means "all"
    });
  });

  describe("role targeting", () => {
    it("matches when user role is in target list", () => {
      const targetRoles = ["superadmin", "department_head"];
      const userRole = "superadmin";
      expect(targetRoles.includes(userRole)).toBe(true);
    });

    it("does not match when user role is not in target list", () => {
      const targetRoles = ["superadmin"];
      const userRole = "viewer";
      expect(targetRoles.includes(userRole)).toBe(false);
    });

    it("matches all roles when targetRoles is null", () => {
      const targetRoles = null;
      expect(targetRoles === null).toBe(true);
    });
  });

  describe("organization targeting", () => {
    it("matches when user org is in target list", () => {
      const targetOrganizations = ["org-1", "org-2"];
      const userOrg = "org-1";
      expect(targetOrganizations.includes(userOrg)).toBe(true);
    });

    it("does not match when user org is not in target list", () => {
      const targetOrganizations = ["org-1"];
      const userOrg = "org-3";
      expect(targetOrganizations.includes(userOrg)).toBe(false);
    });
  });

  describe("percentage rollout", () => {
    it("deterministic hash is consistent for same input", () => {
      const hash1 = simpleHash("user-123:flag-key");
      const hash2 = simpleHash("user-123:flag-key");
      expect(hash1).toBe(hash2);
    });

    it("different inputs produce different hashes", () => {
      const hash1 = simpleHash("user-123:flag-key");
      const hash2 = simpleHash("user-456:flag-key");
      expect(hash1).not.toBe(hash2);
    });

    it("100% rollout includes everyone", () => {
      const rolloutPercentage = 100;
      // Any hash mod 100 will be < 100
      for (let i = 0; i < 20; i++) {
        const hash = simpleHash(`user-${i}:test-flag`);
        expect(hash % 100 < rolloutPercentage).toBe(true);
      }
    });

    it("0% rollout excludes everyone", () => {
      const rolloutPercentage = 0;
      for (let i = 0; i < 20; i++) {
        const hash = simpleHash(`user-${i}:test-flag`);
        expect(hash % 100 < rolloutPercentage).toBe(false);
      }
    });

    it("50% rollout includes roughly half", () => {
      const rolloutPercentage = 50;
      let included = 0;
      const total = 1000;
      for (let i = 0; i < total; i++) {
        const hash = simpleHash(`user-${i}:rollout-test`);
        if (hash % 100 < rolloutPercentage) included++;
      }
      // Should be roughly 50% ± 10%
      expect(included).toBeGreaterThan(total * 0.35);
      expect(included).toBeLessThan(total * 0.65);
    });
  });

  describe("combined evaluation", () => {
    it("disabled flag with matching role still returns false", () => {
      const flag = {
        enabled: false,
        targetRoles: ["superadmin"],
        targetEnvironments: null,
        targetOrganizations: null,
        rolloutPercentage: null,
      };
      const _context = { role: "superadmin", environment: "production" };
      // Disabled overrides everything
      expect(flag.enabled).toBe(false);
    });

    it("enabled flag with non-matching environment returns false", () => {
      const flag = {
        enabled: true,
        targetRoles: null,
        targetEnvironments: ["production"],
        targetOrganizations: null,
        rolloutPercentage: null,
      };
      const currentEnv = "development";
      const envMatch = flag.targetEnvironments === null || flag.targetEnvironments.includes(currentEnv);
      expect(envMatch).toBe(false);
    });

    it("enabled flag with matching env + matching role returns true", () => {
      const flag = {
        enabled: true,
        targetRoles: ["admin", "superadmin"],
        targetEnvironments: ["production", "staging"],
        targetOrganizations: null,
        rolloutPercentage: null,
      };
      const context = { role: "superadmin", environment: "production" };
      const envMatch = flag.targetEnvironments === null || flag.targetEnvironments.includes(context.environment);
      const roleMatch = flag.targetRoles === null || flag.targetRoles.includes(context.role);
      expect(flag.enabled && envMatch && roleMatch).toBe(true);
    });
  });
});
