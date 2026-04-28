import { z } from "zod";
import type {
  SearchDeps,
} from "./buildDeps";
import type { KnowResult, DecisionContext } from "./shared";
import { logger } from "@platform/logging/Logger";

const knowledgeSearchSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  topK: z.number().int().positive().max(100).default(10).optional(),
  accessLevel: z.enum(["public", "internal", "restricted"]).optional(),
});

const knowledgeAskSchema = z.object({
  query: z.string().min(1, "Question is required"),
  topK: z.number().int().positive().max(20).default(5).optional(),
  accessLevel: z.enum(["public", "internal", "restricted"]).optional(),
  systemPrompt: z.string().optional(),
  useHybrid: z.boolean().default(true).optional(),
});

const suggestionContextSchema = z.object({
  stage: z.enum(["creation", "review", "approval"]),
  demandId: z.number().optional(),
  limit: z.number().int().positive().max(20).default(3).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  requestType: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  requirements: z.string().optional(),
  businessCase: z.string().optional(),
  costs: z.string().optional(),
  strategicAlignment: z.string().optional(),
});

/** Shared governance check */
async function checkGovernance(
  deps: Pick<SearchDeps, "decisionOrchestrator">,
  intent: string,
  decisionType: string,
  sourceType: string,
  sourceContext: Record<string, unknown>,
  ctx: DecisionContext,
): Promise<KnowResult<{ requestNumber?: string }> | null> {
  const orc = await deps.decisionOrchestrator.intake(
    { intent, decisionType, financialImpact: "low", urgency: "low", sourceType, sourceContext },
    ctx,
  );
  if (!orc.canProceedToReasoning) {
    logger.info(`[Decision Brain] Blocked: ${orc.blockedReason}`);
    return {
      success: false,
      error: orc.blockedReason || "Request blocked by governance",
      status: 403,
      details: { decisionBrain: { requestNumber: orc.requestNumber } },
    };
  }
  logger.info(`[Decision Brain] Approved - ${orc.requestNumber}`);
  return null; // means OK
}

/** Maps search results to API shape */
function mapSearchResults(results: Array<{ chunk: { id: string; content: string; metadata?: Record<string, unknown> }; document: { id: string; filename: string; category?: string | null }; score: number; distance?: number }>) {
  return results.map((r) => ({
    chunkId: r.chunk.id,
    documentId: r.document.id,
    filename: r.document.filename,
    category: r.document.category,
    content: r.chunk.content,
    score: r.score,
    distance: r.distance,
    metadata: r.chunk.metadata,
  }));
}


export async function semanticSearch(
  deps: Pick<SearchDeps, "decisionOrchestrator" | "ragService">,
  body: unknown,
  userId: string,
  ctx: DecisionContext,
): Promise<KnowResult> {
  const validation = knowledgeSearchSchema.safeParse(body);
  if (!validation.success) {
    return { success: false, error: "Invalid search parameters", status: 400, details: validation.error.errors };
  }
  const { query, topK = 10, accessLevel } = validation.data;

  const blocked = await checkGovernance(deps, `Semantic search: ${query.substring(0, 100)}`, "knowledge_search", "knowledge_search", { query, topK }, ctx);
  if (blocked) return blocked;

  logger.info(`[RAG Search] User ${userId} searching for: "${query}"`);
  const results = await deps.ragService.semanticSearch(query, topK, userId, accessLevel);

  return { success: true, data: { query, results: mapSearchResults(results), count: results.length } };
}


export async function hybridSearch(
  deps: Pick<SearchDeps, "decisionOrchestrator" | "ragService">,
  body: unknown,
  userId: string,
  ctx: DecisionContext,
): Promise<KnowResult> {
  const validation = knowledgeSearchSchema.safeParse(body);
  if (!validation.success) {
    return { success: false, error: "Invalid search parameters", status: 400, details: validation.error.errors };
  }
  const { query, topK = 10, accessLevel } = validation.data;

  const blocked = await checkGovernance(deps, `Hybrid search: ${query.substring(0, 100)}`, "knowledge_search", "knowledge_search", { query, topK }, ctx);
  if (blocked) return blocked;

  logger.info(`[RAG Hybrid Search] User ${userId} searching for: "${query}"`);
  const results = await deps.ragService.hybridSearch(query, topK, userId, accessLevel);

  return { success: true, data: { query, results: mapSearchResults(results), count: results.length } };
}


export async function enhancedSearch(
  deps: Pick<SearchDeps, "ragService">,
  params: {
    query: string;
    topK?: number;
    accessLevel?: string;
    sessionId?: string;
    useQueryExpansion?: boolean;
    useReranking?: boolean;
    useConversationalMemory?: boolean;
  },
  userId: string,
): Promise<KnowResult> {
  const { query, topK = 10, accessLevel, sessionId, useQueryExpansion = true, useReranking = true, useConversationalMemory = true } = params;
  if (!query || typeof query !== "string") {
    return { success: false, error: "Query is required", status: 400 };
  }

  logger.info(`[RAG Enhanced Search] User ${userId} searching for: "${query}"`);
  const { results, metadata } = await deps.ragService.enhancedSearch(query, topK, userId, accessLevel, {
    sessionId: sessionId || `session_${userId}_${Date.now()}`,
    useQueryExpansion,
    useReranking,
    useConversationalMemory,
  });

  return {
    success: true,
    data: {
      query,
      results: mapSearchResults(results),
      count: results.length,
      searchMetadata: {
        queryExpansion: metadata.queryExpansion,
        isFollowUp: metadata.isFollowUp,
        searchTime: metadata.searchTime,
        reranked: metadata.reranked,
      },
    },
  };
}


export async function enhancedAsk(
  deps: Pick<SearchDeps, "decisionOrchestrator" | "ragService">,
  params: { query: string; topK?: number; accessLevel?: string; sessionId?: string; systemPrompt?: string },
  userId: string,
  ctx: DecisionContext,
): Promise<KnowResult> {
  const { query, topK = 10, accessLevel, sessionId, systemPrompt } = params;
  if (!query || typeof query !== "string") {
    return { success: false, error: "Query is required", status: 400 };
  }

  const blocked = await checkGovernance(deps, `Knowledge assistant query: ${query.substring(0, 100)}`, "knowledge_assistant", "knowledge_query", { query, topK, accessLevel }, ctx);
  if (blocked) return blocked;

  logger.info(`[RAG Enhanced Ask] User ${userId} asking: "${query}"`);
  const response = await deps.ragService.enhancedRAG(query, userId, {
    topK,
    accessLevel,
    sessionId: sessionId || `session_${userId}_${Date.now()}`,
    systemPrompt,
  });

  return {
    success: true,
    data: {
      answer: response.answer,
      citations: response.citations,
      confidence: response.confidence,
      metadata: response.metadata,
      chunkCount: response.retrievedChunks.length,
    },
  };
}


export async function ask(
  deps: Pick<SearchDeps, "decisionOrchestrator" | "ragService">,
  body: unknown,
  userId: string,
  ctx: DecisionContext,
): Promise<KnowResult> {
  const validation = knowledgeAskSchema.safeParse(body);
  if (!validation.success) {
    return { success: false, error: "Invalid question parameters", status: 400, details: validation.error.errors };
  }
  const { query, topK = 5, accessLevel, systemPrompt, useHybrid = true } = validation.data;

  const blocked = await checkGovernance(deps, `Knowledge query: ${query.substring(0, 100)}`, "knowledge_assistant", "knowledge_query", { query, topK, accessLevel }, ctx);
  if (blocked) return blocked;

  logger.info(`[RAG Ask] User ${userId} asking: "${query}"`);
  let searchResults;
  if (useHybrid) {
    searchResults = await deps.ragService.hybridSearch(query, topK, userId, accessLevel);
  } else {
    searchResults = await deps.ragService.semanticSearch(query, topK, userId, accessLevel);
  }

  const rerankedResults = await deps.ragService.rerankResults(searchResults, query);
  const response = await deps.ragService.generateWithContext(query, rerankedResults.slice(0, topK), systemPrompt);

  return {
    success: true,
    data: {
      query,
      answer: response.answer,
      citations: response.citations,
      confidence: response.confidence,
      searchMethod: useHybrid ? "hybrid" : "semantic",
      retrievedCount: response.retrievedChunks.length,
    },
  };
}


export async function getSuggestions(
  deps: Pick<SearchDeps, "ragIntegration">,
  rawContext: Record<string, unknown>,
  userId: string,
): Promise<KnowResult> {
  const validation = suggestionContextSchema.safeParse(rawContext);
  if (!validation.success) {
    return { success: false, error: "Invalid suggestion context", status: 400, details: validation.error.errors };
  }
  const context = validation.data;
  logger.info(`[Knowledge Suggestions] User ${userId} requesting suggestions for stage: ${context.stage}`);

  const suggestions = await deps.ragIntegration.getStageSuggestions({
    ...context,
    userId,
    accessLevel: "internal",
  });

  return { success: true, data: { suggestions, stage: context.stage, count: suggestions.length } };
}
