import type { BusinessCaseData } from "@/modules/demand/components/business-case/types";

// Default values for market research request
export const MARKET_RESEARCH_DEFAULTS = {
  ORGANIZATION: 'Not recorded',
  PROJECT_TYPE: 'not_recorded',
  PROJECT_NAME: 'Not recorded',
  PROJECT_DESCRIPTION: 'Not recorded',
} as const;

// Market research request interface
export interface MarketResearchRequest {
  projectName: string;
  projectDescription: string;
  projectType: string;
  organization: string;
  estimatedBudget?: number;
  businessCaseSummary?: string;
  archetype?: string;
  demandReportId?: string | number;
  objectives: string[];
  scope: {
    inScope: string[];
    outOfScope: string[];
    deliverables: string[];
    constraints: string[];
    assumptions: string[];
  };
  strategicAlignment: {
    uaeVision2031: string[];
    organizationalObjectives: string[];
    digitalAgenda: string[];
  };
  expectedBenefits: Array<{
    category: string;
    description: string;
  }>;
}

// Demand report data interface (simplified for extraction purposes)
interface DemandReportData {
  id?: string | number;
  data?: {
    title?: string;
    [key: string]: unknown;
  };
}

// Smart objective type
interface SmartObjective {
  objective?: string;
  specific?: string;
  description?: string;
  [key: string]: unknown;
}

// Benefit type
interface BenefitItem {
  category?: string;
  type?: string;
  description?: string;
  benefit?: string;
  title?: string;
  [key: string]: unknown;
}

// Scope definition type
interface ScopeDefinition {
  inScope?: string[];
  outOfScope?: string[];
  deliverables?: string[];
  constraints?: string[];
  assumptions?: string[];
}

// Strategic alignment type
interface StrategicAlignment {
  uaeVision2031?: string[];
  governmentStrategies?: string[];
  organizationalObjectives?: string[];
  digitalAgenda?: string[];
}

/**
 * MarketResearchDataExtractor - Extracts and transforms business case data
 * for market research API requests. Centralizes all complex data extraction
 * logic that was previously in the UI component.
 */
export class MarketResearchDataExtractor {
  /**
   * Extract market research request data from business case and demand report
   */
  static extractFromBusinessCase(
    businessCase: BusinessCaseData | null,
    demandReportData: DemandReportData | null
  ): MarketResearchRequest {
    return {
      projectName: this.getProjectName(businessCase, demandReportData),
      projectDescription: this.getProjectDescription(businessCase),
      projectType: this.getProjectType(businessCase),
      organization: MARKET_RESEARCH_DEFAULTS.ORGANIZATION,
      estimatedBudget: this.getTotalCost(businessCase),
      businessCaseSummary: businessCase?.executiveSummary,
      archetype: this.getArchetype(businessCase),
      demandReportId: demandReportData?.id,
      objectives: this.extractObjectives(businessCase),
      scope: this.extractScope(businessCase),
      strategicAlignment: this.extractStrategicAlignment(businessCase),
      expectedBenefits: this.extractBenefits(businessCase),
    };
  }

  private static getProjectName(
    businessCase: BusinessCaseData | null,
    demandReportData: DemandReportData | null
  ): string {
    return (
      demandReportData?.data?.title ||
      businessCase?.projectTitle ||
      MARKET_RESEARCH_DEFAULTS.PROJECT_NAME
    );
  }

  private static getProjectDescription(businessCase: BusinessCaseData | null): string {
    return (
      businessCase?.executiveSummary ||
      businessCase?.problemStatement ||
      MARKET_RESEARCH_DEFAULTS.PROJECT_DESCRIPTION
    );
  }

  private static getProjectType(businessCase: BusinessCaseData | null): string {
    const financialModel = businessCase?.financialModel as Record<string, unknown> | undefined;
    const computedModel = businessCase?.computedFinancialModel as Record<string, unknown> | undefined;
    const inputs = computedModel?.inputs as Record<string, unknown> | undefined;
    
    return (
      (financialModel?.archetype as string) ||
      (inputs?.archetype as string) ||
      MARKET_RESEARCH_DEFAULTS.PROJECT_TYPE
    );
  }

  private static getArchetype(businessCase: BusinessCaseData | null): string | undefined {
    const computedModel = businessCase?.computedFinancialModel as Record<string, unknown> | undefined;
    const inputs = computedModel?.inputs as Record<string, unknown> | undefined;
    return inputs?.archetype as string | undefined;
  }

  private static getTotalCost(businessCase: BusinessCaseData | null): number | undefined {
    const computedModel = businessCase?.computedFinancialModel as Record<string, unknown> | undefined;
    const metrics = computedModel?.metrics as Record<string, unknown> | undefined;
    
    return (
      businessCase?.totalCostEstimate ||
      (metrics?.totalCosts as number | undefined)
    );
  }

  private static extractObjectives(businessCase: BusinessCaseData | null): string[] {
    const smartObjs = businessCase?.smartObjectives as SmartObjective[] | undefined;
    if (!Array.isArray(smartObjs)) return [];
    
    return smartObjs
      .map((obj) => obj.objective || obj.specific || obj.description || '')
      .filter(Boolean);
  }

  private static extractScope(businessCase: BusinessCaseData | null): MarketResearchRequest['scope'] {
    const scopeDef = (businessCase?.scopeDefinition || {}) as ScopeDefinition;
    
    return {
      inScope: Array.isArray(scopeDef.inScope) ? scopeDef.inScope : [],
      outOfScope: Array.isArray(scopeDef.outOfScope) ? scopeDef.outOfScope : [],
      deliverables: Array.isArray(scopeDef.deliverables) ? scopeDef.deliverables : [],
      constraints: Array.isArray(scopeDef.constraints) ? scopeDef.constraints : [],
      assumptions: Array.isArray(scopeDef.assumptions) ? scopeDef.assumptions : [],
    };
  }

  private static extractStrategicAlignment(
    businessCase: BusinessCaseData | null
  ): MarketResearchRequest['strategicAlignment'] {
    const stratAlign = (businessCase?.strategicAlignment || {}) as StrategicAlignment;
    
    return {
      uaeVision2031: Array.isArray(stratAlign.uaeVision2031) 
        ? stratAlign.uaeVision2031 
        : Array.isArray(stratAlign.governmentStrategies)
          ? stratAlign.governmentStrategies
          : [],
      organizationalObjectives: Array.isArray(stratAlign.organizationalObjectives) 
        ? stratAlign.organizationalObjectives 
        : [],
      digitalAgenda: Array.isArray(stratAlign.digitalAgenda) 
        ? stratAlign.digitalAgenda 
        : [],
    };
  }

  private static extractBenefits(
    businessCase: BusinessCaseData | null
  ): MarketResearchRequest['expectedBenefits'] {
    const rawBenefits = businessCase?.benefits || businessCase?.detailedBenefits || [];
    if (!Array.isArray(rawBenefits)) return [];
    
    return rawBenefits.map((b: unknown) => {
      const benefit = b as BenefitItem;
      return {
        category: benefit.category || benefit.type || '',
        description: benefit.description || benefit.benefit || benefit.title || '',
      };
    });
  }
}

/**
 * Get user-friendly error message for market research generation failures
 */
export const getMarketResearchErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message.includes('network')) {
      return 'Network error. Please check your connection.';
    }
    if (error.message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    if (error.message.includes('unauthorized') || error.message.includes('401')) {
      return 'You do not have permission to generate market research.';
    }
    if (error.message.includes('Failed to generate')) {
      return error.message;
    }
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
};
