import type {
  GraphDeps,
} from "./buildDeps";
import type { KnowResult } from "./shared";


// ════════════════════════════════════════════════════════════════════
// GRAPH USE-CASES
// ════════════════════════════════════════════════════════════════════

export async function getGraphData(
  deps: Pick<GraphDeps, "graphBuilder">,
  params: { entityTypes?: string; limit?: number; search?: string; includeRelationships?: boolean },
): Promise<KnowResult> {
  const graphData = await deps.graphBuilder.getGraphData({
    entityTypes: params.entityTypes ? params.entityTypes.split(",") : undefined,
    limit: params.limit ?? 100,
    searchTerm: params.search,
    includeRelationships: params.includeRelationships !== false,
  });
  return { success: true, data: graphData };
}


export async function getGraphStats(
  deps: Pick<GraphDeps, "graphBuilder">,
): Promise<KnowResult> {
  const stats = await deps.graphBuilder.getGraphStats();
  return { success: true, data: stats };
}


export async function processDocumentForGraph(
  deps: Pick<GraphDeps, "graphBuilder">,
  documentId: string,
): Promise<KnowResult> {
  const result = await deps.graphBuilder.processDocument(documentId);
  return {
    success: true,
    data: {
      entities: result.entities.length,
      relationships: result.relationships.length,
      savedEntities: result.savedEntities,
      savedRelationships: result.savedRelationships,
    },
  };
}


export async function getEntityById(
  deps: Pick<GraphDeps, "graphBuilder">,
  entityId: string,
): Promise<KnowResult> {
  const result = await deps.graphBuilder.getEntityById(entityId);
  if (!result) return { success: false, error: "Entity not found", status: 404 };
  return { success: true, data: result };
}


export async function searchEntities(
  deps: Pick<GraphDeps, "graphBuilder">,
  query: string,
  limit: number,
): Promise<KnowResult> {
  if (!query) return { success: false, error: "Query is required", status: 400 };
  const results = await deps.graphBuilder.findSemanticallySimilarEntities(query, limit || 10);
  return { success: true, data: results };
}


export async function verifyEntity(
  deps: Pick<GraphDeps, "graphBuilder">,
  entityId: string,
  userId: string,
): Promise<KnowResult> {
  const result = await deps.graphBuilder.verifyEntity(entityId, userId);
  return { success: true, data: result };
}


export async function deleteEntity(
  deps: Pick<GraphDeps, "graphBuilder">,
  entityId: string,
): Promise<KnowResult> {
  const result = await deps.graphBuilder.deleteEntity(entityId);
  return { success: true, data: result };
}
