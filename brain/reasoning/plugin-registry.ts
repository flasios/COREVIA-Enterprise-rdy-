import { coreviaStorage } from "../storage";
import type { EngineKind, UseCaseType } from "./engine-router";
import { logger } from "../../platform/observability";

// ============================================================================
// TYPES
// ============================================================================

export type PluginCapability =
  | "BUSINESS_CASE"
  | "REQUIREMENTS"
  | "WBS"
  | "STRATEGIC_FIT"
  | "RISK_ANALYSIS"
  | "GENERAL_REASONING"
  | "SUMMARIZATION"
  | "CLASSIFICATION"
  | "DISTILLATION"
  | "PATTERN_EXTRACTION"
  | "TRAINING_DATA";

export type PluginHealth = "HEALTHY" | "DEGRADED" | "UNAVAILABLE";

export interface PluginDescriptor {
  /** DB engine_plugin_id */
  enginePluginId: string;
  /** Engine role: A, B, or C */
  kind: EngineKind;
  /** Human-readable name (e.g. "Mistral 3 Local", "Claude Sonnet") */
  name: string;
  /** Semantic version */
  version: string;
  /** Whether this plugin is enabled */
  enabled: boolean;
  /** Max classification level this plugin can handle */
  allowedMaxClass: string;
  /** What use-cases this plugin supports */
  capabilities: PluginCapability[];
  /** Provider-specific config (API keys, endpoints, model name, etc.) */
  config: Record<string, unknown>;
  /** Priority for selection within the same role (lower = preferred) */
  priority: number;
  /** Current health status (cached, refreshed periodically) */
  health: PluginHealth;
  /** Last health check timestamp */
  lastHealthCheck: string | null;
}

export interface PluginSelectionCriteria {
  /** Engine role to select from */
  kind: EngineKind;
  /** Required capability (maps from use case) */
  requiredCapability?: PluginCapability;
  /** Maximum allowed classification for the data */
  maxClassification?: string;
  /** Prefer a specific plugin by ID */
  preferredPluginId?: string;
}

export interface PluginSelectionResult {
  /** The selected plugin, or null if none available */
  plugin: PluginDescriptor | null;
  /** Chain of fallback plugins (in order of priority) */
  fallbackChain: PluginDescriptor[];
  /** Why this plugin was selected */
  reason: string;
}

// ============================================================================
// CLASSIFICATION HIERARCHY
// ============================================================================

const CLASS_HIERARCHY: Record<string, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  HIGH_SENSITIVE: 3,
  SOVEREIGN: 4,
};

function classLevel(classification: string): number {
  return CLASS_HIERARCHY[classification.toUpperCase()] ?? 1;
}

function canHandleClassification(pluginMaxClass: string, dataClassification: string): boolean {
  return classLevel(pluginMaxClass) >= classLevel(dataClassification);
}

// ============================================================================
// USE CASE → CAPABILITY MAPPING
// ============================================================================

const USE_CASE_TO_CAPABILITY: Record<UseCaseType, PluginCapability> = {
  BUSINESS_CASE: "BUSINESS_CASE",
  DEMAND_FIELDS: "GENERAL_REASONING",
  REQUIREMENTS: "REQUIREMENTS",
  WBS: "WBS",
  STRATEGIC_FIT: "STRATEGIC_FIT",
  MARKET_RESEARCH: "GENERAL_REASONING",
  RISK_ANALYSIS: "RISK_ANALYSIS",
  GENERAL: "GENERAL_REASONING",
};

// ============================================================================
// PLUGIN REGISTRY
// ============================================================================

/**
 * PluginRegistry — Manages multiple model plugins within each engine role.
 *
 * Each engine ROLE (A: Sovereign, B: External, C: Distillation) can have
 * multiple plugins registered. The registry:
 *
 * 1. Loads plugins from the `engine_plugins` DB table
 * 2. Caches them in memory with health status
 * 3. Selects the best plugin for a given role + capability
 * 4. Provides fallback chains within the same role
 * 5. Supports health checks and priority-based selection
 *
 * Examples:
 *   Role A plugins: Mistral 3 (local), DeepSeek R1 (local), Llama 3 (local)
 *   Role B plugins: Claude Sonnet (API), GPT-4o (API), DeepSeek API
 *   Role C plugins: Distill-v1 (rules), Distill-v2 (LLM-assisted)
 */
export class PluginRegistry {
  private plugins: Map<string, PluginDescriptor> = new Map();
  private lastRefresh: number = 0;
  private readonly CACHE_TTL_MS = 60_000; // 1 minute

  /**
   * Load or refresh plugins from the DB.
   */
  async refresh(): Promise<void> {
    try {
      const dbPlugins = await coreviaStorage.listEnginePlugins();
      this.plugins.clear();

      for (const dbPlugin of dbPlugins) {
        const caps = dbPlugin.capabilities as Record<string, boolean> | PluginCapability[] | null;
        let capabilities: PluginCapability[] = [];

        if (Array.isArray(caps)) {
          capabilities = caps as PluginCapability[];
        } else if (caps && typeof caps === "object") {
          capabilities = Object.entries(caps)
            .filter(([, v]) => v === true)
            .map(([k]) => k as PluginCapability);
        }

        const config = (dbPlugin.config || {}) as Record<string, unknown>;

        this.plugins.set(dbPlugin.enginePluginId, {
          enginePluginId: dbPlugin.enginePluginId,
          kind: dbPlugin.kind as EngineKind,
          name: dbPlugin.name,
          version: dbPlugin.version,
          enabled: dbPlugin.enabled,
          allowedMaxClass: dbPlugin.allowedMaxClass || "INTERNAL",
          capabilities,
          config,
          priority: typeof config.priority === "number" ? config.priority : 100,
          health: "HEALTHY", // DB plugins assumed healthy until checked
          lastHealthCheck: null,
        });
      }

      this.lastRefresh = Date.now();
      logger.info(`[PluginRegistry] Refreshed: ${this.plugins.size} plugins loaded`);
    } catch (error) {
      logger.error("[PluginRegistry] Failed to refresh:", error instanceof Error ? error.message : error);
    }
  }

  /**
   * Ensure cache is fresh.
   */
  private async ensureFresh(): Promise<void> {
    if (Date.now() - this.lastRefresh > this.CACHE_TTL_MS) {
      await this.refresh();
    }
  }

  /**
   * Select the best plugin for a given engine role + criteria.
   * Returns the plugin plus a fallback chain.
   */
  async select(criteria: PluginSelectionCriteria): Promise<PluginSelectionResult> {
    await this.ensureFresh();

    // Get all enabled plugins for this role
    const candidates = Array.from(this.plugins.values())
      .filter((p) => p.kind === criteria.kind && p.enabled && p.health !== "UNAVAILABLE");

    if (candidates.length === 0) {
      return {
        plugin: null,
        fallbackChain: [],
        reason: `No enabled plugins for role ${criteria.kind}`,
      };
    }

    // Filter by classification
    let filtered = criteria.maxClassification
      ? candidates.filter((p) => canHandleClassification(p.allowedMaxClass, criteria.maxClassification!))
      : candidates;

    if (filtered.length === 0) {
      return {
        plugin: null,
        fallbackChain: [],
        reason: `No plugins for role ${criteria.kind} can handle classification ${criteria.maxClassification}`,
      };
    }

    // Filter by capability (if specified)
    if (criteria.requiredCapability) {
      const capFiltered = filtered.filter(
        (p) =>
          p.capabilities.length === 0 || // empty = supports everything
          p.capabilities.includes(criteria.requiredCapability!) ||
          p.capabilities.includes("GENERAL_REASONING")
      );
      if (capFiltered.length > 0) {
        filtered = capFiltered;
      }
      // If no capability match, still use all classification-matching plugins
    }

    // Prefer healthy over degraded
    const healthy = filtered.filter((p) => p.health === "HEALTHY");
    const ordered = healthy.length > 0 ? healthy : filtered;

    // Sort by priority (lower = preferred) then by name for stability
    ordered.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

    // Check for preferred plugin
    if (criteria.preferredPluginId) {
      const preferred = ordered.find((p) => p.enginePluginId === criteria.preferredPluginId);
      if (preferred) {
        const fallbackChain = ordered.filter((p) => p.enginePluginId !== preferred.enginePluginId);
        return {
          plugin: preferred,
          fallbackChain,
          reason: `Preferred plugin "${preferred.name}" selected`,
        };
      }
    }

    const [primary, ...fallback] = ordered;
    return {
      plugin: primary!,
      fallbackChain: fallback,
      reason: `Selected "${primary!.name}" (priority: ${primary!.priority}, health: ${primary!.health})`,
    };
  }

  /**
   * List all plugins for a given role.
   */
  async listByKind(kind: EngineKind): Promise<PluginDescriptor[]> {
    await this.ensureFresh();
    return Array.from(this.plugins.values())
      .filter((p) => p.kind === kind)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * List all plugins.
   */
  async listAll(): Promise<PluginDescriptor[]> {
    await this.ensureFresh();
    return Array.from(this.plugins.values()).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get a plugin by ID.
   */
  async get(enginePluginId: string): Promise<PluginDescriptor | null> {
    await this.ensureFresh();
    return this.plugins.get(enginePluginId) || null;
  }

  /**
   * Mark a plugin as unhealthy (e.g., after a request failure).
   */
  markUnhealthy(enginePluginId: string, status: PluginHealth = "UNAVAILABLE"): void {
    const plugin = this.plugins.get(enginePluginId);
    if (plugin) {
      plugin.health = status;
      plugin.lastHealthCheck = new Date().toISOString();
      logger.info(`[PluginRegistry] Plugin "${plugin.name}" marked as ${status}`);
    }
  }

  /**
   * Mark a plugin as healthy.
   */
  markHealthy(enginePluginId: string): void {
    const plugin = this.plugins.get(enginePluginId);
    if (plugin) {
      plugin.health = "HEALTHY";
      plugin.lastHealthCheck = new Date().toISOString();
    }
  }

  /**
   * Map use case type to the required capability.
   */
  resolveCapability(useCaseType: UseCaseType): PluginCapability {
    return USE_CASE_TO_CAPABILITY[useCaseType] || "GENERAL_REASONING";
  }

  /**
   * Get summary stats for monitoring.
   */
  async getStats(): Promise<{
    total: number;
    byKind: Record<EngineKind, number>;
    healthy: number;
    degraded: number;
    unavailable: number;
  }> {
    await this.ensureFresh();
    const all = Array.from(this.plugins.values());
    return {
      total: all.length,
      byKind: {
        SOVEREIGN_INTERNAL: all.filter((p) => p.kind === "SOVEREIGN_INTERNAL").length,
        EXTERNAL_HYBRID: all.filter((p) => p.kind === "EXTERNAL_HYBRID").length,
        DISTILLATION: all.filter((p) => p.kind === "DISTILLATION").length,
      },
      healthy: all.filter((p) => p.health === "HEALTHY").length,
      degraded: all.filter((p) => p.health === "DEGRADED").length,
      unavailable: all.filter((p) => p.health === "UNAVAILABLE").length,
    };
  }
}

export const pluginRegistry = new PluginRegistry();
