import { Router, Response } from "express";
import { ZodError } from "zod";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware, AuthRequest, getAuthenticatedOrganizationId } from "@interfaces/middleware/auth";
import { insertCostEntrySchema, insertProcurementItemSchema, insertProcurementPaymentSchema, updateCostEntrySchema, updateProcurementItemSchema, updateProcurementPaymentSchema } from "@shared/schema";
import { buildCostProcDeps } from "../application/buildDeps";
import {
  getCostEntries, createCostEntry, updateCostEntry, deleteCostEntry,
  getProcurementItems, createProcurementItem, updateProcurementItem, deleteProcurementItem,
  getPayments, createPayment, updatePayment, deletePayment,
  updateWbsTaskActualCost,
} from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

// ── Zod schemas for request validation ──────────────────────
const createCostEntryBody = z.object({}).passthrough();
const createProcurementItemBody = z.object({}).passthrough();
const createPaymentBody = z.object({}).passthrough();
const updateActualCostBody = z.object({ actualCost: z.union([z.string(), z.number()]) });

// Cost-procurement routes return raw data (not PortResult-wrapped) to preserve existing API contract.
const sendRaw = (res: Response, r: { success: boolean; data?: unknown; message?: string; error?: string; status?: number }, statusCode = 200) => {
  if (r.success) {
    if (r.data !== null && r.data !== undefined) return res.status(statusCode).json(r.data);
    return res.json({ message: r.message || "OK" });
  }
  return res.status(r.status || 500).json({ message: r.error });
};

export function createPortfolioCostProcurementRoutes(storage: PortfolioStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildCostProcDeps(storage);

  router.get("/projects/:projectId/cost-entries", auth.requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
    sendRaw(res, await getCostEntries(deps, req.params.projectId!));
  }));

  router.post("/projects/:projectId/cost-entries", auth.requireAuth, validateBody(createCostEntryBody), async (req: AuthRequest, res: Response) => {

    try {
      const organizationId = getAuthenticatedOrganizationId(req);
      const data = insertCostEntrySchema.parse({
        ...req.body,
        projectId: req.params.projectId!,
        ...(organizationId ? { organizationId } : {}),
        createdBy: req.auth?.userId || req.user?.id || null,
      });
      sendRaw(res, await createCostEntry(deps, data as unknown as Record<string, unknown>), 201);
    } catch (error: unknown) {
      if (error instanceof ZodError) res.status(400).json({ message: "Invalid cost entry data", errors: error.errors });
      else { logger.error("Error creating cost entry:", error); res.status(500).json({ message: "Failed to create cost entry" }); }
    }
  });

  router.patch("/projects/:projectId/cost-entries/:id", auth.requireAuth, validateBody(updateCostEntrySchema), asyncHandler(async (req: AuthRequest, res: Response) => {

    const updates = req.body;
    if (updates.status === "approved") updates.approvedBy = req.user?.id || null;
    sendRaw(res, await updateCostEntry(deps, req.params.id!, updates));
  }));

  router.delete("/projects/:projectId/cost-entries/:id", auth.requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
    sendRaw(res, await deleteCostEntry(deps, req.params.id!));
  }));

  router.get("/projects/:projectId/procurement-items", auth.requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
    sendRaw(res, await getProcurementItems(deps, req.params.projectId!));
  }));

  router.post("/projects/:projectId/procurement-items", auth.requireAuth, validateBody(createProcurementItemBody), async (req: AuthRequest, res: Response) => {

    try {
      const organizationId = getAuthenticatedOrganizationId(req);
      const data = insertProcurementItemSchema.parse({
        ...req.body,
        projectId: req.params.projectId!,
        ...(organizationId ? { organizationId } : {}),
        createdBy: req.auth?.userId || req.user?.id || null,
      });
      sendRaw(res, await createProcurementItem(deps, data as unknown as Record<string, unknown>), 201);
    } catch (error: unknown) {
      if (error instanceof ZodError) res.status(400).json({ message: "Invalid procurement data", errors: error.errors });
      else { logger.error("Error creating procurement item:", error); res.status(500).json({ message: "Failed to create procurement item" }); }
    }
  });

  router.patch("/projects/:projectId/procurement-items/:id", auth.requireAuth, validateBody(updateProcurementItemSchema), asyncHandler(async (req: AuthRequest, res: Response) => {

    const updates = req.body;
    if (updates.status === "approved") updates.approvedBy = req.user?.id || null;
    sendRaw(res, await updateProcurementItem(deps, req.params.id!, updates));
  }));

  router.delete("/projects/:projectId/procurement-items/:id", auth.requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
    sendRaw(res, await deleteProcurementItem(deps, req.params.id!));
  }));

  // ==========================================
  // PROCUREMENT PAYMENTS
  // ==========================================

  router.get("/projects/:projectId/payments", auth.requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
    sendRaw(res, await getPayments(deps, req.params.projectId!));
  }));

  // Uses storage directly — no port for getProcurementItemPayments
  router.get("/projects/:projectId/procurement-items/:procItemId/payments", auth.requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { procItemId } = req.params as { procItemId: string };
    const payments = await storage.getProcurementItemPayments(procItemId);
    res.json(payments);
  }));

  router.post("/projects/:projectId/payments", auth.requireAuth, validateBody(createPaymentBody), async (req: AuthRequest, res: Response) => {

    try {
      const organizationId = getAuthenticatedOrganizationId(req);
      const data = insertProcurementPaymentSchema.parse({
        ...req.body,
        projectId: req.params.projectId!,
        ...(organizationId ? { organizationId } : {}),
        createdBy: req.auth?.userId || req.user?.id || null,
      });
      sendRaw(res, await createPayment(deps, data as unknown as Record<string, unknown>), 201);
    } catch (error: unknown) {
      if (error instanceof ZodError) res.status(400).json({ message: "Invalid payment data", errors: error.errors });
      else { logger.error("Error creating payment:", error); res.status(500).json({ message: "Failed to create payment" }); }
    }
  });

  router.patch("/projects/:projectId/payments/:id", auth.requireAuth, validateBody(updateProcurementPaymentSchema), asyncHandler(async (req: AuthRequest, res: Response) => {

    const updates = req.body;
    if (updates.status === "approved") updates.approvedBy = req.user?.id || null;
    sendRaw(res, await updatePayment(deps, req.params.id!, updates));
  }));

  router.delete("/projects/:projectId/payments/:id", auth.requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
    sendRaw(res, await deletePayment(deps, req.params.id!));
  }));

  // ==========================================
  // WBS TASK ACTUAL COST UPDATE
  // ==========================================

  router.patch("/projects/:projectId/wbs-tasks/:taskId/actual-cost", auth.requireAuth, validateBody(updateActualCostBody), asyncHandler(async (req: AuthRequest, res: Response) => {

    const { taskId } = req.params as { taskId: string };
    const { actualCost } = req.body;
    if (actualCost === undefined || actualCost === null) { res.status(400).json({ message: "actualCost is required" }); return; }
    const r = await updateWbsTaskActualCost(deps, taskId, String(actualCost));
    if (r.success) res.json({ message: "Actual cost updated", taskId, actualCost });
    else res.status(r.status).json({ message: r.error });
  }));

  return router;
}
