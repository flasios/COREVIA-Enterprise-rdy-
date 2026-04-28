import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Layers, Search, Plus, Pencil, Trash2,
  GitBranch, Star, Users, Cpu
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

type EaCapability = {
  id: string;
  name: string;
  level: number;
  parentId: string | null;
  domain: string | null;
  owner: string | null;
  maturity: string | null;
  strategicImportance: string | null;
  description: string | null;
  supportingApplications: string[] | null;
  notes: string | null;
  sourceType: string | null;
  sourceDemandId: string | null;
  verificationStatus: string | null;
  confidenceScore: number | null;
  createdAt: string;
  updatedAt: string;
};

const EMPTY_FORM = {
  name: "", level: "1", domain: "", owner: "", maturity: "",
  strategicImportance: "", description: "", supportingApplications: "", notes: "",
};

export default function CapabilityRegistry() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [extractOpen, setExtractOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const QK = ["/api/ea/registry/capabilities"];

  const { data, isLoading } = useQuery({
    queryKey: QK,
    queryFn: async () => { const r = await apiRequest("GET", "/api/ea/registry/capabilities"); return r.json(); },
  });

  const capabilities: EaCapability[] = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => { const r = await apiRequest("POST", "/api/ea/registry/capabilities", body); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: QK }); toast({ title: t('ea.capabilityRegistered') }); closeDialog(); },
    onError: () => toast({ title: t('ea.failedToSave'), variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => { const r = await apiRequest("PATCH", `/api/ea/registry/capabilities/${id}`, body); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: QK }); toast({ title: t('ea.capabilityUpdated') }); closeDialog(); },
    onError: () => toast({ title: t('ea.failedToUpdate'), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("DELETE", `/api/ea/registry/capabilities/${id}`); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: QK }); toast({ title: t('ea.capabilityRemoved') }); },
    onError: () => toast({ title: t('ea.failedToDelete'), variant: "destructive" }),
  });

  const filtered = capabilities.filter((c) =>
    [c.name, c.domain, c.owner].some((f) => f && f.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setForm(EMPTY_FORM); };
  const openCreate = () => { setForm(EMPTY_FORM); setEditingId(null); setDialogOpen(true); };
  const openEdit = (cap: EaCapability) => {
    setForm({
      name: cap.name, level: cap.level.toString(), domain: cap.domain || "",
      owner: cap.owner || "", maturity: cap.maturity || "",
      strategicImportance: cap.strategicImportance || "", description: cap.description || "",
      supportingApplications: (cap.supportingApplications || []).join(", "), notes: cap.notes || "",
    });
    setEditingId(cap.id); setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {
      name: form.name, level: parseInt(form.level) || 1,
      sourceType: "manual", verificationStatus: "verified",
    };
    if (form.domain) body.domain = form.domain;
    if (form.owner) body.owner = form.owner;
    if (form.maturity) body.maturity = form.maturity;
    if (form.strategicImportance) body.strategicImportance = form.strategicImportance;
    if (form.description) body.description = form.description;
    if (form.supportingApplications) body.supportingApplications = form.supportingApplications.split(",").map((s: string) => s.trim()).filter(Boolean);
    if (form.notes) body.notes = form.notes;
    if (editingId) { updateMutation.mutate({ id: editingId, body }); } else { createMutation.mutate(body); }
  };

  const setField = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const maturityColors: Record<string, string> = {
    initial: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    developing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    defined: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    managed: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    optimised: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };

  const domainCounts = capabilities.reduce((acc, c) => {
    const d = c.domain || "Unassigned"; acc[d] = (acc[d] || 0) + 1; return acc;
  }, {} as Record<string, number>);

  const pendingCount = capabilities.filter(c => c.verificationStatus === "pending_verification").length;

  return (
    <div className="h-screen bg-gradient-to-b from-slate-50 via-stone-50/50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden">
      <div className="w-full max-w-none px-4 sm:px-6 relative z-10 h-full flex flex-col">
        <div className="flex items-end justify-between flex-shrink-0 mb-4 gap-4 pt-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white"><Layers className="h-5 w-5" /></div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{t('ea.capabilityRegistry')}</h1>
                <p className="text-xs text-muted-foreground">
                  {capabilities.length} {t('ea.capabilitiesStructuredBaseline')}
                  {pendingCount > 0 && <span className="ml-2 text-amber-600 dark:text-amber-400">— {pendingCount} pending verification</span>}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-1.5 text-xs">
              {Object.entries(domainCounts).slice(0, 4).map(([domain, count]) => (
                <Badge key={domain} variant="secondary" className="text-xs">{domain}: {count}</Badge>
              ))}
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300" onClick={() => setExtractOpen(true)}><Upload className="h-4 w-4" />Upload & Extract<SparklesIcon className="h-3 w-3" /></Button>
            <Button size="sm" className="gap-1.5" onClick={openCreate}><Plus className="h-4 w-4" />{t('ea.registerCapability')}</Button>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('ea.searchCapabilities')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-indigo-300 dark:via-indigo-600 to-transparent mb-4" />

        <div className="flex-1 min-h-0 overflow-y-auto bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><div className="text-center space-y-3"><div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" /><p className="text-sm text-muted-foreground">{t('app.loading')}</p></div></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{t('ea.noCapabilitiesYet')}</p>
              <p className="text-sm mt-1 mb-4">{t('ea.noCapabilitiesYetDesc')}</p>
              <Button size="sm" className="gap-1.5" onClick={openCreate}><Plus className="h-4 w-4" />{t('ea.registerFirstCapability')}</Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
              {filtered.map((cap) => (
                <div key={cap.id} className={`p-4 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors group ${
                  cap.verificationStatus === "pending_verification" ? "border-l-2 border-l-amber-400" :
                  cap.verificationStatus === "rejected" ? "border-l-2 border-l-red-400" : ""
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0" style={{ paddingLeft: `${(cap.level - 1) * 20}px` }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">{cap.name}</h3>
                        <Badge variant="outline" className="text-xs"><GitBranch className="h-3 w-3 mr-1" />L{cap.level}</Badge>
                        {cap.domain && <Badge variant="secondary" className="text-xs">{cap.domain}</Badge>}
                        {cap.maturity && <Badge className={`text-xs ${maturityColors[cap.maturity] || maturityColors.initial}`}>{cap.maturity}</Badge>}
                        {cap.strategicImportance && <Badge variant="outline" className="text-xs"><Star className="h-3 w-3 mr-1" />{cap.strategicImportance}</Badge>}
                        <VerificationBadge status={cap.verificationStatus} sourceType={cap.sourceType} confidenceScore={cap.confidenceScore} />
                        <ProvenanceIndicator sourceType={cap.sourceType} sourceDemandId={cap.sourceDemandId} confidenceScore={cap.confidenceScore} />
                      </div>
                      {cap.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{cap.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        {cap.owner && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{cap.owner}</span>}
                        {cap.supportingApplications && cap.supportingApplications.length > 0 && (
                          <span className="flex items-center gap-1"><Cpu className="h-3 w-3" />{cap.supportingApplications.join(", ")}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <VerificationActions registryType="capabilities" entryId={cap.id} currentStatus={cap.verificationStatus} queryKey={QK} />
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(cap)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => deleteMutation.mutate(cap.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3" style={{ paddingLeft: `${(cap.level - 1) * 20}px` }}>
                    <DocumentPanel registryType="capabilities" entryId={cap.id} entryName={cap.name} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? t('ea.editCapability') : t('ea.registerCapability')}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>{t('ea.formCapabilityName')} *</Label><Input value={form.name} onChange={(e) => setField("name", e.target.value)} required placeholder={t('ea.formCapabilityNamePlaceholder')} /></div>
              <div><Label>{t('ea.formLevel')}</Label>
                <Select value={form.level} onValueChange={(v) => setField("level", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t('ea.formLevel1Strategic')}</SelectItem>
                    <SelectItem value="2">{t('ea.formLevel2Tactical')}</SelectItem>
                    <SelectItem value="3">{t('ea.formLevel3Operational')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t('ea.formDomain')}</Label><Input value={form.domain} onChange={(e) => setField("domain", e.target.value)} placeholder={t('ea.formDomainPlaceholder')} /></div>
              <div><Label>{t('ea.formOwner')}</Label><Input value={form.owner} onChange={(e) => setField("owner", e.target.value)} placeholder={t('ea.formCapOwnerPlaceholder')} /></div>
              <div><Label>{t('ea.formMaturity')}</Label>
                <Select value={form.maturity || "none"} onValueChange={(v) => setField("maturity", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('ea.formDash')}</SelectItem>
                    <SelectItem value="initial">{t('ea.formInitial')}</SelectItem>
                    <SelectItem value="developing">{t('ea.formDeveloping')}</SelectItem>
                    <SelectItem value="defined">{t('ea.formDefined')}</SelectItem>
                    <SelectItem value="managed">{t('ea.formManaged')}</SelectItem>
                    <SelectItem value="optimised">{t('ea.formOptimised')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t('ea.formStrategicImportance')}</Label>
                <Select value={form.strategicImportance || "none"} onValueChange={(v) => setField("strategicImportance", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('ea.formDash')}</SelectItem>
                    <SelectItem value="differentiator">{t('ea.formDifferentiator')}</SelectItem>
                    <SelectItem value="core">{t('ea.formCore')}</SelectItem>
                    <SelectItem value="commodity">{t('ea.formCommodity')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>{t('ea.formSupportingApplications')}</Label><Input value={form.supportingApplications} onChange={(e) => setField("supportingApplications", e.target.value)} placeholder={t('ea.formSupportingApplicationsPlaceholder')} /></div>
              <div className="col-span-2"><Label>{t('ea.formDescription')}</Label><Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder={t('ea.formCapDescriptionPlaceholder')} rows={2} /></div>
              <div className="col-span-2"><Label>{t('ea.formNotes')}</Label><Textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder={t('ea.formCapNotesPlaceholder')} rows={2} /></div>
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
        registryType="capabilities"
        queryKey={QK}
      />
    </div>
  );
}
