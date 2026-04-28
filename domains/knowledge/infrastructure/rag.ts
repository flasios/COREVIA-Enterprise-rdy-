import { createAIService } from '@platform/ai/factory';
import { storage } from '../../../interfaces/storage';
import type { KnowledgeChunk, KnowledgeDocument } from '@shared/schema';
import { queryExpansionService, type ExpandedQuery } from './queryExpansion';
import { conversationalMemoryService } from './conversationalMemory';
import { reRankingService } from './reranking';
import { createRequire } from "node:module";
import { logger } from "@platform/logging/Logger";

const require = createRequire(import.meta.url);
const EMBEDDING_BACKOFF_MS = 5 * 60 * 1000;
let embeddingBackoffUntil = 0;

function isEmbeddingLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /OpenAI rate limit exceeded|OpenAI quota exceeded|insufficient_quota|billing details/i.test(message);
}

function isEmbeddingBackoffActive(): boolean {
  return embeddingBackoffUntil > Date.now();
}

function activateEmbeddingBackoff(reason: string): void {
  const nextBackoffUntil = Date.now() + EMBEDDING_BACKOFF_MS;
  if (nextBackoffUntil <= embeddingBackoffUntil) {
    return;
  }

  embeddingBackoffUntil = nextBackoffUntil;
  logger.warn(`[RAG] Embeddings provider backoff active until ${new Date(embeddingBackoffUntil).toISOString()}: ${reason}`);
}

export interface SearchResult {
  chunk: KnowledgeChunk;
  document: KnowledgeDocument;
  score: number;
  distance?: number;
}

export interface RAGResponse {
  answer: string;
  citations: Array<{
    documentId: string;
    filename: string;
    chunkId: string;
    content: string;
    relevance: number;
  }>;
  confidence: number;
  retrievedChunks: SearchResult[];
  metadata?: {
    queryExpansion?: ExpandedQuery;
    isFollowUp?: boolean;
    sessionId?: string;
    searchTime?: number;
    totalTime?: number;
    reranked?: boolean;
    fallback?: boolean;
    resultCount?: number;
    error?: boolean;
    contextualizedQuery?: string;
    originalQuery?: string;
  };
}

export interface EnhancedSearchOptions {
  useQueryExpansion?: boolean;
  useConversationalMemory?: boolean;
  useReranking?: boolean;
  sessionId?: string;
}

export class RAGService {
  private readonly queryCache = new Map<string, { results: SearchResult[]; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private buildSessionId(userId: string, sessionId?: string): string {
    return sessionId ?? `session_${userId}_${Date.now()}`;
  }

  private async applyConversationContext(
    query: string,
    userId: string,
    sessionId: string,
    useConversationalMemory: boolean,
    metadata: Record<string, unknown>
  ): Promise<string> {
    if (!useConversationalMemory) {
      return query;
    }

    const contextual = conversationalMemoryService.contextualizeQuery(sessionId, userId, query);
    if (!contextual.isFollowUp) {
      return query;
    }

    metadata.isFollowUp = true;
    metadata.contextualizedQuery = contextual.contextualizedQuery;
    logger.info(`[RAG Enhanced] Contextualized follow-up: "${contextual.contextualizedQuery}"`);
    return contextual.contextualizedQuery;
  }

  private async runExpandedSearch(
    query: string,
    topK: number,
    userId: string,
    accessLevel: string | undefined,
    metadata: Record<string, unknown>
  ): Promise<SearchResult[]> {
    const expanded = await queryExpansionService.expandQuery(query);
    metadata.queryExpansion = expanded;
    logger.info(`[RAG Enhanced] Expanded into ${expanded.variations.length} variations`);

    const searchPromises = expanded.variations.map((variation) =>
      this.hybridSearch(variation, userId, accessLevel, Math.ceil(topK * 1.5)).catch((err) => {
        logger.warn(`[RAG Enhanced] Search failed for variation: "${variation}"`, err);
        return [] as SearchResult[];
      })
    );

    const variationResults = await Promise.all(searchPromises);
    const resultMap = new Map<string, SearchResult & { hitCount: number }>();

    for (const results of variationResults) {
      for (const result of results) {
        const existing = resultMap.get(result.chunk.id);
        if (existing) {
          existing.hitCount++;
          existing.score = Math.max(existing.score, result.score) * (1 + 0.1 * existing.hitCount);
          continue;
        }
        resultMap.set(result.chunk.id, { ...result, hitCount: 1 });
      }
    }

    const allResults = Array.from(resultMap.values())
      .sort((left, right) => right.score - left.score)
      .slice(0, topK * 2);

    logger.info(`[RAG Enhanced] Merged ${allResults.length} unique results`);
    return allResults;
  }

  private async finalizeEnhancedResults(
    query: string,
    allResults: SearchResult[],
    topK: number,
    useReranking: boolean,
    metadata: Record<string, unknown>
  ): Promise<SearchResult[]> {
    if (!useReranking || allResults.length <= 3) {
      return allResults.slice(0, topK);
    }

    const rerankedResults = await reRankingService.rerank(
      query,
      allResults.map((result) => ({
        id: result.chunk.id,
        content: result.chunk.content,
        score: result.score,
        metadata: { documentId: result.document.id, filename: result.document.filename }
      })),
      { topK, includeExplanations: false }
    );

    const resultById = new Map(allResults.map((result) => [result.chunk.id, result]));
    metadata.reranked = true;
    return rerankedResults
      .map((rerankedResult) => {
        const original = resultById.get(rerankedResult.id);
        return original ? { ...original, score: rerankedResult.rerankedScore } : null;
      })
      .filter((result): result is SearchResult => result !== null);
  }

  private formatPageInfo(metadata: Record<string, unknown>): string {
    let pageNumber = '';
    if (typeof metadata.pageNumber === 'number' || typeof metadata.pageNumber === 'string') {
      pageNumber = String(metadata.pageNumber);
    } else if (typeof metadata.page === 'number' || typeof metadata.page === 'string') {
      pageNumber = String(metadata.page);
    }
    return pageNumber ? ` (Page ${pageNumber})` : '';
  }

  // ==========================================
  // ENHANCED RAG METHODS (NEW)
  // ==========================================

  /**
   * Enhanced search with Query Expansion, Conversational Memory, and Re-ranking
   * This is the recommended method for best retrieval quality
   */
  async enhancedSearch(
    query: string,
    userId: string,
    accessLevel?: string,
    options: EnhancedSearchOptions = {},
    topK: number = 10
  ): Promise<{ results: SearchResult[]; metadata: unknown }> {
    const {
      useQueryExpansion = true,
      useConversationalMemory = true,
      useReranking = true,
      sessionId,
    } = options;

    const startTime = Date.now();
    const metadata: Record<string, unknown> = { originalQuery: query };
    const effectiveSessionId = this.buildSessionId(userId, sessionId);

    logger.info(`[RAG Enhanced] Starting enhanced search for: "${query}"`);

    try {
      const effectiveQuery = await this.applyConversationContext(query, userId, effectiveSessionId, useConversationalMemory, metadata);
      const allResults = useQueryExpansion
        ? await this.runExpandedSearch(effectiveQuery, topK, userId, accessLevel, metadata)
        : await this.hybridSearch(effectiveQuery, userId, accessLevel, topK * 2);
      const finalResults = await this.finalizeEnhancedResults(effectiveQuery, allResults, topK, useReranking, metadata);

      metadata.searchTime = Date.now() - startTime;
      metadata.resultCount = finalResults.length;

      logger.info(`[RAG Enhanced] Complete in ${metadata.searchTime}ms with ${finalResults.length} results`);

      return { results: finalResults, metadata };
    } catch (error) {
      logger.error('[RAG Enhanced] Error:', error);
      // Fallback to standard search with proper metadata
      const fallbackStartTime = Date.now();
      try {
        const results = await this.hybridSearch(query, userId, accessLevel, topK);
        return {
          results,
          metadata: {
            ...metadata,
            fallback: true,
            searchTime: Date.now() - fallbackStartTime,
            resultCount: results.length
          }
        };
      } catch (fallbackError) {
        logger.error('[RAG Enhanced] Fallback also failed:', fallbackError);
        return {
          results: [],
          metadata: {
            ...metadata,
            fallback: true,
            searchTime: Date.now() - fallbackStartTime,
            resultCount: 0,
            error: true
          }
        };
      }
    }
  }

  /**
   * Enhanced answer generation with conversation context
   */
  async generateEnhancedResponse(
    userQuery: string,
    contextChunks: SearchResult[],
    userId: string,
    options: {
      sessionId?: string;
      systemPrompt?: string;
      includeConversationContext?: boolean;
    } = {}
  ): Promise<RAGResponse> {
    const {
      sessionId,
      systemPrompt,
      includeConversationContext = true
    } = options;

    try {
      // Get conversation context if available
      let conversationContext = '';
      if (includeConversationContext && sessionId) {
        conversationContext = conversationalMemoryService.getContextForPrompt(sessionId, userId, 1500);
      }

      // Generate response with enhanced context
      const response = await this.generateWithContext(
        userQuery,
        contextChunks,
        systemPrompt,
        conversationContext
      );

      // Store this turn in conversation memory
      if (sessionId) {
        const sources = contextChunks.slice(0, 5).map(c => ({
          documentId: c.document.id,
          filename: c.document.filename,
          relevance: c.score
        }));

        conversationalMemoryService.addTurn(
          sessionId,
          userId,
          userQuery,
          response.answer,
          sources
        );

        response.metadata = {
          ...response.metadata,
          sessionId,
          isFollowUp: conversationalMemoryService.getSession(sessionId, userId).turns.length > 1
        };
      }

      return response;
    } catch (error) {
      logger.error('[RAG Enhanced] Generate response error:', error);
      throw error;
    }
  }

  /**
   * Full enhanced RAG pipeline: Search + Generate
   * Combines query expansion, conversational memory, re-ranking, and answer generation
   */
  async enhancedRAG(
    query: string,
    userId: string,
    options: {
      topK?: number;
      accessLevel?: string;
      sessionId?: string;
      systemPrompt?: string;
    } = {}
  ): Promise<RAGResponse> {
    const {
      topK = 10,
      accessLevel,
      sessionId = `session_${userId}_${Date.now()}`,
      systemPrompt
    } = options;

    logger.info(`[RAG Enhanced] Full pipeline for: "${query}"`);
    const startTime = Date.now();

    // Enhanced search
    const { results, metadata: searchMetadata } = await this.enhancedSearch(
      query,
      userId,
      accessLevel,
      { sessionId, useQueryExpansion: true, useConversationalMemory: true, useReranking: true },
      topK
    );

    // Enhanced response generation
    const response = await this.generateEnhancedResponse(
      query,
      results,
      userId,
      { sessionId, systemPrompt, includeConversationContext: true }
    );

    // Add search metadata to response
    const sm = searchMetadata as Record<string, unknown>;
    response.metadata = {
      ...response.metadata,
      queryExpansion: sm.queryExpansion as ExpandedQuery | undefined,
      isFollowUp: sm.isFollowUp as boolean | undefined,
      searchTime: sm.searchTime as number | undefined,
      totalTime: Date.now() - startTime
    } as typeof response.metadata;

    logger.info(`[RAG Enhanced] Full pipeline complete in ${Date.now() - startTime}ms`);

    return response;
  }

  async semanticSearch(
    query: string,
    userId: string,
    accessLevel?: string,
    topK: number = 10
  ): Promise<SearchResult[]> {
    try {
      logger.info(`[RAG] Semantic search - query: "${query}", topK: ${topK}, user: ${userId}, accessLevel: ${accessLevel}`);

      if (isEmbeddingBackoffActive()) {
        throw new Error('Embeddings provider backoff active');
      }

      // Check cache first
      const cacheKey = `semantic:${query}:${topK}:${accessLevel || 'all'}`;
      const cached = this.queryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        logger.info('[RAG] Returning cached results');
        return cached.results;
      }

      // Generate embedding for the query using AI service factory
      const startTime = Date.now();
      const embeddingService = createAIService('embeddings');
      const embeddings = await embeddingService.generateEmbeddings([query]);
      const embedding = embeddings[0]!;
      logger.info(`[RAG] Generated query embedding in ${Date.now() - startTime}ms`);

      // Perform vector similarity search
      const results = await storage.searchKnowledgeChunks(
        embedding,
        topK,
        accessLevel
      );

      logger.info(`[RAG] Found ${results.length} results`);

      // Update retrieval counts for chunks
      const updatePromises = results.map(result =>
        storage.incrementChunkRetrievalCount(result.chunk.id)
      );
      await Promise.all(updatePromises).catch(err =>
        logger.error('[RAG] Error updating retrieval counts:', err)
      );

      // Log the query for audit
      await this.logQuery(userId, query, results, {
        searchType: 'semantic',
        topK,
        accessLevel,
        responseTime: Date.now() - startTime
      }).catch(err => logger.error('[RAG] Error logging query:', err));

      // Cache the results
      this.queryCache.set(cacheKey, { results, timestamp: Date.now() });

      // Clean old cache entries
      this.cleanCache();

      return results;
    } catch (error) {
      if (isEmbeddingLimitError(error)) {
        activateEmbeddingBackoff(error instanceof Error ? error.message : 'Embeddings provider quota exceeded');
      }
      logger.error('[RAG] Semantic search error:', error);
      throw new Error(`Semantic search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async hybridSearch(
    query: string,
    userId: string,
    accessLevel?: string,
    topK: number = 10
  ): Promise<SearchResult[]> {
    try {
      logger.info(`[RAG] Hybrid search - query: "${query}", topK: ${topK}`);
      const startTime = Date.now();

      // Check cache first
      const cacheKey = `hybrid:${query}:${topK}:${accessLevel || 'all'}`;
      const cached = this.queryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        logger.info('[RAG] Returning cached hybrid results');
        return cached.results;
      }

      // Get semantic search results (70% weight) — fallback to empty if embedding service unavailable
      let semanticResults: SearchResult[] = [];
      try {
        semanticResults = await this.semanticSearch(query, userId, accessLevel, topK * 2);
      } catch (err) {
        logger.warn(`[RAG] Semantic search unavailable, falling back to keyword-only: ${err instanceof Error ? err.message : err}`);
      }

      // Get keyword search results (30% weight)
      const keywordResults = await storage.keywordSearchChunks(query, topK * 2, accessLevel);

      logger.info(`[RAG] Semantic: ${semanticResults.length}, Keyword: ${keywordResults.length}`);

      // Merge using Reciprocal Rank Fusion (RRF)
      const semanticWeight = semanticResults.length > 0 ? 0.7 : 0;
      const keywordWeight = semanticResults.length > 0 ? 0.3 : 1;
      const merged = this.reciprocalRankFusion(
        semanticResults,
        keywordResults,
        semanticWeight,
        keywordWeight
      );

      // Take top K results
      const topResults = merged.slice(0, topK);

      // Log the query
      await this.logQuery(userId, query, topResults, {
        searchType: 'hybrid',
        topK,
        accessLevel,
        responseTime: Date.now() - startTime,
        semanticCount: semanticResults.length,
        keywordCount: keywordResults.length
      }).catch(err => logger.error('[RAG] Error logging hybrid query:', err));

      // Cache the results
      this.queryCache.set(cacheKey, { results: topResults, timestamp: Date.now() });
      this.cleanCache();

      return topResults;
    } catch (error) {
      logger.error('[RAG] Hybrid search error:', error);
      throw new Error(`Hybrid search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateWithContext(
    userQuery: string,
    contextChunks: SearchResult[],
    systemPrompt?: string,
    conversationContext?: string
  ): Promise<RAGResponse> {
    try {
      logger.info(`[RAG] Generating response with ${contextChunks.length} context chunks`);
      const startTime = Date.now();

      // Handle empty context
      if (contextChunks.length === 0) {
        return {
          answer: "I couldn't find any relevant information in the knowledge base to answer your question. Please try rephrasing your question or contact support for assistance.",
          citations: [],
          confidence: 0,
          retrievedChunks: []
        };
      }

      // Format context chunks into a readable context string
      const contextString = this.formatContextChunks(contextChunks);

      // Build the system prompt with conversation context awareness
      const conversationAwarePrompt = conversationContext
        ? `You are an AI assistant for a UAE government digital transformation platform.
Your role is to provide accurate, helpful answers based on the knowledge base documents provided.

Guidelines:
- Answer questions using ONLY the information from the provided context
- If the context doesn't contain enough information, acknowledge this limitation
- Cite specific documents when providing information
- Use professional, clear language appropriate for government officials
- Format responses with proper structure (bullet points, paragraphs as needed)
- If asked about policies or procedures, quote relevant sections
- Always maintain accuracy over comprehensiveness
- Consider the conversation history when answering follow-up questions
- If the user refers to something from a previous answer, use that context`
        : null;

      const finalSystemPrompt = systemPrompt || conversationAwarePrompt ||
        `You are an AI assistant for a UAE government digital transformation platform.
Your role is to provide accurate, helpful answers based on the knowledge base documents provided.

Guidelines:
- Answer questions using ONLY the information from the provided context
- If the context doesn't contain enough information, acknowledge this limitation
- Cite specific documents when providing information
- Use professional, clear language appropriate for government officials
- Format responses with proper structure (bullet points, paragraphs as needed)
- If asked about policies or procedures, quote relevant sections
- Always maintain accuracy over comprehensiveness`;

      // Build the user prompt with context and conversation history
      const conversationSection = conversationContext
        ? `${conversationContext}\n`
        : '';

      const userPrompt = `${conversationSection}Context from knowledge base:

${contextString}

---

User Question: ${userQuery}

Please provide a comprehensive answer based on the context above. Include specific references to the source documents.`;

      // Generate response using AI service factory
      const aiService = createAIService('text');
      const answer = await aiService.generateText({
        messages: [{ role: 'user', content: userPrompt }],
        systemPrompt: finalSystemPrompt,
        maxTokens: 4000,
        temperature: 0.7
      });

      // Calculate confidence score based on retrieval quality
      const confidence = this.calculateConfidence(contextChunks, userQuery);

      // Build citations with enhanced metadata
      const citations = contextChunks.slice(0, 5).map(result => {
        const metadata = (result.chunk.metadata ?? {}) as Record<string, unknown>;
        return {
          documentId: result.document.id,
          filename: result.document.filename,
          chunkId: result.chunk.id,
          content: result.chunk.content.substring(0, 200) + (result.chunk.content.length > 200 ? '...' : ''),
          relevance: result.score,
          // Enhanced metadata
          chunkStart: metadata.startPosition,
          chunkEnd: metadata.endPosition,
          page: metadata.pageNumber || metadata.page,
          sectionPath: metadata.sectionPath,
          excerpt: result.chunk.content.substring(0, 200)
        };
      });

      logger.info(`[RAG] Generated response in ${Date.now() - startTime}ms with confidence ${confidence.toFixed(2)}`);

      return {
        answer,
        citations,
        confidence,
        retrievedChunks: contextChunks
      };
    } catch (error) {
      logger.error('[RAG] Generate with context error:', error);
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async rerankResults(chunks: SearchResult[], query: string): Promise<SearchResult[]> {
    try {
      logger.info(`[RAG] Reranking ${chunks.length} results`);

      // Calculate rerank scores for each chunk
      const rerankedChunks = chunks.map(chunk => {
        let score = chunk.score;

        // Boost based on retrieval count (popularity)
        const retrievalBoost = Math.min((chunk.chunk.retrievalCount || 0) / 100, 0.1);
        score += retrievalBoost;

        // Boost based on chunk relevance score
        const chunkQualityScore = Number.parseFloat(chunk.chunk.relevanceScore?.toString() || '0');
        score += chunkQualityScore * 0.15;

        // Boost based on document quality (0-100 scale, convert to 0-0.2 multiplier)
        // High quality documents (80-100) get 0.16-0.20 boost
        // Medium quality (60-79) get 0.12-0.15 boost
        // Fair quality (40-59) get 0.08-0.11 boost
        // Poor quality (0-39) get 0-0.07 boost
        // Unrated documents (no quality score) get 0 boost
        // Handle quality scores: 0 for missing, convert 0-1 scale to 0-100, use 0-100 as-is
        let docQualityScore = 0;
        if (chunk.document.qualityScore) {
          const rawScore = Number.parseFloat(chunk.document.qualityScore.toString());
          // If score is fractional (0-1 scale), convert to 0-100
          docQualityScore = rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore);
        }
        const qualityBoost = (docQualityScore / 100) * 0.2; // 0 for unrated, up to 0.2 for excellent
        score += qualityBoost;

        // Boost based on document usage
        const usageBoost = Math.min((chunk.document.usageCount || 0) / 1000, 0.05);
        score += usageBoost;

        // Check for exact keyword matches (boost significantly)
        const queryLower = query.toLowerCase();
        const contentLower = chunk.chunk.content.toLowerCase();
        const exactMatchBoost = queryLower.split(' ').filter(word =>
          word.length > 3 && contentLower.includes(word)
        ).length * 0.02;
        score += exactMatchBoost;

        return {
          ...chunk,
          score
        };
      });

      // Sort by new score
      rerankedChunks.sort((a, b) => b.score - a.score);

      logger.info(`[RAG] Reranking complete. Top score: ${rerankedChunks[0]?.score.toFixed(3)}`);

      return rerankedChunks;
    } catch (error) {
      logger.error('[RAG] Rerank error:', error);
      // Return original chunks if reranking fails
      return chunks;
    }
  }

  // Helper: Reciprocal Rank Fusion algorithm
  private reciprocalRankFusion(
    semanticResults: SearchResult[],
    keywordResults: SearchResult[],
    semanticWeight: number,
    keywordWeight: number
  ): SearchResult[] {
    const k = 60; // RRF constant
    const scoreMap = new Map<string, { result: SearchResult; score: number }>();

    // Score semantic results
    semanticResults.forEach((result, index) => {
      const rank = index + 1;
      const score = semanticWeight * (1 / (k + rank));
      scoreMap.set(result.chunk.id, { result, score });
    });

    // Score keyword results and merge
    keywordResults.forEach((result, index) => {
      const rank = index + 1;
      const score = keywordWeight * (1 / (k + rank));

      const existing = scoreMap.get(result.chunk.id);
      if (existing) {
        existing.score += score;
      } else {
        scoreMap.set(result.chunk.id, { result, score });
      }
    });

    // Convert to array and sort by combined score
    const merged = Array.from(scoreMap.values())
      .map(({ result, score }) => ({ ...result, score }))
      .sort((a, b) => b.score - a.score);

    return merged;
  }

  // Helper: Format context chunks for prompt
  private formatContextChunks(chunks: SearchResult[]): string {
    return chunks.map((result, index) => {
      const metadata = (result.chunk.metadata ?? {}) as Record<string, unknown>;
      const pageInfo = this.formatPageInfo(metadata);

      return `[Document ${index + 1}: ${result.document.filename}${pageInfo}]
${result.chunk.content}
---`;
    }).join('\n\n');
  }

  // Helper: Calculate confidence score
  private calculateConfidence(chunks: SearchResult[], _query: string): number {
    if (chunks.length === 0) return 0;

    // Base confidence on top result score
    const topScore = chunks[0]?.score || 0;
    let confidence = Math.min(topScore, 1);

    // Boost if multiple high-quality results
    const highQualityCount = chunks.filter(c => c.score > 0.7).length;
    confidence += Math.min(highQualityCount * 0.05, 0.15);

    // Reduce if results have low diversity (same document)
    const uniqueDocuments = new Set(chunks.map(c => c.document.id)).size;
    if (uniqueDocuments === 1 && chunks.length > 3) {
      confidence *= 0.9;
    }

    // Ensure confidence is between 0 and 1
    return Math.min(Math.max(confidence, 0), 1);
  }

  // Helper: Log query for audit
  private async logQuery(
    userId: string,
    query: string,
    results: SearchResult[],
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      // Skip logging for system users (e.g., FinanceAgent queries) to avoid FK constraint errors
      if (userId === 'system' || !userId) {
        return;
      }

      const chunkIds = results.map(r => r.chunk.id);
      const topResults = results.slice(0, 5).map(r => ({
        chunkId: r.chunk.id,
        documentId: r.document.id,
        score: r.score,
        filename: r.document.filename
      }));

      await storage.logKnowledgeQuery(userId, query, chunkIds, {
        ...metadata,
        topResults,
        resultCount: results.length
      });
    } catch (error) {
      logger.error('Error logging knowledge query:', error);
      // Don't throw - logging failure shouldn't break the search
    }
  }

  // Helper: Clean old cache entries
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of Array.from(this.queryCache.entries())) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.queryCache.delete(key);
      }
    }
  }

  // ==========================================
  // MULTI-AGENT RAG METHODS
  // ==========================================

  /**
   * Run a domain-specific RAG agent
   */
  async runAgent(
    domain: string,
    query: string,
    userId: string,
    options?: {
      accessLevel?: string;
      reportId?: string;
      retrievalOptions?: unknown;
    }
  ): Promise<unknown> {
    try {
      logger.info(`[RAG] Running ${domain} agent for query: "${query}"`);
      const startTime = Date.now();

      // Import agent registry
      const { getAgentRegistry } = await import('./agents/agentRegistry');
      const registry = getAgentRegistry(storage);
      const agent = registry.getAgent(domain);

      if (!agent) {
        throw new Error(`Unknown agent domain: ${domain}. Supported: ${registry.getSupportedDomains().join(', ')}`);
      }

      // Build agent context
      const context = {
        query,
        userId,
        accessLevel: options?.accessLevel,
        reportId: options?.reportId,
        retrievalOptions: options?.retrievalOptions as Record<string, unknown> | undefined
      };

      // Run the agent
      const response = await agent.run(context);

      // Log the query for audit
      await this.logQuery(userId, query, [], {
        agent: domain,
        confidence: response.confidence,
        rewrittenQuery: response.metadata?.rewrittenQuery,
        chunksRetrieved: response.metadata?.chunksRetrieved,
        responseTime: Date.now() - startTime,
        agentType: domain
      }).catch(err => logger.error('[RAG] Error logging agent query:', err));

      logger.info(`[RAG] ${domain} agent completed in ${Date.now() - startTime}ms with confidence ${response.confidence.toFixed(1)}%`);

      return response;
    } catch (error) {
      logger.error(`[RAG] Agent error (${domain}):`, error);
      throw error;
    }
  }

  /**
   * Get list of supported agent domains
   */
  getSupportedAgents(): string[] {
    try {
      // Import agent registry synchronously for simple getter

      const { getAgentRegistry } = require('./agents/agentRegistry');
      const registry = getAgentRegistry(storage);
      return registry.getSupportedDomains();
    } catch (error) {
      logger.error('[RAG] Error getting supported agents:', error);
      return ['finance', 'security', 'technical', 'business'];
    }
  }

  /**
   * Generate embedding for a single text
   * Used by synergy detector and other services
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const embeddingService = createAIService('embeddings');
      const embeddings = await embeddingService.generateEmbeddings([text]);
      return embeddings[0]!;
    } catch (error) {
      logger.error('[RAG] Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const ragService = new RAGService();
