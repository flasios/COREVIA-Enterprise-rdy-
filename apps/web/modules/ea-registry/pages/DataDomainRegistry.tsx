import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database, Search, Shield, Plus, Pencil,
  Trash2, AlertTriangle, Globe, Lock, MapPin, Scale, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VerificationBadge, ProvenanceIndicator, VerificationActions, DocumentPanel, DocumentUploadExtractDialog } from "../components";
import { Upload, Sparkles as SparklesIcon } from "lucide-react";

type EaDataDomain = {
  id: string;
  name: string;
  classification: string;
  owner: string | null;
  steward: string | null;
  description: string | null;
  piiFlag: boolean;
  crossBorderRestriction: boolean;
  retentionPeriod: string | null;
  storageLocation: string | null;
  qualityScore: number | null;
  sourceSystem: string | null;
  regulatoryFramework: string | null;
  notes: string | null;
  sourceType: string | null;
  sourceDemandId: string | null;
  verificationStatus: string | null;
  confidenceScore: number | null;
  createdAt: string;
  updatedAt: string;
};

const EMPTY_FORM = {
  name: "", classification: "internal", owner: "", steward: "", description: "",
  piiFlag: false, crossBorderRestriction: false, retentionPeriod: "", storageLocation: "",
  qualityScore: "", sourceSystem: "", regulatoryFramework: "", notes: "",
};

export default function DataDomainRegistry() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [extractOpen, setExtractOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const QK = ["/api/ea/registry/data-domains"];

  const { data, isLoading } = useQuery({
    queryKey: QK,
    queryFn: async () => { const r = await apiRequest("GET", "/api/ea/registry/data-domains"); return r.json(); },
  });
  const dataDomains: EaDataDomain[] = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => { const r = await apiRequest("POST", "/api/ea/registry/data-domains", body); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: QK }); toast({ title: t('ea.dataDomainRegistered') }); closeDialog(); },
    onError: () => toast({ title: t('ea.failedToSave'), variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => { const r = await apiRequest("PATCH", `/api/ea/registry/data-domains/${id}`, body); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: QK }); toast({ title: t('ea.dataDomainUpdated') }); closeDialog(); },
    onError: () => toast({ title: t('ea.failedToUpdate'), variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("DELETE", `/api/ea/registry/data-domains/${id}`); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: QK }); toast({ title: t('ea.dataDomainRemoved') }); },
    onError: () => toast({ title: t('ea.failedToDelete'), variant: "destructive" }),
  });

  const filtered = dataDomains.filter((d) =>
    [d.name, d.owner, d.steward, d.sourceSystem].some((f) => f && f.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setForm(EMPTY_FORM); };
  const openCreate = () => { setForm(EMPTY_FORM); setEditingId(null); setDialogOpen(true); };
  const openEdit = (dd: EaDataDomain) => {
    setForm({
      name: dd.name, classification: dd.classification, owner: dd.owner || "",
      steward: dd.steward || "", description: dd.description || "",
      piiFlag: dd.piiFlag, crossBorderRestriction: dd.crossBorderRestriction,
      retentionPeriod: dd.retentionPeriod || "", storageLocation: dd.storageLocation || "",
      qualityScore: dd.qualityScore?.toString() || "", sourceSystem: dd.sourceSystem || "",
      regulatoryFramework: dd.regulatoryFramework || "", notes: dd.notes || "",
    });
    setEditingId(dd.id); setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {
      name: form.name, classification: form.classification,
      piiFlag: form.piiFlag, crossBorderRestriction: form.crossBorderRestriction,
      sourceType: "manual", verificationStatus: "verified",
    };
    if (form.owner) body.owner = form.owner;
    if (form.steward) body.steward = form.steward;
    if (form.description) body.description = form.description;
    if (form.retentionPeriod) body.retentionPeriod = form.retentionPeriod;
    if (form.storageLocation) body.storageLocation = form.storageLocation;
    if (form.qualityScore) body.qualityScore = parseInt(form.qualityScore);
    if (form.sourceSystem) body.sourceSystem = form.sourceSystem;
    if (form.regulatoryFramework) body.regulatoryFramework = form.regulatoryFramework;
    if (form.notes) body.notes = form.notes;
    if (editingId) {
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const setField = (key: string, value: string | boolean) => setForm((p) => ({ ...p, [key]: value }));

  const classColors: Record<string, string> = {
    sensitive: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    confidential: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    internal: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    public: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };

  const classCounts = dataDomains.reduce((acc, d) => {
    acc[d.classification] = (acc[d.classification] || 0) + 1; return acc;
  }, {} as Record<string, number>);
  const piiCount = dataDomains.filter((d) => d.piiFlag).length;
  const crossBorderCount = dataDomains.filter((d) => d.crossBorderRestriction).length;
  const pendingCount = dataDomains.filter(d => d.verificationStatus === "pending_verification").length;

  return (
    <div className="h-screen bg-gradient-to-b from-slate-50 via-stone-50/50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden">
      <div className="w-full max-w-none px-4 sm:px-6 relative z-10 h-full flex flex-col">
        <div className="flex items-end justify-between flex-shrink-0 mb-4 gap-4 pt-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white"><Database className="h-5 w-5" /></div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{t('ea.dataDomainRegistry')}</h1>
                <p className="text-xs text-muted-foreground">
                  {dataDomains.length} {t('ea.dataDomainsCount')} — {piiCount} {t('ea.pii')}, {crossBorderCount} {t('ea.crossBorderRestricted')}
                  {pendingCount > 0 && <span className="ml-2 text-amber-600 dark:text-amber-400">— {pendingCount} pending</span>}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-1.5 text-xs">
              {Object.entries(classCounts).map(([cls, count]) => (
                <Badge key={cls} className={classColors[cls] || classColors.internal}>{cls}: {count}</Badge>
              ))}
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300" onClick={() => setExtractOpen(true)}><Upload className="h-4 w-4" />Upload & Extract<SparklesIcon className="h-3 w-3" /></Button>
            <Button size="sm" className="gap-1.5" onClick={openCreate}><Plus className="h-4 w-4" />{t('ea.registerDataDomain')}</Button>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('ea.searchDataDomains')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-amber-300 dark:via-amber-600 to-transparent mb-4" />

        <div className="flex-1 min-h-0 overflow-y-auto bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><div className="text-center space-y-3"><div className="h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" /><p className="text-sm text-muted-foreground">{t('app.loading')}</p></div></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{t('ea.noDataDomainsYet')}</p>
              <p className="text-sm mt-1 mb-4">{t('ea.noDataDomainsYetDesc')}</p>
              <Button size="sm" className="gap-1.5" onClick={openCreate}><Plus className="h-4 w-4" />{t('ea.registerFirstDataDomain')}</Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
              {filtered.map((dd) => (
                <div key={dd.id} className={`p-4 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors group ${
                  dd.verificationStatus === "pending_verification" ? "border-l-2 border-l-amber-400" :
                  dd.verificationStatus === "rejected" ? "border-l-2 border-l-red-400" : ""
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">{dd.name}</h3>
                        <Badge className={`text-xs ${classColors[dd.classification] || classColors.internal}`}>
                          <Shield className="h-3 w-3 mr-1" />{dd.classification}
                        </Badge>
                        {dd.piiFlag && <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><AlertTriangle className="h-3 w-3 mr-1" />{t('ea.piiBadge')}</Badge>}
                        {dd.crossBorderRestriction && <Badge className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"><Globe className="h-3 w-3 mr-1" />{t('ea.crossBorderRestrictedBadge')}</Badge>}
                        <VerificationBadge status={dd.verificationStatus} sourceType={dd.sourceType} confidenceScore={dd.confidenceScore} />
                        <ProvenanceIndicator sourceType={dd.sourceType} sourceDemandId={dd.sourceDemandId} confidenceScore={dd.confidenceScore} />
                      </div>
                      {dd.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{dd.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        {dd.owner && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{t('ea.ownerLabel')}: {dd.owner}</span>}
                        {dd.steward && <span className="flex items-center gap-1"><Scale className="h-3 w-3" />{t('ea.stewardLabel')} {dd.steward}</span>}
                        {dd.storageLocation && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{dd.storageLocation}</span>}
                        {dd.retentionPeriod && <span className="flex items-center gap-1"><Lock className="h-3 w-3" />{t('ea.retentionLabel')} {dd.retentionPeriod}</span>}
                        {dd.sourceSystem && <span className="flex items-center gap-1"><Database className="h-3 w-3" />{t('ea.sourceLabel')} {dd.sourceSystem}</span>}
                        {dd.regulatoryFramework && <span className="flex items-center gap-1"><Shield className="h-3 w-3" />{dd.regulatoryFramework}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {dd.qualityScore != null && (
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                          dd.qualityScore >= 80 ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30" :
                          dd.qualityScore >= 60 ? "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30" :
                          dd.qualityScore >= 40 ? "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30" :
                          "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30"
                        }`}>{dd.qualityScore}</div>
                      )}
                      <VerificationActions registryType="data-domains" entryId={dd.id} currentStatus={dd.verificationStatus} queryKey={QK} />
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(dd)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => deleteMutation.mutate(dd.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <DocumentPanel registryType="data-domains" entryId={dd.id} entryName={dd.name} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? t('ea.editDataDomain') : t('ea.registerDataDomain')}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>{t('ea.formDomainName')} *</Label><Input value={form.name} onChange={(e) => setField("name", e.target.value)} required placeholder={t('ea.formDomainNamePlaceholder')} /></div>
              <div><Label>{t('ea.formClassification')} *</Label>
                <Select value={form.classification} onValueChange={(v) => setField("classification", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">{t('ea.formPublic')}</SelectItem>
                    <SelectItem value="internal">{t('ea.formInternal')}</SelectItem>
                    <SelectItem value="confidential">{t('ea.formConfidential')}</SelectItem>
                    <SelectItem value="sensitive">{t('ea.formSensitiveRestricted')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t('ea.formQualityScore')}</Label><Input type="number" min="0" max="100" value={form.qualityScore} onChange={(e) => setField("qualityScore", e.target.value)} placeholder={t('ea.formQualityScorePlaceholder')} /></div>
              <div><Label>{t('ea.formOwner')}</Label><Input value={form.owner} onChange={(e) => setField("owner", e.target.value)} placeholder={t('ea.formDataOwnerPlaceholder')} /></div>
              <div><Label>{t('ea.formDataSteward')}</Label><Input value={form.steward} onChange={(e) => setField("steward", e.target.value)} placeholder={t('ea.formDataStewardPlaceholder')} /></div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={form.piiFlag} onCheckedChange={(v) => setField("piiFlag", v)} />
                <Label className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-red-500" />{t('ea.formContainsPII')}</Label>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={form.crossBorderRestriction} onCheckedChange={(v) => setField("crossBorderRestriction", v)} />
                <Label className="flex items-center gap-1"><Globe className="h-3.5 w-3.5 text-orange-500" />{t('ea.formCrossBorderRestricted')}</Label>
              </div>
              <div><Label>{t('ea.formRetentionPeriod')}</Label><Input value={form.retentionPeriod} onChange={(e) => setField("retentionPeriod", e.target.value)} placeholder={t('ea.formRetentionPeriodPlaceholder')} /></div>
              <div><Label>{t('ea.formStorageLocation')}</Label><Input value={form.storageLocation} onChange={(e) => setField("storageLocation", e.target.value)} placeholder={t('ea.formStorageLocationPlaceholder')} /></div>
              <div><Label>{t('ea.formSourceSystem')}</Label><Input value={form.sourceSystem} onChange={(e) => setField("sourceSystem", e.target.value)} placeholder={t('ea.formDataSourceSystemPlaceholder')} /></div>
              <div><Label>{t('ea.formRegulatoryFramework')}</Label><Input value={form.regulatoryFramework} onChange={(e) => setField("regulatoryFramework", e.target.value)} placeholder={t('ea.formRegulatoryFrameworkPlaceholder')} /></div>
              <div className="col-span-2"><Label>{t('ea.formDescription')}</Label><Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder={t('ea.formDataDescriptionPlaceholder')} rows={2} /></div>
              <div className="col-span-2"><Label>{t('ea.formNotes')}</Label><Textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder={t('ea.formDataNotesPlaceholder')} rows={2} /></div>
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
        registryType="data-domains"
        queryKey={QK}
      />
    </div>
  );
}
