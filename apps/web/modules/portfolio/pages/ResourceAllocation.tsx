import { useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactNumber, formatCurrency, formatNumber } from "@/modules/demand";
import {
  Activity,
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Layers,
  Target,
  Users,
} from "lucide-react";

type PortfolioStats = {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  atRiskProjects: number;
  totalBudget: number;
  utilizationRate: number;
};

type PortfolioSummary = {
  totalProjects: number;
  totalBudget: number;
  totalSpend: number;
  avgProgress: number;
  byHealth: { on_track: number; at_risk: number; critical: number };
  byPhase: Record<string, number>;
};

type PortfolioProject = {
  id: string;
  projectName: string;
  projectCode?: string | null;
  currentPhase?: string | null;
  priority?: string | null;
  healthStatus?: string | null;
  approvedBudget?: number | string | null;
  allocatedFTE?: number | string | null;
  projectManagerId?: string | null;
  projectManager?: string | null;
  assignedTeamId?: string | null;
};

const priorityOrder = ["critical", "high", "medium", "low"] as const;

const parseNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function ResourceAllocation() {
  const { t } = useTranslation();

  const phaseLabels: Record<string, string> = {
    intake: t('project.phases.intake'),
    triage: t('project.phases.triage'),
    planning: t('project.phases.planning'),
    execution: t('project.phases.execution'),
    monitoring: t('project.phases.monitoring'),
    closure: t('project.phases.closure'),
    cancelled: t('project.phases.cancelled'),
  };

  const { data: portfolioStats } = useQuery<{ success: boolean; data: PortfolioStats }>({
    queryKey: ["/api/portfolio/stats"],
  });

  const { data: portfolioSummary } = useQuery<{ success: boolean; data: PortfolioSummary }>({
    queryKey: ["/api/portfolio/summary"],
  });

  const { data: projectsData } = useQuery<{ success: boolean; data: PortfolioProject[] }>({
    queryKey: ["/api/portfolio/projects"],
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const projects = projectsData?.data || [];
  const stats = portfolioStats?.data;
  const summary = portfolioSummary?.data;

  const metrics = useMemo(() => {
    const totalProjects = projects.length;
    const activeProjects = projects.filter(
      (project) => !["closure", "cancelled"].includes(String(project.currentPhase || ""))
    );

    const totalAllocatedFte = projects.reduce(
      (sum, project) => sum + parseNumber(project.allocatedFTE),
      0
    );
    const projectsWithFte = projects.filter((project) => parseNumber(project.allocatedFTE) > 0);
    const coveragePercent = totalProjects > 0
      ? Math.round((projectsWithFte.length / totalProjects) * 100)
      : 0;
    const avgFte = projectsWithFte.length > 0 ? totalAllocatedFte / projectsWithFte.length : 0;

    const unassignedTeams = projects.filter((project) => !project.assignedTeamId).length;
    const unassignedManagers = projects.filter(
      (project) => !project.projectManagerId && !project.projectManager
    ).length;
    const missingFte = projects.filter((project) => parseNumber(project.allocatedFTE) <= 0).length;

    const phaseAllocation = projects.reduce<Record<string, number>>((acc, project) => {
      const phase = String(project.currentPhase || "unknown");
      acc[phase] = (acc[phase] || 0) + parseNumber(project.allocatedFTE);
      return acc;
    }, {});

    const priorityCounts = projects.reduce<Record<string, number>>((acc, project) => {
      const raw = String(project.priority || "medium").toLowerCase();
      let key = "medium";
      if (raw.includes("critical")) key = "critical";
      else if (raw.includes("high")) key = "high";
      else if (raw.includes("low")) key = "low";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const hotspots = [...projects]
      .map((project) => {
        const allocatedFte = parseNumber(project.allocatedFTE);
        const approvedBudget = parseNumber(project.approvedBudget);
        return {
          ...project,
          allocatedFte,
          approvedBudget,
          budgetPerFte: allocatedFte > 0 ? approvedBudget / allocatedFte : 0,
        };
      })
      .filter((project) => project.allocatedFte > 0)
      .sort((a, b) => b.allocatedFte - a.allocatedFte)
      .slice(0, 6);

    return {
      totalProjects,
      activeProjects: activeProjects.length,
      totalAllocatedFte,
      coveragePercent,
      avgFte,
      unassignedTeams,
      unassignedManagers,
      missingFte,
      phaseAllocation,
      priorityCounts,
      hotspots,
    };
  }, [projects]);

  const phaseEntries = Object.entries(metrics.phaseAllocation)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxPhaseFte = Math.max(...phaseEntries.map((entry) => entry[1]), 1);

  const priorityTotal = Math.max(
    priorityOrder.reduce((sum, key) => sum + (metrics.priorityCounts[key] || 0), 0),
    1
  );

  const utilizationRate = Math.round(stats?.utilizationRate ?? summary?.avgProgress ?? 0);
  const coveragePercent = Math.min(metrics.coveragePercent, 100);

  const allocationSignals = [
    {
      label: t('portfolio_pages.projectsWithoutTeam'),
      value: metrics.unassignedTeams,
      tone: "text-amber-600",
    },
    {
      label: t('portfolio_pages.projectsWithoutPM'),
      value: metrics.unassignedManagers,
      tone: "text-rose-600",
    },
    {
      label: t('portfolio_pages.missingFTE'),
      value: metrics.missingFte,
      tone: "text-slate-600",
    },
  ];

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
              <div className="text-sm font-semibold">{t('portfolio_pages.resourceAllocationCommand')}</div>
              <div className="text-xs text-muted-foreground">{t('portfolio_pages.resourceAllocationSubtitle')}</div>
            </div>
          </div>
          <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20">
            <Activity className="h-3 w-3 mr-1" />
            {utilizationRate}% {t('portfolio_pages.utilization')}
          </Badge>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        <div className="grid gap-4 lg:grid-cols-4">
          {[
            { title: t('portfolio_pages.activeProjects'), value: stats?.activeProjects ?? metrics.activeProjects, icon: Layers },
            { title: t('portfolio_pages.allocatedFTE'), value: formatNumber(metrics.totalAllocatedFte, 1), icon: Users },
            { title: t('portfolio_pages.coverage'), value: `${coveragePercent}%`, icon: CheckCircle2 },
            { title: t('portfolio_pages.unassigned'), value: metrics.unassignedTeams + metrics.unassignedManagers, icon: ClipboardCheck },
          ].map((card) => (
            <Card key={card.title} className="border-blue-200/40 bg-white/80">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{card.title}</span>
                  <card.icon className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-2xl font-semibold text-slate-900">{card.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-blue-200/40 bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                {t('portfolio_pages.capacityCoverage')}
              </CardTitle>
              <CardDescription>{t('portfolio_pages.capacityCoverageDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-[160px_1fr] items-center">
              <div className="flex items-center justify-center">
                <div
                  className="h-32 w-32 rounded-full flex items-center justify-center"
                  style={{
                    background: `conic-gradient(#3b82f6 ${coveragePercent}%, #e2e8f0 0)`,
                  }}
                >
                  <div className="h-20 w-20 rounded-full bg-white shadow-inner flex flex-col items-center justify-center">
                    <span className="text-xl font-semibold text-slate-900">{coveragePercent}%</span>
                    <span className="text-[10px] text-muted-foreground">{t('portfolio_pages.fteCoverage')}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-blue-100 bg-white/70 p-3">
                    <div className="text-xs text-muted-foreground">{t('portfolio_pages.avgFtePerProject')}</div>
                    <div className="text-lg font-semibold text-slate-900">{formatNumber(metrics.avgFte, 1)}</div>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-white/70 p-3">
                    <div className="text-xs text-muted-foreground">{t('portfolio_pages.totalBudget')}</div>
                    <div className="text-lg font-semibold text-slate-900">{formatCurrency(summary?.totalBudget ?? 0, "AED", true)}</div>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-white/70 p-3">
                    <div className="text-xs text-muted-foreground">{t('portfolio_pages.activeLoad')}</div>
                    <div className="text-lg font-semibold text-slate-900">{stats?.activeProjects ?? metrics.activeProjects}</div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {allocationSignals.map((signal) => (
                    <div key={signal.label} className="rounded-lg border border-blue-100 bg-white/70 p-3">
                      <div className="text-xs text-muted-foreground">{signal.label}</div>
                      <div className={`text-lg font-semibold ${signal.tone}`}>{signal.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200/40 bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-blue-600" />
                {t('portfolio_pages.allocationMix')}
              </CardTitle>
              <CardDescription>{t('portfolio_pages.allocationMixDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('portfolio_pages.fteByPhase')}</span>
                  <span>{phaseEntries.length} phases</span>
                </div>
                <div className="mt-3 space-y-3">
                  {phaseEntries.length === 0 ? (
                    <div className="text-sm text-muted-foreground">{t('portfolio_pages.noFTEAllocationData')}</div>
                  ) : (
                    phaseEntries.map(([phase, value]) => (
                      <div key={phase} className="rounded-lg border border-blue-100 bg-white/70 p-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{phaseLabels[phase] || phase}</span>
                          <span>{formatNumber(value, 1)} FTE</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-blue-100 overflow-hidden">
                          <div className="h-2 bg-blue-500" style={{ width: `${Math.round((value / maxPhaseFte) * 100)}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('portfolio_pages.priorityCoverage')}</span>
                  <span>{priorityTotal} projects</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden flex">
                  <div className="h-2 bg-rose-500" style={{ width: `${Math.round(((metrics.priorityCounts.critical || 0) / priorityTotal) * 100)}%` }} />
                  <div className="h-2 bg-amber-500" style={{ width: `${Math.round(((metrics.priorityCounts.high || 0) / priorityTotal) * 100)}%` }} />
                  <div className="h-2 bg-blue-500" style={{ width: `${Math.round(((metrics.priorityCounts.medium || 0) / priorityTotal) * 100)}%` }} />
                  <div className="h-2 bg-slate-400" style={{ width: `${Math.round(((metrics.priorityCounts.low || 0) / priorityTotal) * 100)}%` }} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-500" />{t('portfolio_pages.critical')} {metrics.priorityCounts.critical || 0}</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />{t('risk.high')} {metrics.priorityCounts.high || 0}</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500" />{t('risk.medium')} {metrics.priorityCounts.medium || 0}</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-400" />{t('risk.low')} {metrics.priorityCounts.low || 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-blue-200/40 bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                {t('portfolio_pages.resourceHotspots')}
              </CardTitle>
              <CardDescription>{t('portfolio_pages.resourceHotspotsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {metrics.hotspots.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t('portfolio_pages.noFTEAllocations')}</div>
              ) : (
                metrics.hotspots.map((project) => (
                  <div key={project.id} className="rounded-lg border border-blue-100 bg-white/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{project.projectName}</div>
                        <div className="text-xs text-muted-foreground">
                          {phaseLabels[String(project.currentPhase || "")] || project.currentPhase || t('portfolio_pages.unassignedPhase')} · {String(project.priority || "medium").toUpperCase()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-900">{formatNumber(project.allocatedFte, 1)} FTE</div>
                        <div className="text-[11px] text-muted-foreground">{formatCompactNumber(project.approvedBudget)} budget</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{t('portfolio_pages.budgetPerFTE')}</span>
                      <span>{formatCurrency(project.budgetPerFte, "AED", true)}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-blue-200/40 bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-blue-600" />
                {t('portfolio_pages.staffingActions')}
              </CardTitle>
              <CardDescription>{t('portfolio_pages.staffingActionsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {allocationSignals.map((signal) => (
                  <div key={signal.label} className="flex items-center justify-between rounded-lg border border-blue-100 bg-white/70 p-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{signal.label}</div>
                      <div className="text-xs text-muted-foreground">{t('portfolio_pages.activeResourceGaps')}</div>
                    </div>
                    <div className={`text-lg font-semibold ${signal.tone}`}>{signal.value}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-blue-100 bg-white/70 p-3 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                  {t('portfolio_pages.prioritizeFTE')}
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                  {t('portfolio_pages.alignPMs')}
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                  {t('portfolio_pages.rebalanceTeams')}
                </div>
              </div>
              <Link href="/project-approval">
                <Button className="w-full" variant="secondary">
                  {t('portfolio_pages.reviewStaffingApprovals')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
