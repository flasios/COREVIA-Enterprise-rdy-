/**
 * Intelligence Module — Application Layer: Dependency Wiring
 *
 * Constructs adapter instances for each route group.
 * API routes import from here instead of infrastructure directly.
 */
import type {
  IIdentityStoragePort,
  IOperationsStoragePort,
  IDemandStoragePort,
  IGovernanceStoragePort,
  IKnowledgeStoragePort,
  IIntelligenceStoragePort,
} from "@interfaces/storage/ports";
import type {
  AIAssistantServicePort,
  CoveriaIntelligencePort,
  MarketResearchPort,
  IntelligenceRepository,
  AssistantConversationStore,
  AiItemStore,
  DashboardReadStore,
  UnifiedNotificationHub,
  RagServicePort,
  OrchestrationEnginePort,
  ResponseSynthesizerPort,
  AuditLoggerPort,
  BrainCorePort,
  EmailServicePort,
  BrainDraftPort,
  ProactiveIntelligencePort,
  AnalyticsServicePort,
  PortfolioAnalyticsPort,
  AIProviderStatusPort,
  ExternalAITextGenerationPort,
} from "../domain/ports";

import {
  LegacyAIAssistantService,
  LegacyCoveriaIntelligence,
  LegacyMarketResearchService,
  StorageIntelligenceRepository,
  DrizzleAssistantConversationStore,
  DrizzleAiItemStore,
  DrizzleDashboardReadStore,
  DrizzleUnifiedNotificationHub,
  LegacyRagService,
  LegacyOrchestrationEngine,
  LegacyResponseSynthesizer,
  LegacyAuditLogger,
  LegacyBrainCore,
  LegacyEmailService,
  LegacyBrainDraft,
  LegacyProactiveIntelligence,
  LegacyAnalyticsService,
  LegacyPortfolioAnalytics,
} from "../infrastructure";
import { LegacyAIProviderStatus } from "../infrastructure/providerStatus.adapter";
import { LegacyExternalAITextGeneration } from "../infrastructure/externalAITextGeneration.adapter";

/* ─── AI-Assistant deps ─────────────────────────────────────── */

export interface AIAssistantDeps {
  aiAssistant: AIAssistantServicePort;
  coveriaIntelligence: CoveriaIntelligencePort;
  marketResearch: MarketResearchPort;
  repo: IntelligenceRepository;
  conversations: AssistantConversationStore;
  items: AiItemStore;
  dashboard: DashboardReadStore;
  notifHub: UnifiedNotificationHub;
  externalAI: ExternalAITextGenerationPort;
}

export type AIAssistantStorageSlice =
  IIdentityStoragePort &
  IOperationsStoragePort &
  IDemandStoragePort &
  IGovernanceStoragePort &
  IKnowledgeStoragePort &
  IIntelligenceStoragePort;

export function buildAIAssistantDeps(storage: AIAssistantStorageSlice): AIAssistantDeps {
  return {
    aiAssistant: new LegacyAIAssistantService(),
    coveriaIntelligence: new LegacyCoveriaIntelligence(),
    marketResearch: new LegacyMarketResearchService(),
    repo: new StorageIntelligenceRepository(storage),
    conversations: new DrizzleAssistantConversationStore(),
    items: new DrizzleAiItemStore(),
    dashboard: new DrizzleDashboardReadStore(),
    notifHub: new DrizzleUnifiedNotificationHub(),
    externalAI: new LegacyExternalAITextGeneration(),
  };
}

/* ─── RAG deps ──────────────────────────────────────────────── */

export interface RagDeps {
  rag: RagServicePort;
  orchestration: OrchestrationEnginePort;
  synthesizer: ResponseSynthesizerPort;
  auditLogger: AuditLoggerPort;
  repo: IntelligenceRepository;
  /** Narrowed — only passed opaquely to audit-logger; never used as IStorage */
  storage: unknown;
}

export function buildRagDeps(storage: AIAssistantStorageSlice): RagDeps {
  return {
    rag: new LegacyRagService(),
    orchestration: new LegacyOrchestrationEngine(storage),
    synthesizer: new LegacyResponseSynthesizer(),
    auditLogger: new LegacyAuditLogger(),
    repo: new StorageIntelligenceRepository(storage),
    storage,
  };
}

/* ─── Brain deps ────────────────────────────────────────────── */

export interface BrainDeps {
  brain: BrainCorePort;
}

export function buildBrainDeps(): BrainDeps {
  return {
    brain: new LegacyBrainCore(),
  };
}

/* ─── AI (email/draft) deps ─────────────────────────────────── */

export interface AIDeps {
  email: EmailServicePort;
  brainDraft: BrainDraftPort;
  providerStatus: AIProviderStatusPort;
}

export function buildAIDeps(): AIDeps {
  return {
    email: new LegacyEmailService(),
    brainDraft: new LegacyBrainDraft(),
    providerStatus: new LegacyAIProviderStatus(),
  };
}

/* ─── Proactive Intelligence deps ───────────────────────────── */

export interface ProactiveDeps {
  proactive: ProactiveIntelligencePort;
}

export function buildProactiveDeps(): ProactiveDeps {
  return {
    proactive: new LegacyProactiveIntelligence(),
  };
}

/* ─── Analytics deps ────────────────────────────────────────── */

export interface AnalyticsDeps {
  analytics: AnalyticsServicePort;
  portfolio: PortfolioAnalyticsPort;
  /** Narrowed — passed opaquely to PortfolioAnalyticsPort methods */
  storage: unknown;
}

export function buildAnalyticsDeps(storage: AIAssistantStorageSlice): AnalyticsDeps {
  return {
    analytics: new LegacyAnalyticsService(storage),
    portfolio: new LegacyPortfolioAnalytics(),
    storage,
  };
}
