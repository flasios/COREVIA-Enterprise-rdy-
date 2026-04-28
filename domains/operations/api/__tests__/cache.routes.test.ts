/**
 * Cache Routes — Unit Tests
 *
 * Tests the admin-only cache management endpoints:
 *   - Auth + role enforcement (manager)
 *   - GET /stats, POST /clear
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Use-case mocks ───────────────────────────────────────────── */

const getCacheStatsMock = vi.fn();
const clearCacheMock = vi.fn();

vi.mock("../../application", () => ({
  getCacheStats: (...args: unknown[]) => getCacheStatsMock(...args),
  clearCache: (...args: unknown[]) => clearCacheMock(...args),
  buildCacheDeps: vi.fn(() => ({ deps: true })),
}));

const requireAuthMock = vi.fn((_req: unknown, _res: unknown, next: () => void) => next());
const requireRoleMock = vi.fn(
  () => (_req: unknown, _res: unknown, next: () => void) => next(),
);

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (req: unknown, res: unknown, next: () => void) =>
      requireAuthMock(req, res, next),
    requireRole: (...roles: string[]) => {
      const mw = requireRoleMock(...roles);
      return (req: unknown, res: unknown, next: () => void) => mw(req, res, next);
    },
  }),
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

const { createCacheRoutes } = await import("../cache.routes");

/* ── Helpers ──────────────────────────────────────────────────── */

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId: "u1" } as unknown as typeof req.session;
    next();
  });
  app.use(createCacheRoutes({} as never));
  return app;
}

const ok = (data: unknown = {}) => ({ success: true as const, data });
const fail = (status: number, error: string) => ({ success: false as const, status, error });

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockImplementation((_r: unknown, _s: unknown, n: () => void) => n());
  requireRoleMock.mockImplementation(
    () => (_r: unknown, _s: unknown, n: () => void) => n(),
  );
});

/* ── Tests ────────────────────────────────────────────────────── */

describe("Cache Routes", () => {
  describe("auth enforcement", () => {
    it("rejects unauthenticated GET /stats", async () => {
      requireAuthMock.mockImplementation((_r: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) =>
        res.status(401).json({ error: "Unauthorized" }),
      );
      await request(createApp()).get("/stats").expect(401);
    });

    it("rejects non-manager role on GET /stats", async () => {
      requireRoleMock.mockImplementation(
        () => (_r: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) =>
          res.status(403).json({ error: "Forbidden" }),
      );
      await request(createApp()).get("/stats").expect(403);
    });
  });

  describe("GET /stats", () => {
    it("returns cache statistics", async () => {
      getCacheStatsMock.mockResolvedValue(ok({ hits: 100, misses: 10 }));
      const res = await request(createApp()).get("/stats").expect(200);
      expect(res.body).toEqual(ok({ hits: 100, misses: 10 }));
    });
  });

  describe("POST /clear", () => {
    it("clears cache", async () => {
      clearCacheMock.mockResolvedValue(ok({ cleared: true }));
      const res = await request(createApp()).post("/clear").expect(200);
      expect(res.body).toEqual(ok({ cleared: true }));
    });

    it("forwards error", async () => {
      clearCacheMock.mockResolvedValue(fail(500, "Redis error"));
      await request(createApp()).post("/clear").expect(500);
    });
  });

  describe("role wiring", () => {
    it("requires manager role for GET /stats", async () => {
      getCacheStatsMock.mockResolvedValue(ok({}));
      await request(createApp()).get("/stats");
      expect(requireRoleMock).toHaveBeenCalledWith("manager");
    });

    it("requires manager role for POST /clear", async () => {
      clearCacheMock.mockResolvedValue(ok({}));
      await request(createApp()).post("/clear");
      expect(requireRoleMock).toHaveBeenCalledWith("manager");
    });
  });
});
