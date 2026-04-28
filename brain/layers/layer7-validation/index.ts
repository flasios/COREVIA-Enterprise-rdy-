import { randomUUID } from "crypto";
import { nanoid } from "nanoid";
import {
  DecisionObject,
  LayerResult,
  ValidationData,
  ApprovalStatus,
  AuditEvent
} from "@shared/schemas/corevia/decision-object";
import { coreviaStorage } from "../../storage";
import { logger } from "../../../platform/observability";

/** Minimal policy rule shape for L7_VALIDATION packs */
interface L7PolicyRule {
  ruleId: string;
  name: string;
  condition: {
    field: string;
    operator: string;
    value: unknown;
  };
  action: string;
  reason?: string;
}

/**
 * Layer 7: Validation & HITL (AUTHORITY GATE)
 *
 * Responsibilities:
 * - Enforce approval requirements
 * - Handle APPROVE/REVISE/REJECT flows
 * - Run threshold checks
 * - Detect bias
 * - Generate ApprovalID ONLY here
 *
 * INVARIANT: ApprovalID is generated ONLY in this layer
 */
export class Layer7Validation {
  /**
   * Execute Layer 7 processing
   */
  async execute(decision: DecisionObject): Promise<LayerResult> {
    const startTime = Date.now();

    try {
      const classification = decision.classification;
      const policy = decision.policy;
      const advisory = decision.advisory;

      if (!advisory) {
        throw new Error("Missing advisory package");
      }

      // When Layer 3 already required approval, Layer 6 emits a single-option
      // "governance-approval-required" stub advisory. In that case the agents/engines
      // never executed, so applying option/risk/evidence threshold checks here just
      // double-counts the same gate and surfaces misleading reasons like
      // "minimum_options failed (1/2)" or "Only one option presented". Detect the
      // stub and short-circuit threshold + bias checks — the policy gate alone is
      // the real reason and is already captured in approvalReasons.
      const isGovernanceApprovalStub =
        Array.isArray(advisory.options) &&
        advisory.options.length === 1 &&
        advisory.options[0]?.id === "governance-approval-required";

      // Run threshold checks (hardcoded defaults) — skipped for governance stub.
      const hardcodedChecks = isGovernanceApprovalStub ? [] : this.runThresholdChecks(decision);

      // Run L7_VALIDATION policy pack checks (DB-driven from Policies & Governance tab)
      const packChecks = isGovernanceApprovalStub ? [] : await this.evaluateL7PolicyPacks(decision);

      // Merge: hardcoded checks first, then governance pack checks
      const thresholdChecks = [...hardcodedChecks, ...packChecks];

      // Run bias detection — skipped for governance stub (single-option is by design here).
      const biasDetection = isGovernanceApprovalStub
        ? { detected: false, issues: [], confidence: 100 }
        : this.runBiasDetection(decision);

      // Check for validation errors
      const validationErrors = this.validateAdvisory(advisory);

      // Inheritance: when this decision is a derivative of an already-approved parent
      // (e.g., BC generation under an approved demand spine), Layer 7 must NOT re-gate.
      // The route layer signals this via input.normalizedInput.parentDemandApproved.
      const rawInput = (decision.input?.rawInput || {}) as Record<string, unknown>;
      const normalizedInput = (decision.input?.normalizedInput || {}) as Record<string, unknown>;
      const parentApproved = rawInput.parentDemandApproved === true
        || normalizedInput.parentDemandApproved === true;

      // Determine if HITL is required (skip when parent already approved)
      const requiresHitl = !parentApproved && (
        classification?.constraints.requireHitl ||
        policy?.result === "require_approval" ||
        policy?.approvalRequired ||
        policy?.authorityMatrix?.some(a => a.conditions?.length) ||
        thresholdChecks.some(c => !c.passed) ||
        biasDetection.detected
      );

      if (parentApproved) {
        logger.info(`[Layer 7] Inherited approval from parent decision spine — skipping HITL re-gate`);
      }

      // Set initial status
      const status: ApprovalStatus = requiresHitl ? "pending" : "approved";

      // Generate approval ID (always, but approval status may be pending)
      const approvalId = this.generateApprovalId();

      const validationData: ValidationData = {
        approvalId,
        status,
        thresholdChecks,
        biasDetection,
        validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      };

      // Create audit event
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        layer: 7,
        eventType: "validation_completed",
        eventData: {
          approvalId,
          status,
          requiresHitl,
          policyApprovalRequired: policy?.result === "require_approval" || policy?.approvalRequired || false,
          policyApprovalReasons: policy?.approvalReasons || [],
          thresholdChecksPassed: thresholdChecks.filter(c => c.passed).length,
          thresholdChecksFailed: thresholdChecks.filter(c => !c.passed).length,
          biasDetected: biasDetection.detected,
        },
        actorType: "system",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      logger.info(`[Layer 7] Validation: ApprovalID=${approvalId}, Status=${status}, HITL=${requiresHitl}`);

      return {
        success: true,
        layer: 7,
        status: status === "approved" ? "action_execution" : "validation",
        data: validationData,
        shouldContinue: true, // Always continue to Layer 8
        auditEvent,
      };
    } catch (error) {
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        layer: 7,
        eventType: "validation_failed",
        eventData: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        actorType: "system",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      return {
        success: false,
        layer: 7,
        status: "blocked",
        error: error instanceof Error ? error.message : "Validation failed",
        shouldContinue: false,
        auditEvent,
      };
    }
  }

  /**
   * Process approval action from human
   */
  async processApproval(
    decision: DecisionObject,
    action: "approve" | "revise" | "reject",
    userId: string,
    reason?: string,
    approvedActions?: string[]
  ): Promise<ValidationData> {
    const currentValidation = decision.validation;

    if (!currentValidation?.approvalId) {
      throw new Error("No approval pending");
    }

    switch (action) {
      case "approve": {
        const resolvedActions = approvedActions ||
          decision.advisory?.proposedActions.map(a => a.id) || [];

        return {
          ...currentValidation,
          status: "approved",
          approvedBy: userId,
          approvalReason: reason,
          approvedActions: resolvedActions,
        } as ValidationData;
      }

      case "revise":
        return {
          ...currentValidation,
          status: "revised",
          revisionNotes: reason,
        };

      case "reject":
        return {
          ...currentValidation,
          status: "rejected",
          rejectionReason: reason,
        };

      default:
        throw new Error(`Unknown approval action: ${action}`);
    }
  }

  async executePostApprovalAgents(
    approvalId: string
  ): Promise<Record<string, unknown>> {
    logger.info("[Layer 7] Agent execution is disabled in Layer 7; deferred to Layer 8 Controlled Execution.");
    return {
      status: "skipped",
      reason: "Layer 7 is approval-only. Post-approval agents run in Layer 8.",
      approvalId,
    };
  }

  /**
   * Resolve a dot-path into the decision object.
   */
  private resolveFieldPath(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let current = obj;
    for (const part of parts) {
      if (current == null) return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  /**
   * Evaluate a condition operator for L7 policy rules.
   */
  private evaluateL7Condition(fieldValue: unknown, operator: string, targetValue: unknown): boolean {
    const numericField = typeof fieldValue === "number" ? fieldValue : Number(fieldValue) || 0;
    const numericTarget = typeof targetValue === "number" ? targetValue : Number(targetValue) || 0;
    switch (operator) {
      case "eq": return String(fieldValue) === String(targetValue);
      case "neq": return String(fieldValue) !== String(targetValue);
      case "gt": return numericField > numericTarget;
      case "gte": return numericField >= numericTarget;
      case "lt": return numericField < numericTarget;
      case "lte": return numericField <= numericTarget;
      case "in": return Array.isArray(targetValue) && (targetValue as unknown[]).map(String).includes(String(fieldValue));
      case "nin": return Array.isArray(targetValue) && !(targetValue as unknown[]).map(String).includes(String(fieldValue));
      case "exists": return targetValue === false
        ? (fieldValue == null || (Array.isArray(fieldValue) && (fieldValue as unknown[]).length === 0))
        : fieldValue != null;
      default: return false;
    }
  }

  /**
   * Evaluate active L7_VALIDATION policy packs from the Policies & Governance tab.
   * Rules whose conditions match are treated as failed threshold checks that require HITL.
   */
  private async evaluateL7PolicyPacks(
    decision: DecisionObject
  ): Promise<NonNullable<ValidationData["thresholdChecks"]>> {
    const additionalChecks: NonNullable<ValidationData["thresholdChecks"]> = [];
    try {
      const activePacks = await coreviaStorage.getActivePolicyPacks();
      const l7Packs = activePacks.filter(
        (p: unknown) => (p as Record<string, unknown>).layer === "L7_VALIDATION"
      );
      for (const pack of l7Packs) {
        const packRecord = pack as Record<string, unknown>;
        const rules = Array.isArray(packRecord.rules) ? packRecord.rules as L7PolicyRule[] : [];
        for (const rule of rules) {
          const fieldValue = this.resolveFieldPath(decision, rule.condition.field);
          const triggered = this.evaluateL7Condition(fieldValue, rule.condition.operator, rule.condition.value);
          additionalChecks.push({
            check: rule.ruleId,
            passed: !triggered,
            value: typeof fieldValue === "number" ? fieldValue : 0,
            threshold: typeof rule.condition.value === "number" ? rule.condition.value : 0,
          });
          if (triggered) {
            logger.info(`[Layer 7] Policy pack rule ${rule.ruleId} triggered: ${rule.reason ?? rule.name}`);
          }
        }
      }
      if (l7Packs.length > 0) {
        logger.info(`[Layer 7] Evaluated ${l7Packs.length} L7_VALIDATION pack(s)`);
      }
    } catch (err) {
      logger.error("[Layer 7] Failed to load L7_VALIDATION packs, continuing with hardcoded checks only:", err);
    }
    return additionalChecks;
  }

  /**
   * Generate unique approval ID
   */
  private generateApprovalId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = nanoid(8).toUpperCase();
    return `APR-${timestamp}-${random}`;
  }

  /**
   * Run threshold checks
   */
  private runThresholdChecks(
    decision: DecisionObject
  ): NonNullable<ValidationData["thresholdChecks"]> {
    const checks: NonNullable<ValidationData["thresholdChecks"]> = [];
    const input = decision.input?.normalizedInput || decision.input?.rawInput;
    const advisory = decision.advisory;

    // Check 1: Confidence threshold
    const confidenceThreshold = 60;
    const overallConfidence = advisory?.overallConfidence || 0;
    checks.push({
      check: "confidence_threshold",
      passed: overallConfidence >= confidenceThreshold,
      value: overallConfidence,
      threshold: confidenceThreshold,
    });

    // Check 2: Minimum options generated
    const minOptions = 2;
    const optionsCount = advisory?.options.length || 0;
    checks.push({
      check: "minimum_options",
      passed: optionsCount >= minOptions,
      value: optionsCount,
      threshold: minOptions,
    });

    // Check 3: Risk assessment completed
    const risksIdentified = advisory?.risks.length || 0;
    checks.push({
      check: "risk_assessment",
      passed: risksIdentified > 0,
      value: risksIdentified,
      threshold: 1,
    });

    // Check 4: Evidence provided
    const evidenceCount = advisory?.evidence.length || 0;
    checks.push({
      check: "evidence_provided",
      passed: evidenceCount > 0,
      value: evidenceCount,
      threshold: 1,
    });

    // Check 5: Budget within authority
    const budget = (input as Record<string, unknown> | undefined)?.estimatedBudget || (input as Record<string, unknown> | undefined)?.budget || 0;
    const budgetValue = this.parseBudgetValue(budget);
    const budgetThreshold = 10000000; // 10M auto-approval threshold
    checks.push({
      check: "budget_authority",
      passed: budgetValue <= budgetThreshold,
      value: budgetValue,
      threshold: budgetThreshold,
    });

    return checks;
  }

  /**
   * Parse budget from number-like strings, including ranges (e.g. "800,000 - 1,500,000 AED").
   * For ranges, use the upper bound for authority checks.
   */
  private parseBudgetValue(rawBudget: unknown): number {
    if (typeof rawBudget === "number" && Number.isFinite(rawBudget)) {
      return rawBudget;
    }

    if (typeof rawBudget === "string") {
      const matches = rawBudget.match(/\d[\d,]*(?:\.\d+)?/g);
      if (matches && matches.length > 0) {
        const values = matches
          .map((m) => Number.parseFloat(m.replace(/,/g, "")))
          .filter((v) => Number.isFinite(v));
        if (values.length > 0) {
          return Math.max(...values);
        }
      }
    }

    const numeric = Number(rawBudget);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  /**
   * Run bias detection
   */
  private runBiasDetection(
    decision: DecisionObject
  ): NonNullable<ValidationData["biasDetection"]> {
    const issues: string[] = [];
    const advisory = decision.advisory;

    // Check for single-option bias
    if (advisory?.options.length === 1) {
      issues.push("Only one option presented - consider alternatives");
    }

    // Check for extreme recommendation scores
    const scores = advisory?.options.map(o => o.recommendationScore || 0) || [];
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    if (maxScore - minScore > 50) {
      issues.push("Large gap between option scores - verify objectivity");
    }

    // Check for missing risk consideration
    const hasHighImpactRisk = advisory?.risks.some(
      r => r.impact === "high" || r.impact === "critical"
    );
    const topOption = advisory?.options[0];
    if (hasHighImpactRisk && (topOption?.recommendationScore || 0) > 80) {
      issues.push("High recommendation despite critical risks - verify assessment");
    }

    return {
      detected: issues.length > 0,
      issues: issues.length > 0 ? issues : undefined,
    };
  }

  /**
   * Validate advisory package
   */
  private validateAdvisory(advisory: DecisionObject["advisory"]): string[] {
    const errors: string[] = [];

    if (!advisory) {
      errors.push("Advisory package is missing");
      return errors;
    }

    if (!advisory.options || advisory.options.length === 0) {
      errors.push("No options provided in advisory");
    }

    if (!advisory.proposedActions || advisory.proposedActions.length === 0) {
      errors.push("No proposed actions in advisory");
    }

    return errors;
  }
}
