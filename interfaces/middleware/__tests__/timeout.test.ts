/**
 * Request Timeout Middleware — Unit Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { requestTimeout, TIMEOUTS } from "../timeout";
import type { Request, Response, NextFunction } from "express";
import { EventEmitter } from "events";

function createReq(): Request {
  return {
    path: "/api/demands",
    method: "GET",
    session: {},
  } as unknown as Request;
}

function createRes(): Response & EventEmitter {
  const emitter = new EventEmitter();
  const res = Object.assign(emitter, {
    headersSent: false,
    statusCode: 200,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  });
  return res as unknown as Response & EventEmitter;
}

describe("requestTimeout", () => {
  let next: NextFunction;
  beforeEach(() => {
    next = vi.fn();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls next immediately", () => {
    const req = createReq();
    const res = createRes();
    requestTimeout(5000)(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("sends 504 after timeout", () => {
    const req = createReq();
    const res = createRes();
    requestTimeout(5000)(req, res, next);

    vi.advanceTimersByTime(5001);

    expect((req as unknown as { __requestTimedOut?: boolean }).__requestTimedOut).toBe(true);
    expect((res as unknown as { locals?: { requestTimedOut?: boolean } }).locals?.requestTimedOut).toBe(true);
    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, timeoutMs: 5000 }),
    );
  });

  it("clears timer on response finish", () => {
    const req = createReq();
    const res = createRes();
    requestTimeout(5000)(req, res, next);

    res.emit("finish");
    vi.advanceTimersByTime(10000);

    // Should NOT have called status since timer was cleared
    expect(res.status).not.toHaveBeenCalled();
  });

  it("clears timer on response close", () => {
    const req = createReq();
    const res = createRes();
    requestTimeout(5000)(req, res, next);

    res.emit("close");
    vi.advanceTimersByTime(10000);

    expect(res.status).not.toHaveBeenCalled();
  });

  it("does not send response if headers already sent", () => {
    const req = createReq();
    const res = createRes();
    requestTimeout(5000)(req, res, next);

    (res as unknown as { headersSent: boolean }).headersSent = true;
    vi.advanceTimersByTime(5001);

    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("TIMEOUTS constants", () => {
  it("defines standard timeouts", () => {
    expect(TIMEOUTS.DEFAULT).toBe(30_000);
    expect(TIMEOUTS.AI).toBe(120_000);
    expect(TIMEOUTS.BUSINESS_CASE).toBe(300_000);
    expect(TIMEOUTS.REQUIREMENTS).toBe(300_000);
    expect(TIMEOUTS.EXPORT).toBe(60_000);
    expect(TIMEOUTS.UPLOAD).toBe(45_000);
    expect(TIMEOUTS.HEALTH).toBe(5_000);
  });
});
