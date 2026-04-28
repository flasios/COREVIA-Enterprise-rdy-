/**
 * PlanningGateChecklist — G1 "Planning → Execution" gate readiness cockpit.
 *
 * Computes Planning gate checks deterministically from real project signals
 * rather than manual ticks. The gate is deliberately decoupled from the Risk
 * Register approval workflow — they are independent governance artefacts.
 *
 * Signal sources:
 *   • WBS approval               → wbsApproval query
 *   • Schedule baseline          → task plannedStart/End coverage
 *   • Budget baseline            → project.metadata.costPlan.baselineLockedAt
 *   • Resource plan              → task.assignedTo coverage
 *   • Procurement plan           → project.metadata.costPlan.commitments count
 *   • Quality / Comms / Change / Tech design → evidence on project.metadata.planningGateEvidence
 *   • Detailed requirements      → demandReport.detailedRequirementsApprovedAt || businessCase approval
 *
 * Readiness is a weighted score (0..100) using the same weights as the
 * gate_check_catalog seed. Critical checks MUST pass before submission.
 */

import { useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  GitBranch,
  Wallet,
  Users as UsersIcon,
  FileCheck2,
  MessageSquare,
  Package,
  RefreshCw,
  Sparkles,
  Layers,
  ClipboardCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { ProjectData, BusinessCaseData, WbsTaskData, DemandReportData } from '../../types';

interface PlanningGateChecklistProps {
  project: ProjectData;
  businessCase?: BusinessCaseData | null;
  demandReport?: DemandReportData | null;
  tasks: WbsTaskData[];
  wbsApproval?: { status?: string | null } | null;
  onNavigate?: (section: string) => void;
}

type CheckStatus = 'passed' | 'pending' | 'failed';

interface GateCheckRow {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isCritical: boolean;
  weight: number;
  status: CheckStatus;
  /** Human-readable explanation of how status was derived. */
  evidence: string;
  /** Optional deep link back to the section where the work happens. */
  linkSection?: string;
  linkLabel?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function PlanningGateChecklist({
  project,
  businessCase,
  demandReport,
  tasks,
  wbsApproval,
  onNavigate,
}: PlanningGateChecklistProps) {
  const checks: GateCheckRow[] = useMemo(() => {
    const metadata = asRecord(project.metadata);
    const costPlan = asRecord(metadata['costPlan']);
    const commitments = Array.isArray(costPlan['commitments']) ? (costPlan['commitments'] as unknown[]) : [];
    const rateCard = Array.isArray(costPlan['rateCard']) ? (costPlan['rateCard'] as unknown[]) : [];
    const cbs = Array.isArray(costPlan['cbs']) ? (costPlan['cbs'] as unknown[]) : [];
    const baselineLockedAt = costPlan['baselineLockedAt'];
    const gateEvidence = asRecord(metadata['planningGateEvidence']);

    // Check 1 — WBS Complete
    const wbsStatus: CheckStatus = wbsApproval?.status === 'approved' ? 'passed' : (tasks.length === 0 ? 'failed' : 'pending');
    const wbsTaskCount = tasks.length;

    // Check 2 — Schedule baselined: tasks have both planned start and end dates
    const withDates = tasks.filter(t => t.plannedStartDate && t.plannedEndDate).length;
    const scheduleCoverage = tasks.length > 0 ? withDates / tasks.length : 0;
    const scheduleStatus: CheckStatus =
      tasks.length === 0 ? 'failed'
      : scheduleCoverage >= 0.9 ? 'passed'
      : scheduleCoverage >= 0.6 ? 'pending'
      : 'failed';

    // Check 3 — Budget baseline established
    const budgetStatus: CheckStatus = baselineLockedAt ? 'passed' : (cbs.length > 0 ? 'pending' : 'failed');

    // Check 4 — Resource plan: non-phase work packages have an owner
    const leafTasks = tasks.filter(t => {
      const wpType = ((t as unknown as Record<string, unknown>)['workPackageType'] as string | undefined) ?? '';
      return wpType !== 'phase' && wpType !== 'milestone';
    });
    const assigned = leafTasks.filter(t => (t.assignedTo || '').trim().length > 0).length;
    const resourceCoverage = leafTasks.length > 0 ? assigned / leafTasks.length : 0;
    const resourceStatus: CheckStatus =
      leafTasks.length === 0 ? 'failed'
      : resourceCoverage >= 0.8 ? 'passed'
      : resourceCoverage >= 0.4 ? 'pending'
      : 'failed';

    // Check 5 — Quality management plan (evidence flag)
    const qualityStatus: CheckStatus = gateEvidence['qualityPlan'] ? 'passed' : 'pending';

    // Check 6 — Communication plan (evidence flag or stakeholder count)
    const commsStatus: CheckStatus = gateEvidence['communicationPlan'] ? 'passed' : 'pending';

    // Check 7 — Procurement plan: commitments + rate card present OR not applicable flagged
    const hasProcurement = commitments.length > 0 || rateCard.length > 0;
    const procStatus: CheckStatus = hasProcurement ? 'passed' : gateEvidence['procurementNotApplicable'] ? 'passed' : 'pending';

    // Check 8 — Change control process defined
    const changeControlStatus: CheckStatus = gateEvidence['changeControlPlan'] ? 'passed' : 'pending';

    // Check 9 — Detailed requirements approved (derived from demand-phase gate)
    const demandMeta = asRecord(demandReport);
    const bcMeta = asRecord(businessCase);
    const drApprovedAt = safeDate(demandMeta['detailedRequirementsApprovedAt'])
      ?? safeDate(demandMeta['finalApprovalDate'])
      ?? safeDate(bcMeta['approvedAt'])
      ?? safeDate(bcMeta['finalApprovalDate']);
    const reqStatus: CheckStatus = drApprovedAt ? 'passed' : (demandReport || businessCase ? 'pending' : 'failed');

    // Check 10 — Technical design reviewed (evidence flag)
    const techStatus: CheckStatus = gateEvidence['technicalDesignReview'] ? 'passed' : 'pending';

    return [
      {
        id: 'wbs-complete', name: 'Work Breakdown Structure Complete', isCritical: true, weight: 15, icon: Layers,
        description: 'The full WBS has been drafted and approved by the PMO.',
        status: wbsStatus,
        evidence: wbsStatus === 'passed'
          ? `WBS approved — ${wbsTaskCount} tasks in the baseline.`
          : wbsStatus === 'pending' ? `WBS exists (${wbsTaskCount} tasks) but is not yet PMO-approved.`
          : 'No WBS tasks generated yet.',
        linkSection: 'wbs', linkLabel: 'Open WBS',
      },
      {
        id: 'schedule-baselined', name: 'Project Schedule Baselined', isCritical: true, weight: 12, icon: GitBranch,
        description: 'Planned start and end dates are set for at least 90% of work packages.',
        status: scheduleStatus,
        evidence: `${withDates} of ${tasks.length} tasks have planned dates (${Math.round(scheduleCoverage * 100)}% coverage).`,
        linkSection: 'wbs', linkLabel: 'Fix schedule',
      },
      {
        id: 'budget-baselined', name: 'Budget Baseline Established', isCritical: true, weight: 12, icon: Wallet,
        description: 'The Cost Breakdown Structure (CBS) is seeded and the baseline is locked.',
        status: budgetStatus,
        evidence: budgetStatus === 'passed'
          ? `CBS baseline locked on ${new Date(String(baselineLockedAt)).toLocaleDateString()} — ${cbs.length} line items.`
          : budgetStatus === 'pending' ? `CBS drafted with ${cbs.length} lines but baseline not locked.`
          : 'No CBS has been seeded. Approve the WBS first.',
        linkSection: 'cost', linkLabel: 'Open cost plan',
      },
      {
        id: 'resource-plan', name: 'Resource Plan Approved', isCritical: true, weight: 10, icon: UsersIcon,
        description: 'Work packages have owners assigned so accountability is clear.',
        status: resourceStatus,
        evidence: leafTasks.length === 0
          ? 'No leaf work packages to assign.'
          : `${assigned} of ${leafTasks.length} work packages have owners (${Math.round(resourceCoverage * 100)}%).`,
        linkSection: 'resources', linkLabel: 'Assign owners',
      },
      {
        id: 'quality-plan', name: 'Quality Management Plan', isCritical: false, weight: 8, icon: FileCheck2,
        description: 'Quality criteria, reviews, and acceptance gates are documented.',
        status: qualityStatus,
        evidence: qualityStatus === 'passed' ? 'Quality plan recorded on project metadata.' : 'Not yet provided — attach from Deliverables or mark waived with PMO approval.',
        linkSection: 'deliverables', linkLabel: 'Open deliverables',
      },
      {
        id: 'comms-plan', name: 'Communication Plan Developed', isCritical: false, weight: 6, icon: MessageSquare,
        description: 'A stakeholder communication matrix is published.',
        status: commsStatus,
        evidence: commsStatus === 'passed' ? 'Communication plan recorded.' : 'Not yet provided.',
      },
      {
        id: 'procurement-plan', name: 'Procurement Plan Complete', isCritical: false, weight: 6, icon: Package,
        description: 'Commitments and vendor rates are documented — or procurement is waived.',
        status: procStatus,
        evidence: procStatus === 'passed'
          ? `${commitments.length} commitment(s), ${rateCard.length} rate card entry(ies) documented.`
          : 'No commitments or rate card entries yet.',
        linkSection: 'cost', linkLabel: 'Open cost plan',
      },
      {
        id: 'change-control', name: 'Change Control Process Defined', isCritical: false, weight: 6, icon: RefreshCw,
        description: 'Change request workflow and thresholds are documented.',
        status: changeControlStatus,
        evidence: changeControlStatus === 'passed' ? 'Change control process recorded.' : 'Not yet provided.',
      },
      {
        id: 'detailed-requirements', name: 'Detailed Requirements Approved', isCritical: true, weight: 10, icon: ClipboardCheck,
        description: 'Requirements from the demand phase are signed off.',
        status: reqStatus,
        evidence: reqStatus === 'passed'
          ? `Approved${drApprovedAt ? ` on ${drApprovedAt.toLocaleDateString()}` : ''}.`
          : reqStatus === 'pending' ? 'Business case exists but approval date not recorded.'
          : 'No demand-phase business case linked to this project.',
      },
      {
        id: 'technical-design', name: 'Technical Design Reviewed', isCritical: false, weight: 5, icon: Sparkles,
        description: 'Architecture / solution design has been peer-reviewed.',
        status: techStatus,
        evidence: techStatus === 'passed' ? 'Technical design review recorded.' : 'Not yet provided.',
      },
    ];
  }, [project.metadata, tasks, wbsApproval, demandReport, businessCase]);

  const stats = useMemo(() => {
    const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
    const passedWeight = checks.filter(c => c.status === 'passed').reduce((s, c) => s + c.weight, 0);
    const pendingWeight = checks.filter(c => c.status === 'pending').reduce((s, c) => s + c.weight * 0.5, 0);
    const readiness = totalWeight > 0 ? Math.round(((passedWeight + pendingWeight) / totalWeight) * 100) : 0;
    const critical = checks.filter(c => c.isCritical);
    const criticalPassed = critical.filter(c => c.status === 'passed').length;
    const criticalAllPassed = criticalPassed === critical.length;
    return {
      readiness, totalWeight, passedWeight,
      passedCount: checks.filter(c => c.status === 'passed').length,
      pendingCount: checks.filter(c => c.status === 'pending').length,
      failedCount: checks.filter(c => c.status === 'failed').length,
      criticalCount: critical.length, criticalPassed, criticalAllPassed,
    };
  }, [checks]);

  const readinessTone =
    stats.readiness >= 90 && stats.criticalAllPassed ? 'emerald'
    : stats.readiness >= 70 ? 'amber'
    : 'rose';

  return (
    <div className="space-y-4" data-testid="planning-gate-checklist">
      {/* Readiness header */}
      <Card className={`border-${readinessTone}-300 dark:border-${readinessTone}-600/40 bg-gradient-to-br from-${readinessTone}-50/60 via-white to-white dark:from-${readinessTone}-500/10 dark:via-slate-900 dark:to-slate-900`}>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${
            readinessTone === 'emerald' ? 'from-emerald-500 to-green-600'
            : readinessTone === 'amber' ? 'from-amber-500 to-orange-600'
            : 'from-rose-500 to-red-600'
          } text-white shadow-lg`}>
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Planning → Execution Gate (G1)</h3>
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] tabular-nums">
                Readiness {stats.readiness}%
              </Badge>
              {stats.criticalAllPassed ? (
                <Badge className="h-5 gap-1 bg-emerald-500/20 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" /> All critical checks passed
                </Badge>
              ) : (
                <Badge className="h-5 gap-1 bg-rose-500/20 px-1.5 text-[10px] text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="h-3 w-3" /> {stats.criticalCount - stats.criticalPassed} critical check{stats.criticalCount - stats.criticalPassed === 1 ? '' : 's'} outstanding
                </Badge>
              )}
            </div>
            <p className="mt-1 text-[11.5px] leading-tight text-slate-600 dark:text-slate-300">
              {stats.passedCount} passed · {stats.pendingCount} pending · {stats.failedCount} failed. Statuses are auto-computed from the WBS, CBS, resource assignments, and demand-phase approvals. No manual ticking required for the auto-verified items.
            </p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold tabular-nums ${
              readinessTone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400'
              : readinessTone === 'amber' ? 'text-amber-600 dark:text-amber-400'
              : 'text-rose-600 dark:text-rose-400'
            }`}>
              {stats.readiness}%
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">weighted readiness</div>
          </div>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ClipboardCheck className="h-4 w-4 text-indigo-600" />
            Gate Checklist
            <Badge variant="outline" className="ml-2 h-5 px-1.5 text-[10px]">
              {checks.length} checks
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {checks.map((c) => {
              const Icon = c.icon;
              const statusTone = c.status === 'passed'
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                : c.status === 'pending' ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30'
                : 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30';
              const StatusIcon = c.status === 'passed' ? CheckCircle2 : c.status === 'pending' ? Circle : XCircle;
              return (
                <div key={c.id} className="flex flex-wrap items-start gap-3 px-4 py-3" data-testid={`gate-check-${c.id}`}>
                  <div className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md border ${statusTone}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[12.5px] font-semibold text-slate-900 dark:text-white">{c.name}</span>
                      {c.isCritical && (
                        <Badge variant="outline" className="h-4 border-rose-300 px-1 text-[9px] uppercase tracking-[0.1em] text-rose-600 dark:border-rose-500/40 dark:text-rose-400">
                          Critical
                        </Badge>
                      )}
                      <Badge variant="outline" className="h-4 px-1 text-[9px] tabular-nums text-slate-500">
                        w {c.weight}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{c.description}</p>
                    <p className={`mt-1 text-[11px] leading-tight ${
                      c.status === 'passed' ? 'text-emerald-700 dark:text-emerald-300'
                      : c.status === 'pending' ? 'text-amber-700 dark:text-amber-300'
                      : 'text-rose-700 dark:text-rose-300'
                    }`}>
                      {c.evidence}
                    </p>
                  </div>
                  {c.linkSection && onNavigate && c.status !== 'passed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-[11px]"
                      onClick={() => onNavigate(c.linkSection!)}
                      data-testid={`gate-check-link-${c.id}`}
                    >
                      {c.linkLabel ?? 'Open'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
