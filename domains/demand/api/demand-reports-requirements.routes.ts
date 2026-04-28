import { Router } from "express";
import type { DemandStorageSlice } from "../application/buildDeps";
import { createAuthMiddleware, getAuthenticatedOrganizationId } from "@interfaces/middleware/auth";
import { buildDemandDeps, type DemandAllDeps } from "../application/buildDeps";
import {
  asVersionLike,
  createReportVersionSafely,
  getDemandClassificationFields,
  resolveParentApprovalState,
} from "../application";
import { normalizeRequirementsForUI } from "../application/normalizers";
import { attachArtifactProvenance, buildArtifactMetaFromPayload } from "../application/artifactProvenance";
import {
  buildBlockedGenerationResponse,
  isAcceptFallbackOptIn,
  shouldBlockGeneration,
} from "./_blocked-generation-response";
import { asyncHandler } from "@platform/logging/ErrorHandler";
import { logger } from "@platform/logging/Logger";
import { TIMEOUTS } from "@interfaces/middleware/timeout";
import { marketResearchService, type MarketResearchRequest, type MarketResearchResult } from "@domains/intelligence/application";

type RequirementsDeps = Pick<DemandAllDeps, "reports" | "brain" | "versions" | "businessCase" | "users">;

interface ResolvedRequirementsDraft {
  draft: Record<string, unknown> | null;
  source: "pipeline" | "stored_advisory" | "advisory_synthesis" | "missing";
  advisoryKeys: string[] | null;
  generatedArtifactKeys: string[] | null;
}

function isViableRequirementsDraft(draft: Record<string, unknown> | null | undefined): draft is Record<string, unknown> {
  if (!draft || typeof draft !== "object") {
    return false;
  }

  if (draft.generationFailed === true) {
    return false;
  }

  const sectionKeys = [
    "capabilities",
    "functionalRequirements",
    "nonFunctionalRequirements",
    "securityRequirements",
    "dataRequirements",
    "operationalRequirements",
  ];

  const hasSectionContent = sectionKeys.some((key) => {
    const value = draft[key];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return Boolean(value);
  });

  if (hasSectionContent) {
    return true;
  }

  return false;
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
    ((payload.decision as Record<string, unknown> | undefined)?.advisory as Record<string, unknown> | undefined) ||
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

function getRequirementsDraftFromPayload(payload: Record<string, unknown> | null | undefined): ResolvedRequirementsDraft {
  const { advisoryKeys, generatedArtifactKeys, generatedArtifacts } = getGeneratedArtifacts(payload);
  const rawDraft =
    (generatedArtifacts?.REQUIREMENTS as Record<string, unknown> | undefined) ||
    (generatedArtifacts?.requirements as Record<string, unknown> | undefined) ||
    (generatedArtifacts?.requirementsAnalysis as Record<string, unknown> | undefined) ||
    null;
  const draft = isViableRequirementsDraft(rawDraft) ? rawDraft : null;

  return {
    draft,
    source: draft ? "pipeline" : "missing",
    advisoryKeys,
    generatedArtifactKeys,
  };
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value !== "string") {
    return [];
  }
  return value.split(/[;,\n]+/).map((item) => item.trim()).filter(Boolean);
}

function buildRequirementsMarketResearchRequest(
  demandReport: Record<string, unknown>,
  requirementsAnalysis: Record<string, unknown>,
): MarketResearchRequest {
  const title = String(demandReport.suggestedProjectName || demandReport.projectName || demandReport.title || "Strategic initiative").trim();
  const objective = String(demandReport.businessObjective || demandReport.problemStatement || "deliver measurable business outcomes").trim();
  const organization = String(demandReport.organizationName || demandReport.organization || "").trim();
  const capabilities = Array.isArray(requirementsAnalysis.capabilities)
    ? (requirementsAnalysis.capabilities as Array<Record<string, unknown>>)
        .map((item) => String(item.name || item.title || "").trim())
        .filter(Boolean)
    : [];
  const functionalRequirements = Array.isArray(requirementsAnalysis.functionalRequirements)
    ? (requirementsAnalysis.functionalRequirements as Array<Record<string, unknown>>)
        .map((item) => String(item.requirement || item.title || "").trim())
        .filter(Boolean)
    : [];
  const nonFunctionalRequirements = Array.isArray(requirementsAnalysis.nonFunctionalRequirements)
    ? (requirementsAnalysis.nonFunctionalRequirements as Array<Record<string, unknown>>)
        .map((item) => String(item.requirement || item.title || "").trim())
        .filter(Boolean)
    : [];
  const securityRequirements = Array.isArray(requirementsAnalysis.securityRequirements)
    ? (requirementsAnalysis.securityRequirements as Array<Record<string, unknown>>)
        .map((item) => String(item.requirement || item.title || "").trim())
        .filter(Boolean)
    : [];

  return {
    projectName: title,
    projectDescription: `Requirements-focused market research for ${title}. Use the research to validate solution options, vendor landscape, and delivery implications for ${objective}.`,
    projectType: "requirements-analysis",
    organization: organization || undefined,
    businessCaseSummary: [
      `Objective: ${objective}`,
      capabilities.length > 0 ? `Capabilities: ${capabilities.slice(0, 5).join("; ")}` : null,
      functionalRequirements.length > 0 ? `Functional scope: ${functionalRequirements.slice(0, 6).join("; ")}` : null,
      nonFunctionalRequirements.length > 0 ? `Non-functional priorities: ${nonFunctionalRequirements.slice(0, 4).join("; ")}` : null,
      securityRequirements.length > 0 ? `Security requirements: ${securityRequirements.slice(0, 4).join("; ")}` : null,
    ].filter(Boolean).join("\n"),
    archetype: "requirements",
    objectives: [...capabilities.slice(0, 4), ...functionalRequirements.slice(0, 4)].slice(0, 8),
    scope: {
      inScope: functionalRequirements.slice(0, 12),
      outOfScope: toList(requirementsAnalysis.outOfScope),
      deliverables: capabilities.slice(0, 6),
      constraints: toList(requirementsAnalysis.constraints),
      assumptions: toList(requirementsAnalysis.assumptions),
    },
    strategicAlignment: {
      organizationalObjectives: toList(demandReport.expectedOutcomes),
      digitalAgenda: objective ? [objective] : [],
    },
    expectedBenefits: capabilities.slice(0, 4).map((capability) => ({
      category: "Capability uplift",
      description: capability,
      type: "operational",
    })),
    decisionGovernance: {
      approved: true,
    },
  };
}

// ── Solution-profiling helpers ─────────────────────────────────────────────
// These inspect the combined business case + demand context to decide which
// solution-specific requirement packs to include (AI/ML, real-time dispatch,
// external-integration, data-platform, customer-facing, etc.). This is what
// makes requirements solution-specific instead of platform-generic.

interface SolutionProfile {
  isAiDriven: boolean;
  isRealTimeOps: boolean;
  isDispatchOrLogistics: boolean;
  isExternallyIntegrated: boolean;
  isDataPlatform: boolean;
  isCustomerFacing: boolean;
  domainTokens: string[];
  solutionSummary: string;
  solutionComponents: string[];
  integrationTargets: string[];
  dataSources: string[];
}

function detectSolutionProfile(
  demandReport: Record<string, unknown>,
  businessCase: Record<string, unknown> | undefined | null,
  advisoryPayload: Record<string, unknown>,
): SolutionProfile {
  const fields: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim()) fields.push(value);
    else if (Array.isArray(value)) value.forEach((v) => push(v));
    else if (value && typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach((v) => push(v));
    }
  };
  push(demandReport.suggestedProjectName);
  push(demandReport.projectName);
  push(demandReport.businessObjective);
  push(demandReport.problemStatement);
  push(demandReport.expectedOutcomes);
  push(demandReport.integrationRequirements);
  push(demandReport.department);
  if (businessCase) {
    push(businessCase.executiveSummary);
    push(businessCase.businessRequirements);
    push(businessCase.solutionOverview);
    push(businessCase.proposedSolution);
    push(businessCase.problemStatement);
    push(businessCase.backgroundContext);
    push(businessCase.smartObjectives);
    push(businessCase.scopeDefinition);
    push(businessCase.expectedDeliverables);
    push(businessCase.alternativeSolutions);
  }
  push(advisoryPayload.summary);

  const blob = fields.join(" \n ").toLowerCase();
  const hasAny = (...tokens: string[]) => tokens.some((tok) => blob.includes(tok));

  const isAiDriven = hasAny(
    "ai ", "ai-", "a.i", "artificial intelligence", "machine learning", "ml model",
    "predictive", "forecast", "neural", "llm", "optimization", "reinforcement",
    "recommend", "classifier", "regression",
  );
  const isRealTimeOps = hasAny(
    "real-time", "real time", "realtime", "streaming", "event-driven", "dispatch",
    "telemetry", "live ", "low latency", "low-latency",
  );
  const isDispatchOrLogistics = hasAny(
    "dispatch", "fleet", "vehicle", "driver", "routing", "logistics", "mobility",
    "ride", "transport", "taxi", "rta", "route optim",
  );
  const isExternallyIntegrated = hasAny(
    "integration", "api ", "apis", "third-party", "third party", "external system",
    "partner", "vendor", "rta", "weather", "events", "siem", "erp", "crm",
  );
  const isDataPlatform = hasAny(
    "data platform", "data lake", "warehouse", "analytics", "ingestion", "pipeline",
    "etl", "elt", "kafka", "streaming", "telemetry",
  );
  const isCustomerFacing = hasAny(
    "customer", "citizen", "end-user", "mobile app", "public", "consumer",
  );

  const domainTokens = Array.from(new Set([
    isDispatchOrLogistics ? "mobility-dispatch" : null,
    isAiDriven ? "ai-ml" : null,
    isRealTimeOps ? "real-time-ops" : null,
    isExternallyIntegrated ? "external-integrations" : null,
    isDataPlatform ? "data-platform" : null,
    isCustomerFacing ? "customer-facing" : null,
  ].filter(Boolean) as string[]));

  const solutionSummary = [
    String(businessCase?.solutionOverview || "").trim(),
    String(businessCase?.proposedSolution || "").trim(),
    String(businessCase?.executiveSummary || "").trim(),
  ].filter(Boolean).join(" ").slice(0, 600);

  const componentMatches = new Set<string>();
  if (isDispatchOrLogistics) {
    if (hasAny("forecast", "predict", "demand")) componentMatches.add("Demand forecasting engine");
    if (hasAny("optim", "assign", "allocation")) componentMatches.add("Fleet optimization engine");
    if (hasAny("dispatch", "assignment")) componentMatches.add("Real-time dispatch execution");
    if (hasAny("rebalanc", "reposition")) componentMatches.add("Fleet rebalancing logic");
    if (hasAny("driver ", "app")) componentMatches.add("Driver communication interface");
    componentMatches.add("Control tower dashboard");
  }
  if (isAiDriven && componentMatches.size === 0) componentMatches.add("AI/ML inference layer");
  if (isDataPlatform) componentMatches.add("Data ingestion and curation pipeline");

  const integrationTargets: string[] = [];
  if (hasAny("rta ", "rta,", "road and transport")) integrationTargets.push("RTA / transport authority APIs");
  if (hasAny("weather")) integrationTargets.push("Weather data provider");
  if (hasAny("event", "arena", "venue")) integrationTargets.push("Event / venue schedule provider");
  if (hasAny("traffic")) integrationTargets.push("Traffic and incident data feed");
  if (hasAny("payment", "billing")) integrationTargets.push("Payment gateway");
  if (hasAny("siem")) integrationTargets.push("SIEM / SOC pipeline");
  if (hasAny("crm")) integrationTargets.push("Customer CRM");
  if (hasAny("erp")) integrationTargets.push("Finance / ERP");

  const dataSources: string[] = [];
  if (isDispatchOrLogistics) {
    dataSources.push("Vehicle telemetry (GPS, ignition, meter)");
    dataSources.push("Historical trip demand");
  }
  if (hasAny("weather")) dataSources.push("Weather and environmental data");
  if (hasAny("event", "arena")) dataSources.push("Event schedules and venue footfall");
  if (hasAny("traffic")) dataSources.push("Traffic and road incident feeds");
  if (isCustomerFacing) dataSources.push("Customer profile and usage data");

  return {
    isAiDriven,
    isRealTimeOps,
    isDispatchOrLogistics,
    isExternallyIntegrated,
    isDataPlatform,
    isCustomerFacing,
    domainTokens,
    solutionSummary,
    solutionComponents: Array.from(componentMatches),
    integrationTargets,
    dataSources,
  };
}

function buildRequirementsDraftFromAdvisoryContext(
  demandReport: Record<string, unknown>,
  advisoryPayload: Record<string, unknown>,
  businessCase?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  const title = String(demandReport.suggestedProjectName || demandReport.projectName || demandReport.title || "Strategic initiative").trim();
  const objective = String(demandReport.businessObjective || demandReport.problemStatement || "deliver measurable operational improvement").trim();
  const department = String(demandReport.department || "Business").trim();
  const integrationRequirements = toList(demandReport.integrationRequirements);
  const complianceRequirements = toList(demandReport.complianceRequirements);
  const expectedOutcomes = toList(demandReport.expectedOutcomes);
  const constraints = toList(demandReport.constraints);
  const options = Array.isArray(advisoryPayload.options) ? advisoryPayload.options as Array<Record<string, unknown>> : [];
  const risks = Array.isArray(advisoryPayload.risks) ? advisoryPayload.risks as Array<Record<string, unknown>> : [];
  const summary = String(advisoryPayload.summary || "").trim();

  // Solution profile — drives which solution-specific requirement packs we emit
  const profile = detectSolutionProfile(demandReport, businessCase || null, advisoryPayload);

  // Proceed if we have ANY meaningful signal (business case, advisory, or demand outcomes)
  const hasBusinessCase = Boolean(businessCase && (businessCase.executiveSummary || businessCase.solutionOverview || businessCase.businessRequirements));
  if (!summary && options.length === 0 && risks.length === 0 && expectedOutcomes.length === 0 && !hasBusinessCase) {
    return null;
  }

  // ── Capabilities ─────────────────────────────────────────────────────────
  const capabilities: Array<Record<string, unknown>> = [];
  if (profile.isDispatchOrLogistics) {
    capabilities.push(
      { name: "Predictive demand forecasting", description: "Forecast trip demand by zone and time window to pre-position supply", priority: "High", reasoning: "Core intelligence capability — the whole system value depends on forecast accuracy" },
      { name: "Fleet optimization and assignment", description: "Optimize vehicle-to-demand assignment minimising ETA and deadhead", priority: "High", reasoning: "Translates forecast into operational action; directly drives utilization KPI" },
      { name: "Real-time dispatch execution", description: "Execute dispatch decisions and broadcast to drivers with ack and fallback", priority: "High", reasoning: "Operational moment of truth — sub-second reliability required" },
      { name: "Fleet rebalancing and positioning", description: "Proactively reposition idle vehicles into predicted-demand hot spots", priority: "High", reasoning: "Closes the loop between forecast and supply" },
      { name: "External-data ingestion", description: "Ingest weather, event, traffic and authority data to inform forecasts", priority: "High", reasoning: "AI is only as good as its signal coverage" },
      { name: "Control tower operations", description: "Supervised oversight with override, incident and exception workflow", priority: "High", reasoning: "Human-in-the-loop requirement for safety-critical dispatch" },
      { name: "Driver communication and UX", description: "Driver-side app receives assignments, navigation, and status updates", priority: "High", reasoning: "Field execution surface — directly affects compliance and SLA" },
      { name: "KPI and performance monitoring", description: "Monitor utilization, ETA, cancellation, forecast accuracy, SLA", priority: "High", reasoning: "Required for continuous improvement and governance" },
    );
  } else {
    capabilities.push(
      { name: `${title} core workflow enablement`, description: `Support ${department} teams to execute ${objective || title} with governed lifecycle control`, priority: "High", reasoning: "Core workflow capability" },
      { name: `${title} analytics and reporting`, description: "Decision-ready KPI and reporting visibility", priority: "High", reasoning: summary || "Structured oversight required" },
    );
  }
  if (profile.isAiDriven && !profile.isDispatchOrLogistics) {
    capabilities.push({ name: "AI/ML inference and governance", description: "Operate production AI/ML models with explainability, drift monitoring and fallback", priority: "High", reasoning: "AI is load-bearing — must be operationalised, not conceptual" });
  }
  if (profile.isExternallyIntegrated && !profile.isDispatchOrLogistics) {
    capabilities.push({ name: "External integration platform", description: "Govern inbound/outbound APIs, messaging and data contracts with partners", priority: "High", reasoning: "Cross-system dependencies require first-class integration layer" });
  }

  // ── Functional Requirements ──────────────────────────────────────────────
  const functionalRequirements: Array<Record<string, unknown>> = [];
  let frCounter = 1;
  const nextFrId = () => `FR-${String(frCounter++).padStart(3, "0")}`;

  if (profile.isDispatchOrLogistics) {
    functionalRequirements.push(
      {
        id: nextFrId(),
        requirement: `The system shall forecast trip demand by zone and time window for ${title}`,
        description: "Machine-learning forecasting of ride demand at defined spatial and temporal granularity",
        category: "AI / Demand Forecasting",
        priority: "High",
        moscow: "Must",
        phase: "MVP",
        linkedCapability: "Predictive demand forecasting",
        owner: "AI Product Owner",
        source: "Business case — solution overview",
        testMethod: "Backtest on holdout + live shadow evaluation",
        subRequirements: [
          "Forecast refreshes at ≤ 5 minute cadence during operational hours",
          "Forecast granularity: ≤ 1 km² zones × 15-minute windows (configurable)",
          "Historical window ≥ 90 days rolling; seasonality features included",
        ],
        acceptanceCriteria: [
          "Forecast MAPE ≤ 15% at zone × 30-min granularity over rolling 14-day evaluation",
          "Forecast job completes within 90 seconds at p95",
          "Fallback to last-known-good forecast when upstream data feed degrades",
        ],
        failureImpact: "Supply is pre-positioned against stale/wrong demand → ETA inflation, lost trips, driver idle time",
        bestPractice: "Ensemble of statistical baseline + ML model with deterministic fallback",
      },
      {
        id: nextFrId(),
        requirement: `The system shall optimize fleet-to-demand assignment in real time`,
        description: "Optimization engine assigns available vehicles to forecasted/actual demand minimising ETA and deadhead",
        category: "AI / Fleet Optimization",
        priority: "High",
        moscow: "Must",
        phase: "MVP",
        linkedCapability: "Fleet optimization and assignment",
        owner: "Optimization Engineering",
        testMethod: "Simulation benchmark + canary rollout",
        subRequirements: [
          "Supports hard constraints (vehicle type, shift, geofence) and soft constraints (fairness, driver preference)",
          "Objective function: minimise weighted ETA + deadhead − utilization",
          "Exposes explainability (why this driver, why this rider) per decision",
        ],
        acceptanceCriteria: [
          "Optimization decision latency ≤ 2 seconds at p95 for 5,000 active vehicles",
          "Utilization uplift ≥ 10% vs. baseline dispatch over 30-day pilot",
          "Deterministic replay from decision ID for audit",
        ],
        failureImpact: "Suboptimal assignments → lower utilization, longer ETA, customer dissatisfaction",
      },
      {
        id: nextFrId(),
        requirement: `The system shall execute dispatch decisions to drivers with acknowledgement and fallback`,
        description: "Real-time dispatch execution with driver ack SLA, timeout, and automated re-dispatch",
        category: "Real-time Dispatch",
        priority: "High",
        moscow: "Must",
        phase: "MVP",
        linkedCapability: "Real-time dispatch execution",
        owner: "Dispatch Platform",
        testMethod: "E2E dispatch drills + chaos injection",
        subRequirements: [
          "Driver ack SLA: 10 seconds; on timeout → automatic re-dispatch to next-best candidate",
          "At-least-once delivery with idempotent handling; exactly-one execution",
          "Manual override path with full audit record",
        ],
        acceptanceCriteria: [
          "End-to-end dispatch (decision → driver accept) median ≤ 3 seconds, p95 ≤ 6 seconds",
          "No dispatch loss under network partition or single-AZ failure",
          "All re-dispatch and override events captured in immutable audit log",
        ],
        failureImpact: "Dispatch loss or duplication → customer double-charge, driver conflict, safety risk",
      },
      {
        id: nextFrId(),
        requirement: `The system shall rebalance idle fleet capacity into predicted demand areas`,
        description: "Push notifications and incentive signals guide idle vehicles toward forecasted hot-spots",
        category: "Fleet Operations",
        priority: "High",
        moscow: "Should",
        phase: "Phase 1",
        linkedCapability: "Fleet rebalancing and positioning",
        owner: "Operations Product",
        testMethod: "A/B test vs. baseline no-rebalance control",
        acceptanceCriteria: [
          "Hot-spot vehicle coverage improves ≥ 20% in target zones during peak",
          "Rebalancing suggestions refresh every ≤ 5 minutes",
          "Driver opt-in respected; no forced relocation",
        ],
        failureImpact: "Fleet concentrates in low-demand areas → service gaps in hot-spots",
      },
      {
        id: nextFrId(),
        requirement: `The system shall ingest external signals (weather, events, traffic, authority data)`,
        description: "Data ingestion pipeline consuming third-party feeds with quality and freshness guarantees",
        category: "Data Integration",
        priority: "High",
        moscow: "Must",
        phase: "MVP",
        linkedCapability: "External-data ingestion",
        owner: "Data Platform",
        testMethod: "Contract tests per feed + freshness monitors",
        subRequirements: [
          "Each feed declared with owner, SLA, schema contract and freshness target",
          "On feed outage → graceful degradation with flag surfaced to control tower",
          "Lineage captured from source → feature store → model",
        ],
        acceptanceCriteria: [
          "Ingestion latency ≤ 1 minute for streaming feeds, ≤ 15 minutes for batch",
          "Data quality score ≥ 95% (schema conformance + freshness) per feed per day",
          "Feed outages surfaced within 60 seconds in control tower",
        ],
        failureImpact: "Stale inputs → forecast drift → poor dispatch decisions",
      },
      {
        id: nextFrId(),
        requirement: `The system shall provide a control tower dashboard for supervised operations`,
        description: "Real-time operations view with KPI, live fleet state, incidents and override controls",
        category: "Operations UX",
        priority: "High",
        moscow: "Must",
        phase: "MVP",
        linkedCapability: "Control tower operations",
        owner: "Ops Product",
        testMethod: "Operator UAT + incident drill",
        acceptanceCriteria: [
          "Map and KPI panels refresh ≤ 5 seconds at p95",
          "Supervisor can override an active dispatch decision in ≤ 3 interactions with audit trail",
          "Incident flags visible within 60 seconds of trigger",
        ],
        failureImpact: "Operators blind to system state → unable to intervene in incidents",
      },
      {
        id: nextFrId(),
        requirement: `The system shall provide driver-side communication and status UX`,
        description: "Driver app or integration receiving assignments, navigation cues, and status events",
        category: "Driver UX",
        priority: "High",
        moscow: "Must",
        phase: "MVP",
        linkedCapability: "Driver communication and UX",
        owner: "Driver Product",
        testMethod: "Field pilot with instrumented drivers",
        acceptanceCriteria: [
          "Assignment push delivered within 3 seconds of decision at p95",
          "Navigation, passenger contact and status transitions accessible one-tap",
          "Offline-tolerant: last-known state preserved across 60-second connectivity loss",
        ],
        failureImpact: "Drivers miss or mis-execute assignments → trip failure",
      },
      {
        id: nextFrId(),
        requirement: `The system shall provide exception, override and escalation handling`,
        description: "Structured workflow for manual override, incident escalation, and SLA breach response",
        category: "Operations Governance",
        priority: "High",
        moscow: "Must",
        phase: "MVP",
        linkedCapability: "Control tower operations",
        owner: "Ops Product",
        testMethod: "Tabletop incident drill + audit review",
        acceptanceCriteria: [
          "Override, incident and escalation actions fully logged with actor, reason, timestamp",
          "Severity-based routing matches service-management runbook",
          "All manual overrides reconcilable against automated decision log",
        ],
        failureImpact: "Untracked overrides → governance breach, no learning loop",
      },
      {
        id: nextFrId(),
        requirement: `The system shall monitor KPI, forecast accuracy and dispatch performance`,
        description: "Operational KPI dashboard and model-quality monitoring with alerting",
        category: "Observability",
        priority: "High",
        moscow: "Must",
        phase: "MVP",
        linkedCapability: "KPI and performance monitoring",
        owner: "SRE + Data Science",
        testMethod: "Synthetic KPI drift + alert rehearsal",
        acceptanceCriteria: [
          "Primary KPIs (utilization, ETA, forecast MAPE, cancellation) tracked per zone and shift",
          "Forecast accuracy degradation alerts fire within 1 hour",
          "SLO burn-rate alerts wired to on-call",
        ],
        failureImpact: "System degradation invisible → silent loss of value",
      },
      {
        id: nextFrId(),
        requirement: `The system shall retrain and promote AI models under governed MLOps`,
        description: "Training pipeline, evaluation, approval and rollback for AI models in production",
        category: "MLOps",
        priority: "High",
        moscow: "Must",
        phase: "Phase 1",
        linkedCapability: "Predictive demand forecasting",
        owner: "AI Platform",
        testMethod: "Promotion-pipeline dry-run + rollback drill",
        acceptanceCriteria: [
          "Retraining cadence ≤ 30 days; emergency retrain path documented",
          "Candidate model promotion requires passing offline + shadow evaluation thresholds",
          "Rollback to previous model achievable within 15 minutes",
        ],
        failureImpact: "Model drift unchecked → decision quality decays silently",
      },
    );
  } else {
    functionalRequirements.push(
      {
        id: nextFrId(),
        requirement: `The system shall support structured submission, review and approval for ${title}`,
        description: `Capture, review and progress ${title} work items with governed lifecycle`,
        category: "Core Workflow",
        priority: "High",
        moscow: "Must",
        phase: "MVP",
        linkedCapability: `${title} core workflow enablement`,
        owner: `${department} Product Owner`,
        source: "Business case — business requirements",
        testMethod: "Automated E2E + UAT",
        acceptanceCriteria: [
          "Work items captured with mandatory context fields in ≤ 3 minutes median",
          "Approval states visible on item and list views with audit trail",
        ],
        failureImpact: "Fragmented intake → lost audit trail → governance breach",
      },
      {
        id: nextFrId(),
        requirement: `The system shall provide decision-ready analytics and reporting for ${title}`,
        description: `KPI and status reporting grounded in ${objective}`,
        category: "Reporting & Analytics",
        priority: "High",
        moscow: "Must",
        phase: "MVP",
        linkedCapability: `${title} analytics and reporting`,
        owner: "Analytics",
        testMethod: "Report accuracy cross-check + UAT",
        acceptanceCriteria: [
          "Primary KPI dashboard refreshes at least every 15 minutes",
          "Report exports in PDF and Excel with provenance metadata",
        ],
        failureImpact: "Blind-spot decisions → governance pressure",
      },
    );
    if (profile.isAiDriven) {
      functionalRequirements.push({
        id: nextFrId(),
        requirement: `The system shall operate AI/ML models with explainability, monitoring and fallback`,
        category: "AI / MLOps",
        priority: "High",
        moscow: "Must",
        phase: "MVP",
        linkedCapability: "AI/ML inference and governance",
        owner: "AI Platform",
        acceptanceCriteria: [
          "Every production model has a model card, monitoring plan and fallback path",
          "Confidence below configured threshold triggers deterministic fallback",
          "Drift/accuracy alerts wired to on-call within 1 hour",
        ],
      });
    }
    if (profile.isExternallyIntegrated) {
      functionalRequirements.push({
        id: nextFrId(),
        requirement: "The system shall integrate with declared external systems under governed contracts",
        category: "External Integration",
        priority: "High",
        moscow: "Must",
        phase: "MVP",
        linkedCapability: "External integration platform",
        owner: "Integration Platform",
        acceptanceCriteria: [
          "Each integration has owner, schema contract, SLA and failure handling documented",
          "Contract tests pass before every release",
          "Partner outages surface as actionable alerts, not silent failures",
        ],
      });
    }
  }

  // Always add baseline cross-cutting FRs (operations + auditability)
  functionalRequirements.push({
    id: nextFrId(),
    requirement: "The system shall maintain immutable audit records for every governed action",
    category: "Governance",
    priority: "High",
    moscow: "Must",
    phase: "MVP",
    owner: "Platform Security",
    acceptanceCriteria: [
      "Every governance-relevant action captured with actor, subject, result, timestamp",
      "Audit store is append-only and tamper-evident",
      "Retention aligns with NESA / ISO 27001 policy (≥ 7 years)",
    ],
  });

  // ── Non-Functional Requirements (engineering-grade, deduped vs SR) ───────
  const nonFunctionalRequirements: Array<Record<string, unknown>> = [];
  let nfrCounter = 1;
  const nextNfrId = () => `NFR-${String(nfrCounter++).padStart(3, "0")}`;

  if (profile.isDispatchOrLogistics) {
    nonFunctionalRequirements.push(
      { id: nextNfrId(), requirement: "Forecast refresh latency SLO", category: "Performance · AI", priority: "High", scope: "Forecasting pipeline", metric: "Forecast job end-to-end latency", target: "≤ 5 minutes p95", threshold: "> 10 min triggers alert", measurement: "Pipeline telemetry + dashboard", testMethod: "Continuous SLO monitoring", phase: "MVP", owner: "AI Platform" },
      { id: nextNfrId(), requirement: "Dispatch decision latency SLO", category: "Performance · Dispatch", priority: "High", scope: "End-to-end dispatch path", metric: "Decision → driver ack latency", target: "p50 ≤ 2s, p95 ≤ 6s", threshold: "p95 > 10s = Sev2", measurement: "Distributed tracing spans", testMethod: "Synthetic probes + production RUM", phase: "MVP", owner: "Dispatch SRE" },
      { id: nextNfrId(), requirement: "Data ingestion throughput and freshness", category: "Scalability · Data", priority: "High", scope: "All streaming feeds", metric: "Events/sec sustained and feed lag", target: "≥ 20,000 events/sec sustained; feed lag ≤ 60s", threshold: "Lag > 5 min = Sev2", measurement: "Ingestion dashboard + lag probes", testMethod: "Load test at 1.3× forecast peak", phase: "MVP", owner: "Data Platform" },
      { id: nextNfrId(), requirement: "System availability for operational services", category: "Availability", priority: "High", scope: "Dispatch + forecasting + control tower", metric: "Monthly availability", target: "≥ 99.9%", threshold: "99.5% monthly = Sev1 review", measurement: "Probe + real-user telemetry", testMethod: "SLO burn rate alerting", phase: "MVP", owner: "SRE" },
      { id: nextNfrId(), requirement: "Forecast model accuracy target", category: "Model Quality · AI", priority: "High", scope: "Production forecasting model", metric: "MAPE at zone × 30-min window", target: "MAPE ≤ 15%", threshold: "MAPE > 20% for 7 days = retrain trigger", measurement: "Daily offline eval on live data", testMethod: "Backtest + shadow eval", phase: "MVP", owner: "Data Science" },
      { id: nextNfrId(), requirement: "Peak concurrency and throughput capacity", category: "Capacity", priority: "High", scope: "Peak operational window", metric: "Concurrent active vehicles and trips/sec", target: "5,000+ active vehicles, 200+ dispatch/sec sustained", threshold: "Utilisation > 70% = scale event", measurement: "Load test + production telemetry", testMethod: "Quarterly load test", phase: "Phase 1", owner: "SRE" },
      { id: nextNfrId(), requirement: "Disaster recovery RTO/RPO for operational services", category: "Disaster Recovery", priority: "High", scope: "Tier-1 services", metric: "RTO / RPO under regional failure", target: "RTO ≤ 1h, RPO ≤ 5 min", threshold: "Drill breach = Sev1", measurement: "Quarterly DR drill", testMethod: "Timed failover", phase: "Phase 1", owner: "SRE / BCM" },
      { id: nextNfrId(), requirement: "AI governance telemetry", category: "AI Governance · Observability", priority: "High", scope: "All production models", metric: "Explainability + drift + fallback telemetry coverage", target: "100% models instrumented with confidence, drift, fallback-rate KPIs", threshold: "Any uninstrumented model blocks promotion", measurement: "Model registry conformance", testMethod: "Pre-promotion gate", phase: "Phase 1", owner: "AI Governance Office" },
    );
  } else {
    nonFunctionalRequirements.push(
      { id: nextNfrId(), requirement: "User-journey responsiveness", category: "Performance", priority: "High", scope: "Primary journeys", metric: "End-to-end interaction latency", target: "p95 ≤ 3s", threshold: "p95 > 5s alerts", measurement: "Real-user monitoring", testMethod: "RUM + synthetic", phase: "MVP", owner: "Platform Engineering" },
      { id: nextNfrId(), requirement: "System availability", category: "Availability", priority: "High", scope: "All production services", metric: "Monthly availability", target: "≥ 99.9%", threshold: "99.5% monthly = Sev1 review", measurement: "Probe + RUM", testMethod: "SLO burn rate", phase: "MVP", owner: "SRE" },
      { id: nextNfrId(), requirement: "Disaster recovery RTO/RPO", category: "Disaster Recovery", priority: "High", scope: "Tier-1", metric: "RTO / RPO", target: "RTO ≤ 1h, RPO ≤ 5 min", threshold: "Drill breach = Sev1", measurement: "Quarterly DR drill", testMethod: "Timed failover", phase: "Phase 1", owner: "SRE / BCM" },
      { id: nextNfrId(), requirement: "Capacity at peak", category: "Capacity", priority: "High", scope: "Peak window", metric: "Concurrent users / TPS", target: "Sized to forecast peak + 30% headroom", threshold: "Utilisation > 70% = scale event", measurement: "Load test + telemetry", testMethod: "Quarterly load test", phase: "Phase 1", owner: "SRE" },
    );
  }
  // Support & SLA NFR always applies
  nonFunctionalRequirements.push({
    id: nextNfrId(),
    requirement: "Tiered support operating model with severity-based SLA",
    category: "Support & SLA",
    priority: "High",
    scope: "All production services",
    metric: "L1/L2/L3 severity-based response and resolution",
    target: "Sev1 ack ≤ 15 min / resolve ≤ 4h; Sev2 ack ≤ 1h / resolve ≤ 24h",
    threshold: "SLA breach triggers postmortem",
    measurement: "Ticketing SLA reports",
    testMethod: "Monthly SLA attainment review",
    phase: "MVP",
    owner: "Service Management",
  });

  // ── Security Requirements (HOW governance is enforced) ───────────────────
  // Distinct from NFRs: NFRs = outcomes/metrics; SRs = controls/mechanisms.
  const securityRequirements: Array<Record<string, unknown>> = [
    {
      id: "SR-001",
      requirement: "Enforce role-based and attribute-based access control with immutable audit logging",
      category: "Access Control",
      priority: "High",
      compliance: complianceRequirements[0] || "ISO 27001 / NESA",
      control: "ISO 27001 A.9 / NIST AC-2",
      owner: "Platform Security",
      implementation: "Centralised IdP, RBAC/ABAC policy engine, signed append-only audit events",
      logging: "All auth/z decisions logged (subject, action, resource, decision, reason)",
      auditRetention: "7 years WORM aligned to NESA retention",
      monitoring: "SIEM rule on privilege escalation and anomalous access",
      keyManagement: "KMS CMK with FIPS 140-2 L3 HSM root, UAE-local key partition",
      keyRotation: "Automatic rotation every 90 days; emergency rotation via runbook",
      credentialLifecycle: "Vault-backed dynamic credentials; CI/CD uses OIDC federation with no static tokens",
      privilegedAccess: "Just-in-time elevation via PAM broker with session recording",
      dataMasking: "PII masked in non-prod and BI layer; Emirates ID → last 4 digits; phone → hashed in logs",
      incidentResponse: "SOC runbook IR-AUTH-01",
      testingRequirement: "Annual pentest + quarterly access review",
      phase: "MVP",
    },
    {
      id: "SR-002",
      requirement: "Enforce data residency and end-to-end lineage auditability for regulated data",
      category: "Data Sovereignty & Lineage",
      priority: "High",
      compliance: complianceRequirements[1] || complianceRequirements[0] || "UAE Data Protection Law / NESA",
      control: "Policy-as-code region pinning + data catalog lineage",
      owner: "Data Governance Office",
      implementation: "Cloud region policy guardrails + data catalog integration; any cross-region egress blocked at platform layer",
      logging: "Every regulated-data access captured in lineage store",
      auditRetention: "7 years immutable",
      monitoring: "Automated drift detection with Sev1 on egress attempt",
      testingRequirement: "Policy-as-code validation on every release + quarterly audit",
      phase: "MVP",
    },
  ];
  if (profile.isAiDriven) {
    securityRequirements.push({
      id: "SR-003",
      requirement: "Enforce AI model governance controls — provenance, approval, explainability and rollback",
      category: "AI Governance Controls",
      priority: "High",
      compliance: "NIST AI RMF / internal Responsible AI policy",
      control: "Model registry with signed provenance; gated promotion; explainability artefact required",
      owner: "AI Governance Office",
      implementation: "Every model has a model card, signed training lineage, evaluation results, approver, and documented fallback",
      logging: "Inference decisions sampled with input/feature hash + confidence score",
      monitoring: "Drift, bias and fallback-rate monitoring wired to governance dashboard",
      incidentResponse: "Model withdrawal runbook IR-AI-01",
      testingRequirement: "Quarterly bias audit + shadow eval before promotion",
      phase: "Phase 1",
    });
  }
  if (profile.isExternallyIntegrated || profile.isDispatchOrLogistics) {
    securityRequirements.push({
      id: `SR-${String(securityRequirements.length + 1).padStart(3, "0")}`,
      requirement: "Enforce integration-layer security — mTLS, schema validation, rate limiting and outbound DLP",
      category: "Integration Security",
      priority: "High",
      compliance: "ISO 27001 A.13 / NESA",
      control: "API gateway with mTLS, JWT/OIDC, schema validation, rate limits; DLP on outbound",
      owner: "Integration Platform Security",
      implementation: "All external traffic passes API gateway; partner-specific IP allow-lists; payload schema enforced",
      monitoring: "Gateway anomaly detection + DLP alerts",
      testingRequirement: "Per-partner security test before onboarding",
      phase: "MVP",
    });
  }

  // ── AI specification layer (operationalises AI beyond NFRs) ─────────────
  const aiSpecification = profile.isAiDriven ? {
    models: profile.isDispatchOrLogistics ? [
      { name: "Demand forecasting model", type: "Supervised ML — time-series / gradient-boosted ensemble", purpose: "Predict trip demand per zone × time window", inferenceCadence: "Batch every 5 min, hot refresh on anomaly", fallback: "Last-known-good forecast + rule-based historical average" },
      { name: "Dispatch optimization model", type: "Optimization (MIP / heuristic) with ML-augmented scoring", purpose: "Assign vehicles to demand minimising weighted ETA + deadhead", inferenceCadence: "Real-time per event (seconds)", fallback: "Rule-based nearest-vehicle dispatch within service-area rules" },
    ] : [
      { name: `Primary ${title} model`, type: "Supervised ML (exact architecture to be confirmed during design)", purpose: objective, inferenceCadence: "To be specified per use case", fallback: "Deterministic rule-based fallback required" },
    ],
    trainingCadence: "≤ 30 days, emergency retrain path documented",
    confidenceThreshold: "Configurable per model; below threshold → deterministic fallback",
    fallbackStrategy: "All production models have a deterministic, rule-based fallback that is tested in the same release cycle",
    humanInTheLoop: profile.isDispatchOrLogistics ? "Control tower can override any automated decision; all overrides audited" : "Supervised review for sensitive decisions",
    explainability: "Per-decision explanation surfaced in audit and operator views",
  } : undefined;

  // ── Operating model (who operates, automation boundary, escalation) ─────
  const operatingModel = {
    ownership: profile.isDispatchOrLogistics ? "Control Tower (Operations) owns runtime supervision; Data Science owns models; SRE owns platform" : `${department} business owner; Platform Engineering owns runtime`,
    automationBoundary: profile.isDispatchOrLogistics
      ? "Automated dispatch under defined safety envelope (service-area, vehicle constraints, policy); human override required for out-of-envelope decisions, incidents, and safety-critical interventions"
      : "Automated routine actions with human approval gate for governance-relevant transitions",
    controlRoom: profile.isDispatchOrLogistics ? "Active 24×7 control tower with supervisors, dispatchers and incident commander roles" : undefined,
    escalationPath: "Sev1 → on-call commander → duty exec within 15 min; Sev2 → on-call lead within 1h; Sev3 → next business day",
    humanOverride: "Every automated decision reversible via documented override path with audit trail",
    incidentHandling: "Severity-based runbook with postmortem for Sev1/Sev2 within 5 business days",
  };

  // ── Integration architecture (maps to capability F) ─────────────────────
  const integrations: Array<Record<string, unknown>> = [];
  let intCounter = 1;
  const pushIntegration = (name: string, extra: Record<string, unknown>) => {
    integrations.push({ id: `INT-${String(intCounter++).padStart(3, "0")}`, name, ...extra });
  };
  profile.integrationTargets.forEach((target) => {
    const isAuthority = /rta|authority/i.test(target);
    const isWeather = /weather/i.test(target);
    const isEvent = /event|venue/i.test(target);
    const isTraffic = /traffic/i.test(target);
    pushIntegration(target, {
      type: isAuthority ? "Government / Authority API" : isWeather ? "Environmental data" : isEvent ? "Event schedule" : isTraffic ? "Traffic feed" : "External partner",
      direction: "inbound",
      protocol: isAuthority ? "REST + OAuth2 (mTLS)" : "REST / streaming",
      frequency: isWeather || isEvent ? "Hourly / daily" : "Streaming + poll fallback",
      sla: "To be agreed with data owner",
      security: "mTLS + signed request + IP allow-list",
      owner: "Integration Platform",
      phase: "MVP",
    });
  });
  if (integrations.length === 0 && integrationRequirements.length > 0) {
    integrationRequirements.forEach((req) => pushIntegration(req, { direction: "inbound", phase: "MVP", owner: "Integration Platform" }));
  }
  // Always include internal dispatch integration for dispatch projects
  if (profile.isDispatchOrLogistics) {
    pushIntegration("Driver mobile app / terminal", { type: "Driver UX", direction: "bi-directional", protocol: "WebSocket + REST", frequency: "real-time", sla: "≤ 3s dispatch push p95", security: "OAuth2 + device attestation", owner: "Driver Product", phase: "MVP" });
    pushIntegration("Payment / fare settlement", { type: "Payment", direction: "outbound", protocol: "REST", frequency: "per-trip", sla: "Settlement ≤ 24h", security: "PCI-DSS scoped", owner: "Finance Systems", phase: "Phase 1" });
  }

  // ── Data requirements (maps to capability B / data platform) ────────────
  const dataRequirements: Array<Record<string, unknown>> = [];
  let dataCounter = 1;
  const pushData = (entity: string, extra: Record<string, unknown>) => {
    dataRequirements.push({ id: `DATA-${String(dataCounter++).padStart(3, "0")}`, entity, ...extra });
  };
  profile.dataSources.forEach((source) => {
    const isTelemetry = /telemetry|gps/i.test(source);
    const isWeather = /weather/i.test(source);
    const isEvent = /event|venue/i.test(source);
    const isCustomer = /customer/i.test(source);
    pushData(source, {
      classification: isCustomer ? "Confidential / PII" : "Internal",
      residency: "UAE-only",
      source: isWeather ? "Licensed weather provider" : isEvent ? "Venue partner API" : isTelemetry ? "Onboard vehicle unit" : "Internal / partner system",
      retention: isCustomer ? "As per UAE Data Protection Law" : "5 years",
      qualityRules: ["Schema-conforming", "Freshness within declared SLA", "Lineage-traced"],
      owner: "Data Governance Office",
      reportingUse: profile.isDispatchOrLogistics ? "Forecast features + operational dashboards" : "Analytics and reporting",
    });
  });

  // ── Operational requirements (ops workflows) ────────────────────────────
  const operationalRequirements: Array<Record<string, unknown>> = [];
  if (profile.isDispatchOrLogistics) {
    operationalRequirements.push(
      { id: "OPS-001", workflow: "Control tower dispatch override", trigger: "Supervisor identifies anomalous or unsafe assignment", escalationPath: "Supervisor → Shift lead → Incident commander (Sev1)", failSafeMode: "Hold vehicle in place; block new assignments until cleared", manualOverride: "Single-action override with mandatory reason and audit log", rto: "Immediate (≤ 5s)", rpo: "N/A (idempotent)", owner: "Control Tower Ops", safetyCritical: true, phase: "MVP" },
      { id: "OPS-002", workflow: "Forecast feed degradation response", trigger: "Any upstream feed SLA breach", escalationPath: "Data Platform on-call → AI Platform on-call", failSafeMode: "Switch forecasting to last-known-good model + banner in control tower", rto: "Service continues; model banner within 60s", owner: "Data Platform", phase: "MVP" },
      { id: "OPS-003", workflow: "Model rollback", trigger: "Drift / accuracy SLO breach or incident", escalationPath: "AI Platform on-call → AI Governance Office", failSafeMode: "Revert to previous approved model revision", rto: "≤ 15 minutes", owner: "AI Platform", phase: "Phase 1" },
      { id: "OPS-004", workflow: "Safety-critical incident escalation", trigger: "Vehicle / passenger / driver safety event detected or reported", escalationPath: "Dispatcher → Shift lead → Duty exec → Authority liaison", failSafeMode: "Hold affected vehicles; activate incident channel", owner: "Operations Director", safetyCritical: true, phase: "MVP" },
    );
  }

  return {
    artifactType: "REQUIREMENTS",
    solutionProfile: {
      tokens: profile.domainTokens,
      components: profile.solutionComponents,
      summary: profile.solutionSummary || summary || undefined,
    },
    capabilities,
    functionalRequirements,
    nonFunctionalRequirements,
    securityRequirements,
    aiSpecification,
    operatingModel,
    integrations,
    dataRequirements,
    operationalRequirements,
    capabilityGaps: risks.slice(0, 3).map((risk, index) => ({
      gap: String(risk.name || `Gap ${index + 1}`),
      currentState: "Advisory risk or delivery constraint identified",
      targetState: String(risk.mitigation || "Controlled implementation state"),
      recommendation: String(risk.description || risk.impact || "Refine requirement coverage for this area"),
    })),
    requiredTechnology: {
      frontend: profile.isDispatchOrLogistics ? ["Control tower web app", "Driver mobile / terminal UX"] : ["Web application interface"],
      backend: profile.isDispatchOrLogistics ? ["Dispatch services", "Forecasting service", "Optimization engine", "API gateway", "Message bus / event streaming"] : ["Workflow and API services"],
      database: profile.isDispatchOrLogistics ? ["Operational OLTP", "Time-series / event store", "Feature store"] : ["Transactional data store"],
      infrastructure: integrationRequirements.length > 0 ? integrationRequirements : ["Secure cloud hosting (UAE region)"],
      tools: ["Observability and tracing", "Model registry / MLOps", "Audit logging", "CI/CD"],
    },
    requiredResources: {
      teamSize: profile.isDispatchOrLogistics ? "12-20 team members across ops, data science, platform" : "6-10 team members",
      budgetEstimate: String(demandReport.budgetRange || businessCase?.totalCostEstimate || "To be finalized"),
      timelineEstimate: profile.isDispatchOrLogistics ? "9-15 months to production" : "6-12 months",
      infrastructure: constraints.length > 0 ? constraints : ["UAE-region environment", "Integration access to partner APIs"],
    },
    rolesAndResponsibilities: profile.isDispatchOrLogistics ? [
      { role: "Product Owner — Dispatch", count: "1", responsibilities: ["Own dispatch product roadmap", "Prioritise FR backlog"], skills: ["Mobility product", "Stakeholder management"] },
      { role: "Data Science Lead", count: "1", responsibilities: ["Own forecasting + optimization models", "MLOps governance"], skills: ["ML engineering", "Operations research"] },
      { role: "Integration Engineer", count: "2", responsibilities: ["Own external integrations", "Contract enforcement"], skills: ["API design", "Event streaming"] },
      { role: "SRE / Platform Engineer", count: "2", responsibilities: ["Availability, capacity, DR"], skills: ["SRE", "Observability"] },
      { role: "Control Tower Lead", count: "1", responsibilities: ["Ops supervision, override workflow, incident response"], skills: ["Operations", "Incident management"] },
      { role: "Solution Architect", count: "1", responsibilities: ["End-to-end architecture"], skills: ["Architecture", "Integration"] },
    ] : [
      { role: "Project Manager", count: "1", responsibilities: ["Coordinate delivery plan", "Track governance and milestones"], skills: ["Planning", "Stakeholder management"] },
      { role: "Business Analyst", count: "1-2", responsibilities: ["Refine requirements", "Validate business rules"], skills: ["Requirements engineering", "Process analysis"] },
      { role: "Solution Architect", count: "1", responsibilities: ["Define solution structure", "Guide integrations"], skills: ["Architecture", "Integration"] },
    ],
    assumptions: expectedOutcomes.length > 0 ? expectedOutcomes : ["Stakeholders will review and refine generated requirements before approval"],
    constraints,
    integrationRequirements,
    complianceRequirements,
    recommendations: {
      summary: summary || `Requirements for ${title} synthesised from business case and advisory context with solution-specific pack (${profile.domainTokens.join(", ") || "general"}).`,
    },
    meta: {
      generatedAt: new Date().toISOString(),
      engine: "A",
      fallback: true,
      synthesisSource: businessCase ? "business_case+advisory" : "advisory_package",
      solutionTokens: profile.domainTokens,
    },
  };
}

async function resolveRequirementsDraft(
  deps: RequirementsDeps,
  demandReport: Record<string, unknown>,
  decisionSpineId: string | undefined,
  brainResult: Record<string, unknown> | null | undefined,
  businessCase?: Record<string, unknown> | null,
): Promise<ResolvedRequirementsDraft> {
  const pipelineDraft = getRequirementsDraftFromPayload(brainResult);
  if (pipelineDraft.draft) {
    return pipelineDraft;
  }

  if (!decisionSpineId) {
    return pipelineDraft;
  }

  try {
    const storedDecision = await deps.brain.getFullDecisionWithLayers(decisionSpineId);
    const storedDraft = getRequirementsDraftFromPayload(storedDecision as Record<string, unknown> | undefined);
    if (storedDraft.draft) {
      return { ...storedDraft, source: "stored_advisory" };
    }

    const { advisoryPayload, advisoryKeys } = getGeneratedArtifacts(storedDecision as Record<string, unknown> | undefined);
    const synthesizedDraft = buildRequirementsDraftFromAdvisoryContext(demandReport, advisoryPayload || {}, businessCase);
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
    logger.warn("[Requirements] Stored decision fallback lookup failed", {
      decisionSpineId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const { advisoryPayload, advisoryKeys } = getGeneratedArtifacts(brainResult);
  const synthesizedDraft = buildRequirementsDraftFromAdvisoryContext(demandReport, advisoryPayload || {}, businessCase);
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

export function createDemandReportsRequirementsRoutes(storage: DemandStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const allDeps = buildDemandDeps(storage);
  const deps: RequirementsDeps = allDeps;

  router.post("/:id/generate-requirements", auth.requireAuth, auth.requirePermission("requirements:generate"), async (req, res) => {
    try {
      const { id } = req.params as { id: string };

      const demandReport = await deps.reports.findById(id);
      if (!demandReport) {
        return res.status(404).json({ success: false, error: "Demand report not found" });
      }

      const userId = req.session.userId as string;

      // Fetch business case early so we can ground both the brain prompt and the
      // deterministic fallback in the actual solution context (solution overview,
      // proposed solution, SMART objectives, scope, etc.). Without this, the brain
      // only sees demand-report headers and produces generic platform-level output.
      const businessCase = await deps.businessCase.findByDemandReportId(id);
      const businessCaseRecord = (businessCase as unknown as Record<string, unknown> | undefined) || null;

      const demandDecisionSpineId = demandReport.decisionSpineId as string | undefined;
      const decisionSpineId = demandDecisionSpineId
        || (businessCaseRecord?.decisionSpineId as string | undefined)
        || ((demandReport.aiAnalysis as Record<string, unknown> | undefined)?.decisionId as string | undefined)
        || (await deps.brain.findLatestDecisionByDemandReportId(id))?.id;

      // ── ARCHITECTURAL GATE: parent-spine approval is authoritative ──────────
      // Approval is a property of the decision spine, evaluated once at intake.
      // Generating Requirements MUST NOT spin up a fresh Layer-7 HITL gate when
      // the parent demand spine is already approved (that produced the duplicate
      // PMO approvals). And it MUST NOT push another pipeline run while the spine
      // is already pending PMO sign-off (that produced "processing in background"
      // with no progress).
      const parentApproval = await resolveParentApprovalState(deps.brain, decisionSpineId, demandReport);
      if (parentApproval.kind === "pending") {
        logger.info("[Generate Reqs] Spine has pending Layer-7 approval — short-circuiting (no pipeline rerun)", {
          reportId: id,
          decisionSpineId,
          approvalId: parentApproval.approvalId,
        });
        return res.json({
          success: false,
          requiresApproval: true,
          approvalDecisionId: decisionSpineId,
          approvalId: parentApproval.approvalId,
          message: "Requirements generation is awaiting PMO approval. Generation will run automatically once approved.",
        });
      }
      const parentDemandApproved = parentApproval.kind === "approved";
      if (parentDemandApproved) {
        logger.info("[Generate Reqs] Parent demand spine already approved — inheriting governance (skip L7 HITL rerun)", {
          reportId: id,
          decisionSpineId,
          approvalId: parentApproval.approvalId,
        });
      }

      // ========== COREVIA BRAIN PIPELINE ==========
      const brainInput = {
        demandReportId: id,
        projectName: demandReport.suggestedProjectName,
        organizationName: demandReport.organizationName,
        requestorName: demandReport.requestorName,
        businessObjective: demandReport.businessObjective,
        problemStatement: demandReport.problemStatement,
        department: demandReport.department,
        budgetRange: demandReport.budgetRange,
        expectedOutcomes: demandReport.expectedOutcomes,
        integrationRequirements: demandReport.integrationRequirements,
        complianceRequirements: demandReport.complianceRequirements,
        constraints: demandReport.constraints,
        // Propagate the demand's normalized classification so Layer 2 doesn't
        // silently reclassify CONFIDENTIAL/SOVEREIGN as INTERNAL and route the
        // request to Engine B (External Hybrid). Without this, sovereign data
        // could leak across the engine boundary.
        ...getDemandClassificationFields(demandReport as Record<string, unknown>),
        intent: `Generate detailed requirements analysis for: ${demandReport.suggestedProjectName || id}`,
        // Full business case context — the brain MUST use this to ground the
        // requirements in the actual proposed solution, not the COREVIA platform.
        businessCase: businessCaseRecord ? {
          executiveSummary: businessCaseRecord.executiveSummary,
          businessRequirements: businessCaseRecord.businessRequirements,
          backgroundContext: businessCaseRecord.backgroundContext,
          problemStatement: businessCaseRecord.problemStatement,
          smartObjectives: businessCaseRecord.smartObjectives,
          scopeDefinition: businessCaseRecord.scopeDefinition,
          expectedDeliverables: businessCaseRecord.expectedDeliverables,
          solutionOverview: businessCaseRecord.solutionOverview,
          proposedSolution: businessCaseRecord.proposedSolution,
          alternativeSolutions: businessCaseRecord.alternativeSolutions,
          totalCostEstimate: businessCaseRecord.totalCostEstimate,
          totalBenefitEstimate: businessCaseRecord.totalBenefitEstimate,
        } : undefined,
        ...(parentDemandApproved
          ? { parentDemandApproved: true, parentDecisionSpineId: decisionSpineId }
          : {}),
      };

      if (decisionSpineId) {
        const highestLayer = await deps.brain.getHighestLayerForSpine(decisionSpineId);
        logger.info('[Requirements] Layer 5 gate check:', { decisionSpineId, highestLayer });
        if (highestLayer < 5) {
          return res.status(400).json({
            success: false,
            error: "Demand request must reach Layer 5 before requirements generation",
            details: { currentLayer: highestLayer },
          });
        }
      }

      logger.info(`\n========== COREVIA BRAIN: Requirements Analysis ==========`);
      const BRAIN_TIMEOUT_MS = TIMEOUTS.REQUIREMENTS;
      const timeoutMessage = `Requirements generation timed out after ${Math.round(BRAIN_TIMEOUT_MS / 1000)}s — please try again`;
      const brainAbortController = new AbortController();
      const brainPromise = deps.brain.execute(
        "requirements_analysis",
        "requirements.generate",
        brainInput,
        userId,
        getAuthenticatedOrganizationId(req) as string,
        {
          decisionSpineId,
          abortSignal: brainAbortController.signal,
        }
      );
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const brainTimeout = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          const timeoutError = new Error(timeoutMessage);
          brainAbortController.abort(timeoutError);
          reject(timeoutError);
        }, BRAIN_TIMEOUT_MS);
      });
      let brainResult: Awaited<ReturnType<typeof deps.brain.execute>> | null = null;
      let brainTimedOut = false;
      try {
        brainResult = await Promise.race([brainPromise, brainTimeout]);
        logger.info(`[Brain] Pipeline result: ${brainResult.finalStatus} (Decision: ${brainResult.decisionId})`);
      } catch (pipelineError) {
        const errorMessage = pipelineError instanceof Error ? pipelineError.message : String(pipelineError);
        brainTimedOut = errorMessage.includes("timed out");
        if (!brainTimedOut) {
          brainAbortController.abort(pipelineError);
        }
        logger.warn("[Requirements] Brain pipeline failed — will attempt advisory synthesis fallback", {
          decisionSpineId,
          timedOut: brainTimedOut,
          error: errorMessage,
        });
      } finally {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      }
      const resolvedDecisionSpineId = decisionSpineId || brainResult?.decisionId;
      if (resolvedDecisionSpineId && !demandReport.decisionSpineId) {
        await deps.reports.update(id, { decisionSpineId: resolvedDecisionSpineId });
      }

      const resolvedDraft = await resolveRequirementsDraft(
        deps,
        demandReport as unknown as Record<string, unknown>,
        resolvedDecisionSpineId,
        brainResult as unknown as Record<string, unknown> | undefined,
        businessCaseRecord,
      );
      let requirementsAnalysis = resolvedDraft.draft;

      // === No silent fallback policy ===
      // If the AI pipeline did not produce a real draft (timeout, blocked, pending approval,
      // failed, or only advisory synthesis available), surface a structured 409 BLOCKED
      // response. The deterministic template is only generated when the caller explicitly
      // opts in via `?acceptFallback=true`.
      const acceptFallback = isAcceptFallbackOptIn(req as unknown as Record<string, unknown>);
      const hasPipelineDraft =
        Boolean(requirementsAnalysis) && resolvedDraft.source === "pipeline";

      if (
        shouldBlockGeneration({
          brainResult: brainResult as unknown as Record<string, unknown> | null | undefined,
          brainTimedOut,
          pipelineError: brainTimedOut ? new Error("timeout") : undefined,
          draftSource: resolvedDraft.source,
          hasPipelineDraft,
        }) &&
        !acceptFallback
      ) {
        const blocked = buildBlockedGenerationResponse({
          artifact: "REQUIREMENTS",
          reportId: id,
          decisionSpineId: resolvedDecisionSpineId,
          brainResult: brainResult as unknown as Record<string, unknown> | null | undefined,
          brainTimedOut,
          pipelineError: brainTimedOut ? new Error("Pipeline timed out") : undefined,
          draftSource: resolvedDraft.source,
          fallbackAvailable: true,
        });
        logger.info("[Requirements] Generation blocked — surfaced structured response to client", {
          reportId: id,
          decisionSpineId: resolvedDecisionSpineId,
          brainStatus: brainResult?.finalStatus,
          reasons: blocked.reasons.map((r) => r.code),
        });
        return res.status(409).json(blocked);
      }

      // Caller explicitly opted into the deterministic template (acceptFallback=true)
      // OR pipeline produced a real draft. If still no draft and user opted in, build it.
      if (!requirementsAnalysis && acceptFallback) {
        const lastResort = buildRequirementsDraftFromAdvisoryContext(
          demandReport as unknown as Record<string, unknown>,
          {},
          businessCaseRecord,
        );
        if (lastResort) {
          requirementsAnalysis = lastResort;
          logger.info("[Requirements] User opted into deterministic template fallback");
        }
      }
      if (!requirementsAnalysis) {
        return res.status(500).json({
          success: false,
          error: "Brain did not produce a requirements draft",
          details: {
            decisionSpineId: resolvedDecisionSpineId,
            brainStatus: brainResult?.finalStatus ?? (brainTimedOut ? "timeout" : "unknown"),
            draftSource: resolvedDraft.source,
            advisoryKeys: resolvedDraft.advisoryKeys,
            generatedArtifactKeys: resolvedDraft.generatedArtifactKeys,
          },
        });
      }

      const requirementsWithProvenance = attachArtifactProvenance(requirementsAnalysis, brainResult);

      await deps.reports.update(id, {
        requirementsAnalysis: requirementsWithProvenance as unknown
      });

      // Governance: REQUIREMENTS drafts are not persisted as decision artifacts until explicitly approved.

      const existingVersions = await deps.versions.findByReportId(id);
      const latestRequirementsVersion = existingVersions
        .filter((v: unknown) => {
          const version = asVersionLike(v);
          return version.versionType === "requirements" || version.versionType === "both";
        })
        .sort((a: unknown, b: unknown) => {
          const vA = asVersionLike(a);
          const vB = asVersionLike(b);
          const aMaj = Number(vA.majorVersion ?? 0);
          const bMaj = Number(vB.majorVersion ?? 0);
          if (aMaj !== bMaj) return bMaj - aMaj;
          const aMin = Number(vA.minorVersion ?? 0);
          const bMin = Number(vB.minorVersion ?? 0);
          if (aMin !== bMin) return bMin - aMin;
          return Number(vB.patchVersion ?? 0) - Number(vA.patchVersion ?? 0);
        })[0];

      const actor = await deps.users.getUser(userId);
      const initialVersion = await createReportVersionSafely(deps.versions, id, {
        versionType: "requirements",
        status: "draft",
        createdBy: userId,
        createdByName: actor?.displayName || actor?.username || "System",
        versionData: requirementsWithProvenance,
        decisionSpineId: resolvedDecisionSpineId || undefined,
        changesSummary: latestRequirementsVersion
          ? "Requirements analysis regenerated from demand report"
          : "Initial requirements analysis generated from demand report"
      });

      // Governance: REQUIREMENTS drafts are not persisted as decision artifacts until explicitly approved.

      logger.info(`[Requirements] Created initial draft version: ${initialVersion.id}`);
      logger.info(`[Requirements] ✅ Complete`);
      logger.info(`========== COREVIA BRAIN COMPLETE ==========\n`);

      const normalizedData = normalizeRequirementsForUI(requirementsWithProvenance);
      res.json({
        success: true,
        data: normalizedData,
        citations: undefined,
        confidence: undefined,
        artifactMeta: buildArtifactMetaFromPayload(requirementsWithProvenance),
        version: {
          id: initialVersion.id,
          versionNumber: initialVersion.versionNumber,
          status: initialVersion.status
        },
        decisionBrain: {
          decisionId: brainResult?.decisionId,
          correlationId: brainResult?.correlationId,
          status: brainResult?.finalStatus ?? (brainTimedOut ? "fallback_synthesis" : undefined),
          governance: brainResult?.decision?.policy,
          readiness: brainResult?.decision?.context,
          fallback: brainTimedOut || resolvedDraft.source !== "pipeline",
        }
      });
    } catch (error) {
      logger.error("Error generating requirements analysis:", error);

      const fallbackError = error as Error & { code?: string };
      if (fallbackError?.code === 'AI_FALLBACK_REQUIRED') {
        return res.status(409).json({
          success: false,
          code: 'AI_FALLBACK_REQUIRED',
          requiresUserChoice: true,
          error: 'AI generation is currently unavailable or incomplete for requirements. Choose template fallback or retry AI-only generation.',
          options: ['allow_fallback_template', 'ai_only'],
        });
      }

      res.status(500).json({
        success: false,
        error: "Failed to generate requirements analysis",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  router.get("/:id/requirements", auth.requireAuth, auth.requirePermission("report:read"), asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const demandReport = await deps.reports.findById(id);
    if (!demandReport) {
      return res.status(404).json({ success: false, error: "Demand report not found" });
    }

    const requirementsAnalysis = demandReport.requirementsAnalysis as Record<string, unknown> | undefined;
    if (!isViableRequirementsDraft(requirementsAnalysis)) {
      return res.status(200).json({ success: false, data: null, message: "No requirements analysis generated yet" });
    }

    const normalizedData = normalizeRequirementsForUI(requirementsAnalysis);
    res.json({
      success: true,
      data: normalizedData,
      artifactMeta: buildArtifactMetaFromPayload(requirementsAnalysis),
    });
  }));

  router.post("/:id/requirements/market-research", auth.requireAuth, auth.requirePermission("requirements:generate"), asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const demandReport = await deps.reports.findById(id);
    if (!demandReport) {
      return res.status(404).json({ success: false, error: "Demand report not found" });
    }

    const requirementsAnalysis = (demandReport.requirementsAnalysis as Record<string, unknown> | undefined) || null;
    if (!requirementsAnalysis) {
      return res.status(404).json({ success: false, error: "Requirements analysis not found. Please generate requirements first." });
    }

    const requestData = buildRequirementsMarketResearchRequest(
      demandReport as unknown as Record<string, unknown>,
      requirementsAnalysis,
    );

    let result: MarketResearchResult;
    try {
      result = await marketResearchService.generateMarketResearch(requestData);
    } catch (error) {
      logger.error("[Requirements MarketResearch] Generation failed", error);
      result = {
        projectContext: {
          focusArea: requestData.projectName,
          keyObjectives: requestData.objectives || [],
          targetCapabilities: requestData.scope?.deliverables || [],
        },
        globalMarket: {
          marketSize: "Market data unavailable",
          growthRate: "N/A",
          keyTrends: [],
          topCountries: [],
          majorPlayers: [],
          technologyLandscape: [],
        },
        uaeMarket: {
          marketSize: "UAE market data unavailable",
          growthRate: "N/A",
          governmentInitiatives: [],
          localPlayers: [],
          opportunities: [],
          regulatoryConsiderations: [],
        },
        suppliers: [],
        useCases: [],
        competitiveAnalysis: {
          directCompetitors: [],
          indirectCompetitors: [],
          marketGaps: [],
        },
        recommendations: ["Requirements market research could not be generated. Try again after refining the requirements scope."],
        riskFactors: [],
        generatedAt: new Date().toISOString(),
      };
    }

    const updatedRequirements = {
      ...requirementsAnalysis,
      marketResearch: result,
      marketResearchGeneratedAt: result.generatedAt || new Date().toISOString(),
    };

    await deps.reports.update(id, {
      requirementsAnalysis: updatedRequirements as unknown,
    });

    res.json({ success: true, data: result });
  }));

  return router;
}
