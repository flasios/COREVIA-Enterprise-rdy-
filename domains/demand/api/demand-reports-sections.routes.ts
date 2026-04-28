import { Router, type Response } from "express";
import type { DemandStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { buildDemandDeps } from "../application/buildDeps";
import {
  listSectionAssignments,
  assignSection,
  updateSectionAssignment,
  removeSectionAssignment,
  type DemandResult,
} from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

const send = (res: Response, result: DemandResult<unknown>) =>
  result.success ? res.json(result) : res.status(result.status).json(result);

// ── Zod Schemas ─────────────────────────────────────────────────
const assignSectionSchema = z.object({}).passthrough();
const updateSectionSchema = z.object({}).passthrough();

export function createDemandReportsSectionsRoutes(storage: DemandStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildDemandDeps(storage);
  type SectionParams = { id: string; sectionName: string };

  router.get("/:id/section-assignments", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const { id } = req.params as SectionParams;
    send(res, await listSectionAssignments(deps, id));
  }));

  router.post("/:id/section-assignments", auth.requireAuth, auth.requirePermission("requirements:assign-sections"), validateBody(assignSectionSchema), asyncHandler(async (req, res) => {

    const { id } = req.params as SectionParams;
    const userId = req.auth!.userId;
    const result = await assignSection(deps, id, userId, req.body, { storage, req });
    send(res, result);
  }));

  router.patch("/:id/section-assignments/:sectionName", auth.requireAuth, validateBody(updateSectionSchema), asyncHandler(async (req, res) => {

    const { id, sectionName } = req.params as SectionParams;
    const userId = req.auth!.userId;
    const result = await updateSectionAssignment(
      deps,
      id,
      sectionName,
      userId,
      req.body,
      { storage, req },
    );
    send(res, result);
  }));

  router.delete("/:id/section-assignments/:sectionName", auth.requireAuth, auth.requirePermission("requirements:assign-sections"), asyncHandler(async (req, res) => {
    const { id, sectionName } = req.params as SectionParams;
    const userId = req.auth!.userId;
    const result = await removeSectionAssignment(deps, id, sectionName, userId, { storage, req });
    if (result.success) { res.json({ success: true, message: "Section assignment removed successfully" }); } else { res.status(result.status).json(result); }
  }));

  return router;
}
