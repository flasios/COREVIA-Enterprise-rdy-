/**
 * Quality Scoring Service
 * Provides multi-dimensional quality assessment for knowledge documents.
 * Scores: completeness, citations, freshness, usage, metadata, structure, readability.
 */

export interface QualityScoreInput {
  fullText?: string;
  filename?: string;
  fileType?: string;
  fileSize?: number;
  category?: string | undefined;
  tags?: string[] | undefined;
  metadata?: Record<string, unknown> | undefined;
  uploadedAt?: Date | string | undefined;
  usageCount?: number | undefined;
}

export interface QualityBreakdown {
  completeness: number;
  citations: number;
  freshness: number;
  usage: number;
  metadata: number;
  structure: number;
  readability: number;
  total: number;
}

function clamp(n: number) { return Math.max(0, Math.min(100, Math.round(n))); }

export const qualityScoringService = {
  calculateQualityScore(input: QualityScoreInput): QualityBreakdown {
    const text = input.fullText || '';
    const uploadedAt = input.uploadedAt ? new Date(input.uploadedAt) : undefined;
    const usage = input.usageCount ?? 0;
    const tags = Array.isArray(input.tags) ? input.tags : [];
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Completeness: scaled by word count with diminishing returns
    // 0 words = 0, 100 words = 40, 500 words = 70, 1000+ words = 90, 2000+ = 100
    const completeness = clamp(
      wordCount <= 0 ? 0 :
      wordCount <= 100 ? wordCount * 0.4 :
      wordCount <= 500 ? 40 + (wordCount - 100) * 0.075 :
      wordCount <= 1000 ? 70 + (wordCount - 500) * 0.04 :
      wordCount <= 2000 ? 90 + (wordCount - 1000) * 0.01 :
      100
    );

    // Citations: detect references, URLs, numbered citations
    const citationsCount = (input.metadata && typeof input.metadata.citationsCount === 'number') 
      ? input.metadata.citationsCount 
      : 0;
    const urlMatches = (text.match(/https?:\/\/\S+/gi) || []).length;
    const refMatches = (text.match(/\[\d+\]|\(\d{4}\)/g) || []).length;
    const totalCitations = citationsCount + urlMatches + refMatches;
    const citations = clamp(Math.min(100, totalCitations * 8));

    // Freshness: recent uploads score higher
    let freshness = 50; // default if no upload date
    if (uploadedAt && !isNaN(uploadedAt.getTime())) {
      const days = (Date.now() - uploadedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (days <= 7) freshness = 100;
      else if (days <= 30) freshness = 90;
      else if (days <= 90) freshness = 75;
      else if (days <= 180) freshness = 60;
      else if (days <= 365) freshness = 40;
      else freshness = 20;
    }

    // Usage: logarithmic scaling for usage count
    const usageScore = clamp(usage <= 0 ? 0 : Math.min(100, Math.log2(usage + 1) * 15));

    // Metadata: presence of category, tags, filename, file type
    let metadataScore = 0;
    if (input.category) metadataScore += 30;
    if (tags.length >= 3) metadataScore += 30;
    else if (tags.length > 0) metadataScore += 15;
    if (input.filename) metadataScore += 15;
    if (input.fileType) metadataScore += 10;
    if (input.metadata && Object.keys(input.metadata).length > 2) metadataScore += 15;
    metadataScore = clamp(metadataScore);

    // Structure: detect headings, lists, sections
    const headingMatches = (text.match(/^#{1,6}\s|^[A-Z][A-Za-z\s]{3,50}:?\n/gm) || []).length;
    const listMatches = (text.match(/^[-*•]\s|^\d+\.\s/gm) || []).length;
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 20).length;
    let structure = 0;
    if (headingMatches >= 3) structure += 40;
    else if (headingMatches >= 1) structure += 20;
    if (listMatches >= 3) structure += 25;
    else if (listMatches >= 1) structure += 10;
    if (paragraphs >= 5) structure += 35;
    else if (paragraphs >= 2) structure += 20;
    else if (paragraphs >= 1) structure += 10;
    structure = clamp(structure);

    // Readability: avg sentence length, vocabulary diversity
    const avgSentenceLen = sentences.length > 0 ? wordCount / sentences.length : 0;
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const lexicalDiversity = wordCount > 0 ? uniqueWords.size / wordCount : 0;
    let readability = 50;
    // Ideal sentence length: 10-25 words
    if (avgSentenceLen >= 10 && avgSentenceLen <= 25) readability += 25;
    else if (avgSentenceLen >= 5 && avgSentenceLen <= 35) readability += 10;
    // Lexical diversity: 0.4-0.7 is good
    if (lexicalDiversity >= 0.4 && lexicalDiversity <= 0.7) readability += 25;
    else if (lexicalDiversity >= 0.3) readability += 10;
    readability = clamp(readability);

    // Weighted total
    const total = clamp(
      completeness * 0.25 +
      citations * 0.10 +
      freshness * 0.10 +
      usageScore * 0.10 +
      metadataScore * 0.15 +
      structure * 0.15 +
      readability * 0.15
    );

    return {
      completeness,
      citations,
      freshness,
      usage: usageScore,
      metadata: metadataScore,
      structure,
      readability,
      total,
    };
  }
};

export default qualityScoringService;
