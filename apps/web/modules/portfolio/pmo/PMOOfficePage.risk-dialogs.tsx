import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RiskApprovalDialogItem = {
  projectId: string;
  projectName?: string | null;
  version?: number | null;
  stats?: { total?: number | null } | null;
};

type PMOOfficeRiskDialogsProps = {
  approveOpen: boolean;
  onApproveOpenChange: (open: boolean) => void;
  rejectOpen: boolean;
  onRejectOpenChange: (open: boolean) => void;
  selectedRiskApproval: RiskApprovalDialogItem | null;
  reviewNotes: string;
  onReviewNotesChange: (value: string) => void;
  rejectionReason: string;
  onRejectionReasonChange: (value: string) => void;
  approvePending: boolean;
  rejectPending: boolean;
  onApproveCancel: () => void;
  onApproveConfirm: () => void;
  onRejectCancel: () => void;
  onRejectConfirm: () => void;
};

export default function PMOOfficeRiskDialogs({
  approveOpen,
  onApproveOpenChange,
  rejectOpen,
  onRejectOpenChange,
  selectedRiskApproval,
  reviewNotes,
  onReviewNotesChange,
  rejectionReason,
  onRejectionReasonChange,
  approvePending,
  rejectPending,
  onApproveCancel,
  onApproveConfirm,
  onRejectCancel,
  onRejectConfirm,
}: PMOOfficeRiskDialogsProps) {
  return (
    <>
      <Dialog open={approveOpen} onOpenChange={onApproveOpenChange}>
        <DialogContent data-testid="risk-approve-dialog">
          <DialogHeader>
            <DialogTitle>Approve Risk Register</DialogTitle>
            <DialogDescription>
              {selectedRiskApproval
                ? `Approve the risk register baseline for "${selectedRiskApproval.projectName}" (v${selectedRiskApproval.version}, ${selectedRiskApproval.stats?.total ?? 0} risks).`
                : "Approve the risk register baseline."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="risk-approve-notes">Review notes (optional)</Label>
            <Textarea
              id="risk-approve-notes"
              value={reviewNotes}
              onChange={(event) => onReviewNotesChange(event.target.value)}
              placeholder="Add any notes for the project manager..."
              rows={4}
              data-testid="risk-approve-notes"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onApproveCancel}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!selectedRiskApproval || approvePending}
              onClick={onApproveConfirm}
              data-testid="risk-approve-confirm"
            >
              {approvePending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Approve Baseline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={onRejectOpenChange}>
        <DialogContent data-testid="risk-reject-dialog">
          <DialogHeader>
            <DialogTitle>Return Risk Register for Revision</DialogTitle>
            <DialogDescription>
              {selectedRiskApproval
                ? `Return the risk register for "${selectedRiskApproval.projectName}" with revision guidance.`
                : "Return the risk register for revision."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="risk-reject-reason">Reason (required)</Label>
              <Textarea
                id="risk-reject-reason"
                value={rejectionReason}
                onChange={(event) => onRejectionReasonChange(event.target.value)}
                placeholder="e.g. Missing cybersecurity risks, mitigation owners incomplete..."
                rows={3}
                data-testid="risk-reject-reason"
              />
            </div>
            <div>
              <Label htmlFor="risk-reject-notes">Additional notes (optional)</Label>
              <Textarea
                id="risk-reject-notes"
                value={reviewNotes}
                onChange={(event) => onReviewNotesChange(event.target.value)}
                rows={3}
                data-testid="risk-reject-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onRejectCancel}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!selectedRiskApproval || !rejectionReason.trim() || rejectPending}
              onClick={onRejectConfirm}
              data-testid="risk-reject-confirm"
            >
              {rejectPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
              Return for Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
