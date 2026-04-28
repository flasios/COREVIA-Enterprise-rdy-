/**
 * Demand Module — Domain Layer
 *
 * Entities, value objects, domain policies, domain events, and ports.
 * Must NOT import DB, HTTP, queues, or filesystem.
 *
 * Allowed imports: shared/primitives, shared/contracts only.
 */

import type { Money, EmailAddress } from "@shared/primitives/valueObjects";

// ── Value Objects ──────────────────────────────────────────────────

export type DemandStatus = "draft" | "submitted" | "under_review" | "approved" | "rejected" | "archived";

export type WorkflowStatus =
  | "intake"
  | "analysis"
  | "review"
  | "approved"
  | "rejected"
  | "converted"
  | "archived";

export type ConversionStatus = "pending" | "under_review" | "approved" | "rejected";

export type Urgency = "low" | "medium" | "high" | "critical";

export type RejectionCategory =
  | "budget_insufficient"
  | "strategic_misalignment"
  | "duplicate_request"
  | "incomplete_information"
  | "deferred"
  | "other";

// ── Workflow State Machine ─────────────────────────────────────────

/**
 * Valid workflow transitions — the single source of truth for demand lifecycle.
 * Prevents invalid status jumps when extracted from use-case layer.
 */
const WORKFLOW_TRANSITIONS: Record<string, readonly string[]> = {
  generated:           ["acknowledged", "rejected"],
  acknowledged:        ["meeting_scheduled", "under_review", "rejected", "deferred"],
  meeting_scheduled:   ["under_review", "rejected", "deferred"],
  under_review:        ["initially_approved", "rejected", "deferred"],
  initially_approved:  ["manager_approved", "rejected", "deferred"],
  manager_approved:    ["pending_conversion", "approved", "rejected"],
  pending_conversion:  ["approved", "completed", "rejected"],
  approved:            ["completed", "converted"],
  completed:           ["archived"],
  converted:           ["archived"],
  rejected:            ["archived"],
  deferred:            ["acknowledged", "archived"],
  intake:              ["analysis", "rejected"],
  analysis:            ["review", "rejected"],
  review:              ["approved", "rejected"],
  archived:            [],
} as const;

/**
 * Check if a workflow transition is valid.
 */
export function isValidTransition(from: string, to: string): boolean {
  const allowed = WORKFLOW_TRANSITIONS[from];
  return allowed != null && allowed.includes(to);
}

/**
 * Get all valid next states from a given workflow status.
 */
export function allowedTransitions(from: string): readonly string[] {
  return WORKFLOW_TRANSITIONS[from] ?? [];
}

/**
 * Check if a workflow status is terminal (no further transitions).
 */
export function isTerminalStatus(status: string): boolean {
  const allowed = WORKFLOW_TRANSITIONS[status];
  return allowed != null && allowed.length === 0;
}

/**
 * Timestamp field to set when transitioning to a new status.
 */
export function timestampFieldForStatus(status: string): string | null {
  const map: Record<string, string> = {
    acknowledged: "acknowledgedAt",
    meeting_scheduled: "meetingScheduledAt",
    under_review: "reviewStartedAt",
    approved: "approvedAt",
    initially_approved: "approvedAt",
    manager_approved: "managerApprovedAt",
    completed: "completedAt",
    rejected: "rejectedAt",
    deferred: "deferredAt",
  };
  return map[status] ?? null;
}

// ── Budget Governance Policy ───────────────────────────────────────

/** Default governance threshold (AED). Demands above this require governance review. */
export const DEFAULT_GOVERNANCE_BUDGET_THRESHOLD = 100_000;

/** High-impact threshold for critical financial classification. */
export const HIGH_IMPACT_BUDGET_THRESHOLD = 10_000_000;

/**
 * Parse a budget string like "AED 60M", "5,000,000", "AED 5-10M" into a numeric amount.
 * Domain-pure — no I/O. Works with human-readable budget formats.
 */
export function parseBudgetAmount(budgetRange: string): number {
  const hasMillion = /M(?:illion)?/i.test(budgetRange);
  const hasBillion = /B(?:illion)?/i.test(budgetRange);
  const hasThousand = /K|Thousand/i.test(budgetRange) && !hasMillion && !hasBillion;

  const numberPattern = /[\d,]+(?:\.\d+)?/g;
  const rawNumbers = budgetRange.match(numberPattern);
  if (!rawNumbers || rawNumbers.length === 0) return 0;

  const firstNum = parseFloat(rawNumbers[0].replace(/,/g, ""));
  if (hasBillion) return firstNum * 1_000_000_000;
  if (hasMillion) return firstNum * 1_000_000;
  if (hasThousand) return firstNum * 1_000;
  return firstNum;
}

/**
 * Determine financial impact classification for governance review.
 */
export function classifyFinancialImpact(
  budgetAmount: number,
): "low" | "medium" | "high" | "critical" {
  if (budgetAmount >= HIGH_IMPACT_BUDGET_THRESHOLD) return "critical";
  if (budgetAmount >= DEFAULT_GOVERNANCE_BUDGET_THRESHOLD) return "high";
  if (budgetAmount >= 50_000) return "medium";
  return "low";
}

/**
 * Check if a demand requires governance review based on budget.
 */
export function requiresGovernanceReview(
  budgetAmount: number,
  threshold: number = DEFAULT_GOVERNANCE_BUDGET_THRESHOLD,
): boolean {
  return budgetAmount >= threshold;
}

// Re-export shared VOs for convenience
export type { Money, EmailAddress };

// ── Domain Records ─────────────────────────────────────────────────

export interface DemandReport {
  id: string;
  projectId?: string | null;
  title: string;
  status: string;
  workflowStatus?: string | null;
  createdBy?: string | null;
  businessObjective?: string | null;
  department?: string | null;
  urgency?: string | null;
  suggestedProjectName?: string | null;
  budgetRange?: string | null;
  estimatedBudget?: string | null;
  organizationName?: string | null;
  requestorName?: string | null;
  requestorEmail?: string | null;
  managerEmail?: string | null;
  meetingScheduled?: boolean | null;
  meetingDate?: Date | null;
  meetingNotes?: string | null;
  decisionReason?: string | null;
  rejectionCategory?: string | null;
  deferredUntil?: Date | null;
  approvedBy?: string | null;
  acknowledgedAt?: Date | null;
  meetingScheduledAt?: Date | null;
  reviewStartedAt?: Date | null;
  approvedAt?: Date | null;
  managerApprovedAt?: Date | null;
  completedAt?: Date | null;
  rejectedAt?: Date | null;
  deferredAt?: Date | null;
  submittedAt?: Date | null;
  aiAnalysis?: Record<string, unknown> | string | null;
  decisionSpineId?: string | null;
  decisionId?: string | null;
  decisionStatus?: string | null;
  workflowHistory?: unknown[];
  notificationsSent?: unknown[];
  createdAt?: Date | null;
  updatedAt?: Date | null;
  [key: string]: unknown;
}

// ── Entity Behavior ────────────────────────────────────────────────

/**
 * Extract the parsed budget from a DemandReport.
 */
export function demandBudget(report: DemandReport): number {
  const raw = report.budgetRange || report.estimatedBudget || "";
  return parseBudgetAmount(String(raw));
}

/**
 * Get the effective urgency of a demand, defaulting to "medium".
 */
export function demandUrgency(report: DemandReport): Urgency {
  const u = report.urgency?.toLowerCase();
  if (u === "low" || u === "medium" || u === "high" || u === "critical") return u;
  return "medium";
}

/**
 * Check if a demand is in a reviewable state (can be advanced by reviewers).
 */
export function isReviewable(report: DemandReport): boolean {
  const reviewableStatuses = ["under_review", "initially_approved", "pending_conversion"];
  return reviewableStatuses.includes(report.workflowStatus ?? "");
}

/**
 * Check if a demand is editable (only drafts and generated reports).
 */
export function isEditable(report: DemandReport): boolean {
  const editableStatuses = ["draft", "generated"];
  return editableStatuses.includes(report.workflowStatus ?? report.status);
}

export interface DemandConversionRequest {
  id: string;
  demandId: string;
  status: string;
  requestedBy?: string | null;
  reviewedBy?: string | null;
  projectId?: string | null;
  notes?: string | null;
  createdAt?: Date | null;
}

export interface DemandReportStats {
  total: number;
  draft: number;
  submitted: number;
  underReview: number;
  approved: number;
  rejected: number;
}

export interface DemandReportListResult {
  data: DemandReport[];
  totalCount: number;
}

export interface DemandReportUser {
  id: string;
  email?: string | null;
  displayName?: string | null;
  [key: string]: unknown;
}

export interface DemandReportVersionSnapshot {
  id: string;
  versionNumber?: string | null;
  status?: string | null;
  versionData?: Record<string, unknown> | null;
  createdByName?: string | null;
  createdAt?: Date | null;
  publishedAt?: Date | null;
  publishedByName?: string | null;
  [key: string]: unknown;
}

export interface ConversionStats {
  total: number;
  pending: number;
  underReview: number;
  approved: number;
  rejected: number;
}

// ── Commands / DTOs ────────────────────────────────────────────────

export interface CreateDemandReportData {
  title?: string;
  businessObjective?: string;
  department?: string;
  urgency?: string;
  createdBy?: string;
  [key: string]: unknown;
}

export interface UpdateDemandReportData {
  title?: string;
  status?: string;
  workflowStatus?: string;
  businessObjective?: string;
  workflowHistory?: unknown[] | null;
  notificationsSent?: unknown[] | null;
  aiAnalysis?: Record<string, unknown> | string | null;
  updatedAt?: Date | null;
  acknowledgedAt?: Date | null;
  meetingScheduledAt?: Date | null;
  reviewStartedAt?: Date | null;
  approvedAt?: Date | null;
  managerApprovedAt?: Date | null;
  completedAt?: Date | null;
  rejectedAt?: Date | null;
  deferredAt?: Date | null;
  submittedAt?: Date | null;
  decisionReason?: string | null;
  rejectionCategory?: string | null;
  deferredUntil?: Date | null;
  approvedBy?: string | null;
  meetingDate?: Date | null;
  meetingScheduled?: boolean | null;
  meetingNotes?: string | null;
  managerEmail?: string | null;
  [key: string]: unknown;
}

export interface CreateConversionData {
  demandId: string;
  requestedBy: string;
  notes?: string;
}

/** Full conversion-request creation payload used by the PMO submission flow. */
export interface SubmitConversionData {
  demandId: string;
  decisionSpineId?: string;
  projectName: string;
  projectDescription?: string | null;
  priority?: string;
  proposedBudget?: string;
  proposedStartDate?: string;
  proposedEndDate?: string;
  requestedBy?: string;
  requestedByName?: string | null;
  status?: string;
  conversionData?: Record<string, unknown>;
}

export interface ReviewConversionData {
  reviewedBy: string;
  status: "approved" | "rejected";
  notes?: string;
}

export interface DemandGeneratedFields {
  enhancedBusinessObjective: string;
  suggestedProjectName: string;
  currentChallenges: string;
  expectedOutcomes: string[];
  successCriteria: string[];
  timeframe: string;
  stakeholders: string[];
  riskFactors: string[];
  constraints: string[];
  integrationRequirements: string[];
  complianceRequirements: string[];
  existingSystems: string[];
  assumptions: string[];
  [key: string]: unknown;
}

export interface DemandClassification {
  requestType: string;
  confidence: number;
  reasoning: string;
  [key: string]: unknown;
}

export type ComprehensiveDemandAnalysis = Record<string, unknown>;

/** Lightweight port for creating a portfolio project during conversion approval. */
export interface PortfolioProjectCreator {
  createProject(data: Record<string, unknown>): Promise<{ id: string; [key: string]: unknown }>;
}

/** Lightweight port for sending notifications. */
export interface NotificationSender {
  notifyApprovers(excludeUserId: string | undefined, payload: {
    type: string;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
}

// ── Ports (interfaces that infrastructure implements) ───────────────

export interface DemandReportRepository {
  findById(id: string): Promise<DemandReport | undefined>;
  findAll(): Promise<DemandReport[]>;
  findByStatus(status: string): Promise<DemandReport[]>;
  findByWorkflowStatus(status: string): Promise<DemandReport[]>;
  getStats(): Promise<DemandReportStats>;
  create(data: CreateDemandReportData): Promise<DemandReport>;
  update(id: string, data: UpdateDemandReportData): Promise<DemandReport | undefined>;
  delete(id: string): Promise<boolean>;
  /** Paginated listing with optional filters. */
  list(opts: Record<string, unknown>): Promise<DemandReportListResult>;
  /** Get all demand reports. */
  getAll(): Promise<DemandReport[]>;
  /** Filter by workflow status. */
  findByWorkflowStatusAlt(status: string): Promise<DemandReport[]>;
  /** Filter by status (legacy). */
  findByStatusAlt(status: string): Promise<DemandReport[]>;
  /** Get requirements version statuses for multiple reports. */
  getRequirementsStatuses(ids: string[]): Promise<Record<string, string>>;
  /** Get enterprise architecture version statuses for multiple reports. */
  getEnterpriseArchitectureStatuses(ids: string[]): Promise<Record<string, string>>;
  /** Get a user by ID (cross-cutting). */
  getUser(id: string): Promise<DemandReportUser | undefined>;
  /** Get users by role (cross-cutting). */
  getUsersByRole(role: string): Promise<DemandReportUser[]>;
  /** Get latest report version by type. */
  getLatestReportVersionByType(reportId: string, type: string): Promise<DemandReportVersionSnapshot | undefined>;
}

export interface ConversionRequestRepository {
  findById(id: string): Promise<DemandConversionRequest | undefined>;
  findByDemandId(demandId: string): Promise<DemandConversionRequest | undefined>;
  findAll(): Promise<DemandConversionRequest[]>;
  findByStatus(status: string): Promise<DemandConversionRequest[]>;
  create(data: CreateConversionData): Promise<DemandConversionRequest>;
  createFull(data: SubmitConversionData): Promise<DemandConversionRequest>;
  update(id: string, data: Partial<DemandConversionRequest>): Promise<DemandConversionRequest | undefined>;
}

export interface DemandAnalysisEngine {
  generateFields(objective: string, context?: Record<string, unknown>): Promise<DemandGeneratedFields>;
  enhanceObjective(objective: string): Promise<string>;
  classifyRequest(objective: string, context?: Record<string, unknown>): Promise<DemandClassification>;
  runComprehensiveAnalysis(data: Record<string, unknown>): Promise<ComprehensiveDemandAnalysis>;
}

// ── Domain Policies ────────────────────────────────────────────────

const APPROVED_STATUSES = ['initially_approved', 'manager_approved', 'pending_conversion', 'approved'];

export function canSubmitForConversion(report: DemandReport): boolean {
  return APPROVED_STATUSES.includes(report.workflowStatus || '') || report.status === "approved";
}

export function canDeleteReport(report: DemandReport, userId: string, userRole: string): boolean {
  if (userRole === "super_admin" || userRole === "director") return true;
  if (report.createdBy === userId && report.status === "draft") return true;
  return false;
}

export function computeConversionStats(requests: DemandConversionRequest[]): ConversionStats {
  return {
    total: requests.length,
    pending: requests.filter(r => r.status === "pending").length,
    underReview: requests.filter(r => r.status === "under_review").length,
    approved: requests.filter(r => r.status === "approved").length,
    rejected: requests.filter(r => r.status === "rejected").length,
  };
}

/**
 * Check if a demand report can be resubmitted after being deferred.
 */
export function canResubmitDeferred(report: DemandReport): boolean {
  if (report.workflowStatus !== "deferred") return false;
  if (!report.deferredUntil) return true; // no date restriction
  return new Date() >= report.deferredUntil;
}

/**
 * Validate that a workflow update has the required fields for the target status.
 */
export function validateWorkflowTransition(
  from: string,
  to: string,
  input: { decisionReason?: string | null; rejectionCategory?: string | null; deferredUntil?: string | null },
): { valid: boolean; error?: string } {
  if (!isValidTransition(from, to)) {
    return { valid: false, error: `Cannot transition from "${from}" to "${to}"` };
  }
  if (to === "rejected" && !input.decisionReason) {
    return { valid: false, error: "Rejection requires a decision reason" };
  }
  if (to === "deferred" && !input.deferredUntil) {
    return { valid: false, error: "Deferral requires a deferred-until date" };
  }
  return { valid: true };
}
