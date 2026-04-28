export type BusinessCaseViewMode = 'pilot' | 'full';
export type BusinessCaseLayerKey = 'case' | 'financial';

export type StageEditableField =
  | 'executiveSummary'
  | 'backgroundContext'
  | 'problemStatement'
  | 'smartObjectives'
  | 'scopeDefinition'
  | 'riskLevel'
  | 'riskScore'
  | 'businessRequirements'
  | 'solutionOverview'
  | 'alternativeSolutions'
  | 'identifiedRisks'
  | 'implementationPhases'
  | 'milestones'
  | 'strategicObjectives'
  | 'departmentImpact'
  | 'complianceRequirements'
  | 'policyReferences'
  | 'kpis'
  | 'successCriteria'
  | 'stakeholderAnalysis'
  | 'keyAssumptions'
  | 'assumptions'
  | 'projectDependencies'
  | 'dependencies'
  | 'implementationTimeline'
  | 'recommendations'
  | 'nextSteps'
  | 'conclusionSummary';

export const STAGE_EDITABLE_FIELDS = new Set<StageEditableField>([
  'executiveSummary',
  'backgroundContext',
  'problemStatement',
  'smartObjectives',
  'scopeDefinition',
  'riskLevel',
  'riskScore',
  'businessRequirements',
  'solutionOverview',
  'alternativeSolutions',
  'identifiedRisks',
  'implementationPhases',
  'milestones',
  'strategicObjectives',
  'departmentImpact',
  'complianceRequirements',
  'policyReferences',
  'kpis',
  'successCriteria',
  'stakeholderAnalysis',
  'keyAssumptions',
  'assumptions',
  'projectDependencies',
  'dependencies',
  'implementationTimeline',
  'recommendations',
  'nextSteps',
  'conclusionSummary',
]);

export const PILOT_SCOPE_KEYWORDS = [
  'pilot',
  'proof',
  'validation',
  'mobilization',
  'mobilisation',
  'corridor',
  'readiness',
  'approval',
  'launch',
  'mvp',
  'phase 1',
  'phase one',
];

export const FULL_SCOPE_KEYWORDS = [
  'full',
  'commercial',
  'scale',
  'rollout',
  'expansion',
  'network',
  'enterprise',
  'citywide',
  'production',
  'hardening',
  'phase 2',
  'phase two',
];

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

export function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function asFiniteNumber(value: unknown): number | null {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function normalizeRatio(value: unknown): number | null {
  const numericValue = asFiniteNumber(value);
  if (numericValue == null) {
    return null;
  }
  return numericValue > 1 ? numericValue / 100 : numericValue;
}

export function normalizeRateDecimal(value: unknown): number | null {
  const numericValue = asFiniteNumber(value);
  if (numericValue == null) {
    return null;
  }
  return numericValue > 1 ? numericValue / 100 : numericValue;
}

export function normalizeRecordNumbers(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, entryValue]) => {
    const numericValue = asFiniteNumber(entryValue);
    if (numericValue != null) {
      acc[key] = numericValue;
    }
    return acc;
  }, {});
}

export function joinNarrativeParts(parts: Array<string | undefined>): string {
  return parts
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

export function formatCompactAed(value: number | null): string {
  if (value == null) {
    return 'AED 0';
  }
  if (Math.abs(value) >= 1_000_000) {
    return `AED ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `AED ${(value / 1_000).toFixed(1)}K`;
  }
  return `AED ${Math.round(value).toLocaleString('en-AE')}`;
}

export function countKeywordHits(text: string, keywords: string[]): number {
  const normalizedText = text.toLowerCase();
  return keywords.reduce((score, keyword) => score + (normalizedText.includes(keyword) ? 1 : 0), 0);
}

export function splitNarrativeSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function pickScopedSentences(text: string, view: BusinessCaseViewMode, maxSentences = 2): string[] {
  const sentences = splitNarrativeSentences(text);
  if (sentences.length === 0) {
    return [];
  }

  const preferredKeywords = view === 'pilot' ? PILOT_SCOPE_KEYWORDS : FULL_SCOPE_KEYWORDS;
  const excludedKeywords = view === 'pilot' ? FULL_SCOPE_KEYWORDS : [];
  const eligibleSentences = sentences.filter((sentence) => countKeywordHits(sentence, excludedKeywords) === 0);
  const prioritized = eligibleSentences.filter((sentence) => countKeywordHits(sentence, preferredKeywords) > 0);
  const neutral = eligibleSentences.filter((sentence) => countKeywordHits(sentence, preferredKeywords) === 0);

  return [...prioritized, ...neutral].slice(0, Math.min(maxSentences, sentences.length));
}

export function buildSentenceList(items: string[] | undefined, maxItems = 3): string {
  return (items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .join(', ');
}

export function rewriteDroneStageText(text: string | undefined, view: BusinessCaseViewMode): string {
  const value = (text ?? '').trim();
  if (!value) {
    return value;
  }

  if (view === 'pilot') {
    return value
      .replace(/600[–-]1,200 deliveries\/day/gi, '240-540 deliveries/day')
      .replace(/150-200 deliveries per drone\/day/gi, '110-140 deliveries per drone/day')
      .replace(/150-200 deliveries per drone per day/gi, '110-140 deliveries per drone per day')
      .replace(/sub-AED 35/gi, 'sub-AED 30')
      .replace(/≤ AED 35/gi, '≤ AED 30');
  }

  return value
    .replace(/150-200 deliveries per drone\/day/gi, '110-140 deliveries per drone/day')
    .replace(/150-200 deliveries per drone per day/gi, '110-140 deliveries per drone per day')
    .replace(/sub-AED 35/gi, 'sub-AED 30')
    .replace(/≤ AED 35/gi, '≤ AED 30');
}

export function normalizeObjectArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function pickStageSpecificList(items: string[] | undefined, view: BusinessCaseViewMode, fallback: string[]): string[] {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (list.length === 0) {
    return fallback;
  }

  if (view === 'full') {
    return list;
  }

  const preferred = list.filter((item) => countKeywordHits(item, PILOT_SCOPE_KEYWORDS) > 0 && countKeywordHits(item, FULL_SCOPE_KEYWORDS) === 0);
  if (preferred.length > 0) {
    return preferred;
  }

  const neutral = list.filter((item) => countKeywordHits(item, FULL_SCOPE_KEYWORDS) === 0);
  return neutral.length > 0 ? neutral.slice(0, Math.min(4, neutral.length)) : list.slice(0, Math.min(4, list.length));
}
