import crypto from 'crypto';
import { logger } from '@platform/logging/Logger';
import { generateBrainDraftArtifact } from '@platform/ai/brainDraftArtifact';

const log = logger.service('OrchestrationClassifier');

// Classification thresholds
const STRONG_SINGLE_DOMAIN_THRESHOLD = 0.6;
const MULTI_DOMAIN_THRESHOLD = 0.35;

// Domain keyword dictionaries with weights
const DOMAIN_KEYWORDS = {
  finance: {
    keywords: ['budget', 'cost', 'ROI', 'NPV', 'TCO', 'payback', 'financial', 'AED', 'investment', 'savings', 'revenue', 'profit', 'expenditure'],
    weight: 1.0
  },
  security: {
    keywords: ['security', 'compliance', 'risk', 'cybersecurity', 'threat', 'encryption', 'authentication', 'vulnerability', 'GDPR', 'UAE IAR', 'Federal Law'],
    weight: 1.2
  },
  technical: {
    keywords: ['architecture', 'technology', 'integration', 'scalability', 'infrastructure', 'API', 'database', 'cloud', 'microservices', 'performance'],
    weight: 1.0
  },
  business: {
    keywords: ['strategic', 'business value', 'stakeholder', 'UAE Vision 2071', 'transformation', 'innovation', 'citizen', 'service', 'impact'],
    weight: 1.0
  }
};

export interface ClassificationResult {
  domains: string[];
  confidence: number;
  scores: Record<string, number>;
  method: 'keyword' | 'llm' | 'fallback';
  isCached?: boolean;
}

// Simple in-memory cache
const classificationCache = new Map<string, { result: ClassificationResult, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class OrchestrationClassifier {
  constructor() {}

  async classify(query: string): Promise<ClassificationResult> {
    const normalizedQuery = this.normalizeQuery(query);
    const cacheKey = this.getCacheKey(normalizedQuery);
    
    const cached = classificationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { ...cached.result, isCached: true };
    }

    const keywordResult = this.classifyByKeywords(normalizedQuery);
    
    if (keywordResult.confidence >= STRONG_SINGLE_DOMAIN_THRESHOLD && keywordResult.domains.length === 1) {
      this.cacheResult(cacheKey, keywordResult);
      return keywordResult;
    }

    if (keywordResult.confidence < MULTI_DOMAIN_THRESHOLD) {
      const llmResult = await this.classifyByLLM(normalizedQuery);
      this.cacheResult(cacheKey, llmResult);
      return llmResult;
    }

    this.cacheResult(cacheKey, keywordResult);
    return keywordResult;
  }

  private normalizeQuery(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private getCacheKey(normalizedQuery: string): string {
    return crypto.createHash('md5').update(normalizedQuery).digest('hex');
  }

  private classifyByKeywords(query: string): ClassificationResult {
    const scores: Record<string, number> = {};
    
    for (const [domain, config] of Object.entries(DOMAIN_KEYWORDS)) {
      let score = 0;
      for (const keyword of config.keywords) {
        if (query.includes(keyword.toLowerCase())) {
          score += config.weight;
        }
      }
      scores[domain] = score / config.keywords.length;
    }

    const selectedDomains = Object.entries(scores)
      .filter(([_, score]) => score >= MULTI_DOMAIN_THRESHOLD)
      .sort((a, b) => b[1] - a[1])
      .map(([domain, _]) => domain);

    const confidence = Math.max(...Object.values(scores), 0);

    return {
      domains: selectedDomains.length > 0 ? selectedDomains : ['general'],
      confidence,
      scores,
      method: 'keyword'
    };
  }

  private async classifyByLLM(query: string): Promise<ClassificationResult> {
    const prompt = `Classify the following query into one or more domains: finance, security, technical, business.

Query: "${query}"

Instructions:
- Return ONLY a JSON object with this exact structure: {"domains": ["domain1", "domain2"], "confidence": 0.85}
- domains: Array of relevant domains (finance, security, technical, business)
- confidence: Number between 0 and 1 indicating classification certainty
- If no clear domain match, return {"domains": ["general"], "confidence": 0.5}

Examples:
Query: "What's the ROI for this project?"
{"domains": ["finance"], "confidence": 0.95}

Query: "How do we ensure security and manage costs?"
{"domains": ["security", "finance"], "confidence": 0.85}

Query: "What is the weather today?"
{"domains": ["general"], "confidence": 0.3}

Respond with JSON only:`;

    try {
      const draft = await generateBrainDraftArtifact({
        serviceId: 'rag',
        routeKey: 'rag.classify',
        artifactType: 'RAG_CLASSIFICATION',
        inputData: {
          query,
          instructions: {
            output: 'Return STRICT JSON only: {"domains": string[], "confidence": number}. domains must be from [finance, security, technical, business, general]. confidence 0..1.'
          },
          prompt,
        } as Record<string, unknown>,
        userId: 'system',
      });

      const parsed = draft.content as unknown as Record<string, unknown>;

      return {
        domains: Array.isArray(parsed.domains) ? (parsed.domains as string[]) : ['general'],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        scores: {},
        method: 'llm'
      };
    } catch (error) {
      log.error('LLM classification failed', error instanceof Error ? error : undefined);
      return {
        domains: ['general'],
        confidence: 0.3,
        scores: {},
        method: 'fallback'
      };
    }
  }

  private cacheResult(key: string, result: ClassificationResult): void {
    classificationCache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  clearCache(): void {
    classificationCache.clear();
  }
}
