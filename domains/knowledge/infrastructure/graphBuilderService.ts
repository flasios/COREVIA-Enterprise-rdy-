import { db } from '@platform/db';
import { 
  knowledgeEntities, 
  knowledgeRelationships, 
  knowledgeDocuments,
  knowledgeChunks,
  ENTITY_TYPES,
  RELATIONSHIP_TYPES,
  type KnowledgeEntity,
  type KnowledgeRelationship,
} from '@shared/schema';
import { eq, sql, and, or, ilike, desc, asc } from 'drizzle-orm';
import { embeddingsService } from './embeddings';
import { generateBrainDraftArtifact } from '@platform/ai/brainDraftArtifact';
import { logger } from "@platform/logging/Logger";

export interface ExtractedEntity {
  name: string;
  type: (typeof ENTITY_TYPES)[number];
  description?: string;
  properties?: Record<string, unknown>;
  confidence: number;
}

export interface ExtractedRelationship {
  sourceEntityName: string;
  targetEntityName: string;
  type: (typeof RELATIONSHIP_TYPES)[number];
  description?: string;
  strength: number;
  confidence: number;
}

export interface GraphExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  documentId: string;
}

export interface GraphStats {
  totalEntities: number;
  totalRelationships: number;
  entityTypeDistribution: Record<string, number>;
  relationshipTypeDistribution: Record<string, number>;
  topConnectedEntities: Array<{ id: string; name: string; connections: number }>;
}

export class GraphBuilderService {
  private cleanJsonResponse(text: string): string {
    let cleaned = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }
    
    return cleaned;
  }

  async extractEntitiesAndRelationships(
    documentId: string,
    content: string,
    documentTitle: string
  ): Promise<GraphExtractionResult> {
    logger.info(`[GraphBuilder] Extracting entities from document: ${documentTitle}`);
    
    const truncatedContent = content.substring(0, 15000);
    
    const prompt = `Analyze this UAE government document and extract knowledge graph entities and relationships.

DOCUMENT TITLE: ${documentTitle}

DOCUMENT CONTENT:
${truncatedContent}

ENTITY TYPES TO EXTRACT:
${ENTITY_TYPES.join(', ')}

RELATIONSHIP TYPES TO USE:
${RELATIONSHIP_TYPES.join(', ')}

INSTRUCTIONS:
1. Extract key entities mentioned in the document (policies, departments, projects, technologies, people, requirements, standards, etc.)
2. Identify relationships between these entities
3. Assign confidence scores (0.0-1.0) based on how explicitly the entity/relationship is mentioned
4. Focus on government-relevant entities for UAE digital transformation context

Return a JSON object with this structure:
{
  "entities": [
    {
      "name": "Entity Name",
      "type": "policy|regulation|project|department|person|technology|process|kpi|risk|requirement|standard|framework|document|initiative",
      "description": "Brief description",
      "properties": { "key": "value" },
      "confidence": 0.95
    }
  ],
  "relationships": [
    {
      "sourceEntityName": "Source Entity Name",
      "targetEntityName": "Target Entity Name", 
      "type": "references|implements|supersedes|depends_on|related_to|owned_by|managed_by|impacts|enables|constrains|derived_from|part_of",
      "description": "Description of relationship",
      "strength": 0.8,
      "confidence": 0.9
    }
  ]
}

Output ONLY valid JSON, no additional text.`;

    try {
      const artifact = await generateBrainDraftArtifact({
        decisionSpineId: `DSP-KG-${documentId}`,
        serviceId: 'knowledge',
        routeKey: 'knowledge.graph.extract',
        artifactType: 'KNOWLEDGE_GRAPH_EXTRACTION',
        userId: 'system',
        inputData: {
          documentId,
          documentTitle,
          contentExcerpt: truncatedContent,
          entityTypes: ENTITY_TYPES,
          relationshipTypes: RELATIONSHIP_TYPES,
          instructionPrompt: prompt,
        },
      });

      const extracted = artifact.content || {};

      const validEntities = ((extracted as Record<string, any>).entities || []).filter((e: any) =>  // eslint-disable-line @typescript-eslint/no-explicit-any
        e.name && ENTITY_TYPES.includes(e.type)
      ).map((e: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        name: e.name,
        type: e.type as (typeof ENTITY_TYPES)[number],
        description: e.description || '',
        properties: e.properties || {},
        confidence: Math.min(1, Math.max(0, e.confidence || 0.8))
      }));

      const validRelationships = ((extracted as Record<string, any>).relationships || []).filter((r: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
        r.sourceEntityName && r.targetEntityName && RELATIONSHIP_TYPES.includes(r.type)
      ).map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        sourceEntityName: r.sourceEntityName,
        targetEntityName: r.targetEntityName,
        type: r.type as (typeof RELATIONSHIP_TYPES)[number],
        description: r.description || '',
        strength: Math.min(1, Math.max(0, r.strength || 0.5)),
        confidence: Math.min(1, Math.max(0, r.confidence || 0.8))
      }));

      logger.info(`[GraphBuilder] Extracted ${validEntities.length} entities and ${validRelationships.length} relationships`);

      return {
        entities: validEntities,
        relationships: validRelationships,
        documentId
      };
    } catch (error) {
      logger.error('[GraphBuilder] Entity extraction failed:', error);
      return {
        entities: [],
        relationships: [],
        documentId
      };
    }
  }

  async saveGraphToDatabase(
    extraction: GraphExtractionResult
  ): Promise<{ savedEntities: number; savedRelationships: number }> {
    const entityNameToId = new Map<string, string>();
    let savedEntities = 0;
    let savedRelationships = 0;

    for (const entity of extraction.entities) {
      try {
        const existing = await db.select()
          .from(knowledgeEntities)
          .where(and(
            ilike(knowledgeEntities.name, entity.name),
            eq(knowledgeEntities.entityType, entity.type)
          ))
          .limit(1);

        if (existing.length > 0) {
          entityNameToId.set(entity.name, existing[0]!.id);
          
          await db.update(knowledgeEntities)
            .set({
              description: entity.description || existing[0]!.description,
              properties: { ...existing[0]!.properties as object, ...entity.properties },
              updatedAt: new Date()
            })
            .where(eq(knowledgeEntities.id, existing[0]!.id));
        } else {
          let embedding: number[] | undefined;
          try {
            const result = await embeddingsService.generateEmbedding(
              `${entity.name}: ${entity.description || ''}`
            );
            embedding = result.embedding;
          } catch (_e) {
            logger.warn('[GraphBuilder] Failed to generate embedding for entity:', entity.name);
          }

          const [inserted] = await db.insert(knowledgeEntities)
            .values({
              name: entity.name,
              entityType: entity.type,
              description: entity.description,
              sourceDocumentId: extraction.documentId,
              properties: entity.properties,
              embedding: embedding,
              confidence: entity.confidence,
              isVerified: false,
            })
            .returning();

          entityNameToId.set(entity.name, inserted!.id);
          savedEntities++;
        }
      } catch (error) {
        logger.error(`[GraphBuilder] Failed to save entity ${entity.name}:`, error);
      }
    }

    for (const rel of extraction.relationships) {
      const sourceId = entityNameToId.get(rel.sourceEntityName);
      const targetId = entityNameToId.get(rel.targetEntityName);

      if (!sourceId || !targetId) {
        logger.warn(`[GraphBuilder] Skipping relationship: missing entity IDs for ${rel.sourceEntityName} -> ${rel.targetEntityName}`);
        continue;
      }

      try {
        const existing = await db.select()
          .from(knowledgeRelationships)
          .where(and(
            eq(knowledgeRelationships.sourceEntityId, sourceId),
            eq(knowledgeRelationships.targetEntityId, targetId),
            eq(knowledgeRelationships.relationshipType, rel.type)
          ))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(knowledgeRelationships)
            .values({
              sourceEntityId: sourceId,
              targetEntityId: targetId,
              relationshipType: rel.type,
              description: rel.description,
              strength: rel.strength,
              confidence: rel.confidence,
              isVerified: false,
            });
          savedRelationships++;
        } else {
          await db.update(knowledgeRelationships)
            .set({
              strength: Math.max(existing[0]!.strength || 0, rel.strength),
              confidence: Math.max(existing[0]!.confidence || 0, rel.confidence),
              updatedAt: new Date()
            })
            .where(eq(knowledgeRelationships.id, existing[0]!.id));
        }
      } catch (error) {
        logger.error(`[GraphBuilder] Failed to save relationship:`, error);
      }
    }

    logger.info(`[GraphBuilder] Saved ${savedEntities} entities and ${savedRelationships} relationships`);
    return { savedEntities, savedRelationships };
  }

  async processDocument(documentId: string): Promise<GraphExtractionResult & { savedEntities: number; savedRelationships: number }> {
    const [document] = await db.select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, documentId))
      .limit(1);

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const chunks = await db.select()
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.documentId, documentId))
      .orderBy(asc(knowledgeChunks.chunkIndex));

    const content = chunks.map(c => c.content).join('\n\n');
    
    const fullContent = document.fullText || content || '';

    const extraction = await this.extractEntitiesAndRelationships(
      documentId,
      fullContent,
      document.filename
    );

    const { savedEntities, savedRelationships } = await this.saveGraphToDatabase(extraction);

    return {
      ...extraction,
      savedEntities,
      savedRelationships
    };
  }

  async getGraphData(options: {
    entityTypes?: string[];
    limit?: number;
    searchTerm?: string;
    includeRelationships?: boolean;
  } = {}): Promise<{
    entities: KnowledgeEntity[];
    relationships: KnowledgeRelationship[];
  }> {
    const { entityTypes, limit = 100, searchTerm, includeRelationships = true } = options;

    let entityQuery = db.select().from(knowledgeEntities);
    
    const conditions: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    
    if (entityTypes && entityTypes.length > 0) {
      conditions.push(sql`${knowledgeEntities.entityType} = ANY(${entityTypes})`);
    }
    
    if (searchTerm) {
      conditions.push(
        or(
          ilike(knowledgeEntities.name, `%${searchTerm}%`),
          ilike(knowledgeEntities.description, `%${searchTerm}%`)
        )
      );
    }

    if (conditions.length > 0) {
      entityQuery = entityQuery.where(and(...conditions)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    const entities = await (entityQuery as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .orderBy(desc(knowledgeEntities.usageCount))
      .limit(limit);

    let relationships: KnowledgeRelationship[] = [];
    
    if (includeRelationships && entities.length > 0) {
      const entityIds = entities.map((e: KnowledgeEntity) => e.id);
      
      relationships = await db.select()
        .from(knowledgeRelationships)
        .where(
          or(
            sql`${knowledgeRelationships.sourceEntityId} = ANY(${entityIds})`,
            sql`${knowledgeRelationships.targetEntityId} = ANY(${entityIds})`
          )
        )
        .limit(500);
    }

    return { entities, relationships };
  }

  async getGraphStats(): Promise<GraphStats> {
    const [entityCount] = await db.select({ count: sql<number>`count(*)` })
      .from(knowledgeEntities);
    
    const [relationshipCount] = await db.select({ count: sql<number>`count(*)` })
      .from(knowledgeRelationships);

    const entityTypeCounts = await db.select({
      type: knowledgeEntities.entityType,
      count: sql<number>`count(*)`
    })
      .from(knowledgeEntities)
      .groupBy(knowledgeEntities.entityType);

    const relationshipTypeCounts = await db.select({
      type: knowledgeRelationships.relationshipType,
      count: sql<number>`count(*)`
    })
      .from(knowledgeRelationships)
      .groupBy(knowledgeRelationships.relationshipType);

    const topConnected = await db.select({
      id: knowledgeEntities.id,
      name: knowledgeEntities.name,
      connections: sql<number>`(
        SELECT COUNT(*) FROM knowledge_relationships 
        WHERE source_entity_id = ${knowledgeEntities.id} OR target_entity_id = ${knowledgeEntities.id}
      )`
    })
      .from(knowledgeEntities)
      .orderBy(desc(sql`(
        SELECT COUNT(*) FROM knowledge_relationships 
        WHERE source_entity_id = ${knowledgeEntities.id} OR target_entity_id = ${knowledgeEntities.id}
      )`))
      .limit(10);

    return {
      totalEntities: Number(entityCount?.count || 0),
      totalRelationships: Number(relationshipCount?.count || 0),
      entityTypeDistribution: Object.fromEntries(
        entityTypeCounts.map(r => [r.type, Number(r.count)])
      ),
      relationshipTypeDistribution: Object.fromEntries(
        relationshipTypeCounts.map(r => [r.type, Number(r.count)])
      ),
      topConnectedEntities: topConnected.map(e => ({
        id: e.id,
        name: e.name,
        connections: Number(e.connections)
      }))
    };
  }

  async getEntityById(entityId: string): Promise<{
    entity: KnowledgeEntity;
    incomingRelationships: KnowledgeRelationship[];
    outgoingRelationships: KnowledgeRelationship[];
    relatedEntities: KnowledgeEntity[];
  } | null> {
    const [entity] = await db.select()
      .from(knowledgeEntities)
      .where(eq(knowledgeEntities.id, entityId))
      .limit(1);

    if (!entity) return null;

    const outgoingRelationships = await db.select()
      .from(knowledgeRelationships)
      .where(eq(knowledgeRelationships.sourceEntityId, entityId));

    const incomingRelationships = await db.select()
      .from(knowledgeRelationships)
      .where(eq(knowledgeRelationships.targetEntityId, entityId));

    const relatedEntityIds = new Set([
      ...outgoingRelationships.map(r => r.targetEntityId),
      ...incomingRelationships.map(r => r.sourceEntityId)
    ]);

    let relatedEntities: KnowledgeEntity[] = [];
    if (relatedEntityIds.size > 0) {
      relatedEntities = await db.select()
        .from(knowledgeEntities)
        .where(sql`${knowledgeEntities.id} = ANY(${Array.from(relatedEntityIds)})`);
    }

    await db.update(knowledgeEntities)
      .set({
        usageCount: (entity.usageCount || 0) + 1,
        lastAccessed: new Date()
      })
      .where(eq(knowledgeEntities.id, entityId));

    return {
      entity,
      incomingRelationships,
      outgoingRelationships,
      relatedEntities
    };
  }

  async findSemanticallySimilarEntities(
    queryText: string,
    limit: number = 10
  ): Promise<Array<{ entity: KnowledgeEntity; similarity: number }>> {
    try {
      const embeddingResult = await embeddingsService.generateEmbedding(queryText);
      const queryEmbedding = embeddingResult.embedding;
      
      const results = await db.select({
        entity: knowledgeEntities,
        similarity: sql<number>`1 - (${knowledgeEntities.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`
      })
        .from(knowledgeEntities)
        .where(sql`${knowledgeEntities.embedding} IS NOT NULL`)
        .orderBy(sql`${knowledgeEntities.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`)
        .limit(limit);

      return results.map(r => ({
        entity: r.entity,
        similarity: r.similarity
      }));
    } catch (error) {
      logger.error('[GraphBuilder] Semantic search failed:', error);
      return [];
    }
  }

  async deleteEntity(entityId: string): Promise<boolean> {
    try {
      await db.delete(knowledgeEntities)
        .where(eq(knowledgeEntities.id, entityId));
      return true;
    } catch (error) {
      logger.error('[GraphBuilder] Failed to delete entity:', error);
      return false;
    }
  }

  async verifyEntity(entityId: string, userId: string): Promise<boolean> {
    try {
      await db.update(knowledgeEntities)
        .set({
          isVerified: true,
          verifiedBy: userId,
          updatedAt: new Date()
        })
        .where(eq(knowledgeEntities.id, entityId));
      return true;
    } catch (error) {
      logger.error('[GraphBuilder] Failed to verify entity:', error);
      return false;
    }
  }

  async verifyRelationship(relationshipId: string, userId: string): Promise<boolean> {
    try {
      await db.update(knowledgeRelationships)
        .set({
          isVerified: true,
          verifiedBy: userId,
          updatedAt: new Date()
        })
        .where(eq(knowledgeRelationships.id, relationshipId));
      return true;
    } catch (error) {
      logger.error('[GraphBuilder] Failed to verify relationship:', error);
      return false;
    }
  }
}

export const graphBuilderService = new GraphBuilderService();
