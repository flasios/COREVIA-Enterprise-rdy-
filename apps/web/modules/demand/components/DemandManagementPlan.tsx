import { useState, useMemo, useCallback } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, FunnelChart, Funnel,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  RadialBarChart as _RadialBarChart, RadialBar as _RadialBar, ComposedChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Target, Clock, CheckCircle, AlertTriangle,
  Download as _Download, Gauge, Radio as _Radio, Loader2, FileSpreadsheet, FileDown,
  Activity, BarChart3, Users as _Users, Sparkles, Network, Shield, Zap, ArrowUpRight, ArrowDownRight,
  Flame, Rocket, Globe, Building2, Lightbulb as _Lightbulb, Award, CircleDot as _CircleDot, Timer, Wallet, PieChart as _PieChartIcon,
  GitBranch, Layers, Eye as _Eye, Flag as _Flag, Calendar as _Calendar, ChevronUp as _ChevronUp, ChevronDown as _ChevronDown, RefreshCcw as _RefreshCcw, Play as _Play, Compass
} from "lucide-react";
import { format, differenceInDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import { apiRequest } from "@/lib/queryClient";
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

interface DemandPlanServiceResponse {
  executiveSummary: {
    totalApproved: number;
    totalBudget: number;
    readyForImplementation: number;
    analysisDate: string;
  };
  capabilityAnalysis: {
    required: Array<{ name: string; demandCount: number }>;
    existing: Array<{ name: string }>;
    gaps: Array<{ capability: string; severity: string }>;
  };
  pipelineOverview: {
    inProgress: Array<{ id: string; title: string; status: string }>;
    planned: Array<{ id: string; title: string; budget: number }>;
    onHold: Array<{ id: string; title: string }>;
  };
  yearAheadRecommendations: Array<{
    demandId: string;
    title: string;
    department: string;
    urgency: string;
    budget: number;
    industryType: string | null;
    recommendationScore: number;
    implementationQuarter: string;
    rationale: string;
  }>;
  aiInsights: {
    strategicOverview: string;
    keyInsights: string[];
    implementationStrategy: {
      q1Focus: string;
      q2Focus: string;
      q3Q4Focus: string;
    };
    riskMitigation: Array<{
      risk: string;
      severity: string;
      mitigation: string;
    }>;
    budgetOptimization: string;
    successMetrics: string[];
  };
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

function useMonteCarloSimulation(params: { budgetConstraint: number; resourceConstraint: number }) {
  const query = useQuery<{ success: boolean; data: MonteCarloSimulationResponse }>({
    queryKey: ['/api/analytics/monte-carlo-simulation', params.budgetConstraint, params.resourceConstraint],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        budgetConstraint: String(params.budgetConstraint),
        resourceConstraint: String(params.resourceConstraint),
      });
      const response = await apiRequest("GET", `/api/analytics/monte-carlo-simulation?${searchParams.toString()}`);
      return response.json();
    },
    refetchInterval: 60000,
  });
  return {
    ...query,
    data: query.data?.data,
  };
}

function useDemandPlanService() {
  const query = useQuery<{ success: boolean; data: DemandPlanServiceResponse }>({
    queryKey: ['/api/analytics/demand-plan-service'],
    refetchInterval: 60000,
  });
  return {
    ...query,
    data: query.data?.data,
  };
}

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function HealthIndicator({ value }: { value: number }) {
  const color = value >= 80 ? 'text-emerald-500' : value >= 60 ? 'text-amber-500' : 'text-red-500';
  const Icon = value >= 80 ? CheckCircle : value >= 60 ? AlertTriangle : AlertTriangle;
  return <Icon className={`h-4 w-4 ${color}`} />;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TrendIndicator({ value }: { value: number }) {
  const { t } = useTranslation();
  if (Math.abs(value) < 1) {
    return <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><span className="text-blue-500">→</span> {t('demand.managementPlan.noChange')}</p>;
  }
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  const color = value > 0 ? 'text-emerald-500' : 'text-red-500';
  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
      <Icon className={`h-3 w-3 ${color}`} />
      {t('demand.managementPlan.vsLastMonth', { value: Math.abs(value).toFixed(1) })}
    </p>
  );
}

function ExportToolbar({ onExportExcel, onExportPDF }: { onExportExcel: () => void; onExportPDF: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" onClick={onExportExcel} data-testid="button-export-excel">
        <FileSpreadsheet className="h-4 w-4 mr-2" />
        {t('demand.managementPlan.exportExcel')}
      </Button>
      <Button variant="outline" size="sm" onClick={onExportPDF} data-testid="button-export-pdf">
        <FileDown className="h-4 w-4 mr-2" />
        {t('demand.managementPlan.exportPdf')}
      </Button>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DemandManagementPlan() {
  const { t } = useTranslation();
  const { data: demandsResponse, isLoading } = useQuery<{ success: boolean; data: DemandReport[]; count: number }>({
    queryKey: ['/api/demand-reports'],
  });

  const demands = demandsResponse?.data || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section className="flex flex-col h-full min-h-0 overflow-hidden" data-testid="demand-management-plan">
      <Tabs defaultValue="command-center" className="flex flex-col h-full min-h-0">
        {/* Fixed Header - Tab Navigation */}
        <div className="relative flex-shrink-0 border-b border-border/50 pb-3 mb-4">
          <TabsList className="inline-flex h-auto p-1 bg-muted/50 backdrop-blur-sm rounded-xl border border-border/50 shadow-lg">
            <TabsTrigger
              value="command-center"
              data-testid="tab-trigger-command-center"
              className="relative data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg px-4 py-2.5 flex items-center gap-2"
            >
              <Gauge className="h-4 w-4" />
              <span className="font-medium">{t('demand.managementPlan.liveCommandCenter')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              data-testid="tab-trigger-analytics"
              className="relative data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg px-4 py-2.5 flex items-center gap-2"
            >
              <HexagonLogoFrame px={16} />
              <span className="font-medium">{t('demand.managementPlan.predictiveAnalytics')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="executive"
              data-testid="tab-trigger-executive"
              className="relative data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg px-4 py-2.5 flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="font-medium">{t('demand.managementPlan.executiveOverview')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="strategic-plan"
              data-testid="tab-trigger-strategic-plan"
              className="relative data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg px-4 py-2.5 flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              <span className="font-medium">{t('demand.managementPlan.strategicPlan')}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content Panels with Proper Scroll Isolation */}
        <TabsContent value="command-center" className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col">
          <ScrollArea className="h-full pr-4">
            <CommandCenterTab demands={demands} />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="analytics" className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col">
          <ScrollArea className="h-full pr-4">
            <PredictiveAnalyticsTab demands={demands} />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="executive" className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col">
          <ScrollArea className="h-full pr-4">
            <ExecutiveOverviewTab demands={demands} />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="strategic-plan" className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col">
          <ScrollArea className="h-full pr-4">
            <StrategicPlanTab />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </section>
  );
}

// ============================================================================
// TAB 1: LIVE COMMAND CENTER - ENHANCED
// ============================================================================

function CommandCenterTab({ demands }: { demands: DemandReport[] }) {
  const { t } = useTranslation();
  const [_autoRefresh, _setAutoRefresh] = useState(true);
  const [_lastUpdated, _setLastUpdated] = useState(new Date());
  const { data: healthData, isLoading: healthLoading } = usePortfolioHealth();

  // Advanced computed metrics
  const advancedMetrics = useMemo(() => {
    if (!demands || !Array.isArray(demands)) return null;

    const now = new Date();
    const thirtyDaysAgo = subMonths(now, 1);
    const sixtyDaysAgo = subMonths(now, 2);

    // Current period demands
    const currentPeriod = demands.filter(d => {
      const createdAt = typeof d.createdAt === 'string' ? new Date(d.createdAt) : d.createdAt;
      return createdAt >= thirtyDaysAgo;
    });

    // Previous period demands
    const previousPeriod = demands.filter(d => {
      const createdAt = typeof d.createdAt === 'string' ? new Date(d.createdAt) : d.createdAt;
      return createdAt >= sixtyDaysAgo && createdAt < thirtyDaysAgo;
    });

    // Calculate totals
    const totalBudget = demands.reduce((sum, d) => sum + (parseFloat(String(d.estimatedBudget ?? '0')) || 0), 0);
    const approvedBudget = demands.filter(d => d.workflowStatus === 'approved' || d.workflowStatus === 'manager_approved')
      .reduce((sum, d) => sum + (parseFloat(String(d.estimatedBudget ?? '0')) || 0), 0);

    // Velocity metrics
    const currentVelocity = currentPeriod.length;
    const previousVelocity = previousPeriod.length || 1;
    const velocityChange = ((currentVelocity - previousVelocity) / previousVelocity) * 100;

    // Approval rate
    const approvedCount = demands.filter(d => d.workflowStatus === 'approved' || d.workflowStatus === 'manager_approved').length;
    const approvalRate = demands.length > 0 ? (approvedCount / demands.length) * 100 : 0;

    // Average processing time based on lifecycle timestamps
    const processingDurations = demands
      .map((d) => {
        const start = d.submittedAt || d.createdAt;
        const end = d.managerApprovedAt || d.approvedAt || d.completedAt || d.rejectedAt || d.deferredAt || d.updatedAt;
        if (!start || !end) return null;
        const startDate = typeof start === 'string' ? new Date(start) : start;
        const endDate = typeof end === 'string' ? new Date(end) : end;
        const diff = differenceInDays(endDate, startDate);
        return diff >= 0 ? diff : null;
      })
      .filter((value): value is number => typeof value === 'number');

    const avgProcessingDays = processingDurations.length > 0
      ? processingDurations.reduce((sum, value) => sum + value, 0) / processingDurations.length
      : 0;

    // Strategic alignment average
    const alignmentScores = demands
      .map(d => {
          const analysis = d.strategicFitAnalysis as Record<string, unknown> | null;
        return (analysis?.overallScore as number) || (analysis?.score as number) || 0;
      })
      .filter(s => s > 0);
    const avgAlignment = alignmentScores.length > 0
      ? alignmentScores.reduce((a, b) => a + b, 0) / alignmentScores.length
      : 0;

    // Risk distribution
    const criticalCount = demands.filter(d => d.urgency === 'critical').length;
    const highCount = demands.filter(d => d.urgency === 'high').length;
    const mediumCount = demands.filter(d => d.urgency === 'medium').length;
    const lowCount = demands.filter(d => d.urgency === 'low').length;

    // Department breakdown with budgets
    const deptData: Record<string, { count: number; budget: number; approved: number }> = {};
    demands.forEach(d => {
      const dept = d.department || 'Other';
      if (!deptData[dept]) deptData[dept] = { count: 0, budget: 0, approved: 0 };
      deptData[dept].count++;
      deptData[dept].budget += parseFloat(String(d.estimatedBudget ?? '0')) || 0;
      if (d.workflowStatus === 'approved' || d.workflowStatus === 'manager_approved') {
        deptData[dept].approved++;
      }
    });

    // Weekly trend data (last 8 weeks)
    const weeklyTrend = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = subMonths(now, i * 0.25);
      const weekEnd = subMonths(now, (i - 1) * 0.25);
      const count = demands.filter(d => {
        const createdAt = typeof d.createdAt === 'string' ? new Date(d.createdAt) : d.createdAt;
        return createdAt >= weekStart && createdAt < weekEnd;
      }).length;
      weeklyTrend.push({ week: `W${8 - i}`, count, target: 5 });
    }

    return {
      totalDemands: demands.length,
      totalBudget,
      approvedBudget,
      pendingBudget: totalBudget - approvedBudget,
      currentVelocity,
      velocityChange,
      approvalRate,
      avgProcessingDays,
      avgAlignment,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      departmentData: Object.entries(deptData).map(([name, data]) => ({
        name,
        ...data,
        approvalRate: data.count > 0 ? (data.approved / data.count) * 100 : 0
      })).sort((a, b) => b.budget - a.budget).slice(0, 6),
      weeklyTrend,
    };
  }, [demands]);

  // Radar chart data for strategic dimensions
  const strategicRadarData = useMemo(() => {
    if (!demands || !Array.isArray(demands)) return [];

    const dimensionMatchers = [
      { label: 'Innovation', match: 'innovation', target: 85 },
      { label: 'Efficiency', match: 'efficiency', target: 80 },
      { label: 'Customer Exp.', match: 'customer', target: 90 },
      { label: 'Compliance', match: 'compliance', target: 95 },
      { label: 'Scalability', match: 'scalability', target: 80 },
      { label: 'Sustainability', match: 'sustainability', target: 75 },
    ];

    const buckets: Record<string, number[]> = Object.fromEntries(
      dimensionMatchers.map((item) => [item.match, []])
    );

    demands.forEach((d) => {
      const analysis = d.strategicFitAnalysis as Record<string, unknown> | null;
      const criteria = analysis?.decisionCriteria as Record<string, unknown> | undefined;
      if (!criteria || typeof criteria !== 'object') return;

      Object.entries(criteria).forEach(([key, value]) => {
        const score = (value as Record<string, unknown> | null)?.score;
        if (typeof score !== 'number') return;
        const normalizedKey = key.toLowerCase();
        dimensionMatchers.forEach((item) => {
          if (normalizedKey.includes(item.match)) {
            buckets[item.match]!.push(score);
          }
        });
      });
    });

    return dimensionMatchers.map((item) => {
      const scores = buckets[item.match] || [];
      const average = scores.length > 0
        ? scores.reduce((sum, value) => sum + value, 0) / scores.length
        : 0;
      return {
        dimension: item.label,
        current: Math.round(average),
        target: item.target,
      };
    });
  }, [demands]);

  // ROI projection data
  const roiProjectionData = useMemo(() => {
    if (!demands || !Array.isArray(demands)) return [];

    const now = new Date();
    const quarters = Array.from({ length: 5 }, (_, index) => {
      const date = subMonths(now, (4 - index) * 3);
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      const year = date.getFullYear();
      const label = `Q${quarter} ${year}`;
      return { date, label };
    });

    return quarters.map(({ date, label }) => {
      const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
      const quarterStart = new Date(date.getFullYear(), quarterStartMonth, 1);
      const quarterEnd = new Date(date.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999);

      let approvedTotal = 0;
      let estimatedTotal = 0;
      let actualTotal = 0;

      demands.forEach((d) => {
        const createdAt = typeof d.createdAt === 'string' ? new Date(d.createdAt) : d.createdAt;
        if (!createdAt || createdAt < quarterStart || createdAt > quarterEnd) return;
        approvedTotal += parseFloat(String(d.approvedBudget ?? '0')) || 0;
        estimatedTotal += parseFloat(String(d.estimatedBudget ?? '0')) || 0;
        actualTotal += parseFloat(String(d.actualSpend ?? '0')) || 0;
      });

      const baselineTotal = approvedTotal > 0 ? approvedTotal : estimatedTotal;
      const projectedRatio = baselineTotal > 0 ? (estimatedTotal / baselineTotal) * 100 : 0;
      const actualRatio = baselineTotal > 0 ? (actualTotal / baselineTotal) * 100 : 0;

      return {
        quarter: label,
        projected: Number.isFinite(projectedRatio) ? projectedRatio : 0,
        actual: Number.isFinite(actualRatio) ? actualRatio : 0,
        baseline: 100,
      };
    });
  }, [demands]);

  // Risk heat map data
  const riskHeatMapData = useMemo(() => {
    if (!demands || !Array.isArray(demands)) return [];

    const matrix = [
      { impact: 'Critical', low: 0, medium: 0, high: 0, critical: 0 },
      { impact: 'High', low: 0, medium: 0, high: 0, critical: 0 },
      { impact: 'Medium', low: 0, medium: 0, high: 0, critical: 0 },
      { impact: 'Low', low: 0, medium: 0, high: 0, critical: 0 },
    ];

    // Populate based on demands
    demands.forEach(d => {
      const urgency = d.urgency || 'medium';
      const budget = parseFloat(String(d.estimatedBudget ?? '0')) || 0;
      const impact = budget > 5000000 ? 0 : budget > 2000000 ? 1 : budget > 500000 ? 2 : 3;

      if (urgency === 'critical') matrix[impact]!.critical++;
      else if (urgency === 'high') matrix[impact]!.high++;
      else if (urgency === 'medium') matrix[impact]!.medium++;
      else matrix[impact]!.low++;
    });

    return matrix;
  }, [demands]);

  const velocityData = useMemo(() => {
    if (!demands || !Array.isArray(demands)) return [];

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const submissions = demands.filter((d) => {
        const createdAt = typeof d.createdAt === 'string' ? new Date(d.createdAt) : d.createdAt;
        return createdAt >= monthStart && createdAt <= monthEnd;
      }).length;

      const approvals = demands.filter((d) => {
        const createdAt = typeof d.createdAt === 'string' ? new Date(d.createdAt) : d.createdAt;
        return createdAt >= monthStart && createdAt <= monthEnd &&
          (d.workflowStatus === 'approved' || d.workflowStatus === 'manager_approved');
      }).length;

      months.push({
        month: format(monthDate, 'MMM'),
        submissions,
        approvals,
      });
    }
    return months;
  }, [demands]);

  const visionPillarData = useMemo(() => {
    // Pillar mapping: deterministic assignment based on department/industry type
    const pillarMap: Record<string, string> = {
      // Healthcare/Medical
      'health': 'World-Class Healthcare',
      'medical': 'World-Class Healthcare',
      'hospital': 'World-Class Healthcare',
      // Education
      'education': 'First-Rate Education',
      'university': 'First-Rate Education',
      'school': 'First-Rate Education',
      // Social/Community
      'social': 'Happy & Cohesive Society',
      'community': 'Happy & Cohesive Society',
      'welfare': 'Happy & Cohesive Society',
      // Economic/Business
      'economy': 'Competitive Knowledge Economy',
      'finance': 'Competitive Knowledge Economy',
      'commerce': 'Competitive Knowledge Economy',
      'innovation': 'Competitive Knowledge Economy',
      // Environment
      'environment': 'Thriving & Sustainable Environment',
      'energy': 'Thriving & Sustainable Environment',
      'sustainability': 'Thriving & Sustainable Environment',
    };

    const pillars: Record<string, { name: string; color: string; count: number }> = {
      'Happy & Cohesive Society': { name: 'Happy & Cohesive Society', color: CHART_COLORS[0]!, count: 0 },
      'Competitive Knowledge Economy': { name: 'Competitive Knowledge Economy', color: CHART_COLORS[1]!, count: 0 },
      'First-Rate Education': { name: 'First-Rate Education', color: CHART_COLORS[2]!, count: 0 },
      'World-Class Healthcare': { name: 'World-Class Healthcare', color: CHART_COLORS[3]!, count: 0 },
      'Thriving & Sustainable Environment': { name: 'Thriving & Sustainable Environment', color: CHART_COLORS[4]!, count: 0 },
    };

    if (demands && Array.isArray(demands)) {
      demands.forEach((d) => {
        // Map demand to pillar based on department or industry keywords
        const searchText = `${d.department} ${d.industryType || ''} ${d.businessObjective || ''}`.toLowerCase();
        let matched = false;

        for (const [keyword, pillarName] of Object.entries(pillarMap)) {
          if (searchText.includes(keyword)) {
            pillars[pillarName]!.count++;
            matched = true;
            break;
          }
        }

        // If no keyword match, use strategic alignment to assign to economy pillar (most general)
        if (!matched) {
          const strategicAnalysis = d.strategicFitAnalysis as Record<string, unknown> | null;
          const alignmentScore = (strategicAnalysis?.overallScore as number) || (strategicAnalysis?.score as number) || 0;
          if (alignmentScore > 60) {
            pillars['Competitive Knowledge Economy']!.count++;
          }
        }
      });
    }

    return Object.values(pillars).map(p => ({ name: p.name, value: p.count, color: p.color }));
  }, [demands]);

  const _departmentDistribution = useMemo(() => {
    if (!demands || !Array.isArray(demands)) return [];
    const deptMap: Record<string, number> = {};
    demands.forEach(d => {
      const dept = d.department || 'Other';
      deptMap[dept] = (deptMap[dept] || 0) + 1;
    });
    return Object.entries(deptMap)
      .map(([name, value], idx) => ({ name, value, color: CHART_COLORS[idx % CHART_COLORS.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [demands]);

  const budgetByDepartment = useMemo(() => {
    if (!demands || !Array.isArray(demands)) return [];
    const deptBudget: Record<string, { approved: number; actual: number }> = {};
    demands.forEach(d => {
      const dept = d.department || 'Other';
      if (!deptBudget[dept]) {
        deptBudget[dept] = { approved: 0, actual: 0 };
      }
      const approved = parseFloat(String(d.approvedBudget ?? '0')) || 0;
      const actual = parseFloat(String(d.actualSpend ?? '0')) || 0;
      deptBudget[dept].approved += approved;
      deptBudget[dept].actual += actual;
    });
    return Object.entries(deptBudget)
      .map(([name, values]) => ({ name, approved: values.approved, actual: values.actual }))
      .sort((a, b) => b.approved - a.approved)
      .slice(0, 8);
  }, [demands]);

  const workflowFunnelData = useMemo(() => {
    if (!demands || !Array.isArray(demands)) return [];
    const statusOrder = ['draft', 'submitted', 'under_review', 'manager_approved', 'approved', 'rejected'];
    const statusLabels: Record<string, string> = {
      'draft': 'Draft',
      'submitted': 'Submitted',
      'under_review': 'Under Review',
      'manager_approved': 'Manager Approved',
      'approved': 'Final Approved',
      'rejected': 'Rejected'
    };
    const statusCounts: Record<string, number> = {};
    demands.forEach(d => {
      const status = d.workflowStatus || 'draft';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    return statusOrder.map(status => ({
      status: statusLabels[status] || status,
      count: statusCounts[status] || 0,
      fill: CHART_COLORS[statusOrder.indexOf(status) % CHART_COLORS.length]
    })).filter(s => s.count > 0);
  }, [demands]);

  const urgencyDistribution = useMemo(() => {
    if (!demands || !Array.isArray(demands)) return [];
    const urgencyCounts: Record<string, number> = {};
    demands.forEach(d => {
      const urgency = d.urgency || 'medium';
      urgencyCounts[urgency] = (urgencyCounts[urgency] || 0) + 1;
    });
    const urgencyOrder = ['critical', 'high', 'medium', 'low'];
    const urgencyColors: Record<string, string> = {
      'critical': '#ef4444',
      'high': '#f59e0b',
      'medium': '#3b82f6',
      'low': '#10b981'
    };
    return urgencyOrder
      .filter(u => urgencyCounts[u])
      .map(urgency => ({
        name: urgency.charAt(0).toUpperCase() + urgency.slice(1),
        value: urgencyCounts[urgency],
        color: urgencyColors[urgency]
      }));
  }, [demands]);

  const topInitiatives = useMemo(() => {
    if (!demands || !Array.isArray(demands)) return [];
    return [...demands]
      .map(d => {
        const budget = parseFloat(String(d.approvedBudget ?? '0')) || 0;
        const strategicAnalysis = d.strategicFitAnalysis as Record<string, unknown> | null;
        const alignmentScore = (strategicAnalysis?.overallScore as number) || (strategicAnalysis?.score as number) || 0;
        const urgencyWeight = d.urgency === 'critical' ? 100 : d.urgency === 'high' ? 75 : d.urgency === 'medium' ? 50 : 25;
        const score = (budget / 1000000) + alignmentScore + urgencyWeight;
        return { ...d, budget, alignmentScore, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [demands]);

  return (
    <div className="space-y-6 pb-6 min-w-[1200px] lg:min-w-full" data-testid="tab-command-center">
      {healthLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : healthData && advancedMetrics ? (
        <>
          {/* Executive KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20" data-testid="kpi-total-demands">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Layers className="h-4 w-4 text-blue-500" />
                  <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-600">{t('demand.managementPlan.total')}</Badge>
                </div>
                <div className="text-2xl font-bold text-blue-600">{advancedMetrics.totalDemands}</div>
                <p className="text-[10px] text-muted-foreground mt-1">{t('demand.managementPlan.activeDemands')}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20" data-testid="kpi-total-budget">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Wallet className="h-4 w-4 text-emerald-500" />
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">{t('demand.managementPlan.budget')}</Badge>
                </div>
                <div className="text-2xl font-bold text-emerald-600">{(advancedMetrics.totalBudget / 1000000).toFixed(1)}M</div>
                <p className="text-[10px] text-muted-foreground mt-1">{t('demand.managementPlan.totalPortfolio')}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/20" data-testid="kpi-approval-rate">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle className="h-4 w-4 text-violet-500" />
                  <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-600">{t('demand.managementPlan.rate')}</Badge>
                </div>
                <div className="text-2xl font-bold text-violet-600">{advancedMetrics.approvalRate.toFixed(0)}%</div>
                <p className="text-[10px] text-muted-foreground mt-1">{t('demand.managementPlan.approvalRate')}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20" data-testid="kpi-velocity">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Rocket className="h-4 w-4 text-amber-500" />
                  {advancedMetrics.velocityChange >= 0 ? (
                    <Badge className="text-[10px] bg-emerald-500/20 text-emerald-600 border-0">
                      <ArrowUpRight className="h-3 w-3 mr-0.5" />
                      {advancedMetrics.velocityChange.toFixed(0)}%
                    </Badge>
                  ) : (
                    <Badge className="text-[10px] bg-rose-500/20 text-rose-600 border-0">
                      <ArrowDownRight className="h-3 w-3 mr-0.5" />
                      {Math.abs(advancedMetrics.velocityChange).toFixed(0)}%
                    </Badge>
                  )}
                </div>
                <div className="text-2xl font-bold text-amber-600">{advancedMetrics.currentVelocity}</div>
                <p className="text-[10px] text-muted-foreground mt-1">{t('demand.managementPlan.monthlyVelocity')}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20" data-testid="kpi-processing-time">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Timer className="h-4 w-4 text-cyan-500" />
                  <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-600">{t('demand.managementPlan.avg')}</Badge>
                </div>
                <div className="text-2xl font-bold text-cyan-600">{advancedMetrics.avgProcessingDays.toFixed(1)}</div>
                <p className="text-[10px] text-muted-foreground mt-1">{t('demand.managementPlan.daysToApprove')}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20" data-testid="kpi-critical">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Flame className="h-4 w-4 text-rose-500" />
                  <Badge variant="destructive" className="text-[10px]">{t('demand.managementPlan.critical')}</Badge>
                </div>
                <div className="text-2xl font-bold text-rose-600">{advancedMetrics.criticalCount}</div>
                <p className="text-[10px] text-muted-foreground mt-1">{t('demand.managementPlan.urgentItems')}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20" data-testid="kpi-alignment">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Target className="h-4 w-4 text-indigo-500" />
                  <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-600">{t('demand.managementPlan.strategic')}</Badge>
                </div>
                <div className="text-2xl font-bold text-indigo-600">{advancedMetrics.avgAlignment.toFixed(0)}%</div>
                <p className="text-[10px] text-muted-foreground mt-1">{t('demand.managementPlan.avgAlignment')}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20" data-testid="kpi-health">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <HealthIndicator value={healthData.overallHealthScore} />
                </div>
                <div className="text-2xl font-bold text-primary">{(healthData.overallHealthScore ?? 0).toFixed(0)}%</div>
                <p className="text-[10px] text-muted-foreground mt-1">{t('demand.managementPlan.healthScore')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Analytics Grid - Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Strategic Radar */}
            <Card className="border border-border/50 lg:col-span-1" data-testid="card-strategic-radar">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Compass className="h-5 w-5 text-violet-500" />
                  {t('demand.managementPlan.strategicDimensions')}
                </CardTitle>
                <CardDescription className="text-xs">{t('demand.managementPlan.portfolioCapabilityAnalysis')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={strategicRadarData}>
                      <PolarGrid stroke="hsl(var(--muted-foreground))" opacity={0.3} />
                      <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                      <Radar name="Current" dataKey="current" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} strokeWidth={2} />
                      <Radar name="Target" dataKey="target" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} strokeDasharray="5 5" />
                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* ROI Projection */}
            <Card className="border border-border/50 lg:col-span-2" data-testid="card-roi-projection">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-5 w-5 text-emerald-500" />
                      {t('demand.managementPlan.budgetUtilizationTrajectory')}
                    </CardTitle>
                    <CardDescription className="text-xs">{t('demand.managementPlan.estimatedVsActualSpend')}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/20 text-emerald-600 border-0 text-xs">
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                      {t('demand.managementPlan.onTrack')}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={roiProjectionData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.5} />
                      <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 150]} />
                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => `${v?.toFixed(1)}%`} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Area type="monotone" dataKey="baseline" fill="#94a3b8" fillOpacity={0.1} stroke="#94a3b8" strokeDasharray="3 3" name="Approved Budget" />
                      <Line type="monotone" dataKey="projected" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} name="Estimated Spend" />
                      <Scatter dataKey="actual" fill="#3b82f6" name="Actual Spend" shape="diamond" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Analytics Grid - Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Demand Velocity Trends */}
            <Card className="border border-border/50" data-testid="card-velocity-chart">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-5 w-5 text-primary" />
                  {t('demand.managementPlan.demandVelocityTrends')}
                </CardTitle>
                <CardDescription className="text-xs">{t('demand.managementPlan.sixMonthTrends')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={velocityData}>
                      <defs>
                        <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorApprovals" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.5} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Area type="monotone" dataKey="submissions" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSubmissions)" name="Submissions" strokeWidth={2} />
                      <Area type="monotone" dataKey="approvals" stroke="#10b981" fillOpacity={1} fill="url(#colorApprovals)" name="Approvals" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Vision 2071 Alignment */}
            <Card className="border border-border/50" data-testid="card-vision-pillars">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Globe className="h-5 w-5 text-emerald-500" />
                      {t('demand.managementPlan.uaeVision2071Alignment')}
                    </CardTitle>
                    <CardDescription className="text-xs">{t('demand.managementPlan.strategicPillarDistribution')}</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">{t('demand.managementPlan.fivePillars')}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={visionPillarData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.5} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                      <Bar dataKey="value" name="Aligned Demands" radius={[0, 4, 4, 0]} barSize={20}>
                        {visionPillarData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Risk Heat Map & Department Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Risk Heat Map */}
            <Card className="border border-border/50" data-testid="card-risk-heatmap">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-5 w-5 text-rose-500" />
                  {t('demand.managementPlan.riskHeatMap')}
                </CardTitle>
                <CardDescription className="text-xs">{t('demand.managementPlan.impactVsProbabilityMatrix')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {riskHeatMapData.map((row, rowIdx) => (
                    <div key={row.impact} className="flex items-center gap-2">
                      <span className="text-xs font-medium w-16 text-muted-foreground">{row.impact}</span>
                      <div className="flex-1 grid grid-cols-4 gap-1">
                        {['low', 'medium', 'high', 'critical'].map((level, colIdx) => {
                          const value = row[level as keyof typeof row] as number;
                          const intensity = value === 0 ? 'bg-muted' :
                            rowIdx <= 1 && colIdx >= 2 ? 'bg-rose-500' :
                            rowIdx <= 1 || colIdx >= 2 ? 'bg-amber-500' :
                            colIdx >= 1 ? 'bg-yellow-500' : 'bg-emerald-500';
                          return (
                            <div
                              key={level}
                              className={`h-10 rounded flex items-center justify-center text-xs font-bold ${intensity} ${value > 0 ? 'text-white' : 'text-muted-foreground'}`}
                            >
                              {value || '-'}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs w-16"></span>
                    <div className="flex-1 grid grid-cols-4 gap-1 text-center">
                      <span className="text-[10px] text-muted-foreground">{t('demand.managementPlan.low')}</span>
                      <span className="text-[10px] text-muted-foreground">{t('demand.managementPlan.medium')}</span>
                      <span className="text-[10px] text-muted-foreground">{t('demand.managementPlan.high')}</span>
                      <span className="text-[10px] text-muted-foreground">{t('demand.managementPlan.criticalLabel')}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Urgency Distribution */}
            <Card className="border border-border/50" data-testid="card-urgency-distribution">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  {t('demand.managementPlan.priorityDistribution')}
                </CardTitle>
                <CardDescription className="text-xs">{t('demand.managementPlan.urgencyLevelsAcrossPortfolio')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={urgencyDistribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {urgencyDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-2">
                  {urgencyDistribution.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-muted-foreground">{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Workflow Pipeline */}
            <Card className="border border-border/50" data-testid="card-workflow-funnel">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <GitBranch className="h-5 w-5 text-blue-500" />
                  {t('demand.managementPlan.workflowPipeline')}
                </CardTitle>
                <CardDescription className="text-xs">{t('demand.managementPlan.demandProgressionStages')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {workflowFunnelData.map((stage, _idx) => (
                    <div key={stage.status} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-muted-foreground truncate">{stage.status}</div>
                      <div className="flex-1 relative">
                        <div className="h-6 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max((stage.count / Math.max(...workflowFunnelData.map(s => s.count))) * 100, 10)}%`,
                              backgroundColor: stage.fill
                            }}
                          />
                        </div>
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-foreground">
                          {stage.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Department Performance & Budget Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department Distribution */}
            <Card className="border border-border/50" data-testid="card-department-distribution">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-5 w-5 text-purple-500" />
                  {t('demand.managementPlan.departmentPerformance')}
                </CardTitle>
                <CardDescription className="text-xs">{t('demand.managementPlan.budgetAllocationAndApprovalRates')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {advancedMetrics.departmentData.slice(0, 5).map((dept, idx) => (
                    <div key={dept.name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}>
                            {idx + 1}
                          </div>
                          <span className="text-sm font-medium truncate max-w-[150px]">{dept.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground">{dept.count} {t('demand.managementPlan.demands')}</span>
                          <Badge variant="outline" className="text-[10px]">{formatCurrency(dept.budget)}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={dept.approvalRate} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground w-10">{dept.approvalRate.toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Budget Allocation */}
            <Card className="border border-border/50" data-testid="card-budget-by-department">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                  {t('demand.managementPlan.budgetAllocationAnalysis')}
                </CardTitle>
                <CardDescription className="text-xs">{t('demand.managementPlan.approvedVsActualSpend')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={budgetByDepartment.slice(0, 5)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.5} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => formatCurrency(v)} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Bar dataKey="approved" fill="#10b981" name="Approved" radius={[0, 4, 4, 0]} barSize={12} />
                      <Bar dataKey="actual" fill="#3b82f6" name="Actual" radius={[0, 4, 4, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top High-Value Initiatives */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                {t('demand.managementPlan.topStrategicInitiatives')}
              </h3>
              <Badge variant="outline" className="text-xs">{t('demand.managementPlan.rankedByImpactScore')}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {topInitiatives.map((initiative, idx) => (
                <Card key={initiative.id} className="relative overflow-hidden border border-primary/20 hover-elevate group" data-testid={`card-top-initiative-${idx}`}>
                  <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                  <CardHeader className="pb-2 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}>
                          #{idx + 1}
                        </div>
                      </div>
                      <Badge
                        variant={initiative.urgency === 'critical' ? 'destructive' : initiative.urgency === 'high' ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {initiative.urgency}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm line-clamp-2 mt-2 min-h-[40px]">{initiative.businessObjective || t('demand.managementPlan.untitledInitiative')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Wallet className="h-3 w-3" />
                        {t('demand.managementPlan.budgetLabel')}
                      </span>
                      <span className="font-semibold">{formatCurrency(initiative.budget)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {t('demand.managementPlan.alignment')}
                      </span>
                      <span className="font-semibold">{initiative.alignmentScore.toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {t('demand.managementPlan.dept')}
                      </span>
                      <span className="font-semibold truncate max-w-[80px]">{initiative.department}</span>
                    </div>
                    <Progress value={initiative.alignmentScore} className="h-1.5 mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      ) : (
        <Card className="p-8">
          <p className="text-center text-muted-foreground">{t('demand.managementPlan.noHealthData')}</p>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// TAB 2: PREDICTIVE ANALYTICS
// ============================================================================


function PredictiveAnalyticsTab({ demands: _demands }: { demands: DemandReport[] }) {
  const { t } = useTranslation();
  const [budgetConstraint, setBudgetConstraint] = useState(10000000);
  const [resourceConstraint, setResourceConstraint] = useState(100);

  const { data: forecastData, isLoading: forecastLoading } = useDemandForecast();
  const { data: monteCarloData, isLoading: monteCarloLoading } = useMonteCarloSimulation({
    budgetConstraint,
    resourceConstraint,
  });

  const handleExportExcel = useCallback(() => {
    // Excel export not yet implemented
  }, []);
  const handleExportPDF = useCallback(() => console.log('Exporting...'), []);

  const demandForecastChartData = useMemo(() => {
    if (!forecastData || !forecastData.forecast || !Array.isArray(forecastData.forecast)) return [];

    const historical = forecastData.historical ?? [];
    const forecast = forecastData.forecast ?? [];

    return [
      ...historical.map(h => ({
        month: h.month,
        actual: h.count,
        forecast: null,
        lower: null,
        upper: null,
      })),
      ...forecast.map(f => ({
        month: f.month,
        actual: null,
        forecast: f.forecast,
        lower: f.lower95,
        upper: f.upper95,
      })),
    ];
  }, [forecastData]);

  const probabilityDistData = useMemo(() => {
    if (!monteCarloData || !monteCarloData.probabilityDistribution || !Array.isArray(monteCarloData.probabilityDistribution)) {
      return [];
    }
    return monteCarloData.probabilityDistribution.map(item => ({
      ...item,
      probability: item.probability * 100,
    }));
  }, [monteCarloData]);

  return (
    <div className="space-y-6 pb-6 min-w-[1200px] lg:min-w-full" data-testid="tab-predictive-analytics">
      <ExportToolbar onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />

      {/* Analytics Header */}
      <Card className="relative overflow-hidden border-2 border-purple-500/30 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent" />
        <CardHeader className="relative">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/20 rounded-xl shadow-lg">
              <HexagonLogoFrame px={28} />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">{t('demand.managementPlan.predictiveAnalyticsForecasting')}</CardTitle>
              <CardDescription className="text-base">{t('demand.managementPlan.aiPoweredDemandForecasting')}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {forecastLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
        </div>
      ) : forecastData ? (
        <>
          {/* 12-Month Forecast */}
          <Card className="border border-border/50" data-testid="card-demand-forecast">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                {t('demand.managementPlan.twelveMonthForecast')}
              </CardTitle>
              <CardDescription>{t('demand.managementPlan.exponentialSmoothing')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={demandForecastChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ borderRadius: '8px' }} />
                    <Legend />
                    <Line type="monotone" dataKey="actual" stroke={CHART_COLORS[0]} strokeWidth={2} name="Actual" dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="forecast" stroke={CHART_COLORS[1]} strokeWidth={2} strokeDasharray="5 5" name="Forecast" />
                    <Line type="monotone" dataKey="upper" stroke={CHART_COLORS[2]} strokeWidth={1} strokeDasharray="3 3" name="Upper 95%" />
                    <Line type="monotone" dataKey="lower" stroke={CHART_COLORS[2]} strokeWidth={1} strokeDasharray="3 3" name="Lower 95%" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {forecastData.statistics && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">{t('demand.managementPlan.avgMonthly')}</p>
                    <p className="text-2xl font-bold text-primary">{(forecastData.statistics?.averageMonthlyDemands ?? 0).toFixed(1)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">{t('demand.managementPlan.trend')}</p>
                    <p className="text-2xl font-bold capitalize">{forecastData.statistics.trend}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">{t('demand.managementPlan.seasonality')}</p>
                    <p className="text-2xl font-bold">{forecastData.statistics.seasonality}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monte Carlo Simulation */}
          {monteCarloLoading ? (
            <Card className="p-8">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              </div>
            </Card>
          ) : monteCarloData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Constraint Controls */}
              <Card className="border border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    {t('demand.managementPlan.portfolioOptimization')}
                  </CardTitle>
                  <CardDescription>{t('demand.managementPlan.monteCarloSimulation', { count: monteCarloData.simulationCount })}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label className="text-sm font-medium">{t('demand.managementPlan.budgetConstraint')}</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[budgetConstraint]}
                        onValueChange={([value]) => setBudgetConstraint(value!)}
                        min={1000000}
                        max={50000000}
                        step={1000000}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium min-w-[120px]">{formatCurrency(budgetConstraint)}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">{t('demand.managementPlan.resourceConstraint')}</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[resourceConstraint]}
                        onValueChange={([value]) => setResourceConstraint(value!)}
                        min={20}
                        max={200}
                        step={10}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium min-w-[120px]">{resourceConstraint} FTE</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">{t('demand.managementPlan.projectsSelected')}</p>
                      <p className="text-2xl font-bold text-primary">{monteCarloData.recommendedPortfolio.projectsSelected}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('demand.managementPlan.expectedRoi')}</p>
                      <p className="text-2xl font-bold text-emerald-600">{(monteCarloData.recommendedPortfolio?.roi ?? 0).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('demand.managementPlan.totalCost')}</p>
                      <p className="text-xl font-bold">{formatCurrency(monteCarloData.recommendedPortfolio.totalCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('demand.managementPlan.successRate')}</p>
                      <p className="text-xl font-bold">{(monteCarloData.recommendedPortfolio?.successProbability ?? 0).toFixed(0)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Probability Distribution */}
              <Card className="border border-border/50" data-testid="card-probability-distribution">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-500" />
                    {t('demand.managementPlan.roiProbabilityDistribution')}
                  </CardTitle>
                  <CardDescription>{t('demand.managementPlan.monteCarloResults')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={probabilityDistData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="roiRange" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip contentStyle={{ borderRadius: '8px' }} />
                        <Bar dataKey="probability" fill={CHART_COLORS[4]} name="Probability %" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </>
      ) : (
        <Card className="p-8">
          <p className="text-center text-muted-foreground">{t('demand.managementPlan.noForecastData')}</p>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// TAB 3: EXECUTIVE OVERVIEW
// ============================================================================

function ExecutiveOverviewTab({ demands }: { demands: DemandReport[] }) {
  const { t } = useTranslation();
  const handleExportExcel = useCallback(() => {
    // Excel export not yet implemented
  }, []);
  const handleExportPDF = useCallback(() => {
    // PDF export not yet implemented
  }, []);

  const totalInvestment = useMemo(() => {
    if (!demands || !Array.isArray(demands)) return 0;
    return demands.reduce((sum, d) => {
      // Parse estimatedBudget (text field) or approvedBudget (numeric field)
      const budget = d.approvedBudget
        ? parseFloat(d.approvedBudget.toString())
        : d.estimatedBudget
        ? parseFloat(d.estimatedBudget.replace(/[^0-9.-]+/g, '')) || 0
        : 0;
      return sum + budget;
    }, 0);
  }, [demands]);

  const activeProjects = useMemo(() => {
    if (!demands || !Array.isArray(demands)) return 0;
    return demands.filter(d =>
      d.workflowStatus === 'under_review' ||
      d.workflowStatus === 'approved' ||
      d.workflowStatus === 'manager_approved'
    ).length;
  }, [demands]);

  const avgCycleTime = useMemo(() => {
    if (!demands || !Array.isArray(demands)) return 0;
    const completed = demands.filter(d => d.workflowStatus === 'manager_approved');
    if (completed.length === 0) return 0;

    const totalDays = completed.reduce((sum, d) => {
      const created = typeof d.createdAt === 'string' ? new Date(d.createdAt) : d.createdAt;
      const updated = typeof d.updatedAt === 'string' ? new Date(d.updatedAt) : d.updatedAt;
      return sum + differenceInDays(updated, created);
    }, 0);

    return totalDays / completed.length;
  }, [demands]);

  const pipelineData = useMemo(() => {
    if (!demands || !Array.isArray(demands)) return [];
    const stages = [
      { name: 'Generated', value: demands.filter(d => d.workflowStatus === 'generated').length },
      { name: 'Under Review', value: demands.filter(d => d.workflowStatus === 'under_review').length },
      { name: 'Approved', value: demands.filter(d => d.workflowStatus === 'approved').length },
      { name: 'Manager Approved', value: demands.filter(d => d.workflowStatus === 'manager_approved').length },
      { name: 'Pending Conversion', value: demands.filter(d => d.workflowStatus === 'pending_conversion').length },
      { name: 'Converted', value: demands.filter(d => d.workflowStatus === 'converted').length },
    ];
    return stages.filter(s => s.value > 0);
  }, [demands]);

  const statusDistribution = useMemo(() => {
    if (!demands || !Array.isArray(demands)) return [];
    const statuses: Record<string, number> = {};
    demands.forEach(d => {
      const status = d.workflowStatus || 'unknown';
      statuses[status] = (statuses[status] || 0) + 1;
    });

    return Object.entries(statuses).map(([name, value], index) => ({
      name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [demands]);

  return (
    <div className="space-y-6 pb-6 min-w-[1200px] lg:min-w-full" data-testid="tab-executive-overview">
      <ExportToolbar onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />

      {/* Executive Header */}
      <Card className="relative overflow-hidden border-2 border-emerald-500/30 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent" />
        <CardHeader className="relative">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 rounded-xl shadow-lg">
              <BarChart3 className="h-7 w-7 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">{t('demand.managementPlan.executivePortfolioOverview')}</CardTitle>
              <CardDescription className="text-base">{t('demand.managementPlan.comprehensivePortfolioMetrics')}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border/50" data-testid="card-total-investment">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              {t('demand.managementPlan.totalInvestment')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalInvestment)}</div>
          </CardContent>
        </Card>

        <Card className="border border-border/50" data-testid="card-total-demands">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              {t('demand.managementPlan.totalDemands')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{demands && Array.isArray(demands) ? demands.length : 0}</div>
          </CardContent>
        </Card>

        <Card className="border border-border/50" data-testid="card-active-projects">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-500" />
              {t('demand.managementPlan.activeProjects')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProjects}</div>
          </CardContent>
        </Card>

        <Card className="border border-border/50" data-testid="card-avg-cycle-time">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              {t('demand.managementPlan.avgCycleTime')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(avgCycleTime ?? 0).toFixed(0)} {t('demand.managementPlan.days')}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-border/50" data-testid="card-pipeline-funnel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-blue-500" />
              Demand Pipeline Funnel
            </CardTitle>
            <CardDescription>Stage-by-stage flow analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip contentStyle={{ borderRadius: '8px' }} />
                  <Funnel dataKey="value" data={pipelineData} isAnimationActive>
                    {pipelineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50" data-testid="card-status-distribution">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-500" />
              Status Distribution
            </CardTitle>
            <CardDescription>Portfolio status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 4: STRATEGIC PLAN SERVICE
// AI-powered demand management planning with capability analysis
// ============================================================================

function StrategicPlanTab() {
  const { t } = useTranslation();
  const { data: planData, isLoading, error } = useDemandPlanService();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error || !planData) {
    return (
      <Card className="border border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/20" data-testid="card-strategic-plan-unavailable">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {t('demand.managementPlan.aiAnalysisUnavailable')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('demand.managementPlan.aiInsightsUnavailableDesc')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { executiveSummary, capabilityAnalysis, pipelineOverview: _pipelineOverview, yearAheadRecommendations, aiInsights } = planData;

  // Check if AI insights contain real data (not just defaults)
  const hasRealAiInsights = aiInsights.keyInsights.length > 0 || aiInsights.riskMitigation.length > 0;

  return (
    <div className="space-y-6">
      {/* Executive Summary Section */}
      <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20" data-testid="card-strategic-summary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-amber-500" />
            {t('demand.managementPlan.strategicDemandManagementPlan')}
          </CardTitle>
          <CardDescription className="text-base">
            {t('demand.managementPlan.aiPoweredAnalysis')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-background rounded-lg border border-border/50">
              <div className="text-sm text-muted-foreground mb-1">{t('demand.managementPlan.totalApproved')}</div>
              <div className="text-3xl font-bold text-foreground">{executiveSummary.totalApproved}</div>
            </div>
            <div className="p-4 bg-background rounded-lg border border-border/50">
              <div className="text-sm text-muted-foreground mb-1">{t('demand.managementPlan.totalBudget')}</div>
              <div className="text-3xl font-bold text-emerald-600">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AED', minimumFractionDigits: 0 }).format(executiveSummary.totalBudget)}
              </div>
            </div>
            <div className="p-4 bg-background rounded-lg border border-border/50">
              <div className="text-sm text-muted-foreground mb-1">{t('demand.managementPlan.readyForImplementation')}</div>
              <div className="text-3xl font-bold text-amber-600">{executiveSummary.readyForImplementation}</div>
            </div>
            <div className="p-4 bg-background rounded-lg border border-border/50">
              <div className="text-sm text-muted-foreground mb-1">{t('demand.managementPlan.analysisDate')}</div>
              <div className="text-sm font-medium mt-2">{format(new Date(executiveSummary.analysisDate), 'MMM d, yyyy')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Insights Section */}
      {hasRealAiInsights ? (
        <div className="space-y-4">
          <Card className="border border-purple-500/30" data-testid="card-ai-overview">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HexagonLogoFrame px={20} />
                {t('demand.managementPlan.aiStrategicOverview')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base leading-relaxed">{aiInsights.strategicOverview}</p>
            </CardContent>
          </Card>

          {aiInsights.keyInsights.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border border-blue-500/30" data-testid="card-key-insights">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-500" />
                    {t('demand.managementPlan.keyInsights')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {aiInsights.keyInsights.map((insight, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {aiInsights.riskMitigation.length > 0 && (
                <Card className="border border-rose-500/30" data-testid="card-risk-mitigation">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-rose-500" />
                      {t('demand.managementPlan.riskMitigation')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {aiInsights.riskMitigation.map((risk, idx) => (
                        <div key={idx} className="border border-border/50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={risk.severity === 'High' ? 'destructive' : risk.severity === 'Medium' ? 'default' : 'secondary'}>
                              {risk.severity}
                            </Badge>
                            <span className="text-sm font-medium">{risk.risk}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{risk.mitigation}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      ) : (
        <Card className="border border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/20" data-testid="card-ai-unavailable">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t('demand.managementPlan.aiAnalysisUnavailable')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('demand.managementPlan.aiInsightsUnavailableDesc')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Capability Gap Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-emerald-500/30" data-testid="card-required-capabilities">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-500" />
              {t('demand.managementPlan.requiredCapabilities')}
            </CardTitle>
            <CardDescription>{t('demand.managementPlan.capabilitiesIdentified', { count: capabilityAnalysis.required.length })}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {capabilityAnalysis.required.slice(0, 10).map((cap, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                    <span className="text-sm font-medium">{cap.name}</span>
                    <Badge variant="outline">{cap.demandCount} {t('demand.managementPlan.demands')}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border border-blue-500/30" data-testid="card-existing-systems">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-blue-500" />
              {t('demand.managementPlan.existingSystems')}
            </CardTitle>
            <CardDescription>{t('demand.managementPlan.systemsInPlace', { count: capabilityAnalysis.existing.length })}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {capabilityAnalysis.existing.map((sys, idx) => (
                  <div key={idx} className="p-2 bg-muted/30 rounded-md">
                    <span className="text-sm">{sys.name}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border border-amber-500/30" data-testid="card-capability-gaps">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t('demand.managementPlan.capabilityGaps')}
            </CardTitle>
            <CardDescription>{t('demand.managementPlan.gapsIdentified', { count: capabilityAnalysis.gaps.length })}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {capabilityAnalysis.gaps.map((gap, idx) => (
                  <div key={idx} className="p-2 bg-amber-50/50 dark:bg-amber-950/20 rounded-md border border-amber-200/50 dark:border-amber-800/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{gap.capability}</span>
                      <Badge variant="destructive" className="text-xs">{t('demand.managementPlan.critical')}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Year-Ahead Implementation Recommendations */}
      <Card className="border border-amber-500/30" data-testid="card-year-recommendations">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            {t('demand.managementPlan.yearAheadRoadmap')}
          </CardTitle>
          <CardDescription>{t('demand.managementPlan.prioritizedRecommendations', { year: new Date().getFullYear() })}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {yearAheadRecommendations.slice(0, 10).map((rec, idx) => (
              <div
                key={rec.demandId}
                className="p-4 border border-border/50 rounded-lg hover-elevate transition-all"
                data-testid={`recommendation-${idx}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={idx < 3 ? "default" : "secondary"} className="text-xs">
                        #{idx + 1} · Score: {rec.recommendationScore}
                      </Badge>
                      <Badge variant="outline">{rec.implementationQuarter}</Badge>
                      <Badge variant={
                        rec.urgency.toLowerCase() === 'critical' ? 'destructive' :
                        rec.urgency.toLowerCase() === 'high' ? 'default' : 'secondary'
                      }>
                        {rec.urgency}
                      </Badge>
                    </div>
                    <h4 className="font-semibold text-base">{rec.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{rec.department}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-600">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AED', minimumFractionDigits: 0 }).format(rec.budget)}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{rec.rationale}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Implementation Strategy by Quarter */}
      {hasRealAiInsights && aiInsights.successMetrics.length > 0 && (
        <Card className="border border-purple-500/30" data-testid="card-implementation-strategy">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              Quarterly Implementation Strategy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(aiInsights.implementationStrategy.q1Focus || aiInsights.implementationStrategy.q2Focus || aiInsights.implementationStrategy.q3Q4Focus || aiInsights.budgetOptimization) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {(aiInsights.implementationStrategy.q1Focus || aiInsights.implementationStrategy.q2Focus) && (
                  <div className="p-4 border border-blue-500/30 rounded-lg bg-blue-50/30 dark:bg-blue-950/20">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <span className="text-blue-500">{t('demand.managementPlan.q1Q2Focus')}</span>
                    </h4>
                    <p className="text-sm">{aiInsights.implementationStrategy.q1Focus} {aiInsights.implementationStrategy.q2Focus}</p>
                  </div>
                )}
                {aiInsights.implementationStrategy.q3Q4Focus && (
                  <div className="p-4 border border-purple-500/30 rounded-lg bg-purple-50/30 dark:bg-purple-950/20">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <span className="text-purple-500">{t('demand.managementPlan.q3Q4Focus')}</span>
                    </h4>
                    <p className="text-sm">{aiInsights.implementationStrategy.q3Q4Focus}</p>
                  </div>
                )}
                {aiInsights.budgetOptimization && (
                  <div className="p-4 border border-emerald-500/30 rounded-lg bg-emerald-50/30 dark:bg-emerald-950/20">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <span className="text-emerald-500">{t('demand.managementPlan.budgetOptimization')}</span>
                    </h4>
                    <p className="text-sm">{aiInsights.budgetOptimization}</p>
                  </div>
                )}
              </div>
            )}

            <div className="p-4 border border-amber-500/30 rounded-lg bg-amber-50/30 dark:bg-amber-950/20">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Target className="h-5 w-5 text-amber-500" />
                {t('demand.managementPlan.successMetrics')}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {aiInsights.successMetrics.map((metric, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span>{metric}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
