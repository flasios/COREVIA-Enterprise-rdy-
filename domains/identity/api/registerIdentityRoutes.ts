import { type Express } from "express";
import type { IdentityStorageSlice } from "../application/buildDeps";
import { requireAuth } from "@interfaces/middleware/auth";
import { createAuthRoutes } from "./auth.routes";
import { createPrivacyRoutes } from "./privacy.routes";

export function registerIdentityRoutes(app: Express, storageInstance: IdentityStorageSlice): void {
  app.use("/api/auth", createAuthRoutes(storageInstance));
  app.use("/api/privacy", requireAuth, createPrivacyRoutes(storageInstance));
}
