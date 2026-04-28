import type { BusinessCaseData, ProjectData, WbsTaskData } from '../../../types';
import type {
  CbsLineItem,
  CostPlanState,
  RateCardEntry,
  ReserveState,
} from './CostManagementStudio.types';

export const AED = (n: number) =>
  new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0,
  );

export const num = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export const toPct = (n: number) => `${(Number.isFinite(n) ? n : 0).toFixed(1)}%`;

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
export const prettyMonth = (key: string) => {
  const parts = key.split('-').map(Number);
  const y = parts[0] ?? new Date().getUTCFullYear();
  const m = parts[1] ?? 1;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
};

export const prettyPlanDate = (value?: string | null) => {
  if (!value) return 'No due date';
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

// ────────────────────────────────────────────────────────────────────────────
// Defaults — create a sensible starting plan from project + WBS if empty
// ────────────────────────────────────────────────────────────────────────────

export const defaultRateCard = (): RateCardEntry[] => [
  { id: uid(), category: 'labor', code: 'LAB-PM', name: 'Project Manager', unit: 'hour', rate: 650, burdenPct: 18 },
  { id: uid(), category: 'labor', code: 'LAB-SR', name: 'Senior Engineer', unit: 'hour', rate: 550, burdenPct: 18 },
  { id: uid(), category: 'labor', code: 'LAB-ENG', name: 'Engineer', unit: 'hour', rate: 380, burdenPct: 18 },
  { id: uid(), category: 'labor', code: 'LAB-ANA', name: 'Business Analyst', unit: 'hour', rate: 320, burdenPct: 18 },
  { id: uid(), category: 'subcontractor', code: 'SUB-IMPL', name: 'Implementation Partner', unit: 'day', rate: 9500, burdenPct: 0 },
  { id: uid(), category: 'material', code: 'MAT-LIC', name: 'Software Licence (annual)', unit: 'licence', rate: 4200, burdenPct: 0 },
  { id: uid(), category: 'equipment', code: 'EQ-HW', name: 'Workstation / Hardware', unit: 'unit', rate: 7800, burdenPct: 5 },
  { id: uid(), category: 'overhead', code: 'OH-PMO', name: 'PMO / Governance', unit: 'month', rate: 22000, burdenPct: 0 },
];

export const defaultReserves = (bc?: BusinessCaseData | null): ReserveState => {
  // Prefer the business-case financial engine's contingency / maintenance
  // assumptions when available — that way the baseline reserve matches what
  // the committee approved.
  const fa = bc?.financialAssumptions;
  const contingencyPct = fa?.contingencyPercent != null ? Math.round(Number(fa.contingencyPercent) * 100) : 10;
  const managementPct = fa?.maintenancePercent != null ? Math.round(Number(fa.maintenancePercent) * 100) : 5;
  return {
    contingencyPct: Number.isFinite(contingencyPct) ? contingencyPct : 10,
    contingencyUsed: 0,
    managementReservePct: Number.isFinite(managementPct) ? managementPct : 5,
    managementReserveUsed: 0,
  };
};

// Infer CBS category + natural unit from WBS task context (title, description, type).
// Keyword-driven classifier — deterministic, language-aware for EN/AR professional services terms.
export type InferredCbsKind = {
  category: CbsLineItem['category'];
  unit: string;
  costClass: CbsLineItem['costClass'];
};

export function inferCbsKind(task: WbsTaskData): InferredCbsKind {
  const text = [task.title, task.taskName, task.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const has = (re: RegExp) => re.test(text);

  // Software licences, subscriptions, SaaS, cloud — typically OPEX material
  if (has(/\b(licen[cs]e|subscription|saas|software fee|annual fee|renewal|cloud service|platform fee)\b/)) {
    return { category: 'material', unit: 'licence', costClass: 'OPEX' };
  }
  // Physical hardware, infrastructure, devices
  if (has(/\b(hardware|server|workstation|laptop|desktop|appliance|device|equipment|infrastructure|network gear|router|switch|storage array)\b/)) {
    return { category: 'equipment', unit: 'unit', costClass: 'CAPEX' };
  }
  // Consumables, supplies, parts, raw materials
  if (has(/\b(material|supplies|consumable|spare part|stock|inventory item|raw material)\b/)) {
    return { category: 'material', unit: 'unit', costClass: 'CAPEX' };
  }
  // Subcontractor / implementation partner / vendor / integrator
  if (has(/\b(vendor|subcontract|sub-contract|contractor|partner|supplier|implementation partner|integrator|system integrator|outsourc|third[- ]?party|managed service)\b/)) {
    return { category: 'subcontractor', unit: 'day', costClass: 'CAPEX' };
  }
  // Training, workshops, enablement — usually subcontractor day-rate
  if (has(/\b(training|workshop|coaching|enablement|change management|bootcamp|upskilling)\b/)) {
    return { category: 'subcontractor', unit: 'day', costClass: 'OPEX' };
  }
  // Consulting / advisory
  if (has(/\b(consult|advisory|assessment|audit(?:or)?)\b/)) {
    return { category: 'subcontractor', unit: 'day', costClass: 'CAPEX' };
  }
  // PMO / governance / admin overhead
  if (has(/\b(pmo|governance|steering|administration|admin overhead|facilities|office cost|management office|overhead)\b/)) {
    return { category: 'overhead', unit: 'month', costClass: 'OPEX' };
  }
  // Travel / logistics
  if (has(/\b(travel|logistics|transport|lodging|accommodation|per[- ]?diem)\b/)) {
    return { category: 'overhead', unit: 'trip', costClass: 'OPEX' };
  }
  // Maintenance / support / operations
  if (has(/\b(maintenance|support contract|warranty|o&m|operations fee|hosting)\b/)) {
    return { category: 'material', unit: 'month', costClass: 'OPEX' };
  }
  // Default — internal engineering/analysis/management effort
  return { category: 'labor', unit: 'hour', costClass: 'CAPEX' };
}

// ────────────────────────────────────────────────────────────────────────────
// Business-case segment classifier — aligns each CBS line to the BC financial
// model: Implementation (CAPEX to deliver) / Operations (OPEX to run) /
// Maintenance (OPEX to keep alive). Subtotals per segment must reconcile to
// businessCase.financialOverview.implementationCost / operationsCost /
// maintenanceCost.
// ────────────────────────────────────────────────────────────────────────────
export function inferCbsSegment(task: WbsTaskData, costClass: 'CAPEX' | 'OPEX'): NonNullable<CbsLineItem['segment']> {
  const text = [task.title, task.taskName, task.description].filter(Boolean).join(' ').toLowerCase();
  const has = (re: RegExp) => re.test(text);
  // Maintenance keywords: patch/update/warranty/O&M/bug fix/support contract
  if (has(/\b(maintenance|warranty|patch|update|bug[- ]?fix|hotfix|o&m|support contract|service level|sla|break[- ]?fix)\b/)) {
    return 'maintenance';
  }
  // Operations keywords (run-the-business): hosting, SaaS renewals, PMO, monitoring, BAU
  if (has(/\b(hosting|cloud hosting|saas|subscription|licen[cs]e renewal|annual fee|renewal|monitoring|bau|run[- ]the[- ]business|pmo fee|governance fee|operations fee|operate|run cost|managed service)\b/)) {
    return 'operations';
  }
  // All CAPEX work that is not maintenance/operations is implementation.
  if (costClass === 'CAPEX') return 'implementation';
  // OPEX without explicit tagging defaults to operations (recurring).
  return 'operations';
}

// ────────────────────────────────────────────────────────────────────────────
// BUSINESS-CASE ADAPTERS — single source of truth for reading BC financials.
//
// The real financial-engine schema (`computedFinancialModel`, `detailedCosts`,
// `tcoBreakdown`, `financialAssumptions`, `cashFlows`, `stagedCapitalPlan`) is
// the canonical shape. Older shapes (`financialOverview`, `budgetEstimates`,
// `annualCostPlan`) are retained as fallbacks for legacy records only.
// ────────────────────────────────────────────────────────────────────────────

// Map a BC detailedCost category to a CBS segment.
// `isRecurring=true` with year1..year5 spend is the strongest operations signal —
// it means the line is a run-cost stream, not a one-time implementation outlay,
// regardless of how the author labelled the category.
export function bcCategoryToSegment(cat?: string, sub?: string, isRecurring?: boolean): NonNullable<CbsLineItem['segment']> {
  const c = (cat ?? '').toLowerCase();
  const s = (sub ?? '').toLowerCase();
  if (c === 'maintenance' || /maintenance|warranty|patch|sla/.test(s)) return 'maintenance';
  if (isRecurring) return 'operations';
  if (c === 'operational' || c === 'operations' || c === 'opex' || /operation|support|bau|\brun\b/.test(s)) return 'operations';
  if (c === 'implementation' || c === 'capex' || c === 'capital') return 'implementation';
  return 'other';
}
export function bcSubcategoryToCbsKind(sub?: string): { category: CbsLineItem['category']; unit: CbsLineItem['unit']; costClass: 'CAPEX' | 'OPEX' } {
  const s = (sub ?? '').toLowerCase();
  if (/software|licen[cs]e|subscription|saas/.test(s)) return { category: 'material', unit: 'licence', costClass: 'CAPEX' };
  if (/infra|hardware|cloud|hosting/.test(s)) return { category: 'material', unit: 'unit', costClass: 'CAPEX' };
  if (/integration|development|implement/.test(s)) return { category: 'subcontractor', unit: 'lot', costClass: 'CAPEX' };
  if (/pm|governance|pmo/.test(s)) return { category: 'labor', unit: 'hour', costClass: 'CAPEX' };
  if (/training|change|enable|adoption/.test(s)) return { category: 'subcontractor', unit: 'lot', costClass: 'CAPEX' };
  if (/contingency|reserve/.test(s)) return { category: 'overhead', unit: 'lot', costClass: 'CAPEX' };
  if (/operations|support|bau|run/.test(s)) return { category: 'overhead', unit: 'month', costClass: 'OPEX' };
  return { category: 'subcontractor', unit: 'lot', costClass: 'CAPEX' };
}

// Anchor lines from business-case financial model. Primary source:
// `detailedCosts[]` from the computed financial engine (7 real line items with
// subcategory + yearX phasing). Fallback: the legacy `financialOverview`
// envelope shape (only 3 synthetic anchors).
export function seedBusinessCaseAnchors(bc: BusinessCaseData | null | undefined): CbsLineItem[] {
  if (!bc) return [];
  const detailed = Array.isArray(bc.detailedCosts) ? bc.detailedCosts! : [];

  // PRIMARY: real detailedCosts line items from the financial engine.
  if (detailed.length > 0) {
    return detailed
      .map((dc, idx): CbsLineItem | null => {
        const y0 = num(dc.year0);
        const y1to5 = num(dc.year1) + num(dc.year2) + num(dc.year3) + num(dc.year4) + num(dc.year5);
        const total = y0 + y1to5;
        if (total <= 0) return null;
        const isRecurring = Boolean(dc.isRecurring) || (y0 === 0 && y1to5 > 0);
        const segment = bcCategoryToSegment(dc.category, dc.subcategory, isRecurring);
        const kind = bcSubcategoryToCbsKind(dc.subcategory);
        // For recurring lines, encode as (quantity = years with spend) × (unitRate = average annual cost)
        // so quantity × unitRate reconciles to the BC's 5-year operations total exactly — even when
        // the financial engine applies inflation / escalation year-over-year.
        const activeYears = [dc.year1, dc.year2, dc.year3, dc.year4, dc.year5].filter((v) => num(v) > 0).length;
        const quantity = isRecurring ? Math.max(1, activeYears) : 1;
        const unitRate = isRecurring ? Math.round(y1to5 / quantity) : Math.round(total);
        // Capture the full Y0–Y5 profile verbatim so the drill-down can render
        // the exact escalation curve the business case committee approved.
        const yearBreakdown: CbsLineItem['yearBreakdown'] = [
          { year: 0, amount: Math.round(num(dc.year0)), label: 'Initial' },
          { year: 1, amount: Math.round(num(dc.year1)), label: 'Year 1' },
          { year: 2, amount: Math.round(num(dc.year2)), label: 'Year 2' },
          { year: 3, amount: Math.round(num(dc.year3)), label: 'Year 3' },
          { year: 4, amount: Math.round(num(dc.year4)), label: 'Year 4' },
          { year: 5, amount: Math.round(num(dc.year5)), label: 'Year 5' },
        ].filter((y) => y.amount > 0);
        return {
          id: uid(),
          wbsCode: `BC.${String(idx + 1).padStart(2, '0')}`,
          description: dc.name || dc.description || `BC line ${idx + 1}`,
          category: kind.category,
          quantity: Math.max(1, Math.round(quantity)),
          unit: isRecurring ? 'month' : kind.unit,
          unitRate: unitRate,
          markupPct: 0,
          contingencyPct: 0,
          costClass: isRecurring ? 'OPEX' : kind.costClass,
          segment,
          source: 'business-case',
          yearBreakdown,
          contracts: [],
        };
      })
      .filter((x): x is CbsLineItem => x !== null);
  }

  // FALLBACK: tcoBreakdown envelopes (no detailedCosts).
  const tco = bc.tcoBreakdown;
  const fo = bc.financialOverview ?? bc.budgetEstimates;
  const impl = num(tco?.implementation ?? fo?.implementationCost);
  const ops = num(tco?.operations ?? fo?.operationsCost);
  const mnt = num(tco?.maintenance ?? fo?.maintenanceCost);
  const anchors: CbsLineItem[] = [];
  if (impl > 0) anchors.push({ id: uid(), wbsCode: 'BC.IMPL', description: 'Implementation envelope (business case)', category: 'subcontractor', quantity: 1, unit: 'lot', unitRate: Math.round(impl), markupPct: 0, contingencyPct: 0, costClass: 'CAPEX', segment: 'implementation', source: 'business-case' });
  if (ops > 0) anchors.push({ id: uid(), wbsCode: 'BC.OPS', description: 'Operations envelope (business case)', category: 'overhead', quantity: 1, unit: 'lot', unitRate: Math.round(ops), markupPct: 0, contingencyPct: 0, costClass: 'OPEX', segment: 'operations', source: 'business-case' });
  if (mnt > 0) anchors.push({ id: uid(), wbsCode: 'BC.MNT', description: 'Maintenance envelope (business case)', category: 'material', quantity: 1, unit: 'lot', unitRate: Math.round(mnt), markupPct: 0, contingencyPct: 0, costClass: 'OPEX', segment: 'maintenance', source: 'business-case' });
  return anchors;
}

// Business-case segment totals — reconciled against the BC financial model.
// Cascade: tcoBreakdown → sum of detailedCosts by category → legacy
// financialOverview/budgetEstimates fields.
export interface BusinessCaseSegmentTotals {
  implementation: number;
  operations: number;
  maintenance: number;
  total: number;
  present: boolean;
}
export function resolveBusinessCaseSegments(bc: BusinessCaseData | null | undefined): BusinessCaseSegmentTotals {
  if (!bc) return { implementation: 0, operations: 0, maintenance: 0, total: 0, present: false };

  // 1. Canonical tcoBreakdown from the financial engine.
  const tco = bc.tcoBreakdown;
  if (tco && (num(tco.implementation) + num(tco.operations) + num(tco.maintenance) > 0)) {
    const implementation = num(tco.implementation);
    const operations = num(tco.operations);
    const maintenance = num(tco.maintenance);
    const total = implementation + operations + maintenance;
    return { implementation, operations, maintenance, total, present: true };
  }

  // 2. Sum detailedCosts by category (5-year totals).
  const detailed = Array.isArray(bc.detailedCosts) ? bc.detailedCosts! : [];
  if (detailed.length > 0) {
    let implementation = 0, operations = 0, maintenance = 0;
    for (const dc of detailed) {
      const total = num(dc.year0) + num(dc.year1) + num(dc.year2) + num(dc.year3) + num(dc.year4) + num(dc.year5);
      if (total <= 0) continue;
      const seg = bcCategoryToSegment(dc.category, dc.subcategory);
      if (seg === 'implementation') implementation += total;
      else if (seg === 'operations') operations += total;
      else if (seg === 'maintenance') maintenance += total;
    }
    const total = implementation + operations + maintenance;
    if (total > 0) return { implementation, operations, maintenance, total, present: true };
  }

  // 3. Legacy envelopes.
  const fo = bc.financialOverview ?? bc.budgetEstimates;
  const implementation = num(fo?.implementationCost);
  const operations = num(fo?.operationsCost);
  const maintenance = num(fo?.maintenanceCost);
  const total = implementation + operations + maintenance;
  return { implementation, operations, maintenance, total, present: total > 0 };
}

// Business-case financial vitals — surfaces prominently on the Overview so PMs
// see the committee-level story (ROI, NPV, payback, peak funding, pilot gate).
export interface BusinessCaseVitals {
  present: boolean;
  totalCost: number;
  totalBenefit: number;
  roiPct: number | null;
  npv: number | null;
  irrPct: number | null;
  paybackMonths: number | null;
  discountRatePct: number | null;
  peakFundingAED: number | null;
  peakFundingYear: number | null;
  pilotGateStatus: 'PASS' | 'FAIL' | null;
  decisionLabel: string | null;
  fundingBlocked: boolean;
  contingencyPct: number | null;     // 0-1
  maintenancePct: number | null;     // 0-1
}
export function resolveBusinessCaseVitals(bc: BusinessCaseData | null | undefined): BusinessCaseVitals {
  const empty: BusinessCaseVitals = {
    present: false, totalCost: 0, totalBenefit: 0, roiPct: null, npv: null, irrPct: null,
    paybackMonths: null, discountRatePct: null, peakFundingAED: null, peakFundingYear: null,
    pilotGateStatus: null, decisionLabel: null, fundingBlocked: false,
    contingencyPct: null, maintenancePct: null,
  };
  if (!bc) return empty;
  const m = bc.computedFinancialModel?.metrics;
  const cfr = bc.computedFinancialModel?.cumulativeFundingRequirement;
  const ks = bc.computedFinancialModel?.killSwitchMetrics;
  const fa = bc.financialAssumptions;
  const totalCost = num(m?.totalCosts) || num(bc.totalCostEstimate as number | string | undefined) || num(bc.totalCost);
  const totalBenefit = num(m?.totalBenefits) || num(bc.totalBenefitEstimate as number | string | undefined) || num(bc.totalBenefit);
  const roi = m?.roi != null ? num(m.roi) : num(bc.roiPercentage as number | string | undefined) || (num(bc.roi) || null);
  const npv = m?.npv != null ? num(m.npv) : num(bc.npvValue as number | string | undefined) || (num(bc.npv) || null);
  const pb = m?.paybackMonths ?? (num(bc.paybackMonths as number | string | undefined) || null);
  const drUnit = num(fa?.discountRate);
  const discountRatePct = drUnit > 0 ? (drUnit < 1 ? drUnit * 100 : drUnit) : null;
  const present = totalCost > 0 || !!m;
  const gate = (ks?.pilotGateStatus ?? '').toUpperCase();
  return {
    present,
    totalCost,
    totalBenefit,
    roiPct: roi == null ? null : Number(roi),
    npv: npv == null ? null : Number(npv),
    irrPct: m?.irr != null ? Number(m.irr) : null,
    paybackMonths: pb == null ? null : Number(pb),
    discountRatePct,
    peakFundingAED: num(cfr?.peakFundingAED) || null,
    peakFundingYear: cfr?.peakFundingYear != null ? Number(cfr.peakFundingYear) : null,
    pilotGateStatus: gate === 'PASS' || gate === 'FAIL' ? (gate as 'PASS' | 'FAIL') : null,
    decisionLabel: bc.computedFinancialModel?.decision?.label ?? null,
    fundingBlocked: Boolean(bc.computedFinancialModel?.fundingBlock?.blocked),
    contingencyPct: fa?.contingencyPercent != null ? Number(fa.contingencyPercent) : null,
    maintenancePct: fa?.maintenancePercent != null ? Number(fa.maintenancePercent) : null,
  };
}

// Year-indexed BC cash profile — Y0 (CAPEX) through Y5 (OPEX ramp) plus
// cumulative funding requirement. Canonical source:
// `computedFinancialModel.cashFlows` (emitted by the financial engine). This is
// what the Cashflow view overlays against the CBS phasing.
export interface BusinessCaseCashProfileRow {
  year: number;
  label: string;
  costs: number;
  benefits: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
}
export interface BusinessCaseCashProfile {
  present: boolean;
  rows: BusinessCaseCashProfileRow[];
  totalCosts: number;
  totalBenefits: number;
  peakFundingAED: number;
  peakFundingYear: number | null;
}
export function resolveBusinessCaseCashProfile(bc: BusinessCaseData | null | undefined): BusinessCaseCashProfile {
  const empty: BusinessCaseCashProfile = { present: false, rows: [], totalCosts: 0, totalBenefits: 0, peakFundingAED: 0, peakFundingYear: null };
  if (!bc) return empty;
  const cfs = bc.computedFinancialModel?.cashFlows;
  if (Array.isArray(cfs) && cfs.length > 0) {
    const rows: BusinessCaseCashProfileRow[] = cfs.map((cf) => ({
      year: Number(cf.year ?? 0),
      label: cf.label ?? (Number(cf.year ?? 0) === 0 ? 'Initial' : `Year ${cf.year}`),
      costs: num(cf.costs),
      benefits: num(cf.benefits),
      netCashFlow: num(cf.netCashFlow),
      cumulativeCashFlow: num(cf.cumulativeCashFlow),
    }));
    const totalCosts = rows.reduce((s, r) => s + r.costs, 0);
    const totalBenefits = rows.reduce((s, r) => s + r.benefits, 0);
    const cfr = bc.computedFinancialModel?.cumulativeFundingRequirement;
    return {
      present: true,
      rows,
      totalCosts,
      totalBenefits,
      peakFundingAED: num(cfr?.peakFundingAED) || Math.max(0, ...rows.map((r) => -r.cumulativeCashFlow)),
      peakFundingYear: cfr?.peakFundingYear != null ? Number(cfr.peakFundingYear) : null,
    };
  }
  return empty;
}

export function seedCbsFromTasks(tasks: WbsTaskData[], bacHint = 0): CbsLineItem[] {
  // Bottom-up CBS: seed from leaf work packages only. Summary tasks (phase/summary) are
  // roll-up containers. Deliverables/milestones that have children are roll-up nodes — their
  // payment amount is derived at runtime from the CBS branch under their wbsCode. Seeding a
  // CBS line on a roll-up node would double-count the same cost against its children.
  const codes = tasks.map((t) => (t.wbsCode ?? '').trim()).filter(Boolean);
  // "Descendant" = another wbsCode that sits below this one in the hierarchy. Supports
  // dotted hierarchies where phase headers end in `.0` (e.g. 1.0 → 1.1.x / 1.2) as well as
  // conventional trees (2.1 → 2.1.1). We strip a trailing `.0` from the parent so 1.0
  // correctly parents 1.1, 1.2, 1.3 etc.
  const hasDescendant = (code: string): boolean => {
    if (!code) return false;
    const root = code.endsWith('.0') ? code.slice(0, -2) : code;
    const prefix = `${root}.`;
    return codes.some((c) => c !== code && c.startsWith(prefix));
  };

  // taskType at runtime may be 'summary' even when the TS union narrows it out; treat both
  // phase and summary (and unknown) roll-up types as non-eligible.
  const isSummaryLike = (t: WbsTaskData): boolean => {
    const tt = t.taskType as string | undefined;
    return tt === 'phase' || tt === 'summary';
  };

  const eligible = tasks.filter((t) => {
    if (isSummaryLike(t)) return false;
    const code = (t.wbsCode ?? '').trim();
    // Skip any node that has descendants — it's a roll-up, not a work package.
    if (hasDescendant(code)) return false;
    // Milestones are gates — only seed a CBS line if the user has explicitly priced them
    // (e.g. a fixed-fee acceptance payment). Otherwise they rely on roll-up or stay at zero.
    if ((t.taskType === 'milestone' || t.isMilestone) && num(t.plannedCost) <= 0) return false;
    return true;
  });
  if (eligible.length === 0) return [];

  // Primary basis for allocation — prefer plannedCost, fall back to estimatedHours, else equal split.
  const totalPlanned = eligible.reduce((s, t) => s + num(t.plannedCost), 0);
  const totalHours = eligible.reduce((s, t) => s + num(t.estimatedHours), 0);
  const useHoursForAllocation = totalPlanned <= 0 && totalHours > 0 && bacHint > 0;
  const useEqualAllocation = totalPlanned <= 0 && totalHours <= 0 && bacHint > 0;

  return eligible.map((t) => {
    const hours = num(t.estimatedHours);
    const isMilestone = t.taskType === 'milestone' || t.isMilestone;
    const isDeliverable = t.taskType === 'deliverable';

    let allocatedPlanned = num(t.plannedCost);
    if (allocatedPlanned <= 0 && useHoursForAllocation) {
      allocatedPlanned = (hours / totalHours) * bacHint;
    } else if (allocatedPlanned <= 0 && useEqualAllocation) {
      allocatedPlanned = bacHint / eligible.length;
    }

    // Start from inferred category, then refine for milestones/deliverables that typically carry fixed cost.
    let kind = inferCbsKind(t);
    if ((isMilestone || isDeliverable) && kind.category === 'labor' && hours <= 0) {
      kind = { category: 'subcontractor', unit: 'lot', costClass: kind.costClass };
    }

    // Quantity logic per category + unit so unit rates stay human-readable.
    let quantity: number;
    if (kind.unit === 'hour') {
      quantity = hours > 0 ? hours : 40;
    } else if (kind.unit === 'day') {
      quantity = hours > 0 ? Math.max(1, Math.round(hours / 8)) : 5;
    } else if (kind.unit === 'month') {
      const dur = num(t.duration);
      quantity = dur > 0 ? Math.max(1, Math.round(dur / 21)) : 1;
    } else {
      // licence / unit / lot / trip
      quantity = 1;
    }

    const unitRate = allocatedPlanned > 0 && quantity > 0 ? allocatedPlanned / quantity : 0;

    return {
      id: uid(),
      wbsCode: t.wbsCode || t.taskCode || t.id.slice(0, 8),
      description: t.title || t.taskName || 'Work package',
      category: kind.category,
      segment: inferCbsSegment(t, kind.costClass),
      source: 'wbs',
      quantity,
      unit: kind.unit,
      unitRate: Math.round(unitRate * 100) / 100,
      markupPct: 0,
      contingencyPct: 0,
      costClass: kind.costClass,
      committed: 0,
      actual: num(t.actualCost),
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Approved budget (BAC) resolution — deterministic, traceable, future-proof
// ────────────────────────────────────────────────────────────────────────────

export type BacSource =
  | 'project.approvedBudget'
  | 'project.totalBudget'
  | 'businessCase.budgetEstimates.totalCost'
  | 'businessCase.financialOverview.totalCost'
  | 'businessCase.totalCostEstimate'
  | 'businessCase.totalCost'
  | 'businessCase.annualCostPlan'
  | 'businessCase.costBuildUp'
  | 'cbs.derived'
  | 'none';

export interface BacResolution {
  amount: number;
  source: BacSource;
  label: string;
  breakdown?: Array<{ label: string; value: number }>;
  isGovernanceApproved: boolean;
}

export function sumAnnualPlan(bc: BusinessCaseData | null | undefined): { total: number; rows: Array<{ label: string; value: number }> } {
  const rows = Array.isArray(bc?.annualCostPlan) ? bc!.annualCostPlan! : [];
  const detailed = rows
    .map((r) => ({
      label: `FY${r.fiscalYear ?? r.yearIndex ?? '—'}`,
      value: num(r.budgetTarget ?? (num(r.capexTarget) + num(r.opexTarget))),
    }))
    .filter((r) => r.value > 0);
  const total = detailed.reduce((s, r) => s + r.value, 0);
  return { total, rows: detailed };
}

export function sumCostBuildUp(bc: BusinessCaseData | null | undefined): { total: number; rows: Array<{ label: string; value: number }> } {
  // Prefer canonical tcoBreakdown; fall back to legacy envelopes.
  const tco = bc?.tcoBreakdown;
  const fo = bc?.financialOverview;
  const be = bc?.budgetEstimates;
  const impl = num(tco?.implementation) || num(fo?.implementationCost ?? be?.implementationCost);
  const ops = num(tco?.operations) || num(fo?.operationsCost ?? be?.operationsCost);
  const mnt = num(tco?.maintenance) || num(fo?.maintenanceCost ?? be?.maintenanceCost);
  const rows = [
    { label: 'Implementation', value: impl },
    { label: 'Operations', value: ops },
    { label: 'Maintenance', value: mnt },
  ].filter((r) => r.value > 0);
  return { total: rows.reduce((s, r) => s + r.value, 0), rows };
}

export function resolveApprovedBudget(
  project: ProjectData,
  businessCase: BusinessCaseData | null | undefined,
  cbsBaseline = 0,
): BacResolution {
  // 1. Governance-approved envelope on the project record.
  const projectApproved = num(project.approvedBudget);
  if (projectApproved > 0) {
    return {
      amount: projectApproved,
      source: 'project.approvedBudget',
      label: 'Approved budget (project record)',
      isGovernanceApproved: true,
    };
  }

  // 2. Total budget set on the project.
  const projectTotal = num(project.totalBudget);
  if (projectTotal > 0) {
    return {
      amount: projectTotal,
      source: 'project.totalBudget',
      label: 'Project total budget',
      isGovernanceApproved: true,
    };
  }

  // 3. Canonical business-case total — emitted by the financial engine.
  const bcTotalEstimate = num(businessCase?.totalCostEstimate as number | string | undefined);
  if (bcTotalEstimate > 0) {
    return {
      amount: bcTotalEstimate,
      source: 'businessCase.totalCostEstimate',
      label: 'Business case total cost estimate',
      isGovernanceApproved: false,
    };
  }

  // 4. Legacy structured envelopes (budgetEstimates / financialOverview totalCost).
  const beTotal = num(businessCase?.budgetEstimates?.totalCost);
  if (beTotal > 0) {
    return {
      amount: beTotal,
      source: 'businessCase.budgetEstimates.totalCost',
      label: 'Business case budget estimates',
      isGovernanceApproved: false,
    };
  }
  const foTotal = num(businessCase?.financialOverview?.totalCost);
  if (foTotal > 0) {
    return {
      amount: foTotal,
      source: 'businessCase.financialOverview.totalCost',
      label: 'Business case financial overview',
      isGovernanceApproved: false,
    };
  }
  const bcTotal = num(businessCase?.totalCost);
  if (bcTotal > 0) {
    return {
      amount: bcTotal,
      source: 'businessCase.totalCost',
      label: 'Business case total cost',
      isGovernanceApproved: false,
    };
  }

  // 5. Sum of annual cost plan rows — multi-year BAC.
  const annual = sumAnnualPlan(businessCase);
  if (annual.total > 0) {
    return {
      amount: annual.total,
      source: 'businessCase.annualCostPlan',
      label: 'Annual cost plan (summed)',
      breakdown: annual.rows,
      isGovernanceApproved: false,
    };
  }

  // 6. Build-up from implementation + operations + maintenance.
  const buildUp = sumCostBuildUp(businessCase);
  if (buildUp.total > 0) {
    return {
      amount: buildUp.total,
      source: 'businessCase.costBuildUp',
      label: 'Implementation + Operations + Maintenance',
      breakdown: buildUp.rows,
      isGovernanceApproved: false,
    };
  }

  // 7. Last resort — derive from the CBS itself (bottom-up).
  if (cbsBaseline > 0) {
    return {
      amount: cbsBaseline,
      source: 'cbs.derived',
      label: 'Bottom-up from CBS',
      isGovernanceApproved: false,
    };
  }

  return {
    amount: 0,
    source: 'none',
    label: 'No budget signal',
    isGovernanceApproved: false,
  };
}

// Scale every CBS line so the extended baseline exactly equals the target BAC.
// Future-proof: preserves relative weights, rounds unit rates to 2 dp.
export function allocateCbsToBac(lines: CbsLineItem[], targetBac: number): CbsLineItem[] {
  if (!Array.isArray(lines) || lines.length === 0 || targetBac <= 0) return lines;
  const currentTotal = lines.reduce((s, l) => s + lineExtended(l).withContingency, 0);
  if (currentTotal <= 0) {
    const even = targetBac / lines.length;
    return lines.map((l) => ({ ...l, quantity: 1, unit: l.unit || 'lot', unitRate: Math.round(even * 100) / 100 }));
  }
  const factor = targetBac / currentTotal;
  return lines.map((l) => {
    const newRate = l.unitRate * factor;
    return { ...l, unitRate: Math.round(newRate * 100) / 100 };
  });
}

export function buildInitialPlan(
  project: ProjectData,
  businessCase: BusinessCaseData | null | undefined,
  tasks: WbsTaskData[],
): CostPlanState {
  const stored = (project.metadata as Record<string, unknown> | undefined)?.costPlan as
    | Partial<CostPlanState>
    | undefined;
  if (stored && typeof stored === 'object' && Array.isArray(stored.cbs)) {
    return {
      version: stored.version ?? 1,
      baselineLockedAt: stored.baselineLockedAt ?? null,
      baselineLockedBy: stored.baselineLockedBy ?? null,
      rateCard: Array.isArray(stored.rateCard) && stored.rateCard.length > 0 ? stored.rateCard : defaultRateCard(),
      cbs: stored.cbs,
      commitments: Array.isArray(stored.commitments) ? stored.commitments : [],
      changes: Array.isArray(stored.changes) ? stored.changes : [],
      reserves: { ...defaultReserves(businessCase), ...(stored.reserves || {}) },
      notes: stored.notes,
    };
  }
  // Fresh plan — the business case is the committee-approved envelope and must
  // drive the baseline whenever it carries detailedCosts. WBS schedule variance
  // is surfaced later through PV / EV, not by letting WBS inflate the baseline.
  //   Priority 1: BC detailedCosts[]  \u2192  full CBS per segment (matches tcoBreakdown).
  //   Priority 2: BC tcoBreakdown     \u2192  three envelope anchors + WBS inside impl.
  //   Priority 3: No BC data          \u2192  pure WBS seed.
  const bcAnchors = seedBusinessCaseAnchors(businessCase);
  const hasDetailedBc = Array.isArray(businessCase?.detailedCosts) && (businessCase?.detailedCosts?.length ?? 0) > 0;
  const bacHint = resolveApprovedBudget(project, businessCase, 0).amount;

  let cbs: CbsLineItem[];
  if (hasDetailedBc) {
    // BC is authoritative \u2014 CBS mirrors the approved envelope exactly. WBS tasks
    // reconcile against this baseline through the EVM layer (PV / EV / AC).
    cbs = bcAnchors;
  } else if (bcAnchors.length > 0) {
    // Only aggregate envelopes available \u2014 anchor each segment from BC, let WBS
    // fill in implementation detail inside that envelope.
    const segmentsCovered = new Set(bcAnchors.map((a) => a.segment ?? 'implementation'));
    const wbsSeed = seedCbsFromTasks(tasks, bacHint).filter((l) => !segmentsCovered.has(l.segment ?? 'implementation'));
    cbs = [...bcAnchors, ...wbsSeed];
  } else {
    // No BC \u2014 fall back to WBS-only seed.
    cbs = seedCbsFromTasks(tasks, bacHint);
  }

  return {
    version: 1,
    baselineLockedAt: null,
    baselineLockedBy: null,
    rateCard: defaultRateCard(),
    cbs,
    commitments: [],
    changes: [],
    reserves: defaultReserves(businessCase),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Derived calculations — BAC, AC, EV, PV, CPI, SPI, EAC, VAC
// ────────────────────────────────────────────────────────────────────────────

export function lineExtended(line: CbsLineItem) {
  const base = line.quantity * line.unitRate;
  const withMarkup = base * (1 + line.markupPct / 100);
  const withContingency = withMarkup * (1 + line.contingencyPct / 100);
  return { base, withMarkup, withContingency };
}

export interface EvmMetrics {
  bac: number;
  ac: number;
  ev: number;
  pv: number;
  cv: number;
  sv: number;
  cpi: number;
  spi: number;
  eac: number;
  etc: number;
  vac: number;
  committed: number;
}

export function computeEvm(plan: CostPlanState, tasks: WbsTaskData[], approvedBudget: number): EvmMetrics {
  const now = Date.now();

  let baselineFromCbs = 0;
  let committed = 0;
  let acFromCbs = 0;
  for (const line of plan.cbs) {
    const { withContingency } = lineExtended(line);
    baselineFromCbs += withContingency;
    committed += num(line.committed);
    acFromCbs += num(line.actual);
  }
  committed += plan.commitments.reduce((s, c) => s + num(c.awardedValue), 0);
  const acFromTasks = tasks.reduce((s, t) => s + num(t.actualCost), 0);
  const ac = Math.max(acFromCbs, acFromTasks);

  const bac = approvedBudget > 0 ? approvedBudget : baselineFromCbs;

  // PV & EV derived from WBS schedule + progress (primary) falling back to CBS if no schedule
  let pv = 0;
  let ev = 0;
  if (tasks.length > 0) {
    for (const t of tasks) {
      const planned = num(t.plannedCost);
      if (planned <= 0) continue;
      const start = t.plannedStartDate ? new Date(t.plannedStartDate).getTime() : 0;
      const end = t.plannedEndDate ? new Date(t.plannedEndDate).getTime() : 0;
      let timeFraction = 1;
      if (start && end && end > start) {
        timeFraction = Math.max(0, Math.min(1, (now - start) / (end - start)));
      }
      pv += planned * timeFraction;
      const pct = num(t.percentComplete ?? t.progress) / 100;
      ev += planned * Math.max(0, Math.min(1, pct));
    }
  }
  if (pv <= 0) pv = baselineFromCbs * 0.5; // halfway assumption when no schedule signal
  if (ev <= 0) ev = ac > 0 ? ac * 0.9 : baselineFromCbs * 0.25;

  const cv = ev - ac;
  const sv = ev - pv;
  const cpi = ac > 0 ? ev / ac : 1;
  const spi = pv > 0 ? ev / pv : 1;
  const eac = cpi > 0 ? bac / cpi : bac;
  const etc = Math.max(0, eac - ac);
  const vac = bac - eac;

  return { bac, ac, ev, pv, cv, sv, cpi, spi, eac, etc, vac, committed };
}

// Monthly phasing honors delivery-based payment rights:
//   • taskType ∈ {milestone, deliverable} (or isMilestone) → 100% of planned cost booked at plannedEndDate month (acceptance date)
//   • all other tasks → straight-line accrual across plannedStartDate → plannedEndDate (effort profile)
//   • commitments → (awardedValue × (1 − retentionPct)) spread across span + retention holdback booked at endDate
//   • fallback → synthesized beta S-curve across project dates when no schedule signal exists
export function computePhasing(tasks: WbsTaskData[], plan: CostPlanState, project?: ProjectData, approvedBudget = 0) {
  const months = new Map<string, { planned: number; actual: number }>();

  const bookLump = (date: Date, planned: number, actual: number) => {
    if (Number.isNaN(date.getTime())) return;
    const k = monthKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
    const row = months.get(k) || { planned: 0, actual: 0 };
    row.planned += planned;
    row.actual += actual;
    months.set(k, row);
  };

  const spreadSpan = (start: Date, end: Date, planned: number, actual: number) => {
    const span: string[] = [];
    const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const stop = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    while (cur <= stop) {
      span.push(monthKey(cur));
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    if (span.length === 0) return;
    const perMonthPlanned = planned / span.length;
    const perMonthActual = actual / span.length;
    span.forEach((k) => {
      const row = months.get(k) || { planned: 0, actual: 0 };
      row.planned += perMonthPlanned;
      row.actual += perMonthActual;
      months.set(k, row);
    });
  };

  for (const t of tasks) {
    const planned = num(t.plannedCost);
    const actual = num(t.actualCost);
    if (planned <= 0 && actual <= 0) continue;
    const start = t.plannedStartDate ? new Date(t.plannedStartDate) : null;
    const end = t.plannedEndDate ? new Date(t.plannedEndDate) : null;
    if (!end || Number.isNaN(end.getTime())) continue;

    const isDeliveryBased = t.taskType === 'milestone' || t.taskType === 'deliverable' || t.isMilestone === true;
    if (isDeliveryBased) {
      // Payment right crystallizes on acceptance date — book the full amount at plannedEndDate month.
      bookLump(end, planned, actual);
      continue;
    }

    if (!start || Number.isNaN(start.getTime())) continue;
    spreadSpan(start, end, planned, actual);
  }

  // Tier-2 fallback: commitment drawdown (only if tasks yielded nothing)
  if (months.size === 0) {
    for (const c of plan.commitments) {
      const start = c.startDate ? new Date(c.startDate) : null;
      const end = c.endDate ? new Date(c.endDate) : null;
      if (!end || Number.isNaN(end.getTime())) continue;
      const retentionPct = Math.max(0, Math.min(100, num(c.retentionPct))) / 100;
      const retention = c.awardedValue * retentionPct;
      const progressPayable = c.awardedValue - retention;
      if (start && !Number.isNaN(start.getTime()) && end > start) {
        spreadSpan(start, end, progressPayable, 0);
      } else {
        bookLump(end, progressPayable, 0);
      }
      // Retention holdback is released at contract close-out → book at endDate month
      if (retention > 0) bookLump(end, retention, 0);
    }
  }

  // Fallback — synthesise from CBS + project dates when WBS has no schedule signal.
  // This guarantees Cashflow & EVM render for any project with a baseline or approved budget.
  if (months.size === 0) {
    const cbsTotal = plan.cbs.reduce((s, l) => s + lineExtended(l).withContingency, 0);
    const poolTotal = cbsTotal > 0 ? cbsTotal : approvedBudget;
    if (poolTotal > 0) {
      const startRaw = project?.plannedStartDate ?? project?.startDate ?? null;
      const endRaw = project?.plannedEndDate ?? project?.endDate ?? null;
      const start = startRaw ? new Date(startRaw) : new Date();
      const end = endRaw ? new Date(endRaw) : new Date(start.getTime() + 12 * 30 * 24 * 60 * 60 * 1000);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
        const span: string[] = [];
        const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
        const stop = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
        while (cur <= stop && span.length < 60) {
          span.push(monthKey(cur));
          cur.setUTCMonth(cur.getUTCMonth() + 1);
        }
        if (span.length > 0) {
          // Beta-like S-curve distribution (slow start, peak at 60%, taper)
          const weights = span.map((_, i) => {
            const x = (i + 0.5) / span.length;
            return Math.pow(x, 1.6) * Math.pow(1 - x, 0.9) + 0.15;
          });
          const weightSum = weights.reduce((s, w) => s + w, 0);
          const totalActual = plan.cbs.reduce((s, l) => s + num(l.actual), 0)
            + tasks.reduce((s, t) => s + num(t.actualCost), 0);
          const now = Date.now();
          let _cumulativeWeight = 0;
          span.forEach((k, i) => {
            const w = weights[i] ?? 0;
            const planned = (w / weightSum) * poolTotal;
            _cumulativeWeight += w;
            // Actuals — apportion total actuals up to current month proportionally across elapsed span
            const monthEpoch = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 15)).getTime();
            const actual = monthEpoch <= now ? (w / weightSum) * totalActual : 0;
            months.set(k, { planned, actual });
          });
        }
      }
    }
  }

  const sorted = Array.from(months.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
  let cumulativePlanned = 0;
  let cumulativeActual = 0;
  return sorted.map(([key, row]) => {
    cumulativePlanned += row.planned;
    cumulativeActual += row.actual;
    return {
      month: key,
      label: prettyMonth(key),
      planned: Math.round(row.planned),
      actual: Math.round(row.actual),
      cumulativePlanned: Math.round(cumulativePlanned),
      cumulativeActual: Math.round(cumulativeActual),
    };
  });
}
