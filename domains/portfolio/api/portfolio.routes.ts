/**
 * Portfolio Module — Route Composition
 *
 * Composes all portfolio sub-route files into a single createPortfolioRoutes factory.
 * Serves as the canonical portfolio route entry point.
 */
import { Router } from "express";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import { createPortfolioCoreRoutes } from "./portfolio-core.routes";
import { createPortfolioGatesRoutes } from "./portfolio-gates.routes";
import { createPortfolioApprovalsRoutes } from "./portfolio-approvals.routes";
import { createPortfolioRisksRoutes } from "./portfolio-risks.routes";
import { createPortfolioIssuesRoutes } from "./portfolio-issues.routes";
import { createPortfolioWbsRoutes } from "./portfolio-wbs.routes";
import { createPortfolioStakeholdersRoutes } from "./portfolio-stakeholders.routes";
import { createPortfolioCommunicationsRoutes } from "./portfolio-communications.routes";
import { createPortfolioCostProcurementRoutes } from "./portfolio-cost-procurement.routes";
import { createPortfolioDocumentsRoutes } from "./portfolio-documents.routes";
import { createPortfolioMetadataRoutes } from "./portfolio-metadata.routes";
import { createPortfolioSummaryRoutes } from "./portfolio-summary.routes";
import { createPortfolioAgileRoutes } from "./portfolio-agile.routes";
import { createPortfolioUnitsRoutes } from "./portfolio-units.routes";

export function createPortfolioRoutes(storage: PortfolioStorageSlice): Router {
  const router = Router();

  // Core portfolio routes MUST be first (handles /stats, /summary, /projects, /pipeline)
  router.use(createPortfolioCoreRoutes(storage));
  router.use(createPortfolioGatesRoutes(storage));
  router.use(createPortfolioApprovalsRoutes(storage));
  router.use(createPortfolioRisksRoutes(storage));
  router.use(createPortfolioIssuesRoutes(storage));
  router.use(createPortfolioWbsRoutes(storage));
  router.use(createPortfolioAgileRoutes(storage));
  router.use(createPortfolioStakeholdersRoutes(storage));
  router.use(createPortfolioCommunicationsRoutes(storage));
  router.use(createPortfolioCostProcurementRoutes(storage));
  router.use(createPortfolioDocumentsRoutes(storage));
  router.use(createPortfolioMetadataRoutes(storage));
  router.use(createPortfolioSummaryRoutes(storage));
  router.use(createPortfolioUnitsRoutes(storage));

  return router;
}
