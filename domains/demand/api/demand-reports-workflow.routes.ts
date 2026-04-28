import { Router, type Response } from "express";
import type { DemandStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { buildDemandDeps } from "../application/buildDeps";
import {
  updateWorkflowStatus,
  submitDemandCorrection,
  getWorkflowHistory,
  notifyCoveriaSpecialist,
  type DemandResult,
} from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

const send = (res: Response, result: DemandResult<unknown>) =>
  result.success ? res.json(result) : res.status(result.status).json(result);

// ── Zod Schemas ─────────────────────────────────────────────────
const updateWorkflowSchema = z.object({}).passthrough();
const correctionSchema = z.object({
  updates: z.record(z.unknown()),
  changeSummary: z.string().optional(),
});
const notifySpecialistSchema = z.object({}).passthrough();

export function createDemandReportsWorkflowRoutes(storage: DemandStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildDemandDeps(storage);

  router.put("/:id/workflow", auth.requireAuth, auth.requirePermission("workflow:advance"), validateBody(updateWorkflowSchema), asyncHandler(async (req, res) => {

    const { id } = req.params as { id: string };
    const reqUser = req.user;
    const result = await updateWorkflowStatus(deps, id, req.body, {
      userId: reqUser?.id || req.auth?.userId || "system",
      userRole: reqUser?.role || req.auth?.role,
    });

    if (!result.success) return res.status(result.status).json({ success: false, error: result.error });

    res.json({
      success: true,
      data: result.data.report,
      notificationSent: result.data.notificationSent,
      brainSyncCompleted: result.data.brainSyncCompleted,
    });
  }));

  router.get("/:id/workflow-history", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    send(res, await getWorkflowHistory(deps, id));
  }));

  router.post("/:id/correction", auth.requireAuth, auth.requirePermission("report:update-self"), validateBody(correctionSchema), asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const reqUser = req.user;
    const result = await submitDemandCorrection(deps, id, req.body, {
      userId: reqUser?.id || req.auth?.userId || "system",
      userRole: reqUser?.role || req.auth?.role,
    });

    if (!result.success) return res.status(result.status).json({ success: false, error: result.error });
    res.json({ success: true, data: result.data });
  }));

  router.post("/:id/coveria-notify-specialist", auth.requireAuth, auth.requirePermission("workflow:advance"), validateBody(notifySpecialistSchema), asyncHandler(async (req, res) => {

    const { id } = req.params as { id: string };
    const result = await notifyCoveriaSpecialist(deps, id, req.body);
    send(res, result);
  }));

  return router;
}
