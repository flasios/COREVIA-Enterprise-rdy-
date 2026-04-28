import { logger } from "@platform/logging/Logger";
import { createAIService } from "@platform/ai/factory";

export interface MarketResearchRequest {
  projectName: string;
  projectDescription: string;
  projectType?: string;
  organization?: string;
  estimatedBudget?: number;
  businessCaseSummary?: string;
  archetype?: string;
  objectives?: string[];
  scope?: {
    inScope?: string[];
    outOfScope?: string[];
    deliverables?: string[];
    constraints?: string[];
    assumptions?: string[];
  };
  strategicAlignment?: {
    uaeVision2031?: string[];
    organizationalObjectives?: string[];
    digitalAgenda?: string[];
  };
  expectedBenefits?: Array<{
    category?: string;
    description?: string;
    type?: string;
  }>;
  decisionGovernance?: {
    approved: boolean;
    requestNumber?: string;
  };
}

export interface MarketPlayer {
  name: string;
  description: string;
  marketShare?: string;
  headquarters: string;
  relevance: string;
  annualRevenue?: string;
  flagshipSolutions?: string[];
  regionalStrength?: string[];
  keyClients?: string[];
}

export interface TopCountry {
  country: string;
  rank: number;
  marketSize: string;
  growthRate: string;
  adoptionMaturity: "Emerging" | "Growing" | "Mature" | "Leading";
  keyDrivers: string[];
  regulatoryEnvironment: string;
  majorLocalPlayers: string[];
}

export interface UAEPlayer {
  name: string;
  description: string;
  sector: string;
  capabilities: string[];
}

export interface UseCase {
  title: string;
  description: string;
  benefits: string[];
  implementationComplexity: "Low" | "Medium" | "High";
  estimatedROI: string;
  timeframe?: string;
  relevantPlayers: string[];
}

export interface SupplierProvider {
  name: string;
  category: string;
  services: string[];
  uaePresence: boolean;
  strengths?: string;
  contactInfo?: string;
}

export interface MarketResearchResult {
  projectContext: {
    focusArea: string;
    keyObjectives: string[];
    targetCapabilities: string[];
  };
  globalMarket: {
    marketSize: string;
    growthRate: string;
    keyTrends: string[];
    topCountries: TopCountry[];
    majorPlayers: MarketPlayer[];
    technologyLandscape: string[];
  };
  uaeMarket: {
    marketSize: string;
    growthRate: string;
    governmentInitiatives: string[];
    localPlayers: UAEPlayer[];
    opportunities: string[];
    regulatoryConsiderations: string[];
  };
  suppliers: SupplierProvider[];
  useCases: UseCase[];
  competitiveAnalysis: {
    directCompetitors: string[];
    indirectCompetitors: string[];
    marketGaps: string[];
  };
  recommendations: string[];
  riskFactors: string[];
  generatedAt: string;
}

export class MarketResearchService {
  async generateMarketResearch(request: MarketResearchRequest): Promise<MarketResearchResult> {
    try {
      if (request.decisionGovernance?.approved !== true) {
        throw new Error("Market research generation must be approved by Corevia Brain governance before calling the LLM service");
      }

      const aiService = createAIService("text");
      const prompt = this.buildPrompt(request);

      const llmTimeoutMs = 120_000;
      const llmPromise = aiService.generateText({
        systemPrompt:
          "You are a market research analyst specializing in UAE government projects. Respond ONLY with valid, complete JSON matching the requested schema. Do not include markdown fences, code blocks, or commentary - output the raw JSON object directly. Keep string values concise (under 80 characters each) to stay within output limits.",
        messages: [{ role: "user", content: prompt }],
        maxTokens: 16384,
        temperature: 0.3,
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Market research LLM call timed out after 120s")), llmTimeoutMs),
      );

      const rawText = await Promise.race([llmPromise, timeoutPromise]);
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("LLM response did not contain valid JSON");
      }

      let jsonStr = jsonMatch[0];

      try {
        const parsed = JSON.parse(jsonStr) as MarketResearchResult;
        return { ...parsed, generatedAt: parsed.generatedAt || new Date().toISOString() };
      } catch (_parseErr) {
        logger.warn("[MarketResearch] JSON truncated, attempting repair...");
        jsonStr = this.repairTruncatedJson(jsonStr);
        const parsed = JSON.parse(jsonStr) as MarketResearchResult;
        return { ...parsed, generatedAt: parsed.generatedAt || new Date().toISOString() };
      }
    } catch (error) {
      logger.error("[MarketResearch] Governed LLM error generating research:", error);
      throw error;
    }
  }

  private repairTruncatedJson(json: string): string {
    let repaired = json.trimEnd();

    const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      const lastQuote = repaired.lastIndexOf('"');
      repaired = repaired.substring(0, lastQuote) + '"';
    }

    repaired = repaired.replace(/,\s*$/, "");

    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let prevChar = "";
    for (const ch of repaired) {
      if (ch === '"' && prevChar !== "\\") {
        inString = !inString;
      } else if (!inString) {
        if (ch === "{") {
          openBraces++;
        } else if (ch === "}") {
          openBraces--;
        } else if (ch === "[") {
          openBrackets++;
        } else if (ch === "]") {
          openBrackets--;
        }
      }
      prevChar = ch;
    }

    for (let index = 0; index < openBrackets; index++) {
      repaired += "]";
    }
    for (let index = 0; index < openBraces; index++) {
      repaired += "}";
    }

    return repaired;
  }

  private buildPrompt(request: MarketResearchRequest): string {
    const budgetStr = request.estimatedBudget
      ? `AED ${(request.estimatedBudget / 1000000).toFixed(1)}M`
      : "Not specified";

    const objectivesStr = request.objectives?.length
      ? request.objectives.map((objective, index) => `   ${index + 1}. ${objective}`).join("\n")
      : "   Not specified";

    const inScopeStr = request.scope?.inScope?.length
      ? request.scope.inScope.map((scopeItem, index) => `   ${index + 1}. ${scopeItem}`).join("\n")
      : "   Not specified";

    const deliverablesStr = request.scope?.deliverables?.length
      ? request.scope.deliverables
          .map((deliverable, index) => `   ${index + 1}. ${deliverable}`)
          .join("\n")
      : "   Not specified";

    const constraintsStr = request.scope?.constraints?.length
      ? request.scope.constraints
          .map((constraint, index) => `   ${index + 1}. ${constraint}`)
          .join("\n")
      : "   Not specified";

    const assumptionsStr = request.scope?.assumptions?.length
      ? request.scope.assumptions
          .map((assumption, index) => `   ${index + 1}. ${assumption}`)
          .join("\n")
      : "   Not specified";

    const strategicAlignmentStr = request.strategicAlignment?.uaeVision2031?.length
      ? request.strategicAlignment.uaeVision2031
          .map((alignment, index) => `   ${index + 1}. ${alignment}`)
          .join("\n")
      : "   Not specified";

    const benefitsStr = request.expectedBenefits?.length
      ? request.expectedBenefits
          .map(
            (benefit, index) =>
              `   ${index + 1}. ${benefit.description || benefit.category || "Not recorded"}`,
          )
          .join("\n")
      : "   Not specified";

    return `Generate HIGHLY SPECIFIC market research for the following UAE government project. Your research MUST be tailored to the exact objectives and scope described below - NOT generic industry research.

═══════════════════════════════════════════════════════════════════════════════
                          PROJECT DETAILS
═══════════════════════════════════════════════════════════════════════════════

PROJECT NAME: ${request.projectName}

DESCRIPTION:
${request.projectDescription}

PROJECT TYPE/ARCHETYPE: ${request.projectType || request.archetype || "Not recorded"}
ORGANIZATION: ${request.organization || "Not recorded"}
ESTIMATED BUDGET: ${budgetStr}

═══════════════════════════════════════════════════════════════════════════════
                          OBJECTIVES & SCOPE
═══════════════════════════════════════════════════════════════════════════════

OBJECTIVES:
${objectivesStr}

IN SCOPE:
${inScopeStr}

KEY DELIVERABLES:
${deliverablesStr}

CONSTRAINTS:
${constraintsStr}

ASSUMPTIONS:
${assumptionsStr}

═══════════════════════════════════════════════════════════════════════════════
                          STRATEGIC ALIGNMENT
═══════════════════════════════════════════════════════════════════════════════

UAE VISION 2031 ALIGNMENT:
${strategicAlignmentStr}

EXPECTED BENEFITS:
${benefitsStr}

${request.businessCaseSummary ? `EXECUTIVE SUMMARY:\n${request.businessCaseSummary}` : ""}

═══════════════════════════════════════════════════════════════════════════════
                          RESEARCH REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

Based on the SPECIFIC objectives and scope above, provide market research in the following JSON format:

{
  "projectContext": {
    "focusArea": "The specific market/technology domain this project targets (e.g., 'Drone-based Last-Mile Delivery for Government Logistics')",
    "keyObjectives": ["Extracted key objective 1", "Extracted key objective 2"],
    "targetCapabilities": ["Capability 1 required", "Capability 2 required"]
  },
  "globalMarket": {
    "marketSize": "Global market size SPECIFIC to this project domain (e.g., 'USD 8.2B for drone delivery market in 2024')",
    "growthRate": "CAGR for this specific market segment (e.g., '28.5% CAGR 2024-2030')",
    "keyTrends": ["Trend specific to project domain 1", "Trend 2", "Trend 3", "Trend 4", "Trend 5"],
    "topCountries": [
      {
        "country": "Country Name (e.g., 'United States')",
        "rank": 1,
        "marketSize": "Country-specific market size (e.g., 'USD 2.8B in 2024')",
        "growthRate": "Country CAGR (e.g., '24% CAGR 2024-2030')",
        "adoptionMaturity": "Leading/Mature/Growing/Emerging",
        "keyDrivers": ["Key driver 1 for this country", "Key driver 2"],
        "regulatoryEnvironment": "Brief regulatory context (e.g., 'FAA Part 135 approvals advancing')",
        "majorLocalPlayers": ["Local player 1", "Local player 2", "Local player 3"]
      },
      {
        "country": "Second Country",
        "rank": 2,
        "marketSize": "Market size",
        "growthRate": "CAGR",
        "adoptionMaturity": "Growing",
        "keyDrivers": ["Driver 1", "Driver 2"],
        "regulatoryEnvironment": "Regulatory context",
        "majorLocalPlayers": ["Player 1", "Player 2"]
      },
      {
        "country": "Third Country",
        "rank": 3,
        "marketSize": "Market size",
        "growthRate": "CAGR",
        "adoptionMaturity": "Emerging",
        "keyDrivers": ["Driver 1", "Driver 2"],
        "regulatoryEnvironment": "Regulatory context",
        "majorLocalPlayers": ["Player 1", "Player 2"]
      }
    ],
    "majorPlayers": [
      {
        "name": "Company with direct capability for this project",
        "description": "How they specifically address the project objectives",
        "marketShare": "Market share in this specific segment (e.g., '18%')",
        "headquarters": "HQ location (e.g., 'San Francisco, USA')",
        "relevance": "SPECIFIC relevance to the stated objectives and scope",
        "annualRevenue": "Company revenue in this segment (e.g., 'USD 1.2B')",
        "flagshipSolutions": ["Product 1", "Service 2", "Platform 3"],
        "regionalStrength": ["North America", "Europe", "Middle East"],
        "keyClients": ["Client 1", "Client 2", "Client 3"]
      }
    ],
    "technologyLandscape": ["Key technology 1 for this domain", "Technology 2", "Technology 3"]
  },
  "uaeMarket": {
    "marketSize": "UAE-specific market size for this domain",
    "growthRate": "UAE market CAGR",
    "governmentInitiatives": ["Initiative directly supporting this project type", "Related program 2"],
    "localPlayers": [
      {
        "name": "UAE Company with capability for this project",
        "description": "Specific capabilities matching project scope",
        "sector": "Sector",
        "capabilities": ["Capability 1 matching objectives", "Capability 2"]
      }
    ],
    "opportunities": ["Opportunity 1 for this specific project", "Opportunity 2"],
    "regulatoryConsiderations": ["Regulation 1 affecting this project", "Regulation 2"]
  },
  "suppliers": [
    {
      "name": "Supplier with direct capability for project deliverables",
      "category": "Category",
      "services": ["Service matching project scope 1", "Service 2"],
      "uaePresence": true,
      "strengths": "Why this supplier is suited for the project objectives"
    }
  ],
  "useCases": [
    {
      "title": "Use Case directly addressing project objective",
      "description": "How this use case implements the stated scope",
      "benefits": ["Benefit 1 matching expected benefits", "Benefit 2"],
      "implementationComplexity": "Low/Medium/High",
      "estimatedROI": "ROI estimate for this use case",
      "timeframe": "Implementation timeline",
      "relevantPlayers": ["Player 1", "Player 2"]
    }
  ],
  "competitiveAnalysis": {
    "directCompetitors": ["Competitor 1 in same space", "Competitor 2"],
    "indirectCompetitors": ["Indirect competitor 1"],
    "marketGaps": ["Gap this project can fill 1", "Gap 2"]
  },
  "recommendations": [
    "Strategic recommendation 1 addressing project objectives",
    "Recommendation 2 for scope implementation",
    "Recommendation 3 considering constraints"
  ],
  "riskFactors": [
    "Risk 1 based on project constraints",
    "Risk 2 for this domain"
  ]
}

CRITICAL: Your research MUST be SPECIFIC to "${request.projectName}" and the objectives/scope provided.
Keep string values CONCISE to ensure the JSON is COMPLETE and valid.
Include:
- TOP 3 COUNTRIES by market size with detailed analysis (market size, growth rate, adoption maturity, key drivers, regulatory environment, local players)
  * MUST include China if it is among the top 3 markets for this domain (China leads in drone delivery, AI, 5G, manufacturing, etc.)
  * Consider: USA, China, Germany, Japan, UK, UAE, Singapore, South Korea, India, etc.
- 6-10 MAJOR GLOBAL PLAYERS with COMPREHENSIVE profiles including:
  * Annual revenue in this segment
  * Market share percentage
  * 3-5 flagship solutions/products
  * Regional strengths (which regions they dominate)
  * Notable government/enterprise clients
  * MUST include Chinese players if relevant (e.g., Meituan, SF Express, JD.com, DJI, EHang, Huawei, Alibaba, Antwork, etc.)
  * Include players from Americas, Europe, AND Asia-Pacific regions
- 4-6 UAE/GCC players who can deliver on the stated scope
- 8-12 suppliers categorized by the project's deliverables
- 5-7 use cases that DIRECTLY implement the stated objectives
- 4-6 strategic recommendations addressing the constraints and assumptions

All companies must be real and have proven capability in this specific domain. Market figures must be realistic and specific to this project's focus area. Use 2024-2025 data where available. Ensure GLOBAL COVERAGE across Americas, Europe, Middle East, and Asia-Pacific regions.`;
  }
}

export const marketResearchService = new MarketResearchService();