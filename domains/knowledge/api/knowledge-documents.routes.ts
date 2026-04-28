import { Router, type Response } from "express";
import type { KnowledgeDocStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import {
  createManagedFileHandleFromPath,
  createManagedReadStream,
  managedFileExists,
  type ManagedFileHandle,
} from "@platform/storage/managedFiles";

const KNOWLEDGE_DOCUMENT_ROOTS = [path.resolve(process.cwd(), "uploads")];

function resolveManagedDocumentPath(fileUrl: string | null | undefined): ManagedFileHandle | null {
  if (!fileUrl) return null;
  try {
    return createManagedFileHandleFromPath(fileUrl, KNOWLEDGE_DOCUMENT_ROOTS);
  } catch {
    return null;
  }
}

import {
  buildKnowledgeDocumentsDeps,
  getDocumentStats,
  listDocuments,
  updateDocument,
  deleteDocument,
  getDocumentPreview,
  bulkDeleteDocuments,
  bulkMoveDocuments,
  bulkClassifyDocuments,
  regenerateEmbeddings,
  getUnassignedDocuments,
  batchUpdateFolder,
  autoAssignDocuments,
  fixEncoding,
} from "../application";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";

function sanitizeDownloadFilename(filename: string, fallbackExtension = "txt"): string {
  const basename = path.basename(filename || "document");
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized.length > 0 ? sanitized : `document.${fallbackExtension}`;
}

function escapePlainTextContent(value: string | null | undefined): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toPlainTextBuffer(value: string | null | undefined): Buffer {
  return Buffer.from(escapePlainTextContent(value), "utf8");
}

function sendPlainTextResponse(
  res: Response,
  value: string | null | undefined,
  filename: string,
  disposition: "inline" | "attachment",
) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
  return pipeline(Readable.from([toPlainTextBuffer(value)]), res);
}

async function streamManagedFile(
  res: Response,
  filePath: ManagedFileHandle,
  filename: string,
  contentType: string,
  disposition: "inline" | "attachment",
) {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
  await pipeline(createManagedReadStream(filePath), res);
}

/* ── Zod schemas for body validation ── */
const updateDocumentBody = z.object({
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  accessLevel: z.enum(["public", "internal", "confidential"]).optional(),
}).passthrough();

const bulkDeleteBody = z.object({
  documentIds: z.array(z.string()).min(1),
});

const bulkMoveBody = z.object({
  documentIds: z.array(z.string()).min(1),
  folderPath: z.string(),
});

const bulkClassifyBody = z.object({
  documentIds: z.array(z.string()).min(1),
  categoryId: z.string().optional(),
  folderPath: z.string().optional(),
});

const regenerateEmbeddingsBody = z.object({
  documentIds: z.array(z.string()).optional(),
});

const batchUpdateFolderBody = z.object({
  documentIds: z.array(z.string()).min(1),
  folderPath: z.string(),
}).passthrough();

/* ── route-level helper: content-type for file-serving endpoints ── */
function getContentType(fileType: string): string {
  const types: Record<string, string> = {
    'pdf': 'application/pdf', 'txt': 'text/plain', 'md': 'text/markdown',
    'html': 'text/html', 'json': 'application/json', 'xml': 'application/xml',
    'csv': 'text/csv',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'ppt': 'application/vnd.ms-powerpoint',
    'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
    'gif': 'image/gif', 'webp': 'image/webp',
  };
  return types[fileType.toLowerCase()] || 'application/octet-stream';
}

export function createKnowledgeDocumentRoutes(storage: KnowledgeDocStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildKnowledgeDocumentsDeps(storage);

  const send = (res: any, r: any) => r.success ? res.json(r) : res.status(r.status).json(r); // eslint-disable-line @typescript-eslint/no-explicit-any

  // ── CRUD via use-cases ───────────────────────────────────────

  router.get("/stats", auth.requirePermission('knowledge:read'), asyncHandler(async (_req, res) => {
    send(res, await getDocumentStats(deps));
  }));

  router.get("/", auth.requirePermission('knowledge:read'), asyncHandler(async (req, res) => {
    const { category, accessLevel, fileType, sortBy, limit, offset, visibilityScope, sector, organization, department } = req.query;
    const r = await listDocuments(deps, {
      category: category as string | undefined, accessLevel: accessLevel as string | undefined,
      fileType: fileType as string | undefined, sortBy: sortBy as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined, offset: offset ? parseInt(offset as string) : undefined,
      visibilityScope: visibilityScope as "global" | "organization" | "department" | "private" | undefined,
      sector: sector as string | undefined,
      organization: organization as string | undefined,
      department: department as string | undefined,
    }, req.session.userId!);
    if (r.success) res.json({ ...r, count: (r.data as unknown[]).length }); else res.status(r.status).json(r);
  }));

  router.patch("/:id", auth.requirePermission('knowledge:write'), validateBody(updateDocumentBody), asyncHandler(async (req, res) => {
    send(res, await updateDocument(deps, req.params.id as string, req.body, req.session.userId!));
  }));

  router.delete("/:id", auth.requirePermission('knowledge:write'), asyncHandler(async (req, res) => {
    send(res, await deleteDocument(deps, req.params.id as string, req.session.userId!));
  }));

  router.get("/:id/preview", auth.requirePermission('knowledge:read'), asyncHandler(async (req, res) => {
    send(res, await getDocumentPreview(deps, req.params.id as string, req.query.chunkId as string | undefined, req.session.userId!));
  }));

  // ── File-serving endpoints (route-level: res.setHeader / pipe) ─

  router.get("/:id/file", auth.requirePermission('knowledge:read'), asyncHandler(async (req, res) => {
    const doc = await deps.documentRepo.getById(req.params.id as string);
    if (!doc) return res.status(404).json({ success: false, error: "Document not found" });
    const _ct = getContentType(doc.fileType);
    const safeFilename = sanitizeDownloadFilename(doc.filename, doc.fileType || "txt");
    if (doc.fileType === 'pdf') {
      await sendPlainTextResponse(res, doc.fullText || 'No text content available', `${safeFilename}.txt`, 'inline');
      return;
    } else if (['png','jpg','jpeg','gif','webp','bmp','tiff'].includes(doc.fileType)) {
      await sendPlainTextResponse(res, `Image document: ${safeFilename}\n\nExtracted text:\n${doc.fullText || 'No text extracted'}`, `${safeFilename}.txt`, 'inline');
      return;
    } else {
      await sendPlainTextResponse(res, doc.fullText || '', safeFilename, 'inline');
      return;
    }
  }));

  router.get("/:id/download", auth.requirePermission('knowledge:read'), asyncHandler(async (req, res) => {
    const doc = await deps.documentRepo.getById(req.params.id as string);
    if (!doc) return res.status(404).json({ success: false, error: "Document not found" });
    const resolvedPath = resolveManagedDocumentPath(doc.fileUrl);
    const safeFilename = sanitizeDownloadFilename(doc.filename, doc.fileType || "txt");
    if (resolvedPath && managedFileExists(resolvedPath)) {
      await streamManagedFile(res, resolvedPath, safeFilename, getContentType(doc.fileType), 'attachment');
      return;
    } else {
      await sendPlainTextResponse(res, doc.fullText || 'No content available', `${safeFilename}.txt`, 'attachment');
      return;
    }
  }));

  router.get("/:id/view", auth.requirePermission('knowledge:read'), asyncHandler(async (req, res) => {
    const doc = await deps.documentRepo.getById(req.params.id as string);
    if (!doc) return res.status(404).json({ success: false, error: "Document not found" });
    const resolvedPath = resolveManagedDocumentPath(doc.fileUrl);
    const safeFilename = sanitizeDownloadFilename(doc.filename, doc.fileType || "txt");
    if (resolvedPath && managedFileExists(resolvedPath)) {
      await streamManagedFile(res, resolvedPath, safeFilename, getContentType(doc.fileType), 'inline');
      return;
    } else {
      await sendPlainTextResponse(res, doc.fullText || 'No content available - original file not stored', `${safeFilename}.txt`, 'inline');
      return;
    }
  }));

  // ── Bulk / batch via use-cases ───────────────────────────────

  router.post("/bulk-delete", auth.requirePermission('knowledge:write'), validateBody(bulkDeleteBody), asyncHandler(async (req, res) => {
    send(res, await bulkDeleteDocuments(deps, req.body.documentIds, req.session.userId!));
  }));

  router.post("/bulk-move", auth.requirePermission('knowledge:write'), validateBody(bulkMoveBody), asyncHandler(async (req, res) => {
    send(res, await bulkMoveDocuments(deps, req.body.documentIds, req.body.folderPath, req.session.userId!));
  }));

  router.post("/bulk-classify", auth.requirePermission('knowledge:write'), validateBody(bulkClassifyBody), asyncHandler(async (req, res) => {
    send(res, await bulkClassifyDocuments(deps, req.body.documentIds, req.body.categoryId, req.body.folderPath, req.session.userId!));
  }));

  router.post("/regenerate-embeddings", auth.requirePermission('knowledge:write'), validateBody(regenerateEmbeddingsBody), asyncHandler(async (req, res) => {
    send(res, await regenerateEmbeddings(deps, req.body.documentIds, req.session.userId!));
  }));

  router.get("/unassigned", auth.requirePermission('knowledge:read'), asyncHandler(async (_req, res) => {
    const r = await getUnassignedDocuments(deps);
    if (r.success) res.json({ ...r, count: (r.data as unknown[]).length }); else res.status(r.status).json(r);
  }));

  router.post("/batch-update-folder", auth.requirePermission('knowledge:write'), validateBody(batchUpdateFolderBody), asyncHandler(async (req, res) => {
    send(res, await batchUpdateFolder(deps, req.body, req.session.userId!));
  }));

  router.post("/auto-assign", auth.requirePermission('knowledge:write'), asyncHandler(async (req, res) => {
    send(res, await autoAssignDocuments(deps, req.session.userId!));
  }));

  router.post("/fix-encoding", auth.requirePermission('knowledge:write'), asyncHandler(async (req, res) => {
    send(res, await fixEncoding(deps, req.session.userId!));
  }));

  return router;
}
