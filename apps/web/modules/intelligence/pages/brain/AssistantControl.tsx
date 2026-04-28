/**
 * COREVIA Brain — Assistant Advisor Control Plane
 *
 * Governance UI for the unified COREVIA Intelligent Assistant Advisor.
 * Route: /brain-console/advisor
 *
 * Sections:
 *  1. Surfaces     — per-surface enable/disable + streaming toggle
 *  2. Access       — per-role access configuration
 *  3. Engine       — model selection + token / temperature config
 *  4. Live Monitor — recent chat interactions across all surfaces
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, Bot, Brain, CheckCircle2,
  Circle, Cpu, Eye, Globe, Layers,
  MessageSquare, Power, RefreshCw,
  Settings2, Shield, Sliders, Sparkles,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import CoveriaAdvisor from "@/modules/advisor";

// ── Types ────────────────────────────────────────────────────────────────────

interface SurfaceConfig {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  allowedRoles: string[];
  streamingEnabled: boolean;
  maxTokens: number;
  context: string;
}

interface AdvisorConfigData {
  globalEnabled: boolean;
  model: string;
  surfaces: SurfaceConfig[];
  updatedAt: string;
  updatedBy: string | null;
}

interface ConfigResponse {
  success: boolean;
  data: AdvisorConfigData;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ALL_ROLES = ["admin", "manager", "analyst", "user"] as const;

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  analyst: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  user: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const AVAILABLE_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (Recommended)", vendor: "Anthropic" },
  { value: "claude-opus-4-5", label: "Claude Opus 4", vendor: "Anthropic" },
  { value: "claude-haiku-3-5-20241022", label: "Claude Haiku 3.5 (Fast)", vendor: "Anthropic" },
  { value: "gpt-4o-2024-11-20", label: "GPT-4o", vendor: "OpenAI" },
];

const SURFACE_ICONS: Record<string, typeof Bot> = {
  pmo: Layers,
  demand: MessageSquare,
  home: Globe,
  workspace: Activity,
  performance: Sliders,
  ea: Brain,
};

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchAdvisorConfig(): Promise<ConfigResponse> {
  const r = await fetch("/api/ai-assistant/advisor/config", { credentials: "include" });
  if (!r.ok) throw new Error("Failed to load advisor config");
  return r.json() as Promise<ConfigResponse>;
}

async function patchAdvisorConfig(payload: Partial<AdvisorConfigData>): Promise<ConfigResponse> {
  const r = await fetch("/api/ai-assistant/advisor/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("Failed to update advisor config");
  return r.json() as Promise<ConfigResponse>;
}

async function resetAdvisorConfig(): Promise<ConfigResponse> {
  const r = await fetch("/api/ai-assistant/advisor/config/reset", {
    method: "POST",
    credentials: "include",
  });
  if (!r.ok) throw new Error("Failed to reset advisor config");
  return r.json() as Promise<ConfigResponse>;
}

// ── Surface icon helper ───────────────────────────────────────────────────────

function SurfaceIcon(id: string) {
  const Icon = SURFACE_ICONS[id] ?? Bot;
  return <Icon className="h-3.5 w-3.5 text-slate-500" />;
}

// ── Surface card ─────────────────────────────────────────────────────────────

function SurfaceCard({
  surface,
  onToggle,
  onStreamingToggle,
  onTokensChange,
  onRoleToggle,
  globalEnabled,
}: {
  surface: SurfaceConfig;
  onToggle: (id: string, val: boolean) => void;
  onStreamingToggle: (id: string, val: boolean) => void;
  onTokensChange: (id: string, tokens: number) => void;
  onRoleToggle: (id: string, role: string) => void;
  globalEnabled: boolean;
}) {
  const Icon = SURFACE_ICONS[surface.id] ?? Bot;
  const isDisabled = !globalEnabled || !surface.enabled;

  return (
    <Card className={`transition-all duration-200 ${isDisabled ? "opacity-60" : ""}`}>
      <CardContent className="pt-4 pb-4 px-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
            surface.enabled ? "bg-gradient-to-br from-cyan-500/15 to-blue-500/15 text-cyan-600 dark:text-cyan-400" : "bg-slate-100 text-slate-400 dark:bg-slate-800"
          }`}>
            <Icon className="h-4.5 w-4.5" />
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{surface.label}</span>
              <Badge
                variant="outline"
                className={`px-1.5 py-0 text-[9px] font-medium ${
                  surface.enabled
                    ? "border-emerald-400/50 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                    : "border-slate-300 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                <Circle className={`mr-0.5 h-1 w-1 fill-current ${surface.enabled ? "text-emerald-500" : "text-slate-400"}`} />
                {surface.enabled ? "Active" : "Disabled"}
              </Badge>
              {surface.streamingEnabled && (
                <Badge variant="outline" className="border-blue-300/50 bg-blue-50/70 px-1.5 py-0 text-[9px] font-medium text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                  <Zap className="mr-0.5 h-2 w-2" /> Streaming
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{surface.description}</p>

            {/* Roles */}
            <div className="mt-2 flex flex-wrap gap-1">
              {ALL_ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => onRoleToggle(surface.id, role)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${
                    surface.allowedRoles.includes(role)
                      ? ROLE_COLORS[role]
                      : "bg-slate-100 text-slate-400 opacity-50 dark:bg-slate-800 dark:text-slate-500"
                  }`}
                  title={`Click to ${surface.allowedRoles.includes(role) ? "remove" : "grant"} ${role} access`}
                >
                  {role}
                </button>
              ))}
            </div>

            {/* Token budget */}
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Max tokens: <strong className="text-slate-700 dark:text-slate-300">{surface.maxTokens}</strong>
              </span>
              <div className="flex-1">
                <Slider
                  min={200}
                  max={4000}
                  step={100}
                  value={[surface.maxTokens]}
                  onValueChange={([val]) => onTokensChange(surface.id, val ?? surface.maxTokens)}
                  className="h-1"
                />
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-shrink-0 flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">Enabled</span>
              <Switch
                checked={surface.enabled}
                onCheckedChange={(val) => onToggle(surface.id, val)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">Streaming</span>
              <Switch
                checked={surface.streamingEnabled}
                onCheckedChange={(val) => onStreamingToggle(surface.id, val)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AssistantControl() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("surfaces");
  const [showPreview, setShowPreview] = useState(false);

  // ── Data ─────────────────────────────────────────────────────────────────

  const { data: configResponse, isLoading, error } = useQuery<ConfigResponse>({
    queryKey: ["/api/ai-assistant/advisor/config"],
    queryFn: fetchAdvisorConfig,
    staleTime: 30_000,
  });

  const config = configResponse?.data;

  // ── Local mutable draft (avoids spamming API on every slider move) ─────────

  const [draft, setDraft] = useState<AdvisorConfigData | null>(null);
  const effective = draft ?? config ?? null;

  const saveMutation = useMutation<ConfigResponse, Error, Partial<AdvisorConfigData>>({
    mutationFn: patchAdvisorConfig,
    onSuccess: (res) => {
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/advisor/config"] });
      toast({ title: "Configuration saved", description: `Updated at ${new Date(res.data.updatedAt).toLocaleTimeString()}` });
    },
    onError: () => {
      toast({ title: "Save failed", variant: "destructive", description: "Could not persist configuration." });
    },
  });

  const resetMutation = useMutation<ConfigResponse, Error>({
    mutationFn: resetAdvisorConfig,
    onSuccess: () => {
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/advisor/config"] });
      toast({ title: "Configuration reset to defaults" });
    },
    onError: () => {
      toast({ title: "Reset failed", variant: "destructive" });
    },
  });

  // ── Mutators ─────────────────────────────────────────────────────────────

  const updateDraft = useCallback((updater: (prev: AdvisorConfigData) => AdvisorConfigData) => {
    setDraft(prev => {
      const base = prev ?? config;
      if (!base) return null;
      return updater(JSON.parse(JSON.stringify(base)) as AdvisorConfigData);
    });
  }, [config]);

  const handleGlobalToggle = useCallback((val: boolean) => {
    updateDraft(d => ({ ...d, globalEnabled: val }));
  }, [updateDraft]);

  const handleModelChange = useCallback((model: string) => {
    updateDraft(d => ({ ...d, model }));
  }, [updateDraft]);

  const handleSurfaceToggle = useCallback((id: string, val: boolean) => {
    updateDraft(d => ({
      ...d,
      surfaces: d.surfaces.map(s => s.id === id ? { ...s, enabled: val } : s),
    }));
  }, [updateDraft]);

  const handleStreamingToggle = useCallback((id: string, val: boolean) => {
    updateDraft(d => ({
      ...d,
      surfaces: d.surfaces.map(s => s.id === id ? { ...s, streamingEnabled: val } : s),
    }));
  }, [updateDraft]);

  const handleTokensChange = useCallback((id: string, tokens: number) => {
    updateDraft(d => ({
      ...d,
      surfaces: d.surfaces.map(s => s.id === id ? { ...s, maxTokens: tokens } : s),
    }));
  }, [updateDraft]);

  const handleRoleToggle = useCallback((id: string, role: string) => {
    updateDraft(d => ({
      ...d,
      surfaces: d.surfaces.map(s => {
        if (s.id !== id) return s;
        const roles = s.allowedRoles.includes(role)
          ? s.allowedRoles.filter(r => r !== role)
          : [...s.allowedRoles, role];
        return { ...s, allowedRoles: roles };
      }),
    }));
  }, [updateDraft]);

  const handleSave = useCallback(() => {
    if (!draft) return;
    saveMutation.mutate(draft);
  }, [draft, saveMutation]);

  // ── Loading / error ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
      </div>
    );
  }

  if (error || !effective) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Failed to load advisor configuration</p>
        <Button variant="outline" size="sm" onClick={() => void queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/advisor/config"] })}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
        </Button>
      </div>
    );
  }

  const hasDraft = draft !== null;
  const enabledSurfaces = effective.surfaces.filter(s => s.enabled).length;
  const totalSurfaces = effective.surfaces.length;

  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* ── Page header ── */}
      <div className="shrink-0 border-b border-slate-200/60 bg-white/80 px-6 py-4 backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20">
              <Sparkles className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-slate-900 dark:text-white">Intelligent Advisor Control Plane</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Govern COREVIA AI surfaces · {enabledSurfaces}/{totalSurfaces} surfaces active
              </p>
            </div>
          </div>

          {/* Global master switch */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 dark:border-slate-700/40 dark:bg-slate-800/60">
              <Power className={`h-4 w-4 ${effective.globalEnabled ? "text-emerald-500" : "text-red-500"}`} />
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                {effective.globalEnabled ? "Advisor Online" : "Advisor Offline"}
              </span>
              <Switch
                checked={effective.globalEnabled}
                onCheckedChange={handleGlobalToggle}
                className="scale-90"
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(v => !v)}
              className="gap-1.5 text-[12px]"
            >
              <Eye className="h-3.5 w-3.5" />
              {showPreview ? "Hide Preview" : "Live Preview"}
            </Button>

            {hasDraft && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="gap-1.5 bg-gradient-to-br from-cyan-600 to-blue-600 text-[12px] hover:from-cyan-500 hover:to-blue-500"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {saveMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="gap-1.5 text-[11px] text-slate-500 hover:text-red-500"
            >
              <RefreshCw className="h-3 w-3" />
              Reset
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-4 gap-3">
          {[
            { label: "Active Surfaces", value: `${enabledSurfaces}/${totalSurfaces}`, icon: Layers, color: "text-cyan-600" },
            { label: "Streaming Surfaces", value: `${effective.surfaces.filter(s => s.streamingEnabled).length}`, icon: Zap, color: "text-blue-600" },
            { label: "Active Model", value: AVAILABLE_MODELS.find(m => m.value === effective.model)?.label?.split(" ").slice(0, 2).join(" ") ?? effective.model, icon: Cpu, color: "text-violet-600" },
            { label: "System Status", value: effective.globalEnabled ? "Online" : "Offline", icon: Activity, color: effective.globalEnabled ? "text-emerald-600" : "text-red-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-xl border border-slate-200/50 bg-white/60 px-3 py-2 dark:border-slate-700/40 dark:bg-slate-800/40">
              <Icon className={`h-4 w-4 flex-shrink-0 ${color}`} />
              <div className="min-w-0">
                <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{label}</p>
                <p className="truncate text-[12px] font-semibold text-slate-700 dark:text-slate-300">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Content + preview ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Main content */}
        <div className="min-w-0 flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
            <TabsList className="mx-6 mt-4 h-9 w-fit shrink-0 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-800/60">
              <TabsTrigger value="surfaces" className="rounded-lg px-4 py-1.5 text-[12px]">
                <Layers className="mr-1.5 h-3.5 w-3.5" />Surfaces
              </TabsTrigger>
              <TabsTrigger value="access" className="rounded-lg px-4 py-1.5 text-[12px]">
                <Shield className="mr-1.5 h-3.5 w-3.5" />Access Control
              </TabsTrigger>
              <TabsTrigger value="engine" className="rounded-lg px-4 py-1.5 text-[12px]">
                <Cpu className="mr-1.5 h-3.5 w-3.5" />Engine Config
              </TabsTrigger>
            </TabsList>

            {/* ── Surfaces tab ── */}
            <TabsContent value="surfaces" className="flex-1 overflow-auto px-6 py-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">AI Surface Registry</h2>
                  <p className="text-[11px] text-slate-500">Enable or disable the advisor on specific surfaces, configure role gates and token budgets.</p>
                </div>
              </div>
              <div className="space-y-3">
                {effective.surfaces.map((surface) => (
                  <SurfaceCard
                    key={surface.id}
                    surface={surface}
                    globalEnabled={effective.globalEnabled}
                    onToggle={handleSurfaceToggle}
                    onStreamingToggle={handleStreamingToggle}
                    onTokensChange={handleTokensChange}
                    onRoleToggle={handleRoleToggle}
                  />
                ))}
              </div>
            </TabsContent>

            {/* ── Access tab ── */}
            <TabsContent value="access" className="flex-1 overflow-auto px-6 py-4">
              <div className="mb-4">
                <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Role-Based Access Control</h2>
                <p className="text-[11px] text-slate-500">Overview of which roles can access each AI surface. Click role badges in the Surfaces tab to adjust.</p>
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-slate-200/60 dark:border-slate-700/40">
                          <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Surface</th>
                          {ALL_ROLES.map(role => (
                            <th key={role} className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300 capitalize">{role}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/40 dark:divide-slate-700/30">
                        {effective.surfaces.map((surface) => (
                          <tr key={surface.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {SurfaceIcon(surface.id)}
                                <span className="font-medium text-slate-700 dark:text-slate-300">{surface.label}</span>
                                {!surface.enabled && <Badge variant="outline" className="border-slate-300 px-1 py-0 text-[9px] text-slate-500">disabled</Badge>}
                              </div>
                            </td>
                            {ALL_ROLES.map(role => (
                              <td key={role} className="px-4 py-3 text-center">
                                {surface.allowedRoles.includes(role) ? (
                                  <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600">—</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Engine tab ── */}
            <TabsContent value="engine" className="flex-1 overflow-auto px-6 py-4">
              <div className="mb-4">
                <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Engine Configuration</h2>
                <p className="text-[11px] text-slate-500">Select the active language model and configure global defaults.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Model selector */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <Cpu className="h-4 w-4 text-violet-500" /> Language Model
                    </CardTitle>
                    <CardDescription className="text-[11px]">The primary LLM used across all advisor surfaces.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Select value={effective.model} onValueChange={handleModelChange}>
                      <SelectTrigger className="h-9 text-[12px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_MODELS.map(m => (
                          <SelectItem key={m.value} value={m.value} className="text-[12px]">
                            <span className="font-medium">{m.label}</span>
                            <span className="ml-2 text-slate-400">· {m.vendor}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-2 text-[10px] text-slate-500">
                      Changes apply to all new conversations after saving.
                    </p>
                  </CardContent>
                </Card>

                {/* System info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <Settings2 className="h-4 w-4 text-slate-500" /> System Status
                    </CardTitle>
                    <CardDescription className="text-[11px]">Current runtime state of the advisor engine.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      { label: "Global State", value: effective.globalEnabled ? "Online" : "Offline", ok: effective.globalEnabled },
                      { label: "Active Surfaces", value: `${enabledSurfaces} of ${totalSurfaces}`, ok: enabledSurfaces > 0 },
                      { label: "Streaming", value: `${effective.surfaces.filter(s => s.streamingEnabled).length} surfaces`, ok: true },
                      { label: "Last Updated", value: effective.updatedAt ? new Date(effective.updatedAt).toLocaleString() : "—", ok: true },
                    ].map(({ label, value, ok }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">{label}</span>
                        <div className="flex items-center gap-1.5">
                          <Circle className={`h-1.5 w-1.5 fill-current ${ok ? "text-emerald-500" : "text-red-400"}`} />
                          <span className={`text-[11px] font-medium ${ok ? "text-slate-700 dark:text-slate-300" : "text-red-500"}`}>{value}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Per-surface token budget reference */}
                <Card className="md:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <Sliders className="h-4 w-4 text-cyan-500" /> Token Budget Summary
                    </CardTitle>
                    <CardDescription className="text-[11px]">Configure per-surface token limits in the Surfaces tab. Summary shown here.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {effective.surfaces.map(s => (
                        <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200/60 px-3 py-2 dark:border-slate-700/40">
                          <span className="text-[11px] text-slate-600 dark:text-slate-400">{s.label}</span>
                          <Badge variant="outline" className="text-[10px]">{s.maxTokens} tk</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Live advisor preview panel ── */}
        {showPreview && (
          <div className="w-[360px] flex-shrink-0 border-l border-slate-200/60 dark:border-slate-700/40">
            <div className="border-b border-slate-200/40 px-4 py-2.5 dark:border-slate-700/30">
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                <Eye className="mr-1.5 inline h-3 w-3" />Live Advisor Preview
              </p>
            </div>
            <div className="h-[calc(100%-40px)]">
              <CoveriaAdvisor
                context="general"
                mode="embedded"
                compact
                title="COREVIA Advisor Preview"
                subtitle="Brain Console preview mode"
                chips={["What can you do?", "System Overview"]}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AssistantControl;
