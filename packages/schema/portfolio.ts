/** @module portfolio — Schema owner. Only this module may write to these tables. */
/**
 * Schema domain: portfolio
 * Auto-extracted from shared/schema.ts
 */
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, json, jsonb, timestamp, boolean, index, unique, numeric, date, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
// Cross-domain refs: demandReports.id (logical only, no FK constraints)
import { users } from "./platform";

// ============================================================================
// INTELLIGENT PORTFOLIO GATEWAY - Full Project Lifecycle Management
// Manages demand-to-project conversion and complete project lifecycle tracking
// ============================================================================

// Project Phase Enum for consistent lifecycle stages
export const PROJECT_PHASES = [
  'intake',           // Demand received, initial processing
  'triage',           // Categorization and priority assignment
  'governance',       // Multi-level approval workflow
  'analysis',         // Financial and strategic analysis
  'approved',         // Final approval granted
  'planning',         // Project planning and resource allocation
  'execution',        // Active development/implementation
  'monitoring',       // Progress monitoring and quality assurance
  'closure',          // Project wrap-up and handover
  'completed',        // Successfully completed
  'on_hold',          // Temporarily paused
  'cancelled'         // Terminated/cancelled
] as const;

export type ProjectPhase = typeof PROJECT_PHASES[number];

// Workspace Path - determines which project management approach to use
export const WORKSPACE_PATHS = [
  'standard',         // Traditional 5-phase project lifecycle (Initiation, Planning, Execution, Monitoring, Closure)
  'accelerator'       // Streamlined fast-track approach for agile projects
] as const;

export type WorkspacePath = typeof WORKSPACE_PATHS[number];

// Portfolio Projects - Links approved demands to full project lifecycle
export const portfolioProjects = pgTable("portfolio_projects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Link to source demand
  demandReportId: uuid("demand_report_id").notNull(), // Logical ref → demandReports.id
  decisionSpineId: text("decision_spine_id"),

  // Project Identity
  projectCode: varchar("project_code", { length: 50 }).notNull().unique(), // e.g., PRJ-2024-001
  projectName: text("project_name").notNull(),
  projectDescription: text("project_description"),

  // Classification
  projectType: varchar("project_type", { length: 50 }).notNull(), // transformation, enhancement, maintenance, innovation
  priority: varchar("priority", { length: 20 }).notNull().default("medium"), // critical, high, medium, low
  strategicAlignment: integer("strategic_alignment"), // 0-100 alignment with UAE Vision 2071

  // Workspace Path - determines which project management approach is used
  workspacePath: varchar("workspace_path", { length: 30 }).notNull().default("standard"), // standard, accelerator

  // Current Status
  currentPhase: varchar("current_phase", { length: 30 }).notNull().default("intake").$type<ProjectPhase>(),
  phaseProgress: integer("phase_progress").default(0), // 0-100 progress within current phase
  overallProgress: integer("overall_progress").default(0), // 0-100 overall project progress
  healthStatus: varchar("health_status", { length: 20 }).default("on_track"), // on_track, at_risk, critical, blocked

  // Charter Signature Status
  charterStatus: varchar("charter_status", { length: 30 }).default("draft"), // draft, pending_signature, signed, locked

  // Financial Tracking
  approvedBudget: numeric("approved_budget", { precision: 15, scale: 2 }),
  actualSpend: numeric("actual_spend", { precision: 15, scale: 2 }).default("0"),
  forecastSpend: numeric("forecast_spend", { precision: 15, scale: 2 }),
  budgetVariance: numeric("budget_variance", { precision: 10, scale: 2 }), // Percentage variance
  currency: varchar("currency", { length: 10 }).default("AED"),

  // Resource Allocation
  assignedTeamId: varchar("assigned_team_id"),
  projectManagerId: uuid("project_manager_id").references(() => users.id),
  projectManager: text("project_manager"), // Display name for project manager
  sponsorId: uuid("sponsor_id").references(() => users.id),
  sponsor: text("sponsor"), // Display name for executive sponsor
  financialDirectorId: uuid("financial_director_id").references(() => users.id),
  financialDirector: text("financial_director"), // Display name for financial director
  allocatedFTE: numeric("allocated_fte", { precision: 5, scale: 2 }), // Full-time equivalent resources

  // Timeline
  plannedStartDate: date("planned_start_date"),
  actualStartDate: date("actual_start_date"),
  plannedEndDate: date("planned_end_date"),
  forecastEndDate: date("forecast_end_date"),
  actualEndDate: date("actual_end_date"),

  // Risk and Compliance
  riskScore: integer("risk_score"), // 0-100
  complianceScore: integer("compliance_score"), // 0-100 NESA compliance
  riskFactors: jsonb("risk_factors"), // Array of identified risks

  // AI Insights
  aiRecommendations: jsonb("ai_recommendations"), // AI-generated suggestions
  lastAiAnalysis: timestamp("last_ai_analysis"),

  // Metadata
  tags: text("tags").array(),
  metadata: jsonb("metadata"), // Flexible additional data

  // Audit Trail
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  demandReportIdx: index("portfolio_projects_demand_idx").on(table.demandReportId),
  decisionSpineIdIdx: index("portfolio_projects_decision_spine_idx").on(table.decisionSpineId),
  currentPhaseIdx: index("portfolio_projects_phase_idx").on(table.currentPhase),
  healthStatusIdx: index("portfolio_projects_health_idx").on(table.healthStatus),
  projectManagerIdx: index("portfolio_projects_pm_idx").on(table.projectManagerId),
  priorityPhaseIdx: index("portfolio_projects_priority_phase_idx").on(table.priority, table.currentPhase),
}));

// Project Phases - Track each phase transition with full audit
export const projectPhases = pgTable("project_phases", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectId: uuid("project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),
  phaseName: varchar("phase_name", { length: 30 }).notNull().$type<ProjectPhase>(),
  phaseOrder: integer("phase_order").notNull(), // Order in lifecycle

  // Phase Status
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, in_progress, completed, skipped
  progress: integer("progress").default(0), // 0-100

  // Timing
  plannedStartDate: date("planned_start_date"),
  actualStartDate: date("actual_start_date"),
  plannedEndDate: date("planned_end_date"),
  actualEndDate: date("actual_end_date"),

  // Phase Details
  entryConditions: jsonb("entry_conditions"), // Conditions that must be met to enter phase
  exitConditions: jsonb("exit_conditions"), // Conditions to complete phase
  deliverables: jsonb("deliverables"), // Required deliverables

  // Approvals
  approvalRequired: boolean("approval_required").default(false),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvalDate: timestamp("approval_date"),
  approvalNotes: text("approval_notes"),

  // Notes
  notes: text("notes"),
  blockers: jsonb("blockers"), // Any blocking issues

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectPhaseIdx: index("project_phases_project_idx").on(table.projectId),
  statusIdx: index("project_phases_status_idx").on(table.status),
  phaseNameIdx: index("project_phases_name_idx").on(table.phaseName),
}));

// Project Milestones - Key deliverables and checkpoints
export const projectMilestones = pgTable("project_milestones", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectId: uuid("project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),
  phaseId: uuid("phase_id").references(() => projectPhases.id, { onDelete: "set null" }),

  // Milestone Details
  title: text("title").notNull(),
  description: text("description"),
  milestoneType: varchar("milestone_type", { length: 30 }).notNull(), // deliverable, approval, review, payment, go_live

  // Status
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, in_progress, completed, delayed, blocked
  priority: varchar("priority", { length: 20 }).default("medium"),

  // Timing
  plannedDate: date("planned_date"),
  actualDate: date("actual_date"),
  daysVariance: integer("days_variance"), // Negative = early, Positive = late

  // Ownership
  assignedTo: uuid("assigned_to").references(() => users.id),

  // Completion
  completedBy: uuid("completed_by").references(() => users.id),
  completionNotes: text("completion_notes"),
  evidence: jsonb("evidence"), // Links to supporting documents

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectMilestoneIdx: index("project_milestones_project_idx").on(table.projectId),
  phaseIdx: index("project_milestones_phase_idx").on(table.phaseId),
  statusIdx: index("project_milestones_status_idx").on(table.status),
  plannedDateIdx: index("project_milestones_planned_idx").on(table.plannedDate),
}));

// Project KPIs - Performance metrics tracking
export const projectKpis = pgTable("project_kpis", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectId: uuid("project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),

  // KPI Definition
  kpiName: text("kpi_name").notNull(),
  kpiCategory: varchar("kpi_category", { length: 50 }).notNull(), // financial, schedule, quality, resource, risk
  unit: varchar("unit", { length: 30 }), // %, AED, days, count, etc.

  // Values
  targetValue: numeric("target_value", { precision: 15, scale: 4 }),
  currentValue: numeric("current_value", { precision: 15, scale: 4 }),
  previousValue: numeric("previous_value", { precision: 15, scale: 4 }),
  variance: numeric("variance", { precision: 10, scale: 4 }), // Percentage variance from target

  // Trend
  trend: varchar("trend", { length: 20 }), // improving, stable, declining
  trendHistory: jsonb("trend_history"), // Historical values for charting

  // Thresholds
  warningThreshold: numeric("warning_threshold", { precision: 15, scale: 4 }),
  criticalThreshold: numeric("critical_threshold", { precision: 15, scale: 4 }),
  healthStatus: varchar("health_status", { length: 20 }).default("on_track"), // on_track, warning, critical

  // Metadata
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  projectKpiIdx: index("project_kpis_project_idx").on(table.projectId),
  categoryIdx: index("project_kpis_category_idx").on(table.kpiCategory),
  healthIdx: index("project_kpis_health_idx").on(table.healthStatus),
}));

// Phase History - Audit trail for all phase transitions
export const phaseHistory = pgTable("phase_history", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectId: uuid("project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),

  // Transition Details
  fromPhase: varchar("from_phase", { length: 30 }).$type<ProjectPhase>(),
  toPhase: varchar("to_phase", { length: 30 }).notNull().$type<ProjectPhase>(),
  transitionType: varchar("transition_type", { length: 20 }).notNull(), // advance, revert, skip, hold

  // Reason and Notes
  reason: text("reason"),
  notes: text("notes"),

  // User Attribution
  transitionedBy: uuid("transitioned_by").notNull().references(() => users.id),
  transitionedByName: text("transitioned_by_name"),

  // Timestamp
  transitionedAt: timestamp("transitioned_at").notNull().defaultNow(),

  // Metadata for compliance
  metadata: jsonb("metadata"), // Additional context
  ipAddress: varchar("ip_address", { length: 45 }),
}, (table) => ({
  projectHistoryIdx: index("phase_history_project_idx").on(table.projectId),
  transitionedAtIdx: index("phase_history_transition_idx").on(table.transitionedAt),
  toPhaseIdx: index("phase_history_to_phase_idx").on(table.toPhase),
}));

// Zod Schemas for Portfolio Projects
export const insertPortfolioProjectSchema = createInsertSchema(portfolioProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  projectType: z.enum(['transformation', 'enhancement', 'maintenance', 'innovation']),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  currentPhase: z.enum(PROJECT_PHASES).default('intake'),
  healthStatus: z.enum(['on_track', 'at_risk', 'critical', 'blocked']).default('on_track'),
  workspacePath: z.enum(WORKSPACE_PATHS).default('standard'),
  decisionSpineId: z.string().optional().nullable(),
});

export const updatePortfolioProjectSchema = insertPortfolioProjectSchema.partial().omit({
  demandReportId: true,
  projectCode: true,
  createdBy: true,
});

export const insertProjectPhaseSchema = createInsertSchema(projectPhases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  phaseName: z.enum(PROJECT_PHASES),
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).default('pending'),
});

export const insertProjectMilestoneSchema = createInsertSchema(projectMilestones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  milestoneType: z.enum(['deliverable', 'approval', 'review', 'payment', 'go_live']),
  status: z.enum(['pending', 'in_progress', 'completed', 'delayed', 'blocked']).default('pending'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
});

export const insertProjectKpiSchema = createInsertSchema(projectKpis).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
}).extend({
  kpiCategory: z.enum(['financial', 'schedule', 'quality', 'resource', 'risk']),
  trend: z.enum(['improving', 'stable', 'declining']).optional(),
  healthStatus: z.enum(['on_track', 'warning', 'critical']).default('on_track'),
});

export const insertPhaseHistorySchema = createInsertSchema(phaseHistory).omit({
  id: true,
  transitionedAt: true,
}).extend({
  fromPhase: z.enum(PROJECT_PHASES).optional(),
  toPhase: z.enum(PROJECT_PHASES),
  transitionType: z.enum(['advance', 'revert', 'skip', 'hold']),
});

export type PortfolioProject = typeof portfolioProjects.$inferSelect;
export type InsertPortfolioProject = z.infer<typeof insertPortfolioProjectSchema>;
export type UpdatePortfolioProject = z.infer<typeof updatePortfolioProjectSchema>;

export type ProjectPhaseRecord = typeof projectPhases.$inferSelect;
export type InsertProjectPhase = z.infer<typeof insertProjectPhaseSchema>;

export type ProjectMilestone = typeof projectMilestones.$inferSelect;
export type InsertProjectMilestone = z.infer<typeof insertProjectMilestoneSchema>;

export type ProjectKpi = typeof projectKpis.$inferSelect;
export type InsertProjectKpi = z.infer<typeof insertProjectKpiSchema>;

export type PhaseHistoryRecord = typeof phaseHistory.$inferSelect;
export type InsertPhaseHistory = z.infer<typeof insertPhaseHistorySchema>;

// ============================================================================
// COMPREHENSIVE PROJECT MANAGEMENT SYSTEM
// Enterprise-grade project management comparable to Jira/Microsoft Project
// Includes: Gates, Approvals, Risks, Issues, WBS, Stakeholders, Communications
// ============================================================================

// ----------------------------------------
// PROJECT GATES - Stage-Gate Methodology
// ----------------------------------------

export const PROJECT_GATE_TYPES = [
  'intake',          // Demand intake gate
  'initiation',      // Project kickoff gate
  'planning',        // Planning completion gate
  'execution',       // Execution phase gate
  'monitoring',      // Monitoring & Control gate
  'closure',         // Project closure gate
  'design',          // Design approval gate
  'development',     // Development completion gate
  'testing',         // Testing/QA gate
  'deployment',      // Deployment readiness gate
  'custom'           // Custom gate
] as const;

export type ProjectGateType = typeof PROJECT_GATE_TYPES[number];

export const projectGates = pgTable("project_gates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectId: uuid("project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),

  // Gate Identity
  gateName: text("gate_name").notNull(),
  gateType: varchar("gate_type", { length: 30 }).notNull().$type<ProjectGateType>(),
  gateOrder: integer("gate_order").notNull(), // Sequence in project lifecycle
  description: text("description"),

  // Gate Status
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, in_review, approved, rejected, deferred

  // Gate Criteria
  entryCriteria: jsonb("entry_criteria"), // { criteria: [{ id, description, isMandatory, isComplete }] }
  exitCriteria: jsonb("exit_criteria"),   // { criteria: [{ id, description, isMandatory, isComplete }] }
  deliverables: jsonb("deliverables"),    // { items: [{ id, name, status, documentUrl }] }

  // Scheduling
  plannedDate: date("planned_date"),
  actualDate: date("actual_date"),

  // Review Information
  reviewScheduledDate: timestamp("review_scheduled_date"),
  reviewCompletedDate: timestamp("review_completed_date"),
  reviewNotes: text("review_notes"),

  // Approval Chain
  requiredApprovers: jsonb("required_approvers"), // [{ userId, role, order, isMandatory }]

  // Decision
  decision: varchar("decision", { length: 20 }), // go, no_go, conditional, deferred
  decisionNotes: text("decision_notes"),
  conditions: jsonb("conditions"), // Conditions if decision is conditional

  // Metadata
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectGateIdx: index("project_gates_project_idx").on(table.projectId),
  statusIdx: index("project_gates_status_idx").on(table.status),
  gateOrderIdx: index("project_gates_order_idx").on(table.projectId, table.gateOrder),
}));

// ----------------------------------------
// PROJECT APPROVALS - Multi-level Approval Workflow
// ----------------------------------------

export const APPROVAL_TYPES = [
  'gate_review',     // Gate passage approval
  'budget',          // Budget approval
  'scope_change',    // Scope change request
  'resource',        // Resource allocation
  'document',        // Document approval
  'milestone',       // Milestone completion
  'risk_response',   // Risk response plan
  'vendor',          // Vendor selection
  'procurement',     // Procurement approval
  'custom'           // Custom approval
] as const;

export type ApprovalType = typeof APPROVAL_TYPES[number];

export const projectApprovals = pgTable("project_approvals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectId: uuid("project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),
  gateId: uuid("gate_id").references(() => projectGates.id, { onDelete: "set null" }),

  // Approval Identity
  approvalType: varchar("approval_type", { length: 30 }).notNull().$type<ApprovalType>(),
  title: text("title").notNull(),
  description: text("description"),

  // Status
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, in_progress, approved, rejected, delegated, escalated
  priority: varchar("priority", { length: 20 }).notNull().default("medium"), // critical, high, medium, low

  // Request Details
  requestedBy: uuid("requested_by").notNull().references(() => users.id),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),

  // Assignment
  currentApprover: uuid("current_approver").references(() => users.id),
  approvalChain: jsonb("approval_chain"), // [{ userId, role, order, status, actionDate, comments }]
  currentStep: integer("current_step").default(1),
  totalSteps: integer("total_steps").default(1),

  // Delegation/Escalation
  delegatedTo: uuid("delegated_to").references(() => users.id),
  delegatedBy: uuid("delegated_by").references(() => users.id),
  delegationReason: text("delegation_reason"),
  escalatedTo: uuid("escalated_to").references(() => users.id),
  escalationReason: text("escalation_reason"),
  escalatedAt: timestamp("escalated_at"),

  // Decision
  decision: varchar("decision", { length: 20 }), // approved, rejected, conditionally_approved
  decisionBy: uuid("decision_by").references(() => users.id),
  decisionAt: timestamp("decision_at"),
  decisionComments: text("decision_comments"),
  conditions: jsonb("conditions"), // If conditionally approved

  // SLA Tracking
  dueDate: timestamp("due_date"),
  slaBreached: boolean("sla_breached").default(false),
  remindersSent: integer("reminders_sent").default(0),

  // Supporting Documents
  attachments: jsonb("attachments"), // [{ name, url, type, uploadedBy, uploadedAt }]

  // Digital Signature
  digitalSignature: jsonb("digital_signature"), // { signatureData, signedAt, ipAddress, deviceInfo }

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectApprovalIdx: index("project_approvals_project_idx").on(table.projectId),
  gateApprovalIdx: index("project_approvals_gate_idx").on(table.gateId),
  statusIdx: index("project_approvals_status_idx").on(table.status),
  approverIdx: index("project_approvals_approver_idx").on(table.currentApprover),
  dueDateIdx: index("project_approvals_due_idx").on(table.dueDate),
}));

// ----------------------------------------
// PROJECT RISKS - Risk Register & Management
// ----------------------------------------

export const RISK_CATEGORIES = [
  'technical',       // Technical/technology risks
  'financial',       // Budget/cost risks
  'schedule',        // Timeline risks
  'resource',        // Resource availability
  'scope',           // Scope creep
  'quality',         // Quality/performance
  'security',        // Security/cyber risks
  'compliance',      // Regulatory compliance
  'vendor',          // Third-party/vendor
  'operational',     // Operational risks
  'strategic',       // Strategic alignment
  'external'         // External factors (market, political)
] as const;

export type RiskCategory = typeof RISK_CATEGORIES[number];

export const RISK_PROBABILITY = ['very_low', 'low', 'medium', 'high', 'very_high'] as const;
export const RISK_IMPACT = ['negligible', 'minor', 'moderate', 'major', 'severe'] as const;

export type RiskProbability = typeof RISK_PROBABILITY[number];
export type RiskImpact = typeof RISK_IMPACT[number];

export const projectRisks = pgTable("project_risks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectId: uuid("project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),

  // Risk Identity
  riskCode: varchar("risk_code", { length: 20 }).notNull(), // e.g., RSK-001
  title: text("title").notNull(),
  description: text("description"),
  category: varchar("category", { length: 30 }).notNull().$type<RiskCategory>(),

  // Risk Assessment
  probability: varchar("probability", { length: 20 }).notNull().$type<RiskProbability>(),
  impact: varchar("impact", { length: 20 }).notNull().$type<RiskImpact>(),
  riskScore: integer("risk_score"), // Calculated: probability x impact (1-25)
  riskLevel: varchar("risk_level", { length: 20 }), // low, medium, high, critical

  // Pre-mitigation vs Post-mitigation
  residualProbability: varchar("residual_probability", { length: 20 }).$type<RiskProbability>(),
  residualImpact: varchar("residual_impact", { length: 20 }).$type<RiskImpact>(),
  residualRiskScore: integer("residual_risk_score"),

  // Status
  status: varchar("status", { length: 20 }).notNull().default("identified"), // identified, analyzing, mitigating, monitoring, closed, materialized

  // Response Strategy
  responseStrategy: varchar("response_strategy", { length: 20 }), // avoid, transfer, mitigate, accept
  mitigationPlan: text("mitigation_plan"),
  contingencyPlan: text("contingency_plan"),

  // Ownership
  riskOwner: uuid("risk_owner").references(() => users.id),
  identifiedBy: uuid("identified_by").notNull().references(() => users.id),

  // Tracking
  identifiedDate: date("identified_date").notNull(),
  targetResolutionDate: date("target_resolution_date"),
  actualClosureDate: date("actual_closure_date"),

  // Cost Impact
  potentialCostImpact: numeric("potential_cost_impact", { precision: 15, scale: 2 }),
  mitigationCost: numeric("mitigation_cost", { precision: 15, scale: 2 }),

  // Related Items
  linkedIssues: varchar("linked_issues").array(), // Related issue IDs
  linkedTasks: varchar("linked_tasks").array(),   // Related WBS task IDs
  affectedMilestones: varchar("affected_milestones").array(),

  // Trigger Conditions
  triggers: jsonb("triggers"), // [{ condition, action }]
  earlyWarningIndicators: jsonb("early_warning_indicators"),

  // History
  assessmentHistory: jsonb("assessment_history"), // [{ date, probability, impact, notes, assessedBy }]

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectRiskIdx: index("project_risks_project_idx").on(table.projectId),
  statusIdx: index("project_risks_status_idx").on(table.status),
  categoryIdx: index("project_risks_category_idx").on(table.category),
  riskLevelIdx: index("project_risks_level_idx").on(table.riskLevel),
  ownerIdx: index("project_risks_owner_idx").on(table.riskOwner),
}));

// ----------------------------------------
// RISK EVIDENCE - Evidence attached to risks
// ----------------------------------------

export const riskEvidence = pgTable("risk_evidence", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  riskId: uuid("risk_id").notNull().references(() => projectRisks.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").notNull(),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 100 }),
  fileSize: integer("file_size"),
  fileUrl: varchar("file_url", { length: 1000 }).notNull(),
  description: text("description"),
  uploadedBy: varchar("uploaded_by"),
  verificationStatus: varchar("verification_status", { length: 50 }).default("pending"),
  verifiedBy: varchar("verified_by"),
  verifiedAt: timestamp("verified_at"),
  aiAnalysis: jsonb("ai_analysis"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  riskIdx: index("risk_evidence_risk_idx").on(table.riskId),
  projectIdx: index("risk_evidence_project_idx").on(table.projectId),
}));

export const insertRiskEvidenceSchema = createInsertSchema(riskEvidence).omit({
  id: true,
  createdAt: true,
});

export const updateRiskEvidenceSchema = insertRiskEvidenceSchema.partial().omit({
  riskId: true,
  projectId: true,
});

export type RiskEvidence = typeof riskEvidence.$inferSelect;
export type InsertRiskEvidence = z.infer<typeof insertRiskEvidenceSchema>;
export type UpdateRiskEvidence = z.infer<typeof updateRiskEvidenceSchema>;

// ----------------------------------------
// PROJECT ISSUES - Issue Tracking & Resolution
// ----------------------------------------

export const ISSUE_TYPES = [
  'defect',          // Quality defect
  'blocker',         // Blocking issue
  'change_request',  // Scope change
  'dependency',      // External dependency issue
  'resource',        // Resource issue
  'communication',   // Communication breakdown
  'technical',       // Technical problem
  'vendor',          // Vendor/supplier issue
  'compliance',      // Compliance issue
  'other'            // Other issues
] as const;

export type IssueType = typeof ISSUE_TYPES[number];

export const projectIssues = pgTable("project_issues", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectId: uuid("project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),

  // Issue Identity
  issueCode: varchar("issue_code", { length: 20 }).notNull(), // e.g., ISS-001
  title: text("title").notNull(),
  description: text("description"),
  issueType: varchar("issue_type", { length: 30 }).notNull().$type<IssueType>(),

  // Classification
  priority: varchar("priority", { length: 20 }).notNull().default("medium"), // critical, high, medium, low
  severity: varchar("severity", { length: 20 }).notNull().default("moderate"), // critical, major, moderate, minor, trivial

  // Status
  status: varchar("status", { length: 20 }).notNull().default("open"), // open, in_progress, pending, resolved, closed, escalated

  // Assignment
  reportedBy: uuid("reported_by").notNull().references(() => users.id),
  assignedTo: uuid("assigned_to").references(() => users.id),

  // Dates
  reportedDate: timestamp("reported_date").notNull().defaultNow(),
  targetResolutionDate: timestamp("target_resolution_date"),
  actualResolutionDate: timestamp("actual_resolution_date"),

  // Resolution
  resolution: text("resolution"),
  rootCause: text("root_cause"),
  preventiveMeasures: text("preventive_measures"),
  resolvedBy: uuid("resolved_by").references(() => users.id),

  // Escalation
  escalationLevel: integer("escalation_level").default(0),
  escalatedTo: uuid("escalated_to").references(() => users.id),
  escalationReason: text("escalation_reason"),
  escalatedAt: timestamp("escalated_at"),

  // Impact
  impactDescription: text("impact_description"),
  affectedAreas: jsonb("affected_areas"), // [{ area, impact }]

  // Related Items
  linkedRiskId: uuid("linked_risk_id").references(() => projectRisks.id, { onDelete: "set null" }),
  linkedTasks: varchar("linked_tasks").array(), // Related WBS task IDs
  blockedTasks: varchar("blocked_tasks").array(), // Tasks blocked by this issue

  // Comments/Updates
  comments: jsonb("comments"), // [{ userId, comment, timestamp }]

  // Attachments
  attachments: jsonb("attachments"), // [{ name, url, type }]

  // SLA
  slaBreached: boolean("sla_breached").default(false),
  slaHours: integer("sla_hours"), // Target resolution hours based on priority

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectIssueIdx: index("project_issues_project_idx").on(table.projectId),
  statusIdx: index("project_issues_status_idx").on(table.status),
  priorityIdx: index("project_issues_priority_idx").on(table.priority),
  assigneeIdx: index("project_issues_assignee_idx").on(table.assignedTo),
  linkedRiskIdx: index("project_issues_risk_idx").on(table.linkedRiskId),
}));

// ----------------------------------------
// WBS TASKS - Work Breakdown Structure
// ----------------------------------------

export const wbsTasks = pgTable("wbs_tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectId: uuid("project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),
  decisionSpineId: text("decision_spine_id"),
  phaseId: uuid("phase_id").references(() => projectPhases.id, { onDelete: "set null" }),
  parentTaskId: varchar("parent_task_id"), // Self-reference for hierarchy

  // Task Identity
  taskCode: varchar("task_code", { length: 30 }).notNull(), // e.g., 1.2.3.1
  wbsLevel: integer("wbs_level").notNull().default(1), // Hierarchy depth
  title: text("title").notNull(),
  description: text("description"),

  // Task Type
  taskType: varchar("task_type", { length: 20 }).notNull().default("task"), // task, milestone, summary, deliverable

  // Status
  status: varchar("status", { length: 20 }).notNull().default("not_started"), // not_started, in_progress, completed, on_hold, cancelled
  progress: integer("progress").notNull().default(0), // 0-100

  // Priority
  priority: varchar("priority", { length: 20 }).notNull().default("medium"), // critical, high, medium, low

  // Scheduling
  plannedStartDate: date("planned_start_date"),
  plannedEndDate: date("planned_end_date"),
  actualStartDate: date("actual_start_date"),
  actualEndDate: date("actual_end_date"),
  duration: integer("duration"), // Planned duration in days
  actualDuration: integer("actual_duration"),

  // Baseline Dates (locked when planning gate is approved)
  baselineStartDate: date("baseline_start_date"),
  baselineEndDate: date("baseline_end_date"),
  baselineLocked: boolean("baseline_locked").default(false),
  baselineLockedAt: timestamp("baseline_locked_at"),
  baselineLockedBy: uuid("baseline_locked_by").references(() => users.id),

  // Variance Tracking (best practice: track drift from baseline)
  scheduleVarianceDays: integer("schedule_variance_days").default(0),
  changeHistory: jsonb("change_history"),

  // Dependencies
  predecessors: jsonb("predecessors"), // [{ taskId, type: 'FS'|'FF'|'SS'|'SF', lag }]
  successors: jsonb("successors"),     // [{ taskId, type, lag }]

  // Resource Assignment (text field for stakeholder names, not FK to users)
  assignedTo: varchar("assigned_to"),
  assignedTeam: varchar("assigned_team"),
  estimatedHours: numeric("estimated_hours", { precision: 10, scale: 2 }),
  actualHours: numeric("actual_hours", { precision: 10, scale: 2 }),
  remainingHours: numeric("remaining_hours", { precision: 10, scale: 2 }),

  // Cost Tracking
  plannedCost: numeric("planned_cost", { precision: 15, scale: 2 }),
  actualCost: numeric("actual_cost", { precision: 15, scale: 2 }),

  // Deliverables
  deliverables: jsonb("deliverables"), // [{ name, description, status, documentUrl }]
  acceptanceCriteria: jsonb("acceptance_criteria"), // [{ criterion, isMet }]

  // Linked Items
  linkedRisks: varchar("linked_risks").array(),
  linkedIssues: varchar("linked_issues").array(),

  // Notes
  notes: text("notes"),

  // Evidence/Attachments for completion proof
  evidenceUrl: text("evidence_url"),
  evidenceFileName: varchar("evidence_file_name", { length: 255 }),
  evidenceNotes: text("evidence_notes"),
  evidenceUploadedAt: timestamp("evidence_uploaded_at"),
  evidenceUploadedBy: uuid("evidence_uploaded_by").references(() => users.id),

  // PMO Evidence Verification
  evidenceVerificationStatus: varchar("evidence_verification_status", { length: 30 }).default("pending"), // pending, approved, rejected
  evidenceVerifiedBy: uuid("evidence_verified_by").references(() => users.id),
  evidenceVerifiedAt: timestamp("evidence_verified_at"),
  evidenceVerificationNotes: text("evidence_verification_notes"),

  // Sort Order within parent
  sortOrder: integer("sort_order").default(0),

  // Metadata
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectTaskIdx: index("wbs_tasks_project_idx").on(table.projectId),
  decisionSpineIdIdx: index("wbs_tasks_decision_spine_idx").on(table.decisionSpineId),
  phaseTaskIdx: index("wbs_tasks_phase_idx").on(table.phaseId),
  parentTaskIdx: index("wbs_tasks_parent_idx").on(table.parentTaskId),
  statusIdx: index("wbs_tasks_status_idx").on(table.status),
  assigneeIdx: index("wbs_tasks_assignee_idx").on(table.assignedTo),
  taskCodeIdx: index("wbs_tasks_code_idx").on(table.projectId, table.taskCode),
}));

// ----------------------------------------
// TASK EVIDENCE - Multiple documents per task/work package
// ----------------------------------------
export const taskEvidence = pgTable("task_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => wbsTasks.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: varchar("file_type", { length: 100 }),
  fileSize: integer("file_size"),
  notes: text("notes"),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  verificationStatus: varchar("verification_status", { length: 30 }).default("pending"),
  verifiedBy: uuid("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  verificationNotes: text("verification_notes"),
}, (table) => ({
  taskIdx: index("task_evidence_task_idx").on(table.taskId),
  projectIdx: index("task_evidence_project_idx").on(table.projectId),
  statusIdx: index("task_evidence_status_idx").on(table.verificationStatus),
}));

// ----------------------------------------
// WBS APPROVALS - PMO Approval Workflow
// ----------------------------------------

export const WBS_APPROVAL_STATUS = [
  'draft',           // Initial state, editing allowed
  'pending_review',  // Submitted for PMO review
  'approved',        // PMO approved
  'rejected',        // PMO rejected with feedback
  'revision',        // Being revised after rejection
] as const;

export type WbsApprovalStatus = typeof WBS_APPROVAL_STATUS[number];

export const wbsApprovals = pgTable("wbs_approvals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectId: uuid("project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),

  // Approval Status
  status: varchar("status", { length: 30 }).notNull().default("draft").$type<WbsApprovalStatus>(),
  version: integer("version").notNull().default(1),

  // Submission Details
  submittedBy: uuid("submitted_by").references(() => users.id),
  submittedAt: timestamp("submitted_at"),
  submissionNotes: text("submission_notes"),

  // Review Details
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  rejectionReason: text("rejection_reason"),

  // Version Snapshot (frozen copy of WBS at submission)
  wbsSnapshot: jsonb("wbs_snapshot"),

  // Statistics at submission
  totalTasks: integer("total_tasks"),
  criticalPathDays: integer("critical_path_days"),
  estimatedHours: numeric("estimated_hours", { precision: 10, scale: 2 }),

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectIdx: index("wbs_approvals_project_idx").on(table.projectId),
  statusIdx: index("wbs_approvals_status_idx").on(table.status),
}));

// ----------------------------------------
// WBS VERSIONS - Full Versioning System (mirrors report_versions for Business Case)
// ----------------------------------------

export const WBS_VERSION_STATUS = [
  'draft',           // Initial state, editing allowed
  'under_review',    // Submitted for PMO review
  'approved',        // PMO approved
  'published',       // Published/baseline locked
  'archived',        // Archived (older version superseded)
  'rejected',        // Rejected with feedback
  'superseded',      // Replaced by a newer version
] as const;

export type WbsVersionStatus = typeof WBS_VERSION_STATUS[number];

export const wbsVersions = pgTable("wbs_versions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Project Reference
  projectId: uuid("project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),
  decisionSpineId: text("decision_spine_id"),

  // Semantic Versioning System (same as report_versions)
  versionNumber: varchar("version_number", { length: 20 }).notNull(), // v1.0, v1.1, v2.0
  majorVersion: integer("major_version").notNull(),
  minorVersion: integer("minor_version").notNull(),
  patchVersion: integer("patch_version").notNull().default(0),

  // Parent-Child Version Relationships
  parentVersionId: varchar("parent_version_id"),
  baseVersionId: varchar("base_version_id"),

  // Version Status
  status: varchar("status", { length: 30 }).notNull().default("draft").$type<WbsVersionStatus>(),

  // Complete WBS Snapshot (all tasks at this version)
  versionData: json("version_data").notNull(), // Full WBS task tree snapshot
  versionMetadata: json("version_metadata"),   // Stats, critical path, etc.

  // Change Management
  changesSummary: text("changes_summary").notNull(),
  changesDetails: json("changes_details"),
  editReason: text("edit_reason"),

  // Government Audit Trail
  createdBy: varchar("created_by", { length: 100 }).notNull(),
  createdByName: text("created_by_name").notNull(),
  createdByRole: varchar("created_by_role", { length: 50 }),
  createdByDepartment: text("created_by_department"),

  // Review Workflow
  reviewedBy: varchar("reviewed_by", { length: 100 }),
  reviewedByName: text("reviewed_by_name"),
  reviewedAt: timestamp("reviewed_at"),
  reviewComments: text("review_comments"),

  // Approval Workflow
  approvedBy: varchar("approved_by", { length: 100 }),
  approvedByName: text("approved_by_name"),
  approvedAt: timestamp("approved_at"),
  approvalComments: text("approval_comments"),

  // Publication (Baseline Lock)
  publishedBy: varchar("published_by", { length: 100 }),
  publishedByName: text("published_by_name"),
  publishedAt: timestamp("published_at"),

  // Rejection
  rejectedBy: varchar("rejected_by", { length: 100 }),
  rejectedByName: text("rejected_by_name"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),

  // Compliance & Integrity
  retentionPolicy: varchar("retention_policy", { length: 50 }).default("standard"),
  complianceFlags: json("compliance_flags"),
  dataClassification: varchar("data_classification", { length: 30 }).default("internal"),
  contentHash: varchar("content_hash", { length: 128 }),
  validationStatus: varchar("validation_status", { length: 30 }).default("pending"),
  validationErrors: json("validation_errors"),

  // Workflow State
  workflowStep: varchar("workflow_step", { length: 50 }).default("created"),
  workflowHistory: json("workflow_history"),

  // WBS Statistics at Version Time
  totalTasks: integer("total_tasks"),
  totalMilestones: integer("total_milestones"),
  criticalPathDays: integer("critical_path_days"),
  estimatedTotalHours: numeric("estimated_total_hours", { precision: 10, scale: 2 }),
  estimatedTotalCost: numeric("estimated_total_cost", { precision: 15, scale: 2 }),

  // Timestamps
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  effectiveAt: timestamp("effective_at"),
  expiresAt: timestamp("expires_at"),
}, (table) => ({
  projectIdStatusIdx: index("wbs_versions_project_status_idx").on(table.projectId, table.status),
  decisionSpineIdIdx: index("wbs_versions_decision_spine_idx").on(table.decisionSpineId),
  semanticVersionOrderIdx: index("wbs_versions_semantic_order_idx").on(table.projectId, table.majorVersion, table.minorVersion, table.patchVersion),
  uniqueSemanticVersionIdx: unique("wbs_versions_unique_semantic").on(table.projectId, table.majorVersion, table.minorVersion, table.patchVersion),
  parentVersionIdx: index("wbs_versions_parent_idx").on(table.parentVersionId),
  workflowCreatedIdx: index("wbs_versions_workflow_created_idx").on(table.workflowStep, table.createdAt),
  createdByDateIdx: index("wbs_versions_creator_date_idx").on(table.createdBy, table.createdAt),
}));

export const insertWbsVersionSchema = createInsertSchema(wbsVersions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(WBS_VERSION_STATUS).default("draft"),
  majorVersion: z.number().int().min(0),
  minorVersion: z.number().int().min(0),
  patchVersion: z.number().int().min(0).default(0),
});

export const updateWbsVersionSchema = insertWbsVersionSchema.partial().omit({
  projectId: true,
  createdBy: true,
  createdByName: true,
});

export type InsertWbsVersion = z.infer<typeof insertWbsVersionSchema>;
export type UpdateWbsVersion = z.infer<typeof updateWbsVersionSchema>;
export type WbsVersion = typeof wbsVersions.$inferSelect;

// ----------------------------------------
// PROJECT STAKEHOLDERS - Stakeholder Management
// ----------------------------------------

export const STAKEHOLDER_TYPES = [
  'sponsor',           // Executive sponsor
  'owner',             // Project owner
  'manager',           // Project manager
  'team_member',       // Core team member
  'subject_expert',    // Subject matter expert
  'end_user',          // End user representative
  'vendor',            // External vendor/supplier
  'regulator',         // Regulatory body
  'executive',         // C-level executive
  'department_head',   // Department head
  'external_partner',  // External partner
  'customer'           // Customer representative
] as const;

export type StakeholderType = typeof STAKEHOLDER_TYPES[number];

export const projectStakeholders = pgTable("project_stakeholders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectId: uuid("project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }), // Optional internal user

  // Stakeholder Identity
  name: text("name").notNull(),
  title: text("title"),
  organization: text("organization"),
  department: text("department"),
  email: text("email"),
  phone: text("phone"),

  // Classification
  stakeholderType: varchar("stakeholder_type", { length: 30 }).notNull().$type<StakeholderType>(),
  isInternal: boolean("is_internal").default(true),

  // Influence/Interest Matrix (Power-Interest Grid)
  influenceLevel: varchar("influence_level", { length: 20 }).notNull(), // high, medium, low
  interestLevel: varchar("interest_level", { length: 20 }).notNull(),   // high, medium, low
  supportLevel: varchar("support_level", { length: 20 }),               // champion, supporter, neutral, resistant, blocker

  // RACI Matrix (for key deliverables)
  raciMatrix: jsonb("raci_matrix"), // { deliverableId: 'R'|'A'|'C'|'I' }

  // Engagement Strategy
  engagementStrategy: text("engagement_strategy"),
  communicationFrequency: varchar("communication_frequency", { length: 20 }), // daily, weekly, bi_weekly, monthly, as_needed
  preferredChannel: varchar("preferred_channel", { length: 30 }), // email, meeting, call, portal

  // Expectations & Concerns
  expectations: jsonb("expectations"), // [{ expectation, priority, status }]
  concerns: jsonb("concerns"),         // [{ concern, status, resolution }]

  // Engagement Tracking
  lastEngagementDate: date("last_engagement_date"),
  engagementScore: integer("engagement_score"), // 0-100 satisfaction score
  engagementHistory: jsonb("engagement_history"), // [{ date, type, notes, outcome }]

  // Status
  isActive: boolean("is_active").default(true),

  // Metadata
  addedBy: uuid("added_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectStakeholderIdx: index("project_stakeholders_project_idx").on(table.projectId),
  userIdx: index("project_stakeholders_user_idx").on(table.userId),
  typeIdx: index("project_stakeholders_type_idx").on(table.stakeholderType),
}));

// ----------------------------------------
// PROJECT COMMUNICATIONS - Communication Management
// ----------------------------------------

export const COMMUNICATION_TYPES = [
  'announcement',      // General announcement
  'meeting_minutes',   // Meeting minutes
  'status_report',     // Status report
  'decision',          // Decision record
  'action_item',       // Action item
  'escalation',        // Escalation notice
  'change_notice',     // Change notification
  'milestone_update',  // Milestone update
  'risk_alert',        // Risk alert
  'newsletter'         // Project newsletter
] as const;

export type CommunicationType = typeof COMMUNICATION_TYPES[number];

export const projectCommunications = pgTable("project_communications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectId: uuid("project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),

  // Communication Identity
  communicationType: varchar("communication_type", { length: 30 }).notNull().$type<CommunicationType>(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  summary: text("summary"), // Brief summary for announcements

  // Classification
  priority: varchar("priority", { length: 20 }).notNull().default("normal"), // urgent, high, normal, low
  category: varchar("category", { length: 30 }), // project_update, team_update, stakeholder_update

  // Author
  createdBy: uuid("created_by").notNull().references(() => users.id),

  // Distribution
  distributionList: jsonb("distribution_list"), // [{ userId, email, stakeholderId }]
  sentAt: timestamp("sent_at"),
  sendViaEmail: boolean("send_via_email").default(false),

  // Meeting-specific fields
  meetingDate: timestamp("meeting_date"),
  meetingAttendees: jsonb("meeting_attendees"), // [{ userId, name, attendance: 'present'|'absent'|'excused' }]
  meetingAgenda: jsonb("meeting_agenda"),       // [{ item, discussion, outcome }]

  // Action Items (for meetings)
  actionItems: jsonb("action_items"), // [{ id, description, assignedTo, dueDate, status, completedDate }]

  // Decisions (for decision records)
  decisions: jsonb("decisions"), // [{ id, decision, rationale, madeBy, impact }]

  // Attachments
  attachments: jsonb("attachments"), // [{ name, url, type }]

  // Read Tracking
  readBy: jsonb("read_by"), // [{ userId, readAt }]

  // Status
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, published, archived
  publishedAt: timestamp("published_at"),

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectCommIdx: index("project_comms_project_idx").on(table.projectId),
  typeIdx: index("project_comms_type_idx").on(table.communicationType),
  statusIdx: index("project_comms_status_idx").on(table.status),
  createdAtIdx: index("project_comms_created_idx").on(table.createdAt),
}));

// ----------------------------------------
// PROJECT DOCUMENTS - Document Management
// ----------------------------------------

export const projectDocuments = pgTable("project_documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectId: uuid("project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),

  // Document Identity
  documentName: text("document_name").notNull(),
  documentType: varchar("document_type", { length: 30 }).notNull(), // charter, plan, report, specification, contract, meeting_notes, other
  description: text("description"),

  // Version Control
  version: varchar("version", { length: 20 }).notNull().default("1.0"),
  versionHistory: jsonb("version_history"), // [{ version, uploadedBy, uploadedAt, notes }]

  // File Information
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"), // bytes
  mimeType: varchar("mime_type", { length: 100 }),

  // Classification
  category: varchar("category", { length: 30 }), // governance, technical, financial, legal, operational
  tags: text("tags").array(),

  // Access Control
  accessLevel: varchar("access_level", { length: 20 }).notNull().default("project_team"), // public, project_team, stakeholders_only, restricted

  // Status
  status: varchar("status", { length: 20 }).notNull().default("active"), // draft, active, superseded, archived

  // Approval
  requiresApproval: boolean("requires_approval").default(false),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),

  // Metadata
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectDocIdx: index("project_docs_project_idx").on(table.projectId),
  typeIdx: index("project_docs_type_idx").on(table.documentType),
  statusIdx: index("project_docs_status_idx").on(table.status),
}));

// ----------------------------------------
// PROJECT CHANGE REQUESTS - Change Control Management
// Formal change request system for timeline, scope, budget modifications
// ----------------------------------------

export const CHANGE_REQUEST_TYPES = [
  'timeline',        // Schedule/timeline change
  'scope',           // Scope modification
  'budget',          // Budget adjustment
  'resource',        // Resource allocation change
  'deliverable',     // Deliverable modification
  'milestone',       // Milestone adjustment
  'priority',        // Priority change
  'technical',       // Technical approach change
  'integration',     // Integration requirement change
  'other'            // Other changes
] as const;

export const CHANGE_REQUEST_IMPACT = [
  'critical',        // Project-critical impact
  'high',            // Significant impact
  'medium',          // Moderate impact
  'low'              // Minor impact
] as const;

export type ChangeRequestType = typeof CHANGE_REQUEST_TYPES[number];
export type ChangeRequestImpact = typeof CHANGE_REQUEST_IMPACT[number];

export const projectChangeRequests = pgTable("project_change_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectId: uuid("project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),

  // Change Request Identity
  changeRequestCode: varchar("change_request_code", { length: 30 }).notNull(), // CR-001, CR-002
  title: text("title").notNull(),
  description: text("description").notNull(),

  // Classification
  changeType: varchar("change_type", { length: 30 }).notNull().$type<ChangeRequestType>(),
  impact: varchar("impact", { length: 20 }).notNull().$type<ChangeRequestImpact>(),
  urgency: varchar("urgency", { length: 20 }).notNull().default("normal"), // critical, high, normal, low

  // Justification
  justification: text("justification").notNull(), // Why is this change needed?
  businessImpact: text("business_impact"), // Impact on business objectives
  riskAssessment: text("risk_assessment"), // Risks if change is/isn't approved

  // Original vs Proposed (for timeline changes)
  originalValue: jsonb("original_value"), // { startDate, endDate, budget, etc. }
  proposedValue: jsonb("proposed_value"), // { startDate, endDate, budget, etc. }

  // Affected Items
  affectedTasks: text("affected_tasks").array(), // Task IDs affected
  affectedMilestones: text("affected_milestones").array(), // Milestone IDs
  affectedDeliverables: text("affected_deliverables").array(), // Deliverable descriptions

  // Cost/Effort Impact
  estimatedCostImpact: numeric("estimated_cost_impact"), // In AED
  estimatedEffortImpact: integer("estimated_effort_impact"), // In hours
  estimatedScheduleImpact: integer("estimated_schedule_impact"), // In days

  // Requestor
  requestedBy: uuid("requested_by").notNull().references(() => users.id),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),

  // Approval Workflow
  status: varchar("status", { length: 30 }).notNull().default("draft"), // draft, submitted, under_review, approved, rejected, deferred, implemented

  // Review/Approval
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),

  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  approvalNotes: text("approval_notes"),
  approvalConditions: text("approval_conditions"), // Conditions for approval

  rejectedBy: uuid("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),

  // Implementation
  implementedBy: uuid("implemented_by").references(() => users.id),
  implementedAt: timestamp("implemented_at"),
  implementationNotes: text("implementation_notes"),

  // Attachments & Evidence
  attachments: jsonb("attachments"), // [{ name, url, type, uploadedAt }]

  // Audit Trail
  workflowHistory: jsonb("workflow_history"), // [{ action, by, at, notes }]

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectChangeIdx: index("project_changes_project_idx").on(table.projectId),
  statusIdx: index("project_changes_status_idx").on(table.status),
  typeIdx: index("project_changes_type_idx").on(table.changeType),
  requestedByIdx: index("project_changes_requested_by_idx").on(table.requestedBy),
}));

// ----------------------------------------
// ZOD SCHEMAS FOR PROJECT MANAGEMENT
// ----------------------------------------

// Project Gates
export const insertProjectGateSchema = createInsertSchema(projectGates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  gateType: z.enum(PROJECT_GATE_TYPES),
  status: z.enum(['pending', 'submitted', 'in_review', 'approved', 'rejected', 'deferred']).default('pending'),
  decision: z.enum(['go', 'no_go', 'conditional', 'deferred']).optional(),
});

export const updateProjectGateSchema = insertProjectGateSchema.partial().omit({
  projectId: true,
  createdBy: true,
});

// Project Approvals
// projectId and requestedBy are optional in the body schema — the route handler
// always injects the authoritative values from URL params and auth context.
export const insertProjectApprovalSchema = createInsertSchema(projectApprovals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  requestedAt: true,
}).extend({
  projectId: z.string().uuid().optional(),   // injected by route from URL param
  requestedBy: z.string().uuid().optional(), // injected by route from auth context
  approvalType: z.enum(APPROVAL_TYPES),
  status: z.enum(['pending', 'in_progress', 'approved', 'rejected', 'delegated', 'escalated']).default('pending'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  decision: z.enum(['approved', 'rejected', 'conditionally_approved']).optional(),
});

export const updateProjectApprovalSchema = insertProjectApprovalSchema.partial().omit({
  projectId: true,
  requestedBy: true,
});

// Project Risks
export const insertProjectRiskSchema = createInsertSchema(projectRisks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  category: z.enum(RISK_CATEGORIES),
  probability: z.enum(RISK_PROBABILITY),
  impact: z.enum(RISK_IMPACT),
  residualProbability: z.enum(RISK_PROBABILITY).optional(),
  residualImpact: z.enum(RISK_IMPACT).optional(),
  status: z.enum(['identified', 'analyzing', 'mitigating', 'monitoring', 'closed', 'materialized']).default('identified'),
  responseStrategy: z.enum(['avoid', 'transfer', 'mitigate', 'accept']).optional(),
});

export const updateProjectRiskSchema = insertProjectRiskSchema.partial().omit({
  projectId: true,
  identifiedBy: true,
});

// Project Issues
export const insertProjectIssueSchema = createInsertSchema(projectIssues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reportedDate: true,
}).extend({
  issueType: z.enum(ISSUE_TYPES),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  severity: z.enum(['critical', 'major', 'moderate', 'minor', 'trivial']).default('moderate'),
  status: z.enum(['open', 'in_progress', 'pending', 'resolved', 'closed', 'escalated']).default('open'),
});

export const updateProjectIssueSchema = insertProjectIssueSchema.partial().omit({
  projectId: true,
  reportedBy: true,
});

// WBS Tasks
export const insertWbsTaskSchema = createInsertSchema(wbsTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  taskType: z.enum(['task', 'milestone', 'summary', 'deliverable']).default('task'),
  status: z.enum(['not_started', 'in_progress', 'completed', 'blocked', 'on_hold', 'cancelled']).default('not_started'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  progress: z.number().int().min(0).max(100).default(0),
  decisionSpineId: z.string().optional().nullable(),
});

export const updateWbsTaskSchema = insertWbsTaskSchema.partial().omit({
  projectId: true,
  createdBy: true,
});

// WBS Approvals
export const insertWbsApprovalSchema = createInsertSchema(wbsApprovals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(WBS_APPROVAL_STATUS).default('draft'),
});

export const updateWbsApprovalSchema = insertWbsApprovalSchema.partial().omit({
  projectId: true,
});

// Project Stakeholders
export const insertProjectStakeholderSchema = createInsertSchema(projectStakeholders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  stakeholderType: z.enum(STAKEHOLDER_TYPES),
  influenceLevel: z.enum(['high', 'medium', 'low']),
  interestLevel: z.enum(['high', 'medium', 'low']),
  supportLevel: z.enum(['champion', 'supporter', 'neutral', 'resistant', 'blocker']).optional(),
  communicationFrequency: z.enum(['daily', 'weekly', 'bi_weekly', 'monthly', 'as_needed']).optional(),
});

export const updateProjectStakeholderSchema = insertProjectStakeholderSchema.partial().omit({
  projectId: true,
  addedBy: true,
});

// Project Communications
export const insertProjectCommunicationSchema = createInsertSchema(projectCommunications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  communicationType: z.enum(COMMUNICATION_TYPES),
  priority: z.enum(['urgent', 'high', 'normal', 'low']).default('normal'),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
});

export const updateProjectCommunicationSchema = insertProjectCommunicationSchema.partial().omit({
  projectId: true,
  createdBy: true,
});

// Project Documents
export const insertProjectDocumentSchema = createInsertSchema(projectDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  documentType: z.enum(['charter', 'plan', 'report', 'specification', 'contract', 'meeting_notes', 'other']),
  accessLevel: z.enum(['public', 'project_team', 'stakeholders_only', 'restricted']).default('project_team'),
  status: z.enum(['draft', 'active', 'superseded', 'archived']).default('active'),
});

export const updateProjectDocumentSchema = insertProjectDocumentSchema.partial().omit({
  projectId: true,
  uploadedBy: true,
});

// Project Change Requests
export const insertProjectChangeRequestSchema = createInsertSchema(projectChangeRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  requestedAt: true,
}).extend({
  changeType: z.enum(CHANGE_REQUEST_TYPES),
  impact: z.enum(CHANGE_REQUEST_IMPACT),
  urgency: z.enum(['critical', 'high', 'normal', 'low']).default('normal'),
  status: z.enum(['draft', 'submitted', 'under_review', 'approved', 'rejected', 'deferred', 'implemented']).default('draft'),
});

export const updateProjectChangeRequestSchema = insertProjectChangeRequestSchema.partial().omit({
  projectId: true,
  requestedBy: true,
});

// ----------------------------------------
// AGILE WORKSPACE (PROJECT ACCELERATOR) - Jira-like Scrum tooling
// ----------------------------------------

export const AGILE_SPRINT_STATUS = [
  'planned',
  'active',
  'completed',
] as const;
export type AgileSprintStatus = typeof AGILE_SPRINT_STATUS[number];

export const AGILE_WORK_ITEM_TYPES = [
  'epic',
  'story',
  'task',
  'bug',
  'subtask',
] as const;
export type AgileWorkItemType = typeof AGILE_WORK_ITEM_TYPES[number];

export const AGILE_WORK_ITEM_STATUS = [
  'backlog',
  'selected',
  'todo',
  'in_progress',
  'in_review',
  'done',
] as const;
export type AgileWorkItemStatus = typeof AGILE_WORK_ITEM_STATUS[number];

export const AGILE_PROJECT_ROLES = [
  'product_owner',
  'scrum_master',
  'developer',
  'stakeholder',
  'viewer',
] as const;
export type AgileProjectRole = typeof AGILE_PROJECT_ROLES[number];

// Sprints
export const agileSprints = pgTable('agile_sprints', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id').notNull().references(() => portfolioProjects.id, { onDelete: 'cascade' }),

  name: text('name').notNull(),
  goal: text('goal'),
  status: varchar('status', { length: 20 }).notNull().default('planned').$type<AgileSprintStatus>(),

  startDate: date('start_date'),
  endDate: date('end_date'),

  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: index('agile_sprints_project_idx').on(table.projectId),
  statusIdx: index('agile_sprints_status_idx').on(table.projectId, table.status),
}));

// Epics
export const agileEpics = pgTable('agile_epics', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id').notNull().references(() => portfolioProjects.id, { onDelete: 'cascade' }),

  epicKey: varchar('epic_key', { length: 30 }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('open'), // open, done

  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: index('agile_epics_project_idx').on(table.projectId),
  epicKeyUnique: unique('agile_epics_project_key_uniq').on(table.projectId, table.epicKey),
}));

// Work items (stories/tasks/bugs/subtasks, and epics as a type for parity)
export const agileWorkItems = pgTable('agile_work_items', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id').notNull().references(() => portfolioProjects.id, { onDelete: 'cascade' }),

  itemKey: varchar('item_key', { length: 30 }).notNull(),
  type: varchar('type', { length: 20 }).notNull().default('task').$type<AgileWorkItemType>(),
  title: text('title').notNull(),
  description: text('description'),

  status: varchar('status', { length: 20 }).notNull().default('backlog').$type<AgileWorkItemStatus>(),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),
  storyPoints: integer('story_points'),

  epicId: uuid('epic_id').references(() => agileEpics.id, { onDelete: 'set null' }),
  parentId: uuid('parent_id'),
  sprintId: uuid('sprint_id').references(() => agileSprints.id, { onDelete: 'set null' }),

  rank: integer('rank').notNull().default(0),

  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),

  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: index('agile_work_items_project_idx').on(table.projectId),
  sprintIdx: index('agile_work_items_sprint_idx').on(table.projectId, table.sprintId),
  epicIdx: index('agile_work_items_epic_idx').on(table.projectId, table.epicId),
  statusIdx: index('agile_work_items_status_idx').on(table.projectId, table.status),
  keyUnique: unique('agile_work_items_project_key_uniq').on(table.projectId, table.itemKey),
}));

// Comments
export const agileWorkItemComments = pgTable('agile_work_item_comments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workItemId: uuid('work_item_id').notNull().references(() => agileWorkItems.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  workItemIdx: index('agile_work_item_comments_item_idx').on(table.workItemId),
}));

// Project members & roles
export const agileProjectMembers = pgTable('agile_project_members', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id').notNull().references(() => portfolioProjects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 30 }).notNull().default('viewer').$type<AgileProjectRole>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: index('agile_project_members_project_idx').on(table.projectId),
  uniq: unique('agile_project_members_project_user_uniq').on(table.projectId, table.userId),
}));

// ----------------------------------------
// AGILE SCHEMAS
// ----------------------------------------

export const insertAgileSprintSchema = createInsertSchema(agileSprints).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(AGILE_SPRINT_STATUS).default('planned'),
});

export const updateAgileSprintSchema = insertAgileSprintSchema.partial().omit({
  projectId: true,
  createdBy: true,
});

export const insertAgileEpicSchema = createInsertSchema(agileEpics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(['open', 'done']).default('open'),
});

export const updateAgileEpicSchema = insertAgileEpicSchema.partial().omit({
  projectId: true,
  createdBy: true,
});

export const insertAgileWorkItemSchema = createInsertSchema(agileWorkItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  type: z.enum(AGILE_WORK_ITEM_TYPES).default('task'),
  status: z.enum(AGILE_WORK_ITEM_STATUS).default('backlog'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
});

export const updateAgileWorkItemSchema = insertAgileWorkItemSchema.partial().omit({
  projectId: true,
  createdBy: true,
  itemKey: true,
});

export const insertAgileWorkItemCommentSchema = createInsertSchema(agileWorkItemComments).omit({
  id: true,
  createdAt: true,
});

export const insertAgileProjectMemberSchema = createInsertSchema(agileProjectMembers).omit({
  id: true,
  createdAt: true,
}).extend({
  role: z.enum(AGILE_PROJECT_ROLES).default('viewer'),
});

export const updateAgileProjectMemberSchema = insertAgileProjectMemberSchema.partial().omit({
  projectId: true,
  userId: true,
});

// ----------------------------------------
// TYPE EXPORTS
// ----------------------------------------

export type ProjectGate = typeof projectGates.$inferSelect;
export type InsertProjectGate = z.infer<typeof insertProjectGateSchema>;
export type UpdateProjectGate = z.infer<typeof updateProjectGateSchema>;

export type ProjectApproval = typeof projectApprovals.$inferSelect;
export type InsertProjectApproval = z.infer<typeof insertProjectApprovalSchema>;
export type UpdateProjectApproval = z.infer<typeof updateProjectApprovalSchema>;

export type ProjectRisk = typeof projectRisks.$inferSelect;
export type InsertProjectRisk = z.infer<typeof insertProjectRiskSchema>;
export type UpdateProjectRisk = z.infer<typeof updateProjectRiskSchema>;

export type ProjectIssue = typeof projectIssues.$inferSelect;
export type InsertProjectIssue = z.infer<typeof insertProjectIssueSchema>;
export type UpdateProjectIssue = z.infer<typeof updateProjectIssueSchema>;

export type WbsTask = typeof wbsTasks.$inferSelect;
export type InsertWbsTask = z.infer<typeof insertWbsTaskSchema>;
export type UpdateWbsTask = z.infer<typeof updateWbsTaskSchema>;

export type WbsApproval = typeof wbsApprovals.$inferSelect;
export type InsertWbsApproval = z.infer<typeof insertWbsApprovalSchema>;
export type UpdateWbsApproval = z.infer<typeof updateWbsApprovalSchema>;

export type ProjectStakeholder = typeof projectStakeholders.$inferSelect;
export type InsertProjectStakeholder = z.infer<typeof insertProjectStakeholderSchema>;
export type UpdateProjectStakeholder = z.infer<typeof updateProjectStakeholderSchema>;

export type ProjectCommunication = typeof projectCommunications.$inferSelect;
export type InsertProjectCommunication = z.infer<typeof insertProjectCommunicationSchema>;
export type UpdateProjectCommunication = z.infer<typeof updateProjectCommunicationSchema>;

export type ProjectDocument = typeof projectDocuments.$inferSelect;
export type InsertProjectDocument = z.infer<typeof insertProjectDocumentSchema>;
export type UpdateProjectDocument = z.infer<typeof updateProjectDocumentSchema>;

export type ProjectChangeRequest = typeof projectChangeRequests.$inferSelect;
export type InsertProjectChangeRequest = z.infer<typeof insertProjectChangeRequestSchema>;
export type UpdateProjectChangeRequest = z.infer<typeof updateProjectChangeRequestSchema>;

export type AgileSprint = typeof agileSprints.$inferSelect;
export type InsertAgileSprint = z.infer<typeof insertAgileSprintSchema>;
export type UpdateAgileSprint = z.infer<typeof updateAgileSprintSchema>;

export type AgileEpic = typeof agileEpics.$inferSelect;
export type InsertAgileEpic = z.infer<typeof insertAgileEpicSchema>;
export type UpdateAgileEpic = z.infer<typeof updateAgileEpicSchema>;

export type AgileWorkItem = typeof agileWorkItems.$inferSelect;
export type InsertAgileWorkItem = z.infer<typeof insertAgileWorkItemSchema>;
export type UpdateAgileWorkItem = z.infer<typeof updateAgileWorkItemSchema>;

export type AgileWorkItemComment = typeof agileWorkItemComments.$inferSelect;
export type InsertAgileWorkItemComment = z.infer<typeof insertAgileWorkItemCommentSchema>;

export type AgileProjectMember = typeof agileProjectMembers.$inferSelect;
export type InsertAgileProjectMember = z.infer<typeof insertAgileProjectMemberSchema>;
export type UpdateAgileProjectMember = z.infer<typeof updateAgileProjectMemberSchema>;

