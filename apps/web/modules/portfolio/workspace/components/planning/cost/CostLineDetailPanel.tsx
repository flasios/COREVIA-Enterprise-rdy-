import { useMemo } from 'react';
import {
  Activity,
  ArrowRight,
  Building2,
  Calendar,
  FileText,
  Link2,
  ListTree,
  Plus,
  Receipt,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

import type { BcLineContract, CbsLineItem, CbsLineSubTask, CommitmentEntry } from './CostManagementStudio';

const AED = (n: number) =>
  new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const prettyPlanDate = (value?: string | null) => {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

function lineExtended(line: CbsLineItem) {
  const base = line.quantity * line.unitRate;
  const withMarkup = base * (1 + (line.markupPct || 0) / 100);
  const withContingency = withMarkup * (1 + (line.contingencyPct || 0) / 100);
  return { base, withMarkup, withContingency };
}

function yearsOfCoverage(contract: BcLineContract): number {
  if (!contract.startDate || !contract.endDate) return 1;
  const start = new Date(contract.startDate);
  const end = new Date(contract.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 1;
  const years = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.max(1, years);
}

// ─── Smart line detail panel ────────────────────────────────────────────
// The right pane should behave like a decision cockpit, not a tabbed form.
// It synthesizes procurement readiness, execution structure, spend posture,
// and next best actions from the line itself plus the live commitment book.
type SmartTone = 'good' | 'warn' | 'bad' | 'info';

function smartToneBadgeClass(tone: SmartTone) {
  return tone === 'good'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
    : tone === 'warn'
    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
    : tone === 'bad'
    ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
    : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300';
}

function smartToneTextClass(tone: SmartTone) {
  return tone === 'good'
    ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'warn'
    ? 'text-amber-600 dark:text-amber-400'
    : tone === 'bad'
    ? 'text-rose-600 dark:text-rose-400'
    : 'text-sky-600 dark:text-sky-400';
}

function _smartToneBarClass(tone: SmartTone) {
  return tone === 'good'
    ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
    : tone === 'warn'
    ? 'bg-gradient-to-r from-amber-500 to-orange-400'
    : tone === 'bad'
    ? 'bg-gradient-to-r from-rose-500 to-rose-400'
    : 'bg-gradient-to-r from-sky-500 to-indigo-500';
}

function normalizeSmartText(value: string | null | undefined) {
  return `${value ?? ''}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function smartTokens(value: string | null | undefined) {
  return normalizeSmartText(value)
    .split(' ')
    .filter((token) => token.length > 2);
}

function _lineCommercialRoute(line: CbsLineItem) {
  if (line.category === 'subcontractor') return 'Third-party SOW';
  if (line.category === 'material') return 'Supply package';
  if (line.category === 'equipment') return 'Asset / equipment buy';
  if (line.category === 'labor') return 'Labor package';
  if (line.category === 'overhead') return 'Shared-service overhead';
  return line.costClass === 'OPEX' ? 'Run-rate operating line' : 'Project delivery line';
}

function buildSuggestedSubTasks(line: CbsLineItem, baseValue: number): CbsLineSubTask[] {
  const templatesByCategory: Record<CbsLineItem['category'], string[]> = {
    labor: ['Plan & design', 'Build / execute', 'Review & handover'],
    equipment: ['Supply', 'Install & configure', 'Commission'],
    material: ['Supply', 'Delivery & integration', 'Testing / acceptance'],
    subcontractor: ['Mobilization', 'Delivery package', 'Acceptance & closeout'],
    overhead: ['Governance', 'Reporting', 'Operational support'],
    other: ['Package 1', 'Package 2', 'Package 3'],
  };
  const templates = templatesByCategory[line.category] ?? templatesByCategory.other;
  const weights = [0.4, 0.35, 0.25];
  let allocated = 0;
  return templates.map((description, index) => {
    const isLast = index === templates.length - 1;
    const amount = isLast ? Math.max(0, Math.round(baseValue - allocated)) : Math.max(0, Math.round(baseValue * weights[index]!));
    allocated += amount;
    return {
      id: uid(),
      description,
      amount,
      status: 'pending',
    };
  });
}

function matchCommitmentToLine(line: CbsLineItem, targetValue: number, commitment: CommitmentEntry) {
  const reasons: string[] = [];
  let score = 0;

  if (line.costClass === commitment.costClass) {
    score += 20;
    reasons.push('same cost class');
  }

  const lineTokensSet = new Set([...smartTokens(line.wbsCode), ...smartTokens(line.description)]);
  const commitmentText = [commitment.ref, commitment.vendor, commitment.description, commitment.scope].join(' ');
  const commitmentTokens = smartTokens(commitmentText);
  const sharedTokens = commitmentTokens.filter((token) => lineTokensSet.has(token));
  if (sharedTokens.length > 0) {
    score += Math.min(28, sharedTokens.length * 7);
    reasons.push(`${sharedTokens.length} shared keywords`);
  }

  const normalizedWbs = normalizeSmartText(line.wbsCode);
  if (normalizedWbs && normalizeSmartText(commitment.ref).includes(normalizedWbs)) {
    score += 24;
    reasons.push('WBS-aligned reference');
  }

  const commitmentValue = Math.max(0, commitment.awardedValue || 0);
  if (targetValue > 0 && commitmentValue > 0) {
    const ratio = Math.abs(commitmentValue - targetValue) / targetValue;
    if (ratio <= 0.15) {
      score += 18;
      reasons.push('value aligned');
    } else if (ratio <= 0.35) {
      score += 12;
      reasons.push('value close');
    } else if (ratio <= 0.6) {
      score += 6;
    }
  }

  return { score, reasons };
}

export function CostLineDetailPanel({
  open,
  line,
  commitments,
  onUpdate,
  onClose,
  readOnly,
}: {
  open: boolean;
  line: CbsLineItem;
  commitments: CommitmentEntry[];
  onUpdate: (patch: Partial<CbsLineItem>) => void;
  onClose: () => void;
  readOnly: boolean;
}) {
  const ext = lineExtended(line);
  const isCapex = line.costClass === 'CAPEX';
  const classTone = isCapex
    ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
  const _sourceLabel = line.source === 'business-case' ? 'Business case' : line.source === 'wbs' ? 'WBS' : 'Manual';

  const contracts = useMemo(() => Array.isArray(line.contracts) ? line.contracts : [], [line.contracts]);
  const subTasks = Array.isArray(line.subTasks) ? line.subTasks : [];
  const years = useMemo(() => Array.isArray(line.yearBreakdown) ? line.yearBreakdown : [], [line.yearBreakdown]);
  const isRecurringLine = line.segment === 'operations' || line.segment === 'maintenance';

  const displayYears = useMemo(() => {
    if (!isRecurringLine) return years.map((year) => ({ ...year, isPadded: false }));
    const byYear = new Map<number, { year: number; amount: number; label?: string }>();
    years.forEach((year) => {
      if (typeof year.year === 'number') byYear.set(year.year, year);
    });
    const next: Array<{ year: number; amount: number; label?: string; isPadded: boolean }> = [];
    for (let year = 1; year <= 5; year += 1) {
      const existing = byYear.get(year);
      if (existing) next.push({ ...existing, isPadded: false });
      else next.push({ year, amount: 0, label: `Year ${year}`, isPadded: true });
    }
    years
      .filter((year) => typeof year.year === 'number' && (year.year < 1 || year.year > 5))
      .forEach((year) => next.push({ ...year, isPadded: false }));
    return next.sort((a, b) => a.year - b.year);
  }, [isRecurringLine, years]);

  const persistYears = (next: Array<{ year: number; amount: number; label?: string; isPadded: boolean }>) => {
    const anyNonZero = next.some((year) => year.amount > 0);
    const persisted = anyNonZero
      ? next.map((year) => ({ year: year.year, amount: year.amount, label: year.label }))
      : next.filter((year) => !year.isPadded).map((year) => ({ year: year.year, amount: year.amount, label: year.label }));
    onUpdate({ yearBreakdown: persisted });
  };
  const updateYear = (yearValue: number, amount: number) => {
    const next = displayYears.map((year) => (year.year === yearValue ? { ...year, amount, isPadded: false } : year));
    persistYears(next);
  };
  const addYear = () => {
    const maxYear = displayYears.reduce((max, year) => Math.max(max, year.year), 0);
    persistYears([...displayYears, { year: maxYear + 1, amount: 0, label: `Year ${maxYear + 1}`, isPadded: false }]);
  };
  const removeYear = (yearValue: number) => {
    persistYears(displayYears.filter((year) => year.year !== yearValue));
  };

  const addContract = () => {
    onUpdate({
      contracts: [
        ...contracts,
        { id: uid(), vendor: 'New vendor', reference: '', annualValue: 0, status: 'draft' },
      ],
    });
  };
  const updateContract = (id: string, patch: Partial<BcLineContract>) => {
    onUpdate({ contracts: contracts.map((contract) => (contract.id === id ? { ...contract, ...patch } : contract)) });
  };
  const removeContract = (id: string) => onUpdate({ contracts: contracts.filter((contract) => contract.id !== id) });

  const addSubTask = () => {
    onUpdate({
      subTasks: [
        ...subTasks,
        { id: uid(), description: 'New sub-task', amount: 0, status: 'pending' },
      ],
    });
  };
  const updateSubTask = (id: string, patch: Partial<CbsLineSubTask>) => {
    onUpdate({ subTasks: subTasks.map((task) => (task.id === id ? { ...task, ...patch } : task)) });
  };
  const removeSubTask = (id: string) => onUpdate({ subTasks: subTasks.filter((task) => task.id !== id) });

  const linkCommitment = (entry: CommitmentEntry) => {
    const exists = contracts.some((contract) => contract.reference === entry.ref);
    if (exists) return;
    onUpdate({
      contracts: [
        ...contracts,
        {
          id: uid(),
          vendor: entry.vendor,
          reference: entry.ref,
          scope: entry.scope ?? entry.description ?? '',
          startDate: entry.startDate,
          endDate: entry.endDate,
          dueDate: entry.dueDate,
          annualValue: entry.awardedValue,
          status: entry.status === 'awarded' || entry.status === 'in_progress' ? 'active' : entry.status === 'closed' ? 'expired' : 'draft',
          notes: `Linked from ${entry.ref}`,
        },
      ],
    });
  };

  const linkedRefs = useMemo(() => new Set(contracts.map((contract) => contract.reference).filter((reference): reference is string => Boolean(reference))), [contracts]);
  const suggestedMatches = useMemo(() => {
    return commitments
      .map((commitment) => ({
        entry: commitment,
        ...matchCommitmentToLine(line, ext.withContingency, commitment),
      }))
      .filter((match) => match.score >= 24 && !linkedRefs.has(match.entry.ref))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [commitments, ext.withContingency, line, linkedRefs]);

  const activeContracts = contracts.filter((contract) => contract.status === 'active' || contract.status === 'renewal');
  const nextContractDue = [...contracts]
    .filter((contract) => Boolean(contract.dueDate) && contract.status !== 'expired' && contract.status !== 'terminated')
    .sort((left, right) => (left.dueDate ?? '').localeCompare(right.dueDate ?? ''))[0];
  const yearsTotal = years.reduce((sum, year) => sum + (year.amount || 0), 0);
  const coverageTarget = yearsTotal > 0 ? yearsTotal : ext.withContingency;
  const contractCoverageValue = activeContracts.reduce((sum, contract) => {
    const contractValue = contract.annualValue || 0;
    if (yearsTotal > 0) return sum + contractValue * yearsOfCoverage(contract);
    return sum + contractValue;
  }, 0);
  const contractCoveragePct = coverageTarget > 0 ? Math.min(100, (contractCoverageValue / coverageTarget) * 100) : 0;
  const contractGap = coverageTarget - contractCoverageValue;

  const subTaskTotal = subTasks.reduce((sum, task) => sum + (task.amount || 0), 0);
  const subTaskGap = ext.base - subTaskTotal;
  const subTaskGapPct = ext.base > 0 ? Math.abs(subTaskGap) / ext.base : 0;
  const hasProcurementNeed = line.category === 'material' || line.category === 'equipment' || line.category === 'subcontractor' || line.costClass === 'OPEX';
  const hasExecutionSignals = num(line.committed) > 0 || num(line.actual) > 0;

  const insights: Array<{ tone: SmartTone; label: string; detail: string }> = [];
  if (hasProcurementNeed && contracts.length === 0) {
    insights.push({ tone: 'warn', label: 'Procurement gap', detail: 'No PO or contract is linked to this line yet' });
  }
  if (contracts.length > 0 && contractCoveragePct < 75) {
    insights.push({ tone: 'warn', label: 'Coverage gap', detail: `Linked procurement covers ${contractCoveragePct.toFixed(0)}% of the target value` });
  }
  if (subTasks.length === 0 && ext.base >= 50000) {
    insights.push({ tone: 'warn', label: 'Needs work packages', detail: 'Large line should be decomposed before execution' });
  } else if (subTasks.length > 0 && subTaskGapPct > 0.15) {
    insights.push({ tone: 'warn', label: 'Sub-task mismatch', detail: `Decomposition is off by ${AED(Math.abs(Math.round(subTaskGap)))}` });
  }
  if (isRecurringLine && years.length === 0) {
    insights.push({ tone: 'warn', label: 'Missing run profile', detail: 'Recurring line has no year-by-year spend profile yet' });
  }
  if (suggestedMatches.length > 0) {
    insights.push({ tone: 'info', label: 'Reference match', detail: `Best match: ${suggestedMatches[0]?.entry.ref ?? 'n/a'}` });
  }
  if (hasExecutionSignals) {
    insights.push({ tone: 'info', label: 'Execution signals exist', detail: 'Committed / actual burn should be managed in Execution Cost & Procurement' });
  }
  if (insights.length === 0) {
    insights.push({ tone: 'good', label: 'Healthy line', detail: 'Baseline, sourcing setup, and package definition look coherent' });
  }

  let readiness = 35;
  if (ext.base > 0) readiness += 10;
  if (!hasProcurementNeed || contracts.length > 0) readiness += 15;
  else if (suggestedMatches.length > 0) readiness += 8;
  if (subTasks.length > 0) readiness += subTaskGapPct <= 0.15 ? 12 : 6;
  if (!isRecurringLine || years.length > 0) readiness += 10;
  if (contractCoveragePct >= 80) readiness += 10;
  if (hasProcurementNeed && contracts.length === 0 && suggestedMatches.length === 0) readiness -= 10;
  readiness = Math.max(0, Math.min(100, readiness));

  const readinessTone: SmartTone = readiness >= 80 ? 'good' : readiness >= 60 ? 'warn' : 'bad';
  const readinessLabel = readiness >= 80 ? 'Baseline-ready' : readiness >= 60 ? 'Needs planning detail' : 'Planning risk';
  const summary = hasProcurementNeed && contracts.length === 0
    ? 'This line is priced, but the sourcing setup is still incomplete for planning handoff.'
    : subTasks.length === 0 && ext.base >= 50000
    ? 'The budget is anchored, but the work-package design is still too coarse for an orderly execution handoff.'
    : isRecurringLine && years.length === 0
    ? 'Recurring spend exists without a full planning profile. Define the run-year ladder before release.'
    : 'This line is well defined for planning: baseline, sourcing setup, and package logic are largely in place.';

  const bestSuggested = suggestedMatches[0];

  const actionCards: Array<{ id: string; tone: SmartTone; label: string; hint: string; onClick: () => void; disabled?: boolean }> = [];
  if (bestSuggested) {
    actionCards.push({
      id: 'link-best-po',
      tone: 'info',
      label: `Link ${bestSuggested.entry.ref}`,
      hint: `${bestSuggested.entry.vendor} · ${AED(bestSuggested.entry.awardedValue)} · ${bestSuggested.score}% fit`,
      onClick: () => linkCommitment(bestSuggested.entry),
      disabled: readOnly,
    });
  }
  if (contracts.length === 0 || contractCoveragePct < 70) {
    actionCards.push({
      id: 'add-contract',
      tone: 'warn',
      label: 'Create draft contract shell',
      hint: 'Add the commercial shell now, then complete vendor, dates, and value.',
      onClick: addContract,
      disabled: readOnly,
    });
  }
  if (subTasks.length === 0 && ext.base > 0) {
    actionCards.push({
      id: 'seed-subtasks',
      tone: 'info',
      label: 'Seed work packages',
      hint: 'Create a 3-part breakdown that reconciles to the base line value.',
      onClick: () => onUpdate({ subTasks: buildSuggestedSubTasks(line, ext.base) }),
      disabled: readOnly,
    });
  }

  const maxYearAmount = Math.max(1, ...displayYears.map((year) => year.amount || 0));

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[520px] p-0 sm:max-w-[520px] flex flex-col">
        <SheetHeader className="border-b bg-card px-6 py-5 text-left">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-lg">Cost line intelligence</SheetTitle>
                <Badge variant="outline" className={`h-5 gap-1 px-1.5 text-[9px] uppercase tracking-[0.1em] ${smartToneBadgeClass(readinessTone)}`}>
                  {readinessLabel}
                </Badge>
                <span className={`inline-flex h-[18px] items-center rounded border px-1.5 font-mono text-[9.5px] font-bold tracking-[0.08em] ${classTone}`}>
                  {line.costClass}
                </span>
              </div>
              <SheetDescription className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">{line.wbsCode || '-'}</span>
                <span>{line.description || 'Untitled line'}</span>
              </SheetDescription>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className={`text-2xl font-bold tabular-nums ${smartToneTextClass(readinessTone)}`}>{readiness}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Planning</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{contractCoveragePct.toFixed(0)}%</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Sourcing</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{subTasks.length}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Packages</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Planning confidence</span>
              <span className={`font-medium ${smartToneTextClass(readinessTone)}`}>{summary}</span>
            </div>
            <Progress value={readiness} className="h-2" />
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-6">
          <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50/60 p-3 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Planning posture
                </div>
                <div className="mt-1 flex items-end gap-2">
                  <span className={`text-[28px] font-semibold leading-none tabular-nums ${smartToneTextClass(readinessTone)}`}>
                    {readiness}
                  </span>
                  <span className={`pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${smartToneTextClass(readinessTone)}`}>
                    {readinessLabel}
                  </span>
                </div>
              </div>
              <Badge variant="outline" className={`h-5 px-1.5 text-[9px] uppercase tracking-[0.12em] ${smartToneBadgeClass(readinessTone)}`}>
                Smart panel
              </Badge>
            </div>
            <Progress value={readiness} className="mt-3 h-1.5" />
            <p className="mt-3 text-[12px] leading-5 text-slate-600 dark:text-slate-300">
              {summary}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {insights.slice(0, 4).map((insight) => (
                <span
                  key={`${insight.label}-${insight.detail}`}
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${smartToneBadgeClass(insight.tone)}`}
                  title={insight.detail}
                >
                  {insight.label}
                </span>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Next best moves
                </div>
                <div className="text-[11.5px] text-slate-500 dark:text-slate-400">
                  One-click actions that improve definition quality before execution handoff.
                </div>
              </div>
              <Sparkles className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            </div>
            {actionCards.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-[11.5px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No urgent remediation action is outstanding on this line.
              </div>
            ) : (
              <div className="grid gap-2">
                {actionCards.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${smartToneBadgeClass(action.tone)}`}
                  >
                    <div className="min-w-0">
                      <div className="text-[11.5px] font-semibold">{action.label}</div>
                      <div className="mt-0.5 text-[10.5px] opacity-80">{action.hint}</div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Phase boundary
                </div>
                <div className="text-[11.5px] text-slate-500 dark:text-slate-400">
                  Planning owns the baseline and sourcing setup. Execution owns live burn.
                </div>
              </div>
              <Activity className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10.5px]">
              <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <div className="font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Planning owns</div>
                <div className="mt-1 space-y-1 text-[11px] text-slate-700 dark:text-slate-200">
                  <div>Baseline amount and contingency</div>
                  <div>Sourcing setup and contract shells</div>
                  <div>Work-package design and run profile</div>
                </div>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <div className="font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Execution owns</div>
                <div className="mt-1 space-y-1 text-[11px] text-slate-700 dark:text-slate-200">
                  <div>Committed PO / contract drawdown</div>
                  <div>Actual spend and invoice burn</div>
                  <div>Live variance and supplier performance</div>
                </div>
              </div>
            </div>
            <div className={`mt-3 rounded-md border px-3 py-2 text-[11px] ${smartToneBadgeClass(hasExecutionSignals ? 'info' : 'good')}`}>
              {hasExecutionSignals
                ? 'Execution data already exists on this line. Manage committed and actual burn in the Execution Cost & Procurement Hub, not in Planning.'
                : 'No live execution burn is surfaced here. This planning sheet intentionally stops at baseline definition and procurement setup.'}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Procurement setup
                </div>
                <div className="text-[11.5px] text-slate-500 dark:text-slate-400">
                  Define sourcing packages, draft contract shells, and handoff references for execution.
                </div>
              </div>
              <Receipt className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-md bg-slate-50 px-3 py-2 text-[10.5px] dark:bg-slate-800/60">
              <BreakdownCell label="Coverage" value={`${contractCoveragePct.toFixed(0)}%`} />
              <BreakdownCell label="Linked" value={AED(contractCoverageValue)} />
              <BreakdownCell label="Gap" value={contractGap >= 0 ? AED(Math.round(contractGap)) : `-${AED(Math.round(Math.abs(contractGap)))}`} />
            </div>

            {nextContractDue && (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                <Calendar className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                <span>
                  Next planned due date <span className="font-semibold text-slate-900 dark:text-white">{prettyPlanDate(nextContractDue.dueDate)}</span>
                  {' '}· {nextContractDue.reference || nextContractDue.vendor}
                </span>
              </div>
            )}

            {suggestedMatches.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Available references
                </div>
                {suggestedMatches.map((match) => (
                  <div key={match.entry.id} className="flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-900 dark:text-white">
                          {match.entry.ref}
                        </span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${smartToneBadgeClass(match.score >= 70 ? 'good' : 'info')}`}>
                          {match.score}% fit
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[11.5px] font-medium text-slate-700 dark:text-slate-200">
                        {match.entry.vendor}
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                        {match.reasons.join(' · ') || 'same commercial context'}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[11px] font-semibold tabular-nums text-slate-900 dark:text-white">
                        {AED(match.entry.awardedValue)}
                      </div>
                      <Button size="sm" variant="outline" className="mt-1 h-6 px-2 text-[10.5px]" onClick={() => linkCommitment(match.entry)} disabled={readOnly}>
                        <Link2 className="mr-1 h-3 w-3" /> Link
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3">
              <div className="mb-1.5 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Attached procurement ({contracts.length})
                  </div>
                  <div className="mt-1 text-[10.5px] text-slate-500 dark:text-slate-400">
                    Term dates define planning coverage. Due date marks the payment or reminder checkpoint.
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={addContract} disabled={readOnly}>
                  <Plus className="mr-1 h-3 w-3" /> Add
                </Button>
              </div>
              {contracts.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-[11.5px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No PO or contract linked yet.
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800/60">
                    <div className="grid grid-cols-[1fr_96px] gap-1.5 px-6 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                      <span>Vendor</span>
                      <span>Reference</span>
                    </div>
                    <div className="mt-1 grid grid-cols-[1fr_112px] gap-1.5 px-6 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                      <span>Scope</span>
                      <span className="text-right">Value</span>
                    </div>
                    <div className="mt-1 grid grid-cols-[1fr_1fr] gap-1.5 px-6 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                      <span>Term start</span>
                      <span>Term end</span>
                    </div>
                    <div className="mt-1 grid grid-cols-[1fr_96px] gap-1.5 px-6 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                      <span>Payment due</span>
                      <span>Status</span>
                    </div>
                  </div>
                  <ul className="space-y-1.5">
                    {contracts.map((contract) => (
                      <li key={contract.id} className="group rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-start gap-2">
                          <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="grid grid-cols-[1fr_96px] gap-1.5">
                              <Input
                                value={contract.vendor}
                                placeholder="Vendor"
                                onChange={(e) => updateContract(contract.id, { vendor: e.target.value })}
                                disabled={readOnly}
                                className="h-7 text-[11.5px] font-medium"
                              />
                              <Input
                                value={contract.reference ?? ''}
                                placeholder="PO-####"
                                onChange={(e) => updateContract(contract.id, { reference: e.target.value })}
                                disabled={readOnly}
                                className="h-7 font-mono text-[11px] tabular-nums"
                              />
                            </div>
                            <div className="grid grid-cols-[1fr_112px] gap-1.5">
                              <Input
                                value={contract.scope ?? ''}
                                placeholder="Scope"
                                onChange={(e) => updateContract(contract.id, { scope: e.target.value })}
                                disabled={readOnly}
                                className="h-7 text-[11.5px]"
                              />
                              <Input
                                type="number"
                                min={0}
                                value={contract.annualValue}
                                placeholder="Value"
                                onChange={(e) => updateContract(contract.id, { annualValue: Number(e.target.value) || 0 })}
                                disabled={readOnly}
                                className="h-7 text-right font-mono text-[11px] tabular-nums"
                              />
                            </div>
                            <div className="grid grid-cols-[1fr_1fr] gap-1.5">
                              <Input
                                type="date"
                                value={contract.startDate?.slice(0, 10) ?? ''}
                                onChange={(e) => updateContract(contract.id, { startDate: e.target.value })}
                                disabled={readOnly}
                                aria-label="Contract term start date"
                                className="h-7 text-[11px] tabular-nums"
                              />
                              <Input
                                type="date"
                                value={contract.endDate?.slice(0, 10) ?? ''}
                                onChange={(e) => updateContract(contract.id, { endDate: e.target.value })}
                                disabled={readOnly}
                                aria-label="Contract term end date"
                                className="h-7 text-[11px] tabular-nums"
                              />
                            </div>
                            <div className="grid grid-cols-[1fr_96px] gap-1.5">
                              <Input
                                type="date"
                                value={contract.dueDate?.slice(0, 10) ?? ''}
                                onChange={(e) => updateContract(contract.id, { dueDate: e.target.value })}
                                disabled={readOnly}
                                aria-label="Planned payment due date"
                                className="h-7 text-[11px] tabular-nums"
                              />
                              <Select
                                value={contract.status}
                                onValueChange={(value) => updateContract(contract.id, { status: value as BcLineContract['status'] })}
                                disabled={readOnly}
                              >
                                <SelectTrigger className="h-7 text-[11px] capitalize">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="draft">Draft</SelectItem>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="renewal">Renewal</SelectItem>
                                  <SelectItem value="expired">Expired</SelectItem>
                                  <SelectItem value="terminated">Terminated</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeContract(contract.id)}
                            disabled={readOnly}
                            className="invisible h-6 w-6 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 group-hover:visible disabled:invisible dark:hover:bg-rose-500/10"
                            aria-label="Remove contract"
                          >
                            <Trash2 className="mx-auto h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Work package design
                </div>
                <div className="text-[11.5px] text-slate-500 dark:text-slate-400">
                  Define the execution packages that this planning line will hand off downstream.
                </div>
              </div>
              <ListTree className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-md bg-slate-50 px-3 py-2 text-[10.5px] dark:bg-slate-800/60">
              <BreakdownCell label="Base" value={AED(ext.base)} />
              <BreakdownCell label="Sub-tasks" value={AED(subTaskTotal)} />
              <BreakdownCell label="Gap" value={subTaskGap >= 0 ? AED(Math.round(subTaskGap)) : `-${AED(Math.round(Math.abs(subTaskGap)))}`} />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Work packages ({subTasks.length})
              </span>
              <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={addSubTask} disabled={readOnly}>
                <Plus className="mr-1 h-3 w-3" /> Sub-task
              </Button>
            </div>
            {subTasks.length === 0 ? (
              <div className="mt-2 rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-[11.5px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No work-package design yet.
              </div>
            ) : (
              <div className="mt-2 space-y-1">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="grid grid-cols-[1fr_96px_96px_28px] items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                    <span>Description</span>
                    <span>Owner</span>
                    <span className="text-right">Amount</span>
                    <span className="sr-only">Actions</span>
                  </div>
                </div>
                <ul className="space-y-1">
                  {subTasks.map((task) => (
                    <li key={task.id} className="group grid grid-cols-[1fr_96px_96px_28px] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
                      <Input
                        value={task.description}
                        onChange={(e) => updateSubTask(task.id, { description: e.target.value })}
                        disabled={readOnly}
                        className="h-7 border-0 bg-transparent px-1 text-[11.5px] shadow-none focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-indigo-400 dark:focus-visible:bg-slate-800"
                      />
                      <Input
                        value={task.owner ?? ''}
                        placeholder="Owner"
                        onChange={(e) => updateSubTask(task.id, { owner: e.target.value })}
                        disabled={readOnly}
                        className="h-7 border-0 bg-transparent px-1 text-[11.5px] shadow-none focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-indigo-400 dark:focus-visible:bg-slate-800"
                      />
                      <Input
                        type="number"
                        min={0}
                        value={task.amount}
                        onChange={(e) => updateSubTask(task.id, { amount: Number(e.target.value) || 0 })}
                        disabled={readOnly}
                        className="h-7 border-0 bg-transparent px-1 text-right font-mono text-[11px] tabular-nums shadow-none focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-indigo-400 dark:focus-visible:bg-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => removeSubTask(task.id)}
                        disabled={readOnly}
                        className="invisible flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 group-hover:visible disabled:invisible dark:hover:bg-rose-500/10"
                        aria-label="Remove sub-task"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {(isRecurringLine || years.length > 0) && (
            <section className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Run profile
                  </div>
                  <div className="text-[11.5px] text-slate-500 dark:text-slate-400">
                    Year-by-year profile for recurring or multi-year lines.
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={addYear} disabled={readOnly}>
                  <Plus className="mr-1 h-3 w-3" /> Year
                </Button>
              </div>
              <div className="space-y-1.5">
                {displayYears.map((year) => (
                  <div key={year.year} className="grid grid-cols-[52px_1fr_94px_24px] items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                      {year.label ?? `Y${year.year}`}
                    </span>
                    <div className="h-1.5 w-full overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-sm bg-gradient-to-r from-sky-500 to-indigo-500" style={{ width: `${Math.min(100, ((year.amount || 0) / maxYearAmount) * 100)}%` }} />
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={year.amount}
                      onChange={(e) => updateYear(year.year, Number(e.target.value) || 0)}
                      disabled={readOnly}
                      className="h-7 text-right font-mono text-[11px] tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => removeYear(year.year)}
                      disabled={readOnly || (isRecurringLine && year.year >= 1 && year.year <= 5 && year.isPadded)}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-rose-500/10"
                      aria-label="Remove year"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Commercial model
                </div>
                <div className="text-[11.5px] text-slate-500 dark:text-slate-400">
                  Core pricing mechanics for the selected cost line.
                </div>
              </div>
              <FileText className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <DetailField label="Description">
                  <Input
                    value={line.description}
                    onChange={(e) => onUpdate({ description: e.target.value })}
                    disabled={readOnly}
                    className="h-8 text-[12.5px]"
                  />
                </DetailField>
              </div>
              <DetailField label="Quantity">
                <Input
                  type="number"
                  min={0}
                  value={line.quantity}
                  onChange={(e) => onUpdate({ quantity: Number(e.target.value) || 0 })}
                  disabled={readOnly}
                  className="h-8 tabular-nums text-[12.5px]"
                />
              </DetailField>
              <DetailField label="Unit">
                <Input
                  value={line.unit}
                  onChange={(e) => onUpdate({ unit: e.target.value })}
                  disabled={readOnly}
                  className="h-8 text-[12.5px]"
                />
              </DetailField>
              <DetailField label="Unit rate (AED)">
                <Input
                  type="number"
                  min={0}
                  value={line.unitRate}
                  onChange={(e) => onUpdate({ unitRate: Number(e.target.value) || 0 })}
                  disabled={readOnly}
                  className="h-8 tabular-nums text-[12.5px]"
                />
              </DetailField>
              <DetailField label="Category">
                <Select
                  value={line.category}
                  onValueChange={(value) => onUpdate({ category: value as CbsLineItem['category'] })}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-8 text-[12.5px] capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="labor">Labor</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="material">Material</SelectItem>
                    <SelectItem value="subcontractor">Subcontractor</SelectItem>
                    <SelectItem value="overhead">Overhead</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </DetailField>
              <DetailField label="Markup %">
                <Input
                  type="number"
                  min={0}
                  value={line.markupPct}
                  onChange={(e) => onUpdate({ markupPct: Number(e.target.value) || 0 })}
                  disabled={readOnly}
                  className="h-8 tabular-nums text-[12.5px]"
                />
              </DetailField>
              <DetailField label="Contingency %">
                <Input
                  type="number"
                  min={0}
                  value={line.contingencyPct}
                  onChange={(e) => onUpdate({ contingencyPct: Number(e.target.value) || 0 })}
                  disabled={readOnly}
                  className="h-8 tabular-nums text-[12.5px]"
                />
              </DetailField>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-slate-50 px-3 py-2 text-[10.5px] dark:bg-slate-800/60">
              <BreakdownCell label="Base" value={AED(ext.base)} />
              <BreakdownCell label="Markup" value={AED(ext.withMarkup - ext.base)} />
              <BreakdownCell label="Contingency" value={AED(ext.withContingency - ext.withMarkup)} />
            </div>
          </section>
        </div>
      </ScrollArea>

        <div className="mt-auto border-t bg-card px-6 py-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
            {bestSuggested ? (
              <Button onClick={() => linkCommitment(bestSuggested.entry)} disabled={readOnly} className="flex-1 gap-2">
                <Link2 className="h-4 w-4" />
                Link {bestSuggested.entry.ref}
              </Button>
            ) : (
              <Button onClick={addContract} disabled={readOnly} className="flex-1 gap-2">
                <Plus className="h-4 w-4" />
                Add contract
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      {children}
    </label>
  );
}

function BreakdownCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">{label}</div>
      <div className="mt-0.5 font-semibold tabular-nums text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}
