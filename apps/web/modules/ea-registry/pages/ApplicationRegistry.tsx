import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Cpu, Search, Shield, Building2, Plus,
  Pencil, Trash2, Activity, Server, Users, DollarSign, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VerificationBadge, ProvenanceIndicator, VerificationActions, DocumentPanel, DocumentUploadExtractDialog } from "../components";
import { Upload, Sparkles as SparklesIcon } from "lucide-react";

type EaApplication = {
  id: string;
  name: string;
  vendor: string | null;
  version: string | null;
  description: string | null;
  criticality: string;
  lifecycle: string;
  hosting: string | null;
  department: string | null;
  owner: string | null;
  tier: string | null;
  userCount: number | null;
  annualCost: number | null;
  contractExpiry: string | null;
  dataClassification: string | null;
  disasterRecovery: string | null;
  notes: string | null;
  sourceType: string | null;
  sourceDemandId: string | null;
  verificationStatus: string | null;
  confidenceScore: number | null;
  createdAt: string;
  updatedAt: string;
};

const EMPTY_FORM = {
  name: "", vendor: "", version: "", description: "",
  criticality: "medium", lifecycle: "active", hosting: "", department: "",
  owner: "", tier: "", userCount: "", annualCost: "", contractExpiry: "",
  dataClassification: "", disasterRecovery: "", notes: "",
};

export default function ApplicationRegistry() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedDoc, _setExpandedDoc] = useState<string | null>(null);
  const [extractOpen, setExtractOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const QK = ["/api/ea/registry/applications"];

  const { data, isLoading } = useQuery({
    queryKey: QK,
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/ea/registry/applications");
      return r.json();
    },
  });

  const applications: EaApplication[] = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await apiRequest("POST", "/api/ea/registry/applications", body);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK });
      toast({ title: t('ea.applicationRegistered') });
      closeDialog();
    },
    onError: () => toast({ title: t('ea.failedToSave'), variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const r = await apiRequest("PATCH", `/api/ea/registry/applications/${id}`, body);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK });
      toast({ title: t('ea.applicationUpdated') });
      closeDialog();
    },
    onError: () => toast({ title: t('ea.failedToUpdate'), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("DELETE", `/api/ea/registry/applications/${id}`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK });
      toast({ title: t('ea.applicationRemoved') });
    },
    onError: () => toast({ title: t('ea.failedToDelete'), variant: "destructive" }),
  });

  const filteredApps = applications.filter((a) =>
    [a.name, a.vendor, a.department, a.owner].some(
      (f) => f && f.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setForm(EMPTY_FORM); };
  const openCreate = () => { setForm(EMPTY_FORM); setEditingId(null); setDialogOpen(true); };

  const openEdit = (app: EaApplication) => {
    setForm({
      name: app.name, vendor: app.vendor || "", version: app.version || "",
      description: app.description || "", criticality: app.criticality, lifecycle: app.lifecycle,
      hosting: app.hosting || "", department: app.department || "", owner: app.owner || "",
      tier: app.tier || "", userCount: app.userCount?.toString() || "",
      annualCost: app.annualCost?.toString() || "", contractExpiry: app.contractExpiry || "",
      dataClassification: app.dataClassification || "", disasterRecovery: app.disasterRecovery || "",
      notes: app.notes || "",
    });
    setEditingId(app.id);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {
      name: form.name, criticality: form.criticality, lifecycle: form.lifecycle,
      sourceType: "manual", verificationStatus: "verified",
    };
    if (form.vendor) body.vendor = form.vendor;
    if (form.version) body.version = form.version;
    if (form.description) body.description = form.description;
    if (form.hosting) body.hosting = form.hosting;
    if (form.department) body.department = form.department;
    if (form.owner) body.owner = form.owner;
    if (form.tier) body.tier = form.tier;
    if (form.userCount) body.userCount = parseInt(form.userCount);
    if (form.annualCost) body.annualCost = parseInt(form.annualCost);
    if (form.contractExpiry) body.contractExpiry = form.contractExpiry;
    if (form.dataClassification) body.dataClassification = form.dataClassification;
    if (form.disasterRecovery) body.disasterRecovery = form.disasterRecovery;
    if (form.notes) body.notes = form.notes;
    if (editingId) {
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const setField = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const lifecycleColors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    legacy: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    "end-of-life": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    planned: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    retiring: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  };
  const criticalityColors: Record<string, string> = {
    critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };

  const lifecycleCounts = applications.reduce((acc, a) => {
    acc[a.lifecycle] = (acc[a.lifecycle] || 0) + 1; return acc;
  }, {} as Record<string, number>);

  const pendingCount = applications.filter(a => a.verificationStatus === "pending_verification").length;

  return (
    <div className="h-screen bg-gradient-to-b from-slate-50 via-stone-50/50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden">
      <div className="w-full max-w-none px-4 sm:px-6 relative z-10 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-end justify-between flex-shrink-0 mb-4 gap-4 pt-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white"><Cpu className="h-5 w-5" /></div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{t('ea.applicationRegistry')}</h1>
                <p className="text-xs text-muted-foreground">
                  {applications.length} {t('ea.applicationsStructuredBaseline')}
                  {pendingCount > 0 && (
                    <span className="ml-2 text-amber-600 dark:text-amber-400">
                      — {pendingCount} pending verification
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-1.5 text-xs">
              {Object.entries(lifecycleCounts).map(([lc, count]) => (
                <Badge key={lc} className={lifecycleColors[lc] || lifecycleColors.active}>{lc}: {count}</Badge>
              ))}
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" onClick={() => setExtractOpen(true)}><Upload className="h-4 w-4" />Upload & Extract<SparklesIcon className="h-3 w-3" /></Button>
            <Button size="sm" className="gap-1.5" onClick={openCreate}><Plus className="h-4 w-4" />{t('ea.registerApplication')}</Button>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('ea.searchApplications')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-blue-300 dark:via-blue-600 to-transparent mb-4" />

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><div className="text-center space-y-3"><div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /><p className="text-sm text-muted-foreground">{t('app.loading')}</p></div></div>
          ) : filteredApps.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Cpu className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{t('ea.noApplicationsYet')}</p>
              <p className="text-sm mt-1 mb-4">{t('ea.noApplicationsYetDesc')}</p>
              <Button size="sm" className="gap-1.5" onClick={openCreate}><Plus className="h-4 w-4" />{t('ea.registerFirstApplication')}</Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
              {filteredApps.map((app) => (
                <div key={app.id} className={`p-4 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors group ${
                  app.verificationStatus === "pending_verification" ? "border-l-2 border-l-amber-400" :
                  app.verificationStatus === "rejected" ? "border-l-2 border-l-red-400" : ""
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">{app.name}</h3>
                        {app.vendor && <span className="text-xs text-muted-foreground">{t('ea.byVendor')} {app.vendor}</span>}
                        {app.version && <Badge variant="outline" className="text-xs">{app.version}</Badge>}
                        <Badge className={`text-xs ${lifecycleColors[app.lifecycle] || lifecycleColors.active}`}>
                          <Activity className="h-3 w-3 mr-1" />{app.lifecycle}
                        </Badge>
                        <Badge className={`text-xs ${criticalityColors[app.criticality] || criticalityColors.medium}`}>
                          <Shield className="h-3 w-3 mr-1" />{app.criticality}
                        </Badge>
                        <VerificationBadge
                          status={app.verificationStatus}
                          sourceType={app.sourceType}
                          confidenceScore={app.confidenceScore}
                        />
                        <ProvenanceIndicator
                          sourceType={app.sourceType}
                          sourceDemandId={app.sourceDemandId}
                          confidenceScore={app.confidenceScore}
                        />
                      </div>
                      {app.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{app.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        {app.department && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{app.department}</span>}
                        {app.owner && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{app.owner}</span>}
                        {app.hosting && <span className="flex items-center gap-1"><Server className="h-3 w-3" />{app.hosting}</span>}
                        {app.userCount && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{app.userCount.toLocaleString()} {t('ea.usersCount')}</span>}
                        {app.annualCost && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{t('ea.aedCurrency')} {app.annualCost.toLocaleString()}</span>}
                        {app.contractExpiry && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{t('ea.expiresLabel')} {app.contractExpiry}</span>}
                        {app.dataClassification && <span className="flex items-center gap-1"><Shield className="h-3 w-3" />{t('ea.dataLabel')} {app.dataClassification}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <VerificationActions
                        registryType="applications"
                        entryId={app.id}
                        currentStatus={app.verificationStatus}
                        queryKey={QK}
                      />
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(app)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => deleteMutation.mutate(app.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </div>
                  {/* Document Panel — toggle per entry */}
                  <div className="mt-3">
                    <DocumentPanel
                      registryType="applications"
                      entryId={app.id}
                      entryName={app.name}
                      collapsed={expandedDoc !== app.id}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t('ea.editApplication') : t('ea.registerApplication')}</DialogTitle>
            <DialogDescription>
              {editingId ? t('ea.editApplicationDescription', 'Update application metadata and ownership details.') : t('ea.registerApplicationDescription', 'Enter the core metadata required to register an enterprise application.')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>{t('ea.formApplicationName')} *</Label><Input value={form.name} onChange={(e) => setField("name", e.target.value)} required placeholder={t('ea.formApplicationNamePlaceholder')} /></div>
              <div><Label>{t('ea.formVendor')}</Label><Input value={form.vendor} onChange={(e) => setField("vendor", e.target.value)} placeholder={t('ea.formAppVendorPlaceholder')} /></div>
              <div><Label>{t('ea.formVersion')}</Label><Input value={form.version} onChange={(e) => setField("version", e.target.value)} placeholder={t('ea.formAppVersionPlaceholder')} /></div>
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
              <div><Label>{t('ea.formLifecycle')} *</Label>
                <Select value={form.lifecycle} onValueChange={(v) => setField("lifecycle", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('ea.formActive')}</SelectItem>
                    <SelectItem value="planned">{t('ea.formPlanned')}</SelectItem>
                    <SelectItem value="legacy">{t('ea.formLegacy')}</SelectItem>
                    <SelectItem value="retiring">{t('ea.formRetiring')}</SelectItem>
                    <SelectItem value="end-of-life">{t('ea.formEndOfLife')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t('ea.formHosting')}</Label><Input value={form.hosting} onChange={(e) => setField("hosting", e.target.value)} placeholder={t('ea.formHostingPlaceholder')} /></div>
              <div><Label>{t('ea.formDepartment')}</Label><Input value={form.department} onChange={(e) => setField("department", e.target.value)} placeholder={t('ea.formDepartmentPlaceholder')} /></div>
              <div><Label>{t('ea.formOwner')}</Label><Input value={form.owner} onChange={(e) => setField("owner", e.target.value)} placeholder={t('ea.formAppOwnerPlaceholder')} /></div>
              <div><Label>{t('ea.formTier')}</Label>
                <Select value={form.tier || "none"} onValueChange={(v) => setField("tier", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('ea.formDash')}</SelectItem>
                    <SelectItem value="tier-1">{t('ea.formTier1')}</SelectItem>
                    <SelectItem value="tier-2">{t('ea.formTier2')}</SelectItem>
                    <SelectItem value="tier-3">{t('ea.formTier3')}</SelectItem>
                    <SelectItem value="tier-4">{t('ea.formTier4')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t('ea.formUserCount')}</Label><Input type="number" value={form.userCount} onChange={(e) => setField("userCount", e.target.value)} placeholder={t('ea.formUserCountPlaceholder')} /></div>
              <div><Label>{t('ea.formAnnualCost')}</Label><Input type="number" value={form.annualCost} onChange={(e) => setField("annualCost", e.target.value)} placeholder={t('ea.formAnnualCostPlaceholder')} /></div>
              <div><Label>{t('ea.formContractExpiry')}</Label><Input value={form.contractExpiry} onChange={(e) => setField("contractExpiry", e.target.value)} placeholder={t('ea.formContractExpiryPlaceholder')} /></div>
              <div><Label>{t('ea.formDataClassification')}</Label>
                <Select value={form.dataClassification || "none"} onValueChange={(v) => setField("dataClassification", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('ea.formDash')}</SelectItem>
                    <SelectItem value="public">{t('ea.formPublic')}</SelectItem>
                    <SelectItem value="internal">{t('ea.formInternal')}</SelectItem>
                    <SelectItem value="confidential">{t('ea.formConfidential')}</SelectItem>
                    <SelectItem value="sensitive">{t('ea.formSensitiveRestricted')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t('ea.formDisasterRecovery')}</Label><Input value={form.disasterRecovery} onChange={(e) => setField("disasterRecovery", e.target.value)} placeholder={t('ea.formDisasterRecoveryPlaceholder')} /></div>
              <div className="col-span-2"><Label>{t('ea.formDescription')}</Label><Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder={t('ea.formAppDescriptionPlaceholder')} rows={2} /></div>
              <div className="col-span-2"><Label>{t('ea.formNotes')}</Label><Textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder={t('ea.formAppNotesPlaceholder')} rows={2} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>{t('app.cancel')}</Button>
              <Button type="submit" disabled={!form.name || createMutation.isPending || updateMutation.isPending}>
                {editingId ? t('app.update') : t('app.register')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DocumentUploadExtractDialog
        open={extractOpen}
        onOpenChange={setExtractOpen}
        registryType="applications"
        queryKey={QK}
      />
    </div>
  );
}
