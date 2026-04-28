import { Router, type Request } from "express";
import { z } from "zod";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { validateBody } from "@interfaces/middleware/validateBody";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import { buildPortfolioUnitsDeps } from "../application/buildDeps";
import {
  addPortfolioUnitMember,
  assignProjectToPortfolioUnit,
  createPortfolioUnit,
  listPortfolioUnitMembers,
  listPortfolioUnitProjects,
  listPortfolioUnits,
  removePortfolioUnitMember,
  updatePortfolioUnit,
  type PortResult,
} from "../application";

const createUnitBody = z.object({
  name: z.string().min(2),
  sector: z.string().optional(),
  description: z.string().optional(),
  managerUserId: z.string().uuid().optional(),
});

const updateUnitBody = z.object({
  name: z.string().min(2).optional(),
  sector: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["active", "archived"]).optional(),
  managerUserId: z.string().uuid().nullable().optional(),
});

const addMemberBody = z.object({
  memberUserId: z.string().uuid(),
  role: z.enum(["manager", "analyst", "viewer"]),
});

const send = (res: import("express").Response, result: PortResult) =>
  result.success ? res.json(result) : res.status(result.status).json(result);

function getAuthUserId(req: Request): string {
  const userId = (req as Request & { auth?: { userId?: string } }).auth?.userId;
  if (!userId) throw new Error("Authentication context missing userId");
  return userId;
}

export function createPortfolioUnitsRoutes(storage: PortfolioStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildPortfolioUnitsDeps(storage);

  router.get(
    "/units",
    auth.requireAuth,
    asyncHandler(async (_req, res) => {
      send(res, await listPortfolioUnits(deps));
    }),
  );

  router.post(
    "/units",
    auth.requireAuth,
    auth.requirePermission("pmo:governance-review"),
    validateBody(createUnitBody),
    asyncHandler(async (req, res) => {
      send(res, await createPortfolioUnit(deps, getAuthUserId(req), req.body));
    }),
  );

  router.patch(
    "/units/:unitId",
    auth.requireAuth,
    auth.requirePermission("pmo:governance-review"),
    validateBody(updateUnitBody),
    asyncHandler(async (req, res) => {
      send(res, await updatePortfolioUnit(deps, req.params.unitId!, req.body));
    }),
  );

  router.get(
    "/units/:unitId/members",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      send(res, await listPortfolioUnitMembers(deps, req.params.unitId!));
    }),
  );

  router.post(
    "/units/:unitId/members",
    auth.requireAuth,
    auth.requirePermission("pmo:governance-review"),
    validateBody(addMemberBody),
    asyncHandler(async (req, res) => {
      send(res, await addPortfolioUnitMember(deps, getAuthUserId(req), req.params.unitId!, req.body));
    }),
  );

  router.delete(
    "/units/:unitId/members/:userId",
    auth.requireAuth,
    auth.requirePermission("pmo:governance-review"),
    asyncHandler(async (req, res) => {
      send(res, await removePortfolioUnitMember(deps, req.params.unitId!, req.params.userId!));
    }),
  );

  router.get(
    "/units/:unitId/projects",
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      send(res, await listPortfolioUnitProjects(deps, req.params.unitId!));
    }),
  );

  router.post(
    "/units/:unitId/projects/:projectId",
    auth.requireAuth,
    auth.requirePermission("pmo:governance-review"),
    asyncHandler(async (req, res) => {
      send(res, await assignProjectToPortfolioUnit(deps, req.params.unitId!, req.params.projectId!));
    }),
  );

  return router;
}
