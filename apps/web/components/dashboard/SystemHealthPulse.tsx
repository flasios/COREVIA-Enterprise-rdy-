import { useQuery } from "@tanstack/react-query";
import { memo } from "react";
import { useTranslation } from 'react-i18next';
import {
  Shield, Activity, Zap, Server, Cloud,
  Sparkles, CheckCircle2, AlertTriangle, Clock,
} from "lucide-react";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

/* ── Data fetchers ── */
async function fetchSystemHealth() {
  const [pipelineRes, engineRes] = await Promise.all([
    fetch("/api/corevia/stats/pipeline").then((r) =>
      r.ok ? r.json() : { stats: null }
    ),
    fetch("/api/corevia/stats/engines").then((r) =>
      r.ok ? r.json() : { stats: null }
    ),
  ]);

  return {
    pipeline: pipelineRes?.stats || {
      total: 0,
      processing: 0,
      pending: 0,
      blocked: 0,
      completed: 0,
      todayCount: 0,
    },
    engines: engineRes?.stats || {
      engines: [],
      attestations: 0,
      redactionReceipts: 0,
    },
  };
}

/* ── Engine visual ── */
function EngineIndicator({
  name,
  kind,
  enabled,
}: {
  name: string;
  kind: string;
  enabled: boolean;
}) {
  const config: Record<
    string,
    { icon: typeof Server; label: string; color: string }
  > = {
    SOVEREIGN_INTERNAL: {
      icon: Server,
      label: "A",
      color: "text-emerald-500",
    },
    EXTERNAL_HYBRID: { icon: Cloud, label: "B", color: "text-blue-500" },
    DISTILLATION: { icon: Sparkles, label: "C", color: "text-purple-500" },
  };
  const c = config[kind] ?? { icon: Server, label: "A", color: "text-emerald-500" };
  const Icon = c.icon;

  return (
    <div className="flex items-center gap-1.5" title={name}>
      <Icon className={`h-3 w-3 ${c.color}`} />
      <span className="text-[10px] font-mono font-semibold text-muted-foreground">
        {c.label}
      </span>
      <span
        className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-emerald-400" : "bg-red-400"}`}
      />
    </div>
  );
}

/* ── Main Component ── */
function SystemHealthPulse() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["/dashboard/system-health"],
    queryFn: fetchSystemHealth,
    refetchInterval: 12000,
    staleTime: 8000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/30 bg-muted/20 animate-pulse">
        <div className="h-3 w-3 rounded-full bg-muted" />
        <div className="h-2.5 w-24 rounded bg-muted" />
      </div>
    );
  }

  const { pipeline, engines } = data;
  const engineList =
    (engines.engines as Array<{
      id: string;
      name: string;
      kind: string;
      enabled: boolean;
    }>) || [];
  const allEnginesOnline =
    engineList.length > 0 && engineList.every((e) => e.enabled);
  const hasBlocked = pipeline.blocked > 0;
  const isHealthy = !hasBlocked && allEnginesOnline;

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 sm:px-4 py-2 rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm"
      data-testid="system-health-pulse"
    >
      {/* System status dot */}
      <div className="flex items-center gap-1.5">
        <div
          className={`h-2 w-2 rounded-full ${
            isHealthy
              ? "bg-emerald-500 animate-pulse"
              : hasBlocked
              ? "bg-red-500 animate-pulse"
              : "bg-amber-500 animate-pulse"
          }`}
        />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {isHealthy ? t('dashboard.systemHealth.healthy') : hasBlocked ? t('dashboard.systemHealth.alert') : t('dashboard.systemHealth.degraded')}
        </span>
      </div>

      <Separator orientation="vertical" className="hidden sm:block h-4" />

      {/* Brain metrics */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <div className="flex items-center gap-1" title={t('dashboard.systemHealth.processing')}>
          <Zap className="h-3 w-3 text-violet-500" />
          <span className="font-mono font-semibold">{pipeline.processing}</span>
        </div>
        <div className="flex items-center gap-1" title={t('dashboard.systemHealth.pending')}>
          <Clock className="h-3 w-3 text-amber-500" />
          <span className="font-mono font-semibold">{pipeline.pending}</span>
        </div>
        <div className="flex items-center gap-1" title={t('dashboard.systemHealth.completed')}>
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          <span className="font-mono font-semibold">{pipeline.completed}</span>
        </div>
        {pipeline.blocked > 0 && (
          <div className="flex items-center gap-1" title={t('dashboard.systemHealth.blocked')}>
            <AlertTriangle className="h-3 w-3 text-red-500" />
            <span className="font-mono font-semibold text-red-500">
              {pipeline.blocked}
            </span>
          </div>
        )}
      </div>

      <Separator orientation="vertical" className="hidden md:block h-4" />

      {/* Engines */}
      <div className="flex flex-wrap items-center gap-2">
        <HexagonLogoFrame px={12} />
        {engineList.length > 0 ? (
          engineList.map((e) => (
            <EngineIndicator
              key={e.id}
              name={e.name}
              kind={e.kind}
              enabled={e.enabled}
            />
          ))
        ) : (
          <span className="text-[10px] text-muted-foreground">
            {t('dashboard.systemHealth.noEngines')}
          </span>
        )}
      </div>

      <Separator orientation="vertical" className="hidden lg:block h-4" />

      {/* Today count */}
      <div className="flex items-center gap-1.5">
        <Activity className="h-3 w-3 text-cyan-500" />
        <span className="text-[10px] font-semibold text-muted-foreground">
          {t('dashboard.systemHealth.todayCount', { count: pipeline.todayCount })}
        </span>
      </div>

      {/* Attestations badge */}
      {engines.attestations > 0 && (
        <Badge
          variant="outline"
          className="text-[9px] h-4 px-1.5 font-mono border-border/30"
        >
          <Shield className="h-2.5 w-2.5 mr-0.5" />
          {t('dashboard.systemHealth.attestations', { count: engines.attestations })}
        </Badge>
      )}
    </div>
  );
}

export default memo(SystemHealthPulse);
