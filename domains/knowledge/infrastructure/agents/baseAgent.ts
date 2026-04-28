import type { DocumentChunk, AICitation } from '@shared/aiAdapters';
import type { IStorage } from '@interfaces/storage';
import type { SharedRetrievalCache } from '../cache/SharedRetrievalCache';
import { logger } from '@platform/logging/Logger';

interface CollaborationRequest {
  requestingAgent: string;
  targetAgent: string;
  question: string;
  context: RAGAgentContext;
  priority: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
}

interface CollaborationResponse {
  success: boolean;
  response?: {
    answer: string;
    confidence: number;
  };
  error?: string;
}

interface CollaborationCoordinator {
  requestCollaboration(request: CollaborationRequest): Promise<CollaborationResponse>;
}

// Agent context for structured metadata
export interface RAGAgentContext {
  query: string;
  userId: string;
  accessLevel?: string;
  reportId?: string;
  retrievalOptions?: {
    topK?: number;
    minScore?: number;
    hybridAlpha?: number;
  };
  sharedCache?: SharedRetrievalCache; // Phase 1: Cross-agent cache sharing
}

// Domain configuration for each agent
export interface DomainConfig {
  domain: 'finance' | 'security' | 'technical' | 'business';
  keywords: string[]; // Domain-specific booster keywords
  fallbackTerms: string[]; // Alternative search terms
  minScore: number; // Minimum relevance threshold
  rerankBoost: number; // Metadata match boost factor (1.0 = no boost, 1.2 = +20%)
  topK: number; // Default results to retrieve
}

// Standardized agent response
export interface AgentResponse {
  domain: string;
  answer: string;
  citations: AICitation[];
  confidence: number;
  domainInsights?: Record<string, unknown>; // Optional domain-specific data
  metadata?: {
    rewrittenQuery?: string;
    chunksRetrieved?: number;
    averageRelevance?: number;
  };
}

// Base agent interface
export interface IRAGAgent {
  domain: string;
  config: DomainConfig;
  
  retrieveContext(context: RAGAgentContext): Promise<DocumentChunk[]>;
  generateResponse(context: RAGAgentContext, chunks: DocumentChunk[]): Promise<AgentResponse>;
  run(context: RAGAgentContext): Promise<AgentResponse>; // Full pipeline
  setCollaborationCoordinator?(coordinator: unknown): void; // Optional for cross-agent collaboration
  setSharedCache?(cache: SharedRetrievalCache): void; // Phase 1: Shared cache injection
}

// Abstract base class implementing common logic
export abstract class BaseRAGAgent implements IRAGAgent {
  abstract domain: string;
  abstract config: DomainConfig;
  
  protected storage: IStorage;
  protected promptTemplate: string;
  protected collaborationCoordinator?: CollaborationCoordinator; // Will be set by orchestration engine
  protected sharedCache?: SharedRetrievalCache; // Phase 1: Cross-agent cache
  
  constructor(storage: IStorage, promptTemplate: string) {
    this.storage = storage;
    this.promptTemplate = promptTemplate;
  }
  
  /**
   * Set collaboration coordinator (called by orchestration engine)
   */
  setCollaborationCoordinator(coordinator: unknown) {
    if (
      coordinator &&
      typeof coordinator === 'object' &&
      'requestCollaboration' in coordinator &&
      typeof coordinator.requestCollaboration === 'function'
    ) {
      this.collaborationCoordinator = coordinator as CollaborationCoordinator;
      return;
    }

    this.collaborationCoordinator = undefined;
  }
  
  /**
   * Set shared cache (called by orchestration engine) - Phase 1 Enhancement
   */
  setSharedCache(cache: SharedRetrievalCache) {
    this.sharedCache = cache;
  }
  
  /**
   * Try to get cached chunks before retrieval - Phase 1 Enhancement
   */
  protected async getCachedOrRetrieve(
    context: RAGAgentContext,
    retriever: () => Promise<DocumentChunk[]>
  ): Promise<DocumentChunk[]> {
    const cache = this.sharedCache || context.sharedCache;
    
    if (cache) {
      // Try cache first
      const cached = cache.get(context.query, this.domain);
      if (cached) {
        logger.service(this.domain).debug('Cache HIT for query');
        return cached;
      }
    }
    
    // Cache miss - retrieve fresh
    const chunks = await retriever();
    
    // Store in cache for other agents
    if (cache) {
      cache.set(context.query, chunks, this.domain);
    }
    
    return chunks;
  }
  
  /**
   * Request help from another agent (Cross-Agent Collaboration)
   */
  protected async requestAgentInput(
    targetDomain: string,
    question: string,
    context: RAGAgentContext,
    priority: 'critical' | 'high' | 'medium' | 'low' = 'medium',
    reason: string = 'Additional domain expertise required'
  ): Promise<{ success: boolean; answer?: string; confidence?: number; error?: string }> {
    if (!this.collaborationCoordinator) {
      logger.service(this.domain).warn('Collaboration coordinator not available');
      return { success: false, error: 'Collaboration coordinator not available' };
    }
    
    const request = {
      requestingAgent: this.domain,
      targetAgent: targetDomain,
      question,
      context,
      priority,
      reason
    };
    
    const response = await this.collaborationCoordinator.requestCollaboration(request);
    
    if (response.success && response.response) {
      return {
        success: true,
        answer: response.response.answer,
        confidence: response.response.confidence
      };
    }
    
    return {
      success: false,
      error: response.error
    };
  }
  
  // Must be implemented by subclasses
  abstract retrieveContext(context: RAGAgentContext): Promise<DocumentChunk[]>;
  abstract generateResponse(context: RAGAgentContext, chunks: DocumentChunk[]): Promise<AgentResponse>;
  
  // Shared pipeline orchestration
  async run(context: RAGAgentContext): Promise<AgentResponse> {
    const chunks = await this.retrieveContext(context);
    const response = await this.generateResponse(context, chunks);
    return response;
  }
  
  // Shared helper: format prompt with context
  protected formatPrompt(systemPrompt: string, userQuery: string, contextChunks: DocumentChunk[]): string {
    const contextText = contextChunks
      .map((chunk, idx) => `[${idx + 1}] ${chunk.content}\nSource: ${chunk.metadata?.title || 'Unknown'}\n`)
      .join('\n');
    
    return `${systemPrompt}\n\nCONTEXT:\n${contextText}\n\nQUERY: ${userQuery}`;
  }
  
  // Shared helper: extract domain insights (override in subclasses)
  protected extractDomainInsights(_response: string): Record<string, unknown> | undefined {
    return undefined; // Base implementation returns nothing
  }
}
