import { ClassificationLevel } from "@shared/schemas/corevia/decision-object";
import { ragService } from "../../domains/knowledge/infrastructure/rag";
import { logger } from "../../platform/observability";

export interface DecisionContext {
  domain?: string;
  serviceType?: string;
  intent?: string;
  keywords?: string[];
}

export interface RAGQuery {
  query: string;
  context: DecisionContext;
  classificationLevel: ClassificationLevel;
  maxResults?: number;
  minScore?: number;
}

export interface RAGResult {
  content: string;
  source: string;
  score: number;
  metadata: Record<string, unknown>;
  classification: ClassificationLevel;
  documentId?: string;
  filename?: string;
  category?: string;
  accessLevel?: string;
  uploadedBy?: string;
  uploadedAt?: string;
}

export interface RAGResponse {
  results: RAGResult[];
  queryExpansions: string[];
  totalFound: number;
  filteredByClassification: number;
}

const SYSTEM_USER_ID = "system";

function mapAccessLevelToClassification(accessLevel?: string): ClassificationLevel {
  switch (accessLevel) {
    case "public": return "public";
    case "internal": return "internal";
    case "restricted": return "confidential";
    default: return "public";
  }
}

function getSearchAccessLevel(classificationLevel: ClassificationLevel): string | undefined {
  if (classificationLevel === "sovereign" || classificationLevel === "confidential") {
    return "restricted";
  }

  if (classificationLevel === "internal") {
    return "internal";
  }

  return undefined;
}

function getChunkMetadata(metadata: unknown): Record<string, unknown> {
  return typeof metadata === "object" && metadata !== null
    ? metadata as Record<string, unknown>
    : {};
}

export class RAGGateway {
  async retrieve(request: RAGQuery): Promise<RAGResponse> {
    const maxResults = request.maxResults ?? 5;
    const minScore = request.minScore ?? 0.1;

    try {
      const accessLevel = getSearchAccessLevel(request.classificationLevel);

      const { results: searchResults, metadata } = await ragService.enhancedSearch(
        request.query,
        SYSTEM_USER_ID,
        accessLevel,
        {
          useQueryExpansion: false,   // Disabled: agent queries are already well-formed; expansion triggers cascading LLM calls
          useConversationalMemory: false,
          useReranking: true,
        },
        maxResults * 2,
      );

      const queryExpansions =
        (metadata as { queryExpansion?: { variations?: string[] } } | undefined)?.queryExpansion?.variations ||
        [request.query];

      const mapped: RAGResult[] = searchResults
        .filter(r => r.score >= minScore)
        .slice(0, maxResults)
        .map(r => ({
          content: r.chunk.content,
          source: r.document.filename || "Knowledge Base",
          score: r.score,
          metadata: {
            docType: r.document.category || "document",
            chunkIndex: r.chunk.chunkIndex,
            tokenCount: r.chunk.tokenCount,
            ...getChunkMetadata(r.chunk.metadata),
          },
          classification: mapAccessLevelToClassification(r.document.accessLevel),
          documentId: r.document.id,
          filename: r.document.filename,
          category: r.document.category || undefined,
          accessLevel: r.document.accessLevel,
          uploadedBy: r.document.uploadedBy,
          uploadedAt: r.document.uploadedAt ? new Date(r.document.uploadedAt).toISOString() : undefined,
        }));

      logger.info(`[RAG Gateway] Retrieved ${mapped.length} documents from Knowledge Centre (query: "${request.query.substring(0, 60)}...")`);

      return {
        results: mapped,
        queryExpansions,
        totalFound: searchResults.length,
        filteredByClassification: 0,
      };
    } catch (error) {
      logger.warn("[RAG Gateway] Knowledge Centre search failed, using fallback:", error instanceof Error ? error.message : error);
      return this.fallbackRetrieve(request);
    }
  }

  async retrieveForContext(context: DecisionContext, classificationLevel: ClassificationLevel): Promise<RAGResponse> {
    const queryParts: string[] = [];

    if (context.domain) queryParts.push(context.domain);
    if (context.serviceType) queryParts.push(context.serviceType);
    if (context.intent) queryParts.push(context.intent);
    if (context.keywords?.length) queryParts.push(...context.keywords);

    const query = queryParts.join(" ");

    return this.retrieve({
      query,
      context,
      classificationLevel,
      maxResults: 10,
      minScore: 0.05,
    });
  }

  addDocument(_result: RAGResult): void {
    logger.debug("[RAG Gateway] addDocument is not supported for the knowledge-backed gateway");
  }

  getDocumentCount(): number {
    return 0;
  }

  private fallbackRetrieve(request: RAGQuery): RAGResponse {
    return {
      results: [],
      queryExpansions: [request.query],
      totalFound: 0,
      filteredByClassification: 0,
    };
  }
}

export const ragGateway = new RAGGateway();
