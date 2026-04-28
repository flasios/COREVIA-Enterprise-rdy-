import { coreviaOrchestrator, coreviaStorage } from "@brain";
import { logger } from "@platform/logging/Logger";
import { createHash, randomUUID } from "node:crypto";

export type BrainPipelineFailureKind =
  | "policy_blocked"
  | "classification_blocked"
  | "provider_unavailable"
  | "pipeline_error";

export type BrainPipelineFailureDetails = {
  stoppedAtLayer?: number;
  finalStatus?: string;
  decisionId?: string;
  correlationId?: string;
  classificationLevel?: string;
  riskLevel?: string;
  policyResult?: string;
  blockingPolicy?: string;
};

export class BrainPipelineError extends Error {
  failureKind: BrainPipelineFailureKind;
  details: BrainPipelineFailureDetails;

  constructor(message: string, failureKind: BrainPipelineFailureKind, details: BrainPipelineFailureDetails = {}) {
    super(message);
    this.name = "BrainPipelineError";
    this.failureKind = failureKind;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickFirstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value;
  }
  return "";
}

function toUniqueStringList(...values: unknown[]): string[] {
  const items = values.flatMap((value) => {
    if (Array.isArray(value)) {
      return value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(/[\n;,]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return [];
  });

  return Array.from(new Set(items));
}

function toSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.replaceAll(/\s+/g, " ");
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function inferDemandOwnerDepartment(objective: string, fallback: string): string {
  if (fallback.trim()) {
    return fallback.trim();
  }

  const normalized = objective.toLowerCase();
  if (/(permit|licen[cs]e|approval|inspection|case management)/i.test(normalized)) {
    return "Permits and Approvals";
  }
  if (/(security|identity|access|compliance|audit|classified)/i.test(normalized)) {
    return "Information Security and Compliance";
  }
  if (/(document|records|archive|knowledge)/i.test(normalized)) {
    return "Records and Knowledge Management";
  }
  if (/(procurement|vendor|supplier|contract)/i.test(normalized)) {
    return "Procurement and Commercial";
  }

  return "Operations";
}

function inferDemandProjectName(objective: string, department: string): string {
  const source = objective || department || "Demand Initiative";
  const cleaned = source
    .replaceAll(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

  if (!cleaned) {
    return "Demand Initiative";
  }

  return /initiative|program|project/i.test(cleaned) ? cleaned : `${cleaned} Initiative`;
}

function getBlockingPolicy(policy?: Record<string, unknown>): string | undefined {
  if (!policy) return undefined;
  if (typeof policy.blockingPolicy === "string") return policy.blockingPolicy;
  if (typeof policy.policyName === "string") return policy.policyName;
  return undefined;
}

function getStableSpinePrefix(serviceId: string): string {
  switch (serviceId) {
    case "rag":
      return "DSP-RAG";
    case "demand_analysis":
      return "DSP-DEMAND-ASSIST";
    case "ai_assistant":
      return "DSP-ASSISTANT";
    default:
      return "DSP-REASONING";
  }
}

function buildStableOperationalSpineId(params: {
  serviceId: string;
  routeKey: string;
  artifactType: string;
  inputData: Record<string, unknown>;
  userId: string;
  organizationId?: string;
}): string | null {
  const stableSpineServices = new Set(["rag", "reasoning", "demand_analysis", "ai_assistant"]);
  if (!stableSpineServices.has(params.serviceId)) return null;

  const day = new Date().toISOString().slice(0, 10);
  const scope = (params.organizationId || "").trim() || params.userId.trim() || "system";
  const organizationName = pickFirstString(params.inputData, ["organizationName", "organization", "orgName"]).trim();
  const department = pickFirstString(params.inputData, ["department", "category", "businessUnit", "ownerDepartment"]).trim();
  const requestorName = pickFirstString(params.inputData, ["requestorName", "requestor", "owner"]).trim();
  const industryType = pickFirstString(params.inputData, ["industryType", "sector", "domain"]).trim();
  const classification = pickFirstString(params.inputData, ["dataClassification", "classificationLevel", "classification", "accessLevel"]).trim();
  const query = pickFirstString(params.inputData, [
    "query",
    "question",
    "prompt",
    "businessObjective",
    "userMessage",
  ]).trim().slice(0, 500);
  const digest = createHash("sha256")
    .update(JSON.stringify({
      scope,
      day,
      serviceId: params.serviceId,
      routeKey: params.routeKey,
      artifactType: params.artifactType,
      query,
      organizationName,
      department,
      requestorName,
      industryType,
      classification,
    }))
    .digest("hex")
    .slice(0, 16);

  return `${getStableSpinePrefix(params.serviceId)}-${day}-${digest}`;
}

async function getProjectFlowStatus(decisionSpineId: string): Promise<BrainDraftArtifactResult["projectFlow"]> {
  try {
    return await coreviaStorage.getProjectFlowStatus(decisionSpineId);
  } catch (error) {
    logger.warn(
      "[BrainDraftArtifact] Could not retrieve project flow:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function getDeferredArtifactContent(
  pipeline: Record<string, unknown>,
  artifactType: string,
): Record<string, unknown> | null {
  const decision = isRecord(pipeline.decision) ? pipeline.decision : undefined;
  const advisory = decision && isRecord(decision.advisory) ? decision.advisory : undefined;
  const generatedArtifacts = advisory && isRecord(advisory.generatedArtifacts) ? advisory.generatedArtifacts : undefined;
  const generated = generatedArtifacts?.[artifactType];
  return isRecord(generated) ? generated : null;
}

function pickStringOrDefault(record: Record<string, unknown> | undefined, keys: string[], defaultValue = ""): string {
  if (!record) return defaultValue;
  return pickFirstString(record, keys) || defaultValue;
}

function extractDecisionInput(decision: Record<string, unknown>): Record<string, unknown> | undefined {
  const input = isRecord(decision.input) ? decision.input : undefined;
  if (!input) return undefined;
  if (isRecord(input.normalizedInput)) return input.normalizedInput;
  if (isRecord(input.rawInput)) return input.rawInput;
  return undefined;
}

function extractDemandAgentResult(decision: Record<string, unknown>): Record<string, unknown> | undefined {
  const advisory = isRecord(decision.advisory) ? decision.advisory : undefined;
  const agentOutputs = advisory && isRecord(advisory.agentOutputs) ? advisory.agentOutputs : undefined;
  const demandAgentOutput = agentOutputs && isRecord(agentOutputs.demand_agent) ? agentOutputs.demand_agent : undefined;
  if (demandAgentOutput?.status === "completed" && isRecord(demandAgentOutput.result)) {
    return demandAgentOutput.result;
  }
  return undefined;
}

function buildDemandFieldsResult(
  input: Record<string, unknown> | undefined,
  demandAgentResult: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const objective = pickStringOrDefault(input, ["businessObjective", "description"]);
  const title = pickStringOrDefault(input, ["projectName", "suggestedProjectName", "title"]);
  const organizationName = pickStringOrDefault(input, ["organizationName", "organization", "orgName"]);
  const rawDepartment = pickStringOrDefault(input, ["department", "businessUnit", "ownerDepartment"]);
  const industryType = pickStringOrDefault(input, ["industryType", "sector", "domain"]);
  const department = inferDemandOwnerDepartment(objective, rawDepartment || pickStringOrDefault(demandAgentResult, ["department"]));
  const timeframe = pickStringOrDefault(demandAgentResult, ["timeframe", "timeline"]);
  const budgetRange = pickStringOrDefault(demandAgentResult, ["budgetRange", "budget"]);
  const derivedTitle = title || pickStringOrDefault(demandAgentResult, ["suggestedProjectName", "projectName", "title"]) || inferDemandProjectName(objective, department);
  const rewrittenObjective = pickStringOrDefault(demandAgentResult, ["enhancedBusinessObjective", "businessObjective", "description"]) || toSentence(objective);
  const challengeNarrative = pickStringOrDefault(demandAgentResult, ["currentChallenges", "challenges"])
    || toSentence(
      objective
        ? `The request needs a clearer operating context, structured outcomes, and governed delivery assumptions for ${objective}`
        : "The request needs a clearer operating context and structured delivery assumptions"
    );

  const expectedOutcomes = toUniqueStringList(
    demandAgentResult?.expectedOutcomes,
    objective ? `Deliver measurable improvement for ${objective}` : "",
    department ? `Establish accountable workflow ownership within ${department}` : "",
  );
  const successCriteria = toUniqueStringList(
    demandAgentResult?.successCriteria,
    "Stakeholder workflow is clearly defined and approved",
    objective ? `Delivery outcomes for ${objective} are measurable and governed` : "",
  );
  const stakeholders = toUniqueStringList(
    demandAgentResult?.stakeholders,
    department ? `${department} leadership` : "",
    "Business owner",
    "Delivery lead",
  );
  const riskFactors = toUniqueStringList(
    demandAgentResult?.riskFactors,
    "Delivery assumptions need validation before downstream artifact generation",
  );
  const constraints = toUniqueStringList(
    demandAgentResult?.constraints,
    budgetRange ? `Budget envelope: ${budgetRange}` : "",
    timeframe ? `Timeline expectation: ${timeframe}` : "",
  );
  const integrationRequirements = toUniqueStringList(
    demandAgentResult?.integrationRequirements,
    demandAgentResult?.existingSystems,
  );
  const shouldApplyGovernmentGovernance = !industryType || industryType.toLowerCase() === "government";
  const complianceRequirements = toUniqueStringList(
    demandAgentResult?.complianceRequirements,
    shouldApplyGovernmentGovernance ? "Government governance and access-control requirements" : "",
  );
  const existingSystems = toUniqueStringList(demandAgentResult?.existingSystems);
  const assumptions = toUniqueStringList(
    demandAgentResult?.assumptions,
    department ? `${department} will provide subject matter experts during elaboration` : "",
  );

  return {
    artifactType: "DEMAND_FIELDS",
    organizationName,
    department,
    industryType: industryType || "government",
    enhancedBusinessObjective: rewrittenObjective,
    suggestedProjectName: derivedTitle,
    currentChallenges: challengeNarrative,
    expectedOutcomes,
    successCriteria,
    timeframe,
    budgetRange,
    stakeholders,
    riskFactors,
    constraints,
    integrationRequirements,
    complianceRequirements,
    existingSystems,
    assumptions,
    requestType: pickStringOrDefault(demandAgentResult, ["requestType"]) || "demand",
    classificationConfidence: typeof demandAgentResult?.classificationConfidence === "number" ? demandAgentResult.classificationConfidence : undefined,
    classificationReasoning: pickStringOrDefault(demandAgentResult, ["classificationReasoning"]) || "Demand agent synthesized the request using Brain engine context.",
    meta: {
      generatedAt: new Date().toISOString(),
      engine: "brain",
      confidence: 0.4,
      source: "demand_agent_recovery",
    },
  };
}

function getDemandFieldsFallbackContent(pipeline: Record<string, unknown>): Record<string, unknown> | null {
  const decision = isRecord(pipeline.decision) ? pipeline.decision : undefined;
  if (!decision) return null;

  const input = extractDecisionInput(decision);
  const demandAgentResult = extractDemandAgentResult(decision);

  const objective = pickStringOrDefault(input, ["businessObjective", "description"]);
  if (!objective && !demandAgentResult) return null;

  return buildDemandFieldsResult(input, demandAgentResult);
}

function getEphemeralArtifactContent(
  pipeline: Record<string, unknown>,
  artifactType: string,
): Record<string, unknown> | null {
  const deferred = getDeferredArtifactContent(pipeline, artifactType);
  if (deferred) {
    return deferred;
  }

  if (artifactType === "DEMAND_FIELDS") {
    return getDemandFieldsFallbackContent(pipeline);
  }

  return null;
}

function inferFailureKind(stopReason: string | undefined, stoppedAtLayer: number | undefined): BrainPipelineFailureKind {
  const normalizedReason = (stopReason || "").toLowerCase();

  if (
    stoppedAtLayer === 3 ||
    normalizedReason.includes("policy") ||
    normalizedReason.includes("sovereign") ||
    normalizedReason.includes("confidential") ||
    normalizedReason.includes("approval") ||
    normalizedReason.includes("governance")
  ) {
    return "policy_blocked";
  }

  if (stoppedAtLayer === 2 || normalizedReason.includes("classification")) {
    return "classification_blocked";
  }

  if (
    normalizedReason.includes("timeout") ||
    normalizedReason.includes("timed out") ||
    normalizedReason.includes("abort") ||
    normalizedReason.includes("unavailable") ||
    normalizedReason.includes("econn") ||
    normalizedReason.includes("socket")
  ) {
    return "provider_unavailable";
  }

  return "pipeline_error";
}

function extractFailureDetails(pipeline: Record<string, unknown>): BrainPipelineFailureDetails {
  const decision = isRecord(pipeline.decision) ? pipeline.decision : undefined;
  const classification = decision && isRecord(decision.classification) ? decision.classification : undefined;
  const policy = decision && isRecord(decision.policy) ? decision.policy : undefined;
  const stoppedAtLayer = typeof pipeline.stoppedAtLayer === "number" ? pipeline.stoppedAtLayer : undefined;
  const classificationLevel = classification && typeof classification.classificationLevel === "string"
    ? classification.classificationLevel
    : undefined;
  const riskLevel = classification && typeof classification.riskLevel === "string"
    ? classification.riskLevel
    : undefined;
  const policyResult = policy && typeof policy.result === "string" ? policy.result : undefined;
  const blockingPolicy = getBlockingPolicy(policy);

  return {
    stoppedAtLayer,
    finalStatus: typeof pipeline.finalStatus === "string" ? pipeline.finalStatus : undefined,
    decisionId: typeof pipeline.decisionId === "string" ? pipeline.decisionId : undefined,
    correlationId: typeof pipeline.correlationId === "string" ? pipeline.correlationId : undefined,
    classificationLevel,
    riskLevel,
    policyResult,
    blockingPolicy,
  };
}

export type BrainDraftArtifactResult = {
  decisionSpineId: string;
  artifactType: string;
  artifactVersionId: string;
  version: number;
  content: Record<string, unknown>;
  status: string;
  isApproved: boolean;
  projectFlow: Array<{
    subDecisionType: string;
    subDecisionStatus: string;
    artifactId: string | null;
    artifactStatus: string | null;
    latestVersion: number | null;
  }>;
};

export async function generateBrainDraftArtifact(params: {
  decisionSpineId?: string;
  serviceId: string;
  routeKey: string;
  artifactType: string;
  inputData: Record<string, unknown>;
  userId: string;
  organizationId?: string;
}): Promise<BrainDraftArtifactResult> {
  const { serviceId, routeKey, artifactType, inputData, userId, organizationId } = params;
  const stableOperationalSpineId = buildStableOperationalSpineId({
    serviceId,
    routeKey,
    artifactType,
    inputData,
    userId,
    organizationId,
  });

  const decisionSpineId = params.decisionSpineId || stableOperationalSpineId || `DSP-${randomUUID()}`;

  const pipeline = await coreviaOrchestrator.execute(
    serviceId,
    routeKey,
    {
      ...inputData,
      decisionSpineId,
      sourceType: inputData.sourceType || serviceId,
      sourceContext: inputData.sourceContext || {},
    },
    userId,
    organizationId,
    { decisionSpineId },
  );

  if (!pipeline.success) {
    const failureDetails = extractFailureDetails(pipeline as Record<string, unknown>);
    throw new BrainPipelineError(
      pipeline.stopReason || `Brain pipeline failed (${serviceId}/${routeKey})`,
      inferFailureKind(pipeline.stopReason, pipeline.stoppedAtLayer),
      failureDetails,
    );
  }

  const deferredArtifactTypes = new Set(["BUSINESS_CASE", "REQUIREMENTS", "STRATEGIC_FIT"]);
  if (deferredArtifactTypes.has(artifactType)) {
    const generated = getEphemeralArtifactContent(pipeline as Record<string, unknown>, artifactType);
    if (generated) {
      return {
        decisionSpineId,
        artifactType,
        artifactVersionId: "EPHEMERAL",
        version: 0,
        content: generated,
        status: "DRAFT",
        isApproved: false,
        projectFlow: await getProjectFlowStatus(decisionSpineId),
      };
    }
  }

  const artifact = await coreviaStorage.getLatestDecisionArtifactVersion({
    decisionSpineId,
    artifactType,
  });

  if (!artifact) {
    const generated = getEphemeralArtifactContent(pipeline as Record<string, unknown>, artifactType);
    if (generated) {
      logger.warn(
        `[BrainDraftArtifact] ${serviceId}/${routeKey} did not persist artifactType=${artifactType}; using advisory.generatedArtifacts fallback`,
      );
      return {
        decisionSpineId,
        artifactType,
        artifactVersionId: "EPHEMERAL",
        version: 0,
        content: generated,
        status: "DRAFT",
        isApproved: false,
        projectFlow: await getProjectFlowStatus(decisionSpineId),
      };
    }
  }

  if (!artifact) {
    throw new Error(`Brain did not produce artifactType=${artifactType} for ${serviceId}/${routeKey}`);
  }

  const contentKeys = artifact.content && typeof artifact.content === "object" ? Object.keys(artifact.content) : [];
  logger.info(
    `[BrainDraftArtifact] ${serviceId}/${routeKey} → artifactType=${artifactType}, version=${artifact.version}, status=${artifact.status}, contentKeys=[${contentKeys.join(", ")}]`,
  );

  return {
    decisionSpineId,
    artifactType,
    artifactVersionId: artifact.artifactVersionId,
    version: artifact.version,
    content: artifact.content,
    status: artifact.status,
    isApproved: artifact.status === "APPROVED",
    projectFlow: await getProjectFlowStatus(decisionSpineId),
  };
}