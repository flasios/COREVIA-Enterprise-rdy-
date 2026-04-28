/**
 * Intelligence Module — Analytics Routes (buildDeps + useCases)
 *
 * Canonical analytics route composition for the intelligence domain.
 */
import { Router } from "express";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import type { AIAssistantStorageSlice } from "../application/buildDeps";
import {
  buildAnalyticsDeps,
  getAnalyticsSummary,
  getAnalyticsTrends,
  getTopDocuments,
  detectKnowledgeGaps,
  calculateROI,
  refreshAnalytics,
  getPortfolioHealth,
  getDemandForecast,
  runMonteCarloSimulation,
  getIntegrationStatus,
  getDemandPlanService,
} from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";
import { cacheResponse, CACHE_PROFILES } from "@interfaces/middleware/cacheResponse";

/* ─── Routes ────────────────────────────────────────────────── */

export function createAnalyticsRoutes(storage: AIAssistantStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildAnalyticsDeps(storage);

  router.get("/summary", auth.requireAuth, auth.requirePermission('knowledge:analytics'), cacheResponse(CACHE_PROFILES.analytics), async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const result = await getAnalyticsSummary(deps, days);
      res.json(result);
    } catch (error) {
      logger.error("Error getting analytics summary:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to get analytics summary" });
    }
  });

  router.get("/trends", auth.requireAuth, auth.requirePermission('knowledge:analytics'), cacheResponse(CACHE_PROFILES.analytics), async (req, res) => {
    try {
      const metric = req.query.metric as string || 'queries';
      const days = parseInt(req.query.days as string) || 30;
      const result = await getAnalyticsTrends(deps, metric, days);
      res.json(result);
    } catch (error) {
      logger.error("Error getting analytics trends:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to get analytics trends" });
    }
  });

  router.get("/documents", auth.requireAuth, auth.requirePermission('knowledge:analytics'), cacheResponse(CACHE_PROFILES.analytics), async (req, res) => {
    try {
      const sortBy = req.query.sortBy as string || 'citations';
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await getTopDocuments(deps, sortBy, limit);
      res.json(result);
    } catch (error) {
      logger.error("Error getting top documents:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to get top documents" });
    }
  });

  router.get("/gaps", auth.requireAuth, auth.requirePermission('knowledge:analytics'), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await detectKnowledgeGaps(deps, limit);
      res.json(result);
    } catch (error) {
      logger.error("Error detecting knowledge gaps:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to detect knowledge gaps" });
    }
  });

  router.get("/roi", auth.requireAuth, auth.requirePermission('knowledge:analytics'), async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const hourlyRate = parseFloat(req.query.hourlyRate as string) || 50;
      const result = await calculateROI(deps, days, hourlyRate);
      res.json(result);
    } catch (error) {
      logger.error("Error calculating ROI:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to calculate ROI" });
    }
  });

  router.post("/refresh", auth.requireAuth, auth.requirePermission('knowledge:analytics'), async (req, res) => {
    try {
      const result = await refreshAnalytics(deps);
      res.json(result);
    } catch (error) {
      logger.error("Error refreshing analytics:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to refresh analytics" });
    }
  });

  // ===== PORTFOLIO & DEMAND ANALYTICS ENDPOINTS =====

  router.get("/portfolio-health", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const result = await getPortfolioHealth(deps);
    res.json(result);
  }));

  router.get("/demand-forecast", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const result = await getDemandForecast(deps);
    res.json(result);
  }));

  router.get("/monte-carlo-simulation", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const constraints = {
      budgetConstraint: req.query.budgetConstraint ? parseFloat(req.query.budgetConstraint as string) : undefined,
      resourceConstraint: req.query.resourceConstraint ? parseFloat(req.query.resourceConstraint as string) : undefined,
      timeConstraint: req.query.timeConstraint ? parseFloat(req.query.timeConstraint as string) : undefined,
    };
    const result = await runMonteCarloSimulation(deps, constraints);
    res.json(result);
  }));

  router.get("/integration-status", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const result = await getIntegrationStatus(deps);
    res.json(result);
  }));

  router.get("/demand-plan-service", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const result = await getDemandPlanService(deps);
    res.json(result);
  }));

  return router;
}
