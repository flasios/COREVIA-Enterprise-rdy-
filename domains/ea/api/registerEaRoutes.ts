import { type Express } from "express";
import type { EaStorageSlice } from "../application/buildDeps";
import { requireAuth } from "@interfaces/middleware/auth";
import { createEaRoutes } from "./ea.routes";
import { createEaRegistryRoutes } from "./ea-registry.routes";

export function registerEaRoutes(app: Express, storageInstance: EaStorageSlice): void {
  app.use("/api/ea", requireAuth, createEaRoutes(storageInstance));
  app.use("/api/ea/registry", requireAuth, createEaRegistryRoutes(storageInstance));
}

