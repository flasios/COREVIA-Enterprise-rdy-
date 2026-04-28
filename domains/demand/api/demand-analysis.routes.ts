/**
 * Demand Analysis Routes
 * 
 * API endpoints for AI-powered demand analysis and business case generation
 * 
 * Enhanced Version: Production-optimized with comprehensive error handling,
 * validation, rate limiting, caching, audit logging, and monitoring
 */

import { Router, Request, Response, NextFunction } from "express";
import type { DemandStorageSlice } from "../application/buildDeps";
import { buildDemandDeps } from "../application/buildDeps";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { LegacyDemandAnalysisEngine } from "../application";
import { z } from 'zod';
import { logger } from "@platform/logging/Logger";

import { createHash } from "node:crypto";

function isResponseClosed(res: Response): boolean {
  return res.headersSent || res.writableEnded || res.destroyed;
}

function isSovereignLocalClassification(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "confidential"
    || normalized === "secret"
    || normalized === "top_secret"
    || normalized === "top-secret"
    || normalized === "sovereign";
}

function resolveDemandAnalysisSoftTimeoutMs(classification?: string): number {
  const defaultTimeoutMs = isSovereignLocalClassification(classification) ? 120_000 : 45_000;
  const raw = Number(process.env.COREVIA_DEMAND_ANALYSIS_SOFT_TIMEOUT_MS);
  if (!Number.isFinite(raw)) {
    return defaultTimeoutMs; // Sovereign engines (especially RunPod GPU) need time for complex generation.
  }
  return Math.max(5_000, Math.floor(raw));
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  MIN_OBJECTIVE_LENGTH: 10,
  MAX_OBJECTIVE_LENGTH: 5000,
  MAX_CONTEXT_LENGTH: 10000,
  RATE_LIMIT: 50, // requests per window
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute
  CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
  MAX_CACHE_SIZE: 500,
} as const;

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const generateFieldsSchema = z.object({
  businessObjective: z.string()
    .min(CONFIG.MIN_OBJECTIVE_LENGTH, `Business objective must be at least ${CONFIG.MIN_OBJECTIVE_LENGTH} characters`)
    .max(CONFIG.MAX_OBJECTIVE_LENGTH, `Business objective cannot exceed ${CONFIG.MAX_OBJECTIVE_LENGTH} characters`)
    .trim(),
  organizationName: z.string().optional(),
  department: z.string().optional(),
  requestorName: z.string().optional(),
  requestorEmail: z.string().optional(),
  industryType: z.string().optional(),
  urgency: z.string().optional(),
  userId: z.string().optional(),
  accessLevel: z.string().optional(),
  dataClassification: z.string().optional(),
  additionalContext: z.record(z.unknown()).optional().default({}),
  generationMode: z.enum(['prompt_on_fallback', 'allow_fallback_template', 'ai_only']).optional().default('ai_only'),
});

const enhanceObjectiveSchema = z.object({
  objective: z.string()
    .min(CONFIG.MIN_OBJECTIVE_LENGTH, `Objective must be at least ${CONFIG.MIN_OBJECTIVE_LENGTH} characters`)
    .max(CONFIG.MAX_OBJECTIVE_LENGTH, `Objective cannot exceed ${CONFIG.MAX_OBJECTIVE_LENGTH} characters`)
    .trim(),
});

const classifyRequestSchema = z.object({
  businessObjective: z.string()
    .min(1, "Business objective is required")
    .max(CONFIG.MAX_OBJECTIVE_LENGTH),
  additionalContext: z.record(z.unknown()).optional().default({}),
  generationMode: z.enum(['prompt_on_fallback', 'allow_fallback_template', 'ai_only']).optional().default('ai_only'),
});

const comprehensiveAnalysisSchema = z.object({
  businessObjective: z.string()
    .min(CONFIG.MIN_OBJECTIVE_LENGTH, "Business objective is required")
    .max(CONFIG.MAX_OBJECTIVE_LENGTH),
  demandType: z.string().optional(),
  priorityLevel: z.string().optional(),
  estimatedBudget: z.number().optional(),
  targetDate: z.string().optional(),
  stakeholders: z.array(z.string()).optional(),
  additionalContext: z.record(z.unknown()).optional(),
});

const generateFieldsStatusSchema = z.object({
  decisionSpineId: z.string().min(1, "decisionSpineId is required"),
  businessObjective: z.string().optional().default(""),
});

// ============================================================================
// TYPES
// ============================================================================

interface CachedResult {
  data: Record<string, unknown>;
  timestamp: number;
}

interface DemandAnalysisResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  provider?: string;
  failureKind?: string;
  failureDetails?: Record<string, unknown>;
  cached?: boolean;
  processingTime?: number;
  [key: string]: unknown;
}

type DecisionFeedbackPayload = {
  decisionId?: string;
  status?: string;
  correlationId?: string;
  missingFields: string[];
  requiredInfo: Array<Record<string, unknown>>;
  completenessScore: number | null;
};

type EngineTelemetryPayload = {
  currentLayer?: number;
  decisionStatus?: string;
  finalStatus?: string;
  classificationLevel?: string;
  riskLevel?: string;
  allowExternalModels?: boolean;
  allowCloudProcessing?: boolean;
  primaryEngineKind?: string;
  primaryPluginId?: string;
  primaryPluginName?: string;
  redactionMode?: string;
  orchestrationPlanned: boolean;
  reasoningCompleted: boolean;
  usedHybridEngine?: boolean;
  usedInternalEngine?: boolean;
};

type DemandFieldsStatusResolution = {
  pending: boolean;
  found: boolean;
  data?: Record<string, unknown>;
  artifactStatus?: string;
  artifactVersion?: number;
  requiresClarification?: boolean;
  currentLayer?: number;
  brainStatus?: string;
  finalStatus?: string;
  decisionFeedback?: DecisionFeedbackPayload;
  engineTelemetry?: EngineTelemetryPayload;
};

type FailurePromptInput = {
  error?: string;
  failureKind?: string;
  failureDetails?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {

  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(String).filter(Boolean);
}

function toRecordList(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord);
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function pickFirstRecord(...values: unknown[]): Record<string, unknown> {
  for (const value of values) {
    if (isRecord(value)) {
      return value;
    }
  }

  return {};
}

function pickFirstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (isString(value)) {
      return value;
    }
  }

  return undefined;
}

function normalizeCompletenessScore(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeDecisionFeedbackPayload(decision: unknown): DecisionFeedbackPayload | undefined {
  if (!isRecord(decision)) {
    return undefined;
  }

  const nestedDecision = isRecord(decision.decision) ? decision.decision : {};
  const nestedContext = pickFirstRecord(decision.context, nestedDecision.context);

  const missingFields = toStringList(nestedContext.missingFields);
  const requiredInfo = toRecordList(nestedContext.requiredInfo);
  const completenessScoreRaw = normalizeCompletenessScore(nestedContext.completenessScore);
  const status = pickFirstString(nestedDecision.status, decision.status);
  const hasStructuredFeedback =
    missingFields.length > 0
    || requiredInfo.length > 0
    || completenessScoreRaw !== null
    || Boolean(status);

  if (!hasStructuredFeedback) {
    return undefined;
  }

  const completenessScore = completenessScoreRaw === null ? null : Number(completenessScoreRaw);

  return {
    decisionId: pickFirstString(nestedDecision.id, decision.id),
    status,
    correlationId: pickFirstString(nestedDecision.correlationId, decision.correlationId),
    missingFields,
    requiredInfo,
    completenessScore,
  };
}

function decisionFeedbackRequiresClarification(decisionFeedback?: DecisionFeedbackPayload): boolean {
  if (!decisionFeedback) {
    return false;
  }

  if (decisionFeedback.status === 'needs_info') {
    return true;
  }

  return decisionFeedback.missingFields.length > 0 || decisionFeedback.requiredInfo.length > 0;
}

const ACTIVE_DECISION_STATUSES = new Set([
  'pending',
  'processing',
  'reasoning',
  'running',
  'in_progress',
  'needs_info',
  'queued',
  'awaiting_input',
]);

function normalizeDecisionStatusValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function isDecisionStillPending(status: unknown, finalStatus: unknown): boolean {
  const normalizedFinalStatus = normalizeDecisionStatusValue(finalStatus);
  if (normalizedFinalStatus) {
    return ACTIVE_DECISION_STATUSES.has(normalizedFinalStatus);
  }

  const normalizedStatus = normalizeDecisionStatusValue(status);
  if (normalizedStatus) {
    return ACTIVE_DECISION_STATUSES.has(normalizedStatus);
  }

  return true;
}

function getLatestLayerAuditEventData(decision: unknown, layer: number): Record<string, unknown> | undefined {
  if (!isRecord(decision) || !Array.isArray(decision.auditEvents)) {
    return undefined;
  }

  const matches = decision.auditEvents.filter((event) => {
    if (!isRecord(event) || !isRecord(event.payload)) {
      return false;
    }

    return event.payload.layer === layer;
  });

  if (matches.length === 0) {
    return undefined;
  }

  const latest = matches.at(-1);
  if (!isRecord(latest) || !isRecord(latest.payload)) {
    return undefined;
  }

  return isRecord(latest.payload.eventData) ? latest.payload.eventData : undefined;
}

function extractEngineTelemetry(decision: unknown, currentLayer?: number): EngineTelemetryPayload | undefined {
  if (!isRecord(decision)) {
    if (currentLayer === undefined) {
      return undefined;
    }

    return {
      currentLayer,
      orchestrationPlanned: false,
      reasoningCompleted: false,
    };
  }

  const l2Audit = getLatestLayerAuditEventData(decision, 2);
  const l5Audit = getLatestLayerAuditEventData(decision, 5);
  const l6Audit = getLatestLayerAuditEventData(decision, 6);
  const orchestration = isRecord(decision.orchestration) ? decision.orchestration : {};
  const routing = isRecord(orchestration.routing) ? orchestration.routing : {};
  const constraints = isRecord(l2Audit?.constraints) ? l2Audit.constraints : undefined;
  const primaryEngineKind = pickFirstString(routing.primaryEngineKind, l5Audit?.primaryEngineKind);
  const primaryPluginId = pickFirstString(routing.primaryPluginId, l5Audit?.primaryPluginId);
  const primaryPluginName = pickFirstString(routing.primaryPluginName, l5Audit?.primaryPluginName);
  const redactionMode = pickFirstString(orchestration.redactionMode, l5Audit?.redactionMode);
  const decisionStatus = pickFirstString(decision.status);
  const finalStatus = pickFirstString(decision.finalStatus);
  const classificationLevel = pickFirstString(l2Audit?.level);
  const riskLevel = pickFirstString(l2Audit?.riskLevel);
  const allowExternalModels = readOptionalBoolean(constraints?.allowExternalModels);
  const allowCloudProcessing = readOptionalBoolean(constraints?.allowCloudProcessing);
  const usedHybridEngine = readOptionalBoolean(l6Audit?.usedHybridEngine);
  const usedInternalEngine = readOptionalBoolean(l6Audit?.usedInternalEngine);

  const telemetry: EngineTelemetryPayload = {
    currentLayer,
    decisionStatus,
    finalStatus,
    classificationLevel,
    riskLevel,
    allowExternalModels,
    allowCloudProcessing,
    primaryEngineKind,
    primaryPluginId,
    primaryPluginName,
    redactionMode,
    orchestrationPlanned: Boolean(l5Audit || Object.keys(orchestration).length > 0),
    reasoningCompleted: Boolean(l6Audit),
    usedHybridEngine,
    usedInternalEngine,
  };

  return telemetry;
}

function resolveDemandBrainState(decision: unknown, highestLayer: number) {
  const decisionRecord = isRecord(decision) ? decision : {};
  const decisionStatus = pickFirstString(decisionRecord.status);
  const finalStatus = pickFirstString(decisionRecord.finalStatus);
  const currentLayer = highestLayer > 0 ? highestLayer : undefined;
  const found = highestLayer > 0 || Object.keys(decisionRecord).length > 0;
  const pending = highestLayer > 0 && isDecisionStillPending(decisionStatus, finalStatus);

  return {
    currentLayer,
    brainStatus: decisionStatus,
    finalStatus,
    found,
    pending,
  };
}

function buildClarificationDemandState(
  baseState: ReturnType<typeof resolveDemandBrainState>,
  params: {
    data?: Record<string, unknown>;
    artifactStatus?: string;
    artifactVersion?: number;
    decisionFeedback?: DecisionFeedbackPayload;
    engineTelemetry?: EngineTelemetryPayload;
  },
): DemandFieldsStatusResolution {
  return {
    pending: false,
    found: true,
    requiresClarification: true,
    currentLayer: baseState.currentLayer,
    brainStatus: baseState.brainStatus || 'needs_info',
    finalStatus: baseState.finalStatus,
    data: params.data,
    artifactStatus: params.artifactStatus,
    artifactVersion: params.artifactVersion,
    decisionFeedback: params.decisionFeedback,
    engineTelemetry: params.engineTelemetry,
  };
}

function normalizeClassificationConfidence(value: number): number {
  if (value > 0 && value <= 1) {
    return Math.round(value * 100);
  }

  return Math.round(value);
}

function buildClarificationSuccessPayload(params: {
  state: DemandFieldsStatusResolution;
  decisionSpineId: string;
  data?: Record<string, unknown>;
  responseTime?: number;
  cached: boolean;
  message: string;
}) {
  const { state, decisionSpineId, data, responseTime, cached, message } = params;

  const payload: Record<string, unknown> = {
    pending: false,
    requiresClarification: true,
    generationBlocked: false,
    data,
    provider: 'brain',
    decisionSpineId,
    currentLayer: state.currentLayer,
    brainStatus: state.brainStatus,
    finalStatus: state.finalStatus,
    decisionFeedback: state.decisionFeedback,
    engineTelemetry: state.engineTelemetry,
    cached,
    message,
  };

  if (responseTime === undefined) {
    return payload;
  }

  payload.responseTime = responseTime;

  return payload;
}

function buildPendingStateResponsePayload(
  state: DemandFieldsStatusResolution,
  decisionSpineId: string,
  responseTime: number,
) {
  return {
    pending: true,
    decisionSpineId,
    provider: 'brain',
    currentLayer: state.currentLayer,
    brainStatus: state.brainStatus,
    decisionFeedback: state.decisionFeedback,
    engineTelemetry: state.engineTelemetry,
    responseTime,
    message: 'COREVIA Brain is still completing governed demand generation. Poll the status endpoint for the finalized artifact.',
  };
}

function resolveFailureKind(result: FailurePromptInput): string {
  return typeof result.failureKind === 'string' ? result.failureKind : 'provider_unavailable';
}

function buildFallbackPrompt(result: FailurePromptInput, operation: 'generate' | 'classify') {
  const failureKind = resolveFailureKind(result);
  const fallbackReason = result.error || 'AI provider unavailable';

  if (failureKind === 'policy_blocked' || failureKind === 'classification_blocked') {
    return {
      failureKind,
      fallbackReason,
      failureDetails: result.failureDetails,
      message:
        operation === 'generate'
          ? 'COREVIA governance classified this demand for local-only processing. Engine A remains allowed, but any external or hybrid AI path is blocked. Complete the missing context and continue on the governed internal path.'
          : 'COREVIA governance classified this demand for local-only processing. Engine A remains allowed, but any external or hybrid AI path is blocked. Continue on the governed internal path.'
    };
  }

  return {
    failureKind,
    fallbackReason,
    failureDetails: result.failureDetails,
    message:
      operation === 'generate'
        ? 'AI generation could not complete. No template fallback was applied.'
        : 'AI classification could not complete. No template fallback was applied.'
  };
}

function normalizeArrayValue(item: unknown): string {
  if (typeof item === 'string') {
    return item;
  }

  if (typeof item === 'number' || typeof item === 'boolean' || typeof item === 'bigint') {
    return String(item);
  }

  if (item !== null && typeof item === 'object') {
    return JSON.stringify(item);
  }

  return '';
}

function countListEntries(value: unknown): number {
  return Array.isArray(value)
    ? value.map(normalizeArrayValue).map((item) => item.trim()).filter(Boolean).length
    : 0;
}

function isFallbackMeta(meta: unknown): boolean {
  return isRecord(meta) && meta.fallback === true;
}

function unwrapDemandFieldsPayload(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) {
    return {};
  }

  const nestedContent = raw.content;
  if (isRecord(nestedContent) && (
    typeof nestedContent.enhancedBusinessObjective === 'string'
    || typeof nestedContent.suggestedProjectName === 'string'
    || typeof nestedContent.currentChallenges === 'string'
    || Array.isArray(nestedContent.expectedOutcomes)
  )) {
    return nestedContent;
  }

  return raw;
}

function isFallbackDemandDraft(raw: unknown): boolean {
  const payload = unwrapDemandFieldsPayload(raw);
  return isFallbackMeta(payload.meta);
}

function getGeneratedArtifacts(payload: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const advisoryPayload =
    (payload.advisory as Record<string, unknown> | undefined) ||
    (payload.advisoryPackage as Record<string, unknown> | undefined) ||
    (payload.advisory_package as Record<string, unknown> | undefined) ||
    (payload.advisory_package_data as Record<string, unknown> | undefined) ||
    ((payload.decision as Record<string, unknown> | undefined)?.advisory as Record<string, unknown> | undefined) ||
    ((payload.decision as Record<string, unknown> | undefined)?.advisoryPackage as Record<string, unknown> | undefined) ||
    ((payload.decision as Record<string, unknown> | undefined)?.advisory_package as Record<string, unknown> | undefined) ||
    ((payload.decision as Record<string, unknown> | undefined)?.advisory_package_data as Record<string, unknown> | undefined) ||
    (payload.generatedArtifacts ? payload : null);

  return (advisoryPayload?.generatedArtifacts as Record<string, unknown> | undefined) ||
    (advisoryPayload === payload ? (payload.generatedArtifacts as Record<string, unknown> | undefined) : undefined) ||
    null;
}

function getDeferredDemandFieldsDraft(payload: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  const generatedArtifacts = getGeneratedArtifacts(payload);

  return (generatedArtifacts?.DEMAND_FIELDS as Record<string, unknown> | undefined) ||
    (generatedArtifacts?.demand_fields as Record<string, unknown> | undefined) ||
    (generatedArtifacts?.demandFields as Record<string, unknown> | undefined) ||
    null;
}

function buildGenerateFieldsCacheKey(data: z.infer<typeof generateFieldsSchema>): Record<string, unknown> {
  const additionalContext = buildGenerateFieldsAdditionalContext(data);

  return {
    businessObjective: data.businessObjective.trim().toLowerCase(),
    organizationName: data.organizationName?.trim().toLowerCase() || '',
    department: data.department?.trim().toLowerCase() || '',
    requestorName: data.requestorName?.trim().toLowerCase() || '',
    requestorEmail: data.requestorEmail?.trim().toLowerCase() || '',
    industryType: data.industryType?.trim().toLowerCase() || '',
    urgency: data.urgency?.trim().toLowerCase() || '',
    accessLevel: data.accessLevel?.trim().toLowerCase() || '',
    dataClassification: data.dataClassification?.trim().toLowerCase() || '',
    additionalContext,
  };
}

function buildGenerateFieldsAdditionalContext(data: z.infer<typeof generateFieldsSchema>): Record<string, unknown> {
  return {
    ...(data.additionalContext || {}),
    ...(data.organizationName ? { organizationName: data.organizationName } : {}),
    ...(data.department ? { department: data.department } : {}),
    ...(data.requestorName ? { requestorName: data.requestorName } : {}),
    ...(data.requestorEmail ? { requestorEmail: data.requestorEmail } : {}),
    ...(data.industryType ? { industryType: data.industryType } : {}),
    ...(data.urgency ? { urgency: data.urgency } : {}),
  };
}

function analyzeDemandFieldsQuality(data: Record<string, unknown>, objective: string): { cacheable: boolean; score: number; reasons: string[] } {
  const trimmedObjective = objective.trim();
  const normalizedObjective = trimmedObjective.toLowerCase();
  const suggestedProjectName = typeof data.suggestedProjectName === 'string' ? data.suggestedProjectName.trim() : '';
  const enhancedBusinessObjective = typeof data.enhancedBusinessObjective === 'string' ? data.enhancedBusinessObjective.trim() : '';
  const currentChallenges = typeof data.currentChallenges === 'string' ? data.currentChallenges.trim() : '';
  const timeframe = typeof data.timeframe === 'string' ? data.timeframe.trim() : '';
  const budgetRange = typeof data.budgetRange === 'string' ? data.budgetRange.trim() : '';
  const department = typeof data.department === 'string' ? data.department.trim() : '';
  const industryType = typeof data.industryType === 'string' ? data.industryType.trim() : '';
  const genericChallengePrefix = `current operational challenges related to: ${normalizedObjective}`;

  const totalListEntries = [
    data.expectedOutcomes,
    data.successCriteria,
    data.stakeholders,
    data.riskFactors,
    data.constraints,
    data.integrationRequirements,
    data.complianceRequirements,
    data.existingSystems,
    data.assumptions,
  ].reduce<number>((sum, value) => sum + countListEntries(value), 0);

  const scoreSignals = {
    meaningfulTitle:
      suggestedProjectName.length >= 6 &&
      !/^(untitled|strategic initiative)$/i.test(suggestedProjectName),
    rewrittenObjective:
      enhancedBusinessObjective.length >= Math.max(trimmedObjective.length + 40, 120) &&
      enhancedBusinessObjective.toLowerCase() !== normalizedObjective,
    substantiveChallenges:
      currentChallenges.length >= 120 &&
      currentChallenges.toLowerCase() !== genericChallengePrefix &&
      !currentChallenges.toLowerCase().startsWith(genericChallengePrefix),
    deliveryEnvelope: Boolean(timeframe) && Boolean(budgetRange),
    structuredCoverage: totalListEntries >= 8,
    contextualOwnership: Boolean(department) || Boolean(industryType),
  };

  const score = Object.values(scoreSignals).filter(Boolean).length;
  const reasons = Object.entries(scoreSignals)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    cacheable: score >= 4,
    score,
    reasons,
  };
}

function normalizeBudgetMultiplier(lowerBudget: string): number {
  if (/billion|\bb\b/.test(lowerBudget)) {
    return 1_000_000_000;
  }

  if (/million|\bm\b/.test(lowerBudget)) {
    return 1_000_000;
  }

  if (/thousand|\bk\b/.test(lowerBudget)) {
    return 1_000;
  }

  return 1;
}

function firstStringValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return '';
}

function resolveNumericValue(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number') {
      return value;
    }
  }

  return undefined;
}

function resolveObjectiveText(body: Record<string, unknown>): string {
  if (typeof body.businessObjective === 'string') {
    return body.businessObjective;
  }

  if (typeof body.objective === 'string') {
    return body.objective;
  }

  return '';
}

async function withSoftTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`${label} soft timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Generate a stable decision spine ID per demand request.
 * Same materially equivalent demand context within a day → same spine.
 * This ensures generate-fields + classify share a single spine.
 */
function stableDemandSpineId(businessObjective: string, userId: string, context: Record<string, unknown> = {}): string {
  const day = new Date().toISOString().slice(0, 10);
  const normalizedContext = {
    organizationName: typeof context.organizationName === 'string' ? context.organizationName.trim().toLowerCase() : '',
    department: typeof context.department === 'string' ? context.department.trim().toLowerCase() : '',
    requestorName: typeof context.requestorName === 'string' ? context.requestorName.trim().toLowerCase() : '',
    requestorEmail: typeof context.requestorEmail === 'string' ? context.requestorEmail.trim().toLowerCase() : '',
    industryType: typeof context.industryType === 'string' ? context.industryType.trim().toLowerCase() : '',
    urgency: typeof context.urgency === 'string' ? context.urgency.trim().toLowerCase() : '',
    accessLevel: typeof context.accessLevel === 'string' ? context.accessLevel.trim().toLowerCase() : '',
    dataClassification: typeof context.dataClassification === 'string' ? context.dataClassification.trim().toLowerCase() : '',
  };
  const digest = createHash("sha256")
    .update(JSON.stringify({ businessObjective: businessObjective.trim().toLowerCase(), userId, day, context: normalizedContext }))
    .digest("hex")
    .slice(0, 16);
  return `DSP-DEMAND-${day}-${digest}`;
}

// ============================================================================
// ROUTE FACTORY
// ============================================================================

export function createDemandAnalysisRoutes(storage: DemandStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const brain = buildDemandDeps(storage).brain;
  const demandAnalysisService = new LegacyDemandAnalysisEngine();

  /**
   * Normalize demand fields from brain artifact content.
   * Maps common LLM field name variants to the exact names the client expects.
   */
  const normalizeDemandFields = (raw: Record<string, unknown>, objective: string): Record<string, unknown> => {
    const knownIndustryTypes = new Set([
      'government',
      'semi-government',
      'private-sector',
      'public-private-partnership',
      'non-profit',
      'healthcare',
      'finance',
      'defense',
      'education',
      'infrastructure',
      'technology',
      'tourism',
      'real_estate',
      'transport',
      'energy',
    ]);

    const s = (key: string, ...alts: string[]): string => {
      for (const k of [key, ...alts]) {
        const v = raw[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      return '';
    };

    const arr = (key: string, ...alts: string[]): string[] => {
      for (const k of [key, ...alts]) {
        const v = raw[k];
        if (Array.isArray(v)) {
          return v.map(normalizeArrayValue);
        }
      }
      return [];
    };

    const text = (key: string, ...alts: string[]): string => {
      const str = s(key, ...alts);
      if (str) return str;
      const items = arr(key, ...alts).map(item => item.trim()).filter(Boolean);
      return items.join('\n');
    };

    const rawIndustryType = s('industryType', 'industry_type', 'sector', 'domain').toLowerCase().replaceAll(/\s+/g, '-');
    const industryType = (() => {
      if (knownIndustryTypes.has(rawIndustryType)) return rawIndustryType;
      if (rawIndustryType === 'government' || rawIndustryType === 'public-sector') return 'government';
      if (rawIndustryType === 'private' || rawIndustryType === 'private-sector') return 'private-sector';
      return '';
    })();

    const derivedDepartment = (() => {
      const explicit = s('department', 'businessUnit', 'business_unit', 'ownerDepartment', 'owner_department');
      if (explicit) return explicit;
      const body = `${objective} ${industryType}`.toLowerCase();
      if (/(permit|approval|licen[cs]e|inspection|case[- ]management)/i.test(body)) return 'Permits and Approvals';
      if (/(security|classified|audit|compliance|identity|access)/i.test(body)) return 'Information Security and Compliance';
      if (/(document|records|archive)/i.test(body)) return 'Records and Document Management';
      if (industryType === 'government') return 'Operations';
      return '';
    })();

    const normalizedBudgetRange = (() => {
      const rawBudget = s('budgetRange', 'budget_range', 'estimatedBudget', 'estimated_budget');
      if (!rawBudget) return '';
      const lower = rawBudget.toLowerCase();
      if (/(tbd|unknown|to be determined)/i.test(lower)) return 'tbd';

      const numbers = lower.replaceAll(',', '').match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
      if (numbers.length === 0) return rawBudget;

      const multiplier = normalizeBudgetMultiplier(lower);

      const highest = Math.max(...numbers) * multiplier;
      if (highest < 100_000) return 'under-100k';
      if (highest <= 500_000) return '100k-500k';
      if (highest <= 1_000_000) return '500k-1m';
      if (highest <= 5_000_000) return '1m-5m';
      if (highest <= 15_000_000) return '5m-15m';
      return 'over-15m';
    })();

    return {
      organizationName: s('organizationName', 'organization_name', 'organization', 'orgName', 'org_name'),
      department: derivedDepartment,
      industryType,
      enhancedBusinessObjective: s('enhancedBusinessObjective', 'enhanced_business_objective', 'businessObjective', 'business_objective', 'objective', 'description') || objective,
      suggestedProjectName: s('suggestedProjectName', 'suggested_project_name', 'projectName', 'project_name', 'title', 'name'),
      currentChallenges: text('currentChallenges', 'current_challenges', 'challenges', 'painPoints', 'pain_points', 'currentState', 'current_state', 'problems') || `Current operational challenges related to: ${objective.substring(0, 200)}. Detailed assessment pending full analysis.`,
      expectedOutcomes: arr('expectedOutcomes', 'expected_outcomes', 'outcomes', 'keyOutcomes', 'key_outcomes'),
      successCriteria: arr('successCriteria', 'success_criteria', 'criteria', 'kpis', 'KPIs'),
      timeframe: s('timeframe', 'timeline', 'duration', 'estimatedDuration', 'estimated_duration', 'estimatedTimeframe'),
      budgetRange: normalizedBudgetRange,
      stakeholders: arr('stakeholders', 'keyStakeholders', 'key_stakeholders'),
      riskFactors: arr('riskFactors', 'risk_factors', 'risks', 'keyRisks', 'key_risks'),
      constraints: arr('constraints', 'projectConstraints', 'project_constraints', 'limitations'),
      integrationRequirements: arr('integrationRequirements', 'integration_requirements', 'integrations', 'systemIntegrations'),
      complianceRequirements: arr('complianceRequirements', 'compliance_requirements', 'compliance', 'regulatoryRequirements'),
      existingSystems: arr('existingSystems', 'existing_systems', 'currentSystems', 'current_systems', 'systems'),
      assumptions: arr('assumptions'),
      requestType: s('requestType', 'request_type') || 'demand',
      classificationConfidence: resolveNumericValue(raw.classificationConfidence, raw.confidence),
      classificationReasoning: s('classificationReasoning', 'classification_reasoning', 'reasoning', 'rationale'),
    };
  };

  /**
   * Normalize classification from brain artifact content.
   */
  const normalizeClassification = (raw: Record<string, unknown>): Record<string, unknown> => {
    const requestType = firstStringValue(raw.requestType, raw.request_type, raw.type, raw.classification) || 'demand';
    const classificationLevel = firstStringValue(raw.classificationLevel, raw.classification_level, raw.dataClassification, raw.accessLevel);
    const confidenceRaw = resolveNumericValue(raw.confidence, raw.classificationConfidence) ?? 50;
    const confidence = normalizeClassificationConfidence(confidenceRaw);
    const reasoning = firstStringValue(raw.reasoning, raw.classificationReasoning, raw.explanation, raw.rationale);
    return { requestType, classificationLevel, confidence, reasoning };
  };

  const resolveArtifactStatus = (artifact: Record<string, unknown>): string =>
    typeof artifact.status === 'string' ? artifact.status : 'DRAFT';

  const resolveArtifactVersion = (artifact: Record<string, unknown>): number | undefined =>
    typeof artifact.version === 'number' ? artifact.version : undefined;

  const buildFoundOrClarification = (
    brainState: ReturnType<typeof resolveDemandBrainState>,
    clarificationRequired: boolean,
    data: Record<string, unknown>,
    artifactStatus: string,
    decisionFeedback: ReturnType<typeof normalizeDecisionFeedbackPayload>,
    engineTelemetry: ReturnType<typeof extractEngineTelemetry>,
    artifactVersion?: number,
  ): DemandFieldsStatusResolution => {
    if (clarificationRequired) {
      return buildClarificationDemandState(brainState, {
        data,
        artifactStatus,
        ...(artifactVersion !== undefined && { artifactVersion }),
        decisionFeedback,
        engineTelemetry,
      });
    }
    return {
      pending: false,
      found: true,
      data,
      artifactStatus,
      ...(artifactVersion !== undefined && { artifactVersion }),
      decisionFeedback,
      engineTelemetry,
    };
  };

  const resolveDemandFieldsStatus = async (decisionSpineId: string, objective: string): Promise<DemandFieldsStatusResolution> => {
    const artifact = await Promise.resolve(
      brain.getLatestDecisionArtifactVersion({
        decisionSpineId,
        artifactType: 'DEMAND_FIELDS',
      }),
    ).catch(() => undefined);

    const decision = await Promise.resolve(
      brain.getFullDecisionWithLayers(decisionSpineId),
    ).catch(() => undefined);
    const decisionFeedback = normalizeDecisionFeedbackPayload(decision);
    const highestLayer = await Promise.resolve(
      brain.getHighestLayerForSpine(decisionSpineId),
    ).catch(() => 0);
    const brainState = resolveDemandBrainState(decision, highestLayer);
    const engineTelemetry = extractEngineTelemetry(decision, brainState.currentLayer);
    const clarificationRequired = decisionFeedbackRequiresClarification(decisionFeedback);

    if (isRecord(artifact) && isRecord(artifact.content) && !isFallbackDemandDraft(artifact.content)) {
      return buildFoundOrClarification(
        brainState, clarificationRequired,
        normalizeDemandFields(unwrapDemandFieldsPayload(artifact.content), objective),
        resolveArtifactStatus(artifact),
        decisionFeedback, engineTelemetry,
        resolveArtifactVersion(artifact),
      );
    }

    const deferredDraft = getDeferredDemandFieldsDraft(isRecord(decision) ? decision : null);
    if (deferredDraft && !isFallbackDemandDraft(deferredDraft)) {
      return buildFoundOrClarification(
        brainState, clarificationRequired,
        normalizeDemandFields(unwrapDemandFieldsPayload(deferredDraft), objective),
        'DEFERRED',
        decisionFeedback, engineTelemetry,
      );
    }

    if (clarificationRequired) {
      return buildClarificationDemandState(brainState, {
        decisionFeedback,
        engineTelemetry,
      });
    }

    return {
      pending: brainState.pending,
      found: brainState.found,
      currentLayer: brainState.currentLayer,
      brainStatus: brainState.brainStatus || (brainState.currentLayer ? 'processing' : undefined),
      finalStatus: brainState.finalStatus,
      data: undefined,
      decisionFeedback,
      engineTelemetry,
    };
  };

  // Cache for analysis results
  const analysisCache = new Map<string, CachedResult>();

  // Rate limiting map
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

  // Statistics
  const stats = {
    totalRequests: 0,
    cacheHits: 0,
    avgResponseTime: 0,
    totalResponseTime: 0,
  };

  // ==========================================================================
  // MIDDLEWARE
  // ==========================================================================

  /**
   * Rate limiter middleware
   */
  const rateLimit = (req: Request, res: Response, next: NextFunction) => {
    const key = req.session?.userId || req.ip || 'unknown';
    const now = Date.now();
    const limit = rateLimitMap.get(key);

    if (limit && now < limit.resetAt) {
      if (limit.count >= CONFIG.RATE_LIMIT) {
        return res.status(429).json({
          success: false,
          error: "Rate limit exceeded",
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter: Math.ceil((limit.resetAt - now) / 1000),
        });
      }
      limit.count++;
    } else {
      rateLimitMap.set(key, { count: 1, resetAt: now + CONFIG.RATE_LIMIT_WINDOW });
    }

    next();
  };

  /**
   * Async handler wrapper
   */
  const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  /**
   * Audit logging middleware
   */
  const auditLog = (action: string) => (req: Request, res: Response, next: NextFunction) => {
    res.on("finish", () => {
      if (res.statusCode === 200) {
        const body = isRecord(req.body) ? req.body : {};
        const objective = resolveObjectiveText(body);
        logger.info(`[Demand Analysis Audit] ${action} by user ${req.session?.userId}:`, {
          objectiveLength: objective.length,
          timestamp: new Date().toISOString(),
        });
      }
    });
    next();
  };

  // Apply global middleware
  router.use(rateLimit);

  // ==========================================================================
  // UTILITY FUNCTIONS
  // ==========================================================================

  /**
   * Generate cache key
   */
  const generateCacheKey = (prefix: string, data: unknown): string => {
    const key = typeof data === 'string' ? data : JSON.stringify(data);
    return `${prefix}:${key.substring(0, 100)}`;
  };

  /**
   * Get cached result
   */
  const getCachedResult = (key: string): Record<string, unknown> | null => {
    const cached = analysisCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > CONFIG.CACHE_TTL_MS) {
      analysisCache.delete(key);
      return null;
    }

    return cached.data;
  };

  /**
   * Cache result
   */
  const cacheResult = (key: string, data: Record<string, unknown>): void => {
    // Implement LRU
    if (analysisCache.size >= CONFIG.MAX_CACHE_SIZE) {
      const oldestKey = analysisCache.keys().next().value;
      if (oldestKey) {
        analysisCache.delete(oldestKey);
      }
    }

    analysisCache.set(key, { data, timestamp: Date.now() });
  };

  /**
   * Update statistics
   */
  const updateStats = (responseTime: number, cacheHit: boolean = false): void => {
    stats.totalRequests++;
    if (cacheHit) stats.cacheHits++;
    stats.totalResponseTime += responseTime;
    stats.avgResponseTime = stats.totalResponseTime / stats.totalRequests;
  };

  /**
   * Standardized success response
   */
  const successResponse = <T extends Record<string, unknown>>(
    res: Response,
    data: T,
    message?: string,
    statusCode = 200,
  ) => {
    if (isResponseClosed(res)) {
      return res;
    }
    return res.status(statusCode).json({
      success: true,
      ...data,
      ...(message && { message }),
    });
  };

  const choiceResponse = (
    res: Response,
    payload: Record<string, unknown>,
    statusCode = 409,
  ) => {
    if (isResponseClosed(res)) {
      return res;
    }
    return res.status(statusCode).json(payload);
  };

  const buildChoiceFailure = (
    res: Response,
    failureInfo: Record<string, unknown>,
    mode: 'generate' | 'classify',
    responseTime: number,
  ) => {
    const fallback = buildFallbackPrompt(failureInfo, mode);
    updateStats(responseTime);
    return choiceResponse(res, {
      success: false,
      fallbackReason: fallback.fallbackReason,
      failureKind: fallback.failureKind,
      failureDetails: fallback.failureDetails,
      provider: 'none',
      responseTime,
      message: fallback.message,
    });
  };

  const resolveTimeoutFallback = async (
    res: Response,
    pendingState: DemandFieldsStatusResolution,
    spineId: string,
    startTime: number,
    message: string,
    options?: { preferPending?: boolean },
  ): Promise<Response | DemandAnalysisResult<unknown>> => {
    if (options?.preferPending && !pendingState.data) {
      const responseTime = Date.now() - startTime;
      updateStats(responseTime);
      return successResponse(
        res,
        buildPendingStateResponsePayload({
          ...pendingState,
          pending: true,
          found: true,
          brainStatus: pendingState.brainStatus || 'processing',
          finalStatus: pendingState.finalStatus,
        }, spineId, responseTime),
        undefined,
        202,
      );
    }

    if (pendingState.requiresClarification) {
      const responseTime = Date.now() - startTime;
      updateStats(responseTime);
      return successResponse(res, buildClarificationSuccessPayload({
        state: pendingState,
        decisionSpineId: spineId,
        data: pendingState.data,
        responseTime,
        cached: false,
        message: pendingState.data
          ? 'COREVIA generated a governed draft. Layer 4 review is still required before the user confirms or updates the remaining business context.'
          : 'COREVIA is still collecting the Layer 4 clarification inputs needed to finalize the governed draft.',
      }));
    }

    if (!pendingState.pending && pendingState.data) {
      const responseTime = Date.now() - startTime;
      updateStats(responseTime);
      return successResponse(res, {
        data: pendingState.data,
        provider: 'brain',
        pending: false,
        decisionSpineId: spineId,
        decisionFeedback: pendingState.decisionFeedback,
        engineTelemetry: pendingState.engineTelemetry,
        cached: false,
        responseTime,
      });
    }

    if (!pendingState.pending && pendingState.found) {
      const responseTime = Date.now() - startTime;
      updateStats(responseTime);
      return successResponse(res, {
        pending: false,
        data: pendingState.data || {},
        provider: 'brain',
        decisionSpineId: spineId,
        currentLayer: pendingState.currentLayer,
        brainStatus: pendingState.brainStatus,
        finalStatus: pendingState.finalStatus,
        decisionFeedback: pendingState.decisionFeedback,
        engineTelemetry: pendingState.engineTelemetry,
        responseTime,
        message: 'COREVIA completed the governed demand analysis, but no additional generated fields were materialized before the timeout. Continue with the current draft and confirm the remaining Layer 4 inputs manually.',
      });
    }

    if (pendingState.pending) {
      const responseTime = Date.now() - startTime;
      updateStats(responseTime);
      return successResponse(
        res,
        buildPendingStateResponsePayload(pendingState, spineId, responseTime),
        undefined,
        202,
      );
    }

    return {
      success: false,
      error: message,
      provider: 'none',
      failureKind: 'provider_unavailable',
      failureDetails: {
        timedOut: true,
        operation: 'generate-fields',
        decisionSpineId: spineId,
      },
    };
  };

  const handleCachedFields = async (
    res: Response,
    cached: Record<string, unknown>,
    cacheKey: string,
    spineId: string,
    businessObjective: string,
    startTime: number,
  ): Promise<Response | null> => {
    const cachedData = isRecord(cached.data) ? cached.data : null;
    const cachedQuality = cachedData ? analyzeDemandFieldsQuality(cachedData, businessObjective) : null;

    if (!cachedQuality?.cacheable) {
      analysisCache.delete(cacheKey);
      return null;
    }

    const cachedState = await resolveDemandFieldsStatus(spineId, businessObjective);
    updateStats(Date.now() - startTime, true);

    if (cachedState.requiresClarification) {
      return successResponse(res, buildClarificationSuccessPayload({
        state: cachedState,
        decisionSpineId: spineId,
        data: cachedState.data,
        cached: true,
        message: 'COREVIA generated a governed draft. Layer 4 review is still required before the user confirms or updates the remaining business context.',
      }));
    }

    return successResponse(res, {
      ...cached,
      cached: true,
      decisionSpineId: spineId,
      decisionFeedback: cachedState.decisionFeedback,
      engineTelemetry: cachedState.engineTelemetry,
    });
  };

  const processGeneratedFields = async (
    res: Response,
    result: DemandAnalysisResult<unknown>,
    data: z.infer<typeof generateFieldsSchema>,
    spineId: string,
    cacheKey: string,
    startTime: number,
  ): Promise<Response> => {
    const rawFieldData = unwrapDemandFieldsPayload(result.data);
    if (isFallbackDemandDraft(rawFieldData)) {
      return buildChoiceFailure(res, {
        error: 'AI generation returned fallback draft content',
        failureKind: 'degraded_ai_output',
        failureDetails: { provider: result.provider || 'brain', fallback: true },
      }, 'generate', Date.now() - startTime);
    }

    const normalizedData = normalizeDemandFields(rawFieldData, data.businessObjective);
    logger.info('[Demand Analysis] generate-fields raw keys:', Object.keys(rawFieldData));
    logger.info('[Demand Analysis] generate-fields normalized keys:', Object.keys(normalizedData));

    const quality = analyzeDemandFieldsQuality(normalizedData, data.businessObjective);
    const isBrainProvider = result.provider === 'brain';
    const qualityAcceptable = isBrainProvider ? quality.score >= 2 : quality.cacheable;
    if (!qualityAcceptable) {
      const resolvedState = await resolveDemandFieldsStatus(spineId, data.businessObjective);

      if (resolvedState.data) {
        const responseTime = Date.now() - startTime;
        updateStats(responseTime);

        if (resolvedState.requiresClarification) {
          return successResponse(res, buildClarificationSuccessPayload({
            state: resolvedState,
            decisionSpineId: spineId,
            data: resolvedState.data,
            responseTime,
            cached: false,
            message: 'COREVIA generated a governed draft from the sovereign baseline. Layer 4 review is still required before the user confirms or updates the remaining business context.',
          }));
        }

        return successResponse(res, {
          data: resolvedState.data,
          provider: 'brain',
          pending: false,
          decisionSpineId: spineId,
          decisionFeedback: resolvedState.decisionFeedback,
          engineTelemetry: resolvedState.engineTelemetry,
          artifactStatus: resolvedState.artifactStatus,
          artifactVersion: resolvedState.artifactVersion,
          cached: false,
          responseTime,
        });
      }

      logger.warn('[Demand Analysis] generate-fields produced degraded AI draft; bypassing cache', {
        objective: data.businessObjective.substring(0, 120),
        provider: result.provider,
        qualityScore: quality.score,
        qualityReasons: quality.reasons,
      });
      return buildChoiceFailure(res, {
        error: 'AI generation returned an incomplete demand draft',
        failureKind: 'degraded_ai_output',
        failureDetails: {
          provider: result.provider || 'brain',
          qualityScore: quality.score,
          qualityReasons: quality.reasons,
        },
      }, 'generate', Date.now() - startTime);
    }

    const responseTime = Date.now() - startTime;
    updateStats(responseTime);

    const resolvedState = await resolveDemandFieldsStatus(spineId, data.businessObjective);

    if (resolvedState.requiresClarification) {
      return successResponse(res, buildClarificationSuccessPayload({
        state: resolvedState,
        decisionSpineId: spineId,
        data: resolvedState.data || normalizedData,
        responseTime,
        cached: false,
        message: resolvedState.data
          ? 'COREVIA generated a governed draft. Layer 4 review is still required before the user confirms or updates the remaining business context.'
          : 'COREVIA generated demand field suggestions from the business objective. Layer 4 review will still be required before final submission.',
      }));
    }

    const normalizedResult = { ...result, data: normalizedData };
    cacheResult(cacheKey, normalizedResult as Record<string, unknown>);

    return successResponse(res, {
      ...normalizedResult,
      decisionSpineId: spineId,
      decisionFeedback: resolvedState.decisionFeedback,
      engineTelemetry: resolvedState.engineTelemetry,
      cached: false,
      responseTime,
    });
  };

  // ==========================================================================
  // ROUTES
  // ==========================================================================

  /**
   * POST /generate-fields
   * Generate demand analysis fields from business objective
   */
  router.post(
    "/generate-fields", 
    auth.requirePermission("business-case:generate"),
    auditLog('Fields Generated'),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();

      const data = generateFieldsSchema.parse(req.body);
      const userId = data.userId || req.session?.userId || 'system';
      const additionalContext = buildGenerateFieldsAdditionalContext(data);
      const spineId = stableDemandSpineId(data.businessObjective, userId, {
        ...additionalContext,
        accessLevel: data.accessLevel,
        dataClassification: data.dataClassification,
      });

      const cacheKey = generateCacheKey('fields', buildGenerateFieldsCacheKey(data));
      const cached = getCachedResult(cacheKey);

      if (cached) {
        const cachedResponse = await handleCachedFields(res, cached, cacheKey, spineId, data.businessObjective, startTime);
        if (cachedResponse) return cachedResponse;
      }

      let result: DemandAnalysisResult<unknown>;
      const classification = String(data.accessLevel || data.dataClassification || '');
      const preferPendingOnTimeout = isSovereignLocalClassification(classification);
      const generationPromise = demandAnalysisService.generateDemandFields(
        data.businessObjective,
        userId,
        data.accessLevel || data.dataClassification,
        spineId,
        data.organizationName,
        additionalContext,
      ) as Promise<DemandAnalysisResult<unknown>>;
      const trackedGenerationPromise = generationPromise.catch((error) => {
        logger.warn('[Demand Analysis] Background generate-fields execution failed after timeout handoff', {
          userId,
          spineId,
          error: error instanceof Error ? error.message : String(error),
        });

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Background demand field generation failed',
          provider: 'none',
        } satisfies DemandAnalysisResult<unknown>;
      });

      try {
        result = await withSoftTimeout(
          trackedGenerationPromise,
          resolveDemandAnalysisSoftTimeoutMs(classification),
          'Demand field generation',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Demand field generation did not finish in time';
        logger.warn('[Demand Analysis] generate-fields hit soft timeout; degrading to fallback', {
          userId,
          spineId,
          error: message,
        });

        const pendingState = await resolveDemandFieldsStatus(spineId, data.businessObjective);
        const fallbackResult = await resolveTimeoutFallback(res, pendingState, spineId, startTime, message, {
          preferPending: preferPendingOnTimeout,
        });

        if (!('success' in fallbackResult)) {
          return fallbackResult;
        }
        result = fallbackResult;
      }

      if (!result.success || !result.data) {
        return buildChoiceFailure(res, result, 'generate', Date.now() - startTime);
      }

      return processGeneratedFields(res, result, data, spineId, cacheKey, startTime);
    })
  );

  router.get(
    "/generate-fields/status",
    auth.requirePermission("business-case:generate"),
    asyncHandler(async (req, res) => {
      const query = generateFieldsStatusSchema.parse(req.query);
      const state = await resolveDemandFieldsStatus(query.decisionSpineId, query.businessObjective);

      if (state.requiresClarification) {
        return successResponse(res, {
          pending: false,
          requiresClarification: true,
          generationBlocked: false,
          data: state.data,
          provider: 'brain',
          decisionSpineId: query.decisionSpineId,
          currentLayer: state.currentLayer,
          brainStatus: state.brainStatus,
          finalStatus: state.finalStatus,
          decisionFeedback: state.decisionFeedback,
          engineTelemetry: state.engineTelemetry,
          artifactStatus: state.artifactStatus,
          artifactVersion: state.artifactVersion,
          message: state.data
            ? 'COREVIA generated a governed draft. Layer 4 review is still required before the user confirms or updates the remaining business context.'
            : 'COREVIA requires Layer 4 confirmation before the governed draft can be materialized.',
        });
      }

      if (!state.pending && state.data) {
        return successResponse(res, {
          pending: false,
          data: state.data,
          provider: 'brain',
          decisionSpineId: query.decisionSpineId,
          decisionFeedback: state.decisionFeedback,
          engineTelemetry: state.engineTelemetry,
          artifactStatus: state.artifactStatus,
          artifactVersion: state.artifactVersion,
        });
      }

      if (!state.pending && state.found) {
        return successResponse(res, {
          pending: false,
          data: state.data || {},
          provider: 'brain',
          decisionSpineId: query.decisionSpineId,
          currentLayer: state.currentLayer,
          brainStatus: state.brainStatus,
          finalStatus: state.finalStatus,
          decisionFeedback: state.decisionFeedback,
          engineTelemetry: state.engineTelemetry,
          artifactStatus: state.artifactStatus,
          artifactVersion: state.artifactVersion,
          message: 'COREVIA finalized the governed demand run without adding new generated field content. Continue with the current draft and confirm the remaining Layer 4 inputs manually.',
        });
      }

      if (state.pending) {
        return successResponse(res, {
          pending: true,
          provider: 'brain',
          decisionSpineId: query.decisionSpineId,
          currentLayer: state.currentLayer,
          brainStatus: state.brainStatus,
          finalStatus: state.finalStatus,
          decisionFeedback: state.decisionFeedback,
          engineTelemetry: state.engineTelemetry,
        }, undefined, 202);
      }

      return res.status(404).json({
        success: false,
        error: 'No in-flight demand field generation found for the provided decision spine.',
        decisionSpineId: query.decisionSpineId,
      });
    })
  );

  /**
   * POST /enhance-objective
   * Enhance a business objective with AI
   */
  router.post(
    "/enhance-objective", 
    auth.requirePermission("business-case:generate"),
    auditLog('Objective Enhanced'),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();

      const data = enhanceObjectiveSchema.parse(req.body);

      // Check cache
      const cacheKey = generateCacheKey('enhance', data.objective);
      const cached = getCachedResult(cacheKey);

      if (cached) {
        updateStats(Date.now() - startTime, true);
        return successResponse(res, { ...cached, cached: true });
      }

      const result = await demandAnalysisService.rawEnhanceObjective(data.objective);

      if (!result.success || !result.data) {
        const responseTime = Date.now() - startTime;
        updateStats(responseTime);
        return successResponse(res, {
          success: true,
          data: {
            enhancedObjective: data.objective,
            improvements: ['Template fallback used because AI provider is unavailable'],
            clarityScore: 0.6,
          },
          provider: 'template',
          fallbackUsed: true,
          fallbackReason: result.error || 'AI provider unavailable',
          cached: false,
          responseTime,
        });
      }

      // Cache the result
      cacheResult(cacheKey, result as unknown as Record<string, unknown>);

      const responseTime = Date.now() - startTime;
      updateStats(responseTime);

      successResponse(res, { 
        ...result, 
        cached: false,
        responseTime,
      });
    })
  );

  /**
   * POST /classify
   * Classify a demand request
   */
  router.post(
    "/classify", 
    auth.requirePermission("business-case:generate"),
    auditLog('Request Classified'),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();

      const data = classifyRequestSchema.parse(req.body);

      // Check cache
      const cacheKey = generateCacheKey('classify', {
        objective: data.businessObjective,
        context: data.additionalContext,
      });
      const cached = getCachedResult(cacheKey);

      if (cached) {
        updateStats(Date.now() - startTime, true);
        return successResponse(res, { ...cached, cached: true });
      }

      const classifyUserId = req.session?.userId || 'system';
      const classifySpineId = stableDemandSpineId(data.businessObjective, classifyUserId, data.additionalContext || {});

      let result: DemandAnalysisResult<unknown>;
      try {
        result = await withSoftTimeout(
          demandAnalysisService.rawClassifyRequest(
            data.businessObjective,
            data.additionalContext,
            classifySpineId
          ) as Promise<DemandAnalysisResult<unknown>>,
          resolveDemandAnalysisSoftTimeoutMs(),
          'Demand classification',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Demand classification did not finish in time';
        logger.warn('[Demand Analysis] classify hit soft timeout; degrading to fallback', {
          userId: classifyUserId,
          spineId: classifySpineId,
          error: message,
        });
        result = {
          success: false,
          error: message,
          provider: 'none',
          failureKind: 'provider_unavailable',
          failureDetails: {
            timedOut: true,
            operation: 'classify',
          },
        };
      }

      if (!result.success || !result.data) {
        const fallback = buildFallbackPrompt(result, 'classify');
        const responseTime = Date.now() - startTime;
        updateStats(responseTime);
        return choiceResponse(res, {
          success: false,
          fallbackReason: fallback.fallbackReason,
          failureKind: fallback.failureKind,
          failureDetails: fallback.failureDetails,
          provider: 'none',
          responseTime,
          message: fallback.message,
        });
      }

      // Normalize classification to expected client field names
      const normalizedData = normalizeClassification(
        isRecord(result.data) ? result.data : {}
      );
      const rawClassificationData = isRecord(result.data) ? result.data : {};
      logger.info('[Demand Analysis] classify raw keys:', Object.keys(rawClassificationData));
      logger.info('[Demand Analysis] classify normalized:', JSON.stringify(normalizedData));

      const normalizedResult = { ...result, data: normalizedData };
      cacheResult(cacheKey, normalizedResult as Record<string, unknown>);

      const responseTime = Date.now() - startTime;
      updateStats(responseTime);

      return successResponse(res, { 
        ...normalizedResult, 
        cached: false,
        responseTime,
      });
    })
  );

  /**
   * POST /comprehensive
   * Generate comprehensive demand analysis
   */
  router.post(
    "/comprehensive", 
    auth.requirePermission("business-case:generate"),
    auditLog('Comprehensive Analysis Generated'),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();

      const demandData = comprehensiveAnalysisSchema.parse(req.body);
      const normalizedDemandData = {
        ...demandData,
        stakeholders: Array.isArray(demandData.stakeholders)
          ? demandData.stakeholders.join(", ")
          : demandData.stakeholders,
      };

      // Check cache
      const cacheKey = generateCacheKey('comprehensive', demandData);
      const cached = getCachedResult(cacheKey);

      if (cached) {
        updateStats(Date.now() - startTime, true);
        return successResponse(res, { ...cached, cached: true });
      }

      const result = await demandAnalysisService.rawComprehensiveAnalysis(normalizedDemandData);

      // Cache the result
      cacheResult(cacheKey, result as unknown as Record<string, unknown>);

      const responseTime = Date.now() - startTime;
      updateStats(responseTime);

      successResponse(res, { 
        ...result, 
        cached: false,
        responseTime,
      });
    })
  );

  /**
   * POST /batch-analyze
   * Batch analyze multiple business objectives
   */
  router.post(
    "/batch-analyze",
    auth.requirePermission("business-case:generate"),
    auditLog('Batch Analysis'),
    asyncHandler(async (req, res) => {
      const batchSchema = z.object({
        objectives: z.array(z.string().min(CONFIG.MIN_OBJECTIVE_LENGTH))
          .min(1, "At least one objective is required")
          .max(10, "Maximum 10 objectives per batch"),
      });

      const data = batchSchema.parse(req.body);

      const results = await Promise.allSettled(
        data.objectives.map(objective => 
          demandAnalysisService.rawClassifyRequest(objective, {})
        )
      );

      const batchResults = results.map((result, index) => {
        const objective = data.objectives[index] ?? '';
        if (result.status === 'fulfilled') {
          return {
            objective,
            success: true,
            data: result.value,
          };
        }

        const error = result.reason instanceof Error ? result.reason.message : 'Analysis failed';
        return {
          objective,
          success: false,
          error,
        };
      });

      successResponse(res, {
        results: batchResults,
        total: data.objectives.length,
        successful: results.filter(r => r.status === 'fulfilled').length,
        failed: results.filter(r => r.status === 'rejected').length,
      });
    })
  );

  // ==========================================================================
  // UTILITY ROUTES
  // ==========================================================================

  /**
   * GET /statistics
   * Get analysis statistics
   */
  router.get(
    "/statistics",
    auth.requirePermission("business-case:generate"),
    asyncHandler(async (_req, res) => {
      successResponse(res, {
        stats: {
          ...stats,
          cacheSize: analysisCache.size,
          cacheHitRate: stats.totalRequests > 0 
            ? (stats.cacheHits / stats.totalRequests) * 100 
            : 0,
        },
      });
    })
  );

  /**
   * DELETE /cache
   * Clear analysis cache
   */
  router.delete(
    "/cache",
    auth.requirePermission("business-case:generate"),
    asyncHandler(async (_req, res) => {
      const sizeBefore = analysisCache.size;
      analysisCache.clear();

      successResponse(res, {
        message: 'Cache cleared successfully',
        itemsCleared: sizeBefore,
      });
    })
  );

  /**
   * GET /health
   * Health check endpoint
   */
  router.get("/health", asyncHandler(async (_req, res) => {
    successResponse(res, {
      status: 'healthy',
      service: 'demand-analysis',
      cacheSize: analysisCache.size,
      requestsProcessed: stats.totalRequests,
    });
  }));

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  /**
   * Global error handler for this router
   */
  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    let errorMessage = 'Unknown error';
    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === 'string') {
      errorMessage = err;
    } else if (typeof err === 'number' || typeof err === 'boolean' || typeof err === 'bigint') {
      errorMessage = String(err);
    } else if (err && typeof err === 'object') {
      try {
        errorMessage = JSON.stringify(err);
      } catch {
        errorMessage = '[unserializable error]';
      }
    }
    logger.error('[Demand Analysis] Unhandled error:', errorMessage);

    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details: err.errors,
      });
    }

    return res.status(500).json({
      success: false,
      error: errorMessage || "Internal server error",
      code: isRecord(err) && typeof err.code === "string" ? err.code : "INTERNAL_ERROR",
    });
  });

  logger.info('[Demand Analysis Routes] Loaded (Enhanced)');

  return router;
}
