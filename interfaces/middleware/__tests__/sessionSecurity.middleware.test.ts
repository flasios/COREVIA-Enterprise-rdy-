import { afterEach, describe, expect, it, vi } from "vitest";
import {
  enforceSessionInactivity,
  resolveSessionCookieMaxAgeMs,
  resolveSessionInactivityTimeoutMs,
} from "../sessionSecurity";

const originalEnv = { ...process.env };

function createMockRes() {
  return {
    statusCode: 200,
    body: undefined as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("session security middleware", () => {
  it("uses secure production default cookie max age", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_MAX_AGE_MS;
    expect(resolveSessionCookieMaxAgeMs()).toBe(12 * 60 * 60 * 1000);
  });

  it("uses secure production default inactivity timeout", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_INACTIVITY_TIMEOUT_MS;
    expect(resolveSessionInactivityTimeoutMs()).toBe(30 * 60 * 1000);
  });

  it("expands custom durations when valid", () => {
    process.env.SESSION_MAX_AGE_MS = "7200000";
    process.env.SESSION_INACTIVITY_TIMEOUT_MS = "1200000";
    expect(resolveSessionCookieMaxAgeMs()).toBe(7_200_000);
    expect(resolveSessionInactivityTimeoutMs()).toBe(1_200_000);
  });

  it("rejects inactive authenticated sessions", () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_INACTIVITY_TIMEOUT_MS = "1000";
    const req: unknown = {
      session: {
        userId: "user-1",
        lastActivityAt: Date.now() - 5000,
        destroy: vi.fn((cb: () => void) => cb()),
      },
      ip: "127.0.0.1",
      path: "/api/private",
      method: "GET",
      correlationId: "cid-1",
    };
    const res = createMockRes();
    const next = vi.fn();

    enforceSessionInactivity(req, res as any, next); // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(next).not.toHaveBeenCalled();
    expect(req.session.destroy).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(401);
    expect(res.body?.error).toBe("Session expired due to inactivity");
  });

  it("refreshes activity for active authenticated sessions", () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_INACTIVITY_TIMEOUT_MS = "600000";
    const previous = Date.now() - 1000;
    const req: unknown = {
      session: {
        userId: "user-1",
        lastActivityAt: previous,
      },
    };
    const res = createMockRes();
    const next = vi.fn();

    enforceSessionInactivity(req, res as any, next); // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(next).toHaveBeenCalledTimes(1);
    expect(typeof req.session.lastActivityAt).toBe("number");
    expect(req.session.lastActivityAt).toBeGreaterThanOrEqual(previous);
  });
});
