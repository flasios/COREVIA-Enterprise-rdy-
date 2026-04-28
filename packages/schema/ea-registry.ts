/** @module ea — Schema owner. Only this module may write to these tables. */
/**
 * EA Registry Schema — Structured Enterprise Architecture Baseline
 *
 * These tables hold the REAL current-state inventory of the organisation's
 * applications, capabilities, data domains, technology standards and integrations.
 * This baseline feeds AI reasoning for every demand/initiative impact analysis.
 *
 * Without baseline → storytelling.
 * With baseline → governance.
 */

import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Provenance columns shared across all 5 EA entities.
 * Tracks where the record came from (manual vs demand-ingested),
 * verification status, and the source demand report reference.
 */
const provenanceColumns = {
  /** How this record was created: manual | demand_ingested | ai_suggested */
  sourceType: varchar("source_type", { length: 32 }).notNull().default("manual"),
  /** Reference to the demand report that triggered this entry */
  sourceDemandId: uuid("source_demand_id"),
  /** Reference to the specific report version (BC/Req/EA) */
  sourceVersionId: uuid("source_version_id"),
  /** Verification lifecycle: pending_verification | verified | rejected | needs_review */
  verificationStatus: varchar("verification_status", { length: 32 }).notNull().default("verified"),
  /** Who verified this record */
  verifiedBy: varchar("verified_by", { length: 128 }),
  /** When it was verified */
  verifiedAt: timestamp("verified_at"),
  /** Confidence score from AI (0-100) for demand-ingested records */
  confidenceScore: integer("confidence_score"),
};

// ── EA Applications ─────────────────────────────────────────────────────
export const eaApplications = pgTable(
  "ea_applications",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 256 }).notNull(),
    vendor: varchar("vendor", { length: 256 }),
    version: varchar("version", { length: 64 }),
    description: text("description"),
    criticality: varchar("criticality", { length: 32 }).notNull().default("medium"),
    lifecycle: varchar("lifecycle", { length: 32 }).notNull().default("active"),
    hosting: varchar("hosting", { length: 64 }),
    department: varchar("department", { length: 128 }),
    owner: varchar("owner", { length: 128 }),
    tier: varchar("tier", { length: 32 }),
    userCount: integer("user_count"),
    annualCost: integer("annual_cost"),
    contractExpiry: varchar("contract_expiry", { length: 32 }),
    dataClassification: varchar("data_classification", { length: 32 }),
    disasterRecovery: varchar("disaster_recovery", { length: 64 }),
    notes: text("notes"),
    metadata: jsonb("metadata"),
    ...provenanceColumns,
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: index("ea_applications_name_idx").on(table.name),
    lifecycleIdx: index("ea_applications_lifecycle_idx").on(table.lifecycle),
    criticalityIdx: index("ea_applications_criticality_idx").on(table.criticality),
    verificationIdx: index("ea_applications_verification_idx").on(table.verificationStatus),
    sourceIdx: index("ea_applications_source_idx").on(table.sourceDemandId),
  })
);

export const insertEaApplicationSchema = createInsertSchema(eaApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateEaApplicationSchema = insertEaApplicationSchema.partial();
export type EaApplication = typeof eaApplications.$inferSelect;
export type InsertEaApplication = z.infer<typeof insertEaApplicationSchema>;

// ── EA Capabilities ─────────────────────────────────────────────────────
export const eaCapabilities = pgTable(
  "ea_capabilities",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 256 }).notNull(),
    level: integer("level").notNull().default(1),
    parentId: uuid("parent_id"),
    domain: varchar("domain", { length: 128 }),
    owner: varchar("owner", { length: 128 }),
    maturity: varchar("maturity", { length: 32 }),
    strategicImportance: varchar("strategic_importance", { length: 32 }),
    description: text("description"),
    supportingApplications: jsonb("supporting_applications").$type<string[]>().default([]),
    notes: text("notes"),
    metadata: jsonb("metadata"),
    ...provenanceColumns,
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: index("ea_capabilities_name_idx").on(table.name),
    domainIdx: index("ea_capabilities_domain_idx").on(table.domain),
    parentIdx: index("ea_capabilities_parent_idx").on(table.parentId),
    verificationIdx: index("ea_capabilities_verification_idx").on(table.verificationStatus),
  })
);

export const insertEaCapabilitySchema = createInsertSchema(eaCapabilities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateEaCapabilitySchema = insertEaCapabilitySchema.partial();
export type EaCapability = typeof eaCapabilities.$inferSelect;
export type InsertEaCapability = z.infer<typeof insertEaCapabilitySchema>;

// ── EA Data Domains ─────────────────────────────────────────────────────
export const eaDataDomains = pgTable(
  "ea_data_domains",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 256 }).notNull(),
    classification: varchar("classification", { length: 32 }).notNull().default("internal"),
    owner: varchar("owner", { length: 128 }),
    steward: varchar("steward", { length: 128 }),
    description: text("description"),
    piiFlag: boolean("pii_flag").notNull().default(false),
    crossBorderRestriction: boolean("cross_border_restriction").notNull().default(false),
    retentionPeriod: varchar("retention_period", { length: 64 }),
    storageLocation: varchar("storage_location", { length: 128 }),
    qualityScore: integer("quality_score"),
    sourceSystem: varchar("source_system", { length: 128 }),
    regulatoryFramework: varchar("regulatory_framework", { length: 128 }),
    notes: text("notes"),
    metadata: jsonb("metadata"),
    ...provenanceColumns,
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: index("ea_data_domains_name_idx").on(table.name),
    classificationIdx: index("ea_data_domains_classification_idx").on(table.classification),
    verificationIdx: index("ea_data_domains_verification_idx").on(table.verificationStatus),
  })
);

export const insertEaDataDomainSchema = createInsertSchema(eaDataDomains).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateEaDataDomainSchema = insertEaDataDomainSchema.partial();
export type EaDataDomain = typeof eaDataDomains.$inferSelect;
export type InsertEaDataDomain = z.infer<typeof insertEaDataDomainSchema>;

// ── EA Technology Standards ─────────────────────────────────────────────
export const eaTechnologyStandards = pgTable(
  "ea_technology_standards",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 256 }).notNull(),
    layer: varchar("layer", { length: 64 }).notNull(),
    category: varchar("category", { length: 64 }),
    vendor: varchar("vendor", { length: 128 }),
    version: varchar("version", { length: 64 }),
    status: varchar("status", { length: 32 }).notNull().default("approved"),
    lifecycle: varchar("lifecycle", { length: 32 }).notNull().default("active"),
    description: text("description"),
    owner: varchar("owner", { length: 128 }),
    supportExpiry: varchar("support_expiry", { length: 32 }),
    replacementPlan: text("replacement_plan"),
    notes: text("notes"),
    metadata: jsonb("metadata"),
    ...provenanceColumns,
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: index("ea_tech_standards_name_idx").on(table.name),
    layerIdx: index("ea_tech_standards_layer_idx").on(table.layer),
    statusIdx: index("ea_tech_standards_status_idx").on(table.status),
    verificationIdx: index("ea_tech_standards_verification_idx").on(table.verificationStatus),
  })
);

export const insertEaTechnologyStandardSchema = createInsertSchema(eaTechnologyStandards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateEaTechnologyStandardSchema = insertEaTechnologyStandardSchema.partial();
export type EaTechnologyStandard = typeof eaTechnologyStandards.$inferSelect;
export type InsertEaTechnologyStandard = z.infer<typeof insertEaTechnologyStandardSchema>;

// ── EA Integrations ─────────────────────────────────────────────────────
export const eaIntegrations = pgTable(
  "ea_integrations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    sourceAppId: uuid("source_app_id"),
    targetAppId: uuid("target_app_id"),
    sourceName: varchar("source_name", { length: 256 }).notNull(),
    targetName: varchar("target_name", { length: 256 }).notNull(),
    protocol: varchar("protocol", { length: 64 }),
    pattern: varchar("pattern", { length: 64 }),
    frequency: varchar("frequency", { length: 64 }),
    dataFlow: varchar("data_flow", { length: 64 }),
    criticality: varchar("criticality", { length: 32 }).notNull().default("medium"),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    description: text("description"),
    owner: varchar("owner", { length: 128 }),
    notes: text("notes"),
    metadata: jsonb("metadata"),
    ...provenanceColumns,
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    sourceIdx: index("ea_integrations_source_idx").on(table.sourceName),
    targetIdx: index("ea_integrations_target_idx").on(table.targetName),
    statusIdx: index("ea_integrations_status_idx").on(table.status),
    verificationIdx: index("ea_integrations_verification_idx").on(table.verificationStatus),
  })
);

export const insertEaIntegrationSchema = createInsertSchema(eaIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateEaIntegrationSchema = insertEaIntegrationSchema.partial();
export type EaIntegration = typeof eaIntegrations.$inferSelect;
export type InsertEaIntegration = z.infer<typeof insertEaIntegrationSchema>;

// ── EA Documents (per sub-service attachments) ──────────────────────────
export const eaDocuments = pgTable(
  "ea_documents",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    /** Which sub-service: applications | capabilities | data_domains | technology_standards | integrations */
    registryType: varchar("registry_type", { length: 32 }).notNull(),
    /** FK to the specific registry entry (nullable for general uploads) */
    registryEntryId: uuid("registry_entry_id"),
    /** Document template type for structured uploads */
    templateType: varchar("template_type", { length: 64 }),
    /** Original filename */
    fileName: varchar("file_name", { length: 512 }).notNull(),
    /** Stored file path on disk */
    filePath: text("file_path").notNull(),
    /** MIME type */
    mimeType: varchar("mime_type", { length: 128 }),
    /** File size in bytes */
    fileSize: integer("file_size"),
    /** Document category: architecture_diagram | policy | standard | template | evidence | assessment | other */
    category: varchar("category", { length: 64 }).notNull().default("other"),
    /** Optional description */
    description: text("description"),
    /** Who uploaded */
    uploadedBy: varchar("uploaded_by", { length: 128 }),
    /** Source demand reference (if from demand ingest) */
    sourceDemandId: uuid("source_demand_id"),
    /** Extracted/parsed metadata from document */
    extractedData: jsonb("extracted_data"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    registryTypeIdx: index("ea_documents_registry_type_idx").on(table.registryType),
    entryIdx: index("ea_documents_entry_idx").on(table.registryEntryId),
    templateIdx: index("ea_documents_template_idx").on(table.templateType),
  })
);

export const insertEaDocumentSchema = createInsertSchema(eaDocuments).omit({
  id: true,
  createdAt: true,
});
export type EaDocument = typeof eaDocuments.$inferSelect;
export type InsertEaDocument = z.infer<typeof insertEaDocumentSchema>;

// ── Drizzle Relations ───────────────────────────────────────────────────
export const eaCapabilitiesRelations = relations(eaCapabilities, ({ one, many }) => ({
  parent: one(eaCapabilities, {
    fields: [eaCapabilities.parentId],
    references: [eaCapabilities.id],
    relationName: "capabilityHierarchy",
  }),
  children: many(eaCapabilities, { relationName: "capabilityHierarchy" }),
}));

export const eaIntegrationsRelations = relations(eaIntegrations, ({ one }) => ({
  sourceApp: one(eaApplications, {
    fields: [eaIntegrations.sourceAppId],
    references: [eaApplications.id],
    relationName: "integrationSource",
  }),
  targetApp: one(eaApplications, {
    fields: [eaIntegrations.targetAppId],
    references: [eaApplications.id],
    relationName: "integrationTarget",
  }),
}));

export const eaApplicationsRelations = relations(eaApplications, ({ many }) => ({
  sourceIntegrations: many(eaIntegrations, { relationName: "integrationSource" }),
  targetIntegrations: many(eaIntegrations, { relationName: "integrationTarget" }),
}));
