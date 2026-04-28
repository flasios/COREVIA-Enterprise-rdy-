import type { IssueData, RiskData, WbsTaskData } from '../../../types';
import { hasTaskRefMatch, taskLinkRefs } from './model';

function readLinkedRefs(record: Record<string, unknown>, camelKey: string, snakeKey: string) {
  const raw = record[camelKey] ?? record[snakeKey];
  if (!Array.isArray(raw)) return [] as string[];
  return raw
    .map((ref) => (typeof ref === 'string' ? ref.trim().toLowerCase() : ''))
    .filter((ref) => ref.length > 0);
}

export function findLinkedRisksForTask(
  taskId: string,
  tasks: WbsTaskData[],
  risks: RiskData[],
) {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) return [];

  const taskRecord = task as unknown as Record<string, unknown>;
  const taskLinkedRiskRefs = readLinkedRefs(taskRecord, 'linkedRisks', 'linked_risks');
  const taskName = (task.taskName || task.title || '').toLowerCase();
  const refs = taskLinkRefs(task);

  return risks.filter((risk) => {
    const riskId = (risk.id || '').toLowerCase();
    const riskCode = (risk.riskCode || '').toLowerCase();
    const taskDeclaredLink = taskLinkedRiskRefs.some((ref) =>
      ref === riskId || ref === riskCode || ref.includes(riskId) || ref.includes(riskCode) || riskId.includes(ref) || riskCode.includes(ref),
    );
    if (taskDeclaredLink) return true;

    const riskRecord = risk as unknown as Record<string, unknown>;
    const linkedRefs = readLinkedRefs(riskRecord, 'linkedTasks', 'linked_tasks');
    const explicitLink = linkedRefs.some((ref) => hasTaskRefMatch(task, ref));
    const fuzzyLinkedRef = linkedRefs.some((ref) => refs.some((taskRef) => ref.includes(taskRef) || taskRef.includes(ref)));
    if (explicitLink || fuzzyLinkedRef) return true;

    const riskTitle = (risk.title || '').toLowerCase();
    const riskDesc = (risk.description || '').toLowerCase();
    const taskCode = (task.wbsCode || '').toLowerCase();
    return (taskName.length > 3 && (riskTitle.includes(taskName) || riskDesc.includes(taskName))) ||
      (taskCode && (riskTitle.includes(taskCode) || riskDesc.includes(taskCode)));
  });
}

export function findLinkedIssuesForTask(
  taskId: string,
  tasks: WbsTaskData[],
  issues: IssueData[],
  risks: RiskData[],
) {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) return [];

  const taskRecord = task as unknown as Record<string, unknown>;
  const taskLinkedIssueRefs = readLinkedRefs(taskRecord, 'linkedIssues', 'linked_issues');
  const linkedRiskIds = new Set(findLinkedRisksForTask(taskId, tasks, risks).map((risk) => risk.id));
  const taskName = (task.taskName || task.title || '').toLowerCase();
  const taskCode = (task.wbsCode || '').toLowerCase();

  return issues.filter((issue) => {
    const issueId = (issue.id || '').toLowerCase();
    const issueCode = (issue.issueCode || '').toLowerCase();
    const taskDeclaredLink = taskLinkedIssueRefs.some((ref) =>
      ref === issueId || ref === issueCode || ref.includes(issueId) || ref.includes(issueCode) || issueId.includes(ref) || issueCode.includes(ref),
    );
    if (taskDeclaredLink) return true;

    const issueRecord = issue as unknown as Record<string, unknown>;
    const issueLinkedRefs = readLinkedRefs(issueRecord, 'linkedTasks', 'linked_tasks');
    const explicitTaskLink = issueLinkedRefs.some((ref) => hasTaskRefMatch(task, ref));
    if (explicitTaskLink) return true;

    const linkedRiskId = issueRecord.linkedRiskId ?? issueRecord.linked_risk_id;
    if (typeof linkedRiskId === 'string' && linkedRiskIds.has(linkedRiskId)) return true;

    const issueTitle = (issue.title || '').toLowerCase();
    const issueDesc = (issue.description || '').toLowerCase();
    return (taskName.length > 3 && (issueTitle.includes(taskName) || issueDesc.includes(taskName))) ||
      (taskCode && (issueTitle.includes(taskCode) || issueDesc.includes(taskCode)));
  });
}
