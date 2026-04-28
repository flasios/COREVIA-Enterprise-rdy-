import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DocumentExportDropdown } from "@/components/shared/document";
import { ImplementationRoadmap } from "@/components/shared/visualization";
import { AIConfidenceBadge, AICitationsList } from "@/components/shared/ai";
import type { ReportVersion } from "@shared/schema";
import type { AIConfidence, AICitation } from "@shared/aiAdapters";
import type {
  BusinessCaseData,
  ClarificationDomain, ClarificationQuestion,
  NextStep,
} from "../business-case";
import {
  getRecommendationsText,
  isEnrichedRecommendations,
} from "../business-case";
import {
  CheckCircle, CheckCircle2, Calendar, Shield,
  Loader2, Edit, Save, X, GitBranch, Send, ThumbsUp,
  XCircle, Lock as LockIcon, Clock, Sparkles,
  AlertTriangle, AlertCircle,
  ChevronDown, ChevronUp, HelpCircle, Lightbulb,
  DollarSign, TrendingUp,
} from "lucide-react";
import {
  resolveStatusBannerClass, resolveStatusTextClass, resolveStatusBadgeClass,
  resolveExecutionVariantClass,
  resolveComplianceAlertClass, resolveComplianceMessage,
  resolveRecommendationCardClass, resolveRecommendationBadgeVariant,
  resolveRecommendationBadgeClass, resolveApproachVariant,
  resolveDomainIcon, resolvePriorityVariant,
  normalizePercentValue,
} from "./BusinessCaseTab.helpers";

// ── Status banner ──────────────────────────────────────────────────

interface StatusBannerProps {
  latestVersion: ReportVersion | null;
}

function StatusBannerIcon({ status }: Readonly<{ status: string }>) {
  if (status === 'under_review') return <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
  if (status === 'approved' || status === 'manager_approval') return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
  if (status === 'published') return <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
  if (status === 'rejected') return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
  return null;
}

function StatusBannerLabel({ status }: Readonly<{ status: string }>) {
  const { t } = useTranslation();
  const labelMap: Record<string, string> = {
    under_review: t("demand.tabs.businessCase.underReview"),
    approved: t("demand.tabs.businessCase.approved"),
    manager_approval: t("demand.tabs.businessCase.pendingFinalApproval"),
    published: t("demand.tabs.businessCase.published"),
    rejected: t("demand.tabs.businessCase.rejected"),
  };
  return <>{labelMap[status] ?? ""}</>;
}

function StatusBannerDetail({ status, versionNumber, approvedAt }: Readonly<{ status: string; versionNumber: string; approvedAt?: Date | string | null }>) {
  const { t } = useTranslation();
  const detailMap: Record<string, string> = {
    under_review: ` ${t("demand.tabs.businessCase.awaitingReviewerApproval")}`,
    approved: ` ${t("demand.tabs.businessCase.approved")} ${approvedAt ? new Date(approvedAt).toLocaleDateString() : ""}`,
    manager_approval: ` ${t("demand.tabs.businessCase.approved")} ${approvedAt ? new Date(approvedAt).toLocaleDateString() : ""}`,
    published: ` ${t("demand.tabs.businessCase.liveAndAccessible")}`,
    rejected: ` ${t("demand.tabs.businessCase.pleaseReviewFeedback")}`,
  };
  return (
    <span className="text-xs text-muted-foreground ml-2">
      Version {versionNumber} •{detailMap[status] ?? ""}
    </span>
  );
}

export function StatusBanner({ latestVersion }: Readonly<StatusBannerProps>) {
  if (!latestVersion || latestVersion.status === "draft") return null;

  return (
    <div
      className={`flex-shrink-0 px-4 py-3 flex items-center justify-between gap-3 border-b ${resolveStatusBannerClass(latestVersion.status)}`}
      data-testid="status-banner-business-case"
    >
      <div className="flex items-center gap-3">
        <StatusBannerIcon status={latestVersion.status} />
        <div>
          <span className={`font-semibold text-sm ${resolveStatusTextClass(latestVersion.status)}`}>
            <StatusBannerLabel status={latestVersion.status} />
          </span>
          <StatusBannerDetail
            status={latestVersion.status}
            versionNumber={latestVersion.versionNumber}
            approvedAt={latestVersion.approvedAt}
          />
        </div>
      </div>
      <Badge variant="outline" className={resolveStatusBadgeClass(latestVersion.status)}>
        {latestVersion.status.replaceAll("_", " ").toUpperCase()}
      </Badge>
    </div>
  );
}

// ── Report identity card (used inside MovedHeaderContent) ──────────

interface ReportIdentityCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  demandReportData: any;
}

function ReportIdentityCard({ demandReportData }: Readonly<ReportIdentityCardProps>) {
  const { t } = useTranslation();
  const data = demandReportData?.data as { title?: string; organizationName?: string; department?: string } | undefined;
  const orgName = String(data?.organizationName || "");
  const dept = String(data?.department || "");
  const separator = orgName && dept ? " - " : "";

  return (
    <Card className="border border-border/60 bg-card/95 shadow-sm" data-testid="business-case-report-identity-moved">
      <CardHeader className="p-2.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            {String(data?.title || t("demand.analysis.workflowTimeline.demandAnalysisReport"))}
          </p>
          <p className="mt-1 text-xs text-muted-foreground truncate">
            {orgName}{separator}{dept}
          </p>
        </div>
      </CardHeader>
    </Card>
  );
}

// ── Mode indicator (used inside ActionsCard) ───────────────────────

function ModeIndicator({ latestVersion, isEditMode }: Readonly<{ latestVersion: ReportVersion | null; isEditMode: boolean }>) {
  const { t } = useTranslation();
  const isLocked = latestVersion && (latestVersion.status === "manager_approval" || latestVersion.status === "published");

  if (isLocked) {
    return (
      <>
        <LockIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="truncate">{t("demand.tabs.businessCase.viewOnly")}</span>
      </>
    );
  }
  if (isEditMode) {
    return (
      <>
        <Edit className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
        <span className="truncate">{t("demand.tabs.businessCase.editingMode")}</span>
      </>
    );
  }
  return (
    <>
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
      <span className="truncate">Ready</span>
    </>
  );
}

// ── Moved header content (sidebar rail header) ─────────────────────

interface MovedHeaderContentProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  demandReportData: any;
  isEditMode: boolean;
  latestVersion: ReportVersion | null;
  displayVersionLabel: string;
  showVersionSheet: boolean;
  setShowVersionSheet: (v: boolean) => void;
  submitForReview: { mutate: () => void; isPending: boolean };
  reportAccess: { canApprove: boolean; canFinalApprove: boolean };
  finalApprove: { mutate: () => void; isPending: boolean };
  createVersionMutation: { isPending: boolean };
  handleCreateNewVersion: () => void;
  setIsEditMode: (v: boolean) => void;
  setShowMeetingDialog: (v: boolean) => void;
  setShowApproveDialog: (v: boolean) => void;
  setShowSendToDirectorDialog: (v: boolean) => void;
  reportId: string;
  businessCaseHasData: boolean;
  handleEditToggle: () => void;
  handleSaveClick: () => void;
}

function EditSessionPanel({ handleSaveClick, handleEditToggle }: Readonly<{ handleSaveClick: () => void; handleEditToggle: () => void }>) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-sky-300/50 bg-sky-50/80 p-2.5 shadow-sm dark:border-sky-500/30 dark:bg-sky-500/10">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Edit Session</p>
      <p className="mt-1 text-[11px] text-sky-900 dark:text-sky-50">Validate, then save as a tracked version.</p>
      <div className="mt-2 grid gap-2">
        <Button onClick={handleSaveClick} variant="default" className="h-8 justify-start rounded-lg bg-sky-600 px-3 text-[11px] font-semibold text-white hover:bg-sky-700" data-testid="button-save-exit-moved">
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {t("demand.tabs.businessCase.saveAndExit")}
        </Button>
        <Button onClick={handleEditToggle} variant="outline" className="h-8 justify-start rounded-lg border-slate-300/80 bg-white/90 px-3 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800" data-testid="button-cancel-edit-moved">
          <X className="mr-1.5 h-3.5 w-3.5" />
          {t("demand.tabs.businessCase.cancel")}
        </Button>
      </div>
    </div>
  );
}

interface ActionDockProps {
  latestVersion: ReportVersion | null;
  showVersionSheet: boolean;
  setShowVersionSheet: (v: boolean) => void;
  submitForReview: { mutate: () => void; isPending: boolean };
  reportAccess: { canApprove: boolean; canFinalApprove: boolean };
  finalApprove: { mutate: () => void; isPending: boolean };
  createVersionMutation: { isPending: boolean };
  handleCreateNewVersion: () => void;
  setIsEditMode: (v: boolean) => void;
  setShowMeetingDialog: (v: boolean) => void;
  setShowApproveDialog: (v: boolean) => void;
  setShowSendToDirectorDialog: (v: boolean) => void;
  reportId: string;
  businessCaseHasData: boolean;
}

function ActionDockPanel(props: Readonly<ActionDockProps>) {
  const { t } = useTranslation();
  const {
    latestVersion, showVersionSheet, setShowVersionSheet, submitForReview,
    reportAccess, finalApprove, createVersionMutation, handleCreateNewVersion, setIsEditMode,
    setShowMeetingDialog, setShowApproveDialog, setShowSendToDirectorDialog, reportId, businessCaseHasData,
  } = props;
  const isLocked = latestVersion && (latestVersion.status === "manager_approval" || latestVersion.status === "published");
  let approvalHelpText: string | null = null;

  if (latestVersion?.status === "under_review") {
    approvalHelpText = "Reviewer approval requires workflow approval permission in the active session.";
  } else if (latestVersion?.status === "approved") {
    approvalHelpText = "Submitting to director requires workflow approval permission in the active session.";
  } else if (latestVersion?.status === "manager_approval") {
    approvalHelpText = "Final approval requires final-approve permission in the active session.";
  }

  return (
    <div className="rounded-lg border border-slate-200/80 bg-white/88 p-2.5 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/65">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Action Dock</p>
          <p className="truncate text-[11px] text-slate-600 dark:text-slate-300">Stacked for the sidebar.</p>
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={() => setShowVersionSheet(!showVersionSheet)} className="h-8 w-full justify-between rounded-lg border-slate-300/80 bg-white/80 px-2.5 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800" data-testid="button-toggle-versions-moved">
        <span className="flex items-center gap-1.5 truncate">
          <GitBranch className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{showVersionSheet ? t("demand.tabs.businessCase.hide") : t("demand.tabs.businessCase.show")} {t("demand.tabs.businessCase.versions")}</span>
        </span>
      </Button>

      <div className="mt-2 grid gap-2">
        {latestVersion?.status === "draft" && (
          <Button onClick={() => submitForReview.mutate()} variant="default" size="sm" disabled={submitForReview.isPending} className="min-h-8 justify-start whitespace-normal rounded-lg bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 px-3 py-2 text-[11px] font-semibold text-white shadow-md shadow-cyan-500/20 hover:from-sky-700 hover:via-cyan-700 hover:to-teal-700" data-testid="button-submit-review-moved">
            {submitForReview.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5 shrink-0" />}
            {t("demand.tabs.businessCase.submitForReview")}
          </Button>
        )}

        {latestVersion?.status === "under_review" && (
          <Button onClick={() => setShowApproveDialog(true)} variant="default" size="sm" disabled={!reportAccess.canApprove} className="min-h-8 justify-start whitespace-normal rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-[11px] font-semibold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-approve">
            <ThumbsUp className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            {t("demand.tabs.businessCase.initialApproval")}
          </Button>
        )}

        {latestVersion?.status === "approved" && (
          <Button onClick={() => setShowSendToDirectorDialog(true)} variant="default" size="sm" disabled={!reportAccess.canApprove} className="min-h-8 justify-start whitespace-normal rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-[11px] font-semibold text-white shadow-md shadow-violet-500/20 hover:from-violet-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-submit-director">
            <Send className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            {t("demand.tabs.businessCase.submitForDirector")}
          </Button>
        )}

        {latestVersion?.status === "manager_approval" && (
          <Button onClick={() => finalApprove.mutate()} variant="default" size="sm" disabled={finalApprove.isPending || !reportAccess.canFinalApprove} className="min-h-8 justify-start whitespace-normal rounded-lg bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-3 py-2 text-[11px] font-semibold text-white shadow-md shadow-fuchsia-500/20 hover:from-fuchsia-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-final-approve">
            {finalApprove.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" /> : <CheckCircle className="mr-1.5 h-3.5 w-3.5 shrink-0" />}
            {t("demand.tabs.businessCase.finalApproval")}
          </Button>
        )}

        {approvalHelpText && ((latestVersion?.status === "under_review" && !reportAccess.canApprove) || (latestVersion?.status === "approved" && !reportAccess.canApprove) || (latestVersion?.status === "manager_approval" && !reportAccess.canFinalApprove)) && (
          <p className="text-[11px] text-amber-700 dark:text-amber-300" data-testid="text-approval-permission-hint-moved">
            {approvalHelpText}
          </p>
        )}

        {isLocked && (
          <Button onClick={handleCreateNewVersion} variant="outline" size="sm" disabled={createVersionMutation.isPending} className="min-h-8 justify-start whitespace-normal rounded-lg border-slate-300/80 bg-white/90 px-3 py-2 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800" data-testid="button-create-new-version-moved">
            {createVersionMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" /> : <GitBranch className="mr-1.5 h-3.5 w-3.5 shrink-0" />}
            {t("demand.tabs.businessCase.newVersion")}
          </Button>
        )}
        {!isLocked && businessCaseHasData && (
          <Button onClick={() => setIsEditMode(true)} variant="outline" size="sm" className="min-h-8 justify-start whitespace-normal rounded-lg border-slate-300/80 bg-white/90 px-3 py-2 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800" data-testid="button-edit-business-case-moved">
            <Edit className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            {t("demand.tabs.businessCase.edit")}
          </Button>
        )}

        <Button onClick={() => setShowMeetingDialog(true)} variant="outline" size="sm" className="min-h-8 justify-start whitespace-normal rounded-lg border-amber-300/70 bg-amber-50/80 px-3 py-2 text-[11px] font-semibold text-amber-900 shadow-sm hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/15" data-testid="button-schedule-meeting-moved">
          <Calendar className="mr-1.5 h-3.5 w-3.5 shrink-0" />
          {t("demand.tabs.businessCase.scheduleMeeting")}
        </Button>

        <div className="[&>button]:min-h-8 [&>button]:w-full [&>button]:justify-start [&>button]:whitespace-normal [&>button]:rounded-lg [&>button]:border-slate-300/80 [&>button]:bg-white/90 [&>button]:px-3 [&>button]:py-2 [&>button]:text-[11px] [&>button]:font-semibold [&>button]:shadow-sm [&>button]:hover:bg-slate-50 dark:[&>button]:border-slate-600/70 dark:[&>button]:bg-slate-900/60 dark:[&>button]:hover:bg-slate-800">
          <DocumentExportDropdown reportId={reportId} versionId={latestVersion?.id} documentType="business_case" buttonClassName="min-h-8 px-3 py-2 text-[11px] font-semibold" />
        </div>
      </div>
    </div>
  );
}

export function MovedHeaderContent(props: Readonly<MovedHeaderContentProps>) {
  const { t } = useTranslation();
  const {
    demandReportData, isEditMode, latestVersion, displayVersionLabel,
    showVersionSheet, setShowVersionSheet, submitForReview, reportAccess,
    finalApprove, createVersionMutation, handleCreateNewVersion, setIsEditMode,
    setShowMeetingDialog, setShowApproveDialog, setShowSendToDirectorDialog,
    reportId, businessCaseHasData, handleEditToggle, handleSaveClick,
  } = props;
  const isLocked = latestVersion && (latestVersion.status === "manager_approval" || latestVersion.status === "published");

  return (
    <>
      <ReportIdentityCard demandReportData={demandReportData} />

      <Card className="border border-border/60 bg-card/95 shadow-sm" data-testid="business-case-actions-moved">
        <CardHeader className="p-2.5">
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.1),_transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-2.5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.45)] dark:border-slate-800/80 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_24%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.9))]">
            <div className="space-y-2.5">
              <div className="flex items-start gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-500 text-white shadow-md shadow-cyan-500/20">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">Business case actions</h3>
                    {isEditMode && (
                      <Badge variant="outline" className="h-5 border-sky-400/40 bg-sky-500/10 px-1.5 text-[10px] text-sky-700 dark:text-sky-300">
                        <Edit className="mr-1 h-3 w-3" />
                        {t("demand.tabs.businessCase.editingMode")}
                      </Badge>
                    )}
                    {isLocked && (
                      <Badge variant="outline" className="h-5 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                        <LockIcon className="mr-1 h-3 w-3" />
                        Locked
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] leading-4 text-slate-600 dark:text-slate-300">Review, approve, schedule, and export without crowding the rail.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0 rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-2 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Version</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex h-7 min-w-[3.25rem] shrink-0 items-center justify-center rounded-md bg-slate-900 px-2 text-[11px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                      {displayVersionLabel}
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <div className="truncate text-[11px] font-semibold text-slate-900 dark:text-slate-50">
                        {latestVersion ? String(latestVersion.status).replaceAll("_", " ") : "No version"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-2 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Mode</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-900 dark:text-slate-50">
                    <ModeIndicator latestVersion={latestVersion} isEditMode={isEditMode} />
                  </div>
                </div>
              </div>

              {isEditMode ? (
                <EditSessionPanel handleSaveClick={handleSaveClick} handleEditToggle={handleEditToggle} />
              ) : (
                <ActionDockPanel
                  latestVersion={latestVersion}
                  showVersionSheet={showVersionSheet}
                  setShowVersionSheet={setShowVersionSheet}
                  submitForReview={submitForReview}
                  reportAccess={reportAccess}
                  finalApprove={finalApprove}
                  createVersionMutation={createVersionMutation}
                  handleCreateNewVersion={handleCreateNewVersion}
                  setIsEditMode={setIsEditMode}
                  setShowMeetingDialog={setShowMeetingDialog}
                  setShowApproveDialog={setShowApproveDialog}
                  setShowSendToDirectorDialog={setShowSendToDirectorDialog}
                  reportId={reportId}
                  businessCaseHasData={businessCaseHasData}
                />
              )}
            </div>
          </div>
        </CardHeader>
      </Card>
    </>
  );
}

// ── Decision spine content (sidebar) ───────────────────────────────

interface DecisionSpineContentProps {
  brainDecisionId: string | undefined;
  brainStatus: { label: string; badgeClass: string; nextGate: string };
  classification: string;
  classificationConfidence: number | null | undefined;
  artifactMeta: Record<string, unknown> | undefined;
  actualExecution: { badge: string; label: string; description: string; variant: string };
  plannedRouting: { badge: string; label: string; variant: string };
  orchestrationSummary?: {
    iplanId?: string | null;
    redactionMode?: string | null;
    mode?: string | null;
    primaryEngineKind?: string | null;
    primaryPluginName?: string | null;
    status: 'pending' | 'ready';
    agents: string[];
    note: string;
  };
  showBrainApprovalButton: boolean;
  setShowBrainGovernance: (v: boolean) => void;
  setShowBrainApproval: (v: boolean) => void;
}

function resolveArtifactLabel(artifactMeta: DecisionSpineContentProps["artifactMeta"]): string {
  if (typeof artifactMeta?.actualEngineLabel === "string" && artifactMeta.actualEngineLabel) {
    return artifactMeta.actualEngineLabel;
  }
  if (typeof artifactMeta?.plannedEngineLabel === "string" && artifactMeta.plannedEngineLabel) {
    return artifactMeta.plannedEngineLabel;
  }
  return "Artifact provenance captured";
}

export function MovedDecisionSpineContent(props: Readonly<DecisionSpineContentProps>) {
  const { t } = useTranslation();
  const {
    brainDecisionId, brainStatus, classification, classificationConfidence,
    artifactMeta, actualExecution, plannedRouting, orchestrationSummary: _orchestrationSummary,
    showBrainApprovalButton, setShowBrainGovernance, setShowBrainApproval,
  } = props;
  const artifactLabel = resolveArtifactLabel(artifactMeta);

  if (!brainDecisionId) return null;

  const classificationConfidencePercent = normalizePercentValue(classificationConfidence);

  return (
    <div className="rounded-xl border border-border/60 bg-card/95 p-3 shadow-sm space-y-3" data-testid="brain-ribbon-business-case-moved">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("demand.tabs.businessCase.decisionSpine")}</p>
        <p className="text-xs font-mono text-foreground truncate">{brainDecisionId}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={`text-xs ${brainStatus.badgeClass}`}>{brainStatus.label}</Badge>
        <Badge variant="outline" className="text-xs">{t("demand.tabs.businessCase.classificationLabel")}: {classification}</Badge>
        <Badge variant="outline" className="text-xs">{t("demand.tabs.businessCase.nextGate")}: {brainStatus.nextGate}</Badge>
        {classificationConfidencePercent != null && (
          <Badge variant="outline" className="text-xs">{t("demand.tabs.businessCase.confidence")} {classificationConfidencePercent}%</Badge>
        )}
        {artifactMeta && (
          <Badge variant="outline" className="text-xs">Brain artifact recorded</Badge>
        )}
        {artifactMeta?.version != null && (
          <Badge variant="outline" className="text-xs">
            {t("demand.tabs.businessCase.brainDraft")} v{typeof artifactMeta.version === "string" || typeof artifactMeta.version === "number" ? artifactMeta.version : JSON.stringify(artifactMeta.version)}
          </Badge>
        )}
      </div>
      {artifactMeta && (
        <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3 space-y-1.5" data-testid="card-business-case-artifact-meta">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Brain artifact</p>
          <p className="text-[11px] text-foreground">{artifactLabel}</p>
          {typeof artifactMeta.generatedAt === "string" && artifactMeta.generatedAt ? (
            <p className="text-[11px] text-muted-foreground">Generated at {artifactMeta.generatedAt}</p>
          ) : null}
          {typeof artifactMeta.executionMode === "string" && artifactMeta.executionMode ? (
            <p className="text-[11px] text-muted-foreground">Execution mode: {artifactMeta.executionMode}</p>
          ) : null}
        </div>
      )}
      <div className={`rounded-xl border px-3 py-3 ${resolveExecutionVariantClass(actualExecution.variant)}`} data-testid="card-business-case-route-summary">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[11px]">{plannedRouting.badge}</Badge>
          <Badge variant="outline" className="text-[11px]">{actualExecution.badge}</Badge>
        </div>
        <div className="mt-2 space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Planned route: {plannedRouting.label}</p>
          <p className="text-xs font-semibold text-foreground">Actual execution: {actualExecution.label}</p>
          <p className="text-[11px] leading-5 text-muted-foreground">{actualExecution.description}</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" size="sm" onClick={() => setShowBrainGovernance(true)} className="group h-9 justify-between rounded-xl border-slate-300/80 bg-white/90 px-3 text-xs font-semibold text-slate-800 shadow-sm transition-all hover:-translate-y-[1px] hover:bg-slate-50 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800" data-testid="button-open-brain-governance-moved">
          <span>{t("demand.tabs.businessCase.governance")}</span>
          <span className="text-[11px] text-slate-500 transition-transform group-hover:translate-x-0.5 dark:text-slate-400">→</span>
        </Button>
        {showBrainApprovalButton && (
          <Button size="sm" onClick={() => setShowBrainApproval(true)} className="group h-9 justify-between rounded-xl bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 px-3 text-xs font-semibold text-white shadow-[0_16px_30px_-22px_rgba(14,165,233,0.9)] transition-all hover:-translate-y-[1px] hover:from-sky-700 hover:via-cyan-700 hover:to-teal-700" data-testid="button-open-brain-approval-moved">
            <span>{t("demand.tabs.businessCase.approvalBtn")}</span>
            <span className="text-[11px] transition-transform group-hover:translate-x-0.5">→</span>
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Fixed header: compliance + governance + actions ─────────────────

interface FixedHeaderSectionProps {
  isFullscreen: boolean;
  complianceStatus: { criticalViolations: number; totalViolations: number; overallScore: number } | null;
  setShowCompliancePanel: (v: boolean) => void;
  showMainGovernanceCard: boolean;
  isEditMode: boolean;
  latestVersion: ReportVersion | null;
  displayVersionLabel: string;
  showVersionSheet: boolean;
  setShowVersionSheet: (v: boolean) => void;
  submitForReview: { mutate: () => void; isPending: boolean };
  createVersionMutation: { isPending: boolean };
  handleCreateNewVersion: () => void;
  setIsEditMode: (v: boolean) => void;
  setShowMeetingDialog: (v: boolean) => void;
  setShowApproveDialog: (v: boolean) => void;
  setShowSendToDirectorDialog: (v: boolean) => void;
  reportId: string;
  reportAccess: { canApprove: boolean; canFinalApprove: boolean };
  finalApprove: { mutate: () => void; isPending: boolean };
  handleEditToggle: () => void;
  handleSaveClick: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
  businessCaseData: { data?: BusinessCaseData } | null;
}

function ComplianceBanner({ complianceStatus, setShowCompliancePanel }: Readonly<{ complianceStatus: { criticalViolations: number; totalViolations: number; overallScore: number }; setShowCompliancePanel: (v: boolean) => void }>) {
  const { t } = useTranslation();
  return (
    <Alert variant={complianceStatus.criticalViolations > 0 ? "destructive" : "default"} className={resolveComplianceAlertClass(complianceStatus)} data-testid="alert-compliance-status">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>{t("demand.tabs.businessCase.complianceScore")}: {Math.round(complianceStatus.overallScore)}%</span>
      </AlertTitle>
      <AlertDescription className="flex justify-between items-center gap-4 mt-2">
        <span>{resolveComplianceMessage(complianceStatus, t)}</span>
        <Button variant="outline" size="sm" onClick={() => setShowCompliancePanel(true)} data-testid="button-view-compliance">
          <Shield className="h-4 w-4 mr-2" />
          {t("demand.tabs.businessCase.viewDetails")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

interface GovernanceEditSessionProps {
  handleSaveClick: () => void;
  handleEditToggle: () => void;
}

function GovernanceEditSession({ handleSaveClick, handleEditToggle }: Readonly<GovernanceEditSessionProps>) {
  const { t } = useTranslation();
  return (
    <div className="animate-fade-in w-full justify-self-end rounded-xl border border-sky-300/50 bg-sky-50/80 p-3 shadow-sm dark:border-sky-500/30 dark:bg-sky-500/10">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Edit Session</p>
      <p className="mt-1 text-xs text-sky-900 dark:text-sky-50">Validate, then save as a tracked version.</p>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <Button onClick={handleSaveClick} variant="default" className="h-9 rounded-lg bg-sky-600 px-3 text-[11px] font-semibold text-white hover:bg-sky-700" data-testid="button-save-exit">
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {t("demand.tabs.businessCase.saveAndExit")}
        </Button>
        <Button onClick={handleEditToggle} variant="outline" className="h-9 rounded-lg border-slate-300/80 bg-white/90 px-3 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800" data-testid="button-cancel-edit">
          <X className="mr-1.5 h-3.5 w-3.5" />
          {t("demand.tabs.businessCase.cancel")}
        </Button>
      </div>
    </div>
  );
}

interface GovernanceActionButtonsProps {
  latestVersion: ReportVersion | null;
  reportAccess: { canApprove: boolean; canFinalApprove: boolean };
  submitForReview: { mutate: () => void; isPending: boolean };
  finalApprove: { mutate: () => void; isPending: boolean };
  createVersionMutation: { isPending: boolean };
  handleCreateNewVersion: () => void;
  setIsEditMode: (v: boolean) => void;
  setShowApproveDialog: (v: boolean) => void;
  setShowSendToDirectorDialog: (v: boolean) => void;
  setShowMeetingDialog: (v: boolean) => void;
  reportId: string;
  businessCaseHasData: boolean;
}

function GovernanceActionButtons(props: Readonly<GovernanceActionButtonsProps>) {
  const { t } = useTranslation();
  const {
    latestVersion, reportAccess, submitForReview, finalApprove,
    createVersionMutation, handleCreateNewVersion, setIsEditMode,
    setShowApproveDialog, setShowSendToDirectorDialog, setShowMeetingDialog,
    reportId, businessCaseHasData,
  } = props;
  const isLocked = latestVersion && (latestVersion.status === "manager_approval" || latestVersion.status === "published");
  let approvalHelpText: string | null = null;
  if (latestVersion?.status === "under_review") {
    approvalHelpText = "Reviewer approval requires workflow approval permission in the active session.";
  } else if (latestVersion?.status === "approved") {
    approvalHelpText = "Submitting to director requires workflow approval permission in the active session.";
  } else if (latestVersion?.status === "manager_approval") {
    approvalHelpText = "Final approval requires final-approve permission in the active session.";
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {latestVersion?.status === "draft" && (
          <Button onClick={() => submitForReview.mutate()} variant="default" size="sm" disabled={submitForReview.isPending} className="h-8 rounded-lg bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 px-3 text-[11px] font-semibold text-white shadow-md shadow-cyan-500/20 hover:from-sky-700 hover:via-cyan-700 hover:to-teal-700" data-testid="button-submit-review">
            {submitForReview.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
            {t("demand.tabs.businessCase.submitForReview")}
          </Button>
        )}

        {latestVersion?.status === "under_review" && (
          <Button onClick={() => setShowApproveDialog(true)} variant="default" size="sm" disabled={!reportAccess.canApprove} className="h-8 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 text-[11px] font-semibold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-approve">
            <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
            {t("demand.tabs.businessCase.initialApproval")}
          </Button>
        )}

        {latestVersion?.status === "approved" && (
          <Button onClick={() => setShowSendToDirectorDialog(true)} variant="default" size="sm" disabled={!reportAccess.canApprove} className="h-8 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 text-[11px] font-semibold text-white shadow-md shadow-violet-500/20 hover:from-violet-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-submit-director">
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {t("demand.tabs.businessCase.submitForDirector")}
          </Button>
        )}

        {latestVersion?.status === "manager_approval" && (
          <Button onClick={() => finalApprove.mutate()} variant="default" size="sm" disabled={finalApprove.isPending || !reportAccess.canFinalApprove} className="h-8 rounded-lg bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-3 text-[11px] font-semibold text-white shadow-md shadow-fuchsia-500/20 hover:from-fuchsia-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-final-approve">
            {finalApprove.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-1.5 h-3.5 w-3.5" />}
            {t("demand.tabs.businessCase.finalApproval")}
          </Button>
        )}

        {isLocked && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handleCreateNewVersion} variant="outline" size="sm" disabled={createVersionMutation.isPending} className="h-8 rounded-lg border-slate-300/80 bg-white/90 px-3 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800" data-testid="button-create-new-version">
              {createVersionMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <GitBranch className="mr-1.5 h-3.5 w-3.5" />}
              {t("demand.tabs.businessCase.newVersion")}
            </Button>
          </div>
        )}
        {!isLocked && businessCaseHasData && (
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsEditMode(true)} variant="outline" size="sm" className="h-8 rounded-lg border-slate-300/80 bg-white/90 px-3 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800" data-testid="button-edit-business-case">
              <Edit className="mr-1.5 h-3.5 w-3.5" />
              {t("demand.tabs.businessCase.edit")}
            </Button>
          </div>
        )}
      </div>

      {approvalHelpText && ((latestVersion?.status === "under_review" && !reportAccess.canApprove) || (latestVersion?.status === "approved" && !reportAccess.canApprove) || (latestVersion?.status === "manager_approval" && !reportAccess.canFinalApprove)) && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300" data-testid="text-approval-permission-hint">
          {approvalHelpText}
        </p>
      )}

      <div className="grid gap-1.5 sm:grid-cols-2">
        <Button onClick={() => setShowMeetingDialog(true)} variant="outline" size="sm" className="h-8 justify-start rounded-lg border-amber-300/70 bg-amber-50/80 px-3 text-[11px] font-semibold text-amber-900 shadow-sm hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/15" data-testid="button-schedule-meeting">
          <Calendar className="mr-1.5 h-3.5 w-3.5" />
          {t("demand.tabs.businessCase.scheduleMeeting")}
        </Button>
        <div className="[&>button]:h-8 [&>button]:w-full [&>button]:justify-start [&>button]:rounded-lg [&>button]:border-slate-300/80 [&>button]:bg-white/90 [&>button]:px-3 [&>button]:text-[11px] [&>button]:font-semibold [&>button]:shadow-sm [&>button]:hover:bg-slate-50 dark:[&>button]:border-slate-600/70 dark:[&>button]:bg-slate-900/60 dark:[&>button]:hover:bg-slate-800">
          <DocumentExportDropdown reportId={reportId} versionId={latestVersion?.id} documentType="business_case" />
        </div>
      </div>
    </div>
  );
}

export function FixedHeaderSection(props: Readonly<FixedHeaderSectionProps>) {
  const { t } = useTranslation();
  const {
    isFullscreen, complianceStatus, setShowCompliancePanel,
    showMainGovernanceCard, isEditMode, latestVersion, displayVersionLabel,
    showVersionSheet, setShowVersionSheet, submitForReview,
    createVersionMutation, handleCreateNewVersion, setIsEditMode,
    setShowMeetingDialog, setShowApproveDialog, setShowSendToDirectorDialog,
    reportId, reportAccess, finalApprove,
    handleEditToggle, handleSaveClick, getStatusBadge, businessCaseData,
  } = props;

  if (isFullscreen) return null;

  return (
    <div className="flex-shrink-0 px-6 pt-4 pb-4 border-b border-border/50 bg-background/80 backdrop-blur-sm z-10 space-y-3">
      {complianceStatus && <ComplianceBanner complianceStatus={complianceStatus} setShowCompliancePanel={setShowCompliancePanel} />}

      {showMainGovernanceCard && (
        <Card className="overflow-hidden border-border/60 bg-card/95 shadow-sm">
          <CardHeader className="pb-2.5">
            <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-2.5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] dark:border-slate-800/80 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_24%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.9))]">
              <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
                <div className="min-w-0 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-500 text-white shadow-md shadow-cyan-500/20">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">Business case governance and actions</h3>
                        {isEditMode && (
                          <Badge variant="outline" className="h-5 border-sky-400/40 bg-sky-500/10 px-1.5 text-[10px] text-sky-700 dark:text-sky-300">
                            <Edit className="mr-1 h-3 w-3" />
                            {t("demand.tabs.businessCase.editingMode")}
                          </Badge>
                        )}
                        {latestVersion && (latestVersion.status === "manager_approval" || latestVersion.status === "published") && (
                          <Badge variant="outline" className="h-5 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                            <LockIcon className="mr-1 h-3 w-3" />
                            {t("demand.tabs.businessCase.approvedAndLocked")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] whitespace-nowrap text-slate-600 dark:text-slate-300">A compact workspace for review, approvals, scheduling, and export.</p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:max-w-[24rem]">
                    <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white/80 px-2.5 py-2 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60">
                      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Version</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex h-7 min-w-[3.75rem] items-center justify-center rounded-md bg-slate-900 px-2 text-[11px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                          {displayVersionLabel}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-50">Current release</p>
                          <div className="mt-1 flex items-center gap-1.5">{latestVersion ? getStatusBadge(latestVersion.status) : <Badge variant="outline">No version</Badge>}</div>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white/80 px-2.5 py-2 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60">
                      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Workflow</p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] font-medium text-slate-900 dark:text-slate-50">
                        <Clock className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                        <span>{latestVersion ? `Stage: ${String(latestVersion.status).replaceAll("_", " ")}` : "No active workflow"}</span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Filtered by approval state.</p>
                    </div>
                  </div>
                </div>

                <div className="command-dock w-full justify-self-end rounded-xl border border-slate-200/80 bg-white/85 p-2.5 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/65">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Action Dock</p>
                      <p className="truncate text-[11px] text-slate-600 dark:text-slate-300">Primary decisions first.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowVersionSheet(!showVersionSheet)} className="h-8 rounded-lg border-slate-300/80 bg-white/80 px-2.5 text-[11px] font-semibold shadow-sm hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-900/60 dark:hover:bg-slate-800" data-testid="button-toggle-versions">
                      <GitBranch className="mr-2 h-4 w-4" />
                      {showVersionSheet ? t("demand.tabs.businessCase.hide") : t("demand.tabs.businessCase.show")} {t("demand.tabs.businessCase.versions")}
                    </Button>
                  </div>

                  {isEditMode ? (
                    <GovernanceEditSession handleSaveClick={handleSaveClick} handleEditToggle={handleEditToggle} />
                  ) : (
                    <GovernanceActionButtons
                      latestVersion={latestVersion}
                      reportAccess={reportAccess}
                      submitForReview={submitForReview}
                      finalApprove={finalApprove}
                      createVersionMutation={createVersionMutation}
                      handleCreateNewVersion={handleCreateNewVersion}
                      setIsEditMode={setIsEditMode}
                      setShowApproveDialog={setShowApproveDialog}
                      setShowSendToDirectorDialog={setShowSendToDirectorDialog}
                      setShowMeetingDialog={setShowMeetingDialog}
                      reportId={reportId}
                      businessCaseHasData={!!businessCaseData?.data}
                    />
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

// ── Locked state warning banner ────────────────────────────────────

interface LockedStateBannerProps {
  latestVersion: ReportVersion | null;
}

export function LockedStateBanner({ latestVersion }: Readonly<LockedStateBannerProps>) {
  const { t } = useTranslation();
  const isLocked = latestVersion && (latestVersion.status === "manager_approval" || latestVersion.status === "published");
  if (!isLocked) return null;

  return (
    <Card className="border-green-500/30 bg-gradient-to-r from-green-500/5 to-emerald-500/5">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-3 rounded-full bg-green-500/10">
            <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-green-700 dark:text-green-400">
                {t("demand.tabs.businessCase.businessCaseDocumentLocked")}
              </h3>
              <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                {latestVersion.status === "published" ? t("demand.tabs.businessCase.published") : t("demand.tabs.businessCase.finalApproval")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("demand.tabs.businessCase.documentLockedDescription")}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
              <AlertTriangle className="h-4 w-4" />
              <span>{t("demand.tabs.businessCase.versionLabel")} {latestVersion.versionNumber} | {t("demand.tabs.businessCase.approvedOn")} {new Date(latestVersion.approvedAt || latestVersion.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── AI metadata section ────────────────────────────────────────────

interface AIMetadataSectionProps {
  generatedConfidence: AIConfidence | null;
  generatedCitations: AICitation[] | null;
}

export function AIMetadataSection({ generatedConfidence, generatedCitations }: Readonly<AIMetadataSectionProps>) {
  const hasCitations = generatedCitations && generatedCitations.length > 0;
  if (!generatedConfidence && !hasCitations) return null;

  return (
    <div className="space-y-3">
      {generatedConfidence && (
        <div className="flex justify-end">
          <AIConfidenceBadge confidence={generatedConfidence} data-testid="badge-business-case-confidence" />
        </div>
      )}
      {hasCitations && (
        <AICitationsList citations={generatedCitations} data-testid="list-business-case-citations" />
      )}
    </div>
  );
}

// ── Clarifications section ─────────────────────────────────────────

interface ClarificationsSectionProps {
  clarifications: ClarificationDomain[] | null;
  completenessScore: number | null;
  expandedDomains: Record<string, boolean>;
  setExpandedDomains: (v: Record<string, boolean>) => void;
  clarificationResponses: Record<string, { domain: string; questionId: number; answer: string }>;
  handleClarificationChange: (domainIdx: number, qIdx: number, domain: string, answer: string) => void;
  submitClarificationsMutation: { mutate: () => void; isPending: boolean };
  dataCompletenessExpanded: boolean;
  setDataCompletenessExpanded: (v: boolean) => void;
}

function ClarificationQuestionItem({ q, domainIdx, qIdx, domain, clarificationResponses, handleClarificationChange }: Readonly<{
  q: ClarificationQuestion;
  domainIdx: number;
  qIdx: number;
  domain: string;
  clarificationResponses: Record<string, { domain: string; questionId: number; answer: string }>;
  handleClarificationChange: (domainIdx: number, qIdx: number, domain: string, answer: string) => void;
}>) {
  const { t } = useTranslation();
  const priorityVariant = resolvePriorityVariant(q.priority);

  return (
    <div className="border rounded-md p-3 bg-card space-y-2" data-testid={`question-${domainIdx}-${qIdx}`}>
      <div className="flex items-start gap-2">
        <HelpCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium flex-1">{q.question}</p>
            <Badge variant={priorityVariant} className="text-xs flex-shrink-0">{q.priority} priority</Badge>
          </div>

          {q.suggestedAnswer && (
            <div className="mt-2 p-2 rounded bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">{t("demand.tabs.businessCase.suggestedAnswer")}:</p>
              <p className="text-xs">{q.suggestedAnswer}</p>
            </div>
          )}

          <div className="mt-3">
            <Label htmlFor={`response-${domainIdx}-${qIdx}`} className="text-xs text-muted-foreground">{t("demand.tabs.businessCase.yourAnswer")}:</Label>
            <Textarea
              id={`response-${domainIdx}-${qIdx}`}
              value={clarificationResponses[`${domainIdx}-${qIdx}`]?.answer || ""}
              onChange={(e) => handleClarificationChange(domainIdx, qIdx, domain, e.target.value)}
              placeholder={t("demand.tabs.businessCase.enterResponsePlaceholder")}
              className="mt-1.5 min-h-[80px] text-sm"
              data-testid={`textarea-response-${domainIdx}-${qIdx}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ClarificationDomainCollapsible({ clarification, domainIdx, isExpanded, setExpandedDomains, clarificationResponses, handleClarificationChange }: Readonly<{
  clarification: ClarificationDomain;
  domainIdx: number;
  isExpanded: boolean;
  setExpandedDomains: (v: Record<string, boolean>) => void;
  clarificationResponses: Record<string, { domain: string; questionId: number; answer: string }>;
  handleClarificationChange: (domainIdx: number, qIdx: number, domain: string, answer: string) => void;
}>) {
  const { t } = useTranslation();
  const DomainIcon = resolveDomainIcon(clarification.domain);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={(open) => {
        setExpandedDomains({ [clarification.domain]: open });
      }}
      data-testid={`collapsible-domain-${clarification.domain.toLowerCase()}`}
    >
      <div className="border rounded-lg overflow-hidden bg-card">
        <CollapsibleTrigger className="w-full hover-elevate" data-testid={`button-toggle-domain-${clarification.domain.toLowerCase()}`}>
          <div className="flex items-center justify-between p-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white">
                <DomainIcon className="h-4 w-4" />
              </div>
              <div className="text-left">
                <h4 className="font-semibold text-sm">{clarification.domain}</h4>
                <p className="text-xs text-muted-foreground">
                  {clarification.questions?.length || 0} question{(clarification.questions?.length || 0) > 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{isExpanded ? t("demand.tabs.businessCase.collapse") : t("demand.tabs.businessCase.expand")}</Badge>
              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-4 py-3 space-y-3 bg-muted/30">
            {clarification.questions?.map((q: ClarificationQuestion, qIdx: number) => (
              <ClarificationQuestionItem
                key={q.question}
                q={q}
                domainIdx={domainIdx}
                qIdx={qIdx}
                domain={clarification.domain}
                clarificationResponses={clarificationResponses}
                handleClarificationChange={handleClarificationChange}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function ClarificationsSection(props: Readonly<ClarificationsSectionProps>) {
  const { t } = useTranslation();
  const {
    clarifications, completenessScore, expandedDomains, setExpandedDomains,
    clarificationResponses, handleClarificationChange, submitClarificationsMutation,
    dataCompletenessExpanded, setDataCompletenessExpanded,
  } = props;

  const showIncomplete = clarifications && clarifications.length > 0 && completenessScore !== null && completenessScore < 100;
  const showComplete = completenessScore !== null && completenessScore === 100;

  if (!showIncomplete && !showComplete) return null;
  if (!clarifications) return null;

  if (showComplete) {
    return (
      <Alert className="border-green-500/30 bg-gradient-to-r from-green-500/5 to-emerald-500/5" data-testid="alert-completeness-success">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <AlertTitle className="text-base font-semibold">{t("demand.tabs.businessCase.dataCompleteness")}: 100%</AlertTitle>
        <AlertDescription className="mt-2">
          <div className="space-y-2">
            <Progress value={100} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">{t("demand.tabs.businessCase.dataCompletenessExcellent")}</p>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Collapsible open={dataCompletenessExpanded} onOpenChange={setDataCompletenessExpanded}>
      <div className="border border-amber-500/30 rounded-lg bg-gradient-to-r from-amber-500/5 to-orange-500/5" data-testid="alert-clarifications">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-4 cursor-pointer hover-elevate rounded-lg">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div className="text-left">
                <span className="text-base font-semibold">{t("demand.tabs.businessCase.dataCompleteness")}: {completenessScore}%</span>
                <Badge variant="outline" className="ml-2 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                  {clarifications.length} domain{clarifications.length > 1 ? "s" : ""} need clarification
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={completenessScore} className="h-2 w-24" data-testid="progress-completeness" />
              {dataCompletenessExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              The AI has identified some areas that need additional information to improve the quality of this business case.
              Providing answers to these questions will enhance the accuracy and completeness of the analysis.
            </p>

            <div className="space-y-3">
              {clarifications.map((clarification: ClarificationDomain, domainIdx: number) => (
                <ClarificationDomainCollapsible
                  key={clarification.domain}
                  clarification={clarification}
                  domainIdx={domainIdx}
                  isExpanded={expandedDomains[clarification.domain] || false}
                  setExpandedDomains={(partial) => setExpandedDomains({ ...expandedDomains, ...partial })}
                  clarificationResponses={clarificationResponses}
                  handleClarificationChange={handleClarificationChange}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t">
              <div className="flex items-start gap-2 flex-1">
                <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Provide answers to improve the quality of your business case. The AI will regenerate the analysis with your additional information.
                </p>
              </div>
              <Button onClick={() => submitClarificationsMutation.mutate()} disabled={submitClarificationsMutation.isPending || Object.keys(clarificationResponses).length === 0} data-testid="button-submit-clarifications" className="flex-shrink-0">
                {submitClarificationsMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("demand.tabs.businessCase.regenerating")}</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />{t("demand.tabs.businessCase.submitAnswers")}</>
                )}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ── Recommendations & conclusion card ──────────────────────────────

interface RecommendationsCardProps {
  businessCase: BusinessCaseData;
  isEditMode: boolean;
  updateField: (field: string, value: unknown) => void;
  activeFinancialView?: 'pilot' | 'full';
  computedRecommendation: {
    verdict: string;
    label: string;
    summary: string;
    roi?: number;
    npv?: number;
    paybackMonths?: number;
    paybackYears?: number;
    financialView?: 'pilot' | 'full';
    roiLabel?: string;
  } | null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function formatRecommendationPayback(paybackMonths?: number, paybackYears?: number): string | null {
  if (typeof paybackMonths === 'number' && Number.isFinite(paybackMonths) && paybackMonths >= 0) {
    if (paybackMonths < 12) {
      const roundedMonths = Math.max(1, Math.round(paybackMonths));
      return `${roundedMonths} ${roundedMonths === 1 ? 'month' : 'months'}`;
    }

    return `${(paybackMonths / 12).toFixed(1)} years`;
  }

  if (typeof paybackYears === 'number' && Number.isFinite(paybackYears) && paybackYears >= 0) {
    return `${paybackYears.toFixed(1)} years`;
  }

  return null;
}

function FinancialDecisionSummary({ computedRecommendation }: Readonly<{ computedRecommendation: NonNullable<RecommendationsCardProps["computedRecommendation"]> }>) {
  const { t } = useTranslation();
  const { label, summary } = computedRecommendation;
  const iconMap: Record<string, React.ReactNode> = {
    RECOMMENDED: <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
    CONDITIONAL: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
  };

  return (
    <div className={`p-4 rounded-lg ${resolveRecommendationCardClass(label)}`} data-testid="financial-decision-summary">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {iconMap[label] ?? <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
          <span className="font-semibold">{t("demand.tabs.businessCase.financialModelDecision")}</span>
        </div>
        <Badge variant={resolveRecommendationBadgeVariant(label)} className={resolveRecommendationBadgeClass(label)}>{label}</Badge>
      </div>
      {summary && <p className="text-sm text-muted-foreground mt-2">{summary}</p>}
    </div>
  );
}

function ConclusionFinancialMetrics({ computedRecommendation }: Readonly<{ computedRecommendation: NonNullable<RecommendationsCardProps["computedRecommendation"]> }>) {
  const { t } = useTranslation();
  const { label, roi, npv, paybackMonths, paybackYears, roiLabel } = computedRecommendation;
  const paybackDisplay = /pilot/i.test(label) ? null : formatRecommendationPayback(paybackMonths, paybackYears);

  return (
    <div className="mt-3 p-3 bg-muted/30 rounded-lg border" data-testid="conclusion-financial-metrics">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{t("demand.tabs.businessCase.financialOverviewMetrics")}</p>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">{t("demand.tabs.businessCase.decision")}:</span>
          <Badge variant={resolveRecommendationBadgeVariant(label)} className={resolveRecommendationBadgeClass(label)}>{label}</Badge>
        </div>
        {roi !== undefined && (
          <div className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span className="text-muted-foreground">{roiLabel ?? t("demand.tabs.businessCase.fiveYearROI")}:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{roi.toFixed(0)}%</span>
          </div>
        )}
        {npv !== undefined && (
          <div className="flex items-center gap-1">
            <DollarSign className="h-4 w-4 text-blue-500" />
            <span className="text-muted-foreground">{t("demand.tabs.businessCase.npv")}:</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">{formatBusinessCaseCurrency(npv)}</span>
          </div>
        )}
        {paybackDisplay && (
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-purple-500" />
            <span className="text-muted-foreground">{t("demand.tabs.businessCase.payback")}:</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">{paybackDisplay}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function NextStepsEditor({ businessCase, updateField }: Readonly<{ businessCase: BusinessCaseData; updateField: (field: string, value: unknown) => void }>) {
  const { t } = useTranslation();
  const steps = (businessCase.nextSteps ?? []) as NextStep[];

  return (
    <div className="space-y-3">
      {steps.map((step: NextStep, idx: number) => (
        <div key={step.action || `step-${idx}`} className="border rounded-lg p-3 space-y-2">
          <div className="flex gap-2">
            <Input placeholder={t("demand.tabs.businessCase.action")} value={step.action || ""} onChange={(e) => { const updated = [...steps]; updated[idx] = { ...step, action: e.target.value }; updateField("nextSteps", updated); }} className="flex-1" data-testid={`input-next-step-action-${idx}`} />
            <Input placeholder={t("demand.tabs.businessCase.owner")} value={step.owner || ""} onChange={(e) => { const updated = [...steps]; updated[idx] = { ...step, owner: e.target.value }; updateField("nextSteps", updated); }} className="w-32" data-testid={`input-next-step-owner-${idx}`} />
            <Select value={step.priority || ""} onValueChange={(val) => { const updated = [...steps]; updated[idx] = { ...step, priority: val }; updateField("nextSteps", updated); }}>
              <SelectTrigger className="w-28" data-testid={`select-next-step-priority-${idx}`}><SelectValue placeholder={t("demand.tabs.businessCase.priority")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="High">{t("demand.tabs.businessCase.high")}</SelectItem>
                <SelectItem value="Medium">{t("demand.tabs.businessCase.medium")}</SelectItem>
                <SelectItem value="Low">{t("demand.tabs.businessCase.low")}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => { const updated = steps.filter((_: NextStep, i: number) => i !== idx); updateField("nextSteps", updated); }} data-testid={`button-remove-next-step-${idx}`}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Input placeholder={t("demand.tabs.businessCase.timeline")} value={step.timeline || ""} onChange={(e) => { const updated = [...steps]; updated[idx] = { ...step, timeline: e.target.value }; updateField("nextSteps", updated); }} data-testid={`input-next-step-timeline-${idx}`} />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => { const updated = [...steps, { action: "", owner: "", timeline: "", priority: "Medium" }]; updateField("nextSteps", updated); }} data-testid="button-add-next-step">
        {t("demand.tabs.businessCase.addNextStep")}
      </Button>
    </div>
  );
}

function NextStepsReadonly({ businessCase }: Readonly<{ businessCase: BusinessCaseData }>) {
  const rawSteps = Array.isArray(businessCase.nextSteps) ? businessCase.nextSteps : [];
  const steps = rawSteps.map((step, idx) => {
    if (typeof step === "string") {
      return {
        action: step,
        owner: idx === 0 ? "PMO" : "Delivery Team",
        priority: idx === 0 ? "High" : "Medium",
        timeline: "TBD",
      } as NextStep;
    }

    const record = (step && typeof step === "object" ? step : {}) as NextStep;
    return {
      ...record,
      action: record.action || record.step || record.text || record.description || `Next step ${idx + 1}`,
      owner: record.owner || "Delivery Team",
      priority: record.priority || "Medium",
      timeline: record.timeline || record.deadline || "TBD",
    } as NextStep;
  });

  return (
    <div className="space-y-2">
      {steps.map((step: NextStep, idx: number) => (
        <div key={step.action || `step-${idx}`} className="flex items-start gap-2 border-l-4 border-emerald-500 pl-3 py-2" data-testid={`item-next-step-${idx}`}>
          <div className="flex-1">
            <p className="text-sm font-medium">{step.action}</p>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{step.owner}</Badge>
              <Badge variant={step.priority === "High" ? "default" : "outline"} className="text-xs">{step.priority}</Badge>
              {step.timeline && <span className="text-xs text-muted-foreground">Timeline: {step.timeline}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecommendationsCard({ businessCase, isEditMode, updateField, computedRecommendation, activeFinancialView }: Readonly<RecommendationsCardProps>) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white">
            <CheckCircle className="h-4 w-4" />
          </div>
          {t("demand.tabs.businessCase.recommendationsAndConclusion")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {computedRecommendation && <FinancialDecisionSummary computedRecommendation={computedRecommendation} />}

        {/* Primary Recommendation */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t("demand.tabs.businessCase.primaryRecommendation")}</p>
          {isEditMode ? (
            <Textarea
              value={getRecommendationsText(businessCase.recommendations)}
              onChange={(e) => {
                const value = e.target.value;
                if (businessCase.recommendations && typeof businessCase.recommendations === "object" && !Array.isArray(businessCase.recommendations)) {
                  updateField("recommendations", { ...businessCase.recommendations, primaryRecommendation: value, summary: value });
                } else {
                  updateField("recommendations", value);
                }
              }}
              className="min-h-[100px]"
              data-testid="textarea-recommendations"
            />
          ) : (
            <RecommendationsReadonly businessCase={businessCase} activeFinancialView={activeFinancialView ?? computedRecommendation?.financialView} />
          )}
        </div>

        {/* Conclusion Summary */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t("demand.tabs.businessCase.conclusionSummary")}</p>
          {isEditMode ? (
            <Textarea value={(businessCase.conclusionSummary as string) || ""} onChange={(e) => updateField("conclusionSummary", e.target.value)} className="min-h-[100px]" data-testid="textarea-conclusion-summary" />
          ) : (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-conclusion-summary">{businessCase.conclusionSummary as string}</p>
              {computedRecommendation && <ConclusionFinancialMetrics computedRecommendation={computedRecommendation} />}
            </div>
          )}
        </div>

        {/* Next Steps */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t("demand.tabs.businessCase.nextStepsLabel")}</p>
          {isEditMode ? (
            <NextStepsEditor businessCase={businessCase} updateField={updateField} />
          ) : (
            <NextStepsReadonly businessCase={businessCase} />
          )}
        </div>

        {/* Implementation Roadmap Visualization */}
        {businessCase.recommendations?.implementationRoadmap && typeof businessCase.recommendations.implementationRoadmap === "object" && !isEditMode && (
          <div className="mt-6">
            <ImplementationRoadmap
              quickWins={(businessCase.recommendations.implementationRoadmap as Record<string, unknown>).quickWins as Array<{ action: string; timeline: string }>}
              strategicInitiatives={(businessCase.recommendations.implementationRoadmap as Record<string, unknown>).strategicInitiatives as Array<{ action: string; timeline: string }>}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecommendationsReadonly({ businessCase, activeFinancialView }: Readonly<{ businessCase: BusinessCaseData; activeFinancialView?: 'pilot' | 'full' }>) {
  const { t } = useTranslation();
  const recs = businessCase.recommendations;
  const framework = recs?.decisionFramework as Record<string, string> | undefined;
  const computedFinancialModel = asRecord(businessCase.computedFinancialModel);
  const financialViews = asRecord(computedFinancialModel?.financialViews);
  const activeFinancialSnapshot = activeFinancialView ? asRecord(financialViews?.[activeFinancialView]) : undefined;
  const computedScenarios = (activeFinancialSnapshot?.scenarios
    || (businessCase.sensitivityAnalysis as Record<string, unknown> | undefined)?.scenarios
    || computedFinancialModel?.scenarios) as Array<Record<string, unknown>> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alternativeScenarios = (recs as any)?.alternativeScenarios as Record<string, { roi?: string | number; scenario?: string }> | undefined;
  const scenarios = Array.isArray(computedScenarios) && computedScenarios.length > 0
    ? {
        bestCase: computedScenarios.find((scenario) => safeScenarioName(scenario.name) === 'optimistic'),
        mostLikely: computedScenarios.find((scenario) => safeScenarioName(scenario.name) === 'base'),
        worstCase: computedScenarios.find((scenario) => safeScenarioName(scenario.name) === 'pessimistic'),
      }
    : alternativeScenarios;

  const renderScenarioMeta = (scenario: Record<string, unknown> | { roi?: string | number; scenario?: string } | undefined, fallback: string): { probabilityLabel: string | null; scenarioText: string } | null => {
    if (!scenario) return null;
    const npv = typeof (scenario as Record<string, unknown>).npv === 'number'
      ? formatBusinessCaseCurrency((scenario as Record<string, unknown>).npv as number)
      : null;
    const probability = typeof (scenario as Record<string, unknown>).probability === 'number'
      ? `${Math.round(((scenario as Record<string, unknown>).probability as number) * 100)}% probability`
      : null;
    const paybackMonths = typeof (scenario as Record<string, unknown>).paybackMonths === 'number'
      ? `${Math.round((scenario as Record<string, unknown>).paybackMonths as number)} months`
      : null;
    const scenarioText = typeof (scenario as Record<string, unknown>).scenario === 'string' && ((scenario as Record<string, unknown>).scenario as string).trim().length > 0
      ? (scenario as Record<string, unknown>).scenario as string
      : fallback;

    return {
      probabilityLabel: probability,
      scenarioText: [scenarioText, npv ? `NPV ${npv}` : null, paybackMonths ? `Payback ${paybackMonths}` : null].filter(Boolean).join(' • '),
    };
  };

  const bestCaseMeta = renderScenarioMeta(scenarios?.bestCase as Record<string, unknown> | undefined, 'Upside case with stronger benefit realization and contained operating costs.');
  const mostLikelyMeta = renderScenarioMeta(scenarios?.mostLikely as Record<string, unknown> | undefined, 'Base case using the validated financial assumptions and rollout profile.');
  const worstCaseMeta = renderScenarioMeta(scenarios?.worstCase as Record<string, unknown> | undefined, 'Downside case with slower adoption and higher delivery costs.');

  return (
    <>
      <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-recommendations">
        {getRecommendationsText(recs)}
      </p>

      {isEnrichedRecommendations(recs) && (
        <div className="mt-4 space-y-4">
          {framework && typeof framework === "object" && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-semibold text-sm mb-2">{t("demand.tabs.businessCase.decisionFramework")}</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Approach: </span>
                  <Badge variant={resolveApproachVariant(framework.recommendedApproach)}>
                    {framework.recommendedApproach || "N/A"}
                  </Badge>
                </div>
                {framework.rationale && (
                  <p className="text-muted-foreground">{framework.rationale}</p>
                )}
              </div>
            </div>
          )}

          {activeFinancialView !== 'pilot' && scenarios && typeof scenarios === "object" && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-semibold text-sm mb-3">{t("demand.tabs.businessCase.scenarioAnalysis")}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {scenarios?.bestCase && bestCaseMeta && (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-3">
                    <div className="font-medium text-sm text-green-700 dark:text-green-400 mb-1">{t("demand.tabs.businessCase.bestCase")}</div>
                    <div className="text-xs space-y-1">
                      {bestCaseMeta.probabilityLabel && <div>{bestCaseMeta.probabilityLabel}</div>}
                      <div className="text-muted-foreground">{bestCaseMeta.scenarioText}</div>
                    </div>
                  </div>
                )}
                {scenarios?.mostLikely && mostLikelyMeta && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded p-3">
                    <div className="font-medium text-sm text-blue-700 dark:text-blue-400 mb-1">{t("demand.tabs.businessCase.mostLikely")}</div>
                    <div className="text-xs space-y-1">
                      {mostLikelyMeta.probabilityLabel && <div>{mostLikelyMeta.probabilityLabel}</div>}
                      <div className="text-muted-foreground">{mostLikelyMeta.scenarioText}</div>
                    </div>
                  </div>
                )}
                {scenarios?.worstCase && worstCaseMeta && (
                  <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded p-3">
                    <div className="font-medium text-sm text-orange-700 dark:text-orange-400 mb-1">{t("demand.tabs.businessCase.worstCase")}</div>
                    <div className="text-xs space-y-1">
                      {worstCaseMeta.probabilityLabel && <div>{worstCaseMeta.probabilityLabel}</div>}
                      <div className="text-muted-foreground">{worstCaseMeta.scenarioText}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeFinancialView === 'pilot' && scenarios && typeof scenarios === 'object' && (
            <div className="border rounded-lg p-4 bg-muted/20">
              <h4 className="font-semibold text-sm mb-2">{t("demand.tabs.businessCase.scenarioAnalysis")}</h4>
              <p className="text-xs text-muted-foreground">
                Full commercial scenario analysis is hidden while the pilot financial view is active so the recommendation panel stays aligned to the pilot validation case.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function safeScenarioName(value: unknown): string {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'optimistic' || normalized === 'best') return 'optimistic';
  if (normalized === 'base' || normalized === 'base case' || normalized === 'mostlikely' || normalized === 'most_likely') return 'base';
  if (normalized === 'pessimistic' || normalized === 'worst') return 'pessimistic';
  return normalized;
}

function formatBusinessCaseCurrency(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 1_000_000_000) {
    return `AED ${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (absValue >= 1_000_000) {
    return `AED ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    return `AED ${(value / 1_000).toFixed(0)}K`;
  }
  return `AED ${Math.round(value)}`;
}
