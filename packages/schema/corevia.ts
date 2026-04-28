/** @module intelligence — Schema owner. Only this module may write to these tables. */
/**
 * Schema domain: corevia
 * Auto-extracted from shared/schema.ts
 */
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, serial, timestamp, boolean, index, numeric, real, doublePrecision, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./platform";

// ENTERPRISE DECISION BRAIN - Core Decision Infrastructure
// The Brain is decision infrastructure, not an AI assistant
// LLMs are replaceable cognitive components, never the authority
// ============================================================================

// Decision Request Types
export const DECISION_TYPES = [
  'business_case',
  'strategic_fit',
  'requirements_analysis',
  'financial_model',
  'tender_generation',
  'vendor_evaluation',
  'contract_composer',
  'team_recommendation',
  'wbs_generation',
  'portfolio_optimization',
  'synergy_detection',
  'innovation_recommendation',
  'knowledge_assistant',
  'document_analysis',
  'general_query'
] as const;

export const DECISION_STATUS = [
  'intake',           // Request received, being normalized
  'governance_check', // Checking governance rules
  'readiness_eval',   // Evaluating decision readiness
  'blocked',          // Failed governance or readiness
  'reasoning',        // LLM/Intelligence services active
  'validation',       // Deterministic validation in progress
  'pending_approval', // Requires human approval
  'approved',         // Decision finalized and approved
  'rejected',         // Decision rejected
  'executed'          // Decision executed/implemented
] as const;

export const GOVERNANCE_ACTIONS = [
  'allow',            // Proceed to reasoning
  'require_approval', // Needs human sign-off
  'block',            // Stop - governance violation
  'escalate'          // Escalate to higher authority
] as const;

// Decision Requests - The core object that flows through the Brain
export const decisionRequests = pgTable('decision_requests', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Request Identity
  requestNumber: varchar('request_number', { length: 30 }).notNull().unique(),

  // What decision is being attempted
  decisionType: varchar('decision_type', { length: 50 }).notNull(),
  intent: text('intent').notNull(), // Original user request
  normalizedIntent: text('normalized_intent'), // Processed/clarified intent

  // Organizational Context
  organizationId: varchar('organization_id'),
  departmentId: varchar('department_id'),
  requesterId: uuid("requester_id").notNull().references(() => users.id),
  requesterRole: varchar('requester_role', { length: 100 }),

  // Impact Assessment
  financialImpact: varchar('financial_impact', { length: 30 }).default('unknown'), // low, medium, high, critical
  financialAmount: numeric('financial_amount', { precision: 15, scale: 2 }),
  regulatoryRisk: varchar('regulatory_risk', { length: 30 }).default('none'), // none, low, medium, high
  urgency: varchar('urgency', { length: 30 }).default('normal'), // low, normal, high, critical
  timeHorizon: varchar('time_horizon', { length: 30 }), // immediate, short_term, long_term

  // Constraints and Requirements
  constraints: jsonb('constraints'), // Array of constraint objects
  requiredApprovers: jsonb('required_approvers'), // Array of role IDs that must approve

  // Source Context
  sourceType: varchar('source_type', { length: 50 }), // demand_report, direct, api, workflow
  sourceId: varchar('source_id'), // ID of source entity (e.g., demand report ID)
  sourceContext: jsonb('source_context'), // Additional source metadata

  // Decision Processing Status
  status: varchar('status', { length: 30 }).notNull().default('intake'),
  currentPhase: varchar('current_phase', { length: 50 }).default('intake'),

  // Readiness Scoring
  readinessScore: integer('readiness_score'), // 0-100
  dataCompletenessScore: integer('data_completeness_score'),
  assumptionVolatilityScore: integer('assumption_volatility_score'),
  modelDisagreementScore: integer('model_disagreement_score'),
  historicalErrorScore: integer('historical_error_score'),

  // Governance
  governanceAction: varchar('governance_action', { length: 30 }),
  governanceReason: text('governance_reason'),
  governanceRuleId: varchar('governance_rule_id'),
  blockedAt: timestamp('blocked_at'),
  blockedReason: text('blocked_reason'),

  // LLM/Intelligence Configuration
  selectedProvider: varchar('selected_provider', { length: 50 }),
  selectedModel: varchar('selected_model', { length: 100 }),
  reasoningDepth: varchar('reasoning_depth', { length: 30 }).default('standard'), // minimal, standard, deep
  validationStrictness: varchar('validation_strictness', { length: 30 }).default('standard'),

  // Outcome
  decisionOutcome: jsonb('decision_outcome'), // The actual decision/result
  confidenceScore: integer('confidence_score'), // 0-100

  // Final Decision Fields (Decision Entity)
  finalRecommendation: varchar('final_recommendation', { length: 50 }), // go, no_go, defer, route_vendor, route_pmo, route_it, hybrid
  riskClass: varchar('risk_class', { length: 30 }).default('medium'), // low, medium, high, critical
  decisionOwner: varchar('decision_owner', { length: 100 }), // Role responsible for decision
  approvalAuthority: varchar('approval_authority', { length: 200 }), // Who must approve (CIO, Tender Committee, etc.)
  decisionStatus: varchar('decision_status', { length: 30 }).default('draft'), // draft, pending_approval, blocked, approved, rejected, expired
  expiryDate: timestamp('expiry_date'), // When decision expires and needs review

  // Synthesized Decision Content
  synthesizedDecision: jsonb('synthesized_decision'), // Full synthesized output from Decision Synthesizer
  whyThisRouteWon: text('why_this_route_won'), // Clear explanation of primary recommendation
  whyAlternativesLost: jsonb('why_alternatives_lost'), // Array of {route, reason}
  criticalAssumptions: jsonb('critical_assumptions'), // Assumptions that would invalidate decision if wrong
  invalidationTriggers: jsonb('invalidation_triggers'), // What would make this decision invalid

  // Decision DNA (Cognitive Memory)
  decisionDna: jsonb('decision_dna'), // Full cognitive trace: models used, routing logic, weighted criteria, gates applied
  humanOverrides: jsonb('human_overrides'), // Any manual interventions or overrides

  // Lifecycle
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),

  // Processing Metrics
  processingTimeMs: integer('processing_time_ms'),
  llmTokensUsed: integer('llm_tokens_used'),
  costEstimate: numeric('cost_estimate', { precision: 10, scale: 4 }),
}, (table) => ({
  requestNumberIdx: index('decision_request_number_idx').on(table.requestNumber),
  statusIdx: index('decision_request_status_idx').on(table.status),
  typeIdx: index('decision_request_type_idx').on(table.decisionType),
  requesterIdx: index('decision_request_requester_idx').on(table.requesterId),
  createdAtIdx: index('decision_request_created_at_idx').on(table.createdAt),
}));

// Finalized decision record - auditable source of decision outcomes
export const decisionLedger = pgTable('decision_ledger', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Link to request
  decisionRequestId: uuid("decision_request_id").notNull().references(() => decisionRequests.id),

  // Decision Identity (database requires ledger_number as NOT NULL)
  ledgerNumber: varchar('ledger_number', { length: 30 }).notNull(),
  decisionNumber: varchar('decision_number', { length: 30 }),

  // Decision Details (database requires decision_summary and recommendation as NOT NULL)
  decisionType: varchar('decision_type', { length: 50 }).notNull(),
  decisionSummary: text('decision_summary').notNull(),
  recommendation: varchar('recommendation', { length: 50 }).notNull(),
  summary: text('summary'), // Legacy column
  rationale: text('rationale'), // Explanation of why this decision was made

  // Owner and Accountability
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  ownerRole: varchar('owner_role', { length: 100 }),
  accountableDepartment: varchar('accountable_department', { length: 200 }),

  // Confidence and Quality
  confidenceScore: integer('confidence_score').notNull(), // 0-100
  qualityScore: integer('quality_score'), // Validation quality
  readinessScoreAtDecision: integer('readiness_score_at_decision'),

  // Key Drivers
  keyDrivers: jsonb('key_drivers'), // Array of factors that influenced decision
  risksIdentified: jsonb('risks_identified'), // Risks flagged during decision
  caveats: jsonb('caveats'), // Important caveats/limitations

  // What would change this decision
  sensitivityFactors: jsonb('sensitivity_factors'),

  // Approval Chain
  approvalRequired: boolean('approval_required').notNull().default(false),
  approvalStatus: varchar('approval_status', { length: 30 }).default('not_required'), // not_required, pending, approved, rejected
  approvedById: uuid("approved_by_id").references(() => users.id),
  approvedAt: timestamp('approved_at'),

  // Validity and Expiry
  validFrom: timestamp('valid_from').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'), // When decision should be reviewed
  reviewDate: timestamp('review_date'), // Scheduled review date

  // Outcome Tracking
  outcomeStatus: varchar('outcome_status', { length: 30 }).default('pending'), // pending, in_progress, succeeded, failed, superseded
  outcomeNotes: text('outcome_notes'),
  actualOutcome: jsonb('actual_outcome'), // What actually happened
  outcomeRecordedAt: timestamp('outcome_recorded_at'),

  // Reality Feedback
  feedbackScore: integer('feedback_score'), // Post-implementation score
  lessonsLearned: text('lessons_learned'),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  requestIdx: index('decision_ledger_request_idx').on(table.decisionRequestId),
  numberIdx: index('decision_ledger_number_idx').on(table.decisionNumber),
  ownerIdx: index('decision_ledger_owner_idx').on(table.ownerId),
  outcomeIdx: index('decision_ledger_outcome_idx').on(table.outcomeStatus),
  createdAtIdx: index('decision_ledger_created_at_idx').on(table.createdAt),
}));

// Decision Assumptions - Explicit, versioned assumptions
export const decisionAssumptions = pgTable('decision_assumptions', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Links
  decisionRequestId: uuid("decision_request_id").references(() => decisionRequests.id),
  decisionLedgerId: uuid("decision_ledger_id").references(() => decisionLedger.id),

  // Assumption Identity
  assumptionCode: varchar('assumption_code', { length: 30 }).notNull(),
  version: integer('version').notNull().default(1),

  // Content
  category: varchar('category', { length: 50 }).notNull(), // financial, operational, strategic, regulatory, technical
  statement: text('statement').notNull(),
  rationale: text('rationale'), // Why this assumption was made

  // Confidence and Source
  confidenceLevel: integer('confidence_level').notNull(), // 0-100
  source: varchar('source', { length: 100 }), // Where assumption came from
  sourceEvidence: text('source_evidence'),

  // Validation
  validated: boolean('validated').notNull().default(false),
  validatedById: uuid("validated_by_id").references(() => users.id),
  validatedAt: timestamp('validated_at'),
  validationMethod: varchar('validation_method', { length: 100 }),

  // Sensitivity
  impactIfWrong: varchar('impact_if_wrong', { length: 30 }).default('medium'), // low, medium, high, critical
  sensitivityRating: integer('sensitivity_rating'), // How much decision changes if assumption wrong

  // Decay Tracking
  decayRate: varchar('decay_rate', { length: 30 }).default('slow'), // none, slow, medium, fast
  decayTrigger: varchar('decay_trigger', { length: 50 }), // time, kpi_miss, policy_change, market_shift, regulatory_update
  decayTriggerConfig: jsonb('decay_trigger_config'), // Config for trigger (e.g., {days: 90} for time, {kpi: 'revenue', threshold: -10})
  lastValidityCheck: timestamp('last_validity_check'),
  currentValidity: integer('current_validity'), // 0-100, decreases over time

  // Impact Classification
  impactLevel: varchar('impact_level', { length: 30 }).default('medium'), // low, medium, high, critical
  impactDescription: text('impact_description'), // What happens if assumption is wrong

  // Cross-Demand Reuse
  isReusable: boolean('is_reusable').notNull().default(false), // Can this assumption be reused across demands
  reusableScope: varchar('reusable_scope', { length: 50 }), // organization, department, industry, universal
  linkedAssumptionIds: jsonb('linked_assumption_ids'), // Array of related assumption IDs from other demands
  parentAssumptionId: varchar('parent_assumption_id'), // If derived from another assumption

  // Lifecycle
  status: varchar('status', { length: 30 }).notNull().default('active'), // active, superseded, invalidated
  supersededById: varchar('superseded_by_id'),
  invalidatedAt: timestamp('invalidated_at'),
  invalidationReason: text('invalidation_reason'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  requestIdx: index('decision_assumptions_request_idx').on(table.decisionRequestId),
  ledgerIdx: index('decision_assumptions_ledger_idx').on(table.decisionLedgerId),
  categoryIdx: index('decision_assumptions_category_idx').on(table.category),
  statusIdx: index('decision_assumptions_status_idx').on(table.status),
}));

// Risk Early Warnings - Proactive risk detection
export const riskWarnings = pgTable('risk_warnings', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Warning Type
  type: varchar('type', { length: 50 }).notNull(),
  // assumption_decay, decision_expiry, outcome_variance, approval_delay, similar_failure, budget_overrun, readiness_drop

  severity: varchar('severity', { length: 20 }).notNull(), // low, medium, high, critical
  title: varchar('title', { length: 200 }).notNull(),
  message: text('message').notNull(),

  // Source Reference
  sourceType: varchar('source_type', { length: 30 }).notNull(), // assumption, decision, demand, project
  sourceId: varchar('source_id').notNull(),
  sourceName: varchar('source_name', { length: 200 }),

  // Metric Details
  metric: varchar('metric', { length: 100 }),
  currentValue: doublePrecision('current_value'),
  thresholdValue: doublePrecision('threshold_value'),

  // Action
  recommendedAction: text('recommended_action'),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('active'), // active, acknowledged, resolved, dismissed

  // Timestamps
  detectedAt: timestamp('detected_at').notNull().defaultNow(),
  acknowledgedAt: timestamp('acknowledged_at'),
  acknowledgedBy: uuid("acknowledged_by").references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolution: text('resolution'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  typeIdx: index('risk_warnings_type_idx').on(table.type),
  severityIdx: index('risk_warnings_severity_idx').on(table.severity),
  statusIdx: index('risk_warnings_status_idx').on(table.status),
  sourceIdx: index('risk_warnings_source_idx').on(table.sourceType, table.sourceId),
  detectedAtIdx: index('risk_warnings_detected_at_idx').on(table.detectedAt),
}));

export type RiskWarning = typeof riskWarnings.$inferSelect;
export type InsertRiskWarning = typeof riskWarnings.$inferInsert;

// Governance Rules - Control decision flow
export const governanceRules = pgTable('governance_rules', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Rule Identity
  ruleCode: varchar('rule_code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),

  // Rule Scope
  decisionTypes: jsonb('decision_types'), // Which decision types this applies to (null = all)
  departments: jsonb('departments'), // Which departments (null = all)

  // Rule Conditions
  conditions: jsonb('conditions').notNull(), // Array of condition objects
  // Condition example: {field: 'financialAmount', operator: 'gt', value: 1000000}

  // Rule Action
  action: varchar('action', { length: 30 }).notNull(), // allow, require_approval, block, escalate
  actionConfig: jsonb('action_config'), // Additional action configuration

  // Thresholds
  readinessThreshold: integer('readiness_threshold'), // Min readiness score to proceed
  confidenceThreshold: integer('confidence_threshold'), // Min confidence to auto-approve

  // Mandatory Requirements
  mandatoryScenarios: jsonb('mandatory_scenarios'), // Scenarios that must be run
  humanInLoopRequired: boolean('human_in_loop_required').notNull().default(false),

  // Priority (for rule conflict resolution)
  priority: integer('priority').notNull().default(100), // Higher = evaluated first

  // Status
  isActive: boolean('is_active').notNull().default(true),
  effectiveFrom: timestamp('effective_from').defaultNow(),
  effectiveUntil: timestamp('effective_until'),

  // Metadata
  createdById: uuid("created_by_id").references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  codeIdx: index('governance_rules_code_idx').on(table.ruleCode),
  activeIdx: index('governance_rules_active_idx').on(table.isActive),
  priorityIdx: index('governance_rules_priority_idx').on(table.priority),
}));

// Decision Brain Audit Log - Complete audit trail
export const decisionBrainAudit = pgTable('decision_brain_audit', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Links
  decisionRequestId: uuid("decision_request_id").references(() => decisionRequests.id),
  decisionLedgerId: uuid("decision_ledger_id").references(() => decisionLedger.id),

  // Event
  eventType: varchar('event_type', { length: 50 }).notNull(),
  // intake_received, governance_evaluated, readiness_scored, reasoning_started,
  // validation_completed, approval_requested, approved, rejected, outcome_recorded

  eventDescription: text('event_description'),

  // Actor
  actorId: uuid("actor_id").references(() => users.id),
  actorType: varchar('actor_type', { length: 30 }).notNull().default('user'), // user, system, ai, governance
  actorProvider: varchar('actor_provider', { length: 50 }), // anthropic, openai, falcon, etc.

  // State Changes
  previousState: jsonb('previous_state'),
  newState: jsonb('new_state'),
  changedFields: jsonb('changed_fields'),

  // Governance Context
  governanceRuleId: uuid("governance_rule_id").references(() => governanceRules.id),
  governanceOutcome: varchar('governance_outcome', { length: 30 }),

  // Scores at time of event
  readinessScore: integer('readiness_score'),
  confidenceScore: integer('confidence_score'),

  // Technical Context
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  requestIdx: index('decision_brain_audit_request_idx').on(table.decisionRequestId),
  ledgerIdx: index('decision_brain_audit_ledger_idx').on(table.decisionLedgerId),
  eventTypeIdx: index('decision_brain_audit_event_idx').on(table.eventType),
  createdAtIdx: index('decision_brain_audit_created_at_idx').on(table.createdAt),
}));

// ML Models - Persisted machine learning model state for InternalIntelligenceEngine
export const mlModels = pgTable('ml_models', {
  id: uuid("id").primaryKey(),

  // Model Identification
  version: integer('version').notNull(),
  modelType: varchar('model_type', { length: 50 }).notNull(), // intelligence_engine, etc.

  // Serialized Model State
  modelState: jsonb('model_state').notNull(), // Full serialized model including weights, training examples, etc.

  // Performance Metrics
  accuracy: real('accuracy'), // Validation accuracy 0-1
  precision: real('precision'),
  recall: real('recall'),
  f1Score: real('f1_score'),

  // Training Info
  trainingExamplesCount: integer('training_examples_count'),
  vocabularySize: integer('vocabulary_size'),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at'),
}, (table) => ({
  versionIdx: index('ml_models_version_idx').on(table.version),
  typeIdx: index('ml_models_type_idx').on(table.modelType),
  createdAtIdx: index('ml_models_created_at_idx').on(table.createdAt),
}));

export type MlModel = typeof mlModels.$inferSelect;
export type InsertMlModel = typeof mlModels.$inferInsert;

// LLM Provider Configuration - Configurable AI providers for the Decision Brain
export const llmProviderConfigs = pgTable('llm_provider_configs', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Provider Details
  providerCode: varchar('provider_code', { length: 50 }).notNull().unique(), // anthropic, openai, falcon, azure_openai, local_falcon
  providerName: varchar('provider_name', { length: 100 }).notNull(),
  providerType: varchar('provider_type', { length: 30 }).notNull(), // cloud, private, local, hybrid

  // Model Configuration
  defaultModel: varchar('default_model', { length: 100 }).notNull(),
  availableModels: jsonb('available_models').notNull().default([]), // Array of model names

  // API Configuration
  apiEndpoint: varchar('api_endpoint', { length: 500 }),
  apiVersion: varchar('api_version', { length: 20 }),
  authType: varchar('auth_type', { length: 30 }).notNull().default('api_key'), // api_key, oauth, certificate, none
  secretKeyName: varchar('secret_key_name', { length: 100 }), // Name of the secret storing the API key (e.g., "ANTHROPIC_API_KEY")

  // Security Classification
  securityLevel: varchar('security_level', { length: 30 }).notNull(), // public, internal, confidential, secret, top_secret
  dataSovereignty: varchar('data_sovereignty', { length: 50 }), // uae, gcc, international
  isDataSovereign: boolean('is_data_sovereign').notNull().default(false), // True if data never leaves UAE

  // Capabilities
  maxTokens: integer('max_tokens').default(4096),
  supportsStreaming: boolean('supports_streaming').notNull().default(true),
  supportsTools: boolean('supports_tools').notNull().default(true),
  costPerMillionTokens: integer('cost_per_million_tokens'), // In cents

  // Status
  isActive: boolean('is_active').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(false),
  priority: integer('priority').notNull().default(100), // For load balancing/fallback

  // Health
  lastHealthCheck: timestamp('last_health_check'),
  healthStatus: varchar('health_status', { length: 20 }).default('unknown'), // healthy, degraded, offline, unknown

  // Metadata
  createdById: uuid("created_by_id").references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  codeIdx: index('llm_provider_code_idx').on(table.providerCode),
  typeIdx: index('llm_provider_type_idx').on(table.providerType),
  securityIdx: index('llm_provider_security_idx').on(table.securityLevel),
  activeIdx: index('llm_provider_active_idx').on(table.isActive),
}));

// LLM Routing Rules - Determines which provider to use based on data classification
export const llmRoutingRules = pgTable('llm_routing_rules', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Rule Identity
  ruleCode: varchar('rule_code', { length: 50 }).notNull().unique(),
  ruleName: varchar('rule_name', { length: 200 }).notNull(),
  description: text('description'),

  // Trigger Conditions (evaluated in order of priority)
  dataClassification: varchar('data_classification', { length: 30 }), // public, internal, confidential, secret, top_secret
  departmentIds: jsonb('department_ids'), // Specific departments that trigger this rule
  decisionTypes: jsonb('decision_types'), // Specific decision types
  contentPatterns: jsonb('content_patterns'), // Regex patterns to detect sensitive content

  // Financial Thresholds
  minFinancialAmount: integer('min_financial_amount'),
  maxFinancialAmount: integer('max_financial_amount'),

  // Regulatory Flags
  regulatoryCompliance: jsonb('regulatory_compliance'), // ['uae_pdl', 'gcc_data_protection', 'nist']
  requiresAudit: boolean('requires_audit').notNull().default(false),

  // Target Provider
  providerId: uuid("provider_id").references(() => llmProviderConfigs.id).notNull(),
  fallbackProviderId: uuid("fallback_provider_id").references(() => llmProviderConfigs.id),

  // Override Settings
  forcePrivate: boolean('force_private').notNull().default(false), // Always use private LLM
  humanReviewRequired: boolean('human_review_required').notNull().default(false),

  // Priority (higher = evaluated first)
  priority: integer('priority').notNull().default(100),

  // Status
  isActive: boolean('is_active').notNull().default(true),
  effectiveFrom: timestamp('effective_from').defaultNow(),
  effectiveUntil: timestamp('effective_until'),

  // Metadata
  createdById: uuid("created_by_id").references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  codeIdx: index('llm_routing_rules_code_idx').on(table.ruleCode),
  classificationIdx: index('llm_routing_rules_classification_idx').on(table.dataClassification),
  priorityIdx: index('llm_routing_rules_priority_idx').on(table.priority),
  activeIdx: index('llm_routing_rules_active_idx').on(table.isActive),
}));

// ============================================================================
// GENERAL API CONFIGURATIONS - External Service Integrations
// Manages connections to payment gateways, email services, analytics, etc.
// ============================================================================
export const apiConfigurations = pgTable('api_configurations', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // API Identity
  apiCode: varchar('api_code', { length: 50 }).notNull().unique(), // stripe, sendgrid, twilio, etc.
  apiName: varchar('api_name', { length: 100 }).notNull(),
  description: text('description'),

  // API Category
  category: varchar('category', { length: 50 }).notNull(), // payment, email, sms, analytics, storage, notification, document, identity
  subcategory: varchar('subcategory', { length: 50 }), // e.g., payment -> gateway, processor, wallet

  // Connection Details
  baseUrl: varchar('base_url', { length: 500 }).notNull(),
  apiVersion: varchar('api_version', { length: 20 }),

  // Authentication
  authType: varchar('auth_type', { length: 30 }).notNull().default('api_key'), // api_key, bearer_token, oauth2, basic_auth, certificate, hmac
  secretKeyName: varchar('secret_key_name', { length: 100 }), // Environment variable name storing API key (e.g., "STRIPE_SECRET_KEY")
  publicKeyName: varchar('public_key_name', { length: 100 }), // For APIs requiring public/private key pairs
  webhookSecretName: varchar('webhook_secret_name', { length: 100 }), // For webhook verification

  // Environment Settings
  environment: varchar('environment', { length: 20 }).notNull().default('production'), // sandbox, test, production
  sandboxBaseUrl: varchar('sandbox_base_url', { length: 500 }), // Optional sandbox/test URL

  // Rate Limiting
  rateLimitPerMinute: integer('rate_limit_per_minute'),
  rateLimitPerDay: integer('rate_limit_per_day'),

  // Security & Compliance
  securityLevel: varchar('security_level', { length: 30 }).notNull().default('confidential'), // public, internal, confidential, secret
  dataSovereignty: varchar('data_sovereignty', { length: 50 }), // uae, gcc, international
  complianceFlags: jsonb('compliance_flags').default([]), // ['pci_dss', 'gdpr', 'uae_pdl']

  // Status & Health
  isActive: boolean('is_active').notNull().default(true),
  lastHealthCheck: timestamp('last_health_check'),
  healthStatus: varchar('health_status', { length: 20 }).default('unknown'), // healthy, degraded, offline, unknown

  // Usage Tracking
  lastUsedAt: timestamp('last_used_at'),
  totalRequests: integer('total_requests').default(0),

  // Configuration (API-specific settings)
  configOptions: jsonb('config_options').default({}), // Custom config per API type

  // Metadata
  createdById: uuid("created_by_id").references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  codeIdx: index('api_config_code_idx').on(table.apiCode),
  categoryIdx: index('api_config_category_idx').on(table.category),
  activeIdx: index('api_config_active_idx').on(table.isActive),
  environmentIdx: index('api_config_environment_idx').on(table.environment),
}));

// Insert Schema for API Configurations
export const insertApiConfigurationSchema = createInsertSchema(apiConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastHealthCheck: true,
  lastUsedAt: true,
  totalRequests: true,
}).extend({
  apiCode: z.string().min(2).max(50),
  apiName: z.string().min(2).max(100),
  category: z.enum(['payment', 'email', 'sms', 'analytics', 'storage', 'notification', 'document', 'identity', 'communication', 'ai', 'custom']),
  authType: z.enum(['api_key', 'bearer_token', 'oauth2', 'basic_auth', 'certificate', 'hmac', 'none']),
  environment: z.enum(['sandbox', 'test', 'production']).default('production'),
  securityLevel: z.enum(['public', 'internal', 'confidential', 'secret']).default('confidential'),
});

export type InsertApiConfiguration = z.infer<typeof insertApiConfigurationSchema>;
export type ApiConfiguration = typeof apiConfigurations.$inferSelect;

// API Configuration Enum Types
export type ApiConfigCategory = 'payment' | 'email' | 'sms' | 'analytics' | 'storage' | 'notification' | 'document' | 'identity' | 'communication' | 'ai' | 'custom';
export type ApiConfigAuthType = 'api_key' | 'bearer_token' | 'oauth2' | 'basic_auth' | 'certificate' | 'hmac' | 'none';
export type ApiConfigEnvironment = 'sandbox' | 'test' | 'production';
export type ApiConfigSecurityLevel = 'public' | 'internal' | 'confidential' | 'secret';

// Knowledge Feed - Documents and context uploaded to train the brain
export const knowledgeFeed = pgTable('knowledge_feed', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Feed Item Details
  feedType: varchar('feed_type', { length: 30 }).notNull(), // document, policy, template, training_data, context
  title: varchar('title', { length: 300 }).notNull(),
  description: text('description'),

  // Content
  content: text('content'),
  contentHash: varchar('content_hash', { length: 64 }), // SHA256 for deduplication
  sourceUrl: varchar('source_url', { length: 500 }),

  // Classification
  dataClassification: varchar('data_classification', { length: 30 }).notNull().default('internal'),
  category: varchar('category', { length: 100 }), // governance, strategy, technical, regulatory
  tags: jsonb('tags').default([]),

  // Processing Status
  processingStatus: varchar('processing_status', { length: 30 }).notNull().default('pending'), // pending, processing, indexed, failed
  embeddingStatus: varchar('embedding_status', { length: 30 }).default('pending'), // pending, completed, failed
  chunkCount: integer('chunk_count').default(0),

  // Vectorization
  vectorStoreId: varchar('vector_store_id', { length: 100 }),

  // Scope
  organizationId: varchar('organization_id'),
  departmentId: varchar('department_id'),
  isGlobal: boolean('is_global').notNull().default(false), // Available to all departments

  // Validity
  isActive: boolean('is_active').notNull().default(true),
  expiresAt: timestamp('expires_at'),

  // Metadata
  uploadedById: uuid("uploaded_by_id").references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  typeIdx: index('knowledge_feed_type_idx').on(table.feedType),
  classificationIdx: index('knowledge_feed_classification_idx').on(table.dataClassification),
  statusIdx: index('knowledge_feed_status_idx').on(table.processingStatus),
  hashIdx: index('knowledge_feed_hash_idx').on(table.contentHash),
}));

// Insert Schemas for LLM Configuration
export const insertLlmProviderConfigSchema = createInsertSchema(llmProviderConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  providerCode: z.string().min(2).max(50),
  providerType: z.enum(['cloud', 'private', 'local', 'hybrid']),
  securityLevel: z.enum(['public', 'internal', 'confidential', 'secret', 'top_secret']),
});

export const insertLlmRoutingRuleSchema = createInsertSchema(llmRoutingRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  ruleCode: z.string().min(2).max(50),
  priority: z.number().int().min(1).max(1000).default(100),
});

export const insertKnowledgeFeedSchema = createInsertSchema(knowledgeFeed).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  feedType: z.enum(['document', 'policy', 'template', 'training_data', 'context']),
  dataClassification: z.enum(['public', 'internal', 'confidential', 'secret', 'top_secret']),
});

// Type Exports for LLM Configuration
export type LlmProviderConfig = typeof llmProviderConfigs.$inferSelect;
export type InsertLlmProviderConfig = z.infer<typeof insertLlmProviderConfigSchema>;

export type LlmRoutingRule = typeof llmRoutingRules.$inferSelect;
export type InsertLlmRoutingRule = z.infer<typeof insertLlmRoutingRuleSchema>;

export type KnowledgeFeedItem = typeof knowledgeFeed.$inferSelect;
export type InsertKnowledgeFeedItem = z.infer<typeof insertKnowledgeFeedSchema>;

// Insert Schemas
export const insertDecisionRequestSchema = createInsertSchema(decisionRequests).omit({
  id: true,
  requestNumber: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  intent: z.string().min(10, 'Intent must be at least 10 characters'),
  decisionType: z.enum(DECISION_TYPES),
});

export const insertDecisionLedgerSchema = createInsertSchema(decisionLedger).omit({
  id: true,
  decisionNumber: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  summary: z.string().min(10, 'Summary must be at least 10 characters'),
  confidenceScore: z.number().min(0).max(100),
});

export const insertDecisionAssumptionSchema = createInsertSchema(decisionAssumptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  confidenceLevel: z.number().min(0).max(100),
  category: z.enum(['financial', 'operational', 'strategic', 'regulatory', 'technical']),
});

export const insertGovernanceRuleSchema = createInsertSchema(governanceRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  action: z.enum(['allow', 'require_approval', 'block', 'escalate']),
  priority: z.number().int().min(1).max(1000).default(100),
});

// ============================================================================
// DECISION GENOME - Complete cognitive lineage and traceability system
// ============================================================================

// Decision Lineage - Track parent-child relationships between decisions
export const decisionLineage = pgTable('decision_lineage', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Parent-Child Relationship
  parentDecisionId: uuid("parent_decision_id").references(() => decisionLedger.id),
  childDecisionId: uuid("child_decision_id").references(() => decisionLedger.id).notNull(),

  // Relationship Type
  relationshipType: varchar('relationship_type', { length: 50 }).notNull(), // derived_from, supersedes, influenced_by, dependent_on, contradicts
  relationshipStrength: integer('relationship_strength').notNull().default(50), // 0-100 how strongly related

  // Context
  inheritedAssumptions: jsonb('inherited_assumptions').default([]), // Assumption IDs inherited from parent
  inheritedRisks: jsonb('inherited_risks').default([]), // Risk IDs inherited
  varianceFromParent: jsonb('variance_from_parent'), // What changed from parent decision

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdById: uuid("created_by_id").references(() => users.id),
}, (table) => ({
  parentIdx: index('lineage_parent_idx').on(table.parentDecisionId),
  childIdx: index('lineage_child_idx').on(table.childDecisionId),
  typeIdx: index('lineage_type_idx').on(table.relationshipType),
}));

// Assumption Decay Events - Track when and why assumptions degrade
export const assumptionDecayEvents = pgTable('assumption_decay_events', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Link to Assumption
  assumptionId: uuid("assumption_id").notNull().references(() => decisionAssumptions.id),
  decisionId: uuid("decision_id").references(() => decisionLedger.id),

  // Decay Event Details
  eventType: varchar('event_type', { length: 50 }).notNull(), // time_decay, kpi_miss, policy_change, market_shift, regulatory_update, manual_invalidation
  previousConfidence: integer('previous_confidence').notNull(),
  newConfidence: integer('new_confidence').notNull(),
  decayAmount: integer('decay_amount').notNull(), // How much confidence dropped

  // Trigger Details
  triggerSource: varchar('trigger_source', { length: 100 }), // What triggered the decay
  triggerData: jsonb('trigger_data'), // Data that triggered decay (KPI values, policy IDs, etc.)

  // Impact Analysis
  affectedDecisions: jsonb('affected_decisions').default([]), // Decision IDs affected by this decay
  recommendedActions: jsonb('recommended_actions').default([]), // Suggested responses

  // Audit
  detectedAt: timestamp('detected_at').notNull().defaultNow(),
  acknowledgedAt: timestamp('acknowledged_at'),
  acknowledgedById: uuid("acknowledged_by_id").references(() => users.id),
  resolutionNotes: text('resolution_notes'),
}, (table) => ({
  assumptionIdx: index('decay_assumption_idx').on(table.assumptionId),
  decisionIdx: index('decay_decision_idx').on(table.decisionId),
  typeIdx: index('decay_type_idx').on(table.eventType),
  detectedIdx: index('decay_detected_idx').on(table.detectedAt),
}));

// Ripple Impact Map - Track cross-portfolio impact of decisions
export const rippleImpactMap = pgTable('ripple_impact_map', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Source Decision
  sourceDecisionId: uuid("source_decision_id").notNull().references(() => decisionLedger.id),

  // Impacted Entity
  impactedEntityType: varchar('impacted_entity_type', { length: 50 }).notNull(), // decision, demand, project, department, budget, timeline, kpi
  impactedEntityId: varchar('impacted_entity_id', { length: 100 }).notNull(),
  impactedEntityName: varchar('impacted_entity_name', { length: 300 }),

  // Impact Assessment
  impactType: varchar('impact_type', { length: 50 }).notNull(), // positive, negative, neutral, unknown
  impactSeverity: varchar('impact_severity', { length: 30 }).notNull().default('medium'), // low, medium, high, critical
  impactProbability: integer('impact_probability').notNull().default(50), // 0-100
  impactDescription: text('impact_description'),

  // Quantified Impact
  estimatedCostImpact: numeric('estimated_cost_impact', { precision: 15, scale: 2 }),
  estimatedTimelineImpact: integer('estimated_timeline_impact'), // Days added/removed
  estimatedRiskChange: integer('estimated_risk_change'), // -100 to +100

  // Propagation
  propagationDepth: integer('propagation_depth').notNull().default(1), // How many hops from source
  propagationPath: jsonb('propagation_path').default([]), // Chain of decisions leading here

  // Status
  status: varchar('status', { length: 30 }).notNull().default('identified'), // identified, analyzing, confirmed, mitigated, accepted
  mitigationPlan: text('mitigation_plan'),

  // Audit
  identifiedAt: timestamp('identified_at').notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at'),
  confirmedById: uuid("confirmed_by_id").references(() => users.id),
}, (table) => ({
  sourceIdx: index('ripple_source_idx').on(table.sourceDecisionId),
  entityIdx: index('ripple_entity_idx').on(table.impactedEntityType, table.impactedEntityId),
  severityIdx: index('ripple_severity_idx').on(table.impactSeverity),
  statusIdx: index('ripple_status_idx').on(table.status),
}));

// Variance Signatures - Compare decisions over time for pattern analysis
export const varianceSignatures = pgTable('variance_signatures', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Comparison Details
  decisionId: uuid("decision_id").notNull().references(() => decisionLedger.id),
  comparisonDecisionId: uuid("comparison_decision_id").references(() => decisionLedger.id),
  signatureType: varchar('signature_type', { length: 50 }).notNull(), // temporal, cross_department, same_type, similar_objective

  // Signature Vector (normalized metrics for comparison)
  signatureVector: jsonb('signature_vector').notNull(), // {confidence: 0.85, cost: 0.6, risk: 0.3, timeline: 0.7, ...}

  // Variance Metrics
  overallVariance: numeric('overall_variance', { precision: 6, scale: 4 }), // 0-1 how different
  dimensionalVariance: jsonb('dimensional_variance'), // {confidence: 0.1, cost: 0.3, ...} per-dimension variance

  // Pattern Detection
  detectedPattern: varchar('detected_pattern', { length: 100 }), // optimistic_bias, cost_underestimate, timeline_slip, etc.
  patternConfidence: integer('pattern_confidence'), // 0-100
  patternDescription: text('pattern_description'),

  // Recommendations
  recommendedAdjustments: jsonb('recommended_adjustments').default([]),
  historicalAccuracy: numeric('historical_accuracy', { precision: 5, scale: 2 }), // How accurate similar decisions were

  // Audit
  computedAt: timestamp('computed_at').notNull().defaultNow(),
}, (table) => ({
  decisionIdx: index('variance_decision_idx').on(table.decisionId),
  comparisonIdx: index('variance_comparison_idx').on(table.comparisonDecisionId),
  typeIdx: index('variance_type_idx').on(table.signatureType),
  patternIdx: index('variance_pattern_idx').on(table.detectedPattern),
}));

// Reaccreditation Alerts - Automatic alerts when decisions need review
export const reaccreditationAlerts = pgTable('reaccreditation_alerts', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Target Decision
  decisionId: uuid("decision_id").notNull().references(() => decisionLedger.id),

  // Alert Details
  alertType: varchar('alert_type', { length: 50 }).notNull(), // assumption_decay, kpi_miss, policy_change, timeline_exceeded, budget_variance, outcome_drift
  alertSeverity: varchar('alert_severity', { length: 30 }).notNull().default('medium'), // low, medium, high, critical
  alertTitle: varchar('alert_title', { length: 300 }).notNull(),
  alertDescription: text('alert_description'),

  // Trigger Details
  triggerType: varchar('trigger_type', { length: 50 }).notNull(), // automatic, manual, scheduled, event_driven
  triggerData: jsonb('trigger_data'), // Data that triggered alert
  relatedAssumptionId: uuid("related_assumption_id").references(() => decisionAssumptions.id),

  // Required Action
  requiredAction: varchar('required_action', { length: 100 }).notNull(), // review, revalidate, update, escalate, close
  actionDeadline: timestamp('action_deadline'),
  escalationPath: jsonb('escalation_path').default([]), // Who to escalate to if not resolved

  // Status
  status: varchar('status', { length: 30 }).notNull().default('open'), // open, in_review, resolved, escalated, dismissed
  assignedToId: uuid("assigned_to_id").references(() => users.id),
  assignedAt: timestamp('assigned_at'),

  // Resolution
  resolutionType: varchar('resolution_type', { length: 50 }), // revalidated, updated, superseded, accepted_as_is, dismissed_with_reason
  resolutionNotes: text('resolution_notes'),
  resolvedById: uuid("resolved_by_id").references(() => users.id),
  resolvedAt: timestamp('resolved_at'),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  decisionIdx: index('reaccred_decision_idx').on(table.decisionId),
  typeIdx: index('reaccred_type_idx').on(table.alertType),
  severityIdx: index('reaccred_severity_idx').on(table.alertSeverity),
  statusIdx: index('reaccred_status_idx').on(table.status),
  deadlineIdx: index('reaccred_deadline_idx').on(table.actionDeadline),
}));

// ============================================================================
// GOVERNANCE KNOWLEDGE GRAPH - UAE regulatory compliance network
// ============================================================================

// Governance Nodes - Regulations, policies, objectives as graph nodes
export const governanceNodes = pgTable('governance_nodes', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Node Identity
  nodeCode: varchar('node_code', { length: 50 }).notNull().unique(),
  nodeType: varchar('node_type', { length: 50 }).notNull(), // regulation, policy, objective, standard, guideline, law, framework

  // Content
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  fullText: text('full_text'), // Complete regulation/policy text

  // Classification
  jurisdiction: varchar('jurisdiction', { length: 100 }).notNull().default('UAE Federal'), // UAE Federal, Dubai, Abu Dhabi, etc.
  category: varchar('category', { length: 100 }), // cybersecurity, data_protection, procurement, finance, hr, etc.
  sector: varchar('sector', { length: 100 }), // government, healthcare, finance, education, etc.

  // Authority
  issuingAuthority: varchar('issuing_authority', { length: 200 }), // NESA, TDRA, Ministry of Finance, etc.
  effectiveDate: timestamp('effective_date'),
  expiryDate: timestamp('expiry_date'),
  version: varchar('version', { length: 20 }),

  // Compliance Requirements
  complianceMandatory: boolean('compliance_mandatory').notNull().default(true),
  complianceDeadline: timestamp('compliance_deadline'),
  penaltyForNonCompliance: text('penalty_for_non_compliance'),

  // Links
  sourceUrl: varchar('source_url', { length: 500 }),
  relatedDocuments: jsonb('related_documents').default([]),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('active'), // draft, active, superseded, repealed

  // Embedding for semantic search
  embedding: text('embedding'), // Vector embedding for semantic matching

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastReviewedAt: timestamp('last_reviewed_at'),
  reviewedById: uuid("reviewed_by_id").references(() => users.id),
}, (table) => ({
  codeIdx: index('gov_node_code_idx').on(table.nodeCode),
  typeIdx: index('gov_node_type_idx').on(table.nodeType),
  jurisdictionIdx: index('gov_node_jurisdiction_idx').on(table.jurisdiction),
  categoryIdx: index('gov_node_category_idx').on(table.category),
  statusIdx: index('gov_node_status_idx').on(table.status),
}));

// Governance Edges - Relationships between nodes
export const governanceEdges = pgTable('governance_edges', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Edge Endpoints
  sourceNodeId: uuid("source_node_id").notNull().references(() => governanceNodes.id),
  targetNodeId: uuid("target_node_id").notNull().references(() => governanceNodes.id),

  // Relationship Type
  edgeType: varchar('edge_type', { length: 50 }).notNull(), // supersedes, implements, conflicts_with, requires, exempts, references, derived_from, aligned_with
  edgeStrength: integer('edge_strength').notNull().default(50), // 0-100 relationship strength

  // Context
  relationshipDescription: text('relationship_description'),
  conflictResolution: text('conflict_resolution'), // How to resolve if edges conflict

  // Bidirectional
  isBidirectional: boolean('is_bidirectional').notNull().default(false),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('active'),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdById: uuid("created_by_id").references(() => users.id),
}, (table) => ({
  sourceIdx: index('gov_edge_source_idx').on(table.sourceNodeId),
  targetIdx: index('gov_edge_target_idx').on(table.targetNodeId),
  typeIdx: index('gov_edge_type_idx').on(table.edgeType),
}));

// Compliance Paths - Tracked compliance pathways for decisions
export const compliancePaths = pgTable('compliance_paths', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Decision Link
  decisionId: uuid("decision_id").references(() => decisionLedger.id),
  demandId: varchar('demand_id'),

  // Path Definition
  pathName: varchar('path_name', { length: 300 }).notNull(),
  pathDescription: text('path_description'),

  // Nodes in Path (ordered)
  nodeSequence: jsonb('node_sequence').notNull().default([]), // Array of {nodeId, requirement, status}

  // Compliance Status
  overallStatus: varchar('overall_status', { length: 30 }).notNull().default('pending'), // pending, in_progress, compliant, non_compliant, exempted
  complianceScore: integer('compliance_score'), // 0-100

  // Gap Analysis
  gaps: jsonb('gaps').default([]), // Array of {nodeId, requirement, gap, remediation}
  remediationPlan: jsonb('remediation_plan'),
  estimatedRemediationCost: numeric('estimated_remediation_cost', { precision: 15, scale: 2 }),
  estimatedRemediationDays: integer('estimated_remediation_days'),

  // Evidence
  evidenceDocuments: jsonb('evidence_documents').default([]), // Links to supporting documents

  // Audit
  assessedAt: timestamp('assessed_at').notNull().defaultNow(),
  assessedById: uuid("assessed_by_id").references(() => users.id),
  nextReviewDate: timestamp('next_review_date'),
}, (table) => ({
  decisionIdx: index('compliance_decision_idx').on(table.decisionId),
  demandIdx: index('compliance_demand_idx').on(table.demandId),
  statusIdx: index('compliance_status_idx').on(table.overallStatus),
}));

// ============================================================================
// ADAPTIVE ROUTING FABRIC - Learning-based LLM routing
// ============================================================================

// Routing Learning Events - Track routing decisions and outcomes for learning
export const routingLearningEvents = pgTable('routing_learning_events', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Routing Decision
  decisionRequestId: uuid("decision_request_id").references(() => decisionRequests.id),
  routingRuleId: uuid("routing_rule_id").references(() => llmRoutingRules.id),

  // Input Context
  inputDataClassification: varchar('input_data_classification', { length: 30 }).notNull(),
  inputTokenCount: integer('input_token_count'),
  inputComplexity: varchar('input_complexity', { length: 30 }), // simple, moderate, complex, highly_complex
  inputIntent: varchar('input_intent', { length: 100 }),

  // Routing Decision
  selectedProviderId: uuid("selected_provider_id").references(() => llmProviderConfigs.id),
  selectedProviderCode: varchar('selected_provider_code', { length: 50 }),
  routingReason: varchar('routing_reason', { length: 100 }), // policy_match, capability_match, cost_optimization, load_balance, fallback
  alternativeProviders: jsonb('alternative_providers').default([]), // Other providers considered

  // Performance Metrics
  responseTimeMs: integer('response_time_ms'),
  outputTokenCount: integer('output_token_count'),
  costIncurred: numeric('cost_incurred', { precision: 10, scale: 6 }),

  // Quality Metrics
  responseQualityScore: integer('response_quality_score'), // 0-100 based on validation
  factualAccuracyScore: integer('factual_accuracy_score'), // 0-100
  relevanceScore: integer('relevance_score'), // 0-100

  // Outcome
  wasSuccessful: boolean('was_successful').notNull().default(true),
  failureReason: varchar('failure_reason', { length: 200 }),
  requiredRetry: boolean('required_retry').notNull().default(false),
  retryProviderId: uuid("retry_provider_id").references(() => llmProviderConfigs.id),

  // Human Feedback
  humanOverrideApplied: boolean('human_override_applied').notNull().default(false),
  humanPreferredProvider: varchar('human_preferred_provider', { length: 50 }),
  humanFeedback: text('human_feedback'),

  // Learning Signals
  shouldRouteHerAgain: boolean('should_route_here_again'), // Based on outcome, would we route here again?
  learningWeight: numeric('learning_weight', { precision: 5, scale: 4 }).default('1.0'), // Weight for learning algorithm

  // Audit
  routedAt: timestamp('routed_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  requestIdx: index('routing_learn_request_idx').on(table.decisionRequestId),
  providerIdx: index('routing_learn_provider_idx').on(table.selectedProviderId),
  classificationIdx: index('routing_learn_classification_idx').on(table.inputDataClassification),
  successIdx: index('routing_learn_success_idx').on(table.wasSuccessful),
  routedAtIdx: index('routing_learn_routed_at_idx').on(table.routedAt),
}));

// Provider Performance Aggregates - Aggregated performance metrics per provider
export const providerPerformanceAggregates = pgTable('provider_performance_aggregates', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Provider
  providerId: uuid("provider_id").notNull().references(() => llmProviderConfigs.id),
  providerCode: varchar('provider_code', { length: 50 }).notNull(),

  // Time Window
  windowType: varchar('window_type', { length: 20 }).notNull(), // hourly, daily, weekly, monthly
  windowStart: timestamp('window_start').notNull(),
  windowEnd: timestamp('window_end').notNull(),

  // Volume Metrics
  totalRequests: integer('total_requests').notNull().default(0),
  successfulRequests: integer('successful_requests').notNull().default(0),
  failedRequests: integer('failed_requests').notNull().default(0),
  retriedRequests: integer('retried_requests').notNull().default(0),

  // Performance Metrics
  avgResponseTimeMs: numeric('avg_response_time_ms', { precision: 10, scale: 2 }),
  p50ResponseTimeMs: numeric('p50_response_time_ms', { precision: 10, scale: 2 }),
  p95ResponseTimeMs: numeric('p95_response_time_ms', { precision: 10, scale: 2 }),
  p99ResponseTimeMs: numeric('p99_response_time_ms', { precision: 10, scale: 2 }),

  // Quality Metrics
  avgQualityScore: numeric('avg_quality_score', { precision: 5, scale: 2 }),
  avgAccuracyScore: numeric('avg_accuracy_score', { precision: 5, scale: 2 }),
  avgRelevanceScore: numeric('avg_relevance_score', { precision: 5, scale: 2 }),

  // Cost Metrics
  totalCost: numeric('total_cost', { precision: 12, scale: 6 }),
  avgCostPerRequest: numeric('avg_cost_per_request', { precision: 10, scale: 6 }),
  totalTokensProcessed: integer('total_tokens_processed'),

  // Classification Breakdown
  classificationBreakdown: jsonb('classification_breakdown'), // {public: 100, internal: 50, confidential: 20}

  // Computed Metrics
  successRate: numeric('success_rate', { precision: 5, scale: 4 }),
  effectivenessScore: numeric('effectiveness_score', { precision: 5, scale: 2 }), // Composite score
  recommendedWeight: numeric('recommended_weight', { precision: 5, scale: 4 }), // Suggested routing weight

  // Audit
  computedAt: timestamp('computed_at').notNull().defaultNow(),
}, (table) => ({
  providerIdx: index('perf_agg_provider_idx').on(table.providerId),
  windowIdx: index('perf_agg_window_idx').on(table.windowType, table.windowStart),
}));

// Insert Schemas for Decision Genome
export const insertDecisionLineageSchema = createInsertSchema(decisionLineage).omit({
  id: true,
  createdAt: true,
}).extend({
  relationshipType: z.enum(['derived_from', 'supersedes', 'influenced_by', 'dependent_on', 'contradicts']),
  relationshipStrength: z.number().min(0).max(100).default(50),
});

export const insertAssumptionDecayEventSchema = createInsertSchema(assumptionDecayEvents).omit({
  id: true,
  detectedAt: true,
}).extend({
  eventType: z.enum(['time_decay', 'kpi_miss', 'policy_change', 'market_shift', 'regulatory_update', 'manual_invalidation']),
});

export const insertRippleImpactMapSchema = createInsertSchema(rippleImpactMap).omit({
  id: true,
  identifiedAt: true,
}).extend({
  impactedEntityType: z.enum(['decision', 'demand', 'project', 'department', 'budget', 'timeline', 'kpi']),
  impactType: z.enum(['positive', 'negative', 'neutral', 'unknown']),
  impactSeverity: z.enum(['low', 'medium', 'high', 'critical']),
});

export const insertReaccreditationAlertSchema = createInsertSchema(reaccreditationAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  alertType: z.enum(['assumption_decay', 'kpi_miss', 'policy_change', 'timeline_exceeded', 'budget_variance', 'outcome_drift']),
  alertSeverity: z.enum(['low', 'medium', 'high', 'critical']),
  requiredAction: z.enum(['review', 'revalidate', 'update', 'escalate', 'close']),
});

// Insert Schemas for Governance Knowledge Graph
export const insertGovernanceNodeSchema = createInsertSchema(governanceNodes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  nodeType: z.enum(['regulation', 'policy', 'objective', 'standard', 'guideline', 'law', 'framework']),
});

export const insertGovernanceEdgeSchema = createInsertSchema(governanceEdges).omit({
  id: true,
  createdAt: true,
}).extend({
  edgeType: z.enum(['supersedes', 'implements', 'conflicts_with', 'requires', 'exempts', 'references', 'derived_from', 'aligned_with']),
});

export const insertCompliancePathSchema = createInsertSchema(compliancePaths).omit({
  id: true,
  assessedAt: true,
}).extend({
  overallStatus: z.enum(['pending', 'in_progress', 'compliant', 'non_compliant', 'exempted']),
});

// Insert Schema for Routing Learning
export const insertRoutingLearningEventSchema = createInsertSchema(routingLearningEvents).omit({
  id: true,
  routedAt: true,
}).extend({
  inputDataClassification: z.enum(['public', 'internal', 'confidential', 'secret', 'top_secret']),
});

// Type Exports for Decision Genome
export type DecisionLineage = typeof decisionLineage.$inferSelect;
export type InsertDecisionLineage = z.infer<typeof insertDecisionLineageSchema>;

export type AssumptionDecayEvent = typeof assumptionDecayEvents.$inferSelect;
export type InsertAssumptionDecayEvent = z.infer<typeof insertAssumptionDecayEventSchema>;

export type RippleImpactEntry = typeof rippleImpactMap.$inferSelect;
export type InsertRippleImpactEntry = z.infer<typeof insertRippleImpactMapSchema>;

export type VarianceSignature = typeof varianceSignatures.$inferSelect;

export type ReaccreditationAlert = typeof reaccreditationAlerts.$inferSelect;
export type InsertReaccreditationAlert = z.infer<typeof insertReaccreditationAlertSchema>;

// Type Exports for Governance Knowledge Graph
export type GovernanceNode = typeof governanceNodes.$inferSelect;
export type InsertGovernanceNode = z.infer<typeof insertGovernanceNodeSchema>;

export type GovernanceEdge = typeof governanceEdges.$inferSelect;
export type InsertGovernanceEdge = z.infer<typeof insertGovernanceEdgeSchema>;

export type CompliancePath = typeof compliancePaths.$inferSelect;
export type InsertCompliancePath = z.infer<typeof insertCompliancePathSchema>;

// Type Exports for Adaptive Routing
export type RoutingLearningEvent = typeof routingLearningEvents.$inferSelect;
export type InsertRoutingLearningEvent = z.infer<typeof insertRoutingLearningEventSchema>;

export type ProviderPerformanceAggregate = typeof providerPerformanceAggregates.$inferSelect;

// Type Exports
export type DecisionRequest = typeof decisionRequests.$inferSelect;
export type InsertDecisionRequest = z.infer<typeof insertDecisionRequestSchema>;

export type DecisionLedgerEntry = typeof decisionLedger.$inferSelect;
export type InsertDecisionLedgerEntry = z.infer<typeof insertDecisionLedgerSchema>;

export type DecisionAssumption = typeof decisionAssumptions.$inferSelect;
export type InsertDecisionAssumption = z.infer<typeof insertDecisionAssumptionSchema>;

export type GovernanceRule = typeof governanceRules.$inferSelect;
export type InsertGovernanceRule = z.infer<typeof insertGovernanceRuleSchema>;

export type DecisionBrainAuditEntry = typeof decisionBrainAudit.$inferSelect;

// ========== LAYER CONFIGURATIONS ==========
// Persisted configuration for Decision Brain layers

export const layerConfigurations = pgTable('layer_configurations', {
  id: serial('id').primaryKey(),
  layerKey: varchar('layer_key', { length: 50 }).notNull().unique(),
  config: jsonb('config').notNull(),
  version: integer('version').notNull().default(1),
  updatedBy: varchar('updated_by', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  layerKeyIdx: index('layer_config_key_idx').on(table.layerKey),
}));

export const insertLayerConfigurationSchema = createInsertSchema(layerConfigurations).omit({
  id: true,
  version: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  layerKey: z.enum(['intake', 'friction', 'readiness', 'routing', 'reasoning', 'synthesis', 'ledger']),
  config: z.record(z.unknown()),
});

export type LayerConfiguration = typeof layerConfigurations.$inferSelect;
export type InsertLayerConfiguration = z.infer<typeof insertLayerConfigurationSchema>;

// ========== DECISION BRAIN AGENTS ==========
// AI Agents for the Decision Brain multi-agent orchestration system

export const decisionBrainAgents = pgTable('decision_brain_agents', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  agentType: varchar('agent_type', { length: 50 }).notNull(),
  description: text('description'),
  modelProvider: varchar('model_provider', { length: 50 }).notNull().default('anthropic'),
  modelName: varchar('model_name', { length: 100 }).notNull().default('claude-3-5-sonnet-20241022'),
  temperature: real('temperature').notNull().default(0.7),
  topP: real('top_p').notNull().default(0.95),
  maxTokens: integer('max_tokens').notNull().default(4096),
  systemPrompt: text('system_prompt'),
  routingHints: jsonb('routing_hints'),
  executionTimeoutSec: integer('execution_timeout_sec').notNull().default(120),
  retryLimit: integer('retry_limit').notNull().default(2),
  confidenceThreshold: real('confidence_threshold').notNull().default(0.7),
  enableMultiStep: boolean('enable_multi_step').notNull().default(false),
  tags: text('tags').array(),
  enabled: boolean('enabled').notNull().default(true),
  priority: integer('priority').notNull().default(0),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  agentCodeIdx: index('agent_code_idx').on(table.code),
  agentTypeIdx: index('agent_type_idx').on(table.agentType),
  agentEnabledIdx: index('agent_enabled_idx').on(table.enabled),
}));

export const insertDecisionBrainAgentSchema = createInsertSchema(decisionBrainAgents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2).max(50).regex(/^[a-z0-9_]+$/, 'Code must be lowercase alphanumeric with underscores'),
  agentType: z.enum(['analyzer', 'generator', 'validator', 'synthesizer', 'evaluator', 'coordinator', 'specialist']),
  description: z.string().optional(),
  modelProvider: z.enum(['anthropic', 'openai', 'falcon', 'local']).default('anthropic'),
  modelName: z.string().default('claude-3-5-sonnet-20241022'),
  temperature: z.number().min(0).max(2).default(0.7),
  topP: z.number().min(0).max(1).default(0.95),
  maxTokens: z.number().min(100).max(32000).default(4096),
  systemPrompt: z.string().optional(),
  routingHints: z.record(z.unknown()).optional(),
  executionTimeoutSec: z.number().min(10).max(600).default(120),
  retryLimit: z.number().min(0).max(5).default(2),
  confidenceThreshold: z.number().min(0).max(1).default(0.7),
  enableMultiStep: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
  priority: z.number().min(0).max(100).default(0),
  createdBy: z.string().optional(),
});

export const updateDecisionBrainAgentSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  modelProvider: z.enum(['anthropic', 'openai', 'falcon', 'local']).optional(),
  modelName: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxTokens: z.number().min(100).max(32000).optional(),
  systemPrompt: z.string().optional(),
  routingHints: z.record(z.unknown()).optional(),
  executionTimeoutSec: z.number().min(10).max(600).optional(),
  retryLimit: z.number().min(0).max(5).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  enableMultiStep: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().min(0).max(100).optional(),
});

export type DecisionBrainAgent = typeof decisionBrainAgents.$inferSelect;
export type InsertDecisionBrainAgent = z.infer<typeof insertDecisionBrainAgentSchema>;
export type UpdateDecisionBrainAgent = z.infer<typeof updateDecisionBrainAgentSchema>;

// ========== DECISION AGENT RUNS ==========
// Tracks individual agent executions during decision processing

export const decisionAgentRuns = pgTable('decision_agent_runs', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar('request_id').notNull(),
  agentId: varchar('agent_id').notNull(),
  agentCode: varchar('agent_code', { length: 50 }).notNull(),
  agentName: varchar('agent_name', { length: 100 }).notNull(),
  agentType: varchar('agent_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  modelProvider: varchar('model_provider', { length: 50 }).notNull(),
  modelName: varchar('model_name', { length: 100 }).notNull(),
  inputPrompt: text('input_prompt'),
  output: text('output'),
  outputStructured: jsonb('output_structured'),
  confidenceScore: real('confidence_score'),
  tokensUsed: integer('tokens_used'),
  latencyMs: integer('latency_ms'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  requestIdIdx: index('agent_run_request_idx').on(table.requestId),
  agentIdIdx: index('agent_run_agent_idx').on(table.agentId),
  statusIdx: index('agent_run_status_idx').on(table.status),
}));

export type DecisionAgentRun = typeof decisionAgentRuns.$inferSelect;

// ============================================================================
// COREVIA PROUD EDITION - SELF-VALIDATING OUTPUT CERTIFICATE
// ============================================================================

export const decisionCertificates = pgTable('decision_certificates', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Decision Reference
  decisionLedgerId: uuid("decision_ledger_id").notNull().references(() => decisionLedger.id),

  // Certificate Content
  evidenceCoveragePct: real('evidence_coverage_pct').notNull(), // % claims with evidence
  complianceStatus: varchar('compliance_status', { length: 20 }).notNull(), // pass, conditional, fail
  sovereigntyStatus: varchar('sovereignty_status', { length: 30 }).notNull(), // sovereign_only, hybrid_split, cloud_ok
  confidenceGrade: varchar('confidence_grade', { length: 1 }).notNull(), // A, B, C

  // Replay Capability
  replayId: varchar('replay_id', { length: 64 }).notNull().unique(),
  replayable: boolean('replayable').notNull().default(true),

  // Validity
  generatedAt: timestamp('generated_at').notNull().defaultNow(),
  validUntil: timestamp('valid_until'),

  // UAE Compliance Stamp
  uaeVision2071Aligned: boolean('uae_vision_2071_aligned').notNull().default(false),
  dataSovereigntyEnforced: boolean('data_sovereignty_enforced').notNull().default(false),

  // Signature (for verification)
  signatureHash: varchar('signature_hash', { length: 128 }),
  signedById: uuid("signed_by_id").references(() => users.id),

  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  decisionIdx: index('dc_decision_idx').on(table.decisionLedgerId),
  replayIdIdx: index('dc_replay_idx').on(table.replayId),
  complianceIdx: index('dc_compliance_idx').on(table.complianceStatus),
}));

// ============================================================================
// COREVIA PROUD EDITION - DECISION GENOME DIGITAL TWIN (AUDIT PACK)
// ============================================================================

export const decisionAuditPacks = pgTable('decision_audit_packs', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  // Trace Reference
  traceId: varchar('trace_id', { length: 64 }).notNull().unique(),
  decisionLedgerId: uuid("decision_ledger_id").notNull().references(() => decisionLedger.id),
  certificateId: uuid("certificate_id").references(() => decisionCertificates.id),

  // Full Decision DNA - Complete snapshot of all layers
  decisionDNA: jsonb('decision_dna').notNull(),
  // Contains: intakePacket, governanceDecision, rigorPlan, readinessResult, routePlan, reasoningArtifacts, finalDecision

  // Layer Scores
  layerScores: jsonb('layer_scores').notNull(),
  // { intake, governance, friction, readiness, routing, reasoning, synthesis, ledger }

  // Config Versions at time of decision
  configVersions: jsonb('config_versions').notNull(),
  // { policyVersion, layerConfigVersion, routingRulesVersion }
  fullConfigVersion: varchar('full_config_version', { length: 100 }).notNull(),

  // Forensic Timeline
  forensicTimeline: jsonb('forensic_timeline').notNull().default([]),
  // Array of { timestamp, layer, event, actor, actorType }

  // Compliance Stamp
  complianceStamp: jsonb('compliance_stamp').notNull(),
  // { status, uaeVision2071Aligned, dataSovereigntyEnforced, stampedAt, stampedBy }

  // Retention
  retentionUntil: timestamp('retention_until').notNull(),

  // Graph Relationships (for Decision Genome visualization)
  parentDecisionIds: jsonb('parent_decision_ids').default([]),
  childDecisionIds: jsonb('child_decision_ids').default([]),
  departmentId: varchar('department_id'),

  // Outcome Learning
  predictedOutcome: varchar('predicted_outcome', { length: 50 }),
  actualOutcome: varchar('actual_outcome', { length: 50 }),
  outcomeRecordedAt: timestamp('outcome_recorded_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  traceIdx: index('dap_trace_idx').on(table.traceId),
  decisionIdx: index('dap_decision_idx').on(table.decisionLedgerId),
  departmentIdx: index('dap_department_idx').on(table.departmentId),
  retentionIdx: index('dap_retention_idx').on(table.retentionUntil),
}));

// Insert schemas for new tables
export const insertDecisionCertificateSchema = createInsertSchema(decisionCertificates).omit({
  id: true,
  createdAt: true,
});

export const insertDecisionAuditPackSchema = createInsertSchema(decisionAuditPacks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type DecisionCertificate = typeof decisionCertificates.$inferSelect;
export type InsertDecisionCertificate = z.infer<typeof insertDecisionCertificateSchema>;

export type DecisionAuditPack = typeof decisionAuditPacks.$inferSelect;
export type InsertDecisionAuditPack = z.infer<typeof insertDecisionAuditPackSchema>;

// ============================================================================
// ADK (AGENT DEVELOPMENT KIT) LAYER CONFIGURATIONS
// Google ADK integration for multi-agent orchestration across all 8 layers
// ============================================================================

export const adkLayerConfigs = pgTable("adk_layer_configs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  layerId: varchar("layer_id", { length: 50 }).notNull().unique(), // intake, governance, friction, readiness, routing, reasoning, synthesis, ledger

  // Agent Configuration
  agentName: varchar("agent_name", { length: 100 }).notNull(),
  agentDescription: text("agent_description"),
  systemPrompt: text("system_prompt").notNull(),

  // Workflow Pattern
  workflowPattern: varchar("workflow_pattern", { length: 20 }).notNull().default("sequential"), // sequential, parallel, loop

  // Tools Configuration
  tools: jsonb("tools").notNull().default([]),
  // Array of { id, name, description, enabled, parameters }

  // Execution Settings
  maxSteps: integer("max_steps").notNull().default(10),
  timeoutSeconds: integer("timeout_seconds").notNull().default(120),
  maxRetries: integer("max_retries").notNull().default(3),

  // Human-in-the-Loop (HITL)
  hitlEnabled: boolean("hitl_enabled").notNull().default(false),
  hitlTriggers: jsonb("hitl_triggers").notNull().default([]),
  // Array of { condition, action, message }

  // LLM Provider Configuration
  llmProvider: varchar("llm_provider", { length: 50 }).notNull().default("anthropic"), // anthropic, gemini, auto
  modelId: varchar("model_id", { length: 100 }).notNull().default("claude-3-5-sonnet-20241022"),
  temperature: real("temperature").notNull().default(0.7),
  maxTokens: integer("max_tokens").notNull().default(4096),

  // Routing Hints (for ADK's dynamic routing)
  routingHints: jsonb("routing_hints").notNull().default({}),
  // { priority: 'speed'|'cost'|'quality', fallbackEnabled: boolean }

  // Session & Memory
  sessionMemoryEnabled: boolean("session_memory_enabled").notNull().default(true),
  memoryType: varchar("memory_type", { length: 30 }).notNull().default("in_memory"), // in_memory, persistent

  // Status
  enabled: boolean("enabled").notNull().default(true),

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  layerIdIdx: index("adk_layer_id_idx").on(table.layerId),
}));

// ADK Tool Definitions - reusable tools across layers
export const adkTools = pgTable("adk_tools", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description").notNull(),
  category: varchar("category", { length: 50 }).notNull(), // validation, search, classification, generation, analysis

  // Function definition
  functionSchema: jsonb("function_schema").notNull(),
  // { name, description, parameters: { type, properties, required } }

  // Implementation details
  implementation: varchar("implementation", { length: 50 }).notNull().default("internal"), // internal, api, mcp
  endpoint: text("endpoint"), // For API-based tools

  // Availability
  availableLayers: jsonb("available_layers").notNull().default([]),
  // Array of layer IDs this tool can be used in

  enabled: boolean("enabled").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ADK Execution Logs - matches actual database schema
export const adkExecutionLogs = pgTable("adk_execution_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  layerId: varchar("layer_id", { length: 50 }).notNull(),
  sessionId: varchar("session_id", { length: 100 }).notNull(),

  // Execution details
  stepNumber: integer("step_number"),
  toolName: varchar("tool_name", { length: 100 }),

  // Input/Output
  input: jsonb("input"),
  output: jsonb("output"),

  // Status
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, running, completed, failed
  errorMessage: text("error_message"),

  // Performance
  durationMs: integer("duration_ms"),

  // HITL
  hitlRequired: boolean("hitl_required").notNull().default(false),
  hitlResponse: jsonb("hitl_response"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  layerIdIdx: index("adk_exec_layer_idx").on(table.layerId),
  sessionIdIdx: index("adk_exec_session_idx").on(table.sessionId),
  statusIdx: index("adk_exec_status_idx").on(table.status),
  createdAtIdx: index("adk_exec_created_idx").on(table.createdAt),
}));

// Insert schemas
export const insertAdkLayerConfigSchema = createInsertSchema(adkLayerConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateAdkLayerConfigSchema = z.object({
  agentName: z.string().optional(),
  agentDescription: z.string().optional(),
  systemPrompt: z.string().optional(),
  workflowPattern: z.enum(["sequential", "parallel", "loop"]).optional(),
  tools: z.array(z.any()).optional(),
  maxSteps: z.number().min(1).max(50).optional(),
  timeoutSeconds: z.number().min(10).max(600).optional(),
  maxRetries: z.number().min(0).max(10).optional(),
  hitlEnabled: z.boolean().optional(),
  hitlTriggers: z.array(z.any()).optional(),
  llmProvider: z.enum(["anthropic", "gemini", "auto"]).optional(),
  modelId: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(100).max(32000).optional(),
  routingHints: z.any().optional(),
  sessionMemoryEnabled: z.boolean().optional(),
  memoryType: z.enum(["in_memory", "persistent"]).optional(),
  enabled: z.boolean().optional(),
});

export const insertAdkToolSchema = createInsertSchema(adkTools).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdkExecutionLogSchema = createInsertSchema(adkExecutionLogs).omit({
  id: true,
  createdAt: true,
});

// Types
export type AdkLayerConfig = typeof adkLayerConfigs.$inferSelect;
export type InsertAdkLayerConfig = z.infer<typeof insertAdkLayerConfigSchema>;
export type UpdateAdkLayerConfig = z.infer<typeof updateAdkLayerConfigSchema>;

export type AdkTool = typeof adkTools.$inferSelect;
export type InsertAdkTool = z.infer<typeof insertAdkToolSchema>;

export type AdkExecutionLog = typeof adkExecutionLogs.$inferSelect;
export type InsertAdkExecutionLog = z.infer<typeof insertAdkExecutionLogSchema>;


