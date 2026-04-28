import { Router } from "express";
import { z } from "zod";
import type { IdentityStorageSlice } from "../application/buildDeps";
import { authLimiter, resetAuthAttemptLimit } from "@interfaces/middleware/rateLimiter";

// Application layer use-cases + wiring
import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  checkSession,
  buildIdentityDeps,
  ExpressSessionManager,
  type IdentityDeps,
} from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";

// ── Input Schemas ───────────────────────────────────────────────────────────

const loginSchema = z.object({
  username: z.string().min(1).max(128).trim().optional(),
  email: z.string().email("Invalid email format").max(256).trim().toLowerCase().optional(),
  password: z.string().min(1, "Password is required").max(256),
}).refine(data => data.username || data.email, {
  message: "Either username or email is required",
});

const registerSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(64, "Username must be at most 64 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username may only contain letters, numbers, dots, hyphens, and underscores")
    .trim(),
  email: z.string().email("Invalid email format").max(256).trim().toLowerCase(),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(256, "Password must be at most 256 characters"),
  displayName: z.string()
    .min(2, "Display name must be at least 2 characters")
    .max(128, "Display name must be at most 128 characters")
    .trim(),
  department: z.string().max(128).optional(),
});

function buildDeps(storage: IdentityStorageSlice, req: import("express").Request): IdentityDeps {
  return buildIdentityDeps(storage, req);
}

export function createAuthRoutes(storage: IdentityStorageSlice): Router {
  const router = Router();
  const sessionMgr = new ExpressSessionManager();

  router.get("/csrf-token", (req, res) => {
    res.json({
      success: true,
      csrfToken: req.session.csrfToken || null,
    });
  });

  router.get("/session-check", (req, res) => {
    const deps = buildDeps(storage, req);
    const result = checkSession(deps, req);
    if (!result.success) {
      return res.status(401).json({ success: false, authenticated: false });
    }
    return res.json({
      success: true,
      authenticated: true,
      userId: result.data.userId,
      role: result.data.role,
    });
  });

  router.post("/register", authLimiter, validateBody(registerSchema), asyncHandler(async (req, res) => {

    const deps = buildDeps(storage, req);
    const result = await registerUser(deps, req.body);

    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        error: result.error,
        ...(result.details ? { details: result.details } : {}),
      });
    }

    const { _sessionUser, ...userData } = result.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    await sessionMgr.establish(req, _sessionUser);
    await resetAuthAttemptLimit(req);

    res.status(201).json({ success: true, data: userData });
  }));

  router.post("/login", authLimiter, validateBody(loginSchema), asyncHandler(async (req, res) => {

    const deps = buildDeps(storage, req);
    const result = await loginUser(deps, req.body);

    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        error: result.error,
        ...(result.details ? { details: result.details } : {}),
      });
    }

    const { _sessionUser, ...userData } = result.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    await sessionMgr.establish(req, _sessionUser);
    await resetAuthAttemptLimit(req);

    res.json({ success: true, data: userData });
  }));

  router.post("/logout", asyncHandler(async (req, res) => {
    const deps = buildDeps(storage, req);
    const userId = req.session.userId;
    await logoutUser(deps, userId);

    await sessionMgr.destroy(req);
    res.clearCookie(process.env.SESSION_COOKIE_NAME || "corevia.sid");
    res.json({ success: true, message: "Logged out successfully" });
  }));

  router.get("/me", asyncHandler(async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }

    const sessionProfile = req.session.userProfile;
    const hasProfileValue = (key: string) => {
      const value = sessionProfile?.[key as keyof typeof sessionProfile];
      return typeof value === "string" && value.trim().length > 0;
    };
    const hasCurrentOrgProfile =
      sessionProfile &&
      sessionProfile.id === req.session.userId &&
      Object.prototype.hasOwnProperty.call(sessionProfile, "organizationName") &&
      Object.prototype.hasOwnProperty.call(sessionProfile, "organizationType") &&
      Object.prototype.hasOwnProperty.call(sessionProfile, "departmentName") &&
      hasProfileValue("organizationName") &&
      hasProfileValue("departmentName");

    if (hasCurrentOrgProfile) {
      return res.json({ success: true, data: sessionProfile });
    }

    const deps = buildDeps(storage, req);
    const result = await getCurrentUser(deps, req.session.userId);

    if (!result.success) {
      return res.status(result.status).json({ success: false, error: result.error });
    }

    req.session.userProfile = result.data;
    req.session.save((err: Error | null) => {
      if (err) {
        logger.warn("[Auth] Failed to refresh cached user profile in session:", err);
      }
    });

    res.json({ success: true, data: result.data });
  }));

  return router;
}
