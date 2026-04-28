/**
 * Planning Phase — Extracted sub-components barrel export.
 *
 * These components were extracted from the monolithic PlanningPhaseTab.tsx
 * to enable independent testing, lazy-loading, and codebase navigability.
 */

export { GanttChartView } from './GanttChartView';
export { DependenciesView } from './DependenciesView';
export { TaskEditForm, type WbsTaskUpdates } from './TaskEditForm';
export { ResourceAlignmentView } from './ResourceAlignmentView';
export { ResourceAssignmentDialog } from './ResourceAssignmentDialog';
export { PlanningArtifactDialogs, type PlanningArtifactDraft } from './PlanningArtifactDialogs';
export { PlanningApprovalDialogs } from './PlanningApprovalDialogs';
export type { ResourceAlignmentData, ResourcesData, ResourcePersonItem } from './types';
