import type { KnowledgeDocument } from "@shared/schema";
import type { OCRData } from "../hooks/knowledgeCentreUtils";

export interface DocumentWithUploader extends KnowledgeDocument {
  uploaderName: string;
}

export interface SearchResultMetadata {
  chunkIndex?: number;
  totalChunks?: number;
  [key: string]: unknown;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  filename: string;
  category: string | null;
  content: string;
  score: number;
  distance?: number;
  metadata?: SearchResultMetadata | null;
}

export interface AskAIResponse {
  query: string;
  answer: string;
  citations: Array<{
    documentId: string;
    filename: string;
    content: string;
    score: number;
  }>;
  confidence: number;
  searchMethod: string;
  retrievedCount: number;
}

export interface DuplicateWarning {
  duplicateType: "exact" | "near-duplicate";
  message: string;
  existingDocument: {
    id: string;
    filename: string;
    uploadedAt: Date;
    uploadedBy: string;
    uploaderName?: string;
    similarity?: number;
  };
  pendingUpload: FormData;
}

export interface FilterState {
  dateRange: { from: Date | null; to: Date | null };
  uploaders: string[];
  qualityRanges: ("excellent" | "good" | "fair" | "poor" | "unrated")[];
  usageLevels: ("high" | "low" | "none")[];
  fileTypes: string[];
  categories: string[];
  languages: string[];
  ocrStatus: ("processed" | "not_processed" | "failed")[];
}

export type AccessLevel = "public" | "internal" | "restricted";

export interface QualityBreakdown {
  completeness?: number;
  citations?: number;
  freshness?: number;
  usage?: number;
  metadata?: number;
  structure?: number;
  readability?: number;
  total?: number;
}

export interface DocumentMetadata {
  ocr?: OCRData;
  qualityBreakdown?: QualityBreakdown;
  [key: string]: unknown;
}

export interface DocumentUpdateData {
  category?: string | null;
  tags?: string[];
  accessLevel?: AccessLevel;
  folderPath?: string;
}

export interface BulkUploadResultClassification {
  category: string;
  tags: string[];
  language: string;
  documentType: string;
}

export interface BulkUploadResult {
  filename: string;
  status: "success" | "error" | "duplicate";
  error?: string;
  classification?: BulkUploadResultClassification;
}

export interface UploadError extends Error {
  isDuplicate?: boolean;
  duplicateType?: "exact" | "near-duplicate";
  existingDocument?: {
    id: string;
    filename: string;
    uploadedAt: Date;
    uploadedBy: string;
    uploaderName?: string;
    similarity?: number;
  };
  pendingUpload?: FormData;
}

export interface FileWithPath extends File {
  readonly webkitRelativePath: string;
}
