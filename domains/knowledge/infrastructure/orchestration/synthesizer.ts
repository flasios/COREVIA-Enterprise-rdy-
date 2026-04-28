import type { AgentResponse } from '../agents/baseAgent';
import type { AICitation } from '@shared/aiAdapters';
import { detectDivergence, generateSynthesisPrompt, type Conflict } from '../utils/conflictDetection';
import { logger } from '@platform/logging/Logger';
import { generateBrainDraftArtifact } from '@platform/ai/brainDraftArtifact';

const log = logger.service('ResponseSynthesizer');

export interface SynthesizedResponse {
  executiveSummary: string;
  agentSections: Array<{
    domain: string;
    answer: string;
    confidence: number;
    citationCount: number;
  }>;
  citations: AICitation[];
  conflicts: Conflict[];
  aggregatedConfidence: number;
}

export class ResponseSynthesizer {
  
  /**
   * Main synthesis pipeline
   * - Generates executive summary from all agent responses
   * - Merges agent sections
   * - Deduplicates citations
   * - Flags conflicts
   * - Computes aggregate confidence
   */
  async synthesize(
    query: string,
    agentResponses: AgentResponse[]
  ): Promise<SynthesizedResponse> {
    log.info('Synthesizing agent responses', { responseCount: agentResponses.length });

    if (agentResponses.length === 0) {
      return {
        executiveSummary: 'No expert responses available for this query.',
        agentSections: [],
        citations: [],
        conflicts: [],
        aggregatedConfidence: 0
      };
    }

    // Step 1: Detect conflicts
    const conflicts = await this.flagConflicts(agentResponses);

    // Step 2: Generate executive summary
    const executiveSummary = await this.generateExecutiveSummary(query, agentResponses, conflicts);

    // Step 3: Merge agent sections
    const agentSections = this.mergeAgentSections(agentResponses);

    // Step 4: Deduplicate citations
    const citations = this.deduplicateCitations(agentResponses);

    // Step 5: Compute aggregate confidence
    const aggregatedConfidence = this.computeAggregateConfidence(agentResponses);

    log.info('Synthesis complete', {
      conflictCount: conflicts.length,
      citationCount: citations.length,
      confidence: aggregatedConfidence.toFixed(2)
    });

    return {
      executiveSummary,
      agentSections,
      citations,
      conflicts,
      aggregatedConfidence
    };
  }

  /**
   * Generate executive summary using LLM synthesis
   */
  async generateExecutiveSummary(
    query: string,
    agentResponses: AgentResponse[],
    conflicts: Conflict[]
  ): Promise<string> {
    try {
      let prompt: string;

      if (conflicts.length > 0) {
        // Use conflict-aware synthesis prompt
        prompt = generateSynthesisPrompt(query, agentResponses, conflicts);
      } else {
        // Standard synthesis prompt
        const responsesSummary = agentResponses.map(r => 
          `[${r.domain.toUpperCase()} Expert - Confidence: ${r.confidence.toFixed(2)}]
${r.answer}
`
        ).join('\n\n---\n\n');

        prompt = `Synthesize the following expert responses into a comprehensive executive summary.

QUERY:
${query}

EXPERT RESPONSES:
${responsesSummary}

INSTRUCTIONS:
1. Create a cohesive summary that integrates insights from all experts
2. Highlight key consensus points
3. Present the most important findings
4. Keep it concise but comprehensive (2-4 paragraphs)
5. Use clear, professional language suitable for government decision-makers

Generate the executive summary:`;
      }

      const draft = await generateBrainDraftArtifact({
        serviceId: 'rag',
        routeKey: 'rag.synthesis.summary',
        artifactType: 'RAG_SYNTHESIS_SUMMARY',
        inputData: {
          query,
          conflicts,
          agentResponses: agentResponses.map(r => ({
            domain: r.domain,
            confidence: r.confidence,
            answer: r.answer.substring(0, 3000),
          })),
          prompt,
          instructions: {
            output: 'Return STRICT JSON only: {"summary": string}. 2-4 paragraphs, professional tone, address conflicts if present.'
          }
        } as Record<string, unknown>,
        userId: 'system',
      });

      const obj = draft.content as unknown as Record<string, unknown>;
      const summary = typeof obj.summary === 'string' ? obj.summary : '';
      return summary || 'Unable to generate executive summary.';

    } catch (error) {
      log.error('Executive summary generation failed', error instanceof Error ? error : undefined);
      return this.generateFallbackSummary(agentResponses);
    }
  }

  /**
   * Fallback summary when LLM synthesis fails
   */
  private generateFallbackSummary(agentResponses: AgentResponse[]): string {
    const domains = agentResponses.map(r => r.domain).join(', ');
    const avgConfidence = this.computeAggregateConfidence(agentResponses);
    
    return `Analysis completed by ${agentResponses.length} expert agents (${domains}) with an average confidence of ${(avgConfidence * 100).toFixed(0)}%. Please review individual expert responses below for detailed insights.`;
  }

  /**
   * Merge agent sections into structured format
   */
  mergeAgentSections(agentResponses: AgentResponse[]): Array<{
    domain: string;
    answer: string;
    confidence: number;
    citationCount: number;
  }> {
    return agentResponses.map(response => ({
      domain: response.domain,
      answer: response.answer,
      confidence: response.confidence,
      citationCount: response.citations.length
    }));
  }

  /**
   * Deduplicate citations across all agents
   * Key: `${documentId}-${chunkId}`
   */
  deduplicateCitations(agentResponses: AgentResponse[]): AICitation[] {
    const citationMap = new Map<string, AICitation>();

    for (const response of agentResponses) {
      for (const citation of response.citations) {
        const key = `${citation.documentId}-${citation.chunkId}`;
        
        if (!citationMap.has(key)) {
          citationMap.set(key, citation);
        } else {
          // If duplicate, keep the one with higher relevance
          const existing = citationMap.get(key)!;
          if (citation.relevance && existing.relevance && citation.relevance > existing.relevance) {
            citationMap.set(key, citation);
          }
        }
      }
    }

    // Sort by relevance descending
    return Array.from(citationMap.values())
      .sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
  }

  /**
   * Flag conflicts using conflict detection utilities
   */
  async flagConflicts(agentResponses: AgentResponse[]): Promise<Conflict[]> {
    try {
      return await detectDivergence(agentResponses);
    } catch (error) {
      log.error('Conflict detection failed', error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * Compute weighted average confidence
   * Higher weights for responses with more citations (more evidence-based)
   */
  computeAggregateConfidence(agentResponses: AgentResponse[]): number {
    if (agentResponses.length === 0) return 0;

    // Calculate weighted average based on citation count
    let totalWeight = 0;
    let weightedSum = 0;

    for (const response of agentResponses) {
      // Weight = 1 + (citation count / 10) to give bonus to well-cited responses
      const weight = 1 + (response.citations.length / 10);
      weightedSum += response.confidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
}
