import type { AgentResponse } from '../agents/baseAgent';
import { logger } from '@platform/logging/Logger';
import { generateBrainDraftArtifact } from '@platform/ai/brainDraftArtifact';

const log = logger.service('ConflictDetection');

export interface SentimentAnalysis {
  score: number; // 0 (negative) to 1 (positive)
  label: 'negative' | 'neutral' | 'positive';
}

export interface Conflict {
  domains: string[];
  type: 'divergence' | 'contradiction' | 'confidence_gap';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedResponses: string[];
}

/**
 * Analyze sentiment of text using Claude API
 * @returns score between 0 (negative) and 1 (positive)
 */
export async function sentimentScore(text: string): Promise<SentimentAnalysis> {
  try {
    const draft = await generateBrainDraftArtifact({
      serviceId: 'rag',
      routeKey: 'rag.conflict.sentiment',
      artifactType: 'RAG_CONFLICT',
      inputData: {
        text: text.substring(0, 1000),
        instructions: {
          output: 'Return STRICT JSON only: {"score": number, "label": "negative"|"neutral"|"positive"}. score must be 0..1.'
        }
      } as Record<string, unknown>,
      userId: 'system',
    });

    const obj = draft.content as unknown as Record<string, unknown>;
    const score = typeof obj.score === 'number' ? obj.score : (typeof (obj as any)?.sentiment?.score === 'number' ? (obj as any).sentiment.score : 0.5); // eslint-disable-line @typescript-eslint/no-explicit-any
    const labelRaw = typeof obj.label === 'string' ? obj.label : (typeof (obj as any)?.sentiment?.label === 'string' ? (obj as any).sentiment.label : 'neutral'); // eslint-disable-line @typescript-eslint/no-explicit-any
    const label = (labelRaw === 'negative' || labelRaw === 'neutral' || labelRaw === 'positive') ? labelRaw : 'neutral';
    return { score, label };
  } catch (error) {
    log.error('Sentiment analysis failed', error instanceof Error ? error : undefined);
    return { score: 0.5, label: 'neutral' }; // Neutral fallback
  }
}

/**
 * Detect divergence and conflicts between agent responses
 */
export async function detectDivergence(responses: AgentResponse[]): Promise<Conflict[]> {
  if (responses.length < 2) {
    return []; // No conflicts possible with < 2 responses
  }

  const conflicts: Conflict[] = [];

  // CONFLICT TYPE 1: Confidence Gap
  // Flag when there's a >0.3 difference in confidence between agents
  const confidences = responses.map(r => ({ domain: r.domain, confidence: r.confidence }));
  const maxConfidence = Math.max(...confidences.map(c => c.confidence));
  const minConfidence = Math.min(...confidences.map(c => c.confidence));

  if (maxConfidence - minConfidence > 0.3) {
    const highConfidenceAgents = confidences.filter(c => c.confidence === maxConfidence);
    const lowConfidenceAgents = confidences.filter(c => c.confidence === minConfidence);

    conflicts.push({
      domains: [...highConfidenceAgents.map(a => a.domain), ...lowConfidenceAgents.map(a => a.domain)],
      type: 'confidence_gap',
      severity: maxConfidence - minConfidence > 0.5 ? 'high' : 'medium',
      description: `Significant confidence gap detected: ${highConfidenceAgents.map(a => a.domain).join(', ')} (${maxConfidence.toFixed(2)}) vs ${lowConfidenceAgents.map(a => a.domain).join(', ')} (${minConfidence.toFixed(2)})`,
      affectedResponses: responses.map(r => r.domain)
    });
  }

  // CONFLICT TYPE 2: Sentiment Divergence
  // Flag when agents have opposite sentiment (e.g., one optimistic, one pessimistic)
  try {
    const sentiments = await Promise.all(
      responses.map(async r => ({
        domain: r.domain,
        sentiment: await sentimentScore(r.answer)
      }))
    );

    // Check for opposite sentiments
    const positive = sentiments.filter(s => s.sentiment.score > 0.6);
    const negative = sentiments.filter(s => s.sentiment.score < 0.4);

    if (positive.length > 0 && negative.length > 0) {
      conflicts.push({
        domains: [...positive.map(s => s.domain), ...negative.map(s => s.domain)],
        type: 'divergence',
        severity: 'high',
        description: `Opposing viewpoints detected: ${positive.map(s => s.domain).join(', ')} are positive while ${negative.map(s => s.domain).join(', ')} are negative`,
        affectedResponses: [...positive.map(s => s.domain), ...negative.map(s => s.domain)]
      });
    }
  } catch (error) {
    log.error('Sentiment divergence check failed', error instanceof Error ? error : undefined);
  }

  // CONFLICT TYPE 3: Contradiction Detection (using LLM)
  // Check if responses contradict each other on key points
  if (responses.length >= 2) {
    try {
      const contradictionCheck = await checkContradictions(responses);
      if (contradictionCheck) {
        conflicts.push(contradictionCheck);
      }
    } catch (error) {
      log.error('Contradiction check failed', error instanceof Error ? error : undefined);
    }
  }

  return conflicts;
}

/**
 * Use LLM to detect factual contradictions between responses
 */
async function checkContradictions(responses: AgentResponse[]): Promise<Conflict | null> {
  const responseSummary = responses.map(r => 
    `[${r.domain.toUpperCase()}]: ${r.answer.substring(0, 500)}`
  ).join('\n\n');

  try {
    const draft = await generateBrainDraftArtifact({
      serviceId: 'rag',
      routeKey: 'rag.conflict.contradiction',
      artifactType: 'RAG_CONFLICT',
      inputData: {
        responses: responses.map(r => ({ domain: r.domain, confidence: r.confidence, answer: r.answer.substring(0, 700) })),
        responseSummary,
        instructions: {
          output: 'Return STRICT JSON only: {"hasContradiction": boolean, "severity": "low"|"medium"|"high", "description": string}.'
        }
      } as Record<string, unknown>,
      userId: 'system',
    });

    const parsed = draft.content as unknown as Record<string, unknown>;

    if (parsed.hasContradiction) {
      return {
        domains: responses.map(r => r.domain),
        type: 'contradiction',
        severity: (parsed.severity === 'low' || parsed.severity === 'medium' || parsed.severity === 'high') ? parsed.severity : 'medium',
        description: typeof parsed.description === 'string' && parsed.description ? parsed.description : 'Conflicting information detected between expert responses',
        affectedResponses: responses.map(r => r.domain)
      };
    }

    return null;
  } catch (error) {
    log.error('Contradiction LLM check failed', error instanceof Error ? error : undefined);
    return null;
  }
}

/**
 * Generate a balanced synthesis prompt when conflicts are detected
 */
export function generateSynthesisPrompt(
  query: string,
  conflictingResponses: AgentResponse[],
  conflicts: Conflict[]
): string {
  const responsesSummary = conflictingResponses.map(r => 
    `[${r.domain.toUpperCase()} Expert - Confidence: ${r.confidence.toFixed(2)}]
${r.answer}
`
  ).join('\n\n---\n\n');

  const conflictsSummary = conflicts.map(c => 
    `- ${c.type.toUpperCase()}: ${c.description} (Severity: ${c.severity})`
  ).join('\n');

  return `You are synthesizing multiple expert perspectives on a query. There are conflicts between the responses that need to be addressed fairly.

QUERY:
${query}

EXPERT RESPONSES:
${responsesSummary}

DETECTED CONFLICTS:
${conflictsSummary}

INSTRUCTIONS:
1. Acknowledge the areas of disagreement explicitly
2. Present each perspective fairly without bias
3. Explain why experts might disagree (different priorities, assumptions, or frameworks)
4. Provide a balanced synthesis that:
   - Highlights points of consensus
   - Clearly presents divergent viewpoints
   - Helps the reader understand the tradeoffs
   - Avoids choosing sides unless one position is clearly better supported

Create an executive summary that addresses these conflicts constructively.`;
}
