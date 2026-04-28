import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from 'react-i18next';

interface StakeholderDetail {
  name: string;
  role?: string;
  influence?: string;
  interest?: string;
  engagementStrategy?: string;
  department?: string;
}

interface PowerInterestMatrixProps {
  data: {
    manageClosely?: (string | StakeholderDetail)[];
    keepSatisfied?: (string | StakeholderDetail)[];
    keepInformed?: (string | StakeholderDetail)[];
    monitor?: (string | StakeholderDetail)[];
  };
}

function normalizeStakeholder(item: string | StakeholderDetail): StakeholderDetail {
  if (typeof item === 'string') return { name: item };
  return item;
}

const QUADRANT_CONFIG = {
  manageClosely: { dot: 'bg-red-500', bg: 'bg-red-50/80 dark:bg-red-950/20', border: 'border-red-200/60 dark:border-red-800/40' },
  keepSatisfied: { dot: 'bg-amber-500', bg: 'bg-amber-50/80 dark:bg-amber-950/20', border: 'border-amber-200/60 dark:border-amber-800/40' },
  keepInformed: { dot: 'bg-blue-500', bg: 'bg-blue-50/80 dark:bg-blue-950/20', border: 'border-blue-200/60 dark:border-blue-800/40' },
  monitor: { dot: 'bg-slate-400', bg: 'bg-slate-50/80 dark:bg-slate-950/20', border: 'border-slate-200/60 dark:border-slate-800/40' },
} as const;

export default function PowerInterestMatrix({ data }: PowerInterestMatrixProps) {
  const { t } = useTranslation();

  const quadrants = [
    { title: t('visualization.powerInterest.manageClosely'), key: 'manageClosely' as const, strategy: t('visualization.powerInterest.strategyManageClosely') },
    { title: t('visualization.powerInterest.keepSatisfied'), key: 'keepSatisfied' as const, strategy: t('visualization.powerInterest.strategyKeepSatisfied') },
    { title: t('visualization.powerInterest.keepInformed'), key: 'keepInformed' as const, strategy: t('visualization.powerInterest.strategyKeepInformed') },
    { title: t('visualization.powerInterest.monitor'), key: 'monitor' as const, strategy: t('visualization.powerInterest.strategyMonitor') },
  ];

  const totalStakeholders = Object.values(data).reduce(
    (sum, arr) => sum + (arr?.length || 0),
    0
  );

  return (
    <Card data-testid="card-power-interest-matrix" className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{t('visualization.powerInterest.title')}</span>
          <Badge variant="outline" className="text-[10px] font-normal">
            {totalStakeholders} stakeholder{totalStakeholders !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative w-full">
          {/* Axis labels */}
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1 px-1">
            <span>{t('visualization.powerInterest.powerAxis')} ↑</span>
            <span>{t('visualization.powerInterest.interestAxis')} →</span>
          </div>

          {/* 2×2 Grid — full width, compact rows */}
          <div className="grid grid-cols-2 gap-1.5">
            <TooltipProvider delayDuration={200}>
              {quadrants.map((quadrant) => {
                const cfg = QUADRANT_CONFIG[quadrant.key];
                const stakeholders = (data[quadrant.key] || []).map(normalizeStakeholder);

                return (
                  <div
                    key={quadrant.key}
                    className={`${cfg.bg} ${cfg.border} border rounded-md px-2.5 py-2 min-h-[90px]`}
                    data-testid={`quadrant-${quadrant.key}`}
                  >
                    {/* Quadrant header */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className={`h-2 w-2 rounded-full ${cfg.dot} shrink-0`} />
                      <span className="font-semibold text-xs leading-none">{quadrant.title}</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1 ml-auto">{stakeholders.length}</Badge>
                    </div>

                    {/* Stakeholder chips */}
                    {stakeholders.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {stakeholders.map((s, idx) => (
                          <Tooltip key={idx}>
                            <TooltipTrigger asChild>
                              <div
                                className="inline-flex items-center gap-1 bg-background/70 border border-border/40 rounded px-1.5 py-0.5 cursor-default max-w-full"
                                data-testid={`stakeholder-${quadrant.key}-${idx}`}
                              >
                                <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot} shrink-0`} />
                                <span className="text-[11px] font-medium truncate">{s.name}</span>
                                {s.role && (
                                  <span className="text-[9px] text-muted-foreground truncate hidden sm:inline">· {s.role}</span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs space-y-1 p-2">
                              <p className="font-semibold">{s.name}</p>
                              {s.role && <p className="text-muted-foreground">{s.role}</p>}
                              {s.engagementStrategy && (
                                <p className="text-muted-foreground leading-snug">{s.engagementStrategy}</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic">{t('visualization.powerInterest.noStakeholders')}</p>
                    )}
                  </div>
                );
              })}
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
