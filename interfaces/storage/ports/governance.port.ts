/**
 * Governance Storage Port — BusinessCase, Tender, Vendor evaluation methods
 */
import type {
  BusinessCase,
  InsertBusinessCase,
  UpdateBusinessCase,
  TenderPackage,
  InsertTenderPackage,
  TenderSlaRule,
  InsertTenderSlaRule,
  TenderSlaAssignment,
  InsertTenderSlaAssignment,
  TenderNotification,
  InsertTenderNotification,
  TenderAlert,
  InsertTenderAlert,
  RfpDocumentVersion,
  InsertRfpDocumentVersion,
  UpdateRfpDocumentVersion,
  VendorParticipant,
  InsertVendorParticipant,
  VendorProposal,
  InsertVendorProposal,
  EvaluationCriterion,
  InsertEvaluationCriterion,
  ProposalScore,
  InsertProposalScore,
  VendorEvaluation,
  InsertVendorEvaluation,
} from "@shared/schema";

export interface IGovernanceStoragePort {
  // Business Cases
  getBusinessCase(id: string): Promise<BusinessCase | undefined>;
  getBusinessCaseByDemandReportId(demandReportId: string): Promise<BusinessCase | undefined>;
  getAllBusinessCases(): Promise<BusinessCase[]>;
  getBusinessCasesByStatus(status: string): Promise<BusinessCase[]>;
  createBusinessCase(businessCase: InsertBusinessCase): Promise<BusinessCase>;
  updateBusinessCase(id: string, updates: UpdateBusinessCase): Promise<BusinessCase | undefined>;
  deleteBusinessCase(id: string): Promise<boolean>;

  // Tender Package Management
  createTenderPackage(tender: InsertTenderPackage): Promise<TenderPackage>;
  getTenderPackages(): Promise<TenderPackage[]>;
  getTenderPackageById(id: string): Promise<TenderPackage | undefined>;
  getTenderPackagesByDemandId(demandId: string): Promise<TenderPackage[]>;
  updateTenderPackage(id: string, updates: Partial<TenderPackage>): Promise<void>;

  // Tender SLA Management
  getTenderSlaRules(): Promise<TenderSlaRule[]>;
  getTenderSlaRuleById(id: string): Promise<TenderSlaRule | undefined>;
  getTenderSlaRuleByType(tenderType: string): Promise<TenderSlaRule | undefined>;
  createTenderSlaRule(rule: InsertTenderSlaRule): Promise<TenderSlaRule>;
  updateTenderSlaRule(id: string, updates: Partial<TenderSlaRule>): Promise<void>;

  // SLA Assignments
  getTenderSlaAssignment(tenderId: string): Promise<TenderSlaAssignment | undefined>;
  getSlaAssignmentsByStatus(status: string): Promise<TenderSlaAssignment[]>;
  createTenderSlaAssignment(assignment: InsertTenderSlaAssignment): Promise<TenderSlaAssignment>;
  updateTenderSlaAssignment(id: string, updates: Partial<TenderSlaAssignment>): Promise<void>;

  // Tender Notifications
  getTenderNotifications(recipientUserId: string, options?: { unreadOnly?: boolean; limit?: number }): Promise<TenderNotification[]>;
  getNotificationsByRole(role: string, options?: { unreadOnly?: boolean; limit?: number }): Promise<TenderNotification[]>;
  createTenderNotification(notification: InsertTenderNotification): Promise<TenderNotification>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(recipientUserId: string): Promise<void>;

  // Tender Alerts
  getTenderAlerts(options?: { tenderId?: string; status?: string; severity?: string }): Promise<TenderAlert[]>;
  createTenderAlert(alert: InsertTenderAlert): Promise<TenderAlert>;
  updateTenderAlert(id: string, updates: Partial<TenderAlert>): Promise<void>;
  resolveTenderAlert(id: string, resolvedBy: string, resolution?: string): Promise<void>;

  // SLA Metrics
  getTenderSlaMetrics(): Promise<{ onTrack: number; atRisk: number; breached: number; completed: number }>;
  getUpcomingDeadlines(daysAhead?: number): Promise<TenderSlaAssignment[]>;

  // RFP Document Versions
  createRfpDocumentVersion(version: InsertRfpDocumentVersion): Promise<RfpDocumentVersion>;
  getRfpDocumentVersion(versionId: string): Promise<RfpDocumentVersion | undefined>;
  getRfpDocumentVersions(tenderId: string): Promise<RfpDocumentVersion[]>;
  getLatestRfpDocumentVersion(tenderId: string): Promise<RfpDocumentVersion | undefined>;
  updateRfpDocumentVersion(versionId: string, updates: Partial<UpdateRfpDocumentVersion>): Promise<RfpDocumentVersion | undefined>;
  deleteRfpDocumentVersion(versionId: string): Promise<boolean>;

  // Vendor Participants
  createVendorParticipant(vendor: InsertVendorParticipant): Promise<VendorParticipant>;
  getVendorParticipant(id: string): Promise<VendorParticipant | undefined>;
  getVendorParticipantsByDemand(demandReportId: string): Promise<VendorParticipant[]>;
  updateVendorParticipant(id: string, updates: Partial<VendorParticipant>): Promise<VendorParticipant | undefined>;
  deleteVendorParticipant(id: string): Promise<boolean>;

  // Vendor Proposals
  createVendorProposal(proposal: InsertVendorProposal): Promise<VendorProposal>;
  getVendorProposal(id: string): Promise<VendorProposal | undefined>;
  getVendorProposalsByDemand(demandReportId: string): Promise<VendorProposal[]>;
  getVendorProposalsByVendor(vendorId: string): Promise<VendorProposal[]>;
  updateVendorProposal(id: string, updates: Partial<VendorProposal>): Promise<VendorProposal | undefined>;
  deleteVendorProposal(id: string): Promise<boolean>;

  // Evaluation Criteria
  createEvaluationCriteria(criteria: InsertEvaluationCriterion): Promise<EvaluationCriterion>;
  getEvaluationCriteria(id: string): Promise<EvaluationCriterion | undefined>;
  getEvaluationCriteriaByDemand(demandReportId: string): Promise<EvaluationCriterion[]>;
  getDefaultEvaluationCriteria(): Promise<EvaluationCriterion[]>;
  updateEvaluationCriteria(id: string, updates: Partial<EvaluationCriterion>): Promise<EvaluationCriterion | undefined>;
  deleteEvaluationCriteria(id: string): Promise<boolean>;

  // Proposal Scores
  createProposalScore(score: InsertProposalScore): Promise<ProposalScore>;
  getProposalScore(id: string): Promise<ProposalScore | undefined>;
  getProposalScoresByProposal(proposalId: string): Promise<ProposalScore[]>;
  getProposalScoresByCriterion(criterionId: string): Promise<ProposalScore[]>;
  updateProposalScore(id: string, updates: Partial<ProposalScore>): Promise<ProposalScore | undefined>;
  deleteProposalScore(id: string): Promise<boolean>;

  // Vendor Evaluations (Aggregated Results)
  createVendorEvaluation(evaluation: InsertVendorEvaluation): Promise<VendorEvaluation>;
  getVendorEvaluation(id: string): Promise<VendorEvaluation | undefined>;
  getVendorEvaluationByDemand(demandReportId: string): Promise<VendorEvaluation | undefined>;
  updateVendorEvaluation(id: string, updates: Partial<VendorEvaluation>): Promise<VendorEvaluation | undefined>;
}
