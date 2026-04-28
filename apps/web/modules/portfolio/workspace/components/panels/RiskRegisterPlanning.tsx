/**
 * RiskRegisterPlanning — comprehensive planning-phase risk register.
 *
 * Combines:
 *   1. Approved risks from the Initiation business case (via collectBusinessCaseRisks)
 *   2. WBS-aware AI-synthesized risks derived from schedule density, deliverable
 *      coverage, orphaned work packages, budget concentration, dependency fan-in,
 *      critical-path concentration, and milestone cadence.
 *
 * All risks are normalized into a single register with owner placeholder,
 * response strategy, trigger condition, and residual severity after mitigation.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Sparkles,
  Filter,
  Shield,
  TrendingUp,
  Target,
  FileCheck2,
  Brain,
  Layers,
  Wallet,
  GitBranch,
  CalendarClock,
  Activity,
  Pencil,
  Plus,
  Trash2,
  RotateCcw,
  User,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { BusinessCaseData, WbsTaskData } from '../../types';
import {
  collectBusinessCaseRisks,
  type UnifiedRisk,
} from '../../utils/riskSources';

export interface RiskRegisterApprovalView {
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | null;
  version?: number;
  submittedAt?: string | null;
  submittedByName?: string | null;
  reviewedAt?: string | null;
  reviewedByName?: string | null;
  reviewNotes?: string | null;
  rejectionReason?: string | null;
  stats?: { total: number; critical: number; high: number; medium: number; low: number; categoriesCovered: number };
}

interface RiskRegisterPlanningProps {
  businessCase?: BusinessCaseData | null;
  demandReport?: unknown;
  tasks: WbsTaskData[];
  approvedBudget?: number;
  projectId?: string;
  approval?: RiskRegisterApprovalView | null;
  onSubmitForApproval?: (payload: {
    snapshot: { rows: Array<Record<string, unknown>>; generatedAt: string };
    stats: { total: number; critical: number; high: number; medium: number; low: number; categoriesCovered: number };
    notes?: string;
  }) => Promise<void> | void;
  isSubmitting?: boolean;
}

type RiskCategory =
  | 'governance'
  | 'schedule'
  | 'cost'
  | 'scope'
  | 'technical'
  | 'quality'
  | 'resource'
  | 'stakeholder'
  | 'compliance'
  | 'external';

interface RegisterRow {
  id: string;
  source: 'initiation' | 'wbs-synth' | 'user-added';
  displayName: string;
  description?: string;
  category: RiskCategory;
  probIdx: number; // 0..4
  impactIdx: number;
  severityLabel: 'Low' | 'Medium' | 'High' | 'Critical';
  mitigation?: string;
  contingency?: string;
  trigger?: string;
  owner?: string;
  linkedWbs?: string[];
  residualSeverity?: 'Low' | 'Medium' | 'High' | 'Critical';
  /** ISO yyyy-mm-dd — when the mitigation must be completed. */
  mitigationDueDate?: string;
  /** True if the due date was AI-suggested rather than manually set. */
  mitigationDueDateSuggested?: boolean;
  /** Manual notes added by the project manager. */
  notes?: string;
}

/** Override shape persisted to localStorage keyed by risk id. */
type RiskOverride = Partial<Pick<RegisterRow,
  'mitigation' | 'contingency' | 'trigger' | 'owner' | 'mitigationDueDate' |
  'mitigationDueDateSuggested' | 'notes' | 'probIdx' | 'impactIdx' |
  'severityLabel' | 'residualSeverity' | 'category' | 'displayName' | 'description'
>>;

const SEVERITY_MATRIX: Array<Array<RegisterRow['severityLabel']>> = [
  ['Low', 'Low', 'Medium', 'Medium', 'High'],
  ['Low', 'Medium', 'Medium', 'High', 'High'],
  ['Medium', 'Medium', 'High', 'High', 'Critical'],
  ['Medium', 'High', 'High', 'Critical', 'Critical'],
  ['High', 'High', 'Critical', 'Critical', 'Critical'],
];

const SEVERITY_ORDER: Record<RegisterRow['severityLabel'], number> = {
  Critical: 3,
  High: 2,
  Medium: 1,
  Low: 0,
};

const CATEGORY_META: Record<RiskCategory, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  governance:   { label: 'Governance',   icon: Shield,        tone: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30' },
  schedule:     { label: 'Schedule',     icon: CalendarClock, tone: 'text-sky-500 bg-sky-500/10 border-sky-500/30' },
  cost:         { label: 'Cost',         icon: Wallet,        tone: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
  scope:        { label: 'Scope',        icon: Layers,        tone: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
  technical:    { label: 'Technical',    icon: Activity,      tone: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30' },
  quality:      { label: 'Quality',      icon: FileCheck2,    tone: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' },
  resource:     { label: 'Resource',     icon: Target,        tone: 'text-rose-500 bg-rose-500/10 border-rose-500/30' },
  stakeholder:  { label: 'Stakeholder',  icon: Sparkles,      tone: 'text-pink-500 bg-pink-500/10 border-pink-500/30' },
  compliance:   { label: 'Compliance',   icon: Shield,        tone: 'text-blue-500 bg-blue-500/10 border-blue-500/30' },
  external:     { label: 'External',     icon: TrendingUp,    tone: 'text-orange-500 bg-orange-500/10 border-orange-500/30' },
};

function severityFromIdx(p: number, i: number): RegisterRow['severityLabel'] {
  return SEVERITY_MATRIX[p]?.[i] ?? 'Medium';
}

/**
 * Compute residual severity after mitigation is applied.
 *
 * Model: if a credible mitigation exists, drop probability by one step (mitigation
 * reduces likelihood of occurrence) and impact by one step for Critical/High rows
 * only (for Low/Medium, mitigation mostly reduces likelihood, not consequence).
 * Clamped to [0..4]. No mitigation → residual equals inherent severity.
 */
function computeResidualSeverity(
  probIdx: number,
  impactIdx: number,
  mitigation?: string,
): RegisterRow['severityLabel'] {
  const hasMitigation = Boolean(mitigation && mitigation.trim().length >= 20);
  if (!hasMitigation) return severityFromIdx(probIdx, impactIdx);
  const residualProb = Math.max(0, probIdx - 1);
  const residualImpact = impactIdx >= 3 ? Math.max(0, impactIdx - 1) : impactIdx;
  return severityFromIdx(residualProb, residualImpact);
}

const CATEGORY_KEYWORDS: Record<RiskCategory, string[]> = {
  governance:  ['govern', 'charter', 'raci', 'steer', 'sponsor', 'stage-gate', 'gate', 'pmo'],
  schedule:    ['schedul', 'milestone', 'plan', 'gantt', 'timeline', 'baseline', 'critical path'],
  cost:        ['cost', 'budget', 'financ', 'cashflow', 'procure', 'contract', 'invoice', 'payment'],
  scope:       ['scope', 'require', 'accept', 'wbs', 'deliverable', 'decomposition'],
  technical:   ['technic', 'integrat', 'architect', 'data', 'system', 'infra', 'api', 'security'],
  quality:     ['quality', 'accept', 'test', 'qa', 'defect', 'review', 'criteria'],
  resource:    ['resource', 'team', 'staff', 'capacity', 'skill', 'hire', 'mobiliz'],
  stakeholder: ['stakehold', 'commun', 'engage', 'adoption', 'training', 'change'],
  compliance:  ['compli', 'regul', 'audit', 'policy', 'legal', 'governance', 'privacy'],
  external:    ['market', 'supplier', 'vendor', 'weather', 'geopolit', 'macroecon'],
};

/**
 * AI-suggest a mitigation due date derived from the WBS plan and risk severity.
 *
 * Rules (deterministic):
 *   1. If any WBS tasks match the risk's category keywords, target the earliest
 *      matching task's planned start — that's when the risk becomes real.
 *   2. Otherwise anchor to the earliest WBS task's planned start (project kick-off).
 *   3. Severity-driven offset (days before the anchor): Critical -21, High -14,
 *      Medium -7, Low 0. Critical risks must be mitigated well before the anchor;
 *      Low risks can be addressed at the anchor event.
 *   4. Minimum floor of today + 7d so every suggestion is actionable.
 */
function suggestMitigationDueDate(
  severity: RegisterRow['severityLabel'],
  category: RiskCategory,
  tasks: WbsTaskData[],
): string | undefined {
  if (!tasks || tasks.length === 0) return undefined;

  const kws = CATEGORY_KEYWORDS[category];
  const matchingStarts: Date[] = [];
  const allStarts: Date[] = [];
  for (const t of tasks) {
    const start = toDate(t.plannedStartDate);
    if (!start) continue;
    allStarts.push(start);
    const hay = `${t.taskName ?? ''} ${t.description ?? ''}`.toLowerCase();
    if (kws.some(k => hay.includes(k))) matchingStarts.push(start);
  }
  if (allStarts.length === 0) return undefined;

  const anchor = (matchingStarts.length > 0 ? matchingStarts : allStarts)
    .sort((a, b) => a.getTime() - b.getTime())[0]!;

  const offsetDays: Record<RegisterRow['severityLabel'], number> = {
    Critical: -21,
    High: -14,
    Medium: -7,
    Low: 0,
  };
  const target = new Date(anchor.getTime() + offsetDays[severity] * 86400000);

  // Floor to today + 7 days for realism.
  const floor = new Date(Date.now() + 7 * 86400000);
  const final = target.getTime() < floor.getTime() ? floor : target;

  return final.toISOString().slice(0, 10);
}

const STORAGE_PREFIX = 'corevia.riskRegister.v1.';
interface PersistedState {
  overrides: Record<string, RiskOverride>;
  userRows: RegisterRow[];
}

function loadPersisted(projectKey: string): PersistedState {
  if (typeof window === 'undefined') return { overrides: {}, userRows: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + projectKey);
    if (!raw) return { overrides: {}, userRows: [] };
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      overrides: parsed.overrides ?? {},
      userRows: Array.isArray(parsed.userRows) ? parsed.userRows : [],
    };
  } catch {
    return { overrides: {}, userRows: [] };
  }
}

function savePersisted(projectKey: string, state: PersistedState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + projectKey, JSON.stringify(state));
  } catch {
    /* storage quota / disabled */
  }
}

/** Infer category from risk name / description. */
function inferCategory(text: string): RiskCategory {
  const s = text.toLowerCase();
  if (/regul|complian|policy|legal/.test(s)) return 'compliance';
  if (/governance|sponsor|steer|raci|charter/.test(s)) return 'governance';
  if (/schedul|delay|slip|timeline|milestone/.test(s)) return 'schedule';
  if (/budget|cost|finan|npv|roi|funding/.test(s)) return 'cost';
  if (/scope|creep|require|change/.test(s)) return 'scope';
  if (/tech|integration|system|data|interop|infra|architecture/.test(s)) return 'technical';
  if (/quality|acceptance|defect|testing|criteria/.test(s)) return 'quality';
  if (/resourc|capacity|team|skill|stak|staff/.test(s)) return 'resource';
  if (/stake|public|trust|adoption|communication|engagement/.test(s)) return 'stakeholder';
  if (/market|vendor|supplier|weather|geopolit|external/.test(s)) return 'external';
  return 'scope';
}

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'onto', 'must', 'have', 'this', 'that', 'will', 'should',
  'project', 'risk', 'risks', 'phase', 'work', 'package', 'packages', 'task', 'tasks', 'plan', 'planning',
  'execution', 'register', 'approved', 'approval', 'system', 'process', 'powered', 'crm', 'ai', 'due',
]);

function normalizeInferredWbsRef(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function trimInferredWbsZeros(value: string): string {
  return normalizeInferredWbsRef(value).replace(/(?:\.0)+$/g, '');
}

function isAncestorInferredWbsRef(left: string, right: string): boolean {
  const ancestor = trimInferredWbsZeros(left);
  const descendant = trimInferredWbsZeros(right);
  if (!ancestor || !descendant || ancestor === descendant) return false;
  return descendant.startsWith(`${ancestor}.`);
}

function collapseInferredLinkedWbs(refs: string[]): string[] {
  const unique = Array.from(new Set(refs.map(ref => ref.trim()).filter(ref => ref.length > 0)));
  const sorted = unique.sort((a, b) => {
    const segmentDelta = trimInferredWbsZeros(b).split('.').length - trimInferredWbsZeros(a).split('.').length;
    if (segmentDelta !== 0) return segmentDelta;
    return a.localeCompare(b);
  });

  const selected: string[] = [];
  for (const ref of sorted) {
    if (selected.some(existing => isAncestorInferredWbsRef(ref, existing))) continue;
    selected.push(ref);
  }

  return selected;
}

function scoreTaskRelevance(task: WbsTaskData, row: RegisterRow): number {
  const title = (task.taskName || task.title || '').toLowerCase();
  const description = (task.description || '').toLowerCase();
  const hay = `${title} ${description}`;
  if (!hay.trim()) return 0;

  const rowText = `${row.displayName} ${row.description ?? ''} ${row.mitigation ?? ''}`.toLowerCase();
  const categoryKeywords = CATEGORY_KEYWORDS[row.category] || [];
  const textTokens = Array.from(new Set(
    rowText
      .split(/[^a-z0-9]+/)
      .map(token => token.trim())
      .filter(token => token.length >= 4 && !STOP_WORDS.has(token)),
  ));

  let score = 0;
  let tokenHits = 0;

  for (const keyword of categoryKeywords) {
    if (hay.includes(keyword)) score += 4;
  }

  for (const token of textTokens) {
    if (hay.includes(token)) {
      tokenHits += 1;
      score += token.length >= 8 ? 3 : 2;
    }
  }

  if (tokenHits === 0) return 0;

  if (task.taskType === 'deliverable' || task.taskType === 'milestone') score += 2;
  if (task.wbsCode && /\.0$/.test(task.wbsCode)) score -= 3;

  return score;
}

function inferLinkedWbs(row: RegisterRow, tasks: WbsTaskData[]): string[] | undefined {
  if (row.linkedWbs && row.linkedWbs.length > 0) return row.linkedWbs;
  if (!Array.isArray(tasks) || tasks.length === 0) return undefined;

  const parentIds = new Set(tasks.map(task => task.parentTaskId).filter((value): value is string => Boolean(value)));

  const scored = tasks
    .map(task => {
      const baseScore = scoreTaskRelevance(task, row);
      const adjustedScore = parentIds.has(task.id) ? baseScore - 2 : baseScore + 2;
      return { task, score: adjustedScore };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aCode = a.task.wbsCode || a.task.id;
      const bCode = b.task.wbsCode || b.task.id;
      return aCode.localeCompare(bCode);
    });

  if (scored.length === 0) return undefined;

  const topScore = scored[0]?.score ?? 0;
  const narrowed = scored.filter(entry => entry.score >= Math.max(4, topScore - 2));
  const preferred = narrowed.length > 0 ? narrowed : scored.slice(0, 3);
  const collapsed = collapseInferredLinkedWbs(
    preferred
      .slice(0, 5)
      .map(({ task }) => task.wbsCode || task.id)
      .filter((code): code is string => Boolean(code)),
  );

  if (collapsed.length === 0) return undefined;

  return collapsed.slice(0, 3);
}

// ────────────────────────────────────────────────────────────────────
// AI-power synthesis — heuristics across the WBS, schedule, and budget.
// ────────────────────────────────────────────────────────────────────
function synthesizeWbsRisks(
  tasks: WbsTaskData[],
  approvedBudget: number,
): RegisterRow[] {
  if (!Array.isArray(tasks) || tasks.length === 0) return [];

  const rows: RegisterRow[] = [];
  const byCode = new Map<string, WbsTaskData>();
  for (const t of tasks) if (t.wbsCode) byCode.set(t.wbsCode, t);

  // Helper to find if a code has a declared parent deliverable.
  const hasDeliverableAncestor = (code: string): boolean => {
    if (!code) return false;
    const parts = code.split('.');
    while (parts.length > 1) {
      parts.pop();
      const parentCode = parts.join('.');
      const cand = byCode.get(parentCode) || byCode.get(parentCode + '.0');
      if (cand?.taskType === 'deliverable') return true;
    }
    return false;
  };

  // 1. Governance gap — leaf tasks without a deliverable ancestor.
  const leafTasks = tasks.filter(t => t.taskType === 'task');
  const orphanLeaves = leafTasks.filter(t => t.wbsCode && !hasDeliverableAncestor(t.wbsCode));
  if (orphanLeaves.length > 0) {
    rows.push({
      id: 'synth-governance-orphan',
      source: 'wbs-synth',
      category: 'governance',
      displayName: 'Work packages without a billable deliverable',
      description: `${orphanLeaves.length} leaf task${orphanLeaves.length === 1 ? '' : 's'} sit outside any approved deliverable, breaking the line of sight from effort to acceptance.`,
      probIdx: orphanLeaves.length > 5 ? 3 : 2,
      impactIdx: 3,
      severityLabel: severityFromIdx(orphanLeaves.length > 5 ? 3 : 2, 3),
      mitigation: 'Re-parent orphan leaves under existing deliverables or add new ones so 100% of the BAC flows through an acceptance event.',
      trigger: 'Observed on baseline load — recompute after every WBS change.',
      linkedWbs: orphanLeaves.slice(0, 6).map(t => t.wbsCode || t.id),
      owner: 'Project Manager',
      residualSeverity: 'Low',
    });
  }

  // 2. Schedule compression — > 10 tasks ending in any rolling 30-day window.
  const endDates = tasks
    .map(t => ({ t, d: toDate(t.plannedEndDate) }))
    .filter((x): x is { t: WbsTaskData; d: Date } => x.d !== null);
  if (endDates.length >= 10) {
    let worstStart: Date | null = null;
    let worstCount = 0;
    const sorted = [...endDates].sort((a, b) => a.d.getTime() - b.d.getTime());
    for (let i = 0; i < sorted.length; i++) {
      const start = sorted[i]!.d;
      let count = 0;
      for (let j = i; j < sorted.length; j++) {
        if (sorted[j]!.d.getTime() - start.getTime() <= 30 * 86400000) count++;
        else break;
      }
      if (count > worstCount) {
        worstCount = count;
        worstStart = start;
      }
    }
    if (worstCount >= 8 && worstStart) {
      const end = new Date(worstStart.getTime() + 30 * 86400000);
      rows.push({
        id: 'synth-schedule-compression',
        source: 'wbs-synth',
        category: 'schedule',
        displayName: `Schedule compression window (${worstCount} tasks in 30 days)`,
        description: `A peak of ${worstCount} task completions falls between ${shortDate(worstStart)} and ${shortDate(end)}. Any slippage cascades to the gate milestone.`,
        probIdx: worstCount >= 14 ? 3 : 2,
        impactIdx: worstCount >= 14 ? 3 : 2,
        severityLabel: severityFromIdx(worstCount >= 14 ? 3 : 2, worstCount >= 14 ? 3 : 2),
        mitigation: 'Stagger acceptance reviews, pre-book QA / governance capacity for the window, lock dependencies one sprint ahead.',
        trigger: `Window start ${shortDate(worstStart)}`,
        owner: 'Scheduler / PMO',
        residualSeverity: 'Medium',
      });
    }
  }

  // 3. Budget concentration — any month takes > 25% of approved budget.
  if (approvedBudget > 0) {
    const monthlyBuckets = new Map<string, number>();
    for (const t of tasks) {
      const d = toDate(t.plannedEndDate);
      const pc = Number(t.plannedCost ?? 0);
      if (!d || !pc) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyBuckets.set(key, (monthlyBuckets.get(key) ?? 0) + pc);
    }
    let worstKey = '';
    let worstAmount = 0;
    for (const [k, v] of monthlyBuckets) {
      if (v > worstAmount) {
        worstAmount = v;
        worstKey = k;
      }
    }
    const pct = worstAmount / approvedBudget;
    if (pct >= 0.25) {
      rows.push({
        id: 'synth-cost-concentration',
        source: 'wbs-synth',
        category: 'cost',
        displayName: `Cashflow concentration in ${worstKey}`,
        description: `${(pct * 100).toFixed(0)}% of the approved budget (AED ${worstAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}) lands in a single month, stressing treasury and invoice throughput.`,
        probIdx: 3,
        impactIdx: pct >= 0.4 ? 3 : 2,
        severityLabel: severityFromIdx(3, pct >= 0.4 ? 3 : 2),
        mitigation: 'Renegotiate payment milestones, split acceptance events across consecutive months, or increase commitment ceiling with finance.',
        trigger: `Month ${worstKey} entered`,
        owner: 'Finance Director',
        residualSeverity: pct >= 0.4 ? 'Medium' : 'Low',
      });
    }
  }

  // 4. Deliverable acceptance quality — deliverables without acceptance criteria.
  const deliverables = tasks.filter(t => t.taskType === 'deliverable');
  const deliverablesMissingAcceptance = deliverables.filter(d => {
    const raw = (d as unknown as { acceptanceCriteria?: unknown }).acceptanceCriteria;
    return !raw || (Array.isArray(raw) && raw.length === 0);
  });
  if (deliverables.length > 0 && deliverablesMissingAcceptance.length / deliverables.length >= 0.5) {
    rows.push({
      id: 'synth-quality-acceptance',
      source: 'wbs-synth',
      category: 'quality',
      displayName: 'Deliverables missing acceptance criteria',
      description: `${deliverablesMissingAcceptance.length} of ${deliverables.length} deliverables have no recorded acceptance criteria. Payment events cannot be verified objectively.`,
      probIdx: 3,
      impactIdx: 3,
      severityLabel: 'Critical',
      mitigation: 'Define SMART acceptance criteria per deliverable before baseline lock. Block gate sign-off until every deliverable is covered.',
      trigger: 'Baseline lock attempt',
      linkedWbs: deliverablesMissingAcceptance.slice(0, 5).map(d => d.wbsCode || d.id),
      owner: 'Quality Lead',
      residualSeverity: 'Medium',
    });
  }

  // 5. Dependency fan-in — any single task is a predecessor of > 4 successors.
  const successorCount = new Map<string, number>();
  for (const t of tasks) {
    const preds = (t as unknown as { predecessors?: Array<{ taskId?: string }> }).predecessors;
    if (Array.isArray(preds)) {
      for (const p of preds) {
        if (p?.taskId) successorCount.set(p.taskId, (successorCount.get(p.taskId) ?? 0) + 1);
      }
    }
  }
  const hotspots = Array.from(successorCount.entries()).filter(([, n]) => n >= 4);
  if (hotspots.length > 0) {
    const names = hotspots
      .map(([id]) => tasks.find(t => t.id === id))
      .filter((t): t is WbsTaskData => Boolean(t))
      .slice(0, 3);
    rows.push({
      id: 'synth-technical-fanin',
      source: 'wbs-synth',
      category: 'technical',
      displayName: 'Single point of failure on critical dependency',
      description: `${hotspots.length} task${hotspots.length > 1 ? 's are' : ' is a'} predecessor to 4+ downstream items (e.g. ${names.map(n => n.taskName).join(', ') || '—'}). Any slip blocks a large surface.`,
      probIdx: 2,
      impactIdx: 3,
      severityLabel: 'High',
      mitigation: 'Add parallel work-arounds, create mock/stub interfaces for downstream teams, assign a dedicated unblocker to each hotspot.',
      trigger: 'Hotspot task slips more than 3 days',
      linkedWbs: names.map(n => n.wbsCode || n.id),
      owner: 'Technical Lead',
      residualSeverity: 'Medium',
    });
  }

  // 6. Resource allocation — tasks without an assignee.
  const unassigned = tasks.filter(t => t.taskType === 'task' && !(t as unknown as { assignedTo?: string }).assignedTo);
  if (unassigned.length > 0 && unassigned.length / Math.max(1, leafTasks.length) >= 0.3) {
    rows.push({
      id: 'synth-resource-unassigned',
      source: 'wbs-synth',
      category: 'resource',
      displayName: 'High share of unassigned work packages',
      description: `${unassigned.length} of ${leafTasks.length} leaf tasks (${((unassigned.length / leafTasks.length) * 100).toFixed(0)}%) have no named owner. Delivery capacity cannot be validated.`,
      probIdx: 3,
      impactIdx: 2,
      severityLabel: 'High',
      mitigation: 'Assign a named owner per work package before baseline lock. Confirm FTE commitments with resource managers.',
      trigger: 'Planning sign-off',
      owner: 'Resource Manager',
      residualSeverity: 'Low',
    });
  }

  // 7. Gate cadence — project spans > 12 months with no intermediate milestones.
  const milestones = tasks.filter(t => t.taskType === 'milestone');
  const allDates = endDates.map(e => e.d);
  if (allDates.length > 0) {
    const min = Math.min(...allDates.map(d => d.getTime()));
    const max = Math.max(...allDates.map(d => d.getTime()));
    const months = (max - min) / (30.5 * 86400000);
    if (months >= 12 && milestones.length < Math.floor(months / 3)) {
      rows.push({
        id: 'synth-governance-cadence',
        source: 'wbs-synth',
        category: 'governance',
        displayName: 'Insufficient gate cadence for project duration',
        description: `Project spans ${months.toFixed(0)} months with only ${milestones.length} milestone${milestones.length === 1 ? '' : 's'}. Recommended: 1 governance milestone every 3 months.`,
        probIdx: 3,
        impactIdx: 2,
        severityLabel: 'High',
        mitigation: 'Insert quarterly steering-committee checkpoints, tie each to a stage-gate deliverable with go / no-go criteria.',
        trigger: 'Baseline lock review',
        owner: 'Project Manager',
        residualSeverity: 'Low',
      });
    }
  }

  // 8. Long-duration work packages — any task > 45 days.
  const longTasks = tasks.filter(t => {
    const s = toDate(t.plannedStartDate);
    const e = toDate(t.plannedEndDate);
    if (!s || !e) return false;
    return (e.getTime() - s.getTime()) / 86400000 > 45;
  });
  if (longTasks.length > 0) {
    rows.push({
      id: 'synth-scope-longtasks',
      source: 'wbs-synth',
      category: 'scope',
      displayName: 'Long-running work packages (> 45 days)',
      description: `${longTasks.length} task${longTasks.length === 1 ? '' : 's'} exceed 45 calendar days. Progress tracking and change control accuracy degrade.`,
      probIdx: 2,
      impactIdx: 2,
      severityLabel: 'Medium',
      mitigation: 'Decompose into ≤ 2-week work packages with weekly status evidence. Reserve 10% float for re-baselining.',
      trigger: 'Task duration > 45 days',
      linkedWbs: longTasks.slice(0, 5).map(t => t.wbsCode || t.id),
      owner: 'Scheduler',
      residualSeverity: 'Low',
    });
  }

  return rows;
}

// ────────────────────────────────────────────────────────────────────
function unifiedToRegisterRow(risk: UnifiedRisk, idx: number): RegisterRow {
  const text = `${risk.displayName} ${risk.description ?? ''}`;
  const category = inferCategory(text);
  const fromBusinessCase = (risk.sources ?? []).some(s => !s.startsWith('demand:'));
  return {
    id: `${fromBusinessCase ? 'init' : 'demand'}-${idx}`,
    source: 'initiation',
    category,
    displayName: risk.displayName,
    description: risk.description,
    probIdx: risk.probIdx,
    impactIdx: risk.impactIdx,
    severityLabel: risk.severityLabel,
    mitigation: risk.mitigation,
    contingency: risk.contingency,
    owner: risk.category || 'Sponsor',
    trigger: fromBusinessCase ? 'Approved in business case' : 'Identified in demand analysis',
  };
}

/**
 * Apply the persisted override for a row, then fill residual + AI-suggested
 * mitigation due date if not already set. Deterministic so the UI stays stable.
 */
function enrichRow(row: RegisterRow, override: RiskOverride | undefined, tasks: WbsTaskData[]): RegisterRow {
  const merged: RegisterRow = { ...row, ...(override ?? {}) };
  // Re-compute severity if prob/impact changed via override.
  if (override?.probIdx !== undefined || override?.impactIdx !== undefined) {
    merged.severityLabel = override?.severityLabel ?? severityFromIdx(merged.probIdx, merged.impactIdx);
  }
  // Fill residual when mitigation is present and override didn't set it.
  if (!merged.residualSeverity) {
    merged.residualSeverity = computeResidualSeverity(merged.probIdx, merged.impactIdx, merged.mitigation);
  }
  // Fill AI-suggested due date only when the row has no date at all.
  if (!merged.mitigationDueDate) {
    const suggested = suggestMitigationDueDate(merged.severityLabel, merged.category, tasks);
    if (suggested) {
      merged.mitigationDueDate = suggested;
      merged.mitigationDueDateSuggested = true;
    }
  }
  if (!merged.linkedWbs || merged.linkedWbs.length === 0) {
    merged.linkedWbs = inferLinkedWbs(merged, tasks);
  }
  return merged;
}

function formatDue(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return iso;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  if (days < 0) return `${label} · ${Math.abs(days)}d overdue`;
  if (days === 0) return `${label} · today`;
  if (days <= 60) return `${label} · in ${days}d`;
  return label;
}

function dueTone(iso: string | undefined): string {
  if (!iso) return 'text-slate-400';
  const d = new Date(iso + 'T00:00:00Z');
  const today = new Date(); today.setHours(0,0,0,0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days < 0) return 'text-red-600 dark:text-red-400 font-semibold';
  if (days <= 14) return 'text-orange-600 dark:text-orange-400 font-medium';
  if (days <= 45) return 'text-amber-600 dark:text-amber-400';
  return 'text-slate-600 dark:text-slate-300';
}

// ────────────────────────────────────────────────────────────────────
export function RiskRegisterPlanning({
  businessCase,
  demandReport,
  tasks,
  approvedBudget = 0,
  projectId = 'default',
  approval = null,
  onSubmitForApproval,
  isSubmitting = false,
}: RiskRegisterPlanningProps) {
  // Persisted state — overrides keyed by risk id, plus user-added rows.
  const [overrides, setOverrides] = useState<Record<string, RiskOverride>>({});
  const [userRows, setUserRows] = useState<RegisterRow[]>([]);
  useEffect(() => {
    const loaded = loadPersisted(projectId);
    setOverrides(loaded.overrides);
    setUserRows(loaded.userRows);
  }, [projectId]);
  useEffect(() => {
    savePersisted(projectId, { overrides, userRows });
  }, [projectId, overrides, userRows]);

  const initiationRisks = useMemo(() => {
    const unified = collectBusinessCaseRisks(businessCase ?? undefined, demandReport);
    return unified.map(unifiedToRegisterRow);
  }, [businessCase, demandReport]);

  const synthesizedRisks = useMemo(
    () => synthesizeWbsRisks(tasks ?? [], approvedBudget),
    [tasks, approvedBudget],
  );

  const allRows = useMemo(() => {
    const base = [...initiationRisks, ...synthesizedRisks, ...userRows];
    const enriched = base.map(r => enrichRow(r, overrides[r.id], tasks ?? []));
    return enriched.sort((a, b) => SEVERITY_ORDER[b.severityLabel] - SEVERITY_ORDER[a.severityLabel]);
  }, [initiationRisks, synthesizedRisks, userRows, overrides, tasks]);

  const [filterSource, setFilterSource] = useState<'all' | 'initiation' | 'wbs-synth' | 'user-added'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | RiskCategory>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter(r => {
      if (filterSource !== 'all' && r.source !== filterSource) return false;
      if (filterCategory !== 'all' && r.category !== filterCategory) return false;
      if (q) {
        const hay = `${r.displayName} ${r.description ?? ''} ${r.mitigation ?? ''} ${r.owner ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, filterSource, filterCategory, search]);

  const stats = useMemo(() => {
    const s = { Critical: 0, High: 0, Medium: 0, Low: 0 } as Record<RegisterRow['severityLabel'], number>;
    for (const r of allRows) s[r.severityLabel]++;
    return s;
  }, [allRows]);

  const coverage = useMemo(() => {
    const cats = new Set(allRows.map(r => r.category));
    return cats.size;
  }, [allRows]);

  // Edit dialog state
  const [editing, setEditing] = useState<RegisterRow | null>(null);
  const [adding, setAdding] = useState(false);

  const saveRowEdit = (rowId: string, patch: RiskOverride): void => {
    if (rowId.startsWith('user-')) {
      setUserRows(prev => prev.map(r => (r.id === rowId ? { ...r, ...patch, severityLabel: patch.severityLabel ?? severityFromIdx(patch.probIdx ?? r.probIdx, patch.impactIdx ?? r.impactIdx) } : r)));
    } else {
      setOverrides(prev => ({ ...prev, [rowId]: { ...(prev[rowId] ?? {}), ...patch } }));
    }
  };

  const resetRow = (rowId: string): void => {
    if (rowId.startsWith('user-')) return; // user rows reset via delete
    setOverrides(prev => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  const deleteUserRow = (rowId: string): void => {
    setUserRows(prev => prev.filter(r => r.id !== rowId));
  };

  const addUserRow = (row: Omit<RegisterRow, 'id' | 'source' | 'severityLabel'>): void => {
    const id = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const severityLabel = severityFromIdx(row.probIdx, row.impactIdx);
    setUserRows(prev => [...prev, { ...row, id, source: 'user-added', severityLabel }]);
  };

  // ─── Approval workflow ─────────────────────────────────────────────
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitNotes, setSubmitNotes] = useState('');
  const approvalStatus = approval?.status ?? null;

  const handleConfirmSubmit = async (): Promise<void> => {
    if (!onSubmitForApproval) return;
    // Build compact snapshot (drop UI-only fields, keep audit-relevant).
    const snapshotRows = allRows.map(r => ({
      id: r.id, source: r.source, name: r.displayName, description: r.description,
      category: r.category, probIdx: r.probIdx, impactIdx: r.impactIdx,
      severity: r.severityLabel, residualSeverity: r.residualSeverity,
      mitigation: r.mitigation, contingency: r.contingency, trigger: r.trigger,
      owner: r.owner, mitigationDueDate: r.mitigationDueDate, linkedWbs: r.linkedWbs,
      notes: r.notes,
    }));
    const snapStats = {
      total: allRows.length,
      critical: stats.Critical,
      high: stats.High,
      medium: stats.Medium,
      low: stats.Low,
      categoriesCovered: coverage,
    };
    await onSubmitForApproval({
      snapshot: { rows: snapshotRows, generatedAt: new Date().toISOString() },
      stats: snapStats,
      notes: submitNotes.trim() || undefined,
    });
    setShowSubmitDialog(false);
    setSubmitNotes('');
  };

  return (
    <div className="space-y-4">
      {/* COREVIA Insight header */}
      <Card className="relative overflow-hidden border-slate-200 dark:border-slate-700 bg-gradient-to-br from-indigo-50 via-white to-white dark:from-indigo-500/10 dark:via-slate-900 dark:to-slate-900">
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <CardContent className="relative flex flex-wrap items-center gap-4 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-5 gap-1 border-indigo-300 bg-indigo-50 px-1.5 text-[9px] uppercase tracking-[0.14em] text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                <Sparkles className="h-2.5 w-2.5" /> COREVIA
              </Badge>
              <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                Comprehensive Risk Register — {allRows.length} risk{allRows.length === 1 ? '' : 's'} across {coverage} categor{coverage === 1 ? 'y' : 'ies'}
              </h3>
            </div>
            <p className="mt-0.5 text-[11.5px] leading-tight text-slate-600 dark:text-slate-300">
              {initiationRisks.length} approved in Initiation · {synthesizedRisks.length} synthesized from WBS · {userRows.length} added manually. Mitigation dates are AI-suggested from the WBS plan unless you override them.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SeverityPill label="Critical" count={stats.Critical} tone="bg-red-500/20 text-red-700 border-red-500/30 dark:text-red-300" />
            <SeverityPill label="High" count={stats.High} tone="bg-orange-500/20 text-orange-700 border-orange-500/30 dark:text-orange-300" />
            <SeverityPill label="Medium" count={stats.Medium} tone="bg-amber-500/20 text-amber-700 border-amber-500/30 dark:text-amber-300" />
            <SeverityPill label="Low" count={stats.Low} tone="bg-emerald-500/20 text-emerald-700 border-emerald-500/30 dark:text-emerald-300" />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
        <Filter className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Filter</span>
        <SegButton active={filterSource === 'all'} onClick={() => setFilterSource('all')}>All</SegButton>
        <SegButton active={filterSource === 'initiation'} onClick={() => setFilterSource('initiation')}>
          <FileCheck2 className="h-3 w-3" /> Initiation ({initiationRisks.length})
        </SegButton>
        <SegButton active={filterSource === 'wbs-synth'} onClick={() => setFilterSource('wbs-synth')}>
          <Brain className="h-3 w-3" /> COREVIA ({synthesizedRisks.length})
        </SegButton>
        <SegButton active={filterSource === 'user-added'} onClick={() => setFilterSource('user-added')}>
          <User className="h-3 w-3" /> Manual ({userRows.length})
        </SegButton>
        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value as typeof filterCategory)}
          className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11.5px] dark:border-slate-700 dark:bg-slate-800"
          data-testid="risk-filter-category"
        >
          <option value="all">All categories</option>
          {(Object.keys(CATEGORY_META) as RiskCategory[]).map(k => (
            <option key={k} value={k}>{CATEGORY_META[k].label}</option>
          ))}
        </select>
        <Input
          placeholder="Search risk, mitigation, owner…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ml-auto h-7 w-56 text-[11.5px]"
          data-testid="risk-register-search"
        />
        <Button
          size="sm"
          className="h-7 gap-1 bg-indigo-600 px-2 text-[11px] text-white hover:bg-indigo-700"
          onClick={() => setAdding(true)}
          data-testid="risk-register-add"
        >
          <Plus className="h-3 w-3" /> Add risk
        </Button>
      </div>

      {/* Register table */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Planning Risk Register
              <Badge variant="outline" className="ml-2 h-5 px-1.5 text-[10px]">
                {filtered.length} of {allRows.length}
              </Badge>
              {(approvalStatus || onSubmitForApproval) && (
                <span
                  className={`ml-2 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                    approvalStatus === 'approved'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600/40 dark:bg-emerald-600/10 dark:text-emerald-300'
                      : approvalStatus === 'pending_review'
                        ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600/40 dark:bg-amber-600/10 dark:text-amber-300'
                        : approvalStatus === 'rejected'
                          ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-600/40 dark:bg-rose-600/10 dark:text-rose-300'
                          : 'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-600/40 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                  data-testid="risk-register-approval-status"
                >
                  <Shield className="h-3 w-3" />
                  {approvalStatus === 'approved' && 'PMO Approved'}
                  {approvalStatus === 'pending_review' && 'Awaiting PMO'}
                  {approvalStatus === 'rejected' && 'Returned for Revision'}
                  {!approvalStatus && 'Draft — not submitted'}
                  {approval?.version != null && (
                    <span className="tabular-nums opacity-80">v{approval.version}</span>
                  )}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {approvalStatus === 'approved' && approval?.reviewedAt && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Baseline frozen {new Date(approval.reviewedAt).toLocaleDateString()}
                  {approval.reviewedByName ? ` · ${approval.reviewedByName}` : ''}
                </span>
              )}
              {approvalStatus === 'pending_review' && approval?.submittedAt && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Submitted {new Date(approval.submittedAt).toLocaleDateString()}
                  {approval.submittedByName ? ` · ${approval.submittedByName}` : ''}
                </span>
              )}
              {approvalStatus === 'rejected' && approval?.rejectionReason && (
                <span
                  className="max-w-[280px] truncate text-[11px] italic text-rose-600 dark:text-rose-300"
                  title={approval.rejectionReason}
                >
                  Reason: {approval.rejectionReason}
                </span>
              )}
              {onSubmitForApproval && approvalStatus !== 'approved' && approvalStatus !== 'pending_review' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-[11px]"
                  onClick={() => setShowSubmitDialog(true)}
                  disabled={isSubmitting || allRows.length === 0}
                  data-testid="risk-register-submit-approval"
                >
                  <FileCheck2 className="h-3 w-3" /> Submit for PMO approval
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No risks match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Risk</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-left">Source</th>
                    <th className="px-3 py-2 text-center">P</th>
                    <th className="px-3 py-2 text-center">I</th>
                    <th className="px-3 py-2 text-center">Severity</th>
                    <th className="px-3 py-2 text-left">Mitigation</th>
                    <th className="px-3 py-2 text-left">Mitigation Due</th>
                    <th className="px-3 py-2 text-left">Owner</th>
                    <th className="px-3 py-2 text-center">Residual</th>
                    <th className="px-3 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filtered.map((r, i) => {
                    const CatIcon = CATEGORY_META[r.category].icon;
                    const hasOverride = Boolean(overrides[r.id]);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40" data-testid={`risk-row-${r.id}`}>
                        <td className="px-3 py-2 text-slate-400 tabular-nums">{i + 1}</td>
                        <td className="max-w-[280px] px-3 py-2">
                          <div className="font-medium text-slate-900 dark:text-white">{r.displayName}</div>
                          {r.description && (
                            <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{r.description}</div>
                          )}
                          {r.linkedWbs && r.linkedWbs.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {r.linkedWbs.slice(0, 4).map(code => (
                                <span key={code} className="inline-flex h-4 items-center rounded border border-slate-200 bg-slate-50 px-1 text-[9.5px] font-medium tabular-nums text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                  <GitBranch className="mr-0.5 h-2.5 w-2.5" /> {code}
                                </span>
                              ))}
                              {r.linkedWbs.length > 4 && (
                                <span className="text-[10px] text-slate-400">+{r.linkedWbs.length - 4}</span>
                              )}
                            </div>
                          )}
                          {r.notes && (
                            <div className="mt-1 rounded border border-dashed border-slate-200 bg-slate-50/60 px-1.5 py-0.5 text-[10px] italic text-slate-500 dark:border-slate-700 dark:bg-slate-800/40">
                              {r.notes}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_META[r.category].tone}`}>
                            <CatIcon className="h-3 w-3" />
                            {CATEGORY_META[r.category].label}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {r.source === 'wbs-synth' ? (
                            <span className="inline-flex items-center gap-1 rounded border border-indigo-300 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                              <Brain className="h-3 w-3" /> COREVIA
                            </span>
                          ) : r.source === 'user-added' ? (
                            <span className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                              <User className="h-3 w-3" /> Manual
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              <FileCheck2 className="h-3 w-3" /> Business Case
                            </span>
                          )}
                          {hasOverride && (
                            <span className="ml-1 inline-flex items-center rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300" title="Manually edited">
                              Edited
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">{r.probIdx + 1}</td>
                        <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">{r.impactIdx + 1}</td>
                        <td className="px-3 py-2 text-center">
                          <SeverityChip severity={r.severityLabel} />
                        </td>
                        <td className="max-w-[320px] px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300">
                          {r.mitigation || <span className="text-slate-400">—</span>}
                          {r.contingency && (
                            <div className="mt-1 text-[10.5px] text-amber-700 dark:text-amber-300"><span className="font-semibold">Contingency: </span>{r.contingency}</div>
                          )}
                          {r.trigger && (
                            <div className="mt-0.5 text-[10px] text-slate-400">Trigger: {r.trigger}</div>
                          )}
                        </td>
                        <td className={`px-3 py-2 text-[11px] tabular-nums ${dueTone(r.mitigationDueDate)}`}>
                          <div className="flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            <span>{formatDue(r.mitigationDueDate)}</span>
                          </div>
                          {r.mitigationDueDateSuggested && r.mitigationDueDate && (
                            <div className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] text-indigo-500" title="AI-suggested from WBS">
                              <Sparkles className="h-2.5 w-2.5" /> AI suggested
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-500">{r.owner || '—'}</td>
                        <td className="px-3 py-2 text-center">
                          {r.residualSeverity ? <SeverityChip severity={r.residualSeverity} muted /> : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => setEditing(r)}
                              title="Edit risk"
                              data-testid={`risk-edit-${r.id}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            {hasOverride && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700"
                                onClick={() => resetRow(r.id)}
                                title="Reset to AI-generated values"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            )}
                            {r.source === 'user-added' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                onClick={() => deleteUserRow(r.id)}
                                title="Delete this risk"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coverage by category */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-purple-500" />
            Risk Coverage Across Dimensions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(Object.keys(CATEGORY_META) as RiskCategory[]).map(cat => {
              const count = allRows.filter(r => r.category === cat).length;
              const Icon = CATEGORY_META[cat].icon;
              const hasCoverage = count > 0;
              return (
                <div
                  key={cat}
                  className={`flex items-center gap-2 rounded-lg border p-2 ${hasCoverage ? CATEGORY_META[cat].tone : 'border-dashed border-slate-300 bg-slate-50/40 text-slate-400 dark:border-slate-700 dark:bg-slate-800/20'}`}
                  data-testid={`risk-coverage-${cat}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-[11px] font-medium">{CATEGORY_META[cat].label}</div>
                    <div className="text-[10px] opacity-80">{count} risk{count === 1 ? '' : 's'}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {coverage < 6 && (
            <p className="mt-3 text-[11px] text-slate-500">
              <Sparkles className="mr-1 inline h-3 w-3 text-indigo-500" />
              COREVIA recommends reviewing the {(Object.keys(CATEGORY_META) as RiskCategory[]).filter(c => !allRows.some(r => r.category === c)).length} untouched dimensions to achieve full enterprise coverage before baseline lock.
            </p>
          )}
        </CardContent>
      </Card>

      {editing && (
        <RiskEditDialog
          row={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => { saveRowEdit(editing.id, patch); setEditing(null); }}
        />
      )}
      {adding && (
        <RiskAddDialog
          tasks={tasks ?? []}
          onClose={() => setAdding(false)}
          onAdd={(row) => { addUserRow(row); setAdding(false); }}
        />
      )}

      {/* Submit-for-approval confirmation dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={(open) => { if (!open) setShowSubmitDialog(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-indigo-600" /> Submit risk register for PMO approval
            </DialogTitle>
            <DialogDescription>
              You are submitting <span className="font-semibold text-slate-900 dark:text-white">{allRows.length} risk{allRows.length === 1 ? '' : 's'}</span> ({stats.Critical} critical, {stats.High} high, {stats.Medium} medium, {stats.Low} low) across <span className="font-semibold text-slate-900 dark:text-white">{coverage} categor{coverage === 1 ? 'y' : 'ies'}</span>. A snapshot will be frozen for auditable review and the PMO will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-[11.5px]">Submission notes (optional)</Label>
            <Textarea
              value={submitNotes}
              onChange={(e) => setSubmitNotes(e.target.value)}
              placeholder="Provide context for the PMO reviewer (e.g. critical mitigations, open dependencies)."
              rows={3}
              className="text-[12px]"
              data-testid="risk-register-submit-notes"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSubmitDialog(false)} disabled={isSubmitting}>Cancel</Button>
            <Button
              onClick={handleConfirmSubmit}
              disabled={isSubmitting || allRows.length === 0}
              className="gap-1 bg-indigo-600 text-white hover:bg-indigo-700"
              data-testid="risk-register-submit-confirm"
            >
              <FileCheck2 className="h-3.5 w-3.5" /> {isSubmitting ? 'Submitting…' : 'Confirm submission'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Edit dialog
// ────────────────────────────────────────────────────────────────────
function RiskEditDialog({ row, onClose, onSave }: {
  row: RegisterRow;
  onClose: () => void;
  onSave: (patch: RiskOverride) => void;
}) {
  const [mitigation, setMitigation] = useState(row.mitigation ?? '');
  const [contingency, setContingency] = useState(row.contingency ?? '');
  const [trigger, setTrigger] = useState(row.trigger ?? '');
  const [owner, setOwner] = useState(row.owner ?? '');
  const [dueDate, setDueDate] = useState(row.mitigationDueDate ?? '');
  const [notes, setNotes] = useState(row.notes ?? '');
  const [probIdx, setProbIdx] = useState(row.probIdx);
  const [impactIdx, setImpactIdx] = useState(row.impactIdx);
  const [residual, setResidual] = useState<RegisterRow['severityLabel'] | 'auto'>(
    row.residualSeverity ?? 'auto',
  );
  const [category, setCategory] = useState(row.category);

  const previewSeverity = severityFromIdx(probIdx, impactIdx);
  const previewResidual = residual === 'auto'
    ? computeResidualSeverity(probIdx, impactIdx, mitigation)
    : residual;

  const submit = (): void => {
    const patch: RiskOverride = {
      mitigation,
      contingency,
      trigger,
      owner,
      mitigationDueDate: dueDate || undefined,
      mitigationDueDateSuggested: dueDate === row.mitigationDueDate ? row.mitigationDueDateSuggested : false,
      notes,
      probIdx,
      impactIdx,
      severityLabel: previewSeverity,
      residualSeverity: residual === 'auto' ? computeResidualSeverity(probIdx, impactIdx, mitigation) : residual,
      category,
    };
    onSave(patch);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Edit risk
          </DialogTitle>
          <DialogDescription className="truncate">{row.displayName}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="risk-mitigation">Mitigation</Label>
            <Textarea
              id="risk-mitigation"
              value={mitigation}
              onChange={e => setMitigation(e.target.value)}
              className="min-h-[80px] text-[12px]"
              placeholder="How will this risk be actively managed?"
            />
          </div>
          <div>
            <Label htmlFor="risk-owner">Owner</Label>
            <Input id="risk-owner" value={owner} onChange={e => setOwner(e.target.value)} className="text-[12px]" placeholder="Risk owner" />
          </div>
          <div>
            <Label htmlFor="risk-due">Mitigation due date</Label>
            <Input id="risk-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="text-[12px]" />
          </div>
          <div>
            <Label htmlFor="risk-category">Category</Label>
            <select id="risk-category" value={category} onChange={e => setCategory(e.target.value as RiskCategory)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] dark:border-slate-700 dark:bg-slate-800">
              {(Object.keys(CATEGORY_META) as RiskCategory[]).map(k => <option key={k} value={k}>{CATEGORY_META[k].label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="risk-trigger">Trigger</Label>
            <Input id="risk-trigger" value={trigger} onChange={e => setTrigger(e.target.value)} className="text-[12px]" placeholder="When does this risk materialize?" />
          </div>
          <div>
            <Label htmlFor="risk-prob">Probability (1 low → 5 high)</Label>
            <select id="risk-prob" value={probIdx} onChange={e => setProbIdx(Number(e.target.value))} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] dark:border-slate-700 dark:bg-slate-800">
              {[0,1,2,3,4].map(n => <option key={n} value={n}>{n + 1} — {['Very Low','Low','Medium','High','Very High'][n]}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="risk-impact">Impact (1 low → 5 high)</Label>
            <select id="risk-impact" value={impactIdx} onChange={e => setImpactIdx(Number(e.target.value))} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] dark:border-slate-700 dark:bg-slate-800">
              {[0,1,2,3,4].map(n => <option key={n} value={n}>{n + 1} — {['Very Low','Low','Medium','High','Very High'][n]}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="risk-residual">Residual severity</Label>
            <select id="risk-residual" value={residual} onChange={e => setResidual(e.target.value as RegisterRow['severityLabel'] | 'auto')} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] dark:border-slate-700 dark:bg-slate-800">
              <option value="auto">Auto — {previewResidual} (computed)</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
          <div className="col-span-2">
            <Label htmlFor="risk-contingency">Contingency plan</Label>
            <Textarea id="risk-contingency" value={contingency} onChange={e => setContingency(e.target.value)} className="min-h-[60px] text-[12px]" placeholder="If mitigation fails, what is the fallback response?" />
          </div>
          <div className="col-span-2">
            <Label htmlFor="risk-notes">Notes</Label>
            <Textarea id="risk-notes" value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[50px] text-[12px]" placeholder="PM working notes (visible in the register)." />
          </div>
          <div className="col-span-2 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/80 p-2 text-[11px] dark:border-slate-700 dark:bg-slate-800/60">
            <div>Inherent severity: <SeverityChip severity={previewSeverity} /></div>
            <div>Residual after mitigation: <SeverityChip severity={previewResidual} muted /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} className="bg-indigo-600 text-white hover:bg-indigo-700">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────────
// Add dialog
// ────────────────────────────────────────────────────────────────────
function RiskAddDialog({ tasks, onClose, onAdd }: {
  tasks: WbsTaskData[];
  onClose: () => void;
  onAdd: (row: Omit<RegisterRow, 'id' | 'source' | 'severityLabel'>) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RiskCategory>('governance');
  const [probIdx, setProbIdx] = useState(2);
  const [impactIdx, setImpactIdx] = useState(2);
  const [mitigation, setMitigation] = useState('');
  const [contingency, setContingency] = useState('');
  const [owner, setOwner] = useState('');
  const [trigger, setTrigger] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const previewSeverity = severityFromIdx(probIdx, impactIdx);
  const suggestedDue = suggestMitigationDueDate(previewSeverity, category, tasks);

  const applySuggested = (): void => { if (suggestedDue) setDueDate(suggestedDue); };

  const submit = (): void => {
    if (!displayName.trim()) return;
    onAdd({
      displayName: displayName.trim(),
      description: description.trim() || undefined,
      category,
      probIdx,
      impactIdx,
      mitigation: mitigation.trim() || undefined,
      contingency: contingency.trim() || undefined,
      owner: owner.trim() || undefined,
      trigger: trigger.trim() || undefined,
      mitigationDueDate: dueDate || undefined,
      mitigationDueDateSuggested: Boolean(dueDate) && dueDate === suggestedDue,
      notes: notes.trim() || undefined,
      residualSeverity: computeResidualSeverity(probIdx, impactIdx, mitigation),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add new risk
          </DialogTitle>
          <DialogDescription>Captured manually and persisted on this project.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="new-risk-name">Risk title</Label>
            <Input id="new-risk-name" value={displayName} onChange={e => setDisplayName(e.target.value)} className="text-[12px]" placeholder="Short, specific risk statement" />
          </div>
          <div className="col-span-2">
            <Label htmlFor="new-risk-desc">Description</Label>
            <Textarea id="new-risk-desc" value={description} onChange={e => setDescription(e.target.value)} className="min-h-[60px] text-[12px]" />
          </div>
          <div>
            <Label htmlFor="new-risk-cat">Category</Label>
            <select id="new-risk-cat" value={category} onChange={e => setCategory(e.target.value as RiskCategory)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] dark:border-slate-700 dark:bg-slate-800">
              {(Object.keys(CATEGORY_META) as RiskCategory[]).map(k => <option key={k} value={k}>{CATEGORY_META[k].label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="new-risk-owner">Owner</Label>
            <Input id="new-risk-owner" value={owner} onChange={e => setOwner(e.target.value)} className="text-[12px]" />
          </div>
          <div>
            <Label htmlFor="new-risk-prob">Probability</Label>
            <select id="new-risk-prob" value={probIdx} onChange={e => setProbIdx(Number(e.target.value))} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] dark:border-slate-700 dark:bg-slate-800">
              {[0,1,2,3,4].map(n => <option key={n} value={n}>{n + 1} — {['Very Low','Low','Medium','High','Very High'][n]}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="new-risk-impact">Impact</Label>
            <select id="new-risk-impact" value={impactIdx} onChange={e => setImpactIdx(Number(e.target.value))} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] dark:border-slate-700 dark:bg-slate-800">
              {[0,1,2,3,4].map(n => <option key={n} value={n}>{n + 1} — {['Very Low','Low','Medium','High','Very High'][n]}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <Label htmlFor="new-risk-mit">Mitigation</Label>
            <Textarea id="new-risk-mit" value={mitigation} onChange={e => setMitigation(e.target.value)} className="min-h-[70px] text-[12px]" />
          </div>
          <div>
            <Label htmlFor="new-risk-trigger">Trigger</Label>
            <Input id="new-risk-trigger" value={trigger} onChange={e => setTrigger(e.target.value)} className="text-[12px]" />
          </div>
          <div>
            <Label htmlFor="new-risk-due">Mitigation due date</Label>
            <div className="flex items-center gap-1">
              <Input id="new-risk-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="text-[12px]" />
              {suggestedDue && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 gap-1 px-2 text-[10px]"
                  onClick={applySuggested}
                  title={`AI suggests ${formatDue(suggestedDue)}`}
                >
                  <Sparkles className="h-3 w-3 text-indigo-500" /> AI
                </Button>
              )}
            </div>
          </div>
          <div className="col-span-2">
            <Label htmlFor="new-risk-cont">Contingency</Label>
            <Textarea id="new-risk-cont" value={contingency} onChange={e => setContingency(e.target.value)} className="min-h-[50px] text-[12px]" />
          </div>
          <div className="col-span-2">
            <Label htmlFor="new-risk-notes">Notes</Label>
            <Textarea id="new-risk-notes" value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[40px] text-[12px]" />
          </div>
          <div className="col-span-2 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/80 p-2 text-[11px] dark:border-slate-700 dark:bg-slate-800/60">
            <div>Inherent severity: <SeverityChip severity={previewSeverity} /></div>
            <div>Residual after mitigation: <SeverityChip severity={computeResidualSeverity(probIdx, impactIdx, mitigation)} muted /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!displayName.trim()} className="bg-indigo-600 text-white hover:bg-indigo-700">Add risk</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SeverityPill({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1 ${tone}`}>
      <span className="text-[10px] font-medium uppercase tracking-[0.12em]">{label}</span>
      <span className="text-sm font-bold tabular-nums">{count}</span>
    </div>
  );
}

function SeverityChip({ severity, muted = false }: { severity: RegisterRow['severityLabel']; muted?: boolean }) {
  const styles: Record<RegisterRow['severityLabel'], string> = muted
    ? {
        Critical: 'bg-red-500/10 text-red-500 border-red-500/30',
        High: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
        Medium: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
        Low: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
      }
    : {
        Critical: 'bg-red-600 text-white border-red-600',
        High: 'bg-orange-500 text-white border-orange-500',
        Medium: 'bg-amber-500 text-white border-amber-500',
        Low: 'bg-emerald-500 text-white border-emerald-500',
      };
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${styles[severity]}`}>
      {severity}
    </span>
  );
}

function SegButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      size="sm"
      variant={active ? 'default' : 'ghost'}
      className="h-7 gap-1 px-2 text-[11px]"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
