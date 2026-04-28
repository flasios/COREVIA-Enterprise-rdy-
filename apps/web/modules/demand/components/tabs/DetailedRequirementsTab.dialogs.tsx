import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle2, Loader2, Users, X, XCircle } from 'lucide-react';

interface EditConflictState {
  user: string;
}

type FallbackFailureKind = "policy_blocked" | "classification_blocked" | "provider_unavailable" | "pipeline_error";

interface FallbackDialogState {
  kind: FallbackFailureKind;
  reason: string;
}

interface DetailedRequirementsDialogsProps {
  showAiFallbackChoiceDialog: boolean;
  onAiFallbackChoiceDialogOpenChange: (open: boolean) => void;
  aiFallbackSections: string[];
  aiFallbackState: FallbackDialogState | null;
  onRetryAiOnly: () => void;
  onContinueAsTemplate: () => void;
  showApproveDialog: boolean;
  onApproveDialogOpenChange: (open: boolean) => void;
  approvalComments: string;
  onApprovalCommentsChange: (value: string) => void;
  onApprove: () => void;
  isApproving: boolean;
  showSendToDirectorDialog: boolean;
  onSendToDirectorDialogOpenChange: (open: boolean) => void;
  managerEmail: string;
  onManagerEmailChange: (value: string) => void;
  managerMessage: string;
  onManagerMessageChange: (value: string) => void;
  onSendToDirector: () => void;
  isSendingToDirector: boolean;
  showFinalApproveDialog: boolean;
  onFinalApproveDialogOpenChange: (open: boolean) => void;
  finalApprovalComments: string;
  onFinalApprovalCommentsChange: (value: string) => void;
  onFinalApprove: () => void;
  isFinalApproving: boolean;
  showEditConflictDialog: boolean;
  onEditConflictDialogOpenChange: (open: boolean) => void;
  editConflict: EditConflictState | null;
  latestVersionNumber?: string | number;
  onCancelMyEdit: () => void;
  onForceEdit: () => void;
}

export function DetailedRequirementsDialogs({
  showAiFallbackChoiceDialog,
  onAiFallbackChoiceDialogOpenChange,
  aiFallbackSections,
  aiFallbackState,
  onRetryAiOnly,
  onContinueAsTemplate,
  showApproveDialog,
  onApproveDialogOpenChange,
  approvalComments,
  onApprovalCommentsChange,
  onApprove,
  isApproving,
  showSendToDirectorDialog,
  onSendToDirectorDialogOpenChange,
  managerEmail,
  onManagerEmailChange,
  managerMessage,
  onManagerMessageChange,
  onSendToDirector,
  isSendingToDirector,
  showFinalApproveDialog,
  onFinalApproveDialogOpenChange,
  finalApprovalComments,
  onFinalApprovalCommentsChange,
  onFinalApprove,
  isFinalApproving,
  showEditConflictDialog,
  onEditConflictDialogOpenChange,
  editConflict,
  latestVersionNumber,
  onCancelMyEdit,
  onForceEdit,
}: Readonly<DetailedRequirementsDialogsProps>) {
  const { t } = useTranslation();
  const isPolicyBlocked = aiFallbackState?.kind === 'policy_blocked' || aiFallbackState?.kind === 'classification_blocked';

  return (
    <>
      <Dialog open={showAiFallbackChoiceDialog} onOpenChange={onAiFallbackChoiceDialogOpenChange}>
        <DialogContent className="glassmorphic sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isPolicyBlocked ? 'Policy Block Detected' : t('demand.tabs.requirements.aiGenerationUnavailable')}</DialogTitle>
            <DialogDescription>
              {isPolicyBlocked
                ? 'These requirements were classified for local-only governed processing. Engine A is still valid, but any external or hybrid AI route is blocked for this request.'
                : t('demand.tabs.requirements.aiGenerationCouldNotComplete')}
              {aiFallbackSections.length > 0
                ? ` ${t('demand.tabs.requirements.affectedSections')}: ${aiFallbackSections.join(', ')}.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {aiFallbackState?.reason ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {aiFallbackState.reason}
            </div>
          ) : null}
          <div className="text-sm text-muted-foreground">
            {isPolicyBlocked ? 'You can continue without AI generation.' : t('demand.tabs.requirements.chooseTemplateOrRetry')}
          </div>
          <DialogFooter>
            {isPolicyBlocked ? null : (
              <Button variant="outline" onClick={onRetryAiOnly}>
                {t('demand.tabs.requirements.retryAiOnly')}
              </Button>
            )}
            <Button onClick={onContinueAsTemplate}>
              {t('demand.tabs.requirements.continueAsTemplate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showApproveDialog} onOpenChange={onApproveDialogOpenChange}>
        <DialogContent className="glassmorphic">
          <DialogHeader>
            <DialogTitle>{t('demand.tabs.requirements.initialApproval')}</DialogTitle>
            <DialogDescription>
              {t('demand.tabs.requirements.approveVersionDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="approval-comments">{t('demand.tabs.requirements.commentsOptional')}</Label>
              <Textarea
                id="approval-comments"
                value={approvalComments}
                onChange={(event) => onApprovalCommentsChange(event.target.value)}
                placeholder={t('demand.tabs.requirements.addApprovalComments')}
                className="mt-1"
                data-testid="textarea-approval-comments-requirements"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onApproveDialogOpenChange(false)}>
              {t('demand.tabs.requirements.cancel')}
            </Button>
            <Button onClick={onApprove} disabled={isApproving} data-testid="button-confirm-approve-requirements">
              {isApproving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('demand.tabs.requirements.approving')}
                </>
              ) : (
                t('demand.tabs.requirements.approveVersion')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSendToDirectorDialog} onOpenChange={onSendToDirectorDialogOpenChange}>
        <DialogContent className="glassmorphic">
          <DialogHeader>
            <DialogTitle>{t('demand.tabs.requirements.submitForDirectorApproval')}</DialogTitle>
            <DialogDescription>
              {t('demand.tabs.requirements.sendToDirectorDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="director-email">{t('demand.tabs.requirements.directorEmail')} *</Label>
              <Input
                id="director-email"
                type="email"
                value={managerEmail}
                onChange={(event) => onManagerEmailChange(event.target.value)}
                placeholder="director@example.com"
                className="mt-1"
                data-testid="input-director-email"
              />
            </div>
            <div>
              <Label htmlFor="director-message">{t('demand.tabs.requirements.messageToDirector')}</Label>
              <Textarea
                id="director-message"
                value={managerMessage}
                onChange={(event) => onManagerMessageChange(event.target.value)}
                placeholder={t('demand.tabs.requirements.addDirectorMessage')}
                className="mt-1"
                data-testid="textarea-director-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onSendToDirectorDialogOpenChange(false)}>
              {t('demand.tabs.requirements.cancel')}
            </Button>
            <Button
              onClick={onSendToDirector}
              disabled={!managerEmail || isSendingToDirector}
              data-testid="button-confirm-send-director"
            >
              {isSendingToDirector ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('demand.tabs.requirements.sending')}
                </>
              ) : (
                t('demand.tabs.requirements.submitForDirectorApproval')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFinalApproveDialog} onOpenChange={onFinalApproveDialogOpenChange}>
        <DialogContent className="glassmorphic">
          <DialogHeader>
            <DialogTitle>{t('demand.tabs.requirements.finalApprovalPublish')}</DialogTitle>
            <DialogDescription>
              {t('demand.tabs.requirements.finalApprovalDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="final-approval-comments">{t('demand.tabs.requirements.commentsOptional')}</Label>
              <Textarea
                id="final-approval-comments"
                value={finalApprovalComments}
                onChange={(event) => onFinalApprovalCommentsChange(event.target.value)}
                placeholder={t('demand.tabs.requirements.addFinalApprovalComments')}
                className="mt-1"
                data-testid="textarea-final-approval-comments"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onFinalApproveDialogOpenChange(false)}>
              {t('demand.tabs.requirements.cancel')}
            </Button>
            <Button
              onClick={onFinalApprove}
              disabled={isFinalApproving}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              data-testid="button-confirm-final-approve"
            >
              {isFinalApproving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('demand.tabs.requirements.publishing')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t('demand.tabs.requirements.approveAndPublish')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditConflictDialog} onOpenChange={onEditConflictDialogOpenChange}>
        <DialogContent className="glassmorphic">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              {t('demand.tabs.requirements.editConflictDetected')}
            </DialogTitle>
            <DialogDescription>
              {t('demand.tabs.requirements.editConflictDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
              <Users className="h-10 w-10 text-amber-600 dark:text-amber-400" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  {t('demand.tabs.requirements.userCurrentlyEditing', { user: editConflict?.user })}
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  {t('demand.tabs.requirements.version')}: {latestVersionNumber}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t('demand.tabs.requirements.toPreventConflicts')}
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                <li>{t('demand.tabs.requirements.waitForOtherUser')}</li>
                <li>{t('demand.tabs.requirements.coordinateWithUser')}</li>
                <li>{t('demand.tabs.requirements.createNewBranch')}</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCancelMyEdit} data-testid="button-cancel-edit-conflict">
              <X className="mr-2 h-4 w-4" />
              {t('demand.tabs.requirements.cancelMyEdit')}
            </Button>
            <Button variant="destructive" onClick={onForceEdit} data-testid="button-force-edit-conflict">
              <AlertCircle className="mr-2 h-4 w-4" />
              {t('demand.tabs.requirements.editAnywayRisk')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}