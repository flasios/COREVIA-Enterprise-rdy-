import { OrchestrationClassifier, type ClassificationResult } from './classifier';
import { getAgentRegistry } from '../agents/agentRegistry';
import { CollaborationCoordinator } from '../collaboration/coordinator';
import { getAdaptiveSelector, type SelectionResult } from './adaptiveSelector';
import { conflictAdjudicator, type AdjudicationResult } from './conflictAdjudicator';
import { createSharedCache } from '../cache/SharedRetrievalCache';
import type { IStorage } from '@interfaces/storage';
import type { AgentResponse, RAGAgentContext } from '../agents/baseAgent';
import { logger } from '@platform/logging/Logger';

const log = logger.service('OrchestrationEngine');

export interface OrchestrationContext extends RAGAgentContext {
  query: string;
  userId: string;
  accessLevel?: string;
  reportId?: string;
  retrievalOptions?: {
    topK?: number;
    minScore?: number;
    hybridAlpha?: number;
  };
}

export interface AgentExecutionResult {
  domain: string;
  success: boolean;
  response?: AgentResponse;
  error?: string;
  duration: number;
}

export interface OrchestrationResult {
  classification: ClassificationResult;
  selection?: SelectionResult;
  invokedAgents: string[];
  agentResponses: AgentResponse[];
  executionResults: AgentExecutionResult[];
  adjudication?: AdjudicationResult;
  timings: {
    classificationTime: number;
    selectionTime: number;
    retrievalTime: number;
    adjudicationTime: number;
    totalTime: number;
    agentTimings: Record<string, number>;
  };
  cacheStats?: { hits: number; misses: number; hitRate: number };
  errors: Array<{ domain: string; message: string }>;
}

const AGENT_TIMEOUT_MS = 120000; // 120 seconds per agent (RAG + AI analysis takes time)

type RunnableAgent = {
  run(context: OrchestrationContext): Promise<AgentResponse>;
  setCollaborationCoordinator?(coordinator: unknown): void;
  setSharedCache?(cache: unknown): void;
};

export class OrchestrationEngine {
  private classifier: OrchestrationClassifier;
  private storage: IStorage;
  private adaptiveSelector = getAdaptiveSelector();
  private enableAdaptiveSelection: boolean;
  private enableConflictAdjudication: boolean;
  private forceAllDomains: boolean;

  constructor(storage: IStorage, options?: { adaptiveSelection?: boolean; conflictAdjudication?: boolean; forceAllDomains?: boolean }) {
    this.storage = storage;
    this.classifier = new OrchestrationClassifier();
    this.enableAdaptiveSelection = options?.adaptiveSelection ?? true;
    this.enableConflictAdjudication = options?.conflictAdjudication ?? true;
    this.forceAllDomains = options?.forceAllDomains ?? false;
  }

  /**
   * Orchestrate multi-agent RAG pipeline
   * - Classifies query into domains
   * - Executes relevant agents in parallel with timeouts
   * - Returns partial results on failures (graceful degradation)
   */
  async orchestrate(context: OrchestrationContext): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const errors: Array<{ domain: string; message: string }> = [];

    try {
      // STEP 1: Classify query into domains
      const classificationStart = Date.now();
      const classification = await this.classifier.classify(context.query);
      const classificationTime = Date.now() - classificationStart;

      log.info('Query classified into domains', { domains: classification.domains });

      // STEP 1.5: Adaptive Agent Selection (Phase 1 Enhancement)
      const selectionStart = Date.now();
      let selection: SelectionResult | undefined;
      let selectedDomains = classification.domains;
      
      // Force all 4 domains for comprehensive analysis (e.g., business case generation)
      if (this.forceAllDomains) {
        selectedDomains = ['finance', 'business', 'technical', 'security'];
        log.info('FORCE ALL DOMAINS enabled', { agents: selectedDomains });
      } else if (this.enableAdaptiveSelection) {
        selection = this.adaptiveSelector.select(classification);
        selectedDomains = selection.selectedAgents;
        log.info('Adaptive selection', { strategy: selection.strategy, agents: selectedDomains });
      }
      const selectionTime = Date.now() - selectionStart;

      // STEP 2: Get agents for selected domains
      const registry = getAgentRegistry(this.storage);
      const agents = selectedDomains
        .map(domain => ({ domain, agent: registry.getAgent(domain) }))
        .filter(({ agent }) => agent !== undefined);

      if (agents.length === 0) {
        log.warn('No agents found for domains', { domains: selectedDomains });
        return {
          classification,
          selection,
          invokedAgents: [],
          agentResponses: [],
          executionResults: [],
          timings: {
            classificationTime,
            selectionTime,
            retrievalTime: 0,
            adjudicationTime: 0,
            totalTime: Date.now() - startTime,
            agentTimings: {}
          },
          errors: [{ domain: 'general', message: 'No agents available for query' }]
        };
      }
      
      // Validate all required agents are available when forceAllDomains is enabled
      if (this.forceAllDomains) {
        const requiredDomains = ['finance', 'business', 'technical', 'security'];
        const foundDomains = agents.map(a => a.domain);
        const missingDomains = requiredDomains.filter(d => !foundDomains.includes(d));
        
        if (missingDomains.length > 0) {
          log.error('CRITICAL: forceAllDomains enabled but missing agents', undefined, { missingDomains });
          throw new Error(`Required agents not available: ${missingDomains.join(', ')}. Check agent registry initialization.`);
        }
        log.info('All 4 required agents available', { domains: foundDomains });
      }
      
      // Create shared retrieval cache for this orchestration run
      const sharedCache = createSharedCache(context.userId, context.reportId);

      log.info('Executing agents in parallel', { count: agents.length, domains: agents.map(a => a.domain) });

      // STEP 2.5: Enable Cross-Agent Collaboration
      // CRITICAL: Create NEW instance per orchestration run for data isolation
      const collaborationCoordinator = new CollaborationCoordinator(
        this.storage,
        context.userId,
        context.reportId
      );
      
      // Set collaboration coordinator and shared cache on all agents
      agents.forEach(({ agent }) => {
        if (agent && typeof agent.setCollaborationCoordinator === 'function') {
          agent.setCollaborationCoordinator(collaborationCoordinator);
        }
        if (agent && typeof agent.setSharedCache === 'function') {
          agent.setSharedCache(sharedCache);
        }
      });
      
      // Pass shared cache in context as well
      const enhancedContext = { ...context, sharedCache };
      
      log.info('Cross-Agent Collaboration enabled', { userId: context.userId, reportId: context.reportId || 'none' });

      // STEP 3: Execute agents in parallel with timeout handling
      const retrievalStart = Date.now();
      const executionPromises = agents.map(({ domain, agent }) =>
        this.executeAgentWithTimeout(domain, agent!, enhancedContext)
      );

      // Use Promise.allSettled for graceful degradation
      const settledResults = await Promise.allSettled(executionPromises);
      const retrievalTime = Date.now() - retrievalStart;

      // STEP 4: Process results
      const executionResults: AgentExecutionResult[] = [];
      const agentResponses: AgentResponse[] = [];
      const agentTimings: Record<string, number> = {};

      settledResults.forEach((result, index) => {
        const domain = agents[index]!.domain;

        if (result.status === 'fulfilled') {
          const execResult = result.value;
          executionResults.push(execResult);
          agentTimings[domain] = execResult.duration;

          if (execResult.success && execResult.response) {
            agentResponses.push(execResult.response);
          } else if (execResult.error) {
            errors.push({ domain, message: execResult.error });
          }
        } else {
          // Promise rejected
          const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
          executionResults.push({
            domain,
            success: false,
            error,
            duration: 0
          });
          errors.push({ domain, message: error });
        }
      });

      // STEP 5: Conflict Adjudication (Phase 1 Enhancement)
      const adjudicationStart = Date.now();
      let adjudication: AdjudicationResult | undefined;
      let finalResponses = agentResponses;
      
      if (this.enableConflictAdjudication && agentResponses.length >= 2) {
        try {
          adjudication = await conflictAdjudicator.adjudicate(agentResponses);
          finalResponses = adjudication.adjustedResponses;
          log.info('Conflict adjudication', { resolved: adjudication.resolvedConflicts, unresolved: adjudication.unresolvedConflicts });
        } catch (adjError) {
          log.error('Conflict adjudication failed', adjError instanceof Error ? adjError : undefined);
        }
      }
      const adjudicationTime = Date.now() - adjudicationStart;

      // Update adaptive selector with performance data
      if (this.enableAdaptiveSelection) {
        this.adaptiveSelector.updatePerformance(agentResponses, agentTimings);
      }

      // Get cache stats
      const cacheStats = sharedCache.getStats();

      const totalTime = Date.now() - startTime;

      log.info('Orchestration complete', {
        totalAgents: agents.length,
        successfulAgents: agentResponses.length,
        failedAgents: errors.length,
        conflictsResolved: adjudication?.resolvedConflicts || 0,
        cacheHitRate: `${(cacheStats.hitRate * 100).toFixed(1)}%`,
        totalTimeMs: totalTime
      });
      
      // Validate all 4 agents executed successfully when forceAllDomains is enabled
      if (this.forceAllDomains) {
        const successfulDomains = agentResponses.map(r => r.domain);
        const requiredDomains = ['finance', 'business', 'technical', 'security'];
        const failedDomains = requiredDomains.filter(d => !successfulDomains.includes(d));
        
        if (failedDomains.length > 0) {
          const failedErrors = errors.filter(e => failedDomains.includes(e.domain));
          log.error('CRITICAL: forceAllDomains agents failed', undefined, { failedDomains, errorCount: failedDomains.length });
          throw new Error(`Required agents failed to execute: ${failedDomains.join(', ')}. Errors: ${failedErrors.map(e => e.message).join('; ')}`);
        }
        log.info('All 4 required agents executed successfully');
      }

      return {
        classification,
        selection,
        invokedAgents: agents.map(a => a.domain),
        agentResponses: finalResponses,
        executionResults,
        adjudication,
        timings: {
          classificationTime,
          selectionTime,
          retrievalTime,
          adjudicationTime,
          totalTime,
          agentTimings
        },
        cacheStats: {
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          hitRate: cacheStats.hitRate
        },
        errors
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Fatal error during orchestration', error instanceof Error ? error : undefined);

      return {
        classification: { domains: [], confidence: 0, scores: {}, method: 'fallback' },
        invokedAgents: [],
        agentResponses: [],
        executionResults: [],
        timings: {
          classificationTime: 0,
          selectionTime: 0,
          retrievalTime: 0,
          adjudicationTime: 0,
          totalTime,
          agentTimings: {}
        },
        errors: [{ domain: 'orchestrator', message: errorMessage }]
      };
    }
  }

  /**
   * Execute single agent with timeout handling
   */
  private async executeAgentWithTimeout(
    domain: string,
    agent: RunnableAgent,
    context: OrchestrationContext
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Agent timeout after ${AGENT_TIMEOUT_MS}ms`)), AGENT_TIMEOUT_MS);
      });

      // Race agent execution against timeout
      const response = await Promise.race([
        agent.run(context),
        timeoutPromise
      ]) as AgentResponse;

      const duration = Date.now() - startTime;

      log.debug('Agent completed', { domain, durationMs: duration });

      return {
        domain,
        success: true,
        response,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      log.error('Agent failed', error instanceof Error ? error : undefined, { domain });

      return {
        domain,
        success: false,
        error: errorMessage,
        duration
      };
    }
  }

  /**
   * Clear classification cache (useful for testing)
   */
  clearCache(): void {
    this.classifier.clearCache();
  }
}
