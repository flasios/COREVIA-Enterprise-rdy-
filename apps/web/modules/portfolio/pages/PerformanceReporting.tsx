import { useEffect, useMemo, useState } from "react";
import { useTranslation } from 'react-i18next';
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactNumber, formatCurrency, formatNumber } from "@/modules/demand";
import {
  ArrowLeft,
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Layers,
  LineChart,
  Plus,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import {
  STORAGE_KEY,
  periodMonths,
  dataSourceOptions,
  buildId,
  buildPeriodLabel,
  buildPeriodRange,
  formatDate,
} from "./performanceReporting.data";

type SaveFilePickerHandle = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type WindowWithSavePicker = Window & typeof globalThis & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<SaveFilePickerHandle>;
};

async function saveExportBlob(blob: Blob, filename: string, format: "pdf" | "pptx"): Promise<void> {
  const pickerWindow = window as WindowWithSavePicker;
  const mimeType = format === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.presentationml.presentation";

  if (typeof pickerWindow.showSaveFilePicker === "function") {
    const handle = await pickerWindow.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: format.toUpperCase(),
          accept: { [mimeType]: [`.${format}`] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  if (typeof navigator.canShare === "function" && typeof navigator.share === "function") {
    const file = new File([blob], filename, { type: mimeType });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
  }

  throw new Error("File save is not supported in this browser");
}
import type {
  DemandStats,
  PipelineResponse,
  ConversionRequest,
  PortfolioSummary,
  PortfolioStats,
  GateApproval,
  WbsApproval,
  ChangeRequest,
  ComplianceRule,
  PortfolioProject,
  ReportingMetric,
  ReportingWidget,
  DashboardConfig,
} from "./performanceReporting.data";

export default function PerformanceReporting() {
  const { t } = useTranslation();
  const now = new Date();
  const [dashboardName, setDashboardName] = useState("Executive Performance Report");
  const [periodType, setPeriodType] = useState<"monthly" | "quarterly" | "annual">("monthly");
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth());
  const [periodQuarter, setPeriodQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>(["demand-snapshot", "portfolio-health"]);
  const [dataSources, setDataSources] = useState<string[]>(dataSourceOptions.map((source) => source.id));
  const [savedDashboards, setSavedDashboards] = useState<DashboardConfig[]>([]);
  const [activeDashboardId, setActiveDashboardId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "pptx" | null>(null);

  const { data: demandStats } = useQuery<DemandStats>({
    queryKey: ["/api/demand-reports/stats"],
  });

  const { data: pipelineData } = useQuery<PipelineResponse>({
    queryKey: ["/api/portfolio/pipeline"],
  });

  const { data: conversionRequestsData } = useQuery<{ success: boolean; requests: ConversionRequest[] }>({
    queryKey: ["/api/demand-conversion-requests"],
  });

  const { data: portfolioSummary } = useQuery<{ success: boolean; data: PortfolioSummary }>({
    queryKey: ["/api/portfolio/summary"],
  });

  const { data: portfolioStats } = useQuery<{ success: boolean; data: PortfolioStats }>({
    queryKey: ["/api/portfolio/stats"],
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

  const { data: complianceData } = useQuery<{ success: boolean; data: ComplianceRule[] }>({
    queryKey: ["/api/compliance/rules"],
  });

  const { data: projectData } = useQuery<{ success: boolean; data: PortfolioProject[] }>({
    queryKey: ["/api/portfolio/projects"],
  });

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as DashboardConfig[];
      setSavedDashboards(parsed);
    } catch (error) {
      console.error("Failed to parse saved dashboards", error);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedDashboards));
  }, [savedDashboards]);

  const pipelineItems = useMemo(() => pipelineData?.data || [], [pipelineData]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const conversionRequests = conversionRequestsData?.requests || [];
  const summary = portfolioSummary?.data;
  const stats = portfolioStats?.data;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const complianceRules = complianceData?.data || [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const projects = projectData?.data || [];

  const pipelineUrgency = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    pipelineItems.forEach((item) => {
      const urgency = String(item.urgency || "medium").toLowerCase();
      if (urgency.includes("high")) counts.high += 1;
      else if (urgency.includes("low")) counts.low += 1;
      else counts.medium += 1;
    });
    return counts;
  }, [pipelineItems]);

  const pipelineVelocity = useMemo(() => {
    const nowTime = Date.now();
    return pipelineItems.filter((item) => {
      const created = new Date(item.createdAt).getTime();
      if (Number.isNaN(created)) return false;
      return nowTime - created <= 1000 * 60 * 60 * 24 * 30;
    }).length;
  }, [pipelineItems]);

  const approvalWorkload = useMemo(() => {
    return {
      wbs: wbsApprovalsData?.data?.length || 0,
      gates: gateApprovalsData?.data?.length || 0,
      changes: (changeRequestsData?.data || []).filter((item) =>
        ["pending", "submitted", "under_review"].includes(String(item.status || ""))
      ).length,
    };
  }, [wbsApprovalsData, gateApprovalsData, changeRequestsData]);

  const complianceSummary = useMemo(() => {
    const published = complianceRules.filter((rule) => rule.status === "published").length;
    const critical = complianceRules.filter((rule) => rule.severity === "critical").length;
    const high = complianceRules.filter((rule) => rule.severity === "high").length;
    return { published, critical, high, total: complianceRules.length };
  }, [complianceRules]);

  const resourceSummary = useMemo(() => {
    const totalFte = projects.reduce((sum, project) => {
      const raw = project.allocatedFTE ?? 0;
      const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
    const projectsWithFte = projects.filter((project) => {
      const raw = project.allocatedFTE ?? 0;
      const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
      return Number.isFinite(value) && value > 0;
    }).length;
    const coverage = projects.length > 0 ? Math.round((projectsWithFte / projects.length) * 100) : 0;
    return { totalFte, coverage };
  }, [projects]);

  const availableWidgets = useMemo<ReportingWidget[]>(() => {
    return [
      {
        id: "demand-snapshot",
        title: t('portfolio_pages.demandIntakeSnapshot'),
        description: t('portfolio_pages.demandIntakeSnapshotDescription'),
        metrics: [
          { label: t('portfolio_pages.totalDemand'), value: demandStats?.total ?? 0 },
          { label: t('portfolio_pages.pendingReview'), value: demandStats?.pending ?? 0 },
          { label: t('app.approved'), value: demandStats?.approved ?? 0 },
        ],
      },
      {
        id: "pipeline-velocity",
        title: t('portfolio_pages.pipelineVelocity'),
        description: t('portfolio_pages.pipelineVelocityDescription'),
        metrics: [
          { label: t('portfolio_pages.activePipeline'), value: pipelineItems.length },
          { label: t('portfolio_pages.newIntake30d'), value: pipelineVelocity },
          { label: t('portfolio_pages.highUrgency'), value: pipelineUrgency.high },
        ],
      },
      {
        id: "conversion-queue",
        title: t('portfolio_pages.conversionQueue'),
        description: t('portfolio_pages.conversionQueueDescription'),
        metrics: [
          { label: t('portfolio_pages.requestsInQueue'), value: conversionRequests.length },
          { label: t('task.highPriority'), value: conversionRequests.filter((item) => String(item.priority || "").toLowerCase().includes("high")).length },
          { label: t('app.pending'), value: conversionRequests.filter((item) => ["pending", "under_review"].includes(item.status)).length },
        ],
      },
      {
        id: "portfolio-health",
        title: t('portfolio_pages.portfolioHealth'),
        description: t('portfolio_pages.portfolioHealthDescription'),
        metrics: [
          { label: t('portfolio_pages.totalProjects'), value: summary?.totalProjects ?? 0 },
          { label: t('portfolio_pages.onTrack'), value: summary?.byHealth?.on_track ?? 0 },
          { label: t('portfolio_pages.atRisk'), value: summary?.byHealth?.at_risk ?? 0 },
          { label: t('portfolio_pages.critical'), value: summary?.byHealth?.critical ?? 0 },
          { label: t('portfolio_pages.avgProgress'), value: `${Math.round(summary?.avgProgress ?? 0)}%` },
        ],
      },
      {
        id: "approval-workload",
        title: t('portfolio_pages.approvalWorkload'),
        description: t('portfolio_pages.approvalWorkloadDescription'),
        metrics: [
          { label: t('portfolio_pages.wbsApprovals'), value: approvalWorkload.wbs },
          { label: t('portfolio_pages.gateChecks'), value: approvalWorkload.gates },
          { label: t('changeRequest.changeRequests'), value: approvalWorkload.changes },
        ],
      },
      {
        id: "compliance-coverage",
        title: t('portfolio_pages.complianceCoverage'),
        description: t('portfolio_pages.complianceCoverageDescription'),
        metrics: [
          { label: t('portfolio_pages.publishedControls'), value: complianceSummary.published },
          { label: t('portfolio_pages.criticalRules'), value: complianceSummary.critical },
          { label: t('portfolio_pages.highSeverity'), value: complianceSummary.high },
        ],
      },
      {
        id: "resource-allocation",
        title: t('portfolio_pages.resourceAllocation'),
        description: t('portfolio_pages.resourceAllocationDescription'),
        metrics: [
          { label: t('portfolio_pages.allocatedFTE'), value: formatNumber(resourceSummary.totalFte, 1) },
          { label: t('portfolio_pages.coverage'), value: `${resourceSummary.coverage}%` },
          { label: t('portfolio_pages.utilization'), value: `${Math.round(stats?.utilizationRate ?? 0)}%` },
        ],
      },
    ];
  }, [
    demandStats,
    pipelineItems,
    pipelineVelocity,
    pipelineUrgency,
    conversionRequests,
    summary,
    approvalWorkload,
    complianceSummary,
    resourceSummary,
    stats?.utilizationRate,
    t,
  ]);

  const selectedWidgetDetails = useMemo(() => {
    return selectedWidgets
      .map((id) => availableWidgets.find((widget) => widget.id === id))
      .filter(Boolean) as ReportingWidget[];
  }, [selectedWidgets, availableWidgets]);

  const summaryMetrics = useMemo<ReportingMetric[]>(() => {
    return [
      { label: t('portfolio_pages.activeProjects'), value: stats?.activeProjects ?? 0 },
      { label: t('portfolio_pages.portfolioUtilization'), value: `${Math.round(stats?.utilizationRate ?? 0)}%` },
      { label: t('portfolio_pages.totalBudget'), value: formatCompactNumber(summary?.totalBudget ?? 0) },
      { label: t('portfolio_pages.totalSpend'), value: formatCompactNumber(summary?.totalSpend ?? 0) },
      { label: t('portfolio_pages.pipelineVolume'), value: pipelineItems.length },
      { label: t('portfolio_pages.demandPending'), value: demandStats?.pending ?? 0 },
    ];
  }, [stats, summary, pipelineItems.length, demandStats, t]);

  const periodLabel = buildPeriodLabel(periodType, periodYear, periodMonth, periodQuarter);
  const periodRange = buildPeriodRange(periodType, periodYear, periodMonth, periodQuarter);

  const toggleWidget = (id: string) => {
    setSelectedWidgets((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleDataSource = (id: string) => {
    setDataSources((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const saveDashboard = () => {
    const config: DashboardConfig = {
      id: activeDashboardId ?? buildId(),
      name: dashboardName.trim() || t('portfolio_pages.performanceDashboard'),
      widgets: selectedWidgets,
      periodType,
      periodYear,
      periodMonth,
      periodQuarter,
      dataSources,
    };

    setSavedDashboards((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === config.id);
      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex] = config;
        return copy;
      }
      return [config, ...prev];
    });
    setActiveDashboardId(config.id);
  };

  const loadDashboard = (config: DashboardConfig) => {
    setDashboardName(config.name);
    setSelectedWidgets(config.widgets);
    setPeriodType(config.periodType);
    setPeriodYear(config.periodYear);
    setPeriodMonth(config.periodMonth);
    setPeriodQuarter(config.periodQuarter);
    setDataSources(config.dataSources);
    setActiveDashboardId(config.id);
  };

  const createNewDashboard = () => {
    setActiveDashboardId(null);
    setDashboardName(t('portfolio_pages.executivePerformanceReport'));
    setSelectedWidgets(["demand-snapshot", "portfolio-health"]);
  };

  const handleExport = async (format: "pdf" | "pptx") => {
    if (selectedWidgetDetails.length === 0) return;
    setExporting(format);
    try {
      const response = await fetch("/api/reporting/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: dashboardName,
          periodLabel,
          periodStart: formatDate(periodRange.start),
          periodEnd: formatDate(periodRange.end),
          summary: summaryMetrics,
          widgets: selectedWidgetDetails,
          format,
        }),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const safeFilename = `${dashboardName.replace(/[^a-zA-Z0-9]/g, "_")}_${periodLabel.replace(/\s+/g, "-")}.${format}`;
      await saveExportBlob(blob, safeFilename, format);
    } catch (error) {
      console.error("Export failed", error);
    } finally {
      setExporting(null);
    }
  };

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
              <div className="text-sm font-semibold">{t('portfolio_pages.performanceReportingCommand')}</div>
              <div className="text-xs text-muted-foreground">{t('portfolio_pages.performanceReportingSubtitle')}</div>
            </div>
          </div>
          <Badge className="bg-slate-900/10 text-slate-700 border-slate-900/20">
            <Sparkles className="h-3 w-3 mr-1" />
            {t('portfolio_pages.reportingAgentReady')}
          </Badge>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-slate-200/60 bg-white/85">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="h-5 w-5 text-slate-700" />
                {t('portfolio_pages.dashboardBuilder')}
              </CardTitle>
              <CardDescription>{t('portfolio_pages.dashboardBuilderDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">{t('portfolio_pages.dashboardTitle')}</label>
                <input
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={dashboardName}
                  onChange={(event) => setDashboardName(event.target.value)}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">{t('portfolio_pages.periodType')}</label>
                  <select
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={periodType}
                    onChange={(event) => setPeriodType(event.target.value as "monthly" | "quarterly" | "annual")}
                  >
                    <option value="monthly">{t('portfolio_pages.monthly')}</option>
                    <option value="quarterly">{t('portfolio_pages.quarterly')}</option>
                    <option value="annual">{t('portfolio_pages.annual')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">{t('portfolio_pages.year')}</label>
                  <select
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={periodYear}
                    onChange={(event) => setPeriodYear(Number(event.target.value))}
                  >
                    {Array.from({ length: 5 }, (_, idx) => now.getFullYear() - 2 + idx).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                {periodType === "monthly" ? (
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs text-muted-foreground">{t('portfolio_pages.month')}</label>
                    <select
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={periodMonth}
                      onChange={(event) => setPeriodMonth(Number(event.target.value))}
                    >
                      {periodMonths.map((month, index) => (
                        <option key={month} value={index}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {periodType === "quarterly" ? (
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs text-muted-foreground">{t('portfolio_pages.quarter')}</label>
                    <select
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={periodQuarter}
                      onChange={(event) => setPeriodQuarter(Number(event.target.value))}
                    >
                      {[1, 2, 3, 4].map((quarter) => (
                        <option key={quarter} value={quarter}>
                          Q{quarter}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-muted-foreground flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-slate-500" />
                  {t('portfolio_pages.reportingWindow')}: {formatDate(periodRange.start)} to {formatDate(periodRange.end)}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">{t('portfolio_pages.dataSources')}</div>
                <div className="flex flex-wrap gap-2">
                  {dataSourceOptions.map((source) => (
                    <Button
                      key={source.id}
                      size="sm"
                      variant={dataSources.includes(source.id) ? "secondary" : "outline"}
                      className="h-7"
                      onClick={() => toggleDataSource(source.id)}
                    >
                      {source.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">{t('portfolio_pages.widgetLibrary')}</div>
                  <Badge className="bg-slate-900/10 text-slate-700 border-slate-900/20">
                    {selectedWidgets.length} {t('app.selected')}
                  </Badge>
                </div>
                <div className="grid gap-2">
                  {availableWidgets.map((widget) => (
                    <div key={widget.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white/80 p-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{widget.title}</div>
                        <div className="text-xs text-muted-foreground">{widget.description}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => toggleWidget(widget.id)}>
                        {selectedWidgets.includes(widget.id) ? t('app.remove') : t('app.add')}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={saveDashboard} className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {t('portfolio_pages.saveDashboard')}
                </Button>
                <Button variant="outline" onClick={createNewDashboard}>
                  {t('portfolio_pages.newDashboard')}
                </Button>
              </div>

              {savedDashboards.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">{t('portfolio_pages.savedDashboards')}</div>
                  <div className="grid gap-2">
                    {savedDashboards.map((dashboard) => (
                      <button
                        key={dashboard.id}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                          dashboard.id === activeDashboardId ? "border-slate-400 bg-slate-50" : "border-slate-200 bg-white"
                        }`}
                        onClick={() => loadDashboard(dashboard)}
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{dashboard.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {buildPeriodLabel(dashboard.periodType, dashboard.periodYear, dashboard.periodMonth, dashboard.periodQuarter)} · {dashboard.widgets.length} {t('portfolio_pages.widgets')}
                          </div>
                        </div>
                        <Plus className="h-4 w-4 text-slate-400" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-slate-200/60 bg-white/85">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-slate-700" />
                {t('portfolio_pages.dashboardPreview')}
              </CardTitle>
              <CardDescription>{t('portfolio_pages.dashboardPreviewDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {summaryMetrics.map((metric) => (
                    <div key={metric.label} className="rounded-lg border border-slate-200 bg-white/70 p-3">
                      <div className="text-xs text-muted-foreground">{metric.label}</div>
                      <div className="text-lg font-semibold text-slate-900">{metric.value}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-slate-900/10 text-slate-700 border-slate-900/20">
                    {periodLabel}
                  </Badge>
                  <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20">
                    {formatCurrency(summary?.totalBudget ?? 0, "AED", true)} {t('portfolio_pages.budget')}
                  </Badge>
                  <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                    {formatNumber(resourceSummary.totalFte, 1)} {t('portfolio_pages.fte')}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/60 bg-white/85">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-slate-700" />
                {t('portfolio_pages.selectedWidgets')}
              </CardTitle>
              <CardDescription>{t('portfolio_pages.selectedWidgetsDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedWidgetDetails.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{t('portfolio_pages.noWidgetsSelected')}</div>
                ) : (
                  selectedWidgetDetails.map((widget) => (
                    <div key={widget.id} className="rounded-lg border border-slate-200 bg-white/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{widget.title}</div>
                          <div className="text-xs text-muted-foreground">{widget.description}</div>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => toggleWidget(widget.id)}>
                          <Trash2 className="h-4 w-4 text-slate-400" />
                        </Button>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {widget.metrics.map((metric) => (
                          <div key={metric.label} className="rounded-md border border-slate-200 bg-white/80 px-3 py-2 text-xs">
                            <div className="text-[11px] text-muted-foreground">{metric.label}</div>
                            <div className="text-sm font-semibold text-slate-900">{metric.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200/60 bg-white/85">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-700" />
                {t('portfolio_pages.exportReportingPackage')}
              </CardTitle>
              <CardDescription>{t('portfolio_pages.exportReportingPackageDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full gap-2"
                  onClick={() => handleExport("pptx")}
                  disabled={exporting !== null || selectedWidgetDetails.length === 0}
                >
                  <Download className="h-4 w-4" />
                  {exporting === "pptx" ? t('portfolio_pages.generatingPowerPoint') : t('portfolio_pages.generatePowerPointDeck')}
                </Button>
                <Button
                  className="w-full gap-2"
                  variant="secondary"
                  onClick={() => handleExport("pdf")}
                  disabled={exporting !== null || selectedWidgetDetails.length === 0}
                >
                  <Download className="h-4 w-4" />
                  {exporting === "pdf" ? t('portfolio_pages.generatingPDF') : t('portfolio_pages.generatePDFReport')}
                </Button>
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs text-muted-foreground">
                  {t('portfolio_pages.reportsInclude', { periodLabel })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          {[
            { title: t('portfolio_pages.portfolioUtilization'), value: `${Math.round(stats?.utilizationRate ?? 0)}%`, icon: Target },
            { title: t('portfolio_pages.onTrackProjects'), value: summary?.byHealth?.on_track ?? 0, icon: CheckCircle2 },
            { title: t('portfolio_pages.pipelineVolume'), value: pipelineItems.length, icon: Layers },
            { title: t('portfolio_pages.complianceControls'), value: complianceSummary.total, icon: ClipboardCheck },
          ].map((card) => (
            <Card key={card.title} className="border-slate-200/60 bg-white/85">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{card.title}</span>
                  <card.icon className="h-4 w-4 text-slate-600" />
                </div>
                <div className="text-2xl font-semibold text-slate-900">{card.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
