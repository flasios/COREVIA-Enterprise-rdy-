import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from 'react-i18next';
import { VersionCollaborationIndicator } from "@/components/shared/versioning";
import {
  Target,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Eye,
  PanelLeftClose,
  Globe,
  Sparkles,
  Loader2,
} from "lucide-react";
import type { BusinessCaseIntelligenceRailProps } from "./types";
import {
  INTELLIGENCE_RAIL,
  getQualityScoreClasses,
  getQualityCardBackground
} from "./helpers";
import {
  MarketResearchDataExtractor,
  getMarketResearchErrorMessage
} from "@/services/marketResearchExtractor";

export function BusinessCaseIntelligenceRail({
  showIntelligenceRail,
  setShowIntelligenceRail,
  headerContent,
  decisionSpineContent,
  businessCase,
  reportId,
  latestVersion,
  versionsData,
  qualityReport,
  marketResearch,
  isGeneratingResearch,
  setIsGeneratingResearch,
  setMarketResearch,
  setShowQualityInsights,
  setShowMarketResearchPanel,
  demandReportData,
  getStatusBadge,
}: BusinessCaseIntelligenceRailProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const currentVersionLabel = latestVersion?.versionNumber != null
    ? String(latestVersion.versionNumber).trim()
    : '0';
  const displayVersionLabel = /^v/i.test(currentVersionLabel)
    ? currentVersionLabel
    : `v${currentVersionLabel}`;
  const railCardClass = "overflow-hidden rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-[0_18px_45px_-38px_rgba(15,23,42,0.55)] dark:border-slate-800/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.9))]";
  const railHeaderClass = "border-b border-slate-200/70 bg-white/70 px-3 py-2.5 dark:border-slate-800/70 dark:bg-slate-950/30";
  const railBodyClass = "space-y-3 p-3";
  const railInsetClass = "rounded-xl border border-slate-200/70 bg-white/75 p-2.5 dark:border-slate-800/70 dark:bg-slate-900/50";
  const railStatCardClass = "rounded-xl border border-slate-200/70 bg-white/75 p-2 dark:border-slate-800/70 dark:bg-slate-900/50";
  const railLabelClass = "text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";
  const railValueClass = "mt-1 text-xs font-semibold text-slate-900 dark:text-slate-50";

  const handleGenerateMarketResearch = async () => {
    setIsGeneratingResearch(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 270_000); // Keep client timeout just below the server-side 300s market-research budget
    try {
      const extractedRequestData = MarketResearchDataExtractor.extractFromBusinessCase(
        businessCase,
        demandReportData ? {
          id: demandReportData.id as number | undefined,
          data: demandReportData.data as { title?: string } | undefined
        } : null
      );
      const requestData = {
        ...extractedRequestData,
        demandReportId: reportId,
      };

      const response = await fetch('/api/ai-assistant/market-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestData),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || errorData?.error || 'Failed to generate market research');
      }

      const data = await response.json();
      if (data.success) {
        setMarketResearch(data.data);
        setShowMarketResearchPanel(true);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId, 'business-case'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId] }),
          queryClient.refetchQueries({ queryKey: ['/api/demand-reports', reportId, 'business-case'] }),
          queryClient.refetchQueries({ queryKey: ['/api/demand-reports', reportId] }),
        ]);
        toast({ title: t('demand.businessCase.intelligence.researchGenerated'), description: t('demand.businessCase.intelligence.analysisComplete') });
      }
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      const message = isAbort
        ? 'Market research is taking longer than expected. The server may still finish and save it shortly.'
        : getMarketResearchErrorMessage(error);
      toast({
        title: t('demand.businessCase.intelligence.researchFailed'),
        description: message,
        variant: "destructive"
      });
      console.error('Market research generation error:', error);
    } finally {
      clearTimeout(timeoutId);
      setIsGeneratingResearch(false);
    }
  };

  if (!showIntelligenceRail) {
    return null;
  }

  return (
    <div
      className="absolute left-0 top-0 z-40 flex h-full w-[380px] flex-shrink-0 flex-col overflow-hidden border-r border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] shadow-[0_32px_80px_-24px_rgba(15,23,42,0.35),0_0_0_1px_rgba(15,23,42,0.04)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] dark:shadow-[0_32px_80px_-24px_rgba(0,0,0,0.6),0_0_0_1px_rgba(148,163,184,0.08)]"
      onMouseLeave={() => setShowIntelligenceRail(false)}
      data-testid="business-case-intelligence-rail"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-slate-200/60 to-transparent dark:via-slate-700/50" aria-hidden="true" />
      <div className="flex h-full flex-col">
      <div className="flex-shrink-0 border-b border-slate-200/70 bg-gradient-to-r from-white via-sky-50/40 to-white text-foreground backdrop-blur dark:border-slate-800/70 dark:from-slate-950/60 dark:via-sky-950/30 dark:to-slate-950/60">
        <div className="flex items-start justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-tight tracking-tight text-foreground">
                {t('demand.businessCase.intelligence.panelTitle', { defaultValue: 'Intelligence Panel' })}
              </p>
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
              onClick={() => setShowIntelligenceRail(false)}
              data-testid="button-hide-intelligence-rail"
              aria-label="Hide Intelligence Panel"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {headerContent && (
          <div className="space-y-3" data-testid="intelligence-rail-moved-header">
            {headerContent}
          </div>
        )}

        <Card className={`mission-module ${railCardClass}`}>
          <CardHeader className={railHeaderClass}>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/90 via-cyan-500/90 to-teal-500/90 text-white shadow-md shadow-cyan-500/20">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1">COREVIA</span>
              <Badge variant="outline" className="h-5 border-sky-300/50 bg-sky-500/10 px-1.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">AI</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className={railBodyClass}>
            <div className={railInsetClass}>
              <p className="text-[11px] leading-5 text-slate-600 dark:text-slate-300">
              {t('demand.businessCase.intelligence.insightsDescription')}
              </p>
            </div>

            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="group h-auto w-full justify-start rounded-xl border-sky-300/60 bg-gradient-to-r from-sky-50 via-white to-cyan-50 px-3 py-2.5 text-left shadow-[0_16px_35px_-28px_rgba(14,165,233,0.85)] transition-all hover:-translate-y-[1px] hover:border-sky-400/70 hover:from-sky-100 hover:to-cyan-100 hover:shadow-[0_20px_38px_-26px_rgba(14,165,233,0.75)] disabled:translate-y-0 disabled:border-slate-200/70 disabled:from-slate-50 disabled:to-slate-100 disabled:shadow-none dark:border-sky-500/30 dark:bg-gradient-to-r dark:from-sky-500/10 dark:via-slate-900/85 dark:to-cyan-500/10 dark:hover:border-sky-400/40 dark:hover:from-sky-500/15 dark:hover:to-cyan-500/15"
                onClick={handleGenerateMarketResearch}
                disabled={isGeneratingResearch || !latestVersion}
                data-testid="button-generate-market-research-bc"
              >
                <div className="flex w-full items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-500 text-white shadow-md shadow-cyan-500/25">
                  {isGeneratingResearch ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Globe className="h-4 w-4" />
                  )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-50">
                      {marketResearch ? 'Refresh market research' : t('demand.businessCase.intelligence.marketResearch')}
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {isGeneratingResearch ? 'Generating market analysis...' : t('demand.businessCase.intelligence.marketAnalysis')}
                    </p>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-sky-300/70 bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700 shadow-sm transition-colors group-hover:border-sky-400/80 group-hover:text-sky-800 dark:border-sky-400/30 dark:bg-slate-900/70 dark:text-sky-300 dark:group-hover:border-sky-300/40">
                    <span>{isGeneratingResearch ? 'Working' : marketResearch ? 'Refresh' : 'Generate'}</span>
                    {!isGeneratingResearch && <ChevronRight className="h-3 w-3" />}
                  </div>
                </div>
              </Button>
            </div>

            {marketResearch && (
                <div className="space-y-2 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-slate-50">
                    <Sparkles className="h-3 w-3" />
                    {t('demand.businessCase.intelligence.intelligenceReady')}
                  </p>
                  <Badge variant="outline" className="h-5 border-emerald-400/40 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300">
                    {t('demand.businessCase.intelligence.complete')}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className={railStatCardClass}>
                    <p className={railLabelClass}>{t('demand.businessCase.intelligence.globalMarket')}</p>
                    <p className={railValueClass}>{marketResearch.globalMarket?.growthRate || 'N/A'}</p>
                  </div>
                  <div className={railStatCardClass}>
                    <p className={railLabelClass}>{t('demand.businessCase.intelligence.uaeMarket')}</p>
                    <p className={railValueClass}>{marketResearch.uaeMarket?.growthRate || 'N/A'}</p>
                  </div>
                  <div className={railStatCardClass}>
                    <p className={railLabelClass}>{t('demand.businessCase.intelligence.suppliers')}</p>
                    <p className={railValueClass}>{marketResearch.suppliers?.length || 0} identified</p>
                  </div>
                  <div className={railStatCardClass}>
                    <p className={railLabelClass}>{t('demand.businessCase.intelligence.useCases')}</p>
                    <p className={railValueClass}>{marketResearch.useCases?.length || 0} found</p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="group h-9 w-full justify-between rounded-xl border-emerald-300/60 bg-white/90 px-3 text-xs font-semibold text-emerald-800 shadow-[0_14px_30px_-24px_rgba(16,185,129,0.75)] transition-all hover:-translate-y-[1px] hover:border-emerald-400/70 hover:bg-emerald-50 dark:border-emerald-500/25 dark:bg-slate-900/70 dark:text-emerald-300 dark:hover:border-emerald-400/35 dark:hover:bg-emerald-500/10"
                  onClick={() => setShowMarketResearchPanel(true)}
                  data-testid="button-view-market-research-details"
                >
                  <span className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5" />
                    {t('demand.businessCase.intelligence.viewDetails')}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {qualityReport && (
          <Card className={`mission-module ${railCardClass} ${getQualityCardBackground(qualityReport.passed)}`}>
            <CardHeader className={railHeaderClass}>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${qualityReport.passed ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'}`}>
                {qualityReport.passed ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                </span>
                {t('demand.businessCase.intelligence.qualityInsights')}
              </CardTitle>
            </CardHeader>
            <CardContent className={railBodyClass}>
              <div className={railInsetClass}>
                <div className="flex items-center justify-between gap-2">
                <span className={railLabelClass}>{t('demand.businessCase.intelligence.overallScore')}</span>
                <Badge className={getQualityScoreClasses(qualityReport.overallScore)}>
                  {qualityReport.overallScore}/100
                </Badge>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all ${
                      qualityReport.overallScore >= 80 ? 'bg-green-500' :
                      qualityReport.overallScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, qualityReport.overallScore)}%` }}
                  />
                </div>
              </div>

              {Array.isArray(qualityReport.checks) && qualityReport.checks.slice(0, INTELLIGENCE_RAIL.MAX_QUALITY_CHECKS).map((check, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-white/70 px-2.5 py-2 text-xs dark:border-slate-800/70 dark:bg-slate-900/50">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${check.passed ? 'bg-green-500' : 'bg-amber-500'}`} />
                    <span className="truncate text-slate-600 dark:text-slate-300" title={check.name}>{check.name}</span>
                  </div>
                  <Badge variant="outline" className={`text-xs h-5 shrink-0 ${
                    check.score >= 80 ? 'border-green-500/50 text-green-600' :
                    check.score >= 60 ? 'border-amber-500/50 text-amber-600' :
                    'border-red-500/50 text-red-600'
                  }`}>
                    {check.score}/100
                  </Badge>
                </div>
              ))}

              {/* Agent summary */}
              {qualityReport.agentSummary && (
                <div className="space-y-1.5 rounded-xl border border-slate-200/70 bg-white/70 p-2.5 dark:border-slate-800/70 dark:bg-slate-900/50">
                  <p className={railLabelClass}>Agent Summary</p>
                  {Object.entries(qualityReport.agentSummary as Record<string, { status?: string; score?: number; agent?: string }>).slice(0, 4).map(([key, agent]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="truncate text-slate-600 dark:text-slate-300 max-w-[120px]">{String(agent.agent || key).replace(/_/g, ' ')}</span>
                      <Badge variant="outline" className={`text-xs h-5 ${
                        agent.status === 'completed' ? 'border-green-500/40 text-green-600' :
                        agent.status === 'failed' ? 'border-red-500/40 text-red-600' :
                        'border-gray-500/40 text-gray-500'
                      }`}>
                        {agent.status === 'completed' ? '✓' : agent.status === 'failed' ? '✗' : '…'} {typeof agent.score === 'number' ? `${agent.score}%` : agent.status || 'pending'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {qualityReport.aiValidation && !qualityReport.aiValidation.valid && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5">
                  <div className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 font-medium">
                    <AlertCircle className="h-3 w-3" />
                    {t('demand.businessCase.intelligence.aiValidationIssues')}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {Array.isArray(qualityReport.aiValidation.issues) ? qualityReport.aiValidation.issues.length : 0} concerns detected
                  </div>
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="group h-9 w-full justify-between rounded-xl border border-amber-300/60 bg-white/90 px-3 text-xs font-semibold text-amber-800 shadow-[0_14px_30px_-24px_rgba(245,158,11,0.75)] transition-all hover:-translate-y-[1px] hover:border-amber-400/70 hover:bg-amber-50 dark:border-amber-500/25 dark:bg-slate-900/70 dark:text-amber-300 dark:hover:border-amber-400/35 dark:hover:bg-amber-500/10"
                onClick={() => setShowQualityInsights(true)}
                data-testid="button-view-quality-details"
                aria-label="View quality details"
              >
                <span className="flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5" />
                  {t('demand.businessCase.intelligence.viewDetails')}
                </span>
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </CardContent>
          </Card>
        )}

        {decisionSpineContent && (
          <div className="[&>[data-testid='brain-ribbon-business-case-moved']]:rounded-2xl [&>[data-testid='brain-ribbon-business-case-moved']]:border-slate-200/80 [&>[data-testid='brain-ribbon-business-case-moved']]:bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] [&>[data-testid='brain-ribbon-business-case-moved']]:shadow-[0_18px_45px_-38px_rgba(15,23,42,0.55)] dark:[&>[data-testid='brain-ribbon-business-case-moved']]:border-slate-800/80 dark:[&>[data-testid='brain-ribbon-business-case-moved']]:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.9))]" data-testid="intelligence-rail-decision-spine-content">
            {decisionSpineContent}
          </div>
        )}

        <Card className={`mission-module ${railCardClass}`}>
          <CardHeader className={railHeaderClass}>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
                <div
                  className="h-2 w-2 rounded-full status-pulse"
                  style={{ background: 'hsl(var(--accent-cyan))' }}
                  role="status"
                  aria-label="Active collaboration status"
                />
              </div>
              {t('demand.businessCase.intelligence.liveCollaboration')}
            </CardTitle>
          </CardHeader>
          <CardContent className={railBodyClass}>
            {latestVersion && (
              <div className={railInsetClass}>
                <VersionCollaborationIndicator
                  versionId={latestVersion.id}
                  reportId={reportId}
                  variant="sidebar"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={`mission-module depth-2 ${railCardClass}`}>
          <CardHeader className={railHeaderClass}>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-300">
                <Target className="h-4 w-4" />
              </span>
              {t('demand.businessCase.intelligence.workflowStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent className={railBodyClass}>
            {latestVersion && (
              <div className="space-y-2 rounded-xl border border-slate-200/70 bg-white/75 p-2.5 dark:border-slate-800/70 dark:bg-slate-900/50">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className={railLabelClass}>Active version</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{displayVersionLabel}</p>
                  </div>
                  {getStatusBadge(latestVersion.status)}
                </div>
                {latestVersion.approvedAt && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{t('demand.businessCase.intelligence.approvedLabel')}:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-50">{new Date(latestVersion.approvedAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={`mission-module ${railCardClass}`}>
          <CardHeader className={railHeaderClass}>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300">
                <Clock className="h-4 w-4" />
              </span>
              {t('demand.businessCase.intelligence.recentChanges')}
            </CardTitle>
          </CardHeader>
          <CardContent className={railBodyClass}>
            {Array.isArray(versionsData?.data) && versionsData.data.slice(0, INTELLIGENCE_RAIL.MAX_RECENT_VERSIONS).map((version) => (
              <div key={version.id} className="rounded-xl border border-slate-200/70 bg-white/75 px-2.5 py-2 dark:border-slate-800/70 dark:bg-slate-900/50">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-50">{/^v/i.test(String(version.versionNumber)) ? String(version.versionNumber) : `v${String(version.versionNumber)}`}</span>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">{new Date(version.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {(!Array.isArray(versionsData?.data) || versionsData.data.length === 0) && (
              <p className="rounded-xl border border-slate-200/70 bg-white/75 px-2.5 py-2 text-xs text-slate-500 dark:border-slate-800/70 dark:bg-slate-900/50 dark:text-slate-400">{t('demand.businessCase.intelligence.noChanges')}</p>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}

export function IntelligenceRailToggle({
  showIntelligenceRail,
  setShowIntelligenceRail,
}: {
  showIntelligenceRail: boolean;
  setShowIntelligenceRail: (value: boolean) => void;
}) {
  if (showIntelligenceRail) {
    return null;
  }

  return (
    <div
      className="group absolute left-0 top-0 z-30 flex h-full w-3 cursor-pointer flex-col items-center justify-center border-r border-transparent bg-transparent transition-all duration-200 hover:w-5 hover:border-sky-300/40 hover:bg-gradient-to-r hover:from-sky-500/10 hover:via-cyan-500/10 hover:to-transparent dark:hover:border-sky-400/30 dark:hover:from-sky-500/15 dark:hover:via-cyan-500/10"
      onMouseEnter={() => setShowIntelligenceRail(true)}
      onClick={() => setShowIntelligenceRail(true)}
      data-testid="button-show-intelligence-rail"
      role="button"
      tabIndex={0}
      aria-label="Show Intelligence Panel"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setShowIntelligenceRail(true);
        }
      }}
    >
      <span
        className="pointer-events-none flex h-16 w-1 items-center justify-center rounded-full bg-gradient-to-b from-sky-400 via-cyan-500 to-teal-500 opacity-60 shadow-[0_0_12px_rgba(14,165,233,0.55)] transition-all duration-200 group-hover:h-20 group-hover:w-1.5 group-hover:opacity-100 group-hover:shadow-[0_0_18px_rgba(14,165,233,0.85)] dark:from-sky-300 dark:via-cyan-400 dark:to-teal-400"
        aria-hidden="true"
      />
      <span className="sr-only">Show Intelligence Panel</span>
    </div>
  );
}
