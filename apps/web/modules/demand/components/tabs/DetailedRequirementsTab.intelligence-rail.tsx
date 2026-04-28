import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VersionCollaborationIndicator } from '@/components/shared/versioning';
import { DetailedRequirementsDecisionRibbon, type DetailedRequirementsDecisionRibbonProps } from './DetailedRequirementsTab.decision-ribbon';
import { DetailedRequirementsGovernanceShell, type DetailedRequirementsGovernanceShellProps } from './DetailedRequirementsTab.governance-shell';
import { CheckCircle, ChevronRight, Clock, Eye, Globe, Loader2, PanelLeftClose, Sparkles, Target, Users } from 'lucide-react';
import type { ReportVersion, SectionAssignment, Team, User } from '@shared/schema';
import type { MarketResearch } from '@/modules/demand/components/business-case';

interface DisplayRequirementsSummary {
  capabilities?: unknown[];
  functionalRequirements?: unknown[];
  securityRequirements?: unknown[];
  nonFunctionalRequirements?: unknown[];
}

type AssignmentWithRelations = SectionAssignment & {
  team?: Team | null;
  user?: User | null;
};

interface DetailedRequirementsIntelligenceRailProps {
  governanceShellProps: DetailedRequirementsGovernanceShellProps;
  decisionRibbonProps: DetailedRequirementsDecisionRibbonProps | null;
  requirementsRailCardClass: string;
  requirementsRailHeaderClass: string;
  requirementsRailBodyClass: string;
  requirementsRailInsetClass: string;
  requirementsRailStatCardClass: string;
  requirementsRailLabelClass: string;
  requirementsRailValueClass: string;
  latestVersion: ReportVersion | null | undefined;
  reportId: string;
  displayVersionLabel: string;
  latestVersionStatusBadge: ReactNode;
  versions: ReportVersion[] | null | undefined;
  displayRequirements: DisplayRequirementsSummary | null | undefined;
  assignments: AssignmentWithRelations[];
  marketResearch: MarketResearch | null;
  isGeneratingResearch: boolean;
  onGenerateMarketResearch: () => void;
  onOpenMarketResearchPanel: () => void;
  onHideRail: () => void;
}

export function DetailedRequirementsIntelligenceRail({
  governanceShellProps,
  decisionRibbonProps,
  requirementsRailCardClass,
  requirementsRailHeaderClass,
  requirementsRailBodyClass,
  requirementsRailInsetClass,
  requirementsRailStatCardClass,
  requirementsRailLabelClass,
  requirementsRailValueClass,
  latestVersion,
  reportId,
  displayVersionLabel,
  latestVersionStatusBadge,
  versions,
  displayRequirements,
  assignments,
  marketResearch,
  isGeneratingResearch,
  onGenerateMarketResearch,
  onOpenMarketResearchPanel,
  onHideRail,
}: DetailedRequirementsIntelligenceRailProps) {
  const { t } = useTranslation();

  return (
    <div
      className="absolute left-0 top-0 z-40 flex h-full w-[380px] min-h-0 flex-shrink-0 flex-col overflow-hidden border-r border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] shadow-[0_32px_80px_-24px_rgba(15,23,42,0.35),0_0_0_1px_rgba(15,23,42,0.04)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] dark:shadow-[0_32px_80px_-24px_rgba(0,0,0,0.6),0_0_0_1px_rgba(148,163,184,0.08)]"
      onMouseLeave={onHideRail}
      data-testid="requirements-intelligence-rail"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-slate-200/60 to-transparent dark:via-slate-700/50" aria-hidden="true" />
      <div className="flex-shrink-0 border-b border-slate-200/70 bg-gradient-to-r from-white via-sky-50/40 to-white text-foreground backdrop-blur dark:border-slate-800/70 dark:from-slate-950/60 dark:via-sky-950/30 dark:to-slate-950/60">
        <div className="flex items-start justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-tight tracking-tight text-foreground">{t('demand.tabs.requirements.intelligenceRail')}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">Decision support · Quality · Workflow</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant="outline" className="h-5 gap-1 border-emerald-400/30 bg-emerald-500/10 px-1.5 text-[9px] font-medium text-emerald-700 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
              Live
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              onClick={onHideRail}
              data-testid="button-hide-intelligence-rail-requirements"
              aria-label="Hide Intelligence Panel"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
        <div className="space-y-3" data-testid="intelligence-rail-moved-header-requirements">
          <DetailedRequirementsGovernanceShell {...governanceShellProps} />
        </div>

        <Card className={`mission-module ${requirementsRailCardClass}`}>
          <CardHeader className={requirementsRailHeaderClass}>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-300">
                <Globe className="h-4 w-4" />
              </span>
              Requirements Market Research
            </CardTitle>
          </CardHeader>
          <CardContent className={requirementsRailBodyClass}>
            <div className="rounded-xl border border-slate-200/70 bg-white/75 p-2.5 dark:border-slate-800/70 dark:bg-slate-900/50">
              <p className="text-[11px] leading-5 text-slate-600 dark:text-slate-300">
                External market and vendor insight tailored to the requirements scope.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="group h-auto w-full justify-start rounded-xl border-sky-300/60 bg-gradient-to-r from-sky-50 via-white to-cyan-50 px-3 py-2.5 text-left shadow-[0_16px_35px_-28px_rgba(14,165,233,0.85)] transition-all hover:-translate-y-[1px] hover:border-sky-400/70 hover:from-sky-100 hover:to-cyan-100 hover:shadow-[0_20px_38px_-26px_rgba(14,165,233,0.75)] disabled:translate-y-0 disabled:border-slate-200/70 disabled:from-slate-50 disabled:to-slate-100 disabled:shadow-none dark:border-sky-500/30 dark:bg-gradient-to-r dark:from-sky-500/10 dark:via-slate-900/85 dark:to-cyan-500/10 dark:hover:border-sky-400/40 dark:hover:from-sky-500/15 dark:hover:to-cyan-500/15"
              onClick={onGenerateMarketResearch}
              disabled={isGeneratingResearch || !latestVersion}
              data-testid="button-generate-market-research-requirements"
            >
              <div className="flex w-full items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-500 text-white shadow-md shadow-cyan-500/25">
                  {isGeneratingResearch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-50">
                    {marketResearch ? 'Refresh research' : 'Generate research'}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {isGeneratingResearch ? 'Generating requirements-focused analysis...' : 'Vendors, trends, benchmarks, and implementation signals.'}
                  </p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-sky-300/70 bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700 shadow-sm transition-colors group-hover:border-sky-400/80 group-hover:text-sky-800 dark:border-sky-400/30 dark:bg-slate-900/70 dark:text-sky-300 dark:group-hover:border-sky-300/40">
                  <span>{isGeneratingResearch ? 'Working' : marketResearch ? 'Refresh' : 'Generate'}</span>
                  {!isGeneratingResearch && <ChevronRight className="h-3 w-3" />}
                </div>
              </div>
            </Button>

            {marketResearch && (
              <div className="space-y-2 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-slate-50">
                    <Sparkles className="h-3 w-3" />
                    Research ready
                  </p>
                  <Badge variant="outline" className="h-5 border-emerald-400/40 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300">
                    Complete
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className={requirementsRailStatCardClass}>
                    <p className={requirementsRailLabelClass}>Global market</p>
                    <p className={requirementsRailValueClass}>{marketResearch.globalMarket?.growthRate || 'N/A'}</p>
                  </div>
                  <div className={requirementsRailStatCardClass}>
                    <p className={requirementsRailLabelClass}>UAE market</p>
                    <p className={requirementsRailValueClass}>{marketResearch.uaeMarket?.growthRate || 'N/A'}</p>
                  </div>
                  <div className={requirementsRailStatCardClass}>
                    <p className={requirementsRailLabelClass}>Suppliers</p>
                    <p className={requirementsRailValueClass}>{marketResearch.suppliers?.length || 0} identified</p>
                  </div>
                  <div className={requirementsRailStatCardClass}>
                    <p className={requirementsRailLabelClass}>Use cases</p>
                    <p className={requirementsRailValueClass}>{marketResearch.useCases?.length || 0} found</p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="group h-9 w-full justify-between rounded-xl border-emerald-300/60 bg-white/90 px-3 text-xs font-semibold text-emerald-800 shadow-[0_14px_30px_-24px_rgba(16,185,129,0.75)] transition-all hover:-translate-y-[1px] hover:border-emerald-400/70 hover:bg-emerald-50 dark:border-emerald-500/25 dark:bg-slate-900/70 dark:text-emerald-300 dark:hover:border-emerald-400/35 dark:hover:bg-emerald-500/10"
                  onClick={onOpenMarketResearchPanel}
                  data-testid="button-view-market-research-requirements"
                >
                  <span className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5" />
                    View details
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={`mission-module ${requirementsRailCardClass}`}>
          <CardHeader className={requirementsRailHeaderClass}>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
                <div
                  className="h-2 w-2 rounded-full status-pulse"
                  style={{ background: 'hsl(var(--accent-cyan))' }}
                  role="status"
                  aria-label="Active collaboration status"
                />
              </div>
              {t('demand.tabs.requirements.liveCollaboration')}
            </CardTitle>
          </CardHeader>
          <CardContent className={requirementsRailBodyClass}>
            {latestVersion && (
              <div className={requirementsRailInsetClass}>
                <VersionCollaborationIndicator
                  versionId={latestVersion.id}
                  reportId={reportId}
                  variant="sidebar"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={`mission-module depth-2 ${requirementsRailCardClass}`}>
          <CardHeader className={requirementsRailHeaderClass}>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-300">
                <Target className="h-4 w-4" />
              </span>
              {t('demand.tabs.requirements.workflowStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent className={requirementsRailBodyClass}>
            {latestVersion && (
              <div className="space-y-2 rounded-xl border border-slate-200/70 bg-white/75 p-2.5 dark:border-slate-800/70 dark:bg-slate-900/50">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className={requirementsRailLabelClass}>Active version</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{displayVersionLabel}</p>
                  </div>
                  {latestVersionStatusBadge}
                </div>
                {latestVersion.approvedAt && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{t('demand.tabs.requirements.approved')}:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-50">{new Date(latestVersion.approvedAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={`mission-module ${requirementsRailCardClass}`}>
          <CardHeader className={requirementsRailHeaderClass}>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300">
                <Clock className="h-4 w-4" />
              </span>
              {t('demand.tabs.requirements.recentChanges')}
            </CardTitle>
          </CardHeader>
          <CardContent className={requirementsRailBodyClass}>
            {versions && versions.slice(0, 3).map((version) => (
              <div key={version.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-white/75 px-2.5 py-2 dark:border-slate-800/70 dark:bg-slate-900/50">
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Version</p>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-50">{/^v/i.test(String(version.versionNumber)) ? String(version.versionNumber) : `v${String(version.versionNumber)}`}</span>
                </div>
                <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">{new Date(version.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
            {(!versions || versions.length === 0) && (
              <p className="rounded-xl border border-slate-200/70 bg-white/75 px-2.5 py-2 text-xs text-slate-500 dark:border-slate-800/70 dark:bg-slate-900/50 dark:text-slate-400">{t('demand.tabs.requirements.noChangesYet')}</p>
            )}
          </CardContent>
        </Card>

        <Card className={`mission-module ${requirementsRailCardClass}`}>
          <CardHeader className={requirementsRailHeaderClass}>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                <CheckCircle className="h-4 w-4" />
              </span>
              {t('demand.tabs.requirements.sectionProgress')}
            </CardTitle>
          </CardHeader>
          <CardContent className={requirementsRailBodyClass}>
            <div className="grid grid-cols-2 gap-2">
              {displayRequirements && (
                <>
                  <div className={requirementsRailStatCardClass}>
                    <p className={requirementsRailLabelClass}>{t('demand.tabs.requirements.capabilities')}</p>
                    <p className={requirementsRailValueClass}>{displayRequirements.capabilities?.length || 0} {t('demand.tabs.requirements.items')}</p>
                  </div>
                  <div className={requirementsRailStatCardClass}>
                    <p className={requirementsRailLabelClass}>{t('demand.tabs.requirements.functional')}</p>
                    <p className={requirementsRailValueClass}>{displayRequirements.functionalRequirements?.length || 0} {t('demand.tabs.requirements.items')}</p>
                  </div>
                  <div className={requirementsRailStatCardClass}>
                    <p className={requirementsRailLabelClass}>{t('demand.tabs.requirements.security')}</p>
                    <p className={requirementsRailValueClass}>{displayRequirements.securityRequirements?.length || 0} {t('demand.tabs.requirements.items')}</p>
                  </div>
                  <div className={requirementsRailStatCardClass}>
                    <p className={requirementsRailLabelClass}>{t('demand.tabs.requirements.nonFunctional')}</p>
                    <p className={requirementsRailValueClass}>{displayRequirements.nonFunctionalRequirements?.length || 0} {t('demand.tabs.requirements.items')}</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {decisionRibbonProps && (
          <div className="[&>[data-testid='brain-ribbon-requirements-moved']]:rounded-2xl [&>[data-testid='brain-ribbon-requirements-moved']]:border-slate-200/80 [&>[data-testid='brain-ribbon-requirements-moved']]:bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] [&>[data-testid='brain-ribbon-requirements-moved']]:shadow-[0_18px_45px_-38px_rgba(15,23,42,0.55)] dark:[&>[data-testid='brain-ribbon-requirements-moved']]:border-slate-800/80 dark:[&>[data-testid='brain-ribbon-requirements-moved']]:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.9))]" data-testid="intelligence-rail-decision-spine-content-requirements">
            <DetailedRequirementsDecisionRibbon {...decisionRibbonProps} />
          </div>
        )}

        <Card className={`mission-module ${requirementsRailCardClass}`}>
          <CardHeader className={requirementsRailHeaderClass}>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                <Users className="h-4 w-4" />
              </span>
              {t('demand.tabs.requirements.teamMembers')}
            </CardTitle>
          </CardHeader>
          <CardContent className={requirementsRailBodyClass}>
            <div className="space-y-2 rounded-xl border border-slate-200/70 bg-white/75 p-2.5 dark:border-slate-800/70 dark:bg-slate-900/50">
              {assignments.slice(0, 5).map((assignment, idx) => (
                <div key={idx} className="flex items-center gap-3 rounded-lg border border-slate-200/60 bg-white/75 px-2.5 py-2 dark:border-slate-800/60 dark:bg-slate-950/30">
                  <div className="h-2.5 w-2.5 rounded-full ring-2 ring-background" style={{ backgroundColor: assignment.team?.color || '#6366F1' }} />
                  <span className="text-sm font-medium text-foreground truncate">
                    {assignment.user?.displayName || assignment.team?.name}
                  </span>
                </div>
              ))}
              {assignments.length === 0 && (
                <p className="rounded-xl border border-slate-200/70 bg-white/75 px-2.5 py-2 text-xs text-slate-500 dark:border-slate-800/70 dark:bg-slate-900/50 dark:text-slate-400">{t('demand.tabs.requirements.noAssignmentsYet')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}