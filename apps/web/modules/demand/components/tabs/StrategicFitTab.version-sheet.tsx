import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BranchSelector } from "@/components/shared/branching";
import { VersionHistoryTimeline } from "@/components/shared/versioning";
import type { ReportVersion } from "@shared/schema";
import {
  CheckCircle2,
  Clock,
  Edit,
  GitBranch,
  GitMerge,
  Network,
  Send,
  ShieldCheck,
  ThumbsUp,
} from "lucide-react";
import type { StrategicFitAnalysis } from "./StrategicFitTab.types";

interface StrategicFitVersionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditMode: boolean;
  latestStrategicFitVersion: ReportVersion | null;
  reportId: string;
  showVersionPanel: boolean;
  onToggleVersionPanel: () => void;
  strategicFitData?: StrategicFitAnalysis;
  onStartEdit: () => void;
  selectedBranchId: string | null;
  onBranchChange: (branchId: string | null) => void;
  onOpenBranchTree: () => void;
  onOpenMergeDialog: () => void;
  strategicFitVersions: ReportVersion[];
  onViewVersion: (versionId: string) => void;
  onCompareVersions: (versionA: string, versionB: string) => void;
  onRestoreVersion: (versionId: string) => void;
  canApprove: boolean;
  canFinalApprove: boolean;
  submitForReviewPending: boolean;
  approveVersionPending: boolean;
  sendToDirectorPending: boolean;
  finalApprovePending: boolean;
  onSubmitForReview: () => void;
  onOpenApproveDialog: () => void;
  onOpenSendToDirectorDialog: () => void;
  onFinalApprove: () => void;
}

export function StrategicFitVersionSheet({
  open,
  onOpenChange,
  isEditMode,
  latestStrategicFitVersion,
  reportId,
  showVersionPanel,
  onToggleVersionPanel,
  strategicFitData: _strategicFitData,
  onStartEdit,
  selectedBranchId,
  onBranchChange,
  onOpenBranchTree,
  onOpenMergeDialog,
  strategicFitVersions,
  onViewVersion,
  onCompareVersions,
  onRestoreVersion,
  canApprove,
  canFinalApprove,
  submitForReviewPending,
  approveVersionPending,
  sendToDirectorPending,
  finalApprovePending,
  onSubmitForReview,
  onOpenApproveDialog,
  onOpenSendToDirectorDialog,
  onFinalApprove,
}: StrategicFitVersionSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col" side="right">
        <div className="flex-shrink-0">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" style={{ color: 'hsl(var(--accent-purple))' }} />
              Version Control
            </SheetTitle>
            <SheetDescription>
              Manage versions, branches, and track changes for Strategic Fit
            </SheetDescription>
          </SheetHeader>

          {latestStrategicFitVersion && !isEditMode && (
            <div className="mt-4 p-4 border-b border-border/50 bg-muted/30 rounded-lg space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <ThumbsUp className="h-4 w-4" style={{ color: 'hsl(var(--accent-cyan))' }} />
                Workflow Actions
              </h4>

              {latestStrategicFitVersion.status === 'draft' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={onSubmitForReview}
                  disabled={submitForReviewPending}
                  data-testid="button-submit-review-sidebar"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {submitForReviewPending ? t('demand.tabs.strategicFit.submitting') : t('demand.tabs.strategicFit.submitForReview')}
                </Button>
              )}

              {latestStrategicFitVersion.status === 'under_review' && canApprove && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20"
                  onClick={onOpenApproveDialog}
                  disabled={approveVersionPending}
                  data-testid="button-approve-sidebar"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4 text-blue-600" />
                  {approveVersionPending ? t('demand.tabs.strategicFit.approving') : t('demand.tabs.strategicFit.approve')}
                </Button>
              )}

              {latestStrategicFitVersion.status === 'approved' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20"
                  onClick={onOpenSendToDirectorDialog}
                  disabled={sendToDirectorPending}
                  data-testid="button-send-director-sidebar"
                >
                  <Send className="mr-2 h-4 w-4 text-purple-600" />
                  {sendToDirectorPending ? t('demand.tabs.strategicFit.sending') : t('demand.tabs.strategicFit.sendToDirector')}
                </Button>
              )}

              {latestStrategicFitVersion.status === 'manager_approval' && canFinalApprove && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20"
                  onClick={onFinalApprove}
                  disabled={finalApprovePending}
                  data-testid="button-final-approve-sidebar"
                >
                  <ShieldCheck className="mr-2 h-4 w-4 text-emerald-600" />
                  {finalApprovePending ? t('demand.tabs.strategicFit.publishing') : t('demand.tabs.strategicFit.finalApprovePublish')}
                </Button>
              )}

              {latestStrategicFitVersion.status === 'published' && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <p className="text-xs font-semibold text-green-700 dark:text-green-400">{t('demand.tabs.strategicFit.publishedLocked')}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('demand.tabs.strategicFit.publishedLockedDesc')}</p>
                </div>
              )}

              {latestStrategicFitVersion.status === 'manager_approval' && !canFinalApprove && (
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <p className="text-xs font-semibold text-purple-700 dark:text-purple-400">{t('demand.tabs.strategicFit.awaitingDirectorApproval')}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('demand.tabs.strategicFit.sentForDirectorApproval')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto mt-4 space-y-4">
          {latestStrategicFitVersion && (
            <div className="space-y-3 p-4 rounded-lg command-dock luminous-border">
              <h4 className="text-sm font-semibold mb-3">{t('demand.tabs.strategicFit.currentVersion')}</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('demand.tabs.strategicFit.version')}</span>
                  <Badge variant="outline">{latestStrategicFitVersion.versionNumber}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('demand.tabs.strategicFit.status')}</span>
                </div>
                {latestStrategicFitVersion.createdByName && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('demand.tabs.strategicFit.createdBy')}</span>
                    <span className="font-medium">{latestStrategicFitVersion.createdByName}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">{t('demand.tabs.strategicFit.quickActions')}</h4>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={onToggleVersionPanel}
                data-testid="button-toggle-version-panel-sidebar"
              >
                <GitBranch className="mr-2 h-4 w-4" />
                {showVersionPanel ? t('demand.tabs.strategicFit.hide') : t('demand.tabs.strategicFit.show')} {t('demand.tabs.strategicFit.versionHistory')}
              </Button>

              {latestStrategicFitVersion && !(latestStrategicFitVersion.status === 'manager_approval' || latestStrategicFitVersion.status === 'published') && !isEditMode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={onStartEdit}
                  data-testid="button-edit-sidebar"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  {t('demand.tabs.strategicFit.editStrategicFit')}
                </Button>
              )}
            </div>
          </div>

          <Separator />
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Network className="h-4 w-4" style={{ color: 'hsl(var(--accent-cyan))' }} />
              {t('demand.tabs.strategicFit.branchManagement')}
            </h4>
            <BranchSelector
              reportId={reportId}
              selectedBranchId={selectedBranchId}
              onBranchChange={onBranchChange}
              showCreateButton={true}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={onOpenBranchTree} data-testid="button-view-tree-sidebar">
                <Network className="h-4 w-4 mr-1" />
                {t('demand.tabs.strategicFit.tree')}
              </Button>
              <Button variant="outline" size="sm" onClick={onOpenMergeDialog} data-testid="button-merge-sidebar">
                <GitMerge className="h-4 w-4 mr-1" />
                {t('demand.tabs.strategicFit.merge')}
              </Button>
            </div>
          </div>

          {showVersionPanel && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" style={{ color: 'hsl(var(--accent-amber))' }} />
                  {t('demand.tabs.strategicFit.versionHistoryHeading')}
                </h4>
                {strategicFitVersions.length > 0 ? (
                  <VersionHistoryTimeline
                    versions={strategicFitVersions}
                    reportId={reportId}
                    currentVersionId={latestStrategicFitVersion?.id}
                    onViewVersion={onViewVersion}
                    onCompareVersions={onCompareVersions}
                    onRestoreVersion={onRestoreVersion}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <GitBranch className="h-10 w-10 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">{t('demand.tabs.strategicFit.noVersionsYet')}</p>
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