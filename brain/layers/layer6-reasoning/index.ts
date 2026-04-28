import { randomUUID } from "node:crypto";
import {
  DecisionObject,
  LayerResult,
  AdvisoryData,
  AuditEvent,
  AgentMode
} from "@shared/schemas/corevia/decision-object";
import { InternalEngine } from "../../intelligence/internal";
import { HybridEngine, HybridAnalysisResult } from "../../intelligence/hybrid";
import { agentRuntime } from "../../agents/agent-runtime";
import { authorizePlannedAgentExecution, mapOrchestrationAgentIdToRuntime } from "../../agents/agent-authorization";
import type { AgentContext } from "../../agents/agent-runtime";
import { coreviaStorage } from "../../storage";
import { logger } from "../../../platform/observability";

const ARTIFACT_TYPE_BY_USE_CASE: Readonly<Record<string, string>> = {
  "ASSISTANT.TOOL_PLAN": "ASSISTANT_TOOL_PLAN",
  "ASSISTANT.RESPONSE": "ASSISTANT_RESPONSE",
  "RAG.QUERY.EXPAND": "RAG_QUERY_EXPANSION",
  "RAG.QUERY.REWRITE": "RAG_QUERY_REWRITE",
  "RAG.CLASSIFY": "RAG_CLASSIFICATION",
  "RAG.RERANK": "RAG_RERANK",
  "RAG.ANSWER.GENERATE": "RAG_ANSWER",
  "RAG.CONFLICT.DETECT": "RAG_CONFLICT",
  "RAG.SUMMARY.SYNTHESIZE": "RAG_SYNTHESIS_SUMMARY",
  "BUSINESS_CASE.CLARIFICATIONS.DETECT": "BUSINESS_CASE_CLARIFICATIONS",
  "DEMAND.FIELDS.GENERATE": "DEMAND_FIELDS",
  "DEMAND.OBJECTIVE.ENHANCE": "DEMAND_OBJECTIVE_ENHANCEMENT",
  "DEMAND.REQUEST.CLASSIFY": "DEMAND_REQUEST_CLASSIFICATION",
  "DEMAND.ANALYSIS.COMPREHENSIVE": "DEMAND_COMPREHENSIVE_ANALYSIS",
  "BUSINESS_CASE.GENERATE": "BUSINESS_CASE",
  "REQUIREMENTS.GENERATE": "REQUIREMENTS",
  "STRATEGIC_FIT.GENERATE": "STRATEGIC_FIT",
  "WBS.GENERATE": "WBS",
  "VENDOR.PROPOSAL.SUMMARIZE": "VENDOR_PROPOSAL_SUMMARY",
  "VENDOR.EVALUATION.SCORE": "VENDOR_EVALUATION_SCORES",
  "VENDOR.EVALUATION.SUMMARY": "VENDOR_EVALUATION_SUMMARY",
  "KNOWLEDGE.GRAPH.EXTRACT": "KNOWLEDGE_GRAPH_EXTRACTION",
  "KNOWLEDGE.BRIEFING.GENERATE": "EXECUTIVE_BRIEFING",
  "KNOWLEDGE.INSIGHT_RADAR.GAP_ANALYSIS": "KNOWLEDGE_GAP_ANALYSIS",
  "KNOWLEDGE.INSIGHT_RADAR.INSIGHTS": "PROACTIVE_INSIGHTS",
  "KNOWLEDGE.AUTO_CLASSIFY": "DOCUMENT_CLASSIFICATION",
  "KNOWLEDGE.DOCUMENT_SUMMARIZE": "DOCUMENT_SUMMARY",
  "INTELLIGENCE.VERSION_IMPACT.ANALYZE": "VERSION_IMPACT_ANALYSIS",
  "INTELLIGENCE.DAILY_BRIEFING.GENERATE": "DAILY_INTELLIGENCE_BRIEFING",
  "INTELLIGENCE.REASONING.GENERATE": "REASONING_TRACE",
  "PORTFOLIO.TEAM_RECOMMENDATION.GENERATE": "TEAM_RECOMMENDATION",
  "PORTFOLIO.EVIDENCE.EVALUATE": "EVIDENCE_EVALUATION",
  "PORTFOLIO.TASK.GUIDANCE": "TASK_COMPLETION_GUIDANCE",
  "MARKET_RESEARCH.GENERATE": "MARKET_RESEARCH",
  "AI.VALIDATION.ASSIST": "VALIDATION_ASSIST",
  "RISK.EVIDENCE.VERIFY": "RISK_EVIDENCE_VERIFICATION",
  "LANGUAGE.TRANSLATE": "TRANSLATION",
};

type InternalDraftArtifactParams = {
  decision: DecisionObject;
  artifactType: string;
  outputSchemaId: string;
  advisory: AdvisoryData;
  internalOutput?: Record<string, unknown>;
  agentOutputs?: Record<string, Record<string, unknown>>;
};

type BusinessCaseRiskEntry = {
  name: string;
  severity: string;
  description: string;
  probability: string;
  impact: string;
  mitigation: string;
  owner: null;
};

type BusinessCaseContext = {
  title: string;
  objective: string;
  budgetRange: string;
  department: string;
  orgLabel: string;
  requestorName: string;
  estimatedTimeline: string;
  demandStakeholders: string;
  currentChallenges: string;
  expectedOutcomes: string;
  successCriteria: string;
  constraints: string;
  riskFactors: string;
  existingSystems: string;
  integrationRequirements: string;
  complianceRequirements: string;
  urgency: string;
  advisoryOptions: AdvisoryData["options"];
  financialAgent?: Record<string, unknown>;
  riskAgent?: Record<string, unknown>;
  alignmentAgent?: Record<string, unknown>;
  complianceAgent?: Record<string, unknown>;
  projectManagerAgent?: Record<string, unknown>;
  wbsAgent?: Record<string, unknown>;
  dependencyAgent?: Record<string, unknown>;
  resourceRoleAgent?: Record<string, unknown>;
  totalCost: number;
  effectiveTotalCost: number;
  totalBenefits: number;
  npv: number;
  roi: number;
  payback: number;
  investmentGrade: string;
  overallAlignment: number;
  complianceScore: number;
  hasAgentData: boolean;
};

type DraftPersistenceTelemetry = {
  usedInternalEngine: boolean;
  usedHybridEngine: boolean;
  hybridStatus?: string;
};

/**
 * Layer 6: Reasoning & Analysis (SAFE ZONE)
 *
 * Responsibilities:
 * - Execute Internal Intelligence (RAG, scoring, entities)
 * - Execute Hybrid Intelligence (ONLY if policy allows)
 * - Run ADK Agents in READ/PLAN mode only
 * - Output Advisory Package (NON-BINDING)
 *
 * INVARIANT: NO SIDE EFFECTS in this layer
 */
export class Layer6Reasoning {
  private readonly internalEngine: InternalEngine;
  private readonly hybridEngine: HybridEngine;

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  }

  private asString(value: unknown, fallback = ""): string {
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return fallback;
  }

  private firstString(values: unknown[], fallback = ""): string {
    for (const value of values) {
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
    }
    return fallback;
  }

  private firstDisplayName(values: unknown[]): string | undefined {
    for (const value of values) {
      if (typeof value !== "string") {
        continue;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        continue;
      }

      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
        continue;
      }

      return trimmed;
    }

    return undefined;
  }

  private asOptionalString(value: unknown): string | undefined {
    const stringValue = this.asString(value).trim();
    return stringValue.length > 0 ? stringValue : undefined;
  }

  private asNumber(value: unknown, fallback = 0): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  private asConfidencePercent(value: unknown, fallback: number): number {
    return typeof value === "number" ? Math.round(value * 100) : fallback;
  }

  private buildArtifactMeta(outputSchemaId: string, confidence = 0.25): Record<string, unknown> {
    return {
      outputSchemaId,
      generatedAt: new Date().toISOString(),
      engine: "A",
      confidence,
      fallback: true,
    };
  }

  private listPreview(value: unknown, limit: number): string {
    if (Array.isArray(value)) {
      return value.map((item) => this.asString(item)).filter(Boolean).slice(0, limit).join(", ");
    }
    return this.asString(value);
  }

  private scoreByCount(count: number, thresholds: ReadonlyArray<[number, number]>): number {
    for (const [minimum, score] of thresholds) {
      if (count >= minimum) {
        return score;
      }
    }
    return 0;
  }

  private scoreByLength(length: number, thresholds: ReadonlyArray<[number, number]>): number {
    for (const [minimum, score] of thresholds) {
      if (length > minimum) {
        return score;
      }
    }
    return 0;
  }

  private gradeFromTotal(total: number): string {
    if (total >= 85) {
      return "A";
    }
    if (total >= 70) {
      return "B";
    }
    if (total >= 55) {
      return "C";
    }
    if (total >= 40) {
      return "D";
    }
    return "F";
  }

  private budgetMultiplier(budgetRange: string): number {
    if (/\b(billion|\d\s*B)\b/i.test(budgetRange)) {
      return 1_000_000_000;
    }
    if (/\b(million|\d\s*M)\b/i.test(budgetRange)) {
      return 1_000_000;
    }
    if (/\b(thousand|\d\s*K)\b/i.test(budgetRange)) {
      return 1_000;
    }
    return 1;
  }

  private createFallbackEvidence(): AdvisoryData["evidence"][number] {
    return {
      id: randomUUID(),
      source: "System Analysis",
      type: "data",
      content: "Analysis based on input data and organizational context",
      confidence: 60,
    };
  }

  private getAgentExecutionStatus(agentOutput: { errors?: unknown; success?: boolean }): { status: string; reason?: string } {
    const executionErrors = Array.isArray(agentOutput.errors)
      ? agentOutput.errors.map(String)
      : [];
    const skippedForClassification = executionErrors.some((error) => /Insufficient classification level/i.test(error));
    if (skippedForClassification) {
      return { status: "skipped", reason: executionErrors[0] };
    }
    if (agentOutput.success) {
      return { status: "completed" };
    }
    return { status: "failed" };
  }

  private async persistAgentAuditEvent(params: {
    decision: DecisionObject;
    runtimeAgentId: string;
    agent: { agentId: string; agentName: string; mode: string };
    eventType: string;
    payload: Record<string, unknown>;
    warningLabel: string;
  }): Promise<void> {
    try {
      await coreviaStorage.addAuditEvent(
        params.decision.decisionId,
        params.decision.correlationId,
        6,
        params.eventType,
        {
          agentId: params.runtimeAgentId,
          agentName: params.agent.agentName,
          plannedAgentId: params.agent.agentId,
          plannedMode: params.agent.mode,
          ...params.payload,
          _audit: {
            actorType: "agent",
            timestamp: new Date().toISOString(),
          },
        },
        params.runtimeAgentId,
      );
    } catch (err) {
      logger.warn(
        `[Layer 6] Warning: Could not persist agent ${params.warningLabel} event (${params.runtimeAgentId}):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  private buildDefaultOptions(params: {
    projectName: string;
    deptLabel: string;
    objectiveSnippet: string;
    budgetLabel: string;
    budget: string;
    riskLevel: string;
    completeness: number;
    isHighUrgency: boolean;
    isLowCompleteness: boolean;
  }): AdvisoryData["options"] {
    const fullScaleTimeline = params.isHighUrgency ? "Meets the high-urgency timeline requirement" : "Delivers full value within standard timeline";
    const fullScaleRisk = params.riskLevel === "high" ? "Higher integration risk due to project complexity" : "Standard integration complexity to manage";
    const phasedBudget = params.budget ? `Spreads ${params.budget} investment across milestones` : "Distributes cost across defined milestones";
    const phasedTimeline = params.isHighUrgency ? "May not meet the urgency deadline with phased approach" : "Extended timeline to achieve full operational capability";
    const studyDescription = params.isLowCompleteness
      ? `Conduct deeper analysis to fill information gaps before committing to ${params.projectName}`
      : `Run a focused pilot of ${params.projectName}${params.deptLabel} to validate assumptions and refine scope`;
    const studyPro = params.isLowCompleteness
      ? "Addresses significant data gaps identified in the proposal"
      : `Validates key assumptions for ${params.projectName}`;
    const studyCon = params.isHighUrgency
      ? "Conflicts directly with the stated urgency level"
      : "May reduce stakeholder momentum and support";

    return [
      {
        id: randomUUID(),
        name: `Full-Scale ${params.projectName} Deployment`,
        description: `Approve ${params.projectName}${params.deptLabel} for complete implementation${params.budgetLabel}, addressing: ${params.objectiveSnippet}`,
        pros: [
          `Directly addresses the stated objective for ${params.projectName}`,
          fullScaleTimeline,
          `Comprehensive solution coverage${params.deptLabel}`,
        ],
        cons: [
          params.budget ? `Full budget commitment of ${params.budget} required upfront` : "Full resource allocation required from the start",
          fullScaleRisk,
          "Requires dedicated cross-functional team commitment",
        ],
        recommendationScore: params.completeness >= 70 ? 85 : 70,
      },
      {
        id: randomUUID(),
        name: `Phased ${params.projectName} Rollout`,
        description: `Deploy ${params.projectName} in controlled phases${params.deptLabel} — pilot first, then scale based on validated outcomes`,
        pros: [
          `Validates ${params.projectName} approach before full commitment`,
          "Allows iterative refinement based on real feedback",
          phasedBudget,
        ],
        cons: [
          phasedTimeline,
          "Partial deployment may limit initial impact measurement",
          "Requires sustained governance across multiple phases",
        ],
        recommendationScore: params.isHighUrgency ? 65 : 78,
      },
      {
        id: randomUUID(),
        name: `${params.projectName} Feasibility & Pilot Study`,
        description: studyDescription,
        pros: [
          studyPro,
          "Builds evidence base for more informed decision-making",
          "Minimizes risk of large-scale commitment on untested approach",
        ],
        cons: [
          `Delays ${params.projectName} benefits by estimated 3-6 months`,
          "Opportunity cost while competitors or peer entities advance",
          studyCon,
        ],
        recommendationScore: params.isLowCompleteness ? 70 : 45,
      },
    ];
  }

  private tokenizeDemandText(text: string): string[] {
    return text
      .toLowerCase()
      .replaceAll(/[^a-z0-9\s]+/g, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 4);
  }

  private hasReferenceCoverage(sourceText: string, normalizedText: string, minimumHits: number): boolean {
    const tokens = Array.from(new Set(this.tokenizeDemandText(sourceText))).slice(0, 10);
    const hits = tokens.filter((token) => normalizedText.includes(token)).length;
    const normalizedSource = sourceText.toLowerCase().replaceAll(/\s+/g, " ").trim();
    const verbatimOk = normalizedSource.length > 0 && normalizedText.includes(normalizedSource.substring(0, Math.min(normalizedSource.length, 12)));
    return verbatimOk || tokens.length === 0 || hits >= minimumHits;
  }

  private scoreFinancialBreakdown(content: Record<string, unknown>): number {
    const hasCost = typeof content.totalCostEstimate === "number" && content.totalCostEstimate > 0;
    const hasNPV = typeof content.npvValue === "number" && content.npvValue !== 0;
    const hasROI = typeof content.roiPercentage === "number" && content.roiPercentage !== 0;
    const hasPayback = typeof content.paybackMonths === "number" && content.paybackMonths > 0;
    return (hasCost ? 5 : 0) + (hasNPV ? 5 : 0) + (hasROI ? 5 : 0) + (hasPayback ? 5 : 0);
  }

  private scoreRecommendationBreakdown(content: Record<string, unknown>): number {
    const recs = content.recommendations as Record<string, unknown> | undefined;
    const findings = Array.isArray(recs?.keyFindings) ? recs.keyFindings as unknown[] : [];
    const hasRecommendation = typeof recs?.primaryRecommendation === "string" && recs.primaryRecommendation.length > 0;
    return (hasRecommendation ? 5 : 0) + (findings.length > 0 ? 5 : 0);
  }

  private appendBusinessCaseFieldLengthIssues(params: {
    issues: string[];
    execSummary: string;
    solutionOverview: string;
    businessRequirements: string;
    proposedSolution: string;
    implementationPhases: unknown[];
  }): void {
    if (params.execSummary.length < 160) {
      params.issues.push("executiveSummary_too_short");
    }
    if (params.solutionOverview.length < 160) {
      params.issues.push("solutionOverview_too_short");
    }
    if (params.businessRequirements.length < 160) {
      params.issues.push("businessRequirements_too_short");
    }
    if (params.proposedSolution.length < 160) {
      params.issues.push("proposedSolution_too_short");
    }
    if (params.implementationPhases.length < 3) {
      params.issues.push("implementationPhases_insufficient");
    }
  }

  private appendBusinessCaseReferenceIssues(params: {
    issues: string[];
    projectName: string;
    orgName: string;
    objective: string;
    combined: string;
    combinedNormalized: string;
  }): void {
    if (params.projectName) {
      const minimumHits = this.tokenizeDemandText(params.projectName).length >= 4 ? 2 : 1;
      if (!this.hasReferenceCoverage(params.projectName, params.combinedNormalized, minimumHits)) {
        params.issues.push("missing_projectName_reference");
      }
    }

    if (params.orgName && !this.hasReferenceCoverage(params.orgName, params.combinedNormalized, 1)) {
      params.issues.push("missing_organizationName_reference");
    }

    if (params.objective && params.objective.length > 40) {
      const keywords = Array.from(
        new Set(
          params.objective
            .toLowerCase()
            .split(/[^a-z0-9]+/i)
            .map((word) => word.trim())
            .filter((word) => word.length >= 5),
        ),
      ).slice(0, 8);
      const hits = keywords.filter((keyword) => params.combined.includes(keyword)).length;
      if (keywords.length >= 4 && hits < 2) {
        params.issues.push("weak_alignment_to_businessObjective");
      }
    }
  }

  private parseBudgetAmount(budgetRange: string): number {
    if (!budgetRange || budgetRange.trim().length === 0) return 0;

    const text = budgetRange.trim();
    const unitMultiplier = (unit: string | undefined): number => {
      if (!unit) return 1;
      const u = unit.toLowerCase();
      if (u === 'b' || u === 'billion') return 1_000_000_000;
      if (u === 'm' || u === 'million') return 1_000_000;
      if (u === 'k' || u === 'thousand') return 1_000;
      return 1;
    };

    // Comma-separated range: "1,200,000 to 3,500,000"
    const commaRange = text.match(/(\d{1,3}(?:,\d{3})+(?:\.\d+)?)\s*(?:to|–|-|~)\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?)/i);
    if (commaRange) {
      const low = parseFloat(commaRange[1]!.replace(/,/g, ''));
      const high = parseFloat(commaRange[2]!.replace(/,/g, ''));
      if (Number.isFinite(low) && Number.isFinite(high)) return (low + high) / 2;
    }

    // Single comma-separated: "1,200,000"
    const commaSingle = text.match(/(\d{1,3}(?:,\d{3})+(?:\.\d+)?)/i);
    if (commaSingle) {
      const parsed = parseFloat(commaSingle[1]!.replace(/,/g, ''));
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    // Unit-suffixed: "1.2M-3.5M", "5 million"
    const unitPattern = /(\d+(?:\.\d+)?)\s*(billion|million|thousand|[BMK])\b/gi;
    const matches = [...text.matchAll(unitPattern)];
    if (matches.length >= 2) {
      const low = parseFloat(matches[0]![1]!) * unitMultiplier(matches[0]![2]);
      const high = parseFloat(matches[1]![1]!) * unitMultiplier(matches[1]![2]);
      if (Number.isFinite(low) && Number.isFinite(high)) return (low + high) / 2;
    }
    if (matches.length === 1) {
      const val = parseFloat(matches[0]![1]!) * unitMultiplier(matches[0]![2]);
      if (Number.isFinite(val) && val > 0) return val;
    }

    // Plain number fallback with legacy multiplier
    const multiplier = this.budgetMultiplier(budgetRange);
    const plainMatch = text.match(/(\d+(?:\.\d+)?)/i);
    if (plainMatch) {
      const val = parseFloat(plainMatch[1]!);
      if (Number.isFinite(val) && val > 0) return val * multiplier;
    }

    return 0;
  }

  private mapRiskScoreToLevel(score: number): "critical" | "high" | "medium" | "low" {
    if (score >= 70) {
      return "critical";
    }
    if (score >= 50) {
      return "high";
    }
    if (score >= 30) {
      return "medium";
    }
    return "low";
  }

  constructor() {
    this.internalEngine = new InternalEngine();
    this.hybridEngine = new HybridEngine();
  }

  private abortError(reason?: unknown): Error {
    if (reason instanceof Error) {
      return reason;
    }
    return new Error(typeof reason === "string" && reason ? reason : "Reasoning aborted");
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw this.abortError(signal.reason);
    }
  }

  private validateReasoningPreconditions(
    decision: DecisionObject,
    primaryKind: string,
    redactionMode: string,
    options?: { parentDemandApproved?: boolean },
  ): void {
    const orchestration = decision.orchestration;
    const policyResult = decision.policy?.result;
    const contextResult = decision.context?.result;

    if (!orchestration) {
      throw new Error("Missing orchestration plan");
    }
    if (primaryKind === "DISTILLATION") {
      throw new Error("Invalid IPLAN: DISTILLATION engine cannot run in Layer 6");
    }

    const classificationLevel = this.asString(decision.classification?.classificationLevel, "internal").toLowerCase();
    const isPublic = classificationLevel === "public";
    if (primaryKind === "EXTERNAL_HYBRID" && !isPublic && redactionMode === "NONE") {
      throw new Error("IPLAN violation: External/Hybrid reasoning requires redaction for non-public data");
    }
    if (!orchestration.agentPlanPolicy?.allowedAgents?.length) {
      throw new Error("Missing Layer 5 agent_plan.allowedAgents authorization");
    }
    if (orchestration.agentPlanPolicy.writePermissions !== false) {
      throw new Error("Invalid agent plan: writePermissions must be false in Layer 6");
    }
    // Inheritance: when the parent demand spine has already cleared L3 + L7 governance,
    // a derivative artifact run (BC / Requirements / EA / Strategic-Fit) may proceed even
    // if the per-call Layer 3 evaluation re-flagged require_approval. The route layer
    // attests to this via parentDemandApproved.
    if (policyResult && policyResult !== "allow" && !options?.parentDemandApproved) {
      throw new Error("Policy not ALLOW - agents cannot execute");
    }
    if (contextResult && contextResult !== "ready") {
      throw new Error("Context not READY - agents cannot execute");
    }
  }

  private buildDemandFieldsInternalOutput(): Record<string, unknown> {
    return {
      status: "completed",
      processingTimeMs: 0,
      rag: {
        query: "",
        documents: [],
        totalDocuments: 0,
      },
      scoring: {
        overallScore: 60,
        dimensions: {},
      },
      entities: [],
      patterns: {
        similarDecisions: 0,
        successRate: 0,
        commonFactors: [],
      },
      documents: [],
    };
  }

  private shouldSkipInternalEngineStep(draftArtifactType: string | null, primaryKind: string): boolean {
    return draftArtifactType === "DEMAND_FIELDS" && primaryKind === "EXTERNAL_HYBRID";
  }

  private buildGovernanceApprovalAdvisory(decision: DecisionObject): AdvisoryData {
    const approvalReasons = decision.policy?.approvalReasons?.length
      ? decision.policy.approvalReasons
      : decision.policy?.policiesEvaluated
        ?.filter(policy => policy.result === "require_approval" && policy.reason)
        .map(policy => policy.reason as string) || ["Manual governance approval is required before analysis execution."];

    return {
      options: [{
        id: "governance-approval-required",
        name: "Await governance approval",
        description: "Layer 6 has paused autonomous reasoning because Layer 3 requires human governance approval before agents or engines execute.",
        pros: ["Preserves HITL authority", "Prevents pre-approval autonomous execution"],
        cons: ["Business case, requirements, EA, and strategic fit remain locked until acknowledgement"],
        recommendationScore: 100,
      }],
      risks: [{
        id: "pre-approval-execution-risk",
        category: "governance",
        description: approvalReasons.join("; "),
        likelihood: "high",
        impact: "critical",
        mitigation: "Route the request through Layer 7 approval and record the acknowledgement reason before unlocking downstream analysis.",
      }],
      evidence: [{
        id: "policy-approval-evidence",
        source: "Layer 3 PolicyOps",
        type: "agent",
        content: approvalReasons.join("; "),
        confidence: 100,
      }],
      assumptions: [{
        assumption: "No autonomous reasoning or side-effecting execution is performed before approval.",
        basis: "Layer 3 returned require_approval.",
      }],
      proposedActions: [{
        id: "acknowledge-governance-gate",
        type: "approval",
        description: "Acknowledge the Brain governance gate and continue the demand workflow.",
        requiresApproval: true,
      }],
      agentOutputs: {},
      overallConfidence: 100,
      confidenceBreakdown: {
        policy: 100,
        agents: 0,
        hybrid: 0,
      },
    };
  }

  private shouldSkipHybridEngineStep(decision: DecisionObject, primaryKind: string): string | null {
    if (primaryKind && primaryKind !== "EXTERNAL_HYBRID") {
      return `IPLAN primary=${primaryKind}`;
    }
    if (!decision.classification?.constraints.allowExternalModels) {
      return "classification disallows external models";
    }
    return null;
  }

  private async handleInternalPlanStep(
    planStep: { step: number },
    decision: DecisionObject,
    draftArtifactType: string | null,
    primaryKind: string,
  ): Promise<Record<string, unknown> | undefined> {
    if (this.shouldSkipInternalEngineStep(draftArtifactType, primaryKind)) {
      logger.info(`[Layer 6] Step ${planStep.step}: Skipping Internal Engine (Hybrid-primary DEMAND_FIELDS execution; internal path reserved for fallback/governed classifications)`);
      return undefined;
    }

    logger.info(`[Layer 6] Step ${planStep.step}: Executing Internal Engine...`);
    if (draftArtifactType === "DEMAND_FIELDS") {
      logger.info("[Layer 6] DEMAND_FIELDS using fast internal analysis shortcut");
      return this.buildDemandFieldsInternalOutput();
    }
    return await this.internalEngine.analyze(decision);
  }

  private async handleHybridPlanStep(
    planStep: { step: number },
    decision: DecisionObject,
    primaryKind: string,
    draftArtifactType: string | null,
    internalEngineOutput?: Record<string, unknown>,
  ): Promise<HybridAnalysisResult | undefined> {
    const skipReason = this.shouldSkipHybridEngineStep(decision, primaryKind);
    if (skipReason) {
      logger.info(`[Layer 6] Step ${planStep.step}: Skipping Hybrid Engine (${skipReason})`);
      return undefined;
    }

    // DEMAND_FIELDS: skip the expensive analyze() call (~7 min Claude).
    // The actual demand-field enrichment happens via generateArtifactDraft()
    // inside tryPersistDraftArtifact, which already receives agent outputs.
    if (draftArtifactType === "DEMAND_FIELDS") {
      logger.info(`[Layer 6] Step ${planStep.step}: Skipping Hybrid Engine analyze() for DEMAND_FIELDS (artifact draft handles enrichment)`);
      return undefined;
    }

    logger.info(`[Layer 6] Step ${planStep.step}: Executing Hybrid Engine...`);
    return await this.hybridEngine.analyze(decision, internalEngineOutput);
  }

  private async handleAgentPlanStep(
    planStep: { step: number; target: string },
    orchestration: NonNullable<DecisionObject["orchestration"]>,
    decision: DecisionObject,
    internalEngineOutput: Record<string, unknown> | undefined,
    agentOutputs: Record<string, Record<string, unknown>>,
  ): Promise<void> {
    const agent = orchestration.selectedAgents.find((selectedAgent) => selectedAgent.agentId === planStep.target);
    if (agent) {
      logger.info(`[Layer 6] Step ${planStep.step}: Executing Agent: ${agent.agentName} (mode: ${agent.mode})`);
      agentOutputs[agent.agentId] = await this.executeAgent(agent, decision, internalEngineOutput);
      return;
    }
    logger.info(`[Layer 6] Step ${planStep.step}: Agent ${planStep.target} not in selectedAgents, skipping`);
  }

  private async runPlanStep(params: {
    planStep: { step: number; type: string; target: string };
    decision: DecisionObject;
    orchestration: NonNullable<DecisionObject["orchestration"]>;
    draftArtifactType: string | null;
    primaryKind: string;
    internalEngineOutput?: Record<string, unknown>;
    agentOutputs: Record<string, Record<string, unknown>>;
  }): Promise<{ internalEngineOutput?: Record<string, unknown>; hybridResult?: HybridAnalysisResult }> {
    const { planStep, decision, orchestration, draftArtifactType, primaryKind, internalEngineOutput, agentOutputs } = params;
    if (planStep.type === "engine" && planStep.target === "internal") {
      return {
        internalEngineOutput: await this.handleInternalPlanStep(planStep, decision, draftArtifactType, primaryKind),
      };
    }

    if (planStep.type === "engine" && planStep.target === "hybrid") {
      return {
        hybridResult: await this.handleHybridPlanStep(planStep, decision, primaryKind, draftArtifactType, internalEngineOutput),
      };
    }

    if (planStep.type === "agent") {
      await this.handleAgentPlanStep(planStep, orchestration, decision, internalEngineOutput, agentOutputs);
    }

    return {};
  }

  async execute(decision: DecisionObject, options?: { abortSignal?: AbortSignal }): Promise<LayerResult> {
    const startTime = Date.now();

    try {
      this.throwIfAborted(options?.abortSignal);
      const orchestration = decision.orchestration;
      if (!orchestration) {
        throw new Error("Missing orchestration plan");
      }

      // ---- IPLAN LAW (Layer 5 contract enforcement) ----
      const selectedEngines = this.asRecord(orchestration.selectedEngines);
      const primaryEngine = this.asRecord(selectedEngines.primary);
      const primaryKind = this.asString(primaryEngine.kind);
      const redactionMode = this.asString(orchestration.redactionMode);

      const rawInput = (decision.input?.rawInput || {}) as Record<string, unknown>;
      const normalizedInput = (decision.input?.normalizedInput || {}) as Record<string, unknown>;
      const parentDemandApproved = rawInput.parentDemandApproved === true
        || normalizedInput.parentDemandApproved === true;

      if (decision.policy?.result === "require_approval" || decision.policy?.approvalRequired) {
        // Inheritance: derivative artifact runs (BC / Requirements / EA / Strategic-Fit)
        // on a demand spine that has already cleared Layer 3 + Layer 7 governance must
        // not re-pause reasoning here. The route layer signals this via
        // input.{rawInput,normalizedInput}.parentDemandApproved.

        if (!parentDemandApproved) {
          const advisory = this.buildGovernanceApprovalAdvisory(decision);
          const auditEvent: AuditEvent = {
            id: randomUUID(),
            layer: 6,
            eventType: "reasoning_pending_approval",
            eventData: {
              policyApprovalRequired: true,
              policyApprovalReasons: decision.policy?.approvalReasons || [],
              agentsExecuted: 0,
              optionsGenerated: advisory.options.length,
            },
            actorType: "system",
            timestamp: new Date().toISOString(),
            durationMs: Date.now() - startTime,
          };

          logger.info("[Layer 6] Reasoning paused: Layer 3 requires human governance approval before agents execute");

          return {
            success: true,
            layer: 6,
            status: "validation",
            data: advisory,
            shouldContinue: true,
            auditEvent,
          };
        }

        logger.info("[Layer 6] Inherited parent demand approval — proceeding with reasoning despite Layer 3 require_approval");
      }

      this.validateReasoningPreconditions(decision, primaryKind, redactionMode, { parentDemandApproved });

      let internalEngineOutput: Record<string, unknown> | undefined;
      let hybridResult: HybridAnalysisResult | undefined;
      const agentOutputs: Record<string, Record<string, unknown>> = {};
      const draftArtifactType = this.resolveArtifactType(orchestration.agentPlanPolicy?.useCaseKey);

      const executionPlan = orchestration.executionPlan || [];
      const sortedPlan = [...executionPlan].sort((a, b) => a.step - b.step);

      for (const planStep of sortedPlan) {
        this.throwIfAborted(options?.abortSignal);
        const stepResult = await this.runPlanStep({
          planStep,
          decision,
          orchestration,
          draftArtifactType,
          primaryKind,
          internalEngineOutput,
          agentOutputs,
        });
        if (stepResult.internalEngineOutput) {
          internalEngineOutput = stepResult.internalEngineOutput;
        }
        if (stepResult.hybridResult) {
          hybridResult = stepResult.hybridResult;
        }
      }

      const advisory = this.buildAdvisoryPackage(
        decision,
        internalEngineOutput,
        hybridResult,
        agentOutputs
      );

      // ---- Draft Artifact Versioning (Layer 6 output) ----
      const draftTelemetry = await this.tryPersistDraftArtifact(decision, internalEngineOutput, agentOutputs, advisory, options?.abortSignal);

      const auditEvent: AuditEvent = {
        id: randomUUID(),
        layer: 6,
        eventType: "reasoning_completed",
        eventData: {
          usedInternalEngine: !!internalEngineOutput || draftTelemetry.usedInternalEngine,
          usedHybridEngine: !!hybridResult || draftTelemetry.usedHybridEngine,
          hybridStatus: hybridResult?.status || draftTelemetry.hybridStatus,
          agentsExecuted: Object.keys(agentOutputs).length,
          optionsGenerated: advisory.options.length,
          risksIdentified: advisory.risks.length,
          ragDocumentsFound: (internalEngineOutput?.rag as Record<string, unknown> | undefined)?.totalDocuments || 0,
          patternsSimilarDecisions: (internalEngineOutput?.patterns as Record<string, unknown> | undefined)?.similarDecisions || 0,
        },
        actorType: "system",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      logger.info(`[Layer 6] Advisory Package: ${advisory.options.length} options, ${advisory.risks.length} risks, confidence: ${advisory.overallConfidence}`);

      return {
        success: true,
        layer: 6,
        status: "validation",
        data: advisory,
        shouldContinue: true,
        auditEvent,
      };
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : "Unknown error";
      const errStack = error instanceof Error ? error.stack : undefined;
      logger.error(`[Layer 6] Reasoning failed: ${errMessage}`, { stack: errStack });
      const auditEvent: AuditEvent = {
        id: randomUUID(),
        layer: 6,
        eventType: "reasoning_failed",
        eventData: {
          error: errMessage,
        },
        actorType: "system",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };

      return {
        success: false,
        layer: 6,
        status: "blocked",
        error: errMessage,
        shouldContinue: false,
        auditEvent,
      };
    }
  }

  private resolveArtifactType(useCaseKey: string | undefined): string | null {
    return useCaseKey ? ARTIFACT_TYPE_BY_USE_CASE[useCaseKey] ?? null : null;
  }

  private buildInternalDraftArtifact(params: InternalDraftArtifactParams): Record<string, unknown> {
    const input = this.asRecord(params.decision.input?.normalizedInput || params.decision.input?.rawInput);
    const title = this.firstString([input.projectName, input.suggestedProjectName, input.title], "Untitled");
    const objective = this.firstString([input.businessObjective, input.description]);

    const assistantAndRagDraft = this.buildAssistantAndRagDraftArtifact(params, input);
    if (assistantAndRagDraft) {
      return assistantAndRagDraft;
    }

    const knowledgeDraft = this.buildKnowledgeDraftArtifact(params, input);
    if (knowledgeDraft) {
      return knowledgeDraft;
    }

    const demandAndDocumentDraft = this.buildDemandAndDocumentDraftArtifact(params, input, title, objective);
    if (demandAndDocumentDraft) {
      return demandAndDocumentDraft;
    }

    const researchAndEvaluationDraft = this.buildResearchAndEvaluationDraftArtifact(params, input, title);
    if (researchAndEvaluationDraft) {
      return researchAndEvaluationDraft;
    }

    if (params.artifactType === "BUSINESS_CASE") {
      return this.buildBusinessCaseArtifact(params, input, title, objective);
    }

    if (params.artifactType === "WBS") {
      return this.buildWbsArtifact(params, input, title);
    }

    return this.buildDefaultDraftArtifact(params, title, objective);
  }

  private buildDraftOutputSchemaId(artifactType: string, outputSchemaId: string): string {
    return outputSchemaId || `artifact.${artifactType.toLowerCase()}.v1`;
  }

  private buildAdvisoryDraftContent(params: {
    decision: DecisionObject;
    artifactType: string;
    outputSchemaId: string;
    advisory: AdvisoryData;
    internalOutput?: Record<string, unknown>;
    agentOutputs: Record<string, Record<string, unknown>>;
  }): Record<string, unknown> {
    return this.buildInternalDraftArtifact({
      decision: params.decision,
      artifactType: params.artifactType,
      outputSchemaId: params.outputSchemaId,
      advisory: params.advisory,
      internalOutput: params.internalOutput,
      agentOutputs: params.agentOutputs,
    });
  }

  private getCompletedAgentResult(
    agentOutputs: Record<string, Record<string, unknown>> | undefined,
    agentId: string,
  ): Record<string, unknown> | undefined {
    const output = agentOutputs?.[agentId];
    return output?.status === "completed" ? output.result as Record<string, unknown> | undefined : undefined;
  }

  private buildAssistantAndRagDraftArtifact(
    params: InternalDraftArtifactParams,
    input: Record<string, unknown>,
  ): Record<string, unknown> | null {
    switch (params.artifactType) {
      case "ASSISTANT_TOOL_PLAN":
        return { artifactType: params.artifactType, toolCalls: [], meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "ASSISTANT_RESPONSE":
        return { artifactType: params.artifactType, response: "Right — I can help. What would you like me to check first?", meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "RAG_QUERY_EXPANSION": {
        const query = this.firstString([input.query, input.promptSeed, input.userQuery]);
        return { artifactType: params.artifactType, original: query, variations: query ? [query] : [], keywords: [], governmentTerms: [], meta: this.buildArtifactMeta(params.outputSchemaId) };
      }
      case "RAG_QUERY_REWRITE": {
        const query = this.firstString([input.query, input.original, input.promptSeed]);
        return { artifactType: params.artifactType, original: query, rewritten: query, expansions: [], intent: this.firstString([input.intent], "exploratory"), subQueries: [], confidence: 0.5, meta: this.buildArtifactMeta(params.outputSchemaId) };
      }
      case "RAG_CLASSIFICATION":
        return { artifactType: params.artifactType, domains: ["general"], confidence: 0.5, meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "RAG_RERANK":
        return { artifactType: params.artifactType, scores: [], meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "RAG_CONFLICT":
        return { artifactType: params.artifactType, sentiment: { score: 0.5, label: "neutral" }, hasContradiction: false, severity: "low", description: "", meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "RAG_SYNTHESIS_SUMMARY":
        return { artifactType: params.artifactType, summary: "", meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "RAG_ANSWER":
        return { artifactType: params.artifactType, content: "", meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "VENDOR_PROPOSAL_SUMMARY": {
        const excerpt = this.firstString([input.proposalTextExcerpt, input.extractedText]);
        const summarySuffix = excerpt.length > 1200 ? "…" : "";
        return { artifactType: params.artifactType, summary: excerpt ? `${excerpt.substring(0, 1200)}${summarySuffix}` : "", highlights: [], meta: this.buildArtifactMeta(params.outputSchemaId) };
      }
      default:
        return null;
    }
  }

  private buildKnowledgeDraftArtifact(
    params: InternalDraftArtifactParams,
    input: Record<string, unknown>,
  ): Record<string, unknown> | null {
    const advisoryConfidence = (params.advisory.overallConfidence || 0) / 100;
    switch (params.artifactType) {
      case "KNOWLEDGE_GRAPH_EXTRACTION":
        return { artifactType: params.artifactType, entities: [], relationships: [], documentId: this.firstString([input.documentId]), meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "EXECUTIVE_BRIEFING":
        return { artifactType: params.artifactType, executiveSummary: params.advisory.options?.[0]?.description || "", keyFindings: [], trends: [], recommendations: [], riskAlerts: [], confidenceScore: advisoryConfidence, meta: this.buildArtifactMeta(params.outputSchemaId, advisoryConfidence) };
      case "KNOWLEDGE_GAP_ANALYSIS":
        return { artifactType: params.artifactType, gapAnalysis: [], meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "PROACTIVE_INSIGHTS":
        return { artifactType: params.artifactType, insights: [], meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "VERSION_IMPACT_ANALYSIS":
        return { artifactType: params.artifactType, summary: "AI impact analysis unavailable (fallback)", impact: "", risk: "low", recommendations: [], meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "DAILY_INTELLIGENCE_BRIEFING":
        return { artifactType: params.artifactType, summary: "", criticalAlerts: [], topRisks: [], recommendations: [], actionItems: [], meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "REASONING_TRACE":
        return {
          artifactType: params.artifactType,
          answer: params.advisory.options?.[0]?.description || "",
          reasoningTrace: {
            id: `trace_${Date.now()}`,
            query: this.firstString([input.query, input.intent]),
            model: "sovereign_fallback",
            steps: [],
            finalAnswer: params.advisory.options?.[0]?.description || "",
            totalTokens: 0,
            durationMs: 0,
            timestamp: new Date().toISOString(),
          },
          confidence: advisoryConfidence,
          meta: this.buildArtifactMeta(params.outputSchemaId, advisoryConfidence),
        };
      default:
        return null;
    }
  }

  private buildDemandFieldsDraftArtifact(
    params: InternalDraftArtifactParams,
    title: string,
    objective: string,
  ): Record<string, unknown> {
    const demandAgent = this.getCompletedAgentResult(params.agentOutputs, "demand_agent");
    const input = this.asRecord(params.decision.input?.normalizedInput || params.decision.input?.rawInput);
    const additionalContext = this.asRecord(input.additionalContext);
    const sourceContext = this.asRecord(input.sourceContext);
    const resolvedDepartment = this.firstString([
      input.department,
      additionalContext.department,
      sourceContext.department,
      demandAgent?.department,
    ]);
    const resolvedOrganizationName = this.firstString([
      input.organizationName,
      input.organization,
      additionalContext.organizationName,
      additionalContext.organization,
      sourceContext.organizationName,
      sourceContext.organization,
    ]);

    const replaceGenericDepartment = (value: string): string => {
      if (!value || !resolvedDepartment || resolvedDepartment === "Operations") {
        return value;
      }
      return value.replace(/\bOperations\b/g, resolvedDepartment);
    };

    const mapDepartmentStrings = (values: unknown): string[] => Array.isArray(values)
      ? values.map((entry) => replaceGenericDepartment(this.asString(entry))).filter(Boolean)
      : [];

    return {
      artifactType: params.artifactType,
      organizationName: resolvedOrganizationName,
      department: resolvedDepartment,
      enhancedBusinessObjective: this.firstString([demandAgent?.enhancedBusinessObjective, objective]),
      suggestedProjectName: this.firstString([demandAgent?.suggestedProjectName, title]),
      currentChallenges: replaceGenericDepartment(this.firstString([
        demandAgent?.currentChallenges,
        objective ? `Current operational challenges related to: ${objective.substring(0, 240)}` : "",
      ])),
      expectedOutcomes: mapDepartmentStrings(demandAgent?.expectedOutcomes),
      successCriteria: mapDepartmentStrings(demandAgent?.successCriteria),
      timeframe: this.firstString([demandAgent?.timeframe]),
      stakeholders: mapDepartmentStrings(demandAgent?.stakeholders),
      riskFactors: mapDepartmentStrings(demandAgent?.riskFactors),
      constraints: mapDepartmentStrings(demandAgent?.constraints),
      integrationRequirements: mapDepartmentStrings(demandAgent?.integrationRequirements),
      complianceRequirements: mapDepartmentStrings(demandAgent?.complianceRequirements),
      existingSystems: Array.isArray(demandAgent?.existingSystems) ? demandAgent.existingSystems : [],
      assumptions: Array.isArray(demandAgent?.assumptions) ? demandAgent.assumptions : [],
      requestType: this.firstString([demandAgent?.requestType], "demand"),
      classificationConfidence: typeof demandAgent?.classificationConfidence === "number" ? demandAgent.classificationConfidence : undefined,
      classificationReasoning: this.firstString([demandAgent?.classificationReasoning]),
      meta: {
        ...this.buildArtifactMeta(params.outputSchemaId, 0.2),
        fallback: false,
      },
    };
  }

  private buildDemandAndDocumentDraftArtifact(
    params: InternalDraftArtifactParams,
    input: Record<string, unknown>,
    title: string,
    objective: string,
  ): Record<string, unknown> | null {
    switch (params.artifactType) {
      case "TEAM_RECOMMENDATION":
        return {
          artifactType: params.artifactType,
          summary: { totalRoles: 0, totalHeadcount: 0, totalFTEMonths: 0, criticalRoles: 0, resourceGaps: 0, overallReadiness: "needs_attention" },
          teamStructure: { leadership: [], core: [], support: [], external: [], equipment: [] },
          resourceGaps: [],
          recommendations: { immediate: [], shortTerm: [], contingency: [] },
          riskAssessment: { overallRisk: "medium", factors: [] },
          meta: this.buildArtifactMeta(params.outputSchemaId),
        };
      case "DEMAND_FIELDS": {
        return this.buildDemandFieldsDraftArtifact(params, title, objective);
      }
      case "BUSINESS_CASE_CLARIFICATIONS":
        return { artifactType: params.artifactType, clarifications: [], completenessScore: 0, needsClarifications: false, meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "DEMAND_OBJECTIVE_ENHANCEMENT":
        return { artifactType: params.artifactType, enhancedObjective: objective, improvements: ["fallback"], clarityScore: 5, meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "DEMAND_REQUEST_CLASSIFICATION":
        return { artifactType: params.artifactType, requestType: "demand", confidence: 0.25, reasoning: "fallback", meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "DEMAND_COMPREHENSIVE_ANALYSIS":
        return { artifactType: params.artifactType, requestId: this.firstString([input.id, input.requestId]), analysisTypes: { complaintAnalysis: {}, demandAnalysis: {}, imsAnalysis: {}, innovationOpportunities: {} }, generatedAt: new Date().toISOString(), meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "DOCUMENT_CLASSIFICATION":
        return {
          artifactType: params.artifactType,
          category: { primary: "General Administration", confidence: 0.25, alternatives: [] },
          tags: [],
          language: { detected: "English", confidence: 0.5, isMultilingual: false },
          documentType: { type: "Document", subtype: "", confidence: 0.25 },
          summary: "",
          keyEntities: [],
          suggestedFolder: undefined,
          folderPath: undefined,
          classificationId: undefined,
          subfolder: undefined,
          categoryId: undefined,
          meta: this.buildArtifactMeta(params.outputSchemaId),
        };
      case "DOCUMENT_SUMMARY":
        return { artifactType: params.artifactType, summary: "", meta: this.buildArtifactMeta(params.outputSchemaId) };
      default:
        return null;
    }
  }

  private buildResearchAndEvaluationDraftArtifact(
    params: InternalDraftArtifactParams,
    input: Record<string, unknown>,
    title: string,
  ): Record<string, unknown> | null {
    switch (params.artifactType) {
      case "MARKET_RESEARCH":
        return {
          artifactType: params.artifactType,
          projectContext: { focusArea: title, keyObjectives: [], targetCapabilities: [] },
          globalMarket: { marketSize: "", growthRate: "", keyTrends: [], topCountries: [], majorPlayers: [], technologyLandscape: [] },
          uaeMarket: { marketSize: "", growthRate: "", governmentInitiatives: [], localPlayers: [], opportunities: [], regulatoryConsiderations: [] },
          suppliers: [],
          useCases: [],
          competitiveAnalysis: { directCompetitors: [], indirectCompetitors: [], marketGaps: [] },
          recommendations: [],
          riskFactors: [],
          generatedAt: new Date().toISOString(),
          meta: this.buildArtifactMeta(params.outputSchemaId),
        };
      case "VALIDATION_ASSIST":
        return { artifactType: params.artifactType, output: "", corrections: [], consistency: { hasContradictions: false, contradictions: [] }, meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "VENDOR_EVALUATION_SCORES":
        return { artifactType: params.artifactType, scores: [], overallStrengths: [], overallWeaknesses: [], riskFactors: [], recommendation: "", meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "VENDOR_EVALUATION_SUMMARY":
        return { artifactType: params.artifactType, executiveSummary: "", topRecommendation: "", differentiators: [], concerns: [], meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "RISK_EVIDENCE_VERIFICATION":
        return { artifactType: params.artifactType, overallScore: 0, relevanceScore: 0, completenessScore: 0, qualityScore: 0, verdict: "INSUFFICIENT", findings: [], recommendations: [], riskFlags: [], mitigationAlignment: "LOW", meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "EVIDENCE_EVALUATION":
        return { artifactType: params.artifactType, completenessScore: 0, qualityScore: 0, relevanceScore: 0, overallScore: 0, findings: [], recommendations: [], riskFlags: [], complianceNotes: [], meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "TASK_COMPLETION_GUIDANCE":
        return { artifactType: params.artifactType, taskSnapshot: {}, strategicInsights: [], completionScore: 0, nextActions: [], riskAlerts: [], enablementToolkit: [], accelerationPlaybook: [], meta: this.buildArtifactMeta(params.outputSchemaId) };
      case "TRANSLATION":
        return { artifactType: params.artifactType, translatedText: this.firstString([input.text]), originalText: this.firstString([input.text]), from: this.firstString([input.from]), to: this.firstString([input.to]), meta: this.buildArtifactMeta(params.outputSchemaId) };
      default:
        return null;
    }
  }

  private buildWbsArtifact(
    params: InternalDraftArtifactParams,
    input: Record<string, unknown>,
    title: string,
  ): Record<string, unknown> {
    // Consume the rich cost-aware output of the wbs_builder agent and shape
    // it to match the artifact.wbs.v1 schema expected by the normalizer.
    //
    // The wbs_builder (see brain/agents/agent-runtime.ts) produces either:
    //   • Cost-aware output: { implementationPhases: [{ name, description,
    //     durationMonths, deliverables, tasks, workPackages: [{ name,
    //     costAnchor, plannedCost, deliverables, tasks, ... }], plannedCost,
    //     owner, status }], milestones, totalPlannedCost, costReconciliation,
    //     sustainment }
    //   • Fallback template: same shape, no workPackages or cost fields.
    //
    // We map implementationPhases → phases[] with stable ids (WBS-<idx>), and
    // for each phase emit its workPackages as children so the downstream
    // adapter (normalizeBrainWbsArtifactToGeneratedTasks) produces a real,
    // multi-level WBS rather than a single summary task.
    const wbsAgent = this.getCompletedAgentResult(params.agentOutputs, "wbs_builder");
    const phasesSrc = Array.isArray(wbsAgent?.implementationPhases)
      ? (wbsAgent!.implementationPhases as Array<Record<string, unknown>>)
      : [];
    const milestonesSrc = Array.isArray(wbsAgent?.milestones)
      ? (wbsAgent!.milestones as Array<Record<string, unknown>>)
      : [];

    const phases = phasesSrc.map((p, idx) => {
      const phaseId = `WBS-${idx + 1}`;
      const durationMonths = this.asNumber(p.durationMonths) || 2;
      const workPackagesSrc = Array.isArray(p.workPackages) ? (p.workPackages as Array<Record<string, unknown>>) : [];
      const workPackages = workPackagesSrc.length > 0
        ? workPackagesSrc.map((wp, wIdx) => ({
            id: `${phaseId}.${wIdx + 1}`,
            name: this.firstString([wp.name], `Work Package ${wIdx + 1}`),
            description: this.firstString([wp.description], ""),
            deliverables: Array.isArray(wp.deliverables) ? wp.deliverables : [],
            estimatedEffort: this.firstString([wp.estimatedEffort], `${Math.max(1, Math.round(durationMonths * 10))} person-days`),
            dependencies: Array.isArray(wp.dependencies) ? wp.dependencies : [],
            assignedRole: this.firstString([wp.assignedRole, p.owner], "Delivery Team"),
            costAnchor: this.firstString([wp.costAnchor], ""),
            plannedCost: this.asNumber(wp.plannedCost),
            tasks: Array.isArray(wp.tasks) ? wp.tasks : [],
          }))
        : // No explicit workPackages → synthesize a single wrapper WP so the
          // adapter still emits a real phase.
          [
            {
              id: `${phaseId}.1`,
              name: this.firstString([p.name], `Phase ${idx + 1}`),
              description: this.firstString([p.description], ""),
              deliverables: Array.isArray(p.deliverables) ? p.deliverables : [],
              estimatedEffort: `${Math.max(1, Math.round(durationMonths * 10))} person-days`,
              dependencies: [],
              assignedRole: this.firstString([p.owner], "Delivery Team"),
              costAnchor: "",
              plannedCost: this.asNumber(p.plannedCost),
              tasks: Array.isArray(p.tasks) ? p.tasks : [],
            },
          ];

      return {
        id: phaseId,
        name: this.firstString([p.name], `Phase ${idx + 1}`),
        description: this.firstString([p.description], ""),
        duration: `${durationMonths} months`,
        durationMonths,
        deliverables: Array.isArray(p.deliverables) ? p.deliverables : [],
        tasks: Array.isArray(p.tasks) ? p.tasks : [],
        workPackages,
        plannedCost: this.asNumber(p.plannedCost),
        owner: this.firstString([p.owner], "PMO"),
        status: this.firstString([p.status], "pending"),
      };
    });

    const milestones = milestonesSrc.map((m) => ({
      name: this.firstString([m.name], "Milestone"),
      phase: this.firstString([m.phase], ""),
      targetDate: this.firstString([m.targetDate], ""),
      targetMonth: this.asNumber(m.targetMonth) || undefined,
      criteria: this.firstString([m.criteria], ""),
    }));

    const totalMonths = phases.reduce((s, p) => s + (typeof p.durationMonths === "number" ? p.durationMonths : 0), 0);
    const totalPlanned = this.asNumber(wbsAgent?.totalPlannedCost)
      || phases.reduce((s, p) => s + (typeof p.plannedCost === "number" ? p.plannedCost : 0), 0);

    // Derive the critical path from the cost-aware plan:
    //  1. Every implementation phase sits on the sequential backbone, so every
    //     phase id is critical (phase → phase dependency is a hard barrier).
    //  2. Inside each phase, the work package with the largest plannedCost is
    //     the schedule-critical leaf (cost typically correlates with effort /
    //     duration in a cost-anchored WBS). If all costs are zero we fall back
    //     to the first work package so the phase still has at least one
    //     critical leaf downstream.
    // These ids match the scheme emitted above (`WBS-<idx>` / `WBS-<idx>.<n>`)
    // which is what wbsBrainArtifactService consumes via criticalPathIds.
    const criticalPath: string[] = [];
    phases.forEach((phase) => {
      criticalPath.push(String(phase.id));
      const wps = Array.isArray(phase.workPackages) ? phase.workPackages : [];
      if (wps.length === 0) return;
      let leader = wps[0]!;
      let leaderCost = typeof leader.plannedCost === "number" ? leader.plannedCost : 0;
      for (const wp of wps) {
        const cost = typeof wp.plannedCost === "number" ? wp.plannedCost : 0;
        if (cost > leaderCost) {
          leader = wp;
          leaderCost = cost;
        }
      }
      criticalPath.push(String(leader.id));
    });

    return {
      artifactType: "WBS",
      projectName: title,
      phases,
      milestones,
      criticalPath,
      totalEstimatedDuration: totalMonths > 0 ? `${totalMonths} months` : "",
      totalEstimatedEffort: "",
      totalPlannedCost: totalPlanned,
      costReconciliation: (wbsAgent?.costReconciliation as Record<string, unknown> | undefined) ?? undefined,
      sustainment: (wbsAgent?.sustainment as Record<string, unknown> | undefined) ?? undefined,
      meta: this.buildArtifactMeta(params.outputSchemaId, 0.82),
    };
  }

  private buildDefaultDraftArtifact(
    params: InternalDraftArtifactParams,
    title: string,
    objective: string,
  ): Record<string, unknown> {
    return {
      artifactType: params.artifactType,
      title,
      objective,
      summary: params.advisory.options?.[0]?.description || "",
      assumptions: params.advisory.assumptions?.map((assumption) => assumption.assumption) || [],
      risks: params.advisory.risks || [],
      evidence: params.advisory.evidence || [],
      meta: {
        ...this.buildArtifactMeta(params.outputSchemaId, (params.advisory.overallConfidence || 0) / 100),
        fallback: undefined,
      },
    };
  }

  private buildBusinessCaseContext(
    params: InternalDraftArtifactParams,
    input: Record<string, unknown>,
    title: string,
    objective: string,
  ): BusinessCaseContext {
    const budgetRange = this.firstString([input.budgetRange, input.estimatedBudget]);
    const department = this.firstString([input.department], "General");
    const orgName = this.firstString([input.organizationName, input.organization]).trim();
    const advisoryOptions = params.advisory.options || [];
    const financialAgent = this.getCompletedAgentResult(params.agentOutputs, "financial_assist");
    const alignmentAgent = this.getCompletedAgentResult(params.agentOutputs, "alignment_scoring");
    const complianceAgent = this.getCompletedAgentResult(params.agentOutputs, "controls");
    const totalCost = this.asNumber(financialAgent?.totalInvestment);
    let effectiveTotalCost = totalCost > 0 ? totalCost : this.parseBudgetAmount(budgetRange);
    // When no budget is provided and the financial agent didn't return one,
    // fall back to a sensible default so downstream calcs never see 0.
    if (effectiveTotalCost <= 0) {
      effectiveTotalCost = 5_000_000;
    }
    const totalBenefits = this.asNumber(financialAgent?.totalBenefits);
    const npv = this.asNumber(financialAgent?.npv);
    const roi = this.asNumber(financialAgent?.roi);
    const payback = this.asNumber(financialAgent?.paybackPeriod);
    const overallAlignment = this.asNumber(alignmentAgent?.overallAlignment);
    const complianceScore = this.asNumber(complianceAgent?.complianceScore);

    return {
      title,
      objective,
      budgetRange,
      department,
      orgLabel: orgName || "The requesting entity",
      requestorName: this.firstString([input.requestorName]),
      estimatedTimeline: this.firstString([input.estimatedTimeline]),
      demandStakeholders: this.firstString([input.stakeholders]),
      currentChallenges: this.firstString([input.currentChallenges]),
      expectedOutcomes: this.firstString([input.expectedOutcomes]),
      successCriteria: this.firstString([input.successCriteria]),
      constraints: this.firstString([input.constraints]),
      riskFactors: this.firstString([input.riskFactors]),
      existingSystems: this.firstString([input.existingSystems]),
      integrationRequirements: this.firstString([input.integrationRequirements]),
      complianceRequirements: this.firstString([input.complianceRequirements]),
      urgency: this.firstString([input.urgency], "Medium"),
      advisoryOptions,
      financialAgent,
      riskAgent: this.getCompletedAgentResult(params.agentOutputs, "risk_controls"),
      alignmentAgent,
      complianceAgent,
      projectManagerAgent: this.getCompletedAgentResult(params.agentOutputs, "project_manager"),
      wbsAgent: this.getCompletedAgentResult(params.agentOutputs, "wbs_builder"),
      dependencyAgent: this.getCompletedAgentResult(params.agentOutputs, "dependency_agent"),
      resourceRoleAgent: this.getCompletedAgentResult(params.agentOutputs, "resource_role"),
      totalCost,
      effectiveTotalCost,
      totalBenefits,
      npv,
      roi,
      payback,
      investmentGrade: this.asString(financialAgent?.investmentGrade),
      overallAlignment,
      complianceScore,
      hasAgentData: totalCost > 0 || npv !== 0 || overallAlignment > 0 || complianceScore > 0,
    };
  }

  private buildAdvisoryRiskEntries(advisory: AdvisoryData): BusinessCaseRiskEntry[] {
    return (advisory.risks || []).map((risk, index) => ({
      name: risk.description || `Risk ${index + 1}`,
      severity: risk.impact || "medium",
      description: risk.description || "",
      probability: risk.likelihood || "medium",
      impact: risk.impact || risk.description || "",
      mitigation: risk.mitigation || "",
      owner: null,
    }));
  }

  private buildAgentBusinessCaseRisks(riskAgent?: Record<string, unknown>): BusinessCaseRiskEntry[] {
    if (!riskAgent || !Array.isArray(riskAgent.identifiedRisks)) {
      return [];
    }
    return (riskAgent.identifiedRisks as Array<Record<string, unknown>>).map((risk) => ({
      name: this.firstString([risk.description, risk.category], "Risk"),
      severity: this.firstString([risk.impact], "medium"),
      description: this.firstString([risk.description]),
      probability: this.firstString([risk.likelihood], "medium"),
      impact: this.firstString([risk.impact], "medium"),
      mitigation: this.firstString([risk.mitigation]),
      owner: null,
    }));
  }

  private buildDemandBusinessCaseRisks(
    riskFactors: string,
    advisoryRisks: BusinessCaseRiskEntry[],
    agentRisks: BusinessCaseRiskEntry[],
  ): BusinessCaseRiskEntry[] {
    if (!riskFactors) {
      return [];
    }
    const demandRisks: BusinessCaseRiskEntry[] = [];
    const riskLines = riskFactors.split(/[;\n]+/).map((line) => line.trim()).filter(Boolean);
    riskLines.forEach((line, index) => {
      if (!advisoryRisks.some((risk) => risk.description === line) && !agentRisks.some((risk) => risk.description === line)) {
        demandRisks.push({
          name: `Demand Risk ${index + 1}`,
          severity: "medium",
          description: line,
          probability: "medium",
          impact: "medium",
          mitigation: "Risk assessment and mitigation plan to be developed",
          owner: null,
        });
      }
    });
    return demandRisks;
  }

  private buildStandardBusinessCaseRisks(context: BusinessCaseContext): BusinessCaseRiskEntry[] {
    const technicalRiskDetails = [
      `Technical complexity and integration challenges for ${context.title}`,
      context.existingSystems ? `. Existing systems: ${context.existingSystems}` : "",
      context.integrationRequirements ? `. Integration needs: ${context.integrationRequirements}` : "",
    ].join("");
    const scheduleRiskEstimated = context.estimatedTimeline ? ` (estimated: ${context.estimatedTimeline})` : "";
    const financialRiskRange = context.budgetRange ? ` within ${context.budgetRange} range` : "";
    const financialRiskConstraints = context.constraints ? `. Constraints: ${context.constraints}` : "";
    const complianceRiskRequirements = context.complianceRequirements ? `. Requirements: ${context.complianceRequirements}` : "";
    return [
      { name: "Technical Risk", severity: "medium", description: technicalRiskDetails, probability: "medium", impact: "high", mitigation: "Technical proof of concept, phased implementation, and rollback procedures", owner: null },
      { name: "Schedule Risk", severity: context.urgency === "Critical" || context.urgency === "High" ? "high" : "medium", description: `Project delivery timeline risk${scheduleRiskEstimated}. Urgency: ${context.urgency}`, probability: "medium", impact: "high", mitigation: "Agile delivery methodology with sprint buffers, clear milestone tracking, and early warning indicators", owner: null },
      { name: "Resource Risk", severity: "medium", description: `Availability of skilled resources and key personnel across ${context.department} and IT teams`, probability: "medium", impact: "medium", mitigation: "Cross-training, knowledge transfer plans, and vendor resource guarantees", owner: null },
      { name: "Organizational Change Risk", severity: "medium", description: `User adoption and organizational change management challenges within ${context.orgLabel}`, probability: "medium", impact: "medium", mitigation: "Structured change management program, executive sponsorship, and early user engagement", owner: null },
      { name: "Financial Risk", severity: context.budgetRange ? "low" : "medium", description: `Budget overrun and cost management risk${financialRiskRange}${financialRiskConstraints}`, probability: "low", impact: "high", mitigation: "Phased funding releases, monthly financial reviews, and contingency reserve (10-15%)", owner: null },
      { name: "Compliance & Regulatory Risk", severity: "medium", description: `Regulatory compliance with UAE government IT standards and data sovereignty requirements${complianceRiskRequirements}`, probability: "low", impact: "high", mitigation: "Compliance audit checkpoints, legal review at each phase gate, UAE data center hosting", owner: null },
      { name: "Vendor/Third-Party Risk", severity: "medium", description: "Dependency on external vendors for implementation, support, and service-level commitments", probability: "medium", impact: "medium", mitigation: "Multi-vendor evaluation, SLA contractual guarantees, and escrow arrangements", owner: null },
      { name: "Data Migration Risk", severity: "medium", description: "Data quality, completeness, and integrity risks during migration from legacy systems", probability: "medium", impact: "high", mitigation: "Data profiling and cleansing, parallel run validation, and rollback capability", owner: null },
    ];
  }

  private mergeBusinessCaseRisks(
    advisoryRisks: BusinessCaseRiskEntry[],
    agentRisks: BusinessCaseRiskEntry[],
    demandRisks: BusinessCaseRiskEntry[],
    standardRisks: BusinessCaseRiskEntry[],
  ): BusinessCaseRiskEntry[] {
    const allRisks = [...advisoryRisks, ...agentRisks.filter((risk) => !advisoryRisks.some((advisoryRisk) => advisoryRisk.description === risk.description))];
    demandRisks.forEach((risk) => {
      if (!allRisks.some((existingRisk) => existingRisk.description === risk.description)) {
        allRisks.push(risk);
      }
    });
    standardRisks.forEach((risk) => {
      if (!allRisks.some((existingRisk) => existingRisk.name === risk.name)) {
        allRisks.push(risk);
      }
    });
    return allRisks;
  }

  private calculateBusinessCaseRiskScore(allRisks: BusinessCaseRiskEntry[], roi: number, npv: number): number {
    let score = Math.min(allRisks.length * 4, 30);
    const severeRisks = allRisks.filter((risk) => risk.severity === "high" || risk.severity === "critical").length;
    score += Math.min(severeRisks * 8, 25);
    if (roi < -50) {
      score += 35;
    } else if (roi < -20) {
      score += 25;
    } else if (roi < 0) {
      score += 18;
    } else if (roi < 10) {
      score += 10;
    }
    if (npv < 0) {
      score += 10;
    } else if (npv === 0) {
      score += 5;
    }
    return Math.min(score, 100);
  }

  private resolveBusinessCaseImplementationPhases(context: BusinessCaseContext): Array<Record<string, unknown>> {
    if (Array.isArray(context.projectManagerAgent?.implementationPhases)) {
      return context.projectManagerAgent.implementationPhases as Array<Record<string, unknown>>;
    }
    if (Array.isArray(context.wbsAgent?.implementationPhases)) {
      return context.wbsAgent.implementationPhases as Array<Record<string, unknown>>;
    }
    return [
      { name: "Initiation & Planning", description: `Requirements gathering, stakeholder alignment, and detailed project planning for ${context.title}`, durationMonths: 2, deliverables: ["Project charter", "Detailed requirements document", "Solution architecture"], tasks: ["Stakeholder workshops", "Requirements analysis", "Vendor evaluation"], owner: context.department, status: "pending" },
      { name: "Design & Procurement", description: "Technical design, vendor selection, and procurement execution", durationMonths: 3, deliverables: ["Technical design document", "Procurement award", "Integration specifications"], tasks: ["Solution design", "RFP/tender process", "Contract negotiation"], owner: context.department, status: "pending" },
      { name: "Build & Configure", description: "Platform configuration, customization, data migration, and integration development", durationMonths: 4, deliverables: ["Configured platform", "Data migration scripts", "Integration interfaces"], tasks: ["Platform setup", "Data migration", "Integration development", "UAT preparation"], owner: context.department, status: "pending" },
      { name: "Test & Train", description: "User acceptance testing, training delivery, and go-live preparation", durationMonths: 2, deliverables: ["UAT sign-off", "Training completion certificates", "Go-live checklist"], tasks: ["UAT execution", "User training", "Change management"], owner: context.department, status: "pending" },
      { name: "Go-Live & Support", description: "Production deployment, hypercare support, and post-implementation review", durationMonths: 3, deliverables: ["Production deployment", "Post-implementation review", "Lessons learned report"], tasks: ["Go-live execution", "Hypercare support", "Performance monitoring"], owner: context.department, status: "pending" },
    ];
  }

  private resolveBusinessCaseDependencies(context: BusinessCaseContext): Array<Record<string, unknown>> {
    if (Array.isArray(context.projectManagerAgent?.dependencies)) {
      return context.projectManagerAgent.dependencies as Array<Record<string, unknown>>;
    }
    if (Array.isArray(context.dependencyAgent?.dependencies)) {
      return context.dependencyAgent.dependencies as Array<Record<string, unknown>>;
    }
    return [
      { name: "IT Infrastructure Readiness", description: `Required infrastructure upgrades and network connectivity for ${context.title}`, type: "internal", status: "pending", impact: "Critical path - blocks deployment phase", owner: "IT Department" },
      { name: "Stakeholder Availability", description: `Key stakeholders from ${context.department} available for workshops, UAT, and training`, type: "internal", status: "pending", impact: "Delays to requirements and testing phases", owner: context.department },
      { name: "Procurement Approval", description: "Government procurement and vendor selection process completion", type: "internal", status: "pending", impact: "Blocks build phase commencement", owner: "Procurement" },
    ];
  }

  private resolveBusinessCaseResourceRequirements(context: BusinessCaseContext): Record<string, unknown> {
    if (context.projectManagerAgent?.resourceRequirements) {
      return context.projectManagerAgent.resourceRequirements as Record<string, unknown>;
    }
    if (context.resourceRoleAgent?.resourceRequirements) {
      return context.resourceRoleAgent.resourceRequirements as Record<string, unknown>;
    }
    const estimatedExternalCost = context.budgetRange || (context.effectiveTotalCost > 0 ? `${context.effectiveTotalCost.toLocaleString()} AED` : "To be determined");
    return {
      internalTeam: { roles: ["Project Manager", "Business Analyst", "Solution Architect", "Change Manager", "Subject Matter Experts"], effort: "14-month implementation" },
      externalSupport: { expertise: ["Implementation Partner", "Technical Consultant", "Training Specialist"], estimatedCost: estimatedExternalCost },
      infrastructure: ["Cloud hosting environment (UAE data centers)", "Development and staging environments", "Integration middleware", "Security and monitoring tools"],
    };
  }

  private buildBusinessCaseStakeholderAnalysis(context: BusinessCaseContext, summary: string): Record<string, unknown> {
    const demandStakeholderList: Array<{ name: string; role: string; influence: string; interest: string; department: string; engagementStrategy: string }> = [];
    if (context.demandStakeholders) {
      try {
        const parsed = JSON.parse(context.demandStakeholders);
        if (Array.isArray(parsed)) {
          parsed.forEach((stakeholder: Record<string, unknown>) => {
            demandStakeholderList.push({
              name: this.firstString([stakeholder.name, stakeholder.title]),
              role: this.firstString([stakeholder.role, stakeholder.title], "Stakeholder"),
              influence: this.firstString([stakeholder.influence, stakeholder.power], "medium"),
              interest: this.firstString([stakeholder.interest], "high"),
              department: this.firstString([stakeholder.department], context.department),
              engagementStrategy: this.firstString([stakeholder.engagementStrategy, stakeholder.strategy], "Regular status updates and progress reports"),
            });
          });
        }
      } catch {
        context.demandStakeholders.split(/[,;\n]+/).map((value) => value.trim()).filter(Boolean).forEach((name) => {
          demandStakeholderList.push({ name, role: "Stakeholder", influence: "medium", interest: "high", department: context.department, engagementStrategy: "Regular status updates and engagement sessions" });
        });
      }
    }

    if (context.requestorName && !demandStakeholderList.some((stakeholder) => stakeholder.name === context.requestorName)) {
      demandStakeholderList.unshift({ name: context.requestorName, role: "Project Requestor", influence: "high", interest: "high", department: context.department, engagementStrategy: "Primary point of contact, weekly progress updates" });
    }

    const defaultStakeholders = [
      { name: "Project Sponsor", role: "Executive Sponsor", influence: "high", interest: "high", department: "Senior Leadership", engagementStrategy: "Regular steering committee updates" },
      { name: `${context.department} Director`, role: "Business Owner", influence: "high", interest: "high", department: context.department, engagementStrategy: "Weekly progress meetings and requirement sign-off" },
      { name: "IT Department Lead", role: "Technical Authority", influence: "high", interest: "medium", department: "Information Technology", engagementStrategy: "Architecture review and technical governance" },
      { name: "End Users", role: "System Users", influence: "low", interest: "high", department: context.department, engagementStrategy: "Change management communications and training" },
      { name: "Compliance Officer", role: "Regulatory Authority", influence: "high", interest: "medium", department: "Compliance", engagementStrategy: "Policy review and regulatory sign-off" },
      { name: "Finance Department", role: "Budget Authority", influence: "high", interest: "medium", department: "Finance", engagementStrategy: "Budget tracking and financial reporting" },
    ];
    const stakeholders = demandStakeholderList.length > 0
      ? [...demandStakeholderList, ...defaultStakeholders.filter((stakeholder) => !demandStakeholderList.some((demandStakeholder) => demandStakeholder.name.toLowerCase() === stakeholder.name.toLowerCase()))]
      : defaultStakeholders;
    return {
      stakeholders,
      analysis: summary,
      engagementStrategy: "Multi-channel engagement: steering committee (monthly), working group (weekly), all-hands updates (quarterly)",
    };
  }

  private buildBusinessCaseAssumptions(context: BusinessCaseContext, advisory: AdvisoryData): Array<Record<string, unknown>> {
    const assumptions = (advisory.assumptions || []).map((assumption) => ({
      assumption: assumption.assumption,
      name: assumption.assumption,
      description: assumption.assumption,
      impact: "Medium",
      likelihood: "Medium",
      confidence: "medium",
      owner: null,
      status: "active",
    }));
    if (assumptions.length >= 3) {
      return assumptions;
    }
    const defaults = [
      { assumption: `${context.orgLabel} will provide dedicated project stakeholders and subject matter experts`, name: "Stakeholder Availability", description: "Project stakeholders and SMEs will be available as required", impact: "High", likelihood: "Medium", confidence: "medium", owner: null, status: "active" },
      { assumption: `Existing IT infrastructure meets minimum requirements for ${context.title}`, name: "Infrastructure Readiness", description: "Current IT infrastructure supports the proposed solution", impact: "High", likelihood: "High", confidence: "medium", owner: null, status: "active" },
      { assumption: `Required government approvals and procurement processes will follow standard timelines`, name: "Procurement Timeline", description: "Standard procurement timelines will apply", impact: "Medium", likelihood: "Medium", confidence: "medium", owner: null, status: "active" },
      { assumption: `End users will participate in training and change management activities`, name: "User Adoption", description: "Users will engage with training programs", impact: "High", likelihood: "High", confidence: "medium", owner: null, status: "active" },
      { assumption: `Third-party vendors will meet SLA commitments and delivery timelines`, name: "Vendor Commitments", description: "Vendors will deliver as committed", impact: "Medium", likelihood: "Medium", confidence: "medium", owner: null, status: "active" },
    ];
    defaults.forEach((assumption) => {
      if (!assumptions.some((existingAssumption) => existingAssumption.name === assumption.name)) {
        assumptions.push(assumption);
      }
    });
    return assumptions;
  }

  private buildBusinessCaseRecommendations(
    context: BusinessCaseContext,
    allRisks: BusinessCaseRiskEntry[],
    recommendationSummary: string,
  ): Record<string, unknown> {
    return {
      primaryRecommendation: context.npv > 0 ? "INVEST" : (context.advisoryOptions[0]?.description || ""),
      summary: recommendationSummary,
      justification: "",
      keyFindings: [
        ...(context.npv > 0 ? [`Positive NPV of ${context.npv.toLocaleString()} AED`] : []),
        ...(context.roi > 15 ? [`Strong ROI of ${context.roi}%`] : []),
        ...(context.overallAlignment > 70 ? [`Strategic alignment at ${context.overallAlignment}%`] : []),
        ...(context.complianceScore > 80 ? [`Compliance score: ${context.complianceScore}%`] : []),
        ...(allRisks.length > 0 ? [`${allRisks.length} risks identified with mitigations`] : []),
      ],
      nextSteps: [
        "Secure executive approval and budget allocation",
        "Initiate procurement process for technology platform and implementation partner",
        "Establish project governance structure and assign dedicated project team",
        "Conduct detailed requirements workshops with key stakeholders",
      ],
    };
  }

  private buildBusinessCaseArtifact(
    params: InternalDraftArtifactParams,
    input: Record<string, unknown>,
    title: string,
    objective: string,
  ): Record<string, unknown> {
    const context = this.buildBusinessCaseContext(params, input, title, objective);
    const advisoryRisks = this.buildAdvisoryRiskEntries(params.advisory);
    const agentRisks = this.buildAgentBusinessCaseRisks(context.riskAgent);
    const demandRisks = this.buildDemandBusinessCaseRisks(context.riskFactors, advisoryRisks, agentRisks);
    const standardRisks = this.buildStandardBusinessCaseRisks(context);
    const allRisks = this.mergeBusinessCaseRisks(advisoryRisks, agentRisks, demandRisks, standardRisks);
    const calculatedRiskScore = this.calculateBusinessCaseRiskScore(allRisks, context.roi, context.npv);
    const summaryData = this.buildBusinessCaseSummaryData(context);
    const budgetConstraints = this.buildBusinessCaseBudgetConstraints(context);
    const implementationPhases = this.resolveBusinessCaseImplementationPhases(context);
    const dependencies = this.resolveBusinessCaseDependencies(context);
    const resourceRequirements = this.resolveBusinessCaseResourceRequirements(context);
    const stakeholderSummary = this.buildBusinessCaseStakeholderSummary(context);
    const recommendationSummary = this.buildBusinessCaseRecommendationSummary(context);
    return {
      artifactType: params.artifactType,
      projectTitle: context.title,
      executiveSummary: context.hasAgentData ? summaryData.executiveSummaryWithAgentData : summaryData.executiveSummaryFallback,
      backgroundContext: summaryData.backgroundContext,
      problemStatement: context.currentChallenges || context.objective || "Business problem statement pending detailed analysis.",
      businessRequirements: summaryData.businessRequirements,
      solutionOverview: context.advisoryOptions[0]?.description || "",
      proposedSolution: context.advisoryOptions[0]?.description || "",
      alternativeSolutions: context.advisoryOptions.slice(1, 4).map((option) => option.description || option.name || ""),
      smartObjectives: this.buildBusinessCaseSmartObjectives(context),
      scopeDefinition: this.buildBusinessCaseScopeDefinition(context, params.advisory, budgetConstraints),
      benefits: this.buildBusinessCaseBenefits(context),
      detailedBenefits: this.buildBusinessCaseDetailedBenefits(context),
      totalCostEstimate: context.effectiveTotalCost,
      totalBenefitEstimate: context.totalBenefits,
      roiPercentage: context.roi,
      npvValue: context.npv,
      paybackMonths: context.payback * 12,
      discountRate: 8,
      riskLevel: this.mapRiskScoreToLevel(calculatedRiskScore),
      riskScore: calculatedRiskScore,
      identifiedRisks: allRisks,
      implementationPhases,
      milestones: this.buildBusinessCaseMilestones(context),
      dependencies,
      resourceRequirements,
      strategicObjectives: this.buildBusinessCaseStrategicObjectives(context),
      complianceRequirements: Array.isArray(context.complianceAgent?.applicableRegulations) ? context.complianceAgent.applicableRegulations as string[] : [],
      complianceScore: context.complianceScore,
      kpis: this.buildBusinessCaseKpis(context),
      successCriteria: this.buildBusinessCaseSuccessCriteria(),
      stakeholderAnalysis: this.buildBusinessCaseStakeholderAnalysis(context, stakeholderSummary),
      keyAssumptions: this.buildBusinessCaseAssumptions(context, params.advisory),
      projectDependencies: { dependencies: [] },
      recommendations: this.buildBusinessCaseRecommendations(context, allRisks, recommendationSummary),
      meta: {
        ...this.buildArtifactMeta(params.outputSchemaId, context.hasAgentData ? 0.5 : 0.35),
        agentDataAvailable: context.hasAgentData,
      },
    };
  }

  private buildBusinessCaseSummaryData(context: BusinessCaseContext): {
    executiveSummaryWithAgentData: string;
    executiveSummaryFallback: string;
    backgroundContext: string;
    businessRequirements: string;
  } {
    const objectiveSummary = context.objective ? context.objective.substring(0, 300) : "achieve strategic objectives";
    const objectiveSummaryLong = context.objective ? context.objective.substring(0, 400) : "achieve strategic objectives";
    const expectedOutcomesSummary = context.expectedOutcomes ? ` Expected outcomes: ${context.expectedOutcomes.substring(0, 200)}` : "";
    const currentChallengesSummary = context.currentChallenges ? ` Current challenges: ${context.currentChallenges.substring(0, 200)}` : "";
    const budgetRangeSummary = context.budgetRange ? ` Budget range: ${context.budgetRange}.` : "";
    const investmentGrade = context.investmentGrade || "pending";
    const executiveSummaryWithAgentData = `${context.orgLabel} proposes ${context.title} to ${objectiveSummary}. Financial analysis: NPV ${context.npv.toLocaleString()} AED, ROI ${context.roi}%, payback ${context.payback} years (${investmentGrade} grade). Strategic alignment: ${context.overallAlignment}%. Compliance: ${context.complianceScore}%.${expectedOutcomesSummary}`;
    const executiveSummaryFallback = `${context.orgLabel} proposes ${context.title} to ${objectiveSummaryLong}.${currentChallengesSummary}${expectedOutcomesSummary}${budgetRangeSummary}`;
    const backgroundContext = [
      `${context.orgLabel} is pursuing ${context.title} within the ${context.department} department.`,
      context.objective,
      context.currentChallenges ? ` Current challenges include: ${context.currentChallenges}` : "",
      context.existingSystems ? ` Existing systems: ${context.existingSystems}` : "",
    ].join("");

    let businessRequirements = "";
    if (context.objective) {
      businessRequirements = [
        `Key requirements derived from: ${context.objective.substring(0, 800)}`,
        context.expectedOutcomes ? `. Expected outcomes: ${context.expectedOutcomes}` : "",
        context.successCriteria ? `. Success criteria: ${context.successCriteria}` : "",
      ].join("");
    }

    return {
      executiveSummaryWithAgentData,
      executiveSummaryFallback,
      backgroundContext,
      businessRequirements,
    };
  }

  private buildBusinessCaseBudgetConstraints(context: BusinessCaseContext): string[] {
    if (context.budgetRange) {
      return [`Budget constrained to ${context.budgetRange}`];
    }

    if (context.effectiveTotalCost > 0) {
      return [`Budget constrained to ${context.effectiveTotalCost.toLocaleString()} AED`];
    }

    return [];
  }

  private buildBusinessCaseRecommendationSummary(context: BusinessCaseContext): string {
    if (!context.investmentGrade) {
      return "";
    }

    const investmentNote = context.npv > 0 ? "Positive NPV supports investment." : "Further analysis recommended.";
    return `Investment grade: ${context.investmentGrade}. ${investmentNote}`;
  }

  private buildBusinessCaseStakeholderSummary(context: BusinessCaseContext): string {
    const demandStakeholderCount = context.demandStakeholders.split(/[,;\n]+/).map((value) => value.trim()).filter(Boolean).length;
    if (demandStakeholderCount > 0) {
      return `Key stakeholders span executive leadership, ${context.department} operations, IT governance, finance, compliance, and end users. ${demandStakeholderCount} stakeholder(s) identified directly from the demand request.`;
    }

    return `Key stakeholders span executive leadership, ${context.department} operations, IT governance, finance, compliance, and end users.`;
  }

  private buildBusinessCaseSmartObjectives(context: BusinessCaseContext): Array<Record<string, unknown>> {
    const measurable = context.roi > 0 ? `Target ROI: ${context.roi}%, Payback: ${context.payback} years` : "KPIs to be defined";
    const achievable = context.overallAlignment > 70 ? `Strategic alignment: ${context.overallAlignment}%` : "Within organizational capacity";
    const timeBound = context.payback > 0 ? `${context.payback}-year investment horizon` : "Timeline to be determined";

    return [{
      objective: context.objective || context.title,
      specific: context.objective || "",
      measurable,
      achievable,
      relevant: "Aligned with strategic objectives",
      timeBound,
    }];
  }

  private buildBusinessCaseScopeDefinition(
    context: BusinessCaseContext,
    advisory: AdvisoryData,
    budgetConstraints: string[],
  ): Record<string, unknown> {
    const assumptions = advisory.assumptions?.map((assumption) => assumption.assumption) || [
      `${context.orgLabel} will provide dedicated project stakeholders and subject matter experts`,
      `Existing IT infrastructure meets minimum requirements for the proposed solution`,
      `Required government approvals and procurement processes will follow standard timelines`,
    ];

    return {
      inScope: [
        `End-to-end implementation of ${context.title}`,
        `Requirements analysis and solution design for ${context.department} department`,
        `Technology platform selection, procurement, and deployment`,
        `Integration with existing ${context.orgLabel} systems and workflows`,
        `User training, change management, and knowledge transfer`,
        `Post-deployment support and performance monitoring (12 months)`,
      ],
      outOfScope: [
        `Organizational restructuring beyond ${context.department} department`,
        `Legacy system decommissioning not directly replaced by this initiative`,
        `Third-party vendor contract renegotiations outside project scope`,
        `Infrastructure upgrades not specifically required for this implementation`,
      ],
      deliverables: [
        `Solution architecture and technical design documentation`,
        `Configured and tested ${context.title} platform`,
        `Data migration and integration framework`,
        `User training materials and change management plan`,
        `Go-live support and post-implementation review report`,
      ],
      constraints: [
        ...budgetConstraints,
        `Must comply with UAE government IT governance and security standards`,
        `Implementation must minimize disruption to ongoing ${context.department} operations`,
        `All data must remain within UAE sovereign data centers`,
      ],
      assumptions,
    };
  }

  private buildBusinessCaseBenefits(context: BusinessCaseContext): Array<Record<string, unknown>> {
    const operationalEfficiencyValue = context.totalBenefits > 0 ? Math.round(context.totalBenefits * 0.4) : null;
    const costReductionValue = context.totalBenefits > 0 ? Math.round(context.totalBenefits * 0.3) : null;
    const riskReductionValue = context.totalBenefits > 0 ? Math.round(context.totalBenefits * 0.15) : null;

    return [
      { name: "Operational Efficiency", type: "productivity", description: `Streamlined ${context.department} processes through automation and digitization`, value: operationalEfficiencyValue, unit: "AED", timeline: "Year 1-2", owner: context.department },
      { name: "Cost Reduction", type: "cost_savings", description: `Reduced manual effort and operational overhead in ${context.department}`, value: costReductionValue, unit: "AED", timeline: "Year 2-3", owner: context.department },
      { name: "Strategic Value", type: "strategic", description: `Enhanced ${context.orgLabel} capabilities aligned with national digital transformation goals`, value: null, unit: null, timeline: "Year 1-5", owner: null },
      { name: "Risk Reduction", type: "risk_reduction", description: `Improved compliance, security, and audit readiness`, value: riskReductionValue, unit: "AED", timeline: "Year 1-3", owner: null },
    ];
  }

  private buildBusinessCaseDetailedBenefits(context: BusinessCaseContext): Array<Record<string, unknown>> {
    const processAutomationValue = context.totalBenefits > 0 ? Math.round(context.totalBenefits * 0.25) : null;
    const serviceDeliveryValue = context.totalBenefits > 0 ? Math.round(context.totalBenefits * 0.15) : null;

    return [
      { name: "Process Automation", type: "productivity", description: `Automation of key workflows within ${context.department}, reducing manual processing time by an estimated 40-60%`, value: processAutomationValue, unit: "AED", timeline: "Year 1", owner: context.department },
      { name: "Data-Driven Decision Making", type: "strategic", description: `Real-time analytics and reporting capabilities enabling evidence-based decisions`, value: null, unit: null, timeline: "Year 1-2", owner: null },
      { name: "Improved Service Delivery", type: "revenue", description: `Enhanced service quality and response times for stakeholders`, value: serviceDeliveryValue, unit: "AED", timeline: "Year 2-3", owner: context.department },
    ];
  }

  private buildBusinessCaseMilestones(context: BusinessCaseContext): Array<Record<string, unknown>> {
    if (Array.isArray(context.projectManagerAgent?.milestones)) {
      return context.projectManagerAgent.milestones as Array<Record<string, unknown>>;
    }

    return [
      { name: "Project Kickoff", date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], status: "pending", deliverables: ["Approved project charter"], owner: context.department },
      { name: "Requirements Approved", date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], status: "pending", deliverables: ["Signed-off requirements"], owner: context.department },
      { name: "Solution Design Complete", date: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], status: "pending", deliverables: ["Approved design document"], owner: context.department },
      { name: "UAT Sign-off", date: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], status: "pending", deliverables: ["UAT completion report"], owner: context.department },
      { name: "Go-Live", date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], status: "pending", deliverables: ["Production deployment confirmation"], owner: context.department },
    ];
  }

  private buildBusinessCaseStrategicObjectives(context: BusinessCaseContext): Array<Record<string, unknown>> {
    if (!context.alignmentAgent?.dimensions) {
      return [];
    }

    return Object.entries(context.alignmentAgent.dimensions as Record<string, Record<string, unknown>>).map(([dimension, data]) => ({
      dimension: dimension.replaceAll(/([A-Z])/g, " $1").trim(),
      score: Math.round(((data.score as number) || 0) * 100),
      rationale: (data.rationale as string) || "",
    }));
  }

  private buildBusinessCaseKpis(context: BusinessCaseContext): Array<Record<string, unknown>> {
    const kpis: Array<Record<string, unknown>> = [];
    if (context.roi > 0) {
      kpis.push(
        { name: "Return on Investment", target: `${context.roi}%`, measurement: "Financial analysis" },
        { name: "Net Present Value", target: `${context.npv.toLocaleString()} AED`, measurement: "Discounted cash flow" },
        { name: "Payback Period", target: `${context.payback} years`, measurement: "Cumulative cash flow" },
      );
    }

    kpis.push(
      { name: "Project Delivery On-Time", target: "≥90% milestone adherence", measurement: "Project schedule tracking" },
      { name: "User Adoption Rate", target: "≥80% within 6 months of go-live", measurement: "Active user analytics" },
      { name: "Process Efficiency Gain", target: "≥30% reduction in processing time", measurement: "Before/after time studies" },
      { name: "System Availability", target: "≥99.5% uptime SLA", measurement: "Infrastructure monitoring" },
    );

    return kpis;
  }

  private buildBusinessCaseSuccessCriteria(): Array<Record<string, unknown>> {
    return [
      { criterion: "Solution fully deployed and operational in production", target: "Go-live achieved within approved timeline" },
      { criterion: "All critical business processes migrated and functional", target: "100% process coverage verified" },
      { criterion: "End users trained and actively using the system", target: ">80% adoption rate within 6 months" },
      { criterion: "Data migrated with verified integrity", target: "Zero critical data discrepancies post-migration" },
    ];
  }

  private async finalizeBusinessCaseCandidate(params: {
    decision: DecisionObject;
    candidate: Record<string, unknown>;
    outputSchemaId: string;
    outputSchemaSpec?: string;
    internalOutput?: Record<string, unknown>;
    agentOutputs: Record<string, Record<string, unknown>>;
    enginePluginId?: string;
  }): Promise<Record<string, unknown> | null> {
    let candidate = params.candidate;
    const initialEval = this.evaluateBusinessCaseCandidate(candidate, params.decision);
    if (!initialEval.ok) {
      logger.warn(`[Layer 6] BUSINESS_CASE failed quality gate (issues=${initialEval.issues.join("; ")}). Attempting AI repair...`);
      const repaired = await this.repairBusinessCaseDraft({
        decision: params.decision,
        outputSchemaId: params.outputSchemaId,
        outputSchemaSpec: params.outputSchemaSpec,
        internalOutput: params.internalOutput,
        agentOutputs: params.agentOutputs,
        enginePluginId: params.enginePluginId,
        issues: initialEval.issues,
      });
      if (repaired) {
        candidate = repaired;
      }
    }

    candidate = this.forceBusinessCaseIdentifiers(candidate, params.decision);
    const finalEval = this.evaluateBusinessCaseCandidate(candidate, params.decision);
    if (!finalEval.ok) {
      logger.warn(`[Layer 6] BUSINESS_CASE still low-quality after repair. Skipping persistence. Issues: ${finalEval.issues.join("; ")}`);
      return null;
    }
    return candidate;
  }

  private async resolveExternalHybridDraftContent(params: {
    decision: DecisionObject;
    artifactType: string;
    outputSchemaId: string;
    outputSchemaSpec?: string;
    internalOutput?: Record<string, unknown>;
    agentOutputs: Record<string, Record<string, unknown>>;
    advisory: AdvisoryData;
    enginePluginId?: string;
    isBusinessCase: boolean;
  }): Promise<{ content: Record<string, unknown> | null; telemetry: DraftPersistenceTelemetry }> {
    const draft = await this.hybridEngine.generateArtifactDraft({
      decision: params.decision,
      artifactType: params.artifactType,
      outputSchemaId: params.outputSchemaId,
      outputSchemaSpec: params.outputSchemaSpec,
      internalOutput: params.internalOutput,
      agentOutputs: params.agentOutputs,
      enginePluginId: params.enginePluginId,
    });

    const telemetry: DraftPersistenceTelemetry = {
      usedInternalEngine: false,
      usedHybridEngine: draft.status === "completed" && !!draft.content,
      hybridStatus: draft.status,
    };

    if (params.isBusinessCase) {
      if (!(draft.status === "completed" && draft.content)) {
        logger.warn(`[Layer 6] BUSINESS_CASE generation failed (status=${draft.status}, reason=${draft.reason || "unknown"}). Skipping persistence to avoid low-quality fallback.`);
        return { content: null, telemetry };
      }
      return {
        content: await this.finalizeBusinessCaseCandidate({
          decision: params.decision,
          candidate: draft.content,
          outputSchemaId: params.outputSchemaId,
          outputSchemaSpec: params.outputSchemaSpec,
          internalOutput: params.internalOutput,
          agentOutputs: params.agentOutputs,
          enginePluginId: params.enginePluginId,
        }),
        telemetry,
      };
    }

    // Agent baseline (demand-agent output merged into advisory) — always available instantly.
    const l6Content = this.buildAdvisoryDraftContent(params);

    if (draft.status === "completed" && draft.content) {
      logger.info(`[Layer 6] AI (${draft.model || "hybrid"}) succeeded for ${params.artifactType} — merged empty sections from advisory`);
      return {
        content: this.mergeEmptySections(draft.content, l6Content, params.artifactType),
        telemetry,
      };
    }

    // For DEMAND_FIELDS: prefer an internal LLM enrichment attempt before settling for
    // the advisory baseline so AI assist can still produce a full draft on hybrid misses.
    if (params.artifactType === "DEMAND_FIELDS") {
      logger.info(`[Layer 6] Hybrid draft unavailable for DEMAND_FIELDS (${draft.reason || "unknown"}) — attempting Engine A enrichment before baseline fallback`);
      try {
        const internalDraft = await this.internalEngine.generateArtifactDraft({
          decision: params.decision,
          artifactType: params.artifactType,
          outputSchemaId: params.outputSchemaId,
          outputSchemaSpec: params.outputSchemaSpec,
          internalOutput: params.internalOutput,
          agentOutputs: params.agentOutputs,
          enginePluginId: params.enginePluginId,
        });

        if (internalDraft.status === "completed" && internalDraft.content) {
          logger.info("[Layer 6] Engine A enrichment succeeded for DEMAND_FIELDS after hybrid miss");
          return {
            content: this.mergeEmptySections(internalDraft.content, l6Content, params.artifactType),
            telemetry: {
              ...telemetry,
              usedInternalEngine: true,
            },
          };
        }

        logger.info(`[Layer 6] Engine A enrichment unavailable for DEMAND_FIELDS (${internalDraft.reason || internalDraft.status}) — using advisory baseline`);
      } catch (internalErr) {
        logger.warn("[Layer 6] Engine A enrichment failed for DEMAND_FIELDS after hybrid miss", internalErr);
      }

      return { content: l6Content, telemetry };
    }

    logger.info(`[Layer 6] AI fallback for ${params.artifactType} (reason: ${draft.reason || "unknown"}) — using Layer 6 advisory builder`);
    return { content: l6Content, telemetry };
  }

  private async resolveNonBusinessSovereignDraftContent(params: {
    draft: { status: string; content?: Record<string, unknown>; reason?: string };
    decision: DecisionObject;
    artifactType: string;
    outputSchemaId: string;
    outputSchemaSpec?: string;
    internalOutput?: Record<string, unknown>;
    agentOutputs: Record<string, Record<string, unknown>>;
    advisory: AdvisoryData;
    enginePluginId?: string;
    abortSignal?: AbortSignal;
  }): Promise<Record<string, unknown>> {
    const l6Content = this.buildAdvisoryDraftContent({
      decision: params.decision,
      artifactType: params.artifactType,
      outputSchemaId: params.outputSchemaId,
      advisory: params.advisory,
      internalOutput: params.internalOutput,
      agentOutputs: params.agentOutputs,
    });
    if (params.draft.status === "completed" && params.draft.content) {
      if (params.artifactType === "DEMAND_FIELDS") {
        logger.info("[Layer 6] DEMAND_FIELDS on Engine A using engine draft with demand-agent backfill");
        return this.mergeEmptySections(params.draft.content, l6Content, params.artifactType);
      }
      return this.mergeEmptySections(params.draft.content, l6Content, params.artifactType);
    }

    if (params.draft.status === "skipped" || params.draft.status === "fallback") {
      // Sovereign boundary guard: NEVER fall back to hybrid for confidential/sovereign classifications,
      // UNLESS Engine A has no actual sovereign processing path serving (no endpoint, or endpoint
      // configured but functionally unavailable). In that case the boundary is aspirational and
      // blocking hybrid would only force a non-AI advisory builder. Hybrid still routes through
      // the redaction gateway, preserving the sovereignty contract.
      const classLevel = (params.decision.classification?.classificationLevel || "").toLowerCase();
      const isSovereignBoundary = classLevel === "confidential" || classLevel === "sovereign" || classLevel === "high_sensitive" || classLevel === "secret";
      const reasonText = typeof params.draft.reason === "string" ? params.draft.reason.toLowerCase() : "";
      const engineAUnavailable =
        (params.draft.status === "skipped" && reasonText.includes("no local inference endpoint")) ||
        (params.draft.status === "fallback" && (
          reasonText.includes("local inference unavailable") ||
          reasonText.includes("unreachable") ||
          reasonText.includes("no compatible models") ||
          reasonText.includes("local inference error") ||
          reasonText.includes("invalid json")
        ));
      if (isSovereignBoundary && !engineAUnavailable) {
        logger.warn(`[Layer 6] Engine A ${params.draft.status}: ${params.draft.reason} — Hybrid fallback BLOCKED (classification: ${classLevel}). Using advisory builder.`);
        return l6Content;
      }
      if (isSovereignBoundary && engineAUnavailable) {
        logger.info(`[Layer 6] Engine A effectively unavailable (status=${params.draft.status}, reason=${params.draft.reason || "unknown"}) — allowing Hybrid fallback despite ${classLevel} classification (redaction gateway still applies)`);
      }

      this.throwIfAborted(params.abortSignal);
      logger.info(`[Layer 6] Engine A ${params.draft.status}: ${params.draft.reason} → falling back to Claude`);
      const hybridDraft = await this.hybridEngine.generateArtifactDraft({
        decision: params.decision,
        artifactType: params.artifactType,
        outputSchemaId: params.outputSchemaId,
        outputSchemaSpec: params.outputSchemaSpec,
        internalOutput: params.internalOutput,
        agentOutputs: params.agentOutputs,
        enginePluginId: params.enginePluginId,
      });

      if (hybridDraft.status === "completed" && hybridDraft.content) {
        if (params.artifactType === "DEMAND_FIELDS") {
          logger.info(`[Layer 6] Claude succeeded for ${params.artifactType} — merging demand-agent backfill`);
          return this.mergeEmptySections(hybridDraft.content, l6Content, params.artifactType);
        }
        logger.info(`[Layer 6] Claude succeeded for ${params.artifactType} — merged empty sections from advisory`);
        return this.mergeEmptySections(hybridDraft.content, l6Content, params.artifactType);
      }

      logger.info(`[Layer 6] Claude fallback for ${params.artifactType} — using Layer 6 advisory builder`);
      return l6Content;
    }

    return l6Content;
  }

  private async resolveSovereignInternalDraftContent(params: {
    decision: DecisionObject;
    artifactType: string;
    outputSchemaId: string;
    outputSchemaSpec?: string;
    internalOutput?: Record<string, unknown>;
    agentOutputs: Record<string, Record<string, unknown>>;
    advisory: AdvisoryData;
    enginePluginId?: string;
    isBusinessCase: boolean;
    abortSignal?: AbortSignal;
  }): Promise<Record<string, unknown> | null> {
    const draft = await this.internalEngine.generateArtifactDraft({
      decision: params.decision,
      artifactType: params.artifactType,
      outputSchemaId: params.outputSchemaId,
      outputSchemaSpec: params.outputSchemaSpec,
      internalOutput: params.internalOutput,
      agentOutputs: params.agentOutputs,
      enginePluginId: params.enginePluginId,
      abortSignal: params.abortSignal,
    });

    if (params.isBusinessCase) {
      let candidateDraft = draft;
      if (!(candidateDraft.status === "completed" && candidateDraft.content)) {
        // Sovereign boundary guard: only hard-block hybrid if Engine A actually FAILED (timeout, model error, etc.)
        // — not when it was skipped because no local endpoint is configured at all. When Engine A is
        // unconfigured, there is no sovereign processing path available and hybrid is the only option.
        const classLevel = (params.decision.classification?.classificationLevel || "").toLowerCase();
        const isSovereignBoundary = classLevel === "confidential" || classLevel === "sovereign" || classLevel === "high_sensitive" || classLevel === "secret";
        const reasonText = typeof (candidateDraft as Record<string, unknown>).reason === "string"
          ? ((candidateDraft as Record<string, unknown>).reason as string).toLowerCase()
          : "";
        // Engine A is "unconfigured" when there is literally no endpoint, OR when the endpoint
        // is configured but the runtime is functionally unavailable (gateway unreachable, upstream
        // GPU paused / returning model errors). In either case there is no sovereign processing
        // path actually serving — blocking hybrid would only force the worst outcome (no AI at all
        // and a non-AI advisory synthesis). Hybrid still routes through the redaction gateway, so
        // the sovereignty contract is preserved.
        const engineAUnconfigured =
          (candidateDraft.status === "skipped" && reasonText.includes("no local inference endpoint")) ||
          (candidateDraft.status === "fallback" && (
            reasonText.includes("local inference unavailable") ||
            reasonText.includes("unreachable") ||
            reasonText.includes("no compatible models") ||
            reasonText.includes("local inference error") ||
            reasonText.includes("invalid json")
          ));
        if (isSovereignBoundary && !engineAUnconfigured) {
          logger.warn(`[Layer 6] BUSINESS_CASE: Engine A status=${candidateDraft.status} — Hybrid fallback BLOCKED (classification: ${classLevel}). External models not allowed for this classification.`);
        } else {
          if (isSovereignBoundary && engineAUnconfigured) {
            logger.info(`[Layer 6] BUSINESS_CASE: Engine A effectively unavailable (status=${candidateDraft.status}, reason=${candidateDraft.reason || "unknown"}) — allowing Hybrid fallback despite ${classLevel} classification (sovereignty boundary is aspirational when no local engine is actually serving; redaction gateway still applies)`);
          } else {
            logger.info(`[Layer 6] BUSINESS_CASE: Engine A status=${candidateDraft.status} (${candidateDraft.reason || "unknown"}) → trying Hybrid`);
          }
          this.throwIfAborted(params.abortSignal);
          candidateDraft = await this.hybridEngine.generateArtifactDraft({
            decision: params.decision,
            artifactType: params.artifactType,
            outputSchemaId: params.outputSchemaId,
            outputSchemaSpec: params.outputSchemaSpec,
            internalOutput: params.internalOutput,
            agentOutputs: params.agentOutputs,
            enginePluginId: params.enginePluginId,
          });
        }
      }

      if (!(candidateDraft.status === "completed" && candidateDraft.content)) {
        logger.warn(`[Layer 6] BUSINESS_CASE generation failed (status=${candidateDraft.status}, reason=${candidateDraft.reason || "unknown"}). Skipping persistence.`);
        return null;
      }

      return await this.finalizeBusinessCaseCandidate({
        decision: params.decision,
        candidate: candidateDraft.content,
        outputSchemaId: params.outputSchemaId,
        outputSchemaSpec: params.outputSchemaSpec,
        internalOutput: params.internalOutput,
        agentOutputs: params.agentOutputs,
        enginePluginId: params.enginePluginId,
      });
    }
    return await this.resolveNonBusinessSovereignDraftContent({
      draft: {
        status: draft.status,
        content: draft.content,
        reason: draft.reason,
      },
      decision: params.decision,
      artifactType: params.artifactType,
      outputSchemaId: params.outputSchemaId,
      outputSchemaSpec: params.outputSchemaSpec,
      internalOutput: params.internalOutput,
      agentOutputs: params.agentOutputs,
      advisory: params.advisory,
      enginePluginId: params.enginePluginId,
      abortSignal: params.abortSignal,
    });
  }

  private attachDeferredDraftArtifact(advisory: AdvisoryData, artifactType: string, content: Record<string, unknown>): void {
    const advisoryRecord = advisory as unknown as Record<string, unknown>;
    const existingArtifacts = typeof advisoryRecord.generatedArtifacts === "object" && advisoryRecord.generatedArtifacts !== null
      ? advisoryRecord.generatedArtifacts as Record<string, unknown>
      : {};
    advisoryRecord.generatedArtifacts = {
      ...existingArtifacts,
      [artifactType]: content,
    };
    logger.info(`[Layer 6] ${artifactType}: attached draft to advisory.generatedArtifacts (not persisted as decision artifact)`);
  }

  private async withSoftDraftTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<{ timedOut: false; value: T } | { timedOut: true }> {
    return await new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        resolve({ timedOut: true });
      }, timeoutMs);

      promise
        .then((value) => {
          clearTimeout(timeoutHandle);
          resolve({ timedOut: false, value });
        })
        .catch((error) => {
          clearTimeout(timeoutHandle);
          reject(error);
        });
    });
  }

  private applyBusinessCaseQualityScore(content: Record<string, unknown>): void {
    const qualityScore = this.scoreBusinessCaseContent(content);
    const meta = (content.meta || {}) as Record<string, unknown>;
    content.meta = { ...meta, qualityScore: qualityScore.total, qualityGrade: qualityScore.grade, qualityBreakdown: qualityScore.breakdown };
    logger.info(`[Layer 6] BC content quality: ${qualityScore.total}/100 (${qualityScore.grade})`);
  }

  private stampDraftRuntimeProvenance(
    content: Record<string, unknown>,
    telemetry: DraftPersistenceTelemetry,
    ctx: { decision: DecisionObject },
  ): void {
    const orchestration = ctx.decision.orchestration;
    const selectedEngines = this.asRecord(orchestration?.selectedEngines);
    const primary = this.asRecord(selectedEngines.primary);
    const plannedEngineKind = this.asString(primary.kind);
    const plannedPluginId = this.asString(primary.pluginId);
    const plannedPluginName = this.asString(primary.pluginName) || this.asString(primary.name);
    const generatedAt = new Date().toISOString();

    let actualEngineKind: string | null = null;
    let actualEngineLabel: string | null = null;
    let executionMode: string | null = null;
    let legacyEngine: string | null = null;

    if (telemetry.usedInternalEngine && telemetry.usedHybridEngine) {
      actualEngineKind = "MIXED";
      actualEngineLabel = telemetry.hybridStatus === "fallback" ? "Engine A with hybrid fallback" : "Engine A with hybrid assistance";
      executionMode = telemetry.hybridStatus === "fallback" ? "internal_with_hybrid_fallback" : "internal_with_hybrid_assistance";
      legacyEngine = "A+B";
    } else if (telemetry.usedInternalEngine) {
      actualEngineKind = "SOVEREIGN_INTERNAL";
      actualEngineLabel = "Engine A only";
      executionMode = "internal_only";
      legacyEngine = "A";
    } else if (telemetry.usedHybridEngine) {
      actualEngineKind = "EXTERNAL_HYBRID";
      actualEngineLabel = telemetry.hybridStatus === "fallback" ? "Engine B fallback" : "Engine B only";
      executionMode = telemetry.hybridStatus === "fallback" ? "hybrid_fallback" : "hybrid_only";
      legacyEngine = "B";
    }

    const originalMeta = this.asRecord(content.meta);
    content.meta = {
      ...originalMeta,
      generatedAt,
      engine: legacyEngine || originalMeta.engine || null,
      provenance: {
        generatedAt,
        legacyEngine,
        plannedEngineKind,
        plannedEngineLabel: plannedEngineKind === "SOVEREIGN_INTERNAL"
          ? "Engine A / Sovereign Internal"
          : plannedEngineKind === "EXTERNAL_HYBRID" ? "Engine B / External Hybrid" : null,
        plannedPluginId,
        plannedPluginName,
        actualEngineKind,
        actualEngineLabel,
        executionMode,
        usedInternalEngine: telemetry.usedInternalEngine,
        usedHybridEngine: telemetry.usedHybridEngine,
        hybridStatus: telemetry.hybridStatus || null,
      },
    };
  }

  private async resolveDemandFieldsDraft(params: {
    decision: DecisionObject;
    artifactType: string;
    outputSchemaId: string;
    outputSchemaSpec?: string;
    internalOutput: Record<string, unknown> | undefined;
    agentOutputs: Record<string, Record<string, unknown>>;
    advisory: AdvisoryData;
    enginePluginId?: string;
  }): Promise<{ content: Record<string, unknown> | null; telemetry: DraftPersistenceTelemetry }> {
    // Progressive enhancement: agent baseline (instant) + optional LLM enrichment.
    const agentBaseline = this.buildAdvisoryDraftContent({
      decision: params.decision,
      artifactType: params.artifactType,
      outputSchemaId: params.outputSchemaId,
      advisory: params.advisory,
      internalOutput: params.internalOutput,
      agentOutputs: params.agentOutputs,
    });
    logger.info("[Layer 6] DEMAND_FIELDS: agent baseline ready, attempting LLM enhancement");

    const enrichTimeoutMs = Number.isFinite(Number(process.env.COREVIA_DEMAND_FIELDS_ENRICHMENT_SOFT_TIMEOUT_MS))
      ? Math.max(1000, Math.floor(Number(process.env.COREVIA_DEMAND_FIELDS_ENRICHMENT_SOFT_TIMEOUT_MS)))
      : 90000;

    try {
      const draftResult = await this.withSoftDraftTimeout(this.internalEngine.generateArtifactDraft({
        decision: params.decision,
        artifactType: params.artifactType,
        outputSchemaId: params.outputSchemaId,
        outputSchemaSpec: params.outputSchemaSpec,
        internalOutput: params.internalOutput,
        agentOutputs: params.agentOutputs,
        enginePluginId: params.enginePluginId,
      }), enrichTimeoutMs);

      if (draftResult.timedOut) {
        logger.info(`[Layer 6] DEMAND_FIELDS: LLM enrichment exceeded ${enrichTimeoutMs}ms — using agent baseline immediately`);
        return {
          content: agentBaseline,
          telemetry: { usedInternalEngine: false, usedHybridEngine: false, hybridStatus: "soft_timeout" },
        };
      }

      const draft = draftResult.value;

      if (draft.status === "completed" && draft.content) {
        logger.info("[Layer 6] DEMAND_FIELDS: LLM enhancement succeeded — merging over agent baseline");
        return {
          content: this.mergeEmptySections(draft.content, agentBaseline, params.artifactType),
          telemetry: { usedInternalEngine: true, usedHybridEngine: false, hybridStatus: draft.status },
        };
      }
      logger.info(`[Layer 6] DEMAND_FIELDS: LLM ${draft.status} (${draft.reason || "n/a"}) — using agent baseline`);
      return {
        content: agentBaseline,
        telemetry: { usedInternalEngine: false, usedHybridEngine: false, hybridStatus: draft.status },
      };
    } catch (enhanceErr) {
      logger.warn("[Layer 6] DEMAND_FIELDS: LLM enhancement error — using agent baseline", enhanceErr);
      return {
        content: agentBaseline,
        telemetry: { usedInternalEngine: false, usedHybridEngine: false, hybridStatus: "error" },
      };
    }
  }

  private async finalizeDraftArtifact(
    content: Record<string, unknown> | null,
    telemetry: DraftPersistenceTelemetry,
    ctx: {
      decision: DecisionObject;
      artifactType: string;
      useCaseKey: string;
      deferArtifactPersistence: boolean;
      advisory: AdvisoryData;
    },
  ): Promise<DraftPersistenceTelemetry> {
    const GENERATION_DEFERRED_TYPES = new Set(["BUSINESS_CASE", "REQUIREMENTS", "STRATEGIC_FIT"]);
    if (!content) {
      if (GENERATION_DEFERRED_TYPES.has(ctx.artifactType)) {
        logger.warn(`[Layer 6] ${ctx.artifactType}: both engines failed — attaching generation_failed marker`);
        this.attachDeferredDraftArtifact(ctx.advisory, ctx.artifactType, {
          generationFailed: true,
          failedAt: new Date().toISOString(),
          reason: "Both Engine A and Engine B failed to produce content",
        });
      }
      return telemetry;
    }

    if (ctx.artifactType === "BUSINESS_CASE") {
      this.applyBusinessCaseQualityScore(content);
    }

    this.stampDraftRuntimeProvenance(content, telemetry, {
      decision: ctx.decision,
    });

    if (ctx.artifactType === "DEMAND_FIELDS") {
      this.attachDeferredDraftArtifact(ctx.advisory, ctx.artifactType, content);
    }

    if (ctx.deferArtifactPersistence) {
      this.attachDeferredDraftArtifact(ctx.advisory, ctx.artifactType, content);
      return telemetry;
    }

    const createdBy = ctx.decision.input?.userId || undefined;
    await coreviaStorage.upsertDecisionArtifactVersion({
      decisionSpineId: ctx.decision.decisionId,
      artifactType: ctx.artifactType,
      subDecisionType: ctx.artifactType,
      content,
      changeSummary: `Draft generated by Brain Layer 6 (${ctx.useCaseKey || ctx.artifactType})`,
      createdBy,
    });
    return telemetry;
  }

  private async tryPersistDraftArtifact(
    decision: DecisionObject,
    internalEngineOutput: Record<string, unknown> | undefined,
    agentOutputs: Record<string, Record<string, unknown>>,
    advisory: AdvisoryData,
    abortSignal?: AbortSignal
  ): Promise<DraftPersistenceTelemetry> {
    let telemetry: DraftPersistenceTelemetry = {
      usedInternalEngine: false,
      usedHybridEngine: false,
    };

    try {
      this.throwIfAborted(abortSignal);
      const orchestration = decision.orchestration;
      const agentPlan = orchestration?.agentPlanPolicy;
      const useCaseKey = this.asString(agentPlan?.useCaseKey);
      const outputSchemaId = this.asString(agentPlan?.outputSchemaId);
      const outputSchemaSpec = typeof agentPlan?.outputSchemaSpec === "string"
        ? agentPlan.outputSchemaSpec
        : undefined;
      const artifactType = this.resolveArtifactType(useCaseKey);
      if (!artifactType) return telemetry;

      const isBusinessCase = artifactType === "BUSINESS_CASE";
      const deferArtifactPersistence = artifactType === "BUSINESS_CASE" || artifactType === "REQUIREMENTS" || artifactType === "STRATEGIC_FIT";

      const selectedEngines = this.asRecord(orchestration?.selectedEngines);
      const primary = this.asRecord(selectedEngines.primary);
      const primaryKind = this.asString(primary.kind);
      const enginePluginId = typeof primary.pluginId === "string" ? primary.pluginId : undefined;
      const resolvedOutputSchemaId = this.buildDraftOutputSchemaId(artifactType, outputSchemaId);

      let content: Record<string, unknown> | null;
      if (primaryKind === "EXTERNAL_HYBRID" && decision.classification?.constraints.allowExternalModels) {
        const resolvedDraft = await this.resolveExternalHybridDraftContent({
          decision,
          artifactType,
          outputSchemaId: resolvedOutputSchemaId,
          outputSchemaSpec,
          internalOutput: internalEngineOutput,
          agentOutputs,
          advisory,
          enginePluginId,
          isBusinessCase,
        });
        content = resolvedDraft.content;
        telemetry = resolvedDraft.telemetry;
      } else if (primaryKind === "SOVEREIGN_INTERNAL" && artifactType === "DEMAND_FIELDS") {
        const resolved = await this.resolveDemandFieldsDraft({
          decision,
          artifactType,
          outputSchemaId: resolvedOutputSchemaId,
          outputSchemaSpec,
          internalOutput: internalEngineOutput,
          agentOutputs,
          advisory,
          enginePluginId,
        });
        content = resolved.content;
        telemetry = resolved.telemetry;
      } else if (primaryKind === "SOVEREIGN_INTERNAL") {
        content = await this.resolveSovereignInternalDraftContent({
          decision,
          artifactType,
          outputSchemaId: resolvedOutputSchemaId,
          outputSchemaSpec,
          internalOutput: internalEngineOutput,
          agentOutputs,
          advisory,
          enginePluginId,
          isBusinessCase,
        });
        telemetry = {
          usedInternalEngine: !!content,
          usedHybridEngine: false,
        };
      } else {
        content = this.buildAdvisoryDraftContent({
          decision,
          artifactType,
          outputSchemaId: resolvedOutputSchemaId,
          advisory,
          internalOutput: internalEngineOutput,
          agentOutputs,
        });
        telemetry = {
          usedInternalEngine: false,
          usedHybridEngine: false,
          hybridStatus: "advisory_only",
        };
      }

      return this.finalizeDraftArtifact(content, telemetry, {
        decision,
        artifactType,
        useCaseKey,
        deferArtifactPersistence,
        advisory,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      logger.error(`[Layer 6] Failed to persist draft artifact (non-blocking): ${msg}`, { stack });
      return telemetry;
    }
  }

  /**
   * Merge empty sections from AI-generated content with L6 advisory-powered content.
   * When AI produces content but leaves some fields empty, fill those from the L6 builder
   * which uses real advisory data (options, risks, confidence from the brain pipeline).
   */
  private mergeEmptySections(
    aiContent: Record<string, unknown>,
    l6Content: Record<string, unknown>,
    artifactType: string,
  ): Record<string, unknown> {
    const merged = { ...aiContent };
    let filled = 0;

    // Critical fields that should never be empty when advisory data is available
    const criticalFields = artifactType === "BUSINESS_CASE"
      ? [
          "executiveSummary", "problemStatement", "backgroundContext",
          "solutionOverview", "proposedSolution", "businessRequirements",
          "strategicObjectives", "complianceRequirements", "policyReferences",
          "identifiedRisks", "alternativeSolutions",
          "implementationPhases", "milestones", "dependencies",
          "resourceRequirements", "stakeholderAnalysis", "recommendations",
          "kpis", "successCriteria", "keyAssumptions",
          "benefits", "detailedBenefits", "scopeDefinition", "smartObjectives",
          "departmentImpact",
        ]
      : Object.keys(l6Content);

    for (const field of criticalFields) {
      if (field === "meta" || field === "artifactType") continue;
      const aiVal = merged[field];
      const l6Val = l6Content[field];

      // Fill if AI value is empty/missing and L6 has content
      const aiEmpty = this.isFieldEmpty(aiVal);
      const l6HasContent = !this.isFieldEmpty(l6Val);

      if (aiEmpty && l6HasContent) {
        merged[field] = l6Val;
        filled++;
      }
    }

    if (filled > 0) {
      logger.info(`[Layer 6] Merged ${filled} empty sections from advisory data into AI content for ${artifactType}`);
      const meta = (merged.meta || {}) as Record<string, unknown>;
      merged.meta = { ...meta, l6SectionsFilled: filled };
    }

    return merged;
  }

  /** Check if a field value is effectively empty */
  private isFieldEmpty(val: unknown): boolean {
    if (val === null || val === undefined) return true;
    if (typeof val === "string") return val.trim().length === 0;
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === "object") {
      const entries = Object.entries(val as Record<string, unknown>);
      if (entries.length === 0) return true;
      // Consider object empty if all values are empty
      return entries.every(([, v]) => this.isFieldEmpty(v));
    }
    return false;
  }

  private buildAgentContext(decision: DecisionObject): AgentContext {
    return {
      decisionId: decision.decisionId,
      correlationId: decision.correlationId,
      classificationLevel: decision.classification?.classificationLevel || "internal",
      tenantId: (decision as unknown as Record<string, unknown>).organizationId as string || "default",
      userId: (decision as unknown as Record<string, unknown>).userId as string | undefined,
      metadata: {
        serviceId: decision.input?.rawInput?.serviceId,
        routeKey: decision.input?.rawInput?.routeKey,
        layer: 6,
        mode: "analysis",
      },
    };
  }

  private async executeAgent(
    agent: { agentId: string; agentName: string; mode: string },
    decision: DecisionObject,
    internalOutput?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const runtimeAgentId = mapOrchestrationAgentIdToRuntime(agent.agentId);
    const registeredAgent = agentRuntime.getAgent(runtimeAgentId);

    if (!registeredAgent) {
      logger.info(`[Layer 6] Agent ${runtimeAgentId} not found in runtime, skipping`);
      return { status: "skipped", reason: `Agent ${runtimeAgentId} not registered` };
    }

    if (agent.mode === "execute") {
      logger.info(`[Layer 6] Agent ${agent.agentName} requires EXECUTE mode — blocked in SAFE ZONE`);
      return { status: "deferred", reason: "EXECUTE mode not allowed in Layer 6 (SAFE ZONE). Deferred to post-approval." };
    }

    const rawInput = (decision.input?.rawInput || {}) as Record<string, unknown>;
    const normalizedInput = (decision.input?.normalizedInput || {}) as Record<string, unknown>;
    const parentDemandApproved = rawInput.parentDemandApproved === true
      || normalizedInput.parentDemandApproved === true;

    const authorization = authorizePlannedAgentExecution({
      runtimeAgentId,
      plannedAgentId: agent.agentId,
      requestedMode: agent.mode as AgentMode,
      policyResult: decision.policy?.result,
      contextResult: decision.context?.result,
      plan: {
        selectedAgents: decision.orchestration?.selectedAgents || [],
        agentPlanPolicy: decision.orchestration?.agentPlanPolicy,
      },
      parentDemandApproved,
    });

    if (!authorization.allowed) {
      logger.info(`[Layer 6] Agent ${agent.agentName} blocked: ${authorization.reason}`);
      return { status: "blocked", reason: authorization.reason };
    }

    const context = this.buildAgentContext(decision);
    const input = decision.input?.normalizedInput || decision.input?.rawInput || {};
    const nestedAdditionalContext = (typeof input.additionalContext === "object" && input.additionalContext !== null)
      ? input.additionalContext as Record<string, unknown>
      : {};
    const nestedSourceContext = (typeof input.sourceContext === "object" && input.sourceContext !== null)
      ? input.sourceContext as Record<string, unknown>
      : {};

    const executionStartedAt = Date.now();
    await this.persistAgentAuditEvent({
      decision,
      runtimeAgentId,
      agent,
      eventType: "brain.agent.started",
      payload: {},
      warningLabel: "started",
    });

    try {
      const decisionArtifacts = ((decision.input as { artifacts?: Record<string, unknown> } | undefined)?.artifacts) || {};

      const agentOutput = await agentRuntime.execute(runtimeAgentId, {
        task: `${agent.agentName}: Analyze decision ${decision.decisionId}`,
        context,
        parameters: {
          ...input,
          ...nestedSourceContext,
          ...nestedAdditionalContext,
          mode: agent.mode,
          plannedAgentId: agent.agentId,
          plannedAgentName: agent.agentName,
          agentPlanPolicy: decision.orchestration?.agentPlanPolicy,
          internalEngineOutput: internalOutput,
          budget: input.estimatedBudget || input.budgetRange,
          complexity: decision.classification?.riskLevel || "medium",
          timeline: input.timeline || "6_months",
          title: input.title || input.projectName,
          description: input.businessObjective || input.description,
          category: this.firstString([
            input.category,
            input.department,
            nestedAdditionalContext.category,
            nestedAdditionalContext.department,
            nestedSourceContext.category,
            nestedSourceContext.department,
          ]),
          department: this.firstString([
            input.department,
            nestedAdditionalContext.department,
            nestedSourceContext.department,
          ]),
          organizationName: this.firstString([
            input.organizationName,
            input.organization,
            nestedAdditionalContext.organizationName,
            nestedAdditionalContext.organization,
            nestedSourceContext.organizationName,
            nestedSourceContext.organization,
          ]),
          requestorName: this.firstString([
            input.requestorName,
            input.requestor,
            nestedAdditionalContext.requestorName,
            nestedAdditionalContext.requestor,
            nestedSourceContext.requestorName,
            nestedSourceContext.requestor,
          ]),
          owner: this.firstDisplayName([input.requestorName, input.owner, input.requestedByName]),
          objectives: input.objectives,
          evidence: (internalOutput?.documents as unknown[]) || [],
          risks: (internalOutput?.scoring as Record<string, unknown> | undefined)?.dimensions || {},
          businessCase: decisionArtifacts.businessCase || decisionArtifacts.business_case || null,
        },
      });

      logger.info(`[Layer 6] Agent ${agent.agentName}: success=${agentOutput.success}, confidence=${agentOutput.confidence}`);

      const executionResult = this.getAgentExecutionStatus(agentOutput);
      await this.persistAgentAuditEvent({
        decision,
        runtimeAgentId,
        agent,
        eventType: "brain.agent.completed",
        payload: {
          success: agentOutput.success,
          confidence: agentOutput.confidence,
          executionTimeMs: agentOutput.executionTimeMs ?? (Date.now() - executionStartedAt),
          errors: agentOutput.errors || [],
        },
        warningLabel: "completed",
      });

      return {
        status: executionResult.status,
        agentId: runtimeAgentId,
        agentName: agent.agentName,
        reason: executionResult.reason,
        result: agentOutput.result,
        reasoning: agentOutput.reasoning,
        confidence: agentOutput.confidence,
        executionTimeMs: agentOutput.executionTimeMs,
        errors: agentOutput.errors,
      };
    } catch (error) {
      try {
        await coreviaStorage.addAuditEvent(
          decision.decisionId,
          decision.correlationId,
          6,
          "brain.agent.failed",
          {
            agentId: runtimeAgentId,
            agentName: agent.agentName,
            plannedAgentId: agent.agentId,
            plannedMode: agent.mode,
            error: error instanceof Error ? error.message : "Unknown error",
            executionTimeMs: Date.now() - executionStartedAt,
            _audit: {
              actorType: "agent",
              timestamp: new Date().toISOString(),
            },
          },
          runtimeAgentId
        );
      } catch (err) {
        logger.warn(
          `[Layer 6] Warning: Could not persist agent failed event (${runtimeAgentId}):`,
          err instanceof Error ? err.message : err
        );
      }
      throw error;
    }
  }

  private buildAdvisoryPackage(
    decision: DecisionObject,
    internalOutput?: Record<string, unknown>,
    hybridResult?: HybridAnalysisResult,
    agentOutputs?: Record<string, Record<string, unknown>>
  ): AdvisoryData {
    const hybridAnalysis = hybridResult?.structuredAnalysis;
    const hybridOutput = hybridResult ? { ...hybridResult } as Record<string, unknown> : undefined;

    const options = this.generateOptions(decision, hybridAnalysis);
    const risks = this.generateRisks(decision, hybridAnalysis, agentOutputs);
    const evidence = this.gatherEvidence(internalOutput, agentOutputs);

    const contextAssumptions = decision.context?.assumptions?.map(a => ({
      assumption: `${a.field}: ${a.assumedValue}`,
      basis: a.reason,
    })) || [];

    const hybridAssumptions = hybridAnalysis?.assumptions?.map(a => ({
      assumption: a.assumption,
      basis: a.basis,
    })) || [];

    const assumptions = [...contextAssumptions, ...hybridAssumptions];

    const proposedActions = this.generateProposedActions(decision, options);

    const overallConfidence = this.calculateConfidence(
      internalOutput,
      hybridResult,
      agentOutputs
    );

    const internalScoring = (internalOutput?.scoring as Record<string, unknown>) || {};
    const confidenceBreakdown: Record<string, number> = {
      internal: (internalScoring.overallScore as number) || 0,
      hybrid: hybridAnalysis?.confidenceScore || 0,
      agents: Object.values(agentOutputs || {}).some(a => a.status === "completed") ? 70 : 0,
    };

    return {
      options,
      risks,
      evidence,
      assumptions,
      proposedActions,
      internalEngineOutput: internalOutput,
      hybridEngineOutput: hybridOutput,
      agentOutputs,
      overallConfidence,
      confidenceBreakdown,
    };
  }

  private generateOptions(
    decision: DecisionObject,
    hybridAnalysis?: HybridAnalysisResult["structuredAnalysis"]
  ): AdvisoryData["options"] {
    if (hybridAnalysis?.options && hybridAnalysis.options.length > 0) {
      return hybridAnalysis.options.map(opt => ({
        id: randomUUID(),
        name: opt.name,
        description: opt.description,
        pros: opt.pros,
        cons: opt.cons,
        recommendationScore: opt.recommendationScore,
      }));
    }

    const inputRec = this.asRecord(decision.input?.normalizedInput || decision.input?.rawInput);
    const projectName = this.firstString([inputRec.projectName, inputRec.title], "Project");
    const dept = this.firstString([inputRec.department]);
    const objective = this.firstString([inputRec.businessObjective, inputRec.description]);
    const urgency = this.firstString([inputRec.urgency], "Medium");
    const budget = this.firstString([inputRec.estimatedBudget, inputRec.budgetRange]);
    const completeness = decision.context?.completenessScore || 50;
    const riskLevel = decision.classification?.riskLevel || "medium";
    const isHighUrgency = ["Critical", "High", "critical", "high"].includes(urgency);
    const isLowCompleteness = completeness < 50;

    const deptLabel = dept ? ` within ${dept}` : "";
    const budgetLabel = budget ? ` (Est. budget: ${budget})` : "";
    const objectiveSnippet = objective.length > 80 ? objective.substring(0, 80) + "..." : objective;

    return this.buildDefaultOptions({
      projectName,
      deptLabel,
      objectiveSnippet,
      budgetLabel,
      budget,
      riskLevel,
      completeness,
      isHighUrgency,
      isLowCompleteness,
    });
  }

  private appendHybridRisks(
    risks: AdvisoryData["risks"],
    hybridAnalysis?: HybridAnalysisResult["structuredAnalysis"],
  ): void {
    if (!hybridAnalysis?.risks || hybridAnalysis.risks.length === 0) {
      return;
    }
    for (const risk of hybridAnalysis.risks) {
      risks.push({
        id: randomUUID(),
        category: risk.category,
        description: risk.description,
        likelihood: risk.likelihood,
        impact: risk.impact,
        mitigation: risk.mitigation,
      });
    }
  }

  private appendAgentRisks(
    risks: AdvisoryData["risks"],
    agentOutputs?: Record<string, Record<string, unknown>>,
  ): void {
    const riskAgentOutput = agentOutputs?.risk_controls;
    if (!riskAgentOutput?.identifiedRisks) {
      return;
    }

    const agentRisks = riskAgentOutput.identifiedRisks as Array<Record<string, unknown>>;
    const controls = (riskAgentOutput.recommendedControls as string[]) || [];

    for (const [index, risk] of agentRisks.entries()) {
      const alreadyExists = risks.some((existingRisk) =>
        existingRisk.category === this.asString(risk.category)
        && existingRisk.description.toLowerCase().includes(this.firstString([risk.description]).toLowerCase().substring(0, 20)),
      );

      if (!alreadyExists) {
        risks.push({
          id: randomUUID(),
          category: this.firstString([risk.category], "General"),
          description: this.firstString([risk.description], "Unspecified risk"),
          likelihood: (risk.likelihood as "low" | "medium" | "high") || "medium",
          impact: (risk.impact as "low" | "medium" | "high" | "critical") || "medium",
          mitigation: controls[index] || undefined,
        });
      }
    }
  }

  private buildFallbackRisks(decision: DecisionObject): AdvisoryData["risks"] {
    const riskInputRec = this.asRecord(decision.input?.normalizedInput || decision.input?.rawInput);
    const projectName = this.firstString([riskInputRec.projectName, riskInputRec.title], "Project");
    const dept = this.firstString([riskInputRec.department]);
    const riskLevel = decision.classification?.riskLevel || "medium";
    const urgency = this.firstString([riskInputRec.urgency], "Medium");
    const budget = this.firstString([riskInputRec.estimatedBudget, riskInputRec.budgetRange]);
    const existingSystems = riskInputRec.existingSystems;
    const compliance = riskInputRec.complianceRequirements;
    const integration = riskInputRec.integrationRequirements;
    const isHighUrgency = ["Critical", "High", "critical", "high"].includes(urgency);
    const deptLabel = dept ? ` within ${dept}` : "";

    const existingSystemsLabel = this.listPreview(existingSystems, 3);
    const technicalDescription = existingSystemsLabel
      ? `Integration complexity between ${projectName} and existing systems (${existingSystemsLabel})`
      : `Technical integration and architecture risks for ${projectName}${deptLabel}`;
    const generatedRisks: AdvisoryData["risks"] = [{
      id: randomUUID(),
      category: "Technical",
      description: technicalDescription,
      likelihood: riskLevel === "high" ? "high" : "medium",
      impact: "high",
      mitigation: `Conduct technical feasibility assessment for ${projectName}, define integration architecture, and run proof-of-concept before full build`,
    }, {
      id: randomUUID(),
      category: "Resource",
      description: budget
        ? `Budget and resource allocation risk — ${budget} estimated for ${projectName} may require adjustment as scope evolves`
        : `Resource availability and skill gaps for ${projectName} delivery${deptLabel}`,
      likelihood: "medium",
      impact: "high",
      mitigation: `Develop detailed resource and capacity plan for ${projectName} with contingency buffer and skills gap analysis`,
    }];

    if (compliance || integration) {
      const complianceLabel = this.listPreview(compliance, 2);
      const integrationLabel = this.listPreview(integration, 2);
      const complianceDescription = complianceLabel
        ? `Regulatory and compliance requirements for ${projectName}: ${complianceLabel}`
        : `Integration compliance for ${projectName} with ${integrationLabel}`;
      generatedRisks.push({
        id: randomUUID(),
        category: "Compliance",
        description: complianceDescription,
        likelihood: "medium",
        impact: riskLevel === "high" ? "critical" : "high",
        mitigation: `Engage compliance and legal teams early to validate ${projectName} against applicable regulatory frameworks`,
      });
    }

    generatedRisks.push({
      id: randomUUID(),
      category: "Operational",
      description: `Change management and stakeholder adoption challenges for ${projectName}${deptLabel}`,
      likelihood: isHighUrgency ? "high" : "medium",
      impact: "medium",
      mitigation: `Implement structured change management and communication plan for ${projectName} with defined stakeholder engagement milestones`,
    });

    if (isHighUrgency) {
      generatedRisks.push({
        id: randomUUID(),
        category: "Schedule",
        description: `Timeline pressure — ${urgency} urgency for ${projectName} increases risk of scope or quality trade-offs`,
        likelihood: "high",
        impact: "high",
        mitigation: `Define non-negotiable scope boundaries for ${projectName} and establish fast-track governance checkpoints to maintain quality under time pressure`,
      });
    }

    return generatedRisks;
  }

  private generateRisks(
    decision: DecisionObject,
    hybridAnalysis?: HybridAnalysisResult["structuredAnalysis"],
    agentOutputs?: Record<string, Record<string, unknown>>
  ): AdvisoryData["risks"] {
    const risks: AdvisoryData["risks"] = [];
    this.appendHybridRisks(risks, hybridAnalysis);
    this.appendAgentRisks(risks, agentOutputs);

    if (risks.length === 0) {
      risks.push(...this.buildFallbackRisks(decision));
    }

    return risks;
  }

  private gatherEvidence(
    internalOutput?: Record<string, unknown>,
    agentOutputs?: Record<string, Record<string, unknown>>
  ): AdvisoryData["evidence"] {
    const evidence: AdvisoryData["evidence"] = [];
    this.appendInternalEvidence(evidence, internalOutput);

    // ── Extract evidence from agent outputs ──
    if (agentOutputs) {
      for (const [agentId, output] of Object.entries(agentOutputs)) {
        this.appendAgentEvidence(evidence, agentId, output);
      }
    }

    if (evidence.length === 0) {
      evidence.push(this.createFallbackEvidence());
    }

    return evidence;
  }

  private generateProposedActions(
    decision: DecisionObject,
    _options: AdvisoryData["options"]
  ): AdvisoryData["proposedActions"] {
    const input = decision.input?.normalizedInput || decision.input?.rawInput;
    const actionsInputRec = this.asRecord(input);
    const projectName = this.firstString([actionsInputRec.projectName, actionsInputRec.title], "Project");
    const dept = this.firstString([actionsInputRec.department]);
    const deptLabel = dept ? ` (${dept})` : "";

    return [
      {
        id: randomUUID(),
        type: "create_portfolio_item",
        description: `Register ${projectName} in the portfolio for governance tracking and resource allocation`,
        agentId: "portfolio_sync",
        payload: {
          projectName,
          status: "pending_approval",
        },
        requiresApproval: true,
      },
      {
        id: randomUUID(),
        type: "notify_stakeholders",
        description: `Notify relevant stakeholders${deptLabel} about the ${projectName} decision outcome`,
        requiresApproval: true,
      },
      {
        id: randomUUID(),
        type: "update_records",
        description: `Update governance records and decision audit trail for ${projectName}`,
        requiresApproval: false,
      },
    ];
  }

  private calculateConfidence(
    internalOutput?: Record<string, unknown>,
    hybridResult?: HybridAnalysisResult,
    agentOutputs?: Record<string, Record<string, unknown>>
  ): number {
    let totalScore = 0;
    let weights = 0;

    if (internalOutput?.status === "completed") {
      const scoring = (internalOutput.scoring as Record<string, unknown>) || {};
      const internalScore = (scoring.overallScore as number) || 60;

      const rag = internalOutput.rag as Record<string, unknown> | undefined;
      const ragBonus = (rag?.totalDocuments as number) > 0 ? Math.min(10, (rag?.totalDocuments as number) * 2) : 0;

      const patterns = internalOutput.patterns as Record<string, unknown> | undefined;
      const patternBonus = (patterns?.similarDecisions as number) > 0
        ? Math.min(10, (patterns?.similarDecisions as number) * 2)
        : 0;

      totalScore += Math.min(100, internalScore + ragBonus + patternBonus) * 0.4;
      weights += 0.4;
    }

    if (hybridResult && (hybridResult.status === "completed" || hybridResult.status === "fallback")) {
      const hybridConfidence = hybridResult.structuredAnalysis?.confidenceScore || 55;
      const statusBonus = hybridResult.status === "completed" ? 5 : 0;
      // Dual-provider boost: if both providers contributed, higher confidence
      const dualBonus = (hybridResult.model?.startsWith("dual(")) ? 8 : 0;
      totalScore += Math.min(100, hybridConfidence + statusBonus + dualBonus) * 0.35;
      weights += 0.35;
    }

    // Use individual agent confidence scores instead of flat counting
    const agentEntries = Object.values(agentOutputs || {});
    const completedAgents = agentEntries.filter(a => a.status === "completed");
    if (completedAgents.length > 0) {
      const agentConfidenceSum = completedAgents.reduce((sum, a) => {
        const result = a.result as Record<string, unknown> | undefined;
        const conf = typeof result?.confidence === "number"
          ? result.confidence * 100
          : 65; // default if agent doesn't report confidence
        return sum + conf;
      }, 0);
      const avgAgentConfidence = agentConfidenceSum / completedAgents.length;
      // Bonus for number of agents (more perspectives = higher confidence)
      const countBonus = Math.min(10, completedAgents.length * 2);
      totalScore += Math.min(100, avgAgentConfidence + countBonus) * 0.25;
      weights += 0.25;
    }

    return weights > 0 ? Math.round(totalScore / weights) : 50;
  }

  private appendInternalEvidence(
    evidence: AdvisoryData["evidence"],
    internalOutput?: Record<string, unknown>,
  ): void {
    const documents = (internalOutput?.documents as Array<Record<string, unknown>>) || [];
    for (const doc of documents) {
      evidence.push({
        id: randomUUID(),
        source: this.firstString([doc.source, doc.filename], "Knowledge Base"),
        type: "document",
        content: this.firstString([doc.content, doc.summary], "Document content"),
        confidence: doc.relevanceScore as number | undefined,
        documentId: doc.id as string | undefined ?? doc.documentId as string | undefined,
        filename: (doc.filename || doc.source) as string | undefined,
        category: doc.category as string | undefined,
        accessLevel: doc.accessLevel as string | undefined,
        uploadedBy: doc.uploadedBy as string | undefined,
        uploadedAt: doc.uploadedAt as string | undefined,
      });
    }

    const patterns = internalOutput?.patterns as Record<string, unknown> | undefined;
    if (patterns && (patterns.similarDecisions as number) > 0) {
      const similarCount = Number(patterns.similarDecisions);
      const successPct = Math.round(Number(patterns.successRate) * 100);
      const factors = Array.isArray(patterns.commonFactors) ? (patterns.commonFactors as string[]).join(". ") : "";
      evidence.push({
        id: randomUUID(),
        source: "Historical Decision Analysis",
        type: "data",
        content: `${similarCount} similar decisions found with ${successPct}% success rate. ${factors}`,
        confidence: Math.min(90, 50 + similarCount * 5),
      });
    }
  }

  private buildEvidenceCollectorEntries(agentId: string, result: Record<string, unknown>): AdvisoryData["evidence"] {
    const evidence: AdvisoryData["evidence"] = [];
    if (!Array.isArray(result.documents)) {
      return evidence;
    }
    for (const doc of result.documents as Array<Record<string, unknown>>) {
      evidence.push({
        id: randomUUID(),
        source: this.firstString([doc.source, doc.filename], `Agent: ${agentId}`),
        type: "document",
        content: this.firstString([doc.content, doc.summary]),
        confidence: typeof doc.score === "number" ? Math.round(doc.score * 100) : 70,
      });
    }
    return evidence;
  }

  private buildFinancialEvidence(result: Record<string, unknown>): AdvisoryData["evidence"][number] | null {
    if (!(result.totalInvestment || result.npv)) {
      return null;
    }
    const npv = this.asNumber(result.npv);
    const roi = this.asNumber(result.roi);
    const paybackPeriod = this.asOptionalString(result.paybackPeriod) || "N/A";
    const investmentGrade = this.asOptionalString(result.investmentGrade) || "pending";
    return {
      id: randomUUID(),
      source: "Financial Analysis (Agent)",
      type: "data",
      content: `Financial projection: NPV ${npv} AED, ROI ${roi}%, Payback ${paybackPeriod} years. Investment grade: ${investmentGrade}.`,
      confidence: this.asConfidencePercent(result.confidence, 75),
    };
  }

  private buildRiskEvidence(agentId: string, result: Record<string, unknown>): AdvisoryData["evidence"][number] | null {
    if ((agentId !== "risk_controls" && agentId !== "risk_assessment") || !Array.isArray(result.identifiedRisks)) {
      return null;
    }
    const overallRiskLevel = this.asOptionalString(result.overallRiskLevel) || "medium";
    const summary = this.asString(result.summary);
    return {
      id: randomUUID(),
      source: `Risk Analysis (${agentId})`,
      type: "data",
      content: `${result.identifiedRisks.length} risks identified. Overall risk level: ${overallRiskLevel}. ${summary}`,
      confidence: this.asConfidencePercent(result.confidence, 70),
    };
  }

  private buildAlignmentEvidence(agentId: string, result: Record<string, unknown>): AdvisoryData["evidence"][number] | null {
    if (agentId !== "alignment_scoring" || !result.overallAlignment) {
      return null;
    }
    const overallAlignment = this.asNumber(result.overallAlignment);
    const alignmentGrade = this.asOptionalString(result.alignmentGrade) || "pending";
    const summary = this.asString(result.summary);
    return {
      id: randomUUID(),
      source: "Strategic Alignment Analysis (Agent)",
      type: "data",
      content: `Overall strategic alignment: ${overallAlignment}%. Grade: ${alignmentGrade}. ${summary}`,
      confidence: this.asConfidencePercent(result.confidence, 75),
    };
  }

  private buildComplianceEvidence(agentId: string, result: Record<string, unknown>): AdvisoryData["evidence"][number] | null {
    if ((agentId !== "policy_analysis" && agentId !== "controls") || !result.complianceScore) {
      return null;
    }
    const complianceScore = this.asNumber(result.complianceScore);
    const issuesSummary = Array.isArray(result.issues) ? `${result.issues.length} issues found.` : "";
    const summary = this.asString(result.summary);
    return {
      id: randomUUID(),
      source: `Compliance Analysis (${agentId})`,
      type: "data",
      content: `Compliance score: ${complianceScore}%. ${issuesSummary} ${summary}`,
      confidence: this.asConfidencePercent(result.confidence, 70),
    };
  }

  private businessCaseIdentifierPrefix(projectName: string, orgName: string, needsProject: boolean, needsOrg: boolean): string {
    const prefixParts: string[] = [];
    if (projectName && needsProject) {
      prefixParts.push(`Project: ${projectName}.`);
    }
    if (orgName && needsOrg) {
      prefixParts.push(`Organization: ${orgName}.`);
    }
    return prefixParts.join(" ");
  }

  private appendAgentEvidence(
    evidence: AdvisoryData["evidence"],
    agentId: string,
    output: Record<string, unknown>,
  ): void {
    if (output.status !== "completed") {
      return;
    }

    const result = output.result as Record<string, unknown> | undefined;
    if (!result) {
      return;
    }

    if (agentId === "evidence_collector") {
      evidence.push(...this.buildEvidenceCollectorEntries(agentId, result));
      return;
    }

    const financialEvidence = this.buildFinancialEvidence(result);
    if (financialEvidence) {
      evidence.push(financialEvidence);
      return;
    }

    const riskEvidence = this.buildRiskEvidence(agentId, result);
    if (riskEvidence) {
      evidence.push(riskEvidence);
      return;
    }

    const alignmentEvidence = this.buildAlignmentEvidence(agentId, result);
    if (alignmentEvidence) {
      evidence.push(alignmentEvidence);
      return;
    }

    const complianceEvidence = this.buildComplianceEvidence(agentId, result);
    if (complianceEvidence) {
      evidence.push(complianceEvidence);
    }
  }

  /**
   * Score a BUSINESS_CASE artifact's content quality (0-100).
   * Measures completeness of key fields: executive summary, financials, risks, objectives, etc.
   */
  private evaluateBusinessCaseCandidate(
    content: Record<string, unknown>,
    decision: DecisionObject,
  ): { ok: boolean; issues: string[] } {
    const input = this.asRecord(decision.input?.normalizedInput || decision.input?.rawInput);
    const projectName = this.firstString([input.projectName, input.suggestedProjectName, input.title]).trim();
    const orgName = this.firstString([input.organizationName, input.organization]).trim();
    const objective = this.firstString([input.businessObjective, input.description]).trim();

    const issues: string[] = [];

    const asText = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const contentRec = this.asRecord(content);
    const projectTitle = asText(contentRec.projectTitle) || asText(contentRec.title);
    const execSummary = asText(content.executiveSummary);
    const backgroundContext = asText(contentRec.backgroundContext);
    const problemStatement = asText(contentRec.problemStatement);
    const solutionOverview = asText(content.solutionOverview) || asText(content.proposedSolution);
    const businessRequirements = asText(content.businessRequirements);
    const proposedSolution = asText(content.proposedSolution) || asText(content.solutionOverview);
    const recommendations = asText(contentRec.recommendations);

    const impl = Array.isArray(content.implementationPhases) ? (content.implementationPhases as unknown[]) : [];

    const forbiddenPatterns = [
      /key requirements derived from/i,
      /the requesting entity proposes/i,
      /aligned with organizational digital transformation objectives/i,
      /supports operational excellence and service delivery improvement/i,
    ];
    this.appendBusinessCaseFieldLengthIssues({
      issues,
      execSummary,
      solutionOverview,
      businessRequirements,
      proposedSolution,
      implementationPhases: impl,
    });

    const combinedRaw = `${projectTitle}\n${execSummary}\n${backgroundContext}\n${problemStatement}\n${solutionOverview}\n${businessRequirements}\n${proposedSolution}\n${recommendations}`;
    const combined = combinedRaw.toLowerCase();
    const combinedNormalized = combined
      .replaceAll(/[^a-z0-9\s]+/g, " ")
      .replaceAll(/\s+/g, " ")
      .trim();
    for (const re of forbiddenPatterns) {
      if (re.test(combined)) issues.push(`contains_boilerplate:${String(re)}`);
    }
    this.appendBusinessCaseReferenceIssues({
      issues,
      projectName,
      orgName,
      objective,
      combined,
      combinedNormalized,
    });

    return { ok: issues.length === 0, issues };
  }

  private async repairBusinessCaseDraft(params: {
    decision: DecisionObject;
    outputSchemaId: string;
    outputSchemaSpec?: string;
    internalOutput?: Record<string, unknown>;
    agentOutputs: Record<string, Record<string, unknown>>;
    enginePluginId?: string;
    issues: string[];
  }): Promise<Record<string, unknown> | null> {
    const repairInstructions = `

QUALITY REPAIR MODE (BUSINESS_CASE):
- The previous output failed quality gates: ${params.issues.join(", ")}
- Rewrite the BUSINESS_CASE to be SPECIFIC to the provided demand report.
- Include the exact Project Name from KEY CONTEXT verbatim in BOTH executiveSummary and solutionOverview.
- Use the exact Organization Name from KEY CONTEXT if provided. Do NOT guess or expand acronyms.
- Ensure these fields are strong, non-generic, and > 160 chars each: executiveSummary, solutionOverview, businessRequirements, proposedSolution.
- Ensure implementationPhases contains 3–6 phases with realistic owners, tasks, deliverables, and durationMonths.
- Do NOT use boilerplate phrases like "Key requirements derived from" or "The requesting entity proposes".
`;

    const repaired = await this.hybridEngine.generateArtifactDraft({
      decision: params.decision,
      artifactType: "BUSINESS_CASE",
      outputSchemaId: params.outputSchemaId,
      outputSchemaSpec: `${params.outputSchemaSpec || ""}${repairInstructions}`,
      internalOutput: params.internalOutput,
      agentOutputs: params.agentOutputs,
      enginePluginId: params.enginePluginId,
    });

    if (repaired.status === "completed" && repaired.content) {
      return repaired.content;
    }
    return null;
  }

  private forceBusinessCaseIdentifiers(content: Record<string, unknown>, decision: DecisionObject): Record<string, unknown> {
    const input = this.asRecord(decision.input?.normalizedInput || decision.input?.rawInput);
    const projectName = this.firstString([input.projectName, input.suggestedProjectName, input.title]).trim();
    const orgName = this.firstString([input.organizationName, input.organization]).trim();

    if (!projectName && !orgName) return content;

    const out: Record<string, unknown> = { ...content };
    const exec = typeof out.executiveSummary === "string" ? out.executiveSummary : "";
    let sol = "";
    if (typeof out.solutionOverview === "string") {
      sol = out.solutionOverview;
    } else if (typeof out.proposedSolution === "string") {
      sol = out.proposedSolution;
    }

    const combined = `${exec}\n${sol}`.toLowerCase();
    const needsProject = Boolean(projectName) && !this.hasReferenceCoverage(projectName, combined, 1);
    const needsOrg = Boolean(orgName) && !this.hasReferenceCoverage(orgName, combined, 1);

    if (needsProject || needsOrg) {
      const prefix = this.businessCaseIdentifierPrefix(projectName, orgName, needsProject, needsOrg);

      if (typeof out.executiveSummary === "string") {
        out.executiveSummary = `${prefix} ${out.executiveSummary}`.trim();
      }

      if (typeof out.solutionOverview === "string") {
        out.solutionOverview = `${prefix} ${out.solutionOverview}`.trim();
      } else if (typeof out.proposedSolution === "string") {
        out.proposedSolution = `${prefix} ${out.proposedSolution}`.trim();
      }
    }

    return out;
  }

  private scoreBusinessCaseContent(content: Record<string, unknown>): { total: number; grade: string; breakdown: Record<string, number> } {
    const breakdown: Record<string, number> = {};

    // Executive summary quality (15 pts)
    const execSummary = this.asString(content.executiveSummary);
    breakdown.executiveSummary = this.scoreByLength(execSummary.length, [[200, 15], [80, 10], [20, 5]]);

    // Financial data (20 pts)
    breakdown.financials = this.scoreFinancialBreakdown(content);

    // Risks (15 pts)
    const risks = Array.isArray(content.identifiedRisks) ? content.identifiedRisks as unknown[] : [];
    breakdown.risks = this.scoreByCount(risks.length, [[3, 15], [1, 10]]);

    // Strategic objectives (10 pts)
    const strats = Array.isArray(content.strategicObjectives) ? content.strategicObjectives as unknown[] : [];
    breakdown.strategicObjectives = this.scoreByCount(strats.length, [[2, 10], [1, 5]]);

    // KPIs (10 pts)
    const kpis = Array.isArray(content.kpis) ? content.kpis as unknown[] : [];
    breakdown.kpis = this.scoreByCount(kpis.length, [[3, 10], [1, 5]]);

    // Problem statement / solution (10 pts)
    const problem = this.asString(content.problemStatement);
    const solution = this.firstString([content.solutionOverview, content.proposedSolution]);
    const problemScore = this.scoreByLength(problem.length, [[50, 5], [10, 2]]);
    const solutionScore = this.scoreByLength(solution.length, [[50, 5], [10, 2]]);
    breakdown.problemSolution = problemScore + solutionScore;

    // Compliance (10 pts)
    const compReqs = Array.isArray(content.complianceRequirements) ? content.complianceRequirements as unknown[] : [];
    const compScore = typeof content.complianceScore === "number" ? content.complianceScore : 0;
    breakdown.compliance = (compReqs.length > 0 ? 5 : 0) + (compScore > 0 ? 5 : 0);

    // Recommendations (10 pts)
    breakdown.recommendations = this.scoreRecommendationBreakdown(content);

    const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
    const grade = this.gradeFromTotal(total);

    return { total, grade, breakdown };
  }
}
