/**
 * Knowledge Module — LegacyRagService
 * Wraps the ragService singleton behind the RagServicePort.
 */
import type { RagServicePort, SearchResult, SearchMetadata, RAGResponse } from "../domain/ports";
import { ragService } from "./rag";

export class LegacyRagService implements RagServicePort {
  async semanticSearch(query: string, topK: number, userId: string, accessLevel?: string): Promise<SearchResult[]> {
    return ragService.semanticSearch(query, userId, accessLevel, topK) as unknown as SearchResult[];
  }
  async hybridSearch(query: string, topK: number, userId: string, accessLevel?: string): Promise<SearchResult[]> {
    return ragService.hybridSearch(query, userId, accessLevel, topK) as unknown as SearchResult[];
  }
  async enhancedSearch(query: string, topK: number, userId: string, accessLevel?: string, opts?: Record<string, unknown>): Promise<{ results: SearchResult[]; metadata: SearchMetadata }> {
    return ragService.enhancedSearch(query, userId, accessLevel, opts, topK) as unknown as { results: SearchResult[]; metadata: SearchMetadata };
  }
  async enhancedRAG(query: string, userId: string, opts?: Record<string, unknown>): Promise<RAGResponse> {
    return ragService.enhancedRAG(query, userId, opts) as unknown as RAGResponse;
  }
  async rerankResults(results: SearchResult[], query: string): Promise<SearchResult[]> {
    // Infrastructure bridge: port uses SearchResult[], service uses its own type
    return (ragService.rerankResults as (r: unknown[], q: string) => Promise<unknown[]>)(results, query) as unknown as SearchResult[];
  }
  async generateWithContext(query: string, results: SearchResult[], systemPrompt?: string): Promise<RAGResponse> {
    return (ragService.generateWithContext as (q: string, r: unknown[], s?: string) => Promise<unknown>)(query, results, systemPrompt) as unknown as RAGResponse;
  }
}
