import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowRight, CheckCircle2, Clock, GitBranch, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WbsTaskData } from '../../../types';

export function DependenciesView({ tasks }: Readonly<{ tasks: WbsTaskData[] }>) {
  const { t } = useTranslation();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'table'>('graph');

  const { taskByCode: _taskByCode, predecessorMap, successorMap, dependencyStats } = useMemo(() => {
    const byCode = new Map<string, WbsTaskData>();
    const predMap = new Map<string, WbsTaskData[]>();
    const succMap = new Map<string, WbsTaskData[]>();

    tasks.forEach(t => {
      const code = t.wbsCode || t.taskCode;
      if (code) byCode.set(code, t);
      predMap.set(t.id, []);
      succMap.set(t.id, []);
    });

    let totalDeps = 0;
    let blockedTasks = 0;

    tasks.forEach(t => {
      const preds = t.predecessors || t.dependencies || [];
      if (Array.isArray(preds) && preds.length > 0) {
        totalDeps += preds.length;

        const allPredsComplete = preds.every((p: string | { taskCode?: string; wbsCode?: string }) => {
          const predCode = typeof p === 'object' ? (p.taskCode || p.wbsCode) : p;
          if (!predCode) return true;
          const predTask = byCode.get(predCode);
          return predTask?.status === 'completed';
        });

        if (!allPredsComplete && t.status !== 'completed') {
          blockedTasks++;
        }

        preds.forEach((p: string | { taskCode?: string; wbsCode?: string }) => {
          const predCode = typeof p === 'object' ? (p.taskCode || p.wbsCode) : p;
          if (!predCode) return;
          const predTask = byCode.get(predCode);
          if (predTask) {
            predMap.get(t.id)?.push(predTask);
            succMap.get(predTask.id)?.push(t);
          }
        });
      }
    });

    const tasksWithDeps = tasks.filter(t => (predMap.get(t.id)?.length || 0) > 0);
    const tasksWithSuccs = tasks.filter(t => (succMap.get(t.id)?.length || 0) > 0);

    return {
      taskByCode: byCode,
      predecessorMap: predMap,
      successorMap: succMap,
      dependencyStats: {
        totalDeps,
        blockedTasks,
        tasksWithDeps: tasksWithDeps.length,
        tasksWithSuccs: tasksWithSuccs.length,
      }
    };
  }, [tasks]);

  const tasksWithRelationships = useMemo(() => {
    return tasks.filter(t => {
      const preds = predecessorMap.get(t.id) || [];
      const succs = successorMap.get(t.id) || [];
      return preds.length > 0 || succs.length > 0;
    });
  }, [tasks, predecessorMap, successorMap]);

  return (
    <Card className="bg-card/60 border-border">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              Task Dependencies
            </CardTitle>
            <CardDescription className="mt-1">
              Relationships and dependencies between tasks
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'graph' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('graph')}
              data-testid="button-view-graph"
            >
              <GitBranch className="w-4 h-4 mr-1" />
              Graph
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('table')}
              data-testid="button-view-table"
            >
              <Layers className="w-4 h-4 mr-1" />
              Table
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-muted/40 rounded-lg border border-border/50 text-center">
            <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{dependencyStats.totalDeps}</div>
            <div className="text-xs text-muted-foreground">Total Links</div>
          </div>
          <div className="p-3 bg-muted/40 rounded-lg border border-border/50 text-center">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{dependencyStats.tasksWithDeps}</div>
            <div className="text-xs text-muted-foreground">With Predecessors</div>
          </div>
          <div className="p-3 bg-muted/40 rounded-lg border border-border/50 text-center">
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{dependencyStats.tasksWithSuccs}</div>
            <div className="text-xs text-muted-foreground">With Successors</div>
          </div>
          <div className="p-3 bg-muted/40 rounded-lg border border-border/50 text-center">
            <div className={`text-lg font-bold ${dependencyStats.blockedTasks > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {dependencyStats.blockedTasks}
            </div>
            <div className="text-xs text-muted-foreground">Waiting</div>
          </div>
        </div>

        {viewMode === 'graph' && (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {tasksWithRelationships.length > 0 ? (
                tasksWithRelationships.map((task) => {
                  const preds = predecessorMap.get(task.id) || [];
                  const succs = successorMap.get(task.id) || [];
                  const isSelected = selectedTaskId === task.id;
                  const isCritical = (task as any).isCritical; // eslint-disable-line @typescript-eslint/no-explicit-any

                  const allPredsComplete = preds.every(p => p.status === 'completed');
                  const isBlocked = preds.length > 0 && !allPredsComplete && task.status !== 'completed';

                  return (
                    <button
                      type="button"
                      key={task.id}
                      className={`text-left w-full p-4 rounded-lg border transition-all cursor-pointer ${(() => {
                        if (isSelected) return 'bg-primary/10 border-primary/50 ring-2 ring-primary/20';
                        if (isCritical) return 'bg-red-500/5 border-red-500/30';
                        if (isBlocked) return 'bg-amber-500/5 border-amber-500/30';
                        return 'bg-muted/40 border-border/50 hover:bg-muted/60';
                      })()}`}
                      onClick={() => setSelectedTaskId(isSelected ? null : task.id)}
                      data-testid={`dependency-${task.id}`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${(() => {
                            if (task.status === 'completed') return 'bg-emerald-500';
                            if (task.status === 'in_progress') return 'bg-blue-500';
                            if (isBlocked) return 'bg-amber-500 animate-pulse';
                            return 'bg-muted-foreground';
                          })()}`} />
                          <div>
                            <span className="font-medium text-sm">{task.taskName || task.title}</span>
                            {task.wbsCode && (
                              <Badge variant="outline" className="ml-2 text-xs">{task.wbsCode}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCritical && (
                            <Badge className="bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30 text-xs">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Critical
                            </Badge>
                          )}
                          {isBlocked && (
                            <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              Waiting
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <ArrowRight className="w-3 h-3 rotate-180" />
                            <span>Predecessors ({preds.length})</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {preds.length > 0 ? preds.map((pred) => (
                              <Badge
                                key={pred.id}
                                variant="outline"
                                className={`text-xs cursor-pointer transition-colors ${
                                  pred.status === 'completed'
                                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTaskId(pred.id);
                                }}
                              >
                                {pred.wbsCode && <span className="mr-1 opacity-60">{pred.wbsCode}</span>}
                                {pred.taskName || pred.title}
                                {pred.status === 'completed' && (
                                  <CheckCircle2 className="w-3 h-3 ml-1" />
                                )}
                              </Badge>
                            )) : (
                              <span className="text-xs text-muted-foreground/50">None</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <ArrowRight className="w-3 h-3" />
                            <span>Successors ({succs.length})</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {succs.length > 0 ? succs.map((succ) => (
                              <Badge
                                key={succ.id}
                                variant="outline"
                                className="text-xs cursor-pointer border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTaskId(succ.id);
                                }}
                              >
                                {succ.wbsCode && <span className="mr-1 opacity-60">{succ.wbsCode}</span>}
                                {succ.taskName || succ.title}
                              </Badge>
                            )) : (
                              <span className="text-xs text-muted-foreground/50">None</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-12 text-muted-foreground/70">
                  <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="mb-2">{t('projectWorkspace.planning.noDependenciesDefined')}</p>
                  <p className="text-sm">Generate AI WBS tasks to automatically create dependencies</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {viewMode === 'table' && (
          <ScrollArea className="h-[400px]">
            <div className="border border-border/50 rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 gap-2 p-3 bg-muted/50 border-b border-border/50 text-xs font-medium text-muted-foreground">
                <div className="col-span-1">Code</div>
                <div className="col-span-4">Task Name</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-3">Predecessors</div>
                <div className="col-span-3">Successors</div>
              </div>
              {tasks.map((task) => {
                const preds = predecessorMap.get(task.id) || [];
                const succs = successorMap.get(task.id) || [];
                const isCritical = (task as any).isCritical; // eslint-disable-line @typescript-eslint/no-explicit-any

                return (
                  <div
                    key={task.id}
                    className={`grid grid-cols-12 gap-2 p-3 border-b border-border/30 text-xs hover:bg-muted/30 ${
                      isCritical ? 'bg-red-500/5' : ''
                    }`}
                    data-testid={`table-dependency-${task.id}`}
                  >
                    <div className="col-span-1 text-muted-foreground font-mono">{task.wbsCode}</div>
                    <div className="col-span-4 flex items-center gap-2">
                      {isCritical && <AlertCircle className="w-3 h-3 text-red-500" />}
                      <span className="truncate">{task.taskName || task.title}</span>
                    </div>
                    <div className="col-span-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1 py-0 ${(() => {
                          if (task.status === 'completed') return 'border-emerald-500/50 text-emerald-600';
                          if (task.status === 'in_progress') return 'border-blue-500/50 text-blue-600';
                          return 'border-muted-foreground/30';
                        })()}`}
                      >
                        {task.status || 'pending'}
                      </Badge>
                    </div>
                    <div className="col-span-3 flex flex-wrap gap-1">
                      {preds.length > 0 ? preds.map((p, i) => (
                        <span key={p.id || p.wbsCode} className="text-blue-600 dark:text-blue-400">
                          {p.wbsCode}{i < preds.length - 1 ? ', ' : ''}
                        </span>
                      )) : <span className="text-muted-foreground/50">-</span>}
                    </div>
                    <div className="col-span-3 flex flex-wrap gap-1">
                      {succs.length > 0 ? succs.map((s, i) => (
                        <span key={s.id || s.wbsCode} className="text-purple-600 dark:text-purple-400">
                          {s.wbsCode}{i < succs.length - 1 ? ', ' : ''}
                        </span>
                      )) : <span className="text-muted-foreground/50">-</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
