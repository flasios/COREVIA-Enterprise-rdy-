import { randomUUID } from "crypto";
import { 
  EngineRouter, 
  RoutingDecision, 
  DataClassification, 
  EngineKind, 
  UseCaseType, 
  engineRouter 
} from "./engine-router";
import { 
  PluginRegistry, 
  PluginDescriptor, 
  pluginRegistry 
} from "./plugin-registry";
import { localInferenceAdapter } from "./internal/localInferenceAdapter";
import { logger } from "@platform/observability";

// ============================================================================
// TYPES
// ============================================================================

export interface IntelligencePlan {
  /** Unique plan ID */
  iplanId: string;
  /** Linked request ID */
  requestId: string;
  /** Intelligence mode: READ (advisory) or PLAN (generative) */
  mode: "READ" | "PLAN";
  /** Routing decision from EngineRouter */
  routing: RoutingDecision;
  /** Actual engine role selected after plugin availability/fallback resolution */
  effectiveEngineKind: EngineKind;
  /** Selected primary plugin */
  primaryPlugin: PluginDescriptor | null;
  /** Fallback plugins within the same role */
  fallbackPlugins: PluginDescriptor[];
  /** Whether Engine C distillation should run after approval */
  distillationEligible: boolean;
  /** Distillation plugin (if any) */
  distillationPlugin: PluginDescriptor | null;
  /** Redaction mode */
  redactionMode: "NONE" | "MASK" | "MINIMIZE" | "FULL";
  /** HITL requirements */
  hitlRequired: boolean;
  /** Token/cost budgets */
  budgets: {
    maxTokens: number;
    maxCostUsd: number;
    maxLatencyMs: number;
  };
  /** Tools allowed for this plan */
  toolsAllowed: string[];
  /** Created timestamp */
  createdAt: string;
}

export interface IPlanBuildContext {
  /** The decision ID */
  decisionId: string;
  /** The request ID (canonical AI request) */
  requestId: string;
  /** Data classification from Layer 2 */
  classification: DataClassification;
  /** Use case type (derived from service/route) */
  useCaseType: UseCaseType;
  /** Decision spine ID (if linked) */
  decisionSpineId?: string;
  /** Service ID */
  serviceId?: string;
  /** Route key */
  routeKey?: string;
}

// ============================================================================
// USE CASE TYPE RESOLUTION
// ============================================================================

/**
 * Resolve a control-plane use case type from service ID and route key.
 *
 * This should capture routing intent, not just generic domain grouping. For
 * example, demand field generation is promoted to the explicit DEMAND_FIELDS
 * use case so the router can apply a first-class policy override.
 */
export function resolveUseCaseType(serviceId?: string, routeKey?: string): UseCaseType {
  const combined = `${serviceId || ""} ${routeKey || ""}`.toLowerCase();

  if (combined.includes("demand.generate_fields")) return "DEMAND_FIELDS";
  if (combined.includes("business") || combined.includes("bc")) return "BUSINESS_CASE";
  if (combined.includes("requirement") || combined.includes("requirements")) return "REQUIREMENTS";
  if (combined.includes("wbs") || combined.includes("work breakdown") || combined.includes("plan")) return "WBS";
  if (combined.includes("strategic") || combined.includes("fit")) return "STRATEGIC_FIT";
  if (combined.includes("market") || combined.includes("research")) return "MARKET_RESEARCH";
  if (combined.includes("risk")) return "RISK_ANALYSIS";
  return "GENERAL";
}

// ============================================================================
// IPLAN BUILDER
// ============================================================================

/**
 * IntelligencePlanBuilder (IPLAN Builder)
 * 
 * Builds the complete Intelligence Plan for a decision:
 * 1. Uses EngineRouter to determine which engine ROLE handles the request
 * 2. Uses PluginRegistry to select specific model PLUGINS within that role
 * 3. Determines redaction mode, HITL requirements, and budgets
 * 4. Returns the plan to Layer 5 for persistence as part of the orchestration contract
 * 
 * The IPLAN is the contract between the Control Plane and the Reasoning layer.
 */
export class IntelligencePlanBuilder {
  constructor(
    private router: EngineRouter = engineRouter,
    private registry: PluginRegistry = pluginRegistry,
  ) {}

  /**
   * Build a full Intelligence Plan.
   */
  async build(ctx: IPlanBuildContext): Promise<IntelligencePlan> {
    const iplanId = `IPLAN-${randomUUID().substring(0, 12)}`;

    // 1. Route to the engine role using classification plus explicit use-case intent
    const routing = await this.router.route({
      classification: ctx.classification,
      useCaseType: ctx.useCaseType,
      decisionId: ctx.decisionId,
      decisionSpineId: ctx.decisionSpineId,
      serviceId: ctx.serviceId,
      routeKey: ctx.routeKey,
    });

    logger.info(`[IPLAN] Routing: ${routing.reason}`);

    // 2. Select primary plugin for the routed engine role
    const capability = this.registry.resolveCapability(ctx.useCaseType);
    const primarySelection = await this.registry.select({
      kind: routing.primaryEngineKind,
      requiredCapability: capability,
      maxClassification: ctx.classification,
    });

    // If Engine A is selected for PLAN-mode generation, require a reachable local inference endpoint.
    // Otherwise we treat it as unavailable so we can fall back to Engine B (where policy allows).
    const mode = this.resolveMode(ctx.useCaseType);
    let primaryEffective = primarySelection;
    if (routing.primaryEngineKind === "SOVEREIGN_INTERNAL" && mode === "PLAN" && primarySelection.plugin) {
      const cfg = (primarySelection.plugin.config || {}) as Record<string, unknown>;
      const endpoint = typeof cfg.endpoint === "string" && cfg.endpoint.trim().length > 0 ? String(cfg.endpoint) : "";
      if (!endpoint) {
        logger.warn("[IPLAN] Engine A plugin has no endpoint; treating as unavailable for PLAN-mode");
        primaryEffective = { ...primarySelection, plugin: null };
      } else {
        const health = await localInferenceAdapter.healthCheck(endpoint, 120000);
        if (!health.ok) {
          logger.warn(`[IPLAN] Engine A endpoint unhealthy (${health.status}); treating as unavailable for PLAN-mode`);
          primaryEffective = { ...primarySelection, plugin: null };
        }
      }
    }

    // 3. If primary has no plugins (or isn't runnable) and there's a fallback role, try that
    let effectiveSelection = primaryEffective;
    let effectiveEngineKind = routing.primaryEngineKind;
    if (!effectiveSelection.plugin && routing.fallbackEngineKind) {
      logger.info(`[IPLAN] No plugins for ${routing.primaryEngineKind}, trying fallback ${routing.fallbackEngineKind}`);
      effectiveSelection = await this.registry.select({
        kind: routing.fallbackEngineKind,
        requiredCapability: capability,
        maxClassification: ctx.classification,
      });
      if (effectiveSelection.plugin) {
        effectiveEngineKind = routing.fallbackEngineKind;
      }
    }

    if (effectiveSelection.plugin?.kind) {
      effectiveEngineKind = effectiveSelection.plugin.kind;
    }

    // 4. Select distillation plugin (Engine C)
    let distillationPlugin: PluginDescriptor | null = null;
    if (routing.distillationEligible) {
      const distillSelection = await this.registry.select({
        kind: "DISTILLATION",
        requiredCapability: "DISTILLATION",
      });
      distillationPlugin = distillSelection.plugin;
    }

    // 5. Determine redaction mode
    const redactionMode = this.resolveRedactionMode(routing, ctx.classification, effectiveEngineKind);

    // 6. Determine mode (READ vs PLAN)

    // 7. Set budgets
    const budgets = this.resolveBudgets(ctx.useCaseType, effectiveEngineKind);

    // 8. Determine allowed tools
    const toolsAllowed = this.resolveTools(routing, ctx.useCaseType, effectiveEngineKind);

    const plan: IntelligencePlan = {
      iplanId,
      requestId: ctx.requestId,
      mode,
      routing,
      effectiveEngineKind,
      primaryPlugin: effectiveSelection.plugin,
      fallbackPlugins: effectiveSelection.fallbackChain,
      distillationEligible: routing.distillationEligible,
      distillationPlugin,
      redactionMode,
      hitlRequired: routing.requiresHITL,
      budgets,
      toolsAllowed,
      createdAt: new Date().toISOString(),
    };

    logger.info(
      `[IPLAN] Built: ${iplanId} | Engine: ${effectiveEngineKind} | Plugin: ${effectiveSelection.plugin?.name || "NONE"} | Redaction: ${redactionMode} | HITL: ${routing.requiresHITL}`
    );

    return plan;
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private resolveRedactionMode(
    routing: RoutingDecision,
    classification: DataClassification,
    effectiveEngineKind: EngineKind,
  ): "NONE" | "MASK" | "MINIMIZE" | "FULL" {
    if (effectiveEngineKind !== "EXTERNAL_HYBRID") {
      return "NONE";
    }

    if (!routing.requiresRedaction) return "NONE";

    switch (classification) {
      case "SOVEREIGN":
      case "HIGH_SENSITIVE":
        return "FULL"; // should never reach external, but safety net
      case "CONFIDENTIAL":
        return "MINIMIZE"; // mask + minimize
      case "INTERNAL":
        return "MASK"; // mask PII only
      case "PUBLIC":
        return "NONE";
      default:
        return "MASK";
    }
  }

  private resolveMode(useCaseType: UseCaseType): "READ" | "PLAN" {
    const planUseCases: UseCaseType[] = ["BUSINESS_CASE", "REQUIREMENTS", "WBS", "STRATEGIC_FIT"];
    return planUseCases.includes(useCaseType) ? "PLAN" : "READ";
  }

  private resolveBudgets(
    useCaseType: UseCaseType,
    engineKind: EngineKind,
  ): IntelligencePlan["budgets"] {
    const isExternal = engineKind === "EXTERNAL_HYBRID";

    // Higher budgets for generation tasks
    const tokenTable: Record<UseCaseType, number> = {
      BUSINESS_CASE: 8000,
      DEMAND_FIELDS: 5000,
      REQUIREMENTS: 6000,
      WBS: 6000,
      STRATEGIC_FIT: 5000,
      MARKET_RESEARCH: 4000,
      RISK_ANALYSIS: 4000,
      GENERAL: 4000,
    };

    return {
      maxTokens: tokenTable[useCaseType] || 4000,
      maxCostUsd: isExternal ? 0.50 : 0.01, // external costs more
      maxLatencyMs: isExternal ? 120_000 : 300_000, // local can be slower
    };
  }

  private resolveTools(routing: RoutingDecision, useCaseType: UseCaseType, effectiveEngineKind: EngineKind): string[] {
    const tools: string[] = ["rag_search", "entity_extraction", "scoring"];

    if (effectiveEngineKind === "EXTERNAL_HYBRID") {
      tools.push("structured_analysis", "option_generation", "risk_analysis");
    }

    if (useCaseType === "BUSINESS_CASE") {
      tools.push("financial_analysis", "roi_calculation");
    }
    if (useCaseType === "REQUIREMENTS") {
      tools.push("requirement_extraction", "traceability");
    }
    if (useCaseType === "WBS") {
      tools.push("task_decomposition", "dependency_analysis");
    }

    return tools;
  }

}

export const iplanBuilder = new IntelligencePlanBuilder();
