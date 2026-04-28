import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { BrainEngineSummary } from './brainEngineSummary';

function normalizePercentValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  const scaledValue = numericValue > 1 ? numericValue : numericValue * 100;
  return Math.max(0, Math.min(100, Math.round(scaledValue)));
}

export interface DetailedRequirementsDecisionRibbonProps {
  brainDecisionId: string;
  statusBadgeClass: string;
  statusLabel: string;
  classification: string;
  nextGate: string;
  classificationConfidence: number | null | undefined;
  engineSummary: BrainEngineSummary;
  decisionSource: string;
  showBrainApprovalButton: boolean;
  onOpenGovernance: () => void;
  onOpenApproval: () => void;
}

export function DetailedRequirementsDecisionRibbon({
  brainDecisionId,
  statusBadgeClass,
  statusLabel,
  classification,
  nextGate,
  classificationConfidence,
  engineSummary,
  decisionSource,
  showBrainApprovalButton,
  onOpenGovernance,
  onOpenApproval,
}: DetailedRequirementsDecisionRibbonProps) {
  const { t } = useTranslation();
  const confidencePercent = normalizePercentValue(classificationConfidence);

  return (
    <div className="rounded-xl border border-border/60 bg-card/95 p-3 shadow-sm space-y-3" data-testid="brain-ribbon-requirements-moved">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('demand.tabs.requirements.decisionSpine')}</p>
        <p className="text-xs font-mono text-foreground truncate">{brainDecisionId}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={`text-xs ${statusBadgeClass}`}>{statusLabel}</Badge>
        <Badge variant="outline" className="text-xs">{t('demand.tabs.requirements.classification')}: {classification}</Badge>
        <Badge variant="outline" className="text-xs">{t('demand.tabs.requirements.nextGate')}: {nextGate}</Badge>
        {confidencePercent !== null && (
          <Badge variant="outline" className="text-xs">{t('demand.tabs.requirements.confidence')} {confidencePercent}%</Badge>
        )}
      </div>
      <div className={`rounded-xl border px-3 py-3 ${
        engineSummary.actual.variant === 'internal'
          ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/20'
          : engineSummary.actual.variant === 'hybrid'
            ? 'border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/20'
            : 'border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/20'
      }`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[11px]">{engineSummary.planned.badge}</Badge>
          <Badge variant="outline" className="text-[11px]">{engineSummary.actual.badge}</Badge>
        </div>
        <div className="mt-2 space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Planned route: {engineSummary.planned.label}</p>
          <p className="text-xs font-semibold text-foreground">Actual execution: {engineSummary.actual.label}</p>
          <p className="text-[11px] leading-5 text-muted-foreground">{engineSummary.actual.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">{decisionSource}</Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenGovernance}
          className="group h-9 justify-between rounded-xl border-slate-300/80 bg-white/90 px-3 text-xs font-semibold text-slate-800 shadow-sm transition-all hover:-translate-y-[1px] hover:bg-slate-50 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800"
          data-testid="button-open-brain-governance-requirements-moved"
        >
          <span>{t('demand.tabs.requirements.governance')}</span>
          <span className="text-[11px] text-slate-500 transition-transform group-hover:translate-x-0.5 dark:text-slate-400">→</span>
        </Button>
        {showBrainApprovalButton && (
          <Button
            size="sm"
            onClick={onOpenApproval}
            className="group h-9 justify-between rounded-xl bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 px-3 text-xs font-semibold text-white shadow-[0_16px_30px_-22px_rgba(14,165,233,0.9)] transition-all hover:-translate-y-[1px] hover:from-sky-700 hover:via-cyan-700 hover:to-teal-700"
            data-testid="button-open-brain-approval-requirements-moved"
          >
            <span>{t('demand.tabs.requirements.approval')}</span>
            <span className="text-[11px] transition-transform group-hover:translate-x-0.5">→</span>
          </Button>
        )}
      </div>
    </div>
  );
}