import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Eye,
  FileText,
  Flag,
  Flame,
  GitBranch,
  History,
  Layers,
  Lightbulb,
  Loader2,
  Milestone,
  Network,
  Play,
  Send,
  Shield,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { StakeholderData, WbsTaskData } from '../../../types';
import { isDescendantOf, type ChangeRequest, type ReviewAffectedTasksData } from './model';

type ChangeRequestDetailSheetProps = {
  changeRequest: ChangeRequest | null;
  tasks: WbsTaskData[];
  stakeholders: StakeholderData[];
  reviewAffectedTasksData: ReviewAffectedTasksData;
  isApproving: boolean;
  isRejecting: boolean;
  isImplementing: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onImplement: (id: string) => void;
};

export function ChangeRequestDetailSheet({
  changeRequest,
  tasks,
  stakeholders,
  reviewAffectedTasksData,
  isApproving,
  isRejecting,
  isImplementing,
  onClose,
  onApprove,
  onReject,
  onImplement,
}: ChangeRequestDetailSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet open={!!changeRequest} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
              {changeRequest && (
                <>
                  <SheetHeader className="pb-4 border-b border-border">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge variant="outline" className="font-mono mb-2">{changeRequest.code}</Badge>
                        <SheetTitle className="text-xl">{changeRequest.title}</SheetTitle>
                        <SheetDescription className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge className={`text-xs ${
                            changeRequest.changeType === 'timeline' ? 'bg-blue-500/20 text-blue-400' :
                            changeRequest.changeType === 'scope' ? 'bg-purple-500/20 text-purple-400' :
                            changeRequest.changeType === 'budget' ? 'bg-green-500/20 text-green-400' :
                            'bg-muted text-muted-foreground'
                          }`}>{changeRequest.changeType}</Badge>
                          <Badge className={`text-xs ${
                            changeRequest.impact === 'critical' ? 'bg-red-500/20 text-red-400' :
                            changeRequest.impact === 'high' ? 'bg-orange-500/20 text-orange-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>{changeRequest.impact} impact</Badge>
                          <Badge className={`text-xs ${
                            changeRequest.urgency === 'critical' ? 'bg-red-500/20 text-red-400' :
                            changeRequest.urgency === 'high' ? 'bg-orange-500/20 text-orange-400' :
                            changeRequest.urgency === 'normal' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-muted text-muted-foreground'
                          }`}>{changeRequest.urgency} urgency</Badge>
                        </SheetDescription>
                      </div>
                      <Badge className={`shrink-0 text-sm px-3 py-1 ${
                        changeRequest.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                        changeRequest.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        changeRequest.status === 'under_review' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-muted text-muted-foreground'
                      }`}>{changeRequest.status.replace(/_/g, ' ')}</Badge>
                    </div>
                  </SheetHeader>
    
                  <div className="py-6 space-y-6">
                    {/* Executive Summary Card */}
                    <div className="p-5 rounded-xl bg-gradient-to-br from-slate-900/50 via-blue-900/20 to-violet-900/20 border-2 border-violet-500/30">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                          <ClipboardCheck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base">Executive Summary</h3>
                          <p className="text-xs text-muted-foreground">Key information for decision makers</p>
                        </div>
                      </div>
    
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div className="p-3 bg-background/50 rounded-lg">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Requested By</div>
                          <div className="text-sm font-medium flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-blue-400" />
                            {changeRequest.requestedBy}
                          </div>
                        </div>
                        <div className="p-3 bg-background/50 rounded-lg">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Request Date</div>
                          <div className="text-sm font-medium flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-blue-400" />
                            {changeRequest.requestedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>
                        <div className="p-3 bg-background/50 rounded-lg">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Affected Tasks</div>
                          <div className="text-sm font-medium flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-amber-400" />
                            {changeRequest.affectedTasks?.length || 0} tasks
                          </div>
                        </div>
                        <div className="p-3 bg-background/50 rounded-lg">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Schedule Impact</div>
                          <div className={`text-sm font-bold flex items-center gap-1.5 ${
                            (changeRequest.estimatedScheduleImpact || 0) > 0 ? 'text-red-400' :
                            (changeRequest.estimatedScheduleImpact || 0) < 0 ? 'text-emerald-400' : ''
                          }`}>
                            <CalendarClock className="w-3.5 h-3.5" />
                            {changeRequest.estimatedScheduleImpact ?
                              `${changeRequest.estimatedScheduleImpact > 0 ? '+' : ''}${changeRequest.estimatedScheduleImpact} days` :
                              'No change'}
                          </div>
                        </div>
                      </div>
    
                      {/* Overall Impact Score */}
                      {(() => {
                        const taskCount = changeRequest.affectedTasks?.length || 0;
                        const scheduleImpact = Math.abs(changeRequest.estimatedScheduleImpact || 0);
                        const impactLevel = changeRequest.impact;
                        const urgencyLevel = changeRequest.urgency;
    
                        let score = 0;
                        if (impactLevel === 'critical') score += 40;
                        else if (impactLevel === 'high') score += 25;
                        else if (impactLevel === 'medium') score += 15;
                        else score += 5;
    
                        if (urgencyLevel === 'critical') score += 25;
                        else if (urgencyLevel === 'high') score += 15;
                        else if (urgencyLevel === 'normal') score += 8;
                        else score += 3;
    
                        score += Math.min(taskCount * 3, 20);
                        score += Math.min(scheduleImpact * 2, 15);
    
                        const riskLevel = score >= 70 ? 'Critical' : score >= 50 ? 'High' : score >= 30 ? 'Moderate' : 'Low';
                        const riskColor = score >= 70 ? 'red' : score >= 50 ? 'orange' : score >= 30 ? 'amber' : 'emerald';
    
                        return (
                          <div className="p-4 bg-background/30 rounded-lg border border-border/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Overall Project Impact</span>
                              <Badge className={`text-xs ${
                                riskColor === 'red' ? 'bg-red-500/20 text-red-400' :
                                riskColor === 'orange' ? 'bg-orange-500/20 text-orange-400' :
                                riskColor === 'amber' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-emerald-500/20 text-emerald-400'
                              }`}>{riskLevel} Risk</Badge>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-3 bg-muted/50 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    riskColor === 'red' ? 'bg-red-500' :
                                    riskColor === 'orange' ? 'bg-orange-500' :
                                    riskColor === 'amber' ? 'bg-amber-500' :
                                    'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(score, 100)}%` }}
                                />
                              </div>
                              <span className={`text-lg font-bold ${
                                riskColor === 'red' ? 'text-red-400' :
                                riskColor === 'orange' ? 'text-orange-400' :
                                riskColor === 'amber' ? 'text-amber-400' :
                                'text-emerald-400'
                              }`}>{score}/100</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2">
                              Based on impact level, urgency, affected tasks, and schedule shift
                            </p>
                          </div>
                        );
                      })()}
                    </div>
    
                    {/* Original vs Proposed Comparison */}
                    {(changeRequest.originalValue || changeRequest.proposedValue) && (
                      <div className="p-4 rounded-xl border-2 border-blue-500/30 bg-blue-500/5">
                        <div className="flex items-center gap-2 mb-4">
                          <ArrowLeftRight className="w-5 h-5 text-blue-400" />
                          <span className="font-semibold">Original vs Proposed Comparison</span>
                        </div>
                        <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
                          <div className="p-4 bg-background/60 rounded-lg">
                            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Original
                            </div>
                            {changeRequest.originalValue?.endDate && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">End Date:</span>
                                <span className="font-semibold ml-2">{new Date(changeRequest.originalValue.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              </div>
                            )}
                            {changeRequest.originalValue?.startDate && (
                              <div className="text-sm mt-1">
                                <span className="text-muted-foreground">Start Date:</span>
                                <span className="font-semibold ml-2">{new Date(changeRequest.originalValue.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              </div>
                            )}
                            {changeRequest.originalValue?.budget && (
                              <div className="text-sm mt-1">
                                <span className="text-muted-foreground">Budget:</span>
                                <span className="font-semibold ml-2">${changeRequest.originalValue.budget.toLocaleString()}</span>
                              </div>
                            )}
                            {changeRequest.originalValue?.scope && (
                              <div className="text-sm mt-1">
                                <span className="text-muted-foreground">Scope:</span>
                                <span className="ml-2">{changeRequest.originalValue.scope}</span>
                              </div>
                            )}
                          </div>
    
                          <div className="flex flex-col items-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              (changeRequest.estimatedScheduleImpact || 0) > 0 ? 'bg-red-500/20' :
                              (changeRequest.estimatedScheduleImpact || 0) < 0 ? 'bg-emerald-500/20' :
                              'bg-muted/50'
                            }`}>
                              <ArrowRight className={`w-6 h-6 ${
                                (changeRequest.estimatedScheduleImpact || 0) > 0 ? 'text-red-400' :
                                (changeRequest.estimatedScheduleImpact || 0) < 0 ? 'text-emerald-400' :
                                'text-muted-foreground'
                              }`} />
                            </div>
                            {changeRequest.estimatedScheduleImpact !== 0 && (
                              <span className={`text-xs font-bold mt-1 ${
                                (changeRequest.estimatedScheduleImpact || 0) > 0 ? 'text-red-400' : 'text-emerald-400'
                              }`}>
                                {(changeRequest.estimatedScheduleImpact || 0) > 0 ? '+' : ''}{changeRequest.estimatedScheduleImpact}d
                              </span>
                            )}
                          </div>
    
                          <div className={`p-4 rounded-lg ${
                            (changeRequest.estimatedScheduleImpact || 0) > 0 ? 'bg-red-500/10 border border-red-500/30' :
                            (changeRequest.estimatedScheduleImpact || 0) < 0 ? 'bg-emerald-500/10 border border-emerald-500/30' :
                            'bg-background/60'
                          }`}>
                            <div className={`text-xs uppercase tracking-wide mb-2 flex items-center gap-1 ${
                              (changeRequest.estimatedScheduleImpact || 0) > 0 ? 'text-red-400' :
                              (changeRequest.estimatedScheduleImpact || 0) < 0 ? 'text-emerald-400' :
                              'text-muted-foreground'
                            }`}>
                              <Target className="w-3 h-3" /> Proposed
                            </div>
                            {changeRequest.proposedValue?.endDate && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">End Date:</span>
                                <span className={`font-bold ml-2 ${
                                  (changeRequest.estimatedScheduleImpact || 0) > 0 ? 'text-red-400' :
                                  (changeRequest.estimatedScheduleImpact || 0) < 0 ? 'text-emerald-400' : ''
                                }`}>{new Date(changeRequest.proposedValue.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              </div>
                            )}
                            {changeRequest.proposedValue?.startDate && (
                              <div className="text-sm mt-1">
                                <span className="text-muted-foreground">Start Date:</span>
                                <span className="font-semibold ml-2">{new Date(changeRequest.proposedValue.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              </div>
                            )}
                            {changeRequest.proposedValue?.budget && (
                              <div className="text-sm mt-1">
                                <span className="text-muted-foreground">Budget:</span>
                                <span className="font-semibold ml-2">${changeRequest.proposedValue.budget.toLocaleString()}</span>
                              </div>
                            )}
                            {changeRequest.proposedValue?.scope && (
                              <div className="text-sm mt-1">
                                <span className="text-muted-foreground">Scope:</span>
                                <span className="ml-2">{changeRequest.proposedValue.scope}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
    
                    {/* Description and Justification */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
                        <div className="text-sm font-medium mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          Description
                        </div>
                        <p className="text-sm text-muted-foreground">{changeRequest.description}</p>
                      </div>
                      <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
                        <div className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-amber-400" />
                          Business Justification
                        </div>
                        <p className="text-sm text-muted-foreground">{changeRequest.justification}</p>
                      </div>
                    </div>
    
                    {/* Change History Timeline */}
                    <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
                      <div className="text-sm font-medium mb-4 flex items-center gap-2">
                        <History className="w-4 h-4 text-primary" />
                        Change History
                      </div>
                      <div className="relative pl-6 space-y-4">
                        {/* Vertical timeline line */}
                        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
    
                        {/* Submitted Event - Always shown */}
                        <div className="relative flex items-start gap-3">
                          <div className="absolute -left-6 w-6 h-6 rounded-full bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center">
                            <FileText className="w-3 h-3 text-blue-500" />
                          </div>
                          <div className="flex-1 pt-0.5">
                            <div className="text-sm font-medium">Submitted</div>
                            <div className="text-xs text-muted-foreground">
                              By {changeRequest.requestedBy} on {changeRequest.requestedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
    
                        {/* Reviewed Event */}
                        {changeRequest.reviewedAt && (
                          <div className="relative flex items-start gap-3">
                            <div className="absolute -left-6 w-6 h-6 rounded-full bg-purple-500/20 border-2 border-purple-500 flex items-center justify-center">
                              <Eye className="w-3 h-3 text-purple-500" />
                            </div>
                            <div className="flex-1 pt-0.5">
                              <div className="text-sm font-medium">Under Review</div>
                              <div className="text-xs text-muted-foreground">
                                By {changeRequest.reviewedBy || 'Reviewer'} on {changeRequest.reviewedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        )}
    
                        {/* Approved Event */}
                        {changeRequest.approvedAt && (
                          <div className="relative flex items-start gap-3">
                            <div className="absolute -left-6 w-6 h-6 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            </div>
                            <div className="flex-1 pt-0.5">
                              <div className="text-sm font-medium">Approved</div>
                              <div className="text-xs text-muted-foreground">
                                By {changeRequest.approvedBy || 'Approver'} on {changeRequest.approvedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        )}
    
                        {/* Rejected Event */}
                        {changeRequest.status === 'rejected' && changeRequest.rejectionReason && (
                          <div className="relative flex items-start gap-3">
                            <div className="absolute -left-6 w-6 h-6 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
                              <XCircle className="w-3 h-3 text-red-500" />
                            </div>
                            <div className="flex-1 pt-0.5">
                              <div className="text-sm font-medium">Rejected</div>
                              <div className="text-xs text-muted-foreground">
                                Reason: {changeRequest.rejectionReason}
                              </div>
                            </div>
                          </div>
                        )}
    
                        {/* Implemented Event */}
                        {changeRequest.implementedAt && (
                          <div className="relative flex items-start gap-3">
                            <div className="absolute -left-6 w-6 h-6 rounded-full bg-cyan-500/20 border-2 border-cyan-500 flex items-center justify-center">
                              <Zap className="w-3 h-3 text-cyan-500" />
                            </div>
                            <div className="flex-1 pt-0.5">
                              <div className="text-sm font-medium">Implemented</div>
                              <div className="text-xs text-muted-foreground">
                                By {changeRequest.implementedBy || 'System'} on {changeRequest.implementedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                              {changeRequest.implementationNotes && (
                                <div className="mt-1 text-xs bg-cyan-500/10 p-2 rounded border border-cyan-500/20">
                                  <span className="font-medium">Notes:</span> {changeRequest.implementationNotes}
                                </div>
                              )}
                              {changeRequest.changeType === 'timeline' && changeRequest.estimatedScheduleImpact && (
                                <div className="mt-1 text-xs bg-amber-500/10 p-2 rounded border border-amber-500/20">
                                  <span className="font-medium">Timeline Impact:</span> {changeRequest.estimatedScheduleImpact > 0 ? '+' : ''}{changeRequest.estimatedScheduleImpact} days applied to {changeRequest.affectedTasks?.length || 0} tasks
                                </div>
                              )}
                            </div>
                          </div>
                        )}
    
                        {/* Pending status indicator */}
                        {!changeRequest.implementedAt && changeRequest.status !== 'rejected' && (
                          <div className="relative flex items-start gap-3">
                            <div className="absolute -left-6 w-6 h-6 rounded-full bg-muted border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                            </div>
                            <div className="flex-1 pt-0.5">
                              <div className="text-sm font-medium text-muted-foreground">
                                {changeRequest.status === 'approved' ? 'Awaiting Implementation' :
                                 changeRequest.status === 'under_review' ? 'Awaiting Approval' :
                                 changeRequest.status === 'submitted' ? 'Awaiting Review' :
                                 'Pending'}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
    
                    {/* Project Delay Impact Calculator */}
                    {(() => {
                      const scheduleImpact = changeRequest.estimatedScheduleImpact || 0;
    
                      // Find the latest task end date as current project end date
                      const taskEndDates = tasks
                        .filter(t => t.plannedEndDate)
                        .map(t => new Date(t.plannedEndDate!).getTime());
                      const currentProjectEndDate = taskEndDates.length > 0
                        ? new Date(Math.max(...taskEndDates))
                        : null;
    
                      const proposedProjectEndDate = currentProjectEndDate && scheduleImpact
                        ? new Date(currentProjectEndDate.getTime() + scheduleImpact * 24 * 60 * 60 * 1000)
                        : null;
    
                      const delayDays = scheduleImpact;
    
                      // Determine severity: green = early/on-time, amber = 1-7 days, red = 7+ days
                      const severity: 'green' | 'amber' | 'red' =
                        delayDays <= 0 ? 'green' :
                        delayDays <= 7 ? 'amber' : 'red';
    
                      const severityColors = {
                        green: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-500', icon: TrendingDown },
                        amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-500', icon: AlertTriangle },
                        red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-500', icon: Flame }
                      };
    
                      const colors = severityColors[severity];
                      const SeverityIcon = colors.icon;
    
                      return currentProjectEndDate ? (
                        <div className={`p-4 rounded-lg border-2 ${colors.bg} ${colors.border}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <SeverityIcon className={`w-5 h-5 ${colors.text}`} />
                            <span className="font-medium">Project Delay Impact</span>
                            <Badge className={`text-xs ml-auto ${
                              severity === 'green' ? 'bg-emerald-500/20 text-emerald-500' :
                              severity === 'amber' ? 'bg-amber-500/20 text-amber-500' :
                              'bg-red-500/20 text-red-500'
                            }`}>
                              {severity === 'green' ? 'On Track' : severity === 'amber' ? 'Minor Delay' : 'Significant Delay'}
                            </Badge>
                          </div>
    
                          <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 bg-background/50 rounded-lg">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Current End Date</div>
                              <div className="font-medium text-sm">
                                {currentProjectEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                            </div>
                            <div className="p-3 bg-background/50 rounded-lg">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Proposed End Date</div>
                              <div className={`font-medium text-sm ${colors.text}`}>
                                {proposedProjectEndDate
                                  ? proposedProjectEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                  : 'No Change'}
                              </div>
                            </div>
                            <div className="p-3 bg-background/50 rounded-lg">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total Delay</div>
                              <div className={`font-bold text-lg ${colors.text}`}>
                                {delayDays > 0 ? '+' : ''}{delayDays} days
                              </div>
                            </div>
                          </div>
    
                          {/* Visual Progress Bar showing delay proportion */}
                          {delayDays !== 0 && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                                <span>Project Timeline Impact</span>
                                <span>{Math.abs(delayDays)} days {delayDays > 0 ? 'extension' : 'reduction'}</span>
                              </div>
                              <div className="h-2 bg-background/50 rounded-full overflow-hidden relative">
                                <div
                                  className={`h-full rounded-full ${
                                    delayDays > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.abs(delayDays) * 5)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ) : changeRequest.estimatedScheduleImpact ? (
                        <div className="p-3 bg-muted/40 rounded-lg border border-border">
                          <div className="text-xs text-muted-foreground mb-1">Schedule Impact</div>
                          <div className="font-medium flex items-center gap-2">
                            <CalendarDays className="w-4 h-4" />
                            {changeRequest.estimatedScheduleImpact > 0 ? '+' : ''}{changeRequest.estimatedScheduleImpact} days
                          </div>
                        </div>
                      ) : null;
                    })()}
    
                    {/* PMO Decision Dashboard - Matches Form's Impact Analysis Design */}
                    {(() => {
                      const affectedTaskIds = changeRequest.affectedTasks || [];
                      const scheduleImpact = changeRequest.estimatedScheduleImpact || 0;
    
                      // Build task map for quick lookup
                      const taskMap = new Map<string, WbsTaskData>();
                      const wbsCodeToIdMap = new Map<string, string>();
                      tasks.forEach(t => {
                        taskMap.set(t.id, t);
                        if (t.wbsCode) wbsCodeToIdMap.set(t.wbsCode, t.id);
                        if (t.id) wbsCodeToIdMap.set(t.id, t.id);
                      });
    
                      // Build successors map for dependency chain calculation
                      // Filters out parent-child rollup links from summary tasks
                      const successorsMap = new Map<string, string[]>();
                      tasks.forEach(t => {
                        if (t.predecessors && Array.isArray(t.predecessors)) {
                          t.predecessors.forEach((pred: string | { taskId?: string; taskCode?: string }) => {
                            const predRef = typeof pred === 'string' ? pred : pred.taskId || pred.taskCode;
                            if (!predRef) return;
                            const resolvedId = wbsCodeToIdMap.get(predRef) || predRef;
                            // Skip if the predecessor is a descendant of this task (parent-child rollup)
                            if (isDescendantOf(resolvedId, t.id, taskMap)) return;
                            if (!successorsMap.has(resolvedId)) {
                              successorsMap.set(resolvedId, []);
                            }
                            successorsMap.get(resolvedId)!.push(t.id);
                          });
                        }
                      });
    
                      // Get direct affected tasks
                      const directTaskDetails = affectedTaskIds
                        .map(id => taskMap.get(id))
                        .filter((t): t is WbsTaskData => !!t);
    
                      // Calculate downstream/indirect dependencies via BFS (matching form logic)
                      const indirectTaskDetails: WbsTaskData[] = [];
                      const visited = new Set<string>(affectedTaskIds);
                      const queue = [...affectedTaskIds];
    
                      while (queue.length > 0) {
                        const currentId = queue.shift()!;
                        const successors = successorsMap.get(currentId) || [];
                        for (const successorId of successors) {
                          if (visited.has(successorId)) continue;
                          visited.add(successorId);
                          const task = taskMap.get(successorId);
                          if (task) {
                            indirectTaskDetails.push(task);
                            queue.push(successorId);
                          }
                        }
                      }
    
                      // All affected tasks (direct + downstream)
                      const allAffectedTasks = [...directTaskDetails, ...indirectTaskDetails];
    
                      // Calculate resource impact - group by assignee
                      const resourceImpact = new Map<string, {
                        assignee: string;
                        tasks: WbsTaskData[];
                        totalDaysShift: number;
                        criticalTasks: number;
                      }>();
    
                      allAffectedTasks.forEach(task => {
                        const assignee = task.assignedTo || 'Unassigned';
                        if (!resourceImpact.has(assignee)) {
                          resourceImpact.set(assignee, {
                            assignee,
                            tasks: [],
                            totalDaysShift: 0,
                            criticalTasks: 0
                          });
                        }
                        const data = resourceImpact.get(assignee)!;
                        data.tasks.push(task);
                        data.totalDaysShift += scheduleImpact;
                        if (task.priority === 'critical' || task.priority === 'high') {
                          data.criticalTasks++;
                        }
                      });
    
                      // Calculate key milestones affected
                      const milestonesAffected = allAffectedTasks.filter(t =>
                        t.taskType === 'milestone' || t.isMilestone
                      );
    
                      // Calculate project end date impact (matching form logic)
                      const projectEndInfo = tasks.reduce<{ maxEndDate: Date | null; criticalTaskId: string | null }>(
                        (acc, t) => {
                          if (t.plannedEndDate) {
                            const endDate = new Date(t.plannedEndDate);
                            if (!acc.maxEndDate || endDate > acc.maxEndDate) {
                              return { maxEndDate: endDate, criticalTaskId: t.id };
                            }
                          }
                          return acc;
                        },
                        { maxEndDate: null, criticalTaskId: null }
                      );
    
                      let projectEndDateShift = 0;
                      let newProjectEnd: Date | null = projectEndInfo.maxEndDate ? new Date(projectEndInfo.maxEndDate) : null;
    
                      if (projectEndInfo.maxEndDate && scheduleImpact > 0) {
                        const allAffectedIds = allAffectedTasks.map(t => t.id);
                        for (const taskId of allAffectedIds) {
                          const task = taskMap.get(taskId);
                          if (task?.plannedEndDate) {
                            const taskEnd = new Date(task.plannedEndDate);
                            const newTaskEnd = new Date(taskEnd.getTime() + scheduleImpact * 24 * 60 * 60 * 1000);
                            if (newTaskEnd > projectEndInfo.maxEndDate) {
                              const daysDiff = Math.ceil((newTaskEnd.getTime() - projectEndInfo.maxEndDate.getTime()) / (1000 * 60 * 60 * 24));
                              if (daysDiff > projectEndDateShift) {
                                projectEndDateShift = daysDiff;
                                newProjectEnd = newTaskEnd;
                              }
                            }
                            if (taskId === projectEndInfo.criticalTaskId) {
                              projectEndDateShift = Math.max(projectEndDateShift, scheduleImpact);
                              newProjectEnd = new Date(projectEndInfo.maxEndDate.getTime() + scheduleImpact * 24 * 60 * 60 * 1000);
                            }
                          }
                        }
                      }
    
                      // Stakeholders to notify (based on stakeholders prop)
                      const stakeholdersToNotify = stakeholders.filter(s =>
                        s.role === 'sponsor' || s.role === 'owner' || s.influenceLevel === 'high'
                      );
    
                      return (
                        <div className="space-y-4">
                          {/* Impact Analysis Header - Matches Form Design */}
                          <div className="relative overflow-hidden rounded-xl border-2 border-violet-500/40 bg-gradient-to-br from-indigo-900/30 via-purple-900/20 to-pink-900/15 p-6">
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500" />
                            <div className="absolute bottom-0 right-0 w-48 h-48 bg-gradient-to-tl from-violet-500/15 to-transparent rounded-full blur-3xl" />
    
                            <div className="relative z-10">
                              <div className="flex items-center gap-3 mb-5">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-pink-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                                  <Network className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-base font-bold">Impact Analysis: All Affected Tasks</h3>
                                  <p className="text-xs text-muted-foreground">Auto-detected downstream dependencies with timeline impact</p>
                                </div>
                                <Badge className="bg-violet-500/30 text-violet-300 text-xs px-3 py-1">
                                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                                  AI Detected
                                </Badge>
                              </div>
    
                              {/* Impact Metrics Dashboard - Matches Form's 4-Column Layout */}
                              <div className="grid grid-cols-4 gap-4">
                                <div className="p-4 rounded-xl bg-blue-500/15 border border-blue-500/30 text-center">
                                  <div className="text-3xl font-bold text-blue-400">{directTaskDetails.length}</div>
                                  <div className="text-xs text-blue-300/80 font-medium mt-1">Primary Tasks</div>
                                </div>
                                <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-center">
                                  <div className="text-3xl font-bold text-amber-400">{indirectTaskDetails.length}</div>
                                  <div className="text-xs text-amber-300/80 font-medium mt-1">Downstream</div>
                                </div>
                                <div className="p-4 rounded-xl bg-violet-500/15 border border-violet-500/30 text-center">
                                  <div className="text-3xl font-bold text-violet-400">{allAffectedTasks.length}</div>
                                  <div className="text-xs text-violet-300/80 font-medium mt-1">Total Affected</div>
                                </div>
                                <div className={`p-4 rounded-xl border text-center ${
                                  scheduleImpact > 0 ? 'bg-red-500/15 border-red-500/30' :
                                  scheduleImpact < 0 ? 'bg-emerald-500/15 border-emerald-500/30' :
                                  'bg-muted/30 border-border'
                                }`}>
                                  <div className={`text-3xl font-bold ${
                                    scheduleImpact > 0 ? 'text-red-400' :
                                    scheduleImpact < 0 ? 'text-emerald-400' :
                                    'text-muted-foreground'
                                  }`}>
                                    {scheduleImpact === 0 ? '—' : `${scheduleImpact > 0 ? '+' : ''}${scheduleImpact}d`}
                                  </div>
                                  <div className="text-xs text-muted-foreground font-medium mt-1">Days Shift</div>
                                </div>
                              </div>
                            </div>
                          </div>
    
                          {/* Project End Date Impact - Matches Form Design */}
                          {projectEndInfo.maxEndDate && scheduleImpact !== 0 && (
                            <div className={`relative overflow-hidden rounded-xl p-4 ${
                              projectEndDateShift > 0
                                ? 'bg-gradient-to-r from-red-500/10 via-orange-500/5 to-transparent border border-red-500/30'
                                : 'bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/30'
                            }`}>
                              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full blur-2xl" />
                              <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    projectEndDateShift > 0 ? 'bg-red-500/20' : 'bg-emerald-500/20'
                                  }`}>
                                    <Flag className={`w-4 h-4 ${
                                      projectEndDateShift > 0 ? 'text-red-400' : 'text-emerald-400'
                                    }`} />
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold">Project Completion Impact</div>
                                    <div className="text-[10px] text-muted-foreground">Effect on overall project timeline</div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center">
                                  <div className="text-center p-2 bg-background/40 rounded-lg">
                                    <div className="text-[10px] text-muted-foreground mb-1">Current End</div>
                                    <div className="text-sm font-semibold">
                                      {projectEndInfo.maxEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                  </div>
                                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                  <div className={`text-center p-2 rounded-lg ${
                                    projectEndDateShift > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'
                                  }`}>
                                    <div className="text-[10px] text-muted-foreground mb-1">New End</div>
                                    <div className={`text-sm font-semibold ${
                                      projectEndDateShift > 0 ? 'text-red-400' : 'text-emerald-400'
                                    }`}>
                                      {newProjectEnd?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                  </div>
                                </div>
                                {projectEndDateShift > 0 && (
                                  <div className="mt-3 flex justify-center">
                                    <Badge className="bg-red-500/20 text-red-400 text-xs px-3 py-1">
                                      <TrendingUp className="w-3 h-3 mr-1" />
                                      +{projectEndDateShift} days to completion
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
    
                          {/* Complete Task Timeline Table - Matches Form Design */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <GitBranch className="w-4 h-4 text-violet-400" />
                                {t('projectWorkspace.toast.completeTaskTimeline', { count: allAffectedTasks.length })}
                              </div>
                              {scheduleImpact !== 0 && (
                                <Badge className={`text-xs ${scheduleImpact > 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                  {scheduleImpact > 0 ? t('projectWorkspace.toast.delayed') : t('projectWorkspace.toast.advanced')} {t('projectWorkspace.toast.byDaysEach', { count: Math.abs(scheduleImpact) })}
                                </Badge>
                              )}
                            </div>
    
                            {/* Table Header */}
                            <div className="grid grid-cols-[60px,80px,1fr,100px,90px,90px,90px,90px,60px] gap-2 px-3 py-2 bg-muted/50 rounded-t-lg border border-border text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              <div>Type</div>
                              <div>WBS Code</div>
                              <div>Task Name</div>
                              <div>Assignee</div>
                              <div>Orig Start</div>
                              <div>Orig End</div>
                              <div>New Start</div>
                              <div>New End</div>
                              <div className="text-center">Shift</div>
                            </div>
    
                            {/* Task Rows */}
                            <ScrollArea className="h-[300px] border border-border border-t-0 rounded-b-lg">
                              {allAffectedTasks.map((task, idx) => {
                                const origStart = task.plannedStartDate ? new Date(task.plannedStartDate) : null;
                                const origEnd = task.plannedEndDate ? new Date(task.plannedEndDate) : null;
                                const newStart = origStart ? new Date(origStart.getTime() + scheduleImpact * 24 * 60 * 60 * 1000) : null;
                                const newEnd = origEnd ? new Date(origEnd.getTime() + scheduleImpact * 24 * 60 * 60 * 1000) : null;
                                const isMilestone = task.taskType === 'milestone' || task.isMilestone;
                                const isDirect = directTaskDetails.some(d => d.id === task.id);
    
                                return (
                                  <div
                                    key={task.id}
                                    className={`grid grid-cols-[60px,80px,1fr,100px,90px,90px,90px,90px,60px] gap-2 px-3 py-2 text-xs border-b border-border/50 ${
                                      idx % 2 === 0 ? 'bg-background/30' : 'bg-background/10'
                                    } ${isMilestone ? 'bg-amber-500/10' : ''}`}
                                  >
                                    <div>
                                      <Badge className={`text-[8px] px-1 ${
                                        isDirect ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
                                      }`}>
                                        {isDirect ? 'Primary' : 'Chain'}
                                      </Badge>
                                    </div>
                                    <div className="font-mono text-[10px] text-muted-foreground">{task.wbsCode || '—'}</div>
                                    <div className="font-medium truncate flex items-center gap-1">
                                      {isMilestone && <Milestone className="w-3 h-3 text-amber-500 shrink-0" />}
                                      {task.taskName || task.title}
                                    </div>
                                    <div className="text-muted-foreground truncate">{task.assignedTo || '—'}</div>
                                    <div className="text-muted-foreground">
                                      {origStart?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || '—'}
                                    </div>
                                    <div className="text-muted-foreground">
                                      {origEnd?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || '—'}
                                    </div>
                                    <div className={`font-medium ${scheduleImpact > 0 ? 'text-amber-500' : scheduleImpact < 0 ? 'text-emerald-500' : ''}`}>
                                      {newStart?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || '—'}
                                    </div>
                                    <div className={`font-medium ${scheduleImpact > 0 ? 'text-amber-500' : scheduleImpact < 0 ? 'text-emerald-500' : ''}`}>
                                      {newEnd?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || '—'}
                                    </div>
                                    <div className="text-center">
                                      <Badge className={`text-[9px] px-1.5 ${
                                        scheduleImpact > 0 ? 'bg-red-500/20 text-red-400' :
                                        scheduleImpact < 0 ? 'bg-emerald-500/20 text-emerald-400' :
                                        'bg-muted text-muted-foreground'
                                      }`}>
                                        {scheduleImpact > 0 ? '+' : ''}{scheduleImpact}d
                                      </Badge>
                                    </div>
                                  </div>
                                );
                              })}
                            </ScrollArea>
                          </div>
    
                          {/* Resource Impact Summary */}
                          {resourceImpact.size > 0 && (
                            <div className="p-4 rounded-xl border-2 border-blue-500/30 bg-blue-500/5">
                              <div className="flex items-center gap-2 mb-3">
                                <Users className="w-5 h-5 text-blue-400" />
                                <span className="font-bold">Resource Impact Summary</span>
                                <Badge variant="outline" className="ml-auto text-[9px]">{resourceImpact.size} team members</Badge>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {Array.from(resourceImpact.values()).map(({ assignee, tasks: assigneeTasks, criticalTasks }) => (
                                  <div key={assignee} className="p-3 bg-background/50 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-medium text-sm">{assignee}</span>
                                      <Badge variant="outline" className="text-[9px]">{assigneeTasks.length} tasks</Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px]">
                                      {criticalTasks > 0 && (
                                        <Badge className="bg-red-500/20 text-red-400 text-[9px]">{criticalTasks} critical/high</Badge>
                                      )}
                                      <span className="text-muted-foreground">
                                        {scheduleImpact > 0 ? '+' : ''}{scheduleImpact}d per task
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
    
                          {/* Stakeholder Notification Checklist */}
                          {stakeholdersToNotify.length > 0 && (
                            <div className="p-4 rounded-xl border-2 border-purple-500/30 bg-purple-500/5">
                              <div className="flex items-center gap-2 mb-3">
                                <Send className="w-5 h-5 text-purple-400" />
                                <span className="font-bold">Stakeholder Communication Required</span>
                                <Badge className="bg-purple-500/20 text-purple-400 text-[9px] ml-auto">{stakeholdersToNotify.length} stakeholders</Badge>
                              </div>
                              <div className="space-y-2">
                                {stakeholdersToNotify.map((stakeholder, idx) => (
                                  <div key={idx} className="flex items-center gap-3 p-2 bg-background/50 rounded">
                                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                                      <Users className="w-4 h-4 text-purple-400" />
                                    </div>
                                    <div className="flex-1">
                                      <div className="text-sm font-medium">{stakeholder.name}</div>
                                      <div className="text-[10px] text-muted-foreground">{stakeholder.role} • {stakeholder.organization || 'N/A'}</div>
                                    </div>
                                    <Badge variant="outline" className="text-[9px]">{stakeholder.influenceLevel || 'normal'}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
    
                          {/* Implementation Readiness Checklist */}
                          <div className="p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5">
                            <div className="flex items-center gap-2 mb-3">
                              <ClipboardCheck className="w-5 h-5 text-emerald-400" />
                              <span className="font-bold">Implementation Readiness</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span className="text-sm">All affected tasks identified ({directTaskDetails.length} primary + {indirectTaskDetails.length} downstream)</span>
                              </div>
                              <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span className="text-sm">Schedule impact calculated ({scheduleImpact > 0 ? '+' : ''}{scheduleImpact} days)</span>
                              </div>
                              <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
                                {resourceImpact.size > 0 ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                                )}
                                <span className="text-sm">Resource assignments reviewed ({resourceImpact.size} team members)</span>
                              </div>
                              <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
                                {milestonesAffected.length === 0 ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                                )}
                                <span className="text-sm">
                                  Milestone impact: {milestonesAffected.length === 0 ? 'No milestones affected' : `${milestonesAffected.length} milestone(s) will shift`}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
                                {projectEndDateShift > 0 ? (
                                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                )}
                                <span className="text-sm">
                                  {projectEndDateShift > 0
                                    ? `Project end date will be delayed by ${projectEndDateShift} days`
                                    : 'No impact on project completion date'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
    
                    {/* Risk Assessment Section */}
                    {(() => {
                      const affectedTaskIds = changeRequest.affectedTasks || [];
                      const scheduleImpact = changeRequest.estimatedScheduleImpact || 0;
                      const impactLevel = changeRequest.impact;
    
                      // Build dependency map to find successors
                      const wbsCodeToIdMap = new Map<string, string>();
                      const riskTaskMap = new Map<string, WbsTaskData>();
                      tasks.forEach(t => {
                        if (t.wbsCode) wbsCodeToIdMap.set(t.wbsCode, t.id);
                        if (t.id) wbsCodeToIdMap.set(t.id, t.id);
                        riskTaskMap.set(t.id, t);
                      });
    
                      const affectedSet = new Set(affectedTaskIds);
                      const successorTasks: WbsTaskData[] = [];
    
                      tasks.forEach(t => {
                        if (affectedSet.has(t.id)) return;
                        if (t.predecessors && Array.isArray(t.predecessors)) {
                          const hasDep = t.predecessors.some((pred: string | { taskId?: string; taskCode?: string }) => {
                            const predRef = typeof pred === 'string' ? pred : pred.taskId || pred.taskCode;
                            if (!predRef) return false;
                            const resolvedId = wbsCodeToIdMap.get(predRef) || predRef;
                            // Skip parent-child rollup links (summary tasks listing descendants as predecessors)
                            if (isDescendantOf(resolvedId, t.id, riskTaskMap)) return false;
                            return affectedSet.has(resolvedId);
                          });
                          if (hasDep) successorTasks.push(t);
                        }
                      });
    
                      // Generate risk list
                      const risks: Array<{ severity: 'critical' | 'high' | 'medium' | 'low'; title: string; description: string }> = [];
    
                      // Risk based on number of tasks
                      if (affectedTaskIds.length >= 10) {
                        risks.push({
                          severity: 'critical',
                          title: 'Broad Scope Impact',
                          description: `${affectedTaskIds.length} tasks directly affected - extensive coordination required`
                        });
                      } else if (affectedTaskIds.length >= 5) {
                        risks.push({
                          severity: 'high',
                          title: 'Multiple Tasks Affected',
                          description: `${affectedTaskIds.length} tasks will need updates and potential rework`
                        });
                      } else if (affectedTaskIds.length >= 2) {
                        risks.push({
                          severity: 'medium',
                          title: 'Multi-Task Impact',
                          description: `${affectedTaskIds.length} tasks affected by this change`
                        });
                      }
    
                      // Risk based on impact level
                      if (impactLevel === 'critical') {
                        risks.push({
                          severity: 'critical',
                          title: 'Critical Business Impact',
                          description: 'Change affects critical project deliverables or milestones'
                        });
                      } else if (impactLevel === 'high') {
                        risks.push({
                          severity: 'high',
                          title: 'High Impact Change',
                          description: 'Significant implications for project timeline or budget'
                        });
                      }
    
                      // Risk based on dependencies (successors)
                      if (successorTasks.length >= 5) {
                        risks.push({
                          severity: 'critical',
                          title: 'Cascade Risk',
                          description: `${successorTasks.length} downstream tasks depend on affected tasks - high cascade potential`
                        });
                      } else if (successorTasks.length >= 2) {
                        risks.push({
                          severity: 'high',
                          title: 'Dependency Chain Impact',
                          description: `${successorTasks.length} successor tasks will be impacted`
                        });
                      } else if (successorTasks.length === 1) {
                        risks.push({
                          severity: 'medium',
                          title: 'Downstream Dependency',
                          description: '1 task depends on affected tasks and may need rescheduling'
                        });
                      }
    
                      // Risk based on schedule impact
                      if (Math.abs(scheduleImpact) >= 14) {
                        risks.push({
                          severity: 'critical',
                          title: 'Major Schedule Variance',
                          description: `${Math.abs(scheduleImpact)} days shift may require baseline revision`
                        });
                      } else if (Math.abs(scheduleImpact) >= 7) {
                        risks.push({
                          severity: 'high',
                          title: 'Schedule Shift',
                          description: `${Math.abs(scheduleImpact)} days impact on project timeline`
                        });
                      }
    
                      // Risk based on milestone impact
                      const affectedMilestones = affectedTaskIds
                        .map(id => tasks.find(t => t.id === id))
                        .filter(t => t?.taskType === 'milestone' || t?.isMilestone);
    
                      if (affectedMilestones.length > 0) {
                        risks.push({
                          severity: 'critical',
                          title: 'Milestone Impact',
                          description: `${affectedMilestones.length} milestone(s) affected - stakeholder communication required`
                        });
                      }
    
                      if (risks.length === 0) return null;
    
                      return (
                        <div className="p-4 bg-amber-500/5 rounded-lg border border-amber-500/20">
                          <div className="flex items-center gap-2 mb-3">
                            <Shield className="w-4 h-4 text-amber-500" />
                            <span className="font-medium text-sm">Risk Assessment ({risks.length})</span>
                            <Badge className={`text-[9px] ml-auto ${
                              risks.some(r => r.severity === 'critical') ? 'bg-red-500/20 text-red-400' :
                              risks.some(r => r.severity === 'high') ? 'bg-orange-500/20 text-orange-400' :
                              'bg-amber-500/20 text-amber-400'
                            }`}>
                              {risks.some(r => r.severity === 'critical') ? 'High Risk' :
                               risks.some(r => r.severity === 'high') ? 'Elevated Risk' : 'Moderate Risk'}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {risks.map((risk, idx) => (
                              <div key={idx} className="flex items-start gap-2 p-2 bg-background/50 rounded">
                                <Badge className={`text-[9px] shrink-0 ${
                                  risk.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                                  risk.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                  risk.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-blue-500/20 text-blue-400'
                                }`}>{risk.severity}</Badge>
                                <div>
                                  <div className="text-sm font-medium">{risk.title}</div>
                                  <div className="text-xs text-muted-foreground">{risk.description}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
    
                    {/* Auto-Detected Affected Tasks Section - Shows for ALL change types */}
                    {reviewAffectedTasksData.totalAffected > 0 && (
                      <div className="p-4 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-indigo-500/10 rounded-lg border border-blue-500/20">
                        <div className="flex items-center gap-2 mb-3">
                          <Network className="w-4 h-4 text-blue-500" />
                          <span className="font-medium text-sm">Auto-Detected Impact Chain</span>
                          <Badge className="text-[9px] ml-auto bg-blue-500/20 text-blue-400">
                            {reviewAffectedTasksData.totalAffected} tasks • {reviewAffectedTasksData.maxLevel} levels deep
                          </Badge>
                        </div>
    
                        {/* Summary stats */}
                        <div className="grid grid-cols-4 gap-2 mb-3">
                          <div className="p-2 bg-background/50 rounded text-center">
                            <div className="text-lg font-bold text-blue-500">{reviewAffectedTasksData.directTasks.length}</div>
                            <div className="text-[9px] text-muted-foreground">Direct</div>
                          </div>
                          <div className="p-2 bg-background/50 rounded text-center">
                            <div className="text-lg font-bold text-amber-500">{reviewAffectedTasksData.indirectTasks.length}</div>
                            <div className="text-[9px] text-muted-foreground">Cascading</div>
                          </div>
                          <div className="p-2 bg-background/50 rounded text-center">
                            <div className="text-lg font-bold">{reviewAffectedTasksData.totalAffected}</div>
                            <div className="text-[9px] text-muted-foreground">Total</div>
                          </div>
                          <div className="p-2 bg-background/50 rounded text-center">
                            <div className="text-lg font-bold text-purple-500">{reviewAffectedTasksData.maxLevel}</div>
                            <div className="text-[9px] text-muted-foreground">Levels</div>
                          </div>
                        </div>
    
                        {/* Task list with dependency chain visualization */}
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {/* Direct tasks */}
                          {reviewAffectedTasksData.directTasks.map((task) => (
                            <div key={task.id} className="p-2 bg-blue-500/10 rounded border border-blue-500/20 flex items-center gap-2">
                              <Badge variant="outline" className="text-[8px] font-mono shrink-0">{task.wbsCode || 'N/A'}</Badge>
                              <span className="text-xs font-medium truncate flex-1">{task.taskName || task.title}</span>
                              <Badge className="text-[8px] bg-blue-500/20 text-blue-400 shrink-0">Direct</Badge>
                              {task.plannedEndDate && (
                                <span className="text-[9px] text-muted-foreground shrink-0">
                                  {new Date(task.plannedEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                          ))}
    
                          {/* Cascading tasks with level indicator */}
                          {reviewAffectedTasksData.indirectTasks.map(({ id, task, level }) => (
                            <div key={id} className="p-2 bg-amber-500/10 rounded border border-amber-500/20 flex items-center gap-2" style={{ marginLeft: `${Math.min(level * 8, 32)}px` }}>
                              <div className="flex items-center gap-1 shrink-0">
                                {Array.from({ length: level }).map((_, i) => (
                                  <ChevronRight key={i} className="w-3 h-3 text-amber-500/50" />
                                ))}
                              </div>
                              <Badge variant="outline" className="text-[8px] font-mono shrink-0">{task.wbsCode || 'N/A'}</Badge>
                              <span className="text-xs font-medium truncate flex-1">{task.taskName || task.title}</span>
                              <Badge className="text-[8px] bg-purple-500/20 text-purple-400 shrink-0">L{level}</Badge>
                              {task.plannedEndDate && (
                                <span className="text-[9px] text-muted-foreground shrink-0">
                                  {new Date(task.plannedEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
    
                        {reviewAffectedTasksData.indirectTasks.length > 0 && (
                          <div className="mt-3 p-2 bg-amber-500/10 rounded border border-amber-500/20">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              <span className="text-[10px] text-amber-500">
                                {reviewAffectedTasksData.indirectTasks.length} downstream task{reviewAffectedTasksData.indirectTasks.length !== 1 ? 's' : ''} will be affected through dependency chain
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
    
                    {/* Enhanced Timeline Impact Visualization with Full Cascading Effects */}
                    {changeRequest.affectedTasks && changeRequest.affectedTasks.length > 0 && changeRequest.changeType === 'timeline' && changeRequest.estimatedScheduleImpact && (
                      <div className="space-y-4">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <ArrowLeftRight className="w-4 h-4" />
                          Full Impact Analysis
                        </div>
    
                        {/* Cascading Effects Summary with Multi-Level BFS */}
                        {(() => {
                          const affectedTaskIds = changeRequest.affectedTasks || [];
                          const scheduleImpactDays = changeRequest.estimatedScheduleImpact || 0;
    
                          const wbsCodeToIdMap = new Map<string, string>();
                          const taskMap = new Map<string, WbsTaskData>();
                          tasks.forEach(t => {
                            if (t.wbsCode) wbsCodeToIdMap.set(t.wbsCode, t.id);
                            if (t.id) wbsCodeToIdMap.set(t.id, t.id);
                            taskMap.set(t.id, t);
                          });
    
                          // Build predecessor -> successors map for efficient traversal
                          // Filters out parent-child rollup links from summary tasks
                          const successorsMap = new Map<string, string[]>();
                          tasks.forEach(t => {
                            if (t.predecessors && Array.isArray(t.predecessors)) {
                              t.predecessors.forEach((pred: string | { taskId?: string; taskCode?: string }) => {
                                const predRef = typeof pred === 'string' ? pred : pred.taskId || pred.taskCode;
                                if (!predRef) return;
                                const resolvedId = wbsCodeToIdMap.get(predRef) || predRef;
                                // Skip if the predecessor is a descendant of this task (parent-child rollup)
                                if (isDescendantOf(resolvedId, t.id, taskMap)) return;
                                if (!successorsMap.has(resolvedId)) {
                                  successorsMap.set(resolvedId, []);
                                }
                                successorsMap.get(resolvedId)!.push(t.id);
                              });
                            }
                          });
    
                          // Multi-level BFS to find ALL downstream dependent tasks
                          const visited = new Set<string>(affectedTaskIds);
                          const indirectTasks: Array<{ id: string; task: WbsTaskData; level: number }> = [];
                          const queue: Array<{ id: string; level: number }> = affectedTaskIds.map(id => ({ id, level: 0 }));
    
                          while (queue.length > 0) {
                            const { id: currentId, level } = queue.shift()!;
                            const successors = successorsMap.get(currentId) || [];
    
                            for (const successorId of successors) {
                              if (visited.has(successorId)) continue;
                              visited.add(successorId);
    
                              const task = taskMap.get(successorId);
                              if (task) {
                                indirectTasks.push({ id: successorId, task, level: level + 1 });
                                queue.push({ id: successorId, level: level + 1 });
                              }
                            }
                          }
    
                          // Calculate project end date impact using reduce for proper typing
                          const projectEndInfo = tasks.reduce<{ maxEndDate: Date | null; criticalTaskId: string | null }>(
                            (acc, t) => {
                              if (t.plannedEndDate) {
                                const endDate = new Date(t.plannedEndDate);
                                if (!acc.maxEndDate || endDate > acc.maxEndDate) {
                                  return { maxEndDate: endDate, criticalTaskId: t.id };
                                }
                              }
                              return acc;
                            },
                            { maxEndDate: null, criticalTaskId: null }
                          );
    
                          const currentMaxEndDate = projectEndInfo.maxEndDate;
                          const criticalTaskId = projectEndInfo.criticalTaskId;
    
                          let projectEndDateShift = 0;
                          let newProjectEndDate: Date | null = currentMaxEndDate ? new Date(currentMaxEndDate) : null;
    
                          if (currentMaxEndDate && scheduleImpactDays !== 0) {
                            const allAffectedIds = [...affectedTaskIds, ...indirectTasks.map(t => t.id)];
    
                            for (const taskId of allAffectedIds) {
                              const task = taskMap.get(taskId);
                              if (task?.plannedEndDate) {
                                const taskEnd = new Date(task.plannedEndDate);
                                const newTaskEnd = new Date(taskEnd.getTime() + scheduleImpactDays * 24 * 60 * 60 * 1000);
    
                                if (newTaskEnd > currentMaxEndDate) {
                                  const daysDiff = Math.ceil((newTaskEnd.getTime() - currentMaxEndDate.getTime()) / (1000 * 60 * 60 * 24));
                                  if (daysDiff > projectEndDateShift) {
                                    projectEndDateShift = daysDiff;
                                    newProjectEndDate = newTaskEnd;
                                  }
                                }
    
                                if (taskId === criticalTaskId) {
                                  projectEndDateShift = Math.max(projectEndDateShift, scheduleImpactDays);
                                  newProjectEndDate = new Date(currentMaxEndDate.getTime() + scheduleImpactDays * 24 * 60 * 60 * 1000);
                                }
                              }
                            }
                          }
    
                          const totalAffected = affectedTaskIds.length + indirectTasks.length;
                          const healthImpact = totalAffected >= 10 ? 'critical' :
                                              totalAffected >= 5 ? 'high' :
                                              totalAffected >= 2 ? 'medium' : 'low';
                          const maxLevel = indirectTasks.length > 0 ? Math.max(...indirectTasks.map(t => t.level)) : 0;
    
                          return (
                            <>
                              {/* Summary Card */}
                              <div className={`p-4 rounded-lg border-2 ${
                                scheduleImpactDays > 0
                                  ? 'bg-amber-500/10 border-amber-500/30'
                                  : 'bg-emerald-500/10 border-emerald-500/30'
                              }`}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    {scheduleImpactDays > 0 ? (
                                      <TrendingUp className="w-5 h-5 text-amber-500" />
                                    ) : (
                                      <TrendingDown className="w-5 h-5 text-emerald-500" />
                                    )}
                                    <span className="font-medium">
                                      {scheduleImpactDays > 0 ? 'Schedule Extension' : 'Schedule Acceleration'}
                                    </span>
                                  </div>
                                  <Badge className={`text-sm px-2 py-1 ${
                                    scheduleImpactDays > 0
                                      ? 'bg-amber-500/20 text-amber-500'
                                      : 'bg-emerald-500/20 text-emerald-500'
                                  }`}>
                                    {scheduleImpactDays > 0 ? '+' : ''}{scheduleImpactDays} days
                                  </Badge>
                                </div>
    
                                <div className="grid grid-cols-5 gap-2 text-center">
                                  <div className="p-2 bg-background/50 rounded">
                                    <div className="text-lg font-bold text-blue-500">{affectedTaskIds.length}</div>
                                    <div className="text-[10px] text-muted-foreground">Direct</div>
                                  </div>
                                  <div className="p-2 bg-background/50 rounded">
                                    <div className="text-lg font-bold text-amber-500">{indirectTasks.length}</div>
                                    <div className="text-[10px] text-muted-foreground">Cascading</div>
                                  </div>
                                  <div className="p-2 bg-background/50 rounded">
                                    <div className="text-lg font-bold">{totalAffected}</div>
                                    <div className="text-[10px] text-muted-foreground">Total</div>
                                  </div>
                                  <div className="p-2 bg-background/50 rounded">
                                    <div className="text-lg font-bold text-purple-500">{maxLevel}</div>
                                    <div className="text-[10px] text-muted-foreground">Levels Deep</div>
                                  </div>
                                  <div className="p-2 bg-background/50 rounded">
                                    <Badge className={`text-[9px] ${
                                      healthImpact === 'critical' ? 'bg-red-500/20 text-red-400' :
                                      healthImpact === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                      healthImpact === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                      'bg-emerald-500/20 text-emerald-400'
                                    }`}>{healthImpact}</Badge>
                                    <div className="text-[10px] text-muted-foreground mt-1">Risk</div>
                                  </div>
                                </div>
                              </div>
    
                              {/* Project End Date Impact */}
                              {currentMaxEndDate && projectEndDateShift !== 0 && (
                                <div className={`p-4 rounded-lg border ${
                                  projectEndDateShift > 0
                                    ? 'bg-red-500/10 border-red-500/30'
                                    : 'bg-emerald-500/10 border-emerald-500/30'
                                }`}>
                                  <div className="flex items-center gap-2 mb-3">
                                    <CalendarClock className="w-4 h-4" />
                                    <span className="font-medium text-sm">Project End Date Impact</span>
                                    {projectEndDateShift > 7 && (
                                      <Badge className="text-[9px] bg-red-500/20 text-red-400">Critical</Badge>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-3 gap-3 text-center">
                                    <div className="p-2 bg-background/50 rounded">
                                      <div className="text-[10px] text-muted-foreground mb-1">Current End</div>
                                      <div className="text-sm font-medium">
                                        {currentMaxEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </div>
                                    </div>
                                    <div className="p-2 bg-background/50 rounded flex items-center justify-center">
                                      <ArrowRight className={`w-4 h-4 ${projectEndDateShift > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
                                    </div>
                                    <div className="p-2 bg-background/50 rounded">
                                      <div className="text-[10px] text-muted-foreground mb-1">Projected End</div>
                                      <div className={`text-sm font-medium ${projectEndDateShift > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {newProjectEndDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </div>
                                    </div>
                                  </div>
                                  <div className={`mt-2 text-center text-sm font-medium ${
                                    projectEndDateShift > 0 ? 'text-red-400' : 'text-emerald-400'
                                  }`}>
                                    {projectEndDateShift > 0 ? `+${projectEndDateShift}` : projectEndDateShift} days {projectEndDateShift > 0 ? 'delay' : 'earlier'}
                                  </div>
                                </div>
                              )}
    
                              {/* All Affected Tasks with Complete Date Details */}
                              <div className="p-4 bg-muted/30 rounded-lg border border-border">
                                <div className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                  <Network className="w-4 h-4" />
                                  <span>All Affected Tasks ({affectedTaskIds.length} direct + {indirectTasks.length} cascading)</span>
                                </div>
                                <div className="space-y-3 max-h-80 overflow-y-auto">
                                  {/* Direct Tasks */}
                                  {affectedTaskIds.map((taskId) => {
                                    const task = taskMap.get(taskId);
                                    if (!task) return null;
    
                                    const origStart = task.plannedStartDate ? new Date(task.plannedStartDate) : null;
                                    const origEnd = task.plannedEndDate ? new Date(task.plannedEndDate) : null;
                                    const newStart = origStart ? new Date(origStart.getTime() + scheduleImpactDays * 24 * 60 * 60 * 1000) : null;
                                    const newEnd = origEnd ? new Date(origEnd.getTime() + scheduleImpactDays * 24 * 60 * 60 * 1000) : null;
    
                                    return (
                                      <div key={taskId} className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Badge variant="outline" className="text-[8px] font-mono">{task.wbsCode || 'N/A'}</Badge>
                                          <span className="text-xs font-medium truncate flex-1">{task.taskName || task.title}</span>
                                          <Badge className="text-[8px] bg-blue-500/20 text-blue-400">Direct</Badge>
                                          <Badge className={`text-[8px] ${scheduleImpactDays > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                            {scheduleImpactDays > 0 ? '+' : ''}{scheduleImpactDays}d
                                          </Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                                          <div className="p-2 bg-background/50 rounded">
                                            <div className="text-muted-foreground mb-1">Original Dates</div>
                                            <div className="font-medium">
                                              {origStart?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || '—'} to {origEnd?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || '—'}
                                            </div>
                                          </div>
                                          <div className={`p-2 rounded ${scheduleImpactDays > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                                            <div className="text-muted-foreground mb-1">Proposed Dates</div>
                                            <div className={`font-medium ${scheduleImpactDays > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                              {newStart?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || '—'} to {newEnd?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || '—'}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
    
                                  {/* Cascading/Indirect Tasks */}
                                  {indirectTasks.map(({ id, task, level }) => {
                                    const origStart = task.plannedStartDate ? new Date(task.plannedStartDate) : null;
                                    const origEnd = task.plannedEndDate ? new Date(task.plannedEndDate) : null;
                                    const newStart = origStart ? new Date(origStart.getTime() + scheduleImpactDays * 24 * 60 * 60 * 1000) : null;
                                    const newEnd = origEnd ? new Date(origEnd.getTime() + scheduleImpactDays * 24 * 60 * 60 * 1000) : null;
    
                                    return (
                                      <div key={id} className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Badge variant="outline" className="text-[8px] font-mono">{task.wbsCode || 'N/A'}</Badge>
                                          <span className="text-xs font-medium truncate flex-1">{task.taskName || task.title}</span>
                                          <Badge className="text-[8px] bg-purple-500/20 text-purple-400">Level {level}</Badge>
                                          <Badge className={`text-[8px] ${scheduleImpactDays > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                            {scheduleImpactDays > 0 ? '+' : ''}{scheduleImpactDays}d
                                          </Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                                          <div className="p-2 bg-background/50 rounded">
                                            <div className="text-muted-foreground mb-1">Original Dates</div>
                                            <div className="font-medium">
                                              {origStart?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || '—'} to {origEnd?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || '—'}
                                            </div>
                                          </div>
                                          <div className={`p-2 rounded ${scheduleImpactDays > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                                            <div className="text-muted-foreground mb-1">Proposed Dates</div>
                                            <div className={`font-medium ${scheduleImpactDays > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                              {newStart?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || '—'} to {newEnd?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || '—'}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          );
                        })()}
    
                        {/* Visual Timeline Bars */}
                        <div className="space-y-3">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Task Timeline Shifts</div>
                          {changeRequest.affectedTasks.map((taskId) => {
                            const task = tasks.find(t => t.id === taskId);
                            if (!task) return null;
    
                            const currentEndDate = task.plannedEndDate ? new Date(task.plannedEndDate) : null;
                            const currentStartDate = task.plannedStartDate ? new Date(task.plannedStartDate) : null;
                            const impactDays = changeRequest.estimatedScheduleImpact || 0;
    
                            const newEndDate = currentEndDate ? new Date(currentEndDate.getTime() + impactDays * 24 * 60 * 60 * 1000) : null;
                            const newStartDate = currentStartDate ? new Date(currentStartDate.getTime() + impactDays * 24 * 60 * 60 * 1000) : null;
    
                            return (
                              <div key={taskId} className="p-3 bg-muted/40 rounded-lg border border-border">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-sm font-medium truncate flex-1">{task.taskName || task.title}</span>
                                  <Badge variant="outline" className="text-[10px] shrink-0">
                                    {impactDays > 0 ? '+' : ''}{impactDays}d
                                  </Badge>
                                </div>
    
                                {/* Visual Timeline Bar Comparison */}
                                <div className="space-y-2">
                                  {/* Current Timeline Bar */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground w-12 shrink-0">Current</span>
                                    <div className="flex-1 relative h-5">
                                      <div className="absolute inset-y-0 left-0 right-0 bg-muted/50 rounded" />
                                      <div className="absolute inset-y-0 left-0 bg-blue-500/50 rounded flex items-center justify-center" style={{ width: '70%' }}>
                                        <span className="text-[9px] text-blue-100 truncate px-1">
                                          {currentStartDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {currentEndDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
    
                                  {/* New Timeline Bar */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground w-12 shrink-0">After</span>
                                    <div className="flex-1 relative h-5">
                                      <div className="absolute inset-y-0 left-0 right-0 bg-muted/50 rounded" />
                                      <div
                                        className={`absolute inset-y-0 rounded flex items-center justify-center ${
                                          impactDays > 0 ? 'bg-amber-500/50' : 'bg-emerald-500/50'
                                        }`}
                                        style={{
                                          left: impactDays > 0 ? `${Math.min(10, impactDays * 2)}%` : '0%',
                                          width: '70%'
                                        }}
                                      >
                                        <span className={`text-[9px] truncate px-1 ${impactDays > 0 ? 'text-amber-100' : 'text-emerald-100'}`}>
                                          {newStartDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {newEndDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                      </div>
                                      {/* Shift Arrow Indicator */}
                                      {impactDays !== 0 && (
                                        <div className="absolute -right-1 top-1/2 -translate-y-1/2">
                                          {impactDays > 0 ? (
                                            <ArrowRight className="w-3 h-3 text-amber-500" />
                                          ) : (
                                            <ArrowRight className="w-3 h-3 text-emerald-500 rotate-180" />
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
    
                    {/* Affected Tasks (non-timeline changes) */}
                    {changeRequest.affectedTasks && changeRequest.affectedTasks.length > 0 && changeRequest.changeType !== 'timeline' && (
                      <div>
                        <div className="text-sm font-medium mb-2">Affected Tasks</div>
                        <div className="space-y-2">
                          {changeRequest.affectedTasks.map((taskId) => {
                            const task = tasks.find(t => t.id === taskId);
                            return task ? (
                              <div key={taskId} className="flex items-center gap-2 p-2 bg-muted/40 rounded border border-border">
                                <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">{task.taskName || task.title}</span>
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
    
                    <div className="text-xs text-muted-foreground">
                      Requested on {new Date(changeRequest.requestedAt).toLocaleString()}
                    </div>
    
                    {/* Workflow Action Buttons */}
                    <div className="pt-4 border-t border-border space-y-3">
                      <div className="text-sm font-medium">Actions</div>
    
                      {/* Submitted or Under Review - Show Approve/Reject buttons */}
                      {(changeRequest.status === 'submitted' || changeRequest.status === 'under_review') && (
                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            onClick={() => onApprove(changeRequest.id)}
                            disabled={isApproving}
                            data-testid="button-approve-change-request"
                          >
                            {isApproving ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                            )}
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={() => onReject(changeRequest.id, 'Rejected by reviewer')}
                            disabled={isRejecting}
                            data-testid="button-reject-change-request"
                          >
                            {isRejecting ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4 mr-2" />
                            )}
                            Reject
                          </Button>
                        </div>
                      )}
    
                      {/* Approved - Show Implement button */}
                      {changeRequest.status === 'approved' && (
                        <Button
                          className="w-full"
                          onClick={() => onImplement(changeRequest.id)}
                          disabled={isImplementing}
                          data-testid="button-implement-change-request"
                        >
                          {isImplementing ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4 mr-2" />
                          )}
                          Implement Changes
                        </Button>
                      )}
    
                      {/* Implemented - Show success state */}
                      {changeRequest.status === 'implemented' && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                          <div className="flex items-center gap-2 text-emerald-500">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="font-medium">Change Implemented</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            This change request has been implemented and affected tasks have been updated.
                          </p>
                        </div>
                      )}
    
                      {/* Rejected - Show rejection info */}
                      {changeRequest.status === 'rejected' && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <div className="flex items-center gap-2 text-red-500">
                            <XCircle className="w-5 h-5" />
                            <span className="font-medium">Change Rejected</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            This change request was not approved.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
    
  );
}
