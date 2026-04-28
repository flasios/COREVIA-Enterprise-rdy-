import { History, Loader2, Send } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import HexagonLogoFrame from '@/components/shared/misc/HexagonLogoFrame';

type ApprovalHistoryItem = {
  version?: string | number;
  status?: string;
  submitted_at?: string;
  submitter_name?: string;
  reviewed_by?: string;
  reviewer_name?: string;
  rejection_reason?: string;
  review_notes?: string;
};

type PlanningApprovalDialogsProps = {
  submitOpen: boolean;
  onSubmitOpenChange: (open: boolean) => void;
  taskCount: number;
  completedTaskCount: number;
  progress: number;
  submitNotes: string;
  onSubmitNotesChange: (value: string) => void;
  onSubmitForApproval: () => void;
  isSubmitting: boolean;
  governanceOpen: boolean;
  onGovernanceOpenChange: (open: boolean) => void;
  wbsBrainDecision?: {
    decisionId?: string;
    governance?: unknown;
    readiness?: unknown;
  } | null;
  brainStatus: {
    badgeClass: string;
    label: string;
  };
  policyVerdict: string;
  contextScore: number | null;
  brainRiskLevel?: string | null;
  onOpenDecisionBrain: () => void;
  historyOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  approvalHistory: ApprovalHistoryItem[];
  noApprovalHistoryText: string;
};

function getApprovalStatusClass(status?: string): string {
  if (status === 'approved') return 'bg-emerald-500/20 text-emerald-600';
  if (status === 'rejected') return 'bg-red-500/20 text-red-600';
  if (status === 'pending_review') return 'bg-amber-500/20 text-amber-600';
  return 'bg-muted text-muted-foreground';
}

export function PlanningApprovalDialogs({
  submitOpen,
  onSubmitOpenChange,
  taskCount,
  completedTaskCount,
  progress,
  submitNotes,
  onSubmitNotesChange,
  onSubmitForApproval,
  isSubmitting,
  governanceOpen,
  onGovernanceOpenChange,
  wbsBrainDecision,
  brainStatus,
  policyVerdict,
  contextScore,
  brainRiskLevel,
  onOpenDecisionBrain,
  historyOpen,
  onHistoryOpenChange,
  approvalHistory,
  noApprovalHistoryText,
}: PlanningApprovalDialogsProps) {
  return (
    <>
      <Dialog open={submitOpen} onOpenChange={onSubmitOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-indigo-500" />
              Submit WBS for Approval
            </DialogTitle>
            <DialogDescription>
              Submit the Work Breakdown Structure to PMO for review and approval
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Tasks:</span>
                <span className="font-medium">{taskCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Completed:</span>
                <span className="font-medium text-emerald-600">{completedTaskCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress:</span>
                <span className="font-medium">{progress}%</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="submit-notes">Notes (optional)</Label>
              <Textarea
                id="submit-notes"
                placeholder="Add any notes for the reviewer..."
                value={submitNotes}
                onChange={(event) => onSubmitNotesChange(event.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onSubmitOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={onSubmitForApproval}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-indigo-600 to-purple-600"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Submit for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={governanceOpen} onOpenChange={onGovernanceOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HexagonLogoFrame px={20} />
              WBS Brain Governance
            </DialogTitle>
            <DialogDescription>
              Governance and context signals captured during WBS generation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Decision ID</div>
              <Badge variant="outline" className="text-xs">{wbsBrainDecision?.decisionId || 'Pending'}</Badge>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Status</div>
              <Badge className={brainStatus.badgeClass}>{brainStatus.label}</Badge>
            </div>
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Policy Verdict</span>
                <span className="font-medium">{policyVerdict}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Context Quality</span>
                <span className="font-medium">{contextScore === null ? 'Pending' : `${contextScore}%`}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Risk Level</span>
                <span className="font-medium capitalize">{brainRiskLevel || 'pending'}</span>
              </div>
            </div>
            {(Boolean(wbsBrainDecision?.governance) || Boolean(wbsBrainDecision?.readiness)) && (
              <div className="space-y-3">
                {Boolean(wbsBrainDecision?.governance) && (
                  <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Governance Notes</div>
                    <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
                      {JSON.stringify(wbsBrainDecision?.governance, null, 2)}
                    </pre>
                  </div>
                )}
                {Boolean(wbsBrainDecision?.readiness) && (
                  <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Readiness Signals</div>
                    <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
                      {JSON.stringify(wbsBrainDecision?.readiness, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onGovernanceOpenChange(false)}>
              Close
            </Button>
            <Button onClick={onOpenDecisionBrain}>
              Open Decision Brain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={onHistoryOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-500" />
              WBS Approval History
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {approvalHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>{noApprovalHistoryText}</p>
                </div>
              ) : (
                approvalHistory.map((item, index) => (
                  <div key={`approval-v${item.version}-${index}`} className="p-4 bg-muted/40 rounded-lg border border-border/50">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">v{item.version}</Badge>
                        <Badge className={`text-xs ${getApprovalStatusClass(item.status)}`}>
                          {item.status?.replaceAll('_', ' ')}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {item.submitted_at && new Date(item.submitted_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Submitted by: </span>
                      <span>{item.submitter_name || 'Unknown'}</span>
                    </div>
                    {item.reviewed_by && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Reviewed by: </span>
                        <span>{item.reviewer_name || 'PMO'}</span>
                      </div>
                    )}
                    {item.rejection_reason && (
                      <div className="mt-2 p-2 bg-red-500/10 rounded text-sm text-red-600">
                        {item.rejection_reason}
                      </div>
                    )}
                    {item.review_notes && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm">
                        {item.review_notes}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
