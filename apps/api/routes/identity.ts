import { type Express } from "express";

import { createAuthRoutes } from "@domains/identity/api/auth.routes";
import { createPrivacyRoutes } from "@domains/identity/api/privacy.routes";
import { type IStorage } from "@interfaces/storage";

export function registerIdentityTransportRoutes(app: Express, storageInstance: IStorage): void {
	app.use("/api/auth", createAuthRoutes(storageInstance));
	app.use("/api/privacy", createPrivacyRoutes(storageInstance));
}