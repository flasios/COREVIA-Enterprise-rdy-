// ──────────────────────────────────────────────────────────────────────────
// Wave 3 — EA Spine Overlay
// Surfaces the canonical graph, explainable scores, and governance decision
// from `artifact.spine` on top of the existing Enterprise Architecture tabs.
// Non-destructive: legacy tab content continues to render; these overlays
// add traceability, scoring transparency, and an authoritative decision block.
// ──────────────────────────────────────────────────────────────────────────
import { Fragment, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Workflow,
  Database,
  Network,
  Layers,
  Building2,
  Gauge,
  Target,
  FlaskConical,
  GitBranch,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { deriveSpineDecision, type EaSpine } from "@shared/contracts/enterprise-architecture";

// ──────────────────────────────────────────────────────────────────────────
// Decision Banner — shown above the Tabs, visible on every tab
// ──────────────────────────────────────────────────────────────────────────
const DECISION_VISUALS: Record<
  NonNullable<EaSpine["decision"]>["status"],
  { label: string; tone: string; icon: typeof ShieldCheck }
> = {
  "fully-approved": {
    label: "Fully Approved",
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: ShieldCheck,
  },
  "approved-with-risk-acceptance": {
    label: "Approved w/ Risk Acceptance",
    tone: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    icon: CheckCircle2,
  },
  "conditional-approval": {
    label: "Conditional Approval",
    tone: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    icon: AlertTriangle,
  },
  blocked: {
    label: "Blocked",
    tone: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    icon: ShieldAlert,
  },
  rejected: {
    label: "Rejected",
    tone: "border-rose-600/40 bg-rose-600/10 text-rose-700 dark:text-rose-300",
    icon: ShieldAlert,
  },
};

export function SpineDecisionBanner({ spine }: { spine: EaSpine | undefined | null }) {
  const decision = spine?.decision;

  // Persisted display mode: "expanded" | "compact" | "hidden"
  // - expanded: full banner with blocking / unlock / HITL sections (original)
  // - compact: single strip with status + counts only (default)
  // - hidden: replaced by a tiny "show" pill so it can be brought back
  type Mode = "expanded" | "compact" | "hidden";
  const STORAGE_KEY = "ea.decisionBanner.mode";
  const [mode, setMode] = useState<Mode>("compact");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Mode | null;
      if (saved === "expanded" || saved === "compact" || saved === "hidden") setMode(saved);
    } catch {
      /* ignore */
    }
  }, []);
  const persistMode = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  if (!spine || !decision) return null;

  const visual = DECISION_VISUALS[decision.status] ?? DECISION_VISUALS["conditional-approval"];
  const Icon = visual.icon;
  const flags = decision.policyFlagCounts ?? { critical: 0, high: 0, medium: 0 };
  const blocking = decision.blockingIssues ?? [];
  const unlocks = decision.topUnlockActions ?? [];
  const hitlTriggers = decision.hitlTriggers ?? [];

  // Hidden: tiny re-show pill so the engine output is never truly gone.
  if (mode === "hidden") {
    return (
      <div className="mb-2 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className={`h-6 gap-1 border-current px-2 text-[10px] ${visual.tone}`}
          onClick={() => persistMode("compact")}
        >
          <Icon className="h-3 w-3" />
          EA Decision · {visual.label}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Compact strip — default. One-line summary, click to expand.
  if (mode === "compact") {
    const topUnlock = unlocks[0];
    return (
      <Card className={`mb-3 border ${visual.tone} shadow-sm`}>
        <CardContent className="flex flex-wrap items-center gap-2 p-2 text-xs">
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">EA Decision</span>
          <Badge variant="outline" className="border-current bg-background/50 text-[10px] font-semibold">
            {visual.label}
          </Badge>
          {decision.hitlRequired ? (
            <Badge
              variant="outline"
              className="border-amber-500/60 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
            >
              HITL
            </Badge>
          ) : null}

          <div className="flex items-center gap-1">
            <CountChip count={flags.critical} label="C" tone="border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300" />
            <CountChip count={flags.high} label="H" tone="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" />
            <CountChip count={flags.medium} label="M" tone="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300" />
            {blocking.length > 0 ? (
              <CountChip
                count={blocking.length}
                label="BLK"
                tone="border-rose-600/50 bg-rose-600/10 text-rose-700 dark:text-rose-300"
              />
            ) : null}
          </div>

          {topUnlock ? (
            <span className="hidden min-w-0 flex-1 items-center gap-1 truncate text-[11px] text-foreground/80 md:inline-flex">
              <Sparkles className="h-3 w-3 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">{topUnlock.action}</span>
            </span>
          ) : (
            <span className="flex-1" />
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={() => persistMode("expanded")}
            title="Expand decision details"
          >
            <ChevronDown className="h-3 w-3" />
            details
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-[10px] opacity-70 hover:opacity-100"
            onClick={() => persistMode("hidden")}
            title="Hide EA Decision Engine"
          >
            <EyeOff className="h-3 w-3" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Expanded — full banner.
  return (
    <Card className={`mb-3 border-2 ${visual.tone} shadow-sm`}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Icon className="mt-0.5 h-6 w-6 flex-shrink-0" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
                  EA Decision Engine
                </span>
                <Badge variant="outline" className="border-current bg-background/50 font-semibold">
                  {visual.label}
                </Badge>
                {decision.hitlRequired ? (
                  <Badge variant="outline" className="border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    HITL Required
                  </Badge>
                ) : null}
              </div>
              {decision.rationale ? (
                <p className="mt-1 text-sm leading-relaxed text-foreground/90">{decision.rationale}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <PolicyFlagPill count={flags.critical} label="Critical" tone="bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300" />
            <PolicyFlagPill count={flags.high} label="High" tone="bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300" />
            <PolicyFlagPill count={flags.medium} label="Med" tone="bg-sky-500/10 border-sky-500/40 text-sky-700 dark:text-sky-300" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-[10px]"
              onClick={() => persistMode("compact")}
              title="Collapse to compact strip"
            >
              <ChevronUp className="h-3 w-3" />
              collapse
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-[10px] opacity-70 hover:opacity-100"
              onClick={() => persistMode("hidden")}
              title="Hide EA Decision Engine"
            >
              <EyeOff className="h-3 w-3" />
              hide
            </Button>
          </div>
        </div>

        {(blocking.length > 0 || unlocks.length > 0 || hitlTriggers.length > 0) && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {blocking.length > 0 ? (
              <Section title="Blocking Issues" icon={ShieldAlert} tone="text-rose-700 dark:text-rose-300">
                <ul className="space-y-1 text-xs">
                  {blocking.slice(0, 4).map((b, i) => (
                    <li key={i} className="rounded border border-rose-500/20 bg-rose-500/5 px-2 py-1">
                      <span className="font-medium">{b.title}</span>
                      {b.riskId ? (
                        <span className="ml-1 text-[10px] opacity-70">→ {b.riskId}</span>
                      ) : null}
                      {b.cause ? (
                        <span className="ml-1 text-[10px] opacity-70">— {b.cause}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {unlocks.length > 0 ? (
              <Section title="Top Unlock Actions" icon={Sparkles} tone="text-emerald-700 dark:text-emerald-300">
                <ol className="space-y-1 text-xs">
                  {unlocks.slice(0, 4).map((u, i) => (
                    <li key={i} className="rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1">
                      <span className="font-semibold">{i + 1}.</span> {u.action}
                      {u.owner ? <span className="ml-1 text-[10px] opacity-70">({u.owner})</span> : null}
                    </li>
                  ))}
                </ol>
              </Section>
            ) : null}

            {hitlTriggers.length > 0 ? (
              <Section title="HITL Triggers" icon={AlertTriangle} tone="text-amber-700 dark:text-amber-300">
                <ul className="space-y-1 text-xs">
                  {hitlTriggers.slice(0, 4).map((h, i) => (
                    <li key={i} className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1">
                      {h}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CountChip({ count, label, tone }: { count: number; label: string; tone: string }) {
  return (
    <div className={`flex items-center gap-0.5 rounded border px-1.5 py-0.5 ${tone}`}>
      <span className="text-[11px] font-bold leading-none">{count}</span>
      <span className="text-[9px] font-semibold uppercase leading-none opacity-80">{label}</span>
    </div>
  );
}

function PolicyFlagPill({ count, label, tone }: { count: number; label: string; tone: string }) {
  return (
    <div className={`flex items-center gap-1 rounded-md border px-2 py-1 ${tone}`}>
      <span className="text-sm font-bold">{count}</span>
      <span className="text-[10px] uppercase tracking-wider opacity-80">{label}</span>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  icon: typeof ShieldCheck;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className={`mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${tone}`}>
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Per-Tab Traceability Strip — compact entity-count summary + sample IDs
// ──────────────────────────────────────────────────────────────────────────
type TabKind = "business" | "application" | "data" | "technology" | "risk";

const TAB_ENTITIES: Record<TabKind, { key: keyof EaSpine; icon: typeof Building2; label: string; tone: string }[]> = {
  business: [
    { key: "capabilities", icon: Building2, label: "Capabilities", tone: "text-blue-700 dark:text-blue-300 border-blue-500/30 bg-blue-500/5" },
    { key: "valueStreams", icon: Workflow, label: "Value Streams", tone: "text-blue-700 dark:text-blue-300 border-blue-500/30 bg-blue-500/5" },
  ],
  application: [
    { key: "applications", icon: Network, label: "Applications", tone: "text-indigo-700 dark:text-indigo-300 border-indigo-500/30 bg-indigo-500/5" },
    { key: "integrations", icon: Workflow, label: "Integrations", tone: "text-indigo-700 dark:text-indigo-300 border-indigo-500/30 bg-indigo-500/5" },
  ],
  data: [
    { key: "dataDomains", icon: Database, label: "Data Domains", tone: "text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/5" },
    { key: "dataFlows", icon: Workflow, label: "Data Flows", tone: "text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/5" },
  ],
  technology: [
    { key: "technologyComponents", icon: Layers, label: "Tech Components", tone: "text-violet-700 dark:text-violet-300 border-violet-500/30 bg-violet-500/5" },
    { key: "policies", icon: ShieldCheck, label: "Policies", tone: "text-violet-700 dark:text-violet-300 border-violet-500/30 bg-violet-500/5" },
  ],
  risk: [
    { key: "risks", icon: Gauge, label: "Risks", tone: "text-rose-700 dark:text-rose-300 border-rose-500/30 bg-rose-500/5" },
    { key: "policies", icon: ShieldAlert, label: "Policy Controls", tone: "text-rose-700 dark:text-rose-300 border-rose-500/30 bg-rose-500/5" },
  ],
};

export function SpineTraceabilityStrip({
  spine,
  tab,
}: {
  spine: EaSpine | undefined | null;
  tab: TabKind;
}) {
  if (!spine) return null;
  const entities = TAB_ENTITIES[tab];

  return (
    <Card className="mb-3 border-dashed bg-muted/20">
      <CardContent className="flex flex-wrap items-center gap-2 p-2.5 text-xs">
        <Badge variant="outline" className="gap-1 border-muted-foreground/30 font-semibold uppercase tracking-wide">
          <Target className="h-3 w-3" /> Canonical Spine
        </Badge>
        {entities.map(({ key, icon: Icon, label, tone }) => {
          const arr = (spine[key] as unknown as Array<{ id: string; name?: string }> | undefined) ?? [];
          return (
            <div key={String(key)} className={`flex items-center gap-1.5 rounded-md border px-2 py-1 ${tone}`}>
              <Icon className="h-3.5 w-3.5" />
              <span className="font-semibold">{arr.length}</span>
              <span className="opacity-80">{label}</span>
            </div>
          );
        })}
        {spine.decision ? (
          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="opacity-70">Decision:</span>
            <span className="font-semibold uppercase tracking-wider">{spine.decision.status.replace(/-/g, " ")}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Explainable Score Breakdown — rendered on the Risk tab
// ──────────────────────────────────────────────────────────────────────────
const SCORE_LABELS: Array<{ key: keyof EaSpine["scoreBreakdown"]; label: string; inverse: boolean }> = [
  { key: "integrationRisk", label: "Integration Risk", inverse: true },
  { key: "dataSensitivityRisk", label: "Data Sensitivity Risk", inverse: true },
  { key: "architectureComplexity", label: "Architecture Complexity", inverse: true },
  { key: "targetArchitectureAlignment", label: "Target Architecture Alignment", inverse: false },
  { key: "technicalDebt", label: "Technical Debt", inverse: true },
];

export function SpineExplainableScores({ spine }: { spine: EaSpine | undefined | null }) {
  const scores = spine?.scoreBreakdown;
  const hasData = useMemo(() => {
    if (!scores) return false;
    return SCORE_LABELS.some(({ key }) => {
      const s = scores[key];
      return s && (s.value > 0 || (s.contributors?.length ?? 0) > 0);
    });
  }, [scores]);

  if (!spine || !scores || !hasData) return null;

  return (
    <Card className="border-rose-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-rose-600 dark:text-rose-300" />
          Explainable Score Breakdown
          <Badge variant="outline" className="ml-auto text-[10px]">
            Why these numbers?
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {SCORE_LABELS.map(({ key, label, inverse }) => {
          const score = scores[key];
          if (!score) return null;
          const val = Math.round(score.value ?? 0);
          const barTone = inverse
            ? val >= 70 ? "bg-rose-500" : val >= 45 ? "bg-amber-500" : "bg-emerald-500"
            : val >= 70 ? "bg-emerald-500" : val >= 45 ? "bg-amber-500" : "bg-rose-500";
          const contributors = score.contributors ?? [];

          return (
            <div key={String(key)} className="rounded-lg border bg-background/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{label}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${barTone}`} style={{ width: `${Math.min(100, Math.max(0, val))}%` }} />
                  </div>
                  <span className="min-w-[2.5rem] text-right text-sm font-bold tabular-nums">{val}</span>
                </div>
              </div>
              {contributors.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {contributors.slice(0, 5).map((c, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        w{(c.weight ?? 0).toFixed(2)}
                      </span>
                      <span className="font-medium">{c.label}</span>
                      <span className="font-semibold tabular-nums text-foreground/80">
                        {Math.round(c.value ?? 0)}
                      </span>
                      {c.rationale ? (
                        <span className="text-muted-foreground">— {c.rationale}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] italic text-muted-foreground">
                  No contributor breakdown yet — regenerate the artifact to populate traceable drivers.
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Spine Entity Drill-Down Table — per-tab detail view
// ──────────────────────────────────────────────────────────────────────────
export function SpineEntityCards({
  spine,
  tab,
}: {
  spine: EaSpine | undefined | null;
  tab: TabKind;
}) {
  if (!spine) return null;

  if (tab === "business") {
    const caps = spine.capabilities ?? [];
    if (caps.length === 0) return null;
    return (
      <SpineSection title="Capabilities · Investment Decisions" icon={Building2}>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {caps.slice(0, 12).map((c) => (
            <div key={c.id} className="rounded border bg-background/60 p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium">{c.name}</span>
                <InvestmentBadge decision={c.investmentDecision} />
              </div>
              <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
                <span>Priority {Math.round(c.strategicPriority ?? 0)}</span>
                <span>Impact {Math.round(c.investmentImpact ?? 0)}</span>
                <span>Complexity {Math.round(c.implementationComplexity ?? 0)}</span>
              </div>
            </div>
          ))}
        </div>
      </SpineSection>
    );
  }

  if (tab === "application") {
    const apps = spine.applications ?? [];
    const ints = spine.integrations ?? [];
    if (apps.length === 0 && ints.length === 0) return null;
    const appById = new Map(apps.map((a) => [a.id, a]));
    return (
      <Fragment>
        {apps.length > 0 ? (
          <SpineSection title="Applications · Lifecycle & Hosting" icon={Network}>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {apps.slice(0, 12).map((a) => (
                <div key={a.id} className="rounded border bg-background/60 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{a.name}</span>
                    <Badge variant="outline" className="text-[10px]">{a.lifecycleDisposition}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                    <span>Owner: {a.owner}</span>
                    <span>Hosting: {a.hostingType}</span>
                    <span>SLA: {a.sla ?? "—"}</span>
                    <span>Crit: {a.criticality}</span>
                  </div>
                </div>
              ))}
            </div>
          </SpineSection>
        ) : null}
        {ints.length > 0 ? (
          <SpineSection title="Integrations · Failure Impact" icon={Workflow}>
            <ul className="space-y-1 text-xs">
              {ints.slice(0, 10).map((i) => {
                const src = appById.get(i.sourceAppId)?.name ?? i.sourceAppId;
                const tgt = appById.get(i.targetAppId)?.name ?? i.targetAppId;
                return (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background/60 px-2 py-1">
                    <span>
                      <span className="font-medium">{src}</span>
                      <span className="mx-1.5 text-muted-foreground">→</span>
                      <span className="font-medium">{tgt}</span>
                    </span>
                    <div className="flex items-center gap-2 text-[10px]">
                      <Badge variant="outline">{i.interfaceType}</Badge>
                      {i.realtime ? <Badge variant="outline" className="border-sky-500/40 text-sky-700 dark:text-sky-300">realtime</Badge> : null}
                      <FailureImpactBadge impact={i.failureImpact} />
                      <span className="font-mono text-muted-foreground">risk {Math.round(i.riskScore ?? 0)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </SpineSection>
        ) : null}
      </Fragment>
    );
  }

  if (tab === "data") {
    const domains = spine.dataDomains ?? [];
    const flows = spine.dataFlows ?? [];
    if (domains.length === 0 && flows.length === 0) return null;
    return (
      <Fragment>
        {domains.length > 0 ? (
          <SpineSection title="Data Domains · Residency & Quality" icon={Database}>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {domains.slice(0, 12).map((d) => (
                <div key={d.id} className="rounded border bg-background/60 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{d.name}</span>
                    <Badge variant="outline" className="text-[10px]">{d.classification}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                    <span>Type: {d.dataType}</span>
                    <span>Residency: {d.residency}</span>
                    <span>Quality: {Math.round(d.qualityScore ?? 0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </SpineSection>
        ) : null}
        {flows.length > 0 ? (
          <SpineSection title="Data Flows · Cross-Border & Encryption" icon={Workflow}>
            <ul className="space-y-1 text-xs">
              {flows.slice(0, 10).map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background/60 px-2 py-1">
                  <span className="font-mono text-[10px]">
                    {f.sourceAppId.slice(0, 18)} → {f.targetAppId.slice(0, 18)}
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    {f.crossBorder ? <Badge variant="outline" className="border-rose-500/40 text-rose-700 dark:text-rose-300">cross-border</Badge> : null}
                    {f.encryptionRequired ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">encrypted</Badge> : null}
                    {f.realtime ? <Badge variant="outline" className="border-sky-500/40 text-sky-700 dark:text-sky-300">realtime</Badge> : null}
                  </div>
                </li>
              ))}
            </ul>
          </SpineSection>
        ) : null}
      </Fragment>
    );
  }

  if (tab === "technology") {
    const comps = spine.technologyComponents ?? [];
    const pols = spine.policies ?? [];
    if (comps.length === 0 && pols.length === 0) return null;
    return (
      <Fragment>
        {comps.length > 0 ? (
          <SpineSection title="Technology Components · Hosting Compliance" icon={Layers}>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {comps.slice(0, 14).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded border bg-background/60 p-2 text-xs">
                  <span className="font-medium">{c.name}</span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <Badge variant="outline">{c.layer}</Badge>
                    <HostingComplianceBadge compliance={c.hostingCompliance} />
                    <Badge variant="outline" className="text-[10px]">{c.lifecycle}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </SpineSection>
        ) : null}
        {pols.length > 0 ? (
          <SpineSection title="Policies · Compliance Status" icon={ShieldCheck}>
            <ul className="space-y-1 text-xs">
              {pols.slice(0, 10).map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background/60 px-2 py-1">
                  <span className="font-medium">{p.name}</span>
                  <div className="flex items-center gap-2 text-[10px]">
                    {p.authority ? <Badge variant="outline">{p.authority}</Badge> : null}
                    <SeverityBadge severity={p.severity} />
                    <ComplianceStatusBadge status={p.complianceStatus} />
                  </div>
                </li>
              ))}
            </ul>
          </SpineSection>
        ) : null}
      </Fragment>
    );
  }

  if (tab === "risk") {
    const risks = spine.risks ?? [];
    if (risks.length === 0) return null;
    const appById = new Map((spine.applications ?? []).map((a) => [a.id, a.name]));
    return (
      <SpineSection title="Risk Register · Traced to Affected Entities" icon={Gauge}>
        <div className="space-y-1.5">
          {risks.slice(0, 12).map((r) => (
            <div key={r.id} className="rounded border bg-background/60 p-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{r.name}</span>
                <div className="flex items-center gap-2 text-[10px]">
                  <SeverityBadge severity={r.severity} />
                  <Badge variant="outline">{r.likelihood}</Badge>
                  <Badge variant="outline">{r.status}</Badge>
                  {r.blocking ? <Badge variant="outline" className="border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-300">blocking</Badge> : null}
                </div>
              </div>
              {(r.affectedEntityIds && r.affectedEntityIds.length > 0) || r.action ? (
                <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                  {r.affectedEntityIds && r.affectedEntityIds.length > 0 ? (
                    <div>
                      <span className="opacity-70">Affects:</span>{" "}
                      {r.affectedEntityIds.slice(0, 3).map((id) => appById.get(id) ?? id).join(", ")}
                    </div>
                  ) : null}
                  {r.action ? <div><span className="opacity-70">Action:</span> {r.action}</div> : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SpineSection>
    );
  }

  return null;
}

function SpineSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof ShieldCheck;
  children: React.ReactNode;
}) {
  return (
    <Card className="mt-3 border-muted-foreground/20 bg-muted/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
          <Badge variant="outline" className="ml-auto text-[10px] uppercase tracking-wider">spine</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

// ── Small badge helpers ────────────────────────────────────────────────────
function InvestmentBadge({ decision }: { decision: string }) {
  const tone =
    decision === "invest" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" :
    decision === "sustain" ? "border-sky-500/40 text-sky-700 dark:text-sky-300" :
    decision === "divest" ? "border-rose-500/40 text-rose-700 dark:text-rose-300" :
    "border-muted-foreground/30 text-muted-foreground";
  return <Badge variant="outline" className={`text-[10px] uppercase ${tone}`}>{decision}</Badge>;
}

function FailureImpactBadge({ impact }: { impact: string }) {
  const tone =
    impact === "critical" ? "border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-300" :
    impact === "high" ? "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300" :
    impact === "medium" ? "border-sky-500/40 bg-sky-500/5 text-sky-700 dark:text-sky-300" :
    "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300";
  return <Badge variant="outline" className={`text-[10px] ${tone}`}>{impact}</Badge>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const tone =
    severity === "critical" ? "border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-300" :
    severity === "high" ? "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300" :
    severity === "medium" ? "border-sky-500/40 bg-sky-500/5 text-sky-700 dark:text-sky-300" :
    "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300";
  return <Badge variant="outline" className={`text-[10px] uppercase ${tone}`}>{severity}</Badge>;
}

function ComplianceStatusBadge({ status }: { status: string }) {
  const tone =
    status === "compliant" ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300" :
    status === "non-compliant" ? "border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-300" :
    status === "partial" ? "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300" :
    "border-muted-foreground/30 text-muted-foreground";
  return <Badge variant="outline" className={`text-[10px] ${tone}`}>{status}</Badge>;
}

function HostingComplianceBadge({ compliance }: { compliance: string }) {
  const tone =
    compliance === "uae-sovereign" ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" :
    compliance === "uae-compliant" ? "border-sky-500/40 bg-sky-500/5 text-sky-700 dark:text-sky-300" :
    compliance === "non-compliant" ? "border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-300" :
    "border-muted-foreground/30 text-muted-foreground";
  return <Badge variant="outline" className={`text-[10px] ${tone}`}>{compliance}</Badge>;
}

// ──────────────────────────────────────────────────────────────────────────
// Wave 5 — Traceability Panel
// Given the current spine's decision.blockingIssues, walks the graph to show
// the exact risks → affected applications / data domains / policies.
// ──────────────────────────────────────────────────────────────────────────
export function SpineTraceabilityPanel({ spine }: { spine: EaSpine | undefined | null }) {
  const traces = useMemo(() => {
    if (!spine) return [];
    const appById = new Map((spine.applications ?? []).map((a) => [a.id, a]));
    const polById = new Map((spine.policies ?? []).map((p) => [p.id, p]));
    const domainById = new Map((spine.dataDomains ?? []).map((d) => [d.id, d]));

    // Primary trace: every blocking risk + every non-compliant critical policy.
    const blockingRisks = (spine.risks ?? []).filter(
      (r) =>
        r.blocking
        || (r.severity === "critical" && !["mitigated", "closed", "accepted"].includes(r.status as string)),
    );
    const criticalPolicyViolations = (spine.policies ?? []).filter(
      (p) => p.complianceStatus === "non-compliant" && p.severity === "critical",
    );

    return [
      ...blockingRisks.map((r) => {
        const affectedApps = (r.affectedEntityIds ?? [])
          .map((id) => appById.get(id))
          .filter((a): a is NonNullable<typeof a> => !!a);
        const violatedPolicies = (r.violatedPolicyIds ?? [])
          .map((id) => polById.get(id))
          .filter((p): p is NonNullable<typeof p> => !!p);
        return {
          kind: "risk" as const,
          id: r.id,
          title: r.name,
          severity: r.severity,
          cause: r.cause,
          action: r.action,
          owner: r.owner,
          affectedApps: affectedApps.map((a) => ({ id: a.id, name: a.name, criticality: a.criticality })),
          violatedPolicies: violatedPolicies.map((p) => ({ id: p.id, name: p.name, authority: p.authority })),
          affectedDomains: [] as Array<{ id: string; name: string; classification: string }>,
        };
      }),
      ...criticalPolicyViolations.map((p) => {
        const affectedApps = (p.targetEntityIds ?? [])
          .map((id) => appById.get(id))
          .filter((a): a is NonNullable<typeof a> => !!a);
        const affectedDomains = (p.targetEntityIds ?? [])
          .map((id) => domainById.get(id))
          .filter((d): d is NonNullable<typeof d> => !!d);
        return {
          kind: "policy" as const,
          id: p.id,
          title: p.name,
          severity: p.severity,
          cause: `Non-compliant with ${p.authority ?? "policy"}`,
          action: p.remediation,
          owner: undefined as string | undefined,
          affectedApps: affectedApps.map((a) => ({ id: a.id, name: a.name, criticality: a.criticality })),
          violatedPolicies: [] as Array<{ id: string; name: string; authority?: string }>,
          affectedDomains: affectedDomains.map((d) => ({ id: d.id, name: d.name, classification: d.classification })),
        };
      }),
    ];
  }, [spine]);

  if (!spine || traces.length === 0) return null;

  return (
    <Card className="border-rose-500/30 bg-rose-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <GitBranch className="h-4 w-4 text-rose-600 dark:text-rose-300" />
          Traceability · Why is this Blocked?
          <Badge variant="outline" className="ml-auto text-[10px] uppercase">
            {traces.length} root cause{traces.length === 1 ? "" : "s"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {traces.slice(0, 8).map((t) => (
          <div key={`${t.kind}-${t.id}`} className="rounded-lg border bg-background/80 p-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-current text-[10px] uppercase">
                  {t.kind}
                </Badge>
                <span className="font-medium">{t.title}</span>
              </div>
              <SeverityBadge severity={t.severity} />
            </div>
            {t.cause ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground/70">Cause:</span> {t.cause}
              </p>
            ) : null}

            <div className="mt-2 space-y-1.5 text-[11px]">
              {t.affectedApps.length > 0 ? (
                <TraceLine label="Affects Applications" items={t.affectedApps.map((a) => `${a.name} (${a.criticality})`)} />
              ) : null}
              {t.affectedDomains.length > 0 ? (
                <TraceLine label="Affects Data Domains" items={t.affectedDomains.map((d) => `${d.name} · ${d.classification}`)} />
              ) : null}
              {t.violatedPolicies.length > 0 ? (
                <TraceLine
                  label="Violates Policies"
                  items={t.violatedPolicies.map((p) => (p.authority ? `${p.name} (${p.authority})` : p.name))}
                />
              ) : null}
            </div>

            {t.action ? (
              <div className="mt-2 flex items-start gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-[11px]">
                <Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-600 dark:text-emerald-300" />
                <span>
                  <span className="font-semibold">Unlock:</span> {t.action}
                  {t.owner ? <span className="ml-1 opacity-70">({t.owner})</span> : null}
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TraceLine({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex flex-wrap items-baseline gap-1">
      <ChevronRight className="h-3 w-3 text-muted-foreground" />
      <span className="font-semibold text-foreground/80">{label}:</span>
      {items.slice(0, 6).map((it, i) => (
        <Badge key={i} variant="outline" className="border-muted-foreground/30 bg-background/50 text-[10px]">
          {it}
        </Badge>
      ))}
      {items.length > 6 ? (
        <span className="text-[10px] text-muted-foreground">+{items.length - 6} more</span>
      ) : null}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Wave 5 — What-If Simulator
// Mutates the spine in memory with common interventions and re-runs
// `deriveSpineDecision` client-side to preview status shifts before commit.
// ──────────────────────────────────────────────────────────────────────────
type Intervention =
  | "mitigate-critical-risks"
  | "remediate-critical-policies"
  | "elevate-residency"
  | "retire-legacy-tech"
  | "add-encryption";

const INTERVENTIONS: Array<{ id: Intervention; label: string; description: string }> = [
  {
    id: "mitigate-critical-risks",
    label: "Mitigate all critical & blocking risks",
    description: "Sets status=mitigated and clears the blocking flag on all critical/blocking risks.",
  },
  {
    id: "remediate-critical-policies",
    label: "Remediate non-compliant critical policies",
    description: "Transitions each critical non-compliant policy to compliant.",
  },
  {
    id: "elevate-residency",
    label: "Elevate all data residency to UAE-required",
    description: "Forces residency=uae-required on every data domain to remove cross-border risk.",
  },
  {
    id: "retire-legacy-tech",
    label: "Retire legacy technology components",
    description: "Flips lifecycle=retire on any component already marked legacy.",
  },
  {
    id: "add-encryption",
    label: "Require encryption on all data flows",
    description: "Sets encryptionRequired=true and clears crossBorder on every data flow.",
  },
];

function applyInterventions(spine: EaSpine, active: Set<Intervention>): EaSpine {
  let next: EaSpine = { ...spine };

  if (active.has("mitigate-critical-risks")) {
    next = {
      ...next,
      risks: (next.risks ?? []).map((r) =>
        r.blocking || r.severity === "critical"
          ? { ...r, status: "mitigated" as const, blocking: false }
          : r,
      ),
    };
  }
  if (active.has("remediate-critical-policies")) {
    next = {
      ...next,
      policies: (next.policies ?? []).map((p) =>
        p.severity === "critical" && p.complianceStatus === "non-compliant"
          ? { ...p, complianceStatus: "compliant" as const }
          : p,
      ),
    };
  }
  if (active.has("elevate-residency")) {
    next = {
      ...next,
      dataDomains: (next.dataDomains ?? []).map((d) => ({ ...d, residency: "uae-required" as const })),
    };
  }
  if (active.has("retire-legacy-tech")) {
    next = {
      ...next,
      technologyComponents: (next.technologyComponents ?? []).map((c) =>
        /legacy|deprecated/i.test(c.name) ? { ...c, lifecycle: "retire" as const } : c,
      ),
    };
  }
  if (active.has("add-encryption")) {
    next = {
      ...next,
      dataFlows: (next.dataFlows ?? []).map((f) => ({ ...f, encryptionRequired: true, crossBorder: false })),
    };
  }

  return deriveSpineDecision(next);
}

export function SpineWhatIfSimulator({ spine }: { spine: EaSpine | undefined | null }) {
  const [active, setActive] = useState<Set<Intervention>>(new Set());

  const simulated = useMemo(() => {
    if (!spine || active.size === 0) return null;
    try {
      return applyInterventions(spine, active);
    } catch (_e) {
      return null;
    }
  }, [spine, active]);

  if (!spine) return null;

  const baselineDecision = spine.decision;
  const simulatedDecision = simulated?.decision;
  const toggle = (id: Intervention) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card className="border-violet-500/30 bg-violet-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FlaskConical className="h-4 w-4 text-violet-600 dark:text-violet-300" />
          What-If Simulator
          <Badge variant="outline" className="ml-auto text-[10px] uppercase">
            preview only · not saved
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-1 gap-2">
          {INTERVENTIONS.map((iv) => (
            <div
              key={iv.id}
              className="flex items-start justify-between gap-3 rounded-lg border bg-background/70 p-2"
            >
              <div className="min-w-0 flex-1">
                <Label htmlFor={`wi-${iv.id}`} className="cursor-pointer text-xs font-medium">
                  {iv.label}
                </Label>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{iv.description}</p>
              </div>
              <Switch id={`wi-${iv.id}`} checked={active.has(iv.id)} onCheckedChange={() => toggle(iv.id)} />
            </div>
          ))}
        </div>

        <div className="rounded-lg border-2 border-dashed border-violet-500/40 bg-background/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Decision preview
            </span>
            {active.size > 0 ? (
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setActive(new Set())}>
                <RotateCcw className="mr-1 h-3 w-3" /> reset
              </Button>
            ) : null}
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <DecisionPreviewChip label="Current" decision={baselineDecision ?? null} />
            <DecisionPreviewChip
              label={active.size > 0 ? `Simulated (${active.size})` : "Simulated"}
              decision={simulatedDecision ?? null}
              compareTo={baselineDecision ?? null}
            />
          </div>

          {simulatedDecision && baselineDecision && simulatedDecision.status !== baselineDecision.status ? (
            <div className="mt-2 rounded border border-emerald-500/40 bg-emerald-500/10 p-2 text-[11px] text-emerald-800 dark:text-emerald-200">
              Status shifts:{" "}
              <span className="font-semibold uppercase">{baselineDecision.status.replace(/-/g, " ")}</span>
              {" → "}
              <span className="font-semibold uppercase">{simulatedDecision.status.replace(/-/g, " ")}</span>
            </div>
          ) : null}
          {simulatedDecision && simulatedDecision.topUnlockActions && simulatedDecision.topUnlockActions.length > 0 ? (
            <div className="mt-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Remaining unlock actions
              </div>
              <ul className="mt-1 space-y-0.5 text-[11px]">
                {simulatedDecision.topUnlockActions.slice(0, 4).map((u, i) => (
                  <li key={i} className="rounded border bg-background/60 px-2 py-1">
                    • {u.action}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionPreviewChip({
  label,
  decision,
  compareTo,
}: {
  label: string;
  decision: NonNullable<EaSpine["decision"]> | null;
  compareTo?: NonNullable<EaSpine["decision"]> | null;
}) {
  if (!decision) {
    return (
      <div className="rounded border border-dashed bg-muted/30 p-2 text-[11px] text-muted-foreground">
        <div className="font-semibold uppercase tracking-wider">{label}</div>
        <div className="mt-1">No decision computed</div>
      </div>
    );
  }
  const visual = DECISION_VISUALS[decision.status] ?? DECISION_VISUALS["conditional-approval"];
  const improved =
    compareTo && STATUS_RANK[decision.status] > STATUS_RANK[compareTo.status]
      ? "improved"
      : compareTo && STATUS_RANK[decision.status] < STATUS_RANK[compareTo.status]
        ? "worsened"
        : "same";
  return (
    <div className={`rounded border-2 p-2 ${visual.tone}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</span>
        {improved !== "same" ? (
          <Badge variant="outline" className="border-current text-[10px]">
            {improved}
          </Badge>
        ) : null}
      </div>
      <div className="mt-1 text-sm font-bold">{visual.label}</div>
      <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
        <span>Critical: {decision.policyFlagCounts?.critical ?? 0}</span>
        <span>· High: {decision.policyFlagCounts?.high ?? 0}</span>
        <span>· Med: {decision.policyFlagCounts?.medium ?? 0}</span>
        <span>· Blocking: {decision.blockingIssues?.length ?? 0}</span>
      </div>
    </div>
  );
}

// Ranking for improved/worsened comparison (higher = better).
const STATUS_RANK: Record<NonNullable<EaSpine["decision"]>["status"], number> = {
  rejected: 0,
  blocked: 1,
  "conditional-approval": 2,
  "approved-with-risk-acceptance": 3,
  "fully-approved": 4,
};

