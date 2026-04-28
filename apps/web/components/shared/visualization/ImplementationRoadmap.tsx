import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { useTranslation } from 'react-i18next';

interface Initiative {
  action: string;
  timeline: string;
  effort?: string;
  impact?: string;
  owner?: string;
  dependencies?: string;
  expectedBenefit?: string;
}

interface ImplementationRoadmapProps {
  quickWins?: Initiative[];
  strategicInitiatives?: Initiative[];
}

export default function ImplementationRoadmap({ quickWins = [], strategicInitiatives = [] }: ImplementationRoadmapProps) {
  const { t } = useTranslation();

  const getImpactColor = (impact: string = '') => {
    const i = impact.toLowerCase();
    if (i.includes('high')) return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-200 dark:border-green-800';
    if (i.includes('medium')) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-300 border-gray-200 dark:border-gray-800';
  };

  const getEffortColor = (effort: string = '') => {
    const e = effort.toLowerCase();
    if (e.includes('high')) return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800';
    if (e.includes('medium')) return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 border-orange-200 dark:border-orange-800';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800';
  };

  return (
    <Card data-testid="card-implementation-roadmap">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{t('visualization.roadmap.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Quick Wins - Compact Grid */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <h3 className="font-semibold text-sm">{t('visualization.roadmap.quickWins')}</h3>
            <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/20">
              {quickWins.length}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
            {quickWins.map((item, idx) => (
              <div
                key={idx}
                className="border rounded-md p-2.5 bg-green-50/50 dark:bg-green-950/10 hover-elevate"
                data-testid={`quick-win-${idx}`}
              >
                <div className="font-medium text-xs mb-1.5 line-clamp-2">{item.action}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
                  <ChevronRight className="w-3 h-3" />
                  <span>{item.timeline}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getImpactColor(item.impact)}`}>
                    {item.impact || 'High'}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getEffortColor(item.effort)}`}>
                    {item.effort || 'Low'}
                  </Badge>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1.5 truncate">
                  {item.owner}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strategic Initiatives - Compact Grid */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Circle className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-sm">{t('visualization.roadmap.strategicInitiatives')}</h3>
            <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/20">
              {strategicInitiatives.length}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
            {strategicInitiatives.map((item, idx) => (
              <div
                key={idx}
                className="border rounded-md p-2.5 bg-blue-50/50 dark:bg-blue-950/10 hover-elevate"
                data-testid={`strategic-initiative-${idx}`}
              >
                <div className="font-medium text-xs mb-1.5 line-clamp-2">{item.action}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
                  <ChevronRight className="w-3 h-3" />
                  <span>{item.timeline}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getImpactColor(item.impact)}`}>
                    {item.impact || 'High'}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getEffortColor(item.effort)}`}>
                    {item.effort || 'High'}
                  </Badge>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1.5 truncate">
                  {item.owner}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compact Timeline Bar */}
        <div className="border-t pt-3">
          <div className="flex gap-0.5 h-6">
            <div className="flex-1 bg-green-200 dark:bg-green-900/50 rounded-l flex items-center justify-center text-[10px] font-medium">
              Q1
            </div>
            <div className="flex-1 bg-blue-200 dark:bg-blue-900/50 flex items-center justify-center text-[10px] font-medium">
              Q2
            </div>
            <div className="flex-1 bg-blue-200 dark:bg-blue-900/50 flex items-center justify-center text-[10px] font-medium">
              Q3
            </div>
            <div className="flex-1 bg-blue-200 dark:bg-blue-900/50 rounded-r flex items-center justify-center text-[10px] font-medium">
              Q4
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
