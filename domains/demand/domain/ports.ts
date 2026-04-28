/**
 * Demand Module — Domain Ports
 *
 * Every external dependency the demand module needs is declared here
 * as a pure interface.  Infrastructure adapters (in ../infrastructure/)
 * implement these ports; application use-cases depend only on port types.
 *
 * Shared schema types (@shared/*) are allowed — they represent the domain model.
 */

import type {
  DecisionRequest,
  VersionBranch,
  BranchMerge,
  SectionAssignment,
  ReportVersion,
  VersionAuditLog,
  User,
  Team,
  TeamMember,
  Notification,
  BusinessCase,
  InsertVersionBranch,
  UpdateVersionBranch,
  InsertBranchMerge,
  InsertSectionAssignment,
  UpdateSectionAssignment,
  InsertReportVersion,
  UpdateReportVersion,
  InsertVersionAuditLog,
  InsertNotification,
  InsertBusinessCase,
  UpdateBusinessCase,
} from "@shared/schema";

// ── Brain / Decision-Spine Pipeline ────────────────────────────────

export interface BrainPipelineResult {
  decisionId: string;
  correlationId: string;
  finalStatus: string;
  decision?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface BrainDecisionRecord {
  id: string;
  inputData?: Record<string, unknown> | string | null;
  [key: string]: unknown;
}

export interface BrainDecisionUpdate {
  status?: string;
  completedAt?: Date;
  [key: string]: unknown;
}

export interface BrainApprovalRecord {
  id: string;
  status?: string;
  approvedBy?: string;
  approvalReason?: string;
  rejectionReason?: string;
  revisionNotes?: string;
  [key: string]: unknown;
}

export interface GovernanceIntakeRequest {
  intent: string;
  decisionType: string;
  financialImpact: string;
  financialAmount?: number;
  regulatoryRisk?: string;
  urgency?: string;
  sourceType: string;
  sourceId?: string;
  sourceContext?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface GovernanceContext {
  userId: string;
  userRole?: string;
  organizationId?: string;
  departmentId?: string;
  decisionSpineId?: string;
  [key: string]: unknown;
}

export interface GovernanceIntakeResult {
  requestId?: string;
  requestNumber?: string;
  governance?: {
    action?: string;
    reason?: string;
    requiredApprovers?: string[];
    [key: string]: unknown;
  };
  readiness?: {
    overall?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface BrainPipeline {
  /** Execute a Brain pipeline (coreviaOrchestrator.execute wrapper) */
  execute(
    domain: string,
    signal: string,
    input: Record<string, unknown>,
    userId: string,
    orgId?: string,
    opts?: Record<string, unknown>,
  ): Promise<BrainPipelineResult>;

  /* ── coreviaStorage read/write wrappers ── */
  getDecisionByCorrelationId(correlationId: string): Promise<BrainDecisionRecord | undefined>;
  findLatestDecisionByDemandReportId(reportId: string): Promise<BrainDecisionRecord | undefined>;
  getFullDecisionWithLayers(decisionId: string): Promise<Record<string, unknown> | undefined>;
  getLatestDecisionArtifactVersion(filter: {
    decisionSpineId: string;
    artifactType: string;
  }): Promise<Record<string, unknown> | undefined>;
  getHighestLayerForSpine(decisionSpineId: string): Promise<number>;
  upsertDecisionArtifactVersion(data: Record<string, unknown>): Promise<void>;
  /** Append a governance event to the decision spine event log (brain_events). */
  recordSpineEvent(
    decisionSpineId: string,
    eventType: string,
    actorId: string | undefined,
    payload: Record<string, unknown>,
  ): Promise<void>;
  /** Transition a decision artifact's status (DRAFT | IN_REVIEW | APPROVED | REJECTED | ARCHIVED). */
  updateDecisionArtifactStatus(artifactId: string, status: string): Promise<void>;
  updateDecision(id: string, data: BrainDecisionUpdate): Promise<void>;
  getApproval(id: string): Promise<BrainApprovalRecord | undefined>;
  updateApproval(id: string, data: Record<string, unknown>): Promise<void>;
  addAuditEvent(
    decisionId: string,
    correlationId: string,
    layer: number,
    action: string,
    data: Record<string, unknown>,
    userId: string,
  ): Promise<void>;
  listDecisions(): Promise<BrainDecisionRecord[]>;

  /* ── Sub-decision & artifact management ── */
  findSubDecision(decisionSpineId: string, subDecisionType: string): Promise<Record<string, unknown> | undefined>;
  createDecisionArtifact(data: Record<string, unknown>): Promise<Record<string, unknown>>;
  createDecisionArtifactVersion(data: Record<string, unknown>): Promise<Record<string, unknown>>;
  createSubDecision(data: Record<string, unknown>): Promise<Record<string, unknown>>;
  createApproval(data: Record<string, unknown>): Promise<Record<string, unknown>>;

  /* ── Spine orchestrator wrappers ── */
  handleSpineEvent(event: Record<string, unknown>): Promise<void>;
  handleSubDecisionEvent(event: Record<string, unknown>): Promise<void>;

  /* ── demandSyncService wrapper ── */
  syncDecisionToDemand(decisionId: string, userId: string): Promise<void>;
}

// ── Governance / Decision-Request Checks ───────────────────────────

export interface GovernanceChecker {
  findPendingApprovalsBySourceId(sourceId: string): Promise<DecisionRequest[]>;
  findApprovedBySourceId(sourceId: string): Promise<DecisionRequest[]>;
  intake(request: GovernanceIntakeRequest, context: GovernanceContext): Promise<GovernanceIntakeResult>;
}

// ── Branch Management ──────────────────────────────────────────────

export interface BranchRepository {
  create(data: Partial<InsertVersionBranch>): Promise<VersionBranch>;
  findByReportId(reportId: string, userId: string): Promise<VersionBranch[]>;
  getTree(reportId: string, userId: string): Promise<Record<string, unknown>>;
  findById(branchId: string, userId: string): Promise<VersionBranch | undefined>;
  update(branchId: string, data: Partial<UpdateVersionBranch>, userId: string): Promise<VersionBranch>;
  delete(branchId: string, userId: string): Promise<boolean>;
  createMerge(data: Partial<InsertBranchMerge>): Promise<BranchMerge>;
  getMerges(reportId: string): Promise<BranchMerge[]>;
}

// ── Section Assignments ────────────────────────────────────────────

export interface SectionAssignmentRepository {
  findByReportId(reportId: string): Promise<SectionAssignment[]>;
  findByReportIdAndSection(reportId: string, sectionName: string): Promise<SectionAssignment | undefined>;
  assign(data: Partial<InsertSectionAssignment>): Promise<SectionAssignment>;
  update(reportId: string, sectionName: string, data: Partial<UpdateSectionAssignment>): Promise<SectionAssignment>;
  remove(reportId: string, sectionName: string): Promise<boolean>;
}

// ── Report Versions ────────────────────────────────────────────────

export interface VersionIntegrity {
  isValid: boolean;
  errors: string[];
  [key: string]: unknown;
}

export interface ReportVersionRepository {
  findByReportId(reportId: string): Promise<ReportVersion[]>;
  findById(id: string): Promise<ReportVersion | undefined>;
  getLatestByType(reportId: string, versionType: string): Promise<ReportVersion | undefined>;
  getLatest(reportId: string): Promise<ReportVersion | undefined>;
  getByStatus(reportId: string, status: string): Promise<ReportVersion[]>;
  getByMajor(reportId: string, major: number): Promise<ReportVersion[]>;
  getByPattern(reportId: string, pattern: string): Promise<ReportVersion[]>;
  create(data: Partial<InsertReportVersion>): Promise<ReportVersion>;
  update(id: string, data: Partial<UpdateReportVersion>): Promise<ReportVersion>;
  delete(id: string): Promise<boolean>;
  createAuditLog(data: Partial<InsertVersionAuditLog>): Promise<VersionAuditLog>;
  getAuditLog(versionId: string): Promise<VersionAuditLog[]>;
  validateIntegrity(versionId: string): Promise<VersionIntegrity>;
  executeInTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

// ── Workflow Email Notifications ───────────────────────────────────

export interface WorkflowNotifier {
  sendMeetingRequest(
    email: string,
    name: string,
    title: string,
    org: string,
    reportId: string,
  ): Promise<boolean>;
  sendManagerApproval(
    email: string,
    title: string,
    org: string,
    requesterName: string,
    reportId: string,
  ): Promise<boolean>;
  sendWorkflowStatus(
    email: string,
    name: string,
    title: string,
    org: string,
    status: string,
    reason: string,
    reportId: string,
  ): Promise<boolean>;
  sendSpecialistNotification(
    email: string,
    name: string,
    role: string,
    title: string,
    org: string,
    params: { urgency: string; insight: string; reportId: string },
  ): Promise<boolean>;
  sendBusinessCaseMeeting(params: Record<string, unknown>): Promise<void>;
  sendBusinessCaseToManager(
    managerEmail: string,
    businessCaseData: Record<string, unknown>,
    versionNumber: string,
    senderName: string,
    message: string,
    reportId: string,
    params: { versionId: string; reportTitle?: string },
  ): Promise<boolean>;
  sendRequirementsToManager(
    managerEmail: string,
    requirementsData: Record<string, unknown>,
    teamAssignments: Array<{ team: string; [key: string]: unknown }>,
    versionNumber: string,
    senderName: string,
    message: string,
    params: { reportId: string; versionId: string; reportTitle?: string },
  ): Promise<boolean>;
  sendTeamAssignment(
    members: Array<{ email: string; displayName: string }>,
    teamName: string,
    sectionName: string,
    projectDesc: string,
    reportId: string,
    assignedByName: string,
    notes?: string,
  ): Promise<{ sent: number; failed: number }>;
  createNotificationLogEntry(type: string, email: string, success: boolean): unknown;
  getSuperadminUserId(): Promise<string | undefined>;
}

// ── COREVIA AI Notifications ───────────────────────────────────────

export interface CoveriaNotifier {
  notify(params: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    priority?: string;
    relatedType?: string;
    relatedId?: string;
    actionUrl?: string;
  }): Promise<void>;
}

// ── Audit Logging ──────────────────────────────────────────────────

export interface AuditLogger {
  log(event: {
    storage: unknown;
    req: unknown;
    userId: string;
    action: string;
    result: string;
    details: Record<string, unknown>;
  }): Promise<void>;
}

// ── Document Export ─────────────────────────────────────────────────

export interface DocumentExporter {
  exportDocument(params: {
    storage: unknown;
    reportId: string;
    versionId?: string;
    type: string;
    format: string;
  }): Promise<Buffer>;
  generateWithAgent(params: {
    storage: unknown;
    reportId: string;
    format: string;
    versionId?: string;
  }): Promise<Buffer>;
}

// ── Financial Modelling ────────────────────────────────────────────

export interface FinancialModeler {
  compute(inputs: Record<string, unknown>): Record<string, unknown>;
  buildInputsFromData(
    businessCase: Record<string, unknown>,
    demandReport: Record<string, unknown>,
    defaults?: Record<string, unknown>,
  ): Record<string, unknown>;
  detectArchetype(data: Record<string, unknown>): string;
}

// ── Version Management Service ─────────────────────────────────────

export interface VersionValidation {
  isValid: boolean;
  errors: string[];
  [key: string]: unknown;
}

export interface VersionTransition {
  isValid: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface NextVersionInfo {
  versionString: string;
  major: number;
  minor: number;
  patch: number;
  [key: string]: unknown;
}

export interface AuditLogEntryParams {
  action: string;
  versionId: string;
  reportId: string;
  performedBy: string;
  performedByName: string;
  description: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  sessionId?: string;
  ipAddress?: string;
  performedByRole?: string;
  performedByDepartment?: string;
  complianceLevel?: "standard" | "high" | "critical";
}

export interface VersionManager {
  createAuditLogEntry(params: AuditLogEntryParams): Record<string, unknown>;
  createVersionMetadata(
    request: Record<string, unknown>,
    validation: Record<string, unknown>,
    version: Record<string, unknown>,
  ): Record<string, unknown>;
  generateChangesDetails(
    originalContent: Record<string, unknown>,
    newContent: Record<string, unknown>,
    changesSummary: string,
  ): Record<string, unknown>;
  generateNextVersion(
    existingVersions: ReportVersion[],
    versionType: "major" | "minor" | "patch",
  ): Promise<NextVersionInfo>;
  generateRollbackVersionNumber(data: ReportVersion[]): string;
  validateVersionContent(
    data: Record<string, unknown>,
    validationLevel?: "basic" | "standard" | "strict",
  ): VersionValidation;
  validateVersionTransition(
    currentStatus: string,
    newStatus: string,
    userRole?: string,
  ): VersionTransition;
}

// ── Version Impact Analysis ────────────────────────────────────────

export interface VersionAnalyzer {
  analyzeImpact(
    oldVersion: Record<string, unknown>,
    newVersion: Record<string, unknown>,
    context: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  generateSummary(
    oldVersion: Record<string, unknown>,
    newVersion: Record<string, unknown>,
    contentType: "business_case" | "requirements",
  ): Promise<string>;
}

// ── Business-Case Content Enrichment ───────────────────────────────

export interface ContentEnricher {
  enrichStakeholderAnalysis(stakeholders: unknown): Record<string, unknown>;
  enrichAssumptions(assumptions: unknown): Record<string, unknown>;
  enrichRecommendations(
    recommendations: unknown,
    nextSteps: unknown,
    financialViability?: unknown,
  ): Record<string, unknown>;
}

// ── Crypto Operations ──────────────────────────────────────────────

export interface CryptoServicePort {
  create(storage?: unknown): {
    canSignVersions(role: string): boolean;
    signVersion(...args: unknown[]): Promise<Record<string, unknown>>;
    verifySignature(...args: unknown[]): Record<string, unknown>;
    getAuditTrail(versionId: string): Promise<Array<Record<string, unknown>>>;
    [key: string]: unknown;
  };
}

// ── WebSocket Presence ─────────────────────────────────────────────

export interface PresenceTracker {
  getVersionPresence(versionId: string): {
    viewers: Array<Record<string, unknown>>;
    editors: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
}

// ── Auto-Indexing ──────────────────────────────────────────────────

export interface AutoIndexer {
  index(reportId: string, versionId: string | null, actorId: string): Promise<void>;
}

// ── Project ID Sequence ────────────────────────────────────────────

export interface ProjectIdGenerator {
  next(): Promise<string>;
  projectIdExists(projectId: string): Promise<boolean>;
}

// ── User Reader (cross-module read port) ───────────────────────────

export interface UserReader {
  getUser(id: string): Promise<User | undefined>;
  getTeamMembers(teamId: string): Promise<Array<TeamMember & { user: User }>>;
  getTeam(teamId: string): Promise<Team | undefined>;
  getUserTeams(userId: string): Promise<Team[]>;
  createNotification(data: Partial<InsertNotification>): Promise<Notification>;
  getUsersWithPermission(permission: string): Promise<User[]>;
}

// ── Business Case Repository ───────────────────────────────────────

export interface BusinessCaseRepository {
  findByDemandReportId(reportId: string): Promise<BusinessCase | undefined>;
  findById(id: string): Promise<BusinessCase | undefined>;
  create(data: Partial<InsertBusinessCase>): Promise<BusinessCase>;
  update(id: string, data: Partial<UpdateBusinessCase>): Promise<BusinessCase>;
}

// ── Demand Sync ────────────────────────────────────────────────────
// (included in BrainPipeline.syncDecisionToDemand, but kept as
//  a standalone port for callers that only need sync)

export interface DemandSyncPort {
  syncDecisionToDemandCollection(decisionId: string, userId: string): Promise<void>;
}
