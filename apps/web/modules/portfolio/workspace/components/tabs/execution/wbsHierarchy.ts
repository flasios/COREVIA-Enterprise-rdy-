import type { WbsTaskData } from '../../../types';

export type WbsDeliverableNode = WbsTaskData & {
  childTasks: WbsTaskData[];
  allChildTasks: WbsTaskData[];
  completedCount: number;
  inProgressCount: number;
  blockedCount: number;
};

export type WbsPhaseNode = {
  phase: WbsTaskData;
  deliverables: WbsDeliverableNode[];
  allDeliverables: WbsDeliverableNode[];
  workPackageCount: number;
  milestoneCount: number;
  totalTasks: number;
  totalTrackableCount: number;
  completedCount: number;
  inProgressCount: number;
  blockedCount: number;
  averageProgress: number;
};

function sortByWbsOrder(tasks: WbsTaskData[]) {
  return [...tasks].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
}

function isTopLevelTask(task: WbsTaskData) {
  return (task.wbsLevel ?? 0) === 1 || task.taskType === 'phase' || (task.taskCode || '').endsWith('.0');
}

function isBlockedTask(task: WbsTaskData) {
  return task.status === 'blocked' || task.status === 'on_hold';
}

export function buildWbsHierarchy(
  normalizedTasks: WbsTaskData[],
  filteredTasks: WbsTaskData[],
): WbsPhaseNode[] {
  const l1Tasks = sortByWbsOrder(normalizedTasks.filter(isTopLevelTask));
  const childrenOf = new Map<string, WbsTaskData[]>();

  normalizedTasks.forEach((task) => {
    if (!task.parentTaskId) return;
    if (!childrenOf.has(task.parentTaskId)) childrenOf.set(task.parentTaskId, []);
    childrenOf.get(task.parentTaskId)!.push(task);
  });

  childrenOf.forEach((children, parentId) => {
    childrenOf.set(parentId, sortByWbsOrder(children));
  });

  const filteredIds = new Set(filteredTasks.map((task) => task.id));

  return l1Tasks.map((phase) => {
    const deliverables = (childrenOf.get(phase.id) || []).map<WbsDeliverableNode>((deliverable) => {
      const childTasks = childrenOf.get(deliverable.id) || [];

      return {
        ...deliverable,
        childTasks: childTasks.filter((task) => filteredIds.has(task.id)),
        allChildTasks: childTasks,
        completedCount: childTasks.filter((task) => task.status === 'completed').length,
        inProgressCount: childTasks.filter((task) => task.status === 'in_progress').length,
        blockedCount: childTasks.filter(isBlockedTask).length,
      };
    });

    const visibleDeliverables = deliverables.filter((deliverable) => deliverable.childTasks.length > 0 || filteredIds.has(deliverable.id));
    const allDescendants = deliverables.flatMap((deliverable) => deliverable.allChildTasks);
    const milestoneCount = deliverables.filter((deliverable) => deliverable.taskType === 'milestone').length;
    const completedMilestoneCount = deliverables.filter((deliverable) => deliverable.taskType === 'milestone' && deliverable.status === 'completed').length;
    const inProgressMilestoneCount = deliverables.filter((deliverable) => deliverable.taskType === 'milestone' && deliverable.status === 'in_progress').length;
    const blockedMilestoneCount = deliverables.filter((deliverable) => deliverable.taskType === 'milestone' && isBlockedTask(deliverable)).length;

    return {
      phase,
      deliverables: visibleDeliverables,
      allDeliverables: deliverables,
      workPackageCount: deliverables.filter((deliverable) => deliverable.taskType !== 'milestone').length,
      milestoneCount,
      totalTasks: allDescendants.length,
      totalTrackableCount: allDescendants.length + milestoneCount,
      completedCount: allDescendants.filter((task) => task.status === 'completed').length + completedMilestoneCount,
      inProgressCount: allDescendants.filter((task) => task.status === 'in_progress').length + inProgressMilestoneCount,
      blockedCount: allDescendants.filter(isBlockedTask).length + blockedMilestoneCount,
      averageProgress: allDescendants.length > 0
        ? Math.round(allDescendants.reduce((sum, task) => sum + (task.percentComplete ?? task.progress ?? 0), 0) / allDescendants.length)
        : 0,
    };
  }).filter((phase) => phase.deliverables.length > 0 || filteredIds.has(phase.phase.id));
}
