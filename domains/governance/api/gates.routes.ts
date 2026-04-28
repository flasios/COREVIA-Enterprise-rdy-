import { Router } from "express";
import type { GateStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { buildGatesDeps } from "../application/buildDeps";
import type { GovResult } from "../application";
import {
  getGateCatalog, seedGateCatalog, getPendingApprovals, getGateReadiness,
  getGateOverview, getGateUnlockStatus, getProjectGate, requestGateApproval,
  processGateApproval, updateGateCheck, getGateHistory, getGateAuditLog,
} from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

const send = (res: import("express").Response, r: GovResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

// ── Zod Schemas ─────────────────────────────────────────────────
const requestApprovalSchema = z.object({ phase: z.string() });
const processApprovalSchema = z.object({}).passthrough();
const updateCheckSchema = z.object({}).passthrough();

export function createGatesRoutes(storage: GateStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildGatesDeps(storage);

  router.get("/catalog", auth.requireAuth, asyncHandler(async (_req, res) => {
    send(res, await getGateCatalog(deps, _req.query.phase as string | undefined));
  }));

  router.post("/catalog/seed", auth.requireAuth, auth.requirePermission("workflow:advance"), asyncHandler(async (_req, res) => {
    send(res, await seedGateCatalog(deps));
  }));

  router.get("/pending-approvals", auth.requireAuth, asyncHandler(async (_req, res) => {
    send(res, await getPendingApprovals(deps));
  }));

  router.get("/:projectId/readiness", auth.requireAuth, asyncHandler(async (req, res) => {
    send(res, await getGateReadiness(deps, req.params.projectId as string));
  }));

  router.get("/:projectId/overview", auth.requireAuth, asyncHandler(async (req, res) => {
    send(res, await getGateOverview(deps, req.params.projectId as string));
  }));

  router.get("/:projectId/status", auth.requireAuth, asyncHandler(async (req, res) => {
    send(res, await getGateUnlockStatus(deps, req.params.projectId as string));
  }));

  router.get("/:projectId", auth.requireAuth, asyncHandler(async (req, res) => {
    send(res, await getProjectGate(deps, req.params.projectId as string));
  }));

  router.post("/:projectId/request-approval", auth.requireAuth, validateBody(requestApprovalSchema), asyncHandler(async (req, res) => {

    const r = await requestGateApproval(deps, req.params.projectId as string, req.body.phase, req.session.userId);
    // requestGateApproval wraps orchestrator result in data — forward the inner result
    if (r.success) res.json(r.data);
    else res.status(r.status).json(r);
  }));

  router.post("/:projectId/approve", auth.requireAuth, auth.requirePermission("workflow:advance"), validateBody(processApprovalSchema), asyncHandler(async (req, res) => {

    const r = await processGateApproval(deps, req.params.projectId as string, req.body, req.session.userId);
    if (r.success) res.json(r.data);
    else res.status(r.status).json(r);
  }));

  router.patch("/checks/:checkId", auth.requireAuth, validateBody(updateCheckSchema), asyncHandler(async (req, res) => {

    send(res, await updateGateCheck(deps, req.params.checkId as string, req.body, req.session.userId));
  }));

  router.get("/:projectId/history", auth.requireAuth, asyncHandler(async (req, res) => {
    send(res, await getGateHistory(deps, req.params.projectId as string));
  }));

  router.get("/:projectId/audit", auth.requireAuth, asyncHandler(async (req, res) => {
    send(res, await getGateAuditLog(deps, req.params.projectId as string, parseInt(req.query.limit as string) || 50));
  }));

  return router;
}
