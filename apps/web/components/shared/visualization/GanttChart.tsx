import { Calendar, CheckCircle2, Clock, Target, TrendingUp, ChevronDown, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { useTranslation } from 'react-i18next';

interface Phase {
  name: string;
  duration?: string;
  durationMonths?: number;
  startDate?: string | Date;
  endDate?: string | Date;
  deliverables?: string[];
  tasks?: string[];
  owner?: string;
}

interface Milestone {
  name: string;
  date: string;
  deliverable?: string;
}

interface GanttChartProps {
  phases: Phase[];
  milestones?: Milestone[];
}

function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseTimelineDate(value: string | Date | undefined): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = isIsoDateString(value)
    ? new Date(`${value}T00:00:00Z`)
    : new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getMonthOffset(start: Date, end: Date): number {
  return ((end.getUTCFullYear() - start.getUTCFullYear()) * 12) + (end.getUTCMonth() - start.getUTCMonth());
}

function formatMilestoneDateLabel(value: string): string {
  if (!value) return '';
  const parsed = parseTimelineDate(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}

export function GanttChart({ phases, milestones = [] }: Readonly<GanttChartProps>) {
  const { t } = useTranslation();
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());

  if (!phases || phases.length === 0) {
    return null;
  }

  const togglePhase = (idx: number) => {
    const newExpanded = new Set(expandedPhases);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedPhases(newExpanded);
  };

  const parseDuration = (phase: Phase): number => {
    if (typeof phase.durationMonths === 'number' && Number.isFinite(phase.durationMonths) && phase.durationMonths > 0) {
      return Math.round(phase.durationMonths);
    }

    const startDate = parseTimelineDate(phase.startDate);
    const endDate = parseTimelineDate(phase.endDate);
    if (startDate && endDate && endDate >= startDate) {
      const elapsedDays = ((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
      return Math.max(1, Math.ceil(elapsedDays / 30.4375));
    }

    if (!phase.duration) return 3;

    const matches = [...phase.duration.matchAll(/(\d+(?:\.\d+)?)/g)];
    if (matches.length === 0) return 3;

    const num = Math.max(...matches.map((match) => Number.parseFloat(match[1] ?? '0')).filter(Number.isFinite));
    if (!Number.isFinite(num) || num <= 0) return 3;

    const normalizedDuration = phase.duration.toLowerCase();
    if (normalizedDuration.includes('day')) {
      return Math.max(1, Math.ceil(num / 30.4375));
    }

    if (normalizedDuration.includes('week')) {
      return Math.max(1, Math.ceil(num / 4.345));
    }

    if (normalizedDuration.includes('quarter')) {
      return Math.max(1, Math.ceil(num * 3));
    }

    if (normalizedDuration.includes('month')) {
      return Math.max(1, Math.ceil(num));
    }

    if (normalizedDuration.includes('year')) {
      return Math.max(1, Math.ceil(num * 12));
    }

    return Math.max(1, Math.ceil(num));
  };

  const phaseDateEntries = phases.map((phase) => ({
    phase,
    startDate: parseTimelineDate(phase.startDate),
    endDate: parseTimelineDate(phase.endDate),
  }));

  const hasDateAnchoredTimeline = phaseDateEntries.every((entry) => entry.startDate && entry.endDate);
  const phaseTimelineAnchor = hasDateAnchoredTimeline
    ? phaseDateEntries.reduce((earliest, entry) => (entry.startDate! < earliest ? entry.startDate! : earliest), phaseDateEntries[0]!.startDate!)
    : null;
  const phaseTimelineEnd = hasDateAnchoredTimeline
    ? phaseDateEntries.reduce((latest, entry) => (entry.endDate! > latest ? entry.endDate! : latest), phaseDateEntries[0]!.endDate!)
    : null;

  const datedMilestones = milestones
    .map((milestone, index) => ({
      milestone,
      parsed: parseTimelineDate(milestone.date),
      index,
    }))
    .filter((entry) => entry.parsed && !Number.isNaN(entry.parsed.getTime()));

  const timelineAnchor = phaseTimelineAnchor ?? (datedMilestones.length > 0
    ? datedMilestones.reduce((earliest, entry) => (entry.parsed! < earliest ? entry.parsed! : earliest), datedMilestones[0]!.parsed!)
    : null);

  const parseMilestoneMonth = (milestone: Milestone): number | null => {
    if (!milestone.date) return null;

    const monthMatch = /month\s*(\d+)/i.exec(milestone.date);
    if (monthMatch?.[1]) {
      const month = Number.parseInt(monthMatch[1], 10);
      return Number.isFinite(month) && month > 0 ? month : null;
    }

    if (!timelineAnchor) return null;

    const parsed = parseTimelineDate(milestone.date);
    if (!parsed) return null;

    return getMonthOffset(timelineAnchor, parsed) + 1;
  };

  const formatDurationLabel = (phase: Phase): string => {
    if (phase.duration && phase.duration.trim().length > 0) {
      return phase.duration;
    }

    const durationMonths = parseDuration(phase);
    return `${durationMonths} month${durationMonths === 1 ? '' : 's'}`;
  };

  let cumulativeMonths = 0;
  const sequentialTimeline = phases.map((phase, idx) => {
    const durationMonths = parseDuration(phase);
    const start = cumulativeMonths;
    const end = start + durationMonths;
    cumulativeMonths = end;

    return {
      ...phase,
      start,
      end,
      durationMonths,
      index: idx,
    };
  });

  const timeline = hasDateAnchoredTimeline && phaseTimelineAnchor && phaseTimelineEnd
    ? phaseDateEntries.map(({ phase, startDate, endDate }, idx) => {
        const start = getMonthOffset(phaseTimelineAnchor, startDate!);
        const end = getMonthOffset(phaseTimelineAnchor, endDate!) + 1;
        return {
          ...phase,
          start,
          end,
          durationMonths: Math.max(1, end - start),
          index: idx,
        };
      })
    : sequentialTimeline;

  const totalDuration = hasDateAnchoredTimeline && phaseTimelineAnchor && phaseTimelineEnd
    ? Math.max(1, getMonthOffset(phaseTimelineAnchor, phaseTimelineEnd) + 1)
    : cumulativeMonths;

  const milestoneMarkers = milestones
    .map((milestone, index) => ({
      ...milestone,
      originalIndex: index,
      month: parseMilestoneMonth(milestone),
    }))
    .filter((milestone): milestone is Milestone & { originalIndex: number; month: number } => typeof milestone.month === 'number' && milestone.month > 0 && milestone.month <= Math.max(totalDuration, 1));

  const laneLastMonth: number[] = [];
  const milestoneCollisionWindow = totalDuration > 18 ? 2 : 1;
  const milestoneLaneHeight = 52;
  const milestoneMarkersWithLanes = [...milestoneMarkers]
    .sort((left, right) => left.month - right.month || left.originalIndex - right.originalIndex)
    .map((milestone) => {
      let lane = laneLastMonth.findIndex((lastMonth) => milestone.month - lastMonth > milestoneCollisionWindow);
      if (lane === -1) {
        lane = laneLastMonth.length;
        laneLastMonth.push(milestone.month);
      } else {
        laneLastMonth[lane] = milestone.month;
      }

      return {
        ...milestone,
        lane,
      };
    });

  const milestoneLaneCount = Math.max(1, ...milestoneMarkersWithLanes.map((milestone) => milestone.lane + 1));
  const milestoneTrackHeight = milestoneLaneCount * milestoneLaneHeight;

  const phaseColors = [
    { bar: 'bg-blue-500', light: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
    { bar: 'bg-purple-500', light: 'bg-purple-50 dark:bg-purple-950/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
    { bar: 'bg-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
    { bar: 'bg-orange-500', light: 'bg-orange-50 dark:bg-orange-950/20', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
    { bar: 'bg-pink-500', light: 'bg-pink-50 dark:bg-pink-950/20', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800' },
  ];

  const defaultColor = { bar: 'bg-blue-500', light: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' };

  return (
    <div className="space-y-6">
      {/* Professional Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{t('visualization.gantt.implementationPlan')}</h3>
            <p className="text-sm text-muted-foreground">{t('visualization.gantt.strategicExecutionRoadmap')}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{totalDuration}</div>
            <div className="text-xs text-muted-foreground">{t('visualization.gantt.totalMonths')}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{phases.length}</div>
            <div className="text-xs text-muted-foreground">{t('visualization.gantt.phases')}</div>
          </div>
        </div>
      </div>

      {/* Timeline Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            {t('visualization.gantt.implementationTimeline')}
          </h4>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{t('visualization.gantt.duration', { months: totalDuration })}</span>
          </div>
        </div>

        {/* Gantt Chart Table */}
        <div className="border rounded-lg overflow-hidden shadow-sm">
          {/* Header */}
          <div className="flex bg-muted/50 border-b">
            <div className="w-64 px-4 py-3 border-r font-semibold text-sm">{t('visualization.gantt.phaseDetails')}</div>
            <div className="flex-1 flex">
              {Array.from({ length: totalDuration }, (_, i) => `M${i + 1}`).map(label => (
                <div
                  key={label}
                  className="flex-1 text-center py-3 border-r last:border-r-0"
                  style={{ minWidth: '50px' }}
                >
                  <div className="text-xs font-medium text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {milestoneMarkers.length > 0 && (
            <div className="flex bg-primary/5 border-b">
              <div className="w-64 px-4 py-3 border-r">
                <div className="text-sm font-semibold">Decision Gates</div>
                <div className="text-xs text-muted-foreground">Milestones aligned to the implementation months</div>
              </div>
              <div className="flex-1 relative px-3 py-4">
                <div className="absolute inset-0 flex">
                  {Array.from({ length: totalDuration }, (_, i) => `milestone-grid-${i}`).map(gridId => (
                    <div
                      key={gridId}
                      className="flex-1 border-r last:border-r-0 border-border/10"
                      style={{ minWidth: '50px' }}
                    />
                  ))}
                </div>
                <div className="relative" style={{ height: `${milestoneTrackHeight}px` }}>
                  {milestoneMarkersWithLanes.map((milestone, idx) => {
                    const left = ((milestone.month - 0.5) / totalDuration) * 100;
                    return (
                      <div
                        key={`${milestone.name}-${idx}`}
                        className="absolute -translate-x-1/2"
                        style={{ left: `${left}%`, top: `${milestone.lane * milestoneLaneHeight}px` }}
                        data-testid={`gantt-marker-${idx}`}
                      >
                        <div className="mx-auto h-3 w-3 rounded-full bg-primary shadow-sm" />
                        <div className="mt-2 min-w-[120px] max-w-[180px] rounded-md border bg-background/95 px-2 py-1 text-[10px] shadow-sm">
                          <div className="font-semibold leading-tight">{milestone.name}</div>
                          <div className="text-muted-foreground">{formatMilestoneDateLabel(milestone.date)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Phase Rows */}
          {timeline.map((phase, idx) => {
            const colors = phaseColors[idx % phaseColors.length] ?? defaultColor;
            const isExpanded = expandedPhases.has(idx);
            const hasDeliverables = phase.deliverables && phase.deliverables.length > 0;
            const hasTasks = phase.tasks && phase.tasks.length > 0;
            const hasDetails = hasDeliverables || hasTasks;
            
            return (
              <div key={phase.name} className="flex border-b last:border-b-0 bg-card">
                {/* Phase Info Column */}
                <div className="w-64 border-r">
                  <div className="px-4 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <div className="font-semibold text-sm leading-tight">
                          {t('visualization.gantt.phaseLabel', { number: idx + 1, name: phase.name })}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatDurationLabel(phase)}</span>
                        </div>
                      </div>
                      {hasDetails && (
                        <button
                          onClick={() => togglePhase(idx)}
                          className="p-1 hover:bg-muted rounded transition-colors"
                          data-testid={`phase-toggle-${idx}`}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      )}
                    </div>
                    
                    {phase.owner && (
                      <div className="text-xs text-muted-foreground">
                        Owner: {phase.owner}
                      </div>
                    )}

                    {hasDetails && (
                      <div className="flex items-center gap-2">
                        <Target className="h-3 w-3 text-primary" />
                        <span className="text-xs text-muted-foreground">
                          {hasDeliverables
                            ? t('visualization.gantt.deliverableCount', { count: phase.deliverables?.length || 0 })
                            : `${phase.tasks?.length || 0} activities`}
                        </span>
                      </div>
                    )}
                    
                    {/* Progress Indicator */}
                    <div className="space-y-1">
                      <Progress value={0} className="h-1.5" />
                      <div className="text-[10px] text-muted-foreground">{t('visualization.gantt.notStarted')}</div>
                    </div>
                  </div>
                </div>

                {/* Timeline Column */}
                <div className="flex-1 py-4 px-3 relative">
                  {/* Grid Background */}
                  <div className="absolute inset-0 flex">
                    {Array.from({ length: totalDuration }, (_, i) => `grid-${i}`).map(gridId => (
                      <div
                        key={gridId}
                        className="flex-1 border-r last:border-r-0 border-border/10"
                        style={{ minWidth: '50px' }}
                      />
                    ))}
                  </div>

                  {/* Phase Bar Container */}
                  <div
                    className="relative"
                    style={{
                      marginLeft: `${(phase.start / totalDuration) * 100}%`,
                      width: `${(phase.durationMonths / totalDuration) * 100}%`,
                    }}
                  >
                    {/* Phase Bar */}
                    <div className={`${colors.bar} rounded-md h-8 px-3 flex items-center justify-between shadow-sm`}>
                      <span className="text-sm font-medium text-white">{t('visualization.gantt.phaseNumber', { number: idx + 1 })}</span>
                      {hasDetails && (
                        <div className="h-5 w-5 rounded-full bg-white/25 flex items-center justify-center">
                          <span className="text-xs font-semibold text-white">{(phase.deliverables?.length || phase.tasks?.length || 0)}</span>
                        </div>
                      )}
                    </div>

                    {/* Phase details under the bar */}
                    {isExpanded && hasDetails && (
                      <div className="mt-3 space-y-3">
                        {hasTasks && phase.tasks && (
                          <div className="space-y-2">
                            {phase.tasks.map((task, taskIdx) => (
                              <div
                                key={task}
                                className={`flex items-start gap-2 p-2.5 rounded-md border ${colors.border} ${colors.light} shadow-sm`}
                                data-testid={`task-${idx}-${taskIdx}`}
                              >
                                <Clock className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${colors.text}`} />
                                <span className={`text-xs leading-relaxed ${colors.text} font-medium`}>
                                  {task}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {hasDeliverables && phase.deliverables?.map((deliverable) => (
                          <div
                            key={deliverable}
                            className={`flex items-start gap-2 p-2.5 rounded-md border ${colors.border} ${colors.light} shadow-sm`}
                            data-testid={`deliverable-${deliverable}`}
                          >
                            <CheckCircle2 className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${colors.text}`} />
                            <span className={`text-xs leading-relaxed ${colors.text} font-medium`}>
                              {typeof deliverable === 'string' ? deliverable : String(deliverable)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Milestones */}
      {milestones && milestones.length > 0 && (
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">{t('visualization.gantt.criticalMilestones')}</h4>
              <p className="text-xs text-muted-foreground">{t('visualization.gantt.keyDecisionGates')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {milestones.map((milestone) => (
              <div
                key={milestone.name}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover-elevate active-elevate-2"
                data-testid={`gantt-milestone-${milestone.name}`}
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{milestone.name}</div>
                  {milestone.date && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" />
                      <span>{milestone.date}</span>
                    </div>
                  )}
                  {milestone.deliverable && (
                    <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                      <span className="font-medium text-foreground/70">{t('visualization.gantt.deliverable')}:</span> {milestone.deliverable}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
