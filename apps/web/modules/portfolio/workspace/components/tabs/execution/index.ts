/**
 * Execution Phase — Extracted sub-components barrel export.
 *
 * These components were extracted from the monolithic ExecutionPhaseTab.tsx
 * to enable independent testing, lazy-loading, and codebase navigability.
 *
 * Import pattern:
 *   import { TaskAdvisorSimple } from './execution';
 *   import { MultiTaskSelector } from './execution';
 */

export { MultiTaskSelector } from './MultiTaskSelector';
export { RiskEvidenceSection, TaskAdvisorSimple, TaskUpdateForm, type TaskProgressUpdate } from './TaskExecutionPanels';
export type { ChangeRequest, ChangeRequestValue } from './model';
export { getEffectiveTaskStatus, hasTaskRefMatch, isDescendantOf, normalizeChangeValue, taskLinkRefs } from './model';
