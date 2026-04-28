import { describe, it, expect } from "vitest";
import {
  isSelfRegistrationAllowed,
  sanitizeUser,
  validatePasswordStrength,
  shouldLockAccount,
  isLockExpired,
  isEmailValid,
  canManageUsers,
  canAssignRole,
} from "../domain";
import type { UserRecord } from "../domain";

describe("identity domain", () => {
  describe("sanitizeUser", () => {
    it("removes password from user record", () => {
      const user: UserRecord = {
        id: "1",
        username: "admin",
        email: "admin@gov.ae",
        password: "secret123",
        displayName: "Admin",
        role: "super_admin",
      };
      const sanitized = sanitizeUser(user);
      expect(sanitized.id).toBe("1");
      expect(sanitized.email).toBe("admin@gov.ae");
      expect((sanitized as Record<string, unknown>).password).toBeUndefined();
    });
  });

  describe("validatePasswordStrength", () => {
    it("valid strong password", () => {
      const result = validatePasswordStrength("Str0ng!Pass");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("fails for short password", () => {
      const result = validatePasswordStrength("Ab1!");
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("Minimum"))).toBe(true);
    });

    it("fails for no uppercase", () => {
      const result = validatePasswordStrength("str0ng!pass");
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("uppercase"))).toBe(true);
    });

    it("fails for no digit", () => {
      const result = validatePasswordStrength("Strong!Pass");
      expect(result.valid).toBe(false);
    });

    it("fails for no special char", () => {
      const result = validatePasswordStrength("Str0ngPass1");
      expect(result.valid).toBe(false);
    });
  });

  describe("shouldLockAccount", () => {
    it("true for 5+ failed attempts", () => {
      expect(shouldLockAccount(5)).toBe(true);
    });

    it("false for fewer attempts", () => {
      expect(shouldLockAccount(3)).toBe(false);
    });
  });

  describe("isLockExpired", () => {
    it("false for recent lock", () => {
      expect(isLockExpired(new Date())).toBe(false);
    });

    it("true for old lock", () => {
      const old = new Date(Date.now() - 31 * 60 * 1000);
      expect(isLockExpired(old)).toBe(true);
    });
  });

  describe("isEmailValid", () => {
    it("valid email", () => {
      expect(isEmailValid("user@gov.ae")).toBe(true);
    });

    it("invalid email", () => {
      expect(isEmailValid("not-an-email")).toBe(false);
    });
  });

  describe("canManageUsers", () => {
    it("super_admin can manage", () => {
      expect(canManageUsers("super_admin")).toBe(true);
    });

    it("member cannot manage", () => {
      expect(canManageUsers("member")).toBe(false);
    });
  });

  describe("canAssignRole", () => {
    it("super_admin can assign any role", () => {
      expect(canAssignRole("super_admin", "super_admin")).toBe(true);
    });

    it("director can assign PM", () => {
      expect(canAssignRole("director", "project_manager")).toBe(true);
    });

    it("PM cannot assign director", () => {
      expect(canAssignRole("project_manager", "director")).toBe(false);
    });
  });

  describe("isSelfRegistrationAllowed", () => {
    it("returns a boolean", () => {
      expect(typeof isSelfRegistrationAllowed()).toBe("boolean");
    });
  });
});
