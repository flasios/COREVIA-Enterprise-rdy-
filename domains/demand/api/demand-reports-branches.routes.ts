import { Router, type Response } from "express";
import { z } from "zod";
import type { DemandStorageSlice } from "../application/buildDeps";
import { createAuthMiddlewareWithOwnership } from "@interfaces/middleware/auth";
import { buildDemandDeps } from "../application/buildDeps";
import {
  createBranch,
  listBranches,
  getBranchTree,
  getBranch,
  updateBranch,
  deleteBranch,
  createBranchMerge,
  listMerges,
  type DemandResult,
} from "../application";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";

const send = (res: Response, result: DemandResult<unknown>) =>
  result.success ? res.json(result) : res.status(result.status).json(result);

const createBranchSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  description: z.string().optional(),
  parentBranchId: z.string().optional(),
  headVersionId: z.string().optional(),
  accessControl: z.array(z.string()).optional(),
});

const updateBranchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["active", "merged", "abandoned"]).optional(),
  headVersionId: z.string().optional(),
  accessControl: z.array(z.string()).optional(),
});

const mergeSchema = z.object({
  targetBranchId: z.string().min(1, "Target branch ID is required"),
});

export function createDemandReportsBranchesRoutes(storage: DemandStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddlewareWithOwnership(storage);
  const deps = buildDemandDeps(storage);
  type BranchParams = { id: string; branchId: string };

  router.post("/:id/branches", auth.requireAuth, auth.requirePermission("version:create"), validateBody(createBranchSchema), async (req, res) => {

    try {
      const { id } = req.params as BranchParams;
      const userId = req.auth!.userId;

      const canEdit = await auth.validateReportOwnership(id, userId, req.auth!.role, req.auth!.customPermissions);
      if (!canEdit) return res.status(403).json({ error: "You can only create branches for your own reports" });

      const result = await createBranch(deps, id, userId, req.body);
      if (result.success) { res.status(201).json({ ...result, message: "Branch created successfully" }); } else { res.status(result.status).json(result); }
    } catch (error) {
      logger.error("Error creating branch:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to create branch" });
    }
  });

  router.get("/:id/branches", auth.requireAuth, auth.requirePermission("report:read"), async (req, res) => {
    try {
      const { id } = req.params as BranchParams;
      send(res, await listBranches(deps, id, req.auth!.userId));
    } catch (error) {
      logger.error("Error fetching branches:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to fetch branches" });
    }
  });

  router.get("/:id/branches/tree", auth.requireAuth, auth.requirePermission("report:read"), async (req, res) => {
    try {
      const { id } = req.params as BranchParams;
      send(res, await getBranchTree(deps, id, req.auth!.userId));
    } catch (error) {
      logger.error("Error fetching branch tree:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to fetch branch tree" });
    }
  });

  router.get("/:id/branches/:branchId", auth.requireAuth, auth.requirePermission("report:read"), async (req, res) => {
    try {
      const { id, branchId } = req.params as BranchParams;
      send(res, await getBranch(deps, id, branchId, req.auth!.userId));
    } catch (error) {
      logger.error("Error fetching branch:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to fetch branch" });
    }
  });

  router.patch("/:id/branches/:branchId", auth.requireAuth, auth.requirePermission("version:create"), validateBody(updateBranchSchema), async (req, res) => {

    try {
      const { id, branchId } = req.params as BranchParams;
      const userId = req.auth!.userId;

      const canEdit = await auth.validateReportOwnership(id, userId, req.auth!.role, req.auth!.customPermissions);
      if (!canEdit) return res.status(403).json({ error: "You can only update branches for your own reports" });

      const result = await updateBranch(deps, id, branchId, userId, req.body);
      if (result.success) { res.json({ ...result, message: "Branch updated successfully" }); } else { res.status(result.status).json(result); }
    } catch (error) {
      logger.error("Error updating branch:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to update branch" });
    }
  });

  router.delete("/:id/branches/:branchId", auth.requireAuth, auth.requirePermission("version:create"), async (req, res) => {
    try {
      const { id, branchId } = req.params as BranchParams;
      const userId = req.auth!.userId;
      const canEdit = await auth.validateReportOwnership(id, userId, req.auth!.role, req.auth!.customPermissions);
      if (!canEdit) return res.status(403).json({ error: "You can only delete branches for your own reports" });

      const result = await deleteBranch(deps, id, branchId, userId);
      if (result.success) { res.json({ success: true, message: "Branch deleted successfully" }); } else { res.status(result.status).json(result); }
    } catch (error) {
      logger.error("Error deleting branch:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to delete branch" });
    }
  });

  router.post("/:id/branches/:branchId/merge", auth.requireAuth, auth.requirePermission("version:create"), validateBody(mergeSchema), async (req, res) => {

    try {
      const { id, branchId } = req.params as BranchParams;
      const userId = req.auth!.userId;

      const canEdit = await auth.validateReportOwnership(id, userId, req.auth!.role, req.auth!.customPermissions);
      if (!canEdit) return res.status(403).json({ error: "You can only merge branches for your own reports" });

      const result = await createBranchMerge(deps, id, branchId, req.body.targetBranchId, userId);
      if (result.success) { res.status(201).json({ ...result, message: "Merge initiated successfully" }); } else { res.status(result.status).json(result); }
    } catch (error) {
      logger.error("Error initiating merge:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to initiate merge" });
    }
  });

  router.get("/:id/merges", auth.requireAuth, auth.requirePermission("report:read"), async (req, res) => {
    try {
      const { id } = req.params as BranchParams;
      send(res, await listMerges(deps, id));
    } catch (error) {
      logger.error("Error fetching merges:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to fetch merges" });
    }
  });

  return router;
}
