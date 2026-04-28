/**
 * Conflict Adjudicator
 * Phase 1 Enhancement: Pre-synthesis conflict resolution
 * Detects and resolves conflicts between agent responses before merging
 */

import type { AgentResponse } from '../agents/baseAgent';
import { logger } from '@platform/logging/Logger';
import { generateBrainDraftArtifact } from '@platform/ai/brainDraftArtifact';

const log = logger.service('ConflictAdjudicator');

export interface ConflictType {
  type: 'factual' | 'numerical' | 'recommendation' | 'priority' | 'assessment';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

export interface DetectedConflict {
  id: string;
  agents: string[];
  conflictType: ConflictType;
  statements: Array<{ agent: string; statement: string; confidence: number }>;
  resolution?: ConflictResolution;
}

export interface ConflictResolution {
  resolvedBy: 'consensus' | 'highest_confidence' | 'evidence_based' | 'llm_adjudication' | 'unresolved';
  winningAgent?: string;
  resolvedStatement: string;
  confidence: number;
  reasoning: string;
}

export interface AdjudicationResult {
  conflicts: DetectedConflict[];
  resolvedConflicts: number;
  unresolvedConflicts: number;
  adjustedResponses: AgentResponse[];
  summary: string;
}

export class ConflictAdjudicator {
  private conflictPatterns = {
    numerical: /(\d+(?:\.\d+)?)\s*(%|million|billion|AED|years?|months?|days?)/gi,
    recommendation: /(should|recommend|suggest|advise|propose)\s+(.+?)(?:\.|$)/gi,
    priority: /(high|medium|low|critical|urgent)\s+(priority|risk|importance)/gi,
    assessment: /(positive|negative|neutral|favorable|unfavorable)\s+(impact|outcome|assessment)/gi
  };

  /**
   * Main adjudication pipeline
   */
  async adjudicate(responses: AgentResponse[]): Promise<AdjudicationResult> {
    log.info('Analyzing agent responses for conflicts', { responseCount: responses.length });

    if (responses.length < 2) {
      return {
        conflicts: [],
        resolvedConflicts: 0,
        unresolvedConflicts: 0,
        adjustedResponses: responses,
        summary: 'Single agent response - no conflicts possible'
      };
    }

    // Step 1: Detect conflicts
    const conflicts = await this.detectConflicts(responses);
    log.info('Detected potential conflicts', { conflictCount: conflicts.length });

    if (conflicts.length === 0) {
      return {
        conflicts: [],
        resolvedConflicts: 0,
        unresolvedConflicts: 0,
        adjustedResponses: responses,
        summary: 'No conflicts detected between agent responses'
      };
    }

    // Step 2: Resolve conflicts
    const resolvedConflicts = await this.resolveConflicts(conflicts, responses);

    // Step 3: Adjust responses based on resolutions
    const adjustedResponses = this.applyResolutions(responses, resolvedConflicts);

    // Step 4: Generate summary
    const resolved = resolvedConflicts.filter(c => c.resolution?.resolvedBy !== 'unresolved').length;
    const unresolved = resolvedConflicts.length - resolved;

    const summary = this.generateSummary(resolvedConflicts, resolved, unresolved);

    return {
      conflicts: resolvedConflicts,
      resolvedConflicts: resolved,
      unresolvedConflicts: unresolved,
      adjustedResponses,
      summary
    };
  }

  /**
   * Detect conflicts between agent responses
   */
  private async detectConflicts(responses: AgentResponse[]): Promise<DetectedConflict[]> {
    const conflicts: DetectedConflict[] = [];
    let conflictId = 0;

    // Pairwise comparison
    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const agent1 = responses[i]!;
        const agent2 = responses[j]!;

        // Check numerical conflicts
        const numericalConflicts = this.detectNumericalConflicts(agent1, agent2);
        conflicts.push(...numericalConflicts.map(c => ({ ...c, id: `conflict-${++conflictId}` })));

        // Check recommendation conflicts
        const recConflicts = this.detectRecommendationConflicts(agent1, agent2);
        conflicts.push(...recConflicts.map(c => ({ ...c, id: `conflict-${++conflictId}` })));

        // Check confidence divergence
        if (Math.abs(agent1.confidence - agent2.confidence) > 30) {
          conflicts.push({
            id: `conflict-${++conflictId}`,
            agents: [agent1.domain, agent2.domain],
            conflictType: {
              type: 'assessment',
              severity: 'medium',
              description: 'Significant confidence divergence between agents'
            },
            statements: [
              { agent: agent1.domain, statement: `Confidence: ${agent1.confidence}%`, confidence: agent1.confidence },
              { agent: agent2.domain, statement: `Confidence: ${agent2.confidence}%`, confidence: agent2.confidence }
            ]
          });
        }
      }
    }

    // Deduplicate similar conflicts
    return this.deduplicateConflicts(conflicts);
  }

  /**
   * Detect numerical value conflicts
   */
  private detectNumericalConflicts(agent1: AgentResponse, agent2: AgentResponse): DetectedConflict[] {
    const conflicts: DetectedConflict[] = [];
    
    // Extract numbers with context
    const nums1 = this.extractNumbersWithContext(agent1.answer);
    const nums2 = this.extractNumbersWithContext(agent2.answer);

    // Find similar contexts with different numbers
    for (const n1 of nums1) {
      for (const n2 of nums2) {
        if (this.isSimilarContext(n1.context, n2.context) && 
            this.isSignificantDifference(n1.value, n2.value)) {
          conflicts.push({
            id: '',
            agents: [agent1.domain, agent2.domain],
            conflictType: {
              type: 'numerical',
              severity: this.assessNumericalSeverity(n1.value, n2.value),
              description: `Numerical disagreement on ${n1.context}`
            },
            statements: [
              { agent: agent1.domain, statement: n1.original, confidence: agent1.confidence },
              { agent: agent2.domain, statement: n2.original, confidence: agent2.confidence }
            ]
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Extract numbers with surrounding context
   */
  private extractNumbersWithContext(text: string): Array<{ value: number; context: string; original: string }> {
    const results: Array<{ value: number; context: string; original: string }> = [];
    const regex = /(\w+\s+){0,3}(\d+(?:\.\d+)?)\s*(%|million|billion|AED|years?|months?)(\s+\w+){0,3}/gi;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
      const value = parseFloat(match[2]!);
      if (!isNaN(value)) {
        results.push({
          value,
          context: match[0].trim().toLowerCase(),
          original: match[0].trim()
        });
      }
    }

    return results;
  }

  /**
   * Check if two contexts are similar
   */
  private isSimilarContext(ctx1: string, ctx2: string): boolean {
    const words1 = ctx1.split(/\s+/).filter(w => w.length > 3);
    const words2 = ctx2.split(/\s+/).filter(w => w.length > 3);
    
    const common = words1.filter(w => words2.includes(w));
    return common.length >= 2;
  }

  /**
   * Check if numerical difference is significant
   */
  private isSignificantDifference(v1: number, v2: number): boolean {
    if (v1 === 0 || v2 === 0) return v1 !== v2;
    const ratio = Math.max(v1, v2) / Math.min(v1, v2);
    return ratio > 1.2; // More than 20% difference
  }

  /**
   * Assess severity of numerical conflict
   */
  private assessNumericalSeverity(v1: number, v2: number): 'critical' | 'high' | 'medium' | 'low' {
    const ratio = Math.max(v1, v2) / Math.min(v1, v2);
    if (ratio > 2) return 'critical';
    if (ratio > 1.5) return 'high';
    if (ratio > 1.3) return 'medium';
    return 'low';
  }

  /**
   * Detect recommendation conflicts
   */
  private detectRecommendationConflicts(agent1: AgentResponse, agent2: AgentResponse): DetectedConflict[] {
    const conflicts: DetectedConflict[] = [];
    
    // Look for opposing recommendations
    const opposingPairs = [
      ['approve', 'reject'],
      ['proceed', 'delay'],
      ['increase', 'decrease'],
      ['expand', 'reduce'],
      ['prioritize', 'deprioritize']
    ];

    const text1 = agent1.answer.toLowerCase();
    const text2 = agent2.answer.toLowerCase();

    for (const [term1, term2] of opposingPairs) {
      if ((text1.includes(term1!) && text2.includes(term2!)) ||
          (text1.includes(term2!) && text2.includes(term1!))) {
        conflicts.push({
          id: '',
          agents: [agent1.domain, agent2.domain],
          conflictType: {
            type: 'recommendation',
            severity: 'high',
            description: `Opposing recommendations: ${term1!} vs ${term2!}`
          },
          statements: [
            { agent: agent1.domain, statement: this.extractRelevantSentence(agent1.answer, [term1!, term2!]), confidence: agent1.confidence },
            { agent: agent2.domain, statement: this.extractRelevantSentence(agent2.answer, [term1!, term2!]), confidence: agent2.confidence }
          ]
        });
      }
    }

    return conflicts;
  }

  /**
   * Extract sentence containing keywords
   */
  private extractRelevantSentence(text: string, keywords: string[]): string {
    const sentences = text.split(/[.!?]+/);
    for (const sentence of sentences) {
      if (keywords.some(k => sentence.toLowerCase().includes(k))) {
        return sentence.trim().substring(0, 200);
      }
    }
    return text.substring(0, 200);
  }

  /**
   * Deduplicate similar conflicts
   */
  private deduplicateConflicts(conflicts: DetectedConflict[]): DetectedConflict[] {
    const unique: DetectedConflict[] = [];
    
    for (const conflict of conflicts) {
      const isDuplicate = unique.some(u => 
        u.agents.sort().join(',') === conflict.agents.sort().join(',') &&
        u.conflictType.type === conflict.conflictType.type &&
        u.conflictType.description === conflict.conflictType.description
      );
      
      if (!isDuplicate) {
        unique.push(conflict);
      }
    }

    return unique;
  }

  /**
   * Resolve detected conflicts
   */
  private async resolveConflicts(
    conflicts: DetectedConflict[],
    responses: AgentResponse[]
  ): Promise<DetectedConflict[]> {
    const resolved: DetectedConflict[] = [];

    for (const conflict of conflicts) {
      let resolution: ConflictResolution;

      // Try resolution strategies in order
      resolution = this.tryConsensusResolution(conflict, responses);
      
      if (resolution.resolvedBy === 'unresolved') {
        resolution = this.tryConfidenceResolution(conflict);
      }

      if (resolution.resolvedBy === 'unresolved') {
        resolution = this.tryEvidenceResolution(conflict, responses);
      }

      // For critical conflicts, use LLM adjudication
      if (resolution.resolvedBy === 'unresolved' && conflict.conflictType.severity === 'critical') {
        resolution = await this.tryLLMAdjudication(conflict, responses);
      }

      resolved.push({ ...conflict, resolution });
    }

    return resolved;
  }

  /**
   * Try to resolve by consensus (if statements are actually similar)
   */
  private tryConsensusResolution(conflict: DetectedConflict, _responses: AgentResponse[]): ConflictResolution {
    // Check if the "conflict" is actually minor variation
    if (conflict.conflictType.severity === 'low') {
      const avgConfidence = conflict.statements.reduce((sum, s) => sum + s.confidence, 0) / conflict.statements.length;
      return {
        resolvedBy: 'consensus',
        resolvedStatement: 'Minor variation - both perspectives are valid',
        confidence: avgConfidence,
        reasoning: 'Low severity conflict, differences are within acceptable range'
      };
    }

    return { resolvedBy: 'unresolved', resolvedStatement: '', confidence: 0, reasoning: '' };
  }

  /**
   * Resolve by highest confidence agent
   */
  private tryConfidenceResolution(conflict: DetectedConflict): ConflictResolution {
    const sorted = [...conflict.statements].sort((a, b) => b.confidence - a.confidence);
    const winner = sorted[0]!;
    const runnerUp = sorted[1]!;

    // Only use confidence if there's significant difference
    if (winner.confidence - runnerUp.confidence >= 15) {
      return {
        resolvedBy: 'highest_confidence',
        winningAgent: winner.agent,
        resolvedStatement: winner.statement,
        confidence: winner.confidence,
        reasoning: `${winner.agent} agent has significantly higher confidence (${winner.confidence}% vs ${runnerUp.confidence}%)`
      };
    }

    return { resolvedBy: 'unresolved', resolvedStatement: '', confidence: 0, reasoning: '' };
  }

  /**
   * Resolve based on evidence (citations)
   */
  private tryEvidenceResolution(conflict: DetectedConflict, responses: AgentResponse[]): ConflictResolution {
    const evidenceCounts: Record<string, number> = {};
    
    for (const response of responses) {
      if (conflict.agents.includes(response.domain)) {
        evidenceCounts[response.domain] = response.citations.length;
      }
    }

    const sorted = Object.entries(evidenceCounts).sort((a, b) => b[1] - a[1]);
    
    if (sorted.length >= 2 && sorted[0]![1] > sorted[1]![1] * 1.5) {
      const winner = conflict.statements.find(s => s.agent === sorted[0]![0]);
      if (winner) {
        return {
          resolvedBy: 'evidence_based',
          winningAgent: sorted[0]![0],
          resolvedStatement: winner.statement,
          confidence: winner.confidence,
          reasoning: `${sorted[0]![0]} agent has more supporting evidence (${sorted[0]![1]} citations vs ${sorted[1]![1]})`
        };
      }
    }

    return { resolvedBy: 'unresolved', resolvedStatement: '', confidence: 0, reasoning: '' };
  }

  /**
   * Use LLM to adjudicate complex conflicts
   */
  private async tryLLMAdjudication(
    conflict: DetectedConflict,
    _responses: AgentResponse[]
  ): Promise<ConflictResolution> {
    try {
      const prompt = `You are an expert adjudicator resolving a conflict between AI agents analyzing a government project.

CONFLICT TYPE: ${conflict.conflictType.type} (${conflict.conflictType.severity} severity)
DESCRIPTION: ${conflict.conflictType.description}

AGENT STATEMENTS:
${conflict.statements.map(s => `[${s.agent.toUpperCase()}] (Confidence: ${s.confidence}%): ${s.statement}`).join('\n\n')}

TASK: Determine which agent's perspective should be prioritized and provide a resolution.

Respond in JSON format:
{
  "winningAgent": "domain name",
  "resolvedStatement": "the correct statement or synthesis",
  "confidence": 0-100,
  "reasoning": "explanation for the decision"
}`;

      const draft = await generateBrainDraftArtifact({
        serviceId: 'rag',
        routeKey: 'rag.conflict.adjudicate',
        artifactType: 'RAG_CONFLICT',
        inputData: {
          conflictType: conflict.conflictType,
          statements: conflict.statements,
          prompt,
          instructions: {
            output: 'Return STRICT JSON only: {"winningAgent": string, "resolvedStatement": string, "confidence": number, "reasoning": string}. confidence is 0-100.'
          }
        } as Record<string, unknown>,
        userId: 'system',
      });

      const parsed = draft.content as unknown as Record<string, unknown>;

      return {
        resolvedBy: 'llm_adjudication',
        winningAgent: typeof parsed.winningAgent === 'string' ? parsed.winningAgent : undefined,
        resolvedStatement: typeof parsed.resolvedStatement === 'string' ? parsed.resolvedStatement : '',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : ''
      };
    } catch (error) {
      log.error('LLM adjudication failed', error instanceof Error ? error : undefined);
      return { resolvedBy: 'unresolved', resolvedStatement: '', confidence: 0, reasoning: 'LLM adjudication failed' };
    }
  }

  /**
   * Apply resolutions to adjust agent responses
   */
  private applyResolutions(responses: AgentResponse[], conflicts: DetectedConflict[]): AgentResponse[] {
    const adjusted = responses.map(r => ({ ...r }));

    for (const conflict of conflicts) {
      if (conflict.resolution?.resolvedBy === 'unresolved') continue;

      // Add conflict resolution metadata to losing agents
      const resolution = conflict.resolution;
      if (!resolution) continue;
      
      for (const agent of conflict.agents) {
        if (agent !== resolution.winningAgent) {
          const response = adjusted.find(r => r.domain === agent);
          if (response) {
            (response as any).conflictResolution = { // eslint-disable-line @typescript-eslint/no-explicit-any
              type: conflict.conflictType.type,
              resolvedBy: resolution.resolvedBy,
              note: `Deferred to ${resolution.winningAgent} on: ${conflict.conflictType.description}`
            };
          }
        }
      }
    }

    return adjusted;
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(conflicts: DetectedConflict[], resolved: number, unresolved: number): string {
    if (conflicts.length === 0) {
      return 'All agents are in agreement.';
    }

    const parts: string[] = [];
    parts.push(`Analyzed ${conflicts.length} potential conflicts.`);
    
    if (resolved > 0) {
      parts.push(`${resolved} resolved through adjudication.`);
    }
    
    if (unresolved > 0) {
      parts.push(`${unresolved} require manual review.`);
    }

    // Highlight critical conflicts
    const critical = conflicts.filter(c => c.conflictType.severity === 'critical');
    if (critical.length > 0) {
      parts.push(`${critical.length} critical conflict(s) detected.`);
    }

    return parts.join(' ');
  }
}

export const conflictAdjudicator = new ConflictAdjudicator();
