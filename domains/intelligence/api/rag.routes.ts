/**
 * Intelligence Module — RAG Routes (buildDeps + useCases)
 *
 * Canonical RAG route composition for the intelligence domain.
 */
import { Router, type Request } from "express";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import type { AIAssistantStorageSlice } from "../application/buildDeps";
import {
  buildRagDeps,
  runRagAgent,
  listRagAgents,
  orchestrateMultiAgent,
} from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

/* ─── Zod Schemas ───────────────────────────────────────────── */
const ragAgentSchema = z.object({
  query: z.string().min(1, "Query is required"),
  reportId: z.string().optional(),
  retrievalOptions: z.any().optional(),
}).passthrough();

const orchestrateSchema = z.object({
  query: z.string().min(1, "Query is required"),
  reportId: z.string().optional(),
  accessLevel: z.string().optional(),
}).passthrough();

/* ─── Helpers ───────────────────────────────────────────────── */

type SessionRequest = Request & {
  session: {
    userId?: string;
    role?: string;
  };
};

function getSessionUserId(req: Request): string {
  const userId = (req as SessionRequest).session?.userId;
  if (!userId) throw new Error("Missing session userId");
  return userId;
}

function _getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

/* ─── Routes ────────────────────────────────────────────────── */

export function createRAGRoutes(storage: AIAssistantStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildRagDeps(storage);

  router.post('/agents/:domain', auth.requireAuth, validateBody(ragAgentSchema), asyncHandler(async (req, res) => {

    const sessionReq = req as SessionRequest;
    const userId = getSessionUserId(req);
    const result = await runRagAgent(deps, req.params.domain as string, req.body.query, userId, {
      reportId: req.body.reportId,
      retrievalOptions: req.body.retrievalOptions,
      accessLevel: sessionReq.session.role === 'manager' ? 'internal' : 'public',
    });
    if (!result.success) return res.status(result.status).json(result);
    res.json(result);
  }));

  router.get('/agents', auth.requireAuth, (_req, res) => {
    try {
      const result = listRagAgents(deps);
      res.json(result);
    } catch (error: unknown) {
      logger.error('[Agent API Error]', error);
      res.status(500).json({ success: false, error: 'Failed to get supported agents' });
    }
  });

  router.post('/orchestrate', auth.requireAuth, validateBody(orchestrateSchema), asyncHandler(async (req, res) => {

    const sessionReq = req as SessionRequest;
    const userId = getSessionUserId(req);
    const result = await orchestrateMultiAgent(deps, {
      query: req.body.query,
      userId,
      reportId: req.body.reportId,
      accessLevel: req.body.accessLevel || (sessionReq.session.role === 'manager' ? 'internal' : 'public'),
    });
    if (!result.success) return res.status(result.status).json(result);
    res.json({ success: true, data: result.data });
  }));

  return router;
}
