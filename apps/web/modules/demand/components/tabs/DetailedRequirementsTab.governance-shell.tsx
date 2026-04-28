import { useTranslation } from 'react-i18next';
import { DocumentExportDropdown } from '@/components/shared/document';
import { VersionCollaborationIndicator } from '@/components/shared/versioning';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { CheckCircle, CheckCircle2, Edit, GitBranch, Loader2, Lock as LockIcon, Save, Send, Sparkles, ThumbsUp, X } from 'lucide-react';
import type { ReportVersion } from '@shared/schema';

export interface DetailedRequirementsGovernanceShellProps {
  reportId: string;
  reportTitle: string;
  organizationName: string;
  department: string;
  isEditMode: boolean;
  latestVersion: ReportVersion | null | undefined;
  displayVersionLabel: string;
  showVersionSheet: boolean;
  onToggleVersionSheet: () => void;
  isSubmitForReviewPending: boolean;
  onSubmitForReview: () => void;
  canApprove: boolean;
  onApprove: () => void;
  onSendToDirector: () => void;
  isFinalApprovePending: boolean;
  onFinalApprove: () => void;
  requirementsAvailable: boolean;
  onEnterEditMode: () => void;
  onSaveAndExit: () => void;
  onCancelEdit: () => void;
}

export function DetailedRequirementsGovernanceShell({
  reportId,
  reportTitle,
  organizationName,
  department,
  isEditMode,
  latestVersion,
  displayVersionLabel,
  showVersionSheet,
  onToggleVersionSheet,
  isSubmitForReviewPending,
  onSubmitForReview,
  canApprove,
  onApprove,
  onSendToDirector,
  isFinalApprovePending,
  onFinalApprove,
  requirementsAvailable,
  onEnterEditMode,
  onSaveAndExit,
  onCancelEdit,
}: DetailedRequirementsGovernanceShellProps) {
  const { t } = useTranslation();
  const isLocked = latestVersion?.status === 'manager_approval' || latestVersion?.status === 'published';
  const showIdentitySeparator = organizationName && department;

  return (
    <>
      <Card className="border border-border/60 bg-card/95 shadow-sm" data-testid="requirements-report-identity-moved">
        <CardHeader className="p-2.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{reportTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground truncate">
              {organizationName}
              {showIdentitySeparator ? ' - ' : ''}
              {department}
            </p>
          </div>
        </CardHeader>
      </Card>

      <Card className="overflow-hidden border border-border/60 bg-card/95 shadow-sm" data-testid="requirements-actions-moved">
        <CardHeader className="p-2.5">
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.1),_transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-2.5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.45)] dark:border-slate-800/80 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_24%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.9))]">
            <div className="space-y-2.5">
              <div className="flex items-start gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-500 text-white shadow-md shadow-cyan-500/20">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">Requirements governance and actions</h3>
                    {isEditMode && (
                      <Badge variant="outline" className="h-5 border-sky-400/40 bg-sky-500/10 px-1.5 text-[10px] text-sky-700 dark:text-sky-300">
                        <Edit className="mr-1 h-3 w-3" />
                        {t('demand.tabs.requirements.editingMode')}
                      </Badge>
                    )}
                    {isLocked && (
                      <Badge variant="outline" className="h-5 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                        <LockIcon className="mr-1 h-3 w-3" />
                        Locked
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] leading-4 text-slate-600 dark:text-slate-300">Review, govern, and version detailed requirements from one compact workspace.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-2 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Version</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex h-7 min-w-[3.25rem] shrink-0 items-center justify-center rounded-md bg-slate-900 px-2 text-[11px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                      {displayVersionLabel}
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <div className="truncate text-[11px] font-semibold text-slate-900 dark:text-slate-50">{latestVersion ? String(latestVersion.status).replace(/_/g, ' ') : 'No version'}</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-2 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Mode</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-900 dark:text-slate-50">
                    {isLocked ? (
                      <>
                        <LockIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="truncate">{t('demand.tabs.requirements.viewOnlyApproved')}</span>
                      </>
                    ) : isEditMode ? (
                      <>
                        <Edit className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                        <span className="truncate">{t('demand.tabs.requirements.editingMode')}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
                        <span className="truncate">Ready</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {latestVersion && (
                <div className="rounded-lg border border-slate-200/80 bg-white/88 p-2.5 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/65">
                  <VersionCollaborationIndicator versionId={latestVersion.id} reportId={reportId} compact={true} />
                </div>
              )}

              {!isEditMode ? (
                <div className="rounded-lg border border-slate-200/80 bg-white/88 p-2.5 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/65">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Action Dock</p>
                      <p className="truncate text-[11px] text-slate-600 dark:text-slate-300">Primary decisions first.</p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onToggleVersionSheet}
                    className="h-8 w-full justify-between rounded-lg border-slate-300/80 bg-white/80 px-2.5 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800"
                    data-testid="button-toggle-versions-requirements-moved"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <GitBranch className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{showVersionSheet ? t('demand.tabs.requirements.hideVersions') : t('demand.tabs.requirements.showVersions')}</span>
                    </span>
                  </Button>

                  <div className="mt-2 grid gap-2">
                    {latestVersion && latestVersion.status === 'draft' && (
                      <Button
                        onClick={onSubmitForReview}
                        variant="default"
                        size="sm"
                        disabled={isSubmitForReviewPending}
                        className="min-h-8 justify-start whitespace-normal rounded-lg bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 px-3 py-2 text-[11px] font-semibold text-white shadow-md shadow-cyan-500/20 hover:from-sky-700 hover:via-cyan-700 hover:to-teal-700"
                        data-testid="button-submit-review-requirements-moved"
                      >
                        {isSubmitForReviewPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                        Submit for Review
                      </Button>
                    )}

                    {latestVersion && latestVersion.status === 'under_review' && canApprove && (
                      <Button
                        onClick={onApprove}
                        variant="default"
                        size="sm"
                        className="min-h-8 justify-start whitespace-normal rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-[11px] font-semibold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700"
                        data-testid="button-approve-requirements-moved"
                      >
                        <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
                        {t('demand.tabs.requirements.initialApprovalBtn')}
                      </Button>
                    )}

                    {latestVersion && latestVersion.status === 'approved' && (
                      <Button
                        onClick={onSendToDirector}
                        variant="default"
                        size="sm"
                        className="min-h-8 justify-start whitespace-normal rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-[11px] font-semibold text-white shadow-md shadow-violet-500/20 hover:from-violet-700 hover:to-indigo-700"
                        data-testid="button-send-director-requirements-moved"
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        {t('demand.tabs.requirements.submitForDirector')}
                      </Button>
                    )}

                    {latestVersion && latestVersion.status === 'manager_approval' && (
                      <Button
                        onClick={onFinalApprove}
                        variant="default"
                        size="sm"
                        disabled={isFinalApprovePending}
                        className="min-h-8 justify-start whitespace-normal rounded-lg bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-3 py-2 text-[11px] font-semibold text-white shadow-md shadow-fuchsia-500/20 hover:from-fuchsia-700 hover:to-indigo-700"
                        data-testid="button-final-approve-requirements-moved"
                      >
                        {isFinalApprovePending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-1.5 h-3.5 w-3.5" />}
                        {t('demand.tabs.requirements.finalApprovalBtn')}
                      </Button>
                    )}

                    {isLocked ? (
                      <>
                        <div className="flex items-center gap-2 rounded-lg border border-slate-300/80 bg-white/90 px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-sm dark:border-slate-600/70 dark:bg-slate-900/60 dark:text-slate-300">
                          <LockIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{t('demand.tabs.requirements.viewOnlyApproved')}</span>
                        </div>
                        <div className="[&>button]:min-h-8 [&>button]:w-full [&>button]:justify-start [&>button]:whitespace-normal [&>button]:rounded-lg [&>button]:border-slate-300/80 [&>button]:bg-white/90 [&>button]:px-3 [&>button]:py-2 [&>button]:text-[11px] [&>button]:font-semibold [&>button]:shadow-sm [&>button]:hover:bg-slate-50 dark:[&>button]:border-slate-600/70 dark:[&>button]:bg-slate-900/60 dark:[&>button]:hover:bg-slate-800">
                          <DocumentExportDropdown
                            reportId={reportId}
                            versionId={latestVersion?.id}
                            documentType="requirements"
                            buttonClassName="min-h-8 px-3 py-2 text-[11px] font-semibold"
                          />
                        </div>
                      </>
                    ) : requirementsAvailable ? (
                      <>
                        <Button
                          onClick={onEnterEditMode}
                          variant="outline"
                          size="sm"
                          className="min-h-8 justify-start whitespace-normal rounded-lg border-slate-300/80 bg-white/90 px-3 py-2 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800"
                          data-testid="button-edit-requirements-moved"
                        >
                          <Edit className="mr-1.5 h-3.5 w-3.5" />
                          {t('demand.tabs.requirements.editRequirements')}
                        </Button>
                        <div className="[&>button]:min-h-8 [&>button]:w-full [&>button]:justify-start [&>button]:whitespace-normal [&>button]:rounded-lg [&>button]:border-slate-300/80 [&>button]:bg-white/90 [&>button]:px-3 [&>button]:py-2 [&>button]:text-[11px] [&>button]:font-semibold [&>button]:shadow-sm [&>button]:hover:bg-slate-50 dark:[&>button]:border-slate-600/70 dark:[&>button]:bg-slate-900/60 dark:[&>button]:hover:bg-slate-800">
                          <DocumentExportDropdown
                            reportId={reportId}
                            versionId={latestVersion?.id}
                            documentType="requirements"
                            buttonClassName="min-h-8 px-3 py-2 text-[11px] font-semibold"
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-sky-300/50 bg-sky-50/80 p-2.5 shadow-sm dark:border-sky-500/30 dark:bg-sky-500/10">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Edit Session</p>
                  <p className="mt-1 text-[11px] text-sky-900 dark:text-slate-50">Validate, then save as a tracked version.</p>
                  <div className="mt-2 grid gap-2">
                    <Button
                      onClick={onSaveAndExit}
                      variant="default"
                      className="h-8 justify-start rounded-lg bg-sky-600 px-3 text-[11px] font-semibold text-white hover:bg-sky-700"
                      data-testid="button-save-exit-requirements-moved"
                    >
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      {t('demand.tabs.requirements.saveAndExit')}
                    </Button>
                    <Button
                      onClick={onCancelEdit}
                      variant="outline"
                      className="h-8 justify-start rounded-lg border-slate-300/80 bg-white/90 px-3 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800"
                      data-testid="button-cancel-edit-requirements-moved"
                    >
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      {t('demand.tabs.requirements.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>
    </>
  );
}