import { type Express } from "express";

import { storage, type IStorage } from "@interfaces/storage";
import { setupWebSocket } from "@interfaces/websocket";
import { errorHandler } from "@platform/logging/ErrorHandler";
import { createPlatformServer, type PlatformServer } from "@platform/http/platformServer";

import { setupRoutes } from "./policy";

export async function registerRoutes(app: Express): Promise<PlatformServer> {
  setupRoutes(app, storage as unknown as IStorage);
  app.use(errorHandler);

  const httpServer = createPlatformServer(app);
  setupWebSocket(httpServer);
  return httpServer;
}

export type { PlatformServer } from "@platform/http/platformServer";