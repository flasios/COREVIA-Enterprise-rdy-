import type {
  Stakeholder,
  StakeholderAnalysis,
  RecommendationData,
  AssumptionItem,
  DependencyItem,
  KpiItem,
  SuccessCriterion
} from './types';
import type { ReportVersion } from '@shared/schema';

// Generation phase constants - eliminates magic strings
export const GENERATION_PHASES = {
  IDLE: 'idle',
  DETECTING: 'detecting',
  WAITING_CLARIFICATIONS: 'waiting_clarifications',
  GENERATING: 'generating',
  COMPLETE: 'complete',
  ERROR: 'error',
} as const;

// Layer status constants
export const LAYER_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  BLOCKED: 'blocked',
} as const;

export type LayerStatus = typeof LAYER_STATUS[keyof typeof LAYER_STATUS];

// Total layers in Decision Brain pipeline
export const TOTAL_LAYERS = 8;

// Phase messages for generation modal (uses TOTAL_LAYERS for consistency)
export const PHASE_MESSAGES: Record<string, string> = {
  [GENERATION_PHASES.DETECTING]: 'Analyzing your demand report through the Decision Brain...',
  [GENERATION_PHASES.WAITING_CLARIFICATIONS]: 'I need a bit more information to proceed.',
  [GENERATION_PHASES.GENERATING]: `Processing through the ${TOTAL_LAYERS}-layer Decision Brain pipeline...`,
  [GENERATION_PHASES.ERROR]: 'An error occurred during generation.',
};

// Gradient class constants for consistent styling (no hover states - Button has built-in)
export const GRADIENT_CLASSES = {
  primary: 'bg-gradient-to-r from-blue-600 to-emerald-600',
  violet: 'bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-900/20',
  amber: 'bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20',
  progress: 'bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500',
} as const;

// Layer status class mappings
const LAYER_STATUS_CLASSES: Record<string, string> = {
  [LAYER_STATUS.IN_PROGRESS]: 'bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-900/20 border-violet-200 dark:border-violet-800 shadow-md',
  [LAYER_STATUS.COMPLETED]: 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800',
  [LAYER_STATUS.BLOCKED]: 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
  [LAYER_STATUS.PENDING]: 'bg-muted/30 border-muted opacity-60',
};

// Icon container status class mappings
const ICON_STATUS_CLASSES: Record<string, string> = {
  [LAYER_STATUS.IN_PROGRESS]: 'bg-violet-500 text-white',
  [LAYER_STATUS.COMPLETED]: 'bg-emerald-500 text-white',
  [LAYER_STATUS.BLOCKED]: 'bg-red-500 text-white',
  [LAYER_STATUS.PENDING]: 'bg-muted text-muted-foreground',
};

// Badge status class mappings
const BADGE_STATUS_CLASSES: Record<string, string> = {
  [LAYER_STATUS.IN_PROGRESS]: 'border-violet-300 text-violet-600',
  [LAYER_STATUS.COMPLETED]: 'border-emerald-300 text-emerald-600',
  [LAYER_STATUS.BLOCKED]: 'border-red-300 text-red-600',
  [LAYER_STATUS.PENDING]: 'border-muted text-muted-foreground',
};

// Status display labels
export const STATUS_LABELS: Record<string, string> = {
  [LAYER_STATUS.IN_PROGRESS]: 'Active',
  [LAYER_STATUS.COMPLETED]: 'Done',
  [LAYER_STATUS.BLOCKED]: 'Blocked',
  [LAYER_STATUS.PENDING]: 'Pending',
};

// Get layer container class based on status
export const getLayerClassName = (status: string): string => {
  const baseClasses = 'flex items-start gap-3 p-3 rounded-lg border transition-all duration-300';
  return `${baseClasses} ${LAYER_STATUS_CLASSES[status] || LAYER_STATUS_CLASSES[LAYER_STATUS.PENDING]}`;
};

// Get icon container class based on status
export const getIconClassName = (status: string): string => {
  const baseClasses = 'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0';
  return `${baseClasses} ${ICON_STATUS_CLASSES[status] || ICON_STATUS_CLASSES[LAYER_STATUS.PENDING]}`;
};

// Get badge class based on status
export const getBadgeClassName = (status: string): string => {
  return `text-xs ${BADGE_STATUS_CLASSES[status] || BADGE_STATUS_CLASSES[LAYER_STATUS.PENDING]}`;
};

// Generate clarification response key
export const getClarificationKey = (domain: string, index: number): string =>
  `${domain}-${index}`;

// Document status constants - eliminates magic strings
export const DOCUMENT_STATUS = {
  DRAFT: 'draft',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  MANAGER_APPROVAL: 'manager_approval',
  PUBLISHED: 'published',
} as const;

export type DocumentStatus = typeof DOCUMENT_STATUS[keyof typeof DOCUMENT_STATUS];

// Button style classes for consistent styling (no hover states - Button has built-in)
export const BUTTON_CLASSES = {
  primary: "h-8 px-3 text-xs bg-gradient-to-r from-blue-600 to-purple-600",
  success: "h-8 px-3 text-xs bg-gradient-to-r from-green-600 to-emerald-600",
  warning: "h-8 px-3 text-xs bg-gradient-to-r from-amber-500 to-orange-500",
  purple: "h-8 px-3 text-xs bg-gradient-to-r from-purple-600 to-indigo-600",
} as const;

// Check if a version is locked (approved or published)
export const isLockedVersion = (version: ReportVersion | null): boolean => {
  if (!version) return false;
  return version.status === DOCUMENT_STATUS.MANAGER_APPROVAL ||
         version.status === DOCUMENT_STATUS.PUBLISHED;
};

// Check if document can be edited
export const canEditDocument = (version: ReportVersion | null): boolean => {
  return !isLockedVersion(version);
};

export const safeRender = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // For risk objects, render a human-readable summary instead of raw JSON
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    // Risk object: show name + impact summary
    if (obj.name && typeof obj.name === 'string') {
      const parts: string[] = [obj.name];
      if (obj.impact && typeof obj.impact === 'string') {
        parts.push(`— ${obj.impact}`);
      } else if (obj.description && typeof obj.description === 'string') {
        parts.push(`— ${obj.description}`);
      }
      return parts.join(' ');
    }
    // Generic object with description
    if (obj.description && typeof obj.description === 'string') return obj.description;
    if (obj.title && typeof obj.title === 'string') return obj.title;
  }
  return JSON.stringify(value);
};

/**
 * Normalize a raw stakeholder object from AI output into the expected Stakeholder shape.
 * AI may return { title, description } instead of { name, influence, interest, engagementStrategy }.
 */
const normalizeStakeholder = (raw: Record<string, unknown>): Stakeholder => {
  const name = (raw.name || raw.title || raw.stakeholder || raw.role || 'Unknown') as string;
  const role = (raw.role || raw.title || '') as string;
  // Default influence/interest to "medium" so stakeholders are distributed across the matrix
  // instead of all falling into "monitor" when AI omits these fields
  const influence = (raw.influence || raw.power || raw.impact || 'medium') as string;
  const interest = (raw.interest || raw.involvement || 'medium') as string;
  const engagementStrategy = (raw.engagementStrategy || raw.strategy || raw.description || '') as string;
  const department = (raw.department || '') as string;
  return { name, role, influence, interest, engagementStrategy, department };
};

export const getStakeholders = (stakeholderAnalysis: StakeholderAnalysis | Stakeholder[] | undefined): Stakeholder[] => {
  if (!stakeholderAnalysis) return [];
  const rawList: unknown[] = Array.isArray(stakeholderAnalysis)
    ? stakeholderAnalysis
    : (stakeholderAnalysis.stakeholders && Array.isArray(stakeholderAnalysis.stakeholders))
      ? stakeholderAnalysis.stakeholders
      : [];
  return rawList.map((item) => {
    if (typeof item === 'object' && item !== null) {
      return normalizeStakeholder(item as Record<string, unknown>);
    }
    return { name: String(item), role: '', influence: 'medium', interest: 'medium', engagementStrategy: '' };
  }).filter(s => s.name && s.name !== 'Unknown' && s.name.trim().length > 0);
};

export const getAssumptions = (keyAssumptions: unknown): string[] => {
  if (!keyAssumptions) return [];
  if (Array.isArray(keyAssumptions)) {
    return keyAssumptions.map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        return (item as Record<string, unknown>).assumption as string ||
               (item as Record<string, unknown>).name as string ||
               (item as Record<string, unknown>).title as string ||
               (item as Record<string, unknown>).description as string || '';
      }
      return '';
    });
  }
  if (typeof keyAssumptions === 'object' && keyAssumptions !== null) {
    const obj = keyAssumptions as Record<string, unknown>;
    if (obj.keyAssumptions && Array.isArray(obj.keyAssumptions)) {
      return getAssumptions(obj.keyAssumptions);
    }
    if (obj.assumptions && Array.isArray(obj.assumptions)) {
      return getAssumptions(obj.assumptions);
    }
  }
  return [];
};

export interface StakeholderDetail {
  name: string;
  role: string;
  influence: string;
  interest: string;
  engagementStrategy: string;
  department: string;
}

export const computePowerInterestMatrix = (stakeholders: Stakeholder[]) => {
  const matrix = {
    manageClosely: [] as StakeholderDetail[],
    keepSatisfied: [] as StakeholderDetail[],
    keepInformed: [] as StakeholderDetail[],
    monitor: [] as StakeholderDetail[]
  };

  stakeholders.forEach((s) => {
    const influence = (s.influence || 'medium').toLowerCase();
    const interest = (s.interest || 'medium').toLowerCase();
    const name = s.name || 'Unknown';
    const detail: StakeholderDetail = {
      name,
      role: s.role || '',
      influence: s.influence || 'medium',
      interest: s.interest || 'medium',
      engagementStrategy: s.engagementStrategy || '',
      department: s.department || '',
    };

    const isHighInfluence = influence.includes('high') || influence.includes('critical');
    const isHighInterest = interest.includes('high') || interest.includes('critical');
    const isLowInfluence = influence.includes('low') || influence.includes('minor');
    const isLowInterest = interest.includes('low') || interest.includes('minor');

    if (isHighInfluence && isHighInterest) {
      matrix.manageClosely.push(detail);
    } else if (isHighInfluence && !isHighInterest) {
      matrix.keepSatisfied.push(detail);
    } else if (!isHighInfluence && isHighInterest) {
      matrix.keepInformed.push(detail);
    } else if (isLowInfluence && isLowInterest) {
      matrix.monitor.push(detail);
    } else {
      // Medium/Medium → distribute to keepInformed for better visibility
      matrix.keepInformed.push(detail);
    }
  });

  return matrix;
};

export const _getStakeholders = getStakeholders;
export const _computePowerInterestMatrix = computePowerInterestMatrix;

export const getRecommendationsText = (recommendations: RecommendationData | string | undefined): string => {
  if (!recommendations) return '';
  if (typeof recommendations === 'string') return recommendations;
  if (recommendations.primaryRecommendation) return recommendations.primaryRecommendation;
  if (recommendations.summary) return recommendations.summary;
  if (recommendations.commercialCase) return recommendations.commercialCase;
  if (recommendations.publicValueCase) return recommendations.publicValueCase;
  if (typeof recommendations === 'object') return '';
  return '';
};

export const isEnrichedRecommendations = (recommendations: RecommendationData | string | undefined): boolean => {
  return !!recommendations &&
         typeof recommendations === 'object' &&
         !Array.isArray(recommendations) &&
         !!(
           recommendations.decisionFramework ||
           recommendations.implementationRoadmap ||
           recommendations.phasedApproach ||
           recommendations.commercialCase ||
           recommendations.publicValueCase ||
           recommendations.keyFindings ||
           recommendations.nextSteps
         );
};

export const getDependencies = (projectDependencies: unknown): string[] => {
  if (!projectDependencies) return [];
  if (Array.isArray(projectDependencies)) {
    return projectDependencies.map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        return (item as Record<string, unknown>).dependency as string ||
               (item as Record<string, unknown>).name as string ||
               (item as Record<string, unknown>).title as string ||
               (item as Record<string, unknown>).description as string || '';
      }
      return '';
    });
  }
  if (typeof projectDependencies === 'object' && projectDependencies !== null) {
    const obj = projectDependencies as Record<string, unknown>;
    if (obj.dependencies && Array.isArray(obj.dependencies)) {
      return getDependencies(obj.dependencies);
    }
    if (obj.projectDependencies && Array.isArray(obj.projectDependencies)) {
      return getDependencies(obj.projectDependencies);
    }
  }
  return [];
};

function normalizeImpactLevel(raw: unknown): string {
  if (!raw || typeof raw !== 'string') return 'Medium';
  const lower = raw.toLowerCase();
  if (lower === 'high' || lower === 'medium' || lower === 'low') return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  // Map descriptive impact strings to levels
  if (lower.includes('critical') || lower.includes('severe') || lower.includes('essential') || lower.includes('required')) return 'High';
  if (lower.includes('significant') || lower.includes('important') || lower.includes('moderate')) return 'Medium';
  if (lower.includes('minor') || lower.includes('negligible') || lower.includes('low')) return 'Low';
  return 'Medium';
}

function normalizeLikelihoodLevel(raw: unknown): string {
  if (!raw || typeof raw !== 'string') return 'Medium';
  const lower = raw.toLowerCase();
  if (lower === 'high' || lower === 'medium' || lower === 'low') return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return 'Medium';
}

export const getAssumptionItems = (data: unknown): AssumptionItem[] => {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map((item) => {
      if (typeof item === 'string') {
        return { assumption: item, impact: 'Medium', likelihood: 'Medium' };
      }
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        const impact = normalizeImpactLevel(obj.impact);
        const likelihood = normalizeLikelihoodLevel(obj.likelihood || obj.confidence);
        const impactScore = impact === 'High' ? 3 : impact === 'Medium' ? 2 : 1;
        const likelihoodScore = likelihood === 'High' ? 3 : likelihood === 'Medium' ? 2 : 1;
        return {
          assumption: (obj.assumption || obj.name || obj.title || obj.description || '') as string,
          category: (obj.category || obj.type || obj.area || '') as string,
          impact,
          likelihood,
          riskScore: typeof obj.riskScore === 'number' ? obj.riskScore : impactScore * likelihoodScore,
          validation: (obj.validation || '') as string,
          validated: typeof obj.validated === 'boolean' ? obj.validated : (typeof obj.validation === 'string' && (obj.validation as string).length > 0),
          mitigation: (obj.mitigation || obj.mitigationStrategy || obj.mitigationPlan || '') as string,
        };
      }
      return { assumption: '', impact: 'Medium', likelihood: 'Medium' };
    });
  }
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (obj.keyAssumptions && Array.isArray(obj.keyAssumptions)) {
      return getAssumptionItems(obj.keyAssumptions);
    }
    if (obj.assumptions && Array.isArray(obj.assumptions)) {
      return getAssumptionItems(obj.assumptions);
    }
  }
  return [];
};

export const getDependencyItems = (data: unknown): DependencyItem[] => {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map((item) => {
      if (typeof item === 'string') {
        return { dependency: item };
      }
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        return {
          dependency: (obj.dependency || obj.name || obj.title || obj.description || '') as string,
          owner: (obj.owner || '') as string,
          status: (obj.status || '') as string,
          impact: (obj.impact || '') as string,
        };
      }
      return { dependency: '' };
    });
  }
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (obj.dependencies && Array.isArray(obj.dependencies)) {
      return getDependencyItems(obj.dependencies);
    }
    if (obj.projectDependencies && Array.isArray(obj.projectDependencies)) {
      return getDependencyItems(obj.projectDependencies);
    }
  }
  return [];
};

export const getKpiItems = (data: unknown): KpiItem[] => {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map((item) => {
      if (typeof item === 'string') {
        return { name: item, description: '', baseline: '', target: '' };
      }
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        return {
          name: (obj.name || obj.kpi || '') as string,
          description: (obj.description || '') as string,
          baseline: (obj.baseline || '') as string,
          target: (obj.target || '') as string,
        };
      }
      return { name: '', description: '', baseline: '', target: '' };
    });
  }
  return [];
};

export const getSuccessCriteriaItems = (data: unknown): SuccessCriterion[] => {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map((item) => {
      if (typeof item === 'string') {
        return { criterion: item, target: '' };
      }
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        return {
          criterion: (obj.criterion || obj.name || obj.description || '') as string,
          target: (obj.target || '') as string,
        };
      }
      return { criterion: '', target: '' };
    });
  }
  return [];
};

export const getRiskLevelColor = (level: string) => {
  switch (level?.toLowerCase()) {
    case 'low': return 'bg-green-500/10 text-green-700 border-green-200 dark:text-green-400';
    case 'medium': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:text-yellow-400';
    case 'high': return 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-400';
    case 'critical': return 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-400';
    default: return 'bg-gray-500/10 text-gray-700 border-gray-200 dark:text-gray-400';
  }
};

export const getSeverityColor = (severity: string) => {
  switch (severity?.toLowerCase()) {
    case 'low': return 'bg-green-500/10 text-green-700 border-green-200 dark:text-green-400';
    case 'medium': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:text-yellow-400';
    case 'high': return 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-400';
    case 'critical': return 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-400';
    default: return 'bg-gray-500/10 text-gray-700 border-gray-200 dark:text-gray-400';
  }
};

export const getRiskImpactText = (impact: string | Record<string, unknown> | undefined): string => {
  if (typeof impact === 'string') return impact;
  if (!impact) return 'No impact details';

  const val = impact.positive || impact.negative || impact.mitigation;
  return typeof val === 'string' ? val : JSON.stringify(val || impact);
};

export const parseNumberInput = (value: string, defaultValue: number = 0): number => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

export const updateArrayItem = <T,>(
  array: T[] | undefined,
  index: number,
  updater: (item: T) => T
): T[] => {
  const arr = array || [];
  return arr.map((item, i) => (i === index ? updater(item) : item));
};

export const formatPaybackPeriod = (months: number): string => {
  if (!months || months <= 0) return 'N/A';
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years === 0) return `${remainingMonths} months`;
  if (remainingMonths === 0) return `${years} year${years > 1 ? 's' : ''}`;
  return `${years} year${years > 1 ? 's' : ''} ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
};

// Array field updater - eliminates repeated mutation logic
export const createArrayUpdater = <T>(
  array: T[] | undefined,
  updateField: (field: string, value: T[]) => void,
  fieldName: string
) => {
  const arr = array || [];

  return {
    updateItem: (index: number, updates: Partial<T>) => {
      const updated = [...arr];
      updated[index] = { ...arr[index]!, ...updates };
      updateField(fieldName, updated);
    },

    removeItem: (index: number) => {
      const updated = arr.filter((_, i) => i !== index);
      updateField(fieldName, updated);
    },

    addItem: (newItem: T) => {
      updateField(fieldName, [...arr, newItem]);
    },

    getItems: () => arr,
  };
};

// Scope definition array updater - handles nested object updates
export const createScopeUpdater = (
  scopeDefinition: { inScope?: string[]; outOfScope?: string[] } | undefined,
  updateField: (field: string, value: unknown) => void
) => {
  const scope = scopeDefinition || { inScope: [], outOfScope: [] };

  return {
    updateItem: (arrayName: 'inScope' | 'outOfScope', index: number, value: string) => {
      const updated = { ...scope };
      const array = [...(updated[arrayName] || [])];
      array[index] = value;
      updated[arrayName] = array;
      updateField('scopeDefinition', updated);
    },

    removeItem: (arrayName: 'inScope' | 'outOfScope', index: number) => {
      const updated = { ...scope };
      updated[arrayName] = (updated[arrayName] || []).filter((_, i) => i !== index);
      updateField('scopeDefinition', updated);
    },

    addItem: (arrayName: 'inScope' | 'outOfScope') => {
      const updated = { ...scope };
      updated[arrayName] = [...(updated[arrayName] || []), ''];
      updateField('scopeDefinition', updated);
    },

    getItems: (arrayName: 'inScope' | 'outOfScope') => scope[arrayName] || [],
  };
};

// Factory functions for creating empty objects
export const createEmptySmartObjective = () => ({
  objective: '',
  specific: '',
  measurable: '',
  achievable: '',
  relevant: '',
  timeBound: '',
});

export const createEmptyKpi = (): KpiItem => ({
  name: '',
  description: '',
  baseline: '',
  target: '',
});

export const createEmptySuccessCriterion = (): SuccessCriterion => ({
  criterion: '',
  target: '',
});

export const createEmptyStakeholder = (): Stakeholder => ({
  name: '',
  role: '',
  influence: 'Medium',
  interest: 'Medium',
  engagementStrategy: '',
});

export const createEmptyAssumption = (): AssumptionItem => ({
  assumption: '',
  category: '',
  impact: 'Medium',
  likelihood: 'Medium',
  riskScore: 4,
  validation: '',
  validated: false,
  mitigation: '',
});

export const createEmptyDependency = (): DependencyItem => ({
  dependency: '',
  owner: '',
  status: 'Active',
  impact: '',
});

// Department impact updater helper
export const createDepartmentImpactUpdater = (
  departmentImpact: { positive?: string[]; negative?: string[]; mitigation?: string[] } | undefined,
  updateField: (field: string, value: unknown) => void
) => {
  const impact = departmentImpact || { positive: [], negative: [], mitigation: [] };

  return {
    updateArray: (arrayName: 'positive' | 'negative' | 'mitigation', value: string) => {
      const lines = value.split('\n').filter(line => line.trim());
      updateField('departmentImpact', { ...impact, [arrayName]: lines });
    },
    getItems: (arrayName: 'positive' | 'negative' | 'mitigation') => impact[arrayName] || [],
  };
};

// Text section configuration for DRY component creation
export interface TextSectionConfig {
  field: string;
  title: string;
  gradientFrom: string;
  gradientTo: string;
  minHeightClass: string;
}

// Pre-configured text section configs with static Tailwind classes
export const TEXT_SECTION_CONFIGS = {
  executiveSummary: {
    field: 'executiveSummary',
    title: 'Executive Summary',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-blue-600',
    minHeightClass: 'min-h-[120px]',
  },
  backgroundContext: {
    field: 'backgroundContext',
    title: 'Background & Context',
    gradientFrom: 'from-indigo-500',
    gradientTo: 'to-indigo-600',
    minHeightClass: 'min-h-[120px]',
  },
  problemStatement: {
    field: 'problemStatement',
    title: 'Problem Statement',
    gradientFrom: 'from-rose-500',
    gradientTo: 'to-rose-600',
    minHeightClass: 'min-h-[120px]',
  },
} as const;

// Intelligence Rail constants
export const INTELLIGENCE_RAIL = {
  WIDTH: 280,
  MAX_QUALITY_CHECKS: 3,
  MAX_RECENT_VERSIONS: 3,
} as const;

// Quality score thresholds
export const QUALITY_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
  POOR: 0,
} as const;

// Get quality score badge classes based on score
export const getQualityScoreClasses = (score: number): string => {
  if (score >= QUALITY_THRESHOLDS.EXCELLENT) {
    return 'bg-green-500/20 text-green-700 dark:text-green-300';
  }
  if (score >= QUALITY_THRESHOLDS.GOOD) {
    return 'bg-amber-500/20 text-amber-700 dark:text-amber-300';
  }
  return 'bg-red-500/20 text-red-700 dark:text-red-300';
};

// Get quality card background class based on pass status
export const getQualityCardBackground = (passed: boolean): string => {
  return passed ? 'bg-green-500/5' : 'bg-amber-500/5';
};
