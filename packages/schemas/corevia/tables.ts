import {
	pgTable,
	text,
	timestamp,
	jsonb,
	integer,
	boolean,
	numeric,
	pgEnum,
	bigserial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// ============================================================================
// ENUMS
// ============================================================================

export const dataClassificationEnum = pgEnum("data_classification", [
	"PUBLIC",
	"INTERNAL",
	"CONFIDENTIAL",
	"SOVEREIGN",
	"HIGH_SENSITIVE",
]);

export const governanceOutcomeEnum = pgEnum("governance_outcome", [
	"ALLOW",
	"BLOCK",
]);

export const qualityOutcomeEnum = pgEnum("quality_outcome", [
	"READY",
	"NEEDS_INFO",
]);

export const approvalOutcomeEnum = pgEnum("approval_outcome", [
	"APPROVE",
	"REVISE",
	"REJECT",
]);

export const artifactStatusEnum = pgEnum("artifact_status", [
	"DRAFT",
	"IN_REVIEW",
	"APPROVED",
	"REJECTED",
	"ARCHIVED",
]);

export const decisionPhaseEnum = pgEnum("decision_phase", [
	"DEMAND",
	"CLOSURE",
]);

export const journeyStatusEnum = pgEnum("journey_status", [
	"DEMAND_PHASE",
	"PROJECT_ACTIVE",
	"CLOSURE_PHASE",
	"COMPLETED",
	"CANCELLED",
]);

export const decisionSpineStatusEnum = pgEnum("decision_spine_status", [
	"CREATED",
	"IN_PROGRESS",
	"NEEDS_REVISION",
	"READY_FOR_STRATEGIC_FIT",
	"READY_FOR_CONVERSION",
	"READY_FOR_CONCLUSION",
	"CONCLUDED",
	"COMPLETED",
	"CANCELLED",
]);

export const subdecisionStatusEnum = pgEnum("subdecision_status", [
	"DRAFT",
	"IN_REVIEW",
	"APPROVED",
	"REJECTED",
	"SUPERSEDED",
]);

export const intelligenceModeEnum = pgEnum("intelligence_mode", [
	"READ",
	"PLAN",
]);

export const engineKindEnum = pgEnum("engine_kind", [
	"SOVEREIGN_INTERNAL",
	"EXTERNAL_HYBRID",
	"DISTILLATION",
]);

export const executionStatusEnum = pgEnum("execution_status", [
	"PENDING",
	"RUNNING",
	"SUCCEEDED",
	"FAILED",
	"ROLLED_BACK",
	"CANCELLED",
]);

export const ledgerConclusionEnum = pgEnum("ledger_conclusion", [
	"APPROVED_TO_EXECUTE",
	"HOLD",
	"REJECTED",
	"CANCELLED",
	"COMPLETED",
]);

export const policyEnforcementLevelEnum = pgEnum("policy_enforcement_level", [
	"STRICT",
	"MODERATE",
	"RELAXED",
]);

// ============================================================================
// CORE TABLES (L0-L10)
// ============================================================================

export const brainPrincipals = pgTable("brain_principals", {
	principalId: text("principal_id").primaryKey(),
	principalType: text("principal_type").notNull(),
	displayName: text("display_name"),
	role: text("role"),
	orgId: text("org_id"),
	departmentId: text("department_id"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBrainPrincipalSchema = createInsertSchema(brainPrincipals);
export type InsertBrainPrincipal = z.infer<typeof insertBrainPrincipalSchema>;
export type BrainPrincipal = typeof brainPrincipals.$inferSelect;

export const aiUseCases = pgTable("ai_use_cases", {
	useCaseType: text("use_case_type").primaryKey(),
	title: text("title").notNull(),
	description: text("description"),
	defaultHitl: boolean("default_hitl").notNull().default(true),
	allowedMaxClass: dataClassificationEnum("allowed_max_class").notNull().default("INTERNAL"),
	requiresMaskingForExternal: boolean("requires_masking_for_external").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiUseCaseSchema = createInsertSchema(aiUseCases);
export type InsertAiUseCase = z.infer<typeof insertAiUseCaseSchema>;
export type AiUseCase = typeof aiUseCases.$inferSelect;

// ============================================================================
// DECISION JOURNEYS — Links Demand Decision + Closure Decision via shared IDEA
// ============================================================================

export const decisionJourneys = pgTable("decision_journeys", {
	journeyId: text("journey_id").primaryKey(),
	title: text("title").notNull(),
	sourceEntityId: text("source_entity_id"),
	demandSpineId: text("demand_spine_id"),
	closureSpineId: text("closure_spine_id"),
	projectRef: jsonb("project_ref"),
	status: journeyStatusEnum("status").notNull().default("DEMAND_PHASE"),
	learningAssetCount: integer("learning_asset_count").notNull().default(0),
	createdBy: text("created_by").references(() => brainPrincipals.principalId),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDecisionJourneySchema = createInsertSchema(decisionJourneys);
export type InsertDecisionJourney = z.infer<typeof insertDecisionJourneySchema>;
export type DecisionJourney = typeof decisionJourneys.$inferSelect;

export const decisionSpines = pgTable("decision_spines", {
	decisionSpineId: text("decision_spine_id").primaryKey(),
	journeyId: text("journey_id").references(() => decisionJourneys.journeyId),
	decisionPhase: decisionPhaseEnum("decision_phase").notNull().default("DEMAND"),
	title: text("title"),
	createdBy: text("created_by").references(() => brainPrincipals.principalId),
	sourceSystem: text("source_system"),
	status: decisionSpineStatusEnum("status").notNull().default("CREATED"),
	classification: dataClassificationEnum("classification").notNull().default("INTERNAL"),
	sector: text("sector"),
	jurisdiction: text("jurisdiction"),
	riskLevel: text("risk_level"),
	tags: text("tags").array(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDecisionSpineSchema = createInsertSchema(decisionSpines);
export type InsertDecisionSpine = z.infer<typeof insertDecisionSpineSchema>;
export type DecisionSpine = typeof decisionSpines.$inferSelect;

export const canonicalAiRequests = pgTable("canonical_ai_requests", {
	requestId: text("request_id").primaryKey(),
	correlationId: text("correlation_id").notNull(),
	decisionSpineId: text("decision_spine_id").references(() => decisionSpines.decisionSpineId),
	useCaseType: text("use_case_type").notNull().references(() => aiUseCases.useCaseType),
	requestedBy: text("requested_by").references(() => brainPrincipals.principalId),
	requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
	inputPayload: jsonb("input_payload").notNull(),
	attachments: jsonb("attachments"),
	sourceMetadata: jsonb("source_metadata"),
	status: text("status").notNull().default("RECEIVED"),
});

export const insertCanonicalAiRequestSchema = createInsertSchema(canonicalAiRequests);
export type InsertCanonicalAiRequest = z.infer<typeof insertCanonicalAiRequestSchema>;
export type CanonicalAiRequest = typeof canonicalAiRequests.$inferSelect;

export const constraintPacks = pgTable("constraint_packs", {
	constraintPackId: text("constraint_pack_id").primaryKey(),
	requestId: text("request_id").notNull().references(() => canonicalAiRequests.requestId, { onDelete: "cascade" }),
	classification: dataClassificationEnum("classification").notNull(),
	cloudAllowed: boolean("cloud_allowed").notNull().default(false),
	externalLlmAllowed: boolean("external_llm_allowed").notNull().default(false),
	maskingRequired: boolean("masking_required").notNull().default(true),
	hitlRequired: boolean("hitl_required").notNull().default(true),
	retentionDays: integer("retention_days").notNull().default(365),
	enforcementLevel: policyEnforcementLevelEnum("enforcement_level").notNull().default("STRICT"),
	constraintsJson: jsonb("constraints_json").notNull().default(sql`'{}'::jsonb`),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConstraintPackSchema = createInsertSchema(constraintPacks);
export type InsertConstraintPack = z.infer<typeof insertConstraintPackSchema>;
export type ConstraintPack = typeof constraintPacks.$inferSelect;

export const governanceDecisions = pgTable("governance_decisions", {
	governanceDecisionId: text("governance_decision_id").primaryKey(),
	requestId: text("request_id").notNull().references(() => canonicalAiRequests.requestId, { onDelete: "cascade" }),
	outcome: governanceOutcomeEnum("outcome").notNull(),
	authorityRequired: text("authority_required"),
	applicablePolicies: text("applicable_policies").array(),
	reason: text("reason"),
	constraintsSigned: boolean("constraints_signed").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	createdBy: text("created_by").references(() => brainPrincipals.principalId),
});

export const insertGovernanceDecisionSchema = createInsertSchema(governanceDecisions);
export type InsertGovernanceDecision = z.infer<typeof insertGovernanceDecisionSchema>;
export type GovernanceDecision = typeof governanceDecisions.$inferSelect;

export const contextQualityReports = pgTable("context_quality_reports", {
	cqrId: text("cqr_id").primaryKey(),
	requestId: text("request_id").notNull().references(() => canonicalAiRequests.requestId, { onDelete: "cascade" }),
	outcome: qualityOutcomeEnum("outcome").notNull(),
	completenessScore: numeric("completeness_score", { precision: 5, scale: 4 }).notNull().default("0"),
	ambiguityScore: numeric("ambiguity_score", { precision: 5, scale: 4 }).notNull().default("0"),
	missingFields: text("missing_fields").array().notNull().default(sql`ARRAY[]::TEXT[]`),
	assumptions: jsonb("assumptions").notNull().default(sql`'[]'::jsonb`),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContextQualityReportSchema = createInsertSchema(contextQualityReports);
export type InsertContextQualityReport = z.infer<typeof insertContextQualityReportSchema>;
export type ContextQualityReport = typeof contextQualityReports.$inferSelect;

export const enginePlugins = pgTable("engine_plugins", {
	enginePluginId: text("engine_plugin_id").primaryKey(),
	kind: engineKindEnum("kind").notNull(),
	name: text("name").notNull(),
	version: text("version").notNull(),
	enabled: boolean("enabled").notNull().default(true),
	allowedMaxClass: dataClassificationEnum("allowed_max_class").notNull().default("INTERNAL"),
	capabilities: jsonb("capabilities").notNull().default(sql`'{}'::jsonb`),
	config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEnginePluginSchema = createInsertSchema(enginePlugins);
export type InsertEnginePlugin = z.infer<typeof insertEnginePluginSchema>;
export type EnginePlugin = typeof enginePlugins.$inferSelect;

export const intelligencePlans = pgTable("intelligence_plans", {
	iplanId: text("iplan_id").primaryKey(),
	iplanHash: text("iplan_hash"),
	requestId: text("request_id").notNull().references(() => canonicalAiRequests.requestId, { onDelete: "cascade" }),
	mode: intelligenceModeEnum("mode").notNull(),
	selectedEngines: jsonb("selected_engines").notNull(),
	toolsAllowed: text("tools_allowed").array().notNull().default(sql`ARRAY[]::TEXT[]`),
	redactionMode: text("redaction_mode").notNull().default("NONE"),
	budgets: jsonb("budgets").notNull().default(sql`'{}'::jsonb`),
	agentPlan: jsonb("agent_plan").notNull().default(sql`'{}'::jsonb`),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIntelligencePlanSchema = createInsertSchema(intelligencePlans);
export type InsertIntelligencePlan = z.infer<typeof insertIntelligencePlanSchema>;
export type IntelligencePlan = typeof intelligencePlans.$inferSelect;

export const redactionReceipts = pgTable("redaction_receipts", {
	redactionReceiptId: text("redaction_receipt_id").primaryKey(),
	requestId: text("request_id").notNull().references(() => canonicalAiRequests.requestId, { onDelete: "cascade" }),
	iplanId: text("iplan_id").references(() => intelligencePlans.iplanId, { onDelete: "set null" }),
	classification: dataClassificationEnum("classification").notNull(),
	maskingApplied: boolean("masking_applied").notNull().default(false),
	minimizationApplied: boolean("minimization_applied").notNull().default(false),
	outboundManifest: jsonb("outbound_manifest").notNull().default(sql`'{}'::jsonb`),
	tokenizationMapRef: text("tokenization_map_ref"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRedactionReceiptSchema = createInsertSchema(redactionReceipts);
export type InsertRedactionReceipt = z.infer<typeof insertRedactionReceiptSchema>;
export type RedactionReceipt = typeof redactionReceipts.$inferSelect;

export const advisoryPackages = pgTable("advisory_packages", {
	apackId: text("apack_id").primaryKey(),
	requestId: text("request_id").notNull().references(() => canonicalAiRequests.requestId, { onDelete: "cascade" }),
	decisionSpineId: text("decision_spine_id").references(() => decisionSpines.decisionSpineId, { onDelete: "set null" }),
	summary: text("summary"),
	options: jsonb("options").notNull().default(sql`'[]'::jsonb`),
	risks: jsonb("risks").notNull().default(sql`'[]'::jsonb`),
	evidencePack: jsonb("evidence_pack").notNull().default(sql`'{}'::jsonb`),
	assumptions: jsonb("assumptions").notNull().default(sql`'[]'::jsonb`),
	confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull().default("0"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdvisoryPackageSchema = createInsertSchema(advisoryPackages);
export type InsertAdvisoryPackage = z.infer<typeof insertAdvisoryPackageSchema>;
export type AdvisoryPackage = typeof advisoryPackages.$inferSelect;

export const decisionArtifacts = pgTable("decision_artifacts", {
	artifactId: text("artifact_id").primaryKey(),
	decisionSpineId: text("decision_spine_id").notNull().references(() => decisionSpines.decisionSpineId, { onDelete: "cascade" }),
	artifactType: text("artifact_type").notNull(),
	status: artifactStatusEnum("status").notNull().default("DRAFT"),
	currentVersion: integer("current_version").notNull().default(1),
	createdBy: text("created_by").references(() => brainPrincipals.principalId),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDecisionArtifactSchema = createInsertSchema(decisionArtifacts);
export type InsertDecisionArtifact = z.infer<typeof insertDecisionArtifactSchema>;
export type DecisionArtifact = typeof decisionArtifacts.$inferSelect;

export const decisionArtifactVersions = pgTable("decision_artifact_versions", {
	artifactVersionId: text("artifact_version_id").primaryKey(),
	artifactId: text("artifact_id").notNull().references(() => decisionArtifacts.artifactId, { onDelete: "cascade" }),
	version: integer("version").notNull(),
	content: jsonb("content").notNull(),
	changeSummary: text("change_summary"),
	createdBy: text("created_by").references(() => brainPrincipals.principalId),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDecisionArtifactVersionSchema = createInsertSchema(decisionArtifactVersions);
export type InsertDecisionArtifactVersion = z.infer<typeof insertDecisionArtifactVersionSchema>;
export type DecisionArtifactVersion = typeof decisionArtifactVersions.$inferSelect;

export const apackArtifactLinks = pgTable("apack_artifact_links", {
	apackId: text("apack_id").notNull().references(() => advisoryPackages.apackId, { onDelete: "cascade" }),
	artifactId: text("artifact_id").notNull().references(() => decisionArtifacts.artifactId, { onDelete: "cascade" }),
	artifactVersionId: text("artifact_version_id").references(() => decisionArtifactVersions.artifactVersionId, { onDelete: "set null" }),
	relation: text("relation").notNull().default("PROPOSED"),
});

export const insertApackArtifactLinkSchema = createInsertSchema(apackArtifactLinks);
export type InsertApackArtifactLink = z.infer<typeof insertApackArtifactLinkSchema>;
export type ApackArtifactLink = typeof apackArtifactLinks.$inferSelect;

export const subDecisions = pgTable("sub_decisions", {
	subDecisionId: text("sub_decision_id").primaryKey(),
	decisionSpineId: text("decision_spine_id").notNull().references(() => decisionSpines.decisionSpineId, { onDelete: "cascade" }),
	subDecisionType: text("sub_decision_type").notNull(),
	status: subdecisionStatusEnum("status").notNull().default("DRAFT"),
	artifactId: text("artifact_id").references(() => decisionArtifacts.artifactId, { onDelete: "set null" }),
	requiredAuthority: text("required_authority"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSubDecisionSchema = createInsertSchema(subDecisions);
export type InsertSubDecision = z.infer<typeof insertSubDecisionSchema>;
export type SubDecision = typeof subDecisions.$inferSelect;

export const approvals = pgTable("approvals", {
	approvalId: text("approval_id").primaryKey(),
	decisionSpineId: text("decision_spine_id").notNull().references(() => decisionSpines.decisionSpineId, { onDelete: "cascade" }),
	subDecisionId: text("sub_decision_id").references(() => subDecisions.subDecisionId, { onDelete: "set null" }),
	artifactId: text("artifact_id").references(() => decisionArtifacts.artifactId, { onDelete: "set null" }),
	artifactVersionId: text("artifact_version_id").references(() => decisionArtifactVersions.artifactVersionId, { onDelete: "set null" }),
	outcome: approvalOutcomeEnum("outcome").notNull(),
	approvedBy: text("approved_by").references(() => brainPrincipals.principalId),
	conditions: jsonb("conditions").notNull().default(sql`'[]'::jsonb`),
	rationale: text("rationale"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertApprovalSchema = createInsertSchema(approvals);
export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type Approval = typeof approvals.$inferSelect;

export const executions = pgTable("executions", {
	executionId: text("execution_id").primaryKey(),
	approvalId: text("approval_id").notNull().references(() => approvals.approvalId, { onDelete: "restrict" }),
	decisionSpineId: text("decision_spine_id").notNull().references(() => decisionSpines.decisionSpineId, { onDelete: "cascade" }),
	actionType: text("action_type").notNull(),
	idempotencyKey: text("idempotency_key").notNull(),
	status: executionStatusEnum("status").notNull().default("PENDING"),
	requestPayload: jsonb("request_payload").notNull().default(sql`'{}'::jsonb`),
	resultPayload: jsonb("result_payload").notNull().default(sql`'{}'::jsonb`),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExecutionSchema = createInsertSchema(executions);
export type InsertExecution = z.infer<typeof insertExecutionSchema>;
export type Execution = typeof executions.$inferSelect;

export const decisionLedgerRecords = pgTable("decision_ledger_records", {
	ledgerId: text("ledger_id").primaryKey(),
	decisionSpineId: text("decision_spine_id").notNull().unique().references(() => decisionSpines.decisionSpineId, { onDelete: "cascade" }),
	conclusion: ledgerConclusionEnum("conclusion").notNull(),
	basis: jsonb("basis").notNull(),
	rationale: text("rationale"),
	evidenceSummary: jsonb("evidence_summary").notNull().default(sql`'{}'::jsonb`),
	approvalsSummary: jsonb("approvals_summary").notNull().default(sql`'{}'::jsonb`),
	projectRef: jsonb("project_ref"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	createdBy: text("created_by").references(() => brainPrincipals.principalId),
});

export const insertDecisionLedgerRecordSchema = createInsertSchema(decisionLedgerRecords);
export type InsertDecisionLedgerRecord = z.infer<typeof insertDecisionLedgerRecordSchema>;
export type DecisionLedgerRecord = typeof decisionLedgerRecords.$inferSelect;

export const decisionOutcomes = pgTable("decision_outcomes", {
	outcomeId: text("outcome_id").primaryKey(),
	ledgerId: text("ledger_id").notNull().references(() => decisionLedgerRecords.ledgerId, { onDelete: "cascade" }),
	outcomeStatus: text("outcome_status").notNull(),
	kpiImpact: jsonb("kpi_impact").notNull().default(sql`'{}'::jsonb`),
	lessonsLearned: text("lessons_learned"),
	recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
	recordedBy: text("recorded_by").references(() => brainPrincipals.principalId),
});

export const insertDecisionOutcomeSchema = createInsertSchema(decisionOutcomes);
export type InsertDecisionOutcome = z.infer<typeof insertDecisionOutcomeSchema>;
export type DecisionOutcome = typeof decisionOutcomes.$inferSelect;

export const runAttestations = pgTable("run_attestations", {
	attestationId: text("attestation_id").primaryKey(),
	requestId: text("request_id").notNull().references(() => canonicalAiRequests.requestId, { onDelete: "cascade" }),
	iplanId: text("iplan_id").references(() => intelligencePlans.iplanId, { onDelete: "set null" }),
	enginePluginId: text("engine_plugin_id").references(() => enginePlugins.enginePluginId, { onDelete: "set null" }),
	classification: dataClassificationEnum("classification").notNull(),
	externalBoundaryCrossed: boolean("external_boundary_crossed").notNull().default(false),
	toolsUsed: text("tools_used").array().notNull().default(sql`ARRAY[]::TEXT[]`),
	policyFingerprint: text("policy_fingerprint"),
	receipt: jsonb("receipt").notNull().default(sql`'{}'::jsonb`),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRunAttestationSchema = createInsertSchema(runAttestations);
export type InsertRunAttestation = z.infer<typeof insertRunAttestationSchema>;
export type RunAttestation = typeof runAttestations.$inferSelect;

export const learningAssets = pgTable("learning_assets", {
	learningAssetId: text("learning_asset_id").primaryKey(),
	sourceLedgerId: text("source_ledger_id").notNull().references(() => decisionLedgerRecords.ledgerId, { onDelete: "cascade" }),
	assetType: text("asset_type").notNull(),
	status: artifactStatusEnum("status").notNull().default("DRAFT"),
	version: integer("version").notNull().default(1),
	content: jsonb("content").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	createdByEngine: text("created_by_engine").references(() => enginePlugins.enginePluginId),
	approvedAt: timestamp("approved_at", { withTimezone: true }),
	approvedBy: text("approved_by").references(() => brainPrincipals.principalId),
	// Journey linkage for Engine A learning trigger
	journeyId: text("journey_id").references(() => decisionJourneys.journeyId),
	decisionPhase: decisionPhaseEnum("decision_phase"),
	sourceArtifactId: text("source_artifact_id"),
	sourceArtifactVersion: text("source_artifact_version"),
});

export const insertLearningAssetSchema = createInsertSchema(learningAssets);
export type InsertLearningAsset = z.infer<typeof insertLearningAssetSchema>;
export type LearningAsset = typeof learningAssets.$inferSelect;

export const learningAssetActivations = pgTable("learning_asset_activations", {
	activationId: text("activation_id").primaryKey(),
	learningAssetId: text("learning_asset_id").notNull().references(() => learningAssets.learningAssetId, { onDelete: "cascade" }),
	enginePluginId: text("engine_plugin_id").notNull().references(() => enginePlugins.enginePluginId, { onDelete: "cascade" }),
	activatedBy: text("activated_by").references(() => brainPrincipals.principalId),
	activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
	notes: text("notes"),
});

export const insertLearningAssetActivationSchema = createInsertSchema(learningAssetActivations);
export type InsertLearningAssetActivation = z.infer<typeof insertLearningAssetActivationSchema>;
export type LearningAssetActivation = typeof learningAssetActivations.$inferSelect;

export const governancePolicies = pgTable("governance_policies", {
	policyId: text("policy_id").primaryKey(),
	name: text("name").notNull(),
	description: text("description"),
	enabled: boolean("enabled").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGovernancePolicySchema = createInsertSchema(governancePolicies);
export type InsertGovernancePolicy = z.infer<typeof insertGovernancePolicySchema>;
export type GovernancePolicy = typeof governancePolicies.$inferSelect;

export const governancePolicyVersions = pgTable("governance_policy_versions", {
	policyVersionId: text("policy_version_id").primaryKey(),
	policyId: text("policy_id").notNull().references(() => governancePolicies.policyId, { onDelete: "cascade" }),
	version: integer("version").notNull(),
	policyCode: text("policy_code").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	createdBy: text("created_by").references(() => brainPrincipals.principalId),
});

export const insertGovernancePolicyVersionSchema = createInsertSchema(governancePolicyVersions);
export type InsertGovernancePolicyVersion = z.infer<typeof insertGovernancePolicyVersionSchema>;
export type GovernancePolicyVersion = typeof governancePolicyVersions.$inferSelect;

export const governancePolicyTests = pgTable("governance_policy_tests", {
	policyTestId: text("policy_test_id").primaryKey(),
	policyVersionId: text("policy_version_id").notNull().references(() => governancePolicyVersions.policyVersionId, { onDelete: "cascade" }),
	testName: text("test_name").notNull(),
	testInput: jsonb("test_input").notNull(),
	expectedOutcome: jsonb("expected_outcome").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGovernancePolicyTestSchema = createInsertSchema(governancePolicyTests);
export type InsertGovernancePolicyTest = z.infer<typeof insertGovernancePolicyTestSchema>;
export type GovernancePolicyTest = typeof governancePolicyTests.$inferSelect;

export const brainEvents = pgTable("brain_events", {
	eventId: bigserial("event_id", { mode: "number" }).primaryKey(),
	occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
	correlationId: text("correlation_id"),
	decisionSpineId: text("decision_spine_id"),
	requestId: text("request_id"),
	eventType: text("event_type").notNull(),
	actorId: text("actor_id"),
	payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
});

export const insertBrainEventSchema = createInsertSchema(brainEvents).omit({
	eventId: true,
});
export type InsertBrainEvent = z.infer<typeof insertBrainEventSchema>;
export type BrainEvent = typeof brainEvents.$inferSelect;

export const routingOverrides = pgTable("routing_overrides", {
	overrideId: text("override_id").primaryKey(),
	scope: text("scope").notNull(),
	scopeRef: text("scope_ref"),
	forcedEngineKind: engineKindEnum("forced_engine_kind"),
	forcedEngineId: text("forced_engine_id"),
	enabled: boolean("enabled").notNull().default(true),
	reason: text("reason"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	createdBy: text("created_by").references(() => brainPrincipals.principalId),
});

export const insertRoutingOverrideSchema = createInsertSchema(routingOverrides);
export type InsertRoutingOverride = z.infer<typeof insertRoutingOverrideSchema>;
export type RoutingOverride = typeof routingOverrides.$inferSelect;

// ============================================================================
// POLICY PACK REGISTRY (Layer 3 Friction)
// ============================================================================

export const policyPackStatusEnum = pgEnum("policy_pack_status", [
	"active",
	"inactive",
	"draft",
	"testing",
]);

export const policyPackTestResultEnum = pgEnum("policy_pack_test_result", [
	"passed",
	"failed",
	"untested",
]);

export const corviaPolicyPacks = pgTable("corevia_policy_packs", {
	id: text("id").primaryKey(),
	packId: text("pack_id").notNull().unique(),
	name: text("name").notNull(),
	version: text("version").notNull(),
	summary: text("summary").notNull(),
	status: policyPackStatusEnum("status").notNull().default("draft"),
	layer: text("layer").notNull().default("L3_FRICTION"),
	rulesCount: integer("rules_count").notNull().default(0),
	rules: jsonb("rules").notNull().default(sql`'[]'::jsonb`),
	lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
	testResult: policyPackTestResultEnum("test_result").notNull().default("untested"),
	documentName: text("document_name"),
	documentSize: integer("document_size"),
	documentType: text("document_type"),
	documentPath: text("document_path"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	createdBy: text("created_by").references(() => brainPrincipals.principalId),
});

export const insertCorviaPolicyPackSchema = createInsertSchema(corviaPolicyPacks);
export type InsertCorviaPolicyPack = z.infer<typeof insertCorviaPolicyPackSchema>;
export type CorviaPolicyPack = typeof corviaPolicyPacks.$inferSelect;

// ============================================================================
// NOTIFICATION ORCHESTRATOR — Unified Channel Registry
// ============================================================================

/**
 * Central registry of every notification channel in the system.
 * Each service registers its channels at startup.
 * Admins toggle channels ON/OFF from the Brain Console.
 */
export const notificationChannels = pgTable("notification_channels", {
	id: text("id").primaryKey(), // e.g. "demand.status_change"
	serviceName: text("service_name").notNull(), // e.g. "Demand Management"
	category: text("category").notNull(), // grouping: "demand", "ai", "tender", "compliance", "system"
	name: text("name").notNull(), // human-readable: "Demand Status Change"
	description: text("description").notNull(),
	enabled: boolean("enabled").notNull().default(true), // master switch
	deliveryMethods: jsonb("delivery_methods").notNull().default(sql`'["in_app"]'::jsonb`), // ["in_app","email","websocket"]
	config: jsonb("config").notNull().default(sql`'{}'::jsonb`), // channel-specific: frequency, severity threshold, etc.
	priority: text("priority").notNull().default("medium"), // default priority for this channel
	icon: text("icon"), // lucide icon name for UI
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationChannelSchema = createInsertSchema(notificationChannels).omit({
	createdAt: true,
	updatedAt: true,
});
export type NotificationChannel = typeof notificationChannels.$inferSelect;
export type InsertNotificationChannel = z.infer<typeof insertNotificationChannelSchema>;

/**
 * Per-user overrides for notification channels.
 * If no row exists, the channel's global `enabled` state applies.
 */
export const notificationChannelPreferences = pgTable("notification_channel_preferences", {
	id: bigserial("id", { mode: "number" }).primaryKey(),
	userId: text("user_id").notNull(),
	channelId: text("channel_id").notNull().references(() => notificationChannels.id, { onDelete: "cascade" }),
	enabled: boolean("enabled").notNull().default(true),
	deliveryMethods: jsonb("delivery_methods"), // user-level override ["in_app","email"]
	config: jsonb("config"), // user-specific overrides
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationChannelPrefSchema = createInsertSchema(notificationChannelPreferences).omit({
	id: true,
	updatedAt: true,
});
export type NotificationChannelPreference = typeof notificationChannelPreferences.$inferSelect;
export type InsertNotificationChannelPreference = z.infer<typeof insertNotificationChannelPrefSchema>;
