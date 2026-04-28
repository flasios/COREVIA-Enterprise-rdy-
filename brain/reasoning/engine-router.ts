import { logger } from "../../platform/observability";
import { coreviaStorage } from "../storage";

// ============================================================================
// TYPES
// ============================================================================

export type DataClassification =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "SOVEREIGN"
  | "HIGH_SENSITIVE";

export type EngineKind = "SOVEREIGN_INTERNAL" | "EXTERNAL_HYBRID" | "DISTILLATION";

export type UseCaseType =
  | "BUSINESS_CASE"
  | "DEMAND_FIELDS"
  | "REQUIREMENTS"
  | "WBS"
  | "STRATEGIC_FIT"
  | "MARKET_RESEARCH"
  | "RISK_ANALYSIS"
  | "GENERAL";

export interface RoutingDecision {
  /** Which engine role to use for reasoning */
  primaryEngineKind: EngineKind;
  /** Fallback engine kind if primary fails */
  fallbackEngineKind: EngineKind | null;
  /** Must redact before sending to this engine? */
  requiresRedaction: boolean;
  /** Must have human approval before using this engine? */
  requiresHITL: boolean;
  /** Why this routing decision was made */
  reason: string;
  /** Is Engine C distillation eligible after outcome? */
  distillationEligible: boolean;
  /** Constraints propagated from classification */
  constraints: {
    allowExternalModels: boolean;
    localProcessingOnly: boolean;
    requiresMasking: boolean;
    maxDataExposure: DataClassification;
  };
}

export interface RoutingContext {
  classification: DataClassification;
  useCaseType: UseCaseType;
  decisionId: string;
  decisionSpineId?: string;
  serviceId?: string;
  routeKey?: string;
  /** Override from admin/routing_overrides table */
  adminOverride?: {
    forcedEngineKind?: EngineKind;
    forcedEngineId?: string;
    reason?: string;
  };
}

// ============================================================================
// ROUTING TABLE (deterministic, classification × use-case)
// ============================================================================

/**
 * Classification → default engine routing rules.
 * This table defines the baseline control-plane posture before any explicit
 * use-case-specific override is applied.
 *
 * SOVEREIGN / HIGH_SENSITIVE → Engine A ONLY (never external)
 * CONFIDENTIAL              → Engine A ONLY (external LLMs blocked by classification)
 * INTERNAL                  → Engine A default; specific authoring use-cases may prefer Engine B
 * PUBLIC                    → Engine A default; specific authoring use-cases may prefer Engine B
 */
const CLASSIFICATION_ROUTING: Record<
  DataClassification,
  {
    primaryKind: EngineKind;
    fallbackKind: EngineKind | null;
    allowExternal: boolean;
    requiresRedaction: boolean;
    requiresHITL: boolean;
    localOnly: boolean;
  }
> = {
  SOVEREIGN: {
    primaryKind: "SOVEREIGN_INTERNAL",
    fallbackKind: null, // no external fallback allowed
    allowExternal: false,
    requiresRedaction: false,
    requiresHITL: false,
    localOnly: true,
  },
  HIGH_SENSITIVE: {
    primaryKind: "SOVEREIGN_INTERNAL",
    fallbackKind: null,
    allowExternal: false,
    requiresRedaction: false,
    requiresHITL: false,
    localOnly: true,
  },
  CONFIDENTIAL: {
    primaryKind: "SOVEREIGN_INTERNAL",
    fallbackKind: null,
    allowExternal: false,
    requiresRedaction: false,
    requiresHITL: true,               // MUST have human approval
    localOnly: true,
  },
  INTERNAL: {
    primaryKind: "SOVEREIGN_INTERNAL",  // Engine A primary — avoid unnecessary Claude spend
    fallbackKind: "EXTERNAL_HYBRID",    // Claude only as fallback when Engine A cannot handle
    allowExternal: true,
    requiresRedaction: true,           // always redact for external
    requiresHITL: false,
    localOnly: false,
  },
  PUBLIC: {
    primaryKind: "SOVEREIGN_INTERNAL",  // Engine A primary — avoid unnecessary Claude spend
    fallbackKind: "EXTERNAL_HYBRID",    // Claude only as fallback
    allowExternal: true,
    requiresRedaction: false,          // public data, no masking needed
    requiresHITL: false,
    localOnly: false,
  },
};

// ============================================================================
// ENGINE ROUTER
// ============================================================================

/**
 * EngineRouter — Deterministic classification-based routing.
 *
 * This is the CONTROL PLANE routing logic that determines:
 * 1. Which engine ROLE handles the request (A, B, or C)
 * 2. What redaction/masking requirements apply
 * 3. Whether HITL approval is needed before engine execution
 * 4. What fallback chain to use
 * 5. Whether distillation (Engine C) should run after outcome
 *
 * The router does NOT select specific plugins (Mistral vs DeepSeek, Claude vs GPT).
 * That's the job of the PluginRegistry.
 */
export class EngineRouter {
  /**
   * Route a request to the appropriate engine role based on classification.
   */
  async route(ctx: RoutingContext): Promise<RoutingDecision> {
    // 1. Check for admin overrides first (routing_overrides table)
    const override = ctx.adminOverride || await this.loadOverride(ctx);
    if (override?.forcedEngineKind) {
      // Hard safety invariant: classifications that disallow external models can never route to external.
      if ((ctx.classification === "SOVEREIGN" || ctx.classification === "HIGH_SENSITIVE" || ctx.classification === "CONFIDENTIAL") && override.forcedEngineKind === "EXTERNAL_HYBRID") {
        logger.warn(
          `[EngineRouter] Override to EXTERNAL_HYBRID ignored for ${ctx.classification} (classification boundary)`
        );
      } else {
      logger.info(
        `[EngineRouter] Override applied: ${override.forcedEngineKind} (reason: ${override.reason || "admin override"})`
      );
      const baseRules = CLASSIFICATION_ROUTING[ctx.classification];
      return {
        primaryEngineKind: override.forcedEngineKind,
        fallbackEngineKind: baseRules.fallbackKind,
        requiresRedaction: override.forcedEngineKind === "EXTERNAL_HYBRID" ? baseRules.requiresRedaction : false,
        requiresHITL: override.forcedEngineKind === "EXTERNAL_HYBRID" && baseRules.requiresHITL,
        reason: `Admin override: ${override.reason || "forced engine kind"}`,
        distillationEligible: true,
        constraints: {
          allowExternalModels: override.forcedEngineKind === "EXTERNAL_HYBRID",
          localProcessingOnly: override.forcedEngineKind === "SOVEREIGN_INTERNAL",
          requiresMasking: override.forcedEngineKind === "EXTERNAL_HYBRID" && baseRules.requiresRedaction,
          maxDataExposure: ctx.classification,
        },
      };
      }
    }

    // Explicit use-case override: light demand-field enrichment is allowed on
    // Engine B for INTERNAL/PUBLIC flows. BUSINESS_CASE is intentionally NOT
    // listed here — business cases carry strategic, financial, vendor, and
    // stakeholder data that must stay sovereign (Engine A only). Classification
    // routing alone keeps BUSINESS_CASE on SOVEREIGN_INTERNAL.
    if (ctx.useCaseType === "DEMAND_FIELDS" && (ctx.classification === "INTERNAL" || ctx.classification === "PUBLIC")) {
      const baseRules = CLASSIFICATION_ROUTING[ctx.classification];
      return {
        primaryEngineKind: "EXTERNAL_HYBRID",
        fallbackEngineKind: "SOVEREIGN_INTERNAL",
        requiresRedaction: ctx.classification === "INTERNAL",
        requiresHITL: baseRules.requiresHITL,
        reason: `Classification [${ctx.classification}] × UseCase [DEMAND_FIELDS] → Engine B (External/Hybrid) preferred`,
        distillationEligible: true,
        constraints: {
          allowExternalModels: true,
          localProcessingOnly: false,
          requiresMasking: ctx.classification === "INTERNAL",
          maxDataExposure: ctx.classification,
        },
      };
    }

    // 2. Apply deterministic classification routing
    const rules = CLASSIFICATION_ROUTING[ctx.classification];
    if (!rules) {
      // Safety fallback — treat unknown as SOVEREIGN
      logger.warn(`[EngineRouter] Unknown classification "${ctx.classification}", defaulting to SOVEREIGN_INTERNAL`);
      return this.buildDecision("SOVEREIGN_INTERNAL", null, false, false, ctx.classification, "Unknown classification — defaulting to sovereign");
    }

    const reason = this.buildReason(ctx.classification, ctx.useCaseType, rules.primaryKind);

    return this.buildDecision(
      rules.primaryKind,
      rules.fallbackKind,
      rules.requiresRedaction,
      rules.requiresHITL,
      ctx.classification,
      reason
    );
  }

  /**
   * Quick check: is Engine B (external) allowed for this classification?
   */
  isExternalAllowed(classification: DataClassification): boolean {
    const rules = CLASSIFICATION_ROUTING[classification];
    return rules?.allowExternal ?? false;
  }

  /**
   * Quick check: is this classification sovereign-level (Engine A only)?
   */
  isSovereignOnly(classification: DataClassification): boolean {
    return classification === "SOVEREIGN" || classification === "HIGH_SENSITIVE";
  }

  /**
   * Get the full routing table for display/audit.
   */
  getRoutingTable(): Record<DataClassification, { primary: EngineKind; fallback: EngineKind | null; redaction: boolean; hitl: boolean }> {
    const table: Record<string, { primary: EngineKind; fallback: EngineKind | null; redaction: boolean; hitl: boolean }> = {};
    for (const [classification, rules] of Object.entries(CLASSIFICATION_ROUTING)) {
      table[classification] = {
        primary: rules.primaryKind,
        fallback: rules.fallbackKind,
        redaction: rules.requiresRedaction,
        hitl: rules.requiresHITL,
      };
    }
    return table as Record<DataClassification, { primary: EngineKind; fallback: EngineKind | null; redaction: boolean; hitl: boolean }>;
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private buildDecision(
    primaryEngineKind: EngineKind,
    fallbackEngineKind: EngineKind | null,
    requiresRedaction: boolean,
    requiresHITL: boolean,
    classification: DataClassification,
    reason: string
  ): RoutingDecision {
    return {
      primaryEngineKind,
      fallbackEngineKind,
      requiresRedaction,
      requiresHITL,
      reason,
      distillationEligible: true,
      constraints: {
        allowExternalModels: primaryEngineKind === "EXTERNAL_HYBRID",
        localProcessingOnly: primaryEngineKind === "SOVEREIGN_INTERNAL" && !fallbackEngineKind,
        requiresMasking: requiresRedaction,
        maxDataExposure: classification,
      },
    };
  }

  private buildReason(classification: DataClassification, useCaseType: UseCaseType, engineKind: EngineKind): string {
    const engineLabel = engineKind === "SOVEREIGN_INTERNAL" ? "Engine A (Sovereign Internal)"
      : engineKind === "EXTERNAL_HYBRID" ? "Engine B (External/Hybrid)"
      : "Engine C (Distillation)";

    return `Classification [${classification}] × UseCase [${useCaseType}] → ${engineLabel}`;
  }

  private async loadOverride(ctx: RoutingContext): Promise<{ forcedEngineKind?: EngineKind; forcedEngineId?: string; reason?: string } | null> {
    try {
      // Check spine-level, then use-case-level, then global overrides
      const engine = await coreviaStorage.resolveEngineForDecision(ctx.decisionId, "SOVEREIGN_INTERNAL");
      if (engine && engine.kind !== "SOVEREIGN_INTERNAL") {
        return {
          forcedEngineKind: engine.kind as EngineKind,
          forcedEngineId: engine.enginePluginId,
          reason: "Routing override from DB",
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const engineRouter = new EngineRouter();
