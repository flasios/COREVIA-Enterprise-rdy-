/**
 * Intelligence Module — Proactive Intelligence Routes (buildDeps + useCases)
 *
 * Canonical proactive intelligence route composition for the intelligence domain.
 */
import { Router, Request, Response } from "express";
import type { AIAssistantStorageSlice } from "../application/buildDeps";
import {
  buildProactiveDeps,
  detectAnomalies,
  calculateRiskPredictions,
  generateDailyBriefing,
  executeWorkflow,
  createAutoAlerts,
} from "../application";
import { logger } from "@platform/logging/Logger";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";
/* ─── Zod schemas ────────────────────────────────────────────────── */
const executeWorkflowSchema = z.object({
  steps: z.array(z.any()),
});
/* ─── Routes ────────────────────────────────────────────────── */

export function createProactiveIntelligenceRoutes(_storage: AIAssistantStorageSlice): Router {
  const router = Router();
  const deps = buildProactiveDeps();

  router.get("/anomalies", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const result = await detectAnomalies(deps);
      res.json(result);
    } catch (error) {
      logger.error("[Proactive Intelligence] Error detecting anomalies:", error);
      res.status(500).json({ error: "Failed to detect anomalies" });
    }
  });

  router.get("/risk-predictions", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const result = await calculateRiskPredictions(deps);
      res.json(result);
    } catch (error) {
      logger.error("[Proactive Intelligence] Error calculating risks:", error);
      res.status(500).json({ error: "Failed to calculate risk predictions" });
    }
  });

  router.get("/daily-briefing", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const result = await generateDailyBriefing(deps);
      res.json(result);
    } catch (error) {
      logger.error("[Proactive Intelligence] Error generating briefing:", error);
      res.status(500).json({ error: "Failed to generate daily briefing" });
    }
  });

  router.post("/execute-workflow", validateBody(executeWorkflowSchema), async (req: Request, res: Response) => {

    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const result = await executeWorkflow(deps, req.body.steps, req.session.userId);
      if (!result.success) return res.status(result.status).json(result);
      res.json(result);
    } catch (error) {
      logger.error("[Proactive Intelligence] Error executing workflow:", error);
      res.status(500).json({ error: "Failed to execute workflow" });
    }
  });

  router.post("/auto-alerts", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const result = await createAutoAlerts(deps, req.session.userId);
      res.json(result);
    } catch (error) {
      logger.error("[Proactive Intelligence] Error creating alerts:", error);
      res.status(500).json({ error: "Failed to create automatic alerts" });
    }
  });

  return router;
}
