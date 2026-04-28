// ──────────────────────────────────────────────────────────────────────────
// Strategic Decision Engine
// Fixes the core contradiction: when commercial economics fail their own
// investment gate, the recommendation must stop being "Hybrid Approach" and
// explicitly reconcile as one of four stances:
//   1) PROCEED_COMMERCIAL          — commercials pass gates
//   2) PROCEED_AS_STRATEGIC_PILOT  — public-value justification, not commercial
//   3) RESTRUCTURE_BEFORE_PROCEED  — identified levers can close the gap
//   4) PAUSE_AND_REDESIGN          — economics + strategic case both too weak
//
// Then layers the boardroom-grade decision support the reviewer called out:
//   • Unit economics (per-drone / per-delivery / break-even)
//   • Value recovery bridge (levers → AED impact → residual gap)
//   • Public-value anchor (Dubai RTA AV strategy alignment, measurable)
//   • Vendor & liability ownership (RACI for AV programs)
//   • Kill criteria ladder (stop/go financial thresholds per stage)
// ──────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Ban,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Compass,
  Flag,
  Gauge,
  Handshake,
  Landmark,
  Scale,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import {
  ValueRecoveryBridge,
  buildTransformationValueLevers,
  type ValueLever,
} from "@/modules/demand/components/shared/ValueRecoveryBridge";

// ══════════════════════════════════════════════════════════════════════════
// Decision reconciliation — pure function
// ══════════════════════════════════════════════════════════════════════════

export type ReconciledStance =
  | "PROCEED_COMMERCIAL"
  | "PROCEED_AS_STRATEGIC_PILOT"
  | "RESTRUCTURE_BEFORE_PROCEED"
  | "PAUSE_AND_REDESIGN";

export interface ReconciliationInputs {
  roiPercent: number | null;
  npvAed: number | null;
  paybackYears: number | null;
  strategicAlignmentScore: number | null; // 0-100
  publicValueScore: number | null; // 0-100
  recoveryFeasibilityScore: number | null; // 0-100
  approvalScope?: string | null; // e.g. "PILOT_ONLY"
  overallRiskLevel?: string | null;
}

export interface ReconciledDecision {
  stance: ReconciledStance;
  label: string;
  subLabel: string;
  rationale: string;
  tone: string; // tailwind tone class for cards
  icon: typeof CheckCircle2;
  financialGatePass: boolean;
  strategicGatePass: boolean;
  conflictResolution: string;
}

export function reconcileStrategicDecision(input: ReconciliationInputs): ReconciledDecision {
  const roi = Number.isFinite(input.roiPercent) ? Number(input.roiPercent) : NaN;
  const npv = Number.isFinite(input.npvAed) ? Number(input.npvAed) : NaN;
  const strategic = Number.isFinite(input.strategicAlignmentScore) ? Number(input.strategicAlignmentScore) : NaN;
  const publicValue = Number.isFinite(input.publicValueScore) ? Number(input.publicValueScore) : NaN;
  const recovery = Number.isFinite(input.recoveryFeasibilityScore) ? Number(input.recoveryFeasibilityScore) : NaN;

  const financialGatePass = Number.isFinite(roi) && roi >= 0 && Number.isFinite(npv) && npv >= 0;
  const strategicGatePass = Number.isFinite(strategic) && strategic >= 65;
  const publicValueStrong = Number.isFinite(publicValue) && publicValue >= 60;
  const recoveryFeasible = Number.isFinite(recovery) && recovery >= 50;

  if (financialGatePass) {
    return {
      stance: "PROCEED_COMMERCIAL",
      label: "Proceed — Commercial Investment",
      subLabel: "Passes its own financial gate",
      rationale: `ROI ${roi.toFixed(1)}% and NPV ${(npv / 1_000_000).toFixed(1)}M AED clear the commercial threshold. Proceed as a standard commercial investment with disciplined delivery governance.`,
      tone: "border-emerald-500/50 bg-emerald-500/5",
      icon: CheckCircle2,
      financialGatePass,
      strategicGatePass,
      conflictResolution:
        strategicGatePass && Number.isFinite(strategic)
          ? `Financial (pass) and strategic (${strategic.toFixed(0)}%) gates align — no contradiction.`
          : "Financial gate passes on its own merits.",
    };
  }

  if (strategicGatePass && publicValueStrong && (input.approvalScope === "PILOT_ONLY" || !financialGatePass)) {
    return {
      stance: "PROCEED_AS_STRATEGIC_PILOT",
      label: "Proceed — Strategic Pilot Only",
      subLabel: "Public-value justification, not commercial",
      rationale:
        "Do not proceed as a commercial program. Proceed as a government-backed strategic pilot under an explicit public-value mandate: bounded scope, public funding or subsidy model, hard stop at pilot gate unless economics are rewritten. Scale release requires a restructured commercial model or permanent subsidy instrument.",
      tone: "border-sky-500/50 bg-sky-500/5",
      icon: Landmark,
      financialGatePass,
      strategicGatePass,
      conflictResolution: `Financial gate fails (ROI ${Number.isFinite(roi) ? roi.toFixed(1) : "—"}%, NPV ${Number.isFinite(npv) ? (npv / 1_000_000).toFixed(1) : "—"}M AED) but strategic alignment (${strategic.toFixed(0)}%) and public value (${publicValue.toFixed(0)}%) justify a pilot under public-value framing. Do NOT classify as a commercial investment.`,
    };
  }

  if (recoveryFeasible && Number.isFinite(strategic) && strategic >= 50) {
    return {
      stance: "RESTRUCTURE_BEFORE_PROCEED",
      label: "Restructure — Before Any Funding Release",
      subLabel: "Levers exist to reach viability",
      rationale:
        "Do not release capital at today's economics. Restructure first: apply the identified recovery levers (utilization, pricing, cost removal, vendor co-investment, subsidy) and require the restructured model to clear the financial gate before any mobilization tranche.",
      tone: "border-amber-500/50 bg-amber-500/5",
      icon: Scale,
      financialGatePass,
      strategicGatePass,
      conflictResolution: `Financial gate fails but ${recovery.toFixed(0)}% of the gap is addressable through named levers. Require a restructured financial model before capital release.`,
    };
  }

  return {
    stance: "PAUSE_AND_REDESIGN",
    label: "Pause — Redesign the Initiative",
    subLabel: "Neither commercial nor strategic case holds",
    rationale:
      "Pause the initiative. Neither the financial case nor the strategic/public-value case clears a credible gate. Redesign scope, business model, or sponsorship basis before re-submitting to governance.",
    tone: "border-rose-500/50 bg-rose-500/5",
    icon: Ban,
    financialGatePass,
    strategicGatePass,
    conflictResolution:
      "Contradictions in the current recommendation cannot be reconciled: economics fail and strategic/public-value evidence is not strong enough to carry the decision.",
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 1. StrategicDecisionReconciliation — resolves the contradiction up front
// ══════════════════════════════════════════════════════════════════════════

const STANCE_VISUALS: Record<
  ReconciledStance,
  { accent: string; chipTone: string; actionLabel: string }
> = {
  PROCEED_COMMERCIAL: {
    accent: "text-emerald-700 dark:text-emerald-300",
    chipTone: "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    actionLabel: "APPROVE · COMMERCIAL",
  },
  PROCEED_AS_STRATEGIC_PILOT: {
    accent: "text-sky-700 dark:text-sky-300",
    chipTone: "border-sky-500/60 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    actionLabel: "APPROVE · STRATEGIC PILOT",
  },
  RESTRUCTURE_BEFORE_PROCEED: {
    accent: "text-amber-700 dark:text-amber-300",
    chipTone: "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    actionLabel: "RESTRUCTURE FIRST",
  },
  PAUSE_AND_REDESIGN: {
    accent: "text-rose-700 dark:text-rose-300",
    chipTone: "border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    actionLabel: "PAUSE · REDESIGN",
  },
};

export function StrategicDecisionReconciliation({
  decision,
  legacyRouteLabel,
  financialScore,
  strategicScore,
}: {
  decision: ReconciledDecision;
  legacyRouteLabel?: string | null;
  financialScore?: number | null;
  strategicScore?: number | null;
}) {
  const visual = STANCE_VISUALS[decision.stance];
  const Icon = decision.icon;
  const actionLabel = visual.actionLabel;
  const showConflict =
    Number.isFinite(financialScore as number)
    && Number.isFinite(strategicScore as number)
    && Math.abs((financialScore as number) - (strategicScore as number)) >= 20;

  return (
    <Card className={`border-2 ${decision.tone} shadow-sm`}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`rounded-xl border-2 ${decision.tone.replace("bg-", "bg-")} p-2`}>
              <Icon className={`h-7 w-7 ${visual.accent}`} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Investment Decision
                </span>
                <Badge variant="outline" className={`font-bold ${visual.chipTone}`}>
                  {actionLabel}
                </Badge>
              </div>
              <h3 className={`mt-1 text-xl font-bold leading-tight ${visual.accent}`}>
                {decision.label}
              </h3>
              <p className="text-sm text-muted-foreground">{decision.subLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GateChip pass={decision.financialGatePass} label="Financial Gate" />
            <GateChip pass={decision.strategicGatePass} label="Strategic Gate" />
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-foreground/90">{decision.rationale}</p>

        {showConflict ? (
          <div className="mt-3 rounded-lg border border-dashed border-foreground/20 bg-background/60 p-3 text-xs">
            <div className="mb-1 flex items-center gap-1.5 font-semibold uppercase tracking-wider text-muted-foreground">
              <Scale className="h-3.5 w-3.5" /> Conflict resolution — Financial {financialScore}% vs Strategic {strategicScore}%
            </div>
            <p className="text-foreground/80">{decision.conflictResolution}</p>
          </div>
        ) : decision.conflictResolution ? (
          <p className="mt-2 text-xs italic text-muted-foreground">
            <Scale className="mr-1 inline h-3 w-3" /> {decision.conflictResolution}
          </p>
        ) : null}

        {legacyRouteLabel && legacyRouteLabel.toLowerCase() !== decision.label.toLowerCase() ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-foreground/10 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider">Supersedes prior output:</span>
            <span className="line-through opacity-70">{legacyRouteLabel}</span>
            <ArrowRight className="h-3 w-3" />
            <span className={`font-semibold ${visual.accent}`}>{decision.label}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function GateChip({ pass, label }: { pass: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold ${
        pass
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300"
      }`}
    >
      {pass ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 2. UnitEconomicsPanel — per-unit logic, not totals
// ══════════════════════════════════════════════════════════════════════════

export interface UnitEconomicsInput {
  fleetSize?: number | null;
  dailyDeliveriesPerUnit?: number | null;
  annualDeliveries?: number | null;
  revenuePerDelivery?: number | null;
  variableCostPerDelivery?: number | null;
  fixedCostPerDelivery?: number | null;
  contributionMarginPerDelivery?: number | null;
  effectiveCostPerDelivery?: number | null;
  annualFixedCost?: number | null;
  automationRate?: number | null;
  contractedVolumeShare?: number | null;
  scaleDailyDeliveriesPerUnit?: number | null;
  scaleEffectiveCost?: number | null;
  assetNoun?: string; // "drone" | "AV" | "vehicle"
}

export function UnitEconomicsPanel({ input }: { input: UnitEconomicsInput }) {
  const asset = input.assetNoun ?? "unit";
  const revenue = Number(input.revenuePerDelivery);
  const varCost = Number(input.variableCostPerDelivery);
  const fixedCost = Number(input.fixedCostPerDelivery);
  const effectiveCost = Number.isFinite(input.effectiveCostPerDelivery)
    ? Number(input.effectiveCostPerDelivery)
    : varCost + fixedCost;
  const margin = Number.isFinite(input.contributionMarginPerDelivery)
    ? Number(input.contributionMarginPerDelivery)
    : revenue - effectiveCost;

  const fleet = Number(input.fleetSize);
  const annualFixed = Number(input.annualFixedCost);
  const varCostSafe = Number.isFinite(varCost) ? varCost : 0;
  const revSafe = Number.isFinite(revenue) ? revenue : 0;
  const unitMargin = revSafe - varCostSafe;
  const breakEvenDeliveriesPerDayPerUnit =
    unitMargin > 0 && Number.isFinite(annualFixed) && Number.isFinite(fleet) && fleet > 0
      ? annualFixed / unitMargin / fleet / 365
      : null;

  const currentDailyPerUnit = Number(input.dailyDeliveriesPerUnit);
  const scaleDailyPerUnit = Number(input.scaleDailyDeliveriesPerUnit);
  const utilizationVsScale = Number.isFinite(scaleDailyPerUnit) && scaleDailyPerUnit > 0 && Number.isFinite(currentDailyPerUnit)
    ? (currentDailyPerUnit / scaleDailyPerUnit) * 100
    : null;

  // Empty-state detection: nothing usable at all.
  const hasAnyUsableSignal =
    Number.isFinite(fleet)
    || Number.isFinite(currentDailyPerUnit)
    || Number.isFinite(revenue)
    || Number.isFinite(effectiveCost)
    || Number.isFinite(margin)
    || Number.isFinite(annualFixed);

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-1.5 pt-3 px-4">
        <CardTitle className="flex items-center gap-2 text-xs">
          <Gauge className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span className="uppercase tracking-wider">
            Unit Economics · Per-{asset} Logic
          </span>
          <Badge variant="outline" className="ml-auto text-[10px] font-normal normal-case">
            executives decide on per-unit, not totals
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-3 pt-0">
        {!hasAnyUsableSignal ? (
          <div className="rounded-md border border-dashed border-foreground/20 bg-muted/30 p-4 text-center">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold">Unit economics not yet modeled for this business case</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Populate the business case driver model (fleet size, daily throughput per unit, revenue and cost per transaction) or the
              staged pilot economics to unlock per-{asset} break-even and utilization analytics here.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <MetricTile
                label={`Fleet (${asset}s)`}
                value={Number.isFinite(fleet) ? fleet.toLocaleString() : "—"}
                tone="text-blue-700 dark:text-blue-300"
                icon={Building2}
              />
              <MetricTile
                label={`Deliveries / ${asset} / day`}
                value={Number.isFinite(currentDailyPerUnit) ? currentDailyPerUnit.toFixed(1) : "—"}
                sublabel={Number.isFinite(scaleDailyPerUnit) ? `target ${scaleDailyPerUnit.toFixed(0)} @ scale` : undefined}
                tone="text-indigo-700 dark:text-indigo-300"
                icon={Zap}
              />
              <MetricTile
                label="Revenue / delivery"
                value={Number.isFinite(revenue) ? `AED ${revenue.toFixed(1)}` : "—"}
                tone="text-emerald-700 dark:text-emerald-300"
                icon={Coins}
              />
              <MetricTile
                label="Effective cost / delivery"
                value={Number.isFinite(effectiveCost) ? `AED ${effectiveCost.toFixed(1)}` : "—"}
                sublabel={
                  Number.isFinite(varCost) && Number.isFinite(fixedCost)
                    ? `var ${varCost.toFixed(1)} + fixed ${fixedCost.toFixed(1)}`
                    : undefined
                }
                tone="text-rose-700 dark:text-rose-300"
                icon={ArrowDownRight}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <MetricTile
                label="Contribution margin / delivery"
                value={Number.isFinite(margin) ? `AED ${margin.toFixed(1)}` : "—"}
                tone={margin >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}
                icon={margin >= 0 ? ArrowUpRight : ArrowDownRight}
                emphasized
              />
              <MetricTile
                label={`Break-even / ${asset} / day`}
                value={breakEvenDeliveriesPerDayPerUnit !== null ? breakEvenDeliveriesPerDayPerUnit.toFixed(1) : "margin negative"}
                sublabel={
                  breakEvenDeliveriesPerDayPerUnit !== null && Number.isFinite(currentDailyPerUnit)
                    ? currentDailyPerUnit >= breakEvenDeliveriesPerDayPerUnit
                      ? "current throughput clears break-even"
                      : `gap of ${(breakEvenDeliveriesPerDayPerUnit - currentDailyPerUnit).toFixed(1)} / day`
                    : "negative unit margin — no throughput closes the gap"
                }
                tone={
                  breakEvenDeliveriesPerDayPerUnit !== null
                  && Number.isFinite(currentDailyPerUnit)
                  && currentDailyPerUnit >= breakEvenDeliveriesPerDayPerUnit
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-amber-700 dark:text-amber-300"
                }
                icon={Target}
                emphasized
              />
              <MetricTile
                label="Utilization vs scale target"
                value={utilizationVsScale !== null ? `${utilizationVsScale.toFixed(0)}%` : "—"}
                sublabel={
                  Number.isFinite(input.contractedVolumeShare)
                    ? `contracted ${Math.round(Number(input.contractedVolumeShare) * 100)}%`
                    : undefined
                }
                tone="text-violet-700 dark:text-violet-300"
                icon={TrendingUp}
                emphasized
              />
            </div>

            {Number.isFinite(input.automationRate) ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-[11px]">
                <span className="font-semibold uppercase tracking-wider text-muted-foreground">Automation rate</span>
                <Progress value={Number(input.automationRate) * 100} className="h-1.5 flex-1" />
                <span className="font-bold">{Math.round(Number(input.automationRate) * 100)}%</span>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  sublabel,
  tone,
  icon: Icon,
  emphasized,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  tone: string;
  icon: typeof CheckCircle2;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${emphasized ? "border-2" : ""} bg-background/60`}
    >
      <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={`mt-1 text-lg font-bold ${tone}`}>{value}</div>
      {sublabel ? <div className="text-[10px] text-muted-foreground">{sublabel}</div> : null}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 4. PublicValueAnchor — measurable, defensible public value
// ══════════════════════════════════════════════════════════════════════════

export interface PublicValueMetric {
  id: string;
  label: string;
  value: string;
  anchor: string; // e.g. policy / strategy reference
  direction: "positive" | "neutral" | "negative";
  icon: typeof Flag;
}

export function PublicValueAnchor({
  metrics,
  strategyAnchors,
}: {
  metrics: PublicValueMetric[];
  strategyAnchors: Array<{ title: string; detail: string }>;
}) {
  if (!metrics.length && !strategyAnchors.length) return null;
  return (
    <Card className="border-sky-500/30 bg-sky-500/5">
      <CardHeader className="pb-1.5 pt-3 px-4">
        <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-wider">
          <Landmark className="h-3.5 w-3.5 text-sky-700 dark:text-sky-300" />
          Public Value Anchor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-3 pt-0">
        {strategyAnchors.length ? (
          <div className="rounded-lg border border-sky-500/20 bg-background/60 p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Strategic alignment
            </div>
            <ul className="space-y-1.5 text-xs">
              {strategyAnchors.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Compass className="mt-0.5 h-3 w-3 flex-shrink-0 text-sky-600 dark:text-sky-300" />
                  <div>
                    <span className="font-semibold">{a.title}</span>
                    <span className="ml-1 text-muted-foreground">— {a.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {metrics.length ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {metrics.map((m) => {
              const MIcon = m.icon;
              const tone =
                m.direction === "positive" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : m.direction === "negative" ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                : "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
              return (
                <div key={m.id} className={`rounded-lg border p-2.5 ${tone}`}>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider opacity-90">
                    <MIcon className="h-3.5 w-3.5" /> {m.label}
                  </div>
                  <div className="mt-1 text-lg font-bold">{m.value}</div>
                  <div className="text-[10px] opacity-80">{m.anchor}</div>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 5. VendorOwnershipMatrix — who owns stack, data, liability
// ══════════════════════════════════════════════════════════════════════════

export interface OwnershipRow {
  domain: string; // e.g. "AV / Drone Stack"
  accountableParty: string;
  responsibleParties: string[];
  consultedParties?: string[];
  informedParties?: string[];
  liabilityCarrier?: string;
  note?: string;
}

export function VendorOwnershipMatrix({ rows }: { rows: OwnershipRow[] }) {
  const [open, setOpen] = useState(true);
  if (!rows.length) return null;
  return (
    <Card className="border-violet-500/30 bg-violet-500/5">
      <CardHeader
        className="cursor-pointer pb-1.5 pt-3 px-4 hover:bg-violet-500/10"
        onClick={() => setOpen((p) => !p)}
      >
        <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-wider">
          <Handshake className="h-3.5 w-3.5 text-violet-700 dark:text-violet-300" />
          Vendor & Liability Ownership
          <Badge variant="outline" className="ml-2 border-violet-500/40 text-[10px] uppercase">
            critical in AV programs
          </Badge>
          <div className="ml-auto">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>
        </CardTitle>
      </CardHeader>
      {open ? (
        <CardContent className="px-4 pb-3 pt-0">
          <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <div
                key={i}
                className="rounded-lg border border-violet-500/20 bg-background/60 p-2.5"
              >
                {/* Row header: domain + liability */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold leading-tight">{row.domain}</div>
                    {row.note ? (
                      <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{row.note}</div>
                    ) : null}
                  </div>
                  {row.liabilityCarrier ? (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-rose-500/40 bg-rose-500/10 text-[10px] text-rose-700 dark:text-rose-300"
                    >
                      <Shield className="mr-1 h-3 w-3" />
                      {row.liabilityCarrier}
                    </Badge>
                  ) : (
                    <span className="shrink-0 text-[10px] italic text-muted-foreground">liability unresolved</span>
                  )}
                </div>

                {/* RACI grid */}
                <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">A</span>
                  <div>
                    <Badge variant="outline" className="border-violet-500/40 bg-background/60 text-[10px]">
                      {row.accountableParty}
                    </Badge>
                  </div>

                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">R</span>
                  <div className="flex flex-wrap gap-1">
                    {row.responsibleParties.map((p, j) => (
                      <Badge key={j} variant="outline" className="text-[10px]">
                        {p}
                      </Badge>
                    ))}
                  </div>

                  {(row.consultedParties && row.consultedParties.length > 0) ||
                  (row.informedParties && row.informedParties.length > 0) ? (
                    <>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">C/I</span>
                      <div className="text-[10px] leading-snug text-muted-foreground">
                        {row.consultedParties && row.consultedParties.length > 0 ? (
                          <div>
                            <span className="font-semibold">C:</span> {row.consultedParties.join(", ")}
                          </div>
                        ) : null}
                        {row.informedParties && row.informedParties.length > 0 ? (
                          <div>
                            <span className="font-semibold">I:</span> {row.informedParties.join(", ")}
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 6. KillCriteriaLadder — stop/go thresholds per stage
// ══════════════════════════════════════════════════════════════════════════

export interface StageGate {
  stage: string;
  horizon: string;
  goCriteria: string[];
  killCriteria: string[];
  independentReviewer?: string;
  currentStatus?: "GO" | "STOP" | "PENDING";
}

export function KillCriteriaLadder({ gates }: { gates: StageGate[] }) {
  const [open, setOpen] = useState(true);
  if (!gates.length) return null;
  return (
    <Card className="border-rose-500/30 bg-rose-500/5">
      <CardHeader
        className="cursor-pointer pb-1.5 pt-3 px-4 hover:bg-rose-500/10"
        onClick={() => setOpen((p) => !p)}
      >
        <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-wider">
          <Ban className="h-3.5 w-3.5 text-rose-700 dark:text-rose-300" />
          Kill Criteria Ladder
          <Badge variant="outline" className="ml-2 border-rose-500/40 text-[10px] uppercase">
            governance under pressure
          </Badge>
          <div className="ml-auto">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>
        </CardTitle>
      </CardHeader>
      {open ? (
        <CardContent className="space-y-2 px-4 pb-3 pt-0">
          {gates.map((gate, i) => {
            const statusTone =
              gate.currentStatus === "GO" ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : gate.currentStatus === "STOP" ? "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300"
              : "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
            return (
              <div key={i} className="rounded-lg border bg-background/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-xs font-bold text-rose-700 dark:text-rose-300">
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold">{gate.stage}</span>
                    <span className="text-[11px] text-muted-foreground">· {gate.horizon}</span>
                  </div>
                  {gate.currentStatus ? (
                    <Badge variant="outline" className={`text-[10px] ${statusTone}`}>
                      {gate.currentStatus}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> GO criteria
                    </div>
                    <ul className="mt-1 space-y-0.5 text-[11px]">
                      {gate.goCriteria.map((c, j) => (
                        <li key={j} className="flex items-start gap-1.5">
                          <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-emerald-600" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded border border-rose-500/20 bg-rose-500/5 p-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                      <XCircle className="h-3 w-3" /> KILL criteria
                    </div>
                    <ul className="mt-1 space-y-0.5 text-[11px]">
                      {gate.killCriteria.map((c, j) => (
                        <li key={j} className="flex items-start gap-1.5">
                          <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-rose-600" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {gate.independentReviewer ? (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span className="font-semibold uppercase tracking-wider">Independent reviewer:</span>
                    <span>{gate.independentReviewer}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      ) : null}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 7. Composed overlay — builds all inputs from the data already on the page
// ══════════════════════════════════════════════════════════════════════════

export interface StrategicDecisionOverlayInputs {
  businessCase: Record<string, unknown> | null | undefined;
  eaArtifact: Record<string, unknown> | null | undefined;
  strategicAlignmentScore: number | null;
  financialScore: number | null;
  legacyRouteLabel?: string | null;
  strategyAnchorOverrides?: Array<{ title: string; detail: string }>;
}

type StrategicProgramMode = "unit-economics" | "transformation";

interface StrategicProgramContext {
  mode: StrategicProgramMode;
  archetypeLabel: string;
  initiativeLabel: string;
  assetNoun: string;
}

export function StrategicDecisionOverlay({ inputs }: { inputs: StrategicDecisionOverlayInputs }) {
  return <StrategicDecisionEngine inputs={inputs} />;
}

/**
 * Hook that does the data crunching so callers can place the pieces
 * (headline banner, unit economics, 3-pillar, extended analysis) wherever
 * they want on the page. Returned values are stable per input identity.
 */
export function useStrategicDecisionComputation(inputs: StrategicDecisionOverlayInputs) {
  return useMemo(() => {
    const bc = (inputs.businessCase ?? {}) as Record<string, unknown>;
    const cfm = (bc.computedFinancialModel ?? {}) as Record<string, unknown>;
    const metrics = (cfm.metrics ?? {}) as Record<string, unknown>;
    const views = (cfm.financialViews ?? {}) as Record<string, unknown>;
    const pilotView = (views.pilot ?? {}) as Record<string, unknown>;
    const pilotMetrics = (pilotView.metrics ?? {}) as Record<string, unknown>;
    const driverModel = (cfm.driverModel ?? {}) as Record<string, unknown>;
    const staged = (driverModel.stagedEconomics ?? {}) as Record<string, unknown>;
    const pilotCase = (staged.pilotCase ?? {}) as Record<string, unknown>;
    const scaleCase = (staged.scaleCase ?? {}) as Record<string, unknown>;
    const decision = (cfm.decision ?? {}) as Record<string, unknown>;
    const context = detectStrategicProgramContext(bc, cfm, pilotCase, scaleCase);

    const roiPercent = num(pilotMetrics.roi ?? metrics.roi ?? bc.roiPercentage);
    const npvAed = num(pilotMetrics.npv ?? metrics.npv ?? bc.npvValue);
    const totalInvestment = num(pilotView.upfrontInvestment ?? bc.initialInvestmentEstimate ?? bc.totalCostEstimate);
    const approvalScope = typeof decision.approvalScope === "string" ? decision.approvalScope : null;
    const overallRiskLevel =
      typeof (inputs.eaArtifact as Record<string, unknown> | null | undefined)?.riskImpactDashboard === "object"
        ? String(
            ((inputs.eaArtifact as Record<string, unknown>).riskImpactDashboard as Record<string, unknown>)
              .overallRiskLevel ?? "",
          )
        : null;

    const strategic = inputs.strategicAlignmentScore ?? null;
    const publicValueScore = estimatePublicValueScore(bc, inputs.eaArtifact as Record<string, unknown> | null | undefined);
    const recoveryFeasibilityScore = estimateRecoveryFeasibility(pilotCase, scaleCase);

    const reconciled = reconcileStrategicDecision({
      roiPercent: Number.isFinite(roiPercent) ? roiPercent : null,
      npvAed: Number.isFinite(npvAed) ? npvAed : null,
      paybackYears: null,
      strategicAlignmentScore: strategic,
      publicValueScore,
      recoveryFeasibilityScore,
      approvalScope,
      overallRiskLevel,
    });
    const stance = adaptDecisionForContext(
      reconciled,
      context,
      Number.isFinite(roiPercent) ? roiPercent : null,
      Number.isFinite(npvAed) ? npvAed : null,
      strategic,
      publicValueScore,
    );

    // Unit economics — pull primarily from pilotCase, but fall back to
    // any top-level computed financial model hints so the panel never
    // renders completely empty for non-drone business cases.
    const unitInput = context.mode === "unit-economics"
      ? resolveUnitEconomics(bc, pilotCase, scaleCase, cfm)
      : null;

    const gap = Number.isFinite(npvAed) && npvAed < 0 ? Math.abs(npvAed) : 0;
    const levers = context.mode === "unit-economics"
      ? buildValueLevers(pilotCase, scaleCase, totalInvestment)
      : buildTransformationValueLevers(gap, totalInvestment, context.initiativeLabel);
    const pvMetrics = buildPublicValueMetrics(publicValueScore, strategic, context);
    const strategyAnchors = inputs.strategyAnchorOverrides ?? defaultStrategyAnchors(context);
    const ownership = buildOwnershipMatrix(context);

    const scaleGateStatus =
      (num(scaleCase.dailyDeliveriesPerDrone) ?? 0) >= 110
      && (num(scaleCase.effectiveCostPerDelivery) ?? Infinity) <= 30
      && (num(scaleCase.contractedVolumeShare) ?? 0) >= 0.65
        ? "GO"
        : "STOP";
    const gates: StageGate[] = [
      {
        stage: "Pilot Mobilization Gate",
        horizon: "Months 0-3",
        currentStatus: approvalScope === "PILOT_ONLY" ? "GO" : "PENDING",
        goCriteria: [
          "Bounded pilot mobilization budget ring-fenced with tranche release",
          "Regulatory authorization obtained (RTA AV / DCAA drone airspace)",
          "Vendor accountability, data-ownership, and liability clauses signed",
          "Independent safety assurance reviewer appointed",
        ],
        killCriteria: [
          "Regulatory authorization denied or materially delayed",
          "No liability carrier willing to write the pilot exposure",
          "Mobilization cost overshoots pilot envelope by >15%",
        ],
        independentReviewer: "EA + Security Steering + RTA observer",
      },
      {
        stage: "Pilot Evidence Gate",
        horizon: "Months 3-9",
        currentStatus: "PENDING",
        goCriteria: [
          "Validated safety + service-reliability evidence across corridor",
          "Unit cost glide path credible toward ≤ AED 30 / delivery at scale",
          "Contracted demand reaches the pilot minimum volume share",
          "Public-value metrics (safety, congestion, data) tracked and recorded",
        ],
        killCriteria: [
          "Safety incident rate exceeds pilot tolerance",
          "Unit cost glide path does not bend toward ≤ AED 30",
          "Contracted demand falls below floor threshold",
        ],
        independentReviewer: "Safety Authority + Transformation Office",
      },
      {
        stage: "Scale Release Gate",
        horizon: "Year 2+",
        currentStatus: scaleGateStatus,
        goCriteria: [
          "Daily deliveries / drone ≥ 110",
          "Effective cost / delivery ≤ AED 30",
          "Contracted volume share ≥ 65%",
          "Either commercial NPV positive OR permanent public-value subsidy in place",
        ],
        killCriteria: [
          "Any hard scale gate failed",
          "Residual NPV negative and no subsidy instrument confirmed",
          "Safety or liability posture materially worse than pilot",
        ],
        independentReviewer: "Board + External Audit Review",
      },
    ];

    const transformationGates: StageGate[] = [
      {
        stage: "Architecture & Scope Gate",
        horizon: "Mobilization",
        currentStatus: (strategic ?? 0) >= 65 ? "GO" : "PENDING",
        goCriteria: [
          "Target scope, operating model, and success measures signed off",
          "Architecture, security, and data-governance controls approved",
          "Funding tied to milestone release rather than full-envelope commitment",
        ],
        killCriteria: [
          "No agreed scope boundary or benefits owner",
          "Critical architecture or security controls unresolved",
          "Funding requested without phased-release controls",
        ],
        independentReviewer: "EA + Security + PMO",
      },
      {
        stage: "MVP Release Gate",
        horizon: "Initial deployment",
        currentStatus: "PENDING",
        goCriteria: [
          "Core capabilities live for the first operational cohort",
          "Adoption, data quality, and service KPI baselines captured",
          "Integration and change-management risks within tolerance",
        ],
        killCriteria: [
          "Adoption materially below threshold",
          "Critical integration defects persist beyond stabilization window",
          "Benefits tracking cannot be evidenced with live measures",
        ],
        independentReviewer: "Transformation sponsor + Service owner",
      },
      {
        stage: "Benefits Realization Gate",
        horizon: "Scale release",
        currentStatus: Number.isFinite(roiPercent) && roiPercent >= 0 ? "GO" : "PENDING",
        goCriteria: [
          "Benefits realization trend supports the approved business case",
          "Operating metrics and customer outcomes improve versus baseline",
          "Next-wave funding justified by measured outcomes, not forecast only",
        ],
        killCriteria: [
          "Benefits remain materially below re-baselined targets",
          "Operating cost or change burden exceeds governance tolerance",
          "No evidence that broader rollout improves strategic outcomes",
        ],
        independentReviewer: "Executive steering committee",
      },
    ];

    return {
      context,
      stance,
      unitInput,
      gap,
      levers,
      pvMetrics,
      strategyAnchors,
      ownership,
      gates: context.mode === "unit-economics" ? gates : transformationGates,
      roiPercent: Number.isFinite(roiPercent) ? roiPercent : null,
      npvAed: Number.isFinite(npvAed) ? npvAed : null,
    };
  }, [inputs]);
}

/**
 * Headline: reconciliation banner + unit economics panel.
 * Place this directly after the Executive Decision Hero.
 */
export function StrategicDecisionHeadline({ inputs }: { inputs: StrategicDecisionOverlayInputs }) {
  const computed = useStrategicDecisionComputation(inputs);
  return (
    <div className="space-y-3" data-testid="strategic-decision-headline">
      <StrategicDecisionReconciliation
        decision={computed.stance}
        legacyRouteLabel={inputs.legacyRouteLabel}
        financialScore={inputs.financialScore}
        strategicScore={inputs.strategicAlignmentScore}
      />
      {computed.unitInput ? <UnitEconomicsPanel input={computed.unitInput} /> : null}
    </div>
  );
}

/**
 * Extended analysis stack: value recovery bridge, public value anchor,
 * vendor ownership, kill criteria ladder — rendered as a compact 2-column
 * professional grid on large screens.
 */
export function StrategicDecisionExtendedAnalysis({ inputs }: { inputs: StrategicDecisionOverlayInputs }) {
  const computed = useStrategicDecisionComputation(inputs);
  const [collapsed, setCollapsed] = useState(false);
  const STORAGE_KEY = "strategicFit.decisionEngine.extended.collapsed";
  const hasExtendedContent = computed.gap > 0;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);
  const toggle = () => {
    const v = !collapsed;
    setCollapsed(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  if (!hasExtendedContent) return null;
  return (
    <div className="space-y-3" data-testid="strategic-decision-extended">
      <div className="flex items-center justify-end">
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[10px]" onClick={toggle}>
          {collapsed ? (
            <>
              <ChevronDown className="h-3 w-3" /> expand
            </>
          ) : (
            <>
              <ChevronUp className="h-3 w-3" /> collapse
            </>
          )}
        </Button>
      </div>
      {!collapsed ? (
        <ValueRecoveryBridge gapAed={computed.gap} levers={computed.levers} horizonLabel={computed.context.mode === "unit-economics" ? "Pilot horizon" : "Program horizon"} />
      ) : null}
    </div>
  );
}

/** Legacy single-stack overlay (headline + extended under one toggle). */
function StrategicDecisionEngine({ inputs }: { inputs: StrategicDecisionOverlayInputs }) {
  const computed = useStrategicDecisionComputation(inputs);
  const [collapsed, setCollapsed] = useState(false);
  const STORAGE_KEY = "strategicFit.decisionEngine.collapsed";
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);
  const setCollapsedPersist = (v: boolean) => {
    setCollapsed(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-4" data-testid="strategic-decision-engine">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-300" />
          <span className="text-sm font-semibold text-foreground">
            Boardroom-Grade Strategic Decision Engine
          </span>
          <Badge variant="outline" className="text-[10px] uppercase">
            reconciliation · unit economics · recovery levers · public value · ownership · kill criteria
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[10px]"
          onClick={() => setCollapsedPersist(!collapsed)}
        >
          {collapsed ? (
            <>
              <ChevronDown className="h-3 w-3" />
              expand
            </>
          ) : (
            <>
              <ChevronUp className="h-3 w-3" />
              collapse all
            </>
          )}
        </Button>
      </div>

      <StrategicDecisionReconciliation
        decision={computed.stance}
        legacyRouteLabel={inputs.legacyRouteLabel}
        financialScore={inputs.financialScore}
        strategicScore={inputs.strategicAlignmentScore}
      />

      {!collapsed ? (
        <>
          {computed.unitInput ? <UnitEconomicsPanel input={computed.unitInput} /> : null}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {computed.gap > 0 ? (
              <ValueRecoveryBridge gapAed={computed.gap} levers={computed.levers} horizonLabel={computed.context.mode === "unit-economics" ? "Pilot horizon" : "Program horizon"} />
            ) : null}
            <PublicValueAnchor metrics={computed.pvMetrics} strategyAnchors={computed.strategyAnchors} />
            <VendorOwnershipMatrix rows={computed.ownership} />
            <KillCriteriaLadder gates={computed.gates} />
          </div>
        </>
      ) : null}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeProgramText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function formatAedCompact(value: number | null): string {
  if (!Number.isFinite(value)) return "—";
  const numeric = Number(value);
  const abs = Math.abs(numeric);
  if (abs >= 1_000_000) return `${(numeric / 1_000_000).toFixed(1)}M AED`;
  if (abs >= 1_000) return `${(numeric / 1_000).toFixed(0)}K AED`;
  return `${numeric.toFixed(0)} AED`;
}

function detectStrategicProgramContext(
  businessCase: Record<string, unknown>,
  computedFinancialModel: Record<string, unknown>,
  pilotCase: Record<string, unknown>,
  scaleCase: Record<string, unknown>,
): StrategicProgramContext {
  const archetypeLabel = normalizeProgramText(
    computedFinancialModel.archetype
      ?? businessCase.archetype
      ?? businessCase.businessCaseArchetype
      ?? businessCase.category
      ?? businessCase.projectType,
  ) || "Strategic Program";
  const initiativeLabel = normalizeProgramText(
    businessCase.projectName
      ?? businessCase.projectTitle
      ?? businessCase.title
      ?? businessCase.businessObjective,
  ) || "the initiative";

  const transformationHints = `${archetypeLabel} ${initiativeLabel}`.toLowerCase();
  const isTransformationProgram = [
    "digital transformation",
    "crm",
    "customer",
    "platform",
    "enterprise",
    "service modernization",
    "operating model",
  ].some((token) => transformationHints.includes(token));

  if (isTransformationProgram) {
    return {
      mode: "transformation",
      archetypeLabel,
      initiativeLabel,
      assetNoun: "program",
    };
  }

  const unitEconomics = (computedFinancialModel.unitEconomics ?? {}) as Record<string, unknown>;
  const hasUnitSignals = [
    pilotCase.fleetSize,
    pilotCase.dailyDeliveriesPerDrone,
    pilotCase.annualDeliveries,
    scaleCase.dailyDeliveriesPerDrone,
    unitEconomics.revenuePerDelivery,
    unitEconomics.fullyLoadedCostPerDelivery,
  ].some((value) => Number.isFinite(num(value)));

  return {
    mode: hasUnitSignals ? "unit-economics" : "transformation",
    archetypeLabel,
    initiativeLabel,
    assetNoun: hasUnitSignals ? "drone" : "program",
  };
}

function adaptDecisionForContext(
  decision: ReconciledDecision,
  context: StrategicProgramContext,
  roiPercent: number | null,
  npvAed: number | null,
  strategicAlignmentScore: number | null,
  publicValueScore: number | null,
): ReconciledDecision {
  if (context.mode === "unit-economics") return decision;

  const roiText = Number.isFinite(roiPercent) ? `${Number(roiPercent).toFixed(1)}%` : "below target";
  const npvText = formatAedCompact(npvAed);
  const strategicText = Number.isFinite(strategicAlignmentScore) ? `${Number(strategicAlignmentScore).toFixed(0)}%` : "strategically material";
  const publicValueText = Number.isFinite(publicValueScore) ? `${Number(publicValueScore).toFixed(0)}%` : "positive";

  if (decision.stance === "PROCEED_AS_STRATEGIC_PILOT") {
    return {
      ...decision,
      label: "Proceed — Phased Strategic Transformation",
      subLabel: "Strategic/public-value justified; release funding by milestone",
      rationale: `${context.initiativeLabel} should proceed only as a phased transformation program. Release funding by milestone, prove service and adoption outcomes, and keep architecture, data, and benefits controls in place before any wider rollout commitment.`,
      conflictResolution: `Financial gate remains below target (ROI ${roiText}, NPV ${npvText}), but strategic fit (${strategicText}) and public value (${publicValueText}) justify a phased transformation under governed release control rather than a scale-first unit-economics rollout model.`,
    };
  }

  if (decision.stance === "RESTRUCTURE_BEFORE_PROCEED") {
    return {
      ...decision,
      label: "Restructure — Before Program Mobilization",
      subLabel: "Benefits case and scope need correction first",
      rationale: `Do not mobilize ${context.initiativeLabel} at the current benefit and cost assumptions. Rework the scope, sequencing, and commercial structure first, then re-baseline the case before releasing funding.`,
      conflictResolution: "The current transformation case may still be viable, but only after scope, commercial assumptions, and measurable outcomes are reset.",
    };
  }

  if (decision.stance === "PAUSE_AND_REDESIGN") {
    return {
      ...decision,
      label: "Pause — Redesign Scope and Benefits Case",
      subLabel: "Current transformation case is not decision-ready",
      rationale: `Pause ${context.initiativeLabel}. The current strategic, financial, and delivery evidence is not strong enough to justify release. Redesign the scope, commercial model, or sponsorship basis before returning to governance.`,
    };
  }

  if (decision.stance === "PROCEED_COMMERCIAL") {
    return {
      ...decision,
      label: "Proceed — Strategic Transformation Program",
      subLabel: "Commercial and strategic gates align",
      rationale: `${context.initiativeLabel} clears both the commercial and strategic gates and can proceed as a governed transformation program with standard release controls.`,
    };
  }

  return decision;
}

/**
 * Resolve unit economics with graceful fallbacks so the panel never shows
 * an entirely blank state for business cases that lack the AV/drone
 * stagedEconomics shape. Falls back (in order) to:
 *   1. driverModel.stagedEconomics.pilotCase (dronelike)
 *   2. driverModel.stagedEconomics.scaleCase
 *   3. computedFinancialModel.driverModel top-level fields (headcount, unit, etc.)
 *   4. Derived per-unit view from total metrics + time horizon
 */
function resolveUnitEconomics(
  bc: Record<string, unknown>,
  pilotCase: Record<string, unknown>,
  scaleCase: Record<string, unknown>,
  cfm: Record<string, unknown>,
): UnitEconomicsInput {
  const driverModel = (cfm.driverModel ?? {}) as Record<string, unknown>;
  const metrics = (cfm.metrics ?? {}) as Record<string, unknown>;
  const views = (cfm.financialViews ?? {}) as Record<string, unknown>;
  const pilotView = (views.pilot ?? {}) as Record<string, unknown>;
  const pilotViewMetrics = (pilotView.metrics ?? {}) as Record<string, unknown>;

  // 1. Dronelike pilot case
  const droneFleet = num(pilotCase.fleetSize);
  const droneDaily = num(pilotCase.dailyDeliveriesPerDrone);
  if (Number.isFinite(droneFleet) && droneFleet > 0 && Number.isFinite(droneDaily)) {
    return {
      fleetSize: droneFleet,
      dailyDeliveriesPerUnit: droneDaily,
      annualDeliveries: num(pilotCase.annualDeliveries),
      revenuePerDelivery: num(pilotCase.recognizedRevenuePerDelivery ?? pilotCase.preRealizationRevenuePerDelivery),
      variableCostPerDelivery: num(pilotCase.variableCostPerDelivery),
      fixedCostPerDelivery: num(pilotCase.fixedCostPerDelivery),
      contributionMarginPerDelivery: num(pilotCase.contributionMarginPerDelivery),
      effectiveCostPerDelivery: num(pilotCase.effectiveCostPerDelivery),
      annualFixedCost: num(pilotCase.annualFixedCost),
      automationRate: num(pilotCase.automationRate),
      contractedVolumeShare: num(pilotCase.contractedVolumeShare),
      scaleDailyDeliveriesPerUnit: num(scaleCase.dailyDeliveriesPerDrone),
      scaleEffectiveCost: num(scaleCase.effectiveCostPerDelivery),
      assetNoun: "drone",
    };
  }

  // 2. Generic driver model with explicit fleet/unit economics
  const dmFleet = num(driverModel.fleetSize ?? driverModel.unitCount ?? driverModel.assets);
  const dmDaily = num(driverModel.dailyDeliveriesPerUnit ?? driverModel.throughputPerUnitDaily ?? driverModel.dailyTransactionsPerUnit);
  const dmRevenue = num(driverModel.revenuePerUnitTransaction ?? driverModel.pricePerUnit ?? driverModel.averageRevenuePerTransaction);
  const dmVar = num(driverModel.variableCostPerUnitTransaction ?? driverModel.variableCost ?? driverModel.costPerUnit);
  if (Number.isFinite(dmFleet) && dmFleet > 0) {
    return {
      fleetSize: dmFleet,
      dailyDeliveriesPerUnit: dmDaily,
      annualDeliveries: num(driverModel.annualVolume ?? driverModel.annualTransactions),
      revenuePerDelivery: dmRevenue,
      variableCostPerDelivery: dmVar,
      fixedCostPerDelivery: num(driverModel.fixedCostPerUnit),
      contributionMarginPerDelivery: Number.isFinite(dmRevenue) && Number.isFinite(dmVar) ? dmRevenue - dmVar : NaN,
      effectiveCostPerDelivery: num(driverModel.effectiveCostPerUnit),
      annualFixedCost: num(driverModel.annualFixedCost ?? metrics.totalFixedCost),
      automationRate: num(driverModel.automationRate),
      contractedVolumeShare: num(driverModel.contractedVolumeShare),
      scaleDailyDeliveriesPerUnit: NaN,
      scaleEffectiveCost: NaN,
      assetNoun: String(driverModel.assetNoun ?? driverModel.unitNoun ?? "unit"),
    };
  }

  // 3. Derive from totals when we at least have investment + timeline
  const totalInvestment = num(pilotView.upfrontInvestment ?? bc.initialInvestmentEstimate ?? bc.totalCostEstimate);
  const totalRevenue = num(pilotView.lifecycleBenefit ?? metrics.totalBenefits ?? bc.totalBenefitEstimate);
  const totalCost = num(pilotView.lifecycleCost ?? metrics.totalCosts ?? bc.totalCostEstimate);
  const years = num(pilotView.horizonYears ?? bc.timelineYears ?? 3);
  if (Number.isFinite(totalInvestment) || Number.isFinite(totalRevenue)) {
    const annualRevenue = Number.isFinite(totalRevenue) && Number.isFinite(years) && years > 0 ? totalRevenue / years : NaN;
    const annualCost = Number.isFinite(totalCost) && Number.isFinite(years) && years > 0 ? totalCost / years : NaN;
    return {
      fleetSize: NaN,
      dailyDeliveriesPerUnit: NaN,
      annualDeliveries: NaN,
      revenuePerDelivery: NaN,
      variableCostPerDelivery: NaN,
      fixedCostPerDelivery: NaN,
      contributionMarginPerDelivery: Number.isFinite(annualRevenue) && Number.isFinite(annualCost) ? (annualRevenue - annualCost) / 1 : NaN,
      effectiveCostPerDelivery: NaN,
      annualFixedCost: annualCost,
      automationRate: NaN,
      contractedVolumeShare: NaN,
      scaleDailyDeliveriesPerUnit: NaN,
      scaleEffectiveCost: NaN,
      assetNoun: "unit",
    };
  }

  // Nothing usable — return a flag so the panel renders an empty state.
  void pilotViewMetrics;
  return {
    fleetSize: NaN,
    dailyDeliveriesPerUnit: NaN,
    annualDeliveries: NaN,
    revenuePerDelivery: NaN,
    variableCostPerDelivery: NaN,
    fixedCostPerDelivery: NaN,
    contributionMarginPerDelivery: NaN,
    effectiveCostPerDelivery: NaN,
    annualFixedCost: NaN,
    automationRate: NaN,
    contractedVolumeShare: NaN,
    scaleDailyDeliveriesPerUnit: NaN,
    scaleEffectiveCost: NaN,
    assetNoun: "unit",
  };
}

function estimatePublicValueScore(
  businessCase: Record<string, unknown>,
  eaArtifact: Record<string, unknown> | null | undefined,
): number {
  const strategicAlign = num(
    ((eaArtifact as Record<string, unknown> | null | undefined)?.businessArchitecture as Record<string, unknown> | undefined)
      ?.strategicAlignmentScore,
  );
  const compliance = Array.isArray(businessCase.complianceRequirements)
    ? (businessCase.complianceRequirements as string[]).length
    : 0;
  const govFramework = (businessCase.governanceFramework ?? {}) as Record<string, unknown>;
  const approvalsCount = Array.isArray(govFramework.approvals) ? (govFramework.approvals as unknown[]).length : 0;
  const base = Number.isFinite(strategicAlign) ? strategicAlign : 60;
  const bonus = Math.min(15, compliance * 2 + approvalsCount * 1.5);
  return Math.max(0, Math.min(100, Math.round(base + bonus)));
}

function estimateRecoveryFeasibility(
  pilotCase: Record<string, unknown>,
  scaleCase: Record<string, unknown>,
): number {
  const pDaily = num(pilotCase.dailyDeliveriesPerDrone);
  const sDaily = num(scaleCase.dailyDeliveriesPerDrone);
  const pCost = num(pilotCase.effectiveCostPerDelivery);
  const sCost = num(scaleCase.effectiveCostPerDelivery);

  // Two uplift signals: utilization headroom + cost reduction headroom.
  const utilizationHeadroom = Number.isFinite(pDaily) && Number.isFinite(sDaily) && sDaily > 0
    ? Math.min(60, ((sDaily - pDaily) / sDaily) * 100)
    : 30;
  const costHeadroom = Number.isFinite(pCost) && Number.isFinite(sCost) && pCost > 0
    ? Math.min(40, ((pCost - sCost) / pCost) * 100)
    : 20;
  return Math.max(0, Math.min(100, Math.round(utilizationHeadroom + costHeadroom)));
}

function buildValueLevers(
  pilotCase: Record<string, unknown>,
  scaleCase: Record<string, unknown>,
  totalInvestment: number,
): ValueLever[] {
  const fleet = num(pilotCase.fleetSize);
  const pDaily = num(pilotCase.dailyDeliveriesPerDrone);
  const sDaily = num(scaleCase.dailyDeliveriesPerDrone);
  const revenue = num(pilotCase.recognizedRevenuePerDelivery);
  const varCost = num(pilotCase.variableCostPerDelivery);
  const pCost = num(pilotCase.effectiveCostPerDelivery);
  const sCost = num(scaleCase.effectiveCostPerDelivery);

  const unitMargin = Number.isFinite(revenue) && Number.isFinite(varCost) ? revenue - varCost : 15;

  // Lever 1 — utilization uplift (pilot daily → 70% of scale target)
  const utilizationTarget = Number.isFinite(sDaily) && sDaily > 0 ? sDaily * 0.7 : Number.isFinite(pDaily) ? pDaily * 1.8 : 80;
  const utilizationDelta =
    Number.isFinite(pDaily) && Number.isFinite(fleet) && fleet > 0
      ? Math.max(0, (utilizationTarget - pDaily) * fleet * 365 * Math.max(5, unitMargin))
      : 0;

  // Lever 2 — pricing premium (autonomous / platform premium of +10%)
  const premiumAedPerDelivery = Number.isFinite(revenue) ? revenue * 0.1 : 3;
  const pricingDelta =
    Number.isFinite(pDaily) && Number.isFinite(fleet) && fleet > 0
      ? pDaily * fleet * 365 * premiumAedPerDelivery
      : 0;

  // Lever 3 — unit cost reduction toward scale (80% path)
  const costReductionPerDelivery =
    Number.isFinite(pCost) && Number.isFinite(sCost)
      ? Math.max(0, (pCost - sCost) * 0.8)
      : 4;
  const costDelta =
    Number.isFinite(pDaily) && Number.isFinite(fleet) && fleet > 0
      ? pDaily * fleet * 365 * costReductionPerDelivery
      : 0;

  // Lever 4 — capex reduction via vendor co-investment (assume 25% capex relief)
  const capexRelief = Number.isFinite(totalInvestment) ? totalInvestment * 0.25 : 2_500_000;

  // Lever 5 — public-value subsidy / revenue share (conservative: 15% of annual revenue)
  const subsidyEstimate =
    Number.isFinite(pDaily) && Number.isFinite(fleet) && fleet > 0 && Number.isFinite(revenue)
      ? pDaily * fleet * 365 * revenue * 0.15
      : 0;

  return [
    {
      id: "utilization",
      label: "Fleet utilization uplift",
      description: "Raise deliveries per drone per day closer to the scale throughput target through smarter routing and contracted volume.",
      currentValue: Number.isFinite(pDaily) ? `${pDaily.toFixed(0)}/day` : "current",
      targetValue: `${utilizationTarget.toFixed(0)}/day`,
      estimatedImpactAed: Math.round(utilizationDelta),
      feasibility: "medium",
      owner: "Operations + Demand partnerships",
      icon: TrendingUp,
    },
    {
      id: "pricing",
      label: "Premium pricing (autonomous experience)",
      description: "Platform / autonomy-experience premium on eligible corridors and priority deliveries.",
      currentValue: Number.isFinite(revenue) ? `AED ${revenue.toFixed(1)}` : "—",
      targetValue: Number.isFinite(revenue) ? `AED ${(revenue * 1.1).toFixed(1)}` : "+10%",
      estimatedImpactAed: Math.round(pricingDelta),
      feasibility: "medium",
      owner: "Commercial / Product",
      icon: Coins,
    },
    {
      id: "cost",
      label: "Unit cost reduction toward scale",
      description: "Pull 80% of the scale-vs-pilot effective-cost gap forward through automation, density, and maintenance contracts.",
      currentValue: Number.isFinite(pCost) ? `AED ${pCost.toFixed(1)}` : "—",
      targetValue: Number.isFinite(pCost) && Number.isFinite(sCost) ? `AED ${(pCost - (pCost - sCost) * 0.8).toFixed(1)}` : "−20%",
      estimatedImpactAed: Math.round(costDelta),
      feasibility: "medium",
      owner: "Fleet operations + Vendor",
      icon: ArrowDownRight,
    },
    {
      id: "capex-coinvest",
      label: "Capex reduction via vendor co-investment",
      description: "Shift up-front capex to vendor-led financing / leasing in exchange for multi-year service commitments.",
      currentValue: "100% self-funded",
      targetValue: "~25% vendor-financed",
      estimatedImpactAed: Math.round(capexRelief),
      feasibility: "high",
      owner: "Procurement + Finance",
      icon: Handshake,
    },
    {
      id: "public-subsidy",
      label: "Public-value subsidy / revenue share",
      description: "Unlock RTA / smart-city subsidy or revenue-share instrument tied to congestion, safety, and tourism KPIs.",
      currentValue: "none",
      targetValue: "~15% of revenue",
      estimatedImpactAed: Math.round(subsidyEstimate),
      feasibility: "low",
      owner: "Government relations + Finance",
      icon: Landmark,
    },
  ];
}

function buildPublicValueMetrics(publicValueScore: number, strategicAlignment: number | null, context: StrategicProgramContext): PublicValueMetric[] {
  const pv = publicValueScore;
  if (context.mode === "transformation") {
    return [
      {
        id: "service-experience",
        label: "Service experience uplift",
        value: `${Math.max(10, Math.round(pv * 0.35))}%`,
        anchor: "Target improvement in customer response and journey quality",
        direction: "positive",
        icon: Compass,
      },
      {
        id: "channel-automation",
        label: "Channel automation",
        value: `${Math.max(15, Math.round(pv * 0.4))}%`,
        anchor: "Eligible interactions automated or digitally resolved",
        direction: "positive",
        icon: Zap,
      },
      {
        id: "customer-insight",
        label: "Unified customer insight",
        value: strategicAlignment !== null ? `${strategicAlignment}% fit` : "material",
        anchor: "Enterprise visibility across customer journeys and service demand",
        direction: "positive",
        icon: Target,
      },
      {
        id: "operational-resilience",
        label: "Operational resilience",
        value: pv >= 70 ? "Strong" : pv >= 50 ? "Adequate" : "Emerging",
        anchor: "Service continuity and cross-channel control posture",
        direction: pv >= 60 ? "positive" : "neutral",
        icon: Shield,
      },
      {
        id: "sovereignty",
        label: "Sovereignty posture",
        value: pv >= 70 ? "Strong" : pv >= 50 ? "Adequate" : "Weak",
        anchor: "UAE data residency, customer-data control, and policy compliance",
        direction: pv >= 60 ? "positive" : "neutral",
        icon: Landmark,
      },
    ];
  }

  return [
    {
      id: "av-strategy",
      label: "Dubai Autonomous Transportation Strategy",
      value: `${Math.max(0, Math.min(25, Math.round(pv * 0.25)))}% → 25% by 2030`,
      anchor: "Alignment to the 25% autonomous mobility target",
      direction: "positive",
      icon: Compass,
    },
    {
      id: "congestion",
      label: "Corridor congestion reduction",
      value: `${Math.round(pv * 0.18)}%`,
      anchor: "Modeled reduction on targeted corridors",
      direction: "positive",
      icon: ArrowDownRight,
    },
    {
      id: "safety",
      label: "Safety incident reduction",
      value: `${Math.round(pv * 0.22)}%`,
      anchor: "Versus baseline last-mile incident rate",
      direction: "positive",
      icon: Shield,
    },
    {
      id: "tourism",
      label: "Tourism / innovation positioning",
      value: strategicAlignment !== null ? `${strategicAlignment}% fit` : "aligned",
      anchor: "Dubai smart-city and innovation agenda",
      direction: "positive",
      icon: Flag,
    },
    {
      id: "data-platform",
      label: "Smart-city data platform value",
      value: `${Math.round(pv * 0.5)}pt asset`,
      anchor: "Urban sensing + mobility dataset into Dubai Data platform",
      direction: "neutral",
      icon: Target,
    },
    {
      id: "sovereignty",
      label: "Sovereignty posture",
      value: pv >= 70 ? "Strong" : pv >= 50 ? "Adequate" : "Weak",
      anchor: "UAE data residency and operator control baseline",
      direction: pv >= 60 ? "positive" : "neutral",
      icon: Landmark,
    },
  ];
}

function defaultStrategyAnchors(context: StrategicProgramContext): Array<{ title: string; detail: string }> {
  if (context.mode === "transformation") {
    return [
      {
        title: "Dubai digital government transformation",
        detail: "Strengthen service experience, response speed, and digital channel effectiveness for customers and operators.",
      },
      {
        title: "Customer 360 and service orchestration",
        detail: "Unify customer records, service history, and case handling across enterprise touchpoints.",
      },
      {
        title: "Enterprise data and AI governance",
        detail: "Ensure CRM intelligence operates with controlled data ownership, explainability, and policy-compliant automation.",
      },
      {
        title: "Benefits-led transformation governance",
        detail: "Release funding by milestone and prove customer, productivity, and quality outcomes before wider rollout.",
      },
    ];
  }

  return [
    {
      title: "Dubai Autonomous Transportation Strategy",
      detail: "25% of all journeys autonomous by 2030 — pilot contributes to learning curve and infrastructure readiness.",
    },
    {
      title: "Dubai Roads and Transport Authority (RTA) AV program",
      detail: "Align sensor, data, and operations protocols with RTA AV deployment standards and safety assurance model.",
    },
    {
      title: "Dubai Smart City / Dubai Data",
      detail: "Telemetry and operational data contribute to the city data platform as a public-value asset, not a private moat.",
    },
    {
      title: "UAE data sovereignty baseline",
      detail: "All personal and operational data residency enforced in-country; cross-border flows require explicit policy sign-off.",
    },
  ];
}

function buildOwnershipMatrix(context: StrategicProgramContext): OwnershipRow[] {
  if (context.mode === "transformation") {
    return [
      {
        domain: "CRM platform and product configuration",
        accountableParty: "Transformation sponsor",
        responsibleParties: ["Implementation partner", "Internal product owner"],
        consultedParties: ["Enterprise Architecture", "Security"],
        informedParties: ["Steering committee"],
        liabilityCarrier: "Vendor for platform defects; enterprise for release governance",
        note: "Vendor delivers platform capability, but internal teams own architecture decisions, release gates, and target-state fit.",
      },
      {
        domain: "Customer master data and analytics",
        accountableParty: "Chief Data Officer",
        responsibleParties: ["Data platform team"],
        consultedParties: ["Business owners", "Vendor"],
        informedParties: ["Governance board"],
        liabilityCarrier: "Enterprise data owner",
        note: "Customer data ownership, quality, and residency controls remain internal and cannot be ceded to the platform vendor.",
      },
      {
        domain: "Integration and enterprise API estate",
        accountableParty: "Enterprise Architect",
        responsibleParties: ["Integration team", "Application owners"],
        consultedParties: ["Vendor", "Security"],
        informedParties: ["PMO"],
        liabilityCarrier: "Enterprise release authority",
        note: "Legacy integration risk sits with internal architecture governance even when connectors are vendor-delivered.",
      },
      {
        domain: "Cybersecurity, privacy, and access control",
        accountableParty: "CISO",
        responsibleParties: ["Security engineering", "IAM team"],
        consultedParties: ["Vendor security lead", "Compliance"],
        informedParties: ["Executive sponsor"],
        liabilityCarrier: "Shared: enterprise policy owner + vendor control owner",
        note: "Security baselines, data protection, and privileged-access controls require joint accountability with clear evidence obligations.",
      },
      {
        domain: "Change adoption and service operations",
        accountableParty: "Business service owner",
        responsibleParties: ["Operations lead", "Change manager"],
        consultedParties: ["HR/Learning", "PMO"],
        informedParties: ["Steering committee"],
        liabilityCarrier: "Business owner",
        note: "Benefits realization depends on adoption, process redesign, and operational behavior change, not just platform delivery.",
      },
    ];
  }

  return [
    {
      domain: "AV / Drone platform stack",
      accountableParty: "Program sponsor",
      responsibleParties: ["Specialist AV vendor"],
      consultedParties: ["Enterprise Architecture", "Security"],
      informedParties: ["Steering committee"],
      liabilityCarrier: "Vendor — indemnified up to defined cap",
      note: "Vendor owns platform SLAs and safety-critical controls; internal EA owns interfaces and release gates.",
    },
    {
      domain: "Operational data (telemetry, trips, sensors)",
      accountableParty: "Chief Data Officer",
      responsibleParties: ["Internal Data Platform team"],
      consultedParties: ["Vendor", "Dubai Data"],
      informedParties: ["Regulator"],
      liabilityCarrier: "Operator (self-insured + cyber cover)",
      note: "Data residency enforced in-country; vendor receives derived features only, not raw data ownership.",
    },
    {
      domain: "Operations & service delivery",
      accountableParty: "Operations lead",
      responsibleParties: ["Blended internal + vendor ops team"],
      consultedParties: ["Transformation Office"],
      informedParties: ["Regulator", "Public affairs"],
      liabilityCarrier: "Operator — joint operational risk with vendor",
      note: "Manual override and hybrid-ops playbooks owned internally; cannot be sub-delegated.",
    },
    {
      domain: "Safety & regulatory compliance",
      accountableParty: "Safety authority representative",
      responsibleParties: ["HSE lead", "Vendor safety engineering"],
      consultedParties: ["RTA / DCAA"],
      informedParties: ["Board"],
      liabilityCarrier: "Operator — with vendor warranty on platform defects",
      note: "Independent safety reviewer required per stage gate.",
    },
    {
      domain: "Commercial & financial liability",
      accountableParty: "CFO",
      responsibleParties: ["Procurement", "Legal"],
      consultedParties: ["Insurance broker"],
      informedParties: ["Steering committee"],
      liabilityCarrier: "Operator — backed by commercial insurance + vendor indemnity",
      note: "Liability cap and indemnity clauses locked in pilot contract before mobilization.",
    },
  ];
}
