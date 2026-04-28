import type { EaDocument, InsertEaDocument, DemandReport, ReportVersion } from "@shared/schema";
import {
  createEaDocument,
  deleteEaDocument,
  getAllEaDocuments,
  getEaDocumentsByEntry,
  updateEaVerificationStatus,
} from "@interfaces/storage/repositories/ea-registry.repository";
import {
  getDemandReport,
  getDemandReportsByWorkflowStatus,
} from "@interfaces/storage/repositories/demand.repository";
import {
  getReportVersions,
  getReportVersionsByStatus,
} from "@interfaces/storage/repositories/versioning.repository";
import { createAIService } from "@platform/ai/factory";
import { documentProcessorService } from "@domains/knowledge/application";

export type EaVerificationTable =
  | "applications"
  | "capabilities"
  | "data_domains"
  | "technology_standards"
  | "integrations";

type ExtractStructuredEntriesInput = {
  registryType: string;
  fields: string;
  example: string;
  truncatedDocument: string;
  decisionGovernance?: {
    approved: boolean;
    requestNumber?: string;
  };
};

export async function listEaDocuments(registryType: string, entryId?: string): Promise<EaDocument[]> {
  return getEaDocumentsByEntry(registryType, entryId);
}

export async function listAllEaDocuments(): Promise<EaDocument[]> {
  return getAllEaDocuments();
}

export async function createEaRegistryDocument(data: InsertEaDocument): Promise<EaDocument> {
  return createEaDocument(data);
}

export async function removeEaRegistryDocument(id: string): Promise<boolean> {
  return deleteEaDocument(id);
}

export async function setEaVerificationStatus(
  table: EaVerificationTable,
  id: string,
  status: string,
  verifiedBy?: string,
): Promise<boolean> {
  return updateEaVerificationStatus(table, id, status, verifiedBy);
}

export async function getDemandReportById(id: string): Promise<DemandReport | undefined> {
  return getDemandReport(id);
}

export async function getApprovedDemandReports(): Promise<DemandReport[]> {
  return getDemandReportsByWorkflowStatus("manager_approved");
}

export async function getVersionsForDemand(reportId: string): Promise<ReportVersion[]> {
  return getReportVersions(reportId);
}

export async function getApprovedVersionsForDemand(reportId: string): Promise<ReportVersion[]> {
  return getReportVersionsByStatus(reportId, "approved");
}

export async function extractEaDocumentText(filePath: string, fileType: string) {
  return documentProcessorService.extractText(filePath, fileType);
}

export async function extractStructuredEntriesFromDocument(
  input: ExtractStructuredEntriesInput,
): Promise<string> {
  if (input.decisionGovernance?.approved !== true) {
    throw new Error("EA structured extraction must be approved by Corevia Brain governance before calling the LLM service");
  }

  const aiService = createAIService("text");
  const systemPrompt = `You are an Enterprise Architecture analyst. You extract structured data from documents uploaded to an EA Registry.
You MUST return valid JSON only - no markdown, no explanation, no prose. Just the JSON array.
If no relevant data is found, return an empty array [].`;

  const userPrompt = `Analyze the following document and extract structured data for the "${input.registryType}" registry.

${input.fields}

Return a JSON array of objects. Example format:
${input.example}

IMPORTANT:
- Return ONLY a valid JSON array (no markdown code fences, no text before/after)
- Extract ALL relevant entries found in the document
- Use null for fields that cannot be determined
- Be precise with names and terminology from the document

--- DOCUMENT CONTENT ---
${input.truncatedDocument}
--- END DOCUMENT ---`;

  return aiService.generateText({
    messages: [{ role: "user", content: userPrompt }],
    systemPrompt,
    maxTokens: 8192,
    temperature: 0.1,
  });
}
