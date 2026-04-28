import { afterEach, describe, expect, it, vi } from "vitest";

function createMockRes() {
  return {
    statusCode: 200,
    body: undefined as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    cookie: vi.fn(),
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

async function loadCsrfModule() {
  vi.resetModules();
  return import("../csrf");
}

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("csrf middleware", () => {
  it("allows safe methods without token", async () => {
    process.env.NODE_ENV = "production";
    process.env.CSRF_STRICT_MODE = "true";
    const { requireCsrfProtection } = await loadCsrfModule();
    const next = vi.fn();
    const req: unknown = {
      method: "GET",
      path: "/api/anything",
      get: () => undefined,
      session: {},
    };
    const res = createMockRes();

    requireCsrfProtection(req, res as any, next); // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it("rejects authenticated unsafe requests when csrf token is missing", async () => {
    process.env.NODE_ENV = "production";
    process.env.CSRF_STRICT_MODE = "true";
    const { requireCsrfProtection } = await loadCsrfModule();
    const next = vi.fn();
    const req: unknown = {
      method: "POST",
      path: "/api/resource",
      ip: "127.0.0.1",
      correlationId: "cid-1",
      get: () => undefined,
      session: {
        userId: "user-1",
        csrfToken: "abc123",
      },
    };
    const res = createMockRes();

    requireCsrfProtection(req, res as any, next); // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body?.error).toBe("CSRF validation failed");
  });

  it("allows authenticated unsafe requests with matching csrf token", async () => {
    process.env.NODE_ENV = "production";
    process.env.CSRF_STRICT_MODE = "true";
    const { requireCsrfProtection } = await loadCsrfModule();
    const next = vi.fn();
    const req: unknown = {
      method: "PATCH",
      path: "/api/resource",
      get: (header: string) =>
        header.toLowerCase() === "x-csrf-token" ? "abc123" : undefined,
      session: {
        userId: "user-1",
        csrfToken: "abc123",
      },
    };
    const res = createMockRes();

    requireCsrfProtection(req, res as any, next); // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it("rejects unauthenticated auth mutations from untrusted origin in strict mode", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOWED_ORIGINS = "https://portal.gov.ae";
    process.env.CSRF_STRICT_MODE = "true";
    process.env.CSRF_ENFORCE_AUTH_ORIGIN = "true";
    const { requireCsrfProtection } = await loadCsrfModule();
    const next = vi.fn();
    const req: unknown = {
      method: "POST",
      path: "/api/auth/login",
      ip: "127.0.0.1",
      protocol: "https",
      correlationId: "cid-2",
      get: (header: string) => {
        const key = header.toLowerCase();
        if (key === "origin") return "https://evil.example";
        if (key === "host") return "portal.gov.ae";
        return undefined;
      },
      session: {},
    };
    const res = createMockRes();

    requireCsrfProtection(req, res as any, next); // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body?.error).toBe("CSRF origin validation failed");
  });

  it("sets csrf cookie and session token when attaching token", async () => {
    process.env.NODE_ENV = "production";
    const { attachCsrfToken } = await loadCsrfModule();
    const next = vi.fn();
    const req: unknown = { session: {} };
    const res = createMockRes();

    attachCsrfToken(req, res as any, next); // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(typeof req.session.csrfToken).toBe("string");
    expect(req.session.csrfToken).toHaveLength(64);
    expect(res.cookie).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
