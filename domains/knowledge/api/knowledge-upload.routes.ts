import { Router } from "express";
import { z } from "zod";
import type { KnowledgeUploadStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware, type AuthStorageSlice } from "@interfaces/middleware/auth";
import multer from "multer";
import { promises as fs } from "node:fs";
import * as fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { KNOWLEDGE_CLASSIFICATIONS, DOCUMENT_CATEGORIES } from "@shared/schema";
import { buildKnowledgeUploadDeps } from "../application";
import { logger } from "@platform/logging/Logger";
import { enqueueKnowledgeDocumentIngestion } from "@platform/queue/knowledgeDocumentIngestionQueue";
import {
  copyManagedFile,
  createManagedFileHandle,
  createManagedFileHandleFromPath,
  createManagedReadStream,
  createManagedWriteStream,
  type ManagedFileHandle,
  unlinkManagedFile,
} from "@platform/storage/managedFiles";

// ===== Type Definitions =====

interface TagItem {
  tag: string;
  score?: number;
  source?: string;
}

interface AIClassificationResult {
  classificationId?: string;
  categoryId?: string;
  subfolder?: string | null;
  folderPath?: string;
  tags?: TagItem[];
  summary?: string;
  category?: {
    primary?: string;
    confidence?: number;
  };
  language?: {
    detected?: string;
  };
  documentType?: {
    type?: string;
  };
  keyEntities?: Array<{ name: string; type: string; relevance: number }>;
  suggestedFolder?: string;
}

interface ChunkedUploadMetadata {
  category?: string;
  tags?: string;
  accessLevel?: string;
  folderPath?: string;
  visibilityScope?: VisibilityScope;
  sector?: string;
  organization?: string;
  department?: string;
}

type ProcessingMode = 'queued' | 'processed_inline' | 'already_queued';
type VisibilityScope = "global" | "organization" | "department" | "private";
type SupportedDocumentType = 'pdf' | 'docx' | 'doc' | 'txt' | 'md';
type PersistedAccessLevel = 'public' | 'internal' | 'confidential';

function toVisibilityScope(value: unknown): VisibilityScope | undefined {
  return value === 'global' || value === 'organization' || value === 'department' || value === 'private'
    ? value
    : undefined;
}

function toPersistedAccessLevel(value: unknown): PersistedAccessLevel {
  if (value === 'public' || value === 'internal' || value === 'confidential') {
    return value;
  }

  if (value === 'restricted') {
    return 'confidential';
  }

  return 'internal';
}

interface DocumentMetadata {
  pageCount?: number;
  wordCount?: number;
  characterCount?: number;
  totalTokens?: number;
  processingTime?: number;
  failedChunks?: number[];
  qualityBreakdown?: {
    completeness: number;
    citations: number;
    freshness: number;
    usage: number;
    metadata: number;
    total: number;
  };
  categorizationConfidence?: number;
  aiSuggestions?: {
    category: {
      suggested: string;
      confidence: number;
      allScores?: Array<{ category: string; confidence: number }>;
    };
    tags: Array<{
      tag: string;
      score: number;
      source: string;
    }>;
  };
  ocr?: Record<string, unknown>;
  error?: string;
  sheetCount?: number;
  slideCount?: number;
  detectedLanguage?: string;
  fileTypeCategory?: string;
  classification?: {
    category?: unknown;
    tags?: TagItem[];
    language?: unknown;
    documentType?: unknown;
    summary?: string;
    keyEntities?: string[];
    suggestedFolder?: string;
  };
}

type KnowledgeUploadDeps = ReturnType<typeof buildKnowledgeUploadDeps>;

class KnowledgeUploadHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly responseBody: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

function isKnowledgeUploadHttpError(error: unknown): error is KnowledgeUploadHttpError {
  return error instanceof KnowledgeUploadHttpError;
}

function isSupportedDocumentType(value: string): value is SupportedDocumentType {
  return ['pdf', 'docx', 'doc', 'txt', 'md'].includes(value);
}

function getBulkUploadBatchSize(averageFileSize: number): number {
  if (averageFileSize > 10 * 1024 * 1024) {
    return 2;
  }

  if (averageFileSize > 5 * 1024 * 1024) {
    return 3;
  }

  return 5;
}

async function safeUnlinkTempFile(filePath: string | null | undefined, context: string): Promise<void> {
  try {
    await unlinkManagedFile(filePath ? toManagedFileLocation(filePath) : null);
  } catch (error) {
    logger.debug(`[KnowledgeUpload] Failed to clean up temp file during ${context}`, error);
  }
}

/**
 * Decodes a filename that may have been incorrectly encoded.
 * Handles cases where UTF-8 filenames (like Arabic) are decoded as Latin-1.
 * Also handles RFC 5987 encoded filenames (filename*=UTF-8''...)
 */
function decodeFilename(filename: string): string {
  if (!filename) return filename;

  try {
    // Check if it's already valid UTF-8 with non-ASCII characters
    const hasValidNonAscii = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(filename);
    if (hasValidNonAscii) {
      return filename;
    }

    // Try to decode as if it was Latin-1 encoded UTF-8
    const bytes = [];
    for (let i = 0; i < filename.length; i++) {
      bytes.push(filename.codePointAt(i) ?? 0);
    }
    const decoded = Buffer.from(bytes).toString('utf8');

    if (decoded && !decoded.includes('\ufffd')) {
      return decoded;
    }
  } catch (error) {
    logger.debug('[KnowledgeUpload] Failed to decode filename, using original value', error);
  }

  return filename;
}

const uploadKnowledgeDocumentSchema = z.object({
  category: z.string().min(1).optional(),
  tags: z.string().optional(),
  accessLevel: z.enum(["public", "internal", "restricted"]).default("internal"),
  ignoreDuplicateWarning: z.string().optional(),
  folderPath: z.string().optional(),
  visibilityScope: z.enum(["global", "organization", "department", "private"]).optional(),
  sector: z.string().optional(),
  organization: z.string().optional(),
  department: z.string().optional(),
});

function buildVisibilityMetadata(input: {
  visibilityScope?: VisibilityScope;
  sector?: unknown;
  organization?: unknown;
  department?: unknown;
}): {
  scope: VisibilityScope;
  sector?: string;
  organization?: string;
  department?: string;
} {
  const normalizeOptionalString = (value: unknown): string | undefined => {
    if (typeof value !== "string") {
      return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  };

  const scope = input.visibilityScope || "organization";
  const sector = normalizeOptionalString(input.sector);
  const organization = normalizeOptionalString(input.organization);
  const department = normalizeOptionalString(input.department);

  return {
    scope,
    ...(sector ? { sector } : {}),
    ...(organization ? { organization } : {}),
    ...(department ? { department } : {}),
  };
}

async function parseKnowledgeTags(tagsString: string | undefined, tempFilePath: string | undefined): Promise<string[] | null> {
  if (!tagsString) {
    return null;
  }

  try {
    const parsed = JSON.parse(tagsString);
    if (!Array.isArray(parsed)) {
      await safeUnlinkTempFile(tempFilePath, 'knowledge tag validation');
      throw new KnowledgeUploadHttpError(400, 'Tags must be an array');
    }

    if (!parsed.every((tag) => typeof tag === 'string')) {
      await safeUnlinkTempFile(tempFilePath, 'knowledge tag validation');
      throw new KnowledgeUploadHttpError(400, 'Tags must be an array of strings');
    }

    return parsed;
  } catch (error) {
    if (isKnowledgeUploadHttpError(error)) {
      throw error;
    }

    await safeUnlinkTempFile(tempFilePath, 'knowledge tag parsing');
    throw new KnowledgeUploadHttpError(400, 'Invalid JSON format for tags', {
      details: error instanceof Error ? error.message : 'JSON parse failed',
    });
  }
}

async function runKnowledgeAiAnalysis(params: {
  deps: KnowledgeUploadDeps;
  extractedText: string;
  originalFilename: string;
  fileType: string;
  canUseAI: boolean;
}): Promise<{
  categorizationResult: { suggestedCategory: string; confidence: number; allScores?: { category: string; confidence: number }[] };
  taggingResult: { tags: { tag: string; score?: number; source?: string }[] };
  aiClassification: AIClassificationResult | null;
}> {
  const fallbackResults = {
    categorizationResult: { suggestedCategory: 'Uncategorized', confidence: 0, allScores: [] },
    taggingResult: { tags: [] },
    aiClassification: null,
  };

  if (!params.canUseAI) {
    return fallbackResults;
  }

  logger.info('Running AI auto-categorization and auto-tagging...');
  const categorizationResult = params.deps.autoCategorization.categorizeDocument(params.extractedText, params.originalFilename);
  const taggingResult = params.deps.autoTagging.extractTags(params.extractedText, params.originalFilename, 5, 10);

  logger.info(`AI Suggestions - Category: ${categorizationResult.suggestedCategory} (${(categorizationResult.confidence * 100).toFixed(1)}% confidence)`);
  logger.info(`AI Suggestions - Tags: ${taggingResult.tags.map((tag) => tag.tag).join(', ')}`);

  logger.info('Running advanced AI classification for folder and category...');
  try {
    const aiClassification = await params.deps.autoClassification.classifyDocument(
      params.extractedText,
      params.originalFilename,
      params.fileType,
    ) as unknown as AIClassificationResult;
    logger.info(
      `AI Classification - Folder: ${aiClassification?.folderPath || 'none'}, Category: ${aiClassification?.categoryId || 'none'}`,
    );

    return { categorizationResult, taggingResult, aiClassification };
  } catch (classError) {
    logger.warn('Advanced AI classification failed, using basic categorization:', classError);
    return { categorizationResult, taggingResult, aiClassification: null };
  }
}

function resolveKnowledgeClassification(params: {
  aiClassification: AIClassificationResult | null;
  category: string | undefined;
  folderPath: string | undefined;
  parsedTags: string[] | null;
  taggingResult: { tags: { tag: string; score?: number; source?: string }[] };
}): {
  finalCategory: string | undefined;
  finalFolderPath: string | undefined;
  finalTags: string[];
  aiClassificationRejected: boolean;
  categoryRejected: boolean;
  wasAutoClassified: boolean;
} {
  const { validatedFolderPath, aiClassificationRejected } = resolveKnowledgeFolderClassification(params.aiClassification);
  const { validatedCategory, categoryRejected } = resolveKnowledgeCategoryClassification(
    validatedFolderPath,
    params.aiClassification,
  );

  return {
    finalCategory: params.category || validatedCategory || undefined,
    finalFolderPath: params.folderPath || validatedFolderPath || undefined,
    finalTags: params.parsedTags || params.aiClassification?.tags?.map((tag) => tag.tag) || params.taggingResult.tags.map((tag) => tag.tag),
    aiClassificationRejected,
    categoryRejected,
    wasAutoClassified: !params.category && !params.folderPath && (!!validatedCategory || !!validatedFolderPath),
  };
}

function resolveKnowledgeFolderClassification(aiClassification: AIClassificationResult | null): {
  validatedFolderPath: string | undefined;
  aiClassificationRejected: boolean;
} {
  const classificationId = aiClassification?.classificationId;
  if (!classificationId) {
    logger.info('AI did not provide classification. Document will require manual classification.');
    return { validatedFolderPath: undefined, aiClassificationRejected: true };
  }

  if (!Object.keys(KNOWLEDGE_CLASSIFICATIONS).includes(classificationId)) {
    logger.warn(`AI classification rejected - "${classificationId}" not a valid classification ID. Document will require manual classification.`);
    return { validatedFolderPath: undefined, aiClassificationRejected: true };
  }

  const classInfo = KNOWLEDGE_CLASSIFICATIONS[classificationId as keyof typeof KNOWLEDGE_CLASSIFICATIONS];
  if (aiClassification?.subfolder === null) {
    logger.info(`AI classification accepted (root, subfolder null): ${classificationId}`);
    return { validatedFolderPath: classificationId, aiClassificationRejected: false };
  }

  const subfolder = aiClassification?.subfolder;
  if (!subfolder) {
    logger.warn(`AI classification rejected - no subfolder provided for ${classificationId}. Document will require manual classification.`);
    return { validatedFolderPath: undefined, aiClassificationRejected: true };
  }

  const matchingSubfolder = classInfo.subfolders.find(
    (item) => item.label === subfolder || item.slug === subfolder,
  );
  if (!matchingSubfolder) {
    logger.warn(`AI subfolder rejected - "${subfolder}" not found in ${classificationId} taxonomy. Document will require manual classification.`);
    return { validatedFolderPath: undefined, aiClassificationRejected: true };
  }

  const validatedFolderPath = `${classificationId}/${matchingSubfolder.slug}`;
  logger.info(`AI classification accepted: ${validatedFolderPath}`);
  return { validatedFolderPath, aiClassificationRejected: false };
}

function resolveKnowledgeCategoryClassification(
  validatedFolderPath: string | undefined,
  aiClassification: AIClassificationResult | null,
): {
  validatedCategory: string | undefined;
  categoryRejected: boolean;
} {
  const categoryId = aiClassification?.categoryId;
  if (!categoryId) {
    return { validatedCategory: undefined, categoryRejected: false };
  }

  if (!validatedFolderPath) {
    logger.warn(`AI category rejected - cannot accept category "${categoryId}" without valid classification. Document will require manual category assignment.`);
    return { validatedCategory: undefined, categoryRejected: true };
  }

  if (!Object.keys(DOCUMENT_CATEGORIES).includes(categoryId)) {
    logger.warn(`AI category rejected - "${categoryId}" not a valid category ID`);
    return { validatedCategory: undefined, categoryRejected: true };
  }

  const classificationKey = validatedFolderPath.split('/')[0] as keyof typeof KNOWLEDGE_CLASSIFICATIONS;
  const classInfo = KNOWLEDGE_CLASSIFICATIONS[classificationKey];
  if (!classInfo || !(classInfo.allowedCategories as string[]).includes(categoryId)) {
    logger.warn(`AI category rejected - "${categoryId}" not allowed for ${classificationKey} classification. Allowed: ${classInfo?.allowedCategories.join(', ')}`);
    return { validatedCategory: undefined, categoryRejected: true };
  }

  logger.info(`AI category accepted: ${categoryId} (allowed for ${classificationKey})`);
  return { validatedCategory: categoryId, categoryRejected: false };
}

async function getKnowledgeAiPermission(params: {
  deps: KnowledgeUploadDeps;
  userId: string;
  session: Record<string, unknown>;
  ip: string | undefined;
  userAgent: string | undefined;
  originalFilename: string;
  fileType: string;
  fileSize: number;
}): Promise<boolean> {
  const decisionContext = {
    userId: params.userId,
    userRole: params.session.role,
    organizationId: params.session.organizationId as string | undefined,
    ipAddress: params.ip,
    userAgent: params.userAgent,
  };

  const intakeRequest = {
    intent: `AI-classify document: ${params.originalFilename}`,
    decisionType: 'document_analysis',
    financialImpact: 'low',
    urgency: 'low',
    sourceType: 'document_upload',
    sourceContext: { filename: params.originalFilename, fileType: params.fileType, fileSize: params.fileSize },
  };

  logger.info('[Decision Brain] Processing document classification through governance...');
  const orchestratorResponse = await params.deps.decisionOrchestrator.intake(intakeRequest, decisionContext);
  const canUseAI = orchestratorResponse.canProceedToReasoning;
  if (canUseAI) {
    logger.info(`[Decision Brain] AI Classification approved - ${orchestratorResponse.requestNumber}`);
  } else {
    logger.info(`[Decision Brain] AI Classification blocked - ${orchestratorResponse.blockedReason}, using fallback`);
  }
  return canUseAI;
}

async function createKnowledgeDocumentRecord(params: {
  deps: KnowledgeUploadDeps;
  tempFilePath: string;
  originalFilename: string;
  fileType: string;
  fileSize: number;
  userId: string;
  finalCategory: string | undefined;
  finalTags: string[];
  accessLevel: z.infer<typeof uploadKnowledgeDocumentSchema>['accessLevel'];
  finalFolderPath: string | undefined;
  visibility: ReturnType<typeof buildVisibilityMetadata>;
}): Promise<{ document: Awaited<ReturnType<KnowledgeUploadDeps['documentRepo']['create']>>; persistentPath: string; documentType: SupportedDocumentType; }> {
  const mappedAccessLevel: PersistedAccessLevel = params.accessLevel === 'restricted' ? 'confidential' : params.accessLevel;
  const documentType: SupportedDocumentType = isSupportedDocumentType(params.fileType) ? params.fileType : 'txt';
  const document = await params.deps.documentRepo.create({
    filename: params.originalFilename,
    fileType: documentType,
    fileSize: params.fileSize,
    fileUrl: null,
    processingStatus: 'processing',
    uploadedBy: params.userId,
    category: params.finalCategory,
    tags: params.finalTags,
    accessLevel: mappedAccessLevel,
    folderPath: params.finalFolderPath,
    metadata: { visibility: params.visibility },
  });

  logger.info(`Created document record: ${document.id}`);
  const persistentDir = path.join(process.cwd(), 'uploads', 'knowledge-documents');
  await fs.mkdir(persistentDir, { recursive: true });
  const persistentPath = path.join(persistentDir, `${document.id}${path.extname(params.originalFilename)}`);
  await copyManagedFile(toManagedFileLocation(params.tempFilePath), toManagedFileLocation(persistentPath));
  await params.deps.documentRepo.update(document.id, { fileUrl: persistentPath });
  logger.info(`Saved file to: ${persistentPath}`);

  return { document, persistentPath, documentType };
}

function buildKnowledgeUploadSuccessResponse(params: {
  documentId: string;
  originalFilename: string;
  fileSize: number;
  fileType: string;
  processingMode: ProcessingMode;
  pageCount: number | undefined;
  wordCount: number | undefined;
  characterCount: number | undefined;
  ocrMetadata: Record<string, unknown> | undefined;
  finalFolderPath: string | undefined;
  finalCategory: string | undefined;
  wasAutoClassified: boolean;
  aiClassificationRejected: boolean;
  categoryRejected: boolean;
  aiClassification: AIClassificationResult | null;
  categorizationResult: { suggestedCategory: string; confidence: number; allScores?: { category: string; confidence: number }[] };
  taggingResult: { tags: { tag: string; score?: number; source?: string }[] };
}) {
  return {
    success: true,
    data: {
      documentId: params.documentId,
      filename: params.originalFilename,
      fileSize: params.fileSize,
      fileType: params.fileType,
      processingStatus: params.processingMode === 'processed_inline' ? 'completed' : 'processing',
      queued: params.processingMode === 'queued',
      inlineProcessed: params.processingMode === 'processed_inline',
      metadata: {
        pageCount: params.pageCount,
        wordCount: params.wordCount,
        characterCount: params.characterCount,
      },
      ocrMetadata: params.ocrMetadata,
      aiClassification: {
        folderPath: params.finalFolderPath,
        category: params.finalCategory,
        wasAutoClassified: params.wasAutoClassified,
        wasRejected: params.aiClassificationRejected || params.categoryRejected,
        requiresManualFolderAssignment: !params.finalFolderPath,
        requiresManualCategoryAssignment: !params.finalCategory,
        summary: params.aiClassification?.summary,
        confidence: params.aiClassification?.category?.confidence,
      },
      aiSuggestions: {
        category: {
          suggested: params.categorizationResult.suggestedCategory,
          confidence: params.categorizationResult.confidence,
          alternatives: (params.categorizationResult.allScores || []).slice(0, 3).map((score) => ({
            category: score.category,
            confidence: score.confidence,
          })),
        },
        tags: params.taggingResult.tags.map((tag) => ({
          tag: tag.tag,
          score: tag.score ?? 0,
          source: tag.source ?? 'unknown',
        })),
      },
    },
  };
}

type SingleKnowledgeUploadRequest = {
  session: Record<string, unknown> & { userId?: string };
  file?: Express.Multer.File;
  body: unknown;
  correlationId?: string;
  ip?: string;
  get(name: string): string | undefined;
};

async function enforceKnowledgeUploadFileSecurity(params: {
  deps: KnowledgeUploadDeps;
  file: Express.Multer.File;
  correlationId: string | undefined;
  userId: string;
}): Promise<void> {
  try {
    await params.deps.fileSecurity.enforceFileSecurity({
      allowedExtensions: knowledgeAllowedExtensions,
      path: params.file.path,
      originalName: params.file.originalname,
      declaredMimeType: params.file.mimetype,
      correlationId: params.correlationId,
      userId: params.userId,
    });
  } catch (securityError) {
    const message = securityError instanceof Error ? securityError.message : 'Upload failed security checks';
    params.deps.fileSecurity.logUploadSecurityRejection({
      allowedExtensions: knowledgeAllowedExtensions,
      path: params.file.path,
      originalName: params.file.originalname,
      declaredMimeType: params.file.mimetype,
      correlationId: params.correlationId,
      userId: params.userId,
    }, message);
    await params.deps.fileSecurity.safeUnlink(params.file.path);
    throw new KnowledgeUploadHttpError(400, message);
  }
}

async function processSingleKnowledgeUpload(params: {
  deps: KnowledgeUploadDeps;
  req: SingleKnowledgeUploadRequest;
}): Promise<ReturnType<typeof buildKnowledgeUploadSuccessResponse>> {
  const userId = String(params.req.session.userId);
  const file = params.req.file;
  if (!file) {
    throw new KnowledgeUploadHttpError(400, 'No file uploaded');
  }

  await enforceKnowledgeUploadFileSecurity({
    deps: params.deps,
    file,
    correlationId: params.req.correlationId,
    userId,
  });

  const tempFilePath = file.path;
  const originalFilename = decodeFilename(file.originalname);
  const fileSize = file.size;
  const fileType = path.extname(originalFilename).toLowerCase().replace('.', '');
  const validation = uploadKnowledgeDocumentSchema.safeParse(params.req.body);
  if (!validation.success) {
    await safeUnlinkTempFile(tempFilePath, 'upload metadata validation');
    throw new KnowledgeUploadHttpError(400, 'Invalid upload metadata', {
      details: validation.error.errors,
    });
  }

  const {
    category,
    tags: tagsString,
    accessLevel,
    ignoreDuplicateWarning,
    folderPath,
    visibilityScope,
    sector,
    organization,
    department,
  } = validation.data;
  const visibility = buildVisibilityMetadata({ visibilityScope, sector, organization, department });
  const parsedTags = await parseKnowledgeTags(tagsString, tempFilePath);

  logger.info(`Processing document: ${originalFilename} (${fileSize} bytes, type: ${fileType})`);
  logger.info('Extracting text from document...');
  const { extractedText, pageCount, wordCount, characterCount, ocrMetadata } =
    await params.deps.documentProcessor.extractText(tempFilePath, fileType);
  if (ocrMetadata?.wasProcessed) {
    const ocrDetails: { language?: unknown; confidence?: unknown } = ocrMetadata;
    const rawLanguage = ocrDetails.language;
    const ocrLanguage = typeof rawLanguage === 'string' ? rawLanguage : 'unknown';
    const ocrConfidence = typeof ocrDetails.confidence === 'number' ? ocrDetails.confidence : undefined;
    logger.info(`OCR processed: ${ocrLanguage} (${ocrConfidence?.toFixed(2)}% confidence)`);
  }
  const pageSummary = pageCount ? `, ${pageCount} pages` : '';
  logger.info(`Text extracted: ${characterCount} chars, ${wordCount} words${pageSummary}`);

  const canUseAI = await getKnowledgeAiPermission({
    deps: params.deps,
    userId,
    session: params.req.session,
    ip: params.req.ip,
    userAgent: params.req.get('User-Agent') ?? undefined,
    originalFilename,
    fileType,
    fileSize,
  });
  const { categorizationResult, taggingResult, aiClassification } = await runKnowledgeAiAnalysis({
    deps: params.deps,
    extractedText,
    originalFilename,
    fileType,
    canUseAI,
  });
  const {
    finalCategory,
    finalFolderPath,
    finalTags,
    aiClassificationRejected,
    categoryRejected,
    wasAutoClassified,
  } = resolveKnowledgeClassification({
    aiClassification,
    category,
    folderPath,
    parsedTags,
    taggingResult,
  });

  logger.info(`Final values - Folder: ${finalFolderPath || 'none'}, Category: ${finalCategory || 'none'}`);
  if (ignoreDuplicateWarning === 'true') {
    logger.info('User chose to proceed despite duplicate warning');
  } else {
    await ensureNoKnowledgeDuplicates({ deps: params.deps, extractedText, tempFilePath });
  }

  const { document } = await createKnowledgeDocumentRecord({
    deps: params.deps,
    tempFilePath,
    originalFilename,
    fileType,
    fileSize,
    userId,
    finalCategory,
    finalTags,
    accessLevel,
    finalFolderPath,
    visibility,
  });

  try {
    const contentHash = params.deps.duplicateDetection.calculateContentHash(extractedText);
    const processingMode = await queueKnowledgeDocumentPostProcessing({
      deps: params.deps,
      documentId: document.id,
      fullText: extractedText,
      contentHash,
      metadata: {
        pageCount,
        wordCount,
        characterCount,
        categorizationConfidence: categorizationResult.confidence,
        aiSuggestions: {
          category: {
            suggested: categorizationResult.suggestedCategory,
            confidence: categorizationResult.confidence,
            allScores: (categorizationResult.allScores || []).slice(0, 3),
          },
          tags: taggingResult.tags.map((tag) => ({
            tag: tag.tag,
            score: tag.score ?? 0,
            source: tag.source ?? 'unknown',
          })),
        },
        ocr: ocrMetadata,
        visibility,
      },
    });

    logger.info(`Document queued for background processing: ${document.id} (${processingMode})`);
    await safeUnlinkTempFile(tempFilePath, 'single upload completion');
    return buildKnowledgeUploadSuccessResponse({
      documentId: document.id,
      originalFilename,
      fileSize,
      fileType,
      processingMode,
      pageCount,
      wordCount,
      characterCount,
      ocrMetadata,
      finalFolderPath,
      finalCategory,
      wasAutoClassified,
      aiClassificationRejected,
      categoryRejected,
      aiClassification,
      categorizationResult,
      taggingResult,
    });
  } catch (processingError) {
    logger.error('Error processing document:', processingError);
    await params.deps.documentRepo.update(document.id, {
      processingStatus: 'failed',
      metadata: {
        error: processingError instanceof Error ? processingError.message : 'Unknown error',
      },
    });
    throw processingError;
  }
}

async function ensureNoKnowledgeDuplicates(params: {
  deps: KnowledgeUploadDeps;
  extractedText: string;
  tempFilePath: string | undefined;
}): Promise<void> {
  logger.info('Checking for duplicate documents...');

  const contentHash = params.deps.duplicateDetection.calculateContentHash(params.extractedText);
  const exactDuplicateCheck = await params.deps.duplicateDetection.checkExactDuplicate(contentHash);

  if (exactDuplicateCheck.isDuplicate) {
    logger.info('Exact duplicate found:', exactDuplicateCheck.existingDocument?.filename);
    await safeUnlinkTempFile(params.tempFilePath, 'exact duplicate rejection');
    throw new KnowledgeUploadHttpError(409, 'This document already exists in the knowledge base', {
      isDuplicate: true,
      duplicateType: 'exact',
      message: 'This document already exists in the knowledge base',
      existingDocument: exactDuplicateCheck.existingDocument,
    });
  }

  logger.info('Generating embedding for duplicate detection...');
  const chunks = await params.deps.chunkingService.chunkText(params.extractedText);
  if (!chunks.length) {
    logger.info('No duplicates found, proceeding with upload');
    return;
  }

  try {
    const firstChunk = chunks[0];
    if (!firstChunk) {
      logger.info('No first chunk available, skipping near-duplicate embedding check');
      return;
    }
    const embeddingResult = await params.deps.embeddingsService.generateEmbedding(firstChunk.content);
    if (embeddingResult?.embedding) {
      const nearDuplicateCheck = await params.deps.duplicateDetection.checkNearDuplicate(
        params.extractedText,
        embeddingResult.embedding,
        0.9,
      );

      if (nearDuplicateCheck.isDuplicate) {
        logger.info(
          'Near-duplicate found:',
          nearDuplicateCheck.existingDocument?.filename,
          `(${(nearDuplicateCheck.existingDocument?.similarity || 0) * 100}% similar)`,
        );
        await safeUnlinkTempFile(params.tempFilePath, 'near duplicate rejection');
        throw new KnowledgeUploadHttpError(409, `A similar document already exists (${Math.round((nearDuplicateCheck.existingDocument?.similarity || 0) * 100)}% match)`, {
          isDuplicate: true,
          duplicateType: 'near-duplicate',
          message: `A similar document already exists (${Math.round((nearDuplicateCheck.existingDocument?.similarity || 0) * 100)}% match)`,
          existingDocument: nearDuplicateCheck.existingDocument,
        });
      }
    }
  } catch (embeddingError) {
    if (isKnowledgeUploadHttpError(embeddingError)) {
      throw embeddingError;
    }
    logger.warn('Near-duplicate detection skipped because embeddings are unavailable:', embeddingError);
  }

  logger.info('No duplicates found, proceeding with upload');
}

const knowledgeAllowedExtensions = [
  '.pdf', '.docx', '.doc', '.txt', '.md', '.rtf',
  '.xlsx', '.csv',
  '.pptx', '.ppt',
  '.json', '.xml', '.html',
  '.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif', '.webp',
];

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const tmpDir = path.join(os.tmpdir(), 'knowledge-uploads');
      void fs.mkdir(tmpDir, { recursive: true })
        .then(() => cb(null, tmpDir))
        .catch((error) => cb(error as Error, tmpDir));
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 200 * 1024 * 1024,
    files: 100,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (knowledgeAllowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${knowledgeAllowedExtensions.join(', ')}`));
    }
  }
});

const CHUNK_UPLOAD_DIR = path.join(os.tmpdir(), 'eiaph-chunk-uploads');
const MAX_CONCURRENT_UPLOADS_PER_USER = 3;
const UPLOAD_TIMEOUT_MS = 30 * 60 * 1000;

const MANAGED_FILE_ROOTS = [
  path.resolve(os.tmpdir()),
  path.resolve(process.cwd(), 'uploads'),
];

function toManagedFileLocation(filePath: string): ManagedFileHandle {
  return createManagedFileHandleFromPath(filePath, MANAGED_FILE_ROOTS);
}

function toManagedFileInDirectory(rootDir: string, fileName: string): ManagedFileHandle {
  return createManagedFileHandle(rootDir, fileName, MANAGED_FILE_ROOTS);
}

async function queueKnowledgeDocumentPostProcessing(params: {
  deps: ReturnType<typeof buildKnowledgeUploadDeps>;
  documentId: string;
  fullText: string;
  contentHash: string;
  metadata: Record<string, unknown>;
}): Promise<ProcessingMode> {
  await params.deps.documentRepo.update(params.documentId, {
    fullText: params.fullText,
    contentHash: params.contentHash,
    processingStatus: 'processing',
    chunkCount: 0,
    metadata: params.metadata,
  });

  return enqueueKnowledgeDocumentIngestion(params.documentId);
}

if (!fsSync.existsSync(CHUNK_UPLOAD_DIR)) {
  fsSync.mkdirSync(CHUNK_UPLOAD_DIR, { recursive: true });
}

interface ChunkedUploadSession {
  userId: string;
  filename: string;
  fileSize: number;
  fileType: string;
  totalChunks: number;
  receivedChunks: Set<number>;
  chunkDir: string;
  createdAt: Date;
  metadata?: ChunkedUploadMetadata;
}

interface BulkUploadResult {
  filename: string;
  status: 'success' | 'error' | 'duplicate' | 'timeout';
  documentId?: string;
  fileType?: string;
  fileSize?: number;
  folderPath?: string | null;
  processingStatus?: 'completed' | 'processing';
  classification?: {
    category?: string;
    tags?: string[];
    language?: string;
    documentType?: string;
    summary?: string;
  } | null;
  error?: string;
  processingTime?: number;
}

type BulkUploadRequest = {
  session: { userId?: string };
  files?: Express.Multer.File[] | Express.Multer.File;
  body: Record<string, unknown>;
  correlationId?: string;
};

type ChunkedUploadCompleteRequest = {
  session: { userId?: string };
  params: { uploadId?: string };
  correlationId?: string;
};

function getBulkUploadFiles(files: BulkUploadRequest['files']): Express.Multer.File[] {
  if (!Array.isArray(files) || files.length === 0) {
    throw new KnowledgeUploadHttpError(400, 'No files uploaded');
  }

  return files;
}

async function cleanupBulkTempFiles(tempFilePaths: string[], context: string): Promise<void> {
  for (const tempPath of tempFilePaths) {
    await safeUnlinkTempFile(tempPath, context);
  }
}

async function validateBulkUploadFiles(files: Express.Multer.File[]): Promise<number> {
  const maxTotalSize = 200 * 1024 * 1024;
  const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
  if (totalSize > maxTotalSize) {
    await cleanupBulkTempFiles(files.map((file) => file.path), 'bulk upload size validation');
    throw new KnowledgeUploadHttpError(
      413,
      `Total upload size (${(totalSize / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed (200MB)`,
      { maxSize: maxTotalSize },
    );
  }

  const invalidFiles = files.filter((file) => !file.originalname || !file.path);
  if (invalidFiles.length > 0) {
    await cleanupBulkTempFiles(files.map((file) => file.path), 'bulk upload metadata validation');
    throw new KnowledgeUploadHttpError(400, `${invalidFiles.length} file(s) have invalid metadata`);
  }

  return totalSize;
}

function parseBulkUploadFolderPaths(folderPathsJson: unknown): Record<string, string> {
  if (typeof folderPathsJson !== 'string' || folderPathsJson.length === 0) {
    return {};
  }

  try {
    const folderPaths = JSON.parse(folderPathsJson) as Record<string, string>;
    const maxPathDepth = 10;
    const maxPathLength = 500;

    for (const [filename, folderPath] of Object.entries(folderPaths)) {
      if (typeof folderPath !== 'string') {
        continue;
      }

      if (folderPath.length > maxPathLength) {
        throw new KnowledgeUploadHttpError(400, `Folder path too long for "${filename}" (max ${maxPathLength} chars)`);
      }

      if (folderPath.includes('..') || folderPath.includes('//') || folderPath.startsWith('/')) {
        throw new KnowledgeUploadHttpError(400, `Invalid folder path for "${filename}": Path traversal not allowed`);
      }

      const pathDepth = folderPath.split('/').filter(Boolean).length;
      if (pathDepth > maxPathDepth) {
        throw new KnowledgeUploadHttpError(400, `Folder path too deep for "${filename}" (max ${maxPathDepth} levels)`);
      }
    }

    logger.info(`[Bulk Upload] Processing with ${Object.keys(folderPaths).length} folder paths`);
    return folderPaths;
  } catch (error) {
    if (isKnowledgeUploadHttpError(error)) {
      throw error;
    }

    logger.warn('[Bulk Upload] Failed to parse folderPaths:', error);
    return {};
  }
}

function getBulkUploadOptions(body: Record<string, unknown>) {
  const autoClassify = typeof body.autoClassify === 'string' ? body.autoClassify : 'true';
  const defaultCategory = typeof body.defaultCategory === 'string' ? body.defaultCategory : undefined;
  const defaultAccessLevel = typeof body.defaultAccessLevel === 'string' ? body.defaultAccessLevel : 'internal';
  const visibilityScope = toVisibilityScope(body.visibilityScope);
  const sector = typeof body.sector === 'string' ? body.sector : undefined;
  const organization = typeof body.organization === 'string' ? body.organization : undefined;
  const department = typeof body.department === 'string' ? body.department : undefined;

  return {
    shouldAutoClassify: autoClassify === 'true',
    defaultCategory,
    defaultAccessLevel,
    folderPaths: parseBulkUploadFolderPaths(body.folderPaths),
    visibility: buildVisibilityMetadata({ visibilityScope, sector, organization, department }),
  };
}

async function classifyBulkUploadDocument(params: {
  deps: KnowledgeUploadDeps;
  extractedText: string;
  originalFilename: string;
  fileType: string;
  shouldAutoClassify: boolean;
}): Promise<AIClassificationResult | null> {
  if (!params.shouldAutoClassify) {
    return null;
  }

  try {
    return await params.deps.autoClassification.classifyDocument(
      params.extractedText,
      params.originalFilename,
      params.fileType,
    ) as unknown as AIClassificationResult;
  } catch (classifyError) {
    logger.warn(`[Bulk Upload] Classification failed for ${params.originalFilename}:`, classifyError);
    return null;
  }
}

async function processBulkUploadFile(params: {
  deps: KnowledgeUploadDeps;
  file: Express.Multer.File;
  userId: string;
  correlationId: string | undefined;
  shouldAutoClassify: boolean;
  defaultCategory: string | undefined;
  defaultAccessLevel: string;
  folderPaths: Record<string, string>;
  visibility: ReturnType<typeof buildVisibilityMetadata>;
  tempFilePaths: string[];
}): Promise<BulkUploadResult> {
  const startTime = Date.now();
  params.tempFilePaths.push(params.file.path);

  try {
    const originalFilename = decodeFilename(params.file.originalname);
    const fileSize = params.file.size;
    const fileType = path.extname(originalFilename).toLowerCase().replace('.', '');

    logger.info(`[Bulk Upload] Processing: ${originalFilename} (${fileType})`);

    await enforceKnowledgeUploadFileSecurity({
      deps: params.deps,
      file: params.file,
      correlationId: params.correlationId,
      userId: params.userId,
    });

    const metadata = await params.deps.documentProcessor.extractText(params.file.path, fileType);
    const {
      extractedText,
      pageCount,
      wordCount,
      characterCount,
      ocrMetadata,
      detectedLanguage,
      fileTypeCategory,
      sheetCount,
      slideCount,
    } = metadata;

    const classification = await classifyBulkUploadDocument({
      deps: params.deps,
      extractedText,
      originalFilename,
      fileType,
      shouldAutoClassify: params.shouldAutoClassify,
    });

    const contentHash = params.deps.duplicateDetection.calculateContentHash(extractedText);
    const exactDuplicateCheck = await params.deps.duplicateDetection.checkExactDuplicate(contentHash);
    if (exactDuplicateCheck.isDuplicate) {
      return {
        filename: originalFilename,
        status: 'duplicate',
        error: 'Exact duplicate exists',
        processingTime: Date.now() - startTime,
      };
    }

    const finalCategory = classification?.categoryId || classification?.category?.primary || params.defaultCategory || 'General Administration';
    const finalTags = classification?.tags?.slice(0, 5).map((tag: TagItem) => tag.tag) || [];
    const mappedAccessLevel = params.defaultAccessLevel === 'restricted' ? 'confidential' : params.defaultAccessLevel;
    const fileFolderPath = classification?.folderPath || params.folderPaths[originalFilename] || undefined;

    logger.info(`[Bulk Upload] Using AI folder path for ${originalFilename}: ${fileFolderPath || 'none'}`);

    const document = await params.deps.documentRepo.create({
      filename: originalFilename,
      fileType: fileType as 'pdf' | 'docx' | 'doc' | 'txt' | 'md',
      fileSize,
      fileUrl: null,
      processingStatus: 'processing',
      uploadedBy: params.userId,
      category: finalCategory,
      tags: finalTags,
      accessLevel: mappedAccessLevel as 'public' | 'internal' | 'confidential',
      folderPath: fileFolderPath,
      metadata: {
        visibility: params.visibility,
      },
    });

    const persistentDir = path.join(process.cwd(), 'uploads', 'knowledge-documents');
    await fs.mkdir(persistentDir, { recursive: true });
    const persistentPath = path.join(persistentDir, `${document.id}${path.extname(originalFilename)}`);
    await copyManagedFile(toManagedFileLocation(params.file.path), toManagedFileLocation(persistentPath));
    await params.deps.documentRepo.update(document.id, { fileUrl: persistentPath });

    const processingMode = await queueKnowledgeDocumentPostProcessing({
      deps: params.deps,
      documentId: document.id,
      fullText: extractedText,
      contentHash,
      metadata: {
        pageCount,
        wordCount,
        characterCount,
        sheetCount,
        slideCount,
        detectedLanguage,
        fileTypeCategory,
        classification: classification ? {
          category: classification.category,
          tags: classification.tags,
          language: classification.language,
          documentType: classification.documentType,
          summary: classification.summary,
          keyEntities: classification.keyEntities,
          suggestedFolder: classification.suggestedFolder,
        } : undefined,
        ocr: ocrMetadata,
        visibility: params.visibility,
      },
    });

    return {
      filename: originalFilename,
      status: 'success',
      documentId: document.id,
      fileType,
      fileSize,
      folderPath: fileFolderPath,
      processingStatus: processingMode === 'processed_inline' ? 'completed' : 'processing',
      classification: classification ? {
        category: classification.category?.primary,
        tags: classification.tags?.slice(0, 5).map((tag: TagItem) => tag.tag),
        language: classification.language?.detected,
        documentType: classification.documentType?.type,
        summary: classification.summary?.substring(0, 200),
      } : null,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    const decodedName = decodeFilename(params.file.originalname);
    logger.error(`[Bulk Upload] Error processing ${decodedName}:`, error);
    return {
      filename: decodedName,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime,
    };
  }
}

async function processBulkUploadBatch(params: {
  deps: KnowledgeUploadDeps;
  batch: Express.Multer.File[];
  userId: string;
  correlationId: string | undefined;
  shouldAutoClassify: boolean;
  defaultCategory: string | undefined;
  defaultAccessLevel: string;
  folderPaths: Record<string, string>;
  visibility: ReturnType<typeof buildVisibilityMetadata>;
  tempFilePaths: string[];
}): Promise<BulkUploadResult[]> {
  const batchPromises = params.batch.map((file) => processBulkUploadFile({
    deps: params.deps,
    file,
    userId: params.userId,
    correlationId: params.correlationId,
    shouldAutoClassify: params.shouldAutoClassify,
    defaultCategory: params.defaultCategory,
    defaultAccessLevel: params.defaultAccessLevel,
    folderPaths: params.folderPaths,
    visibility: params.visibility,
    tempFilePaths: params.tempFilePaths,
  }));

  const batchResults = await Promise.all(batchPromises);
  const batchTempPaths = params.batch.map((file) => file.path);
  await cleanupBulkTempFiles(batchTempPaths, 'bulk upload batch cleanup');

  for (const tempPath of batchTempPaths) {
    const index = params.tempFilePaths.indexOf(tempPath);
    if (index > -1) {
      params.tempFilePaths.splice(index, 1);
    }
  }

  return batchResults;
}

async function cleanupBulkUploadGarbage(totalSize: number): Promise<void> {
  if (totalSize <= 50 * 1024 * 1024 || !globalThis.gc) {
    return;
  }

  try {
    globalThis.gc();
  } catch (error) {
    logger.debug('[Bulk Upload] Garbage collection hook failed', error);
  }
}

function summarizeBulkUploadResults(fileCount: number, results: BulkUploadResult[]) {
  const successCount = results.filter((result) => result.status === 'success').length;
  const duplicateCount = results.filter((result) => result.status === 'duplicate').length;
  const errorCount = results.filter((result) => result.status === 'error').length;

  logger.info(`[Bulk Upload] Complete: ${successCount} success, ${duplicateCount} duplicates, ${errorCount} errors`);

  return {
    success: true,
    data: {
      totalFiles: fileCount,
      successCount,
      duplicateCount,
      errorCount,
      results,
    },
  };
}

async function processBulkKnowledgeUpload(params: {
  deps: KnowledgeUploadDeps;
  req: BulkUploadRequest;
}): Promise<ReturnType<typeof summarizeBulkUploadResults>> {
  const userId = String(params.req.session.userId);
  const files = getBulkUploadFiles(params.req.files);
  const totalSize = await validateBulkUploadFiles(files);
  logger.info(`[Bulk Upload] Processing ${files.length} files (${(totalSize / 1024 / 1024).toFixed(1)}MB total)`);

  const options = getBulkUploadOptions(params.req.body);
  const tempFilePaths: string[] = [];
  const results: BulkUploadResult[] = [];
  const avgFileSize = totalSize / files.length;
  const batchSize = getBulkUploadBatchSize(avgFileSize);

  logger.info(`[Bulk Upload] Using batch size ${batchSize} (avg file: ${(avgFileSize / 1024 / 1024).toFixed(1)}MB)`);

  try {
    for (let index = 0; index < files.length; index += batchSize) {
      const batch = files.slice(index, index + batchSize);
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      if (heapUsedMB > 1500) {
        logger.warn(`[Bulk Upload] High memory usage detected: ${heapUsedMB.toFixed(0)}MB / ${heapTotalMB.toFixed(0)}MB`);
      }

      results.push(...await processBulkUploadBatch({
        deps: params.deps,
        batch,
        userId,
        correlationId: params.req.correlationId,
        shouldAutoClassify: options.shouldAutoClassify,
        defaultCategory: options.defaultCategory,
        defaultAccessLevel: options.defaultAccessLevel,
        folderPaths: options.folderPaths,
        visibility: options.visibility,
        tempFilePaths,
      }));

      await cleanupBulkUploadGarbage(totalSize);
    }

    await cleanupBulkTempFiles(tempFilePaths, 'bulk upload final cleanup');
    return summarizeBulkUploadResults(files.length, results);
  } catch (error) {
    await cleanupBulkTempFiles(tempFilePaths, 'bulk upload error cleanup');
    throw error;
  }
}

function getChunkedUploadId(params: ChunkedUploadCompleteRequest['params']): string {
  return typeof params.uploadId === 'string' ? params.uploadId : '';
}

function getValidatedChunkedUpload(params: { uploadId: string; userId: string }): ChunkedUploadSession {
  const uploadData = chunkedUploads.get(params.uploadId);
  if (!uploadData) {
    throw new KnowledgeUploadHttpError(404, 'Upload session not found or expired');
  }

  if (uploadData.userId !== params.userId) {
    throw new KnowledgeUploadHttpError(403, 'Unauthorized access to upload session');
  }

  if (uploadData.receivedChunks.size !== uploadData.totalChunks) {
    throw new KnowledgeUploadHttpError(400, `Missing chunks: received ${uploadData.receivedChunks.size}/${uploadData.totalChunks}`, {
      missingChunks: Array.from({ length: uploadData.totalChunks }, (_, index) => index)
        .filter((index) => !uploadData.receivedChunks.has(index)),
    });
  }

  return uploadData;
}

async function assembleChunkedUploadFile(uploadId: string, uploadData: ChunkedUploadSession): Promise<string> {
  logger.info(`[Chunked Upload] ${uploadId}: Assembling ${uploadData.totalChunks} chunks from disk using streaming...`);
  const tempFilePath = path.join(os.tmpdir(), `upload-${uploadId}-${uploadData.filename}`);
  const writeStream = createManagedWriteStream(toManagedFileLocation(tempFilePath));

  const pipeChunk = (chunkPath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const readStream = createManagedReadStream(toManagedFileInDirectory(uploadData.chunkDir, path.basename(chunkPath)));
      readStream.on('error', reject);
      readStream.on('end', resolve);
      readStream.pipe(writeStream, { end: false });
    });
  };

  for (let index = 0; index < uploadData.totalChunks; index++) {
    const chunkPath = path.join(uploadData.chunkDir, `chunk_${index.toString().padStart(5, '0')}`);
    if (!fsSync.existsSync(chunkPath)) {
      writeStream.destroy();
      throw new Error(`Missing chunk file ${index}`);
    }
    await pipeChunk(chunkPath);
  }

  await new Promise<void>((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    writeStream.end();
  });

  const stats = await fs.stat(tempFilePath);
  logger.info(`[Chunked Upload] ${uploadId}: File assembled (${stats.size} bytes), processing...`);
  return tempFilePath;
}

async function enforceChunkedUploadSecurity(params: {
  deps: KnowledgeUploadDeps;
  tempFilePath: string;
  fileName: string;
  correlationId: string | undefined;
  userId: string;
}): Promise<void> {
  try {
    await params.deps.fileSecurity.enforceFileSecurity({
      allowedExtensions: knowledgeAllowedExtensions,
      path: params.tempFilePath,
      originalName: params.fileName,
      declaredMimeType: undefined,
      correlationId: params.correlationId,
      userId: params.userId,
    });
  } catch (securityError) {
    const message = securityError instanceof Error ? securityError.message : 'Upload failed security checks';
    params.deps.fileSecurity.logUploadSecurityRejection({
      allowedExtensions: knowledgeAllowedExtensions,
      path: params.tempFilePath,
      originalName: params.fileName,
      declaredMimeType: undefined,
      correlationId: params.correlationId,
      userId: params.userId,
    }, message);
    await params.deps.fileSecurity.safeUnlink(params.tempFilePath);
    throw new KnowledgeUploadHttpError(400, message);
  }
}

function parseChunkedUploadTags(tagsString: string | undefined): string[] | null {
  if (!tagsString) {
    return null;
  }

  try {
    return JSON.parse(tagsString) as string[];
  } catch (error) {
    logger.debug('[Chunked Upload] Failed to parse tag payload, using fallback tagging', error);
    return null;
  }
}

async function classifyChunkedUploadDocument(params: {
  deps: KnowledgeUploadDeps;
  extractedText: string;
  filename: string;
  fileType: string;
}): Promise<AIClassificationResult | null> {
  try {
    return await params.deps.autoClassification.classifyDocument(
      params.extractedText,
      params.filename,
      params.fileType,
    ) as unknown as AIClassificationResult;
  } catch (error) {
    logger.warn('[Chunked Upload] AI classification failed:', error);
    return null;
  }
}

async function cleanupChunkedUploadSession(uploadId: string): Promise<void> {
  const uploadData = chunkedUploads.get(uploadId);
  if (!uploadData) {
    return;
  }

  try {
    if (fsSync.existsSync(uploadData.chunkDir)) {
      fsSync.rmSync(uploadData.chunkDir, { recursive: true, force: true });
    }
  } catch (error) {
    logger.error('[Chunked Upload] Failed to cleanup chunk dir:', error);
  }

  const userCount = userUploadCounts.get(uploadData.userId) || 0;
  if (userCount > 0) {
    userUploadCounts.set(uploadData.userId, userCount - 1);
  }

  chunkedUploads.delete(uploadId);
}

async function processChunkedUploadCompletion(params: {
  deps: KnowledgeUploadDeps;
  req: ChunkedUploadCompleteRequest;
}): Promise<{ success: true; data: { documentId: string; filename: string; fileSize: number; processingStatus: 'completed' | 'processing'; queued: boolean; }; }> {
  const userId = String(params.req.session.userId);
  const uploadId = getChunkedUploadId(params.req.params);
  const uploadData = getValidatedChunkedUpload({ uploadId, userId });
  let tempFilePath: string | undefined;

  try {
    tempFilePath = await assembleChunkedUploadFile(uploadId, uploadData);
    await enforceChunkedUploadSecurity({
      deps: params.deps,
      tempFilePath,
      fileName: uploadData.filename,
      correlationId: params.req.correlationId,
      userId,
    });

    const {
      category,
      tags: tagsString,
      accessLevel,
      folderPath,
      visibilityScope,
      sector,
      organization,
      department,
    } = uploadData.metadata || {};
    const visibility = buildVisibilityMetadata({ visibilityScope, sector, organization, department });
    const parsedTags = parseChunkedUploadTags(tagsString);

    const { extractedText, pageCount, wordCount, characterCount, ocrMetadata } =
      await params.deps.documentProcessor.extractText(tempFilePath, uploadData.fileType);
    logger.info(`[Chunked Upload] Text extracted: ${characterCount} chars, ${wordCount} words`);

    const categorizationResult = params.deps.autoCategorization.categorizeDocument(extractedText, uploadData.filename);
    const taggingResult = params.deps.autoTagging.extractTags(extractedText, uploadData.filename, 5, 10);
    const aiClassification = await classifyChunkedUploadDocument({
      deps: params.deps,
      extractedText,
      filename: uploadData.filename,
      fileType: uploadData.fileType,
    });

    const finalCategory = category || aiClassification?.categoryId;
    const finalFolderPath = folderPath || aiClassification?.folderPath;
    const fileTypeValue = isSupportedDocumentType(uploadData.fileType) ? uploadData.fileType : 'txt';
    const accessLevelValue = toPersistedAccessLevel(accessLevel);

    const document = await params.deps.documentRepo.create({
      filename: uploadData.filename,
      fileType: fileTypeValue,
      fileSize: uploadData.fileSize,
      uploadedBy: userId,
      category: finalCategory,
      tags: parsedTags || taggingResult.tags.slice(0, 5).map((tag) => tag.tag),
      fullText: extractedText,
      accessLevel: accessLevelValue,
      processingStatus: 'processing',
      folderPath: finalFolderPath,
      metadata: {
        visibility,
        pageCount,
        wordCount,
        characterCount,
        aiSuggestions: {
          category: {
            suggested: categorizationResult.suggestedCategory,
            confidence: categorizationResult.confidence,
          },
          tags: taggingResult.tags.slice(0, 10).map((tag) => ({
            tag: tag.tag,
            score: tag.score ?? 0,
            source: tag.source ?? 'unknown',
          })),
        },
        ocr: ocrMetadata,
      } as DocumentMetadata,
    });

    const persistentDir = path.join(process.cwd(), 'uploads', 'knowledge-documents');
    await fs.mkdir(persistentDir, { recursive: true });
    const persistentPath = path.join(persistentDir, `${document.id}${path.extname(uploadData.filename)}`);
    await copyManagedFile(toManagedFileLocation(tempFilePath), toManagedFileLocation(persistentPath));
    await params.deps.documentRepo.update(document.id, { fileUrl: persistentPath });
    const existingDocumentMetadata = document.metadata as DocumentMetadata | undefined;
    const processingMode = await queueKnowledgeDocumentPostProcessing({
      deps: params.deps,
      documentId: document.id,
      fullText: extractedText,
      contentHash: params.deps.duplicateDetection.calculateContentHash(extractedText),
      metadata: {
        ...existingDocumentMetadata,
        visibility,
      } as unknown as Record<string, unknown>,
    });

    await unlinkManagedFile(toManagedFileLocation(tempFilePath));
    tempFilePath = undefined;
    logger.info(`[Chunked Upload] ${uploadId}: Complete, document ID: ${document.id}`);

    return {
      success: true,
      data: {
        documentId: document.id,
        filename: uploadData.filename,
        fileSize: uploadData.fileSize,
        processingStatus: processingMode === 'processed_inline' ? 'completed' : 'processing',
        queued: processingMode === 'queued',
      },
    };
  } catch (error) {
    if (tempFilePath) {
      await safeUnlinkTempFile(tempFilePath, 'chunked upload error cleanup');
    }
    throw error;
  } finally {
    await cleanupChunkedUploadSession(uploadId);
  }
}

// Transient upload session tracking — intentionally in-memory since uploads complete
// in seconds/minutes and stale sessions are auto-cleaned every 5 minutes.
// On restart, incomplete uploads are orphaned on disk and cleaned by the interval.
const chunkedUploads = new Map<string, ChunkedUploadSession>();

const userUploadCounts = new Map<string, number>();

setInterval(() => {
  const now = new Date();
  const entries = Array.from(chunkedUploads.entries());
  for (const [uploadId, uploadSession] of entries) {
    if (now.getTime() - uploadSession.createdAt.getTime() > UPLOAD_TIMEOUT_MS) {
      try {
        if (fsSync.existsSync(uploadSession.chunkDir)) {
          fsSync.rmSync(uploadSession.chunkDir, { recursive: true, force: true });
        }
      } catch (e) {
        logger.error(`[Chunked Upload] Failed to cleanup ${uploadId}:`, e);
      }
      chunkedUploads.delete(uploadId);

      const count = userUploadCounts.get(uploadSession.userId) || 0;
      if (count > 0) {
        userUploadCounts.set(uploadSession.userId, count - 1);
      }
      logger.info(`[Chunked Upload] Cleaned up stale upload: ${uploadId}`);
    }
  }
}, 5 * 60 * 1000);

// ===== Dependency Injection =====

// The application layer should provide the repositories to the API layer.
export function createKnowledgeUploadRoutes(
  storage: KnowledgeUploadStorageSlice & AuthStorageSlice,
): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildKnowledgeUploadDeps(storage);

  // ── Single file upload ───────────────────────────────────────────
  router.post("/",
    auth.requirePermission('knowledge:write'),
    upload.single('file'),
    async (req, res) => {
      try {
        const response = await processSingleKnowledgeUpload({
          deps,
          req: req as unknown as SingleKnowledgeUploadRequest,
        });
        res.json(response);
      } catch (error) {
        if (isKnowledgeUploadHttpError(error)) {
          return res.status(error.status).json({
            success: false,
            error: error.message,
            ...error.responseBody,
          });
        }

        logger.error("Error uploading knowledge document:", error);

        await safeUnlinkTempFile(req.file?.path, 'single upload failure');

        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Failed to process document"
        });
      }
    }
  );

  // ── Bulk upload ──────────────────────────────────────────────────
  router.post("/bulk",
    auth.requirePermission('knowledge:write'),
    upload.array('files', 100),
    async (req, res) => {
      try {
        const response = await processBulkKnowledgeUpload({
          deps,
          req: req as unknown as BulkUploadRequest,
        });
        res.json(response);
      } catch (error) {
        if (isKnowledgeUploadHttpError(error)) {
          return res.status(error.status).json({
            success: false,
            error: error.message,
            ...error.responseBody,
          });
        }

        logger.error('Error in bulk upload:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to process bulk upload',
        });
      }
    }
  );

  // ── Chunked upload: init ─────────────────────────────────────────
  router.post("/chunked/init",
    auth.requirePermission('knowledge:write'),
    async (req, res) => {
      try {
        const userId = req.session.userId;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: "Authentication required"
          });
        }

        const {
          filename,
          fileSize,
          fileType,
          totalChunks,
          category,
          tags,
          accessLevel,
          folderPath,
          visibilityScope,
          sector,
          organization,
          department,
        } = req.body;

        if (!filename || !fileSize || !totalChunks) {
          return res.status(400).json({
            success: false,
            error: "Missing required fields: filename, fileSize, totalChunks"
          });
        }

        const maxSize = 500 * 1024 * 1024;
        if (fileSize > maxSize) {
          return res.status(400).json({
            success: false,
            error: `File size exceeds maximum allowed (${maxSize / 1024 / 1024}MB)`
          });
        }

        const currentCount = userUploadCounts.get(userId) || 0;
        if (currentCount >= MAX_CONCURRENT_UPLOADS_PER_USER) {
          return res.status(429).json({
            success: false,
            error: `Too many concurrent uploads. Maximum ${MAX_CONCURRENT_UPLOADS_PER_USER} allowed.`
          });
        }

        const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

        const chunkDir = path.join(CHUNK_UPLOAD_DIR, uploadId);
        await fs.mkdir(chunkDir, { recursive: true });

        userUploadCounts.set(userId, currentCount + 1);

        chunkedUploads.set(uploadId, {
          userId,
          filename,
          fileSize,
          fileType: fileType || path.extname(filename).toLowerCase().replace('.', ''),
          totalChunks,
          receivedChunks: new Set(),
          chunkDir,
          createdAt: new Date(),
          metadata: {
            category,
            tags,
            accessLevel,
            folderPath,
            visibilityScope,
            sector,
            organization,
            department,
          }
        });

        logger.info(`[Chunked Upload] Initialized upload ${uploadId}: ${filename} (${fileSize} bytes, ${totalChunks} chunks)`);

        res.json({
          success: true,
          data: {
            uploadId,
            chunkSize: Math.ceil(fileSize / totalChunks),
            totalChunks
          }
        });
      } catch (error) {
        logger.error("Error initializing chunked upload:", error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Failed to initialize upload"
        });
      }
    }
  );

  // ── Chunked upload: receive chunk ────────────────────────────────
  router.post("/chunked/:uploadId/chunk",
    auth.requirePermission('knowledge:write'),
    upload.single('chunk'),
    async (req, res) => {
      try {
        const userId = req.session.userId;
        const uploadId = req.params.uploadId;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: "Authentication required"
          });
        }

        if (!uploadId) {
          return res.status(400).json({
            success: false,
            error: "Missing uploadId"
          });
        }

        const chunkIndex = Number.parseInt(req.body.chunkIndex, 10);

        if (Number.isNaN(chunkIndex)) {
          return res.status(400).json({
            success: false,
            error: "Missing chunkIndex"
          });
        }

        const uploadData = chunkedUploads.get(uploadId);
        if (!uploadData) {
          return res.status(404).json({
            success: false,
            error: "Upload session not found or expired"
          });
        }

        if (uploadData.userId !== userId) {
          return res.status(403).json({
            success: false,
            error: "Unauthorized access to upload session"
          });
        }

        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: "No chunk data received"
          });
        }

        const chunkPath = path.join(uploadData.chunkDir, `chunk_${chunkIndex.toString().padStart(5, '0')}`);
        await fs.rename(req.file.path, chunkPath);

        uploadData.receivedChunks.add(chunkIndex);

        const progress = Math.round((uploadData.receivedChunks.size / uploadData.totalChunks) * 100);

        logger.info(`[Chunked Upload] ${uploadId}: Received chunk ${chunkIndex + 1}/${uploadData.totalChunks} (${progress}%)`);

        res.json({
          success: true,
          data: {
            chunkIndex,
            receivedChunks: uploadData.receivedChunks.size,
            totalChunks: uploadData.totalChunks,
            progress
          }
        });
      } catch (error) {
        logger.error("Error uploading chunk:", error);
        if (req.file?.path) {
          await unlinkManagedFile(toManagedFileLocation(req.file.path));
        }
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Failed to upload chunk"
        });
      }
    }
  );

  // ── Chunked upload: complete ─────────────────────────────────────
  router.post("/chunked/:uploadId/complete",
    auth.requirePermission('knowledge:write'),
    async (req, res) => {
      try {
        const response = await processChunkedUploadCompletion({
          deps,
          req: req as unknown as ChunkedUploadCompleteRequest,
        });
        res.json(response);
      } catch (error) {
        if (isKnowledgeUploadHttpError(error)) {
          return res.status(error.status).json({
            success: false,
            error: error.message,
            ...error.responseBody,
          });
        }

        logger.error('Error completing chunked upload:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to complete upload',
        });
      }
    }
  );

  // ── Chunked upload: status ───────────────────────────────────────
  router.get("/chunked/:uploadId/status",
    auth.requirePermission('knowledge:write'),
    async (req, res) => {
      try {
        const userId = req.session.userId;
        const uploadId = req.params.uploadId;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: "Authentication required"
          });
        }

        if (!uploadId) {
          return res.status(400).json({
            success: false,
            error: "Missing uploadId"
          });
        }

        const uploadData = chunkedUploads.get(uploadId);
        if (!uploadData) {
          return res.status(404).json({
            success: false,
            error: "Upload session not found or expired"
          });
        }

        if (uploadData.userId !== userId) {
          return res.status(403).json({
            success: false,
            error: "Unauthorized access to upload session"
          });
        }

        res.json({
          success: true,
          data: {
            uploadId,
            filename: uploadData.filename,
            fileSize: uploadData.fileSize,
            totalChunks: uploadData.totalChunks,
            receivedChunks: uploadData.receivedChunks.size,
            progress: Math.round((uploadData.receivedChunks.size / uploadData.totalChunks) * 100),
            missingChunks: Array.from({ length: uploadData.totalChunks }, (_, i) => i)
              .filter(i => !uploadData.receivedChunks.has(i))
          }
        });
      } catch (error) {
        logger.error("Error getting upload status:", error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Failed to get upload status"
        });
      }
    }
  );

  return router;
}
