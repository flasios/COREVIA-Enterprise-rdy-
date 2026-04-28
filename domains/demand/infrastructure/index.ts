/**
 * Demand Module — Infrastructure Layer
 *
 * Repositories (Drizzle/Postgres), external adapters (AI, storage, APIs).
 * Implements ports defined in ./domain.
 *
 * Allowed imports: ./domain (ports), platform/db, platform/cache, platform/queue.
 */

export { StorageDemandReportRepository } from "./demandReportRepository";
export { StorageConversionRequestRepository } from "./conversionRequestRepository";
export { LegacyDemandAnalysisEngine } from "./demandAnalysisEngine";
export { DemandAnalysisService } from "./demandAnalysisService";
export { StoragePortfolioProjectCreator } from "./portfolioProjectCreator";
export { StorageNotificationSender } from "./notificationSender";
export { LegacyBrainPipeline } from "./brainPipeline";
export { LegacyGovernanceChecker } from "./governanceChecker";
export { StorageBranchRepository } from "./branchRepository";
export { StorageSectionAssignmentRepository } from "./sectionAssignmentRepository";
export { LegacyWorkflowNotifier } from "./workflowNotifier";
export { LegacyAuditLogger } from "./auditLogger";
export { LegacyDocumentExporter } from "./documentExporter";
export { LegacyCoveriaNotifier } from "./coveriaNotifier";
export { LegacyFinancialModeler } from "./financialModeler";
export { StorageUserReader } from "./userReader";
export { StorageBusinessCaseRepository } from "./businessCaseRepository";
export { StorageReportVersionRepository } from "./reportVersionRepository";
export { DbProjectIdGenerator } from "./projectIdGenerator";
export { LegacyVersionManager } from "./versionManager";
export { LegacyVersionAnalyzer } from "./versionAnalyzer";
export { LegacyContentEnricher } from "./contentEnricher";
export { LegacyCryptoService } from "./cryptoService";
export { WebSocketPresenceTracker } from "./presenceTracker";
export { LegacyAutoIndexer } from "./autoIndexer";
export { AutoIndexingService, createAutoIndexingService } from "./autoIndexingService";
export type { DemandAutoIndexingStorage } from "./autoIndexingService";

// ── Re-exported types for route-layer consumption ────────────────────
export type { FinancialInputs, UnifiedFinancialOutput } from "./financialModel";
export type { VersionContent, AiAnalysisData } from "./versionManagement";
export type { RecommendationsInput, SmartObjective } from "./contentEnricherTypes";
