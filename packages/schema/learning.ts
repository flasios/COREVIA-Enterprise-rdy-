/** @module intelligence — Schema owner. Only this module may write to these tables. */
/**
 * Schema domain: learning
 * Auto-extracted from shared/schema.ts
 */
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp, boolean, index, unique, real, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./platform";


// ========== CONTENT GENERATION LEARNING ==========
// Tables for persisting the 3-layer intelligence learning system

export const contentGenerationStats = pgTable('content_generation_stats', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  contentType: varchar('content_type', { length: 100 }).notNull().unique(),
  templatesLearned: integer('templates_learned').notNull().default(0),
  internalSuccesses: integer('internal_successes').notNull().default(0),
  hybridEscalations: integer('hybrid_escalations').notNull().default(0),
  avgQualityScore: real('avg_quality_score').default(0),
  lastLearnedAt: timestamp('last_learned_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  contentTypeIdx: index('cgs_content_type_idx').on(table.contentType),
}));

export const contentGenerationTemplates = pgTable('content_generation_templates', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  contentType: varchar('content_type', { length: 100 }).notNull(),
  templateData: jsonb('template_data').notNull(),
  source: varchar('source', { length: 50 }).notNull().default('hybrid'), // 'internal' or 'hybrid'
  qualityScore: real('quality_score').default(0),
  usageCount: integer('usage_count').default(0),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  contentTypeIdx: index('cgt_content_type_idx').on(table.contentType),
  qualityIdx: index('cgt_quality_idx').on(table.qualityScore),
}));

export const contentGenerationPipelineStats = pgTable('content_generation_pipeline_stats', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  totalPredictions: integer('total_predictions').notNull().default(0),
  internalHandled: integer('internal_handled').notNull().default(0),
  hybridEscalated: integer('hybrid_escalated').notNull().default(0),
  claudeConsultations: integer('claude_consultations').notNull().default(0),
  knowledgeDistilled: integer('knowledge_distilled').notNull().default(0),
  avgInternalConfidence: real('avg_internal_confidence').default(0),
  avgHybridConfidence: real('avg_hybrid_confidence').default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const driftEvents = pgTable('drift_events', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  driftType: varchar('drift_type', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull().default('medium'),
  windowMean: real('window_mean'),
  windowVariance: real('window_variance'),
  previousMean: real('previous_mean'),
  driftMagnitude: real('drift_magnitude'),
  affectedFeatures: jsonb('affected_features'),
  recommendations: jsonb('recommendations'),
  detectedAt: timestamp('detected_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
  metadata: jsonb('metadata'),
}, (table) => ({
  driftTypeIdx: index('de_drift_type_idx').on(table.driftType),
  detectedAtIdx: index('de_detected_at_idx').on(table.detectedAt),
}));

export type DriftEvent = typeof driftEvents.$inferSelect;
export type InsertDriftEvent = typeof driftEvents.$inferInsert;

export type ContentGenerationStats = typeof contentGenerationStats.$inferSelect;
export type ContentGenerationTemplate = typeof contentGenerationTemplates.$inferSelect;
export type ContentGenerationPipelineStats = typeof contentGenerationPipelineStats.$inferSelect;

// Neural Content Generator Learning History - Deep learning system persistence
export const neuralLearningHistory = pgTable('neural_learning_history', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionType: varchar('section_type', { length: 100 }).notNull(),
  inputContext: text('input_context').notNull(),
  outputContent: text('output_content').notNull(),
  qualityScore: real('quality_score').notNull().default(0),
  wasFromClaude: boolean('was_from_claude').notNull().default(true),
  contextEmbedding: jsonb('context_embedding'), // Stored embedding vector
  metadata: jsonb('metadata'), // Additional learning context
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  sectionTypeIdx: index('nlh_section_type_idx').on(table.sectionType),
  wasFromClaudeIdx: index('nlh_was_from_claude_idx').on(table.wasFromClaude),
}));

// Neural Section Templates - Learned section patterns from Claude outputs
export const neuralSectionTemplates = pgTable('neural_section_templates', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionType: varchar('section_type', { length: 100 }).notNull(),
  patterns: jsonb('patterns').notNull(), // Array of learned patterns
  embeddings: jsonb('embeddings'), // Stored embeddings for similarity matching
  qualityScores: jsonb('quality_scores'), // Quality scores for each pattern
  generationCount: integer('generation_count').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  sectionTypeIdx: unique('nst_section_type_unique').on(table.sectionType),
}));

export type NeuralLearningHistory = typeof neuralLearningHistory.$inferSelect;
export type NeuralSectionTemplate = typeof neuralSectionTemplates.$inferSelect;

// ========== ADVANCED LEARNING SYSTEM ==========
// Tables for reinforcement learning, meta-learning, active learning, and transfer learning

// Feedback Events - User ratings and edits for reinforcement learning
export const learningFeedbackEvents = pgTable('learning_feedback_events', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  contentId: varchar('content_id').notNull(), // Reference to generated content (business case ID, etc.)
  contentType: varchar('content_type', { length: 100 }).notNull(), // 'business_case', 'requirements', etc.
  userId: uuid("user_id").references(() => users.id),
  feedbackType: varchar('feedback_type', { length: 50 }).notNull(), // 'rating', 'edit', 'accept', 'reject'
  rating: integer('rating'), // 1-5 star rating if applicable
  originalContent: text('original_content'), // Original generated content
  editedContent: text('edited_content'), // User's edited version
  editDiff: jsonb('edit_diff'), // Structured diff of changes
  sectionType: varchar('section_type', { length: 100 }), // Which section was edited
  rewardSignal: real('reward_signal'), // Computed reward for RL (-1 to 1)
  metadata: jsonb('metadata'), // Additional context
  processedAt: timestamp('processed_at'), // When the feedback was processed by learning system
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  contentIdIdx: index('lfe_content_id_idx').on(table.contentId),
  contentTypeIdx: index('lfe_content_type_idx').on(table.contentType),
  userIdIdx: index('lfe_user_id_idx').on(table.userId),
  feedbackTypeIdx: index('lfe_feedback_type_idx').on(table.feedbackType),
  createdAtIdx: index('lfe_created_at_idx').on(table.createdAt),
}));

export const insertFeedbackEventSchema = createInsertSchema(learningFeedbackEvents).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type InsertFeedbackEvent = z.infer<typeof insertFeedbackEventSchema>;
export type FeedbackEvent = typeof learningFeedbackEvents.$inferSelect;

// Active Learning Queue - Items selected for human review based on uncertainty
export const activeLearningQueue = pgTable('active_learning_queue', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar('candidate_id').notNull(), // Reference to the decision/content
  candidateType: varchar('candidate_type', { length: 100 }).notNull(), // 'decision', 'business_case', etc.
  content: text('content').notNull(), // The actual content to review
  uncertaintyScore: real('uncertainty_score').notNull(), // Model uncertainty (0-1)
  diversityScore: real('diversity_score').default(0), // How different from existing training data
  expectedInfoGain: real('expected_info_gain').default(0), // Expected learning value
  selectionReason: varchar('selection_reason', { length: 200 }).notNull(), // Why this was selected
  status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending', 'assigned', 'reviewed', 'skipped'
  assignedTo: uuid("assigned_to").references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  reviewOutcome: real('review_outcome'), // The human-provided outcome/label
  reviewNotes: text('review_notes'),
  priority: integer('priority').default(1), // 1-5, higher = more urgent
  metadata: jsonb('metadata'),
  expiresAt: timestamp('expires_at'), // When this item should be auto-skipped
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('alq_status_idx').on(table.status),
  uncertaintyIdx: index('alq_uncertainty_idx').on(table.uncertaintyScore),
  priorityIdx: index('alq_priority_idx').on(table.priority),
  candidateTypeIdx: index('alq_candidate_type_idx').on(table.candidateType),
  createdAtIdx: index('alq_created_at_idx').on(table.createdAt),
}));

export const insertActiveLearningQueueSchema = createInsertSchema(activeLearningQueue).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
});

export type InsertActiveLearningQueue = z.infer<typeof insertActiveLearningQueueSchema>;
export type ActiveLearningQueueItem = typeof activeLearningQueue.$inferSelect;

// Meta-Learning Snapshots - Per-domain fast adaptation parameters
export const metaLearningSnapshots = pgTable('meta_learning_snapshots', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  domain: varchar('domain', { length: 200 }).notNull().unique(), // e.g., 'healthcare', 'transportation', 'finance'
  taskType: varchar('task_type', { length: 100 }).notNull(), // 'business_case', 'strategic_fit', etc.
  adaptationParameters: jsonb('adaptation_parameters').notNull(), // Fast-adaptation weights
  featureWeights: jsonb('feature_weights'), // Domain-specific feature importance
  learningRate: real('learning_rate').default(0.01), // Domain-specific learning rate
  supportSetSize: integer('support_set_size').default(0), // Number of examples seen
  adaptationSteps: integer('adaptation_steps').default(0), // Number of adaptation updates
  performanceMetrics: jsonb('performance_metrics'), // Accuracy, F1, etc. on this domain
  confidenceLift: real('confidence_lift').default(0), // Improvement from adaptation
  coldStartAccuracy: real('cold_start_accuracy'), // Accuracy before adaptation
  currentAccuracy: real('current_accuracy'), // Accuracy after adaptation
  lastAdaptedAt: timestamp('last_adapted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  domainIdx: index('mls_domain_idx').on(table.domain),
  taskTypeIdx: index('mls_task_type_idx').on(table.taskType),
  confidenceLiftIdx: index('mls_confidence_lift_idx').on(table.confidenceLift),
}));

export const insertMetaLearningSnapshotSchema = createInsertSchema(metaLearningSnapshots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMetaLearningSnapshot = z.infer<typeof insertMetaLearningSnapshotSchema>;
export type MetaLearningSnapshot = typeof metaLearningSnapshots.$inferSelect;

// Domain Transfer Registry - Track cross-domain knowledge transfer
export const domainTransferRegistry = pgTable('domain_transfer_registry', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceDomain: varchar('source_domain', { length: 200 }).notNull(),
  targetDomain: varchar('target_domain', { length: 200 }).notNull(),
  transferType: varchar('transfer_type', { length: 50 }).notNull(), // 'templates', 'weights', 'features'
  similarityScore: real('similarity_score').notNull(), // How similar the domains are
  templatesTransferred: integer('templates_transferred').default(0),
  weightsTransferred: jsonb('weights_transferred'), // Which weights were transferred
  adaptationMultiplier: real('adaptation_multiplier').default(1.0), // How much to scale transferred weights
  performanceGain: real('performance_gain'), // Improvement from transfer
  coldStartReduction: real('cold_start_reduction'), // Time saved in cold start (percentage)
  status: varchar('status', { length: 50 }).default('active'), // 'active', 'deprecated', 'failed'
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  sourceDomainIdx: index('dtr_source_domain_idx').on(table.sourceDomain),
  targetDomainIdx: index('dtr_target_domain_idx').on(table.targetDomain),
  similarityIdx: index('dtr_similarity_idx').on(table.similarityScore),
}));

export const insertDomainTransferSchema = createInsertSchema(domainTransferRegistry).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDomainTransfer = z.infer<typeof insertDomainTransferSchema>;
export type DomainTransfer = typeof domainTransferRegistry.$inferSelect;

// Learning Metrics History - Track continuous improvement over time
export const learningMetricsHistory = pgTable('learning_metrics_history', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  metricType: varchar('metric_type', { length: 100 }).notNull(), // 'autonomy_rate', 'accuracy', 'learning_velocity', etc.
  metricValue: real('metric_value').notNull(),
  domain: varchar('domain', { length: 200 }), // Optional domain-specific metric
  windowStart: timestamp('window_start').notNull(),
  windowEnd: timestamp('window_end').notNull(),
  sampleCount: integer('sample_count').default(0), // Number of samples in this window
  breakdown: jsonb('breakdown'), // Detailed breakdown of the metric
  previousValue: real('previous_value'), // For delta calculation
  delta: real('delta'), // Change from previous window
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  metricTypeIdx: index('lmh_metric_type_idx').on(table.metricType),
  domainIdx: index('lmh_domain_idx').on(table.domain),
  windowEndIdx: index('lmh_window_end_idx').on(table.windowEnd),
  createdAtIdx: index('lmh_created_at_idx').on(table.createdAt),
}));

export const insertLearningMetricsSchema = createInsertSchema(learningMetricsHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertLearningMetrics = z.infer<typeof insertLearningMetricsSchema>;
export type LearningMetrics = typeof learningMetricsHistory.$inferSelect;

// ========== ADWIN DRIFT DETECTION STATE ==========
// Persists the ADWIN sliding window for concept drift detection
export const adwinWindowState = pgTable('adwin_window_state', {
  id: varchar("id", { length: 50 }).primaryKey().default("main"),
  windowValues: jsonb('window_values').notNull().default([]), // Array of accuracy values
  windowSum: real('window_sum').notNull().default(0),
  windowVariance: real('window_variance').notNull().default(0),
  lastDriftDetection: timestamp('last_drift_detection'),
  totalDriftsDetected: integer('total_drifts_detected').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type AdwinWindowState = typeof adwinWindowState.$inferSelect;
export type InsertAdwinWindowState = typeof adwinWindowState.$inferInsert;

// ========== INTERNAL KNOWLEDGE GRAPH NODES ==========
// Persists knowledge graph nodes for pattern discovery and decision connections
export const internalKnowledgeNodes = pgTable('internal_knowledge_nodes', {
  id: uuid("id").primaryKey(),
  text: text('text').notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  connections: jsonb('connections').notNull().default([]), // Array of {id, similarity, relationship}
  outcome: real('outcome'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  categoryIdx: index('ikn_category_idx').on(table.category),
}));

export type InternalKnowledgeNode = typeof internalKnowledgeNodes.$inferSelect;
export type InsertInternalKnowledgeNode = typeof internalKnowledgeNodes.$inferInsert;

// ========== LORA FINE-TUNING SYSTEM ==========

// LoRA Gold Examples - High-quality training data collected from Claude outputs
export const loraGoldExamples = pgTable('lora_gold_examples', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionType: varchar('section_type', { length: 100 }).notNull(),
  inputContext: jsonb('input_context').notNull(), // GenerationContext as JSON
  outputContent: text('output_content').notNull(), // The generated content
  qualityScore: real('quality_score').notNull(), // Quality rating 0-1
  source: varchar('source', { length: 50 }).notNull().default('claude'), // 'claude', 'human_edited', 'validated'
  language: varchar('language', { length: 10 }).default('en'), // 'en', 'ar'
  organizationId: varchar('organization_id'), // Multi-tenant support
  datasetId: varchar('dataset_id'), // Which dataset this belongs to
  isIncludedInTraining: boolean('is_included_in_training').default(false),
  metadata: jsonb('metadata'), // Additional metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  sectionTypeIdx: index('lge_section_type_idx').on(table.sectionType),
  qualityScoreIdx: index('lge_quality_score_idx').on(table.qualityScore),
  datasetIdx: index('lge_dataset_idx').on(table.datasetId),
  sourceIdx: index('lge_source_idx').on(table.source),
}));

export const insertLoraGoldExampleSchema = createInsertSchema(loraGoldExamples).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LoraGoldExample = typeof loraGoldExamples.$inferSelect;
export type InsertLoraGoldExample = z.infer<typeof insertLoraGoldExampleSchema>;

// LoRA Datasets - Collections of gold examples for training
export const loraDatasets = pgTable('lora_datasets', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  sectionTypes: jsonb('section_types').notNull().default([]), // Array of section types included
  minQualityThreshold: real('min_quality_threshold').notNull().default(0.85),
  exampleCount: integer('example_count').notNull().default(0),
  language: varchar('language', { length: 10 }).default('en'),
  organizationId: varchar('organization_id'),
  status: varchar('status', { length: 50 }).default('draft'), // 'draft', 'ready', 'training', 'archived'
  validationMetrics: jsonb('validation_metrics'), // {avgQuality, sectionDistribution, etc.}
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('ld_status_idx').on(table.status),
  nameIdx: index('ld_name_idx').on(table.name),
}));

export const insertLoraDatasetSchema = createInsertSchema(loraDatasets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LoraDataset = typeof loraDatasets.$inferSelect;
export type InsertLoraDataset = z.infer<typeof insertLoraDatasetSchema>;

// LoRA Training Jobs - Track training runs
export const loraTrainingJobs = pgTable('lora_training_jobs', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  datasetId: varchar('dataset_id').notNull(),
  baseModel: varchar('base_model', { length: 100 }).notNull(), // 'mistral-7b', 'llama2-7b', etc.
  status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending', 'running', 'completed', 'failed', 'cancelled'

  // LoRA hyperparameters
  loraRank: integer('lora_rank').notNull().default(16),
  loraAlpha: integer('lora_alpha').notNull().default(32),
  loraDropout: real('lora_dropout').notNull().default(0.05),
  learningRate: real('learning_rate').notNull().default(0.0002),
  epochs: integer('epochs').notNull().default(3),
  batchSize: integer('batch_size').notNull().default(4),

  // Progress tracking
  currentEpoch: integer('current_epoch').default(0),
  currentStep: integer('current_step').default(0),
  totalSteps: integer('total_steps'),
  trainingLoss: real('training_loss'),
  validationLoss: real('validation_loss'),

  // Timing
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  estimatedDuration: integer('estimated_duration'), // seconds

  // Output
  adapterId: varchar('adapter_id'), // References the created adapter
  errorMessage: text('error_message'),
  logs: jsonb('logs').default([]), // Array of log entries
  metadata: jsonb('metadata'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('ltj_status_idx').on(table.status),
  datasetIdx: index('ltj_dataset_idx').on(table.datasetId),
  baseModelIdx: index('ltj_base_model_idx').on(table.baseModel),
}));

export const insertLoraTrainingJobSchema = createInsertSchema(loraTrainingJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LoraTrainingJob = typeof loraTrainingJobs.$inferSelect;
export type InsertLoraTrainingJob = z.infer<typeof insertLoraTrainingJobSchema>;

// LoRA Adapters - Trained adapter weights
export const loraAdapters = pgTable('lora_adapters', {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  baseModel: varchar('base_model', { length: 100 }).notNull(),
  trainingJobId: varchar('training_job_id').notNull(),
  datasetId: varchar('dataset_id').notNull(),

  // Adapter configuration
  loraRank: integer('lora_rank').notNull(),
  loraAlpha: integer('lora_alpha').notNull(),
  targetModules: jsonb('target_modules').default([]), // ['q_proj', 'v_proj', etc.]

  // Performance metrics
  validationLoss: real('validation_loss'),
  accuracy: real('accuracy'),
  sectionPerformance: jsonb('section_performance'), // Per-section accuracy

  // Storage
  weightsPath: text('weights_path'), // Path to stored weights (if applicable)
  weightsBlob: text('weights_blob'), // Base64 encoded weights (for small adapters)

  // Usage tracking
  status: varchar('status', { length: 50 }).default('active'), // 'active', 'deprecated', 'testing'
  usageCount: integer('usage_count').default(0),
  lastUsedAt: timestamp('last_used_at'),

  organizationId: varchar('organization_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  baseModelIdx: index('la_base_model_idx').on(table.baseModel),
  statusIdx: index('la_status_idx').on(table.status),
  trainingJobIdx: index('la_training_job_idx').on(table.trainingJobId),
}));

export const insertLoraAdapterSchema = createInsertSchema(loraAdapters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LoraAdapter = typeof loraAdapters.$inferSelect;
export type InsertLoraAdapter = z.infer<typeof insertLoraAdapterSchema>;

