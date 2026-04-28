import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, Cpu, FileText, Shield, ShieldCheck } from 'lucide-react';

interface GovernancePendingInfo {
  requestId: string;
  requestNumber: string;
  status: string;
  governance?: {
    action: string;
    rule: string;
    reason?: string;
  };
  readiness?: {
    score: number;
    canProceed: boolean;
  };
}

interface InternalEngineStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

type FallbackFailureKind = "policy_blocked" | "classification_blocked" | "provider_unavailable" | "pipeline_error";

interface FallbackDialogState {
  kind: FallbackFailureKind;
  reason: string;
}

interface BusinessCaseFallbackDialogsProps {
  showAiFallbackChoiceDialog: boolean;
  onAiFallbackChoiceDialogOpenChange: (open: boolean) => void;
  aiFallbackSections: string[];
  aiFallbackState: FallbackDialogState | null;
  onRetryAiOnly: () => void;
  onUseEmptyTemplate: () => void;
  onUseTemplateData: () => void;
  showInternalEngineStartDialog: boolean;
  onInternalEngineStartDialogOpenChange: (open: boolean) => void;
  onConfirmInternalGeneration: () => void;
  showGovernancePendingDialog: boolean;
  onGovernancePendingDialogOpenChange: (open: boolean) => void;
  governancePendingInfo: GovernancePendingInfo | null;
  onGoToDecisionBrain: () => void;
}

export function InternalEngineStartDialog({ open, onOpenChange, onConfirm }: Readonly<InternalEngineStartDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]" data-testid="dialog-engine-a-start">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            Engine A Will Be Used For This Draft
          </DialogTitle>
          <DialogDescription>
            This business case is planned for the sovereign internal route. Processing will stay on the sovereign engine boundary and may take noticeably longer than a hybrid run.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <Cpu className="mt-0.5 h-4 w-4 text-amber-700" />
            <div className="space-y-2">
              <p className="font-medium text-foreground">What to expect</p>
              <p className="text-muted-foreground">Large business cases can take several minutes on Engine A, especially when the system performs deeper reasoning, quality repair, or clarification handling.</p>
              <p className="text-muted-foreground">You will still see live generation progress while the run stays inside the internal processing boundary.</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-engine-a-start">
            Cancel
          </Button>
          <Button onClick={onConfirm} className="bg-amber-600 text-white hover:bg-amber-700" data-testid="button-confirm-engine-a-start">
            Continue With Engine A
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BusinessCaseFallbackDialogs({
  showAiFallbackChoiceDialog,
  onAiFallbackChoiceDialogOpenChange,
  aiFallbackSections,
  aiFallbackState,
  onRetryAiOnly,
  onUseEmptyTemplate,
  onUseTemplateData,
  showInternalEngineStartDialog,
  onInternalEngineStartDialogOpenChange,
  onConfirmInternalGeneration,
  showGovernancePendingDialog,
  onGovernancePendingDialogOpenChange,
  governancePendingInfo,
  onGoToDecisionBrain,
}: Readonly<BusinessCaseFallbackDialogsProps>) {
  const { t } = useTranslation();
  const isPolicyBlocked = aiFallbackState?.kind === 'policy_blocked' || aiFallbackState?.kind === 'classification_blocked';

  return (
    <>
      <Dialog open={showAiFallbackChoiceDialog} onOpenChange={onAiFallbackChoiceDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              {isPolicyBlocked ? 'Policy Block Detected' : t('demand.tabs.businessCase.aiGenerationUnavailable')}
            </DialogTitle>
            <DialogDescription>
              {isPolicyBlocked
                ? 'This business case was classified for local-only governed processing. Engine A is still valid, but any external or hybrid AI route is blocked for this request.'
                : t('demand.tabs.businessCase.aiGenerationCouldNotComplete')}
              {aiFallbackSections.length > 0
                ? ` ${t('demand.tabs.businessCase.affectedSections')}: ${aiFallbackSections.join(', ')}.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {aiFallbackState?.reason ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {aiFallbackState.reason}
            </div>
          ) : null}
          <div className="space-y-3 py-2">
            <div className="text-sm text-muted-foreground">
              {isPolicyBlocked ? 'You can continue without AI generation:' : `${t('demand.tabs.businessCase.youCanChoose')}:`}
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li><strong>{t('demand.tabs.businessCase.useEmptyTemplate')}</strong> - {t('demand.tabs.businessCase.useEmptyTemplateDesc')}</li>
              <li><strong>{t('demand.tabs.businessCase.useTemplateData')}</strong> - {t('demand.tabs.businessCase.useTemplateDataDesc')}</li>
              {isPolicyBlocked ? null : <li><strong>{t('demand.tabs.businessCase.retryAiOnly')}</strong> - {t('demand.tabs.businessCase.retryAiOnlyDesc')}</li>}
            </ul>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            {isPolicyBlocked ? null : (
              <Button variant="outline" onClick={onRetryAiOnly}>
                {t('demand.tabs.businessCase.retryAiOnly')}
              </Button>
            )}
            <Button variant="outline" onClick={onUseEmptyTemplate}>
              {t('demand.tabs.businessCase.useEmptyTemplate')}
            </Button>
            <Button onClick={onUseTemplateData} className="bg-amber-600 text-white hover:bg-amber-700">
              {t('demand.tabs.businessCase.useTemplateData')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InternalEngineStartDialog
        open={showInternalEngineStartDialog}
        onOpenChange={onInternalEngineStartDialogOpenChange}
        onConfirm={onConfirmInternalGeneration}
      />

      <Dialog open={showGovernancePendingDialog} onOpenChange={onGovernancePendingDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="space-y-3 border-b pb-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 shadow-xl">
                <Shield className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl font-bold">
                  {t('demand.tabs.businessCase.governanceApprovalRequired')}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm">
                  {t('demand.tabs.businessCase.requestBeingReviewed')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
              <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {t('demand.tabs.businessCase.pendingExecutiveReview')}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {t('demand.tabs.businessCase.governanceApprovalDescription')}
                </p>
              </div>
            </div>

            {governancePendingInfo && (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between bg-muted/50 p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Request #{governancePendingInfo.requestNumber}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {governancePendingInfo.status === 'pending_approval' ? 'Under Review' : 'Awaiting Response'}
                    </Badge>
                  </div>

                  <div className="space-y-3 p-3">
                    {governancePendingInfo.governance && (
                      <div className="flex items-center gap-2 text-sm">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Action:</span>
                        <span className="font-medium capitalize">
                          {governancePendingInfo.governance.action.replaceAll('_', ' ')}
                        </span>
                      </div>
                    )}

                    {governancePendingInfo.readiness && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Readiness Score:</span>
                        <span className="font-medium">{governancePendingInfo.readiness.score}%</span>
                      </div>
                    )}

                    {governancePendingInfo.governance?.reason && (
                      <div className="mt-2 border-t pt-2 text-sm text-muted-foreground">
                        {governancePendingInfo.governance.reason}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {t('demand.tabs.businessCase.whatToDoNext')}
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {t('demand.tabs.businessCase.visitDecisionBrainDashboard')}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => onGovernancePendingDialogOpenChange(false)}>
              {t('demand.tabs.businessCase.close')}
            </Button>
            <Button
              onClick={onGoToDecisionBrain}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            >
              <Shield className="mr-2 h-4 w-4" />
              {t('demand.tabs.businessCase.goToDecisionBrain')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}