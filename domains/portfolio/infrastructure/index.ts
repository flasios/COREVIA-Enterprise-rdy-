/**
 * Portfolio Module — Infrastructure Layer
 *
 * Repositories (Drizzle/Postgres), external adapters (email, storage, APIs).
 * Implements ports defined in ./domain.
 *
 * Allowed imports: ./domain (ports), platform/db, platform/cache, platform/queue.
 */

export { StorageProjectRepository } from "./projectRepository";
export { StorageWbsTaskRepository } from "./wbsTaskRepository";
export { StorageWbsApprovalRepository } from "./wbsApprovalRepository";
export { StorageGateRepository } from "./gateRepository";
export { LegacyGateOrchestrator } from "./gateOrchestrator";
export { StorageApprovalRepository } from "./approvalRepository";
export { StorageDocumentRepository } from "./documentRepository";
export { StorageStakeholderRepository } from "./stakeholderRepository";
export { StorageIssueRepository } from "./issueRepository";
export { StorageRiskRepository } from "./riskRepository";
export { StorageCostEntryRepository } from "./costEntryRepository";
export { StorageProcurementRepository } from "./procurementRepository";
export { StoragePaymentRepository } from "./paymentRepository";
export { StorageCommunicationRepository } from "./communicationRepository";
export { StorageMilestoneRepository } from "./milestoneRepository";
export { StorageChangeRequestRepository } from "./changeRequestRepository";
export { StorageKpiRepository } from "./kpiRepository";
export { StoragePhaseHistoryRepository } from "./phaseHistoryRepository";
export { StorageUserReader } from "./userReader";
export { StorageNotificationSender } from "./notificationSender";
export { StorageDemandReader } from "./demandReader";
export { LegacyEmailSender } from "./emailSender";
export { LegacyBrainPipeline } from "./brainPipeline";
export { LegacyFileSecurityService } from "./fileSecurityService";
export { LegacyBrainDraftGenerator } from "./brainDraftGenerator";
export { LegacyWbsBrainArtifactAdapter } from "./wbsBrainArtifactAdapter";
export { LegacyCriticalPathAnalyzer } from "./criticalPathAnalyzer";
export { LegacyTeamRecommender } from "./teamRecommender";
export { LegacyCoveriaNotifier } from "./coveriaNotifier";
export { LegacyWbsGenerationProgress } from "./wbsGenerationProgress";
export { generateWbsFromBusinessCase, computeCriticalPath } from "./wbsGeneratorService";
export type {
	GeneratedWbsTask,
	WbsGenerationResult,
	CriticalPathTask,
	CriticalPathAnalysis,
} from "./wbsGeneratorService";
export { normalizeBrainWbsArtifactToGeneratedTasks } from "./wbsBrainArtifactService";
export type {
	GeneratedWbsTaskLike,
	BrainWbsArtifactSummary,
} from "./wbsBrainArtifactService";
export {
	createProgressEmitter,
	getProgress,
	clearProgress,
	generateWbsParallel,
} from "./wbsParallelGeneratorService";
export type { WbsGenerationProgress as WbsParallelGenerationProgress } from "./wbsParallelGeneratorService";
export { generateTeamRecommendation } from "./teamRecommendationService";
export type {
	TeamRecommendation,
	TeamRole,
	ExternalResource,
	EquipmentResource,
	ResourceGap,
} from "./teamRecommendationService";
export { SynergyDetectorService, createSynergyDetectorService } from "./synergyDetectorService";
export type { SynergyDetectionStorage } from "./synergyDetectorService";
export { generateReportingExport } from "./reportingExportService";
export type {
	ReportingMetric as ReportingExportMetric,
	ReportingWidget,
	ReportingExportOptions as ReportingExportServiceOptions,
} from "./reportingExportService";
