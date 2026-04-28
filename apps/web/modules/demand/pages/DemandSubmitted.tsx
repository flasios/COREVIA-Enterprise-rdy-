import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useTranslation } from 'react-i18next';
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Calendar, Clock, AlertCircle, CheckCircle2, CircleDot, FileText, MessageSquare, RotateCcw, type LucideIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CoveriaAdvisor from "@/modules/advisor";
import { resolveDemandDisplayWorkflowStatus } from "./demandAnalysisReport.utils";

type SubmittedSummaryResponse = {
  success: boolean;
  report?: {
    id: string;
    projectId: string | null;
    suggestedProjectName: string | null;
    organizationName: string;
    department: string;
    requestorName: string;
    requestorEmail: string;
    urgency: string;
    businessObjective: string;
    currentChallenges: string | null;
    expectedOutcomes: string | null;
    successCriteria: string | null;
    constraints: string | null;
    currentCapacity: string | null;
    budgetRange: string | null;
    timeframe: string | null;
    stakeholders: string | null;
    existingSystems: string | null;
    integrationRequirements: string | null;
    complianceRequirements: string | null;
    riskFactors: string | null;
    dataClassification: string | null;
    workflowStatus: string;
    decisionReason: string | null;
    rejectionCategory: string | null;
    deferredUntil: string | null;
    meetingDate: string | null;
    meetingNotes: string | null;
    managerEmail: string | null;
    workflowHistory: Array<{ status?: string; newStatus?: string; timestamp: string; reason?: string }> | null;
    createdAt: string;
    updatedAt: string;
  };
  decisionFeedback?: {
    decisionId: string;
    status: string | null;
    correlationId: string | null;
    missingFields: Array<string>;
    requiredInfo?: Array<string>;
    completenessScore?: number | null;
    approval?: {
      status?: string;
      approvedBy?: string;
      approvalReason?: string;
      rejectionReason?: string;
      revisionNotes?: string;
    } | null;
    advisorySummary?: string | null;
    policyVerdict?: string | null;
  } | null;
  error?: string;
};

type CorrectionForm = {
  suggestedProjectName: string;
  businessObjective: string;
  currentChallenges: string;
  expectedOutcomes: string;
  successCriteria: string;
  constraints: string;
  currentCapacity: string;
  budgetRange: string;
  timeframe: string;
  stakeholders: string;
  existingSystems: string;
  integrationRequirements: string;
  complianceRequirements: string;
  riskFactors: string;
  dataClassification: string;
};

const statusColors: Record<string, string> = {
  generated: "bg-slate-100 text-slate-700",
  resubmitted: "bg-cyan-100 text-cyan-700",
  acknowledged: "bg-blue-100 text-blue-700",
  meeting_scheduled: "bg-indigo-100 text-indigo-700",
  under_review: "bg-amber-100 text-amber-700",
  initially_approved: "bg-emerald-100 text-emerald-700",
  manager_approved: "bg-emerald-100 text-emerald-700",
  pending_conversion: "bg-purple-100 text-purple-700",
  converted: "bg-emerald-100 text-emerald-700",
  deferred: "bg-orange-100 text-orange-700",
  rejected: "bg-rose-100 text-rose-700",
};

const statusIcons: Record<string, LucideIcon> = {
  generated: CircleDot,
  resubmitted: CircleDot,
  acknowledged: Clock,
  meeting_scheduled: Calendar,
  under_review: AlertCircle,
  initially_approved: CheckCircle2,
  manager_approved: CheckCircle2,
  pending_conversion: Clock,
  converted: CheckCircle2,
  deferred: AlertCircle,
  rejected: AlertCircle,
};

const correctionFields: Array<{ key: keyof CorrectionForm; label: string; multiline?: boolean; important?: boolean }> = [
  { key: "budgetRange", label: "Budget range", important: true },
  { key: "timeframe", label: "Timeframe", important: true },
  { key: "successCriteria", label: "Success criteria", multiline: true, important: true },
  { key: "currentChallenges", label: "Current challenges", multiline: true },
  { key: "expectedOutcomes", label: "Expected outcomes", multiline: true },
  { key: "stakeholders", label: "Stakeholders", multiline: true },
  { key: "existingSystems", label: "Existing systems", multiline: true },
  { key: "integrationRequirements", label: "Integration requirements", multiline: true },
  { key: "complianceRequirements", label: "Compliance requirements", multiline: true },
  { key: "riskFactors", label: "Risk factors", multiline: true },
  { key: "constraints", label: "Constraints", multiline: true },
  { key: "currentCapacity", label: "Current capacity", multiline: true },
  { key: "dataClassification", label: "Data classification" },
];

function normalizeFieldName(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isFieldOpen(fieldKey: keyof CorrectionForm, missingFields: string[], requiredInfo: string[]) {
  const normalizedKey = normalizeFieldName(fieldKey);
  return [...missingFields, ...requiredInfo].some((item) => {
    const normalizedItem = normalizeFieldName(String(item));
    return normalizedItem === normalizedKey || normalizedItem.includes(normalizedKey) || normalizedKey.includes(normalizedItem);
  });
}

function buildInitialCorrectionForm(report: SubmittedSummaryResponse["report"]): CorrectionForm {
  return {
    suggestedProjectName: report?.suggestedProjectName || "",
    businessObjective: report?.businessObjective || "",
    currentChallenges: report?.currentChallenges || "",
    expectedOutcomes: report?.expectedOutcomes || "",
    successCriteria: report?.successCriteria || "",
    constraints: report?.constraints || "",
    currentCapacity: report?.currentCapacity || "",
    budgetRange: report?.budgetRange || "",
    timeframe: report?.timeframe || "",
    stakeholders: report?.stakeholders || "",
    existingSystems: report?.existingSystems || "",
    integrationRequirements: report?.integrationRequirements || "",
    complianceRequirements: report?.complianceRequirements || "",
    riskFactors: report?.riskFactors || "",
    dataClassification: report?.dataClassification || "internal",
  };
}

export default function DemandSubmitted() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [match, params] = useRoute("/demand-submitted/:id");
  const reportId = match ? params.id : null;

  const { data, isLoading, error } = useQuery<SubmittedSummaryResponse>({
    queryKey: ["/api/demand-reports", reportId, "submitted-summary"],
    enabled: !!reportId,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/demand-reports/${reportId}/submitted-summary`);
      return response.json();
    },
  });

  const loadedReport = data?.report;
  const loadedFeedback = data?.decisionFeedback;
  const missingFields = useMemo(() => loadedFeedback?.missingFields || [], [loadedFeedback?.missingFields]);
  const requiredInfo = useMemo(() => loadedFeedback?.requiredInfo || [], [loadedFeedback?.requiredInfo]);
  const [correctionForm, setCorrectionForm] = useState<CorrectionForm>(() => buildInitialCorrectionForm(loadedReport));
  const [changeSummary, setChangeSummary] = useState("Updated the requested demand information and submitted it for review.");

  useEffect(() => {
    if (loadedReport) {
      setCorrectionForm(buildInitialCorrectionForm(loadedReport));
    }
  }, [loadedReport]);

  const correctionMutation = useMutation({
    mutationFn: async () => {
      if (!reportId) throw new Error("Missing demand report ID");
      const response = await apiRequest("POST", `/api/demand-reports/${reportId}/correction`, {
        updates: correctionForm,
        changeSummary,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || body.message || "Unable to submit correction");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/demand-reports", reportId, "submitted-summary"] });
      toast({
        title: "Updates submitted",
        description: "Your request has been updated and sent back for review.",
      });
    },
    onError: (err) => {
      toast({
        title: "Correction blocked",
        description: err instanceof Error ? err.message : "Unable to submit the correction.",
        variant: "destructive",
      });
    },
  });

  if (!reportId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">{t('demand.submitted.missingReportId')}</CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">{t('demand.submitted.loading')}</CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data?.success || !data.report) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">{t('demand.submitted.loadError')}</CardContent>
        </Card>
      </div>
    );
  }

  const report = data.report;
  const feedback = data.decisionFeedback;
  const status = report.workflowStatus || "generated";
  const displayStatus = resolveDemandDisplayWorkflowStatus(status, report.workflowHistory);
  const statusLabel = displayStatus.replace(/_/g, " ");
  const StatusIcon = statusIcons[status] || CircleDot;
  const correctionStatuses = new Set(["deferred", "rejected", "requires_more_info"]);
  const correctionAvailable = correctionStatuses.has(status);
  const hasResubmittedCorrection = Array.isArray(report.workflowHistory)
    && report.workflowHistory.some((item) => item.newStatus === "generated" && "correction" in item);
  const activeMissingFields = correctionAvailable ? missingFields : [];
  const activeRequiredInfo = correctionAvailable ? requiredInfo : [];
  const hasActionRequired = correctionAvailable;
  const actionItems = [
    ...(activeMissingFields.length > 0 ? [t('demand.submitted.continueHint')] : []),
    ...(status === "deferred" ? [t('demand.submitted.deferralHint')] : []),
    ...(status === "rejected" ? [t('demand.submitted.rejectionHint')] : []),
  ];
  const insightItems = [
    feedback?.advisorySummary,
    feedback?.approval?.approvalReason,
    feedback?.approval?.rejectionReason,
    feedback?.approval?.revisionNotes,
  ].filter(Boolean) as string[];
  const openFieldCount = correctionFields.filter((field) => isFieldOpen(field.key, activeMissingFields, activeRequiredInfo)).length;
  const requestedFieldsComplete = openFieldCount === 0 || correctionFields
    .filter((field) => isFieldOpen(field.key, activeMissingFields, activeRequiredInfo))
    .every((field) => String(correctionForm[field.key] || "").trim().length > 0);

  return (
    <div className="h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto flex h-full max-w-[1680px] flex-col gap-3 px-4 py-4">
        <div className="shrink-0 rounded-lg border border-slate-200/70 bg-white/95 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/90">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{t('demand.submitted.intelligentDemand')}</p>
                <Badge className={`${statusColors[displayStatus] || statusColors[status] || "bg-slate-100 text-slate-700"} capitalize`}>
                  <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
                  {statusLabel}
                </Badge>
              </div>
              <h1 className="mt-1 truncate text-2xl font-semibold text-slate-950 dark:text-white">
                {report.suggestedProjectName || report.businessObjective}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {report.organizationName} / {report.department} / Requested by {report.requestorName}
              </p>
            </div>
            <Link href="/demand-submitted">
              <Button variant="outline" size="sm" className="w-full gap-2 sm:w-auto">
                <ArrowLeft className="h-4 w-4" />
                {t('demand.submitted.backToRequests')}
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="min-h-0 border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/90">
            <CardContent className="flex h-full min-h-0 flex-col p-0">
              <div className="shrink-0 border-b border-slate-200/70 p-4 dark:border-slate-800/70">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="h-5 w-5 text-slate-500" />
                      {correctionAvailable ? "Update requested information" : "Request details"}
                    </CardTitle>
                    <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                      {correctionAvailable
                        ? "Review the request, complete the highlighted information, and submit it for review."
                        : hasResubmittedCorrection
                          ? "Your updates are back in the review queue and waiting for acknowledgement."
                          : "Your request is being tracked through the review workflow."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(activeMissingFields.length > 0 || activeRequiredInfo.length > 0) && (
                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
                        {openFieldCount || activeMissingFields.length || activeRequiredInfo.length} item{(openFieldCount || activeMissingFields.length || activeRequiredInfo.length) === 1 ? "" : "s"} need attention
                      </Badge>
                    )}
                    {typeof feedback?.completenessScore === "number" && (
                      <Badge variant="outline" className="border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200">
                        {Math.round(feedback.completenessScore)}% complete
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {correctionAvailable ? (
                  <div className="space-y-4">
                    {(activeMissingFields.length > 0 || activeRequiredInfo.length > 0) && (
                      <div className="grid gap-3 lg:grid-cols-2">
                        {activeMissingFields.length > 0 && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/25">
                            <div className="font-medium text-amber-900 dark:text-amber-100">Information to complete</div>
                            <div className="mt-1 text-amber-800 dark:text-amber-200">{activeMissingFields.join(", ")}</div>
                          </div>
                        )}
                        {activeRequiredInfo.length > 0 && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/25">
                            <div className="font-medium text-amber-900 dark:text-amber-100">Additional details requested</div>
                            <div className="mt-1 text-amber-800 dark:text-amber-200">{activeRequiredInfo.join(", ")}</div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid gap-3 lg:grid-cols-2">
                      {correctionFields.map((field) => {
                        const open = isFieldOpen(field.key, activeMissingFields, activeRequiredInfo);
                        const value = correctionForm[field.key];
                        return (
                          <label
                            key={field.key}
                            className={`space-y-1 rounded-lg border p-3 ${
                              open || field.important
                                ? "border-amber-300 bg-amber-50/60 dark:border-amber-900/70 dark:bg-amber-950/20"
                                : "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40"
                            }`}
                          >
                            <div className="flex min-h-6 items-center justify-between gap-2">
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{field.label}</span>
                              {open && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-100">Requested</Badge>}
                            </div>
                            {field.multiline ? (
                              <Textarea
                                value={value}
                                onChange={(event) => setCorrectionForm((current) => ({ ...current, [field.key]: event.target.value }))}
                                className="min-h-[84px] resize-none bg-white dark:bg-slate-950"
                              />
                            ) : (
                              <Input
                                value={value}
                                onChange={(event) => setCorrectionForm((current) => ({ ...current, [field.key]: event.target.value }))}
                                className="bg-white dark:bg-slate-950"
                              />
                            )}
                          </label>
                        );
                      })}
                    </div>

                    <label className="block space-y-1 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Update note</span>
                      <Textarea
                        value={changeSummary}
                        onChange={(event) => setChangeSummary(event.target.value)}
                        className="min-h-[72px] resize-none bg-white dark:bg-slate-950"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <InfoBlock label={t('demand.submitted.businessObjective')} value={report.businessObjective} />
                    <InfoBlock label={t('demand.submitted.urgency')} value={report.urgency} />
                    <InfoBlock label="Budget range" value={report.budgetRange || "-"} />
                    <InfoBlock label="Timeframe" value={report.timeframe || "-"} />
                    <InfoBlock label="Expected outcomes" value={report.expectedOutcomes || "-"} />
                    <InfoBlock label="Success criteria" value={report.successCriteria || "-"} />
                  </div>
                )}
              </div>

              {correctionAvailable && (
                <div className="shrink-0 border-t border-slate-200/70 bg-white p-4 dark:border-slate-800/70 dark:bg-slate-900">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      Your updates will be saved and returned to the review queue.
                    </p>
                    <Button
                      className="w-full gap-2 sm:w-auto"
                      disabled={correctionMutation.isPending || !requestedFieldsComplete}
                      onClick={() => correctionMutation.mutate()}
                    >
                      <RotateCcw className="h-4 w-4" />
                      {correctionMutation.isPending ? "Submitting updates..." : "Submit updates"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid min-h-0 gap-3 overflow-y-auto">
            <Card className="border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/90">
              <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1">
                <InfoBlock label={t('demand.submitted.organization')} value={report.organizationName} />
                <InfoBlock label={t('demand.submitted.department')} value={report.department} />
                <InfoBlock label={t('demand.submitted.submittedBy')} value={report.requestorName} />
                <InfoBlock label={t('demand.submitted.email')} value={report.requestorEmail} />
                <InfoBlock label={t('demand.submitted.submitted')} value={new Date(report.createdAt).toLocaleString()} />
                <InfoBlock label={t('demand.submitted.lastUpdated')} value={new Date(report.updatedAt).toLocaleString()} />
              </CardContent>
            </Card>

            <Card className="border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/90">
            <CardHeader className="p-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5" />
                {t('demand.submitted.feedbackComments')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0">
              {hasActionRequired && (
                <div className="rounded-xl border border-rose-200/60 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 p-4">
                  <div className="text-xs uppercase tracking-wide text-rose-500">{t('demand.submitted.actionRequired')}</div>
                  <ul className="mt-2 space-y-1 text-sm text-rose-700 dark:text-rose-200">
                    {actionItems.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rose-400"></span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 text-xs text-rose-600">{t('demand.submitted.updateRequestHint')}</div>
                </div>
              )}
              {report.decisionReason && (
                <div>
                  <div className="text-xs text-muted-foreground">{t('demand.submitted.decisionNotes')}</div>
                  <div className="font-medium">{report.decisionReason}</div>
                </div>
              )}
              {status === "rejected" && report.rejectionCategory && (
                <div>
                  <div className="text-xs text-muted-foreground">{t('demand.submitted.rejectionCategory')}</div>
                  <div className="font-medium">{report.rejectionCategory}</div>
                </div>
              )}
              {status === "deferred" && report.deferredUntil && (
                <div>
                  <div className="text-xs text-muted-foreground">{t('demand.submitted.deferredUntil')}</div>
                  <div className="font-medium">{new Date(report.deferredUntil).toLocaleDateString()}</div>
                </div>
              )}
              {correctionAvailable && feedback?.missingFields?.length ? (
                <div>
                  <div className="text-xs text-muted-foreground">{t('demand.submitted.missingInformation')}</div>
                  <div className="font-medium">{feedback.missingFields.join(", ")}</div>
                </div>
              ) : null}
              {feedback?.approval?.approvalReason && (
                <div>
                  <div className="text-xs text-muted-foreground">{t('demand.submitted.approvalReason')}</div>
                  <div className="font-medium">{feedback.approval.approvalReason}</div>
                </div>
              )}
              {feedback?.approval?.rejectionReason && (
                <div>
                  <div className="text-xs text-muted-foreground">{t('demand.submitted.rejectionReason')}</div>
                  <div className="font-medium">{feedback.approval.rejectionReason}</div>
                </div>
              )}
              {feedback?.approval?.revisionNotes && (
                <div>
                  <div className="text-xs text-muted-foreground">{t('demand.submitted.revisionNotes')}</div>
                  <div className="font-medium">{feedback.approval.revisionNotes}</div>
                </div>
              )}
              {feedback?.advisorySummary && (
                <div>
                  <div className="text-xs text-muted-foreground">{t('demand.submitted.advisorySummary')}</div>
                  <div className="font-medium">{feedback.advisorySummary}</div>
                </div>
              )}
              {!report.decisionReason && !feedback?.missingFields?.length && !feedback?.approval?.approvalReason && !feedback?.approval?.rejectionReason && !feedback?.approval?.revisionNotes && !feedback?.advisorySummary && (
                <div className="text-sm text-muted-foreground">{t('demand.submitted.noFeedback')}</div>
              )}
            </CardContent>
          </Card>

            <Card className="border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/90">
              <CardHeader className="p-4">
                <CardTitle className="text-lg">{t('demand.submitted.statusTimeline')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0">
                {Array.isArray(report.workflowHistory) && report.workflowHistory.length > 0 ? (
                  report.workflowHistory.map((item, index) => {
                    const timelineStatus = item.newStatus || item.status || "generated";
                    return (
                    <div key={`${timelineStatus}-${index}`} className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium">{timelineStatus.replace(/_/g, " ")}</div>
                        {item.reason && <div className="text-xs text-muted-foreground">{item.reason}</div>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                    </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-muted-foreground">{t('demand.submitted.noStatusUpdates')}</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/90">
              <CardHeader className="p-4">
                <CardTitle className="text-lg">{t('demand.submitted.innovativeFeedback')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0">
                {feedback?.policyVerdict && (
                  <div>
                    <div className="text-xs text-muted-foreground">{t('demand.submitted.policyVerdict')}</div>
                    <div className="font-medium">{String(feedback.policyVerdict).toUpperCase()}</div>
                  </div>
                )}
                {insightItems.length > 0 ? (
                  <ul className="space-y-2">
                    {insightItems.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">{t('demand.submitted.insightsPlaceholder')}</div>
                )}
              </CardContent>
            </Card>

            <div className="min-h-[520px]">
              <CoveriaAdvisor
                context="demand_submissions"
                mode="embedded"
                compact
                title="Corevia Assistant"
                subtitle="Live demand tracking assistant"
                chips={["What's missing?", "SLA status", "Draft field wording", "What should I do next?"]}
                className="h-[520px] rounded-lg"
                entityId={report.id}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200/70 bg-slate-50/70 p-3 dark:border-slate-800/70 dark:bg-slate-950/40">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}
