/**
 * Governance Module — Domain Layer: Port Interfaces
 *
 * No DB, HTTP, or framework imports allowed.
 */

import type {
  InsertNotification,
  InsertTenderPackage,
  InsertTenderNotification,
  InsertTenderSlaRule,
  InsertTenderSlaAssignment,
  InsertTenderAlert,
  InsertRfpDocumentVersion,
  UpdateRfpDocumentVersion,
  InsertVendorParticipant,
  InsertVendorProposal,
  InsertEvaluationCriterion,
  InsertProposalScore,
  InsertVendorEvaluation,
} from "@shared/schema";

// ════════════════════════════════════════════════════════════════════
// GATES PORTS
// ════════════════════════════════════════════════════════════════════

export interface GateOrchestratorPort {
  getGateCatalog(phase?: string): Promise<unknown>;
  getPendingApprovals(): Promise<unknown>;
  evaluateGateReadiness(projectId: string): Promise<unknown>;
  getGateOverview(projectId: string): Promise<{ currentPhase?: string; phases: Array<Record<string, unknown>> }>;
  getPhaseUnlockStatus(projectId: string): Promise<unknown>;
  getProjectGate(projectId: string): Promise<{ currentPhase?: string } | null>;
  requestGateApproval(projectId: string, userId?: string): Promise<{ success?: boolean; message?: string; [k: string]: unknown }>;
  processGateApproval(params: Record<string, unknown>): Promise<{ success?: boolean; [k: string]: unknown }>;
  updateCheckResult(checkId: string, params: Record<string, unknown>): Promise<unknown>;
  getGateHistory(projectId: string): Promise<unknown>;
  getAuditLog(projectId: string, limit: number): Promise<unknown>;
}

export interface GateCatalogWriterPort {
  seedDefaultChecks(checks: Record<string, unknown>[]): Promise<number>;
}

export interface GateProjectPort {
  getProject(id: string): Promise<Record<string, unknown> | null>;
  getProjectStakeholders(id: string): Promise<Array<{ userId?: string; [k: string]: unknown }>>;
  getUsersByRole(role: string): Promise<Array<{ id?: string; [k: string]: unknown }>>;
  createNotification(data: Partial<InsertNotification>): Promise<unknown>;
}

// ════════════════════════════════════════════════════════════════════
// TENDER PORTS
// ════════════════════════════════════════════════════════════════════

export interface TenderStoragePort {
  // Core packages
  createTenderPackage(data: Partial<InsertTenderPackage>): Promise<unknown>;
  getTenderPackages(): Promise<unknown[]>;
  getTenderPackageById(id: string): Promise<Record<string, unknown> | null>;
  getTenderPackagesByDemandId(demandId: string): Promise<unknown[]>;
  updateTenderPackage(id: string, data: Partial<InsertTenderPackage>): Promise<void>;
  // Demand lookups
  getDemandReport(id: string): Promise<unknown | null>;
  getBusinessCaseByDemandReportId(id: string): Promise<{ id: string } | null>;
  getUser(id: string): Promise<{ displayName?: string } | null>;
  // Tender notifications
  createTenderNotification(data: Partial<InsertTenderNotification>): Promise<unknown>;
  getNotificationsByRole(role: string, opts: Record<string, unknown>): Promise<unknown[]>;
  getTenderNotifications(userId: string, opts: Record<string, unknown>): Promise<unknown[]>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  // SLA
  getTenderSlaRules(): Promise<unknown[]>;
  createTenderSlaRule(data: Partial<InsertTenderSlaRule>): Promise<unknown>;
  getTenderSlaMetrics(): Promise<unknown>;
  getUpcomingDeadlines(days: number): Promise<unknown[]>;
  getTenderSlaAssignment(id: string): Promise<unknown | null>;
  getTenderSlaRuleById(id: string): Promise<{ submissionDeadlineHours: number; reviewDeadlineHours: number; approvalDeadlineHours: number; id: string } | null>;
  getTenderSlaRuleByType(type: string): Promise<{ submissionDeadlineHours: number; reviewDeadlineHours: number; approvalDeadlineHours: number; id: string } | null>;
  createTenderSlaAssignment(data: Partial<InsertTenderSlaAssignment>): Promise<unknown>;
  updateTenderSlaAssignment(id: string, data: Partial<InsertTenderSlaAssignment>): Promise<void>;
  getSlaAssignmentsByStatus(status: string): Promise<Array<Record<string, unknown>>>;
  // Alerts
  getTenderAlerts(filters: Record<string, unknown>): Promise<unknown[]>;
  createTenderAlert(data: Partial<InsertTenderAlert>): Promise<unknown>;
  resolveTenderAlert(id: string, userId: string, resolution: string): Promise<void>;
  // RFP Versions
  getRfpDocumentVersions(tenderId: string): Promise<unknown[]>;
  getLatestRfpDocumentVersion(tenderId: string): Promise<unknown | null>;
  createRfpDocumentVersion(data: Partial<InsertRfpDocumentVersion>): Promise<unknown>;
  getRfpDocumentVersion(versionId: string): Promise<unknown | null>;
  updateRfpDocumentVersion(versionId: string, data: Partial<UpdateRfpDocumentVersion>): Promise<unknown>;
  deleteRfpDocumentVersion(versionId: string): Promise<boolean>;
  // Vendor participants
  getVendorParticipantsByDemand(demandId: string): Promise<unknown[]>;
  createVendorParticipant(data: Partial<InsertVendorParticipant>): Promise<unknown>;
  updateVendorParticipant(id: string, data: Partial<InsertVendorParticipant>): Promise<unknown>;
  deleteVendorParticipant(id: string): Promise<boolean>;
  // Vendor proposals
  getVendorProposalsByDemand(demandId: string): Promise<unknown[]>;
  createVendorProposal(data: Partial<InsertVendorProposal>): Promise<unknown>;
  updateVendorProposal(id: string, data: Partial<InsertVendorProposal>): Promise<unknown>;
  deleteVendorProposal(id: string): Promise<boolean>;
  // Criteria
  getEvaluationCriteriaByDemand(demandId: string): Promise<unknown[]>;
  getDefaultEvaluationCriteria(): Promise<unknown[]>;
  createEvaluationCriteria(data: Partial<InsertEvaluationCriterion>): Promise<unknown>;
  updateEvaluationCriteria(id: string, data: Partial<InsertEvaluationCriterion>): Promise<unknown>;
  deleteEvaluationCriteria(id: string): Promise<boolean>;
  // Scores
  getProposalScoresByProposal(proposalId: string): Promise<unknown[]>;
  createProposalScore(data: Partial<InsertProposalScore>): Promise<unknown>;
  updateProposalScore(id: string, data: Partial<InsertProposalScore>): Promise<unknown>;
  // Evaluations
  getVendorEvaluationByDemand(demandId: string): Promise<unknown | null>;
  createVendorEvaluation(data: Partial<InsertVendorEvaluation>): Promise<unknown>;
  updateVendorEvaluation(id: string, data: Partial<InsertVendorEvaluation>): Promise<unknown>;
}

export interface TenderContentGeneratorPort {
  generateTender(demand: unknown): Promise<unknown>;
}

// ════════════════════════════════════════════════════════════════════
// VENDOR EVALUATION PORTS
// ════════════════════════════════════════════════════════════════════

export interface VendorDbPort {
  listVendors(demandReportId: string): Promise<unknown[]>;
  createVendor(data: Partial<InsertVendorParticipant>): Promise<unknown>;
  updateVendor(id: string, data: Partial<InsertVendorParticipant>): Promise<unknown>;
  deleteVendor(id: string): Promise<void>;
  listProposals(demandReportId: string): Promise<unknown[]>;
  getProposal(proposalId: string): Promise<Record<string, unknown> | null>;
  createProposal(data: Partial<InsertVendorProposal>): Promise<unknown>;
  updateProposalStatus(proposalId: string, data: Partial<InsertVendorProposal>): Promise<void>;
  updateVendorStatus(vendorId: string, data: Partial<InsertVendorParticipant>): Promise<void>;
  listCriteria(demandReportId: string): Promise<Array<Record<string, unknown>>>;
  listDefaultCriteria(): Promise<Array<Record<string, unknown>>>;
  createCriterion(data: Partial<InsertEvaluationCriterion>): Promise<unknown>;
  listScores(proposalId: string): Promise<unknown[]>;
  upsertScore(data: Partial<InsertProposalScore>): Promise<void>;
  createEvaluation(data: Partial<InsertVendorEvaluation>): Promise<unknown>;
  updateEvaluation(id: string, data: Partial<InsertVendorEvaluation>): Promise<unknown>;
  getLatestEvaluation(demandReportId: string): Promise<unknown | null>;
  markVendorEvaluated(vendorId: string): Promise<void>;
}

export interface BrainDraftPort {
  generate(params: Record<string, unknown>): Promise<{ content: unknown }>;
}

export interface ProposalQueuePort {
  enqueue(proposalId: string): Promise<string>;
}

export interface FileSecurityPort {
  enforce(params: Record<string, unknown>): Promise<void>;
  logRejection(params: Record<string, unknown>, message: string): void;
  safeUnlink(filePath?: string): Promise<void>;
}

// ════════════════════════════════════════════════════════════════════
// BUSINESS CASE PORTS
// ════════════════════════════════════════════════════════════════════

export interface BusinessCaseReaderPort {
  getById(id: string): Promise<unknown | undefined>;
}
