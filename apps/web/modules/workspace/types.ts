export type WorkspaceModuleId =
  | "brief"
  | "email"
  | "tasks"
  | "reports"
  | "agents"
  | "knowledge"
  | "decisions"
  | "settings";

export type WorkspaceBrief = {
  emailsAnalyzed: number;
  tasksGenerated: number;
  decisionsPending: number;
  reportsDue: number;
  policyAlerts: number;
  activeWorkspaces: number;
  lastUpdated: string | null;
};

export type WorkspaceSignal = {
  id: string;
  type: "risk" | "finance" | "governance" | "delivery";
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  source: string;
};

export type WorkspaceDecision = {
  id: string;
  title: string;
  context: string;
  priority: "medium" | "high" | "critical";
  recommendation: string;
  status: string;
  serviceId: string;
  routeKey?: string;
  classification?: string | null;
  riskLevel?: string | null;
  policyVerdict?: string | null;
  owner?: string | null;
  createdAt?: string | null;
};

export type WorkspaceEmail = {
  id: string;
  sender: string;
  subject: string;
  priority: "low" | "medium" | "high";
  suggestedAction: string;
  summary: string;
  webLink?: string | null;
  receivedAt?: string | null;
};

export type WorkspaceEmailConnection = {
  provider: "exchange-online";
  available: boolean;
  connected: boolean;
  status: "needs_configuration" | "ready_to_connect" | "connected" | "error";
  connectorId: string | null;
  mailboxLabel: string;
  connectionLabel: string;
  authorizePath: string | null;
  lastError: string | null;
  lastSynced: string | null;
};

export type WorkspaceExchangeConnectResult = {
  connectorId: string;
  authorizationUrl: string;
};

export type WorkspaceTask = {
  id: string;
  task: string;
  source: "email" | "decision" | "report";
  priority: "low" | "medium" | "high";
  owner: string;
  dueLabel: string;
};

export type WorkspaceContext = {
  summary: string;
  relatedProject: string | null;
  previousDecision: string | null;
  relevantPolicy: string | null;
  knowledgeSources: string[];
  knowledgeStats?: {
    documents: number;
    briefings: number;
    graphEntities: number;
  };
};

export type WorkspaceAgent = {
  id: string;
  label: string;
  description: string;
  output: string;
  category: string;
  enabled: boolean;
  workflowSteps: Array<{
    agentId: string;
    name: string;
    category: string;
  }>;
};

export type WorkspaceAgentRunRequest = {
  agent: string;
  inputs: Record<string, unknown>;
};

export type WorkspaceAgentRunResponse = {
  status: "completed" | "failed";
  taskId: string;
  message: string;
  outputs: Array<{
    agentId: string;
    success: boolean;
    confidence: number;
    reasoning?: string;
    result: unknown;
    executionTimeMs: number;
    errors?: string[];
  }>;
  executionTimeMs: number;
};

export type WorkspaceTranslationUpload = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  documentFormat: "docx" | "pptx" | "xlsx" | "pdf" | "html" | "txt" | "md" | "unknown";
  intakeClass: "editable-structured" | "semi-structured-fixed-layout" | "ocr-path" | "plain-text";
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  sourceLanguage: string;
  targetLanguage: string;
  status: "uploaded" | "processing" | "translated" | "failed";
  storagePath: string;
  classificationLevel: "public" | "internal" | "confidential" | "sovereign";
  translatedFilename: string | null;
  translatedMimeType: string | null;
  translatedStoragePath: string | null;
  translatedAt: string | null;
  translationProvider: string | null;
  translationError: string | null;
  progressPercent: number;
  progressStage: "queued" | "analysis" | "translation" | "reconstruction" | "finalizing" | "completed" | "failed";
  progressMessage: string | null;
};

export type WorkspaceTranslationPreview = {
  documentId: string;
  translatedFilename: string;
  documentFormat: WorkspaceTranslationUpload["documentFormat"];
  html: string;
  warnings: string[];
  editableText: string;
  editableSegments: WorkspaceTranslationEditableSegment[] | null;
  canRegenerateArtifactFromEdits: boolean;
  hasSavedTextEdits: boolean;
  editableTextUpdatedAt: string | null;
  legalReview: WorkspaceTranslationLegalReview | null;
  originalHtml: string;
  originalWarnings: string[];
  originalFilename: string;
  generatedAt: string;
};

export type WorkspaceTranslationEditableSegment = {
  id: string;
  type: "title" | "heading" | "paragraph" | "list_item" | "table_cell" | "header" | "footer" | "text_frame" | "text_block";
  sourceText: string;
  translatedText: string;
  styleRef: string | null;
  order: number;
  page?: number;
  slide?: number;
  sheet?: number;
  row?: number;
  col?: number;
  translatable: boolean;
};

export type WorkspaceTranslationLegalReview = {
  summary: string;
  overallRisk: "low" | "medium" | "high";
  strengths: string[];
  clauseAssessments: Array<{
    area: string;
    status: "covered" | "attention" | "missing";
    detail: string;
    excerpt: string;
  }>;
  concerns: Array<{
    title: string;
    severity: "low" | "medium" | "high";
    excerpt: string;
    explanation: string;
    recommendation: string;
  }>;
  priorityActions: Array<{
    title: string;
    urgency: "low" | "medium" | "high";
    rationale: string;
  }>;
  suggestions: string[];
  disclaimer: string;
  provider: string;
  generatedAt: string;
};
