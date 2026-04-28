import { BarChart3, Building2, Shield, Target } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

import type {
  BreakEvenAnalysis,
  DiscountRateComparisonEntry,
  GovernmentExternality,
  InvestmentCommitteeSummary,
  TerminalValueAnalysis,
} from '../types/financialTypes';
import { formatCurrency } from '../utils/financialFormatters';

/* ─────────────────────────────────────────
   Investment Committee Analytics Sub-Component
   ───────────────────────────────────────── */

function gradeColor(grade: string) {
  if (grade === 'A' || grade === 'B') return 'bg-emerald-500';
  if (grade === 'C') return 'bg-amber-500';
  return 'bg-red-500';
}

export function InvestmentCommitteeAnalytics({ computedFinancialModel }: { computedFinancialModel?: Record<string, unknown> }) {
  const cfm = computedFinancialModel;
  if (!cfm) return null;

  const icSummary = cfm.investmentCommitteeSummary as InvestmentCommitteeSummary | undefined;
  const breakEven = cfm.breakEvenAnalysis as BreakEvenAnalysis | undefined;
  const terminalVal = cfm.terminalValue as TerminalValueAnalysis | undefined;
  const discountComparison = cfm.discountRateComparison as DiscountRateComparisonEntry[] | undefined;
  const externalities = cfm.governmentExternalities as GovernmentExternality[] | undefined;

  // Don't render if none of the IC fields are present
  if (!icSummary && !breakEven && !terminalVal && !discountComparison && !externalities) return null;

  const totalExternalities5yr = externalities?.reduce((s, e) => s + e.fiveYearValue, 0) ?? 0;

  return (
    <>
      {/* ── IC Readiness Grade + Break-Even + Terminal Value (compact row) ── */}
      {(icSummary || breakEven || terminalVal) && (
        <Card data-testid="ic-summary">
          <CardContent className="py-4 space-y-4">
            {/* Grade banner */}
            {icSummary && (
              <div className="grid gap-3 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] md:items-start">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Investment Committee Readiness</span>
                  <div className={`px-2 py-0.5 rounded-full text-xs text-white font-bold ${gradeColor(icSummary.readinessGrade)}`}>
                    {icSummary.readinessGrade}
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Committee rationale</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{icSummary.gradingNotes}</p>
                </div>
              </div>
            )}

            {/* Key IC metrics — compact 2-row grid */}
            {icSummary && (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {([
                  ['Expected NPV', formatCurrency(icSummary.expectedNPV, 'AED', true), icSummary.expectedNPV >= 0],
                  ['Value at Risk', formatCurrency(icSummary.valueAtRisk, 'AED', true), null],
                  ['B/I Ratio', `${icSummary.benefitToInvestmentRatio.toFixed(3)}x`, icSummary.benefitToInvestmentRatio >= 1],
                  ['Marginal vs Inaction', formatCurrency(icSummary.marginalCostOverDoNothing, 'AED', true), null],
                  ['Terminal-Adj NPV', formatCurrency(icSummary.terminalValueAdjustedNPV, 'AED', true), icSummary.terminalValueAdjustedNPV >= 0],
                  ['Public-Value NPV', formatCurrency(icSummary.publicValueAdjustedNPV, 'AED', true), icSummary.publicValueAdjustedNPV >= 0],
                ] as [string, string, boolean | null][]).map(([label, value, positive]) => (
                  <div key={label} className="p-2 rounded bg-muted/40 text-center">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide leading-tight">{label}</p>
                    <p className={`text-xs font-bold mt-0.5 ${positive === true ? 'text-emerald-600' : positive === false ? 'text-red-600' : 'text-amber-600'}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Break-Even + Terminal in a side-by-side grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Break-Even */}
              {breakEven && (
                <div className="p-3 rounded-lg border bg-card" data-testid="break-even-analysis">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold">Break-Even Threshold</span>
                    </div>
                    <Badge variant={breakEven.isAchievable ? 'default' : 'destructive'} className={`text-[10px] h-5 ${breakEven.isAchievable ? 'bg-emerald-500' : ''}`}>
                      {breakEven.isAchievable ? 'Achievable' : 'Not Achievable'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center">
                      <p className={`text-lg font-bold ${breakEven.revenueMultiplierRequired <= 2 ? 'text-emerald-600' : breakEven.revenueMultiplierRequired <= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                        {breakEven.revenueMultiplierRequired.toFixed(1)}x
                      </p>
                      <p className="text-[10px] text-muted-foreground">Revenue multiplier</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-lg font-bold ${breakEven.costReductionRequired <= 20 ? 'text-emerald-600' : breakEven.costReductionRequired <= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {breakEven.costReductionRequired.toFixed(0)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">Cost reduction</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 leading-snug">{breakEven.summary}</p>
                </div>
              )}

              {/* Terminal Value */}
              {terminalVal && (
                <div className="p-3 rounded-lg border bg-card" data-testid="terminal-value">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold">Terminal &amp; Residual Value</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(terminalVal.residualAssetValue, 'AED', true)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Residual</p>
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${terminalVal.adjustedNPV >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(terminalVal.adjustedNPV, 'AED', true)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Adj NPV</p>
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${terminalVal.adjustedROI >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {terminalVal.adjustedROI.toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">Adj ROI</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 leading-snug">{terminalVal.methodology}</p>
                </div>
              )}
            </div>

            {/* Decision Factors — compact inline list */}
            {icSummary?.keyDecisionFactors && icSummary.keyDecisionFactors.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {icSummary.keyDecisionFactors.map((factor, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${gradeColor(icSummary.readinessGrade)}`} />
                    {factor}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Discount Sensitivity + Externalities (side-by-side) ── */}
      {(discountComparison?.length || externalities?.length) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Discount Rate Sensitivity */}
          {discountComparison && discountComparison.length > 0 && (
            <Card data-testid="discount-rate-comparison">
              <CardContent className="py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">Discount Rate Sensitivity</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-muted">
                      <th className="text-left py-1 font-medium text-muted-foreground">Rate</th>
                      <th className="text-right py-1 font-medium text-muted-foreground">NPV</th>
                      <th className="text-right py-1 font-medium text-muted-foreground">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discountComparison.map((row, idx) => (
                      <tr key={idx} className="border-b border-muted/30">
                        <td className="py-1 font-medium">{row.label}</td>
                        <td className={`py-1 text-right ${row.npv >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(row.npv, 'AED', true)}
                        </td>
                        <td className={`py-1 text-right ${row.roi >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {row.roi.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Government Externalities */}
          {externalities && externalities.length > 0 && (
            <Card className="border-indigo-200 dark:border-indigo-800" data-testid="government-externalities">
              <CardContent className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                    <span className="text-xs font-semibold">Public Value Externalities</span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                    5yr: {formatCurrency(totalExternalities5yr, 'AED', true)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {externalities.map((ext, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 py-1 border-b border-muted/30 last:border-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium truncate">{ext.name}</span>
                          <span className="text-[9px] text-muted-foreground capitalize">({ext.confidence})</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{ext.description}</p>
                      </div>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                        {formatCurrency(ext.fiveYearValue, 'AED', true)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
