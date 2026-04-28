import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftRight,
  ArrowRight,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Layers,
  Lightbulb,
  Loader2,
  Play,
  Target,
  Users,
  XCircle,
} from "lucide-react";

type PMOChangeRequest = {
  id: string;
  projectId: string;
  projectName: string;
  code: string;
  title: string;
  description: string;
  changeType: string;
  impact: string;
  urgency: string;
  status: string;
  justification: string | null;
  requestedAt: string;
  requestedBy: string | null;
  estimatedScheduleImpact: number;
  estimatedCostImpact: number;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  affectedTasks: string[];
  originalValue: Record<string, unknown> | null;
  proposedValue: Record<string, unknown> | null;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalNotes: string | null;
  rejectionReason: string | null;
  implementedBy: string | null;
  implementedAt: string | null;
  implementationNotes: string | null;
  businessImpact: string | null;
  riskAssessment: string | null;
};

type CrProjectTask = {
  id: string;
  taskName: string;
  title?: string;
  wbsCode?: string;
  assignedTo?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  predecessors?: Array<string | { taskId?: string; taskCode?: string }>;
  taskType?: string;
  isMilestone?: boolean;
  priority?: string;
  parentTaskId?: string | null;
  status?: string;
  duration?: number;
};

type PMOChangeRequestDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedChangeRequest: PMOChangeRequest | null;
  crProjectTasks: CrProjectTask[];
  crReviewNotes: string;
  onCrReviewNotesChange: (value: string) => void;
  crImplementationNotes: string;
  onCrImplementationNotesChange: (value: string) => void;
  onApprove: () => void;
  onOpenReject: () => void;
  onImplement: () => void;
  approvePending: boolean;
  implementPending: boolean;
};

export default function PMOChangeRequestDetailSheet({
  open,
  onOpenChange,
  selectedChangeRequest,
  crProjectTasks: _crProjectTasks,
  crReviewNotes,
  onCrReviewNotesChange,
  crImplementationNotes,
  onCrImplementationNotesChange,
  onApprove,
  onOpenReject,
  onImplement,
  approvePending,
  implementPending,
}: PMOChangeRequestDetailSheetProps) {
  const { t } = useTranslation();

  if (!selectedChangeRequest) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-4xl" />
      </Sheet>
    );
  }

  const originalValue = selectedChangeRequest.originalValue;
  const proposedValue = selectedChangeRequest.proposedValue;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-4xl">
        <SheetHeader className="border-b border-border pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge variant="outline" className="mb-2 font-mono">
                {selectedChangeRequest.code}
              </Badge>
              <SheetTitle className="text-xl">{selectedChangeRequest.title}</SheetTitle>
              <SheetDescription className="mt-1 flex items-center gap-2 flex-wrap">
                <Badge
                  className={`text-xs ${
                    selectedChangeRequest.changeType === "timeline"
                      ? "bg-blue-500/20 text-blue-400"
                      : selectedChangeRequest.changeType === "scope"
                        ? "bg-purple-500/20 text-purple-400"
                        : selectedChangeRequest.changeType === "budget"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-muted text-muted-foreground"
                  }`}
                >
                  {selectedChangeRequest.changeType}
                </Badge>
                <Badge
                  className={`text-xs ${
                    selectedChangeRequest.impact === "critical"
                      ? "bg-red-500/20 text-red-400"
                      : selectedChangeRequest.impact === "high"
                        ? "bg-orange-500/20 text-orange-400"
                        : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {selectedChangeRequest.impact} impact
                </Badge>
                <Badge
                  className={`text-xs ${
                    selectedChangeRequest.urgency === "critical"
                      ? "bg-red-500/20 text-red-400"
                      : selectedChangeRequest.urgency === "high"
                        ? "bg-orange-500/20 text-orange-400"
                        : selectedChangeRequest.urgency === "normal"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-muted text-muted-foreground"
                  }`}
                >
                  {selectedChangeRequest.urgency} urgency
                </Badge>
                <span className="text-xs">•</span>
                <span className="text-xs">{selectedChangeRequest.projectName}</span>
              </SheetDescription>
            </div>
            <Badge
              className={`shrink-0 px-3 py-1 text-sm ${
                selectedChangeRequest.status === "approved"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : selectedChangeRequest.status === "rejected"
                    ? "bg-red-500/20 text-red-400"
                    : selectedChangeRequest.status === "implemented"
                      ? "bg-blue-500/20 text-blue-400"
                      : selectedChangeRequest.status === "under_review" || selectedChangeRequest.status === "submitted"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-muted text-muted-foreground"
              }`}
            >
              {selectedChangeRequest.status.replace(/_/g, " ")}
            </Badge>
          </div>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="rounded-xl border-2 border-violet-500/30 bg-gradient-to-br from-slate-900/50 via-blue-900/20 to-violet-900/20 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                <ClipboardCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold">{t("pmo.office.executiveSummary")}</h3>
                <p className="text-xs text-muted-foreground">{t("pmo.office.executiveSummaryDesc")}</p>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg bg-background/50 p-3">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{t("pmo.office.requestedBy")}</div>
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Users className="h-3.5 w-3.5 text-blue-400" />
                  {selectedChangeRequest.requestedBy || "Unknown"}
                </div>
              </div>
              <div className="rounded-lg bg-background/50 p-3">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{t("pmo.office.requestDate")}</div>
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Calendar className="h-3.5 w-3.5 text-blue-400" />
                  {new Date(selectedChangeRequest.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <div className="rounded-lg bg-background/50 p-3">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{t("pmo.office.affectedTasks")}</div>
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Layers className="h-3.5 w-3.5 text-amber-400" />
                  {selectedChangeRequest.affectedTasks?.length || 0} tasks
                </div>
              </div>
              <div className="rounded-lg bg-background/50 p-3">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{t("pmo.office.scheduleImpact")}</div>
                <div
                  className={`flex items-center gap-1.5 text-sm font-bold ${
                    selectedChangeRequest.estimatedScheduleImpact > 0
                      ? "text-red-400"
                      : selectedChangeRequest.estimatedScheduleImpact < 0
                        ? "text-emerald-400"
                        : ""
                  }`}
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  {selectedChangeRequest.estimatedScheduleImpact
                    ? `${selectedChangeRequest.estimatedScheduleImpact > 0 ? "+" : ""}${selectedChangeRequest.estimatedScheduleImpact} ${t("pmo.office.days")}`
                    : t("pmo.office.noChange")}
                </div>
              </div>
            </div>

            {(() => {
              const taskCount = selectedChangeRequest.affectedTasks?.length || 0;
              const scheduleImpact = Math.abs(selectedChangeRequest.estimatedScheduleImpact || 0);
              const impactLevel = selectedChangeRequest.impact;
              const urgencyLevel = selectedChangeRequest.urgency;

              let score = 0;
              if (impactLevel === "critical") score += 40;
              else if (impactLevel === "high") score += 25;
              else if (impactLevel === "medium") score += 15;
              else score += 5;

              if (urgencyLevel === "critical") score += 25;
              else if (urgencyLevel === "high") score += 15;
              else if (urgencyLevel === "normal") score += 8;
              else score += 3;

              score += Math.min(taskCount * 3, 20);
              score += Math.min(scheduleImpact * 2, 15);

              const riskLevel = score >= 70 ? "Critical" : score >= 50 ? "High" : score >= 30 ? "Moderate" : "Low";
              const riskColor = score >= 70 ? "red" : score >= 50 ? "orange" : score >= 30 ? "amber" : "emerald";

              return (
                <div className="rounded-lg border border-border/50 bg-background/30 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{t("pmo.office.overallProjectImpact")}</span>
                    <Badge
                      className={`text-xs ${
                        riskColor === "red"
                          ? "bg-red-500/20 text-red-400"
                          : riskColor === "orange"
                            ? "bg-orange-500/20 text-orange-400"
                            : riskColor === "amber"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-emerald-500/20 text-emerald-400"
                      }`}
                    >
                      {riskLevel} Risk
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted/50">
                      <div
                        className={`h-full rounded-full ${
                          riskColor === "red"
                            ? "bg-red-500"
                            : riskColor === "orange"
                              ? "bg-orange-500"
                              : riskColor === "amber"
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(score, 100)}%` }}
                      />
                    </div>
                    <span
                      className={`text-lg font-bold ${
                        riskColor === "red"
                          ? "text-red-400"
                          : riskColor === "orange"
                            ? "text-orange-400"
                            : riskColor === "amber"
                              ? "text-amber-400"
                              : "text-emerald-400"
                      }`}
                    >
                      {score}/100
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">{t("pmo.office.impactScoreBasis")}</p>
                </div>
              );
            })()}
          </div>

          {(originalValue || proposedValue) && (
            <div className="rounded-xl border-2 border-blue-500/30 bg-blue-500/5 p-4">
              <div className="mb-4 flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-blue-400" />
                <span className="font-semibold">{t("pmo.office.originalVsProposed")}</span>
              </div>
              <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-4">
                <div className="rounded-lg bg-background/60 p-4">
                  <div className="mb-2 flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                    <Clock className="h-3 w-3" /> {t("pmo.office.original")}
                  </div>
                  {!!originalValue?.endDate && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">{t("pmo.office.endDate")}:</span>
                      <span className="ml-2 font-semibold">{new Date(String(originalValue.endDate)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  )}
                  {!!originalValue?.startDate && (
                    <div className="mt-1 text-sm">
                      <span className="text-muted-foreground">{t("pmo.office.startDate")}:</span>
                      <span className="ml-2 font-semibold">{new Date(String(originalValue.startDate)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  )}
                  {!!originalValue?.budget && (
                    <div className="mt-1 text-sm">
                      <span className="text-muted-foreground">{t("pmo.office.budgetLabel")}:</span>
                      <span className="ml-2 font-semibold">${Number(originalValue.budget).toLocaleString()}</span>
                    </div>
                  )}
                  {!!originalValue?.scope && (
                    <div className="mt-1 text-sm">
                      <span className="text-muted-foreground">{t("pmo.office.scopeLabel")}:</span>
                      <span className="ml-2">{String(originalValue.scope)}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full ${
                      selectedChangeRequest.estimatedScheduleImpact > 0
                        ? "bg-red-500/20"
                        : selectedChangeRequest.estimatedScheduleImpact < 0
                          ? "bg-emerald-500/20"
                          : "bg-muted/50"
                    }`}
                  >
                    <ArrowRight
                      className={`h-6 w-6 ${
                        selectedChangeRequest.estimatedScheduleImpact > 0
                          ? "text-red-400"
                          : selectedChangeRequest.estimatedScheduleImpact < 0
                            ? "text-emerald-400"
                            : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  {selectedChangeRequest.estimatedScheduleImpact !== 0 && (
                    <span className={`mt-1 text-xs font-bold ${selectedChangeRequest.estimatedScheduleImpact > 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {selectedChangeRequest.estimatedScheduleImpact > 0 ? "+" : ""}
                      {selectedChangeRequest.estimatedScheduleImpact}d
                    </span>
                  )}
                </div>

                <div
                  className={`rounded-lg p-4 ${
                    selectedChangeRequest.estimatedScheduleImpact > 0
                      ? "border border-red-500/30 bg-red-500/10"
                      : selectedChangeRequest.estimatedScheduleImpact < 0
                        ? "border border-emerald-500/30 bg-emerald-500/10"
                        : "bg-background/60"
                  }`}
                >
                  <div
                    className={`mb-2 flex items-center gap-1 text-xs uppercase tracking-wide ${
                      selectedChangeRequest.estimatedScheduleImpact > 0
                        ? "text-red-400"
                        : selectedChangeRequest.estimatedScheduleImpact < 0
                          ? "text-emerald-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    <Target className="h-3 w-3" /> {t("pmo.office.proposed")}
                  </div>
                  {!!proposedValue?.endDate && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">{t("pmo.office.endDate")}:</span>
                      <span className={`ml-2 font-bold ${selectedChangeRequest.estimatedScheduleImpact > 0 ? "text-red-400" : selectedChangeRequest.estimatedScheduleImpact < 0 ? "text-emerald-400" : ""}`}>
                        {new Date(String(proposedValue.endDate)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  )}
                  {!!proposedValue?.startDate && (
                    <div className="mt-1 text-sm">
                      <span className="text-muted-foreground">{t("pmo.office.startDate")}:</span>
                      <span className="ml-2 font-semibold">{new Date(String(proposedValue.startDate)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  )}
                  {!!proposedValue?.budget && (
                    <div className="mt-1 text-sm">
                      <span className="text-muted-foreground">{t("pmo.office.budgetLabel")}:</span>
                      <span className="ml-2 font-semibold">${Number(proposedValue.budget).toLocaleString()}</span>
                    </div>
                  )}
                  {!!proposedValue?.scope && (
                    <div className="mt-1 text-sm">
                      <span className="text-muted-foreground">{t("pmo.office.scopeLabel")}:</span>
                      <span className="ml-2">{String(proposedValue.scope)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {t("pmo.office.description")}
              </div>
              <p className="text-sm text-muted-foreground">{selectedChangeRequest.description}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Lightbulb className="h-4 w-4 text-amber-400" />
                {t("pmo.office.businessJustification")}
              </div>
              <p className="text-sm text-muted-foreground">{selectedChangeRequest.justification}</p>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">{t("pmo.office.requestedOn")} {new Date(selectedChangeRequest.requestedAt).toLocaleString()}</div>

          <div className="space-y-3 border-t border-border pt-4">
            <div className="text-sm font-medium">{t("pmo.office.actions")}</div>

            {(selectedChangeRequest.status === "submitted" || selectedChangeRequest.status === "under_review") && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="sheetCrReviewNotes">{t("pmo.office.reviewNotesOptional")}</Label>
                  <Textarea
                    id="sheetCrReviewNotes"
                    value={crReviewNotes}
                    onChange={(event) => onCrReviewNotesChange(event.target.value)}
                    placeholder={t("pmo.office.approvalNotesPlaceholder")}
                    className="h-20"
                  />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={onApprove} disabled={approvePending}>
                    {approvePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    {t("pmo.office.approve")}
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={onOpenReject}>
                    <XCircle className="mr-2 h-4 w-4" />
                    {t("pmo.office.reject")}
                  </Button>
                </div>
              </div>
            )}

            {selectedChangeRequest.status === "approved" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="sheetCrImplNotes">{t("pmo.office.implementationNotesOptional")}</Label>
                  <Textarea
                    id="sheetCrImplNotes"
                    value={crImplementationNotes}
                    onChange={(event) => onCrImplementationNotesChange(event.target.value)}
                    placeholder={t("pmo.office.implementationNotesPlaceholder")}
                    className="h-20"
                  />
                </div>
                <Button className="w-full" onClick={onImplement} disabled={implementPending}>
                  {implementPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  {t("pmo.office.implementChanges")}
                </Button>
              </div>
            )}

            {selectedChangeRequest.status === "implemented" && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="flex items-center gap-2 text-emerald-500">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">{t("pmo.office.changeImplemented")}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t("pmo.office.changeImplementedDesc")}</p>
              </div>
            )}

            {selectedChangeRequest.status === "rejected" && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <div className="flex items-center gap-2 text-red-500">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">{t("pmo.office.changeRejected")}</span>
                </div>
                {selectedChangeRequest.rejectionReason && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium">{t("pmo.office.reason")}:</span> {selectedChangeRequest.rejectionReason}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}