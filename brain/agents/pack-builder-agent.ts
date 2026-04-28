import type { AgentInput, AgentOutput, AgentDefinition } from "./agent-runtime";

interface EvidenceItem {
  source?: string;
  relevanceScore?: number;
}

interface RiskItem {
  id?: string;
  level?: string;
}

interface ContextConstraints {
  budgetConstraint?: string;
  timeConstraint?: string;
  resourceConstraint?: string;
}

interface AdvisoryOption {
  id: string;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  score: number;
  recommended: boolean;
}

export const packBuilderAgent: AgentDefinition = {
  id: "pack-builder-agent",
  name: "Pack Builder Agent",
  description: "Builds comprehensive advisory packages with options, recommendations, and supporting materials. READ-ONLY - no side effects.",
  capabilities: ["option_generation", "recommendation_building", "package_assembly", "presentation_prep"],
  requiredClassification: "public",

  execute: async (input: AgentInput): Promise<AgentOutput> => {
    const startTime = Date.now();

    try {
      const parameters = input.parameters || {};
      const evidence = Array.isArray(parameters.evidence) ? (parameters.evidence as EvidenceItem[]) : [];
      const risks = Array.isArray(parameters.risks) ? (parameters.risks as RiskItem[]) : [];
      const context = (typeof parameters.context === "object" && parameters.context !== null
        ? parameters.context
        : {}) as ContextConstraints;

      const options: AdvisoryOption[] = [
        {
          id: "OPT-STANDARD",
          name: "Standard Implementation",
          description: "Follow established procedures with proven methodologies and minimal deviation from standard practices.",
          pros: [
            "Lower implementation risk",
            "Predictable timeline and costs",
            "Leverages existing organizational knowledge",
            "Easier stakeholder alignment",
          ],
          cons: [
            "May not fully address unique requirements",
            "Limited innovation potential",
            "Possible capability gaps",
          ],
          score: 0.75,
          recommended: false,
        },
        {
          id: "OPT-ACCELERATED",
          name: "Accelerated Delivery",
          description: "Fast-track implementation using agile methodology with dedicated resources and compressed timelines.",
          pros: [
            "Faster time to value",
            "Early user feedback incorporation",
            "Competitive advantage",
            "Rapid capability deployment",
          ],
          cons: [
            "Higher resource requirements",
            "Increased risk of quality issues",
            "Stakeholder fatigue possible",
            "Less comprehensive documentation",
          ],
          score: 0.65,
          recommended: false,
        },
        {
          id: "OPT-PHASED",
          name: "Phased Rollout",
          description: "Incremental implementation with validation gates between phases, allowing for course correction.",
          pros: [
            "Risk mitigation through staged delivery",
            "Learning incorporated between phases",
            "Flexible scope adjustment",
            "Better resource utilization",
          ],
          cons: [
            "Longer overall timeline",
            "Integration complexity between phases",
            "Potential for scope creep",
            "Maintaining momentum challenging",
          ],
          score: 0.82,
          recommended: true,
        },
      ];

      const recommendation = (options.find((o) => o.recommended) || options[0])!;

      const executiveSummary = {
        title: `Advisory Package: ${input.task}`,
        recommendation: recommendation.name,
        keyFindings: [
          `Analysis based on ${evidence.length} evidence items`,
          `${risks.length} risks identified and assessed`,
          `${options.length} implementation options evaluated`,
        ],
        nextSteps: [
          "Review advisory package with stakeholders",
          "Validate assumptions with subject matter experts",
          "Obtain required approvals",
          "Initiate implementation planning",
        ],
      };

      const supportingMaterials = {
        evidenceSummary: evidence.slice(0, 5).map((e) => ({
          source: e.source || "Unknown",
          relevance: e.relevanceScore || 0.5,
        })),
        riskSummary: risks.slice(0, 5).map((r) => ({
          id: r.id || "Unknown",
          level: r.level || "medium",
        })),
        assumptions: [
          "Current organizational priorities remain stable",
          "Required resources will be available as planned",
          "Stakeholder support is maintained throughout",
          "External dependencies are met on schedule",
        ],
        constraints: [
          context.budgetConstraint || "Budget within approved limits",
          context.timeConstraint || "Timeline per organizational requirements",
          context.resourceConstraint || "Resources as allocated",
        ],
      };

      const proposedActions = [
        {
          id: "ACT-001",
          type: "approval",
          description: "Obtain executive approval for recommended approach",
          priority: "high",
          status: "pending",
        },
        {
          id: "ACT-002",
          type: "resource",
          description: "Allocate project team and resources",
          priority: "high",
          status: "pending",
        },
        {
          id: "ACT-003",
          type: "planning",
          description: "Develop detailed implementation plan",
          priority: "medium",
          status: "pending",
        },
        {
          id: "ACT-004",
          type: "communication",
          description: "Notify stakeholders of decision and timeline",
          priority: "medium",
          status: "pending",
        },
      ];

      return {
        success: true,
        result: {
          executiveSummary,
          options,
          recommendation: {
            option: recommendation,
            rationale: "Phased approach provides optimal balance of risk mitigation and value delivery",
            confidence: recommendation.score,
          },
          supportingMaterials,
          proposedActions,
          metadata: {
            generatedAt: new Date().toISOString(),
            version: "1.0",
            status: "draft",
          },
        },
        reasoning: `Built advisory package with ${options.length} options, recommending ${recommendation.name} based on analysis`,
        confidence: 0.8,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        confidence: 0,
        executionTimeMs: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : "Pack building failed"],
      };
    }
  },
};
