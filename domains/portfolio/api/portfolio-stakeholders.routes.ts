import { Router } from "express";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { insertProjectStakeholderSchema, updateProjectStakeholderSchema } from "@shared/schema";
import { ZodError } from "zod";
import { buildStakeholderDeps } from "../application/buildDeps";
import { getProjectStakeholders, createStakeholder, updateStakeholder, deleteStakeholder, type PortResult } from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

// ── Zod schemas for request validation ──────────────────────
const stakeholderBody = z.object({}).passthrough();

const send = (res: import("express").Response, r: PortResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

const normalizeStakeholderPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const stakeholderTypeMap: Record<string, string> = {
    internal: 'team_member', external: 'external_partner', partner: 'external_partner',
    expert: 'subject_expert', user: 'end_user',
  };
  const influenceRaw = String(payload.influenceLevel || payload.influence || 'medium').toLowerCase();
  const interestRaw = String(payload.interestLevel || payload.interest || 'medium').toLowerCase();
  const supportRaw = String(payload.supportLevel || payload.support || 'neutral').toLowerCase();
  const normalizeScale = (v: string): string => (['high', 'medium', 'low'].includes(v) ? v : 'medium');
  const normalizeSupport = (v: string): string =>
    ['champion', 'supporter', 'neutral', 'resistant', 'blocker'].includes(v) ? v : 'neutral';
  const rawType = String(payload.stakeholderType || payload.type || 'team_member').toLowerCase();
  return {
    ...payload,
    name: (payload.name as string) || (payload.stakeholderName as string) || 'Stakeholder',
    stakeholderType: stakeholderTypeMap[rawType] || rawType,
    influenceLevel: normalizeScale(influenceRaw),
    interestLevel: normalizeScale(interestRaw),
    supportLevel: normalizeSupport(supportRaw),
    organization: payload.organization || payload.company || null,
    role: payload.role || payload.title || null,
  };
};

export function createPortfolioStakeholdersRoutes(storage: PortfolioStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildStakeholderDeps(storage);

  router.get("/projects/:projectId/stakeholders", auth.requireAuth, asyncHandler(async (req, res) => {
    send(res, await getProjectStakeholders(deps, req.params.projectId!));
  }));

  router.post("/projects/:projectId/stakeholders", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(stakeholderBody), async (req, res) => {

    try {
      const userId = req.auth!.userId;
      const validated = insertProjectStakeholderSchema.parse({
        ...normalizeStakeholderPayload(req.body || {}),
        projectId: req.params.projectId!,
        addedBy: userId,
      });
      send(res, await createStakeholder(deps, validated as unknown as Record<string, unknown>));
    } catch (error: unknown) {
      if (error instanceof ZodError) return res.status(400).json({ success: false, error: "Invalid stakeholder data", details: error.errors });
      logger.error("Error creating stakeholder:", error);
      res.status(500).json({ success: false, error: "Failed to add project stakeholder" });
    }
  });

  router.patch("/stakeholders/:id", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(stakeholderBody), async (req, res) => {

    try {
      const validated = updateProjectStakeholderSchema.parse(normalizeStakeholderPayload(req.body || {}));
      send(res, await updateStakeholder(deps, req.params.id!, validated as unknown as Record<string, unknown>));
    } catch (error: unknown) {
      if (error instanceof ZodError) return res.status(400).json({ success: false, error: "Invalid stakeholder data", details: error.errors });
      logger.error("Error updating stakeholder:", error);
      res.status(500).json({ success: false, error: "Failed to update project stakeholder" });
    }
  });

  router.patch("/projects/:projectId/stakeholders/:id", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(stakeholderBody), async (req, res) => {

    try {
      const validated = updateProjectStakeholderSchema.parse(normalizeStakeholderPayload(req.body || {}));
      send(res, await updateStakeholder(deps, req.params.id!, validated as unknown as Record<string, unknown>));
    } catch (error: unknown) {
      if (error instanceof ZodError) return res.status(400).json({ success: false, error: "Invalid stakeholder data", details: error.errors });
      logger.error("Error updating stakeholder:", error);
      res.status(500).json({ success: false, error: "Failed to update project stakeholder" });
    }
  });

  router.delete("/stakeholders/:id", auth.requireAuth, auth.requirePermission('report:update-any'), asyncHandler(async (req, res) => {
    send(res, await deleteStakeholder(deps, req.params.id!));
  }));

  router.delete("/projects/:projectId/stakeholders/:id", auth.requireAuth, auth.requirePermission('report:update-any'), asyncHandler(async (req, res) => {
    send(res, await deleteStakeholder(deps, req.params.id!));
  }));

  return router;
}
