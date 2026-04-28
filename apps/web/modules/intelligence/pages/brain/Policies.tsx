import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table as _Table,
  TableBody as _TableBody,
  TableCell as _TableCell,
  TableHead as _TableHead,
  TableHeader as _TableHeader,
  TableRow as _TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Shield,
  Upload,
  FlaskConical,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Activity,
  Layers,
  AlertTriangle,
  FileText,
  Paperclip,
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Pencil,
  Save,
  ShieldAlert,
  ShieldCheck,
  Eye,
} from "lucide-react";
import { fetchControlPlane, fetchPolicyPacks, uploadPolicyPack, togglePolicyPack, runPolicyTests, setPolicyMode, updatePolicyPackRules } from "@/api/brain";
import type { PolicyPack } from "@shared/contracts/brain";
import type { PolicyPackRule } from "@shared/contracts/brain";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PolicyTestPackResult {
  packId: string;
  version: string;
  testsPassed: number;
  testsRun: number;
  duration: string;
  result: string;
}

interface PolicyTestResults {
  allPassed: boolean;
  totalPacks: number;
  testedAt: string;
  packs: PolicyTestPackResult[];
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          ACTIVE
        </Badge>
      );
    case "inactive":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <XCircle className="h-3 w-3 mr-1" />
          INACTIVE
        </Badge>
      );
    case "draft":
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          DRAFT
        </Badge>
      );
    case "testing":
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          <FlaskConical className="h-3 w-3 mr-1" />
          TESTING
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function TestResultBadge({ result }: { result: string }) {
  switch (result) {
    case "passed":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
          PASSED
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
          FAILED
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          UNTESTED
        </Badge>
      );
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function Policies() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [testResults, setTestResults] = useState<PolicyTestResults | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set());
  const [editingRulesPack, setEditingRulesPack] = useState<string | null>(null);
  const [editingRules, setEditingRules] = useState<PolicyPackRule[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadForm, setUploadForm] = useState({
    packId: "",
    name: "",
    version: "",
    summary: "",
    rulesCount: 0,
    activateImmediately: false,
  });
  const [uploadRules, setUploadRules] = useState<PolicyPackRule[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["policyPacks"],
    queryFn: fetchPolicyPacks,
  });

  const { data: controlPlaneData } = useQuery({
    queryKey: ["control-plane"],
    queryFn: fetchControlPlane,
  });

  const uploadMutation = useMutation({
    mutationFn: () => uploadPolicyPack({ ...uploadForm, rules: uploadRules, document: selectedFile }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["policyPacks"] });
      toast({ title: result.message || t('brain.policies.packUploaded') });
      setUploadOpen(false);
      setUploadForm({ packId: "", name: "", version: "", summary: "", rulesCount: 0, activateImmediately: false });
      setUploadRules([]);
      setSelectedFile(null);
    },
    onError: (error: unknown) => {
      const details =
        typeof error === "object" &&
        error !== null &&
        "details" in error &&
        typeof (error as { details?: unknown }).details === "object" &&
        (error as { details?: Record<string, unknown[]> }).details
          ? Object.values((error as { details: Record<string, unknown[]> }).details).flat().join(", ")
          : "";
      const message = error instanceof Error ? error.message : "Could not upload policy pack";
      toast({
        title: t('brain.policies.uploadFailed'),
        description: details || message,
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ packId, status }: { packId: string; status: string }) =>
      togglePolicyPack(packId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policyPacks"] });
      toast({ title: t('brain.policies.statusUpdated') });
    },
    onError: () => {
      toast({ title: t('brain.policies.statusUpdateFailed'), variant: "destructive" });
    },
  });

  const setModeMutation = useMutation({
    mutationFn: async (mode: "enforce" | "monitor") => setPolicyMode(mode),
    onSuccess: (_, mode) => {
      queryClient.invalidateQueries({ queryKey: ["policyPacks"] });
      queryClient.invalidateQueries({ queryKey: ["control-plane"] });
      toast({ title: mode === "enforce" ? t('brain.policies.enforcementEnabled') : t('brain.policies.monitoringEnabled') });
    },
    onError: () => {
      toast({ title: t('brain.policies.modeUpdateFailed'), variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: (packId?: string) => runPolicyTests(packId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["policyPacks"] });
      const nextResults = (result.results as PolicyTestResults | undefined) || null;
      setTestResults(nextResults);
      toast({
        title: nextResults?.allPassed ? t('brain.policies.allTestsPassed') : t('brain.policies.someTestsFailed'),
      });
    },
    onError: () => {
      toast({ title: t('brain.policies.testFailed'), variant: "destructive" });
    },
  });

  const updateRulesMutation = useMutation({
    mutationFn: ({ packId, rules }: { packId: string; rules: PolicyPackRule[] }) =>
      updatePolicyPackRules(packId, rules),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policyPacks"] });
      toast({ title: t('brain.policies.rulesUpdated') });
      setEditingRulesPack(null);
      setEditingRules([]);
    },
    onError: () => {
      toast({ title: t('brain.policies.rulesUpdateFailed'), variant: "destructive" });
    },
  });

  const policyPacks: PolicyPack[] = data?.policyPacks || [];
  const activeVersion = data?.activeVersion || "—";
  const activeCount = policyPacks.filter(p => p.status === "active").length;
  const totalRules = policyPacks.reduce((sum, p) => sum + (p.rulesCount || 0), 0);
  const policyMode = controlPlaneData?.state?.policyMode || (activeCount > 0 ? "enforce" : "monitor");

  const isUploadValid =
    uploadForm.packId.length > 0 &&
    uploadForm.name.length > 0 &&
    /^\d+\.\d+\.\d+$/.test(uploadForm.version) &&
    uploadForm.summary.length > 0;

  const toggleExpanded = (packId: string) => {
    setExpandedPacks(prev => {
      const next = new Set(prev);
      if (next.has(packId)) next.delete(packId);
      else next.add(packId);
      return next;
    });
  };

  const addNewRule = (target: "upload" | "edit") => {
    const newRule: PolicyPackRule = {
      ruleId: `R-${Date.now()}`,
      name: "",
      condition: { field: "", operator: "eq", value: "" },
      action: "allow",
      reason: "",
      priority: target === "upload" ? uploadRules.length + 1 : editingRules.length + 1,
    };
    if (target === "upload") {
      setUploadRules([...uploadRules, newRule]);
    } else {
      setEditingRules([...editingRules, newRule]);
    }
  };

  const updateRule = (
    index: number,
    field: string,
    value: unknown,
    target: "upload" | "edit"
  ) => {
    const rules = target === "upload" ? [...uploadRules] : [...editingRules];
    const existing = rules[index];
    if (!existing) return;
    const rule = { ...existing };
    if (field === "name") rule.name = String(value);
    else if (field === "action") {
      const actionValue =
        value === "allow" || value === "block" || value === "require_approval"
          ? value
          : "allow";
      rule.action = actionValue;
    }
    else if (field === "reason") rule.reason = String(value);
    else if (field === "condition.field") rule.condition = { ...rule.condition, field: String(value) };
    else if (field === "condition.operator") {
      const operatorValue =
        value === "eq" ||
        value === "neq" ||
        value === "gt" ||
        value === "gte" ||
        value === "lt" ||
        value === "lte" ||
        value === "in" ||
        value === "nin" ||
        value === "contains" ||
        value === "exists"
          ? value
          : "eq";
      rule.condition = { ...rule.condition, operator: operatorValue };
    }
    else if (field === "condition.value") {
      // Try to parse as JSON for arrays/numbers
      let parsed = value;
      try { parsed = JSON.parse(String(value)); } catch { parsed = value; }
      rule.condition = { ...rule.condition, value: parsed };
    }
    rules[index] = rule;
    if (target === "upload") setUploadRules(rules);
    else setEditingRules(rules);
  };

  const removeRule = (index: number, target: "upload" | "edit") => {
    if (target === "upload") {
      setUploadRules(uploadRules.filter((_, i) => i !== index));
    } else {
      setEditingRules(editingRules.filter((_, i) => i !== index));
    }
  };

  const RuleEditor = ({ rules, target }: { rules: PolicyPackRule[]; target: "upload" | "edit" }) => (
    <div className="space-y-3">
      {rules.map((rule, idx) => (
        <div key={rule.ruleId} className="rounded-lg border p-3 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono text-muted-foreground">{rule.ruleId}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRule(idx, target)}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t('brain.policies.ruleName')}</Label>
              <Input
                className="h-8 text-sm"
                placeholder="e.g., Block sovereign data"
                value={rule.name}
                onChange={(e) => updateRule(idx, "name", e.target.value, target)}
              />
            </div>
            <div>
              <Label className="text-xs">{t('brain.policies.action')}</Label>
              <Select value={rule.action} onValueChange={(v) => updateRule(idx, "action", v, target)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="block">{t('brain.policies.block')}</SelectItem>
                  <SelectItem value="allow">{t('brain.policies.allow')}</SelectItem>
                  <SelectItem value="require_approval">{t('brain.policies.requireApproval')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">{t('brain.policies.fieldPath')}</Label>
              <Input
                className="h-8 text-xs font-mono"
                placeholder="classification.classificationLevel"
                value={rule.condition.field}
                onChange={(e) => updateRule(idx, "condition.field", e.target.value, target)}
              />
            </div>
            <div>
              <Label className="text-xs">{t('brain.policies.operator')}</Label>
              <Select value={rule.condition.operator} onValueChange={(v) => updateRule(idx, "condition.operator", v, target)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eq">equals</SelectItem>
                  <SelectItem value="neq">not equals</SelectItem>
                  <SelectItem value="gt">greater than</SelectItem>
                  <SelectItem value="gte">greater or equal</SelectItem>
                  <SelectItem value="lt">less than</SelectItem>
                  <SelectItem value="lte">less or equal</SelectItem>
                  <SelectItem value="in">in array</SelectItem>
                  <SelectItem value="nin">not in array</SelectItem>
                  <SelectItem value="contains">contains</SelectItem>
                  <SelectItem value="exists">exists</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('brain.policies.value')}</Label>
              <Input
                className="h-8 text-xs font-mono"
                placeholder='e.g., "sovereign" or ["high","critical"]'
                value={typeof rule.condition.value === "object" ? JSON.stringify(rule.condition.value) : String(rule.condition.value)}
                onChange={(e) => updateRule(idx, "condition.value", e.target.value, target)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">{t('brain.policies.reason')}</Label>
            <Input
              className="h-8 text-sm"
              placeholder="e.g., Sovereign data cannot be processed externally"
              value={rule.reason || ""}
              onChange={(e) => updateRule(idx, "reason", e.target.value, target)}
            />
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => addNewRule(target)}>
        <Plus className="h-3 w-3 mr-1" /> {t('brain.policies.addRule')}
      </Button>
    </div>
  );

  const ActionBadge = ({ action }: { action: string }) => {
    switch (action) {
      case "block":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs"><ShieldAlert className="h-3 w-3 mr-1" />BLOCK</Badge>;
      case "require_approval":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs"><Eye className="h-3 w-3 mr-1" />REQUIRE APPROVAL</Badge>;
      default:
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs"><ShieldCheck className="h-3 w-3 mr-1" />ALLOW</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-[linear-gradient(135deg,hsl(var(--brain-console-ice))_0%,hsl(var(--brain-surface))_55%,hsl(var(--brain-console-ash))_100%)] p-6">
        <div className="absolute right-0 top-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full bg-[radial-gradient(circle,hsl(var(--brain-console-copper)/0.2)_0%,transparent_70%)]" />
        <div className="absolute left-0 bottom-0 h-36 w-36 -translate-x-12 translate-y-10 rounded-full bg-[radial-gradient(circle,hsl(var(--brain-console-teal)/0.2)_0%,transparent_70%)]" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-overline text-muted-foreground">{t('brain.policies.policyOpsControl')}</p>
            <h1 className="text-2xl font-bold">{t('brain.policies.title')}</h1>
            <p className="text-muted-foreground">
              {t('brain.policies.description')}
            </p>
          </div>
          <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => testMutation.mutate(undefined)}
            disabled={testMutation.isPending}
          >
            {testMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FlaskConical className="h-4 w-4 mr-2" />
            )}
            {t('brain.policies.runPolicyTests')}
          </Button>
          <Dialog open={uploadOpen} onOpenChange={(open) => {
              setUploadOpen(open);
              if (!open) {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }
            }}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                {t('brain.policies.uploadNewVersion')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{t('brain.policies.uploadTitle')}</DialogTitle>
                <DialogDescription>
                  {t('brain.policies.uploadDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="packId">{t('brain.policies.packId')} <span className="text-destructive">*</span></Label>
                  <Input
                    id="packId"
                    placeholder="e.g., data_classification"
                    className="font-mono"
                    value={uploadForm.packId}
                    onChange={(e) => setUploadForm({ ...uploadForm, packId: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                  />
                  <p className="text-xs text-muted-foreground">{t('brain.policies.packIdHint')}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">{t('brain.policies.packName')} <span className="text-destructive">*</span></Label>
                  <Input
                    id="name"
                    placeholder="e.g., Data Classification"
                    value={uploadForm.name}
                    onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="version">{t('brain.policies.version')} <span className="text-destructive">*</span></Label>
                    <Input
                      id="version"
                      placeholder="e.g., 1.0.0"
                      className="font-mono"
                      value={uploadForm.version}
                      onChange={(e) => setUploadForm({ ...uploadForm, version: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rulesCount">{t('brain.policies.rulesCount')}</Label>
                    <Input
                      id="rulesCount"
                      type="number"
                      min={0}
                      value={uploadForm.rulesCount}
                      onChange={(e) => setUploadForm({ ...uploadForm, rulesCount: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="summary">{t('brain.policies.summary')} <span className="text-destructive">*</span></Label>
                  <Input
                    id="summary"
                    placeholder="e.g., Sovereign => external disabled"
                    value={uploadForm.summary}
                    onChange={(e) => setUploadForm({ ...uploadForm, summary: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t('brain.policies.enforcementRules')}</Label>
                    <Badge variant="outline" className="text-xs font-mono">{uploadRules.length} rule(s)</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('brain.policies.enforcementRulesHint')}</p>
                  <RuleEditor rules={uploadRules} target="upload" />
                </div>
                <div className="space-y-2">
                  <Label>{t('brain.policies.policyDocument')}</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.json,.yaml,.yml,.xml,.csv,.txt,.docx,.xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setSelectedFile(file);
                    }}
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full rounded-lg border-2 border-dashed p-6 text-center hover-elevate transition-colors cursor-pointer"
                    >
                      <Paperclip className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">{t('brain.policies.attachDocument')}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('brain.policies.attachDocumentHint')}</p>
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>{t('brain.policies.activateImmediately')}</Label>
                    <p className="text-xs text-muted-foreground">{t('brain.policies.activateImmediatelyHint')}</p>
                  </div>
                  <Switch
                    checked={uploadForm.activateImmediately}
                    onCheckedChange={(checked) => setUploadForm({ ...uploadForm, activateImmediately: checked })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadOpen(false)}>{t('app.cancel')}</Button>
                <Button
                  onClick={() => uploadMutation.mutate()}
                  disabled={!isUploadValid || uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {t('brain.policies.upload')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </section>

      <Card className="executive-panel">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div>
              <p className="text-sm text-muted-foreground">{t('brain.policies.policyOpsMode')}</p>
              <p className="text-lg font-semibold">{policyMode === "enforce" ? t('brain.policies.enforce') : t('brain.policies.monitorMode')}</p>
              <p className="text-xs text-muted-foreground">{t('brain.policies.modeSwitchHint')}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={policyMode === "monitor" ? "default" : "outline"}
                onClick={() => setModeMutation.mutate("monitor")}
                disabled={setModeMutation.isPending}
              >
                {t('brain.policies.monitorMode')}
              </Button>
              <Button
                size="sm"
                variant={policyMode === "enforce" ? "default" : "outline"}
                onClick={() => setModeMutation.mutate("enforce")}
                disabled={setModeMutation.isPending}
              >
                {t('brain.policies.enforce')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('brain.policies.activeVersion')}</p>
                <p className="text-2xl font-bold font-mono">{activeVersion}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('brain.policies.activePacks')}</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Layers className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('brain.policies.totalPacks')}</p>
                <p className="text-2xl font-bold">{policyPacks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('brain.policies.totalRules')}</p>
                <p className="text-2xl font-bold">{totalRules}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {testResults && (
        <Card className={testResults.allPassed ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <FlaskConical className={`h-5 w-5 ${testResults.allPassed ? "text-emerald-600" : "text-red-600"}`} />
                <div>
                  <CardTitle className="text-base">
                    Test Results — {testResults.allPassed ? t('brain.policies.allPassed') : t('brain.policies.failuresDetected')}
                  </CardTitle>
                  <CardDescription>
                    {testResults.totalPacks} pack(s) tested at {new Date(testResults.testedAt).toLocaleTimeString()}
                  </CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTestResults(null)}>{t('brain.policies.dismiss')}</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {testResults.packs?.map((pack) => (
                <div key={pack.packId} className="flex items-center justify-between rounded-lg border bg-background p-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">{pack.packId}</span>
                    <Badge variant="outline" className="font-mono text-xs">{pack.version}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{pack.testsPassed}/{pack.testsRun} passed</span>
                    <span className="text-muted-foreground">{pack.duration}</span>
                    <TestResultBadge result={pack.result} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('brain.policies.packRegistry')}</CardTitle>
          <CardDescription>
            {t('brain.policies.packRegistryDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : policyPacks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{t('brain.policies.noPacks')}</p>
              <p className="text-sm mt-1">{t('brain.policies.noPacksHint')}</p>
            </div>
          ) : (
            <div className="space-y-0 border rounded-lg overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-[40px_1fr_100px_90px_1fr_70px_100px_90px_80px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                <div></div>
                <div>{t('brain.policies.policyPackCol')}</div>
                <div className="text-center">{t('brain.policies.statusCol')}</div>
                <div className="text-center">{t('brain.policies.versionCol')}</div>
                <div>{t('brain.policies.summaryCol')}</div>
                <div className="text-center">{t('brain.policies.rulesCol')}</div>
                <div className="text-center">{t('brain.policies.documentCol')}</div>
                <div className="text-center">{t('brain.policies.testsCol')}</div>
                <div className="text-center">{t('brain.policies.enabledCol')}</div>
              </div>
              {policyPacks.map((pack) => {
                const isExpanded = expandedPacks.has(pack.packId);
                const packRules: PolicyPackRule[] = Array.isArray((pack as any).rules) ? (pack as any).rules : []; // eslint-disable-line @typescript-eslint/no-explicit-any
                const isEditingThis = editingRulesPack === pack.packId;
                return (
                  <Collapsible key={pack.packId} open={isExpanded} onOpenChange={() => toggleExpanded(pack.packId)}>
                    <div className="border-b last:border-b-0">
                      <div className="grid grid-cols-[40px_1fr_100px_90px_1fr_70px_100px_90px_80px] gap-2 px-3 py-2.5 items-center hover:bg-muted/30 transition-colors">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </Button>
                        </CollapsibleTrigger>
                        <div className="font-mono text-sm font-medium">{pack.packId}</div>
                        <div className="text-center"><StatusBadge status={pack.status} /></div>
                        <div className="text-center">
                          <Badge variant="outline" className="font-mono text-xs">{pack.version}</Badge>
                        </div>
                        <div className="text-muted-foreground text-sm truncate">{pack.summary}</div>
                        <div className="text-center text-sm font-medium">{pack.rulesCount || 0}</div>
                        <div className="text-center">
                          {pack.documentName ? (
                            <div className="flex items-center justify-center gap-1.5" title={pack.documentName}>
                              <FileText className="h-3.5 w-3.5 text-primary" />
                              <span className="text-xs text-muted-foreground max-w-[80px] truncate">{pack.documentName}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                        <div className="text-center"><TestResultBadge result={pack.testResult} /></div>
                        <div className="text-center">
                          <Switch
                            checked={pack.status === "active"}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({ packId: pack.packId, status: checked ? "active" : "inactive" })
                            }
                            disabled={toggleMutation.isPending}
                          />
                        </div>
                      </div>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-1 bg-muted/10 border-t">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-primary" />
                              <span className="text-sm font-semibold">{t('brain.policies.enforcementRules')}</span>
                              <Badge variant="outline" className="text-xs font-mono">{isEditingThis ? editingRules.length : packRules.length} rule(s)</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              {isEditingThis ? (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setEditingRulesPack(null); setEditingRules([]); }}
                                  >
                                    {t('app.cancel')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => updateRulesMutation.mutate({ packId: pack.packId, rules: editingRules })}
                                    disabled={updateRulesMutation.isPending}
                                  >
                                    {updateRulesMutation.isPending ? (
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                      <Save className="h-3 w-3 mr-1" />
                                    )}
                                    {t('brain.policies.saveRules')}
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingRulesPack(pack.packId);
                                    setEditingRules(packRules.map(r => ({ ...r })));
                                  }}
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  {t('brain.policies.editRules')}
                                </Button>
                              )}
                            </div>
                          </div>
                          {isEditingThis ? (
                            <RuleEditor rules={editingRules} target="edit" />
                          ) : packRules.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground text-sm">
                              <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-30" />
                              No enforcement rules defined. Click "{t('brain.policies.editRules')}" to add rules.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {packRules.map((rule, idx) => (
                                <div key={rule.ruleId || idx} className="rounded-lg border bg-background p-3">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs text-muted-foreground">{rule.ruleId}</span>
                                      <span className="text-sm font-medium">{rule.name}</span>
                                    </div>
                                    <ActionBadge action={rule.action} />
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                                    <span className="text-primary">{rule.condition.field}</span>
                                    <span>{rule.condition.operator}</span>
                                    <span className="text-amber-600">
                                      {typeof rule.condition.value === "object"
                                        ? JSON.stringify(rule.condition.value)
                                        : String(rule.condition.value)}
                                    </span>
                                  </div>
                                  {rule.reason && (
                                    <p className="text-xs text-muted-foreground mt-1 italic">{rule.reason}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
