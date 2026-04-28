/**
 * Portfolio Module — Domain Entities, Value Objects & Policies
 *
 * Pure business rules — no DB, HTTP, or I/O imports.
 * Allowed imports: shared/primitives, shared/contracts, shared/schema types.
 */

import type { Money, Percentage } from "@shared/primitives/valueObjects";

// ── Value Objects ──────────────────────────────────────────────────

export type ProjectPhase =
  | "initiation"
  | "planning"
  | "execution"
  | "monitoring"
  | "closure";

export type ProjectHealthStatus =
  | "on_track"
  | "at_risk"
  | "critical"
  | "completed"
  | "not_started";

export type GateDecision = "go" | "no_go" | "conditional" | "pending";

export type BudgetVarianceLevel = "within_tolerance" | "warning" | "critical";

export type ChangeRequestType = "scope" | "schedule" | "budget" | "resource" | "risk";

export type ChangeRequestStatus = "draft" | "submitted" | "approved" | "rejected" | "implemented";

export type RiskCategory = "technical" | "schedule" | "budget" | "resource" | "external" | "regulatory";

// ── Phase Lifecycle ────────────────────────────────────────────────

const PHASE_ORDER: readonly ProjectPhase[] = [
  "initiation",
  "planning",
  "execution",
  "monitoring",
  "closure",
] as const;

/**
 * Determine the next phase in the project lifecycle.
 */
export function nextPhase(current: ProjectPhase): ProjectPhase | null {
  const idx = PHASE_ORDER.indexOf(current);
  return idx >= 0 && idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1]! : null;
}

/**
 * Get the phase index (0-based) for ordering/comparison.
 */
export function phaseIndex(phase: ProjectPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

/**
 * Check if phase A comes before phase B.
 */
export function isPhaseBeforeOrEqual(a: ProjectPhase, b: ProjectPhase): boolean {
  return phaseIndex(a) <= phaseIndex(b);
}

// ── WBS Baseline ───────────────────────────────────────────────────

/**
 * Check if a WBS baseline can be locked (must be in planning or later).
 */
export function canLockBaseline(phase: ProjectPhase, hasWbs: boolean): boolean {
  return hasWbs && phaseIndex(phase) >= phaseIndex("planning");
}

/**
 * Check if changes to a baselined WBS require a change request.
 */
export function baselineChangeRequiresApproval(
  isBaselineLocked: boolean,
  changeType: ChangeRequestType,
): boolean {
  if (!isBaselineLocked) return false;
  // Scope and budget changes on a locked baseline always require approval
  return changeType === "scope" || changeType === "budget";
}

// Re-export shared VOs for convenience
export type { Money, Percentage };

// ── Domain Policies ────────────────────────────────────────────────

/**
 * Determine project health based on schedule and budget variance.
 * PMI-standard thresholds: ±5% = on track, ±15% = at risk, beyond = critical.
 */
export function computeProjectHealth(
  scheduleVariance: number,
  budgetVariance: number
): ProjectHealthStatus {
  const maxVariance = Math.max(
    Math.abs(scheduleVariance),
    Math.abs(budgetVariance)
  );
  if (maxVariance <= 0.05) return "on_track";
  if (maxVariance <= 0.15) return "at_risk";
  return "critical";
}

/**
 * Check whether a gate can advance to the next phase.
 * All mandatory checks must pass and the gate owner must have approved.
 */
export function canAdvanceGate(gate: {
  mandatoryChecksPassed: boolean;
  ownerApproved: boolean;
  decision?: GateDecision;
}): boolean {
  return (
    gate.mandatoryChecksPassed &&
    gate.ownerApproved &&
    (gate.decision === "go" || gate.decision === "conditional")
  );
}

/**
 * Determine budget variance severity.
 * Within 5% = tolerance, 5-15% = warning, >15% = critical.
 */
export function assessBudgetVariance(
  approved: number,
  actual: number
): BudgetVarianceLevel {
  if (approved <= 0) return "within_tolerance";
  const pct = Math.abs(actual - approved) / approved;
  if (pct <= 0.05) return "within_tolerance";
  if (pct <= 0.15) return "warning";
  return "critical";
}

/**
 * Calculate Earned Value metrics (PMI formula).
 */
export function computeEarnedValue(
  bac: number,
  percentComplete: number,
  actualCost: number,
  plannedValue: number
): {
  earnedValue: number;
  costVariance: number;
  scheduleVariance: number;
  cpi: number;
  spi: number;
  eac: number;
  tcpi: number;
} {
  const earnedValue = bac * (percentComplete / 100);
  const costVariance = earnedValue - actualCost;
  const scheduleVariance = earnedValue - plannedValue;
  const cpi = actualCost > 0 ? earnedValue / actualCost : 1;
  const spi = plannedValue > 0 ? earnedValue / plannedValue : 1;
  const eac = cpi > 0 ? bac / cpi : bac;
  const tcpi = (bac - earnedValue) > 0 && (bac - actualCost) > 0
    ? (bac - earnedValue) / (bac - actualCost)
    : 1;

  return { earnedValue, costVariance, scheduleVariance, cpi, spi, eac, tcpi };
}

/**
 * Check if a user can approve a project gate (role-based).
 */
export function canApproveGate(
  userRole: string,
  gatePhase: ProjectPhase
): boolean {
  const roleHierarchy: Record<string, number> = {
    viewer: 0,
    member: 1,
    project_manager: 2,
    director: 3,
    pmo: 4,
    super_admin: 5,
    system_admin: 5,
  };
  const minRoleByPhase: Record<ProjectPhase, number> = {
    initiation: 2,  // PM+
    planning: 2,    // PM+
    execution: 3,   // Director+
    monitoring: 3,  // Director+
    closure: 4,     // PMO+
  };
  return (roleHierarchy[userRole] ?? 0) >= (minRoleByPhase[gatePhase] ?? 5);
}

/**
 * Risk score calculation (probability × impact, 1-25 scale).
 */
export function computeRiskScore(
  probability: number,
  impact: number
): { score: number; level: "low" | "medium" | "high" | "critical" } {
  const score = Math.min(25, Math.max(1, probability * impact));
  const level =
    score <= 5 ? "low" : score <= 10 ? "medium" : score <= 15 ? "high" : "critical";
  return { score, level };
}

/**
 * Check if a change request can be approved given the current project phase.
 * Budget changes require director+ during execution.
 */
export function canApproveChangeRequest(
  changeType: ChangeRequestType,
  phase: ProjectPhase,
  userRole: string,
): boolean {
  const roleHierarchy: Record<string, number> = {
    viewer: 0, member: 1, project_manager: 2, director: 3, pmo: 4, super_admin: 5, system_admin: 5,
  };
  const userLevel = roleHierarchy[userRole] ?? 0;

  // Budget or scope changes during execution/monitoring need director+
  if ((changeType === "budget" || changeType === "scope") && phaseIndex(phase) >= phaseIndex("execution")) {
    return userLevel >= 3;
  }
  // All other changes need PM+
  return userLevel >= 2;
}

/**
 * Determine if a project should trigger portfolio rebalancing alert.
 * CPI < 0.8 or SPI < 0.8 on any project signals portfolio-level concern.
 */
export function needsPortfolioRebalancing(cpi: number, spi: number): boolean {
  return cpi < 0.8 || spi < 0.8;
}
