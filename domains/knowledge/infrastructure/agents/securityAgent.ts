import { BaseRAGAgent, type RAGAgentContext, type AgentResponse, type DomainConfig } from './baseAgent';
import type { DocumentChunk } from '@shared/aiAdapters';
import { rewriteQueryForDomain } from '../utils/queryRewriter';
import { rerankByDomain } from '../utils/domainReranker';
import { createAIService } from '@platform/ai/factory';
import type { SearchResult } from '../rag';

function toChunkMetadata(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {};
}

function getDocumentTitle(value: unknown): string {
  return typeof value === 'string' ? value : 'Unknown';
}

export class SecurityAgent extends BaseRAGAgent {
  domain = 'security';
  
  config: DomainConfig = {
    domain: 'security',
    keywords: ['security', 'compliance', 'risk', 'cybersecurity', 'threat', 'encryption', 'authentication', 'authorization', 'GDPR', 'data protection'],
    fallbackTerms: ['protection', 'vulnerability', 'audit', 'control', 'safeguard'],
    minScore: 0.65,
    rerankBoost: 1.3,
    topK: 7
  };
  
  async retrieveContext(context: RAGAgentContext): Promise<DocumentChunk[]> {
    const rewrittenQuery = rewriteQueryForDomain(context.query, this.config);
    
    const { ragService } = await import('../rag');
    
    const searchResults = await ragService.hybridSearch(
      rewrittenQuery,
      context.userId,
      context.accessLevel,
      context.retrievalOptions?.topK || this.config.topK,
    );
    
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
    
    const filtered = chunks.filter(c => (c.relevance || 0) >= this.config.minScore);
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
    
    const avgRelevance = chunks.length > 0 
      ? chunks.reduce((sum, c) => sum + (c.relevance || 0), 0) / chunks.length 
      : 0;
    const confidence = Math.min(avgRelevance * 100, 95);
    
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
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected extractDomainInsights(response: string): Record<string, any> | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insights: Record<string, any> = {};
    
    // Risk level
    if (response.toLowerCase().includes('high risk')) insights.riskLevel = 'high';
    else if (response.toLowerCase().includes('medium risk')) insights.riskLevel = 'medium';
    else if (response.toLowerCase().includes('low risk')) insights.riskLevel = 'low';
    
    // Compliance frameworks mentioned
    const frameworks = ['ISO 27001', 'NIST', 'UAE IAR', 'Federal Law No. 12'];
    insights.frameworks = frameworks.filter(fw => response.includes(fw));
    
    return Object.keys(insights).length > 0 ? insights : undefined;
  }
}
