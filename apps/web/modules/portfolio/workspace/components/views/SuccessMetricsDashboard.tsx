import { Badge } from "@/components/ui/badge";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Shield,
  DollarSign,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  CalendarCheck,
  Gauge,
  Gift,
} from "lucide-react";
import type { ProjectData, BusinessCaseData, BusinessCaseKpi } from "../../types";

interface BenefitItem {
  category: string;
  description: string;
  type?: string;
  value?: number;
}

interface SuccessMetricsDashboardProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
}


export function SuccessMetricsDashboard({
   
  project: _project,
  businessCase,
}: SuccessMetricsDashboardProps) {
  const bc = (businessCase?.content || businessCase) as Record<string, unknown> | undefined;
  const businessCaseRecord = businessCase as unknown as Record<string, unknown> | undefined;
  const kpis = (bc?.kpis || businessCase?.kpis || businessCase?.successMetrics || businessCase?.content?.kpis || []) as BusinessCaseKpi[];

  // ── Benefits data ──
  const detailedBenefits = (bc?.detailedBenefits || []) as BenefitItem[];
  const benefitsBreakdown = (bc?.benefitsBreakdown || {}) as Record<string, string[]>;
  const orgBenefits = (bc?.organizationalBenefits || []) as string[];
  // Merge all benefits into a single list
  const allBenefits: BenefitItem[] = [
    ...detailedBenefits,
    ...Object.entries(benefitsBreakdown).flatMap(([cat, items]) =>
      (items || []).map(desc => ({ category: cat.charAt(0).toUpperCase() + cat.slice(1), description: desc, type: 'qualitative' }))
    ),
  ];
  // Dedup by description (first 80 chars)
  const seenBenefits = new Set<string>();
  const uniqueBenefits = allBenefits.filter(b => {
    const key = b.description.substring(0, 80).toLowerCase();
    if (seenBenefits.has(key)) return false;
    seenBenefits.add(key);
    return true;
  });

  // Helper to resolve BC fields with fallback names
  const bcVal = (primary: string, ...fallbacks: string[]): string | number | undefined => {
    for (const key of [primary, ...fallbacks]) {
      const v = bc?.[key] ?? businessCaseRecord?.[key];
      if (v !== undefined && v !== null && v !== '') return v as string | number;
    }
    return undefined;
  };

  const formatFinancial = (val: string | number | undefined, unit: string): string => {
    if (val === undefined || val === null || val === '') return 'TBD';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return String(val);
    if (unit === '%') return `${num.toFixed(1)}%`;
    if (unit === 'months') return `${Math.round(num)}`;
    if (unit === 'AED') {
      return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
    }
    return String(num);
  };

  const totalBenefit = bcVal('totalBenefit', 'totalBenefitEstimate', 'annualBenefit');
  const totalCost = bcVal('totalCost', 'totalCostEstimate');

  // Prefer the full lifecycle computedFinancialModel.metrics (5-year itemised costs & benefits)
  // over the partial single-period totalCostEstimate / totalBenefitEstimate fields.
  const fmMetrics = (bc as Record<string, unknown>)?.computedFinancialModel &&
    typeof (bc as Record<string, unknown>).computedFinancialModel === 'object'
    ? ((bc as Record<string, unknown>).computedFinancialModel as Record<string, unknown>)?.metrics as Record<string, number> | undefined
    : undefined;

  const roi = fmMetrics?.roi ?? bcVal('roi', 'roiPercentage');
  const npv = fmMetrics?.npv ?? bcVal('npv', 'npvValue');
  const payback = fmMetrics?.paybackMonths ?? bcVal('paybackPeriod', 'paybackMonths');

  const successCriteria = (bc?.successCriteria || bc?.performanceTargets || []) as Array<{ target?: string; criterion?: string; name?: string; measurement?: string }>;

  return (
    <div className="space-y-3">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Target className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight leading-none">Success Metrics</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{kpis.length} KPIs · {uniqueBenefits.length} benefits · Financial analysis</p>
          </div>
        </div>
      </div>

      {/* ── Financial KPIs (compact row) ── */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'ROI', value: formatFinancial(roi, '%'), icon: roi !== undefined && Number(roi) >= 0 ? TrendingUp : TrendingDown, trend: roi !== undefined ? (Number(roi) >= 0 ? 'pos' : 'neg') : 'neu' },
          { label: 'Investment', value: formatFinancial(totalCost, 'AED'), icon: DollarSign, trend: 'neu' as const },
          { label: 'Total Benefit', value: formatFinancial(totalBenefit, 'AED'), icon: ArrowUpRight, trend: 'pos' as const },
          { label: 'Payback', value: payback ? `${Math.round(Number(payback))} mo` : 'TBD', icon: Clock, trend: 'neu' as const },
          { label: 'NPV', value: formatFinancial(npv, 'AED'), icon: npv !== undefined && Number(npv) >= 0 ? ArrowUpRight : ArrowDownRight, trend: npv !== undefined ? (Number(npv) >= 0 ? 'pos' : 'neg') : 'neu' },
        ].map((f) => {
          const Icon = f.icon;
          const color = f.trend === 'pos' ? 'text-emerald-600 dark:text-emerald-400' : f.trend === 'neg' ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground';
          const bgTint = f.trend === 'pos' ? 'border-emerald-500/15 bg-emerald-500/[0.03]' : f.trend === 'neg' ? 'border-red-500/15 bg-red-500/[0.03]' : 'border-border/40 bg-card/60';
          return (
            <div key={f.label} className={`rounded-lg border ${bgTint} p-2.5`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{f.label}</span>
                <Icon className={`w-3 h-3 ${color}`} />
              </div>
              <div className={`text-sm font-bold tracking-tight leading-none ${color}`}>{f.value}</div>
            </div>
          );
        })}
      </div>

      {/* ── KPIs + Benefits side by side ── */}
      <div className="grid grid-cols-2 gap-2">
        {/* Operational KPIs */}
        <div className="rounded-lg border border-blue-500/15 bg-blue-500/[0.02] overflow-hidden">
          <div className="px-3 py-2 border-b border-blue-500/10 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[11px] font-semibold">Operational KPIs</span>
            </div>
            <span className="text-[9px] font-medium text-blue-600 dark:text-blue-400 tabular-nums">{kpis.length}</span>
          </div>
          <div className="divide-y divide-border/20">
            {kpis.length > 0 ? kpis.map((kpi: BusinessCaseKpi, i: number) => (
              <div key={i} className="px-3 py-2 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-medium truncate">{kpi.name || kpi.metric || String(kpi)}</span>
                  <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-blue-500/8 text-blue-600 dark:text-blue-400 border-blue-500/20 shrink-0">KPI-{i+1}</Badge>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-muted-foreground">Base: <span className="font-medium text-foreground">{kpi.baseline || '—'}</span></span>
                  <span className="text-blue-600 dark:text-blue-400">Target: <span className="font-semibold">{kpi.target || 'TBD'}</span></span>
                </div>
              </div>
            )) : (
              <div className="px-3 py-4 text-center text-[10px] text-muted-foreground/40">No KPIs defined</div>
            )}
          </div>
        </div>

        {/* Benefits */}
        <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.02] overflow-hidden">
          <div className="px-3 py-2 border-b border-emerald-500/10 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[11px] font-semibold">Expected Benefits</span>
            </div>
            <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">{uniqueBenefits.length}</span>
          </div>
          <div className="divide-y divide-border/20 max-h-[300px] overflow-y-auto">
            {uniqueBenefits.length > 0 ? uniqueBenefits.map((b, i) => {
              const catColor = b.category.toLowerCase() === 'financial' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                : b.category.toLowerCase() === 'operational' ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10'
                : b.category.toLowerCase() === 'governance' ? 'text-purple-600 dark:text-purple-400 bg-purple-500/10'
                : b.category.toLowerCase() === 'strategic' ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                : 'text-muted-foreground bg-muted/30';
              return (
                <div key={i} className="px-3 py-2 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className={`text-[8px] h-3.5 px-1 shrink-0 mt-0.5 border-transparent font-semibold ${catColor}`}>
                      {b.category.substring(0, 3).toUpperCase()}
                    </Badge>
                    <span className="text-[11px] text-foreground/80 leading-snug">{b.description}</span>
                  </div>
                  {b.value && (
                    <div className="ml-7 mt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', minimumFractionDigits: 0 }).format(b.value)}
                    </div>
                  )}
                </div>
              );
            }) : orgBenefits.length > 0 ? orgBenefits.map((b, i) => (
              <div key={i} className="px-3 py-2 hover:bg-muted/20 transition-colors">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-[11px] text-foreground/80 leading-snug">{b}</span>
                </div>
              </div>
            )) : (
              <div className="px-3 py-4 text-center text-[10px] text-muted-foreground/40">No benefits data</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Success Criteria + Delivery (compact row) ── */}
      <div className="grid grid-cols-2 gap-2">
        {/* Success Criteria */}
        <div className="rounded-lg border border-purple-500/15 bg-purple-500/[0.02] overflow-hidden">
          <div className="px-3 py-2 border-b border-purple-500/10 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-[11px] font-semibold">Success Criteria</span>
          </div>
          <div className="divide-y divide-border/20">
            {successCriteria.length > 0 ? successCriteria.map((sc, i) => (
              <div key={i} className="px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-purple-500 shrink-0" />
                <span className="text-[11px] flex-1 truncate">{sc.criterion || sc.name || 'Criterion'}</span>
                <span className="text-[9px] font-medium text-purple-600 dark:text-purple-400 shrink-0">{sc.target || 'TBD'}</span>
              </div>
            )) : (
              <div className="px-3 py-4 text-center text-[10px] text-muted-foreground/40">None defined</div>
            )}
          </div>
        </div>

        {/* Delivery Metrics */}
        <div className="rounded-lg border border-amber-500/15 bg-amber-500/[0.02] overflow-hidden">
          <div className="px-3 py-2 border-b border-amber-500/10 flex items-center gap-1.5">
            <CalendarCheck className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold">Delivery Metrics</span>
          </div>
          <div className="divide-y divide-border/20">
            {[
              { name: 'On-Time Delivery', target: '> 90%' },
              { name: 'Budget Variance', target: '< 10%' },
              { name: 'Scope Completion', target: '100%' },
              { name: 'Milestone Hit Rate', target: '> 85%' },
            ].map((m, i) => (
              <div key={i} className="px-3 py-2 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                <span className="text-[11px] flex-1">{m.name}</span>
                <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400 shrink-0">{m.target}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
