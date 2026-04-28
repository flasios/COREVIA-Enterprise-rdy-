import { Router } from "express";
import type { IGovernanceStoragePort } from "@interfaces/storage/ports";
import { createAuthMiddleware, type AuthStorageSlice } from "@interfaces/middleware/auth";
import { buildBusinessCaseDeps } from "../application/buildDeps";
import type { GovResult } from "../application";
import { getBusinessCase } from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";

const send = (res: import("express").Response, r: GovResult) =>
  r.success ? res.json(r) : res.status(r.status).json(r);

export function createBusinessCasesRoutes(storage: IGovernanceStoragePort & AuthStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildBusinessCaseDeps(storage);

  router.get("/:id", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    send(res, await getBusinessCase(deps, req.params.id as string));
  }));

  return router;
}
