/**
 * Shared Enums — Domain-wide enumeration constants.
 *
 * Single source of truth for status values, classifications, priorities, etc.
 * Used by both client and server to avoid magic strings.
 */

// ── Classification & Security ──────────────────────────────────────

export const DataClassification = {
  PUBLIC: "public",
  INTERNAL: "internal",
  CONFIDENTIAL: "confidential",
  SOVEREIGN: "sovereign",
} as const;
export type DataClassification = (typeof DataClassification)[keyof typeof DataClassification];

export const RiskLevel = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

// ── Demand Lifecycle ───────────────────────────────────────────────

export const DemandStatus = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  ARCHIVED: "archived",
} as const;
export type DemandStatus = (typeof DemandStatus)[keyof typeof DemandStatus];

export const WorkflowStatus = {
  INTAKE: "intake",
  ANALYSIS: "analysis",
  REVIEW: "review",
  APPROVED: "approved",
  REJECTED: "rejected",
  CONVERTED: "converted",
  ARCHIVED: "archived",
} as const;
export type WorkflowStatus = (typeof WorkflowStatus)[keyof typeof WorkflowStatus];

export const Urgency = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;
export type Urgency = (typeof Urgency)[keyof typeof Urgency];

// ── Portfolio & Project ────────────────────────────────────────────

export const ProjectPhase = {
  INITIATION: "initiation",
  PLANNING: "planning",
  EXECUTION: "execution",
  MONITORING: "monitoring",
  CLOSURE: "closure",
} as const;
export type ProjectPhase = (typeof ProjectPhase)[keyof typeof ProjectPhase];

export const ProjectType = {
  TRANSFORMATION: "transformation",
  ENHANCEMENT: "enhancement",
  MAINTENANCE: "maintenance",
  INNOVATION: "innovation",
} as const;
export type ProjectType = (typeof ProjectType)[keyof typeof ProjectType];

export const HealthStatus = {
  ON_TRACK: "on-track",
  AT_RISK: "at-risk",
  OFF_TRACK: "off-track",
  COMPLETED: "completed",
} as const;
export type HealthStatus = (typeof HealthStatus)[keyof typeof HealthStatus];

// ── Decision / Brain Pipeline ──────────────────────────────────────

export const DecisionPipelineStatus = {
  INTAKE: "intake",
  CLASSIFICATION: "classification",
  POLICY_CHECK: "policy_check",
  CONTEXT_CHECK: "context_check",
  ORCHESTRATION: "orchestration",
  REASONING: "reasoning",
  VALIDATION: "validation",
  ACTION_EXECUTION: "action_execution",
  MEMORY: "memory",
  COMPLETED: "completed",
  BLOCKED: "blocked",
  NEEDS_INFO: "needs_info",
  REJECTED: "rejected",
} as const;
export type DecisionPipelineStatus = (typeof DecisionPipelineStatus)[keyof typeof DecisionPipelineStatus];

// ── Approval ───────────────────────────────────────────────────────

export const ApprovalAction = {
  APPROVE: "approve",
  REVISE: "revise",
  REJECT: "reject",
} as const;
export type ApprovalAction = (typeof ApprovalAction)[keyof typeof ApprovalAction];

// ── Notification ───────────────────────────────────────────────────

export const NotificationType = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  SUCCESS: "success",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

// ── User Roles ─────────────────────────────────────────────────────

export const UserRole = {
  SUPER_ADMIN: "super_admin",
  SYSTEM_ADMIN: "system_admin",
  DIRECTOR: "director",
  PMO_HEAD: "pmo_head",
  PROJECT_MANAGER: "project_manager",
  TEAM_MEMBER: "team_member",
  VIEWER: "viewer",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
