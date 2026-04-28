/**
 * Knowledge Module — LegacyGraphBuilder
 * Wraps the singleton graphBuilderService behind the GraphBuilderPort.
 */
import type { KnowledgeEntity } from "@shared/schema";
import type { GraphBuilderPort, GraphProcessingResult } from "../domain/ports";
import { graphBuilderService } from "./graphBuilderService";

export class LegacyGraphBuilder implements GraphBuilderPort {
  async getGraphData(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return graphBuilderService.getGraphData(params) as unknown as Record<string, unknown>;
  }
  async getGraphStats(): Promise<Record<string, unknown>> {
    return graphBuilderService.getGraphStats() as unknown as Record<string, unknown>;
  }
  async processDocument(documentId: string): Promise<GraphProcessingResult> {
    return graphBuilderService.processDocument(documentId) as unknown as GraphProcessingResult;
  }
  async getEntityById(entityId: string): Promise<KnowledgeEntity | null> {
    return graphBuilderService.getEntityById(entityId) as unknown as KnowledgeEntity | null;
  }
  async findSemanticallySimilarEntities(query: string, limit: number): Promise<KnowledgeEntity[]> {
    return graphBuilderService.findSemanticallySimilarEntities(query, limit) as unknown as KnowledgeEntity[];
  }
  async verifyEntity(entityId: string, userId: string) {
    return graphBuilderService.verifyEntity(entityId, userId);
  }
  async deleteEntity(entityId: string) {
    return graphBuilderService.deleteEntity(entityId);
  }
}
