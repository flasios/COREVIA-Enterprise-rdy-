/**
 * AI-to-Form Adapter Layer - Simplified Version
 * 
 * Maps AI-generated schema fields to simple form fields and vice versa.
 * Uses actual schema structure from shared/schema.ts
 */

// ==========================================
// TYPE DEFINITIONS FOR ADAPTERS
// ==========================================

// Financial summary structure
interface FinancialSummary {
  totalInvestment?: string | number;
  expectedROI?: string | number;
  paybackPeriod?: string | number;
  netPresentValue?: string | number;
  breakEvenPoint?: string | number;
}

// Implementation timeline structure
interface ImplementationTimelineAI {
  plannedStartDate?: string;
  estimatedDuration?: string;
  keyMilestones?: string[];
  [key: string]: unknown;
}

// Risk summary structure
interface _RiskSummary {
  overallRiskLevel?: string;
  criticalRisks?: Array<Record<string, unknown>>;
  mitigationConfidence?: string;
  riskMitigationStrategy?: string;
}

// AI response for executive summary
interface ExecutiveSummaryAIData {
  businessContext?: string;
  proposedSolution?: string;
  strategicAlignment?: string;
  keyBenefits?: string[] | string;
  financialSummary?: FinancialSummary;
  implementationTimeline?: ImplementationTimelineAI;
  executiveRecommendation?: string;
  problemStatement?: string;
  valueProposition?: string;
  recommendationRationale?: string;
  nextSteps?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

// Form data structure for executive summary
interface ExecutiveSummaryFormData {
  overview?: string;
  projectName?: string;
  objectives?: string;
  keyBenefits?: string | string[];
  estimatedCost?: string | number;
  timeline?: string | number;
  recommendation?: string;
  valueProposition?: string;
}

// Problem statement AI response
interface ProblemStatementAIData {
  currentStateDescription?: string;
  detailedProblemDescription?: string;
  businessImpactAnalysis?: {
    impactDescription?: string;
    affectedProcesses?: string[];
    quantitativeImpact?: Record<string, unknown>;
  };
  problemScope?: {
    organizationalImpact?: string;
    affectedStakeholders?: string[];
    geographicScope?: string;
  };
  urgencyAssessment?: {
    overallUrgency?: string;
    urgencyDrivers?: string[];
  };
  rootCauseAnalysis?: {
    identifiedCauses?: string[];
    analysisMethod?: string;
  };
  [key: string]: unknown;
}

// Form data structure for problem statement
interface ProblemStatementFormData {
  problemDescription?: string;
  currentSituation?: string;
  impact?: string;
  stakeholders?: string;
  urgency?: string;
}

// Solution feature structure
interface SolutionFeature {
  featureName?: string;
  description?: string;
  featureId?: string;
  priority?: string;
  userImpact?: string;
}

// Solution overview AI response
interface SolutionOverviewAIData {
  solutionSummary?: {
    solutionName?: string;
    solutionDescription?: string;
    valueProposition?: string;
    strategicFit?: string;
    solutionType?: string;
  };
  keyFeatures?: SolutionFeature[];
  technicalApproach?: {
    overview?: string;
    architecturalPattern?: string;
    technologyStack?: string[];
  };
  implementationApproach?: {
    approachType?: string;
    phases?: Array<{ description?: string; [key: string]: unknown }>;
  };
  [key: string]: unknown;
}

// Benefit structure for form
interface BenefitFormData {
  benefit?: string;
  description?: string;
}

// Form data structure for solution overview
interface SolutionOverviewFormData {
  proposedSolution?: string;
  keyBenefits?: BenefitFormData[];
  approachOverview?: string;
  technicalApproach?: string;
  implementationHighlights?: string;
}

// Cost item structure
interface CostItem {
  category?: string;
  estimatedCost?: string | number;
}

// Cost benefit AI response
interface CostBenefitAIData {
  investmentCosts?: {
    totalInvestment?: string | number;
    costBreakdown?: CostItem[];
  };
  valueRealization?: {
    primaryBenefits?: string[];
  };
  financialProjection?: {
    roi?: string | number;
    paybackPeriod?: string | number;
  };
  [key: string]: unknown;
}

// Form data structure for cost benefit
interface CostBenefitFormData {
  estimatedCost?: string | number;
  costBreakdown?: string;
  benefits?: string;
  roi?: string | number;
  paybackPeriod?: string | number;
}

// Implementation phase structure
interface ImplementationPhaseAI {
  phaseName?: string;
  duration?: string;
  description?: string;
  startDate?: string;
}

// Timeline AI response
interface TimelineAIData {
  phases?: ImplementationPhaseAI[];
  totalDuration?: string;
  criticalMilestones?: string[];
  [key: string]: unknown;
}

// Form data structure for timeline
interface TimelineFormData {
  duration?: string;
  startDate?: string;
  phases?: string;
  milestones?: string;
}

// Risk item structure
interface RiskItemAI {
  riskName?: string;
  probability?: string;
  impact?: string;
  description?: string;
}

// Risk analysis AI response
interface RiskAnalysisAIData {
  risks?: RiskItemAI[];
  riskMitigationStrategy?: string;
  overallRiskLevel?: string;
  [key: string]: unknown;
}

// Form data structure for risk
interface RiskFormData {
  risks?: string;
  mitigation?: string;
  contingency?: string;
}

// ==========================================
// EXECUTIVE SUMMARY ADAPTER
// ==========================================

export function aiToFormExecutiveSummary(aiData: ExecutiveSummaryAIData): ExecutiveSummaryFormData {
  if (!aiData) return {};
  
  return {
    overview: aiData.businessContext || '',
    projectName: aiData.proposedSolution || '',
    objectives: aiData.strategicAlignment || '',
    keyBenefits: Array.isArray(aiData.keyBenefits) 
      ? aiData.keyBenefits.join('\n\n')
      : aiData.keyBenefits || '',
    estimatedCost: aiData.financialSummary?.totalInvestment || '',
    timeline: aiData.implementationTimeline?.estimatedDuration || '',
    recommendation: aiData.executiveRecommendation || ''
  };
}

export function formToAiExecutiveSummary(formData: ExecutiveSummaryFormData, originalAi?: ExecutiveSummaryAIData): ExecutiveSummaryAIData {
  // Merge with original data to preserve non-form fields
  const updated: ExecutiveSummaryAIData = {
    ...originalAi,
    businessContext: formData.overview || '',
    problemStatement: originalAi?.problemStatement || '',
    proposedSolution: formData.projectName || '',
    strategicAlignment: formData.objectives || '',
    executiveRecommendation: formData.recommendation || 'Recommend'
  };
  
  // Parse key benefits
  if (formData.keyBenefits) {
    if (typeof formData.keyBenefits === 'string') {
      const benefits = formData.keyBenefits.split('\n\n').filter((b: string) => b.trim());
      updated.keyBenefits = benefits.length > 0 ? benefits : originalAi?.keyBenefits || [];
    } else if (Array.isArray(formData.keyBenefits)) {
      updated.keyBenefits = formData.keyBenefits.length > 0 ? formData.keyBenefits : originalAi?.keyBenefits || [];
    }
  } else {
    updated.keyBenefits = originalAi?.keyBenefits || [];
  }
  
  // Parse value proposition
  updated.valueProposition = formData.valueProposition || originalAi?.valueProposition || '';
  
  // Financial summary
  updated.financialSummary = {
    totalInvestment: formData.estimatedCost || originalAi?.financialSummary?.totalInvestment || '',
    expectedROI: originalAi?.financialSummary?.expectedROI || '',
    paybackPeriod: formData.timeline || originalAi?.financialSummary?.paybackPeriod || '',
    netPresentValue: originalAi?.financialSummary?.netPresentValue,
    breakEvenPoint: originalAi?.financialSummary?.breakEvenPoint
  };
  
  // Implementation timeline
  updated.implementationTimeline = originalAi?.implementationTimeline || {
    plannedStartDate: '',
    estimatedDuration: typeof formData.timeline === 'number' ? String(formData.timeline) : (formData.timeline || ''),
    keyMilestones: []
  };
  
  // Risk summary
  updated.riskSummary = originalAi?.riskSummary || {
    overallRiskLevel: 'Medium',
    criticalRisks: [],
    mitigationConfidence: 'Medium',
    riskMitigationStrategy: ''
  };
  
  // Recommendation
  updated.recommendationRationale = originalAi?.recommendationRationale || '';
  updated.nextSteps = originalAi?.nextSteps || [];
  
  return updated;
}

// ==========================================
// PROBLEM STATEMENT ADAPTER
// ==========================================

export function aiToFormProblemStatement(aiData: ProblemStatementAIData): ProblemStatementFormData {
  if (!aiData) return {};
  
  return {
    problemDescription: aiData.currentStateDescription || '',
    currentSituation: aiData.detailedProblemDescription || '',
    impact: aiData.businessImpactAnalysis?.impactDescription || '',
    stakeholders: aiData.problemScope?.affectedStakeholders?.join(', ') || '',
    urgency: aiData.urgencyAssessment?.overallUrgency || ''
  };
}

export function formToAiProblemStatement(formData: ProblemStatementFormData, originalAi?: ProblemStatementAIData): ProblemStatementAIData {
  return {
    ...originalAi,
    currentStateDescription: formData.problemDescription || originalAi?.currentStateDescription || '',
    detailedProblemDescription: formData.currentSituation || originalAi?.detailedProblemDescription || '',
    problemScope: originalAi?.problemScope || {
      organizationalImpact: 'Department',
      affectedStakeholders: [],
      geographicScope: 'Local'
    },
    businessImpactAnalysis: {
      ...originalAi?.businessImpactAnalysis,
      impactDescription: formData.impact || originalAi?.businessImpactAnalysis?.impactDescription || '',
      affectedProcesses: originalAi?.businessImpactAnalysis?.affectedProcesses || [],
      quantitativeImpact: originalAi?.businessImpactAnalysis?.quantitativeImpact || {}
    },
    urgencyAssessment: {
      ...originalAi?.urgencyAssessment,
      overallUrgency: formData.urgency || originalAi?.urgencyAssessment?.overallUrgency || 'Medium',
      urgencyDrivers: originalAi?.urgencyAssessment?.urgencyDrivers || []
    },
    rootCauseAnalysis: originalAi?.rootCauseAnalysis || {
      identifiedCauses: [],
      analysisMethod: 'Standard'
    }
  };
}

// ==========================================
// SOLUTION OVERVIEW ADAPTER
// ==========================================

export function aiToFormSolutionOverview(aiData: SolutionOverviewAIData): SolutionOverviewFormData {
  if (!aiData) return {};
  
  // Build proposed solution text from available fields
  const solutionText = [
    aiData.solutionSummary?.solutionName,
    aiData.solutionSummary?.solutionDescription,
    aiData.solutionSummary?.valueProposition
  ].filter(Boolean).join('\n\n');
  
  // Convert key features to benefits
  const benefits = aiData.keyFeatures?.map((f: SolutionFeature) => ({
    benefit: f.featureName || '',
    description: f.description || ''
  })) || [];
  
  return {
    proposedSolution: solutionText || aiData.solutionSummary?.solutionDescription || '',
    keyBenefits: benefits,
    approachOverview: aiData.solutionSummary?.strategicFit || '',
    technicalApproach: aiData.technicalApproach?.overview || aiData.technicalApproach?.architecturalPattern || '',
    implementationHighlights: aiData.implementationApproach?.phases?.[0]?.description || ''
  };
}

export function formToAiSolutionOverview(formData: SolutionOverviewFormData, originalAi?: SolutionOverviewAIData): SolutionOverviewAIData {
  // Build solution summary
  const lines = formData.proposedSolution ? formData.proposedSolution.split('\n\n') : [];
  
  return {
    ...originalAi,
    solutionSummary: {
      ...originalAi?.solutionSummary,
      solutionName: lines[0] || originalAi?.solutionSummary?.solutionName || '',
      solutionType: originalAi?.solutionSummary?.solutionType || 'New Development',
      solutionDescription: formData.proposedSolution || originalAi?.solutionSummary?.solutionDescription || '',
      strategicFit: formData.approachOverview || originalAi?.solutionSummary?.strategicFit || '',
      valueProposition: lines[lines.length - 1] || originalAi?.solutionSummary?.valueProposition || ''
    },
    keyFeatures: (formData.keyBenefits && Array.isArray(formData.keyBenefits) && formData.keyBenefits.length > 0)
      ? formData.keyBenefits.map((b: BenefitFormData, idx: number) => ({
          featureId: `feature_${idx + 1}`,
          featureName: b.benefit || '',
          description: b.description || '',
          priority: 'High',
          userImpact: 'High'
        }))
      : originalAi?.keyFeatures || [],
    technicalApproach: originalAi?.technicalApproach || {
      overview: formData.technicalApproach || '',
      architecturalPattern: '',
      technologyStack: []
    },
    implementationApproach: originalAi?.implementationApproach || {
      approachType: 'Phased',
      phases: []
    }
  };
}

// ==========================================
// COST BENEFIT ANALYSIS ADAPTER
// ==========================================

export function aiToFormCostBenefit(aiData: CostBenefitAIData): CostBenefitFormData {
  if (!aiData) return {};
  
  const totalCost = aiData.investmentCosts?.totalInvestment || '';
  const costBreakdown = aiData.investmentCosts?.costBreakdown
    ?.map((c: CostItem) => `${c.category}: ${c.estimatedCost}`)
    .join('\n') || '';
  
  return {
    estimatedCost: totalCost,
    costBreakdown,
    benefits: aiData.valueRealization?.primaryBenefits?.join('\n') || '',
    roi: aiData.financialProjection?.roi || '',
    paybackPeriod: aiData.financialProjection?.paybackPeriod || ''
  };
}

// ==========================================
// IMPLEMENTATION TIMELINE ADAPTER
// ==========================================

export function aiToFormTimeline(aiData: TimelineAIData): TimelineFormData {
  if (!aiData) return {};
  
  const phases = aiData.phases
    ?.map((p: ImplementationPhaseAI) => `${p.phaseName} (${p.duration}): ${p.description}`)
    .join('\n\n') || '';
  
  return {
    duration: aiData.totalDuration || '',
    startDate: aiData.phases?.[0]?.startDate || '',
    phases,
    milestones: aiData.criticalMilestones?.join('\n') || ''
  };
}

// ==========================================
// RISK ANALYSIS ADAPTER
// ==========================================

export function aiToFormRisk(aiData: RiskAnalysisAIData): RiskFormData {
  if (!aiData) return {};
  
  const risks = aiData.risks
    ?.map((r: RiskItemAI) => `${r.riskName} (${r.probability} probability, ${r.impact} impact): ${r.description}`)
    .join('\n\n') || '';
  
  return {
    risks,
    mitigation: aiData.riskMitigationStrategy || '',
    contingency: aiData.overallRiskLevel || ''
  };
}

// Union type for all AI data types
type AIDataType = 
  | ExecutiveSummaryAIData 
  | ProblemStatementAIData 
  | SolutionOverviewAIData 
  | CostBenefitAIData 
  | TimelineAIData 
  | RiskAnalysisAIData 
  | Record<string, unknown>;

// Union type for all form data types
type FormDataType = 
  | ExecutiveSummaryFormData 
  | ProblemStatementFormData 
  | SolutionOverviewFormData 
  | CostBenefitFormData 
  | TimelineFormData 
  | RiskFormData 
  | Record<string, unknown>;

// ==========================================
// UNIVERSAL ADAPTER
// ==========================================

export function adaptAiToForm(sectionName: string, aiData: AIDataType): FormDataType {
  if (!aiData) return {};
  
  switch (sectionName) {
    case 'executiveSummary':
      return aiToFormExecutiveSummary(aiData as ExecutiveSummaryAIData);
    case 'problemStatement':
      return aiToFormProblemStatement(aiData as ProblemStatementAIData);
    case 'solutionOverview':
      return aiToFormSolutionOverview(aiData as SolutionOverviewAIData);
    case 'costBenefitAnalysis':
      return aiToFormCostBenefit(aiData as CostBenefitAIData);
    case 'implementationTimeline':
      return aiToFormTimeline(aiData as TimelineAIData);
    case 'riskAnalysis':
      return aiToFormRisk(aiData as RiskAnalysisAIData);
    default:
      return aiData as FormDataType; // Pass through for sections that don't need adaptation
  }
}

export function adaptFormToAi(sectionName: string, formData: FormDataType, originalAi?: AIDataType): AIDataType {
  if (!formData) return {};
  
  switch (sectionName) {
    case 'executiveSummary':
      return formToAiExecutiveSummary(formData as ExecutiveSummaryFormData, originalAi as ExecutiveSummaryAIData);
    case 'problemStatement':
      return formToAiProblemStatement(formData as ProblemStatementFormData, originalAi as ProblemStatementAIData);
    case 'solutionOverview':
      return formToAiSolutionOverview(formData as SolutionOverviewFormData, originalAi as SolutionOverviewAIData);
    default:
      return formData as AIDataType; // Pass through for sections that don't need adaptation
  }
}

// ==========================================
// RAG INTEGRATION TYPES
// ==========================================

// Metadata for documents
interface DocumentMetadata {
  source?: string;
  version?: string;
  [key: string]: unknown;
}

/**
 * Document chunk for RAG agents - flattened search result
 */
export interface DocumentChunk {
  documentId: string;
  chunkId: string;
  content: string;
  relevance?: number;
  originalRelevance?: number; // Pre-reranking score
  metadata?: DocumentMetadata;
}

/**
 * Citation for AI-generated content from knowledge base
 */
export interface AICitation {
  documentId: string;
  documentTitle?: string;
  chunkId: string;
  relevance: number;
  chunkStart?: number;
  chunkEnd?: number;
  page?: number;
  sectionPath?: string;
  excerpt?: string; // First 200 chars of cited chunk
  citationNumber?: number;
  metadata?: DocumentMetadata;
}

/**
 * Confidence breakdown details
 */
export interface AIConfidenceBreakdown {
  maxScore: number;
  meanScore: number;
  uniqueDocumentCount: number;
  coverageScore: number;
  variance?: number;
}

/**
 * Confidence score for AI-generated content
 */
export interface AIConfidence {
  score: number;
  tier: 'high' | 'medium' | 'low';
  percentage: number;
  breakdown?: AIConfidenceBreakdown; // Optional for backward compatibility
}

/**
 * Enhanced AI response with RAG metadata
 */
export interface AIResponseWithRAG<T extends Record<string, unknown> = Record<string, unknown>> {
  data: T;
  citations?: AICitation[];
  confidence?: AIConfidence;
}

/**
 * Business case generation response with RAG
 */
export interface BusinessCaseWithRAG {
  businessCase: AIDataType;
  citations?: AICitation[];
  confidence?: AIConfidence;
}

/**
 * Demand fields response with RAG
 */
export interface DemandFieldsWithRAG {
  fields: Record<string, unknown>;
  citations?: AICitation[];
  confidence?: AIConfidence;
}
