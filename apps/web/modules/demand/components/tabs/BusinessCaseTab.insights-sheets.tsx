import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { HexagonLogoFrame } from '@/components/shared/misc';
import { ComplianceDashboard } from '@/modules/compliance';
import { AlertCircle, AlertTriangle, CheckCircle, ClipboardCheck, Lightbulb, Sparkles } from 'lucide-react';
import type { QualityReport } from '../business-case';
import { normalizePercentValue } from './BusinessCaseTab.helpers';

interface BusinessCaseInsightsSheetsProps {
  showCompliancePanel: boolean;
  onCompliancePanelOpenChange: (open: boolean) => void;
  showQualityInsights: boolean;
  onQualityInsightsOpenChange: (open: boolean) => void;
  reportId: string;
  qualityReport: QualityReport | null;
  brainDecision?: Record<string, unknown>;
}

function safeStr(val: unknown, fallback: string): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return fallback;
}

function scoreColorClass(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function scoreBadgeClass(score: number): string {
  if (score >= 80) return 'bg-green-500/20 text-green-700';
  if (score >= 60) return 'bg-amber-500/20 text-amber-700';
  return 'bg-red-500/20 text-red-700';
}

function statusBorderClass(status: string | null): string {
  if (status === 'completed') return 'border-green-500/20';
  if (status === 'failed') return 'border-red-500/20';
  return 'border-gray-500/20';
}

function statusDotClass(status: string | null): string {
  if (status === 'completed') return 'bg-green-500';
  if (status === 'failed') return 'bg-red-500';
  return 'bg-gray-400';
}

function statusBadgeClass(status: string | null): string {
  if (status === 'completed') return 'border-green-500/40 text-green-600';
  if (status === 'failed') return 'border-red-500/40 text-red-600';
  return 'border-gray-500/40 text-gray-500';
}

export function BusinessCaseInsightsSheets({
  showCompliancePanel,
  onCompliancePanelOpenChange,
  showQualityInsights,
  onQualityInsightsOpenChange,
  reportId,
  qualityReport,
  brainDecision,
}: Readonly<BusinessCaseInsightsSheetsProps>) {
  const { t } = useTranslation();
  const detailedAgentSummary = useMemo(() => {
    const orchestration = (brainDecision?.orchestrationPlan as Record<string, unknown> | undefined) || {};
    const selectedAgents = Array.isArray(orchestration.agentsSelected)
      ? orchestration.agentsSelected as Array<Record<string, unknown>>
      : [];
    const executionPlan = Array.isArray(orchestration.executionPlan)
      ? orchestration.executionPlan as Array<Record<string, unknown>>
      : [];
    const qualityAgents = qualityReport?.agentSummary
      ? Object.entries(qualityReport.agentSummary as Record<string, { status?: string; score?: number; agent?: string }>)
      : [];

    const mergedAgents = new Map<string, {
      key: string;
      agentId: string;
      agentName: string;
      mode: string | null;
      status: string | null;
      score: number | null;
      sources: string[];
    }>();

    const ensureAgent = (agentId: string, agentName: string) => {
      const normalizedId = agentId || agentName;
      const existing = mergedAgents.get(normalizedId);
      if (existing) return existing;
      const created = {
        key: normalizedId,
        agentId: normalizedId,
        agentName: agentName || normalizedId,
        mode: null,
        status: null,
        score: null,
        sources: [] as string[],
      };
      mergedAgents.set(normalizedId, created);
      return created;
    };

    selectedAgents.forEach((agent) => {
      const entry = ensureAgent(
        safeStr(agent.agentId ?? agent.id ?? agent.agentName, ''),
        safeStr(agent.agentName ?? agent.agentId ?? agent.id, 'Agent'),
      );
      entry.mode = typeof agent.mode === 'string' ? agent.mode : entry.mode;
      if (!entry.sources.includes('selection')) entry.sources.push('selection');
    });

    executionPlan.forEach((step) => {
      if (safeStr(step.type, 'agent') !== 'agent') {
        return;
      }
      const entry = ensureAgent(
        safeStr(step.agentId ?? step.target ?? step.name ?? step.agentName, ''),
        safeStr(step.agentName ?? step.name ?? step.target ?? step.agentId, 'Agent'),
      );
      entry.mode = typeof step.mode === 'string' ? step.mode : entry.mode;
      entry.status = typeof step.status === 'string' ? step.status : entry.status;
      if (!entry.sources.includes('plan')) entry.sources.push('plan');
    });

    qualityAgents.forEach(([key, agent]) => {
      const entry = ensureAgent(String(key), String(agent.agent || key));
      entry.status = typeof agent.status === 'string' ? agent.status : entry.status;
      entry.score = normalizePercentValue(agent.score);
      if (!entry.sources.includes('quality')) entry.sources.push('quality');
    });

    return Array.from(mergedAgents.values()).sort((left, right) => left.agentName.localeCompare(right.agentName));
  }, [brainDecision, qualityReport]);

  return (
    <>
      <Sheet open={showCompliancePanel} onOpenChange={onCompliancePanelOpenChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-6xl">
          <SheetHeader className="mb-6">
            <SheetTitle>{t('demand.tabs.businessCase.complianceCheck')}</SheetTitle>
            <SheetDescription>
              {t('demand.tabs.businessCase.complianceDescription')}
            </SheetDescription>
          </SheetHeader>
          <ComplianceDashboard reportId={reportId} embedded={true} />
        </SheetContent>
      </Sheet>

      <Sheet open={showQualityInsights} onOpenChange={onQualityInsightsOpenChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2">
              {qualityReport?.passed ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              {t('demand.tabs.businessCase.qualityInsightsReport')}
            </SheetTitle>
            <SheetDescription>
              {t('demand.tabs.businessCase.qualityInsightsDescription')}
            </SheetDescription>
          </SheetHeader>

          {qualityReport ? (
            <div className="space-y-6">
              <Card className={qualityReport.passed ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{t('demand.tabs.businessCase.overallQualityScore')}</h3>
                      <p className="text-sm text-muted-foreground">{qualityReport.summary}</p>
                    </div>
                    <div className={`text-4xl font-bold ${scoreColorClass(qualityReport.overallScore)}`}>
                      {qualityReport.overallScore}
                      <span className="text-lg text-muted-foreground">/100</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <h3 className="flex items-center gap-2 font-semibold">
                  <ClipboardCheck className="h-4 w-4" />
                  {t('demand.tabs.businessCase.qualityChecks')}
                </h3>
                {qualityReport.checks?.map((check) => (
                  <Card key={check.name} className={check.passed ? 'border-green-500/20' : 'border-amber-500/20'}>
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {check.passed ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                          )}
                          <span className="font-medium">{check.name}</span>
                        </div>
                        <Badge className={check.passed ? 'bg-green-500/20 text-green-700' : 'bg-amber-500/20 text-amber-700'}>
                          {check.score}/100
                        </Badge>
                      </div>

                      {check.issues && check.issues.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {check.issues.map((issue) => (
                            <div key={issue} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <span className="mt-0.5 text-amber-500">*</span>
                              <span>{issue}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {check.recommendations && check.recommendations.length > 0 && (
                        <div className="mt-2 space-y-1 border-l-2 border-blue-500/30 pl-4">
                          {check.recommendations.map((recommendation) => (
                            <div key={recommendation} className="flex items-start gap-2 text-sm text-blue-600 dark:text-blue-400">
                              <Lightbulb className="mt-0.5 h-3 w-3 flex-shrink-0" />
                              <span>{recommendation}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {qualityReport.aiValidation && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <HexagonLogoFrame px={16} />
                    {t('demand.tabs.businessCase.aiSelfValidation')}
                    <Badge className={qualityReport.aiValidation.valid ? 'bg-green-500/20 text-green-700' : 'bg-amber-500/20 text-amber-700'}>
                      {Math.round(qualityReport.aiValidation.score * 100)}%
                    </Badge>
                  </h3>

                  {qualityReport.aiValidation.issues.length > 0 ? (
                    <Card className="border-amber-500/20 bg-amber-500/5">
                      <CardContent className="space-y-2 p-4">
                        <p className="mb-3 text-sm text-muted-foreground">
                          {t('demand.tabs.businessCase.aiDetectedConcerns')}:
                        </p>
                        {qualityReport.aiValidation.issues.map((issue) => (
                          <div key={issue} className="flex items-start gap-2 text-sm">
                            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                            <span>{issue}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-green-500/20 bg-green-500/5">
                      <CardContent className="flex items-center gap-2 p-4">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">{t('demand.tabs.businessCase.noAiValidationConcerns')}</span>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {detailedAgentSummary.length > 0 && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Sparkles className="h-4 w-4" />
                    Agent Summary
                    <Badge variant="outline" className="text-xs">
                      {detailedAgentSummary.length} {t('demand.tabs.businessCase.agents', 'agents')}
                    </Badge>
                  </h3>
                  <div className="grid gap-2">
                    {detailedAgentSummary.map((agent) => (
                      <Card key={agent.key} className={statusBorderClass(agent.status)}>
                        <CardContent className="flex items-center justify-between gap-3 p-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${statusDotClass(agent.status)}`} />
                              <span className="truncate text-sm font-medium">{agent.agentName.replaceAll('_', ' ')}</span>
                            </div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {agent.agentId}
                              {agent.mode ? ` · mode: ${agent.mode}` : ''}
                              {agent.sources.length > 0 ? ` · ${agent.sources.join(' + ')}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {agent.score != null && (
                              <Badge className={scoreBadgeClass(agent.score)}>
                                {agent.score}%
                              </Badge>
                            )}
                            <Badge variant="outline" className={`text-xs ${statusBadgeClass(agent.status)}`}>
                              {agent.status || 'planned'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {qualityReport.agentSummary && Object.keys(qualityReport.agentSummary).length > 0 && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Sparkles className="h-4 w-4" />
                    Quality-only Summary
                  </h3>
                  <div className="grid gap-2">
                    {Object.entries(qualityReport.agentSummary as Record<string, { status?: string; score?: number; agent?: string }>).map(([key, agent]) => (
                      <Card key={`quality-${key}`} className={statusBorderClass(agent.status ?? null)}>
                        <CardContent className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${statusDotClass(agent.status ?? null)}`} />
                            <span className="text-sm font-medium">{safeStr(agent.agent, key).replaceAll('_', ' ')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {normalizePercentValue(agent.score) != null && (
                              <Badge className={scoreBadgeClass(normalizePercentValue(agent.score) ?? 0)}>
                                {normalizePercentValue(agent.score)}%
                              </Badge>
                            )}
                            <Badge variant="outline" className={`text-xs ${statusBadgeClass(agent.status ?? null)}`}>
                              {agent.status || 'pending'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {qualityReport.agentScore != null && (
                <Card className="border-blue-500/20 bg-blue-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">{t('demand.tabs.businessCase.agentSignalQuality', 'Agent Signal Quality')}</h3>
                        <p className="text-xs text-muted-foreground">{t('demand.tabs.businessCase.aggregateAgentConfidence', 'Aggregate confidence from all contributing agents')}</p>
                      </div>
                      <div className={`text-2xl font-bold ${scoreColorClass(normalizePercentValue(qualityReport.agentScore) ?? 0)}`}>
                        {normalizePercentValue(qualityReport.agentScore) ?? 0}%
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardCheck className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">{t('demand.tabs.businessCase.noQualityReport')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('demand.tabs.businessCase.generateToSeeQuality')}</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
