/**
 * Portfolio Module — Application Layer: Dependency Wiring
 *
 * Constructs adapter instances for every portfolio route group.
 * API routes import from here instead of infrastructure directly.
 */
import type {
  IPortfolioStoragePort,
  IIdentityStoragePort,
  IOperationsStoragePort,
  IDemandStoragePort,
  IGovernanceStoragePort,
  IVersioningStoragePort,
} from "@interfaces/storage/ports";
import type {
  ProjectRepository,
  WbsTaskRepository,
  WbsApprovalRepository,
  GateRepository,
  GateOrchestratorPort,
  ApprovalRepository,
  DocumentRepository,
  StakeholderRepository,
  IssueRepository,
  RiskRepository,
  CostEntryRepository,
  ProcurementRepository,
  PaymentRepository,
  CommunicationRepository,
  MilestoneRepository,
  ChangeRequestRepository,
  KpiRepository,
  PhaseHistoryRepository,
  UserReader,
  NotificationSender,
  DemandReader,
  EmailSender,
  BrainPipeline,
  FileSecurityService,
  BrainDraftGenerator,
  WbsBrainArtifactAdapter,
  CriticalPathAnalyzer,
  TeamRecommender,
  CoveriaNotifier,
  WbsGenerationProgress,
  SynergyDetectorPort,
  ReportingExporterPort,
} from "../domain/ports";

import {
  StorageProjectRepository,
  StorageWbsTaskRepository,
  StorageWbsApprovalRepository,
  StorageGateRepository,
  LegacyGateOrchestrator,
  StorageApprovalRepository,
  StorageDocumentRepository,
  StorageStakeholderRepository,
  StorageIssueRepository,
  StorageRiskRepository,
  StorageCostEntryRepository,
  StorageProcurementRepository,
  StoragePaymentRepository,
  StorageCommunicationRepository,
  StorageMilestoneRepository,
  StorageChangeRequestRepository,
  StorageKpiRepository,
  StoragePhaseHistoryRepository,
  StorageUserReader,
  StorageNotificationSender,
  StorageDemandReader,
  LegacyEmailSender,
  LegacyBrainPipeline,
  LegacyFileSecurityService,
  LegacyBrainDraftGenerator,
  LegacyWbsBrainArtifactAdapter,
  LegacyCriticalPathAnalyzer,
  LegacyTeamRecommender,
  LegacyCoveriaNotifier,
  LegacyWbsGenerationProgress,
} from "../infrastructure";
import { LegacySynergyDetector } from "../infrastructure/synergyDetector";
import { LegacyReportingExporter } from "../infrastructure/reportingExporter";

/**
 * Narrowed storage slice — only the port interfaces portfolio adapters actually need.
 * Drops IKnowledgeStoragePort, IComplianceStoragePort, IIntelligenceStoragePort,
 * IPerformanceStoragePort versus full IStorage.
 */
export type PortfolioStorageSlice =
  IPortfolioStoragePort &
  IIdentityStoragePort &
  IOperationsStoragePort &
  IDemandStoragePort &
  IGovernanceStoragePort &
  IVersioningStoragePort;

/* ─── Core deps (stats, projects, charter, milestones, change requests, KPIs) ── */

export interface CoreDeps {
  projects: ProjectRepository;
  wbs: WbsTaskRepository;
  gates: GateRepository;
  milestones: MilestoneRepository;
  changeRequests: ChangeRequestRepository;
  kpis: KpiRepository;
  history: PhaseHistoryRepository;
  users: UserReader;
  notifications: NotificationSender;
  demands: DemandReader;
  teamRecommender: TeamRecommender;
}

export function buildCoreDeps(storage: PortfolioStorageSlice): CoreDeps {
  return {
    projects: new StorageProjectRepository(storage),
    wbs: new StorageWbsTaskRepository(storage),
    gates: new StorageGateRepository(storage),
    milestones: new StorageMilestoneRepository(storage),
    changeRequests: new StorageChangeRequestRepository(storage),
    kpis: new StorageKpiRepository(storage),
    history: new StoragePhaseHistoryRepository(storage),
    users: new StorageUserReader(storage),
    notifications: new StorageNotificationSender(storage),
    demands: new StorageDemandReader(storage),
    teamRecommender: new LegacyTeamRecommender(),
  };
}

/* ─── WBS deps ──────────────────────────────────────────────── */

export interface WbsDeps {
  wbs: WbsTaskRepository;
  wbsApprovals: WbsApprovalRepository;
  projects: ProjectRepository;
  gateOrch: GateOrchestratorPort;
  brain: BrainPipeline;
  demands: DemandReader;
  fileSecurity: FileSecurityService;
  users: UserReader;
  notifications: NotificationSender;
  wbsArtifactAdapter: WbsBrainArtifactAdapter;
  wbsProgress: WbsGenerationProgress;
}

export function buildWbsDeps(storage: PortfolioStorageSlice): WbsDeps {
  return {
    wbs: new StorageWbsTaskRepository(storage),
    wbsApprovals: new StorageWbsApprovalRepository(storage),
    projects: new StorageProjectRepository(storage),
    gateOrch: new LegacyGateOrchestrator(),
    brain: new LegacyBrainPipeline(),
    demands: new StorageDemandReader(storage),
    fileSecurity: new LegacyFileSecurityService(),
    users: new StorageUserReader(storage),
    notifications: new StorageNotificationSender(storage),
    wbsArtifactAdapter: new LegacyWbsBrainArtifactAdapter(),
    wbsProgress: new LegacyWbsGenerationProgress(),
  };
}

/* ─── Gates deps ────────────────────────────────────────────── */

export interface GatesDeps {
  gates: GateRepository;
  gateOrch: GateOrchestratorPort;
  projects: ProjectRepository;
  wbs: WbsTaskRepository;
  users: UserReader;
  corevia: CoveriaNotifier;
  notifications: NotificationSender;
  stakeholders: StakeholderRepository;
}

export function buildGatesDeps(storage: PortfolioStorageSlice): GatesDeps {
  return {
    gates: new StorageGateRepository(storage),
    gateOrch: new LegacyGateOrchestrator(),
    projects: new StorageProjectRepository(storage),
    wbs: new StorageWbsTaskRepository(storage),
    users: new StorageUserReader(storage),
    corevia: new LegacyCoveriaNotifier(),
    notifications: new StorageNotificationSender(storage),
    stakeholders: new StorageStakeholderRepository(storage),
  };
}

/* ─── Communications deps ───────────────────────────────────── */

export interface CommsDeps {
  communications: CommunicationRepository;
  projects: ProjectRepository;
  users: UserReader;
  notifications: NotificationSender;
  email: EmailSender;
}

export function buildCommsDeps(storage: PortfolioStorageSlice): CommsDeps {
  return {
    communications: new StorageCommunicationRepository(storage),
    projects: new StorageProjectRepository(storage),
    users: new StorageUserReader(storage),
    notifications: new StorageNotificationSender(storage),
    email: new LegacyEmailSender(),
  };
}

/* ─── Risks deps ────────────────────────────────────────────── */

export interface RisksDeps {
  risks: RiskRepository;
  projects: ProjectRepository;
  fileSecurity: FileSecurityService;
  brainDraft: BrainDraftGenerator;
  users: UserReader;
  notifications: NotificationSender;
}

export function buildRisksDeps(storage: PortfolioStorageSlice): RisksDeps {
  return {
    risks: new StorageRiskRepository(storage),
    projects: new StorageProjectRepository(storage),
    fileSecurity: new LegacyFileSecurityService(),
    brainDraft: new LegacyBrainDraftGenerator(),
    users: new StorageUserReader(storage),
    notifications: new StorageNotificationSender(storage),
  };
}

/* ─── Summary deps ──────────────────────────────────────────── */

export interface SummaryDeps {
  projects: ProjectRepository;
  risks: RiskRepository;
  wbs: WbsTaskRepository;
  demands: DemandReader;
  criticalPath: CriticalPathAnalyzer;
  issues: IssueRepository;
  approvals: ApprovalRepository;
  stakeholders: StakeholderRepository;
  communications: CommunicationRepository;
  documents: DocumentRepository;
  gates: GateRepository;
}

export function buildSummaryDeps(storage: PortfolioStorageSlice): SummaryDeps {
  return {
    projects: new StorageProjectRepository(storage),
    risks: new StorageRiskRepository(storage),
    wbs: new StorageWbsTaskRepository(storage),
    demands: new StorageDemandReader(storage),
    criticalPath: new LegacyCriticalPathAnalyzer(),
    issues: new StorageIssueRepository(storage),
    approvals: new StorageApprovalRepository(storage),
    stakeholders: new StorageStakeholderRepository(storage),
    communications: new StorageCommunicationRepository(storage),
    documents: new StorageDocumentRepository(storage),
    gates: new StorageGateRepository(storage),
  };
}

/* ─── Metadata deps ─────────────────────────────────────────── */

export interface MetadataDeps {
  projects: ProjectRepository;
}

export function buildMetadataDeps(storage: PortfolioStorageSlice): MetadataDeps {
  return {
    projects: new StorageProjectRepository(storage),
  };
}

/* ─── Portfolio Units deps ─────────────────────────────────── */

export interface PortfolioUnitsDeps {
  storage: PortfolioStorageSlice;
  projects: ProjectRepository;
  users: UserReader;
}

export function buildPortfolioUnitsDeps(storage: PortfolioStorageSlice): PortfolioUnitsDeps {
  return {
    storage,
    projects: new StorageProjectRepository(storage),
    users: new StorageUserReader(storage),
  };
}

/* ─── Cost & Procurement deps ───────────────────────────────── */

export interface CostProcDeps {
  costs: CostEntryRepository;
  procurement: ProcurementRepository;
  payments: PaymentRepository;
  wbs: WbsTaskRepository;
}

export function buildCostProcDeps(storage: PortfolioStorageSlice): CostProcDeps {
  return {
    costs: new StorageCostEntryRepository(storage),
    procurement: new StorageProcurementRepository(storage),
    payments: new StoragePaymentRepository(storage),
    wbs: new StorageWbsTaskRepository(storage),
  };
}

/* ─── Issues deps ───────────────────────────────────────────── */

export interface IssueDeps {
  issues: IssueRepository;
}

export function buildIssueDeps(storage: PortfolioStorageSlice): IssueDeps {
  return {
    issues: new StorageIssueRepository(storage),
  };
}

/* ─── Stakeholders deps ─────────────────────────────────────── */

export interface StakeholderDeps {
  stakeholders: StakeholderRepository;
}

export function buildStakeholderDeps(storage: PortfolioStorageSlice): StakeholderDeps {
  return {
    stakeholders: new StorageStakeholderRepository(storage),
  };
}

/* ─── Approvals deps ────────────────────────────────────────── */

export interface ApprovalDeps {
  approvals: ApprovalRepository;
}

export function buildApprovalDeps(storage: PortfolioStorageSlice): ApprovalDeps {
  return {
    approvals: new StorageApprovalRepository(storage),
  };
}

/* ─── Documents deps ────────────────────────────────────────── */

export interface DocumentDeps {
  documents: DocumentRepository;
}

export function buildDocumentDeps(storage: PortfolioStorageSlice): DocumentDeps {
  return {
    documents: new StorageDocumentRepository(storage),
  };
}

/* ─── Synergy deps ──────────────────────────────────────────── */

export interface SynergyDeps {
  synergy: SynergyDetectorPort;
}

export function buildSynergyDeps(storage: PortfolioStorageSlice): SynergyDeps {
  return {
    synergy: new LegacySynergyDetector(storage),
  };
}

/* ─── Reporting deps ────────────────────────────────────────── */

export interface ReportingDeps {
  exporter: ReportingExporterPort;
}

export function buildReportingDeps(): ReportingDeps {
  return {
    exporter: new LegacyReportingExporter(),
  };
}
