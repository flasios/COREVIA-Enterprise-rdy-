import { z } from "zod";
import {
  KNOWLEDGE_CLASSIFICATIONS,
  DOCUMENT_CATEGORIES,
  type KnowledgeClassification,
  type KnowledgeDocument,
} from "@shared/schema";
import type {
  DocumentsDeps,
} from "./buildDeps";
import type { KnowResult } from "./shared";
import { logger } from "@platform/logging/Logger";

interface DocumentMetadata {
  pageCount?: number;
  [key: string]: unknown;
}

interface ChunkMetadata {
  startPosition?: number;
  endPosition?: number;
  [key: string]: unknown;
}

type VisibilityScope = "global" | "organization" | "department" | "private";

interface VisibilityMetadata {
  scope?: VisibilityScope;
  sector?: string;
  organization?: string;
  department?: string;
  allowedUsers?: string[];
}

interface DocumentMetadataEnvelope {
  visibility?: VisibilityMetadata;
  [key: string]: unknown;
}

interface ListDocumentFilters {
  category?: string;
  accessLevel?: string;
  fileType?: string;
  sortBy?: string;
  limit?: number;
  offset?: number;
  visibilityScope?: VisibilityScope;
  sector?: string;
  organization?: string;
  department?: string;
}

function normalizeString(value: string | undefined | null): string {
  return (value || "").trim().toLowerCase();
}

function getDocumentVisibility(document: KnowledgeDocument): VisibilityMetadata {
  const metadata = (document.metadata || {}) as DocumentMetadataEnvelope;
  const visibility = metadata.visibility || {};
  return {
    scope: visibility.scope || "organization",
    sector: visibility.sector,
    organization: visibility.organization,
    department: visibility.department,
    allowedUsers: Array.isArray(visibility.allowedUsers) ? visibility.allowedUsers : [],
  };
}

function isPrivilegedRole(role?: string): boolean {
  return ["super_admin", "director", "manager", "pmo_director", "financial_director"].includes(role || "");
}

function canReadDocument(document: KnowledgeDocument, userId: string, userRole?: string, userDepartment?: string): boolean {
  const isOwner = document.uploadedBy === userId;
  const privileged = isPrivilegedRole(userRole);
  if (isOwner || privileged) return true;

  const visibility = getDocumentVisibility(document);
  const allowedUsers = visibility.allowedUsers || [];
  if (allowedUsers.includes(userId)) return true;

  const isRestrictedAccess = document.accessLevel === "confidential" || document.accessLevel === "restricted";
  if (isRestrictedAccess) {
    return false;
  }

  if (visibility.scope === "private") {
    return false;
  }

  if (visibility.scope === "department") {
    const docDept = normalizeString(visibility.department);
    const usrDept = normalizeString(userDepartment);
    return Boolean(docDept && usrDept && docDept === usrDept);
  }

  return true;
}

function matchesGovernanceFilters(document: KnowledgeDocument, filters: ListDocumentFilters): boolean {
  const visibility = getDocumentVisibility(document);

  if (filters.visibilityScope && visibility.scope !== filters.visibilityScope) {
    return false;
  }

  if (filters.sector && normalizeString(visibility.sector) !== normalizeString(filters.sector)) {
    return false;
  }

  if (filters.organization && normalizeString(visibility.organization) !== normalizeString(filters.organization)) {
    return false;
  }

  if (filters.department && normalizeString(visibility.department) !== normalizeString(filters.department)) {
    return false;
  }

  return true;
}

const updateKnowledgeDocumentSchema = z.object({
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  accessLevel: z.enum(["public", "internal", "restricted"]).optional(),
  metadata: z.record(z.unknown()).optional(),
  folderPath: z.string().optional(),
});

const batchUpdateFolderSchema = z.object({
  documentIds: z.array(z.string()),
  folderPath: z.string(),
});


/** Checks whether a document's folderPath points to a valid taxonomy location. */
function isUnassigned(doc: KnowledgeDocument): boolean {
  const validClassifications = Object.keys(KNOWLEDGE_CLASSIFICATIONS);
  if (!doc.folderPath) return true;
  const parts = doc.folderPath.split("/").filter(Boolean);
  if (parts.length === 0 || parts.length > 2) return true;
  if (!validClassifications.includes(parts[0]!)) return true;
  if (parts.length === 2) {
    const cd = KNOWLEDGE_CLASSIFICATIONS[parts[0] as KnowledgeClassification];
    const valid = cd.subfolders?.map((sf) => sf.slug) || [];
    if (!valid.includes(parts[1]!)) return true;
  }
  return false;
}


export async function getDocumentStats(
  deps: Pick<DocumentsDeps, "documentRepo">,
): Promise<KnowResult> {
  const documents = await deps.documentRepo.getAll();
  const latestUpload = documents[0]?.uploadedAt ?? null;
  const categoryCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};

  documents.forEach((doc) => {
    if (doc.category) categoryCounts[doc.category] = (categoryCounts[doc.category] || 0) + 1;
    const status = doc.processingStatus || "pending";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const unassignedCount = documents.filter(isUnassigned).length;

  return {
    success: true,
    data: {
      total: documents.length,
      latestUpload: latestUpload ? latestUpload.toISOString() : null,
      categoryCounts,
      statusCounts,
      unassignedCount,
    },
  };
}


export async function listDocuments(
  deps: Pick<DocumentsDeps, "documentRepo" | "userReader">,
  filters: ListDocumentFilters,
  userId: string,
): Promise<KnowResult> {
  logger.info(`[Knowledge Docs] User ${userId} listing documents`);
  const currentUser = await deps.userReader.getById(userId);

  const documents = await deps.documentRepo.list({
    category: filters.category,
    accessLevel: filters.accessLevel,
    fileType: filters.fileType,
    sortBy: filters.sortBy || "newest",
    limit: filters.limit ?? 500,
    offset: filters.offset ?? 0,
  });

  const readableDocuments = documents
    .filter((doc) => canReadDocument(doc, userId, currentUser?.role, currentUser?.department || undefined))
    .filter((doc) => matchesGovernanceFilters(doc, filters));

  const withUploaders = await Promise.all(
    readableDocuments.map(async (doc) => {
      const uploader = await deps.userReader.getById(doc.uploadedBy);
      return { ...doc, uploaderName: uploader?.displayName || "Unknown" };
    }),
  );

  return { success: true, data: withUploaders };
}


export async function updateDocument(
  deps: Pick<DocumentsDeps, "documentRepo" | "userReader">,
  documentId: string,
  body: unknown,
  userId: string,
): Promise<KnowResult> {
  const validation = updateKnowledgeDocumentSchema.safeParse(body);
  if (!validation.success) {
    return { success: false, error: "Invalid update parameters", status: 400, details: validation.error.errors };
  }

  logger.info(`[Knowledge Docs] User ${userId} updating document ${documentId}`);
  const document = await deps.documentRepo.getById(documentId);
  if (!document) return { success: false, error: "Document not found", status: 404 };

  const user = await deps.userReader.getById(userId);
  const isOwner = document.uploadedBy === userId;
  const isAdmin = isPrivilegedRole(user?.role);
  if (!isOwner && !isAdmin) {
    return { success: false, error: "You don't have permission to update this document", status: 403 };
  }

  const { category, tags, accessLevel, metadata, folderPath } = validation.data;

  const mergedMetadata: Record<string, unknown> = {
    ...((document.metadata as Record<string, unknown> | null) || {}),
    ...((metadata as Record<string, unknown> | undefined) || {}),
  };

  const updatedDocument = await deps.documentRepo.update(documentId, {
    category: (category || document.category) as string | undefined,
    tags: (tags || document.tags) as string[] | undefined,
    accessLevel: (accessLevel || document.accessLevel) as 'public' | 'internal' | 'confidential' | undefined,
    folderPath: folderPath ?? document.folderPath ?? undefined,
    metadata: mergedMetadata,
  });

  return { success: true, data: updatedDocument };
}


export async function deleteDocument(
  deps: Pick<DocumentsDeps, "documentRepo" | "userReader">,
  documentId: string,
  userId: string,
): Promise<KnowResult> {
  logger.info(`[Knowledge Docs] User ${userId} deleting document ${documentId}`);
  const document = await deps.documentRepo.getById(documentId);
  if (!document) return { success: false, error: "Document not found", status: 404 };

  const user = await deps.userReader.getById(userId);
  const isOwner = document.uploadedBy === userId;
  const isAdmin = user?.role === "manager" || user?.role === "director";
  if (!isOwner && !isAdmin) {
    return { success: false, error: "You don't have permission to delete this document", status: 403 };
  }

  await deps.documentRepo.delete(documentId);
  return { success: true, data: { message: "Document deleted successfully" } };
}


export async function getDocumentPreview(
  deps: Pick<DocumentsDeps, "documentRepo" | "chunkRepo" | "auditLogger">,
  documentId: string,
  chunkId: string | undefined,
  userId: string,
): Promise<KnowResult> {
  logger.info(`[Knowledge Preview] User ${userId} requesting preview for document ${documentId}, chunk: ${chunkId || "none"}`);
  const document = await deps.documentRepo.getById(documentId);
  if (!document) return { success: false, error: "Document not found", status: 404 };

  const chunks = await deps.chunkRepo.getByDocument(documentId);
  const documentMetadata = (document.metadata as DocumentMetadata) || {};

  const response: Record<string, unknown> = {
    documentId: document.id,
    title: document.filename,
    extractedText: document.fullText || "",
    metadata: {
      fileType: document.fileType,
      pageCount: documentMetadata.pageCount,
      wordCount: document.fullText?.split(/\s+/).length || 0,
      category: document.category ?? undefined,
      uploadedAt: document.uploadedAt,
      uploadedBy: document.uploadedBy,
    },
  };

  if (chunkId) {
    const chunk = chunks.find((c) => c.id === chunkId);
    if (chunk) {
      const chunkMeta = (chunk.metadata as ChunkMetadata) || {};
      response.chunk = {
        id: chunk.id,
        start: chunkMeta.startPosition || 0,
        end: chunkMeta.endPosition || chunk.content.length,
        content: chunk.content,
        context: chunk.content,
      };
    }

    await deps.auditLogger.logEvent({
      userId,
      action: "citation_viewed",
      result: "success",
      details: { documentId, chunkId, documentTitle: document.filename },
    });
  }

  return { success: true, data: response };
}


export async function bulkDeleteDocuments(
  deps: Pick<DocumentsDeps, "documentRepo" | "chunkRepo">,
  documentIds: string[],
  userId: string,
): Promise<KnowResult> {
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return { success: false, error: "documentIds array is required", status: 400 };
  }
  if (documentIds.length > 100) {
    return { success: false, error: "Maximum 100 documents can be deleted at once", status: 400 };
  }

  logger.info(`[Bulk Delete] User ${userId} deleting ${documentIds.length} documents`);
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const docId of documentIds) {
    try {
      await deps.chunkRepo.deleteByDocument(docId);
      await deps.documentRepo.delete(docId);
      results.push({ id: docId, success: true });
    } catch (error) {
      results.push({ id: docId, success: false, error: error instanceof Error ? error.message : "Delete failed" });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  logger.info(`[Bulk Delete] Complete: ${successCount} deleted, ${results.length - successCount} failed`);

  return {
    success: true,
    data: { totalRequested: documentIds.length, successCount, errorCount: results.length - successCount, results },
  };
}


/** Validates a classification/subfolder path against the taxonomy. */
function validateFolderPath(folderPath: string): KnowResult | null {
  const pathParts = folderPath.split("/");
  const classificationId = pathParts[0];
  const subfolderSlug = pathParts[1];

  if (!KNOWLEDGE_CLASSIFICATIONS[classificationId as keyof typeof KNOWLEDGE_CLASSIFICATIONS]) {
    return { success: false, error: `Invalid classification: ${classificationId}`, status: 400 };
  }

  if (subfolderSlug) {
    const classInfo = KNOWLEDGE_CLASSIFICATIONS[classificationId as keyof typeof KNOWLEDGE_CLASSIFICATIONS];
    const validSubfolder = (classInfo.subfolders || []).find((sf: { slug: string }) => sf.slug === subfolderSlug);
    if (!validSubfolder) {
      return { success: false, error: `Invalid subfolder: ${subfolderSlug}`, status: 400 };
    }
  }

  return null; // valid
}


export async function bulkMoveDocuments(
  deps: Pick<DocumentsDeps, "documentRepo">,
  documentIds: string[],
  folderPath: string,
  userId: string,
): Promise<KnowResult> {
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return { success: false, error: "documentIds array is required", status: 400 };
  }
  if (typeof folderPath !== "string") {
    return { success: false, error: "folderPath is required", status: 400 };
  }
  if (documentIds.length > 100) {
    return { success: false, error: "Maximum 100 documents can be moved at once", status: 400 };
  }

  const pathError = validateFolderPath(folderPath);
  if (pathError) return pathError;

  logger.info(`[Bulk Move] User ${userId} moving ${documentIds.length} documents to ${folderPath}`);
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const docId of documentIds) {
    try {
      await deps.documentRepo.update(docId, { folderPath });
      results.push({ id: docId, success: true });
    } catch (error) {
      results.push({ id: docId, success: false, error: error instanceof Error ? error.message : "Move failed" });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  logger.info(`[Bulk Move] Complete: ${successCount} moved to ${folderPath}`);

  return {
    success: true,
    data: { totalRequested: documentIds.length, successCount, errorCount: results.length - successCount, folderPath, results },
  };
}


export async function bulkClassifyDocuments(
  deps: Pick<DocumentsDeps, "documentRepo">,
  documentIds: string[],
  categoryId: string | undefined,
  folderPath: string | undefined,
  userId: string,
): Promise<KnowResult> {
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return { success: false, error: "documentIds array is required", status: 400 };
  }
  if (!categoryId && !folderPath) {
    return { success: false, error: "At least one of categoryId or folderPath is required", status: 400 };
  }
  if (documentIds.length > 100) {
    return { success: false, error: "Maximum 100 documents can be classified at once", status: 400 };
  }

  if (categoryId && !DOCUMENT_CATEGORIES[categoryId as keyof typeof DOCUMENT_CATEGORIES]) {
    return { success: false, error: `Invalid category: ${categoryId}`, status: 400 };
  }

  if (folderPath) {
    const pathError = validateFolderPath(folderPath);
    if (pathError) return pathError;
  }

  logger.info(`[Bulk Classify] User ${userId} classifying ${documentIds.length} documents`);
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const docId of documentIds) {
    try {
      const updates: Record<string, unknown> = {};
      if (categoryId) updates.category = categoryId;
      if (folderPath) updates.folderPath = folderPath;
      await deps.documentRepo.update(docId, updates);
      results.push({ id: docId, success: true });
    } catch (error) {
      results.push({ id: docId, success: false, error: error instanceof Error ? error.message : "Classify failed" });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  logger.info(`[Bulk Classify] Complete: ${successCount} classified`);

  return {
    success: true,
    data: { totalRequested: documentIds.length, successCount, errorCount: results.length - successCount, categoryId, folderPath, results },
  };
}


export async function regenerateEmbeddings(
  deps: Pick<DocumentsDeps, "documentRepo" | "chunkRepo" | "embeddingsService">,
  documentIds: string[] | undefined,
  userId: string,
): Promise<KnowResult> {
  logger.info(`[Knowledge Docs] User ${userId} regenerating embeddings for ${documentIds?.length || "all"} documents`);

  let documentsToProcess: KnowledgeDocument[] = [];

  if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
    for (const docId of documentIds) {
      const doc = await deps.documentRepo.getById(docId);
      if (doc) documentsToProcess.push(doc);
    }
  } else {
    documentsToProcess = await deps.documentRepo.list({});
  }

  if (documentsToProcess.length === 0) {
    return { success: true, data: { message: "No documents to process", processed: 0, failed: 0 } };
  }

  const MAX_BATCH = 10;
  const batch = documentsToProcess.slice(0, MAX_BATCH);
  let processed = 0;
  let failed = 0;
  const results: Array<{ id: string; title: string; status: string; error?: string }> = [];

  for (const doc of batch) {
    try {
      const chunks = await deps.chunkRepo.getByDocument(doc.id);
      if (!chunks || chunks.length === 0) {
        results.push({ id: doc.id, title: doc.filename || "Unknown", status: "skipped", error: "No chunks found" });
        continue;
      }

      const chunksNeedingEmbeddings = chunks.filter((c) => !c.embedding || c.embedding.length === 0);
      if (chunksNeedingEmbeddings.length === 0) {
        results.push({ id: doc.id, title: doc.filename || "Unknown", status: "skipped", error: "Already has embeddings" });
        continue;
      }

      const batchResult = await deps.embeddingsService.generateBatchEmbeddings(chunksNeedingEmbeddings.map((c) => c.content));

      let successCount = 0;
      for (let i = 0; i < chunksNeedingEmbeddings.length; i++) {
        const chunk = chunksNeedingEmbeddings[i]!;
        const embedding = batchResult.embeddings[i];
        const isFailed = batchResult.failedIndices.includes(i);
        if (!isFailed && embedding && embedding.length > 0) {
          await deps.chunkRepo.updateEmbedding(chunk.id, embedding);
          successCount++;
        }
      }

      if (successCount > 0) {
        processed++;
        results.push({
          id: doc.id,
          title: doc.filename || "Unknown",
          status: "success",
          error: successCount < chunksNeedingEmbeddings.length ? `${successCount}/${chunksNeedingEmbeddings.length} chunks processed` : undefined,
        });
      } else {
        failed++;
        results.push({ id: doc.id, title: doc.filename || "Unknown", status: "failed", error: "All embeddings failed" });
      }
    } catch (docError) {
      failed++;
      results.push({ id: doc.id, title: doc.filename || "Unknown", status: "failed", error: docError instanceof Error ? docError.message : "Unknown error" });
    }
  }

  return {
    success: true,
    data: {
      message: `Processed ${processed} documents, ${failed} failed`,
      processed,
      failed,
      remaining: documentsToProcess.length > MAX_BATCH ? documentsToProcess.length - MAX_BATCH : 0,
      results,
    },
  };
}


export async function getUnassignedDocuments(
  deps: Pick<DocumentsDeps, "documentRepo">,
): Promise<KnowResult> {
  const allDocs = await deps.documentRepo.list({});
  const unassignedDocs = allDocs.filter(isUnassigned);
  return { success: true, data: unassignedDocs };
}


export async function batchUpdateFolder(
  deps: Pick<DocumentsDeps, "documentRepo">,
  body: unknown,
  userId: string,
): Promise<KnowResult> {
  const validation = batchUpdateFolderSchema.safeParse(body);
  if (!validation.success) {
    return { success: false, error: "Invalid request body", status: 400, details: validation.error.errors };
  }

  const { documentIds, folderPath } = validation.data;

  const pathParts = folderPath.split("/").filter(Boolean);
  const validClassifications = Object.keys(KNOWLEDGE_CLASSIFICATIONS);

  if (pathParts.length === 0 || pathParts.length > 2) {
    return { success: false, error: `Invalid folder path format: ${folderPath}. Must be 'classification' or 'classification/subfolder'.`, status: 400 };
  }

  const classification = pathParts[0]!;
  if (!validClassifications.includes(classification)) {
    return { success: false, error: `Invalid classification: ${classification}. Valid options: ${validClassifications.join(", ")}`, status: 400 };
  }

  if (pathParts.length === 2) {
    const cd = KNOWLEDGE_CLASSIFICATIONS[classification as KnowledgeClassification];
    const validSubfolders = cd.subfolders?.map((sf) => sf.slug) || [];
    if (validSubfolders.length === 0) {
      return { success: false, error: `Classification '${classification}' does not have subfolders.`, status: 400 };
    }
    if (!validSubfolders.includes(pathParts[1]!)) {
      return { success: false, error: `Invalid subfolder: ${pathParts[1]!}. Valid options for ${classification}: ${validSubfolders.join(", ")}`, status: 400 };
    }
  }

  logger.info(`[Batch Update Folder] User ${userId} updating ${documentIds.length} documents to folder: ${folderPath}`);
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const docId of documentIds) {
    try {
      await deps.documentRepo.update(docId, { folderPath });
      results.push({ id: docId, success: true });
    } catch (updateError) {
      results.push({ id: docId, success: false, error: updateError instanceof Error ? updateError.message : "Unknown error" });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  logger.info(`[Batch Update Folder] Complete: ${successCount}/${documentIds.length} updated`);

  return {
    success: true,
    data: { message: `Updated ${successCount}/${documentIds.length} documents`, updated: successCount, failed: documentIds.length - successCount, results },
  };
}


/** Pure analysis: decide the best classification for a document based on filename/content. */
function analyzeDocumentClassification(
  doc: KnowledgeDocument,
): { classification: string; subfolder?: string } {
  const filename = doc.filename.toLowerCase();
  const category = (doc.category || "").toLowerCase();
  const content = (doc.fullText || "").toLowerCase().slice(0, 500);

  if (filename.includes("policy") || category.includes("policy") || content.includes("policy") || content.includes("governance")) {
    if (filename.includes("it") || content.includes("information technology") || content.includes("software")) return { classification: "policies", subfolder: "it-policies" };
    if (filename.includes("hr") || filename.includes("human") || content.includes("employee")) return { classification: "policies", subfolder: "hr-policies" };
    if (filename.includes("security") || content.includes("security") || content.includes("cyber")) return { classification: "policies", subfolder: "security-policies" };
    if (filename.includes("financ") || content.includes("budget") || content.includes("procurement")) return { classification: "policies", subfolder: "financial-policies" };
    return { classification: "policies", subfolder: "operational-policies" };
  }

  if (filename.includes("procedure") || filename.includes("sop") || content.includes("step-by-step") || content.includes("workflow")) {
    if (content.includes("emergency") || content.includes("incident")) return { classification: "procedures", subfolder: "emergency-procedures" };
    if (content.includes("approval") || content.includes("authorize")) return { classification: "procedures", subfolder: "approval-procedures" };
    if (content.includes("onboard") || content.includes("new employee")) return { classification: "procedures", subfolder: "onboarding-procedures" };
    return { classification: "procedures", subfolder: "standard-operating-procedures" };
  }

  if (filename.includes("guide") || filename.includes("best practice") || content.includes("recommended") || content.includes("guideline")) {
    return { classification: "guidelines", subfolder: "best-practices" };
  }

  if (filename.includes("template") || content.includes("template")) return { classification: "templates", subfolder: "project-templates" };

  if (filename.includes("report") || content.includes("analysis") || content.includes("findings")) {
    if (content.includes("annual") || content.includes("yearly")) return { classification: "reports", subfolder: "annual-reports" };
    if (content.includes("audit") || content.includes("compliance")) return { classification: "reports", subfolder: "audit-reports" };
    return { classification: "reports", subfolder: "project-reports" };
  }

  if (filename.includes("case study") || filename.includes("research") || content.includes("case study") || content.includes("research")) return { classification: "case-studies" };

  if (filename.includes("training") || filename.includes("tutorial") || content.includes("training") || content.includes("learning")) {
    return { classification: "training-materials", subfolder: "training-guides" };
  }

  if (filename.includes("standard") || content.includes("compliance") || content.includes("requirement")) return { classification: "standards", subfolder: "data-standards" };

  if (doc.folderPath?.includes("Gartner")) return { classification: "reports", subfolder: "project-reports" };

  return { classification: "guidelines", subfolder: "best-practices" };
}


export async function autoAssignDocuments(
  deps: Pick<DocumentsDeps, "documentRepo">,
  userId: string,
): Promise<KnowResult> {
  logger.info(`[Auto Assign] User ${userId} requested auto-assignment of documents`);
  const allDocs = await deps.documentRepo.list({});
  const unassignedDocs = allDocs.filter(isUnassigned);

  logger.info(`[Auto Assign] Found ${unassignedDocs.length} unassigned documents`);
  if (unassignedDocs.length === 0) {
    return { success: true, data: { message: "No unassigned documents found", assigned: 0, results: [] } };
  }

  const validClassifications = Object.keys(KNOWLEDGE_CLASSIFICATIONS);

  const validatePath = (classification: string, subfolder?: string): boolean => {
    if (!validClassifications.includes(classification)) return false;
    if (subfolder) {
      const cd = KNOWLEDGE_CLASSIFICATIONS[classification as KnowledgeClassification];
      const vs = cd.subfolders?.map((sf) => sf.slug) || [];
      if (!vs.includes(subfolder)) return false;
    }
    return true;
  };

  const results: Array<{ id: string; filename: string; oldPath: string | null; newPath: string; success: boolean; error?: string }> = [];

  for (const doc of unassignedDocs) {
    const suggestion = analyzeDocumentClassification(doc);
    if (!validatePath(suggestion.classification, suggestion.subfolder)) {
      results.push({ id: doc.id, filename: doc.filename, oldPath: doc.folderPath, newPath: `${suggestion.classification}/${suggestion.subfolder || ""}`, success: false, error: `Invalid classification path` });
      continue;
    }
    const newPath = suggestion.subfolder ? `${suggestion.classification}/${suggestion.subfolder}` : suggestion.classification;
    try {
      await deps.documentRepo.update(doc.id, { folderPath: newPath });
      results.push({ id: doc.id, filename: doc.filename, oldPath: doc.folderPath, newPath, success: true });
      logger.info(`[Auto Assign] Assigned "${doc.filename}" to ${newPath}`);
    } catch (updateError) {
      results.push({ id: doc.id, filename: doc.filename, oldPath: doc.folderPath, newPath, success: false, error: updateError instanceof Error ? updateError.message : "Unknown error" });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  logger.info(`[Auto Assign] Complete: ${successCount}/${unassignedDocs.length} documents assigned`);

  return {
    success: true,
    data: { message: `Auto-assigned ${successCount}/${unassignedDocs.length} documents`, assigned: successCount, failed: unassignedDocs.length - successCount, results },
  };
}


/** Decode corrupted UTF-8 filenames (Latin-1 encoded Arabic etc). */
function decodeFilename(filename: string): string {
  if (!filename) return filename;
  try {
    const hasValidArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(filename);
    if (hasValidArabic) return filename;
    if (!/[ØÙÚÛÜÝÞß]/.test(filename)) return filename;
    const bytes = [];
    for (let i = 0; i < filename.length; i++) bytes.push(filename.charCodeAt(i));
    const decoded = Buffer.from(bytes).toString("utf8");
    if (decoded && !decoded.includes("\ufffd")) return decoded;
  } catch (_e) { /* no-op */ }
  return filename;
}


export async function fixEncoding(
  deps: Pick<DocumentsDeps, "documentRepo">,
  userId: string,
): Promise<KnowResult> {
  logger.info(`[Encoding Fix] User ${userId} requested filename encoding fix`);
  const allDocs = await deps.documentRepo.list({});
  const results: Array<{ id: string; oldName: string; newName: string; fixed: boolean }> = [];

  for (const doc of allDocs) {
    const decoded = decodeFilename(doc.filename);
    if (decoded !== doc.filename) {
      try {
        await deps.documentRepo.update(doc.id, { filename: decoded } as Record<string, unknown>);
        results.push({ id: doc.id, oldName: doc.filename, newName: decoded, fixed: true });
        logger.info(`[Encoding Fix] Fixed: "${doc.filename}" -> "${decoded}"`);
      } catch (_updateError) {
        results.push({ id: doc.id, oldName: doc.filename, newName: decoded, fixed: false });
      }
    }
  }

  logger.info(`[Encoding Fix] Complete: ${results.filter((r) => r.fixed).length} filenames fixed`);
  return {
    success: true,
    data: { message: `Fixed ${results.filter((r) => r.fixed).length} corrupted filenames`, fixed: results.filter((r) => r.fixed).length, results },
  };
}
