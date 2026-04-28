import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { DollarSign, Clock, TrendingUp } from "lucide-react";
import { useTranslation } from 'react-i18next';

interface ROIMetrics {
  timeSaved: number;
  costAvoidance: number;
  productivityGain: number;
  generationsCount: number;
  timePerGeneration: number;
  hourlyRate: number;
}

interface ROIEstimatorProps {
  initialMetrics: ROIMetrics;
}

export function ROIEstimator({ initialMetrics }: ROIEstimatorProps) {
  const { t } = useTranslation();
  const [hourlyRate, setHourlyRate] = useState(initialMetrics.hourlyRate);
  const [timePerGeneration, setTimePerGeneration] = useState(initialMetrics.timePerGeneration);

  // Calculate derived metrics
  const timeSavedHours = (initialMetrics.generationsCount * timePerGeneration) / 60;
  const costAvoidance = timeSavedHours * hourlyRate;
  const monthlyWorkHours = 8 * 20; // 8 hours/day, 20 workdays/month
  const productivityGain = (timeSavedHours / monthlyWorkHours) * 100;

  return (
    <div className="space-y-6" data-testid="roi-estimator">
      {/* Calculated Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">{t('analytics.roiEstimator.timeSaved')}</p>
            </div>
            <p className="text-2xl font-bold" data-testid="time-saved-value">
              {t('analytics.roiEstimator.hoursValue', { hours: timeSavedHours.toFixed(1) })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('analytics.roiEstimator.basedOnGenerations', { count: initialMetrics.generationsCount })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">{t('analytics.roiEstimator.costAvoidance')}</p>
            </div>
            <p className="text-2xl font-bold" data-testid="cost-avoidance-value">
              {t('analytics.roiEstimator.currencyValue', { amount: costAvoidance.toLocaleString('en-US', { maximumFractionDigits: 0 }) })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('analytics.roiEstimator.atRate', { rate: hourlyRate })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">{t('analytics.roiEstimator.productivityGain')}</p>
            </div>
            <p className="text-2xl font-bold" data-testid="productivity-gain-value">
              {productivityGain.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('analytics.roiEstimator.ofMonthlyHours')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Controls */}
      <div className="space-y-6 pt-4 border-t">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="hourly-rate">{t('analytics.roiEstimator.hourlyRateLabel')}</Label>
            <span className="text-sm font-medium">${hourlyRate}</span>
          </div>
          <Slider
            id="hourly-rate"
            data-testid="slider-hourly-rate"
            min={20}
            max={200}
            step={5}
            value={[hourlyRate]}
            onValueChange={(value) => setHourlyRate(value[0]!)}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            {t('analytics.roiEstimator.adjustHourlyRate')}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="time-per-gen">{t('analytics.roiEstimator.timePerGenerationLabel')}</Label>
            <span className="text-sm font-medium">{timePerGeneration} {t('analytics.roiEstimator.min')}</span>
          </div>
          <Slider
            id="time-per-gen"
            data-testid="slider-time-per-generation"
            min={5}
            max={60}
            step={5}
            value={[timePerGeneration]}
            onValueChange={(value) => setTimePerGeneration(value[0]!)}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            {t('analytics.roiEstimator.estimatedTimeSaved')}
          </p>
        </div>
      </div>

      {/* Assumptions */}
      <div className="pt-4 border-t">
        <p className="text-xs font-medium text-muted-foreground mb-2">{t('analytics.roiEstimator.assumptions')}:</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>{t('analytics.roiEstimator.assumptionAvgTime', { minutes: timePerGeneration })}</li>
          <li>{t('analytics.roiEstimator.assumptionLaborCost', { rate: hourlyRate })}</li>
          <li>{t('analytics.roiEstimator.assumptionGenerations', { count: initialMetrics.generationsCount })}</li>
          <li>{t('analytics.roiEstimator.assumptionWorkMonth')}</li>
        </ul>
      </div>
    </div>
  );
}
