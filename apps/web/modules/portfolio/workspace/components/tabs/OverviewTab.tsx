import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Target,
  TrendingUp,
  CalendarDays,
  Layers,
  FileText,
  BarChart3,
  GitBranch,
  XCircle,
  CircleDot,
  Users,
  Compass,
  Shield,
  ArrowRight,
} from "lucide-react";
import type { 
  ProjectData, 
  ManagementSummary, 
  DemandReportData, 
  BusinessCaseData,
  GateData,
} from "../../types";
import type {
  NormalizedFinancialData,
  NormalizedStakeholder,
  NormalizedStrategicFit,
  NormalizedStrategicObjectives,
  BusinessCaseWithStrategicObjectives,
} from "../../utils/normalizers";
import { normalizeStakeholders, normalizeStrategicFit, normalizeStrategicObjectives } from "../../utils/normalizers";

const riskLevelColors: Record<string, string> = {
  low: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  high: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  critical: 'bg-red-700/10 text-red-700 dark:text-red-300 border-red-700/30',
};

const priorityColors: Record<string, string> = {
  low: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  high: 'bg-red-500/10 text-red-600 dark:text-red-400',
  critical: 'bg-red-700/10 text-red-700 dark:text-red-300',
};

interface OverviewTabProps {
  project: ProjectData;
  summary?: ManagementSummary['summary'];
  management?: ManagementSummary;
  demandReport?: DemandReportData;
  businessCase?: BusinessCaseData;
  financials?: NormalizedFinancialData;
}

export function OverviewTab({ project, summary, management, demandReport, businessCase, financials }: OverviewTabProps) {
  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null || amount === 0) return 'N/A';
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const gates = management?.gates || [];

  // Fetch WBS tasks for earned-value progress calculation
  const wbsQuery = useQuery<{ success: boolean; data: Array<{ id: string; progress: number; estimatedHours?: number; status: string }> }>({
    queryKey: ['/api/portfolio/projects', project.id, 'wbs'],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/projects/${project.id}/wbs`);
      if (!res.ok) return { success: false, data: [] };
      return res.json();
    },
    enabled: !!project.id,
  });

  // Fetch WBS approval status
  const wbsApprovalQuery = useQuery<{ success: boolean; data?: { status: string } }>({
    queryKey: ['/api/portfolio/projects', project.id, 'wbs', 'approval'],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/projects/${project.id}/wbs/approval`);
      if (!res.ok) return { success: false };
      return res.json();
    },
    enabled: !!project.id,
  });

  const wbsTasks = wbsQuery.data?.data || [];
  const wbsApproved = wbsApprovalQuery.data?.data?.status === 'approved';

  const gateOverview = useQuery<{ currentPhase: string; overallProgress: number; phases: Array<{ phase: string; status: string; readinessScore: number }> }>({
    queryKey: ['/api/gates', project.id, 'overview'],
    queryFn: async () => {
      const res = await fetch(`/api/gates/${project.id}/overview`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.data;
    },
  });
  
  // Normalize stakeholders from demand report and business case - with safety checks
  const bc = businessCase?.content || businessCase;
  const dr = demandReport?.content || demandReport;
  let normalizedStakeholders: NormalizedStakeholder[] = [];
  try {
    normalizedStakeholders = normalizeStakeholders({
      demandReport: dr ? {
        requestorName: (dr as any).requestorName, // eslint-disable-line @typescript-eslint/no-explicit-any
        requestorEmail: (dr as any).requestorEmail, // eslint-disable-line @typescript-eslint/no-explicit-any
        demandOwner: (dr as any).demandOwner, // eslint-disable-line @typescript-eslint/no-explicit-any
        contactPerson: (dr as any).contactPerson, // eslint-disable-line @typescript-eslint/no-explicit-any
        stakeholders: (dr as any).stakeholders, // eslint-disable-line @typescript-eslint/no-explicit-any
        keyStakeholders: (dr as any).keyStakeholders, // eslint-disable-line @typescript-eslint/no-explicit-any
        organizationName: (dr as any).organizationName, // eslint-disable-line @typescript-eslint/no-explicit-any
        department: (dr as any).department, // eslint-disable-line @typescript-eslint/no-explicit-any
      } : undefined,
      businessCase: bc ? {
        stakeholders: (bc as any).stakeholders, // eslint-disable-line @typescript-eslint/no-explicit-any
        keyStakeholders: (bc as any).keyStakeholders, // eslint-disable-line @typescript-eslint/no-explicit-any
        stakeholderAnalysis: (bc as any).stakeholderAnalysis, // eslint-disable-line @typescript-eslint/no-explicit-any
      } : undefined,
    });
  } catch (e) {
    console.error('OverviewTab: Error normalizing stakeholders:', e);
  }
  
  // Normalize strategic fit analysis - with safety checks
  let strategicFit: NormalizedStrategicFit | null = null;
  try {
    strategicFit = normalizeStrategicFit({
      strategicFitAnalysis: (dr as any)?.strategicFitAnalysis || demandReport?.strategicFitAnalysis, // eslint-disable-line @typescript-eslint/no-explicit-any
      strategicAlignment: (bc as any)?.strategicAlignment || businessCase?.strategicAlignment, // eslint-disable-line @typescript-eslint/no-explicit-any
    });
  } catch (e) {
    console.error('OverviewTab: Error normalizing strategic fit:', e);
  }
  
  // Also normalize strategic objectives from business case (fallback view)
  let strategicObjectives: NormalizedStrategicObjectives | null = null;
  try {
    strategicObjectives = normalizeStrategicObjectives(
      (bc || businessCase) as BusinessCaseWithStrategicObjectives | null
    );
  } catch (e) {
    console.error('OverviewTab: Error normalizing strategic objectives:', e);
  }
  
  // Helper to format route names for display
  const formatRouteName = (route: string) => {
    const routeLabels: Record<string, string> = {
      'VENDOR_MANAGEMENT': 'Vendor Management (RFP)',
      'PMO_OFFICE': 'PMO Office',
      'IT_DEVELOPMENT': 'IT Development Team',
      'HYBRID': 'Hybrid Approach',
    };
    return routeLabels[route] || route;
  };
  
  // Get route badge color
  const getRouteColor = (route: string) => {
    const colors: Record<string, string> = {
      'VENDOR_MANAGEMENT': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
      'PMO_OFFICE': 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
      'IT_DEVELOPMENT': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      'HYBRID': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    };
    return colors[route] || 'bg-muted text-muted-foreground';
  };
  // PMI-weighted progress calculation with WBS earned value
  // Mirrors server-side recalculateProjectProgress() in wbs.useCases.ts
  const calculateOverallProgress = () => {
    const phases = ['intake', 'initiation', 'planning', 'execution', 'monitoring', 'closure'];
    const weights = { initiation: 5, planning: 15, execution: 50, monitoring: 20, closure: 10 };

    const effectiveCurrentPhase = gateOverview.data?.currentPhase || project.currentPhase || 'initiation';
    const normalizedCurrent = effectiveCurrentPhase === 'intake' ? 'initiation' : effectiveCurrentPhase;
    const phaseIdx = Math.max(phases.indexOf(normalizedCurrent), 0);

    const hasWbs = wbsTasks.length > 0;

    // Earned-value WBS completion — weight by estimated hours, fallback equal weight
    let wbsCompletion = 0;
    if (hasWbs) {
      let totalWeight = 0;
      let weightedProgress = 0;
      for (const t of wbsTasks) {
        const hours = Number(t.estimatedHours || 0);
        const w = hours > 0 ? hours : 1;
        totalWeight += w;
        weightedProgress += w * Number(t.progress || 0);
      }
      wbsCompletion = totalWeight > 0 ? weightedProgress / totalWeight : 0;
    }

    let progress = 0;

    // Initiation (5%): complete if past initiation
    if (phaseIdx >= 2) {
      progress += weights.initiation;
    } else if (phaseIdx === 1) {
      progress += weights.initiation * 0.5;
    }

    // Planning (15%): WBS approved = 100%, WBS exists = 80%, else 20%
    if (phaseIdx >= 3) {
      progress += weights.planning;
    } else if (phaseIdx === 2) {
      if (wbsApproved) {
        progress += weights.planning;
      } else if (hasWbs) {
        progress += weights.planning * 0.8;
      } else {
        progress += weights.planning * 0.2;
      }
    }

    // Execution (50%): WBS task weighted completion (earned value)
    if (phaseIdx >= 3 && hasWbs) {
      progress += weights.execution * (wbsCompletion / 100);
    } else if (phaseIdx >= 3 && !hasWbs) {
      progress += weights.execution * ((project.phaseProgress || 0) / 100);
    }

    // Monitoring (20%): tracks execution progress
    if (phaseIdx >= 4) {
      progress += weights.monitoring * (wbsCompletion / 100);
    } else if (phaseIdx === 3 && hasWbs) {
      progress += weights.monitoring * (wbsCompletion / 100) * 0.5;
    }

    // Closure (10%): only when in closure phase and all tasks done
    if (phaseIdx >= 5) {
      const allDone = hasWbs ? wbsTasks.every(t => Number(t.progress || 0) >= 100) : true;
      progress += allDone ? weights.closure : weights.closure * 0.3;
    }

    return Math.min(Math.round(progress), 100);
  };

  const overallProgress = calculateOverallProgress();

  const getPhaseGateStatus = (phase: string) => {
    const gate = gates.find((g: GateData) => g.gateType === phase);
    return gate?.status || gate?.decision || 'not_started';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-card/60 border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-base">Project Progress (PMI Weighted)</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Overall {overallProgress}%</Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                Phase {project.phaseProgress || 0}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Overall Project Progress</span>
                <span className="font-medium text-foreground">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-3" />
            </div>
            <div className="grid grid-cols-5 gap-4">
              {['initiation', 'planning', 'execution', 'monitoring', 'closure'].map((phase, index) => {
                const gateStatus = getPhaseGateStatus(phase);
                const phaseWeight = [10, 20, 50, 10, 10][index];
                const isApproved = gateStatus === 'approved' || gateStatus === 'go';
                const isCurrent = project.currentPhase === phase;
                
                return (
                  <div 
                    key={phase}
                    className={`text-center p-3 rounded-lg border transition-colors ${
                      isCurrent 
                        ? 'bg-primary/20 border-primary/50' 
                        : isApproved
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30'
                          : 'bg-muted/30 border-border/50'
                    }`}
                    data-testid={`phase-indicator-${phase}`}
                  >
                    <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-sm ${
                      isApproved ? 'bg-emerald-500' :
                      isCurrent ? 'bg-primary' : 'bg-muted'
                    }`}>
                      {isApproved ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">{phase}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-1">{phaseWeight}% weight</div>
                    {isCurrent && (
                      <Badge className="mt-1 text-[9px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">
                        Current
                      </Badge>
                    )}
                    {isApproved && !isCurrent && (
                      <Badge className="mt-1 text-[9px] px-1.5 py-0 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        Approved
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/60 border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{summary?.openRisks || 0}</div>
                  <div className="text-xs text-muted-foreground">Open Risks</div>
                </div>
              </div>
              {summary?.criticalRisks ? (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">{summary.criticalRisks} Critical</div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-card/60 border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <Bug className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{summary?.openIssues || 0}</div>
                  <div className="text-xs text-muted-foreground">Open Issues</div>
                </div>
              </div>
              {summary?.criticalIssues ? (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">{summary.criticalIssues} Critical</div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-card/60 border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{summary?.pendingApprovals || 0}</div>
                  <div className="text-xs text-muted-foreground">Pending Approvals</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{summary?.taskProgress || 0}%</div>
                  <div className="text-xs text-muted-foreground">Task Completion</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {summary?.completedTasks}/{summary?.totalTasks} tasks
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {management?.risks?.slice(0, 3).map((risk) => (
                <div key={risk.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{risk.title}</div>
                    <div className="text-xs text-muted-foreground">Risk identified - {risk.riskCode}</div>
                  </div>
                  <Badge className={riskLevelColors[risk.riskLevel] || ''} variant="outline">
                    {risk.riskLevel}
                  </Badge>
                </div>
              ))}
              {management?.issues?.slice(0, 2).map((issue) => (
                <div key={issue.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <Bug className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{issue.title}</div>
                    <div className="text-xs text-muted-foreground">Issue reported - {issue.issueCode}</div>
                  </div>
                  <Badge className={priorityColors[issue.priority] || ''}>
                    {issue.priority}
                  </Badge>
                </div>
              ))}
              {(!management?.risks?.length && !management?.issues?.length) && (
                <div className="text-center text-muted-foreground/70 py-4">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Total Project Cost</div>
              <div className="text-xl font-bold text-foreground">
                {formatCurrency(
                  project.totalBudget || 
                  financials?.totalCost ||
                  demandReport?.estimatedBudget
                )}
              </div>
              {project.actualSpend ? (
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={Math.min((project.actualSpend / (project.totalBudget || financials?.totalCost || 1)) * 100, 100)} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground">
                    {Math.round((project.actualSpend / (project.totalBudget || financials?.totalCost || 1)) * 100)}% spent
                  </span>
                </div>
              ) : null}
            </div>
            <Separator className="bg-border/50" />
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Expected ROI</span>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {financials?.roi ? `${financials.roi.toFixed(1)}%` : 'N/A'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">NPV</span>
              <span className="text-sm font-semibold">
                {formatCurrency(financials?.npv)}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Payback Period</span>
              <span className="text-sm font-semibold">
                {financials?.paybackPeriod ? `${financials.paybackPeriod.toFixed(1)} years` : 'N/A'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Total Benefits</span>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(financials?.totalBenefit)}
              </span>
            </div>
          </CardContent>
        </Card>

        {strategicFit ? (
          <Card className="bg-card/60 border-border" data-testid="card-strategic-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Compass className="w-4 h-4 text-primary" />
                Strategic Fit Intelligence
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {strategicFit.source === 'demand_ai' ? 'AI Analysis' : 'Business Case'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground mb-2">Recommended Implementation Route</div>
                <Badge className={`${getRouteColor(strategicFit.recommendedRoute)} border`}>
                  <ArrowRight className="w-3 h-3 mr-1" />
                  {formatRouteName(strategicFit.recommendedRoute)}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Confidence Score</span>
                <div className="flex items-center gap-2">
                  <Progress value={strategicFit.confidenceScore} className="h-1.5 w-16" />
                  <span className={`text-sm font-semibold ${
                    strategicFit.confidenceScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                    strategicFit.confidenceScore >= 60 ? 'text-amber-600 dark:text-amber-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {strategicFit.confidenceScore}%
                  </span>
                </div>
              </div>
              
              {strategicFit.reasoning && (
                <>
                  <Separator className="bg-border/50" />
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Recommendation Rationale</div>
                    <div className="text-sm text-foreground/80 line-clamp-3">{strategicFit.reasoning}</div>
                  </div>
                </>
              )}
              
              {strategicFit.keyFactors.length > 0 && (
                <>
                  <Separator className="bg-border/50" />
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Key Decision Factors</div>
                    <div className="flex flex-wrap gap-1.5">
                      {strategicFit.keyFactors.slice(0, 4).map((factor, idx) => (
                        <Badge key={idx} variant="outline" className="text-[10px] bg-muted/30">
                          {factor}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
              
              {strategicFit.estimatedTimeToStart && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Est. Time to Start</span>
                  <span className="text-sm font-medium">{strategicFit.estimatedTimeToStart}</span>
                </div>
              )}
              
              {strategicFit.governanceRequirements.approvalAuthority && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Approval Authority
                  </span>
                  <span className="text-sm text-foreground/80 text-right max-w-[60%] truncate">
                    {strategicFit.governanceRequirements.approvalAuthority}
                  </span>
                </div>
              )}
              
              {strategicFit.governanceRequirements.complianceFrameworks.length > 0 && (
                <>
                  <Separator className="bg-border/50" />
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Compliance Frameworks</div>
                    <div className="flex flex-wrap gap-1">
                      {strategicFit.governanceRequirements.complianceFrameworks.slice(0, 3).map((fw, idx) => (
                        <Badge key={idx} variant="outline" className="text-[10px]">
                          {fw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ) : strategicObjectives && strategicObjectives.objectives.length > 0 ? (
          <Card className="bg-card/60 border-border" data-testid="card-strategic-objectives">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Strategic Alignment
                <Badge variant="outline" className="ml-auto text-[10px]">
                  Business Case
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground mb-2">Strategic Objectives</div>
                <div className="space-y-2">
                  {strategicObjectives.objectives.map((objective, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <span className="text-sm text-foreground/80">{objective}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {project.strategicAlignment !== undefined && project.strategicAlignment !== null && (
                <>
                  <Separator className="bg-border/50" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Alignment Score</span>
                    <div className="flex items-center gap-2">
                      <Progress value={project.strategicAlignment} className="h-1.5 w-16" />
                      <span className={`text-sm font-semibold ${
                        project.strategicAlignment >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                        project.strategicAlignment >= 60 ? 'text-amber-600 dark:text-amber-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {project.strategicAlignment}%
                      </span>
                    </div>
                  </div>
                </>
              )}
              
              <div className="text-[10px] text-muted-foreground/70 italic">
                {strategicObjectives.source}
              </div>
            </CardContent>
          </Card>
        ) : null}
        
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Timeline & Baseline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Baseline Start</div>
                <div className="text-sm font-medium">
                  {project.plannedStartDate 
                    ? new Date(project.plannedStartDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'Not set'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Baseline End</div>
                <div className="text-sm font-medium">
                  {project.plannedEndDate 
                    ? new Date(project.plannedEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'Not set'}
                </div>
              </div>
            </div>
            <Separator className="bg-border/50" />
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Actual Start</div>
                <div className="text-sm font-medium">
                  {project.startDate 
                    ? new Date(project.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'Not started'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Actual End</div>
                <div className="text-sm font-medium">
                  {project.endDate 
                    ? new Date(project.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'In progress'}
                </div>
              </div>
            </div>
            
            {project.plannedStartDate && project.plannedEndDate && (
              <>
                <Separator className="bg-border/50" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Planned Duration</span>
                  <span className="text-sm font-semibold">
                    {Math.ceil((new Date(project.plannedEndDate).getTime() - new Date(project.plannedStartDate).getTime()) / (1000 * 60 * 60 * 24))} days
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Project Manager</div>
              <div className="text-sm">{project.projectManager || 'Not assigned'}</div>
            </div>
            <Separator className="bg-border/50" />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Sponsor</div>
              <div className="text-sm">{project.sponsor || 'Not assigned'}</div>
            </div>
            <Separator className="bg-border/50" />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Documents</div>
              <div className="text-sm">{summary?.documentCount || 0} files</div>
            </div>
          </CardContent>
        </Card>
        
        {/* Key Stakeholders from Demand Report & Business Case */}
        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                Key Stakeholders
              </CardTitle>
              {normalizedStakeholders.length > 0 && (
                <Badge variant="outline" className="text-[10px] gap-1 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
                  <Layers className="w-2.5 h-2.5" />
                  Auto-populated
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {normalizedStakeholders.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    s.source === 'demand_report' 
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600' 
                      : 'bg-gradient-to-br from-amber-500 to-orange-600'
                  }`}>
                    {(s.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span>{s.role || s.title || 'Stakeholder'}</span>
                      {s.organization && (
                        <>
                          <span className="text-muted-foreground/50">-</span>
                          <span className="truncate">{s.organization}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[9px] ${
                    s.source === 'demand_report' 
                      ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                      : 'text-amber-600 dark:text-amber-400 border-amber-500/30'
                  }`}>
                    {s.source === 'demand_report' ? 'Demand' : 'BC'}
                  </Badge>
                </div>
              ))}
              {normalizedStakeholders.length === 0 && (
                <div className="text-sm text-muted-foreground/70 italic text-center py-3">
                  {summary?.stakeholderCount && summary.stakeholderCount > 0 
                    ? `${summary.stakeholderCount} project stakeholders registered`
                    : 'No stakeholders identified'}
                </div>
              )}
              {normalizedStakeholders.length > 5 && (
                <div className="text-xs text-muted-foreground text-center pt-2">
                  +{normalizedStakeholders.length - 5} more stakeholders
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gate Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {management?.gates?.slice(0, 5).map((gate) => (
                <div key={gate.id} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    gate.status === 'passed' ? 'bg-emerald-500' :
                    gate.status === 'pending' ? 'bg-amber-500' :
                    gate.status === 'failed' ? 'bg-red-500' : 'bg-muted-foreground'
                  }`}>
                    {gate.status === 'passed' ? <CheckCircle2 className="w-4 h-4" /> :
                     gate.status === 'failed' ? <XCircle className="w-4 h-4" /> :
                     <CircleDot className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{gate.gateName}</div>
                    <div className="text-xs text-muted-foreground">{gate.gateType}</div>
                  </div>
                </div>
              ))}
              {!management?.gates?.length && (
                <div className="text-center text-muted-foreground/70 py-4">No gates defined</div>
              )}
            </div>
          </CardContent>
        </Card>

        {(demandReport || businessCase) && (
          <Card className="bg-gradient-to-br from-primary/10 to-background dark:from-indigo-900/40 dark:to-slate-900/60 border-primary/20 dark:border-indigo-800/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Source Data Lineage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {demandReport && (
                <div className="p-3 bg-muted/40 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs text-muted-foreground">Demand Report</span>
                  </div>
                  {demandReport.businessObjective ? (
                    <div className="text-sm font-medium mb-1 truncate">
                      {demandReport.businessObjective.length > 60 
                        ? `${demandReport.businessObjective.substring(0, 60)}...`
                        : demandReport.businessObjective}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground/70 italic mb-1">No objective specified</div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    {demandReport.organizationName && (
                      <Badge variant="outline" className="text-xs">{demandReport.organizationName}</Badge>
                    )}
                    {demandReport.department && <span>{demandReport.department}</span>}
                  </div>
                  {demandReport.budgetRange && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Budget: {demandReport.budgetRange}
                    </div>
                  )}
                </div>
              )}
              {businessCase && (
                <div className="p-3 bg-muted/40 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs text-muted-foreground">Business Case</span>
                  </div>
                  {(businessCase.projectName || businessCase.title) ? (
                    <div className="text-sm font-medium mb-1 truncate">
                      {businessCase.projectName || businessCase.title}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground/70 italic mb-1">Untitled Business Case</div>
                  )}
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    {businessCase.totalCost && (
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Cost:</span>
                        <span className="text-foreground">{formatCurrency(Number(businessCase.totalCost))}</span>
                      </div>
                    )}
                    {businessCase.roi && (
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">ROI:</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{businessCase.roi}%</span>
                      </div>
                    )}
                  </div>
                  {Array.isArray(businessCase.identifiedRisks) && businessCase.identifiedRisks.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      {businessCase.identifiedRisks.length} risks auto-populated
                    </div>
                  )}
                  {Array.isArray(businessCase.implementationPhases) && businessCase.implementationPhases.length > 0 && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400">
                      <GitBranch className="w-3 h-3" />
                      {businessCase.implementationPhases.length} WBS phases auto-populated
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
