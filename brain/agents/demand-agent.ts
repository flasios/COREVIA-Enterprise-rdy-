import type { AgentDefinition, AgentInput, AgentOutput } from "./agent-runtime";

function toText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function toList(...values: unknown[]): string[] {
  const items = values.flatMap((value) => {
    if (Array.isArray(value)) {
      return value.map((entry) => toText(entry));
    }
    const text = toText(value);
    if (!text) {
      return [];
    }
    return text
      .split(/[\n;,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  });

  return Array.from(new Set(items));
}

function toSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = trimmed.replace(/\s+/g, " ");
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function stripTrailingPeriod(value: string): string {
  return value.trim().replace(/[.!?]+$/, "");
}

function toObjectiveNounPhrase(value: string): string {
  const normalized = stripTrailingPeriod(value);
  if (!normalized) {
    return "";
  }

  const withoutLeadingVerb = normalized.replace(/^(build|create|develop|design|implement|launch|establish)\s+/i, "");
  if (!withoutLeadingVerb) {
    return normalized;
  }

  return withoutLeadingVerb.charAt(0).toLowerCase() + withoutLeadingVerb.slice(1);
}

function isOpaqueIdentifier(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    || /^(DSP|REQ|ART|ARTV|SUB|EXE|CST|GOV|CQR|IPL|AP|LED|OUT|LA)-/i.test(value);
}

function sanitizeStakeholders(values: string[]): string[] {
  return values.filter((value) => !isOpaqueIdentifier(value.trim()));
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function firstNonEmpty(...values: string[]): string {
  return values.find((value) => value.trim().length > 0)?.trim() || "";
}

function hasKeyword(text: string, pattern: RegExp): boolean {
  return pattern.test(text.toLowerCase());
}

type DemandSignals = {
  sovereign: boolean;
  smartCity: boolean;
  digitalTwin: boolean;
  iot: boolean;
  gis: boolean;
  mobility: boolean;
  utilities: boolean;
  emergency: boolean;
  analytics: boolean;
  integrationHeavy: boolean;
  government: boolean;
};

function inferDemandSignals(objective: string, department: string, classificationLevel: string | undefined): DemandSignals {
  const corpus = `${objective} ${department}`.toLowerCase();
  return {
    sovereign: classificationLevel === "sovereign" || hasKeyword(corpus, /(sovereign|top secret|classified|restricted|national infrastructure|data residency)/),
    smartCity: hasKeyword(corpus, /(smart city|urban planning|city operations|municipal)/),
    digitalTwin: hasKeyword(corpus, /(digital twin|twin platform|simulation)/),
    iot: hasKeyword(corpus, /(iot|sensor|telemetry|device)/),
    gis: hasKeyword(corpus, /(gis|geospatial|spatial|mapping)/),
    mobility: hasKeyword(corpus, /(mobility|transport|traffic|transit|road)/),
    utilities: hasKeyword(corpus, /(utilities|water|electricity|energy|waste)/),
    emergency: hasKeyword(corpus, /(emergency|incident|resilience|crisis|response)/),
    analytics: hasKeyword(corpus, /(analytics|dashboard|predictive|insight|decision)/),
    integrationHeavy: hasKeyword(corpus, /(integrat|platform|shared data|cross-agency|interoperab|data exchange)/),
    government: hasKeyword(corpus, /(government|authority|public sector|emirate|ministry|department)/),
  };
}

function buildStakeholderCandidates(params: {
  requestorName: string;
  department: string;
  organizationName: string;
  existingStakeholders: string[];
  signals: DemandSignals;
}): string[] {
  const { requestorName, department, organizationName, existingStakeholders, signals } = params;
  const base = uniqueNonEmpty([
    requestorName,
    ...existingStakeholders,
    department ? `${department} leadership` : "",
    department ? `${department} service owner` : "",
    "Business owner",
    "Delivery lead",
    signals.government ? `${organizationName || "Government"} enterprise architecture` : "",
    signals.sovereign ? "Information security and data governance" : "",
    signals.integrationHeavy ? "Integration and platform engineering" : "",
    signals.digitalTwin || signals.analytics ? "Data and analytics authority" : "",
    signals.iot ? "IoT platform and field operations" : "",
    signals.gis ? "GIS and geospatial services" : "",
    signals.mobility ? "Mobility and transport operations" : "",
    signals.utilities ? "Utilities operations and control teams" : "",
    signals.emergency ? "Emergency response coordination" : "",
  ]);

  return base.slice(0, 6);
}

function buildExpectedOutcomes(objective: string, department: string, signals: DemandSignals, provided: string[]): string[] {
  const generated = uniqueNonEmpty([
    ...provided,
    objective ? `Establish a governed ${signals.digitalTwin ? "digital twin" : "delivery"} capability for ${department || "the requesting department"} with clear operating ownership and measurable service outcomes` : "",
    signals.integrationHeavy ? "Unify cross-agency data flows through controlled integration patterns, shared identifiers, and auditable exchange rules" : "",
    signals.analytics ? "Provide real-time operational dashboards and predictive decision support for planning, performance management, and intervention prioritization" : "",
    signals.emergency ? "Improve incident detection, escalation, and coordinated emergency response using shared situational awareness" : "",
    signals.smartCity ? "Support smarter urban planning and city operations through a trusted, continuously updated operational view of assets, services, and demand" : "",
    signals.sovereign ? "Keep restricted operational data and reasoning workloads inside sovereign infrastructure while maintaining traceability and governance control" : "",
  ]);

  return generated.slice(0, 5);
}

function buildSuccessCriteria(signals: DemandSignals, provided: string[], readinessScore: number | null): string[] {
  const generated = uniqueNonEmpty([
    ...provided,
    "Stakeholder workflow, decision rights, and approval checkpoints are documented and approved",
    signals.integrationHeavy ? "Priority source systems are integrated through tested interfaces or governed data exchange mechanisms" : "",
    signals.analytics ? "Operational dashboards and decision-support views are available to authorized users with agreed KPIs" : "",
    signals.sovereign ? "Sovereign hosting, access control, and audit requirements pass internal security and governance review" : "",
    readinessScore && readinessScore > 0 ? `Brain readiness score exceeds ${Math.round(readinessScore)}` : "",
  ]);

  return generated.slice(0, 5);
}

function buildConstraints(params: {
  provided: string[];
  budget: string;
  timeline: string;
  signals: DemandSignals;
}): string[] {
  const { provided, budget, timeline, signals } = params;
  return uniqueNonEmpty([
    ...provided,
    timeline ? `Delivery timeline assumption: ${timeline}` : "",
    budget ? `Budget envelope remains to be validated against scope, integration, and operational-readiness requirements` : "",
    signals.sovereign ? "Restricted data must remain within approved sovereign infrastructure and internal reasoning boundaries" : "",
    signals.integrationHeavy ? "Cross-agency data sharing depends on interface readiness, data ownership agreements, and interoperability controls" : "",
  ]).slice(0, 5);
}

function buildComplianceRequirements(provided: string[], signals: DemandSignals): string[] {
  return uniqueNonEmpty([
    ...provided,
    signals.sovereign ? "Sovereign data residency controls" : "",
    signals.government ? "Government information security and records-management controls" : "",
    signals.integrationHeavy ? "Auditability and access control for shared datasets and service integrations" : "",
  ]).slice(0, 5);
}

function buildIntegrationRequirements(provided: string[], existingSystems: string[], signals: DemandSignals): string[] {
  return uniqueNonEmpty([
    ...provided,
    ...existingSystems,
    signals.integrationHeavy ? "Secure API and event-based integration patterns across participating agencies and operational systems" : "",
    signals.iot ? "Telemetry ingestion and device-data normalization for field sensors and connected assets" : "",
    signals.gis ? "Geospatial data services and map-layer integration for operational visualization" : "",
  ]).slice(0, 5);
}

function buildCurrentChallenges(objective: string, department: string, signals: DemandSignals, provided: string): string {
  if (provided.trim()) {
    return toSentence(provided);
  }

  const narrative = uniqueNonEmpty([
    department
      ? `${department} does not yet have a single governed operating model for this initiative, so ownership, escalation paths, and delivery accountability are likely to remain unclear during early implementation.`
      : "",
    signals.integrationHeavy
      ? "Operational data, process steps, and service dependencies are distributed across multiple agencies and platforms, which increases coordination effort, slows decision cycles, and creates inconsistent views of the same city event or asset."
      : "",
    signals.analytics || signals.digitalTwin
      ? "Leaders and operators do not yet have a trusted, continuously updated operational picture that combines planning, field telemetry, and service performance into one decision-ready environment."
      : "",
    signals.sovereign
      ? "Because restricted data and reasoning workloads must stay inside sovereign infrastructure, the solution has to meet stronger controls for hosting, access, traceability, and model usage than a standard digital platform rollout."
      : "",
    signals.emergency
      ? "Without shared situational awareness and coordinated workflows, emergency response and cross-agency interventions can remain reactive, slower to mobilize, and harder to audit after major incidents."
      : "",
  ]);

  if (narrative.length > 0) {
    return narrative.join("\n\n");
  }

  return [
    `The request still needs a clearer operating context for ${stripTrailingPeriod(objective) || "this initiative"}.`,
    "Current-state pain points, governance constraints, and delivery assumptions should be articulated in enough detail for Brain to produce a stronger governed draft.",
  ].join("\n\n");
}

function buildEnhancedBusinessObjective(params: {
  objective: string;
  organizationName: string;
  department: string;
  signals: DemandSignals;
}): string {
  const { objective, organizationName, department, signals } = params;
  const normalizedObjective = toObjectiveNounPhrase(objective);
  const sponsor = firstNonEmpty(department, organizationName, "the requesting organization");
  const capability = signals.digitalTwin
    ? "a governed sovereign smart city digital twin capability"
    : signals.analytics
      ? "a governed decision-intelligence capability"
      : "a governed transformation capability";
  const operatingScope = uniqueNonEmpty([
    signals.iot ? "IoT" : "",
    signals.gis ? "GIS" : "",
    signals.mobility ? "mobility" : "",
    signals.utilities ? "utilities" : "",
    /public service/i.test(normalizedObjective) ? "public-service" : "",
  ]);
  const mission = uniqueNonEmpty([
    signals.analytics ? "decision-ready operational insight" : "better operational visibility",
    signals.emergency ? "coordinated emergency response" : "faster service coordination",
    signals.smartCity || signals.digitalTwin ? "smarter urban planning and resilient city operations" : "measurable service outcomes",
  ]);
  const sovereignClause = signals.sovereign
    ? "Keep restricted data, integrations, and reasoning workflows inside approved sovereign infrastructure with full governance and audit control."
    : "Maintain clear governance, traceability, and delivery accountability across the implementation."
;

  const opening = sponsor
    ? `Establish ${capability} for ${sponsor}`
    : `Establish ${capability}`;
  const scopeClause = operatingScope.length > 0
    ? ` that unifies ${operatingScope.join(", ")} data and workflows`
    : normalizedObjective
      ? ` that delivers ${normalizedObjective}`
      : "";
  const missionClause = mission.length > 0
    ? ` to enable ${mission.join(", ")}.`
    : ".";

  return `${opening}${scopeClause}${missionClause} ${sovereignClause}`.trim();
}

function inferProjectName(objective: string, department: string): string {
  const source = objective || department || "Demand Initiative";
  const cleaned = source
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(" ");
  const candidate = titleCase(cleaned);
  if (!candidate) {
    return "Demand Initiative";
  }
  if (/initiative|program|project/i.test(candidate)) {
    return candidate;
  }
  return `${candidate} Initiative`;
}

function inferDepartment(objective: string, fallback: string): string {
  if (fallback) {
    return fallback;
  }

  const normalized = objective.toLowerCase();
  if (/(permit|license|approval|inspection|case management)/i.test(normalized)) {
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

export const demandAgent: AgentDefinition = {
  id: "demand-agent",
  name: "Demand Agent",
  description: "Synthesizes demand intent into structured fields using Brain context and engine analysis. READ-ONLY - no side effects.",
  capabilities: ["demand_field_synthesis", "objective_refinement", "stakeholder_inference", "engine_signal_interpretation"],
  requiredClassification: "public",

  execute: async (input: AgentInput): Promise<AgentOutput> => {
    const startTime = Date.now();

    try {
      const params = input.parameters || {};
      const objective = toText(params.description || params.businessObjective);
      const organizationName = toText(params.organizationName);
      const requestorName = toText(params.requestorName || params.owner);
      const department = inferDepartment(objective, toText(params.category || params.department));
      const projectName = toText(params.title || params.projectName) || inferProjectName(objective, department);
      const signals = inferDemandSignals(objective, department, input.context.classificationLevel);
      const stakeholders = buildStakeholderCandidates({
        requestorName,
        department,
        organizationName,
        existingStakeholders: sanitizeStakeholders(toList(
        params.stakeholders,
        params.owner,
        )),
        signals,
      });
      const existingSystems = toList(params.existingSystems, params.systems, params.integrationContext);
      const integrationRequirements = buildIntegrationRequirements(toList(params.integrationRequirements), existingSystems, signals);
      const complianceRequirements = buildComplianceRequirements(toList(
        params.complianceRequirements,
        input.context.classificationLevel === "confidential" ? "Confidential handling and access controls" : "",
      ), signals);

      const internalEngineOutput = (typeof params.internalEngineOutput === "object" && params.internalEngineOutput !== null)
        ? params.internalEngineOutput as Record<string, unknown>
        : {};
      const scoring = (typeof internalEngineOutput.scoring === "object" && internalEngineOutput.scoring !== null)
        ? internalEngineOutput.scoring as Record<string, unknown>
        : {};
      const patterns = (typeof internalEngineOutput.patterns === "object" && internalEngineOutput.patterns !== null)
        ? internalEngineOutput.patterns as Record<string, unknown>
        : {};
      const evidence = Array.isArray(params.evidence) ? params.evidence as unknown[] : [];
      const risks = toList(params.riskFactors, params.risks, Object.keys((params.risks as Record<string, unknown> | undefined) || {}));
      const timeline = firstNonEmpty(toText(params.timeline), "6_months");
      const constraints = buildConstraints({
        provided: toList(params.constraints),
        budget: toText(params.budget),
        timeline,
        signals,
      });

      const confidenceBase = Number(scoring.overallScore);
      const expectedOutcomes = buildExpectedOutcomes(objective, department, signals, toList(params.expectedOutcomes));
      const successCriteria = buildSuccessCriteria(signals, toList(params.successCriteria, evidence.length > 0 ? "Supporting evidence is attached and traceable" : ""), Number.isFinite(confidenceBase) ? confidenceBase : null);
      const assumptions = toList(
        params.assumptions,
        department ? `${department} will provide subject matter experts during elaboration` : "",
        integrationRequirements.length > 0 ? "Required source systems expose stable interfaces or data exports" : "",
        Array.isArray(patterns.commonFactors) && patterns.commonFactors.length > 0 ? String((patterns.commonFactors as unknown[])[0]) : "",
      );

      const currentChallenges = buildCurrentChallenges(objective, department, signals, toText(params.currentChallenges));
      const enhancedBusinessObjective = buildEnhancedBusinessObjective({
        objective,
        organizationName,
        department,
        signals,
      });
      const classificationConfidence = Number.isFinite(confidenceBase) && confidenceBase > 0
        ? Math.max(55, Math.min(95, Math.round(confidenceBase)))
        : 68;
      const similarDecisions = Number(patterns.similarDecisions) || 0;

      return {
        success: true,
        result: {
          enhancedBusinessObjective,
          suggestedProjectName: projectName,
          department,
          currentChallenges,
          expectedOutcomes,
          successCriteria,
          timeframe: timeline,
          stakeholders,
          riskFactors: risks,
          constraints,
          integrationRequirements,
          complianceRequirements,
          existingSystems,
          assumptions,
          requestType: "demand",
          classificationConfidence,
          classificationReasoning: `Demand agent synthesized the request using Brain Layer 6 engine signals${similarDecisions > 0 ? ` and ${similarDecisions} similar decision patterns` : ""}.`,
          engineContext: {
            evidenceCount: evidence.length,
            similarDecisions,
            overallScore: Number.isFinite(confidenceBase) ? confidenceBase : null,
          },
        },
        reasoning: `Structured demand intent into normalized fields using objective context${similarDecisions > 0 ? ` and ${similarDecisions} similar decision signals` : ""}`,
        confidence: Math.min(0.95, Math.max(0.6, classificationConfidence / 100)),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        confidence: 0,
        executionTimeMs: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : "Demand agent failed"],
      };
    }
  },
};