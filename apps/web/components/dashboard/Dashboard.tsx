import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalCard } from "@/components/shared/misc";
import { OrganizationStatus, UserMenu, NotificationCenter } from "@/components/shared/user";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthorization } from "@/hooks/useAuthorization";
import { IntelligencePanel } from "@/components/shared/assistant";
import SystemHealthPulse from "./SystemHealthPulse";
import {
  FileText,
  Briefcase,
  BookOpen,
  Network,
  FileCheck,
  Zap,
  Shield,
} from "lucide-react";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

async function fetchDashboardBootstrap() {
  const res = await fetch("/api/dashboard/bootstrap", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch dashboard data");
  return res.json();
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [selectedPortal, setSelectedPortal] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { canAccess: canAccessBrain } = useAuthorization({ requiredPermissions: ["brain:view"] });
  const { canAccess: canAccessKnowledge } = useAuthorization({ requiredPermissions: ["knowledge:read"] });
  const { canAccess: canAccessPortfolio } = useAuthorization({ requiredPermissions: ["portfolio:view"] });

  const { data: bootstrapData } = useQuery({
    queryKey: ["/api/dashboard/bootstrap"],
    queryFn: fetchDashboardBootstrap,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const liveData = bootstrapData?.data;
  const portfolioCount = liveData?.portfolio?.totalProjects ?? 0;
  const demandCount = liveData?.demands?.totalDemands ?? 0;
  const brainDecisions = liveData?.brain?.totalDecisions ?? 0;
  const todayEvents = liveData?.brain?.todayEvents ?? 0;

  const portals = [
    {
      id: "ai-brain",
      title: t('dashboard.portals.brain.title'),
      description: t('dashboard.portals.brain.description'),
      icon: <Shield className="h-4 w-4" />,
      features: t('dashboard.portals.brain.features', { returnObjects: true }) as string[],
      actionText: t('dashboard.portals.brain.action'),
      actionVariant: "default" as const,
      color: "bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-600 hover:from-rose-400 hover:via-pink-400 hover:to-fuchsia-500",
      buttonColor: "bg-gradient-to-r from-rose-500 to-fuchsia-500 hover:from-rose-400 hover:to-fuchsia-400 text-white",
      usageLevel: 100,
      metrics: {
        label: t('dashboard.metrics.decisions'),
        value: String(brainDecisions),
        status: todayEvents > 0 ? t('dashboard.metrics.today', { count: todayEvents }) : t('dashboard.metrics.ready')
      },
      isPremium: true
    },
    {
      id: "intelligent-gateway",
      title: t('dashboard.portals.gateway.title'),
      description: t('dashboard.portals.gateway.description'),
      icon: <HexagonLogoFrame px={16} />,
      features: t('dashboard.portals.gateway.features', { returnObjects: true }) as string[],
      actionText: t('dashboard.portals.gateway.action'),
      actionVariant: "default" as const,
      color: "bg-blue-500 hover:bg-blue-600",
      buttonColor: "bg-blue-500 hover:bg-blue-600 text-white",
      usageLevel: 92,
      metrics: {
        label: t('dashboard.metrics.assessments'),
        value: String(demandCount),
        status: demandCount > 0 ? t('app.active') : t('dashboard.metrics.none')
      }
    },
    {
      id: "intelligent-library",
      title: t('dashboard.portals.library.title'),
      description: t('dashboard.portals.library.description'),
      icon: <FileText className="h-4 w-4" />,
      features: t('dashboard.portals.library.features', { returnObjects: true }) as string[],
      actionText: t('dashboard.portals.library.action'),
      actionVariant: "default" as const,
      color: "bg-emerald-500 hover:bg-emerald-600",
      buttonColor: "bg-emerald-500 hover:bg-emerald-600 text-white",
      usageLevel: 87,
      metrics: {
        label: t('dashboard.metrics.reports'),
        value: String(demandCount),
        status: t('dashboard.metrics.library')
      }
    },
    {
      id: "portfolio-hub",
      title: t('dashboard.portals.portfolio.title'),
      description: t('dashboard.portals.portfolio.description'),
      icon: <Briefcase className="h-4 w-4" />,
      features: t('dashboard.portals.portfolio.features', { returnObjects: true }) as string[],
      actionText: t('dashboard.portals.portfolio.action'),
      actionVariant: "default" as const,
      color: "bg-purple-500 hover:bg-purple-600",
      buttonColor: "bg-purple-500 hover:bg-purple-600 text-white",
      usageLevel: 73,
      metrics: {
        label: t('dashboard.metrics.projects'),
        value: String(portfolioCount),
        status: portfolioCount > 0 ? t('dashboard.metrics.managed') : t('dashboard.metrics.none')
      }
    },
    {
      id: "knowledge-centre",
      title: t('dashboard.portals.knowledge.title'),
      description: t('dashboard.portals.knowledge.description'),
      icon: <BookOpen className="h-4 w-4" />,
      features: t('dashboard.portals.knowledge.features', { returnObjects: true }) as string[],
      actionText: t('dashboard.portals.knowledge.action'),
      actionVariant: "default" as const,
      color: "bg-amber-500 hover:bg-amber-600",
      buttonColor: "bg-amber-500 hover:bg-amber-600 text-white",
      usageLevel: 65,
      metrics: {
        label: t('dashboard.metrics.documents'),
        value: "0",
        status: "Repository"
      }
    },
    {
      id: "synergies",
      title: t('dashboard.portals.synergies.title'),
      description: t('dashboard.portals.synergies.description'),
      icon: <Network className="h-4 w-4" />,
      features: t('dashboard.portals.synergies.features', { returnObjects: true }) as string[],
      actionText: t('dashboard.portals.synergies.action'),
      actionVariant: "default" as const,
      color: "bg-teal-500 hover:bg-teal-600",
      buttonColor: "bg-teal-500 hover:bg-teal-600 text-white",
      usageLevel: 58,
      metrics: {
        label: t('dashboard.metrics.opportunities'),
        value: "0",
        status: t('dashboard.metrics.scanning')
      }
    },
    {
      id: "tender-generator",
      title: t('dashboard.portals.tender.title'),
      description: t('dashboard.portals.tender.description'),
      icon: <FileCheck className="h-4 w-4" />,
      features: t('dashboard.portals.tender.features', { returnObjects: true }) as string[],
      actionText: t('dashboard.portals.tender.action'),
      actionVariant: "default" as const,
      color: "bg-orange-500 hover:bg-orange-600",
      buttonColor: "bg-orange-500 hover:bg-orange-600 text-white",
      usageLevel: 35,
      metrics: {
        label: t('dashboard.metrics.tenders'),
        value: "0",
        status: t('dashboard.metrics.ready')
      }
    },
  ];
  const visiblePortals = portals.filter((portal) => {
    if (portal.id === "ai-brain") return canAccessBrain;
    if (portal.id === "knowledge-centre") return canAccessKnowledge;
    if (portal.id === "portfolio-hub") return canAccessPortfolio;
    return true;
  });

  const handlePortalAction = (portalId: string) => {
    if (portalId === "ai-brain") {
      if (!canAccessBrain) {
        return;
      }
      setLocation("/brain-console");
    } else if (portalId === "intelligent-gateway") {
      setLocation("/intelligent-gateway");
    } else if (portalId === "intelligent-library") {
      setLocation("/intelligent-library");
    } else if (portalId === "portfolio-hub") {
      if (!canAccessPortfolio) {
        return;
      }
      setLocation("/portfolio-hub");
    } else if (portalId === "knowledge-centre") {
      if (!canAccessKnowledge) {
        return;
      }
      setLocation("/knowledge-hub");
    } else if (portalId === "synergies") {
      setLocation("/synergies");
    } else if (portalId === "portfolio-optimizer") {
      setLocation("/portfolio-hub");
    } else if (portalId === "tender-generator") {
      setLocation("/tenders");
    } else {
      setSelectedPortal(portalId);
    }
  };

  const { isAuthenticated, isLoading: authLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background constellation-grid relative overflow-hidden" data-testid="dashboard-main">
      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 space-y-3 sm:space-y-4 flex flex-col min-h-screen relative z-10">
        {/* Organization Status + User Controls */}
        <div className="flex flex-col gap-3 pt-2 md:flex-row md:items-center">
          <div className="flex-1">
            <OrganizationStatus />
          </div>
          {!authLoading && isAuthenticated && (
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0 md:justify-end">
              <CommandPalette />
              <LanguageSwitcher />
              <NotificationCenter />
              <UserMenu />
            </div>
          )}
        </div>

        {/* System Health Pulse Bar */}
        <SystemHealthPulse />

        {/* Top Row: Header (left) + Brain Card (right - matches portal grid width) */}
        <div className="flex flex-col gap-4 lg:flex-row">
          {/* Left - Header (same width as Intelligence Panel) */}
          <div className="w-full lg:w-[320px] xl:w-[360px] 2xl:w-[400px] lg:flex-shrink-0 flex items-center gap-4">
            <div className="h-12 w-1.5 bg-gradient-to-b from-violet-500 via-primary to-indigo-500 rounded-full shadow-lg shadow-primary/30" />
            <div className="flex flex-col" data-testid="heading-digital-transformation-hub">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-violet-400 via-primary to-indigo-400 bg-clip-text text-transparent">
                {t('app.subtitle')}
              </h2>
            </div>
          </div>

          {/* Right - Brain Card (same width as portal grid below) */}
          {canAccessBrain ? (
            <button
              type="button"
              className="flex-1 rounded-lg overflow-hidden group relative text-left"
              onClick={() => handlePortalAction("ai-brain")}
              data-testid="card-brain-of-coveria"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-600 group-hover:from-rose-400 group-hover:via-pink-400 group-hover:to-fuchsia-500 transition-all duration-300" />
              <div className="relative px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-9 w-9 rounded-lg overflow-hidden flex items-center justify-center bg-white/20">
                    <HexagonLogoFrame px={20} />
                    <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-pink-400 border border-white" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-white leading-tight">{t('dashboard.portals.brain.title')}</h3>
                    <span className="px-1.5 py-0.5 rounded bg-white/20 text-[8px] font-bold text-white uppercase">{t('app.autonomous')}</span>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-end sm:text-right">
                  <div className="flex flex-wrap items-center gap-2 text-white/80 text-[11px]">
                    <span><strong className="text-white">13</strong> {t('dashboard.metrics.agents')}</span>
                    <span className="text-white/30">|</span>
                    <span><strong className="text-white">8</strong> {t('dashboard.metrics.layers')}</span>
                  </div>
                  <span className="px-3 py-1.5 rounded-md bg-white text-rose-600 font-semibold text-xs hover:bg-white/90 transition-colors flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    {t('app.enter')}
                  </span>
                </div>
              </div>
            </button>
          ) : null}
        </div>

        {/* Main Content Layout */}
        <div className="flex-1 flex flex-col gap-3 sm:gap-4 overflow-auto lg:flex-row">
          {/* Left Side - Intelligence Panel + Activity Feed */}
          <div className="home-intel-panel w-full h-[480px] sm:h-[520px] lg:w-[320px] xl:w-[360px] 2xl:w-[400px] lg:flex-shrink-0 lg:self-start space-y-4" data-testid="intelligence-panel-section">
            <IntelligencePanel compact selectedPortal={selectedPortal ? visiblePortals.find(p => p.id === selectedPortal) : null} />
          </div>

          {/* Right Side - Portal Cards */}
          <div className="flex-1 min-h-0 space-y-4">
            {/* Portal Cards Grid - 3 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-fr">
              {visiblePortals.filter(p => p.id !== "ai-brain").map((portal) => (
                <PortalCard
                  key={portal.id}
                  title={portal.title}
                  description={portal.description}
                  icon={portal.icon}
                  features={portal.features}
                  actionText={portal.actionText}
                  actionVariant={portal.actionVariant}
                  onAction={() => handlePortalAction(portal.id)}
                  onSelect={() => handlePortalAction(portal.id)}
                  color={portal.color}
                  buttonColor={portal.buttonColor}
                  usageLevel={portal.usageLevel}
                  metrics={portal.metrics}
                />
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
