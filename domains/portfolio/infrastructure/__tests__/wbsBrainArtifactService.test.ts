import { describe, expect, it } from 'vitest';

import { normalizeBrainWbsArtifactToGeneratedTasks } from '../wbsBrainArtifactService';

describe('normalizeBrainWbsArtifactToGeneratedTasks', () => {
  it('anchors milestones to the owning phase and linked delivery tasks', () => {
    const result = normalizeBrainWbsArtifactToGeneratedTasks({
      startDate: '2026-04-01',
      artifactContent: {
        phases: [
          {
            id: 'phase-1',
            name: 'Mobilize & Define',
            duration: '10 days',
            workPackages: [
              {
                id: 'wp-1',
                name: 'Scope baseline package',
                estimatedEffort: '5 days',
                deliverables: ['Scope baseline'],
              },
            ],
          },
          {
            id: 'phase-2',
            name: 'Build & Validate',
            duration: '15 days',
            workPackages: [
              {
                id: 'wp-2',
                name: 'Validation package',
                estimatedEffort: '6 days',
                deliverables: ['UAT sign-off'],
              },
            ],
          },
        ],
        milestones: [
          {
            name: 'Scope Baseline Approved',
            phase: 'Mobilize & Define',
            deliverables: ['Scope baseline'],
          },
          {
            name: 'UAT Approved',
            phase: 'Build & Validate',
            deliverables: ['UAT sign-off'],
          },
        ],
      },
    });

    const scopeMilestone = result.tasks.find((task) => task.title === 'Scope Baseline Approved');
    const uatMilestone = result.tasks.find((task) => task.title === 'UAT Approved');

    expect(scopeMilestone).toBeDefined();
    expect(scopeMilestone?.taskType).toBe('milestone');
    expect(scopeMilestone?.parentTaskCode).toBe('1.0');
    expect(scopeMilestone?.wbsLevel).toBe(2);
    expect(scopeMilestone?.dependencies).toContain('1.1.1');
    expect(scopeMilestone?.deliverables).toEqual(['Scope baseline']);

    expect(uatMilestone).toBeDefined();
    expect(uatMilestone?.taskType).toBe('milestone');
    expect(uatMilestone?.parentTaskCode).toBe('2.0');
    expect(uatMilestone?.wbsLevel).toBe(2);
    expect(uatMilestone?.dependencies).toContain('2.1.1');
    expect(uatMilestone?.deliverables).toEqual(['UAT sign-off']);
  });

  it('infers milestone ownership from target month when phase metadata is missing', () => {
    const result = normalizeBrainWbsArtifactToGeneratedTasks({
      startDate: '2026-04-01',
      artifactContent: {
        phases: [
          {
            id: 'phase-1',
            name: 'Foundation',
            duration: '2 months',
            workPackages: [
              {
                id: 'wp-1',
                name: 'Foundation package',
                estimatedEffort: '10 days',
                deliverables: ['Foundation dossier'],
              },
            ],
          },
          {
            id: 'phase-2',
            name: 'Mobilization',
            duration: '3 months',
            workPackages: [
              {
                id: 'wp-2',
                name: 'Mobilization package',
                estimatedEffort: '10 days',
                deliverables: ['Mobilization approval'],
              },
            ],
          },
        ],
        milestones: [
          {
            name: 'Foundation Gate',
            targetDate: 'Month 2',
          },
          {
            name: 'Mobilization Gate',
            targetDate: 'Month 4',
          },
        ],
      },
    });

    const foundationMilestone = result.tasks.find((task) => task.title === 'Foundation Gate');
    const mobilizationMilestone = result.tasks.find((task) => task.title === 'Mobilization Gate');

    expect(foundationMilestone?.parentTaskCode).toBe('1.0');
    expect(foundationMilestone?.taskCode).toBe('1.91');
    expect(mobilizationMilestone?.parentTaskCode).toBe('2.0');
    expect(mobilizationMilestone?.taskCode).toBe('2.91');
  });
});