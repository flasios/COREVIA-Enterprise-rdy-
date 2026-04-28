/**
 * Knowledge Module — Domain Entities, Value Objects & Policies
 *
 * Pure business rules — no DB, HTTP, or I/O imports.
 */

import type { Percentage } from "@shared/primitives/valueObjects";

// ── Value Objects ──────────────────────────────────────────────────

export type DocumentClassification = "public" | "internal" | "confidential" | "sovereign";

export type DocumentStatus = "draft" | "pending_review" | "approved" | "archived" | "rejected";

export type DocumentCategory =
  | "policy"
  | "procedure"
  | "standard"
  | "template"
  | "report"
  | "evidence"
  | "training"
  | "reference"
  | "other";

export type QualityGrade = "A" | "B" | "C" | "D" | "F";

export interface DocumentMetadata {
  title: string;
  category: DocumentCategory;
  classification: DocumentClassification;
  tags: string[];
  version: string;
  author: string;
}

// Re-export shared VOs
export type { Percentage };

// ── Domain Policies ────────────────────────────────────────────────

/** Maximum file size for uploads (50 MB). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Allowed MIME types for knowledge document uploads. */
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "text/markdown",
  "image/png",
  "image/jpeg",
]);

/**
 * Can a user view a document given their clearance level?
 * Classification hierarchy: public < internal < confidential < sovereign.
 */
export function canViewDocument(
  docClassification: DocumentClassification,
  userClearance: DocumentClassification
): boolean {
  const levels: Record<DocumentClassification, number> = {
    public: 0,
    internal: 1,
    confidential: 2,
    sovereign: 3,
  };
  return levels[userClearance] >= levels[docClassification];
}

/**
 * Check if a file type is allowed for upload.
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

/**
 * Validate upload file constraints.
 */
export function validateUpload(file: {
  size: number;
  mimeType: string;
}): { valid: boolean; error?: string } {
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      valid: false,
      error: `File exceeds maximum size of ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`,
    };
  }
  if (!isAllowedMimeType(file.mimeType)) {
    return {
      valid: false,
      error: `File type ${file.mimeType} is not allowed`,
    };
  }
  return { valid: true };
}

/**
 * Can a user modify a document (edit/delete)?
 * Authors can edit drafts; reviewers can approve; admins can do anything.
 */
export function canModifyDocument(
  doc: { status: DocumentStatus; authorId: string },
  userId: string,
  userRole: string
): boolean {
  if (userRole === "super_admin" || userRole === "system_admin") return true;
  if (doc.authorId === userId && doc.status === "draft") return true;
  if (userRole === "director" || userRole === "pmo") return true;
  return false;
}

/**
 * Determine the next status in the document review workflow.
 */
export function nextDocumentStatus(
  current: DocumentStatus,
  action: "submit" | "approve" | "reject" | "archive"
): DocumentStatus | null {
  const transitions: Record<string, DocumentStatus> = {
    "draft:submit": "pending_review",
    "pending_review:approve": "approved",
    "pending_review:reject": "rejected",
    "approved:archive": "archived",
    "rejected:submit": "pending_review",
  };
  return transitions[`${current}:${action}`] ?? null;
}

// ── Quality Scoring ────────────────────────────────────────────────

/**
 * Calculate document quality grade based on metadata completeness and content metrics.
 * Moved from infrastructure layer — pure domain logic.
 */
export function computeQualityGrade(metrics: {
  hasTitle: boolean;
  hasDescription: boolean;
  hasTags: boolean;
  hasVersion: boolean;
  wordCount: number;
  hasEvidence: boolean;
}): QualityGrade {
  let score = 0;
  if (metrics.hasTitle) score += 20;
  if (metrics.hasDescription) score += 20;
  if (metrics.hasTags) score += 10;
  if (metrics.hasVersion) score += 10;
  if (metrics.wordCount >= 100) score += 20;
  else if (metrics.wordCount >= 50) score += 10;
  if (metrics.hasEvidence) score += 20;

  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Check if two documents are potential duplicates based on title similarity.
 * Domain-pure: uses Jaccard similarity on word tokens.
 */
export function arePotentialDuplicates(titleA: string, titleB: string, threshold = 0.7): boolean {
  const tokenize = (s: string) => new Set(s.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean));
  const setA = tokenize(titleA);
  const setB = tokenize(titleB);
  if (setA.size === 0 || setB.size === 0) return false;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 && intersection / union >= threshold;
}

/**
 * Determine if a document is stale and should be reviewed.
 * Documents not updated in 180+ days are considered stale.
 */
export function isDocumentStale(lastUpdated: Date, now: Date = new Date()): boolean {
  const daysSinceUpdate = Math.ceil((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
  return daysSinceUpdate >= 180;
}
