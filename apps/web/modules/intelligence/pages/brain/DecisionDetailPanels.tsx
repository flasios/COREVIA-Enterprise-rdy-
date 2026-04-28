/**
 * Sub-components extracted from DecisionDetail to reduce cognitive complexity.
 * These are purely presentational — no hooks, no side effects.
 */
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TFunction } from "i18next";

// ── Shared helpers re-used across layers ──

/** Safe stringifier that avoids [object Object] — returns fallback for objects/null/undefined */
function safeText(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  if (typeof v === "object") return fallback;
  return `${v as string | number | boolean | bigint}`;
}

/** Resolve policy result CSS class without nested ternary */
function policyResultClass(result: unknown): string {
  const r = safeText(result).toLowerCase();
  if (r === "allow") return "bg-emerald-500/10 text-emerald-700 border-emerald-200";
  if (r === "block") return "bg-rose-500/10 text-rose-600 border-rose-200";
  return "bg-amber-500/10 text-amber-700 border-amber-200";
}

/** Resolve approval status CSS class without nested ternary */
function approvalStatusClass(status: string): string {
  if (status === "approved" || status === "initially_approved" || status === "manager_approved") {
    return "bg-emerald-500/10 text-emerald-700";
  }
  if (status === "rejected") return "bg-rose-500/10 text-rose-600";
  return "bg-amber-500/10 text-amber-700";
}

/** Resolve section status CSS class without nested ternary */
function sectionStatusClass(status: string): string {
  if (status === "complete") return "bg-emerald-500/10 text-emerald-700";
  if (status === "partial") return "bg-amber-500/10 text-amber-700";
  return "bg-rose-500/10 text-rose-600";
}

/** Resolve HITL display value without nested ternary */
function hitlDisplayValue(requiresHitl: unknown, yesLabel: string, noLabel: string): string {
  if (requiresHitl == null) return "--";
  return requiresHitl ? yesLabel : noLabel;
}

function row(label: React.ReactNode, value: React.ReactNode) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function rowTruncated(label: React.ReactNode, value: string, maxW = "max-w-[16rem]") {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className={`font-semibold text-foreground truncate ${maxW} text-right`}>{value}</span>
    </div>
  );
}

function sectionBox(title: string, titleClass: string, children: React.ReactNode) {
  return (
    <div className="mt-2 rounded-xl border bg-muted/30 p-3 text-xs">
      <p className={`text-[0.7rem] uppercase tracking-[0.2em] ${titleClass}`}>{title}</p>
      <div className="mt-2 grid gap-2">{children}</div>
    </div>
  );
}

// ── Shared types ──

export interface DemandSectionSummary {
  key: string;
  label: string;
  filled: number;
  total: number;
  percent: number;
  status: string;
}

export interface AgentSignalItem {
  name: string;
  score: number | null;
  status: string;
}

export interface RealAgent {
  agentId: string;
  agentName: string;
  mode: string;
}

interface ApprovalContextShape {
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  reason: string | null;
  complete: boolean;
}

// ── LayerViewContext: single object passed to renderLayerDetailContent ──

export interface LayerViewContext {
  t: TFunction;
  // L1
  activeEntryType: string | undefined;
  decisionServiceId: string | undefined;
  decisionRouteKey: string | undefined;
  l1Audit: Record<string, unknown> | null;
  lifecycleRouteContext: { routeKey?: string; layerPrefix?: string } | null;
  inputData: Record<string, unknown>;
  // L2
  classificationLevel: string | null;
  classificationData: Record<string, unknown>;
  classificationConstraints: Record<string, unknown>;
  effectiveClassificationConstraints: Record<string, unknown>;
  l2Audit: Record<string, unknown> | null;
  decisionRiskLevel: string | undefined;
  // L3
  policyEvaluation: Record<string, unknown> | undefined;
  policyVerdict: string | null;
  selectedPolicies: Array<Record<string, unknown>>;
  // L4
  isBusinessCaseLifecycle: boolean;
  isRequirementsLifecycle: boolean;
  isStrategicFitLifecycle: boolean;
  isDemandLifecycle: boolean;
  totalRequirementsCount: number;
  requirementsSignals: {
    capabilities: number; functional: number; nonFunctional: number;
    security: number; capabilityGaps: number; dependencies: number;
    roles: number; deliveryPhases: number; technologyDomains: number; traceabilityLinks: number;
  };
  businessCaseSignals: { options: number; financialScenarios: number; risks: number; dependencies: number; recommendation: string | null };
  strategicFitSignals: {
    recommendationRoute: string | null; alternatives: number; criteria: number;
    alignmentAreas: number; governanceGates: number; governmentInitiatives: number;
    risks: number; routeConfidence: number | null;
  };
  contextCompletenessValue: number | null;
  contextMissingFieldCount: number;
  contextMissingFieldPreview: string[];
  activeDemandSectionSummaries: DemandSectionSummary[];
  demandSectionSummaries: DemandSectionSummary[];
  l4Audit: Record<string, unknown> | null;
  contextScore: number | null;
  contextQuality: Record<string, unknown> | undefined;
  // L5
  l5Audit: Record<string, unknown> | null;
  displayedAgentSignals: AgentSignalItem[];
  realAgents: RealAgent[];
  agentCount: number;
  orchestrationPlan: Record<string, unknown> | undefined;
  iplanId: unknown;
  iplanMode: unknown;
  iplanRouting: Record<string, unknown>;
  iplanRedaction: unknown;
  iplanBudgets: Record<string, unknown> | null;
  iplanToolsAllowed: unknown[];
  fallbackPlugins: Array<Record<string, unknown>>;
  distillationPlugin: Record<string, unknown> | null;
  routingOverride: { source?: string; forcedEngineKind?: string; forcedEngineId?: string; reason?: string } | undefined;
  primaryPluginName: string;
  resolveEngineKindLabel: (audit: Record<string, unknown> | null) => string;
  // L6
  l6Audit: Record<string, unknown> | null;
  advisory: Record<string, unknown> | undefined;
  advisoryConfidencePercent: number | null;
  engineSummary: string;
  resolveHybridEngineLabel: (audit: Record<string, unknown> | null, t: TFunction) => string;
  // L7
  l7Audit: Record<string, unknown> | null;
  selectedApprovalContext: ApprovalContextShape;
  // L8
  l8Audit: Record<string, unknown> | null;
  actionExecutions: Array<Record<string, unknown>>;
  memoryEntries: Array<Record<string, unknown>>;
  // Shared label helper
  getJourneyServiceLabel: (serviceId: string) => string;
}

// ── Per-layer render functions ──

function renderLayer1(ctx: LayerViewContext): React.ReactNode {
  const { t, activeEntryType, decisionServiceId, l1Audit, lifecycleRouteContext, inputData, getJourneyServiceLabel } = ctx;
  return (
    <>
      {row(t('brain.decisionDetail.journey'), "DEMAND_DECISION")}
      {row(t('brain.decisionDetail.subDecision'), activeEntryType || getJourneyServiceLabel(decisionServiceId || "corevia"))}
      {row(t('brain.decisionDetail.routeKey'), safeText(l1Audit?.routeKey, safeText(lifecycleRouteContext?.routeKey, safeText(ctx.decisionRouteKey, "--"))))}
      {row(t('brain.decisionDetail.inputFieldsCaptured'), safeText(l1Audit?.inputFieldCount, String(Object.keys(inputData || {}).length)))}
      {row(t('brain.decisionDetail.normalization'), l1Audit?.normalized === false ? t('brain.decisionDetail.raw') : t('brain.decisionDetail.normalized'))}
      {l1Audit?.decisionId && (
        <div className="flex items-center justify-between">
          <span>{t('brain.decisionDetail.decisionId')}</span>
          <span className="font-mono font-semibold text-foreground text-[10px]">{safeText(l1Audit.decisionId).substring(0, 20)}</span>
        </div>
      )}
      {Object.keys(inputData || {}).length > 0 && (
        <div className="mt-2 rounded-xl border bg-muted/30 p-3 text-xs">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">{t('brain.decisionDetail.keyInputFields')}</p>
          <div className="mt-2 grid gap-1">
            {Object.entries(inputData || {}).slice(0, 8).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="truncate text-muted-foreground">{key}</span>
                <span className="font-semibold text-foreground truncate max-w-[14rem] text-right">{val == null ? "--" : safeText(val, "--").substring(0, 50)}</span>
              </div>
            ))}
            {Object.keys(inputData || {}).length > 8 && (
              <p className="text-[10px] text-muted-foreground mt-1">+{Object.keys(inputData || {}).length - 8} more fields</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function renderLayer2(ctx: LayerViewContext): React.ReactNode {
  const { t, classificationLevel, classificationData, classificationConstraints, effectiveClassificationConstraints, l2Audit, decisionRiskLevel } = ctx;
  return (
    <>
      {row(t('brain.decisionDetail.classificationLevel'),
        <span className="font-semibold text-foreground capitalize">{safeText(classificationLevel, safeText(classificationData?.classification, safeText(classificationData?.classificationLevel, t('brain.decisionDetail.notRecorded'))))}</span>
      )}
      {row(t('brain.decisionDetail.riskLevel'),
        <span className="font-semibold text-foreground capitalize">{safeText(classificationData?.riskLevel, safeText(l2Audit?.riskLevel, safeText(decisionRiskLevel, "--")))}</span>
      )}
      {row(t('brain.decisionDetail.sector'), safeText(classificationData?.sector, safeText(l2Audit?.sector, "--")))}
      {row(t('brain.decisionDetail.jurisdiction'), safeText(classificationData?.jurisdiction, safeText(l2Audit?.jurisdiction, "--")))}
      {sectionBox(t('brain.decisionDetail.constraints'), "text-muted-foreground", <>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('brain.decisionDetail.externalModels')}</span>
          <span className="font-semibold text-foreground">
            {classificationData?.externalLlmAllowed === false || classificationConstraints?.allowExternalModels === false
              || effectiveClassificationConstraints?.allowExternalModels === false
              ? t('brain.decisionDetail.blockedLabel')
              : t('brain.decisionDetail.allowedLabel')}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('brain.decisionDetail.cloudProcessing')}</span>
          <span className="font-semibold text-foreground">
            {classificationData?.cloudAllowed === false || classificationConstraints?.cloudAllowed === false || classificationConstraints?.allowCloudProcessing === false
              || effectiveClassificationConstraints?.cloudAllowed === false || effectiveClassificationConstraints?.allowCloudProcessing === false
              ? t('brain.decisionDetail.blockedLabel')
              : t('brain.decisionDetail.allowedLabel')}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('brain.decisionDetail.hitlRequired')}</span>
          <span className="font-semibold text-foreground">
            {classificationData?.hitlRequired === true || classificationConstraints?.hitlRequired === true || classificationConstraints?.requireHitl === true
              || effectiveClassificationConstraints?.hitlRequired === true || effectiveClassificationConstraints?.requireHitl === true
              ? t('app.yes')
              : t('app.no')}
          </span>
        </div>
      </>)}
      {l2Audit?.constraints && typeof l2Audit.constraints === "object" && Object.keys(l2Audit.constraints).length > 0 && (
        <div className="rounded-xl border bg-muted/30 p-3 text-xs">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">{t('brain.decisionDetail.auditConstraints')}</p>
          <div className="mt-2 grid gap-1">
            {Object.entries(l2Audit.constraints).slice(0, 6).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-muted-foreground">{key}</span>
                <span className="font-semibold text-foreground">{safeText(val, "--")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function renderLayer3(ctx: LayerViewContext): React.ReactNode {
  const { t, policyEvaluation, policyVerdict, selectedPolicies } = ctx;
  const verdictText = safeText(policyEvaluation?.verdict, safeText(policyVerdict));
  const verdictLower = verdictText.toLowerCase();
  return (
    <>
      <div className="flex items-center justify-between">
        <span>{t('brain.decisionDetail.verdict')}</span>
        <Badge variant="outline" className={`text-xs uppercase ${
          verdictLower === "allow"
            ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
            : "bg-rose-500/10 text-rose-600 border-rose-200"
        }`}>
          {verdictText || t('brain.decisionDetail.notRecorded')}
        </Badge>
      </div>
      {row(t('brain.decisionDetail.policiesEvaluated'), selectedPolicies.length)}
      {selectedPolicies.length === 0 ? (
        <div className="text-xs text-muted-foreground">{t('brain.decisionDetail.noPolicyEvaluations')}</div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-auto pr-1">
          {selectedPolicies.map((policy, idx: number) => (
            <div key={`${safeText(policy?.policyId, safeText(policy?.id, String(idx)))}`} className="rounded-lg border bg-muted/30 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-foreground text-[12px] font-medium">
                  {safeText(policy?.policyName, safeText(policy?.name, safeText(policy?.title, "Policy")))}
                </span>
                <Badge variant="outline" className={`text-[10px] uppercase shrink-0 ${policyResultClass(policy?.result)}`}>
                  {safeText(policy?.result, safeText(policy?.decision, safeText(policy?.effect, "review")))}
                </Badge>
              </div>
              <div className="mt-0.5 text-[10px] font-mono text-muted-foreground">{safeText(policy?.policyId)}</div>
              {policy?.reason ? (
                <div className="mt-1 text-[11px] text-muted-foreground italic">{safeText(policy.reason)}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {policyEvaluation?.blockReason ? (
        <div className="mt-2 rounded-xl border bg-gradient-to-br from-emerald-50/40 to-teal-50/30 p-3 text-xs">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-emerald-700 font-semibold">{t('brain.decisionDetail.governanceReview')}</p>
          <p className="mt-1 text-foreground">{safeText(policyEvaluation.blockReason)}</p>
        </div>
      ) : null}
    </>
  );
}

function renderLayer4(ctx: LayerViewContext): React.ReactNode {
  const {
    t, isRequirementsLifecycle, isStrategicFitLifecycle, isBusinessCaseLifecycle, isDemandLifecycle,
    totalRequirementsCount, requirementsSignals, strategicFitSignals, businessCaseSignals,
    contextCompletenessValue, contextMissingFieldCount, contextMissingFieldPreview,
    activeDemandSectionSummaries, demandSectionSummaries,
  } = ctx;

  if (isRequirementsLifecycle) {
    return (
      <>
        {row(t('brain.decisionDetail.totalRequirements'), totalRequirementsCount)}
        {row(t('brain.decisionDetail.capabilities'), requirementsSignals.capabilities)}
        {row(t('brain.decisionDetail.functional'), requirementsSignals.functional)}
        {row(t('brain.decisionDetail.nonFunctional'), requirementsSignals.nonFunctional)}
        {row(t('brain.decisionDetail.security'), requirementsSignals.security)}
        {row(t('brain.decisionDetail.capabilityGaps'), requirementsSignals.capabilityGaps)}
      </>
    );
  }
  if (isStrategicFitLifecycle) {
    return (
      <>
        {row(t('brain.decisionDetail.decisionCriteria'), strategicFitSignals.criteria)}
        {row(t('brain.decisionDetail.alternativeRecommendations'), strategicFitSignals.alternatives)}
        {row(t('brain.decisionDetail.criticalCapabilities'), strategicFitSignals.alignmentAreas)}
        {rowTruncated(t('brain.decisionDetail.recommendedOption'), safeText(strategicFitSignals.recommendationRoute, "--"))}
      </>
    );
  }
  if (isBusinessCaseLifecycle) {
    return (
      <>
        {row(t('brain.decisionDetail.optionsEvaluated'), businessCaseSignals.options)}
        {row(t('brain.decisionDetail.financialScenarios'), businessCaseSignals.financialScenarios)}
        {row(t('brain.decisionDetail.risksCaptured'), businessCaseSignals.risks)}
        {rowTruncated(t('brain.decisionDetail.recommendation'), safeText(businessCaseSignals.recommendation, "--"))}
      </>
    );
  }

  const sections = isDemandLifecycle ? activeDemandSectionSummaries : demandSectionSummaries;
  return (
    <>
      {row(t('brain.decisionDetail.completeness'), contextCompletenessValue == null ? "--" : `${contextCompletenessValue}%`)}
      {row(t('brain.decisionDetail.missingFields'), contextMissingFieldCount)}
      {contextMissingFieldPreview.map((field: string) => (
        <div key={field} className="flex items-center justify-between">
          <span className="truncate">{field}</span>
          <span className="text-foreground">{t('brain.decisionDetail.needsInfoLower')}</span>
        </div>
      ))}
      {sections.length > 0 && (
        <div className="mt-2 rounded-xl border bg-muted/30 p-3 text-xs">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">{t('brain.decisionDetail.demandSections')}</p>
          <div className="mt-2 grid gap-2">
            {sections.map((section) => (
              <div key={section.key} className="flex items-center justify-between">
                <span className="truncate text-muted-foreground">{section.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {section.filled}/{section.total}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[0.65rem] capitalize ${sectionStatusClass(section.status)}`}
                  >
                    {section.percent}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function renderLayer5(ctx: LayerViewContext): React.ReactNode {
  const {
    t, isRequirementsLifecycle, isStrategicFitLifecycle, isBusinessCaseLifecycle,
    requirementsSignals, strategicFitSignals, businessCaseSignals,
    l5Audit, displayedAgentSignals, realAgents, agentCount, orchestrationPlan,
    iplanId, iplanMode, iplanRouting, iplanRedaction, iplanBudgets, iplanToolsAllowed,
    fallbackPlugins, distillationPlugin, routingOverride, primaryPluginName, resolveEngineKindLabel,
  } = ctx;

  let coreMetrics: React.ReactNode;
  if (isRequirementsLifecycle) {
    coreMetrics = (
      <>
        {row(t('brain.decisionDetail.deliveryPhases'), requirementsSignals.deliveryPhases)}
        {row(t('brain.decisionDetail.deliveryRoles'), requirementsSignals.roles)}
        {row(t('brain.decisionDetail.dependencies'), requirementsSignals.dependencies)}
        {row(t('brain.decisionDetail.technologyDomains'), requirementsSignals.technologyDomains)}
        {row(t('brain.decisionDetail.traceabilityLinks'), requirementsSignals.traceabilityLinks)}
      </>
    );
  } else if (isStrategicFitLifecycle) {
    coreMetrics = (
      <>
        {row(t('brain.decisionDetail.governanceGates'), strategicFitSignals.governanceGates)}
        {row(t('brain.decisionDetail.riskMitigations'), strategicFitSignals.risks)}
        {row(t('brain.decisionDetail.governmentInitiatives'), strategicFitSignals.governmentInitiatives)}
        {row(t('brain.decisionDetail.routeConfidence'), strategicFitSignals.routeConfidence == null ? "--" : `${strategicFitSignals.routeConfidence}%`)}
      </>
    );
  } else if (isBusinessCaseLifecycle) {
    coreMetrics = (
      <>
        {row(t('brain.decisionDetail.dependencies'), businessCaseSignals.dependencies)}
        {row(t('brain.decisionDetail.deliveryRisks'), businessCaseSignals.risks)}
      </>
    );
  } else {
    coreMetrics = (
      <>
        {row(t('brain.decisionDetail.totalAgents'), Number(l5Audit?.selectedAgentsCount ?? 0) || displayedAgentSignals.length || realAgents.length || agentCount || 0)}
        {row(t('brain.decisionDetail.executionSteps'), Number(l5Audit?.executionSteps) || ((orchestrationPlan?.executionPlan as unknown[] | undefined) ?? []).length || 0)}
      </>
    );
  }

  return (
    <>
      {coreMetrics}
      {/* IPLAN Card */}
      {iplanId && (
        <div className="mt-2 rounded-xl border bg-gradient-to-br from-indigo-50/60 to-teal-50/40 p-3 text-xs">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-indigo-600 font-semibold">{t('brain.decisionDetail.intelligencePlan')}</p>
          <div className="mt-2 grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('brain.decisionDetail.iplanId')}</span>
              <span className="font-mono font-semibold text-foreground text-[10px]">{safeText(iplanId)}</span>
            </div>
            {iplanMode != null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('brain.decisionDetail.mode')}</span>
                <span className="font-semibold text-foreground uppercase">{safeText(iplanMode)}</span>
              </div>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {t('brain.decisionDetail.iplanClarification')}
          </p>
        </div>
      )}
      {/* 3-Engine Routing Card */}
      {sectionBox(t('brain.decisionDetail.engineRouting'), "text-muted-foreground", <>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('brain.decisionDetail.primaryEngine')}</span>
          <span className="font-semibold text-foreground">{safeText(iplanRouting?.primaryEngineKind, safeText(l5Audit?.primaryEngineKind, resolveEngineKindLabel(l5Audit)))}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('brain.decisionDetail.primaryPlugin')}</span>
          <span className="font-semibold text-foreground">{safeText(iplanRouting?.primaryPluginName, safeText(l5Audit?.primaryPluginName, safeText(primaryPluginName, "--")))}</span>
        </div>
        {(iplanRouting?.primaryPluginId || l5Audit?.primaryPluginId) && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('brain.decisionDetail.pluginId')}</span>
            <span className="font-mono font-semibold text-foreground text-[10px]">{safeText(iplanRouting?.primaryPluginId, safeText(l5Audit?.primaryPluginId))}</span>
          </div>
        )}
        {fallbackPlugins.length > 0 && (
          <>
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground mt-1">{t('brain.decisionDetail.fallbackEngines')}</p>
            {fallbackPlugins.map((fb: Record<string, unknown>, idx: number) => (
              <div key={safeText(fb?.pluginId, String(idx))} className="flex items-center justify-between pl-2">
                <span className="text-muted-foreground">Fallback {idx + 1}</span>
                <span className="font-semibold text-foreground">{safeText(fb?.pluginName, safeText(fb?.pluginId, "--"))}</span>
              </div>
            ))}
          </>
        )}
        {distillationPlugin && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('brain.decisionDetail.distillationEngine')}</span>
            <span className="font-semibold text-foreground">{safeText(distillationPlugin?.pluginName, safeText(distillationPlugin?.pluginId, "--"))}</span>
          </div>
        )}
      </>)}
      {/* Security & Constraints Card */}
      {sectionBox(t('brain.decisionDetail.securityConstraints'), "text-muted-foreground", <>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('brain.decisionDetail.redactionMode')}</span>
          <span className="font-semibold text-foreground">{safeText(iplanRedaction, "NONE")}</span>
        </div>
        {iplanBudgets && typeof iplanBudgets === "object" && Object.keys(iplanBudgets).length > 0 && (
          <>
            {Object.entries(iplanBudgets).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-muted-foreground">Budget: {key}</span>
                <span className="font-semibold text-foreground">{safeText(val, "--")}</span>
              </div>
            ))}
          </>
        )}
        {Array.isArray(iplanToolsAllowed) && iplanToolsAllowed.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('brain.decisionDetail.toolsAllowed')}</span>
            <span className="font-semibold text-foreground">{iplanToolsAllowed.map((tool: unknown) => safeText(tool, "--")).join(", ")}</span>
          </div>
        )}
      </>)}
      {/* Routing Override */}
      {routingOverride && (
        <div className="mt-2 rounded-xl border bg-amber-50/50 p-3 text-xs">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-amber-700 font-semibold">{t('brain.decisionDetail.routingOverrideActive')}</p>
          <div className="mt-2 grid gap-2">
            {row(t('brain.decisionDetail.source'), routingOverride.source)}
            {row(t('brain.decisionDetail.forcedEngine'), routingOverride.forcedEngineKind || "default")}
            {routingOverride.forcedEngineId && row(t('brain.decisionDetail.engineId'), routingOverride.forcedEngineId)}
            {routingOverride.reason && row(t('brain.decisionDetail.reason'), routingOverride.reason)}
          </div>
        </div>
      )}
      {/* Agent List */}
      {realAgents.length > 0 && (
        <div className="mt-2 rounded-xl border bg-muted/30 p-3 text-xs">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">{t('brain.decisionDetail.selectedAgents', { count: realAgents.length })}</p>
          <div className="mt-2 grid gap-1">
            {realAgents.map((agent, idx) => (
              <div key={`${agent.agentId || idx}`} className="flex items-center justify-between">
                <span className="truncate text-foreground font-medium">{agent.agentName}</span>
                <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 uppercase tracking-wider">{agent.mode}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {realAgents.length === 0 && ((orchestrationPlan?.executionPlan as unknown[] | undefined) || []).length > 0 && (
        <div className="mt-2 rounded-xl border bg-muted/30 p-3 text-xs">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">{t('brain.decisionDetail.executionPlan')}</p>
          <div className="mt-2 grid gap-1">
            {((orchestrationPlan?.executionPlan as Array<Record<string, unknown>>) || []).slice(0, 8).map((step: Record<string, unknown>, idx: number) => (
              <div key={safeText(step?.name, safeText(step?.target, String(idx)))} className="flex items-center justify-between">
                <span className="truncate">{safeText(step?.name, safeText(step?.target, safeText(step?.type, "Step")))}</span>
                <span className="text-foreground">{safeText(step?.mode, safeText(step?.status, "planned"))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function renderLayer6(ctx: LayerViewContext): React.ReactNode {
  const {
    t, isStrategicFitLifecycle, isBusinessCaseLifecycle, strategicFitSignals, businessCaseSignals,
    advisory, l6Audit, advisoryConfidencePercent, resolveHybridEngineLabel,
  } = ctx;

  if (isStrategicFitLifecycle) {
    return (
      <>
        {rowTruncated(t('brain.decisionDetail.primaryRecommendation'), safeText(strategicFitSignals.recommendationRoute, "pending"))}
        {row(t('brain.decisionDetail.alternatives'), strategicFitSignals.alternatives)}
        {row(t('brain.decisionDetail.governanceGates'), strategicFitSignals.governanceGates)}
      </>
    );
  }
  if (isBusinessCaseLifecycle) {
    return (
      <>
        {rowTruncated(t('brain.decisionDetail.businessRecommendation'), safeText(businessCaseSignals.recommendation, "pending"))}
        {row(t('brain.decisionDetail.riskRegister'), businessCaseSignals.risks)}
        {row(t('brain.decisionDetail.financialScenarios'), businessCaseSignals.financialScenarios)}
      </>
    );
  }

  const countItems = (v: unknown) => (Array.isArray(v) ? v.length : 0);

  return (
    <>
      {rowTruncated(t('brain.decisionDetail.recommendation'), safeText(advisory?.recommendation, "pending"))}
      {row(t('brain.decisionDetail.optionsGenerated'), Number(l6Audit?.optionsGenerated ?? 0) || countItems(advisory?.options))}
      {row(t('brain.decisionDetail.risksIdentified'), Number(l6Audit?.risksIdentified ?? 0) || countItems(advisory?.risksAndControls) || countItems(advisory?.risks))}
      {row(t('brain.decisionDetail.agentsExecuted'), safeText(l6Audit?.agentsExecuted, "0"))}
      {row(t('brain.decisionDetail.ragDocumentsFound'), safeText(l6Audit?.ragDocumentsFound, "0"))}
      {l6Audit?.patternsSimilarDecisions != null && row(t('brain.decisionDetail.similarPatterns'), safeText(l6Audit.patternsSimilarDecisions))}
      {row(t('brain.decisionDetail.confidence'), advisoryConfidencePercent == null ? "--" : `${advisoryConfidencePercent}%`)}
      {/* Engine Usage Summary */}
      {sectionBox(t('brain.decisionDetail.engineUsage'), "text-muted-foreground", <>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('brain.decisionDetail.internalSovereign')}</span>
          <span className="font-semibold text-foreground">{l6Audit?.usedInternalEngine ? t('brain.decisionDetail.used') : t('brain.decisionDetail.notUsed')}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('brain.decisionDetail.hybridExternal')}</span>
          <span className="font-semibold text-foreground">
            {resolveHybridEngineLabel(l6Audit, t)}
          </span>
        </div>
      </>)}
    </>
  );
}

function renderLayer7(ctx: LayerViewContext): React.ReactNode {
  const { t, selectedApprovalContext, l7Audit } = ctx;
  return (
    <>
      <div className="flex items-center justify-between">
        <span>{t('brain.decisionDetail.approvalStatus')}</span>
        <Badge variant="outline" className={`text-[10px] ${approvalStatusClass(selectedApprovalContext.status)}`}>
          {selectedApprovalContext.status || "pending"}
        </Badge>
      </div>
      {row(t('brain.decisionDetail.approvedBy'), selectedApprovalContext.approvedBy || "--")}
      {rowTruncated(t('brain.decisionDetail.reason'), selectedApprovalContext.reason || "--", "max-w-[14rem]")}
      {selectedApprovalContext.approvedAt && row(t('brain.decisionDetail.lastUpdate'), new Date(selectedApprovalContext.approvedAt).toLocaleString())}
      {row(t('brain.decisionDetail.hitlRequired'), hitlDisplayValue(l7Audit?.requiresHitl, t('app.yes'), t('app.no')))}
      {(l7Audit?.thresholdChecksPassed != null || l7Audit?.thresholdChecksFailed != null) && (
        <div className="mt-2 rounded-xl border bg-muted/30 p-3 text-xs">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">{t('brain.decisionDetail.thresholdChecks')}</p>
          <div className="mt-2 grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('brain.decisionDetail.passed')}</span>
              <span className="font-semibold text-emerald-700">{safeText(l7Audit?.thresholdChecksPassed, "0")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('brain.decisionDetail.failed')}</span>
              <span className="font-semibold text-rose-600">{safeText(l7Audit?.thresholdChecksFailed, "0")}</span>
            </div>
          </div>
        </div>
      )}
      {l7Audit?.biasDetected && (
        <div className="rounded-xl border bg-rose-50/60 p-3 text-xs">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-rose-600 font-semibold">{t('brain.decisionDetail.biasDetected')}</p>
          <p className="mt-1 text-muted-foreground">{t('brain.decisionDetail.biasDetectedDesc')}</p>
        </div>
      )}
      {l7Audit?.approvalId && (
        <div className="flex items-center justify-between">
          <span>{t('brain.decisionDetail.approvalId')}</span>
          <span className="font-mono font-semibold text-foreground text-[10px]">{safeText(l7Audit.approvalId)}</span>
        </div>
      )}
    </>
  );
}

function renderLayer8(ctx: LayerViewContext): React.ReactNode {
  const { t, actionExecutions, memoryEntries, l8Audit } = ctx;
  return (
    <>
      {row(t('brain.decisionDetail.executionJobs'), actionExecutions.length)}
      {row(t('brain.decisionDetail.memoryEntries'), memoryEntries?.length || 0)}
      {l8Audit && (
        <div className="mt-2 rounded-xl border bg-muted/30 p-3 text-xs">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">{t('brain.decisionDetail.memoryAndLearning')}</p>
          <div className="mt-2 grid gap-2">
            {l8Audit.summaryLength != null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('brain.decisionDetail.summaryLength')}</span>
                <span className="font-semibold text-foreground">{safeText(l8Audit.summaryLength)} chars</span>
              </div>
            )}
            {row(<span className="text-muted-foreground">{t('brain.decisionDetail.evidenceItems')}</span>, safeText(l8Audit.evidenceCount, "0"))}
            {row(<span className="text-muted-foreground">{t('brain.decisionDetail.learningExtracted')}</span>, safeText(l8Audit.learningExtracted, "No"))}
            {row(<span className="text-muted-foreground">{t('brain.decisionDetail.artifactsCreated')}</span>, safeText(l8Audit.artifactsCreated, "0"))}
            {row(<span className="text-muted-foreground">{t('brain.decisionDetail.tags')}</span>, safeText(l8Audit.tagsCount, "0"))}
            {(l8Audit.postApprovalAgentsExecuted != null || l8Audit.postApprovalAgentsSkipped != null) && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('brain.decisionDetail.postApprovalAgents')}</span>
                <span className="font-semibold text-foreground">
                  {`${safeText(l8Audit.postApprovalAgentsExecuted, "0")} executed · ${safeText(l8Audit.postApprovalAgentsSkipped, "0")} skipped`}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      {Array.isArray(l8Audit?.postApprovalAgentRuns) && l8Audit.postApprovalAgentRuns.length > 0 && (
        <div className="mt-2 rounded-xl border bg-muted/30 p-3 text-xs">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">{t('brain.decisionDetail.postApprovalAgentRuns')}</p>
          <div className="mt-2 grid gap-1">
            {l8Audit.postApprovalAgentRuns.slice(0, 8).map((run: Record<string, unknown>, idx: number) => (
              <div key={safeText(run?.plannedAgentId, safeText(run?.runtimeAgentId, String(idx)))} className="flex items-center justify-between gap-2">
                <span className="truncate text-foreground font-medium">{safeText(run?.agentName, safeText(run?.plannedAgentId, "Agent"))}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {safeText(run?.status, run?.success ? "completed" : "unknown")}
                  </Badge>
                  <span className="font-semibold text-foreground">
                    {(() => {
                      const raw = run?.confidence;
                      const num = raw == null ? null : Number(raw);
                      if (num == null || !Number.isFinite(num)) return "--";
                      const pct = num > 1 ? num : num * 100;
                      return `${Math.round(Math.max(0, Math.min(100, pct)))}%`;
                    })()}
                  </span>
                </div>
              </div>
            ))}
            {l8Audit.postApprovalAgentRuns.length > 8 && (
              <p className="text-[10px] text-muted-foreground mt-1">+{l8Audit.postApprovalAgentRuns.length - 8} more</p>
            )}
          </div>
        </div>
      )}
      {actionExecutions.length > 0 && (
        <div className="mt-2 rounded-xl border bg-muted/30 p-3 text-xs">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">{t('brain.decisionDetail.executionDetails')}</p>
          <div className="mt-2 grid gap-1">
            {actionExecutions.slice(0, 5).map((ex: Record<string, unknown>, idx: number) => (
              <div key={safeText(ex?.executionId, String(idx))} className="flex items-center justify-between">
                <span className="truncate text-foreground font-medium">{safeText(ex?.actionType, "Action")}</span>
                <Badge variant="outline" className="text-[10px]">{safeText(ex?.status, "pending")}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Dispatcher ──

export function renderLayerDetailContent(layerIndex: number, ctx: LayerViewContext): React.ReactNode {
  switch (layerIndex) {
    case 1: return renderLayer1(ctx);
    case 2: return renderLayer2(ctx);
    case 3: return renderLayer3(ctx);
    case 4: return renderLayer4(ctx);
    case 5: return renderLayer5(ctx);
    case 6: return renderLayer6(ctx);
    case 7: return renderLayer7(ctx);
    case 8: return renderLayer8(ctx);
    default: return null;
  }
}

// ── Agent Signals Panel (L5/L6) ──

export function renderAgentSignalsPanel(params: {
  t: TFunction;
  displayedAgentSignals: AgentSignalItem[];
}): React.ReactNode {
  const { t, displayedAgentSignals } = params;
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t('brain.decisionDetail.agentsUsed')}</p>
          <p className="text-sm text-muted-foreground">{t('brain.decisionDetail.agentsUsedDesc')}</p>
        </div>
        <Badge variant="outline" className="text-xs">{displayedAgentSignals.length}</Badge>
      </div>
      <div className="mt-3 space-y-2">
        {displayedAgentSignals.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('brain.decisionDetail.noAgentsRecorded')}</p>
        ) : (
          displayedAgentSignals.map((agent, idx) => (
            <div key={`${agent.name}-${idx}`} className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground truncate">{agent.name}</span>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>{agent.status}</span>
                <span className="font-semibold text-foreground">
                  {agent.score == null ? "--" : `${Math.round(agent.score * 100)}%`}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── PolicyOps Routing Card ──

export interface PolicyOpsCardParams {
  t: TFunction;
  policyEvaluation: Record<string, unknown> | undefined;
  policyVerdict: string | null;
  selectedPolicies: Array<Record<string, unknown>>;
  classificationLevel: string | null;
  classificationData: Record<string, unknown>;
  effectiveClassificationConstraints: Record<string, unknown>;
  routingOverride: { source?: string; forcedEngineKind?: string; forcedEngineId?: string; reason?: string } | undefined;
}

export function renderPolicyOpsContent(p: PolicyOpsCardParams): React.ReactNode {
  const { t, policyEvaluation, policyVerdict, selectedPolicies, classificationLevel, classificationData, effectiveClassificationConstraints, routingOverride } = p;
  const verdictStr = safeText(policyEvaluation?.verdict, safeText(policyVerdict)).toLowerCase();
  return (
    <>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('brain.decisionDetail.policySet')}</span>
        <span className="font-semibold text-foreground">{safeText(policyEvaluation?.policySet, "PolicyOps (built-in)")}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('brain.decisionDetail.verdict')}</span>
        <Badge variant="outline" className={`text-xs uppercase ${
          verdictStr === "allow"
            ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
            : "bg-rose-500/10 text-rose-600 border-rose-200"
        }`}>
          {safeText(policyEvaluation?.verdict, safeText(policyVerdict))}
        </Badge>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('brain.decisionDetail.policiesEvaluated')}</span>
        <span className="font-semibold text-foreground">{selectedPolicies.length}</span>
      </div>
      {policyEvaluation?.blockReason ? (
        <div className={`rounded-lg border p-2 text-xs ${
          verdictStr === "allow"
            ? "bg-emerald-50/50 text-emerald-700 border-emerald-200"
            : "bg-rose-50/50 text-rose-700 border-rose-200"
        }`}>
          {safeText(policyEvaluation.blockReason)}
        </div>
      ) : null}
      {selectedPolicies.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('brain.decisionDetail.noPolicyEvaluations')}</p>
      ) : (
        <div className="space-y-2 max-h-40 overflow-auto pr-1">
          {selectedPolicies.map((policy, idx: number) => (
              <div key={safeText(policy?.policyId, safeText(policy?.id, String(idx)))} className="rounded-lg border bg-muted/30 p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-foreground font-medium">
                    {safeText(policy?.policyName, safeText(policy?.name, safeText(policy?.title, "Policy")))}
                  </span>
                  <Badge variant="outline" className={`text-[10px] uppercase shrink-0 ${policyResultClass(policy?.result)}`}>
                    {safeText(policy?.result, safeText(policy?.decision, safeText(policy?.effect, "review")))}
                  </Badge>
                </div>
                <div className="mt-0.5 text-[10px] font-mono text-muted-foreground">{safeText(policy?.policyId)}</div>
                {policy?.reason ? <div className="mt-1 text-muted-foreground italic">{safeText(policy.reason)}</div> : null}
              </div>
            ))}
        </div>
      )}
      <div className="rounded-lg border bg-muted/30 p-3 text-xs">
        <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">{t('brain.decisionDetail.classificationConstraints')}</p>
        <div className="mt-2 grid gap-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('brain.decisionDetail.level')}</span>
            <span className="font-semibold text-foreground">
              {classificationLevel || t('brain.decisionDetail.notRecorded')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('brain.decisionDetail.externalModels')}</span>
            <span className="font-semibold text-foreground">
              {classificationData.externalLlmAllowed === false || effectiveClassificationConstraints.allowExternalModels === false
                ? t('brain.decisionDetail.blockedLabel')
                : t('brain.decisionDetail.allowedLabel')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('brain.decisionDetail.cloudProcessing')}</span>
            <span className="font-semibold text-foreground">
              {classificationData.cloudAllowed === false || effectiveClassificationConstraints.cloudAllowed === false || effectiveClassificationConstraints.allowCloudProcessing === false
                ? t('brain.decisionDetail.blockedLabel')
                : t('brain.decisionDetail.allowedLabel')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('brain.decisionDetail.hitlRequired')}</span>
            <span className="font-semibold text-foreground">
              {classificationData.hitlRequired === true || effectiveClassificationConstraints.hitlRequired === true || effectiveClassificationConstraints.requireHitl === true
                ? t('app.yes')
                : t('app.no')}
            </span>
          </div>
        </div>
      </div>
      {routingOverride ? (
        <div className="rounded-lg border bg-muted/30 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('brain.decisionDetail.routingSource')}</span>
            <span className="font-semibold text-foreground">{routingOverride.source}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('brain.decisionDetail.engineKind')}</span>
            <span className="font-semibold text-foreground">{routingOverride.forcedEngineKind || "default"}</span>
          </div>
          {routingOverride.forcedEngineId && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('brain.decisionDetail.engineId')}</span>
              <span className="font-semibold text-foreground">{routingOverride.forcedEngineId}</span>
            </div>
          )}
          {routingOverride.reason && (
            <div className="mt-1 text-muted-foreground">{routingOverride.reason}</div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t('brain.decisionDetail.noRoutingOverride')}</p>
      )}
    </>
  );
}

// ── Audit Trail Card ──

export interface AuditTrailCardParams {
  t: TFunction;
  auditTrail: Array<{ id?: string; eventType?: string; action?: string; timestamp?: string; createdAt?: string }>;
}

export function renderAuditTrailContent(p: AuditTrailCardParams): React.ReactNode {
  const { t, auditTrail } = p;
  if (auditTrail.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('brain.decisionDetail.noAuditEvents')}</p>;
  }
  return auditTrail.slice(0, 6).map((event, idx: number) => {
    let displayTs = "--";
    if (event.timestamp) {
      displayTs = new Date(event.timestamp).toLocaleString();
    } else if (event.createdAt) {
      displayTs = new Date(event.createdAt).toLocaleString();
    }
    return (
      <div key={`${event.id || idx}`} className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{safeText(event.eventType, safeText(event.action, "event"))}</span>
        <span className="text-foreground">{displayTs}</span>
      </div>
    );
  });
}

// ── Evidence & Artifacts Card ──

export interface ArtifactLedgerItem {
  key: string;
  artifactType: string;
  version: string;
  status: string;
  latestChangeSummary: string | null;
}

export interface KnowledgeEvidenceItem {
  key: string;
  title: string;
  snippet: string;
  source: string;
  score: number | null;
  category: string | null;
  accessLevel: string | null;
  uploadedAt: string | null;
}

export interface EvidenceCardParams {
  t: TFunction;
  artifactLedgerItems: ArtifactLedgerItem[];
  knowledgeEvidence: KnowledgeEvidenceItem[];
}

export function renderEvidenceAndArtifactsCard(p: EvidenceCardParams): React.ReactNode {
  const { t, artifactLedgerItems, knowledgeEvidence } = p;
  return (
    <Card className="mt-6 border-0 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{t('brain.decisionDetail.evidenceAndArtifacts')}</CardTitle>
        <CardDescription>{t('brain.decisionDetail.evidenceAndArtifactsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t('brain.decisionDetail.artifactLedger')}</p>
          {artifactLedgerItems.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">{t('brain.decisionDetail.noArtifactsLinked')}</p>
          ) : (
            <div className="space-y-2 mt-2">
              {artifactLedgerItems.map((artifact) => (
                <div key={artifact.key} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        {artifact.artifactType}
                      </p>
                      <p className="text-sm font-semibold">v{artifact.version}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{artifact.status}</Badge>
                  </div>
                  {artifact.latestChangeSummary ? (
                    <p className="mt-2 text-xs text-muted-foreground">{artifact.latestChangeSummary}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t('brain.decisionDetail.knowledgeBaseEvidence')}</p>
          {knowledgeEvidence.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">{t('brain.decisionDetail.noKnowledgeEvidence')}</p>
          ) : (
            <div className="space-y-2 mt-2">
              {knowledgeEvidence.map((item) => (
                <div key={item.key} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.title}</p>
                      <p className="text-sm text-foreground mt-1">{item.snippet}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{item.source}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                    {item.category && <span>{t('brain.decisionDetail.category')}: {item.category}</span>}
                    {item.accessLevel && <span>{t('brain.decisionDetail.access')}: {item.accessLevel}</span>}
                    {typeof item.score === "number" && <span>{t('brain.decisionDetail.score')}: {(item.score * 100).toFixed(0)}%</span>}
                    {item.uploadedAt && <span>{t('brain.decisionDetail.uploaded')}: {new Date(item.uploadedAt).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Timeline Card ──

export interface TimelineEntry {
  key: string;
  type: string;
  status: string;
  version: string;
  approvalId?: string;
  summary: string;
  timestamp?: string;
  groupKey: string;
  groupLabel?: string;
}

export interface TimelineCardParams {
  t: TFunction;
  spine: unknown;
  timelineEntries: TimelineEntry[];
  activeEntryKey: string | undefined;
  onSelectEntry: (entry: TimelineEntry) => void;
}

export function renderTimelineContent(p: TimelineCardParams): React.ReactNode {
  const { t, spine, timelineEntries, activeEntryKey, onSelectEntry } = p;

  if (!spine) {
    return null; // EmptyState handled by caller
  }
  if (timelineEntries.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('brain.decisionDetail.noStageEntries')}</p>;
  }
  return (
    <div className="space-y-4">
      {timelineEntries.map((entry, index: number) => {
        const prev = index > 0 ? timelineEntries[index - 1] : null;
        const showGroup = !prev?.groupKey || prev.groupKey !== entry.groupKey;
        return (
          <button
            key={entry.key}
            type="button"
            onClick={() => onSelectEntry(entry)}
            className="relative w-full text-left pl-8"
          >
            <div className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full bg-emerald-500" />
            {index < timelineEntries.length - 1 && (
              <div className="absolute left-[0.6rem] top-5 h-[calc(100%-1rem)] w-px bg-muted" />
            )}
            {showGroup && (
              <div className="mb-2">
                <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                  {entry.groupLabel || t('brain.decisionDetail.subDecisions')}
                </span>
              </div>
            )}
            <div className={`rounded-2xl border p-4 shadow-sm transition ${activeEntryKey === entry.key ? "border-emerald-400 bg-white" : "bg-white/80 hover:border-slate-300 hover:bg-white"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {entry.type.replaceAll("_", " ")}
                </p>
                <Badge variant="outline" className="text-[10px]">
                  {entry.status}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-base font-semibold text-foreground">{t('brain.decisionDetail.version')} {entry.version}</p>
                {entry.approvalId && (
                  <span className="text-xs text-muted-foreground">{t('brain.decisionDetail.approval')} {entry.approvalId}</span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{entry.summary}</p>
              <div className="mt-3 text-xs text-muted-foreground">
                {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : t('brain.decisionDetail.timestampPending')}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Spine Card Content ──

export interface SpineCardParams {
  t: TFunction;
  ledger: { conclusion?: string } | undefined;
  policyVerdict: string | null;
  contextScore: number | null;
  decision: { serviceId?: string; riskLevel?: string };
  getJourneyServiceLabel: (serviceId: string) => string;
}

export function renderSpineContent(p: SpineCardParams): React.ReactNode {
  const { t, ledger, policyVerdict, contextScore, decision, getJourneyServiceLabel } = p;
  return (
    <>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('brain.decisionDetail.journeyType')}</span>
        <span className="font-semibold text-foreground">DEMAND_DECISION</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('brain.decisionDetail.activeSubDecision')}</span>
        <span className="font-semibold text-foreground">{getJourneyServiceLabel(decision.serviceId || "corevia")}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('brain.decisionDetail.conclusion')}</span>
        <span className="font-semibold text-foreground">{ledger?.conclusion || "HOLD"}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('brain.decisionDetail.policyVerdict')}</span>
        <span className="font-semibold uppercase text-emerald-700">{safeText(policyVerdict)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('brain.decisionDetail.contextQuality')}</span>
        <span className="font-semibold text-foreground">{contextScore == null ? "--" : `${contextScore}%`}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('brain.decisionDetail.riskLevel')}</span>
        <span className="font-semibold capitalize text-amber-700">{decision.riskLevel || "--"}</span>
      </div>
    </>
  );
}

// ── Decision Card Content ──

export interface DecisionCardParams {
  t: TFunction;
  decision: { status?: string };
  ledger: { conclusion?: string } | undefined;
  advisory: Record<string, unknown> | undefined;
  advisoryConfidencePercent: number | null;
}

export function renderDecisionContent(p: DecisionCardParams): React.ReactNode {
  const { t, decision, ledger, advisory, advisoryConfidencePercent } = p;
  return (
    <>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('brain.decisionDetail.status')}</span>
        <Badge variant="outline" className="text-xs">{decision.status || "pending"}</Badge>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('brain.decisionDetail.conclusion')}</span>
        <span className="font-semibold text-foreground">{ledger?.conclusion || "HOLD"}</span>
      </div>
      <div className="text-sm">
        <p className="text-muted-foreground">{t('brain.decisionDetail.recommendation')}</p>
        <p className="mt-1 font-semibold text-foreground">
          {safeText(advisory?.recommendation, safeText((advisory?.decision as Record<string, unknown> | undefined)?.verdict, t('brain.decisionDetail.awaitingAdvisory')))}
        </p>
      </div>
      <div className="text-sm">
        <p className="text-muted-foreground">{t('brain.decisionDetail.summary')}</p>
        <p className="mt-1 text-foreground">
          {safeText(advisory?.summary, safeText(advisory?.executiveSummary, t('brain.decisionDetail.noSummary')))}
        </p>
      </div>
      {advisoryConfidencePercent == null ? null : (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('brain.decisionDetail.confidence')}</span>
          <span className="font-semibold text-foreground">{advisoryConfidencePercent}%</span>
        </div>
      )}
    </>
  );
}

// ── Artifacts Index Card Content ──

export function renderArtifactsContent(p: {
  t: TFunction;
  artifacts: Array<Record<string, unknown>>;
}): React.ReactNode {
  const { t, artifacts } = p;
  if (artifacts.length === 0) {
    return <p className="text-xs text-muted-foreground">{t('brain.decisionDetail.noArtifacts')}</p>;
  }
  return artifacts.map((artifact) => (
    <div key={safeText(artifact.artifactId)} className="flex items-center justify-between rounded-lg border px-3 py-2">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{safeText(artifact.artifactType).replaceAll("_", " ")}</p>
        <p className="text-sm font-semibold">v{safeText(artifact.currentVersion, safeText(artifact.latestVersion, "-"))}</p>
      </div>
      <Badge variant="outline" className="text-[10px]">{safeText(artifact.status, "pending")}</Badge>
    </div>
  ));
}
