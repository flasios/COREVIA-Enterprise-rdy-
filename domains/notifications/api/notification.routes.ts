/**
 * Notification API Routes
 * Mounted at /api/notifications
 */
import { Router, type Response } from "express";
import type { IOperationsStoragePort } from "@interfaces/storage/ports";
import { createAuthMiddleware, type AuthStorageSlice } from "@interfaces/middleware/auth";
import { buildNotificationDeps } from "../application";
import {
  getUserNotifications,
  getUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "../application";
import type { PortResult } from "../application";
import { sendPaginated } from "@interfaces/middleware/pagination";
import { cacheResponse, invalidateCache } from "@interfaces/middleware/cacheResponse";

const send = (res: Response, r: PortResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

export function createNotificationRouter(storage: IOperationsStoragePort & AuthStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildNotificationDeps(storage);
  const notificationCache = cacheResponse({ ttlMs: 10_000, prefix: "notif:" });

  router.get("/", auth.requireAuth, notificationCache, async (req, res) => {
    const userId = req.auth!.userId;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    send(res, await getUserNotifications(deps, userId, limit));
  });

  router.get("/unread", auth.requireAuth, notificationCache, async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    sendPaginated(req, res, await getUnreadNotifications(deps, req.auth!.userId, limit));
  });

  router.patch("/:id/read", auth.requireAuth, invalidateCache("notif:"), async (req, res) => {
    send(res, await markNotificationAsRead(deps, req.params.id as string));
  });

  router.patch("/read-all", auth.requireAuth, invalidateCache("notif:"), async (req, res) => {
    send(res, await markAllNotificationsAsRead(deps, req.auth!.userId));
  });

  router.delete("/:id", auth.requireAuth, invalidateCache("notif:"), async (req, res) => {
    send(res, await deleteNotification(deps, req.params.id as string));
  });

  return router;
}
