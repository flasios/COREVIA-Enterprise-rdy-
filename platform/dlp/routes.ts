/**
 * DLP Admin API Routes
 *
 * Provides dashboard data for the DLP admin UI:
 *   GET /api/admin/dlp/stats     — Aggregated statistics
 *   GET /api/admin/dlp/events    — Recent events (paginated)
 *   GET /api/admin/dlp/patterns  — Pattern definitions
 *   GET /api/admin/dlp/config    — Current DLP configuration
 *
 * Access control is enforced at the mount point.
 *
 * @module platform
 */

import { Router, type Request, type Response } from "express";
import { getDlpStats, getDlpEvents, getDlpPatternDefinitions } from "./eventStore";
import { CLASSIFICATION_LEVELS } from "./engine";

const router = Router();

// ── GET /api/admin/dlp/stats ────────────────────────────────────────────────
router.get("/stats", (_req: Request, res: Response) => {
  const stats = getDlpStats();
  res.json({ success: true, data: stats });
});

// ── GET /api/admin/dlp/events ───────────────────────────────────────────────
router.get("/events", (req: Request, res: Response) => {
  const limit = Math.min(Number.parseInt(String(typeof req.query.limit === "string" ? req.query.limit : "50"), 10), 500);
  const type = req.query.type as string | undefined;
  const severity = req.query.severity as string | undefined;
  const action = req.query.action as string | undefined;
  const since = req.query.since as string | undefined;

  type FilterOpts = Exclude<Parameters<typeof getDlpEvents>[0], undefined>;
  const events = getDlpEvents({
    limit,
    type: type as FilterOpts["type"],
    severity: severity as FilterOpts["severity"],
    action: action as FilterOpts["action"],
    since,
  });

  res.json({
    success: true,
    data: events,
    total: events.length,
    limit,
  });
});

// ── GET /api/admin/dlp/patterns ─────────────────────────────────────────────
router.get("/patterns", (_req: Request, res: Response) => {
  const patterns = getDlpPatternDefinitions();
  res.json({ success: true, data: patterns });
});

// ── GET /api/admin/dlp/config ───────────────────────────────────────────────
router.get("/config", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      enabled: process.env.DLP_ENABLED !== "false",
      classificationLevels: CLASSIFICATION_LEVELS,
      policies: {
        defaultApi: { minSeverity: "high", action: "redact" },
        aiResponses: { minSeverity: "medium", action: "redact" },
        exports: { maxExportsPerWindow: 50, maxRecordsPerWindow: 10000, windowMinutes: 15 },
        uploads: { minSeverity: "high", action: "log" },
      },
      piiPatterns: getDlpPatternDefinitions().length,
    },
  });
});

export { router as dlpAdminRoutes };
