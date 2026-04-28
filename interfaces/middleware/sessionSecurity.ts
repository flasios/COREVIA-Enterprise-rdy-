import type { NextFunction, Request, Response } from "express";
import { logSecurityEvent } from "../../platform/logging/Logger";

const DEFAULT_SESSION_MAX_AGE_DEV_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_SESSION_MAX_AGE_PROD_MS = 12 * 60 * 60 * 1000;
const DEFAULT_INACTIVITY_TIMEOUT_DEV_MS = 12 * 60 * 60 * 1000;
const DEFAULT_INACTIVITY_TIMEOUT_PROD_MS = 30 * 60 * 1000;
const DEFAULT_ACTIVITY_REFRESH_INTERVAL_MS = 60 * 1000;

function parseDurationMs(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function resolveSessionCookieMaxAgeMs(): number {
  const configured = parseDurationMs(process.env.SESSION_MAX_AGE_MS);
  if (configured) return configured;
  return process.env.NODE_ENV === "production"
    ? DEFAULT_SESSION_MAX_AGE_PROD_MS
    : DEFAULT_SESSION_MAX_AGE_DEV_MS;
}

export function resolveSessionInactivityTimeoutMs(): number {
  const configured = parseDurationMs(process.env.SESSION_INACTIVITY_TIMEOUT_MS);
  if (configured) return configured;
  return process.env.NODE_ENV === "production"
    ? DEFAULT_INACTIVITY_TIMEOUT_PROD_MS
    : DEFAULT_INACTIVITY_TIMEOUT_DEV_MS;
}

export function resolveSessionActivityRefreshIntervalMs(): number {
  const configured = parseDurationMs(process.env.SESSION_ACTIVITY_REFRESH_INTERVAL_MS);
  return configured ?? DEFAULT_ACTIVITY_REFRESH_INTERVAL_MS;
}

export function enforceSessionInactivity(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    return next();
  }

  const now = Date.now();
  const timeoutMs = resolveSessionInactivityTimeoutMs();
  const lastActivityAt = Number(req.session.lastActivityAt || 0);

  if (lastActivityAt > 0 && now - lastActivityAt > timeoutMs) {
    const userId = req.session.userId;
    req.session.destroy(() => undefined);
    logSecurityEvent("Session expired due to inactivity", {
      userId,
      ip: req.ip,
      path: req.path,
      method: req.method,
      timeoutMs,
      correlationId: req.correlationId,
    });
    res.status(401).json({
      success: false,
      error: "Session expired due to inactivity",
    });
    return;
  }

  const refreshIntervalMs = resolveSessionActivityRefreshIntervalMs();
  if (lastActivityAt === 0 || now - lastActivityAt >= refreshIntervalMs) {
    req.session.lastActivityAt = now;
  }
  next();
}
