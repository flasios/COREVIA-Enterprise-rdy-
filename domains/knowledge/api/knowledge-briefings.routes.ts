import { Router, type Response } from "express";
import { createAuthMiddleware, type AuthStorageSlice } from "@interfaces/middleware/auth";
import {
  buildKnowledgeBriefingsDeps,
  listBriefings,
  createBriefing,
  getBriefingById,
  publishBriefing,
  archiveBriefing,
  deleteBriefing,
  generateWeeklyDigest,
  type DecisionContext,
  type KnowResult,
} from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

/* ── Zod schemas for body validation ── */
const createBriefingBody = z.object({
  title: z.string().min(1),
  briefingType: z.string().min(1),
  scope: z.record(z.unknown()).optional(),
  customTopic: z.string().optional(),
}).passthrough();

export function createKnowledgeBriefingsRoutes(storage: AuthStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildKnowledgeBriefingsDeps();

  const send = (res: Response, r: KnowResult) => r.success ? res.json(r) : res.status(r.status).json(r);

  router.get("/", auth.requireAuth, auth.requirePermission('knowledge:read'), async (req, res) => {
    try {
      const { status, type, limit, offset } = req.query;
      const r = await listBriefings(deps, {
        status: status as string, type: type as string, userId: req.session.userId!,
        limit: limit ? parseInt(limit as string) : 20, offset: offset ? parseInt(offset as string) : 0,
      });
      send(res, r);
    } catch (error) {
      logger.error("Error listing briefings:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to list briefings" });
    }
  });

  router.post("/", auth.requireAuth, auth.requirePermission('knowledge:write'), validateBody(createBriefingBody), async (req, res) => {
    try {
      const ctx: DecisionContext = {
        userId: req.session.userId!, userRole: req.session.role,
        organizationId: req.session.organizationId, ipAddress: req.ip, userAgent: req.get('User-Agent'),
      };
      const r = await createBriefing(deps, { userId: req.session.userId!, ...req.body, decisionContext: ctx });
      send(res, r);
    } catch (error) {
      logger.error("Error creating briefing:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to create briefing" });
    }
  });

  router.get("/:briefingId", auth.requireAuth, auth.requirePermission('knowledge:read'), asyncHandler(async (req, res) => {
    send(res, await getBriefingById(deps, req.params.briefingId as string));
  }));

  router.post("/:briefingId/publish", auth.requireAuth, auth.requirePermission('knowledge:write'), asyncHandler(async (req, res) => {
    send(res, await publishBriefing(deps, req.params.briefingId as string));
  }));

  router.post("/:briefingId/archive", auth.requireAuth, auth.requirePermission('knowledge:write'), asyncHandler(async (req, res) => {
    send(res, await archiveBriefing(deps, req.params.briefingId as string));
  }));

  router.delete("/:briefingId", auth.requireAuth, auth.requirePermission('knowledge:write'), asyncHandler(async (req, res) => {
    send(res, await deleteBriefing(deps, req.params.briefingId as string));
  }));

  router.post("/weekly-digest", auth.requireAuth, auth.requirePermission('knowledge:write'), asyncHandler(async (req, res) => {
    send(res, await generateWeeklyDigest(deps, req.session.userId!));
  }));

  return router;
}
