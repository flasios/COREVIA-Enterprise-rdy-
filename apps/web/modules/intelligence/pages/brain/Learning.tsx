import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from 'react-i18next';
import {
  GraduationCap, BookOpen, FileText, CheckCircle2, Clock,
  TrendingUp, Sparkles, Shield, ShieldCheck,
  Activity, Layers, Search, RefreshCw, AlertCircle, Cpu, Zap,
  Download, Database, PlayCircle, Loader2,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface LearningStats {
  totalArtifacts: number;
  draftCount: number;
  activeCount: number;
  activations: number;
  policyCount: number;
  policyVersionCount: number;
}

interface LearningArtifactRow {
  id: string;
  title?: string;
  name?: string;
  type?: string;
  version?: number | string;
  status?: string;
  description?: string;
  activations?: number;
  createdAt?: string;
  sourceDecisionId?: string;
  content?: Record<string, unknown>;
}

interface LearningPolicyRow {
  id: string;
  name?: string;
  scope?: string;
  version?: number | string;
  enforcement?: string;
  description?: string;
}

interface R1StatusData {
  engine?: {
    isRunning?: boolean;
    recentSessions?: R1Session[];
  };
  insights?: {
    total?: number;
    byType?: {
      pattern?: number;
      assumption?: number;
    };
    recent?: R1Insight[];
  };
}

function safeStr(val: unknown, fallback: string): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return fallback;
}

function sessionStatusColor(status: string): string {
  if (status === 'completed') return 'text-emerald-600';
  if (status === 'failed') return 'text-red-600';
  return 'text-amber-600';
}

async function fetchLearningStats(): Promise<LearningStats | null> {
  const res = await fetch("/api/corevia/stats/learning");
  if (!res.ok) return null;
  const data = await res.json();
  return (data.stats as LearningStats) ?? null;
}

async function fetchArtifacts(): Promise<LearningArtifactRow[]> {
  const res = await fetch("/api/corevia/learning/artifacts?limit=20");
  if (!res.ok) return [];
  const data = await res.json();
  return ((data.artifacts || []) as Record<string, unknown>[]).map((a) => ({
    id: safeStr(a.id, ""),
    title: safeStr(a.title ?? a.artifactType ?? a.assetType, "Artifact"),
    type: safeStr(a.type ?? a.artifactType ?? a.assetType, "unknown"),
    version: a.version as number | string,
    status: safeStr(a.status, "draft"),
    description: a.description as string | undefined
      ?? (a.content && typeof a.content === "object"
        ? `Phase: ${safeStr((a.content as Record<string, unknown>).decisionPhase, "—")} · Sub-type: ${safeStr((a.content as Record<string, unknown>).subDecisionType, "—")}`
        : undefined),
    activations: (a.activations as number) || 0,
    createdAt: a.createdAt as string | undefined,
    sourceDecisionId: a.sourceDecisionId as string | undefined,
    content: a.content as Record<string, unknown> | undefined,
  })) as LearningArtifactRow[];
}

async function fetchPolicies(): Promise<LearningPolicyRow[]> {
  const res = await fetch("/api/corevia/policies?limit=20");
  if (!res.ok) return [];
  const data = await res.json();
  return (data.policies as LearningPolicyRow[]) || [];
}

export function Learning() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: stats } = useQuery<LearningStats | null>({
    queryKey: ["/brain/stats/learning"],
    queryFn: fetchLearningStats,
    refetchInterval: 12000,
  });
  const { data: artifacts } = useQuery<LearningArtifactRow[]>({
    queryKey: ["/brain/artifacts"],
    queryFn: fetchArtifacts,
    refetchInterval: 15000,
  });
  const { data: policies } = useQuery<LearningPolicyRow[]>({
    queryKey: ["/brain/policies"],
    queryFn: fetchPolicies,
    refetchInterval: 15000,
  });
  const { data: r1Data } = useQuery<R1StatusData | null>({
    queryKey: ["/brain/r1-learning/status"],
    queryFn: async () => {
      const res = await fetch("/api/corevia/r1-learning/status");
      if (!res.ok) return null;
      return (await res.json()) as R1StatusData;
    },
    refetchInterval: 10000,
  });

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/corevia/r1-learning/trigger", { method: "POST" });
      if (!res.ok) throw new Error("Session failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: t('brain.learning.r1Complete'), description: data.message });
    },
    onError: (err: unknown) => {
      toast({
        title: t('brain.learning.sessionFailed'),
        description: err instanceof Error ? err.message : "Session failed",
        variant: "destructive",
      });
    },
  });

  const s = stats || { totalArtifacts: 0, draftCount: 0, activeCount: 0, activations: 0, policyCount: 0, policyVersionCount: 0 };

  type ExportFormat = "jsonl" | "json" | "conversation";
  const [exportFormat, setExportFormat] = useState<ExportFormat>("jsonl");

  // Engine C fine-tuning health + status
  const { data: fineTuneHealth } = useQuery<{ available: boolean; gpu_available?: boolean; gpu_name?: string; active_jobs?: number } | null>({
    queryKey: ["/brain/fine-tune/health"],
    queryFn: async () => {
      const res = await fetch("/api/corevia/learning/fine-tune/health");
      if (!res.ok) return null;
      return res.json() as Promise<{ available: boolean; gpu_available?: boolean; gpu_name?: string; active_jobs?: number }>;
    },
    refetchInterval: 15000,
  });

  const { data: fineTuneStatus, refetch: refetchFineTune } = useQuery<{ jobs?: Array<{ id: string; status: string; base_model?: string; progress_pct?: number; training_loss?: number; current_epoch?: number; epochs?: number; ollama_model_name?: string; error?: string }> } | null>({
    queryKey: ["/brain/fine-tune/status"],
    queryFn: async () => {
      const res = await fetch("/api/corevia/learning/fine-tune/status");
      if (!res.ok) return null;
      return res.json() as Promise<{ jobs?: Array<{ id: string; status: string; base_model?: string; progress_pct?: number; training_loss?: number; current_epoch?: number; epochs?: number; ollama_model_name?: string; error?: string }> }>;
    },
    refetchInterval: 5000,
  });

  const fineTuneMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/corevia/learning/fine-tune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseModel: "mistral-nemo",
          ollamaModelName: "corevia-mistral-nemo",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" })) as { error?: string };
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ success: boolean; message: string; job: { id: string; trainingSamples: number } }>;
    },
    onSuccess: (data) => {
      toast({
        title: t('brain.learning.fineTuneStarted', 'Fine-Tuning Started'),
        description: data.message || `Training with ${data.job?.trainingSamples || 0} samples`,
      });
      refetchFineTune();
    },
    onError: (err: unknown) => {
      toast({
        title: t('brain.learning.fineTuneFailed', 'Fine-Tuning Failed'),
        description: err instanceof Error ? err.message : "Could not start training",
        variant: "destructive",
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (format: "jsonl" | "json" | "conversation") => {
      const res = await fetch("/api/corevia/learning/llm-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          includeDecisionContext: true,
        }),
      });
      if (!res.ok) throw new Error("Export failed");

      if (format === "jsonl") {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `corevia-training-${new Date().toISOString().slice(0, 10)}.jsonl`;
        a.click();
        URL.revokeObjectURL(url);
        return { downloaded: true, total: 0 };
      }

      return res.json() as Promise<{ success: boolean; total: number; records: unknown[] }>;
    },
    onSuccess: (data) => {
      toast({
        title: t('brain.learning.exportSuccess', 'LLM Training Data Exported'),
        description: ('downloaded' in data && data.downloaded)
          ? t('brain.learning.exportDownloaded', 'Training data file downloaded successfully.')
          : t('brain.learning.exportRecords', { count: data.total, defaultValue: `${data.total} training records exported.` }),
      });
    },
    onError: (err: unknown) => {
      toast({
        title: t('brain.learning.exportFailed', 'Export Failed'),
        description: err instanceof Error ? err.message : "Export failed",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-teal-500" />
          {t('brain.learning.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('brain.learning.description')}
        </p>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={Layers} label={t('brain.learning.totalArtifacts')} value={s.totalArtifacts} accent="teal" />
        <StatCard icon={Clock} label={t('brain.learning.draft')} value={s.draftCount} accent="slate" />
        <StatCard icon={CheckCircle2} label={t('brain.learning.active')} value={s.activeCount} accent="emerald" />
        <StatCard icon={Activity} label={t('brain.learning.activations')} value={s.activations} accent="violet" />
        <StatCard icon={Shield} label={t('brain.learning.policies')} value={s.policyCount} accent="amber" />
        <StatCard icon={RefreshCw} label={t('brain.learning.policyVersions')} value={s.policyVersionCount} accent="blue" />
      </div>

      {/* Tabs: Artifacts / Policies / How It Works */}
      <Tabs defaultValue="artifacts">
        <TabsList className="bg-slate-100 dark:bg-slate-800">
          <TabsTrigger value="artifacts" className="gap-1.5 text-xs">
            <BookOpen className="h-3.5 w-3.5" /> {t('brain.learning.artifacts')}
          </TabsTrigger>
          <TabsTrigger value="policies" className="gap-1.5 text-xs">
            <Shield className="h-3.5 w-3.5" /> {t('brain.learning.policiesTab')}
          </TabsTrigger>
          <TabsTrigger value="how" className="gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5" /> {t('brain.learning.howItWorks')}
          </TabsTrigger>
          <TabsTrigger value="r1" className="gap-1.5 text-xs">
            <Cpu className="h-3.5 w-3.5" /> {t('brain.learning.r1Engine')}
          </TabsTrigger>
        </TabsList>

        {/* Artifacts Tab */}
        <TabsContent value="artifacts" className="mt-4 space-y-4">
          {(artifacts || []).length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t('brain.learning.noArtifacts')}
              description={t('brain.learning.noArtifactsDesc')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(artifacts || []).map((a) => (
                <ArtifactCard key={a.id} artifact={a} />
              ))}
            </div>
          )}

          {/* LLM Tuning Export Panel */}
          <Card className="border-violet-200 dark:border-violet-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Database className="h-4 w-4 text-violet-500" />
                {t('brain.learning.llmTuningTitle', 'LLM Fine-Tuning Export')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {t('brain.learning.llmTuningDescription', 'Export learning artifacts as training data for LLM fine-tuning. Each artifact is converted into a structured training record with decision context, suitable for instruction-tuning or conversation-format fine-tuning.')}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">{t('brain.learning.exportFormat', 'Format')}:</label>
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as "jsonl" | "json" | "conversation")}
                    className="text-xs border rounded-md px-2 py-1 bg-background"
                  >
                    <option value="jsonl">JSONL (OpenAI / DeepSeek)</option>
                    <option value="conversation">Conversation (Chat Format)</option>
                    <option value="json">JSON (Full Records)</option>
                  </select>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={() => exportMutation.mutate(exportFormat)}
                  disabled={exportMutation.isPending || (artifacts || []).length === 0}
                >
                  {exportMutation.isPending ? (
                    <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> {t('brain.learning.exporting', 'Exporting...')}</>
                  ) : (
                    <><Download className="h-3.5 w-3.5" /> {t('brain.learning.exportTrainingData', 'Export Training Data')}</>
                  )}
                </Button>
              </div>

              <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-lg p-3">
                <p className="text-[11px] text-violet-700 dark:text-violet-400">
                  <span className="font-semibold">{t('brain.learning.llmExportNote', 'Note')}:</span>{" "}
                  {t('brain.learning.llmExportNoteDesc', 'Each artifact generates one training record containing the artifact content, decision context, risk assessment, and COREVIA Brain analysis. Use JSONL format for OpenAI/DeepSeek fine-tuning, or Conversation format for chat model training.')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Engine C Fine-Tuning Panel */}
          <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-orange-500" />
                {t('brain.learning.fineTuneTitle', 'Fine-Tune Engine A')}
                {fineTuneHealth?.available ? (
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200">
                    GPU: {fineTuneHealth.gpu_name || "Ready"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-950/30 text-slate-500 border-slate-200">
                    {t('brain.learning.engineOffline', 'Engine Offline')}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {t('brain.learning.fineTuneDescription', 'Run LoRA fine-tuning on Engine A using your learning artifacts. The fine-tuned model is automatically registered in Ollama as "corevia-mistral-nemo" for sovereign inference.')}
              </p>

              {/* Active jobs */}
              {(fineTuneStatus?.jobs || []).filter((j) => !["completed", "failed", "cancelled"].includes(j.status)).map((job) => (
                <div key={job.id} className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-orange-700 dark:text-orange-400 capitalize">
                      {job.status === "training" ? `Training — Epoch ${job.current_epoch || 0}/${job.epochs || 3}` : job.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{Math.round(job.progress_pct || 0)}%</span>
                  </div>
                  <div className="w-full bg-orange-200 dark:bg-orange-900 rounded-full h-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, job.progress_pct || 0)}%` }}
                    />
                  </div>
                  {typeof job.training_loss === "number" && (
                    <p className="text-[11px] text-muted-foreground">
                      Loss: {job.training_loss.toFixed(4)} · Model: {job.ollama_model_name || "corevia-mistral-nemo"}
                    </p>
                  )}
                </div>
              ))}

              {/* Completed jobs */}
              {(fineTuneStatus?.jobs || []).filter((j) => j.status === "completed").slice(0, 2).map((job) => (
                <div key={job.id} className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs text-emerald-700 dark:text-emerald-400">
                    {job.ollama_model_name || "corevia-mistral-nemo"} — Fine-tuned
                  </span>
                </div>
              ))}

              {/* Failed jobs */}
              {(fineTuneStatus?.jobs || []).filter((j) => j.status === "failed").slice(0, 1).map((job) => (
                <div key={job.id} className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-2 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-xs text-red-700 dark:text-red-400 truncate">
                    {job.error || "Training failed"}
                  </span>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="gap-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={() => fineTuneMutation.mutate()}
                  disabled={
                    fineTuneMutation.isPending ||
                    !fineTuneHealth?.available ||
                    (fineTuneHealth?.active_jobs ?? 0) > 0 ||
                    (artifacts || []).length < 5
                  }
                >
                  {fineTuneMutation.isPending ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('brain.learning.starting', 'Starting...')}</>
                  ) : (
                    <><PlayCircle className="h-3.5 w-3.5" /> {t('brain.learning.startFineTune', 'Start Fine-Tuning')}</>
                  )}
                </Button>
                {(artifacts || []).length < 5 && (
                  <span className="text-[11px] text-muted-foreground">
                    {t('brain.learning.minArtifacts', 'Need at least 5 artifacts')}
                  </span>
                )}
              </div>

              <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                <p className="text-[11px] text-orange-700 dark:text-orange-400">
                  <span className="font-semibold">{t('brain.learning.fineTuneNote', 'How it works')}:</span>{" "}
                  {t('brain.learning.fineTuneNoteDesc', 'Your learning artifacts are converted to training data, then LoRA fine-tuning runs on GPU via Engine C. The fine-tuned model is converted to GGUF and pushed to Ollama, replacing the base model for future decisions.')}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies" className="mt-4">
          {(policies || []).length === 0 ? (
            <EmptyState
              icon={Shield}
              title={t('brain.learning.noPolicies')}
              description={t('brain.learning.noPoliciesDesc')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(policies || []).map((p) => (
                <PolicyCard key={p.id} policy={p} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* How It Works Tab */}
        <TabsContent value="how" className="mt-4">
          <Card className="border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{t('brain.learning.pipelineTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('brain.learning.pipelineDescription')}
              </p>

              <Separator />

              <div className="space-y-3">
                <PipelineStep
                  step="1"
                  title={t('brain.learning.step1Title')}
                  description={t('brain.learning.step1Desc')}
                  icon={ShieldCheck}
                  color="emerald"
                />
                <PipelineStep
                  step="2"
                  title={t('brain.learning.step2Title')}
                  description={t('brain.learning.step2Desc')}
                  icon={FileText}
                  color="blue"
                />
                <PipelineStep
                  step="3"
                  title={t('brain.learning.step3Title')}
                  description={t('brain.learning.step3Desc')}
                  icon={Search}
                  color="violet"
                />
                <PipelineStep
                  step="4"
                  title={t('brain.learning.step4Title')}
                  description={t('brain.learning.step4Desc')}
                  icon={TrendingUp}
                  color="teal"
                />
              </div>

              <Separator />

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Important: No Auto-Learning
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400/80 mt-1">
                  {t('brain.learning.noAutoLearningDesc')}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* R1 Engine Tab */}
        <TabsContent value="r1" className="mt-4 space-y-4">
          {/* R1 Status Card */}
          <Card className="border-teal-200 dark:border-teal-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Cpu className="h-4 w-4 text-teal-500" />
                {t('brain.learning.r1EngineTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t('brain.learning.status')}</p>
                  <p className="text-xs text-muted-foreground">DeepSeek R1 · Layer 8 · Autonomous Pattern Discovery</p>
                </div>
                <Badge className={r1Data?.engine?.isRunning
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"}>
                  {r1Data?.engine?.isRunning ? "LEARNING" : "IDLE"}
                </Badge>
              </div>

              {/* R1 Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border bg-muted/30 text-center">
                  <p className="text-lg font-bold font-mono">{r1Data?.insights?.total || 0}</p>
                  <p className="text-[10px] text-muted-foreground">{t('brain.learning.totalInsights')}</p>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30 text-center">
                  <p className="text-lg font-bold font-mono">{r1Data?.insights?.byType?.pattern || 0}</p>
                  <p className="text-[10px] text-muted-foreground">{t('brain.learning.patternsFound')}</p>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30 text-center">
                  <p className="text-lg font-bold font-mono">{r1Data?.insights?.byType?.assumption || 0}</p>
                  <p className="text-[10px] text-muted-foreground">{t('brain.learning.assumptions')}</p>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30 text-center">
                  <p className="text-lg font-bold font-mono">{r1Data?.engine?.recentSessions?.length || 0}</p>
                  <p className="text-[10px] text-muted-foreground">{t('brain.learning.sessions')}</p>
                </div>
              </div>

              {/* Trigger Button */}
              <Button
                onClick={() => triggerMutation.mutate()}
                disabled={triggerMutation.isPending || r1Data?.engine?.isRunning}
                className="w-full gap-2"
                variant="outline"
              >
                {triggerMutation.isPending || r1Data?.engine?.isRunning ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> {t('brain.learning.runningSession')}</>
                ) : (
                  <><Zap className="h-4 w-4" /> {t('brain.learning.triggerSession')}</>
                )}
              </Button>

              <Separator />

              {/* Recent Sessions */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t('brain.learning.recentSessions')}</p>
                {(r1Data?.engine?.recentSessions || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">{t('brain.learning.noSessions')}</p>
                ) : (
                  <div className="space-y-2">
                    {(r1Data?.engine?.recentSessions || []).slice(0, 5).map((session: R1Session) => (
                      <div key={session.id} className="p-3 rounded-lg border bg-muted/20 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs">{session.id}</span>
                          <Badge variant="outline" className={`text-[9px] ${sessionStatusColor(session.status)}`}>
                            {session.status}
                          </Badge>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{session.decisionsAnalyzed} decisions</span>
                          <span>{session.patternsIdentified} patterns</span>
                          <span>{session.newAssumptions} assumptions</span>
                          <span>{session.insightsGenerated} insights</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Recent Insights */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t('brain.learning.latestInsights')}</p>
                {(r1Data?.insights?.recent || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">{t('brain.learning.noInsights')}</p>
                ) : (
                  <div className="space-y-2">
                    {(r1Data?.insights?.recent || []).slice(0, 8).map((insight: R1Insight) => (
                      <div key={insight.id} className="p-3 rounded-lg border bg-muted/20">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold truncate">{insight.title}</p>
                          <Badge variant="outline" className="text-[9px] shrink-0">{insight.type}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{insight.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Confidence: {Math.round(insight.confidence * 100)}% · Applies to: {(insight.appliesTo || []).join(", ") || "general"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== R1 TYPES ====================
interface R1Session {
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

interface R1Insight {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: number;
  sourceDecisions: string[];
  generatedAt: string;
  appliesTo: string[];
}

// ==================== SUB COMPONENTS ====================

function StatCard({ icon: Icon, label, value, accent }: Readonly<{ icon: LucideIcon; label: string; value: number; accent: string }>) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    teal: { bg: "bg-teal-50 dark:bg-teal-950/30", text: "text-teal-500" },
    slate: { bg: "bg-slate-100 dark:bg-slate-800/50", text: "text-slate-500" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-500" },
    violet: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-500" },
    amber: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-500" },
    blue: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-500" },
  };
  const c = colorMap[accent] ?? { bg: "bg-teal-50 dark:bg-teal-950/30", text: "text-teal-500" };

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-md ${c.bg}`}>
            <Icon className={`h-5 w-5 ${c.text}`} />
          </div>
          <div>
            <p className="text-2xl font-bold font-mono">{value}</p>
            <p className="text-xs text-muted-foreground leading-tight">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ArtifactCard({ artifact }: Readonly<{ artifact: LearningArtifactRow }>) {
  const statusMap: Record<string, { label: string; class: string }> = {
    draft: { label: "Draft", class: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
    active: { label: "Active", class: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    in_review: { label: "In Review", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    approved: { label: "Approved", class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    rejected: { label: "Rejected", class: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
    archived: { label: "Archived", class: "bg-gray-100 text-gray-500" },
  };
  const status = statusMap[(artifact.status || "draft").toLowerCase()] ?? { label: "Draft", class: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" };

  // Human-readable artifact type
  const readableType = (artifact.type || "")
    .replace(/^ARTIFACT_/, "")
    .replaceAll('_', ' ')
    .replaceAll(/\b\w/g, (c) => c.toUpperCase()) || "Artifact";

  return (
    <Card className="border-slate-200 dark:border-slate-700 hover:border-teal-200 dark:hover:border-teal-800 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{readableType}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Version: {artifact.version || 1} | ID: {artifact.id}
            </p>
          </div>
          <Badge className={`text-[10px] ${status.class}`}>{status.label}</Badge>
        </div>
        {artifact.description && (
          <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{artifact.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {artifact.activations || 0} activations
          </span>
          {artifact.createdAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(artifact.createdAt).toLocaleDateString()}
            </span>
          )}
          {artifact.sourceDecisionId && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {artifact.sourceDecisionId}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PolicyCard({ policy }: Readonly<{ policy: LearningPolicyRow }>) {
  return (
    <Card className="border-slate-200 dark:border-slate-700 hover:border-amber-200 dark:hover:border-amber-800 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{policy.name || `Policy ${policy.id}`}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Scope: {policy.scope || "global"} | Version: {policy.version || 1}
            </p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {policy.enforcement || "enforce"}
          </Badge>
        </div>
        {policy.description && (
          <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{policy.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function PipelineStep({ step, title, description, icon: Icon, color }: Readonly<{
  step: string; title: string; description: string; icon: LucideIcon; color: string;
}>) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-500", blue: "text-blue-500", violet: "text-violet-500", teal: "text-teal-500",
  };

  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 flex-shrink-0">
        {step}
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${colorMap[color] || "text-slate-500"}`} />
          <p className="text-xs font-semibold">{title}</p>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: Readonly<{ icon: LucideIcon; title: string; description: string }>) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-14 w-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
        <Icon className="h-7 w-7 text-slate-300 dark:text-slate-600" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>
    </div>
  );
}
