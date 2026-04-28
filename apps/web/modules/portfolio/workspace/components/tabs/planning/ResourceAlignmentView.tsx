/**
 * ResourceAlignmentView — Extracted from PlanningPhaseTab.tsx
 *
 * Shows planned vs actual resource alignment with variance analysis
 * and recommendations for team staffing.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Target,
  Package,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import type { ResourceAlignmentData, ResourcesData, ResourcePersonItem } from './types';
import type { WbsTaskData } from '../../../types';

export function ResourceAlignmentView({ projectId, resources, tasks }: Readonly<{ projectId: string; resources: ResourcesData | null | undefined; tasks: WbsTaskData[] }>) {
  const { t } = useTranslation();
  const { data: alignmentResponse, isLoading } = useQuery<{ success: boolean; data: ResourceAlignmentData }>({
    queryKey: ['/api/portfolio/projects', projectId, 'resource-alignment'],
  });

  const alignment = alignmentResponse?.data;
  const fallbackAlignment = useMemo<ResourceAlignmentData | null>(() => {
    const plannedResources = [
      ...(resources?.personnel?.map((person) => ({
        role: person.role || person.name || 'Resource',
        count: person.count || 1,
        source: 'personnel',
      })) || []),
      ...(resources?.equipment?.map((item) => ({
        role: item,
        count: 1,
        source: 'equipment',
      })) || []),
      ...(resources?.external?.map((item) => ({
        role: item,
        count: 1,
        source: 'external',
      })) || []),
    ];

    const assignmentMap = new Map<string, { name: string; taskCount: number; totalHours: number; tasks: Array<{ id: string; title: string; status: string; hours: number }> }>();
    let tasksWithAssignments = 0;
    let tasksWithoutAssignments = 0;
    let totalAllocatedHours = 0;

    for (const task of tasks) {
      const taskRecord = task as unknown as Record<string, unknown>;
      const rawAssignments = [task.assignedTo, taskRecord.assignedTeam]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .flatMap((value) => value.split(',').map((item) => item.trim()).filter(Boolean));

      if (rawAssignments.length === 0) {
        tasksWithoutAssignments += 1;
        continue;
      }

      tasksWithAssignments += 1;
      const taskHours = Number(task.estimatedHours || 0);
      totalAllocatedHours += taskHours;

      for (const assignmentName of rawAssignments) {
        const existing = assignmentMap.get(assignmentName) || {
          name: assignmentName,
          taskCount: 0,
          totalHours: 0,
          tasks: [],
        };
        existing.taskCount += 1;
        existing.totalHours += taskHours;
        existing.tasks.push({
          id: task.id,
          title: task.title || task.taskName || 'Untitled task',
          status: task.status || 'not_started',
          hours: taskHours,
        });
        assignmentMap.set(assignmentName, existing);
      }
    }

    if (plannedResources.length === 0 && assignmentMap.size === 0 && tasks.length === 0) {
      return null;
    }

    const recommendations: string[] = [];
    if (plannedResources.length === 0) {
      recommendations.push('Define planned roles in the business case so staffing readiness can be measured against execution assignments.');
    }
    if (tasksWithoutAssignments > 0) {
      recommendations.push(`${tasksWithoutAssignments} WBS tasks still need named owners before execution readiness is credible.`);
    }
    if (plannedResources.length > 0 && assignmentMap.size < plannedResources.length) {
      recommendations.push('Assigned resources are below the planned role count. Close the staffing gap before moving deeper into execution.');
    }

    const roleGap = plannedResources.length - assignmentMap.size;
    let status: ResourceAlignmentData['variance']['status'] = 'understaffed';
    if (plannedResources.length === 0) {
      status = 'no_plan';
    } else if (tasksWithoutAssignments === 0 && assignmentMap.size >= Math.min(plannedResources.length, 1)) {
      status = 'adequate';
    } else if (assignmentMap.size > 0) {
      status = 'partial';
    }

    return {
      projectId,
      projectName: '',
      hasBusinessCase: plannedResources.length > 0,
      planned: {
        resources: plannedResources,
        totalRoles: plannedResources.length,
        estimatedMonthlyHours: 0,
        personnelCount: resources?.personnel?.length || 0,
        equipmentCount: resources?.equipment?.length || 0,
        externalCount: resources?.external?.length || 0,
      },
      actual: {
        assignments: Array.from(assignmentMap.values()),
        totalAssignees: assignmentMap.size,
        totalAllocatedHours,
        tasksWithAssignments,
        tasksWithoutAssignments,
      },
      variance: {
        roleGap,
        hoursVariance: 0,
        hoursVariancePercent: 0,
        status,
        unfilledRoles: Math.max(roleGap, 0),
      },
      recommendations,
    };
  }, [projectId, resources, tasks]);
  const effectiveAlignment = alignment || fallbackAlignment;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'adequate':
        return <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40">Fully Staffed</Badge>;
      case 'partial':
        return <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40">Partially Staffed</Badge>;
      case 'understaffed':
        return <Badge className="bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40">Understaffed</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground">{t('projectWorkspace.planning.noPlan')}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-700 shadow-sm">
        <CardContent className="p-8">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            <span className="text-sm text-slate-400">{t('projectWorkspace.planning.loadingResourceAlignment')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resource Summary Strip */}
      <div className="flex items-stretch gap-px rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="flex-1 px-4 py-2.5 border-r border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-slate-900 dark:text-white">Resource Alignment</span>
          </div>
          <div className="text-[10px] text-slate-400">BC Plan vs WBS</div>
        </div>
        {effectiveAlignment ? (
          <>
            <div className="flex-1 px-4 py-2.5 border-r border-slate-100 dark:border-slate-800 text-center">
              <div className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400 leading-none">{effectiveAlignment.planned.totalRoles}</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 mt-1">Planned</div>
            </div>
            <div className="flex-1 px-4 py-2.5 border-r border-slate-100 dark:border-slate-800 text-center">
              <div className="text-lg font-bold tabular-nums text-blue-600 dark:text-blue-400 leading-none">{effectiveAlignment.actual.totalAssignees}</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 mt-1">Assigned</div>
            </div>
            <div className="flex-1 px-4 py-2.5 border-r border-slate-100 dark:border-slate-800 text-center">
              <div className={`text-lg font-bold tabular-nums leading-none ${effectiveAlignment.variance.roleGap > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {effectiveAlignment.variance.roleGap > 0 ? `-${effectiveAlignment.variance.roleGap}` : effectiveAlignment.variance.roleGap === 0 ? '0' : `+${Math.abs(effectiveAlignment.variance.roleGap)}`}
              </div>
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 mt-1">Variance</div>
            </div>
            <div className="flex-1 px-4 py-2.5 text-center">
              <div className="text-lg font-bold tabular-nums text-purple-600 dark:text-purple-400 leading-none">{effectiveAlignment.actual.tasksWithAssignments}</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 mt-1">Assigned</div>
            </div>
          </>
        ) : (
          <div className="flex-1 px-4 py-2.5 flex items-center justify-center">
            <span className="text-xs text-slate-400">No alignment data</span>
          </div>
        )}
        {effectiveAlignment && <div className="flex items-center px-3">{getStatusBadge(effectiveAlignment.variance.status)}</div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-700 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                <Target className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Planned Resources
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">Business Case</Badge>
            </div>
            <CardDescription className="text-xs text-slate-400">Resource requirements from project planning</CardDescription>
          </CardHeader>
          <CardContent>
            {effectiveAlignment && effectiveAlignment.planned.resources.length > 0 ? (
              <div className="space-y-1.5">
                {effectiveAlignment.planned.resources.map((res, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-slate-50/50 dark:bg-slate-800/30 rounded-md border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
                        res.source === 'personnel' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                        res.source === 'equipment' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                        'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                      }`}>
                        {res.role.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-900 dark:text-white">{res.role}</div>
                        <div className="text-[10px] text-slate-400">
                          {res.count > 1 ? `${res.count}x` : ''} {res.fte ? `${res.fte} FTE` : ''}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">{res.source}</Badge>
                  </div>
                ))}
              </div>
            ) : resources ? (
              <div className="space-y-1.5">
                {resources.personnel && Array.isArray(resources.personnel) && resources.personnel.map((person: ResourcePersonItem, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-slate-50/50 dark:bg-slate-800/30 rounded-md border border-slate-200 dark:border-slate-700">
                    <div className="w-7 h-7 rounded-md bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                      {(person.role || person.name || 'R').charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-900 dark:text-white">{person.role || person.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {person.count && `${person.count}x`} {person.allocation || ''}
                      </div>
                    </div>
                  </div>
                ))}
                {resources.equipment && Array.isArray(resources.equipment) && resources.equipment.map((item: string, i: number) => (
                  <div key={`eq-${i}`} className="flex items-center gap-2 p-2 bg-slate-50/50 dark:bg-slate-800/30 rounded-md border border-slate-200 dark:border-slate-700">
                    <div className="w-7 h-7 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400">
                      <Package className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-xs font-medium text-slate-900 dark:text-white">{item}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No planned resources</p>
                <p className="text-[10px] mt-1">Generate a business case to define resource requirements</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-700 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Actual Assignments
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">WBS Tasks</Badge>
            </div>
            <CardDescription className="text-xs text-slate-400">Team members assigned to project tasks</CardDescription>
          </CardHeader>
          <CardContent>
            {effectiveAlignment && effectiveAlignment.actual.assignments.length > 0 ? (
              <div className="space-y-1.5">
                {effectiveAlignment.actual.assignments.map((assignment, i) => (
                  <div key={i} className="p-2 bg-slate-50/50 dark:bg-slate-800/30 rounded-md border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 text-xs font-bold">
                          {assignment.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-900 dark:text-white">{assignment.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {assignment.taskCount} tasks • {assignment.totalHours}h
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/40 text-[10px]">
                        {assignment.taskCount}
                      </Badge>
                    </div>
                    {assignment.tasks.length > 0 && (
                      <div className="mt-1.5 pl-9 space-y-0.5">
                        {assignment.tasks.slice(0, 3).map((task, j) => (
                          <div key={j} className="text-[11px] text-slate-400 flex items-center gap-1">
                            <CheckCircle2 className={`w-2.5 h-2.5 ${task.status === 'completed' ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`} />
                            <span className="truncate">{task.title}</span>
                          </div>
                        ))}
                        {assignment.tasks.length > 3 && (
                          <div className="text-[10px] text-slate-400">+{assignment.tasks.length - 3} more</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No resources assigned</p>
                <p className="text-[10px] mt-1">Assign team members in the Schedule view</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {effectiveAlignment && effectiveAlignment.recommendations.length > 0 && (
        <Card className="bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/40 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-amber-600 dark:text-amber-400 text-sm">Recommendations</h4>
                <ul className="mt-2 space-y-1">
                  {effectiveAlignment.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {effectiveAlignment && effectiveAlignment.actual.tasksWithoutAssignments > 0 && (
        <Card className="bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Layers className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-medium text-sm">Unassigned Tasks</div>
                  <div className="text-xs text-muted-foreground">
                    {effectiveAlignment.actual.tasksWithoutAssignments} tasks need resource assignment
                  </div>
                </div>
              </div>
              <Badge variant="outline">{effectiveAlignment.actual.tasksWithoutAssignments} pending</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
