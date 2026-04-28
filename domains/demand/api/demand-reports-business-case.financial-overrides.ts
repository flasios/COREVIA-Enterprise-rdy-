import {
  buildCashFlows as sharedBuildCashFlows,
  calculateIRR as sharedCalculateIRR,
  calculateNPV as sharedCalculateNPV,
  calculatePaybackMonths as sharedCalculatePaybackMonths,
  calculateROI as sharedCalculateROI,
} from '@shared/financialCalculations';

function safeString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
}

export interface FinancialAssumptions {
  discountRate?: number;
  adoptionRate?: number;
  maintenancePercent?: number;
  contingencyPercent?: number;
  [key: string]: unknown;
}

export interface DomainParameters {
  [key: string]: unknown;
}

function getOverrideYearsForSnapshot(mode: unknown, kind: 'cost' | 'benefit'): number[] {
  if (String(mode) === 'pilot') {
    return kind === 'cost' ? [0, 1] : [1];
  }
  return kind === 'cost' ? [0, 1, 2, 3, 4, 5] : [1, 2, 3, 4, 5];
}

function isYearOverrideRecord(value: unknown): value is Record<string, number> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function applyFinancialOverridesToComputedModel(
  computedModel: Record<string, unknown>,
  costOverrides: Record<string, unknown>,
  benefitOverrides: Record<string, unknown>,
): void {
  const hasCostOverrides = Object.keys(costOverrides).length > 0;
  const hasBenefitOverrides = Object.keys(benefitOverrides).length > 0;
  if (!hasCostOverrides && !hasBenefitOverrides) return;

  const costs = computedModel.costs as Array<Record<string, unknown>> | undefined;
  const benefits = computedModel.benefits as Array<Record<string, unknown>> | undefined;

  const scaleYears = (item: Record<string, unknown>, factor: number, years: number[]) => {
    const next = { ...item };
    for (const year of years) {
      const key = `year${year}`;
      next[key] = (Number(item[key]) || 0) * factor;
    }
    return next;
  };

  const applyOverride = (item: Record<string, unknown>, override: unknown, years: number[]) => {
    if (typeof override === 'number' && Number.isFinite(override)) {
      const originalTotal = years.reduce((sum, year) => sum + (Number(item[`year${year}`]) || 0), 0);
      if (originalTotal <= 0) return item;
      const factor = override / originalTotal;
      if (Math.abs(factor - 1) < 1e-6) return item;
      return scaleYears(item, factor, years);
    }

    if (isYearOverrideRecord(override)) {
      const next = { ...item };
      for (const year of years) {
        const key = `year${year}`;
        const yearValue = override[key];
        if (typeof yearValue === 'number' && Number.isFinite(yearValue)) {
          next[key] = yearValue;
        }
      }
      return next;
    }

    return item;
  };

  const recomputeFinancialViewSnapshot = (snapshot: Record<string, unknown> | undefined) => {
    if (!snapshot) return snapshot;

    const costYears = getOverrideYearsForSnapshot(snapshot.mode, 'cost');
    const benefitYears = getOverrideYearsForSnapshot(snapshot.mode, 'benefit');

    const viewCosts = Array.isArray(snapshot.costs)
      ? (snapshot.costs as Array<Record<string, unknown>>).map((item) => applyOverride(item, costOverrides[String(item.id || '')], costYears))
      : [];
    const viewBenefits = Array.isArray(snapshot.benefits)
      ? (snapshot.benefits as Array<Record<string, unknown>>).map((item) => applyOverride(item, benefitOverrides[String(item.id || '')], benefitYears))
      : [];

    const discountDecimal = typeof (computedModel.inputs as Record<string, unknown> | undefined)?.discountRate === 'number'
      ? ((computedModel.inputs as Record<string, unknown>).discountRate as number)
      : 0.08;
    const viewCashFlows = sharedBuildCashFlows(
      viewCosts as unknown as Parameters<typeof sharedBuildCashFlows>[0],
      viewBenefits as unknown as Parameters<typeof sharedBuildCashFlows>[1],
      discountDecimal,
    );
    const viewNpv = sharedCalculateNPV(viewCashFlows);
    const viewIrr = sharedCalculateIRR(viewCashFlows);
    const viewPaybackMonths = sharedCalculatePaybackMonths(viewCashFlows);
    const viewTotalCosts = viewCashFlows.reduce((sum, flow) => sum + flow.costs, 0);
    const viewTotalBenefits = viewCashFlows.reduce((sum, flow) => sum + flow.benefits, 0);
    const viewRoi = sharedCalculateROI(viewTotalBenefits, viewTotalCosts);
    const upfrontInvestment = Number(snapshot.upfrontInvestment) || 0;
    const amortizedCapex = upfrontInvestment / Math.max(String(snapshot.mode) === 'pilot' ? 1 : 5, 1);
    const yearly = viewCashFlows.map((flow, index) => {
      const revenue = flow.benefits;
      const costsForYear = flow.costs;
      const previousRevenue = index > 0 ? viewCashFlows[index - 1]!.benefits : 0;
      const discountFactor = Math.pow(1 + discountDecimal, -flow.year);
      return {
        year: flow.year,
        yearLabel: flow.year === 0 ? 'Initial Investment' : `Year ${flow.year}`,
        revenue,
        costs: costsForYear,
        netCashFlow: flow.netCashFlow,
        cumulativeCashFlow: flow.cumulativeCashFlow,
        operatingMargin: flow.year > 0 && revenue > 0 ? ((revenue - (costsForYear + amortizedCapex)) / revenue) * 100 : 0,
        yoyGrowth: previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : 0,
        cumulativeDiscountedCashFlow: undefined,
        discountFactor,
      };
    });
    const operatingYears = yearly.filter((entry) => entry.year > 0 && entry.revenue > 0);
    const summary = {
      totalRevenue: yearly.reduce((sum, entry) => sum + entry.revenue, 0),
      totalCosts: yearly.reduce((sum, entry) => sum + entry.costs, 0),
      avgOperatingMargin: operatingYears.length > 0 ? operatingYears.reduce((sum, entry) => sum + entry.operatingMargin, 0) / operatingYears.length : 0,
      avgEfficiencyRatio: viewTotalCosts > 0 ? viewTotalBenefits / viewTotalCosts : 0,
      cagr: operatingYears.length > 1 && operatingYears[0]!.revenue > 0 && operatingYears[operatingYears.length - 1]!.revenue > 0
        ? (Math.pow(operatingYears[operatingYears.length - 1]!.revenue / operatingYears[0]!.revenue, 1 / Math.max(operatingYears.length - 1, 1)) - 1) * 100
        : 0,
      totalPresentValue: yearly.reduce((sum, entry) => sum + (entry.netCashFlow * entry.discountFactor), 0),
    };

    return {
      ...snapshot,
      costs: viewCosts,
      benefits: viewBenefits,
      lifecycleCost: summary.totalCosts,
      lifecycleBenefit: summary.totalRevenue,
      operatingRunCost: Math.max(0, summary.totalCosts - upfrontInvestment),
      netLifecycleValue: summary.totalRevenue - summary.totalCosts,
      metrics: {
        ...(snapshot.metrics as Record<string, unknown> | undefined ?? {}),
        npv: viewNpv,
        roi: viewRoi,
        irr: viewIrr,
        paybackMonths: viewPaybackMonths,
        paybackYears: viewPaybackMonths / 12,
      },
      scenarios: Array.isArray(snapshot.scenarios)
        ? (snapshot.scenarios as Array<Record<string, unknown>>).map((scenario) => scenario.name === 'base' ? { ...scenario, npv: viewNpv } : scenario)
        : snapshot.scenarios,
      fiveYearProjections: {
        yearly,
        summary,
      },
      verdict: {
        ...(snapshot.verdict as Record<string, unknown> | undefined ?? {}),
        verdict: String(snapshot.mode) === 'pilot'
          ? (viewNpv >= 0 && viewRoi >= 0 ? 'CONDITIONAL' : 'DO_NOT_INVEST')
          : (viewRoi > 50 && viewNpv > 0 && viewPaybackMonths < 36 ? 'INVEST' : viewRoi > 0 && viewNpv >= 0 ? 'CONDITIONAL' : 'DEFER'),
      },
    };
  };

  if (Array.isArray(costs) && hasCostOverrides) {
    computedModel.costs = costs.map((cost) => {
      const id = String(cost.id || '');
      return applyOverride(cost, costOverrides[id], id.includes('stage-pilot-') ? [0, 1] : [0, 1, 2, 3, 4, 5]);
    });
  }

  if (Array.isArray(benefits) && hasBenefitOverrides) {
    computedModel.benefits = benefits.map((benefit) => {
      const id = String(benefit.id || '');
      return applyOverride(benefit, benefitOverrides[id], id.includes('stage-pilot-') ? [1] : [1, 2, 3, 4, 5]);
    });
  }

  const inputsAny = computedModel.inputs as Record<string, unknown> | undefined;
  const discountDecimal = typeof inputsAny?.discountRate === 'number' ? (inputsAny.discountRate as number) : 0.08;
  const adjustedCostsTyped = computedModel.costs as Parameters<typeof sharedBuildCashFlows>[0];
  const adjustedBenefitsTyped = computedModel.benefits as Parameters<typeof sharedBuildCashFlows>[1];
  const newCashFlows = sharedBuildCashFlows(adjustedCostsTyped, adjustedBenefitsTyped, discountDecimal);
  const newNpv = sharedCalculateNPV(newCashFlows);
  const newIrr = sharedCalculateIRR(newCashFlows);
  const newPayback = sharedCalculatePaybackMonths(newCashFlows);
  const totalCostsAdj = newCashFlows.reduce((sum, cf) => sum + cf.costs, 0);
  const totalBenefitsAdj = newCashFlows.reduce((sum, cf) => sum + cf.benefits, 0);
  const newRoi = sharedCalculateROI(totalBenefitsAdj, totalCostsAdj);

  computedModel.cashFlows = newCashFlows;
  computedModel.metrics = {
    ...(computedModel.metrics as Record<string, unknown> | undefined ?? {}),
    npv: newNpv,
    irr: newIrr,
    paybackMonths: newPayback,
    roi: newRoi,
    totalCosts: totalCostsAdj,
    totalBenefits: totalBenefitsAdj,
  };

  if (computedModel.financialViews && typeof computedModel.financialViews === 'object') {
    const financialViews = computedModel.financialViews as Record<string, unknown>;
    computedModel.financialViews = {
      ...financialViews,
      pilot: recomputeFinancialViewSnapshot(financialViews.pilot as Record<string, unknown> | undefined),
      full: recomputeFinancialViewSnapshot(financialViews.full as Record<string, unknown> | undefined),
    };
  }
}

export function sanitizeDroneStageCostOverrides(
  computedModel: Record<string, unknown>,
  costOverrides: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!costOverrides || Object.keys(costOverrides).length === 0) {
    return costOverrides;
  }

  if (safeString(computedModel.archetype, '') !== 'Drone Last Mile Delivery') {
    return costOverrides;
  }

  const financialViews = computedModel.financialViews as Record<string, unknown> | undefined;
  const pilotView = financialViews?.pilot as Record<string, unknown> | undefined;
  const fullView = financialViews?.full as Record<string, unknown> | undefined;
  const baselineLines = new Map<string, Record<string, unknown>>();

  const collectBaseline = (view: Record<string, unknown> | undefined) => {
    const lines = Array.isArray(view?.costs) ? view.costs as Array<Record<string, unknown>> : [];
    for (const line of lines) {
      const id = safeString(line.id, '');
      if (id) {
        baselineLines.set(id, line);
      }
    }
  };

  collectBaseline(pilotView);
  collectBaseline(fullView);

  const sanitized = { ...costOverrides };
  for (const [id, override] of Object.entries(costOverrides)) {
    if (!/^stage-(pilot|full)-(variable|fixed)$/.test(id)) {
      continue;
    }

    const baseline = baselineLines.get(id);
    const overrideRecord = override && typeof override === 'object'
      ? override as Record<string, unknown>
      : null;
    if (!baseline || !overrideRecord) {
      continue;
    }

    // Preserve explicit user-entered stage overrides even when they materially
    // reduce the generated baseline. Users can legitimately lower fixed or
    // variable operating costs during scenario editing, and deleting those
    // overrides on read makes saved edits appear to be lost.
    if (typeof overrideRecord.year1 === 'number' && !Number.isFinite(overrideRecord.year1)) {
      delete sanitized[id];
    }
  }

  return sanitized;
}

function normalizePersistedDiscountRate(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return value > 1 ? value / 100 : value;
}

export function extractPersistedFinancialAssumptionsFromInputs(inputs: Record<string, unknown> | undefined): FinancialAssumptions | undefined {
  if (!inputs) {
    return undefined;
  }

  const discountRate = normalizePersistedDiscountRate(inputs.discountRate);
  const adoptionRate = typeof inputs.adoptionRate === 'number' && Number.isFinite(inputs.adoptionRate)
    ? inputs.adoptionRate
    : undefined;
  const maintenancePercent = typeof inputs.maintenancePercent === 'number' && Number.isFinite(inputs.maintenancePercent)
    ? inputs.maintenancePercent
    : undefined;
  const contingencyPercent = typeof inputs.contingencyPercent === 'number' && Number.isFinite(inputs.contingencyPercent)
    ? inputs.contingencyPercent
    : undefined;

  if (
    discountRate === undefined
    && adoptionRate === undefined
    && maintenancePercent === undefined
    && contingencyPercent === undefined
  ) {
    return undefined;
  }

  return {
    ...(discountRate === undefined ? {} : { discountRate }),
    ...(adoptionRate === undefined ? {} : { adoptionRate }),
    ...(maintenancePercent === undefined ? {} : { maintenancePercent }),
    ...(contingencyPercent === undefined ? {} : { contingencyPercent }),
  };
}

export function extractPersistedDomainParametersFromInputs(inputs: Record<string, unknown> | undefined): DomainParameters | undefined {
  const domainParameters = inputs?.domainParameters;
  if (!domainParameters || typeof domainParameters !== 'object' || Array.isArray(domainParameters)) {
    return undefined;
  }

  return domainParameters as DomainParameters;
}
