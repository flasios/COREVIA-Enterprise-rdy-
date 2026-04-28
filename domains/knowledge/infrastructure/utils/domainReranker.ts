import type { DocumentChunk } from '@shared/aiAdapters';
import type { DomainConfig } from '../agents/baseAgent';

export function rerankByDomain(chunks: DocumentChunk[], config: DomainConfig): DocumentChunk[] {
  return chunks
    .map(chunk => {
      let boost = 1.0;
      
      // Boost if metadata contains domain keywords
      const metadata = chunk.metadata || {};
      const metadataText = JSON.stringify(metadata).toLowerCase();
      
      const keywordMatches = config.keywords.filter(kw => 
        metadataText.includes(kw.toLowerCase())
      ).length;
      
      if (keywordMatches > 0) {
        boost = config.rerankBoost;
      }
      
      // Apply boost to relevance score
      const boostedScore = (chunk.relevance || 0) * boost;
      
      return {
        ...chunk,
        relevance: boostedScore,
        originalRelevance: chunk.relevance
      };
    })
    .sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
}
