/** @module knowledge — Schema owner. Only this module may write to these tables. */
/**
 * Schema domain: knowledge
 * Auto-extracted from shared/schema.ts
 */
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, serial, timestamp, boolean, index, numeric, customType, date, real, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./platform";

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


// ============================================================================
// KNOWLEDGE CENTRE - RAG System
// Document management, vector embeddings, and semantic search
// ============================================================================

// Knowledge Document Classification Hierarchy
// Document categories - the flat categorization system
export const DOCUMENT_CATEGORIES = {
  strategic: { label: "Strategic", description: "Strategic planning and vision documents" },
  operational: { label: "Operational", description: "Day-to-day operational documents" },
  technical: { label: "Technical", description: "Technical specifications and documentation" },
  regulatory: { label: "Regulatory", description: "Compliance and regulatory documents" },
  research: { label: "Research", description: "Research papers and analysis" },
  business: { label: "Business", description: "Business cases and proposals" },
  financial: { label: "Financial", description: "Financial reports and budgets" },
  legal: { label: "Legal", description: "Legal documents and contracts" },
  hr: { label: "Human Resources", description: "HR policies and procedures" },
  it: { label: "Information Technology", description: "IT systems and infrastructure" },
} as const;

export type DocumentCategory = keyof typeof DOCUMENT_CATEGORIES;

export const DOCUMENT_CATEGORY_LIST = Object.entries(DOCUMENT_CATEGORIES).map(([key, value]) => ({
  id: key as DocumentCategory,
  ...value
}));

// Subfolder structure with label and slug for consistent path handling
export interface SubfolderDefinition {
  label: string;
  slug: string;
}

// Classification to category mapping - defines which categories are allowed for each classification
export const KNOWLEDGE_CLASSIFICATIONS = {
  policies: {
    label: "Policies",
    icon: "scroll",
    description: "Official organizational policies and governance documents",
    subfolders: [
      { label: "IT Policies", slug: "it-policies" },
      { label: "HR Policies", slug: "hr-policies" },
      { label: "Security Policies", slug: "security-policies" },
      { label: "Financial Policies", slug: "financial-policies" },
      { label: "Operational Policies", slug: "operational-policies" }
    ] as SubfolderDefinition[],
    allowedCategories: ["strategic", "regulatory", "hr", "it", "financial"] as DocumentCategory[]
  },
  procedures: {
    label: "Procedures",
    icon: "list-checks",
    description: "Step-by-step operational procedures and workflows",
    subfolders: [
      { label: "Standard Operating Procedures", slug: "standard-operating-procedures" },
      { label: "Emergency Procedures", slug: "emergency-procedures" },
      { label: "Approval Procedures", slug: "approval-procedures" },
      { label: "Onboarding Procedures", slug: "onboarding-procedures" }
    ] as SubfolderDefinition[],
    allowedCategories: ["operational", "technical", "hr", "it"] as DocumentCategory[]
  },
  guidelines: {
    label: "Guidelines",
    icon: "compass",
    description: "Best practices and recommended approaches",
    subfolders: [
      { label: "Technical Guidelines", slug: "technical-guidelines" },
      { label: "Design Guidelines", slug: "design-guidelines" },
      { label: "Compliance Guidelines", slug: "compliance-guidelines" },
      { label: "Quality Guidelines", slug: "quality-guidelines" }
    ] as SubfolderDefinition[],
    allowedCategories: ["technical", "operational", "regulatory"] as DocumentCategory[]
  },
  standards: {
    label: "Standards",
    icon: "shield-check",
    description: "Technical and organizational standards",
    subfolders: [
      { label: "UAE Standards", slug: "uae-standards" },
      { label: "ISO Standards", slug: "iso-standards" },
      { label: "Industry Standards", slug: "industry-standards" },
      { label: "Internal Standards", slug: "internal-standards" }
    ] as SubfolderDefinition[],
    allowedCategories: ["technical", "regulatory", "operational"] as DocumentCategory[]
  },
  templates: {
    label: "Templates",
    icon: "file-text",
    description: "Reusable document templates and forms",
    subfolders: [
      { label: "RFP Templates", slug: "rfp-templates" },
      { label: "Contract Templates", slug: "contract-templates" },
      { label: "Report Templates", slug: "report-templates" },
      { label: "Form Templates", slug: "form-templates" }
    ] as SubfolderDefinition[],
    allowedCategories: ["business", "legal", "technical", "financial", "operational"] as DocumentCategory[]
  },
  case_studies: {
    label: "Case Studies",
    icon: "book-open",
    description: "Project case studies and success stories",
    subfolders: [
      { label: "Completed Projects", slug: "completed-projects" },
      { label: "Best Practices", slug: "best-practices" },
      { label: "Lessons Learned", slug: "lessons-learned" }
    ] as SubfolderDefinition[],
    allowedCategories: ["business", "technical", "strategic", "research"] as DocumentCategory[]
  },
  reports: {
    label: "Reports",
    icon: "bar-chart-3",
    description: "Analysis reports and documentation",
    subfolders: [
      { label: "Annual Reports", slug: "annual-reports" },
      { label: "Quarterly Reports", slug: "quarterly-reports" },
      { label: "Audit Reports", slug: "audit-reports" },
      { label: "Research Reports", slug: "research-reports" }
    ] as SubfolderDefinition[],
    allowedCategories: ["financial", "strategic", "research", "operational", "regulatory"] as DocumentCategory[]
  },
  reference: {
    label: "Reference Materials",
    icon: "library",
    description: "Reference documentation and knowledge base",
    subfolders: [
      { label: "Technical References", slug: "technical-references" },
      { label: "Legal References", slug: "legal-references" },
      { label: "Market Research", slug: "market-research" },
      { label: "Vendor Information", slug: "vendor-information" }
    ] as SubfolderDefinition[],
    allowedCategories: ["technical", "legal", "research", "business"] as DocumentCategory[]
  },
  training: {
    label: "Training Materials",
    icon: "graduation-cap",
    description: "Training guides and educational content",
    subfolders: [
      { label: "User Manuals", slug: "user-manuals" },
      { label: "Training Guides", slug: "training-guides" },
      { label: "Tutorials", slug: "tutorials" },
      { label: "Certification Materials", slug: "certification-materials" }
    ] as SubfolderDefinition[],
    allowedCategories: ["technical", "operational", "hr", "it"] as DocumentCategory[]
  },
  governance: {
    label: "Governance",
    icon: "landmark",
    description: "Governance frameworks and compliance documents",
    subfolders: [
      { label: "Regulatory Compliance", slug: "regulatory-compliance" },
      { label: "Risk Management", slug: "risk-management" },
      { label: "Audit Documentation", slug: "audit-documentation" },
      { label: "Committee Minutes", slug: "committee-minutes" }
    ] as SubfolderDefinition[],
    allowedCategories: ["regulatory", "strategic", "legal", "financial"] as DocumentCategory[]
  },
  research: {
    label: "External Research",
    icon: "search",
    description: "External research reports from advisory firms and industry analysts",
    subfolders: [
      { label: "Gartner Reports", slug: "gartner-reports" },
      { label: "Forrester Reports", slug: "forrester-reports" },
      { label: "McKinsey Insights", slug: "mckinsey-insights" },
      { label: "Industry Analysis", slug: "industry-analysis" },
      { label: "Market Studies", slug: "market-studies" },
      { label: "Analyst Reports", slug: "analyst-reports" }
    ] as SubfolderDefinition[],
    allowedCategories: ["research", "strategic", "technical", "business"] as DocumentCategory[]
  }
} as const;

export type KnowledgeClassification = keyof typeof KNOWLEDGE_CLASSIFICATIONS;

export const KNOWLEDGE_CLASSIFICATION_LIST = Object.entries(KNOWLEDGE_CLASSIFICATIONS).map(([key, value]) => ({
  id: key as KnowledgeClassification,
  ...value
}));

export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  fileType: varchar("file_type", { length: 50 }).notNull(), // pdf, docx, txt, md
  fileSize: integer("file_size").notNull(), // bytes
  fileUrl: text("file_url"), // Storage URL for the file

  // Content
  fullText: text("full_text"), // Extracted text content
  summary: text("summary"), // AI-generated summary
  contentHash: varchar("content_hash", { length: 64 }), // SHA-256 hash of extracted text for duplicate detection

  // Categorization
  category: varchar("category", { length: 100 }), // Policy, Standard, Case Study, etc.
  tags: text("tags").array(), // Searchable tags
  accessLevel: varchar("access_level", { length: 50 }).notNull().default("internal"), // public, internal, confidential
  folderPath: text("folder_path"), // Relative folder path for bulk folder uploads (e.g., "reports/2024/Q1")

  // Processing Status
  processingStatus: varchar("processing_status", { length: 50 }).notNull().default("pending"), // pending, processing, completed, failed
  chunkCount: integer("chunk_count").default(0), // Number of chunks created

  // Metadata
  metadata: jsonb("metadata"), // Additional document metadata

  // Audit Trail
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  approvedBy: uuid("approved_by").references(() => users.id), // For document approval workflow
  approvedAt: timestamp("approved_at"),

  // Quality Metrics
  usageCount: integer("usage_count").default(0), // How many times used in RAG
  qualityScore: integer("quality_score"), // 0-100 quality rating (stored in metadata.qualityBreakdown)

  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  uploadedByIdx: index("knowledge_docs_uploaded_by_idx").on(table.uploadedBy),
  categoryIdx: index("knowledge_docs_category_idx").on(table.category),
  accessLevelIdx: index("knowledge_docs_access_level_idx").on(table.accessLevel),
  statusIdx: index("knowledge_docs_status_idx").on(table.processingStatus),
  contentHashIdx: index("knowledge_docs_content_hash_idx").on(table.contentHash),
  qualityScoreIdx: index("knowledge_docs_quality_score_idx").on(table.qualityScore),
  folderPathIdx: index("knowledge_docs_folder_path_idx").on(table.folderPath),
}));

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: uuid("document_id").notNull().references(() => knowledgeDocuments.id, { onDelete: "cascade" }),

  // Chunk Content
  chunkIndex: integer("chunk_index").notNull(), // Position in document
  content: text("content").notNull(), // Text content
  embedding: vector("embedding"), // Vector embedding (1536 dimensions for Anthropic)

  // Context
  metadata: jsonb("metadata"), // Page number, section title, etc.
  tokenCount: integer("token_count"), // Number of tokens in chunk

  // Quality Metrics
  retrievalCount: integer("retrieval_count").default(0), // How many times retrieved
  relevanceScore: numeric("relevance_score", { precision: 3, scale: 2 }), // Average relevance when retrieved

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  documentIdIdx: index("knowledge_chunks_doc_id_idx").on(table.documentId),
  // HNSW index for fast vector similarity search
  embeddingIdx: index("knowledge_chunks_embedding_idx").using('hnsw', table.embedding.op('vector_cosine_ops')),
}));

export const knowledgeQueries = pgTable("knowledge_queries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id),

  // Query Details
  query: text("query").notNull(), // User's search query
  queryEmbedding: vector("query_embedding"), // Vector embedding of query

  // Results
  retrievedChunkIds: text("retrieved_chunk_ids").array(), // IDs of chunks retrieved
  topResults: jsonb("top_results"), // Top results with scores

  // AI Response
  aiResponse: text("ai_response"), // Generated response
  confidenceScore: numeric("confidence_score", { precision: 3, scale: 2 }), // 0-1.0 confidence

  // Agent Information
  agentType: varchar("agent_type", { length: 50 }), // finance, security, technical, business, general

  // Audit & Analytics
  responseTime: integer("response_time"), // milliseconds
  userFeedback: integer("user_feedback"), // 1-5 rating
  metadata: jsonb("metadata"), // Additional context

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("knowledge_queries_user_id_idx").on(table.userId),
  createdAtIdx: index("knowledge_queries_created_at_idx").on(table.createdAt),
  agentTypeIdx: index("knowledge_queries_agent_type_idx").on(table.agentType),
}));

// Insert and Select Schemas for Knowledge Centre
export const insertKnowledgeDocumentSchema = createInsertSchema(knowledgeDocuments).omit({
  id: true,
  uploadedAt: true,
  updatedAt: true,
  chunkCount: true,
  usageCount: true,
}).extend({
  filename: z.string().min(1, "Filename is required"),
  fileType: z.enum(["pdf", "docx", "txt", "md", "doc", "png", "jpg", "jpeg", "tiff", "bmp", "gif", "xlsx", "csv", "pptx", "ppt", "json", "xml", "html", "rtf", "webp"]),
  fileSize: z.number().positive("File size must be positive"),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  accessLevel: z.enum(["public", "internal", "confidential"]).default("internal"),
  folderPath: z.string().max(500, "Folder path too long").optional(),
});

export const insertKnowledgeChunkSchema = createInsertSchema(knowledgeChunks).omit({
  id: true,
  createdAt: true,
  retrievalCount: true,
}).extend({
  documentId: z.string().min(1, "Document ID is required"),
  chunkIndex: z.number().int().nonnegative(),
  content: z.string().min(1, "Chunk content is required"),
  embedding: z.array(z.number()).length(1536).optional(),
});

export const insertKnowledgeQuerySchema = createInsertSchema(knowledgeQueries).omit({
  id: true,
  createdAt: true,
}).extend({
  query: z.string().min(1, "Query is required"),
  userId: z.string().min(1, "User ID is required"),
  agentType: z.enum(["finance", "security", "technical", "business", "general"]).default("general"),
});

export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;
export type InsertKnowledgeDocument = z.infer<typeof insertKnowledgeDocumentSchema>;

export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type InsertKnowledgeChunk = z.infer<typeof insertKnowledgeChunkSchema>;

export type KnowledgeQuery = typeof knowledgeQueries.$inferSelect;
export type InsertKnowledgeQuery = z.infer<typeof insertKnowledgeQuerySchema>;

// ============================================================================
// ANALYTICS - Knowledge Centre Analytics Dashboard
// Daily metrics aggregation and document quality tracking
// ============================================================================

export const analyticsDailyMetrics = pgTable("analytics_daily_metrics", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  totalQueries: integer("total_queries").default(0),
  totalSearches: integer("total_searches").default(0),
  totalGenerations: integer("total_generations").default(0),
  activeUsers: integer("active_users").default(0),
  avgConfidence: real("avg_confidence"),
  highConfidenceCount: integer("high_confidence_count").default(0),
  mediumConfidenceCount: integer("medium_confidence_count").default(0),
  lowConfidenceCount: integer("low_confidence_count").default(0),
  documentsUploaded: integer("documents_uploaded").default(0),
  citationsGenerated: integer("citations_generated").default(0),
  uniqueDocumentsCited: integer("unique_documents_cited").default(0),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  dateIdx: index("analytics_daily_metrics_date_idx").on(table.date),
}));

export const documentQualitySnapshots = pgTable("document_quality_snapshots", {
  id: serial("id").primaryKey(),
  documentId: uuid("document_id").notNull().references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  citationCount: integer("citation_count").default(0),
  viewCount: integer("view_count").default(0),
  avgRelevance: real("avg_relevance"),
  recencyScore: real("recency_score"),
  completenessScore: real("completeness_score"),
  qualityScore: real("quality_score"),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  documentIdIdx: index("doc_quality_snapshots_doc_id_idx").on(table.documentId),
  dateIdx: index("doc_quality_snapshots_date_idx").on(table.date),
}));

export const insertAnalyticsDailyMetricsSchema = createInsertSchema(analyticsDailyMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentQualitySnapshotSchema = createInsertSchema(documentQualitySnapshots).omit({
  id: true,
  createdAt: true,
});

export type AnalyticsDailyMetrics = typeof analyticsDailyMetrics.$inferSelect;
export type InsertAnalyticsDailyMetrics = z.infer<typeof insertAnalyticsDailyMetricsSchema>;

export type DocumentQualitySnapshot = typeof documentQualitySnapshots.$inferSelect;
export type InsertDocumentQualitySnapshot = z.infer<typeof insertDocumentQualitySnapshotSchema>;

// ============================================================================
// KNOWLEDGE GRAPH - Entity Extraction & Relationship Mapping
// Interactive knowledge graph for document relationships and insights
// ============================================================================

export const ENTITY_TYPES = [
  'document', 'policy', 'regulation', 'project', 'initiative',
  'department', 'person', 'technology', 'process', 'kpi',
  'risk', 'requirement', 'standard', 'framework'
] as const;

export const RELATIONSHIP_TYPES = [
  'references', 'implements', 'supersedes', 'depends_on',
  'related_to', 'owned_by', 'managed_by', 'impacts',
  'enables', 'constrains', 'derived_from', 'part_of'
] as const;

export const knowledgeEntities = pgTable("knowledge_entities", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  description: text("description"),

  sourceDocumentId: uuid("source_document_id").references(() => knowledgeDocuments.id, { onDelete: "set null" }),

  properties: jsonb("properties"),
  embedding: vector("embedding"),

  confidence: real("confidence").default(0.8),
  isVerified: boolean("is_verified").default(false),
  verifiedBy: uuid("verified_by").references(() => users.id),

  usageCount: integer("usage_count").default(0),
  lastAccessed: timestamp("last_accessed"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  entityTypeIdx: index("knowledge_entities_type_idx").on(table.entityType),
  sourceDocIdx: index("knowledge_entities_source_doc_idx").on(table.sourceDocumentId),
  nameIdx: index("knowledge_entities_name_idx").on(table.name),
}));

export const knowledgeRelationships = pgTable("knowledge_relationships", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  sourceEntityId: uuid("source_entity_id").notNull().references(() => knowledgeEntities.id, { onDelete: "cascade" }),
  targetEntityId: uuid("target_entity_id").notNull().references(() => knowledgeEntities.id, { onDelete: "cascade" }),
  relationshipType: varchar("relationship_type", { length: 50 }).notNull(),

  description: text("description"),
  strength: real("strength").default(0.5),
  confidence: real("confidence").default(0.8),

  evidenceChunks: text("evidence_chunks").array(),
  metadata: jsonb("metadata"),

  isVerified: boolean("is_verified").default(false),
  verifiedBy: uuid("verified_by").references(() => users.id),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  sourceEntityIdx: index("knowledge_rel_source_idx").on(table.sourceEntityId),
  targetEntityIdx: index("knowledge_rel_target_idx").on(table.targetEntityId),
  relationTypeIdx: index("knowledge_rel_type_idx").on(table.relationshipType),
}));

// ============================================================================
// EXECUTIVE BRIEFINGS - AI-Generated Summary Packs
// Multi-document summarization with trends and recommendations
// ============================================================================

export const BRIEFING_STATUS = ['draft', 'generating', 'ready', 'published', 'archived'] as const;
export const BRIEFING_TYPES = ['weekly_digest', 'topic_deep_dive', 'trend_analysis', 'gap_assessment', 'custom'] as const;

export const executiveBriefings = pgTable("executive_briefings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),

  title: text("title").notNull(),
  briefingType: varchar("briefing_type", { length: 50 }).notNull().default("custom"),
  status: varchar("status", { length: 50 }).notNull().default("draft"),

  scope: jsonb("scope"),

  executiveSummary: text("executive_summary"),
  keyFindings: jsonb("key_findings"),
  trends: jsonb("trends"),
  recommendations: jsonb("recommendations"),
  riskAlerts: jsonb("risk_alerts"),

  sourceDocumentIds: text("source_document_ids").array(),
  citationCount: integer("citation_count").default(0),

  confidenceScore: real("confidence_score"),
  qualityScore: integer("quality_score"),

  generatedBy: uuid("generated_by").notNull().references(() => users.id),
  generatedAt: timestamp("generated_at"),

  weekStart: date("week_start"),
  weekEnd: date("week_end"),

  previousBriefingId: varchar("previous_briefing_id"),
  changesSinceLast: jsonb("changes_since_last"),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("exec_briefings_status_idx").on(table.status),
  typeIdx: index("exec_briefings_type_idx").on(table.briefingType),
  generatedByIdx: index("exec_briefings_generated_by_idx").on(table.generatedBy),
  weekIdx: index("exec_briefings_week_idx").on(table.weekStart, table.weekEnd),
}));

export const briefingSections = pgTable("briefing_sections", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  briefingId: uuid("briefing_id").notNull().references(() => executiveBriefings.id, { onDelete: "cascade" }),

  sectionType: varchar("section_type", { length: 50 }).notNull(),
  title: text("title").notNull(),
  content: text("content"),

  highlights: jsonb("highlights"),
  citations: jsonb("citations"),
  dataPoints: jsonb("data_points"),

  sortOrder: integer("sort_order").default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  briefingIdx: index("briefing_sections_briefing_idx").on(table.briefingId),
  sectionTypeIdx: index("briefing_sections_type_idx").on(table.sectionType),
}));

