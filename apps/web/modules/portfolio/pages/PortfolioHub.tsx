import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuthorization } from "@/hooks/useAuthorization";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { ConstellationLandingLayout, GatewayCard } from "@/components/layout";
import {
  Gauge,
  FolderKanban,
  Building2,
  TrendingUp,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Activity,
  Target,
  BarChart3,
  Briefcase,
  Layers,
  Shield,
  Zap,
  FileCheck,
  ChevronRight,
  Home,
  Globe,
  Lock,
  Award,
  Sparkles,
  Info,
  BookOpen,
  Settings,
  LayoutDashboard,
  LineChart,
  ClipboardList,
  Workflow,
  Calendar,
  PieChart,
  type LucideIcon,
} from "lucide-react";

type PortfolioStats = {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  atRiskProjects: number;
  totalBudget: number;
  utilizationRate: number;
};

type ServiceInfo = {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  icon: LucideIcon;
  variant: "command" | "project" | "pmo";
  href: string;
  stats: { icon: LucideIcon; value: string | number; label: string }[];
  features: string[];
  capabilities: { icon: LucideIcon; title: string; description: string }[];
  testId: string;
  requiredPermission: "portfolio:view" | "project:view" | "pmo:governance-review";
};

function _CompactHeader() {
  return (
    <div className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-20">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-1 h-8" data-testid="button-back-home">
              <Link href="/">
                <Home className="h-3.5 w-3.5" />
                <span className="text-xs">Home</span>
              </Link>
            </Button>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Briefcase className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-foreground">Intelligent Portfolio</h1>
                <p className="text-[10px] text-muted-foreground">Enterprise Management Gateway</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] h-5">
              <Activity className="h-2.5 w-2.5 mr-1" />
              Online
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function _InfoPanel({ service, stats }: { service: ServiceInfo | null; stats: PortfolioStats | undefined }) {
  const gradients = {
    command: "from-blue-600 via-blue-700 to-indigo-800",
    project: "from-teal-600 via-cyan-700 to-blue-800",
    pmo: "from-indigo-600 via-purple-700 to-violet-800",
  };

  if (!service) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <div className="h-16 w-16 rounded-2xl bg-muted/50 border border-border flex items-center justify-center mb-4">
          <Info className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">Select a Service</h3>
        <p className="text-sm text-muted-foreground max-w-[200px]">
          Hover over a workspace card to see detailed information about its capabilities
        </p>
        
        <div className="mt-8 space-y-3 w-full">
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-foreground">{stats?.totalProjects ?? 0} Total Projects</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Across all portfolios</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-foreground">{stats?.activeProjects ?? 0} Active</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Currently in progress</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-medium text-foreground">{stats?.utilizationRate ?? 0}% Utilization</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Resource efficiency</p>
          </div>
        </div>
      </div>
    );
  }

  const Icon = service.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={service.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        transition={{ duration: 0.2 }}
        className="h-full flex flex-col"
      >
        <div className={`p-4 bg-gradient-to-br ${gradients[service.variant]} rounded-t-lg`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{service.title}</h3>
              <p className="text-[10px] text-white/70">{service.description.split('.')[0]}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {service.stats.map((stat, i) => (
              <div key={i} className="text-center p-2 rounded-lg bg-white/10">
                <stat.icon className="h-3 w-3 mx-auto mb-1 text-white/70" />
                <p className="text-sm font-bold text-white">{stat.value}</p>
                <p className="text-[9px] text-white/60">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <BookOpen className="h-3 w-3" />
                Overview
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {service.longDescription}
              </p>
            </div>

            <Separator />

            <div>
              <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Key Features
              </h4>
              <div className="space-y-1.5">
                {service.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-[11px] text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Settings className="h-3 w-3" />
                Capabilities
              </h4>
              <div className="space-y-2">
                {service.capabilities.map((cap, i) => (
                  <div key={i} className="p-2 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <cap.icon className="h-3 w-3 text-primary" />
                      <span className="text-[11px] font-medium text-foreground">{cap.title}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{cap.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border">
          <Link href={service.href}>
            <Button 
              className="w-full gap-2" 
              data-testid={`button-enter-${service.testId}`}
            >
              Enter Workspace
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function _ServiceCard({
  service,
  isSelected,
  onHover,
}: {
  service: ServiceInfo;
  isSelected: boolean;
  onHover: (service: ServiceInfo | null) => void;
}) {
  const Icon = service.icon;
  
  const gradients = {
    command: "from-blue-600 via-blue-700 to-indigo-800",
    project: "from-teal-600 via-cyan-700 to-blue-800",
    pmo: "from-indigo-600 via-purple-700 to-violet-800",
  };

  const borderColors = {
    command: "border-blue-500/50",
    project: "border-teal-500/50",
    pmo: "border-indigo-500/50",
  };

  return (
    <Card
      className={`group relative overflow-hidden cursor-pointer border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 ${
        isSelected ? `${borderColors[service.variant]} ring-1 ring-offset-0 ring-offset-transparent` : ''
      }`}
      data-testid={service.testId}
      onMouseEnter={() => onHover(service)}
    >
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradients[service.variant]}`} />
      
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${gradients[service.variant]} flex items-center justify-center shadow-lg`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <Link href={service.href}>
            <div
              className="h-8 w-8 rounded-full bg-white/10 group-hover:bg-white/20 text-white/60 group-hover:text-white transition-colors flex items-center justify-center"
              data-testid={`button-go-${service.testId}`}
            >
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        </div>

        <h3 className="text-lg font-bold text-white mb-1.5">{service.title}</h3>
        <p className="text-white/60 text-xs mb-4 leading-relaxed line-clamp-2">{service.description}</p>

        <div className="flex items-center gap-2 flex-wrap">
          {service.stats.slice(0, 2).map((stat, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] gap-1 bg-white/10 text-white/80 border-white/20">
              <stat.icon className="h-2.5 w-2.5" />
              {stat.value} {stat.label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AssuranceBadge({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-white/60" data-testid={`assurance-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="h-6 w-6 rounded-md bg-white/10 border border-white/20 flex items-center justify-center">
        <Icon className="h-3 w-3 text-blue-400" />
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  );
}

export default function PortfolioHub() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [_hoveredService, _setHoveredService] = useState<ServiceInfo | null>(null);
  const { canAccess: canAccessPortfolio } = useAuthorization({ requiredPermissions: ["portfolio:view"] });
  const { canAccess: canAccessProjectWorkspace } = useAuthorization({ requiredPermissions: ["project:view"] });
  const { canAccess: canAccessPmoOffice } = useAuthorization({ requiredPermissions: ["pmo:governance-review"] });

  const { data: statsResponse } = useQuery<{ success?: boolean; data?: PortfolioStats }>({ 
    queryKey: ["/api/portfolio/stats"],
  });
  const stats = statsResponse?.data;

  const { data: demandStatsResponse } = useQuery<{ total: number; pending: number; approved: number }>({ 
    queryKey: ["/api/demand-reports/stats"],
  });
  const demandStats = demandStatsResponse;

  const services: ServiceInfo[] = [
    {
      id: "portfolio-management",
      title: t('portfolio.services.management.title'),
      description: t('portfolio.services.management.description'),
      longDescription: "The Portfolio Management workspace provides executive-level visibility into your entire project portfolio. Monitor real-time health metrics, track strategic alignment with UAE Vision 2071, and make data-driven decisions with AI-powered analytics. Ideal for executives and portfolio managers who need a bird's-eye view of all initiatives.",
      icon: Gauge,
      variant: "command",
      href: "/intelligent-portfolio",
      stats: [
        { icon: Activity, value: stats?.activeProjects ?? 0, label: t('portfolio.stats.active') },
        { icon: TrendingUp, value: `${stats?.utilizationRate ?? 0}%`, label: t('portfolio.stats.utilization') },
        { icon: AlertTriangle, value: stats?.atRiskProjects ?? 0, label: t('portfolio.stats.atRisk') },
      ],
      features: [
        "Real-time portfolio health monitoring",
        "Executive KPI dashboards",
        "Strategic alignment tracking",
        "Risk & issue management",
        "AI-powered insights and recommendations",
      ],
      capabilities: [
        { icon: LayoutDashboard, title: "Executive Dashboard", description: "Real-time KPIs and portfolio health metrics" },
        { icon: LineChart, title: "Performance Analytics", description: "Trend analysis and predictive insights" },
        { icon: Target, title: "Strategic Alignment", description: "Track alignment with government objectives" },
      ],
      testId: "card-portfolio-management",
      requiredPermission: "portfolio:view",
    },
    {
      id: "project-manager",
      title: t('portfolio.services.projectManager.title'),
      description: t('portfolio.services.projectManager.description'),
      longDescription: "The Project Manager workspace is your command center for project execution excellence. Plan projects with AI-generated WBS, visualize timelines with Gantt charts, track critical paths, and manage resources efficiently. Features include milestone tracking, dependency management, and real-time collaboration tools for project teams.",
      icon: FolderKanban,
      variant: "project",
      href: "/project-workspace",
      stats: [
        { icon: CheckCircle2, value: stats?.completedProjects ?? 0, label: t('portfolio.stats.completed') },
        { icon: Clock, value: stats?.activeProjects ?? 0, label: t('portfolio.stats.inProgress') },
        { icon: Users, value: 0, label: t('portfolio.stats.team') },
      ],
      features: [
        "AI-powered WBS generation",
        "Interactive Gantt chart view",
        "Critical path analysis",
        "Resource allocation management",
        "Milestone & deliverable tracking",
      ],
      capabilities: [
        { icon: Workflow, title: "WBS Management", description: "AI-assisted work breakdown structure" },
        { icon: Calendar, title: "Schedule Planning", description: "Gantt charts and timeline visualization" },
        { icon: Users, title: "Team Collaboration", description: "Real-time updates and communication" },
      ],
      testId: "card-project-manager",
      requiredPermission: "project:view",
    },
    {
      id: "pmo-office",
      title: t('portfolio.services.pmo.title'),
      description: t('portfolio.services.pmo.description'),
      longDescription: "The PMO Office workspace provides enterprise-level governance and oversight capabilities. Manage demand intake, prioritize initiatives based on strategic value, ensure compliance with government standards, and maintain portfolio health. Includes approval workflows, capacity planning, and comprehensive audit trails for full accountability.",
      icon: Building2,
      variant: "pmo",
      href: "/pmo-office",
      stats: [
        { icon: Layers, value: stats?.totalProjects ?? 0, label: t('portfolio.stats.total') },
        { icon: Target, value: stats?.totalProjects ? `${Math.round((((stats.totalProjects - stats.atRiskProjects) / stats.totalProjects) * 100))}%` : '0%', label: t('portfolio.stats.onTarget') },
        { icon: FileCheck, value: demandStats?.approved ?? 0, label: t('portfolio.stats.approved') },
      ],
      features: [
        "Portfolio governance framework",
        "Demand intake & prioritization",
        "Approval workflow management",
        "Resource capacity planning",
        "Standards & compliance tracking",
      ],
      capabilities: [
        { icon: ClipboardList, title: "Demand Management", description: "Intake, evaluate, and prioritize demands" },
        { icon: PieChart, title: "Capacity Planning", description: "Resource allocation and forecasting" },
        { icon: Shield, title: "Governance & Compliance", description: "Standards enforcement and audit trails" },
      ],
      testId: "card-pmo-office",
      requiredPermission: "pmo:governance-review",
    },
  ];

  const visibleServices = services.filter((service) => {
    if (service.requiredPermission === "portfolio:view") return canAccessPortfolio;
    if (service.requiredPermission === "project:view") return canAccessProjectWorkspace;
    if (service.requiredPermission === "pmo:governance-review") return canAccessPmoOffice;
    return false;
  });

  const accentColors = ['blue', 'teal', 'indigo'] as const;

  return (
    <ConstellationLandingLayout
      title={t('portfolio.constellation')}
      icon={<Briefcase className="w-4 h-4 text-white" />}
      accentColor="blue"
      testId="gateway-portfolio"
    >
      <div className="w-full max-w-5xl px-8">
        {/* Central Title */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-light tracking-tight">
            <span className="font-bold bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 dark:from-amber-300 dark:via-orange-400 dark:to-amber-300 bg-clip-text text-transparent">{t('portfolio.title')}</span>
          </h1>
          <p className="text-amber-800/70 dark:text-amber-200/60 mt-3 text-lg">{t('portfolio.subtitle')}</p>
        </div>

        {/* Assurance Badges */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-4 mb-8 flex-wrap"
        >
          <AssuranceBadge icon={Shield} label={t('portfolio.badges.federalSecurity')} />
          <AssuranceBadge icon={Lock} label={t('portfolio.badges.dataSovereignty')} />
          <AssuranceBadge icon={Globe} label={t('portfolio.badges.uaeVision')} />
          <AssuranceBadge icon={Award} label={t('portfolio.badges.iso27001')} />
        </motion.div>

        {/* Unified Workspace Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {visibleServices.map((service, i) => (
            <GatewayCard
              key={service.id}
              title={service.title}
              description={service.description}
              icon={<service.icon className="h-5 w-5 text-white" />}
              accentColor={accentColors[i % accentColors.length]!}
              isActive={true}
              onClick={() => setLocation(service.href)}
              stats={service.stats.slice(0, 2).map(s => ({ label: s.label, value: s.value }))}
              testId={service.testId}
            />
          ))}
        </div>

        {visibleServices.length === 0 && (
          <div className="mt-6 rounded-lg border border-amber-300/40 bg-amber-50/60 p-4 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/20 dark:text-amber-200">
            No authorized portfolio workspaces are currently assigned to your account.
          </div>
        )}

        {/* Bottom metadata */}
        <div className="mt-10 flex items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="h-3 w-3 text-amber-500 dark:text-amber-400" />
            <span>{t('portfolio.badges.aiPowered')}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <Shield className="h-3 w-3 text-amber-500 dark:text-amber-400" />
            <span>{t('portfolio.badges.enterpriseSecurity')}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <Target className="h-3 w-3 text-amber-500 dark:text-amber-400" />
            <span>{t('portfolio.badges.sla')}</span>
          </div>
        </div>
      </div>
    </ConstellationLandingLayout>
  );
}
