import { Router, type Request } from "express";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { buildMetadataDeps } from "../application/buildDeps";
import {
  addDependency, updateDependency, deleteDependency,
  addAssumption, updateAssumption, deleteAssumption,
  addConstraint, updateConstraint, deleteConstraint,
  type PortResult,
} from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

// ── Zod schemas for request validation ──────────────────────
const metadataBody = z.object({}).passthrough();

const send = (res: import("express").Response, r: PortResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

function getAuthUserId(req: Request): string {
  const userId = (req as Request & { auth?: { userId?: string } }).auth?.userId;
  if (!userId) throw new Error("Authentication context missing userId");
  return userId;
}

export function createPortfolioMetadataRoutes(storage: PortfolioStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildMetadataDeps(storage);

  // ── Dependencies ────────────────────────────────────────────────

  router.post("/projects/:projectId/dependencies", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(metadataBody), asyncHandler(async (req, res) => {

    send(res, await addDependency(deps, req.params.projectId!, getAuthUserId(req), req.body));
  }));

  router.patch("/projects/:projectId/dependencies/:dependencyId", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(metadataBody), asyncHandler(async (req, res) => {

    send(res, await updateDependency(deps, req.params.projectId!, req.params.dependencyId!, req.body));
  }));

  router.delete("/projects/:projectId/dependencies/:dependencyId", auth.requireAuth, auth.requirePermission('report:update-any'), asyncHandler(async (req, res) => {
    send(res, await deleteDependency(deps, req.params.projectId!, req.params.dependencyId!));
  }));

  // ── Assumptions ─────────────────────────────────────────────────

  router.post("/projects/:projectId/assumptions", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(metadataBody), asyncHandler(async (req, res) => {

    send(res, await addAssumption(deps, req.params.projectId!, getAuthUserId(req), req.body));
  }));

  router.patch("/projects/:projectId/assumptions/:assumptionId", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(metadataBody), asyncHandler(async (req, res) => {

    send(res, await updateAssumption(deps, req.params.projectId!, req.params.assumptionId!, req.body));
  }));

  router.delete("/projects/:projectId/assumptions/:assumptionId", auth.requireAuth, auth.requirePermission('report:update-any'), asyncHandler(async (req, res) => {
    send(res, await deleteAssumption(deps, req.params.projectId!, req.params.assumptionId!));
  }));

  // ── Constraints ─────────────────────────────────────────────────

  router.post("/projects/:projectId/constraints", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(metadataBody), asyncHandler(async (req, res) => {

    send(res, await addConstraint(deps, req.params.projectId!, getAuthUserId(req), req.body));
  }));

  router.patch("/projects/:projectId/constraints/:constraintId", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(metadataBody), asyncHandler(async (req, res) => {

    send(res, await updateConstraint(deps, req.params.projectId!, req.params.constraintId!, req.body));
  }));

  router.delete("/projects/:projectId/constraints/:constraintId", auth.requireAuth, auth.requirePermission('report:update-any'), asyncHandler(async (req, res) => {
    send(res, await deleteConstraint(deps, req.params.projectId!, req.params.constraintId!));
  }));

  return router;
}
