import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient, isBlockedGenerationError } from '@/lib/queryClient';
import { openBlockedGenerationDialog } from '@/components/shared/BlockedGenerationDialog';
import { fetchDecision } from '@/api/brain';
import { format, parseISO } from 'date-fns';
import {
  Layers,
  CalendarDays,
  Users,
  GitBranch,
  Plus,
  Flag,
  CheckCircle2,
  Target,
  Package,
  Sparkles,
  ChevronRight,
  Calendar,
  Timer,
  ArrowRight,
  Loader2,
  Wand2,
  Clock,
  AlertCircle,
  Edit3,
  Trash2,
  Send,
  Shield,
  History,
  FileCheck,
  XCircle,
  ChevronDown,
  ChevronUp,
  Lock,
  Table2,
  Zap,
  Network,
  BarChart3,
  Link2,
  Wallet,
  UserCheck,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import HexagonLogoFrame from '@/components/shared/misc/HexagonLogoFrame';
import { CoreviaGateAssistant, CoreviaGateSignal } from '../shared/CoreviaGateAssistant';
import { PLANNING_SECTIONS } from './planningSections';
import {
  PLANNING_DELIVERABLE_TEMPLATES,
  getPlanningArtifactStatusClass,
  getPlanningArtifactStatusLabel,
  getPlanningPackageStatusClass,
  getPlanningPackageStatusLabel,
} from './PlanningPhaseTab.artifacts';
import { DependenciesView, GanttChartView, PlanningApprovalDialogs, PlanningArtifactDialogs, ResourceAlignmentView, ResourceAssignmentDialog, TaskEditForm, type PlanningArtifactDraft, type ResourcesData, type WbsTaskUpdates } from './planning';
import { CostManagementStudio } from '../planning/cost/CostManagementStudio';
import { RiskRegisterPlanning } from '../panels/RiskRegisterPlanning';
import { PlanningGateChecklist } from '../panels/PlanningGateChecklist';

import type {
  AnnualCostPlanRow,
  BusinessCaseData,
  ContractRegisterItem,
  ImplementationPhase,
  ProjectData,
  TimelineData,
  WbsTaskData,
} from '../../types';
import type {
  AnnualCostPlanDraftRow,
  AnnualCostWorkspaceRow,
  BudgetArchitectureLedgerRow,
  BusinessCaseBudgetDraft,
  ContractRegisterDraftRow,
  ContractRegisterSummary,
  CostBreakdownResult,
  CostLedgerRow,
  CostTaskFilterMode,
  CostTaskDraft,
  CostWorkspaceView,
  DeliverableBaselineDraftRow,
  DeliverableBaselineRow,
  DeliverableItem,
  DeliverableRelationshipView,
  FmCostItem,
  NormalizedDeliverable,
  NormalizedMilestone,
  PhaseItem,
  PlanningArtifactMode,
  PlanningArtifactOverride,
  PlanningArtifactSource,
  PlanningAssistantAction,
  PlanningAssistantBrief,
  PlanningPackageArtifact,
  PlanningPackageStatus,
  PlanningPhaseTabProps,
  PlanningWbsViewMode,
  RawMilestoneItem,
  TeamData,
  UserData,
  WbsGenerationProgress,
} from './PlanningPhaseTab.types';

function isNonNull<T>(value: T | null | undefined): value is T {
  return value != null;
}

function normalizePlanningKey(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') return '';
  return String(value as string | number | boolean)
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function getPlanningArtifactOverrides(bc: BusinessCaseData | null | undefined): PlanningArtifactOverride[] {
  if (!bc) return [];

  const content = (bc.content ?? {}) as Record<string, unknown>;
  const root = bc as unknown as Record<string, unknown>;
  const multiAgentMetadata =
    root.multiAgentMetadata && typeof root.multiAgentMetadata === 'object'
      ? (root.multiAgentMetadata as Record<string, unknown>)
      : undefined;
  const rawPlanningArtifacts =
    content.planningArtifacts ??
    root.planningArtifacts ??
    (multiAgentMetadata?.planningArtifacts && typeof multiAgentMetadata.planningArtifacts === 'object'
      ? multiAgentMetadata.planningArtifacts
      : undefined);
  if (!rawPlanningArtifacts || typeof rawPlanningArtifacts !== 'object') return [];

  const rawOverrides = Array.isArray((rawPlanningArtifacts as { overrides?: unknown }).overrides)
    ? (rawPlanningArtifacts as { overrides: unknown[] }).overrides
    : [];

  return rawOverrides
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const source: PlanningArtifactSource =
        item.source === 'charter' || item.source === 'phase' || item.source === 'milestone' || item.source === 'expected'
          ? item.source
          : undefined;

      return {
        originKey: typeof item.originKey === 'string' ? item.originKey.trim() : '',
        name: typeof item.name === 'string' ? item.name : undefined,
        description: typeof item.description === 'string' ? item.description : undefined,
        phase: typeof item.phase === 'string' ? item.phase : undefined,
        status:
          typeof item.status === 'string'
            ? item.status === 'approved'
              ? 'checked'
              : item.status
            : undefined,
        delivered: item.delivered === true,
        source,
        deleted: item.deleted === true,
        mode: (item.mode === 'manual' || item.mode === 'override')
          ? (item.mode as PlanningArtifactMode)
          : 'override',
      };
    })
    .filter((item) => item.originKey.length > 0);
}

function upsertPlanningArtifactOverride(
  overrides: PlanningArtifactOverride[],
  nextOverride: PlanningArtifactOverride,
): PlanningArtifactOverride[] {
  const index = overrides.findIndex((item) => item.originKey === nextOverride.originKey);
  if (index === -1) return [...overrides, nextOverride];

  const next = [...overrides];
  next[index] = {
    ...next[index],
    ...nextOverride,
  };
  return next;
}

/** Safely coerce an unknown value to a number, avoiding [object Object] stringification. */
function safeNum(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'object') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function collectDeliverableNames(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const names = items
    .map((item) => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return '';
      const candidate = item as DeliverableItem;
      return candidate.name || candidate.deliverable || candidate.title || '';
    })
    .filter((item) => item.trim().length > 0);

  return Array.from(new Set(names));
}

function extractTaskDependencyCodes(task: WbsTaskData): string[] {
  const predecessorCodes = Array.isArray(task.predecessors)
    ? task.predecessors.map((dependency) => {
        if (typeof dependency === 'string') return dependency;
        return dependency.taskCode || dependency.taskId || '';
      })
    : [];

  const dependencyCodes = Array.isArray(task.dependencies) ? task.dependencies : [];
  const metadataDependencyCodes = Array.isArray(task.metadata?.dependencies) ? task.metadata.dependencies : [];

  return Array.from(
    new Set(
      [...predecessorCodes, ...dependencyCodes, ...metadataDependencyCodes]
        .map((value) => String(value || '').trim())
        .filter((value) => value.length > 0),
    ),
  );
}

const COST_YEAR_INDICES = [0, 1, 2, 3, 4, 5] as const;

function createDraftId(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10);
  return `${prefix}-${randomId}`;
}

function parseDateYear(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.getFullYear();
}

function parseNumericInput(value: string, fallback = 0): number {
  const normalized = value.replaceAll(',', '').trim();
  if (normalized.length === 0) return fallback;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveBaseFiscalYear(
  tasks: WbsTaskData[],
  project: ProjectData,
  timelineData: TimelineData | string | undefined,
): number {
  const candidateYears = [
    parseDateYear(project.plannedStartDate),
    parseDateYear(project.startDate),
    timelineData && typeof timelineData === 'object' ? parseDateYear(timelineData.startDate) : null,
    ...tasks.flatMap((task) => [parseDateYear(task.plannedStartDate), parseDateYear(task.plannedEndDate)]),
  ].filter((year): year is number => typeof year === 'number');

  if (candidateYears.length === 0) return new Date().getFullYear();
  return Math.min(...candidateYears);
}

function buildAnnualCostPlanDraftRows(
  source: unknown,
  baseFiscalYear: number,
  fmCosts: FmCostItem[],
  approvedBudget = 0,
  wbsYearlyPlanned: number[] = [],
): AnnualCostPlanDraftRow[] {
  const persistedRows = Array.isArray(source) ? source as Array<Record<string, unknown>> : [];

  // Compute raw FM totals per year
  const rawYearTotals = COST_YEAR_INDICES.map((yearIndex) =>
    fmCosts.reduce((sum, item) => sum + safeNum(item[`year${yearIndex}`]), 0),
  );
  const rawFmTotal = rawYearTotals.reduce((s, v) => s + v, 0);
  // Scale factor so annual plan defaults sum to the approved budget, not the lifecycle total
  const budgetScale = approvedBudget > 0 && rawFmTotal > approvedBudget ? approvedBudget / rawFmTotal : 1;

  // When WBS tasks exist, use WBS planned costs as the budget target (delivery reality).
  // For years without WBS tasks, distribute any remaining budget using FM operational proportions.
  const wbsTotal = wbsYearlyPlanned.reduce((s, v) => s + v, 0);
  const hasWbsData = wbsTotal > 0;
  // After WBS years eat their share, compute what's left for non-WBS operational years
  const wbsBudget = hasWbsData ? Math.min(wbsTotal, approvedBudget) : 0;
  const remainingAfterWbs = Math.max(0, approvedBudget - wbsBudget);
  // FM operational costs for years that have no WBS (for distributing remaining budget)
  const fmOpsOnlyYears = COST_YEAR_INDICES.filter((y) => (wbsYearlyPlanned[y] || 0) === 0);
  const fmOpsRaw = fmOpsOnlyYears.reduce<number>((sum, yearIndex) => {
    const yearlyOperationalCost = fmCosts
      .filter((item) => item.category === 'operational')
      .reduce<number>((itemSum, item) => itemSum + safeNum(item[`year${yearIndex}`]), 0);

    return sum + yearlyOperationalCost;
  }, 0);
  const opsScale = remainingAfterWbs > 0 && fmOpsRaw > 0 ? remainingAfterWbs / fmOpsRaw : 0;
  // If WBS total exceeds budget, scale WBS values to fit
  const wbsScale = hasWbsData && wbsTotal > approvedBudget ? approvedBudget / wbsTotal : 1;

  return COST_YEAR_INDICES.map((yearIndex) => {
    const persisted = persistedRows.find((row) => {
      const persistedYearIndex = safeNum(row.yearIndex);
      const persistedFiscalYear = safeNum(row.fiscalYear);
      return persistedYearIndex === yearIndex || persistedFiscalYear === (baseFiscalYear + yearIndex);
    });

    const fmCostRaw = fmCosts.reduce((sum, item) => sum + safeNum(item[`year${yearIndex}`]), 0);
    const fmCapexRaw = fmCosts
      .filter((item) => item.category === 'implementation')
      .reduce((sum, item) => sum + safeNum(item[`year${yearIndex}`]), 0);
    const fmOpexRaw = fmCosts
      .filter((item) => item.category === 'operational')
      .reduce((sum, item) => sum + safeNum(item[`year${yearIndex}`]), 0);

    // Derive budget target: WBS reality for execution years, FM ops for sustainment years
    const wbsPlanned = wbsYearlyPlanned[yearIndex] || 0;
    let defaultBudget: number;
    let defaultCapex: number;
    let defaultOpex: number;
    if (hasWbsData && wbsPlanned > 0) {
      // This year has WBS tasks — budget target follows delivery reality
      defaultBudget = Math.round(wbsPlanned * wbsScale);
      // Year 0 = predominantly CAPEX, subsequent = OPEX
      defaultCapex = yearIndex === 0 ? defaultBudget : 0;
      defaultOpex = yearIndex === 0 ? 0 : defaultBudget;
    } else if (hasWbsData) {
      // No WBS tasks this year — allocate remaining budget based on FM operational proportions
      defaultBudget = Math.round(fmOpexRaw * opsScale);
      defaultCapex = 0;
      defaultOpex = defaultBudget;
    } else {
      // No WBS data at all — fall back to FM-scaled defaults
      defaultBudget = Math.round(fmCostRaw * budgetScale);
      defaultCapex = Math.round(fmCapexRaw * budgetScale);
      defaultOpex = Math.round(fmOpexRaw * budgetScale);
    }

    return {
      yearIndex,
      fiscalYear: persisted ? Math.round(safeNum(persisted.fiscalYear) || (baseFiscalYear + yearIndex)) : baseFiscalYear + yearIndex,
      budgetTarget: safeRound(persisted?.budgetTarget ?? defaultBudget),
      capexTarget: safeRound(persisted?.capexTarget ?? defaultCapex),
      opexTarget: safeRound(persisted?.opexTarget ?? defaultOpex),
      notes: typeof persisted?.notes === 'string' ? persisted.notes : '',
    };
  });
}

function buildContractRegisterDraftRows(
  source: unknown,
  fallbackRows: ContractRegisterDraftRow[],
): ContractRegisterDraftRow[] {
  if (!Array.isArray(source) || source.length === 0) return fallbackRows;

  return (source as Array<Record<string, unknown>>).map((row, index) => ({
    id: typeof row.id === 'string' && row.id.trim().length > 0 ? row.id : createDraftId(`contract-${index}`),
    contractName: typeof row.contractName === 'string' ? row.contractName : '',
    vendor: typeof row.vendor === 'string' ? row.vendor : '',
    contractType: typeof row.contractType === 'string' ? row.contractType : '',
    costClass: row.costClass === 'opex' || row.costClass === 'hybrid' ? row.costClass : 'capex',
    procurementRoute: typeof row.procurementRoute === 'string' ? row.procurementRoute : '',
    status: typeof row.status === 'string' && row.status.trim().length > 0 ? row.status : 'planned',
    startYear: safeRound(row.startYear),
    endYear: safeRound(row.endYear),
    totalValue: safeRound(row.totalValue),
    committedValue: safeRound(row.committedValue),
    invoicedValue: safeRound(row.invoicedValue),
    retentionPercent: safeRound(row.retentionPercent),
    milestone: typeof row.milestone === 'string' ? row.milestone : '',
    linkedPhase: typeof row.linkedPhase === 'string' ? row.linkedPhase : '',
    notes: typeof row.notes === 'string' ? row.notes : '',
  }));
}

function createDeliverableBaselineDraftRows(
  source: unknown,
  fallbackRows: DeliverableBaselineRow[],
): DeliverableBaselineDraftRow[] {
  const sourceRows = Array.isArray(source) ? source : [];
  const sourceMap = new Map<string, Record<string, unknown>>(
    sourceRows
      .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
      .map((row) => [String(row.key ?? ''), row]),
  );

  return fallbackRows.map((row) => {
    const existing = sourceMap.get(row.key);
    const storedBaseline = existing?.baselineAmount;
    const parsedBaseline = typeof storedBaseline === 'number'
      ? storedBaseline
      : typeof storedBaseline === 'string'
        ? parseNumericInput(storedBaseline, row.planned)
        : row.planned;

    return {
      key: row.key,
      code: row.code,
      name: row.name,
      phaseLabel: row.phaseLabel,
      fiscalLabel: row.fiscalLabel,
      taskCount: row.taskCount,
      unpricedTaskCount: row.unpricedTaskCount,
      costClass: row.costClass,
      baselineAmount: parsedBaseline > 0 ? String(Math.round(parsedBaseline)) : '',
    } satisfies DeliverableBaselineDraftRow;
  });
}

function buildSuggestedContractRegister(
  breakdown: ReturnType<typeof computeBusinessCaseCostBreakdown>,
  phaseBreakdown: CostBreakdownResult['phaseBreakdown'],
  businessCaseArchetype: string,
  baseFiscalYear: number,
  approvedBudget = 0,
): ContractRegisterDraftRow[] {
  const phaseOne = phaseBreakdown[0]?.[1]?.name || 'Mobilize & Design';
  const runPhase = phaseBreakdown[phaseBreakdown.length - 1]?.[1]?.name || 'Operate & Support';

  // Use approved budget as the ceiling for all contract values.
  // The breakdown ratios indicate how the investment decomposes,
  // but absolute values must stay within the approved budget.
  const envelopeTotal = approvedBudget > 0 ? approvedBudget : breakdown.total;
  const breakdownTotal = breakdown.implementation + breakdown.operations + breakdown.maintenance;
  const scale = breakdownTotal > 0 && envelopeTotal > 0 ? envelopeTotal / breakdownTotal : 1;

  // Implementation share — capped to approved budget proportions
  const techValue = Math.round(breakdown.implementationTechnology * scale);
  const siValue = Math.round((breakdown.implementationIntegration + breakdown.implementationPeople) * scale);
  // Operational share — remaining budget after implementation allocations
  const implTotal = techValue + siValue + Math.round(breakdown.implementationChangeManagement * scale);
  const opsEnvelope = Math.max(0, envelopeTotal - implTotal - Math.round(breakdown.contingency * scale));

  const suggestions: ContractRegisterDraftRow[] = [];

  if (techValue > 0) {
    suggestions.push({
      id: createDraftId('contract'),
      contractName: `${businessCaseArchetype} platform and equipment package`,
      vendor: '',
      contractType: 'Technology platform',
      costClass: 'capex',
      procurementRoute: 'Competitive tender',
      status: 'planned',
      startYear: String(baseFiscalYear),
      endYear: String(baseFiscalYear + 1),
      totalValue: String(techValue),
      committedValue: '',
      invoicedValue: '',
      retentionPercent: '10',
      milestone: 'Platform readiness',
      linkedPhase: phaseOne,
      notes: 'Primary capex package aligned to the technology investment line.',
    });
  }

  if (opsEnvelope > 0) {
    suggestions.push({
      id: createDraftId('contract'),
      contractName: `${businessCaseArchetype} managed operations package`,
      vendor: '',
      contractType: 'Managed service',
      costClass: 'opex',
      procurementRoute: 'Service agreement',
      status: 'planned',
      startYear: String(baseFiscalYear + 1),
      endYear: String(baseFiscalYear + 5),
      totalValue: String(opsEnvelope),
      committedValue: '',
      invoicedValue: '',
      retentionPercent: '0',
      milestone: 'Operational service commencement',
      linkedPhase: runPhase,
      notes: 'Operational budget allocation within the approved investment envelope.',
    });
  }

  return suggestions;
}

function computeAnnualCostWorkspaceRows(
  annualPlanDraft: AnnualCostPlanDraftRow[],
  baseFiscalYear: number,
  tasks: WbsTaskData[],
  fmCosts: Array<Record<string, unknown>>,
  fmBenefits: Array<Record<string, unknown>>,
  contractRegisterDraft: ContractRegisterDraftRow[],
  defaultHourlyRate: number,
  parentTaskCodes: Set<string>,
  approvedBudget = 0,
): AnnualCostWorkspaceRow[] {
  const yearlyWbs = new Map<number, { planned: number; actual: number }>();
  COST_YEAR_INDICES.forEach((yearIndex) => {
    yearlyWbs.set(yearIndex, { planned: 0, actual: 0 });
  });

  tasks
    .filter((task) => !parentTaskCodes.has(task.taskCode || ''))
    .forEach((task) => {
      const taskYear = parseDateYear(task.plannedStartDate) ?? parseDateYear(task.plannedEndDate) ?? baseFiscalYear;
      const yearIndex = Math.max(0, Math.min(5, taskYear - baseFiscalYear));
      const bucket = yearlyWbs.get(yearIndex) || { planned: 0, actual: 0 };
      const plannedCost = safeNum(task.plannedCost) || safeNum(task.estimatedHours) * defaultHourlyRate;
      const actualCost = safeNum(task.actualCost) || safeNum(task.actualHours) * defaultHourlyRate;
      yearlyWbs.set(yearIndex, {
        planned: bucket.planned + plannedCost,
        actual: bucket.actual + actualCost,
      });
    });

  const yearlyContracts = new Map<number, { committed: number; invoiced: number }>();
  COST_YEAR_INDICES.forEach((yearIndex) => {
    yearlyContracts.set(yearIndex, { committed: 0, invoiced: 0 });
  });

  contractRegisterDraft.forEach((contract) => {
    const startYear = Math.max(baseFiscalYear, parseNumericInput(contract.startYear, baseFiscalYear));
    const endYear = Math.max(startYear, parseNumericInput(contract.endYear, startYear));
    const startIndex = Math.max(0, Math.min(5, startYear - baseFiscalYear));
    const endIndex = Math.max(startIndex, Math.min(5, endYear - baseFiscalYear));
    const activeYears = Math.max(1, endIndex - startIndex + 1);
    const committedShare = parseNumericInput(contract.committedValue) / activeYears;
    const invoicedShare = parseNumericInput(contract.invoicedValue) / activeYears;

    for (let yearIndex = startIndex; yearIndex <= endIndex; yearIndex += 1) {
      const bucket = yearlyContracts.get(yearIndex) || { committed: 0, invoiced: 0 };
      yearlyContracts.set(yearIndex, {
        committed: bucket.committed + committedShare,
        invoiced: bucket.invoiced + invoicedShare,
      });
    }
  });

  return annualPlanDraft.map((row) => {
    const fmCostRaw = fmCosts.reduce((sum, item) => sum + safeNum(item[`year${row.yearIndex}`]), 0);
    const fmCapexRaw = fmCosts
      .filter((item) => item.category === 'implementation')
      .reduce((sum, item) => sum + safeNum(item[`year${row.yearIndex}`]), 0);
    const fmOpexRaw = fmCosts
      .filter((item) => item.category === 'operational')
      .reduce((sum, item) => sum + safeNum(item[`year${row.yearIndex}`]), 0);
    const fmBenefitsYear = fmBenefits.reduce((sum, item) => sum + safeNum(item[`year${row.yearIndex}`]), 0);
    // Scale FM costs so they sum to the approved budget, not the lifecycle total
    const rawFmTotal = fmCosts.reduce((sum, item) => {
      return sum + COST_YEAR_INDICES.reduce<number>((yearSum, yearIndex) => yearSum + safeNum(item[`year${yearIndex}`]), 0);
    }, 0);
    const fmScale = approvedBudget > 0 && rawFmTotal > approvedBudget ? approvedBudget / rawFmTotal : 1;
    const fmCost = Math.round(fmCostRaw * fmScale);
    const fmCapex = Math.round(fmCapexRaw * fmScale);
    const fmOpex = Math.round(fmOpexRaw * fmScale);
    const wbsYear = yearlyWbs.get(row.yearIndex) || { planned: 0, actual: 0 };
    const contractYear = yearlyContracts.get(row.yearIndex) || { committed: 0, invoiced: 0 };
    const budgetTarget = parseNumericInput(row.budgetTarget, fmCost);

    return {
      yearIndex: row.yearIndex,
      fiscalYear: row.fiscalYear || (baseFiscalYear + row.yearIndex),
      budgetTarget,
      capexTarget: parseNumericInput(row.capexTarget, fmCapex),
      opexTarget: parseNumericInput(row.opexTarget, fmOpex),
      fmCost,
      fmCapex,
      fmOpex,
      fmBenefits: fmBenefitsYear,
      wbsPlanned: wbsYear.planned,
      wbsActual: wbsYear.actual,
      contractCommitted: contractYear.committed,
      contractInvoiced: contractYear.invoiced,
      remainingCapacity: budgetTarget - Math.max(wbsYear.planned, contractYear.committed),
      notes: row.notes,
    };
  });
}

function computeContractRegisterSummary(contractRegisterDraft: ContractRegisterDraftRow[]): ContractRegisterSummary {
  return contractRegisterDraft.reduce<ContractRegisterSummary>((summary, contract) => {
    const totalValue = parseNumericInput(contract.totalValue);
    const committedValue = parseNumericInput(contract.committedValue);
    const invoicedValue = parseNumericInput(contract.invoicedValue);
    const status = contract.status.trim().toLowerCase();

    return {
      totalValue: summary.totalValue + totalValue,
      committedValue: summary.committedValue + committedValue,
      invoicedValue: summary.invoicedValue + invoicedValue,
      activeCount: summary.activeCount + (status === 'active' ? 1 : 0),
      plannedCount: summary.plannedCount + (status === 'planned' || status === 'sourcing' ? 1 : 0),
      capexValue: summary.capexValue + (contract.costClass !== 'opex' ? totalValue : 0),
      opexValue: summary.opexValue + (contract.costClass !== 'capex' ? totalValue : 0),
    };
  }, {
    totalValue: 0,
    committedValue: 0,
    invoicedValue: 0,
    activeCount: 0,
    plannedCount: 0,
    capexValue: 0,
    opexValue: 0,
  });
}

function aggregateDeliverableBaseline(rows: CostLedgerRow[]): DeliverableBaselineRow[] {
  type DeliverableAccumulator = DeliverableBaselineRow & {
    phaseSet: Set<string>;
    fiscalSet: Set<string>;
  };

  const groups = new Map<string, DeliverableAccumulator>();

  for (const row of rows) {
    const hasDeliverable = row.deliverableName.trim().length > 0;
    const key = hasDeliverable ? row.deliverableCode : `unassigned:${row.phaseName}`;
    const existing = groups.get(key);
    const group = existing ?? {
      key,
      code: hasDeliverable ? row.deliverableCode : 'UNASSIGNED',
      name: hasDeliverable ? row.deliverableName : 'Unassigned Scope',
      phaseLabel: '',
      fiscalLabel: '',
      taskCount: 0,
      planned: 0,
      actual: 0,
      variance: 0,
      unpricedTaskCount: 0,
      overrunTaskCount: 0,
      costClass: row.costClass,
      pricingCoverage: 100,
      phaseSet: new Set<string>(),
      fiscalSet: new Set<string>(),
    };

    group.taskCount += 1;
    group.planned += row.planned;
    group.actual += row.actual;
    if (row.explicitPlannedCost === 0) group.unpricedTaskCount += 1;
    if (row.hasOverrun) group.overrunTaskCount += 1;
    if (group.costClass !== row.costClass) group.costClass = 'Mixed';
    if (row.phaseName) group.phaseSet.add(row.phaseName);
    if (row.fiscalYear && row.fiscalYear !== '—') group.fiscalSet.add(row.fiscalYear);

    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => {
      const phaseNames = [...group.phaseSet];
      const fiscalYears = [...group.fiscalSet];
      return {
        key: group.key,
        code: group.code,
        name: group.name,
        phaseLabel: phaseNames.length > 0 ? phaseNames.slice(0, 2).join(' • ') : 'Planning scope',
        fiscalLabel: fiscalYears.length > 0 ? fiscalYears.join(' • ') : 'Unscheduled',
        taskCount: group.taskCount,
        planned: group.planned,
        actual: group.actual,
        variance: group.planned - group.actual,
        unpricedTaskCount: group.unpricedTaskCount,
        overrunTaskCount: group.overrunTaskCount,
        costClass: group.costClass,
        pricingCoverage: group.taskCount > 0 ? ((group.taskCount - group.unpricedTaskCount) / group.taskCount) * 100 : 100,
      } satisfies DeliverableBaselineRow;
    })
    .sort((left, right) => {
      if (left.code === 'UNASSIGNED') return 1;
      if (right.code === 'UNASSIGNED') return -1;
      return left.code.localeCompare(right.code, undefined, { numeric: true });
    });
}

function normalizeMilestones(raw: unknown): NormalizedMilestone[] {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];

  return raw.map((m: string | RawMilestoneItem, i: number) => {
    if (typeof m === 'string') {
      return { name: m, status: 'pending', deliverables: [] };
    }

    const deliverables = Array.from(new Set([
      ...(typeof m.deliverable === 'string' ? [m.deliverable] : []),
      ...collectDeliverableNames(m.deliverables),
      ...collectDeliverableNames(m.outputs),
    ].filter((item) => item.trim().length > 0)));

    return {
      name: m.name || m.title || `Milestone ${i + 1}`,
      date: m.date || m.targetDate,
      description: m.description,
      deliverable: m.deliverable,
      deliverables,
      phase: m.phase || m.workstream || m.stream,
      status: m.status,
      completed: m.completed || m.status === 'completed',
    };
  });
}

function extractAllDeliverables(bc: BusinessCaseData | null | undefined): NormalizedDeliverable[] {
  if (!bc) return [];

  const deliverables: NormalizedDeliverable[] = [];
  const seen = new Set<string>();
  const bcMeta = bc as unknown as Record<string, unknown>;
  const implementationPlan = bcMeta.implementationPlan as Record<string, unknown> | undefined;
  const planningArtifactOverrides = getPlanningArtifactOverrides(bc);
  const overrideByOriginKey = new Map(planningArtifactOverrides.map((item) => [item.originKey, item]));

  const addDeliverable = (item: NormalizedDeliverable, originKey: string) => {
    const override = overrideByOriginKey.get(originKey);
    if (override?.deleted) return;

    const merged: NormalizedDeliverable = {
      ...item,
      name: override?.name || item.name,
      description: override?.description ?? item.description,
      phase: override?.phase ?? item.phase,
      status: override?.status ?? item.status,
      delivered: override?.delivered ?? item.delivered,
      source: override?.source ?? item.source,
    };

    const key = merged.name.toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      deliverables.push(merged);
    }
  };

  const processDeliverableArray = (arr: Array<string | DeliverableItem>, phaseName?: string, source: NormalizedDeliverable['source'] = 'charter') => {
    if (!Array.isArray(arr)) return;
    arr.forEach((del: string | DeliverableItem) => {
      const name = typeof del === 'string' ? del : (del.name || del.deliverable || del.title);
      if (name) {
        addDeliverable({
          name,
          description: typeof del === 'object' ? (del.description || del.details) : undefined,
          phase: phaseName || (typeof del === 'object' ? (del.phase || del.milestone) : undefined),
          status: typeof del === 'object' ? (del.status || 'pending') : 'pending',
          delivered: typeof del === 'object' ? (del.delivered || del.status === 'completed') : false,
          source
        }, normalizePlanningKey(name));
      }
    });
  };

  // 1. Top-level deliverables
  const topLevel = bc.deliverables || bc.keyDeliverables || [];
  processDeliverableArray(topLevel, undefined, 'charter');

  // 2. Expected deliverables
  const expectedRaw = bc.expectedDeliverables || bc.content?.expectedDeliverables || [];
  const expected = Array.isArray(expectedRaw) ? expectedRaw : [];
  processDeliverableArray(expected, undefined, 'expected');

  // 3. Scope definition deliverables
  const scopeRaw = bcMeta.scopeDefinition;
  const scopeDeliverables = (scopeRaw && typeof scopeRaw === 'object' && 'deliverables' in scopeRaw)
    ? (scopeRaw as { deliverables?: string[] }).deliverables || []
    : [];
  processDeliverableArray(scopeDeliverables, undefined, 'charter');

  // 4. Phase-level deliverables
  const phases =
    bc.implementationPhases ||
    (implementationPlan?.phases as ImplementationPhase[] | undefined) ||
    (bcMeta.phases as ImplementationPhase[] | undefined) ||
    [];
  if (Array.isArray(phases)) {
    phases.forEach((phase: ImplementationPhase | PhaseItem) => {
      const phaseName = phase.phase || phase.name || phase.title;
      const phaseDeliverables = phase.deliverables || (phase as PhaseItem).outputs || (phase as PhaseItem).keyDeliverables || [];
      processDeliverableArray(phaseDeliverables, phaseName, 'phase');
    });
  }

  // 5. Milestone deliverables
  const milestones =
    bc.milestones ||
    (implementationPlan?.milestones as RawMilestoneItem[] | undefined) ||
    (bcMeta.milestones as RawMilestoneItem[] | undefined) ||
    [];
  if (Array.isArray(milestones)) {
    milestones.forEach((m: RawMilestoneItem) => {
      const milestoneName = m.name || m.milestone || m.title;
      // Add the milestone itself as a deliverable if it has a name
      if (milestoneName) {
        addDeliverable({
          name: milestoneName,
          description: m.description,
          status: m.status || 'pending',
          delivered: m.completed || m.status === 'completed',
          source: 'milestone'
        }, normalizePlanningKey(milestoneName));
      }
      // Add any nested deliverables within the milestone
      const mDeliverables = m.deliverables || m.outputs || [];
      processDeliverableArray(mDeliverables, milestoneName, 'milestone');
    });
  }

  planningArtifactOverrides
    .filter((item) => item.mode === 'manual' && !item.deleted)
    .forEach((item) => {
      addDeliverable({
        name: item.name || item.originKey,
        description: item.description,
        phase: item.phase || 'Planning',
        status: item.status || 'pending',
        delivered: item.delivered || false,
        source: item.source || 'charter',
      }, item.originKey);
    });

  return deliverables;
}

const LineageTag = ({ source, field }: { source: string; field: string }) => (
  <Badge variant="outline" className="text-[10px] gap-1 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
    <Layers className="w-2.5 h-2.5" />
    {source} → {field}
  </Badge>
);

// ── Extracted helpers to reduce main-function cognitive complexity ──────────

function computeResourceAnalysis(tasks: WbsTaskData[]) {
  const workloadMap = new Map<string, { taskCount: number; totalHours: number; taskNames: string[] }>();

  tasks.forEach(task => {
    const assignedNames = task.assignedTo ? task.assignedTo.split(',').map(s => s.trim()) : [];
    const hours = Number.parseFloat(task.estimatedHours?.toString() || '0') || 0;

    assignedNames.forEach(name => {
      if (!name) return;
      const existing = workloadMap.get(name) || { taskCount: 0, totalHours: 0, taskNames: [] };
      workloadMap.set(name, {
        taskCount: existing.taskCount + 1,
        totalHours: existing.totalHours + hours,
        taskNames: [...existing.taskNames, task.title || task.taskName || 'Unnamed']
      });
    });
  });

  const getMatchScore = (resourceName: string, resourceDept: string | undefined, task: WbsTaskData | null): number => {
    if (!task) return 50;
    const taskTitle = (task.title || task.taskName || '').toLowerCase();
    const taskDesc = (task.description || '').toLowerCase();
    const dept = (resourceDept || '').toLowerCase();

    let score = 60;

    const techKeywords = ['development', 'technical', 'system', 'integration', 'api', 'database', 'infrastructure', 'testing', 'code'];
    const techDepts = ['it', 'technology', 'engineering', 'development', 'tech'];
    if (techKeywords.some(k => taskTitle.includes(k) || taskDesc.includes(k))) {
      if (techDepts.some(d => dept.includes(d))) score += 25;
    }

    const bizKeywords = ['strategy', 'business', 'planning', 'analysis', 'requirements', 'stakeholder', 'governance'];
    const bizDepts = ['business', 'strategy', 'pmo', 'management', 'operations'];
    if (bizKeywords.some(k => taskTitle.includes(k) || taskDesc.includes(k))) {
      if (bizDepts.some(d => dept.includes(d))) score += 25;
    }

    const designKeywords = ['design', 'ux', 'ui', 'user experience', 'interface', 'prototype'];
    const designDepts = ['design', 'ux', 'creative', 'product'];
    if (designKeywords.some(k => taskTitle.includes(k) || taskDesc.includes(k))) {
      if (designDepts.some(d => dept.includes(d))) score += 25;
    }

    const workload = workloadMap.get(resourceName);
    if (!workload || workload.taskCount === 0) {
      score += 15;
    } else if (workload.taskCount <= 2) {
      score += 10;
    } else if (workload.taskCount >= 5) {
      score -= 10;
    }

    return Math.min(100, Math.max(0, score));
  };

  return { workloadMap, getMatchScore };
}

function isMilestoneTaskCheck(task: WbsTaskData): boolean {
  if (task.isMilestone || task.taskType === 'milestone') return true;
  return false;
}

function computeMilestones(rawMilestones: unknown[], tasks: WbsTaskData[]): NormalizedMilestone[] {
  const phaseNamesByCode = new Map<string, string>();
  tasks.forEach((task) => {
    const code = task.taskCode || task.wbsCode || '';
    if (!code.endsWith('.0')) return;
    phaseNamesByCode.set(code, task.title || task.taskName || code);
  });

  const taskMilestones = tasks
    .filter((task) => isMilestoneTaskCheck(task))
    .map((task) => {
      const code = task.taskCode || task.wbsCode || '';
      const phaseCode = code ? `${code.split('.')[0]}.0` : '';
      return {
        name: task.title || task.taskName || code || 'Milestone',
        date: task.plannedEndDate || task.plannedStartDate,
        description: task.description,
        phase: phaseNamesByCode.get(phaseCode),
        status: task.status,
        completed: task.status === 'completed',
        deliverables: Array.isArray(task.metadata?.deliverables) ? task.metadata.deliverables : [],
      } satisfies NormalizedMilestone;
    });

  if (taskMilestones.length > 0) {
    return taskMilestones;
  }

  return normalizeMilestones(rawMilestones);
}

function computeDeliverableRelationships(
  deliverables: NormalizedDeliverable[],
  milestones: NormalizedMilestone[],
  tasks: WbsTaskData[],
): DeliverableRelationshipView[] {
  const phaseNamesByCode = new Map<string, string>();
  tasks.forEach((task) => {
    const code = task.taskCode || task.wbsCode || '';
    if (!code.endsWith('.0')) return;
    phaseNamesByCode.set(code, task.title || task.taskName || code);
  });

  type DeliverableAccumulator = Omit<DeliverableRelationshipView, 'taskCodes'> & {
    taskCodes: Set<string>;
    linkedMilestoneKeys: Set<string>;
    sortValue: number;
  };

  const deliverableMap = new Map<string, DeliverableAccumulator>();

  const ensureDeliverable = (
    name: string,
    seed: Partial<DeliverableRelationshipView> = {},
  ): DeliverableAccumulator | null => {
    const key = normalizePlanningKey(name);
    if (!key) return null;

    let entry = deliverableMap.get(key);
    if (!entry) {
      entry = {
        key,
        name,
        description: seed.description,
        phase: seed.phase,
        status: seed.status || 'pending',
        delivered: seed.delivered || false,
        source: seed.source,
        taskCode: seed.taskCode,
        taskCount: seed.taskCount || 0,
        linkedMilestones: [],
        taskCodes: new Set<string>(),
        linkedMilestoneKeys: new Set<string>(),
        sortValue: Number.MAX_SAFE_INTEGER,
      };
      deliverableMap.set(key, entry);
    }

    if (!entry.description && seed.description) entry.description = seed.description;
    if (!entry.phase && seed.phase) entry.phase = seed.phase;
    if (!entry.source && seed.source) entry.source = seed.source;
    if (!entry.taskCode && seed.taskCode) entry.taskCode = seed.taskCode;
    if (seed.delivered) entry.delivered = true;

    const statusPriority = ['blocked', 'checked', 'approved', 'completed', 'in_progress', 'pending', 'not_started'];
    const currentStatusIndex = statusPriority.indexOf(entry.status);
    const seedStatusIndex = statusPriority.indexOf(seed.status || '');
    if (seed.status && (currentStatusIndex === -1 || (seedStatusIndex !== -1 && seedStatusIndex < currentStatusIndex))) {
      entry.status = seed.status;
    }

    if (typeof seed.taskCount === 'number') entry.taskCount = Math.max(entry.taskCount, seed.taskCount);
    return entry;
  };

  deliverables.forEach((deliverable) => {
    const entry = ensureDeliverable(deliverable.name, {
      description: deliverable.description,
      phase: deliverable.phase,
      status: deliverable.status || 'pending',
      delivered: deliverable.delivered || false,
      source: deliverable.source,
    });
    if (entry && deliverable.delivered) {
      entry.delivered = true;
    }
  });

  const milestoneTaskByName = new Map<string, WbsTaskData>();
  const milestoneTasks = tasks.filter((task) => isMilestoneTaskCheck(task));
  milestoneTasks.forEach((task) => {
    milestoneTaskByName.set(normalizePlanningKey(task.title || task.taskName || task.taskCode), task);
  });

  tasks.forEach((task) => {
    if (isMilestoneTaskCheck(task)) return;

    const taskCode = task.taskCode || task.wbsCode || '';
    const taskPhaseCode = taskCode ? `${taskCode.split('.')[0]}.0` : '';
    const phaseName = phaseNamesByCode.get(taskPhaseCode);
    const taskNames = new Set<string>();

    if (task.taskType === 'deliverable') {
      const primaryName = task.title || task.taskName;
      if (primaryName) taskNames.add(primaryName);
    }

    const metadataDeliverables = Array.isArray(task.metadata?.deliverables) ? task.metadata.deliverables : [];
    metadataDeliverables.forEach((name) => taskNames.add(name));

    taskNames.forEach((name) => {
      const entry = ensureDeliverable(name, {
        description: task.description,
        phase: phaseName,
        status: task.status,
        delivered: task.status === 'completed',
        source: task.taskType === 'deliverable' ? 'phase' : undefined,
        taskCode: task.taskType === 'deliverable' ? taskCode : undefined,
      });

      if (!entry) return;

      if (taskCode) {
        entry.taskCodes.add(taskCode);
        if (typeof task.sortOrder === 'number') {
          entry.sortValue = Math.min(entry.sortValue, task.sortOrder);
        }
      }

      entry.taskCount += 1;
      if (!entry.phase && phaseName) entry.phase = phaseName;
      if (!entry.taskCode && task.taskType === 'deliverable' && taskCode) entry.taskCode = taskCode;
    });
  });

  const addMilestoneToDeliverable = (
    deliverableName: string,
    milestone: NormalizedMilestone,
    milestoneTask?: WbsTaskData,
  ) => {
    const entry = ensureDeliverable(deliverableName, {
      phase: milestone.phase,
      source: 'milestone',
    });
    if (!entry) return;

    const milestoneKey = normalizePlanningKey(milestone.name || milestoneTask?.title || milestoneTask?.taskName);
    if (!milestoneKey || entry.linkedMilestoneKeys.has(milestoneKey)) return;

    entry.linkedMilestoneKeys.add(milestoneKey);
    entry.linkedMilestones.push({
      key: milestoneKey,
      name: milestoneTask?.title || milestoneTask?.taskName || milestone.name,
      date: milestoneTask?.plannedEndDate || milestoneTask?.plannedStartDate || milestone.date,
      status: milestoneTask?.status || milestone.status || 'pending',
      completed: milestoneTask?.status === 'completed' || milestone.completed || false,
    });
  };

  milestones.forEach((milestone) => {
    const milestoneTask = milestoneTaskByName.get(normalizePlanningKey(milestone.name));
    const milestoneTaskCode = milestoneTask?.taskCode || milestoneTask?.wbsCode || '';
    const milestonePhaseCode = milestoneTaskCode ? `${milestoneTaskCode.split('.')[0]}.0` : '';
    const milestonePhaseName = milestone.phase || phaseNamesByCode.get(milestonePhaseCode);
    const explicitDeliverables = Array.from(new Set([
      ...(typeof (milestone as unknown as Record<string, unknown>).deliverable === 'string' ? [(milestone as unknown as Record<string, unknown>).deliverable as string] : []),
      ...(milestone.deliverables || []),
    ].filter((item) => item.trim().length > 0)));

    explicitDeliverables.forEach((name) => addMilestoneToDeliverable(name, milestone, milestoneTask));

    if (explicitDeliverables.length > 0) return;

    const dependencyCodes = milestoneTask ? extractTaskDependencyCodes(milestoneTask) : [];
    if (dependencyCodes.length > 0) {
      deliverableMap.forEach((entry) => {
        const isLinked = dependencyCodes.some((dependency) => entry.taskCodes.has(dependency));
        if (isLinked) {
          addMilestoneToDeliverable(entry.name, milestone, milestoneTask);
        }
      });
    }

    if (dependencyCodes.length === 0 && (milestonePhaseName || milestonePhaseCode)) {
      deliverableMap.forEach((entry) => {
        const entryTaskCode = entry.taskCode || '';
        const entryPhaseCode = entryTaskCode ? `${entryTaskCode.split('.')[0]}.0` : '';
        const samePhaseName = milestonePhaseName
          ? normalizePlanningKey(entry.phase) === normalizePlanningKey(milestonePhaseName)
          : false;
        const samePhaseCode = milestonePhaseCode.length > 0 && entryPhaseCode === milestonePhaseCode;

        if (samePhaseName || samePhaseCode) {
          addMilestoneToDeliverable(entry.name, milestone, milestoneTask);
        }
      });
    }
  });

  return Array.from(deliverableMap.values())
    .sort((left, right) => {
      if (left.sortValue !== right.sortValue) return left.sortValue - right.sortValue;
      return left.name.localeCompare(right.name);
    })
    .map(({ taskCodes, linkedMilestoneKeys: _linkedMilestoneKeys, sortValue: _sortValue, ...entry }) => ({
      ...entry,
      taskCount: taskCodes.size,
      taskCodes: Array.from(taskCodes),
      linkedMilestones: entry.linkedMilestones.toSorted((left, right) => {
        if (!left.date && !right.date) return left.name.localeCompare(right.name);
        if (!left.date) return 1;
        if (!right.date) return -1;
        return left.date.localeCompare(right.date);
      }),
    }));
}

function computeCostBreakdown(
  tasks: WbsTaskData[],
  bc: Record<string, unknown> | undefined,
  projectApprovedBudget: number,
  projectActualSpend: number,
  totalCostEstimate: unknown,
): CostBreakdownResult {
  const budgetEstimates = (bc as any)?.budgetEstimates || (bc as any)?.financialOverview || {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  const totalBudgetSource = projectApprovedBudget || totalCostEstimate || budgetEstimates?.totalCost || 0;
  const totalBudget = safeNum(totalBudgetSource);

  let totalPlannedCost = 0;
  let totalActualCost = 0;
  let totalEstimatedHours = 0;
  let totalActualHours = 0;

  const phaseBreakdown: { [key: string]: { name: string; planned: number; actual: number; hours: number; taskCount: number } } = {};

  const priorityCosts: { [key: string]: { planned: number; actual: number; count: number } } = {
    critical: { planned: 0, actual: 0, count: 0 },
    high: { planned: 0, actual: 0, count: 0 },
    medium: { planned: 0, actual: 0, count: 0 },
    low: { planned: 0, actual: 0, count: 0 },
  };

  const statusCosts: { [key: string]: { planned: number; actual: number; count: number } } = {
    completed: { planned: 0, actual: 0, count: 0 },
    in_progress: { planned: 0, actual: 0, count: 0 },
    not_started: { planned: 0, actual: 0, count: 0 },
    blocked: { planned: 0, actual: 0, count: 0 },
  };

  const defaultHourlyRate = 250;

  const parentTaskCodes = new Set<string>();
  tasks.forEach((task: WbsTaskData) => {
    if (task.taskCode) {
      const parts = task.taskCode.split('.');
      for (let i = 1; i < parts.length; i++) {
        parentTaskCodes.add(parts.slice(0, i).join('.'));
      }
    }
  });

  const leafTasks = tasks.filter((task: WbsTaskData) => !parentTaskCodes.has(task.taskCode || ''));

  leafTasks.forEach((task) => {
    const plannedCost = safeNum(task.plannedCost);
    const actualCost = safeNum(task.actualCost);
    const estimatedHours = safeNum(task.estimatedHours);
    const actualHours = safeNum(task.actualHours);

    const effectivePlannedCost = plannedCost > 0 ? plannedCost : (estimatedHours * defaultHourlyRate);
    const effectiveActualCost = actualCost > 0 ? actualCost : (actualHours * defaultHourlyRate);

    totalPlannedCost += effectivePlannedCost;
    totalActualCost += effectiveActualCost;
    totalEstimatedHours += estimatedHours;
    totalActualHours += actualHours;

    const phaseCode = task.taskCode?.split('.')[0] || 'Unassigned';

    if (!phaseBreakdown[phaseCode]) {
      const l1Task = tasks.find((t: WbsTaskData) => {
        const taskCode = t.taskCode || '';
        return (taskCode === phaseCode || taskCode === `${phaseCode}.0`) && (t.wbsLevel || t.level) === 1;
      });
      phaseBreakdown[phaseCode] = {
        name: l1Task?.title || `Phase ${phaseCode}`,
        planned: 0,
        actual: 0,
        hours: 0,
        taskCount: 0
      };
    }
    phaseBreakdown[phaseCode].planned += effectivePlannedCost;
    phaseBreakdown[phaseCode].actual += effectiveActualCost;
    phaseBreakdown[phaseCode].hours += estimatedHours;
    phaseBreakdown[phaseCode].taskCount += 1;

    const priority = task.priority || 'medium';
    if (priorityCosts[priority]) {
      priorityCosts[priority].planned += effectivePlannedCost;
      priorityCosts[priority].actual += effectiveActualCost;
      priorityCosts[priority].count += 1;
    }

    const status = task.status || 'not_started';
    if (statusCosts[status]) {
      statusCosts[status].planned += effectivePlannedCost;
      statusCosts[status].actual += effectiveActualCost;
      statusCosts[status].count += 1;
    }
  });

  const trackedTaskActualCost = totalActualCost;
  const effectiveActualCost = projectActualSpend > 0 ? projectActualSpend : trackedTaskActualCost;
  const effectiveBudget = totalBudget > 0 ? totalBudget : totalPlannedCost;
  const variance = effectiveBudget - effectiveActualCost;
  const remainingBudget = effectiveBudget - effectiveActualCost;
  const remainingBudgetPercent = effectiveBudget > 0 ? ((remainingBudget / effectiveBudget) * 100) : 0;
  const spent = effectiveActualCost;
  const remaining = effectiveBudget - spent;
  const burnRate = trackedTaskActualCost > 0 && totalActualHours > 0 ? (trackedTaskActualCost / totalActualHours) : defaultHourlyRate;

  return {
    totalBudget: effectiveBudget,
    totalPlannedCost,
    totalActualCost: effectiveActualCost,
    trackedTaskActualCost,
    spent,
    remaining,
    variance,
    remainingBudget,
    remainingBudgetPercent,
    totalEstimatedHours,
    totalActualHours,
    phaseBreakdown: Object.entries(phaseBreakdown).sort((a, b) => Number.parseInt(a[0]) - Number.parseInt(b[0])),
    priorityCosts,
    statusCosts,
    burnRate,
    defaultHourlyRate,
    leafTaskCount: leafTasks.length,
    parentTaskCodes,
  };
}

function computeCostLedgerRows(
  tasks: WbsTaskData[],
  parentTaskCodes: Set<string>,
  defaultHourlyRate: number,
): CostLedgerRow[] {
  const phaseNameByPrefix = new Map<string, string>();
  // Map deliverable codes to their names
  const deliverableMap = new Map<string, { code: string; name: string }>();
  tasks.forEach((task) => {
    const code = task.taskCode || '';
    if (!code) return;
    if ((task.wbsLevel || task.level) === 1 || code.endsWith('.0') || task.taskType === 'phase' || (task.taskType as string) === 'summary') {
      phaseNameByPrefix.set(code.split('.')[0] || code, task.title || task.taskName || code);
    }
    if (task.taskType === 'deliverable') {
      deliverableMap.set(code, { code, name: task.title || task.taskName || code });
    }
  });

  // Determine project start year for CAPEX/OPEX classification
  const allStartDates = tasks
    .map(t => t.plannedStartDate)
    .filter((d): d is string => !!d)
    .map(d => new Date(d).getFullYear())
    .filter(y => y > 2000);
  const projectStartYear = allStartDates.length > 0 ? Math.min(...allStartDates) : new Date().getFullYear();

  // Find parent deliverable for a task code (e.g. "2.4.1" → deliverable "2.4")
  const findDeliverable = (taskCode: string): { code: string; name: string } | undefined => {
    const parts = taskCode.split('.');
    // Walk up the code hierarchy looking for a deliverable parent
    for (let i = parts.length - 1; i >= 1; i--) {
      const parentCode = parts.slice(0, i).join('.');
      const del = deliverableMap.get(parentCode);
      if (del) return del;
    }
    return undefined;
  };

  // Classify CAPEX/OPEX: Year 1 is predominantly CAPEX, subsequent years OPEX
  const classifyCostClass = (task: WbsTaskData): 'CAPEX' | 'OPEX' | 'Mixed' => {
    const startDate = task.plannedStartDate ? new Date(task.plannedStartDate) : null;
    const endDate = task.plannedEndDate ? new Date(task.plannedEndDate) : null;
    if (!startDate) return 'CAPEX'; // Default to CAPEX for unscheduled tasks
    const startYear = startDate.getFullYear();
    const endYear = endDate ? endDate.getFullYear() : startYear;
    if (endYear <= projectStartYear) return 'CAPEX';
    if (startYear > projectStartYear) return 'OPEX';
    return 'Mixed';
  };

  const getFiscalYear = (task: WbsTaskData): string => {
    const startDate = task.plannedStartDate ? new Date(task.plannedStartDate) : null;
    if (!startDate || startDate.getFullYear() < 2000) return '—';
    return `FY ${startDate.getFullYear()}`;
  };

  return tasks
    .filter((task) => !parentTaskCodes.has(task.taskCode || ''))
    .map((task) => {
      const explicitPlannedCost = safeNum(task.plannedCost);
      const explicitActualCost = safeNum(task.actualCost);
      const estimatedHours = safeNum(task.estimatedHours);
      const actualHours = safeNum(task.actualHours);
      const planned = explicitPlannedCost > 0 ? explicitPlannedCost : estimatedHours * defaultHourlyRate;
      const actual = explicitActualCost > 0 ? explicitActualCost : actualHours * defaultHourlyRate;
      const variance = planned - actual;
      const taskCode = task.taskCode || task.wbsCode || '';
      const phasePrefix = taskCode.split('.')[0] || '0';
      let forecastPressure: CostLedgerRow['forecastPressure'] = 'contained';
      if (actual > planned && planned > 0) forecastPressure = 'critical';
      else if (explicitPlannedCost === 0 && estimatedHours === 0) forecastPressure = 'watch';

      const deliverable = findDeliverable(taskCode);

      return {
        id: task.id,
        taskCode: taskCode || 'Uncoded',
        title: task.title || task.taskName || 'Untitled task',
        phaseName: phaseNameByPrefix.get(phasePrefix) || `Phase ${phasePrefix}`,
        taskType: task.taskType || 'task',
        status: task.status || 'not_started',
        priority: task.priority || 'medium',
        planned,
        actual,
        estimatedHours,
        actualHours,
        explicitPlannedCost,
        explicitActualCost,
        variance,
        plannedSource: explicitPlannedCost > 0 ? 'manual' as const : 'derived' as const,
        actualSource: explicitActualCost > 0 ? 'manual' as const : 'derived' as const,
        hasOverrun: actual > planned && actual > 0,
        forecastPressure,
        deliverableCode: deliverable?.code || taskCode,
        deliverableName: deliverable?.name || (task.taskType === 'deliverable' ? (task.title || task.taskName || taskCode) : ''),
        costClass: classifyCostClass(task),
        fiscalYear: getFiscalYear(task),
      };
    })
    .sort((left, right) => {
      if (left.hasOverrun !== right.hasOverrun) return left.hasOverrun ? -1 : 1;
      return right.planned - left.planned;
    });
}

function computeFilteredCostLedgerRows(
  costLedgerRows: CostLedgerRow[],
  costTaskFilter: CostTaskFilterMode,
  costTaskSearch: string,
): CostLedgerRow[] {
  const search = costTaskSearch.trim().toLowerCase();
  return costLedgerRows.filter((row) => {
    const matchesSearch = !search
      || row.title.toLowerCase().includes(search)
      || row.taskCode.toLowerCase().includes(search)
      || row.phaseName.toLowerCase().includes(search)
      || row.deliverableName.toLowerCase().includes(search);

    if (!matchesSearch) return false;
    if (costTaskFilter === 'review') return row.explicitPlannedCost === 0 || row.status === 'blocked';
    if (costTaskFilter === 'unpriced') return row.explicitPlannedCost === 0;
    if (costTaskFilter === 'in_flight') return row.status === 'in_progress' || row.status === 'blocked';
    return true;
  });
}

function computeBusinessCaseCostBreakdown(
  implementationCosts: Record<string, unknown>,
  operationalCosts: Record<string, unknown>,
  totalCostEstimate: unknown,
) {
  const parseAmount = (value: unknown) => safeNum(value);

  const implementationPeople = parseAmount(implementationCosts.people);
  const implementationTechnology = parseAmount(implementationCosts.technology);
  const implementationIntegration = parseAmount(implementationCosts.integration);
  const implementationChangeManagement = parseAmount(implementationCosts.changeManagement);
  const implementation = implementationPeople + implementationTechnology + implementationIntegration + implementationChangeManagement;
  const annualRunCost = parseAmount(operationalCosts.annualRunCost);
  const annualMaintenance = parseAmount(operationalCosts.maintenance);
  const annualSupport = parseAmount(operationalCosts.support);
  const operations = annualRunCost + annualSupport;
  const maintenance = annualMaintenance;
  const total = parseAmount(totalCostEstimate);
  const knownComponents = implementation + operations + maintenance;
  const contingency = total > knownComponents ? total - knownComponents : 0;

  return {
    total,
    implementation,
    operations,
    maintenance,
    contingency,
    knownComponents,
    implementationPeople,
    implementationTechnology,
    implementationIntegration,
    implementationChangeManagement,
    annualRunCost,
    annualSupport,
    annualMaintenance,
  };
}

function computeBusinessCaseBudgetArchitecture(
  businessCaseArchetype: string,
  businessCaseBudgetDraft: BusinessCaseBudgetDraft,
  breakdownTotal: number,
  costFormatter: Intl.NumberFormat,
  fmCostItems: FmCostItem[],
) {
  const total = Number.parseFloat(businessCaseBudgetDraft.totalCostEstimate) || breakdownTotal || 0;
  const parsePercent = (value: string, fallback: number) => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return parsed > 1 ? parsed / 100 : parsed;
  };
  const parseAmount = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const contingencyRate = parsePercent(businessCaseBudgetDraft.contingencyPercent, 0.1);
  const maintenanceRate = parsePercent(businessCaseBudgetDraft.maintenancePercent, 0.15);
  const adoptionRate = parsePercent(businessCaseBudgetDraft.adoptionRate, 0.75);
  const discountRate = parsePercent(businessCaseBudgetDraft.discountRate, 0.08);
  const contingencyReserve = Math.round(total * contingencyRate);

  const implementationLines = [
    { key: 'people', label: 'People', amount: parseAmount(businessCaseBudgetDraft.implementationPeople) },
    { key: 'technology', label: 'Technology', amount: parseAmount(businessCaseBudgetDraft.implementationTechnology) },
    { key: 'integration', label: 'Integration', amount: parseAmount(businessCaseBudgetDraft.implementationIntegration) },
    { key: 'change-management', label: 'Change management', amount: parseAmount(businessCaseBudgetDraft.implementationChangeManagement) },
  ];

  const operatingLines = [
    { key: 'annual-run', label: 'Annual run cost', amount: parseAmount(businessCaseBudgetDraft.operatingAnnualRunCost) },
    { key: 'maintenance', label: 'Maintenance', amount: parseAmount(businessCaseBudgetDraft.operatingMaintenance) },
    { key: 'support', label: 'Support', amount: parseAmount(businessCaseBudgetDraft.operatingSupport) },
  ];

  const implementationTotal = implementationLines.reduce((sum, line) => sum + line.amount, 0);
  const operatingTotal = operatingLines.reduce((sum, line) => sum + line.amount, 0);
  const grossArchetypeEnvelope = Math.max(0, total - (implementationTotal + operatingTotal));

  // Build archetype mapping from FM cost items (dynamic, not hardcoded)
  const fmItemTotal = (item: FmCostItem) =>
    COST_YEAR_INDICES.reduce<number>((sum, yearIndex) => sum + safeNum(item[`year${yearIndex}`]), 0);
  const implCostItems = fmCostItems.filter(c => c.category === 'implementation');
  const archetypeMappingLines = implCostItems.map((item) => ({
    key: (item.id || item.name).replace(/\s+/g, '-').toLowerCase(),
    label: item.name,
    basis: item.subcategory
      ? `${item.subcategory} — ${item.isRecurring ? 'recurring' : 'one-time'} cost`
      : (item.isRecurring ? 'Recurring cost' : 'One-time cost'),
    amount: fmItemTotal(item),
  }));

  const archetypeMappedTotal = archetypeMappingLines.reduce((sum, line) => sum + line.amount, 0);
  const archetypeResidual = Math.max(0, grossArchetypeEnvelope - archetypeMappedTotal);
  const archetypeOverage = Math.max(0, archetypeMappedTotal - grossArchetypeEnvelope);

  // Build archetype detail inputs from actual domain parameters
  const archetypeDetails = Object.entries(businessCaseBudgetDraft.domainParams).map(([label, value]) => ({
    key: label.replace(/\s+/g, '-').toLowerCase(),
    label,
    value,
    hint: '',
  }));

  return {
    total,
    archetype: businessCaseArchetype,
    contingencyRate,
    maintenanceRate,
    adoptionRate,
    discountRate,
    contingencyReserve,
    implementationLines,
    operatingLines,
    implementationTotal,
    operatingTotal,
    identifiedStructureTotal: implementationTotal + operatingTotal,
    grossArchetypeEnvelope,
    archetypeMappingLines,
    archetypeMappedTotal,
    archetypeResidual,
    archetypeOverage,
    archetypeDetails,
  };
}

type BudgetArchReturnType = ReturnType<typeof computeBusinessCaseBudgetArchitecture>;
type BizCaseBreakdownReturnType = ReturnType<typeof computeBusinessCaseCostBreakdown>;

function computeBudgetArchitectureLedgerRows(
  arch: BudgetArchReturnType,
  breakdown: BizCaseBreakdownReturnType,
): BudgetArchitectureLedgerRow[] {
  const reconciliationAmount = arch.archetypeOverage > 0
    ? -arch.archetypeOverage
    : arch.archetypeResidual;

  return [
    {
      id: 'impl-people',
      code: 'IMP-01',
      title: 'Implementation - People',
      section: 'Implementation',
      baselineAmount: breakdown.implementationPeople,
      currentAmount: arch.implementationLines.find((line) => line.key === 'people')?.amount || 0,
      variance: (arch.implementationLines.find((line) => line.key === 'people')?.amount || 0) - breakdown.implementationPeople,
      driverLabel: 'Business-case line',
      actionLabel: 'Inline edit',
      basis: 'Business-case implementation structure',
      editableField: 'implementationPeople',
    },
    {
      id: 'impl-technology',
      code: 'IMP-02',
      title: 'Implementation - Technology',
      section: 'Implementation',
      baselineAmount: breakdown.implementationTechnology,
      currentAmount: arch.implementationLines.find((line) => line.key === 'technology')?.amount || 0,
      variance: (arch.implementationLines.find((line) => line.key === 'technology')?.amount || 0) - breakdown.implementationTechnology,
      driverLabel: 'Business-case line',
      actionLabel: 'Inline edit',
      basis: 'Business-case implementation structure',
      editableField: 'implementationTechnology',
    },
    {
      id: 'impl-integration',
      code: 'IMP-03',
      title: 'Implementation - Integration',
      section: 'Implementation',
      baselineAmount: breakdown.implementationIntegration,
      currentAmount: arch.implementationLines.find((line) => line.key === 'integration')?.amount || 0,
      variance: (arch.implementationLines.find((line) => line.key === 'integration')?.amount || 0) - breakdown.implementationIntegration,
      driverLabel: 'Business-case line',
      actionLabel: 'Inline edit',
      basis: 'Business-case implementation structure',
      editableField: 'implementationIntegration',
    },
    {
      id: 'impl-change',
      code: 'IMP-04',
      title: 'Implementation - Change Management',
      section: 'Implementation',
      baselineAmount: breakdown.implementationChangeManagement,
      currentAmount: arch.implementationLines.find((line) => line.key === 'change-management')?.amount || 0,
      variance: (arch.implementationLines.find((line) => line.key === 'change-management')?.amount || 0) - breakdown.implementationChangeManagement,
      driverLabel: 'Business-case line',
      actionLabel: 'Inline edit',
      basis: 'Business-case implementation structure',
      editableField: 'implementationChangeManagement',
    },
    {
      id: 'ops-run',
      code: 'OPS-01',
      title: 'Operating - Annual Run Cost',
      section: 'Operating',
      baselineAmount: breakdown.annualRunCost,
      currentAmount: arch.operatingLines.find((line) => line.key === 'annual-run')?.amount || 0,
      variance: (arch.operatingLines.find((line) => line.key === 'annual-run')?.amount || 0) - breakdown.annualRunCost,
      driverLabel: 'Business-case line',
      actionLabel: 'Inline edit',
      basis: 'Business-case operating structure',
      editableField: 'operatingAnnualRunCost',
    },
    {
      id: 'ops-maintenance',
      code: 'OPS-02',
      title: 'Operating - Maintenance',
      section: 'Operating',
      baselineAmount: breakdown.annualMaintenance,
      currentAmount: arch.operatingLines.find((line) => line.key === 'maintenance')?.amount || 0,
      variance: (arch.operatingLines.find((line) => line.key === 'maintenance')?.amount || 0) - breakdown.annualMaintenance,
      driverLabel: 'Business-case line',
      actionLabel: 'Inline edit',
      basis: 'Business-case operating structure',
      editableField: 'operatingMaintenance',
    },
    {
      id: 'ops-support',
      code: 'OPS-03',
      title: 'Operating - Support',
      section: 'Operating',
      baselineAmount: breakdown.annualSupport,
      currentAmount: arch.operatingLines.find((line) => line.key === 'support')?.amount || 0,
      variance: (arch.operatingLines.find((line) => line.key === 'support')?.amount || 0) - breakdown.annualSupport,
      driverLabel: 'Business-case line',
      actionLabel: 'Inline edit',
      basis: 'Business-case operating structure',
      editableField: 'operatingSupport',
    },
    ...arch.archetypeMappingLines.map((line, index) => ({
      id: line.key,
      code: `AV-${String(index + 1).padStart(2, '0')}`,
      title: line.label,
      section: 'Archetype',
      baselineAmount: line.amount,
      currentAmount: line.amount,
      variance: 0,
      driverLabel: 'Archetype formula',
      actionLabel: 'Edit archetype inputs',
      basis: line.basis,
    })),
    {
      id: 'arch-reconciliation',
      code: 'RES-01',
      title: arch.archetypeOverage > 0 ? 'Budget gap after archetype funding' : 'Residual reserve after archetype funding',
      section: 'Reconciliation',
      baselineAmount: 0,
      currentAmount: reconciliationAmount,
      variance: reconciliationAmount,
      driverLabel: 'Envelope residual',
      actionLabel: 'System calculated',
      basis: arch.archetypeOverage > 0
        ? 'Gap between available envelope and mapped archetype investment'
        : 'Balance remaining after archetype mapping',
      amountTone: arch.archetypeOverage > 0 ? 'negative' : 'positive',
    },
  ];
}

function computeBudgetFinancialPicture(
  arch: BudgetArchReturnType,
  totalPlannedCost: number,
) {
  const approvedBudget = arch.total;
  const implementation = arch.implementationTotal;
  const operating = arch.operatingTotal;
  const wbsAllocation = totalPlannedCost;
  const budgetNotAllocatedToWbs = approvedBudget - wbsAllocation;
  const asPercent = (value: number) => (approvedBudget > 0 ? (value / approvedBudget) * 100 : 0);

  // The 30M budget decomposes as: implementation + operating + contingency = total.
  // These are non-overlapping slices of the same pie.
  const rawContingency = approvedBudget - implementation - operating;
  // If contingency is < 0.5% of budget, it's effectively fully allocated (rounding artifact).
  const contingencyThreshold = approvedBudget * 0.005;
  const contingency = rawContingency > contingencyThreshold ? rawContingency : 0;
  const overIdentified = rawContingency < -contingencyThreshold ? Math.abs(rawContingency) : 0;
  // When budget is fully allocated (no meaningful contingency and no over-identification),
  // just show implementation + operations = 100% of budget.
  const fullyAllocated = contingency === 0 && overIdentified === 0;

  return {
    approvedBudget,
    implementation,
    operating,
    wbsAllocation,
    budgetNotAllocatedToWbs: Math.abs(budgetNotAllocatedToWbs) <= contingencyThreshold ? 0 : budgetNotAllocatedToWbs,
    structureRows: [
      { key: 'implementation', label: 'Implementation (CAPEX)', amount: implementation, share: asPercent(implementation) },
      { key: 'operating', label: 'Operations (OPEX)', amount: operating, share: asPercent(operating) },
      ...(contingency > 0
        ? [{ key: 'contingency', label: 'Contingency reserve', amount: contingency, share: asPercent(contingency) }]
        : overIdentified > 0
          ? [{ key: 'overIdentified', label: 'Over-identified', amount: overIdentified, share: asPercent(overIdentified), signedAmount: -overIdentified }]
          : fullyAllocated
            ? [{ key: 'fullyAllocated', label: 'Fully allocated', amount: 0, share: 0 }]
            : []),
    ],
  };
}

function computeCostWorkspaceSummary(
  costBaselineDraft: { approvedBudget: string; actualSpend: string; forecastSpend: string },
  costBreakdown: CostBreakdownResult,
  costLedgerRows: CostLedgerRow[],
) {
  const parsedBudget = Number.parseFloat(costBaselineDraft.approvedBudget) || costBreakdown.totalBudget;
  const parsedActualSpend = Number.parseFloat(costBaselineDraft.actualSpend) || costBreakdown.totalActualCost;
  const parsedForecast = Number.parseFloat(costBaselineDraft.forecastSpend) || Math.max(costBreakdown.totalPlannedCost, parsedActualSpend);
  const reserve = parsedBudget - parsedForecast;
  const utilization = parsedBudget > 0 ? (parsedActualSpend / parsedBudget) * 100 : 0;
  const commitment = parsedBudget > 0 ? (costBreakdown.totalPlannedCost / parsedBudget) * 100 : 0;
  const unpricedTaskCount = costLedgerRows.filter((row) => row.explicitPlannedCost === 0).length;
  const overrunCount = costLedgerRows.filter((row) => row.hasOverrun).length;
  const coverageGap = Math.max(0, parsedForecast - parsedBudget);

  return {
    budget: parsedBudget,
    actualSpend: parsedActualSpend,
    forecast: parsedForecast,
    reserve,
    utilization,
    commitment,
    unpricedTaskCount,
    overrunCount,
    coverageGap,
    taskActualCost: costBreakdown.trackedTaskActualCost,
  };
}

function checkTaskVisible(task: WbsTaskData, collapsedTasks: Set<string>): boolean {
  const taskCode = task.taskCode || '';
  const parts = taskCode.split('.');

  if (taskCode.endsWith('.0')) return true;

  const phaseCode = parts[0] + '.0';
  if (collapsedTasks.has(phaseCode)) {
    return false;
  }

  if (parts.length >= 3 || (parts.length === 2 && !taskCode.endsWith('.0'))) {
    if (parts.length >= 3) {
      const activityCode = parts.slice(0, 2).join('.');
      if (collapsedTasks.has(activityCode)) {
        return false;
      }
    }
  }

  return true;
}

function checkHasChildren(task: WbsTaskData, allTasks: WbsTaskData[]): boolean {
  const taskCode = task.taskCode || '';
  const parts = taskCode.split('.');

  if (taskCode.endsWith('.0')) {
    const phaseNum = parts[0];
    return allTasks.some(t => {
      const tCode = t.taskCode || '';
      return tCode.startsWith(phaseNum + '.') && tCode !== taskCode && !tCode.endsWith('.0');
    });
  }

  return allTasks.some(t => {
    const tCode = t.taskCode || '';
    return tCode.startsWith(taskCode + '.') && tCode !== taskCode;
  });
}

function getWbsBrainStatusLabel(status?: string) {
  const normalized = (status || '').toLowerCase();

  if (['approved', 'allow', 'ready_for_intelligence', 'ready'].includes(normalized)) {
    return {
      label: 'Allowed',
      badgeClass: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
      nextGate: 'intelligence',
    };
  }

  if (['waiting_approval', 'pending_approval', 'awaiting_approval'].includes(normalized)) {
    return {
      label: 'Waiting Approval',
      badgeClass: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
      nextGate: 'approval',
    };
  }

  if (['needs_info', 'needs_more_info'].includes(normalized)) {
    return {
      label: 'Needs Info',
      badgeClass: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
      nextGate: 'context',
    };
  }

  if (['blocked', 'deny', 'denied'].includes(normalized)) {
    return {
      label: 'Blocked',
      badgeClass: 'bg-rose-500/15 text-rose-600 border-rose-500/30',
      nextGate: 'policy',
    };
  }

  return {
    label: 'Pending',
    badgeClass: 'bg-slate-500/15 text-slate-600 border-slate-500/30',
    nextGate: 'review',
  };
}

function checkCriticalPathTask(task: WbsTaskData): boolean {
  const metadata = task.metadata as Record<string, unknown> | undefined;
  if (metadata?.isCriticalPath === true || metadata?.isCritical === true) return true;
  if (task.priority === 'critical') return true;
  return false;
}

function getTaskRiskLevelValue(task: WbsTaskData & { riskLevel?: string; notes?: string }): 'high' | 'medium' | 'low' | null {
  if (task.riskLevel && ['high', 'medium', 'low'].includes(task.riskLevel)) {
    return task.riskLevel as 'high' | 'medium' | 'low';
  }
  if (typeof task.notes === 'string') {
    if (task.notes.includes('HIGH_RISK')) return 'high';
    if (task.notes.includes('MEDIUM_RISK')) return 'medium';
  }
  return null;
}

function asPercentString(value: unknown): string {
  const parsed = safeNum(value);
  if (parsed <= 0) return '';
  const normalized = parsed <= 1 ? parsed * 100 : parsed;
  return String(Number(normalized.toFixed(2)));
}

function safeRound(v: unknown): string {
  const n = safeNum(v);
  return n ? String(Math.round(n)) : '';
}

function _safeFix(v: unknown, d: number): string {
  const n = safeNum(v);
  return n ? String(Number(n.toFixed(d))) : '';
}

function getWbsBorderClass(isCritical: boolean, isMilestone: boolean): string {
  if (isCritical) return 'border-l-4 border-l-red-500';
  if (isMilestone) return 'border-l-4 border-l-amber-500';
  return '';
}

function getWbsLevelFontClass(wbsLevel: number): string {
  if (wbsLevel === 1) return 'font-bold text-indigo-600 dark:text-indigo-400';
  if (wbsLevel === 2) return 'font-medium text-blue-600 dark:text-blue-400';
  return 'text-slate-600 dark:text-slate-400';
}

function getWbsTitleFontClass(wbsLevel: number): string {
  if (wbsLevel === 1) return 'font-bold';
  if (wbsLevel === 2) return 'font-medium';
  return '';
}

function getWbsLevelBadgeClass(wbsLevel: number): string {
  if (wbsLevel === 1) return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30';
  if (wbsLevel === 2) return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
  return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';
}

function inferWbsLevel(taskCode: string): number {
  const parts = taskCode.split('.').length;
  if (parts === 2 && taskCode.endsWith('.0')) return 1;
  if (parts === 2) return 2;
  if (parts === 3) return 3;
  return 2;
}

function resolvePredecessorCodes(predecessors: unknown, lookupFn: (code: string) => string): string {
  if (!Array.isArray(predecessors) || predecessors.length === 0) return '-';
  return (predecessors as unknown[]).map(p => {
    let code = '';
    if (typeof p === 'object' && p !== null && 'taskCode' in p && typeof (p as { taskCode?: unknown }).taskCode === 'string') {
      code = (p as { taskCode: string }).taskCode;
    } else if (typeof p === 'string') {
      code = p;
    }
    return lookupFn(code);
  }).filter(Boolean).join(', ') || '-';
}

function extractPredecessorTaskCodes(predecessors: unknown): string[] {
  if (!Array.isArray(predecessors)) return [];
  return (predecessors as unknown[]).map(p => {
    if (typeof p === 'object' && p !== null && 'taskCode' in p && typeof (p as { taskCode?: unknown }).taskCode === 'string') {
      return (p as { taskCode: string }).taskCode;
    }
    if (typeof p === 'string') return p;
    return '';
  }).filter(Boolean);
}

function groupTasksByResource(tasks: WbsTaskData[]): [string, WbsTaskData[]][] {
  const resourceGroups = new Map<string, WbsTaskData[]>();
  const unassigned: WbsTaskData[] = [];

  tasks.forEach(task => {
    const resource = task.assignedTo || (task as any).assignedTeam; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (resource && resource !== '-') {
      if (!resourceGroups.has(resource)) {
        resourceGroups.set(resource, []);
      }
      resourceGroups.get(resource)!.push(task);
    } else {
      unassigned.push(task);
    }
  });

  const allGroups = Array.from(resourceGroups.entries());
  if (unassigned.length > 0) {
    allGroups.unshift(['Unassigned', unassigned]);
  }
  return allGroups;
}

/** Derive all non-hook computed values from raw props so that the parent
 *  function body carries no conditional / logical-operator CC. */
function derivePlanningState(
  businessCase: BusinessCaseData | null | undefined,
  project: ProjectData,
) {
  const bcRaw = (businessCase as Record<string, unknown> | undefined)?.content || businessCase;
  const bc = bcRaw as Record<string, unknown> | null | undefined;
  const bcMeta = (bc || undefined) as Record<string, unknown> | undefined;
  const analysisConfidence = typeof bcMeta?.analysisConfidence === 'string' ? bcMeta.analysisConfidence : undefined;
  const dynamicRevenueUsed = typeof bcMeta?.dynamicRevenueUsed === 'boolean' ? bcMeta.dynamicRevenueUsed : undefined;
  const implementationPlan = bcMeta?.implementationPlan as Record<string, unknown> | undefined;
  const measurementPlan = bcMeta?.measurementPlan as Record<string, unknown> | undefined;
  const keyAssumptions = bcMeta?.keyAssumptions as Record<string, unknown> | undefined;
  const computedFinancialModel = bcMeta?.computedFinancialModel as Record<string, unknown> | undefined;
  const computedFinancialInputs = computedFinancialModel?.inputs as Record<string, unknown> | undefined;
  let businessCaseArchetype = 'Financial Archetype';
  if (typeof computedFinancialInputs?.archetype === 'string') {
    businessCaseArchetype = computedFinancialInputs.archetype;
  } else if (typeof bcMeta?.archetype === 'string') {
    businessCaseArchetype = bcMeta.archetype;
  }
  const revenueAssumptions = typeof bcMeta?.revenueAssumptions === 'string' ? bcMeta.revenueAssumptions : undefined;
  const costSource = typeof bcMeta?.costSource === 'string' ? bcMeta.costSource : undefined;
  const benefitSource = typeof bcMeta?.benefitSource === 'string' ? bcMeta.benefitSource : undefined;
  const totalCostEstimate = bcMeta?.totalCostEstimate ?? bcMeta?.totalCost;
  const projectFinancials = project as unknown as Record<string, unknown>;
  const projectApprovedBudget = safeNum(project.approvedBudget ?? totalCostEstimate);
  const projectActualSpend = safeNum(project.actualSpend);
  const projectForecastSpend = safeNum(projectFinancials.forecastSpend);
  const projectCurrency = typeof projectFinancials.currency === 'string' && projectFinancials.currency.trim().length > 0
    ? projectFinancials.currency
    : 'AED';
  const _implementationPhases =
    (bcMeta?.implementationPhases as ImplementationPhase[] | undefined) ||
    (implementationPlan?.phases as ImplementationPhase[] | undefined) ||
    (bcMeta?.phases as ImplementationPhase[] | undefined) ||
    [];
  const timeline = bcMeta?.timeline || implementationPlan?.timeline;
  const timelineData = timeline && typeof timeline === 'object'
    ? (timeline as { milestones?: unknown[] })
    : undefined;
  const resources = bcMeta?.resourceRequirements || implementationPlan?.resources || bcMeta?.resources;
  const resourcesData = resources as ResourcesData | null | undefined;
  const rawMilestones = (implementationPlan?.milestones as unknown[] | undefined) ||
    (bcMeta?.milestones as unknown[] | undefined) ||
    timelineData?.milestones || [];
  const kpis = (implementationPlan?.kpis as Record<string, unknown> | undefined) ||
    (bc?.kpis as Record<string, unknown> | undefined) ||
    (measurementPlan?.kpis as Record<string, unknown> | undefined) || {};
  const kpiMetrics = Array.isArray((kpis as { metrics?: unknown }).metrics)
    ? ((kpis as { metrics?: Array<{ name?: string; baseline?: string; target?: string }> }).metrics ?? [])
    : [];
  const kpiCriteria = Array.isArray((kpis as { criteria?: unknown }).criteria)
    ? ((kpis as { criteria?: string[] }).criteria ?? [])
    : [];
  const hasKpis = kpiMetrics.length > 0 || kpiCriteria.length > 0;
  return {
    bc, bcMeta, analysisConfidence, dynamicRevenueUsed,
    implementationPlan, measurementPlan, keyAssumptions,
    computedFinancialModel, computedFinancialInputs, businessCaseArchetype,
    revenueAssumptions, costSource, benefitSource, totalCostEstimate,
    projectApprovedBudget, projectActualSpend, projectForecastSpend, projectCurrency,
    _implementationPhases, timeline, timelineData, resources, resourcesData,
    rawMilestones, kpis, kpiMetrics, kpiCriteria, hasKpis,
  };
}

// ── End extracted helpers ──────────────────────────────────────────────────

export function PlanningPhaseTab({
  project,
  businessCase,

  demandReport,
  tasks,
  onAddTask,
  activeSubTab = 'wbs',
  onSubTabChange,
}: Readonly<PlanningPhaseTabProps>) {
  const activeSection = activeSubTab;
  const [wbsViewMode, setWbsViewMode] = useState<PlanningWbsViewMode>('schedule');
  const [editingCell, setEditingCell] = useState<{taskId: string; field: string} | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editingTask, setEditingTask] = useState<WbsTaskData | null>(null);
  const [deletingTask, setDeletingTask] = useState<WbsTaskData | null>(null);
  const [showApprovalHistory, setShowApprovalHistory] = useState(false);
  const [submitNotes, setSubmitNotes] = useState('');
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<WbsGenerationProgress | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [wbsBrainDecision, setWbsBrainDecision] = useState<{
    decisionId?: string;
    correlationId?: string;
    status?: string;
    governance?: Record<string, unknown> | null;
    readiness?: Record<string, unknown> | null;
  } | null>(null);
  const [showBrainGovernance, setShowBrainGovernance] = useState(false);

  const [isFullPage, setIsFullPage] = useState(false);
  const [_activeCostView, _setActiveCostView] = useState<CostWorkspaceView>('ledger');
  const [costTaskSearch, _setCostTaskSearch] = useState('');
  const [costTaskFilter, _setCostTaskFilter] = useState<CostTaskFilterMode>('all');
  const [_editingCostTaskId, setEditingCostTaskId] = useState<string | null>(null);
  const [costTaskDrafts, setCostTaskDrafts] = useState<Record<string, CostTaskDraft>>({});
  const [annualCostPlanDraft, setAnnualCostPlanDraft] = useState<AnnualCostPlanDraftRow[]>([]);
  const [contractRegisterDraft, setContractRegisterDraft] = useState<ContractRegisterDraftRow[]>([]);
  const [deliverableBaselineDraft, setDeliverableBaselineDraft] = useState<DeliverableBaselineDraftRow[]>([]);
  const [costBaselineDraft, setCostBaselineDraft] = useState({
    approvedBudget: '',
    actualSpend: '',
    forecastSpend: '',
    currency: 'AED',
  });
  const [businessCaseBudgetDraft, setBusinessCaseBudgetDraft] = useState<BusinessCaseBudgetDraft>({
    totalCostEstimate: '',
    implementationPeople: '',
    implementationTechnology: '',
    implementationIntegration: '',
    implementationChangeManagement: '',
    operatingAnnualRunCost: '',
    operatingMaintenance: '',
    operatingSupport: '',
    domainParams: {},
    contingencyPercent: '',
    maintenancePercent: '',
    adoptionRate: '',
    discountRate: '',
  });
  const [_inlineNotesTaskId, setInlineNotesTaskId] = useState<string | null>(null);
  const [inlineNotesDraft, setInlineNotesDraft] = useState('');
  const [editingPlanningArtifact, setEditingPlanningArtifact] = useState<PlanningPackageArtifact | null>(null);
  const [deletingPlanningArtifact, setDeletingPlanningArtifact] = useState<PlanningPackageArtifact | null>(null);
  const [planningArtifactDraft, setPlanningArtifactDraft] = useState<PlanningArtifactDraft>({
    name: '',
    phase: '',
    description: '',
  });
  const [expandedPlanningSignalKey, setExpandedPlanningSignalKey] = useState<string | null>(null);
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false);
  const [resourceDialogTask, setResourceDialogTask] = useState<WbsTaskData | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullPage(false);
      }
    };
    if (isFullPage) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isFullPage]);

  // Resource assignment dialog state
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [resourceSearchQuery, setResourceSearchQuery] = useState('');
  const [expandedPlanningPackage, setExpandedPlanningPackage] = useState('scope-baseline');
  const [resourceViewMode, setResourceViewMode] = useState<'suggested' | 'all'>('suggested');

  const { toast } = useToast();
  const { t } = useTranslation();
  const qc = useQueryClient();

  // Fetch users and teams for resource assignment
  const { data: usersResponse } = useQuery<{ success: boolean; data: UserData[] }>({
    queryKey: ['/api/users'],
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableUsers = usersResponse?.data || [];

  const { data: teamsResponse } = useQuery<{ success: boolean; data: TeamData[] }>({
    queryKey: ['/api/teams'],
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableTeams = teamsResponse?.data || [];

  // AI-powered resource matching and workload analysis
  const resourceAnalysis = useMemo(() => computeResourceAnalysis(tasks), [tasks]);

  // Get currently assigned resources for the selected task (use fresh data from tasks array)
  const currentlyAssigned = useMemo(() => {
    if (!resourceDialogTask) return [];
    // Get fresh task data from the tasks array to ensure we have latest assignments
    const freshTask = tasks.find(t => t.id === resourceDialogTask.id) || resourceDialogTask;
    const assigned: { name: string; type: 'user' | 'team' }[] = [];
    if (freshTask.assignedTo) {
      freshTask.assignedTo.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((name: string) => {
        // Determine if this is a team or user based on availableTeams list
        const isTeam = availableTeams.some(t => t.name === name);
        assigned.push({ name, type: isTeam ? 'team' : 'user' });
      });
    }
    return assigned;
  }, [resourceDialogTask, availableTeams, tasks]);

  // Filter and sort resources based on search and match scores
  const filteredResources = useMemo(() => {
    const query = resourceSearchQuery.toLowerCase();

    const scoredUsers = availableUsers.map(user => ({
      ...user,
      type: 'user' as const,
      displayName: user.displayName || user.email,
      matchScore: resourceAnalysis.getMatchScore(user.displayName || user.email, user.department, resourceDialogTask),
      workload: resourceAnalysis.workloadMap.get(user.displayName || user.email) || { taskCount: 0, totalHours: 0, taskNames: [] }
    })).filter(u =>
      !query ||
      u.displayName.toLowerCase().includes(query) ||
      (u.department?.toLowerCase().includes(query)) ||
      (u.role?.toLowerCase().includes(query))
    );

    const scoredTeams = availableTeams.map(team => ({
      ...team,
      type: 'team' as const,
      matchScore: resourceAnalysis.getMatchScore(team.name, team.description, resourceDialogTask),
      workload: resourceAnalysis.workloadMap.get(team.name) || { taskCount: 0, totalHours: 0, taskNames: [] }
    })).filter(t =>
      !query ||
      t.name.toLowerCase().includes(query) ||
      (t.description?.toLowerCase().includes(query))
    );

    // Sort by match score (descending)
    const sortedUsers = [...scoredUsers].sort((a, b) => b.matchScore - a.matchScore);
    const sortedTeams = [...scoredTeams].sort((a, b) => b.matchScore - a.matchScore);

    // Suggested = top 3 users + top 2 teams with score >= 70
    const suggested = [
      ...sortedUsers.filter(u => u.matchScore >= 70).slice(0, 3),
      ...sortedTeams.filter(t => t.matchScore >= 70).slice(0, 2)
    ];

    return {
      users: sortedUsers,
      teams: sortedTeams,
      suggested: suggested.length > 0 ? suggested : [...sortedUsers.slice(0, 2), ...sortedTeams.slice(0, 1)]
    };
  }, [availableUsers, availableTeams, resourceSearchQuery, resourceDialogTask, resourceAnalysis]);

  // Get the base code for a task (handles ".0" suffix for phases)
  const _getBaseCode = (taskCode: string) => {
    if (taskCode.endsWith('.0')) {
      return taskCode.slice(0, -2); // "1.0" -> "1"
    }
    return taskCode;
  };

  // Get the phase number from a task code
  const _getPhaseNumber = (taskCode: string) => {
    const parts = taskCode.split('.');
    return parts[0];
  };

  // Toggle collapse for a task code
  const toggleTaskCollapse = (taskCode: string) => {
    setCollapsedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskCode)) {
        next.delete(taskCode);
      } else {
        next.add(taskCode);
      }
      return next;
    });
  };

  // Check if a task should be visible based on parent collapse state
  const isTaskVisible = (task: WbsTaskData) => checkTaskVisible(task, collapsedTasks);
  const hasChildren = (task: WbsTaskData) => checkHasChildren(task, tasks);

  const brainDecisionId = wbsBrainDecision?.decisionId;
  const brainStatus = getWbsBrainStatusLabel(wbsBrainDecision?.status);

  const { data: brainDecision } = useQuery({
    queryKey: ['decision', brainDecisionId],
    queryFn: () => fetchDecision(brainDecisionId!),
    enabled: !!brainDecisionId,
  });

  const policyVerdict = brainDecision?.policyEvaluation?.verdict || 'Pending';
  const contextScore = typeof brainDecision?.contextQuality?.score === 'number'
    ? Math.round(brainDecision.contextQuality.score)
    : null;

  const { data: approvalData } = useQuery({
    queryKey: ['/api/portfolio/projects', project.id, 'wbs', 'approval'],
    enabled: !!project.id,
  });

  const { data: approvalHistoryData } = useQuery({
    queryKey: ['/api/portfolio/projects', project.id, 'wbs', 'approval', 'history'],
    enabled: showApprovalHistory && !!project.id,
  });

  const approval = (approvalData as any)?.data; // eslint-disable-line @typescript-eslint/no-explicit-any
  const approvalHistory = (approvalHistoryData as any)?.data || []; // eslint-disable-line @typescript-eslint/no-explicit-any

  // Risk Register Approval — mirrors the WBS approval pattern but is persisted
  // in project.metadata.riskRegisterApproval (see portfolio-risks.routes.ts).
  const { data: riskApprovalData } = useQuery({
    queryKey: ['/api/portfolio/projects', project.id, 'risk-register', 'approval'],
    enabled: !!project.id,
  });
  const riskApproval = (riskApprovalData as any)?.data ?? null; // eslint-disable-line @typescript-eslint/no-explicit-any

  const submitRiskRegisterMutation = useMutation({
    mutationFn: async (payload: { snapshot: Record<string, unknown>; stats: Record<string, number>; notes?: string }) => {
      const res = await apiRequest('POST', `/api/portfolio/projects/${project.id}/risk-register/approval/submit`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Risk register submitted', description: 'The PMO has been notified for review.' });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'risk-register', 'approval'] });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unable to submit risk register';
      toast({ title: 'Submission failed', description: msg, variant: 'destructive' });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data: { id: string; updates: WbsTaskUpdates }) => {
      const response = await apiRequest('PATCH', `/api/portfolio/wbs/${data.id}`, data.updates);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('projectWorkspace.toast.taskUpdated'), description: t('projectWorkspace.toast.taskUpdatedDesc') });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'wbs'] });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'management-summary'] });
      setEditingTask(null);
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.updateFailed'), description: t('projectWorkspace.toast.failedUpdateTask'), variant: "destructive" });
    },
  });

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const _updateProjectFinancialsMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      const response = await apiRequest('PATCH', `/api/portfolio/projects/${project.id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Financial baseline updated',
        description: 'Budget, forecast, and spend controls were saved for this project.',
      });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id] });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'management-summary'] });
    },
    onError: () => {
      toast({
        title: 'Financial update failed',
        description: 'The project financial baseline could not be saved.',
        variant: 'destructive',
      });
    },
  });

  const updateBusinessCaseBudgetMutation = useMutation({
    mutationFn: async (payload: {
      totalCostEstimate: string;
      financialAssumptions: Record<string, number>;
      implementationCosts: Record<string, number>;
      operationalCosts: Record<string, number>;
      domainParameters: Record<string, number>;
      annualCostPlan?: AnnualCostPlanRow[];
      contractRegister?: ContractRegisterItem[];
      multiAgentMetadata?: Record<string, unknown>;
    }) => {
      if (!project.demandReportId) {
        throw new Error('This project is not linked to a demand report business case.');
      }

      const businessCaseResponse = await apiRequest('PUT', `/api/demand-reports/${project.demandReportId}/business-case`, payload);
      const projectResponse = await apiRequest('PATCH', `/api/portfolio/projects/${project.id}`, {
        approvedBudget: payload.totalCostEstimate,
      });

      return {
        businessCase: await businessCaseResponse.json(),
        project: await projectResponse.json(),
      };
    },
    onSuccess: (_data, variables) => {
      setCostBaselineDraft((current) => ({
        ...current,
        approvedBudget: variables.totalCostEstimate,
      }));
      toast({
        title: 'Business case budget updated',
        description: 'The business-case assumptions and the project authorized budget were updated together.',
      });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id] });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'management-summary'] });
    },
    onError: (error) => {
      toast({
        title: 'Business case budget update failed',
        description: error instanceof Error ? error.message : 'The business-case assumptions could not be saved.',
        variant: 'destructive',
      });
    },
  });

  const updateCostLineMutation = useMutation({
    mutationFn: async (data: { id: string; updates: WbsTaskUpdates }) => {
      const response = await apiRequest('PATCH', `/api/portfolio/wbs/${data.id}`, data.updates);
      return response.json();
    },
    onSuccess: (_data, variables) => {
      toast({
        title: 'Cost line updated',
        description: 'Task cost controls were saved successfully.',
      });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'wbs'] });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'management-summary'] });
      setEditingCostTaskId(null);
      setCostTaskDrafts((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
    },
    onError: () => {
      toast({
        title: 'Cost line update failed',
        description: 'The selected task costs could not be saved.',
        variant: 'destructive',
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiRequest('DELETE', `/api/portfolio/wbs/${taskId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('projectWorkspace.toast.taskDeleted'), description: t('projectWorkspace.toast.taskRemovedFromWbsDesc') });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'wbs'] });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'management-summary'] });
      setDeletingTask(null);
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.deleteFailed'), description: t('projectWorkspace.toast.failedDeleteTask'), variant: "destructive" });
    },
  });

  const updatePlanningArtifactsMutation = useMutation({
    mutationFn: async (variables: {
      overrides: PlanningArtifactOverride[];
      successTitle: string;
      successDescription: string;
      errorTitle: string;
      errorDescription: string;
      closeEditor?: boolean;
      closeDelete?: boolean;
    }) => {
      if (!project.demandReportId) {
        throw new Error('This project is not linked to a demand report business case.');
      }
      if (!businessCase) {
        throw new Error('No business case is available for planning artifact updates.');
      }

      const response = await apiRequest('PUT', `/api/demand-reports/${project.demandReportId}/business-case`, {
        ...businessCase,
        multiAgentMetadata: {
          ...((((businessCase as unknown as Record<string, unknown> | undefined)?.multiAgentMetadata) as Record<string, unknown> | undefined) ?? {}),
          planningArtifacts: {
            overrides: variables.overrides,
          },
        },
        content: {
          ...(businessCase.content ?? {}),
          planningArtifacts: {
            overrides: variables.overrides,
          },
        },
      });

      return response.json();
    },
    onSuccess: (_data, variables) => {
      qc.setQueryData(['/api/portfolio/projects', project.id], (current: unknown) => {
        if (!current || typeof current !== 'object') return current;
        const currentRecord = current as { data?: Record<string, unknown> };
        if (!currentRecord.data || typeof currentRecord.data !== 'object') return current;

        return {
          ...currentRecord,
          data: {
            ...currentRecord.data,
            businessCase: {
              ...(businessCase ?? {}),
              multiAgentMetadata: {
                ...((((businessCase as Record<string, unknown> | undefined)?.multiAgentMetadata as Record<string, unknown> | undefined) ?? {})),
                planningArtifacts: {
                  overrides: variables.overrides,
                },
              },
              content: {
                ...((businessCase?.content ?? {}) as Record<string, unknown>),
                planningArtifacts: {
                  overrides: variables.overrides,
                },
              },
            },
          },
        };
      });
      toast({
        title: variables.successTitle,
        description: variables.successDescription,
      });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id] });
      qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'management-summary'] });
      if (variables.closeEditor) setEditingPlanningArtifact(null);
      if (variables.closeDelete) setDeletingPlanningArtifact(null);
    },
    onError: (error, variables) => {
      toast({
        title: variables.errorTitle,
        description: error instanceof Error ? error.message : variables.errorDescription,
        variant: 'destructive',
      });
    },
  });

  const submitForApprovalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/portfolio/projects/${project.id}/wbs/approval/submit`, { notes: submitNotes });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: t('projectWorkspace.toast.submittedForApproval'), description: t('projectWorkspace.toast.wbsSubmittedForReviewDesc') });
        qc.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'wbs', 'approval'] });
        setShowSubmitDialog(false);
        setSubmitNotes('');
      }
    },
    onError: () => {
      toast({ title: t('projectWorkspace.toast.submissionFailed'), description: t('projectWorkspace.toast.failedSubmitWbsDesc'), variant: "destructive" });
    },
  });

  const generateWbsMutation = useMutation({
    mutationFn: async (vars?: { acceptFallback?: boolean }) => {
      setIsGenerating(true);
      setGenerationProgress({
        phase: 'analyzing',
        step: 1,
        totalSteps: 4,
        message: 'Starting AI generation...',
        percentage: 5,
      });
      setWbsBrainDecision(null);
      const response = await apiRequest(
        'POST',
        `/api/portfolio/projects/${project.id}/wbs/generate-ai`,
        {
          startDate: new Date().toISOString().split('T')[0],
          ...(vars?.acceptFallback ? { acceptFallback: true } : {}),
        }
      );
      return response.json();
    },
    onSuccess: (data) => {
      setIsGenerating(false);
      setGenerationProgress(null);
      if (data.success) {
        if (data.decisionBrain) {
          setWbsBrainDecision({
            decisionId: data.decisionBrain.decisionId,
            correlationId: data.decisionBrain.correlationId,
            status: data.decisionBrain.status,
            governance: data.decisionBrain.governance || null,
            readiness: data.decisionBrain.readiness || null,
          });
        }
        toast({
          title: t('projectWorkspace.toast.wbsGeneratedSuccess'),
          description: t('projectWorkspace.toast.wbsGeneratedDesc', { totalTasks: data.data.summary?.totalTasks || 0, totalPhases: data.data.summary?.totalPhases || 0 }),
        });
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'wbs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id, 'management-summary'] });
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', project.id] });
      } else {
        toast({
          title: t('projectWorkspace.toast.generationFailed'),
          description: data.error || t('projectWorkspace.toast.failedGenerateWbs'),
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      setIsGenerating(false);
      setGenerationProgress(null);
      if (isBlockedGenerationError(error)) {
        openBlockedGenerationDialog(error.payload, async (actionId, payload) => {
          if (actionId === 'retry') {
            generateWbsMutation.mutate({});
          } else if (actionId === 'request_approval') {
            // Notify governance approvers that this PM wants permission to run
            // AI WBS generation. Pure notification flow — no navigation, no
            // wbs_approvals row created (no tasks exist yet).
            try {
              const reasons = (payload?.reasons || []).map((r) => r.message).slice(0, 3);
              await apiRequest(
                'POST',
                `/api/portfolio/projects/${project.id}/wbs/request-generation-approval`,
                { reasons },
              );
              toast({
                title: 'Governance approval requested',
                description: 'PMO approvers have been notified. You will be alerted when a decision is made.',
              });
            } catch (e) {
              toast({
                title: 'Failed to request approval',
                description: e instanceof Error ? e.message : String(e),
                variant: 'destructive',
              });
            }
          } else if (actionId === 'use_template') {
            // WBS has no deterministic template fallback; treated as a forced retry
            // with explicit acceptFallback=true so the use-case will surface the
            // raw error instead of the blocked dialog if the pipeline still fails.
            generateWbsMutation.mutate({ acceptFallback: true });
          }
        });
        return;
      }
      toast({
        title: t('projectWorkspace.toast.generationFailed'),
        description: error.message || t('projectWorkspace.toast.failedGenerateAiWbs'),
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!isGenerating) return;

    const pollProgress = async () => {
      try {
        const response = await fetch(`/api/portfolio/projects/${project.id}/wbs/generation-progress`, {
          credentials: 'include',
        });
        const data = await response.json();
        if (data.success && data.data) {
          setGenerationProgress(data.data);
        }
      } catch {
        // Polling may intermittently fail; next tick will retry
      }
    };

    const interval = setInterval(pollProgress, 1000);
    return () => clearInterval(interval);
  }, [isGenerating, project.id]);

  // ── Derived state (conditionals live inside the helper's own CC scope) ──
  const {
    bc, bcMeta, analysisConfidence, dynamicRevenueUsed,
    implementationPlan, measurementPlan, keyAssumptions,
    computedFinancialModel, computedFinancialInputs, businessCaseArchetype,
    revenueAssumptions, costSource, benefitSource, totalCostEstimate,
    projectApprovedBudget, projectActualSpend, projectForecastSpend, projectCurrency,
    _implementationPhases, timeline, timelineData, resources, resourcesData,
    rawMilestones, kpis, kpiMetrics, kpiCriteria, hasKpis,
  } = derivePlanningState(businessCase, project);

  const financialAssumptions = useMemo(
    () => (bcMeta?.financialAssumptions as Record<string, unknown> | undefined) || {},
    [bcMeta?.financialAssumptions]
  );
  const domainParameters = useMemo(
    () => ((computedFinancialInputs?.domainParameters as Record<string, unknown> | undefined)
      || (bcMeta?.domainParameters as Record<string, unknown> | undefined)
      || {}),
    [computedFinancialInputs?.domainParameters, bcMeta?.domainParameters]
  );
  // Derive implementation/operational totals from the stored business-case sub-categories,
  // scaled proportionally so that implementation + operations = totalCostEstimate (the approved budget).
  // The AI may have sized them independently (e.g. impl = 30M, ops = 12M), but the
  // approved budget is the single ceiling that both must fit within.
  const { implementationCosts, operationalCosts } = useMemo(() => {
    const implStored = (bcMeta?.implementationCosts as Record<string, unknown> | undefined) || {};
    const opsStored = (bcMeta?.operationalCosts as Record<string, unknown> | undefined) || {};
    const budget = safeNum(totalCostEstimate);
    const implKeys = ['people', 'technology', 'integration', 'changeManagement'] as const;
    const opsKeys = ['annualRunCost', 'maintenance', 'support'] as const;
    const rawImplTotal = implKeys.reduce((s, k) => s + safeNum(implStored[k]), 0);
    const rawOpsTotal = opsKeys.reduce((s, k) => s + safeNum(opsStored[k]), 0);
    const rawCombined = rawImplTotal + rawOpsTotal;
    // If combined exceeds budget, scale both down proportionally; otherwise pass through.
    if (budget > 0 && rawCombined > budget) {
      const scale = budget / rawCombined;
      const scaledImpl: Record<string, unknown> = { ...implStored };
      for (const k of implKeys) scaledImpl[k] = Math.round(safeNum(implStored[k]) * scale);
      const scaledOps: Record<string, unknown> = { ...opsStored };
      for (const k of opsKeys) scaledOps[k] = Math.round(safeNum(opsStored[k]) * scale);
      return { implementationCosts: scaledImpl, operationalCosts: scaledOps };
    }
    return { implementationCosts: implStored, operationalCosts: opsStored };
  }, [bcMeta?.implementationCosts, bcMeta?.operationalCosts, totalCostEstimate]);

  const milestones = useMemo(() => computeMilestones(rawMilestones, tasks), [rawMilestones, tasks]);
  const planningArtifactOverrides = useMemo(() => getPlanningArtifactOverrides(businessCase ?? null), [businessCase]);
  const planningArtifactOverrideByOriginKey = useMemo(
    () => new Map(planningArtifactOverrides.map((item) => [item.originKey, item])),
    [planningArtifactOverrides],
  );
  const deliverables = useMemo(() => extractAllDeliverables(businessCase ?? null), [businessCase]);
  const deliverableRelationships = useMemo<DeliverableRelationshipView[]>(
    () => computeDeliverableRelationships(deliverables, milestones, tasks),
    [deliverables, milestones, tasks],
  );
  const deliverableTaskByCode = useMemo(() => {
    const lookup = new Map<string, WbsTaskData>();
    tasks.forEach((task) => {
      const code = task.taskCode || task.wbsCode || '';
      if (task.taskType === 'deliverable' && code) lookup.set(code, task);
    });
    return lookup;
  }, [tasks]);

  const _sections = PLANNING_SECTIONS;

  const taskStats = useMemo(() => ({
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    pending: tasks.filter(t => t.status === 'pending' || t.status === 'not_started').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
  }), [tasks]);

  const taskLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    tasks.forEach(t => {
      if (t.taskCode) lookup.set(t.taskCode, t.title || t.taskCode);
      if (t.wbsCode) lookup.set(t.wbsCode, t.title || t.wbsCode);
      if (t.id) lookup.set(t.id, t.title || t.id);
    });
    return lookup;
  }, [tasks]);

  // Helper to detect if task is on critical path (from property, priority, or notes)
  const isCriticalPathTask = (task: WbsTaskData) => checkCriticalPathTask(task);

  // Helper to detect if task is a milestone (from property or taskType)
  function isMilestoneTask(task: WbsTaskData): boolean {
    if (task.isMilestone || task.taskType === 'milestone') return true;
    return false;
  }

  const getTaskRiskLevel = (task: WbsTaskData & { riskLevel?: string; notes?: string }) => getTaskRiskLevelValue(task);

  const resolveDependencyName = (depCode: string): string => {
    return taskLookup.get(depCode) || depCode.substring(0, 8) + '...';
  };

  const progress = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0;

  const isWbsLocked = approval?.status === 'approved';

  const milestoneStats = useMemo(() => {
    const completed = milestones.filter(m => m.status === 'completed' || m.completed).length;
    const upcoming = milestones.filter(m => !m.status || m.status === 'pending' || m.status === 'upcoming').length;
    return { total: milestones.length, completed, upcoming };
  }, [milestones]);

  const deliverableStats = useMemo(() => {
    const wbsDeliverables = tasks.filter((task) => task.taskType === 'deliverable');
    if (wbsDeliverables.length > 0) {
      const completed = wbsDeliverables.filter((task) => task.status === 'completed').length;
      return { total: wbsDeliverables.length, completed };
    }
    const completed = deliverables.filter(d => d.status === 'completed' || d.delivered).length;
    return { total: deliverables.length, completed };
  }, [deliverables, tasks]);

  const actionableTasks = useMemo(
    () => tasks.filter((task) => !(task.isMilestone || task.taskType === 'milestone')),
    [tasks],
  );

  const unassignedTaskCount = useMemo(
    () => actionableTasks.filter((task) => !task.assignedTo?.trim()).length,
    [actionableTasks],
  );

  const assignedTaskCount = actionableTasks.length - unassignedTaskCount;

  const dependencyCoverage = useMemo(() => {
    const linked = actionableTasks.filter((task) => extractTaskDependencyCodes(task).length > 0).length;
    return {
      total: actionableTasks.length,
      linked,
      missing: Math.max(0, actionableTasks.length - linked),
    };
  }, [actionableTasks]);

  const deliverableCoverage = useMemo(() => {
    const total = deliverableRelationships.length > 0 ? deliverableRelationships.length : deliverableStats.total;
    return {
      total,
      unmappedTasks: deliverableRelationships.filter((entry) => entry.taskCount === 0).length,
      unmappedMilestones: deliverableRelationships.filter((entry) => entry.linkedMilestones.length === 0).length,
    };
  }, [deliverableRelationships, deliverableStats.total]);

  const plannedResourceCount = useMemo(() => {
    const normalizedResourcePool = resources as { personnel?: unknown[] } | null | undefined;
    const normalizedResources = Array.isArray(normalizedResourcePool?.personnel) ? normalizedResourcePool.personnel.length : 0;
    const rawResources = Array.isArray(resourcesData?.personnel) ? resourcesData.personnel.length : 0;
    return Math.max(normalizedResources, rawResources);
  }, [resources, resourcesData]);

  const persistedCostPlan = useMemo(() => {
    const metadata = (project as { metadata?: unknown }).metadata;
    if (!metadata || typeof metadata !== 'object') return null;
    const raw = (metadata as Record<string, unknown>).costPlan;
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  }, [project]);

  const persistedCbsCount = useMemo(
    () => (Array.isArray(persistedCostPlan?.cbs) ? persistedCostPlan.cbs.length : 0),
    [persistedCostPlan],
  );

  const isPersistedCostBaselineLocked = useMemo(
    () => typeof persistedCostPlan?.baselineLockedAt === 'string' && persistedCostPlan.baselineLockedAt.length > 0,
    [persistedCostPlan],
  );

  const planningAssistant = useMemo<PlanningAssistantBrief>(() => {
    const sectionLabel = _sections.find((section) => section.id === activeSection)?.label ?? 'Planning';
    const scope = `${sectionLabel} intelligence`;
    const currency = projectCurrency || 'AED';
    const budgetEnvelope = projectApprovedBudget > 0
      ? `${currency} ${Math.round(projectApprovedBudget).toLocaleString()} budget`
      : 'Budget envelope pending';
    const approvalStatus = approval?.status ? approval.status.replace(/_/g, ' ') : 'not submitted';
    const riskStatus = riskApproval?.status ? riskApproval.status.replace(/_/g, ' ') : 'not submitted';
    const deliverableLinkSignal = deliverableCoverage.unmappedTasks > 0
      ? `${deliverableCoverage.unmappedTasks} deliverables lack task linkage`
      : 'Deliverables linked into work';

    if (activeSection === 'cost') {
      if (!isWbsLocked) {
        return {
          tone: 'warn',
          scope,
          headline: 'Approve the WBS before freezing cost',
          body: 'COREVIA will only treat the cost baseline as controlled once the work breakdown is approved. Until then, the CBS, BAC, and cashflow remain provisional planning artifacts.',
          evidence: [`WBS status: ${approvalStatus}`, `${taskStats.total} drafted tasks`, budgetEnvelope],
          cta: { label: 'Open WBS', section: 'wbs' },
        };
      }
      if (isPersistedCostBaselineLocked) {
        return {
          tone: 'good',
          scope,
          headline: 'Baseline locked under governed change control',
          body: 'The commercial envelope is frozen. Future movement should flow through procurement and change control, not silent baseline edits inside the plan.',
          evidence: [`${persistedCbsCount} CBS lines captured`, budgetEnvelope, 'All deltas now belong in the change log'],
          cta: { label: 'Open Planning Gate', section: 'planning-gate' },
        };
      }
      if (persistedCbsCount >= 3) {
        return {
          tone: 'info',
          scope,
          headline: 'Ready to lock the baseline',
          body: 'CBS is populated and BAC is aligned. Locking freezes the envelope; all future movements flow through the change log.',
          evidence: [`${persistedCbsCount} CBS lines in scope`, budgetEnvelope, deliverableLinkSignal],
          cta: { label: 'Open Planning Gate', section: 'planning-gate' },
        };
      }
      return {
        tone: 'info',
        scope,
        headline: 'Commercial baseline still needs structure',
        body: 'Expand the CBS with priced lines, contract intent, and delivery alignment so COREVIA can defend the baseline at gate review.',
        evidence: [`${persistedCbsCount} CBS lines saved`, budgetEnvelope, deliverableLinkSignal],
        cta: { label: 'Open Deliverables', section: 'deliverables' },
      };
    }

    if (activeSection === 'risk-register') {
      if (taskStats.blocked > 0 || milestoneStats.upcoming > 0) {
        return {
          tone: 'warn',
          scope,
          headline: 'Risk treatment should catch up before the gate review',
          body: 'Planning already shows pressure in the work graph. Capture mitigations, accountable owners, and trigger conditions now so these issues do not surface as execution surprises.',
          evidence: [`${taskStats.blocked} blocked tasks`, `${milestoneStats.upcoming} upcoming milestones`, `Register status: ${riskStatus}`],
          cta: { label: 'Open Dependencies', section: 'dependencies' },
        };
      }
      if (riskApproval?.status === 'approved') {
        return {
          tone: 'good',
          scope,
          headline: 'Risk posture is approved for the planning baseline',
          body: 'COREVIA sees a governed risk register. Keep it live as the cost, sequencing, and resource assumptions continue to harden across the other planning tabs.',
          evidence: [`Risk register approved`, `${deliverableStats.total} deliverables in scope`, budgetEnvelope],
          cta: { label: 'Open Planning Gate', section: 'planning-gate' },
        };
      }
      return {
        tone: 'info',
        scope,
        headline: 'Use this register to turn uncertainty into governed action',
        body: 'The strongest planning teams convert schedule, dependency, and commercial uncertainty into named risks with owners and response triggers before the baseline is frozen.',
        evidence: [`Register status: ${riskStatus}`, `${taskStats.total} tasks in the baseline`, `${milestoneStats.total} milestones to protect`],
        cta: { label: 'Open Planning Gate', section: 'planning-gate' },
      };
    }

    if (activeSection === 'deliverables') {
      if (deliverableStats.total === 0) {
        return {
          tone: 'warn',
          scope,
          headline: 'Scope has not been expressed as governed deliverables yet',
          body: 'COREVIA can only trace planning quality when outcomes are explicit. Break the scope into named deliverables and connect them to work packages and milestones.',
          evidence: [`${taskStats.total} WBS tasks available`, `${milestoneStats.total} milestone anchors`, budgetEnvelope],
          cta: { label: 'Open WBS', section: 'wbs' },
        };
      }
      if (deliverableCoverage.unmappedTasks > 0) {
        return {
          tone: 'warn',
          scope,
          headline: `${deliverableCoverage.unmappedTasks} deliverables are not yet wired to execution work`,
          body: 'A deliverable without an owning work package becomes an execution surprise. Link each outcome to tasks, dates, and milestone evidence before baseline lock.',
          evidence: [`${deliverableStats.total} deliverables total`, `${deliverableCoverage.unmappedMilestones} without milestone linkage`, `${taskStats.total} WBS tasks available`],
          cta: { label: 'Open WBS', section: 'wbs' },
        };
      }
      return {
        tone: 'good',
        scope,
        headline: 'Deliverables are traceable across work and milestones',
        body: 'The planning story now links outcomes to execution logic. COREVIA can follow that chain into cost, readiness, and governance without inventing surrogate assumptions.',
        evidence: [`${deliverableStats.total} deliverables tracked`, `${deliverableStats.completed} complete or controlled`, 'Task and milestone traceability in place'],
        cta: { label: 'Open Cost', section: 'cost' },
      };
    }

    if (activeSection === 'resources') {
      if (actionableTasks.length === 0) {
        return {
          tone: 'info',
          scope,
          headline: 'Resource intelligence activates after the work graph exists',
          body: 'Once the WBS is shaped, COREVIA can test staffing depth, skill match, and workload balance. Right now the priority is creating accountable work packages first.',
          evidence: [`${availableUsers.length} people in directory`, `${plannedResourceCount} planned roles from the business case`, budgetEnvelope],
          cta: { label: 'Open WBS', section: 'wbs' },
        };
      }
      if (unassignedTaskCount > 0) {
        return {
          tone: 'warn',
          scope,
          headline: `${unassignedTaskCount} work packages still have no accountable owner`,
          body: 'Planning quality degrades fast when tasks are budgeted but not owned. Assign accountable people or teams now so the baseline reflects real delivery capacity.',
          evidence: [`${assignedTaskCount}/${actionableTasks.length} tasks have owners`, `${plannedResourceCount} planned roles in scope`, `${availableUsers.length} people loaded in the directory`],
          cta: { label: 'Open WBS', section: 'wbs' },
        };
      }
      return {
        tone: 'good',
        scope,
        headline: 'Resource coverage supports the current plan',
        body: 'Owners are in place for the active work packages, which means COREVIA can reason about delivery capacity instead of just nominal scope.',
        evidence: [`${assignedTaskCount}/${actionableTasks.length} tasks staffed`, `${plannedResourceCount} planned roles modeled`, `${taskStats.inProgress} tasks already in progress`],
        cta: { label: 'Open Dependencies', section: 'dependencies' },
      };
    }

    if (activeSection === 'dependencies') {
      if (actionableTasks.length === 0) {
        return {
          tone: 'info',
          scope,
          headline: 'Dependency intelligence starts once tasks exist',
          body: 'After the work graph is formed, COREVIA can detect missing predecessors, fragile handoffs, and critical-path pressure. First create the baseline work packages.',
          evidence: [`${milestoneStats.total} milestones available`, `${deliverableStats.total} deliverables in scope`, budgetEnvelope],
          cta: { label: 'Open WBS', section: 'wbs' },
        };
      }
      if (dependencyCoverage.missing > Math.max(1, Math.floor(actionableTasks.length * 0.4))) {
        return {
          tone: 'warn',
          scope,
          headline: 'Task logic is still under-sequenced',
          body: 'A planning baseline without enough predecessor logic will look healthy until execution starts. Connect the key handoffs now so slippage is visible before the gate.',
          evidence: [`${dependencyCoverage.linked}/${dependencyCoverage.total} tasks linked`, `${dependencyCoverage.missing} tasks still float`, `${taskStats.blocked} blocked tasks already detected`],
          cta: { label: 'Open WBS', section: 'wbs' },
        };
      }
      return {
        tone: 'good',
        scope,
        headline: 'Dependency logic is carrying the schedule narrative',
        body: 'The work graph is sequenced well enough for COREVIA to reason about readiness, handoff pressure, and likely slippage before execution begins.',
        evidence: [`${dependencyCoverage.linked}/${dependencyCoverage.total} tasks linked`, `${milestoneStats.total} milestone anchors`, `${taskStats.blocked} blocked tasks`],
        cta: { label: 'Open Planning Gate', section: 'planning-gate' },
      };
    }

    if (activeSection === 'planning-gate') {
      const gateChecks = [
        { ok: isWbsLocked, evidence: 'WBS approved', label: 'Open WBS', section: 'wbs' },
        { ok: riskApproval?.status === 'approved', evidence: 'Risk register approved', label: 'Open Risk Register', section: 'risk-register' },
        { ok: deliverableStats.total > 0 && deliverableCoverage.unmappedTasks === 0, evidence: 'Deliverables traceable', label: 'Open Deliverables', section: 'deliverables' },
        { ok: actionableTasks.length > 0 && unassignedTaskCount === 0, evidence: 'Owners assigned', label: 'Open Resources', section: 'resources' },
        { ok: isPersistedCostBaselineLocked || persistedCbsCount >= 3, evidence: 'Cost baseline shaped', label: 'Open Cost', section: 'cost' },
      ];
      const missingChecks = gateChecks.filter((check) => !check.ok);
      const primaryMissingCheck = missingChecks[0];

      if (missingChecks.length <= 1) {
        return {
          tone: 'good',
          scope,
          headline: 'Planning gate evidence is nearly ready for committee review',
          body: 'The baseline now has enough structure for a serious governance conversation. COREVIA is reading the plan as a connected operating model rather than isolated tab content.',
          evidence: gateChecks.filter((check) => check.ok).map((check) => check.evidence).slice(0, 4),
          cta: primaryMissingCheck ? { label: primaryMissingCheck.label, section: primaryMissingCheck.section } : undefined,
        };
      }

      return {
        tone: 'warn',
        scope,
        headline: `Planning gate still has ${missingChecks.length} open condition${missingChecks.length > 1 ? 's' : ''}`,
        body: 'Close the missing approvals and planning traceability before asking the committee to trust the baseline. COREVIA is surfacing the most important gaps first.',
        evidence: missingChecks.map((check) => check.evidence).slice(0, 4),
        cta: primaryMissingCheck ? { label: primaryMissingCheck.label, section: primaryMissingCheck.section } : undefined,
      };
    }

    if (taskStats.total === 0) {
      return {
        tone: 'warn',
        scope,
        headline: 'The planning backbone has not been built yet',
        body: 'Without a WBS, every other planning tab is still estimating in the dark. Start decomposing scope into accountable work packages before trying to optimize cost or governance.',
        evidence: [`${deliverableStats.total} deliverables in scope`, `${milestoneStats.total} milestones available`, budgetEnvelope],
      };
    }

    if (!isWbsLocked) {
      return {
        tone: 'info',
        scope,
        headline: 'WBS is drafted but not yet under governance',
        body: 'Tasks exist, but the planning system still treats them as provisional. Submit the WBS for approval before downstream baselines are frozen.',
        evidence: [`${taskStats.total} tasks defined`, `${milestoneStats.total} milestones mapped`, `Status: ${approvalStatus}`],
        cta: { label: 'Open Planning Gate', section: 'planning-gate' },
      };
    }

    if (taskStats.blocked > 0) {
      return {
        tone: 'warn',
        scope,
        headline: `${taskStats.blocked} blocked tasks already threaten the baseline`,
        body: 'Resolve blocked work before the plan hardens. Dependencies, owners, and milestone dates should be stabilized in planning, not discovered during execution.',
        evidence: [`${taskStats.inProgress} tasks in progress`, `${dependencyCoverage.linked}/${dependencyCoverage.total} tasks sequenced`, `${unassignedTaskCount} tasks without owners`],
        cta: { label: 'Open Dependencies', section: 'dependencies' },
      };
    }

    return {
      tone: 'good',
      scope,
      headline: 'WBS baseline is approved and traceable',
      body: 'COREVIA can now use the work breakdown as the canonical planning backbone for cost, deliverables, resources, dependencies, and gate readiness.',
      evidence: [`${taskStats.total} tasks`, `${milestoneStats.total} milestones`, `${deliverableStats.completed}/${deliverableStats.total} deliverables complete or controlled`],
      cta: { label: 'Open Cost', section: 'cost' },
    };
  }, [
    _sections,
    activeSection,
    actionableTasks.length,
    approval?.status,
    assignedTaskCount,
    availableUsers.length,
    deliverableCoverage,
    deliverableStats,
    dependencyCoverage,
    isPersistedCostBaselineLocked,
    isWbsLocked,
    milestoneStats,
    persistedCbsCount,
    plannedResourceCount,
    projectApprovedBudget,
    projectCurrency,
    riskApproval?.status,
    taskStats,
    unassignedTaskCount,
  ]);

  const planningAssistantActions = useMemo<PlanningAssistantAction[]>(() => {
    type RankedPlanningAction = PlanningAssistantAction & { priority: number };

    const actions: RankedPlanningAction[] = [];
    const seen = new Map<string, RankedPlanningAction>();
    const unsequencedTasks = actionableTasks.filter((task) => extractTaskDependencyCodes(task).length === 0);
    const blockedPlanningTasks = actionableTasks.filter((task) => task.status === 'blocked');
    const summarizeTasks = (items: WbsTaskData[]): string => {
      if (items.length === 0) return 'work packages';
      const labels = items
        .map((task) => task.title?.trim() || task.taskCode || task.wbsCode || '')
        .filter((label) => label.length > 0);
      const [firstLabel] = labels;

      if (!firstLabel) return 'work packages';
      if (labels.length === 1) return firstLabel;
      return `${firstLabel} +${labels.length - 1} more`;
    };
    const summarizeDeliverables = (): string => {
      const labels = deliverableRelationships
        .map((entry) => entry.name?.trim() || '')
        .filter((label) => label.length > 0);
      const [firstLabel] = labels;

      if (!firstLabel) return 'deliverables';
      if (labels.length === 1) return firstLabel;
      return `${firstLabel} +${labels.length - 1} more`;
    };

    const pushAction = (action: RankedPlanningAction | null) => {
      if (!action) return;
      const existing = seen.get(action.id);
      if (!existing || existing.priority < action.priority) {
        seen.set(action.id, action);
      }
    };

    if (taskStats.total === 0) {
      pushAction({
        id: 'create-wbs-task',
        label: 'Create the first governed work package',
        detail: 'Planning still has no WBS backbone, so every downstream tab is estimating without accountable scope.',
        kind: 'create-wbs-task',
        Icon: Plus,
        tone: 'primary',
        priority: 130,
      });
    }

    if (taskStats.total > 0 && !isWbsLocked) {
      pushAction({
        id: 'submit-wbs-for-approval',
        label: 'Move the WBS into governed approval',
        detail: `${taskStats.total} planning task${taskStats.total === 1 ? '' : 's'} exist, but the baseline is still provisional until PMO approval is secured.`,
        kind: 'open-submit-wbs',
        Icon: Send,
        tone: 'primary',
        priority: 122,
      });
    }

    if (unassignedTaskCount > 0) {
      pushAction({
        id: 'assign-task-owners',
        label: `Assign owners to ${unassignedTaskCount} work package${unassignedTaskCount === 1 ? '' : 's'}`,
        detail: `${summarizeTasks(actionableTasks.filter((task) => !task.assignedTo?.trim()))} ${unassignedTaskCount === 1 ? 'still has' : 'still have'} no accountable owner in the planning baseline.`,
        kind: 'open-wbs-view',
        viewMode: 'list',
        Icon: UserCheck,
        tone: 'caution',
        priority: 118,
      });
    }

    if (dependencyCoverage.missing > 0) {
      pushAction({
        id: 'inspect-schedule-logic',
        label: `Sequence ${dependencyCoverage.missing} floating task${dependencyCoverage.missing === 1 ? '' : 's'}`,
        detail: `${summarizeTasks(unsequencedTasks)} ${dependencyCoverage.missing === 1 ? 'is' : 'are'} still disconnected from predecessor logic, which weakens schedule credibility.`,
        kind: 'open-wbs-view',
        viewMode: 'schedule',
        Icon: GitBranch,
        tone: 'caution',
        priority: 116,
      });
    }

    if (blockedPlanningTasks.length > 0) {
      pushAction({
        id: 'resolve-blocked-planning-work',
        label: `Resolve ${blockedPlanningTasks.length} blocked planning task${blockedPlanningTasks.length === 1 ? '' : 's'}`,
        detail: `${summarizeTasks(blockedPlanningTasks)} ${blockedPlanningTasks.length === 1 ? 'is' : 'are'} already blocked before baseline lock.`,
        kind: 'navigate',
        section: 'dependencies',
        Icon: AlertCircle,
        tone: 'caution',
        priority: 114,
      });
    }

    if (deliverableStats.total === 0) {
      pushAction({
        id: 'define-deliverables',
        label: 'Define governed deliverables',
        detail: 'Scope has not been expressed as deliverables yet, so planning cannot prove outcome traceability.',
        kind: 'navigate',
        section: 'deliverables',
        Icon: Package,
        tone: 'caution',
        priority: 112,
      });
    } else if (deliverableCoverage.unmappedTasks > 0 || deliverableCoverage.unmappedMilestones > 0) {
      const totalTraceabilityGaps = deliverableCoverage.unmappedTasks + deliverableCoverage.unmappedMilestones;
      pushAction({
        id: 'check-deliverable-traceability',
        label: `Repair ${totalTraceabilityGaps} deliverable traceability gap${totalTraceabilityGaps === 1 ? '' : 's'}`,
        detail: `${summarizeDeliverables()} still ${deliverableCoverage.unmappedTasks > 0 ? 'needs task linkage' : 'needs milestone linkage'} before the baseline can be defended.`,
        kind: 'navigate',
        section: 'deliverables',
        Icon: Layers,
        tone: 'caution',
        priority: 110,
      });
    }

    if (taskStats.total > 0 && riskApproval?.status !== 'approved') {
      pushAction({
        id: 'open-risk-approval',
        label: 'Close the risk approval gap',
        detail: `The risk register is still ${riskApproval?.status || 'unapproved'}, so baseline confidence is weaker than the work graph suggests.`,
        kind: 'navigate',
        section: 'risk-register',
        Icon: Shield,
        tone: 'neutral',
        priority: 108,
      });
    }

    if (taskStats.total > 0 && !isPersistedCostBaselineLocked && persistedCbsCount < 3) {
      pushAction({
        id: 'shape-cost-baseline',
        label: 'Shape the CBS and baseline envelope',
        detail: `Only ${persistedCbsCount} CBS line${persistedCbsCount === 1 ? ' is' : 's are'} persisted and the cost baseline is not locked yet.`,
        kind: 'navigate',
        section: 'cost',
        Icon: Wallet,
        tone: 'neutral',
        priority: 106,
      });
    }

    if (taskStats.total > 0 && plannedResourceCount === 0) {
      pushAction({
        id: 'open-resource-model',
        label: 'Model the planning resource pool',
        detail: 'The plan contains work packages but no resource pool has been modeled yet.',
        kind: 'navigate',
        section: 'resources',
        Icon: Users,
        tone: 'neutral',
        priority: 102,
      });
    }

    if (wbsBrainDecision?.decisionId && (activeSection === 'planning-gate' || activeSection === 'wbs')) {
      pushAction({
        id: 'review-brain-governance',
        label: 'Inspect Brain governance signals',
        detail: 'Review the reasoning behind the current planning-readiness posture before escalating the baseline.',
        kind: 'open-brain-governance',
        Icon: Shield,
        tone: 'neutral',
        priority: 74,
      });
    }

    if (taskStats.total > 0 && (activeSection === 'planning-gate' || activeSection === 'wbs')) {
      pushAction({
        id: 'review-approval-history',
        label: 'Review the approval trail',
        detail: 'Check the PMO decision trail before resubmitting or freezing the baseline.',
        kind: 'open-approval-history',
        Icon: History,
        tone: 'neutral',
        priority: 70,
      });
    }

    if (planningAssistant.cta && planningAssistant.cta.section !== activeSection) {
      const targetLabel = _sections.find((section) => section.id === planningAssistant.cta?.section)?.label ?? planningAssistant.cta.label;
      pushAction({
        id: `open-${planningAssistant.cta.section}`,
        label: planningAssistant.cta.label,
        detail: `Jump to ${targetLabel} if you want to work the next section COREVIA has flagged after the current gaps are closed.`,
        kind: 'navigate',
        section: planningAssistant.cta.section,
        Icon: ArrowRight,
        tone: seen.size === 0 ? 'primary' : 'neutral',
        priority: seen.size === 0 ? 96 : 62,
      });
    }

    actions.push(...seen.values());
    return actions
      .sort((left, right) => right.priority - left.priority)
      .slice(0, 3)
      .map(({ priority: _priority, ...action }) => action);
  }, [
    _sections,
    activeSection,
    actionableTasks,
    dependencyCoverage.missing,
    deliverableCoverage.unmappedMilestones,
    deliverableCoverage.unmappedTasks,
    deliverableRelationships,
    deliverableStats.total,
    isWbsLocked,
    isPersistedCostBaselineLocked,
    planningAssistant.cta,
    plannedResourceCount,
    persistedCbsCount,
    riskApproval?.status,
    taskStats.total,
    unassignedTaskCount,
    wbsBrainDecision?.decisionId,
  ]);

  const executePlanningAssistantAction = (action: PlanningAssistantAction) => {
    switch (action.kind) {
      case 'navigate':
        if (action.section) onSubTabChange?.(action.section);
        return;
      case 'create-wbs-task':
        onSubTabChange?.('wbs');
        setWbsViewMode('list');
        onAddTask();
        return;
      case 'open-submit-wbs':
        onSubTabChange?.('wbs');
        setWbsViewMode('schedule');
        setShowSubmitDialog(true);
        return;
      case 'open-approval-history':
        onSubTabChange?.('wbs');
        setShowApprovalHistory(true);
        return;
      case 'open-brain-governance':
        onSubTabChange?.('wbs');
        setShowBrainGovernance(true);
        return;
      case 'open-wbs-view':
        onSubTabChange?.('wbs');
        if (action.viewMode) setWbsViewMode(action.viewMode);
        return;
      default:
        return;
    }
  };

  const planningDeliverablesView = useMemo(() => {
    const relationshipPool = deliverableRelationships;
    const usedKeys = new Set<string>();

    const packageCards = PLANNING_DELIVERABLE_TEMPLATES.map((template) => {
      const matched = relationshipPool.filter((entry) => {
        const haystack = normalizePlanningKey([
          entry.name,
          entry.description,
          entry.phase,
          ...entry.linkedMilestones.map((milestone) => milestone.name),
        ].filter(Boolean).join(' '));
        return template.keywords.some((keyword) => haystack.includes(keyword));
      });

      matched.forEach((entry) => usedKeys.add(entry.key));

      const artifacts = matched.length > 0
        ? matched.map((entry) => {
            const milestoneCount = entry.linkedMilestones.length;
            const linkedTask = entry.taskCode ? deliverableTaskByCode.get(entry.taskCode) : undefined;
            const override = planningArtifactOverrideByOriginKey.get(entry.key);
            const effectiveStatus = override?.status ?? entry.status;
            const effectiveDelivered = override?.delivered ?? entry.delivered;
            let lifecycle: PlanningPackageStatus = 'planned';
            if (effectiveStatus === 'checked' || effectiveStatus === 'approved' || effectiveDelivered || effectiveStatus === 'completed') lifecycle = 'controlled';
            else if (effectiveStatus === 'blocked') lifecycle = 'gap';
            else if (effectiveStatus === 'in_progress' || entry.taskCount > 0 || milestoneCount > 0) lifecycle = 'in_build';

            return {
              key: entry.key,
              name: entry.name,
              description: override?.description || entry.description || 'Project-specific planning output captured from the workspace and business case.',
              phase: entry.phase || 'Planning',
              sourceLabel: entry.source === 'milestone'
                ? 'Milestone linked'
                : entry.source === 'phase'
                  ? 'Phase plan'
                  : entry.source === 'expected'
                    ? 'Expected output'
                    : 'Business case',
              lifecycle,
                    status: effectiveStatus,
                    delivered: effectiveDelivered,
              taskCount: entry.taskCount,
              taskCodes: entry.taskCodes,
              linkedMilestones: entry.linkedMilestones,
              isFallback: false,
              sourceType: linkedTask ? ('task' as const) : ('planning' as const),
              taskId: linkedTask?.id,
            };
          })
        : isWbsLocked
          // WBS is approved — the deliverables register must be 100% anchored
          // to the approved baseline. Suppress fabricated "Professional
          // standard" placeholders for buckets that have no matching artifact
          // in the approved WBS; those buckets render as a flagged "gap" card
          // so the PM can tell a real gap from a populated package.
          ? [] as const
          : template.defaults
            .map((item, index) => {
              const fallbackKey = `${template.id}-${index}`;
              const override = planningArtifactOverrideByOriginKey.get(fallbackKey);
              if (override?.deleted) return null;

              let lifecycle: PlanningPackageStatus = 'gap';
              if (override?.status === 'checked' || override?.status === 'approved' || override?.delivered || override?.status === 'completed') lifecycle = 'controlled';
              else if (override?.status === 'in_progress') lifecycle = 'in_build';
              else if (override?.status === 'planned' || override?.status === 'pending') lifecycle = 'planned';

              return {
                key: fallbackKey,
                name: override?.name || item.name,
                description: override?.description || item.description,
                phase: override?.phase || 'Planning',
                sourceLabel: override ? 'Planning draft' : 'Professional standard',
                lifecycle,
                status: override?.status || 'pending',
                delivered: override?.delivered || false,
                taskCount: 0,
                taskCodes: [],
                linkedMilestones: [],
                isFallback: true,
                sourceType: 'planning' as const,
              };
            })
            .filter(isNonNull);

      const baselineCount = artifacts.filter((artifact) => artifact.lifecycle === 'controlled').length;
  const taskCoverage = new Set(artifacts.flatMap((artifact) => artifact.taskCodes)).size;
      const gateCoverage = new Set(artifacts.flatMap((artifact) => artifact.linkedMilestones.map((milestone) => milestone.key))).size;

      // Package status reflects the actual readiness of the rendered artifact
      // list — whether those came from matched WBS entries or from the
      // fallback "professional standard" catalog. Previously the 'controlled'
      // / 'in_build' / 'planned' promotion only ran when `matched.length > 0`,
      // which meant fallback-populated packages stayed permanently on 'gap'
      // even after every artifact was checked, and the top-line
      // `baselineReadyCount` KPI never advanced. We now derive the package
      // status from the artifact lifecycles directly.
      let packageStatus: PlanningPackageStatus = 'gap';
      if (artifacts.length > 0) {
        if (baselineCount === artifacts.length) packageStatus = 'controlled';
        else if (artifacts.some((artifact) => artifact.lifecycle === 'in_build' || artifact.lifecycle === 'controlled')) packageStatus = 'in_build';
        else if (matched.length > 0 || artifacts.some((artifact) => artifact.lifecycle === 'planned')) packageStatus = 'planned';
      }

      return {
        ...template,
        hasActualData: matched.length > 0,
        artifacts,
        baselineCount,
        readinessPct: artifacts.length > 0 ? Math.round((baselineCount / artifacts.length) * 100) : 0,
        taskCoverage,
        gateCoverage,
        packageStatus,
      };
    });

    // WBS alignment guarantee: any deliverable from the approved WBS or the
    // business case that didn't match a template bucket keyword gets its own
    // "Other WBS deliverables" package. This stops real artifacts from
    // disappearing silently just because their title doesn't contain a
    // template keyword — the tab stays 100% aligned with the WBS.
    if (isWbsLocked) {
      const orphans = relationshipPool.filter((entry) => !usedKeys.has(entry.key));
      if (orphans.length > 0) {
        const orphanArtifacts = orphans.map((entry) => {
          const milestoneCount = entry.linkedMilestones.length;
          const linkedTask = entry.taskCode ? deliverableTaskByCode.get(entry.taskCode) : undefined;
          const override = planningArtifactOverrideByOriginKey.get(entry.key);
          const effectiveStatus = override?.status ?? entry.status;
          const effectiveDelivered = override?.delivered ?? entry.delivered;
          let lifecycle: PlanningPackageStatus = 'planned';
          if (effectiveStatus === 'checked' || effectiveStatus === 'approved' || effectiveDelivered || effectiveStatus === 'completed') lifecycle = 'controlled';
          else if (effectiveStatus === 'blocked') lifecycle = 'gap';
          else if (effectiveStatus === 'in_progress' || entry.taskCount > 0 || milestoneCount > 0) lifecycle = 'in_build';
          return {
            key: entry.key,
            name: entry.name,
            description: override?.description || entry.description || 'Project-specific planning output captured from the workspace and business case.',
            phase: entry.phase || 'Planning',
            sourceLabel: entry.source === 'milestone'
              ? 'Milestone linked'
              : entry.source === 'phase'
                ? 'Phase plan'
                : entry.source === 'expected'
                  ? 'Expected output'
                  : 'Business case',
            lifecycle,
            status: effectiveStatus,
            delivered: effectiveDelivered,
            taskCount: entry.taskCount,
            taskCodes: entry.taskCodes,
            linkedMilestones: entry.linkedMilestones,
            isFallback: false,
            sourceType: linkedTask ? ('task' as const) : ('planning' as const),
            taskId: linkedTask?.id,
          };
        });
        const orphanBaselineCount = orphanArtifacts.filter((a) => a.lifecycle === 'controlled').length;
        let orphanStatus: PlanningPackageStatus = 'planned';
        if (orphanBaselineCount === orphanArtifacts.length) orphanStatus = 'controlled';
        else if (orphanArtifacts.some((a) => a.lifecycle === 'in_build')) orphanStatus = 'in_build';
        const orphanCard = {
          id: 'other-wbs-deliverables',
          title: 'Other WBS Deliverables',
          description: 'Approved WBS and business-case artifacts that do not fit any of the standard PMBOK baseline buckets.',
          icon: Package,
          keywords: [] as readonly string[],
          defaults: [] as readonly { name: string; description: string }[],
          hasActualData: true,
          artifacts: orphanArtifacts,
          baselineCount: orphanBaselineCount,
          readinessPct: orphanArtifacts.length > 0 ? Math.round((orphanBaselineCount / orphanArtifacts.length) * 100) : 0,
          taskCoverage: new Set(orphanArtifacts.flatMap((a) => a.taskCodes)).size,
          gateCoverage: new Set(orphanArtifacts.flatMap((a) => a.linkedMilestones.map((m) => m.key))).size,
          packageStatus: orphanStatus,
        };
        (packageCards as unknown as Array<typeof orphanCard>).push(orphanCard);
      }
    }

    return {
      packageCards,
      baselineReadyCount: packageCards.filter((pkg) => pkg.packageStatus === 'controlled' || pkg.packageStatus === 'in_build').length,
      taskBackedCount: packageCards.reduce((sum, pkg) => sum + pkg.artifacts.filter((artifact) => artifact.taskCount > 0).length, 0),
      gateLinkedCount: packageCards.reduce((sum, pkg) => sum + pkg.artifacts.filter((artifact) => artifact.linkedMilestones.length > 0).length, 0),
      actualPackageCount: packageCards.filter((pkg) => pkg.hasActualData).length,
    };
  }, [deliverableRelationships, deliverableTaskByCode, planningArtifactOverrideByOriginKey, isWbsLocked]);
  const selectedPlanningPackage = useMemo(
    () => planningDeliverablesView.packageCards.find((pkg) => pkg.id === expandedPlanningPackage) || planningDeliverablesView.packageCards[0],
    [expandedPlanningPackage, planningDeliverablesView.packageCards],
  );

  useEffect(() => {
    if (!editingPlanningArtifact) return;
    setPlanningArtifactDraft({
      name: editingPlanningArtifact.name,
      phase: editingPlanningArtifact.phase,
      description: editingPlanningArtifact.description,
    });
  }, [editingPlanningArtifact]);

  const persistPlanningArtifactOverride = (
    artifact: PlanningPackageArtifact,
    patch: Partial<PlanningArtifactOverride>,
    messages: {
      successTitle: string;
      successDescription: string;
      errorTitle: string;
      errorDescription: string;
      closeEditor?: boolean;
      closeDelete?: boolean;
    },
  ) => {
    const existingOverride = planningArtifactOverrideByOriginKey.get(artifact.key);
    const nextOverride: PlanningArtifactOverride = {
      originKey: artifact.key,
      mode: existingOverride?.mode || (artifact.isFallback ? 'manual' : 'override'),
      name: patch.name ?? existingOverride?.name ?? artifact.name,
      description: patch.description ?? existingOverride?.description ?? artifact.description,
      phase: patch.phase ?? existingOverride?.phase ?? artifact.phase,
      status: patch.status ?? existingOverride?.status ?? artifact.status,
      delivered: patch.delivered ?? existingOverride?.delivered ?? artifact.delivered,
      source: patch.source ?? existingOverride?.source ?? (artifact.isFallback ? 'charter' : undefined),
      deleted: patch.deleted ?? false,
    };

    updatePlanningArtifactsMutation.mutate({
      overrides: upsertPlanningArtifactOverride(planningArtifactOverrides, nextOverride),
      ...messages,
    });
  };

  const handlePlanningArtifactConfirm = (artifact: PlanningPackageArtifact) => {
    persistPlanningArtifactOverride(
      artifact,
      { status: 'checked', delivered: false },
      {
        successTitle: 'Planning artifact checked',
        successDescription: 'The artifact is checked and ready to be managed through execution and monitoring without being marked complete.',
        errorTitle: 'Unable to check artifact',
        errorDescription: 'The planning artifact could not be checked for execution management.',
      },
    );
  };

  const handlePlanningArtifactEdit = (artifact: PlanningPackageArtifact) => {
    if (artifact.sourceType === 'task' && artifact.taskId) {
      const linkedTask = tasks.find((task) => task.id === artifact.taskId);
      if (linkedTask) {
        setEditingTask(linkedTask);
        return;
      }
    }

    setEditingPlanningArtifact(artifact);
  };

  const handlePlanningArtifactDelete = (artifact: PlanningPackageArtifact) => {
    if (artifact.sourceType === 'task' && artifact.taskId) {
      const linkedTask = tasks.find((task) => task.id === artifact.taskId);
      if (linkedTask) {
        setDeletingTask(linkedTask);
        return;
      }
    }

    setDeletingPlanningArtifact(artifact);
  };

  const savePlanningArtifactDraft = () => {
    if (!editingPlanningArtifact) return;

    persistPlanningArtifactOverride(
      editingPlanningArtifact,
      {
        name: planningArtifactDraft.name.trim() || editingPlanningArtifact.name,
        phase: planningArtifactDraft.phase.trim() || 'Planning',
        description: planningArtifactDraft.description.trim() || editingPlanningArtifact.description,
        deleted: false,
      },
      {
        successTitle: 'Planning artifact updated',
        successDescription: 'The planning package artifact was updated successfully.',
        errorTitle: 'Unable to update artifact',
        errorDescription: 'The planning artifact changes could not be saved.',
        closeEditor: true,
      },
    );
  };

  const openInlineNotes = (task: WbsTaskData) => {
    setInlineNotesTaskId(task.id);
    setInlineNotesDraft(task.notes || task.description || '');
  };

  const saveInlineNotes = (task: WbsTaskData) => {
    updateTaskMutation.mutate(
      { id: task.id, updates: { notes: inlineNotesDraft } },
      {
        onSuccess: () => {
          setInlineNotesTaskId(null);
          setInlineNotesDraft('');
        },
      },
    );
  };

  useEffect(() => {
    setCostBaselineDraft({
      approvedBudget: projectApprovedBudget > 0 ? String(Math.round(projectApprovedBudget)) : '',
      actualSpend: projectActualSpend > 0 ? String(Math.round(projectActualSpend)) : '',
      forecastSpend: projectForecastSpend > 0 ? String(Math.round(projectForecastSpend)) : '',
      currency: projectCurrency,
    });
  }, [projectApprovedBudget, projectActualSpend, projectForecastSpend, projectCurrency]);

  useEffect(() => {
    const dp: Record<string, string> = {};
    for (const [k, v] of Object.entries(domainParameters)) {
      const n = Number(v);
      dp[k] = Number.isFinite(n) ? String(n) : '';
    }
    setBusinessCaseBudgetDraft({
      totalCostEstimate: safeRound(totalCostEstimate),
      implementationPeople: safeRound(implementationCosts.people),
      implementationTechnology: safeRound(implementationCosts.technology),
      implementationIntegration: safeRound(implementationCosts.integration),
      implementationChangeManagement: safeRound(implementationCosts.changeManagement),
      operatingAnnualRunCost: safeRound(operationalCosts.annualRunCost),
      operatingMaintenance: safeRound(operationalCosts.maintenance),
      operatingSupport: safeRound(operationalCosts.support),
      domainParams: dp,
      contingencyPercent: asPercentString(financialAssumptions?.contingencyPercent),
      maintenancePercent: asPercentString(financialAssumptions?.maintenancePercent),
      adoptionRate: asPercentString(financialAssumptions?.adoptionRate),
      discountRate: asPercentString(financialAssumptions?.discountRate),
    });
  }, [domainParameters, financialAssumptions, implementationCosts, operationalCosts, totalCostEstimate]);

  // Cost breakdown calculations based on WBS tasks
  const costBreakdown = useMemo(
    () => computeCostBreakdown(tasks, bc as Record<string, unknown> | undefined, projectApprovedBudget, projectActualSpend, totalCostEstimate),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [tasks, bc, projectApprovedBudget, projectActualSpend]);

  const costLedgerRows = useMemo<CostLedgerRow[]>(
    () => computeCostLedgerRows(tasks, costBreakdown.parentTaskCodes, costBreakdown.defaultHourlyRate),
    [tasks, costBreakdown.defaultHourlyRate, costBreakdown.parentTaskCodes],
  );

  const filteredCostLedgerRows = useMemo(
    () => computeFilteredCostLedgerRows(costLedgerRows, costTaskFilter, costTaskSearch),
    [costLedgerRows, costTaskFilter, costTaskSearch],
  );

  const _costWorkspaceSummary = useMemo(
    () => computeCostWorkspaceSummary(costBaselineDraft, costBreakdown, costLedgerRows),
    [costBaselineDraft, costBreakdown, costLedgerRows],
  );

  const costFormatter = useMemo(() => new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: costBaselineDraft.currency || projectCurrency,
    maximumFractionDigits: 0,
  }), [costBaselineDraft.currency, projectCurrency]);

  const businessCaseCostBreakdown = useMemo(
    () => computeBusinessCaseCostBreakdown(implementationCosts, operationalCosts, totalCostEstimate),
    [implementationCosts, operationalCosts, totalCostEstimate],
  );

  const fmCostItems = useMemo<FmCostItem[]>(() => {
    const raw = (computedFinancialModel?.costs as FmCostItem[] | undefined) || [];
    return raw.filter(c => c.name && c.category);
  }, [computedFinancialModel?.costs]);

  const lifecycleCostTotal = useMemo(
    () => safeNum((computedFinancialModel?.metrics as Record<string, unknown> | undefined)?.totalCosts),
    [computedFinancialModel?.metrics],
  );

  const businessCaseBudgetArchitecture = useMemo(
    () => computeBusinessCaseBudgetArchitecture(businessCaseArchetype, businessCaseBudgetDraft, businessCaseCostBreakdown.total, costFormatter, fmCostItems),
    [businessCaseArchetype, businessCaseBudgetDraft, businessCaseCostBreakdown.total, costFormatter, fmCostItems],
  );

  const budgetArchitectureLedgerRows = useMemo<BudgetArchitectureLedgerRow[]>(
    () => computeBudgetArchitectureLedgerRows(businessCaseBudgetArchitecture, businessCaseCostBreakdown),
    [businessCaseBudgetArchitecture, businessCaseCostBreakdown],
  );

  const budgetArchitectureLedgerTotal = useMemo(
    () => budgetArchitectureLedgerRows.reduce((sum, row) => sum + row.currentAmount, 0),
    [budgetArchitectureLedgerRows],
  );

  const budgetFinancialPicture = useMemo(
    () => computeBudgetFinancialPicture(businessCaseBudgetArchitecture, costBreakdown.totalPlannedCost),
    [businessCaseBudgetArchitecture, costBreakdown.totalPlannedCost],
  );

  const baseFiscalYear = useMemo(
    () => resolveBaseFiscalYear(tasks, project, timeline as TimelineData | string | undefined),
    [tasks, project, timeline],
  );

  const annualPlanSource = useMemo(
    () => (bcMeta?.annualCostPlan as AnnualCostPlanRow[] | undefined) || businessCase?.annualCostPlan || [],
    [bcMeta?.annualCostPlan, businessCase?.annualCostPlan],
  );

  const deliverableBaselineSource = useMemo(() => {
    const rootMeta = bcMeta?.multiAgentMetadata;
    if (!rootMeta || typeof rootMeta !== 'object') return [];
    const costWorkspace = (rootMeta as Record<string, unknown>).costWorkspace;
    if (!costWorkspace || typeof costWorkspace !== 'object') return [];
    return (costWorkspace as Record<string, unknown>).deliverableBaselines;
  }, [bcMeta?.multiAgentMetadata]);

  const suggestedContractRegister = useMemo(
    () => buildSuggestedContractRegister(businessCaseCostBreakdown, costBreakdown.phaseBreakdown, businessCaseArchetype, baseFiscalYear, businessCaseBudgetArchitecture.total),
    [businessCaseArchetype, businessCaseBudgetArchitecture.total, businessCaseCostBreakdown, costBreakdown.phaseBreakdown, baseFiscalYear],
  );

  const contractRegisterSource = useMemo(
    () => (bcMeta?.contractRegister as ContractRegisterItem[] | undefined) || businessCase?.contractRegister || [],
    [bcMeta?.contractRegister, businessCase?.contractRegister],
  );

  // Compute WBS planned cost per year index for budget target alignment
  const wbsYearlyPlanned = useMemo(() => {
    const yearly = COST_YEAR_INDICES.map(() => 0);
    tasks
      .filter((task) => !costBreakdown.parentTaskCodes.has(task.taskCode || ''))
      .forEach((task) => {
        const taskYear = parseDateYear(task.plannedStartDate) ?? parseDateYear(task.plannedEndDate) ?? baseFiscalYear;
        const yearIndex = Math.max(0, Math.min(5, taskYear - baseFiscalYear));
        const plannedCost = safeNum(task.plannedCost) || safeNum(task.estimatedHours) * costBreakdown.defaultHourlyRate;
        yearly[yearIndex] = (yearly[yearIndex] || 0) + plannedCost;
      });
    return yearly;
  }, [tasks, costBreakdown.parentTaskCodes, costBreakdown.defaultHourlyRate, baseFiscalYear]);

  useEffect(() => {
    setAnnualCostPlanDraft(buildAnnualCostPlanDraftRows(annualPlanSource, baseFiscalYear, fmCostItems, businessCaseBudgetArchitecture.total, wbsYearlyPlanned));
  }, [annualPlanSource, baseFiscalYear, businessCaseBudgetArchitecture.total, fmCostItems, wbsYearlyPlanned]);

  useEffect(() => {
    setContractRegisterDraft(buildContractRegisterDraftRows(contractRegisterSource, suggestedContractRegister));
  }, [contractRegisterSource, suggestedContractRegister]);

  useEffect(() => {
    setDeliverableBaselineDraft(createDeliverableBaselineDraftRows(deliverableBaselineSource, aggregateDeliverableBaseline(costLedgerRows)));
  }, [costLedgerRows, deliverableBaselineSource]);

  const annualCostPlanPayload = useMemo<AnnualCostPlanRow[]>(
    () => annualCostPlanDraft.map((row) => ({
      yearIndex: row.yearIndex,
      fiscalYear: row.fiscalYear,
      budgetTarget: parseNumericInput(row.budgetTarget),
      capexTarget: parseNumericInput(row.capexTarget),
      opexTarget: parseNumericInput(row.opexTarget),
      notes: row.notes.trim() || undefined,
    })),
    [annualCostPlanDraft],
  );

  const contractRegisterPayload = useMemo<ContractRegisterItem[]>(
    () => contractRegisterDraft.map((contract) => ({
      id: contract.id,
      contractName: contract.contractName.trim(),
      vendor: contract.vendor.trim() || undefined,
      contractType: contract.contractType.trim() || undefined,
      costClass: contract.costClass,
      procurementRoute: contract.procurementRoute.trim() || undefined,
      status: contract.status.trim() || 'planned',
      startYear: parseNumericInput(contract.startYear, baseFiscalYear),
      endYear: parseNumericInput(contract.endYear, parseNumericInput(contract.startYear, baseFiscalYear)),
      totalValue: parseNumericInput(contract.totalValue),
      committedValue: parseNumericInput(contract.committedValue),
      invoicedValue: parseNumericInput(contract.invoicedValue),
      retentionPercent: parseNumericInput(contract.retentionPercent),
      milestone: contract.milestone.trim() || undefined,
      linkedPhase: contract.linkedPhase.trim() || undefined,
      notes: contract.notes.trim() || undefined,
    })),
    [baseFiscalYear, contractRegisterDraft],
  );

  const deliverableBaselinePayload = useMemo(
    () => deliverableBaselineDraft.map((row) => ({
      key: row.key,
      code: row.code,
      name: row.name,
      phaseLabel: row.phaseLabel,
      fiscalLabel: row.fiscalLabel,
      taskCount: row.taskCount,
      unpricedTaskCount: row.unpricedTaskCount,
      costClass: row.costClass,
      baselineAmount: parseNumericInput(row.baselineAmount),
    })),
    [deliverableBaselineDraft],
  );

  const annualCostWorkspaceRows = useMemo(
    () => computeAnnualCostWorkspaceRows(
      annualCostPlanDraft,
      baseFiscalYear,
      tasks,
      (computedFinancialModel?.costs as Array<Record<string, unknown>> | undefined) || [],
      (computedFinancialModel?.benefits as Array<Record<string, unknown>> | undefined) || [],
      contractRegisterDraft,
      costBreakdown.defaultHourlyRate,
      costBreakdown.parentTaskCodes,
      businessCaseBudgetArchitecture.total,
    ),
    [annualCostPlanDraft, baseFiscalYear, businessCaseBudgetArchitecture.total, computedFinancialModel?.benefits, computedFinancialModel?.costs, contractRegisterDraft, costBreakdown.defaultHourlyRate, costBreakdown.parentTaskCodes, tasks],
  );

  const contractRegisterSummary = useMemo(
    () => computeContractRegisterSummary(contractRegisterDraft),
    [contractRegisterDraft],
  );

  const annualPlanSummary = useMemo(() => {
    const budgetTarget = annualCostWorkspaceRows.reduce((sum, row) => sum + row.budgetTarget, 0);
    const fmCost = annualCostWorkspaceRows.reduce((sum, row) => sum + row.fmCost, 0);
    const fmBenefitsTotal = annualCostWorkspaceRows.reduce((sum, row) => sum + row.fmBenefits, 0);
    const wbsPlanned = annualCostWorkspaceRows.reduce((sum, row) => sum + row.wbsPlanned, 0);
    const contractCommitted = annualCostWorkspaceRows.reduce((sum, row) => sum + row.contractCommitted, 0);
    const remainingCapacity = annualCostWorkspaceRows.reduce((sum, row) => sum + row.remainingCapacity, 0);
    const capexTarget = annualCostWorkspaceRows.reduce((sum, row) => sum + row.capexTarget, 0);
    const opexTarget = annualCostWorkspaceRows.reduce((sum, row) => sum + row.opexTarget, 0);

    return {
      budgetTarget,
      fmCost,
      fmBenefits: fmBenefitsTotal,
      wbsPlanned,
      contractCommitted,
      remainingCapacity,
      capexTarget,
      opexTarget,
    };
  }, [annualCostWorkspaceRows]);

  const costCockpitSummary = useMemo(() => {
    // The "allocated" amount is the greater of: WBS task planned costs OR contract register total.
    // They represent the same budget from different lenses, so we take the max to avoid double-counting.
    const rawAllocated = Math.max(contractRegisterSummary.totalValue, costBreakdown.totalPlannedCost);
    const budget = businessCaseBudgetArchitecture.total;
    // Tolerance: if allocated is within 1% of budget, treat as fully aligned.
    // Task-level derivation (hours × rate) naturally introduces minor rounding variance.
    const toleranceBand = budget * 0.01;
    const allocated = Math.abs(rawAllocated - budget) <= toleranceBand ? budget : rawAllocated;
    const unallocated = budget - allocated;
    // CAPEX/OPEX shares come from the budget architecture — the canonical decomposition of the 30M.
    return {
      allocated,
      unallocated,
      reserve: unallocated,
      capexShare: budget > 0 ? (businessCaseBudgetArchitecture.implementationTotal / budget) * 100 : 0,
      opexShare: budget > 0 ? (businessCaseBudgetArchitecture.operatingTotal / budget) * 100 : 0,
    };
  }, [businessCaseBudgetArchitecture.implementationTotal, businessCaseBudgetArchitecture.operatingTotal, businessCaseBudgetArchitecture.total, contractRegisterSummary.totalValue, costBreakdown.totalPlannedCost]);

  const updateAnnualCostPlanRow = (yearIndex: number, field: 'budgetTarget' | 'capexTarget' | 'opexTarget' | 'notes', value: string) => {
    setAnnualCostPlanDraft((current) => current.map((row) => (
      row.yearIndex === yearIndex
        ? { ...row, [field]: field === 'notes' ? value : value.replaceAll(/[^0-9.,-]/g, '') }
        : row
    )));
  };

  const updateContractDraftRow = (contractId: string, field: keyof ContractRegisterDraftRow, value: string) => {
    setContractRegisterDraft((current) => current.map((row) => (
      row.id === contractId
        ? { ...row, [field]: value }
        : row
    )));
  };

  const addContractDraftRow = () => {
    setContractRegisterDraft((current) => ([
      ...current,
      {
        id: createDraftId('contract'),
        contractName: '',
        vendor: '',
        contractType: '',
        costClass: 'capex',
        procurementRoute: 'Competitive tender',
        status: 'planned',
        startYear: String(baseFiscalYear),
        endYear: String(baseFiscalYear),
        totalValue: '',
        committedValue: '',
        invoicedValue: '',
        retentionPercent: '0',
        milestone: '',
        linkedPhase: costBreakdown.phaseBreakdown[0]?.[1]?.name || '',
        notes: '',
      },
    ]));
  };

  const removeContractDraftRow = (contractId: string) => {
    setContractRegisterDraft((current) => current.filter((row) => row.id !== contractId));
  };

  const resetCostWorkspaceDrafts = () => {
    const sr = (v: unknown) => { const n = safeNum(v); return n ? String(Math.round(n)) : ''; };
    const dp: Record<string, string> = {};
    for (const [k, v] of Object.entries(domainParameters)) {
      const n = Number(v);
      dp[k] = Number.isFinite(n) ? String(n) : '';
    }

    setBusinessCaseBudgetDraft({
      totalCostEstimate: sr(totalCostEstimate),
      implementationPeople: sr(implementationCosts.people),
      implementationTechnology: sr(implementationCosts.technology),
      implementationIntegration: sr(implementationCosts.integration),
      implementationChangeManagement: sr(implementationCosts.changeManagement),
      operatingAnnualRunCost: sr(operationalCosts.annualRunCost),
      operatingMaintenance: sr(operationalCosts.maintenance),
      operatingSupport: sr(operationalCosts.support),
      domainParams: dp,
      contingencyPercent: (() => {
        if (typeof financialAssumptions?.contingencyPercent !== 'number') return '';
        const v = financialAssumptions.contingencyPercent <= 1 ? financialAssumptions.contingencyPercent * 100 : financialAssumptions.contingencyPercent;
        return String(Number(v.toFixed(2)));
      })(),
      maintenancePercent: (() => {
        if (typeof financialAssumptions?.maintenancePercent !== 'number') return '';
        const v = financialAssumptions.maintenancePercent <= 1 ? financialAssumptions.maintenancePercent * 100 : financialAssumptions.maintenancePercent;
        return String(Number(v.toFixed(2)));
      })(),
      adoptionRate: (() => {
        if (typeof financialAssumptions?.adoptionRate !== 'number') return '';
        const v = financialAssumptions.adoptionRate <= 1 ? financialAssumptions.adoptionRate * 100 : financialAssumptions.adoptionRate;
        return String(Number(v.toFixed(2)));
      })(),
      discountRate: (() => {
        if (typeof financialAssumptions?.discountRate !== 'number') return '';
        const v = financialAssumptions.discountRate <= 1 ? financialAssumptions.discountRate * 100 : financialAssumptions.discountRate;
        return String(Number(v.toFixed(2)));
      })(),
    });

    setAnnualCostPlanDraft(buildAnnualCostPlanDraftRows(annualPlanSource, baseFiscalYear, fmCostItems, businessCaseBudgetArchitecture.total, wbsYearlyPlanned));
    setContractRegisterDraft(buildContractRegisterDraftRows(contractRegisterSource, suggestedContractRegister));
    setDeliverableBaselineDraft(createDeliverableBaselineDraftRows(deliverableBaselineSource, aggregateDeliverableBaseline(costLedgerRows)));
  };

  const updateDeliverableBaselineDraftRow = (deliverableKey: string, value: string) => {
    setDeliverableBaselineDraft((current) => current.map((row) => (
      row.key === deliverableKey
        ? { ...row, baselineAmount: value.replaceAll(/[^0-9.,-]/g, '') }
        : row
    )));
  };

  const saveCostWorkspace = () => {
    const toDecimal = (value: string) => {
      const parsed = Number.parseFloat(value);
      if (!Number.isFinite(parsed)) return undefined;
      return parsed > 1 ? parsed / 100 : parsed;
    };
    const toNumber = (value: string) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    updateBusinessCaseBudgetMutation.mutate({
      totalCostEstimate: businessCaseBudgetDraft.totalCostEstimate.trim() || '0',
      financialAssumptions: {
        ...(toDecimal(businessCaseBudgetDraft.contingencyPercent) === undefined ? {} : { contingencyPercent: toDecimal(businessCaseBudgetDraft.contingencyPercent)! }),
        ...(toDecimal(businessCaseBudgetDraft.maintenancePercent) === undefined ? {} : { maintenancePercent: toDecimal(businessCaseBudgetDraft.maintenancePercent)! }),
        ...(toDecimal(businessCaseBudgetDraft.adoptionRate) === undefined ? {} : { adoptionRate: toDecimal(businessCaseBudgetDraft.adoptionRate)! }),
        ...(toDecimal(businessCaseBudgetDraft.discountRate) === undefined ? {} : { discountRate: toDecimal(businessCaseBudgetDraft.discountRate)! }),
      },
      implementationCosts: {
        people: toNumber(businessCaseBudgetDraft.implementationPeople),
        technology: toNumber(businessCaseBudgetDraft.implementationTechnology),
        integration: toNumber(businessCaseBudgetDraft.implementationIntegration),
        changeManagement: toNumber(businessCaseBudgetDraft.implementationChangeManagement),
      },
      operationalCosts: {
        annualRunCost: toNumber(businessCaseBudgetDraft.operatingAnnualRunCost),
        maintenance: toNumber(businessCaseBudgetDraft.operatingMaintenance),
        support: toNumber(businessCaseBudgetDraft.operatingSupport),
      },
      domainParameters: Object.fromEntries(
        Object.entries(businessCaseBudgetDraft.domainParams).map(([k, v]) => [k, toNumber(v)]),
      ),
      annualCostPlan: annualCostPlanPayload,
      contractRegister: contractRegisterPayload,
      multiAgentMetadata: {
        ...(((businessCase as Record<string, unknown> | undefined)?.multiAgentMetadata as Record<string, unknown> | undefined) ?? {}),
        costWorkspace: {
          ...((((businessCase as Record<string, unknown> | undefined)?.multiAgentMetadata as Record<string, unknown> | undefined)?.costWorkspace as Record<string, unknown> | undefined) ?? {}),
          deliverableBaselines: deliverableBaselinePayload,
        },
      },
    });
  };

  const beginCostRowEdit = (row: CostLedgerRow) => {
    setEditingCostTaskId(row.id);
    setCostTaskDrafts((current) => ({
      ...current,
      [row.id]: {
        plannedCost: row.explicitPlannedCost > 0 ? String(Math.round(row.explicitPlannedCost)) : String(Math.round(row.planned)),
        actualCost: row.explicitActualCost > 0 ? String(Math.round(row.explicitActualCost)) : String(Math.round(row.actual)),
        estimatedHours: String(Math.round(row.estimatedHours)),
        actualHours: String(Math.round(row.actualHours)),
      },
    }));
  };

  const cancelCostRowEdit = (taskId: string) => {
    setEditingCostTaskId(null);
    setCostTaskDrafts((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
  };

  const planningAssistantSignalKey = `${activeSection}:${planningAssistant.headline}:${planningAssistantActions[0]?.id ?? planningAssistant.cta?.section ?? 'none'}`;
  const showPlanningAssistantSignal = planningAssistant.tone === 'warn';
  const isPlanningAssistantExpanded = showPlanningAssistantSignal && expandedPlanningSignalKey === planningAssistantSignalKey;
  const showPlanningAssistantCard = showPlanningAssistantSignal && isPlanningAssistantExpanded;

  const saveCostRow = (row: CostLedgerRow) => {
    const draft = costTaskDrafts[row.id];
    if (!draft) return;

    updateCostLineMutation.mutate({
      id: row.id,
      updates: {
        plannedCost: draft.plannedCost || '0',
        actualCost: draft.actualCost || '0',
        estimatedHours: Number.parseInt(draft.estimatedHours, 10) || 0,
        actualHours: Number.parseInt(draft.actualHours, 10) || 0,
      },
    });
  };

  // ── Render content in a separate scope to isolate JSX cognitive complexity ──
  const renderContent = () => (
    <div className="space-y-6">
      {showPlanningAssistantSignal && (
        <CoreviaGateSignal
          headline={planningAssistant.headline}
          detail={planningAssistantActions[0]?.detail ?? planningAssistant.body}
          actionCount={planningAssistantActions.length}
          expanded={isPlanningAssistantExpanded}
          onToggle={() => setExpandedPlanningSignalKey((current) => current === planningAssistantSignalKey ? null : planningAssistantSignalKey)}
          testId="planning-corevia-signal"
        />
      )}

      {showPlanningAssistantCard && (
        <CoreviaGateAssistant
          brief={{
            tone: planningAssistant.tone,
            scope: planningAssistant.scope,
            headline: planningAssistant.headline,
            body: planningAssistant.body,
            evidence: planningAssistant.evidence,
            cta: planningAssistant.cta && planningAssistant.cta.section !== activeSection && onSubTabChange
              ? { label: planningAssistant.cta.label, onClick: () => onSubTabChange(planningAssistant.cta!.section) }
              : undefined,
          }}
          actions={planningAssistantActions.map((a) => ({
            id: a.id,
            label: a.label,
            detail: a.detail,
            Icon: a.Icon,
            tone: a.tone,
            onClick: () => executePlanningAssistantAction(a),
          }))}
          testId="planning-corevia-assistant"
        />
      )}

      {activeSection !== 'cost' && (
        <div className="flex items-stretch gap-px rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="flex-1 px-4 py-2.5 border-r border-slate-100 dark:border-slate-800">
            <div className="text-base font-bold tabular-nums text-slate-900 dark:text-white leading-none">{taskStats.total}</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 mt-1">Total Tasks</div>
            <Progress value={progress} className="mt-1.5 h-1" />
          </div>
          <div className="flex-1 px-4 py-2.5 border-r border-slate-100 dark:border-slate-800">
            <div className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400 leading-none">{taskStats.completed}</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 mt-1">Completed</div>
          </div>
          <div className="flex-1 px-4 py-2.5 border-r border-slate-100 dark:border-slate-800">
            <div className="text-base font-bold tabular-nums text-blue-600 dark:text-blue-400 leading-none">{taskStats.inProgress}</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 mt-1">In Progress</div>
          </div>
          <div className="flex-1 px-4 py-2.5 border-r border-slate-100 dark:border-slate-800">
            <div className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400 leading-none">{taskStats.pending}</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 mt-1">Pending</div>
          </div>
          <div className="flex-1 px-4 py-2.5 border-r border-slate-100 dark:border-slate-800">
            <div className="text-base font-bold tabular-nums text-purple-600 dark:text-purple-400 leading-none">{milestoneStats.total}</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 mt-1">Milestones</div>
          </div>
          <div className="flex-1 px-4 py-2.5">
            <div className="text-base font-bold tabular-nums text-indigo-600 dark:text-indigo-400 leading-none">{deliverableStats.total}</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 mt-1">Deliverables</div>
          </div>
        </div>
      )}

      {/* Tabs moved to header - controlled externally via activeSubTab */}

      {activeSection === 'cost' && (() => {
        // Enterprise PM logic: the cost plan is a derivative of an approved WBS
        // baseline. Without it, any CBS line is a guess and any CPI/SPI chart
        // is noise. Lock the cost tab until the WBS is approved, matching the
        // deliverables gate.
        if (!isWbsLocked) {
          const hasAnyWbs = tasks.length > 0;
          return (
            <div className="space-y-4 pb-8">
              <Card className="border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white dark:border-amber-500/30 dark:from-amber-500/10 dark:via-slate-900 dark:to-slate-900">
                <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
                    <Lock className="h-6 w-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="h-5 gap-1 border-amber-300 bg-amber-50 px-1.5 text-[9px] uppercase tracking-[0.14em] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                        <Sparkles className="h-2.5 w-2.5" /> COREVIA Governance
                      </Badge>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        Cost management is locked until the WBS is approved
                      </h3>
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                      The Cost Breakdown Structure, BAC, EVM curves, and reserves are <span className="font-semibold">derivatives of an approved WBS baseline</span>. Pricing work that hasn&apos;t been decomposed, sequenced and approved produces a baseline the sponsor can&apos;t trust and a CPI the PMO can&apos;t defend.
                    </p>
                    <p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {hasAnyWbs
                        ? 'A WBS exists but has not yet been submitted to PMO or approved. Once the WBS baseline is approved, COREVIA will seed the CBS automatically from the approved work packages and align it to the BAC.'
                        : 'No WBS has been generated yet. Decompose scope into a WBS first, then submit it for PMO approval. After approval the cost plan will be seeded from the approved baseline.'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button
                      size="sm"
                      className="gap-1 bg-indigo-600 text-white hover:bg-indigo-700"
                      onClick={() => onSubTabChange?.('wbs')}
                      data-testid="cost-goto-wbs"
                    >
                      <GitBranch className="h-3.5 w-3.5" />
                      {hasAnyWbs ? 'Open WBS & submit for approval' : 'Start the WBS'}
                    </Button>
                    {hasAnyWbs && approval?.status && (
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                        WBS status: {approval.status}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-indigo-500" />
                    What will appear here after WBS approval
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-[12px] text-slate-600 dark:text-slate-300">
                  <ul className="space-y-1.5 list-disc pl-5">
                    <li><span className="font-semibold">CBS seeded from leaf work packages</span> — quantities, units and rates inferred from task type and effort.</li>
                    <li><span className="font-semibold">BAC reconciliation</span> against the approved budget, with proportional allocation and in-tolerance check.</li>
                    <li><span className="font-semibold">Phased cashflow &amp; S-curve</span> built from the WBS schedule, commitments and planned spend.</li>
                    <li><span className="font-semibold">EVM cockpit</span> — CPI, SPI, EAC, VAC driven by the approved baseline rather than assumptions.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          );
        }
        return (
          <CostManagementStudio
            project={project}
            businessCase={businessCase ?? null}
            tasks={tasks}
          />
        );
      })()}

      {activeSection === 'risk-register' && (
        <RiskRegisterPlanning
          businessCase={businessCase ?? null}
          demandReport={demandReport}
          tasks={tasks}
          approvedBudget={Number(project.approvedBudget ?? 0) || 0}
          projectId={project.id}
          approval={riskApproval ? {
            status: riskApproval.status ?? null,
            version: riskApproval.version,
            submittedAt: riskApproval.submittedAt,
            submittedByName: null,
            reviewedAt: riskApproval.reviewedAt,
            reviewedByName: null,
            reviewNotes: riskApproval.reviewNotes,
            rejectionReason: riskApproval.rejectionReason,
            stats: riskApproval.stats,
          } : null}
          onSubmitForApproval={async (payload) => {
            await submitRiskRegisterMutation.mutateAsync(payload);
          }}
          isSubmitting={submitRiskRegisterMutation.isPending}
        />
      )}

      {activeSection === 'planning-gate' && (
        <PlanningGateChecklist
          project={project}
          businessCase={businessCase ?? null}
          demandReport={demandReport ?? null}
          tasks={tasks}
          wbsApproval={approval ? { status: approval.status } : null}
          onNavigate={(section) => onSubTabChange?.(section)}
        />
      )}

      {activeSection === 'wbs' && (
        <Card className={`bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-700 shadow-sm ${isFullPage ? 'fixed inset-0 z-50 bg-background rounded-none border-0 flex flex-col overflow-hidden' : ''}`} data-testid="wbs-card">
          <CardHeader className={`flex flex-row items-center justify-between gap-4 ${isFullPage ? 'shrink-0' : ''}`}>
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Work Breakdown Structure
              </CardTitle>
              <CardDescription className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {tasks.length > 0 && (
                  <span className="text-muted-foreground">
                    {tasks.length} tasks defined • {tasks.filter(t => t.status === 'completed').length} completed
                  </span>
                )}
                {tasks.length === 0 && businessCase && (
                  <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                    <Sparkles className="w-3 h-3" />
                    Business case available - Generate AI tasks
                  </span>
                )}
                {tasks.length === 0 && !businessCase && (
                  <span className="text-muted-foreground">{t('projectWorkspace.planning.noTasksDefinedYet')}</span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-md border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800/50">
                <Button
                  size="sm"
                  variant={wbsViewMode === 'list' ? 'default' : 'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={() => setWbsViewMode('list')}
                  data-testid="button-view-list"
                >
                  <Layers className="w-3 h-3 mr-1" />
                  List
                </Button>
                <Button
                  size="sm"
                  variant={wbsViewMode === 'gantt' ? 'default' : 'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={() => setWbsViewMode('gantt')}
                  data-testid="button-view-gantt"
                >
                  <CalendarDays className="w-3 h-3 mr-1" />
                  Gantt
                </Button>
                <Button
                  size="sm"
                  variant={wbsViewMode === 'schedule' ? 'default' : 'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={() => setWbsViewMode('schedule')}
                  data-testid="button-view-schedule"
                >
                  <Table2 className="w-3 h-3 mr-1" />
                  Schedule
                </Button>
                <Button
                  size="sm"
                  variant={wbsViewMode === 'kanban' ? 'default' : 'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={() => setWbsViewMode('kanban')}
                  data-testid="button-view-kanban"
                >
                  <BarChart3 className="w-3 h-3 mr-1" />
                  Kanban
                </Button>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsFullPage(!isFullPage)}
                    data-testid="button-expand-wbs"
                  >
                    {isFullPage ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isFullPage ? 'Exit Full Page' : 'Full Page View'}</TooltipContent>
              </Tooltip>
              {businessCase && !isWbsLocked && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 border-indigo-500/50 text-indigo-600 dark:text-indigo-400"
                  onClick={() => generateWbsMutation.mutate({})}
                  disabled={generateWbsMutation.isPending || isGenerating}
                  data-testid="button-generate-ai-wbs"
                >
                  {(generateWbsMutation.isPending || isGenerating) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  {(generateWbsMutation.isPending || isGenerating) ? 'Generating...' : 'AI Generate Tasks'}
                </Button>
              )}
              {!isWbsLocked && (
                <Button size="sm" className="gap-2" onClick={onAddTask} data-testid="button-add-wbs-task">
                  <Plus className="w-4 h-4" />
                  Add Task
                </Button>
              )}
            </div>
          </CardHeader>

          {wbsBrainDecision?.decisionId && (
            <div className="mx-6 mb-4 rounded-xl border bg-gradient-to-r from-slate-50/80 via-white to-indigo-50/60 dark:from-slate-900/60 dark:via-slate-950/40 dark:to-indigo-950/30 p-4" data-testid="wbs-brain-ribbon">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                    <HexagonLogoFrame px={20} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Corevia Brain</p>
                    <p className="text-sm font-mono">{wbsBrainDecision.decisionId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={brainStatus.badgeClass}>{brainStatus.label}</Badge>
                  <Badge variant="outline" className="text-xs">Next Gate: {brainStatus.nextGate}</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBrainGovernance(true)}
                    data-testid="button-open-wbs-brain-governance"
                  >
                    View Governance
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* WBS Approval Status - Inside WBS Section */}
          {tasks.length > 0 && (
            <div className={`mx-6 mb-4 p-4 rounded-lg border-2 ${(() => {
              if (approval?.status === 'approved') return 'bg-emerald-900/20 border-emerald-500/50';
              if (approval?.status === 'pending_review') return 'bg-amber-900/20 border-amber-500/50';
              if (approval?.status === 'rejected') return 'bg-red-900/20 border-red-500/50';
              return 'bg-indigo-900/10 border-indigo-500/30';
            })()}`}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${(() => {
                    if (approval?.status === 'approved') return 'bg-emerald-500/20';
                    if (approval?.status === 'pending_review') return 'bg-amber-500/20';
                    if (approval?.status === 'rejected') return 'bg-red-500/20';
                    return 'bg-indigo-500/20';
                  })()}`}>
                    {(() => {
                      if (approval?.status === 'approved') return <FileCheck className="w-5 h-5 text-emerald-500" />;
                      if (approval?.status === 'pending_review') return <Clock className="w-5 h-5 text-amber-500" />;
                      if (approval?.status === 'rejected') return <XCircle className="w-5 h-5 text-red-500" />;
                      return <Shield className="w-5 h-5 text-indigo-500" />;
                    })()}
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      WBS Approval Status
                      {approval?.version && (
                        <Badge variant="outline" className="text-xs">v{approval.version}</Badge>
                      )}
                      {isWbsLocked && (
                        <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-xs">
                          <Lock className="w-3 h-3 mr-1" />
                          Locked
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {(() => {
                        if (approval?.status === 'approved') return 'PMO approved - WBS is now locked for execution';
                        if (approval?.status === 'pending_review') return 'Under PMO review';
                        if (approval?.status === 'rejected') return `Rejected: ${approval.rejection_reason || 'See feedback'}`;
                        return 'Submit WBS for PMO approval when ready';
                      })()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowApprovalHistory(true)}
                    data-testid="button-wbs-history"
                  >
                    <History className="w-4 h-4 mr-1" />
                    History
                  </Button>
                  {(!approval || approval.status === 'draft' || approval.status === 'rejected' || approval.status === 'revision') && (
                    <Button
                      size="sm"
                      onClick={() => setShowSubmitDialog(true)}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                      data-testid="button-submit-wbs"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      Submit for Approval
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          <CardContent className={isFullPage ? 'flex-1 overflow-auto' : ''}>
            {isGenerating && generationProgress && (
              <div className="mb-6 p-8 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-blue-500/5 border-2 border-indigo-500/20 rounded-xl">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-start gap-6 mb-8">
                    <div className="relative flex-shrink-0">
                      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 flex items-center justify-center shadow-xl">
                        <div className="relative">
                          {generationProgress.phase === 'analyzing' && <HexagonLogoFrame size="sm" animated />}
                          {generationProgress.phase === 'planning' && <Layers className="h-10 w-10 text-white animate-pulse" />}
                          {generationProgress.phase === 'generating' && <Zap className="h-10 w-10 text-white animate-pulse" />}
                          {generationProgress.phase === 'computing' && <Network className="h-10 w-10 text-white animate-pulse" />}
                          {generationProgress.phase === 'complete' && <CheckCircle2 className="h-10 w-10 text-white" />}
                        </div>
                      </div>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 animate-spin" style={{ animationDuration: '3s' }}>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-indigo-400 rounded-full shadow-lg" />
                      </div>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-purple-400 rounded-full shadow-lg" />
                      </div>
                    </div>

                    <div className="flex-1">
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
                        {generationProgress.phase === 'analyzing' && 'Analyzing Business Case...'}
                        {generationProgress.phase === 'planning' && 'Planning Project Phases...'}
                        {generationProgress.phase === 'generating' && 'Generating Tasks in Parallel...'}
                        {generationProgress.phase === 'computing' && 'Computing Critical Path...'}
                        {generationProgress.phase === 'complete' && 'Generation Complete!'}
                      </h3>
                      <p className="text-muted-foreground">{generationProgress.message}</p>
                      {generationProgress.details && (
                        <p className="text-sm text-muted-foreground/70 mt-1">{generationProgress.details}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Step {generationProgress.step} of {generationProgress.totalSteps}</span>
                      <span className="font-medium text-indigo-600 dark:text-indigo-400">{generationProgress.percentage}%</span>
                    </div>
                    <Progress value={generationProgress.percentage} className="h-2" />

                    <div className="grid grid-cols-4 gap-3 mt-6">
                      {[
                        { phase: 'analyzing', label: 'Analyze', icon: Sparkles },
                        { phase: 'planning', label: 'Plan Phases', icon: Layers },
                        { phase: 'generating', label: 'Generate Tasks', icon: Zap },
                        { phase: 'computing', label: 'Critical Path', icon: Network },
                      ].map((step, i) => {
                        const isActive = generationProgress.phase === step.phase;
                        const isPast = ['analyzing', 'planning', 'generating', 'computing', 'complete'].indexOf(generationProgress.phase) > i;
                        const StepIcon = step.icon;
                        return (
                          <div key={step.phase} className={`p-3 rounded-lg border-2 transition-all ${(() => {
                            if (isActive) return 'border-indigo-500 bg-indigo-500/10 shadow-lg';
                            if (isPast) return 'border-emerald-500/50 bg-emerald-500/5';
                            return 'border-border/50 bg-muted/20';
                          })()}`}>
                            <div className="flex items-center gap-2 mb-1">
                              {isPast && !isActive ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <StepIcon className={`w-4 h-4 ${isActive ? 'text-indigo-500 animate-pulse' : 'text-muted-foreground'}`} />
                              )}
                              <span className={`text-xs font-medium ${(() => {
                                if (isActive) return 'text-indigo-600 dark:text-indigo-400';
                                if (isPast) return 'text-emerald-600 dark:text-emerald-400';
                                return 'text-muted-foreground';
                              })()}`}>
                                {step.label}
                              </span>
                            </div>
                            {isActive && (
                              <div className="h-1 bg-indigo-500/20 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 animate-pulse" style={{ width: '60%' }} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {wbsViewMode === 'list' && (
            <ScrollArea className={isFullPage ? 'h-full' : 'h-[500px]'}>
              <div className="space-y-3">
                {/* WBS Legend - Only show when tasks exist */}
                {tasks.length > 0 && (
                  <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/30 border border-border/50 mb-4">
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-muted-foreground font-medium">WBS Levels:</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                        <span>L1 Phase</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <span>L2 Work Package</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                        <span>L3 Activity</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs flex-wrap">
                      {(() => {
                        const criticalCount = tasks.filter(t => isCriticalPathTask(t)).length;
                        const milestoneCount = tasks.filter(t => isMilestoneTask(t)).length;
                        const riskCount = tasks.filter(t => getTaskRiskLevel(t) === 'high').length;
                        return (
                          <>
                            {criticalCount > 0 && (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/30">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-red-600 dark:text-red-400 font-medium">{criticalCount} Critical</span>
                              </div>
                            )}
                            {milestoneCount > 0 && (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30">
                                <Flag className="w-3 h-3 text-amber-500" />
                                <span className="text-amber-600 dark:text-amber-400 font-medium">{milestoneCount} Milestones</span>
                              </div>
                            )}
                            {riskCount > 0 && (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-500/10 border border-orange-500/30">
                                <Shield className="w-3 h-3 text-orange-500" />
                                <span className="text-orange-600 dark:text-orange-400 font-medium">{riskCount} High Risk</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {!generateWbsMutation.isPending && businessCase && tasks.length === 0 && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-indigo-500/20">
                        <Wand2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-indigo-600 dark:text-indigo-400">AI-Powered Task Generation</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your business case is ready. Click "AI Generate Tasks" to automatically create a comprehensive WBS with:
                        </p>
                        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Detailed task breakdown for each phase
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Start and end date scheduling
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Task dependencies and relationships
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Resource and deliverable assignments
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {tasks.map((task) => {
                  const metadata = (task as any).metadata || {}; // eslint-disable-line @typescript-eslint/no-explicit-any
                  const dependencies = metadata.dependencies || [];
                  const deliverables = metadata.deliverables || [];
                  const resources = metadata.resources || [];
                  const isPhase = task.taskType === 'phase' || task.wbsCode?.endsWith('.0');
                  const wbsLevel = task.wbsLevel || (task.wbsCode ? task.wbsCode.split('.').length - 1 : 0);
                  const isLevel2 = wbsLevel === 2;
                  const isLevel3 = wbsLevel >= 3;

                  const isCritical = isCriticalPathTask(task);

                  // Level-based styling
                  const getLevelStyles = () => {
                    if (isCritical) {
                      return 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/50 ring-1 ring-red-500/30';
                    }
                    if (isPhase) {
                      return 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/30';
                    }
                    if (isLevel2) {
                      return 'bg-blue-500/5 border-blue-500/20 hover-elevate';
                    }
                    if (isLevel3) {
                      return 'bg-muted/20 border-border/30 hover-elevate';
                    }
                    return 'bg-muted/40 border-border/50 hover-elevate';
                  };

                  const getDotColor = () => {
                    if (isCritical) return 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50';
                    if (task.status === 'completed') return 'bg-emerald-500';
                    if (task.status === 'in_progress') return 'bg-blue-500 animate-pulse';
                    if (task.status === 'blocked') return 'bg-red-500';
                    if (isPhase) return 'bg-indigo-500';
                    if (isLevel2) return 'bg-blue-500';
                    if (isLevel3) return 'bg-slate-400';
                    return 'bg-muted-foreground/50';
                  };

                  return (
                    <div
                      key={task.id}
                      className={`rounded-lg border transition-all relative ${getLevelStyles()} ${(() => {
                        if (isPhase) return 'p-4';
                        if (isLevel2) return 'p-3';
                        return 'p-2.5';
                      })()}`}
                      style={{ marginLeft: `${wbsLevel * 20}px` }}
                      data-testid={`wbs-task-${task.id}`}
                    >
                      {isCritical && (
                        <div className="absolute -left-0.5 top-1 bottom-1 w-1 bg-gradient-to-b from-red-500 via-orange-500 to-red-500 rounded-full animate-pulse" />
                      )}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <div className={`shrink-0 mt-1 rounded-full ${(() => {
                            if (isPhase) return 'w-3 h-3';
                            if (isLevel2) return 'w-2.5 h-2.5';
                            return 'w-2 h-2';
                          })()} ${getDotColor()}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-medium ${(() => {
                                if (isPhase) return 'text-sm text-indigo-600 dark:text-indigo-400';
                                if (isLevel2) return 'text-sm text-blue-600 dark:text-blue-400';
                                return 'text-xs text-foreground/90';
                              })()}`}>
                                {task.taskName || task.title}
                              </span>
                              {task.wbsCode && (
                                <Badge variant="outline" className={`font-mono ${isLevel3 ? 'text-[10px] px-1 py-0' : 'text-xs'}`}>
                                  {task.wbsCode}
                                </Badge>
                              )}
                              {isCritical && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/50">
                                  <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                                  Critical
                                </Badge>
                              )}
                              {metadata.aiGenerated && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 text-indigo-600 dark:text-indigo-400 border-indigo-500/30">
                                  <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                                  AI
                                </Badge>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          {task.priority && task.priority !== 'medium' && (
                            <Badge variant="outline" className={`text-xs ${(() => {
                              if (task.priority === 'critical') return 'text-red-600 dark:text-red-400 border-red-500/50';
                              if (task.priority === 'high') return 'text-orange-600 dark:text-orange-400 border-orange-500/50';
                              return 'text-muted-foreground';
                            })()}`}>
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {task.priority}
                            </Badge>
                          )}
                          {task.estimatedHours && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              {task.estimatedHours}h
                            </Badge>
                          )}
                          {isMilestoneTask(task) && (
                            <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-500/50">
                              <Flag className="w-3 h-3 mr-1" />
                              Milestone
                            </Badge>
                          )}
                          {getTaskRiskLevel(task) === 'high' && (
                            <Badge variant="outline" className="text-xs text-orange-600 dark:text-orange-400 border-orange-500/50">
                              <Shield className="w-3 h-3 mr-1" />
                              High Risk
                            </Badge>
                          )}
                          <Badge className={(() => {
                            if (task.status === 'completed') return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
                            if (task.status === 'in_progress') return 'bg-blue-500/20 text-blue-600 dark:text-blue-400';
                            if (task.status === 'blocked') return 'bg-red-500/20 text-red-600 dark:text-red-400';
                            return 'bg-muted text-muted-foreground';
                          })()}>
                            {task.status?.replaceAll('_', ' ') || 'not started'}
                          </Badge>
                          {!isWbsLocked && (
                            <div className="flex items-center gap-1 ml-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setEditingTask(task)}
                                data-testid={`button-edit-task-${task.id}`}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-red-500 hover:text-red-600"
                                onClick={() => setDeletingTask(task)}
                                data-testid={`button-delete-task-${task.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        {task.plannedStartDate && task.plannedEndDate && (
                          <span className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded">
                            <Calendar className="w-3 h-3" />
                            {new Date(task.plannedStartDate).toLocaleDateString()} - {new Date(task.plannedEndDate).toLocaleDateString()}
                          </span>
                        )}
                        {task.duration && (
                          <span className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded">
                            <Timer className="w-3 h-3" />
                            {task.duration} days
                          </span>
                        )}
                        {dependencies.length > 0 && (
                          <span className="flex items-center gap-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-1 rounded">
                            <GitBranch className="w-3 h-3" />
                            Depends on: {dependencies.map((d: string) => resolveDependencyName(d)).join(', ')}
                          </span>
                        )}
                        {resources.length > 0 && (
                          <span className="flex items-center gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-1 rounded">
                            <Users className="w-3 h-3" />
                            {resources.slice(0, 2).join(', ')}{resources.length > 2 && ` +${resources.length - 2}`}
                          </span>
                        )}
                      </div>

                      {deliverables.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {deliverables.slice(0, 3).map((d: string, i: number) => (
                            <Badge key={d} variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                              <Package className="w-3 h-3 mr-1" />
                              {d}
                            </Badge>
                          ))}
                          {deliverables.length > 3 && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              +{deliverables.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!tasks.length && !businessCase && (
                  <div className="text-center py-12 text-muted-foreground/70">
                    <Layers className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="mb-2">{t('projectWorkspace.planning.noTasksDefinedYet')}</p>
                    <p className="text-sm">Create tasks manually or generate a business case to auto-populate</p>
                  </div>
                )}
              </div>
            </ScrollArea>
            )}

            {wbsViewMode === 'gantt' && (
              <GanttChartView
                tasks={tasks}
                onEditTask={isWbsLocked ? undefined : (task) => setEditingTask(task)}
                onDeleteTask={isWbsLocked ? undefined : (task) => setDeletingTask(task)}
                fullPage={isFullPage}
              />
            )}

            {wbsViewMode === 'schedule' && (
              <div className="space-y-3">
                {/* Expand/Collapse All Controls */}
                <div className="flex items-center gap-2 mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Find all phase tasks (L1 with ".0" suffix) that have children
                      const phaseTasks = tasks.filter(t => {
                        const code = t.taskCode || '';
                        return code.endsWith('.0') && hasChildren(t);
                      });
                      const phaseCodes = new Set(phaseTasks.map(t => t.taskCode || '').filter(Boolean));
                      setCollapsedTasks(phaseCodes);
                    }}
                    data-testid="button-collapse-all"
                  >
                    <ChevronUp className="w-4 h-4 mr-1" />
                    Collapse All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCollapsedTasks(new Set())}
                    data-testid="button-expand-all"
                  >
                    <ChevronDown className="w-4 h-4 mr-1" />
                    Expand All
                  </Button>
                  <div className="flex-1" />
                  {/* Add Task Buttons */}
                  {!isWbsLocked && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onAddTask}
                        className="gap-1"
                        data-testid="button-add-task-schedule"
                      >
                        <Plus className="w-4 h-4" />
                        Add Task
                      </Button>
                    </div>
                  )}
                </div>

                <div
                  className="w-full overflow-x-auto rounded-lg border border-border/50"
                  data-testid="wbs-schedule-scroll"
                >
                <div className="min-w-[1400px]">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="sticky top-0 z-10 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900">
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">WBS Code</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300 min-w-[200px]">Task Name</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Level</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Type</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Start Date</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">End Date</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Duration</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Hours</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Priority</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Status</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300 min-w-[120px]">Dependencies</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300 min-w-[200px]">Assigned Resources</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Critical</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!tasks || tasks.length === 0) ? (
                      <tr>
                        <td colSpan={14} className="border border-slate-200 dark:border-slate-700 px-4 py-12 text-center text-muted-foreground">
                          No tasks in the schedule. Generate tasks using AI or add them manually.
                        </td>
                      </tr>
                    ) : (
                      [...tasks]
                        .sort((a, b) => (a?.sortOrder || 0) - (b?.sortOrder || 0))
                        .filter(task => isTaskVisible(task))
                        .map((task, index) => {
                          if (!task) return null;
                          const taskCode = task.taskCode || '';
                          const wbsLevel = (task as any).wbsLevel || inferWbsLevel(taskCode); // eslint-disable-line @typescript-eslint/no-explicit-any
                          const isCritical = isCriticalPathTask(task);
                          const isMilestone = isMilestoneTask(task);
                          const predecessorCodes = resolvePredecessorCodes(task.predecessors, resolveDependencyName);
                          const resources = task.assignedTo || (task as any).assignedTeam || '-'; // eslint-disable-line @typescript-eslint/no-explicit-any
                          const taskHasChildren = hasChildren(task);
                          const isCollapsed = collapsedTasks.has(taskCode);

                          return (
                            <tr
                              key={task.id}
                              className={`
                                ${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/50'}
                                ${isCritical ? 'bg-gradient-to-r from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-900/10' : ''}
                                ${isMilestone && !isCritical ? 'bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-900/10' : ''}
                                hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors
                              `}
                            >
                              <td className={`border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono text-xs ${getWbsBorderClass(isCritical, isMilestone)} ${getWbsLevelFontClass(wbsLevel)}`}>
                                <div className="flex items-center gap-1">
                                  {taskHasChildren && (
                                    <button
                                      onClick={() => toggleTaskCollapse(taskCode)}
                                      className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                                      data-testid={`button-toggle-${task.id}`}
                                    >
                                      {isCollapsed ? (
                                        <ChevronRight className="w-4 h-4" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                  {!taskHasChildren && <span className="w-5" />}
                                  {taskCode}
                                </div>
                              </td>
                              <td className={`border border-slate-200 dark:border-slate-700 px-3 py-2 ${getWbsTitleFontClass(wbsLevel)}`} style={{ paddingLeft: `${(wbsLevel - 1) * 16 + 12}px` }}>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {editingCell?.taskId === task.id && editingCell?.field === 'title' ? (
                                    <input
                                      type="text"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={() => {
                                        if (editValue !== task.title) {
                                          updateTaskMutation.mutate({ id: task.id, updates: { title: editValue } });
                                        }
                                        setEditingCell(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          if (editValue !== task.title) {
                                            updateTaskMutation.mutate({ id: task.id, updates: { title: editValue } });
                                          }
                                          setEditingCell(null);
                                        } else if (e.key === 'Escape') {
                                          setEditingCell(null);
                                        }
                                      }}
                                      autoFocus
                                      className="px-2 py-1 text-sm border rounded bg-white dark:bg-slate-800 w-full min-w-[150px]"
                                      data-testid={`input-title-${task.id}`}
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      className={`cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/30 px-1 rounded bg-transparent border-0 text-left font-inherit text-inherit ${isWbsLocked ? '' : 'hover:underline'}`}
                                      onClick={() => {
                                        if (isWbsLocked) return;
                                        setEditingCell({ taskId: task.id, field: 'title' });
                                        setEditValue(task.title || '');
                                      }}
                                      data-testid={`text-title-${task.id}`}
                                    >
                                      {task.title}
                                    </button>
                                  )}
                                  {isMilestone && (
                                    <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/50">
                                      <Flag className="w-2.5 h-2.5 mr-0.5" />
                                      Milestone
                                    </Badge>
                                  )}
                                  {isCritical && (
                                    <Badge className="text-[10px] px-1.5 py-0 bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/50">
                                      <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                                      Critical
                                    </Badge>
                                  )}
                                  {getTaskRiskLevel(task) === 'high' && (
                                    <Badge className="text-[10px] px-1.5 py-0 bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/50">
                                      <Shield className="w-2.5 h-2.5 mr-0.5" />
                                      High Risk
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center">
                                <Badge variant="outline" className={`text-[10px] ${getWbsLevelBadgeClass(wbsLevel)}`}>
                                  L{wbsLevel}
                                </Badge>
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 capitalize text-xs">
                                {task.taskType || 'task'}
                              </td>
                              {/* Start Date with Calendar Popover */}
                              <td className="border border-slate-200 dark:border-slate-700 px-1 py-1 text-xs whitespace-nowrap">
                                <Popover>
                                  <PopoverTrigger asChild disabled={isWbsLocked}>
                                    <button
                                      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-100/50 dark:hover:bg-blue-900/30 w-full text-left"
                                      data-testid={`button-start-date-${task.id}`}
                                    >
                                      <CalendarDays className="w-3 h-3 text-muted-foreground" />
                                      {task.plannedStartDate ? format(parseISO(task.plannedStartDate), 'dd MMM yyyy') : 'Set date'}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <CalendarComponent
                                      mode="single"
                                      selected={task.plannedStartDate ? parseISO(task.plannedStartDate) : undefined}
                                      onSelect={(date) => {
                                        if (date) {
                                          const newDate = format(date, 'yyyy-MM-dd');
                                          updateTaskMutation.mutate({ id: task.id, updates: { plannedStartDate: newDate } });
                                        }
                                      }}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              </td>
                              {/* End Date with Calendar Popover */}
                              <td className="border border-slate-200 dark:border-slate-700 px-1 py-1 text-xs whitespace-nowrap">
                                <Popover>
                                  <PopoverTrigger asChild disabled={isWbsLocked}>
                                    <button
                                      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-100/50 dark:hover:bg-blue-900/30 w-full text-left"
                                      data-testid={`button-end-date-${task.id}`}
                                    >
                                      <CalendarDays className="w-3 h-3 text-muted-foreground" />
                                      {task.plannedEndDate ? format(parseISO(task.plannedEndDate), 'dd MMM yyyy') : 'Set date'}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <CalendarComponent
                                      mode="single"
                                      selected={task.plannedEndDate ? parseISO(task.plannedEndDate) : undefined}
                                      onSelect={(date) => {
                                        if (date) {
                                          const newDate = format(date, 'yyyy-MM-dd');
                                          updateTaskMutation.mutate({ id: task.id, updates: { plannedEndDate: newDate } });
                                        }
                                      }}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-center text-xs">
                                {editingCell?.taskId === task.id && editingCell?.field === 'duration' ? (
                                  <input
                                    type="number"
                                    min="1"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => {
                                      const newDuration = Number.parseInt(editValue) || 1;
                                      if (newDuration !== task.duration) {
                                        updateTaskMutation.mutate({ id: task.id, updates: { duration: newDuration } });
                                      }
                                      setEditingCell(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const newDuration = Number.parseInt(editValue) || 1;
                                        if (newDuration !== task.duration) {
                                          updateTaskMutation.mutate({ id: task.id, updates: { duration: newDuration } });
                                        }
                                        setEditingCell(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingCell(null);
                                      }
                                    }}
                                    autoFocus
                                    className="px-1 py-0.5 text-xs text-center border rounded bg-white dark:bg-slate-800 w-16"
                                    data-testid={`input-duration-${task.id}`}
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    className={`cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/30 px-2 py-0.5 rounded bg-transparent border-0 text-inherit font-inherit text-xs ${isWbsLocked ? '' : 'hover:underline'}`}
                                    onClick={() => {
                                      if (isWbsLocked) return;
                                      setEditingCell({ taskId: task.id, field: 'duration' });
                                      setEditValue(String(task.duration || 0));
                                    }}
                                    data-testid={`text-duration-${task.id}`}
                                  >
                                    {task.duration || 0}d
                                  </button>
                                )}
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-center text-xs">
                                {editingCell?.taskId === task.id && editingCell?.field === 'estimatedHours' ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => {
                                      const newHours = Number.parseInt(editValue) || 0;
                                      if (newHours !== task.estimatedHours) {
                                        updateTaskMutation.mutate({ id: task.id, updates: { estimatedHours: newHours } });
                                      }
                                      setEditingCell(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const newHours = Number.parseInt(editValue) || 0;
                                        if (newHours !== task.estimatedHours) {
                                          updateTaskMutation.mutate({ id: task.id, updates: { estimatedHours: newHours } });
                                        }
                                        setEditingCell(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingCell(null);
                                      }
                                    }}
                                    autoFocus
                                    className="px-1 py-0.5 text-xs text-center border rounded bg-white dark:bg-slate-800 w-16"
                                    data-testid={`input-hours-${task.id}`}
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    className={`cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/30 px-2 py-0.5 rounded bg-transparent border-0 text-inherit font-inherit text-xs ${isWbsLocked ? '' : 'hover:underline'}`}
                                    onClick={() => {
                                      if (isWbsLocked) return;
                                      setEditingCell({ taskId: task.id, field: 'estimatedHours' });
                                      setEditValue(String(task.estimatedHours || 0));
                                    }}
                                    data-testid={`text-hours-${task.id}`}
                                  >
                                    {task.estimatedHours || 0}h
                                  </button>
                                )}
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-1 py-1">
                                <Select
                                  value={task.priority || 'medium'}
                                  onValueChange={(value) => {
                                    if (!isWbsLocked) {
                                      updateTaskMutation.mutate({ id: task.id, updates: { priority: value } });
                                    }
                                  }}
                                  disabled={isWbsLocked}
                                >
                                  <SelectTrigger className="h-7 text-[10px] border-0 bg-transparent hover:bg-blue-100/50 dark:hover:bg-blue-900/30" data-testid={`select-priority-${task.id}`}>
                                    <Badge variant="outline" className={`text-[10px] ${(() => {
                                      if (task.priority === 'critical') return 'bg-red-500/10 text-red-600 border-red-500/30';
                                      if (task.priority === 'high') return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
                                      if (task.priority === 'medium') return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
                                      return 'bg-slate-500/10 text-slate-600 border-slate-500/30';
                                    })()}`}>
                                      {task.priority || 'medium'}
                                    </Badge>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="critical">Critical</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-1 py-1">
                                <Select
                                  value={task.status || 'not_started'}
                                  onValueChange={(value) => {
                                    if (!isWbsLocked) {
                                      updateTaskMutation.mutate({ id: task.id, updates: { status: value } });
                                    }
                                  }}
                                  disabled={isWbsLocked}
                                >
                                  <SelectTrigger className="h-7 text-[10px] border-0 bg-transparent hover:bg-blue-100/50 dark:hover:bg-blue-900/30" data-testid={`select-status-${task.id}`}>
                                    <Badge variant="outline" className={`text-[10px] ${(() => {
                                      if (task.status === 'completed') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
                                      if (task.status === 'in_progress') return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
                                      if (task.status === 'blocked') return 'bg-red-500/10 text-red-600 border-red-500/30';
                                      return 'bg-slate-500/10 text-slate-600 border-slate-500/30';
                                    })()}`}>
                                      {(task.status || 'not_started').replaceAll('_', ' ')}
                                    </Badge>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="not_started">Not Started</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="blocked">Blocked</SelectItem>
                                    <SelectItem value="on_hold">On Hold</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-1 py-1 text-xs">
                                <Popover>
                                  <PopoverTrigger asChild disabled={isWbsLocked}>
                                    <button
                                      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-100/50 dark:hover:bg-blue-900/30 w-full text-left text-muted-foreground"
                                      data-testid={`button-dependencies-${task.id}`}
                                    >
                                      <Link2 className="w-3 h-3" />
                                      {predecessorCodes === '-' ? (
                                        <span className="text-muted-foreground/50 italic">Add...</span>
                                      ) : (
                                        <span className="truncate max-w-[100px]">{predecessorCodes}</span>
                                      )}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 p-3" align="start">
                                    <div className="space-y-3">
                                      <h4 className="font-medium text-sm">Dependencies</h4>
                                      <div className="text-xs text-muted-foreground mb-2">
                                        Select tasks that must complete before this task can start
                                      </div>
                                      <div className="max-h-48 overflow-y-auto space-y-1">
                                        {tasks
                                          .filter(t => t.id !== task.id && t.taskCode !== taskCode)
                                          .sort((a, b) => (a.taskCode || '').localeCompare(b.taskCode || ''))
                                          .map(t => {
                                            const tCode = t.taskCode || '';
                                            const currentPreds = extractPredecessorTaskCodes(task.predecessors);
                                            const isSelected = currentPreds.includes(tCode);

                                            return (
                                              <label
                                                key={t.id}
                                                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs ${
                                                  isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                                                }`}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={(e) => {
                                                    let newPreds: string[];
                                                    if (e.target.checked) {
                                                      newPreds = [...currentPreds, tCode];
                                                    } else {
                                                      newPreds = currentPreds.filter(p => p !== tCode);
                                                    }
                                                    updateTaskMutation.mutate({
                                                      id: task.id,
                                                      updates: { predecessors: newPreds }
                                                    });
                                                  }}
                                                  className="rounded"
                                                  data-testid={`checkbox-dep-${task.id}-${t.id}`}
                                                />
                                                <span className="font-mono text-[10px] text-muted-foreground">{tCode}</span>
                                                <span className="truncate">{t.title}</span>
                                              </label>
                                            );
                                          })}
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </td>
                              {/* Assigned Resources with Dialog */}
                              <td className="border border-slate-200 dark:border-slate-700 px-1 py-1 text-xs min-w-[200px]">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-blue-100/50 dark:hover:bg-blue-900/30 w-full text-left"
                                      onClick={() => {
                                        if (isWbsLocked) return;
                                        setResourceDialogTask(task);
                                        const existingResources = (task.assignedTo || (task as any).assignedTeam || '').split(',').map((r: string) => r.trim()).filter(Boolean); // eslint-disable-line @typescript-eslint/no-explicit-any
                                        setSelectedResources(existingResources);
                                        setResourceDialogOpen(true);
                                      }}
                                      disabled={isWbsLocked}
                                      data-testid={`button-assign-resources-${task.id}`}
                                    >
                                      <Users className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                                      {resources && resources !== '-' ? (
                                        <div className="flex flex-wrap gap-1">
                                          {resources.split(',').map((r: string, idx: number) => (
                                            <Badge
                                              key={`res-${r.trim()}`}
                                              variant="secondary"
                                              className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"
                                            >
                                              {r.trim()}
                                            </Badge>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground/50 italic">Click to assign...</span>
                                      )}
                                    </button>
                                  </TooltipTrigger>
                                  {resources && resources !== '-' && (
                                    <TooltipContent side="top" className="max-w-xs">
                                      <p className="font-medium mb-1">Assigned Resources:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {resources.split(',').map((r: string, idx: number) => (
                                          <Badge key={`tip-${r.trim()}`} variant="outline" className="text-xs">
                                            {r.trim()}
                                          </Badge>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center">
                                {isCritical && (
                                  <Badge className="bg-red-500 text-white text-[10px]">
                                    CP
                                  </Badge>
                                )}
                              </td>
                              {/* Actions Column */}
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                    onClick={() => setEditingTask(task)}
                                    disabled={isWbsLocked}
                                    data-testid={`button-edit-task-${task.id}`}
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                                    onClick={() => setDeletingTask(task)}
                                    disabled={isWbsLocked}
                                    data-testid={`button-delete-task-${task.id}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
                </div>
                </div>
                {tasks.length > 0 && (
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
                    <div className="flex items-center gap-4">
                      <span>Total Tasks: <strong>{tasks.length}</strong></span>
                      <span>Critical Path: <strong className="text-red-600">{tasks.filter(t => isCriticalPathTask(t)).length}</strong></span>
                      <span>Total Hours: <strong>{tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0).toLocaleString()}h</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-indigo-500" /> L1 Phase
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-blue-500" /> L2 Work Package
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-slate-400" /> L3 Activity
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {wbsViewMode === 'kanban' && (
              <div className="space-y-6">
                {(() => {
                  const allGroups = groupTasksByResource(tasks);

                  if (allGroups.length === 0) {
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p className="mb-2">{t('projectWorkspace.planning.noTasksWithAssignedResources')}</p>
                        <p className="text-sm">Assign resources to tasks in the Schedule view to see them here</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {allGroups.map(([resource, groupTasks]) => (
                        <div key={resource} className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
                              {resource === 'Unassigned' ? '?' : resource.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="font-medium text-sm">{resource}</h4>
                              <p className="text-xs text-muted-foreground">{groupTasks.length} tasks</p>
                            </div>
                          </div>
                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {groupTasks.map(task => {
                              const isCritical = isCriticalPathTask(task);
                              return (
                                <button
                                  type="button"
                                  key={task.id}
                                  className={`bg-white dark:bg-slate-900 rounded-md p-3 border shadow-sm cursor-pointer hover:shadow-md transition-shadow text-left w-full ${
                                    isCritical ? 'border-red-500/50' : 'border-slate-200 dark:border-slate-700'
                                  }`}
                                  onClick={() => !isWbsLocked && setEditingTask(task)}
                                  data-testid={`kanban-card-${task.id}`}
                                >
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <span className="font-mono text-[10px] text-muted-foreground">{task.taskCode}</span>
                                    {isCritical && (
                                      <Badge className="bg-red-500 text-white text-[9px] px-1.5 py-0">CP</Badge>
                                    )}
                                  </div>
                                  <h5 className="text-sm font-medium mb-2 line-clamp-2">{task.title}</h5>
                                  <div className="flex flex-wrap gap-1.5 mb-2">
                                    <Badge variant="outline" className={`text-[10px] ${(() => {
                                      if (task.status === 'completed') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
                                      if (task.status === 'in_progress') return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
                                      if (task.status === 'blocked') return 'bg-red-500/10 text-red-600 border-red-500/30';
                                      return 'bg-slate-500/10 text-slate-600 border-slate-500/30';
                                    })()}`}>
                                      {(task.status || 'not_started').replaceAll('_', ' ')}
                                    </Badge>
                                    <Badge variant="outline" className={`text-[10px] ${(() => {
                                      if (task.priority === 'critical') return 'bg-red-500/10 text-red-600 border-red-500/30';
                                      if (task.priority === 'high') return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
                                      return 'bg-slate-500/10 text-slate-600 border-slate-500/30';
                                    })()}`}>
                                      {task.priority || 'medium'}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {task.duration || 0}d
                                    </span>
                                    {task.plannedEndDate && (
                                      <span className="flex items-center gap-1">
                                        <CalendarDays className="w-3 h-3" />
                                        {new Date(task.plannedEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      )}



      {activeSection === 'deliverables' && (() => {
        // Enterprise PM logic: deliverables are derived artifacts of an approved
        // WBS baseline. Without it, any list is fabricated — render a locked
        // empty state that routes the PM to Scope → WBS instead of showing
        // template "Professional standard" placeholders.
        if (!isWbsLocked) {
          const hasAnyWbs = tasks.length > 0;
          return (
            <div className="space-y-4 pb-8">
              <Card className="border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white dark:border-amber-500/30 dark:from-amber-500/10 dark:via-slate-900 dark:to-slate-900">
                <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
                    <Lock className="h-6 w-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="h-5 gap-1 border-amber-300 bg-amber-50 px-1.5 text-[9px] uppercase tracking-[0.14em] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                        <Sparkles className="h-2.5 w-2.5" /> COREVIA Governance
                      </Badge>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        Deliverables are locked until the WBS is approved
                      </h3>
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                      Deliverables in an enterprise PPM model are <span className="font-semibold">derived artifacts of an approved WBS baseline</span>, not a static library. Showing template packages before scope is decomposed, sequenced and approved creates a false sense of readiness and lets projects "tick off" work that was never really planned.
                    </p>
                    <p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {hasAnyWbs
                        ? 'A WBS exists but has not yet been submitted to PMO or approved. Once the WBS baseline is approved, COREVIA will synthesize the deliverable packages from the approved work packages, business-case artifacts, and milestone plan.'
                        : 'No WBS has been generated yet. Start by decomposing scope into a WBS, then submit it for PMO approval. After approval the deliverables register will be built automatically from the approved baseline.'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button
                      size="sm"
                      className="gap-1 bg-indigo-600 text-white hover:bg-indigo-700"
                      onClick={() => onSubTabChange?.('wbs')}
                      data-testid="deliverables-goto-wbs"
                    >
                      <GitBranch className="h-3.5 w-3.5" />
                      {hasAnyWbs ? 'Open WBS & submit for approval' : 'Start the WBS'}
                    </Button>
                    {hasAnyWbs && approval?.status && (
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                        WBS status: {approval.status}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-indigo-500" />
                    What will appear here after WBS approval
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-[12px] text-slate-600 dark:text-slate-300">
                  <ul className="space-y-1.5 list-disc pl-5">
                    <li>Every <span className="font-semibold">deliverable-type work package</span> in the approved WBS, with its owner, due date, and acceptance criteria.</li>
                    <li>Business-case <span className="font-semibold">expected outputs</span> traced to the work package that produces them.</li>
                    <li>Milestone-linked <span className="font-semibold">baseline artifacts</span> (scope, schedule, cost, risk, quality, comms, procurement, resources).</li>
                    <li>Gate-readiness lifecycle state — <em>planned → in build → controlled</em> — driven by the WBS and reviewer approvals, not static templates.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          );
        }
        return (
        <div className="space-y-4 pb-8 xl:pb-10">
          <Card className="overflow-hidden border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] shadow-[0_10px_24px_-24px_rgba(15,23,42,0.20)] dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.88))]">
            <CardContent className="px-3 py-2.5 sm:px-4 sm:py-2.5">
              <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/70 bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                    <Package className="h-3 w-3" />
                    Planning Studio
                  </div>
                  <span>{planningDeliverablesView.actualPackageCount > 0 ? 'Business Case + WBS' : 'Planning Standard'}</span>
                  <span className="text-slate-300 dark:text-slate-600">→</span>
                  <span>deliverables</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 px-2.5 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900/80">
                    <span className="font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{planningDeliverablesView.packageCards.length}</span>
                    <span className="text-slate-500 dark:text-slate-400">Packages</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 px-2.5 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900/80">
                    <span className="font-bold tabular-nums text-blue-600 dark:text-blue-400">{planningDeliverablesView.taskBackedCount}</span>
                    <span className="text-slate-500 dark:text-slate-400">Task-Backed</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 px-2.5 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900/80">
                    <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400">{planningDeliverablesView.gateLinkedCount}</span>
                    <span className="text-slate-500 dark:text-slate-400">Gate-Linked</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 px-2.5 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900/80">
                    <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{planningDeliverablesView.baselineReadyCount}</span>
                    <span className="text-slate-500 dark:text-slate-400">Ready</span>
                  </div>
                  <LineageTag
                    source={planningDeliverablesView.actualPackageCount > 0 ? 'Business Case + WBS' : 'Planning Standard'}
                    field="deliverables"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:min-h-0 xl:h-[calc(100vh-22rem)] xl:pb-4 xl:grid-cols-[minmax(320px,0.86fr)_minmax(0,1.14fr)] xl:items-stretch">
            <Card className="flex h-full min-h-0 flex-col overflow-hidden bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-700 shadow-[0_12px_36px_-28px_rgba(15,23,42,0.30)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">Choose A Planning Package</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Start from the package you want to baseline, then work through its artifacts on the right.
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-4 pr-2 pt-0">
                {planningDeliverablesView.packageCards.map((pkg) => {
                  const Icon = pkg.icon;
                  const isActive = selectedPlanningPackage?.id === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setExpandedPlanningPackage(pkg.id)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition-all ${isActive ? 'border-indigo-300 bg-[linear-gradient(135deg,rgba(99,102,241,0.10),rgba(255,255,255,0.90))] shadow-[0_10px_24px_-18px_rgba(79,70,229,0.45)] dark:border-indigo-500/30 dark:bg-[linear-gradient(135deg,rgba(99,102,241,0.16),rgba(15,23,42,0.86))]' : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800/40'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${isActive ? 'bg-white text-indigo-600 dark:bg-slate-900 dark:text-indigo-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{pkg.title}</div>
                            <Badge className={`text-[10px] border ${getPlanningPackageStatusClass(pkg.packageStatus)}`}>
                              {getPlanningPackageStatusLabel(pkg.packageStatus)}
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400 line-clamp-2">{pkg.description}</div>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                              <span>{pkg.artifacts.length} artifacts</span>
                              <span>{pkg.taskCoverage} tasks</span>
                              <span>{pkg.gateCoverage} gates</span>
                            </div>
                            {isActive ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {selectedPlanningPackage && (() => {
              const PackageIcon = selectedPlanningPackage.icon;
              return (
                <Card className="flex h-full min-h-0 flex-col overflow-hidden border-slate-200 dark:border-slate-700 bg-white/95 shadow-[0_20px_44px_-30px_rgba(15,23,42,0.35)] dark:bg-slate-900/95">
                  <CardHeader className="border-b border-slate-100 bg-gradient-to-br from-indigo-50/80 via-white to-slate-50/80 pb-4 dark:border-slate-800 dark:from-indigo-500/5 dark:via-slate-900 dark:to-slate-900">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100 dark:bg-slate-900 dark:text-indigo-300 dark:ring-indigo-500/20 shrink-0">
                        <PackageIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">{selectedPlanningPackage.title}</CardTitle>
                            <Badge className={`text-[10px] border ${getPlanningPackageStatusClass(selectedPlanningPackage.packageStatus)}`}>
                              {getPlanningPackageStatusLabel(selectedPlanningPackage.packageStatus)}
                            </Badge>
                          </div>
                          <CardDescription className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {selectedPlanningPackage.description}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 lg:min-w-[280px]">
                        <div className="rounded-2xl border border-white/80 bg-white/90 px-3 py-2.5 text-center shadow-sm dark:border-slate-700/70 dark:bg-slate-900/75">
                          <div className="text-base font-bold text-slate-900 dark:text-white">{selectedPlanningPackage.artifacts.length}</div>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Artifacts</div>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white/90 px-3 py-2.5 text-center shadow-sm dark:border-slate-700/70 dark:bg-slate-900/75">
                          <div className="text-base font-bold text-blue-600 dark:text-blue-400">{selectedPlanningPackage.taskCoverage}</div>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Tasks</div>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white/90 px-3 py-2.5 text-center shadow-sm dark:border-slate-700/70 dark:bg-slate-900/75">
                          <div className="text-base font-bold text-amber-600 dark:text-amber-400">{selectedPlanningPackage.gateCoverage}</div>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Gates</div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4 pr-2 pt-4">
                    <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(248,250,252,0.88))] p-4 dark:border-slate-700 dark:bg-[linear-gradient(135deg,rgba(30,41,59,0.68),rgba(15,23,42,0.72))]">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Readiness</div>
                          <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{selectedPlanningPackage.readinessPct}% checked</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Check, refine, or remove artifacts before the package moves forward into execution.</div>
                        </div>
                        <Badge className="w-fit border border-slate-200 bg-white/90 text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
                          {selectedPlanningPackage.baselineCount} of {selectedPlanningPackage.artifacts.length} checked for execution management
                        </Badge>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/70">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500" style={{ width: `${selectedPlanningPackage.readinessPct}%` }} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Artifacts In This Package</div>
                        <div className="text-[11px] text-slate-400">Planning controls stay here until execution is ready.</div>
                      </div>
                      {selectedPlanningPackage.artifacts.map((artifact) => (
                        <div key={artifact.key} className="rounded-[24px] border border-slate-200/90 bg-white px-4 py-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1 space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">{artifact.name}</div>
                                <Badge className={`shrink-0 text-[10px] border ${getPlanningArtifactStatusClass(artifact.lifecycle)}`}>
                                  {getPlanningArtifactStatusLabel(artifact.lifecycle)}
                                </Badge>
                              </div>
                              <div className="text-xs leading-6 text-slate-500 dark:text-slate-400">{artifact.description}</div>
                              <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-400">
                                <span className="rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-1">{artifact.phase}</span>
                                <span className="rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-1">{artifact.sourceLabel}</span>
                                {artifact.taskCount > 0 && <span className="rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-1">{artifact.taskCount} linked tasks</span>}
                                {artifact.linkedMilestones[0] && <span className="rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-1">Gate: {artifact.linkedMilestones[0].name}</span>}
                                {artifact.isFallback && <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-violet-700 dark:text-violet-300">Suggested starter</span>}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2 lg:w-[176px] lg:flex-col lg:items-stretch lg:justify-start">
                              <Button
                                type="button"
                                size="sm"
                                className="gap-1.5"
                                // The "Check" action stores a status override
                                // on the business case — it does NOT mutate
                                // the underlying WBS task. So the lock guard
                                // that applies to Edit / Delete does not
                                // apply here; otherwise, on a project with an
                                // approved WBS the PM can never advance the
                                // planning readiness %.
                                disabled={updatePlanningArtifactsMutation.isPending || artifact.lifecycle === 'controlled'}
                                onClick={() => handlePlanningArtifactConfirm(artifact)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {artifact.lifecycle === 'controlled' ? 'Checked' : 'Check'}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                disabled={updatePlanningArtifactsMutation.isPending || (artifact.sourceType === 'task' && isWbsLocked)}
                                onClick={() => handlePlanningArtifactEdit(artifact)}
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="gap-1.5 text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
                                disabled={updatePlanningArtifactsMutation.isPending || (artifact.sourceType === 'task' && isWbsLocked)}
                                onClick={() => handlePlanningArtifactDelete(artifact)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        </div>
        );
      })()}

      {activeSection === 'resources' && (
        <ResourceAlignmentView projectId={project.id} resources={resourcesData} tasks={tasks} />
      )}

      {activeSection === 'dependencies' && (
        <DependenciesView tasks={tasks} />
      )}

      {hasKpis && (
        <Card className="bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-700 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Success Metrics
              </CardTitle>
              <LineageTag source="Business Case" field="kpis" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {kpiMetrics.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {kpiMetrics.map((metric, i: number) => (
                    <div key={`metric-${metric.name}-${i}`} className="p-3 bg-muted/40 rounded-lg border border-border/50">
                      <div className="font-medium text-sm">{metric.name}</div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Baseline: {metric.baseline}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="text-emerald-600 dark:text-emerald-400">Target: {metric.target}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {kpiCriteria.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Success Criteria</h4>
                  <div className="flex flex-wrap gap-2">
                    {kpiCriteria.map((criterion: string, i: number) => (
                      <Badge key={`criterion-${criterion.slice(0, 30)}-${i}`} variant="secondary" className="text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {criterion}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <PlanningArtifactDialogs
        editingArtifact={editingPlanningArtifact}
        deletingArtifact={deletingPlanningArtifact}
        draft={planningArtifactDraft}
        isSaving={updatePlanningArtifactsMutation.isPending}
        onDraftChange={setPlanningArtifactDraft}
        onCloseEditor={() => setEditingPlanningArtifact(null)}
        onSave={savePlanningArtifactDraft}
        onCloseDelete={() => setDeletingPlanningArtifact(null)}
        onDelete={() => {
          if (!deletingPlanningArtifact) return;
          persistPlanningArtifactOverride(
            deletingPlanningArtifact,
            { deleted: true },
            {
              successTitle: 'Planning artifact removed',
              successDescription: 'The artifact was removed from the current planning package.',
              errorTitle: 'Unable to remove artifact',
              errorDescription: 'The planning artifact could not be removed.',
              closeDelete: true,
            },
          );
        }}
      />

      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-500" />
              Edit Task
            </DialogTitle>
            <DialogDescription>
              Modify task details and save changes
            </DialogDescription>
          </DialogHeader>
          {editingTask && (
            <TaskEditForm
              task={editingTask}
              onSave={(updates) => updateTaskMutation.mutate({ id: editingTask.id, updates })}
              onCancel={() => setEditingTask(null)}
              isLoading={updateTaskMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingTask} onOpenChange={(open) => !open && setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Delete Task
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTask?.taskName || deletingTask?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTask && deleteTaskMutation.mutate(deletingTask.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteTaskMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PlanningApprovalDialogs
        submitOpen={showSubmitDialog}
        onSubmitOpenChange={setShowSubmitDialog}
        taskCount={tasks.length}
        completedTaskCount={taskStats.completed}
        progress={progress}
        submitNotes={submitNotes}
        onSubmitNotesChange={setSubmitNotes}
        onSubmitForApproval={() => submitForApprovalMutation.mutate()}
        isSubmitting={submitForApprovalMutation.isPending}
        governanceOpen={showBrainGovernance}
        onGovernanceOpenChange={setShowBrainGovernance}
        wbsBrainDecision={wbsBrainDecision}
        brainStatus={brainStatus}
        policyVerdict={policyVerdict}
        contextScore={contextScore}
        brainRiskLevel={brainDecision?.riskLevel || null}
        onOpenDecisionBrain={() => {
          globalThis.history.pushState({}, '', '/brain-console/decisions');
          globalThis.dispatchEvent(new PopStateEvent('popstate'));
        }}
        historyOpen={showApprovalHistory}
        onHistoryOpenChange={setShowApprovalHistory}
        approvalHistory={approvalHistory}
        noApprovalHistoryText={t('projectWorkspace.planning.noApprovalHistory')}
      />

      <ResourceAssignmentDialog
        open={resourceDialogOpen}
        task={resourceDialogTask}
        currentlyAssigned={currentlyAssigned}
        selectedResources={selectedResources}
        searchQuery={resourceSearchQuery}
        viewMode={resourceViewMode}
        filteredResources={filteredResources}
        isSaving={updateTaskMutation.isPending}
        noSuggestionsText={t('projectWorkspace.planning.noAiSuggestions')}
        noResourcesText={t('projectWorkspace.planning.noResourcesMatchSearch')}
        onOpenChange={(open) => {
          setResourceDialogOpen(open);
          if (!open) {
            setResourceDialogTask(null);
            setSelectedResources([]);
            setResourceSearchQuery('');
            setResourceViewMode('suggested');
          }
        }}
        onSearchQueryChange={setResourceSearchQuery}
        onViewModeChange={setResourceViewMode}
        onSelectedResourcesChange={setSelectedResources}
        onRemoveAssigned={(resourceName) => {
          if (!resourceDialogTask) return;
          const newAssigned = currentlyAssigned.filter((resource) => resource.name !== resourceName);
          const newResourceString = newAssigned.length > 0 ? newAssigned.map((resource) => resource.name).join(', ') : undefined;
          updateTaskMutation.mutate({
            id: resourceDialogTask.id,
            updates: { assignedTo: newResourceString },
          });
        }}
        onSave={() => {
          if (resourceDialogTask) {
            const combinedResources = [
              ...currentlyAssigned.map((resource) => resource.name),
              ...selectedResources,
            ];
            const uniqueResources = Array.from(new Set(combinedResources));
            const resourceString = uniqueResources.join(', ') || undefined;
            updateTaskMutation.mutate({
              id: resourceDialogTask.id,
              updates: { assignedTo: resourceString },
            }, {
              onSettled: () => {
                setResourceDialogOpen(false);
              },
            });
          } else {
            setResourceDialogOpen(false);
          }
        }}
      />
    </div>
  );

  return renderContent();
}
