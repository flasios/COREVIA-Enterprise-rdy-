import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Handshake,
  Scale,
  Shield,
  TrendingUp,
  type LucideIcon,
  Zap,
} from "lucide-react";

export interface ValueLever {
  id: string;
  label: string;
  description: string;
  currentValue?: string;
  targetValue?: string;
  estimatedImpactAed: number;
  feasibility: "high" | "medium" | "low";
  owner?: string;
  icon: LucideIcon;
}

export function ValueRecoveryBridge({
  gapAed,
  levers,
  horizonLabel,
}: {
  gapAed: number;
  levers: ValueLever[];
  horizonLabel?: string;
}) {
  const [open, setOpen] = useState(true);
  const cumulative = useMemo(() => {
    let running = 0;
    return levers.map((lever) => {
      running += lever.estimatedImpactAed;
      return { ...lever, cumulative: running };
    });
  }, [levers]);

  const totalImpact = cumulative.length > 0 ? (cumulative[cumulative.length - 1]?.cumulative ?? 0) : 0;
  const residualGap = Math.max(0, gapAed - totalImpact);
  const closureRate = gapAed > 0 ? Math.min(100, (totalImpact / gapAed) * 100) : 0;

  const formatImpact = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${value >= 0 ? "+" : "−"}${(abs / 1_000_000).toFixed(1)}M AED`;
    if (abs >= 1_000) return `${value >= 0 ? "+" : "−"}${(abs / 1_000).toFixed(0)}K AED`;
    return `${value >= 0 ? "+" : "−"}${abs.toFixed(0)} AED`;
  };

  const formatAbsolute = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M AED`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K AED`;
    return `${value.toFixed(0)} AED`;
  };

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader
        className="cursor-pointer px-4 pb-1.5 pt-3 hover:bg-amber-500/10"
        onClick={() => setOpen((previous) => !previous)}
      >
        <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-wider">
          <TrendingUp className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
          Value Recovery Bridge
          {horizonLabel ? <span className="normal-case text-[10px] tracking-normal text-muted-foreground">({horizonLabel})</span> : null}
          <Badge variant="outline" className="ml-2 border-amber-500/40 text-[10px]">
            gap: {formatAbsolute(gapAed)} · addressable: {closureRate.toFixed(0)}%
          </Badge>
          <div className="ml-auto">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>
        </CardTitle>
      </CardHeader>
      {open ? (
        <CardContent className="space-y-2 px-4 pb-3 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-1.5 text-left font-semibold">Lever</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Move</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Impact (AED)</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Cumulative</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Feasibility</th>
                </tr>
              </thead>
              <tbody>
                {cumulative.map((lever) => {
                  const LeverIcon = lever.icon;
                  const feasibilityTone = lever.feasibility === "high"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : lever.feasibility === "medium"
                      ? "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                      : "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300";

                  return (
                    <tr key={lever.id} className="border-b last:border-0">
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <LeverIcon className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
                          <div className="min-w-0">
                            <div className="font-semibold">{lever.label}</div>
                            <div className="text-[10px] text-muted-foreground">{lever.description}</div>
                            {lever.owner ? <div className="text-[10px] italic text-muted-foreground">Owner: {lever.owner}</div> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-[11px] text-muted-foreground">
                        {lever.currentValue && lever.targetValue ? (
                          <span>
                            {lever.currentValue} <ArrowRight className="inline h-3 w-3" /> {lever.targetValue}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`px-2 py-2 text-right font-bold ${lever.estimatedImpactAed >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                        {formatImpact(lever.estimatedImpactAed)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[11px]">{formatAbsolute(lever.cumulative)}</td>
                      <td className="px-2 py-2 text-center">
                        <Badge variant="outline" className={`text-[10px] ${feasibilityTone}`}>
                          {lever.feasibility}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground/20">
                  <td className="px-2 py-2 font-bold uppercase tracking-wider text-muted-foreground" colSpan={2}>
                    Total recovery
                  </td>
                  <td className={`px-2 py-2 text-right text-sm font-bold ${totalImpact >= gapAed ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                    {formatImpact(totalImpact)}
                  </td>
                  <td className="px-2 py-2 text-right text-sm font-bold">{formatAbsolute(totalImpact)}</td>
                  <td />
                </tr>
                <tr>
                  <td className="px-2 py-2 text-[11px] uppercase tracking-wider text-muted-foreground" colSpan={2}>
                    Residual gap (after all levers)
                  </td>
                  <td className={`px-2 py-2 text-right font-bold ${residualGap <= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                    {residualGap <= 0 ? "CLOSED" : `−${formatAbsolute(residualGap)}`}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-2 rounded border border-foreground/10 bg-background/60 p-2 text-[11px]">
            <div className="font-semibold uppercase tracking-wider text-muted-foreground">Closure readout</div>
            <Progress value={closureRate} className="my-1 h-2" />
            <p className="text-foreground/80">
              {closureRate >= 100
                ? "Levers fully close the economic gap on paper. Next step: validation plan + evidence before capital release."
                : closureRate >= 60
                  ? "Majority of the gap is addressable. Require a commitment to lever execution in the decision record, with owners and target dates."
                  : closureRate >= 30
                    ? "Only partial closure. Either add new levers (subsidy, pricing model change) or shift to strategic-pilot framing."
                    : "Levers alone cannot close the gap. Redesign the economic model or pause the initiative."}
            </p>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

export function buildTransformationValueLevers(
  gapAed: number,
  totalInvestment: number,
  initiativeLabel: string,
): ValueLever[] {
  const baseGap = gapAed > 0 ? gapAed : Math.max(250_000, totalInvestment * 0.2);

  return [
    {
      id: "scope-sequencing",
      label: "Scope sequencing and phased release",
      description: `Break ${initiativeLabel} into an MVP and governed waves so funding follows evidence instead of the full envelope upfront.`,
      currentValue: "single release path",
      targetValue: "MVP + gated waves",
      estimatedImpactAed: Math.round(baseGap * 0.28),
      feasibility: "high",
      owner: "Sponsor + PMO",
      icon: Scale,
    },
    {
      id: "adoption-realization",
      label: "Benefits realization discipline",
      description: "Tie service, productivity, and customer-experience benefits to named owners with live monthly benefit tracking.",
      currentValue: "forecast benefits",
      targetValue: "tracked live benefits",
      estimatedImpactAed: Math.round(baseGap * 0.18),
      feasibility: "high",
      owner: "Business owner + Finance",
      icon: TrendingUp,
    },
    {
      id: "process-redesign",
      label: "Process and channel redesign",
      description: "Reduce cost and change burden by simplifying workflows, handoffs, and service channels before scaling spend.",
      currentValue: "current-state process",
      targetValue: "redesigned target process",
      estimatedImpactAed: Math.round(baseGap * 0.16),
      feasibility: "medium",
      owner: "Operations + Change lead",
      icon: Zap,
    },
    {
      id: "vendor-commercials",
      label: "Vendor commercial restructuring",
      description: "Renegotiate license, implementation, and support commercials so spend aligns to delivered capability and adoption milestones.",
      currentValue: "fixed commercial structure",
      targetValue: "outcome-linked commercial model",
      estimatedImpactAed: Math.round(baseGap * 0.2),
      feasibility: "medium",
      owner: "Procurement + Finance",
      icon: Handshake,
    },
    {
      id: "risk-removal",
      label: "Architecture and integration risk removal",
      description: "Recover value by simplifying integration scope, data flows, and release dependencies before wider rollout.",
      currentValue: "full-risk envelope",
      targetValue: "controlled release envelope",
      estimatedImpactAed: Math.round(baseGap * 0.12),
      feasibility: "medium",
      owner: "Architecture + Delivery lead",
      icon: Shield,
    },
  ];
}