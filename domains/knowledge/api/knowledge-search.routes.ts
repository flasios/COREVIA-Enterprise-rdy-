import { Router, type Response, type Request } from "express";
import { createAuthMiddleware, type AuthStorageSlice } from "@interfaces/middleware/auth";
import {
  buildKnowledgeSearchDeps,
  semanticSearch,
  hybridSearch,
  enhancedSearch,
  enhancedAsk,
  ask,
  getSuggestions,
  type DecisionContext,
  type KnowResult,
} from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

/* ── Zod schemas for body validation ── */
const semanticSearchBody = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().max(100).optional(),
  accessLevel: z.enum(["public", "internal", "restricted"]).optional(),
});

const hybridSearchBody = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().max(100).optional(),
  accessLevel: z.enum(["public", "internal", "restricted"]).optional(),
});

const enhancedSearchBody = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().optional(),
  accessLevel: z.string().optional(),
  sessionId: z.string().optional(),
  useQueryExpansion: z.boolean().optional(),
  useReranking: z.boolean().optional(),
  useConversationalMemory: z.boolean().optional(),
});

const enhancedAskBody = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().optional(),
  accessLevel: z.string().optional(),
  sessionId: z.string().optional(),
  systemPrompt: z.string().optional(),
});

const askBody = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().max(20).optional(),
  accessLevel: z.enum(["public", "internal", "restricted"]).optional(),
  systemPrompt: z.string().optional(),
  useHybrid: z.boolean().optional(),
});

export function createKnowledgeSearchRoutes(storage: AuthStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildKnowledgeSearchDeps();

  const send = (res: Response, r: KnowResult) => r.success ? res.json(r) : res.status(r.status).json(r);

  const buildCtx = (req: Request): DecisionContext => ({
    userId: req.session.userId!, userRole: req.session.role,
    organizationId: req.session.organizationId, ipAddress: req.ip, userAgent: req.get('User-Agent'),
  });

  router.post("/search", auth.requirePermission('knowledge:read'), validateBody(semanticSearchBody), asyncHandler(async (req, res) => {
    send(res, await semanticSearch(deps, req.body, req.session.userId!, buildCtx(req)));
  }));

  router.post("/hybrid-search", auth.requirePermission('knowledge:read'), validateBody(hybridSearchBody), asyncHandler(async (req, res) => {
    send(res, await hybridSearch(deps, req.body, req.session.userId!, buildCtx(req)));
  }));

  router.post("/enhanced-search", auth.requirePermission('knowledge:read'), validateBody(enhancedSearchBody), asyncHandler(async (req, res) => {
    send(res, await enhancedSearch(deps, req.body, req.session.userId!));
  }));

  router.post("/enhanced-ask", auth.requirePermission('knowledge:read'), validateBody(enhancedAskBody), asyncHandler(async (req, res) => {
    send(res, await enhancedAsk(deps, req.body, req.session.userId!, buildCtx(req)));
  }));

  router.post("/ask", auth.requirePermission('knowledge:read'), validateBody(askBody), asyncHandler(async (req, res) => {
    send(res, await ask(deps, req.body, req.session.userId!, buildCtx(req)));
  }));

  router.get("/suggestions", auth.requirePermission('knowledge:read'), asyncHandler(async (req, res) => {
    const rawCtx = {
      stage: req.query.stage,
      demandId: req.query.demandId ? parseInt(req.query.demandId as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 3,
      title: req.query.title, description: req.query.description, requestType: req.query.requestType,
      category: req.query.category, priority: req.query.priority, requirements: req.query.requirements,
      businessCase: req.query.businessCase, costs: req.query.costs, strategicAlignment: req.query.strategicAlignment,
    };
    send(res, await getSuggestions(deps, rawCtx as Record<string, unknown>, req.session.userId!));
  }));

  return router;
}
