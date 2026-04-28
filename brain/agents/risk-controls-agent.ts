import type { AgentInput, AgentOutput, AgentDefinition } from "./agent-runtime";

interface RiskItem {
  id: string;
  category: string;
  description: string;
  likelihood: number;
  impact: number;
  score: number;
  level: "low" | "medium" | "high" | "critical";
  controls: string[];
}

export const riskControlsAgent: AgentDefinition = {
  id: "risk-controls-agent",
  name: "Risk & Controls Agent",
  description: "Identifies risks, assesses their impact, and recommends controls. READ-ONLY - no side effects.",
  capabilities: ["risk_identification", "impact_assessment", "control_recommendation", "risk_matrix"],
  requiredClassification: "internal",

  execute: async (input: AgentInput): Promise<AgentOutput> => {
    const startTime = Date.now();

    try {
      const parameters = (input.parameters ?? {}) as {
        budget?: number;
        complexity?: string;
        timeline?: string;
        domain?: string;
      };
      const budget = Number(parameters.budget ?? 0);
      const complexity = parameters.complexity || "medium";
      const timeline = parameters.timeline || "6_months";

      const risks: RiskItem[] = [];

      if (budget > 1000000) {
        risks.push({
          id: "RISK-FIN-001",
          category: "financial",
          description: "High budget exposure requires executive approval and phased funding",
          likelihood: 0.6,
          impact: 0.8,
          score: 0.48,
          level: "high",
          controls: [
            "Implement phased budget release",
            "Establish financial review checkpoints",
            "Create contingency reserve (10-15%)",
          ],
        });
      }

      if (complexity === "high" || complexity === "critical") {
        risks.push({
          id: "RISK-TECH-001",
          category: "technical",
          description: "High technical complexity increases implementation risk",
          likelihood: 0.7,
          impact: 0.7,
          score: 0.49,
          level: "high",
          controls: [
            "Conduct technical feasibility study",
            "Engage subject matter experts",
            "Create proof-of-concept before full implementation",
          ],
        });
      }

      if (timeline === "1_month" || timeline === "3_months") {
        risks.push({
          id: "RISK-OPS-001",
          category: "operational",
          description: "Aggressive timeline may compromise quality and stakeholder alignment",
          likelihood: 0.8,
          impact: 0.6,
          score: 0.48,
          level: "high",
          controls: [
            "Prioritize MVP features",
            "Establish daily progress reviews",
            "Pre-allocate dedicated resources",
          ],
        });
      }

      risks.push({
        id: "RISK-COMP-001",
        category: "compliance",
        description: "Standard compliance requirements apply",
        likelihood: 0.3,
        impact: 0.5,
        score: 0.15,
        level: "low",
        controls: [
          "Follow established governance procedures",
          "Document all decisions",
          "Maintain audit trail",
        ],
      });

      risks.push({
        id: "RISK-STRAT-001",
        category: "strategic",
        description: "Alignment with organizational strategy should be verified",
        likelihood: 0.4,
        impact: 0.6,
        score: 0.24,
        level: "medium",
        controls: [
          "Verify alignment with strategic objectives",
          "Engage strategic planning office",
          "Document strategic value proposition",
        ],
      });

      const overallRiskScore = risks.reduce((sum, r) => sum + r.score, 0) / risks.length;
      const overallRiskLevel = overallRiskScore > 0.4 ? "high" : overallRiskScore > 0.25 ? "medium" : "low";

      const riskMatrix = {
        rows: ["Critical", "High", "Medium", "Low"],
        cols: ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"],
        placements: risks.map((r) => ({
          riskId: r.id,
          row: r.impact > 0.75 ? 0 : r.impact > 0.5 ? 1 : r.impact > 0.25 ? 2 : 3,
          col: r.likelihood > 0.8 ? 4 : r.likelihood > 0.6 ? 3 : r.likelihood > 0.4 ? 2 : r.likelihood > 0.2 ? 1 : 0,
        })),
      };

      const controlsSummary = risks.flatMap((r) => r.controls);
      const uniqueControls = Array.from(new Set(controlsSummary));

      return {
        success: true,
        result: {
          risks,
          riskMatrix,
          summary: {
            totalRisks: risks.length,
            highRisks: risks.filter((r) => r.level === "high" || r.level === "critical").length,
            overallRiskScore,
            overallRiskLevel,
          },
          recommendedControls: uniqueControls,
          mitigationPlan: {
            immediate: uniqueControls.slice(0, 3),
            shortTerm: uniqueControls.slice(3, 6),
            ongoing: uniqueControls.slice(6),
          },
        },
        reasoning: `Identified ${risks.length} risks across 5 categories with overall risk level: ${overallRiskLevel}`,
        confidence: 0.85,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        confidence: 0,
        executionTimeMs: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : "Risk assessment failed"],
      };
    }
  },
};
