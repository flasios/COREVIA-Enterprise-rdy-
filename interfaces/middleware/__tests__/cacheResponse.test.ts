import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

const getMock = vi.fn();
const setMock = vi.fn();
const delMock = vi.fn();

vi.mock("@platform/cache", () => ({
  appCache: {
    get: getMock,
    set: setMock,
    del: delMock,
  },
}));

const { cacheResponse } = await import("../cacheResponse");

function createReq(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    originalUrl: "/api/dashboard",
    path: "/api/dashboard",
    headers: {},
    session: { userId: "user-1" },
    ...overrides,
  } as unknown as Request;
}

function createRes(): Response {
  return {
    statusCode: 200,
    setHeader: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe("cacheResponse", () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
    getMock.mockReturnValue(undefined);
  });

  it("keys per-org cache entries from tenant context before legacy session fields", () => {
    const req = createReq({
      session: {
        userId: "user-1",
        organizationId: "org-root",
        user: {
          id: "user-1",
          role: "member",
          organizationId: "org-user",
          departmentId: null,
        },
      },
      tenant: {
        organizationId: "org-tenant",
        userId: "user-1",
        userRole: "member",
        departmentId: null,
        isSystemAdmin: false,
      },
    });
    const res = createRes();

    cacheResponse({ ttlMs: 5000 })(req, res, next);
    res.json({ ok: true });

    expect(setMock).toHaveBeenCalledWith(
      "api:GET|/api/dashboard|u:user-1|o:org-tenant",
      { status: 200, body: { ok: true } },
      5000,
    );
  });

  it("falls back to session user organization when tenant context is absent", () => {
    const req = createReq({
      session: {
        userId: "user-1",
        organizationId: "org-root",
        user: {
          id: "user-1",
          role: "member",
          organizationId: "org-user",
          departmentId: null,
        },
      },
    });
    const res = createRes();

    cacheResponse({ ttlMs: 5000 })(req, res, next);
    res.json({ ok: true });

    expect(setMock).toHaveBeenCalledWith(
      "api:GET|/api/dashboard|u:user-1|o:org-user",
      { status: 200, body: { ok: true } },
      5000,
    );
  });
});