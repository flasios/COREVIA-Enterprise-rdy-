/**
 * Governance Module — Domain Entities, Value Objects & Policies
 *
 * Pure business rules for gate checks, policy packs, and governance workflows.
 * No DB, HTTP, or I/O imports.
 */

// ── Value Objects ──────────────────────────────────────────────────

export type GateStatus = "pending" | "in_progress" | "passed" | "failed" | "waived" | "deferred";

export type PolicyPackStatus = "draft" | "active" | "deprecated" | "archived";

export type GovernanceDecision = "approve" | "reject" | "defer" | "escalate";

export type SlaStatus = "on_track" | "at_risk" | "breached";

export type EscalationLevel = "none" | "manager" | "director" | "executive";

export interface GateCheckResult {
  checkId: string;
  checkName: string;
  passed: boolean;
  mandatory: boolean;
  evidence?: string;
  notes?: string;
}

// ── SLA Policies ───────────────────────────────────────────────────

/** Default SLA durations by governance phase (in business days). */
export const GOVERNANCE_SLA_DAYS: Record<string, number> = {
  initial_review: 5,
  technical_evaluation: 10,
  financial_review: 7,
  director_approval: 3,
  executive_approval: 5,
  procurement: 15,
};

/**
 * Determine SLA status for a governance phase.
 */
export function computeSlaStatus(
  phaseStartDate: Date,
  phaseName: string,
  now: Date = new Date(),
): SlaStatus {
  const slaDays = GOVERNANCE_SLA_DAYS[phaseName] ?? 10;
  const elapsed = Math.ceil((now.getTime() - phaseStartDate.getTime()) / (1000 * 60 * 60 * 24));

  if (elapsed > slaDays) return "breached";
  if (elapsed > slaDays * 0.8) return "at_risk";
  return "on_track";
}

/**
 * Determine escalation level based on SLA breach severity.
 */
export function determineEscalation(
  slaStatus: SlaStatus,
  daysOverdue: number,
): EscalationLevel {
  if (slaStatus === "on_track") return "none";
  if (daysOverdue <= 2) return "manager";
  if (daysOverdue <= 5) return "director";
  return "executive";
}

// ── Domain Policies ────────────────────────────────────────────────

/**
 * Determine overall gate pass/fail status from individual check results.
 * All mandatory checks must pass. Non-mandatory failures generate warnings.
 */
export function evaluateGateChecks(checks: GateCheckResult[]): {
  passed: boolean;
  mandatoryFailed: GateCheckResult[];
  warnings: GateCheckResult[];
} {
  const mandatoryFailed = checks.filter((c) => c.mandatory && !c.passed);
  const warnings = checks.filter((c) => !c.mandatory && !c.passed);
  return {
    passed: mandatoryFailed.length === 0,
    mandatoryFailed,
    warnings,
  };
}

/**
 * Can a policy pack be activated?
 * Must be in draft status and have at least one rule defined.
 */
export function canActivatePolicyPack(pack: {
  status: PolicyPackStatus;
  rulesCount: number;
}): boolean {
  return pack.status === "draft" && pack.rulesCount > 0;
}

/**
 * Determine if an artifact requires governance sign-off before proceeding.
 * Business cases and WBS deliverables always require sign-off.
 */
export function requiresGovernanceSignoff(artifactType: string): boolean {
  const signoffRequired = new Set([
    "business_case",
    "wbs_deliverable",
    "change_request",
    "risk_response_plan",
    "procurement_contract",
  ]);
  return signoffRequired.has(artifactType);
}

/**
 * Calculate governance maturity score (0-5 scale, CMMI-inspired).
 * Based on the percentage of gates passed and policy compliance.
 */
export function computeGovernanceMaturity(
  gatesPassed: number,
  totalGates: number,
  policyCompliance: number // 0-100
): number {
  if (totalGates === 0) return 1;
  const gateScore = (gatesPassed / totalGates) * 2.5;
  const policyScore = (policyCompliance / 100) * 2.5;
  return Math.round((gateScore + policyScore) * 10) / 10;
}

/**
 * Score a vendor proposal (0-100) based on weighted criteria.
 * Standard UAE government procurement scoring model.
 */
export function scoreVendorProposal(criteria: {
  technicalScore: number;   // 0-100
  financialScore: number;   // 0-100
  experienceScore: number;  // 0-100
  complianceScore: number;  // 0-100
}, weights: {
  technical: number;   // default 0.40
  financial: number;   // default 0.30
  experience: number;  // default 0.20
  compliance: number;  // default 0.10
} = { technical: 0.40, financial: 0.30, experience: 0.20, compliance: 0.10 }): number {
  return Math.round(
    criteria.technicalScore * weights.technical +
    criteria.financialScore * weights.financial +
    criteria.experienceScore * weights.experience +
    criteria.complianceScore * weights.compliance,
  );
}

/**
 * Determine if a policy pack can be safely deprecated.
 * Must have a replacement pack active and no in-progress gate checks using it.
 */
export function canDeprecatePolicyPack(pack: {
  status: PolicyPackStatus;
  hasReplacementActive: boolean;
  activeGateChecks: number;
}): boolean {
  return pack.status === "active" && pack.hasReplacementActive && pack.activeGateChecks === 0;
}
