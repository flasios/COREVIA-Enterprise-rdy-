import { PostgresStorage } from "./postgres";

// ── Port interface re-exports (narrow per-module contracts) ────────────
export type {
  IIdentityStoragePort,
  IDemandStoragePort,
  IVersioningStoragePort,
  IGovernanceStoragePort,
  IOperationsStoragePort,
  IKnowledgeStoragePort,
  IComplianceStoragePort,
  IIntelligenceStoragePort,
  IPortfolioStoragePort,
  IPerformanceStoragePort,
  IEaRegistryStoragePort,
} from "./ports";

import type { IIdentityStoragePort } from "./ports/identity.port";
import type { IDemandStoragePort } from "./ports/demand.port";
import type { IVersioningStoragePort } from "./ports/versioning.port";
import type { IGovernanceStoragePort } from "./ports/governance.port";
import type { IOperationsStoragePort } from "./ports/operations.port";
import type { IKnowledgeStoragePort } from "./ports/knowledge.port";
import type { IComplianceStoragePort } from "./ports/compliance.port";
import type { IIntelligenceStoragePort } from "./ports/intelligence.port";
import type { IPortfolioStoragePort } from "./ports/portfolio.port";
import type { IPerformanceStoragePort } from "./ports/performance.port";
import type { IEaRegistryStoragePort } from "./ports/ea-registry.port";

// ── Composition root — IStorage = union of all port interfaces ─────────
export interface IStorage extends
  IIdentityStoragePort,
  IDemandStoragePort,
  IVersioningStoragePort,
  IGovernanceStoragePort,
  IOperationsStoragePort,
  IKnowledgeStoragePort,
  IComplianceStoragePort,
  IIntelligenceStoragePort,
  IPortfolioStoragePort,
  IPerformanceStoragePort,
  IEaRegistryStoragePort {}

// Use PostgreSQL storage for government-grade persistence
export const storage = new PostgresStorage();
