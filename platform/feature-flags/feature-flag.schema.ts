/**
 * Feature Flag System — Database-backed feature toggles.
 *
 * Supports:
 *   - Boolean on/off flags
 *   - Percentage rollout
 *   - Per-role targeting
 *   - Per-tenant (organization) targeting
 *   - Environment-scoped flags
 *
 * Schema: uses the `feature_flags` table (see schema definition below).
 */

import { pgTable, text, boolean, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ── Database Schema ─────────────────────────────────────────────────

export const featureFlags = pgTable("feature_flags", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(false),
  /** Percentage of users to enable for (0-100). null = all or none based on `enabled` */
  rolloutPercentage: integer("rollout_percentage"),
  /** Roles this flag applies to. null = all roles */
  targetRoles: jsonb("target_roles").$type<string[] | null>(),
  /** Organization IDs this flag applies to. null = all orgs */
  targetOrganizations: jsonb("target_organizations").$type<string[] | null>(),
  /** Environment(s) this flag is active in. null = all environments */
  targetEnvironments: jsonb("target_environments").$type<string[] | null>(),
  /** Arbitrary metadata */
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: text("created_by"),
});

// ── Zod Schemas ─────────────────────────────────────────────────────

export const insertFeatureFlagSchema = createInsertSchema(featureFlags);
export const selectFeatureFlagSchema = createSelectSchema(featureFlags);

export const createFeatureFlagInput = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/, "Key must be lowercase alphanumeric with hyphens/underscores"),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  enabled: z.boolean().default(false),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
  targetRoles: z.array(z.string()).optional(),
  targetOrganizations: z.array(z.string()).optional(),
  targetEnvironments: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateFeatureFlagInput = createFeatureFlagInput.partial().omit({ key: true });

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = z.infer<typeof createFeatureFlagInput>;
