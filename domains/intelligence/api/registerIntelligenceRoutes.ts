import { type Express } from "express";
import type { AIAssistantStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware, requireAuth } from "@interfaces/middleware/auth";
import { createAIRoutes } from "./ai.routes";
import { createAnalyticsRoutes } from "./analytics.routes";
import { createRAGRoutes } from "./rag.routes";
import { createAIAssistantRoutes } from "./ai-assistant.routes";
import { createProactiveIntelligenceRoutes } from "./proactive-intelligence.routes";
import { coreviaRoutes } from "@brain";
import { createBrainRoutes } from "./brain.routes";

export function registerIntelligenceCoreRoutes(app: Express, storageInstance: AIAssistantStorageSlice): void {
  const auth = createAuthMiddleware(storageInstance);
  app.use("/api/ai", requireAuth, auth.requirePermission("report:read"), createAIRoutes(storageInstance));
  app.use("/api/analytics", requireAuth, auth.requirePermission("report:read"), createAnalyticsRoutes(storageInstance));
  app.use("/api/rag", requireAuth, auth.requirePermission("report:read"), createRAGRoutes(storageInstance));
  app.use("/api/ai-assistant", requireAuth, auth.requirePermission("report:read"), createAIAssistantRoutes(storageInstance));
  app.use("/api/proactive", requireAuth, auth.requirePermission("report:read"), createProactiveIntelligenceRoutes(storageInstance));
  app.use("/api/corevia", requireAuth, auth.requirePermission("brain:view"), coreviaRoutes);
  app.use("/api/brain", requireAuth, auth.requirePermission("brain:view"), createBrainRoutes(auth.requirePermission("brain:run")));
}

export function registerIntelligenceExtendedRoutes(app: Express): void {
  // Routes are mounted in registerIntelligenceCoreRoutes.
  void app;
}
