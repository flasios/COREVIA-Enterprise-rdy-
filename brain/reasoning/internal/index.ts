import { DecisionObject } from "@shared/schemas/corevia/decision-object";
import { createHash } from "node:crypto";
import { ragService } from "../../../domains/knowledge/infrastructure/rag";
import { coreviaStorage } from "../../storage";
import { localInferenceAdapter } from "./localInferenceAdapter";
import { logger } from "../../../platform/observability";

/**
 * Internal Intelligence Engine (Engine #1)
 * 
 * Sovereign-Safe Intelligence:
 * - RAG Pipeline (real pgvector semantic search)
 * - Rule-based scoring
 * - Entity extraction
 * - Historical pattern matching (real decision queries)
 * 
 * INVARIANT: No external LLM API calls - embeddings + local DB only
 */
export class InternalEngine {
  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  }

  private asString(value: unknown): string {
    return typeof value === "string" ? value : "";
  }

  private asLowerString(value: unknown): string {
    return this.asString(value).toLowerCase();
  }

  private asUpperString(value: unknown): string {
    return this.asString(value).toUpperCase();
  }

  private firstString(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }

    return "";
  }

  private truncateString(value: unknown, maxLength?: number): string {
    const stringValue = this.asString(value);
    if (maxLength === undefined) {
      return stringValue;
    }

    return stringValue.substring(0, maxLength);
  }

  private resolveAccessLevel(classificationLevel?: string): string | undefined {
    if (classificationLevel === "sovereign" || classificationLevel === "confidential") {
      return "restricted";
    }

    if (classificationLevel === "internal") {
      return "internal";
    }

    return undefined;
  }

  private getConfigString(config: Record<string, unknown>, key: string): string | undefined {
    const value = config[key];
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
  }

  private collectRegexMatches(text: string, regex: RegExp): string[] {
    const matches: string[] = [];
    let match = regex.exec(text);

    while (match) {
      matches.push(match[0]);
      match = regex.exec(text);
    }

    return matches;
  }

  private collectOrganizationMatches(text: string, keyword: string): string[] {
    const regex = new RegExp(String.raw`(\w+\s+)?${keyword}(\s+\w+)?`, "gi");
    const matches: string[] = [];
    let match = regex.exec(text);

    while (match && matches.length < 3) {
      matches.push(match[0].trim());
      match = regex.exec(text);
    }

    return matches;
  }

  private advanceJsonScannerState(
    char: string,
    state: { depth: number; inString: boolean; escaping: boolean },
  ): void {
    if (state.escaping) {
      state.escaping = false;
      return;
    }

    if (char === "\\") {
      state.escaping = true;
      return;
    }

    if (char === '"') {
      state.inString = !state.inString;
      return;
    }

    if (state.inString) {
      return;
    }

    if (char === "{") {
      state.depth += 1;
    } else if (char === "}") {
      state.depth -= 1;
    }
  }

  private calculateDecisionSimilarity(
    decisionRecord: Record<string, unknown>,
    currentInput: Record<string, unknown>,
    currentServiceId: string,
    currentRouteKey: string,
  ): number {
    let similarityScore = 0;

    if (decisionRecord.serviceId === currentServiceId) similarityScore += 2;
    if (decisionRecord.routeKey === currentRouteKey) similarityScore += 2;
    if (decisionRecord.department === currentInput.department) similarityScore += 1;
    if (decisionRecord.category === currentInput.category) similarityScore += 1;

    return similarityScore;
  }

  private buildPatternSummary(
    similarDecisions: Array<{ routeKey?: unknown; serviceId?: unknown; completedAt?: unknown; createdAt?: unknown }>,
    currentRouteKey: string,
    currentServiceId: string,
    successRate: number,
  ): { commonFactors: string[]; warnings: string[] } {
    const commonFactors: string[] = [];
    const warnings: string[] = [];

    const routeKeyCount = similarDecisions.filter(d => d.routeKey === currentRouteKey).length;
    if (routeKeyCount > 1) {
      commonFactors.push(`${routeKeyCount} similar ${currentRouteKey} decisions processed`);
    }

    const serviceCount = similarDecisions.filter(d => d.serviceId === currentServiceId).length;
    if (serviceCount > 1) {
      commonFactors.push(`${serviceCount} decisions from same service`);
    }

    if (successRate >= 0.8) {
      commonFactors.push("High approval rate for similar requests");
    } else if (successRate < 0.5 && similarDecisions.length >= 3) {
      warnings.push("Similar requests have had a lower-than-average approval rate");
    }

    const avgProcessingDays = similarDecisions
      .filter(d => d.completedAt && d.createdAt)
      .map(d => (new Date(d.completedAt as Date).getTime() - new Date(d.createdAt as Date).getTime()) / (1000 * 60 * 60 * 24))
      .filter(days => days > 0);

    if (avgProcessingDays.length > 0) {
      const avgDays = Math.round(avgProcessingDays.reduce((a, b) => a + b, 0) / avgProcessingDays.length);
      const daySuffix = avgDays === 1 ? "" : "s";
      commonFactors.push(`Average processing time: ${avgDays} day${daySuffix}`);
    }

    return { commonFactors, warnings };
  }

  async generateArtifactDraft(params: {
    decision: DecisionObject;
    artifactType: string;
    outputSchemaId: string;
    outputSchemaSpec?: string;
    internalOutput?: Record<string, unknown>;
    agentOutputs?: Record<string, Record<string, unknown>>;
    enginePluginId?: string;
    abortSignal?: AbortSignal;
  }): Promise<{ status: "completed" | "skipped" | "fallback" | "error"; reason?: string; content?: Record<string, unknown>; rawResponse?: string }> {
    const { decision, artifactType, outputSchemaId, outputSchemaSpec, internalOutput, agentOutputs, enginePluginId, abortSignal } = params;
    const cfg = await this.resolveLocalConfig(decision, enginePluginId);

    if (!cfg.endpoint) {
      return { status: "skipped", reason: "No local inference endpoint configured" };
    }

    const health = await localInferenceAdapter.healthCheck(cfg.endpoint, 120000, abortSignal);
    if (!health.ok) {
      return { status: "fallback", reason: `Local inference unavailable (${health.status})` };
    }

    const prompt = this.buildArtifactPrompt({ decision, artifactType, outputSchemaId, outputSchemaSpec, internalOutput, agentOutputs });

    // Dynamic max_tokens — the model has a hard total-context cap (input + output ≤ contextWindow).
    // Hardcoding maxTokens to a static cap fails when prompts grow (HTTP 400 from vLLM).
    // Estimate tokens at ~4 chars/token (good enough for English; conservative for code/JSON
    // because we add a safety margin). Reserve 256 tokens of margin for tokenizer drift.
    const promptChars = (cfg.systemPrompt ? cfg.systemPrompt.length : 0) + prompt.length;
    const estimatedInputTokens = Math.ceil(promptChars / 4);
    const safetyMargin = 256;
    const availableOutput = cfg.contextWindow - estimatedInputTokens - safetyMargin;
    const dynamicMaxTokens = Math.max(0, Math.min(cfg.maxTokens, availableOutput));
    if (dynamicMaxTokens < 1024) {
      logger.warn(
        `[Internal Engine] Prompt too large for sovereign engine context window: ` +
        `contextWindow=${cfg.contextWindow}, estimatedInputTokens=${estimatedInputTokens}, ` +
        `availableOutput=${availableOutput}. Falling back without calling model.`
      );
      return {
        status: "fallback",
        reason: `Sovereign engine context window (${cfg.contextWindow}) cannot fit prompt (~${estimatedInputTokens} input tokens) + minimum 1024 output tokens. Use a larger-context sovereign model.`,
      };
    }
    if (dynamicMaxTokens < cfg.maxTokens) {
      logger.info(
        `[Internal Engine] Reduced max_tokens from ${cfg.maxTokens} to ${dynamicMaxTokens} ` +
        `to fit contextWindow=${cfg.contextWindow} (input≈${estimatedInputTokens})`
      );
    }

    const result = await localInferenceAdapter.generate(
      {
        endpoint: cfg.endpoint,
        model: cfg.model,
        systemPrompt: cfg.systemPrompt,
        userPrompt: prompt,
        maxTokens: dynamicMaxTokens,
        temperature: cfg.temperature,
        outputSchemaId,
      },
      cfg.timeoutMs,
      abortSignal
    );

    if (!result.ok || !result.text) {
      await this.persistRunAttestation(decision, {
        toolsUsed: ["local_inference"],
        enginePluginId: cfg.enginePluginId || undefined,
        receipt: {
          engineKind: "SOVEREIGN_INTERNAL",
          model: cfg.model,
          status: "error",
          error: result.error || "Local inference error",
        },
      });
      return { status: "fallback", reason: result.error || "Local inference error" };
    }

    const parsed = this.parseJsonObject(result.text);
    if (!parsed) {
      await this.persistRunAttestation(decision, {
        toolsUsed: ["local_inference"],
        enginePluginId: cfg.enginePluginId || undefined,
        receipt: {
          engineKind: "SOVEREIGN_INTERNAL",
          model: cfg.model,
          status: "invalid_json",
        },
      });
      return { status: "fallback", reason: "Local inference returned invalid JSON", rawResponse: result.text };
    }

    await this.persistRunAttestation(decision, {
      toolsUsed: ["local_inference"],
      enginePluginId: cfg.enginePluginId || undefined,
      receipt: {
        engineKind: "SOVEREIGN_INTERNAL",
        model: cfg.model,
        status: "ok",
      },
    });

    return { status: "completed", content: parsed, rawResponse: result.text };
  }

  async analyze(decision: DecisionObject): Promise<Record<string, unknown>> {
    const startTime = Date.now();
    
    try {
      const input = decision.input?.normalizedInput || decision.input?.rawInput;
      const shouldSkipDemandAssistRag = this.shouldSkipDemandAssistKnowledgeLookup(decision, input);

      if (shouldSkipDemandAssistRag) {
        logger.info("[Internal Engine] Using fast sovereign demand-assist analysis profile");

        const fastResult = {
          status: "completed",
          processingTimeMs: Date.now() - startTime,
          rag: {
            query: "",
            documents: [],
            totalDocuments: 0,
          },
          scoring: {
            overallScore: 60,
            dimensions: {},
          },
          entities: [],
          patterns: {
            similarDecisions: 0,
            successRate: 0,
            commonFactors: [],
          },
          documents: [],
        };

        void this.persistRunAttestation(decision, {
          toolsUsed: ["fast_demand_profile"],
          receipt: {
            engineKind: "SOVEREIGN_INTERNAL",
            processingTimeMs: fastResult.processingTimeMs,
            fastPath: "demand_assist",
          },
        }).catch((error) => {
          logger.warn("[Internal Engine] Fast demand-assist attestation failed:", error);
        });

        return fastResult;
      }
      
      const [ragResults, scoringResults, entities, patterns] = await Promise.all([
        this.runRAGPipeline(input, decision.classification?.classificationLevel),
        this.runScoringEngine(decision),
        this.extractEntities(input),
        this.findPatterns(decision),
      ]);

      // Attestation: Engine A run (internal-only)
      await this.persistRunAttestation(decision, {
        toolsUsed: ["rag", "scoring", "entities", "patterns"],
        receipt: {
          engineKind: "SOVEREIGN_INTERNAL",
          processingTimeMs: Date.now() - startTime,
          rag: {
            query: ragResults.query,
            totalDocuments: ragResults.totalDocuments,
          },
          scoring: {
            overallScore: scoringResults.overallScore,
          },
        },
      });
      
      return {
        status: "completed",
        processingTimeMs: Date.now() - startTime,
        rag: ragResults,
        scoring: scoringResults,
        entities,
        patterns,
        documents: ragResults.documents,
      };
    } catch (error) {
      logger.error("[Internal Engine] Error:", error);
      try {
        await this.persistRunAttestation(decision, {
          toolsUsed: ["rag", "scoring", "entities", "patterns"],
          receipt: {
            engineKind: "SOVEREIGN_INTERNAL",
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          },
        });
      } catch {
        // non-fatal telemetry failure
      }
      return {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  private mapClassificationLevel(level?: string): string {
    switch ((level || "").toLowerCase()) {
      case "public":
        return "PUBLIC";
      case "confidential":
        return "CONFIDENTIAL";
      case "high_sensitive":
      case "high-sensitive":
      case "highsensitive":
        return "HIGH_SENSITIVE";
      case "sovereign":
        return "SOVEREIGN";
      default:
        return "INTERNAL";
    }
  }

  private shouldSkipDemandAssistKnowledgeLookup(
    decision: DecisionObject,
    input: Record<string, unknown> | undefined,
  ): boolean {
    const decisionRecord = decision as unknown as Record<string, unknown>;
    const intake = this.asRecord(decision.input as unknown);
    const serviceId = this.asLowerString(this.firstString(decisionRecord.serviceId, intake.serviceId));
    const routeKey = this.asLowerString(this.firstString(decisionRecord.routeKey, intake.routeKey));
    const inputRecord = this.asRecord(input);
    const originalRouteKey = this.asLowerString(inputRecord.originalRouteKey);
    const inputRouteKey = this.asLowerString(inputRecord.routeKey);
    const artifactType = this.asUpperString(this.firstString(decisionRecord.artifactType, inputRecord.artifactType));

    const isDemandService = serviceId === "demand_management" || serviceId === "demand_analysis";
    const demandRouteKeys = [routeKey, inputRouteKey, originalRouteKey].filter(Boolean);
    const isDemandAssistRoute = demandRouteKeys.some((value) => value.startsWith("demand."));
    const isDemandAssistArtifact = artifactType.startsWith("DEMAND_");

    return isDemandService && (isDemandAssistRoute || isDemandAssistArtifact);
  }

  private isDemandFieldsDraftDecision(decision: DecisionObject): boolean {
    const decisionRecord = decision as unknown as Record<string, unknown>;
    const intake = this.asRecord(decision.input as unknown);
    const serviceId = this.asLowerString(this.firstString(decisionRecord.serviceId, intake.serviceId));
    const routeKey = this.asLowerString(this.firstString(decisionRecord.routeKey, intake.routeKey));
    const input = this.asRecord(decision.input?.normalizedInput || decision.input?.rawInput);
    const originalRouteKey = this.asLowerString(input.originalRouteKey);
    const artifactType = this.asUpperString(this.firstString(decisionRecord.artifactType, input.artifactType));

    const isDemandService = serviceId === "demand_management" || serviceId === "demand_analysis";

    return artifactType === "DEMAND_FIELDS"
      || (isDemandService && (routeKey === "demand.new" || routeKey === "demand.generate_fields") && originalRouteKey === "demand.generate_fields")
      || (isDemandService && routeKey === "demand.generate_fields");
  }

  private isBusinessCaseDraftDecision(decision: DecisionObject): boolean {
    const decisionRecord = decision as unknown as Record<string, unknown>;
    const intake = this.asRecord(decision.input as unknown);
    const serviceId = this.asLowerString(this.firstString(decisionRecord.serviceId, intake.serviceId));
    const routeKey = this.asLowerString(this.firstString(decisionRecord.routeKey, intake.routeKey));
    const input = this.asRecord(decision.input?.normalizedInput || decision.input?.rawInput);
    const artifactType = this.asUpperString(this.firstString(decisionRecord.artifactType, input.artifactType));
    return artifactType === "BUSINESS_CASE"
      || serviceId === "business_case"
      || routeKey === "business_case.generate";
  }

  private async persistRunAttestation(
    decision: DecisionObject,
    params: { toolsUsed: string[]; receipt?: Record<string, unknown>; enginePluginId?: string }
  ): Promise<void> {
    const classification = this.mapClassificationLevel(decision.classification?.classificationLevel);

    const allowedAgents = Array.isArray((decision as any)?.orchestration?.agentPlanPolicy?.allowedAgents) // eslint-disable-line @typescript-eslint/no-explicit-any
      ? (decision as any).orchestration.agentPlanPolicy.allowedAgents // eslint-disable-line @typescript-eslint/no-explicit-any
      : [];  
    const approvalRequired = this.asString((decision as any)?.validation?.status) === "pending"; // eslint-disable-line @typescript-eslint/no-explicit-any

    // IMPORTANT: Engine A telemetry should never be attributed to an EXTERNAL_HYBRID override.
    const resolved = await coreviaStorage.resolveEngineForDecision(decision.decisionId, "SOVEREIGN_INTERNAL");
    const engineId = params.enginePluginId
      || (resolved?.kind === "SOVEREIGN_INTERNAL" ? resolved.enginePluginId : null);

    await coreviaStorage.saveRunAttestation({
      decisionId: decision.decisionId,
      classification,
      externalBoundaryCrossed: false,
      toolsUsed: params.toolsUsed,
      policyFingerprint: this.createPolicyFingerprint(decision),
      receipt: {
        ...params.receipt,
        allowedAgents,
        approvalRequired,
      },
      enginePluginId: engineId || null,
    });
  }

  private createPolicyFingerprint(decision: DecisionObject): string | null {
    try {
      const policy = (decision as any)?.policy; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!policy) return null;
      const stable = JSON.stringify({
        result: policy.result,
        blockingPolicy: policy.blockingPolicy,
        blockReason: policy.blockReason,
        policiesEvaluated: policy.policiesEvaluated,
      });
      return createHash("sha256").update(stable).digest("hex");
    } catch {
      return null;
    }
  }

  private parseJsonObject(text: string): Record<string, unknown> | null {
    const cleaned = text.trim()
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<think>[\s\S]*$/i, "")
      .replaceAll(/```json\s*/gi, "")
      .replaceAll(/```\s*/g, "");
    if (!cleaned) return null;
    try {
      const parsed = JSON.parse(cleaned);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return parsed as Record<string, unknown>;
    } catch {
      const extracted = this.extractFirstJsonObject(cleaned);
      if (extracted) {
        try {
          const parsed = JSON.parse(extracted);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
          return parsed as Record<string, unknown>;
        } catch {
          // fall through to repair below
        }
      }
      const repaired = this.repairTruncatedJson(extracted ?? cleaned);
      if (!repaired) return null;
      try {
        const parsed = JSON.parse(repaired);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
        return parsed as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }

  /**
   * Best-effort repair of truncated JSON from local LLMs (R1-distill commonly emits
   * structurally invalid output when it hits max_tokens mid-array or mid-string).
   * Walks the string maintaining string/escape/depth state, drops any partial trailing
   * token, closes any open string, then closes any open arrays/objects in stack order.
   */
  private repairTruncatedJson(text: string): string | null {
    if (!text) return null;
    const start = text.indexOf("{");
    if (start < 0) return null;
    const body = text.slice(start);

    const stack: Array<"{" | "["> = [];
    let inString = false;
    let escaping = false;
    let lastSafeIndex = -1;

    for (let i = 0; i < body.length; i += 1) {
      const ch = body.charAt(i);
      if (inString) {
        if (escaping) {
          escaping = false;
        } else if (ch === "\\") {
          escaping = true;
        } else if (ch === '"') {
          inString = false;
          lastSafeIndex = i;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{") {
        stack.push("{");
      } else if (ch === "[") {
        stack.push("[");
      } else if (ch === "}" || ch === "]") {
        const expected = ch === "}" ? "{" : "[";
        if (stack[stack.length - 1] === expected) {
          stack.pop();
          lastSafeIndex = i;
          if (stack.length === 0) {
            return body.slice(0, i + 1);
          }
        } else {
          return null;
        }
      } else if (ch === "," || /\s/.test(ch)) {
        if (stack.length > 0) lastSafeIndex = i;
      }
    }

    if (lastSafeIndex < 0) return null;

    let truncated = body.slice(0, lastSafeIndex + 1).replace(/,\s*$/, "");
    if (inString) {
      truncated += '"';
    }
    while (stack.length > 0) {
      const opener = stack.pop();
      truncated += opener === "{" ? "}" : "]";
    }
    return truncated;
  }

  private extractFirstJsonObject(text: string): string | null {
    const start = text.indexOf("{");
    if (start < 0) return null;

    const state = { depth: 0, inString: false, escaping: false };

    for (let index = start; index < text.length; index += 1) {
      const char = text.charAt(index);

      this.advanceJsonScannerState(char, state);
      if (!state.inString && state.depth === 0) {
        return text.slice(start, index + 1);
      }
    }

    return null;
  }

  private buildArtifactPrompt(params: {
    decision: DecisionObject;
    artifactType: string;
    outputSchemaId: string;
    outputSchemaSpec?: string;
    internalOutput?: Record<string, unknown>;
    agentOutputs?: Record<string, Record<string, unknown>>;
  }): string {
    const input = this.asRecord(params.decision.input?.normalizedInput || params.decision.input?.rawInput);
    const evidence = Array.isArray((params.internalOutput as any)?.documents) ? (params.internalOutput as any).documents : []; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (params.artifactType === "DEMAND_FIELDS") {
      return this.buildDemandFieldsPrompt({
        decision: params.decision,
        outputSchemaId: params.outputSchemaId,
        input,
        outputSchemaSpec: params.outputSchemaSpec,
        agentOutputs: params.agentOutputs,
      });
    }

    // Schema is provided by Layer 5 via the orchestration contract
    const schemaInstructions = params.outputSchemaSpec || "";

    // Compress inputs for large artifacts to stay within model context limits
    const compactInput = this.compactInputForPrompt(input);
    const compactEvidence = this.compactEvidenceForPrompt(evidence);
    const compactAgentOutputs = this.compactAgentOutputsForPrompt(params.agentOutputs || {});

    return `You are Corevia Brain Engine A (Sovereign Internal). Generate a DRAFT artifact as STRICT JSON only.

ArtifactType: ${params.artifactType}
OutputSchemaId: ${params.outputSchemaId}
Classification: ${this.firstString(params.decision.classification?.classificationLevel, "internal")}

INPUT (structured):\n${compactInput}

INTERNAL EVIDENCE (summaries only):\n${compactEvidence}

AGENT OUTPUTS (structured):\n${compactAgentOutputs}
${schemaInstructions}

Rules:
- Return ONLY valid JSON. No markdown fences, no explanation.
- Use the EXACT field names from the schema above.
- Keep assumptions explicit in an "assumptions" array.
- Include a "meta" object with { generatedAt, engine: "A", confidence }.
- All string arrays must contain plain strings, not objects.`;
  }

  /**
   * Compact input data for prompts — keep essential fields, truncate large strings,
   * drop null/empty values to reduce prompt size within model context limits.
   */
  private compactInputForPrompt(input: Record<string, unknown>): string {
    const essentialKeys = [
      "projectName", "suggestedProjectName", "organizationName", "department",
      "businessObjective", "budgetRange", "requestorName", "industryType",
      "urgency", "timeline", "dataClassification", "currentChallenges",
      "existingSystems", "integrationRequirements", "complianceRequirements",
      "riskFactors", "stakeholders", "scope", "description",
    ];
    const compact: Record<string, unknown> = {};
    for (const key of essentialKeys) {
      const val = input[key];
      if (val === null || val === undefined || val === "") continue;
      if (typeof val === "string" && val.length > 400) {
        compact[key] = val.slice(0, 400) + "…";
      } else {
        compact[key] = val;
      }
    }
    // Include remaining keys but cap total
    for (const [key, val] of Object.entries(input)) {
      if (essentialKeys.includes(key) || key === "clarificationResponses") continue;
      if (val === null || val === undefined || val === "") continue;
      if (typeof val === "object") continue; // drop nested objects to save space
      if (typeof val === "string" && val.length > 200) {
        compact[key] = val.slice(0, 200) + "…";
      } else {
        compact[key] = val;
      }
    }
    return JSON.stringify(compact, null, 2);
  }

  /** Compact RAG evidence to top 3 most relevant documents, summary only. */
  private compactEvidenceForPrompt(evidence: unknown[]): string {
    if (!Array.isArray(evidence) || evidence.length === 0) return "[]";
    const top = evidence.slice(0, 3).map((doc: unknown) => {
      const d = doc as Record<string, unknown>;
      return { source: d.source || d.filename, content: typeof d.content === "string" ? d.content.slice(0, 180) : "", score: d.relevanceScore };
    });
    return JSON.stringify(top, null, 2);
  }

  /** Compact agent outputs — keep only completed agents with truncated results. */
  private compactAgentOutputsForPrompt(agentOutputs: Record<string, Record<string, unknown>>): string {
    const compact: Record<string, unknown> = {};
    for (const [agentId, output] of Object.entries(agentOutputs)) {
      if (output.status !== "completed" && output.status !== "success") continue;
      const summary: Record<string, unknown> = {
        agentName: output.agentName || agentId,
        confidence: output.confidence,
      };
      // Include result but cap its serialized size
      if (output.result) {
        const resultStr = JSON.stringify(output.result);
        if (resultStr.length > 600) {
          // Safe summarisation: never re-parse a truncated JSON string (that throws
          // SyntaxError mid-array and silently kills draft persistence in Layer 6).
          if (output.result && typeof output.result === "object" && !Array.isArray(output.result)) {
            const summarized: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(output.result as Record<string, unknown>)) {
              if (v === null || typeof v !== "object") {
                summarized[k] = v;
                continue;
              }
              const part = JSON.stringify(v);
              summarized[k] = part.length > 200
                ? `${part.slice(0, 200)}…[truncated ${part.length - 200} chars]`
                : v;
            }
            summary.result = summarized;
          } else {
            summary.result = `${resultStr.slice(0, 600)}…[truncated ${resultStr.length - 600} chars]`;
          }
        } else {
          summary.result = output.result;
        }
      }
      if (output.reasoning && typeof output.reasoning === "string") {
        summary.reasoning = output.reasoning.slice(0, 200);
      }
      compact[agentId] = summary;
    }
    return JSON.stringify(compact, null, 2);
  }

  private buildDemandFieldsPrompt(params: {
    decision: DecisionObject;
    outputSchemaId: string;
    input: Record<string, unknown>;
    outputSchemaSpec?: string;
    agentOutputs?: Record<string, Record<string, unknown>>;
  }): string {
    const classification = this.firstString(params.decision.classification?.classificationLevel, "internal");
    const objective = this.firstString(params.input.businessObjective, params.input.objective).trim();
    const organizationName = this.asString(params.input.organizationName).trim();
    const department = this.asString(params.input.department).trim();
    const urgency = this.asString(params.input.urgency).trim();
    const industryType = this.asString(params.input.industryType).trim();
    const requestorName = this.asString(params.input.requestorName).trim();
    const dataClassification = this.asString(params.input.dataClassification).trim();

    // Build rich context block from all available form fields
    const contextLines: string[] = [];
    if (organizationName) contextLines.push(`Organization Name: ${organizationName}`);
    if (department) contextLines.push(`Department: ${department}`);
    if (industryType) contextLines.push(`Industry: ${industryType}`);
    if (urgency) contextLines.push(`Urgency: ${urgency}`);
    if (requestorName) contextLines.push(`Requestor: ${requestorName}`);
    if (dataClassification && dataClassification !== "auto") contextLines.push(`Data Classification: ${dataClassification}`);
    const contextBlock = contextLines.length > 0 ? contextLines.join("\n") : "(no explicit context provided)";

    // Layer 5 schema spec — the authoritative field-level instructions
    const schemaInstructions = params.outputSchemaSpec || "";

    const completedAgentOutputs = Object.fromEntries(
      Object.entries(params.agentOutputs || {}).filter(([, v]) => v.status === "completed")
    );

    return `You are Corevia Brain Engine A — a senior government technology & strategy advisor generating precise, actionable artifacts for real organisations.

ArtifactType: DEMAND_FIELDS
OutputSchemaId: ${params.outputSchemaId}
Classification: ${classification}

--- KEY CONTEXT ---
${contextBlock}
${objective ? `Business Objective: ${objective}` : ""}

--- FULL INPUT (structured) ---
${JSON.stringify(params.input, null, 2)}

AGENT OUTPUTS (completed agents only):
${JSON.stringify(completedAgentOutputs, null, 2)}
${schemaInstructions}

CRITICAL RULES:
- Return ONLY valid JSON. No markdown fences, no explanation, no preamble.
- Use the EXACT field names from the schema above.
- All string arrays must contain plain strings, not objects.
- Include a "meta" object with { "generatedAt": "<ISO timestamp>", "engine": "A", "confidence": <0.0-1.0> }.
${organizationName ? `- ALWAYS refer to the organisation by its actual name "${organizationName}" — NEVER say "the organization" or "the entity".` : "- EXTRACT and USE the actual organisation name from the input. NEVER default to \"Government Organization\"."}
- Be SPECIFIC and ACCURATE to the actual request. Do NOT produce generic template text.
- Reference real technologies, standards, regulations, and market conditions relevant to the request.
- Tailor every field to the specific industry, sector, and jurisdiction (UAE by default).
- When generating challenges, outcomes, risks, or stakeholders, make them specific to this exact project — not boilerplate.
- If the input mentions specific systems, vendors, standards, or timelines, incorporate them precisely.
- suggestedProjectName must be an INNOVATIVE, visionary title (3-8 words) in Title Case that includes the organisation name or abbreviation. Use powerful, flagship-style action words (e.g. 'Horizon', 'Nexus', 'Catalyst', 'Vanguard', 'Atlas', 'Accelerate', 'Pinnacle'). NEVER use bland words like 'Integration', 'Implementation', 'Project', or 'System'. Make it sound like a flagship government initiative. Do NOT copy the raw objective.
- enhancedBusinessObjective must be a THOROUGH rewrite (at least 3-5 sentences) with strategic context, core problem, target beneficiaries, expected transformation, and success measurement. NEVER simply repeat user input.
- currentChallenges must describe SPECIFIC pain points referencing the actual organisation, their industry context, and specific bottlenecks — not generic governance filler.
- Budget estimates should reflect realistic UAE market rates (AED) for the described scope.
- Do not use underscores in text values (use spaces instead).
- Avoid filler values like TBD, unknown, generic, not provided.
- department should reflect the most likely operating owner within the organisation.`;
  }

  private async resolveLocalConfig(decision: DecisionObject, enginePluginId?: string): Promise<{
    endpoint: string | null;
    model: string;
    maxTokens: number;
    contextWindow: number;
    temperature: number;
    timeoutMs: number;
    systemPrompt?: string;
    enginePluginId: string | null;
  }> {
    const engine = enginePluginId
      ? await coreviaStorage.getEngine(enginePluginId)
      : await coreviaStorage.resolveEngineForDecision(decision.decisionId, "SOVEREIGN_INTERNAL");

    const config = (engine?.config || {}) as Record<string, unknown>;
    const endpoint = this.getConfigString(config, "endpoint") ?? null;
    const configuredMaxTokens = Number.isFinite(Number(config.maxTokens)) ? Math.max(256, Math.floor(Number(config.maxTokens))) : 6000;
    // Hard model context window. If absent, assume a conservative 8128 so we never exceed
    // common small-context sovereign models. Larger models (32K, 128K) MUST set this in DB.
    const contextWindow = Number.isFinite(Number(config.contextWindow)) ? Math.max(2048, Math.floor(Number(config.contextWindow))) : 8128;
    const isDemandFields = this.isDemandFieldsDraftDecision(decision);
    const isBusinessCase = this.isBusinessCaseDraftDecision(decision);
    const defaultModel = this.getConfigString(config, "model") ?? "mistral-small-3.2-24b-instruct-2506-mlx";
    const fastModel = this.getConfigString(config, "fastModel") ?? defaultModel;
    const model = isDemandFields ? fastModel : defaultModel;
    let artifactCap: number;
    if (isDemandFields) {
      artifactCap = 4000;
    } else if (isBusinessCase) {
      artifactCap = 12000;
    } else {
      artifactCap = 4000;
    }
    // The engine plugin config carries the model's hard upper bound (e.g. RunPod
    // deepseek-r1-distill-qwen-32b-awq exposes max_total_tokens=8128 and rejects
    // any larger max_tokens with HTTP 400). Treat configuredMaxTokens as the
    // model-imposed ceiling and the artifact cap as the desired ceiling. We must
    // never request more than the model accepts, even if the artifact would prefer
    // more headroom.
    const maxTokens = Math.min(artifactCap, configuredMaxTokens);
    const configuredTemperature = Number.isFinite(Number(config.temperature)) ? Math.max(0, Math.min(1, Number(config.temperature))) : 0.2;
    const temperature = isDemandFields ? Math.min(configuredTemperature, 0.2) : configuredTemperature;
    const baseTimeoutMs = Number.isFinite(Number(config.timeoutMs)) ? Math.max(1000, Math.floor(Number(config.timeoutMs))) : 20000;
    let timeoutMs: number;
    if (isDemandFields) {
      timeoutMs = Math.max(baseTimeoutMs, 90000);
    } else if (isBusinessCase) {
      timeoutMs = Math.max(baseTimeoutMs, 300000);
    } else {
      timeoutMs = baseTimeoutMs;
    }

    return {
      endpoint,
      model,
      maxTokens,
      contextWindow,
      temperature,
      timeoutMs,
      systemPrompt: isDemandFields ? undefined : this.getConfigString(config, "systemPrompt"),
      enginePluginId: engine?.enginePluginId || null,
    };
  }

  private async runRAGPipeline(
    input: Record<string, unknown> | undefined,
    classificationLevel?: string
  ): Promise<{
    query: string;
    documents: Array<{
      id: string;
      source: string;
      content: string;
      relevanceScore: number;
      documentId?: string;
      category?: string;
      filename?: string;
      accessLevel?: string;
      uploadedBy?: string;
      uploadedAt?: string;
    }>;
    totalDocuments: number;
  }> {
    if (!input) {
      return { query: "", documents: [], totalDocuments: 0 };
    }

    const query = this.buildSearchQuery(input);
    if (!query || query.length < 3) {
      return { query, documents: [], totalDocuments: 0 };
    }

    try {
      const accessLevel = this.resolveAccessLevel(classificationLevel);

      const { results: searchResults } = await ragService.enhancedSearch(
        query,
        "system",
        accessLevel,
        {
          useQueryExpansion: true,
          useConversationalMemory: false,
          useReranking: true,
        },
        8,
      );

      const documents = searchResults
        .filter(r => r.score > 0.3)
        .map(r => ({
          id: r.chunk.id,
          source: r.document.filename || "Knowledge Base",
          content: (r.chunk.content || "").substring(0, 500),
          relevanceScore: Math.round(r.score * 100),
          documentId: r.document.id,
          category: r.document.category || undefined,
          filename: r.document.filename,
          accessLevel: r.document.accessLevel,
          uploadedBy: r.document.uploadedBy,
          uploadedAt: r.document.uploadedAt ? new Date(r.document.uploadedAt).toISOString() : undefined,
        }));

      logger.info(`[Internal Engine] RAG: ${documents.length} documents found from Knowledge Centre (query: "${query.substring(0, 60)}...")`);
      
      return {
        query,
        documents,
        totalDocuments: documents.length,
      };
    } catch (error) {
      logger.warn("[Internal Engine] RAG pipeline error, falling back to empty:", error instanceof Error ? error.message : error);
      return { query, documents: [], totalDocuments: 0 };
    }
  }

  private buildSearchQuery(input: Record<string, unknown>): string {
    const parts: string[] = [];
    
    if (input.projectName) parts.push(this.truncateString(input.projectName));
    if (input.description) parts.push(this.truncateString(input.description, 200));
    if (input.objectives) parts.push(this.truncateString(input.objectives));
    if (input.businessObjective) parts.push(this.truncateString(input.businessObjective, 200));
    if (input.title) parts.push(this.truncateString(input.title));
    
    return parts.join(" ").trim();
  }

  private async runScoringEngine(
    decision: DecisionObject
  ): Promise<{
    overallScore: number;
    dimensions: Record<string, number>;
    recommendations: string[];
  }> {
    const classification = decision.classification;
    const context = decision.context;
    const input = this.asRecord(decision.input?.normalizedInput || decision.input?.rawInput);
    
    const dimensions: Record<string, number> = {
      dataQuality: context?.completenessScore || 50,
      riskProfile: this.calculateRiskScore(classification?.riskLevel),
      alignment: this.calculateAlignmentScore(input),
      feasibility: this.calculateFeasibilityScore(input, context),
      value: this.calculateValueScore(input),
    };
    
    const overallScore = Math.round(
      Object.values(dimensions).reduce((a, b) => a + b, 0) / Object.keys(dimensions).length
    );
    
    const recommendations: string[] = [];
    if ((dimensions.dataQuality ?? 0) < 70) {
      recommendations.push("Improve data quality by providing more complete information");
    }
    if ((dimensions.riskProfile ?? 0) < 50) {
      recommendations.push("Address identified risks before proceeding");
    }
    if ((dimensions.alignment ?? 0) < 60) {
      recommendations.push("Strengthen strategic alignment with organizational goals");
    }
    if ((dimensions.feasibility ?? 0) < 60) {
      recommendations.push("Review implementation feasibility and resource requirements");
    }
    
    return { overallScore, dimensions, recommendations };
  }

  private calculateAlignmentScore(input: unknown): number {
    const value = this.asRecord(input);
    if (Object.keys(value).length === 0) return 50;
    let score = 50;
    if (value.strategicObjective || value.strategicAlignment) score += 15;
    if (value.objectives || value.businessObjective) score += 10;
    if (value.stakeholders || value.sponsor) score += 10;
    if (value.kpis || value.successMetrics) score += 15;
    return Math.min(score, 100);
  }

  private calculateFeasibilityScore(input: unknown, context: unknown): number {
    const value = this.asRecord(input);
    const contextValue = this.asRecord(context);
    if (Object.keys(value).length === 0) return 50;
    let score = 60;
    if (value.timeline || value.implementationTimeline) score += 10;
    if (value.budget || value.estimatedBudget || value.requestedBudget) score += 10;
    if (value.resources || value.teamSize) score += 10;
    const completenessScore = Number(contextValue.completenessScore ?? 0);
    if (completenessScore >= 70) score += 10;
    return Math.min(score, 100);
  }

  private calculateValueScore(input: unknown): number {
    const value = this.asRecord(input);
    if (Object.keys(value).length === 0) return 50;
    let score = 55;
    if (value.expectedROI || value.estimatedROI) score += 15;
    if (value.beneficiaries || value.impactScope) score += 10;
    if (value.urgency === "high" || value.priority === "high") score += 10;
    if (value.businessObjective || value.objectives) score += 10;
    return Math.min(score, 100);
  }

  private calculateRiskScore(riskLevel?: string): number {
    const riskScores: Record<string, number> = {
      low: 90,
      medium: 70,
      high: 40,
      critical: 20,
    };
    return riskScores[riskLevel || "medium"] || 50;
  }

  private async extractEntities(
    input: Record<string, unknown> | undefined
  ): Promise<{
    organizations: string[];
    technologies: string[];
    amounts: string[];
    dates: string[];
  }> {
    if (!input) {
      return { organizations: [], technologies: [], amounts: [], dates: [] };
    }

    const text = JSON.stringify(input).toLowerCase();
    
    const organizations: string[] = [];
    const technologies: string[] = [];
    const amounts: string[] = [];
    const dates: string[] = [];
    
    amounts.push(
      ...this.collectRegexMatches(text, /(?:aed|dhs?)\s*[\d,]+(?:\.\d{2})?/gi),
      ...this.collectRegexMatches(text, /\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:million|billion|m|b)/gi),
    );
    
    const dateRegex = /\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}/g;
    const dateMatches = text.match(dateRegex);
    if (dateMatches) {
      dates.push(...dateMatches);
    }
    
    const techKeywords = ["ai", "machine learning", "blockchain", "cloud", "api", "microservices", "saas", "erp", "crm", "iot", "cybersecurity", "data analytics"];
    for (const tech of techKeywords) {
      if (text.includes(tech)) {
        technologies.push(tech);
      }
    }
    
    const orgKeywords = ["ministry", "department", "authority", "council", "office", "center", "centre"];
    for (const org of orgKeywords) {
      organizations.push(...this.collectOrganizationMatches(text, org));
    }
    
    return { organizations, technologies, amounts, dates };
  }

  private async findPatterns(
    decision: DecisionObject
  ): Promise<{
    similarDecisions: number;
    successRate: number;
    commonFactors: string[];
    warnings: string[];
  }> {
    try {
      const allDecisions = await coreviaStorage.listDecisions(100, 0);
      
      const completedDecisions = allDecisions.filter(d => 
        d.status === "completed" && d.id !== decision.decisionId
      );

      if (completedDecisions.length === 0) {
        return {
          similarDecisions: 0,
          successRate: 0,
          commonFactors: [],
          warnings: ["No historical decisions available for pattern analysis"],
        };
      }

      const currentInput = this.asRecord(decision.input?.normalizedInput || decision.input?.rawInput);
      const decisionValue = this.asRecord(decision);
      const currentServiceId = typeof decisionValue.serviceId === "string" ? decisionValue.serviceId : "";
      const currentRouteKey = typeof decisionValue.routeKey === "string" ? decisionValue.routeKey : "";

      const similarDecisions = completedDecisions.filter(d => {
        const decisionRecord = {
          serviceId: d.serviceId,
          routeKey: d.routeKey,
          ...this.asRecord(d.normalizedInput || d.inputData),
        };

        return this.calculateDecisionSimilarity(decisionRecord, currentInput, currentServiceId, currentRouteKey) >= 2;
      });

      const approvedCount = similarDecisions.filter(d => d.status === "approved" || d.status === "completed").length;

      const successRate = similarDecisions.length > 0 
        ? approvedCount / similarDecisions.length 
        : 0;

      const { commonFactors, warnings } = similarDecisions.length > 0
        ? this.buildPatternSummary(similarDecisions, currentRouteKey, currentServiceId, successRate)
        : { commonFactors: [], warnings: ["No closely matching historical decisions found"] };

      logger.info(`[Internal Engine] Patterns: ${similarDecisions.length} similar of ${completedDecisions.length} total completed`);

      return {
        similarDecisions: similarDecisions.length,
        successRate: Math.round(successRate * 100) / 100,
        commonFactors,
        warnings,
      };
    } catch (error) {
      logger.warn("[Internal Engine] Pattern matching error:", error instanceof Error ? error.message : error);
      return {
        similarDecisions: 0,
        successRate: 0,
        commonFactors: [],
        warnings: ["Pattern analysis unavailable"],
      };
    }
  }
}
