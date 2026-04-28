import { 
  Plus, AlertTriangle, Shield, TrendingUp, Clock,
  Target, ChevronRight, Activity
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ProjectData, BusinessCaseData, BusinessCaseRisk } from '../../types';
import { collectBusinessCaseRisks, type UnifiedRisk } from '../../utils/riskSources';

interface RiskRegisterInitProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  demandReport?: unknown;
  onAddRisk?: () => void;
}

const PROBABILITY_LEVELS = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
const IMPACT_LEVELS = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];

const getRiskLevel = (probability: number, impact: number): string => {
  const matrix = [
    ['Low', 'Low', 'Medium', 'Medium', 'High'],
    ['Low', 'Medium', 'Medium', 'High', 'High'],
    ['Medium', 'Medium', 'High', 'High', 'Critical'],
    ['Medium', 'High', 'High', 'Critical', 'Critical'],
    ['High', 'High', 'Critical', 'Critical', 'Critical'],
  ];
  return matrix[probability]?.[impact] || 'Medium';
};

const getLevelIndex = (level: string): number => {
  const normalized = level?.toLowerCase() || 'medium';
  if (normalized.includes('very low') || normalized === 'verylow') return 0;
  if (normalized.includes('low')) return 1;
  if (normalized.includes('medium') || normalized.includes('moderate')) return 2;
  if (normalized.includes('very high') || normalized === 'veryhigh') return 4;
  if (normalized.includes('high')) return 3;
  if (normalized.includes('critical') || normalized.includes('severe')) return 4;
  return 2;
};

export function RiskRegisterInit({
   
  project: _project,
  businessCase,
  demandReport,
  onAddRisk,
}: RiskRegisterInitProps) {
  const { t } = useTranslation();
  const unifiedRisks: UnifiedRisk[] = collectBusinessCaseRisks(businessCase, demandReport);
  const identifiedRisks = unifiedRisks as BusinessCaseRisk[];

  const getRiskPosition = (risk: BusinessCaseRisk) => {
    const u = risk as UnifiedRisk;
    if (typeof u.probIdx === 'number' && typeof u.impactIdx === 'number') {
      return { probIdx: u.probIdx, impactIdx: u.impactIdx };
    }
    const probIdx = getLevelIndex(risk.likelihood || risk.probability || 'medium');
    const impactIdx = getLevelIndex(risk.impact || 'medium');
    return { probIdx, impactIdx };
  };

  const getRisksAtPosition = (probIdx: number, impactIdx: number) => {
    return identifiedRisks.filter(risk => {
      const pos = getRiskPosition(risk);
      return pos.probIdx === (4 - probIdx) && pos.impactIdx === impactIdx;
    });
  };

  const getMatrixCellColor = (probIdx: number, impactIdx: number) => {
    const level = getRiskLevel(probIdx, impactIdx);
    switch (level) {
      case 'Low': return 'bg-emerald-500/20 border-emerald-500/30';
      case 'Medium': return 'bg-amber-500/20 border-amber-500/30';
      case 'High': return 'bg-orange-500/20 border-orange-500/30';
      case 'Critical': return 'bg-red-500/20 border-red-500/30';
      default: return 'bg-muted/30 border-border';
    }
  };

  const getRiskBadgeColor = (risk: BusinessCaseRisk) => {
    const { probIdx, impactIdx } = getRiskPosition(risk);
    const level = getRiskLevel(probIdx, impactIdx);
    switch (level) {
      case 'Low': return 'bg-emerald-600 text-white';
      case 'Medium': return 'bg-amber-600 text-white';
      case 'High': return 'bg-orange-600 text-white';
      case 'Critical': return 'bg-red-600 text-white';
      default: return 'bg-muted text-foreground';
    }
  };

  const getSeverityStats = () => {
    const stats = { low: 0, medium: 0, high: 0, critical: 0 };
    identifiedRisks.forEach(risk => {
      const { probIdx, impactIdx } = getRiskPosition(risk);
      const level = getRiskLevel(probIdx, impactIdx).toLowerCase();
      if (level === 'low') stats.low++;
      else if (level === 'medium') stats.medium++;
      else if (level === 'high') stats.high++;
      else if (level === 'critical') stats.critical++;
    });
    return stats;
  };

  const stats = getSeverityStats();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-red-600 dark:text-red-400">{stats.critical}</div>
                <div className="text-xs text-muted-foreground">Critical</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{stats.high}</div>
                <div className="text-xs text-muted-foreground">High</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{stats.medium}</div>
                <div className="text-xs text-muted-foreground">Medium</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats.low}</div>
                <div className="text-xs text-muted-foreground">Low</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card className="bg-card/80 border-border h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Risk Assessment Matrix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-muted-foreground font-medium whitespace-nowrap origin-center">
                PROBABILITY
              </div>
              <div className="ml-6">
                <div className="text-center text-[10px] text-muted-foreground font-medium mb-2">IMPACT</div>
                <div className="grid grid-cols-6 gap-0.5">
                  <div></div>
                  {IMPACT_LEVELS.map((level, i) => (
                    <div key={i} className="text-center text-[8px] text-muted-foreground/70 pb-1 truncate">{level}</div>
                  ))}
                  
                  {PROBABILITY_LEVELS.slice().reverse().map((prob, probIdx) => (
                    <>
                      <div key={`prob-${probIdx}`} className="text-[8px] text-muted-foreground/70 flex items-center justify-end pr-1 truncate">{prob}</div>
                      {IMPACT_LEVELS.map((_, impactIdx) => {
                        const risksHere = getRisksAtPosition(probIdx, impactIdx);
                        return (
                          <div 
                            key={`cell-${probIdx}-${impactIdx}`} 
                            className={`aspect-square rounded border ${getMatrixCellColor(4 - probIdx, impactIdx)} flex items-center justify-center relative group cursor-pointer transition-all hover:scale-105`}
                          >
                            {risksHere.length > 0 && (
                              <div className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold flex items-center justify-center shadow-lg">
                                {risksHere.length}
                              </div>
                            )}
                            {risksHere.length > 0 && (
                              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 hidden group-hover:block">
                                <div className="bg-popover border border-border rounded-lg shadow-xl p-2 min-w-[200px]">
                                  {risksHere.slice(0, 3).map((r, i) => {
                                    const u = r as UnifiedRisk;
                                    return (
                                      <div key={i} className="text-xs text-foreground truncate py-0.5">
                                        {u.displayName || r.risk || r.name || r.title || String(r)}
                                      </div>
                                    );
                                  })}
                                  {risksHere.length > 3 && (
                                    <div className="text-[10px] text-muted-foreground mt-1">+{risksHere.length - 3} more</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-3 mt-3 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50"></div>
                    <span className="text-[9px] text-muted-foreground">Low</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500/50"></div>
                    <span className="text-[9px] text-muted-foreground">Medium</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-orange-500/30 border border-orange-500/50"></div>
                    <span className="text-[9px] text-muted-foreground">High</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500/50"></div>
                    <span className="text-[9px] text-muted-foreground">Critical</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 border-border h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Risk Register ({identifiedRisks.length})
              </CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onAddRisk} data-testid="button-add-risk">
                <Plus className="w-3 h-3" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {identifiedRisks.length > 0 ? (
              <div className="space-y-2">
                {identifiedRisks.map((risk, i) => {
                  const { probIdx, impactIdx } = getRiskPosition(risk);
                  const level = getRiskLevel(probIdx, impactIdx);
                  return (
                    <div 
                      key={i} 
                      className="group p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 hover:border-border transition-all cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-1.5 h-full min-h-[40px] rounded-full flex-shrink-0 ${
                          level === 'Critical' ? 'bg-red-500' :
                          level === 'High' ? 'bg-orange-500' :
                          level === 'Medium' ? 'bg-amber-500' :
                          'bg-emerald-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-sm line-clamp-2">
                              {(risk as UnifiedRisk).displayName || risk.risk || risk.name || risk.title || String(risk)}
                            </div>
                            <Badge className={`text-[10px] px-1.5 py-0 h-5 flex-shrink-0 ${getRiskBadgeColor(risk)}`}>
                              {level}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              P: {risk.likelihood || risk.probability || 'Medium'}
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              I: {risk.impact || 'Medium'}
                            </span>
                          </div>
                          {risk.mitigation && (
                            <div className="mt-2 text-[11px] text-muted-foreground bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1.5">
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Mitigation: </span>
                              {risk.mitigation}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground flex-shrink-0 transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Shield className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <p className="text-sm text-muted-foreground">{t('projectWorkspace.riskRegister.noRisks')}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Add risks to begin risk management</p>
                <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={onAddRisk} data-testid="button-add-first-risk">
                  <Plus className="w-3.5 h-3.5" />
                  Add First Risk
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
