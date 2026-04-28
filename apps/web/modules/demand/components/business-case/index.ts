// ============================================
// business-case/index.ts
// Main barrel export file for Business Case components
// ============================================

// ============================================
// TYPE EXPORTS
// ============================================
export type {
  // Core data types
  BusinessCaseData,
  BusinessCaseSectionProps,
  GenerationPhase,
  BadgeVariant,
  
  // Modal and component prop types
  BusinessCaseGenerationModalProps,
  BusinessCaseIntelligenceRailProps,
  BusinessCaseCommandDockProps,
  LayerNarration,
  QualityReport,
  
  // Section-specific types
  SmartObjective,
  ScopeDefinition,
  Risk,
  RiskMatrix,
  ImplementationPhase,
  ImplementationTimeline,
  Milestone,
  KpiItem,
  SuccessCriterion,
  Stakeholder,
  StakeholderAnalysis,
  RecommendationData,
  AssumptionItem,
  DependencyItem,
  Assumption,
  Dependency,
  Benefit,
  StrategicAlignment,
  
  // Clarification types
  ClarificationQuestion,
  ClarificationResponse,
  ClarificationDomain,
  
  // Market research types
  MarketResearch,
  MarketPlayer,
  MarketCountry,
  LocalPlayer,
  Supplier,
  UseCase,
  
  // Collaboration types
  CollaborationEditor,
  VersionEditConflictPayload,
  VersionEditTakenPayload,
  GenerationProgressPayload,
  
  // Edit data types
  SectionEditData,
  BusinessCaseUpdatePayload,
  NextStep,
} from './types';

// ============================================
// CONSTANTS
// ============================================
export {
  // Generation constants
  GENERATION_PHASES,
  LAYER_STATUS,
  TOTAL_LAYERS,
  PHASE_MESSAGES,
  
  // Document constants
  DOCUMENT_STATUS,
  
  // Styling constants
  GRADIENT_CLASSES,
  BUTTON_CLASSES,
  STATUS_LABELS,
  
  // Threshold constants
  QUALITY_THRESHOLDS,
  INTELLIGENCE_RAIL,
  
  // Config objects
  TEXT_SECTION_CONFIGS,
} from './helpers';

// ============================================
// TYPE ALIASES (from helpers)
// ============================================
export type { LayerStatus, DocumentStatus, TextSectionConfig } from './helpers';

// ============================================
// HELPER FUNCTIONS
// ============================================
export {
  // Array helpers
  createArrayUpdater,
  createScopeUpdater,
  createDepartmentImpactUpdater,
  updateArrayItem,
  
  // Factory functions
  createEmptySmartObjective,
  createEmptyKpi,
  createEmptySuccessCriterion,
  createEmptyStakeholder,
  createEmptyAssumption,
  createEmptyDependency,
  
  // Data extraction helpers
  safeRender,
  getStakeholders,
  getAssumptions,
  getDependencies,
  getKpiItems,
  getSuccessCriteriaItems,
  getAssumptionItems,
  getDependencyItems,
  computePowerInterestMatrix,
  
  // Validation helpers
  isLockedVersion,
  canEditDocument,
  
  // Formatting helpers
  formatPaybackPeriod,
  parseNumberInput,
  
  // Class/style helpers
  getRiskLevelColor,
  getSeverityColor,
  getQualityScoreClasses,
  getQualityCardBackground,
  getLayerClassName,
  getIconClassName,
  getBadgeClassName,
  
  // Text helpers
  getRecommendationsText,
  isEnrichedRecommendations,
  getRiskImpactText,
  getClarificationKey,
} from './helpers';

// ============================================
// CORE COMPONENTS
// ============================================
export { BusinessCaseGenerationModal } from './BusinessCaseGenerationModal';

export { 
  BusinessCaseIntelligenceRail, 
  IntelligenceRailToggle 
} from './BusinessCaseIntelligenceRail';

export { BusinessCaseCommandDock } from './BusinessCaseCommandDock';

// ============================================
// SECTION COMPONENTS - Basic Information
// ============================================
export {
  ExecutiveSummarySection,
  BackgroundContextSection,
  ProblemStatementSection,
  ObjectivesScopeSection,
} from './BusinessCaseSections';

// ============================================
// SECTION COMPONENTS - Additional Details
// ============================================
export {
  RiskAssessmentSection,
  BusinessRequirementsSection,
  SolutionOverviewSection,
  AlternativeSolutionsSection,
  ImplementationPlanSection,
  AssumptionsDependenciesSection,
  RecommendationsSection,
} from './BusinessCaseAdditionalSections';

// ============================================
// SECTION COMPONENTS - Strategic Elements
// ============================================
export {
  StrategicAlignmentSection,
  ComplianceGovernanceSection,
  KPIsSection,
  StakeholderAnalysisSection,
  AssumptionsDependenciesSectionInline,
} from './BusinessCaseStrategicSections';
