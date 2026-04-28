export const REQUIREMENTS_SECTIONS = {
  CAPABILITIES: 'capabilities',
  CAPABILITY_GAPS: 'capabilityGaps',
  FUNCTIONAL: 'functionalRequirements',
  NON_FUNCTIONAL: 'nonFunctionalRequirements',
  SECURITY: 'securityRequirements',
  PHASE_PLAN: 'phasePlan',
  INTEGRATIONS: 'integrations',
  OPERATIONS: 'operationalRequirements',
  DATA_REQUIREMENTS: 'dataRequirements',
  BUSINESS_OUTCOMES: 'businessOutcomes',
  TRACEABILITY: 'traceabilityMatrix',
  PLANNING_BOUNDS: 'assumptionsConstraints',
  RECOMMENDATIONS: 'worldClassRecommendations',
  RESOURCES: 'requiredResources',
  EFFORT: 'estimatedEffort',
  ROLES: 'rolesAndResponsibilities',
  TECHNOLOGY: 'requiredTechnology',
} as const;

export type RequirementsSection = typeof REQUIREMENTS_SECTIONS[keyof typeof REQUIREMENTS_SECTIONS];