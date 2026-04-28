import { randomUUID } from "node:crypto";
import { DecisionObject } from "@shared/schemas/corevia/decision-object";
import { logger } from "@platform/observability";
import { localInferenceAdapter, type LocalInferenceGenerateParams } from "../internal/localInferenceAdapter";

/**
 * Distillation Intelligence Engine (Engine C / Engine #3)
 * 
 * ROLE: Controlled Evolution — converts approved reality into safe improvements.
 * 
 * What Engine C does:
 * - Extract patterns from APPROVED decisions (Final Ledger)
 * - Generate better templates (BC/REQ/WBS)
 * - Update scoring weights (strategic fit)
 * - Improve routing rules
 * - Create policy test cases
 * - Enrich knowledge base (structured facts)
 * - Produce training datasets for Engine A fine-tuning
 * - Cross-decision correlation (batch pattern discovery)
 * - LLM-powered semantic distillation via Engine A (sovereign)
 * 
 * What Engine C does NOT do:
 * - Generate Business Cases directly
 * - Provide live reasoning
 * - Process raw demands
 * 
 * INVARIANT: Only distills from APPROVED outcomes
 * INVARIANT: All artifacts start as DRAFT (require human activation)
 * INVARIANT: Never learns from rejected / draft outputs
 * 
 * Engine C is what turns Corevia from "an app that uses AI" into
 * "a governed AI operating system that gets smarter over time".
 */

export interface DistillationResult {
  status: "completed" | "skipped" | "error";
  reason?: string;
  artifactsCreated: string[];
  patternsIdentified: string[];
  knowledgeUpdates: string[];
  templateImprovements: string[];
  scoringUpdates: string[];
  routingInsights: string[];
  policyTestCases: string[];
  trainingSamples: string[];
  llmUsed: boolean;
}

export type DistillationArtifactType =
  | "pattern"
  | "best_practice"
  | "knowledge_summary"
  | "template_improvement"
  | "scoring_update"
  | "routing_insight"
  | "policy_test_case"
  | "training_sample"
  | "cross_decision_correlation";

export interface DistillationConfig {
  /** Engine A endpoint for LLM-powered distillation */
  engineAEndpoint: string;
  /** Engine A model name */
  engineAModel: string;
  /** Max tokens for LLM calls */
  maxTokens: number;
  /** Temperature for distillation (low = deterministic) */
  temperature: number;
  /** Timeout for LLM calls in ms */
  timeoutMs: number;
  /** Enable LLM-powered distillation (falls back to deterministic if false or LLM unavailable) */
  llmEnabled: boolean;
}

function resolveDistillationConfig(): DistillationConfig {
  return {
    engineAEndpoint: String(process.env.COREVIA_ENGINE_A_ENDPOINT || "").trim(),
    engineAModel: String(process.env.COREVIA_ENGINE_A_MODEL || "mistral-nemo").trim(),
    maxTokens: Number(process.env.COREVIA_DISTILLATION_MAX_TOKENS) || 2000,
    temperature: Number(process.env.COREVIA_DISTILLATION_TEMPERATURE) || 0.15,
    timeoutMs: Number(process.env.COREVIA_DISTILLATION_TIMEOUT_MS) || 30000,
    llmEnabled: process.env.COREVIA_DISTILLATION_LLM !== "false",
  };
}

export interface DistillationArtifact {
  id: string;
  artifactType: DistillationArtifactType;
  name: string;
  sourceDecisionId: string;
  content: Record<string, unknown>;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  createdAt: string;
}

export class DistillationEngine {
  private readonly storage: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  private readonly config: DistillationConfig;
  private lastRunAt: string | null = null;
  private totalRuns = 0;
  private totalArtifactsCreated = 0;
  private totalTrainingSamples = 0;
  private lastCorrelationAt: string | null = null;

  constructor(storage?: unknown) {
    this.storage = storage;
    this.config = resolveDistillationConfig();
  }

  getStatus() {
    return {
      llmEnabled: this.config.llmEnabled,
      engineAModel: this.config.engineAModel,
      lastRunAt: this.lastRunAt,
      totalRuns: this.totalRuns,
      totalArtifactsCreated: this.totalArtifactsCreated,
      totalTrainingSamples: this.totalTrainingSamples,
      lastCorrelationAt: this.lastCorrelationAt,
    };
  }

  /**
   * Distill learning from approved decision.
   * 
   * This is the main entry point. It runs ALL distillation pipelines:
   * 1. Pattern extraction (decision patterns for future matching) — LLM-powered
   * 2. Best practices extraction (from high-confidence decisions)
   * 3. Knowledge summary (organizational memory) — LLM-powered
   * 4. Template improvements (better BC/REQ/WBS templates)
   * 5. Scoring updates (strategic fit weights)
   * 6. Routing insights (improve engine routing)
   * 7. Policy test cases (for regression testing)
   * 8. Training sample generation (fine-tuning data for Engine A)
   */
  async distill(decision: DecisionObject): Promise<DistillationResult> {
    if (decision.validation?.status !== "approved") {
      return {
        status: "skipped",
        reason: "Decision not approved — Engine C only distills from approved outcomes",
        artifactsCreated: [],
        patternsIdentified: [],
        knowledgeUpdates: [],
        templateImprovements: [],
        scoringUpdates: [],
        routingInsights: [],
        policyTestCases: [],
        trainingSamples: [],
        llmUsed: false,
      };
    }

    const llmAvailable = await this.checkLlmAvailability();

    try {
      const artifacts: string[] = [];
      const patterns: string[] = [];
      const knowledgeUpdates: string[] = [];
      const templateImprovements: string[] = [];
      const scoringUpdates: string[] = [];
      const routingInsights: string[] = [];
      const policyTestCases: string[] = [];
      const trainingSamples: string[] = [];

      // 1. Extract decision patterns
      const patternArtifact = await this.extractDecisionPattern(decision);
      if (patternArtifact) {
        artifacts.push(patternArtifact.id);
        patterns.push(patternArtifact.pattern);
        await this.persistArtifact({
          id: patternArtifact.id,
          artifactType: "pattern",
          name: patternArtifact.pattern.substring(0, 200),
          sourceDecisionId: decision.decisionId,
          content: { pattern: patternArtifact.pattern, decisionId: decision.decisionId },
        });
      }

      // 2. Extract best practices
      const bestPractices = await this.extractBestPractices(decision);
      for (const practice of bestPractices) {
        artifacts.push(practice.id);
        knowledgeUpdates.push(practice.description);
        await this.persistArtifact({
          id: practice.id,
          artifactType: "best_practice",
          name: practice.description.substring(0, 200),
          sourceDecisionId: decision.decisionId,
          content: { description: practice.description, decisionId: decision.decisionId },
        });
      }

      // 3. Create knowledge summary
      const summaryArtifact = await this.createKnowledgeSummary(decision);
      if (summaryArtifact) {
        artifacts.push(summaryArtifact.id);
        knowledgeUpdates.push(`Knowledge summary created for ${decision.decisionId.substring(0, 8)}`);
        await this.persistArtifact({
          id: summaryArtifact.id,
          artifactType: "knowledge_summary",
          name: `Knowledge Summary - ${decision.decisionId.substring(0, 8)}`,
          sourceDecisionId: decision.decisionId,
          content: { summary: summaryArtifact.summary, decisionId: decision.decisionId },
        });
      }

      // 4. Extract template improvements
      const templateInsights = this.extractTemplateImprovements(decision);
      for (const insight of templateInsights) {
        artifacts.push(insight.id);
        templateImprovements.push(insight.description);
        await this.persistArtifact({
          id: insight.id,
          artifactType: "template_improvement",
          name: insight.description.substring(0, 200),
          sourceDecisionId: decision.decisionId,
          content: insight.content,
        });
      }

      // 5. Extract scoring weight updates
      const scoringInsight = this.extractScoringUpdate(decision);
      if (scoringInsight) {
        artifacts.push(scoringInsight.id);
        scoringUpdates.push(scoringInsight.description);
        await this.persistArtifact({
          id: scoringInsight.id,
          artifactType: "scoring_update",
          name: scoringInsight.description.substring(0, 200),
          sourceDecisionId: decision.decisionId,
          content: scoringInsight.content,
        });
      }

      // 6. Extract routing insights
      const routingInsight = this.extractRoutingInsight(decision);
      if (routingInsight) {
        artifacts.push(routingInsight.id);
        routingInsights.push(routingInsight.description);
        await this.persistArtifact({
          id: routingInsight.id,
          artifactType: "routing_insight",
          name: routingInsight.description.substring(0, 200),
          sourceDecisionId: decision.decisionId,
          content: routingInsight.content,
        });
      }

      // 7. Generate policy test cases
      const testCases = this.generatePolicyTestCases(decision);
      for (const tc of testCases) {
        artifacts.push(tc.id);
        policyTestCases.push(tc.description);
        await this.persistArtifact({
          id: tc.id,
          artifactType: "policy_test_case",
          name: tc.description.substring(0, 200),
          sourceDecisionId: decision.decisionId,
          content: tc.content,
        });
      }

      // 8. Generate training sample for Engine A fine-tuning
      const trainingSample = this.generateTrainingSample(decision);
      if (trainingSample) {
        artifacts.push(trainingSample.id);
        trainingSamples.push(trainingSample.id);
        await this.persistArtifact({
          id: trainingSample.id,
          artifactType: "training_sample",
          name: `Training sample: ${decision.decisionId.substring(0, 8)}`,
          sourceDecisionId: decision.decisionId,
          content: trainingSample.content,
          createdByEngine: "engine-distillation",
        });
        this.totalTrainingSamples++;
      }

      this.totalRuns++;
      this.totalArtifactsCreated += artifacts.length;
      this.lastRunAt = new Date().toISOString();

      logger.info(`[Distillation] Created ${artifacts.length} artifacts (${trainingSamples.length} training samples) from decision ${decision.decisionId}${llmAvailable ? " [LLM-powered]" : " [deterministic]"}`);

      return {
        status: "completed",
        artifactsCreated: artifacts,
        patternsIdentified: patterns,
        knowledgeUpdates,
        templateImprovements,
        scoringUpdates,
        routingInsights,
        policyTestCases,
        trainingSamples,
        llmUsed: llmAvailable,
      };
    } catch (error) {
      logger.error("[Distillation] Error:", error);
      return {
        status: "error",
        reason: error instanceof Error ? error.message : "Unknown error",
        artifactsCreated: [],
        patternsIdentified: [],
        knowledgeUpdates: [],
        templateImprovements: [],
        scoringUpdates: [],
        routingInsights: [],
        policyTestCases: [],
        trainingSamples: [],
        llmUsed: false,
      };
    }
  }

  private async persistArtifact(artifact: unknown): Promise<void> {
    if (this.storage?.saveLearningArtifact) {
      try {
        await this.storage.saveLearningArtifact(artifact);
      } catch (err) {
        const artifactIdValue = artifact && typeof artifact === "object" ? (artifact as { id?: unknown }).id : undefined;
        const artifactId =
          typeof artifactIdValue === "string" || typeof artifactIdValue === "number"
            ? String(artifactIdValue)
            : "unknown";
        logger.error(`[Distillation] Failed to persist artifact ${artifactId}:`, err);
      }
    }
  }

  /**
   * Extract decision pattern for future matching — LLM-powered with deterministic fallback
   */
  private async extractDecisionPattern(
    decision: DecisionObject
  ): Promise<{ id: string; pattern: string } | null> {
    const input = decision.input;
    const advisory = decision.advisory;
    const validation = decision.validation;

    if (!advisory?.options.length) {
      return null;
    }

    const topOption = advisory.options[0]!;
    const serviceRoute = `${input?.serviceId}/${input?.routeKey}`;

    // Try LLM-powered semantic pattern extraction
    if (await this.checkLlmAvailability()) {
      try {
        const result = await this.callEngineA(
          "You are COREVIA Brain's distillation engine. Extract a concise decision pattern from this approved decision. Return a JSON object with a single 'pattern' field containing a semantic description of when this decision pattern should be reused.",
          `Decision approved:\nService: ${serviceRoute}\nClassification: ${decision.classification?.classificationLevel} / ${decision.classification?.sector}\nRisk: ${decision.classification?.riskLevel}\nChosen Option: ${topOption.name} (score: ${topOption.recommendationScore})\nConfidence: ${advisory.overallConfidence}%\nRisks identified: ${advisory.risks.length}\nEvidence sources: ${advisory.evidence?.length || 0}\nApproval: ${validation?.status}`,
        );
        if (result.ok && result.text) {
          const parsed = this.safeParseJson(result.text);
          if (parsed?.pattern && typeof parsed.pattern === "string") {
            return { id: randomUUID(), pattern: parsed.pattern };
          }
        }
      } catch (err) {
        logger.warn("[Distillation] LLM pattern extraction failed, using deterministic fallback:", err);
      }
    }

    // Deterministic fallback
    const pattern = [
      `Service: ${serviceRoute}`,
      `Classification: ${decision.classification?.classificationLevel}`,
      `Sector: ${decision.classification?.sector}`,
      `Chosen Option: ${topOption.name}`,
      `Confidence: ${advisory.overallConfidence}%`,
      `Approval: ${validation?.status}`,
    ].join(" | ");

    return {
      id: randomUUID(),
      pattern,
    };
  }

  /**
   * Extract best practices from successful decision
   */
  private async extractBestPractices(
    decision: DecisionObject
  ): Promise<Array<{ id: string; description: string }>> {
    const practices: Array<{ id: string; description: string }> = [];
    const advisory = decision.advisory;

    // Extract from high-confidence options
    if (advisory?.overallConfidence && advisory.overallConfidence >= 80) {
      practices.push({
        id: randomUUID(),
        description: `High-confidence decision pattern for ${decision.classification?.sector} sector`,
      });
    }

    // Extract risk mitigation practices
    const mitigatedRisks = advisory?.risks.filter(r => r.mitigation);
    if (mitigatedRisks && mitigatedRisks.length > 0) {
      for (const risk of mitigatedRisks.slice(0, 3)) {
        practices.push({
          id: randomUUID(),
          description: `Risk mitigation: ${risk.category} - ${risk.mitigation}`,
        });
      }
    }

    // Extract from evidence-based decisions
    if (advisory?.evidence && advisory.evidence.length >= 3) {
      practices.push({
        id: randomUUID(),
        description: "Evidence-based decision with multiple supporting sources",
      });
    }

    return practices;
  }

  /**
   * Create knowledge summary for organizational memory — LLM-powered with deterministic fallback
   */
  private async createKnowledgeSummary(
    decision: DecisionObject
  ): Promise<{ id: string; summary: string } | null> {
    const input = decision.input;
    const advisory = decision.advisory;
    const memory = decision.memory;

    if (!memory?.decisionSummary) {
      return null;
    }

    const projectName = (input?.normalizedInput as any)?.projectName ||  // eslint-disable-line @typescript-eslint/no-explicit-any
                       (input?.rawInput as any)?.projectName ||  // eslint-disable-line @typescript-eslint/no-explicit-any
                       "Unnamed Project";

    // Try LLM-powered knowledge synthesis
    if (await this.checkLlmAvailability()) {
      try {
        const result = await this.callEngineA(
          "You are COREVIA Brain's knowledge synthesis engine. Create a rich, structured knowledge artifact from this approved decision. Return a JSON object with a 'summary' field containing a markdown-formatted knowledge summary including decision context, key learnings, risk mitigations applied, and reusable patterns.",
          `Project: ${projectName}\nDecision Summary: ${memory.decisionSummary}\nRationale: ${memory.rationale || "N/A"}\nConfidence: ${advisory?.overallConfidence || 0}%\nRisks: ${JSON.stringify(advisory?.risks?.slice(0, 3) || [])}\nEvidence: ${JSON.stringify(advisory?.evidence?.slice(0, 3) || [])}\nTags: ${memory.tags?.join(", ") || "none"}`,
        );
        if (result.ok && result.text) {
          const parsed = this.safeParseJson(result.text);
          if (parsed?.summary && typeof parsed.summary === "string") {
            return { id: `ks_${randomUUID().substring(0, 8)}`, summary: parsed.summary };
          }
        }
      } catch (err) {
        logger.warn("[Distillation] LLM knowledge summary failed, using deterministic fallback:", err);
      }
    }

    // Deterministic fallback
    const summary = [
      `## Knowledge Artifact: ${projectName}`,
      "",
      "### Decision Summary",
      memory.decisionSummary,
      "",
      "### Rationale",
      memory.rationale,
      "",
      "### Key Learnings",
      "- Successful decision pattern identified",
      "- Governance controls validated",
      `- Overall confidence: ${advisory?.overallConfidence || 0}%`,
      "",
      "### Tags",
      memory.tags?.map(t => `#${t}`).join(" ") || "",
    ].join("\n");

    return {
      id: `ks_${randomUUID().substring(0, 8)}`,
      summary,
    };
  }

  /**
   * Extract template improvement insights from a successful decision.
   * Identifies what made BC/REQ/WBS templates work well (or poorly).
   */
  private extractTemplateImprovements(
    decision: DecisionObject
  ): Array<{ id: string; description: string; content: Record<string, unknown> }> {
    const improvements: Array<{ id: string; description: string; content: Record<string, unknown> }> = [];
    const input = decision.input;
    const advisory = decision.advisory;
    const serviceRoute = `${input?.serviceId || "unknown"}/${input?.routeKey || "unknown"}`;

    // Check if advisory had high confidence — means template worked well
    if (advisory?.overallConfidence && advisory.overallConfidence >= 85) {
      improvements.push({
        id: randomUUID(),
        description: `High-confidence template pattern for ${serviceRoute}`,
        content: {
          serviceRoute,
          templateType: this.resolveTemplateType(serviceRoute),
          fieldCompleteness: this.measureFieldCompleteness(input?.normalizedInput || input?.rawInput),
          optionCount: advisory.options.length,
          riskCount: advisory.risks.length,
          evidenceCount: advisory.evidence?.length || 0,
          recommendation: "Consider making this the reference template for similar requests",
        },
      });
    }

    // Check field usage — which fields contributed to quality
    const normalizedInput = input?.normalizedInput || input?.rawInput || {};
    const populatedFields = Object.entries(normalizedInput)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k]) => k);

    if (populatedFields.length >= 8) {
      improvements.push({
        id: randomUUID(),
        description: `Rich input fields for ${serviceRoute}: ${populatedFields.length} fields populated`,
        content: {
          serviceRoute,
          populatedFields,
          fieldCount: populatedFields.length,
          recommendation: "These fields should be required or strongly encouraged in the template",
        },
      });
    }

    return improvements;
  }

  /**
   * Extract scoring weight update from a decision.
   * Identifies if strategic fit scoring weights need adjustment.
   */
  private extractScoringUpdate(
    decision: DecisionObject
  ): { id: string; description: string; content: Record<string, unknown> } | null {
    const advisory = decision.advisory;
    const validation = decision.validation;

    if (!advisory?.options?.length) return null;

    // If approved with high confidence, current scoring is well-calibrated
    // If approved despite low confidence, scoring may need adjustment
    const confidence = advisory.overallConfidence || 0;
    const topOption = advisory.options[0]!;

    if (confidence < 60 && validation?.status === "approved") {
      return {
        id: randomUUID(),
        description: `Scoring recalibration needed: approved despite ${confidence}% confidence`,
        content: {
          decisionId: decision.decisionId,
          confidence,
          topOptionScore: topOption.recommendationScore,
          sector: decision.classification?.sector,
          classificationLevel: decision.classification?.classificationLevel,
          adjustment: "INCREASE_WEIGHT",
          recommendation: "Review scoring weights — human approved what the model was unsure about",
        },
      };
    }

    if (confidence >= 90 && validation?.status === "approved") {
      return {
        id: randomUUID(),
        description: `Scoring validated: ${confidence}% confidence confirmed by approval`,
        content: {
          decisionId: decision.decisionId,
          confidence,
          sector: decision.classification?.sector,
          adjustment: "VALIDATED",
          recommendation: "Current scoring weights are well-calibrated for this sector/type",
        },
      };
    }

    return null;
  }

  /**
   * Extract routing insight from a decision.
   * Identifies if engine routing should be adjusted based on outcome.
   */
  private extractRoutingInsight(
    decision: DecisionObject
  ): { id: string; description: string; content: Record<string, unknown> } | null {
    const classification = decision.classification;
    const advisory = decision.advisory;

    if (!classification || !advisory) return null;

    const usedExternal = classification.constraints?.allowExternalModels;
    const confidence = advisory.overallConfidence || 0;
    const classLevel = classification.classificationLevel;

    // If internal-only achieved high confidence, external routing is unnecessary
    if (!usedExternal && confidence >= 85) {
      return {
        id: randomUUID(),
        description: `Internal engine sufficient for ${classLevel} at ${confidence}% confidence`,
        content: {
          decisionId: decision.decisionId,
          classificationLevel: classLevel,
          usedExternal: false,
          confidence,
          insight: "INTERNAL_SUFFICIENT",
          recommendation: "Engine A (Sovereign) can handle this classification without fallback to Engine B",
        },
      };
    }

    // If external was used but confidence is low, routing may need adjustment
    if (usedExternal && confidence < 50) {
      return {
        id: randomUUID(),
        description: `External engine underperformed for ${classLevel}: ${confidence}% confidence`,
        content: {
          decisionId: decision.decisionId,
          classificationLevel: classLevel,
          usedExternal: true,
          confidence,
          insight: "EXTERNAL_UNDERPERFORMED",
          recommendation: "Consider adjusting routing rules or model plugin for this use case",
        },
      };
    }

    return null;
  }

  /**
   * Generate policy test cases from approved decisions.
   * These become regression tests for governance compliance.
   */
  private generatePolicyTestCases(
    decision: DecisionObject
  ): Array<{ id: string; description: string; content: Record<string, unknown> }> {
    const testCases: Array<{ id: string; description: string; content: Record<string, unknown> }> = [];
    const classification = decision.classification;
    const advisory = decision.advisory;

    if (!classification) return testCases;

    // Test case: classification → engine routing
    testCases.push({
      id: randomUUID(),
      description: `Routing test: ${classification.classificationLevel} → ${classification.constraints?.allowExternalModels ? 'external allowed' : 'internal only'}`,
      content: {
        testType: "routing_policy",
        input: {
          classificationLevel: classification.classificationLevel,
          sector: classification.sector,
          riskLevel: classification.riskLevel,
        },
        expectedOutput: {
          allowExternalModels: classification.constraints?.allowExternalModels || false,
          localProcessingOnly: (classification.constraints as Record<string, unknown>)?.localProcessingOnly || false,
        },
        source: `Derived from approved decision ${decision.decisionId}`,
      },
    });

    // Test case: data classification boundary
    if (classification.classificationLevel === "sovereign" || classification.classificationLevel === "confidential") {
      testCases.push({
        id: randomUUID(),
        description: `Boundary test: ${classification.classificationLevel} must not route to external without HITL`,
        content: {
          testType: "classification_boundary",
          input: {
            classificationLevel: classification.classificationLevel,
          },
          expectedOutput: {
            externalAllowed: classification.classificationLevel !== "sovereign",
            requiresHITL: classification.classificationLevel === "confidential",
            requiresMasking: true,
          },
          source: `Boundary assertion from decision ${decision.decisionId}`,
        },
      });
    }

    // Test case: advisory quality threshold
    if (advisory?.overallConfidence) {
      testCases.push({
        id: randomUUID(),
        description: `Quality test: ${classification.sector} advisory must meet confidence threshold`,
        content: {
          testType: "advisory_quality",
          input: {
            sector: classification.sector,
            classificationLevel: classification.classificationLevel,
          },
          expectedOutput: {
            minimumConfidence: Math.max(50, (advisory.overallConfidence || 0) - 20),
            minimumOptions: Math.max(1, advisory.options.length - 1),
            minimumRisks: Math.max(1, advisory.risks.length - 1),
          },
          source: `Quality baseline from approved decision ${decision.decisionId}`,
        },
      });
    }

    return testCases;
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private resolveTemplateType(serviceRoute: string): string {
    const lower = serviceRoute.toLowerCase();
    if (lower.includes("business") || lower.includes("bc")) return "BUSINESS_CASE";
    if (lower.includes("requirement") || lower.includes("req")) return "REQUIREMENTS";
    if (lower.includes("wbs") || lower.includes("plan")) return "WBS";
    if (lower.includes("strategic")) return "STRATEGIC_FIT";
    return "GENERAL";
  }

  private measureFieldCompleteness(input: unknown): number {
    if (!input || typeof input !== "object") return 0;
    const entries = Object.entries(input as Record<string, unknown>);
    if (entries.length === 0) return 0;
    const populated = entries.filter(([, v]) => v !== null && v !== undefined && v !== "").length;
    return Math.round((populated / entries.length) * 100);
  }

  /**
   * Activate learning artifact (requires human approval)
   */
  async activateArtifact(artifactId: string, userId: string): Promise<boolean> {
    logger.info(`[Distillation] Artifact ${artifactId} activated by ${userId}`);
    if (this.storage?.activateLearningArtifact) {
      await this.storage.activateLearningArtifact(artifactId, userId);
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // LLM Integration (Engine A → Engine C)
  // --------------------------------------------------------------------------

  private llmAvailableCache: boolean | null = null;
  private llmAvailableCacheAt = 0;

  private async checkLlmAvailability(): Promise<boolean> {
    if (!this.config.llmEnabled || !this.config.engineAEndpoint) return false;
    const now = Date.now();
    if (this.llmAvailableCache !== null && now - this.llmAvailableCacheAt < 60_000) {
      return this.llmAvailableCache;
    }
    try {
      const health = await localInferenceAdapter.healthCheck(this.config.engineAEndpoint, 3000);
      this.llmAvailableCache = health.ok;
      this.llmAvailableCacheAt = now;
      return health.ok;
    } catch {
      this.llmAvailableCache = false;
      this.llmAvailableCacheAt = now;
      return false;
    }
  }

  private async callEngineA(systemPrompt: string, userPrompt: string): Promise<{ ok: boolean; text?: string; error?: string }> {
    const params: LocalInferenceGenerateParams = {
      endpoint: this.config.engineAEndpoint,
      model: this.config.engineAModel,
      systemPrompt,
      userPrompt,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    };
    return localInferenceAdapter.generate(params, this.config.timeoutMs);
  }

  private safeParseJson(text: string): Record<string, unknown> | null {
    const cleaned = text.replaceAll(/```json\s*/gi, "").replaceAll(/```\s*/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : null;
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(cleaned.substring(start, end + 1)) as Record<string, unknown>;
        } catch { return null; }
      }
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Pipeline 8: Training Sample Generation (Engine C → Engine A fine-tuning)
  // --------------------------------------------------------------------------

  /**
   * Generate a training sample from an approved decision for Engine A fine-tuning.
   * Produces instruction-tuning format: { system, user, assistant }
   */
  private generateTrainingSample(
    decision: DecisionObject
  ): { id: string; content: Record<string, unknown> } | null {
    const input = decision.input;
    const advisory = decision.advisory;
    const classification = decision.classification;
    const memory = decision.memory;

    if (!advisory?.options?.length || !classification) return null;

    const projectName = (input?.normalizedInput as any)?.projectName || // eslint-disable-line @typescript-eslint/no-explicit-any
                       (input?.rawInput as any)?.projectName || // eslint-disable-line @typescript-eslint/no-explicit-any
                       "Unnamed Project";

    const systemPrompt = "You are COREVIA Brain, a government portfolio intelligence engine. Analyze the following decision context and produce a structured assessment with options, risks, evidence, and confidence scoring.";

    const userContext = [
      `Project: ${projectName}`,
      `Service: ${input?.serviceId}/${input?.routeKey}`,
      `Classification: ${classification.classificationLevel}`,
      `Sector: ${classification.sector}`,
      `Risk Level: ${classification.riskLevel}`,
      `Input: ${JSON.stringify(input?.normalizedInput || input?.rawInput || {})}`,
    ].join("\n");

    const assistantResponse = JSON.stringify({
      options: advisory.options.map(o => ({
        name: o.name,
        description: o.description,
        recommendationScore: o.recommendationScore,
        pros: o.pros,
        cons: o.cons,
      })),
      risks: advisory.risks.map(r => ({
        category: r.category,
        impact: r.impact,
        likelihood: r.likelihood,
        mitigation: r.mitigation,
      })),
      evidence: (advisory.evidence || []).slice(0, 5),
      overallConfidence: advisory.overallConfidence,
      decisionSummary: memory?.decisionSummary || null,
    });

    return {
      id: `ts_${randomUUID().substring(0, 8)}`,
      content: {
        format: "instruction_tuning",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContext },
          { role: "assistant", content: assistantResponse },
        ],
        metadata: {
          decisionId: decision.decisionId,
          sector: classification.sector,
          classificationLevel: classification.classificationLevel,
          confidence: advisory.overallConfidence,
          serviceRoute: `${input?.serviceId}/${input?.routeKey}`,
          generatedAt: new Date().toISOString(),
          generatedBy: "engine-distillation",
        },
      },
    };
  }

  // --------------------------------------------------------------------------
  // Cross-Decision Correlation (Batch Pattern Discovery)
  // --------------------------------------------------------------------------

  private groupApprovedDecisionsBySector(decisions: DecisionObject[]): Map<string, DecisionObject[]> {
    const bySector = new Map<string, DecisionObject[]>();

    for (const decision of decisions) {
      const sector = decision.classification?.sector || "unknown";
      const sectorDecisions = bySector.get(sector) || [];
      sectorDecisions.push(decision);
      bySector.set(sector, sectorDecisions);
    }

    return bySector;
  }

  private buildRecurringRiskCorrelations(sector: string, sectorDecisions: DecisionObject[]): Array<{ id: string; theme: string; decisionIds: string[]; content: Record<string, unknown> }> {
    const riskFrequency = new Map<string, string[]>();

    for (const decision of sectorDecisions) {
      for (const risk of (decision.advisory?.risks || [])) {
        const category = risk.category || "unknown";
        const decisionIds = riskFrequency.get(category) || [];
        decisionIds.push(decision.decisionId);
        riskFrequency.set(category, decisionIds);
      }
    }

    const recurringRisks = [...riskFrequency.entries()].filter(([, ids]) => ids.length >= 2);
    if (recurringRisks.length === 0) {
      return [];
    }

    return [{
      id: randomUUID(),
      theme: `Recurring risks in ${sector}: ${recurringRisks.map(([category]) => category).join(", ")}`,
      decisionIds: [...new Set(recurringRisks.flatMap(([, ids]) => ids))],
      content: {
        correlationType: "recurring_risk",
        sector,
        risks: recurringRisks.map(([category, decisionIds]) => ({ category, frequency: decisionIds.length, decisionIds })),
      },
    }];
  }

  private buildConfidenceCorrelation(sector: string, sectorDecisions: DecisionObject[]): { id: string; theme: string; decisionIds: string[]; content: Record<string, unknown> } {
    const avgConfidence = sectorDecisions.reduce((sum, decision) => sum + (decision.advisory?.overallConfidence || 0), 0) / sectorDecisions.length;

    return {
      id: randomUUID(),
      theme: `${sector} sector confidence baseline: ${Math.round(avgConfidence)}%`,
      decisionIds: sectorDecisions.map((decision) => decision.decisionId),
      content: {
        correlationType: "confidence_baseline",
        sector,
        avgConfidence: Math.round(avgConfidence),
        decisionCount: sectorDecisions.length,
      },
    };
  }

  private async buildLlmCorrelations(approved: DecisionObject[]): Promise<Array<{ id: string; theme: string; decisionIds: string[]; content: Record<string, unknown> }>> {
    const decisionSummaries = approved.slice(0, 10).map(d => ({
      id: d.decisionId,
      sector: d.classification?.sector,
      service: `${d.input?.serviceId}/${d.input?.routeKey}`,
      confidence: d.advisory?.overallConfidence,
      topOption: d.advisory?.options?.[0]?.name,
      riskCount: d.advisory?.risks?.length || 0,
    }));

    const result = await this.callEngineA(
      "You are COREVIA Brain's correlation engine. Analyze these approved decisions and identify cross-cutting themes, patterns, and strategic insights. Return a JSON object with a 'themes' array, each with 'theme' (string) and 'decisionIds' (array of IDs) and 'insight' (string).",
      JSON.stringify(decisionSummaries),
    );

    if (!result.ok || !result.text) {
      return [];
    }

    const parsed = this.safeParseJson(result.text);
    const themes = Array.isArray(parsed?.themes) ? parsed.themes as Array<{ theme?: string; decisionIds?: string[]; insight?: string }> : [];

    return themes.slice(0, 5).filter((theme) => theme.theme).map((theme) => ({
      id: randomUUID(),
      theme: String(theme.theme),
      decisionIds: Array.isArray(theme.decisionIds) ? theme.decisionIds.map(String) : [],
      content: {
        correlationType: "llm_semantic",
        insight: theme.insight || theme.theme,
        generatedBy: "engine-distillation-llm",
      },
    }));
  }

  private async persistCorrelations(correlations: Array<{ id: string; theme: string; decisionIds: string[]; content: Record<string, unknown> }>): Promise<void> {
    for (const correlation of correlations) {
      await this.persistArtifact({
        id: correlation.id,
        artifactType: "cross_decision_correlation",
        name: correlation.theme.substring(0, 200),
        sourceDecisionId: correlation.decisionIds[0] || "batch",
        content: correlation.content,
        createdByEngine: "engine-distillation",
      });
    }
  }

  /**
   * Correlate patterns across multiple approved decisions.
   * Finds recurring themes, common risk patterns, and sector-specific insights.
   */
  async correlateDecisions(decisions: DecisionObject[]): Promise<{
    correlations: Array<{ id: string; theme: string; decisionIds: string[]; content: Record<string, unknown> }>;
    llmUsed: boolean;
  }> {
    const approved = decisions.filter(d => d.validation?.status === "approved");
    if (approved.length < 2) {
      return { correlations: [], llmUsed: false };
    }

    const correlations: Array<{ id: string; theme: string; decisionIds: string[]; content: Record<string, unknown> }> = [];
    const llmAvailable = await this.checkLlmAvailability();

    for (const [sector, sectorDecisions] of this.groupApprovedDecisionsBySector(approved)) {
      if (sectorDecisions.length < 2) continue;
      correlations.push(
        ...this.buildRecurringRiskCorrelations(sector, sectorDecisions),
        this.buildConfidenceCorrelation(sector, sectorDecisions),
      );
    }

    if (llmAvailable && approved.length >= 2) {
      try {
        correlations.push(...await this.buildLlmCorrelations(approved));
      } catch (err) {
        logger.warn("[Distillation] LLM cross-correlation failed:", err);
      }
    }

    await this.persistCorrelations(correlations);

    this.lastCorrelationAt = new Date().toISOString();
    logger.info(`[Distillation] Cross-correlation completed: ${correlations.length} themes across ${approved.length} decisions`);

    return { correlations, llmUsed: llmAvailable };
  }
}
