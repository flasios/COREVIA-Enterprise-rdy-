import { type Express } from "express";
import type { IOperationsStoragePort } from "@interfaces/storage/ports";
import { createAuthMiddleware, requireAuth, type AuthStorageSlice } from "@interfaces/middleware/auth";
import { createNotificationRouter } from "./notification.routes";
import { createNotificationOrchestratorRoutes } from "./notification-orchestrator.routes";

export function registerNotificationsCoreRoutes(app: Express, storageInstance: IOperationsStoragePort & AuthStorageSlice): void {
  app.use("/api/notifications", requireAuth, createNotificationRouter(storageInstance));
}

export function registerNotificationsExtendedRoutes(app: Express, storageInstance: AuthStorageSlice): void {
  const auth = createAuthMiddleware(storageInstance);
  app.use("/api/notification-orchestrator", requireAuth, auth.requirePermission("brain:view"), createNotificationOrchestratorRoutes());
}
