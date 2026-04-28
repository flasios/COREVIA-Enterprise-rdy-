/**
 * Response Validation Middleware — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import {
  validateResponse,
  createResponseSchema,
  apiSuccessEnvelope,
  apiErrorEnvelope,
} from "../responseValidation";
import type { Request, Response, NextFunction } from "express";

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    path: "/api/test",
    method: "GET",
    ...overrides,
  } as unknown as Request;
}

function createMockRes(statusCode = 200): Response & { _jsonBody: unknown } {
  const res = {
    statusCode,
    _jsonBody: null as unknown,
    setHeader: vi.fn(),
    json: vi.fn().mockImplementation(function (this: { _jsonBody: unknown }, body: unknown) {
      this._jsonBody = body;
      return this;
    }),
  };
  return res as unknown as Response & { _jsonBody: unknown };
}

describe("validateResponse", () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it("calls next without blocking on valid response", () => {
    const schema = z.object({ success: z.literal(true), data: z.string() });
    const req = createMockReq();
    const res = createMockRes(200);

    validateResponse(schema)(req, res, next);
    expect(next).toHaveBeenCalled();

    // Now simulate returning valid data
    res.json({ success: true, data: "hello" });
    expect(res._jsonBody).toEqual({ success: true, data: "hello" });
  });

  it("logs warning on invalid response but does not block", () => {
    const schema = z.object({ success: z.literal(true), data: z.number() });
    const req = createMockReq();
    const res = createMockRes(200);

    validateResponse(schema)(req, res, next);
    expect(next).toHaveBeenCalled();

    // Return data that doesn't match schema
    res.json({ success: true, data: "not-a-number" });
    // Response should still go through (not blocked)
    expect(res._jsonBody).toEqual({ success: true, data: "not-a-number" });
  });

  it("skips validation for non-2xx responses", () => {
    const schema = z.object({ data: z.number() });
    const req = createMockReq();
    const res = createMockRes(404);

    validateResponse(schema)(req, res, next);
    res.json({ error: "not found" });
    // No validation errors since it's 404
    expect(res._jsonBody).toEqual({ error: "not found" });
  });
});

describe("createResponseSchema", () => {
  it("wraps data schema in standard envelope", () => {
    const userSchema = z.object({ id: z.string(), name: z.string() });
    const responseSchema = createResponseSchema(userSchema);

    const valid = responseSchema.safeParse({
      success: true,
      data: { id: "1", name: "John" },
    });
    expect(valid.success).toBe(true);
  });

  it("rejects invalid data", () => {
    const userSchema = z.object({ id: z.string(), name: z.string() });
    const responseSchema = createResponseSchema(userSchema);

    const invalid = responseSchema.safeParse({
      success: true,
      data: { id: 123 }, // wrong type
    });
    expect(invalid.success).toBe(false);
  });
});

describe("Standard Envelopes", () => {
  it("apiSuccessEnvelope accepts valid success response", () => {
    const result = apiSuccessEnvelope.safeParse({
      success: true,
      data: [1, 2, 3],
      message: "OK",
      pagination: { page: 1, pageSize: 10, total: 100, totalPages: 10 },
    });
    expect(result.success).toBe(true);
  });

  it("apiErrorEnvelope accepts valid error response", () => {
    const result = apiErrorEnvelope.safeParse({
      success: false,
      error: "Something went wrong",
      statusCode: 500,
    });
    expect(result.success).toBe(true);
  });

  it("apiErrorEnvelope rejects success:true", () => {
    const result = apiErrorEnvelope.safeParse({
      success: true,
      error: "nope",
    });
    expect(result.success).toBe(false);
  });
});
