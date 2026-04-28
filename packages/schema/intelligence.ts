/** @module intelligence — Schema owner. Only this module may write to these tables. */
/**
 * Schema domain: intelligence
 * Auto-extracted from shared/schema.ts
 */
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp, boolean, index, unique, numeric, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
// Cross-domain refs: demandReports.id, businessCases.id (logical only, no FK constraints)
import { users } from "./platform";

// ============================================================================
// HIGH-IMPACT FEATURES - Advanced AI-Powered Demand Management
// Cross-Department Synergy, Innovation Recommender, Portfolio Optimizer, Tender Generator
// ============================================================================

// 1. Synergy Opportunities - Cross-Department Synergy Detector
export const synergyOpportunities = pgTable("synergy_opportunities", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  primaryDemandId: uuid("primary_demand_id").notNull(), // Logical ref → demandReports.id
  relatedDemandIds: varchar("related_demand_ids").array().notNull(), // Array of demand report IDs
  similarityScore: numeric("similarity_score", { precision: 5, scale: 2 }).notNull(), // 0-100
  estimatedSavings: numeric("estimated_savings", { precision: 15, scale: 2 }), // in AED
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, validated, merged, archived
  recommendation: jsonb("recommendation").notNull(), // { summary, consolidationPlan, benefits, risks }
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  validatedBy: uuid("validated_by").references(() => users.id),
  validatedAt: timestamp("validated_at"),
}, (table) => ({
  primaryDemandIdx: index("synergy_primary_demand_idx").on(table.primaryDemandId),
  statusIdx: index("synergy_status_idx").on(table.status),
}));

export const insertSynergyOpportunitySchema = createInsertSchema(synergyOpportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSynergyOpportunity = z.infer<typeof insertSynergyOpportunitySchema>;
export type SynergyOpportunity = typeof synergyOpportunities.$inferSelect;

// 2. Innovation Templates & Recommendations - AI Innovation Recommender
export const innovationTemplates = pgTable("innovation_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sector: varchar("sector", { length: 100 }).notNull(), // government, healthcare, transport, etc.
  technologyTags: varchar("technology_tags").array().notNull(), // [AI, IoT, blockchain, etc.]
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  roiPercentage: numeric("roi_percentage", { precision: 10, scale: 2 }),
  sourceUrl: text("source_url"),
  caseStudy: jsonb("case_study"), // { country, implementation, results, lessons }
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  sectorIdx: index("innovation_sector_idx").on(table.sector),
}));

export const innovationRecommendations = pgTable("innovation_recommendations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  demandReportId: uuid("demand_report_id").notNull(), // Logical ref → demandReports.id
  templateId: uuid("template_id").references(() => innovationTemplates.id),
  generatedBy: varchar("generated_by", { length: 20 }).notNull().default("ai"), // ai or analyst
  recommendation: jsonb("recommendation").notNull(), // { title, description, benefits, implementation }
  feasibilityScore: numeric("feasibility_score", { precision: 5, scale: 2 }), // 0-100
  impactScore: numeric("impact_score", { precision: 5, scale: 2 }), // 0-100
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
}, (table) => ({
  demandIdx: index("innovation_demand_idx").on(table.demandReportId),
}));

export const insertInnovationTemplateSchema = createInsertSchema(innovationTemplates).omit({
  id: true,
  createdAt: true
});

export const insertInnovationRecommendationSchema = createInsertSchema(innovationRecommendations).omit({
  id: true,
  createdAt: true
});

export type InsertInnovationTemplate = z.infer<typeof insertInnovationTemplateSchema>;
export type InsertInnovationRecommendation = z.infer<typeof insertInnovationRecommendationSchema>;
export type InnovationTemplate = typeof innovationTemplates.$inferSelect;
export type InnovationRecommendation = typeof innovationRecommendations.$inferSelect;

// 3. Portfolio Optimizer - Strategic Portfolio Management
export const portfolioRuns = pgTable("portfolio_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  triggeredBy: uuid("triggered_by").notNull().references(() => users.id),
  constraintSnapshot: jsonb("constraint_snapshot").notNull(), // { totalBudget, resourceCapacity, strategicPriorities }
  totalBudget: numeric("total_budget", { precision: 15, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, complete, failed
  results: jsonb("results"), // { approvedCount, deferredCount, rejectedCount, totalROI, alignmentScore }
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  triggeredByIdx: index("portfolio_triggered_by_idx").on(table.triggeredBy),
  statusIdx: index("portfolio_status_idx").on(table.status),
}));

export const portfolioRecommendations = pgTable("portfolio_recommendations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: uuid("run_id").notNull().references(() => portfolioRuns.id, { onDelete: "cascade" }),
  demandReportId: uuid("demand_report_id").notNull(), // Logical ref → demandReports.id
  decision: varchar("decision", { length: 20 }).notNull(), // approve, defer, reject
  expectedRoi: numeric("expected_roi", { precision: 10, scale: 2 }),
  riskScore: numeric("risk_score", { precision: 5, scale: 2 }), // 0-100
  alignmentScore: numeric("alignment_score", { precision: 5, scale: 2 }), // 0-100 (Vision 2071)
  rationale: text("rationale").notNull(),
  priority: integer("priority"), // Ranking within approved projects
}, (table) => ({
  runIdx: index("portfolio_run_idx").on(table.runId),
  demandIdx: index("portfolio_demand_idx").on(table.demandReportId),
}));

export const insertPortfolioRunSchema = createInsertSchema(portfolioRuns).omit({
  id: true,
  createdAt: true
});

export const insertPortfolioRecommendationSchema = createInsertSchema(portfolioRecommendations).omit({
  id: true
});

export type InsertPortfolioRun = z.infer<typeof insertPortfolioRunSchema>;
export type InsertPortfolioRecommendation = z.infer<typeof insertPortfolioRecommendationSchema>;
export type PortfolioRun = typeof portfolioRuns.$inferSelect;
export type PortfolioRecommendation = typeof portfolioRecommendations.$inferSelect;

// 4. Tender Generator - Automated Tender Package Creation
export const tenderTemplates = pgTable("tender_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  industry: varchar("industry", { length: 100 }).notNull(), // IT, construction, consulting, etc.
  title: text("title").notNull(),
  sectionStructure: jsonb("section_structure").notNull(), // { sections: [{ name, required, template }] }
  legalReferences: varchar("legal_references").array(), // UAE laws and regulations
  formatting: jsonb("formatting"), // PDF styling preferences
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
}, (table) => ({
  industryIdx: index("tender_industry_idx").on(table.industry),
}));

export const tenderPackages = pgTable("tender_packages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  businessCaseId: uuid("business_case_id").notNull(), // Logical ref → businessCases.id
  templateId: uuid("template_id").references(() => tenderTemplates.id),
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, final, published
  documentData: jsonb("document_data").notNull(), // Complete tender content
  documentPaths: jsonb("document_paths"), // { pdf: "path/to/file.pdf", docx: ... }
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  generatedBy: uuid("generated_by").notNull().references(() => users.id),
  publishedAt: timestamp("published_at"),
}, (table) => ({
  businessCaseIdx: index("tender_business_case_idx").on(table.businessCaseId),
  statusIdx: index("tender_status_idx").on(table.status),
}));

export const insertTenderTemplateSchema = createInsertSchema(tenderTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertTenderPackageSchema = createInsertSchema(tenderPackages).omit({
  id: true,
  generatedAt: true
});

export type InsertTenderTemplate = z.infer<typeof insertTenderTemplateSchema>;
export type InsertTenderPackage = z.infer<typeof insertTenderPackageSchema>;
export type TenderTemplate = typeof tenderTemplates.$inferSelect;
export type TenderPackage = typeof tenderPackages.$inferSelect;

// ============================================================================
// TENDER SLA MANAGEMENT - Service Level Agreement Tracking
// Tracks deadlines, notifications, and alerts for tender lifecycle
// ============================================================================

export const tenderSlaRules = pgTable("tender_sla_rules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  tenderType: varchar("tender_type", { length: 50 }).notNull().default("standard"), // standard, urgent, strategic

  // SLA Thresholds (in hours)
  submissionDeadlineHours: integer("submission_deadline_hours").notNull().default(720), // 30 days
  reviewDeadlineHours: integer("review_deadline_hours").notNull().default(168), // 7 days
  approvalDeadlineHours: integer("approval_deadline_hours").notNull().default(72), // 3 days

  // Reminder Settings (hours before deadline)
  reminderOffsets: jsonb("reminder_offsets").notNull().default(sql`'[72, 24, 4]'::jsonb`), // 3 days, 1 day, 4 hours before

  // Escalation
  escalationRoleId: varchar("escalation_role_id", { length: 50 }).default("manager"),

  // Status
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  tenderTypeIdx: index("sla_tender_type_idx").on(table.tenderType),
  isActiveIdx: index("sla_is_active_idx").on(table.isActive),
}));

export const tenderSlaAssignments = pgTable("tender_sla_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenderId: uuid("tender_id").notNull().references(() => tenderPackages.id, { onDelete: "cascade" }),
  ruleId: uuid("rule_id").notNull().references(() => tenderSlaRules.id),

  // Current Phase
  currentPhase: varchar("current_phase", { length: 30 }).notNull().default("draft"), // draft, review, approval, published

  // Deadlines
  submissionDeadline: timestamp("submission_deadline"),
  reviewDeadline: timestamp("review_deadline"),
  approvalDeadline: timestamp("approval_deadline"),

  // Status
  status: varchar("status", { length: 20 }).notNull().default("on_track"), // on_track, at_risk, breached, completed

  // Tracking
  appliedAt: timestamp("applied_at").notNull().defaultNow(),
  lastEvaluatedAt: timestamp("last_evaluated_at").notNull().defaultNow(),
}, (table) => ({
  tenderIdx: index("sla_assignment_tender_idx").on(table.tenderId),
  statusIdx: index("sla_assignment_status_idx").on(table.status),
  phaseIdx: index("sla_assignment_phase_idx").on(table.currentPhase),
}));

export const tenderNotifications = pgTable("tender_notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenderId: uuid("tender_id").references(() => tenderPackages.id, { onDelete: "cascade" }),

  // Recipient
  recipientUserId: uuid("recipient_user_id").references(() => users.id),
  recipientRole: varchar("recipient_role", { length: 50 }), // If targeting a role instead of specific user

  // Notification Content
  type: varchar("type", { length: 30 }).notNull(), // sla_reminder, sla_breach, tender_update, action_required
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  priority: varchar("priority", { length: 20 }).notNull().default("normal"), // low, normal, high, urgent

  // Metadata
  metadata: jsonb("metadata"), // Additional context
  actionUrl: varchar("action_url", { length: 500 }), // Link to take action

  // Status
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
}, (table) => ({
  recipientUserIdx: index("notification_recipient_user_idx").on(table.recipientUserId),
  recipientRoleIdx: index("notification_recipient_role_idx").on(table.recipientRole),
  typeIdx: index("notification_type_idx").on(table.type),
  isReadIdx: index("notification_is_read_idx").on(table.isRead),
  createdAtIdx: index("notification_created_at_idx").on(table.createdAt),
}));

export const tenderAlerts = pgTable("tender_alerts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenderId: uuid("tender_id").notNull().references(() => tenderPackages.id, { onDelete: "cascade" }),
  slaAssignmentId: uuid("sla_assignment_id").references(() => tenderSlaAssignments.id),

  // Alert Details
  alertType: varchar("alert_type", { length: 30 }).notNull(), // sla_at_risk, sla_breached, deadline_missed
  phase: varchar("phase", { length: 30 }).notNull(), // draft, review, approval
  severity: varchar("severity", { length: 20 }).notNull().default("medium"), // low, medium, high, critical

  // Content
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),

  // Escalation
  escalatedToRole: varchar("escalated_to_role", { length: 50 }),
  escalatedToUserId: uuid("escalated_to_user_id").references(() => users.id),

  // Resolution
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, acknowledged, resolved, dismissed
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolution: text("resolution"),

  // Timestamps
  triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
}, (table) => ({
  tenderIdx: index("alert_tender_idx").on(table.tenderId),
  statusIdx: index("alert_status_idx").on(table.status),
  severityIdx: index("alert_severity_idx").on(table.severity),
  triggeredAtIdx: index("alert_triggered_at_idx").on(table.triggeredAt),
}));

export const insertTenderSlaRuleSchema = createInsertSchema(tenderSlaRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertTenderSlaAssignmentSchema = createInsertSchema(tenderSlaAssignments).omit({
  id: true,
  appliedAt: true,
  lastEvaluatedAt: true
});

export const insertTenderNotificationSchema = createInsertSchema(tenderNotifications).omit({
  id: true,
  createdAt: true
});

export const insertTenderAlertSchema = createInsertSchema(tenderAlerts).omit({
  id: true,
  triggeredAt: true
});

export type InsertTenderSlaRule = z.infer<typeof insertTenderSlaRuleSchema>;
export type InsertTenderSlaAssignment = z.infer<typeof insertTenderSlaAssignmentSchema>;
export type InsertTenderNotification = z.infer<typeof insertTenderNotificationSchema>;
export type InsertTenderAlert = z.infer<typeof insertTenderAlertSchema>;
export type TenderSlaRule = typeof tenderSlaRules.$inferSelect;
export type TenderSlaAssignment = typeof tenderSlaAssignments.$inferSelect;
export type TenderNotification = typeof tenderNotifications.$inferSelect;
export type TenderAlert = typeof tenderAlerts.$inferSelect;

// ============================================================================
// RFP DOCUMENT VERSIONS - Independent Version Control for RFP/Tender Documents
// Separate from demand_report_versions to maintain independent version histories
// ============================================================================

export const rfpDocumentVersions = pgTable("rfp_document_versions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Tender Package Reference (NOT demand report)
  tenderId: uuid("tender_id").notNull().references(() => tenderPackages.id, { onDelete: "cascade" }),

  // Semantic Versioning System
  versionNumber: varchar("version_number", { length: 20 }).notNull(), // v1.0.0, v1.1.0, v2.0.0, etc.
  majorVersion: integer("major_version").notNull(),
  minorVersion: integer("minor_version").notNull(),
  patchVersion: integer("patch_version").notNull().default(0),

  // Parent-Child Version Relationships
  parentVersionId: varchar("parent_version_id"),
  baseVersionId: varchar("base_version_id"),

  // Version Status Management
  status: varchar("status", { length: 30 }).notNull().default("draft"),
  // draft, under_review, approved, published, archived, rejected, superseded

  // Comprehensive Version Content - Full RFP document snapshot
  documentSnapshot: jsonb("document_snapshot").notNull(), // Complete 18-section RFP content

  // Framework Approval Integration
  frameworkApprovalId: varchar("framework_approval_id"),
  approvalStatus: varchar("approval_status", { length: 30 }).default("pending"),
  // pending, in_progress, approved, rejected

  // Change Management
  changeSummary: text("change_summary"), // User description of changes
  changedSections: jsonb("changed_sections"), // Array of modified section IDs
  editReason: text("edit_reason"), // Reason for the version creation

  // Content Hash for Change Detection
  contentHash: varchar("content_hash", { length: 64 }),

  // Creator and Timestamps
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdByName: varchar("created_by_name", { length: 200 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),

  // Publishing
  publishedAt: timestamp("published_at"),
  publishedBy: uuid("published_by").references(() => users.id),
}, (table) => ({
  tenderIdx: index("rfp_version_tender_idx").on(table.tenderId),
  statusIdx: index("rfp_version_status_idx").on(table.status),
  createdAtIdx: index("rfp_version_created_at_idx").on(table.createdAt),
  semanticVersionIdx: index("rfp_version_semantic_idx").on(table.tenderId, table.majorVersion, table.minorVersion, table.patchVersion),
  uniqueSemanticVersion: unique("rfp_version_unique_semantic").on(table.tenderId, table.majorVersion, table.minorVersion, table.patchVersion),
}));

export const insertRfpDocumentVersionSchema = createInsertSchema(rfpDocumentVersions).omit({
  id: true,
  createdAt: true,
}).extend({
  majorVersion: z.number().int().min(1),
  minorVersion: z.number().int().min(0),
  patchVersion: z.number().int().min(0).default(0),
  changeSummary: z.string().min(5, "Change summary must be at least 5 characters").optional(),
  editReason: z.string().min(5, "Edit reason must be at least 5 characters").optional(),
});

export const updateRfpDocumentVersionSchema = createInsertSchema(rfpDocumentVersions).partial().omit({
  id: true,
  tenderId: true,
  createdAt: true,
  createdBy: true,
  createdByName: true,
  majorVersion: true,
  minorVersion: true,
  patchVersion: true,
  versionNumber: true,
  contentHash: true,
});

export type InsertRfpDocumentVersion = z.infer<typeof insertRfpDocumentVersionSchema>;
export type UpdateRfpDocumentVersion = z.infer<typeof updateRfpDocumentVersionSchema>;
export type RfpDocumentVersion = typeof rfpDocumentVersions.$inferSelect;

// ============================================================================
// AGENT FEEDBACK - Phase 2 Intelligence Learning System
// Stores user feedback on AI-generated content for continuous improvement
// ============================================================================

export const agentFeedback = pgTable("agent_feedback", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Agent Context
  agentDomain: varchar("agent_domain", { length: 50 }).notNull(), // finance, business, technical, security
  feedbackType: varchar("feedback_type", { length: 20 }).notNull(), // edit, rating, preference, correction

  // Content
  originalContent: text("original_content").notNull(), // AI-generated content
  revisedContent: text("revised_content"), // User-edited content (for edit type)

  // Rating (1-5 stars)
  rating: integer("rating"), // Optional for rating type

  // Context References
  userId: uuid("user_id").notNull().references(() => users.id),
  reportId: uuid("report_id"), // Logical ref → demandReports.id
  businessCaseId: uuid("business_case_id"), // Logical ref → businessCases.id,

  // Additional Metadata
  metadata: jsonb("metadata"), // Field name, section, custom tags

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  agentDomainIdx: index("agent_feedback_domain_idx").on(table.agentDomain),
  feedbackTypeIdx: index("agent_feedback_type_idx").on(table.feedbackType),
  userIdIdx: index("agent_feedback_user_idx").on(table.userId),
  reportIdIdx: index("agent_feedback_report_idx").on(table.reportId),
  createdAtIdx: index("agent_feedback_created_idx").on(table.createdAt),
}));

// Learning Patterns - Aggregated insights from feedback
export const learningPatterns = pgTable("learning_patterns", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Pattern Details
  domain: varchar("domain", { length: 50 }).notNull(), // Which agent domain
  pattern: text("pattern").notNull(), // Pattern description (e.g., "add_term_dirham")
  frequency: integer("frequency").notNull().default(1), // How many times observed
  confidence: numeric("confidence", { precision: 3, scale: 2 }).notNull(), // 0-1.0

  // Examples
  examples: jsonb("examples"), // Array of example content

  // Organization-specific learning
  organizationId: varchar("organization_id"), // For multi-tenant learning

  // Status
  isActive: boolean("is_active").notNull().default(false),

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  domainIdx: index("learning_patterns_domain_idx").on(table.domain),
  confidenceIdx: index("learning_patterns_confidence_idx").on(table.confidence),
  isActiveIdx: index("learning_patterns_active_idx").on(table.isActive),
}));

// Insert and Select Schemas
export const insertAgentFeedbackSchema = createInsertSchema(agentFeedback).omit({
  id: true,
  createdAt: true,
}).extend({
  agentDomain: z.enum(["finance", "business", "technical", "security", "general"]),
  feedbackType: z.enum(["edit", "rating", "preference", "correction"]),
  rating: z.number().int().min(1).max(5).optional(),
});

export const insertLearningPatternSchema = createInsertSchema(learningPatterns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  domain: z.enum(["finance", "business", "technical", "security", "general"]),
  pattern: z.string().min(1),
  frequency: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
});

export type AgentFeedback = typeof agentFeedback.$inferSelect;
export type InsertAgentFeedback = z.infer<typeof insertAgentFeedbackSchema>;

export type LearningPattern = typeof learningPatterns.$inferSelect;
export type InsertLearningPattern = z.infer<typeof insertLearningPatternSchema>;

