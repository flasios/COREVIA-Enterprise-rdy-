import { Router } from "express";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware, type AuthRequest } from "@interfaces/middleware/auth";
import type { ProjectStakeholder } from "@shared/schema";
import {
  buildGatesDeps,
  type GatesDeps,
} from "../application/buildDeps";
import {
  getPendingGates,
  getGateHistory,
  approveGate,
  rejectGate,
  getProjectGates,
  createGate,
  updateGate,
  deleteGate,
  sendCoveriaNotification,
  type PortResult,
} from "../application";
import { logger } from "@platform/logging/Logger";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";
import { updateProjectGateSchema } from "@shared/schema/portfolio";

// ── Zod schemas for request validation ──────────────────────
const gateReviewBody = z.object({ reviewNotes: z.string().optional() });
const createGateBody = z.object({}).passthrough();

const send = (res: import("express").Response, r: PortResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

export function createPortfolioGatesRoutes(storage: PortfolioStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildGatesDeps(storage);

  // ── Pending / History ─────────────────────────────────────
  router.get("/gates/pending", auth.requireAuth, auth.requirePermission('workflow:advance'), asyncHandler(async (_req, res) => {
    send(res, await getPendingGates(deps));
  }));

  router.get("/gates/history", auth.requireAuth, auth.requirePermission('workflow:advance'), asyncHandler(async (_req, res) => {
    send(res, await getGateHistory(deps));
  }));

  // ── Approve ───────────────────────────────────────────────
  router.post("/gates/:id/approve", auth.requireAuth, auth.requirePermission('workflow:advance'), validateBody(gateReviewBody), asyncHandler(async (req, res) => {

    const userId = (req as AuthRequest).auth!.userId;
    const result = await approveGate(deps, req.params.id!, userId, req.body.reviewNotes);
    if (!result.success) return res.status(result.status).json(result);
    res.json(result);

    // Fire-and-forget stakeholder notifications (route-level concern)
    const projectId = (result.data as Record<string, unknown>)?.projectId as string | undefined;
    const projectName = (result.data as Record<string, unknown>)?.projectName as string | undefined;
    const newPhase = (result.data as Record<string, unknown>)?.newPhase as string | undefined;
    if (projectId && newPhase) {
      fireGateApprovalNotifications(deps, projectId, newPhase, projectName || 'Project');
    }
  }));

  // ── Reject ────────────────────────────────────────────────
  router.post("/gates/:id/reject", auth.requireAuth, auth.requirePermission('workflow:advance'), validateBody(gateReviewBody), asyncHandler(async (req, res) => {

    send(res, await rejectGate(deps, req.params.id!, req.body.reviewNotes));
  }));

  // ── CRUD ──────────────────────────────────────────────────
  router.get("/projects/:projectId/gates", auth.requireAuth, asyncHandler(async (req, res) => {
    send(res, await getProjectGates(deps, req.params.projectId!));
  }));

  router.post("/projects/:projectId/gates", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(createGateBody), asyncHandler(async (req, res) => {

    const userId = (req as AuthRequest).auth!.userId;
    send(res, await createGate(deps, req.params.projectId!, userId, req.body || {}));
  }));

  router.patch("/gates/:id", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(updateProjectGateSchema), asyncHandler(async (req, res) => {

    send(res, await updateGate(deps, req.params.id!, req.body || {}));
  }));

  router.patch("/projects/:projectId/gates/:id", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(updateProjectGateSchema), asyncHandler(async (req, res) => {

    send(res, await updateGate(deps, req.params.id!, req.body || {}));
  }));

  router.delete("/gates/:id", auth.requireAuth, auth.requirePermission('report:update-any'), asyncHandler(async (req, res) => {
    send(res, await deleteGate(deps, req.params.id!));
  }));

  router.delete("/projects/:projectId/gates/:id", auth.requireAuth, auth.requirePermission('report:update-any'), asyncHandler(async (req, res) => {
    send(res, await deleteGate(deps, req.params.id!));
  }));

  return router;
}

// ── Fire-and-forget gate approval notifications ────────────
function fireGateApprovalNotifications(
  deps: GatesDeps,
  projectId: string,
  newPhase: string,
  projectName: string,
): void {
  setImmediate(async () => {
    try {
      const previousPhase = newPhase; // already the "from" label
      const nextPhaseLabel = newPhase.charAt(0).toUpperCase() + newPhase.slice(1);
      const stakeholderRecords = await deps.stakeholders.getByProject(projectId);
      const stakeholderIds = stakeholderRecords.map((s: ProjectStakeholder) => s.userId).filter(Boolean) as string[];
      const project = await deps.projects.getById(projectId);
      if (project?.projectManagerId) stakeholderIds.push(project.projectManagerId);
      if (project?.sponsorId) stakeholderIds.push(project.sponsorId);
      if (project?.financialDirectorId) stakeholderIds.push(project.financialDirectorId);
      const unique = [...new Set(stakeholderIds)];
      await Promise.allSettled(
        unique.map((sid) =>
          sendCoveriaNotification(deps, {
            userId: sid,
            title: `Gate Approved: ${projectName}`,
            message: `The ${previousPhase} phase gate has been approved for "${projectName}". The project has now advanced to the ${nextPhaseLabel} phase.`,
            priority: 'high',
            relatedType: 'project',
            relatedId: projectId,
            actionUrl: `/portfolio/project/${projectId}`,
          })
        )
      );
    } catch (notifError) {
      logger.error("[Coveria] Error creating gate approval notifications:", notifError);
    }
  });
}
