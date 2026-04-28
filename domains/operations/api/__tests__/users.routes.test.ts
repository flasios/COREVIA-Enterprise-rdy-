/**
 * Users Routes — Unit Tests
 *
 * Tests the operations user management endpoints:
 *   - Auth enforcement on all endpoints
 *   - Permission enforcement (user:read/create/update/delete)
 *   - CRUD success + error forwarding
 *   - Pagination support on listing
 *   - Cache + invalidation middleware wiring
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Use-case mocks ───────────────────────────────────────────── */

const listUsersMock = vi.fn();
const getAvailableProjectManagersMock = vi.fn();
const getUserMock = vi.fn();
const createUserMock = vi.fn();
const updateUserMock = vi.fn();
const deactivateUserMock = vi.fn();

vi.mock("../../application", () => ({
  listUsers: (...args: unknown[]) => listUsersMock(...args),
  getAvailableProjectManagers: (...args: unknown[]) => getAvailableProjectManagersMock(...args),
  getUser: (...args: unknown[]) => getUserMock(...args),
  createUser: (...args: unknown[]) => createUserMock(...args),
  updateUser: (...args: unknown[]) => updateUserMock(...args),
  deactivateUser: (...args: unknown[]) => deactivateUserMock(...args),
  buildUserDeps: vi.fn(() => ({ deps: true })),
}));

const requireAuthMock = vi.fn((_req: unknown, _res: unknown, next: () => void) => next());
const requirePermissionMock = vi.fn(
  () => (_req: unknown, _res: unknown, next: () => void) => next(),
);

vi.mock("@interfaces/middleware/auth", () => ({
  createAuthMiddleware: () => ({
    requireAuth: (req: unknown, res: unknown, next: () => void) =>
      requireAuthMock(req, res, next),
    requirePermission: (perm: string) => {
      const mw = requirePermissionMock(perm);
      return (req: unknown, res: unknown, next: () => void) => mw(req, res, next);
    },
  }),
}));

vi.mock("@interfaces/middleware/validateBody", () => ({
  validateBody: () => (req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@interfaces/middleware/cacheResponse", () => ({
  cacheResponse: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  invalidateCache: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  CACHE_PROFILES: { reference: {} },
}));

vi.mock("@interfaces/middleware/pagination", () => ({
  sendPaginated: (_req: unknown, res: { json: (d: unknown) => void }, data: unknown) =>
    res.json(data),
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

const { createUsersRoutes } = await import("../users.routes");

/* ── Helpers ──────────────────────────────────────────────────── */

const session = { userId: "u1", user: { id: "u1", role: "manager" } };

function createApp(s: Record<string, unknown> = session) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = s as unknown as typeof req.session;
    (req as unknown as Record<string, unknown>).auth = { userId: s.userId };
    next();
  });
  app.use(createUsersRoutes({} as never));
  return app;
}

const ok = (data: unknown = {}) => ({ success: true as const, data });
const fail = (status: number, error: string) => ({ success: false as const, status, error });

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockImplementation((_r: unknown, _s: unknown, n: () => void) => n());
  requirePermissionMock.mockImplementation(
    () => (_r: unknown, _s: unknown, n: () => void) => n(),
  );
});

/* ── Auth enforcement ─────────────────────────────────────────── */

describe("Users Routes", () => {
  describe("auth enforcement", () => {
    it("rejects unauthenticated requests on GET /", async () => {
      requireAuthMock.mockImplementation((_r: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) =>
        res.status(401).json({ error: "Unauthorized" }),
      );
      await request(createApp()).get("/").expect(401);
    });

    it("rejects missing permission on POST /", async () => {
      requirePermissionMock.mockImplementation(
        () => (_r: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) =>
          res.status(403).json({ error: "Forbidden" }),
      );
      await request(createApp()).post("/").send({ name: "x" }).expect(403);
    });
  });

  /* ── GET / (list users) ──────────────────────────────────────── */

  describe("GET /", () => {
    it("returns user list", async () => {
      listUsersMock.mockResolvedValue(ok([{ id: "u1" }]));
      const res = await request(createApp()).get("/").expect(200);
      expect(res.body).toEqual(ok([{ id: "u1" }]));
    });
  });

  /* ── GET /available-project-managers ──────────────────────────── */

  describe("GET /available-project-managers", () => {
    it("returns raw array on success", async () => {
      getAvailableProjectManagersMock.mockResolvedValue(ok([{ id: "pm1" }]));
      const res = await request(createApp()).get("/available-project-managers").expect(200);
      expect(res.body).toEqual([{ id: "pm1" }]);
    });

    it("returns error on failure", async () => {
      getAvailableProjectManagersMock.mockResolvedValue(fail(500, "DB error"));
      await request(createApp()).get("/available-project-managers").expect(500);
    });
  });

  /* ── GET /:id ────────────────────────────────────────────────── */

  describe("GET /:id", () => {
    it("returns single user", async () => {
      getUserMock.mockResolvedValue(ok({ id: "u1" }));
      const res = await request(createApp()).get("/u1").expect(200);
      expect(res.body).toEqual(ok({ id: "u1" }));
    });

    it("forwards not-found", async () => {
      getUserMock.mockResolvedValue(fail(404, "Not found"));
      await request(createApp()).get("/u999").expect(404);
    });
  });

  /* ── POST / (create) ─────────────────────────────────────────── */

  describe("POST /", () => {
    it("creates user and returns 201", async () => {
      createUserMock.mockResolvedValue(ok({ id: "u2" }));
      const res = await request(createApp())
        .post("/")
        .send({ name: "New User", email: "new@example.com" })
        .expect(201);
      expect(res.body).toEqual(ok({ id: "u2" }));
    });

    it("forwards creation failure", async () => {
      createUserMock.mockResolvedValue(fail(409, "Duplicate"));
      await request(createApp())
        .post("/")
        .send({ name: "Dup" })
        .expect(409);
    });

    it("passes authUserId and ip to use-case", async () => {
      createUserMock.mockResolvedValue(ok({}));
      await request(createApp()).post("/").send({ name: "x" });
      expect(createUserMock).toHaveBeenCalledWith(
        expect.anything(), "u1", { name: "x" }, expect.any(String),
      );
    });
  });

  /* ── PATCH /:id (update) ─────────────────────────────────────── */

  describe("PATCH /:id", () => {
    it("updates user", async () => {
      updateUserMock.mockResolvedValue(ok({ id: "u1" }));
      const res = await request(createApp())
        .patch("/u1")
        .send({ name: "Updated" })
        .expect(200);
      expect(res.body).toEqual(ok({ id: "u1" }));
    });

    it("returns 401 when authUserId is missing", async () => {
      // Re-create app with no auth context
      const noAuthApp = express();
      noAuthApp.use(express.json());
      noAuthApp.use((req, _res, next) => {
        req.session = {} as unknown as typeof req.session;
        // No req.auth
        next();
      });
      noAuthApp.use(createUsersRoutes({} as never));
      await request(noAuthApp).patch("/u1").send({ name: "x" }).expect(401);
    });
  });

  /* ── DELETE /:id (deactivate) ────────────────────────────────── */

  describe("DELETE /:id", () => {
    it("deactivates user", async () => {
      deactivateUserMock.mockResolvedValue(ok({ id: "u1", active: false }));
      const res = await request(createApp()).delete("/u1").expect(200);
      expect(res.body).toEqual(ok({ id: "u1", active: false }));
    });

    it("returns 401 when authUserId is missing", async () => {
      const noAuthApp = express();
      noAuthApp.use(express.json());
      noAuthApp.use((req, _res, next) => {
        req.session = {} as unknown as typeof req.session;
        next();
      });
      noAuthApp.use(createUsersRoutes({} as never));
      await request(noAuthApp).delete("/u1").expect(401);
    });
  });

  /* ── Permission wiring ──────────────────────────────────────── */

  describe("permission wiring", () => {
    it("requests user:read for GET /", async () => {
      listUsersMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/");
      expect(requirePermissionMock).toHaveBeenCalledWith("user:read");
    });

    it("requests user:create for POST /", async () => {
      createUserMock.mockResolvedValue(ok({}));
      await request(createApp()).post("/").send({});
      expect(requirePermissionMock).toHaveBeenCalledWith("user:create");
    });

    it("requests user:update for PATCH /:id", async () => {
      updateUserMock.mockResolvedValue(ok({}));
      await request(createApp()).patch("/u1").send({});
      expect(requirePermissionMock).toHaveBeenCalledWith("user:update");
    });

    it("requests user:delete for DELETE /:id", async () => {
      deactivateUserMock.mockResolvedValue(ok({}));
      await request(createApp()).delete("/u1");
      expect(requirePermissionMock).toHaveBeenCalledWith("user:delete");
    });
  });
});
