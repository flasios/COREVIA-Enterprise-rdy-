import { type Express } from "express";
import type { OpsStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware, requireAuth } from "@interfaces/middleware/auth";
import { createUsersRoutes } from "./users.routes";
import { createTeamsRoutes } from "./teams.routes";
import { createCacheRoutes } from "./cache.routes";

export function registerOperationsCoreRoutes(app: Express, storageInstance: OpsStorageSlice): void {
  const auth = createAuthMiddleware(storageInstance);
  app.use("/api/users", requireAuth, auth.requirePermission("user:read"), createUsersRoutes(storageInstance));
  app.use("/api/teams", requireAuth, auth.requirePermission("team:view-members"), createTeamsRoutes(storageInstance));
  app.use("/api/cache", requireAuth, auth.requirePermission("user:manage"), createCacheRoutes(storageInstance));
}
