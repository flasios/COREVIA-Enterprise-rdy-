import { type Express } from "express";
import { createAuthMiddleware, requireAuth } from "@interfaces/middleware/auth";
import type { AuthStorageSlice } from "@interfaces/middleware/auth";
import { createIntegrationHubRoutes } from "./integration-hub.routes";

export function registerIntegrationRoutes(app: Express, storage: AuthStorageSlice): void {
  const auth = createAuthMiddleware(storage);
  app.use("/api/integration-hub", requireAuth, auth.requirePermission("integration:hub:view"), createIntegrationHubRoutes());
}
