import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { logSecurityEvent } from "../../platform/logging/Logger";

const CSRF_COOKIE_NAME = "XSRF-TOKEN";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const strictCsrfMode =
  process.env.CSRF_STRICT_MODE !== undefined
    ? process.env.CSRF_STRICT_MODE === "true"
    : process.env.NODE_ENV === "production";
const enforceAuthOriginCheck =
  process.env.CSRF_ENFORCE_AUTH_ORIGIN !== undefined
    ? process.env.CSRF_ENFORCE_AUTH_ORIGIN === "true"
    : process.env.NODE_ENV === "production";

function normalizeOrigin(raw: string): string | null {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins(): Set<string> {
  const origins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter((origin): origin is string => Boolean(origin));

  return new Set(origins);
}

function getRequestOrigin(req: Request): string | null {
  const host = req.get("host");
  if (!host) {
    return null;
  }
  return `${req.protocol}://${host}`;
}

function isTrustedOrigin(req: Request): boolean {
  const source = req.get("origin") || req.get("referer");
  if (!source) {
    return false;
  }

  const origin = normalizeOrigin(source);
  if (!origin) {
    return false;
  }

  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = getRequestOrigin(req);
  if (requestOrigin) {
    allowedOrigins.add(requestOrigin);
  }

  return allowedOrigins.has(origin);
}

function tokensMatch(candidate: string, expected: string): boolean {
  const candidateBuf = Buffer.from(candidate);
  const expectedBuf = Buffer.from(expected);

  if (candidateBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateBuf, expectedBuf);
}

export function attachCsrfToken(req: Request, res: Response, next: NextFunction) {
  if (!req.session) {
    return next();
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }

  res.cookie(CSRF_COOKIE_NAME, req.session.csrfToken, {
    httpOnly: false,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  next();
}

export function requireCsrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const isAuthMutation =
    req.path === "/api/auth/login" ||
    req.path === "/api/auth/register" ||
    req.path === "/api/auth/logout";

  if (!req.session?.userId) {
    if (strictCsrfMode && enforceAuthOriginCheck && isAuthMutation && !isTrustedOrigin(req)) {
      logSecurityEvent("CSRF origin validation failed for auth endpoint", {
        path: req.path,
        method: req.method,
        ip: req.ip,
        origin: req.get("origin"),
        referer: req.get("referer"),
        correlationId: req.correlationId,
      });

      return res.status(403).json({
        success: false,
        error: "CSRF origin validation failed",
      });
    }

    return next();
  }

  const tokenHeader = req.get("x-csrf-token");
  const sessionToken = req.session.csrfToken;

  if (tokenHeader && sessionToken && tokensMatch(tokenHeader, sessionToken)) {
    return next();
  }

  if (!strictCsrfMode && isTrustedOrigin(req)) {
    return next();
  }

  logSecurityEvent("CSRF validation failed", {
    path: req.path,
    method: req.method,
    ip: req.ip,
    origin: req.get("origin"),
    referer: req.get("referer"),
    correlationId: req.correlationId,
  });

  return res.status(403).json({
    success: false,
    error: "CSRF validation failed",
  });
}
