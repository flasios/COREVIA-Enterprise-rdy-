import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, Pencil, Trash2,
  Server, Layers, Shield, Code, Database, Globe, Cpu, Lock, Settings
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

type EaTechnologyStandard = {
  id: string;
  name: string;
  layer: string;
  category: string | null;
  vendor: string | null;
  version: string | null;
  status: string;
  lifecycle: string;
  owner: string | null;
  supportExpiry: string | null;
  replacementPlan: string | null;
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
  name: "", layer: "application", category: "", vendor: "", version: "",
  status: "approved", lifecycle: "active", owner: "", supportExpiry: "",
  replacementPlan: "", description: "", notes: "",
};

const LAYERS = [
  { value: "presentation", labelKey: "layerPresentation", icon: Globe, color: "text-sky-500", bg: "bg-sky-50 dark:bg-sky-950/30" },
  { value: "application", labelKey: "layerApplication", icon: Code, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
  { value: "integration", labelKey: "layerIntegration", icon: Settings, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30" },
  { value: "data", labelKey: "layerData", icon: Database, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
  { value: "infrastructure", labelKey: "layerInfrastructure", icon: Cpu, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  { value: "security", labelKey: "layerSecurity", icon: Shield, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30" },
];

const statusColors: Record<string, string> = {
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  emerging: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  under_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  deprecated: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  prohibited: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const lifecycleColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  planned: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  retiring: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "end-of-life": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function TechnologyStandards() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [extractOpen, setExtractOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const QK = ["/api/ea/registry/technology-standards"];

  const { data, isLoading } = useQuery({
    queryKey: QK,
    queryFn: async () => { const r = await apiRequest("GET", "/api/ea/registry/technology-standards"); return r.json(); },
  });
  const standards: EaTechnologyStandard[] = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => { const r = await apiRequest("POST", "/api/ea/registry/technology-standards", body); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: QK }); toast({ title: t('ea.technologyStandardRegistered') }); closeDialog(); },
    onError: () => toast({ title: t('ea.failedToSave'), variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => { const r = await apiRequest("PATCH", `/api/ea/registry/technology-standards/${id}`, body); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: QK }); toast({ title: t('ea.technologyStandardUpdated') }); closeDialog(); },
    onError: () => toast({ title: t('ea.failedToUpdate'), variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("DELETE", `/api/ea/registry/technology-standards/${id}`); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: QK }); toast({ title: t('ea.technologyStandardRemoved') }); },
    onError: () => toast({ title: t('ea.failedToDelete'), variant: "destructive" }),
  });

  const filtered = standards.filter((s) =>
    [s.name, s.vendor, s.category, s.owner, s.layer].some((f) => f && f.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setForm(EMPTY_FORM); };
  const openCreate = () => { setForm(EMPTY_FORM); setEditingId(null); setDialogOpen(true); };
  const openEdit = (ts: EaTechnologyStandard) => {
    setForm({
      name: ts.name, layer: ts.layer, category: ts.category || "",
      vendor: ts.vendor || "", version: ts.version || "",
      status: ts.status, lifecycle: ts.lifecycle, owner: ts.owner || "",
      supportExpiry: ts.supportExpiry || "", replacementPlan: ts.replacementPlan || "",
      description: ts.description || "", notes: ts.notes || "",
    });
    setEditingId(ts.id); setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {
      name: form.name, layer: form.layer, status: form.status, lifecycle: form.lifecycle,
      sourceType: "manual", verificationStatus: "verified",
    };
    if (form.category) body.category = form.category;
    if (form.vendor) body.vendor = form.vendor;
    if (form.version) body.version = form.version;
    if (form.owner) body.owner = form.owner;
    if (form.supportExpiry) body.supportExpiry = form.supportExpiry;
    if (form.replacementPlan) body.replacementPlan = form.replacementPlan;
    if (form.description) body.description = form.description;
    if (form.notes) body.notes = form.notes;
    if (editingId) { updateMutation.mutate({ id: editingId, body }); } else { createMutation.mutate(body); }
  };

  const setField = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const layerGroups = LAYERS.map((layer) => ({
    ...layer,
    items: filtered.filter((s) => s.layer === layer.value),
  })).filter((g) => g.items.length > 0);

  const statusCounts = standards.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const pendingCount = standards.filter(s => s.verificationStatus === "pending_verification").length;

  return (
    <div className="h-screen bg-gradient-to-b from-slate-50 via-stone-50/50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden">
      <div className="w-full max-w-none px-4 sm:px-6 relative z-10 h-full flex flex-col">
        <div className="flex items-end justify-between flex-shrink-0 mb-4 gap-4 pt-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white"><Layers className="h-5 w-5" /></div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{t('ea.technologyStandardsRegistry')}</h1>
                <p className="text-xs text-muted-foreground">
                  {standards.length} {t('ea.standardsAcrossLayers', { layers: new Set(standards.map((s) => s.layer)).size })}
                  {pendingCount > 0 && <span className="ml-2 text-amber-600 dark:text-amber-400">— {pendingCount} pending verification</span>}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-1.5 text-xs">
              {Object.entries(statusCounts).map(([status, count]) => (
                <Badge key={status} className={statusColors[status] || statusColors.approved}>{status}: {count}</Badge>
              ))}
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/30 dark:hover:bg-violet-950/50 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300" onClick={() => setExtractOpen(true)}><Upload className="h-4 w-4" />Upload & Extract<SparklesIcon className="h-3 w-3" /></Button>
            <Button size="sm" className="gap-1.5" onClick={openCreate}><Plus className="h-4 w-4" />{t('ea.registerStandard')}</Button>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('ea.searchStandards')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-violet-300 dark:via-violet-600 to-transparent mb-4" />

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-xl border border-slate-200/50 dark:border-slate-700/50"><div className="text-center space-y-3"><div className="h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" /><p className="text-sm text-muted-foreground">{t('app.loading')}</p></div></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-xl border border-slate-200/50 dark:border-slate-700/50 text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{t('ea.noStandardsYet')}</p>
              <p className="text-sm mt-1 mb-4">{t('ea.noStandardsYetDesc')}</p>
              <Button size="sm" className="gap-1.5" onClick={openCreate}><Plus className="h-4 w-4" />{t('ea.registerFirstStandard')}</Button>
            </div>
          ) : (
            layerGroups.map((group) => {
              const LayerIcon = group.icon;
              return (
                <div key={group.value} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden">
                  <div className={`px-4 py-2.5 flex items-center gap-2 ${group.bg} border-b border-slate-200/50 dark:border-slate-700/50`}>
                    <LayerIcon className={`h-4 w-4 ${group.color}`} />
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t(`ea.${group.labelKey}`)} {t('ea.layerSuffix')}</h2>
                    <Badge variant="outline" className="text-xs ml-auto">{group.items.length}</Badge>
                  </div>
                  <div className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
                    {group.items.map((ts) => (
                      <div key={ts.id} className={`p-4 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors group ${
                        ts.verificationStatus === "pending_verification" ? "border-l-2 border-l-amber-400" :
                        ts.verificationStatus === "rejected" ? "border-l-2 border-l-red-400" : ""
                      }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{ts.name}</h3>
                              {ts.version && <span className="text-xs text-muted-foreground">{ts.version}</span>}
                              <Badge className={`text-xs ${statusColors[ts.status] || statusColors.approved}`}>{ts.status}</Badge>
                              <Badge className={`text-xs ${lifecycleColors[ts.lifecycle] || lifecycleColors.active}`}>{ts.lifecycle}</Badge>
                              {ts.category && <Badge variant="outline" className="text-xs">{ts.category}</Badge>}
                              <VerificationBadge status={ts.verificationStatus} sourceType={ts.sourceType} confidenceScore={ts.confidenceScore} />
                              <ProvenanceIndicator sourceType={ts.sourceType} sourceDemandId={ts.sourceDemandId} confidenceScore={ts.confidenceScore} />
                            </div>
                            {ts.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{ts.description}</p>}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                              {ts.vendor && <span className="flex items-center gap-1"><Server className="h-3 w-3" />{ts.vendor}</span>}
                              {ts.owner && <span className="flex items-center gap-1">{t('ea.ownerLabel')}: {ts.owner}</span>}
                              {ts.supportExpiry && <span className="flex items-center gap-1"><Lock className="h-3 w-3" />{t('ea.supportUntil')} {ts.supportExpiry}</span>}
                              {ts.replacementPlan && <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">{t('ea.replacePlan')} {ts.replacementPlan}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <VerificationActions registryType="technology-standards" entryId={ts.id} currentStatus={ts.verificationStatus} queryKey={QK} />
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(ts)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => deleteMutation.mutate(ts.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <DocumentPanel registryType="technology-standards" entryId={ts.id} entryName={ts.name} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? t('ea.editTechnologyStandard') : t('ea.registerTechnologyStandard')}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>{t('ea.formStandardName')} *</Label><Input value={form.name} onChange={(e) => setField("name", e.target.value)} required placeholder={t('ea.formStandardNamePlaceholder')} /></div>
              <div><Label>{t('ea.formLayer')} *</Label>
                <Select value={form.layer} onValueChange={(v) => setField("layer", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LAYERS.map((l) => <SelectItem key={l.value} value={l.value}>{t(`ea.${l.labelKey}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t('ea.formCategory')}</Label><Input value={form.category} onChange={(e) => setField("category", e.target.value)} placeholder={t('ea.formCategoryPlaceholder')} /></div>
              <div><Label>{t('ea.formVendor')}</Label><Input value={form.vendor} onChange={(e) => setField("vendor", e.target.value)} placeholder={t('ea.formTechVendorPlaceholder')} /></div>
              <div><Label>{t('ea.formVersion')}</Label><Input value={form.version} onChange={(e) => setField("version", e.target.value)} placeholder={t('ea.formTechVersionPlaceholder')} /></div>
              <div><Label>{t('ea.formApprovalStatus')} *</Label>
                <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">{t('ea.formApproved')}</SelectItem>
                    <SelectItem value="emerging">{t('ea.formEmerging')}</SelectItem>
                    <SelectItem value="deprecated">{t('ea.formDeprecated')}</SelectItem>
                    <SelectItem value="prohibited">{t('ea.formProhibited')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t('ea.formLifecycle')} *</Label>
                <Select value={form.lifecycle} onValueChange={(v) => setField("lifecycle", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('ea.formActive')}</SelectItem>
                    <SelectItem value="planned">{t('ea.formPlanned')}</SelectItem>
                    <SelectItem value="retiring">{t('ea.formRetiring')}</SelectItem>
                    <SelectItem value="end-of-life">{t('ea.formEndOfLife')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t('ea.formOwner')}</Label><Input value={form.owner} onChange={(e) => setField("owner", e.target.value)} placeholder={t('ea.formTechOwnerPlaceholder')} /></div>
              <div><Label>{t('ea.formSupportExpiry')}</Label><Input value={form.supportExpiry} onChange={(e) => setField("supportExpiry", e.target.value)} placeholder={t('ea.formSupportExpiryPlaceholder')} /></div>
              <div><Label>{t('ea.formReplacementPlan')}</Label><Input value={form.replacementPlan} onChange={(e) => setField("replacementPlan", e.target.value)} placeholder={t('ea.formReplacementPlanPlaceholder')} /></div>
              <div className="col-span-2"><Label>{t('ea.formDescription')}</Label><Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder={t('ea.formTechDescriptionPlaceholder')} rows={2} /></div>
              <div className="col-span-2"><Label>{t('ea.formNotes')}</Label><Textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder={t('ea.formTechNotesPlaceholder')} rows={2} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>{t('app.cancel')}</Button>
              <Button type="submit" disabled={!form.name || createMutation.isPending || updateMutation.isPending}>{editingId ? t('app.update') : t('app.register')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DocumentUploadExtractDialog
        open={extractOpen}
        onOpenChange={setExtractOpen}
        registryType="technology-standards"
        queryKey={QK}
      />
    </div>
  );
}
