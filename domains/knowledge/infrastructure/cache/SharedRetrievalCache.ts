/**
 * Shared Retrieval Cache
 * Phase 1 Enhancement: Enables agents to share retrieved documents
 * Reduces duplicate RAG queries and improves response consistency
 */

import type { DocumentChunk } from '@shared/aiAdapters';
import crypto from 'node:crypto';
import { logger } from '@platform/logging/Logger';

const log = logger.service('SharedRetrievalCache');

interface CacheEntry {
  chunks: DocumentChunk[];
  timestamp: number;
  accessCount: number;
  queryHash: string;
  keywords: string[];
}

interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  totalAccesses: number;
  hitRate: number;
  memorySizeEstimate: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100; // Maximum entries
const SEMANTIC_SIMILARITY_THRESHOLD = 0.85; // For fuzzy matching

export class SharedRetrievalCache {
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly queryIndex: Map<string, string[]> = new Map(); // keywords -> cache keys
  private stats = { hits: 0, misses: 0 };
  private readonly userId: string;
  private readonly reportId?: string;

  constructor(userId: string, reportId?: string) {
    this.userId = userId;
    this.reportId = reportId;
  }

  /**
   * Generate cache key from query and context
   */
  private generateKey(query: string, domain?: string): string {
    const normalized = query.toLowerCase().trim();
    const context = `${this.userId}:${this.reportId || 'global'}:${domain || 'any'}`;
    return crypto.createHash('md5').update(`${context}:${normalized}`).digest('hex');
  }

  /**
   * Extract keywords for semantic matching
   */
  private extractKeywords(query: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'its', 'it']);
    
    return query.toLowerCase()
      .replaceAll(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10); // Top 10 keywords
  }

  /**
   * Calculate keyword overlap score between two queries
   */
  private calculateOverlap(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) return 0;
    
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    const intersection = Array.from(set1).filter(k => set2.has(k));
    const union = new Set([...keywords1, ...keywords2]);
    
    return intersection.length / union.size; // Jaccard similarity
  }

  /**
   * Store chunks in cache
   */
  set(query: string, chunks: DocumentChunk[], domain?: string): void {
    // Evict old entries if at capacity
    if (this.cache.size >= MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    const key = this.generateKey(query, domain);
    const keywords = this.extractKeywords(query);
    
    this.cache.set(key, {
      chunks,
      timestamp: Date.now(),
      accessCount: 0,
      queryHash: key,
      keywords,
    });

    // Index by keywords for semantic lookup
    for (const keyword of keywords) {
      if (!this.queryIndex.has(keyword)) {
        this.queryIndex.set(keyword, []);
      }
      const keys = this.queryIndex.get(keyword) ?? [];
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }

    log.debug('Stored chunks', { count: chunks.length, keyPrefix: key.substring(0, 8) });
  }

  /**
   * Get chunks from cache (exact match)
   */
  get(query: string, domain?: string): DocumentChunk[] | null {
    const key = this.generateKey(query, domain);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.accessCount++;
    this.stats.hits++;
    log.debug('Cache HIT', { keyPrefix: key.substring(0, 8) });
    return entry.chunks;
  }

  /**
   * Semantic cache lookup - find similar queries
   */
  getSemantic(query: string, domain?: string): { chunks: DocumentChunk[]; similarity: number } | null {
    // First try exact match
    const exact = this.get(query, domain);
    if (exact) {
      return { chunks: exact, similarity: 1 };
    }

    const queryKeywords = this.extractKeywords(query);
    if (queryKeywords.length === 0) {
      return null;
    }

    // Find candidate entries via keyword index
    const candidateKeys = new Set<string>();
    for (const keyword of queryKeywords) {
      const keys = this.queryIndex.get(keyword) || [];
      keys.forEach(k => candidateKeys.add(k));
    }

    let bestMatch: { key: string; similarity: number; entry: CacheEntry } | null = null;

    for (const key of Array.from(candidateKeys)) {
      const entry = this.cache.get(key);
      if (!entry || Date.now() - entry.timestamp > CACHE_TTL_MS) continue;

      const similarity = this.calculateOverlap(queryKeywords, entry.keywords);
      
      if (similarity >= SEMANTIC_SIMILARITY_THRESHOLD) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { key, similarity, entry };
        }
      }
    }

    if (bestMatch) {
      bestMatch.entry.accessCount++;
      this.stats.hits++;
      log.debug('Semantic HIT', { similarity: (bestMatch.similarity * 100).toFixed(1) });
      return { chunks: bestMatch.entry.chunks, similarity: bestMatch.similarity };
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Merge chunks from multiple cache entries
   * Useful when agents need combined context
   */
  mergeChunks(queries: string[], domain?: string): DocumentChunk[] {
    const allChunks: DocumentChunk[] = [];
    const seenIds = new Set<string>();

    for (const query of queries) {
      const chunks = this.get(query, domain);
      if (chunks) {
        for (const chunk of chunks) {
          const id = `${chunk.documentId}-${chunk.chunkId}`;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            allChunks.push(chunk);
          }
        }
      }
    }

    // Sort by relevance
    return allChunks.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
  }

  /**
   * Evict oldest entries (LRU-like)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of Array.from(this.cache.entries())) {
      // Consider both age and access count
      const score = entry.timestamp - (entry.accessCount * 60000); // Each access adds 1 minute
      if (score < oldestTime) {
        oldestTime = score;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      log.debug('Evicted entry', { keyPrefix: oldestKey.substring(0, 8) });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalAccesses = this.stats.hits + this.stats.misses;
    let memorySizeEstimate = 0;

    for (const entry of Array.from(this.cache.values())) {
      memorySizeEstimate += JSON.stringify(entry.chunks).length;
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      entries: this.cache.size,
      totalAccesses,
      hitRate: totalAccesses > 0 ? this.stats.hits / totalAccesses : 0,
      memorySizeEstimate
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.queryIndex.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Preload cache with related queries
   * Useful for known query patterns
   */
  preload(queries: Array<{ query: string; chunks: DocumentChunk[]; domain?: string }>): void {
    for (const { query, chunks, domain } of queries) {
      this.set(query, chunks, domain);
    }
    log.debug('Preloaded entries', { count: queries.length });
  }
}

/**
 * Factory function to create cache instance per orchestration run
 */
export function createSharedCache(userId: string, reportId?: string): SharedRetrievalCache {
  return new SharedRetrievalCache(userId, reportId);
}
