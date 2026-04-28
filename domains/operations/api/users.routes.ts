import { Router, type Request, type Response } from "express";
import type { OpsStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { buildUserDeps } from "../application";
import {
  listUsers,
  getAvailableProjectManagers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
} from "../application";
import type { PortResult } from "../application";
import { validateBody } from "@interfaces/middleware/validateBody";
import { insertUserSchema, updateUserSchema } from "@shared/schema/platform";
import { cacheResponse, invalidateCache, CACHE_PROFILES } from "@interfaces/middleware/cacheResponse";
import { sendPaginated } from "@interfaces/middleware/pagination";

const send = (res: Response, r: PortResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

function getAuthUserId(req: Request): string | undefined {
  return req.auth?.userId;
}

export function createUsersRoutes(storage: OpsStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildUserDeps(storage);

  router.get("/", auth.requireAuth, auth.requirePermission("user:read"), cacheResponse(CACHE_PROFILES.reference), async (req, res) => {
    sendPaginated(req, res, await listUsers(deps));
  });

  // NOTE: This route MUST be before /api/users/:id to avoid :id matching "available-project-managers"
  router.get("/available-project-managers", auth.requireAuth, cacheResponse(CACHE_PROFILES.reference), async (_req, res) => {
    const r = await getAvailableProjectManagers(deps);
    // Legacy API shape: returns raw array
    if (r.success) { res.json(r.data); } else { res.status(r.status).json(r); }
  });

  router.get("/:id", auth.requireAuth, auth.requirePermission("user:read"), async (req, res) => {
    send(res, await getUser(deps, req.params.id as string));
  });

  router.post("/", auth.requireAuth, auth.requirePermission("user:create"), validateBody(insertUserSchema), invalidateCache("ref:"), async (req, res) => {

    const r = await createUser(deps, getAuthUserId(req), req.body, req.ip);
    if (r.success) { res.status(201).json(r); } else { res.status(r.status).json(r); }
  });

  router.patch("/:id", auth.requireAuth, auth.requirePermission("user:update"), validateBody(updateUserSchema), invalidateCache("ref:"), async (req, res) => {

    const authUserId = getAuthUserId(req);
    if (!authUserId) return res.status(401).json({ success: false, error: "Authentication required" });
    send(res, await updateUser(deps, authUserId, req.params.id as string, req.body, req.ip));
  });

  router.delete("/:id", auth.requireAuth, auth.requirePermission("user:delete"), async (req, res) => {
    const authUserId = getAuthUserId(req);
    if (!authUserId) return res.status(401).json({ success: false, error: "Authentication required" });
    send(res, await deactivateUser(deps, authUserId, req.params.id as string, req.ip));
  });

  return router;
}
