/**
 * Cross-Agent Collaboration Coordinator
 * Enables agents to request input from other agents during analysis
 * Part of Phase 2 Intelligence - Cross-Agent Collaboration
 */

import type { AgentResponse, RAGAgentContext } from '../agents/baseAgent';
import type { IStorage } from '@interfaces/storage';
import { getAgentRegistry } from '../agents/agentRegistry';
import { logger } from '@platform/logging/Logger';

const log = logger.service('CollaborationCoordinator');

export interface CollaborationRequest {
  requestingAgent: string; // Domain of requesting agent
  targetAgent: string; // Domain of target agent
  question: string; // Specific question to ask
  context: RAGAgentContext; // Context for the request
  priority: 'critical' | 'high' | 'medium' | 'low';
  reason: string; // Why this collaboration is needed
}

export interface CollaborationResponse {
  success: boolean;
  response?: AgentResponse;
  error?: string;
  cached?: boolean; // If response was from cache
}

export interface CollaborationMetadata {
  collaborations: Array<{
    from: string;
    to: string;
    question: string;
    success: boolean;
    cached?: boolean;
  }>;
  collaborationCount: number;
  circularDependencyPrevented: boolean;
}

/**
 * Manages inter-agent collaboration with circular dependency prevention
 * IMPORTANT: Each instance is scoped to a single orchestration run for data isolation
 */
export class CollaborationCoordinator {
  private storage: IStorage;
  private collaborationChain: Set<string>; // Track call chain to prevent circular deps
  private collaborationCache: Map<string, AgentResponse>; // Cache responses within THIS orchestration run only
  private maxDepth: number = 3; // Maximum collaboration chain depth
  private userId: string; // User context for this orchestration run
  private reportId?: string; // Report context for this orchestration run
  private preventedCycles: number = 0; // Track prevented circular dependencies
  
  constructor(storage: IStorage, userId: string, reportId?: string) {
    this.storage = storage;
    this.userId = userId;
    this.reportId = reportId;
    this.collaborationChain = new Set();
    this.collaborationCache = new Map();
  }
  
  /**
   * Request input from another agent
   */
  async requestCollaboration(request: CollaborationRequest): Promise<CollaborationResponse> {
    const { requestingAgent, targetAgent, question, context } = request;
    
    // Prevent circular dependencies
    const chainKey = `${requestingAgent}->${targetAgent}`;
    if (this.collaborationChain.has(chainKey)) {
      this.preventedCycles++;
      log.warn('Circular dependency prevented', { chainKey, userId: this.userId });
      return {
        success: false,
        error: `Circular dependency: ${requestingAgent} -> ${targetAgent}`
      };
    }
    
    // Check depth limit
    if (this.collaborationChain.size >= this.maxDepth) {
      log.warn('Max collaboration depth reached', { maxDepth: this.maxDepth, userId: this.userId });
      return {
        success: false,
        error: `Maximum collaboration depth (${this.maxDepth}) exceeded`
      };
    }
    
    // Check cache first (scoped to THIS orchestration run only)
    const cacheKey = `${this.userId}:${this.reportId || 'no-report'}:${targetAgent}:${question}`;
    if (this.collaborationCache.has(cacheKey)) {
      log.debug('Cache hit', { targetAgent, userId: this.userId });
      return {
        success: true,
        response: this.collaborationCache.get(cacheKey),
        cached: true
      };
    }
    
    try {
      // Add to chain
      this.collaborationChain.add(chainKey);
      
      log.info('Requesting collaboration', { from: requestingAgent, to: targetAgent });
      
      // Get target agent
      const registry = getAgentRegistry(this.storage);
      const agent = registry.getAgent(targetAgent);
      
      if (!agent) {
        return {
          success: false,
          error: `Agent not found: ${targetAgent}`
        };
      }
      
      // Create modified context with the specific question
      const collaborationContext: RAGAgentContext = {
        ...context,
        query: question
      };
      
      // Execute target agent
      const response = await agent.run(collaborationContext);
      
      // Cache the response
      this.collaborationCache.set(cacheKey, response);
      
      log.info('Collaboration response received', { targetAgent, confidence: response.confidence });
      
      return {
        success: true,
        response
      };
      
    } catch (error) {
      log.error('Collaboration error', error instanceof Error ? error : undefined);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      // Remove from chain
      this.collaborationChain.delete(chainKey);
    }
  }
  
  /**
   * Get collaboration metadata for reporting
   */
  getMetadata(): CollaborationMetadata {
    const collaborations = Array.from(this.collaborationChain).map(chain => {
      const [from, to] = chain.split('->');
      return {
        from: from ?? '',
        to: to ?? '',
        question: 'Collaboration in progress',
        success: true
      };
    });
    
    return {
      collaborations,
      collaborationCount: this.collaborationChain.size,
      circularDependencyPrevented: this.preventedCycles > 0
    };
  }
}

/**
 * Helper function to create a collaboration request
 */
export function createCollaborationRequest(
  from: string,
  to: string,
  question: string,
  context: RAGAgentContext,
  priority: 'critical' | 'high' | 'medium' | 'low' = 'medium',
  reason: string = 'Additional domain expertise required'
): CollaborationRequest {
  return {
    requestingAgent: from,
    targetAgent: to,
    question,
    context,
    priority,
    reason
  };
}
