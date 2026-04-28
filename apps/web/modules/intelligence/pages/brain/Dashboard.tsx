import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import {
  Shield, Activity, Zap, CheckCircle2, AlertTriangle,
  Clock, XCircle, Search, TrendingUp, Server, Cloud,
  Sparkles, ArrowRight, Eye, Lock, Globe, Building,
  BookOpen, GraduationCap, ShieldCheck, Cpu, Settings2,
  ToggleLeft as _ToggleLeft, ToggleRight as _ToggleRight, Timer, RotateCcw, ChevronRight,
  X, Power, Gauge, Info,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import {
  BRAIN_LAYERS, getStatusConfig, getClassificationConfig,
  formatRelativeTime as _formatRelativeTime, extractProjectName, extractServiceLabel,
} from "@/lib/brain-utils";
import { fetchLayers, updateLayer, type LayerConfig } from "@/api/brain";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import { BrainCommandSignals } from "./BrainCommandSignals";

/* ── Data fetchers ── */
async function fetchPipelineStats() {
  const res = await fetch("/api/corevia/stats/pipeline");
  if (!res.ok) return null;
  return (await res.json()).stats;
}
async function fetchEngineStats() {
  const res = await fetch("/api/corevia/stats/engines");
  if (!res.ok) return null;
  return (await res.json()).stats;
}
async function fetchLearningStats() {
  const res = await fetch("/api/corevia/stats/learning");
  if (!res.ok) return null;
  return (await res.json()).stats;
}
async function fetchRecentDecisions() {
  const res = await fetch("/api/corevia/decisions?limit=8");
  if (!res.ok) return [];
  return ((await res.json()).decisions || []) as Array<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
async function fetchControlPlane() {
  const res = await fetch("/api/corevia/control-plane");
  if (!res.ok) return null;
  return (await res.json());
}

/* ── Main Dashboard ── */
export function Dashboard() {
  const { t } = useTranslation();
  const { data: pipelineStats } = useQuery({ queryKey: ["/brain/stats/pipeline"], queryFn: fetchPipelineStats, refetchInterval: 10000 });
  const { data: engineStats } = useQuery({ queryKey: ["/brain/stats/engines"], queryFn: fetchEngineStats, refetchInterval: 15000 });
  const { data: learningStats } = useQuery({ queryKey: ["/brain/stats/learning"], queryFn: fetchLearningStats, refetchInterval: 15000 });
  const { data: recentDecisions } = useQuery({ queryKey: ["/brain/decisions/recent"], queryFn: fetchRecentDecisions, refetchInterval: 8000 });
  const { data: controlPlane } = useQuery({ queryKey: ["/brain/control-plane"], queryFn: fetchControlPlane, refetchInterval: 10000 });
  const { data: layerData } = useQuery({ queryKey: ["/brain/layers"], queryFn: fetchLayers, refetchInterval: 10000 });

  const stats = pipelineStats || { total: 0, processing: 0, pending: 0, blocked: 0, completed: 0, needsInfo: 0, todayCount: 0, byClassification: {} };
  const engines = engineStats || {
    engines: [],
    attestations: 0,
    redactionReceipts: 0,
    boundary: {
      totalRuns: 0,
      internalRuns: 0,
      externalRuns: 0,
      internalPct: 0,
      externalPct: 0,
      maskedExternalRuns: 0,
      maskedExternalPct: 0,
      blockedAttempts: 0,
      blockedApprovalAttempts: 0,
      executionsWithoutApproval: 0,
    },
  };
  const learn = learningStats || { totalArtifacts: 0, draftCount: 0, activeCount: 0, activations: 0, policyCount: 0, policyVersionCount: 0 };
  const cp = controlPlane?.state || controlPlane || { intakeEnabled: true, policyMode: "enforce", agentThrottle: 100 };
  const layers: LayerConfig[] = layerData?.layers || [];

  const needsAttention = (recentDecisions || []).filter((d: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const s = (d.status || "").toLowerCase();
    return s === "needs_info" || s === "validation" || s === "pending_approval" || s === "blocked";
  });

  const [selectedLayer, setSelectedLayer] = useState<number | null>(null);

  const getDecisionHref = (decision: Record<string, any>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!decision?.serviceId) return `/brain-console/decisions/${decision.id}`;
    const useCaseType = encodeURIComponent(decision.serviceId);
    return `/brain-console/decisions/${decision.id}?useCaseType=${useCaseType}`;
  };

  return (
    <div className="space-y-6">
      {/* System Status Bar */}
      <div className="flex items-center gap-3 px-5 py-4 rounded-xl text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, #0891b2 0%, #2563eb 45%, #7c3aed 100%)" }}>
        <HexagonLogoFrame px={20} />
        <span className="font-semibold text-sm tracking-wide text-white">{t('brain.dashboard.corviaBrain')}</span>
        <Separator orientation="vertical" className="h-4 bg-white/30" />
        <div className="flex items-center gap-1.5 text-sm">
          <span className={`h-2 w-2 rounded-full ${cp.intakeEnabled ? "bg-emerald-300 animate-pulse" : "bg-red-300"}`} />
          <span className="text-white/90">{cp.intakeEnabled ? t('brain.dashboard.intakeActive') : t('brain.dashboard.intakePaused')}</span>
        </div>
        <Badge variant="outline" className="border-white/30 text-white text-[10px] font-mono">
          {cp.policyMode === "enforce" ? t('brain.dashboard.enforce') : t('brain.dashboard.monitor')}
        </Badge>
        <div className="ml-auto flex items-center gap-4 text-sm text-white/70">
          <span className="font-mono">{stats.todayCount} {t('brain.dashboard.today')}</span>
          <span className="font-mono">{engines.attestations} {t('brain.dashboard.attestations')}</span>
          <span className="font-mono">{engines.redactionReceipts} {t('brain.dashboard.redactionReceipts')}</span>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="h-auto rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <Activity className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="signals" className="gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            Command Signals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-6">
          {/* Pipeline Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard icon={Activity} label={t('brain.dashboard.totalDecisions')} value={stats.total} accent="blue" />
            <MetricCard icon={Cpu} label={t('brain.dashboard.processing')} value={stats.processing} accent="violet" pulse />
            <MetricCard icon={Clock} label={t('brain.dashboard.pendingApproval')} value={stats.pending} accent="orange" />
            <MetricCard icon={AlertTriangle} label={t('brain.dashboard.needsInfo')} value={stats.needsInfo} accent="yellow" />
            <MetricCard icon={XCircle} label={t('brain.dashboard.blocked')} value={stats.blocked} accent="red" />
            <MetricCard icon={CheckCircle2} label={t('brain.dashboard.completed')} value={stats.completed} accent="emerald" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Engine Status */}
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-violet-500" />
              {t('brain.dashboard.intelligenceFabric')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(engines.engines || []).map((e: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
              <EngineRow key={e.id} engine={e} />
            ))}
            {engines.engines?.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4">{t('brain.dashboard.noEngines')}</div>
            )}
            <Separator />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('brain.dashboard.redactionReceipts')}</span>
              <span className="font-mono font-semibold">{engines.redactionReceipts}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('brain.dashboard.runAttestations')}</span>
              <span className="font-mono font-semibold">{engines.attestations}</span>
            </div>

            <Separator />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 text-emerald-600" />
              <span className="font-medium text-foreground">{t('brain.dashboard.governanceEnforcement')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label={t('brain.dashboard.internalPct')} value={engines.boundary?.internalPct ?? 0} />
              <MiniStat label={t('brain.dashboard.externalPct')} value={engines.boundary?.externalPct ?? 0} />
              <MiniStat label={t('brain.dashboard.maskedExternalPct')} value={engines.boundary?.maskedExternalPct ?? 0} />
              <MiniStat label={t('brain.dashboard.blockedAttempts')} value={engines.boundary?.blockedAttempts ?? 0} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('brain.dashboard.executionsWithoutApproval')}</span>
              <span className={`font-mono font-semibold ${Number(engines.boundary?.executionsWithoutApproval || 0) > 0 ? "text-red-600" : ""}`}>
                {engines.boundary?.executionsWithoutApproval ?? 0}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Classification Distribution */}
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-500" />
              {t('brain.dashboard.dataClassification')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {Object.entries(stats.byClassification || {}).length > 0 ? (
              Object.entries(stats.byClassification).map(([cls, count]) => {
                const config = getClassificationConfig(cls)!;
                const pct = stats.total > 0 ? Math.round(((count as number) / stats.total) * 100) : 0;
                return (
                  <div key={cls} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <ClassificationIcon cls={cls} />
                        <span className="font-medium">{config.label}</span>
                      </span>
                      <span className="font-mono text-muted-foreground">{count as number} ({pct}%)</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-muted-foreground text-center py-6">{t('brain.dashboard.noClassified')}</div>
            )}
            <Separator className="my-2" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('brain.dashboard.governancePolicies')}</span>
              <span className="font-mono font-semibold">{learn.policyCount}</span>
            </div>
          </CardContent>
        </Card>

        {/* Learning Vault */}
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-teal-500" />
              {t('brain.dashboard.learningVault')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label={t('brain.dashboard.totalArtifacts')} value={learn.totalArtifacts} />
              <MiniStat label={t('brain.dashboard.draft')} value={learn.draftCount} />
              <MiniStat label={t('brain.dashboard.active')} value={learn.activeCount} />
              <MiniStat label={t('brain.dashboard.activations')} value={learn.activations} />
            </div>
            <Separator />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>{t('brain.dashboard.learningFromApproved')}</span>
            </div>
            <Link href="/brain-console/learning">
              <span className="text-xs text-blue-500 flex items-center gap-1 hover:underline cursor-pointer">
                {t('brain.dashboard.viewLearningVault')} <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </CardContent>
        </Card>
          </div>

          {/* ═══════════════ DECISION SPINE™ ═══════════════ */}
          <Card className="border-slate-200 dark:border-slate-700 overflow-hidden">
        <CardHeader className="pb-2" style={{ background: "linear-gradient(135deg, rgba(34,211,238,0.06), rgba(59,130,246,0.06), rgba(139,92,246,0.06))" }}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-500" />
                {t('brain.dashboard.decisionOrchestration')}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('brain.dashboard.decisionSpineDescription')}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono border-indigo-300 text-indigo-600">
              {layers.filter(l => l.enabled).length}/{layers.length} ACTIVE
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Spine visualization — interactive */}
          <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
            {BRAIN_LAYERS.filter(l => l.id >= 1 && l.id <= 8).map((layer, idx) => {
              const cfg = layers.find(lc => lc.id === layer.id);
              const isEnabled = cfg?.enabled ?? true;
              const isSelected = selectedLayer === layer.id;
              const colorMap: Record<string, string> = {
                blue: "from-blue-500 to-blue-600",
                purple: "from-purple-500 to-purple-600",
                amber: "from-amber-500 to-amber-600",
                cyan: "from-cyan-500 to-cyan-600",
                indigo: "from-indigo-500 to-indigo-600",
                violet: "from-violet-500 to-violet-600",
                orange: "from-orange-500 to-orange-600",
                emerald: "from-emerald-500 to-emerald-600",
              };
              const gradient = colorMap[layer.color] || "from-slate-500 to-slate-600";
              const modeLabel = cfg?.mode === "bypass" ? "BYP" : cfg?.mode === "monitor" ? "MON" : "";

              return (
                <div key={layer.id} className="flex items-center">
                  <button
                    onClick={() => setSelectedLayer(isSelected ? null : layer.id)}
                    className={`flex flex-col items-center min-w-[110px] p-2 rounded-xl transition-all group cursor-pointer ${
                      isSelected
                        ? "bg-slate-100 dark:bg-slate-800 ring-2 ring-indigo-400 ring-offset-1"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md transition-all ${
                        isEnabled ? `bg-gradient-to-br ${gradient}` : "bg-slate-300 dark:bg-slate-600"
                      } ${isSelected ? "scale-110 shadow-lg" : "group-hover:scale-105"}`}>
                        {layer.short}
                      </div>
                      {/* Status indicators */}
                      {!isEnabled && (
                        <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
                          <Power className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                      {isEnabled && modeLabel && (
                        <div className={`absolute -top-1 -right-1 h-4 w-auto px-1 rounded-full text-[8px] font-bold flex items-center justify-center ${
                          cfg?.mode === "monitor" ? "bg-amber-400 text-amber-900" : "bg-slate-400 text-white"
                        }`}>
                          {modeLabel}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-center text-muted-foreground mt-1.5 leading-tight max-w-[100px] font-medium group-hover:text-foreground transition-colors">
                      {layer.name}
                    </span>
                    {/* Config gear indicator */}
                    <Settings2 className={`h-3 w-3 mt-1 transition-all ${
                      isSelected ? "text-indigo-500 opacity-100" : "text-slate-300 opacity-0 group-hover:opacity-100"
                    }`} />
                  </button>
                  {idx < 7 && (
                    <div className="flex items-center gap-[3px] mx-1 spine-pulse-container">
                      <div className="spine-dot" style={{ animationDelay: `${idx * 0.15}s` }} />
                      <div className="spine-dot" style={{ animationDelay: `${idx * 0.15 + 0.2}s` }} />
                      <div className="spine-dot" style={{ animationDelay: `${idx * 0.15 + 0.4}s` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Layer legend */}
          <div className="mt-3 flex items-center gap-5 text-[10px] text-muted-foreground border-t pt-2">
            <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-400" /> {t('brain.dashboard.l3CanBlock')}</span>
            <span className="flex items-center gap-1"><Search className="h-3 w-3 text-yellow-400" /> {t('brain.dashboard.l4NeedsInfo')}</span>
            <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-orange-400" /> {t('brain.dashboard.l7ApprovalId')}</span>
            <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-purple-400" /> {t('brain.dashboard.clickToConfigure')}</span>
          </div>

          {/* ── Layer Configuration Panel (slides open) ── */}
          {selectedLayer !== null && (
            <LayerConfigPanel
              key={selectedLayer}
              layerId={selectedLayer}
              layers={layers}
              onClose={() => setSelectedLayer(null)}
            />
          )}
        </CardContent>
          </Card>

          {/* Needs Attention + Recent Decisions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className={needsAttention.length > 0 ? "border-orange-200/60" : "border-slate-200 dark:border-slate-700"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              {t('brain.dashboard.needsAttention')}
              {needsAttention.length > 0 && (
                <Badge variant="destructive" className="text-[10px] h-5">{needsAttention.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {needsAttention.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-300" />
                {t('brain.dashboard.allClear')}
              </div>
            ) : (
              <div className="space-y-1.5">
                {needsAttention.slice(0, 5).map((d: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                  const statusCfg = getStatusConfig(d.status)!;
                  return (
                    <Link key={d.id} href={getDecisionHref(d)}>
                      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50/50 dark:hover:bg-slate-800 cursor-pointer transition-colors border border-transparent hover:border-orange-200/50">
                        <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${statusCfg.dotClass}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{extractProjectName(d)}</p>
                          <p className="text-xs text-muted-foreground">{extractServiceLabel(d)}</p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${statusCfg.bgClass}`}>
                          {statusCfg.label}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              {t('brain.dashboard.recentDecisions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(recentDecisions || []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                {t('brain.dashboard.noDecisions')}
              </div>
            ) : (
              <div className="space-y-1.5">
                {(recentDecisions || []).slice(0, 6).map((d: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                  const statusCfg = getStatusConfig(d.status)!;
                  const clsConfig = getClassificationConfig(d.classification)!;
                  return (
                    <Link key={d.id} href={getDecisionHref(d)}>
                      <div className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors group">
                        <span className={`h-2.5 w-2.5 rounded-full ${statusCfg.dotClass}`} />
                        <p className="text-sm font-medium flex-1 truncate group-hover:text-blue-600 transition-colors">{extractProjectName(d)}</p>
                        <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${clsConfig.bgClass}`}>
                          {clsConfig.label}
                        </Badge>
                        <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${statusCfg.bgClass}`}>
                          {statusCfg.label}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            <Link href="/brain-console/decisions">
              <span className="text-xs text-blue-500 flex items-center gap-1 mt-3 hover:underline cursor-pointer">
                {t('brain.dashboard.viewAllDecisions')} <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </CardContent>
        </Card>
          </div>
        </TabsContent>

        <TabsContent value="signals" className="mt-0">
          <BrainCommandSignals
            stats={stats}
            engines={engines}
            learning={learn}
            recentDecisions={recentDecisions || []}
            layers={layers}
            controlPlane={cp}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════════
   LAYER CONFIG PANEL — Full power configuration
   ═══════════════════════════════════════════ */
function LayerConfigPanel({
  layerId,
  layers,
  onClose,
}: {
  layerId: number;
  layers: LayerConfig[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const layer = layers.find(l => l.id === layerId);
  const brainLayer = BRAIN_LAYERS.find(l => l.id === layerId);

  const [localEnabled, setLocalEnabled] = useState(layer?.enabled ?? true);
  const [localMode, setLocalMode] = useState<string>(layer?.mode || "enforce");
  const [localTimeout, setLocalTimeout] = useState(layer?.timeoutMs ?? 30000);
  const [localRetries, setLocalRetries] = useState(layer?.retries ?? 1);
  const [localSla, setLocalSla] = useState(layer?.slaMs ?? layer?.timeoutMs ?? 30000);
  const [localApprovalRequired, setLocalApprovalRequired] = useState(layer?.approvalRequired ?? false);
  const [localApprovalRoles, setLocalApprovalRoles] = useState((layer?.approvalRoles || []).join(", "));
  const [dirty, setDirty] = useState(false);

  const mutation = useMutation({
    mutationFn: () => updateLayer(layerId, {
      enabled: localEnabled,
      mode: localMode as "enforce" | "monitor" | "bypass",
      timeoutMs: localTimeout,
      retries: localRetries,
      slaMs: localSla,
      approvalRequired: localApprovalRequired,
      approvalRoles: localApprovalRoles
        .split(",")
        .map(r => r.trim())
        .filter(Boolean),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/brain/layers"] });
      queryClient.invalidateQueries({ queryKey: ["/brain/control-plane"] });
      setDirty(false);
      toast({ title: t('brain.dashboard.layerSaved', { layerId }) });
    },
    onError: () => {
      toast({ title: t('brain.dashboard.layerSaveFailed'), variant: "destructive" });
    },
  });

  if (!layer || !brainLayer) return null;

  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    purple: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    cyan: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
    violet: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
    orange: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    teal: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  };
  const c = (colorMap[brainLayer.color] || colorMap.blue)!;

  function handleChange<T>(setter: (v: T) => void, value: T) {
    setter(value);
    setDirty(true);
  }

  return (
    <div className={`mt-4 rounded-xl border-2 ${c.border} ${c.bg} p-5 relative animate-in slide-in-from-top-2 duration-200`}>
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-black/5 transition-colors"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 mb-5">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-md bg-gradient-to-br ${
          brainLayer.color === "blue" ? "from-blue-500 to-blue-600" :
          brainLayer.color === "purple" ? "from-purple-500 to-purple-600" :
          brainLayer.color === "amber" ? "from-amber-500 to-amber-600" :
          brainLayer.color === "cyan" ? "from-cyan-500 to-cyan-600" :
          brainLayer.color === "indigo" ? "from-indigo-500 to-indigo-600" :
          brainLayer.color === "violet" ? "from-violet-500 to-violet-600" :
          brainLayer.color === "orange" ? "from-orange-500 to-orange-600" :
          brainLayer.color === "teal" ? "from-teal-500 to-teal-600" :
          "from-slate-500 to-slate-600"
        }`}>
          {brainLayer.short}
        </div>
        <div className="flex-1">
          <h3 className={`text-lg font-bold ${c.text}`}>{layer.name}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{layer.description}</p>
        </div>
        <Badge variant="outline" className={`${c.text} ${c.border} text-xs`}>
          Layer {layerId} of 8
        </Badge>
      </div>

      {/* Configuration grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Power toggle */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <Power className="h-3 w-3" /> {t('brain.dashboard.status')}
          </Label>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border">
            <Switch
              checked={localEnabled}
              onCheckedChange={(v) => handleChange(setLocalEnabled, v)}
            />
            <span className={`text-sm font-semibold ${localEnabled ? "text-emerald-600" : "text-red-500"}`}>
              {localEnabled ? t('brain.dashboard.enabled') : t('brain.dashboard.disabled')}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {layerId === 8 ? "Disabling skips memory and post-approval execution" : "Disabling stops the production pipeline at this layer"}
          </p>
        </div>

        {/* Mode select */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <Gauge className="h-3 w-3" /> {t('brain.dashboard.mode')}
          </Label>
          <Select value={localMode} onValueChange={(v) => handleChange(setLocalMode, v)}>
            <SelectTrigger className="bg-white dark:bg-slate-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="enforce">
                <span className="flex items-center gap-2">
                  <Shield className="h-3 w-3 text-emerald-500" /> {t('brain.dashboard.enforce')}
                </span>
              </SelectItem>
              <SelectItem value="monitor">
                <span className="flex items-center gap-2">
                  <Eye className="h-3 w-3 text-amber-500" /> {t('brain.dashboard.monitor')}
                </span>
              </SelectItem>
              <SelectItem value="bypass">
                <span className="flex items-center gap-2">
                  <ChevronRight className="h-3 w-3 text-slate-400" /> {t('brain.dashboard.bypass')}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            {localMode === "enforce" ? "Layer actively enforces rules" :
             localMode === "monitor" ? "Layer logs but doesn't block" :
             layerId === 8 ? "Layer 8 is skipped" : "Pipeline stops before this layer in production"}
          </p>
        </div>

        {/* Timeout */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <Timer className="h-3 w-3" /> {t('brain.dashboard.timeout')}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              step={1000}
              value={localTimeout}
              onChange={(e) => handleChange(setLocalTimeout, parseInt(e.target.value) || 0)}
              className="bg-white dark:bg-slate-800 font-mono text-sm"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">ms</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {localTimeout === 0 ? "No timeout (waits indefinitely)" : `${(localTimeout / 1000).toFixed(1)}s max wait`}
          </p>
        </div>

        {/* Retries */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <RotateCcw className="h-3 w-3" /> {t('brain.dashboard.retries')}
          </Label>
          <Input
            type="number"
            min={0}
            max={10}
            value={localRetries}
            onChange={(e) => handleChange(setLocalRetries, Math.min(10, parseInt(e.target.value) || 0))}
            className="bg-white dark:bg-slate-800 font-mono text-sm"
          />
          <p className="text-[10px] text-muted-foreground">
            {localRetries === 0 ? "No retries on failure" : `${localRetries} automatic ${localRetries === 1 ? "retry" : "retries"}`}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* SLA */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <Timer className="h-3 w-3" /> {t('brain.dashboard.slaTarget')}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              step={1000}
              value={localSla}
              onChange={(e) => handleChange(setLocalSla, parseInt(e.target.value) || 0)}
              className="bg-white dark:bg-slate-800 font-mono text-sm"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">ms</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {localSla === 0 ? "No SLA target" : `${(localSla / 1000).toFixed(1)}s target`}
          </p>
        </div>

        {/* Approval */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="h-3 w-3" /> {t('brain.dashboard.approval')}
          </Label>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border">
            <Switch
              checked={localApprovalRequired}
              onCheckedChange={(v) => handleChange(setLocalApprovalRequired, v)}
            />
            <span className="text-sm font-semibold">
              {localApprovalRequired ? t('brain.dashboard.required') : t('brain.dashboard.notRequired')}
            </span>
          </div>
          <Input
            value={localApprovalRoles}
            onChange={(e) => handleChange(setLocalApprovalRoles, e.target.value)}
            placeholder="director, manager"
            className="bg-white dark:bg-slate-800 font-mono text-sm"
          />
          <p className="text-[10px] text-muted-foreground">Comma-separated roles allowed to approve</p>
        </div>
      </div>

      {/* Layer-specific info callout */}
      <div className="mt-4 flex items-start gap-2.5 p-3 rounded-lg bg-white/60 dark:bg-slate-800/40 border text-xs">
        <Info className={`h-4 w-4 flex-shrink-0 mt-0.5 ${c.text}`} />
        <div className="text-muted-foreground">
          {layerId === 1 && "L1 validates and normalizes incoming demand payloads. Canonicalization extracts project names, service IDs, and attachments."}
          {layerId === 2 && "L2 auto-classifies data sensitivity. SOVEREIGN data never leaves on-prem. Classification determines which engine processes the request."}
          {layerId === 3 && "L3 is the Friction Layer — evaluates all active policy packs. Can BLOCK requests that violate governance rules before any AI processing occurs."}
          {layerId === 4 && "L4 checks context readiness. Missing fields trigger NEEDS_INFO status, pausing the pipeline until the requester provides additional data."}
          {layerId === 5 && "L5 routes to the correct engine: Engine A (Sovereign Internal) for sensitive data, Engine B (External Hybrid) for general, Engine C (Distillation) for learning."}
          {layerId === 6 && "L6 executes governed AI analysis. All external calls go through the Redaction Gateway. Every run produces an attestation receipt."}
          {layerId === 7 && "L7 is the Human-in-the-Loop gate. Creates ApprovalID tokens for authorized signatories. No action executes without human authorization."}
          {layerId === 8 && "L8 records decision memory, learning signals, and authorized post-approval actions. Every action is idempotent and fully audit-recorded."}
        </div>
      </div>

      {/* Save button */}
      {dirty && (
        <div className="mt-4 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLocalEnabled(layer.enabled);
              setLocalMode(layer.mode);
              setLocalTimeout(layer.timeoutMs);
              setLocalRetries(layer.retries);
              setLocalSla(layer.slaMs ?? layer.timeoutMs);
              setLocalApprovalRequired(layer.approvalRequired ?? false);
              setLocalApprovalRoles((layer.approvalRoles || []).join(", "));
              setDirty(false);
            }}
          >
            {t('brain.dashboard.reset')}
          </Button>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            style={{ background: "linear-gradient(135deg, #22d3ee, #3b82f6, #8b5cf6)" }}
            className="text-white border-0"
          >
            {mutation.isPending ? t('brain.dashboard.saving') : t('brain.dashboard.saveConfiguration')}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════
   SUB COMPONENTS
   ═══════════════════════════ */

function MetricCard({ icon: Icon, label, value, accent, pulse }: {
  icon: LucideIcon; label: string; value: number; accent: string; pulse?: boolean;
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-500" },
    violet: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-500" },
    orange: { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-500" },
    yellow: { bg: "bg-yellow-50 dark:bg-yellow-950/30", text: "text-yellow-500" },
    red: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-500" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-500" },
  };
  const c = (colorMap[accent] || colorMap.blue)!;
  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-md ${c.bg}`}>
            <Icon className={`h-5 w-5 ${c.text}`} />
          </div>
          <div>
            <p className={`text-2xl font-bold font-mono ${pulse && value > 0 ? "text-violet-600" : ""}`}>{value}</p>
            <p className="text-xs text-muted-foreground leading-tight">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
      <p className="text-xl font-bold font-mono">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function EngineRow({ engine }: { engine: { kind?: string; name?: string; enabled?: boolean } }) {
  const cfg: Record<string, { icon: LucideIcon; color: string; short: string }> = {
    SOVEREIGN_INTERNAL: { icon: Server, color: "text-emerald-500", short: "A" },
    EXTERNAL_HYBRID: { icon: Cloud, color: "text-blue-500", short: "B" },
    DISTILLATION: { icon: Sparkles, color: "text-purple-500", short: "C" },
  };
  const ec = (cfg[engine.kind || ""] || cfg.SOVEREIGN_INTERNAL)!;
  const Icon = ec.icon;
  return (
    <div className="flex items-center gap-2.5">
      <Icon className={`h-5 w-5 ${ec.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{engine.name}</p>
        <p className="text-xs text-muted-foreground">Engine {ec.short}</p>
      </div>
      <span className={`h-2 w-2 rounded-full ${engine.enabled ? "bg-green-400" : "bg-red-400"}`} />
    </div>
  );
}

function ClassificationIcon({ cls }: { cls: string }) {
  const upper = (cls || "").toUpperCase();
  if (upper === "PUBLIC") return <Globe className="h-3 w-3 text-green-500" />;
  if (upper === "INTERNAL") return <Building className="h-3 w-3 text-blue-500" />;
  if (upper === "CONFIDENTIAL") return <Lock className="h-3 w-3 text-amber-500" />;
  if (upper === "SOVEREIGN") return <Shield className="h-3 w-3 text-red-500" />;
  return <Shield className="h-3 w-3 text-rose-500" />;
}
