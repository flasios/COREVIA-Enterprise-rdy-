/**
 * Intelligence Module — Domain Entities, Value Objects & Policies
 *
 * Pure business rules for the COREVIA Brain decision pipeline.
 * No DB, HTTP, or I/O imports.
 */

// ── Value Objects ──────────────────────────────────────────────────

export type DecisionSpineStatus =
  | "created"
  | "processing"
  | "validation"
  | "pending_approval"
  | "approved"
  | "executed"
  | "blocked"
  | "needs_info"
  | "rejected";

export type DataClassification = "public" | "internal" | "confidential" | "sovereign";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type PipelineLayer = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type ConfidenceLevel = "very_low" | "low" | "medium" | "high" | "very_high";

export const LAYER_NAMES: Record<PipelineLayer, string> = {
  1: "Intake & Normalization",
  2: "Classification & Risk",
  3: "Policy Evaluation",
  4: "Knowledge Retrieval",
  5: "Intelligence Reasoning",
  6: "Decision Synthesis",
  7: "Action Execution",
  8: "Learning & Memory",
};

/** Use-case types that represent core governance decisions (not auxiliary). */
export const GOVERNANCE_USE_CASES = new Set([
  "demand_management",
  "demand_request",
  "demand_intake",
  "demand_analysis",
  "business_case",
  "requirements_analysis",
  "strategic_fit",
  "assessment",
  "wbs_generation",
  "wbs",
  "closure_report",
  "lessons_learned",
  "final_assessment",
]);

/** Use-case types excluded from decision listings. */
export const EXCLUDED_USE_CASES = new Set(["rag", "reasoning", "language"]);

// ── Domain Policies ────────────────────────────────────────────────

/**
 * Determine if a decision requires manual approval before execution.
 * Sovereign/confidential + high/critical risk always need approval.
 */
export function requiresManualApproval(
  classification: DataClassification,
  riskLevel: RiskLevel
): boolean {
  if (classification === "sovereign") return true;
  if (classification === "confidential" && (riskLevel === "high" || riskLevel === "critical")) return true;
  if (riskLevel === "critical") return true;
  return false;
}

/**
 * Determine escalation level based on classification + risk.
 */
export function escalationLevel(
  classification: DataClassification,
  riskLevel: RiskLevel
): "none" | "manager" | "director" | "ciso" {
  if (classification === "sovereign" || riskLevel === "critical") return "ciso";
  if (classification === "confidential" && riskLevel === "high") return "director";
  if (riskLevel === "high") return "manager";
  return "none";
}

/**
 * Can a user approve a decision at the given classification/risk level?
 */
export function canApproveDecision(
  userRole: string,
  classification: DataClassification,
  riskLevel: RiskLevel
): boolean {
  const level = escalationLevel(classification, riskLevel);
  const roleHierarchy: Record<string, number> = {
    viewer: 0,
    member: 1,
    project_manager: 2,
    director: 3,
    pmo: 4,
    system_admin: 5,
    super_admin: 5,
  };
  const requiredLevel: Record<string, number> = {
    none: 2,
    manager: 3,
    director: 3,
    ciso: 5,
  };
  return (roleHierarchy[userRole] ?? 0) >= (requiredLevel[level] ?? 5);
}

/**
 * Check whether a spine has completed all 8 pipeline layers.
 */
export function isFullyProcessed(currentLayer: number | null | undefined): boolean {
  return typeof currentLayer === "number" && currentLayer >= 8;
}

/**
 * Determine if a decision is in a terminal state (no further processing).
 */
export function isTerminal(status: DecisionSpineStatus): boolean {
  return ["approved", "executed", "blocked", "rejected"].includes(status);
}

/**
 * Check if a use-case type represents a core governance workflow.
 */
export function isGovernanceUseCase(useCaseType: string): boolean {
  return GOVERNANCE_USE_CASES.has(useCaseType);
}

// ── Pipeline State Machine ─────────────────────────────────────────

/**
 * Valid status transitions for the decision spine.
 */
const SPINE_TRANSITIONS: Record<DecisionSpineStatus, readonly DecisionSpineStatus[]> = {
  created:            ["processing", "blocked", "rejected"],
  processing:         ["validation", "blocked", "needs_info"],
  validation:         ["pending_approval", "processing", "blocked", "rejected"],
  pending_approval:   ["approved", "rejected", "needs_info"],
  approved:           ["executed"],
  executed:           [],
  blocked:            ["processing", "rejected"],
  needs_info:         ["processing", "rejected"],
  rejected:           [],
} as const;

/**
 * Check if a spine status transition is valid.
 */
export function isValidSpineTransition(from: DecisionSpineStatus, to: DecisionSpineStatus): boolean {
  return SPINE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Compute confidence level from a numeric score (0-1).
 */
export function toConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.9) return "very_high";
  if (score >= 0.7) return "high";
  if (score >= 0.5) return "medium";
  if (score >= 0.3) return "low";
  return "very_low";
}

/**
 * Check if a brain intake request can be auto-approved (no human loop).
 * Public data + low risk + non-governance = auto-approve.
 */
export function canAutoApprove(
  classification: DataClassification,
  riskLevel: RiskLevel,
  useCaseType: string,
): boolean {
  if (requiresManualApproval(classification, riskLevel)) return false;
  if (isGovernanceUseCase(useCaseType)) return false;
  return classification === "public" && riskLevel === "low";
}

/**
 * Determine the minimum pipeline layers required for a given use-case type.
 * Governance decisions need all 8; simple queries need only 4.
 */
export function minimumLayersRequired(useCaseType: string): PipelineLayer {
  if (isGovernanceUseCase(useCaseType)) return 8;
  if (EXCLUDED_USE_CASES.has(useCaseType)) return 4;
  return 6;
}
