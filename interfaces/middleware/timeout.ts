/**
 * Request Timeout Middleware
 *
 * Enforces per-route request timeouts to prevent hanging connections.
 * Sends 504 Gateway Timeout if handler doesn't respond in time.
 *
 * Usage:
 *   app.use("/api", requestTimeout(30_000));         // 30s default
 *   app.use("/api/ai", requestTimeout(120_000));     // 2min for AI routes
 *   app.use("/api/export", requestTimeout(60_000));  // 1min for exports
 *
 * @module platform
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "@platform/logging/Logger";

type TimedRequest = Request & {
  __timeoutSet?: boolean;
  __requestTimedOut?: boolean;
};

type TimedResponse = Response & {
  locals: Response["locals"] & {
    requestTimedOut?: boolean;
  };
};

function resolveTimeoutOverride(name: string, fallbackMs: number): number {
  const raw = process.env[name];
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallbackMs;
  }
  return Math.max(1_000, Math.floor(parsed));
}

/**
 * Creates a middleware that aborts the request after `ms` milliseconds.
 * Safe: clears the timer if the response finishes naturally.
 */
export function requestTimeout(ms: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timedReq = req as TimedRequest;
    const timedRes = res as TimedResponse;

    // If a more-specific timeout is already set (e.g. /api/ai-assistant before /api),
    // skip so the shorter catch-all doesn't override the longer specific timeout.
    if (timedReq.__timeoutSet) {
      return next();
    }
    timedReq.__timeoutSet = true;

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        timedReq.__requestTimedOut = true;
        timedRes.locals ??= {};
        timedRes.locals.requestTimedOut = true;
        logger.warn("[Timeout] Request exceeded time limit", {
          path: req.path,
          method: req.method,
          timeoutMs: ms,
          userId: req.session?.userId,
        });
        res.status(504).json({
          success: false,
          error: "Request timed out. Please try again or reduce the scope of your request.",
          timeoutMs: ms,
        });
      }
    }, ms);

    // Clear timer when response finishes
    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
}

/** Default timeouts for common route categories */
export const TIMEOUTS = {
  /** Standard API calls */
  DEFAULT: resolveTimeoutOverride("COREVIA_TIMEOUT_DEFAULT_MS", 30_000),
  /** AI generation / LLM calls */
  AI: resolveTimeoutOverride("COREVIA_TIMEOUT_AI_MS", 120_000),
  /** Market research goes through Brain governance + Engine B hybrid reasoning and regularly exceeds the generic AI budget */
  MARKET_RESEARCH: resolveTimeoutOverride("COREVIA_TIMEOUT_MARKET_RESEARCH_MS", 300_000),
  /** WBS generation uses multi-step brain orchestration and persistence */
  WBS: resolveTimeoutOverride("COREVIA_TIMEOUT_WBS_MS", 300_000),
  /** Long-running business case generation may require additional repair and persistence time. Sovereign single-worker RunPod runs 5 sections sequentially — needs ~15 min ceiling. */
  BUSINESS_CASE: resolveTimeoutOverride("COREVIA_TIMEOUT_BUSINESS_CASE_MS", 1_200_000),
  /** Requirements generation uses the same Brain pipeline profile as business case and can exceed generic AI timeouts */
  REQUIREMENTS: resolveTimeoutOverride("COREVIA_TIMEOUT_REQUIREMENTS_MS", 300_000),
  /** Demand analysis AI assistance can take longer on Engine A due to RAG + local inference */
  DEMAND_ANALYSIS: resolveTimeoutOverride("COREVIA_TIMEOUT_DEMAND_ANALYSIS_MS", 300_000),
  /** Bulk export / report generation */
  EXPORT: resolveTimeoutOverride("COREVIA_TIMEOUT_EXPORT_MS", 60_000),
  /** File upload processing */
  UPLOAD: resolveTimeoutOverride("COREVIA_TIMEOUT_UPLOAD_MS", 45_000),
  /** Health checks */
  HEALTH: resolveTimeoutOverride("COREVIA_TIMEOUT_HEALTH_MS", 5_000),
} as const;
