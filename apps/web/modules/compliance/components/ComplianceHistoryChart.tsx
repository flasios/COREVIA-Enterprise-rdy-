/**
 * Displays historical compliance scores as an area chart.
 * 
 * @component
 * @param {Array<{date: string, score: number}>} data - Compliance records with ISO 8601 dates and scores (0-100)
 * @param {string} [className] - Additional CSS classes
 * 
 * @requires Dates must be valid ISO 8601 format
 * @requires Scores must be between 0-100
 * @requires Section 508 / WCAG 2.1 AA compliant
 */
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format, isValid, parseISO } from 'date-fns';
import { AlertCircle, TrendingUp } from 'lucide-react';

interface ComplianceHistoryChartProps {
  data: { date: string; score: number }[];
  className?: string;
}

interface ChartDataPoint {
  date: string;
  score: number;
  formattedDate: string;
  timestamp: number;
}

const parseAndValidateDate = (dateStr: string): Date | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  try {
    const dateObj = parseISO(dateStr);
    if (isValid(dateObj)) return dateObj;
    
    const fallbackDate = new Date(dateStr);
    return isValid(fallbackDate) ? fallbackDate : null;
  } catch {
    return null;
  }
};

const formatDateForDisplay = (dateObj: Date): string => {
  const now = new Date();
  const isCurrentYear = dateObj.getFullYear() === now.getFullYear();
  
  return isCurrentYear 
    ? format(dateObj, 'MMM dd, HH:mm')
    : format(dateObj, 'MMM dd yyyy, HH:mm');
};

export function ComplianceHistoryChart({ data, className }: ComplianceHistoryChartProps) {
  const { t } = useTranslation();

  if (!data || !Array.isArray(data)) {
    return (
      <Card className={className} data-testid="card-compliance-history-error" role="region" aria-label={t('compliance.historyChart.ariaLabel')}>
        <CardHeader>
          <CardTitle>{t('compliance.historyChart.title')}</CardTitle>
          <CardDescription>{t('compliance.historyChart.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <AlertCircle className="h-5 w-5 mr-2" aria-hidden="true" />
          <span>{t('compliance.historyChart.invalidData')}</span>
        </CardContent>
      </Card>
    );
  }

  const chartData: ChartDataPoint[] = data
    .filter(item => item && item.date && typeof item.score === 'number' && !Number.isNaN(item.score))
    .map((item) => {
      const dateObj = parseAndValidateDate(item.date);
      
      if (!dateObj) {
        console.warn(`ComplianceHistoryChart: Invalid date skipped: ${item.date}`);
        return null;
      }
      
      return {
        date: item.date,
        score: Math.max(0, Math.min(100, Math.round(item.score))),
        formattedDate: formatDateForDisplay(dateObj),
        timestamp: dateObj.getTime(),
      };
    })
    .filter((item): item is ChartDataPoint => item !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (chartData.length === 0) {
    return (
      <Card className={className} data-testid="card-compliance-history-empty" role="region" aria-label={t('compliance.historyChart.ariaLabel')}>
        <CardHeader>
          <CardTitle>{t('compliance.historyChart.title')}</CardTitle>
          <CardDescription>{t('compliance.historyChart.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <TrendingUp className="h-10 w-10 mb-2 opacity-30" aria-hidden="true" />
          <span>{t('compliance.historyChart.noData')}</span>
        </CardContent>
      </Card>
    );
  }

  const accessibleSummary = chartData.map(d => `${d.formattedDate}: ${d.score}%`).join(', ');
  const dateRange = chartData.length > 1 
    ? `from ${chartData[0]!.formattedDate} to ${chartData[chartData.length - 1]!.formattedDate}`
    : `at ${chartData[0]!.formattedDate}`;

  return (
    <Card 
      className={className} 
      data-testid="card-compliance-history"
      role="region"
      aria-label={t('compliance.historyChart.ariaLabel')}
    >
      <CardHeader>
        <CardTitle id="history-chart-title">{t('compliance.historyChart.title')}</CardTitle>
        <CardDescription>{t('compliance.historyChart.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart 
            data={chartData}
            role="img"
            aria-labelledby="history-chart-title"
            aria-label={`Area chart showing compliance scores ${dateRange}`}
          >
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="formattedDate" 
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              aria-label="Date and time"
            />
            <YAxis 
              domain={[0, 100]}
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              label={{ value: t('compliance.historyChart.scorePercent'), angle: -90, position: 'insideLeft' }}
              aria-label={t('compliance.historyChart.scorePercent')}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
              formatter={(value: number) => [`${value}%`, t('compliance.historyChart.score')]}
              labelFormatter={(label) => `${t('compliance.historyChart.run')}: ${label}`}
            />
            <Area 
              type="monotone" 
              dataKey="score" 
              stroke="#3b82f6" 
              strokeWidth={2}
              fill="url(#scoreGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
        
        <div className="sr-only" role="complementary" aria-label="Chart data summary">
          Compliance history: {accessibleSummary}
        </div>
      </CardContent>
    </Card>
  );
}
