import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BarChart3,
  AlertTriangle,
  Shield,
  Target,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  DollarSign,
  Activity,
  Gauge,
  FileCheck,
  ClipboardCheck,
  Flag,
  Zap,
  CircleDot,
  FileText,
  Eye,
} from 'lucide-react';

import type {
  ProjectData,
  WbsTaskData,
  IssueData,
  RiskData,
  GateData,
  ApprovalData,
  StakeholderData,
  DocumentData,
  ManagementSummary,
} from '../../types';
import { healthColors } from '../../utils';
import { formatCurrency, formatDate } from '../../utils';
import { PhaseGateWorkflow } from '../PhaseGateWorkflow';
import { RisksTab } from '../legacy/RisksTab';

interface CriticalPathAnalysis {
  criticalPath: string[];
  projectDuration: number;
  criticalTaskCount: number;
}

interface MonitoringPhaseTabProps {
  project: ProjectData;
  summary?: ManagementSummary['summary'];
  risks: RiskData[];
  issues: IssueData[];
  tasks: WbsTaskData[];
  gates?: GateData[];
  approvals?: ApprovalData[];
  stakeholders?: StakeholderData[];
  documents?: DocumentData[];
  criticalPathAnalysis?: CriticalPathAnalysis;
  onAddRisk: () => void;
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
}

function TrafficLight({ label, status }: {
  label: string;
  status: 'green' | 'amber' | 'red' | 'grey';
}) {
  const colors = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    grey: 'bg-muted-foreground/40',
  };
  const labels = {
    green: 'On Track',
    amber: 'At Risk',
    red: 'Critical',
    grey: 'No Data',
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
      <div className={`w-4 h-4 rounded-full ${colors[status]} shadow-sm`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{labels[status]}</div>
      </div>
    </div>
  );
}

export function MonitoringPhaseTab({
  project,
  summary,
  risks,
  issues,
  tasks,
  gates = [],
  approvals = [],
  stakeholders = [],
  documents = [],
  criticalPathAnalysis,
  onAddRisk,
  activeSubTab = 'overview',
}: MonitoringPhaseTabProps) {
  const { t } = useTranslation();
  const activeSection = activeSubTab;
  const [riskSearchTerm, setRiskSearchTerm] = useState('');
  const [riskFilterStatus, setRiskFilterStatus] = useState<string>('all');

  const taskProgress = tasks.length > 0
    ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)
    : 0;

  const criticalRisks = risks.filter(r => r.riskLevel === 'critical' || r.riskLevel === 'high');

  const evmMetrics = useMemo(() => {
    const budgetStr = project.approvedBudget || project.totalBudget?.toString();
    const BAC = budgetStr ? parseFloat(budgetStr) : 0;

    let totalPV = 0;
    let totalEV = 0;
    let totalAC = 0;
    let tasksWithCost = 0;

    // Check if any tasks have individual planned costs
    const totalPlannedFromTasks = tasks.reduce((s, t) => s + parseFloat(t.plannedCost || '0'), 0);
    const hasTaskCosts = totalPlannedFromTasks > 0;

    // If tasks don't have individual costs, distribute BAC evenly across leaf tasks
    const leafTasks = tasks.filter(t => t.taskType !== 'phase');
    const costPerTask = !hasTaskCosts && leafTasks.length > 0 && BAC > 0 ? BAC / leafTasks.length : 0;

    const workingTasks = hasTaskCosts ? tasks : leafTasks;

    workingTasks.forEach(t => {
      const planned = hasTaskCosts ? parseFloat(t.plannedCost || '0') : costPerTask;
      const actual = parseFloat(t.actualCost || '0');
      const progress = (t.percentComplete ?? t.progress ?? 0) / 100;

      if (planned > 0) {
        tasksWithCost++;
        // Time-phased PV: compute how much of the task's schedule has elapsed
        const now = new Date();
        const start = t.baselineStartDate ? new Date(t.baselineStartDate) : (t.plannedStartDate ? new Date(t.plannedStartDate) : null);
        const end = t.baselineEndDate ? new Date(t.baselineEndDate) : (t.plannedEndDate ? new Date(t.plannedEndDate) : null);
        let schedulePct = 0;
        if (start && end && end.getTime() > start.getTime()) {
          if (now >= end) {
            schedulePct = 1;
          } else if (now > start) {
            schedulePct = (now.getTime() - start.getTime()) / (end.getTime() - start.getTime());
          }
        } else if (start && now >= start) {
          schedulePct = 1; // no end date but task started
        } else if (!start && !end) {
          // No dates: use status as proxy
          if (t.status === 'completed') schedulePct = 1;
          else if (t.status === 'in_progress' || t.status === 'in-progress') schedulePct = 0.5;
        }
        totalPV += planned * schedulePct;
        totalEV += planned * progress;
      }
      if (actual > 0) {
        totalAC += actual;
      }
    });

    // If no per-task AC, use project-level actualSpend
    if (totalAC === 0) {
      totalAC = parseFloat(project.actualSpend?.toString() || '0');
    }

    const hasCostData = tasksWithCost > 0 || (BAC > 0 && leafTasks.length > 0);
    const SPI = totalPV > 0 ? totalEV / totalPV : null;
    const CPI = totalAC > 0 ? totalEV / totalAC : null;
    const EAC = CPI && CPI > 0 && BAC > 0 ? BAC / CPI : null;
    const ETC = EAC ? EAC - totalAC : null;
    const VAC = EAC && BAC > 0 ? BAC - EAC : null;
    const TCPI = BAC > 0 && BAC !== totalAC ? (BAC - totalEV) / (BAC - totalAC) : null;

    const actualSpend = project.actualSpend || totalAC;

    return {
      BAC, totalPV, totalEV, totalAC, SPI, CPI, EAC, ETC, VAC, TCPI,
      hasCostData, actualSpend,
    };
  }, [tasks, project]);

  const milestones = useMemo(() => {
    const now = new Date();
    const ms = tasks.filter(t => t.isMilestone || t.taskType === 'milestone');
    const overdue = ms.filter(t => {
      const end = t.plannedEndDate ? new Date(t.plannedEndDate) : null;
      return end && end < now && t.status !== 'completed';
    });
    const upcoming = ms.filter(t => {
      const end = t.plannedEndDate ? new Date(t.plannedEndDate) : null;
      const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return end && end >= now && end <= in30 && t.status !== 'completed';
    });
    const completed = ms.filter(t => t.status === 'completed');
    return { all: ms, overdue, upcoming, completed };
  }, [tasks]);

  const velocityMetrics = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const completedTasks = tasks.filter(t => t.status === 'completed');
    const completedThisWeek = completedTasks.filter(t => {
      const d = t.actualEndDate ? new Date(t.actualEndDate) : null;
      return d && d >= oneWeekAgo;
    });
    const completedThisMonth = completedTasks.filter(t => {
      const d = t.actualEndDate ? new Date(t.actualEndDate) : null;
      return d && d >= oneMonthAgo;
    });

    return {
      thisWeek: completedThisWeek.length,
      thisMonth: completedThisMonth.length,
      totalCompleted: completedTasks.length,
    };
  }, [tasks]);

  const scheduleAnalysis = useMemo(() => {
    const withVariance = tasks.filter(t => t.scheduleVarianceDays !== undefined && t.scheduleVarianceDays !== 0);
    const ahead = withVariance.filter(t => (t.scheduleVarianceDays || 0) < 0);
    const behind = withVariance.filter(t => (t.scheduleVarianceDays || 0) > 0);
    const onTrack = tasks.filter(t => !t.scheduleVarianceDays || t.scheduleVarianceDays === 0);
    const avgVariance = withVariance.length > 0
      ? withVariance.reduce((sum, t) => sum + (t.scheduleVarianceDays || 0), 0) / withVariance.length
      : 0;

    return { ahead: ahead.length, behind: behind.length, onTrack: onTrack.length, avgVariance };
  }, [tasks]);

  const taskAging = useMemo(() => {
    const now = new Date();
    const inProgress = tasks.filter(t => t.status === 'in_progress');
    const aging = inProgress.map(t => {
      const start = t.actualStartDate ? new Date(t.actualStartDate) : (t.plannedStartDate ? new Date(t.plannedStartDate) : now);
      const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return { ...t, ageDays: days };
    }).sort((a, b) => b.ageDays - a.ageDays);

    return aging;
  }, [tasks]);

  const gateCompliance = useMemo(() => {
    const approved = gates.filter(g => g.status === 'approved');
    const pending = gates.filter(g => g.status === 'pending' || g.status === 'in_review' || g.status === 'submitted');
    const rejected = gates.filter(g => g.status === 'rejected');
    const notStarted = gates.filter(g => g.status === 'not_started');
    const complianceRate = gates.length > 0 ? Math.round((approved.length / gates.length) * 100) : 0;

    return { approved, pending, rejected, notStarted, total: gates.length, complianceRate };
  }, [gates]);

  const deliverableStatus = useMemo(() => {
    const deliverables = tasks.filter(t => t.taskType === 'deliverable');
    const withEvidence = tasks.filter(t => t.evidenceUrl || t.evidenceFileName);
    const accepted = deliverables.filter(t => t.status === 'completed');
    const pending = deliverables.filter(t => t.status !== 'completed');

    return { total: deliverables.length, accepted: accepted.length, pending: pending.length, withEvidence: withEvidence.length };
  }, [tasks]);

  const spiStatus = evmMetrics.SPI === null ? 'neutral' : evmMetrics.SPI >= 0.95 ? 'good' : evmMetrics.SPI >= 0.8 ? 'warning' : 'critical';
  const cpiStatus = evmMetrics.CPI === null ? 'neutral' : evmMetrics.CPI >= 0.95 ? 'good' : evmMetrics.CPI >= 0.8 ? 'warning' : 'critical';

  const scopeStatus = useMemo((): 'green' | 'amber' | 'red' | 'grey' => {
    if (tasks.length === 0) return 'grey';
    const blockedPct = tasks.filter(t => t.status === 'blocked').length / tasks.length;
    if (blockedPct > 0.2) return 'red';
    if (blockedPct > 0.05) return 'amber';
    return 'green';
  }, [tasks]);

  const scheduleStatus = useMemo((): 'green' | 'amber' | 'red' | 'grey' => {
    if (evmMetrics.SPI === null) {
      if (milestones.overdue.length > 2) return 'red';
      if (milestones.overdue.length > 0) return 'amber';
      return tasks.length > 0 ? 'green' : 'grey';
    }
    if (evmMetrics.SPI >= 0.95) return 'green';
    if (evmMetrics.SPI >= 0.8) return 'amber';
    return 'red';
  }, [evmMetrics.SPI, milestones.overdue.length, tasks.length]);

  const budgetStatus = useMemo((): 'green' | 'amber' | 'red' | 'grey' => {
    if (evmMetrics.CPI === null) {
      if (evmMetrics.BAC === 0) return 'grey';
      const utilization = evmMetrics.actualSpend / evmMetrics.BAC;
      if (utilization > 1) return 'red';
      if (utilization > 0.9) return 'amber';
      return 'green';
    }
    if (evmMetrics.CPI >= 0.95) return 'green';
    if (evmMetrics.CPI >= 0.8) return 'amber';
    return 'red';
  }, [evmMetrics]);

  const qualityStatus = useMemo((): 'green' | 'amber' | 'red' | 'grey' => {
    if (gates.length === 0) return 'grey';
    if (gateCompliance.rejected.length > 0) return 'red';
    if (gateCompliance.complianceRate >= 80) return 'green';
    if (gateCompliance.complianceRate >= 50) return 'amber';
    return 'red';
  }, [gates.length, gateCompliance]);

  const riskStatus = useMemo((): 'green' | 'amber' | 'red' | 'grey' => {
    if (risks.length === 0) return 'grey';
    const critCount = risks.filter(r => r.riskLevel === 'critical' && r.status !== 'closed').length;
    const highCount = risks.filter(r => r.riskLevel === 'high' && r.status !== 'closed').length;
    if (critCount > 0) return 'red';
    if (highCount > 2) return 'amber';
    return 'green';
  }, [risks]);

  const actionItems = useMemo(() => {
    const items: Array<{ type: string; label: string; detail: string; severity: 'critical' | 'high' | 'medium' | 'low' }> = [];

    const criticalOpenRisks = risks.filter(r => r.riskLevel === 'critical' && r.status !== 'closed' && r.status !== 'resolved');
    criticalOpenRisks.forEach(r => {
      items.push({ type: 'risk', label: r.title, detail: `${r.riskCode} - Score: ${r.riskScore}`, severity: 'critical' });
    });

    milestones.overdue.forEach(m => {
      items.push({ type: 'milestone', label: m.taskName || m.title || 'Milestone', detail: `Due: ${formatDate(m.plannedEndDate)}`, severity: 'high' });
    });

    const pendingApprovals = approvals.filter(a => a.status === 'pending');
    pendingApprovals.forEach(a => {
      items.push({ type: 'approval', label: `${a.approvalType} Approval`, detail: `Requested: ${formatDate(a.requestedDate)}`, severity: 'medium' });
    });

    const criticalIssues = issues.filter(i => (i.priority === 'critical' || i.severity === 'critical') && i.status !== 'resolved' && i.status !== 'closed');
    criticalIssues.forEach(i => {
      items.push({ type: 'issue', label: i.title, detail: `${i.issueCode} - ${i.severity}`, severity: 'critical' });
    });

    const blocked = tasks.filter(t => t.status === 'blocked');
    if (blocked.length > 0) {
      items.push({ type: 'blocked', label: `${blocked.length} Blocked Task${blocked.length > 1 ? 's' : ''}`, detail: 'Requires immediate attention', severity: 'high' });
    }

    return items.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    });
  }, [risks, milestones.overdue, approvals, issues, tasks]);

  return (
    <div className="space-y-6">
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <Card className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-50/80 via-white to-emerald-50/60">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15)_0%,_transparent_55%)]" />
            <CardContent className="relative p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-600/70">Performance Cockpit</p>
                  <h3 className="text-2xl font-semibold text-slate-900">Delivery Health Overview</h3>
                  <p className="text-sm text-muted-foreground max-w-2xl">
                    Track schedule, budget, and execution signals with priority actions for this phase.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-[10px]">Tasks {tasks.length}</Badge>
                  <Badge variant="secondary" className="text-[10px]">Approvals {approvals.length}</Badge>
                  <Badge variant="secondary" className="text-[10px]">Gates {gates.length}</Badge>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200/70 bg-white/90 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className={`w-2 h-2 rounded-full ${taskProgress >= 75 ? 'bg-emerald-500' : taskProgress >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} />
                      Progress
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">{taskProgress}%</div>
                    <div className="text-[11px] text-muted-foreground">{summary?.completedTasks || tasks.filter(t => t.status === 'completed').length}/{summary?.totalTasks || tasks.length} tasks</div>
                  </div>
                  <div className={`rounded-xl border p-3 ${spiStatus === 'good' ? 'border-emerald-500/30 bg-emerald-50/60' : spiStatus === 'warning' ? 'border-amber-500/30 bg-amber-50/60' : spiStatus === 'critical' ? 'border-red-500/30 bg-red-50/60' : 'border-slate-200/70 bg-white/90'}`}>
                    <div className="text-xs text-muted-foreground">SPI</div>
                    <div className={`mt-2 text-2xl font-semibold ${spiStatus === 'good' ? 'text-emerald-600 dark:text-emerald-400' : spiStatus === 'warning' ? 'text-amber-600 dark:text-amber-400' : spiStatus === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-slate-900'}`}>
                      {evmMetrics.SPI !== null ? evmMetrics.SPI.toFixed(2) : '--'}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Schedule Index</div>
                  </div>
                  <div className={`rounded-xl border p-3 ${cpiStatus === 'good' ? 'border-emerald-500/30 bg-emerald-50/60' : cpiStatus === 'warning' ? 'border-amber-500/30 bg-amber-50/60' : cpiStatus === 'critical' ? 'border-red-500/30 bg-red-50/60' : 'border-slate-200/70 bg-white/90'}`}>
                    <div className="text-xs text-muted-foreground">CPI</div>
                    <div className={`mt-2 text-2xl font-semibold ${cpiStatus === 'good' ? 'text-emerald-600 dark:text-emerald-400' : cpiStatus === 'warning' ? 'text-amber-600 dark:text-amber-400' : cpiStatus === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-slate-900'}`}>
                      {evmMetrics.CPI !== null ? evmMetrics.CPI.toFixed(2) : '--'}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Cost Index</div>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-white/90 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Zap className="w-3 h-3" />
                      Velocity
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">{velocityMetrics.thisWeek}</div>
                    <div className="text-[11px] text-muted-foreground">{velocityMetrics.thisMonth} this month</div>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-white/90 p-3">
                    <div className="text-xs text-muted-foreground">Variance</div>
                    <div className={`mt-2 text-2xl font-semibold ${scheduleAnalysis.avgVariance <= 0 ? 'text-emerald-600 dark:text-emerald-400' : scheduleAnalysis.avgVariance > 5 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {scheduleAnalysis.avgVariance > 0 ? '+' : ''}{scheduleAnalysis.avgVariance.toFixed(1)}d
                    </div>
                    <div className="text-[11px] text-muted-foreground">{scheduleAnalysis.behind} behind</div>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-white/90 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <AlertTriangle className="w-3 h-3" />
                      Risks
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">{risks.filter(r => r.status !== 'closed').length}</div>
                    <div className="text-[11px] text-muted-foreground">{criticalRisks.filter(r => r.status !== 'closed').length} critical</div>
                  </div>
                </div>
                <Card className="border-slate-200/70 bg-white/90">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Immediate Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {actionItems.length === 0 ? (
                      <div className="text-xs text-muted-foreground">{t('projectWorkspace.monitoring.noUrgentActions')}</div>
                    ) : (
                      actionItems.slice(0, 4).map((item) => (
                        <div key={`${item.type}-${item.label}`} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200/70 bg-slate-50/70 px-2.5 py-2">
                          <div>
                            <div className="text-xs font-semibold text-slate-900 line-clamp-2">{item.label}</div>
                            <div className="text-[11px] text-muted-foreground">{item.detail}</div>
                          </div>
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {item.severity}
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-card/60 border-border lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gauge className="w-4 h-4" />
                    Earned Value Management
                  </CardTitle>
                  {evmMetrics.hasCostData && evmMetrics.TCPI !== null && (
                    <Badge className={Math.abs(evmMetrics.TCPI - 1) <= 0.1 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : evmMetrics.TCPI > 1.2 ? 'bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'}>
                      TCPI: {evmMetrics.TCPI.toFixed(2)}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {evmMetrics.hasCostData ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-muted/40 rounded-lg">
                        <div className="text-xs text-muted-foreground">Planned Value (PV)</div>
                        <div className="text-lg font-bold mt-1">{formatCurrency(evmMetrics.totalPV)}</div>
                      </div>
                      <div className="p-3 bg-muted/40 rounded-lg">
                        <div className="text-xs text-muted-foreground">Earned Value (EV)</div>
                        <div className="text-lg font-bold mt-1">{formatCurrency(evmMetrics.totalEV)}</div>
                      </div>
                      <div className="p-3 bg-muted/40 rounded-lg">
                        <div className="text-xs text-muted-foreground">Actual Cost (AC)</div>
                        <div className="text-lg font-bold mt-1">{formatCurrency(evmMetrics.totalAC)}</div>
                      </div>
                    </div>

                    <div className="relative h-6 bg-muted/40 rounded-full overflow-hidden">
                      {evmMetrics.BAC > 0 && (
                        <>
                          <div className="absolute inset-y-0 left-0 bg-blue-500/30 rounded-full transition-all" style={{ width: `${Math.min(100, (evmMetrics.totalPV / evmMetrics.BAC) * 100)}%` }} />
                          <div className="absolute inset-y-0 left-0 bg-emerald-500/60 rounded-full transition-all" style={{ width: `${Math.min(100, (evmMetrics.totalEV / evmMetrics.BAC) * 100)}%` }} />
                          <div className="absolute inset-y-0 left-0 flex items-center px-2">
                            <span className="text-xs font-medium">EV/PV</span>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500/50" />PV</div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" />EV</div>
                      <div className="flex-1" />
                      <span>BAC: {formatCurrency(evmMetrics.BAC)}</span>
                    </div>

                    {evmMetrics.EAC && (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-muted/40 rounded-lg">
                          <div className="text-xs text-muted-foreground">EAC</div>
                          <div className="text-sm font-bold mt-1">{formatCurrency(evmMetrics.EAC)}</div>
                          <div className="text-xs text-muted-foreground">Est. at Completion</div>
                        </div>
                        <div className="p-3 bg-muted/40 rounded-lg">
                          <div className="text-xs text-muted-foreground">ETC</div>
                          <div className="text-sm font-bold mt-1">{formatCurrency(evmMetrics.ETC || 0)}</div>
                          <div className="text-xs text-muted-foreground">Est. to Complete</div>
                        </div>
                        <div className={`p-3 rounded-lg ${(evmMetrics.VAC || 0) >= 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                          <div className="text-xs text-muted-foreground">VAC</div>
                          <div className={`text-sm font-bold mt-1 ${(evmMetrics.VAC || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {(evmMetrics.VAC || 0) >= 0 ? '+' : '-'}{formatCurrency(Math.abs(evmMetrics.VAC || 0))}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(evmMetrics.VAC || 0) >= 0 ? 'Under Budget' : 'Over Budget'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Gauge className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <div className="text-sm text-muted-foreground">EVM data requires planned costs on tasks</div>
                    <div className="text-xs text-muted-foreground mt-1">Add planned costs in Execution phase to enable EVM tracking</div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Budget
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evmMetrics.BAC > 0 ? (
                  <div className="space-y-4">
                    <div className="relative flex items-center justify-center">
                      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 36 36">
                        <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/30" />
                        <path
                          d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeDasharray={`${Math.min(100, Math.round((evmMetrics.actualSpend / evmMetrics.BAC) * 100))}, 100`}
                          className={evmMetrics.actualSpend > evmMetrics.BAC ? 'text-red-500' : evmMetrics.actualSpend > evmMetrics.BAC * 0.8 ? 'text-amber-500' : 'text-emerald-500'}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-bold">{Math.min(100, Math.round((evmMetrics.actualSpend / evmMetrics.BAC) * 100))}%</span>
                        <span className="text-xs text-muted-foreground">Utilized</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Budget</span>
                        <span className="font-medium">{formatCurrency(evmMetrics.BAC)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Spent</span>
                        <span className="font-medium">{formatCurrency(evmMetrics.actualSpend)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm border-t border-border pt-2">
                        <span className="text-muted-foreground">Remaining</span>
                        <span className={`font-bold ${evmMetrics.BAC - evmMetrics.actualSpend < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {formatCurrency(Math.max(0, evmMetrics.BAC - evmMetrics.actualSpend))}
                        </span>
                      </div>
                      {evmMetrics.EAC && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Forecast</span>
                          <span className={`font-medium ${evmMetrics.EAC > evmMetrics.BAC ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {formatCurrency(evmMetrics.EAC)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <DollarSign className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <div className="text-sm text-muted-foreground">{t('projectWorkspace.monitoring.noBudgetData')}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Task Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tasks.length > 0 ? (
                  <div className="space-y-3">
                    <div className="h-5 flex rounded-full overflow-hidden">
                      {[
                        { key: 'completed', color: 'bg-emerald-500', count: tasks.filter(t => t.status === 'completed').length },
                        { key: 'in_progress', color: 'bg-blue-500', count: tasks.filter(t => t.status === 'in_progress').length },
                        { key: 'not_started', color: 'bg-muted-foreground/40', count: tasks.filter(t => t.status === 'not_started').length },
                        { key: 'blocked', color: 'bg-red-500', count: tasks.filter(t => t.status === 'blocked').length },
                        { key: 'on_hold', color: 'bg-amber-500', count: tasks.filter(t => t.status === 'on_hold').length },
                      ].filter(s => s.count > 0).map(s => (
                        <div key={s.key} className={`${s.color} transition-all`} style={{ width: `${(s.count / tasks.length) * 100}%` }} />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {[
                        { label: 'Completed', count: tasks.filter(t => t.status === 'completed').length, color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'In Progress', count: tasks.filter(t => t.status === 'in_progress').length, color: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400' },
                        { label: 'Not Started', count: tasks.filter(t => t.status === 'not_started').length, color: 'bg-muted-foreground/40', textColor: 'text-muted-foreground' },
                        { label: 'Blocked', count: tasks.filter(t => t.status === 'blocked').length, color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400' },
                        { label: 'On Hold', count: tasks.filter(t => t.status === 'on_hold').length, color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400' },
                      ].filter(s => s.count > 0).map(s => (
                        <div key={s.label} className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${s.color} shrink-0`} />
                          <span className="text-sm text-muted-foreground flex-1">{s.label}</span>
                          <span className={`text-sm font-bold ${s.textColor}`}>{s.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">{t('projectWorkspace.monitoring.noTasksAvailable')}</div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Schedule Variance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
                      <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{scheduleAnalysis.ahead}</div>
                      <div className="text-xs text-muted-foreground">Ahead</div>
                    </div>
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-center">
                      <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{scheduleAnalysis.onTrack}</div>
                      <div className="text-xs text-muted-foreground">On Track</div>
                    </div>
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
                      <div className="text-xl font-bold text-red-600 dark:text-red-400">{scheduleAnalysis.behind}</div>
                      <div className="text-xs text-muted-foreground">Behind</div>
                    </div>
                  </div>
                  <div className="h-4 flex rounded-full overflow-hidden">
                    {tasks.length > 0 && (
                      <>
                        <div className="bg-emerald-500 transition-all" style={{ width: `${(scheduleAnalysis.ahead / tasks.length) * 100}%` }} />
                        <div className="bg-blue-500 transition-all" style={{ width: `${(scheduleAnalysis.onTrack / tasks.length) * 100}%` }} />
                        <div className="bg-red-500 transition-all" style={{ width: `${(scheduleAnalysis.behind / tasks.length) * 100}%` }} />
                      </>
                    )}
                  </div>
                  {criticalPathAnalysis && criticalPathAnalysis.criticalTaskCount > 0 && (
                    <div className="p-3 bg-muted/40 rounded-lg mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Critical Path</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm">{criticalPathAnalysis.criticalTaskCount} tasks</span>
                        <span className="text-sm font-medium">{criticalPathAnalysis.projectDuration} days</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Flag className="w-4 h-4" />
                  Milestones
                  {milestones.overdue.length > 0 && (
                    <Badge className="bg-red-500/20 text-red-600 dark:text-red-400">{milestones.overdue.length} overdue</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {milestones.all.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      <div className="p-2 bg-muted/40 rounded-lg text-center">
                        <div className="text-lg font-bold">{milestones.all.length}</div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                      <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{milestones.completed.length}</div>
                        <div className="text-xs text-muted-foreground">Done</div>
                      </div>
                      <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-center">
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{milestones.upcoming.length}</div>
                        <div className="text-xs text-muted-foreground">Soon</div>
                      </div>
                      <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
                        <div className="text-lg font-bold text-red-600 dark:text-red-400">{milestones.overdue.length}</div>
                        <div className="text-xs text-muted-foreground">Late</div>
                      </div>
                    </div>
                    {(milestones.overdue.length > 0 || milestones.upcoming.length > 0) && (
                      <ScrollArea className="h-[140px]">
                        <div className="space-y-1.5">
                          {milestones.overdue.map(m => (
                            <div key={m.id} className="flex items-center gap-2 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                              <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{m.taskName || m.title}</div>
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">{formatDate(m.plannedEndDate)}</span>
                            </div>
                          ))}
                          {milestones.upcoming.map(m => (
                            <div key={m.id} className="flex items-center gap-2 p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{m.taskName || m.title}</div>
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">{formatDate(m.plannedEndDate)}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Flag className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <div className="text-sm text-muted-foreground">{t('projectWorkspace.monitoring.noMilestonesDefined')}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Task Aging
                  {taskAging.length > 0 && (
                    <Badge className="bg-muted/60 text-muted-foreground">{taskAging.length} active</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {taskAging.length > 0 ? (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-1.5">
                      {taskAging.slice(0, 15).map(t => {
                        const ageSeverity = t.ageDays > 30 ? 'critical' : t.ageDays > 14 ? 'warning' : 'normal';
                        return (
                          <div key={t.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                            <div className={`w-1.5 h-6 rounded-full shrink-0 ${ageSeverity === 'critical' ? 'bg-red-500' : ageSeverity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{t.taskName || t.title}</div>
                              <div className="text-xs text-muted-foreground">{t.taskCode || t.wbsCode}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`text-sm font-bold ${ageSeverity === 'critical' ? 'text-red-600 dark:text-red-400' : ageSeverity === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {t.ageDays}d
                              </div>
                            </div>
                            <Progress value={t.percentComplete ?? t.progress ?? 0} className="w-12 h-1.5" />
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-6">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
                    <div className="text-sm text-muted-foreground">{t('projectWorkspace.monitoring.noTasksInProgress')}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeSection === 'risks' && (
        <RisksTab
          risks={risks}
          onAddRisk={onAddRisk}
          searchTerm={riskSearchTerm}
          setSearchTerm={setRiskSearchTerm}
          filterStatus={riskFilterStatus}
          setFilterStatus={setRiskFilterStatus}
          projectId={project.id}
        />
      )}

      {activeSection === 'compliance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Gate Compliance Scorecard
                </CardTitle>
              </CardHeader>
              <CardContent>
                {gates.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20">
                        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                          <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/40" />
                          <path
                            d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeDasharray={`${gateCompliance.complianceRate}, 100`}
                            className={gateCompliance.complianceRate >= 80 ? 'text-emerald-500' : gateCompliance.complianceRate >= 50 ? 'text-amber-500' : 'text-red-500'}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold">{gateCompliance.complianceRate}%</span>
                        </div>
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>{gateCompliance.approved.length} Approved</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span>{gateCompliance.pending.length} Pending Review</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <XCircle className="w-3 h-3 text-red-500" />
                          <span>{gateCompliance.rejected.length} Rejected</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CircleDot className="w-3 h-3 text-muted-foreground" />
                          <span>{gateCompliance.notStarted.length} Not Started</span>
                        </div>
                      </div>
                    </div>

                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {gates.sort((a, b) => a.gateOrder - b.gateOrder).map(g => {
                          const statusIcon = g.status === 'approved' ? CheckCircle2 : g.status === 'rejected' ? XCircle : g.status === 'pending' || g.status === 'in_review' || g.status === 'submitted' ? Clock : CircleDot;
                          const StatusIcon = statusIcon;
                          const statusColor = g.status === 'approved' ? 'text-emerald-500' : g.status === 'rejected' ? 'text-red-500' : g.status === 'pending' || g.status === 'in_review' || g.status === 'submitted' ? 'text-amber-500' : 'text-muted-foreground';
                          return (
                            <div key={g.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                              <StatusIcon className={`w-4 h-4 ${statusColor} shrink-0`} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{g.gateName}</div>
                                <div className="text-xs text-muted-foreground">{g.gateType} | Order {g.gateOrder}</div>
                              </div>
                              <Badge className={g.status === 'approved' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : g.status === 'rejected' ? 'bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-muted/60 text-muted-foreground'}>
                                {g.status?.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Shield className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <div className="text-sm text-muted-foreground">{t('projectWorkspace.monitoring.noGovernanceGates')}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCheck className="w-4 h-4" />
                  Deliverable Acceptance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted/40 rounded-lg text-center">
                      <div className="text-2xl font-bold">{deliverableStatus.total}</div>
                      <div className="text-xs text-muted-foreground">Total Deliverables</div>
                    </div>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
                      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{deliverableStatus.accepted}</div>
                      <div className="text-xs text-muted-foreground">Accepted</div>
                    </div>
                  </div>
                  {deliverableStatus.total > 0 && (
                    <>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Acceptance Rate</span>
                          <span className="font-medium">{deliverableStatus.total > 0 ? Math.round((deliverableStatus.accepted / deliverableStatus.total) * 100) : 0}%</span>
                        </div>
                        <Progress value={deliverableStatus.total > 0 ? (deliverableStatus.accepted / deliverableStatus.total) * 100 : 0} className="h-2" />
                      </div>
                    </>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted/40 rounded-lg text-center">
                      <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{deliverableStatus.pending}</div>
                      <div className="text-xs text-muted-foreground">Pending</div>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-lg text-center">
                      <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{deliverableStatus.withEvidence}</div>
                      <div className="text-xs text-muted-foreground">With Evidence</div>
                    </div>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Documents</div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{documents.length} project documents</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" />
                Approval Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              {approvals.length > 0 ? (
                <ScrollArea className="h-[280px]">
                  <div className="space-y-2">
                    {approvals.map(a => {
                      const isPending = a.status === 'pending';
                      const isApproved = a.status === 'approved';
                      return (
                        <div key={a.id} className={`flex items-center gap-3 p-3 rounded-lg ${isPending ? 'bg-amber-500/10 border border-amber-500/20' : isApproved ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-muted/30'}`}>
                          {isApproved ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : isPending ? <Clock className="w-4 h-4 text-amber-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{a.approvalType?.replace(/_/g, ' ')}</div>
                            <div className="text-xs text-muted-foreground">
                              {a.requestedBy && `Requested by ${a.requestedBy}`}
                              {a.requestedDate && ` on ${formatDate(a.requestedDate)}`}
                            </div>
                            {a.approvedBy && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Approved by {a.approvedBy} on {formatDate(a.approvedDate)}
                              </div>
                            )}
                            {a.comments && (
                              <div className="text-xs text-muted-foreground mt-1 italic">"{a.comments}"</div>
                            )}
                          </div>
                          <Badge className={isApproved ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : isPending ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'}>
                            {a.status}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <ClipboardCheck className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <div className="text-sm text-muted-foreground">{t('projectWorkspace.monitoring.noApprovalRecords')}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'executive' && (
        <div className="space-y-6">
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Project Status at a Glance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <TrafficLight label="Scope" status={scopeStatus} />
                <TrafficLight label="Schedule" status={scheduleStatus} />
                <TrafficLight label="Budget" status={budgetStatus} />
                <TrafficLight label="Quality" status={qualityStatus} />
                <TrafficLight label="Risk" status={riskStatus} />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-card/60 border-border lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                    <div className="text-sm leading-relaxed">
                      <strong>{project.projectName}</strong> is currently in the <Badge className={healthColors[project.healthStatus] || 'bg-muted/60'}>{project.healthStatus?.replace(/_/g, ' ') || 'Unknown'}</Badge> state.
                      {tasks.length > 0 && (
                        <> The project has completed <strong>{taskProgress}%</strong> of planned work ({summary?.completedTasks || tasks.filter(t => t.status === 'completed').length} of {tasks.length} tasks).</>
                      )}
                    </div>
                    {evmMetrics.hasCostData && evmMetrics.SPI !== null && (
                      <div className="text-sm leading-relaxed">
                        Schedule Performance Index is at <strong>{evmMetrics.SPI.toFixed(2)}</strong> {evmMetrics.SPI >= 1 ? '(ahead of schedule)' : evmMetrics.SPI >= 0.9 ? '(slightly behind)' : '(significantly behind schedule)'}.
                        {evmMetrics.CPI !== null && (
                          <> Cost Performance Index is at <strong>{evmMetrics.CPI.toFixed(2)}</strong> {evmMetrics.CPI >= 1 ? '(under budget)' : evmMetrics.CPI >= 0.9 ? '(slight overrun)' : '(significant cost overrun)'}.</>
                        )}
                      </div>
                    )}
                    {criticalRisks.filter(r => r.status !== 'closed').length > 0 && (
                      <div className="text-sm leading-relaxed text-amber-600 dark:text-amber-400">
                        There {criticalRisks.filter(r => r.status !== 'closed').length === 1 ? 'is' : 'are'} <strong>{criticalRisks.filter(r => r.status !== 'closed').length}</strong> critical/high risk{criticalRisks.filter(r => r.status !== 'closed').length > 1 ? 's' : ''} requiring management attention.
                      </div>
                    )}
                    {milestones.overdue.length > 0 && (
                      <div className="text-sm leading-relaxed text-red-600 dark:text-red-400">
                        <strong>{milestones.overdue.length}</strong> milestone{milestones.overdue.length > 1 ? 's are' : ' is'} overdue and requires escalation.
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-muted/40 rounded-lg text-center">
                      <div className="text-xs text-muted-foreground">Stakeholders</div>
                      <div className="text-lg font-bold">{stakeholders.length}</div>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-lg text-center">
                      <div className="text-xs text-muted-foreground">Documents</div>
                      <div className="text-lg font-bold">{documents.length}</div>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-lg text-center">
                      <div className="text-xs text-muted-foreground">Gates Passed</div>
                      <div className="text-lg font-bold">{gateCompliance.approved.length}/{gates.length}</div>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-lg text-center">
                      <div className="text-xs text-muted-foreground">Pending Approvals</div>
                      <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{approvals.filter(a => a.status === 'pending').length}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Key Dates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-muted/40 rounded-lg">
                    <div className="text-xs text-muted-foreground">Planned Start</div>
                    <div className="text-sm font-medium">{formatDate(project.plannedStartDate || project.startDate)}</div>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-lg">
                    <div className="text-xs text-muted-foreground">Planned End</div>
                    <div className="text-sm font-medium">{formatDate(project.plannedEndDate || project.endDate)}</div>
                  </div>
                  {criticalPathAnalysis && (
                    <div className="p-3 bg-muted/40 rounded-lg">
                      <div className="text-xs text-muted-foreground">Critical Path Duration</div>
                      <div className="text-sm font-medium">{criticalPathAnalysis.projectDuration} days</div>
                    </div>
                  )}
                  {evmMetrics.BAC > 0 && (
                    <div className="p-3 bg-muted/40 rounded-lg">
                      <div className="text-xs text-muted-foreground">Budget</div>
                      <div className="text-sm font-medium">{formatCurrency(evmMetrics.BAC)}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Action Items Requiring Attention
                {actionItems.length > 0 && (
                  <Badge className="bg-red-500/20 text-red-600 dark:text-red-400">{actionItems.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {actionItems.length > 0 ? (
                <ScrollArea className="h-[280px]">
                  <div className="space-y-2">
                    {actionItems.map((item, idx) => {
                      const severityColor = item.severity === 'critical' ? 'border-red-500/30 bg-red-500/10' : item.severity === 'high' ? 'border-amber-500/30 bg-amber-500/10' : 'border-border bg-muted/30';
                      const iconColor = item.severity === 'critical' ? 'text-red-600 dark:text-red-400' : item.severity === 'high' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground';
                      const TypeIcon = item.type === 'risk' ? AlertTriangle : item.type === 'milestone' ? Flag : item.type === 'approval' ? ClipboardCheck : item.type === 'issue' ? XCircle : Target;
                      return (
                        <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border ${severityColor}`}>
                          <TypeIcon className={`w-4 h-4 ${iconColor} shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{item.label}</div>
                            <div className="text-xs text-muted-foreground">{item.detail}</div>
                          </div>
                          <Badge className={item.severity === 'critical' ? 'bg-red-500/20 text-red-600 dark:text-red-400' : item.severity === 'high' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-muted/60 text-muted-foreground'}>
                            {item.severity}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
                  <div className="text-sm text-muted-foreground">{t('projectWorkspace.monitoring.noActionItems')}</div>
                  <div className="text-xs text-muted-foreground mt-1">All indicators are within acceptable thresholds</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'governance' && (
        <PhaseGateWorkflow
          projectId={project.id}
          currentPhase="monitoring"
          onPhaseChange={(phase: string) => console.log('Phase changed to:', phase)}
        />
      )}
    </div>
  );
}
