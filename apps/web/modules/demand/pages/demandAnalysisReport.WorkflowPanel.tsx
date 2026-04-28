import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getWorkflowStatusColor, getWorkflowStatusLabel } from "./demandAnalysisReport.utils";
import type { DemandReport, WorkflowUpdateData, WorkflowHistoryEntry } from "./demandAnalysisReport.types";
import {
  Workflow, XCircle, CheckCircle, Settings, Eye, Calendar, Loader2,
  ArrowLeft, Shield, History,
} from "lucide-react";

// ============================================================================
// WORKFLOW PANEL COMPONENT (Right Sidebar)
// ============================================================================

interface WorkflowPanelProps {
  report: DemandReport;
  toast: (props: { title?: string; description?: string; variant?: "default" | "destructive" }) => void;
  updateWorkflowMutation: { mutate: (data: WorkflowUpdateData) => void; isPending: boolean };
  onClosePanel: () => void;
}

export function WorkflowPanel({
  report,
  toast,
  updateWorkflowMutation,
  onClosePanel,
}: WorkflowPanelProps) {
  const { t } = useTranslation();
  const [workflowAction, setWorkflowAction] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [rejectionCategory, setRejectionCategory] = useState("");
  const [deferredDate, setDeferredDate] = useState("");
  const [managerEmail, _setManagerEmail] = useState("");
  const [meetingDate, _setMeetingDate] = useState("");
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const handleWorkflowSubmit = () => {
    if (!workflowAction) {
      toast({
        title: t('demand.analysis.workflow.error'),
        description: t('demand.analysis.workflow.selectAction'),
        variant: "destructive",
      });
      return;
    }

    const updateData: WorkflowUpdateData = {
      workflowStatus: workflowAction,
      decisionReason: decisionReason.trim(),
      ...(rejectionCategory && { rejectionCategory }),
      ...(deferredDate && { deferredUntil: deferredDate }),
      ...(managerEmail && { managerEmail }),
      ...(meetingDate && { meetingDate }),
    };

    updateWorkflowMutation.mutate(updateData);
  };

  return (
    <div className="space-y-3">
      {/* Panel Header with Close Button */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Workflow className="h-4 w-4 text-blue-600" />
          {t('demand.analysis.workflow.workflowActions')}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClosePanel}
          data-testid="button-close-workflow-panel"
        >
          <XCircle className="h-4 w-4" />
        </Button>
      </div>

      {/* Compact Status Header - Unified Workflow Status */}
      <div className="rounded-lg bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-emerald-500/5 border border-blue-200/20 dark:border-blue-800/20 p-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
              <Settings className="h-3 w-3" />
            </div>
            <h3 className="text-xs font-semibold">{t('demand.analysis.workflow.workflowStatus')}</h3>
          </div>
          <Badge className={`${getWorkflowStatusColor(report.workflowStatus)} px-2 py-0.5 text-xs`}>
            {getWorkflowStatusLabel(report.workflowStatus || 'generated')}
          </Badge>
        </div>
      </div>

      {/* Compact Workflow Actions */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5 text-primary" />
              {t('demand.analysis.workflow.updateStatus')}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="text-xs h-6 px-2"
              data-testid="button-toggle-advanced-options"
            >
              {showAdvancedOptions ? 'Hide' : 'Advanced'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 pt-0">
          {/* Compact Action Selection */}
          <div className="space-y-2">
            <Label htmlFor="workflow-action" className="text-xs font-medium">{t('demand.analysis.workflow.nextAction')}</Label>
            <Select value={workflowAction} onValueChange={setWorkflowAction}>
              <SelectTrigger className="h-8" data-testid="select-workflow-action">
                <SelectValue placeholder={t('demand.analysis.workflow.chooseAction')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="acknowledged" className="py-2">
                  <div className="flex items-center gap-2">
                    <Eye className="h-3 w-3 text-blue-500" />
                    <span className="text-sm">{t('demand.analysis.workflow.acknowledgeRequest')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="deferred" className="py-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-orange-500" />
                    <span className="text-sm">{t('demand.analysis.workflow.deferDecision')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="rejected" className="py-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-3 w-3 text-red-500" />
                    <span className="text-sm">{t('demand.analysis.workflow.rejectRequest')}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Compact Decision Reason */}
          <div className="space-y-2">
            <Label htmlFor="decision-reason" className="text-xs font-medium">{t('demand.analysis.workflow.rationale')}</Label>
            <Textarea
              id="decision-reason"
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              placeholder={t('demand.analysis.workflow.provideReasoning')}
              className="min-h-16 text-sm"
              data-testid="textarea-decision-reason"
            />
          </div>

          {/* Compact Conditional Fields */}
          {workflowAction === 'rejected' && (
            <div className="space-y-2 p-2 rounded bg-red-500/5 border border-red-200/20">
              <Label htmlFor="rejection-category" className="text-xs font-medium text-red-700 dark:text-red-400">{t('demand.analysis.workflow.rejectionCategory')}</Label>
              <Select value={rejectionCategory} onValueChange={setRejectionCategory}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-rejection-category">
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Budget">{t('demand.analysis.workflow.budgetConstraints')}</SelectItem>
                  <SelectItem value="Resource">{t('demand.analysis.workflow.resourceUnavailability')}</SelectItem>
                  <SelectItem value="Strategic">{t('demand.analysis.workflow.strategicMisalignment')}</SelectItem>
                  <SelectItem value="Technical">{t('demand.analysis.workflow.technicalIssues')}</SelectItem>
                  <SelectItem value="Timeline">{t('demand.analysis.workflow.timelineConflicts')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {workflowAction === 'deferred' && (
            <div className="space-y-2 p-2 rounded bg-orange-500/5 border border-orange-200/20">
              <Label htmlFor="deferred-date" className="text-xs font-medium text-orange-700 dark:text-orange-400">{t('demand.analysis.workflow.deferUntil')}</Label>
              <Input
                id="deferred-date"
                type="date"
                value={deferredDate}
                onChange={(e) => setDeferredDate(e.target.value)}
                className="h-8 text-sm"
                data-testid="input-deferred-date"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}

          {workflowAction === 'acknowledged' && (
            <div className="space-y-2 p-2 rounded bg-blue-500/5 border border-blue-200/20">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                {t('demand.analysis.workflow.acknowledgeHint')}
              </p>
            </div>
          )}

          {/* Compact Advanced Options */}
          {showAdvancedOptions && (
            <div className="space-y-2 p-2 rounded bg-muted/30 border border-dashed border-muted-foreground/20">
              <h4 className="text-xs font-medium">{t('demand.analysis.workflow.advancedOptions')}</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{t('demand.analysis.workflow.priority')}</Label>
                  <Select defaultValue="normal">
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t('demand.analysis.workflow.notifications')}</Label>
                  <Select defaultValue="enabled">
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enabled">On</SelectItem>
                      <SelectItem value="disabled">Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Compact Action Button */}
          <Button
            onClick={handleWorkflowSubmit}
            disabled={updateWorkflowMutation.isPending || !workflowAction}
            className="w-full h-8 text-sm font-semibold"
            data-testid="button-submit-workflow"
          >
            {updateWorkflowMutation.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                {t('demand.analysis.workflow.processing')}
              </>
            ) : (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                {t('demand.analysis.workflow.updateWorkflowStatus')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Meeting Information - Compact */}
      {report.meetingDate && (
        <Card className="border-purple-200/20 dark:border-purple-800/20">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-purple-500" />
              {t('demand.analysis.workflow.scheduledMeeting')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-200/20">
              <p className="text-xs font-medium text-purple-700 dark:text-purple-300">
                {new Date(report.meetingDate).toLocaleString('en-AE', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Asia/Dubai'
                })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('demand.analysis.workflow.dubaiTime')}</p>
            </div>

            {report.meetingNotes && (
              <div className="space-y-1">
                <Label className="text-xs font-medium">{t('demand.analysis.workflow.agenda')}:</Label>
                <div className="p-2 rounded-lg bg-card border text-xs">
                  {report.meetingNotes}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Workflow History - Compact */}
      {report.workflowHistory && Array.isArray(report.workflowHistory) && report.workflowHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-primary" />
              {t('demand.analysis.workflow.workflowHistory', { count: report.workflowHistory.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.workflowHistory.map((entry: WorkflowHistoryEntry, index: number) => (
              <div key={index} className="p-2.5 rounded-lg bg-gradient-to-r from-card to-muted/20 border hover-elevate">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="h-5 w-5 rounded bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
                    <span className="text-xs font-bold">{index + 1}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-muted">{entry.previousStatus || 'Initial'}</span>
                    <ArrowLeft className="h-2.5 w-2.5 rotate-180 text-muted-foreground" />
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">{entry.newStatus}</span>
                  </div>
                </div>
                <p className="text-xs mb-1.5 pl-6">{entry.reason}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground pl-6">
                  <span className="flex items-center gap-1">
                    <Shield className="h-2.5 w-2.5" />
                    {entry.user}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5" />
                    {new Date(entry.timestamp).toLocaleDateString('en-AE', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
