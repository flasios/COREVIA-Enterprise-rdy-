import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ChevronRight,
  Clock3,
  FileText,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import CoveriaAdvisor from "@/modules/advisor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { resolveDemandDisplayWorkflowStatus } from "./demandAnalysisReport.utils";

type DemandReportListItem = {
  id: string;
  organizationName: string;
  department: string;
  requestorName: string;
  urgency: string;
  businessObjective: string;
  workflowStatus: string;
  workflowHistory?: Array<{ newStatus?: string | null; reason?: string | null; correction?: unknown }> | null;
  createdAt: string;
  suggestedProjectName?: string | null;
  decisionReason?: string | null;
  rejectionCategory?: string | null;
  deferredUntil?: string | null;
  decisionStatus?: string | null;
  requirementsVersionStatus?: string | null;
  businessCaseVersionStatus?: string | null;
  enterpriseArchitectureVersionStatus?: string | null;
  strategicFitVersionStatus?: string | null;
  dataClassification?: string | null;
};

type DemandReportListResponse = {
  success: boolean;
  data: DemandReportListItem[];
  count: number;
  error?: string;
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
  requires_more_info: "bg-amber-100 text-amber-700",
};

function statusLabel(status?: string | null) {
  return (status || "generated").replace(/_/g, " ");
}

function lifecycleStatus(status?: string | null) {
  switch (status) {
    case "published":
      return { label: "Published", className: "border-emerald-500 text-emerald-600" };
    case "approved":
      return { label: "Approved", className: "border-blue-500 text-blue-600" };
    case "manager_approval":
      return { label: "Pending", className: "border-amber-500 text-amber-600" };
    case "under_review":
      return { label: "Review", className: "border-purple-500 text-purple-600" };
    case "draft":
      return { label: "Draft", className: "border-slate-400 text-slate-500" };
    case "needs_info":
      return { label: "Needs Info", className: "border-amber-500 text-amber-600" };
    case "not_generated":
    default:
      return { label: "Not Started", className: "border-slate-300 text-slate-400" };
  }
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
}

function getDecisionNote(report?: DemandReportListItem | null) {
  if (!report) return "";
  return report.decisionReason || report.rejectionCategory || "";
}

function isNeedsAttention(report: DemandReportListItem) {
  return ["deferred", "rejected", "requires_more_info"].includes(report.workflowStatus || "");
}

export default function DemandSubmittedList() {
  const { t } = useTranslation();
  const queryKey = ["/api/demand-reports", "mine", "submitted"];

  const { data, isLoading, error } = useQuery<DemandReportListResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        mine: "true",
        page: "1",
        pageSize: "50",
        fields: "id,organizationName,department,requestorName,urgency,businessObjective,workflowStatus,workflowHistory,createdAt,suggestedProjectName,decisionReason,rejectionCategory,deferredUntil,decisionStatus,requirementsVersionStatus,businessCaseVersionStatus,enterpriseArchitectureVersionStatus,strategicFitVersionStatus,dataClassification",
        includeRequirementsStatus: "true",
        includeBusinessCaseStatus: "true",
        includeEnterpriseArchitectureStatus: "true",
        includeStrategicFitStatus: "true",
      });
      const response = await apiRequest("GET", `/api/demand-reports?${params.toString()}`);
      return response.json();
    },
  });

  const reports = useMemo(() => (data?.success ? data.data : []), [data]);
  const summary = useMemo(() => {
    const countBy = (status: string) => reports.filter((item) => item.workflowStatus === status).length;
    return {
      total: reports.length,
      active: reports.filter((item) => !isNeedsAttention(item)).length,
      inReview: countBy("under_review") + countBy("meeting_scheduled"),
      pendingApproval: countBy("initially_approved") + countBy("manager_approved"),
      needsAttention: countBy("rejected") + countBy("deferred") + countBy("requires_more_info"),
    };
  }, [reports]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (reports.length > 0 && !selectedId) {
      setSelectedId(reports[0]!.id);
    }
  }, [reports, selectedId]);

  const selectedReport = reports.find((item) => item.id === selectedId) || reports[0];
  const selectedNote = getDecisionNote(selectedReport);
  const selectedDeferredUntil = formatDate(selectedReport?.deferredUntil);
  const selectedNeedsAttention = selectedReport ? isNeedsAttention(selectedReport) : false;

  return (
    <div className="h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-3 px-4 py-4">
        <div className="flex shrink-0 flex-col gap-3 rounded-lg border border-slate-200/70 bg-white/90 p-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/80">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("demand.submitted.intelligentDemand")}</p>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t("demand.submitted.myRequests")}</h1>
              <p className="text-xs text-muted-foreground">{t("demand.submitted.myRequestsSubtitle")}</p>
            </div>
            <Link href="/intelligent-gateway">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t("demand.submitted.backToGateway")}
              </Button>
            </Link>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label={t("demand.submitted.totalSubmissions")} value={summary.total} icon={Sparkles} />
            <Metric label="Active workflow" value={summary.active} icon={Activity} tone="slate" />
            <Metric label={t("demand.submitted.inReview")} value={summary.inReview} icon={Clock3} tone="amber" />
            <Metric label={t("demand.submitted.pendingApproval")} value={summary.pendingApproval} icon={ShieldCheck} tone="emerald" />
            <Metric label={t("demand.submitted.needsAttention")} value={summary.needsAttention} icon={AlertTriangle} tone="rose" />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(380px,520px)_minmax(420px,1fr)_340px]">
          <Card className="min-h-0 border-slate-200/70 bg-white/90 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/80">
            <CardContent className="flex h-full min-h-0 flex-col p-0">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200/70 p-3 dark:border-slate-800/70">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="h-4 w-4" />
                  {t("demand.submitted.submittedDemands")}
                </div>
                {data?.success && <Badge variant="secondary" className="text-xs">{data.count} {t("demand.submitted.total")}</Badge>}
              </div>

              <div className="min-h-0 flex-1 p-3">
                {isLoading && <div className="text-sm text-muted-foreground">{t("demand.submitted.loadingSubmissions")}</div>}
                {error && <div className="text-sm text-rose-600">{t("demand.submitted.loadSubmissionsError")}</div>}
                {!isLoading && data?.success && reports.length === 0 && (
                  <div className="text-sm text-muted-foreground">{t("demand.submitted.noSubmissions")}</div>
                )}

                {data?.success && (
                  <ScrollArea className="h-full pr-2">
                    <div className="grid gap-2 pb-2">
                      {reports.map((report) => {
                        const workflowStatus = report.workflowStatus || "generated";
                        const displayWorkflowStatus = resolveDemandDisplayWorkflowStatus(workflowStatus, report.workflowHistory);
                        const note = getDecisionNote(report);
                        const attention = isNeedsAttention(report);
                        return (
                          <button
                            key={report.id}
                            type="button"
                            className={`rounded-lg border p-3 text-left transition hover:border-primary/50 hover:bg-primary/5 ${
                              selectedReport?.id === report.id
                                ? "border-primary/50 bg-primary/5"
                                : attention
                                  ? "border-orange-200/80 bg-orange-50/70 dark:border-orange-900/50 dark:bg-orange-950/20"
                                  : "border-slate-200/70 bg-white dark:border-slate-800/70 dark:bg-slate-950/40"
                            }`}
                            onClick={() => setSelectedId(report.id)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">
                                  {report.suggestedProjectName || report.businessObjective}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {report.organizationName} / {report.department}
                                </div>
                              </div>
                              <Badge className={`${statusColors[displayWorkflowStatus] || statusColors[workflowStatus] || statusColors.generated} shrink-0 capitalize`}>
                                {statusLabel(displayWorkflowStatus)}
                              </Badge>
                            </div>

                            <div className="mt-3 grid grid-cols-5 gap-1 text-[10px]">
                              {[
                                ["Decision", report.decisionStatus],
                                ["BC", report.businessCaseVersionStatus],
                                ["Req", report.requirementsVersionStatus],
                                ["EA", report.enterpriseArchitectureVersionStatus],
                                ["Fit", report.strategicFitVersionStatus],
                              ].map(([label, value]) => {
                                const display = lifecycleStatus(String(value || "not_generated"));
                                return (
                                  <div key={label} className="min-w-0">
                                    <div className="truncate text-muted-foreground">{label}</div>
                                    <Badge variant="outline" className={`mt-1 w-full justify-center truncate px-1 text-[10px] ${display.className}`}>
                                      {display.label}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              {t("demand.submitted.submittedOn")} {formatDate(report.createdAt)} / {t("demand.submitted.urgency")} {report.urgency}
                            </div>

                            {note && (
                              <div className="mt-2 rounded-md border border-slate-200/70 bg-white/70 p-2 text-xs text-slate-700 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-200">
                                <span className="font-medium">{workflowStatus === "deferred" ? "Deferral note" : "Decision note"}:</span> {note}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-0 border-slate-200/70 bg-white/90 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/80">
            <CardContent className="flex h-full min-h-0 flex-col gap-4 p-4">
              {selectedReport ? (
                <>
                  <div className="shrink-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={`${statusColors[resolveDemandDisplayWorkflowStatus(selectedReport.workflowStatus, selectedReport.workflowHistory)] || statusColors.generated} capitalize`}>
                        {statusLabel(resolveDemandDisplayWorkflowStatus(selectedReport.workflowStatus, selectedReport.workflowHistory))}
                      </Badge>
                      {selectedReport.workflowStatus === "deferred" && (
                        <Badge variant="outline" className="border-orange-300 text-orange-700 dark:text-orange-300">
                          Paused by workflow
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-xl font-semibold leading-tight text-slate-900 dark:text-white">
                      {selectedReport.suggestedProjectName || selectedReport.businessObjective}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedReport.organizationName} / {selectedReport.department} / Requested by {selectedReport.requestorName}
                    </p>
                  </div>

                  <div className="grid shrink-0 gap-2 sm:grid-cols-3">
                    <InfoTile label="Submitted" value={formatDate(selectedReport.createdAt) || "-"} />
                    <InfoTile label="Urgency" value={selectedReport.urgency || "-"} />
                    <InfoTile label="Restart" value={selectedDeferredUntil || (selectedReport.workflowStatus === "deferred" ? "Available now" : "Not required")} />
                  </div>

                  <div className="grid shrink-0 gap-2 sm:grid-cols-5">
                    <InfoTile label="Business Case" value={lifecycleStatus(selectedReport.businessCaseVersionStatus).label} />
                    <InfoTile label="Requirements" value={lifecycleStatus(selectedReport.requirementsVersionStatus).label} />
                    <InfoTile label="EA" value={lifecycleStatus(selectedReport.enterpriseArchitectureVersionStatus).label} />
                    <InfoTile label="Strategic Fit" value={lifecycleStatus(selectedReport.strategicFitVersionStatus).label} />
                    <InfoTile label="Classification" value={selectedReport.dataClassification || "internal"} />
                  </div>

                  <div className="min-h-0 flex-1 rounded-lg border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800/70 dark:bg-slate-950/40">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <MessageSquareText className="h-4 w-4" />
                      Workflow notes and next action
                    </div>

                    <ScrollArea className="h-full pr-2">
                      <div className="space-y-4 pb-2">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Decision note</div>
                          <p className="mt-1 text-sm leading-6 text-slate-800 dark:text-slate-100">
                            {selectedNote || "No decision notes were recorded for this request yet."}
                          </p>
                        </div>

                        {selectedReport.workflowStatus === "deferred" && (
                          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200">
                            <div className="font-medium">This request is deferred, not rejected.</div>
                            <p className="mt-1">
                              {selectedDeferredUntil
                                ? `Please review the requested information. Follow-up is expected after ${selectedDeferredUntil}.`
                                : "Please open the request, complete the requested information, and submit the updates for review."}
                            </p>
                          </div>
                        )}

                        {selectedReport.workflowStatus === "rejected" && (
                          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
                            <div className="font-medium">This request was rejected.</div>
                            <p className="mt-1">Review the decision note, update the demand, and submit a corrected request path.</p>
                          </div>
                        )}

                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Business objective</div>
                          <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">{selectedReport.businessObjective}</p>
                        </div>
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button asChild size="sm" className="gap-1">
                      <Link href={`/demand-submitted/${selectedReport.id}`}>
                        {selectedNeedsAttention ? "Review and update" : t("demand.submitted.view")}
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Select a submitted demand to review its notes and workflow actions.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="hidden min-h-0 xl:block">
            <CoveriaAdvisor
              context="demand_submissions"
              mode="embedded"
              compact
              title={t("demand.submitted.coreviaAssistant")}
              subtitle={t("demand.submitted.assistantSubtitle")}
              chips={["What's missing?", "SLA status", "Next action", "Draft update note"]}
              className="h-full"
              entityId={selectedReport?.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone = "slate",
}: Readonly<{ label: string; value: number; icon: typeof Sparkles; tone?: "slate" | "amber" | "emerald" | "rose" }>) {
  const toneClass = {
    slate: "bg-slate-900/5 text-slate-600 dark:bg-white/10 dark:text-slate-300",
    amber: "bg-amber-500/10 text-amber-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    rose: "bg-rose-500/10 text-rose-600",
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200/60 bg-slate-50/80 p-3 dark:border-slate-800/60 dark:bg-slate-950/40">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold text-slate-900 dark:text-white">{value}</div>
        </div>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-lg border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800/70 dark:bg-slate-950/40">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}
