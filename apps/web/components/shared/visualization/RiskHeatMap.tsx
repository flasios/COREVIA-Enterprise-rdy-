import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { useTranslation } from 'react-i18next';

interface Assumption {
  assumption: string;
  category?: string;
  impact?: string;
  likelihood?: string;
  riskScore?: number;
  validated?: boolean;
  mitigation?: string;
}

interface RiskHeatMapProps {
  assumptions: Assumption[];
}

export default function RiskHeatMap({ assumptions }: RiskHeatMapProps) {
  const { t } = useTranslation();

  // Create risk matrix grid
  const impactLevels = ['Low', 'Medium', 'High'];
  const likelihoodLevels = ['Low', 'Medium', 'High'];

  // Categorize assumptions into risk matrix cells
  const getRiskCell = (impact: string, likelihood: string) => {
    return assumptions.filter(a => {
      const aImpact = (a.impact || 'Medium').toLowerCase();
      const aLikelihood = (a.likelihood || 'Medium').toLowerCase();
      return aImpact.includes(impact.toLowerCase()) && aLikelihood.includes(likelihood.toLowerCase());
    });
  };

  // Get risk color based on score
  const getRiskColor = (impact: string, likelihood: string) => {
    const impactScore = impact === 'High' ? 3 : impact === 'Medium' ? 2 : 1;
    const likelihoodScore = likelihood === 'High' ? 3 : likelihood === 'Medium' ? 2 : 1;
    const score = impactScore * likelihoodScore;

    if (score >= 6) return 'bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-800';
    if (score >= 4) return 'bg-orange-100 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800';
    if (score >= 2) return 'bg-yellow-100 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-800';
    return 'bg-green-100 dark:bg-green-950/40 border-green-300 dark:border-green-800';
  };

  const getRiskLabel = (impact: string, likelihood: string) => {
    const impactScore = impact === 'High' ? 3 : impact === 'Medium' ? 2 : 1;
    const likelihoodScore = likelihood === 'High' ? 3 : likelihood === 'Medium' ? 2 : 1;
    const score = impactScore * likelihoodScore;
    if (score >= 6) return 'Critical';
    if (score >= 4) return 'High';
    if (score >= 2) return 'Medium';
    return 'Low';
  };

  const totalAssumptions = assumptions.length;
  const criticalCount = assumptions.filter(a => (a.riskScore || 0) >= 6).length;
  const highCount = assumptions.filter(a => {
    const score = a.riskScore || 0;
    return score >= 4 && score < 6;
  }).length;

  return (
    <Card data-testid="card-risk-heat-map">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            {t('visualization.riskHeatMap.title')}
          </span>
          <div className="flex gap-1.5">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {criticalCount} Critical
              </Badge>
            )}
            {highCount > 0 && (
              <Badge className="text-[10px] bg-orange-500 hover:bg-orange-600">
                {highCount} High
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {totalAssumptions} Total
            </Badge>
          </div>
        </CardTitle>
        <CardDescription>{t('visualization.riskHeatMap.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded"></div>
              <span>{t('visualization.riskHeatMap.critical')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-100 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800 rounded"></div>
              <span>{t('visualization.riskHeatMap.high')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 dark:bg-yellow-950/40 border border-yellow-300 dark:border-yellow-800 rounded"></div>
              <span>{t('visualization.riskHeatMap.medium')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 dark:bg-green-950/40 border border-green-300 dark:border-green-800 rounded"></div>
              <span>{t('visualization.riskHeatMap.low')}</span>
            </div>
          </div>

          {/* Risk Matrix */}
          <TooltipProvider>
            <div className="relative">
              {/* Y-axis label */}
              <div className="absolute -left-16 top-1/2 -translate-y-1/2 -rotate-90 text-sm font-medium text-muted-foreground whitespace-nowrap">
                {t('visualization.riskHeatMap.impactAxis')} →
              </div>

              {/* X-axis label */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm font-medium text-muted-foreground">
                {t('visualization.riskHeatMap.likelihoodAxis')} →
              </div>

              <div className="grid grid-cols-4 gap-2">
                {/* Header row */}
                <div className="font-medium text-sm"></div>
                {likelihoodLevels.map(level => (
                  <div key={level} className="font-medium text-sm text-center">{level}</div>
                ))}

                {/* Data rows */}
                {[...impactLevels].reverse().map(impact => (
                  <div key={`row-${impact}`} className="contents">
                    <div className="font-medium text-sm flex items-center">{impact}</div>
                    {likelihoodLevels.map(likelihood => {
                      const cellAssumptions = getRiskCell(impact, likelihood);
                      const riskColor = getRiskColor(impact, likelihood);
                      const riskLabel = getRiskLabel(impact, likelihood);

                      return (
                        <div
                          key={`${impact}-${likelihood}`}
                          className={`${riskColor} border-2 rounded-lg p-2 min-h-28 flex flex-col`}
                          data-testid={`risk-cell-${impact}-${likelihood}`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-semibold text-muted-foreground">{riskLabel}</span>
                            <Badge variant="outline" className="text-[9px] h-4 px-1">
                              {cellAssumptions.length}
                            </Badge>
                          </div>
                          <div className="flex-1 overflow-y-auto space-y-1">
                            {cellAssumptions.map((assumption, idx) => (
                              <Tooltip key={idx}>
                                <TooltipTrigger asChild>
                                  <div
                                    className="text-xs bg-background/60 backdrop-blur-sm px-1.5 py-1 rounded border border-border/30 cursor-help"
                                    data-testid={`risk-assumption-${impact}-${likelihood}-${idx}`}
                                  >
                                    <div className="flex items-start gap-1">
                                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                                      <span className="line-clamp-2 leading-tight">{assumption.assumption}</span>
                                    </div>
                                    {assumption.category && (
                                      <Badge variant="secondary" className="text-[8px] h-3 px-0.5 mt-0.5">
                                        {assumption.category}
                                      </Badge>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs p-3">
                                  <div className="space-y-1.5">
                                    <p className="font-medium text-sm">{assumption.assumption}</p>
                                    <div className="flex gap-2 text-xs text-muted-foreground">
                                      <span>Impact: <strong>{assumption.impact || 'Medium'}</strong></span>
                                      <span>Likelihood: <strong>{assumption.likelihood || 'Medium'}</strong></span>
                                      {assumption.riskScore && <span>Score: <strong>{assumption.riskScore}</strong></span>}
                                    </div>
                                    {assumption.category && (
                                      <p className="text-xs">Category: {assumption.category}</p>
                                    )}
                                    {assumption.mitigation && (
                                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                        Mitigation: {assumption.mitigation}
                                      </p>
                                    )}
                                    {assumption.validated !== undefined && (
                                      <Badge variant={assumption.validated ? "default" : "secondary"} className="text-[10px]">
                                        {assumption.validated ? '✓ Validated' : 'Unvalidated'}
                                      </Badge>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </TooltipProvider>

          {/* Critical Assumptions Summary */}
          {assumptions.filter(a => (a.riskScore || 0) >= 6).length > 0 && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="font-semibold text-sm mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                {t('visualization.riskHeatMap.criticalAttention')}
              </div>
              <div className="space-y-2">
                {assumptions
                  .filter(a => (a.riskScore || 0) >= 6)
                  .map((assumption, idx) => (
                    <div key={idx} className="bg-background/50 p-2.5 rounded-md border border-red-200/50 dark:border-red-800/50" data-testid={`critical-assumption-${idx}`}>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-red-500 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{assumption.assumption}</p>
                          <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                            <span>Risk Score: <strong className="text-red-600">{assumption.riskScore}</strong></span>
                            {assumption.impact && <span>Impact: <strong>{assumption.impact}</strong></span>}
                            {assumption.likelihood && <span>Likelihood: <strong>{assumption.likelihood}</strong></span>}
                            {assumption.category && <span>Category: {assumption.category}</span>}
                          </div>
                          {assumption.mitigation && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                              <Info className="h-3 w-3 inline mr-1" />
                              Mitigation: {assumption.mitigation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
