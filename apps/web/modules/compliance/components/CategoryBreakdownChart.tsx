/**
 * Displays compliance scores across different categories as a bar chart.
 * 
 * @component
 * @param {Object} props
 * @param {Array<{category: ComplianceCategory, score: number}>} props.data - Compliance data (scores 0-100)
 * @param {string} [props.className] - Additional CSS classes
 * 
 * @requires Section 508 / WCAG 2.1 AA compliant
 * @requires Data validation on all inputs
 */
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertCircle } from 'lucide-react';

export type ComplianceCategory = 'financial' | 'strategic' | 'security' | 'technical' | 'legal';

interface CategoryBreakdownChartProps {
  data: { category: ComplianceCategory | string; score: number }[];
  className?: string;
}

const CATEGORY_COLORS: Record<ComplianceCategory, string> = {
  financial: '#10b981',
  strategic: '#3b82f6',
  security: '#ef4444',
  technical: '#f59e0b',
  legal: '#8b5cf6',
};

const CATEGORY_LABELS: Record<ComplianceCategory, string> = {
  financial: 'Financial',
  strategic: 'Strategic',
  security: 'Security',
  technical: 'Technical',
  legal: 'Legal',
};

const DEFAULT_COLOR = '#6b7280';

const sanitizeCategory = (cat: string): string => {
  if (typeof cat !== 'string') return 'Unknown';
  return cat.replace(/[<>"'&]/g, '').substring(0, 50);
};

const isValidCategory = (cat: string): cat is ComplianceCategory => {
  return cat in CATEGORY_LABELS;
};

export function CategoryBreakdownChart({ data, className }: CategoryBreakdownChartProps) {
  const { t } = useTranslation();

  if (!data || !Array.isArray(data)) {
    return (
      <Card className={className} data-testid="card-category-breakdown-error" role="region" aria-label={t('compliance.categoryChart.ariaLabel')}>
        <CardHeader>
          <CardTitle>{t('compliance.categoryChart.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <AlertCircle className="h-5 w-5 mr-2" aria-hidden="true" />
          <span>{t('compliance.categoryChart.invalidData')}</span>
        </CardContent>
      </Card>
    );
  }

  const chartData = data
    .filter(item => item && typeof item.score === 'number' && !Number.isNaN(item.score))
    .map((item) => {
      const categoryKey = item.category;
      const isKnown = isValidCategory(categoryKey);
      
      return {
        category: isKnown ? CATEGORY_LABELS[categoryKey] : sanitizeCategory(categoryKey),
        score: Math.max(0, Math.min(100, Math.round(item.score))),
        fill: isKnown ? CATEGORY_COLORS[categoryKey] : DEFAULT_COLOR,
      };
    });

  if (chartData.length === 0) {
    return (
      <Card className={className} data-testid="card-category-breakdown-empty" role="region" aria-label={t('compliance.categoryChart.ariaLabel')}>
        <CardHeader>
          <CardTitle>{t('compliance.categoryChart.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <AlertCircle className="h-5 w-5 mr-2" aria-hidden="true" />
          <span>{t('compliance.categoryChart.noData')}</span>
        </CardContent>
      </Card>
    );
  }

  const accessibleSummary = chartData.map(d => `${d.category}: ${d.score}%`).join(', ');

  return (
    <Card 
      className={className} 
      data-testid="card-category-breakdown" 
      role="region" 
      aria-label={t('compliance.categoryChart.ariaLabel')}
    >
      <CardHeader>
        <CardTitle id="category-chart-title">{t('compliance.categoryChart.title')}</CardTitle>
        <CardDescription>{t('compliance.categoryChart.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart 
            data={chartData}
            role="img"
            aria-labelledby="category-chart-title"
            aria-label={`Bar chart showing compliance scores: ${accessibleSummary}`}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="category" 
              className="text-xs" 
              tick={{ fill: 'currentColor' }}
              aria-label="Categories"
            />
            <YAxis 
              domain={[0, 100]}
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              label={{ value: t('compliance.categoryChart.scorePercent'), angle: -90, position: 'insideLeft' }}
              aria-label={t('compliance.categoryChart.scorePercent')}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
              formatter={(value: number) => [`${value}%`, t('compliance.categoryChart.score')]}
            />
            <Bar dataKey="score" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        
        <div className="sr-only" role="complementary" aria-label="Chart data summary">
          Compliance scores: {accessibleSummary}
        </div>
      </CardContent>
    </Card>
  );
}
