import type { AgentMode } from "@shared/schemas/corevia/decision-object";

export type AgentPlanEntry = {
  agentId: string;
  agentName?: string;
  mode?: AgentMode;
  constraints?: {
    allowedModes?: AgentMode[];
    maxClassification?: string;
  };
};

export type AgentPlanSnapshot = {
  agentPlanPolicy?: {
    allowedAgents?: string[];
    mode?: "READ" | "PLAN";
    writePermissions?: boolean;
  };
  selectedAgents?: AgentPlanEntry[];
};

export type AgentApprovalSnapshot = {
  status?: string | null;
  approvalId?: string | null;
};

export type AgentAuthorizationResult = {
  allowed: boolean;
  reason?: string;
  orchestrationAgentId?: string;
  planAgent?: AgentPlanEntry;
};

const orchestrationToRuntimeMap: Record<string, string> = {
  project_manager: "project-manager-agent",
  context_aggregator: "evidence-collector-agent",
  financial_assist: "financial-analysis-agent",
  requirement_extractor: "requirement-extractor-agent",
  traceability: "traceability-agent",
  controls: "compliance-check-agent",
  alignment_scoring: "strategic-alignment-agent",
  enterprise_architecture: "enterprise-architecture-agent",
  architecture_governance: "risk-controls-agent",
  feasibility: "risk-assessment-agent",
  risk_value: "risk-assessment-agent",
  portfolio_impact: "portfolio-sync-agent",
  wbs_builder: "wbs-builder-agent",
  dependency_agent: "dependency-agent",
  resource_role: "resource-role-agent",
  quality_gate: "quality-gate-agent",
  evidence_collector: "evidence-collector-agent",
  risk_controls: "risk-controls-agent",
  pack_builder: "pack-builder-agent",
  demand_agent: "demand-agent",
  portfolio_sync: "portfolio-sync-agent",
  policy_analysis: "policy-analysis-agent",
  risk_assessment: "risk-assessment-agent",
  recommendation: "recommendation-agent",
  validation: "validation-agent",
};

const runtimeToOrchestrationMap: Record<string, string> = Object.fromEntries(
  Object.entries(orchestrationToRuntimeMap).map(([key, value]) => [value, key])
);

export function mapOrchestrationAgentIdToRuntime(orchestrationId: string): string {
  return orchestrationToRuntimeMap[orchestrationId] || orchestrationId;
}

export function mapRuntimeAgentIdToOrchestration(runtimeId: string): string {
  return runtimeToOrchestrationMap[runtimeId] || runtimeId;
}

export function authorizePlannedAgentExecution(params: {
  runtimeAgentId: string;
  requestedMode: AgentMode;
  policyResult?: string | null;
  contextResult?: string | null;
  plan?: AgentPlanSnapshot | null;
  approval?: AgentApprovalSnapshot | null;
  allowDirect?: boolean;
  plannedAgentId?: string;
  parentDemandApproved?: boolean;
}): AgentAuthorizationResult {
  const {
    runtimeAgentId,
    requestedMode,
    policyResult,
    contextResult,
    plan,
    approval,
    allowDirect = false,
    plannedAgentId,
    parentDemandApproved = false,
  } = params;

  if (policyResult && policyResult !== "allow" && !parentDemandApproved) {
    return { allowed: false, reason: "Policy not ALLOW" };
  }

  if (contextResult && contextResult !== "ready") {
    return { allowed: false, reason: "Context not READY" };
  }

  if (!plan?.selectedAgents || plan.selectedAgents.length === 0) {
    if (allowDirect && requestedMode !== "execute") {
      return { allowed: true };
    }
    return { allowed: false, reason: "Missing intelligence plan" };
  }

  const orchestrationAgentId = plannedAgentId || mapRuntimeAgentIdToOrchestration(runtimeAgentId);
  const planAgent = plan.selectedAgents.find(agent => agent.agentId === orchestrationAgentId);

  if (!planAgent) {
    return { allowed: false, reason: "Agent not authorized by plan" };
  }

  const policyAllowedAgents = Array.isArray(plan.agentPlanPolicy?.allowedAgents)
    ? plan.agentPlanPolicy?.allowedAgents
    : [];
  if (policyAllowedAgents.length > 0) {
    const allowed = policyAllowedAgents.includes(orchestrationAgentId) || policyAllowedAgents.includes(runtimeAgentId);
    if (!allowed) {
      return { allowed: false, reason: "Agent not allowed by agent_plan.allowedAgents", orchestrationAgentId, planAgent };
    }
  }

  const policyMode = String(plan.agentPlanPolicy?.mode || "READ").toUpperCase();
  if (requestedMode === "plan" && policyMode !== "PLAN") {
    return { allowed: false, reason: "PLAN mode not authorized by agent_plan.mode", orchestrationAgentId, planAgent };
  }

  if (requestedMode !== "execute" && plan.agentPlanPolicy?.writePermissions === true) {
    return { allowed: false, reason: "writePermissions must be false in Layer 6 safe zone", orchestrationAgentId, planAgent };
  }

  const allowedModes = Array.isArray(planAgent.constraints?.allowedModes)
    ? planAgent.constraints?.allowedModes
    : undefined;

  if (allowedModes && allowedModes.length > 0 && !allowedModes.includes(requestedMode)) {
    return { allowed: false, reason: "Agent mode not authorized by plan", orchestrationAgentId, planAgent };
  }

  if (requestedMode === "execute") {
    if (runtimeAgentId !== "portfolio-sync-agent") {
      return { allowed: false, reason: "Only portfolio-sync-agent can run in EXECUTE mode", orchestrationAgentId, planAgent };
    }
    if (!approval?.approvalId || approval?.status !== "approved") {
      return { allowed: false, reason: "Approval required for execute mode", orchestrationAgentId, planAgent };
    }
  }

  return { allowed: true, orchestrationAgentId, planAgent };
}
