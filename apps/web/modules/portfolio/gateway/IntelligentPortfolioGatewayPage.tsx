import { useEffect, useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';
import { apiRequest, queryClient as _qc } from "@/lib/queryClient";
import { type PortfolioProject as SchemaPortfolioProject, PROJECT_PHASES, type WorkspacePath } from "@shared/schema";
import {
  BarChart, Bar, LineChart as _LineChart, Line as _Line, AreaChart as _AreaChart, Area as _Area, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend as _Legend, ResponsiveContainer, Cell,
  RadarChart as _RadarChart, Radar as _Radar, PolarGrid as _PolarGrid, PolarAngleAxis as _PolarAngleAxis, PolarRadiusAxis as _PolarRadiusAxis, ComposedChart as _ComposedChart
} from 'recharts';
import {
  FolderKanban,
  LayoutDashboard,
  Inbox,
  ClipboardList,
  Shield,
  TrendingUp,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Plus,
  ChevronRight,
  Activity,
  Target,
  Loader2,
  BarChart3,
  Calendar,
  FileCheck,
  Play as _Play,
  Pause,
  ArrowUpRight,
  ArrowDownRight,
  Filter as _Filter,
  Search,
  Zap,
  Building2,
  Eye,
  RefreshCw,
  FileText,
  Sparkles,
  XCircle,
  MapPin as _MapPin,
  CircleDollarSign,
  LayoutList,
  LayoutGrid,
  List,
  Gauge,
  CircleDot as _CircleDot,
  Layers as _Layers,
  Wallet,
  Rocket,
  Globe as _Globe,
  Award,
  GitBranch,
  TrendingDown,
  Lightbulb,
  Star,
} from "lucide-react";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import { useAuth } from "@/contexts/AuthContext";
import { userHasEffectivePermission, type CustomPermissions, type Role, type Permission } from "@shared/permissions";
import { ConvertDialog, RejectDemandDialog } from "./dialogs";
import { PhaseTransitionDialog, WorkspacePathSelectionDialog } from "./IntelligentPortfolioGatewayDialogs";
import { extractBudgetRange } from "./utils";

const PORTFOLIO_TAB_PERMISSIONS = {
  overview: "portfolio:tab:overview",
  pipeline: "portfolio:tab:pipeline",
  projects: "portfolio:tab:projects",
  governance: "portfolio:tab:governance",
  insights: "portfolio:tab:insights",
} as const;

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

type PortfolioProject = SchemaPortfolioProject;

type PortfolioSummary = {
  totalProjects: number;
  byPhase: Record<string, number>;
  byHealth: Record<string, number>;
  totalBudget: number;
  totalSpend: number;
  avgProgress: number;
};

export type PipelineItem = {
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

type PortfolioManagementUnit = {
  id: string;
  name: string;
  sector: string;
  description: string;
  status: 'active' | 'archived';
  manager: { id: string; displayName: string; email: string } | null;
  memberCount: number;
  projectCount: number;
  atRiskCount: number;
  totalBudget: number;
};

const PHASE_COLORS: Record<string, string> = {
  intake: "bg-slate-500",
  triage: "bg-slate-600",
  governance: "bg-blue-500",
  analysis: "bg-purple-500",
  approved: "bg-indigo-500",
  planning: "bg-cyan-500",
  execution: "bg-amber-500",
  monitoring: "bg-orange-500",
  closure: "bg-emerald-500",
  completed: "bg-green-600",
  on_hold: "bg-gray-400",
  cancelled: "bg-red-500",
};

const PHASE_ORDER = PROJECT_PHASES;

const HEALTH_COLORS: Record<string, string> = {
  on_track: "bg-emerald-500",
  at_risk: "bg-amber-500",
  critical: "bg-red-500",
  on_hold: "bg-slate-400",
};

function formatCurrency(amount: number | string | null | undefined): string {
  if (!amount) return "AED 0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "AED 0";
  if (num >= 1000000) {
    return `AED ${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `AED ${(num / 1000).toFixed(0)}K`;
  }
  return `AED ${num.toLocaleString()}`;
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Extract just the budget range from AI-generated detailed budget text
// e.g., "AED 300M–900M over 36 months (capex: vehicles...)" -> "AED 300M–900M"

function _SummaryMetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  trendUp = true,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  label: string;
  value: string;
  subValue?: string;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <div
      className="glass-card rounded-lg p-4 bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow"
      role="region"
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider truncate">{label}</p>
          <p className="text-2xl font-bold mt-1 truncate">{value}</p>
          {subValue && <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>}
          {trend && (
            <div
              className={`flex items-center gap-1 mt-1 text-xs ${
                trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              <TrendingUp className={`h-3 w-3 ${!trendUp && "rotate-180"}`} aria-hidden="true" />
              <span>{trend}</span>
            </div>
          )}
        </div>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function _PhaseDistribution({ byPhase }: { byPhase: Record<string, number> }) {
  const total = Object.values(byPhase).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        {PHASE_ORDER.map((phase) => {
          const count = byPhase[phase] || 0;
          if (count === 0) return null;
          const width = (count / total) * 100;
          return (
            <div
              key={phase}
              className={`${PHASE_COLORS[phase]} transition-all`}
              style={{ width: `${width}%` }}
              title={`${phase}: ${count} projects`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {PHASE_ORDER.map((phase) => {
          const count = byPhase[phase] || 0;
          if (count === 0) return null;
          return (
            <div key={phase} className="flex items-center gap-1.5 text-xs">
              <div className={`h-2 w-2 rounded-full ${PHASE_COLORS[phase]}`} />
              <span className="capitalize text-muted-foreground">{phase}</span>
              <span className="font-medium">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HealthIndicator({ status }: { status: string }) {
  const { t } = useTranslation();
  const labels: Record<string, string> = {
    on_track: t('portfolio.gateway.health.onTrack'),
    at_risk: t('portfolio.gateway.health.atRisk'),
    critical: t('portfolio.gateway.health.critical'),
    on_hold: t('portfolio.gateway.health.onHold'),
  };

  return (
    <Badge variant="outline" className="gap-1.5">
      <div className={`h-2 w-2 rounded-full ${HEALTH_COLORS[status] || "bg-slate-400"}`} />
      {labels[status] || status}
    </Badge>
  );
}

function ProjectCard({ project, onClick }: { project: PortfolioProject; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Card
      className="hover-elevate cursor-pointer"
      onClick={onClick}
      role="button"
      aria-label={`View project ${project.projectName}`}
      data-testid={`card-project-${project.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs font-mono">
                {project.projectCode}
              </Badge>
              <Badge className={`${PHASE_COLORS[project.currentPhase]} text-xs capitalize text-white border-0`}>
                {project.currentPhase}
              </Badge>
            </div>
            <h4 className="font-medium truncate">{project.projectName}</h4>
          </div>
          <HealthIndicator status={project.healthStatus || 'on_track'} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('portfolio.gateway.progress')}</span>
            <span className="font-medium">{project.overallProgress || 0}%</span>
          </div>
          <Progress value={project.overallProgress || 0} className="h-2" />
        </div>

        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            {formatCurrency(project.approvedBudget)}
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {project.plannedEndDate ? formatDate(project.plannedEndDate) : t('portfolio.gateway.noDeadline')}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function _PipelineCard({
  item,
  onConvert,
  isConverting,
}: {
  item: PipelineItem;
  onConvert: (item: PipelineItem) => void;
  isConverting: boolean;
}) {
  const urgencyColors: Record<string, string> = {
    High: "bg-red-500 text-white",
    Medium: "bg-amber-500 text-white",
    Low: "bg-slate-500 text-white",
  };

  return (
    <Card className="hover-elevate" data-testid={`card-pipeline-${item.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {item.projectId && (
                <Badge variant="secondary" className="text-xs font-mono bg-slate-100 dark:bg-slate-800" data-testid={`text-project-id-${item.id}`}>
                  {item.projectId}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                <Building2 className="h-3 w-3 mr-1" />
                {item.organizationName}
              </Badge>
              <Badge className={`text-xs ${urgencyColors[item.urgency] || "bg-slate-500 text-white"} border-0`}>
                {item.urgency}
              </Badge>
            </div>
            {item.suggestedProjectName && (
              <p className="text-sm font-semibold mb-1" data-testid={`text-project-name-${item.id}`}>{item.suggestedProjectName}</p>
            )}
            <p className="text-sm line-clamp-2">{item.businessObjective}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <span>{extractBudgetRange(item.budgetRange)}</span>
          <span>{formatDate(item.createdAt)}</span>
        </div>

        <div className="mt-3 pt-3 border-t space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs capitalize">
              {item.workflowStatus?.replace(/_/g, " ") || "Draft"}
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs capitalize ${
                item.requirementsVersionStatus === 'published' ? 'border-emerald-500 text-emerald-600' :
                item.requirementsVersionStatus === 'approved' ? 'border-blue-500 text-blue-600' :
                item.requirementsVersionStatus === 'manager_approval' ? 'border-amber-500 text-amber-600' :
                item.requirementsVersionStatus === 'under_review' ? 'border-purple-500 text-purple-600' :
                item.requirementsVersionStatus === 'draft' ? 'border-slate-400 text-slate-500' :
                'border-slate-300 text-slate-400'
              }`}
              data-testid={`badge-requirements-status-${item.id}`}
            >
              <FileText className="h-3 w-3 mr-1" />
              Req: {item.requirementsVersionStatus?.replace(/_/g, " ") || "Not generated"}
            </Badge>
          </div>
          <div className="flex items-center justify-end">
            <Link href={`/demand/${item.id}?tab=requirements`}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                data-testid={`button-view-requirements-${item.id}`}
              >
                <FileText className="h-3 w-3 mr-1" />
                {"View Requirements"}
              </Button>
            </Link>
          </div>
          <div className="flex justify-end">
            {item.hasPortfolioProject ? (
              <Badge variant="outline" className="text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {"In Portfolio"}
              </Badge>
            ) : (
              <Button
                size="sm"
                onClick={() => onConvert(item)}
                disabled={isConverting}
                data-testid={`button-convert-${item.id}`}
              >
                {isConverting ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3 mr-1" />
                )}
                {"Convert to Project"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PortfolioVisualizationMatrix({ items }: { items: PipelineItem[] }) {
  const { t } = useTranslation();
  const buckets = useMemo(() => {
    const result = {
      highAlign_lowRisk: [] as PipelineItem[],
      highAlign_highRisk: [] as PipelineItem[],
      lowAlign_lowRisk: [] as PipelineItem[],
      lowAlign_highRisk: [] as PipelineItem[],
    };

    items.forEach(item => {
      const alignment = item.strategicAlignment;
      const risk = item.complexityRisk;
      const highAlignment = alignment >= 50;
      const highRisk = risk >= 50;

      if (highAlignment && !highRisk) result.highAlign_lowRisk.push(item);
      else if (highAlignment && highRisk) result.highAlign_highRisk.push(item);
      else if (!highAlignment && !highRisk) result.lowAlign_lowRisk.push(item);
      else result.lowAlign_highRisk.push(item);
    });

    return result;
  }, [items]);

  const QuadrantCell = ({
    title,
    items: cellItems,
    bgClass,
    description
  }: {
    title: string;
    items: PipelineItem[];
    bgClass: string;
    description: string;
  }) => (
    <div className={`${bgClass} p-4 rounded-lg border`} data-testid={`quadrant-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold">{title}</h4>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary" className="text-sm">{cellItems.length}</Badge>
      </div>
      {cellItems.length > 0 ? (
        <div className="space-y-2">
          {cellItems.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-3 p-2 rounded-md bg-background/50">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className={`h-2 w-2 rounded-full shrink-0 ${item.urgency === 'High' ? 'bg-red-500' : item.urgency === 'Medium' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium truncate block">{item.suggestedProjectName || item.businessObjective?.substring(0, 40) || t('portfolio.gateway.notRecorded')}</span>
                  <span className="text-xs text-muted-foreground truncate block">{item.organizationName}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">{t('portfolio.gateway.alignLabel')}: {item.strategicAlignment || 0}%</span>
                <Badge variant="outline" className="text-xs">
                  {item.workflowStatus === 'manager_approved' ? t('portfolio.gateway.mgrBadge') : t('portfolio.gateway.iniBadge')}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-4 text-center">{t('portfolio.gateway.noDemandsInCategory')}</p>
      )}
    </div>
  );

  return (
    <div data-testid="portfolio-visualization-matrix">
      {/* 2x2 Matrix Grid - Full Width */}
      <div className="grid md:grid-cols-2 gap-4">
        <QuadrantCell
          title={t('portfolio.gateway.quadrantFastTrack')}
          description={t('portfolio.gateway.quadrantFastTrackDesc')}
          items={buckets.highAlign_lowRisk}
          bgClass="bg-emerald-50 dark:bg-emerald-950/20"
        />
        <QuadrantCell
          title={t('portfolio.gateway.quadrantPlanCarefully')}
          description={t('portfolio.gateway.quadrantPlanCarefullyDesc')}
          items={buckets.highAlign_highRisk}
          bgClass="bg-amber-50 dark:bg-amber-950/20"
        />
        <QuadrantCell
          title={t('portfolio.gateway.quadrantQuickWins')}
          description={t('portfolio.gateway.quadrantQuickWinsDesc')}
          items={buckets.lowAlign_lowRisk}
          bgClass="bg-blue-50 dark:bg-blue-950/20"
        />
        <QuadrantCell
          title={t('portfolio.gateway.quadrantReconsider')}
          description={t('portfolio.gateway.quadrantReconsiderDesc')}
          items={buckets.lowAlign_highRisk}
          bgClass="bg-red-50 dark:bg-red-950/20"
        />
      </div>
    </div>
  );
}

function PortfolioDecisionMatrix({ items }: { items: PipelineItem[] }) {
  const { t } = useTranslation();
  const decisions = useMemo(() => {
    return items.map(item => {
      const alignment = item.strategicAlignment;
      const risk = item.complexityRisk;
      const isHighUrgency = item.urgency === 'High';

      let recommendation: 'accelerate' | 'proceed' | 'hold' | 'reject';
      let rationale: string;
      let score: number;

      // Improved recommendation logic with balanced thresholds
      // accelerate: high alignment (60%+) AND low risk (<50%)
      if (alignment >= 60 && risk < 50) {
        recommendation = 'accelerate';
        rationale = t('portfolio.gateway.rationaleAccelerate');
        score = 85 + (isHighUrgency ? 10 : 0);
      // proceed: moderate-to-good alignment (45%+) AND acceptable risk (<70%)
      } else if (alignment >= 45 && risk < 70) {
        recommendation = 'proceed';
        rationale = t('portfolio.gateway.rationaleProceed');
        score = 65 + (isHighUrgency ? 10 : 0) + (alignment / 10);
      // hold: lower alignment but still viable, OR high risk needing mitigation
      } else if (alignment >= 30 || risk < 60) {
        recommendation = 'hold';
        rationale = t('portfolio.gateway.rationaleHold');
        score = 40 + (alignment / 5) + (isHighUrgency ? 5 : 0);
      // reject: only very low alignment (<30%) AND high risk (>=60%)
      } else {
        recommendation = 'reject';
        rationale = t('portfolio.gateway.rationaleReject');
        score = 15 + (alignment / 10);
      }

      return { ...item, recommendation, rationale, score };
    }).sort((a, b) => b.score - a.score);
  }, [items, t]);

  const recommendationColors: Record<string, string> = {
    accelerate: 'bg-emerald-500 text-white',
    proceed: 'bg-blue-500 text-white',
    hold: 'bg-amber-500 text-white',
    reject: 'bg-red-500 text-white',
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recommendationIcons: Record<string, any> = {
    accelerate: Zap,
    proceed: ArrowRight,
    hold: Pause,
    reject: AlertTriangle,
  };

  if (decisions.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground" data-testid="portfolio-decision-matrix">
        <FileCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{t('portfolio.gateway.noApprovedDemandsToEvaluate')}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2" data-testid="portfolio-decision-matrix">
      {decisions.map((item, idx) => {
        const Icon = recommendationIcons[item.recommendation];
        return (
          <div
            key={item.id}
            className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20"
            data-testid={`decision-row-${item.id}`}
          >
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-xs font-medium shrink-0">
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Badge className={`text-xs ${recommendationColors[item.recommendation]} border-0`}>
                  <Icon className="h-3 w-3 mr-1" />
                  {item.recommendation.charAt(0).toUpperCase() + item.recommendation.slice(1)}
                </Badge>
                <span className="text-xs text-muted-foreground">{t('portfolio.gateway.scoreLabel')}: {Math.round(item.score)}</span>
              </div>
              <p className="text-sm font-medium line-clamp-1">{item.organizationName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.rationale}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>{t('portfolio.gateway.alignLabel')}: {item.strategicAlignment}%</span>
                <span>{t('portfolio.gateway.riskLabel')}: {item.complexityRisk}%</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function IntelligentPortfolioGateway() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  // Compute which tabs this user is allowed to see
  const allowedTabs = useMemo(() => {
    if (!currentUser) return [] as string[];
    const cp = (currentUser.customPermissions ?? null) as CustomPermissions | null;
    return Object.entries(PORTFOLIO_TAB_PERMISSIONS)
      .filter(([, perm]) => userHasEffectivePermission(currentUser.role as Role, perm as Permission, cp))
      .map(([tab]) => tab);
  }, [currentUser]);

  // Helper: use useCallback so it's stable for useEffect dependency
  const isTabAllowed = useCallback((tab: string) => allowedTabs.includes(tab), [allowedTabs]);

  // Support deep-linking via ?tab=pipeline (used by PMO Pipeline button)
  const initialTab = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && ['overview', 'pipeline', 'projects', 'governance', 'insights'].includes(tab)) return tab;
    } catch { /* ignore */ }
    return 'overview';
  })();
  const initialPortfolioScope = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('portfolio') || 'all';
    } catch {
      return 'all';
    }
  })();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [portfolioScope, setPortfolioScope] = useState(initialPortfolioScope);

  // If active tab loses permission (e.g. admin revokes mid-session), fall back to first allowed
  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0] ?? "overview");
    }
  }, [allowedTabs, activeTab]);
  const [searchQuery, setSearchQuery] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedPipelineItem, setSelectedPipelineItem] = useState<PipelineItem | null>(null);
  const [workspacePathDialogOpen, setWorkspacePathDialogOpen] = useState(false);
  const [selectedWorkspacePath, setSelectedWorkspacePath] = useState<WorkspacePath>('standard');
  const [transitionDialogOpen, setTransitionDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<PortfolioProject | null>(null);
  const [pipelineView, setPipelineView] = useState<'matrix' | 'table'>('table');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedRejectItem, setSelectedRejectItem] = useState<PipelineItem | null>(null);
  const [demandsViewType, setDemandsViewType] = useState<'table' | 'grid' | 'compact'>('grid');

  useQuery<{ success: boolean; data: PortfolioSummary }>({
    queryKey: ["/api/portfolio/summary"],
  });

  const { data: projectsData, isLoading: projectsLoading } = useQuery<{ success: boolean; data: PortfolioProject[] }>({
    queryKey: ["/api/portfolio/projects"],
  });

  const { data: pipelineData, isLoading: pipelineLoading } = useQuery<{ success: boolean; data: PipelineItem[] }>({
    queryKey: ["/api/portfolio/pipeline"],
  });

  const { data: portfolioUnitsData } = useQuery<{ success: boolean; data: PortfolioManagementUnit[] }>({
    queryKey: ["/api/portfolio/units"],
  });

  const createProjectMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/demand-conversion-requests", {
        demandId: data.demandReportId,
        projectName: data.projectName,
        projectDescription: data.strategicObjective,
        priority: data.priority,
        proposedBudget: data.estimatedBudget ? parseFloat(data.estimatedBudget.replace(/[^0-9.]/g, '')) : null,
        proposedEndDate: data.targetDate || null,
        conversionData: {
          projectType: data.projectType,
          projectManager: data.projectManager,
          workspacePath: data.workspacePath,
          strategicObjective: data.strategicObjective,
        }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demand-conversion-requests"] });
      setConvertDialogOpen(false);
      setSelectedPipelineItem(null);
      toast({
        title: t('portfolio.gateway.submittedForApproval'),
        description: t('portfolio.gateway.submittedForApprovalDesc'),
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        title: t('portfolio.gateway.error'),
        description: error.message || t('portfolio.gateway.failedSubmitConversion'),
        variant: "destructive",
      });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ projectId, toPhase, reason, transitionType }: { projectId: string; toPhase: string; reason: string; transitionType: string }) => {
      const response = await apiRequest("POST", `/api/portfolio/projects/${projectId}/transition`, { toPhase, reason, transitionType });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      setTransitionDialogOpen(false);
      setSelectedProject(null);
      toast({
        title: t('portfolio.gateway.phaseTransitioned'),
        description: t('portfolio.gateway.phaseTransitionedDesc'),
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        title: t('portfolio.gateway.error'),
        description: error.message || t('portfolio.gateway.failedTransition'),
        variant: "destructive",
      });
    },
  });

  const rejectDemandMutation = useMutation({
    mutationFn: async ({ demandId, reason }: { demandId: string; reason: string }) => {
      const response = await apiRequest("PATCH", `/api/demands/${demandId}/status`, {
        status: "rejected",
        rejectionReason: reason
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demands"] });
      setRejectDialogOpen(false);
      setSelectedRejectItem(null);
      setRejectReason("");
      toast({
        title: t('portfolio.gateway.demandRejected'),
        description: t('portfolio.gateway.demandRejectedDesc'),
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        title: t('portfolio.gateway.error'),

        description: error.message || t('portfolio.gateway.failedRejectDemand'),

        variant: "destructive",
      });
    },
  });

  const allProjects = useMemo(() => projectsData?.data || [], [projectsData]);
  const allPipeline = useMemo(() => pipelineData?.data || [], [pipelineData]);
  const allPortfolioUnits = (portfolioUnitsData?.data || []).filter((unit) => unit.status === 'active');

  const getProjectDepartment = (project: typeof allProjects[number]) => {
    const metadata = project?.metadata as Record<string, unknown> | null;
    const metadataDept = typeof metadata?.department === "string" ? metadata.department : undefined;
    return metadataDept || project.projectManager || project.projectType || t('portfolio.gateway.other');
  };

  const getProjectUnitId = useCallback((project: typeof allProjects[number]) => {
    const metadata = project?.metadata as Record<string, unknown> | null;
    const raw = metadata?.portfolioUnitId;
    return typeof raw === 'string' ? raw : null;
  }, []);

  const getPipelineDepartment = useCallback((item: PipelineItem) => {
    return item.department || item.organizationName || t('portfolio.gateway.other');
  }, [t]);

  const portfolioScopes = useMemo(() => allPortfolioUnits.map((unit) => unit.id), [allPortfolioUnits]);

  const portfolioUnitsById = useMemo(() => {
    return new Map(allPortfolioUnits.map((unit) => [unit.id, unit]));
  }, [allPortfolioUnits]);

  const selectedPortfolioUnit = portfolioScope === 'all' ? null : portfolioUnitsById.get(portfolioScope) || null;

  const portfolioManagementUnits = useMemo(() => {
    return allPortfolioUnits.map((unit) => {
      const scopedPipeline = allPipeline.filter((item) => {
        if (item.hasPortfolioProject) return false;
        if (!unit.sector || unit.sector === 'General') return true;
        return getPipelineDepartment(item) === unit.sector;
      });
      return {
        scope: unit.id,
        label: unit.name,
        sector: unit.sector,
        projects: unit.projectCount,
        pipeline: scopedPipeline.length,
        atRiskProjects: unit.atRiskCount,
        budget: unit.totalBudget,
        managerName: unit.manager?.displayName || '-',
      };
    });
  }, [allPortfolioUnits, allPipeline, getPipelineDepartment]);

  const projects = useMemo(() => {
    if (portfolioScope === 'all') return allProjects;
    return allProjects.filter((project) => getProjectUnitId(project) === portfolioScope);
  }, [allProjects, portfolioScope, getProjectUnitId]);

  const pipeline = useMemo(() => {
    if (portfolioScope === 'all') return allPipeline;
    if (!selectedPortfolioUnit?.sector || selectedPortfolioUnit.sector === 'General') return allPipeline;
    return allPipeline.filter((item) => getPipelineDepartment(item) === selectedPortfolioUnit.sector);
  }, [allPipeline, portfolioScope, getPipelineDepartment, selectedPortfolioUnit]);

  useEffect(() => {
    if (portfolioScope !== 'all' && !portfolioScopes.includes(portfolioScope)) {
      setPortfolioScope('all');
    }
  }, [portfolioScope, portfolioScopes]);

  const selectedPortfolioScopeLabel = selectedPortfolioUnit?.name || t('portfolio.gateway.allPortfolios');

  const summaryLoading = projectsLoading || pipelineLoading;
  const summary = useMemo<PortfolioSummary>(() => {
    const byPhase = projects.reduce<Record<string, number>>((acc, project) => {
      const phase = project.currentPhase || 'unknown';
      acc[phase] = (acc[phase] || 0) + 1;
      return acc;
    }, {});
    const byHealth = projects.reduce<Record<string, number>>((acc, project) => {
      const health = project.healthStatus || 'unknown';
      acc[health] = (acc[health] || 0) + 1;
      return acc;
    }, {});
    const totalBudget = projects.reduce((sum, project) => sum + (parseFloat(project.approvedBudget || '0') || 0), 0);
    const totalSpend = projects.reduce((sum, project) => sum + (parseFloat(project.actualSpend || '0') || 0), 0);
    const avgProgress = projects.length > 0
      ? projects.reduce((sum, project) => sum + (project.overallProgress || 0), 0) / projects.length
      : 0;
    return {
      totalProjects: projects.length,
      byPhase,
      byHealth,
      totalBudget,
      totalSpend,
      avgProgress,
    };
  }, [projects]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', activeTab);
    if (portfolioScope !== 'all') {
      params.set('portfolio', portfolioScope);
    } else {
      params.delete('portfolio');
    }
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    window.history.replaceState({}, '', nextUrl);
  }, [activeTab, portfolioScope]);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        !searchQuery ||
        project.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.projectCode.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPhase = phaseFilter === "all" || project.currentPhase === phaseFilter;
      const matchesHealth = healthFilter === "all" || project.healthStatus === healthFilter;
      return matchesSearch && matchesPhase && matchesHealth;
    });
  }, [projects, searchQuery, phaseFilter, healthFilter]);

  const availableDemands = pipeline.filter((item) => !item.hasPortfolioProject);

  // Advanced computed metrics from real data
  const advancedMetrics = useMemo(() => {
    if (!projects || projects.length === 0) return null;

    // Budget analysis
    const totalApprovedBudget = projects.reduce((sum, p) => sum + (parseFloat(p.approvedBudget || '0') || 0), 0);
    const totalActualSpend = projects.reduce((sum, p) => sum + (parseFloat(p.actualSpend || '0') || 0), 0);
    const budgetVariance = totalApprovedBudget > 0 ? ((totalActualSpend - totalApprovedBudget) / totalApprovedBudget) * 100 : 0;
    const remainingBudget = totalApprovedBudget - totalActualSpend;

    // Phase breakdown with budget
    const phaseData: Record<string, { count: number; budget: number; avgProgress: number }> = {};
    projects.forEach(p => {
      const phase = p.currentPhase || 'unknown';
      if (!phaseData[phase]) {
        phaseData[phase] = { count: 0, budget: 0, avgProgress: 0 };
      }
      phaseData[phase].count++;
      phaseData[phase].budget += parseFloat(p.approvedBudget || '0') || 0;
      phaseData[phase].avgProgress += p.overallProgress || 0;
    });
    Object.keys(phaseData).forEach(phase => {
      if (phaseData[phase]!.count > 0) {
        phaseData[phase]!.avgProgress = phaseData[phase]!.avgProgress / phaseData[phase]!.count;
      }
    });

    // Health breakdown with budget impact
    const healthData: Record<string, { count: number; budget: number }> = {};
    projects.forEach(p => {
      const health = p.healthStatus || 'unknown';
      if (!healthData[health]) {
        healthData[health] = { count: 0, budget: 0 };
      }
      healthData[health].count++;
      healthData[health].budget += parseFloat(p.approvedBudget || '0') || 0;
    });

    // Timeline analysis
    const projectsWithTimeline = projects.filter(p => p.plannedStartDate && p.plannedEndDate);
    const onTimeProjects = projectsWithTimeline.filter(p => {
      const progress = p.overallProgress || 0;
      const start = new Date(p.plannedStartDate!);
      const end = new Date(p.plannedEndDate!);
      const now = new Date();
      const totalDuration = end.getTime() - start.getTime();
      const elapsed = now.getTime() - start.getTime();
      const expectedProgress = Math.min(100, (elapsed / totalDuration) * 100);
      return progress >= expectedProgress - 10; // Within 10% tolerance
    });
    const onTimeRate = projectsWithTimeline.length > 0
      ? (onTimeProjects.length / projectsWithTimeline.length) * 100
      : 0;

    // Department distribution
    const deptData: Record<string, { count: number; budget: number; health: string[] }> = {};
    projects.forEach(p => {
      const dept = getProjectDepartment(p);
      if (!deptData[dept]) {
        deptData[dept] = { count: 0, budget: 0, health: [] };
      }
      deptData[dept].count++;
      deptData[dept].budget += parseFloat(p.approvedBudget || '0') || 0;
      if (p.healthStatus) deptData[dept].health.push(p.healthStatus);
    });

    // Top performers (highest progress)
    const topPerformers = [...projects]
      .sort((a, b) => (b.overallProgress || 0) - (a.overallProgress || 0))
      .slice(0, 5);

    // At-risk projects needing attention
    const atRiskProjects = projects.filter(p =>
      p.healthStatus === 'at_risk' || p.healthStatus === 'critical'
    );

    // Projects by priority/urgency (from original demand)
    const criticalProjects = projects.filter(p => p.priority === 'critical' || p.priority === 'high');

    // Average project size
    const avgProjectBudget = projects.length > 0 ? totalApprovedBudget / projects.length : 0;

    // Completion forecast
    const avgProgressRate = projects.reduce((sum, p) => sum + (p.overallProgress || 0), 0) / projects.length;
    const estimatedCompletionMonths = avgProgressRate > 0 ? Math.ceil((100 - avgProgressRate) / (avgProgressRate / 3)) : 0;

    return {
      totalApprovedBudget,
      totalActualSpend,
      budgetVariance,
      remainingBudget,
      phaseData: Object.entries(phaseData).map(([phase, data]) => ({
        phase: phase.charAt(0).toUpperCase() + phase.slice(1).replace(/_/g, ' '),
        ...data
      })).sort((a, b) => b.budget - a.budget),
      healthData: Object.entries(healthData).map(([health, data]) => ({
        health: health.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        ...data
      })),
      deptData: Object.entries(deptData).map(([dept, data]) => ({
        department: dept,
        ...data,
        healthScore: data.health.filter(h => h === 'on_track').length / data.health.length * 100 || 0
      })).sort((a, b) => b.budget - a.budget).slice(0, 6),
      onTimeRate,

      topPerformers,
      atRiskProjects,
      criticalProjects,
      avgProjectBudget,
      estimatedCompletionMonths,
      projectCount: projects.length,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  // Pipeline analytics
  const pipelineAnalytics = useMemo(() => {
    if (!pipeline || pipeline.length === 0) return null;

    const totalPipelineBudget = pipeline.reduce((sum, item) =>
      sum + (parseFloat(item.estimatedBudget || '0') || 0), 0
    );

    const byUrgency = pipeline.reduce((acc, item) => {
      const urgency = item.urgency || 'medium';
      acc[urgency] = (acc[urgency] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byDepartment = pipeline.reduce((acc, item) => {
      const dept = item.department || 'Other';
      if (!acc[dept]) acc[dept] = { count: 0, budget: 0 };
      acc[dept].count++;
      acc[dept].budget += parseFloat(item.estimatedBudget || '0') || 0;
      return acc;
    }, {} as Record<string, { count: number; budget: number }>);

    const avgStrategicAlignment = pipeline.reduce((sum, item) =>
      sum + (item.strategicAlignment || 0), 0
    ) / pipeline.length;

    const avgComplexityRisk = pipeline.reduce((sum, item) =>
      sum + (item.complexityRisk || 0), 0
    ) / pipeline.length;

    return {
      totalPipelineBudget,
      byUrgency,
      byDepartment: Object.entries(byDepartment)
        .map(([dept, data]) => ({ department: dept, ...data }))
        .sort((a, b) => b.budget - a.budget),
      avgStrategicAlignment,
      avgComplexityRisk,
      readyToConvert: availableDemands.length,
      highPriority: (byUrgency['high'] || 0) + (byUrgency['critical'] || 0),
    };
  }, [pipeline, availableDemands]);

  const pendingConversionCount = pipeline.filter((item) => item.workflowStatus === 'pending_conversion').length;
  const readyToConvertCount = availableDemands.length;

  const handleConvert = (item: PipelineItem) => {
    setSelectedPipelineItem(item);
    setWorkspacePathDialogOpen(true);
  };

  const handleWorkspacePathSelect = (path: WorkspacePath) => {
    setSelectedWorkspacePath(path);
    setWorkspacePathDialogOpen(false);
    setConvertDialogOpen(true);
  };

  const handleReject = (item: PipelineItem) => {
    setSelectedRejectItem(item);
    setRejectDialogOpen(true);
  };

  const _handleTransition = (project: PortfolioProject) => {
    setSelectedProject(project);
    setTransitionDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background constellation-grid relative">
      <main className="w-full px-6 lg:px-10 py-6 relative z-10 pb-20">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 flex-shrink-0">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Button asChild variant="outline" size="icon" className="h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-primary/10" data-testid="button-back-portfolio-hub">
                <Link href="/portfolio-hub">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-white">
                <FolderKanban className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-bold">{t('portfolio.gateway.pageTitle')}</h1>
            </div>
            <p className="text-muted-foreground text-sm ml-28">
              {t('portfolio.gateway.pageSubtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
              }}
              data-testid="button-refresh"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {t('portfolio.gateway.refresh')}
            </Button>
            <Button size="sm" onClick={() => setActiveTab("pipeline")} data-testid="button-new-project" className="gap-2">
              <Plus className="h-4 w-4" />
              {t('portfolio.gateway.browsePipeline')}
            </Button>
          </div>
        </div>

        <div className="mb-3 rounded-lg border border-border/60 bg-card/60 p-2" data-testid="portfolio-management-units">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{t('portfolio.gateway.portfolioManagementSectors')}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{t('portfolio.gateway.portfolioManagementSectorsDesc')}</p>
            </div>
            <Badge variant="outline" className="h-5 text-[9px] px-1.5">{portfolioManagementUnits.length} units</Badge>
          </div>

          <div className="flex flex-wrap items-start gap-1">
            <button
              type="button"
              onClick={() => setPortfolioScope('all')}
              className={`w-full sm:w-[188px] sm:max-w-[188px] sm:flex-none h-[92px] rounded-md border px-2 py-1.5 text-left transition-colors flex flex-col justify-between ${
                portfolioScope === 'all'
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-border/60 hover:border-primary/40 hover:bg-muted/50'
              }`}
              data-testid="portfolio-unit-all"
            >
              <p className="text-[12px] font-bold text-foreground truncate leading-tight">All Portfolios</p>
              <div className="space-y-0.5 text-[9px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Sector</span>
                  <span className="font-medium text-foreground truncate">All</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Mgr</span>
                  <span className="font-medium text-foreground truncate">-</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">AED</span>
                  <span className="font-semibold text-foreground truncate">{formatCurrency(portfolioManagementUnits.reduce((sum, item) => sum + item.budget, 0))}</span>
                </div>
              </div>
            </button>

            {portfolioManagementUnits.map((unit) => (
              <button
                key={unit.scope}
                type="button"
                onClick={() => setPortfolioScope(unit.scope)}
                className={`w-full sm:w-[188px] sm:max-w-[188px] sm:flex-none h-[92px] rounded-md border px-2 py-1.5 text-left transition-colors flex flex-col justify-between ${
                  portfolioScope === unit.scope
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border/60 hover:border-primary/40 hover:bg-muted/50'
                }`}
                data-testid={`portfolio-unit-${unit.scope.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              >
                <p className="text-[12px] font-bold text-foreground truncate leading-tight" title={unit.label}>{unit.label}</p>
                <div className="space-y-0.5 text-[9px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Sector</span>
                    <span className="font-medium text-foreground truncate" title={unit.sector}>{unit.sector || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Mgr</span>
                    <span className="font-medium text-foreground truncate" title={unit.managerName}>{unit.managerName || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">AED</span>
                    <span className="font-semibold text-foreground truncate">{formatCurrency(unit.budget)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className={`grid w-full max-w-4xl h-auto gap-2 bg-transparent p-0`} style={{ gridTemplateColumns: `repeat(${allowedTabs.length || 5}, minmax(0, 1fr))` }}>
            {isTabAllowed("overview") && (
            <TabsTrigger
              value="overview"
              className="relative overflow-hidden text-sm font-semibold gap-2 h-12 rounded-xl border-2 transition-all duration-300 data-[state=active]:border-blue-500 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500/10 data-[state=active]:to-blue-600/10 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=inactive]:border-muted data-[state=inactive]:hover:border-blue-300 dark:data-[state=inactive]:hover:border-blue-700 data-[state=inactive]:hover:bg-blue-500/5"
              data-testid="tab-overview"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">{t('portfolio.gateway.tabOverview')}</span>
            </TabsTrigger>
            )}
            {isTabAllowed("pipeline") && (
            <TabsTrigger
              value="pipeline"
              className="relative overflow-hidden text-sm font-semibold gap-2 h-12 rounded-xl border-2 transition-all duration-300 data-[state=active]:border-amber-500 data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-500/10 data-[state=active]:to-amber-600/10 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-400 data-[state=inactive]:border-muted data-[state=inactive]:hover:border-amber-300 dark:data-[state=inactive]:hover:border-amber-700 data-[state=inactive]:hover:bg-amber-500/5"
              data-testid="tab-pipeline"
            >
              <Inbox className="h-4 w-4" />
              <span className="hidden sm:inline">{t('portfolio.gateway.tabPipeline')}</span>
              {availableDemands.length > 0 && (
                <Badge className="ml-1 px-1.5 py-0 text-xs bg-amber-500 text-white border-0">
                  {availableDemands.length}
                </Badge>
              )}
            </TabsTrigger>
            )}
            {isTabAllowed("projects") && (
            <TabsTrigger
              value="projects"
              className="relative overflow-hidden text-sm font-semibold gap-2 h-12 rounded-xl border-2 transition-all duration-300 data-[state=active]:border-emerald-500 data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500/10 data-[state=active]:to-emerald-600/10 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 data-[state=inactive]:border-muted data-[state=inactive]:hover:border-emerald-300 dark:data-[state=inactive]:hover:border-emerald-700 data-[state=inactive]:hover:bg-emerald-500/5"
              data-testid="tab-projects"
            >
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">{t('portfolio.gateway.tabProjects')}</span>
            </TabsTrigger>
            )}
            {isTabAllowed("governance") && (
            <TabsTrigger
              value="governance"
              className="relative overflow-hidden text-sm font-semibold gap-2 h-12 rounded-xl border-2 transition-all duration-300 data-[state=active]:border-purple-500 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-500/10 data-[state=active]:to-purple-600/10 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-400 data-[state=inactive]:border-muted data-[state=inactive]:hover:border-purple-300 dark:data-[state=inactive]:hover:border-purple-700 data-[state=inactive]:hover:bg-purple-500/5"
              data-testid="tab-governance"
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">{t('portfolio.gateway.tabGovernance')}</span>
            </TabsTrigger>
            )}
            {isTabAllowed("insights") && (
            <TabsTrigger
              value="insights"
              className="relative overflow-hidden text-sm font-semibold gap-2 h-12 rounded-xl border-2 transition-all duration-300 data-[state=active]:border-cyan-500 data-[state=active]:bg-gradient-to-br data-[state=active]:from-cyan-500/10 data-[state=active]:to-cyan-600/10 data-[state=active]:text-cyan-700 dark:data-[state=active]:text-cyan-400 data-[state=inactive]:border-muted data-[state=inactive]:hover:border-cyan-300 dark:data-[state=inactive]:hover:border-cyan-700 data-[state=inactive]:hover:bg-cyan-500/5"
              data-testid="tab-insights"
            >
              <HexagonLogoFrame px={16} />
              <span className="hidden sm:inline">{t('portfolio.gateway.tabAiInsights')}</span>
            </TabsTrigger>
            )}
          </TabsList>

          {isTabAllowed("overview") && <TabsContent value="overview" className="space-y-6">
            {summaryLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Enhanced Executive KPI Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                  <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20" data-testid="kpi-total-projects">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <FolderKanban className="h-4 w-4 text-blue-500" />
                        <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-600">{t('portfolio.gateway.badgeActive')}</Badge>
                      </div>
                      <div className="text-2xl font-bold text-blue-600">{summary?.totalProjects || 0}</div>
                      <p className="text-[10px] text-muted-foreground mt-1">{portfolioScope === 'all' ? t('portfolio.gateway.kpiTotalProjects') : `${selectedPortfolioScopeLabel} ${t('portfolio.gateway.kpiTotalProjects').toLowerCase()}`}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20" data-testid="kpi-total-budget">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Wallet className="h-4 w-4 text-emerald-500" />
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">{t('portfolio.gateway.badgeBudget')}</Badge>
                      </div>
                      <div className="text-2xl font-bold text-emerald-600">{formatCurrency(summary?.totalBudget).replace('AED ', '')}</div>
                      <p className="text-[10px] text-muted-foreground mt-1">{t('portfolio.gateway.kpiTotalInvestment')}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/20" data-testid="kpi-allocated">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <CircleDollarSign className="h-4 w-4 text-violet-500" />
                        <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-600">{t('portfolio.gateway.badgeSpent')}</Badge>
                      </div>
                      <div className="text-2xl font-bold text-violet-600">{formatCurrency(summary?.totalSpend).replace('AED ', '')}</div>
                      <p className="text-[10px] text-muted-foreground mt-1">{t('portfolio.gateway.kpiAllocated')}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20" data-testid="kpi-progress">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Activity className="h-4 w-4 text-amber-500" />
                        {(summary?.avgProgress || 0) >= 50 ? (
                          <Badge className="text-[10px] bg-emerald-500/20 text-emerald-600 border-0">
                            <ArrowUpRight className="h-3 w-3 mr-0.5" />
                            {t('portfolio.gateway.onTrack')}
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] bg-amber-500/20 text-amber-600 border-0">
                            <ArrowDownRight className="h-3 w-3 mr-0.5" />
                            {t('portfolio.gateway.behind')}
                          </Badge>
                        )}
                      </div>
                      <div className="text-2xl font-bold text-amber-600">{Math.round(summary?.avgProgress || 0)}%</div>
                      <p className="text-[10px] text-muted-foreground mt-1">{t('portfolio.gateway.kpiAvgProgress')}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20" data-testid="kpi-pipeline">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Inbox className="h-4 w-4 text-cyan-500" />
                        <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-600">{t('portfolio.gateway.badgeQueue')}</Badge>
                      </div>
                      <div className="text-2xl font-bold text-cyan-600">{availableDemands.length}</div>
                      <p className="text-[10px] text-muted-foreground mt-1">{t('portfolio.gateway.kpiInPipeline')}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20" data-testid="kpi-at-risk">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <AlertTriangle className="h-4 w-4 text-rose-500" />
                        <Badge variant="destructive" className="text-[10px]">{t('portfolio.gateway.badgeAlert')}</Badge>
                      </div>
                      <div className="text-2xl font-bold text-rose-600">{(summary?.byHealth?.at_risk || 0) + (summary?.byHealth?.critical || 0)}</div>
                      <p className="text-[10px] text-muted-foreground mt-1">{t('portfolio.gateway.kpiAtRisk')}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20" data-testid="kpi-on-track">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                        <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-600">{t('portfolio.gateway.badgeHealthy')}</Badge>
                      </div>
                      <div className="text-2xl font-bold text-indigo-600">{summary?.byHealth?.on_track || 0}</div>
                      <p className="text-[10px] text-muted-foreground mt-1">{t('portfolio.gateway.kpiOnTrack')}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20" data-testid="kpi-utilization">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Gauge className="h-4 w-4 text-primary" />
                        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">{t('portfolio.gateway.badgeRate')}</Badge>
                      </div>
                      <div className="text-2xl font-bold text-primary">
                        {summary?.totalBudget && summary?.totalSpend
                          ? Math.round((summary.totalSpend / summary.totalBudget) * 100)
                          : 0}%
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{t('portfolio.gateway.kpiUtilization')}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Main Analytics Grid */}
                <div className="grid lg:grid-cols-3 gap-6">
                  {/* Phase Distribution Chart */}
                  <Card className="lg:col-span-2 border border-border/50" data-testid="card-phase-distribution">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <GitBranch className="h-5 w-5 text-primary" />
                            {t('portfolio.gateway.lifecycleDistribution')}
                          </CardTitle>
                          <CardDescription className="text-xs">{t('portfolio.gateway.lifecycleDistributionDesc')}</CardDescription>
                        </div>
                        <Badge variant="outline" className="text-xs">{summary?.totalProjects || 0} {t('portfolio.gateway.tabProjects')}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {summary?.byPhase && Object.keys(summary.byPhase).length > 0 ? (
                        <div className="h-[280px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={Object.entries(summary.byPhase).map(([phase, count]) => ({
                              phase: phase.charAt(0).toUpperCase() + phase.slice(1).replace(/_/g, ' '),
                              count,
                              fill: PHASE_COLORS[phase] ? CHART_COLORS[Object.keys(PHASE_COLORS).indexOf(phase) % CHART_COLORS.length] : CHART_COLORS[0]
                            }))} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.5} horizontal={false} />
                              <XAxis type="number" tick={{ fontSize: 10 }} />
                              <YAxis type="category" dataKey="phase" width={100} tick={{ fontSize: 10 }} />
                              <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                              <Bar dataKey="count" name={t('portfolio.gateway.projects')} radius={[0, 4, 4, 0]} barSize={20}>
                                {Object.entries(summary.byPhase).map(([_phase], index) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[280px] flex items-center justify-center">
                          <p className="text-muted-foreground text-sm">{t('portfolio.gateway.noProjectsInPortfolio')}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Health Status Donut */}
                  <Card className="border border-border/50" data-testid="card-health-status">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Target className="h-5 w-5 text-emerald-500" />
                        {t('portfolio.gateway.portfolioHealth')}
                      </CardTitle>
                      <CardDescription className="text-xs">{t('portfolio.gateway.portfolioHealthDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {summary?.byHealth && Object.keys(summary.byHealth).length > 0 ? (
                        <>
                          <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={Object.entries(summary.byHealth).map(([status, count]) => ({
                                    name: status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                                    value: count as number,
                                    fill: status === 'on_track' ? '#10b981' : status === 'at_risk' ? '#f59e0b' : status === 'critical' ? '#ef4444' : '#94a3b8'
                                  }))}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={75}
                                  paddingAngle={3}
                                >
                                  {Object.entries(summary.byHealth).map(([status], index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={status === 'on_track' ? '#10b981' : status === 'at_risk' ? '#f59e0b' : status === 'critical' ? '#ef4444' : '#94a3b8'}
                                    />
                                  ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="space-y-2 mt-2">
                            {Object.entries(summary.byHealth).map(([status, count]) => {
                              const total = Object.values(summary.byHealth).reduce((a: number, b: number) => a + b, 0);
                              const percentage = ((count as number) / total) * 100;
                              return (
                                <div key={status} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className={`h-2.5 w-2.5 rounded-full ${HEALTH_COLORS[status] || "bg-slate-400"}`} />
                                    <span className="capitalize font-medium">{status.replace(/_/g, " ")}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold">{count}</span>
                                    <span className="text-muted-foreground">({percentage.toFixed(0)}%)</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="h-[280px] flex items-center justify-center">
                          <p className="text-muted-foreground text-sm">{t('portfolio.gateway.noProjectsInPortfolio')}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Budget Utilization & Progress */}
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Budget Analysis */}
                  <Card className="border border-border/50" data-testid="card-budget-analysis">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <DollarSign className="h-5 w-5 text-emerald-500" />
                        {t('portfolio.gateway.budgetUtilization')}
                      </CardTitle>
                      <CardDescription className="text-xs">{t('portfolio.gateway.budgetUtilizationDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <p className="text-xs text-muted-foreground mb-1">{t('portfolio.gateway.totalBudget')}</p>
                            <p className="text-xl font-bold text-emerald-600">{formatCurrency(summary?.totalBudget)}</p>
                          </div>
                          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <p className="text-xs text-muted-foreground mb-1">{t('portfolio.gateway.kpiAllocated')}</p>
                            <p className="text-xl font-bold text-blue-600">{formatCurrency(summary?.totalSpend)}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{t('portfolio.gateway.utilizationRate')}</span>
                            <span className="font-bold">
                              {summary?.totalBudget && summary?.totalSpend
                                ? Math.round((summary.totalSpend / summary.totalBudget) * 100)
                                : 0}%
                            </span>
                          </div>
                          <Progress
                            value={summary?.totalBudget && summary?.totalSpend
                              ? (summary.totalSpend / summary.totalBudget) * 100
                              : 0}
                            className="h-3"
                          />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{t('portfolio.gateway.remaining')}: {formatCurrency((summary?.totalBudget || 0) - (summary?.totalSpend || 0))}</span>
                            <span>
                              {summary?.totalBudget && summary?.totalSpend
                                ? (100 - Math.round((summary.totalSpend / summary.totalBudget) * 100))
                                : 100}% {t('portfolio.gateway.available')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* AI Insights Panel */}
                  <Card className="border border-border/50 bg-gradient-to-br from-violet-500/5 to-purple-500/5" data-testid="card-ai-insights">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Sparkles className="h-5 w-5 text-violet-500" />
                          {t('portfolio.gateway.aiInsights')}
                        </CardTitle>
                        <Badge className="bg-violet-500/20 text-violet-600 border-0 text-[10px]">
                          <HexagonLogoFrame px={12} className="mr-1" />
                          AI Powered
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">{t('portfolio.gateway.aiInsightsRecommendations')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(summary?.totalProjects || 0) > 0 ? (
                          <>
                            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                              <div className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                                <div>
                                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{t('portfolio.gateway.strongPerformance')}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {t('portfolio.gateway.strongPerformanceDesc', { count: summary?.byHealth?.on_track || 0, progress: Math.round(summary?.avgProgress || 0) })}
                                  </p>
                                </div>
                              </div>
                            </div>
                            {(summary?.byHealth?.at_risk || 0) > 0 && (
                              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                                  <div>
                                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{t('portfolio.gateway.attentionNeeded')}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      {t('portfolio.gateway.attentionNeededDesc', { count: summary?.byHealth?.at_risk })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                              <div className="flex items-start gap-2">
                                <Rocket className="h-4 w-4 text-blue-500 mt-0.5" />
                                <div>
                                  <p className="text-xs font-medium text-blue-700 dark:text-blue-400">{t('portfolio.gateway.pipelineGrowth')}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {t('portfolio.gateway.pipelineGrowthDesc', { count: availableDemands.length })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="p-4 rounded-lg bg-muted/50 text-center">
                            <Lightbulb className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm font-medium">{t('portfolio.gateway.noPortfolioData')}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t('portfolio.gateway.noPortfolioDataDesc')}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Advanced Analytics Section */}
                {advancedMetrics && advancedMetrics.projectCount > 0 && (
                  <>
                    {/* Department Performance Breakdown */}
                    <div className="grid lg:grid-cols-2 gap-6">
                      <Card className="border border-border/50" data-testid="card-department-performance">
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Building2 className="h-5 w-5 text-blue-500" />
                            Department Performance
                          </CardTitle>
                          <CardDescription className="text-xs">{t('portfolio.gateway.deptPerformanceDesc')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {advancedMetrics.deptData.length > 0 ? (
                            <div className="space-y-3">
                              {advancedMetrics.deptData.map((dept, idx) => (
                                <div key={dept.department} className="p-3 rounded-lg bg-muted/30 border border-border/30">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                                      <span className="text-sm font-medium truncate max-w-[150px]">{dept.department}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-[10px]">{dept.count} projects</Badge>
                                      <Badge
                                        className={`text-[10px] border-0 ${
                                          dept.healthScore >= 70 ? 'bg-emerald-500/20 text-emerald-600' :
                                          dept.healthScore >= 40 ? 'bg-amber-500/20 text-amber-600' :
                                          'bg-rose-500/20 text-rose-600'
                                        }`}
                                      >
                                        {dept.healthScore.toFixed(0)}% healthy
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">{t('portfolio.gateway.budgetAllocated')}</span>
                                    <span className="font-semibold">{formatCurrency(dept.budget)}</span>
                                  </div>
                                  <Progress
                                    value={(dept.budget / advancedMetrics.totalApprovedBudget) * 100}
                                    className="h-1.5 mt-2"
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">{t('portfolio.gateway.noDeptData')}</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Timeline & Schedule Analysis */}
                      <Card className="border border-border/50" data-testid="card-timeline-analysis">
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Clock className="h-5 w-5 text-amber-500" />
                            Timeline Analysis
                          </CardTitle>
                          <CardDescription className="text-xs">{t('portfolio.gateway.timelineAnalysisDesc')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {/* On-Time Delivery Rate */}
                            <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">{t('portfolio.gateway.onTimeDeliveryRate')}</span>
                                <span className="text-xl font-bold text-emerald-600">{advancedMetrics.onTimeRate.toFixed(0)}%</span>
                              </div>
                              <Progress value={advancedMetrics.onTimeRate} className="h-2" />
                              <p className="text-[10px] text-muted-foreground mt-2">
                                {t('portfolio.gateway.onTimeDeliveryRateDesc')}
                              </p>
                            </div>

                            {/* Key Metrics */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                                <Clock className="h-4 w-4 mx-auto text-blue-500 mb-1" />
                                <p className="text-lg font-bold text-blue-600">{advancedMetrics.estimatedCompletionMonths}</p>
                                <p className="text-[10px] text-muted-foreground">{t('portfolio.gateway.estMonthsToComplete')}</p>
                              </div>
                              <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 text-center">
                                <Activity className="h-4 w-4 mx-auto text-violet-500 mb-1" />
                                <p className="text-lg font-bold text-violet-600">{formatCurrency(advancedMetrics.avgProjectBudget).replace('AED ', '')}</p>
                                <p className="text-[10px] text-muted-foreground">{t('portfolio.gateway.avgProjectSize')}</p>
                              </div>
                            </div>

                            {/* Budget Variance Alert */}
                            {advancedMetrics.budgetVariance !== 0 && (
                              <div className={`p-3 rounded-lg ${
                                advancedMetrics.budgetVariance > 10 ? 'bg-rose-500/10 border-rose-500/20' :
                                advancedMetrics.budgetVariance > 0 ? 'bg-amber-500/10 border-amber-500/20' :
                                'bg-emerald-500/10 border-emerald-500/20'
                              } border`}>
                                <div className="flex items-center gap-2">
                                  {advancedMetrics.budgetVariance > 10 ? (
                                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                                  ) : advancedMetrics.budgetVariance > 0 ? (
                                    <TrendingUp className="h-4 w-4 text-amber-500" />
                                  ) : (
                                    <TrendingDown className="h-4 w-4 text-emerald-500" />
                                  )}
                                  <div>
                                    <p className="text-xs font-medium">
                                      Budget Variance: {advancedMetrics.budgetVariance > 0 ? '+' : ''}{advancedMetrics.budgetVariance.toFixed(1)}%
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {advancedMetrics.budgetVariance > 10
                                        ? t('portfolio.gateway.budgetVarianceOver')
                                        : advancedMetrics.budgetVariance > 0
                                        ? t('portfolio.gateway.budgetVarianceSlight')
                                        : t('portfolio.gateway.budgetVarianceUnder')}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Phase Breakdown with Budget */}
                    <Card className="border border-border/50" data-testid="card-phase-budget-breakdown">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <BarChart3 className="h-5 w-5 text-cyan-500" />
                          Phase Budget Distribution
                        </CardTitle>
                        <CardDescription className="text-xs">{t('portfolio.gateway.phaseBudgetDistDesc')}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[220px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={advancedMetrics.phaseData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.5} />
                              <XAxis dataKey="phase" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                              <Tooltip
                                contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                                formatter={(value: number, name: string) => [
                                  name === 'budget' ? formatCurrency(value) : `${value} projects`,
                                  name === 'budget' ? t('portfolio.gateway.budget') : t('portfolio.gateway.count')
                                ]}
                              />
                              <Bar dataKey="budget" name={t('portfolio.gateway.budget')} fill="#06b6d4" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-4">
                          {advancedMetrics.phaseData.slice(0, 4).map((phase, idx) => (
                            <div key={phase.phase} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-xs">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                              <span className="font-medium">{phase.phase}</span>
                              <span className="text-muted-foreground">{phase.count} ({phase.avgProgress.toFixed(0)}% avg)</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* At-Risk Projects Detail */}
                    {advancedMetrics.atRiskProjects.length > 0 && (
                      <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5" data-testid="card-at-risk-projects">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="h-5 w-5" />
                                Projects Requiring Attention
                              </CardTitle>
                              <CardDescription className="text-xs">{t('portfolio.gateway.projectsRequiringAttentionDesc', { count: advancedMetrics.atRiskProjects.length })}</CardDescription>
                            </div>
                            <Badge className="bg-amber-500/20 text-amber-600 border-0">
                              {formatCurrency(advancedMetrics.atRiskProjects.reduce((sum, p) => sum + (parseFloat(p.approvedBudget || '0') || 0), 0))} at risk
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {advancedMetrics.atRiskProjects.slice(0, 4).map((project) => (
                              <div
                                key={project.id}
                                className="p-3 rounded-lg bg-card border border-amber-500/20 hover-elevate cursor-pointer"
                                onClick={() => setLocation(`/project/${project.id}`)}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="outline" className="text-[10px]">{project.projectCode}</Badge>
                                      <Badge
                                        className={`text-[10px] border-0 ${
                                          project.healthStatus === 'critical' ? 'bg-rose-500/20 text-rose-600' : 'bg-amber-500/20 text-amber-600'
                                        }`}
                                      >
                                        {project.healthStatus?.replace(/_/g, ' ')}
                                      </Badge>
                                    </div>
                                    <h4 className="text-sm font-medium truncate">{project.projectName}</h4>
                                    <p className="text-[10px] text-muted-foreground mt-1">{getProjectDepartment(project)}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-semibold">{project.overallProgress || 0}%</p>
                                    <p className="text-[10px] text-muted-foreground">{formatCurrency(project.approvedBudget)}</p>
                                  </div>
                                </div>
                                <Progress value={project.overallProgress || 0} className="h-1 mt-2" />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Top Performers */}
                    <Card className="border border-border/50" data-testid="card-top-performers">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Star className="h-5 w-5 text-yellow-500" />
                          Top Performing Projects
                        </CardTitle>
                        <CardDescription className="text-xs">{t('portfolio.gateway.topPerformingDesc')}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3">
                          {advancedMetrics.topPerformers.map((project, idx) => (
                            <div
                              key={project.id}
                              className="relative p-3 rounded-lg border bg-gradient-to-br from-yellow-500/5 to-amber-500/5 hover-elevate cursor-pointer group"
                              onClick={() => setLocation(`/project/${project.id}`)}
                            >
                              <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-yellow-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
                                {idx + 1}
                              </div>
                              <div className="pt-2">
                                <p className="text-lg font-bold text-yellow-600">{project.overallProgress || 0}%</p>
                                <h4 className="text-xs font-medium line-clamp-2 mt-1 group-hover:text-primary">{project.projectName}</h4>
                                <p className="text-[10px] text-muted-foreground mt-1 truncate">{getProjectDepartment(project)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}

                {/* Pipeline Summary in Overview */}
                {pipelineAnalytics && (
                  <Card className="border border-border/50 bg-gradient-to-br from-amber-500/5 to-orange-500/5" data-testid="card-pipeline-summary">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Inbox className="h-5 w-5 text-amber-500" />
                            Pipeline Summary
                          </CardTitle>
                          <CardDescription className="text-xs">{t('portfolio.gateway.pipelineSummaryDesc')}</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setActiveTab("pipeline")} className="gap-1 text-xs">
                          View Pipeline
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-4 gap-4">
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                          <p className="text-2xl font-bold text-amber-600">{pipelineAnalytics.readyToConvert}</p>
                          <p className="text-xs text-muted-foreground mt-1">{t('portfolio.gateway.readyToConvert')}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-center">
                          <p className="text-2xl font-bold text-rose-600">{pipelineAnalytics.highPriority}</p>
                          <p className="text-xs text-muted-foreground mt-1">{t('portfolio.gateway.highPriority')}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(pipelineAnalytics.totalPipelineBudget).replace('AED ', '')}</p>
                          <p className="text-xs text-muted-foreground mt-1">{t('portfolio.gateway.pipelineValue')}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                          <p className="text-2xl font-bold text-blue-600">{(pipelineAnalytics.avgStrategicAlignment * 10).toFixed(0)}%</p>
                          <p className="text-xs text-muted-foreground mt-1">{t('portfolio.gateway.avgStrategicFit')}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Active Projects Section */}
                {projects.length > 0 && (
                  <Card className="border border-border/50" data-testid="card-active-projects">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Award className="h-5 w-5 text-amber-500" />
                            Top Priority Initiatives
                          </CardTitle>
                          <CardDescription className="text-xs">{t('portfolio.gateway.topPriorityDesc')}</CardDescription>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("projects")}
                          className="gap-1 text-xs"
                          data-testid="button-view-all-projects"
                        >
                          View All Projects
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {projects.slice(0, 3).map((project, idx) => (
                          <div
                            key={project.id}
                            className="relative p-4 rounded-lg border bg-card hover-elevate cursor-pointer group"
                            onClick={() => setLocation(`/project/${project.id}`)}
                            data-testid={`card-project-${idx}`}
                          >
                            <div className="absolute top-0 left-0 w-full h-1 rounded-t-lg" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                            <div className="flex items-start justify-between gap-2 mb-3 pt-1">
                              <Badge variant="outline" className="text-[10px]">{project.projectCode}</Badge>
                              <Badge
                                className={`text-[10px] ${
                                  project.healthStatus === 'on_track' ? 'bg-emerald-500/20 text-emerald-600' :
                                  project.healthStatus === 'at_risk' ? 'bg-amber-500/20 text-amber-600' :
                                  'bg-rose-500/20 text-rose-600'
                                } border-0`}
                              >
                                {project.healthStatus?.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <h4 className="font-semibold text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                              {project.projectName}
                            </h4>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{t('portfolio.gateway.progress')}</span>
                                <span className="font-medium">{project.overallProgress || 0}%</span>
                              </div>
                              <Progress value={project.overallProgress || 0} className="h-1.5" />
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{t('portfolio.gateway.phase')}</span>
                                <span className="font-medium capitalize">{project.currentPhase?.replace(/_/g, ' ')}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Empty State */}
                {projects.length === 0 && (
                  <Card className="border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 to-blue-500/5">
                    <CardContent className="py-12 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <FolderKanban className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">{t('portfolio.gateway.portfolioEmpty')}</h3>
                      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                        {t('portfolio.gateway.portfolioEmptyDesc')}
                      </p>
                      <Button
                        onClick={() => setActiveTab("pipeline")}
                        className="mt-6 gap-2"
                        data-testid="button-go-to-pipeline"
                      >
                        <Inbox className="h-4 w-4" />
                        Browse Pipeline
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>}

          {isTabAllowed("pipeline") && <TabsContent value="pipeline" className="space-y-5">
            {pipelineLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pipeline.length === 0 ? (
              <div className="glass-card rounded-xl p-12 bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-gray-100 dark:border-white/10 shadow-sm">
                <div className="text-center">
                  <div className="h-20 w-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    <Inbox className="h-10 w-10 text-amber-500" />
                  </div>
                  <h3 className="text-xl font-semibold">{t('portfolio.gateway.noApprovedDemands')}</h3>
                  <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                    {t('portfolio.gateway.noApprovedDemandsDesc')}
                  </p>
                  <Button variant="outline" className="mt-6 gap-2" asChild>
                    <Link href="/gateway" data-testid="link-go-to-gateway">
                      <ArrowRight className="h-4 w-4" />
                      Go to Intelligent Gateway
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Metrics Strip - Always Visible */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">{t('portfolio.gateway.totalPipeline')}</p>
                          <p className="text-xl font-semibold">{pipeline.length}</p>
                        </div>
                        <Inbox className="h-5 w-5 text-primary" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">{t('portfolio.gateway.initiallyApproved')}</p>
                          <p className="text-xl font-semibold">{pipeline.filter(i => i.workflowStatus === 'initially_approved').length}</p>
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">{t('portfolio.gateway.managerApproved')}</p>
                          <p className="text-xl font-semibold">{pipeline.filter(i => i.workflowStatus === 'manager_approved').length}</p>
                        </div>
                        <Shield className="h-5 w-5 text-teal-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">{t('portfolio.gateway.pendingConversion')}</p>
                          <p className="text-xl font-semibold">{pendingConversionCount}</p>
                        </div>
                        <Clock className="h-5 w-5 text-indigo-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">{t('portfolio.gateway.converted')}</p>
                          <p className="text-xl font-semibold">{pipeline.filter(i => i.workflowStatus === 'converted' || i.hasPortfolioProject).length}</p>
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Ready to Convert</p>
                          <p className="text-xl font-semibold">{readyToConvertCount}</p>
                        </div>
                        <ArrowUpRight className="h-5 w-5 text-primary" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* View Toggle */}
                <div className="flex items-center gap-2">
                  <Button
                    variant={pipelineView === 'table' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPipelineView('table')}
                    className="gap-2"
                    data-testid="button-view-table"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Approved Demands
                  </Button>
                  <Button
                    variant={pipelineView === 'matrix' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPipelineView('matrix')}
                    className="gap-2"
                    data-testid="button-view-matrix"
                  >
                    <Target className="h-4 w-4" />
                    Priority Matrix
                  </Button>
                </div>

                {/* Conditional View Rendering */}
                {pipelineView === 'matrix' ? (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Target className="h-5 w-5 text-primary" />
                              Strategic Priority Matrix
                            </CardTitle>
                            <CardDescription>{t('portfolio.gateway.strategicPriorityMatrixDesc')}</CardDescription>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-center">
                              <p className="text-2xl font-bold">{pipeline.length > 0 ? (pipeline.reduce((acc, i) => acc + (i.strategicAlignment || 0), 0) / pipeline.length).toFixed(0) : 0}%</p>
                              <p className="text-xs text-muted-foreground">{t('portfolio.gateway.avgAlignment')}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold text-amber-600">{pipeline.filter(i => i.urgency === 'High').length}</p>
                              <p className="text-xs text-muted-foreground">{t('portfolio.gateway.highPriority')}</p>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <PortfolioVisualizationMatrix items={pipeline} />
                      </CardContent>
                    </Card>

                    {/* AI Decision Recommendations */}
                    <Card>
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <HexagonLogoFrame px={20} />
                              AI Decision Recommendations
                            </CardTitle>
                            <CardDescription>{t('portfolio.gateway.aiDecisionRecommendationsDesc')}</CardDescription>
                          </div>
                          <Badge variant="outline" className="gap-1">
                            <Sparkles className="h-3 w-3" />
                            AI Powered
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <PortfolioDecisionMatrix items={pipeline} />
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card className="w-full">
                    <CardHeader className="pb-4">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-primary" />
                            {t('portfolio.gateway.approvedDemands')}
                          </CardTitle>
                          <CardDescription>{t('portfolio.gateway.approvedDemandsTableDesc')}</CardDescription>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="px-3 py-1">
                            {pipeline.length} {pipeline.length === 1 ? 'item' : 'items'}
                          </Badge>
                          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
                            <Button
                              variant={demandsViewType === 'table' ? 'secondary' : 'ghost'}
                              size="sm"
                              onClick={() => setDemandsViewType('table')}
                              className="gap-1.5 h-8"
                              data-testid="button-demands-table-view"
                            >
                              <LayoutList className="h-4 w-4" />
                              {t('portfolio.gateway.viewTable')}
                            </Button>
                            <Button
                              variant={demandsViewType === 'grid' ? 'secondary' : 'ghost'}
                              size="sm"
                              onClick={() => setDemandsViewType('grid')}
                              className="gap-1.5 h-8"
                              data-testid="button-demands-grid-view"
                            >
                              <LayoutGrid className="h-4 w-4" />
                              {t('portfolio.gateway.viewGrid')}
                            </Button>
                            <Button
                              variant={demandsViewType === 'compact' ? 'secondary' : 'ghost'}
                              size="sm"
                              onClick={() => setDemandsViewType('compact')}
                              className="gap-1.5 h-8"
                              data-testid="button-demands-compact-view"
                            >
                              <List className="h-4 w-4" />
                              {t('portfolio.gateway.viewCompact')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {demandsViewType === 'table' && (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead className="min-w-[180px]">{t('portfolio.gateway.thOrganization')}</TableHead>
                                <TableHead className="min-w-[300px]">{t('portfolio.gateway.thBusinessObjective')}</TableHead>
                                <TableHead className="w-[120px]">{t('portfolio.gateway.thApproval')}</TableHead>
                                <TableHead className="w-[100px] text-center">{t('portfolio.gateway.thAlignment')}</TableHead>
                                <TableHead className="w-[100px]">{t('portfolio.gateway.thUrgency')}</TableHead>
                                <TableHead className="w-[130px]">{t('portfolio.gateway.thBudget')}</TableHead>
                                <TableHead className="w-[200px] text-right">{t('portfolio.gateway.thActions')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pipeline.map((item) => (
                                <TableRow key={item.id} data-testid={`row-pipeline-${item.id}`} className="hover:bg-muted/30">
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <Building2 className="h-4 w-4 text-primary" />
                                      </div>
                                      <div>
                                        {item.projectId && (
                                          <Badge variant="secondary" className="text-xs font-mono mb-1 bg-slate-100 dark:bg-slate-800">
                                            {item.projectId}
                                          </Badge>
                                        )}
                                        {item.suggestedProjectName && (
                                          <p className="font-semibold text-sm">{item.suggestedProjectName}</p>
                                        )}
                                        <span className="font-medium text-muted-foreground">{item.organizationName}</span>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <p className="text-sm leading-relaxed">{item.businessObjective}</p>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${
                                        item.workflowStatus === 'converted' || item.hasPortfolioProject
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                                          : item.workflowStatus === 'manager_approved'
                                          ? 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-400'
                                          : item.workflowStatus === 'pending_conversion'
                                          ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-400'
                                          : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400'
                                      }`}
                                    >
                                      {item.workflowStatus === 'converted' || item.hasPortfolioProject ? t('portfolio.gateway.converted') :
                                       item.workflowStatus === 'manager_approved' ? t('portfolio.gateway.managerApproved') :
                                       item.workflowStatus === 'pending_conversion' ? t('portfolio.gateway.pendingConversion') : t('portfolio.gateway.initiallyApproved')}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex flex-col items-center">
                                      <span className="font-semibold text-lg">{item.strategicAlignment || 0}%</span>
                                      <div className="w-full h-1.5 bg-muted rounded-full mt-1">
                                        <div
                                          className="h-full rounded-full bg-primary"
                                          style={{ width: `${item.strategicAlignment || 0}%` }}
                                        />
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${
                                        item.urgency === 'High'
                                          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'
                                          : item.urgency === 'Medium'
                                          ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400'
                                          : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400'
                                      }`}
                                    >
                                      {item.urgency || t('portfolio.gateway.normal')}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-medium">{extractBudgetRange(item.budgetRange)}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button size="sm" variant="ghost" asChild>
                                        <Link href={`/demand-analysis/${item.id}?tab=business-case`} data-testid={`link-view-demand-${item.id}`}>
                                          <Eye className="h-4 w-4" />
                                        </Link>
                                      </Button>
                                      {item.workflowStatus === 'converted' || item.hasPortfolioProject ? (
                                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 gap-1">
                                          <CheckCircle2 className="h-3 w-3" />
                                          {t('portfolio.gateway.converted')}
                                        </Badge>
                                      ) : item.workflowStatus === 'pending_conversion' ? (
                                        <>
                                          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-400 gap-1">
                                            <Clock className="h-3 w-3" />
                                            {t('portfolio.gateway.awaitingPmo')}
                                          </Badge>
                                        </>
                                      ) : (
                                        <>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                            onClick={() => handleReject(item)}
                                            disabled={rejectDemandMutation.isPending}
                                            data-testid={`button-reject-${item.id}`}
                                          >
                                            <XCircle className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            onClick={() => handleConvert(item)}
                                            disabled={item.hasPortfolioProject || createProjectMutation.isPending}
                                            className="gap-1"
                                            data-testid={`button-convert-${item.id}`}
                                          >
                                            <ArrowUpRight className="h-4 w-4" />
                                            {t('portfolio.gateway.convert')}
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {demandsViewType === 'grid' && (
                        <div className="p-4 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {pipeline.map((item) => (
                            <Card key={item.id} className="relative overflow-hidden" data-testid={`card-demand-${item.id}`}>
                              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/60 to-primary" />
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                      <Building2 className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                      {item.projectId && (
                                        <Badge variant="secondary" className="text-xs font-mono mb-1 bg-slate-100 dark:bg-slate-800">
                                          {item.projectId}
                                        </Badge>
                                      )}
                                      {item.suggestedProjectName && (
                                        <CardTitle className="text-sm font-semibold mb-1">{item.suggestedProjectName}</CardTitle>
                                      )}
                                      <CardTitle className="text-sm font-semibold">{item.organizationName}</CardTitle>
                                      <Badge
                                        variant="outline"
                                        className={`text-xs mt-1 ${
                                          item.workflowStatus === 'converted' || item.hasPortfolioProject
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                                            : item.workflowStatus === 'manager_approved'
                                            ? 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-400'
                                            : item.workflowStatus === 'pending_conversion'
                                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-400'
                                            : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400'
                                        }`}
                                      >
                                        {item.workflowStatus === 'converted' || item.hasPortfolioProject ? t('portfolio.gateway.converted') :
                                         item.workflowStatus === 'manager_approved' ? t('portfolio.gateway.managerApproved') :
                                         item.workflowStatus === 'pending_conversion' ? t('portfolio.gateway.pendingConversion') : t('portfolio.gateway.initiallyApproved')}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="pb-4">
                                <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-3">
                                  {item.businessObjective}
                                </p>

                                <div className="grid grid-cols-3 gap-3 mb-4">
                                  <div className="text-center p-2 rounded-lg bg-muted/50">
                                    <p className="text-lg font-bold text-primary">{item.strategicAlignment || 0}%</p>
                                    <p className="text-xs text-muted-foreground">{t('portfolio.gateway.alignmentLabel')}</p>
                                  </div>
                                  <div className="text-center p-2 rounded-lg bg-muted/50">
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${
                                        item.urgency === 'High'
                                          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'
                                          : item.urgency === 'Medium'
                                          ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400'
                                          : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400'
                                      }`}
                                    >
                                      {item.urgency || t('portfolio.gateway.normal')}
                                    </Badge>
                                    <p className="text-xs text-muted-foreground mt-1">{t('portfolio.gateway.priorityLabel')}</p>
                                  </div>
                                  <div className="text-center p-2 rounded-lg bg-muted/50">
                                    <p className="text-sm font-medium">{extractBudgetRange(item.budgetRange)}</p>
                                    <p className="text-xs text-muted-foreground">{t('portfolio.gateway.budgetLabel')}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Button size="sm" variant="ghost" className="flex-1" asChild>
                                    <Link href={`/demand-analysis/${item.id}?tab=business-case`} data-testid={`link-view-demand-grid-${item.id}`}>
                                      <Eye className="h-4 w-4 mr-1" />
                                      {t('portfolio.gateway.view')}
                                    </Link>
                                  </Button>
                                  {item.workflowStatus === 'converted' || item.hasPortfolioProject ? (
                                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 gap-1 flex-1 justify-center py-1.5">
                                      <CheckCircle2 className="h-3 w-3" />
                                      {t('portfolio.gateway.converted')}
                                    </Badge>
                                  ) : item.workflowStatus === 'pending_conversion' ? (
                                    <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-400 gap-1 flex-1 justify-center py-1.5">
                                      <Clock className="h-3 w-3" />
                                      {t('portfolio.gateway.awaitingPmo')}
                                    </Badge>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                        onClick={() => handleReject(item)}
                                        disabled={rejectDemandMutation.isPending}
                                        data-testid={`button-reject-grid-${item.id}`}
                                      >
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        className="flex-1 gap-1"
                                        onClick={() => handleConvert(item)}
                                        disabled={item.hasPortfolioProject || createProjectMutation.isPending}
                                        data-testid={`button-convert-grid-${item.id}`}
                                      >
                                        <ArrowUpRight className="h-4 w-4" />
                                        {t('portfolio.gateway.convert')}
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}

                      {demandsViewType === 'compact' && (
                        <div className="divide-y">
                          {pipeline.map((item) => (
                            <div key={item.id} className="p-4 hover:bg-muted/30 transition-colors" data-testid={`row-compact-${item.id}`}>
                              <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <Building2 className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold">{item.organizationName}</span>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${
                                        item.workflowStatus === 'converted' || item.hasPortfolioProject
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                                          : item.workflowStatus === 'manager_approved'
                                          ? 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-400'
                                          : item.workflowStatus === 'pending_conversion'
                                          ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-400'
                                          : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400'
                                      }`}
                                    >
                                      {item.workflowStatus === 'converted' || item.hasPortfolioProject ? t('portfolio.gateway.converted') :
                                       item.workflowStatus === 'manager_approved' ? t('portfolio.gateway.managerLabel') :
                                       item.workflowStatus === 'pending_conversion' ? t('portfolio.gateway.pendingLabel') : t('portfolio.gateway.initialLabel')}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${
                                        item.urgency === 'High'
                                          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'
                                          : item.urgency === 'Medium'
                                          ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400'
                                          : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400'
                                      }`}
                                    >
                                      {item.urgency || t('portfolio.gateway.normal')}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{item.businessObjective}</p>
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                  <div className="text-center hidden sm:block">
                                    <p className="font-semibold text-primary">{item.strategicAlignment || 0}%</p>
                                    <p className="text-xs text-muted-foreground">{t('portfolio.gateway.alignShort')}</p>
                                  </div>
                                  <div className="text-center hidden md:block">
                                    <p className="font-medium">{extractBudgetRange(item.budgetRange)}</p>
                                    <p className="text-xs text-muted-foreground">{t('portfolio.gateway.budgetLabel')}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button size="sm" variant="ghost" asChild>
                                      <Link href={`/demand-analysis/${item.id}?tab=business-case`} data-testid={`link-view-compact-${item.id}`}>
                                        <Eye className="h-4 w-4" />
                                      </Link>
                                    </Button>
                                    {item.workflowStatus === 'converted' || item.hasPortfolioProject ? (
                                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 gap-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        {t('portfolio.gateway.converted')}
                                      </Badge>
                                    ) : item.workflowStatus === 'pending_conversion' ? (
                                      <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-400 gap-1">
                                        <Clock className="h-3 w-3" />
                                        {t('portfolio.gateway.awaitingPmo')}
                                      </Badge>
                                    ) : (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                          onClick={() => handleReject(item)}
                                          disabled={rejectDemandMutation.isPending}
                                          data-testid={`button-reject-compact-${item.id}`}
                                        >
                                          <XCircle className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="gap-1"
                                          onClick={() => handleConvert(item)}
                                          disabled={item.hasPortfolioProject || createProjectMutation.isPending}
                                          data-testid={`button-convert-compact-${item.id}`}
                                        >
                                          <ArrowUpRight className="h-4 w-4" />
                                          {t('portfolio.gateway.convert')}
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {pipeline.length === 0 && (
                        <div className="p-12 text-center">
                          <ClipboardList className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                          <p className="text-muted-foreground">{t('portfolio.gateway.noApprovedDemandsInPipeline')}</p>
                          <p className="text-sm text-muted-foreground mt-1">{t('portfolio.gateway.demandsWillAppear')}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>}

          {isTabAllowed("projects") && <TabsContent value="projects" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{t('portfolio.gateway.activeProjects')}</CardTitle>
                    <CardDescription>{t('portfolio.gateway.activeProjectsDesc')}</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t('portfolio.gateway.searchProjects')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-[200px]"
                        data-testid="input-search-projects"
                      />
                    </div>
                    <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                      <SelectTrigger className="w-[130px]" data-testid="select-phase-filter">
                        <SelectValue placeholder={t('portfolio.gateway.phase')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('portfolio.gateway.allPhases')}</SelectItem>
                        {PHASE_ORDER.map((phase) => (
                          <SelectItem key={phase} value={phase} className="capitalize">
                            {phase}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={healthFilter} onValueChange={setHealthFilter}>
                      <SelectTrigger className="w-[130px]" data-testid="select-health-filter">
                        <SelectValue placeholder={t('portfolio.gateway.health')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('portfolio.gateway.allHealth')}</SelectItem>
                        <SelectItem value="on_track">{t('portfolio.gateway.onTrack')}</SelectItem>
                        <SelectItem value="at_risk">{t('portfolio.gateway.atRisk')}</SelectItem>
                        <SelectItem value="critical">{t('portfolio.gateway.critical')}</SelectItem>
                        <SelectItem value="on_hold">{t('portfolio.gateway.onHold')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {projectsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground">{t('portfolio.gateway.noProjectsFound')}</p>
                    <p className="text-sm">
                      {projects.length === 0
                        ? t('portfolio.gateway.noProjectsConvert')
                        : t('portfolio.gateway.noProjectsFilter')}
                    </p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProjects.map((project) => (
                      <ProjectCard key={project.id} project={project} onClick={() => setLocation(`/project/${project.id}`)} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>}

          {isTabAllowed("governance") && <TabsContent value="governance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {t('portfolio.gateway.governanceBoard')}
                </CardTitle>
                <CardDescription>{t('portfolio.gateway.governanceBoardDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const projects = projectsData?.data || [];
                  if (projects.length === 0) {
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">{t('portfolio.gateway.noProjectsToGovern')}</p>
                        <p className="text-sm">{t('portfolio.gateway.noProjectsToGovernDesc')}</p>
                      </div>
                    );
                  }

                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const atRiskProjects = projects.filter((p: any) => p.healthStatus === 'at_risk' || p.healthStatus === 'critical');
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const pendingCharters = projects.filter((p: any) => p.charterStatus === 'pending_signature' || p.charterStatus === 'draft');
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const compliantProjects = projects.filter((p: any) => (p.complianceScore || 0) >= 70);

                  return (
                    <div className="space-y-6">
                      {/* Governance Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 rounded-lg border bg-muted/30">
                          <p className="text-2xl font-bold">{projects.length}</p>
                          <p className="text-xs text-muted-foreground">{t('portfolio.gateway.kpiTotalProjects')}</p>
                        </div>
                        <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-950/20">
                          <p className="text-2xl font-bold text-red-600">{atRiskProjects.length}</p>
                          <p className="text-xs text-muted-foreground">{t('portfolio.gateway.atRiskCritical')}</p>
                        </div>
                        <div className="p-4 rounded-lg border bg-amber-50 dark:bg-amber-950/20">
                          <p className="text-2xl font-bold text-amber-600">{pendingCharters.length}</p>
                          <p className="text-xs text-muted-foreground">{t('portfolio.gateway.pendingCharterApproval')}</p>
                        </div>
                        <div className="p-4 rounded-lg border bg-emerald-50 dark:bg-emerald-950/20">
                          <p className="text-2xl font-bold text-emerald-600">{compliantProjects.length}</p>
                          <p className="text-xs text-muted-foreground">{t('portfolio.gateway.compliancePassing')}</p>
                        </div>
                      </div>

                      {/* Project Governance Table */}
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50 border-b">
                              <th className="text-left p-3 font-medium">{t('portfolio.gateway.thProject')}</th>
                              <th className="text-left p-3 font-medium">{t('portfolio.gateway.phase')}</th>
                              <th className="text-left p-3 font-medium">{t('portfolio.gateway.thHealth')}</th>
                              <th className="text-left p-3 font-medium">{t('portfolio.gateway.thCharter')}</th>
                              <th className="text-left p-3 font-medium">{t('portfolio.gateway.riskLabel')}</th>
                              <th className="text-left p-3 font-medium">{t('portfolio.gateway.thCompliance')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {projects.map((project: any) => (
                              <tr key={project.id} className="border-b hover:bg-muted/20">
                                <td className="p-3">
                                  <div className="font-medium">{project.projectName}</div>
                                  <div className="text-xs text-muted-foreground">{project.projectCode}</div>
                                </td>
                                <td className="p-3">
                                  <Badge variant="outline" className="text-xs capitalize">{(project.currentPhase || 'intake').replace(/_/g, ' ')}</Badge>
                                </td>
                                <td className="p-3">
                                  <Badge className={`text-xs ${
                                    project.healthStatus === 'on_track' ? 'bg-emerald-500' :
                                    project.healthStatus === 'at_risk' ? 'bg-amber-500' :
                                    project.healthStatus === 'critical' ? 'bg-red-500' :
                                    'bg-gray-500'
                                  }`}>
                                    {(project.healthStatus || 'unknown').replace(/_/g, ' ')}
                                  </Badge>
                                </td>
                                <td className="p-3">
                                  <Badge variant="outline" className={`text-xs ${
                                    project.charterStatus === 'signed' ? 'border-emerald-500 text-emerald-600' :
                                    project.charterStatus === 'pending_signature' ? 'border-amber-500 text-amber-600' :
                                    'border-gray-400 text-gray-500'
                                  }`}>
                                    {(project.charterStatus || 'draft').replace(/_/g, ' ')}
                                  </Badge>
                                </td>
                                <td className="p-3">
                                  <span className={`text-sm font-medium ${
                                    (project.riskScore || 0) > 70 ? 'text-red-600' :
                                    (project.riskScore || 0) > 40 ? 'text-amber-600' :
                                    'text-emerald-600'
                                  }`}>
                                    {project.riskScore ?? '—'}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span className={`text-sm font-medium ${
                                    (project.complianceScore || 0) >= 70 ? 'text-emerald-600' :
                                    (project.complianceScore || 0) >= 40 ? 'text-amber-600' :
                                    'text-red-600'
                                  }`}>
                                    {project.complianceScore != null ? `${project.complianceScore}%` : '—'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>}

          {isTabAllowed("insights") && <TabsContent value="insights" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HexagonLogoFrame px={20} />
                  {t('portfolio.gateway.aiInsightsTab')}
                </CardTitle>
                <CardDescription>{t('portfolio.gateway.aiInsightsTabDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="p-4 rounded-lg border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="h-5 w-5 text-blue-600" />
                      <h4 className="font-medium">{t('portfolio.gateway.resourceOptimization')}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('portfolio.gateway.resourceOptimizationDesc')}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg border bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-5 w-5 text-emerald-600" />
                      <h4 className="font-medium">{t('portfolio.gateway.performanceTrend')}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('portfolio.gateway.performanceTrendDesc')}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg border bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <h4 className="font-medium">{t('portfolio.gateway.riskAlert')}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('portfolio.gateway.riskAlertDesc', { count: summary?.byHealth?.at_risk || 0 })}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg border bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-5 w-5 text-purple-600" />
                      <h4 className="font-medium">{t('portfolio.gateway.strategicAlignment')}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('portfolio.gateway.strategicAlignmentDesc')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>}
        </Tabs>
      </main>

      <WorkspacePathSelectionDialog
        open={workspacePathDialogOpen}
        onOpenChange={setWorkspacePathDialogOpen}
        item={selectedPipelineItem}
        onSelect={handleWorkspacePathSelect}
      />

      <ConvertDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        item={selectedPipelineItem}
        workspacePath={selectedWorkspacePath}
        onConfirm={(data) => createProjectMutation.mutate({ ...data, workspacePath: selectedWorkspacePath })}
        isPending={createProjectMutation.isPending}
      />

      <PhaseTransitionDialog
        open={transitionDialogOpen}
        onOpenChange={setTransitionDialogOpen}
        project={selectedProject}
        onConfirm={(toPhase, reason, transitionType) =>
          selectedProject && transitionMutation.mutate({ projectId: selectedProject.id, toPhase, reason, transitionType })
        }
        isPending={transitionMutation.isPending}
      />

      <RejectDemandDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        item={selectedRejectItem}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        onConfirm={() => selectedRejectItem && rejectDemandMutation.mutate({ demandId: selectedRejectItem.id, reason: rejectReason })}
        isPending={rejectDemandMutation.isPending}
      />
    </div>
  );
}
