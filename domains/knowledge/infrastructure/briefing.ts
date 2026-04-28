import { db } from '@platform/db';
import {
  executiveBriefings,
  briefingSections,
  knowledgeDocuments,
  knowledgeChunks,
  BRIEFING_TYPES,
  type ExecutiveBriefing,
  type BriefingSection,
} from '@shared/schema';
import { eq, sql, and, gte, lte, desc, asc, SQL } from 'drizzle-orm';
import { generateBrainDraftArtifact } from '@platform/ai/brainDraftArtifact';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface BriefingScope {
  categories?: string[];
  dateRange?: { start: Date; end: Date };
  documentIds?: string[];
  topics?: string[];
  maxDocuments?: number;
}

export interface KeyFinding {
  title: string;
  summary: string;
  importance: 'high' | 'medium' | 'low';
  sourceDocuments: string[];
  dataPoints?: Record<string, string | number | boolean | object>;
}

export interface Trend {
  title: string;
  direction: 'increasing' | 'decreasing' | 'stable' | 'emerging';
  description: string;
  evidence: string[];
  impactAreas: string[];
}

export interface Recommendation {
  title: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  rationale: string;
  expectedOutcome: string;
  timeline?: string;
}

export interface RiskAlert {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affectedAreas: string[];
  mitigationSuggestions: string[];
}

export interface BriefingContent {
  executiveSummary: string;
  keyFindings: KeyFinding[];
  trends: Trend[];
  recommendations: Recommendation[];
  riskAlerts: RiskAlert[];
  confidenceScore: number;
}

export interface SourceDocument {
  id: string;
  filename: string;
  category: string | null;
  content: string;
}

export interface EnrichedDocument {
  id: string;
  filename: string;
  category: string | null;
  fullText: string | null;
  uploadedAt: Date;
}

export interface ParsedBriefingResponse {
  executiveSummary: string;
  keyFindings: KeyFinding[];
  trends: Trend[];
  recommendations: Recommendation[];
  riskAlerts: RiskAlert[];
  confidenceScore: number;
}

export interface ListBriefingsOptions {
  status?: string;
  type?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface ListBriefingsResult {
  briefings: ExecutiveBriefing[];
  total: number;
}

export interface BriefingWithSections {
  briefing: ExecutiveBriefing;
  sections: BriefingSection[];
}

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CONFIG = {
  MODEL: 'claude-sonnet-4-20250514' as const,
  TIMEOUTS: {
    DEFAULT: 180000,
    GENERATION: 240000,
  },
  LIMITS: {
    MAX_RETRIES: 2,
    MAX_DOCUMENTS_DEFAULT: 20,
    MAX_DOCUMENTS_WEEKLY: 30,
    MAX_TOKENS: 8000,
    DOCUMENT_CONTENT_LENGTH: 8000,
    MIN_SUMMARY_LENGTH: 50,
    GOOD_SUMMARY_LENGTH: 200,
    TOP_HIGHLIGHTS: 3,
  },
  QUALITY_WEIGHTS: {
    SUMMARY_MIN: 10,
    SUMMARY_GOOD: 20,
    KEY_FINDINGS: 5,
    KEY_FINDINGS_MAX: 25,
    TRENDS: 5,
    TRENDS_MAX: 15,
    RECOMMENDATIONS: 5,
    RECOMMENDATIONS_MAX: 20,
    RISK_ALERTS: 5,
    RISK_ALERTS_MAX: 10,
    DOCUMENTS: 2,
    DOCUMENTS_MAX: 10,
  },
  WEEKLY_DIGEST: {
    DAYS_BACK: 7,
    FALLBACK_DAYS_BACK: 30,
  },
} as const;

const BRIEFING_TYPE_INSTRUCTIONS: Record<string, string> = {
  weekly_digest: 'Summarize the week\'s key developments, new policies, and important updates. Focus on what decision-makers need to know.',
  topic_deep_dive: 'Provide an in-depth analysis of the specified topic. Include technical details, implications, and expert insights.',
  trend_analysis: 'Identify and analyze emerging trends, patterns, and shifts. Project future implications and recommend strategic responses.',
  gap_assessment: 'Identify gaps in coverage, missing information, and areas needing additional documentation or research.',
  custom: 'Provide a comprehensive analysis tailored to the specified requirements.',
} as const;

const _SECTION_TYPES = [
  { type: 'key_findings', label: 'Key Findings' },
  { type: 'trends', label: 'Trends' },
  { type: 'recommendations', label: 'Recommendations' },
  { type: 'risk_alerts', label: 'Risk Alerts' },
] as const;

class BriefingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BriefingValidationError';
  }
}

class BriefingGenerationError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'BriefingGenerationError';
  }
}

export class BriefingService {
  private readonly logger = console;

  constructor() {
    this.logger.log('[BriefingService] Service initialized successfully (Brain-governed)');
  }

  async createBriefing(
    title: string,
    briefingType: (typeof BRIEFING_TYPES)[number],
    scope: BriefingScope,
    userId: string,
    customTopic?: string
  ): Promise<ExecutiveBriefing> {
    this.validateBriefingInput(title, briefingType, scope, userId);

    const startTime = Date.now();
    this.logger.log(`[BriefingService] Creating ${briefingType} briefing: "${title}"`);

    const [briefing] = await db.insert(executiveBriefings)
      .values({
        title: this.sanitizeTitle(title),
        briefingType,
        status: 'generating',
        scope: scope as unknown as Record<string, unknown>,
        generatedBy: userId,
        weekStart: scope.dateRange?.start
          ? new Date(scope.dateRange.start).toISOString().split('T')[0]
          : null,
        weekEnd: scope.dateRange?.end
          ? new Date(scope.dateRange.end).toISOString().split('T')[0]
          : null,
      })
      .returning();

    try {
      const { documents, totalChunks } = await this.gatherSourceDocuments(scope);

      if (documents.length === 0) {
        throw new BriefingValidationError('No documents found matching the specified scope');
      }

      this.logger.log(`[BriefingService] Found ${documents.length} documents (${totalChunks} chunks)`);

      const content = await this.generateBriefingContent({
        decisionSpineId: `DSP-BRIEFING-${briefing!.id}`,
        briefingTitle: title,
        documents,
        briefingType,
        userId,
        customTopic,
      });

      await this.createBriefingSections(briefing!.id, content);

      const qualityScore = this.calculateQualityScore(content, documents.length);

      const [updatedBriefing] = await db.update(executiveBriefings)
        .set({
          status: 'ready',
          executiveSummary: content.executiveSummary,
          keyFindings: content.keyFindings,
          trends: content.trends,
          recommendations: content.recommendations,
          riskAlerts: content.riskAlerts,
          sourceDocumentIds: documents.map((document) => document.id),
          citationCount: totalChunks,
          confidenceScore: content.confidenceScore,
          qualityScore,
          generatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(executiveBriefings.id, briefing!.id))
        .returning();

      const duration = Date.now() - startTime;
      this.logger.log(`[BriefingService] Briefing created successfully in ${duration}ms (quality: ${qualityScore}%)`);

      return updatedBriefing!;
    } catch (error) {
      await this.handleBriefingError(briefing!.id, error);
      throw error;
    }
  }

  async generateWeeklyDigest(userId: string): Promise<ExecutiveBriefing> {
    const now = new Date();
    const weekAgo = new Date(
      now.getTime() - CONFIG.WEEKLY_DIGEST.DAYS_BACK * 24 * 60 * 60 * 1000
    );

    this.logger.log(`[BriefingService] Generating weekly digest for ${userId}`);

    try {
      return await this.createBriefing(
        `Weekly Intelligence Digest - ${now.toLocaleDateString()}`,
        'weekly_digest',
        {
          dateRange: { start: weekAgo, end: now },
          maxDocuments: CONFIG.LIMITS.MAX_DOCUMENTS_WEEKLY,
        },
        userId
      );
    } catch (error) {
      if (
        error instanceof BriefingValidationError &&
        error.message.includes('No documents found')
      ) {
        const fallbackStart = new Date(
          now.getTime() - CONFIG.WEEKLY_DIGEST.FALLBACK_DAYS_BACK * 24 * 60 * 60 * 1000
        );

        this.logger.warn(
          `[BriefingService] No documents in last ${CONFIG.WEEKLY_DIGEST.DAYS_BACK} days; retrying with ${CONFIG.WEEKLY_DIGEST.FALLBACK_DAYS_BACK}-day window.`
        );

        return this.createBriefing(
          `Weekly Intelligence Digest - ${now.toLocaleDateString()}`,
          'weekly_digest',
          {
            dateRange: { start: fallbackStart, end: now },
            maxDocuments: CONFIG.LIMITS.MAX_DOCUMENTS_WEEKLY,
          },
          userId
        );
      }

      throw error;
    }
  }

  async getBriefingById(briefingId: string): Promise<BriefingWithSections | null> {
    this.validateId(briefingId, 'briefingId');

    const [briefing] = await db.select()
      .from(executiveBriefings)
      .where(eq(executiveBriefings.id, briefingId))
      .limit(1);

    if (!briefing) {
      return null;
    }

    const sections = await db.select()
      .from(briefingSections)
      .where(eq(briefingSections.briefingId, briefingId))
      .orderBy(asc(briefingSections.sortOrder));

    return { briefing, sections };
  }

  async listBriefings(options: ListBriefingsOptions = {}): Promise<ListBriefingsResult> {
    const conditions: SQL<unknown>[] = [];

    if (options.status) {
      conditions.push(eq(executiveBriefings.status, options.status));
    }
    if (options.type) {
      conditions.push(eq(executiveBriefings.briefingType, options.type));
    }
    if (options.userId) {
      conditions.push(eq(executiveBriefings.generatedBy, options.userId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(executiveBriefings)
      .where(whereClause);

    const limit = Math.min(options.limit || 20, 100);
    const offset = Math.max(options.offset || 0, 0);

    const baseQuery = db.select()
      .from(executiveBriefings)
      .orderBy(desc(executiveBriefings.createdAt))
      .limit(limit)
      .offset(offset);

    const briefings = whereClause
      ? await baseQuery.where(whereClause)
      : await baseQuery;

    return {
      briefings,
      total: Number(countResult?.count || 0),
    };
  }

  async publishBriefing(briefingId: string): Promise<ExecutiveBriefing> {
    this.validateId(briefingId, 'briefingId');

    const [updated] = await db.update(executiveBriefings)
      .set({
        status: 'published',
        updatedAt: new Date(),
      })
      .where(eq(executiveBriefings.id, briefingId))
      .returning();

    if (!updated) {
      throw new BriefingValidationError(`Briefing ${briefingId} not found`);
    }

    this.logger.log(`[BriefingService] Briefing ${briefingId} published`);
    return updated;
  }

  async archiveBriefing(briefingId: string): Promise<ExecutiveBriefing> {
    this.validateId(briefingId, 'briefingId');

    const [updated] = await db.update(executiveBriefings)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(eq(executiveBriefings.id, briefingId))
      .returning();

    if (!updated) {
      throw new BriefingValidationError(`Briefing ${briefingId} not found`);
    }

    this.logger.log(`[BriefingService] Briefing ${briefingId} archived`);
    return updated;
  }

  async deleteBriefing(briefingId: string): Promise<boolean> {
    this.validateId(briefingId, 'briefingId');

    try {
      await db.delete(briefingSections)
        .where(eq(briefingSections.briefingId, briefingId));

      await db.delete(executiveBriefings)
        .where(eq(executiveBriefings.id, briefingId));

      this.logger.log(`[BriefingService] Briefing ${briefingId} deleted`);
      return true;
    } catch (error) {
      this.logger.error(`[BriefingService] Failed to delete briefing ${briefingId}:`, error);
      return false;
    }
  }

  private async gatherSourceDocuments(scope: BriefingScope): Promise<{
    documents: SourceDocument[];
    totalChunks: number;
  }> {
    const conditions: SQL<unknown>[] = [
      eq(knowledgeDocuments.processingStatus, 'completed'),
    ];

    if (scope.categories?.length) {
      conditions.push(sql`${knowledgeDocuments.category} = ANY(${scope.categories})`);
    }

    if (scope.dateRange) {
      conditions.push(gte(knowledgeDocuments.uploadedAt, scope.dateRange.start));
      conditions.push(lte(knowledgeDocuments.uploadedAt, scope.dateRange.end));
    }

    if (scope.documentIds?.length) {
      conditions.push(sql`${knowledgeDocuments.id} = ANY(${scope.documentIds})`);
    }

    const documents = await db.select({
      id: knowledgeDocuments.id,
      filename: knowledgeDocuments.filename,
      category: knowledgeDocuments.category,
      fullText: knowledgeDocuments.fullText,
      uploadedAt: knowledgeDocuments.uploadedAt,
    })
      .from(knowledgeDocuments)
      .where(and(...conditions))
      .orderBy(desc(knowledgeDocuments.qualityScore))
      .limit(scope.maxDocuments || CONFIG.LIMITS.MAX_DOCUMENTS_DEFAULT);

    let totalChunks = 0;
    const enrichedDocs = await Promise.all(
      documents.map(async (document: EnrichedDocument) => {
        const chunks = await db.select({ content: knowledgeChunks.content })
          .from(knowledgeChunks)
          .where(eq(knowledgeChunks.documentId, document.id))
          .orderBy(asc(knowledgeChunks.chunkIndex));

        totalChunks += chunks.length;

        return {
          id: document.id,
          filename: document.filename,
          category: document.category,
          content: document.fullText || chunks.map((chunk) => chunk.content).join('\n\n'),
        } as SourceDocument;
      })
    );

    return {
      documents: enrichedDocs,
      totalChunks,
    };
  }

  private async generateBriefingContent(
    params: {
      decisionSpineId: string;
      briefingTitle: string;
      documents: SourceDocument[];
      briefingType: (typeof BRIEFING_TYPES)[number];
      userId: string;
      customTopic?: string;
    }
  ): Promise<BriefingContent> {
    const { decisionSpineId, briefingTitle, documents, briefingType, userId, customTopic } = params;

    this.logger.log(`[BriefingService] Generating ${briefingType} briefing from ${documents.length} documents`);

    const prompt = this.buildPrompt(documents, briefingType, customTopic);

    try {
      const artifact = await generateBrainDraftArtifact({
        decisionSpineId,
        serviceId: 'knowledge',
        routeKey: 'knowledge.briefing.generate',
        artifactType: 'EXECUTIVE_BRIEFING',
        userId,
        inputData: {
          briefingTitle,
          briefingType,
          documentCount: documents.length,
          documents: documents.map((document) => ({
            id: document.id,
            filename: document.filename,
            category: document.category,
            contentExcerpt: String(document.content || '').substring(0, CONFIG.LIMITS.DOCUMENT_CONTENT_LENGTH),
          })),
          instructionPrompt: prompt,
        },
      });

      const parsedResponse = (artifact.content || {}) as unknown as ParsedBriefingResponse;

      return this.validateAndNormalizeBriefingContent(parsedResponse);
    } catch (error) {
      this.logger.error('[BriefingService] Content generation failed:', error);
      throw new BriefingGenerationError(
        'Failed to generate briefing content',
        error
      );
    }
  }

  private buildPrompt(
    documents: SourceDocument[],
    briefingType: (typeof BRIEFING_TYPES)[number],
    customTopic?: string
  ): string {
    const contextContent = documents
      .map((document, index) => {
        const truncatedContent = document.content.substring(0, CONFIG.LIMITS.DOCUMENT_CONTENT_LENGTH);
        return `=== DOCUMENT ${index + 1}: ${document.filename} (${document.category || 'Uncategorized'}) ===\n${truncatedContent}`;
      })
      .join('\n\n');

    const typeInstruction = this.getTypeInstruction(briefingType, customTopic);

    return `You are an executive briefing analyst for UAE government digital transformation initiatives.
Analyze the following documents and generate an executive briefing.

BRIEFING TYPE: ${briefingType}
INSTRUCTIONS: ${typeInstruction}

DOCUMENTS TO ANALYZE:
${contextContent}

Generate a comprehensive briefing with the following structure. Return ONLY valid JSON:

{
  "executiveSummary": "A 2-3 paragraph executive summary highlighting the most critical information for senior decision-makers",
  "keyFindings": [
    {
      "title": "Finding title",
      "summary": "Detailed summary of the finding",
      "importance": "high|medium|low",
      "sourceDocuments": ["document filenames that support this finding"],
      "dataPoints": { "metric": "value" }
    }
  ],
  "trends": [
    {
      "title": "Trend title",
      "direction": "increasing|decreasing|stable|emerging",
      "description": "Description of the trend",
      "evidence": ["Evidence points"],
      "impactAreas": ["Areas affected"]
    }
  ],
  "recommendations": [
    {
      "title": "Recommendation title",
      "priority": "critical|high|medium|low",
      "description": "Detailed recommendation",
      "rationale": "Why this is recommended",
      "expectedOutcome": "What success looks like",
      "timeline": "Suggested timeline"
    }
  ],
  "riskAlerts": [
    {
      "title": "Risk title",
      "severity": "critical|high|medium|low",
      "description": "Risk description",
      "affectedAreas": ["Areas at risk"],
      "mitigationSuggestions": ["How to mitigate"]
    }
  ],
  "confidenceScore": 0.85
}

Focus on actionable insights for UAE government digital transformation. Be specific and cite sources.`;
  }

  private getTypeInstruction(
    briefingType: (typeof BRIEFING_TYPES)[number],
    customTopic?: string
  ): string {
    if (briefingType === 'topic_deep_dive' && customTopic) {
      return `Provide an in-depth analysis of ${customTopic}. Include technical details, implications, and expert insights.`;
    }
    if (briefingType === 'custom' && customTopic) {
      return customTopic;
    }
    return BRIEFING_TYPE_INSTRUCTIONS[briefingType] ?? '';
  }

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

  private validateAndNormalizeBriefingContent(
    response: ParsedBriefingResponse
  ): BriefingContent {
    return {
      executiveSummary: response.executiveSummary || '',
      keyFindings: (response.keyFindings || [])
        .filter((finding: KeyFinding) => finding.title && finding.summary),
      trends: (response.trends || [])
        .filter((trend: Trend) => trend.title && trend.description),
      recommendations: (response.recommendations || [])
        .filter((recommendation: Recommendation) => recommendation.title && recommendation.description),
      riskAlerts: (response.riskAlerts || [])
        .filter((riskAlert: RiskAlert) => riskAlert.title && riskAlert.description),
      confidenceScore: this.normalizeConfidenceScore(response.confidenceScore),
    };
  }

  private normalizeConfidenceScore(score: number): number {
    return Math.min(1, Math.max(0, score || 0.75));
  }

  private async createBriefingSections(
    briefingId: string,
    content: BriefingContent
  ): Promise<void> {
    const sections = [
      { type: 'key_findings', data: content.keyFindings },
      { type: 'trends', data: content.trends },
      { type: 'recommendations', data: content.recommendations },
      { type: 'risk_alerts', data: content.riskAlerts },
    ];

    for (let index = 0; index < sections.length; index++) {
      const section = sections[index]!;
      if (section.data?.length > 0) {
        const sectionLabel = this.formatSectionLabel(section.type);

        await db.insert(briefingSections)
          .values({
            briefingId,
            sectionType: section.type,
            title: sectionLabel,
            content: JSON.stringify(section.data),
            highlights: section.data.slice(0, CONFIG.LIMITS.TOP_HIGHLIGHTS),
            sortOrder: index,
          });
      }
    }
  }

  private formatSectionLabel(sectionType: string): string {
    return sectionType
      .replace('_', ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  private calculateQualityScore(content: BriefingContent, documentCount: number): number {
    let score = 0;

    if (content.executiveSummary?.length >= CONFIG.LIMITS.GOOD_SUMMARY_LENGTH) {
      score += CONFIG.QUALITY_WEIGHTS.SUMMARY_GOOD;
    } else if (content.executiveSummary?.length >= CONFIG.LIMITS.MIN_SUMMARY_LENGTH) {
      score += CONFIG.QUALITY_WEIGHTS.SUMMARY_MIN;
    }

    score += Math.min(
      CONFIG.QUALITY_WEIGHTS.KEY_FINDINGS_MAX,
      content.keyFindings.length * CONFIG.QUALITY_WEIGHTS.KEY_FINDINGS
    );

    score += Math.min(
      CONFIG.QUALITY_WEIGHTS.TRENDS_MAX,
      content.trends.length * CONFIG.QUALITY_WEIGHTS.TRENDS
    );

    score += Math.min(
      CONFIG.QUALITY_WEIGHTS.RECOMMENDATIONS_MAX,
      content.recommendations.length * CONFIG.QUALITY_WEIGHTS.RECOMMENDATIONS
    );

    score += Math.min(
      CONFIG.QUALITY_WEIGHTS.RISK_ALERTS_MAX,
      content.riskAlerts.length * CONFIG.QUALITY_WEIGHTS.RISK_ALERTS
    );

    score += Math.min(
      CONFIG.QUALITY_WEIGHTS.DOCUMENTS_MAX,
      documentCount * CONFIG.QUALITY_WEIGHTS.DOCUMENTS
    );

    return Math.min(100, Math.round(score));
  }

  private validateBriefingInput(
    title: string,
    briefingType: string,
    scope: BriefingScope,
    userId: string
  ): void {
    if (!title?.trim()) {
      throw new BriefingValidationError('Title is required');
    }

    if (!briefingType) {
      throw new BriefingValidationError('Briefing type is required');
    }

    if (!userId?.trim()) {
      throw new BriefingValidationError('User ID is required');
    }

    if (scope.maxDocuments && scope.maxDocuments < 1) {
      throw new BriefingValidationError('maxDocuments must be at least 1');
    }

    if (scope.dateRange) {
      if (!(scope.dateRange.start instanceof Date) ||
          !(scope.dateRange.end instanceof Date)) {
        throw new BriefingValidationError('Invalid date range');
      }
      if (scope.dateRange.start > scope.dateRange.end) {
        throw new BriefingValidationError('Start date must be before end date');
      }
    }
  }

  private validateId(id: string, fieldName: string): void {
    if (!id?.trim()) {
      throw new BriefingValidationError(`${fieldName} is required`);
    }
  }

  private sanitizeTitle(title: string): string {
    return title.trim().substring(0, 255);
  }

  private async handleBriefingError(briefingId: string, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    this.logger.error(`[BriefingService] Briefing ${briefingId} failed:`, error);

    await db.update(executiveBriefings)
      .set({
        status: 'draft',
        metadata: { error: errorMessage },
        updatedAt: new Date(),
      })
      .where(eq(executiveBriefings.id, briefingId));
  }

  public getStatus(): {
    available: boolean;
    model: string;
    timeout: number;
  } {
    return {
      available: true,
      model: CONFIG.MODEL,
      timeout: CONFIG.TIMEOUTS.DEFAULT,
    };
  }
}

export const briefingService = new BriefingService();