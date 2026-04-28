import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { DomainAssumption } from '@shared/constants/archetypes';
import { getArchetypeConfig, detectArchetype } from '@shared/constants/archetypes';
import type {
  FinancialAssumption,
  CostLineItem,
  BenefitLineItem,
  RawCostItem,
  RawBenefitItem,
  RawAssumption,
  BusinessCaseData,
  InvestmentData,
  ArchetypeData,
  ExtractedFinancialModel,
  GovernmentValueFactor,
  DroneStageEconomics,
  KillSwitchThreshold,
  KillSwitchMetrics,
  FinancialViewSnapshotData,
} from '../types/financialTypes';
import {
  buildCashFlows,
  calculateScenarios,
  calculateSensitivityAnalysis,
  calculateDoNothingScenario,
  calculateKeyMetrics,
  generateDecisionRecommendation,
} from '../utils/financialCalculations';
import { formatCurrency, formatCompactNumber } from '../utils/financialFormatters';
import {
  applyLineItemOverride,
  getBenefitYearKeysForMode,
  getCostYearKeysForMode,
  getItemYearTotal,
  readNumber,
  type FinancialLineItemOverride,
  type FinancialViewMode,
} from '../utils/financialOverrides';
import {
  buildCashFlows as sharedBuildCashFlows,
  calculateNPV as sharedCalculateNPV,
  calculateIRR as sharedCalculateIRR,
  calculatePaybackMonths as sharedCalculatePaybackMonths,
  calculateROI as sharedCalculateROI,
} from '@shared/financialCalculations';

export type CostCategory = CostLineItem['category'];
export type BenefitCategory = BenefitLineItem['category'];
export type BenefitRealization = BenefitLineItem['realization'];
export type Confidence = BenefitLineItem['confidence'];
export type AssumptionCategory = FinancialAssumption['category'];
// Financial edit data structure for unified save

export function parsePercentText(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function findKillSwitchThreshold(metrics: KillSwitchMetrics | undefined, needle: string): KillSwitchThreshold | undefined {
  const normalizedNeedle = needle.toLowerCase();
  const thresholds = Array.isArray(metrics?.thresholds) ? metrics.thresholds : [];
  return thresholds.find((threshold) => typeof threshold?.metric === 'string' && threshold.metric.toLowerCase().includes(normalizedNeedle));
}

export interface FinancialEditData {
  totalCostEstimate: number;
  financialAssumptions: {
    adoptionRate: number;
    maintenancePercent: number;
    contingencyPercent: number;
    discountRate: number;
  };
  domainParameters: Record<string, number>;
  aiRecommendedBudget: number;
  /** User overrides keyed by line item id — value is either a lifecycle total or explicit yearly values. */
  costOverrides?: Record<string, FinancialLineItemOverride>;
  /** User overrides keyed by line item id — value is either a lifecycle total or explicit yearly values. */
  benefitOverrides?: Record<string, FinancialLineItemOverride>;
  hasChanges: boolean;
}

export interface VerdictConfig {
  bg: string;
  icon: ReactNode;
  label: string;
}

export interface VerdictConfigWithTextColor extends VerdictConfig {
  textColor: string;
}

export interface ArchetypeDisplayData {
  adoptionRate: number;
  maintenancePercent: number;
  contingencyPercent: number;
  discountRate: number;
  source: string;
  domainAssumptions?: DomainAssumption[];
}

export function getArchetypeDisplayData(archetypeName: string): ArchetypeDisplayData {
  const config = getArchetypeConfig(archetypeName);
  return {
    adoptionRate: config.assumptions.adoptionRate,
    maintenancePercent: config.assumptions.maintenancePercent,
    contingencyPercent: config.assumptions.contingencyPercent,
    discountRate: config.assumptions.discountRate,
    source: config.benchmarkSources.adoptionRate,
    domainAssumptions: config.assumptions.domainAssumptions
  };
}

export function normalizeRateDecimal(value: unknown): number | undefined {
  const numeric = readNumber(value);
  if (numeric === undefined) return undefined;
  return numeric > 1 ? numeric / 100 : numeric;
}

export function normalizeRecordNumbers(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, entry]) => {
    const numeric = readNumber(entry);
    if (numeric !== undefined) {
      acc[key] = numeric;
    }
    return acc;
  }, {});
}

export function normalizeGovernmentFactorRationale(text: string): string {
  return text.replaceAll(/return on investment/gi, 'benefit-cost coverage');
}

export function normalizeGovernmentFactors(
  factors: GovernmentValueFactor[] | undefined,
  metrics: { roi5Year?: number; npv?: number } | undefined,
  financialView: FinancialViewMode,
): GovernmentValueFactor[] {
  if (!Array.isArray(factors) || factors.length === 0) {
    return [];
  }

  const roi = Number(metrics?.roi5Year ?? 0);
  const npv = Number(metrics?.npv ?? 0);
  const stageLabel = financialView === 'pilot' ? 'pilot' : 'full commercial';

  return factors.map((factor) => {
    const name = factor.name.trim().toLowerCase();

    if (name === 'financial sustainability') {
      if (roi < 0 || npv < 0) {
        return {
          ...factor,
          score: 30,
          rationale: `Current ${stageLabel} economics are below the investment threshold with ${Math.round(roi)}% ROI and ${formatCurrency(npv, 'AED', true)} NPV. This stage should be treated as a bounded validation case until the commercial gate is met.`,
        };
      }

      if (roi < 20) {
        return {
          ...factor,
          score: 55,
          rationale: `Current ${stageLabel} economics are positive but still below the target commercial return threshold. Expansion should remain conditional on stronger unit economics and sustained demand evidence.`,
        };
      }
    }

    if (name === 'operational efficiency') {
      if (roi < 0) {
        return {
          ...factor,
          score: 45,
          rationale: `Current ${stageLabel} operating economics do not yet cover the full cost base. Delivery throughput, partner utilization, and cost per drop need to improve before scale funding is released.`,
        };
      }

      if (roi < 20) {
        return {
          ...factor,
          score: 60,
          rationale: `Current ${stageLabel} economics show early operating viability, but margin headroom is still limited and should be monitored against the scale gate.`,
        };
      }
    }

    return {
      ...factor,
      rationale: normalizeGovernmentFactorRationale(factor.rationale),
    };
  });
}

export function formatFinancialLabelValue(value: number): string {
  if (value >= 1_000_000_000) return `AED ${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return millions % 1 === 0 ? `AED ${millions.toFixed(0)}M` : `AED ${millions.toFixed(1)}M`;
  }
  if (value >= 1_000) return `AED ${(value / 1_000).toFixed(0)}K`;
  return `AED ${Math.round(value).toLocaleString()}`;
}


export type AssumptionCredibility = 'Derived Baseline' | 'Benchmark-based' | 'Hypothesis';

export interface FinancialViewSnapshot {
  mode: FinancialViewMode;
  title: string;
  upfrontInvestment: number;
  lifecycleCost: number;
  lifecycleBenefit: number;
  operatingRunCost: number;
  netLifecycleValue: number;
  lifecycleNarrative: string;
  costs: CostLineItem[];
  benefits: BenefitLineItem[];
  metrics: { npv: number; roi5Year: number; irr: number; paybackMonths: number; paybackYears: number };
  scenarios: { name: string; label: string; npv: number; probability: number }[];
  yearly: { year: number; yearLabel: string; revenue: number; costs: number; netCashFlow: number; cumulativeCashFlow: number; operatingMargin: number; efficiencyRatio: number; yoyGrowth: number; discountFactor: number; presentValue: number }[];
  summary: { totalRevenue: number; totalCosts: number; avgOperatingMargin: number; avgEfficiencyRatio: number; cagr: number; totalPresentValue: number };
  verdict: VerdictConfig;
  verdictValue: string;
}

export interface StageSpecificAssumption {
  name: string;
  value: number | string;
  unit: string;
  description: string;
  credibility?: AssumptionCredibility;
}

export const assumptionCredibilityClasses: Record<AssumptionCredibility, string> = {
  'Derived Baseline': 'border-slate-300/80 bg-slate-100/80 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
  'Benchmark-based': 'border-sky-300/80 bg-sky-100/80 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300',
  Hypothesis: 'border-amber-300/80 bg-amber-100/80 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
};

export function getFinancialViewLabel(mode: FinancialViewMode): string {
  return mode === 'pilot' ? 'Pilot' : 'Full Commercial';
}

export function formatStageSpecificAssumptionValue(value: number | string, unit: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return String(value);
  }
  if (unit === '%') {
    return `${Math.round(value * 100)}%`;
  }
  if (unit === 'AED') {
    return formatCompactNumber(value);
  }
  if (unit === 'AED / delivery') {
    return formatCurrency(value, 'AED', false);
  }
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }
  return value.toFixed(1);
}

export function buildStageSpecificAssumptions(mode: FinancialViewMode, stage: DroneStageEconomics, configuredThroughputPerDrone?: number): StageSpecificAssumption[] {
  const assumptions: StageSpecificAssumption[] = [
    {
      name: 'Stage Horizon',
      value: stage.horizon,
      unit: '',
      description: 'Operating horizon currently represented in this financial view',
      credibility: 'Derived Baseline',
    },
    {
      name: 'Fleet Size',
      value: stage.fleetSize,
      unit: 'drones',
      description: 'Active drone fleet assumed for this stage',
      credibility: 'Derived Baseline',
    },
    {
      name: 'Effective Throughput / Drone / Day',
      value: stage.dailyDeliveriesPerDrone,
      unit: 'per day',
      description: mode === 'pilot'
        ? 'Base-case operating throughput hypothesis for the selected stage after utilization and adoption effects'
        : 'Modeled operating throughput per drone for the selected scale stage after utilization and adoption effects',
      credibility: mode === 'pilot' ? 'Hypothesis' : 'Benchmark-based',
    },
    {
      name: 'Annual Deliveries',
      value: stage.annualDeliveries,
      unit: 'deliveries',
      description: 'Annual delivery volume in the selected stage model',
      credibility: 'Derived Baseline',
    },
    {
      name: mode === 'pilot' ? 'Recognized Revenue / Delivery' : 'Recognized Revenue / Delivery',
      value: stage.recognizedRevenuePerDelivery,
      unit: 'AED / delivery',
      description: 'Canonical modeled revenue baseline per completed delivery after realization effects and integration revenue allocation',
      credibility: 'Derived Baseline',
    },
    {
      name: 'Fully Loaded Cost / Delivery',
      value: stage.effectiveCostPerDelivery,
      unit: 'AED / delivery',
      description: 'Canonical modeled cost baseline per delivery after stage-specific fixed and variable costs',
      credibility: 'Derived Baseline',
    },
    {
      name: 'Annual Fixed Ops Cost',
      value: stage.annualFixedCost,
      unit: 'AED',
      description: 'Fixed control, staffing, compliance, insurance, and operating support cost for the active stage',
      credibility: 'Benchmark-based',
    },
    {
      name: 'Contracted Volume Share',
      value: stage.contractedVolumeShare,
      unit: '%',
      description: 'Share of volume assumed to come from contracted or committed demand; treat as assumed unless backed by secured commitments',
      credibility: 'Hypothesis',
    },
    {
      name: 'Automation Rate',
      value: stage.automationRate,
      unit: '%',
      description: 'Share of the operating model assumed to be automated in this stage',
      credibility: 'Benchmark-based',
    },
  ];

  if (typeof configuredThroughputPerDrone === 'number' && Number.isFinite(configuredThroughputPerDrone)) {
    assumptions.splice(2, 0, {
      name: 'Configured Throughput / Drone / Day',
      value: configuredThroughputPerDrone,
      unit: 'per day',
      description: 'Raw driver input configured for this stage before demand, utilization, and realism adjustments',
      credibility: 'Hypothesis',
    });
  }

  return assumptions;
}

export function getStageVerdictConfig(npv: number, roi: number, paybackMonths: number, mode: FinancialViewMode, upfrontInvestment = 0): VerdictConfig {
  if (mode === 'pilot') {
    const boundedPilotLoss = npv >= -Math.max(upfrontInvestment * 2.5, 7_500_000) && roi >= -85;
    if (npv >= 0 && roi >= 0) {
      return { bg: 'bg-amber-500', icon: <AlertTriangle className="h-6 w-6" />, label: 'APPROVE PILOT' };
    }
    if (boundedPilotLoss) {
      return { bg: 'bg-amber-500', icon: <AlertTriangle className="h-6 w-6" />, label: 'APPROVE PILOT' };
    }
    return { bg: 'bg-red-600', icon: <XCircle className="h-6 w-6" />, label: 'DO NOT PILOT' };
  }

  if (roi > 50 && npv > 0 && paybackMonths < 36) {
    return { bg: 'bg-emerald-600', icon: <CheckCircle className="h-6 w-6" />, label: 'INVEST' };
  }
  if (roi > 0 && npv >= 0) {
    return { bg: 'bg-amber-500', icon: <AlertTriangle className="h-6 w-6" />, label: 'CONDITIONAL' };
  }
  return { bg: 'bg-red-600', icon: <XCircle className="h-6 w-6" />, label: 'DEFER' };
}

export function buildStageFinancialSnapshot({
  mode,
  stage,
  upfrontInvestment,
  discountRate,
  variableCostDrivers,
}: {
  mode: FinancialViewMode;
  stage: DroneStageEconomics;
  upfrontInvestment: number;
  discountRate: number;
  variableCostDrivers?: { name: string; value: number }[];
}): FinancialViewSnapshot {
  const activeYears = mode === 'pilot' ? 1 : 5;
  const directRevenue = Math.max(0, stage.annualRevenue - stage.annualIntegrationRevenue - (stage.platformRevenuePerDelivery * stage.annualDeliveries * stage.revenueRealizationFactor));
  const platformRevenue = stage.annualRevenue - directRevenue;
  const annualVariableCost = stage.variableCostPerDelivery * stage.annualDeliveries;
  const annualFixedCost = stage.annualFixedCost;
  const variableCostDriverTotal = variableCostDrivers?.reduce((sum, item) => sum + item.value, 0) ?? 0;
  const variableCostBreakdown = variableCostDrivers && variableCostDriverTotal > 0
    ? variableCostDrivers.map((item) => ({
        name: item.name,
        perDelivery: item.value,
        annualValue: annualVariableCost * (item.value / variableCostDriverTotal),
      }))
    : undefined;

  const costs: CostLineItem[] = [
    {
      id: `stage-${mode}-capex`, category: 'implementation', subcategory: 'Capital', name: mode === 'pilot' ? 'Pilot Mobilization CapEx' : 'Commercial Network CapEx',
      description: mode === 'pilot' ? 'Initial pilot mobilization and corridor readiness spend' : 'Initial full-commercial deployment capital',
      year0: upfrontInvestment, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false,
    },
    {
      id: `stage-${mode}-variable`, category: 'operational', subcategory: 'Operations', name: 'Variable Operating Cost',
      description: 'Flight, handling, partner, and delivery-variable cost base',
      breakdown: variableCostBreakdown,
      year0: 0,
      year1: annualVariableCost,
      year2: activeYears >= 2 ? annualVariableCost : 0,
      year3: activeYears >= 3 ? annualVariableCost : 0,
      year4: activeYears >= 4 ? annualVariableCost : 0,
      year5: activeYears >= 5 ? annualVariableCost : 0,
      isRecurring: true,
    },
    {
      id: `stage-${mode}-fixed`, category: 'operational', subcategory: 'Platform', name: 'Fixed Operating Cost',
      description: 'Fixed staffing, control-center, compliance, insurance, and support costs',
      year0: 0,
      year1: annualFixedCost,
      year2: activeYears >= 2 ? annualFixedCost : 0,
      year3: activeYears >= 3 ? annualFixedCost : 0,
      year4: activeYears >= 4 ? annualFixedCost : 0,
      year5: activeYears >= 5 ? annualFixedCost : 0,
      isRecurring: true,
    },
  ];

  const benefits: BenefitLineItem[] = [
    {
      id: `stage-${mode}-delivery-revenue`, category: 'revenue', name: 'Delivery Revenue',
      description: 'Core delivery revenue generated from weighted average fare', calculation: 'Fare x annual deliveries',
      year1: directRevenue,
      year2: activeYears >= 2 ? directRevenue : 0,
      year3: activeYears >= 3 ? directRevenue : 0,
      year4: activeYears >= 4 ? directRevenue : 0,
      year5: activeYears >= 5 ? directRevenue : 0,
      realization: 'immediate', confidence: 'medium',
    },
    {
      id: `stage-${mode}-platform-revenue`, category: 'revenue', name: 'Platform Revenue',
      description: 'Platform/service monetization per delivery', calculation: 'Platform revenue per delivery x annual deliveries',
      year1: platformRevenue,
      year2: activeYears >= 2 ? platformRevenue : 0,
      year3: activeYears >= 3 ? platformRevenue : 0,
      year4: activeYears >= 4 ? platformRevenue : 0,
      year5: activeYears >= 5 ? platformRevenue : 0,
      realization: 'immediate', confidence: 'medium',
    },
  ];

  const buildScenarioNpv = (benefitMultiplier: number, costMultiplier: number) => {
    const scenarioCosts = costs.map((cost) => ({
      ...cost,
      year0: cost.year0,
      year1: cost.year1 * costMultiplier,
      year2: cost.year2 * costMultiplier,
      year3: cost.year3 * costMultiplier,
      year4: cost.year4 * costMultiplier,
      year5: cost.year5 * costMultiplier,
    }));
    const scenarioBenefits = benefits.map((benefit) => ({
      ...benefit,
      year1: benefit.year1 * benefitMultiplier,
      year2: benefit.year2 * benefitMultiplier,
      year3: benefit.year3 * benefitMultiplier,
      year4: benefit.year4 * benefitMultiplier,
      year5: benefit.year5 * benefitMultiplier,
    }));
    return sharedCalculateNPV(sharedBuildCashFlows(scenarioCosts, scenarioBenefits, discountRate));
  };

  const cashFlows = sharedBuildCashFlows(costs, benefits, discountRate);
  const totalCosts = cashFlows.reduce((sum, flow) => sum + flow.costs, 0);
  const totalBenefits = cashFlows.reduce((sum, flow) => sum + flow.benefits, 0);
  const npv = sharedCalculateNPV(cashFlows);
  const irr = sharedCalculateIRR(cashFlows);
  const paybackMonths = sharedCalculatePaybackMonths(cashFlows);
  const roi5Year = sharedCalculateROI(totalBenefits, totalCosts);

  const yearly = cashFlows.map((flow, index) => {
    const revenue = flow.benefits;
    const costsForYear = flow.costs;
    const operatingMargin = flow.year > 0 && revenue > 0 ? ((revenue - costsForYear) / revenue) * 100 : 0;
    const previousRevenue = index > 0 ? cashFlows[index - 1]!.benefits : 0;
    const discountFactor = Math.pow(1 + discountRate, -flow.year);
    return {
      year: flow.year,
      yearLabel: flow.year === 0 ? 'Initial Investment' : `Year ${flow.year}`,
      revenue,
      costs: costsForYear,
      netCashFlow: flow.netCashFlow,
      cumulativeCashFlow: flow.cumulativeCashFlow,
      operatingMargin,
      efficiencyRatio: costsForYear > 0 ? revenue / costsForYear : 0,
      yoyGrowth: previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : 0,
      discountFactor,
      presentValue: flow.netCashFlow * discountFactor,
    };
  });

  const operatingYears = yearly.filter((entry) => entry.year > 0 && entry.revenue > 0);
  const summary = {
    totalRevenue: yearly.reduce((sum, entry) => sum + entry.revenue, 0),
    totalCosts: yearly.reduce((sum, entry) => sum + entry.costs, 0),
    avgOperatingMargin: operatingYears.length > 0
      ? operatingYears.reduce((sum, entry) => sum + entry.operatingMargin, 0) / operatingYears.length
      : 0,
    avgEfficiencyRatio: totalCosts > 0 ? totalBenefits / totalCosts : 0,
    cagr: operatingYears.length > 1 && operatingYears[0]!.revenue > 0 && operatingYears[operatingYears.length - 1]!.revenue > 0
      ? (Math.pow(operatingYears[operatingYears.length - 1]!.revenue / operatingYears[0]!.revenue, 1 / Math.max(operatingYears.length - 1, 1)) - 1) * 100
      : 0,
    totalPresentValue: yearly.reduce((sum, entry) => sum + entry.presentValue, 0),
  };

  const scenarios = [
    { name: 'best', label: 'Upside', npv: buildScenarioNpv(1.12, 0.95), probability: 0.2 },
    { name: 'base', label: 'Base Case', npv, probability: 0.6 },
    { name: 'downside', label: 'Downside', npv: buildScenarioNpv(0.85, 1.08), probability: 0.2 },
  ];

  const lifecycleCost = summary.totalCosts;
  const lifecycleBenefit = summary.totalRevenue;

  return {
    mode,
    title: mode === 'pilot' ? 'Pilot Financial Model' : 'Full Commercial Model',
    upfrontInvestment,
    lifecycleCost,
    lifecycleBenefit,
    operatingRunCost: Math.max(0, lifecycleCost - upfrontInvestment),
    netLifecycleValue: lifecycleBenefit - lifecycleCost,
    lifecycleNarrative: mode === 'pilot'
      ? 'Pilot-only financial model for the validation window before scale funding is released'
      : 'Full commercial operating model across a 5-year deployment horizon',
    costs,
    benefits,
    metrics: { npv, roi5Year, irr, paybackMonths, paybackYears: paybackMonths / 12 },
    scenarios,
    yearly,
    summary,
    verdict: getStageVerdictConfig(npv, roi5Year, paybackMonths, mode, upfrontInvestment),
    verdictValue: mode === 'pilot'
      ? ((npv >= 0 && roi5Year >= 0) || (npv >= -Math.max(upfrontInvestment * 2.5, 7_500_000) && roi5Year >= -85) ? 'CONDITIONAL' : 'DO_NOT_INVEST')
      : (roi5Year > 50 && npv > 0 && paybackMonths < 36
        ? 'INVEST'
        : roi5Year > 0 && npv >= 0
          ? 'CONDITIONAL'
          : 'DEFER'),
  };
}

export function mapStoredFinancialViewSnapshot(snapshot: FinancialViewSnapshotData): FinancialViewSnapshot {
  const normalizedVerdictValue = snapshot.mode === 'pilot'
    ? ((snapshot.metrics.npv >= 0 && snapshot.metrics.roi >= 0) || (snapshot.metrics.npv >= -Math.max(snapshot.upfrontInvestment * 2.5, 7_500_000) && snapshot.metrics.roi >= -85) ? 'CONDITIONAL' : 'DO_NOT_INVEST')
    : (snapshot.metrics.roi > 50 && snapshot.metrics.npv > 0 && snapshot.metrics.paybackMonths < 36
      ? 'INVEST'
      : snapshot.metrics.roi > 0 && snapshot.metrics.npv >= 0
        ? 'CONDITIONAL'
        : 'DEFER');

  return {
    mode: snapshot.mode,
    title: snapshot.title,
    upfrontInvestment: snapshot.upfrontInvestment,
    lifecycleCost: snapshot.lifecycleCost,
    lifecycleBenefit: snapshot.lifecycleBenefit,
    operatingRunCost: snapshot.operatingRunCost,
    netLifecycleValue: snapshot.netLifecycleValue,
    lifecycleNarrative: snapshot.lifecycleNarrative,
    costs: snapshot.costs,
    benefits: snapshot.benefits,
    metrics: {
      npv: snapshot.metrics.npv,
      roi5Year: snapshot.metrics.roi,
      irr: snapshot.metrics.irr,
      paybackMonths: snapshot.metrics.paybackMonths,
      paybackYears: snapshot.metrics.paybackYears,
    },
    scenarios: snapshot.scenarios,
    yearly: snapshot.fiveYearProjections.yearly.map((entry) => ({
      year: entry.year,
      yearLabel: entry.yearLabel,
      revenue: entry.revenue,
      costs: entry.costs,
      netCashFlow: entry.netCashFlow,
      cumulativeCashFlow: entry.cumulativeCashFlow,
      operatingMargin: entry.operatingMargin,
      efficiencyRatio: entry.costs > 0 ? entry.revenue / entry.costs : 0,
      yoyGrowth: entry.yoyGrowth,
      discountFactor: entry.discountFactor,
      presentValue: entry.netCashFlow * entry.discountFactor,
    })),
    summary: snapshot.fiveYearProjections.summary,
    verdict: getStageVerdictConfig(snapshot.metrics.npv, snapshot.metrics.roi, snapshot.metrics.paybackMonths, snapshot.mode, snapshot.upfrontInvestment),
    verdictValue: normalizedVerdictValue,
  };
}

export function relativeDelta(left: number | undefined, right: number | undefined): number {
  const a = Number.isFinite(left) ? Math.abs(left as number) : 0;
  const b = Number.isFinite(right) ? Math.abs(right as number) : 0;
  const baseline = Math.max(a, b, 1);
  return Math.abs((left ?? 0) - (right ?? 0)) / baseline;
}

export function readSnapshotYear(snapshot: FinancialViewSnapshotData | undefined, year: number) {
  return snapshot?.fiveYearProjections?.yearly?.find((entry) => entry.year === year);
}

export function isDroneStageSnapshotStale(
  storedSnapshot: FinancialViewSnapshotData | undefined,
  derivedSnapshot: FinancialViewSnapshotData | undefined,
  discountRateDecimal: number,
): boolean {
  if (!storedSnapshot || !derivedSnapshot) {
    return false;
  }

  const storedYearOne = readSnapshotYear(storedSnapshot, 1);
  const derivedYearOne = readSnapshotYear(derivedSnapshot, 1);
  const expectedDiscountFactor = Math.pow(1 + discountRateDecimal, -1);

  if (storedYearOne && Number.isFinite(storedYearOne.discountFactor) && Math.abs(storedYearOne.discountFactor - expectedDiscountFactor) > 0.02) {
    return true;
  }

  if (!storedYearOne || !derivedYearOne) {
    return false;
  }

  return relativeDelta(storedYearOne.revenue, derivedYearOne.revenue) > 0.2
    || relativeDelta(storedYearOne.costs, derivedYearOne.costs) > 0.2
    || relativeDelta(storedSnapshot.metrics.roi, derivedSnapshot.metrics.roi) > 0.35;
}

export function applyOverridesToFinancialViewSnapshot(
  snapshot: FinancialViewSnapshot,
  costOverrides: Record<string, FinancialLineItemOverride>,
  benefitOverrides: Record<string, FinancialLineItemOverride>,
  discountRate: number,
): FinancialViewSnapshot {
  const costYearKeys = getCostYearKeysForMode(snapshot.mode);
  const benefitYearKeys = getBenefitYearKeysForMode(snapshot.mode);
  const costYears = costYearKeys.map((key) => Number(key.replace('year', '')));
  const benefitYears = benefitYearKeys.map((key) => Number(key.replace('year', '')));

  const scaleYears = (item: Record<string, unknown>, factor: number, years: number[]) => {
    const next = { ...item };
    for (const year of years) {
      const key = `year${year}`;
      next[key] = (Number(item[key]) || 0) * factor;
    }
    return next;
  };

  const adjustedCosts = snapshot.costs.map((cost) => {
    const override = costOverrides[cost.id];
    if (override === undefined) return cost;
    if (typeof override === 'number') {
      const originalTotal = getItemYearTotal(cost as unknown as Record<string, unknown>, costYearKeys);
      if (originalTotal <= 0) return cost;
      const factor = override / originalTotal;
      if (Math.abs(factor - 1) < 1e-6) return cost;
      return scaleYears(cost as unknown as Record<string, unknown>, factor, costYears) as unknown as CostLineItem;
    }
    return applyLineItemOverride(cost as unknown as Record<string, unknown>, override, costYearKeys) as unknown as CostLineItem;
  });

  const adjustedBenefits = snapshot.benefits.map((benefit) => {
    const override = benefitOverrides[benefit.id];
    if (override === undefined) return benefit;
    if (typeof override === 'number') {
      const originalTotal = getItemYearTotal(benefit as unknown as Record<string, unknown>, benefitYearKeys);
      if (originalTotal <= 0) return benefit;
      const factor = override / originalTotal;
      if (Math.abs(factor - 1) < 1e-6) return benefit;
      return scaleYears(benefit as unknown as Record<string, unknown>, factor, benefitYears) as unknown as BenefitLineItem;
    }
    return applyLineItemOverride(benefit as unknown as Record<string, unknown>, override, benefitYearKeys) as unknown as BenefitLineItem;
  });

  const cashFlows = sharedBuildCashFlows(adjustedCosts, adjustedBenefits, discountRate);
  const npv = sharedCalculateNPV(cashFlows);
  const irr = sharedCalculateIRR(cashFlows);
  const paybackMonths = sharedCalculatePaybackMonths(cashFlows);
  const totalCosts = cashFlows.reduce((sum, flow) => sum + flow.costs, 0);
  const totalBenefits = cashFlows.reduce((sum, flow) => sum + flow.benefits, 0);
  const roi5Year = sharedCalculateROI(totalBenefits, totalCosts);

  const yearly = cashFlows.map((flow, index) => {
    const revenue = flow.benefits;
    const costsForYear = flow.costs;
    const previousRevenue = index > 0 ? cashFlows[index - 1]!.benefits : 0;
    const operatingMargin = flow.year > 0 && revenue > 0 ? ((revenue - costsForYear) / revenue) * 100 : 0;
    const discountFactor = Math.pow(1 + discountRate, -flow.year);

    return {
      year: flow.year,
      yearLabel: flow.year === 0 ? 'Initial Investment' : `Year ${flow.year}`,
      revenue,
      costs: costsForYear,
      netCashFlow: flow.netCashFlow,
      cumulativeCashFlow: flow.cumulativeCashFlow,
      operatingMargin,
      efficiencyRatio: costsForYear > 0 ? revenue / costsForYear : 0,
      yoyGrowth: previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : 0,
      discountFactor,
      presentValue: flow.netCashFlow * discountFactor,
    };
  });

  const operatingYears = yearly.filter((entry) => entry.year > 0 && entry.revenue > 0);
  const summary = {
    totalRevenue: yearly.reduce((sum, entry) => sum + entry.revenue, 0),
    totalCosts: yearly.reduce((sum, entry) => sum + entry.costs, 0),
    avgOperatingMargin: operatingYears.length > 0 ? operatingYears.reduce((sum, entry) => sum + entry.operatingMargin, 0) / operatingYears.length : 0,
    avgEfficiencyRatio: totalCosts > 0 ? totalBenefits / totalCosts : 0,
    cagr: operatingYears.length > 1 && operatingYears[0]!.revenue > 0 && operatingYears[operatingYears.length - 1]!.revenue > 0
      ? (Math.pow(operatingYears[operatingYears.length - 1]!.revenue / operatingYears[0]!.revenue, 1 / Math.max(operatingYears.length - 1, 1)) - 1) * 100
      : 0,
    totalPresentValue: yearly.reduce((sum, entry) => sum + entry.presentValue, 0),
  };

  const scenarios = snapshot.scenarios.map((scenario) => (
    scenario.name === 'base' ? { ...scenario, npv } : scenario
  ));

  return {
    ...snapshot,
    costs: adjustedCosts,
    benefits: adjustedBenefits,
    lifecycleCost: totalCosts,
    lifecycleBenefit: totalBenefits,
    operatingRunCost: Math.max(0, totalCosts - snapshot.upfrontInvestment),
    netLifecycleValue: totalBenefits - totalCosts,
    metrics: { npv, roi5Year, irr, paybackMonths, paybackYears: paybackMonths / 12 },
    scenarios,
    yearly,
    summary,
    verdict: getStageVerdictConfig(npv, roi5Year, paybackMonths, snapshot.mode, snapshot.upfrontInvestment),
    verdictValue: snapshot.mode === 'pilot'
      ? ((npv >= 0 && roi5Year >= 0) || (npv >= -Math.max(snapshot.upfrontInvestment * 2.5, 7_500_000) && roi5Year >= -85) ? 'CONDITIONAL' : 'DO_NOT_INVEST')
      : (roi5Year > 50 && npv > 0 && paybackMonths < 36
        ? 'INVEST'
        : roi5Year > 0 && npv >= 0
          ? 'CONDITIONAL'
          : 'DEFER'),
  };
}

export function applyEditInputsToFinancialViewSnapshot({
  snapshot,
  persistedInputs,
  editValues,
  pilotCapitalRatio,
  domainAssumptions,
  ignoreMaintenanceScaling = false,
}: {
  snapshot: FinancialViewSnapshot;
  persistedInputs: {
    totalInvestment: number;
    adoptionRate: number;
    maintenancePercent: number;
    contingencyPercent: number;
    discountRate: number;
    domainParameters: Record<string, number>;
  };
  editValues: {
    initialInvestment: number;
    adoptionRate: number;
    maintenancePercent: number;
    contingencyPercent: number;
    discountRate: number;
    domainParams: Record<string, number>;
  };
  pilotCapitalRatio: number;
  domainAssumptions?: DomainAssumption[];
  ignoreMaintenanceScaling?: boolean;
}): FinancialViewSnapshot {
  const targetDiscountRate = editValues.discountRate / 100;
  const targetUpfrontInvestment = snapshot.mode === 'pilot'
    ? editValues.initialInvestment * pilotCapitalRatio
    : editValues.initialInvestment;
  const baseUpfrontInvestment = snapshot.upfrontInvestment > 0
    ? snapshot.upfrontInvestment
    : (snapshot.mode === 'pilot'
      ? persistedInputs.totalInvestment * pilotCapitalRatio
      : persistedInputs.totalInvestment);

  const currentAdoptionRate = editValues.adoptionRate / 100;
  const currentMaintenancePercent = editValues.maintenancePercent / 100;
  const currentContingencyPercent = editValues.contingencyPercent / 100;

  const investmentRatio = baseUpfrontInvestment > 0 ? targetUpfrontInvestment / baseUpfrontInvestment : 1;
  const adoptionRatio = persistedInputs.adoptionRate > 0 ? currentAdoptionRate / persistedInputs.adoptionRate : 1;
  const maintenanceRatio = ignoreMaintenanceScaling
    ? 1
    : (persistedInputs.maintenancePercent > 0 ? currentMaintenancePercent / persistedInputs.maintenancePercent : 1);
  const contingencyRatio = persistedInputs.contingencyPercent > 0 ? currentContingencyPercent / persistedInputs.contingencyPercent : 1;

  let domainCostMultiplier = 1;
  let domainBenefitMultiplier = 1;

  for (const param of domainAssumptions ?? []) {
    const baseValue = persistedInputs.domainParameters[param.name] ?? readNumber(param.value) ?? 0;
    const currentValue = editValues.domainParams[param.name] ?? baseValue;
    if (!Number.isFinite(baseValue) || baseValue <= 0 || !Number.isFinite(currentValue)) {
      continue;
    }

    const paramRatio = currentValue / baseValue;
    const impact = param.impact || 'both';
    if (impact === 'benefit') {
      domainBenefitMultiplier *= paramRatio;
    } else if (impact === 'cost') {
      domainCostMultiplier *= paramRatio;
    } else {
      domainCostMultiplier *= Math.pow(paramRatio, 0.5);
      domainBenefitMultiplier *= Math.pow(paramRatio, 0.5);
    }
  }

  const targetCostYear0Multiplier = investmentRatio * contingencyRatio * domainCostMultiplier;
  const targetRecurringCostMultiplier = investmentRatio * maintenanceRatio * domainCostMultiplier;
  const targetBenefitMultiplier = adoptionRatio * domainBenefitMultiplier;

  const ratiosChanged = [
    investmentRatio,
    adoptionRatio,
    maintenanceRatio,
    contingencyRatio,
    domainCostMultiplier,
    domainBenefitMultiplier,
  ].some((ratio) => Math.abs(ratio - 1) > 1e-6);

  if (!ratiosChanged && Math.abs(targetDiscountRate - persistedInputs.discountRate) < 1e-6) {
    return snapshot;
  }

  const adjustedCosts = snapshot.costs.map((cost) => ({
    ...cost,
    year0: (cost.year0 ?? 0) * targetCostYear0Multiplier,
    year1: (cost.year1 ?? 0) * targetRecurringCostMultiplier,
    year2: (cost.year2 ?? 0) * targetRecurringCostMultiplier,
    year3: (cost.year3 ?? 0) * targetRecurringCostMultiplier,
    year4: (cost.year4 ?? 0) * targetRecurringCostMultiplier,
    year5: (cost.year5 ?? 0) * targetRecurringCostMultiplier,
  }));

  const adjustedBenefits = snapshot.benefits.map((benefit) => ({
    ...benefit,
    year1: (benefit.year1 ?? 0) * targetBenefitMultiplier,
    year2: (benefit.year2 ?? 0) * targetBenefitMultiplier,
    year3: (benefit.year3 ?? 0) * targetBenefitMultiplier,
    year4: (benefit.year4 ?? 0) * targetBenefitMultiplier,
    year5: (benefit.year5 ?? 0) * targetBenefitMultiplier,
  }));

  const cashFlows = sharedBuildCashFlows(adjustedCosts, adjustedBenefits, targetDiscountRate);
  const npv = sharedCalculateNPV(cashFlows);
  const irr = sharedCalculateIRR(cashFlows);
  const paybackMonths = sharedCalculatePaybackMonths(cashFlows);
  const totalCosts = cashFlows.reduce((sum, flow) => sum + flow.costs, 0);
  const totalBenefits = cashFlows.reduce((sum, flow) => sum + flow.benefits, 0);
  const roi5Year = sharedCalculateROI(totalBenefits, totalCosts);

  const yearly = cashFlows.map((flow, index) => {
    const revenue = flow.benefits;
    const costsForYear = flow.costs;
    const previousRevenue = index > 0 ? cashFlows[index - 1]!.benefits : 0;
    const operatingMargin = flow.year > 0 && revenue > 0 ? ((revenue - costsForYear) / revenue) * 100 : 0;
    const discountFactor = Math.pow(1 + targetDiscountRate, -flow.year);

    return {
      year: flow.year,
      yearLabel: flow.year === 0 ? 'Initial Investment' : `Year ${flow.year}`,
      revenue,
      costs: costsForYear,
      netCashFlow: flow.netCashFlow,
      cumulativeCashFlow: flow.cumulativeCashFlow,
      operatingMargin,
      efficiencyRatio: costsForYear > 0 ? revenue / costsForYear : 0,
      yoyGrowth: previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : 0,
      discountFactor,
      presentValue: flow.netCashFlow * discountFactor,
    };
  });

  const operatingYears = yearly.filter((entry) => entry.year > 0 && entry.revenue > 0);
  const summary = {
    totalRevenue: yearly.reduce((sum, entry) => sum + entry.revenue, 0),
    totalCosts: yearly.reduce((sum, entry) => sum + entry.costs, 0),
    avgOperatingMargin: operatingYears.length > 0 ? operatingYears.reduce((sum, entry) => sum + entry.operatingMargin, 0) / operatingYears.length : 0,
    avgEfficiencyRatio: totalCosts > 0 ? totalBenefits / totalCosts : 0,
    cagr: operatingYears.length > 1 && operatingYears[0]!.revenue > 0 && operatingYears[operatingYears.length - 1]!.revenue > 0
      ? (Math.pow(operatingYears[operatingYears.length - 1]!.revenue / operatingYears[0]!.revenue, 1 / Math.max(operatingYears.length - 1, 1)) - 1) * 100
      : 0,
    totalPresentValue: yearly.reduce((sum, entry) => sum + entry.presentValue, 0),
  };

  const scenarios = snapshot.scenarios.map((scenario) => (
    scenario.name === 'base' ? { ...scenario, npv } : scenario
  ));

  return {
    ...snapshot,
    upfrontInvestment: targetUpfrontInvestment,
    costs: adjustedCosts,
    benefits: adjustedBenefits,
    lifecycleCost: totalCosts,
    lifecycleBenefit: totalBenefits,
    operatingRunCost: Math.max(0, totalCosts - targetUpfrontInvestment),
    netLifecycleValue: totalBenefits - totalCosts,
    metrics: { npv, roi5Year, irr, paybackMonths, paybackYears: paybackMonths / 12 },
    scenarios,
    yearly,
    summary,
    verdict: getStageVerdictConfig(npv, roi5Year, paybackMonths, snapshot.mode, targetUpfrontInvestment),
    verdictValue: snapshot.mode === 'pilot'
      ? ((npv >= 0 && roi5Year >= 0) || (npv >= -Math.max(targetUpfrontInvestment * 2.5, 7_500_000) && roi5Year >= -85) ? 'CONDITIONAL' : 'DO_NOT_INVEST')
      : (roi5Year > 50 && npv > 0 && paybackMonths < 36
        ? 'INVEST'
        : roi5Year > 0 && npv >= 0
          ? 'CONDITIONAL'
          : 'DEFER'),
  };
}

export function getArchetypeCostDrivers(archetype: string, totalInvestment: number): CostLineItem[] {
  if (archetype === 'Autonomous Vehicle Platform') {
    const vehicleFleet = totalInvestment * 0.50;
    const infrastructure = totalInvestment * 0.20;
    const aiSystems = totalInvestment * 0.15;
    const annualOps = totalInvestment * 0.05;
    return [
      { id: 'c1', category: 'implementation', subcategory: 'Fleet', name: 'AV Fleet Acquisition', description: 'Autonomous vehicle fleet purchase', year0: vehicleFleet, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c2', category: 'implementation', subcategory: 'Infrastructure', name: 'Charging & Depot Infrastructure', description: 'Charging stations, maintenance depots', year0: infrastructure, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c3', category: 'implementation', subcategory: 'Technology', name: 'AI/Sensor Systems', description: 'LiDAR, cameras, AI compute units', year0: aiSystems, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c4', category: 'operational', subcategory: 'Operations', name: 'Fleet Operations', description: 'Energy, maintenance, remote monitoring', year0: 0, year1: annualOps, year2: annualOps * 1.05, year3: annualOps * 1.10, year4: annualOps * 1.15, year5: annualOps * 1.20, isRecurring: true },
    ];
  }
  if (archetype === 'Healthcare Digital System') {
    return [
      { id: 'c1', category: 'implementation', subcategory: 'Platform', name: 'EHR/Clinical Platform', description: 'Electronic health records system', year0: totalInvestment * 0.40, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c2', category: 'implementation', subcategory: 'Integration', name: 'Medical Device Integration', description: 'IoT and device connectivity', year0: totalInvestment * 0.25, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c3', category: 'implementation', subcategory: 'Compliance', name: 'Regulatory Compliance', description: 'HIPAA, data security certification', year0: totalInvestment * 0.15, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c4', category: 'operational', subcategory: 'Operations', name: 'Clinical Support', description: 'Annual support and updates', year0: 0, year1: totalInvestment * 0.08, year2: totalInvestment * 0.08, year3: totalInvestment * 0.08, year4: totalInvestment * 0.08, year5: totalInvestment * 0.08, isRecurring: true },
    ];
  }
  return [];
}

export function getArchetypeBenefitDrivers(archetype: string, totalInvestment: number): BenefitLineItem[] {
  if (archetype === 'Autonomous Vehicle Platform') {
    const annualNetMobilityContribution = totalInvestment * 0.12;
    const annualNetLaborSavings = totalInvestment * 0.035;
    return [
      { id: 'b1', category: 'revenue', name: 'Net Mobility Contribution', description: 'Trip contribution after variable distance-based operating costs', calculation: 'Commercial trip contribution net of variable operating cost', year1: annualNetMobilityContribution * 0.3, year2: annualNetMobilityContribution * 0.6, year3: annualNetMobilityContribution * 0.85, year4: annualNetMobilityContribution, year5: annualNetMobilityContribution * 1.05, realization: 'gradual', confidence: 'medium' },
      { id: 'b2', category: 'cost_savings', name: 'Net Labor Productivity Savings', description: 'Labor savings net of remote operations and safety coverage', calculation: 'Fleet productivity savings after retained operating roles', year1: annualNetLaborSavings * 0.3, year2: annualNetLaborSavings * 0.6, year3: annualNetLaborSavings * 0.8, year4: annualNetLaborSavings, year5: annualNetLaborSavings * 1.05, realization: 'gradual', confidence: 'medium' },
      { id: 'b3', category: 'strategic', name: 'Safety, Data, and Mobility Leadership', description: 'Public-value uplift from AV readiness and innovation leadership', calculation: 'Strategic value proxy from safety and mobility positioning', year1: totalInvestment * 0.02, year2: totalInvestment * 0.04, year3: totalInvestment * 0.06, year4: totalInvestment * 0.08, year5: totalInvestment * 0.10, realization: 'delayed', confidence: 'medium' },
    ];
  }
  if (archetype === 'Healthcare Digital System') {
    return [
      { id: 'b1', category: 'productivity', name: 'Clinical Productivity Gains', description: 'Recovered clinician and care-team capacity from reduced documentation and coordination effort', calculation: 'Staff hours × hourly rate', year1: totalInvestment * 0.10, year2: totalInvestment * 0.15, year3: totalInvestment * 0.20, year4: totalInvestment * 0.22, year5: totalInvestment * 0.25, realization: 'gradual', confidence: 'high' },
      { id: 'b2', category: 'strategic', name: 'Patient Outcome and Capacity Value', description: 'Public-value uplift from lower readmissions, faster interventions, and improved clinical throughput', calculation: 'Cost per prevented adverse event', year1: totalInvestment * 0.05, year2: totalInvestment * 0.10, year3: totalInvestment * 0.15, year4: totalInvestment * 0.18, year5: totalInvestment * 0.20, realization: 'delayed', confidence: 'medium' },
      { id: 'b3', category: 'risk_reduction', name: 'Compliance and Patient Safety Risk Reduction', description: 'Audit efficiency, safer clinical controls, and lower regulatory exposure', calculation: 'Avoided fines + audit cost reduction', year1: totalInvestment * 0.03, year2: totalInvestment * 0.05, year3: totalInvestment * 0.06, year4: totalInvestment * 0.07, year5: totalInvestment * 0.08, realization: 'immediate', confidence: 'high' },
    ];
  }
  return [];
}

export function extractDetailedCosts(data: BusinessCaseData, implementationCost: number, operationalCost: number, maintenanceCost: number, archetype?: string, totalInvestment?: number): CostLineItem[] {
  // PRIORITY 1: Use archetype-specific cost drivers when available
  if (archetype && totalInvestment && totalInvestment > 0) {
    const archetypeCosts = getArchetypeCostDrivers(archetype, totalInvestment);
    if (archetypeCosts.length > 0) return archetypeCosts;
  }

  // PRIORITY 2: Use detailed costs from backend if they exist and are domain-specific
  const detailedCosts = data.detailedCosts || data.financialAnalysis?.detailedCosts || data.costs;
  if (Array.isArray(detailedCosts) && detailedCosts.length > 0) {
    return detailedCosts.map((c: RawCostItem, i: number) => ({
      id: c.id || `c${i + 1}`,
      category: (c.category || 'implementation') as CostCategory,
      subcategory: c.subcategory || 'General',
      name: c.name || `Cost Item ${i + 1}`,
      description: c.description || '',
      calculation: c.calculation || '',
      year0: parseFloat(String(c.year0 ?? c.initial ?? '0')),
      year1: parseFloat(String(c.year1 ?? '0')),
      year2: parseFloat(String(c.year2 ?? '0')),
      year3: parseFloat(String(c.year3 ?? '0')),
      year4: parseFloat(String(c.year4 ?? '0')),
      year5: parseFloat(String(c.year5 ?? '0')),
      isRecurring: c.isRecurring ?? false,
      source: c.source || '',
    }));
  }

  // PRIORITY 3: Generic fallback
  return [
    { id: 'c1', category: 'implementation', subcategory: 'Software', name: 'Software & Development', description: 'Core platform licensing and development', year0: implementationCost * 0.4, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
    { id: 'c2', category: 'implementation', subcategory: 'Infrastructure', name: 'Infrastructure Setup', description: 'Hardware, cloud, and environment', year0: implementationCost * 0.3, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
    { id: 'c3', category: 'implementation', subcategory: 'Integration', name: 'System Integration', description: 'Integration with existing systems', year0: implementationCost * 0.2, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
    { id: 'c4', category: 'implementation', subcategory: 'PM', name: 'Project Management', description: 'PMO and governance', year0: implementationCost * 0.1, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
    { id: 'c5', category: 'operational', subcategory: 'Operations', name: 'Annual Operations', description: 'Hosting and support', year0: 0, year1: operationalCost, year2: operationalCost * 1.03, year3: operationalCost * 1.06, year4: operationalCost * 1.09, year5: operationalCost * 1.12, isRecurring: true },
    { id: 'c6', category: 'operational', subcategory: 'Maintenance', name: 'Annual Maintenance', description: 'Updates and enhancements', year0: 0, year1: maintenanceCost || implementationCost * 0.18, year2: maintenanceCost || implementationCost * 0.18, year3: maintenanceCost || implementationCost * 0.18, year4: maintenanceCost || implementationCost * 0.18, year5: maintenanceCost || implementationCost * 0.18, isRecurring: true },
  ];
}

export function extractDetailedBenefits(data: BusinessCaseData, annualBenefit: number, archetype?: string, totalInvestment?: number): BenefitLineItem[] {
  // PRIORITY 1: Use archetype-specific benefit drivers when available
  if (archetype && totalInvestment && totalInvestment > 0) {
    const archetypeBenefits = getArchetypeBenefitDrivers(archetype, totalInvestment);
    if (archetypeBenefits.length > 0) return archetypeBenefits;
  }

  // PRIORITY 2: Use detailed benefits from backend if they exist
  const detailedBenefits = data.detailedBenefits || data.financialAnalysis?.detailedBenefits || data.benefits;
  if (Array.isArray(detailedBenefits) && detailedBenefits.length > 0) {
    return detailedBenefits.map((b: RawBenefitItem, i: number) => ({
      id: b.id || `b${i + 1}`,
      category: (b.category || 'productivity') as BenefitCategory,
      name: b.name || `Benefit ${i + 1}`,
      description: b.description || '',
      calculation: b.calculation || '',
      year1: parseFloat(String(b.year1 ?? '0')),
      year2: parseFloat(String(b.year2 ?? '0')),
      year3: parseFloat(String(b.year3 ?? '0')),
      year4: parseFloat(String(b.year4 ?? '0')),
      year5: parseFloat(String(b.year5 ?? '0')),
      realization: (b.realization || 'gradual') as BenefitRealization,
      confidence: (b.confidence || 'medium') as Confidence,
    }));
  }

  // PRIORITY 3: Generic fallback
  return [
    { id: 'b1', category: 'productivity', name: 'Operational Productivity Gains', description: 'Recovered staff capacity from automation', calculation: 'Staff hours saved × hourly rate', year1: annualBenefit * 0.2, year2: annualBenefit * 0.5, year3: annualBenefit * 0.8, year4: annualBenefit, year5: annualBenefit, realization: 'gradual', confidence: 'medium' },
    { id: 'b2', category: 'cost_savings', name: 'Operating Cost Avoidance', description: 'Reduced operational costs', calculation: 'Legacy system costs - new operational costs', year1: annualBenefit * 0.15, year2: annualBenefit * 0.4, year3: annualBenefit * 0.7, year4: annualBenefit * 0.9, year5: annualBenefit, realization: 'gradual', confidence: 'high' },
    { id: 'b3', category: 'risk_reduction', name: 'Control and Compliance Risk Reduction', description: 'Reduced errors and compliance risk', calculation: 'Error rate reduction × cost per error', year1: annualBenefit * 0.1, year2: annualBenefit * 0.3, year3: annualBenefit * 0.5, year4: annualBenefit * 0.7, year5: annualBenefit * 0.8, realization: 'delayed', confidence: 'medium' },
  ];
}

export function extractProjectArchetype(data: ArchetypeData): string {
  const projectName = data.suggestedProjectName ||
    data.demandReport?.suggestedProjectName ||
    data.projectName ||
    data.title ||
    '';

  const projectDescription = data.businessObjective ||
    data.demandReport?.businessObjective ||
    data.objective ||
    '';

  const organization = data.submittingOrganization ||
    data.demandReport?.submittingOrganization ||
    data.organizationName ||
    '';

  const problemStatement = data.problemStatement ||
    data.demandReport?.problemStatement ||
    '';

  // Use shared detectArchetype function with full context for consistent detection
  // across frontend and backend
  return detectArchetype({
    projectName,
    projectDescription,
    organization,
    objectives: projectDescription,
    problemStatement,
  });
}

export function calculateAIRecommendedBudget(archetype: string, domainAssumptions: DomainAssumption[] | undefined): { value: number; displayText: string; methodology: string } {
  // Archetype-level benchmark budgets (AED) aligned with the backend unified financial model.
  // These represent total 5-year investment (implementation + operational) for a typical-complexity project.
  // Keep in sync with ARCHETYPE_BASE_INVESTMENT in domains/demand/infrastructure/financialModel.ts.
  const ARCHETYPE_BENCHMARK_BUDGETS: Record<string, number> = {
    'Drone Last Mile Delivery': 18_000_000,
    'Drone First Mile Delivery': 27_000_000,
    'ERP Implementation': 15_000_000,
    'AI/ML Platform': 12_000_000,
    'Healthcare Digital System': 18_000_000,
    'Healthcare Digital Transformation': 27_000_000,
    'Blockchain Platform': 12_000_000,
    'Cybersecurity Infrastructure': 14_000_000,
    'Government Digital Transformation': 10_000_000,
    'Insurance Digital Platform': 14_000_000,
    'Education Digital Platform': 11_000_000,
    'Autonomous Vehicle Platform': 68_000_000,
    'Smart Government Infrastructure': 18_000_000,
    'Digital Service Platform': 10_000_000,
    'Government-Wide System': 25_000_000,
  };

  const formatAed = (value: number): string => {
    if (value >= 1_000_000_000) return `AED ${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `AED ${(value / 1_000_000).toFixed(0)}M`;
    return `AED ${Math.round(value).toLocaleString()}`;
  };

  // If we have no domain assumptions to compute from, return the archetype benchmark if available.
  if (!domainAssumptions || domainAssumptions.length === 0) {
    const benchmark = ARCHETYPE_BENCHMARK_BUDGETS[archetype] || 0;
    return benchmark > 0
      ? { value: benchmark, displayText: formatAed(benchmark), methodology: `Archetype benchmark for ${archetype}` }
      : { value: 0, displayText: '', methodology: '' };
  }

  const getVal = (name: string): number => {
    const found = domainAssumptions.find(a => a.name.toLowerCase().includes(name.toLowerCase()));
    return found ? (typeof found.value === 'number' ? found.value : parseFloat(String(found.value))) : 0;
  };

  if (archetype === 'Autonomous Vehicle Platform') {
    const fleetSize = getVal('fleet size') || 100;
    const vehicleCost = getVal('vehicle cost') || 450000;
    const dailyTrips = getVal('daily trips') || 18;
    const tripDistance = getVal('trip distance') || 12;
    const operatingCost = getVal('operating cost') || 0.85;
    const utilizationRate = getVal('utilization') || 0.72;

    const vehicleCapex = fleetSize * vehicleCost;
    const infrastructureCost = vehicleCapex * 0.35;
    const techIntegration = vehicleCapex * 0.25;
    const contingency = (vehicleCapex + infrastructureCost + techIntegration) * 0.15;
    const totalCapex = vehicleCapex + infrastructureCost + techIntegration + contingency;

    const annualOpex = fleetSize * dailyTrips * tripDistance * 365 * utilizationRate * operatingCost;
    const threeYearOpex = annualOpex * 3;

    const totalInvestment = totalCapex + threeYearOpex;
    const displayValue = totalInvestment >= 1_000_000_000
      ? `AED ${(totalInvestment / 1_000_000_000).toFixed(1)}B`
      : `AED ${(totalInvestment / 1_000_000).toFixed(0)}M`;

    return {
      value: totalInvestment,
      displayText: displayValue,
      methodology: `${fleetSize} vehicles × AED ${(vehicleCost/1000).toFixed(0)}K + infrastructure + 3yr OpEx`
    };
  }

  // Fallback for other archetypes: use benchmark table.
  const benchmark = ARCHETYPE_BENCHMARK_BUDGETS[archetype] || 0;
  return benchmark > 0
    ? { value: benchmark, displayText: formatAed(benchmark), methodology: `Archetype benchmark for ${archetype}` }
    : { value: 0, displayText: '', methodology: '' };
}

export function formatDomainAssumptionValue(value: number | string, unit?: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return String(value ?? '');
  }

  if (unit === '%') {
    const percentValue = value <= 1 ? value * 100 : value;
    return percentValue.toLocaleString(undefined, {
      minimumFractionDigits: percentValue % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    });
  }

  return value.toLocaleString();
}

export function extractInitialInvestment(data: InvestmentData, archetype: string, domainAssumptions: DomainAssumption[] | undefined, savedTotalCostEstimate?: number): { value: number; source: string; displayText: string; methodology?: string } {
  // PRIORITY 0: Use user-saved totalCostEstimate if available (from PUT endpoint edits)
  if (savedTotalCostEstimate !== undefined && savedTotalCostEstimate > 0) {
    // Format with appropriate precision - use 1 decimal for millions to avoid rounding errors
    let displayValue: string;
    if (savedTotalCostEstimate >= 1_000_000_000) {
      displayValue = `AED ${(savedTotalCostEstimate / 1_000_000_000).toFixed(2)}B`;
    } else if (savedTotalCostEstimate >= 1_000_000) {
      // Use 1 decimal place to accurately show values like 1.5M instead of rounding to 2M
      const millions = savedTotalCostEstimate / 1_000_000;
      displayValue = millions % 1 === 0 ? `AED ${millions.toFixed(0)}M` : `AED ${millions.toFixed(1)}M`;
    } else if (savedTotalCostEstimate >= 1_000) {
      displayValue = `AED ${(savedTotalCostEstimate / 1_000).toFixed(0)}K`;
    } else {
      displayValue = `AED ${savedTotalCostEstimate.toFixed(0)}`;
    }
    return {
      value: savedTotalCostEstimate,
      source: 'Saved Investment',
      displayText: displayValue
    };
  }

  // Extract explicit business case totalCostEstimate when present.
  // We treat this as a fallback because AI drafts can sometimes output low/unstable costs.
  const explicitTotalCost = (() => {
    const raw = (data.totalCostEstimate ?? "").toString().trim();
    if (!raw) return 0;
    // Accept strings like "1180000.00" or "AED 1,180,000".
    const cleaned = raw.replace(/[^0-9.]/g, "");
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : 0;
  })();

  const totalCost = explicitTotalCost;

  const estimatedBudget = data.estimatedBudget || data.demandReport?.estimatedBudget || '';
  if (estimatedBudget) {
    const value = parseFloat(String(estimatedBudget).replace(/[^0-9.]/g, ''));
    if (!isNaN(value) && value > 0) {
      return {
        value,
        source: 'Computed Financial Model',
        displayText: value >= 1_000_000 ? `AED ${(value / 1_000_000).toFixed(1)}M` : `AED ${value.toLocaleString()}`,
      };
    }
  }

  if (explicitTotalCost > 0) {
    const displayValue = explicitTotalCost >= 1_000_000_000
      ? `AED ${(explicitTotalCost / 1_000_000_000).toFixed(2)}B`
      : explicitTotalCost >= 1_000_000
        ? `AED ${(explicitTotalCost / 1_000_000).toFixed(1)}M`
        : `AED ${Math.round(explicitTotalCost).toLocaleString()}`;
    return {
      value: explicitTotalCost,
      source: 'Business Case Estimate',
      displayText: displayValue,
    };
  }

  const budgetRange = data.budgetRange || data.demandReport?.budgetRange || '';

  if (budgetRange) {
    // Helper to parse numbers with commas (e.g., "1,200,000" -> 1200000)
    const parseNumberWithCommas = (str: string): number => {
      const cleaned = str.replace(/,/g, '').trim();
      return parseFloat(cleaned) || 0;
    };

    const getMultiplier = (unit: string | undefined): number => {
      if (!unit) return 1;
      const u = unit.toUpperCase();
      if (u === 'B' || u === 'BILLION') return 1_000_000_000;
      if (u === 'M' || u === 'MILLION') return 1_000_000;
      if (u === 'K' || u === 'THOUSAND') return 1_000;
      return 1;
    };

    // Try format: "AED 1,200,000 to 3,500,000" (with commas and "to")
    const aedRangeMatch = budgetRange.match(/AED\s*([\d,]+(?:\.\d+)?)\s*(?:to|–|-)\s*([\d,]+(?:\.\d+)?)/i);
    if (aedRangeMatch) {
      const lowValue = parseNumberWithCommas(aedRangeMatch[1]!);
      const highValue = parseNumberWithCommas(aedRangeMatch[2]!);
      const midpoint = (lowValue + highValue) / 2;
      const displayValue = midpoint >= 1_000_000 ? `AED ${(midpoint / 1_000_000).toFixed(1)}M` : `AED ${midpoint.toLocaleString()}`;
      return { value: midpoint, source: 'Demand Request Budget', displayText: displayValue };
    }

    // Try format: "AED 1,200,000" (single value with commas)
    const singleAedMatch = budgetRange.match(/AED\s*([\d,]+(?:\.\d+)?)/i);
    if (singleAedMatch) {
      const value = parseNumberWithCommas(singleAedMatch[1]!);
      const displayValue = value >= 1_000_000 ? `AED ${(value / 1_000_000).toFixed(1)}M` : `AED ${value.toLocaleString()}`;
      return { value, source: 'Demand Request Budget', displayText: displayValue };
    }

    // Try format: "1.2M-3.5M" or "5M" (M/K/B suffix)
    const rangeMatch = budgetRange.match(/([\d.]+)\s*([MBK])?[–-]?\s*([\d.]+)?\s*([MBK])?/i);
    if (rangeMatch) {
      const lowValue = parseFloat(rangeMatch[1]!) * getMultiplier(rangeMatch[2]);
      const highValue = rangeMatch[3] ? parseFloat(rangeMatch[3]) * getMultiplier(rangeMatch[4] || rangeMatch[2]) : lowValue;
      const midpoint = (lowValue + highValue) / 2;
      return { value: midpoint, source: 'Demand Request Budget', displayText: `AED ${(midpoint / 1_000_000).toFixed(1)}M` };
    }
  }

  // Use archetype-specific benchmark when available (helps when AI draft cost is missing or implausibly low).
  const aiRecommended = calculateAIRecommendedBudget(archetype, domainAssumptions);
  if (aiRecommended.value > 0) {
    return {
      value: aiRecommended.value,
      source: 'AI Recommended Investment',
      displayText: aiRecommended.displayText,
      methodology: aiRecommended.methodology,
    };
  }

  return { value: totalCost, source: 'Calculated Investment', displayText: totalCost > 0 ? `AED ${(totalCost / 1_000_000).toFixed(0)}M` : 'Not specified' };
}

export function extractFinancialModel(businessCaseData: BusinessCaseData): ExtractedFinancialModel {
  const rawData = businessCaseData || {};
  const demandReport = rawData.demandReport || {};

  const projectName = demandReport.suggestedProjectName ||
    rawData.suggestedProjectName ||
    rawData.projectName ||
    '';
  const businessObjective = demandReport.businessObjective ||
    rawData.businessObjective ||
    '';
  const budgetRange = demandReport.budgetRange ||
    rawData.budgetRange ||
    rawData.financialAnalysis?.budgetRange ||
    '';

  // PRIORITY 1: Use archetype from backend's computedFinancialModel if available
  // This ensures consistency between what backend computed and what frontend displays
  const backendArchetype = (rawData.computedFinancialModel as Record<string, unknown>)?.inputs as Record<string, unknown> | undefined;
  const cachedArchetype = backendArchetype?.archetype as string | undefined;

  let archetype: string;
  if (cachedArchetype) {
    archetype = cachedArchetype;
  } else {
    // FALLBACK: Re-detect archetype from demand data if no cached value
    const archetypeData = {
      suggestedProjectName: projectName,
      businessObjective: businessObjective,
      problemStatement: demandReport.problemStatement || rawData.problemStatement || '',
      strategicAlignment: rawData.strategicAlignment,
      matchedProjectType: rawData.matchedProjectType,
      financialAnalysis: rawData.financialAnalysis,
    };

    archetype = extractProjectArchetype(archetypeData);
  }

  const archetypeConfig = getArchetypeConfig(archetype);

  // Check for user-saved totalCostEstimate (from PUT endpoint financial edits)
  // This should take priority over AI-calculated values
  const rawDataRec = rawData as Record<string, unknown>;
  const savedTotalCostEstimate = rawDataRec.savedTotalCostEstimate !== undefined && rawDataRec.savedTotalCostEstimate !== ''
    ? parseFloat(String(rawDataRec.savedTotalCostEstimate))
    : undefined;

  const investmentData = {
    budgetRange: budgetRange,
    // Prefer backend-computed financial model totalInvestment when available.
    estimatedBudget:
      String((rawDataRec.computedFinancialModel as Record<string, unknown> | undefined)?.inputs != null
        ? ((rawDataRec.computedFinancialModel as Record<string, unknown>).inputs as Record<string, unknown>).totalInvestment
        : '')
      || demandReport.estimatedBudget
      || rawData.estimatedBudget
      || '',
    // Prefer the business case's totalCostEstimate (AI/persisted) over nested financialAnalysis fields.
    totalCostEstimate: String(
      rawDataRec.totalCostEstimate ??
      (rawData.financialAnalysis as Record<string, unknown> | undefined)?.totalCostEstimate ??
      (rawData.financialAnalysis as Record<string, unknown> | undefined)?.totalCost ??
      ''),
  };
  const initialInvestment = extractInitialInvestment(investmentData, archetype, archetypeConfig.assumptions.domainAssumptions, savedTotalCostEstimate);

  const data = rawData;
  const financialAnalysis = data.financialAnalysis || {};
  // Read saved financial assumptions from PUT endpoint (also check legacy locations)
  const savedAssumptions = data.financialAssumptions || financialAnalysis.financialAssumptions || {};
  // Standardize discountRate to DECIMAL (0.08 not 8) - all functions expect decimal
  const discountRateDecimal = (() => {
    if (savedAssumptions.discountRate !== undefined) {
      // Already stored as decimal in DB
      return Number(savedAssumptions.discountRate);
    }
    const raw = Number(data.discountRate ?? financialAnalysis.discountRate ?? 8);
    // Handle both "8" (percentage) and "0.08" (decimal) formats
    return raw > 1 ? raw / 100 : raw;
  })();
  const discountRate = discountRateDecimal;
  const projectDuration = 5;

  const normalizeAssumptionConfidence = (value: unknown): FinancialAssumption['confidence'] => {
    if (value === 'high' || value === 'medium' || value === 'low') return value;
    return 'medium';
  };

  const assumptions: FinancialAssumption[] = (data.assumptions || financialAnalysis?.assumptions || []).map((a: RawAssumption, i: number) => ({
    id: a.id || `assumption-${i}`,
    category: (a.category || 'cost') as AssumptionCategory,
    name: a.name || a.assumption || `Assumption ${i + 1}`,
    value: a.value || '',
    unit: a.unit || '',
    source: a.source || 'UAE market benchmarks',
    rationale: a.rationale || a.description || '',
    confidence: normalizeAssumptionConfidence(a.confidence),
    industryBenchmark: a.industryBenchmark || '',
  }));

  if (assumptions.length === 0) {
    assumptions.push(
      { id: 'a1', category: 'cost', name: 'Implementation timeline', value: '12-18', unit: 'months', source: 'UAE government IT benchmarks', rationale: 'Based on similar implementations', confidence: 'high', industryBenchmark: 'Gartner: 12-24 months' },
      { id: 'a2', category: 'benefit', name: 'User adoption rate', value: '75', unit: '%', source: 'UAE Digital Government Strategy', rationale: 'Conservative estimate', confidence: 'medium', industryBenchmark: 'UAE average: 70-85%' },
    );
  }

  const tcoBreakdown = data.tcoBreakdown || financialAnalysis?.tcoBreakdown || {};
  const implementationCost = parseFloat(String(tcoBreakdown.implementation || data.implementationCosts?.total || '0'));
  const operationalCost = parseFloat(String(tcoBreakdown.operational || data.operationalCosts?.annual || '0'));
  const maintenanceCost = parseFloat(String(tcoBreakdown.maintenance || '0'));
  const totalBenefit = parseFloat(String(data.totalBenefitEstimate || financialAnalysis?.totalBenefit || '0'));
  const annualBenefit = totalBenefit / 5;

  const costs = extractDetailedCosts(data, implementationCost, operationalCost, maintenanceCost, archetype, initialInvestment.value);
  const benefits = extractDetailedBenefits(data, annualBenefit, archetype, initialInvestment.value);

  const discountRatePercent = discountRate * 100;
  const cashFlows = buildCashFlows(costs, benefits, discountRatePercent, projectDuration);
  const scenarios = calculateScenarios(costs, benefits, discountRatePercent, projectDuration);
  const sensitivityAnalysis = calculateSensitivityAnalysis(costs, benefits, discountRatePercent, projectDuration);
  const doNothingScenario = calculateDoNothingScenario(benefits, projectDuration);
  const keyMetrics = calculateKeyMetrics(cashFlows, scenarios, discountRatePercent);
  const recommendation = generateDecisionRecommendation(keyMetrics, scenarios, sensitivityAnalysis);

  return {
    version: '2.0',
    generatedAt: new Date().toISOString(),
    currency: 'AED',
    discountRate,
    projectDuration,
    assumptions,
    costs,
    benefits,
    cashFlows,
    scenarios,
    sensitivityAnalysis,
    doNothingScenario,
    keyMetrics,
    recommendation,
    archetype,
    initialInvestment,
  };
}
