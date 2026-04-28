/**
 * Storage Ports — Barrel re-export
 * Each port defines the storage contract for one bounded-context module.
 */
export type { IIdentityStoragePort } from "./identity.port";
export type { IDemandStoragePort } from "./demand.port";
export type { IVersioningStoragePort } from "./versioning.port";
export type { IGovernanceStoragePort } from "./governance.port";
export type { IOperationsStoragePort } from "./operations.port";
export type { IKnowledgeStoragePort } from "./knowledge.port";
export type { IComplianceStoragePort } from "./compliance.port";
export type { IIntelligenceStoragePort } from "./intelligence.port";
export type { IPortfolioStoragePort } from "./portfolio.port";
export type { IPerformanceStoragePort } from "./performance.port";
export type { IEaRegistryStoragePort } from "./ea-registry.port";
