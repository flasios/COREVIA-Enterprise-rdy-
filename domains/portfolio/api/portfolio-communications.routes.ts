import { Router, Response } from "express";
import { z, ZodError } from "zod";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware, AuthRequest } from "@interfaces/middleware/auth";
import { insertProjectCommunicationSchema, updateProjectCommunicationSchema } from "@shared/schema";
import { buildCommsDeps } from "../application/buildDeps";
import {
  getProjectCommunications,
  createCommunication,
  updateCommunication,
  publishCommunication,
  deleteCommunication,
  sendNotification,
  getCommunicationPlan,
  saveCommunicationPlan,
  approveCommunicationPlan,
  executeCommunicationTrigger,
  type PortResult,
} from "../application";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";

// ── Zod schemas (validation is a route-level concern) ──────
const createCommunicationBodySchema = z.object({}).passthrough();

const communicationPublishSchema = z.object({
  notifyStakeholders: z.boolean().optional(),
  distributionChannels: z.array(z.string()).optional(),
}).optional();

const sendNotificationSchema = z.object({
  projectId: z.string(),
  templateType: z.string(),
  subject: z.string(),
  content: z.string(),
  recipients: z.array(z.object({ email: z.string().email(), name: z.string() })),
  isTest: z.boolean().optional(),
});

const saveCommunicationPlanSchema = z.object({
  channels: z.array(z.object({
    id: z.string(), name: z.string(), frequency: z.string(), audience: z.string(),
    format: z.string().optional(), owner: z.string(), isActive: z.boolean(),
    autoTrigger: z.boolean(), nextScheduled: z.string().optional(),
  })),
  autoTriggers: z.array(z.object({
    id: z.string(), name: z.string(), triggerType: z.string(), condition: z.string(),
    templateId: z.string(), isActive: z.boolean(), lastTriggered: z.string().optional(),
  })).optional(),
  isApproved: z.boolean().optional(),
});

const approveCommunicationPlanSchema = z.object({
  channels: z.array(z.object({
    id: z.string(), name: z.string(), frequency: z.string(), audience: z.string(),
    owner: z.string(), isActive: z.boolean(), autoTrigger: z.boolean(), nextScheduled: z.string().optional(),
  })),
  autoTriggers: z.array(z.object({ id: z.string(), name: z.string(), isActive: z.boolean() })),
});

const executeTriggerSchema = z.object({
  triggerId: z.string(), triggerName: z.string(), triggerType: z.string(), customMessage: z.string().optional(),
});

const send = (res: Response, r: PortResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

export function createPortfolioCommunicationsRoutes(storage: PortfolioStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildCommsDeps(storage);

  // ── CRUD ──────────────────────────────────────────────────
  router.get("/projects/:projectId/communications", auth.requireAuth, async (req, res) => {
    send(res, await getProjectCommunications(deps, req.params.projectId!));
  });

  router.post("/projects/:projectId/communications", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(createCommunicationBodySchema), async (req: AuthRequest, res: Response) => {

    try {
      const validated = insertProjectCommunicationSchema.parse({ ...req.body, projectId: req.params.projectId!, createdBy: req.auth!.userId });
      send(res, await createCommunication(deps, validated));
    } catch (error: unknown) {
      if (error instanceof ZodError) return res.status(400).json({ success: false, error: "Invalid communication data", details: error.errors });
      logger.error("Error creating communication:", error);
      res.status(500).json({ success: false, error: "Failed to create communication" });
    }
  });

  router.patch("/communications/:id", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(updateProjectCommunicationSchema), async (req: AuthRequest, res: Response) => {

    try {
      send(res, await updateCommunication(deps, req.params.id!, req.body));
    } catch (error: unknown) {
      logger.error("Error updating communication:", error);
      res.status(500).json({ success: false, error: "Failed to update communication" });
    }
  });

  router.post("/communications/:id/publish", auth.requireAuth, auth.requirePermission('workflow:advance'), validateBody(communicationPublishSchema), async (req: AuthRequest, res: Response) => {

    try {
      send(res, await publishCommunication(deps, req.params.id!));
    } catch (error: unknown) {
      logger.error("Error publishing communication:", error);
      res.status(500).json({ success: false, error: "Failed to publish communication" });
    }
  });

  router.delete("/communications/:id", auth.requireAuth, auth.requirePermission('report:update-any'), async (req, res) => {
    send(res, await deleteCommunication(deps, req.params.id!));
  });

  // ── Send notification (email blast) ───────────────────────
  router.post("/communications/send-notification", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(sendNotificationSchema), async (req: AuthRequest, res: Response) => {

    try {
      send(res, await sendNotification(deps, req.body));
    } catch (error: unknown) {
      logger.error("Error sending notification:", error);
      res.status(500).json({ success: false, error: "Failed to send notification" });
    }
  });

  // ── Communication plan ────────────────────────────────────
  router.get("/projects/:projectId/communication-plan", auth.requireAuth, async (req: AuthRequest, res: Response) => {
    send(res, await getCommunicationPlan(deps, req.params.projectId!));
  });

  router.put("/projects/:projectId/communication-plan", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(saveCommunicationPlanSchema), async (req: AuthRequest, res: Response) => {

    try {
      send(res, await saveCommunicationPlan(deps, req.params.projectId!, req.body));
    } catch (error: unknown) {
      logger.error("Error saving communication plan:", error);
      res.status(500).json({ success: false, error: "Failed to save communication plan" });
    }
  });

  router.post("/projects/:projectId/communication-plan/approve", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(approveCommunicationPlanSchema), async (req: AuthRequest, res: Response) => {

    try {
      send(res, await approveCommunicationPlan(deps, req.params.projectId!, req.auth!.userId));
    } catch (error: unknown) {
      logger.error("Error approving communication plan:", error);
      res.status(500).json({ success: false, error: "Failed to approve communication plan" });
    }
  });

  router.post("/projects/:projectId/communication-plan/execute-trigger", auth.requireAuth, auth.requirePermission('report:update-self'), validateBody(executeTriggerSchema), async (req: AuthRequest, res: Response) => {

    try {
      send(res, await executeCommunicationTrigger(deps, req.params.projectId!, req.body.triggerType));
    } catch (error: unknown) {
      logger.error("Error executing trigger:", error);
      res.status(500).json({ success: false, error: "Failed to execute trigger" });
    }
  });

  return router;
}
