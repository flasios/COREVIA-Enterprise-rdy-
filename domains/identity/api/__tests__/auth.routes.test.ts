/**
 * Auth Routes — Unit Tests
 *
 * Tests the identity authentication endpoints:
 *   - CSRF token generation
 *   - Session check
 *   - Registration (input validation, success, error propagation)
 *   - Login (credential variants, session establishment)
 *   - Logout (session destruction, cookie clear)
 *   - /me (authenticated profile, cached profile, unauthenticated)
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Mocks ────────────────────────────────────────────────────── */

const registerUserMock = vi.fn();
const loginUserMock = vi.fn();
const logoutUserMock = vi.fn();
const getCurrentUserMock = vi.fn();
const checkSessionMock = vi.fn();
const buildIdentityDepsMock = vi.fn(() => ({ deps: true }));
const establishMock = vi.fn();
const destroyMock = vi.fn();

vi.mock("../../application", () => ({
  registerUser: (...args: unknown[]) => registerUserMock(...args),
  loginUser: (...args: unknown[]) => loginUserMock(...args),
  logoutUser: (...args: unknown[]) => logoutUserMock(...args),
  getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
  checkSession: (...args: unknown[]) => checkSessionMock(...args),
  buildIdentityDeps: (...args: unknown[]) => buildIdentityDepsMock(...args),
  ExpressSessionManager: vi.fn().mockImplementation(() => ({
    establish: establishMock,
    destroy: destroyMock,
  })),
}));

vi.mock("@interfaces/middleware/rateLimiter", () => ({
  authLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  resetAuthAttemptLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@interfaces/middleware/validateBody", () => ({
  validateBody: (schema: { parse: (v: unknown) => unknown }) =>
    (req: { body: unknown }, _res: unknown, next: () => void) => {
      try {
        req.body = schema.parse(req.body);
        next();
      } catch {
        const res = _res as import("express").Response;
        res.status(400).json({ success: false, error: "Validation failed" });
      }
    },
}));

vi.mock("@platform/logging/ErrorHandler", () => ({
  asyncHandler: (fn: (...a: unknown[]) => unknown) => (req: unknown, res: unknown, next: unknown) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

const { createAuthRoutes } = await import("../auth.routes");

/* ── Test Helpers ─────────────────────────────────────────────── */

function createApp(session: Record<string, unknown> = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = {
      ...session,
      regenerate: vi.fn((cb: (e: null) => void) => cb(null)),
      save: vi.fn((cb: (e: null) => void) => cb(null)),
      destroy: vi.fn((cb: (e: null) => void) => cb(null)),
    } as unknown as typeof req.session;
    next();
  });
  app.use(createAuthRoutes({} as never));
  return app;
}

/* ── Tests ────────────────────────────────────────────────────── */

describe("auth.routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---------- CSRF Token ---------- */

  describe("GET /csrf-token", () => {
    it("returns the CSRF token from the session", async () => {
      const app = createApp({ csrfToken: "tok-abc" });
      const res = await request(app).get("/csrf-token");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, csrfToken: "tok-abc" });
    });

    it("returns null when no CSRF token exists", async () => {
      const app = createApp({});
      const res = await request(app).get("/csrf-token");
      expect(res.status).toBe(200);
      expect(res.body.csrfToken).toBeNull();
    });
  });

  /* ---------- Session Check ---------- */

  describe("GET /session-check", () => {
    it("returns authenticated status when session is valid", async () => {
      checkSessionMock.mockReturnValue({
        success: true,
        data: { userId: "u1", role: "analyst" },
      });
      const app = createApp({ userId: "u1" });
      const res = await request(app).get("/session-check");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        authenticated: true,
        userId: "u1",
        role: "analyst",
      });
    });

    it("returns 401 when session is invalid", async () => {
      checkSessionMock.mockReturnValue({ success: false });
      const app = createApp({});
      const res = await request(app).get("/session-check");
      expect(res.status).toBe(401);
      expect(res.body.authenticated).toBe(false);
    });
  });

  /* ---------- Register ---------- */

  describe("POST /register", () => {
    const validBody = {
      username: "newuser",
      email: "new@example.com",
      password: "SecureP@ss1",
      displayName: "New User",
    };

    it("creates user and establishes session on success", async () => {
      const userData = { id: "u1", username: "newuser", email: "new@example.com" };
      registerUserMock.mockResolvedValue({
        success: true,
        data: { ...userData, _sessionUser: { id: "u1", role: "analyst" } },
      });
      const app = createApp({});
      const res = await request(app).post("/register").send(validBody);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(userData);
      expect(establishMock).toHaveBeenCalledOnce();
    });

    it("returns error from use-case on failure", async () => {
      registerUserMock.mockResolvedValue({
        success: false,
        status: 409,
        error: "Username already exists",
      });
      const app = createApp({});
      const res = await request(app).post("/register").send(validBody);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Username already exists");
      expect(establishMock).not.toHaveBeenCalled();
    });

    it("rejects invalid registration body", async () => {
      const app = createApp({});
      const res = await request(app).post("/register").send({ username: "x" });
      expect(res.status).toBe(400);
    });
  });

  /* ---------- Login ---------- */

  describe("POST /login", () => {
    it("authenticates with email + password", async () => {
      const userData = { id: "u1", email: "user@example.com" };
      loginUserMock.mockResolvedValue({
        success: true,
        data: { ...userData, _sessionUser: { id: "u1", role: "analyst" } },
      });
      const app = createApp({});
      const res = await request(app)
        .post("/login")
        .send({ email: "user@example.com", password: "Pass1234" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(userData);
      expect(establishMock).toHaveBeenCalledOnce();
    });

    it("authenticates with username + password", async () => {
      loginUserMock.mockResolvedValue({
        success: true,
        data: { id: "u1", _sessionUser: { id: "u1", role: "analyst" } },
      });
      const app = createApp({});
      const res = await request(app)
        .post("/login")
        .send({ username: "testuser", password: "Pass1234" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("returns error on invalid credentials", async () => {
      loginUserMock.mockResolvedValue({
        success: false,
        status: 401,
        error: "Invalid credentials",
      });
      const app = createApp({});
      const res = await request(app)
        .post("/login")
        .send({ email: "user@example.com", password: "wrong" });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid credentials");
    });

    it("rejects when neither username nor email provided", async () => {
      const app = createApp({});
      const res = await request(app)
        .post("/login")
        .send({ password: "Pass1234" });
      expect(res.status).toBe(400);
    });
  });

  /* ---------- Logout ---------- */

  describe("POST /logout", () => {
    it("destroys session and clears cookie", async () => {
      logoutUserMock.mockResolvedValue(undefined);
      const app = createApp({ userId: "u1" });
      const res = await request(app).post("/logout");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(destroyMock).toHaveBeenCalledOnce();
    });
  });

  /* ---------- /me ---------- */

  describe("GET /me", () => {
    it("returns cached profile when it includes organization profile fields", async () => {
      const profile = {
        id: "u1",
        email: "user@example.com",
        role: "analyst",
        organizationName: "Corevia",
        organizationType: "government",
        departmentName: "Digital",
      };
      const app = createApp({ userId: "u1", userProfile: profile });
      const res = await request(app).get("/me");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(profile);
      expect(getCurrentUserMock).not.toHaveBeenCalled();
    });

    it("refreshes stale cached profiles that predate organization fields", async () => {
      const staleProfile = { id: "u1", email: "user@example.com", role: "analyst" };
      const refreshedProfile = {
        ...staleProfile,
        organizationName: "Corevia",
        organizationType: "government",
        departmentName: "Digital",
      };
      getCurrentUserMock.mockResolvedValue({ success: true, data: refreshedProfile });
      const app = createApp({ userId: "u1", userProfile: staleProfile });
      const res = await request(app).get("/me");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(refreshedProfile);
      expect(getCurrentUserMock).toHaveBeenCalledOnce();
    });

    it("fetches profile when not cached", async () => {
      const profile = { id: "u1", email: "user@example.com" };
      getCurrentUserMock.mockResolvedValue({ success: true, data: profile });
      const app = createApp({ userId: "u1" });
      const res = await request(app).get("/me");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(profile);
      expect(getCurrentUserMock).toHaveBeenCalledOnce();
    });

    it("returns 401 when not authenticated", async () => {
      const app = createApp({});
      const res = await request(app).get("/me");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Not authenticated");
    });

    it("forwards use-case errors", async () => {
      getCurrentUserMock.mockResolvedValue({
        success: false,
        status: 404,
        error: "User not found",
      });
      const app = createApp({ userId: "u1" });
      const res = await request(app).get("/me");
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("User not found");
    });
  });
});
