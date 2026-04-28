/**
 * Feature Flag Service — Evaluation engine for feature flags.
 *
 * Reads flags from the database, caches them in-memory (5-minute TTL),
 * and evaluates flag state based on context (user role, org, environment).
 */

import { eq } from "drizzle-orm";
import { featureFlags, type FeatureFlag } from "./feature-flag.schema";
import { appCache } from "../cache/index";
import { logger } from "../logging/Logger";
import { db } from "../../db";

const CACHE_KEY = "feature-flags:all";
const CACHE_TTL = 5 * 60_000; // 5 minutes

export interface FeatureFlagContext {
  userId?: string;
  role?: string;
  organizationId?: string;
  environment?: string;
}

export class FeatureFlagService {
  private isEnvironmentAllowed(flag: FeatureFlag, context: FeatureFlagContext): boolean {
    if (!flag.targetEnvironments || flag.targetEnvironments.length === 0) {
      return true;
    }

    const env = context.environment ?? process.env.NODE_ENV ?? "development";
    return flag.targetEnvironments.includes(env);
  }

  private isRoleAllowed(flag: FeatureFlag, context: FeatureFlagContext): boolean {
    if (!flag.targetRoles || flag.targetRoles.length === 0) {
      return true;
    }

    return Boolean(context.role && flag.targetRoles.includes(context.role));
  }

  private isOrganizationAllowed(flag: FeatureFlag, context: FeatureFlagContext): boolean {
    if (!flag.targetOrganizations || flag.targetOrganizations.length === 0) {
      return true;
    }

    return Boolean(context.organizationId && flag.targetOrganizations.includes(context.organizationId));
  }

  private evaluateRollout(flag: FeatureFlag, context: FeatureFlagContext): boolean | null {
    if (flag.rolloutPercentage === null || flag.rolloutPercentage === undefined) {
      return null;
    }

    if (flag.rolloutPercentage === 0) {
      return false;
    }

    if (flag.rolloutPercentage >= 100) {
      return true;
    }

    const userId = context.userId ?? "anonymous";
    const hash = this.hashString(`${flag.key}:${userId}`);
    return hash % 100 < flag.rolloutPercentage;
  }

  /**
   * Check if a feature flag is enabled for the given context.
   */
  async isEnabled(key: string, context: FeatureFlagContext = {}): Promise<boolean> {
    const flag = await this.getFlag(key);
    if (!flag) return false;
    return this.evaluate(flag, context);
  }

  /**
   * Get all feature flags (cached).
   */
  async getAllFlags(): Promise<FeatureFlag[]> {
    const cached = appCache.get<FeatureFlag[]>(CACHE_KEY);
    if (cached) return cached;

    try {
      const flags = await db.select().from(featureFlags);
      appCache.set(CACHE_KEY, flags, CACHE_TTL);
      return flags;
    } catch (err) {
      logger.error("[FeatureFlags] Failed to load flags from database", err);
      return [];
    }
  }

  /**
   * Get a single flag by key (cached).
   */
  async getFlag(key: string): Promise<FeatureFlag | undefined> {
    const flags = await this.getAllFlags();
    return flags.find((f) => f.key === key);
  }

  /**
   * Create a new feature flag.
   */
  async createFlag(input: Omit<FeatureFlag, "id" | "createdAt" | "updatedAt">): Promise<FeatureFlag> {
    const [flag] = await db.insert(featureFlags).values(input).returning();
    this.invalidateCache();
    if (!flag) {
      throw new Error("Failed to create feature flag");
    }
    return flag;
  }

  /**
   * Update an existing feature flag.
   */
  async updateFlag(id: string, input: Partial<FeatureFlag>): Promise<FeatureFlag | undefined> {
    const [flag] = await db
      .update(featureFlags)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(featureFlags.id, id))
      .returning();
    this.invalidateCache();
    return flag;
  }

  /**
   * Delete a feature flag.
   */
  async deleteFlag(id: string): Promise<boolean> {
    const result = await db.delete(featureFlags).where(eq(featureFlags.id, id)).returning();
    this.invalidateCache();
    return result.length > 0;
  }

  /**
   * Invalidate the flag cache (e.g., after CRUD operations).
   */
  invalidateCache(): void {
    appCache.del(CACHE_KEY);
  }

  // ── Private evaluation logic ──────────────────────────────────────

  private evaluate(flag: FeatureFlag, context: FeatureFlagContext): boolean {
    if (!flag.enabled) {
      return false;
    }

    if (!this.isEnvironmentAllowed(flag, context)) {
      return false;
    }

    if (!this.isRoleAllowed(flag, context)) {
      return false;
    }

    if (!this.isOrganizationAllowed(flag, context)) {
      return false;
    }

    const rolloutResult = this.evaluateRollout(flag, context);
    if (rolloutResult !== null) {
      return rolloutResult;
    }

    return true;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.codePointAt(i) ?? 0;
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

export const featureFlagService = new FeatureFlagService();
