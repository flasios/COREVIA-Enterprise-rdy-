import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Bug,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  FileCheck,
  FilePlus2,
  Flag,
  GitPullRequest,
  History,
  Milestone,
  Play,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AIEvidenceEvaluator, EvidenceUploader } from '../../smart-view';
import type { IssueData, ProjectData, RiskData, WbsTaskData } from '../../../types';
import { TaskAdvisorSimple } from './TaskExecutionPanels';

type VarianceStatus = 'ahead' | 'on_track' | 'delayed';

type TaskDetailSheetProps = {
  task: WbsTaskData | null;
  project: ProjectData;
  linkedRisks: RiskData[];
  linkedIssues: IssueData[];
  isUpdating: boolean;
  getStatusIcon: (status: string) => ReactNode;
  getStatusColor: (status: string) => string;
  getRiskColor: (level: string) => string;
  calculateVariance: (baselineDate?: string, actualOrPlannedDate?: string) => { days: number; status: VarianceStatus } | null;
  onClose: () => void;
  onEdit: (task: WbsTaskData) => void;
  onRequestChange: (task: WbsTaskData) => void;
  onQuickStatusChange: (taskId: string, status: WbsTaskData['status']) => void;
  onEvidenceUploadComplete: (taskId: string, evidence: {
    url?: string;
    fileName?: string;
    uploadedAt?: string;
    uploadedBy?: string;
  }) => void;
};

type TaskChangeHistoryEntry = {
  changeRequestCode?: string;
  appliedAt?: string;
  impactDays?: number;
  cumulativeVariance?: number;
  previousStartDate?: string;
  newStartDate?: string;
};

function parseChangeHistory(history: WbsTaskData['changeHistory']): TaskChangeHistoryEntry[] {
  if (typeof history === 'string') {
    try {
      const parsed = JSON.parse(history) as unknown;
      return Array.isArray(parsed) ? parsed as TaskChangeHistoryEntry[] : [];
    } catch {
      return [];
    }
  }

  return Array.isArray(history) ? history as TaskChangeHistoryEntry[] : [];
}

function daysBetween(startDate?: string, endDate?: string): number | null {
  if (!startDate || !endDate) return null;
  return Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
}

export function TaskDetailSheet({
  task,
  project,
  linkedRisks,
  linkedIssues,
  isUpdating,
  getStatusIcon,
  getStatusColor,
  getRiskColor,
  calculateVariance,
  onClose,
  onEdit,
  onRequestChange,
  onQuickStatusChange,
  onEvidenceUploadComplete,
}: TaskDetailSheetProps) {
  const changeHistory = parseChangeHistory(task?.changeHistory);

  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {task && (
          <>
            <SheetHeader className="pb-4 border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge className={getStatusColor(task.status || 'not_started')} variant="outline">
                    {getStatusIcon(task.status || 'not_started')}
                    <span className="ml-1">{task.status?.replace(/_/g, ' ') || 'Not Started'}</span>
                  </Badge>
                  <SheetTitle className="mt-2 text-xl">{task.taskName || task.title}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2 mt-1">
                    {task.wbsCode && (
                      <Badge variant="outline" className="font-mono text-xs">{task.wbsCode}</Badge>
                    )}
                    {task.priority && (
                      <Badge variant="outline" className={`text-xs ${
                        task.priority === 'critical' ? 'border-red-500/50 text-red-400' :
                        task.priority === 'high' ? 'border-orange-500/50 text-orange-400' :
                        task.priority === 'medium' ? 'border-amber-500/50 text-amber-400' :
                        ''
                      }`}>
                        <Flag className="w-3 h-3 mr-1" />
                        {task.priority}
                      </Badge>
                    )}
                    {task.taskType === 'milestone' && (
                      <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-400">
                        <Milestone className="w-3 h-3 mr-1" />
                        Milestone
                      </Badge>
                    )}
                  </SheetDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => onRequestChange(task)} data-testid="button-task-request-change">
                    <FilePlus2 className="w-4 h-4 mr-1" />
                    Request Change
                  </Button>
                  <Button size="sm" onClick={() => onEdit(task)}>
                    <Edit3 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </div>
            </SheetHeader>

            <div className="py-6 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Progress</span>
                  <span className="text-lg font-bold">{task.percentComplete || 0}%</span>
                </div>
                <Progress value={task.percentComplete || 0} className="h-3" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/40 rounded-lg border border-border">
                  <div className="text-xs text-muted-foreground mb-1">Planned Start</div>
                  <div className="font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    {task.plannedStartDate ? new Date(task.plannedStartDate).toLocaleDateString() : 'Not set'}
                  </div>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg border border-border">
                  <div className="text-xs text-muted-foreground mb-1">Planned End</div>
                  <div className="font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    {task.plannedEndDate ? new Date(task.plannedEndDate).toLocaleDateString() : 'Not set'}
                  </div>
                </div>
              </div>

              {(task.actualStartDate || task.actualEndDate || task.status === 'in_progress' || task.status === 'completed') && (
                <div className="p-4 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 rounded-lg border border-indigo-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-medium">Actual vs Planned Analysis</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <div className="text-[10px] uppercase tracking-wider text-blue-400 mb-1">Actual Start</div>
                        <div className="font-medium text-sm">
                          {task.actualStartDate ? new Date(task.actualStartDate).toLocaleDateString() :
                            task.status === 'in_progress' || task.status === 'completed' ? 'Not recorded' : 'Not started'}
                        </div>
                      </div>
                      <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <div className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1">Actual End</div>
                        <div className="font-medium text-sm">
                          {task.actualEndDate ? new Date(task.actualEndDate).toLocaleDateString() :
                            task.status === 'completed' ? 'Not recorded' : 'In progress'}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {(() => {
                        const startVariance = daysBetween(task.plannedStartDate, task.actualStartDate);
                        const endVariance = daysBetween(task.plannedEndDate, task.actualEndDate);

                        return (
                          <>
                            <div className={`p-3 rounded-lg border ${
                              startVariance === null ? 'bg-muted/40 border-border' :
                              startVariance > 0 ? 'bg-red-500/10 border-red-500/20' :
                              startVariance < 0 ? 'bg-emerald-500/10 border-emerald-500/20' :
                              'bg-blue-500/10 border-blue-500/20'
                            }`}>
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Start Variance</div>
                              <div className="font-medium text-sm flex items-center gap-1">
                                {startVariance === null ? (
                                  <span className="text-muted-foreground">--</span>
                                ) : startVariance > 0 ? (
                                  <><TrendingDown className="w-3 h-3 text-red-400" /><span className="text-red-400">+{startVariance} days late</span></>
                                ) : startVariance < 0 ? (
                                  <><TrendingUp className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">{Math.abs(startVariance)} days early</span></>
                                ) : (
                                  <span className="text-blue-400">On time</span>
                                )}
                              </div>
                            </div>
                            <div className={`p-3 rounded-lg border ${
                              endVariance === null ? 'bg-muted/40 border-border' :
                              endVariance > 0 ? 'bg-red-500/10 border-red-500/20' :
                              endVariance < 0 ? 'bg-emerald-500/10 border-emerald-500/20' :
                              'bg-blue-500/10 border-blue-500/20'
                            }`}>
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">End Variance</div>
                              <div className="font-medium text-sm flex items-center gap-1">
                                {endVariance === null ? (
                                  <span className="text-muted-foreground">--</span>
                                ) : endVariance > 0 ? (
                                  <><TrendingDown className="w-3 h-3 text-red-400" /><span className="text-red-400">+{endVariance} days late</span></>
                                ) : endVariance < 0 ? (
                                  <><TrendingUp className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">{Math.abs(endVariance)} days early</span></>
                                ) : (
                                  <span className="text-blue-400">On time</span>
                                )}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  {(() => {
                    const plannedDuration = daysBetween(task.plannedStartDate, task.plannedEndDate);
                    const actualDuration = daysBetween(task.actualStartDate, task.actualEndDate);
                    const durationVariance = plannedDuration !== null && actualDuration !== null ? actualDuration - plannedDuration : null;

                    if (plannedDuration === null && actualDuration === null) return null;

                    return (
                      <div className="pt-3 border-t border-border/50">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-4">
                            {plannedDuration !== null && (
                              <div>
                                <span className="text-muted-foreground">Planned Duration:</span>
                                <span className="font-medium ml-1">{plannedDuration} days</span>
                              </div>
                            )}
                            {actualDuration !== null && (
                              <div>
                                <span className="text-muted-foreground">Actual Duration:</span>
                                <span className="font-medium ml-1">{actualDuration} days</span>
                              </div>
                            )}
                          </div>
                          {durationVariance !== null && (
                            <Badge className={`${
                              durationVariance > 0 ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                              durationVariance < 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                              'bg-blue-500/20 text-blue-400 border-blue-500/30'
                            }`}>
                              {durationVariance > 0 ? `+${durationVariance} days over` :
                               durationVariance < 0 ? `${Math.abs(durationVariance)} days under` :
                               'On target'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {(task.baselineStartDate || task.baselineEndDate) && (
                <div className="p-4 bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-yellow-500/5 rounded-lg border border-amber-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold">Baseline vs Current Schedule</span>
                    </div>
                    {task.baselineLocked && (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                        <Shield className="w-3 h-3 mr-1" />
                        Baseline Locked
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 items-center">
                      <div className="p-2 bg-muted/50 rounded-lg border border-border/50">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Original Baseline Start</div>
                        <div className="font-medium text-sm">
                          {task.baselineStartDate ? new Date(task.baselineStartDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                      <div className="flex justify-center">
                        {(() => {
                          const startVariance = calculateVariance(task.baselineStartDate, task.plannedStartDate);
                          if (!startVariance) return <ArrowRight className="w-4 h-4 text-muted-foreground" />;
                          return (
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${
                              startVariance.status === 'delayed' ? 'bg-red-500/20 text-red-400' :
                              startVariance.status === 'ahead' ? 'bg-emerald-500/20 text-emerald-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {startVariance.status === 'delayed' ? (
                                <><TrendingDown className="w-3 h-3" />+{startVariance.days}d</>
                              ) : startVariance.status === 'ahead' ? (
                                <><TrendingUp className="w-3 h-3" />-{startVariance.days}d</>
                              ) : (
                                <CheckCircle2 className="w-3 h-3" />
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <div className="text-[10px] uppercase tracking-wider text-blue-400 mb-1">Current Planned Start</div>
                        <div className="font-medium text-sm">
                          {task.plannedStartDate ? new Date(task.plannedStartDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 items-center">
                      <div className="p-2 bg-muted/50 rounded-lg border border-border/50">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Original Baseline End</div>
                        <div className="font-medium text-sm">
                          {task.baselineEndDate ? new Date(task.baselineEndDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                      <div className="flex justify-center">
                        {(() => {
                          const endVariance = calculateVariance(task.baselineEndDate, task.plannedEndDate);
                          if (!endVariance) return <ArrowRight className="w-4 h-4 text-muted-foreground" />;
                          return (
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${
                              endVariance.status === 'delayed' ? 'bg-red-500/20 text-red-400' :
                              endVariance.status === 'ahead' ? 'bg-emerald-500/20 text-emerald-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {endVariance.status === 'delayed' ? (
                                <><TrendingDown className="w-3 h-3" />+{endVariance.days}d</>
                              ) : endVariance.status === 'ahead' ? (
                                <><TrendingUp className="w-3 h-3" />-{endVariance.days}d</>
                              ) : (
                                <CheckCircle2 className="w-3 h-3" />
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <div className="text-[10px] uppercase tracking-wider text-blue-400 mb-1">Current Planned End</div>
                        <div className="font-medium text-sm">
                          {task.plannedEndDate ? new Date(task.plannedEndDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const endVariance = calculateVariance(task.baselineEndDate, task.actualEndDate || task.plannedEndDate);
                    if (!endVariance) return null;
                    return (
                      <div className="mt-4 pt-3 border-t border-border/50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Overall Schedule Status:</span>
                          <Badge
                            className={`${
                              endVariance.status === 'delayed' ? 'bg-red-500/20 text-red-400 border-red-500/50' :
                              endVariance.status === 'ahead' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' :
                              'bg-blue-500/20 text-blue-400 border-blue-500/50'
                            }`}
                          >
                            {endVariance.status === 'delayed' ? (
                              <><TrendingDown className="w-3 h-3 mr-1" />{endVariance.days} days behind baseline</>
                            ) : endVariance.status === 'ahead' ? (
                              <><TrendingUp className="w-3 h-3 mr-1" />{endVariance.days} days ahead of baseline</>
                            ) : (
                              <><CheckCircle2 className="w-3 h-3 mr-1" />On Track</>
                            )}
                          </Badge>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {changeHistory.length > 0 && (
                <div className="p-4 bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-violet-500/5 rounded-lg border border-blue-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-semibold">Change History</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30">
                      {changeHistory.length} {changeHistory.length === 1 ? 'change' : 'changes'}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {changeHistory.map((entry, index) => (
                      <div key={index} className="relative pl-6 pb-3 last:pb-0">
                        {index < changeHistory.length - 1 && (
                          <div className="absolute left-[9px] top-4 bottom-0 w-px bg-blue-500/20" />
                        )}
                        <div className="absolute left-0 top-1 w-[18px] h-[18px] rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                          <GitPullRequest className="w-2.5 h-2.5 text-blue-400" />
                        </div>
                        <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
                          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {entry.changeRequestCode}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {entry.appliedAt ? new Date(entry.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {entry.impactDays != null ? (
                              <Badge className={`text-[10px] ${
                                entry.impactDays > 0 ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                entry.impactDays < 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                'bg-blue-500/20 text-blue-400 border-blue-500/30'
                              }`}>
                                {entry.impactDays > 0 ? '+' : ''}{entry.impactDays} days
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Impact not recorded</Badge>
                            )}
                            {entry.cumulativeVariance != null && (
                              <span className="text-[10px] text-muted-foreground">
                                Cumulative: {entry.cumulativeVariance > 0 ? '+' : ''}{entry.cumulativeVariance}d
                              </span>
                            )}
                          </div>
                          {(entry.previousStartDate || entry.newStartDate) && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {entry.previousStartDate && (
                                <span>
                                  {new Date(entry.previousStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                              {entry.previousStartDate && entry.newStartDate && (
                                <ArrowRight className="w-3 h-3 inline mx-1" />
                              )}
                              {entry.newStartDate && (
                                <span className="text-foreground">
                                  {new Date(entry.newStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-muted/40 rounded-lg border border-border">
                <div className="text-xs text-muted-foreground mb-2">Assigned To</div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{task.assignedTo || 'Unassigned'}</div>
                  </div>
                </div>
              </div>

              {task.description && (
                <div>
                  <div className="text-sm font-medium mb-2">Description</div>
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-medium">Task Evidence</span>
                  </div>
                  {task.evidenceUrl && (
                    task.evidenceVerificationStatus === 'approved' ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        <FileCheck className="mr-1 h-3 w-3" /> Approved by PMO
                      </Badge>
                    ) : task.evidenceVerificationStatus === 'rejected' ? (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <XCircle className="mr-1 h-3 w-3" /> Rejected
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        <Clock className="mr-1 h-3 w-3" /> Awaiting PMO Review
                      </Badge>
                    )
                  )}
                </div>

                {task.evidenceUrl && (
                  <div className={`p-4 rounded-lg border ${
                    task.evidenceVerificationStatus === 'approved'
                      ? 'bg-emerald-900/10 border-emerald-700/30'
                      : task.evidenceVerificationStatus === 'rejected'
                        ? 'bg-red-900/10 border-red-700/30'
                        : 'bg-amber-900/10 border-amber-700/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{task.evidenceFileName || 'Document'}</span>
                      <Button size="sm" variant="outline" asChild>
                        <a href={task.evidenceUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View
                        </a>
                      </Button>
                    </div>
                    {task.evidenceVerificationStatus === 'pending' && (
                      <p className="text-xs text-amber-500/80 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Submitted - waiting for PMO office review and approval
                      </p>
                    )}
                    {task.evidenceVerificationStatus === 'rejected' && task.evidenceVerificationNotes && (
                      <p className="text-xs text-red-400/80 mt-2">Rejection reason: {task.evidenceVerificationNotes}</p>
                    )}
                    {task.evidenceVerificationStatus === 'approved' && task.evidenceVerifiedAt && (
                      <p className="text-xs text-emerald-500/80 mt-2">Approved on {new Date(task.evidenceVerifiedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    )}
                    {task.evidenceNotes && (
                      <p className="text-xs text-muted-foreground mt-2">{task.evidenceNotes}</p>
                    )}
                  </div>
                )}

                <EvidenceUploader
                  taskId={task.id}
                  projectId={project.id}
                  onUploadComplete={(evidence) => onEvidenceUploadComplete(task.id, evidence)}
                  existingEvidence={task.evidenceUrl ? [{
                    id: `ev-${task.id}`,
                    taskId: task.id,
                    fileName: task.evidenceFileName || 'Document',
                    fileType: 'application/pdf',
                    fileSize: 0,
                    uploadedAt: new Date().toISOString(),
                    uploadedBy: 'system',
                    url: task.evidenceUrl,
                  }] : []}
                />

                <AIEvidenceEvaluator
                  task={task}
                  evidence={task.evidenceUrl ? [{
                    id: `ev-${task.id}`,
                    taskId: task.id,
                    fileName: task.evidenceFileName || 'Document',
                    fileType: 'application/pdf',
                    fileSize: 0,
                    uploadedAt: new Date().toISOString(),
                    uploadedBy: 'system',
                    url: task.evidenceUrl,
                  }] : []}
                />
              </div>

              {task.id && (
                <div className="pt-4 border-t border-border">
                  <TaskAdvisorSimple task={task} projectName={project.projectName} />
                </div>
              )}

              {linkedRisks.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Linked Risks ({linkedRisks.length})
                  </div>
                  <div className="space-y-2">
                    {linkedRisks.map((risk) => (
                      <div key={risk.id} className="p-3 bg-amber-900/10 rounded-lg border border-amber-700/30">
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs ${getRiskColor(risk.riskLevel || '')} text-white`}>
                            {risk.riskLevel}
                          </Badge>
                          <span className="text-sm font-medium">{risk.title}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {linkedIssues.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Bug className="w-4 h-4 text-red-500" />
                    Linked Issues ({linkedIssues.length})
                  </div>
                  <div className="space-y-2">
                    {linkedIssues.map((issue) => (
                      <div key={issue.id} className="p-3 bg-red-900/10 rounded-lg border border-red-700/30">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{issue.issueCode}</Badge>
                          <span className="text-sm font-medium">{issue.title}</span>
                          <Badge className={`text-xs ${
                            issue.priority === 'critical' ? 'bg-red-500' :
                            issue.priority === 'high' ? 'bg-orange-500' :
                            'bg-amber-500'
                          } text-white`}>
                            {issue.priority}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-border">
                <div className="text-sm font-medium mb-3">Quick Actions</div>
                <div className="flex flex-wrap gap-2">
                  {task.status !== 'in_progress' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onQuickStatusChange(task.id, 'in_progress')}
                      disabled={isUpdating}
                      className="gap-1"
                    >
                      <Play className="w-3 h-3" />
                      Start Task
                    </Button>
                  )}
                  {task.status !== 'completed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onQuickStatusChange(task.id, 'completed')}
                      disabled={isUpdating}
                      className="gap-1 text-emerald-600"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Mark Complete
                    </Button>
                  )}
                  {task.status !== 'blocked' && task.status !== 'completed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onQuickStatusChange(task.id, 'blocked')}
                      disabled={isUpdating}
                      className="gap-1 text-red-600"
                    >
                      <XCircle className="w-3 h-3" />
                      Report Blocker
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
