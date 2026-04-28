import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronRight, Layers, Plus } from "lucide-react";
import { toggleAgent, updateRoutingOverride, type EnginePlugin } from "@/api/brain";
import type { Agent } from "@shared/contracts/brain";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface RoutingOverride {
  overrideId: string;
  scope: "GLOBAL" | "USE_CASE" | "SPINE";
  scopeRef?: string | null;
  forcedEngineKind?: "SOVEREIGN_INTERNAL" | "EXTERNAL_HYBRID" | "DISTILLATION" | null;
  forcedEngineId?: string | null;
  enabled: boolean;
  reason?: string | null;
}

export function AgentToggleRow({ agent }: Readonly<{ agent: Agent }>) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const enabled = agent.config?.enabled !== false;
  const statusLabel = agent.status === "active" ? "ACTIVE" : "INACTIVE";
  const statusClass = agent.status === "active"
    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
    : "bg-slate-500/10 text-slate-600 border-slate-500/20";
  const enabledLabel = enabled ? "ENABLED" : "DISABLED";
  const enabledClass = enabled
    ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
    : "bg-rose-500/10 text-rose-600 border-rose-500/20";
  const capabilityBadges = (agent.capabilities || []).slice(0, 3);
  const classification = agent.requiredClassification ? agent.requiredClassification.toUpperCase() : null;
  const mutation = useMutation({
    mutationFn: (nextEnabled: boolean) => toggleAgent(agent.id, nextEnabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/brain/agents"] });
    },
    onError: () => {
      toast({ title: t('brain.intelligence.agentUpdateFailed'), variant: "destructive" });
    },
  });

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold truncate">{agent.name}</p>
          <Badge className={`text-[9px] ${statusClass}`}>{statusLabel}</Badge>
          <Badge className={`text-[9px] ${enabledClass}`}>{enabledLabel}</Badge>
        </div>
        <p className="text-[10px] text-muted-foreground truncate">{agent.description || agent.id}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {capabilityBadges.map(cap => (
            <Badge key={cap} variant="outline" className="text-[9px]">{cap}</Badge>
          ))}
          {classification && (
            <Badge variant="outline" className="text-[9px]">Class: {classification}</Badge>
          )}
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={(v) => mutation.mutate(v)} />
    </div>
  );
}

export function RoutingOverridesPanel({ overrides, engines }: Readonly<{ overrides: RoutingOverride[]; engines: EnginePlugin[] }>) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RoutingOverride>({
    overrideId: "",
    scope: "GLOBAL",
    scopeRef: "",
    forcedEngineKind: null,
    forcedEngineId: null,
    enabled: true,
    reason: "",
  });

  const mutation = useMutation({
    mutationFn: () => updateRoutingOverride(form.overrideId, {
      scope: form.scope,
      scopeRef: form.scope === "GLOBAL" ? null : (form.scopeRef || null),
      forcedEngineKind: form.forcedEngineKind || null,
      forcedEngineId: form.forcedEngineId || null,
      enabled: form.enabled,
      reason: form.reason || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/brain/routing-overrides"] });
      toast({ title: t('brain.intelligence.overrides.saved') });
      setOpen(false);
    },
    onError: () => {
      toast({ title: t('brain.intelligence.overrides.saveFailed'), variant: "destructive" });
    },
  });

  function openNew() {
    setForm({
      overrideId: "",
      scope: "GLOBAL",
      scopeRef: "",
      forcedEngineKind: null,
      forcedEngineId: null,
      enabled: true,
      reason: "",
    });
    setOpen(true);
  }

  function openEdit(override: RoutingOverride) {
    setForm({
      overrideId: override.overrideId,
      scope: override.scope,
      scopeRef: override.scopeRef || "",
      forcedEngineKind: override.forcedEngineKind || null,
      forcedEngineId: override.forcedEngineId || null,
      enabled: override.enabled,
      reason: override.reason || "",
    });
    setOpen(true);
  }

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            {t('brain.intelligence.overrides.title')}
          </CardTitle>
          <Badge variant="outline" className="text-[10px] font-mono">{overrides.length} {t('brain.intelligence.smartPanel.active')}</Badge>
          <div className="ml-auto">
            <Button size="sm" variant="outline" onClick={openNew} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> {t('brain.intelligence.overrides.newOverride')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {overrides.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {t('brain.intelligence.overrides.noOverrides')}
          </div>
        ) : (
          <div className="space-y-2">
            {overrides.map((o) => (
              <button
                key={o.overrideId}
                onClick={() => openEdit(o)}
                className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] font-mono">{o.scope}</Badge>
                    <span className="text-xs font-semibold truncate">{o.overrideId}</span>
                    {o.enabled ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px]">ENABLED</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px]">DISABLED</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {o.scope === "GLOBAL" ? "Global" : o.scopeRef || "Scope reference"} · {o.forcedEngineKind || "Auto"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </button>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" /> {t('brain.intelligence.overrides.dialogTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t('brain.intelligence.overrides.overrideId')}</Label>
              <Input value={form.overrideId} onChange={(e) => setForm({ ...form, overrideId: e.target.value })} className="font-mono text-sm" placeholder="OVR-DEFAULT" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t('brain.intelligence.overrides.scope')}</Label>
                <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v as RoutingOverride["scope"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GLOBAL">GLOBAL</SelectItem>
                    <SelectItem value="USE_CASE">USE_CASE</SelectItem>
                    <SelectItem value="SPINE">SPINE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t('brain.intelligence.overrides.scopeRef')}</Label>
                <Input value={form.scopeRef || ""} onChange={(e) => setForm({ ...form, scopeRef: e.target.value })} placeholder="use_case_id or spine_id" className="font-mono text-xs" disabled={form.scope === "GLOBAL"} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t('brain.intelligence.overrides.forcedEngineKind')}</Label>
                <Select value={form.forcedEngineKind || ""} onValueChange={(v) => setForm({ ...form, forcedEngineKind: (v === "__auto__" ? null : v) as RoutingOverride["forcedEngineKind"] })}>
                  <SelectTrigger><SelectValue placeholder="Auto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">Auto</SelectItem>
                    <SelectItem value="SOVEREIGN_INTERNAL">SOVEREIGN_INTERNAL</SelectItem>
                    <SelectItem value="EXTERNAL_HYBRID">EXTERNAL_HYBRID</SelectItem>
                    <SelectItem value="DISTILLATION">DISTILLATION</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t('brain.intelligence.overrides.forcedEngineId')}</Label>
                <Select value={form.forcedEngineId || ""} onValueChange={(v) => setForm({ ...form, forcedEngineId: v === "__any__" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Any</SelectItem>
                    {engines.map((e) => (
                      <SelectItem key={e.enginePluginId} value={e.enginePluginId}>{e.name} ({e.enginePluginId})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t('brain.intelligence.overrides.reason')}</Label>
              <Input value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Regulatory requirement" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              <span className="text-sm font-semibold">{form.enabled ? t('brain.intelligence.enabled') : t('brain.intelligence.disabled')}</span>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>{t('app.cancel')}</Button>
            <Button size="sm" onClick={() => mutation.mutate()} disabled={!form.overrideId || mutation.isPending}
              >
              {mutation.isPending ? t('brain.intelligence.saving') : t('brain.intelligence.overrides.saveOverride')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
