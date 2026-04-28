import { describe, it, expect } from "vitest";
import {
  money,
  addMoney,
  formatMoney,
  parseBudget,
  percentage,
  formatPercentage,
  semver,
  formatVersion,
  bumpVersion,
  dateRange,
  durationDays,
  isWithinRange,
  projectCode,
  formatProjectCode,
  parseProjectCode,
  emailAddress,
  isValidEmail,
} from "@shared/primitives/valueObjects";

describe("shared value objects", () => {
  describe("Money", () => {
    it("creates immutable money", () => {
      const m = money(100, "AED");
      expect(m.amount).toBe(100);
      expect(m.currency).toBe("AED");
      expect(Object.isFrozen(m)).toBe(true);
    });

    it("adds same currency", () => {
      const result = addMoney(money(100, "AED"), money(200, "AED"));
      expect(result.amount).toBe(300);
    });

    it("throws on currency mismatch", () => {
      expect(() => addMoney(money(100, "AED"), money(200, "USD"))).toThrow("currency mismatch");
    });

    it("formats money", () => {
      expect(formatMoney(money(1500000, "AED"))).toContain("AED");
      expect(formatMoney(money(1500000, "AED"))).toContain("1,500,000");
    });
  });

  describe("parseBudget", () => {
    it("parses string with currency", () => {
      const m = parseBudget("AED 1500000");
      expect(m.amount).toBe(1500000);
      expect(m.currency).toBe("AED");
    });

    it("parses M suffix", () => {
      const m = parseBudget("1.5M");
      expect(m.amount).toBe(1500000);
    });

    it("parses number directly", () => {
      const m = parseBudget(5000);
      expect(m.amount).toBe(5000);
    });

    it("handles null", () => {
      const m = parseBudget(null);
      expect(m.amount).toBe(0);
    });
  });

  describe("Percentage", () => {
    it("clamps to 0-100", () => {
      expect(percentage(150).value).toBe(100);
      expect(percentage(-10).value).toBe(0);
    });

    it("formats correctly", () => {
      expect(formatPercentage(percentage(75.5))).toBe("75.5%");
    });
  });

  describe("SemanticVersion", () => {
    it("creates version", () => {
      const v = semver(1, 2, 3);
      expect(formatVersion(v)).toBe("1.2.3");
    });

    it("bumps major", () => {
      expect(formatVersion(bumpVersion(semver(1, 2, 3), "major"))).toBe("2.0.0");
    });

    it("bumps minor", () => {
      expect(formatVersion(bumpVersion(semver(1, 2, 3), "minor"))).toBe("1.3.0");
    });

    it("bumps patch", () => {
      expect(formatVersion(bumpVersion(semver(1, 2, 3), "patch"))).toBe("1.2.4");
    });
  });

  describe("DateRange", () => {
    it("creates valid range", () => {
      const start = new Date("2024-01-01");
      const end = new Date("2024-12-31");
      const range = dateRange(start, end);
      expect(durationDays(range)).toBe(366);
    });

    it("throws for invalid range", () => {
      expect(() => dateRange(new Date("2024-12-31"), new Date("2024-01-01"))).toThrow();
    });

    it("checks within range", () => {
      const range = dateRange(new Date("2024-01-01"), new Date("2024-12-31"));
      expect(isWithinRange(new Date("2024-06-15"), range)).toBe(true);
      expect(isWithinRange(new Date("2025-01-01"), range)).toBe(false);
    });
  });

  describe("ProjectCode", () => {
    it("formats project code", () => {
      const code = projectCode("PRJ", 2024, 42);
      expect(formatProjectCode(code)).toBe("PRJ-2024-042");
    });

    it("parses project code", () => {
      const parsed = parseProjectCode("PRJ-2024-042");
      expect(parsed).toEqual({ prefix: "PRJ", year: 2024, sequence: 42 });
    });

    it("returns null for invalid code", () => {
      expect(parseProjectCode("invalid")).toBeNull();
    });
  });

  describe("EmailAddress", () => {
    it("creates valid email", () => {
      const email = emailAddress("Admin@Gov.AE");
      expect(email).toBe("admin@gov.ae");
    });

    it("throws for invalid email", () => {
      expect(() => emailAddress("not-an-email")).toThrow();
    });

    it("validates email", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
      expect(isValidEmail("bad")).toBe(false);
    });
  });
});
