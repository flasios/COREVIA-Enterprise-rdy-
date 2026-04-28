import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  DollarSign, TrendingUp, Clock, BarChart3 as _BarChart3, 
  PieChart, AlertTriangle, Info, ArrowUp, ArrowDown
} from 'lucide-react';

interface FinancialData {
  totalCostEstimate?: number;
  totalBenefitEstimate?: number;
  lifecycleCostEstimate?: number;
  lifecycleBenefitEstimate?: number;
  roi?: number;
  paybackPeriod?: number;
  npv?: number;
  irr?: number;
  riskScore?: number;
  tcoBreakdown?: {
    implementation?: string;
    operational?: string;
    maintenance?: string;
  };
}

interface FinancialSectionProps {
  data: FinancialData;
  isEditMode: boolean;
  onChange: (field: keyof FinancialData, value: unknown) => void;
  validationErrors?: Record<string, string>;
  currency?: string;
}

function formatCurrency(value: number | undefined, currency = 'AED'): string {
  if (value === undefined || value === null) return '-';
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | undefined): string {
  if (value === undefined || value === null) return '-';
  return `${value.toFixed(1)}%`;
}

function getRoiIndicator(roi: number | undefined): { className: string; label: string } {
  if (roi === undefined) return { className: 'text-muted-foreground', label: '' };
  if (roi >= 50) return { className: '', label: 'Excellent' };
  if (roi >= 20) return { className: '', label: 'Good' };
  if (roi >= 0) return { className: '', label: 'Moderate' };
  return { className: '', label: 'Negative' };
}

function getRiskIndicator(score: number | undefined): { label: string } {
  if (score === undefined) return { label: '' };
  if (score <= 30) return { label: 'Low' };
  if (score <= 50) return { label: 'Medium' };
  if (score <= 70) return { label: 'High' };
  return { label: 'Critical' };
}

export function FinancialSection({
  data,
  isEditMode,
  onChange,
  validationErrors = {},
  currency = 'AED',
}: FinancialSectionProps) {
  const costBreakdownData = useMemo(() => {
    if (!data.tcoBreakdown) return [];
    return [
      { name: 'Implementation', value: parseFloat(data.tcoBreakdown.implementation || '0') },
      { name: 'Operational', value: parseFloat(data.tcoBreakdown.operational || '0') },
      { name: 'Maintenance', value: parseFloat(data.tcoBreakdown.maintenance || '0') },
    ].filter(item => item.value > 0);
  }, [data.tcoBreakdown]);

  const totalTCO = useMemo(() => {
    return costBreakdownData.reduce((sum, item) => sum + item.value, 0);
  }, [costBreakdownData]);

  const netBenefit = useMemo(() => {
    const benefitValue = data.lifecycleBenefitEstimate ?? data.totalBenefitEstimate;
    const costValue = data.lifecycleCostEstimate ?? data.totalCostEstimate;
    if (benefitValue !== undefined && costValue !== undefined) {
      return benefitValue - costValue;
    }
    return undefined;
  }, [data.lifecycleBenefitEstimate, data.lifecycleCostEstimate, data.totalBenefitEstimate, data.totalCostEstimate]);

  return (
    <section aria-labelledby="financial-section-title">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle id="financial-section-title" className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" aria-hidden="true" />
            Financial Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label htmlFor="total-cost" className="text-xs text-muted-foreground flex items-center gap-1">
                Upfront Investment
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3" aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>Approved upfront capital investment envelope</TooltipContent>
                </Tooltip>
              </Label>
              {isEditMode ? (
                <div>
                  <Input
                    id="total-cost"
                    type="number"
                    value={data.totalCostEstimate || ''}
                    onChange={(e) => onChange('totalCostEstimate', parseFloat(e.target.value) || 0)}
                    aria-invalid={!!validationErrors.totalCostEstimate}
                    aria-describedby={validationErrors.totalCostEstimate ? 'total-cost-error' : undefined}
                  />
                  {validationErrors.totalCostEstimate && (
                    <p id="total-cost-error" className="text-xs text-destructive mt-1">
                      {validationErrors.totalCostEstimate}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-lg font-semibold">{formatCurrency(data.totalCostEstimate, currency)}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="total-benefit" className="text-xs text-muted-foreground flex items-center gap-1">
                5-Year Modeled Benefit
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3" aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>Total modeled benefits across the operating horizon</TooltipContent>
                </Tooltip>
              </Label>
              {isEditMode ? (
                <div>
                  <Input
                    id="total-benefit"
                    type="number"
                    value={data.totalBenefitEstimate || ''}
                    onChange={(e) => onChange('totalBenefitEstimate', parseFloat(e.target.value) || 0)}
                    aria-invalid={!!validationErrors.totalBenefitEstimate}
                    aria-describedby={validationErrors.totalBenefitEstimate ? 'total-benefit-error' : undefined}
                  />
                  {validationErrors.totalBenefitEstimate && (
                    <p id="total-benefit-error" className="text-xs text-destructive mt-1">
                      {validationErrors.totalBenefitEstimate}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-lg font-semibold">{formatCurrency(data.totalBenefitEstimate, currency)}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                ROI
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3" aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>Return on Investment percentage</TooltipContent>
                </Tooltip>
              </Label>
              <div className="text-lg font-semibold flex items-center gap-1">
                {data.roi !== undefined && (
                  data.roi >= 0 
                    ? <TrendingUp className="h-4 w-4" aria-hidden="true" />
                    : <ArrowDown className="h-4 w-4" aria-hidden="true" />
                )}
                {formatPercent(data.roi)}
                {getRoiIndicator(data.roi).label && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {getRoiIndicator(data.roi).label}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                Payback Period
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3" aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>Time to recover initial investment</TooltipContent>
                </Tooltip>
              </Label>
              <p className="text-lg font-semibold flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {data.paybackPeriod !== undefined ? `${data.paybackPeriod.toFixed(1)} years` : '-'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                NPV
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3" aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>Net Present Value at 10% discount rate</TooltipContent>
                </Tooltip>
              </Label>
              <div className="flex items-center gap-1">
                <p className="text-lg font-semibold">
                  {formatCurrency(data.npv, currency)}
                </p>
                {data.npv !== undefined && (
                  <Badge variant={data.npv >= 0 ? 'default' : 'destructive'} className="text-xs">
                    {data.npv >= 0 ? 'Positive' : 'Negative'}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                IRR
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3" aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>Internal Rate of Return</TooltipContent>
                </Tooltip>
              </Label>
              <p className="text-lg font-semibold">{formatPercent(data.irr)}</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                Net Benefit
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3" aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>Total Benefit minus Total Cost</TooltipContent>
                </Tooltip>
              </Label>
              <div className="text-lg font-semibold flex items-center gap-1">
                {netBenefit !== undefined && (
                  netBenefit >= 0 
                    ? <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    : <ArrowDown className="h-4 w-4" aria-hidden="true" />
                )}
                {formatCurrency(netBenefit, currency)}
                {netBenefit !== undefined && (
                  <Badge variant={netBenefit >= 0 ? 'default' : 'destructive'} className="text-xs ml-1">
                    {netBenefit >= 0 ? 'Gain' : 'Loss'}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                Risk Score
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3" aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>Overall project risk (0-100, lower is better)</TooltipContent>
                </Tooltip>
              </Label>
              <div className="text-lg font-semibold flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                {data.riskScore !== undefined ? `${data.riskScore}` : '-'}
                {data.riskScore !== undefined && (
                  <Badge 
                    variant={data.riskScore <= 50 ? 'secondary' : 'destructive'} 
                    className="ml-1 text-xs"
                  >
                    {getRiskIndicator(data.riskScore).label}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {costBreakdownData.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <PieChart className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Total Cost of Ownership Breakdown
              </h4>
              <div className="grid grid-cols-3 gap-4">
                {costBreakdownData.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{item.name}</Label>
                    <p className="text-sm font-medium">{formatCurrency(item.value, currency)}</p>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${totalTCO > 0 ? (item.value / totalTCO) * 100 : 0}%` }}
                        role="progressbar"
                        aria-valuenow={item.value}
                        aria-valuemax={totalTCO}
                        aria-label={`${item.name}: ${((item.value / totalTCO) * 100).toFixed(0)}%`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
