import { type Express } from "express";

import { type IStorage } from "@interfaces/storage";

import { coreviaHealthzController } from "../controllers";
import { correlationIdMiddleware, tenantScopeMiddleware } from "../middleware";
import healthRoutes from "./health";
import { registerIdentityTransportRoutes } from "./identity";

export function registerPlatformRoutes(app: Express, storageInstance: IStorage): void {
	app.use(correlationIdMiddleware);

	app.use("/health", healthRoutes);
	app.use("/api/health", healthRoutes);
	app.get("/api/corevia/healthz", coreviaHealthzController);

	app.use("/api", tenantScopeMiddleware);
	registerIdentityTransportRoutes(app, storageInstance);
}