import type {
  DecisionDetail,
  Service,
  Route,
  Agent,
  Policy,
  PolicyPack,
  LearningArtifact
} from "@shared/contracts/brain";

interface ApiError {
  code: string;
  message: string;
  statusCode?: number;
  correlationId?: string;
  decisionId?: string;
  details?: Record<string, unknown>;
}

class ApiRequestError extends Error implements ApiError {
  code: string;
  statusCode?: number;
  correlationId?: string;
  decisionId?: string;
  details?: Record<string, unknown>;

  constructor(params: ApiError) {
    super(params.message);
    this.name = "ApiRequestError";
    this.code = params.code;
    this.statusCode = params.statusCode;
    this.correlationId = params.correlationId;
    this.decisionId = params.decisionId;
    this.details = params.details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asRecordOrUndefined(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return asArray(value).filter((item): item is string => typeof item === "string");
}

type ContextQuality = NonNullable<DecisionDetail["contextQuality"]>;
type ContextAmbiguity = NonNullable<ContextQuality["ambiguities"]>[number];
type ContextAssumption = NonNullable<ContextQuality["assumptions"]>[number];

function normalizeClassificationLevel(value: unknown): DecisionDetail["classification"]["level"] {
  const normalized = typeof value === "string" ? value.toLowerCase() : value;
  return normalized === "public" || normalized === "internal" || normalized === "confidential" || normalized === "sovereign"
    ? normalized
    : "internal";
}

function normalizeRiskLevel(value: unknown): DecisionDetail["riskLevel"] {
  const normalized = typeof value === "string" ? value.toLowerCase() : value;
  return normalized === "low" || normalized === "medium" || normalized === "high" || normalized === "critical"
    ? normalized
    : "low";
}

function normalizeDecisionStatus(value: unknown): DecisionDetail["status"] {
  switch (value) {
    case "processing":
    case "pending_approval":
    case "approved":
    case "rejected":
    case "blocked":
    case "needs_info":
    case "actions_running":
    case "executed":
    case "completed":
    case "validation":
    case "action_execution":
    case "intake":
    case "memory":
      return value;
    default:
      return "processing";
  }
}

function normalizePolicyConstraints(value: unknown): string[] | Record<string, unknown> {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (isRecord(value)) {
    return value;
  }

  return [];
}

function normalizeMatchedPolicies(value: unknown): Array<string | Record<string, unknown>> {
  return asArray(value).map((policy) => {
    if (typeof policy === "string") {
      return policy;
    }
    if (isRecord(policy)) {
      return policy;
    }

    return "unknown-policy";
  });
}

function normalizePolicyEvaluation(value: unknown): DecisionDetail["policyEvaluation"] {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return undefined;

  return {
    verdict: asString(record.verdict, "unknown"),
    matchedPolicies: normalizeMatchedPolicies(record.matchedPolicies),
    constraints: normalizePolicyConstraints(record.constraints),
    blockReason: asOptionalString(record.blockReason),
  };
}

function buildAgentPlan(agentPlanRaw: Record<string, unknown>) {
  const allowedAgents = asStringArray(agentPlanRaw.allowedAgents);
  const mode = asOptionalString(agentPlanRaw.mode);
  const writePermissions = typeof agentPlanRaw.writePermissions === "boolean"
    ? agentPlanRaw.writePermissions
    : undefined;
  const hasAgentPlan = Object.keys(agentPlanRaw).length > 0 || allowedAgents.length > 0;

  if (!hasAgentPlan) {
    return undefined;
  }

  return {
    allowedAgents: allowedAgents.length > 0 ? allowedAgents : undefined,
    mode,
    writePermissions,
  };
}

function normalizeContextQuality(value: unknown): DecisionDetail["contextQuality"] {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return undefined;

  const rawScore = asNumber(record.completenessScore ?? record.score, 0);
  const score = rawScore > 0 && rawScore <= 1 ? rawScore * 100 : rawScore;
  const ambiguitiesRaw: Array<ContextAmbiguity | null> = asArray(record.ambiguities).map((item) => {
    const entry = asRecord(item);
    const field = asOptionalString(entry.field);
    const issue = asOptionalString(entry.issue);
    if (!field || !issue) return null;
    const suggestion = asOptionalString(entry.suggestion);
    return suggestion ? {
      field,
      issue,
      suggestion,
    } : {
      field,
      issue,
    };
  });
  const assumptionsRaw: Array<ContextAssumption | null> = asArray(record.assumptions).map((item) => {
    const entry = asRecord(item);
    const field = asOptionalString(entry.field);
    const assumedValue = asOptionalString(entry.assumedValue);
    const reason = asOptionalString(entry.reason);
    if (!field || !assumedValue || !reason) return null;
    return {
      field,
      assumedValue,
      reason,
    };
  });
  const ambiguities = ambiguitiesRaw.filter(
    (item): item is ContextAmbiguity => item !== null
  );
  const assumptions = assumptionsRaw.filter(
    (item): item is ContextAssumption => item !== null
  );

  return {
    score,
    completenessScore: score,
    missingFields: asStringArray(record.missingFields),
    ambiguities: ambiguities.length > 0 ? ambiguities : undefined,
    assumptions: assumptions.length > 0 ? assumptions : undefined,
    ready: asBoolean(record.ready, score >= 60),
  };
}

function normalizeOrchestrationPlan(value: unknown): DecisionDetail["orchestrationPlan"] {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return undefined;

  const agentPlanRaw = asRecord(record.agentPlan);
  const agentPlan = buildAgentPlan(agentPlanRaw);

  // Preserve agent objects (not just IDs) for L5 rendering
  const agentsSelectedRaw = asArray(record.agentsSelected);
  const agentsSelected = agentsSelectedRaw.length > 0
    ? agentsSelectedRaw.map((a) => {
        if (typeof a === "string") return a;
        if (isRecord(a)) return a;
        if (typeof a === "object" && a !== null) return JSON.stringify(a);
        return String(a);
      })
    : [];

  return {
    enginesUsed: asStringArray(record.enginesUsed),
    enginesEnabled: asStringArray(record.enginesEnabled),
    agentsSelected: agentsSelected as string[],
    agentPlan,
    constraints: asRecordOrUndefined(record.constraints),
    executionPlan: asRecordOrUndefined(record.executionPlan),
    // IPLAN metadata (3-engine routing)
    iplanId: asOptionalString(record.iplanId),
    iplanMode: asOptionalString(record.iplanMode),
    routing: asRecordOrUndefined(record.routing),
    primaryPlugin: asRecordOrUndefined(record.primaryPlugin),
    redactionMode: asOptionalString(record.redactionMode),
    budgets: asRecordOrUndefined(record.budgets),
    toolsAllowed: asStringArray(record.toolsAllowed),
  };
}

function normalizeAdvisory(value: unknown): DecisionDetail["advisory"] {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return undefined;

  const executiveSummaryRaw = asRecord(record.executiveSummary);
  const optionsComparison = asArray(record.optionsComparison)
    .map((item) => {
      const option = asRecord(item);
      const name = asOptionalString(option.name);
      if (!name) return null;
      return {
        name,
        pros: asStringArray(option.pros),
        cons: asStringArray(option.cons),
        risks: asStringArray(option.risks),
        cost: asString(option.cost),
      };
    })
    .filter(
      (
        item
      ): item is NonNullable<NonNullable<DecisionDetail["advisory"]>["optionsComparison"]>[number] =>
        item !== null
    );
  const risksAndControls = asArray(record.risksAndControls)
    .map((item) => {
      const riskControl = asRecord(item);
      const risk = asOptionalString(riskControl.risk);
      const mitigation = asOptionalString(riskControl.mitigation);
      if (!risk || !mitigation) return null;
      return {
        risk,
        mitigation,
        confidence: asNumber(riskControl.confidence, 0),
      };
    })
    .filter(
      (
        item
      ): item is NonNullable<NonNullable<DecisionDetail["advisory"]>["risksAndControls"]>[number] =>
        item !== null
    );
  const plannedActions = asArray(record.plannedActions)
    .map((item) => {
      const action = asRecord(item);
      const id = asOptionalString(action.id);
      const description = asOptionalString(action.description);
      const type = asOptionalString(action.type);
      if (!id || !description || !type) return null;
      return {
        id,
        description,
        type,
      };
    })
    .filter(
      (
        item
      ): item is NonNullable<NonNullable<DecisionDetail["advisory"]>["plannedActions"]>[number] =>
        item !== null
    );

  return {
    executiveSummary: {
      whatProposed: asString(executiveSummaryRaw.whatProposed),
      whyNow: asString(executiveSummaryRaw.whyNow),
      expectedOutcomes: asString(executiveSummaryRaw.expectedOutcomes),
    },
    optionsComparison,
    risksAndControls,
    assumptions: asStringArray(record.assumptions),
    plannedActions,
  };
}

function normalizeActionStatus(value: unknown): "pending" | "running" | "completed" | "failed" {
  return value === "pending" || value === "running" || value === "completed" || value === "failed"
    ? value
    : "pending";
}

function normalizeActionExecutions(value: unknown): DecisionDetail["actionExecutions"] {
  return asArray(value).map((item) => {
    const execution = asRecord(item);
    return {
      id: asString(execution.id),
      actionType: asString(execution.actionType),
      status: normalizeActionStatus(execution.status),
      logs: asStringArray(execution.logs),
      executedAt: asOptionalString(execution.executedAt),
    };
  });
}

function normalizeRetrievalLogs(value: unknown): DecisionDetail["retrievalLogs"] {
  return asArray(value).map((item) => {
    const log = asRecord(item);
    return {
      createdAt: asString(log.createdAt),
      queryText: asString(log.queryText),
      topK: asNumber(log.topK, 0),
      results: asArray(log.results).map((resultItem) => {
        const result = asRecord(resultItem);
        return {
          score: asNumber(result.score, 0),
          docName: asString(result.docName),
          chunkId: asString(result.chunkId),
          source: asString(result.source),
          snippet: asOptionalString(result.snippet),
        };
      }),
      constraintsSnapshot: {
        allowExternalModels: asBoolean(asRecord(log.constraintsSnapshot).allowExternalModels, false),
        redactSensitive: asBoolean(asRecord(log.constraintsSnapshot).redactSensitive, false),
      },
    };
  });
}

function normalizeAuditEvents(value: unknown): DecisionDetail["auditEvents"] {
  return asArray(value).map((item) => {
    const event = asRecord(item);
    return {
      at: asString(event.at ?? event.timestamp ?? event.createdAt),
      type: asString(event.type ?? event.eventType),
      summary: asString(event.summary ?? event.action),
      layerNumber: asNumber(event.layerNumber ?? event.layer, 0),
      metadata: asRecordOrUndefined(event.metadata),
      durationMs: typeof event.durationMs === "number" ? event.durationMs : undefined,
    };
  });
}

function normalizeMemoryEntries(value: unknown): DecisionDetail["memoryEntries"] {
  return asArray(value).map((item) => {
    const entry = asRecord(item);
    return {
      decisionSummary:
        typeof entry.decisionSummary === "string" ? entry.decisionSummary : null,
      evidence: entry.evidence,
      rationale: typeof entry.rationale === "string" ? entry.rationale : null,
      learningExtracted:
        typeof entry.learningExtracted === "boolean" ? entry.learningExtracted : undefined,
      learningArtifactIds:
        Array.isArray(entry.learningArtifactIds)
          ? asStringArray(entry.learningArtifactIds)
          : null,
      tags: Array.isArray(entry.tags) ? asStringArray(entry.tags) : null,
    };
  });
}

function normalizeWorkflowReadiness(value: unknown): DecisionDetail["workflowReadiness"] {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return undefined;

  return {
    message: asString(record.message),
    approvedBy:
      typeof record.approvedBy === "string" || record.approvedBy === null
        ? record.approvedBy
        : null,
    requiresVersionApproval: asBoolean(record.requiresVersionApproval, false),
    versionApproved: asBoolean(record.versionApproved, false),
    versionType:
      typeof record.versionType === "string" || record.versionType === null
        ? record.versionType
        : null,
    versionStatus:
      typeof record.versionStatus === "string" || record.versionStatus === null
        ? record.versionStatus
        : null,
    versionNumber:
      typeof record.versionNumber === "number" || record.versionNumber === null
        ? record.versionNumber
        : null,
    demandReportId:
      typeof record.demandReportId === "string" || record.demandReportId === null
        ? record.demandReportId
        : null,
    approvedAt:
      typeof record.approvedAt === "string" || record.approvedAt === null
        ? record.approvedAt
        : null,
  };
}

function normalizeLearningArtifacts(value: unknown): DecisionDetail["learningArtifacts"] {
  return asArray(value).map((item) => {
    const artifact = asRecord(item);
    const rawStatus = asString(artifact.status).toLowerCase();
    const status = rawStatus === "draft"
      || rawStatus === "active"
      || rawStatus === "in_review"
      || rawStatus === "approved"
      || rawStatus === "rejected"
      || rawStatus === "archived"
      ? rawStatus
      : "draft";

    return {
      id: asString(artifact.id),
      artifactType: asString(artifact.artifactType ?? artifact.type),
      version: asString(artifact.version, "1.0.0"),
      status,
      createdFromDecisionId: asString(artifact.createdFromDecisionId ?? artifact.sourceDecisionId),
      createdAt: asString(artifact.createdAt),
      activatedAt: asOptionalString(artifact.activatedAt),
    };
  });
}

function normalizeSpineOverview(value: unknown): SpineOverview | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const mapRecords = (items: unknown): Record<string, unknown>[] => asArray(items).map(asRecord);

  return {
    spine: asRecord(value.spine),
    subDecisions: mapRecords(value.subDecisions),
    approvals: mapRecords(value.approvals),
    executions: mapRecords(value.executions),
    lifecycleRecord: isRecord(value.lifecycleRecord) ? value.lifecycleRecord : null,
    ledger: isRecord(value.ledger) ? value.ledger : null,
    artifacts: mapRecords(value.artifacts),
  };
}

function calculateGovernanceScore(policyEval: DecisionDetail["policyEvaluation"]): number | undefined {
  if (!policyEval) {
    return undefined;
  }
  if (policyEval.verdict === "allow") {
    return 95;
  }
  if (policyEval.verdict === "conditional") {
    return 70;
  }

  return 40;
}

function normalizeClassificationConstraints(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (isRecord(value)) {
    return Object.keys(value);
  }

  return [];
}

function normalizeAuditTrailEntry(entry: unknown) {
  const rec = asRecord(entry);
  const payload = asRecord(rec.payload);
  const payloadLayer = asOptionalNumber(payload.layer);
  const actionValue = firstString(rec.action, rec.eventType, payload.eventType, rec.layer_name);
  const actorValue = firstString(rec.actor, rec.actorId, rec.actor_type);
  const timestampValue = firstString(rec.timestamp, rec.occurredAt, rec.createdAt);
  const recordLayer = asOptionalNumber(rec.layer);
  const recordLayerNumber = asOptionalNumber(rec.layerNumber);
  const layer = recordLayer ?? recordLayerNumber ?? payloadLayer;

  return {
    action: actionValue ?? "Event",
    actor: actorValue ?? "system",
    layer,
    timestamp: timestampValue ?? "",
    eventType: asOptionalString(rec.eventType),
    correlationId: asNullableString(rec.correlationId),
    payload,
  };
}

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      ...opts,
      signal: controller.signal,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...opts?.headers,
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorPayload = asRecord(await response.json().catch(() => ({})));
      throw new ApiRequestError({
        code: asString(errorPayload.code, "API_ERROR"),
        message: asString(errorPayload.message, `Request failed with status ${response.status}`),
        statusCode: response.status,
        correlationId: asOptionalString(errorPayload.correlationId),
        decisionId: asOptionalString(errorPayload.decisionId),
        details: asRecordOrUndefined(errorPayload.details),
      });
    }

    return response.json();
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (isRecord(err) && err.name === "AbortError") {
      throw new ApiRequestError({ code: "TIMEOUT", message: "Request timed out" });
    }
    throw err;
  }
}

export interface DecisionStats {
  total: number;
  pendingApproval: number;
  approved: number;
  blocked: number;
  needsInfo: number;
  processing: number;
}

export interface DecisionListItem {
  id: string;
  requestId?: string | null;
  title: string;
  serviceId: string;
  routeKey?: string;
  decisionType: string;
  currentLayer?: number;
  status: string;
  projectName: string;
  classification: string | null;
  riskLevel: string | null;
  policyOps?: {
    verdict: string;
    policiesEvaluated?: number;
  };
  owner?: string;
  updatedAt: string;
  createdAt?: string;
}

export interface SpineOverview {
  spine: Record<string, unknown>;
  subDecisions: Record<string, unknown>[];
  approvals: Record<string, unknown>[];
  executions: Record<string, unknown>[];
  lifecycleRecord?: Record<string, unknown> | null;
  ledger?: Record<string, unknown> | null;
  artifacts?: Record<string, unknown>[];
}

export async function fetchDecisions(scope?: "governance" | "reasoning" | "rag"): Promise<{ decisions: DecisionListItem[]; total: number; stats?: DecisionStats }> {
  const query = scope && scope !== "governance" ? `?scope=${encodeURIComponent(scope)}` : "";
  return apiFetch(`/api/corevia/decisions${query}`);
}

export async function fetchSpine(decisionSpineId: string): Promise<SpineOverview> {
  const response = await apiFetch<{ spineOverview: SpineOverview }>(`/api/corevia/spines/${decisionSpineId}`);
  return response.spineOverview;
}

export async function fetchDecision(id: string, useCaseType?: string): Promise<DecisionDetail> {
  const query = useCaseType ? `?useCaseType=${encodeURIComponent(useCaseType)}` : "";
  // For spine IDs (DSP-*), always include useCaseType so sub-decision clicks load correct routing
  const initialUrl = id.startsWith("DSP-")
    ? `/api/corevia/decisions/${id}${query}`
    : `/api/corevia/decisions/${id}`;
  let rawResponse: unknown = await apiFetch<unknown>(initialUrl);

  if (useCaseType && !id.startsWith("DSP-")) {
    const genericResponse = asRecord(rawResponse);
    const genericDecision = asRecord(genericResponse.decision ?? genericResponse);
    const genericServiceId = typeof genericDecision.serviceId === "string" ? genericDecision.serviceId.toLowerCase() : "";

    if (genericServiceId && genericServiceId !== useCaseType.toLowerCase()) {
      try {
        rawResponse = await apiFetch<unknown>(`/api/corevia/decisions/${id}${query}`);
      } catch (err: unknown) {
        if (!(isRecord(err) && err.statusCode === 404)) {
          throw err;
        }
      }
    }
  }

  const response = asRecord(rawResponse);
  const d = asRecord(response.decision ?? response);
  const classification = asRecord(response.classification);
  const policyEval = normalizePolicyEvaluation(response.policyEvaluation);
  const contextQuality = normalizeContextQuality(response.contextQuality);
  const orchestrationPlan = normalizeOrchestrationPlan(response.orchestrationPlan);
  const advisoryPackage = asRecord(response.advisoryPackage);
  const approval = asRecord(response.approval);
  const actionExecutions = normalizeActionExecutions(response.actionExecutions);
  const auditLog = asArray(response.auditLog);
  const retrievalLogs = normalizeRetrievalLogs(response.retrievalLogs);
  const memoryEntries = normalizeMemoryEntries(response.memoryEntries);
  const advisory = normalizeAdvisory(advisoryPackage);
  const auditEvents = normalizeAuditEvents(auditLog);
  const workflowReadiness = normalizeWorkflowReadiness(response.workflowReadiness);
  const learningArtifacts = normalizeLearningArtifacts(response.learningArtifacts);
  const input = asRecord(d.normalizedInput ?? d.inputData ?? d.input);
  const spineOverview = normalizeSpineOverview(response.spineOverview);
  const title = firstString(input.projectName, input.title, d.demandProjectName, d.projectName, d.serviceId) ?? "Untitled Decision";
  const owner = firstString(input.owner, input.requestedBy, d.userId);
  const department = firstString(input.department, input.organizationUnit);
  const description = firstString(input.description, input.summary, input.businessObjective, input.intent);
  const classificationLevel = normalizeClassificationLevel(
    classification.classificationLevel
    ?? classification.classification
    ?? d.classification
    ?? input.classificationLevel
    ?? input.dataClassification,
  );
  const classificationConstraints = normalizeClassificationConstraints(classification.constraints);
  const expectedROI = firstString(input.expectedROI, input.estimatedROI, input.expectedBenefits);
  const requestedBudget = firstString(input.requestedBudget, input.budget, input.budgetRange);
  const timeline = firstString(input.timeline, input.implementationTimeline, input.timelineEstimate);

  return {
    id: asString(d.id, id),
    title,
    serviceId: asString(d.serviceId),
    routeKey: asString(d.routeKey),
    decisionType: asString(input.decisionType ?? d.routeKey, "general"),
    status: normalizeDecisionStatus(d.status),
    currentLayer: typeof d.currentLayer === "number" ? d.currentLayer : 1,
    createdAt: asString(d.createdAt),
    updatedAt: asString(d.updatedAt),
    owner,
    department,
    description,
    classification: Object.keys(classification).length > 0 ? {
      level: classificationLevel,
      constraints: classificationConstraints,
      sector: asOptionalString(classification.sector),
      jurisdiction: asOptionalString(classification.jurisdiction),
      riskLevel: asOptionalString(classification.riskLevel),
    } : { level: "internal", constraints: [] },
    riskLevel: normalizeRiskLevel(classification.riskLevel ?? d.riskLevel),
    policyEvaluation: policyEval,
    contextQuality,
    orchestrationPlan,
    advisory,
    advisoryPackage: Object.keys(advisoryPackage).length > 0 ? advisoryPackage : undefined,
    approval: Object.keys(approval).length > 0 ? approval : undefined,
    actionExecutions,
    retrievalLogs,
    auditTrail: auditLog.map(normalizeAuditTrailEntry),
    auditEvents,
    governanceScore: calculateGovernanceScore(policyEval),
    trustScore: response.trustScore as DecisionDetail["trustScore"],
    brainTrace: response.brainTrace as DecisionDetail["brainTrace"],
    readinessScore: contextQuality ? Math.round(contextQuality.score * 100) : undefined,
    confidenceScore: advisoryPackage.overallConfidence ? Math.round(Number(advisoryPackage.overallConfidence)) : undefined,
    expectedROI,
    requestedBudget,
    timeline,
    evidenceRetrieval: advisoryPackage.evidence || undefined,
    engines: response.engines || undefined,
    learningArtifacts,
    input,
    spineOverview,
    memoryEntries,
    workflowReadiness,
  };
}

export async function submitIntake(
  serviceId: string,
  routeKey: string,
  input: Record<string, unknown>
): Promise<{ decisionId: string; status: string }> {
  return apiFetch(`/api/corevia/intake/${serviceId}/${routeKey}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function approveDecision(
  id: string,
  data: {
    decision: "approve" | "revise" | "reject";
    approvalType: "insights_only" | "insights_actions";
    notes?: string;
    approvedActions?: Record<string, unknown>[];
  }
): Promise<{ success: boolean; approvalId?: string }> {
  // Map frontend format to backend format
  const backendData = {
    action: data.decision,
    reason: data.notes,
    approvedActions: data.approvalType === "insights_actions" ? data.approvedActions : undefined,
  };
  return apiFetch(`/api/corevia/decisions/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(backendData),
  });
}

export async function runActions(id: string, approvalId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/corevia/decisions/${id}/execute`, {
    method: "POST",
    body: JSON.stringify({ approvalId }),
  });
}

export async function fetchServices(): Promise<{ services: Service[] }> {
  return apiFetch("/api/corevia/services");
}

export async function fetchRoutes(serviceId: string): Promise<{ routes: Route[] }> {
  return apiFetch(`/api/corevia/services/${serviceId}/routes`);
}

export async function registerService(data: {
  serviceId: string;
  serviceName: string;
  description?: string;
  defaultClassification?: string;
  isActive?: boolean;
}): Promise<{ success: boolean; service: Service; message: string }> {
  return apiFetch("/api/corevia/services/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function toggleService(serviceId: string, isActive: boolean): Promise<{ success: boolean }> {
  return apiFetch(`/api/corevia/services/${serviceId}/toggle`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export async function fetchAgents(): Promise<{ agents: Agent[]; stats?: { totalAgents: number; activeAgents: number; totalExecutions: number; categories: Record<string, number> } }> {
  return apiFetch("/api/corevia/agents");
}

export async function toggleAgent(agentId: string, enabled: boolean): Promise<{ success: boolean }> {
  return apiFetch(`/api/corevia/agents/${agentId}/toggle`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export async function registerAgent(data: {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  requiredClassification?: string;
  category?: string;
}): Promise<{ success: boolean; agentId: string }> {
  return apiFetch("/api/corevia/agents/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function removeAgent(agentId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/corevia/agents/${agentId}`, {
    method: "DELETE",
  });
}

export async function executeAgent(
  agentId: string,
  task: string,
  parameters?: Record<string, unknown>,
  options?: { decisionId?: string; approvalId?: string; mode?: "read" | "plan" | "execute" }
): Promise<{
  success: boolean;
  result: unknown;
  reasoning?: string;
  confidence: number;
  executionTimeMs: number;
  errors?: string[];
}> {
  const payload: Record<string, unknown> = { agentId, task, parameters };
  if (options) {
    Object.assign(payload, options);
  }
  return apiFetch("/api/corevia/agents/execute", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAgentHistory(agentId?: string): Promise<{ history: Array<{
  agentId: string;
  timestamp: string;
  success: boolean;
  confidence: number;
  executionTimeMs: number;
  task?: string;
  errors?: string[];
}> }> {
  const url = agentId
    ? `/api/corevia/agents/history?agentId=${agentId}`
    : "/api/corevia/agents/history";
  return apiFetch(url);
}

export async function fetchPolicies(): Promise<{ policies: Policy[] }> {
  return apiFetch("/api/corevia/policies");
}

export async function fetchPolicyPacks(): Promise<{ policyPacks: PolicyPack[]; activeVersion: string }> {
  return apiFetch("/api/corevia/policies/packs");
}

export async function uploadPolicyPack(data: {
  packId: string;
  name: string;
  version: string;
  summary: string;
  layer?: string;
  rulesCount?: number;
  rules?: unknown[];
  activateImmediately?: boolean;
  document?: File | null;
}): Promise<{ success: boolean; policyPack: PolicyPack; message: string }> {
  const formData = new FormData();
  formData.append("packId", data.packId);
  formData.append("name", data.name);
  formData.append("version", data.version);
  formData.append("summary", data.summary);
  formData.append("layer", data.layer || "L3_FRICTION");
  formData.append("rulesCount", String(data.rulesCount || 0));
  formData.append("activateImmediately", String(data.activateImmediately || false));
  if (data.rules && data.rules.length > 0) {
    formData.append("rules", JSON.stringify(data.rules));
  }
  if (data.document) {
    formData.append("document", data.document);
  }

  const res = await fetch("/api/corevia/policies/packs", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const json = await res.json();
  if (!res.ok) {
    const err = new Error((isRecord(json) && typeof json.error === "string") ? json.error : "Upload failed") as Error & {
      details?: unknown;
    };
    if (isRecord(json)) {
      err.details = json.details;
    }
    throw err;
  }
  return json as { success: boolean; policyPack: PolicyPack; message: string };
}

export async function togglePolicyPack(packId: string, status: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/corevia/policies/packs/${packId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function updatePolicyPackRules(packId: string, rules: unknown[]): Promise<{ success: boolean }> {
  return apiFetch(`/api/corevia/policies/packs/${packId}/rules`, {
    method: "PATCH",
    body: JSON.stringify({ rules }),
  });
}

export async function runPolicyTests(packId?: string): Promise<{ success: boolean; results: unknown }> {
  return apiFetch("/api/corevia/policies/packs/test", {
    method: "POST",
    body: JSON.stringify({ packId }),
  });
}

export async function fetchLearningArtifacts(): Promise<{ artifacts: LearningArtifact[] }> {
  return apiFetch("/api/corevia/learning/artifacts");
}

export async function fetchControlPlane(): Promise<{ state: { intakeEnabled: boolean; policyMode: "enforce" | "monitor"; agentThrottle: number; updatedAt: string } }> {
  return apiFetch("/api/corevia/control-plane");
}

export async function setIntakeGate(enabled: boolean): Promise<{ state: { intakeEnabled: boolean } }> {
  return apiFetch("/api/corevia/control-plane/intake", {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export async function setPolicyMode(mode: "enforce" | "monitor"): Promise<{ state: { policyMode: "enforce" | "monitor" } }> {
  return apiFetch("/api/corevia/control-plane/policy-mode", {
    method: "PATCH",
    body: JSON.stringify({ mode }),
  });
}

export async function setAgentThrottle(throttle: number): Promise<{ state: { agentThrottle: number } }> {
  return apiFetch("/api/corevia/control-plane/agent-throttle", {
    method: "PATCH",
    body: JSON.stringify({ throttle }),
  });
}

export interface LayerConfig {
  id: number;
  key: string;
  name: string;
  enabled: boolean;
  mode: "enforce" | "monitor" | "bypass";
  timeoutMs: number;
  retries: number;
  slaMs: number;
  approvalRequired: boolean;
  approvalRoles: string[];
  description: string;
}

export async function fetchLayers(): Promise<{ layers: LayerConfig[] }> {
  return apiFetch("/api/corevia/layers");
}

export async function fetchLayer(layerId: number): Promise<{ layer: LayerConfig }> {
  return apiFetch(`/api/corevia/layers/${layerId}`);
}

export async function updateLayer(layerId: number, updates: Partial<LayerConfig>): Promise<{ layer: LayerConfig }> {
  return apiFetch(`/api/corevia/layers/${layerId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function activateArtifact(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/corevia/learning/artifacts/${id}/activate`, {
    method: "POST",
  });
}

export async function submitOutcomeFeedback(data: {
  decisionId: string;
  approvalId: string;
  outcomeStatus: string;
  lessonsLearned: string;
}): Promise<{ success: boolean }> {
  return apiFetch("/api/corevia/learning/outcome-feedback", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ==================== ENGINE MANAGEMENT ====================

export interface EnginePlugin {
  enginePluginId: string;
  kind: "SOVEREIGN_INTERNAL" | "EXTERNAL_HYBRID" | "DISTILLATION";
  name: string;
  version: string;
  enabled: boolean;
  allowedMaxClass: string;
  capabilities: Record<string, boolean>;
  config: Record<string, unknown>;
  createdAt: string;
}

export interface EngineHealthResponse {
  success: boolean;
  engine: string;
  configured: boolean;
  endpoint?: string;
  model?: string;
  health?: {
    ok?: boolean;
    status?: string;
    error?: string;
    [key: string]: unknown;
  };
}

export interface LocalEngineModel {
  name: string;
  digest?: string;
  size?: number;
  modifiedAt?: string;
  family?: string;
  quantizationLevel?: string;
}

export interface EngineModelsResponse {
  success: boolean;
  engine: string;
  configured: boolean;
  reachable: boolean;
  endpoint?: string;
  model?: string;
  models: LocalEngineModel[];
  health?: {
    ok?: boolean;
    status?: string;
    error?: string;
    [key: string]: unknown;
  };
}

export interface EngineTestResponse {
  success: boolean;
  engine: string;
  endpoint?: string;
  model?: string;
  parsed?: Record<string, unknown> | null;
  text?: string | null;
  raw?: unknown;
}

export interface EngineRuntimeStateResponse {
  success: boolean;
  engine: string;
  action?: "started" | "stopped";
  runtime: {
    manageable: boolean;
    manager: "docker-local-llm";
    endpoint: string;
    reason?: string;
    services: {
      engineGateway: "running" | "stopped";
      localLlm: "running" | "stopped";
    };
    healthy: boolean;
    health?: {
      ok?: boolean;
      status?: string;
      error?: string;
      [key: string]: unknown;
    };
  };
}

export async function fetchEngines(): Promise<{ engines: EnginePlugin[] }> {
  return apiFetch("/api/corevia/engines");
}

export async function fetchEngine(id: string): Promise<{ engine: EnginePlugin }> {
  return apiFetch(`/api/corevia/engines/${id}`);
}

export async function fetchEngineHealth(id: string): Promise<EngineHealthResponse> {
  return apiFetch(`/api/corevia/engines/${id}/health`);
}

export async function fetchEngineModels(id: string): Promise<EngineModelsResponse> {
  return apiFetch(`/api/corevia/engines/${id}/models`);
}

export async function testEngine(
  id: string,
  data?: {
    prompt?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<EngineTestResponse> {
  return apiFetch(`/api/corevia/engines/${id}/test`, {
    method: "POST",
    body: JSON.stringify(data || {}),
  });
}

export async function fetchEngineRuntime(id: string): Promise<EngineRuntimeStateResponse> {
  return apiFetch(`/api/corevia/engines/${id}/runtime`);
}

export async function startEngineRuntime(id: string): Promise<EngineRuntimeStateResponse> {
  return apiFetch(`/api/corevia/engines/${id}/runtime/start`, {
    method: "POST",
  });
}

export async function stopEngineRuntime(id: string): Promise<EngineRuntimeStateResponse> {
  return apiFetch(`/api/corevia/engines/${id}/runtime/stop`, {
    method: "POST",
  });
}

export async function registerEngine(data: Partial<EnginePlugin> & {
  enginePluginId: string;
  kind: string;
  name: string;
  version: string;
}): Promise<{ engine: EnginePlugin }> {
  return apiFetch("/api/corevia/engines", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateEngine(id: string, updates: Partial<EnginePlugin>): Promise<{ engine: EnginePlugin }> {
  return apiFetch(`/api/corevia/engines/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function fetchEngineAttestations(id: string): Promise<{ attestations: unknown[] }> {
  return apiFetch(`/api/corevia/engines/${id}/attestations`);
}

export async function fetchRoutingOverrides(): Promise<{ overrides: unknown[] }> {
  return apiFetch("/api/corevia/routing-overrides");
}

export async function fetchEngineRoutingTable(): Promise<{ table: Record<string, { primary: string; fallback: string | null; redaction: boolean; hitl: boolean }> }> {
  return apiFetch("/api/corevia/engines/routing-table");
}

export async function updateRoutingOverride(
  overrideId: string,
  data: {
    scope: "GLOBAL" | "USE_CASE" | "SPINE";
    scopeRef?: string | null;
    forcedEngineKind?: "SOVEREIGN_INTERNAL" | "EXTERNAL_HYBRID" | "DISTILLATION" | null;
    forcedEngineId?: string | null;
    enabled: boolean;
    reason?: string | null;
  }
): Promise<{ override: unknown }> {
  return apiFetch(`/api/corevia/routing-overrides/${overrideId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
