/**
 * Feature Flag Admin Routes — CRUD API for managing feature flags.
 *
 * All routes require superadmin role.
 *
 * Endpoints:
 *   GET    /api/feature-flags          — List all flags
 *   GET    /api/feature-flags/evaluate — Evaluate all flags for current user
 *   POST   /api/feature-flags          — Create flag
 *   PATCH  /api/feature-flags/:id      — Update flag
 *   DELETE /api/feature-flags/:id      — Delete flag
 */

import { Router, type Request, type Response } from "express";
import { featureFlagService } from "./feature-flag.service";
import { logger } from "@platform/logging/Logger";
import { createFeatureFlagInput, updateFeatureFlagInput } from "./feature-flag.schema";

function requireFlagId(id: string | undefined): string {
  if (!id) {
    throw new Error("Missing feature flag id");
  }

  return id;
}

export function createFeatureFlagRoutes(): Router {
  const router = Router();

  // List all flags
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const flags = await featureFlagService.getAllFlags();
      res.json({ success: true, data: flags });
    } catch (err) {
      logger.error("Failed to fetch feature flags", err);
      res.status(500).json({ success: false, error: "Failed to fetch feature flags" });
    }
  });

  // Evaluate all flags for current user context
  router.get("/evaluate", async (req: Request, res: Response) => {
    try {
      const user = (req as unknown as Record<string, unknown>).user as Record<string, unknown> | undefined;
      const flags = await featureFlagService.getAllFlags();
      const evaluated: Record<string, boolean> = {};

      for (const flag of flags) {
        evaluated[flag.key] = await featureFlagService.isEnabled(flag.key, {
          userId: user?.id as string | undefined,
          role: user?.role as string | undefined,
          organizationId: user?.organizationId as string | undefined,
          environment: process.env.NODE_ENV,
        });
      }

      res.json({ success: true, data: evaluated });
    } catch (err) {
      logger.error("Failed to evaluate feature flags", err);
      res.status(500).json({ success: false, error: "Failed to evaluate feature flags" });
    }
  });

  // Create flag
  router.post("/", async (req: Request, res: Response) => {
    try {
      const parsed = createFeatureFlagInput.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.flatten() });
        return;
      }

      const flag = await featureFlagService.createFlag({
        key: parsed.data.key,
        name: parsed.data.name,
        enabled: parsed.data.enabled,
        description: parsed.data.description ?? null,
        rolloutPercentage: parsed.data.rolloutPercentage ?? null,
        targetRoles: parsed.data.targetRoles ?? null,
        targetOrganizations: parsed.data.targetOrganizations ?? null,
        targetEnvironments: parsed.data.targetEnvironments ?? null,
        metadata: parsed.data.metadata ?? null,
        createdBy: (req as any).user?.id ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
      });
      res.status(201).json({ success: true, data: flag });
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as Record<string, unknown>).code === "23505") {
        res.status(409).json({ success: false, error: "Feature flag key already exists" });
        return;
      }
      res.status(500).json({ success: false, error: "Failed to create feature flag" });
    }
  });

  // Update flag
  router.patch("/:id", async (req: Request, res: Response) => {
    try {
      const parsed = updateFeatureFlagInput.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.flatten() });
        return;
      }

      const flag = await featureFlagService.updateFlag(requireFlagId(req.params.id), parsed.data);
      if (!flag) {
        res.status(404).json({ success: false, error: "Feature flag not found" });
        return;
      }
      res.json({ success: true, data: flag });
    } catch (err) {
      logger.error("Failed to update feature flag", err);
      res.status(500).json({ success: false, error: "Failed to update feature flag" });
    }
  });

  // Delete flag
  router.delete("/:id", async (req: Request, res: Response) => {
    try {
      const deleted = await featureFlagService.deleteFlag(requireFlagId(req.params.id));
      if (!deleted) {
        res.status(404).json({ success: false, error: "Feature flag not found" });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      logger.error("Failed to delete feature flag", err);
      res.status(500).json({ success: false, error: "Failed to delete feature flag" });
    }
  });

  return router;
}
