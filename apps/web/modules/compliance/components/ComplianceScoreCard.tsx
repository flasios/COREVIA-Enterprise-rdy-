/**
 * Displays a compliance/risk score with optional trend indicator.
 * 
 * @component
 * @param {number} score - Score value between 0-100
 * @param {string} label - Display label for the metric
 * @param {number} [trend] - Percentage point change from previous period
 * @param {boolean} [invertTrend] - If true, downward trends are positive (for risk/incident metrics)
 * @param {boolean} [showPercentage] - Whether to show percentage symbol (default: true if label contains 'Score')
 * @param {Object} [thresholds] - Custom thresholds for color coding
 * @param {string} [className] - Additional CSS classes
 * 
 * @requires Section 508 / WCAG 2.1 AA compliant
 */
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface ScoreThresholds {
  high: number;
  medium: number;
}

interface ComplianceScoreCardProps {
  score: number;
  label: string;
  trend?: number;
  className?: string;
  invertTrend?: boolean;
  showPercentage?: boolean;
  thresholds?: ScoreThresholds;
}

const DEFAULT_THRESHOLDS: ScoreThresholds = {
  high: 80,
  medium: 60,
};

const sanitizeForTestId = (str: string): string => {
  if (!str || typeof str !== 'string') return 'unknown';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
};

const getScoreColor = (value: number, thresholds: ScoreThresholds): string => {
  if (value >= thresholds.high) return 'text-green-600 dark:text-green-400';
  if (value >= thresholds.medium) return 'text-amber-700 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
};

const getScoreBgColor = (value: number, thresholds: ScoreThresholds): string => {
  if (value >= thresholds.high) return 'bg-green-50 dark:bg-green-950/30';
  if (value >= thresholds.medium) return 'bg-amber-50 dark:bg-amber-950/30';
  return 'bg-red-50 dark:bg-red-950/30';
};

export function ComplianceScoreCard({ 
  score, 
  label, 
  trend, 
  className,
  invertTrend = false,
  showPercentage,
  thresholds = DEFAULT_THRESHOLDS,
}: ComplianceScoreCardProps) {
  const { t } = useTranslation();

  if (typeof score !== 'number' || Number.isNaN(score)) {
    return (
      <Card className={className} data-testid="card-score-error" role="region" aria-label="Score display error">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label || t('compliance.scoreCard.score')}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm">{t('compliance.scoreCard.invalidData')}</span>
        </CardContent>
      </Card>
    );
  }

  if (!label || typeof label !== 'string') {
    return null;
  }

  const validScore = Math.max(0, Math.min(100, Math.round(score)));
  const displayPercentage = showPercentage ?? label.includes('Score');
  const trendIsPositive = invertTrend ? (trend ?? 0) < 0 : (trend ?? 0) > 0;
  const testId = sanitizeForTestId(label);
  
  const scoreAriaLabel = `${label}: ${validScore}${displayPercentage ? ' percent' : ''}`;
  const trendAriaLabel = trend !== undefined && trend !== 0
    ? `Trend: ${trendIsPositive ? 'improved' : 'declined'} by ${Math.abs(trend)} percentage points`
    : undefined;

  return (
    <Card 
      className={className} 
      data-testid={`card-score-${testId}`}
      role="region"
      aria-label={scoreAriaLabel}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 ${getScoreBgColor(validScore, thresholds)} px-3 py-2 rounded-md`}>
            <span 
              className={`text-3xl font-bold ${getScoreColor(validScore, thresholds)}`} 
              data-testid="text-score-value"
              aria-label={scoreAriaLabel}
            >
              {validScore}
            </span>
            {displayPercentage && (
              <span 
                className={`text-lg ${getScoreColor(validScore, thresholds)}`}
                aria-hidden="true"
              >
                %
              </span>
            )}
          </div>
          
          {trend !== undefined && trend !== 0 && (
            <div 
              className="flex items-center gap-1"
              role="status"
              aria-label={trendAriaLabel}
            >
              {trendIsPositive ? (
                <TrendingUp 
                  className="h-4 w-4 text-green-600 dark:text-green-400" 
                  data-testid="icon-trend-up"
                  aria-hidden="true"
                />
              ) : (
                <TrendingDown 
                  className="h-4 w-4 text-red-600 dark:text-red-400" 
                  data-testid="icon-trend-down"
                  aria-hidden="true"
                />
              )}
              <span className={`text-sm font-medium ${trendIsPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {trend > 0 ? '+' : ''}{trend}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
