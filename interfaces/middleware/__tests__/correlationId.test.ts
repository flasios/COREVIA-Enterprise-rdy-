/**
 * Correlation ID Middleware — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { correlationIdMiddleware } from "../correlationId";
import type { Request, Response, NextFunction } from "express";

function createReq(overrides: Partial<Request> = {}): Request {
  return {
    path: "/api/demands",
    method: "GET",
    headers: {},
    session: {},
    ...overrides,
  } as unknown as Request;
}

function createRes(): Response {
  return {
    setHeader: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe("correlationIdMiddleware", () => {
  let next: NextFunction;
  beforeEach(() => { next = vi.fn(); });

  it("generates a correlation ID when none provided", () => {
    const req = createReq();
    const res = createRes();
    correlationIdMiddleware(req, res, next);

    expect(req.correlationId).toBeDefined();
    expect(typeof req.correlationId).toBe("string");
    expect(req.correlationId!.length).toBeGreaterThan(0);
    expect(next).toHaveBeenCalled();
  });

  it("uses incoming X-Correlation-ID header", () => {
    const req = createReq({ headers: { "x-correlation-id": "test-corr-123" } });
    const res = createRes();
    correlationIdMiddleware(req, res, next);

    expect(req.correlationId).toBe("test-corr-123");
    expect(next).toHaveBeenCalled();
  });

  it("sets X-Correlation-ID and X-Request-ID response headers", () => {
    const req = createReq();
    const res = createRes();
    correlationIdMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-Correlation-ID", expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", expect.any(String));
    expect(next).toHaveBeenCalled();
  });

  it("calls next within request context", () => {
    const req = createReq();
    const res = createRes();
    correlationIdMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
