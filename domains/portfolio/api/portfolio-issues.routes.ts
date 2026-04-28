import { Router } from "express";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { insertProjectIssueSchema, updateProjectIssueSchema } from "@shared/schema";
import { z } from "zod";
import { buildIssueDeps } from "../application/buildDeps";
import { getProjectIssues, createIssue, updateIssue, deleteIssue, type PortResult } from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";

// ── Zod schemas ───────────────────────────────────
const createIssueBodySchema = z.object({
  priority: z.string().optional(),
}).passthrough();

const issueEscalationSchema = z.object({
  escalatedTo: z.string().min(1, "Escalated to is required"),
  reason: z.string().min(1, "Escalation reason is required"),
});

const send = (res: import("express").Response, r: PortResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

const normalizeIssuePayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const severityMap: Record<string, string> = {
    low: 'minor', medium: 'moderate', high: 'major', critical: 'critical',
    minor: 'minor', moderate: 'moderate', major: 'major', trivial: 'trivial',
  };
  const title = (payload.title as string) || (payload.issueDescription as string) || 'Project Issue';
  const description = (payload.description as string) || (payload.issueDescription as string) || null;
  const issueType = (payload.issueType as string) || 'technical';
  const priority = (payload.priority as string) || 'medium';
  const severityRaw = String(payload.severity || priority || 'moderate').toLowerCase();
  return {
    ...payload, title, description, issueType, priority,
    severity: severityMap[severityRaw] || 'moderate',
    status: payload.status || 'open',
  };
};

export function createPortfolioIssuesRoutes(storage: PortfolioStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildIssueDeps(storage);

  router.get("/projects/:projectId/issues", auth.requireAuth, asyncHandler(async (req, res) => {
    send(res, await getProjectIssues(deps, req.params.projectId!));
  }));

  router.post("/projects/:projectId/issues", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(createIssueBodySchema), async (req, res) => {

    try {
      const userId = req.auth!.userId;
      const projectIssues = await deps.issues.getByProject(req.params.projectId!);
      const issueCode = `ISS-${String(projectIssues.length + 1).padStart(3, '0')}`;
      const slaMap: Record<string, number> = { critical: 4, high: 24, medium: 72, low: 168 };
      const validated = insertProjectIssueSchema.parse({
        ...normalizeIssuePayload(req.body || {}),
        projectId: req.params.projectId!, issueCode, reportedBy: userId,
        slaHours: slaMap[req.body.priority] || 72,
      });
      send(res, await createIssue(deps, validated as unknown as Record<string, unknown>));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: "Invalid issue data", details: error.errors });
      logger.error("Error creating issue:", error);
      res.status(500).json({ success: false, error: "Failed to create project issue" });
    }
  });

  router.patch("/issues/:id", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(updateProjectIssueSchema), async (req, res) => {

    try {
      const userId = req.auth!.userId;
      let updates = { ...normalizeIssuePayload(req.body || {}) };
      if (req.body.status === 'resolved' || req.body.status === 'closed') {
        updates.resolvedBy = userId;
        updates.actualResolutionDate = new Date();
      }
      const validated = updateProjectIssueSchema.parse(updates);
      send(res, await updateIssue(deps, req.params.id!, validated as unknown as Record<string, unknown>));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: "Invalid issue data", details: error.errors });
      logger.error("Error updating issue:", error);
      res.status(500).json({ success: false, error: "Failed to update project issue" });
    }
  });

  router.patch("/projects/:projectId/issues/:id", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(updateProjectIssueSchema), async (req, res) => {

    try {
      const userId = req.auth!.userId;
      let updates = { ...normalizeIssuePayload(req.body || {}) };
      if ((updates as any).status === 'resolved' || (updates as any).status === 'closed') { // eslint-disable-line @typescript-eslint/no-explicit-any
        (updates as any).resolvedBy = userId; // eslint-disable-line @typescript-eslint/no-explicit-any
        (updates as any).actualResolutionDate = new Date(); // eslint-disable-line @typescript-eslint/no-explicit-any
      }
      const validated = updateProjectIssueSchema.parse(updates);
      send(res, await updateIssue(deps, req.params.id!, validated as unknown as Record<string, unknown>));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: "Invalid issue data", details: error.errors });
      logger.error("Error updating issue:", error);
      res.status(500).json({ success: false, error: "Failed to update project issue" });
    }
  });

  // Escalation uses storage directly (IssueRepository lacks getById)
  router.post("/issues/:id/escalate", auth.requireAuth, auth.requirePermission('workflow:advance'), validateBody(issueEscalationSchema), async (req, res) => {

    try {
      const validated = issueEscalationSchema.parse(req.body);
      const issue = await storage.getProjectIssue(req.params.id!);
      if (!issue) return res.status(404).json({ success: false, error: "Issue not found" });
      await deps.issues.update(req.params.id!, {
        escalatedTo: validated.escalatedTo,
        escalationReason: validated.reason,
        escalatedAt: new Date(),
        escalationLevel: (issue.escalationLevel || 0) + 1,
        status: 'escalated',
      });
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: "Invalid escalation data", details: error.errors });
      logger.error("Error escalating issue:", error);
      res.status(500).json({ success: false, error: "Failed to escalate issue" });
    }
  });

  router.delete("/issues/:id", auth.requireAuth, auth.requirePermission('report:update-any'), asyncHandler(async (req, res) => {
    send(res, await deleteIssue(deps, req.params.id!));
  }));

  router.delete("/projects/:projectId/issues/:id", auth.requireAuth, auth.requirePermission('report:update-any'), asyncHandler(async (req, res) => {
    send(res, await deleteIssue(deps, req.params.id!));
  }));

  return router;
}
