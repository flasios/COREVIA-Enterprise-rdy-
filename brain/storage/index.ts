import { createHash, randomUUID } from "node:crypto";
import { db } from "../../db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import {
  approvals,
  brainEvents,
  brainPrincipals,
  canonicalAiRequests,
  constraintPacks,
  contextQualityReports,
  decisionLedgerRecords,
  decisionOutcomes,
  decisionJourneys,
  decisionSpines,
  executions,
  engineKindEnum,
  enginePlugins,
  dataClassificationEnum,
  decisionSpineStatusEnum,
  subdecisionStatusEnum,
  artifactStatusEnum,
  executionStatusEnum,
  policyPackStatusEnum,
  policyPackTestResultEnum,
  journeyStatusEnum,
  decisionPhaseEnum,
  governanceDecisions,
  governancePolicies,
  governancePolicyVersions,
  intelligencePlans,
  learningAssetActivations,
  learningAssets,
  runAttestations,
  advisoryPackages,
  aiUseCases,
  decisionArtifacts,
  decisionArtifactVersions,
  redactionReceipts,
  routingOverrides,
  subDecisions,
  corviaPolicyPacks,
} from "@shared/schemas/corevia/tables";
import { demandReports } from "@shared/schema/demand";
import type { DecisionObject } from "@shared/schemas/corevia/decision-object";
import { logger } from "../../platform/observability";

export interface CoreviaDecisionRecord {
  id: string;
  requestId?: string | null;
  correlationId: string;
  serviceId: string;
  routeKey: string;
  inputData: Record<string, unknown>;
  normalizedInput?: Record<string, unknown> | null;
  currentLayer?: number | null;
  status?: string | null;
  userId?: string | null;
  organizationId?: string | null;
  classification?: string | null;
  riskLevel?: string | null;
  sector?: string | null;
  jurisdiction?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  completedAt?: Date | null;
  /** Canonical project name stored on the spine — survives request re-routing. */
  spineTitle?: string | null;
  /** Project name from the linked demand_reports row — most reliable source. */
  demandProjectName?: string | null;
}

type DecisionSpineRow = typeof decisionSpines.$inferSelect;
type CanonicalAiRequestRow = typeof canonicalAiRequests.$inferSelect;
type SubDecisionRow = typeof subDecisions.$inferSelect;
type ApprovalRow = typeof approvals.$inferSelect;
type ExecutionRow = typeof executions.$inferSelect;
type BrainEventRow = typeof brainEvents.$inferSelect;
type LedgerRow = typeof decisionLedgerRecords.$inferSelect;
type ArtifactRow = typeof decisionArtifacts.$inferSelect;
type ArtifactVersionRow = typeof decisionArtifactVersions.$inferSelect;
type EnginePluginRow = typeof enginePlugins.$inferSelect;
type JourneyRow = typeof decisionJourneys.$inferSelect;
type LearningAssetRow = typeof learningAssets.$inferSelect;

function requireRow<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
}
type EngineKind = typeof engineKindEnum.enumValues[number];

export class CoreviaStorage {

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private toOptionalString(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return null;
  }

  private pickPreferredString(values: unknown[], fallback: string | null = null): string | null {
    for (const value of values) {
      const text = this.toOptionalString(value);
      if (text) return text;
    }
    return fallback;
  }

  private resolveApprovalOutcome(status: unknown): "APPROVE" | "REJECT" | "REVISE" {
    if (status === "approved") return "APPROVE";
    if (status === "rejected") return "REJECT";
    return "REVISE";
  }

  private resolveMemoryConclusion(status: unknown): "APPROVED_TO_EXECUTE" | "REJECTED" | "HOLD" {
    if (status === "approved") return "APPROVED_TO_EXECUTE";
    if (status === "rejected") return "REJECTED";
    return "HOLD";
  }

  private normalizeApprovalStatus(status: unknown): "approved" | "rejected" | "pending" {
    if (status === "approved" || status === "APPROVE") return "approved";
    if (status === "rejected" || status === "REJECT") return "rejected";
    return "pending";
  }

  private resolveRedactionMode(redactionMode: unknown, useHybridEngine: boolean): string {
    if (typeof redactionMode === "string") return redactionMode;
    return useHybridEngine ? "MASK" : "NONE";
  }

  private extractAllowedAgents(selectedAgents?: Record<string, unknown>[]): string[] {
    return (selectedAgents ?? []).flatMap((agent) => {
      const agentId = this.toOptionalString(agent.agentId);
      return agentId ? [agentId] : [];
    });
  }

  private toIsoTimestamp(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (value instanceof Date) return value.toISOString();
    return null;
  }

  private isSameDayOrAfter(value: unknown, threshold: Date): boolean {
    const dateValue = value instanceof Date ? value : this.toOptionalString(value);
    if (!dateValue) return false;
    return new Date(dateValue).getTime() >= threshold.getTime();
  }

  private incrementBrainEventCounters(summary: {
    totalToday: number;
    blocked: number;
    allowed: number;
    errors: number;
    byType: Record<string, number>;
    totalAll: number;
    blockedAll: number;
    allowedAll: number;
    errorsAll: number;
    latestEventAt: string | null;
  }, eventType: string, isToday: boolean): void {
    if (eventType.includes("blocked")) {
      summary.blockedAll++;
      if (isToday) summary.blocked++;
    } else if (eventType.includes("allowed") || eventType.includes("completed")) {
      summary.allowedAll++;
      if (isToday) summary.allowed++;
    } else if (eventType.includes("failed") || eventType.includes("error")) {
      summary.errorsAll++;
      if (isToday) summary.errors++;
    }

    if (isToday) {
      summary.totalToday++;
      summary.byType[eventType] = (summary.byType[eventType] || 0) + 1;
    }
  }

  private incrementPipelineStatusCounts(statusCounts: {
    processing: number;
    pending: number;
    blocked: number;
    completed: number;
    needsInfo: number;
  }, pipelineStatus: string | null): void {
    if (pipelineStatus === "completed" || pipelineStatus === "memory") {
      statusCounts.completed++;
      return;
    }
    if (pipelineStatus === "blocked" || pipelineStatus === "rejected") {
      statusCounts.blocked++;
      return;
    }
    if (pipelineStatus === "needs_info") {
      statusCounts.needsInfo++;
      return;
    }
    if (
      pipelineStatus === "validation"
      || pipelineStatus === "pending_approval"
      || pipelineStatus === "intake"
      || pipelineStatus === "queued"
      || !pipelineStatus
    ) {
      statusCounts.pending++;
      return;
    }
    statusCounts.processing++;
  }

  private incrementPipelineClassification(
    classificationCounts: Record<string, number>,
    rowClassification: unknown,
    currentLayer: number | null,
  ): void {
    const classification = typeof currentLayer === "number" && currentLayer >= 2
      ? this.pickPreferredString([rowClassification], "UNKNOWN") || "UNKNOWN"
      : "UNKNOWN";
    classificationCounts[classification] = (classificationCounts[classification] || 0) + 1;
  }

  private buildAgentPlan(data: {
    selectedAgents?: Record<string, unknown>[];
    agentPlanPolicy?: Record<string, unknown> | null;
    executionPlan?: Record<string, unknown>[];
    appliedConstraints?: Record<string, unknown> | null;
  }): Record<string, unknown> {
    const selectedAgents = data.selectedAgents || [];
    return {
      selectedAgents,
      agentPlanPolicy: data.agentPlanPolicy || {
        allowedAgents: this.extractAllowedAgents(selectedAgents),
        mode: "READ",
        writePermissions: false,
      },
      executionPlan: data.executionPlan || [],
      appliedConstraints: data.appliedConstraints || {},
    };
  }

  private stableStringify(value: unknown): string {
    if (value === null || value === undefined) return "null";
    if (typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((v) => this.stableStringify(v)).join(",")}]`;
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
    const entries = keys.map((key) => JSON.stringify(key) + ":" + this.stableStringify(record[key]));
    return "{" + entries.join(",") + "}";
  }

  private normalizeAuditEventData(value: unknown): string {
    const record = this.asRecord(value);
    const { _audit, ...rest } = record;
    void _audit;
    return this.stableStringify(rest);
  }

  private computeIplanHash(params: {
    mode: string;
    selectedEngines: unknown;
    toolsAllowed: unknown;
    redactionMode: unknown;
    budgets: unknown;
    agentPlan: unknown;
  }): string {
    const stable = this.stableStringify({
      mode: params.mode,
      selectedEngines: params.selectedEngines,
      toolsAllowed: params.toolsAllowed,
      redactionMode: params.redactionMode,
      budgets: params.budgets,
      agentPlan: params.agentPlan,
    });
    return createHash("sha256").update(stable).digest("hex");
  }

  async getGovernanceDecisionsByRequestIds(
    requestIds: string[]
  ): Promise<Record<string, { outcome: string; applicablePolicies: string[] }>> {
    const ids = Array.from(new Set(requestIds.filter(Boolean)));
    if (ids.length === 0) return {};

    const rows = await db
      .select({
        requestId: governanceDecisions.requestId,
        outcome: governanceDecisions.outcome,
        applicablePolicies: governanceDecisions.applicablePolicies,
      })
      .from(governanceDecisions)
      .where(inArray(governanceDecisions.requestId, ids));

    const byRequestId: Record<string, { outcome: string; applicablePolicies: string[] }> = {};
    for (const row of rows) {
      byRequestId[row.requestId] = {
        outcome: String(row.outcome),
        applicablePolicies: Array.isArray(row.applicablePolicies) ? row.applicablePolicies.filter(Boolean) : [],
      };
    }
    return byRequestId;
  }

  private async ensurePrincipal(principalId: string | null | undefined): Promise<void> {
    if (!principalId) return;
    await db
      .insert(brainPrincipals)
      .values({ principalId, principalType: "user", displayName: principalId })
      .onConflictDoNothing();
  }

  private async ensureUseCase(useCaseType: string): Promise<void> {
    await db
      .insert(aiUseCases)
      .values({ useCaseType, title: useCaseType })
      .onConflictDoNothing();
  }

  private async getLatestRequest(decisionSpineId: string) {
    const [request] = await db
      .select()
      .from(canonicalAiRequests)
      .where(eq(canonicalAiRequests.decisionSpineId, decisionSpineId))
      .orderBy(desc(canonicalAiRequests.requestedAt))
      .limit(1);
    return request || null;
  }

  async getFirstRequest(decisionSpineId: string) {
    const [request] = await db
      .select()
      .from(canonicalAiRequests)
      .where(eq(canonicalAiRequests.decisionSpineId, decisionSpineId))
      .orderBy(canonicalAiRequests.requestedAt)
      .limit(1);
    return request || null;
  }

  /**
   * Get the highest layer reached across ALL requests on a decision spine.
   * No bypasses — checks every request's sourceMetadata.currentLayer.
   */
  async getHighestLayerForSpine(decisionSpineId: string): Promise<number> {
    const requests = await db
      .select({ sourceMetadata: canonicalAiRequests.sourceMetadata })
      .from(canonicalAiRequests)
      .where(eq(canonicalAiRequests.decisionSpineId, decisionSpineId));
    let maxLayer = 0;
    for (const req of requests) {
      const meta = (req.sourceMetadata || {}) as Record<string, unknown>;
      const layer = typeof meta.currentLayer === 'number' ? meta.currentLayer : Number(meta.currentLayer) || 0;
      if (layer > maxLayer) maxLayer = layer;
    }
    return maxLayer;
  }

  async getLatestRequestForOrganization(decisionSpineId: string, organizationId: string) {
    const org = (organizationId || "").trim();
    if (!org) return this.getLatestRequest(decisionSpineId);
    const [request] = await db
      .select()
      .from(canonicalAiRequests)
      .where(and(
        eq(canonicalAiRequests.decisionSpineId, decisionSpineId),
        sql`(${canonicalAiRequests.sourceMetadata} ->> 'organizationId') = ${org}`
      ))
      .orderBy(desc(canonicalAiRequests.requestedAt))
      .limit(1);
    return request || null;
  }

  async getLatestRequestByUseCaseForOrganization(decisionSpineId: string, useCaseType: string, organizationId: string) {
    const org = (organizationId || "").trim();
    const uc = (useCaseType || "").trim();
    if (!uc) return this.getLatestRequestForOrganization(decisionSpineId, org);
    if (!org) return this.getLatestRequestByUseCase(decisionSpineId, uc);

    const [request] = await db
      .select()
      .from(canonicalAiRequests)
      .where(and(
        eq(canonicalAiRequests.decisionSpineId, decisionSpineId),
        eq(canonicalAiRequests.useCaseType, uc),
        sql`(${canonicalAiRequests.sourceMetadata} ->> 'organizationId') = ${org}`
      ))
      .orderBy(desc(canonicalAiRequests.requestedAt))
      .limit(1);
    return request || null;
  }

  async getLatestMeaningfulRequestByUseCaseForOrganization(decisionSpineId: string, useCaseType: string, organizationId: string) {
    const org = (organizationId || "").trim();
    const uc = (useCaseType || "").trim();
    if (!uc) return null;

    const requests = await db
      .select()
      .from(canonicalAiRequests)
      .where(and(
        eq(canonicalAiRequests.decisionSpineId, decisionSpineId),
        eq(canonicalAiRequests.useCaseType, uc),
        sql`(${canonicalAiRequests.sourceMetadata} ->> 'organizationId') = ${org}`
      ))
      .orderBy(desc(canonicalAiRequests.requestedAt));

    return requests.find((request) => {
      const meta = this.asRecord(request.sourceMetadata);
      const currentLayer = Number(meta.currentLayer || 0);
      const status = String(meta.status || "").toLowerCase();
      return currentLayer > 1 || (status && status !== "intake");
    }) || null;
  }

  async getLatestRequestByUseCase(decisionSpineId: string, useCaseType: string) {
    const input = (useCaseType || "").trim();
    if (!input) return null;

    const normalized = input
      .replaceAll(/[\s-]+/g, "_")
      .replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replaceAll(/__+/g, "_")
      .toLowerCase();
    const compact = normalized.replaceAll("_", "");
    const lowerInput = input.toLowerCase();

    const tryQuery = async (predicate: ReturnType<typeof eq>) => {
      const [request] = await db
        .select()
        .from(canonicalAiRequests)
        .where(and(eq(canonicalAiRequests.decisionSpineId, decisionSpineId), predicate))
        .orderBy(desc(canonicalAiRequests.requestedAt))
        .limit(1);
      return request || null;
    };

    const exact = await tryQuery(eq(canonicalAiRequests.useCaseType, input));
    if (exact) return exact;

    const lowerMatch = await tryQuery(sql`lower(${canonicalAiRequests.useCaseType}) = ${lowerInput}`);
    if (lowerMatch) return lowerMatch;

    if (normalized !== lowerInput) {
      const normalizedMatch = await tryQuery(sql`lower(${canonicalAiRequests.useCaseType}) = ${normalized}`);
      if (normalizedMatch) return normalizedMatch;
    }

    if (compact && compact !== normalized) {
      const compactMatch = await tryQuery(sql`lower(${canonicalAiRequests.useCaseType}) = ${compact}`);
      if (compactMatch) return compactMatch;
    }

    return null;
  }

  async getLatestMeaningfulRequestByUseCase(decisionSpineId: string, useCaseType: string) {
    const input = (useCaseType || "").trim();
    if (!input) return null;

    const normalized = input
      .replaceAll(/[\s-]+/g, "_")
      .replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replaceAll(/__+/g, "_")
      .toLowerCase();
    const compact = normalized.replaceAll("_", "");
    const lowerInput = input.toLowerCase();

    const findMeaningful = async (predicate: ReturnType<typeof eq>) => {
      const requests = await db
        .select()
        .from(canonicalAiRequests)
        .where(and(eq(canonicalAiRequests.decisionSpineId, decisionSpineId), predicate))
        .orderBy(desc(canonicalAiRequests.requestedAt));
      return requests.find((request) => {
        const meta = this.asRecord(request.sourceMetadata);
        const currentLayer = Number(meta.currentLayer || 0);
        const status = String(meta.status || "").toLowerCase();
        return currentLayer > 1 || (status && status !== "intake");
      }) || null;
    };

    return await findMeaningful(eq(canonicalAiRequests.useCaseType, input))
      || await findMeaningful(sql`lower(${canonicalAiRequests.useCaseType}) = ${lowerInput}`)
      || (normalized !== lowerInput ? await findMeaningful(sql`lower(${canonicalAiRequests.useCaseType}) = ${normalized}`) : null)
      || (compact !== normalized.replaceAll("_", "") ? await findMeaningful(sql`lower(${canonicalAiRequests.useCaseType}) = ${compact}`) : null)
      || null;
  }

  private async getRequestContext(decisionId: string): Promise<{ requestId: string | null; iplanId: string | null; iplanHash: string | null }> {
    const request = await this.getLatestRequest(decisionId);
    if (!request) return { requestId: null, iplanId: null, iplanHash: null };
    const [plan] = await db
      .select()
      .from(intelligencePlans)
      .where(eq(intelligencePlans.requestId, request.requestId));
    return { requestId: request.requestId, iplanId: plan?.iplanId || null, iplanHash: plan?.iplanHash || null };
  }

  async getEnginePluginIdByKind(kind: string): Promise<string | null> {
    const [engine] = await db.select().from(enginePlugins).where(eq(enginePlugins.kind, kind as EngineKind));
    return engine?.enginePluginId || null;
  }

  private toDecisionRecord(decision: DecisionSpineRow, request: CanonicalAiRequestRow | null): CoreviaDecisionRecord {
    const routeKey = (request?.useCaseType || "").split(".").slice(1).join(".") || request?.useCaseType || "";
    const sourceMetadata = (request?.sourceMetadata || {}) as Record<string, unknown>;
    return {
      id: decision.decisionSpineId,
      requestId: request?.requestId || null,
      correlationId: request?.correlationId || "",
      serviceId: request?.useCaseType || "",
      routeKey,
      inputData: (request?.inputPayload || {}) as Record<string, unknown>,
      normalizedInput: (sourceMetadata.normalizedInput || null) as Record<string, unknown> | null,
      currentLayer: (sourceMetadata.currentLayer as number | undefined) || null,
      status: (sourceMetadata.status as string | undefined) || null,
      userId: request?.requestedBy || null,
      organizationId: (sourceMetadata.organizationId as string | undefined) || null,
      classification: (decision.classification as string) || null,
      riskLevel: decision.riskLevel || null,
      sector: decision.sector || null,
      jurisdiction: decision.jurisdiction || null,
      createdAt: decision.createdAt || null,
      updatedAt: decision.updatedAt || null,
      spineTitle: decision.title || null,
      demandProjectName: null,
    };
  }

  private async resolveRequestRow(decisionId: string, requestId?: string | null): Promise<CanonicalAiRequestRow | null> {
    const explicitRequestId = (requestId || "").trim();
    if (explicitRequestId) {
      const [request] = await db
        .select()
        .from(canonicalAiRequests)
        .where(eq(canonicalAiRequests.requestId, explicitRequestId));
      if (request && request.decisionSpineId === decisionId) {
        return request;
      }
    }
    return this.getLatestRequest(decisionId);
  }

  private mapDecisionStatus(status?: string | null): "IN_PROGRESS" | "READY_FOR_CONCLUSION" | "CONCLUDED" | "CANCELLED" {
    switch (status) {
      case "approved":
      case "memory":
        return "READY_FOR_CONCLUSION";
      case "completed":
      case "executed":
        return "CONCLUDED";
      case "blocked":
      case "rejected":
        return "CANCELLED";
      default:
        return "IN_PROGRESS";
    }
  }

  private mapRequestStatus(status?: string | null): string {
    const normalized = String(status || "").trim().toLowerCase();
    if (!normalized) return "RECEIVED";

    switch (normalized) {
      case "completed":
      case "executed":
      case "memory":
      case "approved":
        return "COMPLETED";
      case "blocked":
      case "rejected":
      case "failed":
        return "FAILED";
      case "pending_approval":
        return "PENDING_APPROVAL";
      default:
        return "PROCESSING";
    }
  }

  private extractApprovedActions(approval: ApprovalRow | null | undefined, fallback?: unknown): unknown[] {
    if (Array.isArray(fallback)) return fallback;
    const conditions = Array.isArray(approval?.conditions) ? approval.conditions : [];
    return conditions.flatMap((entry) => {
      const record = this.asRecord(entry);
      const actions = record.approvedActions;
      return Array.isArray(actions) ? actions : [];
    });
  }

  private async syncApprovalState(
    decisionId: string,
    status: unknown,
    approval?: ApprovalRow | null,
    actorId?: string | null,
  ): Promise<void> {
    const approvalStatus = this.normalizeApprovalStatus(status);
    if (approvalStatus === "pending") return;

    const now = new Date();
    const approvedActions = this.extractApprovedActions(approval);
    const actor = actorId || approval?.approvedBy || "system:corevia-brain";
    const conclusion = approvalStatus === "approved" ? "APPROVED_TO_EXECUTE" : "REJECTED";

    await db
      .update(decisionSpines)
      .set({
        status: this.mapDecisionStatus(approvalStatus),
        updatedAt: now,
      })
      .where(eq(decisionSpines.decisionSpineId, decisionId));

    const request = await this.getLatestRequest(decisionId);
    if (request) {
      const requestMetadata = this.asRecord(request.sourceMetadata);
      const currentLayer = Number(requestMetadata.currentLayer || 0);
      await db
        .update(canonicalAiRequests)
        .set({
          status: this.mapRequestStatus(approvalStatus),
          sourceMetadata: {
            ...requestMetadata,
            currentLayer: Math.max(currentLayer, 8),
            status: approvalStatus,
          },
        })
        .where(eq(canonicalAiRequests.requestId, request.requestId));
    }

    await this.ensureMemoryEntry(decisionId);
    await db
      .update(decisionLedgerRecords)
      .set({
        conclusion,
        approvalsSummary: {
          status: approvalStatus,
          approvalId: approval?.approvalId || null,
          approvedBy: actor,
          approvedActions,
        },
      })
      .where(eq(decisionLedgerRecords.decisionSpineId, decisionId));

    const artifactStatus = approvalStatus === "approved" ? "APPROVED" : "REJECTED";
    const subDecisionStatus = approvalStatus === "approved" ? "APPROVED" : "REJECTED";
    const intakeArtifactTypes = ["DEMAND_REQUEST", "DEMAND_FIELDS"];
    await db
      .update(decisionArtifacts)
      .set({
        status: artifactStatus as typeof artifactStatusEnum.enumValues[number],
        updatedAt: now,
      })
      .where(and(
        eq(decisionArtifacts.decisionSpineId, decisionId),
        inArray(decisionArtifacts.artifactType, intakeArtifactTypes),
      ));
    await db
      .update(subDecisions)
      .set({
        status: subDecisionStatus as typeof subdecisionStatusEnum.enumValues[number],
        updatedAt: now,
      })
      .where(and(
        eq(subDecisions.decisionSpineId, decisionId),
        inArray(subDecisions.subDecisionType, intakeArtifactTypes),
      ));

    if (approvalStatus === "approved") {
      return;
    }

    const [report] = await db
      .select()
      .from(demandReports)
      .where(eq(demandReports.decisionSpineId, decisionId))
      .limit(1);
    if (!report) return;

    const existingHistory = Array.isArray(report.workflowHistory) ? report.workflowHistory : [];
    const existingStatus = String(report.workflowStatus || "");
    const decisionReason = "Rejected by Corevia Brain validation and governance.";

    await db
      .update(demandReports)
      .set({
        workflowStatus: "rejected",
        decisionReason,
        rejectedAt: report.rejectedAt || now,
        workflowHistory: [
          ...existingHistory,
          {
            timestamp: now.toISOString(),
            previousStatus: existingStatus || "generated",
            newStatus: "rejected",
            reason: decisionReason,
            user: actor,
            source: "corevia-brain",
            decisionSpineId: decisionId,
            approvalId: approval?.approvalId || null,
          },
        ],
        updatedAt: now,
      })
      .where(eq(demandReports.id, report.id));
  }

  private accumulatePipelineStatsRow(
    row: Record<string, unknown>,
    statusCounts: {
      processing: number;
      pending: number;
      blocked: number;
      completed: number;
      needsInfo: number;
    },
    classificationCounts: Record<string, number>,
    layerCounts: Record<number, number>,
    today: Date,
  ): boolean {
    const meta = (row.sourceMetadata || {}) as Record<string, unknown>;
    const pipelineStatus = typeof meta.status === "string" ? meta.status : null;
    const currentLayer = typeof meta.currentLayer === "number" ? meta.currentLayer : null;

    this.incrementPipelineStatusCounts(statusCounts, pipelineStatus);

    if (typeof currentLayer === "number") {
      layerCounts[currentLayer] = (layerCounts[currentLayer] || 0) + 1;
    }

    this.incrementPipelineClassification(classificationCounts, row.classification, currentLayer);
    return this.isSameDayOrAfter(row.createdAt, today);
  }

  private toApprovalRecord(approval: Record<string, unknown>): Record<string, unknown> | null {
    if (!approval) return approval;
    const conditions = Array.isArray(approval.conditions) ? approval.conditions as unknown[] : [];
    const latestCondition = this.asRecord(conditions[conditions.length - 1]);
    const conditionStatus = this.toOptionalString(latestCondition.status);
    let status = conditionStatus || "pending";
    if (!conditionStatus && approval.outcome === "APPROVE") {
      status = "approved";
    } else if (!conditionStatus && approval.outcome === "REJECT") {
      status = "rejected";
    }
    const approvedActions = conditions.flatMap((entry) => {
      const actions = this.asRecord(entry).approvedActions;
      return Array.isArray(actions) ? actions : [];
    });
    return { ...approval, status, approvedActions };
  }

  private buildApprovalConditions(
    data: Record<string, unknown>,
    existing?: ApprovalRow | Record<string, unknown> | null,
  ): Record<string, unknown>[] {
    const existingConditions = Array.isArray(existing?.conditions)
      ? existing.conditions as Record<string, unknown>[]
      : [];
    const latestExisting = this.asRecord(existingConditions[existingConditions.length - 1]);
    const existingMetadata = this.asRecord(latestExisting.metadata);
    const approvedActions = Array.isArray(data.approvedActions) ? data.approvedActions : [];

    return [{
      status: data.status,
      approvedActions,
      ...(Object.keys(existingMetadata).length > 0 ? { metadata: existingMetadata } : {}),
    }];
  }

  async createDecision(data: {
    correlationId: string;
    serviceId: string;
    routeKey: string;
    inputData: Record<string, unknown>;
    userId: string;
    organizationId?: string | null;
    currentLayer?: number;
    status?: string;
    decisionSpineId?: string;
  }): Promise<CoreviaDecisionRecord> {
    await this.ensurePrincipal(data.userId);
    await this.ensureUseCase(data.serviceId);

    // Note: top-level approval gating for internal RAG / reasoning / version_impact
    // routes lives in the pipeline orchestrator (`isInternalSupportRoute`). Storage
    // always persists the spine for audit; classification defaults to INTERNAL below.

    const demandReportId = this.pickPreferredString([
      data.inputData?.demandReportId,
      data.inputData?.reportId,
    ]);
    const existingDecision = !data.decisionSpineId && demandReportId
      ? await this.findLatestDecisionByDemandReportId(demandReportId)
      : null;
    const decisionSpineId = data.decisionSpineId || existingDecision?.id || `DSP-${randomUUID()}`;

    // Derive a meaningful spine title from input data rather than the raw routeKey.
    const spineTitle = this.pickPreferredString([
      data.inputData?.suggestedProjectName,
      data.inputData?.projectName,
      data.inputData?.title,
    ], data.routeKey) || data.routeKey;

    // IMPORTANT: canonical_ai_requests has an FK to decision_spines, so the spine row must exist
    // before we insert the canonical request record.
    // We still mark internal operations as classification INTERNAL; downstream list views can
    // choose to filter them out.
    if (data.decisionSpineId || !existingDecision) {
      await db
        .insert(decisionSpines)
        .values({
          decisionSpineId,
          title: spineTitle,
          createdBy: data.userId,
          classification: "INTERNAL",
        })
        .onConflictDoNothing({ target: decisionSpines.decisionSpineId });
    }

    const requestId = `REQ-${randomUUID()}`;
    await db.insert(canonicalAiRequests).values({
      requestId,
      correlationId: data.correlationId,
      decisionSpineId,
      useCaseType: data.serviceId,
      requestedBy: data.userId,
      requestedAt: new Date(),
      inputPayload: data.inputData,
      sourceMetadata: {
        normalizedInput: data.inputData,
        currentLayer: data.currentLayer || 1,
        status: data.status || "intake",
        organizationId: data.organizationId || null,
      },
      status: "RECEIVED",
    });

    const decision = await db
      .select()
      .from(decisionSpines)
      .where(eq(decisionSpines.decisionSpineId, decisionSpineId))
      .then(rows => rows[0]!);
    const request = await this.getLatestRequest(decisionSpineId);
    return this.toDecisionRecord(decision, request);
  }

  async getDecision(id: string): Promise<CoreviaDecisionRecord | null> {
    const [decision] = await db.select().from(decisionSpines).where(eq(decisionSpines.decisionSpineId, id));
    if (!decision) return null;
    const request = await this.getLatestRequest(id);
    return this.toDecisionRecord(decision, request);
  }

  async getSpine(decisionSpineId: string): Promise<DecisionSpineRow | null> {
    const [spine] = await db
      .select()
      .from(decisionSpines)
      .where(eq(decisionSpines.decisionSpineId, decisionSpineId));
    return spine || null;
  }

  async updateSpineStatus(decisionSpineId: string, status: string): Promise<void> {
    await db
      .update(decisionSpines)
      .set({
        status: status as typeof decisionSpineStatusEnum.enumValues[number],
        updatedAt: new Date(),
      })
      .where(eq(decisionSpines.decisionSpineId, decisionSpineId));
  }

  async addSpineEvent(
    decisionSpineId: string,
    eventType: string,
    actorId?: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await db.insert(brainEvents).values({
      correlationId: null,
      decisionSpineId,
      eventType,
      actorId: actorId || undefined,
      payload: payload || {},
    });
  }

  async listSubDecisions(decisionSpineId: string): Promise<SubDecisionRow[]> {
    return db
      .select()
      .from(subDecisions)
      .where(eq(subDecisions.decisionSpineId, decisionSpineId))
      .orderBy(desc(subDecisions.createdAt));
  }

  async findSubDecision(decisionSpineId: string, subDecisionType: string): Promise<SubDecisionRow | null> {
    // Prefer the latest non-SUPERSEDED sub-decision. When EDIT_NEW_VERSION is used,
    // old sub-decisions are marked SUPERSEDED and a new DRAFT one is created.
    // Without ordering, we might return the SUPERSEDED row instead of the active one.
    const rows = await db
      .select()
      .from(subDecisions)
      .where(and(
        eq(subDecisions.decisionSpineId, decisionSpineId),
        eq(subDecisions.subDecisionType, subDecisionType),
      ))
      .orderBy(desc(subDecisions.createdAt));
    // Prefer non-superseded; fall back to any row
    const active = rows.find((row) => row.status !== "SUPERSEDED");
    return active || rows[0] || null;
  }

  async getSubDecision(subDecisionId: string): Promise<SubDecisionRow | null> {
    const [subDecision] = await db
      .select()
      .from(subDecisions)
      .where(eq(subDecisions.subDecisionId, subDecisionId));
    return subDecision || null;
  }

  async areSubDecisionsApproved(decisionSpineId: string, subDecisionTypes: string[]): Promise<boolean> {
    if (subDecisionTypes.length === 0) return true;

    const rows = await db
      .select({ subDecisionType: subDecisions.subDecisionType, status: subDecisions.status })
      .from(subDecisions)
      .where(and(
        eq(subDecisions.decisionSpineId, decisionSpineId),
        inArray(subDecisions.subDecisionType, subDecisionTypes),
      ));

    const statusByType = new Map(rows.map(row => [row.subDecisionType, row.status]));
    return subDecisionTypes.every(type => statusByType.get(type) === "APPROVED");
  }

  async isSubDecisionApproved(decisionSpineId: string, subDecisionType: string): Promise<boolean> {
    const subDecision = await this.findSubDecision(decisionSpineId, subDecisionType) as { status?: string } | null;
    return subDecision?.status === "APPROVED";
  }

  async getLatestApprovalForSubDecisionType(
    decisionSpineId: string,
    subDecisionType: string,
  ): Promise<ApprovalRow | null> {
    const subDecision = await this.findSubDecision(decisionSpineId, subDecisionType);
    if (!subDecision?.subDecisionId) return null;

    const [approval] = await db
      .select()
      .from(approvals)
      .where(eq(approvals.subDecisionId, subDecision.subDecisionId))
      .orderBy(desc(approvals.createdAt))
      .limit(1);
    return approval || null;
  }

  async hasSucceededExecution(decisionSpineId: string, actionTypes?: string[]): Promise<boolean> {
    const rows = await db
      .select({ status: executions.status })
      .from(executions)
      .where(
        actionTypes && actionTypes.length > 0
          ? and(
              eq(executions.decisionSpineId, decisionSpineId),
              inArray(executions.actionType, actionTypes),
            )
          : eq(executions.decisionSpineId, decisionSpineId)
      );
    return rows.some(row => row.status === "SUCCEEDED");
  }

  async getProjectRefForDecision(decisionSpineId: string): Promise<Record<string, unknown> | null> {
    const [ledger] = await db
      .select()
      .from(decisionLedgerRecords)
      .where(eq(decisionLedgerRecords.decisionSpineId, decisionSpineId));
    if (ledger?.projectRef) return ledger.projectRef as Record<string, unknown>;

    const execs = await db
      .select({ resultPayload: executions.resultPayload })
      .from(executions)
      .where(eq(executions.decisionSpineId, decisionSpineId))
      .orderBy(desc(executions.createdAt));

    for (const exec of execs) {
      const payload = exec.resultPayload as Record<string, unknown>;
      if (!payload) continue;
      if (payload.projectRef || payload.projectId || payload.project) {
        return {
          projectRef: payload.projectRef,
          projectId: payload.projectId,
          project: payload.project,
        };
      }
    }

    return null;
  }

  async updateLedgerProjectRef(decisionSpineId: string, projectRef: Record<string, unknown>): Promise<void> {
    const [ledger] = await db
      .select()
      .from(decisionLedgerRecords)
      .where(eq(decisionLedgerRecords.decisionSpineId, decisionSpineId));
    if (!ledger) return;

    await db
      .update(decisionLedgerRecords)
      .set({ projectRef })
      .where(eq(decisionLedgerRecords.ledgerId, ledger.ledgerId));
  }

  async canStartProjectWork(decisionSpineId: string): Promise<boolean> {
    const [ledger] = await db
      .select()
      .from(decisionLedgerRecords)
      .where(eq(decisionLedgerRecords.decisionSpineId, decisionSpineId));
    const concluded = ledger?.conclusion === "APPROVED_TO_EXECUTE" || ledger?.conclusion === "COMPLETED";
    if (!concluded) return false;

    if (ledger?.projectRef) return true;
    const projectRef = await this.getProjectRefForDecision(decisionSpineId);
    return Boolean(projectRef);
  }

  async createDecisionArtifact(params: {
    decisionSpineId: string;
    artifactType: string;
    createdBy?: string;
  }): Promise<ArtifactRow> {
    const [artifact] = await db
      .insert(decisionArtifacts)
      .values({
        artifactId: `ART-${randomUUID()}`,
        decisionSpineId: params.decisionSpineId,
        artifactType: params.artifactType,
        status: "DRAFT",
        currentVersion: 1,
        createdBy: params.createdBy || undefined,
        updatedAt: new Date(),
      })
      .returning();
    return requireRow(artifact, "Failed to create decision artifact");
  }

  async updateDecisionArtifactStatus(artifactId: string, status: string): Promise<void> {
    await db
      .update(decisionArtifacts)
      .set({ status: status as typeof artifactStatusEnum.enumValues[number], updatedAt: new Date() })
      .where(eq(decisionArtifacts.artifactId, artifactId));
  }

  async listArtifactsForSpine(decisionSpineId: string): Promise<Array<{ artifactId: string; artifactType: string; status: string }>> {
    const rows = await db
      .select({
        artifactId: decisionArtifacts.artifactId,
        artifactType: decisionArtifacts.artifactType,
        status: decisionArtifacts.status,
      })
      .from(decisionArtifacts)
      .where(eq(decisionArtifacts.decisionSpineId, decisionSpineId));
    return rows.map(r => ({ artifactId: r.artifactId, artifactType: r.artifactType, status: r.status }));
  }

  /**
   * Returns the complete sub-artifact hierarchy for a project spine.
   * Each entry represents a sub-decision in the project flow
   * (e.g. demand → business_case → requirements → strategic_fit → wbs).
   */
  async getProjectFlowStatus(decisionSpineId: string): Promise<Array<{
    subDecisionType: string;
    subDecisionStatus: string;
    artifactId: string | null;
    artifactStatus: string | null;
    latestVersion: number | null;
  }>> {
    const subs = await db
      .select({
        subDecisionType: subDecisions.subDecisionType,
        subDecisionStatus: subDecisions.status,
        artifactId: subDecisions.artifactId,
      })
      .from(subDecisions)
      .where(eq(subDecisions.decisionSpineId, decisionSpineId));

    const result: Array<{
      subDecisionType: string;
      subDecisionStatus: string;
      artifactId: string | null;
      artifactStatus: string | null;
      latestVersion: number | null;
    }> = [];

    for (const sub of subs) {
      let artifactStatus: string | null = null;
      let latestVersion: number | null = null;

      if (sub.artifactId) {
        const [art] = await db
          .select({ status: decisionArtifacts.status, currentVersion: decisionArtifacts.currentVersion })
          .from(decisionArtifacts)
          .where(eq(decisionArtifacts.artifactId, sub.artifactId))
          .limit(1);
        if (art) {
          artifactStatus = art.status;
          latestVersion = art.currentVersion;
        }
      }

      result.push({
        subDecisionType: sub.subDecisionType,
        subDecisionStatus: sub.subDecisionStatus,
        artifactId: sub.artifactId,
        artifactStatus,
        latestVersion,
      });
    }

    return result;
  }

  async createDecisionArtifactVersion(params: {
    artifactId: string;
    content: Record<string, unknown>;
    changeSummary?: string | null;
    createdBy?: string;
  }): Promise<ArtifactVersionRow> {
    const [latest] = await db
      .select()
      .from(decisionArtifactVersions)
      .where(eq(decisionArtifactVersions.artifactId, params.artifactId))
      .orderBy(desc(decisionArtifactVersions.version))
      .limit(1);

    if (latest && this.stableStringify(latest.content || {}) === this.stableStringify(params.content || {})) {
      await db
        .update(decisionArtifacts)
        .set({ currentVersion: latest.version, updatedAt: new Date() })
        .where(eq(decisionArtifacts.artifactId, params.artifactId));
      return latest;
    }

    const nextVersion = (latest?.version || 0) + 1;
    const [version] = await db
      .insert(decisionArtifactVersions)
      .values({
        artifactVersionId: `ARTV-${randomUUID()}`,
        artifactId: params.artifactId,
        version: nextVersion,
        content: params.content,
        changeSummary: params.changeSummary || undefined,
        createdBy: params.createdBy || undefined,
      })
      .returning();

    await db
      .update(decisionArtifacts)
      .set({ currentVersion: nextVersion, updatedAt: new Date() })
      .where(eq(decisionArtifacts.artifactId, params.artifactId));

    const [artifact] = await db
      .select({ decisionSpineId: decisionArtifacts.decisionSpineId, artifactType: decisionArtifacts.artifactType })
      .from(decisionArtifacts)
      .where(eq(decisionArtifacts.artifactId, params.artifactId));

    if (artifact?.decisionSpineId) {
      await this.addSpineEvent(artifact.decisionSpineId, "ARTIFACT_VERSION_CREATED", params.createdBy, {
        artifactId: params.artifactId,
        artifactType: artifact.artifactType,
        artifactVersionId: version?.artifactVersionId,
        version: nextVersion,
      });
    }

    return requireRow(version, "Failed to create decision artifact version");
  }

  async upsertDecisionArtifactVersion(params: {
    decisionSpineId: string;
    artifactType: string;
    subDecisionType?: string;
    content: Record<string, unknown>;
    changeSummary?: string | null;
    createdBy?: string;
  }): Promise<{ artifact: ArtifactRow; version: ArtifactVersionRow | null; subDecision: SubDecisionRow | null }> {
    const { decisionSpineId, artifactType, subDecisionType, content, changeSummary, createdBy } = params;

    const [existingArtifact] = await db
      .select()
      .from(decisionArtifacts)
      .where(and(
        eq(decisionArtifacts.decisionSpineId, decisionSpineId),
        eq(decisionArtifacts.artifactType, artifactType),
      ))
      .limit(1);

    const artifact = existingArtifact || await this.createDecisionArtifact({
      decisionSpineId,
      artifactType,
      createdBy,
    });

    const effectiveSubDecisionType = subDecisionType || artifactType;

    // Skip sub-decision creation for internal brain operations (RAG, reasoning, etc.)
    const internalArtifactTypes = new Set([
      "RAG_QUERY_EXPANSION", "RAG_QUERY_REWRITE", "RAG_CLASSIFICATION", "RAG_RERANK",
      "REASONING_TRACE", "VERSION_IMPACT_ANALYSIS",
    ]);
    const skipSubDecision = internalArtifactTypes.has(effectiveSubDecisionType);

    let subDecision = (!skipSubDecision && effectiveSubDecisionType)
      ? await this.findSubDecision(decisionSpineId, effectiveSubDecisionType)
      : null;

    if (!skipSubDecision && !subDecision && effectiveSubDecisionType) {
      subDecision = await this.createSubDecision({
        decisionSpineId,
        subDecisionType: effectiveSubDecisionType,
        artifactId: artifact.artifactId,
        status: "DRAFT",
        createdBy,
      });
    } else if (subDecision && subDecision.artifactId !== artifact.artifactId) {
      await db
        .update(subDecisions)
        .set({ artifactId: artifact.artifactId, updatedAt: new Date() })
        .where(eq(subDecisions.subDecisionId, subDecision.subDecisionId));
      subDecision = await this.getSubDecision(subDecision.subDecisionId);
    }

    const version = await this.createDecisionArtifactVersion({
      artifactId: artifact.artifactId,
      content,
      changeSummary: changeSummary || undefined,
      createdBy,
    });

    return { artifact, version, subDecision };
  }

  async getLatestDecisionArtifactVersion(params: {
    decisionSpineId: string;
    artifactType: string;
  }): Promise<null | {
    artifactId: string;
    artifactType: string;
    status: string;
    version: number;
    artifactVersionId: string;
    content: Record<string, unknown>;
    createdAt: string;
  }> {
    const [artifact] = await db
      .select()
      .from(decisionArtifacts)
      .where(and(
        eq(decisionArtifacts.decisionSpineId, params.decisionSpineId),
        eq(decisionArtifacts.artifactType, params.artifactType),
      ))
      .limit(1);

    if (!artifact) return null;

    const [latest] = await db
      .select()
      .from(decisionArtifactVersions)
      .where(eq(decisionArtifactVersions.artifactId, artifact.artifactId))
      .orderBy(desc(decisionArtifactVersions.version))
      .limit(1);

    if (!latest) return null;

    return {
      artifactId: artifact.artifactId,
      artifactType: artifact.artifactType,
      status: artifact.status,
      version: latest.version,
      artifactVersionId: latest.artifactVersionId,
      content: (latest.content || {}) as Record<string, unknown>,
      createdAt: (latest.createdAt instanceof Date ? latest.createdAt.toISOString() : String(latest.createdAt)),
    };
  }

  async getLatestArtifactVersionId(artifactId: string | null): Promise<string | null> {
    if (!artifactId) return null;
    const [latest] = await db
      .select()
      .from(decisionArtifactVersions)
      .where(eq(decisionArtifactVersions.artifactId, artifactId))
      .orderBy(desc(decisionArtifactVersions.version))
      .limit(1);
    return latest?.artifactVersionId || null;
  }

  async createSubDecision(params: {
    decisionSpineId: string;
    subDecisionType: string;
    artifactId: string | null;
    status?: string;
    createdBy?: string;
  }): Promise<SubDecisionRow> {
    const [subDecision] = await db
      .insert(subDecisions)
      .values({
        subDecisionId: `SUB-${randomUUID()}`,
        decisionSpineId: params.decisionSpineId,
        subDecisionType: params.subDecisionType,
        status: (params.status || "DRAFT") as typeof subdecisionStatusEnum.enumValues[number],
        artifactId: params.artifactId || undefined,
        requiredAuthority: null,
        updatedAt: new Date(),
      })
      .returning();
    return requireRow(subDecision, "Failed to create sub-decision");
  }

  async updateSubDecisionStatus(subDecisionId: string, status: string): Promise<void> {
    await db
      .update(subDecisions)
      .set({ status: status as typeof subdecisionStatusEnum.enumValues[number], updatedAt: new Date() })
      .where(eq(subDecisions.subDecisionId, subDecisionId));
  }

  async createSubDecisionApproval(params: {
    approvalId: string;
    decisionSpineId: string;
    subDecisionId: string;
    artifactId?: string | null;
    artifactVersionId?: string | null;
    approvedBy?: string;
  }): Promise<void> {
    await db
      .insert(approvals)
      .values({
        approvalId: params.approvalId,
        decisionSpineId: params.decisionSpineId,
        subDecisionId: params.subDecisionId,
        artifactId: params.artifactId || undefined,
        artifactVersionId: params.artifactVersionId || undefined,
        outcome: "APPROVE",
        approvedBy: params.approvedBy || undefined,
        conditions: [],
      })
      .onConflictDoNothing();

    const [subDecision] = await db
      .select({ subDecisionType: subDecisions.subDecisionType })
      .from(subDecisions)
      .where(eq(subDecisions.subDecisionId, params.subDecisionId));

    await this.addSpineEvent(params.decisionSpineId, "APPROVAL_DECIDED", params.approvedBy, {
      approvalId: params.approvalId,
      subDecisionId: params.subDecisionId,
      subDecisionType: subDecision?.subDecisionType,
      outcome: "APPROVE",
      scope: "subdecision",
    });
  }

  async createExecutionJob(params: {
    decisionSpineId: string;
    approvalId: string;
    actionType: string;
    idempotencyKey: string;
    requestPayload?: Record<string, unknown> | null;
  }): Promise<void> {
    const [existing] = await db
      .select()
      .from(executions)
      .where(eq(executions.idempotencyKey, params.idempotencyKey));
    if (existing) return;

    await db.insert(executions).values({
      executionId: `EXE-${randomUUID()}`,
      approvalId: params.approvalId,
      decisionSpineId: params.decisionSpineId,
      actionType: params.actionType,
      idempotencyKey: params.idempotencyKey,
      status: "PENDING",
      requestPayload: params.requestPayload || {},
      resultPayload: {},
    });
  }

  async ensureLedgerConclusion(decisionSpineId: string, conclusion: "APPROVED_TO_EXECUTE" | "COMPLETED"): Promise<void> {
    await this.ensureMemoryEntry(decisionSpineId);
    await this.updateLedgerConclusion(decisionSpineId, conclusion);
  }

  async getDecisionByCorrelationId(correlationId: string): Promise<CoreviaDecisionRecord | null> {
    const [request] = await db
      .select()
      .from(canonicalAiRequests)
      .where(eq(canonicalAiRequests.correlationId, correlationId))
      .orderBy(desc(canonicalAiRequests.requestedAt))
      .limit(1);
    if (!request?.decisionSpineId) return null;
    return this.getDecision(request.decisionSpineId);
  }

  async updateDecision(id: string, data: Partial<CoreviaDecisionRecord>): Promise<CoreviaDecisionRecord | null> {
    const spineUpdate: Partial<typeof decisionSpines.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.status !== undefined) {
      const mapped = this.mapDecisionStatus(data.status);
      // Guard: never CANCEL a spine that already has an APPROVE outcome recorded.
      // Engine failures (Engine B / Engine A) can surface as Layer-6 status="blocked"; if PMO has
      // already approved, the spine must remain in READY_FOR_CONCLUSION so the post-approval
      // re-generation path stays alive.
      if (mapped === "CANCELLED") {
        const [approvedRow] = await db
          .select({ approvalId: approvals.approvalId })
          .from(approvals)
          .where(and(eq(approvals.decisionSpineId, id), eq(approvals.outcome, "APPROVE")))
          .limit(1);
        if (approvedRow) {
          spineUpdate.status = "READY_FOR_CONCLUSION";
        } else {
          spineUpdate.status = mapped;
        }
      } else {
        spineUpdate.status = mapped;
      }
    }

    await db
      .update(decisionSpines)
      .set(spineUpdate)
      .where(eq(decisionSpines.decisionSpineId, id));

    const request = await this.resolveRequestRow(id, data.requestId);
    if (request) {
      const requestMetadata = this.asRecord(request.sourceMetadata);
      await db
        .update(canonicalAiRequests)
        .set({
          status: this.mapRequestStatus(data.status ?? String(request.status || "")),
          inputPayload: data.inputData || request.inputPayload,
          sourceMetadata: {
            ...requestMetadata,
            normalizedInput: data.normalizedInput || requestMetadata.normalizedInput,
            currentLayer: data.currentLayer ?? requestMetadata.currentLayer,
            status: data.status ?? requestMetadata.status,
            organizationId: data.organizationId ?? requestMetadata.organizationId,
          },
        })
        .where(eq(canonicalAiRequests.requestId, request.requestId));
    }

    if (data.status === "approved" || data.status === "rejected") {
      const [approval] = await db
        .select()
        .from(approvals)
        .where(eq(approvals.decisionSpineId, id))
        .limit(1);
      await this.syncApprovalState(id, data.status, approval || null, data.userId);
    }

    return this.getDecision(id);
  }

  async listDecisions(limit = 50, offset = 0): Promise<CoreviaDecisionRecord[]> {
    return this.listDecisionsScoped(limit, offset);
  }

  async listDecisionsScoped(
    limit = 50,
    offset = 0,
    options?: { organizationId?: string | null; isSystemAdmin?: boolean; scope?: "governance" | "reasoning" | "rag" }
  ): Promise<CoreviaDecisionRecord[]> {
    const organizationId = options?.organizationId || null;
    const isSystemAdmin = Boolean(options?.isSystemAdmin);
    const scope = options?.scope || "governance";

    // Scope-driven SQL fragments:
    //  - governance (default): only spines linked to a real demand_report, excluding internal
    //    rag/reasoning/language sub-routes (those run inside the governance journey).
    //  - reasoning: surface advisory/operational reasoning spines (use_case_type = 'reasoning').
    //  - rag: surface knowledge/retrieval spines (use_case_type IN rag/language/knowledge).
    // For non-governance scopes we skip the demand_reports INNER JOIN so internal-support spines
    // (which never get a demand_report) become visible in their dedicated tabs.
    const useCaseTypeFilter =
      scope === "reasoning"
        ? sql`r.use_case_type = 'reasoning'`
        : scope === "rag"
        ? sql`r.use_case_type IN ('rag', 'language', 'knowledge')`
        : sql`r.use_case_type NOT IN ('rag', 'reasoning', 'language', 'test_service', 'restricted_service', 'blocked_service')`;
    const demandReportJoin =
      scope === "governance"
        ? sql`INNER JOIN demand_reports dr ON dr.decision_spine_id = ds.decision_spine_id`
        : sql`LEFT JOIN demand_reports dr ON dr.decision_spine_id = ds.decision_spine_id`;

    // Tenant-scoping policy:
    //  - governance scope must always honor (source_metadata->>'organizationId') = $org so
    //    one tenant cannot see another tenant's demand journeys.
    //  - reasoning / rag scopes surface internal Brain support spines (query expansion,
    //    reranking, classification, advisory reasoning). Those are invoked from system
    //    callers (`userId: 'system'`) without an organization context, so their
    //    source_metadata.organizationId is null. Filtering them by tenant would always
    //    return 0 rows. They are INTERNAL classification observability records, so we
    //    skip the tenant filter for these scopes and rely on the use_case_type filter.
    const tenantFilter =
      scope === "governance"
        ? sql`AND (r.source_metadata ->> 'organizationId') = ${options?.organizationId || ""}`
        : sql``;

    // If we have an org context (and not a system admin), filter at the DB layer.
    // This matches the EA multi-tenant boundary and avoids leaking demo-org decisions.
    if (organizationId && !isSystemAdmin) {
      const raw = await db.execute(sql`
        SELECT
          ds.decision_spine_id as "decisionSpineId",
          ds.title as "title",
          ds.status as "dsStatus",
          ds.classification as "classification",
          ds.risk_level as "riskLevel",
          ds.sector as "sector",
          ds.jurisdiction as "jurisdiction",
          ds.created_at as "createdAt",
          ds.updated_at as "updatedAt",

          req.request_id as "requestId",
          req.correlation_id as "correlationId",
          req.decision_spine_id as "reqDecisionSpineId",
          req.use_case_type as "useCaseType",
          req.requested_by as "requestedBy",
          req.requested_at as "requestedAt",
          req.input_payload as "inputPayload",
          req.attachments as "attachments",
          req.source_metadata as "sourceMetadata",
          req.status as "reqStatus",
          dr.suggested_project_name as "demandProjectName"
        FROM decision_spines ds
        ${demandReportJoin}
        LEFT JOIN LATERAL (
          SELECT *
          FROM canonical_ai_requests r
          WHERE r.decision_spine_id = ds.decision_spine_id
            ${tenantFilter}
            AND ${useCaseTypeFilter}
          ORDER BY r.requested_at DESC
          LIMIT 1
        ) req ON true
        WHERE req.request_id IS NOT NULL
        ORDER BY ds.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const rows = ((raw as { rows?: Record<string, unknown>[] }).rows ?? raw) as Record<string, unknown>[];
      const results: CoreviaDecisionRecord[] = [];
      for (const row of rows) {
        const decisionRow = {
          decisionSpineId: row.decisionSpineId,
          title: row.title,
          status: row.dsStatus,
          classification: row.classification,
          riskLevel: row.riskLevel,
          sector: row.sector,
          jurisdiction: row.jurisdiction,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        } as typeof decisionSpines.$inferSelect;
        const requestRow = row.requestId
          ? {
              requestId: row.requestId,
              correlationId: row.correlationId,
              decisionSpineId: row.reqDecisionSpineId,
              useCaseType: row.useCaseType,
              requestedBy: row.requestedBy,
              requestedAt: row.requestedAt,
              inputPayload: row.inputPayload,
              attachments: row.attachments,
              sourceMetadata: row.sourceMetadata,
              status: row.reqStatus,
            } as unknown as typeof canonicalAiRequests.$inferSelect
          : null;
        const record = this.toDecisionRecord(decisionRow, requestRow);
        record.demandProjectName = (row.demandProjectName as string) || null;
        results.push(record);
      }
      return results;
    }

    // Global/system-admin listing: fetch latest request per spine in one query (avoid N+1).
    const raw = await db.execute(sql`
      SELECT
        ds.decision_spine_id as "decisionSpineId",
        ds.title as "title",
        ds.status as "dsStatus",
        ds.classification as "classification",
        ds.risk_level as "riskLevel",
        ds.sector as "sector",
        ds.jurisdiction as "jurisdiction",
        ds.created_at as "createdAt",
        ds.updated_at as "updatedAt",

        req.request_id as "requestId",
        req.correlation_id as "correlationId",
        req.decision_spine_id as "reqDecisionSpineId",
        req.use_case_type as "useCaseType",
        req.requested_by as "requestedBy",
        req.requested_at as "requestedAt",
        req.input_payload as "inputPayload",
        req.attachments as "attachments",
        req.source_metadata as "sourceMetadata",
        req.status as "reqStatus",
        dr.suggested_project_name as "demandProjectName"
      FROM decision_spines ds
      ${demandReportJoin}
      LEFT JOIN LATERAL (
        SELECT *
        FROM canonical_ai_requests r
        WHERE r.decision_spine_id = ds.decision_spine_id
          AND ${useCaseTypeFilter}
        ORDER BY r.requested_at DESC
        LIMIT 1
      ) req ON true
      WHERE req.request_id IS NOT NULL
      ORDER BY ds.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const rows = ((raw as { rows?: Record<string, unknown>[] }).rows ?? raw) as Record<string, unknown>[];
    const results: CoreviaDecisionRecord[] = [];
    for (const row of rows) {
      const decisionRow = {
        decisionSpineId: row.decisionSpineId,
        title: row.title,
        status: row.dsStatus,
        classification: row.classification,
        riskLevel: row.riskLevel,
        sector: row.sector,
        jurisdiction: row.jurisdiction,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      } as typeof decisionSpines.$inferSelect;
      const requestRow = row.requestId
        ? {
            requestId: row.requestId,
            correlationId: row.correlationId,
            decisionSpineId: row.reqDecisionSpineId,
            useCaseType: row.useCaseType,
            requestedBy: row.requestedBy,
            requestedAt: row.requestedAt,
            inputPayload: row.inputPayload,
            attachments: row.attachments,
            sourceMetadata: row.sourceMetadata,
            status: row.reqStatus,
          } as unknown as typeof canonicalAiRequests.$inferSelect
        : null;
      const record = this.toDecisionRecord(decisionRow, requestRow);
      record.demandProjectName = (row.demandProjectName as string) || null;
      results.push(record);
    }
    return results;
  }

  async getDemandProjectNameForSpine(decisionSpineId: string): Promise<string | null> {
    const raw = await db.execute(sql`
      SELECT suggested_project_name
      FROM demand_reports
      WHERE decision_spine_id = ${decisionSpineId}
      LIMIT 1
    `);
    const rows = ((raw as { rows?: Record<string, unknown>[] }).rows ?? raw) as Record<string, unknown>[];
    return (rows[0]?.suggested_project_name as string) || null;
  }

  async findLatestDecisionByDemandReportId(demandReportId: string): Promise<CoreviaDecisionRecord | null> {
    const [request] = await db
      .select()
      .from(canonicalAiRequests)
      .where(sql`(
        ${canonicalAiRequests.inputPayload} ->> 'demandReportId' = ${demandReportId}
        OR ${canonicalAiRequests.inputPayload} ->> 'reportId' = ${demandReportId}
      )`)
      .orderBy(desc(canonicalAiRequests.requestedAt))
      .limit(1);
    if (!request?.decisionSpineId) return null;
    return this.getDecision(request.decisionSpineId);
  }

  async saveClassification(data: {
    decisionId: string;
    requestId?: string | null;
    classificationLevel: string;
    sector?: string | null;
    jurisdiction?: string | null;
    riskLevel?: string | null;
    allowCloudProcessing?: boolean;
    allowExternalModels?: boolean;
    requireHitl?: boolean;
    constraints?: Record<string, unknown> | null;
  }): Promise<void> {
    const decisionId = data.decisionId;
    await db
      .update(decisionSpines)
      .set({
        classification: data.classificationLevel.toUpperCase() as typeof dataClassificationEnum.enumValues[number],
        sector: data.sector || undefined,
        jurisdiction: data.jurisdiction || undefined,
        riskLevel: data.riskLevel || undefined,
        updatedAt: new Date(),
      })
      .where(eq(decisionSpines.decisionSpineId, decisionId));

    const request = await this.resolveRequestRow(decisionId, data.requestId);
    if (!request) return;

    const [existing] = await db.select().from(constraintPacks).where(eq(constraintPacks.requestId, request.requestId));
    if (existing) return;

    await db.insert(constraintPacks).values({
      constraintPackId: `CST-${randomUUID()}`,
      requestId: request.requestId,
      classification: data.classificationLevel.toUpperCase() as typeof dataClassificationEnum.enumValues[number],
      cloudAllowed: data.allowCloudProcessing ?? false,
      externalLlmAllowed: data.allowExternalModels ?? false,
      maskingRequired: true,
      hitlRequired: data.requireHitl ?? true,
      retentionDays: 365,
      enforcementLevel: "STRICT",
      constraintsJson: data.constraints || {},
    });
  }

  async savePolicyEvaluation(data: {
    decisionId: string;
    requestId?: string | null;
    result: string;
    policiesEvaluated?: Record<string, unknown>[];
    blockingPolicy?: string | null;
    blockReason?: string | null;
    approvalRequired?: boolean | null;
    approvalReasons?: string[] | null;
  }): Promise<void> {
    const request = await this.resolveRequestRow(data.decisionId, data.requestId);
    if (!request) return;
    const [existing] = await db.select().from(governanceDecisions).where(eq(governanceDecisions.requestId, request.requestId));
    if (existing) return;

    const requiresApproval = data.result === "require_approval" || data.approvalRequired === true;
    const reason = data.blockReason
      || (Array.isArray(data.approvalReasons) && data.approvalReasons.length > 0
        ? data.approvalReasons.filter(Boolean).join("; ")
        : undefined);

    await db.insert(governanceDecisions).values({
      governanceDecisionId: `GOV-${randomUUID()}`,
      requestId: request.requestId,
      outcome: data.result === "block" ? "BLOCK" : "ALLOW",
      authorityRequired: data.result === "block" || requiresApproval ? "HITL" : null,
      applicablePolicies: data.policiesEvaluated?.map(p => p.policyId as string).filter(Boolean) || [],
      reason,
      constraintsSigned: data.result !== "block",
    });
  }

  async saveContextQuality(data: {
    decisionId: string;
    requestId?: string | null;
    result: string;
    completenessScore: string;
    ambiguityScore: string;
    missingFields?: string[];
    assumptions?: Record<string, unknown>[];
  }): Promise<void> {
    const request = await this.resolveRequestRow(data.decisionId, data.requestId);
    if (!request) return;
    const [existing] = await db.select().from(contextQualityReports).where(eq(contextQualityReports.requestId, request.requestId));
    if (existing) return;

    const normalizeScore = (value: string) => {
      const num = Number(value);
      if (!Number.isFinite(num)) return "0";
      const scaled = num > 1 ? num / 100 : num;
      const clamped = Math.min(1, Math.max(0, scaled));
      return clamped.toFixed(4);
    };

    await db.insert(contextQualityReports).values({
      cqrId: `CQR-${randomUUID()}`,
      requestId: request.requestId,
      outcome: data.result === "needs_info" ? "NEEDS_INFO" : "READY",
      completenessScore: normalizeScore(data.completenessScore),
      ambiguityScore: normalizeScore(data.ambiguityScore),
      missingFields: data.missingFields || [],
      assumptions: data.assumptions || [],
      notes: data.result === "needs_info" ? "Additional info required" : undefined,
    });
  }

  async saveOrchestrationPlan(data: {
    decisionId: string;
    requestId?: string | null;
    useInternalEngine: boolean;
    useHybridEngine: boolean;
    hybridEngineReason?: string | null;
    selectedEngines?: Record<string, unknown> | null;
    toolsAllowed?: string[] | null;
    redactionMode?: string | null;
    budgets?: Record<string, unknown> | null;
    selectedAgents?: Record<string, unknown>[];
    agentPlanPolicy?: Record<string, unknown> | null;
    executionPlan?: Record<string, unknown>[];
    appliedConstraints?: Record<string, unknown> | null;
  }): Promise<void> {
    const request = await this.resolveRequestRow(data.decisionId, data.requestId);
    if (!request) return;
    const [existing] = await db.select().from(intelligencePlans).where(eq(intelligencePlans.requestId, request.requestId));
    if (existing) return;

    const selectedEngines = data.selectedEngines && typeof data.selectedEngines === "object"
      ? data.selectedEngines
      : {
          internal: data.useInternalEngine,
          hybrid: data.useHybridEngine,
          reason: data.hybridEngineReason,
        };
    const redactionMode = this.resolveRedactionMode(data.redactionMode, data.useHybridEngine);
    const budgets = (data.budgets && typeof data.budgets === "object") ? data.budgets : {};
    const toolsAllowed = Array.isArray(data.toolsAllowed) ? data.toolsAllowed : [];
    const agentPlan = this.buildAgentPlan({
      selectedAgents: data.selectedAgents,
      agentPlanPolicy: data.agentPlanPolicy,
      executionPlan: data.executionPlan,
      appliedConstraints: data.appliedConstraints,
    });
    const rawMode = typeof data.agentPlanPolicy?.mode === "string" ? data.agentPlanPolicy.mode.toUpperCase() : "";
    const mode: "READ" | "PLAN" = rawMode === "PLAN" ? "PLAN" : "READ";

    await db.insert(intelligencePlans).values({
      iplanId: `IPL-${randomUUID()}`,
      iplanHash: this.computeIplanHash({
        mode,
        selectedEngines,
        toolsAllowed,
        redactionMode,
        budgets,
        agentPlan,
      }),
      requestId: request.requestId,
      mode,
      selectedEngines,
      toolsAllowed,
      redactionMode,
      budgets,
      agentPlan,
    });
  }

  /** Create an Intelligence Plan with the new 3-engine format */
  async createIntelligencePlan(data: {
    iplanId: string;
    requestId: string;
    mode: "READ" | "PLAN";
    selectedEngines: Record<string, unknown>;
    toolsAllowed: string[];
    redactionMode: string;
    budgets: Record<string, unknown>;
    agentPlan: Record<string, unknown>;
  }): Promise<void> {
    const [existing] = await db.select().from(intelligencePlans).where(eq(intelligencePlans.requestId, data.requestId));
    if (existing) return;

    await db.insert(intelligencePlans).values({
      iplanId: data.iplanId,
      iplanHash: this.computeIplanHash({
        mode: data.mode,
        selectedEngines: data.selectedEngines,
        toolsAllowed: data.toolsAllowed,
        redactionMode: data.redactionMode,
        budgets: data.budgets,
        agentPlan: data.agentPlan,
      }),
      requestId: data.requestId,
      mode: data.mode,
      selectedEngines: data.selectedEngines,
      toolsAllowed: data.toolsAllowed,
      redactionMode: data.redactionMode,
      budgets: data.budgets,
      agentPlan: data.agentPlan,
    });
  }

  async saveAdvisoryPackage(data: {
    decisionId: string;
    requestId?: string | null;
    options?: Record<string, unknown>[];
    risks?: Record<string, unknown>[];
    evidence?: Record<string, unknown>[];
    assumptions?: Record<string, unknown>[];
    overallConfidence?: string | null;
    internalEngineOutput?: Record<string, unknown>;
    hybridEngineOutput?: Record<string, unknown>;
    agentOutputs?: Record<string, unknown>;
    proposedActions?: Record<string, unknown>[];
  }): Promise<void> {
    const request = await this.resolveRequestRow(data.decisionId, data.requestId);
    if (!request) return;
    const [existing] = await db.select().from(advisoryPackages).where(eq(advisoryPackages.requestId, request.requestId));
    if (existing) return;

    const normalizeConfidence = (value?: string | null) => {
      if (value == null) return "0";
      const num = Number(value);
      if (!Number.isFinite(num)) return "0";
      const scaled = num > 1 ? num / 100 : num;
      const clamped = Math.min(1, Math.max(0, scaled));
      return clamped.toFixed(4);
    };

    const evidencePack = {
      evidence: data.evidence || [],
      engineOutputs: {
        internal: data.internalEngineOutput || null,
        hybrid: data.hybridEngineOutput || null,
      },
      agentOutputs: data.agentOutputs || {},
      proposedActions: data.proposedActions || [],
    };

    await db.insert(advisoryPackages).values({
      apackId: `AP-${randomUUID()}`,
      requestId: request.requestId,
      decisionSpineId: data.decisionId,
      summary: this.toOptionalString(this.asRecord(data.options?.[0]).description),
      options: data.options || [],
      risks: data.risks || [],
      evidencePack,
      assumptions: data.assumptions || [],
      confidence: normalizeConfidence(data.overallConfidence),
    });
  }

  async createApproval(data: {
    decisionId: string;
    approvalId: string;
    status: string;
    approvedBy?: string | null;
    approvalReason?: string | null;
    approvedActions?: unknown[] | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<ApprovalRow> {
    if (data.status === "pending") {
      const [closedForSpine] = await db
        .select()
        .from(approvals)
        .where(and(
          eq(approvals.decisionSpineId, data.decisionId),
          sql`${approvals.subDecisionId} is null`,
          sql`${approvals.artifactId} is null`,
          sql`${approvals.artifactVersionId} is null`,
          sql`${approvals.outcome} in ('APPROVE', 'REJECT')`,
        ))
        .orderBy(desc(approvals.createdAt))
        .limit(1);
      if (closedForSpine) {
        return closedForSpine;
      }
    }

    // Match on approvalId so retries don't blow away other approval rows on the
    // same spine (sub-decision approvals, prior approved Layer 7 gates, etc.).
    const [existing] = await db.select().from(approvals).where(eq(approvals.approvalId, data.approvalId));
    const outcome = this.resolveApprovalOutcome(data.status);
    const conditions = this.buildApprovalConditions(
      {
        status: data.status,
        approvedActions: data.approvedActions || [],
      },
      data.metadata ? { conditions: [{ status: data.status, approvedActions: data.approvedActions || [], metadata: data.metadata }] } : existing,
    );
    if (existing) {
      // Never downgrade an already-approved/rejected row back to pending. Layer 7
      // pipeline retries call createApproval(status="pending") with the same
      // approvalId; if PMO already approved, that approval must stick.
      if (data.status === "pending" && existing.outcome !== "REVISE") {
        return existing;
      }
      const [approval] = await db
        .update(approvals)
        .set({
          outcome,
          approvedBy: data.approvedBy || existing.approvedBy || undefined,
          conditions,
          rationale: data.approvalReason || existing.rationale || undefined,
        })
        .where(eq(approvals.approvalId, data.approvalId))
        .returning();
      const syncedApproval = approval || existing;
      await this.addSpineEvent(data.decisionId, "APPROVAL_DECIDED", data.approvedBy || undefined, {
        approvalId: syncedApproval.approvalId,
        status: data.status,
        outcome,
        scope: "decision",
      });
      await this.syncApprovalState(data.decisionId, data.status, syncedApproval, data.approvedBy);
      return syncedApproval;
    }

    const [approval] = await db.insert(approvals).values({
      approvalId: data.approvalId,
      decisionSpineId: data.decisionId,
      outcome,
      approvedBy: data.approvedBy || undefined,
      conditions,
      rationale: data.approvalReason || undefined,
    }).returning();

    await this.addSpineEvent(data.decisionId, "APPROVAL_DECIDED", data.approvedBy || undefined, {
      approvalId: data.approvalId,
      status: data.status,
      outcome,
      scope: "decision",
    });

    const createdApproval = requireRow(approval, "Failed to create approval");
    await this.syncApprovalState(data.decisionId, data.status, createdApproval, data.approvedBy);
    return createdApproval;
  }

  async getApproval(decisionId: string): Promise<Record<string, unknown> | null> {
    const [approval] = await db
      .select()
      .from(approvals)
      .where(and(
        eq(approvals.decisionSpineId, decisionId),
        sql`${approvals.subDecisionId} is null`,
        sql`${approvals.artifactId} is null`,
        sql`${approvals.artifactVersionId} is null`,
      ))
      .orderBy(sql`case when ${approvals.outcome} in ('APPROVE', 'REJECT') then 0 else 1 end`, desc(approvals.createdAt))
      .limit(1);
    return approval ? this.toApprovalRecord(approval) : null;
  }

  private async getRawApproval(decisionId: string): Promise<ApprovalRow | null> {
    const [approval] = await db
      .select()
      .from(approvals)
      .where(and(
        eq(approvals.decisionSpineId, decisionId),
        sql`${approvals.subDecisionId} is null`,
        sql`${approvals.artifactId} is null`,
        sql`${approvals.artifactVersionId} is null`,
      ))
      .orderBy(sql`case when ${approvals.outcome} in ('APPROVE', 'REJECT') then 0 else 1 end`, desc(approvals.createdAt))
      .limit(1);
    return approval || null;
  }

  async listPendingApprovals(limit = 100): Promise<Array<Record<string, unknown>>> {
    const rows = await db
      .select()
      .from(approvals)
      .orderBy(desc(approvals.createdAt))
      .limit(limit);

    // Dedupe by decisionSpineId — every blocked artifact in the same project
    // (BC, requirements, solution-fit, WBS, etc.) emits its own approvals row,
    // but the PMO inbox should surface a single governance review per decision.
    // Rows are already sorted newest-first, so the first occurrence wins.
    const closedSpines = new Set<string>();
    for (const row of rows) {
      if (row.outcome !== "APPROVE" && row.outcome !== "REJECT") continue;
      if (row.subDecisionId || row.artifactId || row.artifactVersionId) continue;
      if (row.decisionSpineId) closedSpines.add(row.decisionSpineId);
    }

    const seen = new Set<string>();
    return rows
      .map((approval) => this.toApprovalRecord(approval))
      .filter((approval): approval is Record<string, unknown> => {
        if (!approval || approval.status !== "pending") return false;
        const spineId = typeof approval.decisionSpineId === "string" ? approval.decisionSpineId : null;
        if (spineId && closedSpines.has(spineId)) return false;
        if (!spineId) return true;
        if (seen.has(spineId)) return false;
        seen.add(spineId);
        return true;
      });
  }

  async updateApproval(decisionId: string, data: Record<string, unknown>): Promise<ApprovalRow | null> {
    const outcome = this.resolveApprovalOutcome(data.status);
    await this.ensurePrincipal(data.approvedBy as string | undefined);
    const [approval] = await db
      .update(approvals)
      .set({
        outcome,
        approvedBy: (data.approvedBy as string | undefined) || undefined,
        rationale: (data.approvalReason as string | undefined) || undefined,
        conditions: this.buildApprovalConditions(data, await this.getRawApproval(decisionId)),
      })
      .where(eq(approvals.decisionSpineId, decisionId))
      .returning();
    if (approval) {
      await this.addSpineEvent(decisionId, "APPROVAL_DECIDED", data.approvedBy as string | undefined, {
        approvalId: approval.approvalId,
        status: data.status,
        outcome,
        scope: "decision",
      });
      await this.syncApprovalState(decisionId, data.status, approval, data.approvedBy as string | undefined);
    }
    return approval || null;
  }

  /**
   * Create a fresh decision_spine + approval row representing a portfolio
   * action that needs governance approval (e.g. a project manager requesting
   * permission to run AI WBS generation that was blocked by Layer 3).
   *
   * Unlike createApproval(), this never upserts onto an existing spine — every
   * call yields a new spine + approval pair so the PMO inbox can show one row
   * per request.
   */
  async createPortfolioActionApproval(params: {
    projectId: string;
    projectName: string;
    actionType: string;
    actionLabel: string;
    requesterId: string;
    requesterName: string;
    reasons?: string[];
    layer?: number;
    layerKey?: string;
  }): Promise<{ approvalId: string; decisionSpineId: string }> {
    await this.ensurePrincipal(params.requesterId);

    // Reuse an existing pending approval for the same project + actionType so
    // that repeated clicks of "Request governance approval" don't pile up
    // duplicate inbox rows. We only consider approvals that are still pending
    // (outcome=REVISE) and whose metadata matches this project + action.
    const existingRows = await db.execute(sql`
      SELECT a.approval_id, a.decision_spine_id
      FROM approvals a
      JOIN decision_spines ds ON ds.decision_spine_id = a.decision_spine_id
      WHERE ds.source_system = 'portfolio'
        AND a.outcome = 'REVISE'
        AND a.conditions @> ${JSON.stringify([{ metadata: { projectId: params.projectId, type: params.actionType } }])}::jsonb
      ORDER BY a.created_at DESC
      LIMIT 1
    `);
    const existing = (existingRows.rows?.[0] || null) as { approval_id?: string; decision_spine_id?: string } | null;
    if (existing?.approval_id && existing.decision_spine_id) {
      // Refresh the spine event so the request shows up as freshly requested.
      await this.addSpineEvent(existing.decision_spine_id, "APPROVAL_REQUEST_REFRESHED", params.requesterId, {
        approvalId: existing.approval_id,
        actionType: params.actionType,
        projectId: params.projectId,
        reasons: params.reasons || [],
      });
      return { approvalId: existing.approval_id, decisionSpineId: existing.decision_spine_id };
    }

    const decisionSpineId = `DSP-PORT-${params.actionType.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase()}-${randomUUID().slice(0, 12)}`;
    const approvalId = `APR-PORT-${randomUUID().slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const reason = `${params.actionLabel} requires governance approval before it can run.`;
    const title = `${params.actionLabel}: ${params.projectName}`;

    await db.insert(decisionSpines).values({
      decisionSpineId,
      title,
      createdBy: params.requesterId,
      sourceSystem: "portfolio",
      classification: "INTERNAL",
    }).onConflictDoNothing({ target: decisionSpines.decisionSpineId });

    await db.insert(approvals).values({
      approvalId,
      decisionSpineId,
      outcome: "REVISE",
      conditions: [{
        status: "pending",
        approvedActions: [],
        metadata: {
          type: params.actionType,
          approvalId,
          layer: params.layer ?? 3,
          layerKey: params.layerKey || "governance",
          layerName: params.actionLabel,
          projectId: params.projectId,
          projectName: params.projectName,
          requestedBy: params.requesterName,
          requesterId: params.requesterId,
          reasons: params.reasons || [],
          reason,
        },
      }],
      rationale: reason,
    });

    await this.addSpineEvent(decisionSpineId, "APPROVAL_DECIDED", params.requesterId, {
      approvalId,
      status: "pending",
      outcome: "REVISE",
      scope: "portfolio_action",
      actionType: params.actionType,
      projectId: params.projectId,
    });

    return { approvalId, decisionSpineId };
  }

  /**
   * Best-effort lookup of a portfolio project's display name keyed by the
   * decision spine that produced it. Used by the PMO inbox to surface a
   * meaningful title when the spine itself is only labelled with a routeKey.
   */
  async getPortfolioProjectByDecisionSpine(decisionSpineId: string): Promise<{ projectId: string; projectName: string } | null> {
    try {
      const result = await db.execute(sql`
        SELECT id, project_name FROM portfolio_projects
        WHERE decision_spine_id = ${decisionSpineId}
        LIMIT 1
      `);
      const row = (result.rows?.[0] || null) as { id?: string; project_name?: string } | null;
      if (!row?.id || !row.project_name) return null;
      return { projectId: row.id, projectName: row.project_name };
    } catch {
      return null;
    }
  }

  /**
   * Find the most recently APPROVED portfolio-action approval for the given
   * project + actionType (e.g. WBS Generation). Used to bypass Layer 3
   * governance gates for actions that have already been cleared by the PMO
   * inbox without forcing the user to wait for a brand-new pipeline run.
   */
  async findPendingLayer7Approval(decisionSpineId: string): Promise<{ approvalId: string; createdAt: Date | null } | null> {
    try {
      const result = await db.execute(sql`
        SELECT approval_id, created_at
        FROM approvals
        WHERE decision_spine_id = ${decisionSpineId}
          AND outcome = 'REVISE'
          AND (
            jsonb_array_length(COALESCE(conditions, '[]'::jsonb)) = 0
            OR (conditions->-1->>'status') = 'pending'
          )
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const row = (result.rows?.[0] || null) as { approval_id?: string; created_at?: Date | null } | null;
      if (!row?.approval_id) return null;
      return { approvalId: row.approval_id, createdAt: row.created_at ?? null };
    } catch {
      return null;
    }
  }

  /**
   * Find the most recent APPROVED Layer 7 / governance approval on a decision
   * spine. Used by post-approval generation paths (e.g. WBS) to detect when
   * the PMO has already approved the underlying draft and skip re-running the
   * full Brain pipeline + Layer 7 HITL.
   */
  async findApprovedLayer7Approval(decisionSpineId: string): Promise<{ approvalId: string; approvedBy: string | null; approvedAt: Date | null } | null> {
    try {
      const result = await db.execute(sql`
        SELECT approval_id, approved_by, created_at
        FROM approvals
        WHERE decision_spine_id = ${decisionSpineId}
          AND outcome = 'APPROVE'
          AND (
            (conditions->-1->>'status') = 'approved'
            OR jsonb_array_length(COALESCE(conditions, '[]'::jsonb)) = 0
          )
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const row = (result.rows?.[0] || null) as { approval_id?: string; approved_by?: string | null; created_at?: Date | null } | null;
      if (!row?.approval_id) return null;
      return {
        approvalId: row.approval_id,
        approvedBy: row.approved_by ?? null,
        approvedAt: row.created_at ?? null,
      };
    } catch {
      return null;
    }
  }

  async findApprovedPortfolioAction(projectId: string, actionType: string): Promise<{ approvalId: string; decisionSpineId: string; approvedBy: string | null; approvedAt: Date | null } | null> {
    try {
      const result = await db.execute(sql`
        SELECT a.approval_id, a.decision_spine_id, a.approved_by, a.created_at
        FROM approvals a
        JOIN decision_spines ds ON ds.decision_spine_id = a.decision_spine_id
        WHERE ds.source_system = 'portfolio'
          AND a.outcome = 'APPROVE'
          AND a.conditions @> ${JSON.stringify([{ metadata: { projectId, type: actionType } }])}::jsonb
        ORDER BY a.created_at DESC
        LIMIT 1
      `);
      const row = (result.rows?.[0] || null) as { approval_id?: string; decision_spine_id?: string; approved_by?: string | null; created_at?: Date | null } | null;
      if (!row?.approval_id || !row.decision_spine_id) return null;
      return {
        approvalId: row.approval_id,
        decisionSpineId: row.decision_spine_id,
        approvedBy: row.approved_by ?? null,
        approvedAt: row.created_at ?? null,
      };
    } catch {
      return null;
    }
  }

  async saveActionExecution(data: {
    decisionId: string;
    approvalId: string;
    actionType: string;
    idempotencyKey: string;
    status: string;
    requestPayload?: Record<string, unknown> | null;
    result?: Record<string, unknown> | null;
    error?: string | null;
  }): Promise<void> {
    await db.insert(executions).values({
      executionId: `EXE-${randomUUID()}`,
      approvalId: data.approvalId,
      decisionSpineId: data.decisionId,
      actionType: data.actionType,
      idempotencyKey: data.idempotencyKey,
      status: data.status.toUpperCase() as typeof executionStatusEnum.enumValues[number],
      requestPayload: data.requestPayload || {},
      resultPayload: data.result || {},
      errorMessage: data.error || undefined,
    });
  }

  async saveRedactionReceipt(params: {
    decisionId: string;
    classification: string;
    maskingApplied: boolean;
    minimizationApplied: boolean;
    outboundManifest: Record<string, unknown>;
    tokenizationMapRef?: string | null;
  }): Promise<void> {
    const context = await this.getRequestContext(params.decisionId);
    if (!context.requestId) return;

    await db.insert(redactionReceipts).values({
      redactionReceiptId: `RR-${randomUUID()}`,
      requestId: context.requestId,
      iplanId: context.iplanId || undefined,
      classification: params.classification as typeof dataClassificationEnum.enumValues[number],
      maskingApplied: params.maskingApplied,
      minimizationApplied: params.minimizationApplied,
      outboundManifest: {
        ...this.asRecord(params.outboundManifest),
        iplanHash: context.iplanHash || null,
      },
      tokenizationMapRef: params.tokenizationMapRef || undefined,
    });
  }

  async saveRunAttestation(params: {
    decisionId: string;
    classification: string;
    externalBoundaryCrossed: boolean;
    toolsUsed: string[];
    policyFingerprint?: string | null;
    receipt?: Record<string, unknown> | null;
    enginePluginId?: string | null;
  }): Promise<void> {
    const context = await this.getRequestContext(params.decisionId);
    if (!context.requestId) return;

    await db.insert(runAttestations).values({
      attestationId: `ATT-${randomUUID()}`,
      requestId: context.requestId,
      iplanId: context.iplanId || undefined,
      enginePluginId: params.enginePluginId || undefined,
      classification: params.classification as typeof dataClassificationEnum.enumValues[number],
      externalBoundaryCrossed: params.externalBoundaryCrossed,
      toolsUsed: params.toolsUsed,
      policyFingerprint: params.policyFingerprint || undefined,
      receipt: {
        ...this.asRecord(params.receipt),
        iplanHash: context.iplanHash || null,
      },
    });
  }

  async saveMemoryEntry(data: {
    decisionId: string;
    decisionSummary?: string | null;
    rationale?: string | null;
    evidence?: Record<string, unknown> | null;
    learningExtracted?: boolean | null;
    learningArtifactIds?: string[] | null;
    tags?: string[] | null;
  }): Promise<void> {
    const [existing] = await db.select().from(decisionLedgerRecords).where(eq(decisionLedgerRecords.decisionSpineId, data.decisionId));
    if (existing) return;

    await db.insert(decisionLedgerRecords).values({
      ledgerId: `LED-${randomUUID()}`,
      decisionSpineId: data.decisionId,
      conclusion: "HOLD",
      basis: {
        summary: data.decisionSummary,
        rationale: data.rationale,
      },
      evidenceSummary: data.evidence || {},
      approvalsSummary: {},
    }).onConflictDoNothing();
  }

  async addAuditEvent(decisionId: string, correlationId: string, layer: number, eventType: string, eventData?: unknown, actorId?: string): Promise<void> {
    const normalizedEventData = this.normalizeAuditEventData(eventData || {});
    const existingEvents = await db
      .select({ payload: brainEvents.payload })
      .from(brainEvents)
      .where(and(
        eq(brainEvents.decisionSpineId, decisionId),
        eq(brainEvents.correlationId, correlationId),
        eq(brainEvents.eventType, eventType),
        actorId
          ? eq(brainEvents.actorId, actorId)
          : sql`${brainEvents.actorId} is null`,
        sql`(${brainEvents.payload} ->> 'layer') = ${String(layer)}`,
      ));

    const duplicate = existingEvents.some((event) => {
      const payload = this.asRecord(event.payload);
      return this.normalizeAuditEventData(payload.eventData || {}) === normalizedEventData;
    });
    if (duplicate) return;

    await db.insert(brainEvents).values({
      correlationId,
      decisionSpineId: decisionId,
      eventType,
      actorId: actorId || undefined,
      payload: {
        layer,
        eventData: eventData || {},
      },
    });
  }

  async getFullDecisionWithLayers(
    decisionId: string,
    options?: { requestId?: string }
  ): Promise<{
    decision: CoreviaDecisionRecord | null;
    classification: typeof constraintPacks.$inferSelect | null;
    policy: typeof governanceDecisions.$inferSelect | null;
    context: typeof contextQualityReports.$inferSelect | null;
    orchestration: typeof intelligencePlans.$inferSelect | null;
    advisory: typeof advisoryPackages.$inferSelect | null;
    approval: ApprovalRow | null;
    actions: ExecutionRow[];
    memory: LedgerRow | null;
    auditEvents: BrainEventRow[];
  }> {
    const decisionRow = await db.select().from(decisionSpines).where(eq(decisionSpines.decisionSpineId, decisionId)).then(rows => rows[0] || null);
    if (!decisionRow) {
      return {
        decision: null,
        classification: null,
        policy: null,
        context: null,
        orchestration: null,
        advisory: null,
        approval: null,
        actions: [],
        memory: null,
        auditEvents: [],
      };
    }

    const request = options?.requestId
      ? await db.select().from(canonicalAiRequests).where(eq(canonicalAiRequests.requestId, options.requestId)).then(rows => rows[0] || null)
      : await this.getLatestRequest(decisionId);
    const decision = this.toDecisionRecord(decisionRow, request);
    const [classification] = request ? await db.select().from(constraintPacks).where(eq(constraintPacks.requestId, request.requestId)) : [null];
    const [policy] = request ? await db.select().from(governanceDecisions).where(eq(governanceDecisions.requestId, request.requestId)) : [null];
    const [context] = request ? await db.select().from(contextQualityReports).where(eq(contextQualityReports.requestId, request.requestId)) : [null];
    const [orchestration] = request ? await db.select().from(intelligencePlans).where(eq(intelligencePlans.requestId, request.requestId)) : [null];
    const [advisory] = request ? await db.select().from(advisoryPackages).where(eq(advisoryPackages.requestId, request.requestId)) : [null];
    const [approval] = await db.select().from(approvals).where(eq(approvals.decisionSpineId, decisionId));
    const actions = await db.select().from(executions).where(eq(executions.decisionSpineId, decisionId));
    const [memory] = await db.select().from(decisionLedgerRecords).where(eq(decisionLedgerRecords.decisionSpineId, decisionId));
    const auditEvents = await db.select().from(brainEvents).where(eq(brainEvents.decisionSpineId, decisionId)).orderBy(brainEvents.occurredAt);

    return {
      decision,
      classification: classification || null,
      policy: policy || null,
      context: context || null,
      orchestration: orchestration || null,
      advisory: advisory || null,
      approval: approval || null,
      actions,
      memory: memory || null,
      auditEvents,
    };
  }

  async getSpineOverview(decisionSpineId: string): Promise<{
    spine: DecisionSpineRow | null;
    subDecisions: Array<Record<string, unknown>>;
    approvals: ApprovalRow[];
    executions: ExecutionRow[];
    ledger: LedgerRow | null;
    artifacts: Array<Record<string, unknown>>;
  }> {
    const spine = await this.getSpine(decisionSpineId);
    if (!spine) {
      return { spine: null, subDecisions: [], approvals: [], executions: [], ledger: null, artifacts: [] };
    }

    const artifacts = await db
      .select()
      .from(decisionArtifacts)
      .where(eq(decisionArtifacts.decisionSpineId, decisionSpineId));
    const artifactMap = new Map(artifacts.map(a => [a.artifactId, a]));

    const artifactVersions = artifacts.length > 0
      ? await db
          .select()
          .from(decisionArtifactVersions)
          .where(inArray(decisionArtifactVersions.artifactId, artifacts.map(a => a.artifactId)))
          .orderBy(desc(decisionArtifactVersions.version))
      : [];

    const latestVersionByArtifact = new Map<string, typeof decisionArtifactVersions.$inferSelect>();
    for (const version of artifactVersions) {
      if (!latestVersionByArtifact.has(version.artifactId)) {
        latestVersionByArtifact.set(version.artifactId, version);
      }
    }

    const subDecisionsRaw = await this.listSubDecisions(decisionSpineId);
    const orderedSubDecisionsRaw = [...subDecisionsRaw].sort((left, right) => {
      const leftSuperseded = left.status === "SUPERSEDED" ? 1 : 0;
      const rightSuperseded = right.status === "SUPERSEDED" ? 1 : 0;
      if (leftSuperseded !== rightSuperseded) {
        return leftSuperseded - rightSuperseded;
      }
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
    const approvalRows = await db
      .select()
      .from(approvals)
      .where(eq(approvals.decisionSpineId, decisionSpineId))
      .orderBy(desc(approvals.createdAt));
    const executionRows = await db
      .select()
      .from(executions)
      .where(eq(executions.decisionSpineId, decisionSpineId))
      .orderBy(desc(executions.createdAt));
    const [ledger] = await db
      .select()
      .from(decisionLedgerRecords)
      .where(eq(decisionLedgerRecords.decisionSpineId, decisionSpineId));

    const latestApprovalBySub: Record<string, ApprovalRow> = {};
    for (const approval of approvalRows) {
      if (!approval.subDecisionId) continue;
      latestApprovalBySub[approval.subDecisionId] ??= approval;
    }

    const subDecisions = (orderedSubDecisionsRaw as Record<string, unknown>[]).map((sd) => {
      const artifact = sd.artifactId ? artifactMap.get(sd.artifactId as string) : null;
      const approval = (latestApprovalBySub[sd.subDecisionId as string] || null) as Record<string, unknown> | null;
      return {
        ...sd,
        artifactStatus: artifact?.status || null,
        artifactVersion: artifact?.currentVersion || null,
        approvalId: approval?.approvalId || null,
        approvalOutcome: approval?.outcome || null,
        approvedBy: approval?.approvedBy || null,
        approvedAt: approval?.createdAt || null,
      };
    });

    const artifactOverview = artifacts.map(artifact => {
      const latest = latestVersionByArtifact.get(artifact.artifactId);
      return {
        artifactId: artifact.artifactId,
        artifactType: artifact.artifactType,
        status: artifact.status,
        currentVersion: artifact.currentVersion,
        latestVersionId: latest?.artifactVersionId || null,
        latestVersion: latest?.version || null,
        latestChangeSummary: latest?.changeSummary || null,
        latestCreatedAt: latest?.createdAt || null,
        latestContent: latest?.content || null,
      };
    });

    return {
      spine,
      subDecisions,
      approvals: approvalRows,
      executions: executionRows,
      ledger: ledger || null,
      artifacts: artifactOverview,
    };
  }

  async persistDecisionObject(obj: DecisionObject): Promise<void> {
    const decisionId = obj.decisionId;

    await this.updateDecision(decisionId, {
      requestId: obj.requestId,
      currentLayer: obj.currentLayer,
      status: obj.status as string,
      normalizedInput: obj.input?.normalizedInput,
      inputData: this.asRecord(obj.input?.rawInput || obj.input?.normalizedInput),
      organizationId: obj.input?.organizationId,
    });

    if (obj.classification) {
      await this.saveClassification({
        decisionId,
        requestId: obj.requestId,
        classificationLevel: obj.classification.classificationLevel,
        sector: obj.classification.sector,
        jurisdiction: obj.classification.jurisdiction,
        riskLevel: obj.classification.riskLevel,
        allowCloudProcessing: obj.classification.constraints?.allowCloudProcessing,
        allowExternalModels: obj.classification.constraints?.allowExternalModels,
        requireHitl: obj.classification.constraints?.requireHitl,
        constraints: obj.classification.constraints as Record<string, unknown>,
      });
    }

    if (obj.policy) {
      await this.savePolicyEvaluation({
        decisionId,
        requestId: obj.requestId,
        result: obj.policy.result,
        policiesEvaluated: obj.policy.policiesEvaluated as Record<string, unknown>[],
        blockingPolicy: obj.policy.blockingPolicy,
        blockReason: obj.policy.blockReason,
        approvalRequired: obj.policy.approvalRequired,
        approvalReasons: obj.policy.approvalReasons,
      });
    }

    if (obj.context) {
      await this.saveContextQuality({
        decisionId,
        requestId: obj.requestId,
        result: obj.context.result,
        completenessScore: String(obj.context.completenessScore ?? 0),
        ambiguityScore: String(obj.context.ambiguityScore ?? 0),
        missingFields: obj.context.missingFields || [],
        assumptions: obj.context.assumptions as Record<string, unknown>[],
      });
    }

    if (obj.orchestration) {
      await this.saveOrchestrationPlan({
        decisionId,
        requestId: obj.requestId,
        useInternalEngine: obj.orchestration.useInternalEngine ?? true,
        useHybridEngine: obj.orchestration.useHybridEngine ?? false,
        hybridEngineReason: obj.orchestration.hybridEngineReason,
        selectedEngines: obj.orchestration.selectedEngines || null,
        toolsAllowed: (obj.orchestration as unknown as Record<string, unknown>).toolsAllowed as string[] | null || null,
        redactionMode: obj.orchestration.redactionMode || null,
        budgets: obj.orchestration.budgets || null,
        selectedAgents: obj.orchestration.selectedAgents || [],
        agentPlanPolicy: (obj.orchestration.agentPlanPolicy || null) as Record<string, unknown> | null,
        executionPlan: obj.orchestration.executionPlan || [],
        appliedConstraints: obj.orchestration.appliedConstraints,
      });
    }

    if (obj.advisory) {
      await this.saveAdvisoryPackage({
        decisionId,
        requestId: obj.requestId,
        options: obj.advisory.options || [],
        risks: obj.advisory.risks || [],
        evidence: obj.advisory.evidence || [],
        assumptions: obj.advisory.assumptions || [],
        overallConfidence: obj.advisory.overallConfidence ? String(obj.advisory.overallConfidence) : "0",
        internalEngineOutput: obj.advisory.internalEngineOutput,
        hybridEngineOutput: obj.advisory.hybridEngineOutput,
        agentOutputs: obj.advisory.agentOutputs as Record<string, unknown> | undefined,
        proposedActions: obj.advisory.proposedActions as Record<string, unknown>[] | undefined,
      });
    }

    if (obj.validation) {
      // Internal-support routes (rag.*, reasoning.*, version_impact.*, query.expand,
      // rerank, classify, …) must never persist a pending PMO approval row, even when
      // Layer 7 generates an approvalId for trace continuity. The orchestrator's
      // ensureLayer7ApprovalGate / persistConfiguredLayerApprovalGate already short-circuit
      // for these routes, so this is the last gate before the database. Without this guard
      // an internal RAG query expansion would leak into the human approval queue.
      const svc = String(obj.input?.serviceId || "").toLowerCase();
      const route = String(obj.input?.routeKey || "").toLowerCase();
      const isInternalSupportRoute =
        svc === "rag" ||
        svc === "reasoning" ||
        svc === "version_impact" ||
        svc === "language" ||
        route.startsWith("rag.") ||
        route.startsWith("reasoning.") ||
        route.startsWith("version_impact.") ||
        route.includes("query.expand") ||
        route.includes("query_rewrite") ||
        route.includes("rerank") ||
        route.includes("classify");

      if (!isInternalSupportRoute) {
        await this.createApproval({
          decisionId,
          approvalId: obj.validation.approvalId || `APR-${decisionId.slice(0, 8)}`,
          status: obj.validation.status,
          approvedBy: obj.validation.approvedBy,
          approvalReason: obj.validation.approvalReason,
          approvedActions: obj.validation.approvedActions || [],
        });
      }
    }

    for (const evt of obj.audit?.events ?? []) {
      await this.addAuditEvent(
        decisionId,
        obj.correlationId,
        evt.layer,
        evt.eventType,
        evt.eventData,
        evt.actorId
      );
    }

    if (obj.memory) {
      await this.ensureMemoryEntry(decisionId, obj);
    }
  }

  async ensureMemoryEntry(decisionId: string, obj?: DecisionObject): Promise<LedgerRow | null> {
    const [existing] = await db.select().from(decisionLedgerRecords).where(eq(decisionLedgerRecords.decisionSpineId, decisionId));
    const conclusion = this.resolveMemoryConclusion(obj?.validation?.status);
    const summary = obj?.memory?.decisionSummary || `Decision ${decisionId.slice(0, 8)} completed`;
    const rationale = obj?.memory?.rationale || "Decision processed through Corevia Brain";
    const evidence = obj?.memory?.evidence || {};
    const approvalsSummary = {
      approvalId: obj?.validation?.approvalId,
      status: obj?.validation?.status,
      approvedBy: obj?.validation?.approvedBy,
      approvedActions: obj?.validation?.approvedActions || [],
    };

    if (existing) {
      const [updated] = await db
        .update(decisionLedgerRecords)
        .set({
          conclusion: existing.conclusion === conclusion ? existing.conclusion : conclusion,
          basis: { summary, rationale },
          evidenceSummary: evidence,
          approvalsSummary,
        })
        .where(eq(decisionLedgerRecords.ledgerId, existing.ledgerId))
        .returning();
      return updated || existing;
    }
    await db.insert(decisionLedgerRecords).values({
      ledgerId: `LED-${randomUUID()}`,
      decisionSpineId: decisionId,
      conclusion,
      basis: { summary, rationale },
      evidenceSummary: evidence,
      approvalsSummary,
    }).onConflictDoNothing();

    const [ledger] = await db.select().from(decisionLedgerRecords).where(eq(decisionLedgerRecords.decisionSpineId, decisionId));
    return ledger || null;
  }

  async saveDecisionOutcome(params: {
    decisionId: string;
    outcomeStatus: string;
    kpiImpact?: Record<string, unknown> | null;
    lessonsLearned?: string | null;
    recordedBy?: string | null;
  }): Promise<void> {
    const [ledger] = await db
      .select()
      .from(decisionLedgerRecords)
      .where(eq(decisionLedgerRecords.decisionSpineId, params.decisionId));
    if (!ledger) return;

    const [existing] = await db
      .select()
      .from(decisionOutcomes)
      .where(eq(decisionOutcomes.ledgerId, ledger.ledgerId))
      .limit(1);
    if (existing) return;

    await db.insert(decisionOutcomes).values({
      outcomeId: `OUT-${randomUUID()}`,
      ledgerId: ledger.ledgerId,
      outcomeStatus: params.outcomeStatus,
      kpiImpact: params.kpiImpact || {},
      lessonsLearned: params.lessonsLearned || undefined,
      recordedBy: params.recordedBy || undefined,
    });
  }

  async updateLedgerConclusion(decisionId: string, conclusion: "APPROVED_TO_EXECUTE" | "HOLD" | "REJECTED" | "CANCELLED" | "COMPLETED"): Promise<void> {
    const [ledger] = await db
      .select()
      .from(decisionLedgerRecords)
      .where(eq(decisionLedgerRecords.decisionSpineId, decisionId));
    if (!ledger) return;

    await db
      .update(decisionLedgerRecords)
      .set({ conclusion })
      .where(eq(decisionLedgerRecords.ledgerId, ledger.ledgerId));
  }

  async getPolicies(): Promise<typeof governancePolicies.$inferSelect[]> {
    return db.select().from(governancePolicies).orderBy(desc(governancePolicies.createdAt));
  }

  async getApprovalByApprovalId(approvalId: string): Promise<Record<string, unknown> | null> {
    const [approval] = await db.select().from(approvals).where(eq(approvals.approvalId, approvalId));
    return approval ? this.toApprovalRecord(approval) : null;
  }

  async checkActionExecutionExists(idempotencyKey: string): Promise<boolean> {
    const [existing] = await db.select().from(executions).where(eq(executions.idempotencyKey, idempotencyKey));
    return !!existing;
  }

  async upsertApproval(decisionId: string, data: Record<string, unknown>): Promise<ApprovalRow> {
    const outcome = this.resolveApprovalOutcome(data.status);
    const approvalId = this.pickPreferredString([data.approvalId], `APR-${decisionId.slice(0, 8)}-${Date.now().toString(36)}`) || `APR-${decisionId.slice(0, 8)}-${Date.now().toString(36)}`;
    const existing = await this.getApproval(decisionId);
    if (existing) {
      const [updated] = await db
        .update(approvals)
        .set({
          outcome,
          approvedBy: (data.approvedBy as string | undefined) || undefined,
          rationale: (data.approvalReason as string | undefined) || undefined,
          conditions: this.buildApprovalConditions(data, await this.getRawApproval(decisionId)),
        })
        .where(eq(approvals.decisionSpineId, decisionId))
        .returning();
      return requireRow(updated, "Failed to update approval");
    }

    const [created] = await db.insert(approvals).values({
      approvalId,
      decisionSpineId: decisionId,
      outcome,
      approvedBy: (data.approvedBy as string | undefined) || undefined,
      rationale: (data.approvalReason as string | undefined) || undefined,
      conditions: this.buildApprovalConditions(data),
    }).returning();
    return requireRow(created, "Failed to create approval");
  }

  async persistLayerData(decisionId: string, obj: DecisionObject): Promise<void> {
    try {
      await this.updateDecision(decisionId, {
        requestId: obj.requestId,
        currentLayer: obj.currentLayer,
        status: obj.status as string,
        normalizedInput: obj.input?.normalizedInput,
      });

      if (obj.currentLayer >= 2 && obj.classification) {
        await this.saveClassification({
          decisionId,
          requestId: obj.requestId,
          classificationLevel: obj.classification.classificationLevel,
          sector: obj.classification.sector,
          jurisdiction: obj.classification.jurisdiction,
          riskLevel: obj.classification.riskLevel,
          allowCloudProcessing: obj.classification.constraints?.allowCloudProcessing,
          allowExternalModels: obj.classification.constraints?.allowExternalModels,
          requireHitl: obj.classification.constraints?.requireHitl,
          constraints: obj.classification.constraints as Record<string, unknown>,
        });
      }

      if (obj.currentLayer >= 3 && obj.policy) {
        await this.savePolicyEvaluation({
          decisionId,
          requestId: obj.requestId,
          result: obj.policy.result,
          policiesEvaluated: obj.policy.policiesEvaluated as Record<string, unknown>[],
          blockingPolicy: obj.policy.blockingPolicy,
          blockReason: obj.policy.blockReason,
          approvalRequired: obj.policy.approvalRequired,
          approvalReasons: obj.policy.approvalReasons,
        });
      }

      if (obj.currentLayer >= 4 && obj.context) {
        await this.saveContextQuality({
          decisionId,
          requestId: obj.requestId,
          result: obj.context.result,
          completenessScore: String(obj.context.completenessScore ?? 0),
          ambiguityScore: String(obj.context.ambiguityScore ?? 0),
          missingFields: obj.context.missingFields || [],
          assumptions: obj.context.assumptions as Record<string, unknown>[],
        });
      }

      if (obj.currentLayer >= 5 && obj.orchestration) {
        await this.saveOrchestrationPlan({
          decisionId,
          requestId: obj.requestId,
          useInternalEngine: obj.orchestration.useInternalEngine ?? true,
          useHybridEngine: obj.orchestration.useHybridEngine ?? false,
          hybridEngineReason: obj.orchestration.hybridEngineReason,
          selectedEngines: obj.orchestration.selectedEngines || null,
          toolsAllowed: (obj.orchestration as unknown as Record<string, unknown>).toolsAllowed as string[] | null || null,
          redactionMode: obj.orchestration.redactionMode || null,
          budgets: obj.orchestration.budgets || null,
          selectedAgents: obj.orchestration.selectedAgents || [],
          agentPlanPolicy: (obj.orchestration.agentPlanPolicy || null) as Record<string, unknown> | null,
          executionPlan: obj.orchestration.executionPlan || [],
          appliedConstraints: obj.orchestration.appliedConstraints,
        });
      }

      if (obj.currentLayer >= 6 && obj.advisory) {
        await this.saveAdvisoryPackage({
          decisionId,
          requestId: obj.requestId,
          options: obj.advisory.options || [],
          risks: obj.advisory.risks || [],
          evidence: obj.advisory.evidence || [],
          assumptions: obj.advisory.assumptions || [],
          overallConfidence: obj.advisory.overallConfidence ? String(obj.advisory.overallConfidence) : "0",
          internalEngineOutput: obj.advisory.internalEngineOutput,
          hybridEngineOutput: obj.advisory.hybridEngineOutput,
          agentOutputs: obj.advisory.agentOutputs as Record<string, unknown> | undefined,
          proposedActions: obj.advisory.proposedActions as Record<string, unknown>[] | undefined,
        });
      }
    } catch (err) {
      logger.error("[CoreviaStorage] Error persisting layer data:", err);
    }
  }

  async getLearningArtifacts(): Promise<Array<Record<string, unknown>>> {
    try {
      const rows = await db.select().from(learningAssets).orderBy(desc(learningAssets.createdAt));

      // Get activation counts per artifact
      const activationRows = await db
        .select({
          learningAssetId: learningAssetActivations.learningAssetId,
          count: sql<number>`count(*)::int`,
        })
        .from(learningAssetActivations)
        .groupBy(learningAssetActivations.learningAssetId);
      const activationMap = new Map(activationRows.map((a) => [a.learningAssetId, a.count]));

      return rows.map((r) => ({
        id: r.learningAssetId,
        artifactType: r.assetType,
        version: r.version,
        content: r.content,
        status: r.status,
        sourceDecisionId: r.sourceLedgerId,
        createdAt: r.createdAt,
        activations: activationMap.get(r.learningAssetId) || 0,
        journeyId: r.journeyId,
        decisionPhase: r.decisionPhase,
      }));
    } catch (error) {
      logger.warn("[CoreviaStorage] Learning assets unavailable:", error);
      return [];
    }
  }

  async saveLearningArtifact(artifact: Record<string, unknown>): Promise<void> {
    const generatedArtifactId = `LA-${randomUUID()}`;
    const artifactId = this.pickPreferredString([artifact.id], generatedArtifactId) || generatedArtifactId;
    const [existing] = await db.select().from(learningAssets).where(eq(learningAssets.learningAssetId, artifactId));
    if (existing) return;

    let sourceLedgerId = artifact.sourceLedgerId as string | undefined;
    if (!sourceLedgerId && artifact.sourceDecisionId) {
      const sourceDecisionId = this.toOptionalString(artifact.sourceDecisionId);
      if (!sourceDecisionId) return;
      const [ledger] = await db
        .select()
        .from(decisionLedgerRecords)
        .where(eq(decisionLedgerRecords.decisionSpineId, sourceDecisionId));
      sourceLedgerId = ledger?.ledgerId;
    }
    if (!sourceLedgerId) return;

    const assetType = this.pickPreferredString([artifact.artifactType, artifact.type], "pattern") || "pattern";
    await db.insert(learningAssets).values({
      learningAssetId: artifactId,
      sourceLedgerId,
      assetType,
      status: "DRAFT",
      version: Number(artifact.version || 1),
      content: (artifact.content || { value: artifact }) as Record<string, unknown>,
      createdByEngine: (artifact.createdByEngine || undefined) as string | undefined,
    });
  }

  async activateLearningArtifact(artifactId: string, userId: string): Promise<LearningAssetRow | null> {
    const [updated] = await db
      .update(learningAssets)
      .set({ status: "APPROVED", approvedBy: userId, approvedAt: new Date() })
      .where(eq(learningAssets.learningAssetId, artifactId))
      .returning();
    return updated || null;
  }

  async saveOutcomeFeedback(feedback: Record<string, unknown>): Promise<void> {
    try {
      await db.insert(brainEvents).values({
        eventType: "outcome_feedback",
        decisionSpineId: (feedback.decisionId as string) || null,
        payload: feedback,
        occurredAt: new Date(),
      });
    } catch (error) {
      logger.error("[CoreviaStorage] Error saving outcome feedback:", error);
    }
  }

  async getOutcomeFeedback(decisionId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const results = await db.select().from(brainEvents)
        .where(and(
          eq(brainEvents.eventType, "outcome_feedback"),
          eq(brainEvents.decisionSpineId, decisionId)
        ))
        .orderBy(desc(brainEvents.occurredAt));
      return results.map(r => ({ id: r.eventId, ...((r.payload || {}) as Record<string, unknown>), occurredAt: r.occurredAt }));
    } catch (error) {
      logger.error("[CoreviaStorage] Error fetching outcome feedback:", error);
      return [];
    }
  }

  async listRegisteredServices(): Promise<typeof aiUseCases.$inferSelect[]> {
    return db.select().from(aiUseCases).orderBy(desc(aiUseCases.createdAt));
  }

  async getRegisteredService(serviceId: string): Promise<typeof aiUseCases.$inferSelect | null> {
    const [service] = await db.select().from(aiUseCases).where(eq(aiUseCases.useCaseType, serviceId));
    return service || null;
  }

  async registerService(data: {
    serviceId: string;
    serviceName: string;
    description?: string | null;
    defaultClassification?: string | null;
    requiredPermissions?: string[] | null;
    isActive?: boolean | null;
  }): Promise<typeof aiUseCases.$inferSelect> {
    const [service] = await db.insert(aiUseCases).values({
      useCaseType: data.serviceId,
      title: data.serviceName,
      description: data.description || undefined,
    }).returning();
    return requireRow(service, "Failed to register AI use case");
  }

  async updateServiceStatus(serviceId: string, _isActive: boolean): Promise<typeof aiUseCases.$inferSelect | null> {
    const [service] = await db
      .update(aiUseCases)
      .set({ createdAt: new Date() })
      .where(eq(aiUseCases.useCaseType, serviceId))
      .returning();
    return service || null;
  }

  async listIntakeRoutes(_serviceId: string): Promise<Array<Record<string, never>>> {
    return [];
  }

  async getPolicyPacks(): Promise<Array<Record<string, unknown>>> {
    const rows = await db.select().from(corviaPolicyPacks).orderBy(desc(corviaPolicyPacks.createdAt));
    return rows.map(r => ({
      id: r.id,
      packId: r.packId,
      name: r.name,
      version: r.version,
      summary: r.summary,
      status: r.status,
      layer: r.layer,
      rulesCount: r.rulesCount,
      rules: r.rules,
      lastTestedAt: r.lastTestedAt?.toISOString() || null,
      testResult: r.testResult,
      documentName: r.documentName,
      documentSize: r.documentSize,
      documentType: r.documentType,
      documentPath: r.documentPath,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async createPolicyPack(pack: Record<string, unknown>): Promise<void> {
    await db.insert(corviaPolicyPacks).values({
      id: pack.id as string,
      packId: pack.packId as string,
      name: pack.name as string,
      version: pack.version as string,
      summary: pack.summary as string,
      status: (pack.status || "draft") as typeof policyPackStatusEnum.enumValues[number],
      layer: (pack.layer || "L3_FRICTION") as string,
      rulesCount: Number(pack.rulesCount || 0),
      rules: (pack.rules || []) as unknown[],
      documentName: (pack.documentName || null) as string | null,
      documentSize: (pack.documentSize || null) as number | null,
      documentType: (pack.documentType || null) as string | null,
      documentPath: (pack.documentPath || null) as string | null,
    }).onConflictDoNothing();
  }

  async updatePolicyPackStatus(packId: string, status: string): Promise<void> {
    await db.update(corviaPolicyPacks)
      .set({ status: status as typeof policyPackStatusEnum.enumValues[number], updatedAt: new Date() })
      .where(eq(corviaPolicyPacks.packId, packId));
  }

  async updatePolicyPackTestResult(packId: string, result: string): Promise<void> {
    await db.update(corviaPolicyPacks)
      .set({
        testResult: result as typeof policyPackTestResultEnum.enumValues[number],
        lastTestedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(corviaPolicyPacks.packId, packId));
  }

  async getActivePolicyPacks(): Promise<Array<Record<string, unknown>>> {
    const rows = await db.select().from(corviaPolicyPacks)
      .where(eq(corviaPolicyPacks.status, "active"))
      .orderBy(desc(corviaPolicyPacks.createdAt));
    return rows.map(r => ({
      id: r.id,
      packId: r.packId,
      name: r.name,
      version: r.version,
      summary: r.summary,
      status: r.status,
      layer: r.layer,
      rulesCount: r.rulesCount,
      rules: r.rules,
      lastTestedAt: r.lastTestedAt?.toISOString() || null,
      testResult: r.testResult,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async updatePolicyPackRules(packId: string, rules: unknown[]): Promise<void> {
    await db.update(corviaPolicyPacks)
      .set({
        rules: rules,
        rulesCount: rules.length,
        updatedAt: new Date(),
      })
      .where(eq(corviaPolicyPacks.packId, packId));
  }

  // ==================== EXECUTION ZONE ====================

  async saveExecution(data: {
    decisionId: string;
    approvalId: string;
    actionType: string;
    idempotencyKey: string;
    status: string;
    requestPayload?: Record<string, unknown>;
    resultPayload?: Record<string, unknown>;
    errorMessage?: string;
  }): Promise<void> {
    const existing = await this.getExecution(data.idempotencyKey);
    if (existing) {
      await db.update(executions)
        .set({
          status: data.status.toUpperCase() as typeof executionStatusEnum.enumValues[number],
          resultPayload: data.resultPayload || {},
          errorMessage: data.errorMessage || undefined,
          updatedAt: new Date(),
        })
        .where(eq(executions.idempotencyKey, data.idempotencyKey));
      return;
    }
    await db.insert(executions).values({
      executionId: `EXE-${randomUUID()}`,
      approvalId: data.approvalId,
      decisionSpineId: data.decisionId,
      actionType: data.actionType,
      idempotencyKey: data.idempotencyKey,
      status: data.status.toUpperCase() as typeof executionStatusEnum.enumValues[number],
      requestPayload: data.requestPayload || {},
      resultPayload: data.resultPayload || {},
      errorMessage: data.errorMessage || undefined,
    });
  }

  async getExecution(idempotencyKey: string): Promise<ExecutionRow | null> {
    const [execution] = await db.select()
      .from(executions)
      .where(eq(executions.idempotencyKey, idempotencyKey));
    return execution || null;
  }

  async getExecutionsForDecision(decisionId: string): Promise<ExecutionRow[]> {
    return db.select()
      .from(executions)
      .where(eq(executions.decisionSpineId, decisionId))
      .orderBy(desc(executions.createdAt));
  }

  async getDecisionEventsForSpine(decisionId: string): Promise<BrainEventRow[]> {
    return db.select()
      .from(brainEvents)
      .where(eq(brainEvents.decisionSpineId, decisionId))
      .orderBy(desc(brainEvents.occurredAt));
  }

  async getAllBrainEvents(options: {
    limit?: number;
    offset?: number;
    eventType?: string;
    decisionSpineId?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<{ events: BrainEventRow[]; total: number }> {
    const { limit = 50, offset = 0, eventType, decisionSpineId, dateFrom, dateTo } = options;
    const conditions = [];
    if (eventType) conditions.push(eq(brainEvents.eventType, eventType));
    if (decisionSpineId) conditions.push(eq(brainEvents.decisionSpineId, decisionSpineId));
    if (dateFrom) conditions.push(sql`${brainEvents.occurredAt} >= ${dateFrom}::timestamptz`);
    if (dateTo) conditions.push(sql`${brainEvents.occurredAt} <= ${dateTo}::timestamptz`);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [events, countResult] = await Promise.all([
      whereClause
        ? db.select().from(brainEvents).where(whereClause).orderBy(desc(brainEvents.occurredAt)).limit(limit).offset(offset)
        : db.select().from(brainEvents).orderBy(desc(brainEvents.occurredAt)).limit(limit).offset(offset),
      whereClause
        ? db.select({ count: sql<number>`count(*)` }).from(brainEvents).where(whereClause)
        : db.select({ count: sql<number>`count(*)` }).from(brainEvents),
    ]);

    return { events, total: Number(countResult[0]?.count || 0) };
  }

  async getBrainEventTypes(): Promise<string[]> {
    const rows = await db.selectDistinct({ eventType: brainEvents.eventType }).from(brainEvents);
    return rows.map(r => r.eventType).filter(Boolean);
  }

  async getTodayBrainEventsSummary(): Promise<{
    totalToday: number;
    blocked: number;
    allowed: number;
    errors: number;
    byType: Record<string, number>;
    totalAll: number;
    blockedAll: number;
    allowedAll: number;
    errorsAll: number;
    latestEventAt: string | null;
  }> {
    // All-time stats with a single query
    const allEvents = await db.select({
      eventType: brainEvents.eventType,
      occurredAt: brainEvents.occurredAt,
    }).from(brainEvents);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const summary = {
      totalToday: 0, blocked: 0, allowed: 0, errors: 0,
      byType: {} as Record<string, number>,
      totalAll: allEvents.length, blockedAll: 0, allowedAll: 0, errorsAll: 0,
      latestEventAt: null as string | null,
    };

    for (const event of allEvents) {
      const eventType = event.eventType || "unknown";
      const isToday = event.occurredAt ? new Date(event.occurredAt).getTime() >= todayMs : false;
      const timestamp = this.toIsoTimestamp(event.occurredAt);

      if (timestamp && (!summary.latestEventAt || timestamp > summary.latestEventAt)) {
        summary.latestEventAt = timestamp;
      }

      this.incrementBrainEventCounters(summary, eventType, isToday);
    }
    return summary;
  }

  async getFullDecisionObject(decisionId: string): Promise<Record<string, unknown> | null> {
    const decision = await this.getDecision(decisionId);
    if (!decision) return null;

    const request = await this.getLatestRequest(decisionId);
    const approval = await this.getApproval(decisionId);
    const execs = await this.getExecutionsForDecision(decisionId);
    const artifacts = await this.getLearningArtifacts();
    const events = await this.getDecisionEventsForSpine(decisionId);

    return {
      ...decision,
      requestId: request?.requestId,
      approval,
      executions: execs,
      learningArtifacts: artifacts,
      events,
    };
  }

  // ==================== LIVE STATS ====================

  async getPipelineStats(): Promise<{
    total: number;
    processing: number;
    pending: number;
    blocked: number;
    completed: number;
    needsInfo: number;
    byClassification: Record<string, number>;
    byLayer: Record<number, number>;
    avgProcessingTimeMs: number;
    todayCount: number;
  }> {
    return this.getPipelineStatsScoped();
  }

  async getPipelineStatsScoped(options?: { organizationId?: string | null; isSystemAdmin?: boolean }): Promise<{
    total: number;
    processing: number;
    pending: number;
    blocked: number;
    completed: number;
    needsInfo: number;
    byClassification: Record<string, number>;
    byLayer: Record<number, number>;
    avgProcessingTimeMs: number;
    todayCount: number;
  }> {
    const organizationId = options?.organizationId || null;
    const isSystemAdmin = Boolean(options?.isSystemAdmin);
    const organizationFilter = organizationId && !isSystemAdmin
      ? sql`AND (r.source_metadata ->> 'organizationId') = ${organizationId}`
      : sql``;

    // Keep this aligned with listDecisionsScoped() so UI totals/stats match the Decisions table.
    const excludedUseCaseTypes = [
      "rag",
      "reasoning",
      "language",
      "test_service",
      "restricted_service",
      "blocked_service",
    ];

    const raw = await db.execute(sql`
      SELECT
        ds.decision_spine_id as "decisionSpineId",
        ds.classification as "classification",
        ds.created_at as "createdAt",
        req.source_metadata as "sourceMetadata"
      FROM decision_spines ds
      -- Only count user-visible decisions that are linked to a real demand report
      INNER JOIN demand_reports dr ON dr.decision_spine_id = ds.decision_spine_id
      LEFT JOIN LATERAL (
        SELECT r.request_id, r.use_case_type, r.source_metadata, r.requested_at
        FROM canonical_ai_requests r
        WHERE r.decision_spine_id = ds.decision_spine_id
          ${organizationFilter}
          AND r.use_case_type NOT IN (${sql.join(excludedUseCaseTypes.map((t) => sql`${t}`), sql`, `)})
        ORDER BY r.requested_at DESC
        LIMIT 1
      ) req ON true
      WHERE req.request_id IS NOT NULL
      ORDER BY ds.created_at DESC;
    `);

    const rows = ((raw as { rows?: Record<string, unknown>[] }).rows ?? raw) as Record<string, unknown>[];

    const statusCounts = { processing: 0, pending: 0, blocked: 0, completed: 0, needsInfo: 0 };
    const classificationCounts: Record<string, number> = {};
    const layerCounts: Record<number, number> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let todayCount = 0;

    for (const row of rows) {
      if (this.accumulatePipelineStatsRow(row, statusCounts, classificationCounts, layerCounts, today)) {
        todayCount++;
      }
    }

    return {
      total: rows.length,
      ...statusCounts,
      byClassification: classificationCounts,
      byLayer: layerCounts,
      avgProcessingTimeMs: 0,
      todayCount,
    };
  }

  async getEngineStats(): Promise<{
    engines: Array<{
      id: string;
      name: string;
      kind: string;
      enabled: boolean;
      totalRuns: number;
      lastUsed: string | null;
    }>;
    attestations: number;
    redactionReceipts: number;
    boundary: {
      totalRuns: number;
      internalRuns: number;
      externalRuns: number;
      internalPct: number;
      externalPct: number;
      maskedExternalRuns: number;
      maskedExternalPct: number;
      blockedAttempts: number;
      blockedApprovalAttempts: number;
      executionsWithoutApproval: number;
    };
  }> {
    const engines = await db.select().from(enginePlugins);
    const attestationCount = await db.select({ count: sql`count(*)` }).from(runAttestations);
    const redactionCount = await db.select({ count: sql`count(*)` }).from(redactionReceipts);

    const [boundaryAgg] = await db
      .select({
        totalRuns: sql<number>`count(*)`,
        externalRuns: sql<number>`coalesce(sum(case when ${runAttestations.externalBoundaryCrossed} = true then 1 else 0 end), 0)`,
      })
      .from(runAttestations);

    const totalRuns = Number(boundaryAgg?.totalRuns || 0);
    const externalRuns = Number(boundaryAgg?.externalRuns || 0);
    const internalRuns = Math.max(0, totalRuns - externalRuns);

    const [maskedExternalAgg] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(runAttestations)
      .where(and(
        eq(runAttestations.externalBoundaryCrossed, true),
        sql`exists (
          select 1
          from ${redactionReceipts}
          where ${redactionReceipts.requestId} = ${runAttestations.requestId}
            and (${redactionReceipts.maskingApplied} = true or ${redactionReceipts.minimizationApplied} = true)
        )`,
      ));

    const maskedExternalRuns = Number(maskedExternalAgg?.count || 0);

    const [blockedAgg] = await db
      .select({
        blockedAttempts: sql<number>`count(*)`,
        blockedApprovalAttempts: sql<number>`coalesce(sum(case when (${brainEvents.payload} ->> 'reason') in ('missing_approval_id','approval_not_approved') then 1 else 0 end), 0)`,
      })
      .from(brainEvents)
      .where(and(
        inArray(brainEvents.eventType, ["CONVERSION_APPROVED", "PROJECT_WORK_BLOCKED"]),
        sql`(${brainEvents.payload} ->> 'reason') is not null`,
      ));

    const [executionsWithoutApprovalAgg] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(executions)
      .leftJoin(approvals, eq(executions.approvalId, approvals.approvalId))
      .where(sql`${approvals.approvalId} is null`);

    const runsAgg = await db
      .select({
        enginePluginId: runAttestations.enginePluginId,
        totalRuns: sql<number>`count(*)`,
        lastUsed: sql<Date | null>`max(${runAttestations.createdAt})`,
      })
      .from(runAttestations)
      .where(sql`${runAttestations.enginePluginId} is not null`)
      .groupBy(runAttestations.enginePluginId);

    const runsByEngine = new Map<string, { totalRuns: number; lastUsed: string | null }>();
    for (const row of runsAgg) {
      const id = String(row.enginePluginId);
      runsByEngine.set(id, {
        totalRuns: Number(row.totalRuns || 0),
        lastUsed: row.lastUsed ? new Date(row.lastUsed).toISOString() : null,
      });
    }

    return {
      engines: engines.map((e) => {
        const agg = runsByEngine.get(e.enginePluginId);
        return {
          id: e.enginePluginId,
          name: e.name,
          kind: e.kind,
          enabled: e.enabled,
          totalRuns: agg?.totalRuns ?? 0,
          lastUsed: agg?.lastUsed ?? null,
        };
      }),
      attestations: Number(attestationCount[0]?.count || 0),
      redactionReceipts: Number(redactionCount[0]?.count || 0),
      boundary: {
        totalRuns,
        internalRuns,
        externalRuns,
        internalPct: totalRuns > 0 ? Math.round((internalRuns / totalRuns) * 100) : 0,
        externalPct: totalRuns > 0 ? Math.round((externalRuns / totalRuns) * 100) : 0,
        maskedExternalRuns,
        maskedExternalPct: externalRuns > 0 ? Math.round((maskedExternalRuns / externalRuns) * 100) : 0,
        blockedAttempts: Number(blockedAgg?.blockedAttempts || 0),
        blockedApprovalAttempts: Number(blockedAgg?.blockedApprovalAttempts || 0),
        executionsWithoutApproval: Number(executionsWithoutApprovalAgg?.count || 0),
      },
    };
  }

  // ==================== ENGINE CRUD ====================

  async getAllEngines() {
    return db.select().from(enginePlugins);
  }

  /** Alias for getAllEngines — used by PluginRegistry */
  async listEnginePlugins() {
    return this.getAllEngines();
  }

  async getEngine(enginePluginId: string) {
    const [engine] = await db.select().from(enginePlugins).where(eq(enginePlugins.enginePluginId, enginePluginId));
    return engine || null;
  }

  async registerEngine(data: {
    enginePluginId: string;
    kind: EngineKind;
    name: string;
    version: string;
    enabled?: boolean;
    allowedMaxClass?: string;
    capabilities?: Record<string, boolean>;
    config?: Record<string, unknown>;
  }) {
    const [engine] = await db.insert(enginePlugins).values({
      enginePluginId: data.enginePluginId,
      kind: data.kind,
      name: data.name,
      version: data.version,
      enabled: data.enabled ?? true,
      allowedMaxClass: (data.allowedMaxClass || "INTERNAL") as typeof dataClassificationEnum.enumValues[number],
      capabilities: data.capabilities || {},
      config: data.config || {},
    }).returning();
    return engine;
  }

  async updateEngine(enginePluginId: string, updates: Partial<{
    name: string;
    version: string;
    enabled: boolean;
    allowedMaxClass: string;
    capabilities: Record<string, boolean>;
    config: Record<string, unknown>;
  }>) {
    const setObj: Record<string, unknown> = {};
    if (updates.name !== undefined) setObj.name = updates.name;
    if (updates.version !== undefined) setObj.version = updates.version;
    if (updates.enabled !== undefined) setObj.enabled = updates.enabled;
    if (updates.allowedMaxClass !== undefined) setObj.allowedMaxClass = updates.allowedMaxClass;
    if (updates.capabilities !== undefined) setObj.capabilities = updates.capabilities;
    if (updates.config !== undefined) setObj.config = updates.config;
    const [engine] = await db.update(enginePlugins).set(setObj as Partial<typeof enginePlugins.$inferInsert>).where(eq(enginePlugins.enginePluginId, enginePluginId)).returning();
    return engine || null;
  }

  async getEngineAttestations(enginePluginId: string) {
    return db.select().from(runAttestations).where(eq(runAttestations.enginePluginId, enginePluginId)).orderBy(desc(runAttestations.createdAt)).limit(20);
  }

  async getRunAttestationsForRequest(requestId: string) {
    const rid = (requestId || "").trim();
    if (!rid) return [];
    return db
      .select()
      .from(runAttestations)
      .where(eq(runAttestations.requestId, rid))
      .orderBy(desc(runAttestations.createdAt));
  }

  async resolveEngineForDecision(decisionId: string, defaultKind: EngineKind): Promise<EnginePluginRow | null> {
    // Helper: pick the highest-priority enabled engine of the given kind whose config carries a
    // non-empty endpoint. Falls back to the highest-priority engine even if its endpoint is empty,
    // so we never return null when at least one plugin is registered (callers handle empty endpoints).
    const pickBestEngineByKind = async (kind: EngineKind): Promise<EnginePluginRow | null> => {
      const candidates = await db
        .select()
        .from(enginePlugins)
        .where(and(eq(enginePlugins.kind, kind), eq(enginePlugins.enabled, true)));
      if (candidates.length === 0) return null;

      const withPriority = candidates.map((e) => {
        const cfg = (e.config || {}) as Record<string, unknown>;
        const endpoint = typeof cfg.endpoint === "string" ? cfg.endpoint.trim() : "";
        const priority = Number.isFinite(Number(cfg.priority)) ? Number(cfg.priority) : 0;
        return { engine: e, endpoint, priority };
      });
      withPriority.sort((a, b) => b.priority - a.priority);

      const operational = withPriority.find((c) => c.endpoint.length > 0);
      const selected = operational || withPriority[0];
      return selected?.engine || null;
    };

    const request = await this.getLatestRequest(decisionId);
    if (!request) {
      return pickBestEngineByKind(defaultKind);
    }

    const [spineOverride] = request.decisionSpineId
      ? await db
          .select()
          .from(routingOverrides)
          .where(
            and(
              eq(routingOverrides.enabled, true),
              eq(routingOverrides.scope, "SPINE"),
              eq(routingOverrides.scopeRef, request.decisionSpineId),
            ),
          )
      : [null];

    const [useCaseOverride] = request.useCaseType
      ? await db
          .select()
          .from(routingOverrides)
          .where(
            and(
              eq(routingOverrides.enabled, true),
              eq(routingOverrides.scope, "USE_CASE"),
              eq(routingOverrides.scopeRef, request.useCaseType),
            ),
          )
      : [null];

    const [globalOverride] = await db
      .select()
      .from(routingOverrides)
      .where(
        and(
          eq(routingOverrides.enabled, true),
          eq(routingOverrides.scope, "GLOBAL"),
        ),
      );

    const effectiveOverride = spineOverride || useCaseOverride || globalOverride || null;
    const resolvedKind = effectiveOverride?.forcedEngineKind || defaultKind;

    if (effectiveOverride?.forcedEngineId) {
      const [forcedEngine] = await db
        .select()
        .from(enginePlugins)
        .where(eq(enginePlugins.enginePluginId, effectiveOverride.forcedEngineId));
      if (forcedEngine?.enabled) {
        return forcedEngine;
      }
    }

    return pickBestEngineByKind(resolvedKind);
  }

  async getEffectiveRoutingOverride(decisionSpineId: string, useCaseType?: string | null) {
    const [spineOverride] = decisionSpineId
      ? await db
          .select()
          .from(routingOverrides)
          .where(
            and(
              eq(routingOverrides.enabled, true),
              eq(routingOverrides.scope, "SPINE"),
              eq(routingOverrides.scopeRef, decisionSpineId),
            ),
          )
      : [null];

    const [useCaseOverride] = useCaseType
      ? await db
          .select()
          .from(routingOverrides)
          .where(
            and(
              eq(routingOverrides.enabled, true),
              eq(routingOverrides.scope, "USE_CASE"),
              eq(routingOverrides.scopeRef, useCaseType),
            ),
          )
      : [null];

    const [globalOverride] = await db
      .select()
      .from(routingOverrides)
      .where(
        and(
          eq(routingOverrides.enabled, true),
          eq(routingOverrides.scope, "GLOBAL"),
        ),
      );

    if (spineOverride) return { source: "SPINE", override: spineOverride } as const;
    if (useCaseOverride) return { source: "USE_CASE", override: useCaseOverride } as const;
    if (globalOverride) return { source: "GLOBAL", override: globalOverride } as const;
    return { source: null, override: null } as const;
  }

  async getRoutingOverrides() {
    return db.select().from(routingOverrides);
  }

  async upsertRoutingOverride(data: {
    overrideId: string;
    scope: string;
    scopeRef?: string;
    forcedEngineKind?: "SOVEREIGN_INTERNAL" | "EXTERNAL_HYBRID" | "DISTILLATION";
    forcedEngineId?: string;
    enabled: boolean;
    reason?: string;
  }) {
    const existing = await db.select().from(routingOverrides).where(eq(routingOverrides.overrideId, data.overrideId));
    if (existing.length > 0) {
      const [result] = await db.update(routingOverrides).set({
        scope: data.scope,
        scopeRef: data.scopeRef || null,
        forcedEngineKind: data.forcedEngineKind || null,
        forcedEngineId: data.forcedEngineId || null,
        enabled: data.enabled,
        reason: data.reason || null,
      }).where(eq(routingOverrides.overrideId, data.overrideId)).returning();
      return result;
    }
    const [result] = await db.insert(routingOverrides).values({
      overrideId: data.overrideId,
      scope: data.scope,
      scopeRef: data.scopeRef || null,
      forcedEngineKind: data.forcedEngineKind || null,
      forcedEngineId: data.forcedEngineId || null,
      enabled: data.enabled,
      reason: data.reason || null,
    }).returning();
    return result;
  }

  async getLearningStats(): Promise<{
    totalArtifacts: number;
    draftCount: number;
    activeCount: number;
    activations: number;
    policyCount: number;
    policyVersionCount: number;
  }> {
    const arts = await db.select().from(learningAssets);
    const activationCount = await db.select({ count: sql`count(*)` }).from(learningAssetActivations);
    const policyCount = await db.select({ count: sql`count(*)` }).from(governancePolicies);
    const policyVersionCount = await db.select({ count: sql`count(*)` }).from(governancePolicyVersions);

    return {
      totalArtifacts: arts.length,
      draftCount: arts.filter(a => a.status === "DRAFT").length,
      activeCount: arts.filter(a => a.status === "APPROVED").length,
      activations: Number(activationCount[0]?.count || 0),
      policyCount: Number(policyCount[0]?.count || 0),
      policyVersionCount: Number(policyVersionCount[0]?.count || 0),
    };
  }

  // ============================================================================
  // JOURNEY MANAGEMENT — Decision Journey CRUD + linking
  // ============================================================================

  async createJourney(params: {
    journeyId: string;
    title: string;
    sourceEntityId?: string;
    demandSpineId: string;
    status: string;
    createdBy?: string;
  }): Promise<void> {
    await db.insert(decisionJourneys).values({
      journeyId: params.journeyId,
      title: params.title,
      sourceEntityId: params.sourceEntityId || null,
      demandSpineId: params.demandSpineId,
      status: params.status as typeof journeyStatusEnum.enumValues[number],
      createdBy: params.createdBy || null,
    });
  }

  async getJourney(journeyId: string): Promise<JourneyRow | null> {
    const [journey] = await db
      .select()
      .from(decisionJourneys)
      .where(eq(decisionJourneys.journeyId, journeyId));
    return journey || null;
  }

  async listJourneys(params?: { status?: string; limit?: number }): Promise<JourneyRow[]> {
    let query = db.select().from(decisionJourneys).orderBy(desc(decisionJourneys.createdAt));
    if (params?.status) {
      query = query.where(eq(decisionJourneys.status, params.status as typeof journeyStatusEnum.enumValues[number])) as typeof query;
    }
    if (params?.limit) {
      query = query.limit(params.limit) as typeof query;
    }
    return query;
  }

  async updateJourneyStatus(journeyId: string, status: string, projectRef?: Record<string, unknown>): Promise<void> {
    const updates: Record<string, unknown> = {
      status: status as typeof journeyStatusEnum.enumValues[number],
      updatedAt: new Date(),
    };
    if (projectRef) {
      updates.projectRef = projectRef;
    }
    await db
      .update(decisionJourneys)
      .set(updates as Partial<typeof decisionJourneys.$inferInsert>)
      .where(eq(decisionJourneys.journeyId, journeyId));
  }

  async updateJourneyClosure(journeyId: string, closureSpineId: string): Promise<void> {
    await db
      .update(decisionJourneys)
      .set({
        closureSpineId,
        updatedAt: new Date(),
      })
      .where(eq(decisionJourneys.journeyId, journeyId));
  }

  async incrementJourneyLearningCount(journeyId: string): Promise<void> {
    await db
      .update(decisionJourneys)
      .set({
        learningAssetCount: sql`${decisionJourneys.learningAssetCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(decisionJourneys.journeyId, journeyId));
  }

  async updateSpineJourney(decisionSpineId: string, journeyId: string, decisionPhase: string): Promise<void> {
    await db
      .update(decisionSpines)
      .set({
        journeyId,
        decisionPhase: decisionPhase as typeof decisionPhaseEnum.enumValues[number],
        updatedAt: new Date(),
      })
      .where(eq(decisionSpines.decisionSpineId, decisionSpineId));
  }

  async createSpine(params: {
    decisionSpineId: string;
    journeyId?: string;
    decisionPhase: string;
    title: string;
    createdBy?: string;
    status?: string;
  }): Promise<void> {
    await db.insert(decisionSpines).values({
      decisionSpineId: params.decisionSpineId,
      journeyId: params.journeyId || null,
      decisionPhase: params.decisionPhase as typeof decisionPhaseEnum.enumValues[number],
      title: params.title,
      createdBy: params.createdBy || null,
      status: (params.status || "CREATED") as typeof decisionSpineStatusEnum.enumValues[number],
    }).onConflictDoNothing({ target: decisionSpines.decisionSpineId });
  }

  // ============================================================================
  // LEARNING ASSET CREATION FROM APPROVED ARTIFACTS (Engine A feed)
  // ============================================================================

  async createLearningAssetFromArtifact(params: {
    decisionSpineId: string;
    subDecisionType: string;
    journeyId: string | null;
    decisionPhase: string;
    sourceArtifactId: string | null;
    sourceArtifactVersion: string | null;
    actorId?: string;
  }): Promise<void> {
    // Find or create a ledger record for this spine (required FK for learning_assets)
    const ledger = await this.ensureMemoryEntry(params.decisionSpineId);
    const ledgerId = (ledger as { ledgerId?: string } | null)?.ledgerId || null;
    if (!ledgerId) {
      logger.warn("[CoreviaStorage] Cannot create learning asset: no ledger record for spine", params.decisionSpineId);
      return;
    }

    // Get artifact content if available
    let content: Record<string, unknown> = {
      subDecisionType: params.subDecisionType,
      sourceSpineId: params.decisionSpineId,
      decisionPhase: params.decisionPhase,
    };

    if (params.sourceArtifactId) {
      try {
        const artifactContent = await this.getArtifactContent(params.sourceArtifactId, params.sourceArtifactVersion);
        if (artifactContent) {
          content = { ...content, ...artifactContent };
        }
      } catch {
        // Non-blocking: proceed with minimal content
      }
    }

    const learningAssetId = `LA-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;

    await db.insert(learningAssets).values({
      learningAssetId,
      sourceLedgerId: ledgerId,
      assetType: `ARTIFACT_${params.subDecisionType}`,
      status: "DRAFT" as typeof artifactStatusEnum.enumValues[number],
      version: 1,
      content,
      journeyId: params.journeyId,
      decisionPhase: params.decisionPhase as typeof decisionPhaseEnum.enumValues[number],
      sourceArtifactId: params.sourceArtifactId,
      sourceArtifactVersion: params.sourceArtifactVersion,
    });
  }

  async getLearningAssetsByJourney(journeyId: string): Promise<LearningAssetRow[]> {
    return db
      .select()
      .from(learningAssets)
      .where(eq(learningAssets.journeyId, journeyId))
      .orderBy(desc(learningAssets.createdAt));
  }

  private async getArtifactContent(
    artifactId: string,
    versionId?: string | null,
  ): Promise<Record<string, unknown> | null> {
    try {
      let query;
      if (versionId) {
        [query] = await db
          .select()
          .from(decisionArtifactVersions)
          .where(eq(decisionArtifactVersions.artifactVersionId, versionId))
          .limit(1);
      } else {
        [query] = await db
          .select()
          .from(decisionArtifactVersions)
          .where(eq(decisionArtifactVersions.artifactId, artifactId))
          .orderBy(desc(decisionArtifactVersions.version))
          .limit(1);
      }
      return (query?.content as Record<string, unknown>) || null;
    } catch {
      return null;
    }
  }
}

export const coreviaStorage = new CoreviaStorage();
