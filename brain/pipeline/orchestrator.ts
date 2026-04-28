import { randomUUID } from "node:crypto";
import {
  DecisionObject,
  DecisionStatus,
  AuditEvent,
  PipelineResult,
  LayerResult
} from "@shared/schemas/corevia/decision-object";
import { Layer1Intake } from "../layers/layer1-intake";
import { Layer2Classification } from "../layers/layer2-classification";
import { Layer3PolicyOps } from "../layers/layer3-policyops";
import { Layer4Context } from "../layers/layer4-context";
import { Layer5Orchestration } from "../layers/layer5-orchestration";
import { Layer6Reasoning } from "../layers/layer6-reasoning";
import { Layer7Validation } from "../layers/layer7-validation";
import { Layer8Memory } from "../layers/layer8-memory";
import { coreviaStorage } from "../storage";
import { logger } from "../../platform/observability";
import { getLayerConfig, loadLayerConfigsFromDB, type LayerConfig } from "../control-plane";

// Pipeline outer wall clock. BUSINESS_CASE on a sovereign single-worker RunPod GPU runs
// 5 sections sequentially at ~60-180s each (warmup + AWQ throughput) — total can exceed
// 600s comfortably. The outer timeout MUST be larger than (Layer 6 timeoutMs + L1-L5 +
// L7-L8 overhead). 1200s gives Layer 6 headroom (currently 420s) plus generous margin.
const DEFAULT_PIPELINE_TIMEOUT_MS = 1_200_000;

function resolvePipelineTimeoutMs(): number {
  const configured = Number(process.env.COREVIA_PIPELINE_TIMEOUT_MS || DEFAULT_PIPELINE_TIMEOUT_MS);
  if (!Number.isFinite(configured)) {
    return DEFAULT_PIPELINE_TIMEOUT_MS;
  }
  return Math.max(120_000, Math.floor(configured));
}

/**
 * CoreviaOrchestrator - Main pipeline controller for the COREVIA Brain
 *
 * Executes the 8-layer governance-first decision pipeline:
 * 1. Intake & Signal
 * 2. Classification & Sensitivity
 * 3. PolicyOps (BLOCK or ALLOW)
 * 4. Context & Quality (NEEDS_INFO or READY)
 * 5. Intelligence Orchestration
 * 6. Reasoning & Analysis (SAFE ZONE)
 * 7. Validation & HITL (AUTHORITY GATE)
 * 8. Memory & Learning
 *
 * INVARIANTS:
 * - No intelligence before Layer 3 allows it
 * - No side effects before Layer 7 approval
 * - No learning from rejected outputs
 * - Append-only decision object
 * - Full audit trail
 */
export class CoreviaOrchestrator {
  private readonly layer1: Layer1Intake;
  private readonly layer2: Layer2Classification;
  private readonly layer3: Layer3PolicyOps;
  private readonly layer4: Layer4Context;
  private readonly layer5: Layer5Orchestration;
  private readonly layer6: Layer6Reasoning;
  private readonly layer7: Layer7Validation;
  private readonly layer8: Layer8Memory;

  constructor() {
    this.layer1 = new Layer1Intake();
    this.layer2 = new Layer2Classification();
    this.layer3 = new Layer3PolicyOps();
    this.layer4 = new Layer4Context();
    this.layer5 = new Layer5Orchestration();
    this.layer6 = new Layer6Reasoning();
    this.layer7 = new Layer7Validation();
    this.layer8 = new Layer8Memory();
  }

  /**
   * Generate a new correlation ID for tracking
   */
  private generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `cor_${timestamp}_${random}`;
  }

  private abortError(reason?: unknown): Error {
    if (reason instanceof Error) {
      return reason;
    }
    return new Error(typeof reason === "string" && reason ? reason : "Pipeline aborted");
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw this.abortError(signal.reason);
    }
  }

  /**
   * Create initial decision object
   */
  private createDecisionObject(
    serviceId: string,
    routeKey: string,
    inputData: Record<string, unknown>,
    _userId: string,
    _organizationId?: string
  ): DecisionObject {
    const now = new Date().toISOString();
    const decisionId = randomUUID();
    const projectId = inputData.projectId as string | undefined;
    const demandId = inputData.demandId as string | undefined;
    const baseId = projectId || demandId || this.generateCorrelationId();
    const correlationId = `${baseId}_${serviceId}_${Date.now()}`;

    return {
      decisionId,
      correlationId,
      currentLayer: 1,
      status: "intake",
      audit: {
        events: [{
          id: randomUUID(),
          layer: 0,
          eventType: "decision_created",
          eventData: { serviceId, routeKey },
          actorType: "system",
          timestamp: now,
        }],
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Append audit event to decision object
   */
  private appendAuditEvent(decision: DecisionObject, event: AuditEvent): DecisionObject {
    return {
      ...decision,
      audit: {
        events: [...decision.audit.events, event],
      },
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Update decision status and layer
   */
  private updateDecisionState(
    decision: DecisionObject,
    layer: number,
    status: DecisionStatus,
    layerData: Record<string, unknown>
  ): DecisionObject {
    const layerKey = this.getLayerDataKey(layer);
    return {
      ...decision,
      currentLayer: layer,
      status,
      [layerKey]: layerData,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get the key for layer-specific data
   */
  private getLayerDataKey(layer: number): keyof DecisionObject {
    const keys: Record<number, keyof DecisionObject> = {
      1: "input",
      2: "classification",
      3: "policy",
      4: "context",
      5: "orchestration",
      6: "advisory",
      7: "validation",
      8: "memory",
    };
    return keys[layer] || "input";
  }

  private buildControlPlaneResult(
    layer: number,
    status: DecisionStatus,
    message: string,
    shouldContinue: boolean
  ): LayerResult {
    return {
      success: shouldContinue,
      layer,
      status,
      data: {
        controlPlane: {
          enforced: true,
          reason: message,
        },
      },
      error: shouldContinue ? undefined : message,
      shouldContinue,
      auditEvent: {
        id: randomUUID(),
        layer,
        eventType: shouldContinue ? "layer_control_skipped" : "layer_control_stopped",
        eventData: { reason: message },
        actorType: "system",
        timestamp: new Date().toISOString(),
      },
    };
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, layer: number): Promise<T> {
    if (!timeoutMs || timeoutMs <= 0) {
      return promise;
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`Layer ${layer} timed out after ${timeoutMs}ms`)),
        timeoutMs
      );
    });

    return Promise.race([promise, timeout]).finally(() => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    });
  }

  private async executeControlledLayer(
    layer: number,
    run: () => Promise<LayerResult>,
  ): Promise<LayerResult> {
    const config = getLayerConfig(layer);
    if (config && (!config.enabled || config.mode === "bypass")) {
      const reason = `Layer ${layer} (${config.name}) is ${!config.enabled ? "disabled" : "in bypass mode"} by the control plane`;
      if (layer === 8) {
        return this.buildControlPlaneResult(layer, "memory", reason, true);
      }
      return this.buildControlPlaneResult(layer, "blocked", reason, false);
    }

    const retries = Math.max(0, config?.retries ?? 0);
    const timeoutMs = Math.max(0, config?.timeoutMs ?? 0);
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.withTimeout(run(), timeoutMs, layer);
        if (config?.approvalRequired && config.mode === "enforce") {
          return {
            ...result,
            status: "pending_approval",
            shouldContinue: false,
            data: {
              ...(result.data || {}),
              controlPlaneApproval: {
                required: true,
                layer,
                roles: config.approvalRoles,
                reason: `Layer ${layer} (${config.name}) requires approval by control-plane configuration`,
              },
            },
            auditEvent: {
              ...result.auditEvent,
              eventType: "layer_control_approval_required",
              eventData: {
                ...(result.auditEvent.eventData || {}),
                layer,
                roles: config.approvalRoles,
                reason: `Layer ${layer} (${config.name}) requires approval by control-plane configuration`,
              },
            },
          };
        }
        return result;
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          logger.warn(`[Corevia] Layer ${layer} attempt ${attempt + 1} failed; retrying:`, error instanceof Error ? error.message : error);
        }
      }
    }

    const message = lastError instanceof Error ? lastError.message : `Layer ${layer} failed`;
    return {
      success: false,
      layer,
      status: "blocked",
      error: message,
      shouldContinue: false,
      auditEvent: {
        id: randomUUID(),
        layer,
        eventType: "layer_execution_failed",
        eventData: {
          error: message,
          retries,
          timeoutMs,
        },
        actorType: "system",
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Execute the full 8-layer pipeline
   */
  async execute(
    serviceId: string,
    routeKey: string,
    inputData: Record<string, unknown>,
    userId: string,
    organizationId?: string,
    options?: {
      decisionSpineId?: string;
      abortSignal?: AbortSignal;
    }
  ): Promise<PipelineResult> {
    await loadLayerConfigsFromDB();
    const pipelineTimeoutMs = resolvePipelineTimeoutMs();
    this.throwIfAborted(options?.abortSignal);
    const pipelinePromise = this._executeInternal(serviceId, routeKey, inputData, userId, organizationId, options);
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let abortHandler: (() => void) | undefined;
    const timeoutPromise = new Promise<PipelineResult>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(`Pipeline timed out after ${pipelineTimeoutMs / 1000}s`)), pipelineTimeoutMs);
      if (options?.abortSignal) {
        abortHandler = () => reject(this.abortError(options.abortSignal?.reason));
        options.abortSignal.addEventListener("abort", abortHandler, { once: true });
      }
    });

    return Promise.race([pipelinePromise, timeoutPromise]).finally(() => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      if (options?.abortSignal && abortHandler) {
        options.abortSignal.removeEventListener("abort", abortHandler);
      }
    });
  }

  /**
   * Detect whether the input represents a demand request and normalize
   * the service/route/input accordingly.
   */
  private resolveDemandInput(
    serviceId: string,
    routeKey: string,
    inputData: Record<string, unknown>
  ): { normalizedServiceId: string; normalizedRouteKey: string; normalizedInputData: Record<string, unknown> } {
    const rawSourceType = inputData?.sourceType;
    const sourceType = (typeof rawSourceType === "string" ? rawSourceType : "").toLowerCase();
    const sourceContext = (inputData?.sourceContext || {}) as Record<string, unknown>;
    const hasDemandContext =
      typeof sourceContext?.demandTitle === "string" ||
      typeof inputData?.sourceId === "string";

    const demandServices = new Set([
      "demand_report", "demand_management", "demand_analysis",
    ]);
    const demandRoutes = new Set([
      "demand_report", "demand.new", "demand.generate_fields",
      "demand.classify_request", "demand.comprehensive_analysis",
    ]);
    const demandSourceTypes = new Set([
      "demand_report", "demand_request", "demand", "demand_analysis",
    ]);

    const isDemandService = demandServices.has(serviceId) || demandRoutes.has(routeKey);
    const isDemandSource = demandSourceTypes.has(sourceType);
    const isDemandRequest = isDemandService || isDemandSource || (hasDemandContext && !serviceId && !routeKey);

    if (!isDemandRequest) {
      return { normalizedServiceId: serviceId, normalizedRouteKey: routeKey, normalizedInputData: inputData };
    }

    return {
      normalizedServiceId: "demand_management",
      normalizedRouteKey: "demand.new",
      normalizedInputData: {
        ...inputData,
        projectName: sourceContext.demandTitle || inputData.projectName,
        businessObjective: sourceContext.businessObjective || inputData.businessObjective,
        department: sourceContext.department || inputData.department,
        organizationName: sourceContext.organization || inputData.organizationName,
        budgetRange: sourceContext.budgetRange || inputData.budgetRange,
        description: sourceContext.businessObjective || inputData.description,
        originalRouteKey: routeKey,
      },
    };
  }

  /**
   * Sync artifact and sub-decision status after Layer 7 approval.
   * Only DEMAND_REQUEST artifacts are auto-approved; all others remain DRAFT.
   */
  /**
   * Best-effort promotion of DEMAND_REQUEST sub-decisions from DRAFT to APPROVED.
   */
  private async promoteSubDecisions(decisionId: string): Promise<void> {
    const subs = await coreviaStorage.listSubDecisions(decisionId);
    for (const sub of subs) {
      const subRecord = sub as unknown as Record<string, unknown>;
      if (subRecord.subDecisionType === "DEMAND_REQUEST" && subRecord.status === "DRAFT") {
        await coreviaStorage.updateSubDecisionStatus(subRecord.subDecisionId as string, "APPROVED");
      }
    }
  }

  private async persistConfiguredLayerApprovalGate(
    decision: DecisionObject,
    layer: number,
    config: LayerConfig | undefined,
  ): Promise<void> {
    if (!config?.approvalRequired || config.mode !== "enforce") return;

    // Internal support routes (rag.*, reasoning.*, version_impact.*, query.expand, rerank, classify, …)
    // must never enter any human approval queue, regardless of layer-level control-plane config.
    // The control plane gates govern the demand/governance journey; they are not meant to gate
    // every embedding or query-expansion call the Brain makes internally.
    if (this.isInternalSupportRoute(decision)) {
      return;
    }

    const approvalId = `APR-L${layer}-${decision.decisionId.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;
    const reason = `Layer ${layer} (${config.name}) requires approval by control-plane configuration`;
    await coreviaStorage.createApproval({
      decisionId: decision.decisionId,
      approvalId,
      status: "pending",
      approvalReason: reason,
      approvedActions: [],
      metadata: {
        type: "corevia_brain_layer_control",
        approvalId,
        layer,
        layerKey: config.key,
        layerName: config.name,
        roles: config.approvalRoles,
        reason,
      },
    });
  }

  private async syncArtifactStatusAfterL7(decision: DecisionObject): Promise<void> {
    const l7Status = decision.validation?.status;
    if (l7Status !== "approved") {
      logger.info(`[Corevia] Artifacts remain DRAFT — HITL required (L7 status=${l7Status})`);
      return;
    }

    const artifacts = await coreviaStorage.listArtifactsForSpine(decision.decisionId);
    let autoApprovedCount = 0;
    for (const art of artifacts) {
      if (art.status !== "DRAFT" || art.artifactType !== "DEMAND_REQUEST") {
        continue;
      }
      await coreviaStorage.updateDecisionArtifactStatus(art.artifactId, "APPROVED");
      autoApprovedCount++;
      try {
        await this.promoteSubDecisions(decision.decisionId);
      } catch (_subErr) {
        logger.debug(`[Corevia] Best-effort sub-decision promotion failed`, _subErr instanceof Error ? _subErr.message : _subErr);
      }
    }
    const skipped = artifacts.filter(a => a.status === "DRAFT" && a.artifactType !== "DEMAND_REQUEST").length;
    if (autoApprovedCount > 0 || skipped > 0) {
      logger.info(`[Corevia] L7: Auto-approved ${autoApprovedCount} DEMAND_REQUEST artifact(s), ${skipped} other artifact(s) remain DRAFT for human review`);
    }
  }

  /**
   * Persist the Layer 7 HITL gate as a first-class approval record.
   * Demand routes may add notifications/workbench metadata, but the Brain core
   * must always make a pending Layer 7 decision discoverable by approval queues.
   */
  private isInternalSupportRoute(decision: DecisionObject): boolean {
    const serviceId = String(decision.input?.serviceId || "").toLowerCase();
    const routeKey = String(decision.input?.routeKey || "").toLowerCase();
    const rawRouteKey = String((decision.input?.rawInput as Record<string, unknown> | undefined)?.routeKey || "").toLowerCase();
    const originalRouteKey = String((decision.input?.normalizedInput as Record<string, unknown> | undefined)?.originalRouteKey || "").toLowerCase();

    // Fallback: the orchestrator stamps serviceId/routeKey into the decision_created
    // audit event before Layer 1 runs, so this guard works even if a caller reaches
    // the L7 gate without going through Layer 1 first.
    const createdEvent = decision.audit?.events?.find((evt) => evt.eventType === "decision_created");
    const auditEventData = (createdEvent?.eventData || {}) as Record<string, unknown>;
    const auditServiceId = String(auditEventData.serviceId || "").toLowerCase();
    const auditRouteKey = String(auditEventData.routeKey || "").toLowerCase();

    const route = routeKey || rawRouteKey || originalRouteKey || auditRouteKey;
    const svc = serviceId || auditServiceId;

    return (
      svc === "rag" ||
      svc === "reasoning" ||
      svc === "version_impact" ||
      route.startsWith("rag.") ||
      route.startsWith("reasoning.") ||
      route.startsWith("version_impact.") ||
      route.includes("query.expand") ||
      route.includes("query_rewrite") ||
      route.includes("rerank") ||
      route.includes("classify")
    );
  }

  private async ensureLayer7ApprovalGate(decision: DecisionObject): Promise<void> {
    if (decision.validation?.status !== "pending") {
      return;
    }

    if (this.isInternalSupportRoute(decision)) {
      logger.info(`[Corevia] Layer 7: internal support route skipped PMO approval gate`);
      return;
    }

    const approvalId = decision.validation.approvalId || `APR-L7-${decision.decisionId.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;
    const approvalReasons = Array.isArray(decision.policy?.approvalReasons)
      ? decision.policy.approvalReasons.filter((reason): reason is string => typeof reason === "string" && reason.trim().length > 0)
      : [];
    const failedChecks = Array.isArray(decision.validation.thresholdChecks)
      ? decision.validation.thresholdChecks
          .filter((check) => !check.passed)
          .map((check) => `${check.check} failed (${check.value}/${check.threshold})`)
      : [];
    const biasReasons = decision.validation.biasDetection?.issues || [];
    const reasons = [...approvalReasons, ...failedChecks, ...biasReasons];
    const reason = reasons.length > 0
      ? reasons.join("; ")
      : "Layer 7 authority validation requires human approval";

    try {
      const persistedApproval = await coreviaStorage.createApproval({
        decisionId: decision.decisionId,
        approvalId,
        status: "pending",
        approvalReason: reason,
        approvedActions: [],
        metadata: {
          type: "corevia_brain_layer7",
          approvalId,
          layer: 7,
          layerKey: "approval",
          layerName: "Authority Validation (HITL)",
          roles: ["pmo_director", "director"],
          reason,
          approvalReasons,
          failedChecks,
          biasReasons,
        },
      });

      const approvalOutcome = String((persistedApproval as { outcome?: unknown }).outcome || "").toUpperCase();
      const approvalConditions = Array.isArray((persistedApproval as { conditions?: unknown }).conditions)
        ? (persistedApproval as { conditions: Array<Record<string, unknown>> }).conditions
        : [];
      const approvedCondition = approvalConditions.some((condition) => String(condition.status || "").toLowerCase() === "approved");
      if (approvalOutcome === "APPROVE" || approvedCondition) {
        decision.validation = {
          ...decision.validation,
          approvalId: persistedApproval.approvalId,
          status: "approved",
          approvedBy: typeof persistedApproval.approvedBy === "string" ? persistedApproval.approvedBy : undefined,
          approvalReason: typeof persistedApproval.rationale === "string" ? persistedApproval.rationale : reason,
          approvedActions: [],
        };
        logger.info(`[Corevia] Layer 7: existing approved spine-level approval found — inheriting approval for ${decision.decisionId}`);
      }
    } catch (error) {
      logger.warn(`[Corevia] Could not persist Layer 7 approval gate for ${decision.decisionId}:`, error instanceof Error ? error.message : error);
    }
  }

  /**
   * Determine final pipeline status, persist decision, and record outcome.
   */
  private async finalizePipeline(
    decision: DecisionObject,
    userId: string
  ): Promise<DecisionObject> {
    try {
      await coreviaStorage.persistDecisionObject(decision);
    } catch (err) {
      logger.warn(`[Corevia] Warning: Could not persist final decision state:`, err instanceof Error ? err.message : err);
    }

    const validationStatus = decision.validation?.status;
    const requiresApproval = validationStatus === "pending" && !this.isInternalSupportRoute(decision);
    const hasApprovedActions = Array.isArray(decision.validation?.approvedActions)
      ? decision.validation?.approvedActions.length > 0
      : false;
    const shouldExecute = validationStatus === "approved" && hasApprovedActions;

    let finalStatus: DecisionStatus;
    if (requiresApproval) {
      finalStatus = "pending_approval";
    } else if (shouldExecute) {
      finalStatus = "action_execution";
    } else {
      finalStatus = "completed";
    }

    const finalDecision: DecisionObject = {
      ...decision,
      status: finalStatus,
      completedAt: finalStatus === "completed" ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    };

    try {
      await coreviaStorage.persistDecisionObject(finalDecision);
      if (finalStatus === "completed") {
        await coreviaStorage.updateLedgerConclusion(finalDecision.decisionId, "COMPLETED");
        await coreviaStorage.saveDecisionOutcome({
          decisionId: finalDecision.decisionId,
          outcomeStatus: "completed",
          recordedBy: userId || "system",
        });
      }
    } catch (err) {
      logger.info(`[Corevia] Warning: Could not persist final decision: ${err instanceof Error ? err.message : "unknown"}`);
    }

    if (requiresApproval) {
      await this.tryAutoApproveIfBusinessCaseReady(finalDecision);
    }

    return finalDecision;
  }

  /**
   * Handle pipeline errors — add audit event and persist best-effort.
   */
  private async handlePipelineError(
    decision: DecisionObject,
    error: unknown
  ): Promise<PipelineResult> {
    logger.error(`[Corevia] Pipeline error:`, error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const updatedDecision = this.appendAuditEvent(decision, {
      id: randomUUID(),
      layer: decision.currentLayer,
      eventType: "pipeline_error",
      eventData: { error: errorMessage },
      actorType: "system",
      timestamp: new Date().toISOString(),
    });

    try {
      await coreviaStorage.addAuditEvent(
        decision.decisionId,
        decision.correlationId,
        decision.currentLayer,
        "pipeline_error",
        { error: errorMessage, _audit: { actorType: "system", timestamp: new Date().toISOString() } },
        "system"
      );
    } catch (err) {
      logger.warn(
        `[Corevia] Warning: Could not persist pipeline_error audit event:`,
        err instanceof Error ? err.message : err
      );
    }

    return {
      success: false,
      decisionId: updatedDecision.decisionId,
      correlationId: updatedDecision.correlationId,
      finalStatus: updatedDecision.status,
      stoppedAtLayer: updatedDecision.currentLayer,
      stopReason: errorMessage,
      decision: updatedDecision,
    };
  }

  /**
   * Execute layers 1–6 sequentially with abort checks and early-return handling.
   * Returns the updated decision and the layer at which the pipeline stopped, if any.
   */
  private async executeCoreLayers(
    decision: DecisionObject,
    normalizedServiceId: string,
    normalizedRouteKey: string,
    normalizedInputData: Record<string, unknown>,
    userId: string,
    organizationId: string | undefined,
    abortSignal?: AbortSignal
  ): Promise<{ decision: DecisionObject; earlyResult?: PipelineResult }> {
    // ========== LAYER 1: INTAKE & SIGNAL ==========
    this.throwIfAborted(abortSignal);
    logger.info(`[Corevia] Layer 1: Intake & Signal`);
    const layer1Result = await this.executeControlledLayer(1, () =>
      this.layer1.execute(decision, normalizedServiceId, normalizedRouteKey, normalizedInputData, userId, organizationId)
    );
    let d = await this.processLayerResult(decision, layer1Result);
    if (!layer1Result.shouldContinue) {
      await this.persistConfiguredLayerApprovalGate(d, 1, getLayerConfig(1));
      return { decision: d, earlyResult: this.createPipelineResult(d, 1, layer1Result.error) };
    }

    // ========== LAYER 2: CLASSIFICATION & SENSITIVITY ==========
    this.throwIfAborted(abortSignal);
    logger.info(`[Corevia] Layer 2: Classification & Sensitivity`);
    const layer2Result = await this.executeControlledLayer(2, () => this.layer2.execute(d));
    d = await this.processLayerResult(d, layer2Result);
    if (!layer2Result.shouldContinue) {
      await this.persistConfiguredLayerApprovalGate(d, 2, getLayerConfig(2));
      return { decision: d, earlyResult: this.createPipelineResult(d, 2, layer2Result.error) };
    }

    // ========== LAYER 3: POLICYOPS (BLOCK or ALLOW) ==========
    this.throwIfAborted(abortSignal);
    logger.info(`[Corevia] Layer 3: PolicyOps`);
    const layer3Result = await this.executeControlledLayer(3, () => this.layer3.execute(d));
    d = await this.processLayerResult(d, layer3Result);
    if (!layer3Result.shouldContinue) {
      await this.persistConfiguredLayerApprovalGate(d, 3, getLayerConfig(3));
      logger.info(`[Corevia] Layer 3: BLOCKED - ${layer3Result.error}`);
      await this.persistEarlyStop(d);
      await coreviaStorage.updateLedgerConclusion(d.decisionId, "REJECTED");
      return { decision: d, earlyResult: this.createPipelineResult(d, 3, layer3Result.error) };
    }

    // ========== LAYER 4: CONTEXT & QUALITY (NEEDS_INFO or READY) ==========
    this.throwIfAborted(abortSignal);
    logger.info(`[Corevia] Layer 4: Context & Quality`);
    const layer4Result = await this.executeControlledLayer(4, () => this.layer4.execute(d));
    d = await this.processLayerResult(d, layer4Result);
    if (!layer4Result.shouldContinue) {
      await this.persistConfiguredLayerApprovalGate(d, 4, getLayerConfig(4));
      logger.info(`[Corevia] Layer 4: NEEDS_INFO - stopping for clarification`);
      await this.persistEarlyStop(d);
      await coreviaStorage.updateLedgerConclusion(d.decisionId, "HOLD");
      return { decision: d, earlyResult: this.createPipelineResult(d, 4, layer4Result.error) };
    }

    // ========== LAYER 5: INTELLIGENCE ORCHESTRATION ==========
    this.throwIfAborted(abortSignal);
    logger.info(`[Corevia] Layer 5: Intelligence Orchestration`);
    const layer5Result = await this.executeControlledLayer(5, () => this.layer5.execute(d));
    d = await this.processLayerResult(d, layer5Result);
    if (!layer5Result.shouldContinue) {
      await this.persistConfiguredLayerApprovalGate(d, 5, getLayerConfig(5));
      return { decision: d, earlyResult: this.createPipelineResult(d, 5, layer5Result.error) };
    }

    // ========== LAYER 6: REASONING & ANALYSIS (SAFE ZONE) ==========
    this.throwIfAborted(abortSignal);
    logger.info(`[Corevia] Layer 6: Reasoning & Analysis (SAFE ZONE)`);
    const layer6Result = await this.executeControlledLayer(6, () => this.layer6.execute(d, { abortSignal }));
    d = await this.processLayerResult(d, layer6Result);
    if (!layer6Result.shouldContinue) {
      await this.persistConfiguredLayerApprovalGate(d, 6, getLayerConfig(6));
      return { decision: d, earlyResult: this.createPipelineResult(d, 6, layer6Result.error) };
    }

    return { decision: d };
  }

  /**
   * Internal pipeline execution (wrapped by timeout in execute())
   */
  private async _executeInternal(
    serviceId: string,
    routeKey: string,
    inputData: Record<string, unknown>,
    userId: string,
    organizationId?: string,
    options?: {
      decisionSpineId?: string;
      abortSignal?: AbortSignal;
    }
  ): Promise<PipelineResult> {
    const { normalizedServiceId, normalizedRouteKey, normalizedInputData } =
      this.resolveDemandInput(serviceId, routeKey, inputData);

    logger.info(`[Corevia] Starting pipeline for ${normalizedServiceId}/${normalizedRouteKey}`);

    let decision = this.createDecisionObject(normalizedServiceId, normalizedRouteKey, normalizedInputData, userId, organizationId);
    const decisionSpineId = options?.decisionSpineId
      || (typeof normalizedInputData.decisionSpineId === "string" ? String(normalizedInputData.decisionSpineId) : undefined);

    try {
      this.throwIfAborted(options?.abortSignal);
      const savedDecision = await coreviaStorage.createDecision({
        correlationId: decision.correlationId,
        serviceId: normalizedServiceId,
        routeKey: normalizedRouteKey,
        inputData: normalizedInputData,
        userId,
        organizationId,
        currentLayer: 1,
        status: "intake",
        decisionSpineId,
      });
      decision.decisionId = savedDecision.id;
      decision.requestId = savedDecision.requestId || undefined;

      // Execute layers 1–6
      const coreResult = await this.executeCoreLayers(
        decision, normalizedServiceId, normalizedRouteKey, normalizedInputData,
        userId, organizationId, options?.abortSignal
      );
      decision = coreResult.decision;
      if (coreResult.earlyResult) {
        return coreResult.earlyResult;
      }

      // ========== LAYER 7: VALIDATION & HITL (AUTHORITY GATE) ==========
      this.throwIfAborted(options?.abortSignal);
      logger.info(`[Corevia] Layer 7: Validation & HITL`);
      const layer7Result = await this.executeControlledLayer(7, () => this.layer7.execute(decision));
      decision = await this.processLayerResult(decision, layer7Result);
      if (!layer7Result.shouldContinue) {
        await this.persistEarlyStop(decision);
        return this.createPipelineResult(decision, 7, layer7Result.error);
      }
      await this.ensureLayer7ApprovalGate(decision);

      // Sync artifact status based on Layer 7 outcome
      try {
        await this.syncArtifactStatusAfterL7(decision);
      } catch (err) {
        logger.warn(`[Corevia] Warning: Could not sync artifact status after L7:`, err instanceof Error ? err.message : err);
      }

      // ========== LAYER 8: MEMORY & LEARNING ==========
      this.throwIfAborted(options?.abortSignal);
      logger.info(`[Corevia] Layer 8: Memory & Learning`);
      const layer8Result = await this.executeControlledLayer(8, () => this.layer8.execute(decision));
      decision = await this.processLayerResult(decision, layer8Result);

      // Finalize pipeline — determine status, persist, and record outcome
      decision = await this.finalizePipeline(decision, userId);

      logger.info(`[Corevia] Pipeline completed: ${decision.decisionId}, Status: ${decision.status}`);
      return this.createPipelineResult(decision, 8);

    } catch (error) {
      return this.handlePipelineError(decision, error);
    }
  }

  /**
   * Process layer result and update decision
   */
  private async processLayerResult(decision: DecisionObject, result: LayerResult): Promise<DecisionObject> {
    // Update decision with layer data
    const updatedDecision = this.updateDecisionState(
      decision,
      result.layer,
      result.status,
      result.data || {}
    );

    // Persist audit event (best-effort) so UI reflects real, executed layer signals.
    try {
      await coreviaStorage.persistLayerData(updatedDecision.decisionId, updatedDecision);
      await coreviaStorage.addAuditEvent(
        updatedDecision.decisionId,
        updatedDecision.correlationId,
        result.layer,
        result.auditEvent.eventType,
        {
          ...result.auditEvent.eventData,
          _audit: {
            auditEventId: result.auditEvent.id,
            actorType: result.auditEvent.actorType,
            timestamp: result.auditEvent.timestamp,
            durationMs: result.auditEvent.durationMs,
          },
        },
        result.auditEvent.actorId
      );
    } catch (err) {
      logger.warn(
        `[Corevia] Warning: Could not persist layer ${result.layer} audit event (${result.auditEvent.eventType}):`,
        err instanceof Error ? err.message : err
      );
    }

    // Append audit event to in-memory decision object
    return this.appendAuditEvent(updatedDecision, result.auditEvent);
  }

  /**
   * Persist decision on early stop (blocked, needs_info, etc.)
   */
  private async persistEarlyStop(decision: DecisionObject): Promise<void> {
    try {
      await coreviaStorage.persistDecisionObject(decision);
    } catch (err) {
      logger.info(`[Corevia] Warning: Could not persist early stop: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  /**
   * Create pipeline result
   */
  private createPipelineResult(
    decision: DecisionObject,
    stoppedAtLayer?: number,
    stopReason?: string
  ): PipelineResult {
    const isSuccess = decision.status === "completed" ||
                     (decision.status !== "blocked" && decision.status !== "rejected");

    // Extract missing fields from context data if stopped at Layer 4
    const missingFields = decision.status === "needs_info" && decision.context
      ? decision.context.missingFields || []
      : [];

    return {
      success: isSuccess,
      decisionId: decision.decisionId,
      correlationId: decision.correlationId,
      finalStatus: decision.status,
      stoppedAtLayer: isSuccess ? undefined : stoppedAtLayer,
      stopReason: isSuccess ? undefined : stopReason,
      decision,
      missingFields,
    };
  }

  /**
   * Resume a decision from a specific layer (for HITL flows)
   */
  async resume(
    decisionId: string,
    userId: string,
    fromLayer: number = 4,
    additionalData?: Record<string, unknown>
  ): Promise<PipelineResult> {
    const decision = await coreviaStorage.getDecision(decisionId);
    if (!decision) {
      throw new Error(`Decision ${decisionId} not found`);
    }

    // If additional data provided, merge it with existing input
    if (additionalData) {
      const existingInput = decision.inputData || {};
      const mergedInput = { ...existingInput, ...additionalData };
      await coreviaStorage.updateDecision(decisionId, {
        inputData: mergedInput,
        normalizedInput: mergedInput,
      });
    }

    // Update status to resume processing
    await coreviaStorage.updateDecision(decisionId, {
      status: "context_check" as DecisionStatus,
      currentLayer: fromLayer,
    });

    // Re-fetch the updated decision
    const updatedDecision = await coreviaStorage.getDecision(decisionId);
    if (!updatedDecision) {
      throw new Error(`Decision ${decisionId} not found after update`);
    }

    // Re-run the pipeline from the specified layer
    const result = await this.execute(
      decision.serviceId,
      decision.routeKey,
      {
        ...updatedDecision.inputData,
        decisionSpineId: decisionId,
      },
      userId,
      updatedDecision.organizationId ?? undefined,
      { decisionSpineId: decisionId }
    );

    return result;
  }

  /**
   * GOVERNANCE: Decision-level auto-approval based on version status is DISABLED.
   * All decision approvals must go through explicit human governance review.
   * The spine sub-decision gates enforce the proper approval sequence:
  *   DEMAND_REQUEST → BUSINESS_CASE → REQUIREMENTS → ENTERPRISE_ARCHITECTURE → STRATEGIC_FIT → CONVERSION
   * Each gate requires explicit human approval (except DEMAND_REQUEST which is auto-approved).
   */
  private async tryAutoApproveIfBusinessCaseReady(_decision: DecisionObject): Promise<void> {
    // Disabled — governance requires explicit human approval.
    // The previous implementation auto-approved decisions when linked BC versions
    // were already approved, bypassing the HITL governance gate.
    return;
  }

  /**
   * Dispatch a single action by type and return the result payload.
   */
  private dispatchAction(
    actionType: string,
    decisionId: string,
    action: Record<string, unknown>
  ): unknown {
    switch (actionType) {
      case "convert_to_pipeline":
      case "pipeline_conversion": {
        return { converted: true, pipelineRef: `PL-${decisionId.substring(0, 8)}` };
      }
      case "create_project": {
        return { created: true, projectRef: `PRJ-${decisionId.substring(0, 8)}` };
      }
      case "create_wbs_baseline": {
        return { baseline: true, wbsRef: `WBS-${decisionId.substring(0, 8)}` };
      }
      case "push_backlog": {
        return { pushed: true, items: Array.isArray(action.items) ? action.items.length : 0 };
      }
      default: {
        return { executed: true, type: actionType };
      }
    }
  }

  /**
   * Execute a single approved action with idempotency and audit logging.
   */
  private async executeSingleAction(
    decisionId: string,
    approvalId: string,
    action: Record<string, unknown>,
    correlationId: string,
    approvedBy: string
  ): Promise<{ actionId: string; status: string; result?: unknown; error?: string }> {
    const actionId = (action.id || action.actionId || randomUUID()) as string;
    const actionType = (action.type || action.actionType || "unknown") as string;
    const idempotencyKey = `${decisionId}_${actionType}_${actionId}`;

    try {
      const existingExecution = await coreviaStorage.getExecution(idempotencyKey);
      if (existingExecution?.status === "SUCCEEDED") {
        logger.info(`[Corevia] Action ${actionId} already executed (idempotent skip)`);
        return { actionId, status: "already_executed", result: existingExecution.resultPayload };
      }

      await coreviaStorage.saveExecution({
        decisionId, approvalId, actionType, idempotencyKey,
        status: "RUNNING", requestPayload: action,
      });

      const actionResult = this.dispatchAction(actionType, decisionId, action);

      await coreviaStorage.saveExecution({
        decisionId, approvalId, actionType, idempotencyKey,
        status: "SUCCEEDED", requestPayload: action,
        resultPayload: actionResult as Record<string, unknown>,
      });

      await coreviaStorage.addAuditEvent(
        decisionId, correlationId, 8, "action_executed",
        { actionId, actionType, result: actionResult }, approvedBy
      );

      logger.info(`[Corevia] Action ${actionType} executed successfully`);
      return { actionId, status: "succeeded", result: actionResult };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      logger.error(`[Corevia] Action ${actionId} failed:`, errorMsg);

      await coreviaStorage.saveExecution({
        decisionId, approvalId, actionType, idempotencyKey,
        status: "FAILED", requestPayload: action, errorMessage: errorMsg,
      });

      return { actionId, status: "failed", error: errorMsg };
    }
  }

  /**
   * Execute post-approval actions (Controlled Execution Zone)
   *
   * INVARIANTS:
   * - Must have valid ApprovalID
   * - Each action is idempotent (idempotency key = decisionId + actionType)
   * - All executions are logged and rollback-capable
   * - Only approved actions from Layer 7 can execute
   */
  async executeActions(
    decisionId: string,
    approvalId: string
  ): Promise<{ success: boolean; results: Array<{ actionId: string; status: string; result?: unknown; error?: string }> }> {
    logger.info(`[Corevia] Executing approved actions for ${decisionId} (approval: ${approvalId})`);

    const decision = await coreviaStorage.getDecision(decisionId);
    if (!decision) {
      throw new Error(`Decision ${decisionId} not found`);
    }

    const approval = await coreviaStorage.getApproval(decisionId);
    if (approval?.status !== "approved") {
      throw new Error(`No valid approval found for decision ${decisionId}`);
    }

    const approvedActions: string[] = (approval.approvedActions as string[]) || [];
    const fullDecision = await coreviaStorage.getFullDecisionObject(decisionId);
    const advisoryData = fullDecision?.advisory as Record<string, unknown> | undefined;
    const advisoryActions = (advisoryData?.proposedActions || advisoryData?.actions || []) as Array<Record<string, unknown>>;

    const actionsToExecute = approvedActions.length > 0
      ? advisoryActions.filter((a: Record<string, unknown>) => approvedActions.includes((a.id || a.actionId) as string))
      : advisoryActions;

    if (actionsToExecute.length === 0) {
      logger.info(`[Corevia] No actions to execute for ${decisionId}`);
      await coreviaStorage.updateDecision(decisionId, { status: "completed" as DecisionStatus });
      await coreviaStorage.updateLedgerConclusion(decisionId, "COMPLETED");
      return { success: true, results: [] };
    }

    const correlationId = decision.correlationId || "";
    const approvedBy = (approval.approvedBy as string) || "system";
    const results: Array<{ actionId: string; status: string; result?: unknown; error?: string }> = [];

    for (const action of actionsToExecute) {
      const result = await this.executeSingleAction(decisionId, approvalId, action, correlationId, approvedBy);
      results.push(result);
    }

    const allSucceeded = results.every(r => r.status === "succeeded" || r.status === "already_executed");
    const finalStatus = allSucceeded ? "completed" : "action_execution";

    await coreviaStorage.updateDecision(decisionId, { status: finalStatus as DecisionStatus });
    if (allSucceeded) {
      await coreviaStorage.updateLedgerConclusion(decisionId, "COMPLETED");
      await coreviaStorage.saveDecisionOutcome({
        decisionId,
        outcomeStatus: "completed",
        lessonsLearned: `${results.length} actions executed successfully`,
        recordedBy: approvedBy,
      });
    }

    logger.info(`[Corevia] Execution complete: ${results.filter(r => r.status === "succeeded").length}/${results.length} succeeded`);
    return { success: allSucceeded, results };
  }
}

// Singleton instance
export const coreviaOrchestrator = new CoreviaOrchestrator();
