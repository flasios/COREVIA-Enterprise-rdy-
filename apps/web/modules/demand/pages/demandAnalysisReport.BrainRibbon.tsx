import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from 'react-i18next';
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import { ShieldCheck } from "lucide-react";
import type { BrainStatus } from "./demandAnalysisReport.types";

// ============================================================================
// BRAIN RIBBON COMPONENT
// ============================================================================

function formatConfidencePercent(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const normalized = value > 100 ? value / 100 : value > 1 ? value : value * 100;
  const bounded = Math.max(0, Math.min(100, normalized));
  return `${Math.round(bounded)}%`;
}

interface BrainRibbonProps {
  brainDecisionId: string | undefined;
  brainStatus: BrainStatus;
  classification: string;
  classificationConfidence: number | null | undefined;
  coreviaPreApproved?: boolean;
  isPmoDirectorApproved?: boolean;
  approvalRoutedToPmoDirector?: boolean;
  onShowGovernance: () => void;
}

export function BrainRibbon({
  brainDecisionId,
  brainStatus,
  classification,
  classificationConfidence,
  coreviaPreApproved = false,
  isPmoDirectorApproved = false,
  approvalRoutedToPmoDirector = false,
  onShowGovernance,
}: BrainRibbonProps) {
  const { t } = useTranslation();
  const confidenceLabel = formatConfidencePercent(classificationConfidence);
  if (!brainDecisionId) {
    return null;
  }

  return (
    <div className="rounded-xl border bg-gradient-to-r from-slate-50/80 via-white to-blue-50/60 dark:from-slate-900/60 dark:via-slate-950/40 dark:to-blue-950/30 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4" data-testid="brain-ribbon">
      <div className="flex items-center gap-3">
        <HexagonLogoFrame size="sm" />
        <div>
          <p className="text-xs uppercase text-muted-foreground">{t('demand.analysis.brainRibbon.decisionSpine')}</p>
          <p className="text-sm font-mono">{brainDecisionId}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isPmoDirectorApproved ? (
          <Badge
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            data-testid="badge-pmo-director-approved"
          >
            <ShieldCheck className="mr-1 h-3 w-3" />
            PMO Director Approved
          </Badge>
        ) : coreviaPreApproved ? (
          <Badge
            className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
            data-testid="badge-policy-pre-approved"
          >
            <ShieldCheck className="mr-1 h-3 w-3" />
            Policy Pre-approved
          </Badge>
        ) : (
          <Badge className={brainStatus.badgeClass}>{brainStatus.label}</Badge>
        )}
        <Badge variant="outline" className="text-xs">{t('demand.analysis.brainRibbon.classification', { value: classification })}</Badge>
        {confidenceLabel && (
          <Badge variant="outline" className="text-xs">{t('demand.analysis.brainRibbon.confidence', { value: confidenceLabel.replace("%", "") })}</Badge>
        )}
        <Badge variant="outline" className="text-xs">
          {t('demand.analysis.brainRibbon.nextGate', {
            gate: coreviaPreApproved
              ? "Human acknowledgement"
              : approvalRoutedToPmoDirector
                ? "PMO Director approval"
                : brainStatus.nextGate
          })}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onShowGovernance}
          data-testid="button-open-brain-governance"
        >
          {t('demand.analysis.brainRibbon.governance')}
        </Button>
      </div>
    </div>
  );
}
