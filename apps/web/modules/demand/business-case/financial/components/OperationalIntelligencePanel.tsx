import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Target, XCircle } from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type {
  CostLineItem,
  DriverModelOutput,
  DroneStageEconomics,
  KillSwitchMetrics,
  RiskAdjustedAnalysis,
} from '../types/financialTypes';
import { formatCompactNumber, formatCurrency, formatPercentage } from '../utils/financialFormatters';
import { formatPreciseAed, type FinancialViewMode } from '../utils/financialOverrides';

type AssumptionCredibility = 'Derived Baseline' | 'Benchmark-based' | 'Hypothesis';

/* ─────────────────────────────────────────
   Operational Intelligence Panel Sub-Component
   ───────────────────────────────────────── */

export function OperationalIntelligencePanel({ computedFinancialModel, costs, fiveYearYearly, activeFinancialView, activeStageEconomics }: {
  computedFinancialModel?: Record<string, unknown>;
  costs: CostLineItem[];
  fiveYearYearly: { year: number; revenue: number; costs: number; netCashFlow: number; operatingMargin: number }[];
  activeFinancialView?: FinancialViewMode;
  activeStageEconomics?: DroneStageEconomics;
}) {
  const cfm = computedFinancialModel;

  // Extract backend data if available
  const driverModel = cfm?.driverModel as DriverModelOutput | undefined;
  const killSwitch = cfm?.killSwitchMetrics as KillSwitchMetrics | undefined;
  const riskAnalysis = cfm?.riskAdjustedAnalysis as RiskAdjustedAnalysis | undefined;
  const stagedEconomics = driverModel?.stagedEconomics;
  const visibleRiskAnalysis = activeFinancialView === 'pilot' ? undefined : riskAnalysis;
  const killSwitchThresholds = Array.isArray(killSwitch?.thresholds) ? killSwitch.thresholds : [];

  // Derive EBITDA margins locally from costs/benefits when backend data unavailable
  const derivedMargins = useMemo(() => {
    if (driverModel?.margins) {
      const m = driverModel.margins;
      return m.ebitdaMargin.map((ebitda, i) => ({ year: i + 1, ebitdaMargin: ebitda, netMargin: m.netMargin[i] ?? ebitda * 0.7 }));
    }
    return fiveYearYearly.filter(p => p.year > 0).map(p => {
      const totalRevenue = p.revenue;
      const variableCosts = costs.filter(c => c.isRecurring && (c.subcategory === 'Variable' || c.subcategory === 'Operations'))
        .reduce((s, c) => s + (Number((c as unknown as Record<string, unknown>)[`year${p.year}`]) || 0), 0);
      const fixedCosts = costs.filter(c => c.isRecurring && c.subcategory !== 'Variable' && c.subcategory !== 'Operations')
        .reduce((s, c) => s + (Number((c as unknown as Record<string, unknown>)[`year${p.year}`]) || 0), 0);
      const ebitda = totalRevenue - variableCosts - fixedCosts;
      const ebitdaMargin = totalRevenue > 0 ? (ebitda / totalRevenue) * 100 : 0;
      return { year: p.year, ebitdaMargin: Math.round(ebitdaMargin * 10) / 10, netMargin: Math.round(ebitdaMargin * 0.7 * 10) / 10 };
    });
  }, [driverModel, fiveYearYearly, costs]);

  // Derive revenue segmentation from driver model
  const revenueSegmentation = useMemo(() => {
    if (activeFinancialView === 'pilot') {
      return null;
    }
    if (driverModel?.revenueDrivers?.segments) {
      return driverModel.revenueDrivers.segments.map(seg => ({
        segment: seg.name,
        share: seg.share * 100,
        fare: seg.fare,
      }));
    }
    return null;
  }, [activeFinancialView, driverModel]);

  // If no operational data to show, skip rendering
  const hasContent = derivedMargins.length > 0 || killSwitch || visibleRiskAnalysis || revenueSegmentation;
  if (!hasContent) return null;

  const segmentColors = ['#6366f1', '#3b82f6', '#06b6d4'];
  const formatPreciseCurrency = (value: number) => formatPreciseAed(value);
  const demandDrivers = driverModel?.demandDrivers;
  const getKillSwitchAction = (metric: string) => {
    const metricKey = metric.toLowerCase();
    if (metricKey.includes('pilot cost per delivery')) {
      return 'Action: if cost stays above AED 45 for 2 consecutive months, PAUSE pilot.';
    }
    if (metricKey.includes('delivery success rate')) {
      return 'Action: if success rate falls below 90%, STOP operations until corrected.';
    }
    if (metricKey.includes('contracted volume share')) {
      return 'Action: if contracted demand remains below 50%, NO EXPANSION is authorized.';
    }
    if (metricKey.includes('scale ')) {
      return 'Reference benchmark only: informs scale readiness and is not part of the current pilot decision.';
    }
    return null;
  };

  const renderStageCard = (label: string, stage: DroneStageEconomics, tone: 'pilot' | 'scale') => {
    const isPilot = tone === 'pilot';
    const recognizedAnnualRevenue = stage.annualRecognizedRevenue ?? stage.annualRevenue;
    const recognizedAnnualDeliveries = stage.recognizedAnnualDeliveries ?? stage.annualDeliveries;
    const recognizedRevenuePerDelivery = stage.recognizedRevenuePerDelivery ?? stage.realizedRevenuePerDelivery;
    const preRealizationRevenuePerDelivery = stage.preRealizationRevenuePerDelivery ?? stage.nominalRevenuePerDelivery;
    const recognizedUnitSpread = recognizedRevenuePerDelivery - stage.effectiveCostPerDelivery;
    const grossDeliveryCapacity = stage.fleetSize * stage.dailyDeliveriesPerDrone * 365;
    const rampFactor = grossDeliveryCapacity > 0 ? stage.annualDeliveries / grossDeliveryCapacity : 0;
    const derivedOperatingDays = stage.fleetSize > 0 && stage.dailyDeliveriesPerDrone > 0
      ? stage.annualDeliveries / (stage.fleetSize * stage.dailyDeliveriesPerDrone)
      : 0;
    const illustrativeCycleMinutes = Math.round((12 * 60) / Math.max(1, stage.dailyDeliveriesPerDrone));
    const preciseRecognizedRevenuePerDelivery = recognizedRevenuePerDelivery;
    const accentClasses = isPilot
      ? 'border-amber-200/80 bg-amber-50/70 dark:border-amber-900/70 dark:bg-amber-950/20'
      : 'border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/20';
    const badgeClasses = isPilot
      ? 'border-amber-300/70 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
      : 'border-emerald-300/70 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
    const conservativeThroughput = Math.max(1, Math.round(stage.dailyDeliveriesPerDrone * (isPilot ? 0.75 : 0.8)));
    const stretchThroughput = Math.max(conservativeThroughput + 1, Math.round(stage.dailyDeliveriesPerDrone * (isPilot ? 1.15 : 1.1)));
    const canonicalUnitEconomics = `${formatPreciseCurrency(preciseRecognizedRevenuePerDelivery)} revenue • ${formatPreciseCurrency(stage.effectiveCostPerDelivery)} cost • ${formatPreciseCurrency(recognizedUnitSpread)} spread`;
    const evidenceToneClasses: Record<AssumptionCredibility | 'Gate Condition', string> = {
      'Derived Baseline': 'border-slate-300/80 bg-slate-100/80 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
      'Benchmark-based': 'border-sky-300/80 bg-sky-100/80 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300',
      Hypothesis: 'border-amber-300/80 bg-amber-100/80 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
      'Gate Condition': 'border-emerald-300/80 bg-emerald-100/80 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    };
    const evidenceItems = isPilot
      ? [
          {
            label: 'Single Source Unit Economics',
            tone: 'Derived Baseline' as const,
            value: canonicalUnitEconomics,
            detail: 'This is the canonical pilot baseline used across narrative, KPI, and gate framing.',
          },
          {
            label: 'Demand Evidence',
            tone: 'Hypothesis' as const,
            value: `${formatPercentage(stage.contractedVolumeShare * 100)} contracted share`,
            detail: 'The current model does not yet split signed, pipeline, and assumed demand. Treat this share as assumed until secured commitments are evidenced.',
          },
          {
            label: 'Variable Cost Stack',
            tone: 'Benchmark-based' as const,
            value: `${formatPreciseCurrency(stage.variableCostPerDelivery)} variable cost`,
            detail: 'Modeled from energy, maintenance, handling, cloud, partner, and support assumptions; live pilot spend still needs to confirm compliance, insurance, and incident-response burden.',
          },
          {
            label: 'Throughput Proof',
            tone: 'Hypothesis' as const,
            value: `${stage.dailyDeliveriesPerDrone}/drone/day`,
            detail: `Operational base case; conservative validation floor is ${conservativeThroughput}/day and stretch performance is ${stretchThroughput}/day.`,
          },
        ]
      : [
          {
            label: 'Commercial Baseline',
            tone: 'Derived Baseline' as const,
            value: canonicalUnitEconomics,
            detail: 'This is the current full-commercial unit-economics baseline used across the scale case.',
          },
          {
            label: 'Demand Lock-In',
            tone: 'Hypothesis' as const,
            value: `${formatPercentage(stage.contractedVolumeShare * 100)} contracted share`,
            detail: 'Commercial scale still depends on durable contracted demand rather than generic market volume assumptions.',
          },
          {
            label: 'Variable Cost Stack',
            tone: 'Benchmark-based' as const,
            value: `${formatPreciseCurrency(stage.variableCostPerDelivery)} variable cost`,
            detail: 'The scale case assumes benchmarked partner, maintenance, control, and support costs that must still hold under real network operations.',
          },
          {
            label: 'Target Condition',
            tone: 'Gate Condition' as const,
            value: 'Sub-AED 30 / delivery',
            detail: 'Scale funding should only be released when the operating model can sustain the target cost profile and partner readiness.',
          },
        ];

    const fragilityDrivers = isPilot
      ? [
          {
            label: 'Throughput Floor',
            threshold: `< ${conservativeThroughput} deliveries / drone / day`,
            effect: 'Revenue compresses quickly and fixed-cost absorption worsens.',
          },
          {
            label: 'Demand Conversion Gate',
            threshold: '< 50% contracted demand',
            effect: 'Expansion stays blocked even if the rest of the pilot is operationally stable.',
          },
          {
            label: 'Unit Cost Kill-Switch',
            threshold: '> AED 45 / delivery for 2 months',
            effect: 'The pilot pauses and the operating model must be reworked before more funding is released.',
          },
        ]
      : [
          {
            label: 'Utilization Floor',
            threshold: `< ${Math.max(1, Math.round(stage.dailyDeliveriesPerDrone * 0.8))} deliveries / drone / day`,
            effect: 'Scale economics fall below plan as fixed-cost absorption erodes.',
          },
          {
            label: 'Commercial Cost Target',
            threshold: '> AED 30 / delivery at steady state',
            effect: 'Scale rollout should remain conditional because the target cost curve has not been proven.',
          },
          {
            label: 'Rollout Delay',
            threshold: '2-month deployment slip',
            effect: `Adds roughly ${formatCurrency(stage.annualFixedCost / 6, 'AED', true)} of fixed-cost drag before the revenue ramp catches up.`,
          },
        ];

    const buildStressCase = ({
      title,
      deliveriesFactor,
      revenuePerDeliveryFactor,
      variableCostFactor,
      note,
      governance,
    }: {
      title: string;
      deliveriesFactor: number;
      revenuePerDeliveryFactor: number;
      variableCostFactor: number;
      note: string;
      governance?: string;
    }) => {
      const stressedDeliveries = Math.max(1, recognizedAnnualDeliveries * deliveriesFactor);
      const stressedThroughput = Math.max(1, stage.dailyDeliveriesPerDrone * deliveriesFactor);
      const stressedRevenuePerDelivery = recognizedRevenuePerDelivery * revenuePerDeliveryFactor;
      const stressedUnitCost = (stage.variableCostPerDelivery * variableCostFactor) + (stage.annualFixedCost / stressedDeliveries);
      const stressedSpread = stressedRevenuePerDelivery - stressedUnitCost;
      const stressedAnnualRevenue = stressedDeliveries * stressedRevenuePerDelivery;

      return {
        title,
        headline: `${formatPreciseCurrency(stressedRevenuePerDelivery)} revenue • ${formatPreciseCurrency(stressedUnitCost)} cost • ${formatPreciseCurrency(stressedSpread)} spread`,
        detail: `${Math.round(stressedThroughput)} deliveries/day and ${formatCurrency(stressedAnnualRevenue, 'AED', true)} annual revenue under ${note}.`,
        governance,
      };
    };

    const stressTests = isPilot
      ? [
          buildStressCase({
            title: 'Conservative Throughput',
            deliveriesFactor: 0.75,
            revenuePerDeliveryFactor: 1,
            variableCostFactor: 1,
            note: 'a 25% throughput shortfall versus the base case',
          }),
          buildStressCase({
            title: 'Demand Miss',
            deliveriesFactor: 0.85,
            revenuePerDeliveryFactor: 0.92,
            variableCostFactor: 1,
            note: 'weaker conversion and softer contracted-demand realization',
            governance: 'If contracted demand slips below the 50% gate, expansion remains blocked even before the financial case is reconsidered.',
          }),
          buildStressCase({
            title: 'Downtime + Cost Inflation',
            deliveriesFactor: 0.9,
            revenuePerDeliveryFactor: 1,
            variableCostFactor: 1.12,
            note: '10% downtime and 12% variable-cost inflation',
            governance: 'This is the type of learning-curve, retry, and idle-fleet pressure the pilot must prove it can absorb.',
          }),
        ]
      : [
          buildStressCase({
            title: '20% Underutilization',
            deliveriesFactor: 0.8,
            revenuePerDeliveryFactor: 1,
            variableCostFactor: 1,
            note: '20% lower throughput than the commercial plan',
          }),
          buildStressCase({
            title: '10% Variable Cost Overrun',
            deliveriesFactor: 1,
            revenuePerDeliveryFactor: 1,
            variableCostFactor: 1.1,
            note: '10% higher variable operating cost than planned',
          }),
          {
            title: '2-Month Rollout Delay',
            headline: `${formatCurrency(stage.annualFixedCost / 6, 'AED', true)} fixed-cost drag`,
            detail: `A two-month commercial delay carries roughly ${formatCurrency(stage.annualFixedCost / 6, 'AED', true)} of fixed exposure before the revenue ramp catches up.`,
            governance: 'Board review should treat delay risk as a cash drag, not just a delivery-plan inconvenience.',
          },
        ];

    const scaleGlidePath = !isPilot && stagedEconomics
      ? {
          pilotUnitCost: stagedEconomics.pilotCase.effectiveCostPerDelivery,
          scaleUnitCost: stage.effectiveCostPerDelivery,
          targetGap: stage.effectiveCostPerDelivery - 30,
          throughputLift: stage.dailyDeliveriesPerDrone - stagedEconomics.pilotCase.dailyDeliveriesPerDrone,
          fixedCostRelief: stagedEconomics.pilotCase.fixedCostPerDelivery - stage.fixedCostPerDelivery,
          automationLift: (stage.automationRate - stagedEconomics.pilotCase.automationRate) * 100,
          idleTimeLift: (stage.idleTimeReduction - stagedEconomics.pilotCase.idleTimeReduction) * 100,
        }
      : null;

    return (
      <div className={`rounded-2xl border p-4 space-y-4 ${accentClasses}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <Badge variant="outline" className={badgeClasses}>{stage.horizon}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{stage.objective}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Gate View</p>
            <p className={`text-sm font-semibold ${isPilot ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
              {isPilot ? 'Validation Layer' : 'Commercial Layer'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl bg-background/70 p-3 border border-border/60">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Fleet</p>
            <p className="mt-1 text-lg font-semibold">{stage.fleetSize}</p>
            <p className="text-[11px] text-muted-foreground">active drones</p>
          </div>
          <div className="rounded-xl bg-background/70 p-3 border border-border/60">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Throughput</p>
            <p className="mt-1 text-lg font-semibold">{stage.dailyDeliveriesPerDrone}</p>
            <p className="text-[11px] text-muted-foreground">deliveries / drone / day</p>
          </div>
          <div className="rounded-xl bg-background/70 p-3 border border-border/60">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Unit Cost</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(stage.effectiveCostPerDelivery, 'AED', true)}</p>
            <p className="text-[11px] text-muted-foreground">fully loaded per delivery</p>
          </div>
          <div className="rounded-xl bg-background/70 p-3 border border-border/60">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Annual Revenue</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(recognizedAnnualRevenue, 'AED', true)}</p>
            <p className="text-[11px] text-muted-foreground">recognized run-rate</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl bg-background/70 p-3 border border-border/60">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Recognized Revenue</p>
            <p className="mt-1 font-semibold">{formatCurrency(recognizedRevenuePerDelivery, 'AED', true)}</p>
            <p className="text-muted-foreground">after demand conversion</p>
          </div>
          <div className="rounded-xl bg-background/70 p-3 border border-border/60">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Fixed Cost Absorption</p>
            <p className="mt-1 font-semibold">{formatCurrency(stage.fixedCostPerDelivery, 'AED', true)}</p>
            <p className="text-muted-foreground">embedded in unit cost</p>
          </div>
          <div className="rounded-xl bg-background/70 p-3 border border-border/60">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Recognized Unit Spread</p>
            <p className="mt-1 font-semibold">{formatCurrency(recognizedUnitSpread, 'AED', true)}</p>
            <p className="text-muted-foreground">recognized revenue minus fully loaded cost</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl bg-background/70 p-3 border border-border/60">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Contracted Volume</p>
            <p className="mt-1 font-semibold">{formatPercentage(stage.contractedVolumeShare * 100)}</p>
            <p className="text-muted-foreground">{isPilot ? 'assumed validation target unless backed by signed commitments' : 'enterprise-backed demand'}</p>
          </div>
          <div className="rounded-xl bg-background/70 p-3 border border-border/60">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Operating Model</p>
            <p className="mt-1 font-semibold">{stage.partneringStrategy}</p>
          </div>
          <div className="rounded-xl bg-background/70 p-3 border border-border/60">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Automation</p>
            <p className="mt-1 font-semibold">{formatPercentage(stage.automationRate * 100)}</p>
            <p className="text-muted-foreground">operations enabled by automation</p>
          </div>
          <div className="rounded-xl bg-background/70 p-3 border border-border/60">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Idle-Time Reduction</p>
            <p className="mt-1 font-semibold">{formatPercentage(stage.idleTimeReduction * 100)}</p>
            <p className="text-muted-foreground">fleet optimization effect</p>
          </div>
        </div>

        <div className="rounded-xl bg-background/70 p-3 border border-dashed border-border/60 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Evidence Ladder</p>
              <p className="mt-1 text-xs leading-5 text-foreground/90">Separate what the model outputs are saying from what still has to be proven operationally.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
            {evidenceItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-border/60 bg-background/80 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">{item.label}</p>
                  <Badge variant="outline" className={evidenceToneClasses[item.tone]}>{item.tone}</Badge>
                </div>
                <p className="text-sm font-semibold text-foreground">{item.value}</p>
                <p className="text-muted-foreground leading-5">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-background/70 p-3 border border-dashed border-border/60">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">What This Layer Means</p>
          <p className="mt-1 text-xs leading-5 text-foreground/90">{stage.gateSummary}</p>
        </div>

        <div className="rounded-xl bg-background/70 p-3 border border-dashed border-border/60 space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Revenue Recognition Bridge</p>
            <p className="mt-1 text-xs leading-5 text-foreground/90">
              Effective revenue = gross delivery capacity x ramp factor x revenue-realization factor x (weighted fare + contracted-share-weighted platform fee), plus integration revenue.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Collapsed view = recognized deliveries x recognized revenue per delivery = annual recognized revenue.
            </p>
            <p className="mt-1 text-xs leading-5 text-foreground/90">
              This effectively translates to ~{Math.round(recognizedAnnualDeliveries / 10000) * 10}K completed deliveries at ~{formatCurrency(Math.round(preciseRecognizedRevenuePerDelivery), 'AED', true)} per delivery.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Gross Capacity</p>
              <p className="mt-1 font-semibold">{formatCompactNumber(grossDeliveryCapacity)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Ramp Factor</p>
              <p className="mt-1 font-semibold">{formatPercentage(rampFactor * 100)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Realization</p>
              <p className="mt-1 font-semibold">{formatPercentage(stage.revenueRealizationFactor * 100)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Contracted Share</p>
              <p className="mt-1 font-semibold">{formatPercentage(stage.contractedVolumeShare * 100)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Integration Revenue</p>
              <p className="mt-1 font-semibold">{formatCurrency(stage.annualIntegrationRevenue, 'AED', true)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Recognized Deliveries</p>
              <p className="mt-1 font-semibold">{formatCompactNumber(recognizedAnnualDeliveries)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Recognized Rev / Delivery</p>
              <p className="mt-1 font-semibold">{formatPreciseCurrency(preciseRecognizedRevenuePerDelivery)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Pre-Realization Yield</p>
              <p className="mt-1 font-semibold">{formatPreciseCurrency(preRealizationRevenuePerDelivery)}</p>
            </div>
          </div>

          <p className="text-xs leading-5 text-foreground/90">
            {formatCompactNumber(grossDeliveryCapacity)} gross delivery slots x {formatPercentage(rampFactor * 100)} ramp x {formatPercentage(stage.revenueRealizationFactor * 100)} realization with {formatPercentage(stage.contractedVolumeShare * 100)} contracted-share weighting on platform fees collapses to {formatCompactNumber(recognizedAnnualDeliveries)} recognized deliveries at {formatPreciseCurrency(preciseRecognizedRevenuePerDelivery)}, producing {formatCurrency(recognizedAnnualRevenue, 'AED', true)} of annual recognized revenue.
          </p>
          {isPilot && (
            <>
              <p className="text-xs leading-5 text-foreground/90">
                {stage.dailyDeliveriesPerDrone} deliveries/day currently rests on roughly {Math.round(derivedOperatingDays)} pilot operating days{demandDrivers?.fleetAvailability != null ? `, ${Math.round(demandDrivers.fleetAvailability * 100)}% fleet availability` : ''}{demandDrivers?.weatherRegulationFactor != null ? `, and ${Math.round(demandDrivers.weatherRegulationFactor * 100)}% weather-adjusted availability` : ''}.
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                If operated across a 12-hour dispatch day, that is roughly one completed drop every {illustrativeCycleMinutes} minutes; this remains an operating hypothesis to validate in the pilot.
              </p>
            </>
          )}
        </div>

        <div className="rounded-xl bg-background/70 p-3 border border-dashed border-border/60 space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Stress-Test View</p>
            <p className="mt-1 text-xs leading-5 text-foreground/90">Pressure-test the case on throughput, demand realization, delay, and cost variance instead of reading the base case as reality.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {stressTests.map((scenario) => (
              <div key={scenario.title} className="rounded-xl border border-border/60 bg-background/80 p-3 space-y-2">
                <p className="font-semibold text-foreground">{scenario.title}</p>
                <p className="text-sm font-semibold text-foreground">{scenario.headline}</p>
                <p className="text-muted-foreground leading-5">{scenario.detail}</p>
                {scenario.governance && (
                  <p className="text-[11px] leading-5 text-foreground/90">{scenario.governance}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-background/70 p-3 border border-dashed border-border/60 space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Fragility Exposure</p>
            <p className="mt-1 text-xs leading-5 text-foreground/90">Make the breakpoints explicit so the decision does not rely on the base case being true by default.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {fragilityDrivers.map((driver) => (
              <div key={driver.label} className="rounded-xl border border-border/60 bg-background/80 p-3 space-y-2">
                <p className="font-semibold text-foreground">{driver.label}</p>
                <p className="text-sm font-semibold text-foreground">{driver.threshold}</p>
                <p className="text-muted-foreground leading-5">{driver.effect}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-background/70 p-3 border border-dashed border-border/60 space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Cost Realism Watchlist</p>
            <p className="mt-1 text-xs leading-5 text-foreground/90">This is the gap between an engineering cost view and a fully lived operating cost curve.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl border border-border/60 bg-background/80 p-3 space-y-2">
              <p className="font-semibold text-foreground">Regulatory Overhead</p>
              <p className="text-muted-foreground leading-5">Approvals, audits, and compliance effort still need to be proven in live pilot operations.</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/80 p-3 space-y-2">
              <p className="font-semibold text-foreground">Insurance & Liability</p>
              <p className="text-muted-foreground leading-5">Coverage cost and incident exposure have to be validated under real operating conditions.</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/80 p-3 space-y-2">
              <p className="font-semibold text-foreground">Airspace & UTM</p>
              <p className="text-muted-foreground leading-5">Coordination systems and flight-management overhead may add cost beyond the benchmarked base stack.</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/80 p-3 space-y-2">
              <p className="font-semibold text-foreground">Partner Economics</p>
              <p className="text-muted-foreground leading-5">The 65% partner-led model must prove its true margin take and support-cost burden before scale economics are trusted.</p>
            </div>
          </div>
        </div>

        {scaleGlidePath && (
          <div className="rounded-xl bg-background/70 p-3 border border-dashed border-border/60 space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Glide Path To Profitability</p>
            <p className="text-xs leading-5 text-foreground/90">
              The scale case improves from {formatPreciseCurrency(scaleGlidePath.pilotUnitCost)} per delivery in the pilot to {formatPreciseCurrency(scaleGlidePath.scaleUnitCost)} in the commercial model. That glide path depends on +{Math.round(scaleGlidePath.throughputLift)} deliveries/day per drone, {formatPreciseCurrency(scaleGlidePath.fixedCostRelief)} of fixed-cost absorption relief, +{Math.round(scaleGlidePath.automationLift)} percentage points of automation, and +{Math.round(scaleGlidePath.idleTimeLift)} percentage points of idle-time reduction.
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              {scaleGlidePath.targetGap <= 0
                ? `The current scale model already clears the sub-AED 30 target by ${formatPreciseCurrency(Math.abs(scaleGlidePath.targetGap))} per delivery, but it still depends on sustained demand and partner readiness.`
                : `The current scale model still needs ${formatPreciseCurrency(scaleGlidePath.targetGap)} per delivery of additional improvement to clear the sub-AED 30 target with confidence.`}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800" data-testid="operational-intelligence">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Operational Intelligence
        </CardTitle>
        <p className="text-xs text-muted-foreground">Driver-based model analytics, risk thresholds &amp; margin profile</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {stagedEconomics && (
          <div className="space-y-3 rounded-2xl border border-primary/15 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(241,245,249,0.65))] p-4 dark:border-primary/20 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.6),rgba(15,23,42,0.35))]">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">Commercial Framing</p>
                <h4 className="mt-1 text-sm font-semibold">{activeFinancialView === 'pilot' ? 'Pilot Validation Economics' : 'Pilot Case vs Full Commercial Case'}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{activeFinancialView === 'pilot'
                  ? 'This view is intentionally limited to pilot revenue recognition, unit cost, contracted demand, and gate controls. Full commercial economics are kept out of the main pilot narrative and should be treated as appendix material.'
                  : 'The business case now separates partner-led validation economics from full-network economics so you can see what is being proven first and what only activates after formal scale approval.'}</p>
              </div>
              {activeFinancialView !== 'pilot' && (
                <Badge variant="outline" className={stagedEconomics.expansionDecision === 'GO' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300'}>
                  {stagedEconomics.expansionDecision === 'GO' ? 'Expansion Approved' : 'STOP Expansion'}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {activeFinancialView === 'pilot' && renderStageCard('Active View: Pilot Case', activeStageEconomics ?? stagedEconomics.pilotCase, 'pilot')}
              {activeFinancialView === 'full' && renderStageCard('Active View: Full Commercial Case', activeStageEconomics ?? stagedEconomics.scaleCase, 'scale')}
              {!activeFinancialView && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {renderStageCard('Layer A: Pilot Case', stagedEconomics.pilotCase, 'pilot')}
                  {renderStageCard('Layer B: Full Commercial Case', stagedEconomics.scaleCase, 'scale')}
                </div>
              )}
            </div>

            {activeFinancialView === 'pilot' ? (
              <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pilot-only Framing</p>
                <p className="mt-1 text-xs leading-5 text-foreground/90">This pilot view is deliberately bounded to pilot economics, pilot controls, and pilot evidence targets. It does not rely on future scale economics to justify the current approval decision.</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Narrative</p>
                  <p className="mt-1 text-xs leading-5 text-foreground/90">{stagedEconomics.narrative}</p>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Enforcement</p>
                  <p className="mt-1 text-xs leading-5 text-foreground/90">{stagedEconomics.enforcementSummary}</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Row 1: EBITDA Margin Trend + Revenue Segmentation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* EBITDA Margin Chart */}
          {activeFinancialView !== 'pilot' && derivedMargins.length > 0 && (
            <div className="space-y-2 p-3 rounded-xl bg-muted/20 border border-border/50">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">EBITDA &amp; Net Margin</p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 rounded inline-block" />EBITDA</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 rounded inline-block" />Net</span>
                </div>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={derivedMargins.map(m => ({ name: `Y${m.year}`, ebitda: m.ebitdaMargin, net: m.netMargin }))} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ebitdaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} domain={[0, 80]} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="6 3" strokeOpacity={0.5} label={{ value: '40% target', position: 'right', fontSize: 9, fill: '#f59e0b' }} />
                    <Area type="monotone" dataKey="ebitda" fill="url(#ebitdaGrad)" stroke="none" />
                    <Line type="monotone" dataKey="ebitda" name="EBITDA %" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
                    <Line type="monotone" dataKey="net" name="Net %" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} strokeDasharray="6 3" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                <span>Y5 EBITDA: <span className="font-bold text-emerald-600">{derivedMargins[derivedMargins.length - 1]?.ebitdaMargin.toFixed(1)}%</span></span>
                <span>Y5 Net: <span className="font-bold text-blue-600">{derivedMargins[derivedMargins.length - 1]?.netMargin.toFixed(1)}%</span></span>
              </div>
            </div>
          )}

          {/* Revenue Segmentation */}
          {revenueSegmentation && (
            <div className="space-y-3 p-3 rounded-xl bg-muted/20 border border-border/50">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Revenue Segmentation</p>
              <div className="space-y-3">
                {revenueSegmentation.map((seg, i) => {
                  const weightedContrib = seg.share;
                  return (
                    <div key={seg.segment} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: segmentColors[i] }} />
                          <span className="text-xs font-medium">{seg.segment}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground">AED {seg.fare}</span>
                          <span className="font-bold">{seg.share}%</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${weightedContrib}%`, backgroundColor: segmentColors[i] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pt-2 border-t border-border/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Weighted Average Fare</span>
                  <span className="font-bold">AED {revenueSegmentation.reduce((s, seg) => s + seg.fare * seg.share / 100, 0).toFixed(0)}</span>
                </div>
              </div>
            </div>
          )}

          {/* If no revenue segmentation, show ramp schedule instead */}
          {activeFinancialView !== 'pilot' && !revenueSegmentation && driverModel?.rampSchedule && (
            <div className="space-y-2 p-3 rounded-xl bg-muted/20 border border-border/50">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Fleet Ramp Schedule</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={driverModel.rampSchedule.map(r => ({ name: `Y${r.year}`, active: Math.round(r.fleetActive * 100), util: Math.round(r.utilization * 100), deliveries: r.deliveries }))} margin={{ top: 8, right: 30, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={formatCompactNumber} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                    <Bar yAxisId="right" dataKey="deliveries" name="Deliveries/yr" fill="#8b5cf6" fillOpacity={0.3} barSize={20} radius={[3, 3, 0, 0]} />
                    <Line yAxisId="left" type="monotone" dataKey="active" name="Fleet Active %" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
                    <Line yAxisId="left" type="monotone" dataKey="util" name="Utilization %" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} strokeDasharray="6 3" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

        </div>

        {/* Row 2: Kill Switch Metrics + Risk-Adjusted NPV */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Kill Switch Metrics */}
          {killSwitch && (
            <div className="space-y-3 p-3 rounded-xl bg-muted/20 border border-border/50">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Kill Switch Metrics</p>
                <Badge
                  variant={killSwitch.pilotGateStatus === 'PASS' ? 'default' : killSwitch.pilotGateStatus === 'CONDITIONAL' ? 'secondary' : 'destructive'}
                  className={`text-[10px] h-5 ${killSwitch.pilotGateStatus === 'PASS' ? 'bg-emerald-500' : killSwitch.pilotGateStatus === 'CONDITIONAL' ? 'bg-amber-500' : ''}`}
                >
                  {killSwitch.pilotGateStatus}
                </Badge>
              </div>
              <div className="space-y-2">
                {killSwitchThresholds.map((t, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-muted/30 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {t.met ? (
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : t.critical ? (
                        <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}
                        <span className="text-xs truncate">{t.metric}</span>
                      </div>
                      {getKillSwitchAction(t.metric) && (
                        <p className="mt-1 pl-5 text-[10px] leading-4 text-muted-foreground">{getKillSwitchAction(t.metric)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] shrink-0">
                      <span className="text-muted-foreground">Target: {t.target}</span>
                      <span className={`font-bold ${t.met ? 'text-emerald-600' : 'text-red-600'}`}>{t.current}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk-Adjusted NPV */}
          {visibleRiskAnalysis && (
            <div className="space-y-3 p-3 rounded-xl bg-muted/20 border border-border/50">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Risk-Adjusted NPV</p>
              <div className="space-y-3">
                {([
                  { label: 'Base Case', rate: visibleRiskAnalysis.baseRate, npv: visibleRiskAnalysis.baseNpv, color: '#3b82f6' },
                  { label: 'Risk-Adjusted', rate: visibleRiskAnalysis.riskAdjustedRate, npv: visibleRiskAnalysis.riskAdjustedNpv, color: '#f59e0b' },
                  { label: 'Stress Test', rate: visibleRiskAnalysis.stressRate, npv: visibleRiskAnalysis.stressNpv, color: '#ef4444' },
                ]).map(scenario => {
                  const maxNpv = Math.max(Math.abs(visibleRiskAnalysis.baseNpv), Math.abs(visibleRiskAnalysis.stressNpv), 1);
                  const barWidth = Math.min(Math.abs(scenario.npv) / maxNpv * 100, 100);
                  return (
                    <div key={scenario.label} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: scenario.color }} />
                          <span className="text-xs font-medium">{scenario.label}</span>
                          <span className="text-[10px] text-muted-foreground">({scenario.rate}%)</span>
                        </div>
                        <span className={`text-xs font-bold ${scenario.npv >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(scenario.npv, 'AED', true)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%`, backgroundColor: scenario.npv >= 0 ? scenario.color : '#ef4444' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
                NPV remains {visibleRiskAnalysis.stressNpv >= 0 ? (
                  <span className="font-bold text-emerald-600">positive</span>
                ) : (
                  <span className="font-bold text-red-600">negative</span>
                )} under stress test at {visibleRiskAnalysis.stressRate}% discount rate
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
