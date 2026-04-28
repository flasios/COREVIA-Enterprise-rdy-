/**
 * Demand Module — Dependency Builder
 *
 * Consolidates all port→adapter wiring for the demand module.
 * Route files import `buildDemandDeps()` and `Pick<>` the subset they need.
 *
 * All external service imports are encapsulated inside each adapter —
 * this file only instantiates adapters from infrastructure/ and domain/.
 */

import type {
  IDemandStoragePort,
  IKnowledgeStoragePort,
  IVersioningStoragePort,
  IGovernanceStoragePort,
  IIdentityStoragePort,
  IOperationsStoragePort,
  IPortfolioStoragePort,
} from "@interfaces/storage/ports";

/**
 * Narrowed storage slice — only the port interfaces demand adapters actually need.
 * Drops IComplianceStoragePort, IIntelligenceStoragePort, IPerformanceStoragePort
 * versus full IStorage.
 */
export type DemandStorageSlice =
  IDemandStoragePort &
  IKnowledgeStoragePort &
  IVersioningStoragePort &
  IGovernanceStoragePort &
  IIdentityStoragePort &
  IOperationsStoragePort &
  IPortfolioStoragePort;

// ── External singletons (core platform, acceptable cross-cutting) ──
import {
  coreviaOrchestrator,
  coreviaStorage,
  demandSyncService,
  SpineOrchestrator,
} from "@brain";

// ── Infrastructure adapters ────────────────────────────────────────
import {
  StorageDemandReportRepository,
  StorageConversionRequestRepository,
  LegacyDemandAnalysisEngine,
  StoragePortfolioProjectCreator,
  StorageNotificationSender,
  LegacyBrainPipeline,
  LegacyGovernanceChecker,
  StorageBranchRepository,
  StorageSectionAssignmentRepository,
  LegacyWorkflowNotifier,
  LegacyAuditLogger,
  LegacyDocumentExporter,
  LegacyCoveriaNotifier,
  LegacyFinancialModeler,
  StorageUserReader,
  StorageBusinessCaseRepository,
  StorageReportVersionRepository,
  DbProjectIdGenerator,
  LegacyVersionManager,
  LegacyVersionAnalyzer,
  LegacyContentEnricher,
  LegacyCryptoService,
  WebSocketPresenceTracker,
  LegacyAutoIndexer,
} from "../infrastructure";

// ── Port types ─────────────────────────────────────────────────────
import type {
  BrainPipeline,
  GovernanceChecker,
  BranchRepository,
  SectionAssignmentRepository,
  ReportVersionRepository,
  WorkflowNotifier,
  CoveriaNotifier,
  AuditLogger,
  DocumentExporter,
  FinancialModeler,
  VersionManager,
  VersionAnalyzer,
  ContentEnricher,
  CryptoServicePort,
  PresenceTracker,
  AutoIndexer,
  ProjectIdGenerator,
  UserReader,
  BusinessCaseRepository,
} from "../domain/ports";

import type {
  DemandReportRepository,
  ConversionRequestRepository,
  DemandAnalysisEngine,
  PortfolioProjectCreator,
  NotificationSender,
} from "../domain";

// ── Unified Deps Interface ─────────────────────────────────────────

export interface DemandAllDeps {
  /* core data */
  reports: DemandReportRepository;
  conversions: ConversionRequestRepository;
  branches: BranchRepository;
  sections: SectionAssignmentRepository;
  versions: ReportVersionRepository;
  businessCase: BusinessCaseRepository;
  users: UserReader;

  /* AI / analysis */
  analysis: DemandAnalysisEngine;
  brain: BrainPipeline;

  /* governance */
  governance: GovernanceChecker;

  /* versioning services */
  versionManager: VersionManager;
  versionAnalyzer: VersionAnalyzer;
  crypto: CryptoServicePort;
  presence: PresenceTracker;
  enricher: ContentEnricher;
  autoIndexer: AutoIndexer;

  /* notifications / audit */
  notifier: WorkflowNotifier;
  coveria: CoveriaNotifier;
  audit: AuditLogger;

  /* document export */
  exporter: DocumentExporter;

  /* financial */
  financial: FinancialModeler;

  /* portfolio conversion */
  projects: PortfolioProjectCreator;
  notifications: NotificationSender;

  /* project ID generation */
  projectIds: ProjectIdGenerator;
}

// ── Builder ────────────────────────────────────────────────────────

export function buildDemandDeps(storage: DemandStorageSlice): DemandAllDeps {
  return {
    /* core data */
    reports: new StorageDemandReportRepository(storage),
    conversions: new StorageConversionRequestRepository(storage),
    branches: new StorageBranchRepository(storage),
    sections: new StorageSectionAssignmentRepository(storage),
    versions: new StorageReportVersionRepository(storage) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    businessCase: new StorageBusinessCaseRepository(storage),
    users: new StorageUserReader(storage),

    /* AI / analysis */
    analysis: new LegacyDemandAnalysisEngine(),
    brain: new LegacyBrainPipeline(
      coreviaOrchestrator,
      coreviaStorage,
      demandSyncService,
      (s) => new SpineOrchestrator(s),
    ),

    /* governance */
    governance: new LegacyGovernanceChecker(),

    /* versioning services */
    versionManager: new LegacyVersionManager(),
    versionAnalyzer: new LegacyVersionAnalyzer(),
    crypto: new LegacyCryptoService(),
    presence: new WebSocketPresenceTracker(),
    enricher: new LegacyContentEnricher(),
    autoIndexer: new LegacyAutoIndexer(storage),

    /* notifications / audit */
    notifier: new LegacyWorkflowNotifier(storage),
    coveria: new LegacyCoveriaNotifier(),
    audit: new LegacyAuditLogger(),

    /* document export */
    exporter: new LegacyDocumentExporter(),

    /* financial */
    financial: new LegacyFinancialModeler(),

    /* portfolio conversion */
    projects: new StoragePortfolioProjectCreator(storage),
    notifications: new StorageNotificationSender(storage),

    /* project ID generation */
    projectIds: new DbProjectIdGenerator(),
  };
}
