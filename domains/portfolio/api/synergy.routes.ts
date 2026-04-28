import { Router } from "express";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import type { IIntelligenceStoragePort } from "@interfaces/storage/ports";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import type { SynergyDetectorPort } from "../domain/ports";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";
import { sendPaginated } from "@interfaces/middleware/pagination";

/** Synergy routes need portfolio + intelligence storage (synergy tables live in intelligence port) */
type SynergyStorageSlice = PortfolioStorageSlice & IIntelligenceStoragePort;

// ── Zod schemas ───────────────────────────────────
const updateSynergySchema = z.object({
  status: z.string().optional(),
  validatedBy: z.string().optional(),
}).passthrough();

export function createSynergyOpportunitiesRoutes(storage: SynergyStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);

  // GET /api/synergy-opportunities - List all synergy opportunities
  router.get("/", auth.requireAuth, asyncHandler(async (req, res) => {
    const { status } = req.query;

    const opportunities = status
      ? await storage.getSynergyOpportunitiesByStatus(status as string)
      : await storage.getAllSynergyOpportunities();

    sendPaginated(req, res, { success: true as const, data: opportunities! });
  }));

  // GET /api/synergy-opportunities/:id - Get single synergy opportunity
  router.get("/:id", auth.requireAuth, asyncHandler(async (req, res) => {
    const synergy = await storage.getSynergyOpportunity(req.params.id!);

    if (!synergy) {
      return res.status(404).json({ success: false, error: "Synergy opportunity not found" });
    }

    res.json({ success: true, data: synergy });
  }));

  // PATCH /api/synergy-opportunities/:id - Update synergy status
  router.patch("/:id", auth.requireAuth, validateBody(updateSynergySchema), asyncHandler(async (req, res) => {

    const { status, validatedBy } = req.body;

    await storage.updateSynergyOpportunity(req.params.id!, {
      status,
      validatedBy: validatedBy || req.session.userId,
      validatedAt: status === 'validated' ? new Date() : undefined
    });

    res.json({ success: true });
  }));

  return router;
}

export function createSynergyDetectionRoutes(storage: SynergyStorageSlice, deps: { synergy: SynergyDetectorPort }): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);

  // POST /api/demand-reports/:id/detect-synergies - Detect collaboration opportunities
  router.post("/:id/detect-synergies", auth.requireAuth, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const demandReport = await storage.getDemandReport(id!);

    if (!demandReport) {
      return res.status(404).json({ success: false, error: "Demand report not found" });
    }

    const matches = await deps.synergy.detectSynergies(demandReport);

    if (matches.length === 0) {
      return res.json({ success: true, data: { matches: [], message: "No synergies detected" } });
    }

    const synergy = await deps.synergy.createSynergyOpportunity(
      id!,
      matches,
      req.session.userId!
    );

    const created = await storage.createSynergyOpportunity(synergy as Parameters<SynergyStorageSlice["createSynergyOpportunity"]>[0]);

    res.json({ success: true, data: { synergy: created, matches } });
  }));

  return router;
}
