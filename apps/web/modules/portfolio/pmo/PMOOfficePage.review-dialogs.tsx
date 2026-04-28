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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
import { CheckCircle2, FileText, Loader2, XCircle } from "lucide-react";

type ConversionRequestDetails = {
  id: string;
  projectName: string;
  projectDescription: string | null;
  priority: string;
  status: "pending" | "under_review" | "approved" | "rejected";
  proposedBudget: string | null;
  proposedStartDate: string | null;
  proposedEndDate: string | null;
  requestedByName: string | null;
  createdAt: string;
  conversionData: Record<string, string | string[] | number | boolean | undefined>;
};

type ChangeRequestDialogData = {
  id: string;
  title: string;
  code: string;
  changeType: string;
  projectName: string;
  description: string;
  justification?: string | null;
};

type PMOOfficeReviewDialogsProps = {
  crApproveDialogOpen: boolean;
  onCrApproveDialogOpenChange: (open: boolean) => void;
  selectedChangeRequest: ChangeRequestDialogData | null;
  crReviewNotes: string;
  onCrReviewNotesChange: (value: string) => void;
  onCrApproveCancel: () => void;
  onCrApproveConfirm: () => void;
  approveCrPending: boolean;
  crRejectDialogOpen: boolean;
  onCrRejectDialogOpenChange: (open: boolean) => void;
  crRejectionReason: string;
  onCrRejectionReasonChange: (value: string) => void;
  onCrRejectCancel: () => void;
  onCrRejectConfirm: () => void;
  rejectCrPending: boolean;
  viewDetailsDialogOpen: boolean;
  onViewDetailsDialogOpenChange: (open: boolean) => void;
  selectedRequest: ConversionRequestDetails | null;
  onCloseDetails: () => void;
  onOpenRejectFromDetails: () => void;
  onOpenApproveFromDetails: () => void;
};

export default function PMOOfficeReviewDialogs({
  crApproveDialogOpen,
  onCrApproveDialogOpenChange,
  selectedChangeRequest,
  crReviewNotes,
  onCrReviewNotesChange,
  onCrApproveCancel,
  onCrApproveConfirm,
  approveCrPending,
  crRejectDialogOpen,
  onCrRejectDialogOpenChange,
  crRejectionReason,
  onCrRejectionReasonChange,
  onCrRejectCancel,
  onCrRejectConfirm,
  rejectCrPending,
  viewDetailsDialogOpen,
  onViewDetailsDialogOpenChange,
  selectedRequest,
  onCloseDetails,
  onOpenRejectFromDetails,
  onOpenApproveFromDetails,
}: PMOOfficeReviewDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      <Dialog open={crApproveDialogOpen} onOpenChange={onCrApproveDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              {t("pmo.office.approveCr")}
            </DialogTitle>
            <DialogDescription>{t("pmo.office.approveCrDesc")}</DialogDescription>
          </DialogHeader>

          {selectedChangeRequest && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-semibold">{selectedChangeRequest.title}</p>
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <Badge variant="outline" className="font-mono text-xs">
                    {selectedChangeRequest.code}
                  </Badge>
                  <Badge
                    className={`text-xs ${
                      selectedChangeRequest.changeType === "timeline"
                        ? "bg-blue-500/20 text-blue-400"
                        : selectedChangeRequest.changeType === "scope"
                          ? "bg-purple-500/20 text-purple-400"
                          : selectedChangeRequest.changeType === "budget"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-orange-500/20 text-orange-400"
                    }`}
                  >
                    {selectedChangeRequest.changeType}
                  </Badge>
                  <span className="text-muted-foreground">{selectedChangeRequest.projectName}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{selectedChangeRequest.description}</p>
                {selectedChangeRequest.justification && (
                  <div className="mt-2 border-t border-border pt-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("pmo.office.justification")}
                    </span>
                    <p className="mt-1 text-sm">{selectedChangeRequest.justification}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="crApprovalNotes">{t("pmo.office.reviewNotesOptional")}</Label>
                <Textarea
                  id="crApprovalNotes"
                  value={crReviewNotes}
                  onChange={(event) => onCrReviewNotesChange(event.target.value)}
                  placeholder={t("pmo.office.approvalNotesPlaceholder")}
                  className="h-24"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onCrApproveCancel} disabled={approveCrPending}>
              {t("pmo.office.cancel")}
            </Button>
            <Button
              onClick={onCrApproveConfirm}
              disabled={approveCrPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {approveCrPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {t("pmo.office.approveCr")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={crRejectDialogOpen} onOpenChange={onCrRejectDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              {t("pmo.office.rejectCr")}
            </DialogTitle>
            <DialogDescription>{t("pmo.office.rejectCrDesc")}</DialogDescription>
          </DialogHeader>

          {selectedChangeRequest && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-semibold">{selectedChangeRequest.title}</p>
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <Badge variant="outline" className="font-mono text-xs">
                    {selectedChangeRequest.code}
                  </Badge>
                  <span className="text-muted-foreground">{selectedChangeRequest.projectName}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="crRejectionReason">
                  {t("pmo.office.reasonForRejection")} <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="crRejectionReason"
                  value={crRejectionReason}
                  onChange={(event) => onCrRejectionReasonChange(event.target.value)}
                  placeholder={t("pmo.office.crRejectionPlaceholder")}
                  className="h-24"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="crRejectionNotes">{t("pmo.office.additionalNotesOptional")}</Label>
                <Textarea
                  id="crRejectionNotes"
                  value={crReviewNotes}
                  onChange={(event) => onCrReviewNotesChange(event.target.value)}
                  placeholder={t("pmo.office.additionalNotesPlaceholder")}
                  className="h-20"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onCrRejectCancel} disabled={rejectCrPending}>
              {t("pmo.office.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={onCrRejectConfirm}
              disabled={rejectCrPending || !crRejectionReason.trim()}
            >
              {rejectCrPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              {t("pmo.office.rejectCr")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDetailsDialogOpen} onOpenChange={onViewDetailsDialogOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {t("pmo.office.conversionRequestDetails")}
            </DialogTitle>
            <DialogDescription>{t("pmo.office.conversionRequestDetailsDesc")}</DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{selectedRequest.projectName}</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedRequest.status === "pending" ? "secondary" : "default"}>
                      {selectedRequest.status === "pending"
                        ? t("pmo.office.pendingReview")
                        : t("pmo.office.underReview")}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {selectedRequest.priority}
                    </Badge>
                  </div>
                </div>

                {selectedRequest.projectDescription && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-sm text-muted-foreground">{selectedRequest.projectDescription}</p>
                  </div>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("pmo.office.proposedBudget")}</Label>
                  <p className="font-medium">
                    {selectedRequest.proposedBudget
                      ? `AED ${parseFloat(selectedRequest.proposedBudget).toLocaleString()}`
                      : t("pmo.office.notSpecified")}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("pmo.office.priorityLevel")}</Label>
                  <p className="font-medium capitalize">{selectedRequest.priority}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("pmo.office.proposedStartDate")}</Label>
                  <p className="font-medium">
                    {selectedRequest.proposedStartDate
                      ? new Date(selectedRequest.proposedStartDate).toLocaleDateString()
                      : t("pmo.office.notSpecified")}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("pmo.office.proposedEndDate")}</Label>
                  <p className="font-medium">
                    {selectedRequest.proposedEndDate
                      ? new Date(selectedRequest.proposedEndDate).toLocaleDateString()
                      : t("pmo.office.notSpecified")}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("pmo.office.requestedBy")}</Label>
                  <p className="font-medium">{selectedRequest.requestedByName || "Unknown"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("pmo.office.submittedOn")}</Label>
                  <p className="font-medium">{new Date(selectedRequest.createdAt).toLocaleString()}</p>
                </div>
              </div>

              {selectedRequest.conversionData && Object.keys(selectedRequest.conversionData).length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="font-medium">{t("pmo.office.additionalConversionData")}</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {Object.entries(selectedRequest.conversionData).map(([key, value]) => (
                        <div key={key} className="rounded bg-muted/30 p-2">
                          <span className="capitalize text-muted-foreground">
                            {key.replace(/_/g, " ")}: 
                          </span>
                          <span className="font-medium">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={onCloseDetails} data-testid="button-close-details">
                  {t("pmo.office.close")}
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={onOpenRejectFromDetails} data-testid="button-details-reject">
                    <XCircle className="mr-1 h-4 w-4" />
                    {t("pmo.office.reject")}
                  </Button>
                  <Button onClick={onOpenApproveFromDetails} data-testid="button-details-approve">
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    {t("pmo.office.approve")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}