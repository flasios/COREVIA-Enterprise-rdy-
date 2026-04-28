import type {
  IDemandStoragePort,
  IKnowledgeStoragePort,
  IVersioningStoragePort,
} from '@interfaces/storage/ports';
import { chunkingService, embeddingsService } from '@domains/knowledge/application';
import type { DemandReport, ReportVersion, InsertKnowledgeDocument, InsertKnowledgeChunk } from '@shared/schema';
import { logger } from "@platform/logging/Logger";

export type DemandAutoIndexingStorage =
  IDemandStoragePort &
  IVersioningStoragePort &
  IKnowledgeStoragePort;

/**
 * AutoIndexingService - Automatic Knowledge Base Indexing for Approved Artifacts
 *
 * Purpose: Automatically indexes approved business cases, requirements, and strategic fit
 * analyses into the knowledge base for RAG retrieval.
 *
 * Features:
 * - Idempotent indexing (prevents duplicate indexing)
 * - Structured markdown content assembly
 * - Automatic metadata extraction
 * - Non-blocking operation (doesn't block approval workflows)
 * - Graceful error handling
 */

interface IndexingJob {
  reportId: string;
  versionId: string | null;
  artifactType: 'business_case' | 'requirements' | 'strategic_fit';
  actorId: string;
}

interface IndexingResult {
  success: boolean;
  documentId?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

export class AutoIndexingService {
  constructor(private storage: DemandAutoIndexingStorage) {}

  /**
   * Main entry point for indexing approved artifacts
   * Enqueues indexing jobs for all artifact types
   */
  async enqueueApprovedArtifacts(
    reportId: string,
    versionId: string | null,
    actorId: string
  ): Promise<void> {
    // Run asynchronously without blocking the caller
    Promise.resolve().then(async () => {
      try {
        logger.info(`[AutoIndexing] Starting indexing for report ${reportId}, version ${versionId || 'latest'}`);

        const report = await this.storage.getDemandReport(reportId);
        if (!report) {
          logger.error(`[AutoIndexing] Report ${reportId} not found`);
          return;
        }

        let version: ReportVersion | null = null;
        if (versionId) {
          const versions = await this.storage.getReportVersions(reportId);
          version = versions.find(v => v.id === versionId) || null;
        } else {
          // Get latest published version
          const versions = await this.storage.getReportVersions(reportId);
          const publishedVersions = versions
            .filter(v => v.status === 'published')
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          version = publishedVersions[0] || null;
        }

        // Index all artifact types
        const jobs: IndexingJob[] = [
          { reportId, versionId: version?.id || null, artifactType: 'business_case', actorId },
          { reportId, versionId: version?.id || null, artifactType: 'requirements', actorId },
          { reportId, versionId: version?.id || null, artifactType: 'strategic_fit', actorId }
        ];

        for (const job of jobs) {
          try {
            await this.processIndexingJob(job, report, version);
          } catch (error) {
            logger.error(`[AutoIndexing] Failed to process ${job.artifactType} for report ${reportId}:`, error);
            // Continue with other jobs even if one fails
          }
        }

        logger.info(`[AutoIndexing] Completed indexing for report ${reportId}`);
      } catch (error) {
        logger.error(`[AutoIndexing] Fatal error in enqueueApprovedArtifacts:`, error);
      }
    }).catch(error => {
      // Final catch to ensure errors don't bubble up
      logger.error(`[AutoIndexing] Unhandled error in async indexing:`, error);
    });
  }

  /**
   * Process a single indexing job
   */
  private async processIndexingJob(
    job: IndexingJob,
    report: DemandReport,
    version: ReportVersion | null
  ): Promise<IndexingResult> {
    const { reportId, versionId, artifactType, actorId } = job;

    // Check idempotency
    const alreadyIndexed = await this.checkIdempotency(reportId, artifactType, versionId);
    if (alreadyIndexed) {
      logger.info(`[AutoIndexing] Skipping ${artifactType} for report ${reportId} - already indexed`);
      return { success: true, skipped: true, reason: 'Already indexed' };
    }

    // Index based on artifact type
    let result: IndexingResult;
    switch (artifactType) {
      case 'business_case':
        result = await this.indexBusinessCase(report, version, actorId);
        break;
      case 'requirements':
        result = await this.indexRequirements(report, version, actorId);
        break;
      case 'strategic_fit':
        result = await this.indexStrategicFit(report, version, actorId);
        break;
      default:
        result = { success: false, error: `Unknown artifact type: ${artifactType}` };
    }

    return result;
  }

  /**
   * Index business case artifact
   */
  private async indexBusinessCase(
    report: DemandReport,
    version: ReportVersion | null,
    actorId: string
  ): Promise<IndexingResult> {
    try {
      if (!version || !version.versionData) {
        logger.warn(`[AutoIndexing] No version data available for business case indexing`);
        return { success: false, error: 'No version data available' };
      }

      const versionData = version.versionData as Record<string, unknown>;
      const aiAnalysis = (versionData.aiAnalysis || report.aiAnalysis) as Record<string, unknown> | null;

      if (!aiAnalysis) {
        logger.warn(`[AutoIndexing] No AI analysis available for business case`);
        return { success: false, error: 'No AI analysis available' };
      }

      // Extract sections from version data
      const sections = {
        executiveSummary: aiAnalysis.executiveSummary || '',
        businessCase: aiAnalysis.businessCase || '',
        problemStatement: aiAnalysis.problemStatement || '',
        proposedSolution: aiAnalysis.proposedSolution || '',
        benefitsAnalysis: aiAnalysis.benefitsAnalysis || '',
        costAnalysis: aiAnalysis.costAnalysis || '',
        riskAssessment: aiAnalysis.riskAssessment || '',
        implementationPlan: aiAnalysis.implementationPlan || '',
        successMetrics: aiAnalysis.successMetrics || '',
        stakeholderAnalysis: aiAnalysis.stakeholderAnalysis || '',
        assumptions: aiAnalysis.assumptions || '',
        recommendations: aiAnalysis.recommendations || ''
      };

      // Assemble markdown content
      const content = this.assembleDocumentContent(sections, 'business_case');

      if (!content || content.trim().length === 0) {
        logger.warn(`[AutoIndexing] Empty content for business case`);
        return { success: false, error: 'Empty content' };
      }

      // Create document metadata
      const title = `Business Case • ${report.organizationName || 'Untitled'} • v${version.versionNumber}`;
      const tags = this.extractTags(report, 'business_case');
      const accessLevel = this.getAccessLevel(report);

      // Process and index the document
      const documentId = await this.processAndIndexDocument({
        title,
        content,
        category: 'business_case',
        tags,
        accessLevel,
        reportId: report.id,
        versionId: version.id,
        artifactType: 'business_case',
        actorId,
        metadata: {
          organizationName: report.organizationName,
          department: report.department,
          requestType: report.requestType,
          urgency: report.urgency,
          versionNumber: version.versionNumber,
          createdAt: report.createdAt,
          approvedAt: version.publishedAt || version.approvedAt
        }
      });

      return { success: true, documentId };
    } catch (error) {
      logger.error(`[AutoIndexing] Error indexing business case:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Index requirements artifact
   */
  private async indexRequirements(
    report: DemandReport,
    version: ReportVersion | null,
    actorId: string
  ): Promise<IndexingResult> {
    try {
      const requirementsAnalysis = report.requirementsAnalysis as Record<string, unknown>;

      if (!requirementsAnalysis) {
        logger.warn(`[AutoIndexing] No requirements analysis available`);
        return { success: false, error: 'No requirements analysis available' };
      }

      // Extract 10 requirement sections
      const sections = {
        capabilities: requirementsAnalysis.capabilities || '',
        capabilityGaps: requirementsAnalysis.capabilityGaps || '',
        functionalRequirements: requirementsAnalysis.functionalRequirements || '',
        nonFunctionalRequirements: requirementsAnalysis.nonFunctionalRequirements || '',
        securityRequirements: requirementsAnalysis.securityRequirements || '',
        worldClassRecommendations: requirementsAnalysis.worldClassRecommendations || '',
        requiredResources: requirementsAnalysis.requiredResources || '',
        estimatedEffort: requirementsAnalysis.estimatedEffort || '',
        rolesAndResponsibilities: requirementsAnalysis.rolesAndResponsibilities || '',
        requiredTechnology: requirementsAnalysis.requiredTechnology || ''
      };

      // Assemble markdown content
      const content = this.assembleDocumentContent(sections, 'requirements');

      if (!content || content.trim().length === 0) {
        logger.warn(`[AutoIndexing] Empty content for requirements`);
        return { success: false, error: 'Empty content' };
      }

      // Create document metadata
      const title = version
        ? `Requirements • ${report.organizationName || 'Untitled'} • v${version.versionNumber}`
        : `Requirements • ${report.organizationName || 'Untitled'}`;
      const tags = this.extractTags(report, 'requirements');
      const accessLevel = this.getAccessLevel(report);

      // Process and index the document
      const documentId = await this.processAndIndexDocument({
        title,
        content,
        category: 'requirements',
        tags,
        accessLevel,
        reportId: report.id,
        versionId: version?.id || null,
        artifactType: 'requirements',
        actorId,
        metadata: {
          organizationName: report.organizationName,
          department: report.department,
          requestType: report.requestType,
          urgency: report.urgency,
          versionNumber: version?.versionNumber,
          createdAt: report.createdAt,
          approvedAt: version?.publishedAt || version?.approvedAt
        }
      });

      return { success: true, documentId };
    } catch (error) {
      logger.error(`[AutoIndexing] Error indexing requirements:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Index strategic fit artifact
   */
  private async indexStrategicFit(
    report: DemandReport,
    version: ReportVersion | null,
    actorId: string
  ): Promise<IndexingResult> {
    try {
      const strategicFitAnalysis = report.strategicFitAnalysis as Record<string, unknown>;

      if (!strategicFitAnalysis) {
        logger.warn(`[AutoIndexing] No strategic fit analysis available`);
        return { success: false, error: 'No strategic fit analysis available' };
      }

      // Extract strategic fit sections
      const sections = {
        implementationRoute: strategicFitAnalysis.implementationRoute || '',
        executiveSummary: strategicFitAnalysis.executiveSummary || '',
        strategicAlignment: strategicFitAnalysis.strategicAlignment || '',
        businessValue: strategicFitAnalysis.businessValue || '',
        organizationalImpact: strategicFitAnalysis.organizationalImpact || '',
        riskConsiderations: strategicFitAnalysis.riskConsiderations || '',
        decisionCriteria: strategicFitAnalysis.decisionCriteria || '',
        confidenceScore: strategicFitAnalysis.confidenceScore || '',
        reasoning: strategicFitAnalysis.reasoning || ''
      };

      // Assemble markdown content
      const content = this.assembleDocumentContent(sections, 'strategic_fit');

      if (!content || content.trim().length === 0) {
        logger.warn(`[AutoIndexing] Empty content for strategic fit`);
        return { success: false, error: 'Empty content' };
      }

      // Create document metadata
      const title = version
        ? `Strategic Fit • ${report.organizationName || 'Untitled'} • v${version.versionNumber}`
        : `Strategic Fit • ${report.organizationName || 'Untitled'}`;
      const tags = this.extractTags(report, 'strategic_fit');
      const accessLevel = this.getAccessLevel(report);

      // Process and index the document
      const documentId = await this.processAndIndexDocument({
        title,
        content,
        category: 'strategic_fit',
        tags,
        accessLevel,
        reportId: report.id,
        versionId: version?.id || null,
        artifactType: 'strategic_fit',
        actorId,
        metadata: {
          organizationName: report.organizationName,
          department: report.department,
          requestType: report.requestType,
          urgency: report.urgency,
          implementationRoute: strategicFitAnalysis.implementationRoute,
          confidenceScore: strategicFitAnalysis.confidenceScore,
          versionNumber: version?.versionNumber,
          createdAt: report.createdAt,
          approvedAt: version?.publishedAt || version?.approvedAt
        }
      });

      return { success: true, documentId };
    } catch (error) {
      logger.error(`[AutoIndexing] Error indexing strategic fit:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Assemble structured markdown content from sections
   */
  private assembleDocumentContent(
    sections: Record<string, unknown>,
    type: 'business_case' | 'requirements' | 'strategic_fit'
  ): string {
    const parts: string[] = [];

    // Add document header based on type
    if (type === 'business_case') {
      parts.push('# Business Case Analysis\n');
    } else if (type === 'requirements') {
      parts.push('# Detailed Requirements Analysis\n');
    } else if (type === 'strategic_fit') {
      parts.push('# Strategic Fit Analysis\n');
    }

    // Convert each section to markdown
    for (const [key, value] of Object.entries(sections)) {
      if (!value) continue;

      // Convert camelCase to Title Case
      const sectionTitle = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();

      parts.push(`\n## ${sectionTitle}\n`);

      // Handle different value types
      if (typeof value === 'string') {
        parts.push(value.trim());
      } else if (Array.isArray(value)) {
        value.forEach(item => {
          if (typeof item === 'string') {
            parts.push(`- ${item}`);
          } else if (typeof item === 'object') {
            parts.push(`- ${JSON.stringify(item, null, 2)}`);
          }
        });
      } else if (typeof value === 'object') {
        // Format object as readable text
        parts.push(this.formatObjectAsMarkdown(value as Record<string, unknown>));
      } else {
        parts.push(String(value));
      }

      parts.push('');
    }

    return parts.join('\n').trim();
  }

  /**
   * Format object as readable markdown
   */
  private formatObjectAsMarkdown(obj: Record<string, unknown>, indent = 0): string {
    const parts: string[] = [];
    const prefix = '  '.repeat(indent);

    for (const [key, value] of Object.entries(obj)) {
      const label = key.replace(/([A-Z])/g, ' $1').trim();

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        parts.push(`${prefix}**${label}:**`);
        parts.push(this.formatObjectAsMarkdown(value as Record<string, unknown>, indent + 1));
      } else if (Array.isArray(value)) {
        parts.push(`${prefix}**${label}:**`);
        value.forEach(item => {
          if (typeof item === 'string') {
            parts.push(`${prefix}  - ${item}`);
          } else {
            parts.push(`${prefix}  - ${JSON.stringify(item)}`);
          }
        });
      } else {
        parts.push(`${prefix}**${label}:** ${value}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Process document: chunk text, generate embeddings, and store in knowledge base
   */
  private async processAndIndexDocument(params: {
    title: string;
    content: string;
    category: string;
    tags: string[];
    accessLevel: 'public' | 'internal' | 'confidential';
    reportId: string;
    versionId: string | null;
    artifactType: string;
    actorId: string;
    metadata: Record<string, unknown>;
  }): Promise<string> {
    const { title, content, category, tags, accessLevel, reportId, versionId, artifactType, actorId, metadata } = params;

    // Chunk the text
    const chunks = await chunkingService.chunkText(content);
    logger.info(`[AutoIndexing] Created ${chunks.length} chunks for ${artifactType}`);

    // Generate embeddings for all chunks
    const chunkTexts = chunks.map(c => c.content);
    const embeddingResult = await embeddingsService.generateBatchEmbeddings(chunkTexts);
    logger.info(`[AutoIndexing] Generated embeddings for ${chunks.length} chunks`);

    // Create knowledge document
    const documentData: InsertKnowledgeDocument = {
      filename: `${title}.md`,
      fileType: 'md',
      fileSize: content.length,
      fullText: content,
      summary: this.generateSummary(content),
      category,
      tags,
      accessLevel,
      processingStatus: 'completed',
      uploadedBy: actorId,
      metadata: {
        ...metadata,
        autoIndexed: {
          reportId,
          versionId,
          artifactType,
          indexedAt: new Date().toISOString(),
          source: 'auto-indexing-service'
        }
      }
    };

    const document = await this.storage.createKnowledgeDocument(documentData);
    logger.info(`[AutoIndexing] Created knowledge document ${document.id}`);

    // Create knowledge chunks with embeddings
    const chunkData: InsertKnowledgeChunk[] = chunks.map((chunk, index) => ({
      documentId: document.id,
      chunkIndex: index,
      content: chunk.content,
      embedding: embeddingResult.embeddings[index],
      tokenCount: chunk.tokenCount,
      metadata: chunk.metadata
    }));

    await this.storage.createKnowledgeChunksBatch(chunkData);
    logger.info(`[AutoIndexing] Created ${chunkData.length} knowledge chunks`);

    // Update document chunk count
    await this.storage.updateKnowledgeDocument(document.id, {
      chunkCount: chunks.length
    });

    return document.id;
  }

  /**
   * Generate a summary from content (first 500 characters)
   */
  private generateSummary(content: string): string {
    const maxLength = 500;
    if (content.length <= maxLength) {
      return content;
    }

    // Try to break at sentence boundary
    const truncated = content.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    if (lastPeriod > maxLength * 0.7) {
      return truncated.substring(0, lastPeriod + 1);
    }

    return truncated + '...';
  }

  /**
   * Extract tags from demand report
   */
  private extractTags(report: DemandReport, artifactType: string): string[] {
    const tags: string[] = [artifactType];

    // Add basic metadata as tags
    if (report.requestType) tags.push(report.requestType);
    if (report.urgency) tags.push(report.urgency.toLowerCase());
    if (report.department) tags.push(report.department);
    if (report.industryType) tags.push(report.industryType);

    // Add workflow status
    if (report.workflowStatus) tags.push(report.workflowStatus);

    // Extract strategic themes from strategic fit if available
    const strategicFit = report.strategicFitAnalysis as Record<string, unknown>;
    if (strategicFit?.implementationRoute) {
      tags.push(strategicFit.implementationRoute as string);
    }

    // Deduplicate and clean
    return Array.from(new Set(tags))
      .filter(tag => tag && tag.length > 0)
      .map(tag => tag.toLowerCase().replace(/[^a-z0-9-_]/g, '_'));
  }

  /**
   * Get access level for document (inherit from report or default to internal)
   */
  private getAccessLevel(_report: DemandReport): 'public' | 'internal' | 'confidential' {
    // Could be extended to read from report metadata if added later
    // For now, default to internal for government projects
    return 'internal';
  }

  /**
   * Check if artifact has already been indexed (idempotency)
   */
  private async checkIdempotency(
    reportId: string,
    artifactType: string,
    versionId: string | null
  ): Promise<boolean> {
    try {
      // Query knowledge documents to see if this artifact is already indexed
      const documents = await this.storage.listKnowledgeDocuments({
        category: artifactType
      });

      // Check if any document has matching metadata
      for (const doc of documents) {
        const autoIndexed = (doc.metadata as Record<string, unknown> | null)?.autoIndexed as Record<string, unknown> | undefined;
        if (!autoIndexed) continue;

        if (autoIndexed.reportId === reportId && autoIndexed.artifactType === artifactType) {
          // For version-specific indexing, check version ID
          if (versionId) {
            if (autoIndexed.versionId === versionId) {
              return true; // Already indexed this specific version
            }
          } else {
            // For non-versioned indexing (legacy or when version is null)
            if (!autoIndexed.versionId) {
              return true; // Already indexed without version
            }
          }
        }
      }

      return false;
    } catch (error) {
      logger.error(`[AutoIndexing] Error checking idempotency:`, error);
      // On error, assume not indexed to be safe
      return false;
    }
  }
}

export function createAutoIndexingService(storage: DemandAutoIndexingStorage): AutoIndexingService {
  return new AutoIndexingService(storage);
}
