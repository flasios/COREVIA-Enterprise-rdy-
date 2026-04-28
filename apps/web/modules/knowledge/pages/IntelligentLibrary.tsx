import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, BarChart3, Grid3X3, Map, TrendingUp, FileCheck, Maximize, Minimize, BookOpen, Layers } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DemandDashboard, DemandManagementPlan } from "@/modules/demand";
import { LoadMapImplementation } from "@/components/shared/visualization";
import { ConstellationLandingLayout, GatewayCard } from "@/components/layout";

export default function IntelligentLibrary() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const openSection = searchParams.get("section");
  const demandSubmitted = searchParams.get("demandSubmitted") === "1";
  const submittedReportId = searchParams.get("reportId");
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const hasAutoOpened = useRef(false);

  const [selectedLibrary, setSelectedLibrary] = useState<string | null>(openSection === "demands" ? "demands" : null);
  const [selectedDemandSection, setSelectedDemandSection] = useState<string | null>("demand-reports");
  const [isMaximized, setIsMaximized] = useState(false);
  const [mode, setMode] = useState<"landing" | "workspace">(openSection === "demands" ? "workspace" : "landing");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(demandSubmitted);
  const [_hoveredLibrary, _setHoveredLibrary] = useState<string | null>(null);

  useEffect(() => {
    if (openSection === "demands" && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports'] });
    }
  }, [openSection, queryClient]);

  useEffect(() => {
    setShowSubmissionDialog(demandSubmitted);
    if (demandSubmitted) {
      setMode("workspace");
      setSelectedLibrary("demands");
      setSelectedDemandSection("demand-reports");
      toast({
        title: 'Demand received',
        description: 'Your request is now awaiting acknowledgment. Business Case will unlock after the demand is acknowledged.',
      });
    }
  }, [demandSubmitted, toast]);

  const dismissSubmissionDialog = () => {
    const nextParams = new URLSearchParams(searchString);
    nextParams.delete('demandSubmitted');
    nextParams.delete('reportId');
    setShowSubmissionDialog(false);
    setLocation(`/intelligent-library${nextParams.toString() ? `?${nextParams.toString()}` : ''}`);
  };

  const { data: demandStats } = useQuery({
    queryKey: ['/api/demand-reports/stats'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/demand-reports/stats");
      return response.json();
    },
  });

  const { data: knowledgeDocStats } = useQuery({
    queryKey: ['/api/knowledge/documents/stats'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/knowledge/documents/stats");
      return response.json();
    },
  });

  const { data: knowledgeInsights } = useQuery({
    queryKey: ['/api/knowledge/insights/dashboard'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/knowledge/insights/dashboard");
      return response.json();
    },
  });

  const { data: knowledgeBriefings } = useQuery({
    queryKey: ['/api/knowledge/briefings', 'stats'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/knowledge/briefings?limit=1&offset=0");
      return response.json();
    },
  });

  const knowledgeStats = knowledgeDocStats?.data ?? {};
  const totalDocuments = Number(knowledgeStats.total ?? 0);
  const statusCounts = knowledgeStats.statusCounts ?? {};
  const processedDocuments = Number(statusCounts.completed ?? 0);
  const pendingDocuments = Number(statusCounts.pending ?? 0) + Number(statusCounts.processing ?? 0);
  const categoryCounts = knowledgeStats.categoryCounts ?? {};
  const collectionsCount = Object.values(categoryCounts).filter((count) => Number(count) > 0).length;
  const lastUploadLabel = knowledgeStats.latestUpload
    ? formatDistanceToNowStrict(new Date(knowledgeStats.latestUpload), { addSuffix: true })
    : t('knowledge.intelligentLibrary.noUploads');
  const demandTotal = Number(demandStats?.total ?? 0);
  const demandPendingApproval = Number(demandStats?.pendingApproval ?? 0);
  const briefingsTotal = Number(knowledgeBriefings?.data?.total ?? 0);
  const insightsTotal = Number(knowledgeInsights?.data?.recentInsights?.length ?? 0);
  const activeAlertsTotal = Number(knowledgeInsights?.data?.activeAlerts?.length ?? 0);

  const handleLibrarySelect = (libraryId: string, isActive: boolean) => {
    if (!isActive) return;

    setIsTransitioning(true);
    setSelectedLibrary(libraryId);

    setTimeout(() => {
      setMode("workspace");
      setTimeout(() => setIsTransitioning(false), 300);
    }, 400);
  };

  const handleReturnToConstellation = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setMode("landing");
      setTimeout(() => setIsTransitioning(false), 300);
    }, 300);
  };

  const libraries = [
    {
      id: "demands",
      title: t('knowledge.intelligentLibrary.demands'),
      subtitle: t('knowledge.intelligentLibrary.demandsSubtitle'),
      description: t('knowledge.intelligentLibrary.demandsDesc'),
      icon: <TrendingUp className="h-5 w-5" />,
      count: demandTotal.toLocaleString(),
      stats: [
        { label: t('knowledge.intelligentLibrary.requests'), value: demandTotal.toLocaleString() },
        { label: t('knowledge.intelligentLibrary.pending'), value: demandPendingApproval.toLocaleString() },
      ],
      isActive: true
    },
    {
      id: "assessments",
      title: t('knowledge.intelligentLibrary.assessments'),
      subtitle: t('knowledge.intelligentLibrary.assessmentsSubtitle'),
      description: t('knowledge.intelligentLibrary.assessmentsDesc'),
      icon: <FileCheck className="h-5 w-5" />,
      count: briefingsTotal.toLocaleString(),
      stats: [
        { label: t('knowledge.intelligentLibrary.briefings'), value: briefingsTotal.toLocaleString() },
        { label: t('knowledge.intelligentLibrary.alerts'), value: activeAlertsTotal.toLocaleString() },
      ],
      isActive: false
    },
    {
      id: "external-reports",
      title: t('knowledge.intelligentLibrary.externalReports'),
      subtitle: t('knowledge.intelligentLibrary.externalReportsSubtitle'),
      description: t('knowledge.intelligentLibrary.externalReportsDesc'),
      icon: <FileText className="h-5 w-5" />,
      count: totalDocuments.toLocaleString(),
      stats: [
        { label: t('knowledge.intelligentLibrary.documents'), value: totalDocuments.toLocaleString() },
        { label: t('knowledge.intelligentLibrary.processed'), value: processedDocuments.toLocaleString() },
      ],
      isActive: false
    },
    {
      id: "insights",
      title: t('knowledge.intelligentLibrary.insights'),
      subtitle: t('knowledge.intelligentLibrary.insightsSubtitle'),
      description: t('knowledge.intelligentLibrary.insightsDesc'),
      icon: <BarChart3 className="h-5 w-5" />,
      count: insightsTotal.toLocaleString(),
      stats: [
        { label: t('knowledge.intelligentLibrary.insightsLabel'), value: insightsTotal.toLocaleString() },
        { label: t('knowledge.intelligentLibrary.pending'), value: pendingDocuments.toLocaleString() },
      ],
      isActive: false
    }
  ];

  const demandSections = [
    {
      id: "overall-status",
      title: t('knowledge.intelligentLibrary.overallStatus'),
      description: t('knowledge.intelligentLibrary.overallStatusDesc'),
      icon: <BarChart3 className="h-5 w-5" />,
      color: "bg-indigo-500",
      metrics: { label: t('knowledge.intelligentLibrary.statusReports'), value: String(demandTotal), status: demandTotal > 0 ? t('knowledge.intelligentLibrary.updatedToday') : t('knowledge.intelligentLibrary.noData', { defaultValue: 'No data yet' }) }
    },
    {
      id: "demand-reports",
      title: t('knowledge.intelligentLibrary.demandReports'),
      description: t('knowledge.intelligentLibrary.demandReportsDesc'),
      icon: <FileText className="h-5 w-5" />,
      color: "bg-amber-600",
      metrics: { label: t('knowledge.intelligentLibrary.reports'), value: String(demandTotal), status: Number(demandStats?.createdThisMonth ?? 0) > 0 ? t('knowledge.intelligentLibrary.newThisWeek', { count: Number(demandStats?.createdThisMonth ?? 0) }) : t('knowledge.intelligentLibrary.noData', { defaultValue: 'No data yet' }) }
    },
    {
      id: "demand-management-plan",
      title: t('knowledge.intelligentLibrary.demandManagementPlan'),
      description: t('knowledge.intelligentLibrary.demandManagementPlanDesc'),
      icon: <Grid3X3 className="h-5 w-5" />,
      color: "bg-indigo-600",
      metrics: { label: t('knowledge.intelligentLibrary.activePlans'), value: String(demandTotal), status: Number(demandStats?.priorityHigh ?? 0) + Number(demandStats?.priorityCritical ?? 0) > 0 ? t('knowledge.intelligentLibrary.highPriority', { count: Number(demandStats?.priorityHigh ?? 0) + Number(demandStats?.priorityCritical ?? 0) }) : t('knowledge.intelligentLibrary.noData', { defaultValue: 'No data yet' }) }
    },
    {
      id: "load-map-implementation",
      title: t('knowledge.intelligentLibrary.loadMapImplementation'),
      description: t('knowledge.intelligentLibrary.loadMapImplementationDesc'),
      icon: <Map className="h-5 w-5" />,
      color: "bg-amber-500",
      metrics: { label: t('knowledge.intelligentLibrary.implementations'), value: String(Number(demandStats?.converted ?? 0)), status: Number(demandStats?.inReview ?? 0) > 0 ? t('knowledge.intelligentLibrary.inProgress', { count: Number(demandStats?.inReview ?? 0) }) : t('knowledge.intelligentLibrary.noData', { defaultValue: 'No data yet' }) }
    }
  ];

  // Knowledge Nexus landing view - Unified cards
  if (mode === "landing") {
    const accentColors = ['indigo', 'emerald', 'blue', 'amber'] as const;

    return (
      <ConstellationLandingLayout
        title={t('knowledge.intelligentLibrary.intelligentLibraryGateway')}
        icon={<BookOpen className="h-4 w-4 text-white" />}
        accentColor="amber"
        testId="gateway-intelligent-library"
      >
        <div className={`w-full max-w-5xl px-8 transition-all duration-500 ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
          {/* Central Title */}
          <div className="text-center mb-10">
            <h1 className="text-4xl font-light tracking-tight">
              <span className="font-bold bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 dark:from-amber-300 dark:via-orange-400 dark:to-amber-300 bg-clip-text text-transparent">{t('knowledge.intelligentLibrary.intelligentLibraryGateway')}</span>
            </h1>
            <p className="text-amber-800/70 dark:text-amber-200/60 mt-3 text-lg">{t('knowledge.intelligentLibrary.landingSubtitle')}</p>
          </div>

          {/* Unified Library Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {libraries.map((library, index) => (
              <GatewayCard
                key={library.id}
                title={library.title}
                description={library.description}
                icon={library.icon}
                accentColor={accentColors[index % accentColors.length]!}
                isActive={library.isActive}
                onClick={() => handleLibrarySelect(library.id, library.isActive)}
                stats={library.stats || [{ label: t('knowledge.intelligentLibrary.records'), value: library.count }]}
                testId={`landing-library-${library.id}`}
              />
            ))}
          </div>

          {/* Bottom metadata */}
          <div className="mt-10 flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
              <span>{totalDocuments.toLocaleString()} {t('knowledge.intelligentLibrary.documents')}</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" style={{animationDelay: '0.5s'}} />
              <span>{collectionsCount.toLocaleString()} {t('knowledge.intelligentLibrary.collections')}</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" style={{animationDelay: '1s'}} />
              <span>{t('knowledge.intelligentLibrary.lastUpload')} {lastUploadLabel}</span>
            </div>
          </div>
        </div>
      </ConstellationLandingLayout>
    );
  }

  // Workspace mode - when a library is selected
  const currentSection = demandSections.find(s => s.id === selectedDemandSection);

  // Fullscreen mode
  if (isMaximized && selectedLibrary === "demands" && selectedDemandSection) {
    return (
      <div className="h-screen bg-background constellation-grid relative overflow-hidden">
        <div className="relative z-10 h-full flex flex-col">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0 p-4 pb-3">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg ${currentSection?.color} flex items-center justify-center text-white float-animation`}>
                  {currentSection?.icon}
                </div>
                <div>
                  <h3 className="text-lg font-bold">{currentSection?.title}</h3>
                  <p className="text-xs text-muted-foreground">{currentSection?.description}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsMaximized(false)} className="gap-2" data-testid="button-minimize">
                <Minimize className="h-4 w-4" />
                {t('knowledge.intelligentLibrary.minimize')}
              </Button>
            </div>

            <div className="flex-1 min-h-0 px-4 pb-4 overflow-y-auto">
              {selectedDemandSection === "demand-reports" ? (
                <DemandDashboard />
              ) : selectedDemandSection === "demand-management-plan" ? (
                <DemandManagementPlan />
              ) : selectedDemandSection === "load-map-implementation" ? (
                <LoadMapImplementation />
              ) : selectedDemandSection === "overall-status" ? (
                <DemandDashboard />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>{t('knowledge.intelligentLibrary.selectSection')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Regular workspace view
  return (
    <div className={`h-screen bg-gradient-to-b from-slate-50 via-stone-50/50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden transition-all duration-500 ${isTransitioning ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}>
      <Dialog open={showSubmissionDialog} onOpenChange={(open) => {
        setShowSubmissionDialog(open);
        if (!open) dismissSubmissionDialog();
      }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Demand submitted for acknowledgment</DialogTitle>
            <DialogDescription>
              COREVIA recorded your demand intake and routed it into the governance queue. The next step is acknowledgment and notification, not Business Case generation.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">What happens next</p>
            <p className="mt-2">An acknowledgment owner will review the intake, confirm SLA expectations, and notify you when downstream analysis is unlocked.</p>
            <p className="mt-2">Business Case, Requirements, EA, and Strategic Fit stay locked until that acknowledgment is recorded.</p>
            {submittedReportId ? (
              <p className="mt-2 text-xs">Reference demand: {submittedReportId}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={dismissSubmissionDialog}>Open demand library</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="w-full max-w-none px-4 sm:px-6 relative z-10 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-end justify-between flex-shrink-0 mb-4 gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={handleReturnToConstellation}
                data-testid="button-back-constellation"
              >
                <Layers className="h-3.5 w-3.5" />
                {t('knowledge.intelligentLibrary.library')}
              </Button>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
                {libraries.find(l => l.id === selectedLibrary)?.title}
                <span className="font-light text-slate-500 dark:text-slate-400"> {t('knowledge.intelligentLibrary.collection')}</span>
              </h1>
              <p className="text-xs text-muted-foreground">{libraries.find(l => l.id === selectedLibrary)?.description}</p>
            </div>
          </div>

          {/* Section Tabs - Right Side */}
          {selectedLibrary === "demands" && (
            <div className="flex items-center gap-2 flex-wrap justify-end" data-testid="demand-section-tabs">
              {demandSections.map((section) => (
                <button
                  key={section.id}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                    selectedDemandSection === section.id
                      ? `${section.color} text-white shadow-lg`
                      : 'bg-white/60 dark:bg-slate-800/60 text-muted-foreground hover:bg-white dark:hover:bg-slate-800 hover:text-foreground border border-transparent hover:border-border'
                  }`}
                  onClick={() => setSelectedDemandSection(section.id)}
                  data-testid={`tab-demand-section-${section.id}`}
                >
                  {section.icon}
                  <span>{section.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Line Separator */}
        <div className="h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600 to-transparent mb-4" />

        {/* Content */}
        {selectedLibrary === "demands" ? (
          <div className="flex-1 flex flex-col min-h-0">

            {/* Section Content */}
            <div className="flex-1 min-h-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden shadow-sm">
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between flex-shrink-0 p-4 border-b border-slate-200/50 dark:border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg ${currentSection?.color} flex items-center justify-center text-white`}>
                      {currentSection?.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{currentSection?.title}</h3>
                      <p className="text-xs text-muted-foreground">{currentSection?.description}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsMaximized(true)} className="gap-2" data-testid="button-maximize">
                    <Maximize className="h-4 w-4" />
                    {t('knowledge.intelligentLibrary.maximize')}
                  </Button>
                </div>

                <div className="flex-1 min-h-0 p-4 overflow-y-auto">
                  {selectedDemandSection === "demand-reports" ? (
                    <DemandDashboard />
                  ) : selectedDemandSection === "demand-management-plan" ? (
                    <DemandManagementPlan />
                  ) : selectedDemandSection === "load-map-implementation" ? (
                    <LoadMapImplementation />
                  ) : selectedDemandSection === "overall-status" ? (
                    <DemandDashboard />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>{t('knowledge.intelligentLibrary.selectSection')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="h-20 w-20 rounded-xl bg-gradient-to-br from-indigo-100 to-amber-100 dark:from-indigo-900/30 dark:to-amber-900/30 flex items-center justify-center mx-auto">
                {libraries.find(lib => lib.id === selectedLibrary)?.icon || <FileText className="h-10 w-10 text-indigo-400/60" />}
              </div>
              <div>
                <h3 className="font-semibold text-xl text-slate-600 dark:text-slate-300">
                  {libraries.find(lib => lib.id === selectedLibrary)?.title} {t('knowledge.intelligentLibrary.collection')}
                </h3>
                <p className="text-muted-foreground">{t('knowledge.intelligentLibrary.comingSoon')}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
