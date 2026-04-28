import { useState, useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  BarChart3 as _BarChart3,
  CheckCircle2,
  ClipboardList,
  Gauge,
  Inbox,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  AlertTriangle,
  XCircle,
} from "lucide-react";

type PipelineItem = {
  id: string;
  projectId: string | null;
  suggestedProjectName: string | null;
  organizationName: string;
  businessObjective: string;
  urgency: string;
  budgetRange: string;
  workflowStatus: string;
  createdAt: string;
  hasPortfolioProject: boolean;
  strategicAlignment: number;
  complexityRisk: number;
  estimatedBudget: string;
  department: string;
  expectedTimeline: string;
  requirementsVersionStatus: string;
};

type PipelineResponse = {
  success: boolean;
  data: PipelineItem[];
};

const weekLabels = ["W-5", "W-4", "W-3", "W-2", "W-1", "This wk"];

type MutationError = { message?: string };

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function extractBudgetValue(budgetText: string | null | undefined): string {
  if (!budgetText) return "";
  const trimmedBudgetText = budgetText.trim();
  if (trimmedBudgetText === "0" || trimmedBudgetText === "0.0" || trimmedBudgetText === "0.00") return "";

  const rangePattern = /AED\s*[\d.,]+[KMB]?\s*[–-]\s*[\d.,]+[KMB]?/i;
  const singlePattern = /AED\s*[\d.,]+[KMB]?/i;
  const rangeMatch = trimmedBudgetText.match(rangePattern);
  if (rangeMatch) return rangeMatch[0].trim();
  const singleMatch = trimmedBudgetText.match(singlePattern);
  if (singleMatch) return singleMatch[0].trim();
  return trimmedBudgetText;
}

function deriveEndDate(startDateValue: string, expectedTimeline: string | null | undefined): string {
  if (!startDateValue) return "";
  const startDate = new Date(startDateValue);
  if (Number.isNaN(startDate.getTime())) return "";
  if (!expectedTimeline) return "";

  const normalized = expectedTimeline.toLowerCase();
  const numericParts = Array.from(normalized.matchAll(/\d+/g)).map((match) => Number(match[0]));
  const amount = numericParts.length > 0 ? Math.max(...numericParts) : 0;
  if (!Number.isFinite(amount) || amount <= 0) return "";

  const endDate = new Date(startDate);
  if (normalized.includes("year")) {
    endDate.setFullYear(endDate.getFullYear() + amount);
  } else if (normalized.includes("month")) {
    endDate.setMonth(endDate.getMonth() + amount);
  } else if (normalized.includes("week")) {
    endDate.setDate(endDate.getDate() + (amount * 7));
  } else if (normalized.includes("day")) {
    endDate.setDate(endDate.getDate() + amount);
  } else {
    return "";
  }

  return endDate.toISOString().slice(0, 10);
}

export default function DemandIntakePipeline() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: pipelineData, isLoading } = useQuery<PipelineResponse>({
    queryKey: ["/api/portfolio/pipeline"],
  });

  // --- State for approve/convert/reject dialogs ---
  const [selectedDemand, setSelectedDemand] = useState<PipelineItem | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [proposedBudget, setProposedBudget] = useState("");
  const [proposedStartDate, setProposedStartDate] = useState("");
  const [proposedEndDate, setProposedEndDate] = useState("");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  // --- Mutations ---
  const convertMutation = useMutation({
    mutationFn: async (payload: {
      demandId: string;
      projectName: string;
      projectDescription: string;
      priority: string;
      proposedBudget?: string;
      proposedStartDate?: string;
      proposedEndDate?: string;
    }) => {
      const response = await apiRequest("POST", "/api/demand-conversion-requests", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demand-conversion-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/pipeline"] });
      setConvertDialogOpen(false);
      setSelectedDemand(null);
      setProjectName("");
      setProjectDescription("");
      setPriority("medium");
      setProposedBudget("");
      setProposedStartDate("");
      setProposedEndDate("");
      toast({ title: t('demand.pipeline.conversionRequested'), description: t('demand.pipeline.conversionRequestedDesc') });
    },
    onError: (error: MutationError) => {
      toast({ title: t('app.error'), description: error.message || t('demand.pipeline.failedConversion'), variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const response = await apiRequest("PUT", `/api/demand-conversion-requests/${id}/approve`, { decisionNotes: notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demand-conversion-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/pipeline"] });
      setApproveDialogOpen(false);
      setSelectedDemand(null);
      setDecisionNotes("");
      toast({ title: t('demand.pipeline.requestApproved'), description: t('demand.pipeline.requestApprovedDesc') });
    },
    onError: (error: MutationError) => {
      toast({ title: t('app.error'), description: error.message || t('demand.pipeline.failedApprove'), variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason, notes }: { id: string; reason: string; notes: string }) => {
      const response = await apiRequest("PUT", `/api/demand-conversion-requests/${id}/reject`, {
        rejectionReason: reason,
        decisionNotes: notes,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demand-conversion-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/pipeline"] });
      setRejectDialogOpen(false);
      setSelectedDemand(null);
      setRejectionReason("");
      setDecisionNotes("");
      toast({ title: t('demand.pipeline.requestRejectedDesc'), description: t('demand.pipeline.requestRejectedDesc') });
    },
    onError: (error: MutationError) => {
      toast({ title: t('app.error'), description: error.message || t('demand.pipeline.failedReject'), variant: "destructive" });
    },
  });

  // --- Helpers ---
  const openConvertDialog = (item: PipelineItem) => {
    const defaultStartDate = toDateInputValue(item.createdAt) || toDateInputValue(new Date().toISOString());
    setSelectedDemand(item);
    setProjectName(item.suggestedProjectName || item.businessObjective || "");
    setProjectDescription(item.businessObjective || "");
    setPriority(item.urgency?.toLowerCase() === "high" ? "high" : item.urgency?.toLowerCase() === "low" ? "low" : "medium");
    setProposedBudget(extractBudgetValue(item.estimatedBudget || item.budgetRange));
    setProposedStartDate(defaultStartDate);
    setProposedEndDate(deriveEndDate(defaultStartDate, item.expectedTimeline));
    setConvertDialogOpen(true);
  };

  const openApproveDialog = (item: PipelineItem) => {
    setSelectedDemand(item);
    setDecisionNotes("");
    setApproveDialogOpen(true);
  };

  const openRejectDialog = (item: PipelineItem) => {
    setSelectedDemand(item);
    setRejectionReason("");
    setDecisionNotes("");
    setRejectDialogOpen(true);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pipelineItems = pipelineData?.data || [];
  const latestItems = useMemo(() => {
    return [...pipelineItems]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [pipelineItems]);

  const {
    totalDemands,
    avgAlignment,
    avgRisk,
    highUrgency,
    medUrgency,
    lowUrgency,
    weeklyCounts,
    matrixBuckets,
  } = useMemo(() => {
    const total = pipelineItems.length || 0;
    const alignmentSum = pipelineItems.reduce((sum, item) => sum + (item.strategicAlignment || 0), 0);
    const riskSum = pipelineItems.reduce((sum, item) => sum + (item.complexityRisk || 0), 0);
    const avgAlign = total > 0 ? Math.round(alignmentSum / total) : 0;
    const avgRiskScore = total > 0 ? Math.round(riskSum / total) : 0;

    const urgencyCounts = {
      high: pipelineItems.filter((item) => item.urgency?.toLowerCase() === "high").length,
      medium: pipelineItems.filter((item) => item.urgency?.toLowerCase() === "medium").length,
      low: pipelineItems.filter((item) => item.urgency?.toLowerCase() === "low").length,
    };

    const now = Date.now();
    const buckets = Array.from({ length: 6 }, () => 0);
    pipelineItems.forEach((item) => {
      const created = new Date(item.createdAt).getTime();
      if (Number.isNaN(created)) return;
      const daysAgo = Math.floor((now - created) / (1000 * 60 * 60 * 24));
      const bucketIndex = Math.floor(daysAgo / 7);
      if (bucketIndex >= 0 && bucketIndex < 6) {
        buckets[5 - bucketIndex]! += 1;
      }
    });

    const matrix = {
      fastTrack: [] as PipelineItem[],
      planCarefully: [] as PipelineItem[],
      quickWins: [] as PipelineItem[],
      reconsider: [] as PipelineItem[],
    };

    pipelineItems.forEach((item) => {
      const align = item.strategicAlignment || 0;
      const risk = item.complexityRisk || 0;
      const highAlign = align >= 50;
      const highRisk = risk >= 50;

      if (highAlign && !highRisk) matrix.fastTrack.push(item);
      else if (highAlign && highRisk) matrix.planCarefully.push(item);
      else if (!highAlign && !highRisk) matrix.quickWins.push(item);
      else matrix.reconsider.push(item);
    });

    return {
      totalDemands: total,
      avgAlignment: avgAlign,
      avgRisk: avgRiskScore,
      highUrgency: urgencyCounts.high,
      medUrgency: urgencyCounts.medium,
      lowUrgency: urgencyCounts.low,
      weeklyCounts: buckets,
      matrixBuckets: matrix,
    };
  }, [pipelineItems]);

  const maxWeekly = Math.max(...weeklyCounts, 1);
  const urgencyTotal = Math.max(highUrgency + medUrgency + lowUrgency, 1);

  return (
    <div className="min-h-screen bg-background" data-testid="page-demand-intake">
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/pmo-office">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t('nav.pmoOffice')}
              </Button>
            </Link>
            <div>
              <div className="text-sm font-semibold" data-testid="text-demand-intake-title">{t('demand.pipeline.title')}</div>
              <div className="text-xs text-muted-foreground">{t('demand.pipeline.subtitle')}</div>
            </div>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
            <Sparkles className="h-3 w-3 mr-1" />
            {t('demand.pipeline.livePipeline')}
          </Badge>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card className="border-amber-200/40 bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-amber-600" />
                {t('demand.pipeline.intakeOverview')}
              </CardTitle>
              <CardDescription>{t('demand.pipeline.intakeOverviewDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('demand.pipeline.pipelineLabel')}</div>
                  <div className="text-xl font-semibold text-slate-900">{totalDemands.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{t('demand.pipeline.activeDemands')}</div>
                </div>
                <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('demand.pipeline.avgAlignment')}</div>
                  <div className="text-xl font-semibold text-slate-900">{avgAlignment}%</div>
                  <div className="text-xs text-muted-foreground">{t('demand.pipeline.strategicFitLabel')}</div>
                </div>
                <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('demand.pipeline.avgRisk')}</div>
                  <div className="text-xl font-semibold text-slate-900">{avgRisk}%</div>
                  <div className="text-xs text-muted-foreground">{t('demand.pipeline.complexityExposure')}</div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-xl border border-amber-100 bg-white/70 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t('demand.pipeline.intakeVelocity')}</span>
                    <span>{weeklyCounts.reduce((sum, value) => sum + value, 0)} total</span>
                  </div>
                  <div className="flex items-end gap-2 h-24">
                    {weeklyCounts.map((count, idx) => (
                      <div key={weekLabels[idx]} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full rounded-full bg-amber-100 overflow-hidden">
                          <div
                            className="bg-amber-500"
                            style={{ height: `${Math.max((count / maxWeekly) * 100, 10)}%`, minHeight: "10%" }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{weekLabels[idx]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-amber-100 bg-white/70 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t('demand.pipeline.urgencyMix')}</span>
                    <span>{urgencyTotal} tracked</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-500" />{t('demand.pipeline.highUrgency')}</span>
                      <span>{highUrgency}</span>
                    </div>
                    <div className="h-2 rounded-full bg-amber-100 overflow-hidden">
                      <div className="h-2 bg-rose-500" style={{ width: `${Math.round((highUrgency / urgencyTotal) * 100)}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />{t('demand.pipeline.mediumUrgency')}</span>
                      <span>{medUrgency}</span>
                    </div>
                    <div className="h-2 rounded-full bg-amber-100 overflow-hidden">
                      <div className="h-2 bg-amber-500" style={{ width: `${Math.round((medUrgency / urgencyTotal) * 100)}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />{t('demand.pipeline.lowUrgency')}</span>
                      <span>{lowUrgency}</span>
                    </div>
                    <div className="h-2 rounded-full bg-amber-100 overflow-hidden">
                      <div className="h-2 bg-emerald-500" style={{ width: `${Math.round((lowUrgency / urgencyTotal) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200/40 bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-amber-600" />
                {t('demand.pipeline.intakeSignals')}
              </CardTitle>
              <CardDescription>{t('demand.pipeline.intakeSignalsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-amber-100 bg-white/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    {t('demand.pipeline.alignmentMomentum')}
                  </div>
                  <span className="text-xs text-muted-foreground">{avgAlignment}% avg</span>
                </div>
                <div className="h-2 rounded-full bg-amber-100 overflow-hidden">
                  <div className="h-2 bg-emerald-500" style={{ width: `${avgAlignment}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-amber-100 bg-white/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    {t('demand.pipeline.riskExposure')}
                  </div>
                  <span className="text-xs text-muted-foreground">{avgRisk}% avg</span>
                </div>
                <div className="h-2 rounded-full bg-amber-100 overflow-hidden">
                  <div className="h-2 bg-amber-500" style={{ width: `${avgRisk}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-amber-100 bg-white/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Inbox className="h-4 w-4 text-amber-600" />
                    {t('demand.pipeline.intakeStatus')}
                  </div>
                  <span className="text-xs text-muted-foreground">{t('app.inFlow')}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide">{t('app.new')}</div>
                    <div className="text-lg font-semibold text-slate-900">{matrixBuckets.quickWins.length}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide">{t('demand.pipeline.underReview')}</div>
                    <div className="text-lg font-semibold text-slate-900">{matrixBuckets.planCarefully.length}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-amber-200/40 bg-white/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-600" />
              {t('demand.pipeline.priorityMatrix')}
            </CardTitle>
            <CardDescription>{t('demand.pipeline.priorityMatrixDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  title: t('demand.pipeline.fastTrack'),
                  desc: t('demand.pipeline.fastTrackDesc'),
                  items: matrixBuckets.fastTrack,
                  bg: "bg-emerald-50",
                },
                {
                  title: t('demand.pipeline.planCarefully'),
                  desc: t('demand.pipeline.planCarefullyDesc'),
                  items: matrixBuckets.planCarefully,
                  bg: "bg-amber-50",
                },
                {
                  title: t('demand.pipeline.quickWins'),
                  desc: t('demand.pipeline.quickWinsDesc'),
                  items: matrixBuckets.quickWins,
                  bg: "bg-sky-50",
                },
                {
                  title: t('demand.pipeline.reconsider'),
                  desc: t('demand.pipeline.reconsiderDesc'),
                  items: matrixBuckets.reconsider,
                  bg: "bg-rose-50",
                },
              ].map((cell) => (
                <div key={cell.title} className={`rounded-xl border border-amber-100 ${cell.bg} p-4`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{cell.title}</div>
                      <div className="text-xs text-muted-foreground">{cell.desc}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs">{cell.items.length}</Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {cell.items.length === 0 ? (
                      <div className="text-xs text-muted-foreground">{t('demand.pipeline.noDemands')}</div>
                    ) : (
                      cell.items.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white/80 px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {item.suggestedProjectName || item.businessObjective || t('app.untitled')}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">{item.organizationName}</div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {item.urgency || "Normal"}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200/40 bg-white/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
              {t('demand.pipeline.demandDetail')}
            </CardTitle>
            <CardDescription>{t('demand.pipeline.demandDetailDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-sm text-muted-foreground">{t('demand.pipeline.loadingPipeline')}</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {latestItems.map((item) => {
                  const isPending = item.workflowStatus?.toLowerCase() === "pending_approval";
                  const isConverted = item.hasPortfolioProject || item.workflowStatus?.toLowerCase() === "converted";
                  return (
                    <div key={item.id} className="rounded-xl border border-amber-100 bg-white/80 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {item.suggestedProjectName || item.businessObjective || t('app.untitled')}
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          {item.workflowStatus?.replace(/_/g, " ") || "pending"}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        {item.businessObjective || t('app.noDescription')}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded-full border border-amber-100 bg-amber-50/70 px-2 py-0.5">Align {item.strategicAlignment || 0}%</span>
                        <span className="rounded-full border border-amber-100 bg-amber-50/70 px-2 py-0.5">Risk {item.complexityRisk || 0}%</span>
                        <span className="rounded-full border border-amber-100 bg-amber-50/70 px-2 py-0.5">{item.department || "General"}</span>
                      </div>
                      <div className="mt-3 flex flex-col gap-2">
                        <Link href={`/demand-analysis-reports/${item.id}`}>
                          <Button variant="outline" size="sm" className="w-full">
                            {t('app.viewReport')}
                          </Button>
                        </Link>
                        {!isConverted && (
                          <div className="flex gap-2">
                            {isPending ? (
                              <>
                                <Button
                                  size="sm"
                                  className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => openApproveDialog(item)}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  {t('app.approve')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="flex-1 gap-1.5"
                                  onClick={() => openRejectDialog(item)}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  {t('app.reject')}
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                className="w-full gap-1.5 bg-slate-800 hover:bg-slate-900 text-white"
                                onClick={() => openConvertDialog(item)}
                              >
                                <Send className="h-3.5 w-3.5" />
                                {t('demand.pipeline.convertToProject')}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Convert to Project Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-slate-700" />
              {t('demand.pipeline.convertToProject')}
            </DialogTitle>
            <DialogDescription>
              {t('demand.pipeline.convertDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="conv-name">{t('demand.pipeline.projectName')}</Label>
              <Input
                id="conv-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={t('demand.pipeline.enterProjectName')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conv-desc">{t('demand.pipeline.projectDescription')}</Label>
              <Textarea
                id="conv-desc"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder={t('demand.pipeline.describeObjectives')}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conv-priority">{t('demand.priority')}</Label>
              <select
                id="conv-priority"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="low">{t('task.priority_values.low')}</option>
                <option value="medium">{t('task.priority_values.medium')}</option>
                <option value="high">{t('task.priority_values.high')}</option>
                <option value="critical">{t('task.priority_values.critical')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="conv-budget">{t('demand.pipeline.proposedBudget')}</Label>
              <Input
                id="conv-budget"
                value={proposedBudget}
                onChange={(e) => setProposedBudget(e.target.value)}
                placeholder={selectedDemand?.budgetRange || t('demand.pipeline.enterProposedBudget')}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="conv-start-date">{t('demand.pipeline.proposedStartDate')}</Label>
                <Input
                  id="conv-start-date"
                  type="date"
                  value={proposedStartDate}
                  onChange={(e) => setProposedStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conv-end-date">{t('demand.pipeline.proposedEndDate')}</Label>
                <Input
                  id="conv-end-date"
                  type="date"
                  value={proposedEndDate}
                  onChange={(e) => setProposedEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>{t('app.cancel')}</Button>
            <Button
              className="gap-1.5 bg-slate-800 hover:bg-slate-900"
              disabled={convertMutation.isPending || !projectName.trim()}
              onClick={() => {
                if (!selectedDemand) return;
                convertMutation.mutate({
                  demandId: selectedDemand.id,
                  projectName: projectName.trim(),
                  projectDescription: projectDescription.trim(),
                  priority,
                  proposedBudget: proposedBudget.trim() || extractBudgetValue(selectedDemand.estimatedBudget || selectedDemand.budgetRange) || undefined,
                  proposedStartDate: proposedStartDate || undefined,
                  proposedEndDate: proposedEndDate || undefined,
                });
              }}
            >
              {convertMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('demand.pipeline.submitRequest')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {t('demand.pipeline.approveConversion')}
            </DialogTitle>
            <DialogDescription>
              Approve &ldquo;{selectedDemand?.suggestedProjectName || selectedDemand?.businessObjective || "this demand"}&rdquo; and convert it to a portfolio project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="approve-notes">{t('demand.pipeline.decisionNotes')}</Label>
              <Textarea
                id="approve-notes"
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder={t('demand.pipeline.optionalNotes')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>{t('app.cancel')}</Button>
            <Button
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              disabled={approveMutation.isPending}
              onClick={() => {
                if (!selectedDemand) return;
                approveMutation.mutate({ id: selectedDemand.id, notes: decisionNotes });
              }}
            >
              {approveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('app.approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              {t('demand.pipeline.rejectConversion')}
            </DialogTitle>
            <DialogDescription>
              Reject &ldquo;{selectedDemand?.suggestedProjectName || selectedDemand?.businessObjective || "this demand"}&rdquo;. Provide a reason below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">{t('demand.pipeline.rejectionReason')}</Label>
              <Textarea
                id="reject-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={t('demand.pipeline.rejectReasonPlaceholder')}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reject-notes">{t('demand.pipeline.additionalNotes')}</Label>
              <Textarea
                id="reject-notes"
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder={t('demand.pipeline.optionalAdditionalNotes')}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>{t('app.cancel')}</Button>
            <Button
              variant="destructive"
              className="gap-1.5"
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
              onClick={() => {
                if (!selectedDemand) return;
                rejectMutation.mutate({ id: selectedDemand.id, reason: rejectionReason, notes: decisionNotes });
              }}
            >
              {rejectMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('app.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
