/** @module compliance — Schema owner. Only this module may write to these tables. */
/**
 * Schema domain: compliance
 * Auto-extracted from shared/schema.ts
 */
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, serial, timestamp, index, real, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
// Cross-domain refs: demandReports.id (logical only, no FK constraints)
import { users } from "./platform";

// ============================================================================
// COMPLIANCE ENGINE - UAE Procurement Standards Validation
// Automated compliance checking with RAG-powered fix suggestions
// ============================================================================

export const complianceRules = pgTable('compliance_rules', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 500 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 50 }).notNull(), // 'financial' | 'strategic' | 'security' | 'technical' | 'legal'
  severity: varchar('severity', { length: 50 }).notNull(), // 'critical' | 'high' | 'medium' | 'low'
  validationType: varchar('validation_type', { length: 100 }).notNull(), // 'presence' | 'threshold' | 'alignment' | 'document' | 'rag_prompt'
  validationParams: jsonb('validation_params'), // { field, minValue, requiredDocs, etc. }
  autoFixTemplate: text('auto_fix_template'),
  requiredDocuments: text('required_documents').array(),
  status: varchar('status', { length: 50 }).default('published'), // 'draft' | 'published' | 'archived'
  effectiveDate: timestamp('effective_date'),
  expiryDate: timestamp('expiry_date'),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => ({
  categoryIdx: index('compliance_rules_category_idx').on(table.category),
  statusIdx: index('compliance_rules_status_idx').on(table.status),
  severityIdx: index('compliance_rules_severity_idx').on(table.severity),
}));

export const complianceRuns = pgTable('compliance_runs', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: uuid("report_id"), // Logical ref → demandReports.id
  triggerSource: varchar('trigger_source', { length: 50 }).notNull(), // 'save' | 'submit' | 'manual'
  status: varchar('status', { length: 50 }).default('pending'), // 'pending' | 'processing' | 'complete' | 'failed'
  overallScore: real('overall_score'), // 0-100
  totalViolations: integer('total_violations').default(0),
  criticalViolations: integer('critical_violations').default(0),
  runBy: varchar('run_by', { length: 255 }),
  runAt: timestamp('run_at').defaultNow(),
  completedAt: timestamp('completed_at')
}, (table) => ({
  reportIdIdx: index('compliance_runs_report_id_idx').on(table.reportId),
  statusIdx: index('compliance_runs_status_idx').on(table.status),
  runAtIdx: index('compliance_runs_run_at_idx').on(table.runAt),
}));

export const complianceViolations = pgTable('compliance_violations', {
  id: serial('id').primaryKey(),
  runId: uuid("run_id").references(() => complianceRuns.id, { onDelete: 'cascade' }),
  ruleId: uuid("rule_id").references(() => complianceRules.id),
  section: varchar('section', { length: 255 }), // Which business case section
  field: varchar('field', { length: 255 }), // Specific field
  violationMessage: text('violation_message').notNull(),
  suggestedFix: text('suggested_fix'),
  fixCitations: jsonb('fix_citations'), // AICitation[]
  fixConfidence: real('fix_confidence'),
  severity: varchar('severity', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).default('open'), // 'open' | 'fixed' | 'dismissed'
  appliedBy: varchar('applied_by', { length: 255 }),
  appliedAt: timestamp('applied_at'),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  runIdIdx: index('compliance_violations_run_id_idx').on(table.runId),
  ruleIdIdx: index('compliance_violations_rule_id_idx').on(table.ruleId),
  statusIdx: index('compliance_violations_status_idx').on(table.status),
  severityIdx: index('compliance_violations_severity_idx').on(table.severity),
}));

// Compliance schemas
export const insertComplianceRuleSchema = createInsertSchema(complianceRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Rule name is required"),
  description: z.string().min(1, "Rule description is required"),
  category: z.enum(['financial', 'strategic', 'security', 'technical', 'legal']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  validationType: z.enum(['presence', 'threshold', 'alignment', 'document', 'rag_prompt']),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
});

export const insertComplianceRunSchema = createInsertSchema(complianceRuns).omit({
  id: true,
  runAt: true,
  completedAt: true,
}).extend({
  triggerSource: z.enum(['save', 'submit', 'manual']),
  status: z.enum(['pending', 'processing', 'complete', 'failed']).optional(),
});

export const insertComplianceViolationSchema = createInsertSchema(complianceViolations).omit({
  id: true,
  createdAt: true,
  appliedAt: true,
}).extend({
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  status: z.enum(['open', 'fixed', 'dismissed']).optional(),
});

export type ComplianceRule = typeof complianceRules.$inferSelect;
export type InsertComplianceRule = z.infer<typeof insertComplianceRuleSchema>;

export type ComplianceRun = typeof complianceRuns.$inferSelect;
export type InsertComplianceRun = z.infer<typeof insertComplianceRunSchema>;

export type ComplianceViolation = typeof complianceViolations.$inferSelect;
export type InsertComplianceViolation = z.infer<typeof insertComplianceViolationSchema>;

// ============================================================================
// ORCHESTRATION ENGINE - Multi-Agent RAG Orchestration
// Tracks orchestration runs for multi-domain expert consultation
// ============================================================================

export const orchestrationRuns = pgTable('orchestration_runs', {
  id: varchar('id', { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  query: text('query').notNull(),
  normalizedQuery: text('normalized_query').notNull(),
  classification: jsonb('classification').notNull(), // ClassificationResult
  invokedAgents: text('invoked_agents').array().notNull(), // List of agent domains
  agentResponses: jsonb('agent_responses').notNull(), // AgentResponse[]
  conflicts: jsonb('conflicts'), // Conflict[]
  aggregatedConfidence: real('aggregated_confidence'),
  timings: jsonb('timings'), // { classificationTime, retrievalTime, totalTime, agentTimings }
  userId: uuid("user_id").references(() => users.id),
  reportId: uuid("report_id"), // Logical ref → demandReports.id
  accessLevel: varchar('access_level', { length: 50 }),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => ({
  userIdIdx: index('orchestration_runs_user_id_idx').on(table.userId),
  reportIdIdx: index('orchestration_runs_report_id_idx').on(table.reportId),
  createdAtIdx: index('orchestration_runs_created_at_idx').on(table.createdAt),
}));

export const insertOrchestrationRunSchema = createInsertSchema(orchestrationRuns).omit({
  id: true,
  createdAt: true,
}).extend({
  query: z.string().min(1, "Query is required"),
  normalizedQuery: z.string().min(1, "Normalized query is required"),
  classification: z.object({
    domains: z.array(z.string()),
    confidence: z.number(),
    scores: z.record(z.number()),
    method: z.enum(['keyword', 'llm', 'fallback']),
    isCached: z.boolean().optional(),
  }),
  invokedAgents: z.array(z.string()),
  agentResponses: z.array(z.any()), // AgentResponse[] - complex type
  conflicts: z.array(z.any()).optional(), // Conflict[]
  aggregatedConfidence: z.number().optional(),
  timings: z.object({
    classificationTime: z.number(),
    retrievalTime: z.number(),
    totalTime: z.number(),
    agentTimings: z.record(z.number()),
  }).optional(),
});

export type OrchestrationRun = typeof orchestrationRuns.$inferSelect;
export type InsertOrchestrationRun = z.infer<typeof insertOrchestrationRunSchema>;

