/**
 * validateBody Middleware — Unit Tests
 *
 * Tests the Zod-based request body validation middleware
 * and the requireObjectBody helper.
 */
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { validateBody, requireObjectBody } from "../validateBody";
import { ValidationError } from "@platform/logging/ErrorHandler";

// ── Test helpers ──────────────────────────────────────────────────

function mockReq(body: unknown = {}) {
  return { body } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function mockRes() {
  return {} as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// ═══════════════════════════════════════════════════════════════════
//  validateBody
// ═══════════════════════════════════════════════════════════════════

describe("validateBody", () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  it("calls next on valid body", () => {
    const req = mockReq({ name: "Alice", age: 30 });
    const next = vi.fn();

    validateBody(schema)(req, mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.body).toEqual({ name: "Alice", age: 30 });
  });

  it("strips unknown keys from body", () => {
    const req = mockReq({ name: "Alice", age: 30, extra: true });
    const next = vi.fn();

    validateBody(schema)(req, mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.body).toEqual({ name: "Alice", age: 30 });
  });

  it("throws ValidationError on invalid body", () => {
    const req = mockReq({ name: "", age: -1 });
    const next = vi.fn();

    expect(() => validateBody(schema)(req, mockRes(), next)).toThrow(ValidationError);
    expect(next).not.toHaveBeenCalled();
  });

  it("includes error details in ValidationError", () => {
    const req = mockReq({ name: 123 });
    const next = vi.fn();

    try {
      validateBody(schema)(req, mockRes(), next);
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const ve = error as ValidationError;
      expect(ve.details).toBeDefined();
      const details = ve.details as Record<string, unknown>;
      expect(details.errors).toBeDefined();
      expect(Array.isArray(details.errors)).toBe(true);
    }
  });

  it("re-throws non-Zod errors", () => {
    const badSchema = {
      parse: () => { throw new Error("boom"); },
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const req = mockReq({});
    const next = vi.fn();

    expect(() => validateBody(badSchema)(req, mockRes(), next)).toThrow("boom");
  });
});

// ═══════════════════════════════════════════════════════════════════
//  requireObjectBody
// ═══════════════════════════════════════════════════════════════════

describe("requireObjectBody", () => {
  it("accepts a plain object", () => {
    const req = mockReq({ key: "value" });
    const next = vi.fn();

    requireObjectBody(req, mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("accepts an empty object", () => {
    const req = mockReq({});
    const next = vi.fn();

    requireObjectBody(req, mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("throws ValidationError for null body", () => {
    const req = mockReq(null);
    const next = vi.fn();

    expect(() => requireObjectBody(req, mockRes(), next)).toThrow(ValidationError);
  });

  it("throws ValidationError for string body", () => {
    const req = mockReq("not an object");
    const next = vi.fn();

    expect(() => requireObjectBody(req, mockRes(), next)).toThrow(ValidationError);
  });

  it("throws ValidationError for array body", () => {
    const req = mockReq([1, 2, 3]);
    const next = vi.fn();

    // z.record rejects arrays because they are not plain key-value objects
    expect(() => requireObjectBody(req, mockRes(), next)).toThrow(ValidationError);
  });
});
