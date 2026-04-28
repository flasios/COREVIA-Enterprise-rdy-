import type { CommunicationData, IssueData, RiskData, StakeholderData, WbsTaskData } from '../../../types';
import type { ChangeRequest } from './model';

export type CommandActionIconKey = 'delivery' | 'risk' | 'signal' | 'decision';
export type ExecutionEventIconKey = 'taskCompleted' | 'taskActive' | 'communication' | 'issue' | 'change';

export function buildStakeholderSignals(
  stakeholders: StakeholderData[],
  communications: CommunicationData[],
) {
  const cadenceMap: Record<string, number> = {
    daily: 2,
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    as_needed: 45,
    asneeded: 45,
  };

  return stakeholders.map((stakeholder) => {
    const relatedComms = communications.filter((communication) =>
      communication.author === stakeholder.name ||
      communication.recipients?.includes(stakeholder.name) ||
      (stakeholder.email ? communication.recipients?.includes(stakeholder.email) : false),
    );

    const lastTouch = relatedComms
      .map((communication) => communication.createdAt)
      .filter((createdAt): createdAt is string => Boolean(createdAt))
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];

    const cadenceDays = cadenceMap[(stakeholder.communicationFrequency || '').toLowerCase()] || 10;
    const daysSinceTouch = lastTouch
      ? Math.max(0, Math.floor((Date.now() - new Date(lastTouch).getTime()) / (1000 * 60 * 60 * 24)))
      : 999;
    const score = Math.max(10, 100 - Math.round((daysSinceTouch / cadenceDays) * 40));

    return {
      ...stakeholder,
      cadenceDays,
      daysSinceTouch,
      score,
      lastTouch,
    };
  }).sort((left, right) => left.score - right.score);
}

export function getOpenIssues(issues: IssueData[]) {
  return issues.filter((issue) => !['resolved', 'closed'].includes((issue.status || '').toLowerCase()));
}

export function getCriticalIssues(openIssues: IssueData[]) {
  return openIssues.filter((issue) => ['critical', 'high'].includes((issue.priority || issue.severity || '').toLowerCase()));
}

export function getLiveRisks(risks: RiskData[]) {
  return risks.filter((risk) => !['closed', 'mitigated', 'accepted'].includes((risk.status || '').toLowerCase()));
}

export function getHighRisks(liveRisks: RiskData[]) {
  return liveRisks.filter((risk) => ['critical', 'high'].includes((risk.riskLevel || '').toLowerCase()) || risk.riskScore >= 15);
}

export function getOverdueTasks(tasks: WbsTaskData[]) {
  const now = Date.now();
  return tasks.filter((task) => {
    if (!task.plannedEndDate) return false;
    if ((task.status || '').toLowerCase() === 'completed') return false;
    const plannedEnd = new Date(task.plannedEndDate).getTime();
    return !Number.isNaN(plannedEnd) && plannedEnd < now;
  });
}

export function getPendingChanges(changeRequests: ChangeRequest[]) {
  return changeRequests.filter((change) => ['submitted', 'under_review', 'approved'].includes(change.status));
}

export function calculateSignalCoverage(stakeholderSignals: Array<{ daysSinceTouch: number; cadenceDays: number }>) {
  if (stakeholderSignals.length === 0) return 100;
  const coveredCount = stakeholderSignals.length - stakeholderSignals.filter((stakeholder) => stakeholder.daysSinceTouch > stakeholder.cadenceDays).length;
  return Math.round((coveredCount / stakeholderSignals.length) * 100);
}

export function buildCommandDeckTone(input: {
  blockedTaskCount: number;
  criticalIssueCount: number;
  highRiskCount: number;
  overallProgress: number;
  overdueTaskCount: number;
  signalCoverage: number;
}) {
  if (input.criticalIssueCount > 0 || input.blockedTaskCount > 2 || input.highRiskCount > 2) {
    return {
      label: 'Intervention Mode',
      summary: 'Execution pressure is concentrated around blockers, unresolved issues, and high exposure items.',
      shell: 'from-[#f8fbfd] via-[#f4f7fb] to-[#eef4f8]',
      border: 'border-amber-200',
      accent: 'text-slate-600',
    };
  }

  if (input.overallProgress < 65 || input.overdueTaskCount > 0 || input.signalCoverage < 70) {
    return {
      label: 'Stabilize The Flow',
      summary: 'Delivery is moving, but the system still needs tighter cadence, cleaner handoffs, and faster intervention.',
      shell: 'from-[#f8fbfd] via-[#f3f8fb] to-[#edf6f7]',
      border: 'border-sky-200',
      accent: 'text-slate-600',
    };
  }

  return {
    label: 'Drive Forward',
    summary: 'The gate is open and execution is healthy enough to focus on throughput, confidence, and momentum.',
    shell: 'from-[#fbfcfe] via-[#f3f8fb] to-[#edf7f4]',
    border: 'border-emerald-200',
    accent: 'text-slate-600',
  };
}

export function buildOperatingVectorData(input: {
  blockedTaskCount: number;
  openIssueCount: number;
  overdueTaskCount: number;
  overallProgress: number;
  signalCoverage: number;
  highRiskCount: number;
}) {
  const flowPressure = input.blockedTaskCount + input.openIssueCount + input.overdueTaskCount;
  return [
    { name: 'Delivery', score: input.overallProgress, fill: '#7dd3fc' },
    { name: 'Signal', score: input.signalCoverage, fill: '#2dd4bf' },
    { name: 'Flow', score: Math.max(8, 100 - flowPressure * 12), fill: '#f59e0b' },
    { name: 'Risk', score: Math.max(8, 100 - input.highRiskCount * 7), fill: '#a78bfa' },
  ];
}

export function buildExecutionDistributionData(input: {
  completedTaskCount: number;
  activeTaskCount: number;
  notStartedTaskCount: number;
  blockedTaskCount: number;
}) {
  return [
    { name: 'Completed', value: input.completedTaskCount, color: '#14b8a6' },
    { name: 'In Progress', value: input.activeTaskCount, color: '#38bdf8' },
    { name: 'Queued', value: input.notStartedTaskCount, color: '#94a3b8' },
    { name: 'Blocked', value: input.blockedTaskCount, color: '#f59e0b' },
  ].filter((segment) => segment.value > 0);
}

export function buildCommandDeckActions(input: {
  blockedTaskCount: number;
  overdueTaskCount: number;
  highRiskCount: number;
  stakeholderSignalCount: number;
  staleStakeholderCount: number;
  signalCoverage: number;
  pendingChangeCount: number;
  criticalIssueCount: number;
}) {
  return [
    {
      title: 'Delivery drag',
      value: `${input.blockedTaskCount + input.overdueTaskCount}`,
      tone: input.blockedTaskCount + input.overdueTaskCount > 0 ? 'text-amber-900 border-amber-200 bg-amber-50/80' : 'text-emerald-900 border-emerald-200 bg-emerald-50/80',
      detail: input.blockedTaskCount > 0
        ? `${input.blockedTaskCount} blocked tasks need immediate owner action`
        : input.overdueTaskCount > 0
          ? `${input.overdueTaskCount} overdue tasks are slipping past plan`
          : 'No blocked or overdue tasks are currently detected',
      cta: 'Open work management',
      target: 'work-management',
      iconKey: 'delivery' as const,
    },
    {
      title: 'Risk pressure',
      value: `${input.highRiskCount}`,
      tone: input.highRiskCount > 0 ? 'text-rose-900 border-rose-200 bg-rose-50/80' : 'text-emerald-900 border-emerald-200 bg-emerald-50/80',
      detail: input.highRiskCount > 0
        ? `${input.highRiskCount} execution risks remain above the acceptable band`
        : 'Risk posture is currently inside a manageable band',
      cta: 'Open risk cockpit',
      target: 'risk-heatmap',
      iconKey: 'risk' as const,
    },
    {
      title: 'Signal gaps',
      value: `${input.staleStakeholderCount}`,
      tone: input.signalCoverage < 70 ? 'text-amber-900 border-amber-200 bg-amber-50/80' : 'text-sky-900 border-sky-200 bg-sky-50/80',
      detail: input.stakeholderSignalCount > 0
        ? `${input.signalCoverage}% of stakeholders are still inside their expected communication cadence`
        : 'No stakeholder communication plan is configured yet',
      cta: 'Open communications',
      target: 'communications',
      iconKey: 'signal' as const,
    },
    {
      title: 'Decision load',
      value: `${input.pendingChangeCount + input.criticalIssueCount}`,
      tone: input.pendingChangeCount + input.criticalIssueCount > 0 ? 'text-blue-900 border-blue-200 bg-blue-50/80' : 'text-emerald-900 border-emerald-200 bg-emerald-50/80',
      detail: input.pendingChangeCount > 0
        ? `${input.pendingChangeCount} change requests are still waiting in the control lane`
        : input.criticalIssueCount > 0
          ? `${input.criticalIssueCount} critical issues require a decisive next move`
          : 'No pending change-control or critical issue escalation is waiting',
      cta: 'Review interventions',
      target: 'issues',
      iconKey: 'decision' as const,
    },
  ];
}

export function buildExecutionEvents(input: {
  tasks: WbsTaskData[];
  communications: CommunicationData[];
  issues: IssueData[];
  changeRequests: ChangeRequest[];
}) {
  const taskEvents = input.tasks
    .filter((task) => task.actualEndDate || task.actualStartDate)
    .map((task) => ({
      id: `task-${task.id}`,
      label: task.taskName || task.title || task.taskCode || 'Task update',
      detail: `${(task.status || 'unknown').replace(/_/g, ' ')}${task.assignedTo ? ` - ${task.assignedTo}` : ''}`,
      timestamp: task.actualEndDate || task.actualStartDate || '',
      iconKey: task.status === 'completed' ? 'taskCompleted' as const : 'taskActive' as const,
      tone: task.status === 'completed' ? 'text-emerald-400' : 'text-blue-400',
    }));

  const communicationEvents = input.communications
    .filter((communication) => communication.createdAt)
    .map((communication) => ({
      id: `comm-${communication.id}`,
      label: communication.title,
      detail: `${communication.status} - ${communication.communicationType.replace(/_/g, ' ')}`,
      timestamp: communication.createdAt || '',
      iconKey: 'communication' as const,
      tone: communication.status === 'published' ? 'text-cyan-400' : 'text-amber-400',
    }));

  const issueEvents = input.issues
    .filter((issue) => issue.reportedDate)
    .map((issue) => ({
      id: `issue-${issue.id}`,
      label: issue.title,
      detail: `${issue.status} - ${issue.priority || issue.severity}`,
      timestamp: issue.reportedDate || '',
      iconKey: 'issue' as const,
      tone: ['critical', 'high'].includes((issue.priority || issue.severity || '').toLowerCase()) ? 'text-rose-400' : 'text-orange-400',
    }));

  const changeEvents = input.changeRequests.map((change) => ({
    id: `change-${change.id}`,
    label: change.title,
    detail: `${change.status.replace(/_/g, ' ')} - ${change.changeType}`,
    timestamp: change.requestedAt?.toISOString() || '',
    iconKey: 'change' as const,
    tone: 'text-blue-300',
  }));

  return [...taskEvents, ...communicationEvents, ...issueEvents, ...changeEvents]
    .filter((event) => event.timestamp)
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 7);
}
