import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { InfoIcon, TrendingUp, Database, Target } from 'lucide-react';
import type { AIConfidence } from '@shared/aiAdapters';

interface AIConfidenceBadgeProps {
  confidence?: AIConfidence;
  className?: string;
}

export function AIConfidenceBadge({ confidence, className }: AIConfidenceBadgeProps) {
  const { t } = useTranslation();

  if (!confidence) {
    return null;
  }

  const { tier, percentage, breakdown } = confidence;

  const tierConfig = {
    high: {
      label: t('ai.confidence.highLabel'),
      color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700',
      description: t('ai.confidence.highDescription')
    },
    medium: {
      label: t('ai.confidence.mediumLabel'),
      color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
      description: t('ai.confidence.mediumDescription')
    },
    low: {
      label: t('ai.confidence.lowLabel'),
      color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700',
      description: t('ai.confidence.lowDescription')
    }
  };

  const config = tierConfig[tier];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge 
          variant="outline" 
          className={`${config.color} ${className || ''} gap-1 cursor-pointer hover-elevate`}
          data-testid={`badge-confidence-${tier}`}
        >
          <InfoIcon className="h-3 w-3" />
          {config.label}: {percentage}%
        </Badge>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80"
        data-testid="popover-confidence-breakdown"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-2">{t('ai.confidence.analysisTitle')}</h4>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </div>

          {breakdown && (
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3 w-3" />
                    <span>{t('ai.confidence.maxRelevance')}</span>
                  </div>
                  <span className="font-medium">{(breakdown.maxScore * 100).toFixed(1)}%</span>
                </div>
                <Progress value={breakdown.maxScore * 100} className="h-1.5" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Target className="h-3 w-3" />
                    <span>{t('ai.confidence.averageRelevance')}</span>
                  </div>
                  <span className="font-medium">{(breakdown.meanScore * 100).toFixed(1)}%</span>
                </div>
                <Progress value={breakdown.meanScore * 100} className="h-1.5" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Database className="h-3 w-3" />
                    <span>{t('ai.confidence.uniqueDocuments')}</span>
                  </div>
                  <span className="font-medium">{breakdown.uniqueDocumentCount}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <InfoIcon className="h-3 w-3" />
                    <span>{t('ai.confidence.coverageScore')}</span>
                  </div>
                  <span className="font-medium">{(breakdown.coverageScore * 100).toFixed(1)}%</span>
                </div>
                <Progress value={breakdown.coverageScore * 100} className="h-1.5" />
              </div>

              {breakdown.variance !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>{t('ai.confidence.scoreVariance')}</span>
                    <span className="font-medium">{breakdown.variance.toFixed(3)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              {t('ai.confidence.overallScore')}: <span className="font-medium text-foreground">{(confidence.score * 100).toFixed(1)}%</span>
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
