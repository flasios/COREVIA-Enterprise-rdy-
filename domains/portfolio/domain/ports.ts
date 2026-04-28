/**
 * Portfolio Module — Domain Ports
 *
 * Every external dependency the portfolio module needs is declared here
 * as a pure interface.  Infrastructure adapters (in ../infrastructure/)
 * implement these ports; application use-cases depend only on port types.
 *
 * NO concrete imports allowed – this file must stay infrastructure-free.
 * @shared/schema types ARE allowed (they are the domain model).
 */

import type {
  PortfolioProject,
  InsertPortfolioProject,
  UpdatePortfolioProject,
  WbsTask,
  InsertWbsTask,
  WbsApproval,
  InsertWbsApproval,
  ProjectGate,
  InsertProjectGate,
  UpdateProjectGate,
  ProjectPhaseGate,
  ProjectApproval,
  InsertProjectApproval,
  UpdateProjectApproval,
  ProjectDocument,
  InsertProjectDocument,
  UpdateProjectDocument,
  ProjectStakeholder,
  InsertProjectStakeholder,
  UpdateProjectStakeholder,
  ProjectIssue,
  InsertProjectIssue,
  UpdateProjectIssue,
  ProjectRisk,
  InsertProjectRisk,
  UpdateProjectRisk,
  RiskEvidence,
  InsertRiskEvidence,
  UpdateRiskEvidence,
  CostEntry,
  InsertCostEntry,
  ProcurementItem,
  InsertProcurementItem,
  ProcurementPayment,
  InsertProcurementPayment,
  ProjectCommunication,
  InsertProjectCommunication,
  UpdateProjectCommunication,
  ProjectMilestone,
  InsertProjectMilestone,
  ProjectChangeRequest,
  InsertProjectChangeRequest,
  UpdateProjectChangeRequest,
  ProjectKpi,
  InsertProjectKpi,
  PhaseHistoryRecord,
  InsertPhaseHistory,
  User,
  Team,
  Notification,
  InsertNotification,
} from '@shared/schema';

// ── Project Repository ─────────────────────────────────────────────

export interface ProjectRepository {
  getAll(): Promise<PortfolioProject[]>;
  getById(id: string): Promise<PortfolioProject | undefined>;
  create(data: Partial<InsertPortfolioProject> & { createdBy: string }): Promise<PortfolioProject>;
  update(id: string, data: Partial<UpdatePortfolioProject>): Promise<PortfolioProject>;
  delete(id: string): Promise<void>;
  getSummary(): Promise<Record<string, unknown>>;
  getProjectsByManagerId(managerId: string): Promise<PortfolioProject[]>;
}

// ── WBS Task Repository ────────────────────────────────────────────

export interface WbsTaskRepository {
  getByProject(projectId: string): Promise<WbsTask[]>;
  create(data: Partial<InsertWbsTask>): Promise<WbsTask>;
  update(id: string, data: Partial<InsertWbsTask>): Promise<WbsTask>;
  delete(id: string): Promise<void>;
}

// ── WBS Approval Repository ────────────────────────────────────────

export interface WbsApprovalRepository {
  getByProject(projectId: string): Promise<WbsApproval | undefined>;
  create(data: Partial<InsertWbsApproval>): Promise<WbsApproval>;
  update(id: string, data: Partial<InsertWbsApproval>): Promise<WbsApproval>;
  getPending(): Promise<WbsApproval[]>;
  getHistory(projectId: string): Promise<WbsApproval[]>;
  supersedePending(projectId: string, exceptId?: string): Promise<number>;
}

// ── Gate Repository ────────────────────────────────────────────────

export interface GateRepository {
  getByProject(projectId: string): Promise<ProjectGate[]>;
  create(data: Partial<InsertProjectGate>): Promise<ProjectGate>;
  update(id: string, data: Partial<UpdateProjectGate>): Promise<ProjectGate>;
  delete(id: string): Promise<void>;
  getPending(): Promise<ProjectGate[]>;
  getHistory(projectId: string): Promise<ProjectGate[]>;
  /** Return all gates ordered by updatedAt (for history dashboard) */
  getAllHistory(): Promise<ProjectPhaseGate[]>;
  /** Reset charter gate check to pending (Drizzle direct) */
  resetCharterGateCheck(projectId: string): Promise<void>;
}

// ── Gate Orchestrator ──────────────────────────────────────────────

export interface GateOrchestratorPort {
  evaluateGateReadiness(projectId: string): Promise<void>;
  approveGate(gateId: string, userId: string, opts?: { comments?: string; conditions?: Record<string, unknown> }): Promise<ProjectGate>;
  rejectGate(gateId: string, userId: string, reason: string): Promise<ProjectGate>;
  getGateOverview(projectId: string): Promise<Record<string, unknown>>;
  processGateApproval(params: {
    projectId: string;
    fromPhase: string;
    toPhase: string;
    decision: string;
    approverId?: string;
    comments?: string;
    conditions?: Record<string, unknown>;
  }): Promise<{ success: boolean; message: string }>;
}

// ── Approval Repository ────────────────────────────────────────────

export interface ApprovalRepository {
  getByProject(projectId: string): Promise<ProjectApproval[]>;
  create(data: Partial<InsertProjectApproval>): Promise<ProjectApproval>;
  update(id: string, data: Partial<UpdateProjectApproval>): Promise<ProjectApproval>;
  getById(id: string): Promise<ProjectApproval | undefined>;
  getPending(): Promise<ProjectApproval[]>;
  getPendingByUser(userId: string): Promise<ProjectApproval[]>;
}

// ── Document Repository ────────────────────────────────────────────

export interface DocumentRepository {
  getByProject(projectId: string): Promise<ProjectDocument[]>;
  create(data: Partial<InsertProjectDocument>): Promise<ProjectDocument>;
  update(id: string, data: Partial<UpdateProjectDocument>): Promise<ProjectDocument>;
  delete(id: string): Promise<void>;
}

// ── Stakeholder Repository ─────────────────────────────────────────

export interface StakeholderRepository {
  getByProject(projectId: string): Promise<ProjectStakeholder[]>;
  create(data: Partial<InsertProjectStakeholder>): Promise<ProjectStakeholder>;
  update(id: string, data: Partial<UpdateProjectStakeholder>): Promise<ProjectStakeholder>;
  delete(id: string): Promise<void>;
}

// ── Issue Repository ───────────────────────────────────────────────

export interface IssueRepository {
  getByProject(projectId: string): Promise<ProjectIssue[]>;
  create(data: Partial<InsertProjectIssue>): Promise<ProjectIssue>;
  update(id: string, data: Partial<UpdateProjectIssue>): Promise<ProjectIssue>;
  delete(id: string): Promise<void>;
}

// ── Risk Repository ────────────────────────────────────────────────

export interface RiskRepository {
  getByProject(projectId: string): Promise<ProjectRisk[]>;
  getById(id: string): Promise<ProjectRisk | undefined>;
  create(data: Partial<InsertProjectRisk>): Promise<ProjectRisk>;
  update(id: string, data: Partial<UpdateProjectRisk>): Promise<ProjectRisk>;
  delete(id: string): Promise<void>;
  createEvidence(data: Partial<InsertRiskEvidence>): Promise<RiskEvidence>;
  getEvidence(riskId: string): Promise<RiskEvidence[]>;
  getEvidenceById(id: string): Promise<RiskEvidence | undefined>;
  updateEvidence(id: string, data: Partial<UpdateRiskEvidence>): Promise<RiskEvidence>;
  deleteEvidence(id: string): Promise<void>;
}

// ── Cost / Procurement / Payment Repositories ──────────────────────

export interface CostEntryRepository {
  getByProject(projectId: string): Promise<CostEntry[]>;
  create(data: Partial<InsertCostEntry>): Promise<CostEntry>;
  update(id: string, data: Partial<InsertCostEntry>): Promise<CostEntry>;
  delete(id: string): Promise<void>;
}

export interface ProcurementRepository {
  getByProject(projectId: string): Promise<ProcurementItem[]>;
  create(data: Partial<InsertProcurementItem>): Promise<ProcurementItem>;
  update(id: string, data: Partial<InsertProcurementItem>): Promise<ProcurementItem>;
  delete(id: string): Promise<void>;
}

export interface PaymentRepository {
  getByProject(projectId: string): Promise<ProcurementPayment[]>;
  create(data: Partial<InsertProcurementPayment>): Promise<ProcurementPayment>;
  update(id: string, data: Partial<InsertProcurementPayment>): Promise<ProcurementPayment>;
  delete(id: string): Promise<void>;
}

// ── Communication Repository ───────────────────────────────────────

export interface CommunicationRepository {
  getByProject(projectId: string): Promise<ProjectCommunication[]>;
  create(data: Partial<InsertProjectCommunication>): Promise<ProjectCommunication>;
  update(id: string, data: Partial<UpdateProjectCommunication>): Promise<ProjectCommunication>;
  delete(id: string): Promise<void>;
}

// ── Milestone Repository ───────────────────────────────────────────

export interface MilestoneRepository {
  getByProject(projectId: string): Promise<ProjectMilestone[]>;
  getById(id: string): Promise<ProjectMilestone | undefined>;
  create(data: Partial<InsertProjectMilestone>): Promise<ProjectMilestone>;
  update(id: string, data: Partial<InsertProjectMilestone>): Promise<ProjectMilestone>;
  delete(id: string): Promise<ProjectMilestone>;
  getUpcoming(daysAhead: number): Promise<ProjectMilestone[]>;
}

// ── Change Request Repository ──────────────────────────────────────

export interface ChangeRequestRepository {
  getByProject(projectId: string): Promise<ProjectChangeRequest[]>;
  getById(id: string): Promise<ProjectChangeRequest | undefined>;
  create(data: Partial<InsertProjectChangeRequest>): Promise<ProjectChangeRequest>;
  update(id: string, data: Partial<UpdateProjectChangeRequest>): Promise<ProjectChangeRequest>;
  delete(id: string): Promise<void>;
  getByStatus(projectId: string, status: string): Promise<ProjectChangeRequest[]>;
  getPending(): Promise<ProjectChangeRequest[]>;
  getAllWithProjects(): Promise<ProjectChangeRequest[]>;
}

// ── KPI Repository ─────────────────────────────────────────────────

export interface KpiRepository {
  getByProject(projectId: string): Promise<ProjectKpi[]>;
  getById(id: string): Promise<ProjectKpi | undefined>;
  create(data: Partial<InsertProjectKpi>): Promise<ProjectKpi>;
  update(id: string, data: Partial<InsertProjectKpi>): Promise<ProjectKpi>;
  getByCategory(projectId: string, category: string): Promise<ProjectKpi[]>;
}

// ── Phase History ──────────────────────────────────────────────────

export interface PhaseHistoryRepository {
  getByProject(projectId: string): Promise<PhaseHistoryRecord[]>;
  create(data: Partial<InsertPhaseHistory>): Promise<PhaseHistoryRecord>;
}

// ── User / Team Reader ─────────────────────────────────────────────

export interface UserReader {
  getById(id: string): Promise<User | undefined>;
  getAll(): Promise<User[]>;
  getTeams(): Promise<Team[]>;
  getWithPermission(permission: string): Promise<User[]>;
}

// ── Notification Sender ────────────────────────────────────────────

export interface NotificationSender {
  create(data: Partial<InsertNotification>): Promise<Notification>;
}

// ── Cross-Module Demand Reader ─────────────────────────────────────

export interface DemandReader {
  getReport(reportId: string): Promise<Record<string, unknown> | undefined>;
  getReports(): Promise<Array<Record<string, unknown>>>;
  getAll(): Promise<Array<Record<string, unknown>>>;
  getBusinessCase(demandReportId: string): Promise<Record<string, unknown> | undefined>;
  updateBusinessCase(businessCaseId: string, updates: Record<string, unknown>): Promise<Record<string, unknown> | undefined>;
  getReportVersions(reportId: string): Promise<Array<Record<string, unknown>>>;
  getReportVersionsByStatus(reportId: string, status: string): Promise<Array<Record<string, unknown>>>;
  createReport(data: Record<string, unknown>): Promise<Record<string, unknown>>;
  updateReport(reportId: string, updates: Record<string, unknown>): Promise<Record<string, unknown> | undefined>;
}

// ── Email Sender ───────────────────────────────────────────────────

export interface EmailSender {
  send(opts: {
    to: string;
    from: string;
    subject: string;
    html: string;
  }): Promise<boolean>;
}

// ── Brain Pipeline (for WBS AI generation) ─────────────────────────

export interface BrainPipeline {
  execute(
    domain: string,
    signal: string,
    input: Record<string, unknown>,
    userId: string,
    orgId?: string,
    opts?: Record<string, unknown>,
  ): Promise<{
    decisionId: string;
    correlationId: string;
    finalStatus: string;
    decision?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
  getLatestDecisionArtifactVersion(filter: {
    decisionSpineId: string;
    artifactType: string;
  }): Promise<Record<string, unknown> | undefined>;
  upsertDecisionArtifactVersion(data: Record<string, unknown>): Promise<void>;
  /**
   * Record a portfolio-originated governance approval request as a fresh
   * brain approval row so it surfaces in the PMO Brain inbox alongside
   * pipeline-blocked approvals.
   */
  recordApprovalRequest(params: {
    projectId: string;
    projectName: string;
    actionType: string; // e.g. 'wbs_generation_request'
    actionLabel: string; // human label e.g. 'WBS Generation'
    requesterId: string;
    requesterName: string;
    reasons?: string[];
    layer?: number;
    layerKey?: string;
  }): Promise<{ approvalId: string; decisionSpineId: string }>;

  /**
   * Look up the most recently APPROVED portfolio-action approval for the
   * given project + actionType. Used by execution-phase use cases (e.g. WBS
   * generation) to know that the human governance gate has already cleared.
   */
  findApprovedAction(projectId: string, actionType: string): Promise<{
    approvalId: string;
    decisionSpineId: string;
    approvedBy: string | null;
    approvedAt: Date | null;
  } | null>;

  /**
   * Look up a pending Layer 7 (HITL authority validation) approval on the
   * given decision spine. Used to detect that a generated artifact is already
   * waiting for PMO Director review so we don't re-run the AI pipeline on
   * every retry click.
   */
  findPendingLayer7Approval(decisionSpineId: string): Promise<{
    approvalId: string;
    createdAt: Date | null;
  } | null>;

  /**
   * Look up the most recent APPROVED Layer 7 / governance approval on a
   * decision spine. Used by post-approval use cases (e.g. WBS generation)
   * to skip the AI pipeline + Layer 7 HITL when an existing draft has
   * already been approved.
   */
  findApprovedLayer7Approval(decisionSpineId: string): Promise<{
    approvalId: string;
    approvedBy: string | null;
    approvedAt: Date | null;
  } | null>;
}

// ── File Security ──────────────────────────────────────────────────

export interface FileSecurityService {
  enforce(opts: {
    allowedExtensions: string[];
    path: string;
    originalName: string;
    declaredMimeType: string;
    correlationId?: string;
    userId: string;
  }): Promise<void>;
  logRejection(opts: {
    allowedExtensions: string[];
    path: string;
    originalName: string;
    declaredMimeType: string;
    correlationId?: string;
    userId: string;
  }, message: string): void;
  safeUnlink(filePath: string | undefined): Promise<void>;
}

// ── Brain Draft Artifact Generator (for risk evidence AI) ──────────

export interface BrainDraftGenerator {
  generate(params: Record<string, unknown>): Promise<Record<string, unknown>>;
}

// ── WBS Brain Artifact Adapter ─────────────────────────────────────

export interface WbsBrainArtifactAdapter {
  normalize(opts: {
    artifactContent: Record<string, unknown>;
    startDate: string;
    targetDurationDays?: number;
  }): { tasks: Array<Record<string, unknown>>; summary?: Record<string, unknown> };
}

// ── Critical Path Analyzer ─────────────────────────────────────────

export interface CriticalPathAnalyzer {
  compute(tasks: Array<Record<string, unknown>>): {
    criticalPath: string[];
    projectDuration: number;
    criticalTaskCount: number;
    tasks: Array<{
      taskCode: string;
      totalFloat: number;
      earliestStart: number;
      earliestFinish: number;
      latestStart: number;
      latestFinish: number;
    }>;
  };
}

// ── Team Recommender ───────────────────────────────────────────────

export interface TeamRecommender {
  generate(projectId: string): Promise<Record<string, unknown>>;
}

// ── Corevia Notifier (for gate approvals) ──────────────────────────

export interface CoveriaNotifier {
  notify(data: {
    userId: string;
    title: string;
    message: string;
    type: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  getSuperadminUserId(): Promise<string | undefined>;
}

// ── WBS Generation Progress Tracker ────────────────────────────────

export interface WbsGenerationProgress {
  getProgress(projectId: string): Record<string, unknown> | undefined;
}

// ── Synergy Detector ───────────────────────────────────────────────

export interface SynergyDetectorPort {
  detectSynergies(demandReport: Record<string, unknown>): Promise<Array<{
    demandId: string;
    department: string;
    businessObjective: string;
    similarityScore: number;
    budgetRange?: string;
  }>>;
  createSynergyOpportunity(
    primaryDemandId: string,
    matches: Array<{ demandId: string; department: string; businessObjective: string; similarityScore: number; budgetRange?: string }>,
    createdBy: string,
  ): Promise<Record<string, unknown>>;
}

// ── Reporting Exporter ─────────────────────────────────────────────

export interface ReportingMetric {
  label: string;
  value: string | number;
}

export interface ReportingExportOptions {
  title: string;
  periodLabel: string;
  periodStart?: string;
  periodEnd?: string;
  summary?: ReportingMetric[];
  widgets: Array<Record<string, unknown>>;
  format: "pdf" | "pptx";
}

export interface ReportingExporterPort {
  generate(options: ReportingExportOptions): Promise<Buffer>;
}
