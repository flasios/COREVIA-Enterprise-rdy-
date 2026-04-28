import type {
  DecisionGradeFinancialModel as _DecisionGradeFinancialModel,
  YearlyCashFlow,
  ScenarioAnalysis,
  SensitivityVariable,
  KeyMetrics,
  CostLineItem,
  BenefitLineItem,
  DoNothingScenario,
  DecisionRecommendation,
  DEFAULT_DISCOUNT_RATE as _DEFAULT_DISCOUNT_RATE,
  DEFAULT_PROJECT_DURATION as _DEFAULT_PROJECT_DURATION,
} from '../types/financialTypes';

export function calculateNPV(cashFlows: number[], discountRate: number): number {
  const rate = discountRate / 100;
  return cashFlows.reduce((npv, cf, year) => {
    return npv + cf / Math.pow(1 + rate, year);
  }, 0);
}

export function calculateIRR(cashFlows: number[], maxIterations = 1000, tolerance = 0.0001): number {
  if (cashFlows.every(cf => cf >= 0) || cashFlows.every(cf => cf <= 0)) {
    return 0;
  }

  let low = -0.99;
  let high = 10;
  let irr = 0;

  for (let i = 0; i < maxIterations; i++) {
    irr = (low + high) / 2;
    const npv = cashFlows.reduce((sum, cf, year) => sum + cf / Math.pow(1 + irr, year), 0);

    if (Math.abs(npv) < tolerance) break;

    if (npv > 0) {
      low = irr;
    } else {
      high = irr;
    }
  }

  return irr * 100;
}

export function calculatePaybackPeriod(cashFlows: YearlyCashFlow[]): number {
  if (cashFlows.length === 0) return Infinity;

  for (let i = 1; i < cashFlows.length; i++) {
    if (cashFlows[i]!.cumulativeCashFlow >= 0 && cashFlows[i - 1]!.cumulativeCashFlow < 0) {
      const prevCumulative = Math.abs(cashFlows[i - 1]!.cumulativeCashFlow);
      const currentNet = cashFlows[i]!.netCashFlow;
      if (currentNet > 0) {
        const fraction = prevCumulative / currentNet;
        return ((i - 1) + fraction) * 12;
      }
      return i * 12;
    }
  }

  if (cashFlows[0]!.cumulativeCashFlow >= 0) return 0;
  return Infinity;
}

export function calculateBreakEvenYear(cashFlows: YearlyCashFlow[]): number | null {
  if (cashFlows.length === 0) return null;
  if (cashFlows[0]!.cumulativeCashFlow >= 0) return 0;

  for (let i = 1; i < cashFlows.length; i++) {
    if (cashFlows[i]!.cumulativeCashFlow >= 0 && cashFlows[i - 1]!.cumulativeCashFlow < 0) {
      const prevCumulative = Math.abs(cashFlows[i - 1]!.cumulativeCashFlow);
      const currentNet = cashFlows[i]!.netCashFlow;
      if (currentNet > 0) {
        return (i - 1) + prevCumulative / currentNet;
      }
      return i;
    }
  }

  return null;
}

export function buildCashFlows(
  costs: CostLineItem[],
  benefits: BenefitLineItem[],
  discountRate: number,
  projectDuration: number = 5
): YearlyCashFlow[] {
  const cashFlows: YearlyCashFlow[] = [];
  let cumulativeCashFlow = 0;
  let cumulativeDiscountedCashFlow = 0;
  const rate = discountRate / 100;

  for (let year = 0; year <= projectDuration; year++) {
    const yearCosts = costs.reduce((sum, cost) => {
      const yearKey = `year${year}` as keyof CostLineItem;
      return sum + (Number(cost[yearKey]) || 0);
    }, 0);

    const yearBenefits = year === 0 ? 0 : benefits.reduce((sum, benefit) => {
      const yearKey = `year${year}` as keyof BenefitLineItem;
      return sum + (Number(benefit[yearKey]) || 0);
    }, 0);

    const netCashFlow = yearBenefits - yearCosts;
    cumulativeCashFlow += netCashFlow;
    const discountedCashFlow = netCashFlow / Math.pow(1 + rate, year);
    cumulativeDiscountedCashFlow += discountedCashFlow;

    cashFlows.push({
      year,
      label: year === 0 ? 'Initial' : `Year ${year}`,
      costs: yearCosts,
      benefits: yearBenefits,
      netCashFlow,
      cumulativeCashFlow,
      discountedCashFlow,
      cumulativeDiscountedCashFlow,
    });
  }

  return cashFlows;
}

export function calculateScenarios(
  baseCosts: CostLineItem[],
  baseBenefits: BenefitLineItem[],
  discountRate: number,
  projectDuration: number = 5
): ScenarioAnalysis[] {
  const scenarioConfigs = [
    {
      name: 'best' as const,
      label: 'Best Case',
      description: 'High adoption, lower costs, faster implementation',
      probability: 0.20,
      costVariance: -15,
      benefitVariance: 20,
      adoptionRate: 95,
      implementationDelay: 0,
    },
    {
      name: 'base' as const,
      label: 'Base Case',
      description: 'Expected scenario based on validated assumptions',
      probability: 0.50,
      costVariance: 0,
      benefitVariance: 0,
      adoptionRate: 75,
      implementationDelay: 0,
    },
    {
      name: 'worst' as const,
      label: 'Worst Case',
      description: 'Low adoption, cost overruns, implementation delays',
      probability: 0.30,
      costVariance: 30,
      benefitVariance: -25,
      adoptionRate: 50,
      implementationDelay: 6,
    },
  ];

  return scenarioConfigs.map((config) => {
    const adoptionMultiplier = config.adoptionRate / 75;
    const delayMonths = config.implementationDelay;
    const delayYearFraction = delayMonths / 12;

    const adjustedCosts = baseCosts.map((cost) => ({
      ...cost,
      year0: cost.year0 * (1 + config.costVariance / 100),
      year1: cost.year1 * (1 + config.costVariance / 100) + (delayMonths > 0 ? cost.year0 * 0.05 : 0),
      year2: cost.year2 * (1 + config.costVariance / 100),
      year3: cost.year3 * (1 + config.costVariance / 100),
      year4: cost.year4 * (1 + config.costVariance / 100),
      year5: cost.year5 * (1 + config.costVariance / 100),
    }));

    const adjustedBenefits = baseBenefits.map((benefit) => {
      const baseMultiplier = (1 + config.benefitVariance / 100) * adoptionMultiplier;
      const y1 = benefit.year1 * baseMultiplier * Math.max(0, 1 - delayYearFraction);
      const y2 = benefit.year2 * baseMultiplier * (delayMonths >= 6 ? 0.7 : 1);
      const y3 = benefit.year3 * baseMultiplier;
      const y4 = benefit.year4 * baseMultiplier;
      const y5 = benefit.year5 * baseMultiplier;
      return { ...benefit, year1: y1, year2: y2, year3: y3, year4: y4, year5: y5 };
    });

    const cashFlows = buildCashFlows(adjustedCosts, adjustedBenefits, discountRate, projectDuration);
    const netCashFlows = cashFlows.map((cf) => cf.netCashFlow);

    const totalCost = adjustedCosts.reduce((sum, cost) => 
      sum + cost.year0 + cost.year1 + cost.year2 + cost.year3 + cost.year4 + cost.year5, 0);
    const totalBenefit = adjustedBenefits.reduce((sum, benefit) => 
      sum + benefit.year1 + benefit.year2 + benefit.year3 + benefit.year4 + benefit.year5, 0);

    return {
      name: config.name,
      label: config.label,
      description: config.description,
      probability: config.probability,
      assumptions: {
        costVariance: config.costVariance,
        benefitVariance: config.benefitVariance,
        adoptionRate: config.adoptionRate,
        implementationDelay: config.implementationDelay,
      },
      npv: calculateNPV(netCashFlows, discountRate),
      irr: calculateIRR(netCashFlows),
      paybackMonths: calculatePaybackPeriod(cashFlows),
      roi: totalCost > 0 ? ((totalBenefit - totalCost) / totalCost) * 100 : 0,
      totalCost,
      totalBenefit,
    };
  });
}

export function calculateSensitivityAnalysis(
  baseCosts: CostLineItem[],
  baseBenefits: BenefitLineItem[],
  discountRate: number,
  projectDuration: number = 5
): SensitivityVariable[] {
  const baseCashFlows = buildCashFlows(baseCosts, baseBenefits, discountRate, projectDuration);
  const baseNPV = calculateNPV(baseCashFlows.map((cf) => cf.netCashFlow), discountRate);

  const totalBaseCost = baseCosts.reduce((sum, cost) => 
    sum + cost.year0 + cost.year1 + cost.year2 + cost.year3 + cost.year4 + cost.year5, 0);
  const totalBaseBenefit = baseBenefits.reduce((sum, benefit) => 
    sum + benefit.year1 + benefit.year2 + benefit.year3 + benefit.year4 + benefit.year5, 0);

  const variables: SensitivityVariable[] = [
    {
      id: 'implementation_cost',
      name: 'Implementation Costs',
      baseValue: totalBaseCost,
      unit: 'AED',
      lowVariance: -20,
      highVariance: 30,
      lowValue: 0,
      highValue: 0,
      npvAtLow: 0,
      npvAtBase: baseNPV,
      npvAtHigh: 0,
      sensitivityIndex: 0,
      switchingValue: null,
      isCritical: false,
    },
    {
      id: 'benefit_realization',
      name: 'Benefit Realization',
      baseValue: totalBaseBenefit,
      unit: 'AED',
      lowVariance: -25,
      highVariance: 15,
      lowValue: 0,
      highValue: 0,
      npvAtLow: 0,
      npvAtBase: baseNPV,
      npvAtHigh: 0,
      sensitivityIndex: 0,
      switchingValue: null,
      isCritical: false,
    },
    {
      id: 'discount_rate',
      name: 'Discount Rate',
      baseValue: discountRate,
      unit: '%',
      lowVariance: -2,
      highVariance: 4,
      lowValue: 0,
      highValue: 0,
      npvAtLow: 0,
      npvAtBase: baseNPV,
      npvAtHigh: 0,
      sensitivityIndex: 0,
      switchingValue: null,
      isCritical: false,
    },
  ];

  return variables.map((variable) => {
    let npvAtLow = 0;
    let npvAtHigh = 0;
    let lowValue = 0;
    let highValue = 0;

    if (variable.id === 'implementation_cost') {
      lowValue = totalBaseCost * (1 + variable.lowVariance / 100);
      highValue = totalBaseCost * (1 + variable.highVariance / 100);

      const lowCosts = baseCosts.map((c) => ({
        ...c,
        year0: c.year0 * (1 + variable.lowVariance / 100),
        year1: c.year1 * (1 + variable.lowVariance / 100),
        year2: c.year2 * (1 + variable.lowVariance / 100),
        year3: c.year3 * (1 + variable.lowVariance / 100),
        year4: c.year4 * (1 + variable.lowVariance / 100),
        year5: c.year5 * (1 + variable.lowVariance / 100),
      }));
      const highCosts = baseCosts.map((c) => ({
        ...c,
        year0: c.year0 * (1 + variable.highVariance / 100),
        year1: c.year1 * (1 + variable.highVariance / 100),
        year2: c.year2 * (1 + variable.highVariance / 100),
        year3: c.year3 * (1 + variable.highVariance / 100),
        year4: c.year4 * (1 + variable.highVariance / 100),
        year5: c.year5 * (1 + variable.highVariance / 100),
      }));

      const lowCF = buildCashFlows(lowCosts, baseBenefits, discountRate, projectDuration);
      const highCF = buildCashFlows(highCosts, baseBenefits, discountRate, projectDuration);
      npvAtLow = calculateNPV(lowCF.map((cf) => cf.netCashFlow), discountRate);
      npvAtHigh = calculateNPV(highCF.map((cf) => cf.netCashFlow), discountRate);
    } else if (variable.id === 'benefit_realization') {
      lowValue = totalBaseBenefit * (1 + variable.lowVariance / 100);
      highValue = totalBaseBenefit * (1 + variable.highVariance / 100);

      const lowBenefits = baseBenefits.map((b) => ({
        ...b,
        year1: b.year1 * (1 + variable.lowVariance / 100),
        year2: b.year2 * (1 + variable.lowVariance / 100),
        year3: b.year3 * (1 + variable.lowVariance / 100),
        year4: b.year4 * (1 + variable.lowVariance / 100),
        year5: b.year5 * (1 + variable.lowVariance / 100),
      }));
      const highBenefits = baseBenefits.map((b) => ({
        ...b,
        year1: b.year1 * (1 + variable.highVariance / 100),
        year2: b.year2 * (1 + variable.highVariance / 100),
        year3: b.year3 * (1 + variable.highVariance / 100),
        year4: b.year4 * (1 + variable.highVariance / 100),
        year5: b.year5 * (1 + variable.highVariance / 100),
      }));

      const lowCF = buildCashFlows(baseCosts, lowBenefits, discountRate, projectDuration);
      const highCF = buildCashFlows(baseCosts, highBenefits, discountRate, projectDuration);
      npvAtLow = calculateNPV(lowCF.map((cf) => cf.netCashFlow), discountRate);
      npvAtHigh = calculateNPV(highCF.map((cf) => cf.netCashFlow), discountRate);
    } else if (variable.id === 'discount_rate') {
      lowValue = discountRate + variable.lowVariance;
      highValue = discountRate + variable.highVariance;
      
      const baseCF = baseCashFlows.map((cf) => cf.netCashFlow);
      npvAtLow = calculateNPV(baseCF, lowValue);
      npvAtHigh = calculateNPV(baseCF, highValue);
    }

    const npvRange = Math.abs(npvAtHigh - npvAtLow);
    const sensitivityIndex = baseNPV !== 0 ? (npvRange / Math.abs(baseNPV)) * 100 : 0;

    let switchingValue: number | null = null;
    if (baseNPV > 0 && npvAtHigh < 0) {
      const ratio = Math.abs(baseNPV) / npvRange;
      switchingValue = variable.baseValue * (1 + (variable.highVariance / 100) * ratio);
    } else if (baseNPV > 0 && npvAtLow < 0) {
      const ratio = Math.abs(baseNPV) / npvRange;
      switchingValue = variable.baseValue * (1 + (variable.lowVariance / 100) * ratio);
    }

    return {
      ...variable,
      lowValue,
      highValue,
      npvAtLow,
      npvAtHigh,
      sensitivityIndex,
      switchingValue,
      isCritical: sensitivityIndex > 50,
    };
  });
}

export function calculateDoNothingScenario(
  baseBenefits: BenefitLineItem[],
  projectDuration: number = 5
): DoNothingScenario {
  const modeledYearlyImpact = Array.from({ length: projectDuration }, (_, index) => {
    const yearKey = `year${index + 1}` as keyof BenefitLineItem;
    return baseBenefits.reduce((sum, benefit) => sum + (Number(benefit[yearKey]) || 0), 0);
  });
  const annualBenefit = modeledYearlyImpact[0] || 0;
  const yearlyImpact: number[] = [];
  const cumulativeImpact: number[] = [];
  let cumulative = 0;

  for (let year = 1; year <= projectDuration; year++) {
    const impact = modeledYearlyImpact[year - 1] || 0;
    cumulative += impact;
    yearlyImpact.push(impact);
    cumulativeImpact.push(cumulative);
  }

  return {
    totalCostOfInaction: cumulative,
    annualCostOfDelay: annualBenefit,
    competitiveRisk: 'Competitors may gain advantage through digital transformation',
    complianceRisk: 'Potential non-compliance with UAE Digital Government Strategy 2025',
    operationalRisk: 'Continued manual processes lead to inefficiency and errors',
    strategicImpact: 'Miss alignment with UAE Vision 2031 digital economy goals',
    yearlyImpact,
    cumulativeImpact,
  };
}

export function generateDecisionRecommendation(
  keyMetrics: KeyMetrics,
  scenarios: ScenarioAnalysis[],
  sensitivityAnalysis: SensitivityVariable[]
): DecisionRecommendation {
  const { npv, irr, roi5Year, paybackMonths, benefitCostRatio } = keyMetrics;
  const worstCase = scenarios.find((s) => s.name === 'worst');
  const criticalVariables = sensitivityAnalysis.filter((v) => v.isCritical);

  let verdict: DecisionRecommendation['verdict'] = 'not_recommended';
  let justifiedOnFinancials = false;

  // Use effective IRR - if IRR calculation fails but other metrics are strong, use a proxy
  const effectiveIrr = irr > 0 ? irr : (roi5Year > 100 ? 20 : (roi5Year > 50 ? 12 : 0));

  if (npv > 0 && effectiveIrr > 15 && roi5Year > 50 && paybackMonths < 36) {
    verdict = 'strongly_recommended';
    justifiedOnFinancials = true;
  } else if (npv > 0 && effectiveIrr > 10 && roi5Year > 20) {
    verdict = 'recommended';
    justifiedOnFinancials = true;
  } else if (npv > 0 && roi5Year > 50 && benefitCostRatio > 1.5) {
    // Strong ROI and benefit-cost ratio can still justify recommendation
    verdict = 'recommended';
    justifiedOnFinancials = true;
  } else if (npv > 0 || (worstCase && worstCase.npv > 0)) {
    verdict = 'conditional';
    justifiedOnFinancials = npv > 0;
  }

  const keyStrengths: string[] = [];
  const keyRisks: string[] = [];
  const conditions: string[] = [];
  const strategicFactors: string[] = [];

  if (npv > 0) keyStrengths.push(`Positive NPV of ${formatCurrency(npv)}`);
  if (irr > 15) keyStrengths.push(`Strong IRR of ${irr.toFixed(1)}%`);
  if (paybackMonths < 24) keyStrengths.push(`Quick payback of ${formatPayback(paybackMonths)}`);
  if (benefitCostRatio > 1.5) keyStrengths.push(`Benefit-cost ratio of ${benefitCostRatio.toFixed(2)}:1`);

  if (worstCase && worstCase.npv < 0) {
    keyRisks.push(`Worst-case NPV is negative (${formatCurrency(worstCase.npv)})`);
  }
  criticalVariables.forEach((v) => {
    keyRisks.push(`High sensitivity to ${v.name} changes`);
  });
  if (paybackMonths > 36) keyRisks.push('Extended payback period increases risk');

  if (!justifiedOnFinancials) {
    conditions.push('Requires strong change management to achieve adoption targets');
    conditions.push('Regular monitoring of key assumptions is essential');
    strategicFactors.push('Alignment with UAE Digital Government Strategy 2025');
    strategicFactors.push('Competitive positioning in digital transformation');
    strategicFactors.push('Long-term capability building for the organization');
  }

  const summary = justifiedOnFinancials
    ? `This investment IS justified on financial returns alone. With an NPV of ${formatCurrency(npv)} and ROI of ${roi5Year.toFixed(1)}%, the business case demonstrates strong financial viability.`
    : `This investment IS NOT justified on financial returns alone. While ${npv > 0 ? 'the NPV is positive' : 'there are potential benefits'}, strategic factors must be considered to justify the investment.`;

  return {
    verdict,
    justifiedOnFinancials,
    summary,
    keyStrengths,
    keyRisks,
    conditions,
    strategicFactors,
    nextSteps: [
      'Validate key assumptions with stakeholders',
      'Develop detailed implementation timeline',
      'Establish KPI monitoring framework',
      'Create change management plan',
    ],
  };
}

export function calculateKeyMetrics(
  cashFlows: YearlyCashFlow[],
  scenarios: ScenarioAnalysis[],
  discountRate: number
): KeyMetrics {
  const netCashFlows = cashFlows.map((cf) => cf.netCashFlow);
  const npv = calculateNPV(netCashFlows, discountRate);
  const irr = calculateIRR(netCashFlows);
  const paybackMonths = calculatePaybackPeriod(cashFlows);
  const breakEvenYear = calculateBreakEvenYear(cashFlows);

  const totalInvestment = cashFlows.reduce((sum, cf) => sum + cf.costs, 0);
  const totalBenefit = cashFlows.reduce((sum, cf) => sum + cf.benefits, 0);
  const netBenefit = totalBenefit - totalInvestment;
  const roi5Year = totalInvestment > 0 ? (netBenefit / totalInvestment) * 100 : 0;
  const benefitCostRatio = totalInvestment > 0 ? totalBenefit / totalInvestment : 0;

  const expectedNpv = scenarios.reduce((sum, s) => sum + s.npv * s.probability, 0);

  return {
    npv,
    irr,
    paybackMonths,
    roi5Year,
    breakEvenYear,
    benefitCostRatio,
    netBenefit,
    totalInvestment,
    totalBenefit,
    expectedNpv,
    discountRate,
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPayback(months: number): string {
  if (!months || months === Infinity) return 'N/A';
  const years = Math.floor(months / 12);
  const remainingMonths = Math.round(months % 12);
  if (years === 0) return `${remainingMonths} months`;
  if (remainingMonths === 0) return `${years} year${years > 1 ? 's' : ''}`;
  return `${years}y ${remainingMonths}m`;
}
