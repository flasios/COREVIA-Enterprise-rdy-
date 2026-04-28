/** @module demand — Schema owner. Only this module may write to these tables. */
/**
 * Schema domain: demand
 * Auto-extracted from shared/schema.ts
 */
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, json, jsonb, timestamp, boolean, index, unique, numeric, customType, date, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./platform";
// Cross-domain refs: portfolioProjects.id (logical only, no FK constraints)

// Define custom vector type for pgvector
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)'; // Anthropic embeddings are 1536 dimensions
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});


// Demand Reports Table for AI-powered demand analysis system
export const demandReports = pgTable("demand_reports", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Project Identity - AI-suggested for use in demand library and project conversion
  suggestedProjectName: text("suggested_project_name"), // AI-generated project name based on business objective
  projectId: varchar("project_id", { length: 30 }), // Auto-generated unique project identifier (e.g., PRJ-2024-001)
  decisionSpineId: text("decision_spine_id"),

  // Basic Information
  organizationName: text("organization_name").notNull(),
  industryType: varchar("industry_type", { length: 50 }), // government, semi-government, private-sector, public-private-partnership, non-profit
  requestorName: text("requestor_name").notNull(),
  requestorEmail: text("requestor_email").notNull(),
  department: text("department").notNull(),
  urgency: varchar("urgency", { length: 20 }).notNull(), // Low, Medium, High, Critical

  // Business Requirements
  businessObjective: text("business_objective").notNull(),
  currentChallenges: text("current_challenges"),
  expectedOutcomes: text("expected_outcomes"),
  successCriteria: text("success_criteria"),
  constraints: text("constraints"),

  // Resource Information
  currentCapacity: text("current_capacity"),
  budgetRange: text("budget_range"),
  timeframe: text("timeframe"),
  stakeholders: text("stakeholders"),

  // Technical Details
  existingSystems: text("existing_systems"),
  integrationRequirements: text("integration_requirements"),
  complianceRequirements: text("compliance_requirements"),
  riskFactors: text("risk_factors"),

  // AI Classification
  requestType: varchar("request_type", { length: 50 }), // demand, service, operation
  classificationConfidence: integer("classification_confidence"), // 0-100
  classificationReasoning: text("classification_reasoning"),

  // AI Analysis Results
  aiAnalysis: json("ai_analysis"), // Comprehensive AI analysis results
  estimatedBudget: text("estimated_budget"),
  estimatedTimeline: text("estimated_timeline"),
  requirementsAnalysis: json("requirements_analysis"), // Detailed requirements analysis with capabilities, functional/non-functional/security requirements
  enterpriseArchitectureAnalysis: json("enterprise_architecture_analysis"), // Enterprise architecture blueprint and governance cockpit artifact
  strategicFitAnalysis: json("strategic_fit_analysis"), // Strategic routing recommendations with decision criteria and confidence scores

  // UNIFIED STATUS SYSTEM - Single source of truth for demand workflow lifecycle
  // Demand Progression: generated → acknowledged → meeting_scheduled → under_review → approved → manager_approved (displayed as "Approved")
  // Terminal states: deferred, rejected, manager_approved
  // Note: Version status (draft → under_review → approved → published) is separate and tracked in report_versions table
  // This unified field replaces the old dual-status system (status + workflowStatus + businessCaseWorkflowStatus)
  workflowStatus: varchar("workflow_status", { length: 30 }).notNull().default("generated"),
  decisionReason: text("decision_reason"), // Explanation for status changes
  rejectionCategory: varchar("rejection_category", { length: 30 }), // Budget, Resource, Strategic, Technical, Timeline
  deferredUntil: timestamp("deferred_until"), // Future review date for deferred demands
  approvedBy: text("approved_by"), // Decision maker identification
  workflowHistory: json("workflow_history"), // JSON array of status changes with timestamps

  // Meeting and Notification Management
  meetingScheduled: boolean("meeting_scheduled").default(false), // Whether meeting has been scheduled
  meetingDate: timestamp("meeting_date"), // Scheduled meeting date
  meetingNotes: text("meeting_notes"), // Notes from the meeting
  notificationsSent: json("notifications_sent"), // JSON array of sent notifications with timestamps
  managerEmail: text("manager_email"), // Demand manager email for final approval

  // Ownership tracking for security
  createdBy: uuid("created_by").notNull().references(() => users.id),

  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),

  // Lifecycle Timestamps - Track every status transition
  submittedAt: timestamp("submitted_at"), // When demand was initially created/submitted
  acknowledgedAt: timestamp("acknowledged_at"), // When moved to acknowledged status
  meetingScheduledAt: timestamp("meeting_scheduled_at"), // When meeting was scheduled
  reviewStartedAt: timestamp("review_started_at"), // When under_review started
  approvedAt: timestamp("approved_at"), // When approved by director
  managerApprovedAt: timestamp("manager_approved_at"), // When final approval by manager
  completedAt: timestamp("completed_at"), // When project/demand fully completed
  rejectedAt: timestamp("rejected_at"), // When rejected
  deferredAt: timestamp("deferred_at"), // When deferred

  // Resource & Capacity Management
  allocatedResources: jsonb("allocated_resources"), // { teamMembers: [{userId, role, fte, startDate, endDate}], totalFTE: number }
  actualResourceUtilization: jsonb("actual_resource_utilization"), // { weeklyUtilization: [{week, actualFTE, variance}] }
  baselineCapacityFTE: numeric("baseline_capacity_fte", { precision: 10, scale: 2 }), // Total available FTE capacity

  // Budget Monitoring
  approvedBudget: numeric("approved_budget", { precision: 15, scale: 2 }), // Approved budget amount
  actualSpend: numeric("actual_spend", { precision: 15, scale: 2 }), // Actual spent amount
  budgetCurrency: varchar("budget_currency", { length: 10 }).default("AED"), // Currency code
  lastBudgetUpdate: timestamp("last_budget_update"), // When budget was last updated

  // Data Classification for LLM Routing
  // If not selected by user, AI will auto-classify based on content
  // Routes to sovereign/local AI for sensitive data, cloud AI for public data
  dataClassification: varchar("data_classification", { length: 30 }).default("auto"), // auto, public, internal, confidential, secret, top_secret
  dataClassificationConfidence: integer("data_classification_confidence"), // AI confidence in auto-classification (0-100)
  dataClassificationReasoning: text("data_classification_reasoning"), // AI explanation for auto-classification
  llmProvider: varchar("llm_provider", { length: 50 }), // anthropic, openai, falcon (sovereign), local

  // Synergy Detection - Embedding Cache for Performance Optimization
  embedding: vector("embedding"), // 1536 dimensions for cached embeddings - prevents 200+ API calls
}, (table) => ({
  projectIdUniqueIdx: unique("demand_reports_project_id_unique").on(table.projectId),
  decisionSpineIdIdx: index("demand_reports_decision_spine_idx").on(table.decisionSpineId),
  // Optimized composite indexes for workflow status queries
  workflowStatusCreatedAtIdx: index("demand_reports_workflow_created_at_idx").on(table.workflowStatus, table.createdAt),

  // Department and organization filtering
  organizationDeptIdx: index("demand_reports_org_dept_idx").on(table.organizationName, table.department),
  urgencyCreatedAtIdx: index("demand_reports_urgency_created_at_idx").on(table.urgency, table.createdAt),

  // Email lookups
  requestorEmailIdx: index("demand_reports_requestor_email_idx").on(table.requestorEmail),
}));

export const insertDemandReportSchema = createInsertSchema(demandReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
}).extend({
  organizationName: z.string().trim().min(1, "Organization name is required"),
  requestorName: z.string().trim().min(1, "Requestor name is required"),
  requestorEmail: z.string().trim().email("Valid email address is required"),
  department: z.string().trim().min(1, "Department is required"),
  urgency: z.string().trim().min(1, "Urgency is required"),
  businessObjective: z.string().trim().min(1, "Business objective is required"),
  // Add validation for industryType to prevent mismatches
  industryType: z.enum(['government', 'semi-government', 'public-private-partnership', 'private-sector', 'non-profit']).optional()
    .transform((val) => {
      // Handle legacy "private" value by converting to "private-sector"
      if (val && typeof val === 'string' && (val as string) === 'private') {
        console.warn('Converting legacy "private" industryType to "private-sector"');
        return 'private-sector' as const;
      }
      return val;
    }),
  // Accept string or number for classificationConfidence and convert to integer 0-100
  // AI may return 0.0-1.0 (fractional) or 0-100 (percentage) — normalize to integer 0-100
  classificationConfidence: z.union([
    z.number().transform((val) => {
      const normalized = val > 0 && val <= 1 ? Math.round(val * 100) : Math.round(val);
      return Math.max(0, Math.min(100, normalized));
    }),
    z.string().transform((val) => {
      const num = parseFloat(val);
      if (isNaN(num)) return 0;
      const normalized = num > 0 && num <= 1 ? Math.round(num * 100) : Math.round(num);
      return Math.max(0, Math.min(100, normalized));
    }),
  ]).optional(),
  // Explicitly handle suggestedProjectName - transform empty strings to null for proper database storage
  suggestedProjectName: z.string().optional().nullable().transform((val) => {
    if (val === '' || val === undefined) return null;
    return val;
  }),
  decisionSpineId: z.string().optional().nullable(),
});

export const updateDemandReportSchema = createInsertSchema(demandReports).partial().omit({
  id: true,
  createdAt: true,
}).extend({
  // Accept date strings for timestamp fields and convert to Date objects
  meetingDate: z.union([z.date(), z.string().transform((val) => new Date(val))]).optional(),
  deferredUntil: z.union([z.date(), z.string().transform((val) => new Date(val))]).optional(),
  updatedAt: z.union([z.date(), z.string().transform((val) => new Date(val))]).optional(),
  // Explicitly allow editing suggestedProjectName - properly optional with null handling
  suggestedProjectName: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().nullable().optional()
  ),
  decisionSpineId: z.string().optional().nullable(),
});

export type InsertDemandReport = z.infer<typeof insertDemandReportSchema>;
export type UpdateDemandReport = z.infer<typeof updateDemandReportSchema>;
export type DemandReport = typeof demandReports.$inferSelect;

// ============================================================================
// DEMAND CONVERSION REQUESTS - PMO Approval Workflow
// Tracks demands submitted for conversion to portfolio projects
// ============================================================================

export const demandConversionRequests = pgTable("demand_conversion_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Source Demand Reference
  demandId: uuid("demand_id").notNull().references(() => demandReports.id, { onDelete: "cascade" }),
  decisionSpineId: text("decision_spine_id"),

  // Conversion Request Details
  projectName: text("project_name").notNull(),
  projectDescription: text("project_description"),
  priority: varchar("priority", { length: 20 }).notNull().default("medium"), // critical, high, medium, low

  // Budget & Timeline (from conversion form)
  proposedBudget: numeric("proposed_budget", { precision: 15, scale: 2 }),
  budgetCurrency: varchar("budget_currency", { length: 10 }).default("AED"),
  proposedStartDate: date("proposed_start_date"),
  proposedEndDate: date("proposed_end_date"),

  // Requestor Information
  requestedBy: uuid("requested_by").references(() => users.id),
  requestedByName: text("requested_by_name"),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),

  // PMO Approval Status
  status: varchar("status", { length: 30 }).notNull().default("pending"), // pending, under_review, approved, rejected, deferred

  // PMO Reviewer Information
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedByName: text("reviewed_by_name"),
  reviewedAt: timestamp("reviewed_at"),

  // Approval/Rejection Details
  decisionNotes: text("decision_notes"),
  rejectionReason: text("rejection_reason"),
  deferredUntil: date("deferred_until"),

  // Additional Conversion Data (from the convert dialog)
  conversionData: jsonb("conversion_data"), // Stores form data from conversion dialog

  // Created Portfolio Project (only after approval)
  createdProjectId: uuid("created_project_id"), // Logical ref → portfolioProjects.id

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  demandIdIdx: index("demand_conversion_demand_id_idx").on(table.demandId),
  decisionSpineIdIdx: index("demand_conversion_decision_spine_idx").on(table.decisionSpineId),
  statusIdx: index("demand_conversion_status_idx").on(table.status),
  requestedAtIdx: index("demand_conversion_requested_at_idx").on(table.requestedAt),
}));

export const insertDemandConversionRequestSchema = createInsertSchema(demandConversionRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDemandConversionRequestSchema = createInsertSchema(demandConversionRequests).partial().omit({
  id: true,
  createdAt: true,
  decisionSpineId: true,
});

export type InsertDemandConversionRequest = z.infer<typeof insertDemandConversionRequestSchema>;
export type UpdateDemandConversionRequest = z.infer<typeof updateDemandConversionRequestSchema>;
export type DemandConversionRequest = typeof demandConversionRequests.$inferSelect;


// Professional Government-Grade Report Versioning System
// Comprehensive version management with semantic versioning and complete audit trail
export const reportVersions = pgTable("report_versions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Report Reference - preserving existing schema structure
  reportId: uuid("report_id").notNull().references(() => demandReports.id, { onDelete: "cascade" }),
  decisionSpineId: text("decision_spine_id"),

  // Semantic Versioning System
  versionNumber: varchar("version_number", { length: 20 }).notNull(), // v1.0, v1.1, v2.0, etc.
  majorVersion: integer("major_version").notNull(), // 1, 2, 3, etc.
  minorVersion: integer("minor_version").notNull(), // 0, 1, 2, etc.
  patchVersion: integer("patch_version").notNull().default(0), // 0, 1, 2, etc.

  // Parent-Child Version Relationships
  parentVersionId: varchar("parent_version_id"),
  baseVersionId: varchar("base_version_id"), // Original version this was derived from

  // Version Status Management
  status: varchar("status", { length: 30 }).notNull().default("draft"),
  // draft, under_review, approved, published, archived, rejected, superseded

  // Version Type - distinguishes what content this version contains
  versionType: varchar("version_type", { length: 30 }).notNull().default("business_case").$type<"business_case" | "requirements" | "enterprise_architecture" | "strategic_fit" | "both">(),
  // business_case, requirements, enterprise_architecture, strategic_fit, both

  // Comprehensive Version Content
  versionData: json("version_data").notNull(), // Complete report data snapshot
  versionMetadata: json("version_metadata"), // Additional metadata, configurations, etc.

  // Team Assignments for Requirements Sections
  teamAssignments: json("team_assignments"), // Maps section names to assigned team/user info

  // Change Management
  changesSummary: text("changes_summary").notNull(), // Summary of changes made in this version
  changesDetails: json("changes_details"), // Detailed diff/change log in structured format
  editReason: text("edit_reason"), // Reason for creating this version

  // Government Audit Trail Requirements
  createdBy: varchar("created_by", { length: 100 }).notNull(), // User ID who created this version
  createdByName: text("created_by_name").notNull(), // Full name for audit trail
  createdByRole: varchar("created_by_role", { length: 50 }), // User role for compliance
  createdByDepartment: text("created_by_department"), // Department for organizational tracking

  // Approval Workflow Integration
  reviewedBy: varchar("reviewed_by", { length: 100 }), // User ID who reviewed
  reviewedByName: text("reviewed_by_name"), // Full name of reviewer
  reviewedAt: timestamp("reviewed_at"), // When review was completed
  reviewComments: text("review_comments"), // Review feedback

  approvedBy: varchar("approved_by", { length: 100 }), // User ID who approved
  approvedByName: text("approved_by_name"), // Full name of approver
  approvedAt: timestamp("approved_at"), // When approval was granted
  approvalComments: text("approval_comments"), // Approval notes

  publishedBy: varchar("published_by", { length: 100 }), // User ID who published
  publishedByName: text("published_by_name"), // Full name of publisher
  publishedAt: timestamp("published_at"), // When version was published

  rejectedBy: varchar("rejected_by", { length: 100 }), // User ID who rejected
  rejectedByName: text("rejected_by_name"), // Full name of rejector
  rejectedAt: timestamp("rejected_at"), // When version was rejected
  rejectionReason: text("rejection_reason"), // Reason for rejection

  // Data Retention and Compliance
  retentionPolicy: varchar("retention_policy", { length: 50 }).default("standard"), // standard, extended, permanent
  complianceFlags: json("compliance_flags"), // Compliance requirements and status
  dataClassification: varchar("data_classification", { length: 30 }).default("internal"), // public, internal, confidential, restricted

  // Version Integrity and Validation
  contentHash: varchar("content_hash", { length: 128 }), // SHA-256 hash of version content for integrity
  validationStatus: varchar("validation_status", { length: 30 }).default("pending"), // pending, validated, failed
  validationErrors: json("validation_errors"), // Any validation issues found

  // Workflow State Management
  workflowStep: varchar("workflow_step", { length: 50 }).default("created"), // created, review, approval, publication
  workflowHistory: json("workflow_history"), // Complete workflow state transitions
  nextReviewDate: timestamp("next_review_date"), // Scheduled review date for compliance

  // Professional Timestamps
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  effectiveAt: timestamp("effective_at"), // When this version becomes effective
  expiresAt: timestamp("expires_at"), // When this version expires (if applicable)

  // Version Branching System - Advanced branching and merging capabilities
  branchId: varchar("branch_id"), // Reference to version branch (nullable for main branch)
  originVersionId: varchar("origin_version_id"), // Version this was branched from (nullable)
  isMergeVersion: boolean("is_merge_version").notNull().default(false), // True if this version was created by merging branches
}, (table) => ({
  // Critical composite indexes matching actual query patterns
  reportIdStatusIdx: index("report_versions_report_status_idx").on(table.reportId, table.status),
  decisionSpineIdIdx: index("report_versions_decision_spine_idx").on(table.decisionSpineId),

  // Optimized semantic versioning index with ORDER BY support
  semanticVersionOrderIdx: index("report_versions_semantic_order_idx").on(table.reportId, table.majorVersion, table.minorVersion, table.patchVersion),

  // UNIQUE constraint for semantic version integrity
  uniqueSemanticVersionIdx: unique("report_versions_unique_semantic").on(table.reportId, table.majorVersion, table.minorVersion, table.patchVersion),

  // Version hierarchy (parent-child relationships)
  parentVersionIdx: index("report_versions_parent_idx").on(table.parentVersionId),

  // Workflow tracking
  workflowCreatedIdx: index("report_versions_workflow_created_idx").on(table.workflowStep, table.createdAt),

  // User activity tracking
  createdByDateIdx: index("report_versions_creator_date_idx").on(table.createdBy, table.createdAt),
}));

// Report Version Audit Log for comprehensive tracking
export const versionAuditLogs = pgTable("version_audit_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // References
  versionId: uuid("version_id").notNull().references(() => reportVersions.id, { onDelete: "cascade" }),
  reportId: uuid("report_id").notNull().references(() => demandReports.id, { onDelete: "cascade" }),

  // Audit Information
  action: varchar("action", { length: 50 }).notNull(), // created, updated, approved, published, archived, etc.
  actionDescription: text("action_description").notNull(), // Detailed description of the action
  previousState: json("previous_state"), // State before the action
  newState: json("new_state"), // State after the action

  // User Attribution for Government Compliance
  performedBy: varchar("performed_by", { length: 100 }).notNull(), // User ID
  performedByName: text("performed_by_name").notNull(), // Full name
  performedByRole: varchar("performed_by_role", { length: 50 }), // Role
  performedByDepartment: text("performed_by_department"), // Department
  sessionId: varchar("session_id", { length: 100 }), // Session tracking
  ipAddress: varchar("ip_address", { length: 45 }), // IP address for security audit
  userAgent: text("user_agent"), // Browser user agent for audit tracking

  // Compliance and Security
  complianceLevel: varchar("compliance_level", { length: 30 }).default("standard"), // standard, high, critical
  securityFlags: json("security_flags"), // Any security-related flags

  // Timestamps
  performedAt: timestamp("performed_at").notNull().default(sql`now()`),
}, (table) => ({
  // Optimized composite indexes for audit queries
  versionIdPerformedAtIdx: index("audit_logs_version_performed_idx").on(table.versionId, table.performedAt),
  reportIdPerformedAtIdx: index("audit_logs_report_performed_idx").on(table.reportId, table.performedAt),

  // User activity with date ranges
  userActionDateIdx: index("audit_logs_user_action_date_idx").on(table.performedBy, table.action, table.performedAt),

  // Action-based queries with date sorting
  actionPerformedAtIdx: index("audit_logs_action_performed_idx").on(table.action, table.performedAt),
}));

// Zod Schemas for Version Management
export const insertReportVersionSchema = createInsertSchema(reportVersions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  contentHash: true, // Generated automatically
  validationStatus: true, // Set by system
}).extend({
  // Additional validation rules for government compliance
  versionNumber: z.string().regex(/^v\d+\.\d+(\.\d+)?$/, "Version number must follow semantic versioning (v1.0, v1.1, v2.0)"),
  changesSummary: z.string().min(10, "Changes summary must be at least 10 characters"),
  createdBy: z.string().min(1, "Created by is required"),
  createdByName: z.string().min(2, "Creator name must be at least 2 characters"),
  editReason: z.string().min(5, "Edit reason must be at least 5 characters").optional(),
  versionType: z.enum(["business_case", "requirements", "enterprise_architecture", "strategic_fit", "both"]).default("business_case"),
  decisionSpineId: z.string().optional().nullable(),
});

export const updateReportVersionSchema = createInsertSchema(reportVersions).partial().omit({
  id: true,
  reportId: true, // Cannot change report association
  createdAt: true,
  createdBy: true, // Cannot change creator
  createdByName: true,
  majorVersion: true, // Cannot change version numbers after creation
  minorVersion: true,
  patchVersion: true,
  versionNumber: true,
  contentHash: true,
  decisionSpineId: true,
});

export const insertVersionAuditLogSchema = createInsertSchema(versionAuditLogs).omit({
  id: true,
  performedAt: true,
});

export type InsertReportVersion = z.infer<typeof insertReportVersionSchema>;
export type UpdateReportVersion = z.infer<typeof updateReportVersionSchema>;
export type ReportVersion = typeof reportVersions.$inferSelect;
export type InsertVersionAuditLog = z.infer<typeof insertVersionAuditLogSchema>;
export type VersionAuditLog = typeof versionAuditLogs.$inferSelect;

// ============================================================================
// VERSION ACTIVITY TRACKING - Real-time Collaboration
// Track who is viewing/editing versions in real-time for collaboration indicators
// ============================================================================

export const versionActivity = pgTable("version_activity", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // References
  versionId: uuid("version_id").notNull().references(() => reportVersions.id, { onDelete: "cascade" }),
  reportId: uuid("report_id").notNull().references(() => demandReports.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Activity Type
  activityType: varchar("activity_type", { length: 20 }).notNull(), // 'viewing', 'editing'

  // Timestamps
  startedAt: timestamp("started_at").notNull().default(sql`now()`),
  endedAt: timestamp("ended_at"), // null means still active

  // Session Information
  sessionId: varchar("session_id", { length: 100 }), // Browser session ID for tracking
  lastHeartbeat: timestamp("last_heartbeat"), // Track user activity heartbeat

}, (table) => ({
  // Active sessions per version (where endedAt is null)
  versionActiveIdx: index("version_activity_version_active_idx").on(table.versionId, table.endedAt),

  // User activity history
  userActivityIdx: index("version_activity_user_idx").on(table.userId, table.startedAt),

  // Report-wide activity
  reportActivityIdx: index("version_activity_report_idx").on(table.reportId, table.startedAt),
}));

export const insertVersionActivitySchema = createInsertSchema(versionActivity).omit({
  id: true,
  startedAt: true,
});

export type InsertVersionActivity = z.infer<typeof insertVersionActivitySchema>;
export type VersionActivity = typeof versionActivity.$inferSelect;

// ============================================================================
// ADVANCED VERSION BRANCHING SYSTEM
// Multi-branch version management with merge capabilities
// ============================================================================

// Version Branches - Main branching table
export const versionBranches = pgTable("version_branches", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Report Reference
  reportId: uuid("report_id").notNull().references(() => demandReports.id, { onDelete: "cascade" }),

  // Branch Identification
  name: text("name").notNull(), // e.g., "Q4 Budget Revision", "Security Review"
  description: text("description"), // Optional description of branch purpose

  // Branch Status
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, merged, abandoned

  // Branch Hierarchy
  parentBranchId: varchar("parent_branch_id"), // Self-reference for branch hierarchy (nullable)

  // Latest Version Reference
  headVersionId: varchar("head_version_id"), // Latest version in this branch (nullable)

  // Access Control
  createdBy: uuid("created_by").notNull().references(() => users.id),
  accessControl: jsonb("access_control"), // Array of user IDs with access to this branch

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Indexes for performance
  reportIdIdx: index("version_branches_report_id_idx").on(table.reportId),
  statusIdx: index("version_branches_status_idx").on(table.status),
  parentBranchIdx: index("version_branches_parent_idx").on(table.parentBranchId),
  createdByIdx: index("version_branches_created_by_idx").on(table.createdBy),
}));

// Branch Merges - Track merge history and conflicts
export const branchMerges = pgTable("branch_merges", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Branch References
  sourceBranchId: uuid("source_branch_id").notNull().references(() => versionBranches.id, { onDelete: "cascade" }),
  targetBranchId: uuid("target_branch_id").notNull().references(() => versionBranches.id, { onDelete: "cascade" }),

  // Merge Result
  mergedVersionId: varchar("merged_version_id"), // Resulting merged version (nullable until completed)

  // Merge Status
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, in_progress, completed, cancelled, conflicted

  // Conflict Management
  conflicts: jsonb("conflicts"), // Field-level conflict data
  resolutions: jsonb("resolutions"), // How conflicts were resolved

  // Merge Attribution
  mergedBy: uuid("merged_by").notNull().references(() => users.id),
  mergedAt: timestamp("merged_at"), // When merge was completed (nullable until done)

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Indexes for performance
  sourceBranchIdx: index("branch_merges_source_idx").on(table.sourceBranchId),
  targetBranchIdx: index("branch_merges_target_idx").on(table.targetBranchId),
  statusIdx: index("branch_merges_status_idx").on(table.status),
  mergedByIdx: index("branch_merges_merged_by_idx").on(table.mergedBy),
}));

// Zod Schemas for Version Branches
export const insertVersionBranchSchema = createInsertSchema(versionBranches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Branch name is required"),
  description: z.string().optional(),
  status: z.enum(["active", "merged", "abandoned"]).default("active"),
  parentBranchId: z.string().optional(),
  headVersionId: z.string().optional(),
  accessControl: z.array(z.string()).optional(),
});

export const updateVersionBranchSchema = createInsertSchema(versionBranches).partial().omit({
  id: true,
  reportId: true,
  createdBy: true,
  createdAt: true,
}).extend({
  name: z.string().min(1, "Branch name is required").optional(),
  status: z.enum(["active", "merged", "abandoned"]).optional(),
});

export type InsertVersionBranch = z.infer<typeof insertVersionBranchSchema>;
export type UpdateVersionBranch = z.infer<typeof updateVersionBranchSchema>;
export type VersionBranch = typeof versionBranches.$inferSelect;

// Zod Schemas for Branch Merges
export const insertBranchMergeSchema = createInsertSchema(branchMerges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(["pending", "in_progress", "completed", "cancelled", "conflicted"]).default("pending"),
  mergedVersionId: z.string().optional(),
  mergedAt: z.union([z.date(), z.string().transform((val) => new Date(val))]).optional(),
});

export const updateBranchMergeSchema = createInsertSchema(branchMerges).partial().omit({
  id: true,
  sourceBranchId: true,
  targetBranchId: true,
  mergedBy: true,
  createdAt: true,
}).extend({
  status: z.enum(["pending", "in_progress", "completed", "cancelled", "conflicted"]).optional(),
  mergedAt: z.union([z.date(), z.string().transform((val) => new Date(val))]).optional(),
});

export type InsertBranchMerge = z.infer<typeof insertBranchMergeSchema>;
export type UpdateBranchMerge = z.infer<typeof updateBranchMergeSchema>;
export type BranchMerge = typeof branchMerges.$inferSelect;

// ============================================================================
// AI BUSINESS CASE GENERATION SYSTEM
// Professional business case generation with full traceability and AI analysis
// ============================================================================

// Multi-Agent Orchestration Metadata Interface
export interface MultiAgentMetadata {
  executiveSummary: string;
  agents: Array<{
    domain: string;
    confidence: number;
    citationCount: number;
  }>;
  conflicts: Array<{
    field: string;
    type: 'direct_contradiction' | 'value_mismatch' | 'divergence';
    agents: string[];
    values: unknown[];
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  aggregatedConfidence: number;
}

// Main Business Case Table
export const businessCases = pgTable("business_cases", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Link to parent demand report
  demandReportId: uuid("demand_report_id").notNull().references(() => demandReports.id, { onDelete: "cascade" }),
  decisionSpineId: text("decision_spine_id"),

  // Generation Metadata
  generatedAt: timestamp("generated_at").notNull().default(sql`now()`),
  generatedBy: varchar("generated_by", { length: 100 }).notNull(),
  generationMethod: varchar("generation_method", { length: 50 }).notNull().default("ai_full"), // ai_full, ai_assisted, manual
  aiModel: varchar("ai_model", { length: 50 }), // gpt-4, claude-3, etc.
  lastUpdated: timestamp("last_updated").notNull().default(sql`now()`), // Optimistic locking for concurrent edits

  // Background & Context
  backgroundContext: text("background_context"),
  backgroundContextSource: json("background_context_source"),

  // Problem Statement & Opportunity
  problemStatement: text("problem_statement"),
  problemStatementSource: json("problem_statement_source"),

  // Objectives & Scope
  smartObjectives: json("smart_objectives"), // SMART objectives array
  scopeDefinition: json("scope_definition"), // In-scope and out-of-scope
  expectedDeliverables: json("expected_deliverables"),
  objectivesScopeSource: json("objectives_scope_source"),

  // Executive Summary
  executiveSummary: text("executive_summary").notNull(),
  executiveSummarySource: json("executive_summary_source"), // Traceability to source fields

  // Business Requirements
  businessRequirements: text("business_requirements").notNull(),
  businessRequirementsSource: json("business_requirements_source"),

  // Solution Overview
  solutionOverview: text("solution_overview").notNull(),
  solutionOverviewSource: json("solution_overview_source"),
  proposedSolution: text("proposed_solution").notNull(),
  alternativeSolutions: json("alternative_solutions"), // Array of alternative approaches

  // Financial Analysis - Core Metrics
  totalCostEstimate: numeric("total_cost_estimate", { precision: 15, scale: 2 }).notNull(), // in currency units
  totalBenefitEstimate: numeric("total_benefit_estimate", { precision: 15, scale: 2 }).notNull(),

  // ROI Calculation
  roiPercentage: numeric("roi_percentage", { precision: 10, scale: 2 }).notNull(), // Return on Investment %
  roiCalculation: json("roi_calculation").notNull(), // Detailed calculation breakdown

  // NPV Calculation
  npvValue: numeric("npv_value", { precision: 15, scale: 2 }).notNull(), // Net Present Value
  npvCalculation: json("npv_calculation").notNull(), // Discount rate, cash flows, etc.
  discountRate: numeric("discount_rate", { precision: 5, scale: 2 }).notNull(), // Percentage (e.g., 10.5 = 10.5%)

  // Payback Period
  paybackMonths: numeric("payback_months", { precision: 10, scale: 2 }), // Time to recover investment (can be fractional, null if never payback)
  paybackCalculation: json("payback_calculation").notNull(),

  // Total Cost of Ownership
  tcoBreakdown: json("tco_breakdown").notNull(), // Implementation, operational, maintenance costs
  tcoTimeframe: integer("tco_timeframe").notNull().default(36), // Months (default 3 years)

  // Cost-Benefit Details
  implementationCosts: json("implementation_costs").notNull(), // Itemized costs
  operationalCosts: json("operational_costs").notNull(),
  benefitsBreakdown: json("benefits_breakdown").notNull(), // Tangible and intangible
  costSavings: json("cost_savings"), // Expected savings
  detailedCosts: json("detailed_costs"), // Decision-grade cost line items with yearly breakdown
  detailedBenefits: json("detailed_benefits"), // Decision-grade benefit line items with yearly breakdown

  // Financial Sources
  financialAnalysisSource: json("financial_analysis_source"),

  // Risk Assessment
  riskLevel: varchar("risk_level", { length: 20 }).notNull(), // low, medium, high, critical
  riskScore: integer("risk_score").notNull(), // 1-100
  identifiedRisks: json("identified_risks").notNull(), // Array of risks with severity
  mitigationStrategies: json("mitigation_strategies").notNull(), // Mitigation plans
  contingencyPlans: json("contingency_plans"),
  riskMatrixData: json("risk_matrix_data"), // For visualization
  riskAnalysisSource: json("risk_analysis_source"),

  // Implementation Plan
  implementationPhases: json("implementation_phases").notNull(), // Phased approach
  timeline: json("timeline").notNull(), // Gantt chart data
  milestones: json("milestones").notNull(), // Key milestones
  resourceRequirements: json("resource_requirements").notNull(), // Personnel, equipment
  dependencies: json("dependencies"), // Critical dependencies
  implementationPlanSource: json("implementation_plan_source"),

  // KPIs & Success Metrics
  kpis: json("kpis").notNull(), // Key Performance Indicators
  successCriteria: json("success_criteria").notNull(), // Measurable success criteria
  performanceTargets: json("performance_targets").notNull(), // Target values
  measurementPlan: json("measurement_plan"), // How to track KPIs
  kpisSource: json("kpis_source"),

  // Compliance & Governance
  complianceRequirements: json("compliance_requirements"), // Regulatory compliance
  governanceFramework: json("governance_framework"), // Governance structure
  policyReferences: json("policy_references"), // Referenced policies
  auditRequirements: json("audit_requirements"),
  complianceSource: json("compliance_source"),

  // Strategic Alignment
  strategicObjectives: json("strategic_objectives"), // How it aligns with org strategy
  departmentImpact: json("department_impact"), // Impact on departments
  organizationalBenefits: json("organizational_benefits"),
  strategicAlignmentSource: json("strategic_alignment_source"),

  // Stakeholder Analysis
  stakeholderAnalysis: json("stakeholder_analysis"), // Key stakeholders and roles
  communicationPlan: json("communication_plan"), // Engagement strategy
  stakeholderAnalysisSource: json("stakeholder_analysis_source"),

  // Assumptions & Dependencies
  keyAssumptions: json("key_assumptions"), // Critical assumptions
  projectDependencies: json("project_dependencies"), // Dependencies on other projects
  assumptionsDependenciesSource: json("assumptions_dependencies_source"),

  // Recommendations & Conclusion
  recommendations: json("recommendations"), // Final recommendations (enriched object)
  conclusionSummary: text("conclusion_summary"), // Summary of findings
  nextSteps: json("next_steps"), // Action items
  recommendationsSource: json("recommendations_source"),

  // Status & Workflow
  status: varchar("status", { length: 30 }).notNull().default("draft"), // draft, review, approved, published
  approvalStatus: varchar("approval_status", { length: 30 }).default("pending"), // pending, approved, rejected
  approvedBy: varchar("approved_by", { length: 100 }),
  approvedAt: timestamp("approved_at"),

  // Quality & Validation
  validationStatus: varchar("validation_status", { length: 30 }).default("pending"),
  validationErrors: json("validation_errors"),
  qualityScore: integer("quality_score"), // 0-100

  // Multi-Agent Orchestration Metadata
  multiAgentMetadata: jsonb("multi_agent_metadata"), // Metadata from multi-agent orchestration

  // Phase 2 Intelligence - Clarifications System
  clarifications: jsonb("clarifications"), // Array of clarification questions for missing data
  completenessScore: integer("completeness_score"), // 0-100 data completeness percentage
  clarificationResponses: jsonb("clarification_responses"), // User-provided answers to clarification questions

  // Quality Validation Report
  qualityReport: jsonb("quality_report"), // Full quality validation report with checks and scores

  // Financial Model Parameters (persisted for financial editor)
  financialAssumptions: jsonb("financial_assumptions"), // User-editable financial assumptions
  domainParameters: jsonb("domain_parameters"), // Domain-specific cost parameters
  aiRecommendedBudget: numeric("ai_recommended_budget", { precision: 15, scale: 2 }), // AI recommended budget for comparison
  computedFinancialModel: jsonb("computed_financial_model"), // Cached computed financial model (NPV, IRR, ROI, decision, etc.)

  // AI-Generated Market Research (persisted to avoid regeneration)
  marketResearch: jsonb("market_research"), // COREVIA market intelligence data
  marketResearchGeneratedAt: timestamp("market_research_generated_at"), // When research was generated

  // Timestamps
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => ({
  demandReportIdx: index("business_cases_demand_report_idx").on(table.demandReportId),
  decisionSpineIdIdx: index("business_cases_decision_spine_idx").on(table.decisionSpineId),
  statusIdx: index("business_cases_status_idx").on(table.status),
  approvalStatusIdx: index("business_cases_approval_idx").on(table.approvalStatus),
}));

// Zod Schemas for Business Cases with proper numeric validation
export const insertBusinessCaseSchema = createInsertSchema(businessCases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  generatedAt: true,
}).extend({
  // Financial fields - numeric types map to strings in Drizzle, validate as numeric strings
  totalCostEstimate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid number with up to 2 decimal places"),
  totalBenefitEstimate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid number with up to 2 decimal places"),
  roiPercentage: z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Must be a valid percentage with up to 2 decimal places"),
  npvValue: z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Must be a valid number with up to 2 decimal places"),
  discountRate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid percentage with up to 2 decimal places"),
  paybackMonths: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid number with up to 2 decimal places").optional().nullable(),
  // Multi-Agent Metadata - optional
  multiAgentMetadata: z.custom<MultiAgentMetadata>().optional(),
  decisionSpineId: z.string().optional().nullable(),
});

export const updateBusinessCaseSchema = createInsertSchema(businessCases).partial().omit({
  id: true,
  demandReportId: true,
  createdAt: true,
  updatedAt: true,
  generatedAt: true,
  lastUpdated: true, // System-managed timestamp for optimistic locking
}).extend({
  // Financial fields validation for updates (optional since .partial())
  totalCostEstimate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid number with up to 2 decimal places").optional(),
  totalBenefitEstimate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid number with up to 2 decimal places").optional(),
  roiPercentage: z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Must be a valid percentage with up to 2 decimal places").optional(),
  npvValue: z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Must be a valid number with up to 2 decimal places").optional(),
  discountRate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid percentage with up to 2 decimal places").optional(),
  paybackMonths: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid number with up to 2 decimal places").optional().nullable(),
  // Multi-Agent Metadata - optional
  multiAgentMetadata: z.custom<MultiAgentMetadata>().optional(),
  decisionSpineId: z.string().optional().nullable(),
});

export type InsertBusinessCase = z.infer<typeof insertBusinessCaseSchema>;
export type UpdateBusinessCase = z.infer<typeof updateBusinessCaseSchema>;
export type BusinessCase = typeof businessCases.$inferSelect;

// Clarification Response validation schema
export const clarificationResponseSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
  questionId: z.number().int().nonnegative("Question ID must be a non-negative integer"),
  answer: z.string().min(1, "Answer is required"),
});

export const submitClarificationsSchema = z.object({
  responses: z.array(clarificationResponseSchema).min(1, "At least one response is required"),
});

export type ClarificationResponse = z.infer<typeof clarificationResponseSchema>;
export type SubmitClarificationsInput = z.infer<typeof submitClarificationsSchema>;

// ============================================================================
// FIELD-LEVEL ACCESS CONTROL - Requirements Section Management
// ============================================================================

// Define all editable sections in Detailed Requirements
export const REQUIREMENTS_SECTIONS = {
  CAPABILITIES: 'capabilities',
  CAPABILITY_GAPS: 'capabilityGaps',
  FUNCTIONAL: 'functionalRequirements',
  NON_FUNCTIONAL: 'nonFunctionalRequirements',
  SECURITY: 'securityRequirements',
  PHASE_PLAN: 'phasePlan',
  INTEGRATIONS: 'integrations',
  OPERATIONS: 'operationalRequirements',
  DATA_REQUIREMENTS: 'dataRequirements',
  BUSINESS_OUTCOMES: 'businessOutcomes',
  TRACEABILITY: 'traceabilityMatrix',
  PLANNING_BOUNDS: 'assumptionsConstraints',
  RECOMMENDATIONS: 'worldClassRecommendations',
  RESOURCES: 'requiredResources',
  EFFORT: 'estimatedEffort',
  ROLES: 'rolesAndResponsibilities',
  TECHNOLOGY: 'requiredTechnology',
} as const;

export type RequirementsSection = typeof REQUIREMENTS_SECTIONS[keyof typeof REQUIREMENTS_SECTIONS];

// Teams table - for grouping users into teams for section assignments
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: varchar("color", { length: 7 }), // Hex color code for UI badges (e.g., #3B82F6)
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
}).extend({
  name: z.string().min(2, "Team name must be at least 2 characters"),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Color must be a valid hex code").optional(),
});

export const updateTeamSchema = createInsertSchema(teams).partial().omit({
  id: true,
  createdAt: true,
  createdBy: true,
}).extend({
  name: z.string().min(2, "Team name must be at least 2 characters").optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Color must be a valid hex code").optional(),
});

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type UpdateTeam = z.infer<typeof updateTeamSchema>;
export type Team = typeof teams.$inferSelect;

// Team Members table - many-to-many relationship between teams and users
export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull().default("member"), // 'member' or 'lead'
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
}, (table) => ({
  // Unique constraint: a user can only be in a team once
  uniqueTeamUser: unique("team_members_unique_team_user").on(table.teamId, table.userId),
  // Indexes for efficient queries
  teamIdIdx: index("team_members_team_id_idx").on(table.teamId),
  userIdIdx: index("team_members_user_id_idx").on(table.userId),
}));

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  joinedAt: true,
}).extend({
  role: z.enum(["member", "lead"]).default("member"),
  addedBy: z.string().optional(),
});

export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;

// Section Assignments table - assigns requirement sections to teams or individual users
export const sectionAssignments = pgTable("section_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: uuid("report_id").notNull().references(() => demandReports.id, { onDelete: "cascade" }),
  sectionName: varchar("section_name", { length: 50 }).notNull(), // One of REQUIREMENTS_SECTIONS
  assignedToTeamId: uuid("assigned_to_team_id").references(() => teams.id, { onDelete: "set null" }),
  assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
  assignedBy: uuid("assigned_by").notNull().references(() => users.id),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  status: varchar("status", { length: 30 }).notNull().default("pending_confirmation"), // pending_confirmation, in_progress, under_review, completed
  notes: text("notes"),
  issues: text("issues"),
  risks: text("risks"),
  challenges: text("challenges"),
  statusUpdatedAt: timestamp("status_updated_at"),
  statusUpdatedBy: uuid("status_updated_by").references(() => users.id),
}, (table) => ({
  // Unique constraint: each section can only be assigned once per report
  uniqueReportSection: unique("section_assignments_unique_report_section").on(table.reportId, table.sectionName),
  // Indexes for efficient queries
  reportIdIdx: index("section_assignments_report_id_idx").on(table.reportId),
  sectionNameIdx: index("section_assignments_section_name_idx").on(table.sectionName),
  teamIdIdx: index("section_assignments_team_id_idx").on(table.assignedToTeamId),
  userIdIdx: index("section_assignments_user_id_idx").on(table.assignedToUserId),
  statusIdx: index("section_assignments_status_idx").on(table.status),
}));

export const insertSectionAssignmentSchema = createInsertSchema(sectionAssignments).omit({
  id: true,
  assignedAt: true,
  assignedBy: true,
  statusUpdatedAt: true,
  statusUpdatedBy: true,
}).extend({
  sectionName: z.string().min(1, "Section name is required"),
  status: z.enum(["pending_confirmation", "in_progress", "under_review", "completed"]).optional(),
  notes: z.string().optional(),
  issues: z.string().optional(),
  risks: z.string().optional(),
  challenges: z.string().optional(),
});

export const updateSectionAssignmentSchema = createInsertSchema(sectionAssignments).partial().omit({
  id: true,
  reportId: true,
  sectionName: true,
  assignedAt: true,
  assignedBy: true,
}).extend({
  status: z.enum(["pending_confirmation", "in_progress", "under_review", "completed"]).optional(),
  notes: z.string().optional(),
  issues: z.string().optional(),
  risks: z.string().optional(),
  challenges: z.string().optional(),
});

export type InsertSectionAssignment = z.infer<typeof insertSectionAssignmentSchema>;
export type UpdateSectionAssignment = z.infer<typeof updateSectionAssignmentSchema>;
export type SectionAssignment = typeof sectionAssignments.$inferSelect;
