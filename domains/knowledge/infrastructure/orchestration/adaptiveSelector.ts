/**
 * Adaptive Agent Selector
 * Phase 1 Enhancement: Dynamically weights and selects agents based on:
 * - Classification confidence scores
 * - Historical performance
 * - Query complexity
 * - Agent specialization match
 */

import type { ClassificationResult } from './classifier';
import type { AgentResponse } from '../agents/baseAgent';
import { logger } from '@platform/logging/Logger';

const log = logger.service('AdaptiveSelector');

export interface AgentWeight {
  domain: string;
  weight: number;
  reason: string;
  selected: boolean;
}

export interface SelectionResult {
  selectedAgents: string[];
  weights: AgentWeight[];
  strategy: 'single_expert' | 'multi_domain' | 'comprehensive' | 'fallback';
  confidence: number;
}

interface PerformanceMetrics {
  domain: string;
  avgConfidence: number;
  avgResponseTime: number;
  successRate: number;
  sampleSize: number;
}

const MIN_WEIGHT_THRESHOLD = 0.25; // Minimum weight to be selected
const SINGLE_DOMAIN_THRESHOLD = 0.7; // Use single expert if one domain is very strong
const COMPREHENSIVE_THRESHOLD = 0.4; // Use all agents if no domain is clearly dominant

export class AdaptiveAgentSelector {
  private performanceHistory: Map<string, PerformanceMetrics> = new Map();
  private maxAgents: number;

  constructor(maxAgents: number = 4) {
    this.maxAgents = maxAgents;
    this.initializeDefaultMetrics();
  }

  /**
   * Initialize with default performance metrics
   */
  private initializeDefaultMetrics(): void {
    const defaults: PerformanceMetrics[] = [
      { domain: 'finance', avgConfidence: 0.75, avgResponseTime: 2000, successRate: 0.95, sampleSize: 0 },
      { domain: 'business', avgConfidence: 0.72, avgResponseTime: 2200, successRate: 0.93, sampleSize: 0 },
      { domain: 'security', avgConfidence: 0.78, avgResponseTime: 1800, successRate: 0.96, sampleSize: 0 },
      { domain: 'technical', avgConfidence: 0.74, avgResponseTime: 2100, successRate: 0.94, sampleSize: 0 }
    ];

    for (const metric of defaults) {
      this.performanceHistory.set(metric.domain, metric);
    }
  }

  /**
   * Select agents based on classification and historical performance
   */
  select(classification: ClassificationResult): SelectionResult {
    const weights: AgentWeight[] = [];
    
    // Calculate base weights from classification scores
    for (const [domain, score] of Object.entries(classification.scores)) {
      const performanceBoost = this.getPerformanceBoost(domain);
      const adjustedWeight = score * performanceBoost;
      
      weights.push({
        domain,
        weight: adjustedWeight,
        reason: this.getWeightReason(score, performanceBoost),
        selected: false
      });
    }

    // Sort by weight descending
    weights.sort((a, b) => b.weight - a.weight);

    // Determine selection strategy
    const topWeight = weights[0]?.weight || 0;
    const avgWeight = weights.reduce((sum, w) => sum + w.weight, 0) / weights.length;
    
    let strategy: SelectionResult['strategy'];
    let selectedAgents: string[] = [];

    if (topWeight >= SINGLE_DOMAIN_THRESHOLD && weights.length > 0) {
      // Single expert mode: one domain is clearly dominant
      strategy = 'single_expert';
      selectedAgents = [weights[0]!.domain];
      weights[0]!.selected = true;
      
      // Maybe add second agent if close behind
      if (weights[1] && weights[1].weight >= topWeight * 0.8) {
        selectedAgents.push(weights[1].domain);
        weights[1].selected = true;
        strategy = 'multi_domain';
      }
    } else if (avgWeight < COMPREHENSIVE_THRESHOLD && classification.confidence < 0.5) {
      // Comprehensive mode: unclear query, use all agents
      strategy = 'comprehensive';
      selectedAgents = weights
        .filter(w => w.weight > 0.1)
        .slice(0, this.maxAgents)
        .map(w => w.domain);
      weights.filter(w => selectedAgents.includes(w.domain)).forEach(w => w.selected = true);
    } else {
      // Multi-domain mode: select agents above threshold
      strategy = 'multi_domain';
      selectedAgents = weights
        .filter(w => w.weight >= MIN_WEIGHT_THRESHOLD)
        .slice(0, this.maxAgents)
        .map(w => w.domain);
      weights.filter(w => selectedAgents.includes(w.domain)).forEach(w => w.selected = true);
    }

    // Fallback: ensure at least one agent
    if (selectedAgents.length === 0) {
      strategy = 'fallback';
      selectedAgents = classification.domains.length > 0 
        ? [classification.domains[0]!]
        : ['business']; // Default fallback
      
      const fallbackWeight = weights.find(w => w.domain === selectedAgents[0]);
      if (fallbackWeight) fallbackWeight.selected = true;
    }

    log.info('Selection strategy applied', { strategy, selectedAgents });

    return {
      selectedAgents,
      weights,
      strategy,
      confidence: this.calculateSelectionConfidence(weights, selectedAgents)
    };
  }

  /**
   * Get performance-based boost factor for a domain
   */
  private getPerformanceBoost(domain: string): number {
    const metrics = this.performanceHistory.get(domain);
    if (!metrics || metrics.sampleSize < 5) {
      return 1.0; // No adjustment for new/unknown agents
    }

    // Boost based on historical success
    const confidenceBoost = metrics.avgConfidence > 0.8 ? 1.1 : 1.0;
    const successBoost = metrics.successRate > 0.95 ? 1.05 : 1.0;
    const speedBoost = metrics.avgResponseTime < 2000 ? 1.05 : 1.0;

    return confidenceBoost * successBoost * speedBoost;
  }

  /**
   * Generate human-readable reason for weight
   */
  private getWeightReason(score: number, boost: number): string {
    const reasons: string[] = [];
    
    if (score >= 0.7) reasons.push('strong domain match');
    else if (score >= 0.4) reasons.push('moderate domain match');
    else reasons.push('weak domain match');

    if (boost > 1.1) reasons.push('excellent historical performance');
    else if (boost > 1.0) reasons.push('good historical performance');

    return reasons.join(', ');
  }

  /**
   * Calculate confidence in the selection
   */
  private calculateSelectionConfidence(weights: AgentWeight[], selected: string[]): number {
    const selectedWeights = weights.filter(w => selected.includes(w.domain));
    if (selectedWeights.length === 0) return 0;

    const avgWeight = selectedWeights.reduce((sum, w) => sum + w.weight, 0) / selectedWeights.length;
    const coverage = selectedWeights.length / Math.min(4, weights.length);

    return (avgWeight * 0.7) + (coverage * 0.3);
  }

  /**
   * Update performance metrics based on agent responses
   */
  updatePerformance(responses: AgentResponse[], timings: Record<string, number>): void {
    for (const response of responses) {
      const metrics = this.performanceHistory.get(response.domain);
      if (!metrics) continue;

      const responseTime = timings[response.domain] || metrics.avgResponseTime;
      const n = metrics.sampleSize;

      // Incremental average update
      metrics.avgConfidence = (metrics.avgConfidence * n + response.confidence) / (n + 1);
      metrics.avgResponseTime = (metrics.avgResponseTime * n + responseTime) / (n + 1);
      metrics.successRate = (metrics.successRate * n + 1) / (n + 1); // Assume success if we got response
      metrics.sampleSize = n + 1;

      log.debug('Updated metrics', { domain: response.domain, avgConfidence: metrics.avgConfidence.toFixed(2), sampleSize: metrics.sampleSize });
    }
  }

  /**
   * Record a failure for a domain
   */
  recordFailure(domain: string): void {
    const metrics = this.performanceHistory.get(domain);
    if (!metrics) return;

    const n = metrics.sampleSize;
    metrics.successRate = (metrics.successRate * n) / (n + 1);
    metrics.sampleSize = n + 1;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics[] {
    return Array.from(this.performanceHistory.values());
  }

  /**
   * Suggest agent escalation when coverage is low
   */
  suggestEscalation(
    responses: AgentResponse[],
    query: string
  ): { shouldEscalate: boolean; suggestedAgents: string[]; reason: string } {
    const respondedDomains = new Set(responses.map(r => r.domain));
    const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;

    // Low confidence - suggest additional agents
    if (avgConfidence < 50) {
      const missingDomains = ['finance', 'business', 'security', 'technical']
        .filter(d => !respondedDomains.has(d));

      if (missingDomains.length > 0) {
        return {
          shouldEscalate: true,
          suggestedAgents: missingDomains.slice(0, 2),
          reason: `Low average confidence (${avgConfidence.toFixed(0)}%), additional perspectives recommended`
        };
      }
    }

    // Check for domain coverage based on query keywords
    const queryLower = query.toLowerCase();
    const domainKeywords: Record<string, string[]> = {
      finance: ['cost', 'budget', 'roi', 'financial', 'investment', 'savings'],
      security: ['security', 'risk', 'compliance', 'threat', 'protection'],
      technical: ['technology', 'system', 'integration', 'architecture', 'api'],
      business: ['strategy', 'stakeholder', 'business', 'value', 'transformation']
    };

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (!respondedDomains.has(domain)) {
        const hasKeyword = keywords.some(k => queryLower.includes(k));
        if (hasKeyword) {
          return {
            shouldEscalate: true,
            suggestedAgents: [domain],
            reason: `Query contains ${domain} keywords but ${domain} agent not consulted`
          };
        }
      }
    }

    return { shouldEscalate: false, suggestedAgents: [], reason: 'Coverage adequate' };
  }
}

/**
 * Singleton selector instance with shared performance history
 */
let selectorInstance: AdaptiveAgentSelector | null = null;

export function getAdaptiveSelector(): AdaptiveAgentSelector {
  if (!selectorInstance) {
    selectorInstance = new AdaptiveAgentSelector();
  }
  return selectorInstance;
}
