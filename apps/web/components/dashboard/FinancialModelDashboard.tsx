import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart as _BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area as _Area,
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Clock as _Clock, 
  FileSpreadsheet,
  FileText,
  Settings2 as _Settings2,
  Info,
  ShieldCheck,
  Building2,
  Pencil,
  Check,
  X,
  Edit
} from "lucide-react";

interface FinancialAnalysis {
  totalCost?: number | string;
  totalBenefit?: number | string;
  roi?: number | string;
  paybackMonths?: number | string;
  discountRate?: number | string;
  annualBenefit?: number | string;
  cashFlows?: (number | string)[];
  tcoBreakdown?: {
    implementation?: number | string;
    operations?: number | string;
    maintenance?: number | string;
  };
}

interface NPVCalculation {
  cashFlows?: (number | string)[];
}

interface RevenueModelItem {
  assumption: string;
  category: string;
  value: string | number;
}

interface RevenueModel {
  pricing?: RevenueModelItem[];
  volume?: RevenueModelItem[];
  costs?: RevenueModelItem[];
  projectArchetype?: string;
}

interface ROICalculation {
  keyAssumptions?: RevenueModel;
  marketContext?: string;
  projectArchetype?: string;
}

interface BusinessCase {
  totalCostEstimate?: number | string;
  totalBenefitEstimate?: number | string;
  lifecycleCostEstimate?: number | string;
  lifecycleBenefitEstimate?: number | string;
  roiPercentage?: number | string;
  paybackMonths?: number | string;
  discountRate?: number | string;
  financialAnalysis?: FinancialAnalysis;
  npvCalculation?: NPVCalculation;
  roiCalculation?: ROICalculation;
  computedFinancialModel?: {
    inputs?: {
      totalInvestment?: number | string;
    };
    metrics?: {
      totalCosts?: number | string;
      totalBenefits?: number | string;
      paybackMonths?: number | string;
    };
  };
}

interface FinancialModelDashboardProps {
  businessCase: BusinessCase;
  onEditCashFlow?: () => void;
}

type ScenarioType = 'base' | 'optimistic' | 'conservative';

interface ScenarioConfig {
  revenueGrowth: number;
  costReduction: number;
  discountRate: number;
  implementationBuffer: number;
  benefitRealization: number;
}

const SCENARIO_CONFIGS: Record<ScenarioType, ScenarioConfig> = {
  base: {
    revenueGrowth: 0.10,
    costReduction: 0.03,
    discountRate: 10,
    implementationBuffer: 0,
    benefitRealization: 1.0,
  },
  optimistic: {
    revenueGrowth: 0.15,
    costReduction: 0.05,
    discountRate: 8,
    implementationBuffer: -0.10,
    benefitRealization: 1.15,
  },
  conservative: {
    revenueGrowth: 0.05,
    costReduction: 0.01,
    discountRate: 12,
    implementationBuffer: 0.20,
    benefitRealization: 0.85,
  },
};

interface EditableAssumptions {
  inflationRate: number;
  wageEscalation: number;
  techDeflation: number;
  revenueGrowth: number;
  costReduction: number;
  costBuffer: number;
  scheduleContingency: number;
}

export default function FinancialModelDashboard({ businessCase, onEditCashFlow }: FinancialModelDashboardProps) {
  const { t } = useTranslation();
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>('base');
  const [forecastYears, setForecastYears] = useState('5');
  const [isEditingAssumptions, setIsEditingAssumptions] = useState(false);
  const [isEditingRevenueModel, setIsEditingRevenueModel] = useState(false);
  const [editedRevenueModel, setEditedRevenueModel] = useState<RevenueModel | null>(null);
  const [customAssumptions, setCustomAssumptions] = useState<EditableAssumptions>({
    inflationRate: 2.5,
    wageEscalation: 3.0,
    techDeflation: -5.0,
    revenueGrowth: 10,
    costReduction: 3,
    costBuffer: 0,
    scheduleContingency: 10,
  });
  
  const scenarioConfig = SCENARIO_CONFIGS[selectedScenario];
  
  const financialAnalysis = businessCase.financialAnalysis || {};
  const npvCalculation = businessCase.npvCalculation || {};
  
  const upfrontInvestment = parseFloat(String(businessCase.computedFinancialModel?.inputs?.totalInvestment || businessCase.totalCostEstimate || financialAnalysis.totalCost || '0'));
  const baseTotalCost = parseFloat(String(businessCase.lifecycleCostEstimate || businessCase.computedFinancialModel?.metrics?.totalCosts || financialAnalysis.totalCost || businessCase.totalCostEstimate || '0'));
  const baseTotalBenefit = parseFloat(String(businessCase.lifecycleBenefitEstimate || businessCase.computedFinancialModel?.metrics?.totalBenefits || businessCase.totalBenefitEstimate || financialAnalysis.totalBenefit || '0'));
  const _baseRoi = parseFloat(String(businessCase.roiPercentage || financialAnalysis.roi || '0'));
  const basePaybackMonths = parseFloat(String(businessCase.paybackMonths || businessCase.computedFinancialModel?.metrics?.paybackMonths || financialAnalysis.paybackMonths || '0'));
  const _baseDiscountRate = parseFloat(String(businessCase.discountRate || financialAnalysis.discountRate || '10'));
  const baseAnnualBenefit = parseFloat(String(financialAnalysis.annualBenefit || 0));
  
  const discountRate = scenarioConfig.discountRate;
  
  const savedCashFlows: number[] = (npvCalculation.cashFlows || financialAnalysis.cashFlows || [])
    .map((v: number | string) => parseFloat(String(v)) || 0);
  const hasSavedCashFlows = savedCashFlows.length > 0 && savedCashFlows.some(v => v !== 0);
  
  const tcoBreakdown = financialAnalysis.tcoBreakdown || {};
  const hasCustomTco = !!(tcoBreakdown.implementation || tcoBreakdown.operations || tcoBreakdown.maintenance);
  
  const baseImplCost = (tcoBreakdown.implementation ? parseFloat(String(tcoBreakdown.implementation)) : 0) || baseTotalCost * 0.55;
  const baseOpsCost = (tcoBreakdown.operations ? parseFloat(String(tcoBreakdown.operations)) : 0) || baseTotalCost * 0.30;
  const baseMaintCost = (tcoBreakdown.maintenance ? parseFloat(String(tcoBreakdown.maintenance)) : 0) || baseTotalCost * 0.15;
  
  const implCost = baseImplCost * (1 + scenarioConfig.implementationBuffer);
  const opsCost = baseOpsCost;
  const maintCost = baseMaintCost;
  
  const totalCost = implCost + opsCost + maintCost;
  const totalBenefit = baseTotalBenefit * scenarioConfig.benefitRealization;
  const annualBenefit = baseAnnualBenefit * scenarioConfig.benefitRealization;
  
  const roi = totalCost > 0 ? ((totalBenefit - totalCost) / totalCost) * 100 : 0;
  const paybackMonths = Number.isFinite(basePaybackMonths) && basePaybackMonths > 0
    ? basePaybackMonths * (selectedScenario === 'optimistic' ? 0.85 : selectedScenario === 'conservative' ? 1.20 : 1)
    : Number.POSITIVE_INFINITY;

  const years = parseInt(forecastYears);
  
  const yearlyData = Array.from({ length: years }, (_, i) => {
    const year = i + 1;
    
    const savedCashFlow = hasSavedCashFlows && i < savedCashFlows.length ? savedCashFlows[i]! : null;
    
    const yearlyBenefit = annualBenefit > 0 ? annualBenefit : (totalBenefit / years);
    const growthFactor = 1 + (year * scenarioConfig.revenueGrowth);
    const revenue = Math.round(yearlyBenefit * growthFactor);
    
    const yearlyCosts = Math.round(totalCost * (1 - year * scenarioConfig.costReduction) / years);
    const capex = year === 1 ? Math.round(implCost * 0.7) : Math.round(implCost * 0.075);
    const opex = Math.round((opsCost + maintCost) / years);
    
    const ebitda = revenue - yearlyCosts;
    const netProfit = ebitda - capex - opex;
    
    const cashInflow = savedCashFlow !== null ? savedCashFlow : (i === 0 ? -totalCost : netProfit);
    
    const gmv = Math.round(revenue * 1.25);
    const grossProfit = revenue - yearlyCosts;
    const grossMarginPct = revenue > 0 ? ((grossProfit / revenue) * 100) : 0;
    const netMarginPct = revenue > 0 ? ((netProfit / revenue) * 100) : 0;
    
    const cumulativeNetProfit = netProfit * year;
    const yearlyRoi = totalCost > 0 ? ((cumulativeNetProfit / totalCost) * 100) : 0;
    
    return {
      year: t('dashboard.financial.yearN', { n: year }),
      yearNum: year,
      gmv,
      revenue,
      grossProfit,
      costs: yearlyCosts,
      ebitda,
      netProfit,
      capex,
      opex,
      cashInflow,
      cumulativeCash: 0,
      roi: yearlyRoi,
      grossMargin: grossMarginPct,
      operatingMargin: revenue > 0 ? ((ebitda / revenue) * 100) : 0,
      netMargin: netMarginPct,
    };
  });

  yearlyData.forEach((data, i) => {
    data.cumulativeCash = i === 0 ? data.cashInflow : yearlyData[i - 1]!.cumulativeCash + data.cashInflow;
  });

  const costBreakdown = [
    { name: t('dashboard.financial.implementation'), value: implCost, color: '#3b82f6' },
    { name: t('dashboard.financial.operations'), value: opsCost, color: '#f97316' },
    { name: t('dashboard.financial.maintenance'), value: maintCost, color: '#60a5fa' },
  ];

  const _kpiData = [
    { name: t('dashboard.financial.roi'), value: yearlyData[years - 1]?.roi || roi },
    { name: t('dashboard.financial.grossMargin'), value: yearlyData[years - 1]?.grossMargin || 0 },
    { name: t('dashboard.financial.operatingMargin'), value: yearlyData[years - 1]?.operatingMargin || 0 },
    { name: t('dashboard.financial.netMargin'), value: yearlyData[years - 1]?.netMargin || 0 },
  ];

  const calculateNPV = (rate: number = discountRate) => {
    let npv = 0;
    for (let i = 0; i < years; i++) {
      const cashFlow = yearlyData[i]?.cashInflow || 0;
      npv += cashFlow / Math.pow(1 + rate / 100, i);
    }
    return npv;
  };

  const calculateIRR = () => {
    const cashFlows = yearlyData.map(d => d.cashInflow);
    
    if (cashFlows.length === 0) return 0;
    
    const hasPositive = cashFlows.some(cf => cf > 0);
    const hasNegative = cashFlows.some(cf => cf < 0);
    if (!hasPositive || !hasNegative) return 0;
    
    let guess = 10;
    const maxIterations = 100;
    const tolerance = 0.0001;
    
    for (let iter = 0; iter < maxIterations; iter++) {
      let npv = 0;
      let npvDerivative = 0;
      
      for (let i = 0; i < cashFlows.length; i++) {
        const discountFactor = Math.pow(1 + guess / 100, i);
        npv += cashFlows[i]! / discountFactor;
        if (i > 0) {
          npvDerivative -= (i * cashFlows[i]!) / (discountFactor * (1 + guess / 100));
        }
      }
      
      if (Math.abs(npv) < tolerance) break;
      if (Math.abs(npvDerivative) < 0.000001) break;
      
      const adjustment = npv / npvDerivative;
      guess = guess - adjustment * 100;
      
      if (guess < -99) guess = -99;
      if (guess > 1000) guess = 1000;
    }
    
    return guess;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const handleExport = (_format: 'pdf' | 'excel') => {
    // Export functionality not yet implemented
  };

  const npvValue = calculateNPV();
  const irrValue = calculateIRR();

  const handleAssumptionChange = (field: keyof EditableAssumptions, value: string) => {
    const numValue = parseFloat(value) || 0;
    setCustomAssumptions(prev => ({ ...prev, [field]: numValue }));
  };

  const _effectiveRevenueGrowth = isEditingAssumptions ? customAssumptions.revenueGrowth / 100 : scenarioConfig.revenueGrowth;
  const _effectiveCostReduction = isEditingAssumptions ? customAssumptions.costReduction / 100 : scenarioConfig.costReduction;

  return (
    <div className="space-y-3">
      {/* Professional Header - Light Theme Matching Business Case */}
      <Card className="border border-primary/20">
        <CardHeader className="py-3 px-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Left: Title with Icon */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white shadow-sm">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight">{t('dashboard.financial.title')}</h2>
                <p className="text-xs text-muted-foreground">{t('dashboard.financial.subtitle')}</p>
              </div>
            </div>

            {/* Center: Executive KPIs - Clean Card Style */}
            <div className="flex-1 flex items-center justify-center">
              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium">{t('dashboard.financial.forecast')}</span>
                  <Badge variant="secondary" className="h-5 px-2 text-[11px] font-semibold">{years}{t('dashboard.financial.yearAbbr')}</Badge>
                </div>
                <div className="w-px h-6 bg-border" />
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium">{t('dashboard.financial.irr')}</span>
                  <Badge 
                    variant={irrValue >= 20 ? "default" : "secondary"} 
                    className={`h-5 px-2 text-[11px] font-semibold ${irrValue >= 20 ? 'bg-emerald-500 hover:bg-emerald-500' : ''}`}
                  >
                    {formatPercent(irrValue)}
                  </Badge>
                </div>
                <div className="w-px h-6 bg-border" />
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium">{t('dashboard.financial.payback')}</span>
                  <Badge 
                    variant={paybackMonths <= 24 ? "default" : "secondary"}
                    className={`h-5 px-2 text-[11px] font-semibold ${paybackMonths <= 24 ? 'bg-emerald-500 hover:bg-emerald-500' : ''}`}
                  >
                    {Number.isFinite(paybackMonths) ? `${(paybackMonths / 12).toFixed(1)}Y` : 'N/A'}
                  </Badge>
                </div>
                <div className="w-px h-6 bg-border" />
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium">{t('dashboard.financial.npv')}</span>
                  <Badge 
                    variant={npvValue > 0 ? "default" : "destructive"}
                    className={`h-5 px-2 text-[11px] font-semibold ${npvValue > 0 ? 'bg-emerald-500 hover:bg-emerald-500' : ''}`}
                  >
                    {formatCurrency(npvValue)}
                  </Badge>
                </div>
                <div className="w-px h-6 bg-border" />
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium">Upfront Investment</span>
                  <span className="text-sm font-bold text-primary">{formatCurrency(upfrontInvestment)}</span>
                </div>
              </div>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2">
              <Select value={selectedScenario} onValueChange={(v) => setSelectedScenario(v as ScenarioType)}>
                <SelectTrigger className="w-[110px] h-8 text-xs" data-testid="select-scenario">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">{t('dashboard.financial.baseCase')}</SelectItem>
                  <SelectItem value="optimistic">{t('dashboard.financial.optimisticCase')}</SelectItem>
                  <SelectItem value="conservative">{t('dashboard.financial.conservativeCase')}</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={forecastYears} onValueChange={setForecastYears}>
                <SelectTrigger className="w-[80px] h-8 text-xs" data-testid="select-forecast-years">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">{t('dashboard.financial.nYears', { n: 3 })}</SelectItem>
                  <SelectItem value="5">{t('dashboard.financial.nYears', { n: 5 })}</SelectItem>
                  <SelectItem value="7">{t('dashboard.financial.nYears', { n: 7 })}</SelectItem>
                  <SelectItem value="10">{t('dashboard.financial.nYears', { n: 10 })}</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1 ml-1 border-l pl-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs gap-1.5"
                  onClick={() => handleExport('pdf')}
                  data-testid="button-export-pdf"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {t('dashboard.financial.pdf')}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs gap-1.5"
                  onClick={() => handleExport('excel')}
                  data-testid="button-export-excel"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {t('dashboard.financial.excel')}
                </Button>
                {onEditCashFlow && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-xs gap-1.5 text-muted-foreground"
                    onClick={onEditCashFlow}
                    data-testid="button-edit-cashflow"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    {t('dashboard.financial.editData')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Validated Assumptions - Always Visible with Edit */}
      <Card className="border">
        <CardHeader className="py-2 px-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">{t('dashboard.financial.validatedAssumptions')}</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {selectedScenario === 'base' ? t('dashboard.financial.standard') : selectedScenario === 'optimistic' ? t('dashboard.financial.aggressive') : t('dashboard.financial.prudent')}
              </Badge>
            </div>
            <Button
              variant={isEditingAssumptions ? "default" : "outline"}
              size="sm"
              className="h-6 text-[10px] gap-1 px-2"
              onClick={() => setIsEditingAssumptions(!isEditingAssumptions)}
              data-testid="button-edit-assumptions"
            >
              {isEditingAssumptions ? (
                <>
                  <Check className="h-3 w-3" />
                  {t('dashboard.financial.save')}
                </>
              ) : (
                <>
                  <Pencil className="h-3 w-3" />
                  {t('dashboard.financial.edit')}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="py-2 px-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Macro Economic */}
            <div className="p-2 rounded-lg bg-muted/30 border">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-3 w-3 text-blue-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">{t('dashboard.financial.macroEconomic')}</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('dashboard.financial.discountRate')}</span>
                  <span className="font-medium">{formatPercent(discountRate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('dashboard.financial.inflation')}</span>
                  {isEditingAssumptions ? (
                    <Input
                      type="number"
                      value={customAssumptions.inflationRate}
                      onChange={(e) => handleAssumptionChange('inflationRate', e.target.value)}
                      className="h-5 w-14 text-[10px] text-right p-1"
                      step="0.1"
                    />
                  ) : (
                    <span className="font-medium">{customAssumptions.inflationRate}%</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('dashboard.financial.wageGrowth')}</span>
                  {isEditingAssumptions ? (
                    <Input
                      type="number"
                      value={customAssumptions.wageEscalation}
                      onChange={(e) => handleAssumptionChange('wageEscalation', e.target.value)}
                      className="h-5 w-14 text-[10px] text-right p-1"
                      step="0.1"
                    />
                  ) : (
                    <span className="font-medium">{customAssumptions.wageEscalation}%</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('dashboard.financial.techDeflation')}</span>
                  {isEditingAssumptions ? (
                    <Input
                      type="number"
                      value={customAssumptions.techDeflation}
                      onChange={(e) => handleAssumptionChange('techDeflation', e.target.value)}
                      className="h-5 w-14 text-[10px] text-right p-1"
                      step="0.1"
                    />
                  ) : (
                    <span className="font-medium">{customAssumptions.techDeflation}%</span>
                  )}
                </div>
              </div>
            </div>

            {/* Project Specific */}
            <div className="p-2 rounded-lg bg-muted/30 border">
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="h-3 w-3 text-orange-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">{t('dashboard.financial.projectSpecific')}</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('dashboard.financial.adoptionCurve')}</span>
                  <span className="font-medium">{selectedScenario === 'optimistic' ? t('dashboard.financial.fast') : selectedScenario === 'conservative' ? t('dashboard.financial.slow') : t('dashboard.financial.normal')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('dashboard.financial.benefitRealization')}</span>
                  <span className="font-medium">{formatPercent(scenarioConfig.benefitRealization * 100)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('dashboard.financial.revenueGrowth')}</span>
                  {isEditingAssumptions ? (
                    <Input
                      type="number"
                      value={customAssumptions.revenueGrowth}
                      onChange={(e) => handleAssumptionChange('revenueGrowth', e.target.value)}
                      className="h-5 w-14 text-[10px] text-right p-1"
                      step="0.5"
                    />
                  ) : (
                    <span className="font-medium">{formatPercent(scenarioConfig.revenueGrowth * 100)}/yr</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('dashboard.financial.costEfficiency')}</span>
                  {isEditingAssumptions ? (
                    <Input
                      type="number"
                      value={customAssumptions.costReduction}
                      onChange={(e) => handleAssumptionChange('costReduction', e.target.value)}
                      className="h-5 w-14 text-[10px] text-right p-1"
                      step="0.5"
                    />
                  ) : (
                    <span className="font-medium">{formatPercent(scenarioConfig.costReduction * 100)}/yr</span>
                  )}
                </div>
              </div>
            </div>

            {/* Risk Contingencies */}
            <div className="p-2 rounded-lg bg-muted/30 border">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown className="h-3 w-3 text-red-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">{t('dashboard.financial.riskContingencies')}</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('dashboard.financial.costBuffer')}</span>
                  {isEditingAssumptions ? (
                    <Input
                      type="number"
                      value={customAssumptions.costBuffer}
                      onChange={(e) => handleAssumptionChange('costBuffer', e.target.value)}
                      className="h-5 w-14 text-[10px] text-right p-1"
                      step="1"
                    />
                  ) : (
                    <span className="font-medium">{formatPercent(scenarioConfig.implementationBuffer * 100)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('dashboard.financial.scheduleBuffer')}</span>
                  {isEditingAssumptions ? (
                    <Input
                      type="number"
                      value={customAssumptions.scheduleContingency}
                      onChange={(e) => handleAssumptionChange('scheduleContingency', e.target.value)}
                      className="h-5 w-14 text-[10px] text-right p-1"
                      step="1"
                    />
                  ) : (
                    <span className="font-medium">{selectedScenario === 'conservative' ? '20%' : selectedScenario === 'optimistic' ? '0%' : '10%'}</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('dashboard.financial.npvRiskFactor')}</span>
                  <span className="font-medium">{selectedScenario === 'conservative' ? '0.85' : selectedScenario === 'optimistic' ? '1.00' : '0.95'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('dashboard.financial.phasing')}</span>
                  <span className="font-medium">{years <= 3 ? t('dashboard.financial.aggressivePhasing') : t('dashboard.financial.phasedPhasing')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* UAE Policy Note - Compact */}
          <div className="mt-2 py-1.5 px-2 rounded bg-primary/5 border border-primary/20 flex items-center gap-2">
            <Info className="h-3 w-3 text-primary flex-shrink-0" />
            <span className="text-[10px] text-muted-foreground">
              <span className="font-medium">{t('dashboard.financial.uaePolicyAligned')}:</span> {t('dashboard.financial.uaePolicyStandards')}
            </span>
          </div>

          {/* AI-Generated Project Assumptions - from FinanceAgent */}
          {(() => {
            const roiCalc = businessCase.roiCalculation;
            const keyAssumptions = roiCalc?.keyAssumptions;
            const marketContext = roiCalc?.marketContext;
            if (!keyAssumptions) return null;
            
            const currentModel = editedRevenueModel || keyAssumptions;
            
            const handleStartEditRevenueModel = () => {
              setEditedRevenueModel(JSON.parse(JSON.stringify(keyAssumptions)));
              setIsEditingRevenueModel(true);
            };
            
            const handleCancelEditRevenueModel = () => {
              setEditedRevenueModel(null);
              setIsEditingRevenueModel(false);
            };
            
            const handleSaveRevenueModel = () => {
              setIsEditingRevenueModel(false);
            };
            
            const updatePricingValue = (idx: number, newValue: string) => {
              const updated = { ...editedRevenueModel } as RevenueModel;
              if (updated.pricing?.[idx]) {
                updated.pricing[idx] = { ...updated.pricing[idx], value: newValue };
                setEditedRevenueModel(updated);
              }
            };
            
            const updateVolumeValue = (idx: number, newValue: string) => {
              const updated = { ...editedRevenueModel } as RevenueModel;
              if (updated.volume?.[idx]) {
                updated.volume[idx] = { ...updated.volume[idx], value: newValue };
                setEditedRevenueModel(updated);
              }
            };
            
            const updateCostValue = (idx: number, newValue: string) => {
              const updated = { ...editedRevenueModel } as RevenueModel;
              if (updated.costs?.[idx]) {
                updated.costs[idx] = { ...updated.costs[idx], value: newValue };
                setEditedRevenueModel(updated);
              }
            };
            
            return (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider">{t('dashboard.financial.aiDerivedRevenueModel')}</span>
                    <Badge variant="secondary" className="text-[9px] h-4">
                      {currentModel.projectArchetype?.replace(/-/g, ' ').toUpperCase() || t('dashboard.financial.standardArchetype')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditingRevenueModel ? (
                      <>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={handleCancelEditRevenueModel}
                          data-testid="button-cancel-revenue-model"
                        >
                          <X className="h-4 w-4 mr-1" /> {t('dashboard.financial.cancel')}
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleSaveRevenueModel}
                          data-testid="button-save-revenue-model"
                        >
                          <Check className="h-4 w-4 mr-1" /> {t('dashboard.financial.save')}
                        </Button>
                      </>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={handleStartEditRevenueModel}
                        data-testid="button-edit-revenue-model"
                      >
                        <Pencil className="h-4 w-4 mr-1" /> {t('dashboard.financial.editModel')}
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Pricing & Volume in clear table format */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
                  {/* Unit Pricing - The key revenue drivers */}
                  <div className="p-2 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                    <div className="font-semibold text-green-700 dark:text-green-300 mb-2 flex items-center gap-1 text-[11px]">
                      <TrendingUp className="h-3.5 w-3.5" /> {t('dashboard.financial.unitPricing')}
                    </div>
                    <div className="space-y-1.5">
                      {currentModel.pricing?.map((item: RevenueModelItem, idx: number) => (
                        <div key={idx} className="flex justify-between items-start gap-2 py-1 border-b border-green-100 dark:border-green-800 last:border-0">
                          <div className="flex-1">
                            <span className="font-medium text-foreground block">{item.assumption}</span>
                            <span className="text-[9px] text-muted-foreground">{item.category}</span>
                          </div>
                          {isEditingRevenueModel ? (
                            <Input
                              value={item.value}
                              onChange={(e) => updatePricingValue(idx, e.target.value)}
                              className="h-8 w-32 text-xs text-right"
                              data-testid={`input-pricing-${idx}`}
                            />
                          ) : (
                            <span className="font-bold text-green-700 dark:text-green-300 whitespace-nowrap text-[11px]">{item.value}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Volume & Scale */}
                  <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <div className="font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1 text-[11px]">
                      <Building2 className="h-3.5 w-3.5" /> {t('dashboard.financial.volumeScale')}
                    </div>
                    <div className="space-y-1.5">
                      {currentModel.volume?.map((item: RevenueModelItem, idx: number) => (
                        <div key={idx} className="flex justify-between items-start gap-2 py-1 border-b border-blue-100 dark:border-blue-800 last:border-0">
                          <div className="flex-1">
                            <span className="font-medium text-foreground block">{item.assumption}</span>
                            <span className="text-[9px] text-muted-foreground">{item.category}</span>
                          </div>
                          {isEditingRevenueModel ? (
                            <Input
                              value={item.value}
                              onChange={(e) => updateVolumeValue(idx, e.target.value)}
                              className="h-8 w-36 text-xs text-right"
                              data-testid={`input-volume-${idx}`}
                            />
                          ) : (
                            <span className="font-bold text-blue-700 dark:text-blue-300 whitespace-nowrap text-[11px]">{item.value}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Cost Structure & Market - secondary row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 text-[10px]">
                  {/* Cost Structure */}
                  <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <div className="font-semibold text-amber-700 dark:text-amber-300 mb-1.5 flex items-center gap-1 text-[11px]">
                      <TrendingDown className="h-3.5 w-3.5" /> {t('dashboard.financial.costBreakdownLabel')}
                    </div>
                    <div className="space-y-1">
                      {currentModel.costs?.map((item: RevenueModelItem, idx: number) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span className="text-muted-foreground">{item.category}</span>
                          {isEditingRevenueModel ? (
                            <Input
                              value={item.value}
                              onChange={(e) => updateCostValue(idx, e.target.value)}
                              className="h-8 w-20 text-xs text-right"
                              data-testid={`input-cost-${idx}`}
                            />
                          ) : (
                            <span className="font-medium text-amber-700 dark:text-amber-300">{item.value}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Market Context */}
                  <div className="p-2 rounded bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                    <div className="font-semibold text-purple-700 dark:text-purple-300 mb-1 flex items-center gap-1 text-[11px]">
                      <Info className="h-3.5 w-3.5" /> {t('dashboard.financial.marketContext')}
                    </div>
                    <p className="text-muted-foreground leading-snug">
                      {marketContext || t('dashboard.financial.defaultMarketContext')}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Financial Overview Table & Cash Flow Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Financial Overview */}
        <Card>
          <CardHeader className="py-2 px-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm">{t('dashboard.financial.financialOverview')}</CardTitle>
              <Badge variant="outline" className="text-[10px] capitalize">{t('dashboard.financial.scenarioBadge', { scenario: selectedScenario })}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 font-semibold">{t('dashboard.financial.category')}</th>
                    {yearlyData.map((d, i) => (
                      <th key={i} className="text-right p-2 font-semibold">{t('dashboard.financial.yN', { n: d.yearNum })}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b bg-primary/5">
                    <td className="p-2 font-semibold text-foreground">{t('dashboard.financial.gmv')}</td>
                    {yearlyData.map((d, i) => (
                      <td key={i} className="text-right p-2 font-medium text-foreground">{formatCurrency(d.gmv)}</td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">{t('dashboard.financial.revenue')}</td>
                    {yearlyData.map((d, i) => (
                      <td key={i} className="text-right p-2">{formatCurrency(d.revenue)}</td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">{t('dashboard.financial.costs')}</td>
                    {yearlyData.map((d, i) => (
                      <td key={i} className="text-right p-2">{formatCurrency(d.costs)}</td>
                    ))}
                  </tr>
                  <tr className="border-b bg-green-50 dark:bg-green-950/30">
                    <td className="p-2 font-medium text-green-700 dark:text-green-300">{t('dashboard.financial.grossProfit')}</td>
                    {yearlyData.map((d, i) => (
                      <td key={i} className="text-right p-2 text-green-700 dark:text-green-300">{formatCurrency(d.grossProfit)}</td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">{t('dashboard.financial.grossMarginPct')}</td>
                    {yearlyData.map((d, i) => (
                      <td key={i} className="text-right p-2">{formatPercent(d.grossMargin)}</td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">{t('dashboard.financial.ebitda')}</td>
                    {yearlyData.map((d, i) => (
                      <td key={i} className="text-right p-2">{formatCurrency(d.ebitda)}</td>
                    ))}
                  </tr>
                  <tr className="border-b bg-blue-50 dark:bg-blue-950/30">
                    <td className="p-2 font-semibold text-blue-700 dark:text-blue-300">{t('dashboard.financial.netProfit')}</td>
                    {yearlyData.map((d, i) => (
                      <td key={i} className="text-right p-2 font-semibold text-blue-700 dark:text-blue-300">{formatCurrency(d.netProfit)}</td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">{t('dashboard.financial.netMarginPct')}</td>
                    {yearlyData.map((d, i) => (
                      <td key={i} className="text-right p-2">{formatPercent(d.netMargin)}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Cash Flow & Investment Summary */}
        <Card>
          <CardHeader className="py-2 px-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm">{t('dashboard.financial.cashFlowInvestment')}</CardTitle>
              {hasSavedCashFlows && <Badge variant="secondary" className="text-[10px]">{t('dashboard.financial.userEdited')}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-2 px-2">
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={yearlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: number | string) => formatCurrency(Number(value))} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="cashInflow" fill="#60a5fa" name={t('dashboard.financial.cashInflow')} />
                <Line type="monotone" dataKey="cumulativeCash" stroke="#f97316" strokeWidth={2} name={t('dashboard.financial.cumulativeCash')} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* KPI Dashboard Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* KPI Tables */}
        <Card>
          <CardHeader className="py-2 px-3 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm">{t('dashboard.financial.kpiDashboard')}</CardTitle>
            <Badge variant="secondary" className="text-[10px]">{t('dashboard.financial.autoCalculated')}</Badge>
          </CardHeader>
          <CardContent className="pt-0 pb-3 px-3 space-y-3">
            {/* ROI Table */}
            <div>
              <p className="text-xs font-semibold mb-2">{t('dashboard.financial.performanceMetricsByYear')}</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-1 font-semibold">{t('dashboard.financial.metric')}</th>
                    {yearlyData.slice(0, Math.min(4, years)).map((d, i) => (
                      <th key={i} className="text-right p-1 font-semibold">{t('dashboard.financial.yN', { n: d.yearNum })}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="p-1">{t('dashboard.financial.roi')}</td>
                    {yearlyData.slice(0, Math.min(4, years)).map((d, i) => (
                      <td key={i} className="text-right p-1">{formatPercent(d.roi)}</td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-1">{t('dashboard.financial.grossMargin')}</td>
                    {yearlyData.slice(0, Math.min(4, years)).map((d, i) => (
                      <td key={i} className="text-right p-1">{formatPercent(d.grossMargin)}</td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-1">{t('dashboard.financial.operatingMargin')}</td>
                    {yearlyData.slice(0, Math.min(4, years)).map((d, i) => (
                      <td key={i} className="text-right p-1">{formatPercent(d.operatingMargin)}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-1">{t('dashboard.financial.netMargin')}</td>
                    {yearlyData.slice(0, Math.min(4, years)).map((d, i) => (
                      <td key={i} className="text-right p-1">{formatPercent(d.netMargin)}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Key Metrics Summary */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
                <div className="text-xs text-muted-foreground">{t('dashboard.financial.totalRoi')}</div>
                <div className="text-lg font-bold text-green-600">{formatPercent(roi)}</div>
              </div>
              <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
                <div className="text-xs text-muted-foreground">{t('dashboard.financial.nYearNpv', { n: years })}</div>
                <div className="text-lg font-bold text-blue-600">{formatCurrency(npvValue)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue & Profit Trends + Cost Breakdown */}
        <Card>
          <CardHeader className="py-2 px-3 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm">{t('dashboard.financial.performanceTrends')}</CardTitle>
            <Badge variant="secondary" className="text-[10px]">{t('dashboard.financial.autoCalculated')}</Badge>
          </CardHeader>
          <CardContent className="pt-0 pb-3 px-3 space-y-3">
            {/* Revenue & Profit Chart */}
            <div>
              <p className="text-[11px] font-semibold mb-1">{t('dashboard.financial.revenueProfitGrowth')}</p>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: number | string) => formatCurrency(Number(value))} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="revenue" stroke="#1e40af" strokeWidth={2} name={t('dashboard.financial.revenue')} />
                  <Line type="monotone" dataKey="netProfit" stroke="#16a34a" strokeWidth={2} name={t('dashboard.financial.profit')} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Cost Breakdown Pie Chart */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-[11px] font-semibold mb-1">{t('dashboard.financial.costBreakdownTco')}</p>
                <ResponsiveContainer width="100%" height={100}>
                  <PieChart>
                    <Pie
                      data={costBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={42}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {costBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number | string) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-0.5">
                {costBreakdown.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px]">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }}></div>
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="ml-auto font-medium">{((item.value / totalCost) * 100).toFixed(0)}%</span>
                  </div>
                ))}
                {hasCustomTco && (
                  <Badge variant="outline" className="text-[10px] mt-1">{t('dashboard.financial.userEdited')}</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
