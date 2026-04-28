/** @module governance — Schema owner. Only this module may write to these tables. */
/**
 * Schema domain: governance
 * Auto-extracted from shared/schema.ts
 */
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp, boolean, index, unique, real, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { BRIEFING_STATUS, BRIEFING_TYPES, ENTITY_TYPES, RELATIONSHIP_TYPES, briefingSections, executiveBriefings, knowledgeEntities, knowledgeRelationships } from "./knowledge";
import { users } from "./platform";
// Cross-domain refs: portfolioProjects.id (logical only, no FK constraints)

// ============================================================================
// INSIGHT RADAR - Proactive Alerts & Recommendations
// Knowledge gap detection, regulatory monitoring, risk signals
// ============================================================================

export const INSIGHT_CATEGORIES = ['knowledge_gap', 'regulatory_update', 'risk_signal', 'opportunity', 'trend_shift', 'compliance_alert'] as const;
export const INSIGHT_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export const INSIGHT_STATUS = ['new', 'acknowledged', 'in_progress', 'resolved', 'dismissed'] as const;

export const insightRules = pgTable("insight_rules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  name: text("name").notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull(),

  triggerConditions: jsonb("trigger_conditions").notNull(),
  evaluationQuery: text("evaluation_query"),
  threshold: real("threshold").default(0.7),

  isActive: boolean("is_active").default(true),
  priority: varchar("priority", { length: 20 }).default("medium"),

  notifyRoles: text("notify_roles").array(),
  notifyUsers: text("notify_users").array(),

  lastEvaluated: timestamp("last_evaluated"),
  evaluationFrequency: varchar("evaluation_frequency", { length: 20 }).default("daily"),

  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  categoryIdx: index("insight_rules_category_idx").on(table.category),
  isActiveIdx: index("insight_rules_active_idx").on(table.isActive),
}));

export const insightEvents = pgTable("insight_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  ruleId: uuid("rule_id").references(() => insightRules.id, { onDelete: "set null" }),
  category: varchar("category", { length: 50 }).notNull(),
  priority: varchar("priority", { length: 20 }).notNull().default("medium"),
  status: varchar("status", { length: 20 }).notNull().default("new"),

  title: text("title").notNull(),
  description: text("description"),

  affectedEntities: jsonb("affected_entities"),
  evidence: jsonb("evidence"),

  recommendedActions: jsonb("recommended_actions"),
  playbook: jsonb("playbook"),

  confidenceScore: real("confidence_score"),
  impactScore: real("impact_score"),

  acknowledgedBy: uuid("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),

  relatedDocumentIds: text("related_document_ids").array(),
  relatedEntityIds: text("related_entity_ids").array(),

  metadata: jsonb("metadata"),

  triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
}, (table) => ({
  categoryIdx: index("insight_events_category_idx").on(table.category),
  priorityIdx: index("insight_events_priority_idx").on(table.priority),
  statusIdx: index("insight_events_status_idx").on(table.status),
  triggeredAtIdx: index("insight_events_triggered_at_idx").on(table.triggeredAt),
  ruleIdx: index("insight_events_rule_idx").on(table.ruleId),
}));

// Insert Schemas
export const insertKnowledgeEntitySchema = createInsertSchema(knowledgeEntities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
  lastAccessed: true,
}).extend({
  name: z.string().min(1, "Entity name is required"),
  entityType: z.enum(ENTITY_TYPES),
  confidence: z.number().min(0).max(1).optional(),
});

export const insertKnowledgeRelationshipSchema = createInsertSchema(knowledgeRelationships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  sourceEntityId: z.string().min(1, "Source entity is required"),
  targetEntityId: z.string().min(1, "Target entity is required"),
  relationshipType: z.enum(RELATIONSHIP_TYPES),
  strength: z.number().min(0).max(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const insertExecutiveBriefingSchema = createInsertSchema(executiveBriefings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  generatedAt: true,
  citationCount: true,
}).extend({
  title: z.string().min(1, "Briefing title is required"),
  briefingType: z.enum(BRIEFING_TYPES).default("custom"),
  status: z.enum(BRIEFING_STATUS).default("draft"),
});

export const insertBriefingSectionSchema = createInsertSchema(briefingSections).omit({
  id: true,
  createdAt: true,
}).extend({
  briefingId: z.string().min(1, "Briefing ID is required"),
  sectionType: z.string().min(1, "Section type is required"),
  title: z.string().min(1, "Section title is required"),
});

export const insertInsightRuleSchema = createInsertSchema(insightRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastEvaluated: true,
}).extend({
  name: z.string().min(1, "Rule name is required"),
  category: z.enum(INSIGHT_CATEGORIES),
  priority: z.enum(INSIGHT_PRIORITIES).default("medium"),
});

export const insertInsightEventSchema = createInsertSchema(insightEvents).omit({
  id: true,
  triggeredAt: true,
}).extend({
  title: z.string().min(1, "Event title is required"),
  category: z.enum(INSIGHT_CATEGORIES),
  priority: z.enum(INSIGHT_PRIORITIES).default("medium"),
  status: z.enum(INSIGHT_STATUS).default("new"),
});

// Type Exports
export type KnowledgeEntity = typeof knowledgeEntities.$inferSelect;
export type InsertKnowledgeEntity = z.infer<typeof insertKnowledgeEntitySchema>;

export type KnowledgeRelationship = typeof knowledgeRelationships.$inferSelect;
export type InsertKnowledgeRelationship = z.infer<typeof insertKnowledgeRelationshipSchema>;

export type ExecutiveBriefing = typeof executiveBriefings.$inferSelect;
export type InsertExecutiveBriefing = z.infer<typeof insertExecutiveBriefingSchema>;

export type BriefingSection = typeof briefingSections.$inferSelect;
export type InsertBriefingSection = z.infer<typeof insertBriefingSectionSchema>;

export type InsightRule = typeof insightRules.$inferSelect;
export type InsertInsightRule = z.infer<typeof insertInsightRuleSchema>;

export type InsightEvent = typeof insightEvents.$inferSelect;
export type InsertInsightEvent = z.infer<typeof insertInsightEventSchema>;

// ============================================================================
// VENDOR EVALUATION SYSTEM - Technical Proposal Analysis
// Vendor management, proposal uploads, and AI-powered evaluation
// ============================================================================

export const VENDOR_STATUS = ['invited', 'registered', 'submitted', 'evaluated', 'shortlisted', 'rejected'] as const;
export const PROPOSAL_STATUS = ['pending', 'uploaded', 'processing', 'evaluated', 'reviewed'] as const;
export const EVALUATION_STATUS = ['pending', 'in_progress', 'completed', 'approved'] as const;

export const vendorParticipants = pgTable("vendor_participants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  demandReportId: varchar("demand_report_id").notNull(),

  vendorName: text("vendor_name").notNull(),
  vendorCode: varchar("vendor_code", { length: 50 }),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),

  companyProfile: text("company_profile"),
  registrationNumber: varchar("registration_number", { length: 100 }),
  country: varchar("country", { length: 100 }),

  status: varchar("status", { length: 50 }).notNull().default("invited"),
  invitedAt: timestamp("invited_at"),
  submittedAt: timestamp("submitted_at"),

  notes: text("notes"),
  metadata: jsonb("metadata"),

  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  demandReportIdx: index("vendor_participants_demand_idx").on(table.demandReportId),
  statusIdx: index("vendor_participants_status_idx").on(table.status),
}));

export const vendorProposals = pgTable("vendor_proposals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: uuid("vendor_id").notNull().references(() => vendorParticipants.id, { onDelete: "cascade" }),
  demandReportId: varchar("demand_report_id").notNull(),

  proposalTitle: text("proposal_title"),
  fileName: text("file_name").notNull(),
  fileType: varchar("file_type", { length: 50 }),
  fileSize: integer("file_size"),
  filePath: text("file_path"),

  extractedText: text("extracted_text"),
  proposalSummary: text("proposal_summary"),

  status: varchar("status", { length: 50 }).notNull().default("pending"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),

  metadata: jsonb("metadata"),

  uploadedBy: uuid("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  vendorIdx: index("vendor_proposals_vendor_idx").on(table.vendorId),
  demandReportIdx: index("vendor_proposals_demand_idx").on(table.demandReportId),
  statusIdx: index("vendor_proposals_status_idx").on(table.status),
}));

export const evaluationCriteria = pgTable("evaluation_criteria", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  demandReportId: varchar("demand_report_id"),

  criterionName: text("criterion_name").notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  weight: real("weight").notNull().default(10),
  maxScore: integer("max_score").notNull().default(100),

  scoringGuidelines: text("scoring_guidelines"),
  isDefault: boolean("is_default").default(false),

  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  demandReportIdx: index("evaluation_criteria_demand_idx").on(table.demandReportId),
}));

export const proposalScores = pgTable("proposal_scores", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: uuid("proposal_id").notNull().references(() => vendorProposals.id, { onDelete: "cascade" }),
  criterionId: uuid("criterion_id").notNull().references(() => evaluationCriteria.id, { onDelete: "cascade" }),

  score: real("score").notNull(),
  maxScore: real("max_score").notNull().default(100),
  weightedScore: real("weighted_score"),

  aiRationale: text("ai_rationale"),
  evidence: text("evidence").array(),
  confidence: real("confidence"),

  manualOverride: boolean("manual_override").default(false),
  overrideBy: uuid("override_by").references(() => users.id),
  overrideReason: text("override_reason"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  proposalIdx: index("proposal_scores_proposal_idx").on(table.proposalId),
  criterionIdx: index("proposal_scores_criterion_idx").on(table.criterionId),
  proposalCriterionUnique: unique("proposal_criterion_unique").on(table.proposalId, table.criterionId),
}));

export const vendorEvaluations = pgTable("vendor_evaluations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  demandReportId: varchar("demand_report_id").notNull(),

  status: varchar("status", { length: 50 }).notNull().default("pending"),

  totalVendors: integer("total_vendors").default(0),
  evaluatedVendors: integer("evaluated_vendors").default(0),

  aiSummary: text("ai_summary"),
  recommendations: jsonb("recommendations"),
  vendorRankings: jsonb("vendor_rankings"),
  comparisonMatrix: jsonb("comparison_matrix"),

  riskAssessment: jsonb("risk_assessment"),
  strengthsWeaknesses: jsonb("strengths_weaknesses"),

  qualityScore: integer("quality_score"),
  confidenceScore: real("confidence_score"),

  evaluatedBy: uuid("evaluated_by").references(() => users.id),
  evaluatedAt: timestamp("evaluated_at"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  demandReportIdx: index("vendor_evaluations_demand_idx").on(table.demandReportId),
  statusIdx: index("vendor_evaluations_status_idx").on(table.status),
}));

// Insert Schemas for Vendor Evaluation
export const insertVendorParticipantSchema = createInsertSchema(vendorParticipants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  invitedAt: true,
  submittedAt: true,
}).extend({
  vendorName: z.string().min(1, "Vendor name is required"),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  status: z.enum(VENDOR_STATUS).default("invited"),
});

export const insertVendorProposalSchema = createInsertSchema(vendorProposals).omit({
  id: true,
  createdAt: true,
  uploadedAt: true,
  processedAt: true,
}).extend({
  fileName: z.string().min(1, "File name is required"),
  status: z.enum(PROPOSAL_STATUS).default("pending"),
});

export const insertEvaluationCriteriaSchema = createInsertSchema(evaluationCriteria).omit({
  id: true,
  createdAt: true,
}).extend({
  criterionName: z.string().min(1, "Criterion name is required"),
  weight: z.number().min(0).max(100).default(10),
  maxScore: z.number().min(1).default(100),
});

export const insertProposalScoreSchema = createInsertSchema(proposalScores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1).optional(),
});

export const insertVendorEvaluationSchema = createInsertSchema(vendorEvaluations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  evaluatedAt: true,
  approvedAt: true,
}).extend({
  status: z.enum(EVALUATION_STATUS).default("pending"),
});

// Type Exports for Vendor Evaluation
export type VendorParticipant = typeof vendorParticipants.$inferSelect;
export type InsertVendorParticipant = z.infer<typeof insertVendorParticipantSchema>;

export type VendorProposal = typeof vendorProposals.$inferSelect;
export type InsertVendorProposal = z.infer<typeof insertVendorProposalSchema>;

export type EvaluationCriterion = typeof evaluationCriteria.$inferSelect;
export type InsertEvaluationCriterion = z.infer<typeof insertEvaluationCriteriaSchema>;

export type ProposalScore = typeof proposalScores.$inferSelect;
export type InsertProposalScore = z.infer<typeof insertProposalScoreSchema>;

export type VendorEvaluation = typeof vendorEvaluations.$inferSelect;
export type InsertVendorEvaluation = z.infer<typeof insertVendorEvaluationSchema>;

// ============================================================================
// AI ASSISTANT - Intelligent Hub Brain
// Central AI system that connects to all platform features
// ============================================================================

// Assistant conversation modes
export const ASSISTANT_MODES = [
  "general",          // General conversation
  "email",            // Email drafting and response
  "policy",           // Policy and procedure writing
  "playbook",         // Playbook generation
  "research",         // Research and information lookup
  "task_management",  // Task and reminder management
  "system_query"      // Query system data (demands, projects, gates)
] as const;

// Notification priority levels
export const NOTIFICATION_PRIORITY = ["low", "medium", "high", "urgent"] as const;

// Reminder status
export const REMINDER_STATUS = ["pending", "sent", "dismissed", "snoozed"] as const;

// AI Assistant Conversations
export const aiConversations = pgTable("ai_conversations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull().default("New Conversation"),
  mode: varchar("mode", { length: 50 }).notNull().default("general"),

  // System context - what the AI knows about for this conversation
  contextType: varchar("context_type", { length: 50 }), // 'demand', 'project', 'gate', 'rfp', etc.
  contextId: varchar("context_id"), // ID of the related entity
  contextData: jsonb("context_data"), // Cached context data for quick reference

  isArchived: boolean("is_archived").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("ai_conversations_user_idx").on(table.userId),
  modeIdx: index("ai_conversations_mode_idx").on(table.mode),
}));

// AI Assistant Messages
export const aiMessages = pgTable("ai_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: uuid("conversation_id").notNull().references(() => aiConversations.id, { onDelete: "cascade" }),

  role: varchar("role", { length: 20 }).notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),

  // For structured outputs (playbooks, policies, etc.)
  structuredOutput: jsonb("structured_output"),
  outputType: varchar("output_type", { length: 50 }), // 'policy', 'playbook', 'email_draft', etc.

  // Metadata about the message
  tokens: integer("tokens"),
  model: varchar("model", { length: 100 }),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  conversationIdx: index("ai_messages_conversation_idx").on(table.conversationId),
}));

// AI Assistant Tasks - User tasks managed by the assistant
export const aiTasks = pgTable("ai_tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id),

  title: text("title").notNull(),
  description: text("description"),

  priority: varchar("priority", { length: 20 }).notNull().default("medium"),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, in_progress, completed, cancelled

  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),

  // Link to system entities
  relatedType: varchar("related_type", { length: 50 }), // 'demand', 'project', 'gate', 'rfp'
  relatedId: varchar("related_id"),

  // Source: manual or AI-suggested
  source: varchar("source", { length: 20 }).notNull().default("manual"), // 'manual', 'ai_suggested', 'system'

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("ai_tasks_user_idx").on(table.userId),
  statusIdx: index("ai_tasks_status_idx").on(table.status),
  dueDateIdx: index("ai_tasks_due_date_idx").on(table.dueDate),
}));

// AI Assistant Reminders
export const aiReminders = pgTable("ai_reminders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id),
  taskId: uuid("task_id").references(() => aiTasks.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  message: text("message"),

  remindAt: timestamp("remind_at").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),

  // Repeat settings
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringPattern: varchar("recurring_pattern", { length: 50 }), // 'daily', 'weekly', 'monthly'

  snoozedUntil: timestamp("snoozed_until"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("ai_reminders_user_idx").on(table.userId),
  remindAtIdx: index("ai_reminders_remind_at_idx").on(table.remindAt),
  statusIdx: index("ai_reminders_status_idx").on(table.status),
}));

// AI Proactive Notifications - System-generated alerts
export const aiNotifications = pgTable("ai_notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id),

  title: text("title").notNull(),
  message: text("message").notNull(),

  type: varchar("type", { length: 50 }).notNull(), // 'deadline', 'approval_needed', 'overdue', 'suggestion', 'insight'
  priority: varchar("priority", { length: 20 }).notNull().default("medium"),

  // Link to system entities
  relatedType: varchar("related_type", { length: 50 }),
  relatedId: varchar("related_id"),
  actionUrl: text("action_url"), // Deep link to the relevant page

  isRead: boolean("is_read").notNull().default(false),
  isDismissed: boolean("is_dismissed").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("ai_notifications_user_idx").on(table.userId),
  isReadIdx: index("ai_notifications_is_read_idx").on(table.isRead),
  priorityIdx: index("ai_notifications_priority_idx").on(table.priority),
}));

// AI Generated Documents (policies, playbooks, etc.)
export const aiDocuments = pgTable("ai_documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id),
  conversationId: uuid("conversation_id").references(() => aiConversations.id),

  title: text("title").notNull(),
  documentType: varchar("document_type", { length: 50 }).notNull(), // 'policy', 'procedure', 'playbook', 'email_template', 'report'

  content: text("content").notNull(),
  structuredContent: jsonb("structured_content"), // For structured formats like playbooks

  // Versioning
  version: integer("version").notNull().default(1),
  parentId: varchar("parent_id"), // For version history

  // Metadata
  tags: text("tags").array(),
  status: varchar("status", { length: 20 }).notNull().default("draft"), // 'draft', 'published', 'archived'

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("ai_documents_user_idx").on(table.userId),
  typeIdx: index("ai_documents_type_idx").on(table.documentType),
}));

// Insert Schemas for AI Assistant
export const insertAiConversationSchema = createInsertSchema(aiConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  title: z.string().optional(),
  mode: z.enum(ASSISTANT_MODES).default("general"),
});

export const insertAiMessageSchema = createInsertSchema(aiMessages).omit({
  id: true,
  createdAt: true,
}).extend({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
});

export const insertAiTaskSchema = createInsertSchema(aiTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
}).extend({
  title: z.string().min(1, "Task title is required"),
  priority: z.enum(NOTIFICATION_PRIORITY).default("medium"),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).default("pending"),
});

export const insertAiReminderSchema = createInsertSchema(aiReminders).omit({
  id: true,
  createdAt: true,
}).extend({
  title: z.string().min(1, "Reminder title is required"),
  remindAt: z.union([z.date(), z.string().datetime()]),
  status: z.enum(REMINDER_STATUS).default("pending"),
});

export const insertAiNotificationSchema = createInsertSchema(aiNotifications).omit({
  id: true,
  createdAt: true,
}).extend({
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.string().min(1),
  priority: z.enum(NOTIFICATION_PRIORITY).default("medium"),
});

export const insertAiDocumentSchema = createInsertSchema(aiDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  title: z.string().min(1, "Document title is required"),
  documentType: z.enum(["policy", "procedure", "playbook", "email_template", "report"]),
  content: z.string().min(1),
});

// Type Exports for AI Assistant
export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;

export type AiMessage = typeof aiMessages.$inferSelect;
export type InsertAiMessage = z.infer<typeof insertAiMessageSchema>;

export type AiTask = typeof aiTasks.$inferSelect;
export type InsertAiTask = z.infer<typeof insertAiTaskSchema>;

export type AiReminder = typeof aiReminders.$inferSelect;
export type InsertAiReminder = z.infer<typeof insertAiReminderSchema>;

export type AiNotification = typeof aiNotifications.$inferSelect;
export type InsertAiNotification = z.infer<typeof insertAiNotificationSchema>;

export type AiDocument = typeof aiDocuments.$inferSelect;
export type InsertAiDocument = z.infer<typeof insertAiDocumentSchema>;

// =====================================================
// COVERIA INTELLIGENCE PERSISTENCE
// Learning Events, Personality Evolution & Proactive Insights
// =====================================================

// Coveria learning events table - stores interactions for learning
export const coveriaLearningEvents = pgTable("coveria_learning_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  interactionType: varchar("interaction_type").notNull(), // 'question', 'command', 'feedback', 'correction'
  userInput: text("user_input").notNull(),
  coveriaResponse: text("coveria_response").notNull(),
  satisfaction: integer("satisfaction"), // 1-5 rating
  wasHelpful: boolean("was_helpful"),
  topicCategory: varchar("topic_category").default("general"),
  emotionalTone: varchar("emotional_tone").default("neutral"), // 'positive', 'neutral', 'negative', 'frustrated'
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Coveria personality state - stores evolving personality traits
export const coveriaPersonality = pgTable("coveria_personality", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id"),
  formality: real("formality").default(0.7).notNull(), // 0-1
  technicalDepth: real("technical_depth").default(0.6).notNull(),
  proactivity: real("proactivity").default(0.8).notNull(),
  empathy: real("empathy").default(0.75).notNull(),
  enthusiasm: real("enthusiasm").default(0.7).notNull(),
  topicExpertise: jsonb("topic_expertise").default("{}"), // Map of topic -> expertise level
  evolutionHistory: jsonb("evolution_history").default("[]"), // Array of personality changes
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Coveria proactive insights table
export const coveriaInsights = pgTable("coveria_insights", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull(), // 'anomaly', 'trend', 'recommendation', 'warning', 'celebration'
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  priority: varchar("priority").default("medium").notNull(), // 'low', 'medium', 'high', 'urgent'
  actionable: boolean("actionable").default(false),
  dismissed: boolean("dismissed").default(false),
  relatedEntities: jsonb("related_entities").default("[]"),
  userId: varchar("user_id"), // null = system-wide, string = user-specific
  metadata: jsonb("metadata"), // additional context data
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schema and type exports for Coveria
export const insertCoveriaLearningEventSchema = createInsertSchema(coveriaLearningEvents).omit({
  id: true,
  createdAt: true,
});

export const insertCoveriaPersonalitySchema = createInsertSchema(coveriaPersonality).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCoveriaInsightSchema = createInsertSchema(coveriaInsights).omit({
  id: true,
  createdAt: true,
});

export type CoveriaLearningEvent = typeof coveriaLearningEvents.$inferSelect;
export type InsertCoveriaLearningEvent = z.infer<typeof insertCoveriaLearningEventSchema>;

export type CoveriaPersonalityRecord = typeof coveriaPersonality.$inferSelect;
export type InsertCoveriaPersonality = z.infer<typeof insertCoveriaPersonalitySchema>;

export type CoveriaInsight = typeof coveriaInsights.$inferSelect;
export type InsertCoveriaInsight = z.infer<typeof insertCoveriaInsightSchema>;

// =====================================================
// QUANTUM GATE GOVERNANCE SYSTEM
// Phase Gate Approval & Lifecycle Management
// =====================================================

// Gate Phase Definitions
export const GATE_PHASES = [
  'intake',
  'initiation',
  'planning',
  'execution',
  'monitoring',
  'closure'
] as const;

export const GATE_STATUS = [
  'not_started',
  'in_progress',
  'ready_for_review',
  'pending_approval',
  'approved',
  'rejected',
  'on_hold'
] as const;

export const GATE_CHECK_STATUS = [
  'pending',
  'passed',
  'failed',
  'waived',
  'not_applicable'
] as const;

// Gate Check Catalog - Definable criteria templates per phase
export const gateCheckCatalog = pgTable("gate_check_catalog", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  phase: varchar("phase", { length: 50 }).notNull(), // Target phase this check applies to
  category: varchar("category", { length: 100 }).notNull(), // e.g., 'documentation', 'approvals', 'resources', 'compliance'

  name: text("name").notNull(),
  description: text("description"),

  // Check configuration
  isRequired: boolean("is_required").notNull().default(true),
  isCritical: boolean("is_critical").notNull().default(false), // Blocks progression if failed
  weight: integer("weight").notNull().default(10), // For scoring (1-100)

  // Auto-verification
  autoVerify: boolean("auto_verify").notNull().default(false),
  verificationQuery: text("verification_query"), // SQL or API call for auto-check
  verificationField: varchar("verification_field", { length: 200 }), // Field path to check
  expectedValue: text("expected_value"), // Expected value or condition

  // Evidence requirements
  requiresEvidence: boolean("requires_evidence").notNull().default(false),
  evidenceTypes: text("evidence_types").array(), // ['document', 'signature', 'screenshot', 'link']

  // Responsible role
  responsibleRole: varchar("responsible_role", { length: 100 }),

  // Ordering
  sortOrder: integer("sort_order").notNull().default(0),

  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  phaseIdx: index("gate_check_catalog_phase_idx").on(table.phase),
  categoryIdx: index("gate_check_catalog_category_idx").on(table.category),
}));

// Project Phase Gates - Per-project gate status tracking
export const projectPhaseGates = pgTable("project_phase_gates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectId: uuid("project_id").notNull(), // Logical ref → portfolioProjects.id

  currentPhase: varchar("current_phase", { length: 50 }).notNull().default("intake"),
  targetPhase: varchar("target_phase", { length: 50 }), // Phase attempting to transition to

  // Readiness metrics
  readinessScore: integer("readiness_score").notNull().default(0), // 0-100
  criticalChecksPassed: integer("critical_checks_passed").notNull().default(0),
  criticalChecksTotal: integer("critical_checks_total").notNull().default(0),
  totalChecksPassed: integer("total_checks_passed").notNull().default(0),
  totalChecksCount: integer("total_checks_count").notNull().default(0),

  // Status
  gateStatus: varchar("gate_status", { length: 50 }).notNull().default("not_started"),

  // Lock/unlock
  isLocked: boolean("is_locked").notNull().default(false),
  lockReason: text("lock_reason"),
  lockedBy: uuid("locked_by").references(() => users.id),
  lockedAt: timestamp("locked_at"),

  // Deadline tracking
  targetDate: timestamp("target_date"),
  extensionCount: integer("extension_count").notNull().default(0),

  // AI-generated insights
  readinessSummary: text("readiness_summary"),
  blockersSummary: text("blockers_summary"),
  recommendedActions: jsonb("recommended_actions"), // [{action, priority, estimatedEffort}]

  lastCheckedAt: timestamp("last_checked_at"),
  lastCheckedBy: uuid("last_checked_by").references(() => users.id),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectIdx: index("project_phase_gates_project_idx").on(table.projectId),
  phaseIdx: index("project_phase_gates_phase_idx").on(table.currentPhase),
  statusIdx: index("project_phase_gates_status_idx").on(table.gateStatus),
  unique: unique("project_phase_gates_project_unique").on(table.projectId),
}));

// Gate Check Results - Individual check results per project/phase
export const gateCheckResults = pgTable("gate_check_results", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectGateId: uuid("project_gate_id").notNull().references(() => projectPhaseGates.id, { onDelete: 'cascade' }),
  checkCatalogId: uuid("check_catalog_id").notNull().references(() => gateCheckCatalog.id),

  status: varchar("status", { length: 50 }).notNull().default("pending"),

  // Verification details
  verifiedAt: timestamp("verified_at"),
  verifiedBy: uuid("verified_by").references(() => users.id),
  verificationMethod: varchar("verification_method", { length: 50 }), // 'auto', 'manual', 'waived'

  // Results
  score: integer("score"), // 0-100 for this specific check
  notes: text("notes"),
  failureReason: text("failure_reason"),

  // Evidence
  evidenceLinks: jsonb("evidence_links"), // [{type, url, name, uploadedAt}]
  attachmentIds: text("attachment_ids").array(),

  // Waiver info (if waived)
  waivedBy: uuid("waived_by").references(() => users.id),
  waivedAt: timestamp("waived_at"),
  waiverReason: text("waiver_reason"),
  waiverExpiry: timestamp("waiver_expiry"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  gateIdx: index("gate_check_results_gate_idx").on(table.projectGateId),
  catalogIdx: index("gate_check_results_catalog_idx").on(table.checkCatalogId),
  statusIdx: index("gate_check_results_status_idx").on(table.status),
  unique: unique("gate_check_results_unique").on(table.projectGateId, table.checkCatalogId),
}));

// Gate Approvals - PMO decision audit trail
export const gateApprovals = pgTable("gate_approvals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectGateId: uuid("project_gate_id").notNull().references(() => projectPhaseGates.id, { onDelete: 'cascade' }),

  fromPhase: varchar("from_phase", { length: 50 }).notNull(),
  toPhase: varchar("to_phase", { length: 50 }).notNull(),

  // Decision
  decision: varchar("decision", { length: 50 }).notNull(), // 'approved', 'rejected', 'deferred', 'conditional'
  decisionDate: timestamp("decision_date").notNull().defaultNow(),

  // Approver details
  approverId: uuid("approver_id").notNull().references(() => users.id),
  approverRole: varchar("approver_role", { length: 100 }),

  // Delegation (if applicable)
  delegatedFrom: uuid("delegated_from").references(() => users.id),
  delegationReason: text("delegation_reason"),

  // Decision details
  comments: text("comments"),
  conditions: jsonb("conditions"), // [{condition, deadline, status}]

  // Scores at time of decision
  readinessScoreAtDecision: integer("readiness_score_at_decision"),
  criticalPassedAtDecision: integer("critical_passed_at_decision"),

  // Digital signature (for compliance)
  signatureHash: text("signature_hash"),
  signedAt: timestamp("signed_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  gateIdx: index("gate_approvals_gate_idx").on(table.projectGateId),
  approverIdx: index("gate_approvals_approver_idx").on(table.approverId),
  decisionIdx: index("gate_approvals_decision_idx").on(table.decision),
  dateIdx: index("gate_approvals_date_idx").on(table.decisionDate),
}));

// Gate Audit Log - All gate-related activities
export const gateAuditLog = pgTable("gate_audit_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  projectGateId: uuid("project_gate_id").notNull().references(() => projectPhaseGates.id, { onDelete: 'cascade' }),

  action: varchar("action", { length: 100 }).notNull(), // 'check_passed', 'check_failed', 'approval_requested', 'approved', 'rejected', etc.

  actorId: uuid("actor_id").references(() => users.id),
  actorType: varchar("actor_type", { length: 50 }).notNull().default("user"), // 'user', 'system', 'ai'

  details: jsonb("details"), // Action-specific details

  previousState: jsonb("previous_state"),
  newState: jsonb("new_state"),

  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  gateIdx: index("gate_audit_log_gate_idx").on(table.projectGateId),
  actionIdx: index("gate_audit_log_action_idx").on(table.action),
  actorIdx: index("gate_audit_log_actor_idx").on(table.actorId),
  dateIdx: index("gate_audit_log_date_idx").on(table.createdAt),
}));

// Insert Schemas for Gate System
export const insertGateCheckCatalogSchema = createInsertSchema(gateCheckCatalog).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  phase: z.enum(GATE_PHASES),
  name: z.string().min(1, "Check name is required"),
  weight: z.number().min(1).max(100).default(10),
});

export const insertProjectPhaseGateSchema = createInsertSchema(projectPhaseGates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  currentPhase: z.enum(GATE_PHASES).default("intake"),
  gateStatus: z.enum(GATE_STATUS).default("not_started"),
});

export const insertGateCheckResultSchema = createInsertSchema(gateCheckResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(GATE_CHECK_STATUS).default("pending"),
});

export const insertGateApprovalSchema = createInsertSchema(gateApprovals).omit({
  id: true,
  createdAt: true,
}).extend({
  decision: z.enum(["approved", "rejected", "deferred", "conditional"]),
  fromPhase: z.enum(GATE_PHASES),
  toPhase: z.enum(GATE_PHASES),
});

// Type Exports for Gate System
export type GateCheckCatalog = typeof gateCheckCatalog.$inferSelect;
export type InsertGateCheckCatalog = z.infer<typeof insertGateCheckCatalogSchema>;

export type ProjectPhaseGate = typeof projectPhaseGates.$inferSelect;
export type InsertProjectPhaseGate = z.infer<typeof insertProjectPhaseGateSchema>;

export type GateCheckResult = typeof gateCheckResults.$inferSelect;
export type InsertGateCheckResult = z.infer<typeof insertGateCheckResultSchema>;

export type GateApproval = typeof gateApprovals.$inferSelect;
export type InsertGateApproval = z.infer<typeof insertGateApprovalSchema>;

export type GateAuditLog = typeof gateAuditLog.$inferSelect;



// ============================================================================
