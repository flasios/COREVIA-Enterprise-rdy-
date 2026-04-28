import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Server, Cloud, Sparkles, Shield, CheckCircle2, AlertTriangle,
  Activity, Lock, Eye, Zap, X,
  RefreshCw, ShieldCheck, Power, Settings2,
  Plus, ChevronRight, Cpu, Network, Gauge, TrendingUp,
  FileJson, CircleDot, Layers, Info, GraduationCap, Play, Square,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import {
  fetchEngineHealth, fetchEngines, registerEngine, testEngine, updateEngine as patchEngine,
  fetchEngineModels,
  fetchEngineRuntime, startEngineRuntime, stopEngineRuntime,
  fetchEngineAttestations, fetchRoutingOverrides,
  fetchLayers, updateLayer, fetchAgents, fetchEngineRoutingTable,
  type EngineHealthResponse, type EngineModelsResponse, type EnginePlugin, type EngineRuntimeStateResponse, type EngineTestResponse, type LayerConfig,
} from "@/api/brain";
import type { Agent } from "@shared/contracts/brain";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AgentToggleRow, RoutingOverridesPanel, type RoutingOverride } from "./IntelligenceRoutingPanels";

/* ── inline stats fetchers ── */
async function fetchEngineStats() {
  const res = await fetch("/api/corevia/stats/engines");
  if (!res.ok) return null;
  return (await res.json()).stats;
}
async function fetchPipelineStats() {
  const res = await fetch("/api/corevia/stats/pipeline");
  if (!res.ok) return null;
  return (await res.json()).stats;
}

/* ── Engine metadata ── */
const ENGINE_KIND_META: Record<string, {
  icon: LucideIcon;
  label: string;
  short: string;
  description: string;
  dataFlow: string[];
  color?: string;
}> = {
  SOVEREIGN_INTERNAL: {
    icon: Server,
    label: "Sovereign Internal", short: "Engine A",
    description: "On-premises LLM. All data stays within sovereign boundary. No redaction required. Handles SOVEREIGN & HIGH_SENSITIVE.",
    dataFlow: ["Request enters L5 Router", "Classification Gate", "Local LLM Inference", "Attestation Receipt", "Advisory Output"],
  },
  EXTERNAL_HYBRID: {
    icon: Cloud,
    label: "External Hybrid", short: "Engine B",
    description: "External LLM with mandatory redaction. Data passes through Redaction Gateway before leaving the sovereign boundary.",
    dataFlow: ["Request enters L5 Router", "Classification Gate", "Redaction Gateway", "External LLM Call", "Token Rehydration", "Attestation + Receipt"],
  },
  DISTILLATION: {
    icon: Sparkles,
    label: "Distillation", short: "Engine C",
    description: "LLM-powered distillation engine. Converts approved decisions into learning artifacts, training data for Engine A fine-tuning, and cross-decision correlations.",
    dataFlow: ["Approved Decision + Ledger", "Ledger Reader", "LLM Semantic Extraction (Engine A)", "Pattern + Training Generator", "Asset Generator", "Activation Controller (Approval)"],
  },
};

const DEFAULT_ENGINE_META = { icon: Server, label: "Unknown", short: "?", description: "", dataFlow: [] as string[] };

const CLASSIFICATION_LEVELS = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "SOVEREIGN", "HIGH_SENSITIVE"] as const;

const CAPABILITIES = [
  { key: "generateBusinessCase", label: "Business Case" },
  { key: "generateRequirements", label: "Requirements" },
  { key: "generateStrategicFit", label: "Strategic Fit" },
  { key: "generateWBS", label: "WBS" },
  { key: "summarize", label: "Summarize" },
  { key: "score", label: "Scoring" },
];

function getEnginePriority(engine: EnginePlugin): number {
  const priority = Number(engine.config?.priority);
  return Number.isFinite(priority) ? priority : 100;
}

function getPrimarySovereignEngineId(engines: EnginePlugin[]): string | null {
  const ordered = engines
    .filter((engine) => engine.kind === "SOVEREIGN_INTERNAL" && engine.enabled)
    .sort((left, right) => getEnginePriority(left) - getEnginePriority(right) || left.name.localeCompare(right.name));

  return ordered[0]?.enginePluginId || null;
}

function getConfigString(config: Record<string, unknown> | undefined, key: string): string {
  return typeof config?.[key] === "string" ? String(config[key]) : "";
}

function mergeConfiguredAndDiscoveredModels(
  runtimeModels: Array<{ name: string }> | undefined,
  engines: Array<Pick<EnginePlugin, "config">>,
): Array<{ name: string }> {
  const seen = new Set<string>();
  const merged: Array<{ name: string }> = [];

  for (const candidate of runtimeModels ?? []) {
    const name = candidate.name.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    merged.push({ name });
  }

  for (const engine of engines) {
    const modelNames = [
      getConfigString(engine.config, "model"),
      getConfigString(engine.config, "fastModel"),
    ];

    for (const modelName of modelNames) {
      const name = modelName.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      merged.push({ name });
    }
  }

  return merged.sort((left, right) => left.name.localeCompare(right.name));
}

function toInputValue(v: unknown): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  return "";
}

function getModelPlaceholder(isPending: boolean, modelCount: number, defaultText: string): string {
  if (isPending) return "Loading...";
  if (modelCount === 0) return "No models found";
  return defaultText;
}

function getRuntimePlaceholder(isPending: boolean, isUnreachable: boolean, defaultText: string): string {
  if (isPending) return "Loading runtime models...";
  if (isUnreachable) return "Runtime unreachable";
  return defaultText;
}

function getHealthStatusLabel(result: { configured?: boolean; health?: { ok?: boolean; status?: string } } | null): string {
  if (result?.configured === false) return "UNCONFIGURED";
  if (result?.health?.ok) return "HEALTHY";
  if (result) return String(result.health?.status || "UNAVAILABLE").toUpperCase();
  return "NOT RUN";
}

function getHealthDescription(result: { configured?: boolean; health?: { ok?: boolean; error?: string } } | null): string {
  if (result?.configured === false) return "This engine is registered, but no local runtime endpoint is saved yet.";
  if (result?.health?.error) return String(result.health.error);
  if (result?.health?.ok) return "The workspace can reach the local model runtime.";
  if (result) return "The workspace could not reach the configured local runtime.";
  return "Run a health check to verify connectivity.";
}

function getRuntimeStatusLabel(runtime: { healthy?: boolean } | null): string {
  if (runtime?.healthy) return "HEALTHY";
  if (runtime) return "STOPPED / WARMING";
  return "UNKNOWN";
}

function getRuntimeDescription(runtime: { manageable?: boolean; reason?: string; healthy?: boolean } | null): string {
  if (runtime?.manageable === false) return runtime.reason || "Runtime control is unavailable in this environment.";
  if (runtime?.healthy) return "The local Docker runtime is reachable and ready for Engine A traffic.";
  return "The local Docker runtime is currently stopped or still warming up.";
}

function getModelSelectorPlaceholder(isPending: boolean, configured?: boolean, reachable?: boolean): string {
  if (isPending) return "Loading runtime models...";
  if (configured === false) return "Save endpoint to discover models";
  if (reachable === false) return "Runtime unreachable";
  return "Select installed local model";
}

function getModelDiscoveryStatus(modelCount: number, isUnreachable: boolean): string {
  if (modelCount > 0) return "";
  if (isUnreachable) return "The local runtime is registered but not reachable, so installed models could not be read.";
  return "Use Load models to discover installed tags from the local runtime, or type a custom model tag below.";
}

function getTestStatusLabel(result: { parsed?: unknown; text?: string | null } | null): string {
  if (result?.parsed) return "PARSED";
  if (result?.text) return "TEXT";
  return "NOT RUN";
}

/* ══════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════ */
export function Intelligence() {
  const { t } = useTranslation();
  const { data: enginesData } = useQuery({ queryKey: ["/brain/engines"], queryFn: fetchEngines, refetchInterval: 10000 });
  const { data: statsData } = useQuery({ queryKey: ["/brain/stats/engines"], queryFn: fetchEngineStats, refetchInterval: 12000 });
  const { data: pipelineData } = useQuery({ queryKey: ["/brain/stats/pipeline-intel"], queryFn: fetchPipelineStats, refetchInterval: 15000 });
  const { data: overridesData } = useQuery({ queryKey: ["/brain/routing-overrides"], queryFn: fetchRoutingOverrides, refetchInterval: 10000 });
  const { data: layersData } = useQuery({ queryKey: ["/brain/layers"], queryFn: fetchLayers, refetchInterval: 10000 });
  const { data: agentsData } = useQuery({ queryKey: ["/brain/agents"], queryFn: fetchAgents, refetchInterval: 15000 });
  const {
    data: routingTableData,
    isError: routingTableIsError,
    error: routingTableError,
  } = useQuery({ queryKey: ["/brain/engines/routing-table"], queryFn: fetchEngineRoutingTable, refetchInterval: 30000 });

  const engines: EnginePlugin[] = useMemo(() => enginesData?.engines || [], [enginesData]);
  const stats = useMemo(() => statsData || { engines: [], attestations: 0, redactionReceipts: 0 }, [statsData]);
  const pipeline = pipelineData || { total: 0, byClassification: {} };
  const overrides = (overridesData?.overrides || []) as RoutingOverride[];
  const _layers: LayerConfig[] = layersData?.layers || [];
  const _agents = agentsData?.agents || [];
  const routingTable = routingTableData?.table || {};

  const [selectedEngine, setSelectedEngine] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  const byKind: Record<string, EnginePlugin[]> = { SOVEREIGN_INTERNAL: [], EXTERNAL_HYBRID: [], DISTILLATION: [] };
  engines.forEach(e => { const arr = byKind[e.kind]; if (arr) arr.push(e); });
  const primarySovereignEngineId = useMemo(() => getPrimarySovereignEngineId(engines), [engines]);

  const engineStatsById = useMemo(() => {
    const map = new Map<string, { totalRuns: number; lastUsed: string | null }>();
    for (const e of (stats?.engines || [])) {
      if (!e?.id) continue;
      map.set(String(e.id), {
        totalRuns: Number(e.totalRuns || 0),
        lastUsed: e.lastUsed ? String(e.lastUsed) : null,
      });
    }
    return map;
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-primary text-primary-foreground">
              <Zap className="h-5 w-5" />
            </div>
            {t('brain.intelligence.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('brain.intelligence.description')}
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowRegister((v) => !v)}>
          <Plus className="h-4 w-4" /> {showRegister ? t('brain.intelligence.hide') : t('brain.intelligence.registerEngine')}
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatPill icon={Cpu} label={t('brain.intelligence.stats.engines')} value={engines.length} accent="cyan" />
        <StatPill icon={Power} label={t('brain.intelligence.stats.online')} value={engines.filter(e => e.enabled).length} accent="emerald" />
        <StatPill icon={ShieldCheck} label={t('brain.intelligence.stats.attestations')} value={stats.attestations} accent="blue" />
        <StatPill icon={Eye} label={t('brain.intelligence.stats.redactionReceipts')} value={stats.redactionReceipts} accent="amber" />
        <StatPill icon={Activity} label={t('brain.intelligence.stats.totalDecisions')} value={pipeline.total} accent="violet" />
      </div>

      {/* Engines (A/B/C) */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            {t('brain.intelligence.engines')}
            <Badge variant="outline" className="text-[10px] ml-auto font-mono">{engines.length} {t('brain.intelligence.registered')}</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t('brain.intelligence.enginesDescription')}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(["SOVEREIGN_INTERNAL", "EXTERNAL_HYBRID", "DISTILLATION"] as const).map((kind) => {
              const meta = ENGINE_KIND_META[kind];
              if (!meta) return null;
              const Icon = meta.icon;
              const instances = byKind[kind] || [];
              const enabledCount = instances.filter((e) => e.enabled).length;
              const totalRuns = instances.reduce((sum, e) => sum + (engineStatsById.get(e.enginePluginId)?.totalRuns || 0), 0);
              const lastUsed = instances
                .map((e) => engineStatsById.get(e.enginePluginId)?.lastUsed)
                .filter(Boolean)
                .sort((a, b) => (a ?? "").localeCompare(b ?? ""))
                .at(-1);

              return (
                <Card key={kind} className="border-slate-200 dark:border-slate-800">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{meta.short}</p>
                          <p className="text-[11px] text-muted-foreground">{meta.label}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {enabledCount}/{instances.length} online
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{meta.description}</p>
                    <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                      <div>
                        <p className="text-muted-foreground">{t('brain.intelligence.instances')}</p>
                        <p className="font-mono font-semibold">{instances.length}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t('brain.intelligence.runs')}</p>
                        <p className="font-mono font-semibold">{totalRuns}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t('brain.intelligence.lastUsed')}</p>
                        <p className="font-mono font-semibold truncate">{lastUsed ? new Date(lastUsed).toLocaleDateString() : "—"}</p>
                      </div>
                    </div>
                    {kind === "SOVEREIGN_INTERNAL" && instances.length > 0 && (
                      <SovereignCardModelBadge
                        instances={instances}
                        primaryId={primarySovereignEngineId}
                      />
                    )}
                    {kind === "EXTERNAL_HYBRID" && instances.length > 0 && (
                      <ExternalCardModelBadge instances={instances} />
                    )}
                    {kind === "DISTILLATION" && (
                      <DistillationCardDashboard />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {showRegister && (
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Plus className="h-4 w-4 text-muted-foreground" /> {t('brain.intelligence.registerEngine')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RegisterEngineInline onDone={() => setShowRegister(false)} />
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Routing Table */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            {t('brain.intelligence.routingTable')}
            <Badge variant="outline" className="text-[10px] ml-auto font-mono">{t('brain.intelligence.deterministic')}</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t('brain.intelligence.routingTableDescription')}</p>
        </CardHeader>
        <CardContent>
          {routingTableIsError && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20 p-3 text-xs">
              <p className="font-semibold">{t('brain.intelligence.routingTableApiError')}</p>
              <p className="text-muted-foreground mt-0.5">
                This table comes from <span className="font-mono">GET /api/corevia/engines/routing-table</span>. If it’s empty, your server may not be running or the session is logged out.
              </p>
              <p className="text-muted-foreground mt-1 font-mono truncate">
                {String((routingTableError as { message?: string })?.message || routingTableError || "Unknown error")}
              </p>
            </div>
          )}
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('brain.intelligence.classification')}</th>
                  <th className="text-left py-2 pr-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('brain.intelligence.primary')}</th>
                  <th className="text-left py-2 pr-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('brain.intelligence.fallback')}</th>
                  <th className="text-left py-2 pr-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('brain.intelligence.redaction')}</th>
                  <th className="text-left py-2 pr-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('brain.intelligence.hitl')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(routingTable).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      {t('brain.intelligence.routingTableUnavailable')}
                    </td>
                  </tr>
                ) : (
                  Object.entries(routingTable).map(([cls, row]) => (
                    <tr key={cls} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 font-mono text-[12px]">{cls}</td>
                      <td className="py-2 pr-3"><Badge variant="secondary" className="text-[10px] font-mono">{(row as { primary: string; fallback: string | null; redaction: boolean; hitl: boolean }).primary}</Badge></td>
                      <td className="py-2 pr-3"><Badge variant="outline" className="text-[10px] font-mono">{(row as { primary: string; fallback: string | null; redaction: boolean; hitl: boolean }).fallback || "—"}</Badge></td>
                      <td className="py-2 pr-3"><Badge variant="outline" className="text-[10px] font-mono">{(row as { primary: string; fallback: string | null; redaction: boolean; hitl: boolean }).redaction ? "YES" : "NO"}</Badge></td>
                      <td className="py-2 pr-3"><Badge variant="outline" className="text-[10px] font-mono">{(row as { primary: string; fallback: string | null; redaction: boolean; hitl: boolean }).hitl ? "YES" : "NO"}</Badge></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Engine Registry Table */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            {t('brain.intelligence.engineRegistry')}
            <Badge variant="outline" className="text-[10px] ml-auto font-mono">{engines.length} {t('brain.intelligence.registered')}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {engines.length === 0 ? (
            <div className="text-center py-12">
              <Cpu className="h-12 w-12 mx-auto text-slate-200 dark:text-slate-700 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">{t('brain.intelligence.noEngines')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('brain.intelligence.noEnginesHint')}</p>
              <Button size="sm" className="mt-4 gap-1.5" variant="outline" onClick={() => setShowRegister(true)}>
                <Plus className="h-3.5 w-3.5" /> {t('brain.intelligence.registerEngine')}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {engines.map(engine => {
                const meta = ENGINE_KIND_META[engine.kind] ?? DEFAULT_ENGINE_META;
                const Icon = meta.icon;
                const isSelected = selectedEngine === engine.enginePluginId;
                const caps = engine.capabilities || {};
                const activeCaps = Object.entries(caps).filter(([, v]) => v).length;
                const isPrimarySovereign = engine.kind === "SOVEREIGN_INTERNAL" && engine.enginePluginId === primarySovereignEngineId;
                const priority = getEnginePriority(engine);
                const configuredModel = getConfigString(engine.config, "model");
                const configuredFastModel = getConfigString(engine.config, "fastModel");

                return (
                  <div key={engine.enginePluginId} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <button
                      onClick={() => setSelectedEngine(isSelected ? null : engine.enginePluginId)}
                      className={`w-full flex items-center gap-4 p-4 text-left transition-colors ${
                        isSelected
                          ? "bg-slate-50 dark:bg-slate-900/40"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-muted">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{engine.name}</span>
                          <Badge variant="outline" className="text-[9px] h-4">{meta.short}</Badge>
                          <Badge variant="outline" className="text-[9px] h-4 font-mono">v{engine.version}</Badge>
                          <Badge variant="outline" className="text-[9px] h-4 font-mono">P{priority}</Badge>
                          {configuredModel && (
                            <Badge variant="outline" className="text-[9px] h-4 font-mono">Model: {configuredModel}</Badge>
                          )}
                          {configuredFastModel && (
                            <Badge variant="outline" className="text-[9px] h-4 font-mono">Fast: {configuredFastModel}</Badge>
                          )}
                          {isPrimarySovereign && (
                            <Badge variant="secondary" className="text-[9px] h-4">Primary offline</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="font-mono text-[10px]">{engine.enginePluginId}</span>
                          <span>·</span>
                          <span>Max: {engine.allowedMaxClass}</span>
                          <span>·</span>
                          <span>{activeCaps} {t('brain.intelligence.capabilities')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`flex items-center gap-1.5 text-xs font-medium ${engine.enabled ? "text-emerald-600" : "text-red-500"}`}>
                          <span className={`h-2.5 w-2.5 rounded-full ${engine.enabled ? "bg-emerald-400" : "bg-red-400"}`} />
                          {engine.enabled ? t('brain.intelligence.online') : t('brain.intelligence.offline')}
                        </span>
                        <ChevronRight className={`h-4 w-4 text-slate-300 transition-transform ${isSelected ? "rotate-90" : ""}`} />
                      </div>
                    </button>

                    {isSelected && (
                      <div className="p-3 border-t bg-background">
                        {engine.kind === "SOVEREIGN_INTERNAL" && (
                          <div className="mb-3">
                            <SovereignModelQuickPicker engine={engine} />
                          </div>
                        )}
                        {engine.kind === "EXTERNAL_HYBRID" && (
                          <div className="mb-3">
                            <ExternalModelQuickPicker engine={engine} />
                          </div>
                        )}
                        <EngineDetailPanel
                          engine={engine}
                          sovereignEngines={byKind["SOVEREIGN_INTERNAL"] ?? []}
                          primarySovereignEngineId={primarySovereignEngineId}
                          onClose={() => setSelectedEngine(null)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Governance Rules */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-500" />
            {t('brain.intelligence.governanceContract')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <RuleCard icon={Lock} title={t('brain.intelligence.rules.sovereignBoundary')} rule={t('brain.intelligence.rules.sovereignBoundaryDesc')} accent="red" />
            <RuleCard icon={ShieldCheck} title={t('brain.intelligence.rules.advisoryOnly')} rule={t('brain.intelligence.rules.advisoryOnlyDesc')} accent="emerald" />
            <RuleCard icon={Eye} title={t('brain.intelligence.rules.redactionRequired')} rule={t('brain.intelligence.rules.redactionRequiredDesc')} accent="amber" />
            <RuleCard icon={RefreshCw} title={t('brain.intelligence.rules.lifecycleRule')} rule={t('brain.intelligence.rules.lifecycleRuleDesc')} accent="blue" />
          </div>
        </CardContent>
      </Card>

      <RoutingOverridesPanel overrides={overrides} engines={engines} />

    </div>
  );
}

/* ══════════════════════════════════════
   QUICK MODEL PICKER
   ══════════════════════════════════════ */

const OPENAI_MODELS = [
  "o3-mini", "o1", "o1-mini",
  "gpt-4.5-preview", "gpt-4o", "gpt-4o-mini",
  "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo",
];

const ANTHROPIC_MODELS = [
  "claude-opus-4-5-20251101",
  "claude-sonnet-4-5-20251115",
  "claude-haiku-3-5-20251015",
  "claude-3-5-sonnet-20241022",
  "claude-3-opus-20240229",
  "claude-sonnet-4-20250514",
];

function detectProviderFromModel(model: string): "openai" | "anthropic" | null {
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("gpt-") || /^o\d/.test(model)) return "openai";
  return null;
}

/* ── Compact model badge shown on the Engine A summary card ── */
function SovereignCardModelBadge({
  instances,
  primaryId,
}: Readonly<{
  instances: EnginePlugin[];
  primaryId: string | null;
}>) {
  const { toast } = useToast();
  const primaryEngine = instances.find((e) => e.enginePluginId === primaryId) ?? instances[0];
  const engineId = primaryEngine?.enginePluginId ?? "";
  const initialModel = getConfigString(primaryEngine?.config, "model");
  const initialFastModel = getConfigString(primaryEngine?.config, "fastModel");
  const [selectedModel, setSelectedModel] = useState(initialModel);
  const [selectedFastModel, setSelectedFastModel] = useState(initialFastModel);

  const allInstanceIds = instances.map((e) => e.enginePluginId).sort();
  const modelsQueries = useQueries({
    queries: allInstanceIds.map((id) => ({
      queryKey: ["/brain/engines", id, "models"] as const,
      queryFn: () => fetchEngineModels(id),
      enabled: !!id,
    })),
  });
  const modelsQueryPending = modelsQueries.some((q) => q.isPending);

  const availableLocalModels = useMemo(
    () => mergeConfiguredAndDiscoveredModels(modelsQueries.flatMap((query) => query.data?.models ?? []), instances),
    [instances, modelsQueries],
  );

  useEffect(() => { setSelectedModel(initialModel); }, [initialModel]);
  useEffect(() => { setSelectedFastModel(initialFastModel); }, [initialFastModel]);

  const saveMutation = useMutation({
    mutationFn: () =>
      patchEngine(engineId, {
        config: {
          ...(primaryEngine?.config),
          model: selectedModel || undefined,
          fastModel: selectedFastModel || undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/brain/engines"] });
      toast({ title: "Engine A models updated" });
    },
    onError: (error) => {
      toast({
        title: error instanceof Error ? error.message : "Failed to update models",
        variant: "destructive",
      });
    },
  });

  if (!primaryEngine) return null;

  const isDirty = selectedModel !== initialModel || selectedFastModel !== initialFastModel;

  return (
    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Engine A model routing</p>
        {initialModel && (
          <Badge variant="outline" className="text-[9px] h-4 font-mono">Primary: {initialModel}</Badge>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5 items-center">
        <Select
          value={selectedModel || "__none__"}
          onValueChange={(value) => setSelectedModel(value === "__none__" ? "" : value)}
          disabled={modelsQueryPending || saveMutation.isPending}
        >
          <SelectTrigger className="h-7 text-[11px] font-mono bg-background flex-1 min-w-0">
            <SelectValue
              placeholder={getModelPlaceholder(modelsQueryPending, availableLocalModels.length, "Select primary")}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Select primary</SelectItem>
            {availableLocalModels.map((m) => (
              <SelectItem key={m.name} value={m.name}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={selectedFastModel || "__same__"}
          onValueChange={(value) => setSelectedFastModel(value === "__same__" ? "" : value)}
          disabled={modelsQueryPending || saveMutation.isPending}
        >
          <SelectTrigger className="h-7 text-[11px] font-mono bg-background flex-1 min-w-0">
            <SelectValue
              placeholder={getModelPlaceholder(modelsQueryPending, availableLocalModels.length, "Select fast")}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__same__">Use primary model</SelectItem>
            {availableLocalModels.map((m) => (
              <SelectItem key={`fast-${m.name}`} value={m.name}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => saveMutation.mutate()}
          disabled={!isDirty || !selectedModel || saveMutation.isPending}
        >
          {saveMutation.isPending ? "..." : "Apply"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Structured and low-latency Engine A tasks use <span className="font-mono font-semibold">{selectedFastModel || selectedModel || "the primary model"}</span> as the fast model.
      </p>
    </div>
  );
}

/* ── Compact model badge shown on the Engine B summary card ── */
function ExternalCardModelBadge({ instances }: Readonly<{ instances: EnginePlugin[] }>) {
  const { toast } = useToast();
  const primaryEngine = instances[0];
  const engineId = primaryEngine?.enginePluginId ?? "";
  const initialModel = typeof primaryEngine?.config?.model === "string" ? primaryEngine.config.model : "";
  const initialProvider = typeof primaryEngine?.config?.provider === "string" ? primaryEngine.config.provider : "";
  const [selectedModel, setSelectedModel] = useState(initialModel);

  useEffect(() => { setSelectedModel(initialModel); }, [initialModel]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const autoProvider = detectProviderFromModel(selectedModel) ?? initialProvider;
      return patchEngine(engineId, {
        config: { ...(primaryEngine?.config), model: selectedModel || undefined, provider: autoProvider || undefined },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/brain/engines"] });
      toast({ title: "Engine B model updated" });
    },
    onError: (error) => {
      toast({
        title: error instanceof Error ? error.message : "Failed to update model",
        variant: "destructive",
      });
    },
  });

  if (!primaryEngine) return null;
  const isDirty = selectedModel !== initialModel;
  const detectedProvider = detectProviderFromModel(selectedModel) ?? initialProvider;

  return (
    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Active model</p>
        {detectedProvider && (
          <span className="text-[10px] font-mono text-muted-foreground">{detectedProvider}</span>
        )}
      </div>
      <div className="flex gap-1.5 items-center">
        <Select
          value={selectedModel || "__none__"}
          onValueChange={(value) => setSelectedModel(value === "__none__" ? "" : value)}
          disabled={saveMutation.isPending}
        >
          <SelectTrigger className="h-7 text-[11px] font-mono bg-background flex-1 min-w-0">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Select model</SelectItem>
            <SelectGroup>
              <SelectLabel className="text-[10px]">OpenAI</SelectLabel>
              {OPENAI_MODELS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel className="text-[10px]">Anthropic</SelectLabel>
              {ANTHROPIC_MODELS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => saveMutation.mutate()}
          disabled={!isDirty || !selectedModel || saveMutation.isPending}
        >
          {saveMutation.isPending ? "..." : "Apply"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        API keys and endpoint are managed in the full configuration below.
      </p>
    </div>
  );
}

/* ── Full quick-picker inside the expanded Engine B registry row ── */
function ExternalModelQuickPicker({ engine }: Readonly<{ engine: EnginePlugin }>) {
  const { toast } = useToast();
  const initialModel = typeof engine.config?.model === "string" ? engine.config.model : "";
  const initialProvider = typeof engine.config?.provider === "string" ? engine.config.provider : "";
  const [selectedModel, setSelectedModel] = useState(initialModel);

  useEffect(() => { setSelectedModel(initialModel); }, [initialModel]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const autoProvider = detectProviderFromModel(selectedModel) ?? initialProvider;
      return patchEngine(engine.enginePluginId, {
        config: { ...(engine.config), model: selectedModel || undefined, provider: autoProvider || undefined },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/brain/engines"] });
      toast({ title: "Engine B model updated" });
    },
    onError: (error) => {
      toast({
        title: error instanceof Error ? error.message : "Failed to update Engine B model",
        variant: "destructive",
      });
    },
  });

  const isDirty = selectedModel !== initialModel;
  const detectedProvider = detectProviderFromModel(selectedModel) ?? initialProvider;

  return (
    <div className="rounded-lg border p-3 bg-slate-50/60 dark:bg-slate-900/40 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Quick Engine B model selection</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Choose the active external model. API keys and endpoint are managed in the full config below.
          </p>
        </div>
        {initialModel && (
          <Badge variant="outline" className="text-[10px] font-mono">Current: {initialModel}</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Select
          value={selectedModel || "__none__"}
          onValueChange={(value) => setSelectedModel(value === "__none__" ? "" : value)}
          disabled={saveMutation.isPending}
        >
          <SelectTrigger className="bg-background font-mono text-xs">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Select model</SelectItem>
            <SelectGroup>
              <SelectLabel className="text-[10px]">OpenAI</SelectLabel>
              {OPENAI_MODELS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel className="text-[10px]">Anthropic</SelectLabel>
              {ANTHROPIC_MODELS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={!isDirty || !selectedModel || saveMutation.isPending}
        >
          {saveMutation.isPending ? "Saving..." : "Use this model"}
        </Button>
      </div>

      {detectedProvider && (
        <p className="text-[10px] text-muted-foreground">
          Provider auto-detected as <span className="font-mono font-semibold">{detectedProvider}</span> from model name.
        </p>
      )}
    </div>
  );
}

function SovereignModelQuickPicker({ engine }: Readonly<{ engine: EnginePlugin }>) {
  const { toast } = useToast();
  const initialModel = typeof engine.config?.model === "string" ? engine.config.model : "";
  const initialFastModel = typeof engine.config?.fastModel === "string" ? engine.config.fastModel : "";
  const [selectedModel, setSelectedModel] = useState(initialModel);
  const [selectedFastModel, setSelectedFastModel] = useState(initialFastModel);

  const modelsQuery = useQuery({
    queryKey: ["/brain/engines", engine.enginePluginId, "models"],
    queryFn: () => fetchEngineModels(engine.enginePluginId),
  });

  const availableLocalModels = useMemo(
    () => mergeConfiguredAndDiscoveredModels(modelsQuery.data?.models, [engine]),
    [engine, modelsQuery.data?.models],
  );

  useEffect(() => {
    setSelectedModel(initialModel);
  }, [initialModel]);

  useEffect(() => {
    setSelectedFastModel(initialFastModel);
  }, [initialFastModel]);

  const saveMutation = useMutation({
    mutationFn: () => patchEngine(engine.enginePluginId, {
      config: {
        ...(engine.config),
        model: selectedModel || undefined,
        fastModel: selectedFastModel || undefined,
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/brain/engines"] });
      queryClient.invalidateQueries({ queryKey: ["/brain/engines", engine.enginePluginId, "models"] });
      toast({ title: "Engine A models updated" });
    },
    onError: (error) => {
      toast({
        title: error instanceof Error ? error.message : "Failed to update Engine A models",
        variant: "destructive",
      });
    },
  });

  const isDirty = selectedModel !== initialModel || selectedFastModel !== initialFastModel;
  const runtimeUnavailable = modelsQuery.data?.configured === false || modelsQuery.data?.reachable === false;

  let modelStatusText: string;
  if (availableLocalModels.length > 0) {
    modelStatusText = `Installed runtime models: ${availableLocalModels.map((candidate) => candidate.name).join(", ")}. Fast model currently resolves to ${selectedFastModel || selectedModel || "the primary model"}.`;
  } else if (runtimeUnavailable) {
    modelStatusText = "The local runtime is configured but model discovery is unavailable right now. Use Refresh models or the full configuration panel below.";
  } else {
    modelStatusText = "No installed runtime models were returned yet. Refresh the list or use the full configuration panel below.";
  }

  return (
    <div className="rounded-lg border p-3 bg-slate-50/60 dark:bg-slate-900/40 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Quick Engine A model selection</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Choose the primary model for full generation and the fast model for structured or low-latency tasks. Manual custom tags remain available in the full configuration below.
          </p>
        </div>
        {initialModel && (
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-[10px] font-mono">Primary: {initialModel}</Badge>
            <Badge variant="outline" className="text-[10px] font-mono">Fast: {initialFastModel || initialModel}</Badge>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-2">
        <Select
          value={selectedModel || "__none__"}
          onValueChange={(value) => setSelectedModel(value === "__none__" ? "" : value)}
          disabled={modelsQuery.isPending || saveMutation.isPending || availableLocalModels.length === 0}
        >
          <SelectTrigger className="bg-background font-mono text-xs">
            <SelectValue
              placeholder={getRuntimePlaceholder(modelsQuery.isPending, runtimeUnavailable, "Select primary model")}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Select primary model</SelectItem>
            {availableLocalModels.map((candidate) => (
              <SelectItem key={candidate.name} value={candidate.name}>
                {candidate.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={selectedFastModel || "__same__"}
          onValueChange={(value) => setSelectedFastModel(value === "__same__" ? "" : value)}
          disabled={modelsQuery.isPending || saveMutation.isPending || availableLocalModels.length === 0}
        >
          <SelectTrigger className="bg-background font-mono text-xs">
            <SelectValue
              placeholder={getRuntimePlaceholder(modelsQuery.isPending, runtimeUnavailable, "Select fast model")}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__same__">Use primary model</SelectItem>
            {availableLocalModels.map((candidate) => (
              <SelectItem key={`fast-${candidate.name}`} value={candidate.name}>
                {candidate.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          onClick={() => modelsQuery.refetch()}
          disabled={modelsQuery.isFetching || saveMutation.isPending}
        >
          {modelsQuery.isFetching ? "Refreshing..." : "Refresh models"}
        </Button>
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={!isDirty || !selectedModel || saveMutation.isPending}
        >
          {saveMutation.isPending ? "Saving..." : "Use this model"}
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        {modelStatusText}
      </p>
    </div>
  );
}

/* ── Distillation (Engine C) Dashboard shown on the summary card ── */
interface DistillationStatus {
  engine: {
    llmEnabled: boolean;
    engineAModel: string;
    lastRunAt: string | null;
    totalRuns: number;
    totalArtifactsCreated: number;
    totalTrainingSamples: number;
    lastCorrelationAt: string | null;
  };
  learning: {
    totalArtifacts: number;
    draftCount: number;
    activeCount: number;
    activations: number;
  };
}

function DistillationCardDashboard() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data: distillStatus } = useQuery<DistillationStatus | null>({
    queryKey: ["/brain/engines/distillation/status"],
    queryFn: async () => {
      const res = await fetch("/api/corevia/engines/distillation/status");
      if (!res.ok) return null;
      return (await res.json()) as DistillationStatus;
    },
    refetchInterval: 15000,
  });

  const correlateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/corevia/engines/distillation/correlate", { method: "POST" });
      if (!res.ok) throw new Error("Correlation failed");
      return res.json() as Promise<{ correlations: unknown[]; llmUsed?: boolean; decisionsAnalyzed?: number; message?: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: t("brain.intelligence.correlationComplete", "Cross-Decision Correlation Complete"),
        description: data.message || `${data.correlations.length} themes found across ${data.decisionsAnalyzed ?? 0} decisions${data.llmUsed ? " [LLM-powered]" : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/brain/engines/distillation/status"] });
      queryClient.invalidateQueries({ queryKey: ["/brain/stats/learning"] });
    },
    onError: (err: unknown) => {
      toast({
        title: "Correlation Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  if (!distillStatus) return null;

  const { engine, learning } = distillStatus;

  return (
    <div className="space-y-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Sparkles className="h-3 w-3 text-violet-500" />
        <span className="font-semibold uppercase tracking-wider">
          {t("brain.intelligence.distillationDashboard", "Distillation Dashboard")}
        </span>
        {engine.llmEnabled && (
          <Badge variant="outline" className="text-[9px] ml-auto bg-violet-50 dark:bg-violet-950/30 text-violet-600">
            LLM: {engine.engineAModel}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1.5 text-center">
        <div className="p-1.5 rounded-md bg-muted/40">
          <p className="text-sm font-bold font-mono">{learning.totalArtifacts}</p>
          <p className="text-[9px] text-muted-foreground">{t("brain.intelligence.artifacts", "Artifacts")}</p>
        </div>
        <div className="p-1.5 rounded-md bg-muted/40">
          <p className="text-sm font-bold font-mono">{engine.totalTrainingSamples}</p>
          <p className="text-[9px] text-muted-foreground">{t("brain.intelligence.trainingSamples", "Training")}</p>
        </div>
        <div className="p-1.5 rounded-md bg-muted/40">
          <p className="text-sm font-bold font-mono">{learning.activeCount}</p>
          <p className="text-[9px] text-muted-foreground">{t("brain.intelligence.activated", "Activated")}</p>
        </div>
        <div className="p-1.5 rounded-md bg-muted/40">
          <p className="text-sm font-bold font-mono">{engine.totalRuns}</p>
          <p className="text-[9px] text-muted-foreground">{t("brain.intelligence.runs", "Runs")}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] text-muted-foreground">
          {engine.lastRunAt ? (
            <span>Last: {new Date(engine.lastRunAt).toLocaleString()}</span>
          ) : (
            <span>No runs yet</span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-[10px] gap-1"
          onClick={() => correlateMutation.mutate()}
          disabled={correlateMutation.isPending}
        >
          {correlateMutation.isPending ? (
            <><RefreshCw className="h-3 w-3 animate-spin" /> Correlating...</>
          ) : (
            <><TrendingUp className="h-3 w-3" /> Correlate</>
          )}
        </Button>
      </div>

      <Link href="/brain-console/learning">
        <span className="text-[10px] text-blue-500 flex items-center gap-1 hover:underline cursor-pointer">
          {t("brain.intelligence.viewLearningVault", "View Learning Vault")} <ChevronRight className="h-3 w-3" />
        </span>
      </Link>
    </div>
  );
}

/* ── Engine detail helpers ── */
function getMutationErrorTitle(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function parseEngineConfigJson(rawJson: string): Record<string, unknown> {
  try { return JSON.parse(rawJson); } catch { return {}; }
}

function resolveProviderMode(value: string): "openai" | "anthropic" | "local" | "custom" {
  if (value === "openai" || value === "anthropic" || value === "local") return value;
  return "custom";
}

function getHealthCheckTitle(ok?: boolean): string {
  return ok ? "Local model is reachable" : "Local model is not reachable";
}

function getModelsLoadedTitle(count: number): string {
  return count > 0 ? "Local runtime models loaded" : "No runtime models found";
}

function getStartRuntimeTitle(healthy?: boolean): string {
  return healthy ? "Engine A runtime started" : "Engine A runtime started, but health is still warming up";
}

function getMutationIcon(isPending: boolean, DefaultIcon: LucideIcon) {
  return isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <DefaultIcon className="mr-2 h-4 w-4" />;
}

function getPendingLabel(isPending: boolean, pendingText: string, defaultText: string): string {
  return isPending ? pendingText : defaultText;
}

function getSessionStatusColor(status: string): string {
  if (status === "completed") return "text-emerald-600";
  if (status === "failed") return "text-red-600";
  return "text-amber-600";
}

function getStepClassName(step: string): string {
  if (step.includes("Redaction")) return "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800";
  if (step.includes("LLM") || step.includes("Inference")) return "bg-muted/30 border-slate-200 dark:border-slate-700";
  return "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700";
}

function getStepDotClassName(step: string): string {
  if (step.includes("Redaction")) return "text-amber-500";
  if (step.includes("Attestation")) return "text-emerald-500";
  return "text-muted-foreground";
}

function getCapsButtonClassName(active: boolean): string {
  return active
    ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-muted-foreground";
}

function getProviderButtonClassName(isActive: boolean): string {
  return isActive
    ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 text-indigo-700"
    : "bg-slate-50 dark:bg-slate-800 border-slate-200 text-muted-foreground";
}

/* ── Sub-components for EngineDetailPanel ── */

function EngineAttestationsView({ attestations }: Readonly<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attestations: any[];
}>) {
  const { t } = useTranslation();
  if (attestations.length === 0) {
    return (
      <div className="text-center py-10">
        <ShieldCheck className="h-10 w-10 mx-auto text-slate-200 dark:text-slate-700 mb-2" />
        <p className="text-sm text-muted-foreground">{t('brain.intelligence.engineDetail.noAttestations')}</p>
        <p className="text-xs text-muted-foreground mt-1">{t('brain.intelligence.engineDetail.noAttestationsHint')}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {attestations.map((att) => (
        <div key={att.attestationId} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border text-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-mono font-medium truncate">{att.attestationId}</p>
            <p className="text-muted-foreground mt-0.5">
              {att.externalBoundaryCrossed ? t('brain.intelligence.engineDetail.externalBoundary') : t('brain.intelligence.engineDetail.internalOnly')} · {t('brain.intelligence.engineDetail.tools')}: {(att.toolsUsed || []).length}
            </p>
          </div>
          <span className="text-muted-foreground whitespace-nowrap">
            {att.createdAt ? new Date(att.createdAt).toLocaleDateString() : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

function EngineDataFlowView({ dataFlow, engineKind }: Readonly<{
  dataFlow: string[];
  engineKind: string;
}>) {
  const { t } = useTranslation();
  return (
    <div className="py-2">
      <div className="flex flex-col items-center gap-0">
        {dataFlow.map((step, idx) => (
          <div key={step}>
            <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all ${getStepClassName(step)}`}>
              <CircleDot className={`h-4 w-4 ${getStepDotClassName(step)}`} />
              <span className="text-sm font-medium">{step}</span>
              {step.includes("Redaction") && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
            </div>
            {idx < dataFlow.length - 1 && (
              <div className="flex justify-center py-1">
                <div className="flex flex-col items-center gap-[2px]">
                  <div className="spine-dot" style={{ animationDelay: `${idx * 0.12}s` }} />
                  <div className="spine-dot" style={{ animationDelay: `${idx * 0.12 + 0.15}s` }} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-start gap-2.5 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 text-xs">
        <Info className="h-4 w-4 flex-shrink-0 text-indigo-500 mt-0.5" />
        <div className="text-muted-foreground">
          {engineKind === "SOVEREIGN_INTERNAL" && t('brain.intelligence.engineDetail.flowInfoA')}
          {engineKind === "EXTERNAL_HYBRID" && t('brain.intelligence.engineDetail.flowInfoB')}
          {engineKind === "DISTILLATION" && t('brain.intelligence.engineDetail.flowInfoC')}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   ENGINE DETAIL PANEL
   ══════════════════════════════════════ */
function EngineDetailPanel({
  engine,
  sovereignEngines,
  primarySovereignEngineId,
  onClose,
}: Readonly<{
  engine: EnginePlugin;
  sovereignEngines: EnginePlugin[];
  primarySovereignEngineId: string | null;
  onClose: () => void;
}>) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const meta = ENGINE_KIND_META[engine.kind] ?? DEFAULT_ENGINE_META;
  const initialConfig = engine.config || {};
  const isPrimarySovereign = engine.kind === "SOVEREIGN_INTERNAL" && engine.enginePluginId === primarySovereignEngineId;

  const [localEnabled, setLocalEnabled] = useState(engine.enabled);
  const [localMaxClass, setLocalMaxClass] = useState(engine.allowedMaxClass);
  const [localCaps, setLocalCaps] = useState<Record<string, boolean>>(
    engine.capabilities || {}
  );
  const [localConfig, setLocalConfig] = useState(JSON.stringify(initialConfig, null, 2));
  const [localProvider, setLocalProvider] = useState(getConfigString(initialConfig, "provider"));
  const [localModel, setLocalModel] = useState(getConfigString(initialConfig, "model"));
  const [localFastModel, setLocalFastModel] = useState(getConfigString(initialConfig, "fastModel"));
  const [localRedactionMode, setLocalRedactionMode] = useState(getConfigString(initialConfig, "redactionMode"));
  const [localBudgetUsd, setLocalBudgetUsd] = useState(initialConfig.budgetUsd ?? "");
  const [localMaxTokens, setLocalMaxTokens] = useState(initialConfig.maxTokens ?? "");
  const [localTemperature, setLocalTemperature] = useState(initialConfig.temperature ?? "");
  const [localPriority, setLocalPriority] = useState(getEnginePriority(engine));
  // Engine A
  const [localEndpoint, setLocalEndpoint] = useState(getConfigString(initialConfig, "endpoint"));
  const [localTimeoutMs, setLocalTimeoutMs] = useState(initialConfig.timeoutMs ?? "");
  // Engine B
  const [localRedactionRequired, setLocalRedactionRequired] = useState(Boolean(initialConfig.redactionRequired ?? true));
  const cbConfig = (initialConfig.circuitBreaker ?? {}) as Record<string, unknown>;
  const [localCbFailureThreshold, setLocalCbFailureThreshold] = useState<string | number>((cbConfig.failureThreshold ?? "") as string | number);
  const [localCbCooldownSeconds, setLocalCbCooldownSeconds] = useState<string | number>((cbConfig.cooldownSeconds ?? "") as string | number);
  const [providerMode, setProviderMode] = useState<"openai" | "anthropic" | "local" | "custom">("custom");
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<"config" | "attestations" | "flow">("config");
  const [healthResult, setHealthResult] = useState<EngineHealthResponse | null>(null);
  const [testResult, setTestResult] = useState<EngineTestResponse | null>(null);
  const [modelsResult, setModelsResult] = useState<EngineModelsResponse | null>(null);
  const [runtimeResult, setRuntimeResult] = useState<EngineRuntimeStateResponse | null>(null);

  const { data: attestationsData } = useQuery({
    queryKey: ["/brain/engines", engine.enginePluginId, "attestations"],
    queryFn: () => fetchEngineAttestations(engine.enginePluginId),
    enabled: tab === "attestations",
  });
  const attestations = attestationsData?.attestations || [];

  const modelsQuery = useQuery({
    queryKey: ["/brain/engines", engine.enginePluginId, "models"],
    queryFn: () => fetchEngineModels(engine.enginePluginId),
    enabled: engine.kind === "SOVEREIGN_INTERNAL" && tab === "config",
  });
  const runtimeQuery = useQuery({
    queryKey: ["/brain/engines", engine.enginePluginId, "runtime"],
    queryFn: () => fetchEngineRuntime(engine.enginePluginId),
    enabled: engine.kind === "SOVEREIGN_INTERNAL" && tab === "config",
    refetchInterval: 15000,
  });
  const availableLocalModels = useMemo(
    () => mergeConfiguredAndDiscoveredModels(modelsQuery.data?.models, [engine]),
    [engine, modelsQuery.data?.models],
  );
  const effectiveRuntime = runtimeResult?.runtime || runtimeQuery.data?.runtime || null;
  const selectedModelValue = availableLocalModels.some((candidate) => candidate.name === localModel)
    ? localModel
    : "__manual__";

  const mutation = useMutation({
    mutationFn: () => {
      const parsedConfig = parseEngineConfigJson(localConfig);
      return patchEngine(engine.enginePluginId, {
        enabled: localEnabled,
        allowedMaxClass: localMaxClass,
        capabilities: localCaps,
        config: parsedConfig,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/brain/engines"] });
      queryClient.invalidateQueries({ queryKey: ["/brain/stats/engines"] });
      setDirty(false);
      toast({ title: t('brain.intelligence.engineUpdated', { name: engine.name }) });
    },
    onError: () => {
      toast({ title: t('brain.intelligence.engineUpdateFailed'), variant: "destructive" });
    },
  });

  const healthMutation = useMutation({
    mutationFn: () => fetchEngineHealth(engine.enginePluginId),
    onSuccess: (result) => {
      setHealthResult(result);
      toast({ title: getHealthCheckTitle(result.health?.ok) });
      modelsQuery.refetch();
    },
    onError: (error) => {
      toast({ title: getMutationErrorTitle(error, "Failed to check engine health"), variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: () => testEngine(engine.enginePluginId),
    onSuccess: (result) => {
      setTestResult(result);
      toast({ title: "Offline engine test completed" });
    },
    onError: (error) => {
      toast({ title: getMutationErrorTitle(error, "Engine test failed"), variant: "destructive" });
    },
  });

  const modelsMutation = useMutation({
    mutationFn: () => fetchEngineModels(engine.enginePluginId),
    onSuccess: (result) => {
      setModelsResult(result);
      queryClient.invalidateQueries({ queryKey: ["/brain/engines", engine.enginePluginId, "models"] });
      toast({ title: getModelsLoadedTitle(result.models.length) });
    },
    onError: (error) => {
      toast({ title: getMutationErrorTitle(error, "Failed to load local runtime models"), variant: "destructive" });
    },
  });

  const startRuntimeMutation = useMutation({
    mutationFn: () => startEngineRuntime(engine.enginePluginId),
    onSuccess: (result) => {
      setRuntimeResult(result);
      queryClient.invalidateQueries({ queryKey: ["/brain/engines", engine.enginePluginId, "runtime"] });
      queryClient.invalidateQueries({ queryKey: ["/brain/engines"] });
      queryClient.invalidateQueries({ queryKey: ["/brain/stats/engines"] });
      modelsQuery.refetch();
      toast({ title: getStartRuntimeTitle(result.runtime.healthy) });
    },
    onError: (error) => {
      toast({ title: getMutationErrorTitle(error, "Failed to start Engine A runtime"), variant: "destructive" });
    },
  });

  const stopRuntimeMutation = useMutation({
    mutationFn: () => stopEngineRuntime(engine.enginePluginId),
    onSuccess: (result) => {
      setRuntimeResult(result);
      queryClient.invalidateQueries({ queryKey: ["/brain/engines", engine.enginePluginId, "runtime"] });
      toast({ title: "Engine A runtime stopped" });
    },
    onError: (error) => {
      toast({ title: getMutationErrorTitle(error, "Failed to stop Engine A runtime"), variant: "destructive" });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async () => {
      const ordered = sovereignEngines
        .slice()
        .sort((left, right) => getEnginePriority(left) - getEnginePriority(right) || left.name.localeCompare(right.name));
      const targetFirst = [
        engine,
        ...ordered.filter((candidate) => candidate.enginePluginId !== engine.enginePluginId),
      ];

      await Promise.all(targetFirst.map((candidate, index) => {
        const nextPriority = index + 1;
        const currentPriority = getEnginePriority(candidate);
        if (currentPriority === nextPriority) {
          return Promise.resolve(null);
        }

        return patchEngine(candidate.enginePluginId, {
          config: {
            ...(candidate.config),
            priority: nextPriority,
          },
        });
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/brain/engines"] });
      queryClient.invalidateQueries({ queryKey: ["/brain/engines/routing-table"] });
      toast({ title: `${engine.name} is now the primary offline model` });
    },
    onError: (error) => {
      toast({ title: getMutationErrorTitle(error, "Failed to set primary offline model"), variant: "destructive" });
    },
  });

  function markDirty() { setDirty(true); }

  function applyConfigField(key: string, value: unknown) {
    const parsedConfig = parseEngineConfigJson(localConfig);
    if (value === "" || value === null || value === undefined) {
      delete parsedConfig[key];
    } else {
      parsedConfig[key] = value;
    }
    setLocalConfig(JSON.stringify(parsedConfig, null, 2));
    markDirty();
  }

  useEffect(() => {
    const parsed = parseEngineConfigJson(localConfig);
    const providerValue = getConfigString(parsed, "provider");
    setLocalProvider(providerValue);
    setProviderMode(resolveProviderMode(providerValue));
    setLocalModel(getConfigString(parsed, "model"));
    setLocalFastModel(getConfigString(parsed, "fastModel"));
    setLocalRedactionMode(getConfigString(parsed, "redactionMode"));
    setLocalBudgetUsd(parsed.budgetUsd ?? "");
    setLocalMaxTokens(parsed.maxTokens ?? "");
    setLocalTemperature(parsed.temperature ?? "");
    setLocalPriority(Number.isFinite(Number(parsed.priority)) ? Number(parsed.priority) : getEnginePriority(engine));
    setLocalEndpoint(getConfigString(parsed, "endpoint"));
    setLocalTimeoutMs(parsed.timeoutMs ?? "");
    setLocalRedactionRequired(Boolean(parsed.redactionRequired ?? true));
    const cb = (parsed.circuitBreaker ?? {}) as Record<string, unknown>;
    setLocalCbFailureThreshold((cb.failureThreshold ?? "") as string | number);
    setLocalCbCooldownSeconds((cb.cooldownSeconds ?? "") as string | number);
  }, [engine, localConfig]);

  return (
    <Card className="border overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
          <meta.icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold truncate">{engine.name}</h3>
            <Badge variant="outline" className="text-[10px] font-mono">v{engine.version}</Badge>
            <Badge variant="outline" className="text-[10px] font-mono">
              {engine.enabled ? t('brain.intelligence.onlineStatus') : t('brain.intelligence.offlineStatus')}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono truncate">{engine.enginePluginId}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {([
          { key: "config" as const, label: t('brain.intelligence.engineDetail.configuration'), icon: Settings2 },
          { key: "attestations" as const, label: t('brain.intelligence.engineDetail.attestations'), icon: ShieldCheck },
          { key: "flow" as const, label: t('brain.intelligence.engineDetail.dataFlow'), icon: Network },
        ]).map(({ key, label, icon: TabIcon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <TabIcon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      <CardContent className="pt-5">
        {/* Config Tab */}
        {tab === "config" && (
          <div className="space-y-5">
            {engine.kind === "SOVEREIGN_INTERNAL" && (
              <div className="rounded-lg border p-3 bg-slate-50/60 dark:bg-slate-900/40">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold">{t('brain.intelligence.engineDetail.engineALocal')}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t('brain.intelligence.engineDetail.engineALocalHint')}
                    </p>
                  </div>
                  {isPrimarySovereign && (
                    <Badge variant="secondary" className="text-[10px]">Primary offline model</Badge>
                  )}
                </div>
                <div className="mt-3 rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-3 dark:border-emerald-900/70 dark:bg-emerald-950/20">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold">Runtime control</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Start or stop the local Docker Engine A runtime from the platform UI. This keeps the sovereign runtime explicit instead of leaving it permanently hot.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        engine-a-gateway: {effectiveRuntime?.services.engineGateway || "unknown"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        local-llm: {effectiveRuntime?.services.localLlm || "unknown"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {getRuntimeStatusLabel(effectiveRuntime)}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="rounded-lg border bg-background/80 p-3 dark:bg-background/60">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Managed endpoint</p>
                      <p className="mt-2 font-mono text-[11px] text-foreground break-all">{effectiveRuntime?.endpoint || localEndpoint || "No managed endpoint resolved"}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {getRuntimeDescription(effectiveRuntime)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 lg:min-w-[220px]">
                      <Button
                        size="sm"
                        onClick={() => startRuntimeMutation.mutate()}
                        disabled={dirty || startRuntimeMutation.isPending || effectiveRuntime?.manageable === false}
                        className="justify-start"
                      >
                        {getMutationIcon(startRuntimeMutation.isPending, Play)}
                        {getPendingLabel(startRuntimeMutation.isPending, "Starting runtime...", "Start Engine A runtime")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => stopRuntimeMutation.mutate()}
                        disabled={dirty || stopRuntimeMutation.isPending || effectiveRuntime?.manageable === false}
                        className="justify-start"
                      >
                        {getMutationIcon(stopRuntimeMutation.isPending, Square)}
                        {getPendingLabel(stopRuntimeMutation.isPending, "Stopping runtime...", "Stop Engine A runtime")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => runtimeQuery.refetch()}
                        disabled={runtimeQuery.isFetching}
                        className="justify-start"
                      >
                        {getMutationIcon(runtimeQuery.isFetching, RefreshCw)}
                        Refresh runtime state
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{t('brain.intelligence.engineDetail.endpoint')}</Label>
                    <Input
                      value={localEndpoint}
                      onChange={(e) => {
                        setLocalEndpoint(e.target.value);
                        applyConfigField("endpoint", e.target.value.trim());
                      }}
                      placeholder="http://internal-llm:8080"
                      className="font-mono text-xs bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{t('brain.intelligence.engineDetail.timeoutMs')}</Label>
                    <Input
                      type="number"
                      min={1000}
                      step={500}
                      value={toInputValue(localTimeoutMs)}
                      onChange={(e) => {
                        const v = e.target.value === "" ? "" : Number(e.target.value);
                        setLocalTimeoutMs(v);
                        applyConfigField("timeoutMs", v === "" ? "" : Number(e.target.value));
                      }}
                      className="font-mono text-xs bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Primary model</Label>
                    <Input
                      value={localModel}
                      onChange={(e) => {
                        setLocalModel(e.target.value);
                        applyConfigField("model", e.target.value.trim());
                      }}
                      placeholder="mistral-nemo"
                      className="font-mono text-xs bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Fast model</Label>
                    <Input
                      value={localFastModel}
                      onChange={(e) => {
                        setLocalFastModel(e.target.value);
                        applyConfigField("fastModel", e.target.value.trim());
                      }}
                      placeholder="qwen2.5:7b"
                      className="font-mono text-xs bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={isPrimarySovereign ? "secondary" : "outline"}
                    onClick={() => promoteMutation.mutate()}
                    disabled={dirty || promoteMutation.isPending || isPrimarySovereign}
                  >
                    {getPendingLabel(promoteMutation.isPending, "Setting primary...", "Make primary offline model")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => modelsMutation.mutate()}
                    disabled={dirty || modelsMutation.isPending}
                  >
                    {getPendingLabel(modelsMutation.isPending, "Loading models...", "Load models")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => healthMutation.mutate()}
                    disabled={dirty || healthMutation.isPending}
                  >
                    {getPendingLabel(healthMutation.isPending, "Checking health...", "Check health")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testMutation.mutate()}
                    disabled={dirty || testMutation.isPending}
                  >
                    {getPendingLabel(testMutation.isPending, "Running test...", "Run test")}
                  </Button>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {getPendingLabel(dirty, "Save configuration changes before health checks or test runs.", "Lower priority wins for Engine A selection. Health and test use the saved endpoint and model.")}
                </p>

                {(healthResult || testResult) && (
                  <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold">Health</p>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {getHealthStatusLabel(healthResult)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground font-mono break-all">
                        {healthResult?.endpoint || localEndpoint || "No endpoint configured"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {getHealthDescription(healthResult)}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold">Test</p>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {getTestStatusLabel(testResult)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground font-mono break-all">
                        {testResult?.model || localModel || "No model configured"}
                      </p>
                      <pre className="mt-2 max-h-32 overflow-auto rounded-md bg-slate-50 dark:bg-slate-900 p-2 text-[10px] text-muted-foreground whitespace-pre-wrap break-words">
                        {testResult?.parsed
                          ? JSON.stringify(testResult.parsed, null, 2)
                          : testResult?.text || "Run a test to validate generation through the saved runtime."}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {engine.kind === "EXTERNAL_HYBRID" && (
              <div className="rounded-lg border p-3 bg-slate-50/60 dark:bg-slate-900/40">
                <p className="text-xs font-semibold">{t('brain.intelligence.engineDetail.engineBExternal')}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t('brain.intelligence.engineDetail.engineBExternalHint')}
                </p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{t('brain.intelligence.engineDetail.redactionRequired')}</Label>
                    <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
                      <Switch
                        checked={localRedactionRequired}
                        onCheckedChange={(v) => {
                          setLocalRedactionRequired(v);
                          applyConfigField("redactionRequired", v);
                        }}
                      />
                      <span className="text-xs font-semibold">{localRedactionRequired ? t('app.yes') : t('app.no')}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{t('brain.intelligence.engineDetail.cbFailureThreshold')}</Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={localCbFailureThreshold}
                      onChange={(e) => {
                        const v = e.target.value === "" ? "" : Number(e.target.value);
                        setLocalCbFailureThreshold(v);
                        const existing = (() => {
                          try { return JSON.parse(localConfig).circuitBreaker || {}; } catch { return {}; }
                        })();
                        applyConfigField("circuitBreaker", { ...existing, failureThreshold: v === "" ? undefined : Number(e.target.value) });
                      }}
                      className="font-mono text-xs bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{t('brain.intelligence.engineDetail.cbCooldownSec')}</Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={localCbCooldownSeconds}
                      onChange={(e) => {
                        const v = e.target.value === "" ? "" : Number(e.target.value);
                        setLocalCbCooldownSeconds(v);
                        const existing = (() => {
                          try { return JSON.parse(localConfig).circuitBreaker || {}; } catch { return {}; }
                        })();
                        applyConfigField("circuitBreaker", { ...existing, cooldownSeconds: v === "" ? undefined : Number(e.target.value) });
                      }}
                      className="font-mono text-xs bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Enable/Disable */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Power className="h-3 w-3" /> {t('brain.intelligence.engineDetail.status')}
                </Label>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border">
                  <Switch checked={localEnabled} onCheckedChange={(v) => { setLocalEnabled(v); markDirty(); }} />
                  <span className={`text-sm font-semibold ${localEnabled ? "text-emerald-600" : "text-red-500"}`}>
                    {localEnabled ? t('brain.intelligence.enabled') : t('brain.intelligence.disabled')}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">{t('brain.intelligence.engineDetail.disabledHint')}</p>
              </div>

              {/* Max Classification */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Shield className="h-3 w-3" /> {t('brain.intelligence.engineDetail.maxClassification')}
                </Label>
                <Select value={localMaxClass} onValueChange={(v) => { setLocalMaxClass(v); markDirty(); }}>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-800"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLASSIFICATION_LEVELS.map(cls => <SelectItem key={cls} value={cls}>{cls}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">{t('brain.intelligence.engineDetail.maxClassHint')}</p>
              </div>

              {/* Kind (read-only) */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Cpu className="h-3 w-3" /> {t('brain.intelligence.engineDetail.engineKind')}
                </Label>
                <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                  <meta.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{meta.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{t('brain.intelligence.engineDetail.kindImmutable')}</p>
              </div>
            </div>

            {/* Capabilities */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                <Zap className="h-3 w-3" /> {t('brain.intelligence.engineDetail.capabilities')}
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {CAPABILITIES.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { setLocalCaps(prev => ({ ...prev, [key]: !prev[key] })); markDirty(); }}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${getCapsButtonClassName(!!localCaps[key])}`}
                  >
                    <CheckCircle2 className={`h-3.5 w-3.5 ${localCaps[key] ? "text-indigo-500" : "text-slate-300"}`} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Server className="h-3 w-3" /> {t('brain.intelligence.engineDetail.provider')}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["openai", "anthropic", "local", "custom"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setProviderMode(p);
                        if (p === "custom") {
                          setLocalProvider("");
                          applyConfigField("provider", "");
                        } else {
                          setLocalProvider(p);
                          applyConfigField("provider", p);
                        }
                      }}
                      className={`px-2.5 py-2 rounded-lg border text-xs font-semibold uppercase tracking-wide transition-all ${getProviderButtonClassName(providerMode === p)}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                {providerMode === "custom" && (
                  <Input
                    value={localProvider}
                    onChange={(e) => {
                      setLocalProvider(e.target.value);
                      applyConfigField("provider", e.target.value.trim());
                    }}
                    placeholder="custom provider id"
                    className="bg-slate-50 dark:bg-slate-800 font-mono text-xs"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Cpu className="h-3 w-3" /> {t('brain.intelligence.engineDetail.model')}
                </Label>
                {engine.kind === "SOVEREIGN_INTERNAL" && (
                  <>
                    <Select
                      value={selectedModelValue}
                      onValueChange={(value) => {
                        if (value === "__manual__") return;
                        setLocalModel(value);
                        applyConfigField("model", value);
                      }}
                    >
                      <SelectTrigger className="bg-slate-50 dark:bg-slate-800 font-mono text-xs">
                        <SelectValue
                          placeholder={getModelSelectorPlaceholder(modelsQuery.isPending, modelsQuery.data?.configured, modelsQuery.data?.reachable)}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__manual__">Manual / custom tag</SelectItem>
                        {availableLocalModels.map((candidate) => (
                          <SelectItem key={candidate.name} value={candidate.name}>
                            {candidate.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      {availableLocalModels.length > 0
                        ? `Installed runtime models: ${availableLocalModels.map((candidate) => candidate.name).join(", ")}`
                        : getModelDiscoveryStatus(availableLocalModels.length, modelsResult?.reachable === false || modelsQuery.data?.reachable === false)}
                    </p>
                  </>
                )}
                <Input
                  value={localModel}
                  onChange={(e) => {
                    setLocalModel(e.target.value);
                    applyConfigField("model", e.target.value.trim());
                  }}
                  placeholder={engine.kind === "SOVEREIGN_INTERNAL" ? "phi4 | mistral-nemo" : "gpt-5 | claude-sonnet-4"}
                  className="bg-slate-50 dark:bg-slate-800 font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Shield className="h-3 w-3" /> {t('brain.intelligence.engineDetail.redactionMode')}
                </Label>
                <Input
                  value={localRedactionMode}
                  onChange={(e) => {
                    setLocalRedactionMode(e.target.value);
                    applyConfigField("redactionMode", e.target.value.trim());
                  }}
                  placeholder="NONE | MASK | MINIMIZE"
                  className="bg-slate-50 dark:bg-slate-800 font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Activity className="h-3 w-3" /> {t('brain.intelligence.engineDetail.budgetUsd')}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={toInputValue(localBudgetUsd)}
                  onChange={(e) => {
                    const value = e.target.value === "" ? "" : Number(e.target.value);
                    setLocalBudgetUsd(value);
                    applyConfigField("budgetUsd", value === "" ? "" : Number(e.target.value));
                  }}
                  className="bg-slate-50 dark:bg-slate-800 font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Gauge className="h-3 w-3" /> {t('brain.intelligence.engineDetail.maxTokens')}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={50}
                  value={toInputValue(localMaxTokens)}
                  onChange={(e) => {
                    const value = e.target.value === "" ? "" : Number(e.target.value);
                    setLocalMaxTokens(value);
                    applyConfigField("maxTokens", value === "" ? "" : Number(e.target.value));
                  }}
                  className="bg-slate-50 dark:bg-slate-800 font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> {t('brain.intelligence.engineDetail.temperature')}
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={toInputValue(localTemperature)}
                  onChange={(e) => {
                    const value = e.target.value === "" ? "" : Number(e.target.value);
                    setLocalTemperature(value);
                    applyConfigField("temperature", value === "" ? "" : Number(e.target.value));
                  }}
                  className="bg-slate-50 dark:bg-slate-800 font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Layers className="h-3 w-3" /> Priority
                </Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={toInputValue(localPriority)}
                  onChange={(e) => {
                    const value = e.target.value === "" ? "" : Number(e.target.value);
                    setLocalPriority(value === "" ? getEnginePriority(engine) : Number(value));
                    applyConfigField("priority", value === "" ? "" : Number(e.target.value));
                  }}
                  className="bg-slate-50 dark:bg-slate-800 font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">Lower priority is preferred within the same engine kind.</p>
              </div>
            </div>

            {/* Config JSON */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                <FileJson className="h-3 w-3" /> {t('brain.intelligence.engineDetail.runtimeConfigJson')}
              </Label>
              <Textarea
                value={localConfig}
                onChange={(e) => { setLocalConfig(e.target.value); markDirty(); }}
                className="font-mono text-xs min-h-[120px] bg-slate-50 dark:bg-slate-900 border"
                spellCheck={false}
              />
            </div>

            {/* Save */}
            {dirty && (
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={() => {
                  setLocalEnabled(engine.enabled);
                  setLocalMaxClass(engine.allowedMaxClass);
                  setLocalCaps(engine.capabilities || {});
                  setLocalConfig(JSON.stringify(engine.config || {}, null, 2));
                  setLocalPriority(getEnginePriority(engine));
                  setDirty(false);
                }}>Reset</Button>
                <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}
                  >
                  {mutation.isPending ? t('brain.intelligence.saving') : t('brain.intelligence.saveConfiguration')}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Attestations Tab */}
        {tab === "attestations" && <EngineAttestationsView attestations={attestations} />}

        {/* Data Flow Tab */}
        {tab === "flow" && <EngineDataFlowView dataFlow={meta.dataFlow} engineKind={engine.kind} />}
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════
   REGISTER ENGINE DIALOG
   ══════════════════════════════════════ */
export function RegisterEngineDialog({ onClose }: Readonly<{ onClose: () => void }>) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [id, setId] = useState("");
  const [kind, setKind] = useState<EnginePlugin["kind"]>("SOVEREIGN_INTERNAL");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0");
  const [maxClass, setMaxClass] = useState("INTERNAL");
  const [caps, setCaps] = useState<Record<string, boolean>>({});
  const [config, setConfig] = useState("{}");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [redactionMode, setRedactionMode] = useState("");
  const [budgetUsd, setBudgetUsd] = useState<string>("");
  const [maxTokens, setMaxTokens] = useState<string>("");
  const [temperature, setTemperature] = useState<string>("");

  const mutation = useMutation({
    mutationFn: () => registerEngine({
      enginePluginId: id,
      kind,
      name,
      version,
      enabled: true,
      allowedMaxClass: maxClass,
      capabilities: caps,
      config: (() => {
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(config); } catch { parsed = {}; }
        if (provider) parsed.provider = provider;
        if (model) parsed.model = model;
        if (redactionMode) parsed.redactionMode = redactionMode;
        if (budgetUsd !== "") parsed.budgetUsd = Number(budgetUsd);
        if (maxTokens !== "") parsed.maxTokens = Number(maxTokens);
        if (temperature !== "") parsed.temperature = Number(temperature);
        return parsed;
      })(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/brain/engines"] });
      queryClient.invalidateQueries({ queryKey: ["/brain/stats/engines"] });
      toast({ title: t('brain.intelligence.engineRegistered', { name }) });
      onClose();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      toast({ title: err?.message || t('brain.intelligence.registerFailed'), variant: "destructive" });
    },
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-indigo-500" /> {t('brain.intelligence.register.title')}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('brain.intelligence.register.enginePluginId')}</Label>
          <Input placeholder="ENG-MISTRAL-LOCAL" value={id} onChange={e => setId(e.target.value)} className="font-mono text-sm" />
          <p className="text-[10px] text-muted-foreground">{t('brain.intelligence.register.enginePluginIdHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('brain.intelligence.register.engineKind')}</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as EnginePlugin["kind"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ENGINE_KIND_META).map(([k, m]) => (
                <SelectItem key={k} value={k}>
                  <span className="flex items-center gap-2"><m.icon className={`h-3.5 w-3.5 ${m.color}`} />{m.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('brain.intelligence.register.name')}</Label>
            <Input placeholder="Mistral-Local" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('brain.intelligence.register.version')}</Label>
            <Input placeholder="3.2" value={version} onChange={e => setVersion(e.target.value)} className="font-mono" />
          </div>
        </div>
        <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('brain.intelligence.register.maxAllowedClassification')}</Label>
          <Select value={maxClass} onValueChange={setMaxClass}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CLASSIFICATION_LEVELS.map(cls => <SelectItem key={cls} value={cls}>{cls}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('brain.intelligence.register.capabilities')}</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {CAPABILITIES.map(({ key, label }) => (
              <button key={key} onClick={() => setCaps(prev => ({ ...prev, [key]: !prev[key] }))}
                className={`p-2 rounded-lg border text-[11px] font-medium transition-colors ${
                  caps[key] ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-50 border-slate-200 text-muted-foreground"
                }`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('brain.intelligence.register.provider')}</Label>
            <Input placeholder="openai | anthropic | local" value={provider} onChange={e => setProvider(e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('brain.intelligence.register.model')}</Label>
            <Input placeholder="gpt-5 | claude-sonnet-4" value={model} onChange={e => setModel(e.target.value)} className="font-mono text-xs" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('brain.intelligence.register.redactionMode')}</Label>
            <Input placeholder="NONE | MASK | MINIMIZE" value={redactionMode} onChange={e => setRedactionMode(e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('brain.intelligence.register.budgetUsd')}</Label>
            <Input type="number" min={0} step={1} value={budgetUsd} onChange={e => setBudgetUsd(e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('brain.intelligence.register.maxTokens')}</Label>
            <Input type="number" min={0} step={50} value={maxTokens} onChange={e => setMaxTokens(e.target.value)} className="font-mono text-xs" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('brain.intelligence.register.temperature')}</Label>
          <Input type="number" min={0} max={2} step={0.1} value={temperature} onChange={e => setTemperature(e.target.value)} className="font-mono text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('brain.intelligence.register.configJson')}</Label>
          <Textarea value={config} onChange={e => setConfig(e.target.value)}
            className="font-mono text-xs min-h-[80px]" placeholder='{"runtime": "on-prem", "model": "mistral-3.2"}' spellCheck={false} />
        </div>
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" size="sm" onClick={onClose}>{t('app.cancel')}</Button>
        <Button size="sm" onClick={() => mutation.mutate()} disabled={!id || !name || !version || mutation.isPending}
          >
          {mutation.isPending ? t('brain.intelligence.registering') : t('brain.intelligence.registerEngine')}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ══════════════════════════════════════
   SUB COMPONENTS
   ══════════════════════════════════════ */
function StatPill({ icon: Icon, label, value, accent }: Readonly<{ icon: LucideIcon; label: string; value: number; accent: string }>) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    cyan: { bg: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-600" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-600" },
    blue: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600" },
    amber: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600" },
    violet: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-600" },
  };
  const c = (colorMap[accent] || colorMap.blue)!;
  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="p-3 flex items-center gap-2.5">
        <div className={`p-2 rounded-lg ${c.bg}`}><Icon className={`h-4 w-4 ${c.text}`} /></div>
        <div>
          <p className="text-xl font-bold font-mono">{value}</p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RuleCard({ icon: Icon, title, rule, accent }: Readonly<{ icon: LucideIcon; title: string; rule: string; accent: string }>) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    red: { bg: "bg-red-50 dark:bg-red-950/20", text: "text-red-600", border: "border-red-200 dark:border-red-800" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/20", text: "text-emerald-600", border: "border-emerald-200 dark:border-emerald-800" },
    amber: { bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-600", border: "border-amber-200 dark:border-amber-800" },
    blue: { bg: "bg-blue-50 dark:bg-blue-950/20", text: "text-blue-600", border: "border-blue-200 dark:border-blue-800" },
  };
  const c = (colorMap[accent] || colorMap.blue)!;
  return (
    <div className={`p-4 rounded-xl border ${c.border} ${c.bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${c.text}`} />
        <span className={`text-xs font-bold ${c.text}`}>{title}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{rule}</p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function EngineLayerConfigPanel({ layers }: Readonly<{ layers: LayerConfig[] }>) {
  const { t } = useTranslation();
  const layerMap = new Map(layers.map(l => [l.id, l]));
  const targetLayers = [
    { id: 5, label: t('brain.intelligence.layerPanel.layer5'), note: t('brain.intelligence.layerPanel.layer5Note') },
    { id: 6, label: t('brain.intelligence.layerPanel.layer6'), note: t('brain.intelligence.layerPanel.layer6Note') },
    { id: 8, label: t('brain.intelligence.layerPanel.layer8'), note: t('brain.intelligence.layerPanel.layer8Note') },
  ];

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-indigo-500" />
              {t('brain.intelligence.layerPanel.title')}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {t('brain.intelligence.layerPanel.description')}
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono">L5/L6/L8</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {targetLayers.map(({ id, label, note }) => {
          const layer = layerMap.get(id);
          if (!layer) return null;
          return (
            <LayerConfigCard key={id} layer={layer} label={label} note={note} />
          );
        })}
      </CardContent>
    </Card>
  );
}

function RegisterEngineInline({ onDone }: Readonly<{ onDone: () => void }>) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [id, setId] = useState("");
  const [kind, setKind] = useState<EnginePlugin["kind"]>("SOVEREIGN_INTERNAL");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [maxClass, setMaxClass] = useState("INTERNAL");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [fastModel, setFastModel] = useState("");
  const [maxTokens, setMaxTokens] = useState<string>("");
  const [temperature, setTemperature] = useState<string>("");
  const [config, setConfig] = useState("{}");

  const mutation = useMutation({
    mutationFn: () =>
      registerEngine({
        enginePluginId: id,
        kind,
        name,
        version,
        enabled: true,
        allowedMaxClass: maxClass,
        config: (() => {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(config);
          } catch {
            parsed = {};
          }
          if (provider) parsed.provider = provider;
          if (model) parsed.model = model;
          if (fastModel) parsed.fastModel = fastModel;
          if (maxTokens !== "") parsed.maxTokens = Number(maxTokens);
          if (temperature !== "") parsed.temperature = Number(temperature);
          return parsed;
        })(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/brain/engines"] });
      queryClient.invalidateQueries({ queryKey: ["/brain/stats/engines"] });
      toast({ title: t('brain.intelligence.engineRegistered', { name }) });
      onDone();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      toast({ title: err?.message || t('brain.intelligence.registerFailed'), variant: "destructive" });
    },
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('brain.intelligence.register.enginePluginId')}</Label>
          <Input value={id} onChange={(e) => setId(e.target.value)} className="font-mono text-sm" placeholder="engine-a-local" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('brain.intelligence.register.engineKind')}</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as EnginePlugin["kind"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ENGINE_KIND_META).map(([k, m]) => (
                <SelectItem key={k} value={k}>
                  <span className="flex items-center gap-2"><m.icon className="h-3.5 w-3.5 text-muted-foreground" />{m.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('brain.intelligence.register.name')}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('brain.intelligence.register.version')}</Label>
          <Input value={version} onChange={(e) => setVersion(e.target.value)} className="font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('brain.intelligence.register.maxClassification')}</Label>
          <Select value={maxClass} onValueChange={setMaxClass}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CLASSIFICATION_LEVELS.map((cls) => <SelectItem key={cls} value={cls}>{cls}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('brain.intelligence.register.provider')}</Label>
          <Input value={provider} onChange={(e) => setProvider(e.target.value)} className="font-mono text-xs" placeholder="anthropic | openai | local" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('brain.intelligence.register.model')}</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} className="font-mono text-xs" placeholder="claude-sonnet-4-20250514" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Fast model</Label>
          <Input value={fastModel} onChange={(e) => setFastModel(e.target.value)} className="font-mono text-xs" placeholder="qwen2.5:7b" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('brain.intelligence.register.maxTokens')}</Label>
          <Input type="number" min={0} step={50} value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} className="font-mono text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">{t('brain.intelligence.register.temperature')}</Label>
          <Input type="number" min={0} max={2} step={0.1} value={temperature} onChange={(e) => setTemperature(e.target.value)} className="font-mono text-xs" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">{t('brain.intelligence.register.configJson')}</Label>
        <Textarea value={config} onChange={(e) => setConfig(e.target.value)} className="font-mono text-xs min-h-[90px]" spellCheck={false} />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onDone}>{t('app.cancel')}</Button>
        <Button size="sm" onClick={() => mutation.mutate()} disabled={!id || !name || !version || mutation.isPending}>
          {mutation.isPending ? t('brain.intelligence.registering') : t('brain.intelligence.register.submit')}
        </Button>
      </div>
    </div>
  );
}

function LayerConfigCard({ layer, label, note }: Readonly<{ layer: LayerConfig; label: string; note: string }>) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [localEnabled, setLocalEnabled] = useState(layer.enabled);
  const [localMode, setLocalMode] = useState(layer.mode);
  const [localTimeout, setLocalTimeout] = useState(layer.timeoutMs);
  const [localRetries, setLocalRetries] = useState(layer.retries);
  const [localSla, setLocalSla] = useState(layer.slaMs ?? layer.timeoutMs);
  const [localApprovalRequired, setLocalApprovalRequired] = useState(layer.approvalRequired ?? false);
  const [localApprovalRoles, setLocalApprovalRoles] = useState((layer.approvalRoles || []).join(", "));
  const [dirty, setDirty] = useState(false);

  const mutation = useMutation({
    mutationFn: () => updateLayer(layer.id, {
      enabled: localEnabled,
      mode: localMode,
      timeoutMs: localTimeout,
      retries: localRetries,
      slaMs: localSla,
      approvalRequired: localApprovalRequired,
      approvalRoles: localApprovalRoles.split(",").map(r => r.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/brain/layers"] });
      setDirty(false);
      toast({ title: t('brain.intelligence.layerConfig.layerUpdated', { id: layer.id }) });
    },
    onError: () => {
      toast({ title: t('brain.intelligence.layerConfig.updateFailed'), variant: "destructive" });
    },
  });

  function markDirty() { setDirty(true); }

  function applyPreset(preset: "fast" | "standard" | "deep") {
    if (preset === "fast") {
      setLocalTimeout(10000);
      setLocalRetries(0);
      setLocalSla(10000);
    } else if (preset === "standard") {
      setLocalTimeout(30000);
      setLocalRetries(1);
      setLocalSla(30000);
    } else {
      setLocalTimeout(90000);
      setLocalRetries(2);
      setLocalSla(90000);
    }
    setDirty(true);
  }

  return (
    <div className="rounded-2xl border p-5 space-y-4 bg-white/80 dark:bg-slate-900/70 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">{note}</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[9px]">UNSAVED</Badge>}
          <Badge variant="outline" className="text-[10px]">Layer {layer.id}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        <span className="text-muted-foreground">{t('brain.intelligence.layerConfig.presets')}:</span>
        <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={() => applyPreset("fast")}>{t('brain.intelligence.layerConfig.fast')}</Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={() => applyPreset("standard")}>{t('brain.intelligence.layerConfig.standard')}</Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={() => applyPreset("deep")}>{t('brain.intelligence.layerConfig.deep')}</Button>
        <span className="text-muted-foreground">{t('brain.intelligence.layerConfig.presetsHint')}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider">{t('brain.intelligence.layerConfig.status')}</Label>
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border">
            <Switch checked={localEnabled} onCheckedChange={(v) => { setLocalEnabled(v); markDirty(); }} />
            <span className={`text-xs font-semibold ${localEnabled ? "text-emerald-600" : "text-red-500"}`}>
              {localEnabled ? t('brain.intelligence.enabled') : t('brain.intelligence.disabled')}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">{t('brain.intelligence.layerConfig.disabledNote')}</p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider">{t('brain.intelligence.layerConfig.mode')}</Label>
          <Select value={localMode} onValueChange={(v) => { setLocalMode(v as LayerConfig["mode"]); markDirty(); }}>
            <SelectTrigger className="bg-slate-50 dark:bg-slate-800"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="enforce">{t('brain.intelligence.layerConfig.enforce')}</SelectItem>
              <SelectItem value="monitor">{t('brain.intelligence.layerConfig.monitor')}</SelectItem>
              <SelectItem value="bypass">{t('brain.intelligence.layerConfig.bypass')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider">{t('brain.intelligence.layerConfig.timeoutMs')}</Label>
          <Input
            type="number"
            min={0}
            step={1000}
            value={localTimeout}
            onChange={(e) => { setLocalTimeout(Number.parseInt(e.target.value) || 0); markDirty(); }}
            className="bg-slate-50 dark:bg-slate-800 font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">{t('brain.intelligence.layerConfig.timeoutHint')}</p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider">{t('brain.intelligence.layerConfig.retries')}</Label>
          <Input
            type="number"
            min={0}
            max={10}
            value={localRetries}
            onChange={(e) => { setLocalRetries(Math.min(10, Number.parseInt(e.target.value) || 0)); markDirty(); }}
            className="bg-slate-50 dark:bg-slate-800 font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">{t('brain.intelligence.layerConfig.retriesHint')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider">{t('brain.intelligence.layerConfig.slaTarget')}</Label>
          <Input
            type="number"
            min={0}
            step={1000}
            value={localSla}
            onChange={(e) => { setLocalSla(Number.parseInt(e.target.value) || 0); markDirty(); }}
            className="bg-slate-50 dark:bg-slate-800 font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">{t('brain.intelligence.layerConfig.slaHint')}</p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider">{t('brain.intelligence.layerConfig.approval')}</Label>
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border">
            <Switch checked={localApprovalRequired} onCheckedChange={(v) => { setLocalApprovalRequired(v); markDirty(); }} />
            <span className="text-xs font-semibold">
              {localApprovalRequired ? t('brain.intelligence.layerConfig.required') : t('brain.intelligence.layerConfig.notRequired')}
            </span>
          </div>
          <Input
            value={localApprovalRoles}
            onChange={(e) => { setLocalApprovalRoles(e.target.value); markDirty(); }}
            placeholder="director, manager"
            className="bg-slate-50 dark:bg-slate-800 font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">{t('brain.intelligence.layerConfig.approvalHint')}</p>
        </div>
      </div>

      {dirty && (
        <div className="flex items-center justify-end gap-2">
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
            Reset
          </Button>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? t('brain.intelligence.saving') : t('brain.intelligence.layerConfig.saveLayer')}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   R1 LEARNING PANEL (Engine D)
   ══════════════════════════════════════ */
export function R1LearningPanel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: r1Status, isLoading } = useQuery({
    queryKey: ["/brain/r1-learning/status"],
    queryFn: async () => {
      const res = await fetch("/api/corevia/r1-learning/status");
      if (!res.ok) return null;
      return (await res.json());
    },
    refetchInterval: 8000,
  });

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/corevia/r1-learning/trigger", { method: "POST" });
      if (!res.ok) throw new Error("Failed to trigger session");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/brain/r1-learning/status"] });
      toast({ title: t('brain.intelligence.r1.sessionComplete'), description: data.message });
    },
    onError: (err) => {
      toast({ title: t('brain.intelligence.r1.sessionFailed'), description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch("/api/corevia/r1-learning/scheduler", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Failed to update scheduler");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/brain/r1-learning/status"] });
      toast({ title: t('brain.intelligence.r1.schedulerUpdated') });
    },
  });

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground text-sm">{t('brain.intelligence.r1.loading')}</div>;
  }

  const engine = r1Status?.engine || {};
  const scheduler = r1Status?.scheduler || {};
  const insights = r1Status?.insights || { total: 0, byType: {}, recent: [] };
  const sessions = engine.recentSessions || [];

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-teal-500 to-cyan-600 shadow-md">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold">{engine.name || t('brain.intelligence.r1.title')}</p>
            <p className="text-xs text-muted-foreground">{engine.provider || "DeepSeek R1"} · {engine.model || "deepseek-reasoner"} · Layer {engine.layer || 8}</p>
          </div>
        </div>
        <Badge className={engine.isRunning ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"}>
          {engine.isRunning ? t('brain.intelligence.r1.learning') : t('brain.intelligence.r1.idle')}
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border bg-muted/30 text-center">
          <p className="text-xl font-bold font-mono">{insights.total}</p>
          <p className="text-[10px] text-muted-foreground">{t('brain.intelligence.r1.totalInsights')}</p>
        </div>
        <div className="p-3 rounded-xl border bg-muted/30 text-center">
          <p className="text-xl font-bold font-mono">{insights.byType?.pattern || 0}</p>
          <p className="text-[10px] text-muted-foreground">{t('brain.intelligence.r1.patterns')}</p>
        </div>
        <div className="p-3 rounded-xl border bg-muted/30 text-center">
          <p className="text-xl font-bold font-mono">{insights.byType?.assumption || 0}</p>
          <p className="text-[10px] text-muted-foreground">{t('brain.intelligence.r1.assumptions')}</p>
        </div>
        <div className="p-3 rounded-xl border bg-muted/30 text-center">
          <p className="text-xl font-bold font-mono">{sessions.length}</p>
          <p className="text-[10px] text-muted-foreground">{t('brain.intelligence.r1.sessions')}</p>
        </div>
      </div>

      {/* Scheduler Control */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{t('brain.intelligence.r1.autonomousScheduler')}</p>
              <p className="text-xs text-muted-foreground">
                Runs every {Math.round((scheduler.config?.intervalMs || 21600000) / 3600000)}h · Min {scheduler.config?.minDecisionsForLearning || 5} decisions
              </p>
            </div>
            <Switch
              checked={scheduler.enabled ?? true}
              onCheckedChange={(v) => toggleMutation.mutate(v)}
            />
          </div>
          {scheduler.lastCheckedAt && (
            <p className="text-[10px] text-muted-foreground mt-2">Last checked: {new Date(scheduler.lastCheckedAt).toLocaleString()}</p>
          )}
        </CardContent>
      </Card>

      {/* Manual Trigger */}
      <Button
        onClick={() => triggerMutation.mutate()}
        disabled={triggerMutation.isPending || engine.isRunning}
        className="w-full gap-2"
        variant="outline"
      >
        {triggerMutation.isPending || engine.isRunning ? (
          <><RefreshCw className="h-4 w-4 animate-spin" /> {t('brain.intelligence.r1.runningSession')}</>
        ) : (
          <><Sparkles className="h-4 w-4" /> {t('brain.intelligence.r1.triggerSession')}</>
        )}
      </Button>

      {/* Recent Sessions */}
      {sessions.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t('brain.intelligence.r1.recentSessions')}</p>
          <div className="space-y-2">
            {sessions.slice(0, 5).map((s: LearningSession) => (
              <div key={s.id} className="p-3 rounded-lg border bg-muted/20 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">{s.id}</span>
                  <Badge variant="outline" className={`text-[9px] ${getSessionStatusColor(s.status)}`}>
                    {s.status}
                  </Badge>
                </div>
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                  <span>{s.decisionsAnalyzed} decisions</span>
                  <span>{s.patternsIdentified} patterns</span>
                  <span>{s.newAssumptions} assumptions</span>
                  <span>{s.insightsGenerated} insights</span>
                </div>
                {s.startedAt && (
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(s.startedAt).toLocaleString()}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Insights */}
      {(insights.recent || []).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t('brain.intelligence.r1.latestInsights')}</p>
          <div className="space-y-2">
            {insights.recent.slice(0, 5).map((insight: LearningInsight) => (
              <div key={insight.id} className="p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold truncate">{insight.title}</p>
                  <Badge variant="outline" className="text-[9px] shrink-0">{insight.type}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{insight.description}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Confidence: {Math.round(insight.confidence * 100)}%</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Flow */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t('brain.intelligence.r1.dataFlow')}</p>
        <div className="space-y-1">
          {ENGINE_KIND_META.R1_LEARNING!.dataFlow.map((step, i) => (
            <div key={step} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-5 w-5 rounded-full bg-teal-100 dark:bg-teal-950/40 text-teal-600 text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface LearningSession {
  id: string;
  startedAt: string;
  completedAt?: string;
  decisionsAnalyzed: number;
  insightsGenerated: number;
  newAssumptions: number;
  patternsIdentified: number;
  status: string;
  error?: string;
}

interface LearningInsight {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: number;
  sourceDecisions: string[];
  generatedAt: string;
  appliesTo: string[];
}

export function EngineSmartPanel({
  engine,
  kind,
  layers,
  agents,
  onRegister,
}: Readonly<{
  engine?: EnginePlugin;
  kind: string;
  layers: LayerConfig[];
  agents: Agent[];
  onRegister: () => void;
}>) {
  const { t } = useTranslation();
  const meta = ENGINE_KIND_META[kind] ?? DEFAULT_ENGINE_META;
  const [tab, setTab] = useState<"engine" | "layers" | "agents">("engine");
  const [agentGroupMode, setAgentGroupMode] = useState<"capability" | "classification">("capability");
  const layerIds = new Set([5, 6, 8]);
  const targetLayers = layers.filter(l => layerIds.has(l.id));
  const activeAgents = agents.filter(agent => agent.status === "active" && agent.config?.enabled !== false);
  const provider = getConfigString(engine?.config ?? {}, "provider") || "—";
  const model = getConfigString(engine?.config ?? {}, "model") || "—";
  const maxClass = engine?.allowedMaxClass || "—";
  const capabilityCount = engine ? Object.values(engine.capabilities || {}).filter(Boolean).length : 0;
  const tabCards = [
    {
      key: "engine" as const,
      label: t('brain.intelligence.smartPanel.engine'),
      icon: Settings2,
      accent: "cyan",
      meta: `${capabilityCount} ${t('brain.intelligence.capabilities')}`,
      hint: t('brain.intelligence.smartPanel.engineHint'),
    },
    {
      key: "layers" as const,
      label: t('brain.intelligence.smartPanel.layers'),
      icon: Layers,
      accent: "emerald",
      meta: `${targetLayers.length} ${t('brain.intelligence.smartPanel.controls')}`,
      hint: t('brain.intelligence.smartPanel.layersHint'),
    },
    {
      key: "agents" as const,
      label: t('brain.intelligence.smartPanel.agents'),
      icon: Sparkles,
      accent: "amber",
      meta: `${activeAgents.length}/${agents.length} ${t('brain.intelligence.smartPanel.active')}`,
      hint: t('brain.intelligence.smartPanel.agentsHint'),
    },
  ];

  const agentGroups = useMemo(() => {
    if (agentGroupMode === "classification") {
      const groups = new Map<string, Agent[]>();
      agents.forEach(agent => {
        const classification = (agent.requiredClassification || "Unspecified").toUpperCase();
        if (!groups.has(classification)) {
          groups.set(classification, []);
        }
        groups.get(classification)?.push(agent);
      });
      return Array.from(groups.entries()).map(([label, items]) => ({
        label,
        items: items.toSorted((a, b) => a.name.localeCompare(b.name)),
      })).sort((a, b) => a.label.localeCompare(b.label));
    }

    const groups = new Map<string, Agent[]>();
    agents.forEach(agent => {
      const capability = agent.capabilities?.[0] || "General";
      if (!groups.has(capability)) {
        groups.set(capability, []);
      }
      groups.get(capability)?.push(agent);
    });

    return Array.from(groups.entries()).map(([label, items]) => ({
      label,
      items: items.toSorted((a, b) => a.name.localeCompare(b.name)),
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [agents, agentGroupMode]);

  return (
    <div className="w-full h-full">
      <div className="h-full w-full">
        <Card className="h-full border-0 rounded-none bg-background text-foreground">
          <CardHeader className="pb-4 border-b border-slate-200/80 dark:border-slate-800/70">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl flex items-center justify-center bg-muted">
                  <meta.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{meta.label}</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">{t('brain.intelligence.smartPanel.executivePanel')}</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">{engine?.name || t('brain.intelligence.smartPanel.noEngine')}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[9px]">{meta.short}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/70 bg-white/90 dark:bg-slate-900/70 px-4 py-3">
                <p className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('brain.intelligence.smartPanel.status')}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge className={`${engine?.enabled ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"} text-[9px]`}>
                    {engine?.enabled ? t('brain.intelligence.onlineStatus') : t('brain.intelligence.offlineStatus')}
                  </Badge>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{engine?.version ? `v${engine.version}` : "—"}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/70 bg-white/90 dark:bg-slate-900/70 px-4 py-3">
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('brain.intelligence.smartPanel.provider')}</p>
                    <p className="text-xs font-semibold truncate">{provider}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('brain.intelligence.smartPanel.model')}</p>
                    <p className="text-xs font-semibold truncate">{model}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('brain.intelligence.smartPanel.max')}</p>
                    <p className="text-xs font-semibold">{maxClass}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-3 gap-3">
              {tabCards.map(item => {
                const isActive = tab === item.key;
                const _accent = item.accent;
                const Icon = item.icon;
                const activeClasses = "bg-muted text-foreground border-border";
                const barClass = "bg-primary";
                return (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key)}
                    className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                      isActive
                        ? activeClasses
                        : "bg-white/90 dark:bg-slate-950/50 border-transparent text-slate-600 dark:text-slate-400 hover:border-slate-200/80 dark:hover:border-slate-800/70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </span>
                      <span className={`h-1.5 w-10 rounded-full ${isActive ? barClass : "bg-slate-200"}`} />
                    </div>
                    <p className="text-[10px] mt-1 text-slate-500 dark:text-slate-400">{item.hint}</p>
                    <p className="text-[10px] mt-1 font-semibold">{item.meta}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 space-y-4 min-h-[420px] overflow-y-auto max-h-[62vh] pr-1">
              {tab === "engine" && (
                <div className="space-y-4">
                  <div className="rounded-xl border bg-white/70 dark:bg-slate-900/50 p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider">{t('brain.intelligence.smartPanel.engineControls')}</p>
                      {engine && (
                        <Badge className={`${engine.enabled ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"} text-[9px]`}>
                          {engine.enabled ? t('brain.intelligence.onlineStatus') : t('brain.intelligence.offlineStatus')}
                        </Badge>
                      )}
                    </div>
                    {engine ? (
                      <div className="mt-3">
                        <CompactEngineConfig engine={engine} />
                      </div>
                    ) : (
                      <div className="text-center py-5">
                        <p className="text-sm font-medium text-muted-foreground">{t('brain.intelligence.smartPanel.noEngine')}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t('brain.intelligence.smartPanel.noEngineHint', { label: meta.label })}</p>
                        <Button size="sm" variant="outline" className="mt-3" onClick={onRegister}>{t('brain.intelligence.registerEngine')}</Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === "layers" && (
                <div className="space-y-3">
                  {targetLayers.map(layer => (
                    <CompactLayerConfig key={layer.id} layer={layer} />
                  ))}
                  {targetLayers.length === 0 && (
                    <div className="text-xs text-muted-foreground">{t('brain.intelligence.smartPanel.noLayerControls')}</div>
                  )}
                </div>
              )}

              {tab === "agents" && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 text-slate-800 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/70 dark:text-slate-100">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('brain.intelligence.smartPanel.layer6Governance')}</p>
                        <p className="text-sm font-semibold">{t('brain.intelligence.smartPanel.agentsControlled')}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px]">SAFE ZONE</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                      <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 dark:border-slate-800/70 dark:bg-slate-900/60">
                        <p className="font-semibold">{t('brain.intelligence.smartPanel.whereAgentsRun')}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.whereAgentsRunDesc1')}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.whereAgentsRunDesc2')}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 dark:border-slate-800/70 dark:bg-slate-900/60">
                        <p className="font-semibold">{t('brain.intelligence.smartPanel.whereAgentsNotRun')}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.whereAgentsNotRunDesc1')}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.whereAgentsNotRunDesc2')}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                      <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                        <p className="font-semibold text-emerald-700 dark:text-emerald-200">{t('brain.intelligence.smartPanel.readMode')}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.readModeDesc')}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.noWrites')}</p>
                      </div>
                      <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                        <p className="font-semibold text-amber-700 dark:text-amber-200">{t('brain.intelligence.smartPanel.planMode')}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.planModeDesc')}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.noSideEffects')}</p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 text-[11px] dark:border-slate-800/70 dark:bg-slate-900/60">
                      <p className="font-semibold">{t('brain.intelligence.smartPanel.agentPlanRequired')}</p>
                      <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white/80 p-2 text-[10px] text-slate-700 dark:bg-slate-950/70 dark:text-slate-200">
{`{"agent_plan":{"allowedAgents":["ContextAggregator","EvidenceCollector","RiskControls","PackBuilder","PortfolioSyncPlan"],"mode":"PLAN","writePermissions":false}}`}
                      </pre>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                      <div className="rounded-xl border border-slate-200/70 bg-white/90 p-3 dark:border-slate-800/70 dark:bg-slate-950/70">
                        <p className="font-semibold">{t('brain.intelligence.smartPanel.businessCase')}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.businessCaseAgents')}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.businessCaseNote')}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200/70 bg-white/90 p-3 dark:border-slate-800/70 dark:bg-slate-950/70">
                        <p className="font-semibold">{t('brain.intelligence.smartPanel.requirements')}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.requirementsAgents')}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.requirementsNote')}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200/70 bg-white/90 p-3 dark:border-slate-800/70 dark:bg-slate-950/70">
                        <p className="font-semibold">{t('brain.intelligence.smartPanel.strategicFit')}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.strategicFitAgents')}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.strategicFitNote')}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200/70 bg-white/90 p-3 dark:border-slate-800/70 dark:bg-slate-950/70">
                        <p className="font-semibold">{t('brain.intelligence.smartPanel.wbsPlan')}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.wbsPlanAgents')}</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.wbsPlanNote')}</p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-xl border border-cyan-200/70 bg-cyan-50/70 p-3 text-[11px] dark:border-cyan-500/30 dark:bg-cyan-500/10">
                      <p className="font-semibold text-cyan-800 dark:text-cyan-200">{t('brain.intelligence.smartPanel.portfolioSync')}</p>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.portfolioSyncPlan')}</p>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.portfolioSyncExecute')}</p>
                    </div>
                    <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/90 p-3 text-[11px] dark:border-slate-800/70 dark:bg-slate-950/70">
                      <p className="font-semibold">{t('brain.intelligence.smartPanel.agentAdjudication')}</p>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.agentAdjudicationDesc1')}</p>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">{t('brain.intelligence.smartPanel.agentAdjudicationDesc2')}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider">{t('brain.intelligence.smartPanel.agents')}</p>
                      <Badge variant="outline" className="text-[9px] font-mono">{activeAgents.length}/{agents.length} active</Badge>
                    </div>
                    <Link href="/brain-console/agents">
                      <Button variant="outline" size="sm" className="h-6 text-[9px]">{t('brain.intelligence.smartPanel.manage')}</Button>
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAgentGroupMode("capability")}
                      className={`px-2.5 py-1 rounded-full border text-[9px] font-semibold uppercase tracking-wide ${
                        agentGroupMode === "capability"
                          ? "bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200 dark:border-cyan-500/30"
                          : "bg-white/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {t('brain.intelligence.smartPanel.capability')}
                    </button>
                    <button
                      onClick={() => setAgentGroupMode("classification")}
                      className={`px-2.5 py-1 rounded-full border text-[9px] font-semibold uppercase tracking-wide ${
                        agentGroupMode === "classification"
                          ? "bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200 dark:border-cyan-500/30"
                          : "bg-white/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {t('brain.intelligence.smartPanel.classification')}
                    </button>
                  </div>
                  {agents.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground mt-3">{t('brain.intelligence.smartPanel.noAgents')}</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      {agentGroups.map(group => (
                        <div key={group.label} className="rounded-lg border bg-white/70 dark:bg-slate-950/40 p-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold">{group.label}</p>
                            <Badge variant="outline" className="text-[9px] font-mono">{group.items.length}</Badge>
                          </div>
                          <div className="mt-2 space-y-2">
                            {group.items.map(agent => (
                              <AgentToggleRow key={agent.id} agent={agent} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CompactLayerConfig({ layer }: Readonly<{ layer: LayerConfig }>) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [localEnabled, setLocalEnabled] = useState(layer.enabled);
  const [localMode, setLocalMode] = useState(layer.mode);
  const [localTimeout, setLocalTimeout] = useState(layer.timeoutMs);
  const [localRetries, setLocalRetries] = useState(layer.retries);
  const [dirty, setDirty] = useState(false);

  const mutation = useMutation({
    mutationFn: () => updateLayer(layer.id, {
      enabled: localEnabled,
      mode: localMode,
      timeoutMs: localTimeout,
      retries: localRetries,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/brain/layers"] });
      setDirty(false);
      toast({ title: t('brain.intelligence.layerConfig.layerSaved', { id: layer.id }) });
    },
    onError: () => {
      toast({ title: t('brain.intelligence.layerConfig.updateFailed'), variant: "destructive" });
    },
  });

  return (
    <div className="rounded-lg border p-3 bg-slate-50/60 dark:bg-slate-900/40">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold">Layer {layer.id}: {layer.name}</p>
          <p className="text-[10px] text-muted-foreground">{layer.description}</p>
        </div>
        {dirty && <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[9px]">UNSAVED</Badge>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2">
          <Switch checked={localEnabled} onCheckedChange={(v) => { setLocalEnabled(v); setDirty(true); }} />
          <span className="text-[11px] font-semibold">{localEnabled ? t('app.on') : t('app.off')}</span>
        </div>
        <Select value={localMode} onValueChange={(v) => { setLocalMode(v as LayerConfig["mode"]); setDirty(true); }}>
          <SelectTrigger className="h-7 text-[10px] bg-slate-50 dark:bg-slate-800"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="enforce">{t('brain.intelligence.layerConfig.enforce')}</SelectItem>
            <SelectItem value="monitor">{t('brain.intelligence.layerConfig.monitor')}</SelectItem>
            <SelectItem value="bypass">{t('brain.intelligence.layerConfig.bypass')}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={0}
          step={1000}
          value={localTimeout}
          onChange={(e) => { setLocalTimeout(Number.parseInt(e.target.value) || 0); setDirty(true); }}
          className="h-7 text-[10px] font-mono bg-slate-50 dark:bg-slate-800"
          placeholder={t('brain.intelligence.layerConfig.timeoutMs')}
        />
        <Input
          type="number"
          min={0}
          max={10}
          value={localRetries}
          onChange={(e) => { setLocalRetries(Math.min(10, Number.parseInt(e.target.value) || 0)); setDirty(true); }}
          className="h-7 text-[10px] font-mono bg-slate-50 dark:bg-slate-800"
          placeholder="Retries"
        />
      </div>
      {dirty && (
        <div className="mt-2 flex justify-end">
          <Button size="sm" className="h-7 text-[10px]" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? t('brain.intelligence.saving') : t('app.save')}
          </Button>
        </div>
      )}
    </div>
  );
}

function CompactEngineConfig({ engine }: Readonly<{ engine: EnginePlugin }>) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const initialConfig = engine.config || {};
  const [localEnabled, setLocalEnabled] = useState(engine.enabled);
  const [localMaxClass, setLocalMaxClass] = useState(engine.allowedMaxClass);
  const [localCaps, setLocalCaps] = useState<Record<string, boolean>>(engine.capabilities || {});
  const [localProvider, setLocalProvider] = useState(getConfigString(initialConfig, "provider"));
  const [localModel, setLocalModel] = useState(getConfigString(initialConfig, "model"));
  const [localRedactionMode, setLocalRedactionMode] = useState(getConfigString(initialConfig, "redactionMode"));
  const [dirty, setDirty] = useState(false);

  const modelsQuery = useQuery({
    queryKey: ["/brain/engines", engine.enginePluginId, "models"],
    queryFn: () => fetchEngineModels(engine.enginePluginId),
    enabled: engine.kind === "SOVEREIGN_INTERNAL",
  });
  const availableLocalModels = useMemo(
    () => mergeConfiguredAndDiscoveredModels(modelsQuery.data?.models, [engine]),
    [engine, modelsQuery.data?.models],
  );
  const selectedModelValue = availableLocalModels.some((candidate) => candidate.name === localModel)
    ? localModel
    : "__manual__";

  const mutation = useMutation({
    mutationFn: () => patchEngine(engine.enginePluginId, {
      enabled: localEnabled,
      allowedMaxClass: localMaxClass,
      capabilities: localCaps,
      config: {
        ...initialConfig,
        provider: localProvider || undefined,
        model: localModel || undefined,
        redactionMode: localRedactionMode || undefined,
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/brain/engines"] });
      setDirty(false);
      toast({ title: t('brain.intelligence.engineUpdatedShort') });
    },
    onError: () => {
      toast({ title: t('brain.intelligence.engineUpdateFailed'), variant: "destructive" });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Switch checked={localEnabled} onCheckedChange={(v) => { setLocalEnabled(v); setDirty(true); }} />
        <span className="text-[11px] font-semibold">{localEnabled ? t('brain.intelligence.enabled') : t('brain.intelligence.disabled')}</span>
        <Badge variant="outline" className="text-[9px]">Max: {localMaxClass}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/brain-console/services">
          <Button variant="outline" size="sm" className="h-7 text-[10px]">{t('brain.intelligence.services')}</Button>
        </Link>
        <Link href="/brain-console/agents">
          <Button variant="outline" size="sm" className="h-7 text-[10px]">{t('brain.intelligence.smartPanel.agents')}</Button>
        </Link>
      </div>
      <div className="space-y-2">
        <Label className="text-[10px] font-semibold uppercase tracking-wider">{t('brain.intelligence.engineDetail.provider')}</Label>
        <div className="grid grid-cols-2 gap-2">
          {["openai", "anthropic", "auto", "custom"].map((provider) => (
            <button
              key={provider}
              onClick={() => {
                if (provider === "custom") {
                  setLocalProvider("");
                } else {
                  setLocalProvider(provider);
                }
                setDirty(true);
              }}
              className={`h-7 rounded-lg border text-[10px] font-semibold uppercase tracking-wide ${
                (localProvider || "auto") === provider
                  ? "bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200 dark:border-cyan-500/30"
                  : "bg-slate-50 border-slate-200 text-muted-foreground dark:bg-slate-900/60 dark:border-slate-800"
              }`}
            >
              {provider}
            </button>
          ))}
        </div>
        {(localProvider === "" || localProvider === "custom") && (
          <Input
            value={localProvider}
            onChange={(e) => { setLocalProvider(e.target.value); setDirty(true); }}
            placeholder="custom provider id"
            className="h-7 text-[10px] font-mono bg-slate-50 dark:bg-slate-800"
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {engine.kind === "SOVEREIGN_INTERNAL" ? (
          <Select
            value={selectedModelValue}
            onValueChange={(value) => {
              if (value === "__manual__") return;
              setLocalModel(value);
              setDirty(true);
            }}
          >
            <SelectTrigger className="h-7 text-[10px] bg-slate-50 dark:bg-slate-800 font-mono"><SelectValue placeholder="runtime model" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__manual__">Manual / custom tag</SelectItem>
              {availableLocalModels.map((candidate) => (
                <SelectItem key={candidate.name} value={candidate.name}>{candidate.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={localModel}
            onChange={(e) => { setLocalModel(e.target.value); setDirty(true); }}
            placeholder="model"
            className="h-7 text-[10px] font-mono bg-slate-50 dark:bg-slate-800"
          />
        )}
        <Select value={localRedactionMode} onValueChange={(v) => { setLocalRedactionMode(v); setDirty(true); }}>
          <SelectTrigger className="h-7 text-[10px] bg-slate-50 dark:bg-slate-800"><SelectValue placeholder="redaction" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">NONE</SelectItem>
            <SelectItem value="MASK">MASK</SelectItem>
            <SelectItem value="MINIMIZE">MINIMIZE</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {engine.kind === "SOVEREIGN_INTERNAL" && (
        <Input
          value={localModel}
          onChange={(e) => { setLocalModel(e.target.value); setDirty(true); }}
          placeholder="phi4 | mistral-nemo"
          className="h-7 text-[10px] font-mono bg-slate-50 dark:bg-slate-800"
        />
      )}
      <Select value={localMaxClass} onValueChange={(v) => { setLocalMaxClass(v); setDirty(true); }}>
        <SelectTrigger className="h-7 text-[10px] bg-slate-50 dark:bg-slate-800"><SelectValue /></SelectTrigger>
        <SelectContent>
          {CLASSIFICATION_LEVELS.map(cls => <SelectItem key={cls} value={cls}>{cls}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="space-y-2">
        <Label className="text-[10px] font-semibold uppercase tracking-wider">{t('brain.intelligence.aiGenerationServices')}</Label>
        <div className="grid grid-cols-2 gap-2">
          {CAPABILITIES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setLocalCaps(prev => ({ ...prev, [key]: !prev[key] }));
                setDirty(true);
              }}
              className={`h-7 rounded-lg border text-[10px] font-medium transition-all ${
                localCaps[key]
                  ? "bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200 dark:border-cyan-500/30"
                  : "bg-slate-50 border-slate-200 text-muted-foreground dark:bg-slate-900/60 dark:border-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {dirty && (
        <div className="flex justify-end">
          <Button size="sm" className="h-7 text-[10px]" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? t('brain.intelligence.saving') : t('app.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
