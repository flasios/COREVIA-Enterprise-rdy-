/**
 * Client utility tests — cn(), formatCurrency()
 */
import { describe, it, expect } from "vitest";
import { cn, formatCurrency } from "../utils";

describe("cn (class name merger)", () => {
  it("merges simple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("merges Tailwind classes correctly", () => {
    // twMerge should deduplicate conflicting utilities
    const result = cn("px-2 py-1", "px-4");
    expect(result).toContain("px-4");
    expect(result).not.toContain("px-2");
  });

  it("handles undefined and null", () => {
    expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });
});

describe("formatCurrency", () => {
  it("formats millions", () => {
    expect(formatCurrency(1500000)).toBe("AED 1.5M");
  });

  it("formats thousands", () => {
    expect(formatCurrency(50000)).toBe("AED 50K");
  });

  it("formats small amounts", () => {
    expect(formatCurrency(500)).toBe("AED 500");
  });

  it("uses custom currency", () => {
    expect(formatCurrency(2000000, "USD")).toBe("USD 2.0M");
  });

  it("formats exact million", () => {
    expect(formatCurrency(1000000)).toBe("AED 1.0M");
  });

  it("formats exact thousand", () => {
    expect(formatCurrency(1000)).toBe("AED 1K");
  });
});
