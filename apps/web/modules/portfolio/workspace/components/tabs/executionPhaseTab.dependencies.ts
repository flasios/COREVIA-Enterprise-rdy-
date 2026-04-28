import type { WbsTaskData } from '../../types';

export interface ChangeRequest {
  id: string;
  code: string;
  title: string;
  description: string;
  changeType: 'timeline' | 'scope' | 'budget' | 'resource' | 'deliverable' | 'milestone' | 'priority' | 'technical' | 'other';
  impact: 'critical' | 'high' | 'medium' | 'low';
  urgency: 'critical' | 'high' | 'normal' | 'low';
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'deferred' | 'implemented';
  justification: string;
  originalValue?: { endDate?: string; startDate?: string; budget?: number; scope?: string };
  proposedValue?: { endDate?: string; startDate?: string; budget?: number; scope?: string };
  affectedTasks?: string[];
  estimatedScheduleImpact?: number;
  estimatedCostImpact?: number;
  requestedBy: string;
  requestedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  implementedBy?: string;
  implementedAt?: Date;
  implementationNotes?: string;
}

/**
 * Summary or phase tasks may list descendants as predecessors for rollup.
 * Those links are not real dependency edges for impact propagation.
 */
export function isDescendantOf(
  predId: string,
  ancestorId: string,
  taskMap: Map<string, WbsTaskData>
): boolean {
  let currentId = predId;
  while (currentId) {
    const task = taskMap.get(currentId);
    if (!task?.parentTaskId) return false;
    if (task.parentTaskId === ancestorId) return true;
    currentId = task.parentTaskId;
  }
  return false;
}