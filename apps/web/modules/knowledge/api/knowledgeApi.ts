/**
 * Knowledge API — Thin client wrappers for knowledge/RAG endpoints.
 *
 * No business rules.  Maps HTTP → typed responses.
 */
import { apiRequest } from "@/lib/queryClient";

export interface KnowledgeDocumentResponse {
  id: number;
  title: string;
  category: string;
  status: string;
  uploadedBy: string;
  createdAt: string;
  fileSize?: number;
  mimeType?: string;
}

/** Fetch all knowledge documents. */
export async function fetchKnowledgeDocuments(): Promise<KnowledgeDocumentResponse[]> {
  const res = await apiRequest("GET", "/api/knowledge/documents");
  return res.json();
}

/** Upload a document to the knowledge base. */
export async function uploadDocument(formData: FormData): Promise<{ id: number; success: boolean }> {
  const res = await fetch("/api/knowledge/documents/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

/** Delete a document by ID. */
export async function deleteDocument(id: number): Promise<void> {
  await apiRequest("DELETE", `/api/knowledge/documents/${id}`);
}

/** Search the knowledge base (RAG-powered). */
export async function searchKnowledge(query: string): Promise<{
  results: Array<{ id: number; title: string; relevance: number; snippet: string }>;
}> {
  const res = await apiRequest("POST", "/api/knowledge/search", { query });
  return res.json();
}
