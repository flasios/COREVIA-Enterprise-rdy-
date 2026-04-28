import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, uuid, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./platform";

export const WORKSPACE_SERVICE_TYPES = [
  "mission_control",
  "delivery_studio",
  "innovation_lab",
  "transformation_hub",
] as const;

export const WORKSPACE_STATUS = [
  "active",
  "draft",
  "monitoring",
  "archived",
] as const;

export const WORKSPACE_CLASSIFICATIONS = [
  "public",
  "internal",
  "confidential",
  "sovereign",
] as const;

export type WorkspaceServiceType = typeof WORKSPACE_SERVICE_TYPES[number];
export type WorkspaceStatus = typeof WORKSPACE_STATUS[number];
export type WorkspaceClassification = typeof WORKSPACE_CLASSIFICATIONS[number];

export const intelligentWorkspaces = pgTable("intelligent_workspaces", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  description: text("description").notNull(),
  mission: text("mission").notNull(),
  serviceType: varchar("service_type", { length: 40 }).notNull().default("mission_control"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  classification: varchar("classification", { length: 20 }).notNull().default("internal"),
  assistantMode: varchar("assistant_mode", { length: 40 }).notNull().default("copilot_orchestrated"),
  northStar: text("north_star").notNull(),
  focusAreas: jsonb("focus_areas").notNull().default(sql`'[]'::jsonb`),
  operatingCadence: jsonb("operating_cadence").notNull().default(sql`'[]'::jsonb`),
  copilots: jsonb("copilots").notNull().default(sql`'[]'::jsonb`),
  metrics: jsonb("metrics").notNull().default(sql`'[]'::jsonb`),
  activityFeed: jsonb("activity_feed").notNull().default(sql`'[]'::jsonb`),
  recommendations: jsonb("recommendations").notNull().default(sql`'[]'::jsonb`),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  slugIdx: index("intelligent_workspaces_slug_idx").on(table.slug),
  statusIdx: index("intelligent_workspaces_status_idx").on(table.status),
  serviceTypeIdx: index("intelligent_workspaces_type_idx").on(table.serviceType),
  createdByIdx: index("intelligent_workspaces_created_by_idx").on(table.createdBy),
}));

export const insertIntelligentWorkspaceSchema = createInsertSchema(intelligentWorkspaces).omit({
  id: true,
  slug: true,
  northStar: true,
  focusAreas: true,
  operatingCadence: true,
  copilots: true,
  metrics: true,
  activityFeed: true,
  recommendations: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  serviceType: z.enum(WORKSPACE_SERVICE_TYPES).default("mission_control"),
  status: z.enum(WORKSPACE_STATUS).default("active"),
  classification: z.enum(WORKSPACE_CLASSIFICATIONS).default("internal"),
});

export const updateIntelligentWorkspaceSchema = createInsertSchema(intelligentWorkspaces).partial().omit({
  id: true,
  slug: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  serviceType: z.enum(WORKSPACE_SERVICE_TYPES).optional(),
  status: z.enum(WORKSPACE_STATUS).optional(),
  classification: z.enum(WORKSPACE_CLASSIFICATIONS).optional(),
});

export type IntelligentWorkspace = typeof intelligentWorkspaces.$inferSelect;
export type InsertIntelligentWorkspace = z.infer<typeof insertIntelligentWorkspaceSchema>;
export type UpdateIntelligentWorkspace = z.infer<typeof updateIntelligentWorkspaceSchema>;