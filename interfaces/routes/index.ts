import { type Express } from "express";
import { storage, type IStorage } from "../storage";
import { setupWebSocket } from "../websocket";
import { errorHandler } from "@platform/logging/ErrorHandler";
import { registerPlatformRoutes } from "../http/registerPlatformRoutes";
import { registerDomainRoutes } from "../http/registerDomainRoutes";
import { aiLimiter, uploadLimiter, strictLimiter } from "../middleware/rateLimiter";
import { createFeatureFlagRoutes } from "@platform/feature-flags/feature-flag.routes";
import { requireAuth, requireRole } from "../middleware/auth";
import { createPlatformServer, type PlatformServer } from "@platform/http/platformServer";

/**
 * Setup all API routes with the provided storage instance
 *
 * SECURITY: All routes except /api/auth are protected with requireAuth middleware
 * to ensure only authenticated users can access platform resources.
 */
export function setupRoutes(app: Express, storageInstance: IStorage): void {
  // ── Per-route rate limiters (on top of the global standardLimiter in index.ts) ──
  app.use("/api/ai", aiLimiter);
  app.use("/api/ai-assistant", aiLimiter);
  app.use("/api/brain", aiLimiter);
  app.use("/api/proactive", aiLimiter);
  app.use("/api/rag", aiLimiter);
  app.use("/api/knowledge/upload", uploadLimiter);
  app.use("/api/admin", strictLimiter);

  registerPlatformRoutes(app, storageInstance);
  registerDomainRoutes(app, storageInstance);

  // ── Platform service routes ───────────────────────────────────────────
  app.use("/api/feature-flags", requireAuth, requireRole("super_admin"), createFeatureFlagRoutes());
}

/**
 * Register all routes and create HTTP server
 * This is the canonical HTTP route registration entry point for the API runtime.
 */
export async function registerRoutes(app: Express): Promise<PlatformServer> {
  // Setup all routes using the global storage instance
  setupRoutes(app, storage as unknown as IStorage);
  
  // Centralized error handler (must be after all routes)
  app.use(errorHandler);
  
  // Create and return the HTTP server
  const httpServer = createPlatformServer(app);
  
  // Setup WebSocket server for real-time collaboration
  setupWebSocket(httpServer);
  
  return httpServer;
}
