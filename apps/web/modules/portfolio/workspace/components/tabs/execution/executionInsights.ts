import type { AIInsight } from '../ExecutionPhaseTab.types';

type ExecutionInsightInput = {
  blockedTaskCount: number;
  overdueTaskCount: number;
  atRiskTaskCount: number;
  criticalRiskCount: number;
  taskVelocity: number;
  overallProgress: number;
  resourceUtilization: Array<{ inProgress: number }>;
};

export function buildExecutionInsights({
  blockedTaskCount,
  overdueTaskCount,
  atRiskTaskCount,
  criticalRiskCount,
  taskVelocity,
  overallProgress,
  resourceUtilization,
}: ExecutionInsightInput): AIInsight[] {
  const insights: AIInsight[] = [];

  if (blockedTaskCount > 0) {
    insights.push({
      type: 'warning',
      title: `${blockedTaskCount} Blocked Tasks Detected`,
      description: `There are ${blockedTaskCount} tasks currently blocked. Consider reviewing blockers and escalating if needed.`,
      priority: 'high',
      action: 'Review blocked tasks',
    });
  }

  if (overdueTaskCount > 0) {
    insights.push({
      type: 'warning',
      title: `${overdueTaskCount} Overdue Tasks`,
      description: `${overdueTaskCount} tasks have passed their planned end date. Immediate attention required.`,
      priority: 'high',
      action: 'Review overdue tasks',
    });
  }

  if (atRiskTaskCount > 0) {
    insights.push({
      type: 'prediction',
      title: `${atRiskTaskCount} Tasks At Risk`,
      description: `${atRiskTaskCount} tasks are due within the next 3 days. Ensure resources are allocated.`,
      confidence: 85,
      priority: 'medium',
      action: 'Prioritize at-risk tasks',
    });
  }

  if (criticalRiskCount > 0) {
    insights.push({
      type: 'warning',
      title: `${criticalRiskCount} Critical/High Risks Active`,
      description: 'Active high-severity risks may impact execution. Review mitigation plans.',
      priority: 'high',
      action: 'Review risk matrix',
    });
  }

  if (taskVelocity > 3) {
    insights.push({
      type: 'achievement',
      title: 'Strong Task Velocity',
      description: `${taskVelocity} tasks completed in the last 7 days. Team is performing well.`,
      priority: 'low',
    });
  }

  if (overallProgress > 75 && blockedTaskCount === 0) {
    insights.push({
      type: 'suggestion',
      title: 'Project on Track for Completion',
      description: `With ${overallProgress}% progress and no blockers, consider accelerating remaining tasks.`,
      priority: 'low',
      action: 'Review acceleration options',
    });
  }

  const highWorkloadResourceCount = resourceUtilization.filter((resource) => resource.inProgress > 3).length;
  if (highWorkloadResourceCount > 0) {
    insights.push({
      type: 'suggestion',
      title: 'Resource Rebalancing Recommended',
      description: `${highWorkloadResourceCount} team member(s) have high workload. Consider redistributing tasks.`,
      priority: 'medium',
      action: 'Review resource allocation',
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: 'achievement',
      title: 'Execution Running Smoothly',
      description: 'No critical issues detected. Continue monitoring progress.',
      priority: 'low',
    });
  }

  return insights;
}
