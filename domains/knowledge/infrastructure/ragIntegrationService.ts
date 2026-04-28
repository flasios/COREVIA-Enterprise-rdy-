import { ragService, type SearchResult } from './rag';
import { storage } from '../../../interfaces/storage';
import { logger } from "@platform/logging/Logger";

export interface RAGContextParams {
  type: 'business_case' | 'requirements' | 'strategic_fit';
  promptSeed: string;
  userId: string;
  accessLevel: string;
  useEnhancedSearch?: boolean;
  sessionId?: string;
}

export interface RAGContext {
  contextText: string;
  chunks: SearchResult[];
  citations: Array<{
    documentId: string;
    documentTitle: string;
    chunkId: string;
    relevance: number;
  }>;
  metadata?: {
    queryExpansion?: unknown;
    searchTime?: number;
    reranked?: boolean;
  };
}

export interface RetrievalConfidence {
  score: number;
  tier: 'high' | 'medium' | 'low';
}

/** Internal type for enhanced search metadata */
interface EnhancedSearchMeta {
  queryExpansion?: unknown;
  searchTime?: number;
  reranked?: boolean;
}

function normalizeTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : [];
}

function stringifyMetadataValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable]';
    }
  }

  return '';
}

function appendSectionLines(target: string[], lines: string[]): void {
  target.push(...lines);
}

function serializeContextValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable]';
    }
  }

  return String(value);
}

/**
 * Build RAG context tailored to different AI generation types
 * Now supports enhanced search with Query Expansion, Conversational Memory, and Re-ranking
 */
export async function buildRAGContext(params: RAGContextParams): Promise<RAGContext> {
  const { type, promptSeed, userId, accessLevel, useEnhancedSearch = true, sessionId } = params;

  try {
    logger.info(`[RAG Integration] Building context for type: ${type}, user: ${userId}, enhanced: ${useEnhancedSearch}`);

    let chunks: SearchResult[] = [];
    let contextText = '';
    let metadata: EnhancedSearchMeta = {};

    switch (type) {
      case 'business_case': {
        // Business Case: emphasize policy/finance tags, topK=12, metadata filters
        logger.info('[RAG Integration] Business case mode: policy/finance focus, topK=12');

        // Use enhanced search for better retrieval quality
        const searchQuery = `${promptSeed} financial analysis cost benefit policy compliance budget UAE government`;

        if (useEnhancedSearch) {
          const { results, metadata: searchMeta } = await ragService.enhancedSearch(
            searchQuery,
            userId,
            accessLevel,
            {
              useQueryExpansion: true,
              useConversationalMemory: !!sessionId,
              useReranking: true,
              sessionId
            },
            15,
          );
          chunks = results;
          const sm1 = searchMeta as EnhancedSearchMeta;
          metadata = {
            queryExpansion: sm1?.queryExpansion,
            searchTime: sm1?.searchTime || 0,
            reranked: sm1?.reranked || false
          };
          logger.info(`[RAG Integration] Enhanced search returned ${chunks.length} results in ${metadata.searchTime}ms`);
        } else {
          chunks = await ragService.hybridSearch(searchQuery, userId, accessLevel, 12);
        }

        // Filter for policy/finance tags if metadata available
        chunks = chunks.filter(chunk => {
          const chunkMeta = chunk.chunk.metadata as Record<string, unknown> | null;
          const tags = normalizeTags(chunkMeta?.tags);
          if (tags.length === 0) return true;
          return tags.some((tag: string) =>
            tag.toLowerCase().includes('policy') ||
            tag.toLowerCase().includes('finance') ||
            tag.toLowerCase().includes('budget') ||
            tag.toLowerCase().includes('compliance')
          );
        });

        // Format with emphasis on financial and policy aspects
        contextText = formatBusinessCaseContext(chunks);
        break;
      }

      case 'requirements': {
        // Requirements: favor technical specs, topK=15, tighter overlap filtering
        logger.info('[RAG Integration] Requirements mode: technical focus, topK=15');

        // Use enhanced search for technical requirements
        const searchQuery = `${promptSeed} technical requirements specifications system integration architecture UAE government`;

        if (useEnhancedSearch) {
          const { results, metadata: searchMeta } = await ragService.enhancedSearch(
            searchQuery,
            userId,
            accessLevel,
            {
              useQueryExpansion: true,
              useConversationalMemory: !!sessionId,
              useReranking: true,
              sessionId
            },
            20,
          );
          // Apply tighter overlap filtering
          chunks = applyOverlapFiltering(results, 15);
          const sm2 = searchMeta as EnhancedSearchMeta;
          metadata = {
            queryExpansion: sm2?.queryExpansion,
            searchTime: sm2?.searchTime || 0,
            reranked: sm2?.reranked || false
          };
          logger.info(`[RAG Integration] Enhanced requirements search returned ${chunks.length} results in ${metadata.searchTime}ms`);
        } else {
          const allChunks = await ragService.semanticSearch(searchQuery, userId, accessLevel, 20);
          chunks = applyOverlapFiltering(allChunks, 15);
        }

        // Format with emphasis on technical details
        contextText = formatRequirementsContext(chunks);
        break;
      }

      case 'strategic_fit': {
        // Strategic Fit: enhanced search with portfolio focus
        logger.info('[RAG Integration] Strategic fit mode: enhanced search, portfolio focus');

        const searchQuery = `${promptSeed} strategic alignment portfolio objectives goals vision mission UAE Vision 2071`;

        if (useEnhancedSearch) {
          const { results, metadata: searchMeta } = await ragService.enhancedSearch(
            searchQuery,
            userId,
            accessLevel,
            {
              useQueryExpansion: true,
              useConversationalMemory: !!sessionId,
              useReranking: true,
              sessionId
            },
            15,
          );
          chunks = results.slice(0, 12);
          const sm3 = searchMeta as EnhancedSearchMeta;
          metadata = {
            queryExpansion: sm3?.queryExpansion,
            searchTime: sm3?.searchTime || 0,
            reranked: sm3?.reranked || false
          };
          logger.info(`[RAG Integration] Enhanced strategic fit search returned ${chunks.length} results in ${metadata.searchTime}ms`);
        } else {
          const semanticChunks = await ragService.semanticSearch(searchQuery, userId, accessLevel, 15);
          const keywordChunks = await storage.keywordSearchChunks(searchQuery, 15, accessLevel);
          chunks = mergeWithCustomWeights(semanticChunks, keywordChunks, 0.6, 0.4, 12);
        }

        // Format with emphasis on strategic alignment
        contextText = formatStrategicFitContext(chunks);
        break;
      }
    }

    // Build citations from chunks
    const citations = chunks.slice(0, 5).map(chunk => ({
      documentId: chunk.document.id,
      documentTitle: chunk.document.filename,
      chunkId: chunk.chunk.id,
      relevance: chunk.score
    }));

    logger.info(`[RAG Integration] Built context with ${chunks.length} chunks, ${citations.length} citations`);

    return {
      contextText,
      chunks,
      citations,
      metadata
    };

  } catch (error) {
    logger.error('[RAG Integration] Error building context:', error);
    // Return empty context on error to maintain backward compatibility
    return {
      contextText: '',
      chunks: [],
      citations: []
    };
  }
}

/**
 * Calculate retrieval confidence using weighted formula
 */
export function calculateRetrievalConfidence(chunks: SearchResult[]): RetrievalConfidence {
  if (chunks.length === 0) {
    return { score: 0, tier: 'low' };
  }

  // Calculate max score
  const maxScore = chunks[0]?.score || 0;

  // Calculate mean score
  const meanScore = chunks.reduce((sum, c) => sum + c.score, 0) / chunks.length;

  // Calculate unique document ratio
  const uniqueDocuments = new Set(chunks.map(c => c.document.id)).size;
  const uniqueDocumentRatio = uniqueDocuments / chunks.length;

  // Calculate coverage score (how well the query terms are covered)
  // Simple heuristic: higher scores indicate better coverage
  const coverageScore = chunks.filter(c => c.score > 0.5).length / chunks.length;

  // Weighted formula: 0.5 * maxScore + 0.3 * meanScore + 0.1 * uniqueDocumentRatio + 0.1 * coverageScore
  const rawScore =
    0.5 * maxScore +
    0.3 * meanScore +
    0.1 * uniqueDocumentRatio +
    0.1 * coverageScore;

  // Normalize to 0-1 (scores are already typically 0-1)
  const score = Math.min(Math.max(rawScore, 0), 1);

  // Determine tier
  let tier: 'high' | 'medium' | 'low';
  if (score >= 0.75) {
    tier = 'high';
  } else if (score >= 0.5) {
    tier = 'medium';
  } else {
    tier = 'low';
  }

  logger.info(`[RAG Integration] Confidence: ${(score * 100).toFixed(1)}% (${tier})`);
  logger.info(`[RAG Integration] Breakdown - max: ${maxScore.toFixed(3)}, mean: ${meanScore.toFixed(3)}, unique: ${uniqueDocumentRatio.toFixed(3)}, coverage: ${coverageScore.toFixed(3)}`);

  return { score, tier };
}

/**
 * Format context for business case generation
 * Limited to prevent token overflow - max 5 chunks, 2000 chars each
 */
function formatBusinessCaseContext(chunks: SearchResult[]): string {
  if (chunks.length === 0) return '';

  const MAX_CHUNKS = 5;
  const MAX_CHUNK_LENGTH = 2000;

  const sections: string[] = [
    '=== RETRIEVED KNOWLEDGE BASE CONTEXT ===',
    '',
    'The following information from the knowledge base may inform your business case analysis:',
    ''
  ];

  const limitedChunks = chunks.slice(0, MAX_CHUNKS);

  limitedChunks.forEach((chunk, index) => {
    const metadata = chunk.chunk.metadata as Record<string, unknown> | null ?? {};
    const pageNumber = stringifyMetadataValue(metadata.pageNumber);
    const pageInfo = pageNumber ? ` (Page ${pageNumber})` : '';
    const tags = normalizeTags(metadata.tags);
    const tagsInfo = tags.length > 0 ? ` [Tags: ${tags.join(', ')}]` : '';

    let content = chunk.chunk.content.trim();
    if (content.length > MAX_CHUNK_LENGTH) {
      content = content.substring(0, MAX_CHUNK_LENGTH) + '...';
    }

    appendSectionLines(sections, [
      `[Source ${index + 1}: ${chunk.document.filename}${pageInfo}${tagsInfo}]`,
      `Relevance: ${(chunk.score * 100).toFixed(1)}%`,
      '',
      content,
      '',
      '---',
      '',
    ]);
  });

  appendSectionLines(sections, ['=== END KNOWLEDGE BASE CONTEXT ===', '']);

  return sections.join('\n');
}

/**
 * Format context for requirements analysis
 * Limited to prevent token overflow - max 3 chunks, 2000 chars each
 */
function formatRequirementsContext(chunks: SearchResult[]): string {
  if (chunks.length === 0) return '';

  const MAX_CHUNKS = 3;
  const MAX_CHUNK_LENGTH = 2000;

  const sections: string[] = [
    '=== TECHNICAL REQUIREMENTS CONTEXT ===',
    '',
    'Referenced technical specifications and requirements:',
    ''
  ];

  const limitedChunks = chunks.slice(0, MAX_CHUNKS);

  limitedChunks.forEach((chunk, index) => {
    const metadata = chunk.chunk.metadata as Record<string, unknown> | null ?? {};
    const section = (metadata.section as string) || 'General';

    let content = chunk.chunk.content.trim();
    if (content.length > MAX_CHUNK_LENGTH) {
      content = content.substring(0, MAX_CHUNK_LENGTH) + '...';
    }

    appendSectionLines(sections, [`[Requirement ${index + 1}: ${chunk.document.filename} - ${section}]`, content, '']);
  });

  appendSectionLines(sections, ['=== END REQUIREMENTS CONTEXT ===', '']);

  return sections.join('\n');
}

/**
 * Format context for strategic fit analysis
 * Limited to prevent token overflow - max 4 chunks, 2000 chars each
 */
function formatStrategicFitContext(chunks: SearchResult[]): string {
  if (chunks.length === 0) return '';

  const MAX_CHUNKS = 4;
  const MAX_CHUNK_LENGTH = 2000;

  const sections: string[] = [
    '=== STRATEGIC ALIGNMENT CONTEXT ===',
    '',
    'Relevant strategic objectives and portfolio information:',
    ''
  ];

  const limitedChunks = chunks.slice(0, MAX_CHUNKS);

  limitedChunks.forEach((chunk, index) => {
    let content = chunk.chunk.content.trim();
    if (content.length > MAX_CHUNK_LENGTH) {
      content = content.substring(0, MAX_CHUNK_LENGTH) + '...';
    }

    appendSectionLines(sections, [
      `[Strategic Reference ${index + 1}: ${chunk.document.filename}]`,
      `Match Confidence: ${(chunk.score * 100).toFixed(1)}%`,
      '',
      content,
      '',
      '---',
      '',
    ]);
  });

  appendSectionLines(sections, ['=== END STRATEGIC CONTEXT ===', '']);

  return sections.join('\n');
}

/**
 * Apply overlap filtering to remove duplicate content from same document sections
 */
function applyOverlapFiltering(chunks: SearchResult[], targetCount: number): SearchResult[] {
  const filtered: SearchResult[] = [];
  const seenSections = new Set<string>();

  for (const chunk of chunks) {
    if (filtered.length >= targetCount) break;

    const metadata = chunk.chunk.metadata as Record<string, unknown> | null ?? {};
    const sectionKey = `${chunk.document.id}-${(metadata.section as string) || 'default'}`;

    // Only include if we haven't seen this document section yet
    if (!seenSections.has(sectionKey)) {
      filtered.push(chunk);
      seenSections.add(sectionKey);
    }
  }

  // If we don't have enough after filtering, add more chunks
  if (filtered.length < targetCount && chunks.length > filtered.length) {
    const remaining = chunks.filter(c => !filtered.includes(c)).slice(0, targetCount - filtered.length);
    filtered.push(...remaining);
  }

  return filtered;
}

/**
 * Merge semantic and keyword results with custom weights
 */
function mergeWithCustomWeights(
  semanticChunks: SearchResult[],
  keywordChunks: SearchResult[],
  semanticWeight: number,
  keywordWeight: number,
  topK: number
): SearchResult[] {
  const scoreMap = new Map<string, { chunk: SearchResult; score: number }>();
  const k = 60; // RRF constant

  // Score semantic results
  semanticChunks.forEach((chunk, index) => {
    const rank = index + 1;
    const score = semanticWeight * (1 / (k + rank));
    scoreMap.set(chunk.chunk.id, { chunk, score });
  });

  // Score keyword results and merge
  keywordChunks.forEach((chunk, index) => {
    const rank = index + 1;
    const score = keywordWeight * (1 / (k + rank));

    const existing = scoreMap.get(chunk.chunk.id);
    if (existing) {
      existing.score += score;
    } else {
      scoreMap.set(chunk.chunk.id, { chunk, score });
    }
  });

  // Convert to array, sort by score, and take top K
  const merged = Array.from(scoreMap.values())
    .map(({ chunk, score }) => ({ ...chunk, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return merged;
}

/**
 * Simple in-memory cache for suggestions
 */
const suggestionCache = new Map<string, { suggestions: unknown[]; timestamp: number }>();
const SUGGESTION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Create a stable hash from context fields for cache key generation
 * Only includes non-empty values and sorts keys for consistency
 */
function createContextHash(context: Record<string, unknown>): string {
  const filtered = Object.entries(context)
    .filter(([key, value]) => {
      // Exclude non-context fields (userId, accessLevel, stage, demandId, limit)
      const excludeKeys = ['userId', 'accessLevel', 'stage', 'demandId', 'limit'];
      if (excludeKeys.includes(key)) return false;

      // Only include non-empty values
      return value !== undefined && value !== null && value !== '';
    })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${serializeContextValue(v)}`)
    .join('|');

  return filtered;
}

/**
 * Get stage-specific knowledge suggestions for workflow integration
 */
export async function getStageSuggestions(params: {
  stage: 'creation' | 'review' | 'approval';
  demandId?: number;
  userId: string;
  accessLevel: string;
  limit?: number;
  title?: string;
  description?: string;
  requestType?: string;
  category?: string;
  priority?: string;
  requirements?: string;
  businessCase?: string;
  costs?: string;
  strategicAlignment?: string;
}): Promise<unknown[]> {
  const { stage, userId, accessLevel, limit = 3 } = params;

  // Create context hash from all context fields for cache key
  const contextHash = createContextHash(params);
  const cacheKey = `${userId}_${stage}_${contextHash}`;

  // Check cache first
  const cached = suggestionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SUGGESTION_CACHE_TTL) {
    logger.info(`[RAG Suggestions] Returning cached suggestions for ${cacheKey}`);
    return cached.suggestions.slice(0, limit);
  }

  try {
    logger.info(`[RAG Suggestions] Getting suggestions for stage: ${stage}`);

    // Build stage-specific query
    let searchQuery = '';
    let metadataFilters: string[] = [];

    switch (stage) {
      case 'creation': {
        // Creation: emphasize templates and similar demands
        const parts = [params.title, params.description, params.requestType].filter(Boolean);
        searchQuery = parts.join(' ') + ' template demand request example';
        metadataFilters = ['template', 'demand', 'request', 'example'];
        logger.info('[RAG Suggestions] Creation mode: template focus');
        break;
      }

      case 'review': {
        // Review: emphasize technical standards and policies
        const parts = [params.category, params.priority, params.requirements].filter(Boolean);
        searchQuery = parts.join(' ') + ' technical requirements standards policy specifications';
        metadataFilters = ['technical', 'standards', 'policy', 'requirements'];
        logger.info('[RAG Suggestions] Review mode: technical focus');
        break;
      }

      case 'approval': {
        // Approval: emphasize approval templates and compliance
        const parts = [params.businessCase, params.costs, params.strategicAlignment].filter(Boolean);
        searchQuery = parts.join(' ') + ' approval business case compliance budget roi';
        metadataFilters = ['approval', 'template', 'compliance', 'budget'];
        logger.info('[RAG Suggestions] Approval mode: compliance focus');
        break;
      }
    }

    // Skip if query is too short
    if (searchQuery.length < 10) {
      logger.info('[RAG Suggestions] Query too short, returning empty');
      return [];
    }

    // Use hybrid search for better results
    const chunks = await ragService.hybridSearch(searchQuery, userId, accessLevel, 8);

    // Filter by metadata tags if available
    const filteredChunks = chunks.filter(chunk => {
      const metadata = chunk.chunk.metadata as Record<string, unknown> | null;
      const tags = normalizeTags(metadata?.tags);
      if (tags.length === 0) return true;
      return tags.some((tag: string) =>
        metadataFilters.some(filter => tag.toLowerCase().includes(filter.toLowerCase()))
      );
    });

    // Use filtered or original chunks
    const resultsToUse = filteredChunks.length > 0 ? filteredChunks : chunks;

    // Map to lightweight DTO
    const suggestions = resultsToUse.slice(0, 8).map(result => ({
      id: result.document.id,
      title: result.document.filename,
      snippet: result.chunk.content.slice(0, 150) + (result.chunk.content.length > 150 ? '...' : ''),
      confidence: result.score,
      documentType: result.document.fileType || 'document',
      category: result.document.category || 'general',
      actions: ['preview', 'use_as_template'],
    }));

    // Cache the results
    suggestionCache.set(cacheKey, { suggestions, timestamp: Date.now() });

    // Clean old cache entries
    cleanSuggestionCache();

    logger.info(`[RAG Suggestions] Returning ${suggestions.length} suggestions`);
    return suggestions.slice(0, limit);

  } catch (error) {
    logger.error('[RAG Suggestions] Error getting suggestions:', error);
    return [];
  }
}

/**
 * Clean old cache entries
 */
function cleanSuggestionCache() {
  const now = Date.now();
  const keysToDelete: string[] = [];

  suggestionCache.forEach((value, key) => {
    if (now - value.timestamp > SUGGESTION_CACHE_TTL) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => suggestionCache.delete(key));
}
