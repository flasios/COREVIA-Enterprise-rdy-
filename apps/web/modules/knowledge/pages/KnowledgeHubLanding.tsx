import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Building2,
  Database,
  FileText,
  Layers,
  Network,
  Shield,
  Cpu,
  Sparkles,
  Search,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import { ConstellationLandingLayout, GatewayCard } from "@/components/layout";

export default function KnowledgeHubLanding() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Fetch knowledge document stats
  const { data: knowledgeDocStats } = useQuery({
    queryKey: ["/api/knowledge/documents/stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/knowledge/documents/stats");
      return response.json();
    },
  });

  // Fetch demand stats for EA context
  const { data: demandStats } = useQuery({
    queryKey: ["/api/demand-reports/stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/demand-reports/stats");
      return response.json();
    },
  });

  const knowledgeStats = knowledgeDocStats?.data ?? {};
  const totalDocuments = Number(knowledgeStats.total ?? 0);
  const statusCounts = knowledgeStats.statusCounts ?? {};
  const processedDocuments = Number(statusCounts.completed ?? 0);
  const categoryCounts = knowledgeStats.categoryCounts ?? {};
  const collectionsCount = Object.values(categoryCounts).filter(
    (count) => Number(count) > 0
  ).length;
  const demandTotal = Number(demandStats?.total ?? 0);

  const handleNavigate = (path: string) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setLocation(path);
    }, 400);
  };

  const services = [
    {
      id: "ea-registry",
      title: t('knowledge.eaRegistry'),
      description: t('knowledge.eaRegistryDesc'),
      icon: <Building2 className="h-5 w-5" />,
      stats: [
        { label: t('knowledge.registries'), value: "4" },
        { label: t('knowledge.demands'), value: demandTotal.toLocaleString() },
      ],
      accentColor: "indigo" as const,
      isActive: true,
      path: "/ea-registry",
    },
    {
      id: "document-repository",
      title: t('knowledge.documentRepository'),
      description: t('knowledge.documentRepositoryDesc'),
      icon: <BookOpen className="h-5 w-5" />,
      stats: [
        { label: t('knowledge.documents'), value: totalDocuments.toLocaleString() },
        { label: t('knowledge.processed'), value: processedDocuments.toLocaleString() },
      ],
      accentColor: "amber" as const,
      isActive: true,
      path: "/knowledge-centre",
    },
  ];

  return (
    <ConstellationLandingLayout
      title={t('knowledge.knowledgeCentre')}
      icon={<HexagonLogoFrame px={16} />}
      accentColor="emerald"
      testId="gateway-knowledge-hub"
    >
      <div
        className={`w-full max-w-5xl px-8 transition-all duration-500 ${
          isTransitioning
            ? "opacity-0 scale-95"
            : "opacity-100 scale-100"
        }`}
      >
        {/* Central Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-light tracking-tight">
            <span className="font-bold bg-gradient-to-r from-emerald-600 via-cyan-500 to-emerald-600 dark:from-emerald-300 dark:via-cyan-400 dark:to-emerald-300 bg-clip-text text-transparent">
              {t('knowledge.knowledgeCentre')}
            </span>
          </h1>
          <p className="text-emerald-800/70 dark:text-emerald-200/60 mt-3 text-lg">
            {t('knowledge.subtitle')}
          </p>
        </div>

        {/* Two main service cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {services.map((service) => (
            <div key={service.id} className="flex flex-col">
              <GatewayCard
                title={service.title}
                description={service.description}
                icon={service.icon}
                accentColor={service.accentColor}
                isActive={service.isActive}
                onClick={() => handleNavigate(service.path)}
                stats={service.stats}
                testId={`landing-service-${service.id}`}
              />

              {/* Sub-features list */}
              <div className="mt-3 px-2">
                {service.id === "ea-registry" && (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: <Layers className="h-3 w-3" />, label: t('ea.capabilityRegistry') },
                      { icon: <Cpu className="h-3 w-3" />, label: t('ea.applicationRegistry') },
                      { icon: <Database className="h-3 w-3" />, label: t('ea.dataDomainRegistry') },
                      { icon: <Shield className="h-3 w-3" />, label: t('ea.technologyStandards') },
                    ].map((sub) => (
                      <div
                        key={sub.label}
                        className="flex items-center gap-1.5 text-xs text-indigo-600/70 dark:text-indigo-400/70"
                      >
                        {sub.icon}
                        <span>{sub.label}</span>
                      </div>
                    ))}
                  </div>
                )}
                {service.id === "document-repository" && (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: <Search className="h-3 w-3" />, label: t('knowledge.semanticSearch') },
                      { icon: <Network className="h-3 w-3" />, label: t('knowledge.knowledgeGraph') },
                      { icon: <Sparkles className="h-3 w-3" />, label: t('knowledge.autoClassification') },
                      { icon: <FileText className="h-3 w-3" />, label: t('knowledge.intelligenceBriefings') },
                    ].map((sub) => (
                      <div
                        key={sub.label}
                        className="flex items-center gap-1.5 text-xs text-amber-600/70 dark:text-amber-400/70"
                      >
                        {sub.icon}
                        <span>{sub.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom metadata */}
        <div className="mt-12 flex items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
            <span>{t('knowledge.eaRegistriesCount', { count: 4 })}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse"
              style={{ animationDelay: "0.5s" }}
            />
            <span>{totalDocuments.toLocaleString()} {t('knowledge.documents')}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"
              style={{ animationDelay: "1s" }}
            />
            <span>{collectionsCount.toLocaleString()} {t('knowledge.collections')}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-pulse"
              style={{ animationDelay: "1.5s" }}
            />
            <span>{t('knowledge.ragPowered')}</span>
          </div>
        </div>
      </div>
    </ConstellationLandingLayout>
  );
}
