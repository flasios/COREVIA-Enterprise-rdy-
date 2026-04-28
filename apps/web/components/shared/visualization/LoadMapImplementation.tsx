import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from 'react-i18next';
import {
  LineChart as _LineChart, Line as _Line, BarChart, Bar, AreaChart, Area, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import {
  Map, Rocket, Target, Users, Calendar, TrendingUp, CheckCircle2, AlertCircle,
  Clock, Zap, GitBranch as _GitBranch, Layers as _Layers, ArrowRight, Trophy, Sparkles, Network,
  FileSpreadsheet, FileDown, Brain, Activity, Shield, Gauge, Loader2,
  TrendingDown, DollarSign, AlertTriangle as _AlertTriangle, type LucideIcon
} from "lucide-react";
import { format, addMonths } from "date-fns";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import type { DemandReport } from "@shared/schema";

// ============================================================================
// TYPESCRIPT INTERFACES
// ============================================================================

interface PortfolioHealthResponse {
  overallHealthScore: number;
  deliveryPerformance: number;
  budgetPerformance: number;
  riskExposure: number;
  capacityUtilization: number;
  totalReports: number;
  metrics: {
    onTimeDelivery: number;
    withinBudget: number;
    lowRiskCount: number;
    mediumRiskCount: number;
    highRiskCount: number;
    criticalRiskCount: number;
    totalFTEAllocated: number;
    baselineFTECapacity: number;
  };
}

interface DemandForecastResponse {
  historical: Array<{ month: string; count: number }>;
  forecast: Array<{ month: string; forecast: number; lower95: number; upper95: number; isHistorical: boolean }>;
  statistics: {
    averageMonthlyDemands: number;
    standardDeviation: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    trendSlope: number;
    seasonality: string;
  };
}

interface MonteCarloSimulationResponse {
  simulationCount: number;
  constraints: { budgetConstraint?: number; resourceConstraint?: number; timeConstraint?: number };
  averageResults: {
    projectsSelected: number;
    totalCost: number;
    totalValue: number;
    roi: number;
    successProbability: number;
  };
  probabilityDistribution: Array<{ roiRange: string; probability: number }>;
  recommendedPortfolio: {
    projectsSelected: number;
    totalCost: number;
    totalValue: number;
    roi: number;
    successProbability: number;
  };
  successRatesByRiskLevel: Record<string, number>;
}

interface IntegrationStatusResponse {
  overallSyncHealth: number;
  demandToBusinessCasesSync: number;
  businessCaseToRequirementsSync: number;
  requirementsToStrategicFitSync: number;
  totalDemands: number;
  demandsWithBusinessCases: number;
  businessCasesWithRequirements: number;
  requirementsWithStrategicFit: number;
  orphanedRecords: {
    businessCasesWithoutDemands: number;
    requirementsWithoutBusinessCases: number;
    strategicFitsWithoutRequirements: number;
  };
}

interface RoadmapPhase {
  id: string;
  name: string;
  description: string;
  status: 'completed' | 'in-progress' | 'at-risk' | 'upcoming';
  progress: number;
  demandCount: number;
  completedCount: number;
  milestones: Milestone[];
  resources: ResourceAllocation;
  timeline: string;
  healthScore: number;
  color: string;
  icon: LucideIcon;
}

interface Milestone {
  id: string;
  name: string;
  date: string;
  status: 'completed' | 'in-progress' | 'upcoming' | 'delayed';
  criticality: 'high' | 'medium' | 'low';
  count?: number;
}

interface ResourceAllocation {
  technical: number;
  business: number;
  security: number;
  qa: number;
  total: number;
}

// ============================================================================
// CUSTOM HOOKS FOR BACKEND API
// ============================================================================

function usePortfolioHealth() {
  const query = useQuery<{ success: boolean; data: PortfolioHealthResponse }>({
    queryKey: ['/api/analytics/portfolio-health'],
    refetchInterval: 30000,
  });
  return {
    ...query,
    data: query.data?.data,
  };
}

function useDemandForecast() {
  const query = useQuery<{ success: boolean; data: DemandForecastResponse }>({
    queryKey: ['/api/analytics/demand-forecast'],
    refetchInterval: 60000,
  });
  return {
    ...query,
    data: query.data?.data,
  };
}

function useMonteCarloSimulation(constraints: { budgetConstraint: number; resourceConstraint: number }) {
  const query = useQuery<{ success: boolean; data: MonteCarloSimulationResponse }>({
    queryKey: ['/api/analytics/monte-carlo-simulation', constraints],
    refetchInterval: 60000,
  });
  return {
    ...query,
    data: query.data?.data,
  };
}

function useIntegrationStatus() {
  const query = useQuery<{ success: boolean; data: IntegrationStatusResponse }>({
    queryKey: ['/api/analytics/integration-status'],
    refetchInterval: 30000,
  });
  return {
    ...query,
    data: query.data?.data,
  };
}

const COLORS = {
  emerald: '#10b981',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  amber: '#f59e0b',
  rose: '#f43f5e',
  cyan: '#06b6d4',
  slate: '#64748b',
};

const _CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LoadMapImplementation() {
  const { t } = useTranslation();
  const [_selectedView, _setSelectedView] = useState<'roadmap' | 'timeline' | 'resources'>('roadmap');
  const [budgetConstraint, _setBudgetConstraint] = useState(50000000);
  const [resourceConstraint, _setResourceConstraint] = useState(200);

  // Fetch all analytics data
  const { data: demandsResponse } = useQuery<{ success: boolean; data: DemandReport[]; count: number }>({
    queryKey: ['/api/demand-reports'],
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const demands = demandsResponse?.data || [];

  const { data: portfolioHealth, isLoading: healthLoading } = usePortfolioHealth();
  const { data: forecastData, isLoading: forecastLoading } = useDemandForecast();
  const { data: monteCarloData, isLoading: _monteCarloLoading } = useMonteCarloSimulation({
    budgetConstraint,
    resourceConstraint,
  });
  const { data: integrationStatus, isLoading: _integrationLoading } = useIntegrationStatus();

  // ============================================================================
  // DATA-DRIVEN ROADMAP PHASES
  // ============================================================================

  const roadmapPhases = useMemo((): RoadmapPhase[] => {
    if (!demands.length || !portfolioHealth) {
      return [];
    }

    // Calculate demands by workflow status
    const byStatus = {
      draft: demands.filter(d => d.workflowStatus === 'generated'),
      submitted: demands.filter(d => d.workflowStatus === 'acknowledged'),
      'under-review': demands.filter(d => d.workflowStatus === 'under_review'),
      approved: demands.filter(d => d.workflowStatus === 'approved' || d.workflowStatus === 'manager_approved'),
      rejected: demands.filter(d => d.workflowStatus === 'rejected'),
      completed: demands.filter(d => d.completedAt),
    };

    const totalFTE = portfolioHealth.metrics.totalFTEAllocated;
    const _baselineFTE = portfolioHealth.metrics.baselineFTECapacity;

    return [
      {
        id: 'phase-1',
        name: 'Requirements & Submission',
        description: 'Initial demand capture, stakeholder alignment, and requirements gathering',
        status: byStatus.draft.length > 0 ? 'in-progress' : 'completed',
        progress: demands.length > 0 ? ((demands.length - byStatus.draft.length) / demands.length) * 100 : 0,
        demandCount: byStatus.draft.length + byStatus.submitted.length,
        completedCount: byStatus.submitted.length,
        healthScore: portfolioHealth.overallHealthScore,
        color: COLORS.emerald,
        icon: Sparkles,
        timeline: '2-4 weeks',
        resources: {
          technical: Math.round(totalFTE * 0.1),
          business: Math.round(totalFTE * 0.25),
          security: Math.round(totalFTE * 0.05),
          qa: Math.round(totalFTE * 0.05),
          total: Math.round(totalFTE * 0.45),
        },
        milestones: [
          {
            id: 'm1',
            name: 'Drafts In Progress',
            date: format(new Date(), 'MMM dd, yyyy'),
            status: byStatus.draft.length > 0 ? 'in-progress' : 'completed',
            criticality: 'medium',
            count: byStatus.draft.length
          },
          {
            id: 'm2',
            name: 'Submissions Completed',
            date: format(addMonths(new Date(), 1), 'MMM dd, yyyy'),
            status: byStatus.submitted.length > 0 ? 'in-progress' : 'upcoming',
            criticality: 'high',
            count: byStatus.submitted.length
          },
        ],
      },
      {
        id: 'phase-2',
        name: 'Review & Analysis',
        description: 'Technical evaluation, business case analysis, and stakeholder review',
        status: byStatus['under-review'].length > 0 ? 'in-progress' : 'upcoming',
        progress: byStatus['under-review'].length > 0
          ? (byStatus.approved.length / (byStatus['under-review'].length + byStatus.approved.length)) * 100
          : 0,
        demandCount: byStatus['under-review'].length,
        completedCount: byStatus.approved.length,
        healthScore: portfolioHealth.deliveryPerformance,
        color: COLORS.blue,
        icon: Brain,
        timeline: '3-6 weeks',
        resources: {
          technical: Math.round(totalFTE * 0.2),
          business: Math.round(totalFTE * 0.15),
          security: Math.round(totalFTE * 0.15),
          qa: Math.round(totalFTE * 0.1),
          total: Math.round(totalFTE * 0.6),
        },
        milestones: [
          {
            id: 'm3',
            name: 'Technical Review',
            date: format(addMonths(new Date(), 2), 'MMM dd, yyyy'),
            status: byStatus['under-review'].length > 0 ? 'in-progress' : 'upcoming',
            criticality: 'high',
            count: byStatus['under-review'].length
          },
          {
            id: 'm4',
            name: 'Business Case Analysis',
            date: format(addMonths(new Date(), 3), 'MMM dd, yyyy'),
            status: 'upcoming',
            criticality: 'high'
          },
        ],
      },
      {
        id: 'phase-3',
        name: 'Approval & Planning',
        description: 'Final approval process, budget allocation, and resource planning',
        status: byStatus.approved.length > 0 ? 'in-progress' : 'upcoming',
        progress: byStatus.approved.length > 0 ? 50 : 0,
        demandCount: byStatus.approved.length,
        completedCount: Math.floor(byStatus.approved.length * 0.5),
        healthScore: portfolioHealth.budgetPerformance,
        color: COLORS.purple,
        icon: Target,
        timeline: '2-3 weeks',
        resources: {
          technical: Math.round(totalFTE * 0.15),
          business: Math.round(totalFTE * 0.25),
          security: Math.round(totalFTE * 0.05),
          qa: Math.round(totalFTE * 0.05),
          total: Math.round(totalFTE * 0.5),
        },
        milestones: [
          {
            id: 'm5',
            name: 'Budget Approval',
            date: format(addMonths(new Date(), 4), 'MMM dd, yyyy'),
            status: byStatus.approved.length > 0 ? 'in-progress' : 'upcoming',
            criticality: 'high',
            count: byStatus.approved.length
          },
          {
            id: 'm6',
            name: 'Resource Allocation',
            date: format(addMonths(new Date(), 5), 'MMM dd, yyyy'),
            status: 'upcoming',
            criticality: 'medium'
          },
        ],
      },
      {
        id: 'phase-4',
        name: 'Implementation',
        description: 'Project execution, development, testing, and deployment',
        status: byStatus.completed.length > 0 ? 'in-progress' : 'upcoming',
        progress: demands.length > 0 ? (byStatus.completed.length / demands.length) * 100 : 0,
        demandCount: byStatus.approved.length + byStatus.completed.length,
        completedCount: byStatus.completed.length,
        healthScore: 100 - portfolioHealth.riskExposure,
        color: COLORS.amber,
        icon: Rocket,
        timeline: '8-16 weeks',
        resources: {
          technical: Math.round(totalFTE * 0.45),
          business: Math.round(totalFTE * 0.1),
          security: Math.round(totalFTE * 0.15),
          qa: Math.round(totalFTE * 0.25),
          total: Math.round(totalFTE * 0.95),
        },
        milestones: [
          {
            id: 'm7',
            name: 'Development Phase',
            date: format(addMonths(new Date(), 6), 'MMM dd, yyyy'),
            status: byStatus.completed.length > 0 ? 'in-progress' : 'upcoming',
            criticality: 'high'
          },
          {
            id: 'm8',
            name: 'UAT & Testing',
            date: format(addMonths(new Date(), 8), 'MMM dd, yyyy'),
            status: 'upcoming',
            criticality: 'high'
          },
        ],
      },
      {
        id: 'phase-5',
        name: 'Delivery & Closure',
        description: 'Final delivery, documentation, training, and project closure',
        status: byStatus.completed.length > 0 ? 'in-progress' : 'upcoming',
        progress: byStatus.completed.length > 0 ? 75 : 0,
        demandCount: byStatus.completed.length,
        completedCount: byStatus.completed.length,
        healthScore: portfolioHealth.capacityUtilization,
        color: COLORS.rose,
        icon: Trophy,
        timeline: '2-4 weeks',
        resources: {
          technical: Math.round(totalFTE * 0.1),
          business: Math.round(totalFTE * 0.2),
          security: Math.round(totalFTE * 0.05),
          qa: Math.round(totalFTE * 0.15),
          total: Math.round(totalFTE * 0.5),
        },
        milestones: [
          {
            id: 'm9',
            name: 'Production Deployment',
            date: format(addMonths(new Date(), 10), 'MMM dd, yyyy'),
            status: byStatus.completed.length > 0 ? 'in-progress' : 'upcoming',
            criticality: 'high',
            count: byStatus.completed.length
          },
          {
            id: 'm10',
            name: 'Documentation & Training',
            date: format(addMonths(new Date(), 11), 'MMM dd, yyyy'),
            status: 'upcoming',
            criticality: 'medium'
          },
        ],
      },
    ];
  }, [demands, portfolioHealth]);

  const overallProgress = useMemo(() => {
    if (roadmapPhases.length === 0) return 0;
    return roadmapPhases.reduce((sum, phase) => sum + phase.progress, 0) / roadmapPhases.length;
  }, [roadmapPhases]);

  const totalResourceAllocation = useMemo(() => {
    if (roadmapPhases.length === 0) return { technical: 0, business: 0, security: 0, qa: 0, total: 0 };
    return roadmapPhases.reduce((acc, phase) => ({
      technical: acc.technical + phase.resources.technical,
      business: acc.business + phase.resources.business,
      security: acc.security + phase.resources.security,
      qa: acc.qa + phase.resources.qa,
      total: acc.total + phase.resources.total,
    }), { technical: 0, business: 0, security: 0, qa: 0, total: 0 });
  }, [roadmapPhases]);

  // Loading state
  if (healthLoading || forecastLoading || !portfolioHealth) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="load-map-implementation">
        <div className="text-center space-y-3">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">{t('visualization.loadMap.loading')}</p>
        </div>
      </div>
    );
  }

  // Resource allocation chart data
  const resourceChartData = [
    { name: t('visualization.loadMap.technical'), value: totalResourceAllocation.technical, color: COLORS.blue },
    { name: t('visualization.loadMap.business'), value: totalResourceAllocation.business, color: COLORS.emerald },
    { name: t('visualization.loadMap.security'), value: totalResourceAllocation.security, color: COLORS.purple },
    { name: t('visualization.loadMap.qa'), value: totalResourceAllocation.qa, color: COLORS.amber },
  ];

  // Timeline data for Gantt-style view
  const timelineData = roadmapPhases.map((phase, idx) => ({
    name: phase.name,
    start: idx * 2,
    duration: 3,
    progress: phase.progress,
    color: phase.color,
  }));

  return (
    <div className="space-y-6 pb-6" data-testid="load-map-implementation">
      {/* Hero Header with Real-Time Metrics */}
      <Card className="relative overflow-hidden border-2 border-cyan-500/30 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-purple-500/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -mr-48 -mt-48" />
        <CardHeader className="relative">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg">
                <Map className="h-8 w-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                  {t('visualization.loadMap.title')}
                </CardTitle>
                <CardDescription className="text-base mt-1">
                  {t('visualization.loadMap.subtitle')}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t('visualization.loadMap.overallProgress')}</p>
                <p className="text-2xl font-bold text-cyan-600">{overallProgress?.toFixed(1)}%</p>
              </div>
              <div className="h-16 w-16 relative">
                <svg className="transform -rotate-90 w-16 h-16">
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="none" className="text-muted" />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${(overallProgress || 0) * 1.76} ${176 - (overallProgress || 0) * 1.76}`}
                    className="text-cyan-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Rocket className="h-5 w-5 text-cyan-600" />
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Real-Time Portfolio Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border border-emerald-500/20 hover-elevate">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              {t('visualization.loadMap.portfolioHealth')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">
              {portfolioHealth.overallHealthScore?.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('visualization.loadMap.realTimeHealthScore')}</p>
          </CardContent>
        </Card>

        <Card className="border border-blue-500/20 hover-elevate">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              {t('visualization.loadMap.activeDemands')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {demands.filter(d => !d.completedAt).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('visualization.loadMap.outOfTotal', { count: demands.length })}</p>
          </CardContent>
        </Card>

        <Card className="border border-purple-500/20 hover-elevate">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              {t('visualization.loadMap.resourceCapacity')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {portfolioHealth.capacityUtilization?.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('visualization.loadMap.fteRatio', { allocated: portfolioHealth.metrics.totalFTEAllocated, capacity: portfolioHealth.metrics.baselineFTECapacity })}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-amber-500/20 hover-elevate">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-500" />
              {t('visualization.loadMap.budgetPerformance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {portfolioHealth.budgetPerformance?.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('visualization.loadMap.projectsOnBudget', { count: portfolioHealth.metrics.withinBudget })}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-rose-500/20 hover-elevate">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-rose-500" />
              {t('visualization.loadMap.riskExposure')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-600">
              {portfolioHealth.riskExposure?.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('visualization.loadMap.highCritical', { count: portfolioHealth.metrics.highRiskCount + portfolioHealth.metrics.criticalRiskCount })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Roadmap Visualization */}
      <Tabs defaultValue="roadmap" className="space-y-6">
        <TabsList className="inline-flex h-auto p-1 bg-muted/50 backdrop-blur-sm rounded-xl border border-border/50">
          <TabsTrigger value="roadmap" className="gap-2" data-testid="tab-trigger-roadmap">
            <Map className="h-4 w-4" />
            {t('visualization.loadMap.visualRoadmap')}
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2" data-testid="tab-trigger-timeline">
            <Calendar className="h-4 w-4" />
            {t('visualization.loadMap.forecastTimeline')}
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-2" data-testid="tab-trigger-resources">
            <Users className="h-4 w-4" />
            {t('visualization.loadMap.resourceAnalytics')}
          </TabsTrigger>
          <TabsTrigger value="optimization" className="gap-2" data-testid="tab-trigger-optimization">
            <HexagonLogoFrame px={16} />
            {t('visualization.loadMap.portfolioOptimization')}
          </TabsTrigger>
        </TabsList>

        {/* Visual Roadmap Tab */}
        <TabsContent value="roadmap" className="space-y-6">
          <ScrollArea className="h-[600px]">
            <div className="space-y-6 pr-4">
              {roadmapPhases.map((phase, index) => {
                const Icon: LucideIcon = phase.icon;
                const statusColor =
                  phase.status === 'completed' ? 'border-emerald-500/40' :
                  phase.status === 'in-progress' ? 'border-blue-500/40' :
                  phase.status === 'at-risk' ? 'border-rose-500/40' :
                  'border-border/50';

                return (
                  <Card
                    key={phase.id}
                    className={`relative overflow-hidden border-2 transition-all duration-300 hover-elevate ${statusColor} ${
                      phase.status === 'in-progress' ? 'shadow-lg shadow-blue-500/20' : ''
                    }`}
                    data-testid={`phase-card-${phase.id}`}
                  >
                    {/* Phase Header Accent */}
                    <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: phase.color }} />

                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div
                            className="p-3 rounded-xl shadow-md"
                            style={{ backgroundColor: `${phase.color}20` }}
                          >
                            <Icon className="h-6 w-6" style={{ color: phase.color }} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <CardTitle className="text-xl">
                                Phase {index + 1}: {phase.name}
                              </CardTitle>
                              <Badge
                                variant={phase.status === 'completed' ? 'default' : phase.status === 'in-progress' ? 'default' : phase.status === 'at-risk' ? 'destructive' : 'secondary'}
                                className={
                                  phase.status === 'completed' ? 'bg-emerald-500' :
                                  phase.status === 'in-progress' ? 'bg-blue-500' :
                                  phase.status === 'at-risk' ? 'bg-rose-500' :
                                  ''
                                }
                              >
                                {phase.status.replace('-', ' ').toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {t('visualization.loadMap.demandsProgress', { completed: phase.completedCount, total: phase.demandCount })}
                              </Badge>
                            </div>
                            <CardDescription className="text-base">{phase.description}</CardDescription>

                            {/* Phase Timeline & Health */}
                            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>{phase.timeline}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Gauge className="h-4 w-4" />
                                <span>{t('visualization.loadMap.health', { score: phase.healthScore?.toFixed(0) })}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <span>{phase.resources.total} {t('visualization.loadMap.ftes')}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Progress Circle */}
                        <div className="text-center">
                          <div className="relative w-20 h-20">
                            <svg className="transform -rotate-90 w-20 h-20">
                              <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="4" fill="none" className="text-muted" />
                              <circle
                                cx="40"
                                cy="40"
                                r="36"
                                stroke={phase.color}
                                strokeWidth="4"
                                fill="none"
                                strokeDasharray={`${(phase.progress || 0) * 2.26} ${226 - (phase.progress || 0) * 2.26}`}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-lg font-bold">{phase.progress?.toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{t('visualization.loadMap.phaseProgress')}</span>
                          <span className="text-sm text-muted-foreground">{phase.progress?.toFixed(1)}%</span>
                        </div>
                        <Progress value={phase.progress} className="h-2" />
                      </div>

                      {/* Milestones */}
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          {t('visualization.loadMap.keyMilestones')}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {phase.milestones.map((milestone) => (
                            <div
                              key={milestone.id}
                              className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover-elevate"
                            >
                              {milestone.status === 'completed' ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                              ) : milestone.status === 'in-progress' ? (
                                <Zap className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5 animate-pulse" />
                              ) : milestone.status === 'delayed' ? (
                                <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
                              ) : (
                                <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{milestone.name}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <p className="text-xs text-muted-foreground">{milestone.date}</p>
                                  {milestone.count !== undefined && (
                                    <Badge variant="secondary" className="text-xs h-5">{milestone.count}</Badge>
                                  )}
                                  {milestone.criticality === 'high' && (
                                    <Badge variant="destructive" className="text-xs h-5">{t('visualization.loadMap.critical')}</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Resource Allocation */}
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {t('visualization.loadMap.resourceAllocation', { total: phase.resources.total })}
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <p className="text-2xl font-bold text-blue-600">{phase.resources.technical}</p>
                            <p className="text-xs text-muted-foreground">{t('visualization.loadMap.technical')}</p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <p className="text-2xl font-bold text-emerald-600">{phase.resources.business}</p>
                            <p className="text-xs text-muted-foreground">{t('visualization.loadMap.business')}</p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <p className="text-2xl font-bold text-purple-600">{phase.resources.security}</p>
                            <p className="text-xs text-muted-foreground">{t('visualization.loadMap.security')}</p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <p className="text-2xl font-bold text-amber-600">{phase.resources.qa}</p>
                            <p className="text-xs text-muted-foreground">{t('visualization.loadMap.qa')}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>

                    {/* Connector to Next Phase */}
                    {index < roadmapPhases.length - 1 && (
                      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 z-10">
                        <div className="flex flex-col items-center">
                          <div className="w-0.5 h-6 bg-gradient-to-b from-border to-transparent" />
                          <ArrowRight className="h-4 w-4 text-muted-foreground transform rotate-90" />
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Forecast & Timeline Tab */}
        <TabsContent value="timeline" className="space-y-6">
          {forecastData && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {t('visualization.loadMap.demandForecast')}
                  </CardTitle>
                  <CardDescription>
                    {t('visualization.loadMap.forecastDescription', { trend: forecastData.statistics.trend })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={forecastData.forecast}>
                      <defs>
                        <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="upper95"
                        stackId="1"
                        stroke="none"
                        fill={COLORS.blue}
                        fillOpacity={0.1}
                        name={t('visualization.loadMap.upperBound')}
                      />
                      <Area
                        type="monotone"
                        dataKey="forecast"
                        stackId="2"
                        stroke={COLORS.blue}
                        strokeWidth={2}
                        fill="url(#colorForecast)"
                        name={t('visualization.loadMap.forecast')}
                      />
                      <Area
                        type="monotone"
                        dataKey="lower95"
                        stackId="3"
                        stroke="none"
                        fill={COLORS.blue}
                        fillOpacity={0.1}
                        name={t('visualization.loadMap.lowerBound')}
                      />
                    </AreaChart>
                  </ResponsiveContainer>

                  {/* Forecast Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">{t('visualization.loadMap.avgMonthly')}</p>
                      <p className="text-2xl font-bold">{forecastData.statistics.averageMonthlyDemands?.toFixed(1)}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">{t('visualization.loadMap.stdDeviation')}</p>
                      <p className="text-2xl font-bold">{forecastData.statistics.standardDeviation?.toFixed(1)}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">{t('visualization.loadMap.trend')}</p>
                      <p className="text-lg font-bold capitalize flex items-center justify-center gap-1">
                        {forecastData.statistics.trend === 'increasing' && <TrendingUp className="h-4 w-4 text-emerald-500" />}
                        {forecastData.statistics.trend === 'decreasing' && <TrendingDown className="h-4 w-4 text-rose-500" />}
                        {forecastData.statistics.trend}
                      </p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">{t('visualization.loadMap.seasonality')}</p>
                      <p className="text-lg font-bold capitalize">{forecastData.statistics.seasonality.replace('_', ' ')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Gantt-Style Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {t('visualization.loadMap.phaseTimelineGantt')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={timelineData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 12 }} domain={[0, 12]} />
                      <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Bar dataKey="duration" fill={COLORS.blue}>
                        {timelineData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Resource Analytics Tab */}
        <TabsContent value="resources" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Resource Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Resource Distribution
                </CardTitle>
                <CardDescription>
                  Total Allocation: {totalResourceAllocation.total} FTEs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={resourceChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {resourceChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  {resourceChartData.map((resource) => (
                    <div key={resource.name} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: resource.color }} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{resource.name}</p>
                        <p className="text-xs text-muted-foreground">{resource.value} FTEs</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Capacity Utilization */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  Capacity Utilization
                </CardTitle>
                <CardDescription>
                  {portfolioHealth.metrics.totalFTEAllocated} / {portfolioHealth.metrics.baselineFTECapacity} FTEs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold inline-block text-cyan-600">
                        {t('visualization.loadMap.overallUtilization')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold inline-block text-cyan-600">
                        {portfolioHealth.capacityUtilization?.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <Progress value={portfolioHealth.capacityUtilization} className="h-3" />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{t('visualization.loadMap.allocatedFTEs')}</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {portfolioHealth.metrics.totalFTEAllocated}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('visualization.loadMap.currentlyAssigned')}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{t('visualization.loadMap.baselineCapacity')}</span>
                      <span className="text-2xl font-bold text-emerald-600">
                        {portfolioHealth.metrics.baselineFTECapacity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('visualization.loadMap.totalOrgCapacity')}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{t('visualization.loadMap.availableCapacity')}</span>
                      <span className="text-2xl font-bold text-purple-600">
                        {portfolioHealth.metrics.baselineFTECapacity - portfolioHealth.metrics.totalFTEAllocated}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('visualization.loadMap.remainingCapacity')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Integration Status */}
          {integrationStatus && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  {t('visualization.loadMap.integrationStatus')}
                </CardTitle>
                <CardDescription>
                  {t('visualization.loadMap.overallSyncHealth', { value: integrationStatus.overallSyncHealth?.toFixed(1) })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-2">{t('visualization.loadMap.demandToBC')}</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {integrationStatus.demandToBusinessCasesSync?.toFixed(0)}%
                    </p>
                    <Progress value={integrationStatus.demandToBusinessCasesSync} className="h-2 mt-2" />
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-2">{t('visualization.loadMap.bcToRequirements')}</p>
                    <p className="text-3xl font-bold text-emerald-600">
                      {integrationStatus.businessCaseToRequirementsSync?.toFixed(0)}%
                    </p>
                    <Progress value={integrationStatus.businessCaseToRequirementsSync} className="h-2 mt-2" />
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-2">{t('visualization.loadMap.reqToStrategicFit')}</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {integrationStatus.requirementsToStrategicFitSync?.toFixed(0)}%
                    </p>
                    <Progress value={integrationStatus.requirementsToStrategicFitSync} className="h-2 mt-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Portfolio Optimization Tab */}
        <TabsContent value="optimization" className="space-y-6">
          {monteCarloData && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HexagonLogoFrame px={20} />
                    {t('visualization.loadMap.monteCarloTitle')}
                  </CardTitle>
                  <CardDescription>
                    {t('visualization.loadMap.monteCarloDescription', { count: monteCarloData.simulationCount })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Recommended Portfolio */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <p className="text-sm text-muted-foreground mb-1">{t('visualization.loadMap.optimalProjects')}</p>
                      <p className="text-3xl font-bold text-blue-600">
                        {monteCarloData.recommendedPortfolio.projectsSelected}
                      </p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-sm text-muted-foreground mb-1">{t('visualization.loadMap.expectedROI')}</p>
                      <p className="text-3xl font-bold text-emerald-600">
                        {monteCarloData.recommendedPortfolio.roi?.toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <p className="text-sm text-muted-foreground mb-1">{t('visualization.loadMap.successRate')}</p>
                      <p className="text-3xl font-bold text-purple-600">
                        {monteCarloData.recommendedPortfolio.successProbability?.toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-sm text-muted-foreground mb-1">{t('visualization.loadMap.totalValue')}</p>
                      <p className="text-lg font-bold text-amber-600">
                        {formatCurrency(monteCarloData.recommendedPortfolio.totalValue)}
                      </p>
                    </div>
                  </div>

                  {/* ROI Probability Distribution */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3">{t('visualization.loadMap.roiDistribution')}</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={monteCarloData.probabilityDistribution}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="roiRange" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        />
                        <Bar dataKey="probability" fill={COLORS.blue} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Success Rates by Risk Level */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3">{t('visualization.loadMap.successRatesByRisk')}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(monteCarloData.successRatesByRiskLevel).map(([risk, rate]) => (
                        <div key={risk} className="text-center p-3 rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground capitalize mb-1">{t('visualization.loadMap.riskLevel', { level: risk })}</p>
                          <p className="text-2xl font-bold">
                            {(rate * 100)?.toFixed(0)}%
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Export Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-muted-foreground">
              {t('visualization.loadMap.lastUpdated', { time: format(new Date(), 'MMM dd, yyyy HH:mm') })}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                {t('visualization.loadMap.exportExcel')}
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <FileDown className="h-4 w-4" />
                {t('visualization.loadMap.exportPDF')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
