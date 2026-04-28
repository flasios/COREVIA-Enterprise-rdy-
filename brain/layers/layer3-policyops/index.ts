import { randomUUID } from "crypto";
import { 
  DecisionObject, 
  LayerResult, 
  PolicyData,
  PolicyResult,
  AuditEvent 
} from "@shared/schemas/corevia/decision-object";
import { getControlPlaneState } from "../../control-plane";
import { coreviaStorage } from "../../storage";
import { logger } from "../../../platform/observability";

/**
 * Policy Rule Definition
 * Structured rule that can be evaluated against a decision object
 */
interface PolicyRule {
  ruleId: string;
  name: string;
  condition: {
    field: string;           // dot-path into decision object, e.g. "classification.classificationLevel"
    operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "nin" | "contains" | "exists";
    value: unknown;
  };
  action: "block" | "allow" | "require_approval";
  reason?: string;
  priority?: number;
}

/**
 * Layer 3: PolicyOps - Policy & Governance
 * 
 * Responsibilities:
 * - Execute policy-as-code
 * - Enforce authority matrix
 * - Apply compliance gates
 * - BLOCK stops entire flow
 * - ALLOW propagates constraints
 * 
 * INVARIANT: No intelligence runs before this layer allows it
 */
export class Layer3PolicyOps {
  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  }

  private isLayer3Pack(pack: unknown): boolean {
    const layer = String(this.asRecord(pack).layer || "L3_FRICTION").toUpperCase();
    return layer.startsWith("L3");
  }

  /**
   * Execute Layer 3 processing
   */
  async execute(decision: DecisionObject): Promise<LayerResult> {
    const startTime = Date.now();
    
    try {
      const input = decision.input;
      const classification = decision.classification;
      
      if (!input || !classification) {
        throw new Error("Missing intake or classification data");
      }

      // Evaluate all applicable policies
      const policiesEvaluated = await this.evaluatePolicies(decision);
      
      // Check if any policy blocks or requires approval
      const blockingPolicy = policiesEvaluated.find(p => p.result === "block");
      const approvalPolicies = policiesEvaluated.filter(p => p.result === "require_approval");

      const controlPlane = getControlPlaneState();
      const policyMode = controlPlane.policyMode;
      
      // Determine overall result
      const result: PolicyResult = blockingPolicy && policyMode === "enforce"
        ? "block"
        : approvalPolicies.length > 0
          ? "require_approval"
          : "allow";
      
      // Build authority matrix for approval
      const authorityMatrix = this.buildAuthorityMatrix(decision);
      
      // Determine compliance gates
      const complianceGates = this.determineComplianceGates(decision);
      
      // Propagate constraints
      const propagatedConstraints = this.propagateConstraints(decision, policiesEvaluated);
      
      const policyData: PolicyData = {
        result,
        policiesEvaluated,
        blockingPolicy: blockingPolicy?.policyId,
        blockReason: blockingPolicy?.reason,
        approvalRequired: approvalPolicies.length > 0,
        approvalReasons: approvalPolicies.map(p => p.reason || `${p.policyName} requires approval`),
        propagatedConstraints,
        authorityMatrix,
        complianceGates,
      };

      // Create audit event
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        layer: 3,
        eventType: result === "block"
          ? "policy_blocked"
          : blockingPolicy && policyMode === "monitor"
            ? "policy_monitor"
            : result === "require_approval"
              ? "policy_requires_approval"
            : "policy_allowed",
        eventData: {
          result,
          policiesEvaluated: policiesEvaluated.length,
          policiesDetail: policiesEvaluated.map(p => ({
            policyId: p.policyId,
            policyName: p.policyName,
            result: p.result,
            reason: p.reason,
          })),
          blockingPolicy: blockingPolicy?.policyId,
          approvalRequired: approvalPolicies.length > 0,
          approvalReasons: approvalPolicies.map(p => p.reason || `${p.policyName} requires approval`),
          policyMode,
        },
        actorType: "system",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      if (result === "block") {
        logger.info(`[Layer 3] BLOCKED by policy: ${blockingPolicy?.policyName}`);
      } else if (blockingPolicy && policyMode === "monitor") {
        logger.info(`[Layer 3] MONITOR - policy matched: ${blockingPolicy?.policyName}`);
      } else if (result === "require_approval") {
        logger.info(`[Layer 3] APPROVAL REQUIRED - ${approvalPolicies.length} policies require approval`);
      } else {
        logger.info(`[Layer 3] ALLOWED - ${policiesEvaluated.length} policies evaluated`);
      }

      return {
        success: result !== "block",
        layer: 3,
        status: result === "block" ? "blocked" : "context_check",
        data: policyData,
        error: result === "block" ? policyData.blockReason : undefined,
        shouldContinue: result !== "block",
        auditEvent,
      };
    } catch (error) {
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        layer: 3,
        eventType: "policy_evaluation_failed",
        eventData: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        actorType: "system",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      return {
        success: false,
        layer: 3,
        status: "blocked",
        error: error instanceof Error ? error.message : "Policy evaluation failed",
        shouldContinue: false,
        auditEvent,
      };
    }
  }

  /**
   * Evaluate all applicable policies from the registry packs configured in Brain.
   */
  private async evaluatePolicies(decision: DecisionObject): Promise<PolicyData["policiesEvaluated"]> {
    const policies: PolicyData["policiesEvaluated"] = [];

    // === Registry policy packs (loaded from DB via Policies & Governance tab) ===
    // All governance rules (risk, budget, sector, classification) are configured there.
    //
    // Business-case generation is an execution-phase artifact triggered AFTER the demand
    // has already cleared governance (acknowledged/approved). Re-running require_approval
    // gates at this stage would double-gate an already-approved demand and block agents.
    // Registry packs can still fire BLOCK actions; require_approval is intentionally
    // skipped for the business_case service so agents can execute.
    const isBusinessCaseGeneration = decision.input?.serviceId === "business_case";

    // Portfolio actions (e.g. WBS generation) that already have an APPROVED
    // governance approval row in the PMO inbox set `governanceApproved=true`
    // on the brain input. Treat these as bypass-eligible the same way as BC
    // generation: BLOCK rules still fire, but require_approval is downgraded
    // so the AI generation can actually run after the human approval.
    const inputRecord = (decision.input || {}) as Record<string, unknown>;
    const rawInput = (inputRecord.rawInput || {}) as Record<string, unknown>;
    const normalizedInput = (inputRecord.normalizedInput || {}) as Record<string, unknown>;
    const parentDemandApproved = rawInput.parentDemandApproved === true
      || normalizedInput.parentDemandApproved === true
      || inputRecord.parentDemandApproved === true;
    const governanceApproved = rawInput.governanceApproved === true
      || normalizedInput.governanceApproved === true
      || inputRecord.governanceApproved === true;
    const isPortfolioApprovedAction = governanceApproved
      && (decision.input?.serviceId === "wbs_generation"
        || decision.input?.serviceId === "portfolio_action");
    const bypassRequireApproval = parentDemandApproved || isBusinessCaseGeneration || isPortfolioApprovedAction;

    try {
      const activePacks = (await coreviaStorage.getActivePolicyPacks()).filter((pack) => this.isLayer3Pack(pack));
      
      for (const pack of activePacks) {
        const packRecord = this.asRecord(pack);
        const rulesValue = packRecord.rules;
        const rules = Array.isArray(rulesValue) ? rulesValue as PolicyRule[] : [];
        if (rules.length === 0) continue;
        
        let packResult = this.evaluateRegistryPack(decision, pack, rules);

        // For already-approved demands entering the execution phase,
        // downgrade require_approval to allow so agents can run without a second governance gate.
        if (bypassRequireApproval && packResult.result === "require_approval") {
          packResult = {
            ...packResult,
            result: "allow" as PolicyResult,
            reason: packResult.reason
              ? `[bypassed: governance already approved] ${packResult.reason}`
              : "Bypassed: governance already approved for this action",
          };
        }

        policies.push(packResult);
      }
      
      if (activePacks.length > 0) {
        logger.info(`[Layer 3] Evaluated ${activePacks.length} registry pack(s) with active rules`);
      }
    } catch (err) {
      logger.error("[Layer 3] Failed to load registry packs, continuing with built-in policies only:", err);
    }
    
    return policies;
  }

  /**
   * Evaluate a registry policy pack's rules against the decision
   */
  private evaluateRegistryPack(
    decision: DecisionObject,
    pack: unknown,
    rules: PolicyRule[]
  ): PolicyData["policiesEvaluated"][0] {
    const packRecord = this.asRecord(pack);
    let overallResult: PolicyResult = "allow";
    const reasons: string[] = [];

    for (const rule of rules) {
      const fieldValue = this.resolveFieldPath(decision, rule.condition.field);
      const matches = this.evaluateCondition(fieldValue, rule.condition.operator, rule.condition.value);

      if (matches) {
        if (rule.action === "block") {
          overallResult = "block";
          reasons.push(rule.reason || `Rule ${rule.ruleId}: ${rule.name} triggered BLOCK`);
        } else if (rule.action === "require_approval" && overallResult !== "block") {
          overallResult = "require_approval";
          reasons.push(rule.reason || `Rule ${rule.ruleId}: ${rule.name} requires approval`);
        }
      }
    }

    return {
      policyId: `PACK-${String(packRecord.packId || "unknown")}`,
      policyName: `${String(packRecord.name || "Unnamed Pack")} v${String(packRecord.version || "0")}`,
      result: overallResult,
      reason: reasons.length > 0 ? reasons.join("; ") : undefined,
    };
  }

  /**
   * Resolve a dot-path field from the decision object
   * e.g. "classification.classificationLevel" => decision.classification.classificationLevel
   */
  private resolveFieldPath(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let current = obj;
    for (const part of parts) {
      if (current == null) return undefined;
      current = this.asRecord(current)[part];
    }
    return current;
  }

  /**
   * Evaluate a condition operator against a field value
   */
  private evaluateCondition(fieldValue: unknown, operator: string, targetValue: unknown): boolean {
    const numericTarget = typeof targetValue === "number"
      ? targetValue
      : typeof targetValue === "string"
        ? Number.parseFloat(targetValue)
        : Number.NaN;

    switch (operator) {
      case "eq":
        return fieldValue === targetValue;
      case "neq":
        return fieldValue !== targetValue;
      case "gt":
        return typeof fieldValue === "number" && Number.isFinite(numericTarget) && fieldValue > numericTarget;
      case "gte":
        return typeof fieldValue === "number" && Number.isFinite(numericTarget) && fieldValue >= numericTarget;
      case "lt":
        return typeof fieldValue === "number" && Number.isFinite(numericTarget) && fieldValue < numericTarget;
      case "lte":
        return typeof fieldValue === "number" && Number.isFinite(numericTarget) && fieldValue <= numericTarget;
      case "in":
        return Array.isArray(targetValue) && targetValue.includes(fieldValue);
      case "nin":
        return Array.isArray(targetValue) && !targetValue.includes(fieldValue);
      case "contains":
        return typeof fieldValue === "string" && fieldValue.toLowerCase().includes(String(targetValue).toLowerCase());
      case "exists":
        return targetValue ? fieldValue != null : fieldValue == null;
      default:
        return false;
    }
  }

  /**
   * Build authority matrix for approval
   */
  private buildAuthorityMatrix(decision: DecisionObject) {
    const classification = decision.classification;
    
    const matrix = [];
    
    // Director can always approve
    matrix.push({
      role: "director",
      canApprove: true,
    });
    
    // Manager can approve non-sovereign
    matrix.push({
      role: "manager",
      canApprove: classification?.classificationLevel !== "sovereign",
      conditions: classification?.classificationLevel === "sovereign" 
        ? ["Cannot approve sovereign data"] 
        : undefined,
    });
    
    // Specialist can approve public/internal only
    matrix.push({
      role: "specialist",
      canApprove: classification?.classificationLevel === "public" || 
                  classification?.classificationLevel === "internal",
    });
    
    return matrix;
  }

  /**
   * Determine compliance gates
   */
  private determineComplianceGates(decision: DecisionObject): string[] {
    const gates: string[] = [];
    const classification = decision.classification;
    
    if (classification?.classificationLevel === "sovereign") {
      gates.push("SOVEREIGN_DATA_REVIEW");
      gates.push("DATA_LOCALIZATION_CHECK");
    }
    
    if (classification?.classificationLevel === "confidential") {
      gates.push("DATA_PRIVACY_REVIEW");
    }
    
    if (classification?.sector === "finance") {
      gates.push("FINANCIAL_COMPLIANCE");
    }
    
    return gates;
  }

  /**
   * Propagate constraints from policies
   */
  private propagateConstraints(
    decision: DecisionObject,
    policies: PolicyData["policiesEvaluated"]
  ): Record<string, unknown> {
    const constraints: Record<string, unknown> = {};
    
    // Inherit classification constraints
    if (decision.classification?.constraints) {
      Object.assign(constraints, decision.classification.constraints);
    }
    
    // Add policy-specific constraints
    const highValuePolicy = policies.find(p => p.reason?.includes("High-value"));
    if (highValuePolicy) {
      constraints.requireExecutiveApproval = true;
    }
    
    const sovereignPolicy = policies.find(p => p.reason?.includes("Sovereign"));
    if (sovereignPolicy) {
      constraints.localProcessingOnly = true;
    }
    
    return constraints;
  }
}
