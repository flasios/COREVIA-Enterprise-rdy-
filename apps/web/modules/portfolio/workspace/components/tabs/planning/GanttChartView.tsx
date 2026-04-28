import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowRight, CalendarDays, Edit3, Flag, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { WbsTaskData } from '../../../types';

export function GanttChartView({ tasks, onEditTask, onDeleteTask, fullPage }: Readonly<{
  tasks: WbsTaskData[];
  onEditTask?: (task: WbsTaskData) => void;
  onDeleteTask?: (task: WbsTaskData) => void;
  fullPage?: boolean;
}>) {
  const { t } = useTranslation();
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [ganttViewMode, setGanttViewMode] = useState<'monthly' | 'half-yearly'>('half-yearly');

  /* ── sort by WBS hierarchy (sortOrder) ── */
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [tasks]);

  /* ── dependency maps ── */
  const { predecessorMap, successorMap } = useMemo(() => {
    const predMap = new Map<string, string[]>();
    const succMap = new Map<string, string[]>();
    const byCode = new Map<string, WbsTaskData>();

    tasks.forEach(tk => {
      const code = tk.wbsCode || tk.taskCode;
      if (code) byCode.set(code, tk);
      predMap.set(tk.id, []);
      succMap.set(tk.id, []);
    });

    tasks.forEach(tk => {
      const preds = tk.predecessors || tk.dependencies || [];
      if (Array.isArray(preds)) {
        preds.forEach((p: string | { taskCode?: string; wbsCode?: string }) => {
          const predCode = typeof p === 'object' ? (p.taskCode || p.wbsCode) : p;
          if (!predCode) return;
          const predTask = byCode.get(predCode);
          if (predTask) {
            predMap.get(tk.id)?.push(predTask.id);
            succMap.get(predTask.id)?.push(tk.id);
          }
        });
      }
    });

    return { predecessorMap: predMap, successorMap: succMap };
  }, [tasks]);

  const relatedTaskIds = useMemo(() => {
    const activeId = hoveredTaskId || selectedTaskId;
    if (!activeId) return new Set<string>();
    const related = new Set<string>();
    related.add(activeId);
    (predecessorMap.get(activeId) || []).forEach(id => related.add(id));
    (successorMap.get(activeId) || []).forEach(id => related.add(id));
    return related;
  }, [hoveredTaskId, selectedTaskId, predecessorMap, successorMap]);

  /* ── timeline bounds ── */
  const DAY_MS = 86_400_000;
  const DAY_PX = ganttViewMode === 'half-yearly' ? 3 : 28; // pixels per day

  const { minDate, totalDays } = useMemo(() => {
    const dates = sortedTasks
      .filter(tk => tk.plannedStartDate && tk.plannedEndDate)
      .flatMap(tk => [new Date(tk.plannedStartDate!), new Date(tk.plannedEndDate!)]);

    if (dates.length === 0) {
      const today = new Date();
      return { minDate: today, totalDays: 90 };
    }

    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    // add 7-day padding on each side
    min.setDate(min.getDate() - 3);
    const days = Math.ceil((max.getTime() - min.getTime()) / DAY_MS) + 7;
    return { minDate: min, totalDays: Math.max(days, 30) };
  }, [sortedTasks]);

  const chartWidth = totalDays * DAY_PX;

  /* ── build week / month / half-year columns ── */
  const timeColumns = useMemo(() => {
    const cols: { label: string; leftPx: number; widthPx: number }[] = [];

    if (ganttViewMode === 'half-yearly') {
      // half-year level columns
      const cur = new Date(minDate);
      cur.setDate(1);
      const endDate = new Date(minDate.getTime() + totalDays * DAY_MS);
      while (cur <= endDate) {
        const half = cur.getMonth() < 6 ? 0 : 1;
        const hStart = new Date(cur.getFullYear(), half * 6, 1);
        const hEnd = new Date(cur.getFullYear(), half * 6 + 6, 1);
        const startOff = Math.max(0, Math.round((hStart.getTime() - minDate.getTime()) / DAY_MS));
        const endOff = Math.min(totalDays, Math.round((hEnd.getTime() - minDate.getTime()) / DAY_MS));
        if (endOff > startOff) {
          const label = `H${half + 1} ${hStart.getFullYear()}`;
          // avoid duplicate half-year columns
          if (cols.length === 0 || cols[cols.length - 1]!.label !== label) {
            cols.push({ label, leftPx: startOff * DAY_PX, widthPx: (endOff - startOff) * DAY_PX });
          }
        }
        // advance to the next half-year
        cur.setTime(hEnd.getTime());
      }
    } else if (totalDays <= 120) {
      // week-level columns
      const start = new Date(minDate);
      // go to next Monday
      const dow = start.getDay();
      const firstMonday = new Date(start.getTime() + ((dow === 0 ? 1 : 8 - dow) % 7) * DAY_MS);
      let cur = new Date(firstMonday);
      while (true) {
        const dayOff = Math.round((cur.getTime() - minDate.getTime()) / DAY_MS);
        if (dayOff >= totalDays) break;
        const weekEnd = Math.min(dayOff + 7, totalDays);
        cols.push({
          label: `${cur.getDate()} ${cur.toLocaleDateString('en-US', { month: 'short' })}`,
          leftPx: dayOff * DAY_PX,
          widthPx: (weekEnd - dayOff) * DAY_PX,
        });
        cur = new Date(cur.getTime() + 7 * DAY_MS);
      }
    } else {
      // month-level columns
      const cur = new Date(minDate);
      cur.setDate(1);
      const endDate = new Date(minDate.getTime() + totalDays * DAY_MS);
      while (cur <= endDate) {
        const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        const startOff = Math.max(0, Math.round((cur.getTime() - minDate.getTime()) / DAY_MS));
        const endOff = Math.min(totalDays, Math.round((nextMonth.getTime() - minDate.getTime()) / DAY_MS));
        if (endOff > startOff) {
          cols.push({
            label: cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            leftPx: startOff * DAY_PX,
            widthPx: (endOff - startOff) * DAY_PX,
          });
        }
        cur.setTime(nextMonth.getTime());
      }
    }
    return cols;
  }, [minDate, totalDays, ganttViewMode, DAY_PX]);

  /* ── today marker ── */
  const todayOffsetPx = useMemo(() => {
    const now = new Date();
    const off = Math.round((now.getTime() - minDate.getTime()) / DAY_MS);
    return off >= 0 && off <= totalDays ? off * DAY_PX : null;
  }, [minDate, totalDays, DAY_PX]);

  /* ── bar position helper (pixels) ── */
  const getBarPx = (startDate: string, endDate: string) => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const startOff = Math.max(0, (s.getTime() - minDate.getTime()) / DAY_MS);
    const dur = Math.max(1, (e.getTime() - s.getTime()) / DAY_MS);
    return { left: startOff * DAY_PX, width: Math.max(dur * DAY_PX, DAY_PX) };
  };

  const criticalCount = sortedTasks.filter((tk: WbsTaskData & { isCritical?: boolean }) => tk.isCritical).length;
  const milestoneCount = sortedTasks.filter(tk => tk.taskType === 'milestone' || tk.isMilestone).length;

  if (sortedTasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground/70">
        <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="mb-2">{t('projectWorkspace.planning.noTasksToDisplay')}</p>
        <p className="text-sm">Generate AI tasks or add tasks manually to view the Gantt chart</p>
      </div>
    );
  }

  const ROW_H = 36;
  const TASK_COL_W = 300;

  return (
    <div className="space-y-3">
      {/* ── Legend ── */}
      <div className="flex items-center justify-between gap-4 px-3 py-2 bg-muted/30 rounded-lg border border-border/50">
        <div className="flex items-center gap-5 text-xs flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gradient-to-r from-indigo-500 to-purple-500 inline-block" /> Phase</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Task</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-sky-400 inline-block" /> Deliverable</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rotate-45 bg-amber-500 inline-block" /> Milestone ({milestoneCount})</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Critical ({criticalCount})</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Done</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border/50 overflow-hidden text-xs">
            <button
              type="button"
              className={`px-3 py-1 transition-colors ${ganttViewMode === 'monthly' ? 'bg-primary text-primary-foreground font-medium' : 'bg-background hover:bg-muted/50 text-muted-foreground'}`}
              onClick={() => setGanttViewMode('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`px-3 py-1 transition-colors border-l border-border/50 ${ganttViewMode === 'half-yearly' ? 'bg-primary text-primary-foreground font-medium' : 'bg-background hover:bg-muted/50 text-muted-foreground'}`}
              onClick={() => setGanttViewMode('half-yearly')}
            >
              Half-Yearly
            </button>
          </div>
          <span className="text-xs text-muted-foreground">{totalDays} days</span>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className={`border border-border/50 rounded-lg overflow-auto ${fullPage ? '' : 'max-h-[560px]'}`}>
          <div style={{ width: TASK_COL_W + chartWidth, minWidth: '100%' }}>

            {/* ── Header row ── */}
            <div className="sticky top-0 z-20 flex bg-background/95 backdrop-blur border-b border-border">
              <div className="shrink-0 border-r border-border bg-background/95 px-3 py-2 text-xs font-semibold text-muted-foreground" style={{ width: TASK_COL_W }}>
                WBS / Task
              </div>
              <div className="relative" style={{ width: chartWidth, height: 32 }}>
                {timeColumns.map((col, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-border/40 flex items-center justify-center text-[10px] text-muted-foreground font-medium"
                    style={{ left: col.leftPx, width: col.widthPx }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Rows ── */}
            {sortedTasks.map((task) => {
              const isCritical = (task as WbsTaskData & { isCritical?: boolean }).isCritical;
              const isPhase = task.taskType === 'phase' || task.wbsCode?.endsWith('.0');
              const isMilestone = task.taskType === 'milestone' || task.isMilestone;
              const isDeliverable = task.taskType === 'deliverable';
              const isCompleted = task.status === 'completed';
              const wbsLevel = task.wbsLevel || 1;
              const isHovered = hoveredTaskId === task.id;
              const isSelected = selectedTaskId === task.id;
              const isRelated = relatedTaskIds.has(task.id) && !isHovered && !isSelected;

              const bar = task.plannedStartDate && task.plannedEndDate
                ? getBarPx(task.plannedStartDate, task.plannedEndDate)
                : null;

              const rowBg = (() => {
                if (isSelected) return 'bg-primary/10';
                if (isHovered) return 'bg-primary/5';
                if (isRelated) return 'bg-amber-50 dark:bg-amber-500/5';
                if (isPhase) return 'bg-muted/40';
                return '';
              })();

              return (
                <button
                  type="button"
                  key={task.id}
                  className={`flex w-full text-left transition-colors duration-100 cursor-pointer border-b border-border/20 ${rowBg}`}
                  style={{ height: ROW_H }}
                  data-testid={`gantt-task-${task.id}`}
                  onMouseEnter={() => setHoveredTaskId(task.id)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                  onClick={() => setSelectedTaskId(selectedTaskId === task.id ? null : task.id)}
                >
                  {/* ── Task label ── */}
                  <div
                    className="shrink-0 border-r border-border/30 flex items-center gap-1.5 overflow-hidden"
                    style={{ width: TASK_COL_W, paddingLeft: `${12 + (wbsLevel - 1) * 16}px`, paddingRight: 8 }}
                  >
                    {isMilestone && <Flag className="w-3 h-3 text-amber-500 shrink-0" />}
                    {isCritical && !isMilestone && <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />}
                    <span className={`text-xs truncate ${
                      isPhase ? 'font-semibold text-indigo-700 dark:text-indigo-400' :
                      isMilestone ? 'font-semibold text-amber-700 dark:text-amber-400' :
                      isCritical ? 'text-red-600 dark:text-red-400' :
                      'text-foreground/80'
                    }`}>
                      <span className="text-muted-foreground/60 mr-1 font-mono text-[10px]">{task.wbsCode || task.taskCode}</span>
                      {task.taskName || task.title}
                    </span>
                  </div>

                  {/* ── Bar area ── */}
                  <div className="relative flex-1" style={{ width: chartWidth, height: ROW_H }}>
                    {/* grid lines */}
                    {timeColumns.map((col, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-l border-border/10"
                        style={{ left: col.leftPx }}
                      />
                    ))}

                    {/* today line */}
                    {todayOffsetPx !== null && (
                      <div className="absolute top-0 bottom-0 w-px bg-red-400/60 z-10" style={{ left: todayOffsetPx }} />
                    )}

                    {/* ── Milestone diamond ── */}
                    {isMilestone && bar && (
                      <div
                        className="absolute z-10"
                        style={{ left: bar.left + bar.width / 2 - 7, top: ROW_H / 2 - 7 }}
                        title={`${task.taskName}\n${task.plannedStartDate ? new Date(task.plannedStartDate).toLocaleDateString() : ''}`}
                      >
                        <div className="w-3.5 h-3.5 rotate-45 bg-amber-500 border-2 border-amber-600 shadow-md" />
                      </div>
                    )}

                    {/* ── Phase summary bar ── */}
                    {isPhase && !isMilestone && bar && (
                      <div
                        className="absolute rounded-sm bg-gradient-to-r from-indigo-500/80 to-purple-500/80 shadow-sm"
                        style={{ left: bar.left, width: bar.width, top: ROW_H / 2 - 4, height: 8 }}
                        title={`${task.taskName}\n${task.plannedStartDate ? new Date(task.plannedStartDate).toLocaleDateString() : ''} – ${task.plannedEndDate ? new Date(task.plannedEndDate).toLocaleDateString() : ''}\n${task.duration ?? 0}d`}
                      >
                        {/* bracket ends */}
                        <div className="absolute -left-px top-0 w-1 h-full bg-indigo-600 rounded-l-sm" />
                        <div className="absolute -right-px top-0 w-1 h-full bg-indigo-600 rounded-r-sm" />
                      </div>
                    )}

                    {/* ── Normal / critical / deliverable bar ── */}
                    {!isPhase && !isMilestone && bar && (
                      <div
                        className={`absolute rounded shadow-sm transition-transform ${
                          (isHovered || isSelected) ? 'ring-2 ring-primary/50 scale-y-110 z-10' :
                          isRelated ? 'ring-1 ring-amber-400/50' : ''
                        } ${
                          isCompleted ? 'bg-emerald-500' :
                          isCritical ? 'bg-gradient-to-r from-red-500 to-red-400' :
                          isDeliverable ? 'bg-gradient-to-r from-sky-400 to-sky-300' :
                          'bg-blue-500'
                        }`}
                        style={{ left: bar.left, width: bar.width, top: ROW_H / 2 - 6, height: 12 }}
                        title={`${task.taskName}\n${task.plannedStartDate ? new Date(task.plannedStartDate).toLocaleDateString() : ''} – ${task.plannedEndDate ? new Date(task.plannedEndDate).toLocaleDateString() : ''}\n${task.duration ?? 0}d`}
                      >
                        {bar.width > 50 && (
                          <span className="absolute inset-0 flex items-center px-1.5 text-[9px] text-white font-medium truncate leading-none">
                            {task.duration ?? 0}d
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
      </div>

      {/* ── Selected task detail ── */}
      {selectedTaskId && (
        <div className="p-3 bg-muted/30 rounded-lg border border-border/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Task Details</span>
            <div className="flex items-center gap-2">
              {onEditTask && (
                <Button variant="outline" size="sm" onClick={() => { const tk = tasks.find(x => x.id === selectedTaskId); if (tk) onEditTask(tk); }} className="h-6 px-2 text-xs">
                  <Edit3 className="w-3 h-3 mr-1" /> Edit
                </Button>
              )}
              {onDeleteTask && (
                <Button variant="outline" size="sm" onClick={() => { const tk = tasks.find(x => x.id === selectedTaskId); if (tk) onDeleteTask(tk); }} className="h-6 px-2 text-xs text-red-500 hover:text-red-600">
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setSelectedTaskId(null)} className="h-6 px-2 text-xs">Clear</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(predecessorMap.get(selectedTaskId) || []).map(predId => {
              const pt = tasks.find(x => x.id === predId);
              return pt && (
                <Badge key={predId} variant="outline" className="text-xs bg-blue-500/10 border-blue-500/30 cursor-pointer hover:bg-blue-500/20" onClick={() => setSelectedTaskId(predId)}>
                  <ArrowRight className="w-3 h-3 mr-1 rotate-180" />
                  {pt.wbsCode || ''} {pt.taskName || pt.title}
                </Badge>
              );
            })}
            <Badge variant="secondary" className="text-xs font-semibold">
              {tasks.find(x => x.id === selectedTaskId)?.taskName || 'Selected'}
            </Badge>
            {(successorMap.get(selectedTaskId) || []).map(succId => {
              const st = tasks.find(x => x.id === succId);
              return st && (
                <Badge key={succId} variant="outline" className="text-xs bg-purple-500/10 border-purple-500/30 cursor-pointer hover:bg-purple-500/20" onClick={() => setSelectedTaskId(succId)}>
                  {st.wbsCode || ''} {st.taskName || st.title}
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
