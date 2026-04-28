/**
 * R1 Learning Engine
 * 
 * Autonomous learning system that uses DeepSeek R1 to:
 * - Auto-analyze decisions that lack outcomes or show variance patterns
 * - Generate new assumptions based on learned patterns
 * - Create reasoning algorithms/heuristics from success/failure data
 * - Continuously improve decision-making through feedback loops
 * 
 * This engine runs periodically and on-demand to enhance the Decision Brain's capabilities.
 */

import { db } from "@platform/db";
import { decisionAssumptions, learningPatterns } from "@shared/schema";
import { canonicalAiRequests, decisionSpines, brainEvents } from "@shared/schemas/corevia/tables";
import { desc, eq, inArray } from "drizzle-orm";
import { deepSeekReasoningService } from "@platform/ai/deepSeekReasoning";
import JSON5 from "json5";
import { logger } from "@platform/logging/Logger";

type LearningDecisionEntry = {
  id: string;
  decisionType: string;
  decisionSummary: string;
  recommendation: string;
  confidenceScore: number;
  outcomeRecordedAt: Date | null;
  createdAt: Date | null;
};

export interface LearningInsight {
  id: string;
  type: 'assumption' | 'pattern' | 'algorithm' | 'risk_factor';
  title: string;
  description: string;
  confidence: number;
  sourceDecisions: string[];
  generatedAt: Date;
  appliesTo: string[];
  metadata?: Record<string, unknown>;
}

export interface LearningSession {
  id: string;
  startedAt: Date;
  completedAt?: Date;
  decisionsAnalyzed: number;
  insightsGenerated: number;
  newAssumptions: number;
  patternsIdentified: number;
  status: 'running' | 'completed' | 'failed';
  error?: string;
}

export interface PatternAnalysis {
  pattern: string;
  frequency: number;
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  successRate: number;
  recommendations: string[];
}

interface GeneratedAssumption {
  title: string;
  description: string;
  confidence: number;
  category: string;
}

const MAX_RETRIES = 2;
const VALID_IMPACT_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
const VALID_CATEGORIES = ['financial', 'operational', 'strategic', 'regulatory', 'technical'] as const;

function isInfraUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const anyErr = error as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (anyErr.code === 'ECONNREFUSED') return true;
  if (typeof anyErr.message === 'string' && anyErr.message.includes('ECONNREFUSED')) return true;
  if (Array.isArray(anyErr.errors)) {
    return anyErr.errors.some((e: any) => e?.code === 'ECONNREFUSED' || (typeof e?.message === 'string' && e.message.includes('ECONNREFUSED'))); // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  return false;
}

class R1LearningEngine {
  private isRunning = false;
  private lastRunAt: Date | null = null;
  private sessions: LearningSession[] = [];
  private insights: LearningInsight[] = [];
  private initialized = false;

  // Initialize engine and load persisted patterns
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.loadPersistedPatterns();
    this.initialized = true;
    logger.info('[R1 Learning] Engine initialized');
  }

  async runLearningSession(): Promise<LearningSession> {
    if (this.isRunning) {
      throw new Error('Learning session already in progress');
    }

    const session: LearningSession = {
      id: `LS-${Date.now().toString(36).toUpperCase()}`,
      startedAt: new Date(),
      decisionsAnalyzed: 0,
      insightsGenerated: 0,
      newAssumptions: 0,
      patternsIdentified: 0,
      status: 'running',
    };

    this.isRunning = true;
    this.sessions.push(session);

    try {
      logger.info(`[R1 Learning] Starting learning session ${session.id}`);

      const decisionsToAnalyze = await this.getDecisionsForAnalysis();
      session.decisionsAnalyzed = decisionsToAnalyze.length;
      logger.info(`[R1 Learning] Found ${decisionsToAnalyze.length} decisions to analyze`);

      if (decisionsToAnalyze.length === 0) {
        session.status = 'completed';
        session.completedAt = new Date();
        this.isRunning = false;
        return session;
      }

      // Step 2: Analyze patterns with retry logic - throws on failure
      const patternAnalysis = await this.analyzeDecisionPatternsWithRetry(decisionsToAnalyze);
      
      if (patternAnalysis.length === 0) {
        throw new Error('Pattern analysis failed: No valid patterns recovered after retries. DeepSeek R1 output was unusable.');
      }
      
      session.patternsIdentified = patternAnalysis.length;

      // Step 3: Generate assumptions with validation
      const newAssumptions = await this.generateAssumptionsWithRetry(patternAnalysis);
      session.newAssumptions = newAssumptions.length;

      // Step 4: Create learning insights
      const insights = await this.createLearningInsights(patternAnalysis, decisionsToAnalyze);
      session.insightsGenerated = insights.length;
      this.insights.push(...insights);

      // Step 5: Store with transaction (includes patterns for persistence)
      await this.storeInsightsWithTransaction(insights, newAssumptions, patternAnalysis);

      session.status = 'completed';
      session.completedAt = new Date();
      this.lastRunAt = new Date();

      // Persist session record to brainEvents for audit trail
      try {
        await db.insert(brainEvents).values({
          eventType: "r1_learning_session",
          payload: {
            sessionId: session.id,
            status: session.status,
            decisionsAnalyzed: session.decisionsAnalyzed,
            patternsIdentified: session.patternsIdentified,
            newAssumptions: session.newAssumptions,
            insightsGenerated: session.insightsGenerated,
            startedAt: session.startedAt.toISOString(),
            completedAt: session.completedAt.toISOString(),
          },
          occurredAt: session.completedAt,
        });
      } catch (persistErr) {
        logger.warn('[R1 Learning] Failed to persist session event:', persistErr);
      }

      logger.info(`[R1 Learning] Session ${session.id} completed: ${session.patternsIdentified} patterns, ${session.newAssumptions} assumptions, ${session.insightsGenerated} insights`);

    } catch (error) {
      logger.error('[R1 Learning] Session failed:', error);
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : 'Unknown error';
      session.completedAt = new Date();
      throw error; // Re-throw to surface the error
    } finally {
      this.isRunning = false;
    }

    return session;
  }

  private extractDecisionSummary(inputPayload: unknown): string {
    const input = (inputPayload || {}) as Record<string, unknown>;
    const candidates = [
      input.businessObjective,
      input.problemStatement,
      input.description,
      input.summary,
      input.title,
      input.overview,
    ];
    const text = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
    if (typeof text === "string" && text.trim()) return text.trim();

    try {
      const raw = JSON.stringify(input);
      return raw.length > 500 ? `${raw.slice(0, 500)}...` : raw;
    } catch {
      return "No decision summary provided";
    }
  }

  private async getDecisionsForAnalysis(): Promise<LearningDecisionEntry[]> {
    try {
      const spines = await db.select()
        .from(decisionSpines)
        .orderBy(desc(decisionSpines.createdAt))
        .limit(50);

      if (spines.length === 0) return [];

      const spineIds = spines.map((spine) => spine.decisionSpineId);
      const requests = await db.select()
        .from(canonicalAiRequests)
        .where(inArray(canonicalAiRequests.decisionSpineId, spineIds));

      const latestRequestBySpine = new Map<string, typeof canonicalAiRequests.$inferSelect>();
      for (const request of requests) {
        if (!request.decisionSpineId) continue;
        const existing = latestRequestBySpine.get(request.decisionSpineId);
        if (!existing || new Date(request.requestedAt || 0).getTime() > new Date(existing.requestedAt || 0).getTime()) {
          latestRequestBySpine.set(request.decisionSpineId, request);
        }
      }

      const completedStatuses = new Set(["CONCLUDED", "COMPLETED"]);
      const decisions: LearningDecisionEntry[] = spines.map((spine) => {
        const request = latestRequestBySpine.get(spine.decisionSpineId);
        const sourceMetadata = (request?.sourceMetadata || {}) as Record<string, unknown>;
        const confidenceRaw = Number(sourceMetadata.confidence ?? sourceMetadata.confidenceScore ?? 0);
        const confidenceScore = Number.isFinite(confidenceRaw)
          ? Math.max(0, Math.min(100, confidenceRaw > 1 ? confidenceRaw : confidenceRaw * 100))
          : 0;
        return {
          id: spine.decisionSpineId,
          decisionType: request?.useCaseType || spine.title || "general",
          decisionSummary: this.extractDecisionSummary(request?.inputPayload),
          recommendation: String(sourceMetadata.recommendation || sourceMetadata.summary || ""),
          confidenceScore,
          outcomeRecordedAt: completedStatuses.has(String(spine.status || "").toUpperCase())
            ? (spine.updatedAt || spine.createdAt || null)
            : null,
          createdAt: spine.createdAt || null,
        };
      });

      return decisions.filter(d => 
        !d.outcomeRecordedAt || 
        (d.confidenceScore && d.confidenceScore < 80)
      );
    } catch (error) {
      logger.error('[R1 Learning] Error fetching decisions:', error);
      throw new Error('Failed to fetch decisions for analysis');
    }
  }

  private async analyzeDecisionPatternsWithRetry(decisions: LearningDecisionEntry[]): Promise<PatternAnalysis[]> {
    if (decisions.length === 0) return [];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const patterns = await this.analyzeDecisionPatterns(decisions);
        if (patterns.length > 0) {
          return patterns;
        }
        logger.warn(`[R1 Learning] Attempt ${attempt + 1}: No patterns parsed, retrying...`);
      } catch (error) {
        logger.error(`[R1 Learning] Pattern analysis attempt ${attempt + 1} failed:`, error);
        if (attempt === MAX_RETRIES) {
          throw new Error('Pattern analysis failed after maximum retries');
        }
      }
    }
    return [];
  }

  private async analyzeDecisionPatterns(decisions: LearningDecisionEntry[]): Promise<PatternAnalysis[]> {
    const decisionSummaries = decisions.map(d => ({
      type: d.decisionType,
      summary: d.decisionSummary,
      confidence: d.confidenceScore,
      recommendation: d.recommendation,
      hasOutcome: !!d.outcomeRecordedAt,
    }));

    const analysisPrompt = `Analyze these ${decisions.length} government project decisions and identify patterns.

DECISIONS:
${JSON.stringify(decisionSummaries, null, 2)}

REQUIRED OUTPUT FORMAT - Return ONLY a valid JSON array with no additional text:
[
  {
    "pattern": "Pattern Name",
    "frequency": 3,
    "impactLevel": "medium",
    "successRate": 75,
    "recommendations": ["Recommendation 1", "Recommendation 2"]
  }
]

Rules:
- pattern: descriptive name (string)
- frequency: count of occurrences (integer >= 1)
- impactLevel: MUST be one of: "low", "medium", "high", "critical"
- successRate: percentage 0-100 (integer)
- recommendations: array of strings`;

    logger.info(`[R1 Learning] Calling DeepSeek R1 for pattern analysis...`);
    const startTime = Date.now();
    
    let result;
    try {
      result = await deepSeekReasoningService.reason({
        query: analysisPrompt,
        maxTokens: 4096,
        requiresVerification: true,
      });
      logger.info(`[R1 Learning] DeepSeek R1 call completed in ${Date.now() - startTime}ms, success: ${result.success}`);
    } catch (deepSeekError) {
      logger.error(`[R1 Learning] DeepSeek R1 call failed after ${Date.now() - startTime}ms:`, deepSeekError);
      throw deepSeekError;
    }

    if (!result.success) {
      logger.error(`[R1 Learning] DeepSeek R1 returned error:`, result.error);
      throw new Error('DeepSeek R1 analysis failed: ' + (result.error || 'Unknown error'));
    }

    return this.parseAndValidatePatterns(result.answer);
  }

  private parseAndValidatePatterns(response: string): PatternAnalysis[] {
    // Log first 500 chars for debugging
    logger.info(`[R1 Learning] Parsing response (first 500 chars): ${response.substring(0, 500)}`);
    
    // Extract JSON array from response - try multiple patterns
    // Pattern 1: Look for [ ... ] but be greedy to get the full array
    let jsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
    
    // Pattern 2: Try non-greedy if first fails
    if (!jsonMatch) {
      jsonMatch = response.match(/\[[\s\S]*?\]/);
    }
    
    // Pattern 3: Try to find JSON after markdown code blocks
    if (!jsonMatch) {
      const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        const innerJson = codeBlockMatch[1]!.match(/\[\s\S]*\]/);
        if (innerJson) {
          jsonMatch = innerJson;
        }
      }
    }
    
    if (!jsonMatch) {
      logger.error('[R1 Learning] Full response:', response);
      throw new Error('No JSON array found in DeepSeek R1 response');
    }

    let jsonStr = jsonMatch[0];
    logger.info(`[R1 Learning] Extracted JSON (first 300 chars): ${jsonStr.substring(0, 300)}`);
    
    // Clean up common JSON issues from LLMs
    jsonStr = jsonStr
      .replace(/,\s*}/g, '}')  // Remove trailing commas before }
      .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
      .replace(/\n/g, ' ')      // Remove newlines
      .replace(/\t/g, ' ');     // Remove tabs

    let parsed: unknown[];
    try {
      // First attempt: standard JSON.parse (fastest, works for most well-formed responses)
      parsed = JSON.parse(jsonStr);
    } catch (firstError) {
      logger.info(`[R1 Learning] Standard JSON.parse failed, trying JSON5 (tolerant parser)...`);
      
      try {
        // Second attempt: JSON5 handles single quotes, trailing commas, comments, etc.
        // This preserves apostrophes in text while normalizing single-quoted strings
        parsed = JSON5.parse(jsonStr);
        logger.info(`[R1 Learning] JSON5 parsing succeeded`);
      } catch (json5Error) {
        logger.error(`[R1 Learning] JSON5 parsing also failed. Error: ${json5Error}`);
        logger.error(`[R1 Learning] Problematic JSON string (first 500 chars): ${jsonStr.substring(0, 500)}`);
        
        // Third attempt: Try to extract a cleaner JSON array pattern
        try {
          const cleanerMatch = jsonStr.match(/\[\s*\{[^]*\}\s*\]/);
          if (cleanerMatch) {
            parsed = JSON5.parse(cleanerMatch[0]);
            logger.info(`[R1 Learning] JSON5 parsing succeeded after regex extraction`);
          } else {
            throw firstError;
          }
        } catch (_thirdError) {
          logger.error(`[R1 Learning] All JSON parsing attempts failed. Full JSON: ${jsonStr}`);
          throw new Error(`Failed to parse JSON from DeepSeek R1 response: ${firstError}`);
        }
      }
    }

    if (!Array.isArray(parsed)) {
      throw new Error('DeepSeek R1 response parsed result is not an array');
    }

    if (parsed.length === 0) {
      throw new Error('DeepSeek R1 returned empty pattern array');
    }

    const validPatterns: PatternAnalysis[] = [];
    
    for (const item of parsed) {
      if (!this.isValidPatternObject(item)) {
        logger.warn('[R1 Learning] Skipping invalid pattern object:', item);
        continue;
      }

      const impactLevel = VALID_IMPACT_LEVELS.includes(item.impactLevel as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
        ? item.impactLevel as PatternAnalysis['impactLevel']
        : 'medium';

      validPatterns.push({
        pattern: String(item.pattern || 'Unknown Pattern'),
        frequency: Math.max(1, Math.round(Number(item.frequency) || 1)),
        impactLevel,
        successRate: Math.min(100, Math.max(0, Math.round(Number(item.successRate) || 50))),
        recommendations: Array.isArray(item.recommendations) 
          ? item.recommendations.filter((r: unknown) => typeof r === 'string')
          : [],
      });
    }

    if (validPatterns.length === 0) {
      throw new Error('No valid patterns found after validation - all parsed patterns were malformed');
    }

    return validPatterns;
  }

  private isValidPatternObject(obj: unknown): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null && 'pattern' in obj;
  }

  private async generateAssumptionsWithRetry(patterns: PatternAnalysis[]): Promise<GeneratedAssumption[]> {
    if (patterns.length === 0) return [];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const assumptions = await this.generateAssumptions(patterns);
        if (assumptions.length > 0) {
          return assumptions;
        }
        logger.warn(`[R1 Learning] Attempt ${attempt + 1}: No assumptions generated, retrying...`);
      } catch (error) {
        logger.error(`[R1 Learning] Assumption generation attempt ${attempt + 1} failed:`, error);
        if (attempt === MAX_RETRIES) {
          logger.warn('[R1 Learning] Assumption generation failed, continuing without new assumptions');
          return [];
        }
      }
    }
    return [];
  }

  private async generateAssumptions(patterns: PatternAnalysis[]): Promise<GeneratedAssumption[]> {
    const assumptionPrompt = `Based on these patterns from government project decisions:

PATTERNS:
${JSON.stringify(patterns, null, 2)}

Generate NEW ASSUMPTIONS for future decisions.

REQUIRED OUTPUT FORMAT - Return ONLY a valid JSON array:
[
  {
    "title": "Short assumption name",
    "description": "Detailed explanation of the assumption",
    "confidence": 75,
    "category": "strategic"
  }
]

Rules:
- title: 5-10 words (string)
- description: 1-3 sentences (string)
- confidence: 0-100 (integer)
- category: MUST be one of: "financial", "operational", "strategic", "regulatory", "technical"`;

    const result = await deepSeekReasoningService.reason({
      query: assumptionPrompt,
      maxTokens: 4096,
      requiresVerification: false,
    });

    if (!result.success) {
      throw new Error('DeepSeek R1 assumption generation failed');
    }

    return this.parseAndValidateAssumptions(result.answer);
  }

  private parseAndValidateAssumptions(response: string): GeneratedAssumption[] {
    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return [];

    let parsed: unknown[];
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return [];
    }

    if (!Array.isArray(parsed)) return [];

    const validAssumptions: GeneratedAssumption[] = [];
    
    for (const item of parsed) {
      if (!this.isValidAssumptionObject(item)) continue;

      const category = VALID_CATEGORIES.includes(item.category as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        ? item.category as string
        : 'strategic';

      validAssumptions.push({
        title: String(item.title || 'R1 Generated Assumption'),
        description: String(item.description || 'Generated from pattern analysis'),
        confidence: Math.min(100, Math.max(0, Math.round(Number(item.confidence) || 70))),
        category,
      });
    }

    return validAssumptions;
  }

  private isValidAssumptionObject(obj: unknown): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null && 'title' in obj;
  }

  private async createLearningInsights(
    patterns: PatternAnalysis[],
    decisions: LearningDecisionEntry[]
  ): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];

    for (const pattern of patterns) {
      insights.push({
        id: `INS-${Date.now().toString(36).toUpperCase()}-${insights.length}`,
        type: 'pattern',
        title: pattern.pattern,
        description: `Identified pattern with ${pattern.frequency} occurrences. Success rate: ${pattern.successRate}%. Impact: ${pattern.impactLevel}.`,
        confidence: pattern.successRate,
        sourceDecisions: decisions.slice(0, 5).map(d => d.id).filter(Boolean),
        generatedAt: new Date(),
        appliesTo: ['all'],
        metadata: {
          frequency: pattern.frequency,
          impactLevel: pattern.impactLevel,
          recommendations: pattern.recommendations,
        },
      });
    }

    // Generate algorithm insight if we have enough patterns
    if (patterns.length >= 2) {
      try {
        const algorithmPrompt = `Based on these decision patterns:
${patterns.map(p => `- ${p.pattern}: ${p.successRate}% success`).join('\n')}

Create a simple decision-making algorithm as IF-THEN rules. Be concise.`;

        const result = await deepSeekReasoningService.reason({
          query: algorithmPrompt,
          maxTokens: 2048,
          requiresVerification: false,
        });

        if (result.success && result.answer) {
          insights.push({
            id: `ALG-${Date.now().toString(36).toUpperCase()}`,
            type: 'algorithm',
            title: 'R1-Generated Decision Heuristic',
            description: result.answer,
            confidence: result.confidence,
            sourceDecisions: decisions.slice(0, 10).map(d => d.id).filter(Boolean),
            generatedAt: new Date(),
            appliesTo: ['all'],
            metadata: {
              reasoningSteps: result.reasoningTrace?.steps?.length || 0,
            },
          });
        }
      } catch (error) {
        logger.warn('[R1 Learning] Algorithm generation skipped:', error);
      }
    }

    return insights;
  }

  private async storeInsightsWithTransaction(
    insights: LearningInsight[],
    assumptions: GeneratedAssumption[],
    patterns?: PatternAnalysis[]
  ): Promise<void> {
    const timestamp = Date.now().toString(36).toUpperCase();
    
    // Prepare assumption inserts
    const assumptionValues = assumptions.map((assumption, i) => ({
      assumptionCode: `R1-${timestamp}-${i}`,
      version: 1,
      statement: `${assumption.title}: ${assumption.description}`,
      category: assumption.category,
      confidenceLevel: Math.round(assumption.confidence),
      source: 'r1_learning_engine',
      rationale: 'Generated by R1 Learning Engine from decision pattern analysis',
      validated: false,
      impactIfWrong: 'medium',
      impactLevel: 'medium',
      impactDescription: `R1-generated assumption based on ${assumption.category} patterns`,
      decayRate: 'slow',
      decayTrigger: 'time',
      decayTriggerConfig: { days: 90, autoCheck: true },
      isReusable: true,
      reusableScope: 'organization',
      status: 'active',
    }));

    // Prepare pattern inserts (persist to learningPatterns table)
    const patternValues = (patterns || []).map((p) => ({
      domain: 'decision' as const,
      pattern: p.pattern,
      frequency: p.frequency,
      confidence: (p.successRate / 100).toFixed(2), // Convert 0-100 to 0-1
      examples: { 
        recommendations: p.recommendations,
        impactLevel: p.impactLevel,
        generatedAt: new Date().toISOString(),
      },
      isActive: false,
    }));

    try {
      await db.transaction(async (tx) => {
        // Store assumptions
        for (const values of assumptionValues) {
          await tx.insert(decisionAssumptions).values(values);
        }
        // Store patterns to learning_patterns table
        for (const values of patternValues) {
          await tx.insert(learningPatterns).values(values);
        }
      });
      
      const storedCount = assumptionValues.length + patternValues.length;
      if (storedCount > 0) {
        logger.info(`[R1 Learning] Successfully stored ${assumptionValues.length} assumptions and ${patternValues.length} patterns in transaction`);
      }
    } catch (error) {
      logger.error('[R1 Learning] Transaction failed, all data rolled back:', error);
      throw new Error(`Failed to store learning data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Load persisted patterns from database on startup
  async loadPersistedPatterns(): Promise<void> {
    try {
      const patterns = await db.select()
        .from(learningPatterns)
        .where(eq(learningPatterns.isActive, true))
        .orderBy(desc(learningPatterns.createdAt))
        .limit(100);

      // Convert to LearningInsight format and add to cache
      for (const p of patterns) {
        const examples = p.examples as { recommendations?: string[]; impactLevel?: string; generatedAt?: string } | null;
        this.insights.push({
          id: p.id,
          type: 'pattern',
          title: p.pattern,
          description: `Learned pattern with ${p.frequency} occurrences. Confidence: ${Math.round(Number(p.confidence) * 100)}%`,
          confidence: Math.round(Number(p.confidence) * 100),
          sourceDecisions: [],
          generatedAt: p.createdAt || new Date(),
          appliesTo: [p.domain],
          metadata: {
            frequency: p.frequency,
            impactLevel: examples?.impactLevel || 'medium',
            recommendations: examples?.recommendations || [],
          },
        });
      }
      
      if (patterns.length > 0) {
        logger.info(`[R1 Learning] Loaded ${patterns.length} persisted patterns from database`);
      }
    } catch (error) {
      if (isInfraUnavailableError(error)) {
        logger.warn('[R1 Learning] Persisted patterns not loaded (database unavailable). Start infra with: npm run dev:infra');
        return;
      }

      logger.warn('[R1 Learning] Failed to load persisted patterns:', error);
    }
  }

  getStatus(): {
    isRunning: boolean;
    lastRunAt: Date | null;
    recentSessions: LearningSession[];
    totalInsights: number;
  } {
    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      recentSessions: this.sessions.slice(-10),
      totalInsights: this.insights.length,
    };
  }

  getInsights(): LearningInsight[] {
    return this.insights;
  }

  async analyzeDecision(decisionId: string): Promise<{
    insights: LearningInsight[];
    recommendations: string[];
  }> {
    const [spine] = await db.select()
      .from(decisionSpines)
      .where(eq(decisionSpines.decisionSpineId, decisionId));

    const [request] = await db.select()
      .from(canonicalAiRequests)
      .where(eq(canonicalAiRequests.decisionSpineId, decisionId))
      .orderBy(desc(canonicalAiRequests.requestedAt))
      .limit(1);

    const sourceMetadata = (request?.sourceMetadata || {}) as Record<string, unknown>;
    const confidenceRaw = Number(sourceMetadata.confidence ?? sourceMetadata.confidenceScore ?? 0);
    const confidenceScore = Number.isFinite(confidenceRaw)
      ? Math.max(0, Math.min(100, confidenceRaw > 1 ? confidenceRaw : confidenceRaw * 100))
      : 0;

    const decision: LearningDecisionEntry | null = spine
      ? {
          id: spine.decisionSpineId,
          decisionType: request?.useCaseType || spine.title || "general",
          decisionSummary: this.extractDecisionSummary(request?.inputPayload),
          recommendation: String(sourceMetadata.recommendation || sourceMetadata.summary || ""),
          confidenceScore,
          outcomeRecordedAt: ["CONCLUDED", "COMPLETED"].includes(String(spine.status || "").toUpperCase())
            ? (spine.updatedAt || spine.createdAt || null)
            : null,
          createdAt: spine.createdAt || null,
        }
      : null;

    if (!decision) {
      throw new Error('Decision not found');
    }

    const analysisPrompt = `Analyze this government project decision:

DECISION:
- Type: ${decision.decisionType}
- Summary: ${decision.decisionSummary}
- Recommendation: ${decision.recommendation}
- Confidence: ${decision.confidenceScore}%

Provide:
1. Key observations
2. Potential risk factors
3. Assumptions to validate
4. Recommendations for improvement`;

    const result = await deepSeekReasoningService.reason({
      query: analysisPrompt,
      maxTokens: 4096,
      requiresVerification: true,
    });

    const insights: LearningInsight[] = [];
    const recommendations: string[] = [];

    if (result.success) {
      insights.push({
        id: `DEC-${decisionId.substring(0, 8)}-INS`,
        type: 'assumption',
        title: `Analysis of ${decision.decisionType} Decision`,
        description: result.answer,
        confidence: result.confidence,
        sourceDecisions: [decisionId],
        generatedAt: new Date(),
        appliesTo: [decision.decisionType || 'general'],
        metadata: {
          reasoningSteps: result.reasoningTrace?.steps?.length || 0,
        },
      });

      if (result.reasoningTrace?.steps) {
        for (const step of result.reasoningTrace.steps) {
          if (step.type === 'conclusion' || step.content.toLowerCase().includes('recommend')) {
            recommendations.push(step.content);
          }
        }
      }
    }

    return { insights, recommendations };
  }
}

export const r1LearningEngine = new R1LearningEngine();

// Auto-initialize on import (load persisted patterns)
if (process.env.NODE_ENV !== 'test') {
  r1LearningEngine.initialize().catch(err => {
    logger.error('[R1 Learning] Auto-initialization failed:', err);
  });
}
