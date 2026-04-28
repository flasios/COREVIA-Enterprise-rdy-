import { useEffect, useMemo, useState } from "react";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, CheckCircle2, RefreshCw, XCircle, Clock, User, AlertTriangle, FileCheck, Lock, Info } from "lucide-react";
import type { Approval } from "@shared/contracts/brain";

export interface WorkflowReadiness {
  requiresVersionApproval: boolean;
  versionApproved: boolean;
  versionType: string | null;
  versionStatus: string | null;
  versionNumber: string | number | null;
  demandReportId: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  message: string;
}

interface ApprovalGatePanelProps {
  decisionId: string;
  requiresApproval: boolean;
  approvalReason: string;
  approvals: Approval[];
  isApproved: boolean;
  onApprove: (data: {
    decision: "approve" | "revise" | "reject";
    approvalType: "insights_only" | "insights_actions";
    notes?: string;
    approvedActions?: Record<string, unknown>[];
  }) => Promise<{ approvalId?: string } | void>;
  onExecuteActions?: (approvalId: string) => Promise<void>;
  isSubmitting?: boolean;
  isExecuting?: boolean;
  workflowReadiness?: WorkflowReadiness;
  proposedActions?: Record<string, unknown>[];
}

export function ApprovalGatePanel({
  decisionId: _decisionId,
  requiresApproval,
  approvalReason,
  approvals,
  isApproved,
  onApprove,
  onExecuteActions,
  isSubmitting = false,
  isExecuting = false,
  workflowReadiness,
  proposedActions,
}: ApprovalGatePanelProps) {
  const [decision, setDecision] = useState<"approve" | "revise" | "reject">("approve");
  const [notes, setNotes] = useState("");
  const [notesError, setNotesError] = useState(false);
  const { t } = useTranslation();

  const actionItems = useMemo(
    () => (Array.isArray(proposedActions) ? proposedActions : []),
    [proposedActions],
  );

  // Default: every proposed action is selected for approval. User unchecks ones they don't want to execute.
  const [selectedActions, setSelectedActions] = useState<Set<number>>(
    () => new Set(actionItems.map((_, i) => i)),
  );

  // Re-sync selection when the proposed-actions list itself changes (e.g. after a refetch)
  const actionsKey = useMemo(
    () => `${actionItems.length}:${actionItems.map((a) => String((a as Record<string, unknown>)?.title ?? (a as Record<string, unknown>)?.name ?? '')).join('|')}`,
    [actionItems],
  );
  useEffect(() => {
    setSelectedActions(new Set(actionItems.map((_, i) => i)));
    // actionItems is keyed by actionsKey to avoid resetting selection on unrelated re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionsKey]);

  const approvedSubset = actionItems.filter((_, idx) => selectedActions.has(idx));

  const needsVersionApproval = workflowReadiness?.requiresVersionApproval && !workflowReadiness?.versionApproved;
  const executeBlocked = needsVersionApproval && decision === "approve" && approvedSubset.length > 0;

  const toggleAction = (idx: number) => {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };
  const selectAllActions = () => setSelectedActions(new Set(actionItems.map((_, i) => i)));
  const clearAllActions = () => setSelectedActions(new Set());

  const handleSubmit = async (verdict: "approve" | "revise" | "reject" = decision) => {
    if ((verdict === "revise" || verdict === "reject") && !notes.trim()) {
      setNotesError(true);
      return;
    }
    setNotesError(false);
    setDecision(verdict);
    if (verdict === "approve" && executeBlocked) {
      return;
    }
    const useActions = verdict === "approve" && approvedSubset.length > 0;
    const result = await onApprove({
      decision: verdict,
      approvalType: useActions ? "insights_actions" : "insights_only",
      notes: notes.trim() || undefined,
      approvedActions: useActions ? approvedSubset : undefined,
    });

    if (useActions && onExecuteActions && result?.approvalId) {
      await onExecuteActions(result.approvalId);
    }
  };

  const versionLabel = workflowReadiness?.versionType === 'business_case' ? t('brain.approvalGate.businessCase') : t('brain.approvalGate.requirements');

  return (
    <div className="space-y-4">
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3 bg-primary/5">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{t('brain.approvalGate.title')}</CardTitle>
          </div>
          <CardDescription>
            {t('brain.approvalGate.required')}: <strong>{requiresApproval ? t('brain.approvalGate.yes') : t('brain.approvalGate.no')}</strong>
            {requiresApproval && ` (${approvalReason})`}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {isApproved ? (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  {t('brain.approvalGate.decisionApproved')}
                </span>
              </div>
              {approvals.length > 0 && (() => {
                const latest = approvals[approvals.length - 1];
                if (!latest) return null;
                return (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pl-7">
                    <User className="h-3.5 w-3.5" />
                    <span>{t('brain.approvalGate.by')} <strong>{latest.approvedBy || t('brain.approvalGate.system')}</strong></span>
                    {latest.createdAt && (
                      <>
                        <span>{t('brain.approvalGate.on')} {new Date(latest.createdAt).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <>
              {workflowReadiness?.requiresVersionApproval && (
                <div className={`p-4 rounded-lg border space-y-2 ${
                  workflowReadiness.versionApproved
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : 'bg-amber-500/10 border-amber-500/20'
                }`}>
                  <div className="flex items-center gap-2">
                    {workflowReadiness.versionApproved ? (
                      <FileCheck className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    )}
                    <span className={`font-medium text-sm ${
                      workflowReadiness.versionApproved
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}>
                      {versionLabel} {t('brain.approvalGate.approvalStatus')}
                    </span>
                    {workflowReadiness.versionNumber && (
                      <Badge variant={workflowReadiness.versionApproved ? "default" : "secondary"} className="text-xs">
                        v{workflowReadiness.versionNumber}
                      </Badge>
                    )}
                    {workflowReadiness.versionStatus && (
                      <Badge variant="outline" className="text-xs">
                        {workflowReadiness.versionStatus.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground pl-7">
                    {workflowReadiness.message}
                  </p>
                  {workflowReadiness.versionApproved && workflowReadiness.approvedBy && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pl-7">
                      <User className="h-3 w-3" />
                      <span>{t('brain.approvalGate.approvedBy', { name: workflowReadiness.approvedBy })}</span>
                      {workflowReadiness.approvedAt && (
                        <span>{t('brain.approvalGate.on')} {new Date(workflowReadiness.approvedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <FileCheck className="h-4 w-4 text-primary" />
                    {t('brain.approvalGate.itemsRequiringApproval')}
                    {actionItems.length > 0 && (
                      <Badge variant="secondary" className="ml-1 text-[10px]">
                        {selectedActions.size}/{actionItems.length}
                      </Badge>
                    )}
                  </Label>
                  {actionItems.length > 1 && (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={selectAllActions}
                        className="text-primary hover:underline"
                      >
                        {t('brain.approvalGate.selectAll')}
                      </button>
                      <span className="text-muted-foreground">·</span>
                      <button
                        type="button"
                        onClick={clearAllActions}
                        className="text-muted-foreground hover:underline"
                      >
                        {t('brain.approvalGate.clearSelection')}
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  {t('brain.approvalGate.checklistHint')}
                </p>
                {actionItems.length === 0 ? (
                  <div className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">
                    {t('brain.approvalGate.insightsOnlyHint')}
                  </div>
                ) : (
                  <ScrollArea className="max-h-56 rounded-md border">
                    <div className="divide-y">
                      {actionItems.map((action, idx) => {
                        const act = action as Record<string, unknown>;
                        const name = String(act.title || act.name || act.actionType || act.type || `Action ${idx + 1}`);
                        const summary = String(act.summary || act.description || "");
                        const reason = String(act.reason || act.rationale || act.why || act.justification || "");
                        const kind = String(act.actionType || act.type || "planned");
                        const checked = selectedActions.has(idx);
                        const id = `action-${idx}`;
                        return (
                          <label
                            key={`${name}-${idx}`}
                            htmlFor={id}
                            className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                              checked ? 'bg-primary/5' : 'hover:bg-muted/50'
                            }`}
                          >
                            <Checkbox
                              id={id}
                              checked={checked}
                              onCheckedChange={() => toggleAction(idx)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-foreground">{name}</span>
                                <Badge variant="outline" className="text-[10px]">{kind}</Badge>
                              </div>
                              {summary && (
                                <p className="text-xs text-muted-foreground">{summary}</p>
                              )}
                              {reason && (
                                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                                  <Shield className="h-3 w-3 mt-0.5 shrink-0" />
                                  <span>
                                    <span className="font-medium">{t('brain.approvalGate.why')}:</span> {reason}
                                  </span>
                                </p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
                {needsVersionApproval && approvedSubset.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Lock className="h-3 w-3 shrink-0" />
                    {t('brain.approvalGate.actionsLocked', { label: versionLabel })}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t('brain.approvalGate.notes')}
                  <span className="ml-1 text-xs text-muted-foreground font-normal">
                    {t('brain.approvalGate.notesHint')}
                  </span>
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    if (notesError && e.target.value.trim()) setNotesError(false);
                  }}
                  placeholder={t('brain.approvalGate.enterNotes')}
                  rows={3}
                  className={notesError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {notesError && (
                  <p className="text-xs text-red-500">{t('brain.approvalGate.notesRequired')}</p>
                )}
              </div>

              <div className="space-y-2">
                <Button
                  onClick={() => handleSubmit("approve")}
                  disabled={isSubmitting || isExecuting || executeBlocked}
                  className="w-full"
                  size="lg"
                >
                  {(isSubmitting || isExecuting) && decision === "approve" ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      {isExecuting ? t('brain.approvalGate.executingActions') : t('brain.approvalGate.submitting')}
                    </>
                  ) : executeBlocked ? (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      {t('brain.approvalGate.awaitingApproval', { label: versionLabel })}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {approvedSubset.length > 0
                        ? t('brain.approvalGate.approveAndExecuteCount', { count: approvedSubset.length })
                        : t('brain.approvalGate.approveInsights')}
                    </>
                  )}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSubmit("revise")}
                    disabled={isSubmitting || isExecuting}
                  >
                    <RefreshCw className="h-4 w-4 mr-2 text-amber-500" />
                    {t('brain.approvalGate.requestRevision')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSubmit("reject")}
                    disabled={isSubmitting || isExecuting}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {t('brain.approvalGate.reject')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('brain.approvalGate.approvalHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('brain.approvalGate.noneYet')}</p>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {approvals.map((approval) => (
                  <div key={approval.approvalId} className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{approval.approvedBy || "System"}</span>
                        {!!(approval as Record<string, unknown>).approverEmail && (
                          <span className="text-xs text-muted-foreground">
                            {String((approval as Record<string, unknown>).approverEmail)}
                          </span>
                        )}
                      </div>
                      <Badge variant={
                        (approval.decision || (approval as Record<string, unknown>).status) === "approve" || (approval as Record<string, unknown>).status === "approved" ? "default" :
                        (approval.decision || (approval as Record<string, unknown>).status) === "revise" ? "secondary" : "destructive"
                      }>
                        {approval.decision || String((approval as Record<string, unknown>).status || "pending")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {approval.createdAt ? new Date(approval.createdAt).toLocaleString() : "N/A"}
                      {approval.approvalType && (
                        <>
                          <span>•</span>
                          <span>{approval.approvalType.replace("_", " ")}</span>
                        </>
                      )}
                    </div>
                    {(() => {
                      const a = approval as Record<string, unknown>;
                      const noteText = approval.notes || String(a.revisionNotes || a.rejectionReason || a.approvalReason || "");
                      return noteText ? (
                        <p className="text-sm text-muted-foreground mt-2 italic">
                          "{noteText}"
                        </p>
                      ) : null;
                    })()}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
