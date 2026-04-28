import { logger } from "@platform/logging/Logger";
import { generateBrainDraftArtifact } from "./brainDraftArtifact";

/**
 * DeepSeek R1 Reasoning Service
 * 
 * Leverages DeepSeek R1's advanced reasoning capabilities for the Enterprise Decision Brain.
 * Key features:
 * - Chain-of-Thought (CoT) reasoning with self-verification
 * - Multi-step problem decomposition
 * - Reflection and alternative exploration
 * - Transparent reasoning traces for audit
 * 
 * Uses Replit AI Integrations for OpenRouter access - no API key required.
 * Charges are billed to your Replit credits.
 */

// Model identifier kept for metadata/debugging; execution is governed by Brain.
const DEEPSEEK_R1_MODEL = "deepseek/deepseek-r1-0528";

export interface ReasoningStep {
  step: number;
  type: "analysis" | "hypothesis" | "verification" | "reflection" | "conclusion";
  content: string;
  confidence: number;
}

export interface ReasoningTrace {
  id: string;
  query: string;
  model: string;
  steps: ReasoningStep[];
  finalAnswer: string;
  totalTokens: number;
  durationMs: number;
  timestamp: string;
}

export interface ReasoningRequest {
  query: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
  requiresVerification?: boolean;
}

export interface ReasoningResponse {
  success: boolean;
  answer: string;
  reasoningTrace: ReasoningTrace;
  confidence: number;
  error?: string;
  alternativesConsidered?: string[];
  verificationResult?: {
    verified: boolean;
    checkpoints: string[];
    issues?: string[];
  };
}

/**
 * Parse reasoning steps from DeepSeek R1's output.
 * R1 naturally produces chain-of-thought with <think>...</think> tags.
 */
function _parseReasoningSteps(content: string): ReasoningStep[] {
  const steps: ReasoningStep[] = [];
  
  // Extract thinking content between <think> tags
  const thinkMatch = /<think>([\s\S]*?)<\/think>/.exec(content);
  const thinkingContent = thinkMatch?.[1] || content;
  
  // Split by common reasoning markers
  const sections = thinkingContent.split(/(?=(?:Let me|First|Next|However|Therefore|In conclusion|Wait|Actually|Hmm|So|But|Additionally|Furthermore|To verify))/i);
  
  let stepNum = 1;
  for (const section of sections) {
    const trimmed = section.trim();
    if (trimmed.length < 10) continue;
    
    let type: ReasoningStep["type"] = "analysis";
    const lowerSection = trimmed.toLowerCase();
    
    if (lowerSection.includes("verify") || lowerSection.includes("check") || lowerSection.includes("confirm")) {
      type = "verification";
    } else if (lowerSection.includes("wait") || lowerSection.includes("actually") || lowerSection.includes("reconsider")) {
      type = "reflection";
    } else if (lowerSection.includes("hypothesis") || lowerSection.includes("assume") || lowerSection.includes("suppose")) {
      type = "hypothesis";
    } else if (lowerSection.includes("therefore") || lowerSection.includes("conclusion") || lowerSection.includes("final")) {
      type = "conclusion";
    }
    
    const confidence = type === "verification" ? 95 : 85;
    steps.push({
      step: stepNum++,
      type,
      content: trimmed.substring(0, 500) + (trimmed.length > 500 ? "..." : ""),
      confidence: type === "reflection" ? 70 : confidence,
    });
  }
  
  return steps;
}

/**
 * Extract final answer from DeepSeek R1 output (after thinking)
 */
function _extractFinalAnswer(content: string): string {
  // R1 puts final answer after </think> tag
  const afterThink = content.split("</think>")[1];
  if (afterThink) {
    return afterThink.trim();
  }
  
  // Fallback: look for boxed answer (R1's math format)
  const boxedMatch = /\\boxed\{([^}]+)\}/.exec(content);
  if (boxedMatch) {
    return boxedMatch[1] || content;
  }
  
  // Fallback: last paragraph
  const paragraphs = content.split("\n\n").filter(p => p.trim().length > 0);
  return paragraphs.at(-1) || content;
}

export class DeepSeekReasoningService {
  private readonly model: string;
  
  constructor(model: string = DEEPSEEK_R1_MODEL) {
    this.model = model;
  }
  
  /**
   * Execute deep reasoning with chain-of-thought
   */
  async reason(request: ReasoningRequest): Promise<ReasoningResponse> {
    const startTime = Date.now();
    const traceId = `reason_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    try {
      // Avoid polluting the main Decision Spine registry with one-off system reasoning runs.
      // We reuse a stable spine id for system-level reasoning so the Decisions tab doesn't grow endlessly.
      const today = new Date().toISOString().slice(0, 10);
      const systemReasoningSpineId = `DSP-REASONING-SYSTEM-${today}`;

      const draft = await generateBrainDraftArtifact({
        decisionSpineId: systemReasoningSpineId,
        serviceId: "reasoning",
        routeKey: "reasoning.generate",
        artifactType: "REASONING_TRACE",
        inputData: {
          query: request.query,
          context: request.context,
          maxTokens: request.maxTokens,
          temperature: request.temperature,
          requiresVerification: request.requiresVerification,
          requestedModel: this.model,
          intent: `Reason about: ${String(request.query).slice(0, 120)}`,
        },
        userId: "system",
      });

      const content = draft.content;
      const finalAnswer = content.finalAnswer;
      let answer = "";
      if (typeof content.answer === "string") {
        answer = content.answer;
      } else if (typeof finalAnswer === "string") {
        answer = finalAnswer;
      }
      const confidence = typeof content.confidence === "number" ? content.confidence : 0.5;
      const reasoningTrace = (content.reasoningTrace && typeof content.reasoningTrace === "object")
        ? (content.reasoningTrace as ReasoningTrace)
        : {
            id: traceId,
            query: request.query.substring(0, 200),
            model: this.model,
            steps: [],
            finalAnswer: answer,
            totalTokens: 0,
            durationMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          };

      return {
        success: true,
        answer,
        reasoningTrace,
        confidence: Math.max(0, Math.min(100, confidence * 100)) / 100,
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error("[DeepSeek R1] Reasoning error:", error);
      
      return {
        success: false,
        answer: `Reasoning failed: ${errorMessage}`,
        reasoningTrace: {
          id: traceId,
          query: request.query.substring(0, 200),
          model: this.model,
          steps: [],
          finalAnswer: "",
          totalTokens: 0,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
        confidence: 0,
      };
    }
  }
  
  /**
   * Multi-turn reasoning with progressive refinement
   */
  async reasonWithRefinement(
    request: ReasoningRequest,
    maxRefinements: number = 2
  ): Promise<ReasoningResponse> {
    let currentRequest = { ...request };
    let lastResponse: ReasoningResponse | null = null;
    
    for (let i = 0; i <= maxRefinements; i++) {
      const response = await this.reason(currentRequest);
      
      if (!response.success) {
        return response;
      }
      
      // Check if refinement needed based on confidence or issues
      if (
        response.confidence >= 90 ||
        !response.verificationResult?.issues?.length ||
        i === maxRefinements
      ) {
        return response;
      }
      
      // Refine with identified issues
      currentRequest = {
        ...request,
        context: `Previous reasoning:\n${response.answer}\n\nIssues to address:\n${response.verificationResult.issues.join("\n")}\n\n${request.context || ""}`,
        requiresVerification: true,
      };
      
      lastResponse = response;
      logger.info(`[DeepSeek R1] Refinement ${i + 1}/${maxRefinements} - addressing ${response.verificationResult.issues.length} issues`);
    }
    
    return lastResponse || this.reason(request);
  }
  
  /**
   * Compare multiple reasoning approaches and select best
   */
  async reasonWithEnsemble(
    request: ReasoningRequest,
    approaches: string[] = ["analytical", "systematic", "creative"]
  ): Promise<ReasoningResponse & { ensembleAnalysis: { approach: string; confidence: number }[] }> {
    const results: ReasoningResponse[] = [];
    const ensembleAnalysis: { approach: string; confidence: number }[] = [];
    
    for (const approach of approaches) {
      const modifiedRequest = {
        ...request,
        context: `${request.context || ""}\n\nApproach: Use a ${approach} reasoning style.`,
      };
      
      const result = await this.reason(modifiedRequest);
      results.push(result);
      ensembleAnalysis.push({
        approach,
        confidence: result.confidence,
      });
    }
    
    // Select highest confidence result
    const [firstResult, ...otherResults] = results;
    if (!firstResult) {
      return {
        success: false,
        answer: "",
        reasoningTrace: {
          id: "deepseek-empty-result",
          query: request.query,
          model: DEEPSEEK_R1_MODEL,
          steps: [],
          finalAnswer: "",
          totalTokens: 0,
          durationMs: 0,
          timestamp: new Date().toISOString(),
        },
        confidence: 0,
        error: "No reasoning results returned",
        ensembleAnalysis,
      };
    }

    const bestResult = otherResults.reduce(
      (best, curr) => (curr.confidence > best.confidence ? curr : best),
      firstResult,
    );
    
    return {
      ...bestResult,
      ensembleAnalysis,
    };
  }
}

export const deepSeekReasoningService = new DeepSeekReasoningService();
