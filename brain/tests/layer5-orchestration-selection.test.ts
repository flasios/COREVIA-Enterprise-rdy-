import { describe, expect, it } from "vitest";

import { selectOrchestrationAgents } from "../layers/layer5-orchestration/agent-selection";

describe("Layer5Orchestration sovereign selection", () => {
  it("keeps the full sovereign-safe business case planning set", () => {
    const decision = {
      classification: {
        classificationLevel: "sovereign",
      },
    };

    const allowedAgents = [
      "project_manager",
      "context_aggregator",
      "evidence_collector",
      "risk_controls",
      "financial_assist",
      "alignment_scoring",
      "controls",
      "policy_analysis",
      "risk_assessment",
      "feasibility",
      "wbs_builder",
      "dependency_agent",
      "resource_role",
      "pack_builder",
      "quality_gate",
    ];

    const selectedAgents = selectOrchestrationAgents({
      decision,
      agentPlanMode: "PLAN",
      allowedAgentIds: allowedAgents,
    }) as Array<{ agentId: string; mode: string }>;
    const selectedIds = selectedAgents.map((agent) => agent.agentId);

    expect(selectedIds).toEqual(expect.arrayContaining(allowedAgents));
    expect(selectedIds).toHaveLength(allowedAgents.length);
    expect(selectedAgents.every((agent) => agent.mode === "plan")).toBe(true);
  });
});