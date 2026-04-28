import { Router } from "express";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { insertProjectApprovalSchema, updateProjectApprovalSchema } from "@shared/schema";
import { z } from "zod";
import { buildApprovalDeps } from "../application/buildDeps";
import { getProjectApprovals, createApproval, updateApproval, decideApproval, getPendingApprovals, type PortResult } from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";

const approvalDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'conditionally_approved']),
  comments: z.string().optional(),
  conditions: z.string().optional(),
});

const send = (res: import("express").Response, r: PortResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

export function createPortfolioApprovalsRoutes(storage: PortfolioStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildApprovalDeps(storage);

  router.get("/projects/:projectId/approvals", auth.requireAuth, asyncHandler(async (req, res) => {
    send(res, await getProjectApprovals(deps, req.params.projectId!));
  }));

  router.post("/projects/:projectId/approvals", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(insertProjectApprovalSchema), async (req, res) => {

    try {
      const userId = req.auth!.userId;
      const validated = insertProjectApprovalSchema.parse(req.body);
      send(res, await createApproval(deps, req.params.projectId!, userId, validated as unknown as Record<string, unknown>));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: "Invalid approval data", details: error.errors });
      logger.error("Error creating approval:", error);
      res.status(500).json({ success: false, error: "Failed to create approval request" });
    }
  });

  router.patch("/approvals/:id", auth.requireAuth, auth.requirePermission('workflow:advance'), validateBody(updateProjectApprovalSchema), async (req, res) => {

    try {
      const validated = updateProjectApprovalSchema.parse(req.body);
      send(res, await updateApproval(deps, req.params.id!, validated as unknown as Record<string, unknown>));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: "Invalid approval data", details: error.errors });
      logger.error("Error updating approval:", error);
      res.status(500).json({ success: false, error: "Failed to update approval" });
    }
  });

  router.post("/approvals/:id/decide", auth.requireAuth, auth.requirePermission('workflow:advance'), validateBody(approvalDecisionSchema), async (req, res) => {

    try {
      const validated = approvalDecisionSchema.parse(req.body);
      const userId = req.auth!.userId;
      send(res, await decideApproval(deps, req.params.id!, userId, validated));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: "Invalid decision data", details: error.errors });
      logger.error("Error deciding approval:", error);
      res.status(500).json({ success: false, error: "Failed to process approval decision" });
    }
  });

  router.get("/approvals/pending", auth.requireAuth, asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    send(res, await getPendingApprovals(deps, userId));
  }));

  return router;
}
