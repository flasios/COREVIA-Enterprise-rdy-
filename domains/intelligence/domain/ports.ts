/**
 * Intelligence Module — Domain Ports
 *
 * Pure interfaces for intelligence-layer dependencies.
 * No imports from infrastructure, DB, HTTP, or filesystem.
 */

import type {
  InsertNotification,
  InsertOrchestrationRun,
} from "@shared/schema";

export type UserId = string;

export interface WorkflowStepDto {
  action?: string;
  params?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface BrainOrchestrationResultDto {
  decisionId: string;
  correlationId: string;
  finalStatus: string;
  decision?: Record<string, unknown>;
}

export interface OrchestrationResultDto {
  classification: unknown;
  invokedAgents: unknown[];
  agentResponses: unknown[];
  timings: { totalTime: number; [k: string]: unknown };
}

export interface SynthesizedResponseDto {
  executiveSummary: string;
  agentSections: unknown[];
  citations: unknown[];
  conflicts: unknown[];
  aggregatedConfidence: number;
}

export interface AuditLogEventDto {
  storage: unknown;
  userId?: UserId | null;
  action: string;
  result: "success" | "failure";
  details?: Record<string, unknown>;
}

export interface BrainDraftRequestDto {
  decisionSpineId: string;
  serviceId: string;
  routeKey: string;
  artifactType: string;
  inputData: Record<string, unknown>;
  userId: UserId;
}

export interface ConversationMessageDto {
  role?: string;
  content?: string;
  [key: string]: unknown;
}

/* ─── Proactive Intelligence ─────────────────────────────────── */

export interface ProactiveIntelligencePort {
  getProactiveInsights(): Promise<unknown>;
  generateNotifications(userId: UserId): Promise<unknown>;
  detectAnomalies(): Promise<unknown>;
  calculateRiskScores(): Promise<unknown>;
  generateDailyBriefing(): Promise<unknown>;
  executeWorkflowChain(steps: WorkflowStepDto[], userId: UserId): Promise<unknown>;
  createAutomaticAlerts(userId: UserId): Promise<unknown>;
}

/* ─── Brain Core Operations ──────────────────────────────────── */

export interface BrainCorePort {
  /** Orchestrate a brain pipeline decision */
  executeOrchestration(
    serviceId: string,
    routeKey: string,
    input: Record<string, unknown>,
    userId: UserId,
    orgId?: string,
    opts?: Record<string, unknown>,
  ): Promise<BrainOrchestrationResultDto>;

  /** Handle a spine event */
  handleSpineEvent(event: {
    decisionSpineId: string;
    event: string;
    actorId: UserId;
    payload: Record<string, unknown>;
  }): Promise<void>;

  /** Get control-plane state */
  getControlPlaneState(): Promise<unknown>;

  /** Persist an artifact version on the decision spine */
  upsertArtifactVersion(data: {
    decisionSpineId: string;
    artifactType: string;
    subDecisionType: string;
    content: Record<string, unknown>;
    changeSummary: string;
    createdBy: UserId;
  }): Promise<unknown>;
}

/* ─── RAG Service ────────────────────────────────────────────── */

export interface RagServicePort {
  /** Run a domain-specific RAG agent */
  runAgent(
    domain: string,
    query: string,
    userId: UserId,
    options: Record<string, unknown>,
  ): Promise<unknown>;

  /** List supported agents */
  getSupportedAgents(): unknown[];
}

/* ─── Orchestration Engine ───────────────────────────────────── */

export interface OrchestrationEnginePort {
  /** Execute multi-agent orchestration */
  orchestrate(options: {
    query: string;
    userId: UserId;
    reportId?: string;
    accessLevel?: string;
    retrievalOptions?: Record<string, unknown>;
  }): Promise<OrchestrationResultDto>;
}

export interface ResponseSynthesizerPort {
  synthesize(query: string, agentResponses: unknown[]): Promise<SynthesizedResponseDto>;
}

/* ─── Audit Logger ───────────────────────────────────────────── */

export interface AuditLoggerPort {
  logEvent(event: AuditLogEventDto): Promise<void>;
}

/* ─── Email Service ──────────────────────────────────────────── */

export interface EmailServicePort {
  sendEmail(options: {
    to: string;
    from: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<boolean>;
}

/* ─── Brain Draft Artifact Generation ────────────────────────── */

export interface BrainDraftPort {
  generateBrainDraftArtifact(options: BrainDraftRequestDto): Promise<{ content: unknown }>;
}

/* ─── Analytics Service ──────────────────────────────────────── */

export interface AnalyticsServicePort {
  getAnalyticsSummary(days: number): Promise<unknown>;
  getTrends(metric: string, days: number): Promise<unknown>;
  getTopDocuments(sortBy: string, limit: number): Promise<unknown>;
  detectKnowledgeGaps(limit: number): Promise<unknown>;
  calculateROI(days: number, hourlyRate: number): Promise<unknown>;
  refreshAnalytics(): Promise<unknown>;
}

export interface PortfolioAnalyticsPort {
  getPortfolioHealth(storage: unknown): Promise<unknown>;
  getDemandForecast(storage: unknown): Promise<unknown>;
  runMonteCarloSimulation(storage: unknown, constraints: Record<string, unknown>): Promise<unknown>;
  getIntegrationStatus(storage: unknown): Promise<unknown>;
  getDemandPlanService(storage: unknown): Promise<unknown>;
}

/* ─── AI Assistant Service ───────────────────────────────────── */

export interface AIAssistantServicePort {
  quickChat(
    message: string,
    userId: UserId,
    userName: string,
    isFirstMessage: boolean,
    history: ConversationMessageDto[],
    context: string,
  ): Promise<string>;
  quickChatStream(
    message: string,
    userId: UserId,
    userName: string,
    isFirstMessage: boolean,
    history: ConversationMessageDto[],
    context: string,
    writeToken: (text: string) => void,
    onEvent?: (e: { type: 'tool_start' | 'tool_done' | 'action' | 'follow_ups' | 'file_ready'; name: string; summary?: string; items?: string[]; url?: string; filename?: string; format?: string }) => void,
    entityId?: string,
  ): Promise<void>;
  executeApprovedAction(
    prompt: string,
    userId: UserId,
    userName: string,
    context: string,
    idempotencyKey?: string,
    preselectedToolCalls?: Array<{ name: string; input: Record<string, unknown> }>,
  ): Promise<{ response: string; executedTools: string[]; skippedReason?: string }>;
  createConversation(
    userId: UserId,
    title?: string,
    mode?: string,
    contextType?: string,
    contextId?: string,
  ): Promise<unknown>;
  getConversations(userId: UserId): Promise<unknown[]>;
  getConversation(id: string): Promise<unknown | null>;
  getMessages(conversationId: string): Promise<unknown[]>;
  chat(conversationId: string, message: string, userId: UserId, userName: string): Promise<unknown>;
  archiveConversation(id: string): Promise<void>;
  getNotifications(userId: UserId, unreadOnly: boolean): Promise<unknown>;
  markNotificationRead(id: string): Promise<void>;
  dismissNotification(id: string): Promise<void>;
  getProactiveInsights(userId: UserId): Promise<unknown>;
}

/* ─── Market Research Service ────────────────────────────────── */

export interface MarketResearchPort {
  generateMarketResearch(request: Record<string, unknown>): Promise<unknown>;
}

/* ─── Coveria Intelligence ───────────────────────────────────── */

export interface CoveriaIntelligencePort {
  recordInteraction(
    userInput: string,
    coveriaResponse: string,
    meta: Record<string, unknown>,
  ): Promise<void>;
  getIntelligenceState(): Promise<unknown>;
  getPendingInsightsForUser(userId: UserId): Promise<unknown>;
  dismissInsightForUser(insightId: string, userId: UserId): Promise<boolean>;
  generateDailyBriefing(userId: UserId): Promise<unknown>;
  getResponsePrefix(data: Record<string, unknown>): string;
}

/* ─── AI Provider Health Check ───────────────────────────────── */

export interface AIProviderPort {
  isAvailable(): Promise<boolean>;
}

/* ─── Intelligence Repository (IStorage subset) ──────────────── */

export interface IntelligenceRepository {
  getUser(id: string): Promise<unknown>;
  createNotification(data: Partial<InsertNotification>): Promise<unknown>;
  getDemandReport(id: string): Promise<unknown>;
  getBusinessCaseByDemandReportId(id: string): Promise<unknown>;
  markNotificationAsRead(id: string): Promise<void>;
  markAllNotificationsAsRead(userId: UserId): Promise<void>;
  createOrchestrationRun(data: Partial<InsertOrchestrationRun>): Promise<{ id: string | number }>;
}

/* ─── AI Item Store (tasks, reminders, documents, preferences, workflows) ──── */

export interface AiItemRecord {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  isRead: boolean;
  isDismissed: boolean;
  relatedType: string | null;
  relatedId: string | null;
  actionUrl: string | null;
  createdAt: Date | null;
}

export interface AiItemStore {
  /** Create a task/reminder/document/preference/workflow record */
  create(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    priority?: string;
    relatedType?: string | null;
    relatedId?: string | null;
    actionUrl?: string | null;
  }): Promise<AiItemRecord>;

  /** Find items by user + type, ordered by createdAt DESC */
  findByUserAndType(userId: string, type: string): Promise<AiItemRecord[]>;

  /** Find a single item by id + user + type */
  findOneByIdAndUser(id: string, userId: string, type?: string): Promise<AiItemRecord | null>;

  /** Partial update of an item owned by the user */
  update(
    id: string,
    userId: string,
    data: Partial<Pick<AiItemRecord, "title" | "message" | "isDismissed" | "isRead">>,
  ): Promise<AiItemRecord | null>;

  /** Delete an item owned by the user */
  delete(id: string, userId: string): Promise<void>;

  /** Mark all unread AI notifications as read for a user */
  markAllReadByUser(userId: string): Promise<void>;
}

/* ─── Assistant Conversation Store ───────────────────────────── */

export interface AssistantConversationSummary {
  id: string;
  title: string | null;
  mode: string | null;
  contextType: string | null;
  contextId: string | null;
  updatedAt: Date | string | null;
}

export interface AssistantMessageSummary {
  id: string;
  role: string | null;
  content: string | null;
  createdAt: Date | string | null;
}

export interface AssistantConversationStore {
  createConversation(data: {
    userId: string;
    title: string;
    mode: string;
    contextType?: string;
    contextId?: string;
  }): Promise<string | null>;
  getRecentMessages(conversationId: string, limit: number): Promise<Array<{ role: "user" | "assistant"; content: string }>>;
  appendMessages(conversationId: string, messages: Array<{ role: "user" | "assistant"; content: string; model?: string }>): Promise<void>;
  listConversations(userId: string, limit: number): Promise<AssistantConversationSummary[]>;
  listMessages(conversationId: string, limit: number): Promise<AssistantMessageSummary[]>;
  getContextSummary(surface?: string, entityId?: string): Promise<Record<string, number>>;
  saveMessageFeedback(messageId: string, feedback: "up" | "down"): Promise<void>;
}

/* ─── Dashboard Read Store (cross-module aggregates) ─────────── */

export interface BrainEventSummary {
  eventType: string | null;
  decisionSpineId: string | null;
  occurredAt: Date | string | null;
  payload: Record<string, unknown> | null;
  eventId: number | string;
  correlationId: string | null;
}

export interface DashboardReadStore {
  getDemandCount(): Promise<number>;
  getCompletedDemandCount(): Promise<number>;
  getProjectCount(): Promise<number>;
  getRecentBrainEvents(hours: number, limit?: number): Promise<BrainEventSummary[]>;
  searchDemands(keywords: string[]): Promise<Array<{ id: string; suggestedProjectName: string | null; workflowStatus: string | null }>>;
  searchBrainEvents(keyword: string, limit: number): Promise<BrainEventSummary[]>;
  createAiNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    priority?: string;
    relatedType?: string | null;
    relatedId?: string | null;
    actionUrl?: string | null;
  }): Promise<AiItemRecord>;
  saveMarketResearchToBusinessCase(demandReportId: string, result: unknown): Promise<void>;
  upsertBrainArtifact(data: {
    decisionSpineId: string;
    artifactType: string;
    subDecisionType: string;
    content: Record<string, unknown>;
    changeSummary: string;
    createdBy: string;
  }): Promise<void>;
}

/* ─── Unified Notification Hub (cross-module notification aggregation) ──── */

export interface UnifiedNotifItem {
  id: string;
  source: "system" | "ai" | "tender" | "brain";
  category: string;
  title: string;
  message: string;
  priority: string;
  isRead: boolean;
  isDismissed: boolean;
  actionUrl: string | null;
  relatedType: string | null;
  relatedId: string | null;
  metadata: unknown;
  createdAt: Date | string;
}

export interface UnifiedNotificationHub {
  getSystemNotifications(userId: string, limit: number, unreadOnly: boolean): Promise<UnifiedNotifItem[]>;
  getAiNotifications(userId: string, limit: number, unreadOnly: boolean): Promise<UnifiedNotifItem[]>;
  getTenderNotifications(userId: string, limit: number, unreadOnly: boolean): Promise<UnifiedNotifItem[]>;
  getBrainEventNotifications(limit: number): Promise<UnifiedNotifItem[]>;
  markAiNotificationRead(id: string): Promise<void>;
  markTenderNotificationRead(id: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
}

// ── AI Provider Status Check ───────────────────────────────────

export interface AIProviderStatusPort {
  checkAvailability(): Promise<{
    anthropic: boolean;
    openai: boolean;
    falcon: boolean;
  }>;
}

// ── External AI Text Generation ────────────────────────────────

export interface ExternalAITextGenerationPort {
  /**
   * Generate text using the first available external AI provider.
   * Returns the raw text response and the provider name used.
   */
  generate(opts: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    jsonMode?: boolean;
  }): Promise<{ text: string; provider: string }>;
}
