/**
 * Knowledge Contracts — request/response schemas for knowledge management APIs.
 */
import { z } from "zod";

export const KnowledgeDocumentUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  fileType: z.enum(["pdf", "docx", "txt", "md", "xlsx", "pptx"]),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const KnowledgeSearchSchema = z.object({
  query: z.string().min(1).max(1000),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  category: z.string().optional(),
  fileType: z.string().optional(),
});

export const BriefingRequestSchema = z.object({
  topic: z.string().min(1),
  departments: z.array(z.string()).optional(),
  depth: z.enum(["summary", "detailed", "comprehensive"]).optional().default("summary"),
  includeRecommendations: z.boolean().optional().default(true),
});

export type KnowledgeDocumentUpload = z.infer<typeof KnowledgeDocumentUploadSchema>;
export type KnowledgeSearch = z.infer<typeof KnowledgeSearchSchema>;
export type BriefingRequest = z.infer<typeof BriefingRequestSchema>;
