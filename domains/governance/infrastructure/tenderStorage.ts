/**
 * Governance Module — Infrastructure: Tender Storage Adapter
 *
 * Delegates ALL 50 tender storage operations through IStorage.
 */
import type { IGovernanceStoragePort, IDemandStoragePort, IIdentityStoragePort } from "@interfaces/storage/ports";
import type { TenderStoragePort } from "../domain/ports";

export class LegacyTenderStorage implements TenderStoragePort {
  constructor(private s: IGovernanceStoragePort & IDemandStoragePort & IIdentityStoragePort) {}

  // ── Core packages ───────────────────────────────────────────────
  createTenderPackage(d: Record<string, unknown>) { return this.s.createTenderPackage(d as unknown as Parameters<typeof this.s.createTenderPackage>[0]); }
  getTenderPackages() { return this.s.getTenderPackages(); }
  getTenderPackageById(id: string) { return this.s.getTenderPackageById(id).then(r => r ?? null); }
  getTenderPackagesByDemandId(id: string) { return this.s.getTenderPackagesByDemandId(id); }
  updateTenderPackage(id: string, d: Record<string, unknown>) { return this.s.updateTenderPackage(id, d as unknown as Parameters<typeof this.s.updateTenderPackage>[1]); }

  // ── Demand lookups ──────────────────────────────────────────────
  getDemandReport(id: string) { return this.s.getDemandReport(id); }
  getBusinessCaseByDemandReportId(id: string) { return this.s.getBusinessCaseByDemandReportId(id).then(r => r ?? null); }
  getUser(id: string) { return this.s.getUser(id).then(r => r ?? null); }

  // ── Tender notifications ────────────────────────────────────────
  createTenderNotification(d: Record<string, unknown>) { return this.s.createTenderNotification(d as unknown as Parameters<typeof this.s.createTenderNotification>[0]); }
  getNotificationsByRole(role: string, opts: Record<string, unknown>) { return this.s.getNotificationsByRole(role, opts as unknown as Parameters<typeof this.s.getNotificationsByRole>[1]); }
  getTenderNotifications(userId: string, opts: Record<string, unknown>) { return this.s.getTenderNotifications(userId, opts as unknown as Parameters<typeof this.s.getTenderNotifications>[1]); }
  markNotificationRead(id: string) { return this.s.markNotificationRead(id); }
  markAllNotificationsRead(userId: string) { return this.s.markAllNotificationsRead(userId); }

  // ── SLA management ──────────────────────────────────────────────
  getTenderSlaRules() { return this.s.getTenderSlaRules(); }
  createTenderSlaRule(d: Record<string, unknown>) { return this.s.createTenderSlaRule(d as unknown as Parameters<typeof this.s.createTenderSlaRule>[0]); }
  getTenderSlaMetrics() { return this.s.getTenderSlaMetrics(); }
  getUpcomingDeadlines(days: number) { return this.s.getUpcomingDeadlines(days); }
  getTenderSlaAssignment(id: string) { return this.s.getTenderSlaAssignment(id); }
  getTenderSlaRuleById(id: string) { return this.s.getTenderSlaRuleById(id).then(r => r ?? null); }
  getTenderSlaRuleByType(t: string) { return this.s.getTenderSlaRuleByType(t).then(r => r ?? null); }
  createTenderSlaAssignment(d: Record<string, unknown>) { return this.s.createTenderSlaAssignment(d as unknown as Parameters<typeof this.s.createTenderSlaAssignment>[0]); }
  updateTenderSlaAssignment(id: string, d: Record<string, unknown>) { return this.s.updateTenderSlaAssignment(id, d as unknown as Parameters<typeof this.s.updateTenderSlaAssignment>[1]); }
  getSlaAssignmentsByStatus(s: string) { return this.s.getSlaAssignmentsByStatus(s); }

  // ── Alerts ──────────────────────────────────────────────────────
  getTenderAlerts(f: Record<string, unknown>) { return this.s.getTenderAlerts(f as unknown as Parameters<typeof this.s.getTenderAlerts>[0]); }
  createTenderAlert(d: Record<string, unknown>) { return this.s.createTenderAlert(d as unknown as Parameters<typeof this.s.createTenderAlert>[0]); }
  resolveTenderAlert(id: string, userId: string, resolution: string) { return this.s.resolveTenderAlert(id, userId, resolution); }

  // ── RFP versions ────────────────────────────────────────────────
  getRfpDocumentVersions(tid: string) { return this.s.getRfpDocumentVersions(tid); }
  getLatestRfpDocumentVersion(tid: string) { return this.s.getLatestRfpDocumentVersion(tid); }
  createRfpDocumentVersion(d: Record<string, unknown>) { return this.s.createRfpDocumentVersion(d as unknown as Parameters<typeof this.s.createRfpDocumentVersion>[0]); }
  getRfpDocumentVersion(vid: string) { return this.s.getRfpDocumentVersion(vid); }
  updateRfpDocumentVersion(vid: string, d: Record<string, unknown>) { return this.s.updateRfpDocumentVersion(vid, d as unknown as Parameters<typeof this.s.updateRfpDocumentVersion>[1]); }
  deleteRfpDocumentVersion(vid: string) { return this.s.deleteRfpDocumentVersion(vid); }

  // ── Vendor participants ─────────────────────────────────────────
  getVendorParticipantsByDemand(did: string) { return this.s.getVendorParticipantsByDemand(did); }
  createVendorParticipant(d: Record<string, unknown>) { return this.s.createVendorParticipant(d as unknown as Parameters<typeof this.s.createVendorParticipant>[0]); }
  updateVendorParticipant(id: string, d: Record<string, unknown>) { return this.s.updateVendorParticipant(id, d as unknown as Parameters<typeof this.s.updateVendorParticipant>[1]); }
  deleteVendorParticipant(id: string) { return this.s.deleteVendorParticipant(id); }

  // ── Vendor proposals ────────────────────────────────────────────
  getVendorProposalsByDemand(did: string) { return this.s.getVendorProposalsByDemand(did); }
  createVendorProposal(d: Record<string, unknown>) { return this.s.createVendorProposal(d as unknown as Parameters<typeof this.s.createVendorProposal>[0]); }
  updateVendorProposal(id: string, d: Record<string, unknown>) { return this.s.updateVendorProposal(id, d as unknown as Parameters<typeof this.s.updateVendorProposal>[1]); }
  deleteVendorProposal(id: string) { return this.s.deleteVendorProposal(id); }

  // ── Criteria ────────────────────────────────────────────────────
  getEvaluationCriteriaByDemand(did: string) { return this.s.getEvaluationCriteriaByDemand(did); }
  getDefaultEvaluationCriteria() { return this.s.getDefaultEvaluationCriteria(); }
  createEvaluationCriteria(d: Record<string, unknown>) { return this.s.createEvaluationCriteria(d as unknown as Parameters<typeof this.s.createEvaluationCriteria>[0]); }
  updateEvaluationCriteria(id: string, d: Record<string, unknown>) { return this.s.updateEvaluationCriteria(id, d as unknown as Parameters<typeof this.s.updateEvaluationCriteria>[1]); }
  deleteEvaluationCriteria(id: string) { return this.s.deleteEvaluationCriteria(id); }

  // ── Scores ──────────────────────────────────────────────────────
  getProposalScoresByProposal(pid: string) { return this.s.getProposalScoresByProposal(pid); }
  createProposalScore(d: Record<string, unknown>) { return this.s.createProposalScore(d as unknown as Parameters<typeof this.s.createProposalScore>[0]); }
  updateProposalScore(id: string, d: Record<string, unknown>) { return this.s.updateProposalScore(id, d as unknown as Parameters<typeof this.s.updateProposalScore>[1]); }

  // ── Evaluations ─────────────────────────────────────────────────
  getVendorEvaluationByDemand(did: string) { return this.s.getVendorEvaluationByDemand(did); }
  createVendorEvaluation(d: Record<string, unknown>) { return this.s.createVendorEvaluation(d as unknown as Parameters<typeof this.s.createVendorEvaluation>[0]); }
  updateVendorEvaluation(id: string, d: Record<string, unknown>) { return this.s.updateVendorEvaluation(id, d as unknown as Parameters<typeof this.s.updateVendorEvaluation>[1]); }
}
