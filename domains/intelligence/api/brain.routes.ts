/**
 * Intelligence Module — Brain Routes (buildDeps + useCases pattern)
 *
 * Canonical brain route composition for the intelligence domain.
 */
import { Router, Request, Response } from "express";
import type { RequestHandler } from "express";
import { buildBrainDeps, executeBrainRun } from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";
/* ─── Zod schemas ────────────────────────────────────────────────── */
const brainRunSchema = z.object({}).passthrough();
/* ─── Routes ────────────────────────────────────────────────── */

export function createBrainRoutes(requireBrainRun?: RequestHandler): Router {
  const router = Router();
  const deps = buildBrainDeps();

  router.post("/ai/run", ...(requireBrainRun ? [requireBrainRun] : []), validateBody(brainRunSchema), asyncHandler(async (req: Request, res: Response) => {

    const userId = (req as Request & { user?: { id?: string } }).user?.id || req.session?.userId || null;
    const orgId = (req.session as unknown as Record<string, unknown>)?.organizationId as string | undefined;

    const result = await executeBrainRun(deps, req.body, userId, orgId);
    if (!result.success) {
      return res.status(result.status).json({ success: false, error: result.error, details: result.details });
    }
    return res.json({ success: true, ...result.data });
  }));

  return router;
}
