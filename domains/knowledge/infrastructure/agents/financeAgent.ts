import { BaseRAGAgent, type RAGAgentContext, type AgentResponse, type DomainConfig } from './baseAgent';
import type { DocumentChunk } from '@shared/aiAdapters';
import type { IStorage } from '../../../../interfaces/storage';
import { rewriteQueryForDomain } from '../utils/queryRewriter';
import { rerankByDomain } from '../utils/domainReranker';
import { createAIService } from '@platform/ai/factory';
import { storage as defaultStorage } from '../../../../interfaces/storage';
import { logger } from '@platform/logging/Logger';
import type { SearchResult } from '../rag';

const log = logger.service('FinanceAgent');

function toChunkMetadata(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {};
}

function getDocumentTitle(value: unknown): string {
  return typeof value === 'string' ? value : 'Unknown';
}

const ROI_PATTERNS = [
  /ROI[:\s]+of\s+(\d+(?:\.\d+)?)\s*%/i,
  /ROI[:\s]+(\d+(?:\.\d+)?)\s*%/i,
  /(\d+(?:\.\d+)?)\s*%\s+ROI/i,
];

const DISCOUNT_RATE_PATTERNS = [
  /discount\s+rate[:\s]+of\s+(\d+(?:\.\d+)?)\s*%/i,
  /discount\s+rate[:\s]+(\d+(?:\.\d+)?)\s*%/i,
];

function firstCapturedValue(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

function extractCapturedValue(text: string, pattern: RegExp): string | undefined {
  const match = pattern.exec(text);
  return match?.[1];
}

function parseNumericValue(value?: string): number | undefined {
  return value ? Number.parseFloat(value) : undefined;
}

function detectFinancialRisk(response: string): string | undefined {
  const normalized = response.toLowerCase();

  if (normalized.includes('high financial risk')) return 'high';
  if (normalized.includes('medium financial risk')) return 'medium';
  if (normalized.includes('low financial risk')) return 'low';

  return undefined;
}

// Default financial analysis prompt template
const DEFAULT_FINANCE_PROMPT = `You are a UAE Government Financial Analysis Expert. Analyze the following query using the provided knowledge base context.

QUERY: {query}

KNOWLEDGE BASE CONTEXT:
{context}

Provide a comprehensive financial analysis including:
1. Total implementation cost estimate (in AED)
2. Expected ROI percentage
3. Payback period (in months or years)
4. NPV calculation with discount rate
5. TCO breakdown (implementation, operational, maintenance)
6. Risk-adjusted financial scenarios
7. Cost savings opportunities

Use specific numbers aligned with UAE government project standards. Format currency as "AED X,XXX,XXX" or "AED XM" for millions.
Include explicit keywords like "ROI:", "NPV:", "payback:", "Total Cost:", "discount rate:" to help extraction.`;

export class FinanceAgent extends BaseRAGAgent {
  domain = 'finance';
  
  config: DomainConfig = {
    domain: 'finance',
    keywords: ['budget', 'cost', 'ROI', 'NPV', 'TCO', 'payback', 'financial', 'AED', 'investment', 'savings'],
    fallbackTerms: ['economic', 'fiscal', 'monetary', 'expenditure', 'revenue'],
    minScore: 0.6,
    rerankBoost: 1.25,
    topK: 8
  };
  
  /**
   * Constructor with optional storage and promptTemplate for standalone usage
   * When called without arguments, uses default storage and built-in prompt template
   */
  constructor(storage?: IStorage, promptTemplate?: string) {
    const resolvedStorage = storage ?? (defaultStorage as unknown as IStorage);
    super(resolvedStorage, promptTemplate || DEFAULT_FINANCE_PROMPT);
  }
  
  async retrieveContext(context: RAGAgentContext): Promise<DocumentChunk[]> {
    // Rewrite query with financial booster terms
    const rewrittenQuery = rewriteQueryForDomain(context.query, this.config);
    
    // Import RAG service dynamically to avoid circular deps
    const { ragService } = await import('../rag');
    
    // Retrieve chunks using hybrid search
    const searchResults = await ragService.hybridSearch(
      rewrittenQuery,
      context.userId,
      context.accessLevel,
      context.retrievalOptions?.topK || this.config.topK,
    );
    
    // Convert SearchResult[] to DocumentChunk[]
    const chunks: DocumentChunk[] = searchResults.map((result: SearchResult) => ({
      documentId: result.document.id,
      chunkId: result.chunk.id,
      content: result.chunk.content,
      relevance: result.score,
      metadata: {
        ...toChunkMetadata(result.chunk.metadata),
        title: result.document.filename,
        documentTitle: result.document.filename
      }
    }));
    
    // Filter by minimum score
    const filtered = chunks.filter(c => (c.relevance || 0) >= this.config.minScore);
    
    // Rerank with domain boost
    const reranked = rerankByDomain(filtered, this.config);
    
    return reranked;
  }
  
  async generateResponse(context: RAGAgentContext, chunks: DocumentChunk[]): Promise<AgentResponse> {
    const aiService = createAIService('text');
    
    const prompt = this.formatPrompt(this.promptTemplate, context.query, chunks);
    
    const answer = await aiService.generateText({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4096,
      temperature: 0.3
    });
    
    // Extract citations from chunks
    const citations = chunks.slice(0, 5).map((chunk, idx) => {
      const rawTitle = chunk.metadata?.documentTitle || chunk.metadata?.title || 'Unknown';
      const documentTitle = getDocumentTitle(rawTitle);
      return {
      documentId: chunk.documentId,
      documentTitle,
      chunkId: chunk.chunkId,
      content: chunk.content.substring(0, 200),
      relevance: chunk.relevance || 0,
      citationNumber: idx + 1,
      metadata: chunk.metadata
      };
    });
    
    // Calculate confidence
    const avgRelevance = chunks.length > 0 
      ? chunks.reduce((sum, c) => sum + (c.relevance || 0), 0) / chunks.length 
      : 0;
    const confidence = Math.min(avgRelevance * 100, 95);
    
    // Extract financial insights
    const domainInsights = this.extractDomainInsights(answer);
    
    return {
      domain: this.domain,
      answer,
      citations,
      confidence,
      domainInsights,
      metadata: {
        chunksRetrieved: chunks.length,
        averageRelevance: avgRelevance,
        rewrittenQuery: rewriteQueryForDomain(context.query, this.config)
      }
    };
  }
  
  protected extractDomainInsights(response: string): Record<string, unknown> | undefined {
    const insights: Record<string, unknown> = {};

    const roiEstimate = parseNumericValue(firstCapturedValue(response, ROI_PATTERNS));
    if (roiEstimate !== undefined) insights.roiEstimate = roiEstimate;

    const npvEstimate = extractCapturedValue(response, /NPV.*?(AED\s*[\d,.]+\s*[KMB]?)/i);
    if (npvEstimate) insights.npvEstimate = npvEstimate;

    const paybackMatch = /(?:payback[:\s]+)?(\d+(?:\.\d+)?)\s*(year|month)s?/i.exec(response);
    if (paybackMatch?.[1] && paybackMatch[2]) insights.paybackPeriod = `${paybackMatch[1]} ${paybackMatch[2]}s`;

    const totalCostEstimate = extractCapturedValue(response, /(?:total\s+)?(?:cost|investment)[:\s]+AED\s*([\d,.]+\s*[KMB]?)/i);
    if (totalCostEstimate) insights.totalCostEstimate = totalCostEstimate;

    const totalBenefitEstimate = extractCapturedValue(response, /(?:total\s+)?(?:benefit|return)[:\s]+AED\s*([\d,.]+\s*[KMB]?)/i);
    if (totalBenefitEstimate) insights.totalBenefitEstimate = totalBenefitEstimate;

    const discountRate = parseNumericValue(firstCapturedValue(response, DISCOUNT_RATE_PATTERNS));
    if (discountRate !== undefined) insights.discountRate = discountRate;

    const tco = extractCapturedValue(response, /TCO[:\s]+AED\s*([\d,.]+\s*[KMB]?)/i);
    if (tco) insights.tco = tco;

    const financialRisk = detectFinancialRisk(response);
    if (financialRisk) insights.financialRisk = financialRisk;

    const estimatedSavings = extractCapturedValue(response, /(?:cost\s+)?savings?[:\s]+AED\s*([\d,.]+\s*[KMB]?)/i);
    if (estimatedSavings) insights.estimatedSavings = estimatedSavings;
    
    log.debug('Extracted insights', { insightCount: Object.keys(insights).length });
    
    return Object.keys(insights).length > 0 ? insights : undefined;
  }
}
