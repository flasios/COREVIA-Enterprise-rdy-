import { ArrowRight, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import HexagonLogoFrame from '@/components/shared/misc/HexagonLogoFrame';

export type CoreviaGateTone = 'info' | 'good' | 'warn';
export type CoreviaGateActionTone = 'primary' | 'neutral' | 'caution';

export interface CoreviaGateBrief {
  tone: CoreviaGateTone;
  scope: string;
  headline: string;
  body: string;
  evidence: string[];
  cta?: { label: string; onClick: () => void };
}

export interface CoreviaGateAction {
  id: string;
  label: string;
  detail: string;
  Icon: LucideIcon | React.ComponentType<{ className?: string }>;
  tone?: CoreviaGateActionTone;
  onClick: () => void;
}

const PALETTES: Record<CoreviaGateTone, { shell: string; badge: string; meta: string }> = {
  info: {
    shell: 'from-sky-50 via-white to-white border-sky-200/80 dark:from-sky-500/10 dark:via-slate-900 dark:to-slate-900 dark:border-sky-500/30',
    badge: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
    meta: 'text-sky-700 dark:text-sky-300',
  },
  good: {
    shell: 'from-emerald-50 via-white to-white border-emerald-200/80 dark:from-emerald-500/10 dark:via-slate-900 dark:to-slate-900 dark:border-emerald-500/30',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    meta: 'text-emerald-700 dark:text-emerald-300',
  },
  warn: {
    shell: 'from-amber-50 via-white to-white border-amber-200/80 dark:from-amber-500/10 dark:via-slate-900 dark:to-slate-900 dark:border-amber-500/30',
    badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    meta: 'text-amber-700 dark:text-amber-300',
  },
};

const ACTION_TONES: Record<CoreviaGateActionTone, { shell: string; icon: string; accent: string }> = {
  primary: {
    shell: 'border-slate-900/90 bg-slate-900 text-white shadow-sm dark:border-white/20 dark:bg-white dark:text-slate-900',
    icon: 'bg-white/15 text-white dark:bg-slate-900/10 dark:text-slate-900',
    accent: 'text-white/80 dark:text-slate-600',
  },
  neutral: {
    shell: 'border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:border-slate-600',
    icon: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    accent: 'text-slate-500 dark:text-slate-400',
  },
  caution: {
    shell: 'border-amber-300 bg-amber-50/90 text-amber-900 shadow-sm hover:border-amber-400 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:border-amber-400/60',
    icon: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
    accent: 'text-amber-700/80 dark:text-amber-200/80',
  },
};

export function CoreviaGateAssistant({
  brief,
  actions = [],
  testId = 'workspace-corevia-assistant',
}: Readonly<{
  brief: CoreviaGateBrief;
  actions?: CoreviaGateAction[];
  testId?: string;
}>) {
  const palette = PALETTES[brief.tone];
  const visibleActions = actions.slice(0, 3);
  const statusLabel = brief.tone === 'warn' ? 'Action needed' : brief.tone === 'good' ? 'Ready' : 'Focus now';
  const queueLabel = visibleActions.length > 0
    ? `${visibleActions.length} queued action${visibleActions.length === 1 ? '' : 's'}`
    : 'No queued actions';

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-gradient-to-r px-3 py-3 shadow-[0_14px_34px_-32px_rgba(15,23,42,0.42)] ${palette.shell}`}
      data-testid={testId}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <HexagonLogoFrame px={34} className="shrink-0" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={`h-5 px-1.5 text-[9px] uppercase tracking-[0.16em] ${palette.badge}`}>
                COREVIA
              </Badge>
              <span className={`text-[10px] font-medium uppercase tracking-[0.16em] ${palette.meta}`}>
                {brief.scope}
              </span>
              <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${palette.badge}`}>
                {statusLabel}
              </span>
            </div>
            <h3 className="mt-1 text-[14px] font-semibold tracking-tight text-slate-900 dark:text-white">{brief.headline}</h3>
            <p className="mt-1 max-w-4xl text-[11.5px] leading-5 text-slate-600 dark:text-slate-300">{brief.body}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 xl:max-w-[34rem] xl:justify-end">
          {brief.evidence.slice(0, 3).map((item) => (
            <span
              key={item}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white/85 px-2 py-1 text-[10px] font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
            >
              {item}
            </span>
          ))}
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/85 px-2 py-1 text-[10px] font-medium text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
            {queueLabel}
          </span>
          {visibleActions.length === 0 && brief.cta && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 px-2.5 text-[11px]"
              onClick={brief.cta.onClick}
              data-testid={`${testId}-cta`}
            >
              {brief.cta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {visibleActions.length > 0 && (
        <div className="mt-3 border-t border-white/60 pt-3 dark:border-slate-800/80">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            <Zap className="h-3.5 w-3.5" /> Recommended actions
          </div>
          <div className="mt-2 grid gap-1.5 lg:grid-cols-2 xl:grid-cols-3">
            {visibleActions.map((action) => {
              const tone = ACTION_TONES[action.tone ?? 'neutral'];
              const ActionIcon = action.Icon;

              return (
                <button
                  key={action.id}
                  type="button"
                  className={`group rounded-xl border px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 ${tone.shell}`}
                  onClick={action.onClick}
                  data-testid={`${testId}-action-${action.id}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}>
                      <ActionIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] font-semibold tracking-tight">{action.label}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <p className={`mt-0.5 text-[10.5px] leading-5 ${tone.accent}`}>{action.detail}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function CoreviaGateSignal({
  headline,
  detail,
  actionCount,
  expanded,
  onToggle,
  testId = 'workspace-corevia-signal',
}: Readonly<{
  headline: string;
  detail: string;
  actionCount: number;
  expanded: boolean;
  onToggle: () => void;
  testId?: string;
}>) {
  void headline;
  void detail;
  return (
    <button
      type="button"
      className={`group flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-all ${
        expanded
          ? 'border-amber-300 bg-amber-50/90 shadow-[0_10px_28px_-26px_rgba(217,119,6,0.45)] dark:border-amber-500/40 dark:bg-amber-500/10'
          : 'border-amber-300/80 bg-[linear-gradient(90deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))] shadow-[0_10px_28px_-26px_rgba(217,119,6,0.45)] hover:border-amber-400 dark:border-amber-500/45 dark:bg-[linear-gradient(90deg,rgba(120,53,15,0.34),rgba(15,23,42,0.92))] dark:hover:border-amber-400/70'
      }`}
      onClick={onToggle}
      aria-expanded={expanded}
      data-testid={testId}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="relative shrink-0">
          <HexagonLogoFrame px={22} />
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white animate-pulse dark:ring-slate-950" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
          COREVIA signal
        </span>
        <Badge variant="outline" className="h-5 border-amber-200 bg-white/90 px-1.5 text-[10px] uppercase tracking-[0.14em] text-amber-700 dark:border-amber-500/40 dark:bg-slate-950/70 dark:text-amber-200">
          {actionCount} action{actionCount === 1 ? '' : 's'}
        </Badge>
      </div>
      <span className="shrink-0 rounded-full border border-amber-200 bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 transition-colors group-hover:border-amber-300 dark:border-amber-500/40 dark:bg-slate-950/70 dark:text-amber-200">
        {expanded ? 'Hide' : 'Review'}
      </span>
    </button>
  );
}
