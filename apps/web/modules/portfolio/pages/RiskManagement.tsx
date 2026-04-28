import { useMemo, useCallback } from "react";
import { useTranslation } from 'react-i18next';
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  ClipboardList,
  FileCheck,
  ShieldCheck,
  Target,
  TriangleAlert,
} from "lucide-react";

type PortfolioSummary = {
  totalProjects: number;
  byHealth: { on_track: number; at_risk: number; critical: number };
  byPhase?: Record<string, number>;
};

type GateApproval = {
  id: string;
};

type ChangeRequest = {
  id: string;
  project_name?: string;
  projectName?: string;
  title?: string;
  impact?: string;
  urgency?: string;
  change_type?: string;
  changeType?: string;
  status?: string;
  requested_at?: string | null;
  requestedAt?: string | null;
};

type ChangeRequestSummary = {
  id: string;
  projectName: string;
  title: string;
  impact: string;
  urgency: string;
  changeType: string;
  status: string;
  requestedAt?: string | null;
};

const weekLabels = ["W-5", "W-4", "W-3", "W-2", "W-1", "This wk"];

export default function RiskManagement() {
  const { t } = useTranslation();
  const { data: portfolioSummary } = useQuery<{ success: boolean; data: PortfolioSummary }>({
    queryKey: ["/api/portfolio/summary"],
  });

  const { data: gateApprovalsData } = useQuery<{ success: boolean; data: GateApproval[] }>({
    queryKey: ["/api/portfolio/gates/pending"],
  });

  const { data: changeRequestsData } = useQuery<{ success: boolean; data: ChangeRequest[] }>({
    queryKey: ["/api/portfolio/change-requests/all"],
  });

  const changeRequests = (changeRequestsData?.data || []).map((item) => {
    const impact = String(item.impact || "medium").toLowerCase();
    const urgency = String(item.urgency || "normal").toLowerCase();
    return {
      id: String(item.id || ""),
      projectName: String(item.project_name || item.projectName || t('risk.unknownProject')),
      title: String(item.title || t('changeRequest.changeRequest')),
      impact,
      urgency,
      changeType: String(item.change_type || item.changeType || "other"),
      status: String(item.status || "pending"),
      requestedAt: item.requested_at || item.requestedAt || null,
    } as ChangeRequestSummary;
  });

  const pendingGates = gateApprovalsData?.data || [];
  const summary = portfolioSummary?.data;
  const health = summary?.byHealth || { on_track: 0, at_risk: 0, critical: 0 };
  const healthTotal = Math.max(health.on_track + health.at_risk + health.critical, 1);
  const totalProjects = summary?.totalProjects ?? 0;
  const riskScore = Math.round(
    ((health.at_risk * 60 + health.critical * 90) / Math.max(totalProjects, 1))
  );

  const impactCounts = changeRequests.reduce(
    (acc, item) => {
      if (item.impact === "critical" || item.impact === "high") acc.high += 1;
      else if (item.impact === "medium") acc.medium += 1;
      else acc.low += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );
  const impactTotal = Math.max(impactCounts.high + impactCounts.medium + impactCounts.low, 1);

  const changeTypeCounts = changeRequests.reduce<Record<string, number>>((acc, item) => {
    const key = item.changeType || "other";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const topRiskDrivers = Object.entries(changeTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const segmentEntries = Object.entries(changeTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxSegmentCount = Math.max(...segmentEntries.map((entry) => entry[1]), 1);

  const mitigationOwners = useCallback((item: ChangeRequestSummary) => {
    const type = item.changeType.toLowerCase();
    if (type.includes("security") || type.includes("cyber")) return t('risk.securityOffice');
    if (type.includes("budget") || type.includes("finance")) return t('risk.financeControl');
    if (type.includes("resource")) return t('risk.pmoCapacity');
    if (type.includes("scope")) return t('risk.programControl');
    if (type.includes("schedule") || type.includes("timeline")) return t('risk.deliveryAssurance');
    return t('risk.pmoRiskOffice');
  }, [t]);

  const mitigationSla = (item: ChangeRequestSummary) => {
    const impact = item.impact.toLowerCase();
    const urgency = item.urgency.toLowerCase();
    if (impact === "critical" || urgency === "urgent") return 3;
    if (impact === "high" || urgency === "high") return 7;
    if (impact === "medium") return 14;
    return 21;
  };

  const mitigationRecommendations = useMemo(() => {
    return changeRequests
      .map((item) => {
        const impact = item.impact.toLowerCase();
        const urgency = item.urgency.toLowerCase();
        let action = t('risk.monitorAndMaintain');
        if (impact === "critical" || urgency === "urgent") {
          action = t('risk.initiateImmediateMitigation');
        } else if (impact === "high" || urgency === "high") {
          action = t('risk.assignRiskOwner');
        } else if (impact === "medium") {
          action = t('risk.scheduleMitigationReview');
        }
        return {
          ...item,
          owner: mitigationOwners(item),
          slaDays: mitigationSla(item),
          action,
        };
      })
      .slice(0, 6);
  }, [changeRequests, mitigationOwners, t]);

  const riskHeatmap = useMemo(() => {
    const buckets = {
      highImpact_highUrgency: [] as ChangeRequestSummary[],
      highImpact_lowUrgency: [] as ChangeRequestSummary[],
      lowImpact_highUrgency: [] as ChangeRequestSummary[],
      lowImpact_lowUrgency: [] as ChangeRequestSummary[],
    };

    changeRequests.forEach((item) => {
      const highImpact = item.impact === "high" || item.impact === "critical";
      const highUrgency = item.urgency === "high" || item.urgency === "urgent";
      if (highImpact && highUrgency) buckets.highImpact_highUrgency.push(item);
      else if (highImpact) buckets.highImpact_lowUrgency.push(item);
      else if (highUrgency) buckets.lowImpact_highUrgency.push(item);
      else buckets.lowImpact_lowUrgency.push(item);
    });

    return buckets;
  }, [changeRequests]);

  const riskTimeline = useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: 6 }, () => 0);
    changeRequests.forEach((item) => {
      if (!item.requestedAt) return;
      const created = new Date(item.requestedAt).getTime();
      if (Number.isNaN(created)) return;
      const daysAgo = Math.floor((now - created) / (1000 * 60 * 60 * 24));
      const bucketIndex = Math.floor(daysAgo / 7);
      if (bucketIndex >= 0 && bucketIndex < 6) {
        buckets[5 - bucketIndex]! += 1;
      }
    });
    return buckets;
  }, [changeRequests]);
  const maxTimeline = Math.max(...riskTimeline, 1);

  const priorityRegister = [...changeRequests]
    .sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime())
    .slice(0, 6);

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
              <div className="text-sm font-semibold">{t('portfolio_pages.riskManagementCommand')}</div>
              <div className="text-xs text-muted-foreground">{t('portfolio_pages.riskManagementSubtitle')}</div>
            </div>
          </div>
          <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/20">
            <TriangleAlert className="h-3 w-3 mr-1" />
            {t('risk.riskScore')} {riskScore}
          </Badge>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        <div className="grid gap-4 lg:grid-cols-4">
          {[
            { title: t('portfolio_pages.totalProjects'), value: totalProjects, icon: ClipboardList },
            { title: t('portfolio_pages.critical'), value: health.critical, icon: AlertTriangle },
            { title: t('portfolio_pages.atRisk'), value: health.at_risk, icon: TriangleAlert },
            { title: t('portfolio_pages.pendingGates'), value: pendingGates.length, icon: ShieldCheck },
          ].map((card) => (
            <Card key={card.title} className="border-rose-200/40 bg-white/80">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{card.title}</span>
                  <card.icon className="h-4 w-4 text-rose-600" />
                </div>
                <div className="text-2xl font-semibold text-slate-900">{card.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-rose-200/40 bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-rose-600" />
                {t('risk.riskExposureMix')}
              </CardTitle>
              <CardDescription>{t('risk.riskExposureMixDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-2 rounded-full bg-rose-100 overflow-hidden flex">
                <div className="h-2 bg-emerald-500" style={{ width: `${Math.round((health.on_track / healthTotal) * 100)}%` }} />
                <div className="h-2 bg-amber-500" style={{ width: `${Math.round((health.at_risk / healthTotal) * 100)}%` }} />
                <div className="h-2 bg-rose-500" style={{ width: `${Math.round((health.critical / healthTotal) * 100)}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />{t('portfolio_pages.onTrack')} {health.on_track}</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />{t('portfolio_pages.atRisk')} {health.at_risk}</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-500" />{t('portfolio_pages.critical')} {health.critical}</div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-rose-100 bg-white/70 p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t('risk.changeImpact')}</span>
                    <span>{changeRequests.length} active</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-rose-100 overflow-hidden flex">
                    <div className="h-2 bg-rose-500" style={{ width: `${Math.round((impactCounts.high / impactTotal) * 100)}%` }} />
                    <div className="h-2 bg-amber-500" style={{ width: `${Math.round((impactCounts.medium / impactTotal) * 100)}%` }} />
                    <div className="h-2 bg-emerald-500" style={{ width: `${Math.round((impactCounts.low / impactTotal) * 100)}%` }} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />{t('risk.high')} {impactCounts.high}</div>
                    <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />{t('risk.med')} {impactCounts.medium}</div>
                    <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />{t('risk.low')} {impactCounts.low}</div>
                  </div>
                </div>
                <div className="rounded-lg border border-rose-100 bg-white/70 p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t('risk.riskInflow')}</span>
                    <span>{t('risk.last6Weeks')}</span>
                  </div>
                  <div className="mt-2 flex items-end gap-2 h-20">
                    {riskTimeline.map((count, idx) => (
                      <div key={weekLabels[idx]} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-full bg-rose-100 overflow-hidden">
                          <div
                            className="bg-rose-500"
                            style={{ height: `${Math.max((count / maxTimeline) * 100, 10)}%`, minHeight: "10%" }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{weekLabels[idx]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-rose-200/40 bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-rose-600" />
                {t('risk.riskDrivers')}
              </CardTitle>
              <CardDescription>{t('risk.riskDriversDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {topRiskDrivers.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t('risk.noChangeDataAvailable')}</div>
              ) : (
                topRiskDrivers.map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-rose-100 bg-white/70 p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="capitalize">{key.replace(/_/g, " ")}</span>
                      <span>{value}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-rose-100 overflow-hidden">
                      <div className="h-2 bg-rose-500" style={{ width: `${Math.round((value / impactTotal) * 100)}%` }} />
                    </div>
                  </div>
                ))
              )}
              <div className="rounded-lg border border-rose-100 bg-rose-50/60 p-3 text-xs text-muted-foreground">
                {t('risk.focusOnChangeCategories')}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-rose-200/40 bg-white/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-rose-600" />
              {t('risk.segmentHeatmap')}
            </CardTitle>
            <CardDescription>{t('risk.segmentHeatmapDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {segmentEntries.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t('risk.noSegmentDataAvailable')}</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                {segmentEntries.map(([segment, count]) => {
                  const intensity = Math.round((count / maxSegmentCount) * 100);
                  return (
                    <div key={segment} className="rounded-xl border border-rose-100 bg-white/80 p-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="capitalize">{segment.replace(/_/g, " ")}</span>
                        <span>{count}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-rose-100 overflow-hidden">
                        <div className="h-2 bg-rose-500" style={{ width: `${intensity}%` }} />
                      </div>
                      <div className="mt-2 text-[11px] text-muted-foreground">{t('risk.intensity')} {intensity}%</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-rose-200/40 bg-white/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-rose-600" />
              {t('risk.riskPriorityMatrix')}
            </CardTitle>
            <CardDescription>{t('risk.riskPriorityMatrixDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  title: t('risk.immediateMitigation'),
                  desc: t('risk.highImpactHighUrgency'),
                  items: riskHeatmap.highImpact_highUrgency,
                  bg: "bg-rose-50",
                },
                {
                  title: t('risk.plannedContainment'),
                  desc: t('risk.highImpactLowerUrgency'),
                  items: riskHeatmap.highImpact_lowUrgency,
                  bg: "bg-amber-50",
                },
                {
                  title: t('risk.quickResolution'),
                  desc: t('risk.lowerImpactHighUrgency'),
                  items: riskHeatmap.lowImpact_highUrgency,
                  bg: "bg-sky-50",
                },
                {
                  title: t('risk.monitor'),
                  desc: t('risk.lowerImpactLowerUrgency'),
                  items: riskHeatmap.lowImpact_lowUrgency,
                  bg: "bg-emerald-50",
                },
              ].map((cell) => (
                <div key={cell.title} className={`rounded-xl border border-rose-100 ${cell.bg} p-4`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{cell.title}</div>
                      <div className="text-xs text-muted-foreground">{cell.desc}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs">{cell.items.length}</Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {cell.items.length === 0 ? (
                      <div className="text-xs text-muted-foreground">{t('risk.noItemsInSegment')}</div>
                    ) : (
                      cell.items.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-rose-100 bg-white/80 px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {item.projectName}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">{item.title}</div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {item.status.replace(/_/g, " ")}
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

        <Card className="border-rose-200/40 bg-white/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-rose-600" />
              {t('risk.riskRegister')}
            </CardTitle>
            <CardDescription>{t('risk.riskRegisterDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {priorityRegister.length === 0 ? (
              <div className="py-6 text-sm text-muted-foreground">{t('risk.noActiveRiskItems')}</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {priorityRegister.map((item) => (
                  <div key={item.id} className="rounded-xl border border-rose-100 bg-white/80 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.projectName}</div>
                      <Badge variant="secondary" className="text-[10px]">
                        {item.impact}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900 line-clamp-1">{item.title}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full border border-rose-100 bg-rose-50/70 px-2 py-0.5">{t('risk.urgency')} {item.urgency}</span>
                      <span className="rounded-full border border-rose-100 bg-rose-50/70 px-2 py-0.5">{t('risk.type')} {item.changeType}</span>
                      <span className="rounded-full border border-rose-100 bg-rose-50/70 px-2 py-0.5">{t('risk.owner')} {mitigationOwners(item)}</span>
                      <span className="rounded-full border border-rose-100 bg-rose-50/70 px-2 py-0.5">{t('risk.sla')} {mitigationSla(item)}d</span>
                      {item.requestedAt && (
                        <span className="rounded-full border border-rose-100 bg-rose-50/70 px-2 py-0.5">
                          {new Date(item.requestedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-rose-200/40 bg-white/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-rose-600" />
              {t('risk.mitigationPlaybook')}
            </CardTitle>
            <CardDescription>{t('risk.mitigationPlaybookDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {mitigationRecommendations.length === 0 ? (
              <div className="py-6 text-sm text-muted-foreground">{t('risk.noMitigationActions')}</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {mitigationRecommendations.map((item) => (
                  <div key={`mitigation-${item.id}`} className="rounded-xl border border-rose-100 bg-white/80 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.projectName}</div>
                      <Badge variant="secondary" className="text-[10px]">
                        {item.impact}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900 line-clamp-1">{item.title}</div>
                    <div className="mt-2 text-xs text-muted-foreground">{item.action}</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full border border-rose-100 bg-rose-50/70 px-2 py-0.5">{t('risk.owner')} {item.owner}</span>
                      <span className="rounded-full border border-rose-100 bg-rose-50/70 px-2 py-0.5">{t('risk.sla')} {item.slaDays}d</span>
                      <span className="rounded-full border border-rose-100 bg-rose-50/70 px-2 py-0.5">{t('risk.urgency')} {item.urgency}</span>
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
