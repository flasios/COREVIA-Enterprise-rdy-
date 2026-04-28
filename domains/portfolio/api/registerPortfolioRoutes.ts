import { type Express } from "express";
import type { PortfolioStorageSlice } from "../application/buildDeps";
import type { IIntelligenceStoragePort, IKnowledgeStoragePort } from "@interfaces/storage/ports";
import { createAuthMiddleware, requireAuth } from "@interfaces/middleware/auth";
import { createPortfolioRoutes } from "./portfolio.routes";
import { createProjectsRoutes } from "./projects.routes";
import { createDashboardBootstrapRoutes } from "./dashboard-bootstrap.routes";
import { createReportingRoutes } from "./reporting.routes";
import {
  createSynergyOpportunitiesRoutes,
  createSynergyDetectionRoutes,
} from "./synergy.routes";
import { buildSynergyDeps, buildReportingDeps } from "../application/buildDeps";
import { createVersionsWorkflowRoutes } from "../../demand";

export function registerPortfolioCoreRoutes(
  app: Express,
  storageInstance: PortfolioStorageSlice & IIntelligenceStoragePort & IKnowledgeStoragePort,
): void {
  const auth = createAuthMiddleware(storageInstance);
  const synergyDeps = buildSynergyDeps(storageInstance);
  app.use("/api/synergy-opportunities", requireAuth, createSynergyOpportunitiesRoutes(storageInstance));
  app.use("/api/synergy-detection", requireAuth, createSynergyDetectionRoutes(storageInstance, synergyDeps));
  app.use("/api/portfolio", requireAuth, auth.requirePermission("portfolio:view"), createPortfolioRoutes(storageInstance));
  app.use("/api/projects", requireAuth, auth.requirePermission("project:view"), createProjectsRoutes(storageInstance));
}
export function registerPortfolioExtendedRoutes(
  app: Express,
  storageInstance: PortfolioStorageSlice & IIntelligenceStoragePort & IKnowledgeStoragePort,
): void {
  const reportingDeps = buildReportingDeps();
  app.use("/api/versions", requireAuth, createVersionsWorkflowRoutes(storageInstance));
  app.use("/api/dashboard", requireAuth, createDashboardBootstrapRoutes());
  app.use("/api/reporting", requireAuth, createReportingRoutes(storageInstance, reportingDeps));
}
