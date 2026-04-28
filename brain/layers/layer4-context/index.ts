import { randomUUID } from "crypto";
import {
  DecisionObject,
  LayerResult,
  ContextData,
  ContextResult,
  AuditEvent
} from "@shared/schemas/corevia/decision-object";
import { logger } from "../../../platform/observability";

/**
 * Layer 4: Context & Quality
 *
 * Responsibilities:
 * - Compute completeness score
 * - Detect ambiguity
 * - Log assumptions
 * - Identify missing fields
 * - NEEDS_INFO stops flow
 * - READY continues
 *
 * INVARIANT: Quality check before intelligence runs
 */
export class Layer4Context {
  // Routes where the AI generates fields — only require a seed description
  private readonly generationRoutes = new Set([
    "demand.generate_fields",
    "demand.classify_request",
    "demand.comprehensive_analysis",
    "demand_report",
  ]);

  // Required fields per service/route with aliases for field name variations
  private readonly requiredFieldsMap: Record<string, Array<{ field: string; aliases: string[] }>> = {
    "demand_management.demand.new": [
      { field: "projectName", aliases: ["suggestedProjectName", "projectTitle", "title", "name", "organizationName"] },
      { field: "description", aliases: ["currentChallenges", "problemStatement", "overview", "businessObjective"] },
    ],
    // Demand AI drafting must stop at Layer 4 until the user confirms the core planning inputs.
    "demand.generate_fields": [
      { field: "department", aliases: ["department", "organizationUnit"] },
      { field: "currentChallenges", aliases: ["currentChallenges", "challenges", "painPoints"] },
      { field: "expectedOutcomes", aliases: ["expectedOutcomes", "expectedBenefits", "outcomes"] },
      { field: "successCriteria", aliases: ["successCriteria", "kpis", "successMetrics"] },
      { field: "budgetRange", aliases: ["budgetRange", "estimatedBudget", "budget", "estimatedCost", "requestedBudget"] },
      { field: "timeframe", aliases: ["timeframe", "timeline", "estimatedTimeline", "duration", "targetDate", "implementationTimeline", "expectedDuration"] },
    ],
    "demand_management.demand.classify_request": [
      { field: "description", aliases: ["currentChallenges", "problemStatement", "overview", "businessObjective"] },
    ],
    "demand_management.demand.comprehensive_analysis": [
      { field: "description", aliases: ["currentChallenges", "problemStatement", "overview", "businessObjective"] },
    ],
    "business_case.business_case.generate": [
      { field: "projectName", aliases: ["suggestedProjectName", "projectTitle", "title"] },
      { field: "description", aliases: ["overview", "summary", "businessObjective"] },
    ],
  };

  private readonly optionalFieldsWithAliases: Array<{ field: string; aliases: string[] }> = [
    { field: "timeline", aliases: ["estimatedTimeline", "duration", "targetDate", "implementationTimeline", "expectedDuration"] },
    { field: "stakeholders", aliases: ["keyStakeholders", "stakeholdersList", "department", "organizationUnit"] },
    { field: "risks", aliases: ["riskAssessment", "identifiedRisks", "riskFactors", "riskAnalysis"] },
    { field: "constraints", aliases: ["projectConstraints", "limitations", "complianceRequirements", "integrationRequirements"] },
    { field: "estimatedBudget", aliases: ["budget", "cost", "estimatedCost", "requestedBudget"] },
  ];

  private readonly sectionFieldsMap: Record<string, { vision: string[]; resources: string[]; technology: string[] }> = {
    "demand_management.demand.new": {
      vision: ["businessObjective", "currentChallenges", "expectedOutcomes", "successCriteria", "constraints"],
      resources: ["currentCapacity", "budgetRange", "timeframe", "stakeholders"],
      technology: ["existingSystems", "integrationRequirements", "complianceRequirements", "riskFactors"],
    },
  };

  private readonly sectionFieldAliases: Record<string, string[]> = {
    businessObjective: ["businessObjective", "problemStatement", "overview", "description"],
    currentChallenges: ["currentChallenges", "challenges", "painPoints"],
    expectedOutcomes: ["expectedOutcomes", "expectedBenefits", "outcomes"],
    successCriteria: ["successCriteria", "kpis", "successMetrics"],
    constraints: ["constraints", "projectConstraints", "limitations", "complianceRequirements", "integrationRequirements"],
    currentCapacity: ["currentCapacity", "capacity"],
    budgetRange: ["budgetRange", "estimatedBudget", "budget", "estimatedCost", "requestedBudget"],
    timeframe: ["timeframe", "timeline", "estimatedTimeline", "duration", "targetDate", "implementationTimeline", "expectedDuration"],
    stakeholders: ["stakeholders", "keyStakeholders", "stakeholdersList", "department", "organizationUnit"],
    existingSystems: ["existingSystems", "currentSystems", "legacySystems"],
    integrationRequirements: ["integrationRequirements", "integrationNeeds"],
    complianceRequirements: ["complianceRequirements", "regulatoryRequirements"],
    riskFactors: ["riskFactors", "riskAssessment", "identifiedRisks", "riskAnalysis"],
  };

  private resolveRequiredFieldConfigs(serviceRoute: string): Array<{ field: string; aliases: string[] }> {
    const directMatch = this.requiredFieldsMap[serviceRoute];
    if (directMatch) {
      return directMatch;
    }

    const firstDot = serviceRoute.indexOf(".");
    if (firstDot === -1 || firstDot === serviceRoute.length - 1) {
      return [];
    }

    const routeOnly = serviceRoute.slice(firstDot + 1);
    return this.requiredFieldsMap[routeOnly] || [];
  }

  /**
   * Execute Layer 4 processing
   */
  async execute(decision: DecisionObject): Promise<LayerResult> {
    const startTime = Date.now();

    try {
      const input = decision.input;

      if (!input) {
        throw new Error("Missing intake data");
      }

      const data = input.normalizedInput || input.rawInput || {};
      // If the original route was a generation route, use its specific (lenient) required-fields entry
      const originalRouteKey = (data as Record<string, unknown>).originalRouteKey as string | undefined;
      const isGenerationRoute = originalRouteKey ? this.generationRoutes.has(originalRouteKey) : false;
      const serviceRoute = isGenerationRoute
        ? `${input.serviceId}.${originalRouteKey}`
        : `${input.serviceId}.${input.routeKey}`;

      // Analyze completeness
      const completenessResult = this.analyzeCompleteness(data as Record<string, unknown>, serviceRoute);

      // Detect ambiguities
      const ambiguities = this.detectAmbiguities(data);

      // Log assumptions
      const assumptions = this.logAssumptions(data);

      // Calculate scores
      const completenessScore = completenessResult.score;
      const ambiguityScore = (ambiguities && ambiguities.length > 0) ? Math.min(100, ambiguities.length * 20) : 0;

      // Demand AI assist should continue through the Brain so the draft can be generated,
      // while still carrying missing required inputs forward for submit-time review.
      const allowProgressiveDrafting = originalRouteKey === "demand.generate_fields";
      const hasRequiredMissingFields = completenessResult.missingFields.some(f => f.required);
      const hasBlockingMissingFields = hasRequiredMissingFields && !allowProgressiveDrafting;
      const result: ContextResult = hasBlockingMissingFields ? "needs_info" : "ready";

      const contextData: ContextData = {
        result,
        completenessScore,
        ambiguityScore,
        missingFields: completenessResult.missingFields.map(f => f.field),
        assumptions,
        ambiguities,
        requiredInfo: hasRequiredMissingFields
          ? completenessResult.missingFields.filter(f => f.required)
          : undefined,
      };

      // Create audit event
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        layer: 4,
        eventType: result === "needs_info" ? "context_needs_info" : "context_ready",
        eventData: {
          result,
          completenessScore,
          ambiguityScore,
          missingFieldsCount: completenessResult.missingFields.length,
          assumptionsCount: assumptions.length,
        },
        actorType: "system",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      if (result === "needs_info") {
        logger.info(`[Layer 4] NEEDS_INFO - Missing: ${completenessResult.missingFields.map(f => f.field).join(", ")}`);
      } else {
        logger.info(`[Layer 4] READY - Completeness: ${completenessScore}%`);
      }

      return {
        success: true,
        layer: 4,
        status: result === "needs_info" ? "needs_info" : "orchestration",
        data: contextData,
        error: result === "needs_info" ? "Additional information required" : undefined,
        shouldContinue: result === "ready",
        auditEvent,
      };
    } catch (error) {
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        layer: 4,
        eventType: "context_analysis_failed",
        eventData: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        actorType: "system",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      return {
        success: false,
        layer: 4,
        status: "blocked",
        error: error instanceof Error ? error.message : "Context analysis failed",
        shouldContinue: false,
        auditEvent,
      };
    }
  }

  /**
   * Check if a field or any of its aliases has a value in the data
   */
  private hasFieldValue(data: Record<string, unknown>, field: string, aliases: string[]): boolean {
    // Check the primary field name
    const primaryValue = data[field];
    if (primaryValue !== undefined && primaryValue !== null && primaryValue !== "") {
      return true;
    }

    // Check all aliases
    for (const alias of aliases) {
      const aliasValue = data[alias];
      if (aliasValue !== undefined && aliasValue !== null && aliasValue !== "") {
        return true;
      }
    }

    return false;
  }

  /**
   * Analyze completeness of input data
   */
  private analyzeCompleteness(
    data: Record<string, unknown>,
    serviceRoute: string
  ): { score: number; missingFields: Array<{ field: string; description: string; required: boolean }> } {
    const requiredFieldConfigs = this.resolveRequiredFieldConfigs(serviceRoute);
    const missingFields: Array<{ field: string; description: string; required: boolean }> = [];

    let requiredFilled = 0;
    const totalRequired = requiredFieldConfigs.length || 1;
    const sectionConfig = this.sectionFieldsMap[serviceRoute];

    for (const fieldConfig of requiredFieldConfigs) {
      if (this.hasFieldValue(data, fieldConfig.field, fieldConfig.aliases)) {
        requiredFilled++;
      } else {
        missingFields.push({
          field: fieldConfig.field,
          description: `${fieldConfig.field} is required`,
          required: true,
        });
      }
    }

    const requiredScore = totalRequired > 0 ? (requiredFilled / totalRequired) : 1;

    if (sectionConfig) {
      const computeSection = (fields: string[]) => {
        let filled = 0;
        const missing: string[] = [];
        for (const field of fields) {
          const aliases = this.sectionFieldAliases[field] || [field];
          if (this.hasFieldValue(data, field, aliases)) {
            filled++;
          } else {
            missing.push(field);
          }
        }
        return { filled, total: fields.length || 1, missing };
      };

      const vision = computeSection(sectionConfig.vision);
      const resources = computeSection(sectionConfig.resources);
      const technology = computeSection(sectionConfig.technology);

      for (const field of [...vision.missing, ...resources.missing, ...technology.missing]) {
        missingFields.push({
          field,
          description: `${field} is recommended for better analysis`,
          required: false,
        });
      }

      const visionScore = vision.filled / vision.total;
      const resourcesScore = resources.filled / resources.total;
      const technologyScore = technology.filled / technology.total;

      const requiredWeight = 0.4;
      const visionWeight = 0.3;
      const resourcesWeight = 0.15;
      const technologyWeight = 0.15;
      const score = Math.round((
        requiredScore * requiredWeight +
        visionScore * visionWeight +
        resourcesScore * resourcesWeight +
        technologyScore * technologyWeight
      ) * 100);

      return { score, missingFields };
    }

    let optionalFilled = 0;
    const totalOptional = this.optionalFieldsWithAliases.length;
    for (const optionalConfig of this.optionalFieldsWithAliases) {
      if (this.hasFieldValue(data, optionalConfig.field, optionalConfig.aliases)) {
        optionalFilled++;
      } else {
        missingFields.push({
          field: optionalConfig.field,
          description: `${optionalConfig.field} is recommended for better analysis`,
          required: false,
        });
      }
    }

    const requiredWeight = 0.6;
    const optionalWeight = 0.4;
    const optionalScore = totalOptional > 0 ? (optionalFilled / totalOptional) : 1;
    const score = Math.round((requiredScore * requiredWeight + optionalScore * optionalWeight) * 100);

    return { score, missingFields };
  }

  /**
   * Detect ambiguities in input
   */
  private detectAmbiguities(
    data: Record<string, unknown>
  ): ContextData["ambiguities"] {
    const ambiguities: NonNullable<ContextData["ambiguities"]> = [];

    // Check for vague descriptions
    const description = data.description as string;
    if (description) {
      if (description.length < 50) {
        ambiguities.push({
          field: "description",
          issue: "Description is too brief",
          suggestion: "Provide more details about the project scope and objectives",
        });
      }

      // Check for vague terms
      const vagueTerms = ["various", "etc", "some", "maybe", "possibly", "might"];
      for (const term of vagueTerms) {
        if (description.toLowerCase().includes(term)) {
          ambiguities.push({
            field: "description",
            issue: `Contains vague term: "${term}"`,
            suggestion: "Be more specific and avoid vague language",
          });
          break;
        }
      }
    }

    // Check for unclear budget
    const budget = data.estimatedBudget || data.budget;
    if (budget) {
      const budgetStr = String(budget).toLowerCase();
      if (budgetStr.includes("tbd") || budgetStr.includes("unknown")) {
        ambiguities.push({
          field: "estimatedBudget",
          issue: "Budget is not defined",
          suggestion: "Provide an estimated budget range",
        });
      }
    }

    return ambiguities;
  }

  /**
   * Log assumptions made about the data
   */
  private logAssumptions(
    data: Record<string, unknown>
  ): NonNullable<ContextData["assumptions"]> {
    const assumptions: NonNullable<ContextData["assumptions"]> = [];

    // Assume jurisdiction if not specified
    if (!data.jurisdiction) {
      assumptions.push({
        field: "jurisdiction",
        assumedValue: "UAE",
        reason: "Default jurisdiction for COREVIA platform",
      });
    }

    // Assume priority if not specified
    if (!data.priority) {
      assumptions.push({
        field: "priority",
        assumedValue: "medium",
        reason: "Default priority when not specified",
      });
    }

    // Assume timeline if not specified
    if (!data.timeline && !data.expectedDuration) {
      assumptions.push({
        field: "timeline",
        assumedValue: "6 months",
        reason: "Standard project timeline assumed",
      });
    }

    return assumptions;
  }
}
