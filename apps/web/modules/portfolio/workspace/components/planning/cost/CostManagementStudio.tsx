/**
 * Cost Management Studio
 * ----------------------
 * Professional, end-to-end cost planning & management experience for the
 * Planning phase of a project workspace. Delivers:
 *
 *  • Executive KPI cockpit (BAC, AC, EV, EAC, VAC, CPI, SPI, reserves)
 *  • Health Compass (Funding / Commitment / Schedule / Reserve)
 *  • Cost Breakdown Structure (WBS-aligned CBS) with unit-rate engine
 *  • Rate Card (labor, equipment, material, subcontractor)
 *  • Cashflow & S-curve phasing (monthly)
 *  • Commitment register (POs, contracts, drawdown)
 *  • Earned Value Management (EVM) performance dashboard
 *  • Contingency reserve + Management reserve + Change log
 *
 * State is initialized from `project.metadata.costPlan` and persisted back via
 * PATCH /api/portfolio/projects/:id with a merged metadata payload.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Gauge,
  Layers,
  Link2,
  LineChart,
  ListTree,
  Loader2,
  Lock,
  Plus,
  Save,
  Download,
  FileSignature,
  Scale,
  Shield,
  FileCheck,
  Flame,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

import type { BusinessCaseData, ProjectData, WbsTaskData } from '../../../types';
import type {
  BcLineContract,
  CbsLineItem,
  CbsLineSubTask,
  ChangeLogEntry,
  CommitmentEntry,
  CostPlanState,
  CostViewId,
  RateCardEntry,
  ReserveState,
} from './CostManagementStudio.types';
export type {
  BcLineContract,
  CbsLineItem,
  CbsLineSubTask,
  ChangeLogEntry,
  CommitmentEntry,
  CostPlanState,
  CostViewId,
  RateCardEntry,
  ReserveState,
} from './CostManagementStudio.types';
import { CostLineDetailPanel } from './CostLineDetailPanel';
import {
  AED,
  allocateCbsToBac,
  buildInitialPlan,
  computeEvm,
  computePhasing,
  lineExtended,
  num,
  prettyPlanDate,
  resolveApprovedBudget,
  resolveBusinessCaseCashProfile,
  resolveBusinessCaseSegments,
  resolveBusinessCaseVitals,
  seedBusinessCaseAnchors,
  seedCbsFromTasks,
  toPct,
  uid,
  type BacResolution,
  type BusinessCaseCashProfile,
  type BusinessCaseSegmentTotals,
  type BusinessCaseVitals,
  type EvmMetrics,
} from './CostManagementStudio.model';
export type {
  BacResolution,
  BusinessCaseCashProfile,
  BusinessCaseSegmentTotals,
  BusinessCaseVitals,
  EvmMetrics,
} from './CostManagementStudio.model';

// ────────────────────────────────────────────────────────────────────────────
// Types — persisted cost plan shape
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// COREVIA advisory — derive the single highest-leverage action
// ────────────────────────────────────────────────────────────────────────────

interface Advisory {
  tone: 'info' | 'good' | 'warn' | 'bad';
  headline: string;
  body: string;
  cta?: { label: string; view: CostViewId };
  /**
   * Structured offenders that make the advisory concrete. Rendered as chips
   * under the body so users can see *which* items are flagged (e.g. the
   * specific deliverables that have no CBS price).
   */
  details?: string[];
  /**
   * A one-click fix action. When present, rendered as the primary button on
   * the advisory strip. Resolves the root cause directly rather than forcing
   * the user to manually reconcile.
   */
  action?: { label: string; kind: 'price-unpriced-deliverables' };
}

function _computeAdvisory({
  evm,
  plan,
  baselineTotals,
  tasks,
}: {
  evm: EvmMetrics;
  plan: CostPlanState;
  baselineTotals: { contingencyPool: number; managementPool: number } & Record<string, number>;
  tasks: WbsTaskData[];
}): Advisory {
  // Deliverable ↔ CBS alignment — any *deliverable* without priced CBS lines breaks payment-right phasing.
  // Milestones are gates (acceptance events, not cost accumulators); their payment only exists when an
  // explicit fixed fee is entered, so absence isn't an advisory signal.
  const deliverables = tasks.filter((t) => t.taskType === 'deliverable');
  const cbsCodes = new Set(plan.cbs.map((l) => l.wbsCode).filter(Boolean));
  const cbsBranches = plan.cbs.map((l) => l.wbsCode).filter(Boolean);
  const unpricedDeliverables = deliverables.filter((t) => {
    if (num(t.plannedCost) > 0) return false;
    const code = t.wbsCode?.trim();
    if (!code) return true;
    // Priced if CBS has an exact match OR any descendant line under this branch (rollup).
    if (cbsCodes.has(code)) return false;
    const root = code.endsWith('.0') ? code.slice(0, -2) : code;
    const prefix = `${root}.`;
    if (cbsBranches.some((c) => c.startsWith(prefix))) return false;
    return true;
  });
  const contingencyUsageRatio = baselineTotals.contingencyPool > 0
    ? plan.reserves.contingencyUsed / baselineTotals.contingencyPool
    : 0;
  const commitmentRatio = evm.bac > 0 ? evm.committed / evm.bac : 0;
  const proposedChanges = plan.changes.filter((c) => c.status === 'proposed').length;

  // Priority cascade — return the most pressing advisory
  if (plan.cbs.length === 0) {
    return {
      tone: 'info',
      headline: 'Seed your Cost Breakdown Structure',
      body: 'No CBS lines yet. Pull in WBS work packages, apply unit rates and build the baseline.',
      cta: { label: 'Open baseline', view: 'baseline' },
    };
  }
  if (unpricedDeliverables.length > 0 && deliverables.length > 0) {
    const details = unpricedDeliverables.slice(0, 6).map((d) => {
      const code = d.wbsCode?.trim();
      const title = (d.taskName || d.title || 'Untitled deliverable').trim();
      return code ? `${code} · ${title}` : title;
    });
    if (unpricedDeliverables.length > details.length) {
      details.push(`+${unpricedDeliverables.length - details.length} more`);
    }
    return {
      tone: 'warn',
      headline: `${unpricedDeliverables.length} deliverable${unpricedDeliverables.length > 1 ? 's' : ''} not priced in CBS`,
      body: 'Delivery-based payment rights cannot phase cashflow for deliverables that lack a planned cost or a matching CBS line (by WBS code). Price them to align cost plan with the delivery schedule.',
      details,
      action: { label: `Price ${unpricedDeliverables.length} deliverable${unpricedDeliverables.length > 1 ? 's' : ''}`, kind: 'price-unpriced-deliverables' },
      cta: { label: 'Open baseline', view: 'baseline' },
    };
  }
  if (evm.cpi < 0.9) {
    return {
      tone: 'bad',
      headline: `Cost performance critical — CPI ${evm.cpi.toFixed(2)}`,
      body: `Earning ${(evm.cpi * 100).toFixed(0)} fils of value for every 1 AED spent. Run the scenario modeler and flag the top cost drivers for re-estimation.`,
      cta: { label: 'Run EVM scenarios', view: 'evm' },
    };
  }
  if (commitmentRatio > 1.05) {
    return {
      tone: 'bad',
      headline: 'Over-committed against approved budget',
      body: `Commitments now ${(commitmentRatio * 100).toFixed(0)}% of BAC. Trigger a change request or defer awards until the baseline is re-approved.`,
      cta: { label: 'Open commitments', view: 'commitments' },
    };
  }
  if (evm.spi < 0.9) {
    return {
      tone: 'warn',
      headline: `Schedule slipping — SPI ${evm.spi.toFixed(2)}`,
      body: 'Earned value is trailing planned value. Review the S-curve for the slip month and check resource contention in the WBS.',
      cta: { label: 'Inspect cashflow', view: 'cashflow' },
    };
  }
  if (contingencyUsageRatio > 0.75) {
    return {
      tone: 'warn',
      headline: 'Contingency reserve depleting fast',
      body: `Used ${(contingencyUsageRatio * 100).toFixed(0)}% of the contingency pool. Log draws as CRs and consider tapping management reserve only for unknown-unknowns.`,
      cta: { label: 'Open reserves', view: 'reserves' },
    };
  }
  if (proposedChanges > 0) {
    return {
      tone: 'info',
      headline: `${proposedChanges} change request${proposedChanges > 1 ? 's' : ''} awaiting decision`,
      body: 'Unresolved CRs distort the forecast. Disposition them before the next stage gate.',
      cta: { label: 'Review change log', view: 'reserves' },
    };
  }
  if (!plan.baselineLockedAt && evm.bac > 0 && plan.cbs.length >= 3) {
    return {
      tone: 'info',
      headline: 'Ready to lock the baseline',
      body: 'CBS is populated and BAC is aligned. Locking freezes the envelope; all future movements flow through the change log.',
      cta: { label: 'Open baseline', view: 'baseline' },
    };
  }
  return {
    tone: 'good',
    headline: 'Cost plan is healthy',
    body: `CPI ${evm.cpi.toFixed(2)} · SPI ${evm.spi.toFixed(2)} · forecast ${evm.vac >= 0 ? `${AED(evm.vac)} under` : `${AED(Math.abs(evm.vac))} over`} budget. Maintain discipline and harvest variance into reserve headroom.`,
  };
}

function _CoreviaAdvisorStrip({
  advisory,
  onJump,
  onAction,
}: {
  advisory: Advisory;
  onJump: (view: CostViewId) => void;
  onAction?: (kind: NonNullable<Advisory['action']>['kind']) => void;
}) {
  const tones: Record<Advisory['tone'], { ring: string; icon: string; chip: string; Icon: React.ComponentType<{ className?: string }> }> = {
    info: {
      ring: 'from-indigo-50 via-white to-white dark:from-indigo-500/10 dark:via-slate-900 dark:to-slate-900 border-indigo-200/80 dark:border-indigo-500/30',
      icon: 'bg-indigo-600 text-white',
      chip: 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300',
      Icon: Sparkles,
    },
    good: {
      ring: 'from-emerald-50 via-white to-white dark:from-emerald-500/10 dark:via-slate-900 dark:to-slate-900 border-emerald-200/80 dark:border-emerald-500/30',
      icon: 'bg-emerald-600 text-white',
      chip: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
      Icon: CheckCircle2,
    },
    warn: {
      ring: 'from-amber-50 via-white to-white dark:from-amber-500/10 dark:via-slate-900 dark:to-slate-900 border-amber-200/80 dark:border-amber-500/30',
      icon: 'bg-amber-500 text-white',
      chip: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
      Icon: AlertTriangle,
    },
    bad: {
      ring: 'from-rose-50 via-white to-white dark:from-rose-500/10 dark:via-slate-900 dark:to-slate-900 border-rose-200/80 dark:border-rose-500/30',
      icon: 'bg-rose-600 text-white',
      chip: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
      Icon: Flame,
    },
  };
  const t = tones[advisory.tone];
  const Icon = t.Icon;
  return (
    <div className={`rounded-xl border bg-gradient-to-r px-2.5 py-1.5 shadow-[0_8px_22px_-24px_rgba(15,23,42,0.45)] ${t.ring}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${t.icon} shadow-sm`}>
          <Icon className="h-3 w-3" />
        </div>
        <Badge variant="outline" className={`h-4 shrink-0 gap-1 px-1 text-[9px] uppercase tracking-[0.14em] ${t.chip}`}>
          <Zap className="h-2 w-2" /> COREVIA
        </Badge>
        <span className="shrink-0 text-[12.5px] font-semibold tracking-tight text-slate-900 dark:text-white">{advisory.headline}</span>
        <span className="min-w-0 flex-1 truncate text-[11.5px] leading-tight text-slate-600 dark:text-slate-300" title={advisory.body}>{advisory.body}</span>
        <span className="hidden shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-slate-50/80 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 lg:inline-flex" title="COREVIA is aware of CBS, EVM, WBS, Risk, and portfolio context">CBS · EVM · WBS · Risk</span>
        {advisory.action && onAction && (
          <Button
            size="sm"
            className="h-6 shrink-0 gap-1 bg-slate-900 px-2 text-[11.5px] text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            onClick={() => advisory.action && onAction(advisory.action.kind)}
          >
            {advisory.action.label}
          </Button>
        )}
        {advisory.cta && (
          <Button size="sm" variant="outline" className="h-6 shrink-0 gap-1 px-2 text-[11.5px]" onClick={() => advisory.cta && onJump(advisory.cta.view)}>
            {advisory.cta.label}
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>
      {advisory.details && advisory.details.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-8">
          {advisory.details.map((d, i) => (
            <span
              key={`${d}-${i}`}
              className="inline-flex max-w-[280px] items-center gap-1 truncate rounded-md border border-slate-200 bg-white/70 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
              title={d}
            >
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// UI atoms
// ────────────────────────────────────────────────────────────────────────────

function _HealthPill({ tone, label, value }: { tone: 'green' | 'amber' | 'red' | 'slate'; label: string; value: string }) {
  const styles: Record<string, string> = {
    green: 'border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
    amber: 'border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
    red: 'border-rose-300/60 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
    slate: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  };
  return (
    <div className={`flex min-w-0 items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 ${styles[tone]}`}>
      <span className="truncate text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</span>
      <span className="shrink-0 text-sm font-bold tabular-nums">{value}</span>
    </div>
  );
}

// Compact inline status dot — used in the executive command strip
function StatusDot({ tone, label, value }: { tone: 'green' | 'amber' | 'red' | 'slate'; label: string; value: string }) {
  const dotStyles: Record<string, string> = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-rose-500',
    slate: 'bg-slate-400',
  };
  const textStyles: Record<string, string> = {
    green: 'text-emerald-700 dark:text-emerald-300',
    amber: 'text-amber-700 dark:text-amber-300',
    red: 'text-rose-700 dark:text-rose-300',
    slate: 'text-slate-600 dark:text-slate-300',
  };
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotStyles[tone]}`} />
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`truncate text-[11.5px] font-semibold tabular-nums ${textStyles[tone]}`}>{value}</span>
    </div>
  );
}

// Dense KPI cell for the executive command strip
function MetricCell({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const valueTone: Record<string, string> = {
    default: 'text-slate-900 dark:text-white',
    good: 'text-emerald-700 dark:text-emerald-300',
    warn: 'text-amber-700 dark:text-amber-300',
    bad: 'text-rose-700 dark:text-rose-300',
  };
  const subTone: Record<string, string> = {
    default: 'text-slate-500 dark:text-slate-400',
    good: 'text-emerald-600/80 dark:text-emerald-400/80',
    warn: 'text-amber-600/80 dark:text-amber-400/80',
    bad: 'text-rose-600/80 dark:text-rose-400/80',
  };
  return (
    <div className="min-w-0 px-2.5 py-1.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`truncate text-[13px] font-bold tabular-nums leading-tight ${valueTone[tone]}`} title={value}>{value}</div>
      {sub && <div className={`truncate text-[9.5px] leading-tight ${subTone[tone]}`} title={sub}>{sub}</div>}
    </div>
  );
}

// Executive cashflow KPI card — larger, hero-style presentation for the
// four headline numbers a sponsor cares about on the Cashflow tab.
function CashflowKpi({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone: 'indigo' | 'sky' | 'emerald' | 'amber' | 'rose';
}) {
  const tones: Record<typeof tone, { card: string; icon: string; label: string; value: string }> = {
    indigo: {
      card: 'border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-white dark:border-indigo-500/30 dark:from-indigo-500/10 dark:via-slate-900 dark:to-slate-900',
      icon: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
      label: 'text-indigo-700 dark:text-indigo-300',
      value: 'text-slate-900 dark:text-white',
    },
    sky: {
      card: 'border-sky-200 bg-gradient-to-br from-sky-50/70 via-white to-white dark:border-sky-500/30 dark:from-sky-500/10 dark:via-slate-900 dark:to-slate-900',
      icon: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
      label: 'text-sky-700 dark:text-sky-300',
      value: 'text-slate-900 dark:text-white',
    },
    emerald: {
      card: 'border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-white dark:border-emerald-500/30 dark:from-emerald-500/10 dark:via-slate-900 dark:to-slate-900',
      icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
      label: 'text-emerald-700 dark:text-emerald-300',
      value: 'text-emerald-700 dark:text-emerald-200',
    },
    amber: {
      card: 'border-amber-200 bg-gradient-to-br from-amber-50/70 via-white to-white dark:border-amber-500/30 dark:from-amber-500/10 dark:via-slate-900 dark:to-slate-900',
      icon: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
      label: 'text-amber-700 dark:text-amber-300',
      value: 'text-amber-800 dark:text-amber-200',
    },
    rose: {
      card: 'border-rose-200 bg-gradient-to-br from-rose-50/70 via-white to-white dark:border-rose-500/30 dark:from-rose-500/10 dark:via-slate-900 dark:to-slate-900',
      icon: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
      label: 'text-rose-700 dark:text-rose-300',
      value: 'text-rose-700 dark:text-rose-200',
    },
  };
  const t = tones[tone];
  return (
    <div className={`rounded-2xl border px-3 py-2.5 shadow-sm ${t.card}`}>
      <div className="flex items-start gap-2">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${t.label}`}>{label}</div>
          <div className={`mt-0.5 truncate text-[17px] font-bold leading-tight tabular-nums ${t.value}`} title={value}>{value}</div>
          {sub && <div className="mt-0.5 truncate text-[10.5px] leading-tight text-slate-500 dark:text-slate-400" title={sub}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function _KpiTile({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const toneStyles: Record<string, string> = {
    default: 'from-slate-50 to-white dark:from-slate-900 dark:to-slate-900 border-slate-200 dark:border-slate-700',
    good: 'from-emerald-50 to-white dark:from-emerald-500/10 dark:to-slate-900 border-emerald-200/80 dark:border-emerald-500/30',
    warn: 'from-amber-50 to-white dark:from-amber-500/10 dark:to-slate-900 border-amber-200/80 dark:border-amber-500/30',
    bad: 'from-rose-50 to-white dark:from-rose-500/10 dark:to-slate-900 border-rose-200/80 dark:border-rose-500/30',
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br px-4 py-3 shadow-[0_10px_28px_-26px_rgba(15,23,42,0.35)] ${toneStyles[tone]}`}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 dark:text-slate-400">{sub}</div>}
    </div>
  );
}

function SectionHeading({ icon: Icon, title, subtitle, children }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h3>
        </div>
        {subtitle && <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

interface CostManagementStudioProps {
  project: ProjectData;
  businessCase?: BusinessCaseData | null;
  tasks: WbsTaskData[];
  readOnly?: boolean;
}

// Top-level tabs. `Commitments` is no longer a peer tab — it lives as a
// sub-tab inside CBS alongside the phase (implementation) and operational
// (OPEX) breakdowns, so every commercial view is anchored to the same CBS.
// Each tab carries its own colour identity so the active state is immediately
// legible and the rail doubles as a visual index of the cost management
// domain. Gradients stay within a cool\u2192warm enterprise palette.
type TabPalette = {
  gradient: string;   // active icon badge background
  glow: string;       // active icon badge shadow colour
  accent: string;     // underline accent gradient
  chipActive: string; // pill chip when active
  tint: string;       // tinted background for active tab surface
  ring: string;       // subtle colored ring around active tab
};
const VIEWS: Array<{
  id: CostViewId;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  palette: TabPalette;
}> = [
  { id: 'overview',   label: 'Cockpit',         hint: 'KPIs \u00b7 health \u00b7 S-curve',      icon: Gauge,     palette: { gradient: 'from-indigo-500 to-violet-500',   glow: 'shadow-[0_2px_10px_-2px_rgba(99,102,241,0.65)]',  accent: 'from-indigo-500 via-violet-500 to-indigo-500',   chipActive: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',   tint: 'bg-gradient-to-br from-white via-indigo-50/40 to-white dark:from-slate-800 dark:via-indigo-500/5 dark:to-slate-800',     ring: 'ring-indigo-200/80 dark:ring-indigo-500/25' } },
  { id: 'baseline',   label: 'Cost Breakdown',  hint: 'Project phase \u00b7 OPEX \u00b7 commitments', icon: Layers, palette: { gradient: 'from-sky-500 to-cyan-500',        glow: 'shadow-[0_2px_10px_-2px_rgba(14,165,233,0.65)]',  accent: 'from-sky-500 via-cyan-500 to-sky-500',           chipActive: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',               tint: 'bg-gradient-to-br from-white via-sky-50/40 to-white dark:from-slate-800 dark:via-sky-500/5 dark:to-slate-800',           ring: 'ring-sky-200/80 dark:ring-sky-500/25' } },
  { id: 'rates',      label: 'Rate Card',       hint: 'Unit rates & burden',           icon: Scale,     palette: { gradient: 'from-teal-500 to-emerald-500',    glow: 'shadow-[0_2px_10px_-2px_rgba(16,185,129,0.65)]',  accent: 'from-teal-500 via-emerald-500 to-teal-500',      chipActive: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', tint: 'bg-gradient-to-br from-white via-emerald-50/40 to-white dark:from-slate-800 dark:via-emerald-500/5 dark:to-slate-800', ring: 'ring-emerald-200/80 dark:ring-emerald-500/25' } },
  { id: 'cashflow',   label: 'Cashflow',        hint: 'Phasing & S-curve',             icon: LineChart, palette: { gradient: 'from-amber-500 to-orange-500',    glow: 'shadow-[0_2px_10px_-2px_rgba(245,158,11,0.65)]',  accent: 'from-amber-500 via-orange-500 to-amber-500',     chipActive: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',       tint: 'bg-gradient-to-br from-white via-amber-50/40 to-white dark:from-slate-800 dark:via-amber-500/5 dark:to-slate-800',     ring: 'ring-amber-200/80 dark:ring-amber-500/25' } },
  { id: 'evm',        label: 'Performance',     hint: 'CPI \u00b7 SPI \u00b7 EAC (EVM)',           icon: Activity,  palette: { gradient: 'from-fuchsia-500 to-pink-500',    glow: 'shadow-[0_2px_10px_-2px_rgba(217,70,239,0.65)]',  accent: 'from-fuchsia-500 via-pink-500 to-fuchsia-500',   chipActive: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300', tint: 'bg-gradient-to-br from-white via-fuchsia-50/40 to-white dark:from-slate-800 dark:via-fuchsia-500/5 dark:to-slate-800', ring: 'ring-fuchsia-200/80 dark:ring-fuchsia-500/25' } },
  { id: 'reserves',   label: 'Reserves & Changes', hint: 'Contingency \u00b7 CRs',          icon: Shield,    palette: { gradient: 'from-rose-500 to-red-500',        glow: 'shadow-[0_2px_10px_-2px_rgba(244,63,94,0.65)]',   accent: 'from-rose-500 via-red-500 to-rose-500',          chipActive: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',           tint: 'bg-gradient-to-br from-white via-rose-50/40 to-white dark:from-slate-800 dark:via-rose-500/5 dark:to-slate-800',       ring: 'ring-rose-200/80 dark:ring-rose-500/25' } },
];

// CBS sub-tabs \u2014 the three lenses onto the same cost baseline.
type CbsSubTabId = 'project' | 'operations' | 'commitments';
const CBS_SUBTABS: Array<{
  id: CbsSubTabId;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  palette: TabPalette;
}> = [
  { id: 'project',     label: 'Project Phase',    hint: 'Aligned with Implementation Plan & WBS', icon: ListTree,  palette: { gradient: 'from-sky-500 to-blue-500',       glow: 'shadow-[0_2px_10px_-2px_rgba(59,130,246,0.65)]', accent: 'from-sky-500 via-blue-500 to-sky-500',          chipActive: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',                 tint: 'bg-gradient-to-br from-white via-sky-50/40 to-white dark:from-slate-800 dark:via-sky-500/5 dark:to-slate-800',         ring: 'ring-sky-200/80 dark:ring-sky-500/25' } },
  { id: 'operations',  label: 'Operational Costs', hint: 'Annual OPEX \u00b7 run & maintain',         icon: Zap,       palette: { gradient: 'from-emerald-500 to-teal-500',    glow: 'shadow-[0_2px_10px_-2px_rgba(16,185,129,0.65)]', accent: 'from-emerald-500 via-teal-500 to-emerald-500',  chipActive: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', tint: 'bg-gradient-to-br from-white via-emerald-50/40 to-white dark:from-slate-800 dark:via-emerald-500/5 dark:to-slate-800', ring: 'ring-emerald-200/80 dark:ring-emerald-500/25' } },
  { id: 'commitments', label: 'POs & Contracts',   hint: 'Commitments against CBS',               icon: FileCheck, palette: { gradient: 'from-violet-500 to-purple-500',   glow: 'shadow-[0_2px_10px_-2px_rgba(139,92,246,0.65)]', accent: 'from-violet-500 via-purple-500 to-violet-500',  chipActive: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',     tint: 'bg-gradient-to-br from-white via-violet-50/40 to-white dark:from-slate-800 dark:via-violet-500/5 dark:to-slate-800', ring: 'ring-violet-200/80 dark:ring-violet-500/25' } },
];

export function CostManagementStudio({ project, businessCase, tasks, readOnly }: CostManagementStudioProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [_view, setView] = useState<CostViewId>('overview');
  const [_cbsSubTab, setCbsSubTab] = useState<CbsSubTabId>('project');
  const [plan, setPlan] = useState<CostPlanState>(() => buildInitialPlan(project, businessCase, tasks));
  // Smart-panel selection — when set, the right pane shows the line detail
  // panel (procurement, sub-tasks, variance) instead of the composition/
  // cashflow charts. Click a row in either table to open it.
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const hydrated = useRef(false);

  // Keep plan in sync if project.metadata.costPlan arrives later (after first render)
  useEffect(() => {
    if (hydrated.current) return;
    const stored = (project.metadata as Record<string, unknown> | undefined)?.costPlan;
    if (stored) {
      setPlan(buildInitialPlan(project, businessCase, tasks));
      hydrated.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.metadata]);

  // Enterprise PPM behavior: once WBS tasks or business-case detail become
  // available, auto-seed the CBS if the plan currently has no lines. The
  // business case is authoritative — when it carries detailedCosts we mirror
  // the approved envelope exactly; otherwise we fall back to WBS (+ BC
  // aggregate anchors). Never overwrite a sealed baseline.
  const autoSeededRef = useRef(false);
  useEffect(() => {
    if (autoSeededRef.current) return;
    if (plan.baselineLockedAt) return;
    if (plan.cbs.length > 0) return; // respect any existing CBS (user or prior seed)
    if (tasks.length === 0 && !resolveBusinessCaseSegments(businessCase).present) return;

    const bacHint = resolveApprovedBudget(project, businessCase, 0).amount;
    const bcAnchors = seedBusinessCaseAnchors(businessCase);
    const hasDetailedBc = Array.isArray(businessCase?.detailedCosts) && (businessCase?.detailedCosts?.length ?? 0) > 0;

    let nextLines: CbsLineItem[];
    if (hasDetailedBc) {
      nextLines = bcAnchors; // BC is the approved envelope \u2014 authoritative
    } else if (bcAnchors.length > 0) {
      const covered = new Set(bcAnchors.map((a) => a.segment ?? 'implementation'));
      const wbsSeed = seedCbsFromTasks(tasks, bacHint).filter((l) => !covered.has(l.segment ?? 'implementation'));
      nextLines = [...bcAnchors, ...wbsSeed];
    } else {
      nextLines = seedCbsFromTasks(tasks, bacHint);
    }

    if (nextLines.length === 0) return;
    autoSeededRef.current = true;
    setPlan((p) => ({ ...p, cbs: nextLines }));
  }, [tasks, plan.cbs.length, plan.baselineLockedAt, plan.cbs, project, businessCase]);

  const baselineFromCbsMemo = useMemo(
    () => plan.cbs.reduce((s, l) => s + lineExtended(l).withContingency, 0),
    [plan.cbs],
  );

  const bacResolution = useMemo(
    () => resolveApprovedBudget(project, businessCase, baselineFromCbsMemo),
    [project, businessCase, baselineFromCbsMemo],
  );
  const approvedBudget = bacResolution.amount;

  const evm = useMemo(() => computeEvm(plan, tasks, approvedBudget), [plan, tasks, approvedBudget]);
  const phasing = useMemo(
    () => computePhasing(tasks, plan, project, approvedBudget),
    [tasks, plan, project, approvedBudget],
  );

  const baselineTotals = useMemo(() => {
    let base = 0;
    let contingencyReserve = 0;
    let capex = 0;
    let opex = 0;
    const segments = { implementation: 0, operations: 0, maintenance: 0, other: 0 };
    for (const l of plan.cbs) {
      const { base: b, withContingency } = lineExtended(l);
      base += b;
      contingencyReserve += withContingency - b;
      if (l.costClass === 'CAPEX') capex += withContingency;
      else opex += withContingency;
      const seg = (l.segment ?? 'implementation') as keyof typeof segments;
      segments[seg] += withContingency;
    }
    // Contingency / management reserve are scoped to the one-time
    // delivery envelope (implementation + other), NOT to multi-year OPEX.
    // OPEX lines (operations / maintenance) run on annual renewals and
    // carry their own annual contingency inside the run-rate — applying a
    // single project-level contingency to 5 years of OPEX would double the
    // pool and overstate the reserve posture.
    const reserveBase = segments.implementation + segments.other;
    const contingencyPool = (reserveBase * plan.reserves.contingencyPct) / 100;
    const managementPool = (reserveBase * plan.reserves.managementReservePct) / 100;
    return {
      base,
      contingencyLineReserve: contingencyReserve,
      capex,
      opex,
      contingencyPool,
      managementPool,
      reserveBase,
      implementation: segments.implementation,
      operations: segments.operations,
      maintenance: segments.maintenance,
      other: segments.other,
    };
  }, [plan.cbs, plan.reserves]);

  // Cost structure by category × cost class (CAPEX / OPEX / Total).
  // Surfaces three parallel views on the same category axes so the radar
  // can overlay them as comparative polygons.
  const costStructure = useMemo(() => {
    type Buckets = Record<string, number>;
    const mk = (): Buckets => ({ labor: 0, subcontractor: 0, material: 0, equipment: 0, overhead: 0, other: 0 });
    const totalBuckets = mk();
    const capexBuckets = mk();
    const opexBuckets = mk();
    for (const l of plan.cbs) {
      const { withContingency } = lineExtended(l);
      const key = (l.category ?? 'other') as keyof Buckets;
      const k = key in totalBuckets ? key : 'other';
      totalBuckets[k] = (totalBuckets[k] ?? 0) + withContingency;
      if (l.costClass === 'CAPEX') capexBuckets[k] = (capexBuckets[k] ?? 0) + withContingency;
      else opexBuckets[k] = (opexBuckets[k] ?? 0) + withContingency;
    }
    const toEntries = (b: Buckets) => {
      const total = Object.values(b).reduce((s, v) => s + v, 0);
      return Object.entries(b)
        .map(([key, value]) => ({ key, value, pct: total > 0 ? (value / total) * 100 : 0 }));
    };
    const total = Object.values(totalBuckets).reduce((s, v) => s + v, 0);
    const entries = toEntries(totalBuckets).sort((a, b) => b.value - a.value);
    return {
      entries,
      total,
      capexEntries: toEntries(capexBuckets),
      opexEntries: toEntries(opexBuckets),
      totalEntries: toEntries(totalBuckets),
    };
  }, [plan.cbs]);

  // Business-case segment reference (for banners and comparisons across views)
  const _bcSegments = useMemo(() => resolveBusinessCaseSegments(businessCase), [businessCase]);
  // Business-case vitals (ROI, NPV, payback, peak funding, pilot gate status)
  const _bcVitals = useMemo(() => resolveBusinessCaseVitals(businessCase), [businessCase]);
  // Business-case cash profile (Y0-Y5 from financial engine)
  const _bcCashProfile = useMemo(() => resolveBusinessCaseCashProfile(businessCase), [businessCase]);

  // Phasing enriched with the business-case cash profile overlay. The canonical
  // source is `computedFinancialModel.cashFlows` (Year 0…N). Each BC year total
  // is spread evenly across that project-year's 12 months. Falls back to the
  // legacy `annualCostPlan` (fiscal-year) shape if the engine output is absent.
  const _phasingWithBc = useMemo(() => {
    const projStart = project?.plannedStartDate ? new Date(project.plannedStartDate) : null;
    const projStartValid = projStart && !Number.isNaN(projStart.getTime());
    const projStartYear = projStartValid ? projStart!.getUTCFullYear() : new Date().getUTCFullYear();
    const fiscalStartMonth = projStartValid ? projStart!.getUTCMonth() : 0;

    // ── PRIMARY: computedFinancialModel.cashFlows (Year 0..N) ─────────
    if (_bcCashProfile.present && _bcCashProfile.rows.length > 0) {
      // Index BC rows by project-year (Y0 = projStartYear).
      const byYear = new Map<number, { costs: number; benefits: number; label: string }>();
      for (const r of _bcCashProfile.rows) {
        byYear.set(projStartYear + r.year, { costs: r.costs, benefits: r.benefits, label: r.label });
      }
      // Map a month string to its BC project-year using fiscal-start offset.
      const yearOf = (yyyyMm: string) => {
        const [y, m] = yyyyMm.split('-').map(Number);
        const yr = y ?? 0;
        const mo = (m ?? 1) - 1;
        // If the month is on/after the fiscal start month, it belongs to year `yr`; otherwise prior year.
        return mo >= fiscalStartMonth ? yr : yr - 1;
      };
      let bcCum = 0;
      const rows = phasing.map((p) => {
        const ypy = yearOf(p.month);
        const row = byYear.get(ypy);
        const bcMonthly = row ? row.costs / 12 : 0;
        bcCum += bcMonthly;
        return { ...p, bcPlanned: Math.round(bcMonthly), bcCumulative: Math.round(bcCum) };
      });
      const cbsByYear = new Map<number, number>();
      for (const p of phasing) {
        const yr = yearOf(p.month);
        cbsByYear.set(yr, (cbsByYear.get(yr) ?? 0) + p.planned);
      }
      const annualReconciliation = _bcCashProfile.rows
        .slice()
        .sort((a, b) => a.year - b.year)
        .map((r) => ({
          fy: projStartYear + r.year,
          label: r.label || (r.year === 0 ? 'Y0 (Impl)' : `Y${r.year}`),
          capex: 0,                            // engine cashflows are not split capex/opex
          opex: 0,
          total: r.costs,
          benefits: r.benefits,
          cbs: cbsByYear.get(projStartYear + r.year) ?? 0,
        }));
      return { rows, annualReconciliation, hasBcAnnual: true };
    }

    // ── FALLBACK: legacy annualCostPlan[] (fiscal-year shape) ────────
    const annualRows = Array.isArray(businessCase?.annualCostPlan)
      ? businessCase!.annualCostPlan!
          .map((r) => ({
            fiscalYear: Number(r.fiscalYear) || Number(r.yearIndex) || 0,
            capex: num(r.capexTarget),
            opex: num(r.opexTarget),
            total: num(r.budgetTarget) || num(r.capexTarget) + num(r.opexTarget),
          }))
          .filter((r) => r.total > 0 && r.fiscalYear > 0)
      : [];
    const fyOf = (yyyyMm: string) => {
      const parts = yyyyMm.split('-').map(Number);
      const y = parts[0] ?? 0;
      const m = parts[1] ?? 1;
      return m - 1 >= fiscalStartMonth ? y : y - 1;
    };
    const byFy = new Map<number, { fiscalYear: number; capex: number; opex: number; total: number }>(
      annualRows.map((r) => [r.fiscalYear, r] as const),
    );
    let bcCum = 0;
    const rows = phasing.map((p) => {
      const row = byFy.get(fyOf(p.month));
      const bcMonthly = row ? row.total / 12 : 0;
      bcCum += bcMonthly;
      return { ...p, bcPlanned: Math.round(bcMonthly), bcCumulative: Math.round(bcCum) };
    });
    const cbsByFy = new Map<number, number>();
    for (const p of phasing) {
      const fy = fyOf(p.month);
      cbsByFy.set(fy, (cbsByFy.get(fy) ?? 0) + p.planned);
    }
    const annualReconciliation = annualRows
      .slice()
      .sort((a, b) => a.fiscalYear - b.fiscalYear)
      .map((r) => ({
        fy: r.fiscalYear,
        label: `FY${r.fiscalYear}`,
        capex: r.capex,
        opex: r.opex,
        total: r.total,
        benefits: 0,
        cbs: cbsByFy.get(r.fiscalYear) ?? 0,
      }));
    return { rows, annualReconciliation, hasBcAnnual: annualRows.length > 0 };
  }, [phasing, _bcCashProfile, businessCase, project]);

  // ────────────── Persistence ──────────────
  const saveMutation = useMutation({
    mutationFn: async (payload: CostPlanState) => {
      const currentMeta = (project.metadata as Record<string, unknown> | undefined) ?? {};
      const nextMeta = { ...currentMeta, costPlan: payload };
      const res = await apiRequest('PATCH', `/api/portfolio/projects/${project.id}`, { metadata: nextMeta });
      return res;
    },
    onSuccess: () => {
      toast({ title: 'Cost plan saved', description: 'Baseline, rate card, commitments and reserves were persisted.' });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unable to save cost plan';
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    },
  });

  const lockBaseline = () => {
    setPlan((p) => ({ ...p, baselineLockedAt: new Date().toISOString(), version: p.version + 1 }));
  };
  const unlockBaseline = () => {
    setPlan((p) => ({ ...p, baselineLockedAt: null }));
  };

  // ────────────── CBS helpers ──────────────
  const updateCbs = (id: string, patch: Partial<CbsLineItem>) => {
    setPlan((p) => ({ ...p, cbs: p.cbs.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  };
  const addCbs = (defaults?: { segment?: CbsLineItem['segment']; costClass?: CbsLineItem['costClass'] }) => {
    const segment = defaults?.segment ?? 'implementation';
    const costClass =
      defaults?.costClass ?? (segment === 'operations' || segment === 'maintenance' ? 'OPEX' : 'CAPEX');
    setPlan((p) => ({
      ...p,
      cbs: [
        ...p.cbs,
        {
          id: uid(),
          wbsCode: `CBS-${(p.cbs.length + 1).toString().padStart(3, '0')}`,
          description: 'New cost line',
          category: 'labor',
          quantity: 1,
          unit: 'hour',
          unitRate: 0,
          markupPct: 0,
          contingencyPct: 0,
          costClass,
          segment,
        },
      ],
    }));
  };
  const removeCbs = (id: string) => {
    setPlan((p) => ({ ...p, cbs: p.cbs.filter((l) => l.id !== id) }));
  };

  /**
   * One-click fix for the COREVIA advisory "N deliverables not priced in CBS".
   * Walks the WBS deliverables that have no matching CBS line (by WBS code or
   * branch rollup) and no planned cost, and appends a seeded CBS line for
   * each one. The new lines use the deliverable's WBS code and name so the
   * reconciliation closes immediately, and carry the deliverable's planned
   * cost (if any) or a zero placeholder for the user to fill in.
   */
  const _priceUnpricedDeliverables = () => {
    setPlan((p) => {
      const existingCodes = new Set(p.cbs.map((l) => l.wbsCode).filter(Boolean));
      const existingBranches = p.cbs.map((l) => l.wbsCode).filter(Boolean);
      const deliverables = tasks.filter((t) => t.taskType === 'deliverable');
      const needsPricing = deliverables.filter((d) => {
        if (num(d.plannedCost) > 0) return false;
        const code = d.wbsCode?.trim();
        if (!code) return true;
        if (existingCodes.has(code)) return false;
        const root = code.endsWith('.0') ? code.slice(0, -2) : code;
        const prefix = `${root}.`;
        if (existingBranches.some((c) => c.startsWith(prefix))) return false;
        return true;
      });
      if (needsPricing.length === 0) return p;
      const seeded: CbsLineItem[] = needsPricing.map((d, i) => {
        const seq = (p.cbs.length + i + 1).toString().padStart(3, '0');
        const planned = num(d.plannedCost);
        return {
          id: uid(),
          wbsCode: d.wbsCode?.trim() || `CBS-${seq}`,
          description: d.taskName || d.title || 'Deliverable',
          category: 'other',
          quantity: 1,
          unit: 'lot',
          unitRate: planned,
          markupPct: 0,
          contingencyPct: 0,
          costClass: 'CAPEX',
          segment: 'implementation',
          source: 'wbs',
        };
      });
      return { ...p, cbs: [...p.cbs, ...seeded] };
    });
    toast({
      title: 'Deliverables added to CBS',
      description: 'Seeded a CBS line for each unpriced deliverable. Set the unit rate to finalize pricing.',
    });
    setView('baseline');
    setCbsSubTab('project');
  };

  // Allocate BAC proportionally across all CBS lines so the extended total matches BAC exactly.
  const _allocateCbsToBacAction = () => {
    if (approvedBudget <= 0) {
      toast({
        title: 'No approved budget found',
        description: 'Set the project approved budget or business case total cost first.',
        variant: 'destructive',
      });
      return;
    }
    setPlan((p) => {
      if (p.cbs.length === 0) {
        // No lines yet — seed from WBS using the BAC as the allocation pool, or a single placeholder line.
        const seeded = seedCbsFromTasks(tasks, approvedBudget);
        if (seeded.length > 0) return { ...p, cbs: seeded };
        return {
          ...p,
          cbs: [
            {
              id: uid(),
              wbsCode: 'CBS-001',
              description: 'Approved budget placeholder',
              category: 'other',
              quantity: 1,
              unit: 'lot',
              unitRate: approvedBudget,
              markupPct: 0,
              contingencyPct: 0,
              costClass: 'CAPEX',
            },
          ],
        };
      }
      return { ...p, cbs: allocateCbsToBac(p.cbs, approvedBudget) };
    });
    toast({
      title: 'BAC allocated',
      description: `Scaled ${plan.cbs.length || 'new'} CBS line${plan.cbs.length === 1 ? '' : 's'} to match ${AED(approvedBudget)}.`,
    });
  };

  // ────────────── Rate card helpers ──────────────
  const _updateRate = (id: string, patch: Partial<RateCardEntry>) => {
    setPlan((p) => ({ ...p, rateCard: p.rateCard.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  };
  const _addRate = () => {
    setPlan((p) => ({
      ...p,
      rateCard: [
        ...p.rateCard,
        { id: uid(), category: 'labor', code: 'NEW', name: 'New rate', unit: 'hour', rate: 0, burdenPct: 0 },
      ],
    }));
  };
  const _removeRate = (id: string) => setPlan((p) => ({ ...p, rateCard: p.rateCard.filter((r) => r.id !== id) }));

  // ────────────── Commitments helpers ──────────────
  const _updateCommit = (id: string, patch: Partial<CommitmentEntry>) => {
    setPlan((p) => ({ ...p, commitments: p.commitments.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  };
  const _addCommit = () => {
    setPlan((p) => ({
      ...p,
      commitments: [
        ...p.commitments,
        {
          id: uid(),
          ref: `PO-${(p.commitments.length + 1001).toString()}`,
          vendor: 'New vendor',
          awardedValue: 0,
          invoicedValue: 0,
          paidValue: 0,
          status: 'draft',
          costClass: 'CAPEX',
          dueDate: '',
        },
      ],
    }));
  };
  const _removeCommit = (id: string) => setPlan((p) => ({ ...p, commitments: p.commitments.filter((c) => c.id !== id) }));

  // ────────────── Change log helpers ──────────────
  const _addChange = () => {
    setPlan((p) => ({
      ...p,
      changes: [
        ...p.changes,
        {
          id: uid(),
          date: new Date().toISOString().slice(0, 10),
          ref: `CR-${(p.changes.length + 1).toString().padStart(3, '0')}`,
          title: 'New change request',
          amount: 0,
          status: 'proposed',
        },
      ],
    }));
  };
  const _updateChange = (id: string, patch: Partial<ChangeLogEntry>) => {
    setPlan((p) => ({ ...p, changes: p.changes.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  };
  const _removeChange = (id: string) => setPlan((p) => ({ ...p, changes: p.changes.filter((c) => c.id !== id) }));

  // ────────────── Health pills ──────────────
  const _fundingTone: 'green' | 'amber' | 'red' =
    evm.vac >= 0 ? 'green' : evm.vac > -evm.bac * 0.05 ? 'amber' : 'red';
  const _commitmentTone: 'green' | 'amber' | 'red' =
    evm.committed <= evm.bac ? 'green' : evm.committed <= evm.bac * 1.05 ? 'amber' : 'red';
  const _scheduleTone: 'green' | 'amber' | 'red' =
    evm.spi >= 0.95 ? 'green' : evm.spi >= 0.85 ? 'amber' : 'red';
  const _reserveTone: 'green' | 'amber' | 'red' =
    plan.reserves.contingencyUsed / Math.max(1, baselineTotals.contingencyPool) < 0.5
      ? 'green'
      : plan.reserves.contingencyUsed / Math.max(1, baselineTotals.contingencyPool) < 0.9
      ? 'amber'
      : 'red';

  const _baselineLocked = Boolean(plan.baselineLockedAt);

  // ────────────── Keyboard shortcuts ──────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const editing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      // Cmd/Ctrl + S → save
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!saveDisabledRef.current) saveMutation.mutate(plan);
        return;
      }
      if (editing) return;
      const idx = Number(e.key);
      if (!Number.isNaN(idx) && idx >= 1 && idx <= VIEWS.length) {
        const v = VIEWS[idx - 1];
        if (v) setView(v.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const exportCsv = () => {
    const rows: string[] = [];
    rows.push('Type,Code,Description,Category,Qty,Unit,Unit Rate,Markup %,Contingency %,CAPEX/OPEX,Extended (AED)');
    for (const l of plan.cbs) {
      const ext = lineExtended(l).withContingency;
      rows.push(
        [
          'CBS',
          l.wbsCode,
          `"${l.description.replace(/"/g, '""')}"`,
          l.category,
          l.quantity,
          l.unit,
          l.unitRate,
          l.markupPct,
          l.contingencyPct,
          l.costClass,
          Math.round(ext),
        ].join(','),
      );
    }
    rows.push('');
    rows.push('Type,Ref,Vendor,Awarded (AED),Invoiced (AED),Paid (AED),Status,Class');
    for (const c of plan.commitments) {
      rows.push(
        [
          'Commitment',
          c.ref,
          `"${c.vendor.replace(/"/g, '""')}"`,
          c.awardedValue,
          c.invoicedValue,
          c.paidValue,
          c.status,
          c.costClass,
        ].join(','),
      );
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.projectCode || project.id}-cost-plan.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const saveDisabled = readOnly || saveMutation.isPending;
  const saveDisabledRef = useRef(saveDisabled);
  saveDisabledRef.current = saveDisabled;

  // ────────────── Render ──────────────
  // A single-page, no-tabs cost workspace. Three regions stack in one scroll:
  //   1. Envelope strip — approved BAC vs planned vs committed (+ lock/save)
  //   2. COREVIA advisory — next-best-action
  //   3. Cost plan — the editable line-item table grouped by phase
  // No lens cards, no dark cockpit, no six competing views. The table is
  // the work; everything else serves it.

  const plannedTotal = baselineTotals.implementation + baselineTotals.operations + baselineTotals.maintenance + baselineTotals.other;
  const committedTotal = plan.commitments.reduce((s, c) => s + (c.awardedValue || 0), 0);
  const _remaining = Math.max(0, evm.bac - plannedTotal);
  const _plannedPct = evm.bac > 0 ? Math.min(100, (plannedTotal / evm.bac) * 100) : 0;
  const _committedPct = evm.bac > 0 ? Math.min(100, (committedTotal / evm.bac) * 100) : 0;
  const _overBudget = plannedTotal > evm.bac && evm.bac > 0;

  const implementationLines = plan.cbs.filter((l) => (l.segment ?? 'implementation') === 'implementation' || l.segment === 'other');
  const operationsLines = plan.cbs.filter((l) => l.segment === 'operations' || l.segment === 'maintenance');

  return (
    <div className="grid grid-cols-1 gap-4 pb-8 xl:pb-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" data-testid="cost-management-studio">
      {/* LEFT PANE — cost planning surface */}
      <div className="space-y-4">
      {/* ── 1. ENVELOPE STRIP ───────────────────────────────────────────
          One quiet horizontal strip. Four numbers a PMO actually watches:
          approved BAC, planned cost, committed, remaining — with a single
          stacked bar showing the shape of the envelope. */}
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Cost Plan
            </span>
            <span className="h-3 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
            <span className="truncate text-[13px] font-semibold tracking-tight text-slate-900 dark:text-white">
              {project.projectName}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" className="h-8 px-2.5 text-[12.5px] text-slate-600 dark:text-slate-300" onClick={exportCsv} data-testid="cost-export-csv">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export
            </Button>
            {plan.baselineLockedAt ? (
              <Button size="sm" variant="outline" className="h-8 px-2.5 text-[12.5px]" onClick={unlockBaseline} disabled={readOnly}>
                <Lock className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Locked
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-8 px-2.5 text-[12.5px]" onClick={lockBaseline} disabled={readOnly}>
                <Lock className="mr-1.5 h-3.5 w-3.5" /> Lock baseline
              </Button>
            )}
            <Button size="sm" className="h-8 px-3 text-[12.5px]" onClick={() => saveMutation.mutate(plan)} disabled={saveDisabled} data-testid="cost-save">
              {saveMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>
      </section>

      {/* ── 2. COST PLAN ─────────────────────────────────────────────
          Single scrollable document. Two groups: Implementation (CAPEX
          delivery) + Operations (OPEX run). Each group is a plain table
          with inline editing. One "Add line" button per group. No tabs,
          no sub-tabs, no drill-down panels — the table IS the work. */}
      <CostPlanTable
        title="Implementation"
        hint="One-time project delivery"
        badge="CAPEX"
        badgeTone="capex"
        accent="indigo"
        lines={implementationLines}
        total={baselineTotals.implementation + baselineTotals.other}
        onUpdate={updateCbs}
        onRemove={removeCbs}
        onAdd={() => addCbs({ segment: 'implementation', costClass: 'CAPEX' })}
        readOnly={readOnly || !!plan.baselineLockedAt}
        selectedLineId={selectedLineId}
        onSelectLine={(id) => setSelectedLineId(id ? id : null)}
      />
      <CostPlanTable
        title="Operations"
        hint="Recurring run & maintain"
        badge="OPEX"
        badgeTone="opex"
        accent="emerald"
        lines={operationsLines}
        total={baselineTotals.operations + baselineTotals.maintenance}
        onUpdate={updateCbs}
        onRemove={removeCbs}
        onAdd={() => addCbs({ segment: 'operations', costClass: 'OPEX' })}
        readOnly={readOnly || !!plan.baselineLockedAt}
        selectedLineId={selectedLineId}
        onSelectLine={(id) => setSelectedLineId(id ? id : null)}
      />
      </div>

      {/* RIGHT PANE — always-on intelligence rail */}
      <aside aria-label="Cost intelligence" className="hidden min-w-0 space-y-3 lg:block">
        <>
          <CostCompositionCard
            entries={costStructure.entries}
            total={costStructure.total}
            capex={baselineTotals.capex}
            opex={baselineTotals.opex}
          />
          <CashflowCard phasing={phasing} approvedBudget={approvedBudget} />
        </>
      </aside>

      {selectedLineId && plan.cbs.some((l) => l.id === selectedLineId) && (
        <CostLineDetailPanel
          open
          line={plan.cbs.find((l) => l.id === selectedLineId)!}
          commitments={plan.commitments}
          onUpdate={(patch) => updateCbs(selectedLineId, patch)}
          onClose={() => setSelectedLineId(null)}
          readOnly={readOnly || !!plan.baselineLockedAt}
        />
      )}
    </div>
  );
}

// ─── Right-pane intelligence ────────────────────────────────────────────
// Category palette shared across composition + line-detail surfaces.
type CategoryMeta = { label: string; short: string; solid: string; from: string; to: string };
const COST_CATEGORY_META: Record<string, CategoryMeta> = {
  labor:         { label: 'Labor',         short: 'Labor',         solid: '#4f46e5', from: '#6366f1', to: '#8b5cf6' },
  subcontractor: { label: 'Subcontractor', short: 'Subcontractor', solid: '#0284c7', from: '#0ea5e9', to: '#06b6d4' },
  material:      { label: 'Material',      short: 'Material',      solid: '#d97706', from: '#f59e0b', to: '#f97316' },
  equipment:     { label: 'Equipment',     short: 'Equipment',     solid: '#9333ea', from: '#a855f7', to: '#d946ef' },
  overhead:      { label: 'Overhead',      short: 'Overhead',      solid: '#059669', from: '#10b981', to: '#14b8a6' },
  other:         { label: 'Other',         short: 'Other',         solid: '#475569', from: '#64748b', to: '#475569' },
};
const OTHER_META = COST_CATEGORY_META.other as CategoryMeta;
const metaFor = (key: string): CategoryMeta => COST_CATEGORY_META[key] ?? OTHER_META;

// ─── Composition card (compact) ────────────────────────────────────────
function CostCompositionCard({
  entries,
  total,
  capex,
  opex,
}: {
  entries: Array<{ key: string; value: number; pct: number }>;
  total: number;
  capex: number;
  opex: number;
}) {
  const active = entries.filter((e) => e.value > 0);
  const top3 = active.slice(0, 3);
  const innerTotal = capex + opex;
  const capexPct = innerTotal > 0 ? (capex / innerTotal) * 100 : 0;
  const opexPct = innerTotal > 0 ? (opex / innerTotal) * 100 : 0;

  if (total <= 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-center dark:border-slate-800 dark:bg-slate-900">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          Composition
        </div>
        <p className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">
          Price cost lines to populate.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-sky-500" aria-hidden />
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">
            Composition
          </span>
        </div>
        <span className="text-[10.5px] tabular-nums text-slate-400 dark:text-slate-500">
          {AED(total)}
        </span>
      </header>

      <div className="px-4 pt-3">
        {/* Segmented spectrum */}
        <div className="flex h-2 w-full overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-800" role="img" aria-label="Cost composition">
          {active.map((e) => {
            const meta = metaFor(e.key);
            return (
              <span
                key={e.key}
                title={`${meta.label} · ${e.pct.toFixed(1)}% · ${AED(e.value)}`}
                style={{
                  width: `${e.pct}%`,
                  background: `linear-gradient(90deg, ${meta.from}, ${meta.to})`,
                }}
                className="h-full"
              />
            );
          })}
        </div>

        {/* Top 3 drivers */}
        <ul className="mt-3 space-y-1.5">
          {top3.map((e, idx) => {
            const meta = metaFor(e.key);
            const top = top3[0];
            const topValue = top && top.value > 0 ? top.value : 1;
            const widthPct = Math.max(2, (e.value / topValue) * 100);
            return (
              <li key={e.key} className="grid grid-cols-[14px_1fr_44px_72px] items-center gap-2 text-[11px]">
                <span className={`font-mono font-semibold tabular-nums ${idx === 0 ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                  #{idx + 1}
                </span>
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: meta.solid }} aria-hidden />
                  <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                    {meta.label}
                  </span>
                  <div className="ml-1 hidden h-1 flex-1 overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-800 sm:block">
                    <div className="h-full rounded-sm" style={{ width: `${widthPct}%`, background: `linear-gradient(90deg, ${meta.from}, ${meta.to})` }} />
                  </div>
                </div>
                <span className="text-right font-semibold tabular-nums text-slate-900 dark:text-white">
                  {e.pct.toFixed(0)}%
                </span>
                <span className="text-right tabular-nums text-slate-500 dark:text-slate-400">
                  {AED(e.value)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* CAPEX / OPEX split */}
      {innerTotal > 0 && (
        <div className="border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <div className="mb-1 flex items-baseline justify-between text-[9.5px] font-semibold uppercase tracking-[0.14em]">
            <span className="text-slate-400 dark:text-slate-500">Structure</span>
            <div className="flex items-center gap-3 tabular-nums">
              <span className="text-indigo-600 dark:text-indigo-400">
                CAPEX <span className="ml-0.5 text-slate-900 dark:text-white">{capexPct.toFixed(0)}%</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400">
                OPEX <span className="ml-0.5 text-slate-900 dark:text-white">{opexPct.toFixed(0)}%</span>
              </span>
            </div>
          </div>
          <div className="flex h-1.5 w-full overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-800">
            {capexPct > 0 && <span style={{ width: `${capexPct}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} className="h-full" />}
            {opexPct > 0 && <span style={{ width: `${opexPct}%`, background: 'linear-gradient(90deg,#10b981,#0ea5e9)' }} className="h-full" />}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Cashflow card — cumulative area curve with today marker ────────────
function CashflowCard({
  phasing,
  approvedBudget,
}: {
  phasing: Array<ReturnType<typeof computePhasing>[number]>;
  approvedBudget: number;
}) {
  const uid = useMemo(() => `cf-${Math.random().toString(36).slice(2, 8)}`, []);

  if (!phasing.length) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-center dark:border-slate-800 dark:bg-slate-900">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          Cashflow
        </div>
        <p className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">
          Schedule work and price it to render the curve.
        </p>
      </section>
    );
  }

  const width = 300;
  const height = 130;
  const padL = 6;
  const padR = 6;
  const padT = 10;
  const padB = 22;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxY = Math.max(
    approvedBudget,
    ...phasing.map((p) => Math.max(p.cumulativePlanned, p.cumulativeActual)),
    1,
  );

  const xAt = (i: number) => padL + (phasing.length === 1 ? plotW / 2 : (i / (phasing.length - 1)) * plotW);
  const yAt = (v: number) => padT + plotH - (v / maxY) * plotH;

  const plannedPath = phasing.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(p.cumulativePlanned).toFixed(2)}`).join(' ');
  const actualPath  = phasing.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(p.cumulativeActual).toFixed(2)}`).join(' ');
  const plannedArea = `${plannedPath} L ${xAt(phasing.length - 1).toFixed(2)} ${(padT + plotH).toFixed(2)} L ${xAt(0).toFixed(2)} ${(padT + plotH).toFixed(2)} Z`;
  const actualArea  = `${actualPath} L ${xAt(phasing.length - 1).toFixed(2)} ${(padT + plotH).toFixed(2)} L ${xAt(0).toFixed(2)} ${(padT + plotH).toFixed(2)} Z`;

  // Today marker — last index whose actuals have been booked
  const lastActualIdx = (() => {
    let last = -1;
    phasing.forEach((p, i) => { if (p.cumulativeActual > 0) last = i; });
    return last;
  })();

  const bacLineY = yAt(approvedBudget);

  // Summary stats
  const finalPlanned = phasing[phasing.length - 1]?.cumulativePlanned ?? 0;
  const finalActual = phasing[phasing.length - 1]?.cumulativeActual ?? 0;
  const variance = finalPlanned - finalActual;
  const varianceTone = variance >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-rose-600 dark:text-rose-400';

  // Tick labels — show first, middle, last
  const tickIdxs = phasing.length <= 3 ? phasing.map((_, i) => i) : [0, Math.floor(phasing.length / 2), phasing.length - 1];

  return (
    <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500" aria-hidden />
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">
            Cashflow
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.1em]">
          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <span className="inline-block h-0.5 w-3 rounded-sm bg-indigo-500" aria-hidden />
            Planned
          </span>
          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <span className="inline-block h-0.5 w-3 rounded-sm bg-emerald-500" aria-hidden />
            Actual
          </span>
        </div>
      </header>

      {/* SVG curve */}
      <div className="px-2 pt-2">
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Cashflow cumulative curve">
          <defs>
            <linearGradient id={`${uid}-planned`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${uid}-actual`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid — 3 faint horizontal lines */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={padL}
              x2={width - padR}
              y1={padT + plotH * (1 - f)}
              y2={padT + plotH * (1 - f)}
              className="stroke-slate-100 dark:stroke-slate-800"
              strokeWidth="0.6"
              strokeDasharray="2 3"
            />
          ))}

          {/* BAC reference line */}
          {approvedBudget > 0 && bacLineY >= padT && bacLineY <= padT + plotH && (
            <g>
              <line
                x1={padL}
                x2={width - padR}
                y1={bacLineY}
                y2={bacLineY}
                className="stroke-rose-400/60"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x={width - padR - 2}
                y={bacLineY - 2}
                textAnchor="end"
                className="fill-rose-500 text-[8.5px] font-bold uppercase tracking-[0.1em]"
              >
                BAC
              </text>
            </g>
          )}

          {/* Planned area + line */}
          <path d={plannedArea} fill={`url(#${uid}-planned)`} />
          <path d={plannedPath} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Actual area + line (only where there is actual) */}
          {finalActual > 0 && (
            <>
              <path d={actualArea} fill={`url(#${uid}-actual)`} />
              <path d={actualPath} fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}

          {/* Today marker */}
          {lastActualIdx >= 0 && (
            <g>
              <line
                x1={xAt(lastActualIdx)}
                x2={xAt(lastActualIdx)}
                y1={padT}
                y2={padT + plotH}
                className="stroke-slate-400/70 dark:stroke-slate-500/70"
                strokeWidth="0.8"
                strokeDasharray="2 2"
              />
              <circle cx={xAt(lastActualIdx)} cy={yAt(phasing[lastActualIdx]?.cumulativeActual ?? 0)} r="3" fill="#10b981" stroke="white" strokeWidth="1.5" className="dark:stroke-slate-900" />
              <text
                x={xAt(lastActualIdx) + 3}
                y={padT + 8}
                className="fill-slate-500 text-[8.5px] font-semibold uppercase tracking-[0.1em] dark:fill-slate-400"
              >
                Today
              </text>
            </g>
          )}

          {/* X ticks */}
          {tickIdxs.map((idx) => (
            <text
              key={idx}
              x={xAt(idx)}
              y={height - 6}
              textAnchor={idx === 0 ? 'start' : idx === phasing.length - 1 ? 'end' : 'middle'}
              className="fill-slate-400 text-[8.5px] font-medium uppercase tracking-[0.08em] dark:fill-slate-500"
            >
              {phasing[idx]?.label ?? ''}
            </text>
          ))}
        </svg>
      </div>

      {/* Footer stats */}
      <div className="grid grid-cols-3 gap-1 border-t border-slate-100 px-4 py-2 text-[10.5px] dark:border-slate-800">
        <div>
          <div className="font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Planned</div>
          <div className="mt-0.5 font-semibold tabular-nums text-slate-900 dark:text-white">{AED(finalPlanned)}</div>
        </div>
        <div>
          <div className="font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Actual</div>
          <div className="mt-0.5 font-semibold tabular-nums text-slate-900 dark:text-white">{AED(finalActual)}</div>
        </div>
        <div>
          <div className="font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Variance</div>
          <div className={`mt-0.5 font-semibold tabular-nums ${varianceTone}`}>
            {variance >= 0 ? '+' : '−'}{AED(Math.abs(Math.round(variance)))}
          </div>
        </div>
      </div>
    </section>
  );
}

function _LineStat({ label, value, tone, pct }: { label: string; value: string; tone: 'indigo' | 'emerald' | 'rose'; pct?: number }) {
  const color =
    tone === 'indigo'  ? 'text-indigo-700 dark:text-indigo-400'
    : tone === 'rose'  ? 'text-rose-700 dark:text-rose-400'
    :                    'text-emerald-700 dark:text-emerald-400';
  const barBg =
    tone === 'indigo'  ? 'bg-gradient-to-r from-indigo-500 to-indigo-400'
    : tone === 'rose'  ? 'bg-gradient-to-r from-rose-500 to-rose-400'
    :                    'bg-gradient-to-r from-emerald-500 to-emerald-400';
  return (
    <div>
      <div className="font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">{label}</div>
      <div className={`mt-0.5 text-[12px] font-semibold tabular-nums ${color}`}>{value}</div>
      {pct !== undefined && (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-800">
          <div className={`h-full rounded-sm ${barBg}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
        </div>
      )}
    </div>
  );
}

// ─── Envelope metric cell ──────────────────────────────────────────────────
function _EnvelopeMetric({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const valueClass =
    tone === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warn'
      ? 'text-amber-600 dark:text-amber-400'
      : tone === 'bad'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-slate-900 dark:text-white';
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className={`mt-1 truncate text-[20px] font-semibold tabular-nums tracking-tight ${valueClass}`}>
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-500">{sub}</div>
      )}
    </div>
  );
}

// ─── Cost plan table (one per phase) ───────────────────────────────────────
function CostPlanTable({
  title,
  hint,
  badge,
  badgeTone,
  accent,
  lines,
  total,
  onUpdate,
  onRemove,
  onAdd,
  readOnly,
  selectedLineId,
  onSelectLine,
}: {
  title: string;
  hint: string;
  badge: string;
  badgeTone: 'capex' | 'opex';
  accent: 'indigo' | 'emerald';
  lines: CbsLineItem[];
  total: number;
  onUpdate: (id: string, patch: Partial<CbsLineItem>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  readOnly: boolean;
  selectedLineId?: string | null;
  onSelectLine?: (id: string) => void;
}) {
  const accentDot = accent === 'indigo' ? 'bg-indigo-500' : 'bg-emerald-500';
  const badgeClass =
    badgeTone === 'capex'
      ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Section header */}
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${accentDot}`} aria-hidden />
          <h3 className="truncate text-[13.5px] font-semibold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h3>
          <span
            className={`inline-flex h-[18px] items-center rounded border px-1.5 font-mono text-[9.5px] font-bold tracking-[0.08em] ${badgeClass}`}
          >
            {badge}
          </span>
          <span className="truncate text-[11.5px] text-slate-500 dark:text-slate-400">{hint}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
            {AED(total)}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[12px]"
            onClick={onAdd}
            disabled={readOnly}
            data-testid={`add-${title.toLowerCase()}-line`}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add line
          </Button>
        </div>
      </header>

      {/* Table */}
      {lines.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <div className="text-[12.5px] text-slate-500 dark:text-slate-400">
            No {title.toLowerCase()} lines yet.
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 h-7 px-2 text-[12px] text-indigo-600 dark:text-indigo-400"
            onClick={onAdd}
            disabled={readOnly}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add the first line
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-0 text-[12.5px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <th className="px-3 py-2 font-semibold">WBS</th>
                <th className="py-2 font-semibold">Description</th>
                <th className="hidden px-2 py-2 font-semibold md:table-cell">Category</th>
                <th className="px-2 py-2 text-right font-semibold">Qty</th>
                <th className="px-2 py-2 text-right font-semibold">Rate</th>
                <th className="px-2 py-2 text-right font-semibold">Total</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.map((l) => {
                const extended = lineExtended(l).withContingency;
                const isSelected = selectedLineId === l.id;
                const hasProcurement = (l.contracts?.length ?? 0) > 0;
                const hasSubtasks = (l.subTasks?.length ?? 0) > 0;
                return (
                  <tr
                    key={l.id}
                    data-selected={isSelected ? 'true' : undefined}
                    className={`group cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                      isSelected ? 'bg-indigo-50/60 dark:bg-indigo-500/10' : ''
                    }`}
                    onClick={(e) => {
                      // Only open the smart panel when the user clicks the
                      // row chrome (WBS code strip, totals, padding) — not
                      // the editable inputs themselves.
                      if (!onSelectLine) return;
                      const target = e.target as HTMLElement;
                      if (target.closest('input, select, textarea, button, [role="combobox"], [data-no-select]')) return;
                      onSelectLine(l.id);
                    }}
                  >
                    <td className="relative px-3 py-2 align-middle">
                      {isSelected && (
                        <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-indigo-500" aria-hidden />
                      )}
                      <Input
                        value={l.wbsCode}
                        onChange={(e) => onUpdate(l.id, { wbsCode: e.target.value })}
                        disabled={readOnly}
                        className="h-7 w-16 border-0 bg-transparent px-1 font-mono text-[11px] tabular-nums text-slate-600 shadow-none focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-indigo-400 dark:text-slate-400 dark:focus-visible:bg-slate-900"
                      />
                    </td>
                    <td className="py-2 align-middle">
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={l.description}
                          onChange={(e) => onUpdate(l.id, { description: e.target.value })}
                          disabled={readOnly}
                          placeholder="Describe this cost line…"
                          className="h-7 w-full min-w-0 border-0 bg-transparent px-1 text-[12.5px] shadow-none focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-indigo-400 dark:focus-visible:bg-slate-900"
                        />
                        {hasProcurement && (
                          <span
                            className="inline-flex h-4 items-center gap-0.5 rounded-sm bg-sky-50 px-1 text-[9px] font-bold uppercase tracking-[0.08em] text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
                            title={`${l.contracts!.length} procurement link${l.contracts!.length > 1 ? 's' : ''}`}
                          >
                            <Link2 className="h-2.5 w-2.5" />
                            {l.contracts!.length}
                          </span>
                        )}
                        {hasSubtasks && (
                          <span
                            className="inline-flex h-4 items-center gap-0.5 rounded-sm bg-violet-50 px-1 text-[9px] font-bold uppercase tracking-[0.08em] text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
                            title={`${l.subTasks!.length} sub-task${l.subTasks!.length > 1 ? 's' : ''}`}
                          >
                            <ListTree className="h-2.5 w-2.5" />
                            {l.subTasks!.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-2 py-2 align-middle md:table-cell">
                      <Select
                        value={l.category}
                        onValueChange={(v) => onUpdate(l.id, { category: v as CbsLineItem['category'] })}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-7 w-[104px] border-0 bg-transparent px-1.5 text-[11.5px] capitalize shadow-none focus:bg-white focus:ring-1 focus:ring-indigo-400 dark:focus:bg-slate-900">
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
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <Input
                        type="number"
                        min={0}
                        value={l.quantity}
                        onChange={(e) => onUpdate(l.id, { quantity: Number(e.target.value) || 0 })}
                        disabled={readOnly}
                        className="h-7 w-14 border-0 bg-transparent px-1 text-right text-[12.5px] tabular-nums shadow-none focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-indigo-400 dark:focus-visible:bg-slate-900"
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <Input
                        type="number"
                        min={0}
                        value={l.unitRate}
                        onChange={(e) => onUpdate(l.id, { unitRate: Number(e.target.value) || 0 })}
                        disabled={readOnly}
                        className="h-7 w-24 border-0 bg-transparent px-1 text-right text-[12.5px] tabular-nums shadow-none focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-indigo-400 dark:focus-visible:bg-slate-900"
                      />
                    </td>
                    <td className="px-2 py-2 text-right align-middle text-[12.5px] font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
                      {AED(extended)}
                    </td>
                    <td className="pr-3 align-middle">
                      <div className="flex items-center gap-0.5">
                        {onSelectLine && (
                          <button
                            type="button"
                            data-no-select
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectLine(isSelected ? '' : l.id);
                            }}
                            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                              isSelected
                                ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                                : 'text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300'
                            }`}
                            aria-label={isSelected ? 'Close detail panel' : 'Open detail panel'}
                            title={isSelected ? 'Close detail' : 'Open smart panel'}
                          >
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                          </button>
                        )}
                        <button
                          type="button"
                          data-no-select
                          onClick={(e) => { e.stopPropagation(); onRemove(l.id); }}
                          disabled={readOnly}
                          className="invisible flex h-7 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 group-hover:visible disabled:invisible dark:hover:bg-rose-500/10"
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Views
// ────────────────────────────────────────────────────────────────────────────

// Business Case Vitals strip — prominently surfaces the committee-level story
// (ROI, NPV, Payback, Peak funding, Pilot gate) at the top of the Overview so
// the Cost studio reads as a continuation of the approved business case rather
// than an isolated operational tool.
function _BusinessCaseVitalsStrip({
  vitals,
  cashProfile,
}: {
  vitals: BusinessCaseVitals;
  cashProfile: BusinessCaseCashProfile;
}) {
  const fmtAed = (n: number | null) => (n == null || !Number.isFinite(n) ? '—' : AED(Math.round(n)));
  const fmtPct = (n: number | null) => (n == null || !Number.isFinite(n) ? '—' : `${n >= 0 ? '' : '−'}${Math.abs(n).toFixed(1)}%`);
  const fmtMonths = (n: number | null) => (n == null || !Number.isFinite(n) ? '—' : `${Math.round(n)} mo`);

  const roiTone = vitals.roiPct == null ? 'neutral' : vitals.roiPct >= 0 ? 'good' : 'bad';
  const npvTone = vitals.npv == null ? 'neutral' : vitals.npv >= 0 ? 'good' : 'bad';
  const gateTone = vitals.pilotGateStatus === 'PASS' ? 'good' : vitals.pilotGateStatus === 'FAIL' ? 'bad' : 'neutral';

  const Tile = ({
    label,
    value,
    sub,
    tone = 'neutral',
    icon: IconCmp,
  }: {
    label: string;
    value: string;
    sub?: string;
    tone?: 'good' | 'bad' | 'neutral';
    icon?: React.ComponentType<{ className?: string }>;
  }) => {
    const toneBg: Record<string, string> = {
      good: 'bg-emerald-50/60 dark:bg-emerald-500/5',
      bad: 'bg-rose-50/60 dark:bg-rose-500/5',
      neutral: 'bg-white dark:bg-slate-900',
    };
    const toneValue: Record<string, string> = {
      good: 'text-emerald-700 dark:text-emerald-300',
      bad: 'text-rose-700 dark:text-rose-300',
      neutral: 'text-slate-900 dark:text-white',
    };
    const toneIcon: Record<string, string> = {
      good: 'text-emerald-500 dark:text-emerald-400',
      bad: 'text-rose-500 dark:text-rose-400',
      neutral: 'text-slate-400 dark:text-slate-500',
    };
    return (
      <div className={`rounded-xl border border-slate-200 p-3 dark:border-slate-700 ${toneBg[tone]}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</div>
          {IconCmp && <IconCmp className={`h-3.5 w-3.5 ${toneIcon[tone]}`} />}
        </div>
        <div className={`mt-1 text-[17px] font-bold tabular-nums leading-tight ${toneValue[tone]}`}>{value}</div>
        {sub && <div className="mt-0.5 text-[10.5px] text-slate-500 dark:text-slate-400">{sub}</div>}
      </div>
    );
  };

  const horizon = cashProfile.rows.length > 0
    ? `${cashProfile.rows[cashProfile.rows.length - 1]!.year - cashProfile.rows[0]!.year + 1}-yr`
    : '';

  return (
    <Card className="overflow-hidden border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading
            icon={Scale}
            title="Business case financial vitals"
            subtitle={`Committee-level economics the Cost plan reconciles against${horizon ? ` · ${horizon} horizon` : ''}.`}
          />
          {vitals.decisionLabel && (
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] ${
              vitals.fundingBlocked
                ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
                : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              {vitals.fundingBlocked ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
              {vitals.decisionLabel}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-7">
          <Tile
            label="Total cost (BC)"
            value={fmtAed(vitals.totalCost)}
            sub={vitals.totalBenefit > 0 ? `benefit ${fmtAed(vitals.totalBenefit)}` : undefined}
            icon={Wallet}
          />
          <Tile label="ROI" value={fmtPct(vitals.roiPct)} sub={vitals.discountRatePct != null ? `discount ${vitals.discountRatePct.toFixed(0)}%` : undefined} tone={roiTone} icon={TrendingUp} />
          <Tile label="NPV" value={fmtAed(vitals.npv)} sub={vitals.irrPct != null ? `IRR ${fmtPct(vitals.irrPct)}` : undefined} tone={npvTone} icon={LineChart} />
          <Tile label="Payback" value={fmtMonths(vitals.paybackMonths)} sub="months to breakeven" icon={Target} />
          <Tile
            label="Peak funding"
            value={fmtAed(vitals.peakFundingAED)}
            sub={vitals.peakFundingYear != null ? `treasury peak · Y${vitals.peakFundingYear}` : undefined}
            icon={Flame}
            tone={vitals.peakFundingAED && vitals.peakFundingAED > 0 ? 'bad' : 'neutral'}
          />
          <Tile
            label="Pilot gate"
            value={vitals.pilotGateStatus ?? '—'}
            sub={vitals.pilotGateStatus === 'FAIL' ? 'release capital with care' : vitals.pilotGateStatus === 'PASS' ? 'ready to scale' : undefined}
            icon={Gauge}
            tone={gateTone}
          />
          <Tile
            label="Reserve assumptions"
            value={vitals.contingencyPct != null ? `${(vitals.contingencyPct * 100).toFixed(0)}% / ${vitals.maintenancePct != null ? (vitals.maintenancePct * 100).toFixed(0) : '—'}%` : '—'}
            sub="contingency / maintenance"
            icon={Shield}
          />
        </div>
        {vitals.fundingBlocked && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/60 p-2.5 text-[11.5px] text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/5 dark:text-rose-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>Business case flags <strong>scale funding blocked</strong> — only Phase 1 pilot capital may be released until exit gates clear. Baseline and cashflow must stay inside the pilot envelope.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function _OverviewView({
  evm,
  phasing,
  plan,
  baselineTotals,
  bcSegments,
  bcVitals: _bcVitals,
  bcCashProfile: _bcCashProfile,
  hasBcAnnual,
  fundingTone,
  commitmentTone,
  scheduleTone,
  reserveTone,
  onJump,
}: {
  evm: EvmMetrics;
  phasing: Array<ReturnType<typeof computePhasing>[number] & { bcPlanned?: number; bcCumulative?: number }>;
  plan: CostPlanState;
  baselineTotals: { base: number; contingencyLineReserve: number; capex: number; opex: number; contingencyPool: number; managementPool: number; reserveBase: number; implementation: number; operations: number; maintenance: number; other: number };
  bcSegments: BusinessCaseSegmentTotals;
  bcVitals: BusinessCaseVitals;
  bcCashProfile: BusinessCaseCashProfile;
  hasBcAnnual: boolean;
  fundingTone: 'green' | 'amber' | 'red';
  commitmentTone: 'green' | 'amber' | 'red';
  scheduleTone: 'green' | 'amber' | 'red';
  reserveTone: 'green' | 'amber' | 'red';
  onJump: (view: CostViewId) => void;
}) {
  const commitmentPct = Math.min(100, (evm.committed / Math.max(1, evm.bac)) * 100);
  const actualPct = Math.min(100, (evm.ac / Math.max(1, evm.bac)) * 100);
  const earnedPct = Math.min(100, (evm.ev / Math.max(1, evm.bac)) * 100);

  // Top cost drivers — by extended cost share of BAC
  const drivers = [...plan.cbs]
    .map((l) => ({ line: l, ext: lineExtended(l).withContingency }))
    .sort((a, b) => b.ext - a.ext)
    .slice(0, 5);
  const driverTotal = drivers.reduce((s, d) => s + d.ext, 0);

  // Waterfall — BAC → approved changes → forecast variance → EAC
  const approvedChange = plan.changes
    .filter((c) => c.status === 'approved' || c.status === 'applied')
    .reduce((s, c) => s + c.amount, 0);
  const forecastVariance = evm.eac - evm.bac - approvedChange;

  const reserveLeft = Math.max(0, baselineTotals.contingencyPool - plan.reserves.contingencyUsed);

  return (
    <div className="space-y-4">
      {/* Health posture — 4 tone dots + 10-metric EVM grid.
          Header stripped per product direction; the metric cards speak for
          themselves as the first panel of the cost story. */}
      <Card className="overflow-hidden">
        <CardContent className="space-y-2 pt-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-800/40">
            <StatusDot tone={fundingTone} label="Funding" value={`VAC ${AED(evm.vac)}`} />
            <StatusDot tone={commitmentTone} label="Commitment" value={toPct((evm.committed / Math.max(1, evm.bac)) * 100)} />
            <StatusDot tone={scheduleTone} label="Schedule" value={`SPI ${evm.spi.toFixed(2)}`} />
            <StatusDot tone={reserveTone} label="Contingency" value={`${AED(reserveLeft)} left`} />
          </div>
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 divide-x divide-y divide-slate-200 md:grid-cols-5 md:divide-y-0 xl:grid-cols-10 dark:border-slate-700 dark:divide-slate-800">
            <MetricCell label="BAC" value={AED(evm.bac)} sub="Baseline" />
            <MetricCell label="Committed" value={AED(evm.committed)} sub="POs" />
            <MetricCell label="AC" value={AED(evm.ac)} sub="Actual cost" />
            <MetricCell label="EV" value={AED(evm.ev)} sub="Earned" />
            <MetricCell label="PV" value={AED(evm.pv)} sub="Planned" />
            <MetricCell label="CPI" value={evm.cpi.toFixed(2)} sub={evm.cpi >= 1 ? 'On budget' : 'Over'} tone={evm.cpi >= 1 ? 'good' : evm.cpi >= 0.9 ? 'warn' : 'bad'} />
            <MetricCell label="SPI" value={evm.spi.toFixed(2)} sub={evm.spi >= 1 ? 'On schedule' : evm.spi >= 0.9 ? 'Slipping' : 'Behind'} tone={evm.spi >= 1 ? 'good' : evm.spi >= 0.9 ? 'warn' : 'bad'} />
            <MetricCell label="EAC" value={AED(evm.eac)} sub={`ETC ${AED(evm.etc)}`} tone={evm.eac <= evm.bac ? 'good' : evm.eac <= evm.bac * 1.05 ? 'warn' : 'bad'} />
            <MetricCell label="VAC" value={AED(evm.vac)} sub={evm.vac >= 0 ? 'Under' : 'Over'} tone={evm.vac >= 0 ? 'good' : evm.vac > -evm.bac * 0.05 ? 'warn' : 'bad'} />
            <MetricCell
              label="Reserve"
              value={AED(reserveLeft)}
              sub={`${toPct(plan.reserves.contingencyPct)} of CAPEX`}
              tone={reserveTone === 'red' ? 'bad' : reserveTone === 'amber' ? 'warn' : 'good'}
            />
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-6">
      {/* Hero: Budget Ring */}
      <Card className="xl:col-span-2 overflow-hidden">
        <CardHeader className="pb-3">
          <SectionHeading icon={Gauge} title="Budget constellation" subtitle="Concentric view of BAC consumption — committed, actuals, earned." />
        </CardHeader>
        <CardContent>
          <BudgetRing bac={evm.bac} committed={evm.committed} ac={evm.ac} ev={evm.ev} eac={evm.eac} />
        </CardContent>
      </Card>

      {/* S-curve */}
      <Card className="xl:col-span-4">
        <CardHeader className="pb-3">
          <SectionHeading icon={LineChart} title="Cumulative S-curve" subtitle="Planned value, actual cost and earned value through the delivery timeline." />
        </CardHeader>
        <CardContent>
          {phasing.length === 0 ? (
            <EmptyState
              icon={LineChart}
              title="No phasing yet"
              hint="Add planned start/end dates and planned costs to WBS tasks to generate the S-curve."
            />
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={phasing} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
                  <defs>
                    <linearGradient id="pv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.45} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => AED(Number(v))} tick={{ fontSize: 11 }} width={90} />
                  <RechartsTooltip formatter={(v) => AED(Number(v))} labelClassName="text-xs" />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="cumulativePlanned" name="Planned (PV)" stroke="#6366f1" fill="url(#pv)" />
                  <Line type="monotone" dataKey="cumulativeActual" name="Actuals (AC)" stroke="#f43f5e" strokeWidth={2} dot={false} />
                  {hasBcAnnual && (
                    <Line type="stepAfter" dataKey="bcCumulative" name="Business case plan (FY)" stroke="#059669" strokeDasharray="5 4" strokeWidth={2} dot={false} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost drivers */}
      <Card className="xl:col-span-3">
        <CardHeader className="pb-3">
          <SectionHeading icon={Flame} title="Top cost drivers" subtitle={`Where ${driverTotal > 0 ? `${AED(driverTotal)} (${toPct((driverTotal / Math.max(1, evm.bac)) * 100)} of BAC)` : 'the baseline'} concentrates.`}>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onJump('baseline')}>
              Open baseline <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </SectionHeading>
        </CardHeader>
        <CardContent>
          {drivers.length === 0 ? (
            <EmptyState icon={Flame} title="No CBS lines" hint="Add Cost Breakdown Structure lines to surface your top drivers." />
          ) : (
            <div className="space-y-2">
              {drivers.map((d, i) => (
                <DriverRow
                  key={d.line.id}
                  rank={i + 1}
                  name={d.line.description}
                  code={d.line.wbsCode}
                  category={d.line.category}
                  segment={d.line.segment ?? 'implementation'}
                  amount={d.ext}
                  pctOfBac={(d.ext / Math.max(1, evm.bac)) * 100}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budget posture */}
      <Card className="xl:col-span-3">
        <CardHeader className="pb-3">
          <SectionHeading icon={Wallet} title="Budget posture" subtitle="Where the money sits against the approved envelope." />
        </CardHeader>
        <CardContent className="space-y-4">
          <PostureRow label="Earned value" amount={evm.ev} total={evm.bac} pct={earnedPct} color="emerald" />
          <PostureRow label="Actuals" amount={evm.ac} total={evm.bac} pct={actualPct} color="rose" />
          <PostureRow label="Committed" amount={evm.committed} total={evm.bac} pct={commitmentPct} color="amber" />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              <span>Reserves</span>
              <span>{AED(baselineTotals.contingencyPool + baselineTotals.managementPool)}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <MiniStat label="Contingency pool" value={AED(baselineTotals.contingencyPool)} sub={`Used ${AED(plan.reserves.contingencyUsed)}`} />
              <MiniStat label="Management res." value={AED(baselineTotals.managementPool)} sub={`Used ${AED(plan.reserves.managementReserveUsed)}`} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MiniStat
              label="Implementation"
              value={AED(baselineTotals.implementation)}
              sub={bcSegments.implementation > 0 ? `BC ${AED(bcSegments.implementation)}` : 'CAPEX envelope'}
            />
            <MiniStat
              label="Operations"
              value={AED(baselineTotals.operations)}
              sub={bcSegments.operations > 0 ? `BC ${AED(bcSegments.operations)}` : 'OPEX run'}
            />
            <MiniStat
              label="Maintenance"
              value={AED(baselineTotals.maintenance)}
              sub={bcSegments.maintenance > 0 ? `BC ${AED(bcSegments.maintenance)}` : 'OPEX sustain'}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="CAPEX" value={AED(baselineTotals.capex)} sub="Investment-class spend" />
            <MiniStat label="OPEX" value={AED(baselineTotals.opex)} sub="Operational sustainment" />
          </div>
        </CardContent>
      </Card>

      {/* Variance waterfall */}
      <Card className="xl:col-span-6">
        <CardHeader className="pb-3">
          <SectionHeading icon={BarChart3} title="Variance waterfall" subtitle="How the approved baseline flows to the forecast at completion." />
        </CardHeader>
        <CardContent>
          <VarianceWaterfall bac={evm.bac} approvedChange={approvedChange} forecastVariance={forecastVariance} eac={evm.eac} />
        </CardContent>
      </Card>

      {/* Insights */}
      <Card className="xl:col-span-6">
        <CardHeader className="pb-3">
          <SectionHeading icon={ClipboardList} title="Planning insights" subtitle="What the numbers say about your plan's cost position." />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            <Insight
              tone={evm.cpi >= 1 ? 'good' : 'warn'}
              title={evm.cpi >= 1 ? 'Cost performance is healthy' : 'Cost performance is under pressure'}
              body={`CPI is ${evm.cpi.toFixed(2)} — for every 1 AED spent you earn ${evm.cpi.toFixed(2)} AED of scope. ${evm.cpi >= 1 ? 'Maintain rate discipline and reserve drawdown governance.' : 'Investigate burn hotspots and reprice open scope.'}`}
            />
            <Insight
              tone={evm.spi >= 0.95 ? 'good' : 'warn'}
              title={evm.spi >= 0.95 ? 'Schedule pace supports forecast' : 'Schedule is trailing plan'}
              body={`SPI is ${evm.spi.toFixed(2)}. ${evm.spi >= 0.95 ? 'Earned value is keeping pace with planned value.' : 'Rebase critical-path tasks and check resource contention.'}`}
            />
            <Insight
              tone={evm.vac >= 0 ? 'good' : 'bad'}
              title={evm.vac >= 0 ? `Forecast ${AED(evm.vac)} under budget` : `Forecast ${AED(Math.abs(evm.vac))} over budget`}
              body={`EAC projects to ${AED(evm.eac)} against BAC ${AED(evm.bac)}. ${evm.vac >= 0 ? 'Convert favorable variance into reserve headroom.' : 'Trigger a change review or redirect contingency.'}`}
            />
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

// Budget Ring — SVG concentric arcs showing BAC consumption layers
function BudgetRing({ bac, committed, ac, ev, eac }: { bac: number; committed: number; ac: number; ev: number; eac: number }) {
  const size = 220;
  const center = size / 2;
  const strokeW = 14;
  const gap = 4;
  const safeBac = Math.max(1, bac);
  const arcs = [
    { label: 'Committed', value: committed, pct: Math.min(1, committed / safeBac), color: '#f59e0b', bg: '#fde68a' },
    { label: 'Actuals', value: ac, pct: Math.min(1, ac / safeBac), color: '#f43f5e', bg: '#fecdd3' },
    { label: 'Earned', value: ev, pct: Math.min(1, ev / safeBac), color: '#10b981', bg: '#a7f3d0' },
  ];
  const variance = bac - eac;
  const varianceTone = variance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90">
          {arcs.map((arc, i) => {
            const r = center - strokeW / 2 - i * (strokeW + gap);
            const circumference = 2 * Math.PI * r;
            const dash = circumference * arc.pct;
            return (
              <g key={arc.label}>
                <circle cx={center} cy={center} r={r} fill="none" stroke={arc.bg} strokeOpacity={0.25} strokeWidth={strokeW} />
                <circle
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={strokeW}
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  style={{ transition: 'stroke-dasharray 500ms ease-out' }}
                />
              </g>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">BAC</div>
          <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{AED(bac)}</div>
          <div className={`mt-1 text-[11px] font-semibold tabular-nums ${varianceTone}`}>
            {variance >= 0 ? '−' : '+'}{AED(Math.abs(variance))} vs EAC
          </div>
        </div>
      </div>
      <div className="grid w-full grid-cols-3 gap-2">
        {arcs.map((arc) => (
          <div key={arc.label} className="rounded-xl border border-slate-200 bg-white p-2 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full" style={{ background: arc.color }} />
              {arc.label}
            </div>
            <div className="mt-0.5 text-[12.5px] font-bold tabular-nums text-slate-900 dark:text-white">{AED(arc.value)}</div>
            <div className="text-[10px] text-slate-400">{toPct(arc.pct * 100)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DriverRow({ rank, name, code, category, segment, amount, pctOfBac }: { rank: number; name: string; code: string; category: string; segment: NonNullable<CbsLineItem['segment']>; amount: number; pctOfBac: number }) {
  const catColor: Record<string, string> = {
    labor: 'bg-indigo-500',
    subcontractor: 'bg-purple-500',
    material: 'bg-amber-500',
    equipment: 'bg-cyan-500',
    overhead: 'bg-slate-500',
    other: 'bg-slate-400',
  };
  const segmentBadge: Record<NonNullable<CbsLineItem['segment']>, { label: string; tone: string }> = {
    implementation: { label: 'Impl', tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' },
    operations: { label: 'Ops', tone: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
    maintenance: { label: 'Mnt', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
    other: { label: 'Other', tone: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300' },
  };
  const seg = segmentBadge[segment];
  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-2.5 transition-all hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">{name}</span>
            <Badge variant="outline" className="h-4 px-1 font-mono text-[9.5px] uppercase tracking-wider">{code}</Badge>
            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] ${seg.tone}`}>{seg.label}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className={`h-full ${catColor[category] ?? 'bg-slate-500'} transition-all`} style={{ width: `${Math.min(100, pctOfBac)}%` }} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{AED(amount)}</div>
          <div className="text-[10px] text-slate-400">{toPct(pctOfBac)} of BAC</div>
        </div>
      </div>
    </div>
  );
}

function VarianceWaterfall({ bac, approvedChange, forecastVariance, eac }: { bac: number; approvedChange: number; forecastVariance: number; eac: number }) {
  const steps: Array<{ label: string; value: number; cumulative: number; tone: 'neutral' | 'good' | 'bad' | 'total' }> = [];
  steps.push({ label: 'BAC approved', value: bac, cumulative: bac, tone: 'neutral' });
  steps.push({
    label: approvedChange >= 0 ? 'Approved scope added' : 'Approved scope reduced',
    value: approvedChange,
    cumulative: bac + approvedChange,
    tone: approvedChange === 0 ? 'neutral' : approvedChange > 0 ? 'bad' : 'good',
  });
  steps.push({
    label: forecastVariance >= 0 ? 'Forecast overrun' : 'Forecast underrun',
    value: forecastVariance,
    cumulative: eac,
    tone: forecastVariance === 0 ? 'neutral' : forecastVariance > 0 ? 'bad' : 'good',
  });
  steps.push({ label: 'EAC', value: eac, cumulative: eac, tone: 'total' });

  const maxCum = Math.max(...steps.map((s) => Math.abs(s.cumulative))) || 1;

  const toneStyles: Record<string, string> = {
    neutral: 'from-slate-500 to-slate-600',
    good: 'from-emerald-500 to-emerald-600',
    bad: 'from-rose-500 to-rose-600',
    total: 'from-indigo-500 to-indigo-700',
  };

  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const widthPct = (Math.abs(s.cumulative) / maxCum) * 100;
        const isDelta = i === 1 || i === 2;
        return (
          <div key={`${s.label}-${i}`} className="flex items-center gap-3">
            <div className="w-40 shrink-0 text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">{s.label}</div>
            <div className="relative h-8 flex-1 overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div
                className={`h-full bg-gradient-to-r ${toneStyles[s.tone]} shadow-sm transition-all duration-500 ease-out`}
                style={{ width: `${Math.max(2, widthPct)}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-between px-3 text-[11.5px] font-bold tabular-nums">
                <span className="text-white drop-shadow-sm">{isDelta && s.value !== 0 ? `${s.value > 0 ? '+' : ''}${AED(s.value)}` : ''}</span>
                <span className="text-slate-900 dark:text-white">{AED(s.cumulative)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PostureRow({ label, amount, total, pct, color }: { label: string; amount: number; total: number; pct: number; color: 'emerald' | 'rose' | 'amber' }) {
  const colorMap = { emerald: 'bg-emerald-500', rose: 'bg-rose-500', amber: 'bg-amber-500' };
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums text-slate-500 dark:text-slate-400">
          {AED(amount)} <span className="text-[10px] text-slate-400">/ {AED(total)}</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full ${colorMap[color]} transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-bold tabular-nums text-slate-900 dark:text-white">{value}</div>
      {sub && <div className="text-[10.5px] text-slate-500 dark:text-slate-400">{sub}</div>}
    </div>
  );
}

function Insight({ tone, title, body }: { tone: 'good' | 'warn' | 'bad'; title: string; body: string }) {
  const styles: Record<string, string> = {
    good: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/5',
    warn: 'border-amber-200 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/5',
    bad: 'border-rose-200 bg-rose-50/70 dark:border-rose-500/30 dark:bg-rose-500/5',
  };
  const Icon = tone === 'good' ? CheckCircle2 : tone === 'bad' ? AlertTriangle : Activity;
  return (
    <div className={`rounded-2xl border p-3 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: React.ComponentType<{ className?: string }>; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-800/30">
      <Icon className="mb-2 h-6 w-6 text-slate-400" />
      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</div>
      <p className="mt-1 max-w-md text-[12.5px] text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

// ─── BAC source chip + reconciliation banner ───────────────────────────────

function _BacSourceChip({ resolution }: { resolution: BacResolution }) {
  const tone = resolution.amount > 0
    ? (resolution.isGovernanceApproved ? 'emerald' : 'indigo')
    : 'slate';
  const styles: Record<string, string> = {
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
    indigo: 'border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200',
    slate: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  const Icon = resolution.isGovernanceApproved ? Lock : resolution.amount > 0 ? FileCheck : AlertTriangle;
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 px-2 py-0.5 text-[10.5px] font-semibold ${styles[tone]}`}
      title={resolution.breakdown?.map((b) => `${b.label}: ${AED(b.value)}`).join(' · ')}
    >
      <Icon className="h-3 w-3" />
      <span className="uppercase tracking-[0.14em]">BAC</span>
      <span className="font-bold tabular-nums">{resolution.amount > 0 ? AED(resolution.amount) : '—'}</span>
      <span className="text-[9.5px] font-normal opacity-75">· {resolution.label}</span>
    </Badge>
  );
}

function BusinessCaseAlignmentBanner({
  segmentTotals,
  bcSegments,
}: {
  segmentTotals: { implementation: number; operations: number; maintenance: number; other: number };
  bcSegments: BusinessCaseSegmentTotals;
}) {
  const rows: Array<{ key: 'implementation' | 'operations' | 'maintenance'; label: string; bc: number; cbs: number }> = [
    { key: 'implementation', label: 'Implementation', bc: bcSegments.implementation, cbs: segmentTotals.implementation },
    { key: 'operations', label: 'Operations', bc: bcSegments.operations, cbs: segmentTotals.operations },
    { key: 'maintenance', label: 'Maintenance', bc: bcSegments.maintenance, cbs: segmentTotals.maintenance },
  ];
  const activeRows = rows.filter((r) => r.bc > 0 || r.cbs > 0);
  if (activeRows.length === 0) return null;
  const worstPct = Math.max(
    ...activeRows.map((r) => (r.bc > 0 ? Math.abs(r.cbs - r.bc) / r.bc : r.cbs > 0 ? 1 : 0)),
  );
  const inTolerance = worstPct <= 0.005;
  const tone = inTolerance ? 'emerald' : worstPct <= 0.05 ? 'indigo' : 'rose';
  const toneStyles: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/5',
    indigo: 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/30 dark:bg-indigo-500/5',
    rose: 'border-rose-200 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/5',
  };
  const Icon = inTolerance ? CheckCircle2 : AlertTriangle;
  const iconColor = inTolerance ? 'text-emerald-600 dark:text-emerald-400' : tone === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400';

  return (
    <div className={`border-b px-4 py-3 ${toneStyles[tone]}`}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
        <div className="text-[12.5px] font-semibold text-slate-900 dark:text-white">
          {inTolerance
            ? 'CBS segments reconcile to the business case financial model.'
            : 'CBS segments are drifting from the business case financial model — reconcile before baselining.'}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
        {activeRows.map((r) => {
          const delta = r.cbs - r.bc;
          const pct = r.bc > 0 ? Math.abs(delta) / r.bc : r.cbs > 0 ? 1 : 0;
          const rowTone = pct <= 0.005 ? 'text-emerald-700 dark:text-emerald-300' : pct <= 0.05 ? 'text-slate-600 dark:text-slate-300' : 'text-rose-700 dark:text-rose-300';
          return (
            <div key={r.key} className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-1.5 text-[11.5px] tabular-nums dark:bg-slate-900/40">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{r.label}</span>
              <span className="text-slate-500 dark:text-slate-400">BC {AED(r.bc)}</span>
              <span className="text-slate-500 dark:text-slate-400">CBS {AED(r.cbs)}</span>
              <span className={`font-semibold ${rowTone}`}>{delta >= 0 ? '+' : '−'}{AED(Math.abs(delta))}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BacReconciliationBanner({
  resolution,
  bac,
  baselineTotal,
  reconciliation,
  inTolerance,
  onAllocate,
  readOnly,
}: {
  resolution: BacResolution;
  bac: number;
  baselineTotal: number;
  reconciliation: number;
  inTolerance: boolean;
  onAllocate: () => void;
  readOnly?: boolean;
}) {
  if (bac <= 0) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-amber-50/60 px-4 py-3 dark:border-slate-700 dark:bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1 text-[12.5px] text-amber-900 dark:text-amber-200">
          <span className="font-semibold">No approved budget found yet.</span>
          <span className="ml-1 text-amber-800/80 dark:text-amber-300/80">
            Set the project approved budget or complete the business case financials — the studio will pick it up automatically and allocate it across the CBS.
          </span>
        </div>
      </div>
    );
  }

  const tone = inTolerance ? 'good' : reconciliation >= 0 ? 'info' : 'warn';
  const toneStyles: Record<string, string> = {
    good: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/5',
    info: 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/30 dark:bg-indigo-500/5',
    warn: 'border-rose-200 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/5',
  };
  const Icon = inTolerance ? CheckCircle2 : AlertTriangle;
  const iconColor = inTolerance ? 'text-emerald-600 dark:text-emerald-400' : reconciliation >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400';

  // When the CBS is inside the ±0.5% tolerance there is nothing actionable
  // to communicate — the reconciliation mini-stats above the grid already
  // show the totals. Skip rendering the banner entirely to cut header noise.
  if (inTolerance) return null;

  let message: string;
  if (baselineTotal <= 0) {
    message = `Approved BAC is ${AED(bac)}. Your CBS is still empty — allocate the budget across work packages to begin costing.`;
  } else if (reconciliation >= 0) {
    message = `CBS is ${AED(baselineTotal)} — ${AED(reconciliation)} of the ${AED(bac)} BAC is still unallocated.`;
  } else {
    message = `CBS is ${AED(baselineTotal)} — overshoots BAC (${AED(bac)}) by ${AED(Math.abs(reconciliation))}.`;
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 border-b px-4 py-3 ${toneStyles[tone]}`}>
      <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
      <div className="min-w-0 flex-1 text-[12.5px]">
        <div className="font-semibold text-slate-900 dark:text-white">{message}</div>
        <div className="mt-0.5 text-slate-600 dark:text-slate-300">
          Source: <span className="font-semibold">{resolution.label}</span>
          {resolution.breakdown && resolution.breakdown.length > 0 && (
            <>
              {' · '}
              {resolution.breakdown.map((b, i) => (
                <span key={b.label} className="tabular-nums">
                  {b.label} {AED(b.value)}{i < resolution.breakdown!.length - 1 ? ' + ' : ''}
                </span>
              ))}
            </>
          )}
        </div>
      </div>
      {!inTolerance && (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onAllocate} disabled={readOnly}>
          <Scale className="h-3.5 w-3.5" />
          Allocate to BAC
        </Button>
      )}
    </div>
  );
}

// ─── Baseline (CBS) ────────────────────────────────────────────────────────

// ─── CBS Line drill-down ───────────────────────────────────────────────────
// For business-case sourced lines — especially recurring operations /
// maintenance streams — render a detail panel beneath the row that exposes
// the year-by-year spend profile and lets the user attach contracts
// (support SLAs, licence renewals, hosting agreements) that fund the line.
// This closes the loop between the approved BC cash plan, the CBS baseline,
// and the contracts that actually pay for the run cost.

function CbsLineDetailPanel({
  line,
  readOnly,
  onUpdate,
}: {
  line: CbsLineItem;
  readOnly?: boolean;
  onUpdate: (id: string, patch: Partial<CbsLineItem>) => void;
}) {
  const years = Array.isArray(line.yearBreakdown) ? line.yearBreakdown : [];
  const contracts = Array.isArray(line.contracts) ? line.contracts : [];
  const subTasks = Array.isArray(line.subTasks) ? line.subTasks : [];

  // For operations / maintenance lines we always want to show the full
  // Y1-Y5 run-year ladder so the user can see coverage at a glance and
  // populate any missing years directly from the detail panel. Implementation
  // lines may legitimately have a single "Initial" row.
  const isRecurringLine = line.segment === 'operations' || line.segment === 'maintenance';
  const displayYears: Array<{ year: number; amount: number; label?: string; isPadded: boolean }> = (() => {
    if (!isRecurringLine) return years.map((y) => ({ ...y, isPadded: false }));
    const byYear = new Map<number, { year: number; amount: number; label?: string }>();
    years.forEach((y) => { if (typeof y.year === 'number') byYear.set(y.year, y); });
    const out: Array<{ year: number; amount: number; label?: string; isPadded: boolean }> = [];
    for (let y = 1; y <= 5; y++) {
      const existing = byYear.get(y);
      if (existing) out.push({ ...existing, isPadded: false });
      else out.push({ year: y, amount: 0, label: `Year ${y}`, isPadded: true });
    }
    // Retain any user-added extra rows (Y0 initial, Y6+)
    years
      .filter((y) => typeof y.year === 'number' && (y.year < 1 || y.year > 5))
      .forEach((y) => out.push({ ...y, isPadded: false }));
    return out.sort((a, b) => a.year - b.year);
  })();

  const yearsTotal = years.reduce((s, y) => s + (y.amount || 0), 0);
  const populatedYears = displayYears.filter((y) => y.amount > 0).length;
  const contractsTotal = contracts
    .filter((c) => c.status === 'active' || c.status === 'renewal')
    .reduce((s, c) => s + (c.annualValue || 0) * yearsOfCoverage(c), 0);
  const coverageGap = yearsTotal - contractsTotal;
  const coveragePct = yearsTotal > 0 ? Math.min(1, contractsTotal / yearsTotal) : 0;

  const subTasksTotal = subTasks.reduce((s, st) => s + (st.amount || 0), 0);
  const lineExtended = line.quantity * line.unitRate;
  const subTasksReconcilePct = lineExtended > 0 ? subTasksTotal / lineExtended : 0;

  const commitYears = (next: typeof displayYears) => {
    // Persist back as { year, amount, label } stripping isPadded and keeping
    // only rows with a non-zero amount OR rows the user explicitly edited
    // (we treat the full ladder as "authored" once any year is non-zero).
    const anyNonZero = next.some((y) => y.amount > 0);
    const persisted = anyNonZero
      ? next.map((y) => ({ year: y.year, amount: y.amount, label: y.label }))
      : next.filter((y) => !y.isPadded).map((y) => ({ year: y.year, amount: y.amount, label: y.label }));
    onUpdate(line.id, { yearBreakdown: persisted });
  };
  const updateYear = (year: number, amount: number) => {
    const idx = displayYears.findIndex((y) => y.year === year);
    if (idx < 0) return;
    const next = [...displayYears];
    next[idx] = { ...next[idx]!, amount, isPadded: false };
    commitYears(next);
  };
  const addYear = () => {
    const max = displayYears.reduce((m, y) => Math.max(m, y.year), 0);
    const nextYear = max + 1;
    commitYears([...displayYears, { year: nextYear, amount: 0, label: `Year ${nextYear}`, isPadded: false }]);
  };
  const removeYear = (year: number) => {
    commitYears(displayYears.filter((y) => y.year !== year));
  };
  const autoFillYears = () => {
    // Even distribution of the remaining line value across any zero years so
    // the user gets a sensible starting point for a flat run cost.
    const zeroYears = displayYears.filter((y) => y.amount === 0);
    if (zeroYears.length === 0) return;
    const remaining = Math.max(0, lineExtended - yearsTotal);
    if (remaining <= 0) return;
    const share = Math.round(remaining / zeroYears.length);
    const next = displayYears.map((y) => (y.amount === 0 ? { ...y, amount: share, isPadded: false } : y));
    commitYears(next);
  };

  const updateContract = (id: string, patch: Partial<BcLineContract>) => {
    const next = contracts.map((c) => (c.id === id ? { ...c, ...patch } : c));
    onUpdate(line.id, { contracts: next });
  };
  const addContract = () => {
    const today = new Date().toISOString().split('T')[0]!;
    const newContract: BcLineContract = {
      id: uid(),
      vendor: '',
      reference: '',
      scope: line.description,
      startDate: today,
      endDate: today,
      annualValue: line.unitRate,
      status: 'draft',
    };
    onUpdate(line.id, { contracts: [...contracts, newContract] });
  };
  const removeContract = (id: string) => {
    onUpdate(line.id, { contracts: contracts.filter((c) => c.id !== id) });
  };

  const updateSubTask = (id: string, patch: Partial<CbsLineSubTask>) => {
    onUpdate(line.id, { subTasks: subTasks.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  };
  // Track the most-recently added sub-task so we can (a) auto-focus its
  // description input and (b) tint the row briefly so the user sees where
  // the new entry landed — previous UX dumped a blank row at the bottom
  // with no focus transfer, which felt abrupt.
  const [justAddedSubTaskId, setJustAddedSubTaskId] = useState<string | null>(null);
  const subTaskDescRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  useEffect(() => {
    if (!justAddedSubTaskId) return;
    const node = subTaskDescRefs.current.get(justAddedSubTaskId);
    if (node) {
      node.focus();
      node.select();
    }
    const t = setTimeout(() => setJustAddedSubTaskId(null), 1400);
    return () => clearTimeout(t);
  }, [justAddedSubTaskId]);
  const addSubTask = () => {
    // Smart default: if the line still has unreconciled budget, seed the
    // new sub-task with the remaining amount so the user lands on a row
    // that immediately adds up to the parent line total. If nothing
    // remains (fully priced already) we fall back to 0.
    const remaining = Math.max(0, lineExtended - subTasksTotal);
    const newSub: CbsLineSubTask = {
      id: uid(),
      description: '',
      amount: remaining > 0 ? remaining : 0,
      owner: '',
      status: 'pending',
    };
    onUpdate(line.id, { subTasks: [...subTasks, newSub] });
    setJustAddedSubTaskId(newSub.id);
  };
  const removeSubTask = (id: string) => {
    onUpdate(line.id, { subTasks: subTasks.filter((s) => s.id !== id) });
  };
  const handleSubTaskKeyDown = (st: CbsLineSubTask) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSubTask();
    } else if (e.key === 'Escape' && !st.description && !st.amount && !st.owner) {
      e.preventDefault();
      removeSubTask(st.id);
    }
  };

  // One-at-a-time tabbed drill-down keeps the user focused on a single
  // concern. Numeric pricing lives inline in the main table; this panel
  // surfaces richer detail: sub-costs, annual spend profile, contracts.
  type DetailTab = 'subcosts' | 'profile' | 'contracts';
  const [activeTab, setActiveTab] = useState<DetailTab>('subcosts');
  const subCostsCount = subTasks.length;
  const yearsCount = displayYears.filter((y) => y.amount > 0).length;
  const contractsCount = contracts.length;
  const distributeSubTaskRemainder = () => {
    const pendingZero = subTasks.filter((s) => s.amount === 0);
    if (pendingZero.length === 0) return;
    const remaining = Math.max(0, lineExtended - subTasksTotal);
    if (remaining <= 0) return;
    const share = Math.round(remaining / pendingZero.length);
    onUpdate(line.id, {
      subTasks: subTasks.map((s) => (s.amount === 0 ? { ...s, amount: share } : s)),
    });
  };

  return (
    <div
      className="relative border-b border-slate-200 bg-gradient-to-b from-slate-50/90 via-white to-slate-50/80 px-6 py-5 dark:border-slate-800 dark:from-slate-900/70 dark:via-slate-950 dark:to-slate-900/50"
      style={{ gridColumn: '1 / -1' }}
    >
      {/* COREVIA signature edge — indigo → violet → amber accent on top */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-indigo-500 via-violet-500 to-amber-400"
      />
      {/* Drill-down header: line identity + numbered underline tabs */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-5 items-center gap-1 rounded-md bg-gradient-to-br from-indigo-500/10 via-violet-500/10 to-amber-400/10 px-1.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">
              <span className="h-1 w-1 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500" aria-hidden />
              Line drill-down
            </span>
            <span className="truncate rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{line.wbsCode || 'WBS'}</span>
          </div>
          <h3 className="mt-1 truncate text-[14.5px] font-semibold tracking-tight text-slate-900 dark:text-white">{line.description || 'Untitled line'}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            <span className="tabular-nums">{line.quantity}</span> {line.unit} × <span className="tabular-nums">{AED(line.unitRate)}</span> · <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{AED(lineExtended)}</span> extended
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Line drill-down sections"
          className="flex shrink-0 items-stretch gap-0 border-b border-slate-200 dark:border-slate-800"
        >
          {([
            { id: 'subcosts' as DetailTab, label: 'Sub-costs', icon: ListTree, count: subCostsCount },
            { id: 'profile' as DetailTab, label: 'Annual profile', icon: LineChart, count: yearsCount },
            { id: 'contracts' as DetailTab, label: 'Contracts', icon: FileSignature, count: contractsCount },
          ]).map((t, i) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            const ordinal = String(i + 1).padStart(2, '0');
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(t.id)}
                className={`group relative flex items-center gap-2 px-3.5 pb-2.5 pt-1.5 text-[12px] font-semibold transition-colors ${
                  isActive
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <span
                  className={`font-mono text-[9.5px] font-semibold tracking-[0.18em] ${
                    isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-600'
                  }`}
                  aria-hidden
                >
                  {ordinal}
                </span>
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'}`} />
                <span>{t.label}</span>
                {t.count > 0 && (
                  <span
                    className={`ml-0.5 inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                      isActive
                        ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {t.count}
                  </span>
                )}
                {/* Active underline — signature gradient */}
                <span
                  aria-hidden
                  className={`absolute inset-x-1 bottom-[-1px] h-[2px] bg-gradient-to-r from-indigo-500 via-violet-500 to-amber-400 transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Line settings strip — secondary fields that don't belong in the
          hot scan-path of the main row (Unit + Segment). */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-slate-200 bg-white/60 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
        <div className="flex items-center gap-2">
          <label className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Unit</label>
          <Input
            value={line.unit}
            onChange={(e) => onUpdate(line.id, { unit: e.target.value })}
            disabled={readOnly}
            className="h-8 w-24 text-[12px]"
            placeholder="ea"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Segment</label>
          <Select
            value={line.segment ?? 'implementation'}
            onValueChange={(v) => onUpdate(line.id, { segment: v as CbsLineItem['segment'] })}
            disabled={readOnly}
          >
            <SelectTrigger className="h-8 w-[160px] text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="implementation">Implementation</SelectItem>
              <SelectItem value="operations">Operations</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={activeTab === 'profile' ? '' : 'hidden'}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Year breakdown — dynamic Y1-Y5 highlight for OPEX/recurring */}
        <section className="lg:col-span-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <LineChart className="h-3.5 w-3.5 text-indigo-500" />
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
                {isRecurringLine ? 'Annual spend profile · Y1–Y5' : 'Spend profile'}
              </h4>
              {isRecurringLine && (
                <span className="inline-flex items-center rounded-full border border-teal-300 bg-teal-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300">
                  OPEX
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!readOnly && isRecurringLine && yearsTotal < lineExtended && (
                <Button size="sm" variant="ghost" onClick={autoFillYears} className="h-6 px-2 text-[10px]" title="Distribute remaining line value across zero years">
                  Auto-fill
                </Button>
              )}
              {!readOnly && (
                <Button size="sm" variant="ghost" onClick={addYear} className="h-6 px-2 text-[10px]">
                  <Plus className="h-3 w-3" /> Year
                </Button>
              )}
              <span className="ml-1 text-[10.5px] tabular-nums text-slate-500 dark:text-slate-400">Total {AED(yearsTotal)}</span>
            </div>
          </div>

          {/* Coverage of the line total by populated years */}
          {isRecurringLine && lineExtended > 0 && (
            <div className="mb-2 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10.5px] dark:border-slate-700 dark:bg-slate-900">
              <span className="text-slate-500">
                Populated: <strong className="tabular-nums text-slate-700 dark:text-slate-200">{populatedYears}/5</strong>
              </span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className={`h-full transition-all ${populatedYears >= 5 ? 'bg-emerald-500' : populatedYears >= 3 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${(populatedYears / 5) * 100}%` }}
                />
              </div>
            </div>
          )}

          {displayYears.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
              No year profile recorded. Qty × Rate = {AED(lineExtended)}.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <table className="w-full text-[11.5px]">
                <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-1.5 text-left">Period</th>
                    <th className="px-3 py-1.5 text-right">Planned</th>
                    <th className="px-3 py-1.5 text-right">Share</th>
                    <th className="px-2 py-1.5 w-6" />
                  </tr>
                </thead>
                <tbody>
                  {displayYears.map((y) => {
                    const share = yearsTotal > 0 ? y.amount / yearsTotal : 0;
                    const hasValue = y.amount > 0;
                    // Row tone: populated years are emerald-tinted, the ladder
                    // skeleton rows (Y1–Y5 without a value) show a subtle
                    // amber tint so the user sees what's missing.
                    const rowTone = hasValue
                      ? 'bg-emerald-50/60 dark:bg-emerald-500/5'
                      : (y.isPadded && isRecurringLine ? 'bg-amber-50/40 dark:bg-amber-500/5' : '');
                    return (
                      <tr key={y.year} className={`border-t border-slate-100 dark:border-slate-800 ${rowTone}`}>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex h-1.5 w-1.5 rounded-full ${hasValue ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                              aria-hidden
                            />
                            <span className={`${hasValue ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                              {y.label ?? (y.year === 0 ? 'Initial' : `Year ${y.year}`)}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1 text-right">
                          <Input
                            type="number"
                            value={y.amount}
                            onChange={(e) => updateYear(y.year, Math.round(num(e.target.value)))}
                            disabled={readOnly}
                            className={`h-7 w-28 text-right tabular-nums ${hasValue ? 'font-semibold' : 'text-slate-400 placeholder:text-slate-300'}`}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className={hasValue ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}>
                              {(share * 100).toFixed(1)}%
                            </span>
                            {hasValue && (
                              <div className="h-1 w-10 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${Math.min(100, share * 100)}%` }} />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-1 py-1 text-right">
                          {!readOnly && !(isRecurringLine && y.year >= 1 && y.year <= 5) && (
                            <Button size="icon" variant="ghost" className="h-5 w-5 text-slate-300 hover:text-rose-500" onClick={() => removeYear(y.year)} aria-label="Remove year">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <td className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Total</td>
                    <td className="px-3 py-1.5 text-right text-[11.5px] font-bold tabular-nums text-slate-900 dark:text-white">{AED(yearsTotal)}</td>
                    <td className="px-3 py-1.5 text-right text-[10.5px] text-slate-500 dark:text-slate-400">100%</td>
                    <td className="px-1 py-1.5" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
      </div>

      <div className={activeTab === 'contracts' ? '' : 'hidden'}>
      <div className="grid grid-cols-1 gap-4">
        {/* Contracts */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <FileSignature className="h-3.5 w-3.5 text-violet-500" />
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">Contracts funding this line</h4>
              {contracts.length > 0 && (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[9.5px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {contracts.length}
                </span>
              )}
            </div>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={addContract} disabled={readOnly}>
              <Plus className="h-3 w-3" /> Add contract
            </Button>
          </div>

          {/* Coverage bar */}
          {yearsTotal > 0 && (
            <div className="mb-2 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-1 flex items-center justify-between text-[10.5px] text-slate-600 dark:text-slate-300">
                <span>Contract coverage of planned spend</span>
                <span className="tabular-nums font-semibold">{AED(contractsTotal)} / {AED(yearsTotal)} · {(coveragePct * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className={`h-full transition-all ${coveragePct >= 0.95 ? 'bg-emerald-500' : coveragePct >= 0.6 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${Math.min(100, coveragePct * 100)}%` }}
                />
              </div>
              {Math.abs(coverageGap) > 1 && (
                <div className={`mt-1.5 text-[10.5px] ${coverageGap > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {coverageGap > 0
                    ? `Uncovered: ${AED(coverageGap)} — attach contracts to close the gap`
                    : `Over-contracted: ${AED(-coverageGap)} — review contract terms against plan`}
                </div>
              )}
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <table className="w-full text-[11.5px]">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-2 py-1.5 text-left">Vendor</th>
                  <th className="px-2 py-1.5 text-left">Ref</th>
                  <th className="px-2 py-1.5 text-left">Start</th>
                  <th className="px-2 py-1.5 text-left">End</th>
                  <th className="px-2 py-1.5 text-left">Due</th>
                  <th className="px-2 py-1.5 text-right">Annual (AED)</th>
                  <th className="px-2 py-1.5 text-left">Status</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {contracts.length === 0 ? (
                  <tr className="border-t border-slate-100 dark:border-slate-800">
                    <td colSpan={8} className="p-0">
                      <div className="m-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/40">
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                            <FileSignature className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-[11.5px] font-semibold text-slate-800 dark:text-slate-100">
                              No contracts attached yet
                            </div>
                            <div className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                              Add the support SLA, licence renewal, or hosting agreement that funds this operational stream.
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : contracts.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 align-top dark:border-slate-800">
                    <td className="px-2 py-1"><Input value={c.vendor} onChange={(e) => updateContract(c.id, { vendor: e.target.value })} disabled={readOnly} className="h-7 text-[11px]" placeholder="Vendor name" /></td>
                    <td className="px-2 py-1"><Input value={c.reference ?? ''} onChange={(e) => updateContract(c.id, { reference: e.target.value })} disabled={readOnly} className="h-7 w-24 text-[11px] font-mono uppercase" placeholder="CTR-###" /></td>
                    <td className="px-2 py-1"><Input type="date" value={c.startDate ?? ''} onChange={(e) => updateContract(c.id, { startDate: e.target.value })} disabled={readOnly} className="h-7 w-32 text-[11px]" /></td>
                    <td className="px-2 py-1"><Input type="date" value={c.endDate ?? ''} onChange={(e) => updateContract(c.id, { endDate: e.target.value })} disabled={readOnly} className="h-7 w-32 text-[11px]" /></td>
                    <td className="px-2 py-1"><Input type="date" value={c.dueDate ?? ''} onChange={(e) => updateContract(c.id, { dueDate: e.target.value })} disabled={readOnly} className="h-7 w-32 text-[11px]" /></td>
                    <td className="px-2 py-1 text-right"><Input type="number" value={c.annualValue} onChange={(e) => updateContract(c.id, { annualValue: num(e.target.value) })} disabled={readOnly} className="h-7 w-28 text-right text-[11px] tabular-nums" /></td>
                    <td className="px-2 py-1">
                      <Select value={c.status} onValueChange={(v) => updateContract(c.id, { status: v as BcLineContract['status'] })} disabled={readOnly}>
                        <SelectTrigger className="h-7 w-[96px] text-[10.5px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="renewal">Renewal</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                          <SelectItem value="terminated">Terminated</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-1 py-1 text-right">
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-rose-600" onClick={() => removeContract(c.id)} disabled={readOnly} aria-label="Remove contract">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      </div>

      <div className={activeTab === 'subcosts' ? '' : 'hidden'}>
      {/* Sub-costs — same mental model as CBS "Add line": one button at the
          top, single editable table, type → Tab → done. No empty-state
          card, no duplicate footer button. */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
              <ListTree className="h-4 w-4" />
            </span>
            <div>
              <h4 className="text-[13px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">Sub-costs</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Decompose this line into discrete pricable activities
                {subTasks.length > 0 && (
                  <> · <span className="font-semibold text-slate-700 dark:text-slate-200">{subTasks.length}</span> item{subTasks.length === 1 ? '' : 's'}</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {!readOnly && subTasks.length > 0 && subTasksTotal < lineExtended && (
              <Button size="sm" variant="ghost" onClick={distributeSubTaskRemainder} className="h-8 px-2.5 text-[11.5px]" title="Distribute remaining line value across zero-valued sub-costs">
                Distribute remainder
              </Button>
            )}
            <Button size="sm" onClick={addSubTask} disabled={readOnly} className="h-8 gap-1.5 px-3 text-[12px]" data-testid="cbs-subcost-add">
              <Plus className="h-3.5 w-3.5" /> Add sub-cost
            </Button>
          </div>
        </div>

        {subTasks.length > 0 && lineExtended > 0 && (
          <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/40">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
              <span>Reconciliation to line total</span>
              <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-100">{AED(subTasksTotal)} / {AED(lineExtended)} · {(subTasksReconcilePct * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className={`h-full transition-all ${subTasksReconcilePct >= 0.98 && subTasksReconcilePct <= 1.02 ? 'bg-emerald-500' : subTasksReconcilePct >= 0.6 ? 'bg-amber-500' : 'bg-sky-500'}`}
                style={{ width: `${Math.min(100, subTasksReconcilePct * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full text-[12.5px]">
            <thead className="bg-slate-50 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2.5 text-left" style={{ width: '40%' }}>Activity</th>
                <th className="px-3 py-2.5 text-left" style={{ width: '22%' }}>Owner</th>
                <th className="px-3 py-2.5 text-right" style={{ width: '18%' }}>Amount (AED)</th>
                <th className="px-3 py-2.5 text-left" style={{ width: '16%' }}>Status</th>
                <th className="px-2 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody>
              {subTasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-5 text-center text-[12px] text-slate-500 dark:text-slate-400">
                    No sub-costs yet. Click <span className="font-semibold text-slate-700 dark:text-slate-200">Add sub-cost</span> to break this line into activities.
                  </td>
                </tr>
              )}
              {subTasks.map((st) => {
                const isNew = st.id === justAddedSubTaskId;
                const share = lineExtended > 0 ? (st.amount || 0) / lineExtended : 0;
                return (
                <tr
                  key={st.id}
                  className={`border-t border-slate-100 transition-colors dark:border-slate-800 ${
                    isNew ? 'bg-indigo-50/70 dark:bg-indigo-500/10' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <td className="px-3 py-2">
                    <Input
                      ref={(el) => { subTaskDescRefs.current.set(st.id, el); }}
                      value={st.description}
                      onChange={(e) => updateSubTask(st.id, { description: e.target.value })}
                      onKeyDown={handleSubTaskKeyDown(st)}
                      disabled={readOnly}
                      className="h-9 text-[12.5px]"
                      placeholder="e.g. Licence subscription"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={st.owner ?? ''}
                      onChange={(e) => updateSubTask(st.id, { owner: e.target.value })}
                      disabled={readOnly}
                      className="h-9 text-[12.5px]"
                      placeholder="Owner"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col items-end gap-0.5">
                      <Input
                        type="number"
                        value={st.amount}
                        onChange={(e) => updateSubTask(st.id, { amount: Math.round(num(e.target.value)) })}
                        onKeyDown={handleSubTaskKeyDown(st)}
                        disabled={readOnly}
                        className="h-9 w-full text-right text-[12.5px] tabular-nums"
                      />
                      {lineExtended > 0 && (
                        <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">{(share * 100).toFixed(1)}% of line</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Select value={st.status ?? 'pending'} onValueChange={(v) => updateSubTask(st.id, { status: v as CbsLineSubTask['status'] })} disabled={readOnly}>
                      <SelectTrigger className="h-9 w-full text-[11.5px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2 text-right">
                    {!readOnly && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-300 hover:text-rose-500" onClick={() => removeSubTask(st.id)} aria-label="Remove sub-cost">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
            {subTasks.length > 0 && (
              <tfoot className="bg-slate-50/80 dark:bg-slate-800/50">
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Sub-costs total</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right text-[12.5px] font-bold tabular-nums text-slate-900 dark:text-white">{AED(subTasksTotal)}</td>
                  <td className="px-3 py-2 text-[10.5px] text-slate-500 dark:text-slate-400">
                    {lineExtended > 0 && (
                      <span>{((subTasksTotal / lineExtended) * 100).toFixed(0)}% of line</span>
                    )}
                  </td>
                  <td className="px-2 py-2" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
      </div>
    </div>
  );
}

// Years of coverage between contract start and end dates, capped at a
// reasonable horizon so open-ended contracts don't inflate coverage math.
function yearsOfCoverage(c: BcLineContract): number {
  if (!c.startDate || !c.endDate) return 1;
  const s = new Date(c.startDate);
  const e = new Date(c.endDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 1;
  const years = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.max(0.25, Math.min(10, years));
}

function BaselineView({
  plan,
  baselineTotals,
  bac,
  bacResolution,
  businessCase,
  onUpdate,
  onAdd,
  onRemove,
  onAllocateToBac,
  readOnly,
  segmentScope,
}: {
  plan: CostPlanState;
  baselineTotals: { base: number; contingencyLineReserve: number; capex: number; opex: number; contingencyPool: number; managementPool: number };
  bac: number;
  bacResolution: BacResolution;
  businessCase?: BusinessCaseData | null;
  onUpdate: (id: string, patch: Partial<CbsLineItem>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onAllocateToBac: () => void;
  readOnly?: boolean;
  /**
   * Constrains the view to a specific slice of the CBS:
   *   - 'project'     \u2192 implementation segment only (WBS / project-phase costs)
   *   - 'operations'  \u2192 operations + maintenance segments (annual OPEX envelope)
   * When omitted, the view shows the full CBS (legacy behaviour).
   */
  segmentScope?: 'project' | 'operations';
}) {
  // Apply the sub-tab scope before any filtering / totals \u2014 so counts, totals
  // and the filter dropdown all reflect the active lens.
  const scopedCbs = plan.cbs.filter((l) => {
    if (!segmentScope) return true;
    const seg = l.segment ?? 'implementation';
    if (segmentScope === 'project') return seg === 'implementation';
    return seg === 'operations' || seg === 'maintenance';
  });

  type FilterValue = 'all' | 'CAPEX' | 'OPEX' | 'implementation' | 'operations' | 'maintenance' | 'labor' | 'material' | 'equipment' | 'subcontractor' | 'overhead' | 'other';
  const [filter, setFilter] = useState<FilterValue>('all');
  const [expandedLines, setExpandedLines] = useState<Set<string>>(() => new Set());
  const toggleExpanded = (id: string) => {
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const filtered = scopedCbs.filter((l) => {
    if (filter === 'all') return true;
    if (filter === 'CAPEX' || filter === 'OPEX') return l.costClass === filter;
    if (filter === 'implementation' || filter === 'operations' || filter === 'maintenance') {
      return (l.segment ?? 'implementation') === filter;
    }
    return l.category === filter;
  });
  const totalExtended = filtered.reduce((s, l) => s + lineExtended(l).withContingency, 0);
  const reconciliation = bac - baselineTotals.base - baselineTotals.contingencyLineReserve;
  const reconciliationPct = bac > 0 ? Math.abs(reconciliation) / bac : 0;
  const inTolerance = bac > 0 && reconciliationPct <= 0.005; // within 0.5%

  // Segment totals \u2014 used for BC alignment banner and segment subtotal strip.
  // Always computed from the *full* plan so the reconciliation story stays
  // honest regardless of which sub-tab is active.
  const segmentTotals = { implementation: 0, operations: 0, maintenance: 0, other: 0 };
  for (const l of plan.cbs) {
    const seg = (l.segment ?? 'implementation') as keyof typeof segmentTotals;
    segmentTotals[seg] += lineExtended(l).withContingency;
  }
  const bcSegments = resolveBusinessCaseSegments(businessCase);

  // The title, allocate-BAC affordance and BC alignment banner only make sense
  // on the combined / project-phase views \u2014 the operational tab is about the
  // annual run envelope, not the BAC baseline.
  const showBacBanner = segmentScope !== 'operations';
  const title =
    segmentScope === 'project'
      ? 'Project Phase Breakdown'
      : segmentScope === 'operations'
        ? 'Operational Costs Breakdown'
        : 'Cost Breakdown Structure (CBS)';

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeading
          icon={Layers}
          title={title}
          subtitle={
            segmentScope === 'project'
              ? '100% aligned with the Implementation Plan from the business case and WBS.'
              : segmentScope === 'operations'
                ? 'Annual operations & maintenance envelope \u2014 OPEX run / support costs.'
                : undefined
          }
        >
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterValue)}>
            <SelectTrigger className="h-9 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All lines</SelectItem>
              {!segmentScope && (
                <>
                  <SelectItem value="implementation">Segment \u2014 Implementation</SelectItem>
                  <SelectItem value="operations">Segment \u2014 Operations</SelectItem>
                  <SelectItem value="maintenance">Segment \u2014 Maintenance</SelectItem>
                </>
              )}
              {segmentScope === 'operations' && (
                <>
                  <SelectItem value="operations">Segment \u2014 Operations</SelectItem>
                  <SelectItem value="maintenance">Segment \u2014 Maintenance</SelectItem>
                </>
              )}
              <SelectItem value="CAPEX">CAPEX only</SelectItem>
              <SelectItem value="OPEX">OPEX only</SelectItem>
              <SelectItem value="labor">Labor</SelectItem>
              <SelectItem value="subcontractor">Subcontractor</SelectItem>
              <SelectItem value="material">Material</SelectItem>
              <SelectItem value="equipment">Equipment</SelectItem>
              <SelectItem value="overhead">Overhead</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          {segmentScope !== 'operations' && (
            <Button size="sm" variant="outline" onClick={onAllocateToBac} disabled={readOnly || bac <= 0} className="gap-1.5" data-testid="cbs-allocate">
              <Scale className="h-3.5 w-3.5" /> Allocate BAC
            </Button>
          )}
          <Button size="sm" onClick={onAdd} disabled={readOnly} data-testid="cbs-add">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add line
          </Button>
        </SectionHeading>
      </CardHeader>
      <CardContent className="p-0">
        {showBacBanner && (
          <BacReconciliationBanner resolution={bacResolution} bac={bac} baselineTotal={baselineTotals.base + baselineTotals.contingencyLineReserve} reconciliation={reconciliation} inTolerance={inTolerance} onAllocate={onAllocateToBac} readOnly={readOnly} />
        )}
        {bcSegments.present && !segmentScope && (
          <BusinessCaseAlignmentBanner segmentTotals={segmentTotals} bcSegments={bcSegments} />
        )}
        <ScrollArea className="h-[min(62vh,760px)] w-full">
          <div className="min-w-[1120px]">
            {/* Grid cols: WBS · Description · Category · Qty · Rate · Mk% · Ct% · Class · Total · delete. All pricing fields edit inline — the drill-down surfaces sub-costs, annual profile, contracts & segment. */}
            <div className="sticky top-0 z-10 grid grid-cols-[88px_minmax(220px,1.25fr)_130px_70px_116px_62px_62px_86px_132px_36px] border-b border-slate-200 bg-slate-50 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-400">
              <div className="px-2.5 py-3">WBS</div>
              <div className="px-2.5 py-3">Line description</div>
              <div className="px-2.5 py-3">Category</div>
              <div className="px-2.5 py-3 text-right">Qty</div>
              <div className="px-2.5 py-3 text-right">Rate (AED)</div>
              <div className="px-2.5 py-3 text-right">Mk %</div>
              <div className="px-2.5 py-3 text-right">Ct %</div>
              <div className="px-2.5 py-3 text-center">Class</div>
              <div className="px-2.5 py-3 text-right">Total (AED)</div>
              <div className="px-2.5 py-3" />
            </div>
            {filtered.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                No lines match the current filter.
              </div>
            )}
            {filtered.map((line) => {
              const ext = lineExtended(line);
              const categoryTone: Record<CbsLineItem['category'], string> = {
                labor: 'bg-sky-500',
                subcontractor: 'bg-violet-500',
                material: 'bg-amber-500',
                equipment: 'bg-emerald-500',
                overhead: 'bg-slate-400',
                other: 'bg-slate-300',
              };
              const hasYearBreakdown = Array.isArray(line.yearBreakdown) && line.yearBreakdown.length > 0;
              // Every CBS line can be drilled down to attach sub-costs,
              // contracts, and an annual spend profile — not just BC-anchored
              // or recurring ones. Manually added lines must also let users
              // add sub-cost breakdowns, so expand is always available.
              const canExpand = true;
              const isExpanded = expandedLines.has(line.id);
              return (
                <React.Fragment key={line.id}>
                <div
                  className={`group grid grid-cols-[88px_minmax(220px,1.25fr)_130px_70px_116px_62px_62px_86px_132px_36px] items-center border-b border-slate-100 bg-white text-sm transition-colors dark:border-slate-800 dark:bg-slate-900 ${
                    isExpanded
                      ? 'bg-indigo-50/40 hover:bg-indigo-50/60 dark:bg-indigo-500/5 dark:hover:bg-indigo-500/10'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {/* WBS */}
                  <div className="px-2 py-2">
                    <Input
                      value={line.wbsCode}
                      onChange={(e) => onUpdate(line.id, { wbsCode: e.target.value })}
                      disabled={readOnly}
                      className="h-9 font-mono text-[11.5px] uppercase"
                    />
                  </div>
                  {/* Description + drill-down chevron + metadata row */}
                  <div className="flex items-center gap-2 px-2 py-2">
                    {canExpand ? (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(line.id)}
                        className={`group/chevron relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-all ${
                          isExpanded
                            ? 'border-indigo-400 bg-indigo-600 text-white shadow-sm dark:border-indigo-400 dark:bg-indigo-500'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300'
                        }`}
                        title={isExpanded ? 'Collapse details' : 'Open sub-costs, annual profile & contracts'}
                        aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                        aria-expanded={isExpanded}
                      >
                        <ChevronRight
                          className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
                        />
                        {(hasYearBreakdown || (Array.isArray(line.contracts) && line.contracts.length > 0) || (Array.isArray(line.subTasks) && line.subTasks.length > 0)) && !isExpanded && (
                          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" aria-hidden />
                        )}
                      </button>
                    ) : (
                      <span className="h-8 w-8 shrink-0" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <Input
                        value={line.description}
                        onChange={(e) => onUpdate(line.id, { description: e.target.value })}
                        disabled={readOnly}
                        className="h-9 text-[13px] font-medium"
                        placeholder="Describe this cost line"
                      />
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${categoryTone[line.category]}`} aria-hidden />
                        <span className="text-[10.5px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {line.segment ?? 'implementation'}
                        </span>
                        <span className="text-[10px] text-slate-300 dark:text-slate-600">·</span>
                        <span className="text-[10.5px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {line.quantity} {line.unit || 'ea'}
                        </span>
                        {line.source === 'business-case' && (
                          <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300" title="Anchored to business case">
                            BC
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Category */}
                  <div className="px-2 py-2">
                    <Select
                      value={line.category}
                      onValueChange={(v) => onUpdate(line.id, { category: v as CbsLineItem['category'] })}
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="labor">Labor</SelectItem>
                        <SelectItem value="subcontractor">Subcontractor</SelectItem>
                        <SelectItem value="material">Material</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="overhead">Overhead</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Qty */}
                  <div className="px-1.5 py-2">
                    <Input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => onUpdate(line.id, { quantity: num(e.target.value) })}
                      disabled={readOnly}
                      className="h-9 text-right text-[12.5px] tabular-nums"
                      title={`Unit: ${line.unit || 'ea'}`}
                    />
                  </div>
                  {/* Rate (AED) */}
                  <div className="px-1.5 py-2">
                    <Input
                      type="number"
                      value={line.unitRate}
                      onChange={(e) => onUpdate(line.id, { unitRate: num(e.target.value) })}
                      disabled={readOnly}
                      className="h-9 text-right text-[12.5px] tabular-nums"
                    />
                  </div>
                  {/* Markup % */}
                  <div className="px-1 py-2">
                    <Input
                      type="number"
                      value={line.markupPct ?? 0}
                      onChange={(e) => onUpdate(line.id, { markupPct: num(e.target.value) })}
                      disabled={readOnly}
                      className="h-9 text-right text-[12px] tabular-nums"
                      placeholder="0"
                      title="Markup % applied to base (qty × rate)"
                    />
                  </div>
                  {/* Contingency % */}
                  <div className="px-1 py-2">
                    <Input
                      type="number"
                      value={line.contingencyPct ?? 0}
                      onChange={(e) => onUpdate(line.id, { contingencyPct: num(e.target.value) })}
                      disabled={readOnly}
                      className="h-9 text-right text-[12px] tabular-nums"
                      placeholder="0"
                      title="Contingency % applied after markup"
                    />
                  </div>
                  {/* Class toggle */}
                  <div className="flex items-center justify-center px-2 py-2">
                    <button
                      type="button"
                      onClick={() => !readOnly && onUpdate(line.id, { costClass: line.costClass === 'CAPEX' ? 'OPEX' : 'CAPEX' })}
                      disabled={readOnly}
                      className={`w-full rounded-md border px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] transition-colors ${
                        line.costClass === 'CAPEX'
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300'
                          : 'border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      title="Click to toggle CAPEX / OPEX"
                    >
                      {line.costClass}
                    </button>
                  </div>
                  {/* Total */}
                  <div className="px-2 py-2 text-right">
                    <div className="text-[14px] font-bold tabular-nums text-slate-900 dark:text-white">
                      {AED(ext.withContingency)}
                    </div>
                    {ext.withContingency !== line.quantity * line.unitRate && (
                      <div className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                        base {AED(line.quantity * line.unitRate)}
                      </div>
                    )}
                  </div>
                  {/* Delete */}
                  <div className="flex items-center justify-center px-1 py-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-slate-400 hover:text-rose-600"
                      onClick={() => onRemove(line.id)}
                      disabled={readOnly}
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {isExpanded && (
                  <CbsLineDetailPanel
                    line={line}
                    readOnly={readOnly}
                    onUpdate={onUpdate}
                  />
                )}
                </React.Fragment>
              );
            })}
            {filtered.length > 0 && (
              <div className="sticky bottom-0 z-10 grid grid-cols-[88px_minmax(220px,1.25fr)_130px_70px_116px_62px_62px_86px_132px_36px] items-center border-t-2 border-slate-300 bg-slate-50 text-[11.5px] font-semibold dark:border-slate-700 dark:bg-slate-800/80">
                <div className="px-2.5 py-2.5 uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Total</div>
                <div className="px-2.5 py-2.5 text-slate-600 dark:text-slate-300">{filtered.length} line{filtered.length === 1 ? '' : 's'}</div>
                <div className="px-2.5 py-2.5" />
                <div className="px-2.5 py-2.5" />
                <div className="px-2.5 py-2.5" />
                <div className="px-2.5 py-2.5" />
                <div className="px-2.5 py-2.5" />
                <div className="px-2.5 py-2.5" />
                <div className="px-2.5 py-2.5 text-right text-[13px] font-bold tabular-nums text-slate-900 dark:text-white">
                  {AED(totalExtended)}
                </div>
                <div className="px-2.5 py-2.5" />
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── CBS Shell (sub-tabs: project phase · operations · commitments) ──────

function _CbsShell({
  subTab,
  onSubTab,
  plan,
  baselineTotals,
  bac,
  bacResolution,
  businessCase,
  evm,
  onUpdate,
  onAdd,
  onRemove,
  onAllocateToBac,
  onUpdateCommit,
  onAddCommit,
  onRemoveCommit,
  readOnly,
  baselineLocked,
}: {
  subTab: CbsSubTabId;
  onSubTab: (id: CbsSubTabId) => void;
  plan: CostPlanState;
  baselineTotals: { base: number; contingencyLineReserve: number; capex: number; opex: number; contingencyPool: number; managementPool: number };
  bac: number;
  bacResolution: BacResolution;
  businessCase?: BusinessCaseData | null;
  evm: EvmMetrics;
  onUpdate: (id: string, patch: Partial<CbsLineItem>) => void;
  onAdd: (defaults?: { segment?: CbsLineItem['segment']; costClass?: CbsLineItem['costClass'] }) => void;
  onRemove: (id: string) => void;
  onAllocateToBac: () => void;
  onUpdateCommit: (id: string, patch: Partial<CommitmentEntry>) => void;
  onAddCommit: () => void;
  onRemoveCommit: (id: string) => void;
  readOnly?: boolean;
  baselineLocked?: boolean;
}) {
  // Roll-up chips on each sub-tab so the reader always sees the lens totals.
  const projectTotal = plan.cbs
    .filter((l) => (l.segment ?? 'implementation') === 'implementation')
    .reduce((s, l) => s + lineExtended(l).withContingency, 0);
  const opsTotal = plan.cbs
    .filter((l) => l.segment === 'operations' || l.segment === 'maintenance')
    .reduce((s, l) => s + lineExtended(l).withContingency, 0);
  const commitmentsTotal = plan.commitments.reduce((s, c) => s + c.awardedValue, 0);
  const grandTotal = Math.max(1, projectTotal + opsTotal + commitmentsTotal);
  const badgeFor = (id: CbsSubTabId) => {
    if (id === 'project') return AED(projectTotal);
    if (id === 'operations') return AED(opsTotal);
    return AED(commitmentsTotal);
  };
  const rawTotalFor = (id: CbsSubTabId) => {
    if (id === 'project') return projectTotal;
    if (id === 'operations') return opsTotal;
    return commitmentsTotal;
  };

  return (
    <div className="space-y-3 animate-in fade-in-50 slide-in-from-bottom-2 duration-200">
      {/* ─── CBS Segment Strip ────────────────────────────────────────────
          One compact toolbar. Three segments shown as inline data cells
          (label + total + share), separated by hairline dividers. Active
          segment gets a 2px top border in its palette. A stacked
          proportions bar underneath gives instant "budget mix" read.
          No cards, no dark chrome, no competing surfaces — the table
          below is the hero. */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <nav
          role="tablist"
          aria-label="CBS breakdown sections"
          className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-800"
        >
          {CBS_SUBTABS.map((t) => {
            const active = subTab === t.id;
            const total = badgeFor(t.id);
            const raw = rawTotalFor(t.id);
            const share = Math.round((raw / grandTotal) * 100);
            const palette =
              t.id === 'project'
                ? { dot: 'bg-sky-500', top: 'bg-sky-500', tint: 'bg-sky-50/40 dark:bg-sky-500/[0.06]', label: 'text-sky-700 dark:text-sky-300' }
                : t.id === 'operations'
                ? { dot: 'bg-emerald-500', top: 'bg-emerald-500', tint: 'bg-emerald-50/40 dark:bg-emerald-500/[0.06]', label: 'text-emerald-700 dark:text-emerald-300' }
                : { dot: 'bg-violet-500', top: 'bg-violet-500', tint: 'bg-violet-50/40 dark:bg-violet-500/[0.06]', label: 'text-violet-700 dark:text-violet-300' };
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => onSubTab(t.id)}
                className={`group relative flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                  active ? palette.tint : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                }`}
                data-testid={`cbs-subtab-${t.id}`}
                title={t.hint}
              >
                <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${palette.dot}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-[10.5px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                      active ? palette.label : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {t.label}
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span
                      className={`text-[15px] font-semibold tabular-nums tracking-tight ${
                        active ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {total}
                    </span>
                    <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">{share}%</span>
                  </div>
                </div>
                <span
                  aria-hidden
                  className={`absolute inset-x-0 top-0 h-[2px] transition-opacity ${palette.top} ${active ? 'opacity-100' : 'opacity-0'}`}
                />
              </button>
            );
          })}
        </nav>
        {/* Stacked proportions bar — instant budget mix */}
        <div
          className="flex h-1 w-full"
          role="img"
          aria-label={`Budget mix: Project ${Math.round((projectTotal / grandTotal) * 100)}%, Operations ${Math.round((opsTotal / grandTotal) * 100)}%, Commitments ${Math.round((commitmentsTotal / grandTotal) * 100)}%`}
        >
          <div className="bg-sky-500 transition-all" style={{ width: `${(projectTotal / grandTotal) * 100}%` }} />
          <div className="bg-emerald-500 transition-all" style={{ width: `${(opsTotal / grandTotal) * 100}%` }} />
          <div className="bg-violet-500 transition-all" style={{ width: `${(commitmentsTotal / grandTotal) * 100}%` }} />
        </div>
      </div>

      {subTab === 'project' && (
        <BaselineView
          plan={plan}
          baselineTotals={baselineTotals}
          bac={bac}
          bacResolution={bacResolution}
          businessCase={businessCase}
          onUpdate={onUpdate}
          onAdd={() => onAdd({ segment: 'implementation', costClass: 'CAPEX' })}
          onRemove={onRemove}
          onAllocateToBac={onAllocateToBac}
          readOnly={readOnly || baselineLocked}
          segmentScope="project"
        />
      )}

      {subTab === 'operations' && (
        <BaselineView
          plan={plan}
          baselineTotals={baselineTotals}
          bac={bac}
          bacResolution={bacResolution}
          businessCase={businessCase}
          onUpdate={onUpdate}
          onAdd={() => onAdd({ segment: 'operations', costClass: 'OPEX' })}
          onRemove={onRemove}
          onAllocateToBac={onAllocateToBac}
          readOnly={readOnly || baselineLocked}
          segmentScope="operations"
        />
      )}

      {subTab === 'commitments' && (
        <CommitmentsView
          plan={plan}
          evm={evm}
          onUpdate={onUpdateCommit}
          onAdd={onAddCommit}
          onRemove={onRemoveCommit}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}

// ─── Rate Card ─────────────────────────────────────────────────────────────

function _RateCardView({
  plan,
  onUpdate,
  onAdd,
  onRemove,
  readOnly,
}: {
  plan: CostPlanState;
  onUpdate: (id: string, patch: Partial<RateCardEntry>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  readOnly?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeading
          icon={Scale}
          title="Rate Card"
          subtitle="Canonical unit rates used across estimating, procurement and re-forecasting. Apply burden % to align with fully loaded rates."
        >
          <Button size="sm" onClick={onAdd} disabled={readOnly}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add rate
          </Button>
        </SectionHeading>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[min(58vh,720px)] w-full">
          <div className="min-w-[880px]">
            <div className="grid grid-cols-[130px_100px_minmax(220px,1.4fr)_110px_110px_110px_minmax(160px,1fr)_44px] border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <div className="px-3 py-2.5">Category</div>
              <div className="px-3 py-2.5">Code</div>
              <div className="px-3 py-2.5">Name</div>
              <div className="px-3 py-2.5">Unit</div>
              <div className="px-3 py-2.5 text-right">Rate</div>
              <div className="px-3 py-2.5 text-right">Burden %</div>
              <div className="px-3 py-2.5">Notes</div>
              <div className="px-3 py-2.5" />
            </div>
            {plan.rateCard.map((r) => {
              const loaded = r.rate * (1 + (r.burdenPct || 0) / 100);
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[130px_100px_minmax(220px,1.4fr)_110px_110px_110px_minmax(160px,1fr)_44px] items-center border-b border-slate-100 bg-white text-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="px-2 py-1.5">
                    <Select
                      value={r.category}
                      onValueChange={(v) => onUpdate(r.id, { category: v as RateCardEntry['category'] })}
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="labor">Labor</SelectItem>
                        <SelectItem value="subcontractor">Subcontractor</SelectItem>
                        <SelectItem value="material">Material</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="overhead">Overhead</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="px-2 py-1.5">
                    <Input value={r.code} onChange={(e) => onUpdate(r.id, { code: e.target.value })} disabled={readOnly} className="h-8 font-mono text-[11px] uppercase" />
                  </div>
                  <div className="px-2 py-1.5">
                    <Input value={r.name} onChange={(e) => onUpdate(r.id, { name: e.target.value })} disabled={readOnly} className="h-8" />
                  </div>
                  <div className="px-2 py-1.5">
                    <Input value={r.unit} onChange={(e) => onUpdate(r.id, { unit: e.target.value })} disabled={readOnly} className="h-8 text-xs" />
                  </div>
                  <div className="px-2 py-1.5">
                    <Input
                      type="number"
                      value={r.rate}
                      onChange={(e) => onUpdate(r.id, { rate: num(e.target.value) })}
                      disabled={readOnly}
                      className="h-8 text-right tabular-nums"
                    />
                    <div className="mt-0.5 text-right text-[10px] text-slate-400">loaded {AED(loaded)}</div>
                  </div>
                  <div className="px-2 py-1.5">
                    <Input
                      type="number"
                      value={r.burdenPct ?? 0}
                      onChange={(e) => onUpdate(r.id, { burdenPct: num(e.target.value) })}
                      disabled={readOnly}
                      className="h-8 text-right tabular-nums"
                    />
                  </div>
                  <div className="px-2 py-1.5">
                    <Input
                      value={r.notes ?? ''}
                      onChange={(e) => onUpdate(r.id, { notes: e.target.value })}
                      disabled={readOnly}
                      placeholder="Applicability, source, valid-through…"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="px-2 py-1.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-slate-400 hover:text-rose-600"
                      onClick={() => onRemove(r.id)}
                      disabled={readOnly}
                      aria-label="Remove rate"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Cashflow ──────────────────────────────────────────────────────────────

function _CashflowView({
  phasing,
  phasingWithBc,
  evm,
  tasks,
  plan,
  businessCase,
  project,
}: {
  phasing: ReturnType<typeof computePhasing>;
  phasingWithBc: {
    rows: Array<ReturnType<typeof computePhasing>[number] & { bcPlanned: number; bcCumulative: number }>;
    annualReconciliation: Array<{ fy: number; label: string; capex: number; opex: number; total: number; benefits: number; cbs: number }>;
    hasBcAnnual: boolean;
  };
  evm: EvmMetrics;
  tasks: WbsTaskData[];
  plan: CostPlanState;
  businessCase?: BusinessCaseData | null;
  project?: ProjectData;
}) {
  // Build Delivery Payment Schedule — one row per payment event (deliverable acceptance + commitment retention release)
  interface PaymentEvent {
    id: string;
    date: string; // ISO
    label: string;
    type: 'deliverable' | 'milestone' | 'retention';
    ref?: string;
    amount: number;
  }
  // Payment amount for a delivery task is derived from the CBS — never from an arbitrary
  // plannedCost on the roll-up task itself. This keeps cost as a single source of truth:
  //   \u2022 Deliverable (roll-up parent): amount = \u03a3 CBS lines whose wbsCode is under the
  //     deliverable's branch (exact match or startsWith `${code}.`), using extended value
  //     (qty \u00d7 unit rate \u00d7 markup \u00d7 contingency).
  //   \u2022 Milestone (gate): amount = its own CBS line if present (fixed-fee gate), else
  //     the task's plannedCost if explicitly set, else 0. Milestones without a fee do not
  //     trigger a payment event.
  const cbsByCode = new Map<string, number>();
  for (const l of plan.cbs) {
    if (!l.wbsCode) continue;
    const ext = lineExtended(l).withContingency;
    cbsByCode.set(l.wbsCode, (cbsByCode.get(l.wbsCode) ?? 0) + ext);
  }
  const rollupForCode = (code: string): number => {
    if (!code) return 0;
    const root = code.endsWith('.0') ? code.slice(0, -2) : code;
    const prefix = `${root}.`;
    let sum = 0;
    for (const [c, v] of cbsByCode) {
      if (c === code || c.startsWith(prefix)) sum += v;
    }
    return sum;
  };

  const paymentEvents: PaymentEvent[] = [];
  for (const t of tasks) {
    const isDelivery = t.taskType === 'milestone' || t.taskType === 'deliverable' || t.isMilestone === true;
    if (!isDelivery) continue;
    if (!t.plannedEndDate) continue;
    const code = (t.wbsCode ?? '').trim();
    const rollup = rollupForCode(code);
    const fixed = num(t.plannedCost);
    // Deliverables use CBS rollup (falls back to their own plannedCost only when CBS is empty).
    // Milestones use their own CBS line / plannedCost first; if neither, skip (pure gate).
    const isMilestone = t.taskType === 'milestone' || t.isMilestone === true;
    const amount = isMilestone
      ? (cbsByCode.get(code) ?? fixed)
      : (rollup > 0 ? rollup : fixed);
    if (amount <= 0) continue;
    paymentEvents.push({
      id: `t-${t.id}`,
      date: t.plannedEndDate,
      label: t.taskName || t.title || (isMilestone ? 'Milestone' : 'Deliverable'),
      type: isMilestone ? 'milestone' : 'deliverable',
      ref: t.wbsCode,
      amount: Math.round(amount),
    });
  }
  for (const c of plan.commitments) {
    const retentionPct = Math.max(0, Math.min(100, num(c.retentionPct))) / 100;
    const retention = c.awardedValue * retentionPct;
    if (retention <= 0 || !c.endDate) continue;
    paymentEvents.push({
      id: `c-${c.id}`,
      date: c.endDate,
      label: `Retention release · ${c.vendor || c.ref}`,
      type: 'retention',
      ref: c.ref,
      amount: retention,
    });
  }
  paymentEvents.sort((a, b) => (a.date < b.date ? -1 : 1));
  const totalDeliveryPayments = paymentEvents.reduce((s, e) => s + e.amount, 0);

  // Reconciliation uses the parent-computed overlay (single source of truth).
  const hasBcAnnual = phasingWithBc.hasBcAnnual;
  const bcAnnualRows = phasingWithBc.annualReconciliation;
  void businessCase; void project;

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeading
          icon={LineChart}
          title="Cashflow & Phasing"
          subtitle="Delivery-payment-right phasing: milestones & deliverables book at acceptance date; effort spreads across the work span; vendor retention releases at close-out."
        />
      </CardHeader>
      <CardContent>
        {phasing.length === 0 ? (
          <EmptyState icon={LineChart} title="No cashflow yet" hint="Enter planned start/end dates and planned cost on WBS tasks to see the monthly profile." />
        ) : (
          <>
            {/* Delivery Payment Schedule — tables removed; payment events are
                now expressed visually as inflow bars on the Net-cashflow
                chart and as payment-trigger dots on the S-curve. Kept just
                the summary chip here as a jump-off point for Commitments. */}
            {paymentEvents.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-white px-3 py-2 dark:border-indigo-500/30 dark:from-indigo-500/10 dark:via-slate-900 dark:to-slate-900">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-300">
                  <Sparkles className="h-3 w-3" />
                  Delivery-triggered payments
                  <span className="text-[10px] font-normal normal-case tracking-normal text-indigo-600/80 dark:text-indigo-400/80">
                    · {paymentEvents.length} event{paymentEvents.length > 1 ? 's' : ''} · see Commitments tab for details
                  </span>
                </div>
                <div className="text-[13px] font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                  {AED(totalDeliveryPayments)}
                </div>
              </div>
            )}
            {/* ────────────────────────────────────────────────────────────────
             *  Executive cashflow KPI strip
             *  One-glance view of the four numbers a sponsor / CFO actually asks
             *  about: total commitment, peak monthly outflow, cumulative
             *  funding need (the minimum working-capital line the project must
             *  have), and actuals-to-date. Each card carries a spark-context
             *  value so the headline number is contextualized.
             *  ──────────────────────────────────────────────────────────────── */}
            {(() => {
              const totalPlanned = phasing[phasing.length - 1]?.cumulativePlanned ?? 0;
              const peakMonthlyPlanned = Math.max(0, ...phasing.map((p) => p.planned));
              const peakMonthRow = phasing.find((p) => p.planned === peakMonthlyPlanned);
              // Cumulative funding need — the lowest point on the net-cash
              // cumulative line (spend – inflows). Deliverable acceptance
              // payments show up as inflows; between them, the line goes
              // further negative. The absolute minimum is the peak funding
              // requirement.
              let netCumulative = 0;
              let peakFundingNeed = 0;
              const netSeries: Array<{ label: string; spend: number; inflow: number; cumulative: number }> = [];
              const paymentsByMonth = new Map<string, number>();
              for (const e of paymentEvents) {
                const m = e.date.substring(0, 7);
                paymentsByMonth.set(m, (paymentsByMonth.get(m) ?? 0) + e.amount);
              }
              for (const p of phasing) {
                const inflow = paymentsByMonth.get(p.month) ?? 0;
                netCumulative += inflow - p.planned;
                peakFundingNeed = Math.min(peakFundingNeed, netCumulative);
                netSeries.push({ label: p.label, spend: p.planned, inflow, cumulative: netCumulative });
              }
              const fundingRunway = Math.abs(peakFundingNeed);
              const actualToDate = evm.ac;
              const costPerformanceTone: 'good' | 'warn' | 'bad' = evm.cpi >= 1 ? 'good' : evm.cpi >= 0.9 ? 'warn' : 'bad';

              // CAPEX / OPEX monthly split derived from CBS classification.
              // Months already carry the total planned spend — we allocate it
              // in proportion to the CBS line split to get a monthly CAPEX
              // vs OPEX stacked view the CFO can read at a glance.
              const cbsCapexTotal = plan.cbs.filter((l) => l.costClass === 'CAPEX').reduce((s, l) => s + lineExtended(l).withContingency, 0);
              const cbsOpexTotal = plan.cbs.filter((l) => l.costClass === 'OPEX').reduce((s, l) => s + lineExtended(l).withContingency, 0);
              const cbsGrandTotal = cbsCapexTotal + cbsOpexTotal;
              const capexShare = cbsGrandTotal > 0 ? cbsCapexTotal / cbsGrandTotal : 1;
              const stacked = phasing.map((p) => ({
                label: p.label,
                capex: Math.round(p.planned * capexShare),
                opex: Math.round(p.planned * (1 - capexShare)),
                actual: p.actual,
              }));

              return (
                <>
                  {/* ── KPI strip ─────────────────────────────────────────── */}
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <CashflowKpi
                      icon={Wallet}
                      tone="indigo"
                      label="Total planned outflow"
                      value={AED(totalPlanned)}
                      sub={`${phasing.length} month${phasing.length === 1 ? '' : 's'} · BAC ${AED(evm.bac)}`}
                    />
                    <CashflowKpi
                      icon={TrendingUp}
                      tone="sky"
                      label="Peak monthly spend"
                      value={AED(peakMonthlyPlanned)}
                      sub={peakMonthRow ? `Peak in ${peakMonthRow.label}` : '—'}
                    />
                    <CashflowKpi
                      icon={Shield}
                      tone={fundingRunway > evm.bac * 0.5 ? 'rose' : fundingRunway > evm.bac * 0.25 ? 'amber' : 'emerald'}
                      label="Peak funding need"
                      value={AED(fundingRunway)}
                      sub="Minimum working-capital line"
                    />
                    <CashflowKpi
                      icon={Activity}
                      tone={costPerformanceTone === 'good' ? 'emerald' : costPerformanceTone === 'warn' ? 'amber' : 'rose'}
                      label="Actuals to date"
                      value={AED(actualToDate)}
                      sub={`CPI ${evm.cpi.toFixed(2)} · SPI ${evm.spi.toFixed(2)}`}
                    />
                  </div>

                  {/* ── S-curve: Planned vs Actual vs BC plan ────────────── */}
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-2 dark:border-slate-700 dark:from-slate-800/60 dark:to-slate-900">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
                        <LineChart className="h-3 w-3 text-indigo-500" /> Cumulative S-curve
                        <span className="text-[10px] font-normal normal-case tracking-normal text-slate-500">· Planned value vs actuals vs business case cash plan</span>
                      </div>
                    </div>
                    <div className="h-[280px] p-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={phasingWithBc.rows} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
                          <defs>
                            <linearGradient id="cf-planned" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.45} />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tickFormatter={(v) => AED(Number(v))} tick={{ fontSize: 11 }} width={90} />
                          <RechartsTooltip formatter={(v) => AED(Number(v))} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Area type="monotone" dataKey="cumulativePlanned" name="Cumulative PV" fill="url(#cf-planned)" stroke="#6366f1" strokeWidth={2} />
                          <Line type="monotone" dataKey="actual" name="Monthly actuals" stroke="#f43f5e" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="planned" name="Monthly planned" stroke="#0ea5e9" strokeWidth={1.6} strokeDasharray="4 3" dot={false} />
                          {hasBcAnnual && (
                            <Line type="stepAfter" dataKey="bcPlanned" name="BC cash plan" stroke="#059669" strokeDasharray="5 4" strokeWidth={2} dot={false} />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* ── Net cash & funding runway ────────────────────────── */}
                  {paymentEvents.length > 0 && (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-200 bg-white dark:border-emerald-500/30 dark:bg-slate-900">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 bg-gradient-to-r from-emerald-50/70 to-white px-4 py-2 dark:border-emerald-500/20 dark:from-emerald-500/5 dark:to-slate-900">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                          <Shield className="h-3 w-3" /> Net cashflow & funding runway
                          <span className="text-[10px] font-normal normal-case tracking-normal text-emerald-700/80 dark:text-emerald-400/80">· Monthly spend offset by delivery-triggered inflows</span>
                        </div>
                        <span className="text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                          Peak need: {AED(fundingRunway)}
                        </span>
                      </div>
                      <div className="h-[240px] p-3">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={netSeries} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.45} />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={(v) => AED(Number(v))} tick={{ fontSize: 11 }} width={90} />
                            <RechartsTooltip formatter={(v) => AED(Number(v))} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="2 2" />
                            <Bar dataKey="spend" name="Monthly spend" fill="#f87171" radius={[2, 2, 0, 0]} />
                            <Bar dataKey="inflow" name="Delivery payment inflow" fill="#10b981" radius={[2, 2, 0, 0]} />
                            <Line type="monotone" dataKey="cumulative" name="Net cumulative" stroke="#0f766e" strokeWidth={2.5} dot={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* ── CAPEX vs OPEX monthly split ──────────────────────── */}
                  {cbsGrandTotal > 0 && (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-gradient-to-r from-sky-50/60 to-white px-4 py-2 dark:border-slate-700 dark:from-sky-500/5 dark:to-slate-900">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
                          <BarChart3 className="h-3 w-3 text-sky-500" /> CAPEX / OPEX monthly split
                          <span className="text-[10px] font-normal normal-case tracking-normal text-slate-500">· CAPEX {toPct(capexShare * 100)} · OPEX {toPct((1 - capexShare) * 100)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10.5px]">
                          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-indigo-500" /> CAPEX</span>
                          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-teal-500" /> OPEX</span>
                          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-rose-500" /> Actual</span>
                        </div>
                      </div>
                      <div className="h-[220px] p-3">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={stacked} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.45} />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={(v) => AED(Number(v))} tick={{ fontSize: 11 }} width={90} />
                            <RechartsTooltip formatter={(v) => AED(Number(v))} />
                            <Bar dataKey="capex" stackId="c" name="CAPEX" fill="#6366f1" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="opex" stackId="c" name="OPEX" fill="#14b8a6" radius={[2, 2, 0, 0]} />
                            <Line type="monotone" dataKey="actual" name="Actual" stroke="#f43f5e" strokeWidth={2} dot={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
            {hasBcAnnual && bcAnnualRows.length > 0 && (() => {
              // Compact annual BC reconciliation — replaces the verbose table
              // with a per-year chip strip. Each chip shows BC cost and the
              // delta vs CBS phasing with a tone-coded edge. Far easier to
              // scan than a six-column table.
              const totalCost = bcAnnualRows.reduce((s, r) => s + r.total, 0);
              const totalCbs = bcAnnualRows.reduce((s, r) => s + r.cbs, 0);
              const totalDelta = totalCbs - totalCost;
              return (
                <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-white to-white dark:border-emerald-500/30 dark:from-emerald-500/10 dark:via-slate-900 dark:to-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/60 bg-emerald-50/60 px-3 py-1.5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                      <Sparkles className="h-3 w-3" /> BC annual reconciliation
                      <span className="text-[10px] font-normal normal-case tracking-normal text-emerald-700/80 dark:text-emerald-400/80">
                        · CBS phasing vs approved business case per year
                      </span>
                    </div>
                    <div className={`text-[12px] font-bold tabular-nums ${Math.abs(totalDelta) / Math.max(1, totalCost) <= 0.005 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                      Δ {totalDelta >= 0 ? '+' : '−'}{AED(Math.abs(totalDelta))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-3 xl:grid-cols-5">
                    {bcAnnualRows.map((r) => {
                      const delta = r.cbs - r.total;
                      const pct = r.total > 0 ? Math.abs(delta) / r.total : r.cbs > 0 ? 1 : 0;
                      const tone = pct <= 0.005
                        ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-500/40 dark:bg-emerald-500/10'
                        : pct <= 0.05
                          ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                          : 'border-rose-300 bg-rose-50/60 dark:border-rose-500/40 dark:bg-rose-500/10';
                      const deltaTone = pct <= 0.005
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : pct <= 0.05
                          ? 'text-slate-500'
                          : 'text-rose-700 dark:text-rose-300';
                      return (
                        <div key={r.fy} className={`rounded-xl border p-2.5 transition-shadow ${tone}`}>
                          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            <span>{r.label}</span>
                            {r.total > 0 && (
                              <span className={`tabular-nums ${deltaTone}`}>
                                {r.cbs === 0 ? '—' : (delta >= 0 ? '+' : '−') + AED(Math.abs(delta))}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-baseline justify-between">
                            <span className="text-[11px] text-slate-500">BC</span>
                            <span className="text-[13px] font-bold tabular-nums text-slate-900 dark:text-white">{AED(r.total)}</span>
                          </div>
                          <div className="flex items-baseline justify-between">
                            <span className="text-[11px] text-slate-500">CBS</span>
                            <span className="text-[12px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">{AED(r.cbs)}</span>
                          </div>
                          {r.benefits > 0 && (
                            <div className="mt-1 flex items-baseline justify-between border-t border-slate-200/70 pt-1 dark:border-slate-700/70">
                              <span className="text-[11px] text-slate-500">Benefit</span>
                              <span className="text-[12px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">+{AED(r.benefits)}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Commitments ───────────────────────────────────────────────────────────

function CommitmentsView({
  plan,
  evm,
  onUpdate,
  onAdd,
  onRemove,
  readOnly,
}: {
  plan: CostPlanState;
  evm: EvmMetrics;
  onUpdate: (id: string, patch: Partial<CommitmentEntry>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  readOnly?: boolean;
}) {
  const totalAwarded = plan.commitments.reduce((s, c) => s + c.awardedValue, 0);
  const totalInvoiced = plan.commitments.reduce((s, c) => s + c.invoicedValue, 0);
  const totalPaid = plan.commitments.reduce((s, c) => s + c.paidValue, 0);
  const coverage = evm.bac > 0 ? (totalAwarded / evm.bac) * 100 : 0;
  const nextPlannedDue = [...plan.commitments]
    .filter((commitment) => Boolean(commitment.dueDate) && commitment.status !== 'closed' && commitment.status !== 'cancelled')
    .sort((left, right) => (left.dueDate ?? '').localeCompare(right.dueDate ?? ''))[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeading
          icon={FileCheck}
          title="Commitments & Procurement"
          subtitle="Formal commercial exposure — awarded POs and contracts, invoicing posture, retention and drawdown."
        >
          <Button size="sm" onClick={onAdd} disabled={readOnly}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add commitment
          </Button>
        </SectionHeading>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2 gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3 md:grid-cols-4 dark:border-slate-700 dark:bg-slate-800/40">
          <MiniStat label="Awarded" value={AED(totalAwarded)} sub={`${plan.commitments.length} packages`} />
          <MiniStat label="Invoiced" value={AED(totalInvoiced)} sub={toPct((totalInvoiced / Math.max(1, totalAwarded)) * 100)} />
          <MiniStat label="Paid" value={AED(totalPaid)} sub={toPct((totalPaid / Math.max(1, totalInvoiced)) * 100)} />
          <MiniStat label="BAC coverage" value={toPct(coverage)} sub={`${AED(evm.bac - totalAwarded)} uncommitted`} />
        </div>
        {nextPlannedDue && (
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <Calendar className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <span>
              Next planned due date <span className="font-semibold text-slate-900 dark:text-white">{prettyPlanDate(nextPlannedDue.dueDate)}</span>
              {' '}· {nextPlannedDue.ref} · {nextPlannedDue.vendor}
            </span>
          </div>
        )}
        {plan.commitments.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={FileCheck} title="No commitments yet" hint="Add POs, contracts or framework awards to track commercial exposure against the baseline." />
          </div>
        ) : (
          <ScrollArea className="max-h-[min(58vh,720px)] w-full">
            <div className="min-w-[1220px]">
              <div className="grid grid-cols-[120px_minmax(200px,1.2fr)_minmax(200px,1fr)_110px_110px_110px_120px_110px_110px_44px] border-b border-slate-200 bg-white text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                <div className="px-3 py-2.5">Reference</div>
                <div className="px-3 py-2.5">Vendor</div>
                <div className="px-3 py-2.5">Scope</div>
                <div className="px-3 py-2.5 text-right">Awarded</div>
                <div className="px-3 py-2.5 text-right">Invoiced</div>
                <div className="px-3 py-2.5 text-right">Paid</div>
                <div className="px-3 py-2.5">Due</div>
                <div className="px-3 py-2.5">Status</div>
                <div className="px-3 py-2.5">Class</div>
                <div className="px-3 py-2.5" />
              </div>
              {plan.commitments.map((c) => (
                <div key={c.id} className="grid grid-cols-[120px_minmax(200px,1.2fr)_minmax(200px,1fr)_110px_110px_110px_120px_110px_110px_44px] items-center border-b border-slate-100 bg-white text-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="px-2 py-1.5">
                    <Input value={c.ref} onChange={(e) => onUpdate(c.id, { ref: e.target.value })} disabled={readOnly} className="h-8 font-mono text-[11px] uppercase" />
                  </div>
                  <div className="px-2 py-1.5">
                    <Input value={c.vendor} onChange={(e) => onUpdate(c.id, { vendor: e.target.value })} disabled={readOnly} className="h-8" />
                  </div>
                  <div className="px-2 py-1.5">
                    <Input value={c.scope ?? ''} onChange={(e) => onUpdate(c.id, { scope: e.target.value })} disabled={readOnly} className="h-8 text-xs" placeholder="Scope summary" />
                  </div>
                  <div className="px-2 py-1.5">
                    <Input type="number" value={c.awardedValue} onChange={(e) => onUpdate(c.id, { awardedValue: num(e.target.value) })} disabled={readOnly} className="h-8 text-right tabular-nums" />
                  </div>
                  <div className="px-2 py-1.5">
                    <Input type="number" value={c.invoicedValue} onChange={(e) => onUpdate(c.id, { invoicedValue: num(e.target.value) })} disabled={readOnly} className="h-8 text-right tabular-nums" />
                  </div>
                  <div className="px-2 py-1.5">
                    <Input type="number" value={c.paidValue} onChange={(e) => onUpdate(c.id, { paidValue: num(e.target.value) })} disabled={readOnly} className="h-8 text-right tabular-nums" />
                  </div>
                  <div className="px-2 py-1.5">
                    <Input type="date" value={c.dueDate ?? ''} onChange={(e) => onUpdate(c.id, { dueDate: e.target.value })} disabled={readOnly} className="h-8 text-[11px] tabular-nums" />
                  </div>
                  <div className="px-2 py-1.5">
                    <Select value={c.status} onValueChange={(v) => onUpdate(c.id, { status: v as CommitmentEntry['status'] })} disabled={readOnly}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="awarded">Awarded</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="px-2 py-1.5">
                    <Select value={c.costClass} onValueChange={(v) => onUpdate(c.id, { costClass: v as CommitmentEntry['costClass'] })} disabled={readOnly}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CAPEX">CAPEX</SelectItem>
                        <SelectItem value="OPEX">OPEX</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="px-2 py-1.5">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-rose-600" onClick={() => onRemove(c.id)} disabled={readOnly} aria-label="Remove commitment">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ─── EVM ───────────────────────────────────────────────────────────────────

function _EvmView({ evm, phasing }: { evm: EvmMetrics; phasing: ReturnType<typeof computePhasing> }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader className="pb-3">
          <SectionHeading icon={Activity} title="EVM curves" subtitle="Planned value, earned value and actual cost plotted against the delivery timeline." />
        </CardHeader>
        <CardContent>
          {phasing.length === 0 ? (
            <EmptyState icon={Activity} title="Not enough signal" hint="EVM requires planned dates and earned progress. Populate the WBS with dates + % complete." />
          ) : (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
                <MiniStat label="CPI" value={evm.cpi.toFixed(2)} sub={evm.cpi >= 1 ? 'Efficient' : 'Eroding'} />
                <MiniStat label="SPI" value={evm.spi.toFixed(2)} sub={evm.spi >= 1 ? 'On pace' : 'Slipping'} />
                <MiniStat label="CV" value={AED(evm.cv)} sub={evm.cv >= 0 ? 'Positive' : 'Cost overrun'} />
                <MiniStat label="SV" value={AED(evm.sv)} sub={evm.sv >= 0 ? 'Ahead' : 'Behind'} />
              </div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={(() => {
                      // Locate the "now" month boundary so EV/AC stop at the data date.
                      const now = Date.now();
                      const nowIdx = (() => {
                        for (let i = 0; i < phasing.length; i++) {
                          const p = phasing[i];
                          if (!p) continue;
                          const d = new Date(`${p.month}-15T00:00:00Z`).getTime();
                          if (d > now) return i - 1;
                        }
                        return phasing.length - 1;
                      })();
                      const totalEv = evm.ev;
                      const totalAc = evm.ac;
                      const pvAtNow = nowIdx >= 0 ? (phasing[nowIdx]?.cumulativePlanned ?? 0) : 0;
                      return phasing.map((p, idx) => {
                        const elapsedFraction = pvAtNow > 0 ? Math.min(1, p.cumulativePlanned / pvAtNow) : 0;
                        return {
                          ...p,
                          ev: idx <= nowIdx ? Math.round(totalEv * elapsedFraction) : null,
                          cumulativeActual: idx <= nowIdx ? p.cumulativeActual || Math.round(totalAc * elapsedFraction) : null,
                        };
                      });
                    })()}
                    margin={{ top: 10, right: 12, bottom: 4, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.45} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => AED(Number(v))} tick={{ fontSize: 11 }} width={90} />
                    <RechartsTooltip formatter={(v) => (v == null ? '—' : AED(Number(v)))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="cumulativePlanned" name="PV (planned)" stroke="#6366f1" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="ev" name="EV (earned)" stroke="#10b981" strokeWidth={2} dot={false} connectNulls={false} />
                    <Line type="monotone" dataKey="cumulativeActual" name="AC (actual)" stroke="#f43f5e" strokeWidth={2} dot={false} connectNulls={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <SectionHeading icon={SlidersHorizontal} title="Scenario modeler" subtitle="Slide the assumed CPI / SPI to stress-test the forecast in real time." />
        </CardHeader>
        <CardContent>
          <ScenarioModeler evm={evm} />
        </CardContent>
      </Card>
    </div>
  );
}

function ScenarioModeler({ evm }: { evm: EvmMetrics }) {
  const [cpiAssumption, setCpiAssumption] = useState<number>(Number.isFinite(evm.cpi) ? Number(evm.cpi.toFixed(2)) : 1);
  const [spiAssumption, setSpiAssumption] = useState<number>(Number.isFinite(evm.spi) ? Number(evm.spi.toFixed(2)) : 1);

  const scenarioEac = cpiAssumption > 0 ? evm.bac / cpiAssumption : evm.bac;
  const compoundEac = cpiAssumption > 0 && spiAssumption > 0 ? evm.bac / (cpiAssumption * spiAssumption) : evm.bac;
  const optimisticEac = evm.ac + Math.max(0, evm.bac - evm.ev);
  const deltaVsBac = evm.bac - scenarioEac;
  const deltaTone = deltaVsBac >= 0 ? 'good' : 'bad';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 dark:border-slate-700 dark:from-slate-800/60 dark:to-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Scenario EAC</div>
            <div className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{AED(scenarioEac)}</div>
          </div>
          <Badge
            variant="outline"
            className={
              deltaTone === 'good'
                ? 'gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'gap-1 border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
            }
          >
            {deltaTone === 'good' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {deltaVsBac >= 0 ? 'Under' : 'Over'} BAC by {AED(Math.abs(deltaVsBac))}
          </Badge>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Assumed CPI</Label>
          <span className="tabular-nums font-bold text-slate-900 dark:text-white">{cpiAssumption.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.01}
          value={cpiAssumption}
          onChange={(e) => setCpiAssumption(Number(e.target.value))}
          className="mt-2 w-full accent-indigo-600"
        />
        <div className="mt-0.5 flex justify-between text-[10px] text-slate-400">
          <span>0.50 · over-budget</span>
          <span>1.00 · on-plan</span>
          <span>1.50 · under-budget</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Assumed SPI</Label>
          <span className="tabular-nums font-bold text-slate-900 dark:text-white">{spiAssumption.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.01}
          value={spiAssumption}
          onChange={(e) => setSpiAssumption(Number(e.target.value))}
          className="mt-2 w-full accent-emerald-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 pt-2">
        <ScenarioRow label="Typical — BAC / CPI" value={scenarioEac} bac={evm.bac} />
        <ScenarioRow label="Compound — BAC / (CPI × SPI)" value={compoundEac} bac={evm.bac} />
        <ScenarioRow label="Optimistic — AC + (BAC − EV)" value={optimisticEac} bac={evm.bac} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
          <Sparkles className="h-3.5 w-3.5" /> Decision hint
        </div>
        <p className="mt-1 leading-relaxed">
          {cpiAssumption < 0.95
            ? 'At this CPI, recommend rebase of the most-exposed packages and a contingency drawdown review before the next stage gate.'
            : 'Performance sits within tolerance — consider releasing a portion of contingency to future scope or trimming the management reserve envelope.'}
        </p>
      </div>
    </div>
  );
}

function ScenarioRow({ label, value, bac }: { label: string; value: number; bac: number }) {
  const delta = bac - value;
  const tone = delta >= 0 ? 'good' : 'bad';
  const Icon = delta >= 0 ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</div>
        <Badge
          variant="outline"
          className={
            tone === 'good'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
          }
        >
          <Icon className="mr-1 h-3 w-3" /> {AED(Math.abs(delta))}
        </Badge>
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{AED(value)}</div>
    </div>
  );
}

// ─── Reserves & Changes ────────────────────────────────────────────────────

function _ReservesView({
  plan,
  baselineTotals,
  onReserves,
  onNotes,
  onAddChange,
  onUpdateChange,
  onRemoveChange,
  readOnly,
}: {
  plan: CostPlanState;
  baselineTotals: { contingencyPool: number; managementPool: number } & Record<string, number>;
  onReserves: (patch: Partial<ReserveState>) => void;
  onNotes: (notes: string) => void;
  onAddChange: () => void;
  onUpdateChange: (id: string, patch: Partial<ChangeLogEntry>) => void;
  onRemoveChange: (id: string) => void;
  readOnly?: boolean;
}) {
  const netChange = plan.changes
    .filter((c) => c.status === 'approved' || c.status === 'applied')
    .reduce((s, c) => s + c.amount, 0);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card>
        <CardHeader className="pb-3">
          <SectionHeading icon={Shield} title="Reserves" subtitle="Contingency covers known-unknowns inside the baseline; management reserve sits outside the baseline for unknown-unknowns." />
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Contingency reserve %</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="number"
                value={plan.reserves.contingencyPct}
                onChange={(e) => onReserves({ contingencyPct: num(e.target.value) })}
                disabled={readOnly}
                className="h-9 w-24 text-right tabular-nums"
              />
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Pool: <span className="font-semibold text-slate-900 dark:text-white">{AED(baselineTotals.contingencyPool)}</span>
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs">Contingency used (AED)</Label>
            <Input
              type="number"
              value={plan.reserves.contingencyUsed}
              onChange={(e) => onReserves({ contingencyUsed: num(e.target.value) })}
              disabled={readOnly}
              className="mt-1 h-9 text-right tabular-nums"
            />
            <Progress
              className="mt-2 h-2"
              value={Math.min(100, (plan.reserves.contingencyUsed / Math.max(1, baselineTotals.contingencyPool)) * 100)}
            />
          </div>
          <div>
            <Label className="text-xs">Management reserve %</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="number"
                value={plan.reserves.managementReservePct}
                onChange={(e) => onReserves({ managementReservePct: num(e.target.value) })}
                disabled={readOnly}
                className="h-9 w-24 text-right tabular-nums"
              />
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Pool: <span className="font-semibold text-slate-900 dark:text-white">{AED(baselineTotals.managementPool)}</span>
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs">Management reserve used (AED)</Label>
            <Input
              type="number"
              value={plan.reserves.managementReserveUsed}
              onChange={(e) => onReserves({ managementReserveUsed: num(e.target.value) })}
              disabled={readOnly}
              className="mt-1 h-9 text-right tabular-nums"
            />
          </div>
          <div>
            <Label className="text-xs">Cost plan notes</Label>
            <Textarea
              value={plan.notes ?? ''}
              onChange={(e) => onNotes(e.target.value)}
              placeholder="Capture funding assumptions, rate-card validity window, FX basis, approvals and lineage."
              className="mt-1 min-h-[80px] text-xs"
              disabled={readOnly}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader className="pb-3">
          <SectionHeading icon={ClipboardList} title="Change log" subtitle="Every movement of the baseline — CR reference, amount, reason and approval status.">
            <Button size="sm" onClick={onAddChange} disabled={readOnly}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add change
            </Button>
          </SectionHeading>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-3 gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
            <MiniStat label="Entries" value={String(plan.changes.length)} />
            <MiniStat label="Net approved" value={AED(netChange)} sub={netChange >= 0 ? 'Scope added' : 'Scope reduced'} />
            <MiniStat label="Proposed" value={String(plan.changes.filter((c) => c.status === 'proposed').length)} sub="Awaiting decision" />
          </div>
          {plan.changes.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={ClipboardList} title="No changes logged" hint="Log a CR whenever the baseline moves — even internal realignments. Full auditability, zero ambiguity." />
            </div>
          ) : (
            <ScrollArea className="max-h-[440px]">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[120px_120px_minmax(220px,1.2fr)_minmax(200px,1fr)_110px_120px_120px_44px] border-b border-slate-200 bg-white text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <div className="px-3 py-2.5">Date</div>
                  <div className="px-3 py-2.5">Ref</div>
                  <div className="px-3 py-2.5">Title</div>
                  <div className="px-3 py-2.5">Reason</div>
                  <div className="px-3 py-2.5 text-right">Amount</div>
                  <div className="px-3 py-2.5">Status</div>
                  <div className="px-3 py-2.5">Approver</div>
                  <div className="px-3 py-2.5" />
                </div>
                {plan.changes.map((c) => (
                  <div key={c.id} className="grid grid-cols-[120px_120px_minmax(220px,1.2fr)_minmax(200px,1fr)_110px_120px_120px_44px] items-center border-b border-slate-100 bg-white text-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="px-2 py-1.5">
                      <Input type="date" value={c.date} onChange={(e) => onUpdateChange(c.id, { date: e.target.value })} disabled={readOnly} className="h-8 text-xs" />
                    </div>
                    <div className="px-2 py-1.5">
                      <Input value={c.ref} onChange={(e) => onUpdateChange(c.id, { ref: e.target.value })} disabled={readOnly} className="h-8 font-mono text-[11px] uppercase" />
                    </div>
                    <div className="px-2 py-1.5">
                      <Input value={c.title} onChange={(e) => onUpdateChange(c.id, { title: e.target.value })} disabled={readOnly} className="h-8" />
                    </div>
                    <div className="px-2 py-1.5">
                      <Input value={c.reason ?? ''} onChange={(e) => onUpdateChange(c.id, { reason: e.target.value })} disabled={readOnly} className="h-8 text-xs" placeholder="Why this change" />
                    </div>
                    <div className="px-2 py-1.5">
                      <Input type="number" value={c.amount} onChange={(e) => onUpdateChange(c.id, { amount: num(e.target.value) })} disabled={readOnly} className="h-8 text-right tabular-nums" />
                    </div>
                    <div className="px-2 py-1.5">
                      <Select value={c.status} onValueChange={(v) => onUpdateChange(c.id, { status: v as ChangeLogEntry['status'] })} disabled={readOnly}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="proposed">Proposed</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="applied">Applied</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="px-2 py-1.5">
                      <Input value={c.approver ?? ''} onChange={(e) => onUpdateChange(c.id, { approver: e.target.value })} disabled={readOnly} className="h-8 text-xs" placeholder="Approver" />
                    </div>
                    <div className="px-2 py-1.5">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-rose-600" onClick={() => onRemoveChange(c.id)} disabled={readOnly} aria-label="Remove change">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
