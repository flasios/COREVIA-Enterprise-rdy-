import { Router } from "express";
import type { OpsStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { buildCacheDeps } from "../application";
import { getCacheStats, clearCache } from "../application";
import type { PortResult } from "../application";

const send = (res: any, r: PortResult) => // eslint-disable-line @typescript-eslint/no-explicit-any
  r.success ? res.json(r) : res.status(r.status).json(r);

export function createCacheRoutes(storage: OpsStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildCacheDeps();

  router.get("/stats", auth.requireAuth, auth.requireRole("manager"), async (_req, res) => {
    send(res, await getCacheStats(deps));
  });

  router.post("/clear", auth.requireAuth, auth.requireRole("manager"), async (_req, res) => {
    send(res, await clearCache(deps));
  });

  return router;
}
