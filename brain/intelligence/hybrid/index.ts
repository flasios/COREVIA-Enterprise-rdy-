import { createHash } from "crypto";
import JSON5 from "json5";
import { DecisionObject } from "@shared/schemas/corevia/decision-object";
import Anthropic from "@anthropic-ai/sdk";
import { openaiService } from "@platform/ai/providers/openai";
import { redactionGateway } from "../redaction-gateway";
import { coreviaStorage } from "../../storage";
import { logger } from "@platform/observability";

export interface HybridAnalysisResult {
  status: "completed" | "skipped" | "fallback" | "error";
  reason?: string;
  processingTimeMs: number;
  model?: string;
  tokensUsed?: number;
  structuredAnalysis?: {
    options: Array<{
      name: string;
      description: string;
      pros: string[];
      cons: string[];
      recommendationScore: number;
    }>;
    risks: Array<{
      category: string;
      description: string;
      likelihood: "low" | "medium" | "high";
      impact: "low" | "medium" | "high" | "critical";
      mitigation: string;
    }>;
    assumptions: Array<{
      assumption: string;
      basis: string;
    }>;
    strategicAssessment: string;
    overallRecommendation: string;
    confidenceScore: number;
    successFactors: string[];
  };
  rawResponse?: string;
  analysis?: Record<string, unknown>;
}

export interface HybridArtifactDraftResult {
  status: "completed" | "skipped" | "fallback" | "error";
  reason?: string;
  processingTimeMs: number;
  model?: string;
  tokensUsed?: number;
  content?: Record<string, unknown>;
  rawResponse?: string;
}

/**
 * Hybrid Intelligence Engine (Engine #2)
 *
 * LLM-Powered Analysis (ONLY when policy allows):
 * - Structured options generation
 * - Risk analysis with mitigations
 * - Strategic assessment
 * - Confidence scoring
 *
 * INVARIANT: Only used when classification allows external models
 */
export class HybridEngine {
  private anthropic: Anthropic | null = null;
  private circuitState: Map<string, { failures: number; openedAt: number | null }> = new Map();

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY_COREVIA_ || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY_2;
    if (apiKey) {
      const anthropicTimeoutMs = Math.max(
        30_000,
        Math.min(
          900_000,
          Number(process.env.COREVIA_ANTHROPIC_TIMEOUT_MS) || 480_000,
        ),
      );
      this.anthropic = new Anthropic({
        apiKey,
        timeout: anthropicTimeoutMs,
        maxRetries: 1,
      });
      logger.info(`[Hybrid Engine] Anthropic client initialized (Engine B ready, timeout=${anthropicTimeoutMs}ms)`);
    } else {
      logger.warn("[Hybrid Engine] No Anthropic API key found — Engine B will be unavailable");
    }
  }

  async analyze(
    decision: DecisionObject,
    internalOutput?: Record<string, unknown>
  ): Promise<HybridAnalysisResult> {
    const startTime = Date.now();

    try {
      if (!decision.classification?.constraints.allowExternalModels) {
        return {
          status: "skipped",
          reason: "External models not allowed for this classification",
          processingTimeMs: Date.now() - startTime,
        };
      }

      const engine = await coreviaStorage.resolveEngineForDecision(decision.decisionId, "EXTERNAL_HYBRID");
      const engineCfg = this.getEngineConfig((engine?.config || {}) as Record<string, unknown>);

      // Never return template fallback content for high-value artifacts.
      // It's better to fail fast than persist low-quality, non-specific drafts.
      const _noTemplateFallbackArtifacts = ["BUSINESS_CASE", "TENDER_DOCUMENT", "PORTFOLIO_GATE"];

      if (engine?.enginePluginId && this.isCircuitOpen(engine.enginePluginId, engineCfg)) {
        return this.fallbackAnalysis(decision, internalOutput, startTime);
      }

      const minimizedOutput = this.minimizeInternalOutput(internalOutput);
      const prompt = this.buildStructuredPrompt(decision, minimizedOutput);
      const redactionResult = redactionGateway.redactText(prompt, true);
      await this.persistRedactionArtifacts(decision, redactionResult);

      // Mandatory airlock (even if plugin config is mis-set)
      if (engineCfg.redactionRequired !== true) {
        logger.warn("[Hybrid Engine] redactionRequired=false in engine config; enforcing redaction anyway");
      }

      const provider = await this.resolveProvider(
        engine
          ? {
              config: (engine.config || {}) as Record<string, unknown>,
            }
          : null
      );

      if (!provider) {
        return this.fallbackAnalysis(decision, internalOutput, startTime);
      }

      try {
        const result = await this.runProvider(
          provider,
          decision,
          redactionResult.redactedText,
          startTime,
          engine?.enginePluginId || undefined,
          engineCfg
        );
        if (engine?.enginePluginId) this.recordCircuitSuccess(engine.enginePluginId);
        return result;
      } catch (err) {
        if (engine?.enginePluginId) this.recordCircuitFailure(engine.enginePluginId, engineCfg);

        // Provider failover: try alternate provider before giving up
        const fallbackProvider = await this.resolveFallbackProvider(provider);
        if (fallbackProvider) {
          logger.info(`[Hybrid Engine] Primary provider ${provider} failed, trying fallback ${fallbackProvider}`);
          try {
            const result = await this.runProvider(
              fallbackProvider,
              decision,
              redactionResult.redactedText,
              startTime,
              engine?.enginePluginId || undefined,
              engineCfg
            );
            return result;
          } catch (fallbackErr) {
            logger.error(`[Hybrid Engine] Fallback provider ${fallbackProvider} also failed:`, fallbackErr);
          }
        }

        throw err;
      }
    } catch (error) {
      logger.error("[Hybrid Engine] Error:", error);
      return this.fallbackAnalysis(decision, internalOutput, startTime);
    }
  }

  async generateArtifactDraft(params: {
    decision: DecisionObject;
    artifactType: string;
    outputSchemaId: string;
    outputSchemaSpec?: string;
    internalOutput?: Record<string, unknown>;
    agentOutputs?: Record<string, Record<string, unknown>>;
    enginePluginId?: string;
  }): Promise<HybridArtifactDraftResult> {
    const startTime = Date.now();
    const { decision, artifactType, outputSchemaId, outputSchemaSpec, internalOutput, agentOutputs, enginePluginId } = params;

    try {
      if (!decision.classification?.constraints.allowExternalModels) {
        return {
          status: "skipped",
          reason: "External models not allowed for this classification",
          processingTimeMs: Date.now() - startTime,
        };
      }

      const engine = await coreviaStorage.resolveEngineForDecision(decision.decisionId, "EXTERNAL_HYBRID");
      const engineCfg = this.getEngineConfig((engine?.config || {}) as Record<string, unknown>);

      // Never return template fallback content for high-value artifacts.
      // It's better to fail fast than persist low-quality, non-specific drafts.
      const noTemplateFallbackArtifacts = ["BUSINESS_CASE", "TENDER_DOCUMENT", "PORTFOLIO_GATE"];

      if (engine?.enginePluginId && this.isCircuitOpen(engine.enginePluginId, engineCfg)) {
        if (noTemplateFallbackArtifacts.includes(artifactType)) {
          return {
            status: "error",
            reason: "Circuit breaker open",
            processingTimeMs: Date.now() - startTime,
          };
        }
        return {
          status: "fallback",
          reason: "Circuit breaker open",
          processingTimeMs: Date.now() - startTime,
          content: this.fallbackArtifactDraft(decision, artifactType, outputSchemaId, "Circuit breaker open"),
        };
      }

      const minimizedOutput = this.minimizeInternalOutput(internalOutput);
      const prompt = this.buildArtifactPrompt({ decision, artifactType, outputSchemaId, outputSchemaSpec, internalOutput: minimizedOutput, agentOutputs });
      const redactionResult = redactionGateway.redactText(prompt, true);
      await this.persistRedactionArtifacts(decision, redactionResult);

      // ── CLAUDE-ONLY MODE for high-value decision artifacts ──
      // When OpenAI is quota-limited or unavailable, we must still be able to generate business cases.
      // Governance intent: avoid low-quality template fallbacks, but do not let secondary provider issues block Claude.
      const forceClaudeArtifacts = new Set(["BUSINESS_CASE", "REQUIREMENTS", "STRATEGIC_FIT"]);
      const forceClaude = forceClaudeArtifacts.has(artifactType);

      // ── HIGH-VALUE ARTIFACTS: Dual-Provider Competitive Consensus ──
      const highValueArtifacts = ["BUSINESS_CASE", "TENDER_DOCUMENT", "PORTFOLIO_GATE"];
      if (!forceClaude && highValueArtifacts.includes(artifactType) && this.anthropic && (await openaiService.isAvailable())) {
        logger.info(`[Hybrid Engine] Using dual-provider competitive consensus for ${artifactType}`);
        try {
          const { parsed, providers } = await this.runDualProviderArtifact(
            decision,
            redactionResult.redactedText,
            enginePluginId || engine?.enginePluginId || undefined,
            engineCfg,
          );
          return {
            status: "completed",
            processingTimeMs: Date.now() - startTime,
            content: parsed,
            model: `dual(${providers.join("+")})`,
          };
        } catch (dualErr) {
          logger.warn(`[Hybrid Engine] Dual-provider failed for ${artifactType}, falling back to single-provider:`, (dualErr as Error).message);
          // Fall through to single-provider path
        }
      }

      if (forceClaude) {
        if (!this.anthropic) {
          return {
            status: "error",
            reason: "Claude-only generation requested but Anthropic is not configured (missing ANTHROPIC_API_KEY)",
            processingTimeMs: Date.now() - startTime,
          };
        }
        logger.info(`[Hybrid Engine] Provider forced to Claude (anthropic) for ${artifactType}`);

        const raw = await this.runArtifactProvider(
          "anthropic",
          decision,
          redactionResult.redactedText,
          enginePluginId || engine?.enginePluginId || undefined,
          engineCfg,
        );

        let parsed = raw ? this.parseJsonObject(raw) : null;
        let finalRaw = raw;
        // One retry with stricter formatting instructions if Claude returned mixed content.
        if (!parsed) {
          const strictPrompt = `${redactionResult.redactedText}\n\nIMPORTANT: Return ONLY a single valid JSON object. No markdown. No commentary. No code fences.`;
          const rawRetry = await this.runArtifactProvider(
            "anthropic",
            decision,
            strictPrompt,
            enginePluginId || engine?.enginePluginId || undefined,
            engineCfg,
          );
          const parsedRetry = rawRetry ? this.parseJsonObject(rawRetry) : null;
          if (parsedRetry) {
            parsed = parsedRetry;
            finalRaw = rawRetry;
          }
        }
        if (!parsed) {
          return {
            status: "error",
            reason: "Claude response was not valid JSON",
            processingTimeMs: Date.now() - startTime,
            rawResponse: finalRaw,
          };
        }

        return {
          status: "completed",
          processingTimeMs: Date.now() - startTime,
          content: parsed,
          model: "anthropic",
          rawResponse: finalRaw,
        };
      }

      const provider = await this.resolveProvider(
        engine
          ? {
              config: (engine.config || {}) as Record<string, unknown>,
            }
          : null
      );

      if (!provider) {
        if (noTemplateFallbackArtifacts.includes(artifactType)) {
          return {
            status: "error",
            reason: "No external provider available",
            processingTimeMs: Date.now() - startTime,
          };
        }
        return {
          status: "fallback",
          reason: "No external provider available",
          processingTimeMs: Date.now() - startTime,
          content: this.fallbackArtifactDraft(decision, artifactType, outputSchemaId, "No external provider available"),
        };
      }

      let raw = "";
      const maxRetries = 2;
      let lastError: unknown = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          raw = await this.runArtifactProvider(
            provider,
            decision,
            redactionResult.redactedText,
            enginePluginId || engine?.enginePluginId || undefined,
            engineCfg
          );
          if (engine?.enginePluginId) this.recordCircuitSuccess(engine.enginePluginId);
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          const status = (err as Record<string, unknown>)?.status || (err as Record<string, unknown>)?.statusCode || 0;
          const isRetryable = status === 529 || status === 503 || status === 502 || status === 500
            || (err instanceof Error && /overloaded|rate.?limit|timeout|econnreset/i.test(err.message));

          if (isRetryable && attempt < maxRetries) {
            const delay = Math.min(2000 * Math.pow(2, attempt), 8000);
            logger.info(`[Hybrid Engine] Provider returned ${status || 'transient error'}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          if (engine?.enginePluginId) this.recordCircuitFailure(engine.enginePluginId, engineCfg);

          // Provider failover for artifact draft
          const fallbackProvider = await this.resolveFallbackProvider(provider);
          if (fallbackProvider) {
            logger.info(`[Hybrid Engine] Artifact draft: primary ${provider} failed, trying fallback ${fallbackProvider}`);
            try {
              raw = await this.runArtifactProvider(
                fallbackProvider,
                decision,
                redactionResult.redactedText,
                enginePluginId || engine?.enginePluginId || undefined,
                engineCfg
              );
              lastError = null;
              break;
            } catch (fallbackErr) {
              logger.error(`[Hybrid Engine] Artifact draft: fallback ${fallbackProvider} also failed:`, fallbackErr);
              throw err;
            }
          } else {
            throw err;
          }
        }
      }

      if (lastError) {
        throw lastError;
      }

      const parsed = this.parseJsonObject(raw);
      if (!parsed) {
        logger.warn(`[Hybrid Engine] JSON parse failed for ${artifactType}. Raw response (first 300 chars):`, raw?.substring(0, 300));
        if (noTemplateFallbackArtifacts.includes(artifactType)) {
          return {
            status: "error",
            reason: "Provider response was not valid JSON",
            processingTimeMs: Date.now() - startTime,
            rawResponse: raw,
          };
        }
        return {
          status: "fallback",
          reason: "Provider response was not valid JSON",
          processingTimeMs: Date.now() - startTime,
          rawResponse: raw,
          content: this.fallbackArtifactDraft(decision, artifactType, outputSchemaId, "Provider response was not valid JSON", agentOutputs),
        };
      }

      return {
        status: "completed",
        processingTimeMs: Date.now() - startTime,
        content: parsed,
        rawResponse: raw,
      };
    } catch (error) {
      logger.error("[Hybrid Engine] Artifact draft error:", error);
      const noTemplateFallbackArtifacts = ["BUSINESS_CASE", "TENDER_DOCUMENT", "PORTFOLIO_GATE"];
      if (noTemplateFallbackArtifacts.includes(artifactType)) {
        return {
          status: "error",
          reason: error instanceof Error ? error.message : "Unknown error",
          processingTimeMs: Date.now() - startTime,
        };
      }
      return {
        status: "fallback",
        reason: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: Date.now() - startTime,
        content: this.fallbackArtifactDraft(decision, artifactType, outputSchemaId, undefined, agentOutputs),
      };
    }
  }

  private buildArtifactPrompt(params: {
    decision: DecisionObject;
    artifactType: string;
    outputSchemaId: string;
    outputSchemaSpec?: string;
    internalOutput?: Record<string, unknown>;
    agentOutputs?: Record<string, Record<string, unknown>>;
  }): string {
    const { decision, artifactType, outputSchemaId, outputSchemaSpec, internalOutput, agentOutputs } = params;
    const input = (decision.input?.normalizedInput || decision.input?.rawInput || {}) as Record<string, unknown>;
    const evidence = Array.isArray(internalOutput?.documents) ? (internalOutput as Record<string, unknown>).documents : [];

    // Schema is provided by Layer 5 via the orchestration contract
    const schemaInstructions = outputSchemaSpec || "";

    // Extract key context fields for explicit prompt instructions
    const orgName = String(input.organizationName || input.organization || '').trim();
    const deptName = String(input.department || '').trim();
    const requestorName = String(input.requestorName || '').trim();
    const businessObjective = String(input.businessObjective || input.description || '').trim();

    const contextBlock = [
      orgName ? `Organization Name: ${orgName}` : null,
      deptName ? `Department: ${deptName}` : null,
      requestorName ? `Requestor: ${requestorName}` : null,
      businessObjective ? `Business Objective: ${businessObjective}` : null,
    ].filter(Boolean).join('\n');

    return `You are Corevia Brain Engine B — a senior government technology & strategy advisor generating precise, actionable artifacts for real organisations.

ArtifactType: ${artifactType}
OutputSchemaId: ${outputSchemaId}
Classification: ${(decision.classification?.classificationLevel || "internal").toString()}

--- KEY CONTEXT ---
${contextBlock || '(no explicit context provided)'}

--- FULL INPUT (structured) ---
${JSON.stringify(input, null, 2)}

INTERNAL EVIDENCE (summaries only):
${JSON.stringify(evidence, null, 2)}

AGENT OUTPUTS (completed agents only):
${JSON.stringify(
  Object.fromEntries(
    Object.entries(agentOutputs || {}).filter(([, v]) => v.status === "completed")
  ),
  null, 2
)}
${schemaInstructions}

CRITICAL RULES:
- Return ONLY valid JSON. No markdown fences, no explanation.
- Use the EXACT field names from the schema above.
- All string arrays must contain plain strings, not objects.
- Include a "meta" object with { generatedAt, engine: "B", confidence }.
${orgName ? `- ALWAYS refer to the organisation by its actual name "${orgName}" — NEVER say "the organization" or "the entity".` : ''}
- Be SPECIFIC and ACCURATE to the actual request. Do NOT produce generic template text.
- Reference real technologies, standards, regulations, and market conditions relevant to the request.
- Tailor every field to the specific industry, sector, and jurisdiction (UAE by default).
- When generating challenges, outcomes, risks, or stakeholders, make them specific to this exact project — not boilerplate.
- If the input mentions specific systems, vendors, standards, or timelines, incorporate them precisely.
`;
  }

  private async runArtifactProvider(
    provider: "openai" | "anthropic",
    decision: DecisionObject,
    redactedPrompt: string,
    enginePluginId?: string,
    engineCfg?: {
      model: string;
      maxTokens: number;
      temperature: number;
      redactionRequired: boolean;
      circuitBreaker: { failureThreshold: number; cooldownSeconds: number };
    }
  ): Promise<string> {
    const cfg = engineCfg || this.getEngineConfig({});
    if (provider === "anthropic") {
      if (!this.anthropic) throw new Error("Anthropic not configured");

      const response = await this.anthropic.messages.create({
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        temperature: cfg.temperature,
        messages: [{ role: "user", content: redactedPrompt }],
        system: this.getSystemPrompt(),
      });

      const content = response.content[0];
      const text = content?.type === "text" ? content.text : "";

      await this.persistRunAttestation(decision, {
        model: cfg.model,
        tokensUsed: response.usage?.input_tokens || 0,
        toolsUsed: ["anthropic"],
        enginePluginId,
      });

      return text;
    }

    const text = await openaiService.generateText({
      systemPrompt: this.getSystemPrompt(),
      messages: [{ role: "user", content: redactedPrompt }],
      maxTokens: cfg.maxTokens,
    });

    await this.persistRunAttestation(decision, {
      model: cfg.model,
      tokensUsed: 0,
      toolsUsed: ["openai"],
      enginePluginId,
    });

    return text || "";
  }

  /**
   * COMPETITIVE CONSENSUS — Fire Claude AND GPT-5 in parallel for high-value artifacts.
   * GPT-5 uses response_format: json_object (guaranteed valid JSON).
   * Returns the best merged result, or whichever provider succeeded.
   */
  private async runDualProviderArtifact(
    decision: DecisionObject,
    redactedPrompt: string,
    enginePluginId: string | undefined,
    engineCfg: {
      model: string;
      maxTokens: number;
      temperature: number;
      redactionRequired: boolean;
      circuitBreaker: { failureThreshold: number; cooldownSeconds: number };
    },
  ): Promise<{ raw: string; parsed: Record<string, unknown>; providers: string[] }> {
    const systemPrompt = this.getSystemPrompt();

    // Fire both providers in parallel
    const claudePromise = this.anthropic
      ? this.anthropic.messages
          .create({
            model: engineCfg.model,
            max_tokens: engineCfg.maxTokens,
            temperature: engineCfg.temperature,
            messages: [{ role: "user", content: redactedPrompt }],
            system: systemPrompt,
          })
          .then((r) => {
            const c = r.content[0];
            return c?.type === "text" ? c.text : "";
          })
          .catch((err) => {
            logger.warn("[Hybrid Engine] Claude arm failed:", (err as Error).message || err);
            return null;
          })
      : Promise.resolve(null);

    const openaiPromise = openaiService
      .isAvailable()
      .then((ok) => {
        if (!ok) return null;
        return openaiService.generateText({
          systemPrompt,
          messages: [{ role: "user", content: redactedPrompt }],
          maxTokens: engineCfg.maxTokens,
          jsonMode: true,               // GPT-5 guaranteed JSON
        });
      })
      .catch((err) => {
        logger.warn("[Hybrid Engine] OpenAI arm failed:", (err as Error).message || err);
        return null;
      });

    const [claudeRaw, openaiRaw] = await Promise.all([claudePromise, openaiPromise]);

    // Persist attestation for both
    const toolsUsed: string[] = [];
    if (claudeRaw !== null) toolsUsed.push("anthropic");
    if (openaiRaw !== null) toolsUsed.push("openai");
    await this.persistRunAttestation(decision, {
      model: `dual(${engineCfg.model}+gpt-5)`,
      tokensUsed: 0,
      toolsUsed,
      enginePluginId,
    });

    const claudeParsed = claudeRaw ? this.parseJsonObject(claudeRaw) : null;
    const openaiParsed = openaiRaw ? this.parseJsonObject(openaiRaw) : null;

    logger.info(
      `[Hybrid Engine] Dual-provider results — Claude: ${claudeParsed ? "OK" : "fail"}, OpenAI: ${openaiParsed ? "OK" : "fail"}`,
    );

    if (claudeParsed && openaiParsed) {
      // Both succeeded — merge sections taking the richer content from each
      const merged = this.mergeArtifactSections(claudeParsed, openaiParsed);
      return { raw: claudeRaw || "", parsed: merged, providers: ["anthropic", "openai"] };
    }

    if (claudeParsed) {
      return { raw: claudeRaw || "", parsed: claudeParsed, providers: ["anthropic"] };
    }

    if (openaiParsed) {
      return { raw: openaiRaw || "", parsed: openaiParsed, providers: ["openai"] };
    }

    // Both failed — caller will use enriched fallback
    throw new Error("Both Claude and OpenAI failed to produce valid JSON");
  }

  /**
   * Smart section merger — picks the richer / more complete value for each key.
   * Primary = Claude (stronger prose), Secondary = OpenAI (guaranteed-JSON, structured).
   */
  private mergeArtifactSections(
    primary: Record<string, unknown>,
    secondary: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...primary };

    for (const key of Object.keys(secondary)) {
      const pVal = primary[key];
      const sVal = secondary[key];

      // Skip meta — we build our own
      if (key === "meta") continue;

      // If primary is empty/missing but secondary has content
      if (this.sectionRichness(sVal) > this.sectionRichness(pVal)) {
        merged[key] = sVal;
      }
    }

    // Tag the merge in meta
    const meta = (primary.meta || secondary.meta || {}) as Record<string, unknown>;
    merged.meta = {
      ...meta,
      engine: "B",
      dualProvider: true,
      mergedFrom: ["anthropic", "openai"],
      generatedAt: new Date().toISOString(),
    };

    return merged;
  }

  /** Score how "rich" a value is — deeper/longer = higher score */
  private sectionRichness(val: unknown): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === "string") return val.trim().length;
    if (typeof val === "number") return val === 0 ? 0 : 1;
    if (typeof val === "boolean") return val ? 1 : 0;
    if (Array.isArray(val)) {
      if (val.length === 0) return 0;
      return val.reduce((sum: number, item) => sum + Math.max(1, this.sectionRichness(item)), 0);
    }
    if (typeof val === "object") {
      const entries = Object.entries(val as Record<string, unknown>);
      if (entries.length === 0) return 0;
      return entries.reduce((sum, [, v]) => sum + this.sectionRichness(v), 0);
    }
    return 0;
  }

  private parseJsonObject(text: string): Record<string, unknown> | null {
    if (!text || typeof text !== "string") return null;
    let cleaned = text.trim();

    // Strip markdown code fences (```json ... ``` or ``` ... ```) when they wrap the whole payload
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

    const tryParseObject = (candidate: string): Record<string, unknown> | null => {
      const s = (candidate || "").trim();
      if (!s) return null;
      try {
        const parsed = JSON.parse(s);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
        return parsed as Record<string, unknown>;
      } catch {
        // Try to repair common JSON issues: trailing commas, unquoted keys
        try {
          const repaired = s
            .replace(/,\s*([}\]])/g, "$1")
            .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
          const parsed = JSON.parse(repaired);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
          return parsed as Record<string, unknown>;
        } catch {
          // Last resort: JSON5 is more permissive (single quotes, trailing commas, etc.)
          try {
            const parsed = JSON5.parse(s) as unknown;
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
            return parsed as Record<string, unknown>;
          } catch {
            try {
              const repaired = s
                .replace(/,\s*([}\]])/g, "$1")
                .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
              const parsed = JSON5.parse(repaired) as unknown;
              if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
              return parsed as Record<string, unknown>;
            } catch {
              return null;
            }
          }
        }
      }
    };

    const extractFirstBalancedJsonObject = (input: string): string | null => {
      const src = (input || "").trim();
      if (!src) return null;

      let inString = false;
      let stringQuote: '"' | "'" | null = null;
      let escaped = false;

      for (let start = 0; start < src.length; start += 1) {
        if (src[start] !== "{") continue;

        let depth = 0;
        inString = false;
        stringQuote = null;
        escaped = false;

        for (let i = start; i < src.length; i += 1) {
          const ch = src[i];

          if (escaped) {
            escaped = false;
            continue;
          }

          if (inString) {
            if (ch === "\\") {
              escaped = true;
              continue;
            }
            if (stringQuote && ch === stringQuote) {
              inString = false;
              stringQuote = null;
            }
            continue;
          }

          if (ch === '"' || ch === "'") {
            inString = true;
            stringQuote = ch as '"' | "'";
            continue;
          }

          if (ch === "{") depth += 1;
          if (ch === "}") depth -= 1;

          if (depth === 0) {
            return src.slice(start, i + 1);
          }
        }
      }

      return null;
    };

    // Claude sometimes returns extra prose before/after the JSON, or multiple JSON
    // objects (e.g. a small sample followed by the real artifact). Collect every
    // top-level balanced JSON object and pick the one with the most keys — this
    // prevents losing a rich artifact because a tiny preface object was emitted first.
    const extractAllBalancedJsonObjects = (input: string): string[] => {
      const src = (input || "").trim();
      if (!src) return [];
      const out: string[] = [];
      let i = 0;
      while (i < src.length) {
        if (src[i] !== "{") {
          i += 1;
          continue;
        }
        const remainder = src.slice(i);
        const next = extractFirstBalancedJsonObject(remainder);
        if (!next) break;
        out.push(next);
        i += next.length;
      }
      return out;
    };

    const allBalanced = extractAllBalancedJsonObjects(cleaned);
    if (allBalanced.length > 0) {
      const parsedCandidates = allBalanced
        .map((candidate) => tryParseObject(candidate))
        .filter((parsed): parsed is Record<string, unknown> => parsed !== null);
      if (parsedCandidates.length > 0) {
        parsedCandidates.sort((a, b) => Object.keys(b).length - Object.keys(a).length);
        return parsedCandidates[0] ?? null;
      }
    }

    // Fallback: try to parse the entire cleaned string directly.
    return tryParseObject(cleaned);
  }

  private fallbackArtifactDraft(
    decision: DecisionObject,
    artifactType: string,
    outputSchemaId: string,
    fallbackReason?: string,
    agentOutputs?: Record<string, Record<string, unknown>>,
  ): Record<string, unknown> {
    const input = (decision.input?.normalizedInput || decision.input?.rawInput || {}) as Record<string, unknown>;

    if (artifactType === "ASSISTANT_TOOL_PLAN") {
      return {
        artifactType,
        toolCalls: [],
        guidance: "fallback",
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "ASSISTANT_RESPONSE") {
      const userMessage = String(input.userMessage || input.message || input.prompt || "");
      return {
        artifactType,
        response: userMessage
          ? "Right — I can help with that. What would you like me to check first?"
          : "Right — what would you like me to check today?",
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "RAG_QUERY_EXPANSION") {
      const q = String(input.query || input.promptSeed || input.original || "");
      return {
        artifactType,
        original: q,
        variations: q ? [q] : [],
        keywords: [],
        governmentTerms: [],
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "RAG_QUERY_REWRITE") {
      const q = String(input.query || input.original || "");
      return {
        artifactType,
        original: q,
        rewritten: q,
        expansions: [],
        intent: String(input.intent || "exploratory"),
        subQueries: [],
        confidence: 0.5,
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "RAG_CLASSIFICATION") {
      return {
        artifactType,
        domains: ["general"],
        confidence: 0.5,
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "RAG_RERANK") {
      return {
        artifactType,
        scores: [],
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "RAG_CONFLICT") {
      return {
        artifactType,
        sentiment: { score: 0.5, label: "neutral" },
        hasContradiction: false,
        severity: "low",
        description: "",
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "RAG_SYNTHESIS_SUMMARY") {
      return {
        artifactType,
        summary: "",
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "RAG_ANSWER") {
      return {
        artifactType,
        content: "",
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "DEMAND_FIELDS") {
      const objective = String(input.businessObjective || input.description || "");
      const title = String(input.projectName || input.suggestedProjectName || input.title || "Untitled");
      return {
        artifactType,
        enhancedBusinessObjective: objective,
        suggestedProjectName: title,
        expectedOutcomes: [],
        successCriteria: [],
        timeframe: "",
        stakeholders: [],
        riskFactors: [],
        constraints: [],
        integrationRequirements: [],
        complianceRequirements: [],
        requestType: "demand",
        classificationConfidence: 0,
        classificationReasoning: "fallback",
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "BUSINESS_CASE") {
      const title = String(input.projectName || input.suggestedProjectName || input.title || "Untitled");
      const objective = String(input.businessObjective || input.description || "");
      const orgName = String(input.organizationName || input.organization || "").trim();
      const department = String(input.department || "General");
      const budgetRange = String(input.budgetRange || "");
      const orgLabel = orgName || "The requesting entity";

      // Extract agent analysis data when available
      const financialAgent = agentOutputs?.financial_assist?.result as Record<string, unknown> | undefined;
      const riskAgent = agentOutputs?.risk_controls?.result as Record<string, unknown> | undefined;
      const complianceAgent = agentOutputs?.controls?.result as Record<string, unknown> | undefined;
      const alignmentAgent = agentOutputs?.alignment_scoring?.result as Record<string, unknown> | undefined;
      const marketAgent = agentOutputs?.market_research?.result as Record<string, unknown> | undefined;
      const projectManagerAgent = agentOutputs?.project_manager?.result as Record<string, unknown> | undefined;
      const wbsAgent = agentOutputs?.wbs_builder?.result as Record<string, unknown> | undefined;
      const dependencyAgent = agentOutputs?.dependency_agent?.result as Record<string, unknown> | undefined;
      const resourceRoleAgent = agentOutputs?.resource_role?.result as Record<string, unknown> | undefined;

      // Financial data from agent
      const totalCost = (financialAgent?.totalInvestment as number) || 0;
      const totalBenefits = (financialAgent?.totalBenefits as number) || 0;
      const npv = (financialAgent?.npv as number) || 0;
      const roi = (financialAgent?.roi as number) || 0;
      const payback = (financialAgent?.paybackPeriod as number) || 0;
      const investmentGrade = (financialAgent?.investmentGrade as string) || "";
      const scenarios = financialAgent?.scenarios as Record<string, Record<string, unknown>> | undefined;

      // Risk data from agent
      const identifiedRisks = Array.isArray(riskAgent?.identifiedRisks)
        ? (riskAgent.identifiedRisks as Array<Record<string, unknown>>).map(r => ({
            category: String(r.category || "General"),
            description: String(r.description || ""),
            likelihood: String(r.likelihood || "medium"),
            impact: String(r.impact || "medium"),
            mitigation: String(r.mitigation || ""),
          }))
        : [];

      // Compliance data from agent
      const complianceScore = (complianceAgent?.complianceScore as number) || 0;
      const complianceIssues = Array.isArray(complianceAgent?.issues) ? complianceAgent.issues as string[] : [];
      const complianceReqs = Array.isArray(complianceAgent?.applicableRegulations) ? complianceAgent.applicableRegulations as string[] : [];

      // Strategic alignment from agent
      const overallAlignment = (alignmentAgent?.overallAlignment as number) || 0;
      const _alignmentGrade = (alignmentAgent?.alignmentGrade as string) || "";
      const visionAlignment = alignmentAgent?.visionAlignment as Record<string, string> | undefined;

      const hasAgentData = totalCost > 0 || identifiedRisks.length > 0 || complianceScore > 0 || overallAlignment > 0;

      return {
        artifactType,
        projectTitle: title,
        executiveSummary: hasAgentData
          ? `${orgLabel} proposes ${title} to ${objective ? objective.substring(0, 300) : "achieve its strategic objectives"}. Financial analysis indicates an NPV of ${npv.toLocaleString()} AED with ${roi}% ROI over a ${payback}-year payback period (${investmentGrade || "moderate"} investment grade). Strategic alignment score: ${overallAlignment}%. Compliance status: ${complianceScore}% across regulatory dimensions.`
          : `Business case for ${title}. ${objective ? objective.substring(0, 500) : "Detailed analysis pending."}`,
        backgroundContext: `${orgLabel} is pursuing ${title} within the ${department} department. ${objective || ""}`,
        problemStatement: objective || "Business problem statement pending detailed analysis.",
        businessRequirements: objective ? `Key requirements derived from: ${objective.substring(0, 800)}` : "",
        solutionOverview: marketAgent
          ? `Technology readiness: ${(marketAgent.technologyReadiness as Record<string, unknown>)?.level || "TRL-7"}. Market adoption: ${(marketAgent.technologyReadiness as Record<string, unknown>)?.adoptionRate || "Early Majority"}. ${Array.isArray(marketAgent.recommendations) ? (marketAgent.recommendations as string[]).slice(0, 2).join(". ") : ""}`
          : "",
        proposedSolution: "",
        alternativeSolutions: [],
        smartObjectives: [{ objective: objective || title, specific: objective || "", measurable: roi > 0 ? `Target ROI: ${roi}%, Payback: ${payback} years` : "KPIs to be defined", achievable: overallAlignment > 70 ? `Strategic alignment: ${overallAlignment}%` : "Within organizational capacity", relevant: visionAlignment?.uaeVision2031 === "ALIGNED" ? "Aligned with UAE Vision 2031" : "Aligned with strategic objectives", timeBound: payback > 0 ? `${payback}-year investment horizon` : "Timeline to be determined" }],
        scopeDefinition: {
          inScope: [
            `End-to-end implementation of ${title}`,
            `Requirements analysis and solution design for ${department} department`,
            `Technology platform selection, procurement, and deployment`,
            `Integration with existing ${orgLabel} systems and workflows`,
            `User training, change management, and knowledge transfer`,
            `Post-deployment support and performance monitoring (12 months)`,
          ],
          outOfScope: [
            `Organizational restructuring beyond ${department} department`,
            `Legacy system decommissioning not directly replaced by this initiative`,
            `Third-party vendor contract renegotiations outside project scope`,
            `Infrastructure upgrades not specifically required for this implementation`,
          ],
          deliverables: [
            `Solution architecture and technical design documentation`,
            `Configured and tested ${title} platform`,
            `Data migration and integration framework`,
            `User training materials and change management plan`,
            `Go-live support and post-implementation review report`,
          ],
          constraints: [
            ...(budgetRange ? [`Budget constrained to ${budgetRange}`] : totalCost > 0 ? [`Budget constrained to ${totalCost.toLocaleString()} AED`] : []),
            `Must comply with UAE government IT governance and security standards`,
            `Implementation must minimize disruption to ongoing ${department} operations`,
            `All data must remain within UAE sovereign data centers`,
          ],
          assumptions: [
            `${orgLabel} will provide dedicated project stakeholders and subject matter experts`,
            `Existing IT infrastructure meets minimum requirements for the proposed solution`,
            `Required government approvals and procurement processes will follow standard timelines`,
            `End users will be available for training during the designated training period`,
          ],
        },
        benefits: [
          { name: "Operational Efficiency", type: "productivity", description: `Streamlined ${department} processes through automation and digitization`, value: totalBenefits > 0 ? Math.round(totalBenefits * 0.4) : null, unit: "AED", timeline: "Year 1-2", owner: department },
          { name: "Cost Reduction", type: "cost_savings", description: `Reduced manual effort and operational overhead in ${department}`, value: totalBenefits > 0 ? Math.round(totalBenefits * 0.3) : null, unit: "AED", timeline: "Year 2-3", owner: department },
          { name: "Strategic Value", type: "strategic", description: `Enhanced ${orgLabel} capabilities aligned with national digital transformation goals`, value: null, unit: null, timeline: "Year 1-5", owner: null },
          { name: "Risk Reduction", type: "risk_reduction", description: `Improved compliance, security, and audit readiness`, value: totalBenefits > 0 ? Math.round(totalBenefits * 0.15) : null, unit: "AED", timeline: "Year 1-3", owner: null },
        ],
        detailedBenefits: [
          { name: "Process Automation", type: "productivity", description: `Automation of key workflows within ${department}, reducing manual processing time by an estimated 40-60%`, value: totalBenefits > 0 ? Math.round(totalBenefits * 0.25) : null, unit: "AED", timeline: "Year 1", owner: department },
          { name: "Data-Driven Decision Making", type: "strategic", description: `Real-time analytics and reporting capabilities enabling evidence-based decisions`, value: null, unit: null, timeline: "Year 1-2", owner: null },
          { name: "Improved Service Delivery", type: "revenue", description: `Enhanced service quality and response times for stakeholders`, value: totalBenefits > 0 ? Math.round(totalBenefits * 0.15) : null, unit: "AED", timeline: "Year 2-3", owner: department },
        ],
        totalCostEstimate: totalCost,
        totalBenefitEstimate: totalBenefits,
        roiPercentage: roi,
        npvValue: npv,
        paybackMonths: payback * 12,
        discountRate: 8,
        riskLevel: identifiedRisks.length > 3 ? "high" : identifiedRisks.length > 1 ? "medium" : "low",
        riskScore: identifiedRisks.length > 3 ? 70 : identifiedRisks.length > 1 ? 50 : 30,
        identifiedRisks,
        implementationPhases: Array.isArray(projectManagerAgent?.implementationPhases)
          ? projectManagerAgent.implementationPhases as Array<Record<string, unknown>>
          : Array.isArray(wbsAgent?.implementationPhases)
          ? wbsAgent.implementationPhases as Array<Record<string, unknown>>
          : financialAgent?.implementationCosts
          ? [
              { phase: "Phase 1: Setup & Foundation", cost: (financialAgent.implementationCosts as Record<string, number>).phase1_setup || 0, duration: "Months 1-4" },
              { phase: "Phase 2: Core Deployment", cost: (financialAgent.implementationCosts as Record<string, number>).phase2_deployment || 0, duration: "Months 5-10" },
              { phase: "Phase 3: Optimization", cost: (financialAgent.implementationCosts as Record<string, number>).phase3_optimization || 0, duration: "Months 11-14" },
            ]
          : [
              { name: "Initiation & Planning", description: `Requirements gathering, stakeholder alignment, and detailed project planning for ${title}`, durationMonths: 2, deliverables: ["Project charter", "Detailed requirements document", "Solution architecture"], tasks: ["Stakeholder workshops", "Requirements analysis", "Vendor evaluation"], owner: department, status: "pending" },
              { name: "Design & Procurement", description: `Technical design, vendor selection, and procurement execution`, durationMonths: 3, deliverables: ["Technical design document", "Procurement award", "Integration specifications"], tasks: ["Solution design", "RFP/tender process", "Contract negotiation"], owner: department, status: "pending" },
              { name: "Build & Configure", description: `Platform configuration, customization, data migration, and integration development`, durationMonths: 4, deliverables: ["Configured platform", "Data migration scripts", "Integration interfaces"], tasks: ["Platform setup", "Data migration", "Integration development", "UAT preparation"], owner: department, status: "pending" },
              { name: "Test & Train", description: `User acceptance testing, training delivery, and go-live preparation`, durationMonths: 2, deliverables: ["UAT sign-off", "Training completion certificates", "Go-live checklist"], tasks: ["UAT execution", "User training", "Change management"], owner: department, status: "pending" },
              { name: "Go-Live & Support", description: `Production deployment, hypercare support, and post-implementation review`, durationMonths: 3, deliverables: ["Production deployment", "Post-implementation review", "Lessons learned report"], tasks: ["Go-live execution", "Hypercare support", "Performance monitoring"], owner: department, status: "pending" },
            ],
        milestones: Array.isArray(projectManagerAgent?.milestones)
          ? projectManagerAgent.milestones as Array<Record<string, unknown>>
          : [
          { name: "Project Kickoff", date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split("T")[0], status: "pending", deliverables: ["Approved project charter"], owner: department },
          { name: "Requirements Approved", date: new Date(Date.now() + 90*24*60*60*1000).toISOString().split("T")[0], status: "pending", deliverables: ["Signed-off requirements"], owner: department },
          { name: "Solution Design Complete", date: new Date(Date.now() + 150*24*60*60*1000).toISOString().split("T")[0], status: "pending", deliverables: ["Approved design document"], owner: department },
          { name: "UAT Sign-off", date: new Date(Date.now() + 300*24*60*60*1000).toISOString().split("T")[0], status: "pending", deliverables: ["UAT completion report"], owner: department },
          { name: "Go-Live", date: new Date(Date.now() + 365*24*60*60*1000).toISOString().split("T")[0], status: "pending", deliverables: ["Production deployment confirmation"], owner: department },
        ],
        dependencies: Array.isArray(projectManagerAgent?.dependencies)
          ? projectManagerAgent.dependencies as Array<Record<string, unknown>>
          : Array.isArray(dependencyAgent?.dependencies)
          ? dependencyAgent.dependencies as Array<Record<string, unknown>>
          : [
          { name: "IT Infrastructure Readiness", description: `Required infrastructure upgrades and network connectivity for ${title}`, type: "internal", status: "pending", impact: "Critical path - blocks deployment phase", owner: "IT Department" },
          { name: "Stakeholder Availability", description: `Key stakeholders from ${department} available for workshops, UAT, and training`, type: "internal", status: "pending", impact: "Delays to requirements and testing phases", owner: department },
          { name: "Procurement Approval", description: `Government procurement and vendor selection process completion`, type: "internal", status: "pending", impact: "Blocks build phase commencement", owner: "Procurement" },
        ],
        resourceRequirements: projectManagerAgent?.resourceRequirements
          ? projectManagerAgent.resourceRequirements as Record<string, unknown>
          : resourceRoleAgent?.resourceRequirements
          ? resourceRoleAgent.resourceRequirements as Record<string, unknown>
          : {
          internalTeam: { roles: ["Project Manager", "Business Analyst", "Solution Architect", "Change Manager", "Subject Matter Experts"], effort: "14-month implementation" },
          externalSupport: { expertise: ["Implementation Partner", "Technical Consultant", "Training Specialist"], estimatedCost: budgetRange || (totalCost > 0 ? `${totalCost.toLocaleString()} AED` : "To be determined") },
          infrastructure: ["Cloud hosting environment (UAE data centers)", "Development and staging environments", "Integration middleware", "Security and monitoring tools"],
        },
        strategicObjectives: alignmentAgent?.dimensions
          ? Object.entries(alignmentAgent.dimensions as Record<string, Record<string, unknown>>).map(([dim, data]) => ({
              dimension: dim.replace(/([A-Z])/g, " $1").trim(),
              score: Math.round(((data.score as number) || 0) * 100),
              rationale: (data.rationale as string) || "",
            }))
          : [],
        complianceRequirements: complianceReqs,
        complianceScore: complianceScore,
        complianceIssues: complianceIssues,
        kpis: [
          ...(roi > 0 ? [
            { name: "Return on Investment", target: `${roi}%`, measurement: "Financial analysis" },
            { name: "Net Present Value", target: `${npv.toLocaleString()} AED`, measurement: "Discounted cash flow" },
            { name: "Payback Period", target: `${payback} years`, measurement: "Cumulative cash flow" },
          ] : []),
          { name: "Project Delivery On-Time", target: "≥90% milestone adherence", measurement: "Project schedule tracking" },
          { name: "User Adoption Rate", target: "≥80% within 6 months of go-live", measurement: "Active user analytics" },
          { name: "Process Efficiency Gain", target: "≥30% reduction in processing time", measurement: "Before/after time studies" },
          { name: "System Availability", target: "≥99.5% uptime SLA", measurement: "Infrastructure monitoring" },
        ],
        successCriteria: [
          { criterion: "Solution fully deployed and operational in production", target: "Go-live achieved within approved timeline" },
          { criterion: "All critical business processes migrated and functional", target: "100% process coverage verified" },
          { criterion: "End users trained and actively using the system", target: ">80% adoption rate within 6 months" },
          { criterion: "Data migrated with verified integrity", target: "Zero critical data discrepancies post-migration" },
          { criterion: "Post-implementation review completed with positive assessment", target: "Stakeholder satisfaction >4/5" },
        ],
        stakeholderAnalysis: {
          stakeholders: [
            { name: "Project Sponsor", role: "Executive Sponsor", influence: "high", interest: "high", department: "Senior Leadership", engagementStrategy: "Regular steering committee updates and escalation path" },
            { name: `${department} Director`, role: "Business Owner", influence: "high", interest: "high", department, engagementStrategy: "Weekly progress meetings and requirement sign-off authority" },
            { name: "IT Department Lead", role: "Technical Authority", influence: "high", interest: "medium", department: "Information Technology", engagementStrategy: "Architecture review board participation and technical governance" },
            { name: "End Users", role: "System Users", influence: "low", interest: "high", department, engagementStrategy: "Change management communications, training sessions, and feedback channels" },
            { name: "Procurement Office", role: "Procurement Authority", influence: "medium", interest: "medium", department: "Procurement", engagementStrategy: "Procurement process alignment and vendor evaluation support" },
          ],
          analysis: `Stakeholder landscape spans executive sponsors, ${department} operational teams, IT governance, procurement, and end users. Engagement priority focuses on maintaining executive support while ensuring end-user adoption through structured change management.`,
          engagementStrategy: "Multi-channel engagement: steering committee (monthly), working group (weekly), all-hands updates (quarterly), training program (phased rollout)",
        },
        keyAssumptions: [
          { name: "Executive Sponsorship", description: `Continued active executive sponsorship and strategic prioritization of ${title}`, impact: "High", confidence: "high", owner: "Project Sponsor", status: "active" },
          { name: "Resource Availability", description: `${orgLabel} will allocate dedicated staff for requirements, testing, and training`, impact: "High", confidence: "medium", owner: department, status: "active" },
          { name: "Technology Maturity", description: "Selected technology platform is proven and stable for government-scale deployments", impact: "Medium", confidence: "high", owner: "IT Department", status: "active" },
          { name: "Regulatory Stability", description: "No significant regulatory changes affecting project scope during implementation", impact: "Medium", confidence: "medium", owner: "Compliance", status: "active" },
          { name: "Integration Feasibility", description: "Existing systems have documented APIs or can be integrated within planned effort", impact: "High", confidence: "medium", owner: "IT Department", status: "active" },
        ],
        projectDependencies: { dependencies: [] },
        financialScenarios: scenarios || {},
        recommendations: {
          primaryRecommendation: npv > 0 ? "INVEST" : "REVIEW",
          summary: investmentGrade ? `Investment grade: ${investmentGrade}. ${npv > 0 ? "Positive NPV supports investment." : "Further analysis recommended."}` : "",
          justification: "",
          keyFindings: [
            ...(npv > 0 ? [`Positive NPV of ${npv.toLocaleString()} AED`] : []),
            ...(roi > 15 ? [`Strong ROI of ${roi}%`] : []),
            ...(overallAlignment > 70 ? [`Strategic alignment at ${overallAlignment}%`] : []),
            ...(complianceScore > 80 ? [`Compliance score: ${complianceScore}%`] : []),
            ...(identifiedRisks.length > 0 ? [`${identifiedRisks.length} risks identified with mitigations`] : []),
          ],
          nextSteps: [
            "Secure executive approval and budget allocation",
            "Initiate procurement process for technology platform and implementation partner",
            "Establish project governance structure and assign dedicated project team",
            "Conduct detailed requirements workshops with key stakeholders",
            "Develop detailed project plan with milestones, deliverables, and risk mitigations",
          ],
        },
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: hasAgentData ? 0.55 : 0.3,
          fallback: true,
          fallbackReason: fallbackReason || "No external provider available",
          agentDataAvailable: hasAgentData,
        },
      };
    }

    if (artifactType === "BUSINESS_CASE_CLARIFICATIONS") {
      return {
        artifactType,
        clarifications: [],
        completenessScore: 0,
        needsClarifications: false,
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "DEMAND_OBJECTIVE_ENHANCEMENT") {
      const objective = String(input.objective || input.businessObjective || input.description || "");
      return {
        artifactType,
        enhancedObjective: objective,
        improvements: ["fallback"],
        clarityScore: 5,
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "DEMAND_REQUEST_CLASSIFICATION") {
      return {
        artifactType,
        requestType: "demand",
        confidence: 0.3,
        reasoning: "fallback",
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "DEMAND_COMPREHENSIVE_ANALYSIS") {
      return {
        artifactType,
        requestId: String(input.id || input.requestId || ""),
        analysisTypes: {
          complaintAnalysis: {},
          demandAnalysis: {},
          imsAnalysis: {},
          innovationOpportunities: {},
        },
        generatedAt: new Date().toISOString(),
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "DOCUMENT_CLASSIFICATION") {
      return {
        artifactType,
        category: { primary: "General Administration", confidence: 0.3, alternatives: [] },
        tags: [],
        language: { detected: "English", confidence: 0.5, isMultilingual: false },
        documentType: { type: "Document", subtype: "", confidence: 0.3 },
        summary: "",
        keyEntities: [],
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "DOCUMENT_SUMMARY") {
      return {
        artifactType,
        summary: "",
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "MARKET_RESEARCH") {
      const title = String(input.projectName || input.projectTitle || input.title || "Untitled");
      return {
        artifactType,
        projectContext: { focusArea: title, keyObjectives: [], targetCapabilities: [] },
        globalMarket: { marketSize: "", growthRate: "", keyTrends: [], topCountries: [], majorPlayers: [], technologyLandscape: [] },
        uaeMarket: { marketSize: "", growthRate: "", governmentInitiatives: [], localPlayers: [], opportunities: [], regulatoryConsiderations: [] },
        suppliers: [],
        useCases: [],
        competitiveAnalysis: { directCompetitors: [], indirectCompetitors: [], marketGaps: [] },
        recommendations: [],
        riskFactors: [],
        generatedAt: new Date().toISOString(),
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "VALIDATION_ASSIST") {
      return {
        artifactType,
        output: "",
        corrections: [],
        consistency: { hasContradictions: false, contradictions: [] },
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "REASONING_TRACE") {
      return {
        artifactType,
        answer: "",
        reasoningTrace: {
          id: `trace_${Date.now()}`,
          query: String(input.query || input.intent || ""),
          model: "external_fallback",
          steps: [],
          finalAnswer: "",
          totalTokens: 0,
          durationMs: 0,
          timestamp: new Date().toISOString(),
        },
        confidence: 0.3,
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "VENDOR_EVALUATION_SCORES") {
      return {
        artifactType,
        scores: [],
        overallStrengths: [],
        overallWeaknesses: [],
        riskFactors: [],
        recommendation: "",
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "VENDOR_EVALUATION_SUMMARY") {
      return {
        artifactType,
        executiveSummary: "",
        topRecommendation: "",
        differentiators: [],
        concerns: [],
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "RISK_EVIDENCE_VERIFICATION") {
      return {
        artifactType,
        overallScore: 0,
        relevanceScore: 0,
        completenessScore: 0,
        qualityScore: 0,
        verdict: "INSUFFICIENT",
        findings: [],
        recommendations: [],
        riskFlags: [],
        mitigationAlignment: "LOW",
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "EVIDENCE_EVALUATION") {
      return {
        artifactType,
        completenessScore: 0,
        qualityScore: 0,
        relevanceScore: 0,
        overallScore: 0,
        findings: [],
        recommendations: [],
        riskFlags: [],
        complianceNotes: [],
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "TASK_COMPLETION_GUIDANCE") {
      return {
        artifactType,
        taskSnapshot: {},
        strategicInsights: [],
        completionScore: 0,
        nextActions: [],
        riskAlerts: [],
        enablementToolkit: [],
        accelerationPlaybook: [],
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "TRANSLATION") {
      const text = String(input.text || "");
      return {
        artifactType,
        translatedText: text,
        originalText: text,
        from: String(input.from || ""),
        to: String(input.to || ""),
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "VENDOR_PROPOSAL_SUMMARY") {
      const excerpt = String(input.proposalTextExcerpt || input.extractedText || "");
      return {
        artifactType,
        summary: excerpt ? `${excerpt.substring(0, 1200)}${excerpt.length > 1200 ? "…" : ""}` : "",
        highlights: [],
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "KNOWLEDGE_GRAPH_EXTRACTION") {
      return {
        artifactType,
        entities: [],
        relationships: [],
        documentId: String(input.documentId || ""),
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "EXECUTIVE_BRIEFING") {
      return {
        artifactType,
        executiveSummary: "",
        keyFindings: [],
        trends: [],
        recommendations: [],
        riskAlerts: [],
        confidenceScore: 0.3,
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "KNOWLEDGE_GAP_ANALYSIS") {
      return {
        artifactType,
        gapAnalysis: [],
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "PROACTIVE_INSIGHTS") {
      return {
        artifactType,
        insights: [],
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "VERSION_IMPACT_ANALYSIS") {
      return {
        artifactType,
        summary: "AI impact analysis unavailable (fallback)",
        impact: "",
        risk: "low",
        recommendations: [],
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "DAILY_INTELLIGENCE_BRIEFING") {
      return {
        artifactType,
        summary: "",
        criticalAlerts: [],
        topRisks: [],
        recommendations: [],
        actionItems: [],
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    if (artifactType === "TEAM_RECOMMENDATION") {
      return {
        artifactType,
        summary: {
          totalRoles: 0,
          totalHeadcount: 0,
          totalFTEMonths: 0,
          criticalRoles: 0,
          resourceGaps: 0,
          overallReadiness: "needs_attention",
        },
        teamStructure: {
          leadership: [],
          core: [],
          support: [],
          external: [],
          equipment: [],
        },
        resourceGaps: [],
        recommendations: {
          immediate: [],
          shortTerm: [],
          contingency: [],
        },
        riskAssessment: {
          overallRisk: "medium",
          factors: [],
        },
        meta: {
          outputSchemaId,
          generatedAt: new Date().toISOString(),
          engine: "B",
          confidence: 0.3,
          fallback: true,
        },
      };
    }

    const title = String(input.projectName || input.suggestedProjectName || input.title || "Untitled");
    const objective = String(input.businessObjective || input.description || "");
    return {
      artifactType,
      title,
      objective,
      assumptions: ["Generated via fallback draft (no external provider available)"] ,
      meta: {
        outputSchemaId,
        generatedAt: new Date().toISOString(),
        engine: "B",
        confidence: 0.3,
        fallback: true,
        fallbackReason: fallbackReason || "No external provider available",
      },
    };
  }

  private async resolveProvider(engine: { config?: Record<string, unknown> } | null): Promise<"openai" | "anthropic" | null> {
    const configured = String((engine?.config as Record<string, unknown> | undefined)?.provider || "").toLowerCase();

    if (configured === "openai") {
      return (await openaiService.isAvailable()) ? "openai" : null;
    }

    if (configured === "anthropic") {
      return this.anthropic ? "anthropic" : null;
    }

    if (this.anthropic) {
      return "anthropic";
    }

    return (await openaiService.isAvailable()) ? "openai" : null;
  }

  /**
   * Resolve the alternate provider for failover.
   * If the primary was anthropic, returns openai (if available), and vice-versa.
   */
  private async resolveFallbackProvider(failedProvider: "openai" | "anthropic"): Promise<"openai" | "anthropic" | null> {
    if (failedProvider === "anthropic") {
      return (await openaiService.isAvailable()) ? "openai" : null;
    }
    return this.anthropic ? "anthropic" : null;
  }

  private async runProvider(
    provider: "openai" | "anthropic",
    decision: DecisionObject,
    redactedPrompt: string,
    startTime: number,
    enginePluginId?: string,
    engineCfg?: {
      model: string;
      maxTokens: number;
      temperature: number;
      redactionRequired: boolean;
      circuitBreaker: { failureThreshold: number; cooldownSeconds: number };
    }
  ): Promise<HybridAnalysisResult> {
    const cfg = engineCfg || this.getEngineConfig({});
    if (provider === "anthropic") {
      if (!this.anthropic) {
        throw new Error("Anthropic not configured");
      }

      const response = await this.anthropic.messages.create({
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        temperature: cfg.temperature,
        messages: [
          {
            role: "user",
            content: redactedPrompt,
          },
        ],
        system: this.getSystemPrompt(),
      });

      const content = response.content[0];
      const analysisText = content?.type === "text" ? content.text : "";
      const structuredAnalysis = this.parseStructuredAnalysis(analysisText);

      logger.info(`[Hybrid Engine] (${provider}) Analysis complete: ${structuredAnalysis.options.length} options, ${structuredAnalysis.risks.length} risks, confidence: ${structuredAnalysis.confidenceScore}`);

      await this.persistRunAttestation(decision, {
        model: cfg.model,
        tokensUsed: response.usage?.input_tokens || 0,
        toolsUsed: ["anthropic"],
        enginePluginId,
      });

      return {
        status: "completed",
        processingTimeMs: Date.now() - startTime,
        model: cfg.model,
        structuredAnalysis,
        rawResponse: analysisText,
        tokensUsed: response.usage?.input_tokens || 0,
      };
    }

    const analysisText = await openaiService.generateText({
      systemPrompt: this.getSystemPrompt(),
      messages: [{ role: "user", content: redactedPrompt }],
      maxTokens: cfg.maxTokens,
    });

    const structuredAnalysis = this.parseStructuredAnalysis(analysisText || "");

    logger.info(`[Hybrid Engine] (${provider}) Analysis complete: ${structuredAnalysis.options.length} options, ${structuredAnalysis.risks.length} risks, confidence: ${structuredAnalysis.confidenceScore}`);

    await this.persistRunAttestation(decision, {
      model: cfg.model,
      tokensUsed: 0,
      toolsUsed: ["openai"],
      enginePluginId,
    });

    return {
      status: "completed",
      processingTimeMs: Date.now() - startTime,
      model: cfg.model,
      structuredAnalysis,
      rawResponse: analysisText,
      tokensUsed: 0,
    };
  }

  private getEngineConfig(configRaw: Record<string, unknown>): {
    model: string;
    maxTokens: number;
    temperature: number;
    redactionRequired: boolean;
    circuitBreaker: { failureThreshold: number; cooldownSeconds: number };
  } {
    const provider = typeof configRaw.provider === "string" ? String(configRaw.provider).toLowerCase() : "auto";
    const defaultModel = provider === "openai" ? "gpt-5" : "claude-sonnet-4-20250514";
    const model = typeof configRaw.model === "string" && configRaw.model.trim().length > 0
      ? String(configRaw.model)
      : defaultModel;

    const defaultMaxTokensEnv = Number(process.env.COREVIA_HYBRID_MAX_TOKENS);
    const defaultMaxTokens = Number.isFinite(defaultMaxTokensEnv) && defaultMaxTokensEnv > 0
      ? Math.floor(defaultMaxTokensEnv)
      : 16000;
    const maxTokensNum = Number(configRaw.maxTokens ?? configRaw.max_tokens ?? defaultMaxTokens);
    const maxTokens = Number.isFinite(maxTokensNum) && maxTokensNum > 0 ? Math.floor(maxTokensNum) : defaultMaxTokens;

    const temperatureNum = Number(configRaw.temperature ?? 0.3);
    const temperature = Number.isFinite(temperatureNum) ? Math.max(0, Math.min(1, temperatureNum)) : 0.3;

    const redactionRequired = configRaw.redactionRequired === undefined ? true : Boolean(configRaw.redactionRequired);

    const cb = (typeof configRaw.circuitBreaker === "object" && configRaw.circuitBreaker !== null)
      ? (configRaw.circuitBreaker as Record<string, unknown>)
      : {} as Record<string, unknown>;
    const failureThresholdNum = Number(cb.failureThreshold ?? 5);
    const cooldownSecondsNum = Number(cb.cooldownSeconds ?? 60);

    return {
      model,
      maxTokens,
      temperature,
      redactionRequired,
      circuitBreaker: {
        failureThreshold: Number.isFinite(failureThresholdNum) ? Math.max(1, Math.floor(failureThresholdNum)) : 5,
        cooldownSeconds: Number.isFinite(cooldownSecondsNum) ? Math.max(1, Math.floor(cooldownSecondsNum)) : 60,
      },
    };
  }

  private isCircuitOpen(enginePluginId: string, cfg: { circuitBreaker: { cooldownSeconds: number } }): boolean {
    const state = this.circuitState.get(enginePluginId);
    if (!state?.openedAt) return false;
    return Date.now() - state.openedAt < cfg.circuitBreaker.cooldownSeconds * 1000;
  }

  private recordCircuitSuccess(enginePluginId: string): void {
    this.circuitState.set(enginePluginId, { failures: 0, openedAt: null });
  }

  private recordCircuitFailure(enginePluginId: string, cfg: { circuitBreaker: { failureThreshold: number } }): void {
    const state = this.circuitState.get(enginePluginId) || { failures: 0, openedAt: null };
    const failures = state.failures + 1;
    const openedAt = failures >= cfg.circuitBreaker.failureThreshold ? Date.now() : state.openedAt;
    this.circuitState.set(enginePluginId, { failures, openedAt });
  }

  private minimizeInternalOutput(internalOutput?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!internalOutput) return undefined;
    const documents = Array.isArray(internalOutput.documents)
      ? (internalOutput.documents as Record<string, unknown>[]).map((doc) => ({
          source: doc.source,
          relevanceScore: doc.relevanceScore,
          category: doc.category,
          filename: doc.filename,
        }))
      : undefined;

    return {
      ...internalOutput,
      documents,
    };
  }

  private mapClassificationLevel(level?: string): string {
    switch ((level || "").toLowerCase()) {
      case "public":
        return "PUBLIC";
      case "confidential":
        return "CONFIDENTIAL";
      case "sovereign":
        return "SOVEREIGN";
      default:
        return "INTERNAL";
    }
  }

  private createPolicyFingerprint(decision: DecisionObject): string | null {
    if (!decision.policy?.policiesEvaluated?.length) return null;
    const payload = JSON.stringify({
      policiesEvaluated: decision.policy.policiesEvaluated,
      blockingPolicy: decision.policy.blockingPolicy,
      blockReason: decision.policy.blockReason,
    });
    return createHash("sha256").update(payload).digest("hex");
  }

  private async persistRedactionArtifacts(
    decision: DecisionObject,
    redactionResult: { maskingApplied: boolean; minimizationApplied: boolean; outboundManifest: Record<string, unknown> }
  ): Promise<void> {
    await coreviaStorage.saveRedactionReceipt({
      decisionId: decision.decisionId,
      classification: this.mapClassificationLevel(decision.classification?.classificationLevel),
      maskingApplied: redactionResult.maskingApplied,
      minimizationApplied: redactionResult.minimizationApplied,
      outboundManifest: redactionResult.outboundManifest,
      tokenizationMapRef: null,
    });
  }

  private async persistRunAttestation(
    decision: DecisionObject,
    params: { model: string; tokensUsed: number; toolsUsed: string[]; enginePluginId?: string }
  ): Promise<void> {
    const allowedAgents = Array.isArray(decision.orchestration?.agentPlanPolicy?.allowedAgents)
      ? decision.orchestration.agentPlanPolicy.allowedAgents
      : [];
    const approvalRequired = String(decision.validation?.status || "") === "pending";

    await coreviaStorage.saveRunAttestation({
      decisionId: decision.decisionId,
      classification: this.mapClassificationLevel(decision.classification?.classificationLevel),
      externalBoundaryCrossed: true,
      toolsUsed: params.toolsUsed,
      policyFingerprint: this.createPolicyFingerprint(decision) || undefined,
      receipt: {
        model: params.model,
        tokensUsed: params.tokensUsed,
        allowedAgents,
        approvalRequired,
      },
      enginePluginId: params.enginePluginId || undefined,
    });
  }

  private getSystemPrompt(): string {
    return `You are an expert government technology and strategy advisor producing precise, evidence-based analyses for UAE government digital transformation initiatives.

CRITICAL: You must be SPECIFIC and ACCURATE. Never use generic filler text. Always reference:
- The actual organisation name provided in the input (never say "the organization")
- Real UAE regulations, standards, and frameworks (e.g., UAE Vision 2031, TDRA standards, NESA compliance)
- Genuine technology platforms, vendors, and integration standards
- Realistic budget figures in AED based on UAE market rates
- Actual stakeholder roles relevant to the specific sector

Your task is to produce a STRUCTURED analysis. You MUST respond with valid JSON only — no markdown, no explanation outside the JSON.

The JSON object must have these exact fields:
{
  "options": [
    {
      "name": "Option Name",
      "description": "Brief description",
      "pros": ["pro1", "pro2"],
      "cons": ["con1", "con2"],
      "recommendationScore": 0-100
    }
  ],
  "risks": [
    {
      "category": "Technical|Resource|Financial|Compliance|Operational|Strategic",
      "description": "Risk description",
      "likelihood": "low|medium|high",
      "impact": "low|medium|high|critical",
      "mitigation": "How to mitigate"
    }
  ],
  "assumptions": [
    {
      "assumption": "What is assumed",
      "basis": "Why this assumption was made"
    }
  ],
  "strategicAssessment": "How this aligns with government objectives",
  "overallRecommendation": "Clear recommendation statement",
  "confidenceScore": 0-100,
  "successFactors": ["factor1", "factor2"]
}

Rules:
- Generate 3-4 implementation options, ranked by recommendationScore
- Identify 3-6 specific risks relevant to this proposal
- List 2-4 key assumptions
- Confidence score reflects how confident you are in the recommendation given the data quality
- Be specific to the actual project details, not generic
- Consider UAE government context, Vision 2031, and digital transformation priorities`;
  }

  private buildStructuredPrompt(
    decision: DecisionObject,
    internalOutput?: Record<string, unknown>
  ): string {
    const input = decision.input?.normalizedInput || decision.input?.rawInput;
    const classification = decision.classification;
    const context = decision.context;

    const inputRec = ((input || {}) as Record<string, unknown>);
    const projectName = inputRec.projectName || inputRec.title || "Unnamed Project";
    const description = inputRec.description || "No description provided";
    const objectives = inputRec.objectives || inputRec.businessObjective || "";
    const budget = inputRec.estimatedBudget || inputRec.budget || inputRec.requestedBudget || "Not specified";
    const timeline = inputRec.timeline || inputRec.implementationTimeline || "Not specified";
    const department = inputRec.department || inputRec.organizationUnit || "Not specified";
    const stakeholders = inputRec.stakeholders || "";
    const expectedROI = inputRec.expectedROI || inputRec.estimatedROI || "";

    let prompt = `Analyze this government project proposal and return structured JSON:

### Project Information
- Name: ${projectName}
- Description: ${description}
- Objectives: ${objectives}
- Department: ${department}
- Estimated Budget: ${budget}
- Timeline: ${timeline}
- Expected ROI: ${expectedROI}
- Stakeholders: ${stakeholders}

### Classification
- Level: ${classification?.classificationLevel || "Not classified"}
- Sector: ${classification?.sector || "Not specified"}
- Risk Level: ${classification?.riskLevel || "Not assessed"}

### Data Quality
- Completeness: ${context?.completenessScore || 0}%
- Ambiguity: ${context?.ambiguityScore || 0}%
`;

    if (context?.assumptions?.length) {
      prompt += `\n### System-Identified Assumptions\n`;
      for (const assumption of context.assumptions) {
        prompt += `- ${assumption.field}: ${assumption.assumedValue} (${assumption.reason})\n`;
      }
    }

    if (internalOutput?.scoring) {
      const scoring = internalOutput.scoring as Record<string, unknown>;
      prompt += `\n### Internal Analysis Scores\n`;
      prompt += `- Overall Score: ${scoring.overallScore}%\n`;
      if (scoring.dimensions) {
        for (const [dim, score] of Object.entries(scoring.dimensions)) {
          prompt += `- ${dim}: ${score}%\n`;
        }
      }
      if ((scoring.recommendations as unknown[] | undefined)?.length) {
        prompt += `- Internal Recommendations: ${(scoring.recommendations as string[]).join("; ")}\n`;
      }
    }

    if (internalOutput?.patterns) {
      const patterns = internalOutput.patterns as Record<string, unknown>;
      prompt += `\n### Historical Patterns\n`;
      prompt += `- Similar Decisions Found: ${patterns.similarDecisions}\n`;
      prompt += `- Historical Success Rate: ${Math.round((patterns.successRate as number) * 100)}%\n`;
      if ((patterns.commonFactors as unknown[] | undefined)?.length) {
        prompt += `- Common Factors: ${(patterns.commonFactors as string[]).join("; ")}\n`;
      }
      if ((patterns.warnings as unknown[] | undefined)?.length) {
        prompt += `- Warnings: ${(patterns.warnings as string[]).join("; ")}\n`;
      }
    }

    if (internalOutput?.documents && Array.isArray(internalOutput.documents) && (internalOutput.documents as unknown[]).length > 0) {
      prompt += `\n### Relevant Knowledge Base Documents\n`;
      for (const doc of (internalOutput.documents as unknown[]).slice(0, 5) as Array<Record<string, unknown>>) {
        prompt += `- [${doc.source}] (relevance: ${doc.relevanceScore}%): ${(doc.content as string)?.substring(0, 200)}\n`;
      }
    }

    prompt += `\nProvide your analysis as valid JSON only.`;

    return prompt;
  }

  private parseStructuredAnalysis(response: string): NonNullable<HybridAnalysisResult["structuredAnalysis"]> {
    const defaults: NonNullable<HybridAnalysisResult["structuredAnalysis"]> = {
      options: [],
      risks: [],
      assumptions: [],
      strategicAssessment: "",
      overallRecommendation: "",
      confidenceScore: 50,
      successFactors: [],
    };

    try {
      let jsonStr = response.trim();

      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1]!.trim();
      }

      const firstBrace = jsonStr.indexOf("{");
      const lastBrace = jsonStr.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
      }

      const parsed = JSON.parse(jsonStr);

      const options = Array.isArray(parsed.options)
        ? parsed.options.map((o: Record<string, unknown>) => ({
            name: String(o.name || "Option"),
            description: String(o.description || ""),
            pros: Array.isArray(o.pros) ? (o.pros as unknown[]).map(String) : [],
            cons: Array.isArray(o.cons) ? (o.cons as unknown[]).map(String) : [],
            recommendationScore: Math.min(100, Math.max(0, Number(o.recommendationScore) || 50)),
          }))
        : [];

      const validLikelihood = ["low", "medium", "high"];
      const validImpact = ["low", "medium", "high", "critical"];

      const risks = Array.isArray(parsed.risks)
        ? parsed.risks.map((r: Record<string, unknown>) => ({
            category: String(r.category || "General"),
            description: String(r.description || ""),
            likelihood: validLikelihood.includes(r.likelihood as string) ? r.likelihood as string : "medium",
            impact: validImpact.includes(r.impact as string) ? r.impact as string : "medium",
            mitigation: String(r.mitigation || ""),
          }))
        : [];

      const assumptions = Array.isArray(parsed.assumptions)
        ? parsed.assumptions.map((a: Record<string, unknown>) => ({
            assumption: String(a.assumption || ""),
            basis: String(a.basis || ""),
          }))
        : [];

      return {
        options,
        risks,
        assumptions,
        strategicAssessment: String(parsed.strategicAssessment || ""),
        overallRecommendation: String(parsed.overallRecommendation || ""),
        confidenceScore: Math.min(100, Math.max(0, Number(parsed.confidenceScore) || 50)),
        successFactors: Array.isArray(parsed.successFactors) ? parsed.successFactors.map(String) : [],
      };
    } catch (error) {
      logger.warn("[Hybrid Engine] Failed to parse structured JSON, extracting from text:", error instanceof Error ? error.message : error);
      return this.extractFromUnstructuredText(response, defaults);
    }
  }

  private extractFromUnstructuredText(
    response: string,
    defaults: NonNullable<HybridAnalysisResult["structuredAnalysis"]>
  ): NonNullable<HybridAnalysisResult["structuredAnalysis"]> {
    const sections: Record<string, string> = {};

    const sectionPatterns = [
      { key: "strategicAssessment", pattern: /strategic assessment[:\s]*([\s\S]+?)(?=\n\n|\d\.|risk analysis|implementation|success|overall|$)/i },
      { key: "overallRecommendation", pattern: /overall recommendation[:\s]*([\s\S]+?)$/i },
    ];

    for (const { key, pattern } of sectionPatterns) {
      const match = response.match(pattern);
      if (match) {
        sections[key] = match[1]!.trim();
      }
    }

    let confidenceScore = 60;
    const scoreMatch = response.match(/(\d+)(?:%|\s*percent)/);
    if (scoreMatch) {
      confidenceScore = Math.min(100, Math.max(0, parseInt(scoreMatch[1]!, 10)));
    }

    return {
      ...defaults,
      strategicAssessment: sections.strategicAssessment || "Analysis based on available data indicates potential alignment with strategic objectives.",
      overallRecommendation: sections.overallRecommendation || "Further structured analysis recommended.",
      confidenceScore,
    };
  }

  private fallbackAnalysis(
    decision: DecisionObject,
    internalOutput: Record<string, unknown> | undefined,
    startTime: number
  ): HybridAnalysisResult {
    const classification = decision.classification;
    const context = decision.context;
    const input = (decision.input?.normalizedInput || decision.input?.rawInput) as Record<string, unknown> | undefined;
    const scoring = (internalOutput?.scoring as Record<string, unknown>) || {};
    const projectName = String(input?.projectName || input?.title || "Project");
    const completeness = context?.completenessScore || 50;

    const dept = String(input?.department || "");
    const objective = String(input?.businessObjective || input?.description || "");
    const urgency = String(input?.urgency || "Medium");
    const budget = String(input?.estimatedBudget || input?.budgetRange || "");
    const riskLevel = classification?.riskLevel || "medium";
    const isHighUrgency = ["Critical", "High", "critical", "high"].includes(urgency);
    const isLowCompleteness = completeness < 50;
    const deptLabel = dept ? ` within ${dept}` : "";
    const budgetLabel = budget ? ` (Est. budget: ${budget})` : "";
    const objSnippet = objective.length > 80 ? objective.substring(0, 80) + "..." : objective;

    const options = [
      {
        name: `Full-Scale ${projectName} Deployment`,
        description: `Approve ${projectName}${deptLabel} for complete implementation${budgetLabel}, addressing: ${objSnippet}`,
        pros: [
          `Directly addresses the stated objective for ${projectName}`,
          isHighUrgency ? "Meets the high-urgency timeline requirement" : "Delivers full value within standard timeline",
        ],
        cons: [
          budget ? `Full budget commitment of ${budget} required upfront` : "Full resource allocation required from the start",
          riskLevel === "high" ? "Higher integration risk due to project complexity" : "Standard integration complexity to manage",
        ],
        recommendationScore: completeness >= 70 ? 80 : 65,
      },
      {
        name: `Phased ${projectName} Rollout`,
        description: `Deploy ${projectName} in controlled phases${deptLabel} — pilot first, then scale`,
        pros: [
          `Validates ${projectName} approach before full commitment`,
          budget ? `Spreads ${budget} investment across milestones` : "Distributes cost across defined milestones",
        ],
        cons: [
          isHighUrgency ? "May not meet the urgency deadline with phased approach" : "Extended timeline to full capability",
          "Partial deployment may limit initial impact measurement",
        ],
        recommendationScore: isHighUrgency ? 60 : 70,
      },
      {
        name: `${projectName} Feasibility & Pilot Study`,
        description: isLowCompleteness
          ? `Conduct deeper analysis to fill information gaps before committing to ${projectName}`
          : `Run a focused pilot of ${projectName}${deptLabel} to validate assumptions`,
        pros: [
          isLowCompleteness ? "Addresses significant data gaps in the proposal" : `Validates key assumptions for ${projectName}`,
          "Builds evidence base for more informed decision-making",
        ],
        cons: [
          `Delays ${projectName} benefits by estimated 3-6 months`,
          isHighUrgency ? "Conflicts directly with the stated urgency level" : "May reduce stakeholder momentum",
        ],
        recommendationScore: isLowCompleteness ? 75 : 40,
      },
    ];

    const risks = [
      {
        category: "Technical",
        description: `Integration complexity for ${projectName} with existing systems${deptLabel}`,
        likelihood: (riskLevel === "high" ? "high" : "medium") as "low" | "medium" | "high",
        impact: "medium" as const,
        mitigation: `Conduct technical assessment and integration testing for ${projectName} early in the lifecycle`,
      },
      {
        category: "Resource",
        description: `Resource availability and capability gaps for ${projectName} delivery`,
        likelihood: "medium" as const,
        impact: "high" as const,
        mitigation: "Develop resource plan with contingency allocation and skills assessment",
      },
      {
        category: "Operational",
        description: `Change management and stakeholder adoption challenges for ${projectName}`,
        likelihood: "medium" as const,
        impact: "medium" as const,
        mitigation: "Implement structured change management program with stakeholder engagement plan",
      },
    ];

    return {
      status: "fallback",
      reason: "LLM not available, using context-aware rule-based analysis",
      processingTimeMs: Date.now() - startTime,
      structuredAnalysis: {
        options,
        risks,
        assumptions: [
          { assumption: `Budget allocation for ${projectName} is adequate`, basis: budget ? `Based on estimated budget of ${budget}` : "Based on similar government initiatives" },
          { assumption: "Stakeholder alignment across relevant departments", basis: dept ? `Assumed based on ${dept} submission` : "Assumed based on submission context" },
        ],
        strategicAssessment: `Based on available data, ${projectName}${deptLabel} shows ${completeness >= 70 ? "strong" : "potential"} alignment with strategic objectives. ${objSnippet ? `The initiative aims to: ${objSnippet}` : ""}`,
        overallRecommendation: completeness >= 70
          ? `Recommend proceeding with ${projectName} under standard governance controls.`
          : `Additional information recommended for ${projectName} before final commitment.`,
        confidenceScore: Math.min(Number(scoring.overallScore || 60), 75),
        successFactors: [
          `Strong stakeholder engagement for ${projectName}`,
          "Clear metrics and KPIs defined upfront",
          "Phased implementation approach with governance checkpoints",
        ],
      },
    };
  }
}
