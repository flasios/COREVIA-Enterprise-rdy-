import { ragGateway } from "../intelligence/rag-gateway";
import type { AgentInput, AgentOutput, AgentDefinition } from "./agent-runtime";

export const evidenceCollectorAgent: AgentDefinition = {
  id: "evidence-collector-agent",
  name: "Evidence Collector Agent",
  description: "Collects and organizes evidence from knowledge base, documents, and historical decisions. READ-ONLY - no side effects.",
  capabilities: ["document_retrieval", "evidence_gathering", "source_citation", "relevance_scoring"],
  requiredClassification: "public",

  execute: async (input: AgentInput): Promise<AgentOutput> => {
    const startTime = Date.now();

    try {
      const task = input.task;
      const parameters = (input.parameters ?? {}) as {
        domain?: string;
        keywords?: string[];
        maxResults?: number;
        minScore?: number;
      };

      const ragResponse = await ragGateway.retrieve({
        query: task,
        context: {
          domain: parameters.domain || "general",
          intent: task,
          keywords: parameters.keywords || [],
        },
        classificationLevel: input.context.classificationLevel,
        maxResults: parameters.maxResults || 10,
        minScore: parameters.minScore || 0.1,
      });

      const evidence = ragResponse.results.map((result, index) => ({
        id: `EV-${index + 1}`,
        source: result.source,
        content: result.content,
        relevanceScore: result.score,
        classification: result.classification,
        metadata: result.metadata,
        retrievedAt: new Date().toISOString(),
      }));

      const categories: Record<string, typeof evidence> = {};
      for (const item of evidence) {
        const category = String((item.metadata as { docType?: string } | undefined)?.docType || "uncategorized");
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(item);
      }

      const citations = evidence.map((e) => ({
        id: e.id,
        source: e.source,
        excerpt: e.content.substring(0, 100) + "...",
      }));

      const avgRelevance = evidence.length > 0
        ? evidence.reduce((sum, e) => sum + e.relevanceScore, 0) / evidence.length
        : 0;

      return {
        success: true,
        result: {
          evidence,
          categorizedEvidence: categories,
          citations,
          summary: {
            totalDocuments: evidence.length,
            filteredByClassification: ragResponse.filteredByClassification,
            averageRelevance: avgRelevance,
            queryExpansions: ragResponse.queryExpansions,
          },
        },
        reasoning: `Collected ${evidence.length} pieces of evidence from ${Object.keys(categories).length} categories with average relevance of ${(avgRelevance * 100).toFixed(1)}%`,
        confidence: Math.min(avgRelevance + 0.2, 1.0),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        confidence: 0,
        executionTimeMs: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : "Evidence collection failed"],
      };
    }
  },
};
