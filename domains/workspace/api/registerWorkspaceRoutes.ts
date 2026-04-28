import { type Express } from "express";

import { createAuthMiddleware, requireAuth, type AuthStorageSlice } from "@interfaces/middleware/auth";

import { createIntelligentWorkspaceRoutes } from "./intelligent-workspace.routes";

export function registerWorkspaceRoutes(app: Express, storageInstance: AuthStorageSlice): void {
	const auth = createAuthMiddleware(storageInstance);
	app.use("/api/intelligent-workspace", requireAuth, auth.requirePermission("report:read"), createIntelligentWorkspaceRoutes());
}