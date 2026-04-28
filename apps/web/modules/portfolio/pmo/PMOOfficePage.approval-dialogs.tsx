import { Badge } from "@/components/ui/badge";
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
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type ConversionRequestDialogData = {
  id: string;
  projectName: string;
  projectDescription: string | null;
  priority: string;
  proposedBudget: string | null;
};

type WbsApprovalDialogData = {
  id: string;
  project_name: string;
  version: number;
  task_snapshot: unknown[] | null;
};

type GateApprovalDialogData = {
  id: string;
  project_name: string;
  gate_type: string;
  department: string | null;
};

type PMOOfficeApprovalDialogsProps = {
  approveDialogOpen: boolean;
  onApproveDialogOpenChange: (open: boolean) => void;
  selectedRequest: ConversionRequestDialogData | null;
  decisionNotes: string;
  onDecisionNotesChange: (value: string) => void;
  onApproveCancel: () => void;
  onApproveConfirm: () => void;
  approvePending: boolean;
  rejectDialogOpen: boolean;
  onRejectDialogOpenChange: (open: boolean) => void;
  rejectionReason: string;
  onRejectionReasonChange: (value: string) => void;
  onRejectCancel: () => void;
  onRejectConfirm: () => void;
  rejectPending: boolean;
  wbsApproveDialogOpen: boolean;
  onWbsApproveDialogOpenChange: (open: boolean) => void;
  selectedWbsApproval: WbsApprovalDialogData | null;
  wbsReviewNotes: string;
  onWbsReviewNotesChange: (value: string) => void;
  onWbsApproveCancel: () => void;
  onWbsApproveConfirm: () => void;
  approveWbsPending: boolean;
  wbsRejectDialogOpen: boolean;
  onWbsRejectDialogOpenChange: (open: boolean) => void;
  wbsRejectionReason: string;
  onWbsRejectionReasonChange: (value: string) => void;
  onWbsRejectCancel: () => void;
  onWbsRejectConfirm: () => void;
  rejectWbsPending: boolean;
  gateApproveDialogOpen: boolean;
  onGateApproveDialogOpenChange: (open: boolean) => void;
  selectedGateApproval: GateApprovalDialogData | null;
  gateReviewNotes: string;
  onGateReviewNotesChange: (value: string) => void;
  onGateApproveCancel: () => void;
  onGateApproveConfirm: () => void;
  approveGatePending: boolean;
  gateRejectDialogOpen: boolean;
  onGateRejectDialogOpenChange: (open: boolean) => void;
  gateRejectionReason: string;
  onGateRejectionReasonChange: (value: string) => void;
  onGateRejectCancel: () => void;
  onGateRejectConfirm: () => void;
  rejectGatePending: boolean;
};

export default function PMOOfficeApprovalDialogs({
  approveDialogOpen,
  onApproveDialogOpenChange,
  selectedRequest,
  decisionNotes,
  onDecisionNotesChange,
  onApproveCancel,
  onApproveConfirm,
  approvePending,
  rejectDialogOpen,
  onRejectDialogOpenChange,
  rejectionReason,
  onRejectionReasonChange,
  onRejectCancel,
  onRejectConfirm,
  rejectPending,
  wbsApproveDialogOpen,
  onWbsApproveDialogOpenChange,
  selectedWbsApproval,
  wbsReviewNotes,
  onWbsReviewNotesChange,
  onWbsApproveCancel,
  onWbsApproveConfirm,
  approveWbsPending,
  wbsRejectDialogOpen,
  onWbsRejectDialogOpenChange,
  wbsRejectionReason,
  onWbsRejectionReasonChange,
  onWbsRejectCancel,
  onWbsRejectConfirm,
  rejectWbsPending,
  gateApproveDialogOpen,
  onGateApproveDialogOpenChange,
  selectedGateApproval,
  gateReviewNotes,
  onGateReviewNotesChange,
  onGateApproveCancel,
  onGateApproveConfirm,
  approveGatePending,
  gateRejectDialogOpen,
  onGateRejectDialogOpenChange,
  gateRejectionReason,
  onGateRejectionReasonChange,
  onGateRejectCancel,
  onGateRejectConfirm,
  rejectGatePending,
}: PMOOfficeApprovalDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      <Dialog open={approveDialogOpen} onOpenChange={onApproveDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              {t("pmo.office.approveConversion")}
            </DialogTitle>
            <DialogDescription>{t("pmo.office.approveConversionDesc")}</DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-semibold">{selectedRequest.projectName}</p>
                {selectedRequest.projectDescription && (
                  <p className="text-sm text-muted-foreground">{selectedRequest.projectDescription}</p>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="outline" className="capitalize">
                    {selectedRequest.priority}
                  </Badge>
                  {selectedRequest.proposedBudget && (
                    <span className="text-muted-foreground">
                      Budget: AED {parseFloat(selectedRequest.proposedBudget).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="approvalNotes">{t("pmo.office.approvalNotesOptional")}</Label>
                <Textarea
                  id="approvalNotes"
                  value={decisionNotes}
                  onChange={(event) => onDecisionNotesChange(event.target.value)}
                  placeholder={t("pmo.office.approvalNotesPlaceholder")}
                  className="h-24"
                  data-testid="textarea-approval-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={onApproveCancel}
              disabled={approvePending}
              data-testid="button-cancel-approval"
            >
              {t("pmo.office.cancel")}
            </Button>
            <Button
              onClick={onApproveConfirm}
              disabled={approvePending}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-confirm-approval"
            >
              {approvePending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {t("pmo.office.approveCreateProject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={onRejectDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              {t("pmo.office.rejectConversion")}
            </DialogTitle>
            <DialogDescription>{t("pmo.office.rejectConversionDesc")}</DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-semibold">{selectedRequest.projectName}</p>
                {selectedRequest.projectDescription && (
                  <p className="text-sm text-muted-foreground">{selectedRequest.projectDescription}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejectionReason">{t("pmo.office.reasonForRejection")}</Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(event) => onRejectionReasonChange(event.target.value)}
                  placeholder={t("pmo.office.rejectionReasonPlaceholder")}
                  className="h-24"
                  data-testid="textarea-rejection-reason"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejectionNotes">{t("pmo.office.additionalNotesOptional")}</Label>
                <Textarea
                  id="rejectionNotes"
                  value={decisionNotes}
                  onChange={(event) => onDecisionNotesChange(event.target.value)}
                  placeholder={t("pmo.office.additionalNotesPlaceholder")}
                  className="h-20"
                  data-testid="textarea-rejection-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={onRejectCancel}
              disabled={rejectPending}
              data-testid="button-cancel-rejection"
            >
              {t("pmo.office.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={onRejectConfirm}
              disabled={rejectPending || !rejectionReason.trim()}
              data-testid="button-confirm-rejection"
            >
              {rejectPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              {t("pmo.office.rejectRequest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={wbsApproveDialogOpen} onOpenChange={onWbsApproveDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              {t("pmo.office.approveWbs")}
            </DialogTitle>
            <DialogDescription>{t("pmo.office.approveWbsDesc")}</DialogDescription>
          </DialogHeader>

          {selectedWbsApproval && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-semibold">{selectedWbsApproval.project_name || "Project WBS"}</p>
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="outline">Version {selectedWbsApproval.version}</Badge>
                  {selectedWbsApproval.task_snapshot && (
                    <span className="text-muted-foreground">
                      {Array.isArray(selectedWbsApproval.task_snapshot)
                        ? selectedWbsApproval.task_snapshot.length
                        : 0}{" "}
                      Tasks
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wbsApprovalNotes">{t("pmo.office.reviewNotesOptional")}</Label>
                <Textarea
                  id="wbsApprovalNotes"
                  value={wbsReviewNotes}
                  onChange={(event) => onWbsReviewNotesChange(event.target.value)}
                  placeholder={t("pmo.office.approvalNotesPlaceholder")}
                  className="h-24"
                  data-testid="textarea-wbs-approval-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={onWbsApproveCancel}
              disabled={approveWbsPending}
              data-testid="button-cancel-wbs-approval"
            >
              {t("pmo.office.cancel")}
            </Button>
            <Button
              onClick={onWbsApproveConfirm}
              disabled={approveWbsPending}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-confirm-wbs-approval"
            >
              {approveWbsPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {t("pmo.office.approveLockWbs")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={wbsRejectDialogOpen} onOpenChange={onWbsRejectDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              {t("pmo.office.rejectWbs")}
            </DialogTitle>
            <DialogDescription>{t("pmo.office.rejectWbsDesc")}</DialogDescription>
          </DialogHeader>

          {selectedWbsApproval && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-semibold">{selectedWbsApproval.project_name || "Project WBS"}</p>
                <Badge variant="outline">Version {selectedWbsApproval.version}</Badge>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wbsRejectionReason">{t("pmo.office.reasonForRejection")}</Label>
                <Textarea
                  id="wbsRejectionReason"
                  value={wbsRejectionReason}
                  onChange={(event) => onWbsRejectionReasonChange(event.target.value)}
                  placeholder={t("pmo.office.wbsRejectionPlaceholder")}
                  className="h-24"
                  data-testid="textarea-wbs-rejection-reason"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wbsRejectionNotes">{t("pmo.office.additionalNotesOptional")}</Label>
                <Textarea
                  id="wbsRejectionNotes"
                  value={wbsReviewNotes}
                  onChange={(event) => onWbsReviewNotesChange(event.target.value)}
                  placeholder={t("pmo.office.additionalNotesPlaceholder")}
                  className="h-20"
                  data-testid="textarea-wbs-rejection-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={onWbsRejectCancel}
              disabled={rejectWbsPending}
              data-testid="button-cancel-wbs-rejection"
            >
              {t("pmo.office.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={onWbsRejectConfirm}
              disabled={rejectWbsPending || !wbsRejectionReason.trim()}
              data-testid="button-confirm-wbs-rejection"
            >
              {rejectWbsPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              {t("pmo.office.rejectWbsBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={gateApproveDialogOpen} onOpenChange={onGateApproveDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              {t("pmo.office.approveGate")}
            </DialogTitle>
            <DialogDescription>{t("pmo.office.approveGateDesc")}</DialogDescription>
          </DialogHeader>

          {selectedGateApproval && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-semibold">{selectedGateApproval.project_name || "Project"}</p>
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="outline" className="capitalize">
                    {selectedGateApproval.gate_type} Gate
                  </Badge>
                  {selectedGateApproval.department && (
                    <span className="text-muted-foreground">{selectedGateApproval.department}</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gateApprovalNotes">{t("pmo.office.reviewNotesOptional")}</Label>
                <Textarea
                  id="gateApprovalNotes"
                  value={gateReviewNotes}
                  onChange={(event) => onGateReviewNotesChange(event.target.value)}
                  placeholder={t("pmo.office.approvalNotesPlaceholder")}
                  className="h-24"
                  data-testid="textarea-gate-approval-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={onGateApproveCancel}
              disabled={approveGatePending}
              data-testid="button-cancel-gate-approval"
            >
              {t("pmo.office.cancel")}
            </Button>
            <Button
              onClick={onGateApproveConfirm}
              disabled={approveGatePending}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-confirm-gate-approval"
            >
              {approveGatePending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {t("pmo.office.approveGateBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={gateRejectDialogOpen} onOpenChange={onGateRejectDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              {t("pmo.office.rejectGate")}
            </DialogTitle>
            <DialogDescription>{t("pmo.office.rejectGateDesc")}</DialogDescription>
          </DialogHeader>

          {selectedGateApproval && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-semibold">{selectedGateApproval.project_name || "Project"}</p>
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="outline" className="capitalize">
                    {selectedGateApproval.gate_type} Gate
                  </Badge>
                  {selectedGateApproval.department && (
                    <span className="text-muted-foreground">{selectedGateApproval.department}</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gateRejectionReason">
                  {t("pmo.office.reasonForRejection")} <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="gateRejectionReason"
                  value={gateRejectionReason}
                  onChange={(event) => onGateRejectionReasonChange(event.target.value)}
                  placeholder={t("pmo.office.gateRejectionPlaceholder")}
                  className="h-24"
                  data-testid="textarea-gate-rejection-reason"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gateRejectionNotes">{t("pmo.office.additionalNotesOptional")}</Label>
                <Textarea
                  id="gateRejectionNotes"
                  value={gateReviewNotes}
                  onChange={(event) => onGateReviewNotesChange(event.target.value)}
                  placeholder={t("pmo.office.additionalNotesPlaceholder")}
                  className="h-20"
                  data-testid="textarea-gate-rejection-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={onGateRejectCancel}
              disabled={rejectGatePending}
              data-testid="button-cancel-gate-rejection"
            >
              {t("pmo.office.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={onGateRejectConfirm}
              disabled={rejectGatePending || !gateRejectionReason.trim()}
              data-testid="button-confirm-gate-rejection"
            >
              {rejectGatePending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              {t("pmo.office.rejectGateBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}