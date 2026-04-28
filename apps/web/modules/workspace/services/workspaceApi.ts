import type {
  WorkspaceAgentRunRequest,
  WorkspaceAgentRunResponse,
  WorkspaceAgent,
  WorkspaceBrief,
  WorkspaceContext,
  WorkspaceDecision,
  WorkspaceEmail,
  WorkspaceSignal,
  WorkspaceTask,
  WorkspaceEmailConnection,
  WorkspaceTranslationEditableSegment,
  WorkspaceTranslationPreview,
  WorkspaceTranslationUpload,
} from "@/modules/workspace/types";
import { apiRequest } from "@/shared/lib/queryClient";

async function throwIfNotOk(response: Response): Promise<Response> {
  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response;
}

async function parseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function fetchWorkspaceJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  return parseJson<T>(await throwIfNotOk(response));
}

export async function fetchWorkspaceBrief(): Promise<WorkspaceBrief> {
  return fetchWorkspaceJson<WorkspaceBrief>("/api/intelligent-workspace/brief");
}

export async function fetchWorkspaceSignals(): Promise<WorkspaceSignal[]> {
  return fetchWorkspaceJson<WorkspaceSignal[]>("/api/intelligent-workspace/signals");
}

export async function fetchDecisionFeed(): Promise<WorkspaceDecision[]> {
  return fetchWorkspaceJson<WorkspaceDecision[]>("/api/intelligent-workspace/decisions");
}

export async function fetchWorkspaceEmails(): Promise<WorkspaceEmail[]> {
  return fetchWorkspaceJson<WorkspaceEmail[]>("/api/intelligent-workspace/emails");
}

export async function fetchWorkspaceEmailConnection(): Promise<WorkspaceEmailConnection> {
  return fetchWorkspaceJson<WorkspaceEmailConnection>("/api/intelligent-workspace/email/connection");
}

export async function connectWorkspaceExchange(): Promise<{ connectorId: string; authorizationUrl: string }> {
  const response = await apiRequest("POST", "/api/intelligent-workspace/email/exchange/connect");
  return parseJson<{ connectorId: string; authorizationUrl: string }>(response);
}

export async function fetchWorkspaceTasks(): Promise<WorkspaceTask[]> {
  return fetchWorkspaceJson<WorkspaceTask[]>("/api/intelligent-workspace/tasks");
}

export async function fetchWorkspaceContext(): Promise<WorkspaceContext> {
  return fetchWorkspaceJson<WorkspaceContext>("/api/intelligent-workspace/context");
}

export async function fetchWorkspaceAgents(): Promise<WorkspaceAgent[]> {
  return fetchWorkspaceJson<WorkspaceAgent[]>("/api/intelligent-workspace/agents");
}

export async function runWorkspaceAgent(payload: WorkspaceAgentRunRequest): Promise<WorkspaceAgentRunResponse> {
  const response = await apiRequest("POST", "/api/intelligent-workspace/agent/run", payload);
  return parseJson<WorkspaceAgentRunResponse>(response);
}

export async function fetchWorkspaceTranslationUploads(): Promise<WorkspaceTranslationUpload[]> {
  return fetchWorkspaceJson<WorkspaceTranslationUpload[]>("/api/intelligent-workspace/translation/uploads");
}

export async function uploadWorkspaceTranslationDocument(input: {
  file: File;
  sourceLanguage: string;
  targetLanguage: string;
}): Promise<WorkspaceTranslationUpload> {
  const formData = new FormData();
  formData.set("sourceLanguage", input.sourceLanguage);
  formData.set("targetLanguage", input.targetLanguage);
  formData.set("file", input.file);

  const csrfToken = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("XSRF-TOKEN="))
    ?.split("=")[1];

  const response = await fetch("/api/intelligent-workspace/translation/upload", {
    method: "POST",
    credentials: "include",
    headers: csrfToken ? { "X-CSRF-Token": decodeURIComponent(csrfToken) } : undefined,
    body: formData,
  });

  await throwIfNotOk(response);
  const payload = await parseJson<{ success: true; data: WorkspaceTranslationUpload }>(response);
  return payload.data;
}

export async function fetchWorkspaceTranslationPreview(documentId: string): Promise<WorkspaceTranslationPreview> {
  const response = await fetch(`/api/intelligent-workspace/translation/uploads/${documentId}/preview`, {
    credentials: "include",
  });

  await throwIfNotOk(response);
  const payload = await parseJson<{ success: true; data: WorkspaceTranslationPreview }>(response);
  return payload.data;
}

export async function saveWorkspaceTranslationEditedText(input: {
  documentId: string;
  translatedText: string;
}): Promise<WorkspaceTranslationPreview> {
  const response = await apiRequest("POST", `/api/intelligent-workspace/translation/uploads/${input.documentId}/edited-text`, {
    translatedText: input.translatedText,
  });
  const payload = await parseJson<{ success: true; data: WorkspaceTranslationPreview }>(response);
  return payload.data;
}

export async function saveWorkspaceTranslationEditedSegments(input: {
  documentId: string;
  segments: WorkspaceTranslationEditableSegment[];
}): Promise<WorkspaceTranslationPreview> {
  const response = await apiRequest("POST", `/api/intelligent-workspace/translation/uploads/${input.documentId}/edited-segments`, {
    segments: input.segments,
  });
  const payload = await parseJson<{ success: true; data: WorkspaceTranslationPreview }>(response);
  return payload.data;
}