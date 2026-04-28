/**
 * Shared types for planning phase extracted components.
 */

export interface ResourcePersonItem {
  role?: string;
  name?: string;
  count?: number;
  allocation?: string;
}

export interface ResourcesData {
  personnel?: ResourcePersonItem[];
  equipment?: string[];
  external?: string[];
}

export interface ResourceAlignmentData {
  projectId: string;
  projectName: string;
  hasBusinessCase: boolean;
  planned: {
    resources: Array<{ role: string; count: number; fte?: number; skills?: string[]; source: string }>;
    totalRoles: number;
    estimatedMonthlyHours: number;
    personnelCount: number;
    equipmentCount: number;
    externalCount: number;
  };
  actual: {
    assignments: Array<{
      name: string;
      userId?: string;
      teamId?: string;
      taskCount: number;
      totalHours: number;
      tasks: Array<{ id: string; title: string; status: string; hours: number }>;
    }>;
    totalAssignees: number;
    totalAllocatedHours: number;
    tasksWithAssignments: number;
    tasksWithoutAssignments: number;
  };
  variance: {
    roleGap: number;
    hoursVariance: number;
    hoursVariancePercent: number;
    status: 'no_plan' | 'adequate' | 'partial' | 'understaffed';
    unfilledRoles: number;
  };
  recommendations: string[];
}
