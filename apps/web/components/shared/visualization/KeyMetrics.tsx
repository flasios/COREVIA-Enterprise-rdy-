import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, FileCheck, Clock } from "lucide-react";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';

async function fetchDashboardBootstrap() {
  const res = await fetch("/api/dashboard/bootstrap", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch dashboard data");
  return res.json();
}

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
}

function MetricCard({ title, value, change, changeType = "neutral", icon }: MetricCardProps) {
  const changeColor = changeType === "positive" ? "text-chart-2" :
                     changeType === "negative" ? "text-destructive" : "text-muted-foreground";

  return (
    <Card data-testid={`metric-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold" data-testid={`value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </p>
            {change && (
              <p className={`text-xs ${changeColor} flex items-center gap-1`}>
                <TrendingUp className="h-3 w-3" />
                {change}
              </p>
            )}
          </div>
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function KeyMetrics() {
  const { t } = useTranslation();
  const { data: bootstrapData } = useQuery({
    queryKey: ["/api/dashboard/bootstrap"],
    queryFn: fetchDashboardBootstrap,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const liveData = bootstrapData?.data;
  const demandCount = liveData?.demands?.totalDemands ?? 0;
  const portfolioCount = liveData?.portfolio?.totalProjects ?? 0;
  const brainDecisions = liveData?.brain?.totalDecisions ?? 0;
  const todayEvents = liveData?.brain?.todayEvents ?? 0;

  const metrics = [
    {
      title: t('visualization.keyMetrics.demandIntakes'),
      value: String(demandCount),
      change: demandCount > 0 ? t('visualization.keyMetrics.fromDatabase') : undefined,
      changeType: "positive" as const,
      icon: <FileCheck className="h-4 w-4 text-muted-foreground" />
    },
    {
      title: t('visualization.keyMetrics.portfolioProjects'),
      value: String(portfolioCount),
      change: portfolioCount > 0 ? t('visualization.keyMetrics.tracked') : undefined,
      changeType: "positive" as const,
      icon: <Users className="h-4 w-4 text-muted-foreground" />
    },
    {
      title: t('visualization.keyMetrics.brainDecisions'),
      value: String(brainDecisions),
      change: brainDecisions > 0 ? t('visualization.keyMetrics.pipelineProcessed') : undefined,
      changeType: "positive" as const,
      icon: <HexagonLogoFrame px={16} />
    },
    {
      title: t('visualization.keyMetrics.todayEvents'),
      value: String(todayEvents),
      change: todayEvents > 0 ? t('visualization.keyMetrics.last24h') : undefined,
      changeType: "positive" as const,
      icon: <Clock className="h-4 w-4 text-muted-foreground" />
    }
  ];

  return (
    <div className="space-y-4" data-testid="section-key-metrics">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('visualization.keyMetrics.title')}</h2>
        <Badge variant="secondary" className="text-xs">{t('visualization.keyMetrics.liveData')}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>
    </div>
  );
}
