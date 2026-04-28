import { Router, type Request, type Response } from "express";
import type { OpsStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { buildTeamDeps } from "../application";
import {
  listTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  addTeamMember,
  removeTeamMember,
} from "../application";
import type { PortResult } from "../application";
import { validateBody } from "@interfaces/middleware/validateBody";
import { insertTeamSchema, updateTeamSchema, insertTeamMemberSchema } from "@shared/schema/demand";
import { cacheResponse, invalidateCache, CACHE_PROFILES } from "@interfaces/middleware/cacheResponse";
import { sendPaginated } from "@interfaces/middleware/pagination";

const send = (res: Response, r: PortResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

function getAuthUserId(req: Request): string {
  const userId = req.auth?.userId;
  if (!userId) throw new Error("Authentication context missing userId");
  return userId;
}

export function createTeamsRoutes(storage: OpsStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildTeamDeps(storage);

  router.get("/", auth.requireAuth, auth.requirePermission("team:view-members"), cacheResponse(CACHE_PROFILES.reference), async (req, res) => {
    sendPaginated(req, res, await listTeams(deps));
  });

  router.post("/", auth.requireAuth, auth.requirePermission("team:create"), validateBody(insertTeamSchema), invalidateCache("ref:"), async (req, res) => {

    send(res, await createTeam(deps, getAuthUserId(req), req.body, req.ip));
  });

  router.patch("/:id", auth.requireAuth, auth.requirePermission("team:update"), validateBody(updateTeamSchema), invalidateCache("ref:"), async (req, res) => {

    send(res, await updateTeam(deps, getAuthUserId(req), req.params.id as string, req.body, req.ip));
  });

  router.delete("/:id", auth.requireAuth, auth.requirePermission("team:delete"), async (req, res) => {
    send(res, await deleteTeam(deps, getAuthUserId(req), req.params.id as string, req.ip));
  });

  router.get("/:id/members", auth.requireAuth, auth.requirePermission("team:view-members"), async (req, res) => {
    send(res, await getTeamMembers(deps, req.params.id as string));
  });

  router.post("/:id/members", auth.requireAuth, auth.requirePermission("team:manage"), validateBody(insertTeamMemberSchema), async (req, res) => {

    send(res, await addTeamMember(deps, getAuthUserId(req), req.params.id as string, req.body, req.ip));
  });

  router.delete("/:id/members/:userId", auth.requireAuth, auth.requirePermission("team:manage"), async (req, res) => {
    send(res, await removeTeamMember(deps, getAuthUserId(req), req.params.id as string, req.params.userId as string, req.ip));
  });

  return router;
}
