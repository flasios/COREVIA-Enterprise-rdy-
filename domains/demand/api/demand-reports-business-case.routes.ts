import { Router } from "express";
import { createAuthMiddleware, getAuthenticatedOrganizationId } from "@interfaces/middleware/auth";
import { submitClarificationsSchema } from "@shared/schema";
import { type FinancialInputs, type UnifiedFinancialOutput, createReportVersionSafely } from "../application";
import { buildDemandDeps, type DemandAllDeps, type DemandStorageSlice } from "../application/buildDeps";
import { normalizeBusinessCaseFields, buildInsertBusinessCaseFromArtifact } from "../application/normalizers";
import { attachArtifactProvenance, buildArtifactMetaFromPayload } from "../application/artifactProvenance";
import {
  buildBlockedGenerationResponse,
  isAcceptFallbackOptIn,
  shouldBlockGeneration,
} from "./_blocked-generation-response";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";
import { TIMEOUTS } from "@interfaces/middleware/timeout";
import { validateBody } from "@interfaces/middleware/validateBody";
import { z } from "zod";
import { parseAiAnalysis, resolveParentApprovalState } from "../application/shared";
import {
  applyFinancialOverridesToComputedModel,
  extractPersistedDomainParametersFromInputs,
  extractPersistedFinancialAssumptionsFromInputs,
  sanitizeDroneStageCostOverrides,
  type DomainParameters,
  type FinancialAssumptions,
} from './demand-reports-business-case.financial-overrides';

type BusinessCaseDeps = Pick<DemandAllDeps, "reports" | "brain" | "versions" | "businessCase" | "financial" | "users">;

interface QualityReport {
  overallScore: number;
  passed: boolean;
  [key: string]: unknown;
}

function clampPercentScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizePersistedQualityReport(report: QualityReport | null): QualityReport | null {
  if (!report || typeof report !== "object") {
    return null;
  }

  const normalizedChecks = Array.isArray(report.checks)
    ? report.checks.map((check) => {
        if (!check || typeof check !== "object") {
          return check;
        }

        const typedCheck = check as Record<string, unknown>;
        const normalizedScore = clampPercentScore(typedCheck.score);

        return {
          ...typedCheck,
          ...(normalizedScore === null ? {} : { score: normalizedScore }),
        };
      })
    : report.checks;

  const normalizedOverallScore = clampPercentScore(report.overallScore);
  const normalizedAgentScore = clampPercentScore(report.agentScore);
  const normalizedAgentScores = Array.isArray(report.agentScores)
    ? report.agentScores.map((score) => {
        if (!score || typeof score !== "object") {
          return score;
        }

        const typedScore = score as Record<string, unknown>;
        const normalizedScore = clampPercentScore(typedScore.score);

        return {
          ...typedScore,
          ...(normalizedScore === null ? {} : { score: normalizedScore }),
        };
      })
    : report.agentScores;

  return {
    ...report,
    ...(normalizedOverallScore === null ? {} : { overallScore: normalizedOverallScore }),
    ...(normalizedAgentScore === null ? {} : { agentScore: normalizedAgentScore }),
    ...(normalizedChecks === undefined ? {} : { checks: normalizedChecks }),
    ...(normalizedAgentScores === undefined ? {} : { agentScores: normalizedAgentScores }),
  };
}

interface ResolvedBusinessCaseDraft {
  draft: Record<string, unknown> | null;
  source: "pipeline" | "stored_advisory" | "advisory_synthesis" | "missing";
  advisoryKeys: string[] | null;
  generatedArtifactKeys: string[] | null;
}

interface MaterializedBusinessCaseDraft {
  businessCase: Record<string, unknown>;
  persistedBusinessCase: Record<string, unknown> | null;
  qualityReport: QualityReport;
  version: Record<string, unknown> | null;
}

function isViableBusinessCaseDraft(draft: Record<string, unknown> | null | undefined): draft is Record<string, unknown> {
  if (!draft || typeof draft !== "object") {
    return false;
  }

  if (draft.generationFailed === true) {
    return false;
  }

  return true;
}

function isResponseClosed(res: import("express").Response): boolean {
  return res.headersSent || res.writableEnded || res.destroyed;
}

function resolveBusinessCaseBrainSoftTimeoutMs(): number {
  // Soft-timeout for the Brain pipeline before falling back to stored advisory.
  // Sovereign Engine A (RunPod single-worker) runs 5 BC sections sequentially at
  // ~60–180s each — raising default to 1000s so a real Engine A run can finish before
  // the wrapper short-circuits to a fallback. Override via COREVIA_BC_SOFT_TIMEOUT_MS.
  const configured = Number(process.env.COREVIA_BC_SOFT_TIMEOUT_MS ?? "1000000");
  const saneConfigured = Number.isFinite(configured) && configured > 0 ? configured : 1_000_000;
  return Math.max(10_000, Math.min(Math.floor(TIMEOUTS.BUSINESS_CASE), Math.floor(saneConfigured)));
}

function normalizeDemandClassificationForPipeline(value: unknown): "public" | "internal" | "confidential" | "sovereign" | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  switch (value.trim().toLowerCase()) {
    case "public":
      return "public";
    case "internal":
      return "internal";
    case "confidential":
      return "confidential";
    case "secret":
    case "top_secret":
    case "top-secret":
    case "sovereign":
      return "sovereign";
    default:
      return undefined;
  }
}

function getDemandClassificationFields(demandReport: Record<string, unknown>) {
  const aiAnalysis = (demandReport.aiAnalysis as Record<string, unknown> | null) || null;
  const normalizedClassification = normalizeDemandClassificationForPipeline(
    demandReport.dataClassification || aiAnalysis?.classificationLevel || aiAnalysis?.classification,
  );

  if (!normalizedClassification) {
    return {};
  }

  return {
    dataClassification: normalizedClassification,
    classificationLevel: normalizedClassification,
    accessLevel: normalizedClassification,
  };
}

function getGeneratedArtifacts(payload: Record<string, unknown> | null | undefined): {
  advisoryPayload: Record<string, unknown> | null;
  advisoryKeys: string[] | null;
  generatedArtifactKeys: string[] | null;
  generatedArtifacts: Record<string, unknown> | null;
} {
  if (!payload || typeof payload !== "object") {
    return {
      advisoryPayload: null,
      advisoryKeys: null,
      generatedArtifactKeys: null,
      generatedArtifacts: null,
    };
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

  const generatedArtifacts = (advisoryPayload?.generatedArtifacts as Record<string, unknown> | undefined) ||
    (advisoryPayload === payload ? (payload.generatedArtifacts as Record<string, unknown> | undefined) : undefined) ||
    null;

  return {
    advisoryPayload,
    advisoryKeys: advisoryPayload ? Object.keys(advisoryPayload) : null,
    generatedArtifactKeys: generatedArtifacts ? Object.keys(generatedArtifacts) : null,
    generatedArtifacts,
  };
}

function getBusinessCaseDraftFromPayload(payload: Record<string, unknown> | null | undefined): ResolvedBusinessCaseDraft {
  const { advisoryKeys, generatedArtifactKeys, generatedArtifacts } = getGeneratedArtifacts(payload);
  const rawDraft =
    (generatedArtifacts?.BUSINESS_CASE as Record<string, unknown> | undefined) ||
    (generatedArtifacts?.business_case as Record<string, unknown> | undefined) ||
    (generatedArtifacts?.businessCase as Record<string, unknown> | undefined) ||
    null;
  const draft = isViableBusinessCaseDraft(rawDraft) ? rawDraft : null;

  return {
    draft,
    source: draft ? "pipeline" : "missing",
    advisoryKeys,
    generatedArtifactKeys,
  };
}

function parseBudgetRangeEstimate(value: unknown): number {
  if (typeof value !== "string" || value.trim().length === 0) {
    return 0;
  }

  const text = value.trim();

  const unitMultiplier = (unit: string | undefined): number => {
    if (!unit) return 1;
    const u = unit.toLowerCase();
    if (u === 'b' || u === 'billion') return 1_000_000_000;
    if (u === 'm' || u === 'million') return 1_000_000;
    if (u === 'k' || u === 'thousand') return 1_000;
    return 1;
  };

  // Pattern: "AED 1,200,000 to 3,500,000" (comma-separated range)
  const commaRange = text.match(/(\d{1,3}(?:,\d{3})+(?:\.\d+)?)\s*(?:to|–|-|~)\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?)/i);
  if (commaRange) {
    const low = parseFloat(commaRange[1]!.replace(/,/g, ''));
    const high = parseFloat(commaRange[2]!.replace(/,/g, ''));
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return Math.round((low + high) / 2);
    }
  }

  // Pattern: "AED 1,200,000" (single comma-separated number)
  const commaSingle = text.match(/(\d{1,3}(?:,\d{3})+(?:\.\d+)?)/i);
  if (commaSingle) {
    const parsed = parseFloat(commaSingle[1]!.replace(/,/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }

  // Pattern: "1.2M-3.5M", "5 million", "1.2B" (number + unit suffix)
  const unitPattern = /(\d+(?:\.\d+)?)\s*(billion|million|thousand|[BMK])\b/gi;
  const matches = [...text.matchAll(unitPattern)];
  if (matches.length >= 2) {
    const low = parseFloat(matches[0]![1]!) * unitMultiplier(matches[0]![2]);
    const high = parseFloat(matches[1]![1]!) * unitMultiplier(matches[1]![2]);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return Math.round((low + high) / 2);
    }
  }
  if (matches.length === 1) {
    const val = parseFloat(matches[0]![1]!) * unitMultiplier(matches[0]![2]);
    if (Number.isFinite(val) && val > 0) {
      return Math.round(val);
    }
  }

  // Fallback: plain number range "1200000 - 3500000"
  const plainRange = text.match(/(\d+(?:\.\d+)?)\s*(?:to|–|-|~)\s*(\d+(?:\.\d+)?)/i);
  if (plainRange) {
    const low = parseFloat(plainRange[1]!);
    const high = parseFloat(plainRange[2]!);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return Math.round((low + high) / 2);
    }
  }

  // Fallback: single plain number
  const plainSingle = text.match(/(\d+(?:\.\d+)?)/i);
  if (plainSingle) {
    const val = parseFloat(plainSingle[1]!);
    if (Number.isFinite(val) && val > 0) {
      return Math.round(val);
    }
  }

  return 0;
}

function isAiSuggestedBudgetText(value: unknown): boolean {
  return typeof value === "string" && /ai suggested|no official budget approval|not officially approved|budget not specified/i.test(value);
}

function isAiSuggestedTimelineText(value: unknown): boolean {
  return typeof value === "string" && /ai suggested|not officially approved|timeline not specified/i.test(value);
}

function hasCompleteFinancialModel(model: unknown): boolean {
  if (!model || typeof model !== "object") {
    return false;
  }
  const record = model as Record<string, unknown>;
  return !!record.metrics && !!record.decision && !!record.governmentValue && !!record.fiveYearProjections;
}

function splitList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.replace(/^[\s•*-]+/, "").trim() : ""))
      .filter(Boolean);
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/[;\n•]+/)
    .map((item) => item.replace(/^[\s•*-]+/, "").trim())
    .filter(Boolean);
}

function buildGovernanceFramework(
  organizationName: string,
  department: string,
  implementationMonths: number,
): Record<string, unknown> {
  return {
    oversight: [
      `${organizationName} executive sponsor`,
      `${department} service owner`,
      `${organizationName} steering committee`,
      `${organizationName} enterprise architecture, security, and data governance review`,
    ],
    cadence: `Monthly governance checkpoint with formal stage-gate decisions across the ${implementationMonths}-month delivery horizon`,
    approvals: [
      'Business case and funding approval',
      'Architecture, security, and integration design approval',
      'Pilot / controlled rollout approval',
      'Operational readiness and benefits realization review',
    ],
  };
}

function hasMeaningfulDemandBusinessCaseContext(demandReport: Record<string, unknown>): boolean {
  const candidateValues = [
    demandReport.suggestedProjectName,
    demandReport.projectName,
    demandReport.title,
    demandReport.organizationName,
    demandReport.requestorName,
    demandReport.department,
    demandReport.businessObjective,
    demandReport.problemStatement,
    demandReport.currentChallenges,
    demandReport.expectedOutcomes,
    demandReport.successCriteria,
    demandReport.budgetRange,
    demandReport.timeframe,
    demandReport.stakeholders,
    demandReport.existingSystems,
    demandReport.integrationRequirements,
    demandReport.complianceRequirements,
    demandReport.riskFactors,
    demandReport.constraints,
  ];

  return candidateValues.some((value) => {
    if (Array.isArray(value)) {
      return value.some((item) => typeof item === 'string' && item.trim().length > 0);
    }
    return typeof value === 'string' && value.trim().length > 0;
  });
}

function buildImplementationPhasesFromDemandContext(params: {
  title: string;
  objective: string;
  department: string;
  implementationMonths: number;
  expectedOutcomes: string[];
  existingSystems: string[];
  integrationRequirements: string[];
  complianceRequirements: string[];
  constraints: string[];
}): Array<Record<string, unknown>> {
  const {
    title,
    objective,
    department,
    implementationMonths,
    expectedOutcomes,
    existingSystems,
    integrationRequirements,
    complianceRequirements,
    constraints,
  } = params;

  const planningDuration = Math.max(2, Math.round(implementationMonths / 4));
  const deliveryDuration = Math.max(3, Math.round(implementationMonths / 2));
  const transitionDuration = Math.max(2, implementationMonths - planningDuration - deliveryDuration);
  const keyOutcome = normalizeListText(expectedOutcomes[0] || `Deliver ${title}`);
  const secondaryOutcome = normalizeListText(expectedOutcomes[1] || `Improve ${department} execution quality`);
  const conciseObjective = objective.length > 120
    ? `delivery of ${title} with measurable operating outcomes`
    : normalizeListText(objective || `deliver ${title}`);
  const priorityIntegrations = integrationRequirements.slice(0, 3).map((item) => normalizeListText(item));
  const keyConstraints = constraints.slice(0, 2).map((item) => normalizeListText(item));
  const keyCompliance = complianceRequirements.slice(0, 2).map((item) => normalizeListText(item));

  return [
    {
      name: "Mobilize and design",
      durationMonths: planningDuration,
      duration: `${planningDuration} month${planningDuration === 1 ? "" : "s"}`,
      owner: "Project sponsor and enterprise architecture",
      description: `Confirm scope, architecture, and governance design for ${title}.`,
      tasks: [
        `Validate scope, operating model, and success measures for ${conciseObjective}`,
        `Confirm sovereign handling, security controls, and approval checkpoints for ${department}`,
        ...(existingSystems.length > 0
          ? [`Assess current-state dependencies across ${existingSystems.slice(0, 3).map((item) => normalizeListText(item)).join(", ")}`]
          : ["Assess current-state systems and operational dependencies"]),
        ...(keyConstraints.length > 0
          ? [`Resolve planning constraints: ${keyConstraints.join("; ")}`]
          : ["Finalize delivery assumptions, staffing, and sequencing"]),
      ],
      deliverables: [
        `${title} charter and scoped implementation plan`,
        "Architecture baseline and integration design pack",
        "Governance gate criteria, RAID log, and delivery mobilization pack",
      ],
    },
    {
      name: "Build, integrate, and validate",
      durationMonths: deliveryDuration,
      duration: `${deliveryDuration} month${deliveryDuration === 1 ? "" : "s"}`,
      owner: "Delivery lead and implementation team",
      description: `Deliver the core solution increments, integrations, and validation controls for ${title}.`,
      tasks: [
        `Implement prioritized capabilities to achieve ${keyOutcome}`,
        ...(priorityIntegrations.length > 0
          ? [`Deliver priority integrations for ${priorityIntegrations.join(", ")}`]
          : ["Build application, data, and workflow integrations"]),
        `Run iterative testing, quality reviews, and stakeholder demonstrations with ${department}`,
        ...(keyCompliance.length > 0
          ? [`Evidence compliance requirements: ${keyCompliance.join("; ")}`]
          : ["Complete security, privacy, and operational readiness validation"]),
      ],
      deliverables: [
        "Configured solution components and tested integrations",
        "Validation evidence pack, quality results, and updated operating procedures",
        `Working release candidate aligned to ${secondaryOutcome}`,
      ],
    },
    {
      name: "Transition and optimize",
      durationMonths: transitionDuration,
      duration: `${transitionDuration} month${transitionDuration === 1 ? "" : "s"}`,
      owner: "Service owner and business operations",
      description: `Prepare go-live, adoption, and benefits tracking for ${title}.`,
      tasks: [
        "Execute user readiness, training, and controlled go-live activities",
        `Stand up KPI, benefits realization, and governance reporting for ${department}`,
        "Complete hypercare support, lessons learned, and operating-model handover",
        `Confirm sustained adoption and measurable value against ${keyOutcome}`,
      ],
      deliverables: [
        "Go-live readiness and operational handover pack",
        "Training materials, adoption checklist, and support model",
        "Benefits tracking dashboard and post-implementation review",
      ],
    },
  ];
}

function safeString(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

interface DemandContext {
  title: string;
  organizationName: string;
  department: string;
  requestorName: string;
  objective: string;
  currentChallenges: string;
  expectedOutcomes: string[];
  successCriteria: string[];
  constraints: string[];
  integrationRequirements: string[];
  existingSystems: string[];
  complianceRequirements: string[];
  riskFactors: string[];
  budgetRange: string;
  budgetIsAiSuggested: boolean;
  budgetProvenance: string;
  timeframe: string;
  timeframeIsAiSuggested: boolean;
  timeframeProvenance: string;
  urgency: string;
}

function extractDemandContext(demandReport: Record<string, unknown>): DemandContext {
  const budgetRange = safeString(demandReport.budgetRange ?? demandReport.estimatedBudget, "");
  const timeframe = safeString(demandReport.timeframe ?? demandReport.estimatedTimeline, "");
  const budgetIsAiSuggested = isAiSuggestedBudgetText(budgetRange);
  const timeframeIsAiSuggested = isAiSuggestedTimelineText(timeframe);

  return {
    title: safeString(demandReport.suggestedProjectName ?? demandReport.projectName ?? demandReport.title, "Strategic initiative"),
    organizationName: safeString(demandReport.organizationName ?? demandReport.organization, "The requesting entity"),
    department: safeString(demandReport.department, "the requesting department"),
    requestorName: safeString(demandReport.requestorName, "the sponsoring team"),
    objective: safeString(demandReport.businessObjective ?? demandReport.problemStatement, "deliver a measurable operational improvement"),
    currentChallenges: safeString(demandReport.currentChallenges ?? demandReport.problemStatement, "Current operating conditions create delivery, coordination, and governance friction."),
    expectedOutcomes: splitList(demandReport.expectedOutcomes),
    successCriteria: splitList(demandReport.successCriteria),
    constraints: splitList(demandReport.constraints),
    integrationRequirements: splitList(demandReport.integrationRequirements),
    existingSystems: splitList(demandReport.existingSystems),
    complianceRequirements: splitList(demandReport.complianceRequirements),
    riskFactors: splitList(demandReport.riskFactors),
    budgetRange,
    budgetIsAiSuggested,
    budgetProvenance: budgetIsAiSuggested
      ? "AI suggested estimate; no official budget approval was provided by the requester."
      : budgetRange
        ? "Requester-provided budget range."
        : "Budget not provided; financial model must estimate from demand context.",
    timeframe,
    timeframeIsAiSuggested,
    timeframeProvenance: timeframeIsAiSuggested
      ? "AI suggested timeline; no official delivery date was provided by the requester."
      : timeframe
        ? "Requester-provided timeline."
        : "Timeline not provided; delivery model must estimate from demand context.",
    urgency: safeString(demandReport.urgency, "Medium"),
  };
}

function computeFinancials(budgetRange: string, urgency: string, demandReport?: Record<string, unknown>) {
  let totalCostEstimate = parseBudgetRangeEstimate(budgetRange);
  if (demandReport && totalCostEstimate <= 0) {
    totalCostEstimate = parseBudgetRangeEstimate(safeString(demandReport.budgetRange ?? demandReport.estimatedBudget, ""));
  }
  const totalBenefitEstimate = totalCostEstimate > 0 ? Math.round(totalCostEstimate * 1.45) : 0;
  const roiPercentage = totalCostEstimate > 0
    ? Math.round(((totalBenefitEstimate - totalCostEstimate) / totalCostEstimate) * 100)
    : 35;
  const urgencyLower = urgency.toLowerCase();
  let implementationMonths = 12;
  if (urgencyLower === "critical") {
    implementationMonths = 6;
  } else if (urgencyLower === "high") {
    implementationMonths = 9;
  }
  const monthlyBurn = totalCostEstimate > 0 ? Math.round(totalCostEstimate / Math.max(implementationMonths, 1)) : 0;
  const annualOperationalCost = totalCostEstimate > 0 ? Math.round(totalCostEstimate * 0.18) : 0;
  const annualMaintenanceCost = totalCostEstimate > 0 ? Math.round(totalCostEstimate * 0.12) : 0;
  return { totalCostEstimate, totalBenefitEstimate, roiPercentage, implementationMonths, monthlyBurn, annualOperationalCost, annualMaintenanceCost };
}

function summarizeNarrativeText(text: unknown, maxSentences: number): string {
  const normalized = safeString(text, '')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '';

  const sentences = normalized.match(/[^.!?]+[.!?]?/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean)
    ?? [normalized];

  return sentences
    .slice(0, maxSentences)
    .join(' ')
    .replace(/\s+([.!?])/g, '$1')
    .trim();
}

function normalizeGeneratedNarrative(text: string): string {
  return text
    .replace(/\.{2,}/g, '.')
    .replace(/\s+([.!?])/g, '$1')
    .replace(/([.!?])\s*([.!?])/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAutonomousMobilityInitiative(params: {
  title: string;
  objective: string;
  expectedOutcomes: string[];
  integrationRequirements?: string[];
  existingSystems?: string[];
}): boolean {
  const combined = [
    params.title,
    params.objective,
    ...(params.expectedOutcomes || []),
    ...((params.integrationRequirements || []).slice(0, 4)),
    ...((params.existingSystems || []).slice(0, 4)),
  ].join(' ').toLowerCase();

  return /(autonomous|driverless|self-driving|robo\s*-?taxi|autonomous vehicle|av fleet|smart mobility|mobility service|drone|uav|unmanned|last[- ]?mile delivery|first[- ]?mile|aerial delivery|skylink)/.test(combined);
}

function isDroneDeliveryInitiative(params: {
  title: string;
  objective: string;
  expectedOutcomes?: string[];
}): boolean {
  const combined = [params.title, params.objective, ...(params.expectedOutcomes || [])].join(' ').toLowerCase();
  return /(drone|uav|unmanned|last[- ]?mile delivery|first[- ]?mile|aerial delivery|skylink)/.test(combined);
}

function normalizeRiskLevelValue(value: unknown, fallback: 'low' | 'medium' | 'high' | 'critical' = 'medium'): 'low' | 'medium' | 'high' | 'critical' {
  const normalized = safeString(value, fallback).toLowerCase();
  if (normalized.includes('critical') || normalized.includes('severe')) return 'critical';
  if (normalized.includes('high')) return 'high';
  if (normalized.includes('med')) return 'medium';
  if (normalized.includes('low') || normalized.includes('minor')) return 'low';
  return fallback;
}

function startOfNextUtcMonth(baseDate: Date = new Date()): Date {
  return new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 1));
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function asFiniteNumber(value: unknown, fallback: number = 0): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function extractMeaningfulStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function inferImplementationMonthsFromResponse(response: Record<string, unknown>, totalInvestment: number): number {
  const implementationPhases = Array.isArray(response.implementationPhases)
    ? response.implementationPhases as Array<Record<string, unknown>>
    : [];
  const phasedDuration = implementationPhases.reduce(
    (sum, phase) => sum + asFiniteNumber(phase.durationMonths ?? phase.months ?? phase.duration, 0),
    0,
  );

  if (phasedDuration > 0) return Math.max(1, phasedDuration);

  const urgency = safeString(response.urgency, '').trim();
  const budgetRange = safeString(response.budgetRange, '').trim();
  const computedDuration = computeFinancials(budgetRange, urgency, response).implementationMonths;

  if (computedDuration > 0) return computedDuration;
  if (totalInvestment >= 100_000_000) return 24;
  if (totalInvestment >= 25_000_000) return 18;
  return 12;
}

function buildMilestoneSchedule(implementationMonths: number, baseDate: Date = new Date()): Array<{ name: string; date: string }> {
  const anchor = startOfNextUtcMonth(baseDate);
  const safeImplementationMonths = Math.max(3, implementationMonths);
  const designMonth = Math.max(2, Math.round(safeImplementationMonths / 3));
  const pilotMonth = Math.max(4, Math.round((safeImplementationMonths * 2) / 3));

  return [
    { name: 'Scope and sponsor alignment approved', date: toIsoDate(addUtcMonths(anchor, 0)) },
    { name: 'Architecture and implementation design finalized', date: toIsoDate(addUtcMonths(anchor, designMonth - 1)) },
    { name: 'Pilot or controlled rollout completed', date: toIsoDate(addUtcMonths(anchor, pilotMonth - 1)) },
    { name: 'Operational handover and benefits tracking activated', date: toIsoDate(addUtcMonths(anchor, safeImplementationMonths - 1)) },
  ];
}

function buildAlternativeSolutions(ctx: DemandContext, implementationMonths: number, totalCostEstimate: number): string[] {
  const isAutonomousMobility = isAutonomousMobilityInitiative({
    title: ctx.title,
    objective: ctx.objective,
    expectedOutcomes: ctx.expectedOutcomes,
    integrationRequirements: ctx.integrationRequirements,
    existingSystems: ctx.existingSystems,
  });

  const isDrone = isDroneDeliveryInitiative({ title: ctx.title, objective: ctx.objective, expectedOutcomes: ctx.expectedOutcomes });

  if (isDrone) {
    return [
      'Continue using traditional van-based delivery fleets with incremental route optimization, accepting higher per-delivery costs and limited same-hour delivery capability.',
      `Partner with an established drone logistics provider (e.g., Wing, Zipline, Matternet) for a managed-service pilot over ${Math.max(3, Math.round(implementationMonths / 2))} months before committing to an owned fleet build.`,
      `Procure drone-as-a-service capability with staged commercial checkpoints over ${implementationMonths} months, reducing capital exposure on fleet acquisition but increasing long-term vendor dependency and per-delivery cost.`,
    ];
  }

  if (isAutonomousMobility) {
    return [
      'Retain the conventional fleet model and expand service capacity through standard vehicle procurement, accepting slower innovation and limited autonomous readiness.',
      'Run a regulator-approved pilot using a tightly bounded service zone and partner-operated autonomous vehicles before committing to a broader owned platform build.',
      `Procure autonomous mobility capability as a managed service with staged commercial checkpoints over ${implementationMonths} months, reducing capital exposure but increasing long-term vendor dependency.`,
    ];
  }

  return [
    'Maintain the current operating model and continue using existing systems with incremental manual process improvements.',
    `Launch a limited pilot over ${Math.max(3, Math.round(implementationMonths / 2))} months to validate benefits before full deployment.`,
    totalCostEstimate > 0
      ? `Adopt a managed-service or partner-led delivery model to reduce the upfront investment burden of approximately ${totalCostEstimate.toLocaleString()} AED.`
      : 'Adopt a managed-service or partner-led delivery model to reduce capital exposure while preserving delivery momentum.',
  ];
}

function buildScopeDefinitionFromDemandContext(ctx: DemandContext, implementationMonths: number): { inScope: string[]; outOfScope: string[] } {
  const isAutonomousMobility = isAutonomousMobilityInitiative({
    title: ctx.title,
    objective: ctx.objective,
    expectedOutcomes: ctx.expectedOutcomes,
    integrationRequirements: ctx.integrationRequirements,
    existingSystems: ctx.existingSystems,
  });

  const objectiveSentence = (ctx.objective || '').split(/[.!?]/)[0]?.trim();
  const objectiveScope = objectiveSentence
    ? `Core delivery scope: ${objectiveSentence}.`
    : `Core delivery scope for ${ctx.title}.`;

  const inScope = [objectiveScope, ...ctx.integrationRequirements].filter(Boolean).slice(0, 5);
  const outOfScope = isAutonomousMobility
    ? [
        'Immediate citywide autonomous fleet rollout beyond the approved pilot and expansion gates.',
        'Replacement of all legacy fleet, dispatch, and booking platforms in the first delivery tranche.',
        `Commercial scale-up beyond the initial ${implementationMonths}-month program horizon without stage-gate approval.`,
      ]
    : [
        'Enterprise-wide process redesign outside the sponsoring department.',
        'Wholesale replacement of unrelated legacy platforms during the initial delivery phase.',
        'Downstream optimization initiatives not required for the approved business outcome.',
      ];

  return { inScope, outOfScope };
}

function buildExecutionNextSteps(
  title: string,
  department: string,
  milestones: Array<{ name: string; date: string }>,
): Array<{ action: string; owner: string; priority: string; timeline: string }> {
  const phaseOwner = department || 'Delivery Team';
  return [
    {
      action: `Approve ${title} mobilization scope, governance charter, and named benefit owners.`,
      owner: 'PMO',
      priority: 'High',
      timeline: milestones[0]?.date || 'TBD',
    },
    {
      action: 'Freeze pilot economics, integration sequencing, and safety/compliance evidence requirements before build spend is released.',
      owner: phaseOwner,
      priority: 'High',
      timeline: milestones[1]?.date || 'TBD',
    },
    {
      action: 'Prepare pilot readiness, operational handover, and monthly benefits realization reporting for executive review.',
      owner: phaseOwner,
      priority: 'Medium',
      timeline: milestones[2]?.date || milestones[3]?.date || 'TBD',
    },
  ];
}

function buildNarratives(
  ctx: DemandContext,
  summary: string,
  primaryOptionText: string,
  synthesizedFromDemandContextOnly: boolean,
  totalCostEstimate: number,
  totalBenefitEstimate: number,
  implementationMonths: number,
) {
  const { title, organizationName, department, requestorName, objective, currentChallenges, expectedOutcomes, successCriteria, constraints, integrationRequirements, existingSystems, complianceRequirements } = ctx;
  const projectProfile = buildProjectAwarenessProfile({
    title,
    department,
    objective,
    expectedOutcomes,
    integrationRequirements,
    complianceRequirements,
    existingSystems,
  });
  const conciseObjective = summarizeNarrativeText(objective, 1) || objective;
  const conciseChallenges = summarizeNarrativeText(currentChallenges, 3) || currentChallenges;

  const executiveApproachText = normalizeListText(summary).length > 0 && !/^approve\b/i.test(normalizeListText(summary))
    ? normalizeListText(summary)
    : primaryOptionText;
  const commercialClause = ctx.budgetIsAiSuggested && totalCostEstimate > 0 && totalBenefitEstimate > 0
    ? `The investment case uses an AI-suggested planning estimate of approximately ${totalCostEstimate.toLocaleString()} AED because the requester did not provide an officially approved budget; funding approval remains a mandatory governance checkpoint before commitment. `
    : totalCostEstimate > 0 && totalBenefitEstimate > 0
    ? `The investment case is sized around an upfront envelope of approximately ${totalCostEstimate.toLocaleString()} AED, with modeled benefits of approximately ${totalBenefitEstimate.toLocaleString()} AED and formal funding checkpoints before each release decision. `
    : "Financial assumptions should be confirmed during detailed planning. ";
  const timelineClause = ctx.timeframeIsAiSuggested
    ? "The delivery timeline is also AI-suggested and must be validated with delivery owners before it is treated as an official commitment. "
    : "";
  const provenanceClause = synthesizedFromDemandContextOnly
    ? "The current recommendation is grounded in the approved demand record and should be treated as a decision-ready baseline pending final market and vendor validation."
    : "The recommendation is grounded in the advisory evidence and normalized demand context, and is positioned for executive review, challenge, and controlled release approval.";
  const executiveSummary = normalizeGeneratedNarrative(`${organizationName} should progress ${title} as a ${projectProfile.initiativeLabel} for ${projectProfile.departmentLabel}. ${executiveApproachText} ${commercialClause}${timelineClause}The recommended delivery model is ${projectProfile.deliveryModel} over ${implementationMonths} months, governed through ${projectProfile.controlModel}. ${provenanceClause}`);

  const existingSystemsClause = existingSystems.length > 0
    ? "Existing systems in scope: " + existingSystems.join(", ") + ". "
    : "";
  const integrationClause = integrationRequirements.length > 0
    ? "Integration requirements include " + integrationRequirements.join(", ") + ". "
    : "";
  const complianceClause = complianceRequirements.length > 0
    ? "Compliance obligations include " + complianceRequirements.join(", ") + "."
    : "The solution must remain aligned with applicable governance and security controls.";
  const backgroundContext = normalizeGeneratedNarrative(`${title} originates from ${department} and is sponsored by ${requestorName || "the requesting team"}. The case is intended to deliver ${projectProfile.valueDriver}. Current operating pressures include ${conciseChallenges}. ${existingSystemsClause}${integrationClause}${complianceClause}`);

  const problemStatement = normalizeGeneratedNarrative(`${title} is needed because ${conciseChallenges || conciseObjective}. Without intervention, ${department} will continue to face avoidable delays, fragmented control, weaker evidence for decisions, and higher delivery risk across dependent systems and stakeholders. The business case therefore focuses on a commercially credible scope, disciplined governance, and measurable operating outcomes rather than a technology deployment alone.`);

  const outcomesClause = expectedOutcomes.length > 0 ? " Target outcomes: " + expectedOutcomes.join("; ") + "." : "";
  const criteriaClause = successCriteria.length > 0 ? " Success criteria: " + successCriteria.join("; ") + "." : "";
  const constraintsClause = constraints.length > 0 ? " Key constraints: " + constraints.join("; ") + "." : "";
  const businessRequirements = `The preferred business requirements for ${title} are to support ${conciseObjective}; establish accountable funding, delivery, and benefits owners; preserve required control and assurance standards; provide delivery controls that the ${department} team can operate sustainably; and define success through measurable business outcomes rather than activity completion.${outcomesClause}${criteriaClause}${constraintsClause}`;
  const solutionOverview = `${primaryOptionText} The recommended approach is to deliver ${title} in phased increments over ${implementationMonths} months, with each phase tied to a defined scope, decision gate, control evidence set, and benefits checkpoint. This turns the initiative into a reviewable investment case that can move directly into executive challenge, procurement planning, and controlled release approval.`;
  const proposedSolution = `${title} should be implemented through a ${projectProfile.deliveryModel} covering mobilization, controlled delivery, and operational handover. The program should prioritize architecture fit, integration readiness, user adoption, benefits ownership, and explicit executive checkpoints so the sponsoring team can justify the investment, manage downside risk actively, and track realized value after deployment.`;
  const conclusionSummary = `${organizationName} has a credible case to proceed with ${title}, provided the program confirms the commercial assumptions, secures named delivery and benefits ownership, and maintains ${projectProfile.controlModel} throughout implementation.`;

  return { executiveSummary, backgroundContext, problemStatement, businessRequirements, solutionOverview, proposedSolution, conclusionSummary };
}

function buildStrategicObjectives(expectedOutcomes: string[], objective: string, title: string, organizationName: string): string[] {
  if (expectedOutcomes.length > 0) return expectedOutcomes;
  return [objective || `Deliver ${title}`, `Improve service outcomes for ${organizationName}`, "Create measurable operational and governance value"];
}

function buildComplianceRequirements(complianceRequirements: string[]): string[] {
  if (complianceRequirements.length > 0) return complianceRequirements;
  return [
    "UAE data classification, sovereignty, and privacy obligations",
    "Enterprise architecture, cybersecurity, and access control approvals",
    "Procurement, records retention, and governance evidence requirements",
  ];
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

function normalizeListText(value: string): string {
  return value.replace(/^[\s•*-]+/, "").replace(/\s+/g, " ").trim();
}

function containsGenericInitiativePlaceholder(value: unknown): boolean {
  return typeof value === 'string' && /\bthis initiative\b/i.test(value);
}

function deriveOutcomeLabel(outcome: string, fallback: string): string {
  const cleanedOutcome = normalizeListText(outcome);
  const normalized = cleanedOutcome.toLowerCase();
  if (normalized.includes("digital twin")) return "Digital Twin Capability Coverage";
  if (normalized.includes("cross-agency") || normalized.includes("data flow") || normalized.includes("shared identifier") || normalized.includes("integration")) return "Cross-Agency Data Exchange";
  if (normalized.includes("dashboard") || normalized.includes("decision support")) return "Operational Dashboard Availability";
  if (normalized.includes("incident") || normalized.includes("emergency response")) return "Incident Response Coordination";
  if (normalized.includes("urban planning") || normalized.includes("city operations")) return "Trusted City Operations View";
  if (normalized.includes("time") || normalized.includes("turnaround") || normalized.includes("cycle")) return "Turnaround Time";
  if (normalized.includes("quality") || normalized.includes("audit") || normalized.includes("error") || normalized.includes("accuracy")) return "Quality and Compliance Rate";
  if (normalized.includes("adoption") || normalized.includes("usage") || normalized.includes("engagement")) return "Operational Adoption";
  if (normalized.includes("cost") || normalized.includes("saving") || normalized.includes("efficiency") || normalized.includes("productivity")) return "Productivity Gain";
  const compact = cleanedOutcome
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
  return compact ? toTitleCase(compact) : fallback;
}

function deriveMeasurementApproach(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes("adoption") || normalized.includes("usage")) return "Platform usage analytics and completion reporting";
  if (normalized.includes("quality") || normalized.includes("audit") || normalized.includes("compliance")) return "Quality assurance evidence pack and governance review";
  if (normalized.includes("time") || normalized.includes("turnaround") || normalized.includes("cycle")) return "Operational baseline comparison in monthly service reporting";
  return "Monthly program reporting with sponsor sign-off at stage gates";
}

function buildDemandSpecificKpis(
  title: string,
  department: string,
  expectedOutcomes: string[],
  implementationMonths: number,
  objective: string,
): Array<{ name: string; description: string; baseline: string; target: string }> {
  const isAutonomousMobility = isAutonomousMobilityInitiative({
    title,
    objective,
    expectedOutcomes,
  });

  const isDrone = isDroneDeliveryInitiative({ title, objective, expectedOutcomes });

  if (isDrone) {
    return [
      {
        name: 'Drone Fleet Operational Availability',
        description: `Tracks the percentage of the drone fleet available and mission-ready during planned operating windows for ${title}.`,
        baseline: 'No commercial drone fleet baseline',
        target: `Achieve at least 95% fleet operational availability within ${implementationMonths} months of approved start`,
      },
      {
        name: 'Daily Delivery Volume (Phased)',
        description: 'Measures total successful drone deliveries completed per day across the active fleet, phased to align with ramp-up schedule and pilot-gate reality.',
        baseline: 'No drone delivery baseline',
        target: `Phase 1 (month ${Math.max(3, Math.round(implementationMonths / 2))}): validate 10-20 pilot drones at roughly 600–1,200 deliveries/day with ≥ 95% success and a credible path toward sub-AED 35 unit cost. Phase 2 (month ${implementationMonths}+): expand to 100+ drones only after pilot-gate PASS confirms 150-200 deliveries per drone/day at scale, ≤ AED 35 cost per delivery, and strong contracted demand coverage.`,
      },
      {
        name: 'Delivery Success Rate',
        description: 'Percentage of attempted drone deliveries completed without incident, reroute, or manual intervention.',
        baseline: 'No delivery success rate baseline',
        target: `Sustain at least 98% delivery success rate by month ${Math.max(6, implementationMonths - 2)}`,
      },
      {
        name: 'GCAA Safety & Permit Compliance',
        description: 'Tracks GCAA permit status, safety-case evidence, airspace compliance, and regulatory readiness at each release gate.',
        baseline: 'GCAA Commercial Drone Operator Certificate not yet obtained',
        target: `Achieve full GCAA CDOC approval and maintain continuous compliance through month ${implementationMonths}`,
      },
    ];
  }

  if (isAutonomousMobility) {
    return [
      {
        name: 'Autonomous Service Availability',
        description: `Tracks the percentage of planned autonomous service hours delivered without safety-critical interruption across ${title}.`,
        baseline: 'No live autonomous commercial service baseline',
        target: `Achieve at least 95% autonomous service availability within ${implementationMonths} months of approved start`,
      },
      {
        name: 'Fleet Utilization',
        description: 'Measures active utilization of the approved autonomous fleet during controlled operating windows.',
        baseline: 'Current AV fleet utilization baseline to be established during pilot mobilization',
        target: `Sustain at least 78% controlled fleet utilization by month ${Math.max(6, implementationMonths - 2)}`,
      },
      {
        name: 'Commercial Trips Per Vehicle',
        description: 'Measures average completed revenue-generating trips per autonomous vehicle per operating day.',
        baseline: 'No autonomous commercial trip baseline',
        target: `Reach at least 22 completed trips per vehicle per day within ${implementationMonths} months of approved start`,
      },
      {
        name: 'Safety And Permit Readiness',
        description: 'Tracks permit status, safety-case evidence completion, and regulator sign-off readiness for each release gate.',
        baseline: 'Permit pack and safety case not yet approved',
        target: `Complete permit, safety, and operational readiness evidence before pilot release and maintain compliance through month ${implementationMonths}`,
      },
    ];
  }

  const fallbackOutcomes = expectedOutcomes.length > 0
    ? expectedOutcomes
    : [
        `Improve delivery performance for ${department}`,
        `Increase governance visibility for ${title}`,
        `Strengthen sustained adoption across the operating team`,
      ];

  while (fallbackOutcomes.length < 3) {
    fallbackOutcomes.push(`Deliver measurable operating value for ${title}`);
  }

  return fallbackOutcomes.slice(0, 3).map((outcome, index) => {
    const cleanedOutcome = normalizeListText(outcome);
    return {
      name: deriveOutcomeLabel(cleanedOutcome, `Outcome KPI ${index + 1}`),
      description: `Tracks whether ${title} delivers the intended result: ${cleanedOutcome}.`,
      baseline: "Current-state baseline to be confirmed during mobilization",
      target: `${cleanedOutcome} within ${implementationMonths} months of approved start`,
    };
  });
}

function buildSuccessCriteria(
  successCriteria: string[],
  implementationMonths: number,
): Array<{ criterion: string; target: string; measurement: string }> {
  if (successCriteria.length > 0) {
    return successCriteria.map((criterion) => ({
      criterion: normalizeListText(criterion),
      target: /\d/.test(criterion)
        ? normalizeListText(criterion)
        : `Evidenced in operational reporting by month ${implementationMonths}`,
      measurement: deriveMeasurementApproach(criterion),
    }));
  }
  return [{
    criterion: "Operational improvement realized and sustained",
    target: `Demonstrate measurable improvement against the approved baseline by month ${implementationMonths}`,
    measurement: "Monthly KPI tracking with executive review at each stage gate",
  }];
}

function deriveRiskName(text: string, fallback: string): string {
  const compact = normalizeListText(text)
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");
  if (!compact) return fallback;
  const title = toTitleCase(compact).replace(/\s+Risks$/i, " Risk");
  return /risk$/i.test(title) ? title : `${title} Risk`;
}

function buildDemandSpecificRisks(
  risks: Record<string, unknown>[],
  riskFactors: string[],
  title: string,
  department: string,
  integrationRequirements: string[],
  complianceRequirements: string[],
): Array<Record<string, unknown>> {
  const usefulRiskFactors = riskFactors.filter((risk) => {
    const normalized = normalizeListText(risk).toLowerCase();
    return normalized.length > 0
      && !normalized.includes("risk assessment completed")
      && !normalized.includes("see brain console");
  });

  const generatedRisks: Array<{
    name: string;
    severity: string;
    description: string;
    probability: string;
    impact: string;
    mitigation: string;
  }> = [
    ...risks.map((risk, index) => ({
      name: deriveRiskName(safeString(risk.name ?? risk.title ?? risk.description, `Risk ${index + 1}`), `Risk ${index + 1}`),
      severity: normalizeRiskLevelValue(risk.severity ?? risk.impact ?? risk.level),
      description: normalizeListText(safeString(risk.description ?? risk.impact ?? risk.name, "Potential delivery impact")),
      probability: normalizeRiskLevelValue(risk.probability ?? risk.likelihood),
      impact: normalizeRiskLevelValue(risk.impact ?? risk.severity ?? risk.description),
      mitigation: safeString(risk.mitigation, "Mitigation plan to be finalized during delivery planning."),
    })),
    ...usefulRiskFactors.slice(0, 3).map((risk, index) => ({
      name: deriveRiskName(risk, `Risk ${index + 1}`),
      severity: "medium",
      description: normalizeListText(risk),
      probability: "medium",
      impact: normalizeListText(risk),
      mitigation: "Address through phased delivery, named owners, and formal governance checkpoints.",
    })),
  ];

  const fallbackRisks: Array<{
    name: string;
    severity: string;
    description: string;
    probability: string;
    impact: string;
    mitigation: string;
  }> = [];
  if (integrationRequirements.length > 0) {
    fallbackRisks.push({
      name: 'Data Quality And Interoperability Risk',
      severity: 'high',
      description: `Data standards, integration readiness, and interoperability across participating services may slow ${title} delivery or reduce confidence in the shared operating picture.`,
      probability: 'medium',
      impact: 'high',
      mitigation: 'Agree data standards early, validate source-system readiness, and use staged integration acceptance criteria before scale-out.',
    });
  }
  fallbackRisks.push({
    name: 'Cross-Agency Governance Risk',
    severity: 'medium',
    description: `${department} depends on timely decisions, shared operating rules, and escalation support across multiple stakeholders to keep ${title} on plan.`,
    probability: 'medium',
    impact: 'high',
    mitigation: 'Establish a named steering forum, a RACI for participating agencies, and decision turnaround targets for each governance gate.',
  });
  fallbackRisks.push({
    name: 'Benefits Realization Risk',
    severity: 'medium',
    description: 'Operational value may not be realized on time if adoption, KPI ownership, and service-transition controls are not embedded during delivery.',
    probability: 'medium',
    impact: 'medium',
    mitigation: 'Assign benefit owners, baseline KPIs during mobilization, and review benefits monthly through pilot and post-go-live phases.',
  });
  if (complianceRequirements.length > 0) {
    fallbackRisks.push({
      name: 'Sovereign Compliance Assurance Risk',
      severity: 'high',
      description: `Control evidence for ${complianceRequirements.slice(0, 2).map((item) => normalizeListText(item)).join(' and ')} must remain complete throughout delivery and operational handover.`,
      probability: 'medium',
      impact: 'high',
      mitigation: 'Define required evidence packs by phase, align security and governance reviewers up front, and block progression when evidence is incomplete.',
    });
  }

  const existingNames = new Set(generatedRisks.map((risk) => safeString(risk.name, '').toLowerCase()));
  for (const risk of fallbackRisks) {
    const normalizedName = safeString(risk.name, '').toLowerCase();
    if (!existingNames.has(normalizedName)) {
      generatedRisks.push(risk);
      existingNames.add(normalizedName);
    }
  }

  return generatedRisks.slice(0, 6);
}

function summarizeDeliveryApproach(
  title: string,
  department: string,
  implementationMonths: number,
  optionText: string,
): string {
  const normalized = normalizeListText(optionText).toLowerCase();
  if (normalized.includes("pilot")) {
    return `${title} should begin with a controlled pilot in ${department}, then expand in governed increments once operational value and control evidence are proven.`;
  }
  if (normalized.includes("phase") || normalized.includes("controlled")) {
    return `${title} should be delivered in governed phases for ${department}, with scope control, approval gates, and measurable value checks across the ${implementationMonths}-month plan.`;
  }
  if (normalized.includes("full") || normalized.includes("complete")) {
    return `${title} should proceed as a full governed implementation for ${department}, using phased controls and executive checkpoints across the ${implementationMonths}-month horizon.`;
  }
  return `${title} should proceed as a sovereign implementation for ${department}, with staged approvals, measurable benefits, and clear delivery ownership.`;
}

function buildProjectAwarenessProfile(params: {
  title: string;
  department: string;
  objective: string;
  expectedOutcomes: string[];
  integrationRequirements: string[];
  complianceRequirements: string[];
  existingSystems: string[];
}) {
  const expectedOutcomes = Array.isArray(params.expectedOutcomes)
    ? params.expectedOutcomes.map((item) => safeString(item, "")).filter(Boolean)
    : [];
  const integrationRequirements = Array.isArray(params.integrationRequirements)
    ? params.integrationRequirements.map((item) => safeString(item, "")).filter(Boolean)
    : [];
  const complianceRequirements = Array.isArray(params.complianceRequirements)
    ? params.complianceRequirements.map((item) => safeString(item, "")).filter(Boolean)
    : [];
  const existingSystems = Array.isArray(params.existingSystems)
    ? params.existingSystems.map((item) => safeString(item, "")).filter(Boolean)
    : [];

  const combinedContext = [
    params.title,
    params.objective,
    expectedOutcomes.join(" "),
    integrationRequirements.join(" "),
    complianceRequirements.join(" "),
    existingSystems.join(" "),
  ].join(" ").toLowerCase();

  const isCitizenFacing = /(citizen|customer|service|portal|journey|case management|crm|omnichannel)/.test(combinedContext);
  const isDataHeavy = /(data|integration|interoperability|exchange|analytics|dashboard|360|single view)/.test(combinedContext);
  const isOperational = /(workflow|operations|scheduling|dispatch|resource|productivity|automation)/.test(combinedContext);
  const isRegulated = complianceRequirements.length > 0 || /(privacy|compliance|security|regulated|sovereign|government|uae|tdra|nesa)/.test(combinedContext);

  const initiativeLabel = isCitizenFacing
    ? "service transformation initiative"
    : isDataHeavy
      ? "data and integration modernization initiative"
      : isOperational
        ? "operational improvement initiative"
        : "strategic modernization initiative";

  const deliveryModel = integrationRequirements.length >= 4 || existingSystems.length >= 3
    ? "phased multi-workstream delivery"
    : "phased controlled delivery";

  const controlModel = isRegulated
    ? "formal architecture, security, and compliance stage gates"
    : "formal governance and benefits stage gates";

  const valueDriver = expectedOutcomes[0]
    ? normalizeListText(expectedOutcomes[0])
    : normalizeListText(params.objective || `deliver ${params.title} with measurable operating value`);

  return {
    initiativeLabel,
    deliveryModel,
    controlModel,
    valueDriver,
    departmentLabel: params.department || "the sponsoring department",
  };
}

function buildRecommendationActions(
  title: string,
  department: string,
  implementationMonths: number,
  integrationRequirements: string[] = [],
  complianceRequirements: string[] = [],
): string {
  const integrationAction = integrationRequirements.length > 0
    ? `Confirm solution, data, and integration sequencing for ${integrationRequirements.slice(0, 3).join(", ")} before committing the main delivery spend.`
    : "Complete the solution, data, and integration baseline before committing the main delivery spend.";
  const complianceAction = complianceRequirements.length > 0
    ? `Lock the delivery case to explicit control evidence for ${complianceRequirements.slice(0, 2).join(" and ")} before each funding gate.`
    : `Use staged funding and benefits checkpoints across the ${implementationMonths}-month plan so ${department} can validate value before scale-up.`;

  return [
    `Approve mobilization for ${title} with named business, architecture, and delivery owners.`,
    integrationAction,
    complianceAction,
  ].join("\n");
}

function buildImplementationCosts(totalCostEstimate: number): Record<string, number> {
  if (totalCostEstimate <= 0) return {};
  return {
    people: Math.round(totalCostEstimate * 0.35),
    technology: Math.round(totalCostEstimate * 0.3),
    integration: Math.round(totalCostEstimate * 0.2),
    changeManagement: Math.round(totalCostEstimate * 0.15),
  };
}

function buildOperationalCosts(annualOperationalCost: number, annualMaintenanceCost: number): Record<string, number> {
  if (annualOperationalCost <= 0) return {};
  return {
    annualRunCost: annualOperationalCost,
    maintenance: annualMaintenanceCost,
    support: Math.round(annualOperationalCost * 0.35),
  };
}

function parseAdvisoryArrayField(payload: Record<string, unknown>, field: string): Record<string, unknown>[] {
  return Array.isArray(payload[field]) ? (payload[field] as Record<string, unknown>[]) : [];
}

function buildKeyAssumptions(
  constraints: string[],
  existingSystems: string[],
  totalCostEstimate: number,
  complianceRequirements: string[],
  title: string = '',
  objective: string = '',
  domainParameters: Record<string, unknown> = {},
  budgetIsAiSuggested: boolean = false,
  timeframeIsAiSuggested: boolean = false,
): string[] {
  const constraintAssumptions = constraints.length > 0 ? constraints : ["Funding and governance sponsorship remain available across the delivery horizon"];
  const systemAssumptions = existingSystems.length > 0 ? [`Required existing systems remain available for integration: ${existingSystems.join(", ")}`] : [];
  const investmentAssumptions = budgetIsAiSuggested && totalCostEstimate > 0
    ? [`Budget is AI-suggested at approximately ${totalCostEstimate.toLocaleString()} AED; no official budget approval has been provided and funding must be confirmed before commitment.`]
    : budgetIsAiSuggested
      ? ["Budget is AI-suggested; no official budget approval has been provided and the financial model must be validated before commitment."]
      : totalCostEstimate > 0
    ? [`The approved stage-gated investment envelope of approximately ${totalCostEstimate.toLocaleString()} AED remains available for the phased delivery plan.`]
    : [];
  const timelineAssumptions = timeframeIsAiSuggested
    ? ["Timeline is AI-suggested; no official delivery date has been approved and the schedule must be confirmed during planning."]
    : [];
  const complianceAssumptions = complianceRequirements.length > 0
    ? [`Control evidence can be produced for ${complianceRequirements.slice(0, 2).join(" and ")} at each stage gate.`]
    : [];
  const isAutonomousMobility = isAutonomousMobilityInitiative({
    title,
    objective,
    expectedOutcomes: [],
    existingSystems,
  });
  const domainAssumptions: string[] = [];
  if (isAutonomousMobility) {
    const fleetSize = Number(domainParameters['Fleet Size'] || 0);
    const utilization = Number(domainParameters['Fleet Utilization Rate'] || 0);
    const trips = Number(domainParameters['Daily Trips per Vehicle'] || 0);
    const fare = Number(domainParameters['Taxi Fare Rate'] || 0);
    if (fleetSize > 0 && utilization > 0 && trips > 0 && fare > 0) {
      const utilizationPercent = utilization <= 1 ? utilization * 100 : utilization;
      domainAssumptions.push(`Pilot economics assume approximately ${fleetSize.toLocaleString()} vehicles operating at ${Math.round(utilizationPercent)}% utilization, ${trips.toLocaleString()} trips per vehicle per day, and AED ${fare.toFixed(1)} per km before later funding tranches are approved.`);
    }
    domainAssumptions.push('Commercial rollout remains limited to approved operating zones until safety validation, dispatch integration, and permit evidence are accepted at each stage gate.');
  }
  return [...investmentAssumptions, ...timelineAssumptions, ...domainAssumptions, ...constraintAssumptions, ...systemAssumptions, ...complianceAssumptions].slice(0, 5);
}

function buildFinancialBenefitDetail(totalCostEstimate: number, totalBenefitEstimate: number, implementationMonths: number, budgetIsAiSuggested: boolean = false) {
  const hasFinancials = totalCostEstimate > 0;
  return {
    description: budgetIsAiSuggested && hasFinancials
      ? `The investment case uses an AI-suggested planning estimate of approximately ${totalCostEstimate.toLocaleString()} AED because no official budget approval was provided. Modeled benefits of approximately ${totalBenefitEstimate.toLocaleString()} AED remain planning assumptions until funding is formally approved.`
      : hasFinancials
      ? `The investment case is anchored to an upfront envelope of approximately ${totalCostEstimate.toLocaleString()} AED, with a modeled benefit envelope of approximately ${totalBenefitEstimate.toLocaleString()} across the ${implementationMonths}-month delivery plan and subsequent operating horizon.`
      : "Financial assumptions to be refined during detailed planning.",
    type: hasFinancials ? "quantitative" : "qualitative",
    value: hasFinancials ? totalBenefitEstimate : undefined,
  };
}

function buildResourceRequirements(
  implementationMonths: number,
  monthlyBurn: number,
  totalCostEstimate: number,
  infrastructureRequirements: string[],
  isAutonomousMobility: boolean = false,
  isDrone: boolean = false,
) {
  const externalSupportCost = monthlyBurn > 0
    ? `Included within approximately ${Math.round(totalCostEstimate * (isAutonomousMobility ? 0.18 : 0.25)).toLocaleString()} budget allocation`
    : "To be refined during planning";
  return {
    internalTeam: {
      roles: isDrone
        ? ["Business sponsor", "Program director", "Drone operations lead", "Enterprise architect", "GCAA safety & compliance lead", "Delivery lead"]
        : isAutonomousMobility
          ? ["Business sponsor", "Program director", "Fleet operations lead", "Enterprise architect", "Safety and compliance lead", "Delivery lead"]
          : ["Business sponsor", "Project manager", "Business analyst", "Enterprise architect", "Delivery lead"],
      effort: `${implementationMonths}-month governed program core team`,
    },
    externalSupport: {
      expertise: isDrone
        ? ["Drone platform integration & flight management", "GCAA safety case validation", "Vertiport & landing zone design", "Change management"]
        : isAutonomousMobility
          ? ["AV platform integration", "Safety case validation", "Depot and charging design", "Change management"]
          : ["System integration", "Data migration", "Change management"],
      estimatedCost: externalSupportCost,
    },
    infrastructure: infrastructureRequirements,
  };
}

function buildDraftStakeholderAnalysis(
  requestorName: string,
  department: string,
  organizationName: string,
  title: string,
  integrationRequirements: string[] = [],
  complianceRequirements: string[] = [],
) {
  const sponsorStakeholder = requestorName || "Business sponsor";
  const teamStakeholder = department || "Delivery team";
  const combinedText = [title, ...integrationRequirements].join(' ').toLowerCase();
  const isAutonomousMobility = isAutonomousMobilityInitiative({
    title,
    objective: title,
    expectedOutcomes: [],
    integrationRequirements,
  });
  const isDroneProject = /(drone|uav|unmanned|aerial delivery|last[- ]?mile delivery|first[- ]?mile|skylink)/.test(combinedText);

  if (isDroneProject) {
    return [
      { name: sponsorStakeholder, role: 'Executive sponsor', interest: 'high', influence: 'high', engagementStrategy: 'Weekly steering committee briefings with decision authority on scope, budget, and go/no-go gates' },
      { name: organizationName, role: 'Operating authority', interest: 'high', influence: 'high', engagementStrategy: 'Monthly board-level progress reviews; owns funding release and strategic direction' },
      { name: 'General Civil Aviation Authority (GCAA)', role: 'Aviation regulator', interest: 'high', influence: 'high', engagementStrategy: 'Early engagement on BVLOS waiver applications; joint safety-case workshops; quarterly compliance reviews' },
      { name: 'Roads & Transport Authority (RTA)', role: 'Transport regulator', interest: 'high', influence: 'high', engagementStrategy: 'Coordinate airspace corridor approvals and ground-side logistics integration; monthly liaison meetings' },
      { name: `${organizationName} Drone Operations`, role: 'Fleet operator', interest: 'high', influence: 'high', engagementStrategy: 'Daily ops stand-ups during pilot; owns dispatch, maintenance scheduling, and real-time fleet monitoring' },
      { name: `${organizationName} Safety & Compliance`, role: 'Safety authority', interest: 'high', influence: 'high', engagementStrategy: `Leads evidence production for ${complianceRequirements.slice(0, 2).join(' and ') || 'airworthiness, BVLOS, and operational safety'}; reviews every test flight report` },
      { name: 'Dubai Municipality', role: 'Land-use & environmental authority', interest: 'medium', influence: 'high', engagementStrategy: 'Approve vertiport/landing zone permits; coordinate noise and environmental impact assessments' },
      { name: teamStakeholder, role: 'Programme delivery', interest: 'high', influence: 'medium', engagementStrategy: 'Owns day-to-day delivery, vendor coordination, and sprint-level execution' },
      { name: `${organizationName} Digital & Customer Experience`, role: 'Channel owner', interest: 'high', influence: 'medium', engagementStrategy: 'Integrate booking, tracking, and payment flows into customer-facing apps; UAT sign-off required before each launch phase' },
      { name: 'Insurance & Risk Partners', role: 'Risk transfer partner', interest: 'medium', influence: 'high', engagementStrategy: 'Negotiate aviation liability coverage and operational risk frameworks; formal proposals due before commercial launch' },
      { name: 'Drone OEM / Technology Vendor', role: 'Technology supplier', interest: 'high', influence: 'medium', engagementStrategy: 'Contractual SLAs on fleet delivery, firmware updates, and maintenance support; bi-weekly technical reviews' },
      { name: 'End Customers / Recipients', role: 'Service beneficiary', interest: 'high', influence: 'low', engagementStrategy: 'Pilot feedback surveys, NPS tracking, and focus groups to validate service proposition before scale-out' },
      { name: 'Local Community & Residents', role: 'Affected public', interest: 'medium', influence: 'low', engagementStrategy: 'Public awareness campaigns on drone safety and noise; community feedback channels; comply with noise ordinances' },
    ];
  }

  if (isAutonomousMobility) {
    return [
      { name: sponsorStakeholder, role: 'Executive sponsor', interest: 'high', influence: 'high', engagementStrategy: 'Weekly steering committee briefings with decision authority on scope, budget, and go/no-go gates' },
      { name: organizationName, role: 'Operating authority', interest: 'high', influence: 'high', engagementStrategy: 'Monthly board-level progress reviews; owns funding release and strategic direction' },
      { name: 'RTA', role: 'Regulatory authority', interest: 'high', influence: 'high', engagementStrategy: 'Joint safety-case workshops; quarterly compliance reviews; controls permits and operational approvals' },
      { name: `${organizationName} Fleet Operations`, role: 'Service operator', interest: 'high', influence: 'high', engagementStrategy: 'Daily ops stand-ups during pilot; owns dispatch integration and day-2 fleet performance' },
      { name: `${organizationName} Safety & Compliance`, role: 'Control authority', interest: 'high', influence: 'high', engagementStrategy: `Leads evidence production for ${complianceRequirements.slice(0, 2).join(' and ') || 'safety and compliance stage gates'}; reviews every test report` },
      { name: teamStakeholder, role: 'Programme delivery', interest: 'high', influence: 'medium', engagementStrategy: 'Owns day-to-day delivery, vendor coordination, and sprint-level execution' },
      { name: `${organizationName} Digital Channels`, role: 'Customer channel owner', interest: 'high', influence: 'medium', engagementStrategy: 'Integrate booking, payments, and customer communications; UAT sign-off before each launch phase' },
      { name: 'Insurance / Risk Partners', role: 'Risk transfer partner', interest: 'medium', influence: 'high', engagementStrategy: 'Negotiate liability coverage and operating guardrails; formal proposals due before commercial launch' },
      { name: 'Vehicle OEM / Technology Vendor', role: 'Technology supplier', interest: 'high', influence: 'medium', engagementStrategy: 'Contractual SLAs on vehicle delivery, software updates, and maintenance; bi-weekly technical reviews' },
      { name: 'End Customers / Passengers', role: 'Service beneficiary', interest: 'high', influence: 'low', engagementStrategy: 'Pilot feedback surveys, NPS tracking, and focus groups to validate service before scale-out' },
    ];
  }

  return [
    { name: sponsorStakeholder, role: 'Sponsor', interest: 'high', influence: 'high', engagementStrategy: `Owns the strategic case for ${title}; weekly steering updates with escalation authority` },
    { name: teamStakeholder, role: 'Primary beneficiary', interest: 'high', influence: 'medium', engagementStrategy: 'Sprint-level involvement in requirements validation, UAT, and adoption readiness' },
    { name: organizationName, role: 'Executive oversight', interest: 'high', influence: 'high', engagementStrategy: 'Monthly executive reviews; owns funding governance and strategic alignment sign-off' },
    { name: `${organizationName} Architecture & Security`, role: 'Control authority', interest: 'high', influence: 'medium', engagementStrategy: 'Approves architecture, cybersecurity, and integration control points; review gates at each phase' },
    { name: `${organizationName} Operations`, role: 'Service owner', interest: 'high', influence: 'medium', engagementStrategy: 'Validates operational readiness, adoption metrics, and measurable business value after go-live' },
    { name: 'Technology / Integration Vendor', role: 'Delivery partner', interest: 'high', influence: 'medium', engagementStrategy: `Contractual SLAs on ${integrationRequirements.slice(0, 2).join(' and ') || 'platform delivery and support'}; bi-weekly progress reviews` },
    { name: 'End Users', role: 'Service beneficiary', interest: 'high', influence: 'low', engagementStrategy: 'Pilot feedback, adoption surveys, and change management communications' },
  ];
}

function buildCommercialPositionRecommendation(
  title: string,
  department: string,
  implementationMonths: number,
  integrationRequirements: string[],
  complianceRequirements: string[],
  metrics: Record<string, number>,
  decisionVerdict: string,
  publicVerdict: string,
  publicValueScore: number | null,
): Record<string, unknown> {
  const requiresStrategicMandate = decisionVerdict === 'DO_NOT_INVEST' || decisionVerdict === 'CAUTION';
  const strategicValue = typeof publicValueScore === 'number' ? publicValueScore : 0;
  const roi = Number(metrics.roi || 0);
  const npv = Number(metrics.npv || 0);
  const paybackMonths = metrics.paybackMonths;
  const paybackText = paybackMonths != null && Number.isFinite(paybackMonths)
    ? `${Math.round(paybackMonths)} months`
    : 'no payback within the 5-year horizon';
  const hasPositiveCommercialCase = (decisionVerdict === 'INVEST' || decisionVerdict === 'STRONG_INVEST') && roi > 0 && npv >= 0;
  const hasStrongPublicValue = strategicValue >= 75 || publicVerdict === 'HIGH_VALUE' || publicVerdict === 'RECOMMENDED';
  const hasModeratePublicValue = strategicValue >= 60 || publicVerdict === 'MODERATE_VALUE';

  const commercialCase = hasPositiveCommercialCase
    ? `Commercial case: ${title} is investable on current assumptions, with ROI of ${roi.toFixed(1)}%, NPV of ${fmtAED(npv)}, and payback in ${paybackText}.`
    : `Commercial case: ${title} does not yet clear a conventional investment hurdle, with ROI of ${roi.toFixed(1)}%, NPV of ${fmtAED(npv)}, and ${paybackText}. Approval should therefore stay tied to scope discipline, phased funding, and measurable benefit realization.`;

  const publicValueCase = hasStrongPublicValue
    ? `Public-value case: ${title} creates strong strategic value for ${department}, with a government-value score of ${strategicValue}/100 and material justification to proceed under controlled governance.`
    : hasModeratePublicValue
      ? `Public-value case: ${title} has credible strategic value for ${department}, but that value should be proven through stage gates, operating evidence, and explicit executive ownership before wider scale-out.`
      : `Public-value case: ${title} currently shows limited strategic value beyond its delivery scope, so any continuation should be justified by concrete service outcomes rather than narrative optimism.`;

  if (requiresStrategicMandate && strategicValue >= 60) {
    return {
      primaryRecommendation: `Approve ${title} only as a stage-gated strategic pilot, not as a conventional commercial investment.`,
      summary: `Proceed only under a strategic-public-value mandate with explicit commercial controls.`,
      commercialCase,
      publicValueCase,
      keyFindings: [
        `5-year lifecycle economics remain below target, with ROI of ${roi.toFixed(1)}% and NPV of ${fmtAED(npv)}.`,
        `${department} can still justify a limited pilot when public-value evidence and risk controls are stronger than the standalone commercial case.`,
        `Scale-up should remain contingent on integration proof, operating readiness, and named benefits ownership.`,
      ],
      nextSteps: [
        `Release funding in tranches across the ${implementationMonths}-month plan only after evidence is produced for ${integrationRequirements.slice(0, 2).join(' and ') || 'the critical integrations'} and named benefit owners confirm pilot economics.`,
        `Require explicit executive risk acceptance for ${complianceRequirements.slice(0, 2).join(' and ') || 'regulatory, security, and operational controls'} before authorizing scale beyond the pilot envelope for ${department}.`,
        `Define exit criteria for the pilot if commercial performance, safety evidence, or public-value outcomes do not track to plan.`,
      ],
    };
  }

  return {
    primaryRecommendation: buildRecommendationActions(title, department, implementationMonths, integrationRequirements, complianceRequirements),
    summary: hasPositiveCommercialCase
      ? `Proceed with disciplined execution because the commercial and strategic cases are directionally supportive.`
      : `Proceed with caution and only through measurable stage gates because the strategic case is stronger than the current commercial return profile.`,
    commercialCase,
    publicValueCase,
    keyFindings: [
      `The current model assumes ${fmtAED(metrics.totalCosts || 0)} of 5-year lifecycle cost against ${fmtAED(metrics.totalBenefits || 0)} of modeled benefit.`,
      hasPositiveCommercialCase
        ? `The commercial case is viable on current assumptions, but benefit ownership and delivery controls still matter.`
        : `The commercial case is not yet self-proving, so management should treat upside assumptions as targets to earn rather than benefits to assume.`,
      hasStrongPublicValue || hasModeratePublicValue
        ? `${department} retains a public-value rationale that can support phased execution if governance remains strong.`
        : `Strategic value remains modest, so continuation should depend on concrete operating outcomes.`,
    ],
    nextSteps: [
      `Confirm the baseline for ${integrationRequirements.slice(0, 2).join(' and ') || 'critical integrations'} before releasing build funding.`,
      `Assign named business owners for each major benefit line and track them monthly through the ${implementationMonths}-month delivery plan.`,
      `Review ${complianceRequirements.slice(0, 2).join(' and ') || 'regulatory and control requirements'} at each phase gate before scaling scope.`,
    ],
  };
}

function buildDraftDepartmentImpact(expectedOutcomes: string[], constraints: string[]) {
  const positiveImpact = expectedOutcomes.length > 0 ? expectedOutcomes : ["Improved service quality", "Faster operational handling"];
  const negativeImpact = constraints.length > 0 ? constraints.slice(0, 2) : ["Requires delivery capacity and disciplined change management"];
  return {
    positive: positiveImpact,
    negative: negativeImpact,
    mitigation: ["Phase rollout to reduce disruption", "Use steering checkpoints to manage scope and risk"],
  };
}

function buildBusinessCaseDraftFromAdvisoryContext(
  demandReport: Record<string, unknown>,
  advisoryPayload: Record<string, unknown>,
): Record<string, unknown> | null {
  const ctx = extractDemandContext(demandReport);
  const { title, organizationName, department, requestorName, objective, expectedOutcomes, successCriteria, constraints, integrationRequirements, existingSystems, complianceRequirements, riskFactors } = ctx;

  const options = parseAdvisoryArrayField(advisoryPayload, "options");
  const risks = parseAdvisoryArrayField(advisoryPayload, "risks");
  const summary = safeString(advisoryPayload.summary, "");
  const primaryOption = options[0];
  const alternativeOptions = options.slice(1, 4);
  const synthesizedFromDemandContextOnly = !summary && options.length === 0 && risks.length === 0;

  if (synthesizedFromDemandContextOnly && !hasMeaningfulDemandBusinessCaseContext(demandReport)) {
    return null;
  }

  const fin = computeFinancials(ctx.budgetRange, ctx.urgency, demandReport);
  const { totalCostEstimate, totalBenefitEstimate, roiPercentage, implementationMonths, monthlyBurn, annualOperationalCost, annualMaintenanceCost } = fin;

  const strategicObjectives = buildStrategicObjectives(expectedOutcomes, objective, title, organizationName);
  const normalizedComplianceRequirements = buildComplianceRequirements(complianceRequirements);
  const normalizedSuccessCriteria = buildSuccessCriteria(successCriteria, implementationMonths);
  const kpis = buildDemandSpecificKpis(title, department, expectedOutcomes, implementationMonths, objective);

  const dependencyItems = [
    ...existingSystems.map((system) => ({ dependency: system, owner: department || organizationName })),
    ...integrationRequirements.map((requirement) => ({ dependency: requirement, owner: "Enterprise integration team" })),
  ].slice(0, 6);

  const expectedDeliverables = [
    `${title} business case baseline and governance pack`,
    `${title} solution blueprint and implementation plan`,
    "Delivery roadmap with phased milestones and ownership", 
    "KPI and benefits realization tracking model",
  ];

  const milestones = buildMilestoneSchedule(implementationMonths);
  const implementationPhases = buildImplementationPhasesFromDemandContext({
    title,
    objective,
    department,
    implementationMonths,
    expectedOutcomes,
    existingSystems,
    integrationRequirements,
    complianceRequirements,
    constraints,
  });

  const implementationCosts = buildImplementationCosts(totalCostEstimate);
  const operationalCosts = buildOperationalCosts(annualOperationalCost, annualMaintenanceCost);

  const operationalBenefits = expectedOutcomes.length > 0 ? expectedOutcomes : ["Faster service delivery", "Improved decision visibility"];
  const benefitsBreakdown = {
    operational: operationalBenefits,
    strategic: [
      `Strengthens ${organizationName} execution discipline for ${title}`,
      "Improves governance evidence for future investment decisions",
    ],
    compliance: normalizedComplianceRequirements,
  };

  const infrastructureRequirements = integrationRequirements.length > 0 ? integrationRequirements : ["Application hosting", "Integration environment", "Monitoring and audit tooling"];
  const isAutonomousMobility = isAutonomousMobilityInitiative({
    title,
    objective,
    expectedOutcomes,
    integrationRequirements,
    existingSystems,
  });
  const isDroneContext = isDroneDeliveryInitiative({ title, objective, expectedOutcomes });
  const resourceRequirements = buildResourceRequirements(implementationMonths, monthlyBurn, totalCostEstimate, infrastructureRequirements, isAutonomousMobility, isDroneContext);

  const governanceFramework = buildGovernanceFramework(organizationName, department, implementationMonths);

  const sponsorAudience = requestorName || "Business sponsor";
  const teamAudience = department || "Delivery team";

  const communicationPlan = {
    audiences: [sponsorAudience, teamAudience, organizationName],
    cadence: "Weekly delivery update and monthly executive review",
    channels: ["Steering committee deck", "Program status report", "Risk and issue log"],
  };

  const departmentImpact = buildDraftDepartmentImpact(expectedOutcomes, constraints);
  const keyAssumptions = buildKeyAssumptions(
    constraints,
    existingSystems,
    totalCostEstimate,
    normalizedComplianceRequirements,
    title,
    objective,
    {},
    ctx.budgetIsAiSuggested,
    ctx.timeframeIsAiSuggested,
  );

  const outcomeSlice = expectedOutcomes.length > 0 ? expectedOutcomes.slice(0, 2) : [];
  const organizationalBenefits = [
    `Improved execution visibility for ${department}`,
    "Better governance control and auditability",
    ...outcomeSlice,
  ];

  const nextSteps = buildExecutionNextSteps(title, department, milestones);

  const synthesizedRisks = buildDemandSpecificRisks(
    risks,
    riskFactors,
    title,
    department,
    integrationRequirements,
    normalizedComplianceRequirements,
  );

  const rawPrimaryOptionText = safeString(
    primaryOption?.description ?? primaryOption?.name ?? (summary || undefined),
    `Implement ${title} in a controlled sovereign delivery model.`,
  );
  const primaryOptionText = summarizeDeliveryApproach(title, department, implementationMonths, rawPrimaryOptionText);

  const narratives = buildNarratives(
    ctx,
    summary,
    primaryOptionText,
    synthesizedFromDemandContextOnly,
    totalCostEstimate,
    totalBenefitEstimate,
    implementationMonths,
  );
  const { executiveSummary, backgroundContext, problemStatement, businessRequirements, solutionOverview, proposedSolution, conclusionSummary } = narratives;

  const scopeObjective = objective || `Deliver ${title}`;
  const recommendations = buildRecommendationActions(title, department, implementationMonths, integrationRequirements, normalizedComplianceRequirements);
  const smartMeasurable = expectedOutcomes[0] || `Achieve at least ${roiPercentage}% modeled ROI with tracked operational KPIs.`;

  const synthesisSource = synthesizedFromDemandContextOnly ? "demand_context" : "advisory_package";
  const financialBenefit = buildFinancialBenefitDetail(totalCostEstimate, totalBenefitEstimate, implementationMonths, ctx.budgetIsAiSuggested);
  const totalCostOrUndefined = totalCostEstimate || undefined;
  const totalBenefitOrUndefined = totalBenefitEstimate || undefined;
  const stakeholderAnalysis = buildDraftStakeholderAnalysis(requestorName, department, organizationName, title, integrationRequirements, normalizedComplianceRequirements);

  return {
    artifactType: "BUSINESS_CASE",
    projectTitle: title,
    executiveSummary,
    backgroundContext,
    problemStatement,
    businessRequirements,
    solutionOverview,
    proposedSolution,
    scopeDefinition: buildScopeDefinitionFromDemandContext(ctx, implementationMonths),
    recommendations,
    alternativeSolutions: alternativeOptions.length > 0
      ? alternativeOptions.map((option) => normalizeListText(safeString(option.description ?? option.name, "Alternative option")))
      : buildAlternativeSolutions(ctx, implementationMonths, totalCostEstimate),
    expectedDeliverables,
    strategicObjectives,
    smartObjectives: [
      {
        objective: scopeObjective,
        specific: `Deploy ${title} for ${department} with governance-ready implementation controls.`,
        measurable: smartMeasurable,
        achievable: "Use phased delivery with controlled scope, named ownership, and regular review gates.",
        relevant: `Supports ${department} priorities while preserving sovereign handling requirements.`,
        timeBound: `Reach initial operational value within ${implementationMonths} months.`,
      },
    ],
    kpis,
    stakeholderAnalysis,
    implementationPhases,
    milestones,
    identifiedRisks: synthesizedRisks,
    dependencies: dependencyItems.map((item) => item.dependency),
    projectDependencies: dependencyItems,
    totalCostEstimate: totalCostOrUndefined,
    totalBenefitEstimate: totalBenefitOrUndefined,
    roiPercentage,
    implementationCosts,
    operationalCosts,
    benefitsBreakdown,
    resourceRequirements,
    detailedBenefits: [
      { category: "Operational", description: `Improves execution consistency and visibility for ${department}.`, type: "qualitative" },
      { category: "Governance", description: "Strengthens auditability, approval discipline, and evidence quality for future decisions.", type: "qualitative" },
      { category: "Financial", description: financialBenefit.description, type: financialBenefit.type, value: financialBenefit.value },
    ],
    successCriteria: normalizedSuccessCriteria.map((criterion) => ({
      criterion: criterion.criterion,
      target: criterion.target,
    })),
    performanceTargets: normalizedSuccessCriteria.map((criterion) => ({
      name: criterion.criterion,
      target: criterion.target,
      measurement: criterion.measurement,
    })),
    complianceRequirements: normalizedComplianceRequirements,
    policyReferences: normalizedComplianceRequirements,
    budgetProvenance: ctx.budgetProvenance,
    timelineProvenance: ctx.timeframeProvenance,
    planningAssumptionFlags: {
      budgetIsAiSuggested: ctx.budgetIsAiSuggested,
      timeframeIsAiSuggested: ctx.timeframeIsAiSuggested,
      officialBudgetApprovalProvided: !ctx.budgetIsAiSuggested && Boolean(ctx.budgetRange),
      officialTimelineProvided: !ctx.timeframeIsAiSuggested && Boolean(ctx.timeframe),
    },
    governanceFramework,
    auditRequirements: normalizedComplianceRequirements.map((requirement) => `Maintain approval records, control evidence, and audit trails demonstrating compliance with ${requirement}`),
    measurementPlan: {
      cadence: "Monthly KPI review with quarterly benefits realization updates",
      owners: [requestorName || "Business sponsor", department || organizationName, `${organizationName} PMO / governance office`],
      kpis: kpis.map((kpi) => ({
        name: kpi.name,
        baseline: kpi.baseline,
        target: kpi.target,
        owner: department || organizationName,
      })),
    },
    departmentImpact,
    organizationalBenefits,
    communicationPlan,
    keyAssumptions,
    nextSteps,
    conclusionSummary,
    meta: {
      generatedAt: new Date().toISOString(),
      engine: "A",
      fallback: true,
      synthesisSource: synthesisSource,
    },
  };
}

async function resolveBusinessCaseDraft(
  deps: BusinessCaseDeps,
  demandReport: Record<string, unknown>,
  decisionSpineId: string | undefined,
  brainResult: Record<string, unknown> | null | undefined,
): Promise<ResolvedBusinessCaseDraft> {
  const pipelineDraft = getBusinessCaseDraftFromPayload(brainResult);
  if (pipelineDraft.draft) {
    return pipelineDraft;
  }

  if (!decisionSpineId) {
    return pipelineDraft;
  }

  try {
    const storedDecision = await deps.brain.getFullDecisionWithLayers(decisionSpineId);
    const storedDraft = getBusinessCaseDraftFromPayload(storedDecision);
    if (storedDraft.draft) {
      return {
        ...storedDraft,
        source: "stored_advisory",
      };
    }

    const { advisoryPayload, advisoryKeys } = getGeneratedArtifacts(storedDecision);
    const synthesizedDraft = buildBusinessCaseDraftFromAdvisoryContext(demandReport, advisoryPayload || {});
    if (synthesizedDraft) {
      return {
        draft: synthesizedDraft,
        source: "advisory_synthesis",
        advisoryKeys,
        generatedArtifactKeys: null,
      };
    }

    return storedDraft;
  } catch (error) {
    logger.warn("[Generate BC] Stored decision fallback lookup failed", {
      decisionSpineId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const { advisoryPayload, advisoryKeys } = getGeneratedArtifacts(brainResult);
  const synthesizedDraft = buildBusinessCaseDraftFromAdvisoryContext(demandReport, advisoryPayload || {});
  if (synthesizedDraft) {
    return {
      draft: synthesizedDraft,
      source: "advisory_synthesis",
      advisoryKeys,
      generatedArtifactKeys: null,
    };
  }

  return pipelineDraft;
}

// ── Zod Schemas ─────────────────────────────────────────────────
const generateBusinessCaseSchema = z.object({
  clarificationResponses: z.array(z.any()).optional().default([]),
  clarificationsBypassed: z.boolean().optional().default(false),
  totalClarificationQuestions: z.number().optional().default(0),
  generationMode: z.string().optional().default("prompt_on_fallback"),
  force: z.boolean().optional().default(false),
  forceRegenerate: z.boolean().optional(),
});
const updateBusinessCaseSchema = z.object({
  financialAssumptions: z.any().optional(),
  domainParameters: z.any().optional(),
  totalCostEstimate: z.any().optional(),
  aiRecommendedBudget: z.any().optional(),
}).passthrough();

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function scoreToRiskLevel(riskScore: number): string {
  if (riskScore >= 75) return 'critical';
  if (riskScore >= 55) return 'high';
  if (riskScore >= 35) return 'medium';
  return 'low';
}

function resolveCompletenessScore(raw: unknown): number | null {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number(raw);
  return null;
}

interface QualityReportInput {
  businessCase: Record<string, unknown>;
  brainResult: unknown;
  clarificationsBypassed: boolean;
  totalClarificationQuestions: number;
  clarificationResponseCount: number;
  computedFinancialModel?: Record<string, unknown> | null;
  demandReport?: Record<string, unknown> | null;
}

interface AgentQualityScore {
  agentId: string;
  agentName: string;
  status: string;
  confidence: number | null;
}

function buildPlannedAgentScores(brainPayload: Record<string, unknown> | undefined): AgentQualityScore[] {
  const decision = brainPayload?.decision as Record<string, unknown> | undefined;
  const orchestration = (brainPayload?.orchestration as Record<string, unknown> | undefined)
    ?? (decision?.orchestration as Record<string, unknown> | undefined);
  if (!orchestration) return [];

  const agentPlan = (orchestration.agentPlan as Record<string, unknown> | undefined) ?? orchestration;

  const executionPlan = Array.isArray(agentPlan.executionPlan)
    ? agentPlan.executionPlan as Array<Record<string, unknown>>
    : Array.isArray(orchestration.executionPlan)
      ? orchestration.executionPlan as Array<Record<string, unknown>>
    : [];

  const plannedAgents = executionPlan
    .filter((step) => {
      const stepType = safeString(step.type, '').toLowerCase();
      return stepType === 'agent' || (!!step.agentId || !!step.agentName);
    })
    .map((step, index) => ({
      agentId: safeString(step.agentId, safeString(step.target, `agent-${index + 1}`)),
      agentName: safeString(step.agentName, safeString(step.name, safeString(step.target, `Agent ${index + 1}`))),
      status: safeString(step.status, 'planned'),
      confidence: normalizeConfidenceToPercent(step.confidence ?? step.score) ?? 70,
    } satisfies AgentQualityScore));

  if (plannedAgents.length > 0) {
    return plannedAgents.toSorted((a, b) => a.agentName.localeCompare(b.agentName));
  }

  const selectedAgentsRaw = Array.isArray(agentPlan.selectedAgents)
    ? agentPlan.selectedAgents
    : Array.isArray(orchestration.selectedAgents)
      ? orchestration.selectedAgents
    : Array.isArray(orchestration.agentsSelected)
      ? orchestration.agentsSelected
      : [];

  return selectedAgentsRaw.map((value, index) => {
    const selected = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const fallbackLabel = typeof value === 'string' && value.trim() ? value.trim() : `Agent ${index + 1}`;
    return {
      agentId: safeString(selected.agentId, fallbackLabel),
      agentName: safeString(selected.agentName, safeString(selected.name, fallbackLabel)),
      status: safeString(selected.status, 'selected'),
      confidence: normalizeConfidenceToPercent(selected.confidence ?? selected.score) ?? 60,
    } satisfies AgentQualityScore;
  }).toSorted((a, b) => a.agentName.localeCompare(b.agentName));
}

function buildAgentQualitySignal(brainResult: unknown): {
  check: { name: string; passed: boolean; score: number; weight: number; issues: string[]; recommendations: string[] };
  agentScore: number;
  agentScores: AgentQualityScore[];
} {
  const br = brainResult as Record<string, unknown>;
  const brDecision = br?.decision as Record<string, unknown> | undefined;
  const brAdvisory = (br?.advisory as Record<string, unknown> | undefined)
    ?? (brDecision?.advisory as Record<string, unknown> | undefined);
  const outputs = brAdvisory?.agentOutputs as Record<string, Record<string, unknown>> | undefined;
  const agentScores: AgentQualityScore[] = [];

  const readAgentsExecutedFromAudit = (): number => {
    const traces = [
      br?.auditTrail,
      brDecision?.auditTrail,
      (br as Record<string, unknown>)?.audit,
      (brDecision as Record<string, unknown> | undefined)?.audit,
    ];

    for (const trace of traces) {
      if (!Array.isArray(trace)) continue;
      for (const entry of trace) {
        if (!entry || typeof entry !== 'object') continue;
        const rec = entry as Record<string, unknown>;
        const layer = Number(rec.layer);
        const eventType = safeString(rec.eventType, '').toLowerCase();
        const eventData = (rec.eventData as Record<string, unknown> | undefined) || {};
        const agentsExecuted = Number(eventData.agentsExecuted);
        if (layer === 6 && eventType === 'reasoning_completed' && Number.isFinite(agentsExecuted) && agentsExecuted > 0) {
          return agentsExecuted;
        }
      }
    }

    return 0;
  };

  if (!outputs || typeof outputs !== "object" || Object.keys(outputs).length === 0) {
    const plannedAgentScores = buildPlannedAgentScores(br);
    if (plannedAgentScores.length > 0) {
      const agentsExecuted = readAgentsExecutedFromAudit();
      const inferredRuntime = agentsExecuted > 0;
      const normalizedPlanned = inferredRuntime
        ? plannedAgentScores.map((agent) => ({ ...agent, status: 'executed_unpersisted' }))
        : plannedAgentScores;
      const plannedScore = Math.round(
        normalizedPlanned.reduce((sum, agent) => sum + (agent.confidence ?? 60), 0) / normalizedPlanned.length,
      );

      return {
        check: {
          name: "Agent Signal Quality",
          passed: plannedScore >= 60,
          score: plannedScore,
          weight: 20,
          issues: inferredRuntime
            ? ["Layer 6 confirms agent execution, but detailed runtime outputs were not persisted; scoring uses orchestration confidence defaults"]
            : ["Runtime agent outputs are not yet recorded; scoring is based on the approved orchestration plan"],
          recommendations: inferredRuntime
            ? ["Persist per-agent runtime payloads (result/status/confidence) so quality scoring can use execution evidence directly"]
            : ["Persist runtime agent outputs after execution to replace planned evidence with execution evidence"],
        },
        agentScore: plannedScore,
        agentScores: normalizedPlanned,
      };
    }

    return {
      check: {
        name: "Agent Signal Quality",
        passed: false,
        score: 0,
        weight: 20,
        issues: ["No agent outputs were recorded"],
        recommendations: ["Ensure the IPLAN includes agents and that agent execution is not blocked"],
      },
      agentScore: 0,
      agentScores,
    };
  }

  for (const [agentId, output] of Object.entries(outputs)) {
    agentScores.push({
      agentId,
      agentName: typeof output?.agentName === 'string' ? output.agentName : agentId,
      status: typeof output?.status === 'string' ? output.status : "unknown",
      confidence: normalizeConfidenceToPercent(output?.confidence),
    });
  }

  const considered = agentScores.filter(a => !["skipped", "deferred", "blocked"].includes(a.status));
  const confidences = considered
    .map(a => (a.status === "completed" ? (a.confidence ?? 0) : 0))
    .filter(v => Number.isFinite(v));
  const agentScore = confidences.length === 0
    ? 0
    : Math.round(confidences.reduce((sum, v) => sum + v, 0) / confidences.length);

  const issues: string[] = [];
  const recommendations: string[] = [];
  const failed = considered.filter(a => a.status === "failed");
  if (failed.length > 0) issues.push(`${failed.length} agent(s) failed`);
  if (agentScore < 60) recommendations.push("Improve upstream demand context and re-run to strengthen agent signal confidence");

  return {
    check: {
      name: "Agent Signal Quality",
      passed: agentScore >= 60,
      score: agentScore,
      weight: 20,
      issues,
      recommendations,
    },
    agentScore,
    agentScores: agentScores.toSorted((a, b) => a.agentName.localeCompare(b.agentName)),
  };
}

// ── GET business-case helper functions ──

function resolveTimeline(response: Record<string, unknown>): void {
  const responseImplementationPhases = Array.isArray(response.implementationPhases)
    ? response.implementationPhases as Array<Record<string, unknown>>
    : [];
  let responseMilestones: Array<Record<string, unknown>> = [];
  if (Array.isArray(response.milestones)) {
    responseMilestones = response.milestones as Array<Record<string, unknown>>;
  } else if (Array.isArray(response.keyMilestones)) {
    responseMilestones = response.keyMilestones as Array<Record<string, unknown>>;
  }
  const responseTimeline = response.timeline && typeof response.timeline === 'object' && !Array.isArray(response.timeline)
    ? { ...(response.timeline as Record<string, unknown>) }
    : {};
  const responseTimelinePhases = Array.isArray(responseTimeline.phases)
    ? responseTimeline.phases as Array<Record<string, unknown>>
    : [];
  const responseTimelineMilestones = Array.isArray(responseTimeline.milestones)
    ? responseTimeline.milestones as Array<Record<string, unknown>>
    : [];

  response.timeline = {
    ...responseTimeline,
    phases: responseTimelinePhases.length > 0 ? responseTimelinePhases : responseImplementationPhases,
    milestones: responseTimelineMilestones.length > 0 ? responseTimelineMilestones : responseMilestones,
  };
  response.implementationTimeline = response.timeline;
  response.keyMilestones = responseMilestones;
}

function generateNextSteps(response: Record<string, unknown>): Array<Record<string, unknown>> {
  const generatedNextSteps: Array<Record<string, unknown>> = [];
  const implementationPhases = Array.isArray(response.implementationPhases)
    ? response.implementationPhases as Array<Record<string, unknown>>
    : [];
  const milestones = Array.isArray(response.milestones)
    ? response.milestones as Array<Record<string, unknown>>
    : [];

  implementationPhases.slice(0, 3).forEach((phase, index) => {
    const phaseName = safeString(phase.name, `Phase ${index + 1}`).trim();
    if (!phaseName) return;
    generatedNextSteps.push({
      action: `Finalize and approve ${phaseName} scope`,
      owner: safeString(phase.owner ?? response.department, 'PMO'),
      timeline: `${Math.max(1, index + 1)}-${Math.max(2, index + 2)} weeks`,
      priority: index === 0 ? 'High' : 'Medium',
    });
  });

  milestones.slice(0, 2).forEach((milestone) => {
    const milestoneName = safeString(milestone.name, '').trim();
    if (!milestoneName) return;
    generatedNextSteps.push({
      action: `Prepare delivery plan for milestone: ${milestoneName}`,
      owner: safeString(response.department, 'PMO'),
      timeline: safeString(milestone.date, 'TBD'),
      priority: 'Medium',
    });
  });

  if (generatedNextSteps.length === 0) {
    generatedNextSteps.push(
      {
        action: 'Confirm governance gate approval and execution authority',
        owner: 'Executive Sponsor',
        timeline: '1-2 weeks',
        priority: 'High',
      },
      {
        action: 'Finalize implementation plan and resource allocation',
        owner: safeString(response.department, 'PMO'),
        timeline: '2-4 weeks',
        priority: 'High',
      },
    );
  }

  return generatedNextSteps;
}

function buildExecutiveSummaryText(response: Record<string, unknown>): string {
  const objective = safeString(response.businessObjective, '').trim();
  const title = safeString(response.projectTitle ?? response.title, 'This initiative').trim();
  const stakeholderAnalysis = Array.isArray(response.stakeholderAnalysis)
    ? response.stakeholderAnalysis as Array<Record<string, unknown>>
    : [];
  const beneficiaryStakeholder = stakeholderAnalysis.find((stakeholder) => safeString(stakeholder.role, '').toLowerCase() === 'primary beneficiary');
  const department = safeString(response.department ?? beneficiaryStakeholder?.name, 'the sponsoring department').trim();
  const oversightStakeholder = stakeholderAnalysis.find((stakeholder) => safeString(stakeholder.role, '').toLowerCase() === 'executive oversight');
  const organizationName = safeString(response.organizationName ?? oversightStakeholder?.name, 'The organization').trim();
  const background = safeString(response.backgroundContext, '').trim();
  const problem = safeString(response.problemStatement, '').trim();
  const computedModel = response.computedFinancialModel as Record<string, unknown> | undefined;
  const metrics = computedModel?.metrics as Record<string, number> | undefined;
  const inputs = computedModel?.inputs as Record<string, number> | undefined;
  const decision = computedModel?.decision as Record<string, unknown> | undefined;
  const governmentValue = computedModel?.governmentValue as Record<string, unknown> | undefined;
  const financialVerdict = safeString(decision?.verdict, '');
  const publicVerdict = safeString(governmentValue?.verdict, '');
  const deliveryModel = Array.isArray(response.implementationPhases) && response.implementationPhases.length > 2
    ? 'a phased multi-workstream delivery model'
    : 'a phased controlled delivery model';

  const paragraphs: string[] = [];

  if (title) {
    paragraphs.push(`${organizationName} should progress ${title} as ${deliveryModel} for ${department}.`);
  } else if (objective) {
    paragraphs.push(objective.endsWith('.') ? objective : objective + '.');
  }
  if (background && background !== objective) {
    const bgSentences = background.match(/[^.!?]+[.!?]+/g) || [background];
    if (paragraphs.length === 0) {
      paragraphs.push(bgSentences.slice(0, 2).join(' ').trim());
    }
  }

  if (paragraphs.length === 0 && problem) {
    const probSentences = problem.match(/[^.!?]+[.!?]+/g) || [problem];
    paragraphs.push(probSentences[0].trim());
  }

  if (inputs?.totalInvestment && metrics?.totalCosts && metrics?.totalBenefits) {
    paragraphs.push(
      `The financial case is anchored to ${fmtAED(inputs.totalInvestment)} of upfront investment, with 5-year lifecycle costs of ${fmtAED(metrics.totalCosts)} and modeled benefits of ${fmtAED(metrics.totalBenefits)}.`
    );
  }

  if (metrics) {
    const roi = Number(metrics.roi || 0);
    const npv = Number(metrics.npv || 0);
    const paybackMonths = metrics.paybackMonths;
    const paybackText = paybackMonths != null && Number.isFinite(paybackMonths)
      ? `${Math.round(paybackMonths)} months`
      : 'no payback within the 5-year horizon';
    if ((financialVerdict === 'INVEST' || financialVerdict === 'STRONG_INVEST') && roi > 0 && npv >= 0) {
      paragraphs.push(`Commercial case: the initiative is investable on current assumptions, with ROI of ${roi.toFixed(1)}%, NPV of ${fmtAED(npv)}, and payback in ${paybackText}.`);
    } else {
      paragraphs.push(`Commercial case: the initiative does not yet clear a conventional investment hurdle, with ROI of ${roi.toFixed(1)}%, NPV of ${fmtAED(npv)}, and ${paybackText}.`);
    }
  }

  if (governmentValue) {
    const publicValueScore = typeof governmentValue.score === 'number' ? governmentValue.score : null;
    if ((publicValueScore ?? 0) >= 75 || publicVerdict === 'HIGH_VALUE' || publicVerdict === 'RECOMMENDED') {
      paragraphs.push(`Public-value case: the initiative has strong strategic justification, with a government-value score of ${publicValueScore ?? 0}/100 and clear relevance to service quality, resilience, or policy outcomes.`);
    } else if ((publicValueScore ?? 0) >= 60 || publicVerdict === 'MODERATE_VALUE') {
      paragraphs.push(`Public-value case: the initiative has credible strategic value, but that value should be earned through measurable service outcomes, controlled rollout, and executive stage gates.`);
    } else {
      paragraphs.push('Public-value case: strategic value is currently limited, so continuation should be justified by concrete operating outcomes rather than broad transformation language.');
    }
  }

  const decisionSummary = safeString(decision?.summary, '').trim();
  const governmentSummary = safeString(governmentValue?.summary, '').trim();
  if (decisionSummary || governmentSummary) {
    const publicValueScore = typeof governmentValue?.score === 'number' ? governmentValue.score : null;
    const hasMaterialPublicValue = (publicValueScore ?? 0) >= 60
      || publicVerdict === 'HIGH_VALUE'
      || publicVerdict === 'RECOMMENDED'
      || publicVerdict === 'MODERATE_VALUE';
    if ((financialVerdict === 'DO_NOT_INVEST' || financialVerdict === 'CAUTION') && hasMaterialPublicValue) {
      paragraphs.push('The initiative carries meaningful public value, but the financial model is below target. Proceed only with phased funding, explicit executive risk acceptance, and measurable benefit checkpoints.');
    } else if (financialVerdict === 'STRONG_INVEST') {
      paragraphs.push(decisionSummary || 'Strong financial fundamentals support immediate approval with standard governance controls.');
    } else {
      paragraphs.push(decisionSummary || governmentSummary);
    }
  }

  return paragraphs.join('\n\n');
}

function buildStandardRiskCategories(
  riskDept: string,
  totalInvestment: number,
  metrics: Record<string, number>,
): Array<Record<string, unknown>> {
  const roiVal = metrics.roi || 0;
  const npvVal = metrics.npv || 0;
  const hasPayback = metrics.paybackMonths != null && Number.isFinite(metrics.paybackMonths);

  const standardRisks: Array<Record<string, unknown>> = [
    { name: 'Technical Complexity Risk', severity: totalInvestment > 50_000_000 ? 'high' : 'medium', description: 'Technical complexity in system architecture, integration, and platform scalability for a project of this magnitude', probability: 'high', impact: 'high', mitigation: 'Technical proof of concept, phased architecture validation, and independent technical review board', owner: riskDept },
    { name: 'Schedule & Delivery Risk', severity: 'high', description: 'Risk of project delays due to complexity, regulatory approvals, vendor dependencies, and unforeseen technical challenges', probability: 'high', impact: 'high', mitigation: 'Agile delivery with sprint buffers, critical path monitoring, milestone-based stage gates, and early warning KPIs', owner: riskDept },
    { name: 'Budget Overrun Risk', severity: totalInvestment > 100_000_000 ? 'high' : 'medium', description: `Risk of exceeding the ${fmtAED(totalInvestment)} investment envelope due to scope changes, vendor cost escalation, or unforeseen requirements`, probability: 'medium', impact: 'high', mitigation: 'Phased funding releases, monthly financial reviews, 10-15% contingency reserve, and earned value management', owner: 'Finance' },
    { name: 'Resource & Talent Availability Risk', severity: 'medium', description: 'Shortage of qualified technical and domain experts, key person dependencies, and competition for specialized talent', probability: 'medium', impact: 'high', mitigation: 'Cross-training programs, knowledge transfer plans, vendor resource guarantees, and succession planning', owner: riskDept },
    { name: 'Organizational Change Management Risk', severity: 'high', description: 'Resistance to change, user adoption challenges, workflow disruption, and stakeholder alignment across departments', probability: 'high', impact: 'medium', mitigation: 'Structured change management program, executive sponsorship, phased rollout, and continuous user feedback loops', owner: riskDept },
    { name: 'Vendor & Third-Party Dependency Risk', severity: 'medium', description: 'Reliance on external vendors for critical components, SLA compliance, technology lock-in, and supply chain disruptions', probability: 'medium', impact: 'high', mitigation: 'Multi-vendor evaluation, contractual SLA guarantees, escrow arrangements, and exit strategy planning', owner: 'Procurement' },
    { name: 'Regulatory & Compliance Risk', severity: 'high', description: 'UAE government IT governance standards, data sovereignty requirements, sector-specific regulations, and evolving compliance landscape', probability: 'medium', impact: 'high', mitigation: 'Compliance audit at each phase gate, legal review, UAE data center hosting, and regulatory liaison officer', owner: 'Legal/Compliance' },
    { name: 'Data Migration & Integrity Risk', severity: 'medium', description: 'Risk of data loss, corruption, or quality degradation during migration from legacy systems and data integration', probability: 'medium', impact: 'high', mitigation: 'Data profiling and cleansing, parallel run validation, automated integrity checks, and rollback capability', owner: 'IT' },
    { name: 'Cybersecurity & Data Privacy Risk', severity: 'high', description: 'Exposure to cyber threats, data breaches, and privacy violations in a high-value government technology initiative', probability: 'medium', impact: 'critical', mitigation: 'Security-by-design, penetration testing, SOC monitoring, encryption at rest and in transit, and regular security audits', owner: 'CISO' },
    { name: 'Stakeholder & Governance Risk', severity: 'medium', description: 'Misalignment between key stakeholders, changing priorities, political factors, and governance structure gaps', probability: 'medium', impact: 'high', mitigation: 'Steering committee with regular cadence, RACI matrix, escalation procedures, and executive sponsor engagement', owner: riskDept },
    { name: 'Scalability & Performance Risk', severity: totalInvestment > 50_000_000 ? 'high' : 'medium', description: 'System may not scale to meet future demand, performance degradation under load, and capacity planning gaps', probability: 'medium', impact: 'high', mitigation: 'Load testing, capacity planning, horizontal scaling architecture, and performance benchmarks at each phase', owner: 'IT' },
  ];

  if (roiVal < 0 || npvVal < 0) {
    standardRisks.push({
      name: 'Financial Viability Risk',
      severity: roiVal < -30 || npvVal < 0 ? 'high' : 'medium',
      description: `The current model indicates ROI of ${roiVal.toFixed(1)}% and NPV of ${fmtAED(npvVal)}, so approval should remain contingent on scope discipline, staged funding, and benefit realization evidence.`,
      probability: 'high', impact: 'critical',
      mitigation: 'Re-baseline scope, confirm benefits ownership, and require formal review gates before releasing each funding tranche.',
      owner: 'Finance/PMO',
    });
  }
  if (!hasPayback) {
    standardRisks.push({
      name: 'No Payback Period Risk',
      severity: 'high',
      description: 'The financial model shows no payback period — the investment never breaks even within the projection horizon, indicating sustained negative cash flow',
      probability: 'high', impact: 'high',
      mitigation: 'Extend benefit realization timeline, identify additional revenue/savings streams, or consider partial investment with option to expand',
      owner: 'Finance/PMO',
    });
  }
  return standardRisks;
}

function mergeRisks(
  existingRisks: Array<Record<string, unknown>>,
  standardRisks: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const riskNames = new Set(existingRisks.map(r => safeString(r.name, '').toLowerCase()));
  for (const sr of standardRisks) {
    const nameKey = safeString(sr.name, '').toLowerCase();
    const isDuplicate = [...riskNames].some(existing =>
      existing.includes(nameKey.split(' ')[0]!.toLowerCase()) ||
      nameKey.includes(existing.split(' ')[0]!.toLowerCase())
    );
    if (!isDuplicate) {
      existingRisks.push(sr);
      riskNames.add(nameKey);
    }
  }
  return existingRisks;
}

function computeRiskScoreFromMetrics(
  risks: Array<Record<string, unknown>>,
  metrics: Record<string, number>,
): { riskScore: number; riskLevel: string } {
  const roiVal = metrics.roi || 0;
  const npvVal = metrics.npv || 0;
  const hasPayback = metrics.paybackMonths != null && Number.isFinite(metrics.paybackMonths);

  let riskScore = 0;
  riskScore += Math.min(risks.length * 2, 25);

  const criticalCount = risks.filter(r => r.severity === 'critical').length;
  const highCount = risks.filter(r => r.severity === 'high').length;
  riskScore += Math.min(criticalCount * 6 + highCount * 4, 30);

  if (roiVal < -50) riskScore += 35;
  else if (roiVal < -20) riskScore += 28;
  else if (roiVal < 0) riskScore += 20;
  else if (roiVal < 10) riskScore += 10;

  if (npvVal < -50_000_000) riskScore += 10;
  else if (npvVal < 0) riskScore += 7;
  else if (npvVal === 0) riskScore += 3;

  if (!hasPayback) riskScore += 5;
  riskScore = Math.min(riskScore, 100);

  return { riskScore, riskLevel: scoreToRiskLevel(riskScore) };
}

function classifyRiskMatrix(risks: Array<Record<string, unknown>>): Record<string, Array<Record<string, unknown>>> {
  const highProb = new Set(['high', 'critical', 'very high']);
  const highImp = new Set(['high', 'critical', 'very high']);
  const riskMatrix: Record<string, Array<Record<string, unknown>>> = {
    highProbabilityHighImpact: [],
    highProbabilityLowImpact: [],
    lowProbabilityHighImpact: [],
    lowProbabilityLowImpact: [],
  };
  for (const risk of risks) {
    const prob = safeString(risk.probability ?? risk.severity, 'medium').toLowerCase();
    const imp = safeString(risk.impact ?? risk.severity, 'medium').toLowerCase();
    const isHighProb = highProb.has(prob);
    const isHighImp = highImp.has(imp);
    if (isHighProb && isHighImp) riskMatrix.highProbabilityHighImpact!.push(risk);
    else if (isHighProb && !isHighImp) riskMatrix.highProbabilityLowImpact!.push(risk);
    else if (!isHighProb && isHighImp) riskMatrix.lowProbabilityHighImpact!.push(risk);
    else riskMatrix.lowProbabilityLowImpact!.push(risk);
  }
  return riskMatrix;
}

function enhanceResponseWithComputedModel(
  response: Record<string, unknown>,
  wasEditedAfterGeneration: boolean,
  computeFinancialModel: (inputs: FinancialInputs) => Record<string, unknown>,
): void {
  let computedModel = response.computedFinancialModel as Record<string, unknown> | undefined;
  if (!computedModel) return;

  // Always recompute when inputs exist — the unified model is deterministic and cheap,
  // and stored snapshots drift from code changes (threshold calibration, defaults, etc.).
  // Preserve only the original `inputs` and `generatedAt`.
  if (computedModel.inputs) {
    try {
      const freshModel = computeFinancialModel(computedModel.inputs as FinancialInputs);
      const storedGeneratedAt = computedModel.generatedAt;
      Object.keys(freshModel).forEach(key => {
        (computedModel as Record<string, unknown>)[key] = (freshModel as unknown as Record<string, unknown>)[key];
      });
      if (storedGeneratedAt) computedModel.generatedAt = storedGeneratedAt;
      logger.info('[business-case] hot-recompute OK', {
        killSwitchStatus: (freshModel.killSwitchMetrics as unknown as Record<string, unknown>)?.pilotGateStatus,
        npv: (freshModel.metrics as Record<string, unknown>)?.npv,
      });
    } catch (err) {
      logger.warn('[business-case] hot-recompute FAILED', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // ── Apply user cost/benefit line-item overrides (post-recompute) ──
  // User-entered 5-year lifecycle totals are applied by proportionally scaling
  // each matching line item's yearly values so the lifecycle sum matches the
  // override. Downstream metrics (NPV/IRR/ROI/Payback/cashFlows) are recomputed
  // from the adjusted arrays to stay consistent.
  try {
    const hydratedFinancialAssumptions = response.financialAssumptions as Record<string, unknown> | undefined;
    const savedFinancialAssumptions = response.savedFinancialAssumptions as Record<string, unknown> | undefined;
    const rawCostOverrides = (response.costOverrides as Record<string, unknown> | undefined)
      ?? (hydratedFinancialAssumptions?.costOverrides as Record<string, unknown> | undefined)
      ?? (savedFinancialAssumptions?.costOverrides as Record<string, unknown> | undefined);
    const costOverrides = sanitizeDroneStageCostOverrides(computedModel, rawCostOverrides);
    const benefitOverrides = (response.benefitOverrides as Record<string, unknown> | undefined)
      ?? (hydratedFinancialAssumptions?.benefitOverrides as Record<string, unknown> | undefined)
      ?? (savedFinancialAssumptions?.benefitOverrides as Record<string, unknown> | undefined);
    const hasCostOverrides = costOverrides && Object.keys(costOverrides).length > 0;
    const hasBenefitOverrides = benefitOverrides && Object.keys(benefitOverrides).length > 0;

    if (hasCostOverrides || hasBenefitOverrides) {
      if (!response.costOverrides && costOverrides) {
        response.costOverrides = costOverrides;
      }
      if (!response.benefitOverrides && benefitOverrides) {
        response.benefitOverrides = benefitOverrides;
      }
      applyFinancialOverridesToComputedModel(computedModel, costOverrides ?? {}, benefitOverrides ?? {});
      logger.info('[business-case] applied user cost/benefit overrides', {
        costKeys: hasCostOverrides ? Object.keys(costOverrides!).length : 0,
        benefitKeys: hasBenefitOverrides ? Object.keys(benefitOverrides!).length : 0,
        npv: (computedModel.metrics as Record<string, unknown> | undefined)?.npv,
        roi: (computedModel.metrics as Record<string, unknown> | undefined)?.roi,
      });
    }
  } catch (err) {
    logger.warn('[business-case] override application FAILED', { error: err instanceof Error ? err.message : String(err) });
  }

  const metrics = computedModel.metrics as Record<string, number> | undefined;
  const inputs = computedModel.inputs as Record<string, unknown> | undefined;
  const decision = computedModel.decision as Record<string, unknown> | undefined;
  const governmentValue = computedModel.governmentValue as Record<string, unknown> | undefined;
  if (!metrics) return;

  // ── Sanitize stale stored KPIs & inject pilot-validated framing ──
  // These overrides apply regardless of user-edit state because they reflect
  // system-level guardrails against stale aggressive assumptions that a CFO would
  // immediately challenge (e.g. "5,000 deliveries in 7 months", "100/drone @ AED 12").
  const driverModel = computedModel.driverModel as Record<string, unknown> | undefined;
  const isDroneBusinessCase = !!driverModel && (computedModel.archetype === 'Drone Last Mile Delivery');
  if (isDroneBusinessCase) {
    const rewriteKpiTarget = (kpi: Record<string, unknown>): Record<string, unknown> => {
      const target = safeString(kpi.target, '');
      const name = safeString(kpi.name, '').toLowerCase();
      // Replace aggressive "5,000 deliveries in N months" with phased KPI
      if (/5[,\u00a0]?000\s*(successful\s*)?deliveries/i.test(target) || (name.includes('delivery volume') && /within\s+\d+\s+months/i.test(target))) {
        return {
          ...kpi,
          name: 'Daily Delivery Volume (Phased)',
          target: 'Phase 1: validate 10-20 pilot drones at roughly 600–1,200 deliveries/day with ≥ 95% success and a credible glide path toward sub-AED 35 unit cost. Phase 2: scale only after pilot-gate PASS confirms 150-200 deliveries per drone/day at network scale, ≤ AED 35 cost per delivery, and sufficient contracted volume to sustain the fleet.',
        };
      }
      return kpi;
    };
    const rewriteKpiList = (list: unknown): unknown => {
      if (!Array.isArray(list)) return list;
      return list.map((k) => (k && typeof k === 'object') ? rewriteKpiTarget(k as Record<string, unknown>) : k);
    };
    if (Array.isArray(response.kpis)) response.kpis = rewriteKpiList(response.kpis);
    const measurementPlan = response.measurementPlan as Record<string, unknown> | undefined;
    if (measurementPlan && Array.isArray(measurementPlan.kpis)) {
      measurementPlan.kpis = rewriteKpiList(measurementPlan.kpis);
      response.measurementPlan = measurementPlan;
    }
  }

  const hydratedFinancialAssumptions = extractPersistedFinancialAssumptionsFromInputs(inputs);
  const hydratedDomainParameters = extractPersistedDomainParametersFromInputs(inputs);

  response.roiPercentage = metrics.roi;
  response.npvValue = metrics.npv;
  // totalCostEstimate = lifecycle TCO (not just CapEx) for consistency
  response.totalCostEstimate = metrics.totalCosts;
  response.totalBenefitEstimate = metrics.totalBenefits;
  response.lifecycleCostEstimate = metrics.totalCosts;
  response.lifecycleBenefitEstimate = metrics.totalBenefits;
  response.paybackMonths = metrics.paybackMonths;
  // The computed model is the canonical source of truth for financial inputs.
  // Persisted top-level fields can be stale after archetype reconciliation.
  response.financialAssumptions = hydratedFinancialAssumptions
    ? {
        ...((response.financialAssumptions as Record<string, unknown> | undefined) ?? {}),
        ...hydratedFinancialAssumptions,
      }
    : response.financialAssumptions;
  response.domainParameters = hydratedDomainParameters ?? response.domainParameters;
  response.savedFinancialAssumptions = hydratedFinancialAssumptions
    ? {
        ...((response.savedFinancialAssumptions as Record<string, unknown> | undefined)
          ?? (response.financialAssumptions as Record<string, unknown> | undefined)
          ?? {}),
        ...hydratedFinancialAssumptions,
      }
    : response.savedFinancialAssumptions;
  response.savedDomainParameters = hydratedDomainParameters ?? response.savedDomainParameters;

  const nestedCostOverrides = (response.financialAssumptions as Record<string, unknown> | undefined)?.costOverrides
    ?? (response.savedFinancialAssumptions as Record<string, unknown> | undefined)?.costOverrides;
  if (!response.costOverrides && nestedCostOverrides && typeof nestedCostOverrides === 'object') {
    response.costOverrides = nestedCostOverrides;
  }

  const nestedBenefitOverrides = (response.financialAssumptions as Record<string, unknown> | undefined)?.benefitOverrides
    ?? (response.savedFinancialAssumptions as Record<string, unknown> | undefined)?.benefitOverrides;
  if (!response.benefitOverrides && nestedBenefitOverrides && typeof nestedBenefitOverrides === 'object') {
    response.benefitOverrides = nestedBenefitOverrides;
  }

  // Reconcile top-level discountRate and aiRecommendedBudget from model
  const hydratedDiscountRate = hydratedFinancialAssumptions?.discountRate;
  if (typeof hydratedDiscountRate === 'number') {
    response.discountRate = hydratedDiscountRate;
  }
  // aiRecommendedBudget = initial CapEx only; initialInvestmentEstimate = same
  response.aiRecommendedBudget = inputs?.totalInvestment ?? response.aiRecommendedBudget;
  response.initialInvestmentEstimate = inputs?.totalInvestment ?? response.initialInvestmentEstimate;

  // Hydrate derived financial objects from the computed model (single source of truth)
  const modelTotalInvestment = typeof inputs?.totalInvestment === 'number' ? inputs.totalInvestment : 0;
  const modelDiscountRate = typeof inputs?.discountRate === 'number' ? inputs.discountRate : 0.08;
  response.roiCalculation = {
    basis: 'computed_financial_model',
    initialInvestment: modelTotalInvestment,
    lifecycleCost: metrics.totalCosts,
    lifecycleBenefit: metrics.totalBenefits,
    roi: metrics.roi,
  };
  response.npvCalculation = {
    basis: 'computed_financial_model',
    npv: metrics.npv,
    discountRate: modelDiscountRate > 1 ? modelDiscountRate / 100 : modelDiscountRate,
  };
  response.paybackCalculation = {
    basis: 'computed_financial_model',
    paybackMonths: metrics.paybackMonths,
  };

  // Reconcile implementation/operational costs from actual model cost items
  const modelCosts = computedModel.costs as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(modelCosts) && modelCosts.length > 0) {
    // Implementation costs: category=implementation (Y0 CapEx items)
    // Operational costs: category=operational (Y1-Y5 recurring items)
    const implItems: Record<string, number> = {};
    const opsItems: Record<string, number> = {};
    for (const item of modelCosts) {
      const cat = String(item.category || '').toLowerCase();
      const key = String(item.name || 'unknown').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      // Sum all year values for total amount
      let total = 0;
      for (let y = 0; y <= 5; y++) {
        total += Number(item[`year${y}`]) || 0;
      }
      if (cat === 'implementation' || cat === 'capex') {
        implItems[key] = (implItems[key] || 0) + total;
      } else {
        // For operational items, use annualized (total / 5 years)
        opsItems[key] = (opsItems[key] || 0) + total;
      }
    }
    if (Object.keys(implItems).length > 0) response.implementationCosts = implItems;
    if (Object.keys(opsItems).length > 0) response.operationalCosts = opsItems;
  } else if (modelTotalInvestment > 0) {
    // Fallback: percentage-based splits when no cost line items available
    const reconciledImpl = buildImplementationCosts(modelTotalInvestment);
    const modelMaintPct = typeof inputs?.maintenancePercent === 'number' ? inputs.maintenancePercent : 0.15;
    const reconciledAnnualOps = Math.round(modelTotalInvestment * 0.18);
    const reconciledAnnualMaint = Math.round(modelTotalInvestment * modelMaintPct);
    const reconciledOps = buildOperationalCosts(reconciledAnnualOps, reconciledAnnualMaint);
    response.implementationCosts = reconciledImpl;
    response.operationalCosts = reconciledOps;
  }

  // Hydrate tcoBreakdown from implementation + operational costs
  const implCosts = response.implementationCosts as Record<string, number> | undefined;
  const opsCosts = response.operationalCosts as Record<string, number> | undefined;
  if (implCosts || opsCosts) {
    const implTotal = implCosts ? Object.values(implCosts).reduce((s, v) => s + (Number(v) || 0), 0) : 0;
    const opsTotal = opsCosts ? Object.values(opsCosts).reduce((s, v) => s + (Number(v) || 0), 0) : 0;
    response.tcoBreakdown = {
      implementation: implTotal,
      operations: opsTotal,
      maintenance: 0,
    };
  }

  // Hydrate cash flows, line items, scenarios, and government value from model
  const modelCashFlows = computedModel.cashFlows as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(modelCashFlows) && modelCashFlows.length > 0) {
    response.cashFlows = modelCashFlows;
  }

  const modelCostItems = computedModel.costs as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(modelCostItems) && modelCostItems.length > 0) {
    response.detailedCosts = modelCostItems;
  }

  const modelBenefitItems = computedModel.benefits as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(modelBenefitItems) && modelBenefitItems.length > 0) {
    response.detailedBenefits = modelBenefitItems;
  }

  const modelScenarios = computedModel.scenarios as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(modelScenarios) && modelScenarios.length > 0) {
    response.sensitivityAnalysis = {
      scenarios: modelScenarios,
      baseCase: { npv: metrics.npv, roi: metrics.roi, paybackMonths: metrics.paybackMonths },
      methodology: 'Monte Carlo variation of adoption rate, discount rate, and operating costs across pessimistic/base/optimistic envelopes',
    };
  }

  if (governmentValue && typeof governmentValue === 'object') {
    response.governmentValue = governmentValue;
  }

  const modelDoNothingCost = computedModel.doNothingCost;
  if (typeof modelDoNothingCost === 'number' && Number.isFinite(modelDoNothingCost)) {
    response.doNothingCost = modelDoNothingCost;
  }

  const modelFiveYearProjections = computedModel.fiveYearProjections as Record<string, unknown> | undefined;
  if (modelFiveYearProjections) {
    response.fiveYearProjections = modelFiveYearProjections;
  }

  // Investment-committee-grade analytics
  if (computedModel.breakEvenAnalysis) {
    response.breakEvenAnalysis = computedModel.breakEvenAnalysis;
  }
  if (computedModel.terminalValue) {
    response.terminalValue = computedModel.terminalValue;
  }
  if (Array.isArray(computedModel.discountRateComparison)) {
    response.discountRateComparison = computedModel.discountRateComparison;
  }
  if (Array.isArray(computedModel.governmentExternalities)) {
    response.governmentExternalities = computedModel.governmentExternalities;
  }
  if (computedModel.investmentCommitteeSummary) {
    response.investmentCommitteeSummary = computedModel.investmentCommitteeSummary;
  }

  // Fill null alias fields from existing alternative fields
  if (!response.stakeholders && response.stakeholderAnalysis) {
    response.stakeholders = response.stakeholderAnalysis;
  }
  const scopeDef = response.scopeDefinition as Record<string, unknown> | undefined;
  if (response.inScope == null && scopeDef?.inScope) {
    response.inScope = scopeDef.inScope;
  }
  if (response.outOfScope == null && scopeDef?.outOfScope) {
    response.outOfScope = scopeDef.outOfScope;
  }
  if (response.strategicAlignment == null) {
    const objectives = response.strategicObjectives as unknown[] | undefined;
    response.strategicAlignment = {
      objectives: objectives ?? [],
      governmentValue: governmentValue ?? null,
    };
  }
  if (response.alternativesAnalysis == null && Array.isArray(response.alternativeSolutions)) {
    response.alternativesAnalysis = { options: response.alternativeSolutions };
  }
  if (response.riskMitigation == null && Array.isArray(response.mitigationStrategies)) {
    response.riskMitigation = response.mitigationStrategies;
  }
  if (response.priority == null) {
    const rScore = typeof response.riskScore === 'number' ? response.riskScore : 50;
    response.priority = rScore >= 80 ? 'Critical' : rScore >= 60 ? 'High' : rScore >= 40 ? 'Medium' : 'Low';
  }

  // Refresh key assumptions and resource requirements if model data available
  if (modelTotalInvestment > 0 && !wasEditedAfterGeneration) {
    const isAVContext = isAutonomousMobilityInitiative({
      title: safeString(response.projectTitle ?? response.title, ''),
      objective: safeString(response.businessObjective, ''),
      expectedOutcomes: extractMeaningfulStrings(response.expectedOutcomes),
      integrationRequirements: extractMeaningfulStrings(response.integrationRequirements),
      existingSystems: extractMeaningfulStrings(response.existingSystems),
    });
    const hydratedDomainParams = hydratedDomainParameters ?? {};
    response.keyAssumptions = buildKeyAssumptions(
      extractMeaningfulStrings(response.constraints),
      extractMeaningfulStrings(response.existingSystems),
      modelTotalInvestment,
      extractMeaningfulStrings(response.complianceRequirements),
      safeString(response.projectTitle ?? response.title, ''),
      safeString(response.businessObjective, ''),
      hydratedDomainParams as Record<string, unknown>,
      Boolean((response.planningAssumptionFlags as Record<string, unknown> | undefined)?.budgetIsAiSuggested) || isAiSuggestedBudgetText(response.budgetProvenance),
      Boolean((response.planningAssumptionFlags as Record<string, unknown> | undefined)?.timeframeIsAiSuggested) || isAiSuggestedTimelineText(response.timelineProvenance),
    );
    const implMonths = inferImplementationMonthsFromResponse(response, modelTotalInvestment);
    const monthlyBurn = Math.round((metrics.totalCosts || modelTotalInvestment) / Math.max(implMonths, 1));
    const isDroneContext = isDroneDeliveryInitiative({
      title: safeString(response.projectTitle ?? response.title, ''),
      objective: safeString(response.businessObjective, ''),
      expectedOutcomes: extractMeaningfulStrings(response.expectedOutcomes),
    });
    response.resourceRequirements = buildResourceRequirements(
      implMonths,
      monthlyBurn,
      modelTotalInvestment,
      extractMeaningfulStrings(response.integrationRequirements),
      isAVContext,
      isDroneContext,
    );
  }

  const nextSteps = Array.isArray(response.nextSteps) ? response.nextSteps as Array<Record<string, unknown>> : [];
  if (nextSteps.length === 0) {
    response.nextSteps = generateNextSteps(response);
  }

  const recommendationDepartment = safeString(response.department, 'the sponsoring department');
  const publicValueScore = typeof governmentValue?.score === 'number' ? governmentValue.score : null;
  const structuredRecommendations = buildCommercialPositionRecommendation(
    safeString(response.projectTitle ?? response.title, 'This initiative'),
    recommendationDepartment,
    inferImplementationMonthsFromResponse(response, asFiniteNumber(inputs?.totalInvestment, 0)),
    extractMeaningfulStrings(response.integrationRequirements),
    extractMeaningfulStrings(response.complianceRequirements),
    metrics,
    safeString(decision?.verdict, ''),
    safeString(governmentValue?.verdict, ''),
    publicValueScore,
  );
  const currentRecommendations = response.recommendations;
  const currentRecommendationObject = currentRecommendations && typeof currentRecommendations === 'object' && !Array.isArray(currentRecommendations)
    ? currentRecommendations as Record<string, unknown>
    : null;
  const currentCommercialCase = safeString(currentRecommendationObject?.commercialCase, '').trim();
  const currentPublicValueCase = safeString(currentRecommendationObject?.publicValueCase, '').trim();
  const currentHasStructuredNarratives = !!(
    currentCommercialCase &&
    currentPublicValueCase &&
    !containsGenericInitiativePlaceholder(currentCommercialCase) &&
    !containsGenericInitiativePlaceholder(currentPublicValueCase)
  );

  // Detect stale financial data in existing recommendations: if the stored ROI/NPV text
  // doesn't match the current computed model, force a full refresh.
  const currentRoi = Number(metrics.roi || 0);
  const currentRoiText = currentRoi.toFixed(1) + '%';
  const existingFinancialsStale = currentHasStructuredNarratives && currentCommercialCase.length > 0 && !currentCommercialCase.includes(currentRoiText);

  if (!currentHasStructuredNarratives || existingFinancialsStale) {
    response.recommendations = structuredRecommendations;
  }

  if (wasEditedAfterGeneration) {
    logger.info('[GET business-case] Preserving user-edited executive summary/risk content; skipping auto-enhancement', {
      wasEditedAfterGeneration,
      hasExecutiveSummary: !!response.executiveSummary,
      hasIdentifiedRisks: Array.isArray(response.identifiedRisks) && (response.identifiedRisks as unknown[]).length > 0,
    });
    return;
  }

  response.executiveSummary = buildExecutiveSummaryText(response);

  const existingRisks = Array.isArray(response.identifiedRisks)
    ? (response.identifiedRisks as Array<Record<string, unknown>>)
    : [];
  const riskDept = safeString(response.department, 'Operations');
  const totalInvestment = asFiniteNumber(inputs?.totalInvestment, 0);

  // Sanitize stale monetary references in existing risks
  if (totalInvestment > 0) {
    const currentBudgetLabel = fmtAED(totalInvestment);
    for (const risk of existingRisks) {
      const desc = safeString(risk.description, '');
      // Replace stale "over-15m" / "15,000,000" / shorthand references with current investment
      if (/over-\d+m\b|(?:approximately|about)?\s*\d{1,3},\d{3},\d{3}\s*AED/i.test(desc) && totalInvestment > 50_000_000) {
        risk.description = desc
          .replace(/over-\d+m\b/gi, currentBudgetLabel)
          .replace(/(?:approximately|about)?\s*\d{1,3},\d{3},\d{3}\s*AED/gi, currentBudgetLabel);
      }
    }
  }

  // Sanitize AI-generated risk names: strip trailing "For Risk" / "Risk" and fix Title Case
  for (const risk of existingRisks) {
    let name = safeString(risk.name, '');
    // Remove trailing " For Risk" or " Risk" from AI-generated names
    name = name.replace(/\s+For\s+Risk$/i, '').replace(/\s+Risk$/i, '');
    // Replace Title Case "And" / "Or" with lowercase
    name = name.replace(/\bAnd\b/g, 'and').replace(/\bOr\b/g, 'or').replace(/\bOf\b/g, 'of');
    risk.name = name;

    // Replace generic mitigation with risk-specific ones for drone-domain risks
    const mit = safeString(risk.mitigation, '');
    if (/phased delivery, named owners/i.test(mit)) {
      const lower = name.toLowerCase();
      if (lower.includes('gcaa') || lower.includes('regulatory'))
        risk.mitigation = 'Engage GCAA regulatory affairs liaison pre-project; submit safety case documentation during Phase 1; build regulatory approval into milestone gates.';
      else if (lower.includes('airspace') || lower.includes('no.fly') || lower.includes('no-fly'))
        risk.mitigation = 'Map restricted airspace zones in advance; integrate GCAA UTM feeds into flight planning; maintain geo-fence compliance on all drone firmware.';
      else if (lower.includes('weather') || lower.includes('climate'))
        risk.mitigation = 'Define wind/visibility/temperature operating envelopes; integrate meteorological data into automated grounding rules; include weather downtime in fleet utilization assumptions.';
      else if (lower.includes('public') || lower.includes('acceptance') || lower.includes('perception'))
        risk.mitigation = 'Run community awareness sessions before pilot launch; publish noise and safety data; establish a complaint response process with SLA.';
      else if (lower.includes('battery') || lower.includes('payload') || lower.includes('range'))
        risk.mitigation = 'Validate payload/range requirements during vendor selection; require endurance certification for each drone model; maintain hot-swap battery inventory at depots.';
      else
        risk.mitigation = `Address through dedicated risk owner in ${riskDept}, early detection via monitoring dashboards, and escalation path to steering committee.`;
    }
  }

  const standardRisks = buildStandardRiskCategories(riskDept, totalInvestment, metrics);
  const mergedRisks = mergeRisks(existingRisks, standardRisks);
  response.identifiedRisks = mergedRisks;

  const { riskScore, riskLevel } = computeRiskScoreFromMetrics(mergedRisks, metrics);
  response.riskScore = riskScore;
  response.riskLevel = riskLevel;

  const riskMatrix = classifyRiskMatrix(mergedRisks);
  response.riskMatrixData = riskMatrix;

  // Rebuild riskMitigation and mitigationStrategies from the merged risk register
  response.riskMitigation = mergedRisks.map((r) => ({
    risk: safeString(r.name, ''),
    mitigation: safeString(r.mitigation, ''),
  }));
  response.mitigationStrategies = response.riskMitigation;

  logger.info('[GET business-case] Overrode exec summary, risks & matrix with computed model:', {
    roi: metrics.roi, npv: metrics.npv, riskCount: mergedRisks.length,
    riskScore, riskLevel, verdict: decision?.verdict,
    matrixHH: riskMatrix.highProbabilityHighImpact!.length,
    matrixHL: riskMatrix.highProbabilityLowImpact!.length,
    matrixLH: riskMatrix.lowProbabilityHighImpact!.length,
    matrixLL: riskMatrix.lowProbabilityLowImpact!.length,
  });
}

function extractDbFinancialFields(dbRecordTyped: Record<string, unknown>): Record<string, unknown> {
  const dbSavedFinancials: Record<string, unknown> = {};
  if (dbRecordTyped?.totalCostEstimate !== undefined && dbRecordTyped?.totalCostEstimate !== null) {
    dbSavedFinancials.totalCostEstimate = dbRecordTyped.totalCostEstimate;
  }
  if (dbRecordTyped?.financialAssumptions) {
    dbSavedFinancials.financialAssumptions = dbRecordTyped.financialAssumptions;
  }
  if (dbRecordTyped?.domainParameters) {
    dbSavedFinancials.domainParameters = dbRecordTyped.domainParameters;
  }
  if (dbRecordTyped?.aiRecommendedBudget !== undefined && dbRecordTyped?.aiRecommendedBudget !== null) {
    dbSavedFinancials.aiRecommendedBudget = dbRecordTyped.aiRecommendedBudget;
  }
  if (dbRecordTyped?.costOverrides && typeof dbRecordTyped.costOverrides === 'object') {
    dbSavedFinancials.costOverrides = dbRecordTyped.costOverrides;
  }
  if (dbRecordTyped?.benefitOverrides && typeof dbRecordTyped.benefitOverrides === 'object') {
    dbSavedFinancials.benefitOverrides = dbRecordTyped.benefitOverrides;
  }
  return dbSavedFinancials;
}

function buildSavedFieldOverrides(
  wasEditedAfterGeneration: boolean,
  dbSavedFinancials: Record<string, unknown>,
  businessCaseContent: Record<string, unknown>,
): Record<string, unknown> {
  if (!wasEditedAfterGeneration) {
    return {
      savedTotalCostEstimate: null,
      savedFinancialAssumptions: null,
      savedDomainParameters: null,
      savedAiRecommendedBudget: null,
    };
  }
  return {
    savedTotalCostEstimate: dbSavedFinancials.totalCostEstimate ?? businessCaseContent?.totalCostEstimate,
    savedFinancialAssumptions: dbSavedFinancials.financialAssumptions ?? businessCaseContent?.financialAssumptions,
    savedDomainParameters: dbSavedFinancials.domainParameters ?? businessCaseContent?.domainParameters,
    savedAiRecommendedBudget: dbSavedFinancials.aiRecommendedBudget ?? businessCaseContent?.aiRecommendedBudget,
  };
}

async function executeBrainWithSoftTimeout<T>(
  brainExecution: Promise<T>,
  softTimeoutController: AbortController,
): Promise<T> {
  const softTimeoutMs = resolveBusinessCaseBrainSoftTimeoutMs();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      brainExecution,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          const timeoutError = new Error(`Business case soft timeout after ${softTimeoutMs}ms`);
          softTimeoutController.abort(timeoutError);
          reject(timeoutError);
        }, softTimeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

type QualityCheck = { name: string; passed: boolean; score: number; weight: number; issues: string[]; recommendations: string[] };

function buildContentCompletenessCheck(businessCase: Record<string, unknown>): QualityCheck {
  const contentFields = ['executiveSummary', 'backgroundContext', 'problemStatement', 'solutionOverview', 'businessRequirements', 'proposedSolution'];
  let contentScore = 0;
  const issues: string[] = [];
  const recs: string[] = [];
  for (const field of contentFields) {
    const val = businessCase[field];
    if (val && typeof val === 'string' && val.length > 100) contentScore += 20;
    else if (val && typeof val === 'string' && val.length > 0) { contentScore += 10; issues.push(`${field} is too brief`); }
    else { issues.push(`Missing ${field}`); recs.push(`Add ${field} section`); }
  }
  contentScore = Math.min(100, contentScore);
  return { name: 'Content Completeness', passed: contentScore >= 60, score: contentScore, weight: 20, issues, recommendations: recs };
}

function buildClarificationComplianceCheck(
  clarificationsBypassed: boolean,
  totalClarificationQuestions: number,
  clarificationResponseCount: number,
): QualityCheck {
  let score = 100;
  const issues: string[] = [];
  const recs: string[] = [];
  if (clarificationsBypassed && totalClarificationQuestions > 0) {
    const penalty = Math.min(50, totalClarificationQuestions * 10);
    score = Math.max(20, 100 - penalty);
    issues.push(`${totalClarificationQuestions} clarification question(s) were bypassed`);
    recs.push(
      'Answer clarification questions to improve business case quality and compliance',
      'Re-generate with clarification answers for higher accuracy',
    );
  } else if (clarificationResponseCount > 0 && totalClarificationQuestions > 0) {
    const coverage = (clarificationResponseCount / totalClarificationQuestions) * 100;
    score = Math.round(Math.max(40, coverage));
    if (coverage < 100) {
      issues.push(`Only ${clarificationResponseCount} of ${totalClarificationQuestions} questions were answered`);
      recs.push('Answer all questions for maximum quality');
    }
  }
  return { name: 'Clarification Compliance', passed: score >= 70, score, weight: 20, issues, recommendations: recs };
}

function hasNamedDemandEvidence(
  businessCase: Record<string, unknown>,
  demandReport?: Record<string, unknown> | null,
): boolean {
  const stakeholderNames = Array.isArray(businessCase.stakeholderAnalysis)
    ? (businessCase.stakeholderAnalysis as Array<Record<string, unknown>>)
        .flatMap((stakeholder) => [safeString(stakeholder.name, ''), safeString(stakeholder.department, ''), safeString(stakeholder.role, '')])
    : [];
  const text = [
    safeString(businessCase.businessObjective, ''),
    safeString(businessCase.executiveSummary, ''),
    safeString(businessCase.expectedOutcomes, ''),
    safeString(businessCase.successCriteria, ''),
    safeString(demandReport?.businessObjective, ''),
    safeString(demandReport?.expectedOutcomes, ''),
    safeString(demandReport?.successCriteria, ''),
    ...stakeholderNames,
  ].join(' ');

  return /(amazon|noon|aramex|dha|dubai health|signed contract|signed mou|anchor client|anchor customer|contracted retailer|contracted customer|e-commerce platform)/i.test(text);
}

function buildFinancialQualityCheck(
  businessCase: Record<string, unknown>,
  computedFinancialModel?: Record<string, unknown> | null,
  demandReport?: Record<string, unknown> | null,
): QualityCheck {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const defaultFinancialViewKey = safeString((computedFinancialModel?.financialViews as Record<string, unknown> | undefined)?.defaultView, '');
  const activeFinancialView = (computedFinancialModel?.financialViews as Record<string, unknown> | undefined)?.[defaultFinancialViewKey] as Record<string, unknown> | undefined;
  const activeViewMetrics = activeFinancialView?.metrics as Record<string, unknown> | undefined;
  const totalCostEstimate = typeof activeFinancialView?.lifecycleCost === 'number'
    ? activeFinancialView.lifecycleCost as number
    : typeof businessCase.totalCostEstimate === 'number'
      ? businessCase.totalCostEstimate
      : null;
  const roiValue = typeof activeViewMetrics?.roi === 'number'
    ? activeViewMetrics.roi as number
    : typeof businessCase.roiPercentage === 'number'
      ? businessCase.roiPercentage
      : typeof businessCase.roi === 'number'
        ? businessCase.roi
        : null;
  const npvValue = typeof activeViewMetrics?.npv === 'number'
    ? activeViewMetrics.npv as number
    : typeof businessCase.npvValue === 'number'
      ? businessCase.npvValue
      : null;
  const paybackMonths = typeof activeViewMetrics?.paybackMonths === 'number'
    ? activeViewMetrics.paybackMonths as number
    : typeof businessCase.paybackMonths === 'number'
      ? businessCase.paybackMonths
      : null;
  const hasCost = totalCostEstimate != null;
  const hasROI = roiValue != null;
  const hasNpv = npvValue != null;
  const hasPayback = paybackMonths != null;

  let score = 0;
  score += hasCost ? 8 : 0;
  score += hasROI ? 8 : 0;
  score += hasNpv ? 8 : 0;
  score += hasPayback ? 8 : 0;

  if (!hasCost) issues.push('Missing cost estimate');
  if (!hasROI) issues.push('Missing ROI');
  if (!hasNpv) issues.push('Missing NPV');
  if (!hasPayback) issues.push('Missing payback assessment');

  if (roiValue != null) {
    if (roiValue > 15) score += 6;
    else if (roiValue > 0) score += 3;
    else issues.push(`ROI is negative at ${roiValue.toFixed(0)}%, so the case does not clear a commercial hurdle.`);
  }
  if (npvValue != null) {
    if (npvValue > 0) score += 6;
    else issues.push(`NPV is negative at ${fmtAED(npvValue)}, so value creation is not yet proven.`);
  }
  if (paybackMonths != null) {
    if (Number.isFinite(paybackMonths) && paybackMonths <= 48) score += 6;
    else if (Number.isFinite(paybackMonths) && paybackMonths <= 60) score += 3;
    else issues.push('Payback is not achieved within an executive-grade horizon.');
  }

  const unitEconomics = computedFinancialModel?.unitEconomics as Record<string, unknown> | undefined;
  const killSwitchMetrics = computedFinancialModel?.killSwitchMetrics as Record<string, unknown> | undefined;
  const commercialAudit = computedFinancialModel?.commercialAudit as Record<string, unknown> | undefined;
  const economicProof = computedFinancialModel?.economicProof as Record<string, unknown> | undefined;
  const demandCertainty = computedFinancialModel?.demandCertainty as Record<string, unknown> | undefined;
  const pilotJustification = computedFinancialModel?.pilotJustification as Record<string, unknown> | undefined;
  const driverModel = computedFinancialModel?.driverModel as Record<string, unknown> | undefined;
  const stagedEconomics = driverModel?.stagedEconomics as Record<string, unknown> | undefined;
  const pilotCase = stagedEconomics?.pilotCase as Record<string, unknown> | undefined;

  const minimumViableCheck = safeString(unitEconomics?.minimumViableCheck, '');
  if (minimumViableCheck === 'PASS') score += 12;
  else if (minimumViableCheck === 'CONDITIONAL') score += 6;
  else if (minimumViableCheck) issues.push('Minimum viable unit economics are not yet proven.');

  const pilotGateStatus = safeString(killSwitchMetrics?.pilotGateStatus, '');
  if (pilotGateStatus === 'PASS') score += 12;
  else if (pilotGateStatus === 'CONDITIONAL') score += 6;
  else if (pilotGateStatus === 'FAIL') issues.push('Pilot gate fails on economic-proof, demand, or operating thresholds.');

  const revenueConfidenceScore = typeof demandCertainty?.revenueConfidenceScore === 'number' ? demandCertainty.revenueConfidenceScore : null;
  if (revenueConfidenceScore != null) {
    if (revenueConfidenceScore >= 65) score += 8;
    else if (revenueConfidenceScore >= 55) score += 4;
    else issues.push(`Demand certainty is weak at ${revenueConfidenceScore}/100 and remains too speculative for approval.`);
  }

  const namedDemandEvidence = hasNamedDemandEvidence(businessCase, demandReport);
  if (demandCertainty && !namedDemandEvidence) {
    issues.push('No named anchor clients or equivalent demand commitments are evidenced in the case.');
  }

  const evidenceVerdict = safeString(economicProof?.evidenceVerdict, '');
  if (evidenceVerdict === 'PROVEN') score += 10;
  else if (evidenceVerdict === 'PARTIAL') score += 5;
  else if (evidenceVerdict === 'UNPROVEN') issues.push(safeString(economicProof?.summary, 'Economic proof is not established.'));

  const alignment = safeString(pilotJustification?.alignment, '');
  if (alignment === 'ALIGNED') score += 8;
  else if (alignment === 'PARTIAL') score += 4;
  else if (alignment === 'MISALIGNED') issues.push(safeString(pilotJustification?.summary, 'Pilot design is misaligned with the hardest unknown.'));

  if (safeString(commercialAudit?.verdict, '') === 'RED') {
    issues.push(safeString(commercialAudit?.summary, 'Commercial logic is not investment-committee grade.'));
  }

  if (pilotCase) {
    const weightedAverageFare = typeof pilotCase.weightedAverageFare === 'number' ? pilotCase.weightedAverageFare : 0;
    const platformRevenuePerDelivery = typeof pilotCase.platformRevenuePerDelivery === 'number' ? pilotCase.platformRevenuePerDelivery : 0;
    const effectiveCostPerDelivery = typeof pilotCase.effectiveCostPerDelivery === 'number' ? pilotCase.effectiveCostPerDelivery : 0;
    const contributionMarginPerDelivery = typeof pilotCase.contributionMarginPerDelivery === 'number' ? pilotCase.contributionMarginPerDelivery : 0;
    const expectedContribution = (weightedAverageFare + platformRevenuePerDelivery) - effectiveCostPerDelivery;
    if (Math.abs(expectedContribution - contributionMarginPerDelivery) > 0.5) {
      score -= 15;
      issues.push('Contribution margin does not reconcile cleanly with revenue and variable cost assumptions.');
      recommendations.push('Fix contribution, cost, and EBITDA linkages so unit economics reconcile exactly.');
    }
  }

  if (issues.some((issue) => issue.includes('Economic proof'))) {
    recommendations.push('Show a quantified path from current unit cost to AED 35 pilot exit and AED 30 scale target using automation, utilization, and routing drivers.');
  }
  if (issues.some((issue) => issue.includes('Demand certainty')) || issues.some((issue) => issue.includes('anchor clients'))) {
    recommendations.push('Require at least 65% contracted revenue or named anchor demand evidence before pilot approval.');
  }
  if (issues.some((issue) => issue.includes('misaligned'))) {
    recommendations.push('Re-scope the pilot so it proves the hardest unknown first: scale unit economics under real operating conditions.');
  }
  if (issues.some((issue) => issue.includes('ROI is negative')) || issues.some((issue) => issue.includes('NPV is negative'))) {
    recommendations.push('Do not treat the case as decision-ready until the economics improve or the approval scope is explicitly limited to a proof-seeking pilot with hard exit gates.');
  }

  score = Math.round(Math.max(0, Math.min(100, score)));

  return {
    name: 'Financial Analysis',
    passed: score >= 70,
    score,
    weight: 20,
    issues,
    recommendations: Array.from(new Set(recommendations)),
  };
}

function applyDerivedFinancialQualityCheck(
  report: QualityReport | null,
  financialCheck: QualityCheck,
): QualityReport | null {
  if (!report || typeof report !== 'object') {
    return null;
  }

  const existingChecks = Array.isArray(report.checks)
    ? report.checks.filter((check) => !(check && typeof check === 'object' && (check as Record<string, unknown>).name === 'Financial Analysis'))
    : [];
  const checks = [...existingChecks, financialCheck] as Array<Record<string, unknown>>;
  const totalWeight = checks.reduce((sum, check) => sum + (typeof check.weight === 'number' ? check.weight : 0), 0) || 1;
  const overallScore = Math.round(checks.reduce((sum, check) => {
    const score = typeof check.score === 'number' ? check.score : 0;
    const weight = typeof check.weight === 'number' ? check.weight : 0;
    return sum + ((score * weight) / totalWeight);
  }, 0));

  return {
    ...report,
    overallScore,
    passed: overallScore >= 70,
    grade: scoreToGrade(overallScore),
    checks,
  };
}

function buildQualityReportFromBusinessCase(input: QualityReportInput): QualityReport {
  const { businessCase, brainResult, clarificationsBypassed, totalClarificationQuestions, clarificationResponseCount } = input;
  const financialCheck = buildFinancialQualityCheck(businessCase, input.computedFinancialModel, input.demandReport);

  const hasObjectives = Array.isArray(businessCase.smartObjectives) && businessCase.smartObjectives.length > 0;
  const hasKPIs = Array.isArray(businessCase.kpis) && businessCase.kpis.length > 0;
  const hasStakeholders = Array.isArray(businessCase.stakeholderAnalysis) && businessCase.stakeholderAnalysis.length >= 4;
  const strategicScore = (hasObjectives ? 40 : 0) + (hasKPIs ? 30 : 0) + (hasStakeholders ? 30 : 0);

  const alternatives = Array.isArray(businessCase.alternativeSolutions) ? businessCase.alternativeSolutions : [];
  const milestones = Array.isArray(businessCase.milestones) ? businessCase.milestones as Array<Record<string, unknown>> : [];
  const nextSteps = Array.isArray(businessCase.nextSteps) ? businessCase.nextSteps as Array<Record<string, unknown>> : [];
  const validMilestoneDates = milestones.filter((milestone) => /^\d{4}-\d{2}-\d{2}$/.test(safeString(milestone.date, ''))).length;
  const executionIssues: string[] = [];
  const executionRecommendations: string[] = [];
  let executionScore = 0;
  if (milestones.length >= 3 && validMilestoneDates >= 3) executionScore += 40;
  else {
    executionIssues.push('Milestones are missing decision-grade dates');
    executionRecommendations.push('Use real milestone dates rather than placeholder month labels');
  }
  if (nextSteps.length >= 3 && nextSteps.every((step) => safeString(step.timeline, '').trim() && safeString(step.timeline, '') !== 'TBD')) executionScore += 30;
  else {
    executionIssues.push('Next steps are missing named timelines or owners');
    executionRecommendations.push('Add named owners and dated next steps for executive follow-through');
  }
  if (alternatives.length >= 2) executionScore += 30;
  else {
    executionIssues.push('Alternative options are missing or incomplete');
    executionRecommendations.push('Compare at least two realistic alternative delivery approaches');
  }

  const agentSignal = buildAgentQualitySignal(brainResult);

  const qualityChecks: QualityCheck[] = [
    buildContentCompletenessCheck(businessCase),
    financialCheck,
    buildClarificationComplianceCheck(clarificationsBypassed, totalClarificationQuestions, clarificationResponseCount),
    {
      name: 'Strategic Alignment',
      passed: strategicScore >= 60,
      score: strategicScore,
      weight: 20,
      issues: [
        ...(hasObjectives ? [] : ['Missing SMART objectives']),
        ...(hasKPIs ? [] : ['Missing measurable KPIs']),
        ...(hasStakeholders ? [] : ['Stakeholder coverage is too thin for a decision-grade case']),
      ],
      recommendations: [],
    },
    {
      name: 'Decision Readiness',
      passed: executionScore >= 70,
      score: executionScore,
      weight: 20,
      issues: executionIssues,
      recommendations: executionRecommendations,
    },
    agentSignal.check,
  ];

  const totalWeight = qualityChecks.reduce((sum, c) => sum + c.weight, 0);
  const overallScore = Math.round(qualityChecks.reduce((sum, c) => sum + (c.score * c.weight) / totalWeight, 0));
  const passed = overallScore >= 70;
  const grade = scoreToGrade(overallScore);

  return {
    overallScore,
    passed,
    grade,
    checks: qualityChecks,
    agentScore: agentSignal.agentScore,
    agentScores: agentSignal.agentScores,
    agentSummary: Object.fromEntries(
      agentSignal.agentScores.map(a => [
        a.agentId,
        { agent: a.agentName, status: a.status, score: a.confidence ?? 0 },
      ]),
    ),
    passedChecks: qualityChecks.filter(c => c.passed).length,
    failedChecks: qualityChecks.filter(c => !c.passed).length,
    summary: clarificationsBypassed
      ? `Business case quality: ${overallScore}/100 (Grade ${grade}). Clarification questions were bypassed — answering them would improve quality.`
      : `Business case quality: ${overallScore}/100 (Grade ${grade}).`,
    validatedAt: new Date(),
    clarificationsBypassed,
  } as QualityReport;
}

function normalizeConfidenceToPercent(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const scaled = num > 1 ? num : num * 100;
  const clamped = Math.max(0, Math.min(100, scaled));
  return Math.round(clamped);
}

function hasMeaningfulValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => typeof item === 'string' && item.trim().length > 0);
  }
  return typeof value === 'string' && value.trim().length > 0;
}

function fmtAED(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M AED`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K AED`;
  return `${v.toLocaleString()} AED`;
}

function isValidBusinessCaseData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  const hasBCFields = !!(obj.executiveSummary || obj.problemStatement || obj.financialAnalysis ||
                        obj.backgroundContext || obj.solutionOverview || obj.detailedCosts);
  const hasFinancialParams = !!(obj.financialAssumptions || obj.domainParameters || obj.totalCostEstimate);
  const hasDemandOnlyFields = !!(obj.suggestedProjectName && !obj.executiveSummary && !obj.problemStatement && !hasFinancialParams);
  return (hasBCFields || hasFinancialParams) && !hasDemandOnlyFields;
}

async function checkCostGate(
  deps: BusinessCaseDeps,
  id: string,
): Promise<Record<string, unknown> | null> {
  const existingBC = await deps.businessCase.findByDemandReportId(id);
  if (!existingBC) return null;
  const existingData = (existingBC as Record<string, unknown>)?.data as Record<string, unknown> || existingBC as Record<string, unknown>;
  const hasContent = !!(existingData?.executiveSummary || existingData?.problemStatement || existingData?.solutionOverview);
  if (!hasContent) return null;
  // Do NOT cache fallback BCs: those were produced when the AI engine was unavailable, so a
  // subsequent generation request (auto-trigger after engine recovery, or manual regenerate)
  // should be allowed to replace the fallback content with a real engine-backed business case.
  const generationMethod = String((existingBC as Record<string, unknown>).generationMethod ?? "").toLowerCase();
  if (generationMethod === "fallback_synthesis" || generationMethod === "advisory_synthesis") {
    logger.info(`[Generate BC] COST GATE: existing BC for ${id} is ${generationMethod} — bypassing cache to allow regeneration`);
    return null;
  }
  logger.info(`[Generate BC] COST GATE: Business case already exists for ${id} — returning cached (no AI call)`);
  return {
    success: true,
    cached: true,
    data: {
      ...normalizeBusinessCaseFields(existingData),
      id: existingBC.id,
      demandReportId: id,
    },
    qualityReport: existingData?.qualityReport || existingBC?.qualityReport || null,
  };
}

function applyFinancialModel(
  deps: BusinessCaseDeps,
  insertPayload: Record<string, unknown>,
  businessCase: Record<string, unknown>,
  demandReport: Record<string, unknown>,
  reportId: string,
): void {
  try {
    const generatedFinancialInputs = deps.financial.buildInputsFromData(
      businessCase,
      demandReport,
    ) as unknown as FinancialInputs;
    if (generatedFinancialInputs.totalInvestment > 0) {
      const generatedFinancialModel = deps.financial.compute(generatedFinancialInputs as unknown as Record<string, unknown>) as unknown as UnifiedFinancialOutput;
      const generatedMetrics = generatedFinancialModel.metrics as unknown as Record<string, number>;
      const generatedFinancialAssumptions = extractPersistedFinancialAssumptionsFromInputs(generatedFinancialInputs as unknown as Record<string, unknown>);
      const generatedDomainParameters = extractPersistedDomainParametersFromInputs(generatedFinancialInputs as unknown as Record<string, unknown>);
      insertPayload.computedFinancialModel = generatedFinancialModel;
      insertPayload.aiRecommendedBudget = generatedFinancialInputs.totalInvestment;
      insertPayload.initialInvestmentEstimate = generatedFinancialInputs.totalInvestment;
      insertPayload.discountRate = generatedFinancialAssumptions?.discountRate ?? 0.10;
      insertPayload.lifecycleCostEstimate = generatedMetrics.totalCosts;
      insertPayload.lifecycleBenefitEstimate = generatedMetrics.totalBenefits;
      insertPayload.totalCostEstimate = generatedFinancialInputs.totalInvestment;
      insertPayload.totalBenefitEstimate = generatedMetrics.totalBenefits;
      insertPayload.financialAssumptions = generatedFinancialAssumptions;
      insertPayload.domainParameters = generatedDomainParameters;
      insertPayload.roiPercentage = generatedMetrics.roi;
      insertPayload.npvValue = generatedMetrics.npv;
      insertPayload.paybackMonths = generatedMetrics.paybackMonths;
      insertPayload.roiCalculation = {
        basis: 'computed_financial_model',
        initialInvestment: generatedFinancialInputs.totalInvestment,
        lifecycleCost: generatedMetrics.totalCosts,
        lifecycleBenefit: generatedMetrics.totalBenefits,
        roi: generatedMetrics.roi,
      };
      insertPayload.npvCalculation = {
        basis: 'computed_financial_model',
        npv: generatedMetrics.npv,
        discountRate: generatedFinancialInputs.discountRate,
      };
      insertPayload.paybackCalculation = {
        basis: 'computed_financial_model',
        paybackMonths: generatedMetrics.paybackMonths,
      };

      // Reconcile cost breakdowns from the model's totalInvestment (not the stale budget range estimate)
      const modelTotalInvestment = generatedFinancialInputs.totalInvestment as number;
      const reconciledImplementationCosts = buildImplementationCosts(modelTotalInvestment);
      const modelMaintenancePercent = typeof generatedFinancialInputs.maintenancePercent === 'number'
        ? generatedFinancialInputs.maintenancePercent : 0.15;
      const annualOps = Math.round(modelTotalInvestment * 0.18);
      const annualMaint = Math.round(modelTotalInvestment * modelMaintenancePercent);
      const reconciledOperationalCosts = buildOperationalCosts(annualOps, annualMaint);
      // Reconcile cost breakdowns from model cost line items (not percentage splits)
      const modelCostItems = generatedFinancialModel.costs as unknown as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(modelCostItems) && modelCostItems.length > 0) {
        const implItems: Record<string, number> = {};
        const opsItemsMap: Record<string, number> = {};
        for (const item of modelCostItems) {
          const cat = String(item.category || '').toLowerCase();
          const key = String(item.name || 'unknown').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
          let total = 0;
          for (let y = 0; y <= 5; y++) total += Number(item[`year${y}`]) || 0;
          if (cat === 'implementation' || cat === 'capex') {
            implItems[key] = (implItems[key] || 0) + total;
          } else {
            opsItemsMap[key] = (opsItemsMap[key] || 0) + total;
          }
        }
        insertPayload.implementationCosts = Object.keys(implItems).length > 0 ? implItems : buildImplementationCosts(modelTotalInvestment);
        insertPayload.operationalCosts = Object.keys(opsItemsMap).length > 0 ? opsItemsMap : buildOperationalCosts(annualOps, annualMaint);
      } else {
        insertPayload.implementationCosts = reconciledImplementationCosts;
        insertPayload.operationalCosts = reconciledOperationalCosts;
      }
      insertPayload.tcoBreakdown = {
        implementation: Object.values(reconciledImplementationCosts).reduce((s, v) => s + (Number(v) || 0), 0),
        operations: (Number(reconciledOperationalCosts.annualRunCost) || 0) + (Number(reconciledOperationalCosts.support) || 0),
        maintenance: Number(reconciledOperationalCosts.maintenance) || 0,
      };

      harmonizeBusinessCaseWithFinancialModel(
        businessCase,
        insertPayload,
        demandReport,
        generatedFinancialInputs as unknown as Record<string, unknown>,
        generatedFinancialModel as unknown as Record<string, unknown>,
      );
    }
  } catch (financialModelError) {
    logger.warn('[Business Case] Failed to compute unified financial model during generation', {
      reportId,
      error: financialModelError instanceof Error ? financialModelError.message : String(financialModelError),
    });
  }
}

function harmonizeBusinessCaseWithFinancialModel(
  businessCase: Record<string, unknown>,
  insertPayload: Record<string, unknown>,
  demandReport: Record<string, unknown>,
  generatedFinancialInputs: Record<string, unknown>,
  generatedFinancialModel: Record<string, unknown>,
): void {
  const ctx = extractDemandContext({ ...demandReport, ...businessCase });
  const metrics = (generatedFinancialModel.metrics as Record<string, number> | undefined) ?? {};
  const decision = (generatedFinancialModel.decision as Record<string, unknown> | undefined) ?? {};
  const governmentValue = (generatedFinancialModel.governmentValue as Record<string, unknown> | undefined) ?? {};
  const totalInvestment = typeof generatedFinancialInputs.totalInvestment === 'number' ? generatedFinancialInputs.totalInvestment : 0;
  const implementationPhases = Array.isArray(businessCase.implementationPhases)
    ? businessCase.implementationPhases as Array<Record<string, unknown>>
    : [];
  const implementationMonths = implementationPhases.reduce(
    (sum, phase) => sum + asFiniteNumber(phase.durationMonths ?? phase.months ?? phase.duration, 0),
    0,
  ) || Math.max(6, computeFinancials(ctx.budgetRange, ctx.urgency, demandReport).implementationMonths);
  const milestones = buildMilestoneSchedule(implementationMonths);
  const normalizedComplianceRequirements = buildComplianceRequirements(ctx.complianceRequirements);
  const generatedDomainParameters = extractPersistedDomainParametersFromInputs(generatedFinancialInputs) ?? {};
  const isAutonomousMobility = isAutonomousMobilityInitiative({
    title: ctx.title,
    objective: ctx.objective,
    expectedOutcomes: ctx.expectedOutcomes,
    integrationRequirements: ctx.integrationRequirements,
    existingSystems: ctx.existingSystems,
  });
  const nextSteps = buildExecutionNextSteps(ctx.title, ctx.department, milestones);
  const alternativeSolutions = Array.isArray(businessCase.alternativeSolutions) && businessCase.alternativeSolutions.length >= 2
    ? businessCase.alternativeSolutions
    : buildAlternativeSolutions(ctx, implementationMonths, totalInvestment);
  const stakeholderAnalysis = buildDraftStakeholderAnalysis(
    ctx.requestorName,
    ctx.department,
    ctx.organizationName,
    ctx.title,
    ctx.integrationRequirements,
    normalizedComplianceRequirements,
  );
  const kpis = buildDemandSpecificKpis(ctx.title, ctx.department, ctx.expectedOutcomes, implementationMonths, ctx.objective);
  const successCriteria = buildSuccessCriteria(ctx.successCriteria, implementationMonths);
  const infrastructureRequirements = ctx.integrationRequirements.length > 0
    ? ctx.integrationRequirements
    : ['Application hosting', 'Integration environment', 'Monitoring and audit tooling'];
  const resourceRequirements = buildResourceRequirements(
    implementationMonths,
    Math.round((metrics.totalCosts || totalInvestment) / Math.max(implementationMonths, 1)),
    totalInvestment,
    infrastructureRequirements,
    isAutonomousMobility,
    isDroneDeliveryInitiative({ title: ctx.title, objective: ctx.objective, expectedOutcomes: ctx.expectedOutcomes }),
  );
  const keyAssumptions = buildKeyAssumptions(
    ctx.constraints,
    ctx.existingSystems,
    totalInvestment,
    normalizedComplianceRequirements,
    ctx.title,
    ctx.objective,
    generatedDomainParameters,
    ctx.budgetIsAiSuggested,
    ctx.timeframeIsAiSuggested,
  );
  const publicValueScore = typeof governmentValue.score === 'number' ? governmentValue.score : null;
  const recommendations = buildCommercialPositionRecommendation(
    ctx.title,
    ctx.department,
    implementationMonths,
    ctx.integrationRequirements,
    normalizedComplianceRequirements,
    metrics,
    safeString(decision.verdict, ''),
    typeof governmentValue?.verdict === 'string' ? governmentValue.verdict : '',
    publicValueScore,
  );
  const conclusionSummary = safeString(decision.verdict, '') === 'DO_NOT_INVEST' && (publicValueScore ?? 0) >= 60
    ? `${ctx.organizationName} should treat ${ctx.title} as a strategic, stage-gated mobility program rather than a pure commercial investment. Proceed only through a controlled pilot, explicit executive risk acceptance, and measurable public-value checkpoints before wider scale-out.`
    : `${ctx.organizationName} has a credible case to proceed with ${ctx.title}, provided the program confirms the commercial assumptions, secures named delivery and benefits ownership, and maintains formal architecture, security, and compliance stage gates throughout implementation.`;

  businessCase.projectTitle = ctx.title;
  businessCase.title = ctx.title;
  businessCase.organizationName = ctx.organizationName;
  businessCase.department = ctx.department;
  businessCase.requestorName = ctx.requestorName;
  businessCase.businessObjective = ctx.objective;
  businessCase.expectedOutcomes = ctx.expectedOutcomes;
  businessCase.constraints = ctx.constraints;
  businessCase.integrationRequirements = ctx.integrationRequirements;
  businessCase.existingSystems = ctx.existingSystems;
  businessCase.complianceRequirements = normalizedComplianceRequirements;
  businessCase.riskFactors = ctx.riskFactors;
  businessCase.budgetProvenance = ctx.budgetProvenance;
  businessCase.timelineProvenance = ctx.timeframeProvenance;
  businessCase.planningAssumptionFlags = {
    budgetIsAiSuggested: ctx.budgetIsAiSuggested,
    timeframeIsAiSuggested: ctx.timeframeIsAiSuggested,
    officialBudgetApprovalProvided: !ctx.budgetIsAiSuggested && Boolean(ctx.budgetRange),
    officialTimelineProvided: !ctx.timeframeIsAiSuggested && Boolean(ctx.timeframe),
  };
  businessCase.scopeDefinition = buildScopeDefinitionFromDemandContext(ctx, implementationMonths);
  businessCase.alternativeSolutions = alternativeSolutions;
  businessCase.stakeholderAnalysis = stakeholderAnalysis;
  businessCase.kpis = kpis;
  businessCase.successCriteria = successCriteria.map((criterion) => ({
    criterion: criterion.criterion,
    target: criterion.target,
  }));
  businessCase.performanceTargets = successCriteria.map((criterion) => ({
    name: criterion.criterion,
    target: criterion.target,
    measurement: criterion.measurement,
  }));
  businessCase.measurementPlan = {
    cadence: 'Monthly KPI review with quarterly benefits realization updates',
    owners: [ctx.requestorName || 'Business sponsor', ctx.department || ctx.organizationName, `${ctx.organizationName} PMO / governance office`],
    kpis: kpis.map((kpi) => ({
      name: kpi.name,
      baseline: kpi.baseline,
      target: kpi.target,
      owner: ctx.department || ctx.organizationName,
    })),
  };
  businessCase.resourceRequirements = resourceRequirements;
  businessCase.keyAssumptions = keyAssumptions;
  businessCase.milestones = milestones;
  businessCase.keyMilestones = milestones;
  businessCase.timeline = {
    ...(businessCase.timeline && typeof businessCase.timeline === 'object' && !Array.isArray(businessCase.timeline)
      ? businessCase.timeline as Record<string, unknown>
      : {}),
    phases: implementationPhases,
    milestones,
  };
  businessCase.implementationTimeline = businessCase.timeline;
  businessCase.nextSteps = nextSteps;
  businessCase.totalCostEstimate = totalInvestment;
  businessCase.totalBenefitEstimate = metrics.totalBenefits;
  businessCase.roiPercentage = metrics.roi;
  businessCase.npvValue = metrics.npv;
  businessCase.paybackMonths = metrics.paybackMonths;
  // Propagate reconciled cost breakdowns to businessCase object
  if (insertPayload.implementationCosts) {
    businessCase.implementationCosts = insertPayload.implementationCosts;
  }
  if (insertPayload.operationalCosts) {
    businessCase.operationalCosts = insertPayload.operationalCosts;
  }
  if (insertPayload.tcoBreakdown) {
    businessCase.tcoBreakdown = insertPayload.tcoBreakdown;
  }
  businessCase.recommendations = recommendations;
  businessCase.conclusionSummary = conclusionSummary;

  const summaryPreview = {
    ...businessCase,
    organizationName: ctx.organizationName,
    department: ctx.department,
    projectTitle: ctx.title,
    computedFinancialModel: generatedFinancialModel,
  };
  businessCase.executiveSummary = buildExecutiveSummaryText(summaryPreview);

  insertPayload.executiveSummary = businessCase.executiveSummary;
  insertPayload.projectTitle = ctx.title;
  insertPayload.title = ctx.title;
  insertPayload.organizationName = ctx.organizationName;
  insertPayload.department = ctx.department;
  insertPayload.requestorName = ctx.requestorName;
  insertPayload.businessObjective = ctx.objective;
  insertPayload.expectedOutcomes = ctx.expectedOutcomes;
  insertPayload.constraints = ctx.constraints;
  insertPayload.integrationRequirements = ctx.integrationRequirements;
  insertPayload.existingSystems = ctx.existingSystems;
  insertPayload.complianceRequirements = normalizedComplianceRequirements;
  insertPayload.riskFactors = ctx.riskFactors;
  insertPayload.scopeDefinition = businessCase.scopeDefinition;
  insertPayload.alternativeSolutions = alternativeSolutions;
  insertPayload.stakeholderAnalysis = stakeholderAnalysis;
  insertPayload.kpis = kpis;
  insertPayload.successCriteria = businessCase.successCriteria;
  insertPayload.performanceTargets = businessCase.performanceTargets;
  insertPayload.measurementPlan = businessCase.measurementPlan;
  insertPayload.resourceRequirements = resourceRequirements;
  insertPayload.keyAssumptions = keyAssumptions;
  insertPayload.milestones = milestones;
  insertPayload.keyMilestones = milestones;
  insertPayload.timeline = businessCase.timeline;
  insertPayload.implementationTimeline = businessCase.timeline;
  insertPayload.nextSteps = nextSteps;
  insertPayload.recommendations = recommendations;
  insertPayload.conclusionSummary = conclusionSummary;
}

function buildDecisionBrainPayload(brainResult: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!brainResult) return null;
  const decision = brainResult.decision as Record<string, unknown> | undefined;
  return {
    decisionId: brainResult.decisionId,
    correlationId: brainResult.correlationId,
    status: brainResult.finalStatus,
    governance: decision?.policy,
    readiness: decision?.context,
  };
}

function logBrainError(brainError: unknown, reportId: string, decisionSpineId: string | undefined, generationMode: string): void {
  const errorMessage = brainError instanceof Error ? brainError.message : String(brainError);
  if (errorMessage.startsWith("Business case soft timeout after ")) {
    logger.warn("[Brain] Business case generation hit soft timeout; using stored advisory fallback", {
      reportId,
      decisionSpineId,
      generationMode,
      error: errorMessage,
    });
  } else {
    logger.error(`[Brain] Business case generation failed:`, errorMessage);
  }
}

function findBusinessCaseContentFromVersions(
  versions: Array<{ versionType?: string | null; versionData?: unknown; createdAt: Date | string }>,
): { content: Record<string, unknown> | null; qualityReport: QualityReport | null } {
  const bcVersions = versions
    .filter(v => v.versionType === 'business_case' || v.versionType === 'both' || !v.versionType)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const bcVersion of bcVersions) {
    if (bcVersion.versionData && isValidBusinessCaseData(bcVersion.versionData)) {
      const data = bcVersion.versionData as Record<string, unknown>;
      return {
        content: data,
        qualityReport: data?.qualityReport as QualityReport | null || null,
      };
    }
  }
  return { content: null, qualityReport: null };
}

function checkWasEditedAfterGeneration(dbRecordTyped: Record<string, unknown> | null): boolean {
  if (!dbRecordTyped) return false;
  if (!dbRecordTyped.lastUpdatedBy) return false;
  const generatedAt = dbRecordTyped.generatedAt instanceof Date ? dbRecordTyped.generatedAt : null;
  const lastUpdated = dbRecordTyped.lastUpdated instanceof Date ? dbRecordTyped.lastUpdated : null;
  if (!generatedAt || !lastUpdated) return false;
  return lastUpdated.getTime() - generatedAt.getTime() > 5_000;
}

function buildMissingDraftErrorReason(brainResult: Record<string, unknown> | null | undefined): string {
  return brainResult
    ? `Brain pipeline completed with status '${brainResult.finalStatus}' but did not produce a business case draft`
    : "Brain pipeline could not complete — AI engine unavailable";
}

async function persistOrUpdateBusinessCase(
  deps: BusinessCaseDeps,
  id: string,
  insertPayload: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const existingBusinessCase = await deps.businessCase.findByDemandReportId(id);
  if (existingBusinessCase) {
    return deps.businessCase.update(existingBusinessCase.id, {
      ...insertPayload,
      demandReportId: undefined,
    } as Record<string, unknown>);
  }
  return deps.businessCase.create(insertPayload);
}

async function getCreatorName(deps: BusinessCaseDeps, userId: string): Promise<string> {
  const creator = await deps.users.getUser(userId);
  return creator?.displayName || creator?.username || "System";
}

async function materializeBusinessCaseDraft(input: {
  deps: BusinessCaseDeps;
  reportId: string;
  demandReport: Record<string, unknown>;
  draft: Record<string, unknown>;
  brainResult: Record<string, unknown> | null | undefined;
  decisionSpineId: string | undefined;
  userId: string;
  createdByName?: string;
  clarificationsBypassed: boolean;
  totalClarificationQuestions: number;
  clarificationResponseCount: number;
  changesSummary: string;
  draftSource?: ResolvedBusinessCaseDraft["source"];
  createVersion?: boolean;
}): Promise<MaterializedBusinessCaseDraft> {
  const {
    deps,
    reportId,
    demandReport,
    draft,
    brainResult,
    decisionSpineId,
    userId,
    clarificationsBypassed,
    totalClarificationQuestions,
    clarificationResponseCount,
    changesSummary,
    draftSource = "pipeline",
    createVersion = true,
  } = input;

  const businessCase = normalizeBusinessCaseFields(attachArtifactProvenance(draft, brainResult));
  const insertPayload = buildInsertBusinessCaseFromArtifact({
    demandReportId: reportId,
    decisionSpineId: decisionSpineId || null,
    generatedBy: userId,
    artifact: businessCase,
  });

  if (draftSource === "stored_advisory" || draftSource === "advisory_synthesis") {
    insertPayload.generationMethod = "fallback_synthesis";
  }

  applyFinancialModel(deps, insertPayload, businessCase, demandReport, reportId);

  const qualityBrainContext = brainResult || (decisionSpineId
    ? await deps.brain.getFullDecisionWithLayers(decisionSpineId)
    : null);

  const qualityReport = buildQualityReportFromBusinessCase({
    businessCase,
    brainResult: qualityBrainContext,
    clarificationsBypassed,
    totalClarificationQuestions,
    clarificationResponseCount,
    computedFinancialModel: insertPayload.computedFinancialModel as Record<string, unknown> | null,
    demandReport,
  });
  insertPayload.qualityReport = qualityReport;

  const persistedBusinessCase = await persistOrUpdateBusinessCase(deps, reportId, insertPayload);
  let version: Record<string, unknown> | null = null;

  if (createVersion) {
    version = await createReportVersionSafely(deps.versions, reportId, {
      versionType: "business_case",
      status: "draft",
      createdBy: userId,
      createdByName: input.createdByName || await getCreatorName(deps, userId),
      versionData: { ...businessCase, qualityReport },
      changesSummary,
      decisionSpineId,
    });
  }

  return {
    businessCase,
    persistedBusinessCase,
    qualityReport,
    version,
  };
}

async function _materializeLatestBrainBusinessCaseArtifact(
  deps: BusinessCaseDeps,
  demandReportId: string,
  demandReport: Record<string, unknown>,
  userId: string,
): Promise<MaterializedBusinessCaseDraft | null> {
  const aiAnalysis = parseAiAnalysis(demandReport.aiAnalysis);
  const decisionSpineId = demandReport.decisionSpineId as string | undefined
    || (aiAnalysis?.decisionId as string | undefined)
    || (await deps.brain.findLatestDecisionByDemandReportId(demandReportId))?.id;

  if (!decisionSpineId) {
    return null;
  }

  try {
    const artifact = await deps.brain.getLatestDecisionArtifactVersion({
      decisionSpineId,
      artifactType: "BUSINESS_CASE",
    });
    const content = artifact?.content as Record<string, unknown> | undefined;

    if (!isViableBusinessCaseDraft(content) || !isValidBusinessCaseData(content)) {
      return null;
    }

    logger.warn("[GET business-case] Canonical business case missing; materializing latest Brain BUSINESS_CASE artifact", {
      demandReportId,
      decisionSpineId,
      artifactId: artifact?.artifactId,
      artifactVersionId: artifact?.artifactVersionId,
      version: artifact?.version,
    });

    return materializeBusinessCaseDraft({
      deps,
      reportId: demandReportId,
      demandReport,
      draft: content,
      brainResult: await deps.brain.getFullDecisionWithLayers(decisionSpineId),
      decisionSpineId,
      userId,
      clarificationsBypassed: true,
      totalClarificationQuestions: 0,
      clarificationResponseCount: 0,
      changesSummary: `Recovered business case from Brain artifact v${artifact?.version || 1}`,
      draftSource: "pipeline",
    });
  } catch (error) {
    logger.warn("[GET business-case] Failed to materialize Brain BUSINESS_CASE artifact", {
      demandReportId,
      decisionSpineId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

interface BrainExecutionResult {
  brainResult: Record<string, unknown> | null;
  resolvedDecisionSpineId: string | undefined;
}

async function executeBrainPipeline(
  deps: BusinessCaseDeps,
  brainInput: Record<string, unknown>,
  userId: string,
  orgId: string | undefined,
  decisionSpineId: string | undefined,
  generationMode: string,
): Promise<BrainExecutionResult> {
  const softTimeoutController = new AbortController();
  try {
    const canUseStoredFallback = generationMode === "prompt_on_fallback" && Boolean(decisionSpineId);
    const brainExecution = deps.brain.execute(
      "business_case",
      "business_case.generate",
      brainInput,
      userId,
      orgId,
      { decisionSpineId, abortSignal: softTimeoutController.signal }
    );

    const brainResult = canUseStoredFallback
      ? await executeBrainWithSoftTimeout(brainExecution, softTimeoutController)
      : await brainExecution;

    logger.info(`[Brain] Pipeline result: ${brainResult.finalStatus} (Decision: ${brainResult.decisionId})`);

    const resolvedDecisionSpineId = (decisionSpineId || brainResult.decisionId) as string | undefined;
    return { brainResult, resolvedDecisionSpineId };
  } catch (brainError) {
    logBrainError(brainError, brainInput.demandReportId as string, decisionSpineId, generationMode);
    return { brainResult: null, resolvedDecisionSpineId: decisionSpineId };
  }
}

async function recomputeFinancialModelIfNeeded(
  deps: BusinessCaseDeps,
  demandReportId: string,
  dbRecordTyped: Record<string, unknown>,
  dbSavedFinancials: Record<string, unknown>,
): Promise<void> {
  if (dbRecordTyped?.computedFinancialModel && hasCompleteFinancialModel(dbRecordTyped.computedFinancialModel)) {
    // Reconcile archetype: if the stored archetype disagrees with detectArchetype(), recompute
    const storedModel = dbRecordTyped.computedFinancialModel as Record<string, unknown>;
    const storedInputs = storedModel.inputs as Record<string, unknown> | undefined;
    const storedArchetype = typeof storedInputs?.archetype === 'string' ? storedInputs.archetype : '';
    if (storedArchetype) {
      const demandReportForCheck = await deps.reports.findById(demandReportId);
      if (demandReportForCheck) {
        const drTyped = demandReportForCheck as Record<string, unknown>;
        const correctArchetype = deps.financial.detectArchetype({
          projectName: (drTyped.suggestedProjectName as string) || '',
          projectDescription: (drTyped.projectDescription as string) || (drTyped.businessObjective as string) || '',
          organization: (drTyped.submittingOrganization as string) || (drTyped.organizationName as string) || '',
          objectives: (drTyped.businessObjective as string) || '',
          problemStatement: (drTyped.problemStatement as string) || '',
        });
        if (correctArchetype !== storedArchetype) {
          logger.info('[GET business-case] Archetype mismatch, recomputing:', { stored: storedArchetype, correct: correctArchetype });
          try {
            // Strip stale domain parameters and investment from the old archetype
            // so buildInputsFromData starts from clean defaults for the correct archetype
            const cleanedRecord: Record<string, unknown> = {
              ...dbRecordTyped,
              domainParameters: null,
              totalCostEstimate: null,
              computedFinancialModel: null,
              aiRecommendedBudget: null,
            };
            const financialInputs = deps.financial.buildInputsFromData(
              cleanedRecord,
              drTyped as Record<string, unknown>,
            ) as unknown as FinancialInputs;
            const unifiedModel = deps.financial.compute(financialInputs as unknown as Record<string, unknown>) as unknown as UnifiedFinancialOutput;
            dbSavedFinancials.computedFinancialModel = unifiedModel;
            // Also update the response-level domain parameters and investment to match the corrected model
            const correctedInputs = (unifiedModel as unknown as Record<string, unknown>).inputs as Record<string, unknown> | undefined;
            if (correctedInputs) {
              dbSavedFinancials.domainParameters = correctedInputs.domainParameters;
              dbSavedFinancials.totalCostEstimate = correctedInputs.totalInvestment;
            }
            // Persist the corrected model back to the DB to avoid re-reconciliation on every GET
            const existingBC = await deps.businessCase.findByDemandReportId(demandReportId);
            if (existingBC) {
              await deps.businessCase.update((existingBC as Record<string, unknown>).id as string, {
                computedFinancialModel: unifiedModel,
                domainParameters: correctedInputs?.domainParameters ?? null,
                totalCostEstimate: correctedInputs?.totalInvestment ?? null,
              } as Record<string, unknown>);
              logger.info('[GET business-case] Persisted corrected archetype model to DB:', { archetype: correctArchetype });
            }
            return;
          } catch (recomputeError) {
            logger.error('[GET business-case] Archetype recompute failed:', recomputeError);
          }
        }
      }
    }
    dbSavedFinancials.computedFinancialModel = dbRecordTyped.computedFinancialModel;
    return;
  }
  // computed_financial_model is NULL — recompute from demand context.
  // Do NOT seed with the raw total_cost_estimate because it may be an unvalidated AI draft value.
  // Let buildInputsFromData estimate from demand context (budget range, archetype, domain parameters).
  const demandReportForInputs = await deps.reports.findById(demandReportId);
  if (!demandReportForInputs) return;
  try {
    const financialSource = {
      ...dbRecordTyped,
      // Null out raw AI values so the financial engine re-estimates from demand context
      totalCostEstimate: null,
      aiRecommendedBudget: null,
      financialAssumptions: dbSavedFinancials.financialAssumptions ?? dbRecordTyped?.financialAssumptions,
      domainParameters: dbSavedFinancials.domainParameters ?? dbRecordTyped?.domainParameters,
    };
    const financialInputs = deps.financial.buildInputsFromData(
      financialSource as Record<string, unknown>,
      demandReportForInputs as Record<string, unknown>,
    ) as unknown as FinancialInputs;
    const unifiedModel = deps.financial.compute(financialInputs as unknown as Record<string, unknown>) as unknown as UnifiedFinancialOutput;
    dbSavedFinancials.computedFinancialModel = unifiedModel;

    // Persist the recomputed model and corrected totalCostEstimate so subsequent GETs are stable
    const correctedInputs = (unifiedModel as unknown as Record<string, unknown>).inputs as Record<string, unknown> | undefined;
    const correctedInvestment = typeof correctedInputs?.totalInvestment === 'number' ? correctedInputs.totalInvestment : null;
    const existingBC = await deps.businessCase.findByDemandReportId(demandReportId);
    if (existingBC) {
      await deps.businessCase.update((existingBC as Record<string, unknown>).id as string, {
        computedFinancialModel: unifiedModel,
        totalCostEstimate: correctedInvestment,
        domainParameters: correctedInputs?.domainParameters ?? null,
      } as Record<string, unknown>);
      // Update in-memory financials to match persisted values
      if (correctedInvestment != null) {
        dbSavedFinancials.totalCostEstimate = correctedInvestment;
      }
      logger.info('[GET business-case] Persisted recomputed financial model to DB', {
        totalInvestment: correctedInvestment,
      });
    }
  } catch (calcError) {
    logger.error('[GET business-case] Error computing fallback unified model:', calcError);
  }
}

/**
 * Background auto-generation entry point — called by the event bus when a demand transitions to
 * "acknowledged". Bypasses clarifications and HTTP auth; runs the full Brain pipeline directly.
 * Clears the `businessCaseAutoGenerating` flag in aiAnalysis once complete.
 */
export async function runAutoBusinessCaseGeneration(storage: DemandStorageSlice, reportId: string, userId: string): Promise<void> {
  const allDeps = buildDemandDeps(storage);
  const deps: BusinessCaseDeps = allDeps;

  // Cost gate: skip if business case already exists
  const cached = await checkCostGate(deps, reportId);
  if (cached) {
    logger.info(`[AutoBC] Business case already exists for ${reportId}, clearing flag`);
    const report = await deps.reports.findById(reportId);
    const aiAnalysis = parseAiAnalysis((report as Record<string, unknown>)?.aiAnalysis);
    await deps.reports.update(reportId, {
      aiAnalysis: { ...aiAnalysis, businessCaseAutoGenerating: false, businessCaseAutoGenerateCompleted: true },
    } as Record<string, unknown>);
    return;
  }

  const demandReport = await deps.reports.findById(reportId);
  if (!demandReport) {
    logger.warn(`[AutoBC] Demand report ${reportId} not found, skipping`);
    return;
  }

  const aiAnalysis = parseAiAnalysis((demandReport as Record<string, unknown>)?.aiAnalysis);

  try {
    const decisionSpineId = (demandReport.decisionSpineId as string | undefined)
      || (aiAnalysis?.decisionId as string | undefined)
      || (await deps.brain.findLatestDecisionByDemandReportId(reportId))?.id;

    const brainInput = {
      demandReportId: reportId,
      projectName: demandReport.suggestedProjectName,
      organizationName: demandReport.organizationName,
      requestorName: demandReport.requestorName,
      businessObjective: demandReport.businessObjective,
      department: demandReport.department,
      budgetRange: demandReport.budgetRange,
      ...getDemandClassificationFields(demandReport as Record<string, unknown>),
      clarificationsBypassed: true,
      intent: `Auto-generate business case for acknowledged demand: ${demandReport.suggestedProjectName || reportId}`,
    };

    logger.info(`[AutoBC] Starting background business case generation for ${reportId}`);

    const { brainResult, resolvedDecisionSpineId } = await executeBrainPipeline(
      deps,
      brainInput,
      userId,
      undefined,
      decisionSpineId,
      "prompt_on_fallback",
    );

    if (resolvedDecisionSpineId && resolvedDecisionSpineId !== demandReport.decisionSpineId) {
      await deps.reports.update(reportId, { decisionSpineId: resolvedDecisionSpineId });
    }

    let effectiveBrainResult: Record<string, unknown> | null | undefined = brainResult as Record<string, unknown> | null | undefined;
    let effectiveDecisionSpineId = resolvedDecisionSpineId;
    let resolvedDraft = await resolveBusinessCaseDraft(
      deps,
      demandReport as Record<string, unknown>,
      effectiveDecisionSpineId,
      effectiveBrainResult,
    );

    // If a reused/stale spine cannot provide a BUSINESS_CASE artifact, retry once on a fresh execution path.
    if (!resolvedDraft.draft && decisionSpineId) {
      logger.warn(`[AutoBC] No draft on existing spine ${decisionSpineId}; retrying with fresh execution context`, {
        reportId,
      });

      const retryExecution = await executeBrainPipeline(
        deps,
        brainInput,
        userId,
        undefined,
        undefined,
        "prompt_on_fallback",
      );

      effectiveBrainResult = retryExecution.brainResult as Record<string, unknown> | null | undefined;
      effectiveDecisionSpineId = retryExecution.resolvedDecisionSpineId;

      if (effectiveDecisionSpineId && effectiveDecisionSpineId !== demandReport.decisionSpineId) {
        await deps.reports.update(reportId, { decisionSpineId: effectiveDecisionSpineId });
      }

      resolvedDraft = await resolveBusinessCaseDraft(
        deps,
        demandReport as Record<string, unknown>,
        effectiveDecisionSpineId,
        effectiveBrainResult,
      );
    }

    if (!resolvedDraft.draft) {
      logger.error(`[AutoBC] No draft produced for ${reportId}, brain status: ${effectiveBrainResult?.finalStatus}`);
      await deps.reports.update(reportId, {
        aiAnalysis: { ...aiAnalysis, businessCaseAutoGenerating: false, businessCaseAutoGenerateError: "no_draft" },
      } as Record<string, unknown>);
      return;
    }

    const rawBusinessCase: Record<string, unknown> = resolvedDraft.draft;
    // If the pipeline is blocked on HITL/PMO approval, do NOT write a fallback BC.
    // Instead, hold the BC in a "pending_approval" state so the UI can show a proper
    // "Awaiting PMO Approval" screen and trigger real generation after approval is granted.
    const brainFinalStatus = (effectiveBrainResult as Record<string, unknown> | null | undefined)?.finalStatus;
    const isPendingApproval = brainFinalStatus === "pending_approval";
    const autoIsFallback = resolvedDraft.source === "advisory_synthesis" || resolvedDraft.source === "stored_advisory";

    if (isPendingApproval) {
      logger.info(`[AutoBC] Brain returned pending_approval for ${reportId} — holding BC generation until PMO approves`, {
        decisionSpineId: effectiveDecisionSpineId,
      });
      const freshReport = await deps.reports.findById(reportId);
      const freshAnalysis = parseAiAnalysis((freshReport as Record<string, unknown>)?.aiAnalysis);
      await deps.reports.update(reportId, {
        aiAnalysis: {
          ...freshAnalysis,
          businessCaseAutoGenerating: false,
          businessCasePendingApproval: true,
          businessCasePendingApprovalDecisionId: effectiveDecisionSpineId || freshAnalysis?.decisionId || null,
        },
      } as Record<string, unknown>);
      return;
    }

    const materialized = await materializeBusinessCaseDraft({
      deps,
      reportId,
      demandReport: demandReport as Record<string, unknown>,
      draft: rawBusinessCase,
      brainResult: effectiveBrainResult,
      decisionSpineId: effectiveDecisionSpineId,
      userId,
      clarificationsBypassed: true,
      totalClarificationQuestions: 0,
      clarificationResponseCount: 0,
      changesSummary: autoIsFallback
        ? "Business case auto-generated from Brain advisory fallback"
        : "Business case auto-generated from acknowledged demand report",
      draftSource: resolvedDraft.source,
    });

    logger.info(`[AutoBC] Background business case generation completed for ${reportId}`, {
      businessCaseId: materialized.persistedBusinessCase?.id,
      versionId: materialized.version?.id,
    });

    // Clear the auto-generating flag
    const freshReport = await deps.reports.findById(reportId);
    const freshAnalysis = parseAiAnalysis((freshReport as Record<string, unknown>)?.aiAnalysis);
    await deps.reports.update(reportId, {
      aiAnalysis: { ...freshAnalysis, businessCaseAutoGenerating: false, businessCaseAutoGenerateCompleted: true },
    } as Record<string, unknown>);
  } catch (err) {
    logger.error(`[AutoBC] Background business case generation failed for ${reportId}:`, err);
    const freshReport2 = await deps.reports.findById(reportId);
    const freshAnalysis2 = parseAiAnalysis((freshReport2 as Record<string, unknown>)?.aiAnalysis);
    try {
      await deps.reports.update(reportId, {
        aiAnalysis: { ...freshAnalysis2, businessCaseAutoGenerating: false, businessCaseAutoGenerateError: "exception" },
      } as Record<string, unknown>);
    } catch {
      // best-effort cleanup
    }
  }
}

export function createDemandReportsBusinessCaseRoutes(storage: DemandStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const allDeps = buildDemandDeps(storage);
  const deps: BusinessCaseDeps = allDeps;

  // Helper: transform raw clarification items into grouped-by-domain format for the UI
  function transformClarifications(rawClarifications: Record<string, unknown>[]) {
    const domainMap = new Map<string, { domain: string; questions: { domain: string; questionId: number; question: string; context?: string }[] }>();
    for (const item of rawClarifications) {
      const domain = safeString(item.domain ?? item.field, 'General');
      if (!domainMap.has(domain)) {
        domainMap.set(domain, { domain, questions: [] });
      }
      const entry = domainMap.get(domain)!;
      let contextValue: string | undefined;
      if (typeof item.reason === 'string') {
        contextValue = item.reason;
      } else if (typeof item.context === 'string') {
        contextValue = item.context;
      }
      entry.questions.push({
        domain,
        questionId: entry.questions.length,
        question: safeString(item.question ?? item.text, ''),
        context: contextValue,
      });
    }
    return Array.from(domainMap.values());
  }

  const FIELD_PROMPTS: Record<string, { domain: string; question: string; context?: string }> = {
    department: {
      domain: "Ownership",
      question: "Which department will own this initiative and lead delivery?",
      context: "Layer 4 marked ownership context as incomplete.",
    },
    currentChallenges: {
      domain: "Current State",
      question: "What is happening today, and what operational pain or service issue is driving this request?",
      context: "Needed to ground the business case in the present-state problem.",
    },
    expectedOutcomes: {
      domain: "Outcomes",
      question: "What concrete outcomes should this initiative deliver?",
      context: "Needed to anchor value and benefits before synthesis.",
    },
    successCriteria: {
      domain: "Success Measures",
      question: "How will success be measured once this initiative is delivered?",
      context: "Needed so the draft can define measurable success criteria.",
    },
    budgetRange: {
      domain: "Resources",
      question: "What budget range or funding envelope should planning assume?",
      context: "Needed to shape delivery options and financial framing.",
    },
    timeframe: {
      domain: "Delivery Timeline",
      question: "What target timeline or delivery horizon should this initiative work toward?",
      context: "Needed to shape planning, phasing, and urgency.",
    },
    stakeholders: {
      domain: "Stakeholders",
      question: "Which stakeholders, sponsors, or impacted teams must be considered?",
      context: "Needed to understand ownership and change impact.",
    },
    existingSystems: {
      domain: "Technology Context",
      question: "Which current systems, platforms, or processes does this initiative depend on or replace?",
      context: "Needed to ground architecture and integration assumptions.",
    },
    integrationRequirements: {
      domain: "Technology Context",
      question: "What integrations or interfaces are required for this initiative to succeed?",
      context: "Needed to define delivery scope and dependencies.",
    },
    complianceRequirements: {
      domain: "Governance",
      question: "What compliance, regulatory, or policy requirements must this initiative satisfy?",
      context: "Needed before governance-aware synthesis.",
    },
    riskFactors: {
      domain: "Risk",
      question: "What major risks, dependencies, or constraints should be factored into the draft?",
      context: "Needed to build a credible risk posture in the business case.",
    },
  };

  function buildClarificationsFromMissingFields(
    missingFields: string[],
    requiredInfo?: Array<Record<string, unknown>>,
  ) {
    const requiredInfoMap = new Map<string, Record<string, unknown>>();
    for (const item of requiredInfo || []) {
      const field = safeString(item.field, "");
      if (field) {
        requiredInfoMap.set(field, item);
      }
    }

    return transformClarifications(
      missingFields.map((field) => {
        const prompt = FIELD_PROMPTS[field] || {
          domain: "Completeness",
          question: `Please provide ${field} to complete the business case context.`,
          context: "Derived from Layer 4 completeness review.",
        };
        const info = requiredInfoMap.get(field);
        return {
          field,
          domain: prompt.domain,
          question: typeof info?.description === "string" && info.description.trim().length > 0
            ? info.description
            : prompt.question,
          context: typeof info?.description === "string" && info.description.trim().length > 0
            ? `Layer 4 required info: ${info.description}`
            : prompt.context,
        };
      }),
    );
  }

  function buildClarificationsFromDemandReport(demandReport: Record<string, unknown>) {
    const candidateFields = Object.keys(FIELD_PROMPTS);
    const missingFields = candidateFields.filter((field) => !hasMeaningfulValue(demandReport[field]));
    const clarifications = buildClarificationsFromMissingFields(missingFields);
    const completenessScore = Math.round(((candidateFields.length - missingFields.length) / candidateFields.length) * 100);
    return {
      clarifications,
      completenessScore,
      needsClarifications: clarifications.length > 0,
    };
  }

  async function resolveClarificationGate(
    reportId: string,
    demandReport: Record<string, unknown>,
    _userId: string,
    _force = false,
  ): Promise<{
    clarifications: ReturnType<typeof transformClarifications>;
    completenessScore: number | null;
    needsClarifications: boolean;
    decisionBrain: { decisionId: string | undefined; correlationId: string | null; status: string };
    cached: boolean;
  }> {
    const decisionSpineId = demandReport.decisionSpineId as string | undefined
      || (demandReport.aiAnalysis as Record<string, unknown> | null)?.decisionId as string | undefined
      || (await deps.brain.findLatestDecisionByDemandReportId(reportId))?.id;

    if (decisionSpineId) {
      const fullDecision = await deps.brain.getFullDecisionWithLayers(decisionSpineId);
      const context = (fullDecision?.context || {}) as Record<string, unknown>;
      const missingFields = Array.isArray(context.missingFields)
        ? context.missingFields.map(String)
        : [];
      const requiredInfo = Array.isArray(context.requiredInfo)
        ? context.requiredInfo as Array<Record<string, unknown>>
        : undefined;
      const completenessScore = resolveCompletenessScore(context.completenessScore);

      if (missingFields.length > 0 || completenessScore !== null) {
        const clarifications = buildClarificationsFromMissingFields(missingFields, requiredInfo);
        const decisionRecord = typeof fullDecision?.decision === "object" && fullDecision.decision !== null
          ? fullDecision.decision as Record<string, unknown>
          : {};
        return {
          clarifications,
          completenessScore,
          needsClarifications: clarifications.length > 0,
          decisionBrain: {
            decisionId: decisionSpineId,
            correlationId: null,
            status: typeof decisionRecord.status === "string" ? decisionRecord.status : "context_ready",
          },
          cached: true,
        };
      }
    }

    const fallback = buildClarificationsFromDemandReport(demandReport);
    return {
      clarifications: fallback.clarifications,
      completenessScore: fallback.completenessScore,
      needsClarifications: fallback.needsClarifications,
      decisionBrain: {
        decisionId: decisionSpineId,
        correlationId: null,
        status: decisionSpineId ? "context_pending" : "local_fallback",
      },
      cached: false,
    };
  }

  // POST /:id/detect-clarifications - Phase 1: Detect missing information
  // COST OPTIMIZATION: Checks for cached clarifications BEFORE calling the Brain pipeline.
  // If clarifications were already detected and stored as a BUSINESS_CASE_CLARIFICATIONS
  // artifact on the decision spine, return them directly — no external AI call needed.
  router.post("/:id/detect-clarifications", auth.requireAuth, auth.requirePermission("business-case:generate"), asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const { force = false } = req.body || {};

    const demandReport = await deps.reports.findById(id);
    if (!demandReport) {
      return res.status(404).json({ success: false, error: "Demand report not found" });
    }
    const userId = req.session.userId!;
    const clarificationGate = await resolveClarificationGate(id, demandReport as Record<string, unknown>, userId, force);

    res.json({
      success: true,
      cached: clarificationGate.cached,
      clarifications: clarificationGate.clarifications,
      completenessScore: clarificationGate.completenessScore,
      needsClarifications: clarificationGate.needsClarifications,
      decisionBrain: clarificationGate.decisionBrain,
    });
  }));

  // POST /:id/generate-business-case - Phase 2: Generate business case (with optional clarifications)
  // COST OPTIMIZATION: If a valid business case already exists and force=false,
  // return it immediately without calling the Brain pipeline.
  router.post("/:id/generate-business-case", auth.requireAuth, auth.requirePermission("business-case:generate"), validateBody(generateBusinessCaseSchema), asyncHandler(async (req, res) => {

    const { id } = req.params as { id: string };
    const {
      clarificationResponses = [],
      clarificationsBypassed = false,
      totalClarificationQuestions = 0,
      generationMode = 'prompt_on_fallback',
      force: explicitForce = false,
      forceRegenerate = false,
    } = req.body;
    const force = explicitForce || forceRegenerate;

    const demandReport = await deps.reports.findById(id);
    if (!demandReport) {
      return res.status(404).json({ success: false, error: "Demand report not found" });
    }

    // ── COST GATE: If a BC already exists and this isn't an explicit re-generate, return it ──
    const cachedResponse = force ? null : await checkCostGate(deps, id);
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    const userId = req.session.userId!;

    const needsClarificationCheck = !clarificationsBypassed && clarificationResponses.length === 0;
    if (needsClarificationCheck) {
      const clarificationGate = await resolveClarificationGate(id, demandReport as Record<string, unknown>, userId);
      if (clarificationGate.needsClarifications) {
        return res.status(409).json({
          success: false,
          error: "Additional context is required before business case generation.",
          requiresClarifications: true,
          clarifications: clarificationGate.clarifications,
          completenessScore: clarificationGate.completenessScore,
          decisionBrain: clarificationGate.decisionBrain,
        });
      }
    }

    // ========== COREVIA BRAIN PIPELINE ==========
    const responsesForBrain = clarificationResponses.length > 0 ? clarificationResponses : undefined;
    const brainInput = {
      demandReportId: id,
      projectName: demandReport.suggestedProjectName,
      organizationName: demandReport.organizationName,
      requestorName: demandReport.requestorName,
      businessObjective: demandReport.businessObjective,
      department: demandReport.department,
      budgetRange: demandReport.budgetRange,
      ...getDemandClassificationFields(demandReport as Record<string, unknown>),
      clarificationResponses: responsesForBrain,
      clarificationsBypassed,
      intent: `Generate business case for: ${demandReport.suggestedProjectName || id}`,
    };

    const demandDecisionSpineId = demandReport.decisionSpineId as string | undefined;
    const decisionSpineId = demandDecisionSpineId
      || (demandReport.aiAnalysis as Record<string, unknown> | null)?.decisionId as string | undefined
      || (await deps.brain.findLatestDecisionByDemandReportId(id))?.id;

    // ── ARCHITECTURAL GATE: Approval is a property of the spine, not of generation ──
    // Approvals are evaluated once at demand intake (executeDemandCreationPipeline) and
    // again whenever a Layer-7 gate is reopened. The Generate-BC click must NEVER re-run
    // Layer 7 from scratch and decide pending again — that produces ghost "pending" states
    // and 4-minute soft-timeout cycles. If the spine already has a pending approval, hold
    // the BC generation here and surface the awaiting-PMO state to the client immediately.
    let parentDemandApproved = false;
    if (decisionSpineId) {
      try {
        const parentApproval = await resolveParentApprovalState(deps.brain, decisionSpineId, demandReport);
        if (parentApproval.kind === "pending") {
          logger.info("[Generate BC] Spine has pending Layer-7 approval — short-circuiting (no pipeline rerun)", {
            reportId: id,
            decisionSpineId,
            approvalId: parentApproval.approvalId,
          });
          const currentReport = await deps.reports.findById(id);
          const currentAiAnalysis = parseAiAnalysis((currentReport as Record<string, unknown>)?.aiAnalysis);
          await deps.reports.update(id, {
            aiAnalysis: {
              ...currentAiAnalysis,
              businessCaseAutoGenerating: false,
              businessCasePendingApproval: true,
              businessCasePendingApprovalDecisionId: decisionSpineId,
            },
          } as Record<string, unknown>);
          return res.json({
            success: false,
            requiresApproval: true,
            approvalDecisionId: decisionSpineId,
            approvalId: parentApproval.approvalId,
            message: "Business case generation is awaiting PMO approval. Generation will run automatically once approved.",
          });
        }
        // Inheritance: when the parent demand spine is already APPROVED, BC generation
        // is a derivative artifact under that governance — Layer 7 must NOT re-litigate
        // HITL on this child decision. Pass an explicit inheritance flag downstream.
        if (parentApproval.kind === "approved") {
          parentDemandApproved = true;
          logger.info("[Generate BC] Parent demand spine already approved — BC will inherit governance (skip L7 HITL rerun)", {
            reportId: id,
            decisionSpineId,
            approvalId: parentApproval.approvalId,
          });
        }
      } catch (approvalProbeErr) {
        logger.warn("[Generate BC] Could not probe existing approval state — proceeding with full pipeline", {
          reportId: id,
          decisionSpineId,
          error: approvalProbeErr instanceof Error ? approvalProbeErr.message : String(approvalProbeErr),
        });
      }
    }

    // Inject the inheritance flag into brainInput so Layer 7 can honor it.
    if (parentDemandApproved) {
      (brainInput as Record<string, unknown>).parentDemandApproved = true;
      (brainInput as Record<string, unknown>).parentDecisionSpineId = decisionSpineId;
    }

    // Layer 5 gate removed — the detect-clarifications phase already ran through
    // the full 8-layer pipeline on this spine, proving the demand pipeline completed.

    logger.info(`\n========== COREVIA BRAIN: Business Case Generation ==========`);

    const { brainResult, resolvedDecisionSpineId } = await executeBrainPipeline(
      deps,
      brainInput,
      userId,
      getAuthenticatedOrganizationId(req),
      decisionSpineId,
      generationMode,
    );

    if (resolvedDecisionSpineId && resolvedDecisionSpineId !== demandReport.decisionSpineId) {
      await deps.reports.update(id, { decisionSpineId: resolvedDecisionSpineId });
    }

    let effectiveBrainResult: Record<string, unknown> | null | undefined = brainResult as Record<string, unknown> | null | undefined;
    let effectiveDecisionSpineId = resolvedDecisionSpineId;
    let resolvedDraft = await resolveBusinessCaseDraft(
      deps,
      demandReport as Record<string, unknown>,
      effectiveDecisionSpineId,
      effectiveBrainResult,
    );
    let pipelineDraft = resolvedDraft.draft;

    // Recovery path: if the existing spine has no BUSINESS_CASE artifact, retry once without spine reuse.
    if (!pipelineDraft && decisionSpineId) {
      logger.warn("[Generate BC] No BUSINESS_CASE draft on existing spine, retrying with fresh execution context", {
        reportId: id,
        existingDecisionSpineId: decisionSpineId,
      });

      const retryExecution = await executeBrainPipeline(
        deps,
        brainInput,
        userId,
        getAuthenticatedOrganizationId(req),
        undefined,
        generationMode,
      );

      effectiveBrainResult = retryExecution.brainResult as Record<string, unknown> | null | undefined;
      effectiveDecisionSpineId = retryExecution.resolvedDecisionSpineId;

      resolvedDraft = await resolveBusinessCaseDraft(
        deps,
        demandReport as Record<string, unknown>,
        effectiveDecisionSpineId,
        effectiveBrainResult,
      );
      pipelineDraft = resolvedDraft.draft;

      if (effectiveDecisionSpineId && effectiveDecisionSpineId !== demandReport.decisionSpineId) {
        await deps.reports.update(id, { decisionSpineId: effectiveDecisionSpineId });
      }
    }

    if (!pipelineDraft) {
      const reason = buildMissingDraftErrorReason(effectiveBrainResult);

      logger.error("[Generate BC] Missing BUSINESS_CASE draft in Brain result", {
        reportId: id,
        decisionSpineId: effectiveDecisionSpineId,
        brainStatus: effectiveBrainResult?.finalStatus,
        draftSource: resolvedDraft.source,
        advisoryKeys: resolvedDraft.advisoryKeys,
        generatedArtifactKeys: resolvedDraft.generatedArtifactKeys,
      });

      if (isResponseClosed(res)) {
        logger.warn("[Generate BC] Request already closed before error response could be returned", {
          reportId: id,
          decisionSpineId: resolvedDecisionSpineId,
          timedOut: Boolean(res.locals.requestTimedOut),
        });
        return;
      }

      // No silent fallback: surface a structured 409 BLOCKED so the UI can render
      // a professional dialog with reasons + retry/approval/template actions.
      const acceptFallback = isAcceptFallbackOptIn(req as unknown as Record<string, unknown>);
      if (
        shouldBlockGeneration({
          brainResult: effectiveBrainResult as unknown as Record<string, unknown> | null | undefined,
          draftSource: resolvedDraft.source,
          hasPipelineDraft: false,
        }) &&
        !acceptFallback
      ) {
        const blocked = buildBlockedGenerationResponse({
          artifact: "BUSINESS_CASE",
          reportId: id,
          decisionSpineId: effectiveDecisionSpineId,
          brainResult: effectiveBrainResult as unknown as Record<string, unknown> | null | undefined,
          draftSource: resolvedDraft.source,
          fallbackAvailable: false,
        });
        logger.info("[Generate BC] Generation blocked — surfaced structured response", {
          reportId: id,
          decisionSpineId: effectiveDecisionSpineId,
          brainStatus: effectiveBrainResult?.finalStatus,
          reasons: blocked.reasons.map((r) => r.code),
        });
        return res.status(409).json(blocked);
      }

      return res.status(500).json({
        success: false,
        error: reason,
        details: { decisionSpineId: effectiveDecisionSpineId, brainStatus: effectiveBrainResult?.finalStatus, generationMode },
      });
    }

    // Pipeline produced *something*, but it may be advisory_synthesis / stored_advisory.
    // If the caller did not explicitly opt in to a fallback, block and surface reasons.
    {
      const acceptFallback = isAcceptFallbackOptIn(req as unknown as Record<string, unknown>);
      const isFallbackOnly =
        resolvedDraft.source === "stored_advisory" || resolvedDraft.source === "advisory_synthesis";
      const isPendingApproval = effectiveBrainResult?.finalStatus === "pending_approval";
      if ((isFallbackOnly || isPendingApproval) && !acceptFallback && !isPendingApproval) {
        // (pending_approval is handled below with its own dedicated holding state.)
        const blocked = buildBlockedGenerationResponse({
          artifact: "BUSINESS_CASE",
          reportId: id,
          decisionSpineId: effectiveDecisionSpineId,
          brainResult: effectiveBrainResult as unknown as Record<string, unknown> | null | undefined,
          draftSource: resolvedDraft.source,
          fallbackAvailable: true,
        });
        logger.info("[Generate BC] Generation produced only fallback source — surfaced structured response", {
          reportId: id,
          decisionSpineId: effectiveDecisionSpineId,
          brainStatus: effectiveBrainResult?.finalStatus,
          draftSource: resolvedDraft.source,
          reasons: blocked.reasons.map((r) => r.code),
        });
        return res.status(409).json(blocked);
      }
    }

    // No template fallback: only real AI output is allowed.
    const rawBusinessCase: Record<string, unknown> = pipelineDraft;

    const isFallbackSource = resolvedDraft.source === "stored_advisory" || resolvedDraft.source === "advisory_synthesis";
    const isPendingApprovalFallback = (effectiveBrainResult as Record<string, unknown> | null | undefined)?.finalStatus === "pending_approval";
    if (isFallbackSource || isPendingApprovalFallback) {
      logger.info("[Generate BC] Recovered BUSINESS_CASE draft from fallback source", {
        reportId: id,
        decisionSpineId: effectiveDecisionSpineId,
        brainStatus: effectiveBrainResult?.finalStatus,
        draftSource: resolvedDraft.source,
      });
    }

    // When the Brain pipeline is blocked on PMO/HITL approval, do NOT write a fallback BC.
    // Hold the BC in pending_approval state. Generation will run automatically after approval.
    if (isPendingApprovalFallback) {
      logger.info("[Generate BC] Pipeline returned pending_approval — holding BC generation until PMO approves", {
        reportId: id,
        decisionSpineId: effectiveDecisionSpineId,
      });
      const currentReport = await deps.reports.findById(id);
      const currentAiAnalysis = parseAiAnalysis((currentReport as Record<string, unknown>)?.aiAnalysis);
      await deps.reports.update(id, {
        aiAnalysis: {
          ...currentAiAnalysis,
          businessCaseAutoGenerating: false,
          businessCasePendingApproval: true,
          businessCasePendingApprovalDecisionId: effectiveDecisionSpineId || currentAiAnalysis?.decisionId || null,
        },
      } as Record<string, unknown>);
      return res.json({
        success: false,
        requiresApproval: true,
        approvalDecisionId: effectiveDecisionSpineId,
        message: "Business case generation is awaiting PMO approval. Generation will run automatically once approved.",
      });
    }

    if (isFallbackSource) {
      logger.info("[Generate BC] Recovered BUSINESS_CASE draft from advisory fallback source", {
        reportId: id,
        decisionSpineId: effectiveDecisionSpineId,
        draftSource: resolvedDraft.source,
      });
    }

    // Normalize AI field names → UI expected schema
    const materialized = await materializeBusinessCaseDraft({
      deps,
      reportId: id,
      demandReport: demandReport as Record<string, unknown>,
      draft: rawBusinessCase,
      brainResult: effectiveBrainResult,
      decisionSpineId: effectiveDecisionSpineId,
      userId,
      clarificationsBypassed,
      totalClarificationQuestions,
      clarificationResponseCount: clarificationResponses.length,
      changesSummary: isFallbackSource
        ? "Initial business case generated from Brain advisory fallback"
        : "Initial business case generated from demand report",
      draftSource: resolvedDraft.source,
    });
    const { businessCase, persistedBusinessCase, qualityReport } = materialized;
    logger.info('[Business Case] Field normalization applied. Keys:', Object.keys(businessCase).join(', '));
    logger.info('[Business Case] Normalized fields check:', {
      hasSolutionOverview: !!businessCase.solutionOverview,
      hasBackgroundContext: !!businessCase.backgroundContext,
      hasIdentifiedRisks: Array.isArray(businessCase.identifiedRisks),
      hasImplementationPhases: Array.isArray(businessCase.implementationPhases),
      hasTotalCostEstimate: businessCase.totalCostEstimate !== undefined,
      hasRecommendations: !!businessCase.recommendations,
      hasStakeholderAnalysis: Array.isArray(businessCase.stakeholderAnalysis),
      hasRoiPercentage: businessCase.roiPercentage !== undefined,
    });
    const responseBusinessCase = normalizeBusinessCaseFields({
      ...businessCase,
      ...(persistedBusinessCase || {}),
    });
    enhanceResponseWithComputedModel(responseBusinessCase, false, (inputs) => deps.financial.compute(inputs as unknown as Record<string, unknown>));

    // Governance: BUSINESS_CASE drafts are not persisted as decision artifacts until explicitly approved.

    logger.info(`[Business Case] Created initial draft version: ${materialized.version?.id} with qualityReport (score: ${qualityReport.overallScore})`);

    const responseData: Record<string, unknown> = {
      success: true,
      data: {
        ...responseBusinessCase,
        id: persistedBusinessCase?.id,
        demandReportId: id,
        decisionSpineId: resolvedDecisionSpineId,
      },
      qualityReport,
    };

    responseData.generationMeta = {
      templateUsed: false,
      persistedToDecisionArtifacts: false,
    };

    responseData.artifactMeta = buildArtifactMetaFromPayload(businessCase);

    responseData.decisionBrain = buildDecisionBrainPayload(brainResult);

    logger.info(`========== COREVIA BRAIN COMPLETE ==========\n`);

    if (isResponseClosed(res)) {
      logger.warn("[Generate BC] Request closed before success response could be returned", {
        reportId: id,
        businessCaseId: persistedBusinessCase?.id,
        decisionSpineId: resolvedDecisionSpineId,
        timedOut: Boolean(res.locals.requestTimedOut),
      });
      return;
    }

    res.json(responseData);
  }));

  // POST /:id/submit-clarifications - Submit clarification responses and re-trigger business case analysis
  router.post("/:id/submit-clarifications", auth.requireAuth, auth.requirePermission("business-case:generate"), validateBody(submitClarificationsSchema), asyncHandler(async (req, res) => {

    const { id } = req.params as { id: string };

    const validation = submitClarificationsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid clarification responses",
        details: validation.error.errors
      });
    }

    const { responses } = validation.data;

    const demandReport = await deps.reports.findById(id);
    if (!demandReport) {
      return res.status(404).json({ success: false, error: "Demand report not found" });
    }

    const userId = req.session.userId!;

    const brainInput = {
      demandReportId: id,
      projectName: demandReport.suggestedProjectName,
      organizationName: demandReport.organizationName,
      requestorName: demandReport.requestorName,
      businessObjective: demandReport.businessObjective,
      department: demandReport.department,
      budgetRange: demandReport.budgetRange,
      ...getDemandClassificationFields(demandReport as Record<string, unknown>),
      clarificationResponses: responses,
      intent: `Regenerate business case with clarifications for: ${demandReport.suggestedProjectName || id}`,
    };

    const decisionSpineId = demandReport.decisionSpineId as string | undefined;

    logger.info(`[Submit Clarifications] Re-running Brain for business case with ${responses.length} clarification responses`);

    const brainResult = await deps.brain.execute(
      "business_case",
      "business_case.generate",
      brainInput,
      userId,
      getAuthenticatedOrganizationId(req),
      { decisionSpineId }
    );

    const resolvedDecisionSpineId = decisionSpineId || brainResult.decisionId;
    const resolvedDraft = await resolveBusinessCaseDraft(
      deps,
      demandReport as Record<string, unknown>,
      resolvedDecisionSpineId,
      brainResult as Record<string, unknown> | null | undefined,
    );
    const pipelineDraft = resolvedDraft.draft;
    if (!pipelineDraft) {
      logger.error("[Submit Clarifications] Missing BUSINESS_CASE draft after clarification submit", {
        reportId: id,
        decisionSpineId: resolvedDecisionSpineId,
        brainStatus: brainResult?.finalStatus,
        draftSource: resolvedDraft.source,
        advisoryKeys: resolvedDraft.advisoryKeys,
        generatedArtifactKeys: resolvedDraft.generatedArtifactKeys,
      });
      return res.status(500).json({ success: false, error: "Brain did not produce an updated business case draft" });
    }

    const rawUpdatedBusinessCase = pipelineDraft;
    const clarifyIsFallback = resolvedDraft.source === "advisory_synthesis" || resolvedDraft.source === "stored_advisory";
    const materialized = await materializeBusinessCaseDraft({
      deps,
      reportId: id,
      demandReport: demandReport as Record<string, unknown>,
      draft: rawUpdatedBusinessCase,
      brainResult,
      decisionSpineId: resolvedDecisionSpineId,
      userId,
      clarificationsBypassed: false,
      totalClarificationQuestions: responses.length,
      clarificationResponseCount: responses.length,
      changesSummary: clarifyIsFallback
        ? `Business case updated from Brain advisory fallback with ${responses.length} clarification responses`
        : `Business case updated via Brain with ${responses.length} clarification responses`,
      draftSource: resolvedDraft.source,
    });
    const { businessCase: updatedBusinessCase, persistedBusinessCase, qualityReport } = materialized;

    // Governance: BUSINESS_CASE drafts are not persisted as decision artifacts until explicitly approved.

    logger.info(`[Submit Clarifications] Created new version: ${materialized.version?.id}`);

    const responseData: Record<string, unknown> = {
      success: true,
      data: {
        ...updatedBusinessCase,
        id: persistedBusinessCase?.id,
        demandReportId: id,
        decisionSpineId: resolvedDecisionSpineId,
      },
      qualityReport,
      decisionBrain: {
        decisionId: brainResult.decisionId,
        correlationId: brainResult.correlationId,
        status: brainResult.finalStatus,
      },
    };

    responseData.artifactMeta = buildArtifactMetaFromPayload(updatedBusinessCase);

    logger.info('[Submit Clarifications] Brain regeneration complete.');

    if (isResponseClosed(res)) {
      logger.warn("[Submit Clarifications] Request closed before success response could be returned", {
        reportId: id,
        businessCaseId: persistedBusinessCase?.id,
        decisionSpineId: resolvedDecisionSpineId,
        timedOut: Boolean(res.locals.requestTimedOut),
      });
      return;
    }

    res.json(responseData);
  }));

  // GET /:id/business-case - Get business case for a demand report
  router.get("/:id/business-case", auth.requireAuth, auth.requirePermission("report:read"), async (req, res) => {
    try {
      const demandReportId = req.params.id as string;
      const demandReport = await deps.reports.findById(demandReportId);

      let dbRecord = await deps.businessCase.findByDemandReportId(demandReportId);

      const versions = await deps.versions.findByReportId(demandReportId);
      const versionResult = findBusinessCaseContentFromVersions(versions);
      let businessCaseContent = versionResult.content;
      let qualityReportFromVersion = versionResult.qualityReport;
      let artifactMeta: Record<string, unknown> | null = null;

      if (!businessCaseContent && dbRecord) {
        businessCaseContent = ((dbRecord as Record<string, unknown>)?.data as Record<string, unknown>) || (dbRecord as Record<string, unknown>);
      }

      if (!businessCaseContent) {
        return res.status(200).json({ success: false, data: null, message: "No business case generated yet" });
      }

      artifactMeta = buildArtifactMetaFromPayload(businessCaseContent);

      // Normalize older stored drafts so the UI sections can render expected fields.
      businessCaseContent = normalizeBusinessCaseFields(businessCaseContent);

      // If we have a persisted DB record, merge it in as a completeness baseline.
      // This prevents sparse version payloads from wiping out required fields used by edit/export.
      if (dbRecord) {
        const dbRecordTyped = dbRecord as Record<string, unknown>;
        businessCaseContent = {
          ...dbRecordTyped,
          ...businessCaseContent,
        };
      }

      const dbQualityReport = dbRecord ? (dbRecord as Record<string, unknown>)?.qualityReport as QualityReport : null;
      const finalQualityReport = normalizePersistedQualityReport(qualityReportFromVersion || dbQualityReport || null);

      const dbRecordTyped = dbRecord as Record<string, unknown>;
      const dbSavedFinancials: Record<string, unknown> = dbRecord ? extractDbFinancialFields(dbRecordTyped) : {};
      logger.info('[GET business-case] DB record financial fields:', {
        hasTotalCostEstimate: dbRecordTyped?.totalCostEstimate !== undefined,
        totalCostEstimate: dbRecordTyped?.totalCostEstimate,
        hasFinancialAssumptions: !!dbRecordTyped?.financialAssumptions,
        hasDomainParameters: !!dbRecordTyped?.domainParameters,
        hasAiRecommendedBudget: dbRecordTyped?.aiRecommendedBudget !== undefined,
      });

      if (dbRecord) {
        await recomputeFinancialModelIfNeeded(deps, demandReportId, dbRecordTyped, dbSavedFinancials);
      }

      const wasEditedAfterGeneration = checkWasEditedAfterGeneration(dbRecordTyped);

      const responseBase: Record<string, unknown> = {
        ...businessCaseContent,
        projectTitle: safeString(businessCaseContent?.projectTitle ?? demandReport?.suggestedProjectName ?? demandReport?.projectName ?? demandReport?.title, ''),
        title: safeString(businessCaseContent?.title ?? demandReport?.suggestedProjectName ?? demandReport?.projectName ?? demandReport?.title, ''),
        organizationName: safeString(businessCaseContent?.organizationName ?? demandReport?.organizationName ?? demandReport?.organization, ''),
        department: safeString(businessCaseContent?.department ?? demandReport?.department, ''),
        requestorName: safeString(businessCaseContent?.requestorName ?? demandReport?.requestorName, ''),
        businessObjective: safeString(businessCaseContent?.businessObjective ?? demandReport?.businessObjective ?? demandReport?.problemStatement, ''),
        expectedOutcomes: businessCaseContent?.expectedOutcomes ?? demandReport?.expectedOutcomes ?? [],
        successCriteria: businessCaseContent?.successCriteria ?? demandReport?.successCriteria ?? [],
        constraints: businessCaseContent?.constraints ?? demandReport?.constraints ?? [],
        integrationRequirements: businessCaseContent?.integrationRequirements ?? demandReport?.integrationRequirements ?? [],
        existingSystems: businessCaseContent?.existingSystems ?? demandReport?.existingSystems ?? [],
        complianceRequirements: businessCaseContent?.complianceRequirements ?? demandReport?.complianceRequirements ?? [],
        riskFactors: businessCaseContent?.riskFactors ?? demandReport?.riskFactors ?? [],
        qualityReport: finalQualityReport,
        id: dbRecord?.id || businessCaseContent?.id,
        demandReportId: demandReportId,
        ...dbSavedFinancials,
        ...buildSavedFieldOverrides(wasEditedAfterGeneration, dbSavedFinancials, businessCaseContent),
        marketResearch: dbRecordTyped?.marketResearch || null,
        marketResearchGeneratedAt: dbRecordTyped?.marketResearchGeneratedAt || null
      };

      const response: Record<string, unknown> = normalizeBusinessCaseFields(responseBase);

      resolveTimeline(response);
      enhanceResponseWithComputedModel(response, wasEditedAfterGeneration, (inputs) => deps.financial.compute(inputs as unknown as Record<string, unknown>));

      const derivedFinancialCheck = buildFinancialQualityCheck(
        response,
        response.computedFinancialModel as Record<string, unknown> | undefined,
        demandReport as Record<string, unknown>,
      );
      const effectiveQualityReport = applyDerivedFinancialQualityCheck(finalQualityReport, derivedFinancialCheck);
      response.qualityReport = effectiveQualityReport;

      // Reconcile stakeholder analysis: if the persisted list is weak (no engagementStrategy, few entries, only internal),
      // regenerate from demand context so the Power-Interest Matrix is meaningful.
      {
        const existingStakeholders = Array.isArray(response.stakeholderAnalysis) ? response.stakeholderAnalysis as Array<Record<string, unknown>> : [];
        const hasEngagementStrategies = existingStakeholders.some((s) => typeof s.engagementStrategy === 'string' && s.engagementStrategy.length > 10);
        const isTooFew = existingStakeholders.length < 7;
        if ((!hasEngagementStrategies || isTooFew) && demandReport) {
          const drTyped = demandReport as Record<string, unknown>;
          const bcTitle = safeString(response.projectTitle ?? response.title ?? drTyped.suggestedProjectName, '');
          const bcDept = safeString(response.department ?? drTyped.department, '');
          const bcOrg = safeString(response.organizationName ?? drTyped.organizationName ?? drTyped.submittingOrganization, '');
          const bcRequestor = safeString(response.requestorName ?? drTyped.requestorName, '');
          const bcIntegrations = extractMeaningfulStrings(response.integrationRequirements ?? drTyped.integrationRequirements);
          const bcCompliance = extractMeaningfulStrings(response.complianceRequirements ?? drTyped.complianceRequirements);
          const enrichedStakeholders = buildDraftStakeholderAnalysis(bcRequestor, bcDept, bcOrg, bcTitle, bcIntegrations, bcCompliance);
          response.stakeholderAnalysis = enrichedStakeholders;
          logger.info('[GET business-case] Reconciled weak stakeholder analysis:', { previousCount: existingStakeholders.length, newCount: enrichedStakeholders.length });
        }
      }

      // Reconcile KPIs: if the persisted KPIs use AV language for a drone project, regenerate drone-specific KPIs.
      {
        const bcTitle = safeString(response.projectTitle ?? response.title, '');
        const bcObjective = safeString(response.businessObjective, '');
        const bcDept = safeString(response.department, '');
        const bcOutcomes = extractMeaningfulStrings(response.expectedOutcomes);
        const isDrone = isDroneDeliveryInitiative({ title: bcTitle, objective: bcObjective, expectedOutcomes: bcOutcomes });
        if (isDrone) {
          const existingKpis = Array.isArray(response.kpis) ? response.kpis as Array<Record<string, unknown>> : [];
          const hasAVKpiLanguage = existingKpis.some((k) => {
            const kpiName = safeString(k.name, '').toLowerCase();
            return kpiName.includes('trip') || kpiName.includes('vehicle') || kpiName.includes('autonomous service');
          });
          if (hasAVKpiLanguage || existingKpis.length === 0) {
            const modelInputs = (response.computedFinancialModel as Record<string, unknown> | undefined)?.inputs as Record<string, unknown> | undefined;
            const implMonths = inferImplementationMonthsFromResponse(response, asFiniteNumber(modelInputs?.totalInvestment, 0));
            const freshKpis = buildDemandSpecificKpis(bcTitle, bcDept, bcOutcomes, implMonths, bcObjective);
            response.kpis = freshKpis;
            if (response.measurementPlan && typeof response.measurementPlan === 'object') {
              (response.measurementPlan as Record<string, unknown>).kpis = freshKpis.map((kpi) => ({
                name: kpi.name, baseline: kpi.baseline, target: kpi.target, owner: bcDept,
              }));
            }
            logger.info('[GET business-case] Reconciled AV KPIs to drone-specific KPIs');
          }

          // Reconcile alternatives: if persisted alternatives use AV language for drone project, regenerate.
          const existingAlternatives = Array.isArray(response.alternativeSolutions) ? response.alternativeSolutions as string[] : [];
          const hasAVAlternativeLanguage = existingAlternatives.some((a) => typeof a === 'string' && /autonomous vehicle|av fleet|conventional fleet model/i.test(a));
          if (hasAVAlternativeLanguage || existingAlternatives.length === 0) {
            const modelInputs2 = (response.computedFinancialModel as Record<string, unknown> | undefined)?.inputs as Record<string, unknown> | undefined;
            const implMonths2 = inferImplementationMonthsFromResponse(response, asFiniteNumber(modelInputs2?.totalInvestment, 0));
            const totalInvest = asFiniteNumber(modelInputs2?.totalInvestment, 0);
            const ctx = {
              title: bcTitle, objective: bcObjective, expectedOutcomes: bcOutcomes,
              integrationRequirements: extractMeaningfulStrings(response.integrationRequirements),
              existingSystems: extractMeaningfulStrings(response.existingSystems),
            } as DemandContext;
            response.alternativeSolutions = buildAlternativeSolutions(ctx, implMonths2, totalInvest);
            response.alternativesAnalysis = { options: response.alternativeSolutions };
            logger.info('[GET business-case] Reconciled AV alternatives to drone-specific alternatives');
          }

          // Reconcile conclusion: if conclusion references "stage-gated mobility" for a STRONG_INVEST BC, refresh.
          const conclusionText = safeString(response.conclusionSummary, '');
          const verdictFromModel = safeString((response.computedFinancialModel as Record<string, unknown> | undefined)?.decision && ((response.computedFinancialModel as Record<string, unknown>).decision as Record<string, unknown>)?.verdict, '');
          if ((verdictFromModel === 'STRONG_INVEST' || verdictFromModel === 'INVEST') && /stage-gated|does not yet clear|below target/i.test(conclusionText)) {
            const orgName = safeString(response.organizationName, 'The organization');
            response.conclusionSummary = `${orgName} has a strong investment case to proceed with ${bcTitle}, supported by robust financial returns and clear strategic alignment. The program should secure named delivery and benefits ownership, maintain formal architecture and compliance stage gates, and track realized value through monthly KPI reporting.`;
            logger.info('[GET business-case] Reconciled conservative conclusion to match INVEST/STRONG_INVEST verdict');
          }
        }
      }

      const computedModel = response.computedFinancialModel as Record<string, unknown> | undefined;
      logger.info('[GET business-case] Response structure check:', {
        hasExecutiveSummary: !!response.executiveSummary,
        hasProblemStatement: !!response.problemStatement,
        hasDetailedCosts: !!response.detailedCosts,
        hasDetailedBenefits: !!response.detailedBenefits,
        hasRoiPercentage: !!response.roiPercentage,
        hasNpvValue: !!response.npvValue,
        hasQualityReport: !!effectiveQualityReport,
        hasSavedTotalCostEstimate: response.savedTotalCostEstimate !== undefined,
        savedTotalCostEstimate: response.savedTotalCostEstimate,
        totalCostEstimate: response.totalCostEstimate,
        hasSavedFinancialAssumptions: !!response.financialAssumptions,
        hasSavedDomainParameters: !!response.domainParameters,
        hasComputedFinancialModel: !!response.computedFinancialModel,
        computedModelVerdict: (computedModel?.decision as Record<string, unknown>)?.verdict,
        topLevelKeys: Object.keys(response).slice(0, 25)
      });

      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.json({
        success: true,
        data: response,
        qualityReport: effectiveQualityReport,
        artifactMeta,
      });
    } catch (error) {
      logger.error("Error fetching business case:", error);
      res.status(500).json({ success: false, error: "Failed to fetch business case" });
    }
  });

  // PUT /:id/business-case - Update business case financial parameters
  router.put("/:id/business-case", auth.requireAuth, auth.requirePermission("report:update-self"), validateBody(updateBusinessCaseSchema), asyncHandler(async (req, res) => {

    const demandReportId = req.params.id as string;
    const updateData = req.body;

    logger.info('[PUT business-case] Updating financial parameters for:', demandReportId);

    const existingBC = await deps.businessCase.findByDemandReportId(demandReportId);
    const demandReport = await deps.reports.findById(demandReportId);

    if (!existingBC) {
      return res.status(404).json({ success: false, error: "Business case not found" });
    }
    if (!demandReport) {
      return res.status(404).json({ success: false, error: "Demand report not found" });
    }

    const demandReportTyped = demandReport as Record<string, unknown>;
    const archetype = deps.financial.detectArchetype({
      projectName: demandReport.suggestedProjectName || '',
      projectDescription: (demandReportTyped.projectDescription as string) || (demandReportTyped.businessObjective as string) || '',
      organization: (demandReportTyped.submittingOrganization as string) || (demandReportTyped.organizationName as string) || '',
      objectives: (demandReportTyped.businessObjective as string) || '',
      problemStatement: (demandReportTyped.problemStatement as string) || '',
    });

    const existingBCTyped = existingBC as Record<string, unknown>;
    const savedAssumptions = (existingBCTyped.financialAssumptions as FinancialAssumptions) || {};
    const updatedAssumptions = (updateData.financialAssumptions as FinancialAssumptions) || {};
    const updatedCostOverrides = (updateData.costOverrides && typeof updateData.costOverrides === 'object')
      ? updateData.costOverrides as Record<string, unknown>
      : (updatedAssumptions.costOverrides && typeof updatedAssumptions.costOverrides === 'object')
        ? updatedAssumptions.costOverrides as Record<string, unknown>
        : (savedAssumptions.costOverrides && typeof savedAssumptions.costOverrides === 'object')
          ? savedAssumptions.costOverrides as Record<string, unknown>
          : {};
    const updatedBenefitOverrides = (updateData.benefitOverrides && typeof updateData.benefitOverrides === 'object')
      ? updateData.benefitOverrides as Record<string, unknown>
      : (updatedAssumptions.benefitOverrides && typeof updatedAssumptions.benefitOverrides === 'object')
        ? updatedAssumptions.benefitOverrides as Record<string, unknown>
        : (savedAssumptions.benefitOverrides && typeof savedAssumptions.benefitOverrides === 'object')
          ? savedAssumptions.benefitOverrides as Record<string, unknown>
          : {};
    const mergedAssumptions = {
      ...savedAssumptions,
      ...updatedAssumptions,
      costOverrides: updatedCostOverrides,
      benefitOverrides: updatedBenefitOverrides,
    };

    const savedDomainParams = (existingBCTyped.domainParameters as DomainParameters) || {};
    const updatedDomainParams = (updateData.domainParameters as DomainParameters) || {};
    const mergedDomainParams = { ...savedDomainParams, ...updatedDomainParams };

    const savedImplementationCosts = (existingBCTyped.implementationCosts as Record<string, number>) || {};
    const updatedImplementationCosts = (updateData.implementationCosts as Record<string, number>) || {};
    const mergedImplementationCosts = { ...savedImplementationCosts, ...updatedImplementationCosts };

    const savedOperationalCosts = (existingBCTyped.operationalCosts as Record<string, number>) || {};
    const updatedOperationalCosts = (updateData.operationalCosts as Record<string, number>) || {};
    const mergedOperationalCosts = { ...savedOperationalCosts, ...updatedOperationalCosts };

    const reservedFinancialKeys = new Set([
      'financialAssumptions',
      'domainParameters',
      'totalCostEstimate',
      'aiRecommendedBudget',
      'implementationCosts',
      'operationalCosts',
      'costOverrides',
      'benefitOverrides',
    ]);
    const passthroughPlanningUpdates = Object.fromEntries(
      Object.entries(updateData as Record<string, unknown>).filter(([key]) => !reservedFinancialKeys.has(key)),
    );

    let totalInvestment = 0;
    if (updateData.totalCostEstimate !== undefined) {
      totalInvestment = Number.parseFloat(safeString(updateData.totalCostEstimate, '0'));
    } else if (existingBCTyped?.totalCostEstimate) {
      totalInvestment = Number.parseFloat(safeString(existingBCTyped?.totalCostEstimate, '0'));
    }

    const financialInputs: FinancialInputs = {
      totalInvestment,
      archetype,
      discountRate: mergedAssumptions.discountRate === undefined
        ? 8
        : mergedAssumptions.discountRate * 100,
      adoptionRate: mergedAssumptions.adoptionRate ?? 0.75,
      maintenancePercent: mergedAssumptions.maintenancePercent ?? 0.15,
      contingencyPercent: mergedAssumptions.contingencyPercent ?? 0.1,
      domainParameters: mergedDomainParams as Record<string, number>,
    };

    const unifiedModel = deps.financial.compute(financialInputs as any) as unknown as UnifiedFinancialOutput; // eslint-disable-line @typescript-eslint/no-explicit-any
    applyFinancialOverridesToComputedModel(
      unifiedModel as unknown as Record<string, unknown>,
      updatedCostOverrides,
      updatedBenefitOverrides,
    );

    logger.info('[PUT business-case] Computed unified model:', {
      npv: unifiedModel.metrics.npv,
      irr: unifiedModel.metrics.irr,
      roi: unifiedModel.metrics.roi,
      verdict: unifiedModel.decision.verdict,
      confidence: unifiedModel.decision.confidence,
    });

    const updatePayload: Record<string, unknown> = {
      ...passthroughPlanningUpdates,
      totalCostEstimate: String(totalInvestment),
      financialAssumptions: mergedAssumptions,
      domainParameters: mergedDomainParams,
      implementationCosts: mergedImplementationCosts,
      operationalCosts: mergedOperationalCosts,
      tcoBreakdown: {
        implementation: Object.values(mergedImplementationCosts).reduce((sum, value) => sum + (Number(value) || 0), 0),
        operations: (Number(mergedOperationalCosts.annualRunCost) || 0) + (Number(mergedOperationalCosts.support) || 0),
        maintenance: Number(mergedOperationalCosts.maintenance) || 0,
      },
      computedFinancialModel: unifiedModel,
      // Reconcile all derived financial fields from the fresh model
      roiPercentage: unifiedModel.metrics.roi,
      npvValue: unifiedModel.metrics.npv,
      paybackMonths: unifiedModel.metrics.paybackMonths,
      lifecycleCostEstimate: unifiedModel.metrics.totalCosts,
      lifecycleBenefitEstimate: unifiedModel.metrics.totalBenefits,
      totalBenefitEstimate: unifiedModel.metrics.totalBenefits,
      roiCalculation: {
        basis: 'computed_financial_model',
        initialInvestment: totalInvestment,
        lifecycleCost: unifiedModel.metrics.totalCosts,
        lifecycleBenefit: unifiedModel.metrics.totalBenefits,
        roi: unifiedModel.metrics.roi,
      },
      npvCalculation: {
        basis: 'computed_financial_model',
        npv: unifiedModel.metrics.npv,
        discountRate: financialInputs.discountRate / 100,
      },
      paybackCalculation: {
        basis: 'computed_financial_model',
        paybackMonths: unifiedModel.metrics.paybackMonths,
      },
    };

    if (updateData.aiRecommendedBudget !== undefined) {
      updatePayload.aiRecommendedBudget = updateData.aiRecommendedBudget;
    }

    await deps.businessCase.update(existingBC.id, updatePayload);
    logger.info('[PUT business-case] Updated DB record with computed model');

    const versions = await deps.versions.findByReportId(demandReportId);
    const bcVersions = versions
      .filter(v => v.versionType === 'business_case')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const latestVersion = bcVersions.length > 0 ? bcVersions[0] : null;
    const latestVersionData = (latestVersion?.versionData as Record<string, unknown>) || {};

    const mergedVersionData: Record<string, unknown> = {
      ...latestVersionData,
      ...passthroughPlanningUpdates,
      totalCostEstimate: totalInvestment,
      financialAssumptions: mergedAssumptions,
      domainParameters: mergedDomainParams,
      implementationCosts: mergedImplementationCosts,
      operationalCosts: mergedOperationalCosts,
      tcoBreakdown: updatePayload.tcoBreakdown,
      computedFinancialModel: unifiedModel,
      roiPercentage: unifiedModel.metrics.roi,
      npvValue: unifiedModel.metrics.npv,
      paybackMonths: unifiedModel.metrics.paybackMonths,
      lifecycleCostEstimate: unifiedModel.metrics.totalCosts,
      lifecycleBenefitEstimate: unifiedModel.metrics.totalBenefits,
      totalBenefitEstimate: unifiedModel.metrics.totalBenefits,
      roiCalculation: updatePayload.roiCalculation,
      npvCalculation: updatePayload.npvCalculation,
      paybackCalculation: updatePayload.paybackCalculation,
      lastUpdated: new Date().toISOString(),
      lastUpdatedBy: req.session.userId
    };

    const user = await deps.users.getUser(req.session.userId!);
    const versionData = {
      versionType: 'business_case' as const,
      parentVersionId: latestVersion?.id || null,
      baseVersionId: bcVersions.at(-1)?.id ?? null,
      status: 'draft' as const,
      versionData: mergedVersionData,
      changesSummary: `Financial model updated. NPV: ${unifiedModel.metrics.npv.toLocaleString()}, Decision: ${unifiedModel.decision.verdict}`,
      createdBy: req.session.userId!,
      createdByName: user?.displayName || user?.username || 'System',
      decisionSpineId: demandReport.decisionSpineId as string | undefined,
    };

    const newVersion = await createReportVersionSafely(deps.versions, demandReportId, versionData);

    logger.info('[PUT business-case] Created version:', newVersion.versionNumber);

    res.json({
      success: true,
      data: mergedVersionData,
      financialModel: unifiedModel,
      versionId: newVersion.id,
      versionNumber: newVersion.versionNumber,
      message: "Financial model saved and recomputed successfully"
    });
  }));

  // GET /:id/financial-model - Get computed unified financial model
  router.get("/:id/financial-model", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const demandReportId = req.params.id as string;

    const demandReport = await deps.reports.findById(demandReportId);
    const businessCase = await deps.businessCase.findByDemandReportId(demandReportId);

    if (!demandReport) {
      return res.status(404).json({ success: false, error: "Demand report not found" });
    }
    if (!businessCase) {
      return res.status(404).json({ success: false, error: "Business case not found" });
    }

    const bc = businessCase as Record<string, unknown>;
    if (bc?.computedFinancialModel && (bc?.computedFinancialModel as Record<string, unknown>)?.generatedAt && hasCompleteFinancialModel(bc?.computedFinancialModel)) {
      const cachedModel = bc.computedFinancialModel as Record<string, unknown>;
      const cachedInputs = (cachedModel.inputs as Record<string, unknown> | undefined) || {};
      const resolvedArchetype = safeString(cachedModel.archetype ?? cachedInputs.archetype, '').trim();

      const outputModel = {
        ...cachedModel,
        archetype: resolvedArchetype || null,
      };

      // Self-heal cached payload if archetype metadata was missing in older records
      if (!resolvedArchetype && cachedInputs.archetype) {
        await deps.businessCase.update(businessCase.id, {
          computedFinancialModel: outputModel,
        });
      }
      logger.info('[GET financial-model] Returning cached computed model');
      return res.json({
        success: true,
        data: outputModel,
        cached: true,
      });
    }

    const inputs = deps.financial.buildInputsFromData(businessCase, demandReport);

    logger.info('[GET financial-model] Computing fresh model with inputs:', {
      totalInvestment: inputs.totalInvestment,
      archetype: inputs.archetype,
      discountRate: inputs.discountRate,
    });

    const unifiedModel = deps.financial.compute(inputs);

    const outputModel = {
      ...unifiedModel,
      archetype: safeString(unifiedModel?.archetype ?? inputs.archetype, '').trim() || null,
    };

    await deps.businessCase.update(businessCase.id, {
      computedFinancialModel: outputModel,
    });

    res.json({
      success: true,
      data: outputModel,
      cached: false,
    });
  }));

  return router;
}
