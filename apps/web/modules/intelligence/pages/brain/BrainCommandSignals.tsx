import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  CircleGauge,
  Cloud,
  GitBranch,
  Lock,
  Radar,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar as RadarShape,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BRAIN_LAYERS, extractProjectName } from "@/lib/brain-utils";
import type { LayerConfig } from "@/api/brain";

type DashboardStats = {
  total?: number;
  processing?: number;
  pending?: number;
  blocked?: number;
  completed?: number;
  needsInfo?: number;
  todayCount?: number;
  byClassification?: Record<string, number>;
};

type EngineStats = {
  attestations?: number;
  redactionReceipts?: number;
  boundary?: {
    totalRuns?: number;
    internalRuns?: number;
    externalRuns?: number;
    internalPct?: number;
    externalPct?: number;
    maskedExternalRuns?: number;
    maskedExternalPct?: number;
    blockedAttempts?: number;
    blockedApprovalAttempts?: number;
    executionsWithoutApproval?: number;
  };
};

type LearningStats = {
  totalArtifacts?: number;
  draftCount?: number;
  activeCount?: number;
  activations?: number;
  policyCount?: number;
  policyVersionCount?: number;
};

type BrainCommandSignalsProps = {
  stats: DashboardStats;
  engines: EngineStats;
  learning: LearningStats;
  recentDecisions: Array<Record<string, unknown>>;
  layers: LayerConfig[];
  controlPlane: Record<string, unknown>;
};

const COLORS = {
  blue: "#2563eb",
  cyan: "#0891b2",
  violet: "#7c3aed",
  amber: "#d97706",
  emerald: "#059669",
  rose: "#e11d48",
  slate: "#64748b",
  indigo: "#4f46e5",
};

function asNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function percent(part: number, total: number): number {
  return total > 0 ? clamp((part / total) * 100) : 0;
}

function statusOf(decision: Record<string, unknown>): string {
  return String(decision.status || "unknown").toLowerCase();
}

function classificationOf(decision: Record<string, unknown>): string {
  const raw = decision.classification;
  if (typeof raw === "string") return raw.toLowerCase();
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    return String(record.classificationLevel || record.level || "internal").toLowerCase();
  }
  return "internal";
}

function computeTrust(stats: DashboardStats, engines: EngineStats, learning: LearningStats, layers: LayerConfig[]) {
  const total = asNumber(stats.total);
  const risky = asNumber(stats.blocked) + asNumber(stats.needsInfo) + asNumber(stats.pending);
  const completion = percent(asNumber(stats.completed), total);
  const friction = total > 0 ? clamp(100 - percent(risky, total)) : 100;
  const layerReadiness = layers.length > 0 ? percent(layers.filter((layer) => layer.enabled && layer.mode !== "bypass").length, layers.length) : 100;
  const boundary = engines.boundary || {};
  const approvalSafety = asNumber(boundary.executionsWithoutApproval) > 0 ? 0 : 100;
  const redactionCoverage = asNumber(boundary.externalRuns) > 0 ? asNumber(boundary.maskedExternalPct) : 100;
  const attestationCoverage = asNumber(engines.attestations) >= asNumber(boundary.totalRuns) || asNumber(boundary.totalRuns) === 0
    ? 100
    : percent(asNumber(engines.attestations), asNumber(boundary.totalRuns));
  const learningActivation = asNumber(learning.totalArtifacts) > 0
    ? percent(asNumber(learning.activeCount) + asNumber(learning.activations), asNumber(learning.totalArtifacts) + asNumber(learning.activations))
    : 70;

  const components = [
    { key: "Completion", score: completion || 70, color: COLORS.emerald },
    { key: "Friction", score: friction, color: COLORS.amber },
    { key: "Layers", score: layerReadiness, color: COLORS.blue },
    { key: "Approval", score: approvalSafety, color: COLORS.rose },
    { key: "Redaction", score: redactionCoverage, color: COLORS.cyan },
    { key: "Attestation", score: attestationCoverage, color: COLORS.indigo },
    { key: "Learning", score: learningActivation, color: COLORS.violet },
  ];
  const score = clamp(components.reduce((sum, item) => sum + item.score, 0) / components.length);
  return { score, components };
}

export function BrainCommandSignals({
  stats,
  engines,
  learning,
  recentDecisions,
  layers,
  controlPlane,
}: BrainCommandSignalsProps) {
  const total = asNumber(stats.total);
  const trust = computeTrust(stats, engines, learning, layers);
  const boundary = engines.boundary || {};
  const criticalCount = asNumber(stats.blocked) + asNumber(stats.needsInfo) + asNumber(stats.pending) + asNumber(boundary.executionsWithoutApproval);
  const policyMode = String(controlPlane.policyMode || "enforce");

  const radialData = [{ name: "Trust", value: trust.score, fill: trust.score >= 85 ? COLORS.emerald : trust.score >= 70 ? COLORS.amber : COLORS.rose }];
  const boundaryData = [
    { name: "Internal", value: asNumber(boundary.internalRuns), color: COLORS.emerald },
    { name: "External", value: asNumber(boundary.externalRuns), color: COLORS.blue },
    { name: "Blocked", value: asNumber(boundary.blockedAttempts), color: COLORS.rose },
  ].filter((item) => item.value > 0);

  const lifecycleData = BRAIN_LAYERS.filter((layer) => layer.id >= 1 && layer.id <= 8).map((layer) => {
    const cfg = layers.find((item) => item.id === layer.id);
    const enabled = cfg?.enabled !== false;
    const modeScore = cfg?.mode === "bypass" ? 20 : cfg?.mode === "monitor" ? 70 : 100;
    const timeoutScore = cfg?.timeoutMs === 0 ? 80 : cfg?.timeoutMs ? 100 : 85;
    return {
      layer: layer.short,
      readiness: enabled ? Math.round((modeScore + timeoutScore) / 2) : 0,
      sla: cfg?.slaMs ? clamp(100 - Math.min(70, cfg.slaMs / 2500)) : 75,
      color: layer.color === "orange" ? COLORS.amber : layer.color === "teal" ? COLORS.cyan : COLORS.blue,
    };
  });

  const statusFlowData = [
    { name: "Intake", value: total, color: COLORS.blue },
    { name: "Processing", value: asNumber(stats.processing), color: COLORS.violet },
    { name: "Approval", value: asNumber(stats.pending), color: COLORS.amber },
    { name: "Blocked", value: asNumber(stats.blocked), color: COLORS.rose },
    { name: "Complete", value: asNumber(stats.completed), color: COLORS.emerald },
  ];

  const classificationData = Object.entries(stats.byClassification || {}).map(([name, value]) => ({
    name: name.toUpperCase(),
    value,
    exposure: name.toLowerCase() === "public" ? 20 : name.toLowerCase() === "internal" ? 45 : name.toLowerCase() === "confidential" ? 75 : 95,
  }));

  const frictionData = [
    { name: "Policy", blocked: asNumber(stats.blocked), attention: asNumber(stats.needsInfo), safe: Math.max(0, total - criticalCount) },
    { name: "Approval", blocked: asNumber(boundary.blockedApprovalAttempts), attention: asNumber(stats.pending), safe: asNumber(stats.completed) },
    { name: "Boundary", blocked: asNumber(boundary.blockedAttempts), attention: asNumber(boundary.externalRuns), safe: asNumber(boundary.internalRuns) },
  ];

  const pulseData = recentDecisions.slice(0, 8).map((decision, index) => {
    const status = statusOf(decision);
    const cls = classificationOf(decision);
    const risk = status === "blocked" ? 98 : status === "needs_info" ? 78 : status.includes("approval") || status === "validation" ? 66 : 30;
    const classWeight = cls === "sovereign" ? 90 : cls === "confidential" ? 70 : cls === "internal" ? 45 : 20;
    return {
      name: `D${index + 1}`,
      title: extractProjectName(decision),
      risk,
      classification: classWeight,
      confidence: clamp(100 - risk / 2 + index * 2),
    };
  });

  const watchlist = recentDecisions
    .filter((decision) => ["blocked", "needs_info", "validation", "pending_approval"].includes(statusOf(decision)))
    .slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1.4fr_1fr]">
        <Card className="overflow-hidden border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleGauge className="h-4 w-4 text-emerald-600" />
              Brain Trust Core
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-[150px_1fr] gap-3">
            <div className="relative h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart data={radialData} innerRadius="70%" outerRadius="100%" startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "#e2e8f0" }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tracking-tight">{trust.score}</span>
                <span className="text-[10px] uppercase text-muted-foreground">trust</span>
              </div>
            </div>
            <div className="space-y-2 self-center">
              {trust.components.slice(1, 6).map((item) => (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{item.key}</span>
                    <span className="font-mono font-semibold">{Math.round(item.score)}</span>
                  </div>
                  <Progress value={item.score} className="h-1.5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-4 w-4 text-blue-600" />
              Lifecycle Readiness Radar
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={lifecycleData}>
                <PolarGrid stroke="#cbd5e1" />
                <PolarAngleAxis dataKey="layer" tick={{ fill: "#64748b", fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                <RadarShape dataKey="readiness" stroke={COLORS.blue} fill={COLORS.blue} fillOpacity={0.22} />
                <RadarShape dataKey="sla" stroke={COLORS.violet} fill={COLORS.violet} fillOpacity={0.12} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Critical Pressure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-end justify-between">
                <span className="text-4xl font-bold tracking-tight">{criticalCount}</span>
                <Badge variant={criticalCount > 0 ? "destructive" : "outline"} className="text-[10px]">
                  {policyMode.toUpperCase()}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Blocked, waiting, incomplete, or unsafe execution signals.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SignalTile icon={Lock} label="No-approval executions" value={asNumber(boundary.executionsWithoutApproval)} danger />
              <SignalTile icon={Cloud} label="External boundary" value={asNumber(boundary.externalRuns)} />
              <SignalTile icon={ShieldCheck} label="Receipts" value={asNumber(engines.redactionReceipts)} />
              <SignalTile icon={Brain} label="Active learning" value={asNumber(learning.activeCount)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4 text-indigo-600" />
              Decision Flow Pressure
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={statusFlowData} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="brainFlow" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={COLORS.blue} stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke={COLORS.blue} fill="url(#brainFlow)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Policy, Approval, Boundary Friction
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={frictionData} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="safe" stackId="a" fill={COLORS.emerald} radius={[0, 0, 4, 4]} />
                <Bar dataKey="attention" stackId="a" fill={COLORS.amber} />
                <Bar dataKey="blocked" stackId="a" fill={COLORS.rose} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_0.9fr]">
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Radar className="h-4 w-4 text-violet-600" />
              Classification Exposure Mix
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={classificationData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS.indigo} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="exposure" stroke={COLORS.rose} strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cloud className="h-4 w-4 text-cyan-600" />
              Engine Boundary Split
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            {boundaryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={boundaryData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
                    {boundaryData.map((item) => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState />
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-amber-600" />
              Live Decision Watchlist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {watchlist.length > 0 ? watchlist.map((decision) => (
              <div key={String(decision.id || decision.correlationId || extractProjectName(decision))} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{extractProjectName(decision)}</p>
                  <Badge variant="outline" className="text-[10px]">{statusOf(decision)}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                  <span>{classificationOf(decision)}</span>
                  <span>{String(decision.serviceId || "brain")}</span>
                  <span className="text-right">{String(decision.currentLayer || "--")}/8</span>
                </div>
              </div>
            )) : (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Clear watchlist
              </div>
            )}
            {pulseData.length > 0 && (
              <div className="h-[100px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={pulseData} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="classification" fill={COLORS.slate} radius={[3, 3, 0, 0]} />
                    <Line type="monotone" dataKey="risk" stroke={COLORS.rose} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="confidence" stroke={COLORS.emerald} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SignalTile({
  icon: Icon,
  label,
  value,
  danger = false,
}: {
  icon: typeof Lock;
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${danger && value > 0 ? "text-rose-600" : "text-slate-500"}`} />
        <span className="truncate">{label}</span>
      </div>
      <p className={`mt-1 font-mono text-lg font-bold ${danger && value > 0 ? "text-rose-600" : ""}`}>{value}</p>
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-muted-foreground dark:border-slate-700">
      No boundary runs yet
    </div>
  );
}
