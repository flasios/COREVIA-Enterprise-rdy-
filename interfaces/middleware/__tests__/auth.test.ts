import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requireAuth,
  requireRole,
  createRequirePermission,
  validateReportOwnership,
  createAuthMiddleware,
  createAuthMiddlewareWithOwnership,
  getAuthenticatedOrganizationId,
  type AuthRequest,
} from "../auth";
import type { Request, Response } from "express";

/* ---------- helpers ---------- */

function createMockReq(overrides: Record<string, unknown> = {}): Request {
  return {
    session: {},
    ...overrides,
  } as unknown as Request;
}

function createMockRes() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

/* ---------- getAuthenticatedOrganizationId ---------- */

describe("getAuthenticatedOrganizationId", () => {
  it("returns tenant organizationId when present", () => {
    const req = createMockReq({
      tenant: { organizationId: "org-tenant-1" },
      session: { user: { organizationId: "org-session-user" }, organizationId: "org-session" },
    });
    expect(getAuthenticatedOrganizationId(req)).toBe("org-tenant-1");
  });

  it("falls back to session.user.organizationId", () => {
    const req = createMockReq({
      session: { user: { organizationId: "org-session-user" }, organizationId: "org-session" },
    });
    expect(getAuthenticatedOrganizationId(req)).toBe("org-session-user");
  });

  it("falls back to session.organizationId", () => {
    const req = createMockReq({
      session: { organizationId: "org-session" },
    });
    expect(getAuthenticatedOrganizationId(req)).toBe("org-session");
  });

  it("returns undefined when no organizationId is available", () => {
    const req = createMockReq({ session: {} });
    expect(getAuthenticatedOrganizationId(req)).toBeUndefined();
  });

  it("ignores null/empty tenant organizationId", () => {
    const req = createMockReq({
      tenant: { organizationId: null },
      session: { organizationId: "org-session" },
    });
    expect(getAuthenticatedOrganizationId(req)).toBe("org-session");
  });
});

/* ---------- requireAuth ---------- */

describe("requireAuth", () => {
  it("calls next when session is authenticated", () => {
    const req = createMockReq({ session: { userId: "u1", role: "analyst" } });
    const res = createMockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as AuthRequest).auth?.userId).toBe("u1");
    expect((req as AuthRequest).auth?.role).toBe("analyst");
  });

  it("returns 401 when userId is missing", () => {
    const req = createMockReq({ session: { role: "analyst" } });
    const res = createMockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when role is missing", () => {
    const req = createMockReq({ session: { userId: "u1" } });
    const res = createMockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});

/* ---------- requireRole ---------- */

describe("requireRole", () => {
  it("allows matching role", () => {
    const middleware = requireRole("analyst", "manager");
    const req = createMockReq({ session: { userId: "u1", role: "analyst" } });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as AuthRequest).auth?.role).toBe("analyst");
  });

  it("returns 403 for non-matching role", () => {
    const middleware = requireRole("director");
    const req = createMockReq({ session: { userId: "u1", role: "analyst" } });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("allows super_admin to bypass role checks", () => {
    const middleware = requireRole("director");
    const req = createMockReq({ session: { userId: "u1", role: "super_admin" } });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when unauthenticated", () => {
    const middleware = requireRole("analyst");
    const req = createMockReq({ session: {} });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});

/* ---------- createRequirePermission ---------- */

describe("createRequirePermission", () => {
  const mockStorage = {
    getUser: vi.fn(),
  };

  afterEach(() => {
    mockStorage.getUser.mockReset();
  });

  it("allows when user has required permissions", async () => {
    mockStorage.getUser.mockResolvedValue({
      id: "u1",
      role: "manager",
      customPermissions: null,
    });

    const requirePermission = createRequirePermission(mockStorage);
    const middleware = requirePermission("report:read");
    const req = createMockReq({ session: { userId: "u1", role: "manager" } });
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as AuthRequest).auth?.userId).toBe("u1");
    expect((req as AuthRequest).user?.id).toBe("u1");
  });

  it("returns 403 when user lacks permissions", async () => {
    mockStorage.getUser.mockResolvedValue({
      id: "u1",
      role: "analyst",
      customPermissions: { denied: ["report:delete"] },
    });

    const requirePermission = createRequirePermission(mockStorage);
    // analyst doesn't have report:delete by default
    const middleware = requirePermission("report:delete");
    const req = createMockReq({ session: { userId: "u1", role: "analyst" } });
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 when user not found in storage", async () => {
    mockStorage.getUser.mockResolvedValue(null);

    const requirePermission = createRequirePermission(mockStorage);
    const middleware = requirePermission("report:read");
    const req = createMockReq({ session: { userId: "u-missing", role: "analyst" } });
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when no session", async () => {
    const requirePermission = createRequirePermission(mockStorage);
    const middleware = requirePermission("report:read");
    const req = createMockReq({ session: {} });
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("returns 500 when storage throws", async () => {
    mockStorage.getUser.mockRejectedValue(new Error("DB down"));

    const requirePermission = createRequirePermission(mockStorage);
    const middleware = requirePermission("report:read");
    const req = createMockReq({ session: { userId: "u1", role: "analyst" } });
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
  });
});

/* ---------- validateReportOwnership ---------- */

describe("validateReportOwnership", () => {
  const mockStorage = {
    getUser: vi.fn(),
    getDemandReport: vi.fn(),
  };

  afterEach(() => {
    mockStorage.getUser.mockReset();
    mockStorage.getDemandReport.mockReset();
  });

  it("returns true for users with update-any permission", async () => {
    const result = await validateReportOwnership("r1", "u1", "director", mockStorage);
    expect(result).toBe(true);
    expect(mockStorage.getDemandReport).not.toHaveBeenCalled();
  });

  it("returns true when user owns the report and has update-self", async () => {
    mockStorage.getDemandReport.mockResolvedValue({ createdBy: "u1" });

    const result = await validateReportOwnership("r1", "u1", "analyst", mockStorage);
    expect(result).toBe(true);
  });

  it("returns false when user does not own the report", async () => {
    mockStorage.getDemandReport.mockResolvedValue({ createdBy: "other-user" });

    const result = await validateReportOwnership("r1", "u1", "analyst", mockStorage);
    expect(result).toBe(false);
  });

  it("returns false when report not found", async () => {
    mockStorage.getDemandReport.mockResolvedValue(null);

    const result = await validateReportOwnership("r-missing", "u1", "analyst", mockStorage);
    expect(result).toBe(false);
  });
});

/* ---------- createAuthMiddleware factories ---------- */

describe("createAuthMiddleware", () => {
  it("returns an object with requireAuth, requireRole, requirePermission", () => {
    const storage = { getUser: vi.fn() };
    const middleware = createAuthMiddleware(storage);

    expect(middleware).toHaveProperty("requireAuth");
    expect(middleware).toHaveProperty("requireRole");
    expect(middleware).toHaveProperty("requirePermission");
    expect(typeof middleware.requirePermission).toBe("function");
  });
});

describe("createAuthMiddlewareWithOwnership", () => {
  it("returns an object that also includes validateReportOwnership", () => {
    const storage = { getUser: vi.fn(), getDemandReport: vi.fn() };
    const middleware = createAuthMiddlewareWithOwnership(storage);

    expect(middleware).toHaveProperty("requireAuth");
    expect(middleware).toHaveProperty("requireRole");
    expect(middleware).toHaveProperty("requirePermission");
    expect(middleware).toHaveProperty("validateReportOwnership");
    expect(typeof middleware.validateReportOwnership).toBe("function");
  });
});
