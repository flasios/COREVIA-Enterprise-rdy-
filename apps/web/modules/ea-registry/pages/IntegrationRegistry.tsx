import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, Pencil, Trash2,
  ArrowLeftRight, ArrowRight, Zap, AlertTriangle, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VerificationBadge, ProvenanceIndicator, VerificationActions, DocumentPanel, DocumentUploadExtractDialog } from "../components";
import { Upload, Sparkles as SparklesIcon } from "lucide-react";

type EaIntegration = {
  id: string;
  name: string;
  sourceSystem: string;
  targetSystem: string;
  pattern: string;
  protocol: string;
  dataFlow: string;
  frequency: string;
  criticality: string;
  status: string;
  sla: string | null;
  owner: string | null;
  description: string | null;
  notes: string | null;
  sourceType: string | null;
  sourceDemandId: string | null;
  verificationStatus: string | null;
  confidenceScore: number | null;
  createdAt: string;
  updatedAt: string;
};

const EMPTY_FORM = {
  name: "", sourceSystem: "", targetSystem: "", pattern: "api", protocol: "REST",
  dataFlow: "unidirectional", frequency: "real_time", criticality: "medium",
  status: "active", sla: "", owner: "", description: "", notes: "",
};

const PATTERNS = [
  { value: "api", label: "API" },
  { value: "event", label: "Event-Driven" },
  { value: "batch", label: "Batch/ETL" },
  { value: "file", label: "File Transfer" },
  { value: "messaging", label: "Messaging" },
  { value: "streaming", label: "Streaming" },
  { value: "database", label: "Database Link" },
  { value: "webhook", label: "Webhook" },
];

const PROTOCOLS = [
  { value: "REST", label: "REST" },
  { value: "SOAP", label: "SOAP" },
  { value: "GraphQL", label: "GraphQL" },
  { value: "gRPC", label: "gRPC" },
  { value: "AMQP", label: "AMQP" },
  { value: "Kafka", label: "Kafka" },
  { value: "SFTP", label: "SFTP" },
  { value: "MQTT", label: "MQTT" },
  { value: "WebSocket", label: "WebSocket" },
  { value: "JDBC", label: "JDBC/ODBC" },
];

const DATA_FLOWS = [
  { value: "unidirectional", label: "Unidirectional", icon: "→" },
  { value: "bidirectional", label: "Bidirectional", icon: "↔" },
  { value: "broadcast", label: "Broadcast", icon: "⇒" },
];

const FREQUENCIES = [
  { value: "real_time", label: "Real-Time" },
  { value: "near_real_time", label: "Near Real-Time" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "on_demand", label: "On Demand" },
];

const criticalityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  planned: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  deprecated: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  inactive: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

function flowIcon(flow: string) {
  if (flow === "bidirectional") return <ArrowLeftRight className="h-5 w-5 text-blue-500" />;
  if (flow === "broadcast") return <Zap className="h-5 w-5 text-violet-500" />;
  return <ArrowRight className="h-5 w-5 text-emerald-500" />;
}

export default function IntegrationRegistry() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [extractOpen, setExtractOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const QK = ["/api/ea/registry/integrations"];

  const { data, isLoading } = useQuery({
    queryKey: QK,
    queryFn: async () => { const r = await apiRequest("GET", "/api/ea/registry/integrations"); return r.json(); },
  });
  const integrations: EaIntegration[] = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => { const r = await apiRequest("POST", "/api/ea/registry/integrations", body); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: QK }); toast({ title: t('ea.integrationRegistered') }); closeDialog(); },
    onError: () => toast({ title: t('ea.failedToSave'), variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => { const r = await apiRequest("PATCH", `/api/ea/registry/integrations/${id}`, body); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: QK }); toast({ title: t('ea.integrationUpdated') }); closeDialog(); },
    onError: () => toast({ title: t('ea.failedToUpdate'), variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("DELETE", `/api/ea/registry/integrations/${id}`); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: QK }); toast({ title: t('ea.integrationRemoved') }); },
    onError: () => toast({ title: t('ea.failedToDelete'), variant: "destructive" }),
  });

  const filtered = integrations.filter((i) =>
    [i.name, i.sourceSystem, i.targetSystem, i.pattern, i.protocol, i.owner].some(
      (f) => f && f.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setForm(EMPTY_FORM); };
  const openCreate = () => { setForm(EMPTY_FORM); setEditingId(null); setDialogOpen(true); };
  const openEdit = (ig: EaIntegration) => {
    setForm({
      name: ig.name, sourceSystem: ig.sourceSystem, targetSystem: ig.targetSystem,
      pattern: ig.pattern, protocol: ig.protocol, dataFlow: ig.dataFlow,
      frequency: ig.frequency, criticality: ig.criticality, status: ig.status,
      sla: ig.sla || "", owner: ig.owner || "",
      description: ig.description || "", notes: ig.notes || "",
    });
    setEditingId(ig.id); setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {
      name: form.name, sourceSystem: form.sourceSystem, targetSystem: form.targetSystem,
      pattern: form.pattern, protocol: form.protocol, dataFlow: form.dataFlow,
      frequency: form.frequency, criticality: form.criticality, status: form.status,
      sourceType: "manual", verificationStatus: "verified",
    };
    if (form.sla) body.sla = form.sla;
    if (form.owner) body.owner = form.owner;
    if (form.description) body.description = form.description;
    if (form.notes) body.notes = form.notes;
    if (editingId) { updateMutation.mutate({ id: editingId, body }); } else { createMutation.mutate(body); }
  };

  const setField = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const pendingCount = integrations.filter(i => i.verificationStatus === "pending_verification").length;
  const criticalCount = integrations.filter(i => i.criticality === "critical").length;

  return (
    <div className="h-screen bg-gradient-to-b from-slate-50 via-stone-50/50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden">
      <div className="w-full max-w-none px-4 sm:px-6 relative z-10 h-full flex flex-col">
        <div className="flex items-end justify-between flex-shrink-0 mb-4 gap-4 pt-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white"><Activity className="h-5 w-5" /></div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{t('ea.integrationRegistry')}</h1>
                <p className="text-xs text-muted-foreground">
                  {integrations.length} {t('ea.integrationFlows')}
                  {criticalCount > 0 && <span className="ml-2 text-red-500 dark:text-red-400">• {criticalCount} critical</span>}
                  {pendingCount > 0 && <span className="ml-2 text-amber-600 dark:text-amber-400">— {pendingCount} pending verification</span>}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/30 dark:hover:bg-teal-950/50 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300" onClick={() => setExtractOpen(true)}><Upload className="h-4 w-4" />Upload & Extract<SparklesIcon className="h-3 w-3" /></Button>
            <Button size="sm" className="gap-1.5" onClick={openCreate}><Plus className="h-4 w-4" />{t('ea.registerIntegration')}</Button>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('ea.searchIntegrations')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-teal-300 dark:via-teal-600 to-transparent mb-4" />

        <div className="flex-1 min-h-0 overflow-y-auto pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-xl border border-slate-200/50 dark:border-slate-700/50"><div className="text-center space-y-3"><div className="h-8 w-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" /><p className="text-sm text-muted-foreground">{t('app.loading')}</p></div></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-xl border border-slate-200/50 dark:border-slate-700/50 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{t('ea.noIntegrationsYet')}</p>
              <p className="text-sm mt-1 mb-4">{t('ea.noIntegrationsYetDesc')}</p>
              <Button size="sm" className="gap-1.5" onClick={openCreate}><Plus className="h-4 w-4" />{t('ea.registerFirstIntegration')}</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((ig) => (
                <div
                  key={ig.id}
                  className={`bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm p-4 group hover:shadow-md transition-all ${
                    ig.verificationStatus === "pending_verification" ? "border-l-4 border-l-amber-400" :
                    ig.verificationStatus === "rejected" ? "border-l-4 border-l-red-400" : ""
                  }`}
                >
                  {/* Header: name + actions */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">{ig.name}</h3>
                        <Badge className={`text-xs ${criticalityColors[ig.criticality] || criticalityColors.medium}`}>{ig.criticality}</Badge>
                        <Badge className={`text-xs ${statusColors[ig.status] || statusColors.active}`}>{ig.status}</Badge>
                        <VerificationBadge status={ig.verificationStatus} sourceType={ig.sourceType} confidenceScore={ig.confidenceScore} />
                      </div>
                      <ProvenanceIndicator sourceType={ig.sourceType} sourceDemandId={ig.sourceDemandId} confidenceScore={ig.confidenceScore} />
                    </div>
                    <div className="flex items-center gap-1">
                      <VerificationActions registryType="integrations" entryId={ig.id} currentStatus={ig.verificationStatus} queryKey={QK} />
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(ig)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => deleteMutation.mutate(ig.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </div>

                  {/* Flow visualization */}
                  <div className="flex items-center gap-3 mb-3 p-3 bg-slate-50/80 dark:bg-slate-900/50 rounded-lg">
                    <div className="flex-1 text-center">
                      <div className="text-xs text-muted-foreground mb-0.5">{t('ea.source')}</div>
                      <div className="font-medium text-sm text-slate-700 dark:text-slate-200 truncate">{ig.sourceSystem}</div>
                    </div>
                    <div className="flex flex-col items-center shrink-0 px-2">
                      {flowIcon(ig.dataFlow)}
                      <span className="text-[10px] text-muted-foreground mt-0.5">{ig.protocol}</span>
                    </div>
                    <div className="flex-1 text-center">
                      <div className="text-xs text-muted-foreground mb-0.5">{t('ea.target')}</div>
                      <div className="font-medium text-sm text-slate-700 dark:text-slate-200 truncate">{ig.targetSystem}</div>
                    </div>
                  </div>

                  {/* Metadata row */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Badge variant="outline" className="text-xs">{PATTERNS.find((p) => p.value === ig.pattern)?.label || ig.pattern}</Badge>
                    <Badge variant="outline" className="text-xs">{FREQUENCIES.find((f) => f.value === ig.frequency)?.label || ig.frequency}</Badge>
                    {ig.sla && <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />SLA: {ig.sla}</span>}
                    {ig.owner && <span>{t('ea.ownerLabel')}: {ig.owner}</span>}
                  </div>

                  {ig.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{ig.description}</p>}

                  {/* Document panel */}
                  <DocumentPanel registryType="integrations" entryId={ig.id} entryName={ig.name} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? t('ea.editIntegration') : t('ea.registerIntegration')}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>{t('ea.formIntegrationName')} *</Label><Input value={form.name} onChange={(e) => setField("name", e.target.value)} required placeholder={t('ea.formIntegrationNamePlaceholder')} /></div>
              <div><Label>{t('ea.formSourceSystem')} *</Label><Input value={form.sourceSystem} onChange={(e) => setField("sourceSystem", e.target.value)} required placeholder={t('ea.formSourceSystemPlaceholder')} /></div>
              <div><Label>{t('ea.formTargetSystem')} *</Label><Input value={form.targetSystem} onChange={(e) => setField("targetSystem", e.target.value)} required placeholder={t('ea.formTargetSystemPlaceholder')} /></div>
              <div><Label>{t('ea.formPattern')} *</Label>
                <Select value={form.pattern} onValueChange={(v) => setField("pattern", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PATTERNS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t('ea.formProtocol')} *</Label>
                <Select value={form.protocol} onValueChange={(v) => setField("protocol", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PROTOCOLS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t('ea.formDataFlow')} *</Label>
                <Select value={form.dataFlow} onValueChange={(v) => setField("dataFlow", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DATA_FLOWS.map((d) => <SelectItem key={d.value} value={d.value}>{d.icon} {d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t('ea.formFrequency')} *</Label>
                <Select value={form.frequency} onValueChange={(v) => setField("frequency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t('ea.formCriticality')} *</Label>
                <Select value={form.criticality} onValueChange={(v) => setField("criticality", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">{t('ea.formCritical')}</SelectItem>
                    <SelectItem value="high">{t('ea.formHigh')}</SelectItem>
                    <SelectItem value="medium">{t('ea.formMedium')}</SelectItem>
                    <SelectItem value="low">{t('ea.formLow')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t('ea.formStatus')} *</Label>
                <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('ea.formActive')}</SelectItem>
                    <SelectItem value="planned">{t('ea.formPlanned')}</SelectItem>
                    <SelectItem value="deprecated">{t('ea.formDeprecated')}</SelectItem>
                    <SelectItem value="inactive">{t('ea.formInactive')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t('ea.formSla')}</Label><Input value={form.sla} onChange={(e) => setField("sla", e.target.value)} placeholder={t('ea.formSlaPlaceholder')} /></div>
              <div><Label>{t('ea.formOwner')}</Label><Input value={form.owner} onChange={(e) => setField("owner", e.target.value)} placeholder={t('ea.formIntOwnerPlaceholder')} /></div>
              <div className="col-span-2"><Label>{t('ea.formDescription')}</Label><Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder={t('ea.formIntDescriptionPlaceholder')} rows={2} /></div>
              <div className="col-span-2"><Label>{t('ea.formNotes')}</Label><Textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder={t('ea.formIntNotesPlaceholder')} rows={2} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>{t('app.cancel')}</Button>
              <Button type="submit" disabled={!form.name || !form.sourceSystem || !form.targetSystem || createMutation.isPending || updateMutation.isPending}>{editingId ? t('app.update') : t('app.register')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DocumentUploadExtractDialog
        open={extractOpen}
        onOpenChange={setExtractOpen}
        registryType="integrations"
        queryKey={QK}
      />
    </div>
  );
}
