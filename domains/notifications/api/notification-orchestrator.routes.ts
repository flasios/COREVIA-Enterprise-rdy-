/**
 * Notification Orchestrator API Routes
 * Mounted at /api/notification-orchestrator
 */
import { Router, type Request } from "express";
import { z } from "zod";
import { buildOrchestratorDeps } from "../application";
import {
  getChannelsGrouped,
  getChannelsFlat,
  getChannel,
  toggleNotificationChannel,
  updateChannelConfig,
  bulkToggleChannels,
  registerChannel,
  getChannelStats,
  getUserPreferences,
  setUserPreference,
  emitNotification,
  getWhatsAppStatus,
  getWhatsAppConfig,
  updateWhatsAppConfig,
} from "../application";
import type { PortResult } from "../application";
import { validateBody } from "@interfaces/middleware/validateBody";

/* ── Zod schemas ─────────────────────────────────────────── */

const toggleChannelSchema = z.object({ enabled: z.boolean() });

const updateChannelConfigSchema = z.object({
  deliveryMethods: z.any().optional(),
  priority: z.any().optional(),
  config: z.any().optional(),
});

const bulkToggleSchema = z.object({
  channelIds: z.array(z.string()),
  enabled: z.boolean(),
});

const registerChannelSchema = z.object({
  id: z.string(),
  serviceName: z.string(),
  category: z.string(),
  name: z.string(),
  description: z.string(),
}).passthrough();

const userPreferenceSchema = z.object({
  enabled: z.any().optional(),
  deliveryMethods: z.any().optional(),
  config: z.any().optional(),
});

const emitNotificationSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
  title: z.string(),
  message: z.string(),
}).passthrough();

const whatsAppConfigSchema = z.object({
  userId: z.string().nullish(),
}).passthrough();

const send = (res: any, r: PortResult) => // eslint-disable-line @typescript-eslint/no-explicit-any
  r.success ? res.json(r) : res.status(r.status).json(r);

function getUserId(req: Request): string | undefined {
  return (req as unknown as { auth?: { userId?: string } }).auth?.userId ?? req.session?.userId;
}

export function createNotificationOrchestratorRoutes(): Router {
  const router = Router();
  const deps = buildOrchestratorDeps();

  router.get("/channels", async (_req, res) => send(res, await getChannelsGrouped(deps)));
  router.get("/channels/flat", async (_req, res) => send(res, await getChannelsFlat(deps)));

  router.get("/channels/:id", async (req, res) => {
    send(res, await getChannel(deps, req.params.id as string));
  });

  router.patch("/channels/:id/toggle", validateBody(toggleChannelSchema), async (req, res) => {
    send(res, await toggleNotificationChannel(deps, req.params.id as string, req.body.enabled));
  });

  router.patch("/channels/:id/config", validateBody(updateChannelConfigSchema), async (req, res) => {
    send(res, await updateChannelConfig(deps, req.params.id as string, req.body));
  });

  router.post("/channels/bulk-toggle", validateBody(bulkToggleSchema), async (req, res) => {
    send(res, await bulkToggleChannels(deps, req.body.channelIds, req.body.enabled));
  });

  router.post("/channels", validateBody(registerChannelSchema), async (req, res) => {
    send(res, await registerChannel(deps, req.body));
  });

  router.get("/stats", async (_req, res) => send(res, await getChannelStats(deps)));

  router.get("/preferences", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
    send(res, await getUserPreferences(deps, userId));
  });

  router.put("/preferences/:channelId", validateBody(userPreferenceSchema), async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
    send(res, await setUserPreference(deps, userId, req.params.channelId as string, req.body));
  });

  router.post("/emit", validateBody(emitNotificationSchema), async (req, res) => {
    send(res, await emitNotification(deps, req.body));
  });

  router.get("/whatsapp/status", async (_req, res) => send(res, await getWhatsAppStatus(deps)));
  router.get("/whatsapp/config", async (_req, res) => send(res, await getWhatsAppConfig(deps)));

  router.post("/whatsapp/config", validateBody(whatsAppConfigSchema), async (req, res) => {
    send(res, await updateWhatsAppConfig(deps, getUserId(req) || req.body.userId || null, req.body));
  });

  return router;
}
