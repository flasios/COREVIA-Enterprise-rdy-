import { Router } from "express";
import type { DemandStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import {
  StorageDemandReportRepository,
  StorageConversionRequestRepository,
  StoragePortfolioProjectCreator,
  StorageNotificationSender,
} from "../application";
import type { DemandDeps } from "../application";
import type { DemandAnalysisEngine } from "../domain";
import {
  listConversionRequests,
  getConversionRequest,
  getConversionStats,
  createConversionRequest,
  approveConversionRequest,
  rejectConversionRequest,
} from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

function buildDeps(storage: DemandStorageSlice): DemandDeps {
  return {
    reports: new StorageDemandReportRepository(storage),
    conversions: new StorageConversionRequestRepository(storage),
    analysis: null as unknown as DemandAnalysisEngine, // Not needed for conversion routes
    projects: new StoragePortfolioProjectCreator(storage),
    notifications: new StorageNotificationSender(storage),
  };
}

// ── Zod Schemas ─────────────────────────────────────────────────
const createConversionSchema = z.object({
  demandId: z.string(),
  projectName: z.string(),
  projectDescription: z.string().optional(),
  priority: z.string().optional(),
  proposedBudget: z.any().optional(),
  proposedStartDate: z.string().optional(),
  proposedEndDate: z.string().optional(),
  conversionData: z.any().optional(),
});
const approveConversionSchema = z.object({
  decisionNotes: z.string().optional(),
});
const rejectConversionSchema = z.object({
  rejectionReason: z.string(),
  decisionNotes: z.string().optional(),
});

export function createDemandConversionRoutes(storage: DemandStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildDeps(storage);

  // GET /api/demand-conversion-requests - Get all conversion requests
  router.get("/", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const { status } = req.query;
    const result = await listConversionRequests(deps, typeof status === "string" ? status : undefined);
    if (!result.success) return res.status(result.status).json({ success: false, error: result.error });
    res.json({ success: true, requests: result.data });
  }));

  // GET /api/demand-conversion-requests/stats - Get conversion request statistics
  router.get("/stats", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (_req, res) => {
    const result = await getConversionStats(deps);
    if (!result.success) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  }));

  // GET /api/demand-conversion-requests/:id - Get specific conversion request
  router.get("/:id", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const result = await getConversionRequest(deps, id);
    if (!result.success) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  }));

  // POST /api/demand-conversion-requests - Create new conversion request (submit for PMO approval)
  router.post("/", auth.requireAuth, auth.requirePermission("report:update-self"), validateBody(createConversionSchema), asyncHandler(async (req, res) => {

    const { demandId, projectName, projectDescription, priority, proposedBudget, proposedStartDate, proposedEndDate, conversionData } = req.body;
    const user = req.user;

    const result = await createConversionRequest(deps, {
      demandId,
      projectName,
      projectDescription,
      priority,
      proposedBudget,
      proposedStartDate,
      proposedEndDate,
      conversionData,
      userId: user?.id,
      userDisplayName: user?.displayName,
      userName: user?.username,
    });

    if (!result.success) return res.status(result.status).json({ error: result.error });
    res.status(201).json(result.data);
  }));

  // PUT /api/demand-conversion-requests/:id/approve - PMO approves conversion request
  router.put("/:id/approve", auth.requireAuth, auth.requirePermission("workflow:advance"), validateBody(approveConversionSchema), asyncHandler(async (req, res) => {

    const { id } = req.params as { id: string };
    const { decisionNotes } = req.body;
    const user = req.user;

    const result = await approveConversionRequest(
      deps,
      id,
      { userId: user?.id, displayName: user?.displayName, userName: user?.username },
      decisionNotes,
    );

    if (!result.success) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  }));

  // PUT /api/demand-conversion-requests/:id/reject - PMO rejects conversion request
  router.put("/:id/reject", auth.requireAuth, auth.requirePermission("workflow:advance"), validateBody(rejectConversionSchema), asyncHandler(async (req, res) => {

    const { id } = req.params as { id: string };
    const { rejectionReason, decisionNotes } = req.body;
    const user = req.user;

    const result = await rejectConversionRequest(
      deps,
      id,
      { userId: user?.id, displayName: user?.displayName, userName: user?.username },
      rejectionReason,
      decisionNotes,
    );

    if (!result.success) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  }));

  return router;
}
