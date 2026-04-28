import { Router } from "express";
import { createAuthMiddleware, type AuthStorageSlice } from "@interfaces/middleware/auth";
import {
  buildKnowledgeInsightsDeps,
  getInsightDashboard,
  getActiveAlerts,
  listInsightEvents,
  getInsightEventById,
  acknowledgeEvent,
  resolveEvent,
  dismissEvent,
  runGapDetection,
  generateInsights,
  listInsightRules,
  createInsightRule,
  evaluateInsightRule,
  toggleInsightRule,
  deleteInsightRule,
} from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

/* ── Zod schemas for body validation ── */
const resolveEventBody = z.object({
  resolutionNotes: z.string().optional(),
});

const dismissEventBody = z.object({
  reason: z.string().optional(),
});

const createInsightRuleBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  ruleType: z.string(),
  conditions: z.any(),
  actions: z.any(),
  priority: z.string().optional(),
  category: z.string().optional(),
}).passthrough();

const toggleInsightRuleBody = z.object({
  isActive: z.boolean(),
});

export function createKnowledgeInsightsRoutes(storage: AuthStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildKnowledgeInsightsDeps();

  const send = (res: any, r: any) => r.success ? res.json(r) : res.status(r.status).json(r); // eslint-disable-line @typescript-eslint/no-explicit-any

  router.get("/dashboard", auth.requireAuth, auth.requirePermission('knowledge:read'), asyncHandler(async (_req, res) => {
    send(res, await getInsightDashboard(deps));
  }));

  router.get("/alerts", auth.requireAuth, auth.requirePermission('knowledge:read'), asyncHandler(async (req, res) => {
    const { category, priority, limit } = req.query;
    send(res, await getActiveAlerts(deps, { category: category as string, priority: priority as string, limit: limit ? parseInt(limit as string) : 50 }));
  }));

  router.get("/events", auth.requireAuth, auth.requirePermission('knowledge:read'), asyncHandler(async (req, res) => {
    const { category, priority, status, limit, offset } = req.query;
    send(res, await listInsightEvents(deps, {
      category: category as string, priority: priority as string, status: status as string,
      limit: limit ? parseInt(limit as string) : 20, offset: offset ? parseInt(offset as string) : 0,
    }));
  }));

  router.get("/events/:eventId", auth.requireAuth, auth.requirePermission('knowledge:read'), asyncHandler(async (req, res) => {
    send(res, await getInsightEventById(deps, req.params.eventId as string));
  }));

  router.post("/events/:eventId/acknowledge", auth.requireAuth, auth.requirePermission('knowledge:write'), asyncHandler(async (req, res) => {
    send(res, await acknowledgeEvent(deps, req.params.eventId as string, req.session.userId!));
  }));

  router.post("/events/:eventId/resolve", auth.requireAuth, auth.requirePermission('knowledge:write'), validateBody(resolveEventBody), asyncHandler(async (req, res) => {
    send(res, await resolveEvent(deps, req.params.eventId as string, req.session.userId!, req.body.resolutionNotes || ''));
  }));

  router.post("/events/:eventId/dismiss", auth.requireAuth, auth.requirePermission('knowledge:write'), validateBody(dismissEventBody), asyncHandler(async (req, res) => {
    send(res, await dismissEvent(deps, req.params.eventId as string, req.session.userId!, req.body.reason || 'No reason provided'));
  }));

  router.post("/analyze-gaps", auth.requireAuth, auth.requirePermission('knowledge:write'), asyncHandler(async (req, res) => {
    send(res, await runGapDetection(deps, req.session.userId!));
  }));

  router.post("/generate", auth.requireAuth, auth.requirePermission('knowledge:write'), asyncHandler(async (_req, res) => {
    send(res, await generateInsights(deps));
  }));

  router.get("/rules", auth.requireAuth, auth.requirePermission('knowledge:read'), asyncHandler(async (_req, res) => {
    send(res, await listInsightRules(deps));
  }));

  router.post("/rules", auth.requireAuth, auth.requirePermission('knowledge:write'), validateBody(createInsightRuleBody), asyncHandler(async (req, res) => {
    send(res, await createInsightRule(deps, req.body, req.session.userId!));
  }));

  router.post("/rules/:ruleId/evaluate", auth.requireAuth, auth.requirePermission('knowledge:write'), asyncHandler(async (req, res) => {
    send(res, await evaluateInsightRule(deps, req.params.ruleId as string));
  }));

  router.patch("/rules/:ruleId/toggle", auth.requireAuth, auth.requirePermission('knowledge:write'), validateBody(toggleInsightRuleBody), asyncHandler(async (req, res) => {
    send(res, await toggleInsightRule(deps, req.params.ruleId as string, req.body.isActive));
  }));

  router.delete("/rules/:ruleId", auth.requireAuth, auth.requirePermission('knowledge:write'), asyncHandler(async (req, res) => {
    send(res, await deleteInsightRule(deps, req.params.ruleId as string));
  }));

  return router;
}
