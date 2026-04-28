import { Router } from "express";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware, type AuthRequest } from "@interfaces/middleware/auth";
import { insertProjectDocumentSchema, updateProjectDocumentSchema } from "@shared/schema";
import { z, ZodError } from "zod";
import { buildDocumentDeps } from "../application/buildDeps";
import { getProjectDocuments, createDocument, updateDocument, deleteDocument, type PortResult } from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";

// ── Zod schemas ───────────────────────────────────
const createDocumentBodySchema = z.object({}).passthrough();

const send = (res: import("express").Response, r: PortResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

export function createPortfolioDocumentsRoutes(storage: PortfolioStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildDocumentDeps(storage);

  router.get("/projects/:projectId/documents", auth.requireAuth, asyncHandler(async (req, res) => {
    send(res, await getProjectDocuments(deps, req.params.projectId!));
  }));

  router.post("/projects/:projectId/documents", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(createDocumentBodySchema), async (req, res) => {

    try {
      const userId = (req as AuthRequest).auth!.userId;
      const validated = insertProjectDocumentSchema.parse({ ...req.body, projectId: req.params.projectId!, uploadedBy: userId });
      send(res, await createDocument(deps, validated));
    } catch (error: unknown) {
      if (error instanceof ZodError) return res.status(400).json({ success: false, error: "Invalid document data", details: error.errors });
      logger.error("Error creating document:", error);
      res.status(500).json({ success: false, error: "Failed to upload document" });
    }
  });

  router.patch("/documents/:id", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(updateProjectDocumentSchema), async (req, res) => {

    try {
      const validated = updateProjectDocumentSchema.parse(req.body);
      send(res, await updateDocument(deps, req.params.id!, validated));
    } catch (error: unknown) {
      if (error instanceof ZodError) return res.status(400).json({ success: false, error: "Invalid document data", details: error.errors });
      logger.error("Error updating document:", error);
      res.status(500).json({ success: false, error: "Failed to update document" });
    }
  });

  router.delete("/documents/:id", auth.requireAuth, auth.requirePermission('report:update-any'), asyncHandler(async (req, res) => {
    send(res, await deleteDocument(deps, req.params.id!));
  }));

  return router;
}
