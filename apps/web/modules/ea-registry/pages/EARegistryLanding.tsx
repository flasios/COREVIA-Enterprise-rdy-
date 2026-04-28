import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Layers,
  Cpu,
  Database,
  Shield,
  Search,
  Sparkles,
  Network,
  GitBranch,
  Zap,
  Lock,
  Download,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ConstellationLandingLayout, GatewayCard } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemandIngestDialog } from "../components";

export default function EARegistryLanding() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [ingestOpen, setIngestOpen] = useState(false);

  const { data: demandStats } = useQuery({
    queryKey: ["/api/demand-reports/stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/demand-reports/stats");
      return response.json();
    },
  });

  const { data: baselineData } = useQuery({
    queryKey: ["/api/ea/registry/baseline"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/ea/registry/baseline");
      return response.json();
    },
  });

  const demandTotal = Number(demandStats?.total ?? 0);
  const baseline = baselineData?.data?.summary;

  const handleNavigate = (path: string) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setLocation(path);
    }, 400);
  };

  const registries = [
    {
      id: "capability",
      title: t('ea.capabilityRegistry'),
      description: t('ea.capabilityRegistryDesc'),
      icon: <Layers className="h-5 w-5" />,
      stats: [
        { label: t('ea.capabilities'), value: baseline ? String(baseline.capabilities) : "—" },
        { label: t('ea.fromDemands'), value: demandTotal.toLocaleString() },
      ],
      accentColor: "indigo" as const,
      isActive: true,
      path: "/ea-registry/capabilities",
      features: [
        { icon: <GitBranch className="h-3 w-3" />, label: t('ea.valueStreams') },
        { icon: <Sparkles className="h-3 w-3" />, label: t('ea.strategicAlignment') },
        { icon: <Network className="h-3 w-3" />, label: t('ea.duplicationDetection') },
      ],
    },
    {
      id: "application",
      title: t('ea.applicationRegistry'),
      description: t('ea.applicationRegistryDesc'),
      icon: <Cpu className="h-5 w-5" />,
      stats: [
        { label: t('ea.applications'), value: baseline ? String(baseline.applications) : "—" },
        { label: t('ea.integrations'), value: baseline ? String(baseline.integrations) : "—" },
      ],
      accentColor: "blue" as const,
      isActive: true,
      path: "/ea-registry/applications",
      features: [
        { icon: <Zap className="h-3 w-3" />, label: t('ea.lifecycleTracking') },
        { icon: <Network className="h-3 w-3" />, label: t('ea.integrationMap') },
        { icon: <Search className="h-3 w-3" />, label: t('ea.dependencyAnalysis') },
      ],
    },
    {
      id: "data-domain",
      title: t('ea.dataDomainRegistry'),
      description: t('ea.dataDomainRegistryDesc'),
      icon: <Database className="h-5 w-5" />,
      stats: [
        { label: t('ea.domains'), value: baseline ? String(baseline.dataDomains) : "—" },
        { label: t('ea.classifications'), value: baseline ? String(new Set((baselineData?.data?.dataDomains ?? []).map((d: Record<string, string>) => d.classification)).size || 0) : "—" },
      ],
      accentColor: "emerald" as const,
      isActive: true,
      path: "/ea-registry/data-domains",
      features: [
        { icon: <Lock className="h-3 w-3" />, label: t('ea.sensitivityScoring') },
        { icon: <Shield className="h-3 w-3" />, label: t('ea.piiRiskAssessment') },
        { icon: <Database className="h-3 w-3" />, label: t('ea.retentionPolicies') },
      ],
    },
    {
      id: "technology",
      title: t('ea.technologyStandards'),
      description: t('ea.technologyStandardsDesc'),
      icon: <Shield className="h-5 w-5" />,
      stats: [
        { label: t('ea.standards'), value: baseline ? String(baseline.technologyStandards) : "—" },
        { label: t('ea.stackLayers'), value: baseline ? String(new Set((baselineData?.data?.technologyStandards ?? []).map((s: Record<string, string>) => s.layer)).size || 0) : "—" },
      ],
      accentColor: "violet" as const,
      isActive: true,
      path: "/ea-registry/technology",
      features: [
        { icon: <Cpu className="h-3 w-3" />, label: t('ea.stackAnalysis') },
        { icon: <Shield className="h-3 w-3" />, label: t('ea.cloudAlignment') },
        { icon: <Zap className="h-3 w-3" />, label: t('ea.vendorMapping') },
      ],
    },
    {
      id: "integrations",
      title: t('ea.integrationRegistryTitle'),
      description: t('ea.integrationRegistryDesc'),
      icon: <Network className="h-5 w-5" />,
      stats: [
        { label: t('ea.integrations'), value: baseline ? String(baseline.integrations) : "—" },
        { label: t('ea.protocols'), value: baseline ? String(new Set((baselineData?.data?.integrations ?? []).map((i: Record<string, string>) => i.protocol).filter(Boolean)).size || 0) : "—" },
      ],
      accentColor: "teal" as const,
      isActive: true,
      path: "/ea-registry/integrations",
      features: [
        { icon: <Zap className="h-3 w-3" />, label: t('ea.protocolMapping') },
        { icon: <Network className="h-3 w-3" />, label: t('ea.dataFlowAnalysis') },
        { icon: <Shield className="h-3 w-3" />, label: t('ea.criticalPathTracking') },
      ],
    },
  ];

  const accentColors = ["indigo", "blue", "emerald", "violet", "teal"] as const;

  return (
    <ConstellationLandingLayout
      title={t('ea.enterpriseArchitectureRegistry')}
      icon={<Building2 className="h-4 w-4 text-white" />}
      accentColor="indigo"
      testId="gateway-ea-registry"
    >
      <div
        className={`w-full max-w-6xl px-8 transition-all duration-500 ${
          isTransitioning
            ? "opacity-0 scale-95"
            : "opacity-100 scale-100"
        }`}
      >
        {/* Central Title */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-light tracking-tight">
            <span className="font-bold bg-gradient-to-r from-indigo-600 via-blue-500 to-indigo-600 dark:from-indigo-300 dark:via-blue-400 dark:to-indigo-300 bg-clip-text text-transparent">
              {t('ea.enterpriseArchitectureRegistry')}
            </span>
          </h1>
          <p className="text-indigo-800/70 dark:text-indigo-200/60 mt-3 text-lg">
            {t('ea.registrySubtitle')}
          </p>
        </div>

        {/* Governance Command Bar */}
        {baseline && (
          <div className="mb-6 flex items-center justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-4 px-5 py-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {baseline.total - (baseline.pendingVerification || 0)}
                </span>
                <span className="text-xs text-muted-foreground">Verified</span>
              </div>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  {baseline.pendingVerification || 0}
                </span>
                <span className="text-xs text-muted-foreground">Pending</span>
              </div>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                  {baseline.demandIngested || 0}
                </span>
                <span className="text-xs text-muted-foreground">Ingested</span>
              </div>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                  {baseline.documents || 0}
                </span>
                <span className="text-xs text-muted-foreground">Documents</span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
              onClick={() => setIngestOpen(true)}
            >
              <Download className="h-3.5 w-3.5" />
              Ingest from Demand
              <Sparkles className="h-3 w-3" />
            </Button>

            {(baseline.pendingVerification ?? 0) > 0 && (
              <Badge className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800 cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors">
                <AlertTriangle className="h-3 w-3" />
                {baseline.pendingVerification} items need verification
              </Badge>
            )}
          </div>
        )}

        {/* Five registry cards – top 3, bottom 2 centered */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {registries.slice(0, 3).map((registry, index) => (
            <div key={registry.id} className="flex flex-col">
              <GatewayCard
                title={registry.title}
                description={registry.description}
                icon={registry.icon}
                accentColor={accentColors[index % accentColors.length]!}
                isActive={registry.isActive}
                onClick={() => handleNavigate(registry.path)}
                stats={registry.stats}
                testId={`landing-registry-${registry.id}`}
              />
              <div className="mt-2.5 px-1 flex flex-col gap-1.5">
                {registry.features.map((f) => (
                  <div
                    key={f.label}
                    className={`flex items-center gap-1.5 text-xs ${
                      registry.accentColor === "indigo"
                        ? "text-indigo-600/60 dark:text-indigo-400/60"
                        : registry.accentColor === "blue"
                        ? "text-blue-600/60 dark:text-blue-400/60"
                        : registry.accentColor === "emerald"
                        ? "text-emerald-600/60 dark:text-emerald-400/60"
                        : registry.accentColor === "teal"
                        ? "text-teal-600/60 dark:text-teal-400/60"
                        : "text-violet-600/60 dark:text-violet-400/60"
                    }`}
                  >
                    {f.icon}
                    <span>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 max-w-[66%] mx-auto">
          {registries.slice(3).map((registry, index) => (
            <div key={registry.id} className="flex flex-col">
              <GatewayCard
                title={registry.title}
                description={registry.description}
                icon={registry.icon}
                accentColor={accentColors[(index + 3) % accentColors.length]!}
                isActive={registry.isActive}
                onClick={() => handleNavigate(registry.path)}
                stats={registry.stats}
                testId={`landing-registry-${registry.id}`}
              />
              <div className="mt-2.5 px-1 flex flex-col gap-1.5">
                {registry.features.map((f) => (
                  <div
                    key={f.label}
                    className={`flex items-center gap-1.5 text-xs ${
                      registry.accentColor === "indigo"
                        ? "text-indigo-600/60 dark:text-indigo-400/60"
                        : registry.accentColor === "blue"
                        ? "text-blue-600/60 dark:text-blue-400/60"
                        : registry.accentColor === "emerald"
                        ? "text-emerald-600/60 dark:text-emerald-400/60"
                        : registry.accentColor === "teal"
                        ? "text-teal-600/60 dark:text-teal-400/60"
                        : "text-violet-600/60 dark:text-violet-400/60"
                    }`}
                  >
                    {f.icon}
                    <span>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom metadata */}
        <div className="mt-10 flex items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
            <span>{t('ea.togafFramework')}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-500 dark:bg-violet-400 animate-pulse" style={{ animationDelay: "0.5s" }} />
            <span>{t('ea.vectorEmbeddings')}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" style={{ animationDelay: "1s" }} />
            <span>{t('knowledge.ragPowered')}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" style={{ animationDelay: "1.5s" }} />
            <span>{demandTotal.toLocaleString()} {t('ea.demandSources')}</span>
          </div>
        </div>
      </div>

      <DemandIngestDialog open={ingestOpen} onOpenChange={setIngestOpen} />
    </ConstellationLandingLayout>
  );
}
