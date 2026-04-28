import { logger } from "../../platform/observability";
import { CoreviaStorage } from "../storage";

export type SpineState =
  | "CREATED"
  | "IN_PROGRESS"
  | "NEEDS_REVISION"
  | "READY_FOR_STRATEGIC_FIT"
  | "READY_FOR_CONVERSION"
  | "READY_FOR_CONCLUSION"
  | "CONCLUDED"
  | "COMPLETED"
  | "CANCELLED";

export type SpineEvent =
  | "DEMAND_SUBMITTED"
  | "SUBDECISION_APPROVED"
  | "SUBDECISION_REJECTED"
  | "SUBDECISION_RESUBMITTED"
  | "SF_APPROVED"
  | "SF_REJECTED"
  | "CONVERSION_APPROVED"
  | "EXECUTION_SUCCEEDED"
  | "SPINE_CANCELLED"
  | "OUTCOME_RECORDED"
  | "CLOSURE_INITIATED"
  | "CLOSURE_SUBDECISION_APPROVED"
  | "CLOSURE_SUBDECISION_REJECTED"
  | "CLOSURE_CONCLUDED";

export type DecisionPhase = "DEMAND" | "CLOSURE";

export type JourneyStatus = "DEMAND_PHASE" | "PROJECT_ACTIVE" | "CLOSURE_PHASE" | "COMPLETED" | "CANCELLED";

export type SubDecisionState = "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "SUPERSEDED";
export type SubDecisionEvent = "SUBMIT_FOR_REVIEW" | "APPROVE" | "REVISE" | "REJECT" | "EDIT_NEW_VERSION";

const REQUIRED_FOR_STRATEGIC_FIT = ["BUSINESS_CASE", "REQUIREMENTS"] as const;
const REQUIRED_FOR_CONCLUSION = ["BUSINESS_CASE", "REQUIREMENTS", "STRATEGIC_FIT"] as const;
const PROJECT_LIFECYCLE_TYPES = ["WBS", "PLAN", "WBS_BASELINE"] as const;
const CONVERSION_ACTION_TYPES = ["conversion", "pipeline_conversion", "convert_to_pipeline", "create_project"] as const;

// Closure phase sub-decision types
const REQUIRED_FOR_CLOSURE = ["CLOSURE_REPORT", "LESSONS_LEARNED"] as const;

const SUB_DECISION_TYPES = {
  // Demand Phase
  DEMAND_REQUEST: "DEMAND_REQUEST",
  BUSINESS_CASE: "BUSINESS_CASE",
  REQUIREMENTS: "REQUIREMENTS",
  MARKET_RESEARCH: "MARKET_RESEARCH",
  STRATEGIC_FIT: "STRATEGIC_FIT",
  CONVERSION: "CONVERSION",
  WBS: "WBS",
  PLAN: "PLAN",
  WBS_BASELINE: "WBS_BASELINE",
  // Closure Phase
  CLOSURE_REPORT: "CLOSURE_REPORT",
  LESSONS_LEARNED: "LESSONS_LEARNED",
  FINAL_ASSESSMENT: "FINAL_ASSESSMENT",
} as const;

/** Minimal shape for a decision spine row returned from storage. */
interface SpineRow {
  decisionSpineId: string;
  status: string;
  journeyId?: string | null;
  decisionPhase?: string | null;
  title?: string | null;
  [key: string]: unknown;
}

/** Minimal shape for a sub-decision row returned from storage. */
interface SubDecisionRow {
  subDecisionId: string;
  decisionSpineId: string;
  subDecisionType: string;
  artifactId: string;
  status: string;
  [key: string]: unknown;
}

/** Minimal shape for a decision artifact row returned from storage. */
interface ArtifactRow {
  artifactId: string;
  [key: string]: unknown;
}

/** Minimal shape for a journey row returned from storage. */
interface JourneyRow {
  journeyId: string;
  demandSpineId?: string | null;
  closureSpineId?: string | null;
  status: string;
  title?: string | null;
  [key: string]: unknown;
}

export class SpineOrchestrator {
  constructor(private readonly storage: CoreviaStorage) {}

  private toPayload(payload?: Record<string, unknown> | null): Record<string, unknown> {
    return payload ?? {};
  }

  private mergePayload(
    payload: Record<string, unknown> | null | undefined,
    extra: Record<string, unknown>,
  ): Record<string, unknown> {
    return { ...this.toPayload(payload), ...extra };
  }

  private toOptionalString(value: unknown): string {
    return typeof value === "string" ? value : "";
  }

  private async handleCreatedSpineEvent(
    spine: SpineRow,
    params: {
      decisionSpineId: string;
      event: SpineEvent;
      actorId?: string;
      payload?: Record<string, unknown> | null;
    },
  ): Promise<{ state: SpineState; changed: boolean } | null> {
    if (params.event === "DEMAND_SUBMITTED") {
      await this.storage.updateSpineStatus(spine.decisionSpineId, "IN_PROGRESS");
      await this.ensureInitialSubDecisions(spine.decisionSpineId, params.actorId);
      await this.autoApproveDemandRequest(spine.decisionSpineId, params.actorId);
      await this.storage.addSpineEvent(spine.decisionSpineId, params.event, params.actorId, this.toPayload(params.payload));
      return { state: "IN_PROGRESS", changed: true };
    }

    const autoAdvanceEvents: SpineEvent[] = [
      "SUBDECISION_APPROVED",
      "SUBDECISION_REJECTED",
      "SUBDECISION_RESUBMITTED",
      "SF_APPROVED",
      "SF_REJECTED",
    ];
    if (!autoAdvanceEvents.includes(params.event)) return null;

    await this.storage.updateSpineStatus(spine.decisionSpineId, "IN_PROGRESS");
    await this.ensureInitialSubDecisions(spine.decisionSpineId, params.actorId);
    await this.storage.addSpineEvent(spine.decisionSpineId, "DEMAND_SUBMITTED", params.actorId, {
      autoTransition: true,
      reason: "Auto-advanced from CREATED on sub-decision event",
    });
    return this.handleSpineEvent(params);
  }

  private async handleInProgressSpineEvent(
    spine: SpineRow,
    params: { event: SpineEvent; actorId?: string; payload?: Record<string, unknown> | null },
  ): Promise<{ state: SpineState; changed: boolean } | null> {
    if (params.event === "SUBDECISION_REJECTED") {
      await this.storage.updateSpineStatus(spine.decisionSpineId, "NEEDS_REVISION");
      await this.storage.addSpineEvent(spine.decisionSpineId, params.event, params.actorId, this.toPayload(params.payload));
      return { state: "NEEDS_REVISION", changed: true };
    }

    if (params.event !== "SUBDECISION_APPROVED") return null;
    const ready = await this.isReadyForStrategicFit(spine.decisionSpineId);
    if (!ready) return null;

    await this.storage.updateSpineStatus(spine.decisionSpineId, "READY_FOR_STRATEGIC_FIT");
    await this.ensureSubDecision(spine.decisionSpineId, SUB_DECISION_TYPES.STRATEGIC_FIT, params.actorId);
    await this.storage.addSpineEvent(spine.decisionSpineId, params.event, params.actorId, this.toPayload(params.payload));
    return { state: "READY_FOR_STRATEGIC_FIT", changed: true };
  }

  private async handleReadyForStrategicFitEvent(
    spine: SpineRow,
    params: { event: SpineEvent; actorId?: string; payload?: Record<string, unknown> | null },
  ): Promise<{ state: SpineState; changed: boolean } | null> {
    if (params.event === "SF_APPROVED") {
      await this.storage.updateSpineStatus(spine.decisionSpineId, "READY_FOR_CONVERSION");
      await this.ensureSubDecision(spine.decisionSpineId, SUB_DECISION_TYPES.CONVERSION, params.actorId);
      await this.storage.addSpineEvent(spine.decisionSpineId, params.event, params.actorId, this.toPayload(params.payload));
      return { state: "READY_FOR_CONVERSION", changed: true };
    }

    if (params.event !== "SF_REJECTED") return null;
    await this.storage.updateSpineStatus(spine.decisionSpineId, "NEEDS_REVISION");
    await this.storage.addSpineEvent(spine.decisionSpineId, params.event, params.actorId, this.toPayload(params.payload));
    return { state: "NEEDS_REVISION", changed: true };
  }

  private async handleConversionApproved(
    spine: SpineRow,
    actorId?: string,
    payload?: Record<string, unknown> | null,
  ): Promise<{ state: SpineState; changed: boolean }> {
    const currentState = spine.status as SpineState;
    const conversionApproved = await this.storage.isSubDecisionApproved(spine.decisionSpineId, SUB_DECISION_TYPES.CONVERSION);
    if (!conversionApproved) {
      await this.storage.addSpineEvent(spine.decisionSpineId, "CONVERSION_APPROVED", actorId, this.mergePayload(payload, {
        reason: "conversion_subdecision_not_approved",
      }));
      return { state: currentState, changed: false };
    }

    const requestedApprovalId = this.toOptionalString(payload?.approvalId);
    if (!requestedApprovalId) {
      await this.storage.addSpineEvent(spine.decisionSpineId, "CONVERSION_APPROVED", actorId, this.mergePayload(payload, {
        reason: "missing_approval_id",
      }));
      return { state: currentState, changed: false };
    }

    const approval = await this.storage.getApprovalByApprovalId(requestedApprovalId);
    const approvalStatus = this.toOptionalString(approval?.status);
    if (!approval || approvalStatus !== "approved") {
      await this.storage.addSpineEvent(spine.decisionSpineId, "CONVERSION_APPROVED", actorId, this.mergePayload(payload, {
        approvalId: requestedApprovalId,
        reason: "approval_not_approved",
        approvalStatus: approvalStatus || null,
      }));
      return { state: currentState, changed: false };
    }

    try {
      await this.storage.createExecutionJob({
        decisionSpineId: spine.decisionSpineId,
        approvalId: requestedApprovalId,
        actionType: "conversion",
        idempotencyKey: `conversion-${spine.decisionSpineId}`,
        requestPayload: this.toPayload(payload),
      });
    } catch (err) {
      await this.storage.addSpineEvent(spine.decisionSpineId, "CONVERSION_APPROVED", actorId, this.mergePayload(payload, {
        approvalId: requestedApprovalId,
        reason: "execution_job_creation_failed",
        error: err instanceof Error ? err.message : String(err),
      }));
      return { state: currentState, changed: false };
    }

    await this.storage.addSpineEvent(spine.decisionSpineId, "CONVERSION_APPROVED", actorId, this.toPayload(payload));
    return { state: "READY_FOR_CONVERSION", changed: false };
  }

  private async handleExecutionSucceeded(
    spine: SpineRow,
    actorId?: string,
    payload?: Record<string, unknown> | null,
  ): Promise<{ state: SpineState; changed: boolean }> {
    const currentState = spine.status as SpineState;
    const eventPayload = this.toPayload(payload);
    const latestApproval = await this.storage.getLatestApprovalForSubDecisionType(spine.decisionSpineId, SUB_DECISION_TYPES.CONVERSION);
    const approvalId = this.toOptionalString(eventPayload.approvalId) || latestApproval?.approvalId || "";
    const actionType = this.toOptionalString(eventPayload.actionType) || "conversion";
    const idempotencyKey = this.toOptionalString(eventPayload.idempotencyKey) || `conversion-${spine.decisionSpineId}`;

    if (approvalId) {
      await this.storage.saveExecution({
        decisionId: spine.decisionSpineId,
        approvalId,
        actionType,
        idempotencyKey,
        status: "SUCCEEDED",
        resultPayload: eventPayload.result as Record<string, unknown> | undefined,
      });
    }

    const gateStatus = await this.getGateCStatus(spine.decisionSpineId);
    if (!gateStatus.ready) {
      await this.storage.addSpineEvent(spine.decisionSpineId, "EXECUTION_SUCCEEDED", actorId, {
        ...eventPayload,
        gateStatus,
      });
      return { state: currentState, changed: false };
    }

    const projectRef = this.extractProjectRef(eventPayload) || await this.storage.getProjectRefForDecision(spine.decisionSpineId);
    if (projectRef) {
      await this.storage.updateLedgerProjectRef(spine.decisionSpineId, projectRef);
    }

    await this.storage.updateSpineStatus(spine.decisionSpineId, "CONCLUDED");
    await this.storage.ensureLedgerConclusion(spine.decisionSpineId, "APPROVED_TO_EXECUTE");
    await this.storage.addSpineEvent(spine.decisionSpineId, "EXECUTION_SUCCEEDED", actorId, eventPayload);
    return { state: "CONCLUDED", changed: true };
  }

  private async handleReadyForConversionEvent(
    spine: SpineRow,
    params: { event: SpineEvent; actorId?: string; payload?: Record<string, unknown> | null },
  ): Promise<{ state: SpineState; changed: boolean } | null> {
    if (params.event === "CONVERSION_APPROVED") {
      return this.handleConversionApproved(spine, params.actorId, params.payload);
    }
    if (params.event === "EXECUTION_SUCCEEDED") {
      return this.handleExecutionSucceeded(spine, params.actorId, params.payload);
    }
    return null;
  }

  private async handleDraftSubDecisionEvent(
    subDecision: SubDecisionRow,
    params: { event: SubDecisionEvent; actorId?: string; payload?: Record<string, unknown> | null },
  ): Promise<{ state: SubDecisionState; changed: boolean; subDecisionId?: string } | null> {
    if (params.event === "SUBMIT_FOR_REVIEW") {
      await this.storage.updateSubDecisionStatus(subDecision.subDecisionId, "IN_REVIEW");
      await this.storage.addSpineEvent(subDecision.decisionSpineId, "SUBDECISION_RESUBMITTED", params.actorId, {
        subDecisionId: subDecision.subDecisionId,
        subDecisionType: subDecision.subDecisionType,
      });
      return { state: "IN_REVIEW", changed: true };
    }

    if (params.event === "APPROVE") {
      await this.storage.updateSubDecisionStatus(subDecision.subDecisionId, "IN_REVIEW");
      await this.storage.addSpineEvent(subDecision.decisionSpineId, "SUBDECISION_RESUBMITTED", params.actorId, {
        subDecisionId: subDecision.subDecisionId,
        subDecisionType: subDecision.subDecisionType,
        autoTransition: true,
      });
      const approvalId = `APR-${subDecision.subDecisionId.slice(0, 8)}-${Date.now().toString(36)}`;
      const artifactVersionId = await this.storage.getLatestArtifactVersionId(subDecision.artifactId);
      await this.storage.createSubDecisionApproval({
        approvalId,
        decisionSpineId: subDecision.decisionSpineId,
        subDecisionId: subDecision.subDecisionId,
        artifactId: subDecision.artifactId,
        artifactVersionId,
        approvedBy: params.actorId,
      });
      await this.storage.updateSubDecisionStatus(subDecision.subDecisionId, "APPROVED");
      await this.storage.updateDecisionArtifactStatus(subDecision.artifactId, "APPROVED");
      await this.emitSpineEventForSubDecision(subDecision, "approved", params.actorId);
      return { state: "APPROVED", changed: true };
    }

    if (params.event !== "REJECT") return null;
    await this.storage.updateSubDecisionStatus(subDecision.subDecisionId, "REJECTED");
    await this.storage.updateDecisionArtifactStatus(subDecision.artifactId, "REJECTED");
    await this.emitSpineEventForSubDecision(subDecision, "rejected", params.actorId);
    return { state: "REJECTED", changed: true };
  }

  private async handleInReviewSubDecisionEvent(
    subDecision: SubDecisionRow,
    params: { event: SubDecisionEvent; actorId?: string; payload?: Record<string, unknown> | null },
  ): Promise<{ state: SubDecisionState; changed: boolean; subDecisionId?: string } | null> {
    if (params.event === "APPROVE") {
      const approvalId = `APR-${subDecision.subDecisionId.slice(0, 8)}-${Date.now().toString(36)}`;
      const artifactVersionId = await this.storage.getLatestArtifactVersionId(subDecision.artifactId);
      await this.storage.createSubDecisionApproval({
        approvalId,
        decisionSpineId: subDecision.decisionSpineId,
        subDecisionId: subDecision.subDecisionId,
        artifactId: subDecision.artifactId,
        artifactVersionId,
        approvedBy: params.actorId,
      });
      await this.storage.updateSubDecisionStatus(subDecision.subDecisionId, "APPROVED");
      await this.storage.updateDecisionArtifactStatus(subDecision.artifactId, "APPROVED");
      await this.emitSpineEventForSubDecision(subDecision, "approved", params.actorId);
      return { state: "APPROVED", changed: true };
    }

    if (params.event === "REVISE") {
      await this.storage.updateSubDecisionStatus(subDecision.subDecisionId, "DRAFT");
      await this.storage.updateDecisionArtifactStatus(subDecision.artifactId, "DRAFT");
      return { state: "DRAFT", changed: true };
    }

    if (params.event !== "REJECT") return null;
    await this.storage.updateSubDecisionStatus(subDecision.subDecisionId, "REJECTED");
    await this.storage.updateDecisionArtifactStatus(subDecision.artifactId, "REJECTED");
    await this.emitSpineEventForSubDecision(subDecision, "rejected", params.actorId);
    return { state: "REJECTED", changed: true };
  }

  private async handleApprovedSubDecisionEvent(
    subDecision: SubDecisionRow,
    params: { event: SubDecisionEvent; actorId?: string; payload?: Record<string, unknown> | null },
  ): Promise<{ state: SubDecisionState; changed: boolean; subDecisionId?: string } | null> {
    if (params.event !== "EDIT_NEW_VERSION") return null;

    await this.storage.updateSubDecisionStatus(subDecision.subDecisionId, "SUPERSEDED");
    await this.storage.updateDecisionArtifactStatus(subDecision.artifactId, "DRAFT");
    const content = (params.payload?.content || {}) as Record<string, unknown>;
    const changeSummary = this.toOptionalString(params.payload?.changeSummary) || "New version";
    await this.storage.createDecisionArtifactVersion({
      artifactId: subDecision.artifactId,
      content,
      changeSummary,
      createdBy: params.actorId,
    });

    const next = await this.storage.createSubDecision({
      decisionSpineId: subDecision.decisionSpineId,
      subDecisionType: subDecision.subDecisionType,
      artifactId: subDecision.artifactId,
      status: "DRAFT",
      createdBy: params.actorId,
    });

    return { state: "DRAFT", changed: true, subDecisionId: next.subDecisionId };
  }

  async handleSpineEvent(params: {
    decisionSpineId: string;
    event: SpineEvent;
    actorId?: string;
    payload?: Record<string, unknown> | null;
  }): Promise<{ state: SpineState; changed: boolean }> {
    const spine = await this.storage.getSpine(params.decisionSpineId) as SpineRow | null;
    if (!spine) {
      throw new Error("Decision spine not found");
    }

    const currentState = spine.status as SpineState;
    const event = params.event;

    if (event === "SPINE_CANCELLED" && currentState !== "CONCLUDED") {
      await this.storage.updateSpineStatus(spine.decisionSpineId, "CANCELLED");
      await this.storage.addSpineEvent(spine.decisionSpineId, event, params.actorId, this.toPayload(params.payload));
      return { state: "CANCELLED", changed: true };
    }

    switch (currentState) {
      case "CREATED":
        return (await this.handleCreatedSpineEvent(spine, params)) || { state: currentState, changed: false };
      case "IN_PROGRESS":
        return (await this.handleInProgressSpineEvent(spine, params)) || { state: currentState, changed: false };

      case "NEEDS_REVISION":
        if (event === "SUBDECISION_RESUBMITTED") {
          await this.storage.updateSpineStatus(spine.decisionSpineId, "IN_PROGRESS");
          await this.storage.addSpineEvent(spine.decisionSpineId, event, params.actorId, this.toPayload(params.payload));
          return { state: "IN_PROGRESS", changed: true };
        }
        break;

      case "READY_FOR_STRATEGIC_FIT":
        return (await this.handleReadyForStrategicFitEvent(spine, params)) || { state: currentState, changed: false };

      case "READY_FOR_CONVERSION":
        return (await this.handleReadyForConversionEvent(spine, params)) || { state: currentState, changed: false };

      case "CONCLUDED":
        if (event === "OUTCOME_RECORDED") {
          await this.storage.updateSpineStatus(spine.decisionSpineId, "COMPLETED");
          await this.storage.ensureLedgerConclusion(spine.decisionSpineId, "COMPLETED");
          await this.storage.addSpineEvent(spine.decisionSpineId, event, params.actorId, this.toPayload(params.payload));
          return { state: "COMPLETED", changed: true };
        }
        break;

      default:
        break;
    }

    await this.storage.addSpineEvent(spine.decisionSpineId, event, params.actorId, this.toPayload(params.payload));
    return { state: currentState, changed: false };
  }

  async handleSubDecisionEvent(params: {
    subDecisionId: string;
    event: SubDecisionEvent;
    actorId?: string;
    payload?: Record<string, unknown> | null;
  }): Promise<{ state: SubDecisionState; changed: boolean; subDecisionId?: string }> {
    const subDecision = await this.storage.getSubDecision(params.subDecisionId) as SubDecisionRow | null;
    if (!subDecision) {
      throw new Error("Sub-decision not found");
    }

    const currentState = subDecision.status as SubDecisionState;
    const event = params.event;

    if (event === "SUBMIT_FOR_REVIEW" && (PROJECT_LIFECYCLE_TYPES as readonly string[]).includes(subDecision.subDecisionType)) {
      const allowed = await this.storage.canStartProjectWork(subDecision.decisionSpineId);
      if (!allowed) {
        await this.storage.addSpineEvent(subDecision.decisionSpineId, "PROJECT_WORK_BLOCKED", params.actorId, {
          subDecisionId: subDecision.subDecisionId,
          subDecisionType: subDecision.subDecisionType,
          reason: "ledger_or_project_ref_missing",
        });
        return { state: currentState, changed: false };
      }
    }

    switch (currentState) {
      case "DRAFT":
        return (await this.handleDraftSubDecisionEvent(subDecision, params)) || { state: currentState, changed: false };
      case "IN_REVIEW":
        return (await this.handleInReviewSubDecisionEvent(subDecision, params)) || { state: currentState, changed: false };
      case "APPROVED":
        return (await this.handleApprovedSubDecisionEvent(subDecision, params)) || { state: currentState, changed: false };
      default:
        return { state: currentState, changed: false };
    }
  }

  private async emitSpineEventForSubDecision(
    subDecision: { decisionSpineId: string; subDecisionType: string; artifactId?: string },
    outcome: "approved" | "rejected",
    actorId?: string,
  ): Promise<void> {
    // Determine if this is a closure-phase sub-decision
    const closureTypes: readonly string[] = [SUB_DECISION_TYPES.CLOSURE_REPORT, SUB_DECISION_TYPES.LESSONS_LEARNED, SUB_DECISION_TYPES.FINAL_ASSESSMENT];
    const isClosure = closureTypes.includes(subDecision.subDecisionType);

    if (subDecision.subDecisionType === SUB_DECISION_TYPES.STRATEGIC_FIT) {
      await this.handleSpineEvent({
        decisionSpineId: subDecision.decisionSpineId,
        event: outcome === "approved" ? "SF_APPROVED" : "SF_REJECTED",
        actorId,
      });
      return;
    }

    if (isClosure) {
      // Closure sub-decisions route through handleClosureEvent
      await this.handleClosureEvent({
        closureSpineId: subDecision.decisionSpineId,
        event: outcome === "approved" ? "CLOSURE_SUBDECISION_APPROVED" : "CLOSURE_SUBDECISION_REJECTED",
        actorId,
        payload: { subDecisionType: subDecision.subDecisionType },
      });
    } else {
      await this.handleSpineEvent({
        decisionSpineId: subDecision.decisionSpineId,
        event: outcome === "approved" ? "SUBDECISION_APPROVED" : "SUBDECISION_REJECTED",
        actorId,
      });
    }

    // ── Learning Trigger ──────────────────────────────────────────────
    // When ANY sub-decision is APPROVED, create a learning asset (DRAFT)
    // linked to the journey. This is the Engine A feed mechanism.
    if (outcome === "approved") {
      await this.triggerLearningAssetCreation(subDecision, actorId);
    }
  }

  /**
   * Engine A Learning Trigger:
   * When a sub-decision artifact is approved, create a DRAFT learning asset
   * tagged with the journey + phase. Human activation required before Engine A consumes it.
   */
  private async triggerLearningAssetCreation(
    subDecision: { decisionSpineId: string; subDecisionType: string; artifactId?: string },
    actorId?: string,
  ): Promise<void> {
    try {
      const spine = await this.storage.getSpine(subDecision.decisionSpineId) as SpineRow | null;
      if (!spine) return;

      const journeyId = spine.journeyId || null;
      const decisionPhase = spine.decisionPhase || "DEMAND";
      const artifactId = subDecision.artifactId || null;
      const artifactVersionId = artifactId
        ? await this.storage.getLatestArtifactVersionId(artifactId)
        : null;

      await this.storage.createLearningAssetFromArtifact({
        decisionSpineId: subDecision.decisionSpineId,
        subDecisionType: subDecision.subDecisionType,
        journeyId,
        decisionPhase,
        sourceArtifactId: artifactId,
        sourceArtifactVersion: artifactVersionId,
        actorId,
      });

      // Increment journey's learning asset count
      if (journeyId) {
        await this.storage.incrementJourneyLearningCount(journeyId);
      }

      await this.storage.addSpineEvent(subDecision.decisionSpineId, "LEARNING_ASSET_CREATED", actorId, {
        subDecisionType: subDecision.subDecisionType,
        journeyId,
        decisionPhase,
        sourceArtifactId: artifactId,
        sourceArtifactVersion: artifactVersionId,
      });
    } catch (err) {
      // Learning trigger should never block the approval flow
      logger.warn("[SpineOrchestrator] Learning trigger failed (non-blocking):", err);
    }
  }

  /**
   * Auto-approve the DEMAND_REQUEST sub-decision.
   * The demand info is the user's own submission — acknowledging it IS the approval.
   * This prevents DEMAND_REQUEST from being stuck in DRAFT forever.
   */
  private async autoApproveDemandRequest(decisionSpineId: string, actorId?: string): Promise<void> {
    try {
      const subDecision = await this.storage.findSubDecision(
        decisionSpineId,
        SUB_DECISION_TYPES.DEMAND_REQUEST,
      ) as SubDecisionRow | null;
      if (!subDecision || subDecision.status === "APPROVED") return;

      const approvalId = `APR-${subDecision.subDecisionId.slice(0, 8)}-${Date.now().toString(36)}`;
      const artifactVersionId = await this.storage.getLatestArtifactVersionId(subDecision.artifactId);

      await this.storage.createSubDecisionApproval({
        approvalId,
        decisionSpineId,
        subDecisionId: subDecision.subDecisionId,
        artifactId: subDecision.artifactId,
        artifactVersionId,
        approvedBy: actorId,
      });

      await this.storage.updateSubDecisionStatus(subDecision.subDecisionId, "APPROVED");
      if (subDecision.artifactId) {
        await this.storage.updateDecisionArtifactStatus(subDecision.artifactId, "APPROVED");
      }
    } catch (err) {
      logger.warn("[SpineOrchestrator] Auto-approve DEMAND_REQUEST failed (non-blocking):", err);
    }
  }

  private async ensureInitialSubDecisions(decisionSpineId: string, actorId?: string): Promise<void> {
    await this.ensureSubDecision(decisionSpineId, SUB_DECISION_TYPES.DEMAND_REQUEST, actorId);
    await this.ensureSubDecision(decisionSpineId, SUB_DECISION_TYPES.BUSINESS_CASE, actorId);
    await this.ensureSubDecision(decisionSpineId, SUB_DECISION_TYPES.REQUIREMENTS, actorId);
  }

  private async ensureSubDecision(decisionSpineId: string, subDecisionType: string, actorId?: string): Promise<void> {
    const existing = await this.storage.findSubDecision(decisionSpineId, subDecisionType);
    if (existing) return;

    const artifact = await this.storage.createDecisionArtifact({
      decisionSpineId,
      artifactType: subDecisionType,
      createdBy: actorId,
    }) as ArtifactRow;

    await this.storage.createDecisionArtifactVersion({
      artifactId: artifact.artifactId,
      content: {},
      changeSummary: "Initial draft",
      createdBy: actorId,
    });

    await this.storage.createSubDecision({
      decisionSpineId,
      subDecisionType,
      artifactId: artifact.artifactId,
      status: "DRAFT",
      createdBy: actorId,
    });
  }

  private async isReadyForStrategicFit(decisionSpineId: string): Promise<boolean> {
    const subDecisions = await this.storage.listSubDecisions(decisionSpineId) as SubDecisionRow[];
    if (subDecisions.length === 0) return false;

    return REQUIRED_FOR_STRATEGIC_FIT.every(requiredType =>
      subDecisions.some((sd: Record<string, unknown>) => sd.subDecisionType === requiredType && sd.status === "APPROVED")
    );
  }

  private async getGateCStatus(decisionSpineId: string): Promise<{ ready: boolean; details: Record<string, boolean> }>{
    const requiredApproved = await this.storage.areSubDecisionsApproved(
      decisionSpineId,
      [...REQUIRED_FOR_CONCLUSION],
    );
    const conversionApproved = await this.storage.isSubDecisionApproved(
      decisionSpineId,
      SUB_DECISION_TYPES.CONVERSION,
    );
    const executionSucceeded = await this.storage.hasSucceededExecution(
      decisionSpineId,
      [...CONVERSION_ACTION_TYPES],
    );

    const details = {
      requiredApproved,
      conversionApproved,
      executionSucceeded,
    };

    return { ready: requiredApproved && conversionApproved && executionSucceeded, details };
  }

  private extractProjectRef(payload: Record<string, unknown>): Record<string, unknown> | null {
    if (payload.projectRef || payload.projectId || payload.project) {
      return {
        projectRef: payload.projectRef,
        projectId: payload.projectId,
        project: payload.project,
      };
    }
    const result = payload.result as Record<string, unknown> | undefined;
    if (result && (result.projectRef || result.projectId || result.project)) {
      return {
        projectRef: result.projectRef,
        projectId: result.projectId,
        project: result.project,
      };
    }
    return null;
  }

  // ============================================================================
  // JOURNEY MANAGEMENT — Links Demand Decision + Closure Decision
  // ============================================================================

  /**
   * Create a new Journey (the IDEA origin).
   * Called when a demand creates its first Decision Spine.
   * Returns the journeyId for linking.
   */
  async createJourney(params: {
    title: string;
    sourceEntityId?: string;
    demandSpineId: string;
    createdBy?: string;
  }): Promise<{ journeyId: string }> {
    const journeyId = `JRN-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    await this.storage.createJourney({
      journeyId,
      title: params.title,
      sourceEntityId: params.sourceEntityId,
      demandSpineId: params.demandSpineId,
      status: "DEMAND_PHASE",
      createdBy: params.createdBy,
    });
    // Link the demand spine to this journey
    await this.storage.updateSpineJourney(params.demandSpineId, journeyId, "DEMAND");
    await this.storage.addSpineEvent(params.demandSpineId, "JOURNEY_CREATED", params.createdBy, {
      journeyId,
      title: params.title,
      phase: "DEMAND",
    });
    return { journeyId };
  }

  /**
   * Transition journey to PROJECT_ACTIVE when demand is converted.
   * Called after Gate C of the demand spine passes.
   */
  async activateProject(params: {
    journeyId: string;
    projectRef: Record<string, unknown>;
    actorId?: string;
  }): Promise<void> {
    await this.storage.updateJourneyStatus(params.journeyId, "PROJECT_ACTIVE", params.projectRef);
  }

  /**
   * Initiate the Closure Phase — creates Decision 2 (Closure Spine).
   * Called by PMO when the project is closing.
   */
  async initiateClosurePhase(params: {
    journeyId: string;
    title?: string;
    actorId?: string;
    closureData?: Record<string, unknown>;
  }): Promise<{ closureSpineId: string }> {
    const journey = await this.storage.getJourney(params.journeyId);
    if (!journey) {
      throw new Error(`Journey ${params.journeyId} not found`);
    }

    const jStatus = this.toOptionalString(journey.status);
    if (jStatus !== "PROJECT_ACTIVE" && jStatus !== "DEMAND_PHASE") {
      throw new Error(`Journey ${params.journeyId} is in state ${jStatus} — cannot initiate closure`);
    }

    // Create the closure spine (Decision 2)
    const closureSpineId = `SPX-CLOSURE-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    const journeyTitle = this.toOptionalString(journey.title) || "Project";
    const closureTitle = params.title || `Closure: ${journeyTitle}`;

    await this.storage.createSpine({
      decisionSpineId: closureSpineId,
      journeyId: params.journeyId,
      decisionPhase: "CLOSURE",
      title: closureTitle,
      createdBy: params.actorId,
      status: "CREATED",
    });

    // Link closure spine to journey
    await this.storage.updateJourneyClosure(params.journeyId, closureSpineId);
    await this.storage.updateJourneyStatus(params.journeyId, "CLOSURE_PHASE");

    // Create initial closure sub-decisions
    await this.ensureSubDecision(closureSpineId, SUB_DECISION_TYPES.CLOSURE_REPORT, params.actorId);
    await this.ensureSubDecision(closureSpineId, SUB_DECISION_TYPES.LESSONS_LEARNED, params.actorId);
    await this.ensureSubDecision(closureSpineId, SUB_DECISION_TYPES.FINAL_ASSESSMENT, params.actorId);

    // Transition closure spine to IN_PROGRESS
    await this.storage.updateSpineStatus(closureSpineId, "IN_PROGRESS");
    await this.storage.addSpineEvent(closureSpineId, "CLOSURE_INITIATED", params.actorId, {
      journeyId: params.journeyId,
      closureData: params.closureData || {},
    });

    return { closureSpineId };
  }

  /**
   * Handle closure spine events.
   * When all required closure sub-decisions are APPROVED → CONCLUDED.
   * Then journey transitions to COMPLETED.
   */
  async handleClosureEvent(params: {
    closureSpineId: string;
    event: "CLOSURE_SUBDECISION_APPROVED" | "CLOSURE_SUBDECISION_REJECTED" | "CLOSURE_CONCLUDED";
    actorId?: string;
    payload?: Record<string, unknown> | null;
  }): Promise<{ state: SpineState; journeyCompleted: boolean }> {
    const spine = await this.storage.getSpine(params.closureSpineId) as SpineRow | null;
    if (!spine) {
      throw new Error("Closure spine not found");
    }
    if (String(spine.decisionPhase) !== "CLOSURE") {
      throw new Error("Spine is not a closure-phase spine");
    }

    const currentState = spine.status as SpineState;
    let journeyCompleted = false;

    if (params.event === "CLOSURE_SUBDECISION_REJECTED") {
      await this.storage.updateSpineStatus(params.closureSpineId, "NEEDS_REVISION");
      await this.storage.addSpineEvent(params.closureSpineId, params.event, params.actorId, params.payload || {});
      return { state: "NEEDS_REVISION", journeyCompleted: false };
    }

    if (params.event === "CLOSURE_SUBDECISION_APPROVED") {
      // Check if all required closure sub-decisions are approved
      const ready = await this.isClosureReady(params.closureSpineId);
      if (ready) {
        await this.storage.updateSpineStatus(params.closureSpineId, "CONCLUDED");
        await this.storage.ensureLedgerConclusion(params.closureSpineId, "COMPLETED");
        await this.storage.addSpineEvent(params.closureSpineId, "CLOSURE_CONCLUDED", params.actorId, params.payload || {});

        // Transition journey to COMPLETED
        if (spine.journeyId) {
          await this.storage.updateJourneyStatus(spine.journeyId, "COMPLETED");
          journeyCompleted = true;
        }

        return { state: "CONCLUDED", journeyCompleted };
      }

      await this.storage.addSpineEvent(params.closureSpineId, params.event, params.actorId, params.payload || {});
      return { state: currentState, journeyCompleted: false };
    }

    return { state: currentState, journeyCompleted: false };
  }

  /**
   * Check if all required closure sub-decisions are approved.
   */
  private async isClosureReady(closureSpineId: string): Promise<boolean> {
    const subDecisions = await this.storage.listSubDecisions(closureSpineId) as SubDecisionRow[];
    if (subDecisions.length === 0) return false;

    return REQUIRED_FOR_CLOSURE.every(requiredType =>
      subDecisions.some((sd: Record<string, unknown>) => sd.subDecisionType === requiredType && sd.status === "APPROVED")
    );
  }

  /**
   * Get the full journey tree with both spines, sub-decisions, and learning assets.
   */
  async getJourneyTree(journeyId: string): Promise<{
    journey: Record<string, unknown>;
    demandSpine: Record<string, unknown> | null;
    closureSpine: Record<string, unknown> | null;
    demandSubDecisions: Record<string, unknown>[];
    closureSubDecisions: Record<string, unknown>[];
    learningAssets: Record<string, unknown>[];
  }> {
    const journey = await this.storage.getJourney(journeyId) as JourneyRow | null;
    if (!journey) {
      throw new Error(`Journey ${journeyId} not found`);
    }

    let demandSpine = null;
    let closureSpine = null;
    let demandSubDecisions: Record<string, unknown>[] = [];
    let closureSubDecisions: Record<string, unknown>[] = [];

    if (journey.demandSpineId) {
      demandSpine = (await this.storage.getSpine(journey.demandSpineId)) as Record<string, unknown> | null;
      demandSubDecisions = (await this.storage.listSubDecisions(journey.demandSpineId)) as Record<string, unknown>[];
    }

    if (journey.closureSpineId) {
      closureSpine = (await this.storage.getSpine(journey.closureSpineId)) as Record<string, unknown> | null;
      closureSubDecisions = (await this.storage.listSubDecisions(journey.closureSpineId)) as Record<string, unknown>[];
    }

    const learningAssets = (await this.storage.getLearningAssetsByJourney(journeyId)) as Record<string, unknown>[];

    return {
      journey,
      demandSpine,
      closureSpine,
      demandSubDecisions,
      closureSubDecisions,
      learningAssets,
    };
  }
}
