import { DemandAnalysisService } from "./demandAnalysisService";
import type {
  AnalysisResult,
  ComprehensiveAnalysisData,
  EnhancedObjectiveData,
} from "./demandAnalysisService";
import type {
  ComprehensiveDemandAnalysis,
  DemandAnalysisEngine,
  DemandClassification,
  DemandGeneratedFields,
} from "../domain";

/**
 * Adapts the legacy DemandAnalysisService to the DemandAnalysisEngine port.
 *
 * Exposes both the port-level interface (unwrapped results) and
 * raw service-level methods (success/error envelope) so that API route
 * handlers can implement their own fallback / caching logic.
 */
export class LegacyDemandAnalysisEngine implements DemandAnalysisEngine {
  private service: DemandAnalysisService;

  constructor() {
    this.service = new DemandAnalysisService();
  }

  // ── Port-level methods (unwrapped) ─────────────────────────────

  async generateFields(objective: string, context?: Record<string, unknown>): Promise<DemandGeneratedFields> {
    const userId = context?.userId as string | undefined;
    const accessLevel = context?.accessLevel as string | undefined;
    const result = await this.service.generateDemandFields(objective, userId, accessLevel);
    if (result.success && result.data && typeof result.data === "object") {
      return result.data as DemandGeneratedFields;
    }
    return {
      enhancedBusinessObjective: objective,
      suggestedProjectName: "",
      currentChallenges: "",
      expectedOutcomes: [],
      successCriteria: [],
      timeframe: "",
      stakeholders: [],
      riskFactors: [],
      constraints: [],
      integrationRequirements: [],
      complianceRequirements: [],
      existingSystems: [],
      assumptions: [],
    };
  }

  async enhanceObjective(objective: string): Promise<string> {
    const result = await this.service.enhanceObjective(objective);
    return typeof result === "string" ? result : (result as unknown as Record<string, unknown>).enhanced as string || objective;
  }

  async classifyRequest(objective: string, context?: Record<string, unknown>): Promise<DemandClassification> {
    const result = await this.service.classifyRequest(objective, context);
    if (result.success && result.data && typeof result.data === "object") {
      const raw = result.data as Record<string, unknown>;
      return {
        requestType: String(raw.requestType || raw.request_type || raw.type || raw.classification || "demand"),
        confidence: typeof raw.confidence === "number" ? raw.confidence : 0.5,
        reasoning: String(raw.reasoning || raw.classificationReasoning || raw.explanation || raw.rationale || ""),
      };
    }
    return { requestType: "demand", confidence: 0.5, reasoning: "" };
  }

  async runComprehensiveAnalysis(data: Record<string, unknown>): Promise<ComprehensiveDemandAnalysis> {
    const result = await this.service.generateComprehensiveAnalysis(data as unknown as Parameters<typeof this.service.generateComprehensiveAnalysis>[0]);
    if (result.success && result.data) {
      return result.data as unknown as ComprehensiveDemandAnalysis;
    }
    return {};
  }

  // ── Raw service methods (preserve success/error envelope) ─────
  async generateDemandFields(
    objective: string,
    userId?: string,
    accessLevel?: string,
    decisionSpineId?: string,
    organizationName?: string,
    additionalContext?: Record<string, unknown>,
  ): Promise<AnalysisResult<unknown>> {
    return this.service.generateDemandFields(objective, userId, accessLevel, decisionSpineId, organizationName, additionalContext);
  }

  async rawEnhanceObjective(objective: string): Promise<AnalysisResult<EnhancedObjectiveData>> {
    return this.service.enhanceObjective(objective);
  }

  async rawClassifyRequest(objective: string, context?: Record<string, unknown>, decisionSpineId?: string): Promise<AnalysisResult<unknown>> {
    return this.service.classifyRequest(objective, context, decisionSpineId);
  }

  async rawComprehensiveAnalysis(data: Record<string, unknown>): Promise<AnalysisResult<ComprehensiveAnalysisData>> {
    return this.service.generateComprehensiveAnalysis(data as unknown as Parameters<typeof this.service.generateComprehensiveAnalysis>[0]);
  }
}
