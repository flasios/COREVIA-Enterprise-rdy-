import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Can } from '@/components/auth/Can';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, GitBranch, Loader2, Send, ThumbsUp } from 'lucide-react';
import type { ReportVersion } from '@shared/schema';

interface DetailedRequirementsEmptyStateHeaderProps {
  latestVersion: ReportVersion | null | undefined;
  latestVersionStatusBadge: ReactNode;
  showVersionSheet: boolean;
  onToggleVersionSheet: () => void;
  canSubmitForReview: boolean;
  isSubmitForReviewPending: boolean;
  onSubmitForReview: () => void;
  canApprove: boolean;
  onApprove: () => void;
  canFinalApprove: boolean;
  isFinalApprovePending: boolean;
  onFinalApprove: () => void;
}

export function DetailedRequirementsEmptyStateHeader({
  latestVersion,
  latestVersionStatusBadge,
  showVersionSheet,
  onToggleVersionSheet,
  canSubmitForReview,
  isSubmitForReviewPending,
  onSubmitForReview,
  canApprove,
  onApprove,
  canFinalApprove,
  isFinalApprovePending,
  onFinalApprove,
}: DetailedRequirementsEmptyStateHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-card">
        <div className="flex items-center gap-3">
          {latestVersion && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('demand.tabs.requirements.versionN', { n: latestVersion.versionNumber })}:</span>
              {latestVersionStatusBadge}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {latestVersion && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={onToggleVersionSheet}
                data-testid="button-toggle-versions-requirements"
              >
                <GitBranch className="mr-1.5 h-3.5 w-3.5" />
                {showVersionSheet ? t('demand.tabs.requirements.hide') : t('demand.tabs.requirements.show')} {t('demand.tabs.requirements.versions')}
              </Button>
              {(latestVersion.status === 'manager_approval' || latestVersion.status === 'published') && (
                <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 text-xs">
                  {t('demand.tabs.requirements.approvedLocked')}
                </Badge>
              )}
            </>
          )}
        </div>
      </div>

      {latestVersion && (
        <div className="flex items-center gap-1.5 px-4">
          {latestVersion.status === 'draft' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Can
                      permissions={['report:update-self', 'report:update-any']}
                      fallback={
                        <Button
                          variant="default"
                          size="sm"
                          className="h-8 px-3 text-xs"
                          disabled
                          data-testid="button-submit-review-requirements"
                        >
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                          {t('demand.tabs.requirements.submitForReview')}
                        </Button>
                      }
                    >
                      <Button
                        onClick={onSubmitForReview}
                        variant="default"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        disabled={isSubmitForReviewPending || !canSubmitForReview}
                        data-testid="button-submit-review-requirements"
                      >
                        {isSubmitForReviewPending ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {t('demand.tabs.requirements.submitForReview')}
                      </Button>
                    </Can>
                  </span>
                </TooltipTrigger>
                {!canSubmitForReview && (
                  <TooltipContent>
                    <p>{t('demand.tabs.requirements.onlyOwnersCanSubmit')}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}

          {latestVersion.status === 'under_review' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Can
                      permissions={['workflow:advance']}
                      fallback={
                        <Button
                          variant="default"
                          size="sm"
                          className="h-8 px-3 text-xs"
                          disabled
                          data-testid="button-approve-requirements"
                        >
                          <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
                          {t('demand.tabs.requirements.initialApproval')}
                        </Button>
                      }
                    >
                      <Button
                        onClick={onApprove}
                        variant="default"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        disabled={!canApprove}
                        data-testid="button-approve-requirements"
                      >
                        <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
                        {t('demand.tabs.requirements.initialApproval')}
                      </Button>
                    </Can>
                  </span>
                </TooltipTrigger>
                {!canApprove && (
                  <TooltipContent>
                    <p>{t('demand.tabs.requirements.onlySpecialistsCanApprove')}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}

          {latestVersion.status === 'manager_approval' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Can
                      permissions={['workflow:final-approve']}
                      fallback={
                        <Button
                          variant="default"
                          size="sm"
                          className="h-8 px-3 text-xs"
                          disabled
                          data-testid="button-final-approve-requirements"
                        >
                          <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                          {t('demand.tabs.requirements.finalApproval')}
                        </Button>
                      }
                    >
                      <Button
                        onClick={onFinalApprove}
                        variant="default"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        disabled={isFinalApprovePending || !canFinalApprove}
                        data-testid="button-final-approve-requirements"
                      >
                        {isFinalApprovePending ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {t('demand.tabs.requirements.finalApproval')}
                      </Button>
                    </Can>
                  </span>
                </TooltipTrigger>
                {!canFinalApprove && (
                  <TooltipContent>
                    <p>{t('demand.tabs.requirements.onlyManagersCanApprove')}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
    </div>
  );
}