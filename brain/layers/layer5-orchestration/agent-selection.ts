import {
  DecisionObject,
  OrchestrationData,
  AgentMode,
  ClassificationLevel,
} from "@shared/schemas/corevia/decision-object";

export type AvailableOrchestrationAgent = {
  agentId: string;
  agentName: string;
  allowedModes: AgentMode[];
  maxClassification: ClassificationLevel;
  description: string;
};

export const AVAILABLE_ORCHESTRATION_AGENTS: AvailableOrchestrationAgent[] = [
  {
    agentId: "project_manager",
    agentName: "Project Manager Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Coordinates implementation planning across phases, dependencies, resources, and governance checkpoints",
  },
  {
    agentId: "policy_analysis",
    agentName: "Policy Analysis Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Analyzes decisions against organizational policies and governance frameworks",
  },
  {
    agentId: "risk_assessment",
    agentName: "Risk Assessment Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Evaluates risks across technical, financial, operational, and strategic dimensions",
  },
  {
    agentId: "recommendation",
    agentName: "Recommendation Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Generates strategic recommendations and alternatives for decision support",
  },
  {
    agentId: "validation",
    agentName: "Validation Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Validates decisions for completeness, consistency, and compliance",
  },
  {
    agentId: "evidence_collector",
    agentName: "Evidence Collector Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Collects and organizes evidence from knowledge base",
  },
  {
    agentId: "risk_controls",
    agentName: "Risk & Controls Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Analyzes risks and recommends controls",
  },
  {
    agentId: "pack_builder",
    agentName: "Pack Builder Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Builds advisory packages and recommendations",
  },
  {
    agentId: "demand_agent",
    agentName: "Demand Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Synthesizes demand intent into structured fields using Brain context and engine signals",
  },
  {
    agentId: "context_aggregator",
    agentName: "Context Aggregator Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Pulls demand context, similar cases, and organizational constraints",
  },
  {
    agentId: "financial_assist",
    agentName: "Financial Assist Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Builds financial assumptions and ROI templates",
  },
  {
    agentId: "requirement_extractor",
    agentName: "Requirement Extractor Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Extracts structured requirements from demand and business context",
  },
  {
    agentId: "traceability",
    agentName: "Traceability Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Builds REQ ↔ BC objectives/benefits/KPI traceability",
  },
  {
    agentId: "controls",
    agentName: "Controls Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Adds compliance and security controls by classification and sector",
  },
  {
    agentId: "alignment_scoring",
    agentName: "Alignment Scoring Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Computes strategic and portfolio alignment scores",
  },
  {
    agentId: "enterprise_architecture",
    agentName: "Enterprise Architecture Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Builds application/domain/integration/data/infrastructure architecture recommendations",
  },
  {
    agentId: "feasibility",
    agentName: "Feasibility Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Assesses readiness, dependencies, and integration complexity",
  },
  {
    agentId: "risk_value",
    agentName: "Risk/Value Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Balances value vs risk and confidence",
  },
  {
    agentId: "portfolio_impact",
    agentName: "Portfolio Impact Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Evaluates portfolio load, conflicts, and capacity impact",
  },
  {
    agentId: "wbs_builder",
    agentName: "WBS Builder Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Drafts phases/tasks and milestones from scope",
  },
  {
    agentId: "dependency_agent",
    agentName: "Dependency Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Builds dependency map and critical path hints",
  },
  {
    agentId: "resource_role",
    agentName: "Resource Role Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Suggests roles, RACI, and effort bands",
  },
  {
    agentId: "quality_gate",
    agentName: "Quality Gate Agent",
    allowedModes: ["read", "plan"],
    maxClassification: "sovereign",
    description: "Checks output completeness, policy alignment, and evidence sufficiency",
  },
  {
    agentId: "portfolio_sync",
    agentName: "Portfolio Sync Agent",
    allowedModes: ["read", "plan", "execute"],
    maxClassification: "internal",
    description: "Syncs decisions with portfolio management (EXECUTE mode deferred to post-approval)",
  },
];

const CLASSIFICATION_LEVELS: ClassificationLevel[] = ["public", "internal", "confidential", "sovereign"];

type SelectAgentsParams = {
  decision: Pick<DecisionObject, "classification">;
  agentPlanMode: "READ" | "PLAN";
  allowedAgentIds: string[];
  availableAgents?: AvailableOrchestrationAgent[];
  resolveRuntimeRequiredClassification?: (agentId: string) => ClassificationLevel | undefined;
};

export function selectOrchestrationAgents({
  decision,
  agentPlanMode,
  allowedAgentIds,
  availableAgents = AVAILABLE_ORCHESTRATION_AGENTS,
  resolveRuntimeRequiredClassification,
}: SelectAgentsParams): OrchestrationData["selectedAgents"] {
  const classificationLevel = decision.classification?.classificationLevel || "internal";
  const requiredAgents = new Set(allowedAgentIds);
  const currentLevelIndex = CLASSIFICATION_LEVELS.indexOf(classificationLevel);
  const selected: OrchestrationData["selectedAgents"] = [];

  for (const agent of availableAgents) {
    if (!requiredAgents.has(agent.agentId)) {
      continue;
    }

    const agentMaxIndex = CLASSIFICATION_LEVELS.indexOf(agent.maxClassification);
    if (currentLevelIndex > agentMaxIndex) {
      continue;
    }

    const runtimeRequiredClassification = resolveRuntimeRequiredClassification?.(agent.agentId);
    if (runtimeRequiredClassification) {
      const runtimeRequiredIndex = CLASSIFICATION_LEVELS.indexOf(runtimeRequiredClassification);
      if (runtimeRequiredIndex !== -1 && currentLevelIndex < runtimeRequiredIndex) {
        continue;
      }
    }

    const mode: AgentMode = agentPlanMode === "PLAN" && agent.allowedModes.includes("plan")
      ? "plan"
      : "read";

    selected.push({
      agentId: agent.agentId,
      agentName: agent.agentName,
      mode,
      constraints: {
        maxClassification: agent.maxClassification,
        allowedModes: agent.allowedModes,
      },
    });
  }

  return selected;
}