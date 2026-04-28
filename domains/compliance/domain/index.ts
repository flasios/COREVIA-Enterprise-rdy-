/**
 * Compliance Module — Domain Entities, Value Objects & Policies
 *
 * Pure business rules — no DB, HTTP, or I/O imports.
 */

import type { Percentage } from "@shared/primitives/valueObjects";

// ── Value Objects ──────────────────────────────────────────────────

export type ControlStatus = "met" | "partially_met" | "not_met" | "not_applicable";

export type ComplianceFramework =
  | "iso27001"
  | "nist"
  | "uae_ia"
  | "gdpr"
  | "sox"
  | "custom";

export type AuditFinding = "observation" | "minor" | "major" | "critical";

export type RuleSeverity = "info" | "warning" | "error" | "critical";

export type RuleCategory =
  | "data_protection"
  | "access_control"
  | "audit_trail"
  | "encryption"
  | "incident_response"
  | "business_continuity"
  | "governance"
  | "risk_management";

export type RemediationPriority = "low" | "medium" | "high" | "urgent";

// Re-export shared VOs for convenience
export type { Percentage };

export interface ComplianceControl {
  id: string;
  framework: ComplianceFramework;
  controlId: string;
  title: string;
  description: string;
  status: ControlStatus;
  evidenceRequired: boolean;
  evidenceProvided: boolean;
  lastAssessed?: Date;
}

export interface ComplianceScorecard {
  framework: ComplianceFramework;
  totalControls: number;
  met: number;
  partiallyMet: number;
  notMet: number;
  notApplicable: number;
  score: number; // 0-100
}

// ── Domain Policies ────────────────────────────────────────────────

/**
 * Calculate compliance score as percentage of met + partially met controls.
 * Partially met controls count as 0.5.
 */
export function computeComplianceScore(controls: ComplianceControl[]): number {
  const applicable = controls.filter((c) => c.status !== "not_applicable");
  if (applicable.length === 0) return 100;
  const score = applicable.reduce((acc, c) => {
    if (c.status === "met") return acc + 1;
    if (c.status === "partially_met") return acc + 0.5;
    return acc;
  }, 0);
  return Math.round((score / applicable.length) * 100);
}

/**
 * Build a scorecard from a list of controls for a given framework.
 */
export function buildScorecard(
  framework: ComplianceFramework,
  controls: ComplianceControl[]
): ComplianceScorecard {
  const frameworkControls = controls.filter((c) => c.framework === framework);
  return {
    framework,
    totalControls: frameworkControls.length,
    met: frameworkControls.filter((c) => c.status === "met").length,
    partiallyMet: frameworkControls.filter((c) => c.status === "partially_met").length,
    notMet: frameworkControls.filter((c) => c.status === "not_met").length,
    notApplicable: frameworkControls.filter((c) => c.status === "not_applicable").length,
    score: computeComplianceScore(frameworkControls),
  };
}

/**
 * Determine if a control requires remediation.
 * Controls that are not met AND require evidence are remediation targets.
 */
export function requiresRemediation(control: ComplianceControl): boolean {
  return control.status === "not_met" && control.evidenceRequired;
}

/**
 * Check if the system is ready for audit based on compliance scores.
 * Threshold: 85% across all frameworks.
 */
export function isAuditReady(scorecards: ComplianceScorecard[]): boolean {
  if (scorecards.length === 0) return false;
  return scorecards.every((s) => s.score >= 85);
}

/**
 * Map an audit finding severity to a remediation SLA (days).
 */
export function remediationSla(finding: AuditFinding): number {
  const slaMap: Record<AuditFinding, number> = {
    observation: 90,
    minor: 60,
    major: 30,
    critical: 7,
  };
  return slaMap[finding];
}

/**
 * Determine remediation priority based on finding severity and framework criticality.
 */
export function remediationPriority(
  finding: AuditFinding,
  framework: ComplianceFramework,
): RemediationPriority {
  // UAE IA and SOX findings get elevated priority
  const isHighRegulatory = framework === "uae_ia" || framework === "sox";

  if (finding === "critical") return "urgent";
  if (finding === "major") return isHighRegulatory ? "urgent" : "high";
  if (finding === "minor") return isHighRegulatory ? "high" : "medium";
  return "low";
}

/**
 * Check if a compliance run passes the minimum threshold for a specific framework.
 * UAE IA requires 90%, others require 85%.
 */
export function meetsFrameworkThreshold(
  framework: ComplianceFramework,
  score: number,
): boolean {
  const thresholds: Record<ComplianceFramework, number> = {
    uae_ia: 90,
    sox: 90,
    iso27001: 85,
    nist: 85,
    gdpr: 85,
    custom: 80,
  };
  return score >= (thresholds[framework] ?? 85);
}

/**
 * Calculate a risk-adjusted compliance score that weights critical controls higher.
 */
export function riskAdjustedScore(controls: ComplianceControl[]): number {
  const applicable = controls.filter((c) => c.status !== "not_applicable");
  if (applicable.length === 0) return 100;

  // Controls requiring evidence are weighted 1.5x
  let weightedScore = 0;
  let totalWeight = 0;

  for (const c of applicable) {
    const weight = c.evidenceRequired ? 1.5 : 1.0;
    totalWeight += weight;
    if (c.status === "met") weightedScore += weight;
    else if (c.status === "partially_met") weightedScore += weight * 0.5;
  }

  return totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 0;
}
