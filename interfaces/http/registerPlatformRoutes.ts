import { type Express } from "express";
import { type IStorage } from "../storage";
import { tenantScopeMiddleware } from "../middleware/tenantScope";
import { correlationIdMiddleware } from "../middleware/correlationId";
import { healthRoutes } from "../../domains/platform/api";
import { registerIdentityRoutes } from "../../domains/identity/api";

export function registerPlatformRoutes(app: Express, storageInstance: IStorage): void {
  app.use(correlationIdMiddleware);

  app.use("/health", healthRoutes);
  app.use("/api/health", healthRoutes);

  app.get("/api/corevia/healthz", (_req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      components: {
        pipeline: { status: "operational", layers: 8 },
        intelligence: { status: "operational", engines: ["internal", "hybrid", "distillation"] },
        agents: { status: "operational" },
        rag: { status: "operational" },
      },
      version: "1.0.0",
    });
  });

  app.use("/api", tenantScopeMiddleware);
  registerIdentityRoutes(app, storageInstance);
}
