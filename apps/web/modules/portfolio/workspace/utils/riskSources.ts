/**
 * Risk source unification — merges every place a business case OR upstream
 * demand report can park a risk into a single, deduplicated, de-noised register.
 *
 * Business Case sources (in precedence order):
 *   1. riskMatrixData quadrants       — clean probability / impact signal
 *   2. identifiedRisks                — primary structured list (may have corrupted impact=description)
 *   3. keyRisks / risks               — legacy aliases
 *   4. riskAssessment.risks           — alternative shape
 *   5. mitigationStrategies           — enrichment (mitigation text per risk name)
 *   6. contingencyPlans               — enrichment (contingency text per risk name)
 *
 * Demand Report sources (pre-approval risks that must carry over into the register):
 *   A. requirementsAnalysis.risks
 *   B. strategicFitAnalysis.risks
 *   C. strategicFitAnalysis.strategicRisks
 *   D. strategicFitAnalysis.riskMitigation.primaryRisks
 *   E. enterpriseArchitectureAnalysis.risks
 *   F. enterpriseArchitectureAnalysis.riskImpactDashboard.risks
 *
 * Exposed as a helper so both the Initiation Risk tab and the Planning
 * Risk Register tab read exactly the same canonical set of risks.
 */

import type { BusinessCaseData, BusinessCaseRisk } from '../types';

export interface UnifiedRisk extends BusinessCaseRisk {
  /** Canonical display name (Title Case, "Risk" suffix removed). */
  displayName: string;
  /** Normalized probability index 0..4 (Very Low → Very High). */
  probIdx: number;
  /** Normalized impact index 0..4. */
  impactIdx: number;
  /** Derived severity label. */
  severityLabel: 'Low' | 'Medium' | 'High' | 'Critical';
  /** Contingency plan text if known. */
  contingency?: string;
  /** Where this record came from (for debug + UI). */
  sources: string[];
}

const LEVEL_MATRIX: Array<Array<'Low' | 'Medium' | 'High' | 'Critical'>> = [
  ['Low', 'Low', 'Medium', 'Medium', 'High'],
  ['Low', 'Medium', 'Medium', 'High', 'High'],
  ['Medium', 'Medium', 'High', 'High', 'Critical'],
  ['Medium', 'High', 'High', 'Critical', 'Critical'],
  ['High', 'High', 'Critical', 'Critical', 'Critical'],
];

/** Clamp a probability/impact string to index 0..4. Returns `null` when unparseable. */
function parseLevelStrict(raw: string | undefined | null): number | null {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  if (!s || s.length > 16) return null; // long strings are usually descriptions, not severities
  if (s.includes('very low') || s === 'verylow') return 0;
  if (s.includes('very high') || s === 'veryhigh') return 4;
  if (s.includes('critical') || s.includes('severe') || s.includes('extreme')) return 4;
  if (s.includes('high')) return 3;
  if (s.includes('medium') || s.includes('moderate') || s === 'med') return 2;
  if (s.includes('low') || s === 'minor') return 1;
  return null;
}

function parseLevelWithDefault(raw: string | undefined | null, fallback = 2): number {
  const parsed = parseLevelStrict(raw);
  return parsed === null ? fallback : parsed;
}

function normalizeName(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/\s+risk$/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function toTitle(raw: string | undefined): string {
  if (!raw) return 'Unnamed Risk';
  return raw
    .trim()
    .replace(/\s+risk$/i, '')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => (w.length ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

function severityFromIdx(probIdx: number, impactIdx: number): 'Low' | 'Medium' | 'High' | 'Critical' {
  return LEVEL_MATRIX[probIdx]?.[impactIdx] ?? 'Medium';
}

interface QuadrantSeed {
  items?: unknown;
  probHint: number; // 0..4
  impactHint: number;
  label: string;
}

function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** Stopwords we ignore when fuzzy-matching demand vs business case risks. */
const STOPWORDS = new Set([
  'the','a','an','and','or','of','to','in','on','for','with','by','at','as',
  'is','are','was','were','be','been','being','this','that','these','those',
  'may','will','could','should','would','can','risk','risks','issue','issues',
  'it','its','their','they','them','from','have','has','had','not','no',
]);

/** Extract up to N significant tokens from a free-text risk string. */
function significantTokens(raw: string | undefined, limit = 6): string[] {
  if (!raw) return [];
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, limit);
}

/** Build a short display-friendly label from a potentially-long description. */
function labelFromDescription(raw: string | undefined): string {
  if (!raw) return 'Unnamed Risk';
  const trimmed = raw.trim();
  if (trimmed.length <= 72) return toTitle(trimmed);
  // Take the first clause before comma or first 9 words.
  const firstClause = trimmed.split(/[,;:]/, 1)[0] ?? trimmed;
  const words = firstClause.split(/\s+/).slice(0, 9).join(' ');
  return toTitle(words);
}

/**
 * Fuzzy-key match: true when two risk strings share ≥2 significant tokens
 * or one display name appears verbatim as a phrase inside the other.
 */
function fuzzyMatches(aName: string, aText: string, bName: string, bText: string): boolean {
  const na = normalizeName(aName);
  const nb = normalizeName(bName);
  if (na && nb && na === nb) return true;
  const ta = new Set(significantTokens(aName + ' ' + aText));
  const tb = new Set(significantTokens(bName + ' ' + bText));
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  if (shared >= 2) return true;
  // substring phrase match (short name inside the long description of the other).
  const la = (aName || '').toLowerCase();
  const lb = (bName || '').toLowerCase();
  const da = (aText || '').toLowerCase();
  const db = (bText || '').toLowerCase();
  if (la && la.length > 6 && db.includes(la)) return true;
  if (lb && lb.length > 6 && da.includes(lb)) return true;
  return false;
}

/**
 * Build a deduplicated, enriched risk list from every corner of a business case,
 * optionally merging upstream demand-report risks so the register reflects the
 * full decision spine (initiation evidence + approved business case).
 */
export function collectBusinessCaseRisks(
  bc: BusinessCaseData | undefined | null,
  demandReport?: unknown,
): UnifiedRisk[] {
  if (!bc && !demandReport) return [];

  const loose = (bc ?? {}) as unknown as Record<string, unknown>;
  const matrix = loose.riskMatrixData as Record<string, unknown> | undefined;
  const mitigations = asArray<Record<string, unknown>>(loose.mitigationStrategies);
  const contingencies = asArray<Record<string, unknown>>(loose.contingencyPlans);

  const registry = new Map<string, UnifiedRisk>();
  /** Parallel index used for fuzzy matching across heterogeneous shapes. */
  const keyTexts = new Map<string, { name: string; description: string }>();

  /** Try to find an existing entry that fuzzy-matches an incoming candidate. */
  const findFuzzyKey = (name: string, description: string): string | null => {
    for (const [k, t] of keyTexts) {
      if (fuzzyMatches(name, description, t.name, t.description)) return k;
    }
    return null;
  };

  const upsert = (
    raw: BusinessCaseRisk,
    source: string,
    probHint?: number,
    impactHint?: number,
    opts?: { fuzzy?: boolean },
  ): void => {
    const rawName = raw.name || raw.risk || raw.title || raw.description;
    const description = raw.description || '';
    const strictKey = normalizeName(rawName);
    if (!strictKey && !description) return;

    // Resolve target key — strict match first, then optional fuzzy for demand-report
    // entries whose "name" is a long sentence.
    let key = strictKey;
    if (!registry.has(key) && opts?.fuzzy) {
      const fuzzy = findFuzzyKey(rawName || '', description);
      if (fuzzy) key = fuzzy;
    }
    if (!key) return;

    const existing = registry.get(key);
    const probIdxStrict = parseLevelStrict(raw.likelihood || raw.probability);
    const impactIdxStrict = parseLevelStrict(raw.impact);

    const probIdx = existing?.probIdx ?? probIdxStrict ?? probHint ?? 2;
    const impactIdx = existing?.impactIdx ?? impactIdxStrict ?? impactHint ?? 2;
    const nextProb = probIdxStrict ?? probHint ?? probIdx;
    const nextImpact = impactIdxStrict ?? impactHint ?? impactIdx;

    const displayName = existing?.displayName
      || (rawName && rawName.length <= 72 ? toTitle(rawName) : labelFromDescription(description || rawName));

    const merged: UnifiedRisk = {
      ...existing,
      ...raw,
      displayName,
      probIdx: existing ? existing.probIdx : nextProb,
      impactIdx: existing ? existing.impactIdx : nextImpact,
      severityLabel: severityFromIdx(existing ? existing.probIdx : nextProb, existing ? existing.impactIdx : nextImpact),
      sources: Array.from(new Set([...(existing?.sources ?? []), source])),
    };

    if (!existing && (probIdxStrict !== null || impactIdxStrict !== null)) {
      merged.probIdx = nextProb;
      merged.impactIdx = nextImpact;
      merged.severityLabel = severityFromIdx(nextProb, nextImpact);
    }

    // Prefer a clean impact label over a long description dumped into `.impact`.
    const impactLabel = (['Very Low', 'Low', 'Medium', 'High', 'Very High'] as const)[merged.impactIdx] ?? 'Medium';
    merged.impact = impactLabel;
    merged.likelihood = (['Very Low', 'Low', 'Medium', 'High', 'Very High'] as const)[merged.probIdx] ?? 'Medium';

    // Preserve the richer description if one exists.
    if (description && (!merged.description || description.length > merged.description.length)) {
      merged.description = description;
    }
    // Preserve category if not yet set.
    if (!merged.category && raw.category) merged.category = raw.category;
    // Preserve mitigation if more complete text arrives.
    if (raw.mitigation && (!merged.mitigation || raw.mitigation.length > merged.mitigation.length)) {
      merged.mitigation = raw.mitigation;
    }

    registry.set(key, merged);
    keyTexts.set(key, { name: merged.displayName, description: merged.description ?? '' });
  };

  // ── Business Case ──────────────────────────────────────────────────────────
  if (bc) {
    // 1. Matrix quadrants — strongest prob/impact signal.
    const quadrants: QuadrantSeed[] = [
      { items: matrix?.highProbabilityHighImpact, probHint: 4, impactHint: 4, label: 'matrix:HH' },
      { items: matrix?.highProbabilityLowImpact,  probHint: 4, impactHint: 1, label: 'matrix:HL' },
      { items: matrix?.lowProbabilityHighImpact,  probHint: 1, impactHint: 4, label: 'matrix:LH' },
      { items: matrix?.lowProbabilityLowImpact,   probHint: 1, impactHint: 1, label: 'matrix:LL' },
    ];
    for (const q of quadrants) {
      for (const r of asArray<BusinessCaseRisk>(q.items)) {
        upsert(r, q.label, q.probHint, q.impactHint);
      }
    }

    // 2. identifiedRisks — primary list
    for (const r of (bc.identifiedRisks ?? [])) upsert(r, 'identifiedRisks');

    // 3. keyRisks + risks — legacy aliases
    for (const r of (bc.keyRisks ?? [])) upsert(r, 'keyRisks');
    for (const r of (bc.risks ?? [])) upsert(r, 'risks');

    // 3b. riskAssessment.risks — alternative shape
    const ra = bc.riskAssessment;
    if (ra && typeof ra === 'object' && 'risks' in ra) {
      for (const r of asArray<BusinessCaseRisk>(ra.risks)) upsert(r, 'riskAssessment');
    }

    // 4. mitigationStrategies — enrichment only
    for (const m of mitigations) {
      const riskName = (m.risk as string) || (m.name as string) || undefined;
      const key = normalizeName(riskName);
      if (!key) continue;
      const existing = registry.get(key);
      const mitigationText = (m.mitigation as string) || (m.strategy as string) || (m.action as string);
      if (existing) {
        existing.mitigation = existing.mitigation || mitigationText;
        existing.sources.push('mitigationStrategies');
      } else {
        upsert({ name: riskName, mitigation: mitigationText }, 'mitigationStrategies');
      }
    }

    // 5. contingencyPlans — enrichment only
    for (const c of contingencies) {
      const riskName = (c.risk as string) || (c.name as string) || (c.trigger as string) || undefined;
      const key = normalizeName(riskName);
      if (!key) continue;
      const existing = registry.get(key);
      const plan = (c.plan as string) || (c.contingency as string) || (c.response as string);
      if (existing) {
        existing.contingency = existing.contingency || plan;
        existing.sources.push('contingencyPlans');
      } else {
        upsert({ name: riskName, mitigation: plan }, 'contingencyPlans');
      }
    }
  }

  // ── Demand Report (upstream evidence) ──────────────────────────────────────
  if (demandReport) {
    const demandRisks = extractDemandReportRisks(demandReport);
    for (const { risk, source } of demandRisks) {
      upsert(risk, source, undefined, undefined, { fuzzy: true });
    }
  }

  // Sort by severity desc for deterministic UI.
  const severityRank: Record<UnifiedRisk['severityLabel'], number> = { Critical: 3, High: 2, Medium: 1, Low: 0 };
  return Array.from(registry.values()).sort((a, b) => {
    const bySev = severityRank[b.severityLabel] - severityRank[a.severityLabel];
    if (bySev !== 0) return bySev;
    return a.displayName.localeCompare(b.displayName);
  });
}

/**
 * Normalize a demand-report risk row — supports several shapes produced by
 * different demand-analysis agents.
 */
function normalizeDemandRisk(raw: unknown): BusinessCaseRisk | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const description = (r.description as string) || (r.risk as string) || (r.summary as string) || '';
  const name = (r.risk as string) || (r.name as string) || (r.title as string) || description;
  if (!name && !description) return null;
  // Severity may live on `severity` (High/Medium/Low) instead of likelihood.
  const likelihood = (r.likelihood as string) || (r.probability as string) || (r.severity as string) || '';
  const impact = (r.impact as string) || (r.severity as string) || '';
  const mitigation = (r.mitigation as string) || (r.response as string) || (r.recommendation as string) || '';
  const category = (r.category as string) || (r.type as string) || '';
  return { name, description, likelihood, impact, mitigation, category };
}

/**
 * Extract risks from every known demand-report shape. Returns a list of
 * `{risk, source}` tuples so the upserter can tag provenance.
 */
export function extractDemandReportRisks(demandReport: unknown): Array<{ risk: BusinessCaseRisk; source: string }> {
  if (!demandReport || typeof demandReport !== 'object') return [];
  const dr = demandReport as Record<string, unknown>;
  const data = (dr.data as Record<string, unknown>) ?? dr; // tolerate both `{data: …}` and flat payloads

  const paths: Array<{ path: unknown; source: string }> = [
    { path: (data.requirementsAnalysis as Record<string, unknown> | undefined)?.risks, source: 'demand:requirements' },
    { path: (data.strategicFitAnalysis as Record<string, unknown> | undefined)?.risks, source: 'demand:strategicFit' },
    { path: (data.strategicFitAnalysis as Record<string, unknown> | undefined)?.strategicRisks, source: 'demand:strategicRisks' },
    {
      path: ((data.strategicFitAnalysis as Record<string, unknown> | undefined)?.riskMitigation as Record<string, unknown> | undefined)?.primaryRisks,
      source: 'demand:primaryRisks',
    },
    { path: (data.enterpriseArchitectureAnalysis as Record<string, unknown> | undefined)?.risks, source: 'demand:eaRisks' },
    {
      path: ((data.enterpriseArchitectureAnalysis as Record<string, unknown> | undefined)?.riskImpactDashboard as Record<string, unknown> | undefined)?.risks,
      source: 'demand:eaDashboard',
    },
  ];

  const out: Array<{ risk: BusinessCaseRisk; source: string }> = [];
  for (const { path, source } of paths) {
    for (const raw of asArray(path)) {
      const normalized = normalizeDemandRisk(raw);
      if (normalized) out.push({ risk: normalized, source });
    }
  }
  return out;
}

/** Back-compat: read-through helper for UI that already expects `BusinessCaseRisk[]`. */
export function collectLegacyRisks(bc: BusinessCaseData | undefined | null, demandReport?: unknown): BusinessCaseRisk[] {
  return collectBusinessCaseRisks(bc, demandReport).map(r => {
    const { displayName, probIdx: _p, impactIdx: _i, severityLabel: _s, sources: _src, contingency: _c, ...rest } = r;
    return { ...rest, name: displayName };
  });
}

export { parseLevelWithDefault as parseRiskLevel };
