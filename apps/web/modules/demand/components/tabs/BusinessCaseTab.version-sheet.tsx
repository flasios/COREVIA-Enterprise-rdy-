import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Can } from '@/components/auth/Can';
import { BranchSelector } from '@/components/shared/branching';
import { VersionHistoryTimeline } from '@/components/shared/versioning';
import { CheckCircle, Clock, Edit, GitBranch, GitMerge, Loader2, Network, Send, ShieldCheck, ThumbsUp, Calendar } from 'lucide-react';
import type { ReportVersion } from '@shared/schema';

interface BusinessCaseVersionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  latestVersion: ReportVersion | null | undefined;
  isEditMode: boolean;
  canApprove: boolean;
  canFinalApprove: boolean;
  onOpenApproveDialog: () => void;
  onOpenSendToDirectorDialog: () => void;
  onOpenFinalApproveDialog: () => void;
  isFinalApprovePending: boolean;
  isVersionLocked: boolean;
  renderStatusBadge: (status: string) => ReactNode;
  showVersionPanel: boolean;
  onToggleVersionPanel: () => void;
  onSubmitForReview: () => void;
  isSubmitForReviewPending: boolean;
  onStartEditing: () => void;
  onOpenMeetingDialog: () => void;
  reportId: string;
  selectedBranchId: string | null;
  onBranchChange: (branchId: string | null) => void;
  onOpenBranchTree: () => void;
  onOpenMergeDialog: () => void;
  versions: ReportVersion[];
  onViewVersion: (versionId: string) => void;
  onCompareVersions: (versionId1: string, versionId2: string) => void;
  onRestoreVersion: (versionId: string) => void | Promise<void>;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function BusinessCaseVersionSheet({
  open,
  onOpenChange,
  latestVersion,
  isEditMode,
  canApprove,
  canFinalApprove,
  onOpenApproveDialog,
  onOpenSendToDirectorDialog,
  onOpenFinalApproveDialog,
  isFinalApprovePending,
  isVersionLocked,
  renderStatusBadge,
  showVersionPanel,
  onToggleVersionPanel,
  onSubmitForReview,
  isSubmitForReviewPending,
  onStartEditing,
  onOpenMeetingDialog,
  reportId,
  selectedBranchId,
  onBranchChange,
  onOpenBranchTree,
  onOpenMergeDialog,
  versions,
  onViewVersion,
  onCompareVersions,
  onRestoreVersion,
  t,
}: BusinessCaseVersionSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[400px] flex-col sm:w-[540px]" side="right">
        <div className="flex-shrink-0">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" style={{ color: 'hsl(var(--accent-purple))' }} />
              {t('demand.tabs.businessCase.versionControl')}
            </SheetTitle>
            <SheetDescription>
              {t('demand.tabs.businessCase.manageVersionsDescription')}
            </SheetDescription>
          </SheetHeader>

          {latestVersion && !isEditMode && (
            <div className="mt-4 space-y-3 rounded-lg border-b border-border/50 bg-muted/30 p-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <ThumbsUp className="h-4 w-4" style={{ color: 'hsl(var(--accent-cyan))' }} />
                {t('demand.tabs.businessCase.workflowActions')}
              </h4>

              {latestVersion.status === 'under_review' && (
                <Button
                  size="sm"
                  className="w-full justify-start bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  onClick={onOpenApproveDialog}
                  disabled={!canApprove}
                  data-testid="button-approve-sheet-workflow"
                >
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  {t('demand.tabs.businessCase.initialApproval')}
                </Button>
              )}

              {latestVersion.status === 'approved' && (
                <Button
                  size="sm"
                  className="w-full justify-start bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                  onClick={onOpenSendToDirectorDialog}
                  disabled={!canApprove}
                  data-testid="button-send-director-sheet-workflow"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {t('demand.tabs.businessCase.submitForDirector')}
                </Button>
              )}

              {latestVersion.status === 'manager_approval' && (
                <Button
                  size="sm"
                  className="w-full justify-start bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                  onClick={onOpenFinalApproveDialog}
                  disabled={isFinalApprovePending || !canFinalApprove}
                  data-testid="button-final-approve-sheet"
                >
                  {isFinalApprovePending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  {t('demand.tabs.businessCase.finalApproval')}
                </Button>
              )}

              {latestVersion.status === 'under_review' && !canApprove && (
                <p className="text-xs text-amber-700 dark:text-amber-300">Reviewer approval requires workflow approval permission in the active session.</p>
              )}

              {latestVersion.status === 'approved' && !canApprove && (
                <p className="text-xs text-amber-700 dark:text-amber-300">Submitting to director requires workflow approval permission in the active session.</p>
              )}

              {latestVersion.status === 'manager_approval' && !canFinalApprove && (
                <p className="text-xs text-amber-700 dark:text-amber-300">Final approval requires final-approve permission in the active session.</p>
              )}

              {latestVersion.status === 'draft' && (
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                  <p className="text-xs text-muted-foreground">
                    {t('demand.tabs.businessCase.draftSubmitMessage')}
                  </p>
                </div>
              )}

              {isVersionLocked && (
                <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <p className="text-xs font-semibold text-green-700 dark:text-green-400">{t('demand.tabs.businessCase.locked')}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('demand.tabs.businessCase.versionLockedDescription')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
          {latestVersion && (
            <div className="command-dock luminous-border space-y-3 rounded-lg p-4">
              <h4 className="mb-3 text-sm font-semibold">{t('demand.tabs.businessCase.currentVersion')}</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('demand.tabs.businessCase.versionLabel')}</span>
                  <Badge variant="outline">{latestVersion.versionNumber}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('demand.tabs.businessCase.status')}</span>
                  {renderStatusBadge(latestVersion.status)}
                </div>
                {latestVersion.createdByName && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('demand.tabs.businessCase.createdBy')}</span>
                    <span className="font-medium">{latestVersion.createdByName}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">{t('demand.tabs.businessCase.quickActions')}</h4>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={onToggleVersionPanel}
                data-testid="button-toggle-version-panel-sidebar"
              >
                <GitBranch className="mr-2 h-4 w-4" />
                {showVersionPanel ? t('demand.tabs.businessCase.hide') : t('demand.tabs.businessCase.show')} {t('demand.tabs.businessCase.versionHistory')}
              </Button>

              {latestVersion && latestVersion.status === 'draft' && !isEditMode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={onSubmitForReview}
                  disabled={isSubmitForReviewPending}
                  data-testid="button-submit-review-sidebar"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {t('demand.tabs.businessCase.submitForReview')}
                </Button>
              )}

              {latestVersion && !isVersionLocked && !isEditMode && (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={onStartEditing}
                    data-testid="button-edit-sidebar"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    {t('demand.tabs.businessCase.editBusinessCase')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={onOpenMeetingDialog}
                    data-testid="button-schedule-meeting-sidebar"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {t('demand.tabs.businessCase.scheduleMeeting')}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <Separator />
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <Network className="h-4 w-4" style={{ color: 'hsl(var(--accent-cyan))' }} />
              {t('demand.tabs.businessCase.branchManagement')}
            </h4>
            <BranchSelector
              reportId={reportId}
              selectedBranchId={selectedBranchId}
              onBranchChange={onBranchChange}
              showCreateButton={true}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={onOpenBranchTree} data-testid="button-view-tree-sidebar">
                <Network className="mr-1 h-4 w-4" />
                {t('demand.tabs.businessCase.tree')}
              </Button>
              <Can permissions={["version:create"]}>
                <Button variant="outline" size="sm" onClick={onOpenMergeDialog} data-testid="button-merge-sidebar">
                  <GitMerge className="mr-1 h-4 w-4" />
                  {t('demand.tabs.businessCase.merge')}
                </Button>
              </Can>
            </div>
          </div>

          {showVersionPanel && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <Clock className="h-4 w-4" style={{ color: 'hsl(var(--accent-amber))' }} />
                  {t('demand.tabs.businessCase.versionHistory')}
                </h4>
                {versions.length > 0 ? (
                  <VersionHistoryTimeline
                    versions={versions}
                    reportId={reportId}
                    currentVersionId={latestVersion?.id}
                    onViewVersion={onViewVersion}
                    onCompareVersions={onCompareVersions}
                    onRestoreVersion={onRestoreVersion}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <GitBranch className="mb-2 h-10 w-10 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">{t('demand.tabs.businessCase.noVersionsYet')}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}