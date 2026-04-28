import { type Express } from "express";

import { type IStorage } from "@interfaces/storage";
import { createFeatureFlagRoutes } from "@platform/feature-flags/feature-flag.routes";

import { aiLimiter, requireAuth, requireRole, strictLimiter, uploadLimiter } from "../middleware";
import { registerDomainRoutes } from "./domains";
import { registerPlatformRoutes } from "./platform";

export function setupRoutes(app: Express, storageInstance: IStorage): void {
  app.use("/api/ai", aiLimiter);
  app.use("/api/ai-assistant", aiLimiter);
  app.use("/api/brain", aiLimiter);
  app.use("/api/proactive", aiLimiter);
  app.use("/api/rag", aiLimiter);
  app.use("/api/knowledge/upload", uploadLimiter);
  app.use("/api/admin", strictLimiter);

  registerPlatformRoutes(app, storageInstance);
  registerDomainRoutes(app, storageInstance);

  app.use("/api/feature-flags", requireAuth, requireRole("super_admin"), createFeatureFlagRoutes());
}