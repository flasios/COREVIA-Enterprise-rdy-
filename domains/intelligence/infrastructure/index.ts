/**
 * Intelligence Module — Infrastructure Layer
 *
 * Repositories (Drizzle/Postgres), external adapters (email, storage, APIs).
 * Implements ports defined in ./domain.
 *
 * Allowed imports: ./domain (ports), platform/db, platform/cache, platform/queue.
 */
export { LegacyAIAssistantService } from "./aiAssistant.adapter";
export { AIAssistantService, aiAssistantService } from "./aiAssistantService";
export { LegacyCoveriaIntelligence } from "./coveriaIntelligence.adapter";
export { CoveriaIntelligenceService, coveriaIntelligence } from "./coveriaIntelligenceService";
export { LegacyMarketResearchService } from "./marketResearch.adapter";
export { MarketResearchService, marketResearchService } from "./marketResearchService";
export type { MarketResearchRequest, MarketResearchResult } from "./marketResearchService";
export { StorageIntelligenceRepository } from "./intelligenceRepository.adapter";
export { DrizzleAssistantConversationStore } from "./assistantConversationStore.adapter";
export { LegacyRagService } from "./ragService.adapter";
export { LegacyOrchestrationEngine, LegacyResponseSynthesizer } from "./orchestration.adapter";
export { LegacyAuditLogger } from "./auditLogger.adapter";
export { LegacyBrainCore } from "./brainCore.adapter";
export { LegacyEmailService } from "./emailService.adapter";
export { LegacyBrainDraft } from "./brainDraft.adapter";
export { generateBrainDraftArtifact } from "./brainDraftArtifactService";
export { LegacyProactiveIntelligence } from "./proactiveIntelligence.adapter";
export { ProactiveIntelligenceService, proactiveIntelligence } from "./proactiveIntelligenceService";
export { LegacyAnalyticsService, LegacyPortfolioAnalytics } from "./analytics.adapter";
export { AnalyticsService, createAnalyticsService } from "./analyticsService";
export { DrizzleAiItemStore } from "./aiItemStore.adapter";
export { DrizzleDashboardReadStore } from "./dashboardReadStore.adapter";
export { DrizzleUnifiedNotificationHub } from "./unifiedNotificationHub.adapter";
