/**
 * Monitoring routes — audit trail, stats, health check.
 * Mounted at /api/corevia  (prefix handled by parent router).
 */
import { Router, Request, Response } from "express";
import { coreviaStorage } from "../storage";
import { agentRuntime } from "../agents/agent-runtime";

const router = Router();

// ── Audit trail ────────────────────────────────────────────────────────

router.get("/audit-trail", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const eventType = req.query.eventType as string | undefined;
    const decisionSpineId = req.query.decisionSpineId as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    const result = await coreviaStorage.getAllBrainEvents({ limit, offset, eventType, decisionSpineId, dateFrom, dateTo });
    res.json({ success: true, ...result });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Failed to fetch audit trail" });
  }
});

router.get("/audit-trail/event-types", async (_req: Request, res: Response) => {
  try {
    const types = await coreviaStorage.getBrainEventTypes();
    res.json({ success: true, eventTypes: types });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Failed to fetch event types" });
  }
});

router.get("/audit-trail/today-summary", async (_req: Request, res: Response) => {
  try {
    const summary = await coreviaStorage.getTodayBrainEventsSummary();
    res.json({ success: true, summary });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Failed to fetch today summary" });
  }
});

// ── Stats ──────────────────────────────────────────────────────────────

router.get("/stats/pipeline", async (req: Request, res: Response) => {
  try {
    const tenant = req.tenant as { organizationId?: string | null; isSystemAdmin?: boolean } | undefined;
    const tenantOrgId = tenant?.organizationId || null;
    const isSystemAdmin = Boolean(tenant?.isSystemAdmin);

    const stats = await coreviaStorage.getPipelineStatsScoped({
      organizationId: tenantOrgId,
      isSystemAdmin,
    });
    res.json({ success: true, stats });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Failed to fetch pipeline stats" });
  }
});

router.get("/stats/engines", async (_req: Request, res: Response) => {
  try {
    const stats = await coreviaStorage.getEngineStats();
    res.json({ success: true, stats });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Failed to fetch engine stats" });
  }
});

router.get("/stats/learning", async (_req: Request, res: Response) => {
  try {
    const stats = await coreviaStorage.getLearningStats();
    res.json({ success: true, stats });
  } catch (_error) {
    res.status(500).json({ success: false, error: "Failed to fetch learning stats" });
  }
});

// ── Health check ───────────────────────────────────────────────────────

router.get("/healthz", async (_req: Request, res: Response) => {
  try {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      components: {
        pipeline: {
          status: "operational",
          layers: 8,
        },
        intelligence: {
          status: "operational",
          engines: ["internal", "hybrid", "distillation", "r1-learning"],
        },
        agents: {
          status: "operational",
          count: agentRuntime.listAgents().length,
        },
        rag: {
          status: "operational",
        },
      },
      version: "1.0.0",
    };

    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Health check failed",
    });
  }
});

export default router;
