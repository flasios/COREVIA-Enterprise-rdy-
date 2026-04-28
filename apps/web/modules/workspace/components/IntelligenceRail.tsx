import { AlertTriangle, BookOpen, Scale, Signal } from "lucide-react";
import type { WorkspaceContext, WorkspaceDecision, WorkspaceSignal } from "@/modules/workspace/types";

type IntelligenceRailProps = Readonly<{
  decisions: WorkspaceDecision[];
  signals: WorkspaceSignal[];
  context: WorkspaceContext | null;
}>;

function getSignalTone(severity: WorkspaceSignal["severity"]) {
  switch (severity) {
    case "critical":
      return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
    case "high":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "medium":
      return "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    default:
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
}

function getDecisionTone(priority: WorkspaceDecision["priority"]) {
  switch (priority) {
    case "critical":
      return "bg-red-500/10 text-red-700 dark:text-red-300";
    case "high":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
    default:
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  }
}

export function IntelligenceRail({ decisions, signals, context }: IntelligenceRailProps) {
  return (
    <aside className="h-full space-y-4 overflow-auto pr-1">
      <section className="relative overflow-hidden rounded-[28px] border bg-[linear-gradient(135deg,hsl(var(--brain-console-ice))_0%,hsl(var(--brain-surface))_55%,hsl(var(--brain-console-ash))_100%)] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="absolute right-0 top-0 h-28 w-28 translate-x-10 -translate-y-10 rounded-full bg-[radial-gradient(circle,hsl(var(--brain-console-teal)/0.2)_0%,transparent_70%)]" />
        <div className="flex items-center gap-3">
          <Scale className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Decision Feed</div>
            <div className="text-lg font-semibold text-foreground">Decision queue</div>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {decisions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-white/45 p-4 text-sm text-muted-foreground">
              No decisions are available in the workspace yet.
            </div>
          ) : null}
          {decisions.map((decision) => (
            <div key={decision.id} className="rounded-2xl border border-white/55 bg-white/58 p-4 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold text-foreground">{decision.title}</div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getDecisionTone(decision.priority)}`}>
                  {decision.priority.toUpperCase()}
                </span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{decision.context}</div>
              <div className="mt-3 text-sm text-foreground">{decision.recommendation}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[28px] border bg-[linear-gradient(135deg,hsl(var(--brain-console-ice))_0%,hsl(var(--brain-surface))_55%,hsl(var(--brain-console-ash))_100%)] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="absolute left-0 bottom-0 h-28 w-28 -translate-x-10 translate-y-10 rounded-full bg-[radial-gradient(circle,hsl(var(--brain-console-copper)/0.18)_0%,transparent_70%)]" />
        <div className="flex items-center gap-3">
          <Signal className="h-5 w-5 text-amber-600 dark:text-amber-300" />
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Signals</div>
            <div className="text-lg font-semibold text-foreground">Signal watch</div>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {signals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-white/45 p-4 text-sm text-muted-foreground">
              No live signals are available yet.
            </div>
          ) : null}
          {signals.map((signal) => (
            <div key={signal.id} className={`rounded-2xl border p-4 ${getSignalTone(signal.severity)}`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div>
                  <div className="text-sm font-semibold">{signal.message}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.24em] opacity-80">{signal.source}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[28px] border bg-[linear-gradient(135deg,hsl(var(--brain-console-ice))_0%,hsl(var(--brain-surface))_55%,hsl(var(--brain-console-ash))_100%)] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-[radial-gradient(circle,hsl(var(--brain-console-teal)/0.16)_0%,transparent_70%)]" />
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Context</div>
            <div className="text-lg font-semibold text-foreground">Context basis</div>
          </div>
        </div>
        {context ? (
          <div className="mt-4 space-y-4 text-sm text-muted-foreground">
            <p className="leading-7">{context.summary}</p>
            <div className="rounded-2xl border border-white/55 bg-white/58 p-4 backdrop-blur">
              <div>Related Project: <span className="font-medium text-foreground">{context.relatedProject ?? "Not available yet"}</span></div>
              <div className="mt-2">Previous Decision: <span className="font-medium text-foreground">{context.previousDecision ?? "Not available yet"}</span></div>
              <div className="mt-2">Relevant Policy: <span className="font-medium text-foreground">{context.relevantPolicy ?? "Not available yet"}</span></div>
            </div>
            {context.knowledgeSources.length > 0 ? (
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Knowledge Sources</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {context.knowledgeSources.map((source) => (
                    <span key={source} className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                      {source}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </aside>
  );
}