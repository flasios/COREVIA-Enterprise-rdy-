/**
 * Teams Routes — Unit Tests
 *
 * Tests the operations team management endpoints:
 *   - Auth enforcement on all endpoints
 *   - Permission enforcement (team:view-members/create/update/delete/manage)
 *   - CRUD success + error forwarding for teams and members
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Use-case mocks ───────────────────────────────────────────── */

const listTeamsMock = vi.fn();
const createTeamMock = vi.fn();
const updateTeamMock = vi.fn();
const deleteTeamMock = vi.fn();
const getTeamMembersMock = vi.fn();
const addTeamMemberMock = vi.fn();
const removeTeamMemberMock = vi.fn();

vi.mock("../../application", () => ({
  listTeams: (...args: unknown[]) => listTeamsMock(...args),
  createTeam: (...args: unknown[]) => createTeamMock(...args),
  updateTeam: (...args: unknown[]) => updateTeamMock(...args),
  deleteTeam: (...args: unknown[]) => deleteTeamMock(...args),
  getTeamMembers: (...args: unknown[]) => getTeamMembersMock(...args),
  addTeamMember: (...args: unknown[]) => addTeamMemberMock(...args),
  removeTeamMember: (...args: unknown[]) => removeTeamMemberMock(...args),
  buildTeamDeps: vi.fn(() => ({ deps: true })),
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

const { createTeamsRoutes } = await import("../teams.routes");

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
  app.use(createTeamsRoutes({} as never));
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

/* ── Tests ────────────────────────────────────────────────────── */

describe("Teams Routes", () => {
  describe("auth enforcement", () => {
    it("rejects unauthenticated GET /", async () => {
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

  /* ── GET / (list teams) ──────────────────────────────────────── */

  describe("GET /", () => {
    it("returns team list", async () => {
      listTeamsMock.mockResolvedValue(ok([{ id: "t1" }]));
      const res = await request(createApp()).get("/").expect(200);
      expect(res.body).toEqual(ok([{ id: "t1" }]));
    });
  });

  /* ── POST / (create team) ────────────────────────────────────── */

  describe("POST /", () => {
    it("creates team", async () => {
      createTeamMock.mockResolvedValue(ok({ id: "t2" }));
      const res = await request(createApp()).post("/").send({ name: "Team A" }).expect(200);
      expect(res.body).toEqual(ok({ id: "t2" }));
    });

    it("forwards creation failure", async () => {
      createTeamMock.mockResolvedValue(fail(409, "Duplicate"));
      await request(createApp()).post("/").send({ name: "Dup" }).expect(409);
    });
  });

  /* ── PATCH /:id (update team) ────────────────────────────────── */

  describe("PATCH /:id", () => {
    it("updates team", async () => {
      updateTeamMock.mockResolvedValue(ok({ id: "t1", name: "Updated" }));
      const res = await request(createApp()).patch("/t1").send({ name: "Updated" }).expect(200);
      expect(res.body).toEqual(ok({ id: "t1", name: "Updated" }));
    });
  });

  /* ── DELETE /:id ─────────────────────────────────────────────── */

  describe("DELETE /:id", () => {
    it("deletes team", async () => {
      deleteTeamMock.mockResolvedValue(ok({ id: "t1" }));
      const res = await request(createApp()).delete("/t1").expect(200);
      expect(res.body).toEqual(ok({ id: "t1" }));
    });
  });

  /* ── GET /:id/members ────────────────────────────────────────── */

  describe("GET /:id/members", () => {
    it("returns team members", async () => {
      getTeamMembersMock.mockResolvedValue(ok([{ userId: "u2" }]));
      const res = await request(createApp()).get("/t1/members").expect(200);
      expect(res.body).toEqual(ok([{ userId: "u2" }]));
    });
  });

  /* ── POST /:id/members ───────────────────────────────────────── */

  describe("POST /:id/members", () => {
    it("adds team member", async () => {
      addTeamMemberMock.mockResolvedValue(ok({ teamId: "t1", userId: "u2" }));
      const res = await request(createApp())
        .post("/t1/members")
        .send({ userId: "u2", role: "member" })
        .expect(200);
      expect(res.body).toEqual(ok({ teamId: "t1", userId: "u2" }));
    });
  });

  /* ── DELETE /:id/members/:userId ─────────────────────────────── */

  describe("DELETE /:id/members/:userId", () => {
    it("removes team member", async () => {
      removeTeamMemberMock.mockResolvedValue(ok({ removed: true }));
      const res = await request(createApp()).delete("/t1/members/u2").expect(200);
      expect(res.body).toEqual(ok({ removed: true }));
    });
  });

  /* ── Permission wiring ──────────────────────────────────────── */

  describe("permission wiring", () => {
    it("requires team:view-members for GET /", async () => {
      listTeamsMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/");
      expect(requirePermissionMock).toHaveBeenCalledWith("team:view-members");
    });

    it("requires team:create for POST /", async () => {
      createTeamMock.mockResolvedValue(ok({}));
      await request(createApp()).post("/").send({});
      expect(requirePermissionMock).toHaveBeenCalledWith("team:create");
    });

    it("requires team:update for PATCH /:id", async () => {
      updateTeamMock.mockResolvedValue(ok({}));
      await request(createApp()).patch("/t1").send({});
      expect(requirePermissionMock).toHaveBeenCalledWith("team:update");
    });

    it("requires team:delete for DELETE /:id", async () => {
      deleteTeamMock.mockResolvedValue(ok({}));
      await request(createApp()).delete("/t1");
      expect(requirePermissionMock).toHaveBeenCalledWith("team:delete");
    });

    it("requires team:view-members for GET /:id/members", async () => {
      getTeamMembersMock.mockResolvedValue(ok([]));
      await request(createApp()).get("/t1/members");
      expect(requirePermissionMock).toHaveBeenCalledWith("team:view-members");
    });

    it("requires team:manage for POST /:id/members", async () => {
      addTeamMemberMock.mockResolvedValue(ok({}));
      await request(createApp()).post("/t1/members").send({});
      expect(requirePermissionMock).toHaveBeenCalledWith("team:manage");
    });

    it("requires team:manage for DELETE /:id/members/:userId", async () => {
      removeTeamMemberMock.mockResolvedValue(ok({}));
      await request(createApp()).delete("/t1/members/u2");
      expect(requirePermissionMock).toHaveBeenCalledWith("team:manage");
    });
  });
});
