/**
 * Feature Flag Middleware — Express middleware for feature flag guards.
 *
 * Usage:
 *   router.get("/new-feature", requireFeatureFlag("new-feature"), handler);
 */

import type { Request, Response, NextFunction } from "express";
import { featureFlagService, type FeatureFlagContext } from "./feature-flag.service";
import { logger } from "../logging/Logger";

function handleFeatureFlagEvaluationFailure(err: unknown, next: NextFunction): void {
  logger.warn("[FeatureFlags] Failed to evaluate required feature flag", err);
  next();
}

/**
 * Build a FeatureFlagContext from an Express request.
 */
function buildContext(req: Request): FeatureFlagContext {
  const reqExt = req as unknown as Record<string, unknown>;
  const sessionObj = reqExt.session as Record<string, unknown> | undefined;
  const passportObj = sessionObj?.passport as Record<string, unknown> | undefined;
  const user = (reqExt.user ?? passportObj?.user) as Record<string, unknown> | undefined;
  return {
    userId: user?.id as string | undefined,
    role: user?.role as string | undefined,
    organizationId: (user?.organizationId ?? reqExt.organizationId) as string | undefined,
    environment: process.env.NODE_ENV,
  };
}

/**
 * Middleware: require a feature flag to be enabled.
 * Returns 404 if the flag is disabled (feature doesn't exist for this user).
 */
export function requireFeatureFlag(flagKey: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = buildContext(req);
      const enabled = await featureFlagService.isEnabled(flagKey, context);

      if (!enabled) {
        res.status(404).json({
          success: false,
          error: "Not found",
        });
        return;
      }

      next();
    } catch (err) {
      handleFeatureFlagEvaluationFailure(err, next);
    }
  };
}

/**
 * Middleware: add feature flag evaluation to response (for frontend consumption).
 * Evaluates all flags and adds them to `res.locals.featureFlags`.
 */
export function evaluateFeatureFlags() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = buildContext(req);
      const flags = await featureFlagService.getAllFlags();
      const evaluated: Record<string, boolean> = {};

      for (const flag of flags) {
        evaluated[flag.key] = await featureFlagService.isEnabled(flag.key, context);
      }

      (req as unknown as Record<string, unknown>).featureFlags = evaluated;
    } catch {
      (req as unknown as Record<string, unknown>).featureFlags = {};
    }
    next();
  };
}
