import { randomUUID } from "crypto";
import { 
  DecisionObject, 
  LayerResult, 
  MemoryData,
  AuditEvent 
} from "@shared/schemas/corevia/decision-object";
import { agentRuntime } from "../../agents/agent-runtime";
import type { AgentContext } from "../../agents/agent-runtime";
import { authorizePlannedAgentExecution, mapOrchestrationAgentIdToRuntime } from "../../agents/agent-authorization";
import { coreviaStorage } from "../../storage";
import { logger } from "../../../platform/observability";

/**
 * Layer 8: Memory, Learning & Accountability
 * 
 * Responsibilities:
 * - Store approved decision + evidence + rationale
 * - Execute Distillation Intelligence (Engine #3)
 * - Create versioned artifacts (DRAFT)
 * - NO auto-activation of learning
 * 
 * INVARIANT: Learning ONLY from approved outcomes
 */
export class Layer8Memory {
  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  }

  private normalizeConfidenceToPercent(value: unknown): number | null {
    if (value == null || value === "") return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    const scaled = num > 1 ? num : num * 100;
    const clamped = Math.max(0, Math.min(100, scaled));
    return Math.round(clamped);
  }

  constructor() {
  }

  /**
   * Execute Layer 8 processing
   */
  async execute(decision: DecisionObject): Promise<LayerResult> {
    const startTime = Date.now();
    
    try {
      const validation = decision.validation;
      const advisory = decision.advisory;
      
      if (!advisory) {
        throw new Error("Missing advisory package");
      }

      // Create decision summary
      const decisionSummary = this.createDecisionSummary(decision);
      
      // Gather evidence for memory
      const evidence = advisory.evidence;
      
      // Create rationale
      const rationale = this.createRationale(decision);
      
      // Create ledger entry early so learning artifacts can link to it
      await coreviaStorage.ensureMemoryEntry(decision.decisionId, decision);

      // Flush deferred draft artifacts (BUSINESS_CASE, REQUIREMENTS, STRATEGIC_FIT etc.)
      // Layer 6 defers persistence for these types, attaching them to advisory.generatedArtifacts.
      // We persist them here so they appear as real sub-decisions in the timeline.
      await this.flushDeferredArtifacts(decision);

      // Learning/distillation is intentionally NOT executed in Layer 8.
      // Engine C runs post-conclusion via the DecisionSpine orchestrator, only from approved outcomes.
      const learningExtracted = false;

      const postApprovalResults = await this.executePostApprovalAgents(decision);

      // Generate tags for search
      const tags = this.generateTags(decision);
      
      const memoryData: MemoryData = {
        decisionSummary,
        evidence,
        rationale,
        learningExtracted,
        learningArtifactIds: undefined,
        tags,
      };

      await coreviaStorage.saveDecisionOutcome({
        decisionId: decision.decisionId,
        outcomeStatus: validation?.status === "approved" ? "approved" : validation?.status || "pending",
        lessonsLearned: learningExtracted ? "Learning assets drafted" : undefined,
        recordedBy: validation?.approvedBy,
      });

      // Create audit event
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        layer: 8,
        eventType: "memory_stored",
        eventData: {
          summaryLength: decisionSummary.length,
          evidenceCount: evidence.length,
          learningExtracted,
          artifactsCreated: 0,
          tagsCount: tags.length,
          postApprovalAgentsExecuted: postApprovalResults.executed,
          postApprovalAgentsSkipped: postApprovalResults.skipped,
          postApprovalAgentRuns: postApprovalResults.runs,
          postApprovalAverageConfidence: (() => {
            const confidences = postApprovalResults.runs
              .map(r => this.normalizeConfidenceToPercent(r.confidence))
              .filter((v): v is number => typeof v === "number");
            if (confidences.length === 0) return null;
            return Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length);
          })(),
        },
        actorType: "system",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      logger.info(`[Layer 8] Memory stored: ${tags.length} tags, learning=${learningExtracted}`);

      return {
        success: true,
        layer: 8,
        status: "memory",
        data: memoryData,
        shouldContinue: true,
        auditEvent,
      };
    } catch (error) {
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        layer: 8,
        eventType: "memory_failed",
        eventData: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        actorType: "system",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      return {
        success: false,
        layer: 8,
        status: "blocked",
        error: error instanceof Error ? error.message : "Memory storage failed",
        shouldContinue: false,
        auditEvent,
      };
    }
  }

  private async executePostApprovalAgents(decision: DecisionObject): Promise<{
    executed: number;
    skipped: number;
    runs: Array<{
      runtimeAgentId: string;
      plannedAgentId: string;
      agentName: string;
      plannedMode: "execute";
      status: "completed" | "failed" | "skipped";
      success?: boolean;
      confidence?: unknown;
      executionTimeMs?: number;
      reason?: string;
      error?: string;
    }>;
  }> {
    const approvalId = decision.validation?.approvalId;
    const approvalStatus = decision.validation?.status;
    const orchestration = decision.orchestration;

    if (approvalStatus !== "approved" || !approvalId || !orchestration?.selectedAgents?.length) {
      return { executed: 0, skipped: 0, runs: [] };
    }

    const executionCandidates = orchestration.selectedAgents.filter(agent => {
      if (agent.agentId !== "portfolio_sync") return false;
      const allowedModes = Array.isArray(agent.constraints?.allowedModes)
        ? agent.constraints.allowedModes
        : [];
      return allowedModes.includes("execute");
    });

    if (executionCandidates.length === 0) {
      return { executed: 0, skipped: 0, runs: [] };
    }

    let executed = 0;
    let skipped = 0;
    const runs: Array<{
      runtimeAgentId: string;
      plannedAgentId: string;
      agentName: string;
      plannedMode: "execute";
      status: "completed" | "failed" | "skipped";
      success?: boolean;
      confidence?: unknown;
      executionTimeMs?: number;
      reason?: string;
      error?: string;
    }> = [];

    for (const agent of executionCandidates) {
      const runtimeId = mapOrchestrationAgentIdToRuntime(agent.agentId);
      const rawInput = (decision.input?.rawInput || {}) as Record<string, unknown>;
      const normalizedInput = (decision.input?.normalizedInput || {}) as Record<string, unknown>;
      const parentDemandApproved = rawInput.parentDemandApproved === true
        || normalizedInput.parentDemandApproved === true;
      const authorization = authorizePlannedAgentExecution({
        runtimeAgentId: runtimeId,
        requestedMode: "execute",
        policyResult: decision.policy?.result,
        contextResult: decision.context?.result,
        plan: {
          selectedAgents: orchestration.selectedAgents,
          agentPlanPolicy: orchestration.agentPlanPolicy,
        },
        approval: { status: approvalStatus, approvalId },
        parentDemandApproved,
      });

      if (!authorization.allowed) {
        skipped++;
        runs.push({
          runtimeAgentId: runtimeId,
          plannedAgentId: agent.agentId,
          agentName: agent.agentName,
          plannedMode: "execute",
          status: "skipped",
          reason: authorization.reason || "not_authorized",
        });
        continue;
      }

      const registeredAgent = agentRuntime.getAgent(runtimeId);
      if (!registeredAgent) {
        skipped++;
        runs.push({
          runtimeAgentId: runtimeId,
          plannedAgentId: agent.agentId,
          agentName: agent.agentName,
          plannedMode: "execute",
          status: "skipped",
          reason: "agent_not_registered",
        });
        continue;
      }

      const idempotencyKey = `${approvalId}-${agent.agentId}`;
      const alreadyExecuted = await coreviaStorage.checkActionExecutionExists(idempotencyKey);
      if (alreadyExecuted) {
        skipped++;
        runs.push({
          runtimeAgentId: runtimeId,
          plannedAgentId: agent.agentId,
          agentName: agent.agentName,
          plannedMode: "execute",
          status: "skipped",
          reason: "idempotency_exists",
        });
        continue;
      }

      const context: AgentContext = {
        decisionId: decision.decisionId,
        correlationId: decision.correlationId,
        classificationLevel: decision.classification?.classificationLevel || "internal",
        tenantId: (this.asRecord(decision).organizationId as string) || "default",
        userId: this.asRecord(decision).userId as string | undefined,
        metadata: {
          layer: 8,
          mode: "execute",
          approvalId,
          postApproval: true,
        },
      };

      const input = decision.input?.normalizedInput || decision.input?.rawInput || {};

      try {
        const startedAt = Date.now();
        try {
          await coreviaStorage.addAuditEvent(
            decision.decisionId,
            decision.correlationId,
            8,
            "brain.agent.started",
            {
              agentId: runtimeId,
              agentName: agent.agentName,
              plannedAgentId: agent.agentId,
              plannedMode: "execute",
              approvalId,
              postApproval: true,
              _audit: {
                actorType: "agent",
                timestamp: new Date().toISOString(),
              },
            },
            runtimeId
          );
        } catch (err) {
          logger.warn(
            `[Layer 8] Warning: Could not persist agent started event (${runtimeId}):`,
            err instanceof Error ? err.message : err
          );
        }

        const output = await agentRuntime.execute(runtimeId, {
          task: `Post-Approval EXECUTE: ${agent.agentName} (ApprovalID: ${approvalId})`,
          context,
          parameters: {
            ...(input as Record<string, unknown>),
            mode: "execute",
            approvalId,
            advisory: decision.advisory,
          },
        });

        try {
          await coreviaStorage.addAuditEvent(
            decision.decisionId,
            decision.correlationId,
            8,
            "brain.agent.completed",
            {
              agentId: runtimeId,
              agentName: agent.agentName,
              plannedAgentId: agent.agentId,
              plannedMode: "execute",
              approvalId,
              postApproval: true,
              success: output.success,
              confidence: output.confidence,
              executionTimeMs: output.executionTimeMs ?? (Date.now() - startedAt),
              errors: output.errors || [],
              _audit: {
                actorType: "agent",
                timestamp: new Date().toISOString(),
              },
            },
            runtimeId
          );
        } catch (err) {
          logger.warn(
            `[Layer 8] Warning: Could not persist agent completed event (${runtimeId}):`,
            err instanceof Error ? err.message : err
          );
        }

        await coreviaStorage.saveActionExecution({
          decisionId: decision.decisionId,
          approvalId,
          actionType: `agent:${agent.agentId}`,
          idempotencyKey,
          status: output.success ? "SUCCEEDED" : "FAILED",
          requestPayload: {
            agentId: agent.agentId,
            agentName: agent.agentName,
            runtimeAgentId: runtimeId,
            plannedMode: "execute",
            postApproval: true,
          },
          result: {
            ...(((output.result && typeof output.result === "object") ? output.result : {}) as Record<string, unknown>),
            _meta: {
              success: output.success,
              confidence: output.confidence,
              executionTimeMs: output.executionTimeMs ?? (Date.now() - startedAt),
            },
          },
          error: output.success ? undefined : (output.errors || []).join("; "),
        });

        executed += 1;

        runs.push({
          runtimeAgentId: runtimeId,
          plannedAgentId: agent.agentId,
          agentName: agent.agentName,
          plannedMode: "execute",
          status: output.success ? "completed" : "failed",
          success: output.success,
          confidence: output.confidence,
          executionTimeMs: output.executionTimeMs ?? (Date.now() - startedAt),
          error: output.success ? undefined : (output.errors || []).join("; "),
        });
      } catch (error) {
        try {
          await coreviaStorage.addAuditEvent(
            decision.decisionId,
            decision.correlationId,
            8,
            "brain.agent.failed",
            {
              agentId: runtimeId,
              agentName: agent.agentName,
              plannedAgentId: agent.agentId,
              plannedMode: "execute",
              approvalId,
              postApproval: true,
              error: error instanceof Error ? error.message : "Unknown error",
              _audit: {
                actorType: "agent",
                timestamp: new Date().toISOString(),
              },
            },
            runtimeId
          );
        } catch (err) {
          logger.warn(
            `[Layer 8] Warning: Could not persist agent failed event (${runtimeId}):`,
            err instanceof Error ? err.message : err
          );
        }

        await coreviaStorage.saveActionExecution({
          decisionId: decision.decisionId,
          approvalId,
          actionType: `agent:${agent.agentId}`,
          idempotencyKey,
          status: "FAILED",
          requestPayload: {
            agentId: agent.agentId,
            agentName: agent.agentName,
            runtimeAgentId: runtimeId,
            plannedMode: "execute",
            postApproval: true,
          },
          result: {},
          error: error instanceof Error ? error.message : "Unknown error",
        });
        skipped += 1;

        runs.push({
          runtimeAgentId: runtimeId,
          plannedAgentId: agent.agentId,
          agentName: agent.agentName,
          plannedMode: "execute",
          status: "failed",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return { executed, skipped, runs };
  }

  /**
   * Persist deferred draft artifacts from advisory.generatedArtifacts into real
   * decision_artifacts + sub_decisions rows so they appear in the Sub-Decision Timeline.
   */
  private async flushDeferredArtifacts(decision: DecisionObject): Promise<void> {
    const advisory = this.asRecord(decision.advisory);
    const generatedArtifacts = this.asRecord(advisory.generatedArtifacts);
    const artifactTypes = Object.keys(generatedArtifacts);
    if (artifactTypes.length === 0) return;

    const createdBy = this.asRecord(decision.input).userId as string | undefined;

    for (const artifactType of artifactTypes) {
      const content = generatedArtifacts[artifactType];
      if (!content || typeof content !== "object") continue;

      try {
        await coreviaStorage.upsertDecisionArtifactVersion({
          decisionSpineId: decision.decisionId,
          artifactType,
          subDecisionType: artifactType,
          content: content as Record<string, unknown>,
          changeSummary: `Draft generated by Brain Layer 6 (deferred, flushed by Layer 8)`,
          createdBy,
        });
        logger.info(`[Layer 8] Flushed deferred artifact: ${artifactType} for spine ${decision.decisionId}`);
      } catch (err) {
        logger.warn(`[Layer 8] Failed to flush deferred artifact ${artifactType}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /**
   * Create decision summary
   */
  private createDecisionSummary(decision: DecisionObject): string {
    const input = decision.input;
    const advisory = decision.advisory;
    const validation = decision.validation;
    const normalizedInput = this.asRecord(input?.normalizedInput);
    const rawInput = this.asRecord(input?.rawInput);
    
    const projectName = (normalizedInput.projectName as string | undefined) ||
               (rawInput.projectName as string | undefined) ||
                       "Unnamed Project";
    
    const topOption = advisory?.options[0];
    const status = validation?.status || "pending";
    
    const parts = [
      `Decision for: ${projectName}`,
      `Service: ${input?.serviceId}/${input?.routeKey}`,
      `Classification: ${decision.classification?.classificationLevel || "unknown"}`,
      `Status: ${status}`,
    ];
    
    if (topOption) {
      parts.push(`Recommended Option: ${topOption.name}`);
      parts.push(`Confidence: ${advisory?.overallConfidence || 0}%`);
    }
    
    if (advisory?.risks.length) {
      const highRisks = advisory.risks.filter(r => r.impact === "high" || r.impact === "critical");
      parts.push(`Key Risks: ${highRisks.length} high-impact risks identified`);
    }
    
    return parts.join("\n");
  }

  /**
   * Create rationale for decision
   */
  private createRationale(decision: DecisionObject): string {
    const advisory = decision.advisory;
    const validation = decision.validation;
    
    const parts: string[] = [];
    
    // Policy rationale
    if (decision.policy?.result === "allow") {
      parts.push("Policy evaluation: ALLOWED - All governance checks passed.");
    }
    
    // Context rationale
    if (decision.context?.result === "ready") {
      parts.push(`Data quality: READY - Completeness score: ${decision.context.completenessScore}%`);
    }
    
    // Options rationale
    if (advisory?.options.length) {
      const topOption = advisory.options[0]!;
      parts.push(`Primary recommendation: ${topOption.name} (score: ${topOption.recommendationScore}%)`);
      parts.push(`Justification: ${topOption.description}`);
    }
    
    // Approval rationale
    if (validation?.status === "approved") {
      parts.push(`Approval: Approved by ${validation.approvedBy || "system"}`);
      if (validation.approvalReason) {
        parts.push(`Reason: ${validation.approvalReason}`);
      }
    }
    
    return parts.join("\n\n");
  }

  /**
   * Generate tags for search and categorization
   */
  private generateTags(decision: DecisionObject): string[] {
    const tags: string[] = [];
    
    // Service tags
    tags.push(`service:${decision.input?.serviceId}`);
    tags.push(`route:${decision.input?.routeKey}`);
    
    // Classification tags
    if (decision.classification) {
      tags.push(`classification:${decision.classification.classificationLevel}`);
      if (decision.classification.sector) {
        tags.push(`sector:${decision.classification.sector}`);
      }
      if (decision.classification.riskLevel) {
        tags.push(`risk:${decision.classification.riskLevel}`);
      }
    }
    
    // Status tags
    tags.push(`status:${decision.validation?.status || decision.status}`);
    
    // Content tags from input
    const input = decision.input?.normalizedInput || decision.input?.rawInput;
    if (input) {
      const inputRecord = this.asRecord(input);
      const projectName = (inputRecord.projectName as string | undefined) || (inputRecord.title as string | undefined);
      if (projectName) {
        // Extract keywords from project name
        const keywords = projectName.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
        for (const kw of keywords.slice(0, 5)) {
          tags.push(`keyword:${kw}`);
        }
      }
    }
    
    return tags;
  }
}
