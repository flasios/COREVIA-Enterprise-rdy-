import { Router } from "express";
import { createAuthMiddleware, type AuthStorageSlice } from "@interfaces/middleware/auth";
import {
  buildKnowledgeGraphDeps,
  getGraphData,
  getGraphStats,
  processDocumentForGraph,
  getEntityById,
  searchEntities,
  verifyEntity,
  deleteEntity,
} from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

/* ── Zod schemas for body validation ── */
const searchEntitiesBody = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().optional(),
});

export function createKnowledgeGraphRoutes(storage: AuthStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildKnowledgeGraphDeps();

  const send = (res: any, r: any) => r.success ? res.json(r) : res.status(r.status).json(r); // eslint-disable-line @typescript-eslint/no-explicit-any

  router.get("/", auth.requireAuth, auth.requirePermission('knowledge:read'), asyncHandler(async (req, res) => {
    const { entityTypes, limit, search, includeRelationships } = req.query;
    send(res, await getGraphData(deps, {
      entityTypes: entityTypes as string, limit: limit ? parseInt(limit as string) : undefined,
      search: search as string, includeRelationships: includeRelationships !== 'false',
    }));
  }));

  router.get("/stats", auth.requireAuth, auth.requirePermission('knowledge:read'), asyncHandler(async (_req, res) => {
    send(res, await getGraphStats(deps));
  }));

  router.post("/process/:documentId", auth.requireAuth, auth.requirePermission('knowledge:write'), asyncHandler(async (req, res) => {
    send(res, await processDocumentForGraph(deps, req.params.documentId as string));
  }));

  router.get("/entity/:entityId", auth.requireAuth, auth.requirePermission('knowledge:read'), asyncHandler(async (req, res) => {
    send(res, await getEntityById(deps, req.params.entityId as string));
  }));

  router.post("/search", auth.requireAuth, auth.requirePermission('knowledge:read'), validateBody(searchEntitiesBody), asyncHandler(async (req, res) => {
    send(res, await searchEntities(deps, req.body.query, req.body.limit));
  }));

  router.post("/entity/:entityId/verify", auth.requireAuth, auth.requirePermission('knowledge:write'), asyncHandler(async (req, res) => {
    send(res, await verifyEntity(deps, req.params.entityId as string, req.session.userId!));
  }));

  router.delete("/entity/:entityId", auth.requireAuth, auth.requirePermission('knowledge:write'), asyncHandler(async (req, res) => {
    send(res, await deleteEntity(deps, req.params.entityId as string));
  }));

  return router;
}
