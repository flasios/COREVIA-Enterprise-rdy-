import { Router } from "express";
import type { IComplianceStoragePort } from "@interfaces/storage/ports";
import { createAuthMiddleware, type AuthStorageSlice } from "@interfaces/middleware/auth";
import { buildComplianceDeps } from "../application/buildDeps";
import {
  runComplianceCheck,
  getComplianceStatus,
  getComplianceRunHistory,
  applyComplianceFix,
  listComplianceRules,
} from "../application/useCases";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";
import { sendPaginated } from "@interfaces/middleware/pagination";

// ── Zod schemas ───────────────────────────────────
const runComplianceBodySchema = z.object({
  triggerSource: z.string().optional(),
}).passthrough();

export function createComplianceRouter(storage: IComplianceStoragePort & AuthStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildComplianceDeps(storage);

  // POST /api/compliance/run/:reportId - Run compliance check on a business case
  router.post("/run/:reportId", auth.requireAuth, auth.requirePermission("compliance:view"), validateBody(runComplianceBodySchema), async (req, res) => {

    try {
      const userId = req.auth!.userId;
      const result = await runComplianceCheck(deps, req.params.reportId as string, userId, req.body.triggerSource);
      if (!result.success) return res.status(result.status).json(result);
      res.json({ success: true, data: result.data });
    } catch (error) {
      logger.error("Error running compliance check:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to run compliance check",
      });
    }
  });

  // GET /api/compliance/status/:reportId - Get latest compliance run for a report
  router.get("/status/:reportId", auth.requireAuth, auth.requirePermission("compliance:view"), asyncHandler(async (req, res) => {
    const result = await getComplianceStatus(deps, req.params.reportId as string);
    if (!result.success) return res.status(result.status).json(result);
    res.json({ success: true, data: result.data });
  }));

  // GET /api/compliance/runs/:reportId - Get compliance run history for a report
  router.get("/runs/:reportId", auth.requireAuth, auth.requirePermission("compliance:view"), asyncHandler(async (req, res) => {
    const result = await getComplianceRunHistory(deps, req.params.reportId as string);
    if (!result.success) return res.status(result.status).json(result);
    res.json({ success: true, data: result.data });
  }));

  // POST /api/compliance/apply-fix/:violationId - Apply suggested fix to business case
  router.post("/apply-fix/:violationId", auth.requireAuth, auth.requirePermission("report:update-any"), async (req, res) => {
    try {
      const userId = req.auth!.userId;
      const violationId = parseInt(req.params.violationId as string);
      const result = await applyComplianceFix(deps, violationId, userId);
      if (!result.success) return res.status(result.status).json(result);
      res.json({ success: true, message: result.data.message });
    } catch (error) {
      logger.error("Error applying fix:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to apply fix",
      });
    }
  });

  // GET /api/compliance/rules - Get published compliance rules
  router.get("/rules", auth.requireAuth, auth.requirePermission("compliance:view"), asyncHandler(async (req, res) => {
    const result = await listComplianceRules(deps, req.query.category as string | undefined);
    if (!result.success) return res.status(result.status).json(result);
    sendPaginated(req, res, { success: true as const, data: result.data });
  }));

  return router;
}
