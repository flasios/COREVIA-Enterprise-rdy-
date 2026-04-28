import { type Express } from "express";
import { type IStorage } from "../storage";
import {
  registerIntelligenceCoreRoutes,
  registerIntelligenceExtendedRoutes,
} from "../../domains/intelligence/api";
import {
  registerKnowledgeRoutes,
} from "../../domains/knowledge/api";
import {
  registerOperationsCoreRoutes,
} from "../../domains/operations/api";
import { registerDemandRoutes } from "../../domains/demand/api";
import { registerEaRoutes } from "../../domains/ea/api";
import {
  registerPortfolioCoreRoutes,
  registerPortfolioExtendedRoutes,
} from "../../domains/portfolio/api";
import {
  registerGovernanceRoutes,
} from "../../domains/governance/api";
import { registerComplianceRoutes } from "../../domains/compliance/api";
import { registerIntegrationRoutes } from "../../domains/integration/api";
import { registerWorkspaceRoutes } from "../../domains/workspace/api";
import {
  registerNotificationsCoreRoutes,
  registerNotificationsExtendedRoutes,
} from "../../domains/notifications/api";

export function registerDomainRoutes(
  app: Express,
  storageInstance: IStorage,
): void {
  registerIntelligenceCoreRoutes(app, storageInstance);
  registerKnowledgeRoutes(app, storageInstance);
  registerOperationsCoreRoutes(app, storageInstance);
  registerDemandRoutes(app, storageInstance);
  registerEaRoutes(app, storageInstance);
  registerPortfolioCoreRoutes(app, storageInstance);
  registerGovernanceRoutes(app, storageInstance);
  registerComplianceRoutes(app, storageInstance);
  registerWorkspaceRoutes(app, storageInstance);
  registerNotificationsCoreRoutes(app, storageInstance);
  registerPortfolioExtendedRoutes(app, storageInstance);
  registerIntelligenceExtendedRoutes(app);
  registerIntegrationRoutes(app, storageInstance);
  registerNotificationsExtendedRoutes(app, storageInstance);
}
