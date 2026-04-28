import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Layers, AlertTriangle } from "lucide-react";
import { fetchDecision, approveDecision, runActions } from "@/api/brain";
import { useToast } from "@/hooks/use-toast";
import { ApprovalGatePanel } from "@/modules/intelligence/components/ApprovalGatePanel";
import { BRAIN_LAYERS } from "@/lib/brain-utils";
import { renderLayerDetailContent, renderAgentSignalsPanel, renderPolicyOpsContent, renderAuditTrailContent, renderEvidenceAndArtifactsCard, renderTimelineContent, renderSpineContent, renderDecisionContent, renderArtifactsContent } from "./DecisionDetailPanels";
import type { LayerViewContext, TimelineEntry, ArtifactLedgerItem, KnowledgeEvidenceItem } from "./DecisionDetailPanels";

function EmptyState({ title, description }: Readonly<{ title: string; description: string }>) {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: Readonly<{ status?: string }>) {
  const { t } = useTranslation();
  if (!status) return <Badge variant="outline">{t('brain.decisionDetail.unknown')}</Badge>;
  const label = status.replaceAll("_", " ");
  switch (status) {
    case "pending_approval":
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">{t('brain.decisionDetail.pendingApproval')}</Badge>;
    case "blocked":
      return <Badge variant="destructive">{t('brain.decisionDetail.blocked')}</Badge>;
    case "needs_info":
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">{t('brain.decisionDetail.needsInfo')}</Badge>;
    case "executed":
    case "approved":
    case "completed":
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{label}</Badge>;
    default:
      return <Badge variant="outline">{label}</Badge>;
  }
}

function parseArtifactContent(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return typeof raw === "object" ? (raw as Record<string, unknown>) : null;
}

function unwrapDemandArtifactState(raw: unknown): Record<string, unknown> | null {
  const parsed = parseArtifactContent(raw);
  if (!parsed) return null;

  const directReport = parsed.demandReport;
  if (directReport && typeof directReport === "object") {
    return directReport as Record<string, unknown>;
  }

  const nestedContent = parsed.content;
  if (nestedContent && typeof nestedContent === "object") {
    const nestedRecord = nestedContent as Record<string, unknown>;
    if (nestedRecord.demandReport && typeof nestedRecord.demandReport === "object") {
      return nestedRecord.demandReport as Record<string, unknown>;
    }
    return nestedRecord;
  }

  return parsed;
}

function unwrapLifecycleArtifactState(raw: unknown, nestedKeys: string[]): Record<string, unknown> | null {
  const parsed = parseArtifactContent(raw);
  if (!parsed) return null;

  const candidates: Array<Record<string, unknown>> = [parsed];
  if (parsed.content && typeof parsed.content === "object") {
    candidates.push(parsed.content as Record<string, unknown>);
  }
  if (parsed.data && typeof parsed.data === "object") {
    candidates.push(parsed.data as Record<string, unknown>);
  }
  if (parsed.payload && typeof parsed.payload === "object") {
    candidates.push(parsed.payload as Record<string, unknown>);
  }

  for (const candidate of candidates) {
    for (const key of nestedKeys) {
      const nested = candidate[key];
      if (nested && typeof nested === "object") {
        return nested as Record<string, unknown>;
      }
    }
  }

  return parsed;
}

function hasLifecycleValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return value !== undefined && value !== null;
}

function normalizeLifecycleFieldKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function hasRecordLifecycleValue(source: Record<string, unknown> | null | undefined, field: string, aliases: string[] = []): boolean {
  if (!source) return false;
  const normalizedSource = new Map(
    Object.entries(source).map(([key, value]) => [normalizeLifecycleFieldKey(key), value]),
  );
  return [field, ...aliases].some((key) => {
    const exactValue = source[key];
    const normalizedValue = normalizedSource.get(normalizeLifecycleFieldKey(key));
    return hasLifecycleValue(exactValue) || hasLifecycleValue(normalizedValue);
  });
}

function normalizePercentValue(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  const scaledValue = numericValue > 1 ? numericValue : numericValue * 100;
  return Math.max(0, Math.min(100, Math.round(scaledValue)));
}

function asText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asTimestampValue(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return undefined;
}

function resolveContextScore(value: unknown): number | null {
  if (typeof value !== "number") return null;
  if (value > 1) return Math.round(value);
  return Math.round(value * 100);
}

function resolveAgentExecutionStatus(output: Record<string, unknown> | undefined): string {
  const status = asText(output?.status);
  if (status) return status;
  return output?.success ? "completed" : "unknown";
}

function resolveLifecycleAgentStatus(eventData: Record<string, unknown>, action: string): string {
  if (typeof eventData.status === "string") return eventData.status;
  if (eventData.success === true) return "completed";
  if (eventData.success === false) return "failed";
  if (action.includes("started")) return "running";
  return "unknown";
}

function resolveApprovalStatus(
  workflowReadiness: Record<string, unknown> | null | undefined,
  l7Audit: Record<string, unknown> | null,
): string {
  if (workflowReadiness?.versionApproved) {
    return asText(workflowReadiness.versionStatus, "approved").toLowerCase();
  }
  return asText(workflowReadiness?.versionStatus, asText(l7Audit?.status, "pending")).toLowerCase();
}

function resolveConstraintRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function getAuditEventData(event: Record<string, unknown> | undefined): Record<string, unknown> {
  const payload = resolveConstraintRecord(event?.payload);
  return resolveConstraintRecord(payload.eventData);
}

function getAuditEventTime(event: Record<string, unknown> | undefined): number {
  const timestamp = typeof event?.timestamp === "string" ? event.timestamp : "";
  const parsed = timestamp ? new Date(timestamp).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function getEventLayer(event: Record<string, unknown> | undefined): number {
  const payload = resolveConstraintRecord(event?.payload);
  return Number(event?.layer ?? payload.layer ?? 0);
}

function resolveDemandArtifactTypeMatch(activeType: string, artifactType: string): boolean {
  if (activeType === "DEMAND_FIELDS") {
    return artifactType === "DEMAND_FIELDS" || artifactType === "DEMAND_REQUEST";
  }
  return artifactType === "DEMAND_REQUEST";
}

function findLatestDemandArtifactContent(
  artifacts: Array<Record<string, unknown>>,
  activeType: string,
): unknown {
  return [...artifacts]
    .filter((artifact) => resolveDemandArtifactTypeMatch(activeType, asText(artifact.artifactType)))
    .sort((left, right) => {
      const leftPriority = asText(left.artifactType) === activeType ? 1 : 0;
      const rightPriority = asText(right.artifactType) === activeType ? 1 : 0;
      if (leftPriority !== rightPriority) return rightPriority - leftPriority;
      const leftTime = new Date(asTimestampValue(left.latestCreatedAt) ?? "0").getTime();
      const rightTime = new Date(asTimestampValue(right.latestCreatedAt) ?? "0").getTime();
      return rightTime - leftTime;
    })
    .at(0)?.latestContent;
}

function buildKnowledgeEvidence(
  retrievalLogs: Array<Record<string, unknown>>,
  translate: (key: string) => string,
): KnowledgeEvidenceItem[] {
  return retrievalLogs.map((log, idx) => ({
    key: `retrieval-${idx}`,
    title: asText(log.title, asText(log.filename, asText(log.source, translate('brain.decisionDetail.knowledgeEvidence')))),
    snippet: asText(log.snippet, asText(log.summary, translate('brain.decisionDetail.retrievedContextEvidence'))),
    source: asText(log.source, translate('brain.decisionDetail.knowledgeBase')),
    score: typeof log.score === "number" ? log.score : null,
    category: log.category == null ? null : asText(log.category),
    accessLevel: log.accessLevel == null ? null : asText(log.accessLevel),
    uploadedAt: log.uploadedAt == null ? null : asText(log.uploadedAt),
  }));
}

function calculateDemandCompleteness(
  summaries: Array<{ filled: number; total: number }>,
): number | null {
  if (summaries.length === 0) return null;
  return Math.round(
    summaries.reduce((total, section) => total + section.filled, 0)
    / summaries.reduce((total, section) => total + section.total, 0)
    * 100,
  );
}

function buildArtifactLedgerItems(
  artifacts: Array<Record<string, unknown>>,
): ArtifactLedgerItem[] {
  return artifacts.map((artifact) => ({
    key: asText(artifact.artifactId, `artifact-${asText(artifact.artifactType, "unknown")}`),
    artifactType: asText(artifact.artifactType).replaceAll("_", " "),
    version: asText(artifact.currentVersion, asText(artifact.latestVersion, "-")),
    status: asText(artifact.status, "pending"),
    latestChangeSummary: asText(artifact.latestChangeSummary) || null,
  }));
}

function buildAgentSignals(
  advisoryAgentOutputs: Record<string, unknown> | undefined,
  orchestrationPlan: Record<string, unknown> | undefined,
  normalizeAgentScore: (value: unknown) => number | null,
): Array<{ name: string; score: number | null; status: string }> {
  if (advisoryAgentOutputs && Object.keys(advisoryAgentOutputs).length > 0) {
    return Object.entries(advisoryAgentOutputs)
      .map(([agentId, outputValue]) => {
        const output = resolveConstraintRecord(outputValue);
        return {
          name: asText(output.agentName, agentId),
          score: normalizeAgentScore(output.confidence),
          status: resolveAgentExecutionStatus(output),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const executionPlan = Array.isArray(orchestrationPlan?.executionPlan)
    ? (orchestrationPlan.executionPlan as Array<Record<string, unknown>>)
    : [];
  if (executionPlan.length > 0) {
    return executionPlan.map((agent) => ({
      name: asText(agent.name, asText(agent.agentName, asText(agent.target, asText(agent.agentId, asText(agent.id, "Agent"))))),
      score: normalizeAgentScore(agent.confidence ?? agent.score),
      status: asText(agent.status, "planned"),
    }));
  }

  const selectedAgents = Array.isArray(orchestrationPlan?.agentsSelected)
    ? orchestrationPlan.agentsSelected
    : [];
  return selectedAgents.map((value) => {
    const agent = resolveConstraintRecord(value);
    return {
      name: Object.keys(agent).length > 0
        ? asText(agent.agentName, asText(agent.agentId, asText(agent.name, "Agent")))
        : asText(value, "Agent"),
      score: null,
      status: "selected",
    };
  });
}

function buildRealAgents(rawAgentList: unknown): Array<{ agentId: string; agentName: string; mode: string }> {
  if (!Array.isArray(rawAgentList)) return [];
  return rawAgentList.map((value) => {
    const agent = resolveConstraintRecord(value);
    return {
      agentId: asText(agent.agentId),
      agentName: asText(agent.agentName, asText(agent.agentId, "Agent")),
      mode: asText(agent.mode, "read"),
    };
  });
}

function isCoreWorkflowService(serviceId: string): boolean {
  return [
    "demand_decision",
    "demand_management",
    "demand_analysis",
    "demand_request",
    "business_case",
    "requirements_analysis",
    "assessment",
    "strategic_fit",
    "closure_decision",
    "closure_report",
    "lessons_learned",
    "final_assessment",
  ].includes(serviceId);
}

function resolveRequiredFinalTypes(isCoreSpineWorkflow: boolean): readonly string[] {
  return isCoreSpineWorkflow ? ["BUSINESS_CASE", "REQUIREMENTS", "STRATEGIC_FIT"] : [];
}

function isKnownSubDecisionType(value: string, knownTypes: readonly string[]): boolean {
  return knownTypes.includes(value);
}

function computeDemandWorkflowFromVersionStatus(versionStatus: unknown): string | null {
  const status = typeof versionStatus === "string" ? versionStatus.toLowerCase() : "";
  if (status === "under_review") return "under_review";
  if (status === "approved") return "initially_approved";
  if (status === "published") return "manager_approved";
  if (status === "rejected") return "rejected";
  if (status === "draft") return "draft";
  if (status) return status;
  return null;
}

function normalizeWorkflowVersionType(value: unknown): string | null {
  const normalized = asText(value).trim().replaceAll(/[-\s]+/g, "_").toLowerCase();
  if (!normalized) return null;
  if (["requirements", "requirements_analysis", "detailed_requirements"].includes(normalized)) {
    return "requirements";
  }
  if (["business_case", "businesscase"].includes(normalized)) {
    return "business_case";
  }
  if (["strategic_fit", "strategicfit"].includes(normalized)) {
    return "strategic_fit";
  }
  if (["demand_management", "demand", "demand_request"].includes(normalized)) {
    return "demand_management";
  }
  return normalized;
}

function getLifecycleRouteContext(type?: string | null): { serviceId: string; routeKey?: string } | null {
  switch (type) {
    case "DEMAND_FIELDS":
    case "DEMAND_REQUEST":
      return { serviceId: "demand_management", routeKey: "demand.new" };
    case "BUSINESS_CASE":
      return { serviceId: "business_case", routeKey: "business_case.generate" };
    case "REQUIREMENTS":
    case "DETAILED_REQUIREMENTS":
      return { serviceId: "requirements_analysis" };
    case "STRATEGIC_FIT":
      return { serviceId: "strategic_fit" };
    default:
      return null;
  }
}

function resolveVersionLifecycleState(params: {
  type: string;
  hasCurrentDecision: boolean;
  versionTypeMap: Record<string, string>;
  latestVersionByType: Record<string, Record<string, unknown>>;
  workflowReadiness: Record<string, unknown> | null | undefined;
  workflowReadinessVersionType: string | null;
  decisionStatus: string;
}): { status: string; version: string; timestamp: string | undefined; isComplete: boolean } {
  const {
    type,
    hasCurrentDecision,
    versionTypeMap,
    latestVersionByType,
    workflowReadiness,
    workflowReadinessVersionType,
    decisionStatus,
  } = params;
  const versionKey = versionTypeMap[type];
  const reportVersion = versionKey ? latestVersionByType[versionKey] : null;
  const reportStatus = reportVersion ? computeDemandWorkflowFromVersionStatus(reportVersion?.status) : null;
  const readinessMatches = Boolean(
    hasCurrentDecision
    && workflowReadiness
    && versionKey
    && (!workflowReadinessVersionType || workflowReadinessVersionType === versionKey),
  );
  const readinessStatus = readinessMatches ? asText(workflowReadiness?.versionStatus).toLowerCase() || null : null;
  const resolvedStatus = readinessStatus || reportStatus || (hasCurrentDecision ? decisionStatus : "draft");
  const readinessApproved = readinessMatches && Boolean(workflowReadiness?.versionApproved);
  const reportApproved = asText(reportVersion?.status).toLowerCase();
  return {
    status: resolvedStatus,
    version: asText(reportVersion?.versionNumber, asText(workflowReadiness?.versionNumber, "-")),
    timestamp: readinessMatches ? asTimestampValue(workflowReadiness?.approvedAt) : undefined,
    isComplete: readinessApproved || reportApproved === "approved" || reportApproved === "published",
  };
}

function resolveAgentNameList(
  realAgents: Array<{ agentId: string; agentName: string; mode: string }>,
  agentSignals: Array<{ name: string; score: number | null; status: string }>,
  fallback: string,
): string {
  if (realAgents.length > 0) return realAgents.map((agent) => agent.agentName).join(" · ");
  if (agentSignals.length > 0) return agentSignals.map((agent) => agent.name).join(" · ");
  return fallback;
}

function buildScopedLifecycleAuditTrail(
  auditTrail: Array<Record<string, unknown>>,
  lifecycleRouteContext: { serviceId: string; routeKey?: string } | null,
): Array<Record<string, unknown>> {
  if (auditTrail.length === 0 || !lifecycleRouteContext) {
    return auditTrail;
  }

  const normalizedServiceId = lifecycleRouteContext.serviceId.toLowerCase();
  const normalizedRouteKey = lifecycleRouteContext.routeKey?.toLowerCase();
  const matchingIntakes = auditTrail
    .filter((event) => {
      const eventData = getAuditEventData(event);
      const eventServiceId = asText(eventData.serviceId).toLowerCase();
      const eventRouteKey = asText(eventData.routeKey).toLowerCase();
      if (eventServiceId !== normalizedServiceId) return false;
      if (normalizedRouteKey && eventRouteKey !== normalizedRouteKey) return false;
      return getEventLayer(event) === 1;
    })
    .sort((left, right) => getAuditEventTime(left) - getAuditEventTime(right));

  const latestMatchingIntake = matchingIntakes.at(-1);
  const correlationId = typeof latestMatchingIntake?.correlationId === "string"
    ? latestMatchingIntake.correlationId
    : null;
  if (!correlationId) return auditTrail;
  return auditTrail.filter((event) => event?.correlationId === correlationId);
}

function getLayerAuditData(
  layerNum: number,
  events: Array<Record<string, unknown>>,
): Record<string, unknown> | null {
  const matched = events.filter((event) => getEventLayer(event) === layerNum);
  if (matched.length === 0) return null;
  const latest = [...matched].sort((left, right) => getAuditEventTime(left) - getAuditEventTime(right)).at(-1);
  const eventData = getAuditEventData(latest);
  return Object.keys(eventData).length > 0 ? eventData : null;
}

function normalizeUseCaseType(value?: string | null): string | undefined {
  const normalized = (value ?? "")
    .trim()
    .replaceAll(/[-\s]+/g, "_")
    .toLowerCase();
  if (!normalized) return undefined;
  if (["requirements", "requirements_analysis", "detailed_requirements"].includes(normalized)) {
    return "requirements_analysis";
  }
  if (["business_case", "businesscase"].includes(normalized)) {
    return "business_case";
  }
  if (["strategic_fit", "strategicfit"].includes(normalized)) {
    return "strategic_fit";
  }
  if (["demand_management", "demand", "demand_request"].includes(normalized)) {
    return "demand_management";
  }
  return normalized;
}

function getJourneyServiceLabel(sid: string): string {
  const s = sid.toLowerCase().replaceAll(/[-\s]+/g, "_");
  if (["requirements_analysis", "requirements", "detailed_requirements"].includes(s)) return "DEMAND_DECISION";
  if (["demand_management", "demand_request", "demand_intake", "demand", "demand_analysis"].includes(s)) return "DEMAND_REQUEST";
  if (["business_case", "businesscase"].includes(s)) return "BUSINESS_CASE";
  if (["strategic_fit", "strategicfit"].includes(s)) return "STRATEGIC_FIT";
  if (s === "assessment") return "ASSESSMENT";
  if (s === "closure_report") return "CLOSURE_DECISION";
  if (s === "lessons_learned") return "LESSONS_LEARNED";
  if (s === "final_assessment") return "FINAL_ASSESSMENT";
  return sid || "corevia";
}

function mapSubDecisionUseCase(type?: string | null): string | undefined {
  switch ((type ?? "").toUpperCase()) {
    case "DEMAND_FIELDS":
    case "DEMAND_REQUEST":
      return "demand_management";
    case "BUSINESS_CASE":
      return "business_case";
    case "REQUIREMENTS":
    case "DETAILED_REQUIREMENTS":
      return "requirements_analysis";
    case "STRATEGIC_FIT":
      return "strategic_fit";
    case "MARKET_RESEARCH":
      return "market_research";
    default:
      return undefined;
  }
}

function mapUseCaseToSubDecisionType(value?: string | null): string | undefined {
  switch (normalizeUseCaseType(value)) {
    case "demand_management":
      return "DEMAND_FIELDS";
    case "business_case":
      return "BUSINESS_CASE";
    case "requirements_analysis":
      return "REQUIREMENTS";
    case "strategic_fit":
      return "STRATEGIC_FIT";
    default:
      return undefined;
  }
}

const SUB_DECISION_ORDER = [
  "DEMAND_FIELDS",
  "DEMAND_REQUEST",
  "BUSINESS_CASE",
  "REQUIREMENTS",
  "MARKET_RESEARCH",
  "STRATEGIC_FIT",
  "PLAN",
  "WBS",
  "WBS_BASELINE",
  "CONVERSION",
] as const;

function subDecisionGroupKey(type: string): string {
  switch (type) {
    case "DEMAND_FIELDS":
    case "DEMAND_REQUEST":
      return "demand";
    case "BUSINESS_CASE":
    case "REQUIREMENTS":
    case "STRATEGIC_FIT":
      return "core";
    case "MARKET_RESEARCH":
      return "research";
    case "PLAN":
    case "WBS":
    case "WBS_BASELINE":
      return "delivery";
    case "CONVERSION":
      return "conversion";
    default:
      return "other";
  }
}

function countItems(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function countLifecycleEntries(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).filter(hasLifecycleValue).length;
  }
  return 0;
}

function countObjectEntries(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Object.values(value as Record<string, unknown>).filter(hasLifecycleValue).length;
}

function firstLifecycleText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (Array.isArray(value)) {
      const firstText = value.find((item) => typeof item === "string" && item.trim().length > 0);
      if (typeof firstText === "string") {
        return firstText.trim();
      }
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const nestedText = firstLifecycleText(
        record.summary,
        record.recommendation,
        record.recommendedOption,
        record.primaryRecommendation,
        record.option,
        record.conclusion,
        record.nextStep,
        record.nextSteps,
      );
      if (nestedText) {
        return nestedText;
      }
    }
  }
  return null;
}

const DEMAND_SECTION_FIELD_ALIASES: Record<string, string[]> = {
  businessObjective: ["businessObjective", "enhancedBusinessObjective", "problemStatement", "overview", "description", "objectives"],
  currentChallenges: ["currentChallenges", "challenges", "painPoints"],
  expectedOutcomes: ["expectedOutcomes", "expectedBenefits", "outcomes"],
  successCriteria: ["successCriteria", "kpis", "successMetrics"],
  constraints: ["constraints", "projectConstraints", "limitations", "complianceRequirements", "integrationRequirements"],
  currentCapacity: ["currentCapacity", "capacity"],
  budgetRange: ["budgetRange", "estimatedBudget", "budget", "estimatedCost", "requestedBudget"],
  timeframe: ["timeframe", "timeline", "estimatedTimeline", "duration", "targetDate", "implementationTimeline", "expectedDuration"],
  stakeholders: ["stakeholders", "keyStakeholders", "stakeholdersList", "department", "organizationUnit"],
  existingSystems: ["existingSystems", "currentSystems", "legacySystems"],
  integrationRequirements: ["integrationRequirements", "integrationNeeds"],
  complianceRequirements: ["complianceRequirements", "regulatoryRequirements"],
  riskFactors: ["riskFactors", "riskAssessment", "identifiedRisks", "riskAnalysis"],
};

const DEMAND_SECTION_FIELDS: Record<string, string[]> = {
  vision: ["businessObjective", "currentChallenges", "expectedOutcomes", "successCriteria", "constraints"],
  resources: ["currentCapacity", "budgetRange", "timeframe", "stakeholders"],
  technology: ["existingSystems", "integrationRequirements", "complianceRequirements", "riskFactors"],
};

function computeFinancialSignalCount(payload: Record<string, unknown>): number {
  const explicitScenarios = countItems(payload?.financialScenarios || payload?.scenarios);
  if (explicitScenarios > 0) return explicitScenarios;
  return [
    payload?.implementationCosts,
    payload?.operationalCosts,
    payload?.benefitsBreakdown,
    payload?.costSavings,
  ].filter(hasLifecycleValue).length;
}

function computeDependencyCount(payload: Record<string, unknown>): number {
  const directDependencies = countItems(payload?.dependencies);
  if (directDependencies > 0) return directDependencies;
  const projectDependencies = payload?.projectDependencies as Record<string, unknown> | undefined;
  return countItems(projectDependencies?.dependencies) || countObjectEntries(projectDependencies);
}

function computeRiskCount(payload: Record<string, unknown>): number {
  const directRisks = countItems(payload?.riskRegister || payload?.risks || payload?.identifiedRisks);
  if (directRisks > 0) return directRisks;
  const riskMatrixData = payload?.riskMatrixData as Record<string, unknown> | undefined;
  return countItems(riskMatrixData?.risks) || countObjectEntries(riskMatrixData);
}

function buildDemandSectionSummaries(
  source: Record<string, unknown> | null,
  sectionLabels: Record<string, string>,
): Array<{ key: string; label: string; filled: number; total: number; percent: number; status: string }> {
  if (!source) return [];

  const hasSourceFieldValue = (field: string, aliases: string[] = []) => {
    return hasRecordLifecycleValue(source, field, aliases);
  };

  return Object.entries(DEMAND_SECTION_FIELDS).map(([key, fields]) => {
    const filled = fields.filter((field) => hasSourceFieldValue(field, DEMAND_SECTION_FIELD_ALIASES[field] ?? [])).length;
    const total = fields.length;
    const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
    let status = "missing";
    if (filled === total) {
      status = "complete";
    } else if (filled > 0) {
      status = "partial";
    }
    return { key, label: sectionLabels[key] ?? key, filled, total, percent, status };
  });
}

// ── Module-scope lifecycle detail builders (reduces component cognitive complexity) ──

function normalizeAgentScoreValue(value: unknown): number | null {
  const percentValue = normalizePercentValue(value);
  return percentValue == null ? null : percentValue / 100;
}

function resolveLayerStatusValue(currentLayer: number, layerIndex: number): string {
  return currentLayer >= layerIndex ? "complete" : "pending";
}

function resolveLayerDetailText(
  currentLayer: number,
  layerIndex: number,
  detail: string,
  inProgressLabel: string,
  awaitingLabel: string,
): string {
  if (currentLayer > layerIndex) return detail;
  if (currentLayer === layerIndex) return inProgressLabel;
  return awaitingLabel;
}

function getArtifactVersionText(artifact: Record<string, unknown> | undefined): string {
  return asText(artifact?.currentVersion, asText(artifact?.latestVersion, "-"));
}

function getArtifactOrDecisionStatusText(
  subDecision: Record<string, unknown> | undefined,
  artifact: Record<string, unknown> | undefined,
  hasCurrentDecision: boolean,
  decisionStatus: string,
): string {
  return asText(
    subDecision?.status,
    asText(artifact?.status, hasCurrentDecision ? decisionStatus : "pending"),
  );
}

function getTimelineSummaryText(params: {
  hasArtifact: boolean;
  hasCurrentDecision: boolean;
  hasSubDecision: boolean;
  artifact: Record<string, unknown> | undefined;
  workflowMessage: unknown;
  advisorySummary: unknown;
  advisoryRecommendation: unknown;
  artifactCapturedLabel: string;
  awaitingLabel: string;
  notStartedLabel: string;
}): string {
  if (params.hasArtifact) {
    return asText(params.artifact?.latestChangeSummary, params.artifactCapturedLabel);
  }
  if (params.hasCurrentDecision) {
    return asText(params.workflowMessage, asText(params.advisorySummary, asText(params.advisoryRecommendation, params.awaitingLabel)));
  }
  if (params.hasSubDecision) {
    return params.awaitingLabel;
  }
  return params.notStartedLabel;
}

function getEntryTimestampValue(
  artifact: Record<string, unknown> | undefined,
  versionTimestamp: string | undefined,
  subDecision: Record<string, unknown> | undefined,
  currentDecisionTimestamp: string | undefined,
): string | undefined {
  return asTimestampValue(artifact?.latestCreatedAt)
    ?? versionTimestamp
    ?? asTimestampValue(subDecision?.updatedAt)
    ?? asTimestampValue(subDecision?.createdAt)
    ?? currentDecisionTimestamp;
}

function resolveEngineKindLabel(audit: Record<string, unknown> | null): string {
  if (audit?.useHybridEngine) return "EXTERNAL_HYBRID";
  if (audit?.useInternalEngine) return "SOVEREIGN_INTERNAL";
  return "--";
}

function resolveHybridEngineLabel(
  audit: Record<string, unknown> | null,
  t: (key: string) => string,
): string {
  if (!audit?.usedHybridEngine) return t('brain.decisionDetail.notUsed');
  if (audit?.hybridStatus === "fallback") return t('brain.decisionDetail.fallback');
  return t('brain.decisionDetail.used');
}

function buildIntakeDetail(
  routeCtx: { serviceId: string; routeKey?: string } | null,
  decisionServiceId: unknown,
  decisionRouteKey: unknown,
  l1Audit: Record<string, unknown> | null,
  inputData: Record<string, unknown>,
  rawLabel: string,
  normalizedLabel: string,
): string {
  const svc = asText(routeCtx?.serviceId, asText(decisionServiceId, "corevia"));
  const route = asText(routeCtx?.routeKey, asText(decisionRouteKey));
  const fieldCount = asText(l1Audit?.inputFieldCount) || String(Object.keys(inputData || {}).length);
  const normalized = l1Audit?.normalized === false ? rawLabel : normalizedLabel;
  return `${svc}/${route} · ${fieldCount} fields · ${normalized}`;
}

function buildClassificationDetail(
  classificationLevel: unknown,
  classificationData: Record<string, unknown> | undefined,
  l2Audit: Record<string, unknown> | null,
  decisionRiskLevel: unknown,
  spineSector: unknown,
  spineJurisdiction: unknown,
  notRecordedLabel: string,
): string {
  const level = asText(classificationLevel, asText(l2Audit?.level, notRecordedLabel));
  const risk = asText(classificationData?.riskLevel, asText(l2Audit?.riskLevel, asText(decisionRiskLevel)));
  const sector = asText(classificationData?.sector, asText(l2Audit?.sector, asText(spineSector)));
  const jurisdiction = asText(classificationData?.jurisdiction, asText(l2Audit?.jurisdiction, asText(spineJurisdiction)));
  const parts = [asText(level, notRecordedLabel)];
  if (asText(risk)) parts.push(`Risk: ${asText(risk)}`);
  if (asText(sector)) parts.push(`Sector: ${asText(sector)}`);
  if (asText(jurisdiction)) parts.push(asText(jurisdiction));
  return parts.join(" · ");
}

function buildPolicyGateDetail(
  policyVerdict: unknown,
  l3Audit: Record<string, unknown> | null,
  selectedPolicies: Array<Record<string, unknown> | string>,
  notRecordedLabel: string,
): string {
  const verdict = asText(policyVerdict, asText(l3Audit?.result, notRecordedLabel));
  const policiesCount = Number(l3Audit?.policiesEvaluated ?? selectedPolicies.length ?? 0);
  const mode = asText(l3Audit?.policyMode);
  const policyNames = selectedPolicies
    .map((p) => {
      if (typeof p === "object" && p?.policyName) return asText(p.policyName);
      if (typeof p === "string") return p;
      return "";
    })
    .filter(Boolean);
  let text = `${verdict} — ${policiesCount} policies evaluated`;
  if (policyNames.length > 0) text += ` (${policyNames.join(", ")})`;
  if (l3Audit?.blockingPolicy) text += ` · Blocked: ${asText(l3Audit.blockingPolicy)}`;
  if (mode) text += ` · ${mode}`;
  return text;
}

function buildBusinessCaseContextDetail(
  signals: { options: number; financialScenarios: number; risks: number; dependencies: number; recommendation: string | null },
): string {
  const parts: string[] = [];
  if (signals.options > 0) parts.push(`${signals.options} options`);
  if (signals.financialScenarios > 0) parts.push(`${signals.financialScenarios} financial inputs`);
  if (signals.risks > 0) parts.push(`${signals.risks} risks`);
  if (signals.dependencies > 0) parts.push(`${signals.dependencies} dependencies`);
  parts.push(signals.recommendation ? "Recommendation ready" : "Recommendation pending");
  return parts.join(" · ");
}

function buildRequirementsContextDetail(
  signals: Record<string, number>,
  totalRequirementsCount: number,
): string {
  const parts: string[] = [];
  if (totalRequirementsCount > 0) parts.push(`${totalRequirementsCount} detailed requirements`);
  if ((signals.capabilities ?? 0) > 0) parts.push(`${signals.capabilities} capabilities`);
  if ((signals.capabilityGaps ?? 0) > 0) parts.push(`${signals.capabilityGaps} gaps`);
  parts.push((signals.security ?? 0) > 0 ? "Security coverage present" : "Security coverage pending");
  return parts.join(" · ");
}

function buildStrategicFitContextDetail(signals: Record<string, unknown>): string {
  const sfSignals = signals as Record<string, number | string | null>;
  const parts: string[] = [];
  if ((sfSignals.criteria as number) > 0) parts.push(`${sfSignals.criteria} decision criteria`);
  if ((sfSignals.alternatives as number) > 0) parts.push(`${sfSignals.alternatives} alternatives`);
  if ((sfSignals.alignmentAreas as number) > 0) parts.push(`${sfSignals.alignmentAreas} alignment areas`);
  parts.push(sfSignals.recommendationRoute ? `Route: ${sfSignals.recommendationRoute}` : "Route pending");
  return parts.join(" · ");
}

function buildDefaultContextDetail(
  isDemandLifecycle: boolean,
  activeDemandCompleteness: number | null,
  activeDemandMissingFieldCount: number,
  l4Audit: Record<string, unknown> | null,
  contextScore: unknown,
  contextQuality: Record<string, unknown> | undefined,
  notRecordedLabel: string,
): string {
  const score = isDemandLifecycle ? activeDemandCompleteness : (l4Audit?.completenessScore ?? contextScore);
  const ambiguity = isDemandLifecycle ? null : (l4Audit?.ambiguityScore ?? (contextQuality as unknown as Record<string, unknown> | undefined)?.ambiguityScore);
  const missingFieldsLength = Array.isArray(contextQuality?.missingFields) ? contextQuality.missingFields.length : 0;
  const missing = isDemandLifecycle ? activeDemandMissingFieldCount : (l4Audit?.missingFieldsCount ?? missingFieldsLength);
  const assumptions = isDemandLifecycle ? 0 : Number(l4Audit?.assumptionsCount ?? 0);
  const parts: string[] = [];
  if (score != null) parts.push(`Completeness: ${Number(score)}%`);
  if (ambiguity != null) parts.push(`Ambiguity: ${Number(ambiguity)}%`);
  parts.push(`${Number(missing)} missing fields`);
  if (assumptions > 0) parts.push(`${assumptions} assumptions`);
  return parts.length > 0 ? parts.join(" · ") : notRecordedLabel;
}

function buildContextQualityDetail(params: {
  isBusinessCaseLifecycle: boolean;
  isRequirementsLifecycle: boolean;
  isStrategicFitLifecycle: boolean;
  isDemandLifecycle: boolean;
  businessCaseSignals: { options: number; financialScenarios: number; risks: number; dependencies: number; recommendation: string | null };
  requirementsSignals: Record<string, number>;
  strategicFitSignals: Record<string, unknown>;
  totalRequirementsCount: number;
  activeDemandCompleteness: number | null;
  activeDemandMissingFieldCount: number;
  l4Audit: Record<string, unknown> | null;
  contextScore: unknown;
  contextQuality: Record<string, unknown> | undefined;
  notRecordedLabel: string;
}): string {
  if (params.isBusinessCaseLifecycle) return buildBusinessCaseContextDetail(params.businessCaseSignals);
  if (params.isRequirementsLifecycle) return buildRequirementsContextDetail(params.requirementsSignals, params.totalRequirementsCount);
  if (params.isStrategicFitLifecycle) return buildStrategicFitContextDetail(params.strategicFitSignals);
  return buildDefaultContextDetail(
    params.isDemandLifecycle, params.activeDemandCompleteness, params.activeDemandMissingFieldCount,
    params.l4Audit, params.contextScore, params.contextQuality, params.notRecordedLabel,
  );
}

function buildRequirementsOrchestrationDetail(signals: Record<string, number>, notRecordedLabel: string): string {
  const parts: string[] = [];
  if ((signals.deliveryPhases ?? 0) > 0) parts.push(`${signals.deliveryPhases} delivery phases`);
  if ((signals.roles ?? 0) > 0) parts.push(`${signals.roles} delivery roles`);
  if ((signals.dependencies ?? 0) > 0) parts.push(`${signals.dependencies} dependencies`);
  if ((signals.technologyDomains ?? 0) > 0) parts.push(`${signals.technologyDomains} technology domains`);
  if ((signals.traceabilityLinks ?? 0) > 0) parts.push("Traceability linked");
  return parts.join(" · ") || notRecordedLabel;
}

function buildStrategicFitOrchestrationDetail(signals: Record<string, unknown>, notRecordedLabel: string): string {
  const sfSignals = signals as Record<string, number | null>;
  const parts: string[] = [];
  if ((sfSignals.governanceGates as number) > 0) parts.push(`${sfSignals.governanceGates} governance gates`);
  if ((sfSignals.risks as number) > 0) parts.push(`${sfSignals.risks} strategic risks`);
  if ((sfSignals.governmentInitiatives as number) > 0) parts.push(`${sfSignals.governmentInitiatives} government initiatives`);
  if (sfSignals.routeConfidence != null) parts.push(`Confidence ${sfSignals.routeConfidence}%`);
  return parts.join(" · ") || notRecordedLabel;
}

function buildDefaultOrchestrationDetail(params: {
  iplanId: unknown;
  iplanRouting: Record<string, unknown>;
  iplanRedaction: unknown;
  l5Audit: Record<string, unknown> | null;
  routingPrimary: string;
  primaryPluginName: string;
  realAgentsCount: number;
  agentCount: number;
  displayedAgentNames: string;
  agentNameList: string;
  notRecordedLabel: string;
}): string {
  const primaryKind = asText(params.iplanRouting?.primaryEngineKind, asText(params.l5Audit?.primaryEngineKind, params.routingPrimary));
  const primaryName = asText(params.iplanRouting?.primaryPluginName, asText(params.l5Audit?.primaryPluginName, params.primaryPluginName));
  const agentCountVal = Number(params.l5Audit?.selectedAgentsCount ?? 0) || params.realAgentsCount || params.agentCount;
  const parts: string[] = [];
  if (params.iplanId || params.l5Audit?.iplanId) parts.push(`IPLAN ${asText(params.iplanId, asText(params.l5Audit?.iplanId)).substring(0, 12)}`);
  if (primaryKind && primaryKind !== params.notRecordedLabel) {
    const displayName = primaryName === params.notRecordedLabel ? "default" : primaryName;
    parts.push(`${primaryKind} → ${displayName}`);
  }
  parts.push(`${agentCountVal} agent(s): ${params.displayedAgentNames || params.agentNameList}`);
  if (asText(params.iplanRedaction) && asText(params.iplanRedaction) !== "NONE") parts.push(`Redaction: ${asText(params.iplanRedaction)}`);
  return parts.join(" · ");
}

function buildOrchestrationDetail(params: {
  isRequirementsLifecycle: boolean;
  isStrategicFitLifecycle: boolean;
  requirementsSignals: Record<string, number>;
  strategicFitSignals: Record<string, unknown>;
  iplanId: unknown;
  iplanRouting: Record<string, unknown>;
  iplanRedaction: unknown;
  l5Audit: Record<string, unknown> | null;
  routingPrimary: string;
  primaryPluginName: string;
  realAgentsCount: number;
  agentCount: number;
  displayedAgentNames: string;
  agentNameList: string;
  notRecordedLabel: string;
}): string {
  if (params.isRequirementsLifecycle) return buildRequirementsOrchestrationDetail(params.requirementsSignals, params.notRecordedLabel);
  if (params.isStrategicFitLifecycle) return buildStrategicFitOrchestrationDetail(params.strategicFitSignals, params.notRecordedLabel);
  return buildDefaultOrchestrationDetail(params);
}

function buildAdvisoryDetail(params: {
  isBusinessCaseLifecycle: boolean;
  advisory: Record<string, unknown> | undefined;
  activeEntrySummary: unknown;
  l6Audit: Record<string, unknown> | null;
  advisoryConfidencePercent: number | null;
  engineSummary: string;
}): string {
  const recommendation = params.isBusinessCaseLifecycle
    ? (params.advisory?.recommendation || params.advisory?.summary)
    : params.activeEntrySummary || params.advisory?.recommendation || params.advisory?.summary;
  const optionsCount = params.l6Audit?.optionsGenerated ?? (Array.isArray(params.advisory?.options) ? params.advisory.options.length : 0);
  let advisoryRisksCount = 0;
  if (Array.isArray(params.advisory?.risks)) advisoryRisksCount = params.advisory.risks.length;
  else if (Array.isArray(params.advisory?.risksAndControls)) advisoryRisksCount = params.advisory.risksAndControls.length;
  const risksCount = params.l6Audit?.risksIdentified ?? advisoryRisksCount;
  const agentsExe = params.l6Audit?.agentsExecuted ?? 0;
  const ragDocs = params.l6Audit?.ragDocumentsFound ?? 0;
  const confidence = params.advisoryConfidencePercent == null ? null : `${params.advisoryConfidencePercent}%`;
  const parts: string[] = [];
  if (recommendation) parts.push(asText(recommendation).substring(0, 60));
  else parts.push(`Engines: ${params.engineSummary}`);
  if (optionsCount) parts.push(`${Number(optionsCount)} options`);
  if (risksCount) parts.push(`${Number(risksCount)} risks`);
  if (agentsExe) parts.push(`${Number(agentsExe)} agents ran`);
  if (ragDocs) parts.push(`${Number(ragDocs)} RAG docs`);
  if (confidence) parts.push(`Confidence: ${confidence}`);
  return parts.join(" · ");
}

function buildValidationDetail(
  approvalStatus: string,
  l7Audit: Record<string, unknown> | null,
  notRecordedLabel: string,
): string {
  const status = approvalStatus || notRecordedLabel;
  const hitl = l7Audit?.requiresHitl;
  const passed = l7Audit?.thresholdChecksPassed ?? 0;
  const failed = l7Audit?.thresholdChecksFailed ?? 0;
  const bias = l7Audit?.biasDetected;
  const parts: string[] = [String(status)];
  if (hitl != null) parts.push(`HITL: ${hitl ? "Required" : "No"}`);
  if (passed || failed) parts.push(`Checks: ${Number(passed)}✓ ${Number(failed)}✗`);
  if (bias) parts.push("⚠ Bias detected");
  return parts.join(" · ");
}

function buildMemoryDetail(
  l8Audit: Record<string, unknown> | null,
  executionCount: number,
  memoryCount: number,
  notRecordedLabel: string,
): string {
  const tagsCount = l8Audit?.tagsCount ?? 0;
  const evidenceCount = l8Audit?.evidenceCount ?? 0;
  const learning = l8Audit?.learningExtracted;
  const artifactsCount = l8Audit?.artifactsCreated ?? 0;
  const parts: string[] = [];
  if (executionCount) parts.push(`${executionCount} execution(s)`);
  if (memoryCount) parts.push(`${memoryCount} ledger`);
  if (tagsCount) parts.push(`${Number(tagsCount)} tags`);
  if (evidenceCount) parts.push(`${Number(evidenceCount)} evidence`);
  if (learning) parts.push(`Learning: ${asText(learning)}`);
  if (artifactsCount) parts.push(`${Number(artifactsCount)} artifacts`);
  if (parts.length === 0) return notRecordedLabel;
  return parts.join(" · ");
}

function computeLatestVersionByType(versionList: Array<Record<string, unknown>>): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const version of versionList) {
    const vType = asText(version?.versionType, "business_case");
    const key = vType === "both" ? "business_case" : vType;
    if (!result[key]) {
      result[key] = version;
      continue;
    }
    const currentTime = new Date(asTimestampValue(result[key]?.createdAt) ?? 0).getTime();
    const nextTime = new Date(asTimestampValue(version.createdAt) ?? 0).getTime();
    if (nextTime > currentTime) result[key] = version;
  }
  return result;
}

function resolveLifecycleStepOverride(
  step: { label: string; status: string; detail: string },
  layerIndex: number,
  hasActiveEntry: boolean,
  layerCheckResult: boolean,
  currentLayer: number,
  inProgressLabel: string,
  awaitingLabel: string,
) {
  if (hasActiveEntry) {
    return {
      ...step,
      status: layerCheckResult ? "complete" : "pending",
      detail: layerCheckResult ? step.detail : awaitingLabel,
      layerIndex,
    };
  }
  return {
    ...step,
    status: resolveLayerStatusValue(currentLayer, layerIndex),
    detail: resolveLayerDetailText(currentLayer, layerIndex, step.detail, inProgressLabel, awaitingLabel),
    layerIndex,
  };
}

function resolveLifecycleStepClassName(isSelected: boolean, status: string): string {
  if (isSelected) return "bg-emerald-500 text-white";
  if (status === "complete") return "bg-emerald-500/10 text-emerald-700";
  return "bg-muted text-muted-foreground";
}

interface ApprovalContext {
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  reason: string | null;
  complete: boolean;
}

function buildApprovalContext(params: {
  activeVersionLifecycle: unknown;
  activeType: string | undefined;
  workflowReadiness: Record<string, unknown> | undefined;
  workflowReadinessVersionType: string | null | undefined;
  versionTypeMap: Record<string, string>;
  l7Audit: Record<string, unknown> | null;
  activeSubDecision: Record<string, unknown> | null | undefined;
  approvalData: Record<string, unknown> | undefined;
  latestApproval: Record<string, unknown> | undefined;
  activeEntrySummary: unknown;
  completeStatuses: Set<string>;
}): ApprovalContext {
  if (params.activeVersionLifecycle && params.activeType && params.workflowReadiness
    && (!params.workflowReadinessVersionType || params.workflowReadinessVersionType === params.versionTypeMap[params.activeType])) {
    const status = resolveApprovalStatus(params.workflowReadiness, params.l7Audit);
    return {
      status,
      approvedBy: asText(params.workflowReadiness.approvedBy) || null,
      approvedAt: asText(params.workflowReadiness.approvedAt) || null,
      reason: asText(params.workflowReadiness.message) || null,
      complete: Boolean(params.workflowReadiness.versionApproved) || params.completeStatuses.has(status),
    };
  }
  const subDecisionStatus = asText(params.activeSubDecision?.approvalOutcome, asText(params.activeSubDecision?.status)).toLowerCase();
  const auditStatus = asText(params.l7Audit?.status).toLowerCase();
  const approvalStatus = asText(params.approvalData?.status, asText(params.latestApproval?.status)).toLowerCase();
  const status = subDecisionStatus || auditStatus || approvalStatus || "pending";
  return {
    status,
    approvedBy: typeof params.activeSubDecision?.approvedBy === "string"
      ? params.activeSubDecision.approvedBy
      : asText(params.approvalData?.approvedBy) || null,
    approvedAt: typeof params.activeSubDecision?.approvedAt === "string"
      ? params.activeSubDecision.approvedAt
      : asText(params.approvalData?.createdAt) || null,
    reason: asText(params.approvalData?.approvalReason) || (typeof params.activeEntrySummary === "string" ? params.activeEntrySummary : null),
    complete: params.completeStatuses.has(status),
  };
}

function checkLifecycleLayerData(params: {
  layerIndex: number;
  activeEntry: unknown;
  currentLayer: number;
  approvalComplete: boolean;
  l7Audit: Record<string, unknown> | null;
  l8Audit: Record<string, unknown> | null;
  activeArtifactsCount: number;
  layerAudits: Array<Record<string, unknown> | null>;
}): boolean {
  if (!params.activeEntry) return params.currentLayer >= params.layerIndex;
  if (params.layerIndex === 7) return params.approvalComplete || Boolean(params.l7Audit);
  if (params.layerIndex === 8) return Boolean(params.l8Audit) || params.activeArtifactsCount > 0;
  return Boolean(params.layerAudits[params.layerIndex - 1]);
}

function isRecordObject(item: unknown): item is Record<string, unknown> {
  return Boolean(item) && typeof item === "object" && !Array.isArray(item);
}

function resolveProposedActions(
  advisoryRecord: Record<string, unknown> | undefined,
  advisory: Record<string, unknown> | undefined,
): Record<string, unknown>[] {
  if (Array.isArray(advisoryRecord?.actions)) {
    return advisoryRecord.actions.filter(isRecordObject);
  }
  if (Array.isArray(advisory?.plannedActions)) {
    return advisory.plannedActions.filter(isRecordObject);
  }
  if (Array.isArray(advisoryRecord?.proposedActions)) {
    return advisoryRecord.proposedActions.filter(isRecordObject);
  }
  return [];
}

function buildLifecycleAgentSignals(
  scopedAuditTrail: Array<Record<string, unknown>>,
  normalizeScore: (v: unknown) => number | null,
): Array<{ name: string; score: number | null; status: string }> {
  return Array.from(
    scopedAuditTrail.reduce((map, event) => {
      if (getEventLayer(event) !== 6) return map;
      const eventData = getAuditEventData(event);
      const eventType = asText(event?.eventType, asText(event?.action));
      const agentKey = asText(eventData.plannedAgentId, asText(eventData.agentId));
      const agentName = asText(eventData.agentName, asText(eventData.plannedAgentName, agentKey));
      if (!eventType.startsWith("brain.agent.") || !agentKey || !agentName) return map;
      const rawConfidence = eventData.confidence;
      const eventAction = asText(event?.action, "unknown");
      map.set(agentKey, {
        name: agentName,
        score: normalizeScore(rawConfidence),
        status: resolveLifecycleAgentStatus(eventData, eventAction),
      });
      return map;
    }, new Map<string, { name: string; score: number | null; status: string }>()).values(),
  );
}

interface VersionContext {
  activeDecisionType: string | undefined;
  decision: boolean;
  decisionStatus: string;
  versionTypeMap: Record<string, string>;
  latestVersionByType: Record<string, Record<string, unknown>>;
  workflowReadiness: Record<string, unknown> | null | undefined;
  workflowReadinessVersionType: string | null;
}

function checkSubDecisionComplete(
  type: string,
  ctx: VersionContext,
  artifacts: Array<Record<string, unknown>>,
  subDecisions: Array<Record<string, unknown>>,
  completionStatuses: Set<string>,
): boolean {
  const versionKey = ctx.versionTypeMap[type];
  if (versionKey) {
    const vl = resolveVersionLifecycleState({
      type,
      hasCurrentDecision: ctx.activeDecisionType === type && ctx.decision,
      versionTypeMap: ctx.versionTypeMap,
      latestVersionByType: ctx.latestVersionByType,
      workflowReadiness: ctx.workflowReadiness,
      workflowReadinessVersionType: ctx.workflowReadinessVersionType,
      decisionStatus: ctx.decisionStatus,
    });
    return vl.isComplete;
  }
  const artifact = artifacts.find((art) => art.artifactType === type);
  if (artifact) return true;
  const sd = subDecisions.find((s) => s.subDecisionType === type);
  return completionStatuses.has(asText(sd?.status).toLowerCase());
}

function buildMissingEntries(
  missingTypes: string[],
  ctx: VersionContext,
  subDecisions: Array<Record<string, unknown>>,
  artifacts: Array<Record<string, unknown>>,
  decisionStatusText: string,
) {
  return missingTypes.map((type) => {
    const sd = subDecisions.find((s) => s.subDecisionType === type);
    const artifact = artifacts.find((art) => art.artifactType === type);
    const vl = resolveVersionLifecycleState({
      type,
      hasCurrentDecision: ctx.activeDecisionType === type && ctx.decision,
      versionTypeMap: ctx.versionTypeMap,
      latestVersionByType: ctx.latestVersionByType,
      workflowReadiness: ctx.workflowReadiness,
      workflowReadinessVersionType: ctx.workflowReadinessVersionType,
      decisionStatus: ctx.decisionStatus,
    });
    return {
      type,
      subDecisionId: sd?.subDecisionId,
      artifactId: artifact?.artifactId,
      status: ctx.versionTypeMap[type] ? vl.status : getArtifactOrDecisionStatusText(sd, artifact, false, decisionStatusText),
      version: ctx.versionTypeMap[type] ? vl.version : getArtifactVersionText(artifact),
    };
  });
}

function buildTimelineEntries(params: {
  orderedPresentTypes: string[];
  subDecisions: Array<Record<string, unknown>>;
  artifacts: Array<Record<string, unknown>>;
  versionCtx: VersionContext;
  decisionStatusText: string;
  decisionId: unknown;
  approvalRecordId: unknown;
  currentDecisionTimestamp: string | undefined;
  timelineSummaryLabels: {
    workflowMessage: unknown;
    advisorySummary: unknown;
    advisoryRecommendation: unknown;
    artifactCapturedLabel: string;
    awaitingLabel: string;
    notStartedLabel: string;
  };
  groupLabels: Record<string, string>;
}) {
  const { orderedPresentTypes, subDecisions, artifacts, versionCtx, decisionStatusText } = params;
  return orderedPresentTypes.map((type) => {
    const sd = subDecisions.find((s) => s.subDecisionType === type);
    const artifact = artifacts.find((art) => art.artifactType === type);
    const hasArtifact = Boolean(artifact);
    const hasSubDecision = Boolean(sd);
    const hasCurrentDecision = versionCtx.activeDecisionType === type && versionCtx.decision;
    const vl = resolveVersionLifecycleState({
      type,
      hasCurrentDecision,
      versionTypeMap: versionCtx.versionTypeMap,
      latestVersionByType: versionCtx.latestVersionByType,
      workflowReadiness: versionCtx.workflowReadiness,
      workflowReadinessVersionType: versionCtx.workflowReadinessVersionType,
      decisionStatus: versionCtx.decisionStatus,
    });
    const versionKey = versionCtx.versionTypeMap[type];
    const versionLabel = versionKey ? vl.version : getArtifactVersionText(artifact);
    const entryStatus = versionKey ? vl.status : getArtifactOrDecisionStatusText(sd, artifact, hasCurrentDecision, decisionStatusText);
    const entrySummary = getTimelineSummaryText({
      hasArtifact, hasCurrentDecision, hasSubDecision, artifact,
      ...params.timelineSummaryLabels,
    });
    const approvalId = sd?.approvalId == null
      ? asText(params.approvalRecordId)
      : asText(sd.approvalId);
    const timestamp = getEntryTimestampValue(artifact, vl.timestamp, sd, hasCurrentDecision ? params.currentDecisionTimestamp : undefined);
    const groupKey = subDecisionGroupKey(type);
    return {
      key: `${type}-${asText(artifact?.artifactId, asText(sd?.subDecisionId, asText(params.decisionId, "pending")))}`,
      groupKey,
      groupLabel: params.groupLabels[groupKey] ?? groupKey,
      type,
      status: entryStatus,
      summary: entrySummary,
      version: versionLabel,
      approvalId,
      timestamp,
      isPlaceholder: !hasArtifact && !hasSubDecision && !hasCurrentDecision,
    };
  })
    .filter((entry) => !entry.isPlaceholder)
    .sort((a, b) => {
      const groupOrder: Record<string, number> = { demand: 0, core: 1, research: 2, delivery: 3, conversion: 4, other: 5 };
      const ga = groupOrder[a.groupKey] ?? 99;
      const gb = groupOrder[b.groupKey] ?? 99;
      if (ga !== gb) return ga - gb;
      return orderedPresentTypes.indexOf(a.type) - orderedPresentTypes.indexOf(b.type);
    });
}

const POLLABLE_STATUSES = new Set(["processing", "validation", "pending_approval", "action_execution", "intake", "needs_info", "orchestration"]);

function decisionRefetchInterval(query: { state: { data: unknown } }): number | false {
  const status = (query.state.data as { status?: string } | undefined)?.status;
  if (status && POLLABLE_STATUSES.has(status)) return 4000;
  return false;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  return fallback;
}

function resolveDemandArtifactState(
  isDemandLifecycle: boolean,
  activeType: string | undefined,
  artifacts: Array<Record<string, unknown>>,
): Record<string, unknown> | null {
  if (!isDemandLifecycle || !activeType) return null;
  return unwrapDemandArtifactState(findLatestDemandArtifactContent(artifacts, activeType));
}

function renderDecisionErrorState(t: TFunction, error: unknown): React.ReactNode {
  const errorMessage = (error as { message?: string })?.message || t('brain.decisionDetail.failedToLoad');
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/brain-console/decisions">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('brain.decisionDetail.unableToLoad')}</h1>
          <p className="text-muted-foreground mt-1">{errorMessage}</p>
        </div>
      </div>
      <EmptyState title={t('brain.decisionDetail.decisionUnavailable')} description={t('brain.decisionDetail.openFromList')} />
    </div>
  );
}

interface DemandContext {
  activeDemandLifecycleSource: Record<string, unknown> | null;
  activeDemandSectionSummaries: Array<{ key: string; label: string; filled: number; total: number; percent: number; status: string }>;
  activeDemandCompleteness: number | null;
  contextCompletenessValue: number | null;
  contextMissingFieldCount: number;
  contextMissingFieldPreview: string[];
  activeDemandMissingFieldCount: number;
}

function computeDemandContext(
  isDemandLifecycle: boolean,
  activeDemandArtifactState: Record<string, unknown> | null,
  demandLifecycleSource: Record<string, unknown>,
  inputData: Record<string, unknown>,
  demandSectionLabels: Record<string, string>,
  contextScore: number | null,
  contextQuality: Record<string, unknown> | undefined,
): DemandContext {
  const activeDemandLifecycleSource = isDemandLifecycle
    ? (activeDemandArtifactState || demandLifecycleSource || inputData)
    : null;
  const activeDemandSectionSummaries = isDemandLifecycle
    ? buildDemandSectionSummaries(activeDemandLifecycleSource, demandSectionLabels)
    : [];
  const activeDemandMissingFields = activeDemandSectionSummaries
    .flatMap((section) => {
      const fields = DEMAND_SECTION_FIELDS[section.key] || [];
      return fields.filter((field) => (
        !hasRecordLifecycleValue(activeDemandLifecycleSource, field, DEMAND_SECTION_FIELD_ALIASES[field] ?? [])
      ));
    });
  const computedCompleteness = isDemandLifecycle
    ? calculateDemandCompleteness(activeDemandSectionSummaries)
    : null;
  return {
    activeDemandLifecycleSource,
    activeDemandSectionSummaries,
    activeDemandCompleteness: computedCompleteness,
    contextCompletenessValue: isDemandLifecycle ? computedCompleteness : contextScore,
    contextMissingFieldCount: isDemandLifecycle ? activeDemandMissingFields.length : ((contextQuality?.missingFields as string[] | undefined)?.length || 0),
    contextMissingFieldPreview: isDemandLifecycle ? activeDemandMissingFields.slice(0, 3) : ((contextQuality?.missingFields as string[] | undefined) || []).slice(0, 3),
    activeDemandMissingFieldCount: activeDemandMissingFields.length,
  };
}

function scrollOrchestrationIntoView(
  activeEntry: unknown,
  ref: React.RefObject<HTMLElement | null>,
): void {
  if (activeEntry && ref.current) {
    ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function resolveInitialSelectedLayer(activeEntry: unknown): number | null {
  if (activeEntry) return 1;
  return null;
}

function resolveActiveTypeSelections(
  activeType: string | undefined,
  subDecisions: Array<Record<string, unknown>>,
  artifacts: Array<Record<string, unknown>>,
): { activeSubDecision: Record<string, unknown> | null | undefined; activeArtifacts: Array<Record<string, unknown>> } {
  if (!activeType) return { activeSubDecision: null, activeArtifacts: [] };
  return {
    activeSubDecision: subDecisions.find((sd) => sd.subDecisionType === activeType) ?? null,
    activeArtifacts: artifacts.filter((artifact) => artifact.artifactType === activeType),
  };
}

function resolveClassificationConstraints(
  l2Audit: ReturnType<typeof getLayerAuditData>,
  classificationConstraints: Record<string, unknown>,
  resolveConstraintRecordFn: (c: Record<string, unknown>) => Record<string, unknown>,
): Record<string, unknown> {
  if (l2Audit?.constraints && typeof l2Audit.constraints === "object") {
    return l2Audit.constraints as Record<string, unknown>;
  }
  return resolveConstraintRecordFn(classificationConstraints);
}

function resolveDisplayedAgentSignals<T>(
  activeEntry: unknown,
  lifecycleAgentSignals: T[],
  fallbackAgentSignals: T[],
): T[] {
  if (activeEntry && lifecycleAgentSignals.length > 0) return lifecycleAgentSignals;
  return fallbackAgentSignals;
}

function computeActiveVersionLifecycle(
  activeType: string | undefined,
  params: {
    activeDecisionType: string | undefined;
    decision: boolean;
    versionTypeMap: Record<string, string>;
    latestVersionByType: Record<string, Record<string, unknown> | undefined>;
    workflowReadiness: Record<string, unknown> | null;
    workflowReadinessVersionType: string | null;
    decisionStatus: string;
  },
): ReturnType<typeof resolveVersionLifecycleState> | null {
  if (!activeType || !params.versionTypeMap[activeType]) return null;
  return resolveVersionLifecycleState({
    type: activeType,
    hasCurrentDecision: params.activeDecisionType === activeType && params.decision,
    versionTypeMap: params.versionTypeMap,
    latestVersionByType: params.latestVersionByType as Record<string, Record<string, unknown>>,
    workflowReadiness: params.workflowReadiness,
    workflowReadinessVersionType: params.workflowReadinessVersionType,
    decisionStatus: params.decisionStatus,
  });
}

function resolveEngineSummary(engines: Record<string, unknown>, notRecordedLabel: string): { usedEngineNames: string[]; engineSummary: string } {
  const usedEngineNames = Object.entries(engines)
    .filter(([, v]) => v && typeof v === "object" && ((v as Record<string, unknown>).status === "used" || (v as Record<string, unknown>).status === "ready"))
    .map(([k]) => k);
  if (usedEngineNames.length > 0) {
    return { usedEngineNames, engineSummary: usedEngineNames.join(", ") };
  }
  return { usedEngineNames, engineSummary: notRecordedLabel };
}

function resolveCoreSpineWorkflow(isOperationalSpine: boolean, normalizedServiceId: string): boolean {
  if (isOperationalSpine) return false;
  return isCoreWorkflowService(normalizedServiceId);
}

function computeInitialDemandState(
  serviceId: string,
  routeKey: string,
  artifacts: Array<Record<string, unknown>>,
  inputData: Record<string, unknown>,
  demandSectionLabels: Record<string, string>,
): { isDemandIntake: boolean; demandLifecycleSource: Record<string, unknown>; demandSectionSummaries: Array<{ key: string; label: string; filled: number; total: number; percent: number; status: string }> } {
  const isDemandIntake = serviceId === "demand_management" && routeKey === "demand.new";
  if (!isDemandIntake) {
    return { isDemandIntake, demandLifecycleSource: inputData, demandSectionSummaries: [] };
  }
  const latestDemandArtifactState = unwrapDemandArtifactState(
    [...artifacts]
      .filter((artifact) => artifact.artifactType === "DEMAND_REQUEST")
      .sort((left, right) => {
        const leftTime = new Date(asTimestampValue(left.latestCreatedAt) ?? 0).getTime();
        const rightTime = new Date(asTimestampValue(right.latestCreatedAt) ?? 0).getTime();
        return rightTime - leftTime;
      })[0]?.latestContent,
  );
  const demandLifecycleSource = latestDemandArtifactState || inputData;
  const demandSectionSummaries = buildDemandSectionSummaries(demandLifecycleSource, demandSectionLabels);
  return { isDemandIntake, demandLifecycleSource, demandSectionSummaries };
}

function computePresentSubDecisionTypes(
  subDecisions: Array<Record<string, unknown>>,
  artifacts: Array<Record<string, unknown>>,
  activeDecisionType: string | undefined,
): string[] {
  const types = new Set<string>();
  if (Array.isArray(subDecisions)) {
    for (const sd of subDecisions) {
      const t = asText(sd?.subDecisionType);
      if (t && t !== "undefined" && t !== "null") types.add(t);
    }
  }
  if (Array.isArray(artifacts)) {
    for (const art of artifacts) {
      const t = asText(art?.artifactType);
      if (t && t !== "undefined" && t !== "null") types.add(t);
    }
  }
  if (activeDecisionType) types.add(activeDecisionType);
  return Array.from(types);
}

function renderExecutionList(t: TFunction, executions: Array<Record<string, unknown>>): React.ReactNode {
  if (executions.length === 0) {
    return <p className="text-xs text-muted-foreground">{t('brain.decisionDetail.noExecutionJobs')}</p>;
  }
  return (
    <div className="space-y-2">
      {executions.slice(0, 3).map((execution) => (
        <div key={String(execution.executionId)} className="rounded-lg border px-3 py-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">{String(execution.actionType)}</span>
            <Badge variant="outline" className="text-[10px]">{String(execution.status)}</Badge>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">{String(execution.idempotencyKey)}</p>
        </div>
      ))}
    </div>
  );
}

function renderMissingFinalEntry(t: TFunction, entry: { type: string; status: string; version: string; subDecisionId?: unknown }, decisionId: string): React.ReactNode {
  return (
    <div key={entry.type} className="flex items-center justify-between rounded-lg border bg-white/70 px-3 py-2">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
          {entry.type.replaceAll("_", " ")}
        </p>
        <p className="text-sm font-semibold text-foreground">{t('brain.decisionDetail.status')}: {entry.status}</p>
        <p className="text-xs text-muted-foreground">{t('brain.decisionDetail.version')}: {entry.version}</p>
      </div>
      {entry.subDecisionId ? (
        <Link href={`/brain-console/decisions/${decisionId}#${asText(entry.subDecisionId)}`}>
          <Button size="sm" variant="outline">{t('app.open')}</Button>
        </Link>
      ) : null}
    </div>
  );
}

function renderServiceLabel(activeEntry: { type: string } | null, decision: { serviceId?: string }, getJourneyServiceLabel: (id: string) => string): React.ReactNode {
  if (activeEntry) {
    return (
      <>
        <span className="mx-2">→</span>
        <span className="text-foreground">{activeEntry.type.replaceAll("_", " ")}</span>
      </>
    );
  }
  if (decision.serviceId && decision.serviceId !== "demand_management") {
    return (
      <>
        <span className="mx-2">→</span>
        <span className="text-foreground">{getJourneyServiceLabel(decision.serviceId)}</span>
      </>
    );
  }
  return null;
}

interface ActiveEntryOverlayParams {
  t: TFunction;
  activeEntry: { key?: string; type: string; status: string; version: string; summary: string; approvalId?: string; timestamp?: string };
  onClose: () => void;
  orchestrationRef: React.Ref<HTMLElement>;
  lifecycleSteps: Array<{ label: string; status: string; detail: string; layerIndex: number }>;
  selectedLayer: number | null;
  onSelectLayer: (layer: number) => void;
  activeLayer: { label: string; status: string; detail: string; layerIndex: number };
  layerViewCtx: LayerViewContext;
  displayedAgentSignals: Array<{ name: string; score: number | null; status: string }>;
  ledger: Record<string, unknown> | undefined;
  activeSubDecisionApprovalId: unknown;
  policyEvaluation: Record<string, unknown> | undefined;
  policyVerdict: string | null;
  selectedPolicies: Array<Record<string, unknown>>;
  classificationLevel: string | null;
  classificationData: Record<string, unknown>;
  effectiveClassificationConstraints: Record<string, unknown>;
  routingOverride: { source?: string; forcedEngineKind?: string; forcedEngineId?: string; reason?: string } | undefined;
  auditTrail: Array<Record<string, unknown>>;
  artifactLedgerItems: ArtifactLedgerItem[];
  knowledgeEvidence: KnowledgeEvidenceItem[];
}

function renderActiveEntryOverlay(params: ActiveEntryOverlayParams): React.ReactNode {
  const { t, activeEntry, onClose, orchestrationRef, lifecycleSteps, selectedLayer, onSelectLayer, activeLayer } = params;
  const timestampDisplay = activeEntry.timestamp
    ? new Date(activeEntry.timestamp).toLocaleString()
    : t('brain.decisionDetail.pending');
  const approvalDisplay = asText(activeEntry.approvalId, asText(params.activeSubDecisionApprovalId, t('brain.decisionDetail.pending')));

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm border-0 cursor-pointer"
        onClick={onClose}
        aria-label={t('brain.decisionDetail.closeSubDecision')}
      />
      <div className="absolute inset-0 flex items-start justify-center overflow-auto p-6">
        <section
          ref={orchestrationRef}
          className="w-full max-w-6xl rounded-3xl border bg-[linear-gradient(140deg,hsl(var(--brain-surface))_0%,hsl(var(--brain-nimbus))_50%,hsl(var(--brain-surface-bright))_100%)] p-6 shadow-2xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t('brain.decisionDetail.decisionOrchestration')}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {activeEntry.type.replaceAll("_", " ")} Lifecycle
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{t('brain.decisionDetail.fullCycleView')}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">{activeEntry.status}</Badge>
              <Button variant="outline" size="sm" onClick={onClose}>{t('app.close')}</Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Card className="border-0 bg-white/90 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{t('brain.decisionDetail.version')}</p>
                <p className="text-lg font-semibold">{activeEntry.version || "-"}</p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-white/90 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{t('brain.decisionDetail.approval')}</p>
                <p className="text-lg font-semibold">{approvalDisplay}</p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-white/90 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{t('brain.decisionDetail.lastUpdate')}</p>
                <p className="text-sm font-semibold">{timestampDisplay}</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Card className="border-0 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">{t('brain.decisionDetail.lifecycleLayerSignals')}</CardTitle>
                <CardDescription>{t('brain.decisionDetail.lifecycleLayerSignalsDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  {lifecycleSteps.map((step, idx) => (
                    <div key={step.label} className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onSelectLayer(step.layerIndex)}
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-semibold shadow-sm transition ${
                          resolveLifecycleStepClassName(step.layerIndex === (selectedLayer || 1), step.status)
                        }`}
                      >
                        L{step.layerIndex}
                      </button>
                      {idx < lifecycleSteps.length - 1 && (
                        <span className={`h-[2px] w-6 ${step.status === "complete" ? "bg-emerald-400" : "bg-muted"}`} />
                      )}
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{activeLayer.label}</p>
                      <p className="text-base font-semibold text-foreground">{activeLayer.detail}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {activeLayer.status}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                    {renderLayerDetailContent(activeLayer.layerIndex, params.layerViewCtx)}
                  </div>
                </div>
                {(activeLayer.layerIndex === 5 || activeLayer.layerIndex === 6) && (
                  renderAgentSignalsPanel({ t, displayedAgentSignals: params.displayedAgentSignals })
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-0 bg-white/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">{t('brain.decisionDetail.ledgerSummary')}</CardTitle>
                  <CardDescription>{t('brain.decisionDetail.ledgerSummaryDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('brain.decisionDetail.conclusion')}</span>
                    <span className="font-semibold text-foreground">{asText(params.ledger?.conclusion, "HOLD")}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{activeEntry.summary}</p>
                </CardContent>
              </Card>

              <Card className="border-0 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">{t('brain.decisionDetail.policyOpsRouting')}</CardTitle>
                  <CardDescription>{t('brain.decisionDetail.policyOpsRoutingDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {renderPolicyOpsContent({ t, policyEvaluation: params.policyEvaluation, policyVerdict: params.policyVerdict, selectedPolicies: params.selectedPolicies, classificationLevel: params.classificationLevel, classificationData: params.classificationData, effectiveClassificationConstraints: params.effectiveClassificationConstraints, routingOverride: params.routingOverride })}
                </CardContent>
              </Card>
              <Card className="border-0 bg-white/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">{t('brain.decisionDetail.auditTrail')}</CardTitle>
                  <CardDescription>{t('brain.decisionDetail.auditTrailDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {renderAuditTrailContent({ t, auditTrail: params.auditTrail })}
                </CardContent>
              </Card>
            </div>
          </div>

          {renderEvidenceAndArtifactsCard({ t, artifactLedgerItems: params.artifactLedgerItems, knowledgeEvidence: params.knowledgeEvidence })}
        </section>
      </div>
    </div>
  );
}

export function DecisionDetail() {
  const [, brainParams] = useRoute("/brain-console/decisions/:id");
  const [, legacyParams] = useRoute("/decisions/:id");
  const [location] = useLocation();
  const fallbackId = /\/decisions\/([^/?#]+)/.exec(location)?.[1];
  const decisionId = brainParams?.id || legacyParams?.id || fallbackId;
  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const useCaseType = searchParams.get("useCaseType") || undefined;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [activeEntry, setActiveEntry] = useState<null | {
    key?: string;
    type: string;
    status: string;
    version: string;
    summary: string;
    approvalId?: string;
    timestamp?: string;
  }>(null);
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null);
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);
  const orchestrationRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { scrollOrchestrationIntoView(activeEntry, orchestrationRef); }, [activeEntry]);

  useEffect(() => { setSelectedLayer(resolveInitialSelectedLayer(activeEntry)); }, [activeEntry]);

  const entryUseCaseType = normalizeUseCaseType(mapSubDecisionUseCase(activeEntry?.type));
  const requestedUseCaseType = normalizeUseCaseType(useCaseType);
  const effectiveUseCaseType = entryUseCaseType || requestedUseCaseType;

  const { data: decision, isLoading, error } = useQuery({
    queryKey: ["decision", decisionId, effectiveUseCaseType || "latest"],
    queryFn: () => fetchDecision(decisionId!, effectiveUseCaseType),
    enabled: !!decisionId,
    refetchInterval: decisionRefetchInterval,
    refetchOnWindowFocus: false,
  });

  const approveMutation = useMutation({
    mutationFn: (data: { decision: "approve" | "revise" | "reject"; approvalType: "insights_only" | "insights_actions"; notes?: string }) =>
      approveDecision(decisionId!, data),
    onSuccess: (_result) => {
      queryClient.invalidateQueries({ queryKey: ["decision", decisionId, effectiveUseCaseType || "latest"] });
      queryClient.invalidateQueries({ queryKey: ["decisions"] });
      toast({
        title: t('app.success'),
        description: t('brain.decisionDetail.approvedSuccessfully'),
      });
    },
    onError: (err: unknown) => {
      toast({
        title: t('app.error'),
        description: extractErrorMessage(err, t('brain.decisionDetail.failedToProcessApproval')),
        variant: "destructive",
      });
    },
  });

  const executeActionsMutation = useMutation({
    mutationFn: async (approvalId: string): Promise<void> => {
      await runActions(decisionId!, approvalId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision", decisionId, effectiveUseCaseType || "latest"] });
      toast({
        title: t('brain.decisionDetail.actionsExecuted'),
        description: t('brain.decisionDetail.actionsExecutedDesc'),
      });
    },
    onError: (err: unknown) => {
      toast({
        title: t('app.error'),
        description: extractErrorMessage(err, t('brain.decisionDetail.failedToExecuteActions')),
        variant: "destructive",
      });
    },
  });

  const approvals = decision?.approvals || (decision?.approval ? [decision.approval] : []);
  const decisionRecord = decision as unknown as Record<string, unknown> | undefined;
  const latestApproval = decisionRecord?.latestApproval || approvals.at(-1);
  const decisionStatus = asText(decision?.status);
  const isApproved = ["approved", "executed", "completed", "memory", "action_execution"].includes(decisionStatus);

  const policyOps = decisionRecord?.policyOps as Record<string, unknown> | undefined;
  const policyVerdict = asText(decision?.policyEvaluation?.verdict, asText(policyOps?.verdict)) || null;
  const contextScoreRaw = decision?.contextQuality?.score ?? decision?.contextQuality?.completenessScore ?? null;
  const contextScore = resolveContextScore(contextScoreRaw);
  const classificationLevel = (decision?.classification?.level ?? null) as string | null;
  const advisory = decision?.advisoryPackage || decision?.advisory;
  const policyEvaluation = decision?.policyEvaluation;
  const contextQuality = decision?.contextQuality;
  const orchestrationPlan = decision?.orchestrationPlan;
  const approvalData = decision?.approval;
  const routingOverride = decisionRecord?.routingOverride as { source?: string; forcedEngineKind?: string; forcedEngineId?: string; reason?: string } | undefined;
  const matchedPolicies = (policyEvaluation?.matchedPolicies || []) as Array<Record<string, unknown>>;
  const classificationData = (decision?.classification ?? {}) as Record<string, unknown>;
  const classificationConstraints =
    (classificationData.constraintsJson as Record<string, unknown> | undefined)
    || (classificationData.constraints as Record<string, unknown> | undefined)
    || {};
  const fallbackActions = Array.isArray(decisionRecord?.actions) ? decisionRecord.actions : [];
  const actionExecutions = decision?.actionExecutions || fallbackActions;
  const inputData = decision?.input || {};
  const demandReportId = inputData?.demandReportId || inputData?.reportId;
  const advisoryRecord = advisory as Record<string, unknown> | undefined;
  const proposedActions = resolveProposedActions(advisoryRecord, advisory as Record<string, unknown> | undefined);

  const { data: reportVersions } = useQuery({
    queryKey: ["report-versions", demandReportId],
    enabled: !!demandReportId,
    queryFn: async () => {
      const response = await fetch(`/api/demand-reports/${demandReportId}/versions`, { credentials: "include" });
      if (!response.ok) return null;
      return response.json();
    },
    staleTime: 30_000,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const versionList = ((reportVersions as Record<string, unknown> | undefined)?.data || (reportVersions as Record<string, unknown> | undefined)?.versions || []) as Array<Record<string, unknown>>;
  const versionTypeMap: Record<string, string> = {
    BUSINESS_CASE: "business_case",
    REQUIREMENTS: "requirements",
    STRATEGIC_FIT: "strategic_fit",
  };
  const latestVersionByType = useMemo(() => computeLatestVersionByType(versionList), [versionList]);

  const latestRequirementsVersion = latestVersionByType.requirements;
  const latestBusinessCaseVersion = latestVersionByType.business_case;
  const latestStrategicFitVersion = latestVersionByType.strategic_fit;
  const businessCasePayload = ((latestBusinessCaseVersion?.versionData as Record<string, unknown> | undefined)?.businessCase
    || latestBusinessCaseVersion?.versionData
    || {}) as Record<string, unknown>;
  const financialSignalCount = computeFinancialSignalCount(businessCasePayload);
  const dependencyCount = computeDependencyCount(businessCasePayload);
  const riskCount = computeRiskCount(businessCasePayload);
  const businessCaseSignals = {
    options: countItems(businessCasePayload?.options || businessCasePayload?.alternativeOptions || businessCasePayload?.alternativeSolutions),
    financialScenarios: financialSignalCount,
    risks: riskCount,
    dependencies: dependencyCount,
    recommendation:
      firstLifecycleText(
        businessCasePayload?.recommendation,
        businessCasePayload?.recommendedOption,
        businessCasePayload?.recommendations,
        businessCasePayload?.conclusionSummary,
        businessCasePayload?.nextSteps,
        businessCasePayload?.executiveSummary,
      ),
  };
  const serviceId = (decision?.serviceId || "").toLowerCase();
  const routeKey = (decision?.routeKey || "").toLowerCase();
  const spineOverview = decision?.spineOverview;
  const spine = spineOverview?.spine;
  const subDecisions = (spineOverview?.subDecisions || []) as Array<Record<string, unknown>>;
  const executions = (spineOverview?.executions || []) as Array<Record<string, unknown>>;
  const ledger = spineOverview?.ledger;
  const artifacts = (spineOverview?.artifacts || []) as Array<Record<string, unknown>>;
  const latestRequirementsArtifactState = unwrapLifecycleArtifactState(
    [...artifacts]
      .filter((artifact) => artifact.artifactType === "REQUIREMENTS")
      .sort((left, right) => {
        const leftTime = new Date(asTimestampValue(left.latestCreatedAt) ?? 0).getTime();
        const rightTime = new Date(asTimestampValue(right.latestCreatedAt) ?? 0).getTime();
        return rightTime - leftTime;
      })[0]?.latestContent,
    ["requirementsAnalysis"],
  );
  const latestStrategicFitArtifactState = unwrapLifecycleArtifactState(
    [...artifacts]
      .filter((artifact) => artifact.artifactType === "STRATEGIC_FIT")
      .sort((left, right) => {
        const leftTime = new Date(asTimestampValue(left.latestCreatedAt) ?? 0).getTime();
        const rightTime = new Date(asTimestampValue(right.latestCreatedAt) ?? 0).getTime();
        return rightTime - leftTime;
      })[0]?.latestContent,
    ["strategicFitAnalysis"],
  );
  const requirementsPayload = (latestRequirementsArtifactState
    || (latestRequirementsVersion?.versionData as Record<string, unknown> | undefined)?.requirementsAnalysis
    || latestRequirementsVersion?.versionData
    || {}) as Record<string, unknown>;
  const strategicFitPayload = (latestStrategicFitArtifactState
    || (latestStrategicFitVersion?.versionData as Record<string, unknown> | undefined)?.strategicFitAnalysis
    || latestStrategicFitVersion?.versionData
    || {}) as Record<string, unknown>;
  const requirementsSignals = {
    capabilities: countLifecycleEntries(requirementsPayload?.capabilities),
    functional: countLifecycleEntries(requirementsPayload?.functionalRequirements),
    nonFunctional: countLifecycleEntries(requirementsPayload?.nonFunctionalRequirements),
    security: countLifecycleEntries(requirementsPayload?.securityRequirements),
    capabilityGaps: countLifecycleEntries(requirementsPayload?.capabilityGaps),
    dependencies: countLifecycleEntries(requirementsPayload?.dependencies),
    roles: countLifecycleEntries(requirementsPayload?.rolesAndResponsibilities),
    deliveryPhases: countLifecycleEntries((requirementsPayload?.estimatedEffort as Record<string, unknown> | undefined)?.phases),
    technologyDomains: countObjectEntries(requirementsPayload?.requiredTechnology),
    traceabilityLinks: countObjectEntries(requirementsPayload?.traceability),
  };
  const primaryStrategicRecommendation = strategicFitPayload?.primaryRecommendation as Record<string, unknown> | undefined;
  const strategicGovernance = strategicFitPayload?.governanceRequirements as Record<string, unknown> | undefined;
  const strategicGovernmentAlignment = strategicFitPayload?.governmentAlignment as Record<string, unknown> | undefined;
  const strategicRiskMitigation = strategicFitPayload?.riskMitigation as Record<string, unknown> | undefined;
  const strategicFitSignals = {
    recommendationRoute:
      firstLifecycleText(
        primaryStrategicRecommendation?.route,
        strategicFitPayload?.implementationRoute,
        strategicFitPayload?.recommendation,
        strategicFitPayload?.executiveRecommendation,
      ),
    alternatives: countLifecycleEntries(strategicFitPayload?.alternativeRecommendations || strategicFitPayload?.alternatives),
    criteria: countObjectEntries(strategicFitPayload?.decisionCriteria || strategicFitPayload?.evaluationCriteria),
    alignmentAreas: countLifecycleEntries(strategicFitPayload?.alignmentAreas || strategicFitPayload?.keyCriticalCapabilities || strategicFitPayload?.criticalCapabilities),
    governanceGates: countLifecycleEntries(strategicGovernance?.approvalGates || strategicFitPayload?.governanceGates),
    governmentInitiatives: countLifecycleEntries(strategicGovernmentAlignment?.initiatives),
    risks: countLifecycleEntries(strategicRiskMitigation?.primaryRisks || strategicFitPayload?.strategicRisks || strategicFitPayload?.risks),
    routeConfidence: normalizePercentValue(primaryStrategicRecommendation?.confidenceScore ?? primaryStrategicRecommendation?.confidence),
  };
  const totalRequirementsCount =
    requirementsSignals.functional + requirementsSignals.nonFunctional + requirementsSignals.security;
  const demandSectionLabels: Record<string, string> = {
    vision: t('brain.decisionDetail.visionAndRequirements'),
    resources: t('brain.decisionDetail.resourcesAndPlanning'),
    technology: t('brain.decisionDetail.technologyAndIntegration'),
  };
  const { demandLifecycleSource, demandSectionSummaries } = computeInitialDemandState(
    serviceId, routeKey, artifacts, inputData as Record<string, unknown>, demandSectionLabels,
  );
  const spineId =
    (spine as Record<string, unknown> | undefined)?.decisionSpineId
    || (spine as Record<string, unknown> | undefined)?.id
    || decisionRecord?.decisionSpineId
    || decisionRecord?.spineId;
  const auditTrail = ((decision?.auditTrail || (decisionRecord?.auditLog as Array<Record<string, unknown>> | undefined) || []) as Array<Record<string, unknown>>);
  const retrievalLogs = ((decision?.retrievalLogs || []) as Array<Record<string, unknown>>);
  const memoryEntries = ((decision?.memoryEntries || []) as Array<Record<string, unknown>>);

  const groupLabels: Record<string, string> = {
    demand: t('brain.decisionDetail.group.demand'),
    core: t('brain.decisionDetail.group.core'),
    research: t('brain.decisionDetail.group.research'),
    delivery: t('brain.decisionDetail.group.delivery'),
    conversion: t('brain.decisionDetail.group.conversion'),
    other: t('brain.decisionDetail.group.other'),
  };

  const activeDecisionType = mapUseCaseToSubDecisionType(effectiveUseCaseType || normalizeUseCaseType(decision?.serviceId));
  const approvalRecord = decision?.approval as Record<string, unknown> | undefined;
  const workflowReadinessRecord = decision?.workflowReadiness as Record<string, unknown> | undefined;
  const decisionStatusText = asText(decision?.status, "pending");
  const currentDecisionTimestamp = asTimestampValue(decision?.updatedAt) ?? asTimestampValue(decision?.createdAt);
  const timelineSummaryLabels = {
    workflowMessage: workflowReadinessRecord?.message,
    advisorySummary: advisoryRecord?.summary,
    advisoryRecommendation: advisoryRecord?.recommendation,
    artifactCapturedLabel: t('brain.decisionDetail.artifactCaptured'),
    awaitingLabel: t('brain.decisionDetail.awaitingArtifactCapture'),
    notStartedLabel: t('brain.decisionDetail.notStarted'),
  };

  const presentSubDecisionTypes = computePresentSubDecisionTypes(subDecisions, artifacts, activeDecisionType);

  const orderedPresentTypes = [
    ...SUB_DECISION_ORDER.filter((t) => presentSubDecisionTypes.includes(t)),
    ...presentSubDecisionTypes
      .filter((t) => !isKnownSubDecisionType(t, SUB_DECISION_ORDER))
      .sort((a, b) => a.localeCompare(b)),
  ];

  const normalizedServiceId = asText(serviceId).toLowerCase();
  const isOperationalSpine = normalizedServiceId === "reasoning";
  const isCoreSpineWorkflow = resolveCoreSpineWorkflow(isOperationalSpine, normalizedServiceId);
  const requiredFinalTypes = resolveRequiredFinalTypes(isCoreSpineWorkflow);
  const completionStatuses = new Set([
    "approved",
    "completed",
    "executed",
    "memory",
    "action_execution",
    "published",
  ]);

  const workflowReadiness = (decision?.workflowReadiness ?? null) as Record<string, unknown> | null;
  const workflowReadinessVersionType = normalizeWorkflowVersionType(workflowReadiness?.versionType);

  const versionCtx: VersionContext = {
    activeDecisionType,
    decision: Boolean(decision),
    decisionStatus: asText(decision?.status, "draft"),
    versionTypeMap,
    latestVersionByType,
    workflowReadiness,
    workflowReadinessVersionType,
  };
  const missingFinalTypes = requiredFinalTypes.length > 0
    ? requiredFinalTypes.filter((type) => !checkSubDecisionComplete(type, versionCtx, artifacts, subDecisions, completionStatuses))
    : [];
  const missingEntries = buildMissingEntries(missingFinalTypes, versionCtx, subDecisions, artifacts, decisionStatusText);

  const timelineEntries = buildTimelineEntries({
    orderedPresentTypes,
    subDecisions,
    artifacts,
    versionCtx,
    decisionStatusText,
    decisionId: decision?.id,
    approvalRecordId: approvalRecord?.approvalId,
    currentDecisionTimestamp,
    timelineSummaryLabels,
    groupLabels,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!decisionId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/brain-console/decisions">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('brain.decisionDetail.invalidDecisionLink')}</h1>
            <p className="text-muted-foreground mt-1">{t('brain.decisionDetail.noDecisionId')}</p>
          </div>
        </div>
        <EmptyState title={t('brain.decisionDetail.missingId')} description={t('brain.decisionDetail.returnToList')} />
      </div>
    );
  }

  if (error) return renderDecisionErrorState(t, error);

  if (!decision) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/brain-console/decisions">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('brain.decisionDetail.decisionNotFound')}</h1>
            <p className="text-muted-foreground mt-1">{t('brain.decisionDetail.couldNotBeLoaded')}</p>
          </div>
        </div>
        <EmptyState title={t('brain.decisionDetail.notFoundTitle')} description={t('brain.decisionDetail.notFoundDesc')} />
      </div>
    );
  }

  const decisionTitle = decision?.title || (decisionRecord?.intent as string | undefined) || t('brain.decisionDetail.decision');
  const activeType = activeEntry?.type || activeDecisionType;
  const isBusinessCaseLifecycle = activeType === "BUSINESS_CASE";
  const isRequirementsLifecycle = activeType === "REQUIREMENTS" || activeType === "DETAILED_REQUIREMENTS";
  const isStrategicFitLifecycle = activeType === "STRATEGIC_FIT";
  const isDemandLifecycle = activeType === "DEMAND_FIELDS" || activeType === "DEMAND_REQUEST";
  const { activeSubDecision, activeArtifacts } = resolveActiveTypeSelections(activeType, subDecisions, artifacts);
  const activeDemandArtifactState = resolveDemandArtifactState(isDemandLifecycle, activeType, artifacts);
  const demandCtx = computeDemandContext(
    isDemandLifecycle, activeDemandArtifactState, demandLifecycleSource, inputData as Record<string, unknown>,
    demandSectionLabels, contextScore, contextQuality,
  );
  const { activeDemandSectionSummaries, contextCompletenessValue, contextMissingFieldCount, contextMissingFieldPreview } = demandCtx;
  const knowledgeEvidence: KnowledgeEvidenceItem[] = buildKnowledgeEvidence(retrievalLogs, t);
  const artifactLedgerItems = buildArtifactLedgerItems(activeArtifacts);
  const layerName = (id: number) => BRAIN_LAYERS.find((layer) => layer.id === id)?.name || `Layer ${id}`;
  const advisoryConfidencePercent = normalizePercentValue(advisory?.confidence ?? decision?.confidenceScore);
  const advisoryAgentOutputs = (advisory as Record<string, unknown> | undefined)?.agentOutputs as Record<string, unknown> | undefined;
  const agentSignals = buildAgentSignals(advisoryAgentOutputs, orchestrationPlan as Record<string, unknown> | undefined, normalizeAgentScoreValue);
  const currentLayer = decision?.currentLayer ?? 1;
  const notRecordedLabel = t('brain.decisionDetail.notRecorded');
  const inProgressLabel = t('brain.decisionDetail.inProgress');
  const awaitingLabel = t('brain.decisionDetail.awaiting');
  const usedEngines = decision?.engines || {};
  const { engineSummary } = resolveEngineSummary(usedEngines as Record<string, unknown>, t('brain.decisionDetail.notRecorded'));

  const routingPrimary = asText((orchestrationPlan?.routing as Record<string, unknown> | undefined)?.primaryEngineKind, t('brain.decisionDetail.notRecorded'));
  const primaryPluginName = asText((orchestrationPlan?.primaryPlugin as Record<string, unknown> | undefined)?.name, t('brain.decisionDetail.notRecorded'));
  const agentCount = (agentSignals || []).length;

  // Resolve real agent names from orchestrationPlan.agentsSelected (selectedAgents from L5)
  const rawAgentList = orchestrationPlan?.agentsSelected || (orchestrationPlan as unknown as Record<string, unknown> | undefined)?.selectedAgents || [];
  const realAgents = buildRealAgents(rawAgentList);
  const agentNameList = resolveAgentNameList(realAgents, agentSignals, t('brain.decisionDetail.none'));

  const lifecycleRouteContext = getLifecycleRouteContext(activeType);
  const scopedLifecycleAuditTrail = Array.isArray(auditTrail)
    ? buildScopedLifecycleAuditTrail(auditTrail, lifecycleRouteContext)
    : [];

  // ── Per-layer audit event data extraction (rich signals from brainEvents) ──
  const l1Audit = getLayerAuditData(1, scopedLifecycleAuditTrail);
  const l2Audit = getLayerAuditData(2, scopedLifecycleAuditTrail);
  const l3Audit = getLayerAuditData(3, scopedLifecycleAuditTrail);
  const l4Audit = getLayerAuditData(4, scopedLifecycleAuditTrail);
  const l5Audit = getLayerAuditData(5, scopedLifecycleAuditTrail);
  const l6Audit = getLayerAuditData(6, scopedLifecycleAuditTrail);
  const l7Audit = getLayerAuditData(7, scopedLifecycleAuditTrail);
  const l8Audit = getLayerAuditData(8, scopedLifecycleAuditTrail);
  const effectiveClassificationConstraints = resolveClassificationConstraints(l2Audit, classificationConstraints, resolveConstraintRecord);

  const selectedPolicies = Array.isArray(l3Audit?.policiesDetail)
    ? (l3Audit.policiesDetail as Array<Record<string, unknown>>)
    : matchedPolicies;

  const lifecycleAgentSignals = buildLifecycleAgentSignals(scopedLifecycleAuditTrail, normalizeAgentScoreValue);
  const displayedAgentSignals = resolveDisplayedAgentSignals(activeEntry, lifecycleAgentSignals, agentSignals);

  const approvalCompleteStatuses = new Set([
    "approved",
    "initially_approved",
    "manager_approved",
    "published",
    "completed",
    "executed",
    "acknowledged",
  ]);
  const activeVersionLifecycle = computeActiveVersionLifecycle(activeType, {
    activeDecisionType,
    decision: Boolean(decision),
    versionTypeMap,
    latestVersionByType,
    workflowReadiness,
    workflowReadinessVersionType,
    decisionStatus: asText(decision?.status, "draft"),
  });
  const selectedApprovalContext = buildApprovalContext({
    activeVersionLifecycle,
    activeType,
    workflowReadiness: workflowReadiness ?? undefined,
    workflowReadinessVersionType,
    versionTypeMap,
    l7Audit,
    activeSubDecision,
    approvalData,
    latestApproval,
    activeEntrySummary: activeEntry?.summary,
    completeStatuses: approvalCompleteStatuses,
  });

  const layerAudits = [l1Audit, l2Audit, l3Audit, l4Audit, l5Audit, l6Audit];
  const lifecycleLayerCheck = (layerIndex: number) => checkLifecycleLayerData({
    layerIndex,
    activeEntry,
    currentLayer,
    approvalComplete: selectedApprovalContext.complete,
    l7Audit,
    l8Audit,
    activeArtifactsCount: activeArtifacts.length,
    layerAudits,
  });

  // ── IPLAN metadata from orchestrationPlan ──
  const iplanId = orchestrationPlan?.iplanId || null;
  const iplanMode = orchestrationPlan?.iplanMode || null;
  const iplanRouting = orchestrationPlan?.routing || {};
  const iplanRedaction = orchestrationPlan?.redactionMode || null;
  const iplanBudgets = orchestrationPlan?.budgets || null;
  const iplanToolsAllowed = orchestrationPlan?.toolsAllowed || [];
  const fallbackPlugins = Array.isArray(iplanRouting?.fallbackPlugins) ? iplanRouting.fallbackPlugins : [];
  const distillationPlugin = iplanRouting?.distillation || null;

  const spineRecord = decision?.spineOverview?.spine as Record<string, unknown> | undefined;
  const lifecycleSteps = [
    // L1 — Intake
    {
      label: layerName(1),
      status: resolveLayerStatusValue(currentLayer, 1),
      detail: buildIntakeDetail(lifecycleRouteContext, decision?.serviceId, decision?.routeKey, l1Audit, inputData, t('brain.decisionDetail.raw'), t('brain.decisionDetail.normalized')),
    },
    // L2 — Classification
    {
      label: layerName(2),
      status: resolveLayerStatusValue(currentLayer, 2),
      detail: buildClassificationDetail(classificationLevel, classificationData, l2Audit, decision?.riskLevel, spineRecord?.sector, spineRecord?.jurisdiction, notRecordedLabel),
    },
    // L3 — Policy Gate
    {
      label: layerName(3),
      status: resolveLayerStatusValue(currentLayer, 3),
      detail: buildPolicyGateDetail(policyVerdict, l3Audit, selectedPolicies, notRecordedLabel),
    },
    // L4 — Context Quality
    {
      label: layerName(4),
      status: resolveLayerStatusValue(currentLayer, 4),
      detail: buildContextQualityDetail({
        isBusinessCaseLifecycle, isRequirementsLifecycle, isStrategicFitLifecycle, isDemandLifecycle,
        businessCaseSignals, requirementsSignals, strategicFitSignals, totalRequirementsCount,
        activeDemandCompleteness: demandCtx.activeDemandCompleteness, activeDemandMissingFieldCount: demandCtx.activeDemandMissingFieldCount,
        l4Audit, contextScore, contextQuality, notRecordedLabel,
      }),
    },
    // L5 — Orchestration / IPLAN
    {
      label: layerName(5),
      status: resolveLayerStatusValue(currentLayer, 5),
      detail: buildOrchestrationDetail({
        isRequirementsLifecycle, isStrategicFitLifecycle, requirementsSignals, strategicFitSignals,
        iplanId, iplanRouting, iplanRedaction, l5Audit, routingPrimary, primaryPluginName,
        realAgentsCount: realAgents.length, agentCount,
        displayedAgentNames: displayedAgentSignals.map((agent) => agent.name).join(" · "),
        agentNameList, notRecordedLabel,
      }),
    },
    // L6 — Advisory / Reasoning
    {
      label: layerName(6),
      status: resolveLayerStatusValue(currentLayer, 6),
      detail: buildAdvisoryDetail({
        isBusinessCaseLifecycle, advisory: advisory as Record<string, unknown> | undefined,
        activeEntrySummary: activeEntry?.summary, l6Audit, advisoryConfidencePercent, engineSummary,
      }),
    },
    // L7 — Validation & Approval
    {
      label: layerName(7),
      status: resolveLayerStatusValue(currentLayer, 7),
      detail: buildValidationDetail(selectedApprovalContext.status, l7Audit, notRecordedLabel),
    },
    // L8 — Memory, Execution & Learning
    {
      label: layerName(8),
      status: resolveLayerStatusValue(currentLayer, 8),
      detail: buildMemoryDetail(l8Audit, executions.length, memoryEntries?.length || 0, notRecordedLabel),
    },
  ].map((step, index) => {
    const layerIndex = index + 1;
    return resolveLifecycleStepOverride(
      step, layerIndex, Boolean(activeEntry), lifecycleLayerCheck(layerIndex),
      currentLayer, inProgressLabel, awaitingLabel,
    );
  });
  const activeLayer = (lifecycleSteps.find((step) => step.layerIndex === (selectedLayer || 1)) || lifecycleSteps[0])!;

  const layerViewCtx: LayerViewContext = {
    t,
    activeEntryType: activeEntry?.type,
    decisionServiceId: decision?.serviceId,
    decisionRouteKey: decision?.routeKey,
    l1Audit, lifecycleRouteContext, inputData,
    classificationLevel, classificationData, classificationConstraints, effectiveClassificationConstraints,
    l2Audit, decisionRiskLevel: decision?.riskLevel,
    policyEvaluation: policyEvaluation as Record<string, unknown> | undefined,
    policyVerdict, selectedPolicies,
    isBusinessCaseLifecycle, isRequirementsLifecycle, isStrategicFitLifecycle, isDemandLifecycle,
    totalRequirementsCount, requirementsSignals, businessCaseSignals, strategicFitSignals,
    contextCompletenessValue, contextMissingFieldCount, contextMissingFieldPreview,
    activeDemandSectionSummaries, demandSectionSummaries,
    l4Audit, contextScore, contextQuality,
    l5Audit, displayedAgentSignals, realAgents, agentCount,
    orchestrationPlan: orchestrationPlan as Record<string, unknown> | undefined,
    iplanId, iplanMode, iplanRouting, iplanRedaction, iplanBudgets,
    iplanToolsAllowed, fallbackPlugins, distillationPlugin, routingOverride, primaryPluginName,
    resolveEngineKindLabel,
    l6Audit, advisory: advisory as Record<string, unknown> | undefined,
    advisoryConfidencePercent, engineSummary, resolveHybridEngineLabel,
    l7Audit, selectedApprovalContext,
    l8Audit, actionExecutions: actionExecutions as Array<Record<string, unknown>>, memoryEntries,
    getJourneyServiceLabel,
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border bg-[linear-gradient(120deg,hsl(var(--brain-surface))_0%,hsl(var(--brain-surface-bright))_45%,hsl(var(--brain-nimbus))_100%)] p-6">
        <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[radial-gradient(circle,hsl(var(--brain-gold)/0.18)_0%,transparent_70%)]" />
        <div className="absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,hsl(var(--brain-teal)/0.18)_0%,transparent_70%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/brain-console/decisions">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t('brain.decisionDetail.decisionLifecycle')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{decisionTitle}</h1>
                <StatusBadge status={decision.status} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="text-muted-foreground">{t('brain.decisionDetail.spine')}</span>{" "}
                <span className="font-mono text-primary">{asText(spineId, asText(decision.id))}</span>
                <span className="mx-2">•</span>
                <span className="font-semibold text-foreground">DEMAND_DECISION</span>
                {renderServiceLabel(activeEntry, decision, getJourneyServiceLabel)}
                <span className="mx-2">•</span>
                {decision.owner || "--"}
                <span className="mx-2">•</span>
                {decision.department || "--"}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2">
            <div className="rounded-full border bg-white/70 px-3 py-1 text-xs text-muted-foreground">
              {t('brain.decisionDetail.classification')} <span className="font-semibold text-foreground">{classificationLevel}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="border-0 bg-white shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{t('brain.decisionDetail.executionAndActions')}</CardTitle>
                  <CardDescription>{t('brain.decisionDetail.executionAndActionsDesc')}</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExecutionPanel((prev) => !prev)}
                >
                  {showExecutionPanel ? t('app.hide') : t('app.show')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {showExecutionPanel ? (
                <>
                  <ApprovalGatePanel
                    decisionId={decisionId}
                    requiresApproval={decision.status === "validation" || approvalData?.status === "pending"}
                    approvalReason={approvalData?.approvalReason || t('brain.decisionDetail.awaitingValidation')}
                    approvals={approvals}
                    isApproved={isApproved}
                    onApprove={(data) => approveMutation.mutateAsync(data)}
                    onExecuteActions={async (approvalId) => {
                      await executeActionsMutation.mutateAsync(approvalId);
                    }}
                    isSubmitting={approveMutation.isPending}
                    isExecuting={executeActionsMutation.isPending}
                    workflowReadiness={decision?.workflowReadiness}
                    proposedActions={proposedActions}
                  />
                  {renderExecutionList(t, executions)}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{t('brain.decisionDetail.hiddenByDefault')}</p>
              )}
            </CardContent>
          </Card>

          {missingFinalTypes.length > 0 && (
            <Alert className="border-amber-500/40 bg-amber-500/5">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <div>
                <AlertTitle>{t('brain.decisionDetail.finalNotComplete')}</AlertTitle>
                <AlertDescription>
                  {t('brain.decisionDetail.finalNotCompleteDesc')}
                </AlertDescription>
                <div className="mt-3 space-y-2 text-xs">
                  {missingEntries.map((entry) => renderMissingFinalEntry(t, entry, decisionId))}
                </div>
              </div>
            </Alert>
          )}

          <Card className="border-0 bg-white shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,hsl(var(--brain-indigo))_0%,hsl(var(--brain-teal))_100%)] text-white">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">{t('brain.decisionDetail.subDecisionTimeline')}</CardTitle>
                  <CardDescription>{t('brain.decisionDetail.subDecisionTimelineDesc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {spine ? (
                renderTimelineContent({ t, spine, timelineEntries: timelineEntries as TimelineEntry[], activeEntryKey: activeEntry?.key, onSelectEntry: setActiveEntry })
                ?? <EmptyState title={t('brain.decisionDetail.noSpineData')} description={t('brain.decisionDetail.noSpineDataDesc')} />
              ) : (
                <EmptyState title={t('brain.decisionDetail.noSpineData')} description={t('brain.decisionDetail.noSpineDataDesc')} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-0 bg-white shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t('brain.decisionDetail.decisionSpine')}</CardTitle>
                <Badge variant="outline" className="text-xs">{spine?.status || "pending"}</Badge>
              </div>
              <CardDescription>{t('brain.decisionDetail.decisionSpineDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {renderSpineContent({ t, ledger, policyVerdict, contextScore, decision, getJourneyServiceLabel })}
            </CardContent>
          </Card>

          <Card className="border-0 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{missingFinalTypes.length > 0 ? t('brain.decisionDetail.provisionalDecision') : t('brain.decisionDetail.finalDecision')}</CardTitle>
              <CardDescription>
                {missingFinalTypes.length > 0
                  ? t('brain.decisionDetail.provisionalDecisionDesc')
                  : t('brain.decisionDetail.finalDecisionDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {renderDecisionContent({ t, decision, ledger, advisory: advisory as Record<string, unknown> | undefined, advisoryConfidencePercent })}
            </CardContent>
          </Card>

          <Card className="border-0 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{t('brain.decisionDetail.artifactsIndex')}</CardTitle>
              <CardDescription>{t('brain.decisionDetail.artifactsIndexDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {renderArtifactsContent({ t, artifacts })}
            </CardContent>
          </Card>
        </div>
      </div>
      {activeEntry && renderActiveEntryOverlay({
        t,
        activeEntry,
        onClose: () => setActiveEntry(null),
        orchestrationRef,
        lifecycleSteps,
        selectedLayer,
        onSelectLayer: setSelectedLayer,
        activeLayer,
        layerViewCtx,
        displayedAgentSignals,
        ledger,
        activeSubDecisionApprovalId: activeSubDecision?.approvalId,
        policyEvaluation: policyEvaluation as Record<string, unknown> | undefined,
        policyVerdict,
        selectedPolicies,
        classificationLevel,
        classificationData,
        effectiveClassificationConstraints,
        routingOverride,
        auditTrail,
        artifactLedgerItems,
        knowledgeEvidence,
      })}
    </div>
  );
}
