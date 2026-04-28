import { useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileCheck,
  GitPullRequest as _GitPullRequest,
  Layers,
  ShieldCheck,
  Target,
  TriangleAlert,
} from "lucide-react";

type ConversionRequest = {
  id: string;
  projectName: string;
  status: string;
  createdAt: string;
  priority?: string | null;
  proposedBudget?: string | null;
};

type WbsApproval = {
  id: string;
  project_name: string;
  status?: string;
  submitted_at?: string | null;
};

type GateApproval = {
  id: string;
  project_name: string;
  gate_name?: string;
  status?: string;
  created_at?: string | null;
};

type ChangeRequest = {
  id: string;
  project_name?: string;
  projectName?: string;
  title?: string;
  status?: string;
  requested_at?: string | null;
  requestedAt?: string | null;
};

type PortfolioSummary = {
  totalProjects: number;
  byHealth: { on_track: number; at_risk: number; critical: number };
};

type QueueItem = {
  id: string;
  type: "Conversion" | "WBS" | "Gate" | "Change";
  title: string;
  status: string;
  priority?: string | null;
  createdAt?: string | null;
};

const weekLabels = ["W-5", "W-4", "W-3", "W-2", "W-1", "This wk"];

export default function ProjectApproval() {
  const { t } = useTranslation();
  const { data: conversionRequestsData } = useQuery<{ success: boolean; requests: ConversionRequest[] }>({
    queryKey: ["/api/demand-conversion-requests"],
  });

  const { data: wbsApprovalsData } = useQuery<{ success: boolean; data: WbsApproval[] }>({
    queryKey: ["/api/portfolio/wbs/approvals/pending"],
  });

  const { data: gateApprovalsData } = useQuery<{ success: boolean; data: GateApproval[] }>({
    queryKey: ["/api/portfolio/gates/pending"],
  });

  const { data: changeRequestsData } = useQuery<{ success: boolean; data: ChangeRequest[] }>({
    queryKey: ["/api/portfolio/change-requests/all"],
  });

  const { data: portfolioSummary } = useQuery<{ success: boolean; data: PortfolioSummary }>({
    queryKey: ["/api/portfolio/summary"],
  });

  const conversionRequests = conversionRequestsData?.requests || [];
  const pendingConversions = conversionRequests.filter(
    (item) => item.status === "pending" || item.status === "under_review"
  );
  const pendingWbs = useMemo(() => wbsApprovalsData?.data || [], [wbsApprovalsData]);
  const pendingGates = useMemo(() => gateApprovalsData?.data || [], [gateApprovalsData]);
  const changeRequests = changeRequestsData?.data || [];
  const pendingChanges = changeRequests.filter((item) =>
    ["submitted", "under_review", "pending"].includes(String(item.status))
  );

  const priorityCounts = pendingConversions.reduce(
    (acc, item) => {
      const value = String(item.priority || "medium").toLowerCase();
      if (value.includes("high") || value.includes("urgent")) acc.high += 1;
      else if (value.includes("low")) acc.low += 1;
      else acc.medium += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );
  const priorityTotal = Math.max(priorityCounts.high + priorityCounts.medium + priorityCounts.low, 1);
  const conversionBudgetTotal = pendingConversions.reduce((sum, item) => {
    const raw = String(item.proposedBudget || "");
    const value = parseFloat(raw.replace(/[^0-9.]/g, ""));
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  const avgConversionBudget = pendingConversions.length > 0
    ? Math.round(conversionBudgetTotal / pendingConversions.length)
    : 0;

  const totalPending =
    pendingConversions.length + pendingWbs.length + pendingGates.length + pendingChanges.length;
  const approvalBase = Math.max(totalPending, 1);

  const health = portfolioSummary?.data?.byHealth || { on_track: 0, at_risk: 0, critical: 0 };
  const healthTotal = Math.max(health.on_track + health.at_risk + health.critical, 1);

  const queueItems = useMemo(() => {
    const conversionItems: QueueItem[] = pendingConversions.map((item) => ({
      id: item.id,
      type: "Conversion",
      title: item.projectName || t('changeRequest.conversionRequest'),
      status: item.status,
      priority: item.priority || "Standard",
      createdAt: item.createdAt,
    }));

    const wbsItems: QueueItem[] = pendingWbs.map((item) => ({
      id: item.id,
      type: "WBS",
      title: item.project_name || t('portfolio_pages.wbsApproval'),
      status: item.status || "pending",
      createdAt: item.submitted_at || null,
    }));

    const gateItems: QueueItem[] = pendingGates.map((item) => ({
      id: item.id,
      type: "Gate",
      title: item.project_name || item.gate_name || t('portfolio_pages.gateApproval'),
      status: item.status || "pending",
      createdAt: item.created_at || null,
    }));

    const changeItems: QueueItem[] = pendingChanges.map((item) => ({
      id: item.id,
      type: "Change",
      title: item.title || item.project_name || item.projectName || t('changeRequest.changeRequest'),
      status: item.status || "pending",
      createdAt: item.requested_at || item.requestedAt || null,
    }));

    return [...conversionItems, ...wbsItems, ...gateItems, ...changeItems]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 8);
  }, [pendingConversions, pendingWbs, pendingGates, pendingChanges, t]);

  const overdueCount = useMemo(() => {
    const now = Date.now();
    return queueItems.filter((item) => {
      if (!item.createdAt) return false;
      const days = Math.floor((now - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      return days >= 14;
    }).length;
  }, [queueItems]);

  const agingBuckets = useMemo(() => {
    const now = Date.now();
    const buckets = { fresh: 0, week: 0, fortnight: 0, month: 0 };
    queueItems.forEach((item) => {
      if (!item.createdAt) return;
      const days = Math.floor((now - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 3) buckets.fresh += 1;
      else if (days <= 7) buckets.week += 1;
      else if (days <= 14) buckets.fortnight += 1;
      else buckets.month += 1;
    });
    return buckets;
  }, [queueItems]);
  const agingTotal = Math.max(
    agingBuckets.fresh + agingBuckets.week + agingBuckets.fortnight + agingBuckets.month,
    1
  );
  const cadenceBuckets = useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: 6 }, () => 0);
    queueItems.forEach((item) => {
      if (!item.createdAt) return;
      const created = new Date(item.createdAt).getTime();
      if (Number.isNaN(created)) return;
      const daysAgo = Math.floor((now - created) / (1000 * 60 * 60 * 24));
      const bucketIndex = Math.floor(daysAgo / 7);
      if (bucketIndex >= 0 && bucketIndex < 6) {
        buckets[5 - bucketIndex]! += 1;
      }
    });
    return buckets;
  }, [queueItems]);
  const maxCadence = Math.max(...cadenceBuckets, 1);
  const queueAges = useMemo(() => {
    const now = Date.now();
    const ages = queueItems
      .map((item) => {
        if (!item.createdAt) return null;
        return Math.floor((now - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      })
      .filter((value): value is number => value !== null && Number.isFinite(value));
    return {
      oldest: ages.length ? Math.max(...ages) : 0,
      newest: ages.length ? Math.min(...ages) : 0,
    };
  }, [queueItems]);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/pmo-office">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t('portfolio_pages.pmoOffice')}
              </Button>
            </Link>
            <div>
              <div className="text-sm font-semibold">{t('portfolio_pages.projectApprovalCommand')}</div>
              <div className="text-xs text-muted-foreground">{t('portfolio_pages.projectApprovalSubtitle')}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/20">
              <ClipboardCheck className="h-3 w-3 mr-1" />
              {totalPending} {t('portfolio_pages.pendingApprovals')}
            </Badge>
            <Link href="/pmo-office">
              <Button size="sm" variant="outline">{t('portfolio_pages.openApprovals')}</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        <div className="grid gap-4 lg:grid-cols-4">
          {[
            { title: t('portfolio_pages.totalPending'), value: totalPending, icon: ClipboardList },
            { title: t('portfolio_pages.conversions'), value: pendingConversions.length, icon: FileCheck },
            { title: t('portfolio_pages.wbsApprovals'), value: pendingWbs.length, icon: Layers },
            { title: t('portfolio_pages.gateReviews'), value: pendingGates.length, icon: Target },
          ].map((card) => (
            <Card key={card.title} className="border-amber-200/40 bg-white/80">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{card.title}</span>
                  <card.icon className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-2xl font-semibold text-slate-900">{card.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          <Card className="border-amber-200/40 bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                {t('portfolio_pages.approvalAging')}
              </CardTitle>
              <CardDescription>{t('portfolio_pages.approvalAgingDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-2 rounded-full bg-amber-100 overflow-hidden flex">
                <div className="h-2 bg-emerald-500" style={{ width: `${Math.round((agingBuckets.fresh / agingTotal) * 100)}%` }} />
                <div className="h-2 bg-sky-500" style={{ width: `${Math.round((agingBuckets.week / agingTotal) * 100)}%` }} />
                <div className="h-2 bg-amber-500" style={{ width: `${Math.round((agingBuckets.fortnight / agingTotal) * 100)}%` }} />
                <div className="h-2 bg-rose-500" style={{ width: `${Math.round((agingBuckets.month / agingTotal) * 100)}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />0-3d {agingBuckets.fresh}</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-500" />4-7d {agingBuckets.week}</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />8-14d {agingBuckets.fortnight}</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-500" />15+d {agingBuckets.month}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200/40 bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-amber-600" />
                {t('portfolio_pages.priorityMix')}
              </CardTitle>
              <CardDescription>{t('portfolio_pages.priorityMixDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-2 rounded-full bg-amber-100 overflow-hidden flex">
                <div className="h-2 bg-rose-500" style={{ width: `${Math.round((priorityCounts.high / priorityTotal) * 100)}%` }} />
                <div className="h-2 bg-amber-500" style={{ width: `${Math.round((priorityCounts.medium / priorityTotal) * 100)}%` }} />
                <div className="h-2 bg-emerald-500" style={{ width: `${Math.round((priorityCounts.low / priorityTotal) * 100)}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-500" />{t('risk.high')} {priorityCounts.high}</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />{t('risk.medium')} {priorityCounts.medium}</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />{t('risk.low')} {priorityCounts.low}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200/40 bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-600" />
                {t('portfolio_pages.budgetExposure')}
              </CardTitle>
              <CardDescription>{t('portfolio_pages.budgetExposureDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-semibold text-slate-900">AED {conversionBudgetTotal.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{t('portfolio_pages.averagePerRequest', { value: avgConversionBudget.toLocaleString() })}</div>
              <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-xs text-muted-foreground">
                {pendingConversions.length} {t('portfolio_pages.conversionRequestsAwaiting')}
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200/40 bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                {t('portfolio_pages.queueCadence')}
              </CardTitle>
              <CardDescription>{t('portfolio_pages.queueCadenceDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end gap-2 h-20">
                {cadenceBuckets.map((count, idx) => (
                  <div key={weekLabels[idx]} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-full bg-amber-100 overflow-hidden">
                      <div
                        className="bg-amber-500"
                        style={{ height: `${Math.max((count / maxCadence) * 100, 10)}%`, minHeight: "10%" }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{weekLabels[idx]}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3">
                  <div className="text-[11px] uppercase tracking-wide">{t('portfolio_pages.oldestItem')}</div>
                  <div className="text-lg font-semibold text-slate-900">{queueAges.oldest}d</div>
                </div>
                <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3">
                  <div className="text-[11px] uppercase tracking-wide">{t('portfolio_pages.newestItem')}</div>
                  <div className="text-lg font-semibold text-slate-900">{queueAges.newest}d</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-amber-200/40 bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-600" />
                {t('portfolio_pages.approvalFlowMix')}
              </CardTitle>
              <CardDescription>{t('portfolio_pages.approvalFlowMixDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-2 rounded-full bg-amber-100 overflow-hidden flex">
                <div className="h-2 bg-emerald-500" style={{ width: `${Math.round((pendingConversions.length / approvalBase) * 100)}%` }} />
                <div className="h-2 bg-sky-500" style={{ width: `${Math.round((pendingWbs.length / approvalBase) * 100)}%` }} />
                <div className="h-2 bg-amber-500" style={{ width: `${Math.round((pendingGates.length / approvalBase) * 100)}%` }} />
                <div className="h-2 bg-rose-500" style={{ width: `${Math.round((pendingChanges.length / approvalBase) * 100)}%` }} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />{t('portfolio_pages.conversion')} {pendingConversions.length}</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-500" />{t('portfolio_pages.wbs')} {pendingWbs.length}</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />{t('portfolio_pages.gates')} {pendingGates.length}</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-500" />{t('portfolio_pages.change')} {pendingChanges.length}</div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-amber-100 bg-white/70 p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t('portfolio_pages.approvalSLA')}</span>
                    <span>{overdueCount} {t('app.overdue')}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span>{t('portfolio_pages.fourteenDayTargetWindow')}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-100 bg-white/70 p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t('portfolio_pages.portfolioHealth')}</span>
                    <span>{portfolioSummary?.data?.totalProjects || 0} {t('portfolio_pages.projects')}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-900">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>{Math.round((health.on_track / healthTotal) * 100)}% {t('portfolio_pages.onTrack')}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200/40 bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TriangleAlert className="h-5 w-5 text-amber-600" />
                {t('portfolio_pages.governanceSignals')}
              </CardTitle>
              <CardDescription>{t('portfolio_pages.governanceSignalsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: t('portfolio_pages.strategicAlignment'), value: Math.round((health.on_track / healthTotal) * 100), icon: CheckCircle2 },
                { label: t('portfolio_pages.riskReview'), value: Math.round((health.at_risk / healthTotal) * 100), icon: TriangleAlert },
                { label: t('portfolio_pages.criticalWatch'), value: Math.round((health.critical / healthTotal) * 100), icon: Target },
              ].map((signal) => (
                <div key={signal.label} className="rounded-lg border border-amber-100 bg-white/70 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{signal.label}</span>
                    <span>{signal.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-amber-100 overflow-hidden">
                    <div className="h-2 bg-amber-500" style={{ width: `${signal.value}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="border-amber-200/40 bg-white/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-amber-600" />
              {t('portfolio_pages.decisionQueue')}\n            </CardTitle>\n            <CardDescription>{t('portfolio_pages.decisionQueueDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {queueItems.length === 0 ? (
              <div className="py-8 text-sm text-muted-foreground">{t('portfolio_pages.noApprovalsWaiting')}</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {queueItems.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="rounded-xl border border-amber-100 bg-white/80 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.type}</div>
                      <Badge variant="secondary" className="text-[10px]">
                        {item.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900 line-clamp-1">{item.title}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {item.priority && (
                        <span className="rounded-full border border-amber-100 bg-amber-50/70 px-2 py-0.5">{item.priority}</span>
                      )}
                      {item.createdAt && (
                        <span className="rounded-full border border-amber-100 bg-amber-50/70 px-2 py-0.5">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
