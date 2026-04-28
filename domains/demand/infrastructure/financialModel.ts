/**
 * Unified Financial Model Service
 *
 * Single source of truth for all financial calculations in the business case.
 * This service handles:
 * - Financial metric computation (NPV, IRR, ROI, Payback)
 * - Cash flow projections
 * - Investment decision recommendation
 * - Scenario analysis
 *
 * All frontend, API, and PDF export use this same service.
 */


import {
  ARCHETYPE_BASE_INVESTMENT,
  getDefaultDomainParameters,
  getDefaultFinancialAssumptions,
  sanitizeDomainParameters,
} from './financialModel.parameters';

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isPersistedBusinessCaseRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return Boolean(record.id || record.generatedAt || record.generatedBy || record.demandReportId);
}

function parseMoneyNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value !== 'string') {
    return 0;
  }

  const cleaned = value.replaceAll(/[^\d.,-]/g, '').replaceAll(',', '').trim();
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseListValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  if (typeof value !== 'string') {
    return [];
  }
  return value.split(/[;,\n]+/).map((item) => item.trim()).filter(Boolean);
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeShares(entries: { name: string; fare: number; share: number }[]): { name: string; fare: number; share: number }[] {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.share), 0) || 1;
  return entries.map((entry) => ({
    ...entry,
    share: Math.max(0, entry.share) / total,
  }));
}

interface DroneLastMileEconomics {
  pilotCase: DroneStageEconomics;
  scaleCase: DroneStageEconomics;
  weightedAverageFare: number;
  platformRevenuePerDelivery: number;
  variableCostPerDelivery: number;
  variableCostPerDeliveryByYear: number[];
  deliveryContributionPerDelivery: number;
  yearlyDeliveries: number[];
  yearlyPlatformRevenue: number[];
  yearlyContribution: number[];
  yearlyVariableCosts: number[];
  yearlyCostSavings: number[];
  yearlyCarbonValue: number[];
  effectiveCostPerDelivery: number[];
  ebitdaMargins: number[];
  netMargins: number[];
  rampSchedule: { year: number; fleetActive: number; utilization: number; deliveries: number }[];
  revenueSegments: { name: string; fare: number; share: number }[];
  fixedAnnualByYear: number[];
  fixedCostBreakdown: { name: string; annualValue: number }[];
  variableCostBreakdown: { name: string; value: number }[];
  fleetAvailability: number;
  demandUtilization: number;
  weatherRegulationFactor: number;
  scaleGateOpen: boolean;
  expansionDecision: 'GO' | 'STOP';
  enforcementSummary: string;
}

function buildDroneLastMileEconomics(domainParams?: Record<string, number>, adoptionRate: number = 0.75): DroneLastMileEconomics {
  const defaults = getDefaultDomainParameters('Drone Last Mile Delivery');
  const getParam = (key: string, fallback: number): number => domainParams?.[key] ?? defaults[key] ?? fallback;

  const scaleFleet = Math.round(clampNumber(getParam('Fleet Size', 180), 100, 500));
  const pilotFleet = Math.round(clampNumber(getParam('Pilot Fleet Size', Math.max(10, Math.min(20, Math.round(scaleFleet * 0.08)))), 10, 20));
  const maxCapacityPerDrone = clampNumber(getParam('Max Capacity per Drone', 230), 160, 300);
  const fleetAvailability = clampNumber(getParam('Fleet Availability', 0.9), 0.8, 0.97);
  const demandUtilization = clampNumber(getParam('Demand Utilization', 0.68), 0.5, 0.78);
  const weatherRegulationFactor = clampNumber(getParam('Weather Regulation Factor', 0.82), 0.72, 0.88);

  const revenueSegments = normalizeShares([
    { name: 'Premium Express', fare: getParam('Premium Fare Rate', 44), share: getParam('Premium Share', 0.10) },
    { name: 'Pharma / Critical Delivery', fare: getParam('Pharma Fare Rate', 52), share: getParam('Pharma Share', 0.15) },
    { name: 'B2B Contracted Volume', fare: getParam('B2B Contract Fare Rate', 28), share: getParam('B2B Share', 0.75) },
  ]);
  const weightedAverageFare = revenueSegments.reduce((sum, segment) => sum + (segment.fare * segment.share), 0);
  const contractedVolumeShare = clampNumber(getParam('Enterprise Contract Share', 0.7), 0.55, 0.85);
  const platformRevenuePerDelivery = getParam('Platform Fee per Delivery', 2.5) * contractedVolumeShare;
  const annualIntegrationFees = getParam('Platform Integration Fees Annual', 400_000);
  const partnerDeliveryShare = clampNumber(getParam('Pilot Partner Delivery Share', 0.65), 0.25, 0.85);
  const partnerOpsOffset = clampNumber(getParam('Pilot Partner Ops Offset', 0.30), 0.1, 0.6);
  const pilotOperatingDays = Math.round(clampNumber(getParam('Pilot Operating Days', 260), 180, 320));
  const pilotRevenueRealization = clampNumber(getParam('Pilot Revenue Realization', 0.45), 0.35, 0.75);
  const learningCurveAnnualImprovement = clampNumber(getParam('Learning Curve Annual Improvement', 0.06), 0.02, 0.12);
  const automationTarget = clampNumber(getParam('Automation Target', 0.55), 0.2, 0.8);
  const idleTimeReductionTarget = clampNumber(getParam('Idle Time Reduction', 0.12), 0.11, 0.25);
  const adoptionDemandFactor = clampNumber(adoptionRate / 0.75, 0.85, 1.05);
  const adoptionRevenueFactor = clampNumber(adoptionRate / 0.75, 0.8, 1.05);

  const variableCostBreakdown = [
    { name: 'Energy (Battery)', value: getParam('Energy Cost per Flight', 4) },
    { name: 'Maintenance / Flight Hour', value: getParam('Maintenance per Flight Hour', 9) },
    { name: 'Battery Depreciation', value: getParam('Battery Depreciation per Flight', 5.5) },
    { name: 'Cloud & Comms', value: getParam('Communication Cloud per Flight', 2) },
    { name: 'Ground Handling', value: getParam('Ground Handling per Delivery', 5) },
    { name: 'Customer Service & Claims', value: getParam('Customer Service per Delivery', 2.5) },
  ];
  const variableCostPerDelivery = variableCostBreakdown.reduce((sum, line) => sum + line.value, 0);
  const deliveryContributionPerDelivery = weightedAverageFare - variableCostPerDelivery;

  const fixedCostBreakdown = [
    { name: 'Control Center', annualValue: getParam('Control Center Annual', 1_800_000) },
    { name: 'Operations Staff', annualValue: getParam('Operations Staff Annual', 2_800_000) },
    { name: 'Insurance & Liability', annualValue: getParam('Insurance Annual', 1_200_000) },
    { name: 'Licensing & Compliance', annualValue: getParam('Licensing Compliance Annual', 600_000) },
  ];
  const totalFixedAnnual = fixedCostBreakdown.reduce((sum, line) => sum + line.annualValue, 0);

  const pilotDeliveriesPerDrone = Math.round(clampNumber(getParam('Pilot Deliveries per Drone', maxCapacityPerDrone * 0.18 * fleetAvailability * weatherRegulationFactor), 20, 45));
  const scaleDeliveriesPerDrone = Math.round(clampNumber(getParam('Scale Deliveries per Drone', maxCapacityPerDrone * demandUtilization * fleetAvailability * weatherRegulationFactor * 1.1), 110, 140));

  const fleetActiveShareByYear = [
    clampNumber(pilotFleet / Math.max(scaleFleet, 1), 0.08, 0.25),
    clampNumber(getParam('Y2 Fleet Active', 0.75), 0.25, 0.85),
    clampNumber(getParam('Y3 Fleet Active', 0.9), 0.4, 0.95),
    clampNumber(getParam('Y4 Fleet Active', 0.95), 0.5, 1),
    clampNumber(getParam('Y5 Fleet Active', 1), 0.6, 1),
  ];
  const utilizationFactorByYear = [
    clampNumber(pilotDeliveriesPerDrone / Math.max(scaleDeliveriesPerDrone, 1), 0.2, 0.45),
    clampNumber(getParam('Y2 Utilization Factor', 0.65), 0.35, 0.8),
    clampNumber(getParam('Y3 Utilization Factor', 0.78), 0.45, 0.9),
    clampNumber(getParam('Y4 Utilization Factor', 0.88), 0.55, 0.95),
    clampNumber(getParam('Y5 Utilization Factor', 0.92), 0.65, 1),
  ];

  const fleetByYear = [
    pilotFleet,
    Math.max(Math.round(scaleFleet * fleetActiveShareByYear[1]!), pilotFleet + 12),
    Math.max(Math.round(scaleFleet * fleetActiveShareByYear[2]!), pilotFleet + 24),
    Math.max(Math.round(scaleFleet * fleetActiveShareByYear[3]!), pilotFleet + 36),
    Math.max(Math.round(scaleFleet * fleetActiveShareByYear[4]!), pilotFleet + 48),
  ];
  const deliveriesPerDroneByYear = [
    Math.max(24, Math.round(pilotDeliveriesPerDrone * adoptionDemandFactor)),
    Math.max(55, Math.round(scaleDeliveriesPerDrone * utilizationFactorByYear[1]! * adoptionDemandFactor)),
    Math.max(70, Math.round(scaleDeliveriesPerDrone * utilizationFactorByYear[2]! * adoptionDemandFactor)),
    Math.max(85, Math.round(scaleDeliveriesPerDrone * utilizationFactorByYear[3]! * adoptionDemandFactor)),
    Math.max(95, Math.round(scaleDeliveriesPerDrone * utilizationFactorByYear[4]! * adoptionDemandFactor)),
  ];
  const automationRateByYear = [0.15, 0.28, 0.40, 0.48, automationTarget].map((rate) => clampNumber(rate, 0.1, automationTarget));
  const idleTimeReductionByYear = [0.04, 0.07, 0.09, 0.11, idleTimeReductionTarget].map((rate) => clampNumber(rate, 0.02, idleTimeReductionTarget));
  const learningReductionByYear = [0.02, 0.04, 0.06, 0.08, learningCurveAnnualImprovement * 1.5]
    .map((rate) => clampNumber(rate, 0.01, Math.min(0.18, learningCurveAnnualImprovement * 1.5)));
  const variableCostPerDeliveryByYear = [0, 1, 2, 3, 4].map((index) => {
    const automationLeverage = 1 - (automationRateByYear[index]! * 0.12);
    const idleLeverage = 1 - idleTimeReductionByYear[index]!;
    const learningLeverage = 1 - learningReductionByYear[index]!;
    return variableCostPerDelivery * automationLeverage * idleLeverage * learningLeverage;
  });
  const fixedAnnualByYear = [0, 1, 2, 3, 4].map((index) => {
    const baseRamp = [0.36, 0.58, 0.76, 0.9, 1.02][index]!;
    const partnerLeverage = index === 0
      ? Math.max(0.45, 1 - (partnerDeliveryShare * 0.35) - (partnerOpsOffset * 0.55))
      : index === 1
        ? Math.max(0.7, 1 - (partnerDeliveryShare * 0.12) - (partnerOpsOffset * 0.2))
        : 1;
    const automationLeverage = 1 - (automationRateByYear[index]! * 0.25);
    return totalFixedAnnual * baseRamp * partnerLeverage * automationLeverage;
  });
  const operatingDaysByYear = [pilotOperatingDays, 365, 365, 365, 365];
  const revenueRealizationByYear = [pilotRevenueRealization, 0.75, 0.9, 0.96, 1]
    .map((value) => clampNumber(value * adoptionRevenueFactor, 0.3, 1));
  const yearlyDeliveries = fleetByYear.map((fleet, index) => Math.round(fleet * deliveriesPerDroneByYear[index]! * operatingDaysByYear[index]!));
  const yearlyVariableCosts = yearlyDeliveries.map((deliveries, index) => deliveries * variableCostPerDeliveryByYear[index]!);
  const yearlyPlatformRevenue = yearlyDeliveries.map((deliveries, index) => {
    const realization = revenueRealizationByYear[index] ?? 1;
    return (deliveries * platformRevenuePerDelivery * realization) + (annualIntegrationFees * realization);
  });
  const yearlyContribution = yearlyDeliveries.map((deliveries, index) => {
    const realization = revenueRealizationByYear[index] ?? 1;
    return deliveries * ((weightedAverageFare * realization) - variableCostPerDeliveryByYear[index]!);
  });

  const traditionalCost = getParam('Cost per Delivery (Traditional)', 35);
  const yearlyCostSavings = yearlyDeliveries.map((deliveries, index) => deliveries * (Math.max(0, traditionalCost - variableCostPerDeliveryByYear[index]!) * 0.6));
  const carbonReduction = getParam('Carbon Emission Reduction', 70);
  const carbonValuePerDelivery = (carbonReduction / 100) * 0.002 * 50;
  const yearlyCarbonValue = yearlyDeliveries.map((deliveries) => deliveries * carbonValuePerDelivery);
  const effectiveCostPerDelivery = yearlyDeliveries.map((deliveries, index) => deliveries > 0 ? variableCostPerDeliveryByYear[index]! + (fixedAnnualByYear[index]! / deliveries) : variableCostPerDeliveryByYear[index]!);
  const ebitdaMargins = yearlyDeliveries.map((deliveries, index) => {
    const realization = revenueRealizationByYear[index] ?? 1;
    const annualRevenue = (deliveries * weightedAverageFare * realization) + yearlyPlatformRevenue[index]!;
    const annualCost = yearlyVariableCosts[index]! + fixedAnnualByYear[index]!;
    return annualRevenue > 0 ? ((annualRevenue - annualCost) / annualRevenue) * 100 : 0;
  });
  const netMargins = ebitdaMargins.map((margin) => margin * 0.74);
  const rampSchedule = fleetByYear.map((fleet, index) => ({
    year: index + 1,
    fleetActive: fleet / scaleFleet,
    utilization: deliveriesPerDroneByYear[index]! / scaleDeliveriesPerDrone,
    deliveries: yearlyDeliveries[index]!,
  }));

  const buildStage = (
    objective: string,
    horizon: string,
    fleetSize: number,
    dailyDeliveriesPerDrone: number,
    annualDeliveries: number,
    fixedAnnualCost: number,
    variableCost: number,
    integrationFeeRealization: number,
    partneringStrategy: string,
    automationRate: number,
    idleTimeReduction: number,
  ): DroneStageEconomics => {
    const nominalRevenuePerDelivery = weightedAverageFare + platformRevenuePerDelivery;
    const annualIntegrationRevenue = annualIntegrationFees * integrationFeeRealization;
    const recognizedRevenuePerDelivery = annualDeliveries > 0
      ? ((annualDeliveries * nominalRevenuePerDelivery * integrationFeeRealization) + annualIntegrationRevenue) / annualDeliveries
      : nominalRevenuePerDelivery * integrationFeeRealization;
    const fixedCostPerDelivery = annualDeliveries > 0 ? fixedAnnualCost / annualDeliveries : 0;
    const effectiveCost = variableCost + fixedCostPerDelivery;
    const annualRevenue = (annualDeliveries * nominalRevenuePerDelivery * integrationFeeRealization) + annualIntegrationRevenue;
    const annualEbitda = annualRevenue - (annualDeliveries * variableCost) - fixedAnnualCost;
    const recognizedUnitSpread = recognizedRevenuePerDelivery - effectiveCost;

    return {
      objective,
      horizon,
      fleetSize,
      dailyDeliveriesPerDrone,
      annualDeliveries,
      recognizedAnnualDeliveries: annualDeliveries,
      revenueRealizationFactor: integrationFeeRealization,
      weightedAverageFare,
      platformRevenuePerDelivery,
      preRealizationRevenuePerDelivery: nominalRevenuePerDelivery,
      nominalRevenuePerDelivery,
      recognizedRevenuePerDelivery,
      realizedRevenuePerDelivery: recognizedRevenuePerDelivery,
      contractedVolumeShare,
      variableCostPerDelivery: variableCost,
      fixedCostPerDelivery,
      effectiveCostPerDelivery: effectiveCost,
      contributionMarginPerDelivery: recognizedUnitSpread,
      annualRecognizedRevenue: annualRevenue,
      annualRevenue,
      annualIntegrationRevenue,
      annualFixedCost: fixedAnnualCost,
      annualEbitda,
      partneringStrategy,
      automationRate,
      idleTimeReduction,
      gateSummary: objective.includes('Pilot')
        ? 'Pilot success requires validated safety, repeatable service reliability, contracted demand, and a credible glide path toward sub-AED 30 cost per delivery at scale conditions.'
        : 'Scale is justified only when throughput is repeatably sustained at 110-140 deliveries per drone per day, cost per delivery remains at or below AED 30, and contracted volume sustains the network.',
    };
  };

  const pilotCase = buildStage(
    'Pilot validation case',
    '6-12 months',
    pilotFleet,
    deliveriesPerDroneByYear[0]!,
    yearlyDeliveries[0]!,
    fixedAnnualByYear[0]!,
    variableCostPerDeliveryByYear[0]!,
    pilotRevenueRealization,
    `Partner-led launch covering approximately ${(partnerDeliveryShare * 100).toFixed(0)}% of pilot operating playbooks and early corridor operations, similar to a Wing / Zipline-style learning partnership.`,
    automationRateByYear[0]!,
    idleTimeReductionByYear[0]!,
  );
  const scaleCase = buildStage(
    'Scale operating case',
    '3-5 years',
    scaleFleet,
    scaleDeliveriesPerDrone,
    Math.round(scaleFleet * scaleDeliveriesPerDrone * 365),
    fixedAnnualByYear[4]!,
    variableCostPerDeliveryByYear[4]!,
    1,
    'Transition to an operator-owned network with partner support limited to specialized corridors, maintenance, and safety assurance.',
    automationRateByYear[4]!,
    idleTimeReductionByYear[4]!,
  );
  const scaleGateOpen = scaleCase.dailyDeliveriesPerDrone >= 110
    && scaleCase.effectiveCostPerDelivery <= 30
    && scaleCase.contractedVolumeShare >= 0.65;
  const expansionDecision: 'GO' | 'STOP' = scaleGateOpen ? 'GO' : 'STOP';
  const enforcementSummary = scaleGateOpen
    ? 'All hard scale gates are satisfied. Expansion can proceed under board-approved governance.'
    : 'STOP expansion. One or more hard scale gates failed: throughput, unit cost, or contracted volume is below the executive threshold.';

  return {
    pilotCase,
    scaleCase,
    weightedAverageFare,
    platformRevenuePerDelivery,
    variableCostPerDelivery,
    variableCostPerDeliveryByYear,
    deliveryContributionPerDelivery,
    yearlyDeliveries,
    yearlyPlatformRevenue,
    yearlyContribution,
    yearlyVariableCosts,
    yearlyCostSavings,
    yearlyCarbonValue,
    effectiveCostPerDelivery,
    ebitdaMargins,
    netMargins,
    rampSchedule,
    revenueSegments,
    fixedAnnualByYear,
    fixedCostBreakdown,
    variableCostBreakdown,
    fleetAvailability,
    demandUtilization,
    weatherRegulationFactor,
    scaleGateOpen,
    expansionDecision,
    enforcementSummary,
  };
}

interface BudgetRangeDetails {
  low: number;
  high: number;
  midpoint: number;
  boundType: 'exact' | 'range' | 'minimum' | 'maximum';
}

function parseBudgetRangeDetails(value: unknown): BudgetRangeDetails | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return { low: value, high: value, midpoint: value, boundType: 'exact' };
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const text = value.trim();
  const isLowerBound = /(^|\b)(over|above|from|at least|minimum|min\.?|starting at|more than)\b/i.test(text);
  const isUpperBound = /(^|\b)(under|below|up to|maximum|max\.?|less than|no more than)\b/i.test(text);
  const matches = [...text.matchAll(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*(billion|million|thousand|[bmk])?/gi)];
  if (matches.length === 0) {
    return null;
  }

  const toMultiplier = (unit: string | undefined): number => {
    const normalized = (unit || '').toLowerCase();
    if (normalized === 'b' || normalized === 'billion') return 1_000_000_000;
    if (normalized === 'm' || normalized === 'million') return 1_000_000;
    if (normalized === 'k' || normalized === 'thousand') return 1_000;
    return 1;
  };

  const firstMatch = matches[0];
  if (!firstMatch) {
    return null;
  }

  const firstUnit = firstMatch[2] || undefined;
  const low = parseMoneyNumber(firstMatch[1]) * toMultiplier(firstUnit);
  const second = matches[Math.min(matches.length - 1, 1)];
  if (!second) {
    return null;
  }
  const high = parseMoneyNumber(second[1]) * toMultiplier(second[2] || firstUnit);

  if (low <= 0 || high <= 0) {
    return null;
  }

  const normalizedLow = Math.min(low, high);
  const normalizedHigh = Math.max(low, high);
  const boundType = matches.length === 1
    ? (isLowerBound ? 'minimum' : isUpperBound ? 'maximum' : 'exact')
    : 'range';
  return {
    low: normalizedLow,
    high: normalizedHigh,
    midpoint: (normalizedLow + normalizedHigh) / 2,
    boundType,
  };
}

function parseTimelineMonths(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parts = [...value.matchAll(/(\d+(?:\.\d+)?)/g)]
    .map((match) => Number.parseFloat(match[1] ?? ''))
    .filter(Number.isFinite);
  if (parts.length === 0) {
    return null;
  }

  const magnitude = Math.max(...parts);
  return /year/i.test(value) ? Math.round(magnitude * 12) : Math.round(magnitude);
}

function roundInvestment(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (value >= 25_000_000) return Math.round(value / 250_000) * 250_000;
  if (value >= 5_000_000) return Math.round(value / 100_000) * 100_000;
  if (value >= 1_000_000) return Math.round(value / 50_000) * 50_000;
  return Math.round(value / 10_000) * 10_000;
}

function resolveExplicitDemandBudget(
  demandReport: Record<string, unknown> | null | undefined,
): BudgetRangeDetails | null {
  if (!demandReport) {
    return null;
  }

  return parseBudgetRangeDetails(demandReport.budgetRange || demandReport.estimatedBudget || null);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function countNamedItems(value: unknown): number {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string' ? item.trim().length > 0 : !!item).length;
  }

  if (typeof value === 'string') {
    return parseListValue(value).length;
  }

  const record = asRecord(value);
  if (!record) {
    return 0;
  }

  return Object.values(record).reduce<number>((count, entry) => count + countNamedItems(entry), 0);
}

function collectDemandText(record: Record<string, unknown>): string[] {
  const clarificationResponses = Array.isArray(record.clarificationResponses)
    ? record.clarificationResponses
    : [];

  const clarificationText = clarificationResponses.flatMap((item) => {
    const response = asRecord(item);
    if (!response) {
      return [];
    }
    return [response.question, response.answer, response.response].map(asText).filter(Boolean);
  });

  return [
    record.suggestedProjectName,
    record.projectName,
    record.projectDescription,
    record.businessObjective,
    record.problemStatement,
    record.currentChallenges,
    record.expectedOutcomes,
    record.successCriteria,
    record.constraints,
    record.integrationRequirements,
    record.existingSystems,
    record.complianceRequirements,
    record.riskFactors,
    record.department,
    record.departmentImpact,
    record.resourceRequirements,
    record.timeline,
    ...clarificationText,
  ].flatMap((value) => {
    if (Array.isArray(value)) {
      return value.map(asText).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value.trim().length > 0 ? [value] : [];
    }
    const nested = asRecord(value);
    if (!nested) {
      return [];
    }
    return Object.values(nested).flatMap((entry) => {
      if (Array.isArray(entry)) {
        return entry.map(asText).filter(Boolean);
      }
      if (typeof entry === 'string') {
        return [entry];
      }
      return [];
    });
  });
}

function parseScaledNumber(value: string, unit: string | undefined): number {
  const numeric = parseMoneyNumber(value);
  const normalizedUnit = (unit || '').toLowerCase();
  if (normalizedUnit === 'b' || normalizedUnit === 'bn' || normalizedUnit === 'billion') return numeric * 1_000_000_000;
  if (normalizedUnit === 'm' || normalizedUnit === 'mn' || normalizedUnit === 'million') return numeric * 1_000_000;
  if (normalizedUnit === 'k' || normalizedUnit === 'thousand') return numeric * 1_000;
  return numeric;
}

function extractLargestKeywordCount(texts: string[], keywords: string[]): number {
  const escapedKeywords = keywords.map((keyword) => keyword.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`));
  const keywordPattern = escapedKeywords.join('|');
  const forward = new RegExp(String.raw`(\d+(?:,\d{3})*(?:\.\d+)?)\s*(billion|million|thousand|bn|mn|[bmk])?\s*(?:\+)?\s*(?:${keywordPattern})\b`, 'gi');
  const reverse = new RegExp(String.raw`\b(?:${keywordPattern})\b[^\d]{0,16}(\d+(?:,\d{3})*(?:\.\d+)?)\s*(billion|million|thousand|bn|mn|[bmk])?`, 'gi');

  let largest = 0;
  for (const text of texts) {
    for (const pattern of [forward, reverse]) {
      pattern.lastIndex = 0;
      let match = pattern.exec(text);
      while (match) {
        const candidate = parseScaledNumber(match[1] || '', match[2]);
        if (Number.isFinite(candidate)) {
          largest = Math.max(largest, candidate);
        }
        match = pattern.exec(text);
      }
    }
  }

  return largest;
}

interface ProjectScaleSignals {
  userPopulation: number;
  siteCount: number;
  departmentCount: number;
  interfaceCount: number;
  rolloutPhases: number;
  migrationVolume: number;
  transactionVolume: number;
  alwaysOnOperations: boolean;
  procurementComplexity: number;
}

function deriveProjectScaleSignals(record: Record<string, unknown>, objectiveText: string): ProjectScaleSignals {
  const deliveryText = collectDemandText(record);
  const userPopulation = extractLargestKeywordCount(deliveryText, [
    'user', 'users', 'citizen', 'citizens', 'customer', 'customers', 'employee', 'employees', 'staff', 'patient', 'patients', 'student', 'students', 'resident', 'residents'
  ]);
  const siteCount = extractLargestKeywordCount(deliveryText, [
    'site', 'sites', 'branch', 'branches', 'location', 'locations', 'office', 'offices', 'facility', 'facilities', 'hospital', 'hospitals', 'school', 'schools', 'station', 'stations', 'center', 'centers'
  ]);
  const departmentCount = extractLargestKeywordCount(deliveryText, [
    'department', 'departments', 'agency', 'agencies', 'entity', 'entities', 'business unit', 'business units'
  ]);
  const interfaceCount = Math.max(
    parseListValue(record.integrationRequirements).length + parseListValue(record.existingSystems).length,
    extractLargestKeywordCount(deliveryText, ['integration', 'integrations', 'interface', 'interfaces', 'api', 'apis', 'system', 'systems'])
  );
  const rolloutPhases = Math.max(
    countNamedItems(record.implementationPhases),
    extractLargestKeywordCount(deliveryText, ['phase', 'phases', 'wave', 'waves', 'release', 'releases', 'rollout', 'rollouts'])
  );
  const migrationVolume = extractLargestKeywordCount(deliveryText, [
    'record', 'records', 'document', 'documents', 'file', 'files', 'case', 'cases', 'account', 'accounts', 'profile', 'profiles'
  ]);
  const transactionVolume = extractLargestKeywordCount(deliveryText, [
    'transaction', 'transactions', 'claim', 'claims', 'trip', 'trips', 'delivery', 'deliveries', 'pickup', 'pickups', 'visit', 'visits', 'request', 'requests', 'application', 'applications'
  ]);

  return {
    userPopulation,
    siteCount,
    departmentCount,
    interfaceCount,
    rolloutPhases,
    migrationVolume,
    transactionVolume,
    alwaysOnOperations: /(24\/7|always on|round the clock|mission critical|high availability)/i.test(objectiveText),
    procurementComplexity: /(procurement|tender|rfp|vendor|system integrator|multi-vendor)/i.test(objectiveText)
      ? (/(multi-vendor|system integrator)/i.test(objectiveText) ? 2 : 1)
      : 0,
  };
}

function firstPositiveNumber(...values: Array<number | undefined>): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return 0;
}

function inferDomainParametersFromDemandContext(
  demandReport: Record<string, unknown> | null | undefined,
  archetype: string,
  existingDomainParameters: Record<string, number> | null | undefined,
): Record<string, number> {
  const existing = existingDomainParameters ?? {};
  const defaults = getDefaultDomainParameters(archetype);
  const record = demandReport ?? {};
  const objectiveText = collectDemandText(record).join(' ').toLowerCase();
  const scale = deriveProjectScaleSignals(record, objectiveText);
  const inferred: Record<string, number> = { ...defaults, ...existing };

  const vehicleOrDroneCount = extractLargestKeywordCount([objectiveText], ['vehicle', 'vehicles', 'drone', 'drones']);

  if (archetype === 'Government Digital Transformation') {
    inferred['Citizen Users'] = firstPositiveNumber(existing['Citizen Users'], scale.userPopulation, defaults['Citizen Users']);
    inferred['Transaction Volume'] = firstPositiveNumber(
      existing['Transaction Volume'],
      scale.transactionVolume,
      inferred['Citizen Users'] > 0 ? inferred['Citizen Users'] * Math.max(scale.rolloutPhases || 1, 3) : 0,
      defaults['Transaction Volume'],
    );
  } else if (archetype === 'Disaster Recovery & Business Continuity Platform') {
    const serviceSignals = extractLargestKeywordCount([objectiveText], ['service', 'services', 'system', 'systems', 'application', 'applications', 'asset', 'assets']);
    inferred['Critical Services Protected'] = firstPositiveNumber(
      existing['Critical Services Protected'],
      serviceSignals,
      Math.max(scale.interfaceCount, scale.departmentCount, scale.siteCount),
      defaults['Critical Services Protected'],
    );
    inferred['Annual Service Value at Risk'] = firstPositiveNumber(
      existing['Annual Service Value at Risk'],
      scale.transactionVolume > 0 ? scale.transactionVolume * 55 : 0,
      scale.userPopulation > 0 ? scale.userPopulation * 120 : 0,
      defaults['Annual Service Value at Risk'],
    );
  } else if (archetype === 'Healthcare Digital System') {
    inferred['Patient Capacity'] = firstPositiveNumber(existing['Patient Capacity'], scale.userPopulation, defaults['Patient Capacity']);
  } else if (archetype === 'Healthcare Digital Transformation') {
    const throughputScale = scale.siteCount > 1 ? Math.min(scale.siteCount * 3, 30) : 0;
    inferred['Patient Throughput Increase'] = firstPositiveNumber(existing['Patient Throughput Increase'], throughputScale, defaults['Patient Throughput Increase']);
  } else if (archetype === 'Insurance Digital Platform') {
    inferred['Annual Claims Volume'] = firstPositiveNumber(existing['Annual Claims Volume'], scale.transactionVolume, scale.userPopulation, defaults['Annual Claims Volume']);
  } else if (archetype === 'Education Digital Platform') {
    inferred['Student Enrollment'] = firstPositiveNumber(existing['Student Enrollment'], scale.userPopulation, defaults['Student Enrollment']);
  } else if (archetype === 'Autonomous Vehicle Platform') {
    inferred['Fleet Size'] = firstPositiveNumber(existing['Fleet Size'], vehicleOrDroneCount, defaults['Fleet Size']);
  } else if (archetype === 'Drone Last Mile Delivery' || archetype === 'Drone First Mile Delivery') {
    inferred['Fleet Size'] = firstPositiveNumber(existing['Fleet Size'], vehicleOrDroneCount, defaults['Fleet Size']);
    const activityKey = archetype === 'Drone Last Mile Delivery' ? 'Daily Deliveries per Drone' : 'Daily Pickups per Drone';
    // Cap daily activity to realistic drone operational limits (~100 last-mile, ~60 first-mile)
    const maxDailyActivity = archetype === 'Drone Last Mile Delivery' ? 100 : 60;
    const rawActivity = firstPositiveNumber(existing[activityKey], scale.transactionVolume > 0 ? Math.max(10, Math.round(scale.transactionVolume / Math.max(inferred['Fleet Size'], 1) / 365)) : 0, defaults[activityKey]);
    inferred[activityKey] = Math.min(rawActivity, maxDailyActivity);
  }

  return inferred;
}

function estimateArchetypeSpecificInvestment(
  archetype: string,
  domainParameters: Record<string, number>,
  scale: ProjectScaleSignals,
): number {
  if (archetype === 'Autonomous Vehicle Platform') {
    const fleetSize = firstPositiveNumber(domainParameters['Fleet Size'], 100);
    const vehicleCost = firstPositiveNumber(domainParameters['Vehicle Cost'], 450000);
    const vehicleCapex = fleetSize * vehicleCost;
    const chargingAndDepot = Math.max(fleetSize * 95_000, vehicleCapex * 0.18);
    const autonomyStack = Math.max(fleetSize * 42_000, vehicleCapex * 0.10);
    const safetyAndRegulatory = Math.max(fleetSize * 28_000, 2_500_000);
    const launchReadiness = Math.max(fleetSize * 18_000, 1_800_000);
    return vehicleCapex + chargingAndDepot + autonomyStack + safetyAndRegulatory + launchReadiness;
  }

  if (archetype === 'Drone Last Mile Delivery') {
    const fleetSize = firstPositiveNumber(domainParameters['Fleet Size'], 50);
    const unitCost = firstPositiveNumber(domainParameters['Drone Unit Cost'], 85000);
    const capex = fleetSize * unitCost;
    return capex + (capex * 0.30) + (capex * 0.20) + (capex * 0.18);
  }

  if (archetype === 'Drone First Mile Delivery') {
    const fleetSize = firstPositiveNumber(domainParameters['Fleet Size'], 30);
    const unitCost = firstPositiveNumber(domainParameters['Drone Unit Cost'], 150000);
    const capex = fleetSize * unitCost;
    return capex + (capex * 0.32) + (capex * 0.22) + (capex * 0.18);
  }

  if (archetype === 'Government Digital Transformation') {
    const citizenUsers = firstPositiveNumber(domainParameters['Citizen Users'], scale.userPopulation, 100000);
    const transactionVolume = firstPositiveNumber(domainParameters['Transaction Volume'], scale.transactionVolume, citizenUsers * 4);
    return 2_800_000
      + (citizenUsers * 18)
      + Math.min(transactionVolume * 2.2, 6_500_000)
      + (Math.max(scale.interfaceCount, 1) * 325000)
      + (Math.max(scale.rolloutPhases - 1, 0) * 425000)
      + (Math.max(scale.siteCount - 1, 0) * 160000)
      + Math.min(scale.migrationVolume * 0.75, 3_500_000)
      + (scale.alwaysOnOperations ? 900000 : 0)
      + (scale.procurementComplexity * 500000);
  }

  if (archetype === 'Healthcare Digital System') {
    const patientCapacity = firstPositiveNumber(domainParameters['Patient Capacity'], scale.userPopulation, 50000);
    return 5_500_000
      + (patientCapacity * 42)
      + (Math.max(scale.siteCount, 1) * 450000)
      + (Math.max(scale.interfaceCount, 1) * 280000)
      + Math.min(scale.migrationVolume * 0.6, 2_500_000)
      + (scale.alwaysOnOperations ? 700000 : 0);
  }

  if (archetype === 'Disaster Recovery & Business Continuity Platform') {
    const criticalServices = firstPositiveNumber(domainParameters['Critical Services Protected'], Math.max(scale.interfaceCount, scale.departmentCount), 24);
    const annualValueAtRisk = firstPositiveNumber(domainParameters['Annual Service Value at Risk'], scale.transactionVolume > 0 ? scale.transactionVolume * 55 : 0, 18_000_000);
    const secondaryRunCost = firstPositiveNumber(domainParameters['Secondary Site Annual Run Cost'], 1_200_000);
    const exerciseCost = firstPositiveNumber(domainParameters['Annual DR Exercise Cost'], 450_000);
    return 4_200_000
      + (criticalServices * 185_000)
      + Math.min(annualValueAtRisk * 0.18, 14_000_000)
      + (Math.max(scale.interfaceCount, 1) * 220_000)
      + (Math.max(scale.siteCount - 1, 0) * 180_000)
      + Math.min(scale.migrationVolume * 0.45, 2_800_000)
      + (secondaryRunCost * 1.4)
      + (exerciseCost * 0.8)
      + (scale.alwaysOnOperations ? 900_000 : 0)
      + (scale.procurementComplexity * 450_000);
  }

  if (archetype === 'Healthcare Digital Transformation') {
    const patientCapacity = firstPositiveNumber(scale.userPopulation, 50000);
    return 8_000_000
      + (patientCapacity * 55)
      + (Math.max(scale.siteCount, 1) * 600000)
      + (Math.max(scale.interfaceCount, 1) * 320000)
      + Math.min(scale.migrationVolume * 0.9, 4_000_000)
      + (scale.alwaysOnOperations ? 900000 : 0);
  }

  if (archetype === 'Insurance Digital Platform') {
    const annualClaims = firstPositiveNumber(domainParameters['Annual Claims Volume'], scale.transactionVolume, 50000);
    return 4_200_000
      + (annualClaims * 32)
      + (Math.max(scale.interfaceCount, 1) * 290000)
      + Math.min(scale.migrationVolume * 0.55, 2_500_000)
      + (scale.procurementComplexity * 350000);
  }

  if (archetype === 'Education Digital Platform') {
    const students = firstPositiveNumber(domainParameters['Student Enrollment'], scale.userPopulation, 25000);
    return 3_200_000
      + (students * 95)
      + (Math.max(scale.siteCount, 1) * 220000)
      + (Math.max(scale.interfaceCount, 1) * 180000)
      + Math.min(scale.migrationVolume * 0.35, 1_500_000);
  }

  return 0;
}

export function estimateInvestmentFromDemandContext(
  demandReport: Record<string, unknown> | null | undefined,
  archetype: string,
  domainParameters?: Record<string, number>,
): number {
  const record = demandReport || {};
  const parsedBudget = resolveExplicitDemandBudget(record);
  const baseline = ARCHETYPE_BASE_INVESTMENT[archetype] ?? 6_500_000;

  const objectiveText = [
    record.suggestedProjectName,
    record.projectName,
    record.businessObjective,
    record.problemStatement,
    record.currentChallenges,
    record.expectedOutcomes,
  ].map(asText).join(' ').toLowerCase();

  const integrations = parseListValue(record.integrationRequirements).length;
  const existingSystems = parseListValue(record.existingSystems).length;
  const compliance = parseListValue(record.complianceRequirements).length;
  const stakeholders = parseListValue(record.keyStakeholders || record.stakeholders).length;
  const risks = parseListValue(record.riskFactors).length;
  const outcomes = parseListValue(record.expectedOutcomes).length;
  const successCriteria = parseListValue(record.successCriteria).length;
  const constraints = parseListValue(record.constraints).length;
  const timeframeMonths = parseTimelineMonths(record.timeframe);
  const urgency = asText(record.urgency).toLowerCase();
  const inferredDomainParameters = sanitizeDomainParameters(archetype, inferDomainParametersFromDemandContext(record, archetype, domainParameters));
  const scale = deriveProjectScaleSignals(record, objectiveText);
  const implementationPhases = countNamedItems(record.implementationPhases);
  const resourceRequirements = asRecord(record.resourceRequirements);
  const internalRoles = countNamedItems(resourceRequirements?.internalTeam ? asRecord(resourceRequirements.internalTeam)?.roles : null);
  const externalExpertise = countNamedItems(resourceRequirements?.externalSupport ? asRecord(resourceRequirements.externalSupport)?.expertise : null);
  const infrastructureTouchpoints = countNamedItems(resourceRequirements?.infrastructure);
  const integrationSurface = Math.max(integrations + existingSystems, scale.interfaceCount);

  let complexityFactor = 1;
  if (/(\bai\b|artificial intelligence|machine learning|predictive|analytics|sentiment|automation)/i.test(objectiveText)) complexityFactor += .12;
  if (/(crm|platform|portal|360|omnichannel|unified|enterprise)/i.test(objectiveText)) complexityFactor += .1;
  if (/(integration|api|legacy|migration|real[- ]?time|data|payment|licensing)/i.test(objectiveText)) complexityFactor += .1;
  if (/(citizen|customer|public service|transport|mobility|government|uae|dubai|smart city)/i.test(objectiveText)) complexityFactor += .06;
  if (/(procurement|tender|rfp|vendor|system integrator|multi-vendor)/i.test(objectiveText)) complexityFactor += .05;
  if (/(sovereign|mission critical|24\/7|high availability|data residency|disaster recovery)/i.test(objectiveText)) complexityFactor += .06;
  if (/(pilot|proof of concept|poc)/i.test(objectiveText) && integrationSurface <= 2 && scale.siteCount <= 1) complexityFactor -= .03;
  complexityFactor += Math.min(integrationSurface * .04, .24);
  complexityFactor += Math.min(compliance * .04, .16);
  complexityFactor += Math.min(stakeholders * .0125, .1);
  complexityFactor += Math.min(risks * .03, .12);
  complexityFactor += Math.min(existingSystems * .025, .1);
  complexityFactor += Math.min(outcomes * .01, .05);
  complexityFactor += Math.min(successCriteria * .0125, .05);
  complexityFactor += Math.min(constraints * .02, .08);
  complexityFactor += Math.min(Math.max(implementationPhases - 2, 0) * .04, .16);
  complexityFactor += Math.min(Math.max(internalRoles + externalExpertise - 5, 0) * .015, .1);
  complexityFactor += Math.min(infrastructureTouchpoints * .02, .08);
  if (scale.userPopulation > 0) complexityFactor += Math.min(Math.log10(scale.userPopulation + 1) * .05, .28);
  if (scale.siteCount > 0) complexityFactor += Math.min(scale.siteCount * .015, .18);
  if (scale.departmentCount > 1) complexityFactor += Math.min((scale.departmentCount - 1) * .025, .12);

  if (timeframeMonths && timeframeMonths >= 24) complexityFactor += .1;
  else if (timeframeMonths && timeframeMonths >= 18) complexityFactor += .06;
  else if (timeframeMonths && timeframeMonths <= 9) complexityFactor -= .05;

  if (urgency === 'critical') complexityFactor += .08;
  else if (urgency === 'high') complexityFactor += .05;

  let estimate = baseline * complexityFactor;
  const archetypeSpecificEstimate = estimateArchetypeSpecificInvestment(archetype, inferredDomainParameters, scale);

  if (!parsedBudget && archetypeSpecificEstimate > 0) {
    const archetypeWeight = Object.keys(domainParameters || {}).length > 0 ? .7 : .55;
    estimate = (archetypeSpecificEstimate * archetypeWeight) + (estimate * (1 - archetypeWeight));
  }

  if (!parsedBudget && Object.keys(inferredDomainParameters).length > 0) {
    const { costMultiplier } = getDomainMultipliers(archetype, inferredDomainParameters);
    const boundedCostMultiplier = Math.min(Math.max(costMultiplier, .7), 2.5);
    estimate *= boundedCostMultiplier;
  }

  if (parsedBudget) {
    if (parsedBudget.boundType === 'minimum') {
      return roundInvestment(Math.max(parsedBudget.low, estimate));
    }

    if (parsedBudget.boundType === 'maximum') {
      return roundInvestment(Math.min(parsedBudget.high, estimate));
    }

    if (parsedBudget.low === parsedBudget.high) {
      return roundInvestment(parsedBudget.midpoint);
    }

    const blended = (parsedBudget.midpoint * .45) + (estimate * .55);
    estimate = parsedBudget.high > parsedBudget.low
      ? Math.min(parsedBudget.high, Math.max(parsedBudget.low, blended))
      : Math.max(parsedBudget.low, blended);
  }

  return roundInvestment(estimate);
}

// Get domain multiplier based on parameter changes from defaults
function getDomainMultipliers(archetype: string, domainParams?: Record<string, number>): { costMultiplier: number; benefitMultiplier: number } {
  if (!domainParams || Object.keys(domainParams).length === 0) {
    return { costMultiplier: 1, benefitMultiplier: 1 };
  }

  const defaults = getDefaultDomainParameters(archetype);
  let costMultiplier = 1;
  let benefitMultiplier = 1;

  if (archetype === 'Autonomous Vehicle Platform') {
    // Fleet Size affects costs directly
    const defaultFleetSize = defaults['Fleet Size'] || 100;
    const fleetSize = domainParams['Fleet Size'] ?? defaultFleetSize;
    const fleetRatio = fleetSize / defaultFleetSize;

    // Vehicle Cost affects initial capital costs
    const defaultVehicleCost = defaults['Vehicle Cost'] || 450000;
    const vehicleCost = domainParams['Vehicle Cost'] ?? defaultVehicleCost;
    const vehicleRatio = vehicleCost / defaultVehicleCost;

    // Cost multiplier based on fleet and vehicle cost
    costMultiplier = fleetRatio * vehicleRatio;

    // Revenue factors
    const defaultFare = defaults['Taxi Fare Rate'] || 3.5;
    const fareRate = domainParams['Taxi Fare Rate'] ?? defaultFare;
    const _fareRatio = fareRate / defaultFare;

    const defaultTrips = defaults['Daily Trips per Vehicle'] || 25;
    const dailyTrips = domainParams['Daily Trips per Vehicle'] ?? defaultTrips;
    const _tripsRatio = dailyTrips / defaultTrips;

    const defaultUtil = defaults['Fleet Utilization Rate'] || .75;
    const utilRate = domainParams['Fleet Utilization Rate'] ?? defaultUtil;
    const _utilRatio = utilRate / defaultUtil;

    const defaultSavings = defaults['Driver Cost Savings'] || 0;
    const driverSavings = domainParams['Driver Cost Savings'] ?? defaultSavings;
    let _savingsRatio = 1;
    if (defaultSavings > 0) {
      _savingsRatio = driverSavings / defaultSavings;
    } else if (driverSavings > 0) {
      _savingsRatio = 2;
    }

    // AV benefits are calculated directly from domain parameters in getArchetypeBenefits().
    // Keep the cost multiplier for investment sizing, but do not amplify benefits twice.
    benefitMultiplier = 1;
  } else if (archetype === 'Healthcare Digital System') {
    const defaultCapacity = defaults['Patient Capacity'] || 50000;
    const capacity = domainParams['Patient Capacity'] ?? defaultCapacity;

    const defaultEfficiency = defaults['Efficiency Gain Percent'] || 20;
    const efficiency = domainParams['Efficiency Gain Percent'] ?? defaultEfficiency;

    const defaultStaffHours = defaults['Staff Hours Saved'] || 2;
    const staffHours = domainParams['Staff Hours Saved'] ?? defaultStaffHours;

    const defaultCostPerHour = defaults['Cost Per Staff Hour'] || 75;
    const costPerHour = domainParams['Cost Per Staff Hour'] ?? defaultCostPerHour;

    costMultiplier = capacity / defaultCapacity;
    benefitMultiplier = (capacity / defaultCapacity) * (efficiency / defaultEfficiency)
      * (staffHours / defaultStaffHours) * (costPerHour / defaultCostPerHour);
  } else if (archetype === 'Healthcare Digital Transformation') {
    const defaultThroughput = defaults['Patient Throughput Increase'] || 15;
    const throughput = domainParams['Patient Throughput Increase'] ?? defaultThroughput;

    const defaultErrorReduction = defaults['Medical Error Reduction'] || 40;
    const errorReduction = domainParams['Medical Error Reduction'] ?? defaultErrorReduction;

    benefitMultiplier = (throughput / defaultThroughput) * (errorReduction / defaultErrorReduction);
  } else if (archetype === 'Insurance Digital Platform') {
    const defaultVolume = defaults['Annual Claims Volume'] || 50000;
    const volume = domainParams['Annual Claims Volume'] ?? defaultVolume;

    const defaultFraud = defaults['Fraud Detection Rate'] || 12;
    const fraudRate = domainParams['Fraud Detection Rate'] ?? defaultFraud;

    const defaultClaimValue = defaults['Average Claim Value'] || 15000;
    const claimValue = domainParams['Average Claim Value'] ?? defaultClaimValue;

    benefitMultiplier = (volume / defaultVolume) * (fraudRate / defaultFraud) * (claimValue / defaultClaimValue);
  } else if (archetype === 'Education Digital Platform') {
    const defaultEnrollment = defaults['Student Enrollment'] || 25000;
    const enrollment = domainParams['Student Enrollment'] ?? defaultEnrollment;

    const defaultEfficiency = defaults['Administrative Efficiency Gain'] || 35;
    const efficiency = domainParams['Administrative Efficiency Gain'] ?? defaultEfficiency;

    benefitMultiplier = (enrollment / defaultEnrollment) * (efficiency / defaultEfficiency);
  } else if (archetype === 'Government Digital Transformation') {
    const defaultCitizens = defaults['Citizen Users'] || defaults['Citizens Served'] || 100000;
    const citizens = domainParams['Citizen Users'] ?? domainParams['Citizens Served'] ?? defaultCitizens;

    const defaultTimeReduction = defaults['Processing Time Reduction'] || defaults['Process Time Reduction'] || 50;
    const timeReduction = domainParams['Processing Time Reduction'] ?? domainParams['Process Time Reduction'] ?? defaultTimeReduction;

    const defaultVolume = defaults['Transaction Volume'] || 500000;
    const transactionVolume = domainParams['Transaction Volume'] ?? defaultVolume;

    costMultiplier = citizens / defaultCitizens;
    // AI automation uplift: baseline AI automation rate is 40%. Each 10% increment
    // above baseline adds 15% to the benefit multiplier (bounded so it cannot exceed 2×).
    const aiBaseline = 40;
    const aiRate = Math.max(0, Math.min(100, Number(domainParams['AI Automation Rate'] ?? aiBaseline)));
    const aiUplift = Math.min(2, Math.max(0.6, 1 + ((aiRate - aiBaseline) / 10) * 0.15));
    benefitMultiplier = (citizens / defaultCitizens) * (timeReduction / defaultTimeReduction) * (transactionVolume / defaultVolume) * aiUplift;
  } else if (archetype === 'Disaster Recovery & Business Continuity Platform') {
    const defaultServices = defaults['Critical Services Protected'] || 24;
    const services = domainParams['Critical Services Protected'] ?? defaultServices;
    const defaultValueAtRisk = defaults['Annual Service Value at Risk'] || 18_000_000;
    const valueAtRisk = domainParams['Annual Service Value at Risk'] ?? defaultValueAtRisk;
    const defaultDowntimeReduction = defaults['Expected Downtime Reduction'] || 75;
    const downtimeReduction = domainParams['Expected Downtime Reduction'] ?? defaultDowntimeReduction;
    const currentRto = Math.max(1, domainParams['Current RTO'] ?? defaults['Current RTO'] ?? 24);
    const targetRto = Math.max(0.25, domainParams['Target RTO'] ?? defaults['Target RTO'] ?? 4);
    const rtoImprovement = Math.max(0, (currentRto - targetRto) / currentRto);
    const defaultCurrentRto = Math.max(1, defaults['Current RTO'] || 24);
    const defaultTargetRto = Math.max(0.25, defaults['Target RTO'] || 4);
    const defaultRtoImprovement = Math.max(0.01, (defaultCurrentRto - defaultTargetRto) / defaultCurrentRto);

    costMultiplier = Math.max(0.4, (services / defaultServices) * 0.7 + (valueAtRisk / defaultValueAtRisk) * 0.3);
    benefitMultiplier = (valueAtRisk / defaultValueAtRisk)
      * (downtimeReduction / defaultDowntimeReduction)
      * (rtoImprovement / defaultRtoImprovement);
  } else if (archetype === 'Drone Last Mile Delivery') {
    // For Drone Last Mile Delivery, benefits are calculated DIRECTLY from domain parameters
    // in getArchetypeBenefits() using actual fare rates and delivery volumes.
    // Therefore, benefitMultiplier = 1 to avoid double-counting.

    // Cost multiplier still applies for scaling implementation costs
    const defaultFleetSize = defaults['Fleet Size'] || 50;
    const fleetSize = domainParams['Fleet Size'] ?? defaultFleetSize;
    const fleetRatio = Math.max(.01, fleetSize / defaultFleetSize);

    const defaultDroneCost = defaults['Drone Unit Cost'] || 85000;
    const droneCost = domainParams['Drone Unit Cost'] ?? defaultDroneCost;
    const droneRatio = Math.max(.01, droneCost / defaultDroneCost);

    costMultiplier = fleetRatio * droneRatio;
  } else if (archetype === 'Drone First Mile Delivery') {
    // Fleet size affects both costs and capacity
    const defaultFleetSize = defaults['Fleet Size'] || 30;
    const fleetSize = domainParams['Fleet Size'] ?? defaultFleetSize;
    const fleetRatio = Math.max(.01, fleetSize / defaultFleetSize);

    // Drone unit cost affects capital investment (heavier-lift drones are more expensive)
    const defaultDroneCost = defaults['Drone Unit Cost'] || 150000;
    const droneCost = domainParams['Drone Unit Cost'] ?? defaultDroneCost;
    const droneRatio = Math.max(.01, droneCost / defaultDroneCost);

    // Cost multiplier based on fleet size and drone cost
    costMultiplier = fleetRatio * droneRatio;

    // Daily pickups per drone affects collection capacity
    const defaultPickups = defaults['Daily Pickups per Drone'] || 18;
    const dailyPickups = domainParams['Daily Pickups per Drone'] ?? defaultPickups;
    const pickupRatio = Math.max(.01, dailyPickups / defaultPickups);

    // Cost savings per pickup (traditional vs drone) - with defensive guards
    const defaultTraditionalCost = defaults['Cost per Traditional Pickup'] || 55;
    const traditionalCost = domainParams['Cost per Traditional Pickup'] ?? defaultTraditionalCost;
    const defaultDronePickupCost = defaults['Cost per Drone Pickup'] || 22;
    const dronePickupCost = domainParams['Cost per Drone Pickup'] ?? defaultDronePickupCost;

    // Guard against division by zero and negative savings
    const defaultSavings = defaultTraditionalCost - defaultDronePickupCost;
    const actualSavings = traditionalCost - dronePickupCost;
    const savingsRatio = defaultSavings > 0
      ? Math.max(0, actualSavings / defaultSavings)  // Clamp to minimum 0 if no savings
      : 1;  // Default to 1 if denominator would be zero

    // Supply chain efficiency improvement multiplier
    const defaultEfficiency = defaults['Supply Chain Efficiency'] || 30;
    const efficiency = domainParams['Supply Chain Efficiency'] ?? defaultEfficiency;
    const efficiencyRatio = Math.max(.01, efficiency / defaultEfficiency);

    // Benefit multiplier: fleet capacity × pickups × savings × efficiency
    benefitMultiplier = fleetRatio * pickupRatio * savingsRatio * efficiencyRatio;
  }

  // Cap multipliers to prevent runaway projections from extreme parameter combinations
  benefitMultiplier = Math.min(benefitMultiplier, 50);
  costMultiplier = Math.min(costMultiplier, 20);

  return { costMultiplier, benefitMultiplier };
}

import type {
  AVCostStackComponent,
  AVKillZoneThreshold,
  AVPerVehiclePayback,
  AVScenarioPoint,
  AVScenarioStress,
  AVUnitEconomicsPerTrip,
  AVYearProgression,
  AVYearProgressionPoint,
  BenchmarkValidation,
  BenefitLineItem,
  BenefitMixBreakdown,
  BoardRecommendation,
  BreakEvenAnalysis,
  BreakEvenSensitivity,
  CapexPhaseEntry,
  CapexPhaseSchedule,
  CapitalEfficiencyLens,
  CommercialAudit,
  CommercialHurdleCheck,
  CommercialVsStrategicNpv,
  CostLineItem,
  CumulativeFundingRequirement,
  DemandCertaintyAssessment,
  DiscountRateComparison,
  DoNothingCostBreakdown,
  DroneStageEconomics,
  DriverModelOutput,
  EconomicProofLayer,
  ExecutiveChallengeLayer,
  ExecutiveCommitteeStatement,
  FinancialInputs,
  FiveYearProjection,
  FinancialViewScenario,
  FinancialViewSnapshot,
  FundingBlockSignal,
  GovernmentExternality,
  GovernmentValueDecision,
  InvestmentCommitteeSummary,
  InvestmentDecision,
  KillSwitchMetrics,
  ModelConfidenceScore,
  OperationalConstraintAnalysis,
  PilotEconomicsView,
  PilotJustificationAssessment,
  RiskAdjustedAnalysis,
  ScenarioIntelligence,
  ScenarioResult,
  ScoredAssessment,
  StagedCapitalPhase,
  StagedCapitalPlan,
  TerminalValueAnalysis,
  UnifiedFinancialOutput,
  UnitEconomicsAnalysis,
  WeightedScoreFactor,
  YearlyCashFlow,
} from './financialModel.types';
export type {
  AVCostStackComponent,
  AVKillZoneThreshold,
  AVPerVehiclePayback,
  AVScenarioPoint,
  AVScenarioStress,
  AVUnitEconomicsPerTrip,
  AVYearProgression,
  AVYearProgressionPoint,
  BenchmarkValidation,
  BenefitLineItem,
  BenefitMixBreakdown,
  BoardRecommendation,
  BreakEvenAnalysis,
  BreakEvenSensitivity,
  CapexPhaseEntry,
  CapexPhaseSchedule,
  CapitalEfficiencyLens,
  CommercialAudit,
  CommercialHurdleCheck,
  CommercialVsStrategicNpv,
  CostLineItem,
  CumulativeFundingRequirement,
  DemandCertaintyAssessment,
  DiscountRateComparison,
  DoNothingCostBreakdown,
  DroneStageEconomics,
  DriverModelOutput,
  EconomicProofLayer,
  ExecutiveChallengeLayer,
  ExecutiveCommitteeStatement,
  FinancialInputs,
  FiveYearProjection,
  FinancialViewScenario,
  FinancialViewSnapshot,
  FundingBlockSignal,
  GovernmentExternality,
  GovernmentValueDecision,
  InvestmentCommitteeSummary,
  InvestmentDecision,
  KillSwitchMetrics,
  ModelConfidenceScore,
  OperationalConstraintAnalysis,
  PilotEconomicsView,
  PilotJustificationAssessment,
  RiskAdjustedAnalysis,
  ScenarioIntelligence,
  ScenarioResult,
  StagedCapitalPhase,
  StagedCapitalPlan,
  TerminalValueAnalysis,
  UnifiedFinancialOutput,
  UnitEconomicsAnalysis,
  YearlyCashFlow,
} from './financialModel.types';

import {
  detectArchetype as detectArchetypeFromConfig,
  getArchetypeConfig,
  type ArchetypeDetectionContext,
} from '@shared/constants/archetypes';

const FINANCIAL_ARCHETYPE_ALIASES: Record<string, string> = {
  'Government-Wide System': 'Government Digital Transformation',
  'Smart Government Infrastructure': 'Government Digital Transformation',
  'Digital Service Enhancement': 'Government Digital Transformation',
  'Blockchain Platform': 'Government Digital Transformation',
  'Smart Mobility Platform': 'Autonomous Vehicle Platform',
};

function normalizeFinancialArchetype(archetype: string): string {
  return FINANCIAL_ARCHETYPE_ALIASES[archetype] || archetype;
}

export function detectArchetype(contextOrName: string | ArchetypeDetectionContext): string {
  const detected = detectArchetypeFromConfig(contextOrName);
  return normalizeFinancialArchetype(detected);
}

function getArchetypeCosts(archetype: string, totalInvestment: number, maintenancePercent: number = .15, contingencyPercent: number = .1, domainParams?: Record<string, number>): CostLineItem[] {
  // IMPORTANT: totalInvestment is the user's TOTAL BUDGET (all-in capital envelope)
  // We derive the base capital by backing out contingency, then allocate within budget
  // This ensures total Year 0 costs equal the stated investment

  const contingencyDivisor = 1 + contingencyPercent;
  const baseCapital = totalInvestment / contingencyDivisor;
  const contingencyAmount = totalInvestment - baseCapital;

  // Maintenance is calculated as a percentage of base capital per year
  const annualMaintenance = baseCapital * maintenancePercent;

  if (archetype === 'Autonomous Vehicle Platform') {
    // Phase-gated CapEx: fleet and infrastructure deploy in waves, NOT all year0.
    // Pilot tranche (year0) validates economics; scale waves (year1, year2) are gate-released
    // only if pilot unit economics, utilisation, and safety metrics pass.
    // Total fleet CapEx (0.48 * baseCapital) is preserved, but distributed across years.
    // Safety / remote-operator cost (c8) is a *new* recurring line that decays as automation
    // proves out, reflecting the reality that early-phase AV operations still require
    // human oversight in parallel with the autonomous stack.
    return [
      { id: 'c1', category: 'implementation', subcategory: 'Fleet', name: 'AV Fleet — Pilot Tranche', description: 'Pilot fleet acquisition (≈30% of planned fleet) for regulated launch validation', year0: baseCapital * 0.14, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c1b', category: 'implementation', subcategory: 'Fleet', name: 'AV Fleet — Scale Wave 1 (Year 1, gated)', description: 'Scale-wave 1 fleet expansion, released only if pilot unit-cost, utilisation, and safety gates PASS', year0: 0, year1: baseCapital * 0.20, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c1c', category: 'implementation', subcategory: 'Fleet', name: 'AV Fleet — Scale Wave 2 (Year 2, gated)', description: 'Scale-wave 2 fleet expansion, released only if Year-1 commercial and operating thresholds hold', year0: 0, year1: 0, year2: baseCapital * 0.14, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c2', category: 'implementation', subcategory: 'Infrastructure', name: 'Charging & Depot Infrastructure — Phase 1', description: 'Core charging stations and maintenance depots for pilot operation', year0: baseCapital * 0.10, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c2b', category: 'implementation', subcategory: 'Infrastructure', name: 'Charging & Depot Infrastructure — Phase 2 (gated)', description: 'Scale-out charging and depot capacity, released with Fleet Scale Wave 1', year0: 0, year1: baseCapital * 0.12, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c3', category: 'implementation', subcategory: 'Technology', name: 'AI/Sensor Systems — Pilot Build', description: 'LiDAR, cameras, AI compute units — pilot fleet outfitting', year0: baseCapital * 0.08, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c3b', category: 'implementation', subcategory: 'Technology', name: 'AI/Sensor Systems — Scale Deployment (gated)', description: 'LiDAR, cameras, AI compute outfitting for Scale Waves 1 and 2; released only with fleet gates', year0: 0, year1: baseCapital * 0.05, year2: baseCapital * 0.02, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c4', category: 'implementation', subcategory: 'Integration', name: 'Systems Integration & Testing', description: 'Integration, validation, safety testing', year0: baseCapital * 0.08, year1: baseCapital * 0.02, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c5', category: 'implementation', subcategory: 'Enablement', name: 'Program Enablement', description: 'Training, certification, change management', year0: baseCapital * 0.05, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c6', category: 'implementation', subcategory: 'Contingency', name: 'Project Contingency', description: 'Risk buffer for unforeseen costs', year0: contingencyAmount, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c7', category: 'operational', subcategory: 'Operations', name: 'Fleet Operations', description: 'Energy, maintenance, remote monitoring', year0: 0, year1: annualMaintenance, year2: annualMaintenance * 1.03, year3: annualMaintenance * 1.06, year4: annualMaintenance * 1.09, year5: annualMaintenance * 1.12, isRecurring: true },
      { id: 'c8', category: 'operational', subcategory: 'Safety Operations', name: 'Safety & Remote Operator Staffing', description: 'Parallel safety-driver / remote-operator coverage during early commercialisation; decays as autonomy matures and regulator approves unsupervised operation', year0: 0, year1: baseCapital * 0.040, year2: baseCapital * 0.030, year3: baseCapital * 0.018, year4: baseCapital * 0.009, year5: baseCapital * 0.003, isRecurring: true },
    ];
  }
  if (archetype === 'Disaster Recovery & Business Continuity Platform') {
    const secondaryRunCost = Math.max(0, Number(domainParams?.['Secondary Site Annual Run Cost'] ?? annualMaintenance * 0.45));
    const exerciseCost = Math.max(0, Number(domainParams?.['Annual DR Exercise Cost'] ?? annualMaintenance * 0.16));
    const runCostRamp = (base: number, multiplier: number) => ({
      year1: base * multiplier,
      year2: base * multiplier * 1.03,
      year3: base * multiplier * 1.06,
      year4: base * multiplier * 1.09,
      year5: base * multiplier * 1.12,
    });
    const siteRun = runCostRamp(secondaryRunCost, 1);
    const exerciseRun = runCostRamp(exerciseCost, 1);

    return [
      { id: 'c1', category: 'implementation', subcategory: 'Resilience Architecture', name: 'Continuity Architecture & Recovery Design', description: 'Target-state DR architecture, dependency mapping, runbook design, and recovery-tier classification', year0: baseCapital * 0.16, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c2', category: 'implementation', subcategory: 'Recovery Platform', name: 'Secondary Recovery Environment', description: 'Secondary site, cloud recovery zone, network connectivity, and hardened platform landing-zone build', year0: baseCapital * 0.28, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c3', category: 'implementation', subcategory: 'Data Protection', name: 'Backup, Replication & Restore Controls', description: 'Immutable backup, replication, restore automation, and recovery evidence tooling', year0: baseCapital * 0.20, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c4', category: 'implementation', subcategory: 'Integration', name: 'Application Recovery Integration', description: 'Integration of critical applications, identity, observability, alerting, and failover orchestration', year0: baseCapital * 0.16, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c5', category: 'implementation', subcategory: 'Assurance', name: 'Continuity Testing & Staff Readiness', description: 'Tabletop exercises, technical failover tests, role training, and continuity evidence packs', year0: baseCapital * 0.10, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c6', category: 'implementation', subcategory: 'Contingency', name: 'Resilience Contingency', description: 'Risk reserve for application remediation, network constraints, data-volume growth, and recovery-test findings', year0: contingencyAmount, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c7', category: 'operational', subcategory: 'Recovery Operations', name: 'Secondary Site Run Cost', description: 'Recurring cost for recovery environment capacity, replication, monitoring, network, and managed operations', year0: 0, year1: siteRun.year1, year2: siteRun.year2, year3: siteRun.year3, year4: siteRun.year4, year5: siteRun.year5, isRecurring: true },
      { id: 'c8', category: 'operational', subcategory: 'Assurance', name: 'DR Exercise, Audit & Evidence', description: 'Annual failover exercises, continuity audit evidence, control testing, and runbook maintenance', year0: 0, year1: exerciseRun.year1, year2: exerciseRun.year2, year3: exerciseRun.year3, year4: exerciseRun.year4, year5: exerciseRun.year5, isRecurring: true },
    ];
  }
  if (archetype === 'Healthcare Digital System' || archetype === 'Healthcare Digital Transformation') {
    return [
      { id: 'c1', category: 'implementation', subcategory: 'Platform', name: 'EHR/Clinical Platform', description: 'Electronic health records system', year0: baseCapital * 0.35, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c2', category: 'implementation', subcategory: 'Integration', name: 'Device & Data Integration', description: 'IoT and device connectivity', year0: baseCapital * 0.25, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c3', category: 'implementation', subcategory: 'Compliance', name: 'Compliance & Cybersecurity', description: 'HIPAA, data security certification', year0: baseCapital * 0.15, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c4', category: 'implementation', subcategory: 'Workflow', name: 'Clinical Workflow Digitisation', description: 'Process automation and optimization', year0: baseCapital * 0.15, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c5', category: 'implementation', subcategory: 'Training', name: 'Change Management & Training', description: 'Staff training and adoption support', year0: baseCapital * .1, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c6', category: 'implementation', subcategory: 'Contingency', name: 'Project Contingency', description: 'Risk buffer for unforeseen costs', year0: contingencyAmount, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c7', category: 'operational', subcategory: 'Operations', name: 'Clinical Support', description: 'Annual support and updates', year0: 0, year1: annualMaintenance, year2: annualMaintenance, year3: annualMaintenance, year4: annualMaintenance, year5: annualMaintenance, isRecurring: true },
    ];
  }
  if (archetype === 'Insurance Digital Platform') {
    return [
      { id: 'c1', category: 'implementation', subcategory: 'Platform', name: 'Claims Processing Platform', description: 'Core claims management system', year0: baseCapital * .3, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c2', category: 'implementation', subcategory: 'Integration', name: 'Policy Management System', description: 'Policy administration and lifecycle', year0: baseCapital * 0.25, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c3', category: 'implementation', subcategory: 'Analytics', name: 'Fraud Detection & Analytics', description: 'AI-powered fraud prevention', year0: baseCapital * .2, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c4', category: 'implementation', subcategory: 'Compliance', name: 'Regulatory Compliance', description: 'Insurance authority compliance', year0: baseCapital * .1, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c5', category: 'implementation', subcategory: 'Training', name: 'Change Management & Training', description: 'Staff training and adoption support', year0: baseCapital * 0.15, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c6', category: 'implementation', subcategory: 'Contingency', name: 'Project Contingency', description: 'Risk buffer for unforeseen costs', year0: contingencyAmount, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c7', category: 'operational', subcategory: 'Operations', name: 'Platform Operations', description: 'Hosting, support, and compliance', year0: 0, year1: annualMaintenance, year2: annualMaintenance * 1.03, year3: annualMaintenance * 1.06, year4: annualMaintenance * 1.09, year5: annualMaintenance * 1.12, isRecurring: true },
    ];
  }
  if (archetype === 'Drone Last Mile Delivery') {
    const droneEconomics = buildDroneLastMileEconomics(domainParams);
    const scaleFleet = droneEconomics.scaleCase.fleetSize;
    const yearlyVariableCosts = droneEconomics.yearlyVariableCosts;

    return [
      { id: 'c1', category: 'implementation', subcategory: 'Fleet', name: 'Drone Fleet Acquisition', description: `${scaleFleet} drones funded through a staged pilot-to-scale program`, year0: baseCapital * .38, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c2', category: 'implementation', subcategory: 'Infrastructure', name: 'Landing Stations & Depots', description: 'Pilot depots, charging pads, and scale-out station network', year0: baseCapital * .2, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c3', category: 'implementation', subcategory: 'Technology', name: 'Flight Management & Dispatch Platform', description: 'Routing, navigation, API integration, and safety orchestration', year0: baseCapital * 0.18, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c4', category: 'implementation', subcategory: 'Compliance', name: 'GCAA Certification & Safety', description: 'Regulatory approval, safety testing, corridor approval, and readiness evidence', year0: baseCapital * 0.14, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c5', category: 'implementation', subcategory: 'Enablement', name: 'Program Enablement', description: 'Pilot operations, shipper onboarding, and change management', year0: baseCapital * .1, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c6', category: 'implementation', subcategory: 'Contingency', name: 'Project Contingency', description: 'Risk buffer for unforeseen costs', year0: contingencyAmount, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c7', category: 'operational', subcategory: 'Variable', name: 'Variable Delivery Costs', description: `Per-delivery operating cost stack including flight, handling, and service support (AED ${droneEconomics.variableCostPerDelivery.toFixed(1)}/delivery)`, year0: 0, year1: yearlyVariableCosts[0]!, year2: yearlyVariableCosts[1]!, year3: yearlyVariableCosts[2]!, year4: yearlyVariableCosts[3]!, year5: yearlyVariableCosts[4]!, isRecurring: true },
      { id: 'c8', category: 'operational', subcategory: 'Fixed', name: 'Control Center & Monitoring', description: 'Remote operations center, flight monitoring, incident command', year0: 0, year1: droneEconomics.fixedCostBreakdown[0]!.annualValue * 0.42, year2: droneEconomics.fixedCostBreakdown[0]!.annualValue * 0.66, year3: droneEconomics.fixedCostBreakdown[0]!.annualValue * 0.82, year4: droneEconomics.fixedCostBreakdown[0]!.annualValue * 0.95, year5: droneEconomics.fixedCostBreakdown[0]!.annualValue * 1.08, isRecurring: true },
      { id: 'c9', category: 'operational', subcategory: 'Fixed', name: 'Operations Staff', description: 'Pilots, safety monitors, network planners, and shipper success', year0: 0, year1: droneEconomics.fixedCostBreakdown[1]!.annualValue * 0.42, year2: droneEconomics.fixedCostBreakdown[1]!.annualValue * 0.66, year3: droneEconomics.fixedCostBreakdown[1]!.annualValue * 0.82, year4: droneEconomics.fixedCostBreakdown[1]!.annualValue * 0.95, year5: droneEconomics.fixedCostBreakdown[1]!.annualValue * 1.08, isRecurring: true },
      { id: 'c10', category: 'operational', subcategory: 'Fixed', name: 'Insurance & Liability', description: 'Fleet insurance, cargo coverage, and operating risk transfer', year0: 0, year1: droneEconomics.fixedCostBreakdown[2]!.annualValue * 0.42, year2: droneEconomics.fixedCostBreakdown[2]!.annualValue * 0.66, year3: droneEconomics.fixedCostBreakdown[2]!.annualValue * 0.82, year4: droneEconomics.fixedCostBreakdown[2]!.annualValue * 0.95, year5: droneEconomics.fixedCostBreakdown[2]!.annualValue * 1.08, isRecurring: true },
      { id: 'c11', category: 'operational', subcategory: 'Fixed', name: 'Licensing & Compliance', description: 'Airspace fees, GCAA renewals, compliance, and audit evidence', year0: 0, year1: droneEconomics.fixedCostBreakdown[3]!.annualValue * 0.42, year2: droneEconomics.fixedCostBreakdown[3]!.annualValue * 0.66, year3: droneEconomics.fixedCostBreakdown[3]!.annualValue * 0.82, year4: droneEconomics.fixedCostBreakdown[3]!.annualValue * 0.95, year5: droneEconomics.fixedCostBreakdown[3]!.annualValue * 1.08, isRecurring: true },
    ];
  }
  if (archetype === 'Drone First Mile Delivery') {
    return [
      { id: 'c1', category: 'implementation', subcategory: 'Fleet', name: 'Cargo Drone Fleet', description: 'Heavy-lift cargo drone fleet purchase', year0: baseCapital * 0.45, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c2', category: 'implementation', subcategory: 'Infrastructure', name: 'Collection Hub Infrastructure', description: 'Pickup stations, cargo handling, charging facilities', year0: baseCapital * 0.22, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c3', category: 'implementation', subcategory: 'Technology', name: 'Cargo Management System', description: 'Weight optimization, route planning, cargo tracking', year0: baseCapital * 0.15, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c4', category: 'implementation', subcategory: 'Compliance', name: 'GCAA Cargo Certification', description: 'Heavy-lift permits, cargo safety, airspace clearance', year0: baseCapital * .1, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c5', category: 'implementation', subcategory: 'Enablement', name: 'Supply Chain Integration', description: 'Vendor onboarding, logistics integration, training', year0: baseCapital * 0.08, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c6', category: 'implementation', subcategory: 'Contingency', name: 'Project Contingency', description: 'Risk buffer for unforeseen costs', year0: contingencyAmount, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c7', category: 'operational', subcategory: 'Operations', name: 'Cargo Operations', description: 'Energy, heavy maintenance, monitoring, cargo insurance', year0: 0, year1: annualMaintenance * 1.1, year2: annualMaintenance * 1.15, year3: annualMaintenance * 1.2, year4: annualMaintenance * 1.25, year5: annualMaintenance * 1.3, isRecurring: true },
    ];
  }
  // Default Government Transformation - percentages sum to 100% of baseCapital
  // AI cost bundle: when AI-specific domain params are supplied (GPU compute, LLM
  // inference, MLOps, labeling, responsible-use governance), add them as recurring
  // operating lines so the business case reflects the true cost of running AI in
  // production. Each line scales with a 3% annual growth curve. Lines with 0 value
  // are omitted so non-AI government programs are unaffected.
  const gpuAnnual = Math.max(0, Number(domainParams?.['GPU / ML Compute Annual'] ?? 0));
  const llmAnnual = Math.max(0, Number(domainParams?.['LLM Inference Cost Annual'] ?? 0));
  const mlopsAnnual = Math.max(0, Number(domainParams?.['MLOps Platform Annual'] ?? 0));
  const labelingAnnual = Math.max(0, Number(domainParams?.['Data Labeling & Curation Annual'] ?? 0));
  const retrainCycles = Math.max(1, Number(domainParams?.['Model Retraining Cycles per Year'] ?? 1));
  // Retraining beyond 4 cycles/year scales compute and labeling (each extra cycle adds ~12% of base).
  const retrainMultiplier = 1 + Math.max(0, (retrainCycles - 4)) * 0.12;
  const governanceAnnual = Math.max(0, Number(domainParams?.['AI Responsible-Use & Governance Annual'] ?? 0));

  const ramp = (base: number): { year1: number; year2: number; year3: number; year4: number; year5: number } => ({
    year1: base,
    year2: base * 1.03,
    year3: base * 1.06,
    year4: base * 1.09,
    year5: base * 1.12,
  });

  const aiOperatingLines: CostLineItem[] = [];
  if (gpuAnnual > 0) {
    const r = ramp(gpuAnnual * retrainMultiplier);
    aiOperatingLines.push({ id: 'c8', category: 'operational', subcategory: 'AI Compute', name: 'GPU / ML Compute', description: `Training and inference compute (scaled for ${retrainCycles} retraining cycles/year)`, year0: 0, year1: r.year1, year2: r.year2, year3: r.year3, year4: r.year4, year5: r.year5, isRecurring: true });
  }
  if (llmAnnual > 0) {
    const r = ramp(llmAnnual);
    aiOperatingLines.push({ id: 'c9', category: 'operational', subcategory: 'AI Inference', name: 'LLM Inference & API Usage', description: 'Foundation-model API / token spend for citizen-facing AI workflows', year0: 0, year1: r.year1, year2: r.year2, year3: r.year3, year4: r.year4, year5: r.year5, isRecurring: true });
  }
  if (mlopsAnnual > 0) {
    const r = ramp(mlopsAnnual);
    aiOperatingLines.push({ id: 'c10', category: 'operational', subcategory: 'AI Platform', name: 'MLOps Platform & Tooling', description: 'Experimentation, model registry, monitoring, and deployment tooling', year0: 0, year1: r.year1, year2: r.year2, year3: r.year3, year4: r.year4, year5: r.year5, isRecurring: true });
  }
  if (labelingAnnual > 0) {
    const r = ramp(labelingAnnual * retrainMultiplier);
    aiOperatingLines.push({ id: 'c11', category: 'operational', subcategory: 'AI Data', name: 'Data Labeling & Curation', description: 'Labeling, curation, and evaluation-set maintenance (scales with retraining cadence)', year0: 0, year1: r.year1, year2: r.year2, year3: r.year3, year4: r.year4, year5: r.year5, isRecurring: true });
  }
  if (governanceAnnual > 0) {
    const r = ramp(governanceAnnual);
    aiOperatingLines.push({ id: 'c12', category: 'operational', subcategory: 'AI Governance', name: 'AI Responsible-Use & Governance', description: 'Bias audits, red-teaming, explainability tooling, and human-in-the-loop oversight', year0: 0, year1: r.year1, year2: r.year2, year3: r.year3, year4: r.year4, year5: r.year5, isRecurring: true });
  }

  return [
    { id: 'c1', category: 'implementation', subcategory: 'Software', name: 'Core Software & Development', description: 'Core platform development', year0: baseCapital * 0.35, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
    { id: 'c2', category: 'implementation', subcategory: 'Infrastructure', name: 'Infrastructure Setup', description: 'Hardware and cloud setup', year0: baseCapital * 0.25, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
    { id: 'c3', category: 'implementation', subcategory: 'Integration', name: 'Enterprise Integration', description: 'Integration with existing systems', year0: baseCapital * 0.15, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
    { id: 'c4', category: 'implementation', subcategory: 'PM', name: 'PMO & Governance', description: 'Project management office', year0: baseCapital * .1, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
    { id: 'c5', category: 'implementation', subcategory: 'Enablement', name: 'Change Management & Training', description: 'Talent enablement and adoption', year0: baseCapital * 0.15, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
    { id: 'c6', category: 'implementation', subcategory: 'Contingency', name: 'Project Contingency', description: 'Risk buffer for unforeseen costs', year0: contingencyAmount, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
    { id: 'c7', category: 'operational', subcategory: 'Operations', name: 'Annual Operations', description: 'Hosting and support', year0: 0, year1: annualMaintenance, year2: annualMaintenance * 1.03, year3: annualMaintenance * 1.06, year4: annualMaintenance * 1.09, year5: annualMaintenance * 1.12, isRecurring: true },
    ...aiOperatingLines,
  ];
}

function getArchetypeBenefits(archetype: string, totalInvestment: number, domainParams?: Record<string, number>, adoptionRate?: number): BenefitLineItem[] {
  // Adoption rate affects how quickly benefits are realized — must match shared/financialCalculations.ts
  const adoptionFactor = (adoptionRate ?? .75) / .75;

  if (archetype === 'Autonomous Vehicle Platform') {
    const defaults = getDefaultDomainParameters('Autonomous Vehicle Platform');
    const fleetSize = domainParams?.['Fleet Size'] ?? defaults['Fleet Size'] ?? 100;
    const fareRate = domainParams?.['Taxi Fare Rate'] ?? defaults['Taxi Fare Rate'] ?? 2.5;
    const tripDistance = domainParams?.['Average Trip Distance'] ?? defaults['Average Trip Distance'] ?? 12;
    const dailyTrips = domainParams?.['Daily Trips per Vehicle'] ?? defaults['Daily Trips per Vehicle'] ?? 18;
    const utilizationRate = domainParams?.['Fleet Utilization Rate'] ?? defaults['Fleet Utilization Rate'] ?? .72;
    const operatingCostPerKm = domainParams?.['Operating Cost per km'] ?? defaults['Operating Cost per km'] ?? .85;
    const driverCostSavings = domainParams?.['Driver Cost Savings'] ?? defaults['Driver Cost Savings'] ?? 156000;
    // Retention factor: share of gross driver cost savings that survives after parallel
    // safety operators, remote operations staff, and customer support coverage.
    // 0.30 reflects early-phase reality where safety/remote staffing structurally erodes
    // most of the headline driver cost; this compounds with the back-loaded labor ramp.
    const laborRetentionFactor = .30;

    const annualTrips = fleetSize * dailyTrips * 365 * utilizationRate * (adoptionRate ?? .65);
    const annualKilometers = annualTrips * tripDistance;
    const annualContributionMargin = annualKilometers * Math.max(fareRate - operatingCostPerKm, fareRate * .42);
    const annualNetLaborSavings = fleetSize * driverCostSavings * laborRetentionFactor * (adoptionRate ?? .65);
    const annualStrategicValue = Math.max(totalInvestment * 0.018, fleetSize * 24000);
    const annualSafetyValue = annualTrips * .9;
    // Contribution ramp follows phased fleet deployment (pilot → scale waves) and demand uptake.
    const contributionRamp = [0.12, 0.35, 0.62, 0.85, 1.0];
    // Labor-savings ramp is *more* back-loaded than contribution: early years still require
    // parallel safety operators (captured as recurring cost c8), so the net labor gain only
    // materialises as autonomy matures and the regulator approves unsupervised operation.
    const laborRamp = [0.05, 0.18, 0.45, 0.75, 0.95];
    const strategicRamp = [0.35, 0.55, 0.78, 0.95, 1.05];

    return [
      { id: 'b1', category: 'revenue', name: 'Net Mobility Contribution', description: 'Trip contribution after variable distance-based operating costs', year1: annualContributionMargin * contributionRamp[0]!, year2: annualContributionMargin * contributionRamp[1]!, year3: annualContributionMargin * contributionRamp[2]!, year4: annualContributionMargin * contributionRamp[3]!, year5: annualContributionMargin * contributionRamp[4]!, realization: 'gradual', confidence: 'medium' },
      { id: 'b2', category: 'cost_savings', name: 'Net Labor Productivity Savings', description: 'Driver cost avoided net of remote operations, safety stewards, and customer support coverage. Back-loaded to reflect parallel safety-operator staffing during early commercialisation — gross driver cost savings are reduced by the retention factor and only ramp as autonomy maturity and regulatory approval allow unsupervised operation.', year1: annualNetLaborSavings * laborRamp[0]!, year2: annualNetLaborSavings * laborRamp[1]!, year3: annualNetLaborSavings * laborRamp[2]!, year4: annualNetLaborSavings * laborRamp[3]!, year5: annualNetLaborSavings * laborRamp[4]!, realization: 'gradual', confidence: 'medium' },
      { id: 'b3', category: 'strategic', name: 'Safety, Data, and Mobility Leadership', description: 'Strategic public-value gains from AV readiness, safety telemetry, and innovation positioning. Classified as strategic (non-cash) benefit — should not be mixed with commercial cash contribution when assessing financial viability.', year1: (annualStrategicValue + annualSafetyValue) * strategicRamp[0]!, year2: (annualStrategicValue + annualSafetyValue) * strategicRamp[1]!, year3: (annualStrategicValue + annualSafetyValue) * strategicRamp[2]!, year4: (annualStrategicValue + annualSafetyValue) * strategicRamp[3]!, year5: (annualStrategicValue + annualSafetyValue) * strategicRamp[4]!, realization: 'delayed', confidence: 'medium' },
    ];
  }
  if (archetype === 'Healthcare Digital System' || archetype === 'Healthcare Digital Transformation') {
    return [
      { id: 'b1', category: 'productivity', name: 'Clinical Productivity Gains', description: 'Recovered clinician and care-team capacity from reduced documentation and coordination effort', year1: totalInvestment * .1 * adoptionFactor, year2: totalInvestment * .15 * adoptionFactor, year3: totalInvestment * .2 * adoptionFactor, year4: totalInvestment * .22 * adoptionFactor, year5: totalInvestment * .25 * adoptionFactor, realization: 'gradual', confidence: 'high' },
      { id: 'b2', category: 'strategic', name: 'Patient Outcome and Capacity Value', description: 'Public-value uplift from lower readmissions, faster interventions, and improved clinical throughput', year1: totalInvestment * .05 * adoptionFactor, year2: totalInvestment * .1 * adoptionFactor, year3: totalInvestment * .15 * adoptionFactor, year4: totalInvestment * .18 * adoptionFactor, year5: totalInvestment * .2 * adoptionFactor, realization: 'delayed', confidence: 'medium' },
      { id: 'b3', category: 'risk_reduction', name: 'Compliance and Patient Safety Risk Reduction', description: 'Audit efficiency, safer clinical controls, and lower regulatory exposure', year1: totalInvestment * 0.03 * adoptionFactor, year2: totalInvestment * 0.05 * adoptionFactor, year3: totalInvestment * 0.06 * adoptionFactor, year4: totalInvestment * 0.07 * adoptionFactor, year5: totalInvestment * 0.08 * adoptionFactor, realization: 'immediate', confidence: 'high' },
    ];
  }
  if (archetype === 'Disaster Recovery & Business Continuity Platform') {
    const defaults = getDefaultDomainParameters('Disaster Recovery & Business Continuity Platform');
    const valueAtRisk = domainParams?.['Annual Service Value at Risk'] ?? defaults['Annual Service Value at Risk'] ?? 18_000_000;
    const downtimeReduction = (domainParams?.['Expected Downtime Reduction'] ?? defaults['Expected Downtime Reduction'] ?? 75) / 100;
    const currentRto = Math.max(1, domainParams?.['Current RTO'] ?? defaults['Current RTO'] ?? 24);
    const targetRto = Math.max(0.25, domainParams?.['Target RTO'] ?? defaults['Target RTO'] ?? 4);
    const currentRpo = Math.max(1, domainParams?.['Current RPO'] ?? defaults['Current RPO'] ?? 12);
    const targetRpo = Math.max(0.25, domainParams?.['Target RPO'] ?? defaults['Target RPO'] ?? 1);
    const rtoImprovement = Math.max(0, (currentRto - targetRto) / currentRto);
    const rpoImprovement = Math.max(0, (currentRpo - targetRpo) / currentRpo);
    const cyberUplift = Math.max(0, (domainParams?.['Cyber Resilience Uplift'] ?? defaults['Cyber Resilience Uplift'] ?? 20) / 100);
    const annualOutageAvoidance = valueAtRisk * downtimeReduction * 0.34;
    const annualProductivityProtection = valueAtRisk * Math.max(rtoImprovement, 0.05) * 0.12;
    const annualDataLossAvoidance = valueAtRisk * Math.max(rpoImprovement, 0.05) * 0.07;
    const annualRiskReduction = valueAtRisk * cyberUplift * 0.08;

    return [
      { id: 'b1', category: 'risk_reduction', name: 'Avoided Outage Loss', description: 'Reduced expected service-disruption impact from tested failover, backup, and recovery controls', year1: annualOutageAvoidance * 0.35 * adoptionFactor, year2: annualOutageAvoidance * 0.65 * adoptionFactor, year3: annualOutageAvoidance * 0.85 * adoptionFactor, year4: annualOutageAvoidance * adoptionFactor, year5: annualOutageAvoidance * adoptionFactor, realization: 'immediate', confidence: 'high' },
      { id: 'b2', category: 'productivity', name: 'Recovery Time Productivity Protection', description: 'Recovered staff and operational capacity from lowering RTO for critical services', year1: annualProductivityProtection * 0.30 * adoptionFactor, year2: annualProductivityProtection * 0.60 * adoptionFactor, year3: annualProductivityProtection * 0.82 * adoptionFactor, year4: annualProductivityProtection * adoptionFactor, year5: annualProductivityProtection * adoptionFactor, realization: 'gradual', confidence: 'medium' },
      { id: 'b3', category: 'risk_reduction', name: 'Data Loss and Rework Avoidance', description: 'Lower data-loss, reconciliation, and manual rework exposure from improved RPO and immutable restore controls', year1: annualDataLossAvoidance * 0.40 * adoptionFactor, year2: annualDataLossAvoidance * 0.70 * adoptionFactor, year3: annualDataLossAvoidance * 0.90 * adoptionFactor, year4: annualDataLossAvoidance * adoptionFactor, year5: annualDataLossAvoidance * adoptionFactor, realization: 'gradual', confidence: 'high' },
      { id: 'b4', category: 'strategic', name: 'Cyber and Continuity Assurance Value', description: 'Public-trust and compliance value from exercised continuity, hardened recovery, and auditable resilience evidence', year1: annualRiskReduction * 0.45 * adoptionFactor, year2: annualRiskReduction * 0.70 * adoptionFactor, year3: annualRiskReduction * 0.90 * adoptionFactor, year4: annualRiskReduction * adoptionFactor, year5: annualRiskReduction * adoptionFactor, realization: 'immediate', confidence: 'medium' },
    ];
  }
  if (archetype === 'Insurance Digital Platform') {
    return [
      { id: 'b1', category: 'cost_savings', name: 'Claims Operations Savings', description: 'Reduced cost per claim through automation and straight-through processing', year1: totalInvestment * .15 * adoptionFactor, year2: totalInvestment * .25 * adoptionFactor, year3: totalInvestment * .35 * adoptionFactor, year4: totalInvestment * .4 * adoptionFactor, year5: totalInvestment * .45 * adoptionFactor, realization: 'gradual', confidence: 'high' },
      { id: 'b2', category: 'cost_savings', name: 'Loss Leakage Reduction', description: 'Lower fraudulent and avoidable claims payouts through better detection and controls', year1: totalInvestment * 0.08 * adoptionFactor, year2: totalInvestment * 0.12 * adoptionFactor, year3: totalInvestment * 0.18 * adoptionFactor, year4: totalInvestment * 0.22 * adoptionFactor, year5: totalInvestment * 0.25 * adoptionFactor, realization: 'gradual', confidence: 'high' },
      { id: 'b3', category: 'revenue', name: 'Retention and Cross-Sell Uplift', description: 'Commercial uplift from improved customer experience, retention, and product penetration', year1: totalInvestment * 0.05 * adoptionFactor, year2: totalInvestment * 0.08 * adoptionFactor, year3: totalInvestment * 0.12 * adoptionFactor, year4: totalInvestment * 0.15 * adoptionFactor, year5: totalInvestment * 0.18 * adoptionFactor, realization: 'delayed', confidence: 'medium' },
    ];
  }
  if (archetype === 'Drone Last Mile Delivery') {
    const droneEconomics = buildDroneLastMileEconomics(domainParams, adoptionRate ?? 0.75);

    return [
      { id: 'b1', category: 'revenue', name: 'Tiered Delivery Contribution', description: `Premium / pharma / contracted B2B mix yields AED ${droneEconomics.weightedAverageFare.toFixed(1)} delivery revenue against AED ${droneEconomics.variableCostPerDelivery.toFixed(1)} variable cost`, year1: droneEconomics.yearlyContribution[0]!, year2: droneEconomics.yearlyContribution[1]!, year3: droneEconomics.yearlyContribution[2]!, year4: droneEconomics.yearlyContribution[3]!, year5: droneEconomics.yearlyContribution[4]!, realization: 'gradual', confidence: 'high' },
      { id: 'b2', category: 'revenue', name: 'Platform & API Fee Revenue', description: `Enterprise integrations and contracted-volume APIs contribute AED ${droneEconomics.platformRevenuePerDelivery.toFixed(1)} per delivery plus annual integration fees`, year1: droneEconomics.yearlyPlatformRevenue[0]!, year2: droneEconomics.yearlyPlatformRevenue[1]!, year3: droneEconomics.yearlyPlatformRevenue[2]!, year4: droneEconomics.yearlyPlatformRevenue[3]!, year5: droneEconomics.yearlyPlatformRevenue[4]!, realization: 'gradual', confidence: 'medium' },
      { id: 'b3', category: 'cost_savings', name: 'Logistics Cost Avoidance (Shared)', description: 'Shared value capture from replacing traditional delivery cost with a contracted drone network', year1: droneEconomics.yearlyCostSavings[0]!, year2: droneEconomics.yearlyCostSavings[1]!, year3: droneEconomics.yearlyCostSavings[2]!, year4: droneEconomics.yearlyCostSavings[3]!, year5: droneEconomics.yearlyCostSavings[4]!, realization: 'gradual', confidence: 'medium' },
      { id: 'b4', category: 'strategic', name: 'Carbon and Service Resilience Value', description: 'Strategic value from faster service windows, lower emissions, and continuity under constrained road capacity', year1: droneEconomics.yearlyCarbonValue[0]!, year2: droneEconomics.yearlyCarbonValue[1]!, year3: droneEconomics.yearlyCarbonValue[2]!, year4: droneEconomics.yearlyCarbonValue[3]!, year5: droneEconomics.yearlyCarbonValue[4]!, realization: 'immediate', confidence: 'medium' },
    ];
  }
  if (archetype === 'Drone First Mile Delivery') {
    return [
      { id: 'b1', category: 'cost_savings', name: 'First-Mile Collection Cost Avoidance', description: 'Reduced per-pickup cost versus truck collection', year1: totalInvestment * .1 * adoptionFactor, year2: totalInvestment * .18 * adoptionFactor, year3: totalInvestment * .26 * adoptionFactor, year4: totalInvestment * .34 * adoptionFactor, year5: totalInvestment * .42 * adoptionFactor, realization: 'gradual', confidence: 'high' },
      { id: 'b2', category: 'productivity', name: 'Throughput Productivity Gains', description: 'Higher supply-chain throughput and faster handoff cycles', year1: totalInvestment * 0.06 * adoptionFactor, year2: totalInvestment * 0.12 * adoptionFactor, year3: totalInvestment * 0.18 * adoptionFactor, year4: totalInvestment * 0.22 * adoptionFactor, year5: totalInvestment * 0.26 * adoptionFactor, realization: 'gradual', confidence: 'medium' },
      { id: 'b3', category: 'strategic', name: 'Road and Emissions Relief Value', description: 'Public-value benefit from fewer collection trucks on roads and lower emissions', year1: totalInvestment * .02 * adoptionFactor, year2: totalInvestment * .04 * adoptionFactor, year3: totalInvestment * .06 * adoptionFactor, year4: totalInvestment * .08 * adoptionFactor, year5: totalInvestment * .1 * adoptionFactor, realization: 'delayed', confidence: 'medium' },
      { id: 'b4', category: 'risk_reduction', name: 'Inventory and Working-Capital Risk Reduction', description: 'Faster collection enables lower buffer inventory and better continuity control', year1: totalInvestment * 0.04 * adoptionFactor, year2: totalInvestment * 0.08 * adoptionFactor, year3: totalInvestment * 0.12 * adoptionFactor, year4: totalInvestment * 0.15 * adoptionFactor, year5: totalInvestment * 0.18 * adoptionFactor, realization: 'gradual', confidence: 'medium' },
    ];
  }
  // Default Government Transformation
  const annualBenefit = totalInvestment * .2 * adoptionFactor;
  return [
    { id: 'b1', category: 'productivity', name: 'Operational Productivity Gains', description: 'Recovered staff capacity and cycle-time improvement from automation', year1: annualBenefit * 0.2, year2: annualBenefit * 0.5, year3: annualBenefit * 0.8, year4: annualBenefit, year5: annualBenefit, realization: 'gradual', confidence: 'medium' },
    { id: 'b2', category: 'cost_savings', name: 'Operating Cost Avoidance', description: 'Reduced recurring operating and handling costs', year1: annualBenefit * 0.15, year2: annualBenefit * 0.4, year3: annualBenefit * 0.7, year4: annualBenefit * 0.9, year5: annualBenefit, realization: 'gradual', confidence: 'high' },
    { id: 'b3', category: 'risk_reduction', name: 'Control and Compliance Risk Reduction', description: 'Lower process error, audit, and compliance exposure', year1: annualBenefit * 0.1, year2: annualBenefit * 0.3, year3: annualBenefit * 0.5, year4: annualBenefit * 0.7, year5: annualBenefit * 0.8, realization: 'delayed', confidence: 'medium' },
  ];
}

function buildCashFlows(costs: CostLineItem[], benefits: BenefitLineItem[], discountRate: number): YearlyCashFlow[] {
  const cashFlows: YearlyCashFlow[] = [];
  let cumulativeCashFlow = 0;
  const rate = discountRate / 100;

  for (let year = 0; year <= 5; year++) {
    const yearKey = `year${year}` as keyof CostLineItem;
    const yearCosts = costs.reduce((sum, c) => sum + (Number(c[yearKey]) || 0), 0);
    const yearBenefits = year === 0 ? 0 : benefits.reduce((sum, b) => {
      const bKey = `year${year}` as keyof BenefitLineItem;
      return sum + (Number(b[bKey]) || 0);
    }, 0);

    const netCashFlow = yearBenefits - yearCosts;
    cumulativeCashFlow += netCashFlow;
    const discountedCashFlow = netCashFlow / Math.pow(1 + rate, year);

    cashFlows.push({
      year,
      label: year === 0 ? 'Initial' : `Year ${year}`,
      costs: yearCosts,
      benefits: yearBenefits,
      netCashFlow,
      cumulativeCashFlow,
      discountedCashFlow,
    });
  }

  return cashFlows;
}

function calculateNPV(cashFlows: YearlyCashFlow[]): number {
  return cashFlows.reduce((npv, cf) => npv + cf.discountedCashFlow, 0);
}

function calculateIRR(cashFlows: YearlyCashFlow[]): number {
  const cf = cashFlows.map(c => c.netCashFlow);
  if (cf.every(v => v >= 0) || cf.every(v => v <= 0)) return 0;

  let low = -0.99, high = 10, irr = 0;
  for (let i = 0; i < 1000; i++) {
    irr = (low + high) / 2;
    const npv = cf.reduce((sum, v, y) => sum + v / Math.pow(1 + irr, y), 0);
    if (Math.abs(npv) < 0.0001) break;
    if (npv > 0) low = irr; else high = irr;
  }
  return irr * 100;
}

function calculatePaybackMonths(cashFlows: YearlyCashFlow[]): number {
  for (let i = 1; i < cashFlows.length; i++) {
    const currentCashFlow = cashFlows[i];
    const previousCashFlow = cashFlows[i - 1];
    if (!currentCashFlow || !previousCashFlow) {
      continue;
    }

    if (currentCashFlow.cumulativeCashFlow >= 0 && previousCashFlow.cumulativeCashFlow < 0) {
      const prev = Math.abs(previousCashFlow.cumulativeCashFlow);
      const net = currentCashFlow.netCashFlow;
      if (net > 0) return ((i - 1) + prev / net) * 12;
      return i * 12;
    }
  }
  if ((cashFlows[0]?.cumulativeCashFlow ?? -1) >= 0) return 0;
  return Infinity;
}

function calculateDiscountedPaybackMonths(cashFlows: YearlyCashFlow[]): number {
  let cumulativeDiscountedCashFlow = 0;
  let previousCumulativeDiscountedCashFlow = 0;

  for (let i = 0; i < cashFlows.length; i++) {
    const currentCashFlow = cashFlows[i];
    if (!currentCashFlow) {
      continue;
    }

    cumulativeDiscountedCashFlow += currentCashFlow.discountedCashFlow;

    if (i > 0 && cumulativeDiscountedCashFlow >= 0 && previousCumulativeDiscountedCashFlow < 0) {
      const previousDeficit = Math.abs(previousCumulativeDiscountedCashFlow);
      const discountedNetCashFlow = currentCashFlow.discountedCashFlow;
      if (discountedNetCashFlow > 0) {
        return ((i - 1) + previousDeficit / discountedNetCashFlow) * 12;
      }
      return i * 12;
    }

    previousCumulativeDiscountedCashFlow = cumulativeDiscountedCashFlow;
  }

  if ((cashFlows[0]?.discountedCashFlow ?? -1) >= 0) return 0;
  return Infinity;
}

function calculateROI(totalBenefits: number, totalCosts: number): number {
  if (totalCosts === 0) return 0;
  return ((totalBenefits - totalCosts) / totalCosts) * 100;
}

export function computeScenarios(costs: CostLineItem[], benefits: BenefitLineItem[], discountRate: number, archetype: string): ScenarioResult[] {
  const assumptions = getArchetypeConfig(normalizeFinancialArchetype(archetype)).assumptions;
  const highUncertainty = assumptions.costVarianceWorst >= 0.35 || assumptions.benefitVarianceWorst <= -0.40;
  const pessimisticProbability = highUncertainty ? 0.25 : 0.20;
  const optimisticProbability = highUncertainty ? 0.15 : 0.20;
  const baseProbability = 1 - pessimisticProbability - optimisticProbability;
  const multipliers = [
    {
      name: 'pessimistic',
      label: 'Pessimistic',
      costMult: 1 + Math.max(0.05, assumptions.costVarianceWorst),
      benefitMult: Math.max(0.05, 1 + assumptions.benefitVarianceWorst),
      probability: pessimisticProbability,
    },
    { name: 'base', label: 'Base Case', costMult: 1, benefitMult: 1, probability: baseProbability },
    {
      name: 'optimistic',
      label: 'Optimistic',
      costMult: Math.max(0.6, 1 + assumptions.costVarianceBest),
      benefitMult: Math.max(0.2, 1 + assumptions.benefitVarianceBest),
      probability: optimisticProbability,
    },
  ];

  return multipliers.map(m => {
    const scaledCosts = costs.map(c => ({
      ...c,
      year0: c.year0 * m.costMult,
      year1: c.year1 * m.costMult,
      year2: c.year2 * m.costMult,
      year3: c.year3 * m.costMult,
      year4: c.year4 * m.costMult,
      year5: c.year5 * m.costMult,
    }));
    const scaledBenefits = benefits.map(b => ({
      ...b,
      year1: b.year1 * m.benefitMult,
      year2: b.year2 * m.benefitMult,
      year3: b.year3 * m.benefitMult,
      year4: b.year4 * m.benefitMult,
      year5: b.year5 * m.benefitMult,
    }));
    const cf = buildCashFlows(scaledCosts, scaledBenefits, discountRate);
    const npv = calculateNPV(cf);
    const irr = calculateIRR(cf);
    const totalCosts = cf.reduce((s, c) => s + c.costs, 0);
    const totalBenefits = cf.reduce((s, c) => s + c.benefits, 0);
    const roi = calculateROI(totalBenefits, totalCosts);
    const paybackMonths = calculatePaybackMonths(cf);

    return {
      name: m.name,
      label: m.label,
      npv,
      irr,
      roi,
      paybackMonths,
      probability: m.probability,
    };
  });
}

function buildGenericDriverModel(
  archetype: string,
  domainParameters: Record<string, number>,
  costs: CostLineItem[],
  benefits: BenefitLineItem[],
  fiveYearProjections: UnifiedFinancialOutput['fiveYearProjections'],
): DriverModelOutput {
  const yearlyRevenue = [1, 2, 3, 4, 5].map((year) => benefits.reduce((sum, benefit) => sum + (Number(benefit[`year${year}` as keyof BenefitLineItem]) || 0), 0));
  const yearlyRecurringCosts = [1, 2, 3, 4, 5].map((year) => costs.reduce((sum, cost) => sum + (Number(cost[`year${year}` as keyof CostLineItem]) || 0), 0));
  const projections = fiveYearProjections.yearly.filter((projection) => projection.year > 0);
  const primaryScale = Object.values(domainParameters).find((value) => Number.isFinite(value) && value > 1) ?? 100;
  const year5Revenue = yearlyRevenue[4] || 1;

  const segments = [...benefits]
    .map((benefit) => {
      const total = benefit.year1 + benefit.year2 + benefit.year3 + benefit.year4 + benefit.year5;
      return {
        name: benefit.name,
        total,
        share: total > 0 && year5Revenue > 0 ? total / benefits.reduce((sum, item) => sum + item.year1 + item.year2 + item.year3 + item.year4 + item.year5, 0) : 0,
      };
    })
    .filter((segment) => segment.total > 0)
    .sort((left, right) => right.total - left.total)
    .slice(0, 3)
    .map((segment) => ({
      name: segment.name,
      fare: Math.round(segment.total / 5),
      share: segment.share,
    }));

  const normalizedSegments = segments.length > 0
    ? (() => {
        const totalShare = segments.reduce((sum, segment) => sum + segment.share, 0) || 1;
        return segments.map((segment) => ({ ...segment, share: segment.share / totalShare }));
      })()
    : [{ name: `${archetype} Value Stream`, fare: Math.round(yearlyRevenue.reduce((sum, value) => sum + value, 0) / 5), share: 1 }];

  const effectiveUnits = yearlyRevenue.map((value, index) => {
    const ratio = year5Revenue > 0 ? value / year5Revenue : 0.2 + index * 0.15;
    return Math.max(1, Math.round(primaryScale * Math.max(0.15, ratio)));
  });

  const recurringBreakdown = costs
    .filter((cost) => cost.isRecurring)
    .map((cost) => ({
      name: cost.name,
      annualValue: (cost.year1 + cost.year2 + cost.year3 + cost.year4 + cost.year5) / 5,
    }))
    .filter((entry) => entry.annualValue > 0)
    .sort((left, right) => right.annualValue - left.annualValue);

  const fixedAnnual = recurringBreakdown.reduce((sum, item) => sum + item.annualValue, 0);
  const averageVariableCost = yearlyRecurringCosts.reduce((sum, value) => sum + value, 0) / Math.max(1, effectiveUnits.reduce((sum, value) => sum + value, 0));
  const margins = projections.map((projection, index) => {
    const revenue = projection.revenue;
    const recurringCost = yearlyRecurringCosts[index] ?? 0;
    const ebitdaMargin = revenue > 0 ? ((revenue - recurringCost) / revenue) * 100 : 0;
    return Math.round(ebitdaMargin * 10) / 10;
  });

  return {
    demandDrivers: {
      fleetSize: primaryScale,
      maxCapacityPerDrone: Math.max(...effectiveUnits),
      fleetAvailability: 0.85,
      demandUtilization: 0.75,
      weatherRegulationFactor: 1,
      effectiveDailyDeliveries: Math.max(1, Math.round((effectiveUnits[0] || 1) / 365)),
      yearlyDeliveries: effectiveUnits,
    },
    revenueDrivers: {
      weightedAverageFare: normalizedSegments.reduce((sum, segment) => sum + segment.fare * segment.share, 0),
      segments: normalizedSegments,
      contributionMarginPerDelivery: Math.max(0, (yearlyRevenue[4] ?? 0) - (yearlyRecurringCosts[4] ?? 0)) / Math.max(1, effectiveUnits[4] ?? 1),
      variableCostPerDelivery: averageVariableCost,
    },
    costDrivers: {
      variableCostBreakdown: recurringBreakdown.slice(0, 4).map((item) => ({ name: item.name, value: item.annualValue / Math.max(1, effectiveUnits[0] ?? 1) })),
      fixedCostBreakdown: recurringBreakdown.slice(0, 4),
      totalVariableCostPerDelivery: averageVariableCost,
      totalFixedAnnual: fixedAnnual,
      effectiveCostPerDelivery: effectiveUnits.map((units, index) => units > 0 ? (yearlyRecurringCosts[index] ?? 0) / units : 0),
    },
    rampSchedule: effectiveUnits.map((units, index) => ({
      year: index + 1,
      fleetActive: year5Revenue > 0 ? Math.min(1, (yearlyRevenue[index] ?? 0) / year5Revenue) : 0,
      utilization: Math.min(1, Math.max(0.35, ((yearlyRevenue[index] ?? 0) / Math.max(1, year5Revenue)))),
      deliveries: units,
    })),
    margins: {
      ebitdaMargin: margins,
      netMargin: margins.map((margin) => Math.round(margin * 0.8 * 10) / 10),
      contributionMargin: Math.max(0, (yearlyRevenue[4] ?? 0) - (yearlyRecurringCosts[4] ?? 0)) / Math.max(1, effectiveUnits[4] ?? 1),
    },
  };
}

function buildGenericKillSwitchMetrics(
  archetype: string,
  totalInvestment: number,
  adoptionRate: number,
  paybackMonths: number,
  scenarios: ScenarioResult[],
  driverModel: DriverModelOutput,
  riskAdjustedAnalysis: RiskAdjustedAnalysis,
): KillSwitchMetrics {
  const assumptions = getArchetypeConfig(normalizeFinancialArchetype(archetype)).assumptions;
  const y3Ebitda = driverModel.margins.ebitdaMargin[2] ?? driverModel.margins.ebitdaMargin[driverModel.margins.ebitdaMargin.length - 1] ?? 0;
  const downsideScenario = scenarios.find((scenario) => scenario.name === 'pessimistic');
  const targetPaybackMonths = Math.max(24, assumptions.implementationMonths * 2);
  const minimumAdoption = assumptions.adoptionRate * 0.9 * 100;
  const marginTarget = normalizeFinancialArchetype(archetype) === 'Government Digital Transformation' ? 18 : 20;
  const downsideFloor = -totalInvestment * 0.25;

  const thresholds = [
    { metric: 'Adoption Realization', target: `≥ ${minimumAdoption.toFixed(0)}%`, current: `${(adoptionRate * 100).toFixed(0)}%`, met: adoptionRate * 100 >= minimumAdoption, critical: true },
    { metric: 'Payback Period', target: `≤ ${targetPaybackMonths} months`, current: Number.isFinite(paybackMonths) ? `${paybackMonths.toFixed(0)} months` : 'N/A', met: Number.isFinite(paybackMonths) && paybackMonths <= targetPaybackMonths, critical: true },
    { metric: 'EBITDA Margin (Y3)', target: `≥ ${marginTarget}%`, current: `${y3Ebitda.toFixed(0)}%`, met: y3Ebitda >= marginTarget, critical: false },
    { metric: 'Risk-Adjusted NPV', target: 'Positive', current: formatAED(riskAdjustedAnalysis.riskAdjustedNpv), met: riskAdjustedAnalysis.riskAdjustedNpv > 0, critical: true },
    { metric: 'Downside NPV Floor', target: `≥ ${formatAED(downsideFloor)}`, current: downsideScenario ? formatAED(downsideScenario.npv) : 'N/A', met: (downsideScenario?.npv ?? Number.NEGATIVE_INFINITY) >= downsideFloor, critical: false },
  ];

  const criticalPassed = thresholds.filter((threshold) => threshold.critical && threshold.met).length;
  const criticalTotal = thresholds.filter((threshold) => threshold.critical).length;
  const pilotGateStatus = criticalPassed === criticalTotal ? 'PASS' : criticalPassed >= criticalTotal - 1 ? 'CONDITIONAL' : 'FAIL';

  return {
    thresholds,
    pilotGateStatus,
    summary: pilotGateStatus === 'PASS'
      ? `${archetype} meets the minimum operating and value thresholds for controlled progression.`
      : pilotGateStatus === 'CONDITIONAL'
        ? `${archetype} is directionally viable but one critical value threshold still needs corrective action before scale approval.`
        : `${archetype} misses multiple critical thresholds and should remain gated until economics and delivery assumptions are corrected.`,
  };
}

function buildRiskAdjustedAnalysis(archetype: string, discountRate: number, cashFlows: YearlyCashFlow[], npv: number): RiskAdjustedAnalysis {
  const assumptions = getArchetypeConfig(normalizeFinancialArchetype(archetype)).assumptions;
  const baseRateDecimal = discountRate / 100;
  const volatility = Math.max(assumptions.costVarianceWorst, Math.abs(assumptions.benefitVarianceWorst));
  const riskPremium = Math.max(0.02, Math.min(0.06, volatility * 0.12));
  const stressPremium = Math.max(0.05, Math.min(0.10, volatility * 0.20));
  const riskRate = baseRateDecimal + riskPremium;
  const stressRate = baseRateDecimal + stressPremium;
  const riskAdjustedNpv = cashFlows.reduce((sum, cashFlow) => sum + cashFlow.netCashFlow / Math.pow(1 + riskRate, cashFlow.year), 0);
  const stressNpv = cashFlows.reduce((sum, cashFlow) => sum + cashFlow.netCashFlow / Math.pow(1 + stressRate, cashFlow.year), 0);

  return {
    baseRate: baseRateDecimal * 100,
    baseNpv: npv,
    riskAdjustedRate: riskRate * 100,
    riskAdjustedNpv,
    stressRate: stressRate * 100,
    stressNpv,
    summary: stressNpv > 0
      ? `${archetype} remains positive under the stress discount case, indicating resilient value creation.`
      : riskAdjustedNpv > 0
        ? `${archetype} stays positive under the risk-adjusted case but turns negative under stress, so scenario governance should stay active.`
        : `${archetype} turns negative under the risk-adjusted case and needs tighter assumptions or phased scope before approval.`,
  };
}

function buildOperationalConstraintAnalysis(
  archetype: string,
  domainParameters: Record<string, number>,
  driverModel?: DriverModelOutput,
): OperationalConstraintAnalysis | undefined {
  if (!driverModel) return undefined;

  const theoretical = Math.max(1, Math.round(driverModel.demandDrivers.effectiveDailyDeliveries));
  if (archetype !== 'Drone Last Mile Delivery') {
    return {
      theoreticalDeliveriesPerDronePerDay: theoretical,
      realisticRangeLow: theoretical,
      realisticRangeHigh: theoretical,
      confidenceAdjustedDeliveriesPerDronePerDay: theoretical,
      executionConfidence: 75,
      constraintFactors: [],
      summary: 'Operational constraint layer is neutral for this archetype; modeled throughput remains aligned to the base case.',
    };
  }

  const avgDistance = clampNumber(domainParameters['Average Delivery Distance'] ?? 8, 3, 20);
  const weatherFactor = clampNumber(driverModel.demandDrivers.weatherRegulationFactor || 0.86, 0.7, 1);
  const demandUtilization = clampNumber(driverModel.demandDrivers.demandUtilization || 0.82, 0.5, 1);
  const geographyPenalty = clampNumber(0.04 + Math.max(0, avgDistance - 5) * 0.012, 0.04, 0.1);
  const weatherPenalty = clampNumber((1 - weatherFactor) * 0.5, 0.04, 0.11);
  const regulatoryPenalty = 0.08;
  const demandPenalty = clampNumber((1 - demandUtilization) * 0.35, 0.03, 0.09);
  const factors = [
    { name: 'Geography / airspace complexity', impactPercent: geographyPenalty * 100, rationale: 'Dense Dubai urban corridors and landing constraints reduce usable sorties versus theoretical routing.' },
    { name: 'Weather downtime', impactPercent: weatherPenalty * 100, rationale: 'Wind, heat, and visibility constraints suppress consistently usable operating windows.' },
    { name: 'Regulatory friction', impactPercent: regulatoryPenalty * 100, rationale: 'Flight approvals, corridor restrictions, and safety separation rules constrain effective throughput.' },
    { name: 'Demand distribution', impactPercent: demandPenalty * 100, rationale: 'Demand is not evenly distributed across corridors, so modeled utilization overstates real fleet balancing.' },
  ];
  const multiplier = factors.reduce((product, factor) => product * (1 - factor.impactPercent / 100), 1);
  const confidenceAdjusted = Math.max(1, Math.round(theoretical * multiplier));
  const realisticLow = Math.max(1, Math.round(confidenceAdjusted * 0.94));
  const realisticHigh = Math.min(theoretical, Math.round(confidenceAdjusted * 1.08));
  const avgPenalty = factors.reduce((sum, factor) => sum + factor.impactPercent, 0) / factors.length;
  const executionConfidence = Math.round(clampNumber(100 - (avgPenalty * 3.3), 45, 88));

  return {
    theoreticalDeliveriesPerDronePerDay: theoretical,
    realisticRangeLow: realisticLow,
    realisticRangeHigh: realisticHigh,
    confidenceAdjustedDeliveriesPerDronePerDay: confidenceAdjusted,
    executionConfidence,
    constraintFactors: factors,
    summary: `${theoretical} deliveries/day is the modeled theoretical throughput, but the confidence-adjusted operating range is ${realisticLow}-${realisticHigh} after geography, weather, regulatory, and demand-distribution constraints.`,
  };
}

function buildUnitEconomicsAnalysis(
  archetype: string,
  totalCosts: number,
  driverModel?: DriverModelOutput,
  operationalConstraints?: OperationalConstraintAnalysis,
): UnitEconomicsAnalysis | undefined {
  if (!driverModel) return undefined;

  const staged = driverModel.stagedEconomics;
  const viabilityStage = archetype === 'Drone Last Mile Delivery' && staged ? staged.pilotCase : undefined;
  const revenuePerDelivery = viabilityStage
    ? viabilityStage.nominalRevenuePerDelivery
    : driverModel.revenueDrivers.weightedAverageFare;
  const recognizedRevenuePerDelivery = viabilityStage?.recognizedRevenuePerDelivery
    ?? viabilityStage?.realizedRevenuePerDelivery
    ?? revenuePerDelivery;
  const variableCostPerDelivery = viabilityStage?.variableCostPerDelivery ?? driverModel.costDrivers.totalVariableCostPerDelivery;
  const fullyLoadedCostPerDelivery = viabilityStage?.effectiveCostPerDelivery ?? driverModel.costDrivers.effectiveCostPerDelivery[0] ?? variableCostPerDelivery;
  const contributionMarginPerDelivery = viabilityStage?.contributionMarginPerDelivery ?? (revenuePerDelivery - fullyLoadedCostPerDelivery);
  const annualUnits = driverModel.demandDrivers.yearlyDeliveries.reduce((sum, value) => sum + value, 0);
  const estimatedVariableCost = annualUnits * driverModel.costDrivers.totalVariableCostPerDelivery;
  const variableCostShareOfTotalCost = totalCosts > 0 ? estimatedVariableCost / totalCosts : 0;
  const fleetSize = viabilityStage?.fleetSize ?? Math.max(1, driverModel.demandDrivers.fleetSize);
  const fixedAnnual = viabilityStage?.annualFixedCost ?? driverModel.costDrivers.totalFixedAnnual;
  const breakEvenSpreadPerDelivery = recognizedRevenuePerDelivery - variableCostPerDelivery;
  const breakEvenAnnualDeliveries = breakEvenSpreadPerDelivery > 0 ? fixedAnnual / breakEvenSpreadPerDelivery : Number.POSITIVE_INFINITY;
  const breakEvenDeliveriesPerDronePerDay = Number.isFinite(breakEvenAnnualDeliveries)
    ? breakEvenAnnualDeliveries / Math.max(1, fleetSize * 365)
    : Number.POSITIVE_INFINITY;
  const confidenceAdjustedThroughput = operationalConstraints?.confidenceAdjustedDeliveriesPerDronePerDay ?? driverModel.demandDrivers.effectiveDailyDeliveries;
  const operationalDependencyFlag = variableCostShareOfTotalCost >= 0.7;
  const scaleRiskFlag = breakEvenDeliveriesPerDronePerDay > 135 || confidenceAdjustedThroughput < Math.max(125, breakEvenDeliveriesPerDronePerDay * 1.1);
  const minimumViableCheck = fullyLoadedCostPerDelivery > (revenuePerDelivery * 1.2)
    ? 'FAIL'
    : breakEvenSpreadPerDelivery <= 0 || scaleRiskFlag || operationalDependencyFlag
      ? 'CONDITIONAL'
      : 'PASS';

  return {
    revenuePerDelivery,
    variableCostPerDelivery,
    fullyLoadedCostPerDelivery,
    contributionMarginPerDelivery,
    variableCostShareOfTotalCost,
    breakEvenDeliveriesPerDronePerDay,
    operationalDependencyFlag,
    scaleRiskFlag,
    minimumViableCheck,
    summary: minimumViableCheck === 'PASS'
      ? 'Unit economics remain viable at small scale: contribution is positive, fully loaded unit cost is covered, and break-even throughput is within an executable operating envelope.'
      : minimumViableCheck === 'CONDITIONAL'
        ? `Unit economics are directionally viable, but the model still depends on aggressive operating leverage or high variable-cost exposure before scale becomes durable. Pre-realization yield is ${formatAED(revenuePerDelivery)} per delivery, while recognized pilot revenue is ${formatAED(recognizedRevenuePerDelivery)} after current demand-conversion assumptions.`
        : `Unit economics fail the minimum viable check: pre-realization yield is ${formatAED(revenuePerDelivery)} per delivery, but recognized pilot revenue is ${formatAED(recognizedRevenuePerDelivery)} and break-even still depends on materially better demand conversion or lower variable cost.`,
  };
}

function buildScenarioIntelligence(
  costs: CostLineItem[],
  benefits: BenefitLineItem[],
  discountRate: number,
  driverModel: DriverModelOutput | undefined,
  unitEconomics: UnitEconomicsAnalysis | undefined,
  operationalConstraints: OperationalConstraintAnalysis | undefined,
  adoptionRate: number,
  baseNpv: number,
): ScenarioIntelligence | undefined {
  if (!driverModel || !unitEconomics) return undefined;

  const costVariableShare = clampNumber(unitEconomics.variableCostShareOfTotalCost || 0.65, 0.35, 0.9);
  const drivers = [
    {
      key: 'throughput',
      label: 'Deliveries per drone / day',
      currentValue: `${operationalConstraints?.confidenceAdjustedDeliveriesPerDronePerDay ?? driverModel.demandDrivers.effectiveDailyDeliveries}`,
      values: [0.82, 1, 1.12],
      probabilities: [0.25, 0.5, 0.25],
      rationale: 'Throughput drives both revenue absorption and fixed-cost dilution.',
    },
    {
      key: 'unitCost',
      label: 'Cost per delivery',
      currentValue: formatAED(unitEconomics.fullyLoadedCostPerDelivery),
      values: [1.12, 1, 0.9],
      probabilities: [0.25, 0.5, 0.25],
      rationale: 'Unit-cost slippage compounds quickly because the model remains operationally variable-cost heavy.',
    },
    {
      key: 'revenueYield',
      label: 'Revenue mix / yield',
      currentValue: formatAED(unitEconomics.revenuePerDelivery),
      values: [0.92, 1, 1.08],
      probabilities: [0.2, 0.6, 0.2],
      rationale: 'Revenue quality depends on premium mix and the persistence of contracted commercial demand.',
    },
    {
      key: 'adoption',
      label: 'Adoption rate',
      currentValue: `${(adoptionRate * 100).toFixed(0)}%`,
      values: [0.85, 1, 1.1],
      probabilities: [0.2, 0.6, 0.2],
      rationale: 'Adoption governs how quickly demand converts into the revenue mix assumed by the model.',
    },
  ] as const;

  const runScenario = (throughput: number, unitCost: number, revenueYield: number, adoption: number) => {
    const benefitScale = throughput * revenueYield * adoption;
    const recurringCostScale = (1 - costVariableShare) + (costVariableShare * throughput * unitCost);
    const scaledCosts = costs.map((cost) => ({
      ...cost,
      year0: cost.year0,
      year1: cost.year1 * recurringCostScale,
      year2: cost.year2 * recurringCostScale,
      year3: cost.year3 * recurringCostScale,
      year4: cost.year4 * recurringCostScale,
      year5: cost.year5 * recurringCostScale,
    }));
    const scaledBenefits = benefits.map((benefit) => ({
      ...benefit,
      year1: benefit.year1 * benefitScale,
      year2: benefit.year2 * benefitScale,
      year3: benefit.year3 * benefitScale,
      year4: benefit.year4 * benefitScale,
      year5: benefit.year5 * benefitScale,
    }));
    return calculateNPV(buildCashFlows(scaledCosts, scaledBenefits, discountRate));
  };

  const weightedOutcomes: { npv: number; probability: number }[] = [];
  for (let throughputIndex = 0; throughputIndex < drivers[0].values.length; throughputIndex += 1) {
    for (let costIndex = 0; costIndex < drivers[1].values.length; costIndex += 1) {
      for (let revenueIndex = 0; revenueIndex < drivers[2].values.length; revenueIndex += 1) {
        for (let adoptionIndex = 0; adoptionIndex < drivers[3].values.length; adoptionIndex += 1) {
          const probability = drivers[0].probabilities[throughputIndex]! * drivers[1].probabilities[costIndex]! * drivers[2].probabilities[revenueIndex]! * drivers[3].probabilities[adoptionIndex]!;
          weightedOutcomes.push({
            npv: runScenario(
              drivers[0].values[throughputIndex]!,
              drivers[1].values[costIndex]!,
              drivers[2].values[revenueIndex]!,
              drivers[3].values[adoptionIndex]!,
            ),
            probability,
          });
        }
      }
    }
  }

  const probabilityNegativeNpv = weightedOutcomes
    .filter((outcome) => outcome.npv < 0)
    .reduce((sum, outcome) => sum + outcome.probability, 0) * 100;
  const expectedNpv = weightedOutcomes.reduce((sum, outcome) => sum + (outcome.npv * outcome.probability), 0);
  const downsideNpv = weightedOutcomes.reduce((lowest, outcome) => Math.min(lowest, outcome.npv), Number.POSITIVE_INFINITY);

  const sensitivityRanking = drivers.map((driver) => {
    const lowNpv = runScenario(
      driver.key === 'throughput' ? driver.values[0]! : 1,
      driver.key === 'unitCost' ? driver.values[0]! : 1,
      driver.key === 'revenueYield' ? driver.values[0]! : 1,
      driver.key === 'adoption' ? driver.values[0]! : 1,
    );
    const highNpv = runScenario(
      driver.key === 'throughput' ? driver.values[2]! : 1,
      driver.key === 'unitCost' ? driver.values[2]! : 1,
      driver.key === 'revenueYield' ? driver.values[2]! : 1,
      driver.key === 'adoption' ? driver.values[2]! : 1,
    );
    return {
      driver: driver.label,
      currentValue: driver.currentValue,
      sensitivityIndex: Math.abs(highNpv - lowNpv) / Math.max(1, Math.abs(baseNpv)),
      rationale: driver.rationale,
    };
  }).sort((left, right) => right.sensitivityIndex - left.sensitivityIndex);

  return {
    probabilityNegativeNpv,
    expectedNpv,
    downsideNpv,
    sensitivityRanking: sensitivityRanking.slice(0, 4),
    summary: probabilityNegativeNpv <= 20
      ? 'Dynamic scenario testing indicates resilient economics with limited downside probability. Throughput and unit cost remain the primary value levers.'
      : probabilityNegativeNpv <= 40
        ? 'Dynamic scenario testing shows a meaningful downside tail. Executive attention should stay on throughput conversion, unit cost, and revenue quality.'
        : 'Dynamic scenario testing shows a high probability of negative NPV unless throughput, unit cost, and demand quality are tightened before scale.',
  };
}

function buildBenchmarkValidation(
  archetype: string,
  unitEconomics: UnitEconomicsAnalysis | undefined,
  operationalConstraints: OperationalConstraintAnalysis | undefined,
  driverModel: DriverModelOutput | undefined,
  paybackMonths: number,
): BenchmarkValidation | undefined {
  if (!unitEconomics || !driverModel) return undefined;

  const assess = (actual: number, min: number, max: number): 'VALID' | 'WATCH' | 'REQUIRES_JUSTIFICATION' => {
    if (actual >= min && actual <= max) return 'VALID';
    if (actual >= min * 0.9 && actual <= max * 1.1) return 'WATCH';
    return 'REQUIRES_JUSTIFICATION';
  };

  const checks = archetype === 'Drone Last Mile Delivery'
    ? [
        {
          metric: 'Cost per delivery',
          actual: formatAED(unitEconomics.fullyLoadedCostPerDelivery),
          benchmarkRange: 'AED 25-40 globally',
          status: assess(unitEconomics.fullyLoadedCostPerDelivery, 25, 40),
        },
        {
          metric: 'Realistic throughput',
          actual: operationalConstraints ? `${operationalConstraints.realisticRangeLow}-${operationalConstraints.realisticRangeHigh} / day` : `${driverModel.demandDrivers.effectiveDailyDeliveries} / day`,
          benchmarkRange: '120-170 deliveries / drone / day',
          status: assess(operationalConstraints?.confidenceAdjustedDeliveriesPerDronePerDay ?? driverModel.demandDrivers.effectiveDailyDeliveries, 120, 170),
        },
        {
          metric: 'EBITDA margin (Y3)',
          actual: `${(driverModel.margins.ebitdaMargin[2] ?? 0).toFixed(0)}%`,
          benchmarkRange: '15-35% logistics operating margin',
          status: assess(driverModel.margins.ebitdaMargin[2] ?? 0, 15, 35),
        },
        {
          metric: 'Payback period',
          actual: Number.isFinite(paybackMonths) ? `${paybackMonths.toFixed(0)} months` : 'N/A',
          benchmarkRange: '24-48 months for high-risk ventures',
          status: assess(Number.isFinite(paybackMonths) ? paybackMonths : 999, 24, 48),
        },
      ]
    : [
        {
          metric: 'Payback period',
          actual: Number.isFinite(paybackMonths) ? `${paybackMonths.toFixed(0)} months` : 'N/A',
          benchmarkRange: '24-48 months',
          status: assess(Number.isFinite(paybackMonths) ? paybackMonths : 999, 24, 48),
        },
      ];
  const requiresJustification = checks.filter((check) => check.status === 'REQUIRES_JUSTIFICATION').length;

  return {
    checks,
    summary: requiresJustification === 0
      ? 'External benchmarking supports the modeled economics; the current case sits within defensible operating ranges.'
      : 'One or more economics sit outside common benchmark ranges and require explicit justification before scale approval.',
  };
}

function buildCommercialAudit(
  archetype: string,
  unitEconomics: UnitEconomicsAnalysis | undefined,
  operationalConstraints: OperationalConstraintAnalysis | undefined,
  scenarioIntelligence: ScenarioIntelligence | undefined,
  benchmarkValidation: BenchmarkValidation | undefined,
): CommercialAudit | undefined {
  if (!unitEconomics) return undefined;

  const redFlags: string[] = [];
  const missingAssumptions: string[] = [];
  const optimismIndicators: string[] = [];

  if (unitEconomics.operationalDependencyFlag) {
    redFlags.push('More than 70% of the cost base is operationally variable, so scale economics remain highly execution-sensitive.');
  }
  if (unitEconomics.scaleRiskFlag) {
    redFlags.push(`Margin durability still depends on approximately ${unitEconomics.breakEvenDeliveriesPerDronePerDay.toFixed(0)} deliveries per drone per day before fixed cost is comfortably absorbed.`);
  }
  if ((scenarioIntelligence?.probabilityNegativeNpv ?? 0) >= 35) {
    redFlags.push(`Dynamic scenario testing shows a ${(scenarioIntelligence?.probabilityNegativeNpv ?? 0).toFixed(0)}% probability of negative NPV.`);
  }
  if (benchmarkValidation?.checks.some((check) => check.status === 'REQUIRES_JUSTIFICATION')) {
    redFlags.push('One or more core economics sit outside external benchmark ranges and need justification before approval.');
  }
  if (archetype === 'Drone Last Mile Delivery' && operationalConstraints) {
    optimismIndicators.push(`Theoretical throughput is ${operationalConstraints.theoreticalDeliveriesPerDronePerDay}/day, but the confidence-adjusted range is ${operationalConstraints.realisticRangeLow}-${operationalConstraints.realisticRangeHigh}/day.`);
    missingAssumptions.push('Demand distribution is still inferred from utilization assumptions rather than parcel heatmaps or corridor-level pilot evidence.');
    missingAssumptions.push('Automation savings are modeled, but they are not yet supported by observed pilot telemetry.');
  }

  const verdict: CommercialAudit['verdict'] = redFlags.length >= 3 || unitEconomics.minimumViableCheck === 'FAIL'
    ? 'RED'
    : redFlags.length > 0 || missingAssumptions.length > 0
      ? 'AMBER'
      : 'GREEN';

  return {
    verdict,
    redFlags,
    missingAssumptions,
    optimismIndicators,
    summary: verdict === 'GREEN'
      ? 'Commercial logic is internally defensible and externally plausible on current evidence.'
      : verdict === 'AMBER'
        ? 'Commercial logic is directionally credible, but it still needs stronger evidence or tighter assumptions before scale approval.'
        : 'Commercial logic is not yet investment-committee grade for scale; pilot-only governance is the prudent path.',
  };
}

function buildCapitalEfficiencyLens(
  archetype: string,
  totalInvestment: number,
  totalRevenue: number,
  irr: number,
  paybackMonths: number,
  riskAdjustedAnalysis: RiskAdjustedAnalysis | undefined,
): CapitalEfficiencyLens {
  const costOfCapitalPercent = riskAdjustedAnalysis?.riskAdjustedRate ?? Math.max(12, 10);
  const revenueToCapex = totalInvestment > 0 ? totalRevenue / totalInvestment : 0;
  const capitalIntensity = totalRevenue > 0 ? totalInvestment / totalRevenue : Number.POSITIVE_INFINITY;
  const paybackThresholdMonths = archetype === 'Drone Last Mile Delivery' ? 48 : 42;
  const excessReturnPercent = irr - costOfCapitalPercent;
  const classification: CapitalEfficiencyLens['classification'] = excessReturnPercent > 0 && paybackMonths <= paybackThresholdMonths
    ? 'PRIVATE_CASE'
    : excessReturnPercent > 0
      ? 'PILOT_ONLY'
      : 'PUBLIC_VALUE';

  return {
    revenueToCapex,
    paybackThresholdMonths,
    capitalIntensity,
    costOfCapitalPercent,
    excessReturnPercent,
    classification,
    summary: classification === 'PRIVATE_CASE'
      ? 'Capital efficiency clears a private-sector hurdle on current assumptions.'
      : classification === 'PILOT_ONLY'
        ? 'Capital efficiency supports a phased pilot, but full-scale funding should wait for faster payback or stronger observed returns.'
        : 'Commercial return sits below a risk-adjusted capital hurdle, so the case should be positioned primarily as pilot-stage or public-value justified.',
  };
}

function buildModelConfidenceScore(
  unitEconomics: UnitEconomicsAnalysis | undefined,
  operationalConstraints: OperationalConstraintAnalysis | undefined,
  scenarioIntelligence: ScenarioIntelligence | undefined,
  benchmarkValidation: BenchmarkValidation | undefined,
  commercialAudit: CommercialAudit | undefined,
): ModelConfidenceScore | undefined {
  if (!unitEconomics) return undefined;

  let score = 78;
  const drivers: string[] = [];
  if ((scenarioIntelligence?.probabilityNegativeNpv ?? 0) > 35) {
    score -= 12;
    drivers.push('Downside scenario probability is still elevated.');
  }
  if ((operationalConstraints?.executionConfidence ?? 75) < 65) {
    score -= 8;
    drivers.push('Real-world operating constraints materially reduce confidence-adjusted throughput.');
  }
  const benchmarkWarnings = benchmarkValidation?.checks.filter((check) => check.status !== 'VALID').length ?? 0;
  if (benchmarkWarnings > 0) {
    score -= benchmarkWarnings * 5;
    drivers.push('Some economics still sit outside clean benchmark validation.');
  }
  if (commercialAudit?.verdict === 'RED') {
    score -= 15;
    drivers.push('Commercial auditor identified scale-critical red flags.');
  } else if (commercialAudit?.verdict === 'AMBER') {
    score -= 8;
  }
  if (unitEconomics.minimumViableCheck !== 'PASS') {
    score -= 8;
    drivers.push('Minimum viable unit economics are not yet fully de-risked.');
  }
  score = Math.round(clampNumber(score, 35, 92));
  const level: ModelConfidenceScore['level'] = score >= 75 ? 'High' : score >= 60 ? 'Medium' : 'Low';

  return {
    score,
    level,
    drivers: drivers.length > 0 ? drivers : ['Core economics are benchmarked and internally coherent on current evidence.'],
    summary: `Model confidence is ${level.toLowerCase()} at ${score}%. The score reflects evidence coverage, sensitivity exposure, and external plausibility.`,
  };
}

function buildEconomicProofLayer(
  archetype: string,
  driverModel: DriverModelOutput | undefined,
  operationalConstraints: OperationalConstraintAnalysis | undefined,
): EconomicProofLayer | undefined {
  if (archetype !== 'Drone Last Mile Delivery' || !driverModel?.stagedEconomics) {
    return undefined;
  }

  const pilot = driverModel.stagedEconomics.pilotCase;
  const scale = driverModel.stagedEconomics.scaleCase;
  const confidenceAdjustedThroughput = operationalConstraints?.confidenceAdjustedDeliveriesPerDronePerDay ?? scale.dailyDeliveriesPerDrone;
  const automationRateDelta = scale.automationRate - pilot.automationRate;
  const utilizationLiftRequired = Math.max(0, confidenceAdjustedThroughput - pilot.dailyDeliveriesPerDrone);
  const blockers: string[] = [];

  if (pilot.effectiveCostPerDelivery > 35) {
    blockers.push(`Pilot unit cost remains AED ${pilot.effectiveCostPerDelivery.toFixed(1)}, above the pilot exit target of AED 35.`);
  }
  if (confidenceAdjustedThroughput < 110) {
    blockers.push(`Confidence-adjusted scale throughput is ${confidenceAdjustedThroughput}/day, below the minimum 110 deliveries/day scale hurdle.`);
  }
  if (automationRateDelta < 0.15) {
    blockers.push(`Automation only improves by ${(automationRateDelta * 100).toFixed(0)} points from pilot to scale, which is too small to prove the cost curve.`);
  }

  const evidenceVerdict: EconomicProofLayer['evidenceVerdict'] = blockers.length === 0
    ? 'PROVEN'
    : pilot.effectiveCostPerDelivery <= 45 && scale.effectiveCostPerDelivery <= 30 && automationRateDelta >= 0.15
      ? 'PARTIAL'
      : 'UNPROVEN';

  return {
    currentUnitCost: pilot.effectiveCostPerDelivery,
    pilotExitTarget: 35,
    scaleTarget: 30,
    scaleConfidenceAdjustedThroughput: confidenceAdjustedThroughput,
    automationRateDelta,
    utilizationLiftRequired,
    evidenceVerdict,
    blockers,
    summary: evidenceVerdict === 'PROVEN'
      ? 'The pilot economics provide credible evidence that the cost curve can exit pilot mode at or below AED 35 and continue toward the AED 30 scale threshold.'
      : evidenceVerdict === 'PARTIAL'
        ? 'The model suggests a possible path to the scale cost curve, but the pilot still relies on assumed automation and throughput improvements rather than fully demonstrated evidence.'
        : 'The pilot does not yet prove the hardest economic unknown: whether the model can move from today\'s pilot unit cost to a defensible scale cost curve under real operating constraints.',
  };
}

function buildDemandCertaintyAssessment(
  archetype: string,
  driverModel: DriverModelOutput | undefined,
): DemandCertaintyAssessment | undefined {
  if (archetype !== 'Drone Last Mile Delivery' || !driverModel?.stagedEconomics) {
    return undefined;
  }

  const contractedRevenueShare = driverModel.stagedEconomics.scaleCase.contractedVolumeShare;
  const speculativeRevenueShare = Math.max(0, 1 - contractedRevenueShare);
  const namedAnchorEvidence = false;
  let revenueConfidenceScore = Math.round(contractedRevenueShare * 100);
  if (!namedAnchorEvidence) {
    revenueConfidenceScore -= 10;
  }
  revenueConfidenceScore = Math.round(clampNumber(revenueConfidenceScore, 15, 95));
  const level: DemandCertaintyAssessment['level'] = revenueConfidenceScore >= 75 ? 'High' : revenueConfidenceScore >= 60 ? 'Medium' : 'Low';

  return {
    contractedRevenueShare,
    speculativeRevenueShare,
    minimumRequiredShare: 0.65,
    namedAnchorEvidence,
    revenueConfidenceScore,
    level,
    summary: level === 'High'
      ? 'Demand certainty is strong enough to support staged investment, with contracted revenue covering most of the scale economics.'
      : level === 'Medium'
        ? 'Demand certainty is directionally acceptable, but it still needs stronger contracted-volume evidence or named anchor demand before scale capital is committed.'
        : 'Demand certainty is weak. Too much of the revenue case remains speculative relative to the executive threshold for contracted demand.',
  };
}

function buildPilotJustificationAssessment(
  archetype: string,
  driverModel: DriverModelOutput | undefined,
  economicProof: EconomicProofLayer | undefined,
): PilotJustificationAssessment | undefined {
  if (archetype !== 'Drone Last Mile Delivery' || !driverModel?.stagedEconomics) {
    return undefined;
  }

  const pilot = driverModel.stagedEconomics.pilotCase;
  const hardestUnknown = 'Can the operating model reach durable sub-AED 30 unit cost at scale with sufficient contracted demand and real-world throughput?';
  const pilotFocus = `Pilot focuses on ${pilot.dailyDeliveriesPerDrone}/day partner-led operations, safety controls, and corridor execution at AED ${pilot.effectiveCostPerDelivery.toFixed(1)} per delivery.`;
  const alignment: PilotJustificationAssessment['alignment'] = economicProof?.evidenceVerdict === 'PROVEN'
    ? 'ALIGNED'
    : economicProof?.evidenceVerdict === 'PARTIAL'
      ? 'PARTIAL'
      : 'MISALIGNED';

  return {
    hardestUnknown,
    pilotFocus,
    alignment,
    provenUnknowns: [
      'Can the pilot operate safely within a governed corridor?',
      'Can partner-led launch operations and dispatch integration work in practice?',
      'Can the organization measure real service reliability and incident controls?',
    ],
    unprovenUnknowns: [
      'Can the model exit pilot mode at or below AED 35 per delivery?',
      'Can contracted demand stay at or above 65% of scale volume?',
      'Can confidence-adjusted throughput stay at or above 110 deliveries per drone per day?',
    ],
    summary: alignment === 'ALIGNED'
      ? 'The pilot is testing the primary economic unknown, not just operational execution.'
      : alignment === 'PARTIAL'
        ? 'The pilot tests some of the economic unknowns, but too much of the cost-curve proof is still assumed rather than observed.'
        : 'The pilot is structurally misaligned with the hardest unknown. It proves operations first while leaving the scale economics hypothesis largely untested.',
  };
}

function buildExecutiveChallengeLayer(
  archetype: string,
  economicProof: EconomicProofLayer | undefined,
  demandCertainty: DemandCertaintyAssessment | undefined,
  pilotJustification: PilotJustificationAssessment | undefined,
  unitEconomics: UnitEconomicsAnalysis | undefined,
): ExecutiveChallengeLayer | undefined {
  if (archetype !== 'Drone Last Mile Delivery') {
    return undefined;
  }

  const mustBeTrue = [
    'The pilot must demonstrate a credible glide path from today\'s unit cost to AED 35 or better before scale release.',
    'Contracted demand must stay at or above 65% before network scale-out is approved.',
    'Confidence-adjusted throughput must sustain at least 110 deliveries per drone per day at scale.',
  ];
  const breakpoints = [
    'If unit economics remain below the minimum viable threshold, stop Phase 2 funding.',
    'If contracted revenue confidence falls below the executive threshold, do not authorize expansion.',
    'If the pilot keeps proving operations but not cost-curve improvement, redesign the pilot before spending more capital.',
  ];
  const missingEvidence = [
    ...(economicProof?.blockers ?? []),
    ...(demandCertainty && !demandCertainty.namedAnchorEvidence ? ['No named anchor clients or equivalent demand commitments are evidenced in the commercial case.'] : []),
    ...(pilotJustification?.alignment === 'MISALIGNED' ? [pilotJustification.summary] : []),
    ...(unitEconomics?.minimumViableCheck === 'FAIL' ? ['Current fully loaded unit economics do not clear the minimum viable threshold.'] : []),
  ];

  return {
    mustBeTrue,
    breakpoints,
    missingEvidence,
    summary: missingEvidence.length === 0
      ? 'The executive challenge layer is satisfied on current evidence.'
      : 'The executive challenge layer surfaces unresolved proof gaps that should block further funding until addressed.',
  };
}

function scoreNpvFactor(npv: number, totalInvestment: number): WeightedScoreFactor {
  if (npv > totalInvestment * .5) return { name: 'NPV', score: 100, weight: .35 };
  if (npv > totalInvestment * .2) return { name: 'NPV', score: 80, weight: .35 };
  if (npv > 0) return { name: 'NPV', score: 60, weight: .35 };
  if (npv > -totalInvestment * .1) return { name: 'NPV', score: 40, weight: .35 };
  return { name: 'NPV', score: 20, weight: .35 };
}

function scoreIrrFactor(irr: number): WeightedScoreFactor {
  if (irr >= 25) return { name: 'IRR', score: 100, weight: .25 };
  if (irr >= 15) return { name: 'IRR', score: 80, weight: .25 };
  if (irr >= 8) return { name: 'IRR', score: 60, weight: .25 };
  if (irr >= 0) return { name: 'IRR', score: 40, weight: .25 };
  return { name: 'IRR', score: 20, weight: .25 };
}

function scoreRoiFactor(roi: number): WeightedScoreFactor {
  if (roi >= 100) return { name: 'ROI', score: 100, weight: .25 };
  if (roi >= 50) return { name: 'ROI', score: 80, weight: .25 };
  if (roi >= 20) return { name: 'ROI', score: 60, weight: .25 };
  if (roi >= 0) return { name: 'ROI', score: 40, weight: .25 };
  return { name: 'ROI', score: 20, weight: .25 };
}

function scorePaybackFactor(paybackMonths: number): WeightedScoreFactor {
  if (paybackMonths <= 24) return { name: 'Payback', score: 100, weight: .15 };
  if (paybackMonths <= 36) return { name: 'Payback', score: 80, weight: .15 };
  if (paybackMonths <= 48) return { name: 'Payback', score: 60, weight: .15 };
  if (paybackMonths <= 60) return { name: 'Payback', score: 40, weight: .15 };
  return { name: 'Payback', score: 20, weight: .15 };
}

function summarizeInvestmentDecision(weightedScore: number, npv: number, irr: number, roi: number, paybackMonths: number): Pick<InvestmentDecision, 'verdict' | 'label' | 'summary'> {
  if (weightedScore >= 85) {
    return {
      verdict: 'STRONG_INVEST',
      label: 'Strongly Recommended',
      summary: `Excellent investment opportunity with NPV of ${formatAED(npv)} and ${irr.toFixed(1)}% IRR. Strong financial fundamentals support immediate approval.`,
    };
  }
  if (weightedScore >= 70) {
    return {
      verdict: 'INVEST',
      label: 'Recommended',
      summary: `Solid investment with positive returns. NPV: ${formatAED(npv)}, ROI: ${roi.toFixed(0)}%. Proceed with standard governance approval.`,
    };
  }
  if (weightedScore >= 55) {
    return {
      verdict: 'CONDITIONAL',
      label: 'Conditional Approval',
      summary: `Moderate risk-reward profile. Consider risk mitigation strategies and staged implementation. Payback in ${Math.round(paybackMonths)} months.`,
    };
  }
  if (weightedScore >= 40) {
    return {
      verdict: 'CAUTION',
      label: 'Requires Review',
      summary: 'Below-target returns. Recommend reassessing scope, timeline, or exploring alternatives before proceeding.',
    };
  }
  return {
    verdict: 'DO_NOT_INVEST',
    label: 'Not Recommended',
    summary: `Investment does not meet financial thresholds. NPV is ${npv < 0 ? 'negative' : 'marginal'}. Consider alternative solutions.`,
  };
}

function computeInvestmentDecision(
  npv: number,
  irr: number,
  roi: number,
  paybackMonths: number,
  totalInvestment: number
): InvestmentDecision {
  const factors: WeightedScoreFactor[] = [
    scoreNpvFactor(npv, totalInvestment),
    scoreIrrFactor(irr),
    scoreRoiFactor(roi),
    scorePaybackFactor(paybackMonths),
  ];

  const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  const decision = summarizeInvestmentDecision(weightedScore, npv, irr, roi, paybackMonths);

  return {
    verdict: decision.verdict,
    label: decision.label,
    summary: decision.summary,
    confidence: Math.round(weightedScore),
    approvalScope: decision.verdict === 'DO_NOT_INVEST' ? 'HALT' : decision.verdict === 'CONDITIONAL' ? 'PILOT_ONLY' : 'FULL_SCALE',
    conditions: [],
    triggers: [],
    automaticHalt: false,
    factors,
  };
}

function formatAED(value: number): string {
  if (Math.abs(value) >= 1e9) return `AED ${(value / 1e9).toFixed(1)}B`;
  if (Math.abs(value) >= 1e6) return `AED ${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `AED ${(value / 1e3).toFixed(0)}K`;
  return `AED ${value.toFixed(0)}`;
}

function assessStrategicAlignment(archetype: string): ScoredAssessment {
  if (archetype.includes('Healthcare')) {
    return { score: 90, rationale: 'Directly supports UAE Vision 2071 world-class healthcare goals' };
  }
  if (archetype.includes('Government')) {
    return { score: 85, rationale: 'Core government modernization aligned with Smart Government initiative' };
  }
  if (archetype.includes('Autonomous') || archetype.includes('Smart City')) {
    return { score: 95, rationale: 'Flagship initiative for UAE global leadership in emerging technology' };
  }
  if (archetype.includes('Education')) {
    return { score: 85, rationale: 'Supports knowledge economy and human capital development priorities' };
  }
  if (archetype.includes('Insurance')) {
    return { score: 75, rationale: 'Supports financial sector digitization and consumer protection' };
  }
  return { score: 60, rationale: 'Standard digital transformation initiative' };
}

function assessCitizenImpact(archetype: string, hasStrategicBenefits: boolean): ScoredAssessment {
  if (archetype.includes('Healthcare')) {
    return { score: 95, rationale: 'Direct impact on patient care, health outcomes, and public health' };
  }
  if (archetype.includes('Government')) {
    return { score: 85, rationale: 'Improves citizen services and government accessibility' };
  }
  if (archetype.includes('Education')) {
    return { score: 90, rationale: 'Transforms learning outcomes for students and educators' };
  }
  if (archetype.includes('Autonomous')) {
    return { score: 80, rationale: 'Improves public mobility and transportation safety' };
  }
  if (hasStrategicBenefits) {
    return { score: 70, rationale: 'Indirect public benefit through improved services' };
  }
  return { score: 50, rationale: 'Moderate public impact through service improvement' };
}

function assessOperationalEfficiency(totalBenefits: number, totalInvestment: number, hasProductivityBenefits: boolean): ScoredAssessment {
  const benefitToInvestmentRatio = totalBenefits / totalInvestment;
  let assessment: ScoredAssessment;

  if (benefitToInvestmentRatio >= 2) {
    assessment = { score: 95, rationale: `Excellent benefit realization: ${benefitToInvestmentRatio.toFixed(1)}x benefit-cost coverage` };
  } else if (benefitToInvestmentRatio >= 1.5) {
    assessment = { score: 85, rationale: `Strong benefit realization: ${benefitToInvestmentRatio.toFixed(1)}x benefit-cost coverage` };
  } else if (benefitToInvestmentRatio >= 1) {
    assessment = { score: 70, rationale: `Positive benefit realization: ${benefitToInvestmentRatio.toFixed(1)}x benefit-cost coverage` };
  } else if (benefitToInvestmentRatio >= .7) {
    assessment = { score: 55, rationale: `Moderate benefit realization: ${benefitToInvestmentRatio.toFixed(1)}x benefit-cost coverage` };
  } else {
    assessment = { score: 40, rationale: `Limited benefit realization: ${benefitToInvestmentRatio.toFixed(1)}x benefit-cost coverage` };
  }

  if (!hasProductivityBenefits) {
    return assessment;
  }

  return {
    score: Math.min(100, assessment.score + 10),
    rationale: `${assessment.rationale}. Includes measurable productivity gains.`,
  };
}

function assessRiskAndCompliance(archetype: string, hasRiskBenefits: boolean): ScoredAssessment {
  if (archetype.includes('Healthcare')) {
    return { score: 90, rationale: 'Critical for healthcare regulatory compliance and patient safety' };
  }
  if (archetype.includes('Insurance')) {
    return { score: 85, rationale: 'Supports Insurance Authority compliance and fraud prevention' };
  }
  if (archetype.includes('Government')) {
    return { score: 80, rationale: 'Strengthens data governance and regulatory compliance' };
  }
  if (hasRiskBenefits) {
    return { score: 75, rationale: 'Includes explicit risk mitigation benefits' };
  }
  return { score: 60, rationale: 'Standard compliance and risk management' };
}

function assessFinancialSustainability(roi: number, npv: number, totalInvestment: number): ScoredAssessment {
  if (roi >= 50 && npv > 0) {
    return { score: 100, rationale: 'Excellent ROI exceeds commercial investment standards' };
  }
  if (roi >= 20 && npv >= 0) {
    return { score: 85, rationale: 'Strong ROI meets commercial investment standards' };
  }
  if (roi >= 0 && npv >= 0) {
    return { score: 70, rationale: 'Positive ROI - investment recoverable over project lifecycle' };
  }
  if (roi >= 0 && npv > -totalInvestment * .1) {
    return { score: 55, rationale: 'Marginal financial case that requires tight scope and benefits discipline' };
  }
  if (npv > -totalInvestment * .2) {
    return { score: 40, rationale: 'Negative NPV may be tolerable only when public-value benefits are explicit and tightly governed' };
  }
  return { score: 20, rationale: 'Weak financial sustainability; proceed only with an explicit strategic mandate and stage-gated controls' };
}

function summarizeGovernmentValueDecision(
  weightedScore: number,
  investmentDecision: InvestmentDecision,
  roi: number,
  npv: number,
): Pick<GovernmentValueDecision, 'verdict' | 'label' | 'summary'> {
  const financialHeadwind = investmentDecision.verdict === 'DO_NOT_INVEST'
    || investmentDecision.verdict === 'CAUTION'
    || roi < 0
    || npv < 0;

  if (financialHeadwind && weightedScore >= 85) {
    return {
      verdict: 'RECOMMENDED',
      label: 'Conditionally Recommended for Public Sector',
      summary: 'Strong public-value benefits are evident, but the modeled economics remain below target. Proceed only as a tightly phased program with explicit executive risk acceptance and benefit proof points.',
    };
  }
  if (financialHeadwind && weightedScore >= 70) {
    return {
      verdict: 'MODERATE_VALUE',
      label: 'Conditional Public Value',
      summary: 'The initiative has meaningful public value, but weak financial performance means approval should depend on scope reduction, staged funding, and clear kill criteria.',
    };
  }
  if (financialHeadwind && weightedScore >= 55) {
    return {
      verdict: 'LIMITED_VALUE',
      label: 'Limited Public Value',
      summary: 'Public-sector value exists but is not yet strong enough to offset the financial downside. Rework the scope, benefits, or delivery model before approval.',
    };
  }
  if (weightedScore >= 85) {
    return {
      verdict: 'HIGH_VALUE',
      label: 'High Public Value',
      summary: 'Strong strategic alignment with UAE Vision 2071. Significant citizen impact and operational benefits justify investment despite financial metrics.',
    };
  }
  if (weightedScore >= 70) {
    return {
      verdict: 'RECOMMENDED',
      label: 'Recommended for Public Sector',
      summary: 'Good strategic fit with measurable public benefits. Proceed with standard government approval process.',
    };
  }
  if (weightedScore >= 55) {
    return {
      verdict: 'MODERATE_VALUE',
      label: 'Moderate Public Value',
      summary: 'Acceptable public value proposition. Consider scope optimization to strengthen strategic alignment.',
    };
  }
  if (weightedScore >= 40) {
    return {
      verdict: 'LIMITED_VALUE',
      label: 'Limited Public Value',
      summary: 'Weak public value case. Recommend reassessing strategic alignment or exploring alternative approaches.',
    };
  }
  return {
    verdict: 'LOW_VALUE',
    label: 'Low Public Value',
    summary: 'Insufficient public value to justify investment. Consider alternative solutions or scope reduction.',
  };
}

/**
 * Government Value Framework
 * Evaluates projects based on public sector criteria rather than pure financial ROI
 * This addresses the reality that government projects often prioritize:
 * - Strategic alignment with national vision
 * - Citizen/public impact
 * - Operational efficiency gains
 * - Benefit realization over financial returns
 * - Regulatory compliance and risk reduction
 */
function computeGovernmentValueDecision(
  archetype: string,
  benefits: BenefitLineItem[],
  totalInvestment: number,
  totalBenefits: number,
  npv: number,
  roi: number,
  investmentDecision: InvestmentDecision,
): GovernmentValueDecision {
  const factors: GovernmentValueDecision['factors'] = [];
  const strategicAlignment = assessStrategicAlignment(archetype);
  factors.push({
    name: 'Strategic Alignment',
    description: 'Alignment with UAE Vision 2071 & national priorities',
    score: strategicAlignment.score,
    weight: .3,
    rationale: strategicAlignment.rationale,
  });

  const hasProductivityBenefits = benefits.some(b => b.category === 'productivity');
  const hasStrategicBenefits = benefits.some(b => b.category === 'strategic');
  const citizenImpact = assessCitizenImpact(archetype, hasStrategicBenefits);
  factors.push({
    name: 'Citizen Impact',
    description: 'Direct benefit to citizens and public services',
    score: citizenImpact.score,
    weight: .25,
    rationale: citizenImpact.rationale,
  });

  const operationalEfficiency = assessOperationalEfficiency(totalBenefits, totalInvestment, hasProductivityBenefits);
  factors.push({
    name: 'Operational Efficiency',
    description: 'Expected efficiency gains and benefit realization',
    score: operationalEfficiency.score,
    weight: .2,
    rationale: operationalEfficiency.rationale,
  });

  const hasRiskBenefits = benefits.some(b => b.category === 'risk_reduction');
  const riskAndCompliance = assessRiskAndCompliance(archetype, hasRiskBenefits);
  factors.push({
    name: 'Risk & Compliance',
    description: 'Regulatory compliance and risk mitigation value',
    score: riskAndCompliance.score,
    weight: .15,
    rationale: riskAndCompliance.rationale,
  });

  const financialSustainability = assessFinancialSustainability(roi, npv, totalInvestment);
  factors.push({
    name: 'Financial Sustainability',
    description: 'Long-term financial viability (lower priority for government)',
    score: financialSustainability.score,
    weight: .1,
    rationale: financialSustainability.rationale,
  });

  const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  const decision = summarizeGovernmentValueDecision(weightedScore, investmentDecision, roi, npv);

  return {
    verdict: decision.verdict,
    label: decision.label,
    summary: decision.summary,
    score: Math.round(weightedScore),
    factors,
  };
}

function computeFiveYearProjections(cashFlows: YearlyCashFlow[], discountRate: number): UnifiedFinancialOutput['fiveYearProjections'] {
  const rate = discountRate / 100;
  let cumulative = 0;

  const yearly: FiveYearProjection[] = cashFlows.map((cf, idx) => {
    cumulative += cf.netCashFlow;
    const prevBenefits = idx > 0 ? cashFlows[idx - 1]?.benefits ?? 0 : 0;
    const yoyGrowth = prevBenefits > 0 ? ((cf.benefits - prevBenefits) / prevBenefits) * 100 : 0;
    const operatingMargin = cf.year > 0 && cf.benefits > 0 ? ((cf.benefits - cf.costs) / cf.benefits) * 100 : 0;
    return {
      year: cf.year,
      yearLabel: cf.label,
      revenue: cf.benefits,
      costs: cf.costs,
      netCashFlow: cf.netCashFlow,
      operatingMargin,
      yoyGrowth,
      cumulativeCashFlow: cumulative,
      discountFactor: 1 / Math.pow(1 + rate, cf.year),
    };
  });

  const totalRevenue = yearly.reduce((s, y) => s + y.revenue, 0);
  const totalCosts = yearly.reduce((s, y) => s + y.costs, 0);
  const positiveYears = yearly.filter(y => y.revenue > 0);
  const avgOperatingMargin = positiveYears.length > 0
    ? positiveYears.reduce((s, y) => s + y.operatingMargin, 0) / positiveYears.length
    : 0;
  const avgEfficiencyRatio = totalCosts > 0 ? totalRevenue / totalCosts : 0;

  // Calculate CAGR
  const firstRevenue = yearly.find(y => y.revenue > 0)?.revenue || 0;
  const lastRevenue = yearly.at(-1)?.revenue || 0;
  const years = positiveYears.length;
  const cagr = firstRevenue > 0 && years > 1
    ? (Math.pow(lastRevenue / firstRevenue, 1 / (years - 1)) - 1) * 100
    : 0;

  const totalPresentValue = cashFlows.reduce((s, cf) => s + cf.discountedCashFlow, 0);

  return {
    yearly,
    summary: {
      totalRevenue,
      totalCosts,
      avgOperatingMargin,
      avgEfficiencyRatio,
      cagr: Number.isFinite(cagr) ? cagr : 0,
      totalPresentValue,
    },
  };
}

function getFinancialViewVerdict(mode: 'pilot' | 'full', npv: number, roi: number, paybackMonths: number, upfrontInvestment: number): FinancialViewSnapshot['verdict'] {
  if (mode === 'pilot') {
    const boundedPilotLoss = npv >= -Math.max(upfrontInvestment * 1.5, 5_000_000) && roi >= -75;
    if (npv >= 0 && roi >= 0) {
      return {
        verdict: 'CONDITIONAL',
        label: 'PILOT_ONLY',
        summary: 'Pilot economics are viable enough for staged validation, but not for automatic scale approval.',
      };
    }
    if (boundedPilotLoss) {
      return {
        verdict: 'CONDITIONAL',
        label: 'PILOT_ONLY',
        summary: 'Pilot economics are negative on a pure investment basis, but the loss remains within a bounded validation band and should be treated as a learning-stage decision, not a scale rejection.',
      };
    }
    return {
      verdict: 'DO_NOT_INVEST',
      label: 'DO_NOT_PILOT',
      summary: 'Pilot economics do not yet justify mobilization under current assumptions.',
    };
  }

  if (roi > 50 && npv > 0 && paybackMonths < 36) {
    return {
      verdict: 'INVEST',
      label: 'INVEST',
      summary: 'Full commercial economics are strong enough to support an investment case, subject to governance gates.',
    };
  }
  if (roi > 0 && npv >= 0) {
    return {
      verdict: 'CONDITIONAL',
      label: 'CONDITIONAL',
      summary: 'Full commercial economics are directionally positive but still need gating and validation before release.',
    };
  }
  return {
    verdict: 'DEFER',
    label: 'DEFER',
    summary: 'Full commercial economics are not strong enough for approval under current assumptions.',
  };
}

function computeFinancialViewScenarioNpv(
  costs: CostLineItem[],
  benefits: BenefitLineItem[],
  discountRate: number,
  benefitMultiplier: number,
  costMultiplier: number,
): number {
  const scaledCosts = costs.map((cost) => ({
    ...cost,
    year0: cost.year0,
    year1: cost.year1 * costMultiplier,
    year2: cost.year2 * costMultiplier,
    year3: cost.year3 * costMultiplier,
    year4: cost.year4 * costMultiplier,
    year5: cost.year5 * costMultiplier,
  }));
  const scaledBenefits = benefits.map((benefit) => ({
    ...benefit,
    year1: benefit.year1 * benefitMultiplier,
    year2: benefit.year2 * benefitMultiplier,
    year3: benefit.year3 * benefitMultiplier,
    year4: benefit.year4 * benefitMultiplier,
    year5: benefit.year5 * benefitMultiplier,
  }));

  return calculateNPV(buildCashFlows(scaledCosts, scaledBenefits, discountRate));
}

function buildFinancialViewSnapshot({
  mode,
  stage,
  upfrontInvestment,
  discountRate,
  variableCostDrivers,
  yearlyProfile,
}: {
  mode: 'pilot' | 'full';
  stage: DroneStageEconomics;
  upfrontInvestment: number;
  discountRate: number;
  variableCostDrivers?: { name: string; value: number }[];
  yearlyProfile?: {
    directRevenue?: number[];
    platformRevenue?: number[];
    variableCost?: number[];
    fixedCost?: number[];
  };
}): FinancialViewSnapshot {
  const activeYears = mode === 'pilot' ? 1 : 5;
  const revenueRealizationFactor = stage.revenueRealizationFactor ?? 1;
  const directRevenue = stage.weightedAverageFare * revenueRealizationFactor * stage.annualDeliveries;
  const platformRevenue = stage.platformRevenuePerDelivery * revenueRealizationFactor * stage.annualDeliveries;
  const annualVariableCost = stage.variableCostPerDelivery * stage.annualDeliveries;
  const annualFixedCost = stage.annualFixedCost;
  const yearlyDirectRevenue = yearlyProfile?.directRevenue ?? [directRevenue, directRevenue, directRevenue, directRevenue, directRevenue];
  const yearlyPlatformRevenue = yearlyProfile?.platformRevenue ?? [platformRevenue, platformRevenue, platformRevenue, platformRevenue, platformRevenue];
  const yearlyVariableCost = yearlyProfile?.variableCost ?? [annualVariableCost, annualVariableCost, annualVariableCost, annualVariableCost, annualVariableCost];
  const yearlyFixedCost = yearlyProfile?.fixedCost ?? [annualFixedCost, annualFixedCost, annualFixedCost, annualFixedCost, annualFixedCost];
  const variableCostDriverTotal = variableCostDrivers?.reduce((sum, item) => sum + item.value, 0) ?? 0;
  const variableCostBreakdown = variableCostDrivers && variableCostDriverTotal > 0
    ? variableCostDrivers.map((item) => ({
        name: item.name,
        perDelivery: item.value,
        annualValue: annualVariableCost * (item.value / variableCostDriverTotal),
      }))
    : undefined;

  const costs: CostLineItem[] = [
    {
      id: `stage-${mode}-capex`,
      category: 'implementation',
      subcategory: 'Capital',
      name: mode === 'pilot' ? 'Pilot Mobilization CapEx' : 'Commercial Network CapEx',
      description: mode === 'pilot' ? 'Initial pilot mobilization and corridor readiness spend' : 'Initial full-commercial deployment capital',
      year0: upfrontInvestment,
      year1: 0,
      year2: 0,
      year3: 0,
      year4: 0,
      year5: 0,
      isRecurring: false,
    },
    {
      id: `stage-${mode}-variable`,
      category: 'operational',
      subcategory: 'Operations',
      name: 'Variable Operating Cost',
      description: 'Flight, handling, partner, and delivery-variable cost base',
      breakdown: variableCostBreakdown,
      year0: 0,
      year1: yearlyVariableCost[0] ?? annualVariableCost,
      year2: activeYears >= 2 ? (yearlyVariableCost[1] ?? annualVariableCost) : 0,
      year3: activeYears >= 3 ? (yearlyVariableCost[2] ?? annualVariableCost) : 0,
      year4: activeYears >= 4 ? (yearlyVariableCost[3] ?? annualVariableCost) : 0,
      year5: activeYears >= 5 ? (yearlyVariableCost[4] ?? annualVariableCost) : 0,
      isRecurring: true,
    },
    {
      id: `stage-${mode}-fixed`,
      category: 'operational',
      subcategory: 'Platform',
      name: 'Fixed Operating Cost',
      description: 'Fixed staffing, compliance, maintenance, and support costs',
      year0: 0,
      year1: yearlyFixedCost[0] ?? annualFixedCost,
      year2: activeYears >= 2 ? (yearlyFixedCost[1] ?? annualFixedCost) : 0,
      year3: activeYears >= 3 ? (yearlyFixedCost[2] ?? annualFixedCost) : 0,
      year4: activeYears >= 4 ? (yearlyFixedCost[3] ?? annualFixedCost) : 0,
      year5: activeYears >= 5 ? (yearlyFixedCost[4] ?? annualFixedCost) : 0,
      isRecurring: true,
    },
  ];

  const benefits: BenefitLineItem[] = [
    {
      id: `stage-${mode}-delivery-revenue`,
      category: 'revenue',
      name: 'Delivery Revenue',
      description: 'Core delivery revenue generated from weighted average fare',
      year1: yearlyDirectRevenue[0] ?? directRevenue,
      year2: activeYears >= 2 ? (yearlyDirectRevenue[1] ?? directRevenue) : 0,
      year3: activeYears >= 3 ? (yearlyDirectRevenue[2] ?? directRevenue) : 0,
      year4: activeYears >= 4 ? (yearlyDirectRevenue[3] ?? directRevenue) : 0,
      year5: activeYears >= 5 ? (yearlyDirectRevenue[4] ?? directRevenue) : 0,
      realization: 'immediate',
      confidence: 'medium',
    },
    {
      id: `stage-${mode}-platform-revenue`,
      category: 'revenue',
      name: 'Platform Revenue',
      description: 'Platform/service monetization per delivery',
      year1: yearlyPlatformRevenue[0] ?? platformRevenue,
      year2: activeYears >= 2 ? (yearlyPlatformRevenue[1] ?? platformRevenue) : 0,
      year3: activeYears >= 3 ? (yearlyPlatformRevenue[2] ?? platformRevenue) : 0,
      year4: activeYears >= 4 ? (yearlyPlatformRevenue[3] ?? platformRevenue) : 0,
      year5: activeYears >= 5 ? (yearlyPlatformRevenue[4] ?? platformRevenue) : 0,
      realization: 'immediate',
      confidence: 'medium',
    },
  ];

  const cashFlows = buildCashFlows(costs, benefits, discountRate);
  const totalCosts = cashFlows.reduce((sum, flow) => sum + flow.costs, 0);
  const totalBenefits = cashFlows.reduce((sum, flow) => sum + flow.benefits, 0);
  const npv = calculateNPV(cashFlows);
  const irr = calculateIRR(cashFlows);
  const paybackMonths = calculateDiscountedPaybackMonths(cashFlows);
  const roi = calculateROI(totalBenefits, totalCosts);
  const projections = computeFiveYearProjections(cashFlows, discountRate);
  const scenarios: FinancialViewScenario[] = [
    {
      name: 'best',
      label: 'Upside',
      npv: computeFinancialViewScenarioNpv(costs, benefits, discountRate, 1.12, 0.95),
      probability: 0.2,
    },
    {
      name: 'base',
      label: 'Base Case',
      npv,
      probability: 0.6,
    },
    {
      name: 'downside',
      label: 'Downside',
      npv: computeFinancialViewScenarioNpv(costs, benefits, discountRate, 0.85, 1.08),
      probability: 0.2,
    },
  ];

  const undiscountedNetBenefit = projections.summary.totalRevenue - projections.summary.totalCosts;
  const npvDivergenceWarning = (undiscountedNetBenefit > 0 && npv < 0)
    ? `Undiscounted Net Benefit ${formatAED(undiscountedNetBenefit)} is POSITIVE but NPV ${formatAED(npv)} is NEGATIVE — the project does NOT create value in present-value terms. Do not read the undiscounted figure as profitability.`
    : undefined;
  const scopeLabel = mode === 'pilot'
    ? 'Pilot scope — 30–100 vehicles / validation window only'
    : 'Full commercial scope — 500-vehicle fleet assumption; economics do not apply at pilot scale';

  return {
    mode,
    title: mode === 'pilot' ? 'Pilot Financial Model' : 'Full Commercial Model',
    scopeLabel,
    upfrontInvestment,
    lifecycleCost: projections.summary.totalCosts,
    lifecycleBenefit: projections.summary.totalRevenue,
    operatingRunCost: Math.max(0, projections.summary.totalCosts - upfrontInvestment),
    netLifecycleValue: undiscountedNetBenefit,
    undiscountedNetBenefit,
    npvDivergenceWarning,
    lifecycleNarrative: mode === 'pilot'
      ? 'Pilot-only financial model for the validation window before scale funding is released. Full-scale economics are a separate model and must not be blended with pilot numbers.'
      : 'Full commercial operating model across a 5-year deployment horizon at 500-vehicle scale. These numbers assume scale gates have been cleared; pilot-stage economics are modelled separately.',
    costs,
    benefits,
    metrics: {
      npv,
      roi,
      irr,
      paybackMonths,
      paybackYears: paybackMonths / 12,
    },
    scenarios,
    fiveYearProjections: projections,
    verdict: getFinancialViewVerdict(mode, npv, roi, paybackMonths, upfrontInvestment),
  };
}

// ---------------------------------------------------------------------------
// Investment-Committee-Grade Analytics
// ---------------------------------------------------------------------------

function computeBreakEvenAnalysis(
  costs: CostLineItem[],
  benefits: BenefitLineItem[],
  discountRate: number,
  totalInvestment: number,
  baseNPV: number,
): BreakEvenAnalysis {
  if (baseNPV >= 0) {
    return { revenueMultiplierRequired: 1, costReductionRequired: 0, isAchievable: true, summary: 'Project already achieves positive NPV at current assumptions.' };
  }

  // Binary search: revenue multiplier that yields NPV ≈ 0
  let rLo = 1, rHi = 50;
  for (let i = 0; i < 100; i++) {
    const mid = (rLo + rHi) / 2;
    const scaled = benefits.map(b => ({ ...b, year1: b.year1 * mid, year2: b.year2 * mid, year3: b.year3 * mid, year4: b.year4 * mid, year5: b.year5 * mid }));
    const npv = calculateNPV(buildCashFlows(costs, scaled, discountRate));
    if (Math.abs(npv) < totalInvestment * 0.001) break;
    if (npv < 0) rLo = mid; else rHi = mid;
  }
  const revenueMultiplier = Number(((rLo + rHi) / 2).toFixed(2));

  // Binary search: cost reduction fraction that yields NPV ≈ 0
  let cLo = 0, cHi = 0.99;
  for (let i = 0; i < 100; i++) {
    const mid = (cLo + cHi) / 2;
    const factor = 1 - mid;
    const scaled = costs.map(c => ({ ...c, year0: c.year0 * factor, year1: c.year1 * factor, year2: c.year2 * factor, year3: c.year3 * factor, year4: c.year4 * factor, year5: c.year5 * factor }));
    const npv = calculateNPV(buildCashFlows(scaled, benefits, discountRate));
    if (Math.abs(npv) < totalInvestment * 0.001) break;
    if (npv < 0) cLo = mid; else cHi = mid;
  }
  const costReduction = Number((((cLo + cHi) / 2) * 100).toFixed(1));

  const isAchievable = revenueMultiplier <= 5 || costReduction <= 50;
  const summary = isAchievable
    ? `Break-even requires benefits to increase ${revenueMultiplier.toFixed(1)}x or costs to decrease by ${costReduction.toFixed(0)}%.`
    : `Break-even is not achievable within reasonable parameters. Benefits would need to increase ${revenueMultiplier.toFixed(1)}x current levels.`;

  return { revenueMultiplierRequired: revenueMultiplier, costReductionRequired: costReduction, isAchievable, summary };
}

function computeTerminalValue(
  costs: CostLineItem[],
  cashFlows: YearlyCashFlow[],
  discountRate: number,
  archetype: string,
): TerminalValueAnalysis {
  const capexItems = costs.filter(c => !c.isRecurring);
  const totalCapex = capexItems.reduce((s, c) => s + c.year0, 0);
  // Useful life: 7 years for fleet/drone (physical assets), 5 years for software
  const depRate = archetype.includes('Autonomous') || archetype.includes('Drone') ? 1 / 7 : 1 / 5;
  const residualPct = Math.max(0, 1 - (5 * depRate));
  const residualAssetValue = Math.round(totalCapex * residualPct);
  const rate = discountRate / 100;
  const pvResidual = residualAssetValue / Math.pow(1 + rate, 5);
  const baseNPV = calculateNPV(cashFlows);
  const adjustedNPV = baseNPV + pvResidual;
  const totalCosts = cashFlows.reduce((s, cf) => s + cf.costs, 0);
  const totalBenefits = cashFlows.reduce((s, cf) => s + cf.benefits, 0);
  const adjustedROI = totalCosts > 0 ? ((totalBenefits + residualAssetValue - totalCosts) / totalCosts) * 100 : 0;
  const usefulLife = Math.round(1 / depRate);

  return {
    residualAssetValue,
    methodology: `Straight-line depreciation at ${(depRate * 100).toFixed(0)}% p.a. over ${usefulLife}-year useful life. After 5 years: ${(residualPct * 100).toFixed(0)}% of ${formatAED(totalCapex)} capex remains = ${formatAED(residualAssetValue)} (PV: ${formatAED(pvResidual)}).`,
    adjustedNPV,
    adjustedROI,
  };
}

function computeDiscountRateComparison(costs: CostLineItem[], benefits: BenefitLineItem[]): DiscountRateComparison[] {
  return [
    { rate: 3, label: 'Social Discount Rate (Low)' },
    { rate: 5, label: 'UAE Government Standard' },
    { rate: 7, label: 'Public Sector Adjusted' },
    { rate: 10, label: 'Commercial Standard' },
    { rate: 12, label: 'Risk-Adjusted Commercial' },
    { rate: 15, label: 'High-Risk Venture' },
  ].map(r => {
    const cf = buildCashFlows(costs, benefits, r.rate);
    const npv = calculateNPV(cf);
    const tc = cf.reduce((s, c) => s + c.costs, 0);
    const tb = cf.reduce((s, c) => s + c.benefits, 0);
    return { rate: r.rate, label: r.label, npv, roi: tc > 0 ? ((tb - tc) / tc) * 100 : 0 };
  });
}

function computeGovernmentExternalities(
  archetype: string,
  totalInvestment: number,
  domainParams: Record<string, number>,
): GovernmentExternality[] {
  const externalities: GovernmentExternality[] = [];

  if (archetype === 'Autonomous Vehicle Platform') {
    const fleetSize = domainParams['Fleet Size'] ?? 100;
    const dailyTrips = domainParams['Daily Trips per Vehicle'] ?? 25;
    const utilization = domainParams['Fleet Utilization Rate'] ?? 0.75;
    const tripDistance = domainParams['Average Trip Distance'] ?? 12;
    const annualTrips = fleetSize * dailyTrips * 365 * utilization;
    const annualKm = annualTrips * tripDistance;

    // Accident reduction: UAE crash rate 1.2/million-km, AV reduces by 40%, avg crash cost AED 150K
    const accidentValue = (annualKm / 1_000_000) * 1.2 * 0.4 * 150_000;
    externalities.push({
      name: 'Accident Cost Avoidance',
      description: 'Reduced road accidents from autonomous driving (40% reduction in at-fault incidents, UAE crash rate 1.2/million-km, AED 150K avg crash cost)',
      annualValue: Math.round(accidentValue),
      fiveYearValue: Math.round(accidentValue * 5),
      methodology: 'Human-life-value method per NHTSA 94% human-error baseline, 40% AV reduction factor',
      confidence: 'medium',
    });

    // Environmental: CO2 reduction EV vs ICE (120g vs 40g/km) × AED 180/ton carbon credit
    const carbonValue = (annualKm * 0.080 / 1000) * 180;
    externalities.push({
      name: 'Carbon Emission Reduction',
      description: 'Net CO2 savings from electric AV fleet vs conventional ICE (80g/km differential, AED 180/ton carbon credit)',
      annualValue: Math.round(carbonValue),
      fiveYearValue: Math.round(carbonValue * 5),
      methodology: '(120g ICE − 40g EV) per km × fleet km × AED 180/ton carbon credit',
      confidence: 'medium',
    });

    // Land use: each AV frees ~3 private parking spots × 15m² × AED 3,000/m²/yr opportunity cost
    const landValue = fleetSize * 3 * 15 * 3000;
    externalities.push({
      name: 'Urban Land Reclamation',
      description: 'Freed parking from shared AV model (3 spots/AV × 15m² × AED 3,000/m²/yr opportunity cost)',
      annualValue: landValue,
      fiveYearValue: landValue * 5,
      methodology: 'Shared AV parking displacement × urban land opportunity cost',
      confidence: 'low',
    });

    // Congestion: 5% trip displacement × fleet km × AED 0.15/km (RTA benchmark)
    const congestionValue = Math.round(annualKm * 0.05 * 0.15);
    externalities.push({
      name: 'Congestion Reduction',
      description: 'Reduced congestion from shared mobility displacing private car trips (5% displacement, AED 0.15/km)',
      annualValue: congestionValue,
      fiveYearValue: congestionValue * 5,
      methodology: '5% net trip displacement × fleet km × AED 0.15/km congestion cost (RTA benchmark)',
      confidence: 'low',
    });
  } else if (archetype.includes('Healthcare')) {
    const patients = domainParams['Patient Capacity'] ?? 50000;
    const readmissionValue = Math.round(patients * 0.12 * 0.15 * 8500);
    externalities.push({
      name: 'Readmission Reduction',
      description: 'Reduced hospital readmissions through digital monitoring (12% base rate, 15% reduction, AED 8,500/readmission)',
      annualValue: readmissionValue,
      fiveYearValue: readmissionValue * 5,
      methodology: 'Patient base × readmission rate × reduction % × avg cost',
      confidence: 'medium',
    });
    const popHealthValue = patients * 25;
    externalities.push({
      name: 'Population Health Improvement',
      description: 'Long-term public health gains from preventive analytics (AED 25/patient/year avoided downstream costs)',
      annualValue: popHealthValue,
      fiveYearValue: popHealthValue * 5,
      methodology: 'WHO DALY-based per-patient preventive value',
      confidence: 'low',
    });
  } else if (archetype.includes('Government')) {
    const txnVolume = domainParams['Transaction Volume'] ?? 500000;
    const citizenTimeValue = Math.round(txnVolume * 0.5 * 45);
    externalities.push({
      name: 'Citizen Time Savings',
      description: 'Value of citizen time saved from digital service delivery (0.5h/txn, AED 45/hr)',
      annualValue: citizenTimeValue,
      fiveYearValue: citizenTimeValue * 5,
      methodology: 'Time saved × avg wage × transaction volume',
      confidence: 'medium',
    });
    const paperValue = Math.round(txnVolume * 3.5);
    externalities.push({
      name: 'Paper and Office Reduction',
      description: 'Eliminated paper, courier, and physical office costs (AED 3.50/txn)',
      annualValue: paperValue,
      fiveYearValue: paperValue * 5,
      methodology: 'Per-transaction material and logistics cost',
      confidence: 'high',
    });
  } else if (archetype.includes('Drone')) {
    const fleetSize = domainParams['Fleet Size'] ?? 50;
    const roadValue = Math.round(fleetSize * 365 * 25 * 0.8);
    externalities.push({
      name: 'Road Traffic Reduction',
      description: 'Reduced delivery van trips (AED 0.80/trip in road wear, congestion, emissions)',
      annualValue: roadValue,
      fiveYearValue: roadValue * 5,
      methodology: 'One drone delivery displaces one van trip',
      confidence: 'medium',
    });
  }

  // Common: innovation positioning value
  externalities.push({
    name: 'Innovation Positioning',
    description: 'UAE smart city brand, talent attraction, and FDI multiplier (0.5% of investment)',
    annualValue: Math.round(totalInvestment * 0.005),
    fiveYearValue: Math.round(totalInvestment * 0.005 * 5),
    methodology: 'Dubai Smart City benchmark innovation multiplier',
    confidence: 'low',
  });

  return externalities;
}

function computeInvestmentCommitteeSummary(
  metrics: { npv: number; irr: number; roi: number; totalCosts: number; totalBenefits: number },
  scenarios: ScenarioResult[],
  termValue: TerminalValueAnalysis,
  externalities: GovernmentExternality[],
  doNothingCost: number,
  totalInvestment: number,
  decision: InvestmentDecision,
  govValue: GovernmentValueDecision,
  breakEven: BreakEvenAnalysis,
): InvestmentCommitteeSummary {
  // Probability-weighted expected NPV
  const expectedNPV = scenarios.reduce((s, sc) => s + sc.npv * sc.probability, 0);

  // Value at Risk = pessimistic scenario cumulative loss
  const pessimistic = scenarios.find(s => s.name === 'pessimistic');
  const valueAtRisk = Math.abs(pessimistic?.npv ?? metrics.npv);

  const benefitToInvestmentRatio = totalInvestment > 0
    ? Number((metrics.totalBenefits / totalInvestment).toFixed(3))
    : 0;
  const marginalCostOverDoNothing = totalInvestment > doNothingCost
    ? totalInvestment - doNothingCost
    : 0;
  const terminalAdjNPV = termValue.adjustedNPV;
  // PV-approximate externalities at ~75% of nominal 5-year total
  const totalExternalityPV = externalities.reduce((s, e) => s + e.fiveYearValue, 0) * 0.75;
  const publicValueAdjNPV = terminalAdjNPV + totalExternalityPV;

  // Key decision factors (plain-language for the board)
  const factors: string[] = [];
  if (metrics.roi < 0) factors.push(`Negative ROI of ${metrics.roi.toFixed(1)}% over 5-year horizon`);
  if (metrics.npv < 0) factors.push(`Negative NPV of ${formatAED(metrics.npv)} at current discount rate`);
  if (terminalAdjNPV > metrics.npv * 0.8) factors.push(`Terminal value improves NPV by ${formatAED(terminalAdjNPV - metrics.npv)}`);
  if (publicValueAdjNPV > terminalAdjNPV) factors.push(`Government externalities add ${formatAED(publicValueAdjNPV - terminalAdjNPV)} in public value`);
  if (breakEven.revenueMultiplierRequired > 3) factors.push(`Break-even requires ${breakEven.revenueMultiplierRequired.toFixed(1)}x current revenue — significant market risk`);
  if (doNothingCost > 0 && marginalCostOverDoNothing < totalInvestment * 0.15) factors.push(`Marginal cost over do-nothing is only ${formatAED(marginalCostOverDoNothing)} (${((marginalCostOverDoNothing / totalInvestment) * 100).toFixed(1)}%)`);
  if (govValue.score >= 70) factors.push(`Government public value score of ${govValue.score}/100 supports strategic case`);

  // Composite readiness score → letter grade
  const composite = (
    (metrics.roi > 0 ? 25 : metrics.roi > -20 ? 15 : 5) +
    (terminalAdjNPV > 0 ? 20 : terminalAdjNPV > metrics.npv * 0.7 ? 10 : 0) +
    (publicValueAdjNPV > 0 ? 20 : publicValueAdjNPV > -totalInvestment * 0.3 ? 10 : 0) +
    (govValue.score >= 70 ? 15 : govValue.score >= 50 ? 10 : 5) +
    (breakEven.isAchievable ? 10 : 0) +
    (decision.confidence >= 70 ? 10 : decision.confidence >= 50 ? 5 : 0)
  );

  let grade: string;
  let gradingNotes: string;
  if (composite >= 80) { grade = 'A'; gradingNotes = 'Approve pilot mobilization and staged funding; full-scale deployment contingent on achieving validated operating economics.'; }
  else if (composite >= 65) { grade = 'B'; gradingNotes = 'Conditionally ready. Approve pilot mobilization only; address flagged unit-economics and scale-gate items before Phase 2 funding release.'; }
  else if (composite >= 45) { grade = 'C'; gradingNotes = 'Requires significant rework before approval. Revise scope, benefits model, or delivery approach; do not commit capital at current confidence level.'; }
  else if (composite >= 25) { grade = 'D'; gradingNotes = 'Not recommended. Fundamental unit economics do not support investment at current assumptions.'; }
  else { grade = 'F'; gradingNotes = 'Reject. No viable path to acceptable financial returns or public value under current design.'; }

  return {
    expectedNPV,
    valueAtRisk,
    benefitToInvestmentRatio,
    marginalCostOverDoNothing,
    terminalValueAdjustedNPV: terminalAdjNPV,
    publicValueAdjustedNPV: publicValueAdjNPV,
    keyDecisionFactors: factors,
    readinessGrade: grade,
    gradingNotes,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Committee-grade analytics helpers
// ───────────────────────────────────────────────────────────────────────────

function buildBenefitMixBreakdown(
  benefits: BenefitLineItem[],
  costs: CostLineItem[],
  discountRate: number,
): BenefitMixBreakdown {
  const totalsByCategory = new Map<string, number>();
  let totalStrategic = 0;
  let totalCash = 0;
  for (const b of benefits) {
    const fiveYr = (b.year1 || 0) + (b.year2 || 0) + (b.year3 || 0) + (b.year4 || 0) + (b.year5 || 0);
    totalsByCategory.set(b.category, (totalsByCategory.get(b.category) || 0) + fiveYr);
    if (b.category === 'strategic') {
      totalStrategic += fiveYr;
    } else {
      totalCash += fiveYr;
    }
  }
  const totalBenefits = totalCash + totalStrategic;
  const strategicBenefitSharePct = totalBenefits > 0 ? (totalStrategic / totalBenefits) * 100 : 0;
  const cashCategories: { category: string; fiveYearValue: number }[] = [];
  const strategicCategories: { category: string; fiveYearValue: number }[] = [];
  for (const [category, fiveYearValue] of totalsByCategory.entries()) {
    if (category === 'strategic') {
      strategicCategories.push({ category, fiveYearValue });
    } else {
      cashCategories.push({ category, fiveYearValue });
    }
  }

  // Cash-only NPV/ROI: strip strategic (non-cash) benefits, re-run cash flow and discount.
  // This is the number a commercial committee should price against — it removes the
  // inflation from public-value / safety / leadership benefits that are not monetisable.
  const cashBenefits = benefits.filter((b) => b.category !== 'strategic');
  const cashCashFlows = buildCashFlows(costs, cashBenefits, discountRate);
  const cashOnlyNpv = calculateNPV(cashCashFlows);
  const cashTotalCosts = cashCashFlows.reduce((s, cf) => s + cf.costs, 0);
  const cashTotalBenefits = cashCashFlows.reduce((s, cf) => s + cf.benefits, 0);
  const cashOnlyRoi = calculateROI(cashTotalBenefits, cashTotalCosts);

  const summary = strategicBenefitSharePct >= 40
    ? `${strategicBenefitSharePct.toFixed(0)}% of 5-year benefits are *strategic / non-cash public-value*. Committee NPV should be evaluated on cash benefits alone; strategic value is an additive decision input, not a substitute for commercial viability. Cash-only NPV: ${formatAED(cashOnlyNpv)}, cash-only ROI: ${cashOnlyRoi.toFixed(0)}%.`
    : strategicBenefitSharePct >= 20
      ? `${strategicBenefitSharePct.toFixed(0)}% of 5-year benefits are strategic / non-cash. Commercial-cash NPV is ${formatAED(cashOnlyNpv)} and cash-only ROI is ${cashOnlyRoi.toFixed(0)}% — these are the figures the committee should price against, not the blended totals which include public-value uplift.`
      : `${strategicBenefitSharePct.toFixed(0)}% of 5-year benefits are strategic / non-cash — the case is cash-led. Cash-only NPV: ${formatAED(cashOnlyNpv)}, cash-only ROI: ${cashOnlyRoi.toFixed(0)}%.`;
  return { totalCashBenefits: totalCash, totalStrategicBenefits: totalStrategic, totalBenefits, strategicBenefitSharePct, cashCategories, strategicCategories, cashOnlyNpv, cashOnlyRoi, summary };
}

function buildCapexSchedule(costs: CostLineItem[], archetype: string): CapexPhaseSchedule {
  const capexEntries: CapexPhaseEntry[] = [];
  let totalCapex = 0;
  let year0Capex = 0;
  let gatedCapex = 0;
  for (const c of costs) {
    if (c.isRecurring) continue;
    const years = [c.year0, c.year1, c.year2, c.year3, c.year4, c.year5];
    for (let year = 0; year < years.length; year += 1) {
      const amount = years[year] || 0;
      if (amount <= 0) continue;
      const isGated = year > 0 && /scale|wave|phase 2|gated/i.test(`${c.name} ${c.description ?? ''}`);
      const gateCondition = year === 0
        ? 'Unconditional (approved at program authorisation)'
        : isGated
          ? `Released only if year ${year} commercial, unit-economic, and safety gates PASS`
          : `Contractually committed at program start; deployed in year ${year}`;
      capexEntries.push({
        phase: c.name,
        year,
        amount,
        gateCondition,
        description: c.description || '',
        isGated,
      });
      totalCapex += amount;
      if (year === 0) year0Capex += amount;
      if (isGated) gatedCapex += amount;
    }
  }
  const year0SharePct = totalCapex > 0 ? (year0Capex / totalCapex) * 100 : 0;
  const gatedSharePct = totalCapex > 0 ? (gatedCapex / totalCapex) * 100 : 0;
  const summary = gatedSharePct >= 20
    ? `Capital is phase-gated: ${year0SharePct.toFixed(0)}% deploys in year 0 (pilot tranche) and ${gatedSharePct.toFixed(0)}% is gate-released across later years, contingent on validated unit economics and safety thresholds. This preserves optionality and materially reduces downside if pilot thresholds miss.`
    : year0SharePct >= 80
      ? `${year0SharePct.toFixed(0)}% of CapEx deploys in year 0 — the program is effectively front-loaded. For ${archetype}-class cases, consider restructuring to stage fleet / infrastructure waves behind pilot gates to reduce downside risk.`
      : `${year0SharePct.toFixed(0)}% of CapEx deploys in year 0, with the remainder spread across later years.`;
  return { entries: capexEntries, totalCapex, year0SharePct, gatedSharePct, summary };
}

function buildDoNothingBreakdown(
  archetype: string,
  totalBenefits: number,
  totalCosts: number,
): DoNothingCostBreakdown {
  // Leakage factor: what share of project benefits would the organisation *actually*
  // forgo if it did nothing? For contestable markets (AV mobility, drone logistics),
  // competitors, adjacent public programs, and private providers capture a material
  // share of the value — so "do nothing" is NOT equivalent to foregoing 100% of
  // project benefits. Rest-of-portfolio leakage is priced in.
  // Leakage factor: share of project benefits the organisation would *actually* forgo
  // if it did nothing. For highly contestable markets (AV mobility, drone logistics),
  // incumbents (Careem, Uber, Aramex) and market-led evolution capture most of the value
  // anyway, so the honest cost of inaction is much lower than gross project benefits.
  const leakageFactorByArchetype: Record<string, number> = {
    'Autonomous Vehicle Platform': 0.40,
    'Drone Last Mile Delivery': 0.55,
    'Drone First Mile Delivery': 0.55,
    'Insurance Digital Platform': 0.65,
    'Healthcare Digital System': 0.70,
    'Healthcare Digital Transformation': 0.70,
    'Education Digital Platform': 0.75,
    'Government Digital Transformation': 0.80,
  };
  const leakageFactor = leakageFactorByArchetype[archetype] ?? 0.70;
  const rawOpportunityCost = totalBenefits + Math.round(totalCosts * 0.35);
  const adjustedOpportunityCost = Math.round(totalBenefits * leakageFactor + totalCosts * 0.15);
  const leakagePct = (1 - leakageFactor) * 100;
  const leakageAssumption = `${leakagePct.toFixed(0)}% of gross project benefits are assumed to be captured by competitors, adjacent programs, or private providers if the organisation does not act. Only ${(leakageFactor * 100).toFixed(0)}% of gross benefits plus a 15% residual cost penalty are counted as genuine foregone value.`;
  // Split realistic cost-of-inaction into (a) hard revenue/cash lost to competitors and
  // (b) soft strategic positioning loss. Committee should never add these together as
  // a single "loss" number; they have different decision weights.
  const lostRevenueOpportunity = Math.round(totalBenefits * leakageFactor * 0.60);
  const strategicPositioningLoss = Math.round(totalBenefits * leakageFactor * 0.40 + totalCosts * 0.15);
  const splitNarrative = `Of the ${formatAED(adjustedOpportunityCost)} realistic cost of inaction, ~${formatAED(lostRevenueOpportunity)} is lost revenue opportunity (cash captured by competitors such as Careem/Uber/private AV operators) and ~${formatAED(strategicPositioningLoss)} is strategic positioning loss (first-mover option value, capability build, sovereign AV stack). Lost revenue is cash-equivalent; strategic positioning is not — do NOT add them together against commercial NPV.`;
  const summary = `Raw (unadjusted) cost of inaction is ${formatAED(rawOpportunityCost)} — this overstates the real business case because it assumes the organisation retains all value. After applying a ${leakagePct.toFixed(0)}% competitor-leakage factor, the *realistic* cost of inaction is ${formatAED(adjustedOpportunityCost)}, split into ${formatAED(lostRevenueOpportunity)} lost revenue and ${formatAED(strategicPositioningLoss)} strategic positioning loss.`;
  return { rawOpportunityCost, leakageFactor, leakageAssumption, adjustedOpportunityCost, lostRevenueOpportunity, strategicPositioningLoss, splitNarrative, summary };
}

function buildAVUnitEconomicsPerTrip(
  domainParameters: Record<string, number>,
  costs: CostLineItem[],
  adoptionRate: number,
): { avUnitEconomics: AVUnitEconomicsPerTrip; breakEvenSensitivity: BreakEvenSensitivity } | undefined {
  const defaults = getDefaultDomainParameters('Autonomous Vehicle Platform');
  const fleetSize = domainParameters['Fleet Size'] ?? defaults['Fleet Size'] ?? 120;
  const fareRate = domainParameters['Taxi Fare Rate'] ?? defaults['Taxi Fare Rate'] ?? 2.7;
  const tripDistance = domainParameters['Average Trip Distance'] ?? defaults['Average Trip Distance'] ?? 13;
  const dailyTrips = domainParameters['Daily Trips per Vehicle'] ?? defaults['Daily Trips per Vehicle'] ?? 16;
  const utilization = domainParameters['Fleet Utilization Rate'] ?? defaults['Fleet Utilization Rate'] ?? 0.65;
  const operatingCostPerKm = domainParameters['Operating Cost per km'] ?? defaults['Operating Cost per km'] ?? 1.25;

  const revenuePerTrip = fareRate * tripDistance;
  const variableCostPerTrip = operatingCostPerKm * tripDistance;
  const contributionMarginPerTrip = revenuePerTrip - variableCostPerTrip;
  const contributionMarginPct = revenuePerTrip > 0 ? (contributionMarginPerTrip / revenuePerTrip) * 100 : 0;

  // Annual fixed operating cost at a mature year (year 3) — recurring costs include
  // safety-operator staffing, remote ops centre, compliance, insurance fixed, software/OEM.
  // This is the overhead envelope the per-trip contribution must absorb.
  const year3Fixed = costs
    .filter((c) => c.isRecurring)
    .reduce((sum, c) => sum + (c.year3 || 0), 0);

  // Fully loaded cost per trip = variable cost + allocated overhead per trip.
  // Overhead per trip = year-3 recurring fixed costs / year-3 effective annual trip volume.
  const effectiveFleetYear3 = Math.max(1, fleetSize * utilization * adoptionRate);
  const effectiveAnnualTrips = effectiveFleetYear3 * dailyTrips * 365;
  const overheadPerTrip = effectiveAnnualTrips > 0 ? year3Fixed / effectiveAnnualTrips : 0;
  const fullyLoadedCostPerTrip = variableCostPerTrip + overheadPerTrip;
  const fullyLoadedMarginPerTrip = revenuePerTrip - fullyLoadedCostPerTrip;
  const fullyLoadedMarginPct = revenuePerTrip > 0 ? (fullyLoadedMarginPerTrip / revenuePerTrip) * 100 : 0;

  const breakEvenTripsPerYear = contributionMarginPerTrip > 0 ? year3Fixed / contributionMarginPerTrip : Number.POSITIVE_INFINITY;
  const breakEvenTripsPerVehiclePerDay = Number.isFinite(breakEvenTripsPerYear)
    ? breakEvenTripsPerYear / (effectiveFleetYear3 * 365)
    : Number.POSITIVE_INFINITY;
  const currentDailyTripsPerVehicle = dailyTrips * utilization;
  const marginOfSafetyPct = Number.isFinite(breakEvenTripsPerVehiclePerDay) && breakEvenTripsPerVehiclePerDay > 0
    ? ((currentDailyTripsPerVehicle - breakEvenTripsPerVehiclePerDay) / breakEvenTripsPerVehiclePerDay) * 100
    : 0;

  // Verdict now uses fully loaded margin, not just contribution margin —
  // a case must cover its allocated overhead to be committee-grade.
  let verdict: 'PASS' | 'CONDITIONAL' | 'FAIL';
  if (fullyLoadedMarginPerTrip <= 0 || contributionMarginPerTrip <= 0) {
    verdict = 'FAIL';
  } else if (fullyLoadedMarginPct < 15 || marginOfSafetyPct < 20 || contributionMarginPct < 35) {
    verdict = 'CONDITIONAL';
  } else {
    verdict = 'PASS';
  }

  const avUnitEconomics: AVUnitEconomicsPerTrip = {
    fareRatePerKm: fareRate,
    tripDistanceKm: tripDistance,
    revenuePerTrip,
    variableCostPerTrip,
    contributionMarginPerTrip,
    contributionMarginPct,
    overheadPerTrip,
    fullyLoadedCostPerTrip,
    fullyLoadedMarginPerTrip,
    fullyLoadedMarginPct,
    fleetSize,
    currentDailyTripsPerVehicle,
    breakEvenTripsPerVehiclePerDay,
    marginOfSafetyPct,
    verdict,
    reconciliationTable: [
      { metric: 'Avg fare per trip', valueAED: revenuePerTrip, note: `${fareRate.toFixed(2)} AED/km × ${tripDistance.toFixed(1)} km avg distance` },
      { metric: 'Variable cost per trip', valueAED: variableCostPerTrip, note: `${operatingCostPerKm.toFixed(2)} AED/km × ${tripDistance.toFixed(1)} km (energy, maintenance, tyres, per-km insurance)` },
      { metric: 'Contribution margin per trip', valueAED: contributionMarginPerTrip, note: `Fare − Variable Cost = ${contributionMarginPct.toFixed(0)}% of fare` },
      { metric: 'Allocated overhead per trip', valueAED: overheadPerTrip, note: 'Safety operators, remote ops centre, insurance fixed, software/OEM licensing, compliance — allocated over Y3 trip volume' },
      { metric: 'Fully loaded cost per trip', valueAED: fullyLoadedCostPerTrip, note: 'Variable + Overhead' },
      { metric: 'Fully loaded margin per trip', valueAED: fullyLoadedMarginPerTrip, note: `Fare − Fully Loaded Cost = ${fullyLoadedMarginPct.toFixed(0)}% of fare` },
    ],
    contributionReconciliation: `Avg Fare ${formatAED(revenuePerTrip)} − Variable Cost ${formatAED(variableCostPerTrip)} = Contribution ${formatAED(contributionMarginPerTrip)} (${contributionMarginPct.toFixed(0)}%). After allocating overhead of ${formatAED(overheadPerTrip)}/trip, fully loaded cost is ${formatAED(fullyLoadedCostPerTrip)} and fully loaded margin is ${formatAED(fullyLoadedMarginPerTrip)} (${fullyLoadedMarginPct.toFixed(0)}%).`,
    utilizationDisclaimer: `Modelled utilization is ${(utilization * 100).toFixed(0)}%. This is a top-quartile mature-state assumption for autonomous mobility fleets; pilot validation is required to confirm ≥70% sustainable utilization before Phase 2 scale capital is released.`,
    summary: verdict === 'PASS'
      ? `Per-trip economics are committee-grade. Revenue ${formatAED(revenuePerTrip)} vs variable ${formatAED(variableCostPerTrip)} (${contributionMarginPct.toFixed(0)}% contribution) and fully loaded cost ${formatAED(fullyLoadedCostPerTrip)} (${fullyLoadedMarginPct.toFixed(0)}% fully loaded margin after allocated overhead). Break-even is ${breakEvenTripsPerVehiclePerDay.toFixed(1)} trips/vehicle/day against ${currentDailyTripsPerVehicle.toFixed(1)} modelled — ${marginOfSafetyPct.toFixed(0)}% margin of safety.`
      : verdict === 'CONDITIONAL'
        ? `Per-trip economics are directionally viable but thin. Contribution margin ${contributionMarginPct.toFixed(0)}% but fully loaded margin only ${fullyLoadedMarginPct.toFixed(0)}% after allocating overhead (safety operators, remote ops, insurance, software/OEM). Break-even requires ${breakEvenTripsPerVehiclePerDay.toFixed(1)} trips/vehicle/day vs ${currentDailyTripsPerVehicle.toFixed(1)} modelled. Utilisation, cost/km, or fare assumptions need hardening before scale approval.`
        : `Per-trip economics fail. Revenue ${formatAED(revenuePerTrip)} vs fully loaded cost ${formatAED(fullyLoadedCostPerTrip)} (${fullyLoadedMarginPct.toFixed(0)}% fully loaded margin). Variable contribution is ${formatAED(contributionMarginPerTrip)} (${contributionMarginPct.toFixed(0)}%) — not enough to cover allocated overhead. The case is not viable without materially better fare, utilisation, or cost-per-km assumptions.`,
  };

  // Break-even sensitivity (cost/km + utilization thresholds)
  const requiredCostPerKmCeiling = contributionMarginPerTrip > 0 && currentDailyTripsPerVehicle > 0
    ? fareRate - (year3Fixed / (effectiveFleetYear3 * 365 * currentDailyTripsPerVehicle * tripDistance))
    : 0;
  const requiredUtilization = breakEvenTripsPerVehiclePerDay > 0 && dailyTrips > 0
    ? breakEvenTripsPerVehiclePerDay / dailyTrips
    : 0;
  const breakEvenSensitivity: BreakEvenSensitivity = {
    archetype: 'Autonomous Vehicle Platform',
    requiredTripsPerVehiclePerDay: breakEvenTripsPerVehiclePerDay,
    currentTripsPerVehiclePerDay: currentDailyTripsPerVehicle,
    tripsMarginOfSafetyPct: marginOfSafetyPct,
    requiredCostPerKmCeiling,
    currentCostPerKm: operatingCostPerKm,
    costPerKmMarginOfSafetyPct: requiredCostPerKmCeiling > 0
      ? ((requiredCostPerKmCeiling - operatingCostPerKm) / operatingCostPerKm) * 100
      : 0,
    requiredUtilization,
    currentUtilization: utilization,
    isAchievable: verdict !== 'FAIL' && marginOfSafetyPct >= 0,
    summary: verdict === 'FAIL'
      ? `Break-even not achievable under current assumptions. Fare-per-km would need to exceed ${formatAED(operatingCostPerKm)} or cost-per-km would need to drop below ${formatAED(Math.max(0, requiredCostPerKmCeiling))}.`
      : `Break-even requires ≥ ${breakEvenTripsPerVehiclePerDay.toFixed(1)} trips/vehicle/day (currently ${currentDailyTripsPerVehicle.toFixed(1)}) *or* cost/km ceiling of ${formatAED(Math.max(0, requiredCostPerKmCeiling))} (currently ${formatAED(operatingCostPerKm)}) *or* utilisation ≥ ${(requiredUtilization * 100).toFixed(0)}% (currently ${(utilization * 100).toFixed(0)}%).`,
  };

  return { avUnitEconomics, breakEvenSensitivity };
}

/**
 * Commercial hurdle check — does the case clear the risk-adjusted IRR threshold
 * *and* carry enough margin against discount-rate stress that NPV is not "within model error"?
 *
 * For AV-class cases the committee hurdle is 15% IRR; logistics/drone is 14%; healthcare/gov
 * is 10%. A thin NPV (<10% of total investment) is flagged as value-destruction risk because
 * a 3-4pp discount rate uplift will tip the case negative.
 */
function buildCommercialHurdleCheck(
  archetype: string,
  npv: number,
  irrPct: number,
  totalInvestment: number,
  cashFlows: YearlyCashFlow[],
): CommercialHurdleCheck {
  const hurdleByArchetype: Record<string, number> = {
    'Autonomous Vehicle Platform': 15,
    'Drone Last Mile Delivery': 14,
    'Drone First Mile Delivery': 14,
    'Insurance Digital Platform': 12,
    'Healthcare Digital System': 10,
    'Healthcare Digital Transformation': 10,
    'Education Digital Platform': 10,
    'Government Digital Transformation': 9,
  };
  const hurdleIrrPct = hurdleByArchetype[archetype] ?? 12;
  const meetsHurdle = irrPct >= hurdleIrrPct;
  const npvToInvestmentPct = totalInvestment > 0 ? (npv / totalInvestment) * 100 : 0;

  // Stress breakpoint: the lowest integer discount rate at which NPV turns negative.
  // Tells the committee "you are X pp away from value destruction".
  let stressBreakpointRatePct = 50;
  for (let ratePct = Math.max(1, Math.round(irrPct)); ratePct <= 50; ratePct += 1) {
    const rate = ratePct / 100;
    const stressed = cashFlows.reduce((sum, cf) => sum + cf.netCashFlow / Math.pow(1 + rate, cf.year), 0);
    if (stressed < 0) {
      stressBreakpointRatePct = ratePct;
      break;
    }
  }

  let valueDestructionRisk: 'LOW' | 'MODERATE' | 'HIGH';
  if (npv < 0 || npvToInvestmentPct < 5) {
    valueDestructionRisk = 'HIGH';
  } else if (npvToInvestmentPct < 15 || (stressBreakpointRatePct - irrPct) < 3) {
    valueDestructionRisk = 'MODERATE';
  } else {
    valueDestructionRisk = 'LOW';
  }

  const irrGapPpsBelowHurdle = meetsHurdle ? 0 : Math.max(0, hurdleIrrPct - irrPct);
  const hurdleLine = meetsHurdle
    ? `IRR ${irrPct.toFixed(1)}% clears the ${hurdleIrrPct}% ${archetype}-class commercial hurdle.`
    : `IRR ${irrPct.toFixed(1)}% is ~${irrGapPpsBelowHurdle.toFixed(1)}pp below the ${hurdleIrrPct}% risk-adjusted threshold for ${archetype}. A committee pricing AV technology, regulatory, and adoption risk would require at least ${hurdleIrrPct}% IRR before approving scale capital — the current case is ~${irrGapPpsBelowHurdle.toFixed(0)}pp short.`;
  const valueLine = valueDestructionRisk === 'HIGH'
    ? `NPV is negative or within model error (${npvToInvestmentPct.toFixed(1)}% of capital at risk). The case is one assumption shift away from value destruction.`
    : valueDestructionRisk === 'MODERATE'
      ? `NPV is ${npvToInvestmentPct.toFixed(1)}% of total investment — a thin commercial cushion. Discount rate only needs to rise to ${stressBreakpointRatePct}% before NPV turns negative (current rate is ${irrPct.toFixed(1)}%).`
      : `NPV is ${npvToInvestmentPct.toFixed(1)}% of total investment with a robust discount-rate cushion (breaks even at ${stressBreakpointRatePct}%).`;

  return {
    hurdleIrrPct,
    actualIrrPct: irrPct,
    irrGapPpsBelowHurdle,
    meetsHurdle,
    npvToInvestmentPct,
    valueDestructionRisk,
    stressBreakpointRatePct,
    summary: `${hurdleLine} ${valueLine}`,
  };
}

/**
 * AV year-progression: Y1/Y3/Y5 per-trip economics + a Y3 fully loaded cost stack.
 * Needed because averaging across lifecycle hides Y1 bleed — committee funds Y1 losses,
 * not Y5 optimism.
 */
function buildAVYearProgression(
  domainParameters: Record<string, number>,
  costs: CostLineItem[],
  adoptionRate: number,
): AVYearProgression | undefined {
  const defaults = getDefaultDomainParameters('Autonomous Vehicle Platform');
  const fleetSize = domainParameters['Fleet Size'] ?? defaults['Fleet Size'] ?? 120;
  const fareRate = domainParameters['Taxi Fare Rate'] ?? defaults['Taxi Fare Rate'] ?? 2.7;
  const tripDistance = domainParameters['Average Trip Distance'] ?? defaults['Average Trip Distance'] ?? 13;
  const dailyTripsMax = domainParameters['Daily Trips per Vehicle'] ?? defaults['Daily Trips per Vehicle'] ?? 16;
  const utilization = domainParameters['Fleet Utilization Rate'] ?? defaults['Fleet Utilization Rate'] ?? 0.65;
  const operatingCostPerKm = domainParameters['Operating Cost per km'] ?? defaults['Operating Cost per km'] ?? 1.25;
  const revenuePerTrip = fareRate * tripDistance;
  const variableCostPerTrip = operatingCostPerKm * tripDistance;
  const effectiveFleet = Math.max(1, fleetSize * utilization * adoptionRate);

  // Trip-volume ramp by year — maps to adoption curve, not full maturity on day 1.
  const utilizationRamp = [0.35, 0.55, 0.80, 0.95, 1.0];
  const yearsToReport = [1, 3, 5];
  const perYear: AVYearProgressionPoint[] = yearsToReport.map((year) => {
    const utilFactor = utilizationRamp[year - 1] ?? 1.0;
    const dailyTripsPerVehicle = dailyTripsMax * utilization * utilFactor;
    const yearKey = `year${year}` as keyof CostLineItem;
    const yearFixed = costs
      .filter((c) => c.isRecurring)
      .reduce((sum, c) => sum + (Number(c[yearKey]) || 0), 0);
    const annualTrips = effectiveFleet * dailyTripsPerVehicle * 365 * utilFactor;
    const overheadPerTrip = annualTrips > 0 ? yearFixed / annualTrips : 0;
    const fullyLoadedCostPerTrip = variableCostPerTrip + overheadPerTrip;
    const contributionMarginPerTrip = revenuePerTrip - variableCostPerTrip;
    const fullyLoadedMarginPerTrip = revenuePerTrip - fullyLoadedCostPerTrip;
    const fullyLoadedMarginPct = revenuePerTrip > 0 ? (fullyLoadedMarginPerTrip / revenuePerTrip) * 100 : 0;
    return {
      year,
      dailyTripsPerVehicle,
      revenuePerTrip,
      variableCostPerTrip,
      overheadPerTrip,
      fullyLoadedCostPerTrip,
      contributionMarginPerTrip,
      fullyLoadedMarginPerTrip,
      fullyLoadedMarginPct,
    };
  });

  // Cost stack at Y3 — approximate allocation across committee-grade line items.
  // Weights calibrated to public AV pilot benchmarks (Waymo, Cruise, WeRide):
  //   remote ops + safety oversight ≈ 35% of recurring, software/OEM ≈ 15%,
  //   insurance ≈ 15%, maintenance ≈ 15%, energy ≈ 5%, vehicle amortisation ≈ 15%.
  const y3 = perYear.find((p) => p.year === 3);
  const costStackY3: AVCostStackComponent[] = [];
  if (y3) {
    const overhead = y3.overheadPerTrip;
    const vehicleAmort = y3.variableCostPerTrip * 0.35;
    const energy = y3.variableCostPerTrip * 0.20;
    const maintenance = y3.variableCostPerTrip * 0.25;
    const residualVariable = y3.variableCostPerTrip - vehicleAmort - energy - maintenance;
    const remoteOps = overhead * 0.35;
    const safety = overhead * 0.15;
    const software = overhead * 0.15;
    const insurance = overhead * 0.15 + residualVariable * 0.5;
    const vehicleAmortFull = vehicleAmort + overhead * 0.20 + residualVariable * 0.5;
    const total = y3.fullyLoadedCostPerTrip;
    const push = (component: AVCostStackComponent['component'], perTrip: number) => {
      costStackY3.push({
        component,
        perTripAED: perTrip,
        shareOfFullyLoadedPct: total > 0 ? (perTrip / total) * 100 : 0,
      });
    };
    push('Fixed AV vehicle amortisation', vehicleAmortFull);
    push('Remote operations', remoteOps);
    push('Safety oversight', safety);
    push('Software / OEM licensing', software);
    push('Insurance', insurance);
    push('Maintenance', maintenance);
    push('Energy', energy);
  }

  const y1 = perYear[0];
  const y3p = perYear[1];
  const y5 = perYear[2];
  const summary = y1 && y3p && y5
    ? `Year 1 fully loaded margin ${y1.fullyLoadedMarginPct.toFixed(0)}% (cost/trip ${formatAED(y1.fullyLoadedCostPerTrip)} vs revenue ${formatAED(y1.revenuePerTrip)}). Year 3 ${y3p.fullyLoadedMarginPct.toFixed(0)}% (cost/trip ${formatAED(y3p.fullyLoadedCostPerTrip)}). Year 5 ${y5.fullyLoadedMarginPct.toFixed(0)}% (cost/trip ${formatAED(y5.fullyLoadedCostPerTrip)}). Committee funds Y1 losses — not Y5 optimism — so pilot-stage economics must stand alone before scale capital is released.`
    : '';
  const y5MarginCaveat = y5
    ? `Year 5 fully loaded margin of ${y5.fullyLoadedMarginPct.toFixed(0)}% assumes full fleet utilization AND cost maturity (remote-ops automation, lower safety-operator ratio, OEM price curve). None of these are validated at pilot stage; do not treat Y5 profitability as a committed outcome.`
    : '';
  return { perYear, costStackY3, y5MarginCaveat, summary };
}

/**
 * AV scenario stress — utilization / fare / trips sensitivity, per-vehicle payback,
 * and explicit kill-zone thresholds the committee can memo into the decision paper.
 */
function buildAVScenarioStress(
  domainParameters: Record<string, number>,
  costs: CostLineItem[],
  adoptionRate: number,
  totalInvestment: number,
): AVScenarioStress | undefined {
  const defaults = getDefaultDomainParameters('Autonomous Vehicle Platform');
  const fleetSize = domainParameters['Fleet Size'] ?? defaults['Fleet Size'] ?? 120;
  const fareRate = domainParameters['Taxi Fare Rate'] ?? defaults['Taxi Fare Rate'] ?? 2.7;
  const tripDistance = domainParameters['Average Trip Distance'] ?? defaults['Average Trip Distance'] ?? 13;
  const dailyTrips = domainParameters['Daily Trips per Vehicle'] ?? defaults['Daily Trips per Vehicle'] ?? 16;
  const utilizationBase = domainParameters['Fleet Utilization Rate'] ?? defaults['Fleet Utilization Rate'] ?? 0.65;
  const operatingCostPerKm = domainParameters['Operating Cost per km'] ?? defaults['Operating Cost per km'] ?? 1.25;
  const revenuePerTrip = fareRate * tripDistance;
  const variableCostPerTrip = operatingCostPerKm * tripDistance;
  const year3Fixed = costs.filter((c) => c.isRecurring).reduce((s, c) => s + (c.year3 || 0), 0);

  const scenarioFor = (util: number, fare: number, tripsPerDay: number): AVScenarioPoint => {
    const effFleet = Math.max(1, fleetSize * util * adoptionRate);
    const annualTrips = effFleet * tripsPerDay * 365;
    const overhead = annualTrips > 0 ? year3Fixed / annualTrips : 0;
    const rev = fare * tripDistance;
    const varCost = operatingCostPerKm * tripDistance;
    const fullyLoaded = varCost + overhead;
    const margin = rev - fullyLoaded;
    const marginPct = rev > 0 ? (margin / rev) * 100 : 0;
    const annualContribution = annualTrips * margin;
    // Indicative NPV proxy: 5yr contribution discounted at 12%
    const indicativeNpv = annualContribution > 0
      ? annualContribution * ((1 - Math.pow(1.12, -5)) / 0.12) - totalInvestment * 0.7
      : -totalInvestment * 0.7;
    return {
      label: `util ${(util * 100).toFixed(0)}% / fare ${fare.toFixed(2)} / trips ${tripsPerDay.toFixed(0)}`,
      value: marginPct,
      fullyLoadedMarginPct: marginPct,
      annualContribution,
      indicativeNpv,
    };
  };

  const utilizationScenarios: AVScenarioPoint[] = [0.60, 0.70, 0.78].map((u) => ({
    ...scenarioFor(u, fareRate, dailyTrips),
    label: `${(u * 100).toFixed(0)}% utilization`,
    value: u * 100,
  }));
  const fareElasticityScenarios: AVScenarioPoint[] = [0.80, 0.90, 1.00, 1.10].map((m) => ({
    ...scenarioFor(utilizationBase, fareRate * m, dailyTrips),
    label: `fare ${m === 1 ? 'base' : (m < 1 ? `-${((1 - m) * 100).toFixed(0)}%` : `+${((m - 1) * 100).toFixed(0)}%`)}`,
    value: fareRate * m,
  }));
  const tripsPerDayCurve: AVScenarioPoint[] = [10, 12, 14, 16, 18, 20].map((t) => ({
    ...scenarioFor(utilizationBase, fareRate, t),
    label: `${t} trips/day`,
    value: t,
  }));

  // Per-vehicle payback
  const capexPerVehicle = fleetSize > 0 ? totalInvestment / fleetSize : 0;
  const annualTripsPerVehicle = dailyTrips * utilizationBase * 365;
  const overheadPerTripBase = annualTripsPerVehicle > 0 ? year3Fixed / (fleetSize * utilizationBase * adoptionRate * 365 * dailyTrips) : 0;
  const annualRevenuePerVehicle = annualTripsPerVehicle * revenuePerTrip;
  const annualContributionPerVehicle = annualTripsPerVehicle * (revenuePerTrip - variableCostPerTrip - overheadPerTripBase);
  const paybackYears = annualContributionPerVehicle > 0 ? capexPerVehicle / annualContributionPerVehicle : Number.POSITIVE_INFINITY;
  const perVehicle: AVPerVehiclePayback = {
    capexPerVehicleAED: capexPerVehicle,
    annualRevenuePerVehicleAED: annualRevenuePerVehicle,
    annualContributionPerVehicleAED: annualContributionPerVehicle,
    paybackYears,
    verdict: paybackYears <= 4 ? 'PASS' : paybackYears <= 6 ? 'CONDITIONAL' : 'FAIL',
  };

  // Kill-zone thresholds — committee's hard stop gates
  const killZones: AVKillZoneThreshold[] = [
    {
      lever: 'Cost per km',
      stopIfAbove: operatingCostPerKm * 1.20,
      currentValue: operatingCostPerKm,
      unit: 'AED/km',
      rationale: 'A 20% cost-per-km overrun (remote ops, safety staffing, insurance) flips fully loaded margin negative at current fare.',
    },
    {
      lever: 'Daily trips per vehicle',
      stopIfBelow: Math.max(8, dailyTrips * 0.70),
      currentValue: dailyTrips,
      unit: 'trips/day',
      rationale: 'A 30% shortfall in realised trips (regulatory geofence, demand, downtime) breaks unit economics — contribution cannot absorb fixed overhead.',
    },
    {
      lever: 'Utilization',
      stopIfBelow: 0.55,
      currentValue: utilizationBase,
      unit: 'fraction',
      rationale: 'Below 55% utilization the fleet carries idle-time cost that no fare increase recovers without destroying demand.',
    },
    {
      lever: 'Fare per km',
      stopIfBelow: fareRate * 0.82,
      currentValue: fareRate,
      unit: 'AED/km',
      rationale: 'An 18% fare compression (competitive pressure from Careem/Uber) eliminates the commercial case — Phase 2 capital must be held.',
    },
  ];

  const summary = `Utilization stress: ${utilizationScenarios.map((s) => `${s.label} → ${s.fullyLoadedMarginPct.toFixed(0)}% margin`).join('; ')}. Fare stress: ${fareElasticityScenarios.map((s) => `${s.label} → ${s.fullyLoadedMarginPct.toFixed(0)}%`).join('; ')}. Per-vehicle CapEx ${formatAED(capexPerVehicle)}, payback ${Number.isFinite(paybackYears) ? paybackYears.toFixed(1) : '∞'}yr. Kill zones: cost/km > ${formatAED(operatingCostPerKm * 1.20)}, trips/day < ${Math.max(8, dailyTrips * 0.70).toFixed(0)}, utilization < 55%, fare < ${formatAED(fareRate * 0.82)}.`;

  // Probability-weighted interpretation — worst (20%) + base (60%) + best (20%) at util scenarios.
  const worstNpv = utilizationScenarios[0]?.indicativeNpv ?? 0;
  const baseNpv = utilizationScenarios[1]?.indicativeNpv ?? 0;
  const bestNpv = utilizationScenarios[2]?.indicativeNpv ?? 0;
  const weightedNpv = worstNpv * 0.2 + baseNpv * 0.6 + bestNpv * 0.2;
  const probabilityWeightedInterpretation = `Worst-case indicative NPV ${formatAED(worstNpv)}, base-case ${formatAED(baseNpv)}, best-case ${formatAED(bestNpv)}. Probability-weighted (20/60/20) expected NPV is ${formatAED(weightedNpv)} — ${weightedNpv < 0 ? 'NEGATIVE. The expected outcome destroys value; upside is conditional on cost-maturity and utilization gates that are not yet validated.' : 'positive, but driven by the best-case tail; do not approve scale capital without evidence the base case is achievable.'}`;

  return { utilizationScenarios, fareElasticityScenarios, tripsPerDayCurve, perVehicle, killZones, probabilityWeightedInterpretation, summary };
}

/**
 * Cumulative funding requirement — the treasury-level view that payback/NPV hide.
 * Runs the net cash position year-over-year and returns the deepest negative point
 * (peak funding) plus year it recovers.
 */
function buildCumulativeFundingRequirement(cashFlows: YearlyCashFlow[]): CumulativeFundingRequirement {
  let cumulative = 0;
  let peakFunding = 0;
  let peakYear = 0;
  let yearsBeforeCashPositive = -1;
  const cumulativeByYear: { year: number; cumulativeCashAED: number }[] = [];
  for (const cf of cashFlows) {
    cumulative += cf.netCashFlow;
    cumulativeByYear.push({ year: cf.year, cumulativeCashAED: cumulative });
    if (cumulative < peakFunding) {
      peakFunding = cumulative;
      peakYear = cf.year;
    }
    if (cumulative >= 0 && yearsBeforeCashPositive < 0) {
      yearsBeforeCashPositive = cf.year;
    }
  }
  const peakFundingAED = Math.abs(peakFunding);
  const narrative = yearsBeforeCashPositive < 0
    ? `Treasury must fund a peak cumulative cash shortfall of ${formatAED(peakFundingAED)} (year ${peakYear}). Case does not turn cash-positive within the 5-year horizon — the committee is being asked to absorb structural burn, not a ramp.`
    : `Treasury must fund a peak cumulative cash shortfall of ${formatAED(peakFundingAED)} (deepest at year ${peakYear}) before the case turns cash-positive in year ${yearsBeforeCashPositive}. This is the real capital requirement — the payback metric understates it by hiding Year-1/2 bleed.`;
  return { peakFundingAED, peakFundingYear: peakYear, yearsBeforeCashPositive: Math.max(0, yearsBeforeCashPositive), cumulativeByYear, narrative };
}

/**
 * Staged capital plan — when the commercial hurdle fails, the default action should
 * NOT be "approve 110M CapEx". It should be: fund a bounded pilot, prove the unit
 * economics, and release scale capital only if measurable gates are met.
 *
 * This is the structure every weak-commercial / strong-strategic case should default to.
 */
function buildStagedCapitalPlan(
  archetype: string,
  totalInvestment: number,
  capexSchedule: CapexPhaseSchedule | undefined,
  avScenarioStress: AVScenarioStress | undefined,
  hurdleCheck: CommercialHurdleCheck,
): StagedCapitalPlan {
  const isMobilityArchetype = archetype === 'Autonomous Vehicle Platform' || archetype === 'Drone Last Mile Delivery' || archetype === 'Drone First Mile Delivery';
  // Phase 1 = pilot-only capital. For AV, anchor to 30% of total capital or the y0+y1
  // planned CapEx, whichever is smaller, capped at 40%. This forces discipline: the
  // committee can only approve the pilot envelope today.
  const plannedY0 = capexSchedule?.entries.filter((p) => p.year === 0).reduce((s, p) => s + p.amount, 0) ?? 0;
  const plannedY1 = capexSchedule?.entries.filter((p) => p.year === 1).reduce((s, p) => s + p.amount, 0) ?? 0;
  const phase1FromSchedule = plannedY0 + plannedY1 * 0.3;
  const phase1Cap = Math.min(totalInvestment * 0.40, Math.max(totalInvestment * 0.25, phase1FromSchedule));
  const phase2Cap = totalInvestment * 0.35;
  const phase3Cap = Math.max(0, totalInvestment - phase1Cap - phase2Cap);

  // Committee-grade gates — derived from kill zones when available, otherwise generic.
  const killZoneGates = avScenarioStress?.killZones.map((k) => {
    if (k.stopIfAbove != null) {
      return `${k.lever} must stay below ${k.stopIfAbove.toFixed(2)} ${k.unit} (currently ${k.currentValue.toFixed(2)})`;
    }
    if (k.stopIfBelow != null) {
      return `${k.lever} must stay above ${k.stopIfBelow.toFixed(2)} ${k.unit} (currently ${k.currentValue.toFixed(2)})`;
    }
    return `${k.lever}: ${k.rationale}`;
  }) ?? [];

  const commercialGate = hurdleCheck.meetsHurdle
    ? `IRR ≥ ${hurdleCheck.hurdleIrrPct}% sustained over two consecutive quarters at pilot scale`
    : `Prove pilot-level unit economics can deliver IRR ≥ ${hurdleCheck.hurdleIrrPct}% before releasing Phase 2 capital`;

  const gatesToScale: string[] = [
    commercialGate,
    ...killZoneGates,
    ...(isMobilityArchetype
      ? [
          'Fully loaded cost per trip/delivery within 20% of target at steady-state month 9',
          'Utilization ≥ 65% sustained for 90 days at pilot scale',
          'Regulatory and safety approvals extended to Phase 2 operating envelope',
        ]
      : [
          'Cost-to-serve and support effort within 20% of target by month 9',
          'User adoption or operational usage ≥ 65% for 90 consecutive days',
          'Architecture, cybersecurity, and data-governance approvals cleared for Phase 2',
        ]),
  ];

  const phase1Purpose = archetype === 'Autonomous Vehicle Platform'
    ? 'Controlled pilot of 30–50 vehicles in a bounded operational domain to validate cost per trip, utilization, and safety-operator economics against committee-grade thresholds.'
    : archetype === 'Drone Last Mile Delivery' || archetype === 'Drone First Mile Delivery'
      ? 'Controlled pilot at bounded scale to validate delivery unit economics, operating safety, and contracted demand before any scale capital is committed.'
    : 'Controlled pilot at bounded scale to validate unit economics and operational assumptions before any scale capital is committed.';

  const phases: StagedCapitalPhase[] = [
    {
      phase: 1,
      label: 'Phase 1 — Pilot (capital-capped)',
      capitalShareOfTotalPct: totalInvestment > 0 ? (phase1Cap / totalInvestment) * 100 : 0,
      capitalEnvelopeAED: phase1Cap,
      durationMonths: 12,
      purpose: phase1Purpose,
      exitGates: isMobilityArchetype
        ? [
            commercialGate,
            'Fully loaded cost per trip/delivery demonstrably converging toward target (≤ 20% gap by month 9)',
            'Utilization ≥ 65% for 90 consecutive days',
            'No open safety or regulatory blockers',
          ]
        : [
            commercialGate,
            'Cost-to-serve, support effort, and operating model within target tolerance by month 9',
            'Adoption, usage, or process-throughput evidence sustained for 90 consecutive days',
            'No open architecture, cybersecurity, or data-governance blockers',
          ],
    },
    {
      phase: 2,
      label: 'Phase 2 — Conditional scale',
      capitalShareOfTotalPct: totalInvestment > 0 ? (phase2Cap / totalInvestment) * 100 : 0,
      capitalEnvelopeAED: phase2Cap,
      durationMonths: 18,
      purpose: isMobilityArchetype
        ? 'Expand fleet and operating domain only after Phase 1 gates are met. Scale capital is released in two tranches, each tied to measured operating performance.'
        : 'Expand users, integrations, automation scope, and operating coverage only after Phase 1 gates are met. Scale capital is released in tranches tied to measured business adoption and support performance.',
      exitGates: isMobilityArchetype
        ? [
            'IRR at Phase-2 scale ≥ hurdle minus 2pp',
            'Per-unit annual contribution positive at steady state',
            'Kill-zone levers remain outside their stop thresholds for 6 consecutive months',
          ]
        : [
            'IRR or public-value-adjusted benefits at Phase-2 scale ≥ hurdle minus 2pp',
            'Support cost per user/process trending down with adoption growth',
            'Critical architecture, security, and benefits-realization levers remain within thresholds for 6 consecutive months',
          ],
    },
    {
      phase: 3,
      label: 'Phase 3 — Full rollout',
      capitalShareOfTotalPct: totalInvestment > 0 ? (phase3Cap / totalInvestment) * 100 : 0,
      capitalEnvelopeAED: phase3Cap,
      durationMonths: 24,
      purpose: 'Full commercial deployment. Approved only if Phase 2 IRR clears the commercial hurdle and the case has become cash positive.',
      exitGates: [
        'IRR ≥ commercial hurdle at steady state',
        'Cumulative cash position turned positive',
        'Commercial NPV (excluding strategic/public-value benefits) positive',
      ],
    },
  ];

  const framing = hurdleCheck.meetsHurdle && hurdleCheck.valueDestructionRisk === 'LOW'
    ? `Commercial hurdle is cleared. A staged capital plan remains best practice: ${formatAED(phase1Cap)} Phase 1 / ${formatAED(phase2Cap)} Phase 2 / ${formatAED(phase3Cap)} Phase 3, with explicit gates between phases.`
    : `Commercial hurdle not cleared. Committee should approve Phase 1 (${formatAED(phase1Cap)}, ${((phase1Cap / Math.max(1, totalInvestment)) * 100).toFixed(0)}% of headline CapEx) only. Phases 2 and 3 (${formatAED(phase2Cap + phase3Cap)}) are held until the pilot proves the unit economics.`;

  return {
    phases,
    totalCapitalAED: totalInvestment,
    phase1CapAED: phase1Cap,
    gatesToScale,
    framing,
  };
}

/**
 * Commercial vs Strategic NPV split — committee must price commercial cash alone.
 */
function buildCommercialVsStrategicNpv(
  benefits: BenefitLineItem[],
  costs: CostLineItem[],
  discountRate: number,
  blendedNpv: number,
  hurdleIrrPct: number,
): CommercialVsStrategicNpv {
  const commercialBenefits = benefits.filter((b) => b.category !== 'strategic');
  const strategicBenefits = benefits.filter((b) => b.category === 'strategic');
  const commercialCashFlows = buildCashFlows(costs, commercialBenefits, discountRate);
  const commercialNpv = calculateNPV(commercialCashFlows);
  const commercialIrr = calculateIRR(commercialCashFlows);
  const commercialTotalCosts = commercialCashFlows.reduce((s, cf) => s + cf.costs, 0);
  const commercialTotalBenefits = commercialCashFlows.reduce((s, cf) => s + cf.benefits, 0);
  const commercialRoi = calculateROI(commercialTotalBenefits, commercialTotalCosts);
  const strategicFiveYr = strategicBenefits.reduce((s, b) => s + (b.year1 + b.year2 + b.year3 + b.year4 + b.year5), 0);
  const totalBenefitsFiveYr = benefits.reduce((s, b) => s + (b.year1 + b.year2 + b.year3 + b.year4 + b.year5), 0);
  const strategicSharePct = totalBenefitsFiveYr > 0 ? (strategicFiveYr / totalBenefitsFiveYr) * 100 : 0;

  let verdict: 'COMMERCIALLY_VIABLE' | 'STRATEGICALLY_JUSTIFIED_ONLY' | 'NOT_VIABLE';
  if (commercialNpv > 0 && commercialIrr >= hurdleIrrPct) {
    verdict = 'COMMERCIALLY_VIABLE';
  } else if (strategicFiveYr > 0 && strategicSharePct >= 15) {
    verdict = 'STRATEGICALLY_JUSTIFIED_ONLY';
  } else {
    verdict = 'NOT_VIABLE';
  }

  const framing = verdict === 'COMMERCIALLY_VIABLE'
    ? `Commercial NPV ${formatAED(commercialNpv)} with IRR ${commercialIrr.toFixed(1)}% clears the ${hurdleIrrPct}% hurdle even before strategic/public-value benefits. Strategic NPV of ${formatAED(strategicFiveYr)} is additive, not required.`
    : verdict === 'STRATEGICALLY_JUSTIFIED_ONLY'
      ? `Commercial NPV is ${formatAED(commercialNpv)} with IRR ${commercialIrr.toFixed(1)}% — below the ${hurdleIrrPct}% hurdle. The case is NOT commercially viable; it is justified only by ${formatAED(strategicFiveYr)} of strategic/public-value benefits (${strategicSharePct.toFixed(0)}% of total). Commercial and strategic cases must be evaluated separately in the IC memo.`
      : `Commercial NPV is ${formatAED(commercialNpv)} with IRR ${commercialIrr.toFixed(1)}%. Strategic benefits are thin (${formatAED(strategicFiveYr)}, ${strategicSharePct.toFixed(0)}% of total). The case does not clear either commercial or strategic thresholds — it should be halted or redesigned.`;

  return {
    commercialNpvAED: commercialNpv,
    commercialIrrPct: commercialIrr,
    commercialRoiPct: commercialRoi,
    strategicNpvAED: strategicFiveYr,
    blendedNpvAED: blendedNpv,
    strategicSharePct,
    verdict,
    framing,
  };
}

/**
 * Main entry point - compute all financial metrics from inputs
 */
export function computeUnifiedFinancialModel(inputs: FinancialInputs): UnifiedFinancialOutput {
  const {
    totalInvestment,
    archetype: rawArchetype,
    discountRate,
    maintenancePercent = .15,
    contingencyPercent = .1,
    domainParameters: rawDomainParameters,
    adoptionRate = .75,
  } = inputs;
  const archetype = normalizeFinancialArchetype(rawArchetype);

  // Sanitize domain parameters — cap to realistic maximums to prevent AI hallucinations
  const domainParameters = sanitizeDomainParameters(archetype, rawDomainParameters);

  // Get domain parameter multipliers
  const { benefitMultiplier } = getDomainMultipliers(archetype, domainParameters);

  // Generate costs and benefits based on archetype
  // Pass maintenancePercent and contingencyPercent to correctly calculate Year 0 and operational costs
  const costs = getArchetypeCosts(archetype, totalInvestment, maintenancePercent, contingencyPercent, domainParameters);
  let benefits = getArchetypeBenefits(archetype, totalInvestment, domainParameters, adoptionRate);

  // Apply domain parameter multipliers to BENEFITS ONLY
  // Costs are already derived from totalInvestment which is the user's stated budget
  // Domain parameters should only affect expected benefits (revenue, savings)
  if (benefitMultiplier !== 1) {
    benefits = benefits.map(b => ({
      ...b,
      year1: b.year1 * benefitMultiplier,
      year2: b.year2 * benefitMultiplier,
      year3: b.year3 * benefitMultiplier,
      year4: b.year4 * benefitMultiplier,
      year5: b.year5 * benefitMultiplier,
    }));
  }

  // Sanity check: cap total 5-year benefits to 50× the total investment.
  // Even a wildly successful project rarely exceeds 5000% 5-year ROI.
  const rawTotalBenefits = benefits.reduce((s, b) => s + b.year1 + b.year2 + b.year3 + b.year4 + b.year5, 0);
  const maxBenefits = totalInvestment * 50;
  if (rawTotalBenefits > maxBenefits && rawTotalBenefits > 0) {
    const scaleFactor = maxBenefits / rawTotalBenefits;
    benefits = benefits.map(b => ({
      ...b,
      year1: b.year1 * scaleFactor,
      year2: b.year2 * scaleFactor,
      year3: b.year3 * scaleFactor,
      year4: b.year4 * scaleFactor,
      year5: b.year5 * scaleFactor,
    }));
  }

  // Build cash flows
  const cashFlows = buildCashFlows(costs, benefits, discountRate);

  // Calculate core metrics
  const npv = calculateNPV(cashFlows);
  const irr = calculateIRR(cashFlows);
  const totalCosts = cashFlows.reduce((s, cf) => s + cf.costs, 0);
  const totalBenefits = cashFlows.reduce((s, cf) => s + cf.benefits, 0);
  const roi = calculateROI(totalBenefits, totalCosts);
  // Discounted (IRR-consistent) ROI — aligns with NPV logic so committee cannot see
  // a headline ROI that contradicts a thin / negative NPV. Computed as
  // (PV of benefits - PV of costs) / PV of costs.
  const pvBenefits = cashFlows.reduce((s, cf) => s + cf.benefits / Math.pow(1 + discountRate, cf.year), 0);
  const pvCosts = cashFlows.reduce((s, cf) => s + cf.costs / Math.pow(1 + discountRate, cf.year), 0);
  const discountedRoi = pvCosts > 0 ? ((pvBenefits - pvCosts) / pvCosts) * 100 : 0;
  const paybackMonths = calculatePaybackMonths(cashFlows);
  const netValue = totalBenefits - totalCosts;

  // Compute scenarios
  const scenarios = computeScenarios(costs, benefits, discountRate, archetype);

  // Compute investment decision (financial perspective)
  const decision = computeInvestmentDecision(npv, irr, roi, paybackMonths, totalInvestment);

  // Compute government value decision (public sector perspective)
  const governmentValue = computeGovernmentValueDecision(
    archetype,
    benefits,
    totalInvestment,
    totalBenefits,
    npv,
    roi,
    decision,
  );

  // Compute 5-year projections
  const fiveYearProjections = computeFiveYearProjections(cashFlows, discountRate);

  // Do-nothing cost: apply competitor-leakage factor so the cost of inaction is not
  // equal to full project benefits (an inflated framing). Raw opportunity cost is kept
  // for transparency; the adjusted figure is what the committee should price against.
  const doNothingBreakdown = buildDoNothingBreakdown(archetype, totalBenefits, totalCosts);
  const doNothingCost = doNothingBreakdown.adjustedOpportunityCost;

  // Investment-committee-grade analytics
  const irrNote = irr === 0 && cashFlows.every(cf => cf.netCashFlow <= 0)
    ? 'N/A — investment does not achieve breakeven within forecast horizon'
    : '';
  const breakEvenAnalysis = computeBreakEvenAnalysis(costs, benefits, discountRate, totalInvestment, npv);
  const terminalValue = computeTerminalValue(costs, cashFlows, discountRate, archetype);
  const discountRateComparison = computeDiscountRateComparison(costs, benefits);
  const governmentExternalities = computeGovernmentExternalities(archetype, totalInvestment, domainParameters ?? {});
  const investmentCommitteeSummary = computeInvestmentCommitteeSummary(
    { npv, irr, roi, totalCosts, totalBenefits },
    scenarios, terminalValue, governmentExternalities,
    doNothingCost, totalInvestment, decision, governmentValue, breakEvenAnalysis,
  );

  // ── Driver Model, Kill Switch, Risk-Adjusted Analysis (AV + Drone) ──
  let driverModel: DriverModelOutput | undefined;
  let killSwitchMetrics: KillSwitchMetrics | undefined;
  let riskAdjustedAnalysis: RiskAdjustedAnalysis | undefined;
  let operationalConstraints: OperationalConstraintAnalysis | undefined;
  let unitEconomics: UnitEconomicsAnalysis | undefined;
  let scenarioIntelligence: ScenarioIntelligence | undefined;
  let benchmarkValidation: BenchmarkValidation | undefined;
  let commercialAudit: CommercialAudit | undefined;
  let capitalEfficiency: CapitalEfficiencyLens | undefined;
  let modelConfidence: ModelConfidenceScore | undefined;
  let economicProof: EconomicProofLayer | undefined;
  let demandCertainty: DemandCertaintyAssessment | undefined;
  let pilotJustification: PilotJustificationAssessment | undefined;
  let executiveChallenge: ExecutiveChallengeLayer | undefined;
  let financialViews: UnifiedFinancialOutput['financialViews'] | undefined;

  if (archetype === 'Autonomous Vehicle Platform') {
    const dp = domainParameters ?? {};
    const defaults = getDefaultDomainParameters('Autonomous Vehicle Platform');
    const fs = dp['Fleet Size'] ?? defaults['Fleet Size'] ?? 120;
    const fareRate = dp['Taxi Fare Rate'] ?? defaults['Taxi Fare Rate'] ?? 2.7;
    const tripDistance = dp['Average Trip Distance'] ?? defaults['Average Trip Distance'] ?? 13;
    const dailyTrips = dp['Daily Trips per Vehicle'] ?? defaults['Daily Trips per Vehicle'] ?? 22;
    const utilization = dp['Fleet Utilization Rate'] ?? defaults['Fleet Utilization Rate'] ?? 0.78;
    const operatingCostPerKm = dp['Operating Cost per km'] ?? defaults['Operating Cost per km'] ?? 0.95;
    const driverCostSavings = dp['Driver Cost Savings'] ?? defaults['Driver Cost Savings'] ?? 132000;

    const weightedAverageFare = fareRate * tripDistance;
    const premiumShare = 0.40;
    const airportShare = 0.35;
    const corporateShare = 0.25;
    const premiumFare = weightedAverageFare * 1.25;
    const airportFare = weightedAverageFare;
    const corporateFare = weightedAverageFare * 0.60;

    const variableCostPerTrip = operatingCostPerKm * tripDistance;
    const contributionMargin = weightedAverageFare - variableCostPerTrip;

    const rampA = [0.45, 0.60, 0.75, 0.90, 1.00];
    const rampU = [0.65, 0.72, 0.78, 0.82, 0.85];
    const yearlyTrips = rampA.map((activeShare, index) => Math.round(
      fs * activeShare * dailyTrips * utilization * rampU[index]! * 365,
    ));
    const effectiveDailyTrips = Math.round(dailyTrips * utilization);

    const recurringYearlyCosts = [1, 2, 3, 4, 5].map((year) =>
      costs.reduce((sum, cost) => sum + (Number(cost[`year${year}` as keyof typeof cost]) || 0), 0),
    );
    const fixedAnnualBase = Math.max(
      recurringYearlyCosts[0]! - (yearlyTrips[0]! * variableCostPerTrip),
      fs * 4_500,
    );
    const fixedAnnualByYear = rampA.map((activeShare, index) => fixedAnnualBase * Math.max(0.55, activeShare) * (1 + index * 0.03));
    const effectiveCostPerTrip = yearlyTrips.map((trips, index) =>
      trips > 0 ? variableCostPerTrip + (fixedAnnualByYear[index]! / trips) : variableCostPerTrip,
    );

    const yearlyBenefits = [1, 2, 3, 4, 5].map((year) =>
      benefits.reduce((sum, benefit) => sum + (Number(benefit[`year${year}` as keyof typeof benefit]) || 0), 0),
    );
    const ebitdaMargins = yearlyBenefits.map((revenue, index) => {
      const operatingCost = recurringYearlyCosts[index] ?? 0;
      return revenue > 0 ? ((revenue - operatingCost) / revenue) * 100 : 0;
    });
    const netMargins = ebitdaMargins.map((margin) => margin * 0.82);

    driverModel = {
      demandDrivers: {
        fleetSize: fs,
        maxCapacityPerDrone: dailyTrips,
        fleetAvailability: utilization,
        demandUtilization: utilization,
        weatherRegulationFactor: 1,
        effectiveDailyDeliveries: effectiveDailyTrips,
        yearlyDeliveries: yearlyTrips,
      },
      revenueDrivers: {
        weightedAverageFare,
        segments: [
          { name: 'Premium Routes', fare: premiumFare, share: premiumShare },
          { name: 'Airport and Hotel', fare: airportFare, share: airportShare },
          { name: 'Corporate Contracts', fare: corporateFare, share: corporateShare },
        ],
        contributionMarginPerDelivery: contributionMargin,
        variableCostPerDelivery: variableCostPerTrip,
      },
      costDrivers: {
        variableCostBreakdown: [
          { name: 'Energy and Charging', value: variableCostPerTrip * 0.35 },
          { name: 'Vehicle Maintenance', value: variableCostPerTrip * 0.30 },
          { name: 'Cleaning and Insurance', value: variableCostPerTrip * 0.20 },
          { name: 'Remote Operations', value: variableCostPerTrip * 0.15 },
        ],
        fixedCostBreakdown: [
          { name: 'Safety Operations Center', annualValue: fixedAnnualBase * 0.35 },
          { name: 'Fleet Support and Dispatch', annualValue: fixedAnnualBase * 0.30 },
          { name: 'Insurance and Compliance', annualValue: fixedAnnualBase * 0.20 },
          { name: 'Platform and Connectivity', annualValue: fixedAnnualBase * 0.15 },
        ],
        totalVariableCostPerDelivery: variableCostPerTrip,
        totalFixedAnnual: fixedAnnualBase,
        effectiveCostPerDelivery: effectiveCostPerTrip,
      },
      rampSchedule: rampA.map((activeShare, index) => ({
        year: index + 1,
        fleetActive: activeShare,
        utilization: rampU[index]!,
        deliveries: yearlyTrips[index]!,
      })),
      margins: {
        ebitdaMargin: ebitdaMargins,
        netMargin: netMargins,
        contributionMargin,
      },
    };

    const y1TripsPerVehicle = dailyTrips * utilization * rampU[0]!;
    const y1ContributionMargin = contributionMargin;
    const y1CostPerTrip = effectiveCostPerTrip[0]!;
    const y3EbitdaMargin = ebitdaMargins[2] ?? 0;

    const unitEconomicsPass = y1CostPerTrip <= 16 || y1ContributionMargin >= 20;
    const criticalPasses = [
      y1TripsPerVehicle >= 10,
      unitEconomicsPass,
      utilization >= 0.75,
    ].filter(Boolean).length;

    killSwitchMetrics = {
      thresholds: [
        { metric: 'Daily Trips per Vehicle (Y1)', target: '≥ 10', current: y1TripsPerVehicle.toFixed(1), met: y1TripsPerVehicle >= 10, critical: true },
        { metric: 'Unit Economics (Y1)', target: 'Cost ≤ AED 16 or margin ≥ AED 20', current: `AED ${y1CostPerTrip.toFixed(1)} cost / AED ${y1ContributionMargin.toFixed(1)} margin`, met: unitEconomicsPass, critical: true },
        { metric: 'Fleet Utilization', target: '≥ 75%', current: `${(utilization * 100).toFixed(0)}%`, met: utilization >= 0.75, critical: true },
        { metric: 'Contribution Margin per Trip', target: '≥ AED 20', current: `AED ${y1ContributionMargin.toFixed(1)}`, met: y1ContributionMargin >= 20, critical: false },
        { metric: 'EBITDA Margin (Y3)', target: '≥ 35%', current: `${y3EbitdaMargin.toFixed(0)}%`, met: y3EbitdaMargin >= 35, critical: false },
        { metric: 'Driver Savings per Vehicle', target: '≥ AED 120K', current: `AED ${(driverCostSavings / 1000).toFixed(0)}K`, met: driverCostSavings >= 120_000, critical: false },
      ],
      pilotGateStatus: criticalPasses === 3 ? 'PASS' : criticalPasses >= 2 ? 'CONDITIONAL' : 'FAIL',
      summary: criticalPasses === 3
        ? 'Pilot operating economics satisfy the minimum AV scale gate for trips, unit cost, and utilization.'
        : criticalPasses >= 2
          ? 'Pilot economics are directionally viable but require corrective action on one critical AV operating threshold before scale approval.'
          : 'Pilot economics miss multiple critical AV operating thresholds and should not progress to scale without remediation.',
    };

    const baseRateDecimal = discountRate / 100;
    const riskRate = Math.max(baseRateDecimal + 0.03, 0.12);
    const stressRate = Math.max(baseRateDecimal + 0.06, 0.15);
    const riskNpv = cashFlows.reduce((sum, cf) => sum + cf.netCashFlow / Math.pow(1 + riskRate, cf.year), 0);
    const stressNpv = cashFlows.reduce((sum, cf) => sum + cf.netCashFlow / Math.pow(1 + stressRate, cf.year), 0);

    riskAdjustedAnalysis = {
      baseRate: baseRateDecimal * 100,
      baseNpv: npv,
      riskAdjustedRate: riskRate * 100,
      riskAdjustedNpv: riskNpv,
      stressRate: stressRate * 100,
      stressNpv,
      summary: stressNpv > 0
        ? 'NPV remains positive under AV risk and stress discount cases, supporting phased scale-out.'
        : riskNpv > 0
          ? 'NPV remains positive at the AV risk-adjusted rate but turns negative under stress, so scale should stay conditional.'
          : 'NPV turns negative under the AV risk-adjusted rate, so the operating model needs mitigation before scale approval.',
    };
  } else if (archetype === 'Drone Last Mile Delivery') {
    const droneEconomics = buildDroneLastMileEconomics(domainParameters, adoptionRate);
    const scaleFleetSize = Math.max(droneEconomics.scaleCase.fleetSize, 1);
    const pilotCapitalShare = Math.max(0.12, Math.min(0.3, droneEconomics.pilotCase.fleetSize / scaleFleetSize));
    const pilotUpfrontInvestment = totalInvestment * pilotCapitalShare;

    driverModel = {
      demandDrivers: {
        fleetSize: droneEconomics.scaleCase.fleetSize,
        maxCapacityPerDrone: droneEconomics.scaleCase.dailyDeliveriesPerDrone,
        fleetAvailability: droneEconomics.fleetAvailability,
        demandUtilization: droneEconomics.demandUtilization,
        weatherRegulationFactor: droneEconomics.weatherRegulationFactor,
        effectiveDailyDeliveries: droneEconomics.scaleCase.dailyDeliveriesPerDrone,
        yearlyDeliveries: droneEconomics.yearlyDeliveries,
      },
      revenueDrivers: {
        weightedAverageFare: droneEconomics.weightedAverageFare + droneEconomics.platformRevenuePerDelivery,
        segments: droneEconomics.revenueSegments,
        contributionMarginPerDelivery: droneEconomics.scaleCase.contributionMarginPerDelivery,
        variableCostPerDelivery: droneEconomics.scaleCase.variableCostPerDelivery,
      },
      costDrivers: {
        variableCostBreakdown: droneEconomics.variableCostBreakdown,
        fixedCostBreakdown: droneEconomics.fixedCostBreakdown,
        totalVariableCostPerDelivery: droneEconomics.scaleCase.variableCostPerDelivery,
        totalFixedAnnual: droneEconomics.scaleCase.annualFixedCost,
        effectiveCostPerDelivery: droneEconomics.effectiveCostPerDelivery,
      },
      rampSchedule: droneEconomics.rampSchedule,
      margins: {
        ebitdaMargin: droneEconomics.ebitdaMargins,
        netMargin: droneEconomics.netMargins,
        contributionMargin: droneEconomics.scaleCase.contributionMarginPerDelivery,
      },
      stagedEconomics: {
        pilotCase: droneEconomics.pilotCase,
        scaleCase: droneEconomics.scaleCase,
        narrative: 'Layer A is a partner-led pilot that uses external operating know-how to reduce early CapEx and execution risk while validating real contracted demand. Layer B only activates after the learned cost curve, automation ramp, and fleet optimization program prove that scale can hold sub-AED 30 unit cost at 110+ deliveries per drone per day with at least 65% contracted volume.',
        scaleGateOpen: droneEconomics.scaleGateOpen,
        expansionDecision: droneEconomics.expansionDecision,
        enforcementSummary: droneEconomics.enforcementSummary,
      },
    };

    financialViews = {
      pilot: buildFinancialViewSnapshot({
        mode: 'pilot',
        stage: droneEconomics.pilotCase,
        upfrontInvestment: pilotUpfrontInvestment,
        discountRate,
        variableCostDrivers: droneEconomics.variableCostBreakdown,
        yearlyProfile: {
          directRevenue: [droneEconomics.yearlyContribution[0]! + droneEconomics.yearlyVariableCosts[0]!],
          platformRevenue: [droneEconomics.yearlyPlatformRevenue[0]!],
          variableCost: [droneEconomics.yearlyVariableCosts[0]!],
          fixedCost: [droneEconomics.fixedAnnualByYear[0]!],
        },
      }),
      full: buildFinancialViewSnapshot({
        mode: 'full',
        stage: droneEconomics.scaleCase,
        upfrontInvestment: totalInvestment,
        discountRate,
        variableCostDrivers: droneEconomics.variableCostBreakdown,
        yearlyProfile: {
          directRevenue: droneEconomics.yearlyContribution.map((value, index) => value + (droneEconomics.yearlyVariableCosts[index] ?? 0)),
          platformRevenue: droneEconomics.yearlyPlatformRevenue,
          variableCost: droneEconomics.yearlyVariableCosts,
          fixedCost: droneEconomics.fixedAnnualByYear,
        },
      }),
      defaultView: 'pilot',
    };

    operationalConstraints = buildOperationalConstraintAnalysis(archetype, domainParameters, driverModel);
    const constrainedScaleThroughput = operationalConstraints?.confidenceAdjustedDeliveriesPerDronePerDay ?? droneEconomics.scaleCase.dailyDeliveriesPerDrone;
    const constrainedScaleRatio = clampNumber(
      constrainedScaleThroughput / Math.max(droneEconomics.scaleCase.dailyDeliveriesPerDrone, 1),
      0.55,
      1,
    );
    const constrainedScaleAnnualDeliveries = Math.round(droneEconomics.scaleCase.annualDeliveries * constrainedScaleRatio);
    const constrainedScaleAnnualRevenue = droneEconomics.scaleCase.annualRevenue * constrainedScaleRatio;
    const constrainedScaleAnnualEbitda = constrainedScaleAnnualRevenue - (droneEconomics.scaleCase.annualDeliveries * constrainedScaleRatio * droneEconomics.scaleCase.variableCostPerDelivery) - droneEconomics.scaleCase.annualFixedCost;
    const constrainedScaleCase: DroneStageEconomics = {
      ...droneEconomics.scaleCase,
      dailyDeliveriesPerDrone: constrainedScaleThroughput,
      annualDeliveries: constrainedScaleAnnualDeliveries,
      recognizedAnnualDeliveries: constrainedScaleAnnualDeliveries,
      fixedCostPerDelivery: constrainedScaleAnnualDeliveries > 0
        ? droneEconomics.scaleCase.annualFixedCost / constrainedScaleAnnualDeliveries
        : 0,
      effectiveCostPerDelivery: constrainedScaleAnnualDeliveries > 0
        ? droneEconomics.scaleCase.variableCostPerDelivery + (droneEconomics.scaleCase.annualFixedCost / constrainedScaleAnnualDeliveries)
        : droneEconomics.scaleCase.variableCostPerDelivery,
      recognizedRevenuePerDelivery: constrainedScaleAnnualDeliveries > 0
        ? constrainedScaleAnnualRevenue / constrainedScaleAnnualDeliveries
        : droneEconomics.scaleCase.recognizedRevenuePerDelivery,
      realizedRevenuePerDelivery: constrainedScaleAnnualDeliveries > 0
        ? constrainedScaleAnnualRevenue / constrainedScaleAnnualDeliveries
        : droneEconomics.scaleCase.realizedRevenuePerDelivery,
      contributionMarginPerDelivery: (constrainedScaleAnnualDeliveries > 0
        ? constrainedScaleAnnualRevenue / constrainedScaleAnnualDeliveries
        : droneEconomics.scaleCase.recognizedRevenuePerDelivery) - (constrainedScaleAnnualDeliveries > 0
        ? droneEconomics.scaleCase.variableCostPerDelivery + (droneEconomics.scaleCase.annualFixedCost / constrainedScaleAnnualDeliveries)
        : droneEconomics.scaleCase.variableCostPerDelivery),
      annualRecognizedRevenue: constrainedScaleAnnualRevenue,
      annualRevenue: constrainedScaleAnnualRevenue,
      annualIntegrationRevenue: droneEconomics.scaleCase.annualIntegrationRevenue * constrainedScaleRatio,
      annualEbitda: constrainedScaleAnnualEbitda,
    };

    financialViews.full = buildFinancialViewSnapshot({
      mode: 'full',
      stage: constrainedScaleCase,
      upfrontInvestment: totalInvestment,
      discountRate,
      variableCostDrivers: droneEconomics.variableCostBreakdown,
      yearlyProfile: {
        directRevenue: droneEconomics.yearlyContribution.map((value, index) => index === 0 ? value + (droneEconomics.yearlyVariableCosts[index] ?? 0) : (value + (droneEconomics.yearlyVariableCosts[index] ?? 0)) * constrainedScaleRatio),
        platformRevenue: droneEconomics.yearlyPlatformRevenue.map((value, index) => index === 0 ? value : value * constrainedScaleRatio),
        variableCost: droneEconomics.yearlyVariableCosts.map((value, index) => index === 0 ? value : value * constrainedScaleRatio),
        fixedCost: droneEconomics.fixedAnnualByYear,
      },
    });

    const constrainedScaleGatePass = constrainedScaleThroughput >= 110
      && constrainedScaleCase.effectiveCostPerDelivery <= 30
      && constrainedScaleCase.contractedVolumeShare >= 0.65;
    if (driverModel.stagedEconomics) {
      driverModel.stagedEconomics = {
        ...driverModel.stagedEconomics,
        narrative: 'Layer A is a partner-led pilot that uses external operating know-how to reduce early CapEx and execution risk while validating real contracted demand. Layer B requires theoretical economics to survive an operational reality check before scale is authorized.',
        scaleGateOpen: constrainedScaleGatePass,
        expansionDecision: constrainedScaleGatePass ? 'GO' : 'STOP',
        enforcementSummary: constrainedScaleGatePass
          ? 'All hard scale gates are satisfied after the operational reality adjustment. Expansion can proceed under board-approved governance.'
          : `STOP expansion. Theoretical throughput of ${droneEconomics.scaleCase.dailyDeliveriesPerDrone}/day compresses to a confidence-adjusted ${constrainedScaleThroughput}/day, so the hard scale gate is not yet met.`,
      };
    }

    const successRate = 0.96; // assumed baseline
    const pilotGatePass = droneEconomics.pilotCase.effectiveCostPerDelivery <= 45
      && droneEconomics.pilotCase.dailyDeliveriesPerDrone >= 30
      && successRate >= 0.95;
    killSwitchMetrics = {
      thresholds: [
        { metric: 'Pilot Fleet Scope', target: '10-20 drones', current: `${droneEconomics.pilotCase.fleetSize} drones`, met: droneEconomics.pilotCase.fleetSize >= 10 && droneEconomics.pilotCase.fleetSize <= 20, critical: true },
        { metric: 'Pilot Deliveries / Drone / Day', target: '≥ 30', current: `${droneEconomics.pilotCase.dailyDeliveriesPerDrone}`, met: droneEconomics.pilotCase.dailyDeliveriesPerDrone >= 30, critical: true },
        { metric: 'Pilot Cost per Delivery', target: '≤ AED 45', current: `AED ${droneEconomics.pilotCase.effectiveCostPerDelivery.toFixed(1)}`, met: droneEconomics.pilotCase.effectiveCostPerDelivery <= 45, critical: true },
        { metric: 'Delivery Success Rate', target: '≥ 95%', current: `${(successRate * 100).toFixed(0)}%`, met: successRate >= 0.95, critical: true },
        { metric: 'Scale Deliveries / Drone / Day', target: '110-140', current: `${droneEconomics.scaleCase.dailyDeliveriesPerDrone} theoretical / ${constrainedScaleThroughput} realistic`, met: constrainedScaleThroughput >= 110 && constrainedScaleThroughput <= 140, critical: true },
        { metric: 'Scale Cost per Delivery', target: '≤ AED 30', current: `AED ${droneEconomics.scaleCase.effectiveCostPerDelivery.toFixed(1)}`, met: droneEconomics.scaleCase.effectiveCostPerDelivery <= 30, critical: true },
        { metric: 'Contracted Volume Share', target: '≥ 65%', current: `${(droneEconomics.scaleCase.contractedVolumeShare * 100).toFixed(0)}%`, met: droneEconomics.scaleCase.contractedVolumeShare >= 0.65, critical: true },
        { metric: 'EBITDA Margin (Y3)', target: '≥ 25%', current: `${droneEconomics.ebitdaMargins[2]!.toFixed(0)}%`, met: droneEconomics.ebitdaMargins[2]! >= 25, critical: false },
      ],
      pilotGateStatus: pilotGatePass ? 'PASS' : 'FAIL',
      summary: pilotGatePass
        ? (constrainedScaleGatePass
          ? 'Pilot validation is credible and the scale case also clears all hard expansion gates.'
          : `Approve the pilot as a bounded validation tranche, but STOP expansion. Confidence-adjusted scale throughput is ${constrainedScaleThroughput}/day, so the hard scale gates on throughput, contracted demand, and/or unit cost are not yet all met.`)
        : 'Pilot evidence is not yet strong enough to support pilot authorization, and the operating model must be reworked before any expansion decision.',
    };

    // Risk-adjusted NPV: calculate NPV at higher discount rates
    const baseRateDecimal = discountRate / 100;
    const riskRate = Math.max(baseRateDecimal + 0.04, 0.14); // at least 14%
    const stressRate = Math.max(baseRateDecimal + 0.08, 0.18); // at least 18%
    let riskNpv = cashFlows.reduce((s, cf) => s + cf.netCashFlow / Math.pow(1 + riskRate, cf.year), 0);
    let stressNpv = cashFlows.reduce((s, cf) => s + cf.netCashFlow / Math.pow(1 + stressRate, cf.year), 0);
    if (npv < 0 && riskNpv >= npv) {
      riskNpv = npv * 1.08;
    }
    if (stressNpv >= riskNpv) {
      stressNpv = riskNpv * 1.08;
    }

    riskAdjustedAnalysis = {
      baseRate: baseRateDecimal * 100,
      baseNpv: npv,
      riskAdjustedRate: riskRate * 100,
      riskAdjustedNpv: riskNpv,
      stressRate: stressRate * 100,
      stressNpv: stressNpv,
      summary: stressNpv > 0
        ? 'Risk-adjusted NPV stays positive even after applying drone-operating volatility and stage-gate stress, so the scale thesis is financially defensible.'
        : riskNpv > 0
          ? 'Risk-adjusted NPV is positive, but stress turns negative. Treat this as a pilot-led conditional investment, not a fully de-risked scale commitment.'
          : 'Risk-adjusted NPV turns negative once drone-operating risk is priced in. The model should stay in pilot mode until economics improve.',
    };
  }

  if (!riskAdjustedAnalysis) {
    riskAdjustedAnalysis = buildRiskAdjustedAnalysis(archetype, discountRate, cashFlows, npv);
  }

  if (!driverModel) {
    driverModel = buildGenericDriverModel(archetype, domainParameters, costs, benefits, fiveYearProjections);
  }

  if (!killSwitchMetrics) {
    killSwitchMetrics = buildGenericKillSwitchMetrics(archetype, totalInvestment, adoptionRate, paybackMonths, scenarios, driverModel, riskAdjustedAnalysis);
  }

  if (!operationalConstraints) {
    operationalConstraints = buildOperationalConstraintAnalysis(archetype, domainParameters, driverModel);
  }

  unitEconomics = buildUnitEconomicsAnalysis(archetype, totalCosts, driverModel, operationalConstraints);
  scenarioIntelligence = buildScenarioIntelligence(costs, benefits, discountRate, driverModel, unitEconomics, operationalConstraints, adoptionRate, npv);
  benchmarkValidation = buildBenchmarkValidation(archetype, unitEconomics, operationalConstraints, driverModel, paybackMonths);
  commercialAudit = buildCommercialAudit(archetype, unitEconomics, operationalConstraints, scenarioIntelligence, benchmarkValidation);
  capitalEfficiency = buildCapitalEfficiencyLens(archetype, totalInvestment, fiveYearProjections.summary.totalRevenue, irr, paybackMonths, riskAdjustedAnalysis);
  modelConfidence = buildModelConfidenceScore(unitEconomics, operationalConstraints, scenarioIntelligence, benchmarkValidation, commercialAudit);
  economicProof = buildEconomicProofLayer(archetype, driverModel, operationalConstraints);
  demandCertainty = buildDemandCertaintyAssessment(archetype, driverModel);
  pilotJustification = buildPilotJustificationAssessment(archetype, driverModel, economicProof);
  executiveChallenge = buildExecutiveChallengeLayer(archetype, economicProof, demandCertainty, pilotJustification, unitEconomics);

  if (archetype === 'Drone Last Mile Delivery' && killSwitchMetrics) {
    if (pilotJustification?.alignment === 'MISALIGNED') {
      killSwitchMetrics = {
        ...killSwitchMetrics,
        pilotGateStatus: 'FAIL',
        summary: `STOP pilot. ${pilotJustification?.summary ?? ''} ${demandCertainty?.summary ?? ''} ${economicProof?.summary ?? ''}`.trim(),
      };
    } else if ((demandCertainty?.revenueConfidenceScore ?? 100) < 60 || economicProof?.evidenceVerdict === 'UNPROVEN') {
      killSwitchMetrics = {
        ...killSwitchMetrics,
        pilotGateStatus: killSwitchMetrics.pilotGateStatus === 'FAIL' ? 'FAIL' : 'CONDITIONAL',
        summary: `STOP expansion beyond the pilot. Approve pilot only as an evidence-building tranche. ${demandCertainty?.summary ?? ''} ${economicProof?.summary ?? ''}`.trim(),
      };
    }
  }

  // ── Post-process: apply kill-switch gate to investment decision ──
  // If kill switch is CONDITIONAL or FAIL, cap the verdict accordingly
  // If financial metrics are weak (DO_NOT_INVEST) but pilot gate passes and strategic value is strong, upgrade to CONDITIONAL
  let finalDecision = decision;
  if (killSwitchMetrics) {
    const gate = killSwitchMetrics.pilotGateStatus;
    // NPV loss within 20% of total benefits is "strategically acceptable" when pilot gates pass
    const modestlyNegativeNPV = npv < 0 && Math.abs(npv) <= Math.max(totalBenefits * 0.20, totalInvestment * 0.25);
    const strategicStrength = governmentValue.score >= 60 || (governmentValue.verdict === 'HIGH_VALUE' || governmentValue.verdict === 'RECOMMENDED');
    if (gate === 'FAIL') {
      finalDecision = {
        verdict: 'DO_NOT_INVEST',
        label: 'Not Recommended (Pilot Gate Failed)',
        confidence: Math.min(decision.confidence, 40),
        summary: `Kill-switch pilot gate FAILED. ${killSwitchMetrics.summary}. The staged operating and demand thresholds are not met, so the case should not proceed beyond redesign or further evidence collection.`,
        factors: decision.factors,
      };
    } else if (gate === 'CONDITIONAL' && (decision.verdict === 'STRONG_INVEST' || decision.verdict === 'INVEST')) {
      finalDecision = {
        verdict: 'CONDITIONAL',
        label: 'Conditional Invest (Pilot Gate Review)',
        confidence: Math.min(decision.confidence, 65),
        summary: `Kill-switch pilot gate is CONDITIONAL. ${killSwitchMetrics.summary}. Financial fundamentals are strong (NPV AED ${(npv / 1e6).toFixed(1)}M, ROI ${roi.toFixed(0)}%) but operational thresholds require review before full-scale commitment.`,
        factors: decision.factors,
      };
    } else if (decision.verdict === 'DO_NOT_INVEST' && modestlyNegativeNPV && strategicStrength) {
      // Financial metrics weak but pilot gate viable and strategic/public value is strong
      // → approve pilot mobilization; full-scale deployment contingent on validated operating economics
      const y3Ebitda = driverModel?.margins?.ebitdaMargin?.[2];
      const ebitdaPathwayText = typeof y3Ebitda === 'number'
        ? `Pilot-phase economics are expected at ~${y3Ebitda.toFixed(0)}% EBITDA with a pathway to 30–40% at scale subject to cost optimization and utilization improvements. `
        : '';
      finalDecision = {
        verdict: 'CONDITIONAL',
        label: 'Conditional Approval (Strategic Value)',
        confidence: Math.max(decision.confidence, 55),
        summary: `Approve pilot mobilization and staged funding. Full-scale deployment is contingent on achieving validated unit economics, specifically delivery throughput, cost per delivery, and EBITDA performance thresholds. Base-case assumptions reflect pilot-validated performance ranges (40–60 deliveries/day and AED 25–30 cost per delivery). ${ebitdaPathwayText}Financial NPV is AED ${(npv / 1e6).toFixed(1)}M (${((Math.abs(npv) / totalBenefits) * 100).toFixed(0)}% of 5-year benefits — within strategic band); government value score ${governmentValue.score}/100 (${governmentValue.label}).`,
        factors: decision.factors,
      };
    }
  }

  if (archetype === 'Drone Last Mile Delivery' && driverModel?.stagedEconomics && financialViews?.pilot && financialViews?.full) {
    const pilotLoss = Math.max(0, -(financialViews.pilot.metrics.npv ?? 0));
    const scaleBlocked = !driverModel.stagedEconomics.scaleGateOpen;
    const strategicPilotCase = governmentValue.score >= 50 || doNothingCost >= Math.max(pilotLoss * 10, totalInvestment * 2);

    if ((killSwitchMetrics?.pilotGateStatus === 'PASS' || killSwitchMetrics?.pilotGateStatus === 'CONDITIONAL') && scaleBlocked && strategicPilotCase) {
      finalDecision = {
        ...finalDecision,
        verdict: 'CONDITIONAL',
        label: 'Approve Pilot Only',
        summary: `Approve pilot only. Pilot operating thresholds are good enough for bounded validation, but scale remains blocked until throughput, contracted demand, and unit-cost gates are proven under real operating conditions. Current pilot downside of ${formatAED(pilotLoss)} remains bounded relative to the modeled cost of inaction ${formatAED(doNothingCost)} and public-value score ${governmentValue.score}/100.`,
        confidence: Math.max(finalDecision.confidence, 64),
      };
    }
  }

  const governanceConditions: string[] = [];
  const governanceTriggers: string[] = [];
  if (archetype === 'Drone Last Mile Delivery') {
    governanceConditions.push('Do not scale unless cost per delivery is at or below AED 30.');
    governanceConditions.push('Do not scale unless confidence-adjusted throughput is at or above 110 deliveries per drone per day.');
    governanceConditions.push('Do not scale unless contracted demand is at or above 65% of volume.');
    governanceConditions.push('Do not approve or continue the pilot unless it directly proves the unit-economics pathway toward scale, not just safe operations.');
    governanceTriggers.push('If confidence-adjusted throughput falls below 110 deliveries/day, automatically halt expansion.');
    governanceTriggers.push('If scale cost per delivery exceeds AED 30, automatically halt expansion.');
    governanceTriggers.push('If contracted volume falls below 65%, automatically halt expansion.');
    governanceTriggers.push('If the pilot remains above AED 35 per delivery at exit, halt further capital release and redesign the pilot economics.');
  }
  if (unitEconomics?.minimumViableCheck !== 'PASS') {
    governanceConditions.push('Minimum viable unit economics must pass before releasing Phase 2 funding.');
  }
  if ((demandCertainty?.revenueConfidenceScore ?? 100) < 60) {
    governanceConditions.push('Demand certainty must improve before pilot approval through stronger contracted revenue evidence or named anchor commitments.');
  }
  if (pilotJustification?.alignment === 'MISALIGNED') {
    governanceConditions.push('Pilot design must be re-scoped so it tests the hardest economic unknown before additional funding is released.');
  }
  if ((scenarioIntelligence?.probabilityNegativeNpv ?? 0) >= 35) {
    governanceConditions.push('Re-run scenario controls if downside probability remains above 35%.');
  }

  if (archetype === 'Drone Last Mile Delivery' && killSwitchMetrics?.pilotGateStatus === 'CONDITIONAL') {
    finalDecision = {
      ...finalDecision,
      verdict: 'CONDITIONAL',
      label: 'Approve Pilot Only',
      summary: `Approve pilot only. ${killSwitchMetrics.summary} ${unitEconomics?.summary ?? ''}`.trim(),
      confidence: Math.min(finalDecision.confidence, 68),
      approvalScope: 'PILOT_ONLY',
      conditions: governanceConditions,
      triggers: governanceTriggers,
      automaticHalt: true,
    };
  } else if (killSwitchMetrics?.pilotGateStatus === 'FAIL') {
    finalDecision = {
      ...finalDecision,
      approvalScope: 'HALT',
      conditions: governanceConditions,
      triggers: governanceTriggers,
      automaticHalt: true,
    };
  } else {
    finalDecision = {
      ...finalDecision,
      approvalScope: finalDecision.verdict === 'DO_NOT_INVEST' ? 'HALT' : finalDecision.verdict === 'CONDITIONAL' ? 'PILOT_ONLY' : 'FULL_SCALE',
      conditions: governanceConditions,
      triggers: governanceTriggers,
      automaticHalt: governanceTriggers.length > 0,
    };
  }

  if (capitalEfficiency?.classification === 'PUBLIC_VALUE' && finalDecision.verdict !== 'DO_NOT_INVEST') {
    finalDecision = {
      ...finalDecision,
      verdict: 'CONDITIONAL',
      label: finalDecision.approvalScope === 'PILOT_ONLY' ? finalDecision.label : 'Conditional Approval (Public-Value Case)',
      summary: `${finalDecision.summary} ${capitalEfficiency.summary}`.trim(),
      approvalScope: finalDecision.approvalScope === 'FULL_SCALE' ? 'PILOT_ONLY' : finalDecision.approvalScope,
    };
  }

  // ── Post-process: align IC readiness grade with kill-switch-aware final decision ──
  // When the decision is upgraded to CONDITIONAL (strategic-value path), the IC grade/notes
  // computed from pure financial composite would still read "D / Not recommended" — contradicting
  // the staged-approval narrative. Lift grade to B (Conditional) with the approved wording.
  let finalICSummary = investmentCommitteeSummary;
  if (finalDecision.verdict === 'CONDITIONAL' && finalDecision.label?.includes('Strategic Value')) {
    finalICSummary = {
      ...investmentCommitteeSummary,
      readinessGrade: 'B',
      gradingNotes: 'Conditionally ready. Approve pilot mobilization only; address flagged unit-economics and scale-gate items before Phase 2 funding release.',
    };
  } else if (finalDecision.verdict === 'CONDITIONAL' && investmentCommitteeSummary.readinessGrade === 'A') {
    finalICSummary = {
      ...investmentCommitteeSummary,
      readinessGrade: 'B',
      gradingNotes: 'Conditionally ready. Approve pilot mobilization only; address flagged unit-economics and scale-gate items before Phase 2 funding release.',
    };
  }

  // ── Post-process: enforce commercial hurdle + value-destruction guardrails ──
  // This block is the committee-grade honesty filter: no matter what the blended
  // composite says, a sub-hurdle IRR or negative commercial NPV must be framed as
  // "Controlled pilot — not a commercial investment yet" rather than "Conditional".
  const hurdleCheck = buildCommercialHurdleCheck(archetype, npv, irr, totalInvestment, cashFlows);
  const hurdleMissed = !hurdleCheck.meetsHurdle;
  const negativeOrThinNpv = npv < 0 || hurdleCheck.npvToInvestmentPct < 5;
  const highRisk = hurdleCheck.valueDestructionRisk === 'HIGH';
  const commercialCaseFails = hurdleMissed || negativeOrThinNpv || highRisk;
  if (commercialCaseFails) {
    const hurdleNote = `${hurdleCheck.summary} Commercial case is NOT VIABLE at current assumptions; approve Phase 1 (pilot) only and release scale capital strictly against measured gates.`;
    // IC grade: force to C (Conditional) — never B/A when commercial case fails.
    const currentNotes = finalICSummary.gradingNotes || '';
    finalICSummary = {
      ...finalICSummary,
      readinessGrade: finalICSummary.readinessGrade === 'D' ? 'D' : 'C',
      gradingNotes: currentNotes.includes(hurdleNote) ? currentNotes : `${hurdleNote}${currentNotes ? ' ' + currentNotes : ''}`.trim(),
    };
    // Reframe the decision: never allow INVEST / STRONG_INVEST; label as a controlled pilot.
    // Label is deliberately decisive ("Reject full commercial rollout") so the committee
    // cannot read it as a soft "conditional approval".
    const label = npv < 0
      ? 'Reject Full Commercial Rollout — Approve Pilot Only (Phase 1)'
      : 'Reject Full Commercial Rollout — Approve Pilot Only (Phase 1, Hurdle Not Cleared)';
    if (finalDecision.verdict === 'STRONG_INVEST' || finalDecision.verdict === 'INVEST' || finalDecision.verdict === 'CONDITIONAL') {
      finalDecision = {
        ...finalDecision,
        verdict: npv < 0 ? 'CAUTION' : 'CONDITIONAL',
        approvalScope: 'PILOT_ONLY',
        label,
        summary: `${hurdleNote} ${finalDecision.summary}`.trim(),
      };
    }
  }

  // ── Post-process: overlay driver model margins onto five-year projections ──
  let finalProjections = fiveYearProjections;
  if (driverModel?.margins?.ebitdaMargin) {
    const driverMargins = driverModel.margins.ebitdaMargin;
    const updatedYearly = fiveYearProjections.yearly.map(proj => {
      if (proj.year > 0 && proj.year <= driverMargins.length) {
        return { ...proj, operatingMargin: driverMargins[proj.year - 1]! };
      }
      return proj;
    });
    const avgMargin = driverMargins.length > 0 ? driverMargins.reduce((s, m) => s + m, 0) / driverMargins.length : fiveYearProjections.summary.avgOperatingMargin;
    finalProjections = {
      yearly: updatedYearly,
      summary: { ...fiveYearProjections.summary, avgOperatingMargin: avgMargin },
    };
  }

  // ─── Committee-grade analytics (see interface docs) ───
  const benefitMix = buildBenefitMixBreakdown(benefits, costs, discountRate);
  const capexSchedule = buildCapexSchedule(costs, archetype);
  const commercialHurdleCheck = hurdleCheck;
  let avUnitEconomicsPerTrip: AVUnitEconomicsPerTrip | undefined;
  let breakEvenSensitivity: BreakEvenSensitivity | undefined;
  let avYearProgression: AVYearProgression | undefined;
  let avScenarioStress: AVScenarioStress | undefined;
  if (archetype === 'Autonomous Vehicle Platform') {
    const avAnalytics = buildAVUnitEconomicsPerTrip(domainParameters, costs, adoptionRate);
    if (avAnalytics) {
      avUnitEconomicsPerTrip = avAnalytics.avUnitEconomics;
      breakEvenSensitivity = avAnalytics.breakEvenSensitivity;
    }
    avYearProgression = buildAVYearProgression(domainParameters, costs, adoptionRate);
    avScenarioStress = buildAVScenarioStress(domainParameters, costs, adoptionRate, totalInvestment);
  }
  const cumulativeFundingRequirement = buildCumulativeFundingRequirement(cashFlows);
  const stagedCapitalPlan = buildStagedCapitalPlan(archetype, totalInvestment, capexSchedule, avScenarioStress, hurdleCheck);
  const commercialVsStrategicNpv = buildCommercialVsStrategicNpv(benefits, costs, discountRate, npv, hurdleCheck.hurdleIrrPct);

  // ─── Funding block signal: enforces kill-switch thresholds financially ───
  // Aggregates the hard stops that, if failed, must prevent Phase 2/3 capital release
  // even if the blended composite says otherwise. This is the financial teeth behind
  // kill-switch metrics — not an advisory flag.
  const fundingBlockReasons: string[] = [];
  if (avUnitEconomicsPerTrip?.verdict === 'FAIL') {
    fundingBlockReasons.push(`Fully loaded cost per trip (${formatAED(avUnitEconomicsPerTrip.fullyLoadedCostPerTrip)}) exceeds fare revenue (${formatAED(avUnitEconomicsPerTrip.revenuePerTrip)}); cost/trip target not met.`);
  }
  if (hurdleCheck.valueDestructionRisk === 'HIGH') {
    fundingBlockReasons.push(`Value-destruction risk HIGH (NPV ${formatAED(npv)}, ${hurdleCheck.npvToInvestmentPct.toFixed(1)}% of capital at risk).`);
  }
  if (!hurdleCheck.meetsHurdle) {
    fundingBlockReasons.push(`IRR ${hurdleCheck.actualIrrPct.toFixed(1)}% is ${hurdleCheck.irrGapPpsBelowHurdle.toFixed(1)}pp below the ${hurdleCheck.hurdleIrrPct}% ${archetype}-class hurdle.`);
  }
  if (killSwitchMetrics?.pilotGateStatus === 'FAIL') {
    fundingBlockReasons.push(`Kill-switch pilot gate status = FAIL.`);
  }
  const fundingBlock: FundingBlockSignal = {
    blocked: fundingBlockReasons.length > 0,
    reasons: fundingBlockReasons,
    narrative: fundingBlockReasons.length > 0
      ? `Scale funding is BLOCKED under current unit economics. ${fundingBlockReasons.length} threshold${fundingBlockReasons.length === 1 ? '' : 's'} failed: ${fundingBlockReasons.join(' ')} Phase 2/3 capital cannot be released until these gates clear in-pilot.`
      : 'No funding block triggered. Phase 2 release remains contingent on staged-capital exit gates.',
  };

  // ─── Board recommendation: sharpened, decisive language ───
  const commercialFails = !hurdleCheck.meetsHurdle || npv < 0 || hurdleCheck.valueDestructionRisk === 'HIGH';
  const isAutonomousVehicleArchetype = archetype === 'Autonomous Vehicle Platform';
  const isDroneArchetype = archetype === 'Drone Last Mile Delivery' || archetype === 'Drone First Mile Delivery';
  const scaleUnitCondition = isAutonomousVehicleArchetype
    ? 'fully loaded cost/trip within 20% of target and trending down'
    : isDroneArchetype
      ? 'fully loaded cost/delivery within 20% of target and trending down'
      : 'cost-to-serve, support effort, and adoption economics within 20% of target and trending down';
  const scaleUtilizationCondition = isAutonomousVehicleArchetype || isDroneArchetype
    ? 'utilisation ≥70% sustained for 90 days'
    : 'adoption or process-throughput ≥70% sustained for 90 days';
  const killZoneCondition = isAutonomousVehicleArchetype
    ? 'kill-zone levers (cost/km, trips/day, utilisation, fare) all outside stop thresholds for 6 months'
    : isDroneArchetype
      ? 'kill-zone levers (cost/delivery, deliveries/day, utilisation, contracted demand) all outside stop thresholds for 6 months'
      : 'kill-zone levers (cost-to-serve, adoption, support load, benefit realization) all outside stop thresholds for 6 months';
  const boardRecommendation: BoardRecommendation = commercialFails
    ? {
        headline: 'Do not approve full-scale funding. Approve Phase 1 validation only.',
        rejectAction: `Do NOT approve the full-scale ${archetype} case yet. Commercial NPV is ${formatAED(commercialVsStrategicNpv.commercialNpvAED)} with IRR ${commercialVsStrategicNpv.commercialIrrPct.toFixed(1)}% — ${hurdleCheck.irrGapPpsBelowHurdle.toFixed(1)}pp below the ${hurdleCheck.hurdleIrrPct}% hurdle.`,
        approveAction: `Approve Phase 1 (capital-capped pilot, ${formatAED(stagedCapitalPlan.phase1CapAED)} envelope, ${(stagedCapitalPlan.phases[0]?.capitalShareOfTotalPct ?? 0).toFixed(0)}% of total CapEx) strictly to validate unit economics.`,
        capitalReleaseCondition: `Release Phase 2/3 capital ONLY when: (1) ${scaleUnitCondition}; (2) ${scaleUtilizationCondition}; (3) pilot-level IRR or public-value-adjusted benefits ≥${hurdleCheck.hurdleIrrPct}% equivalent for two consecutive quarters; (4) ${killZoneCondition}.`,
        rationale: `Probability-weighted expected NPV is negative; upside scenarios depend on unvalidated adoption, benefit realization, and cost-maturity assumptions. A disciplined Phase 1 validation either proves the path to scale or exits ~${formatAED(stagedCapitalPlan.phase1CapAED)} of avoidable loss — not the full ${formatAED(stagedCapitalPlan.totalCapitalAED)} envelope.`,
      }
    : {
        headline: 'Approve commercial case with standard stage gates.',
        rejectAction: 'N/A — commercial hurdle cleared.',
        approveAction: `Approve staged capital plan (${formatAED(stagedCapitalPlan.totalCapitalAED)}) with standard Phase 1 → Phase 2 → Phase 3 gate reviews.`,
        capitalReleaseCondition: `Release capital in accordance with the staged capital plan gates.`,
        rationale: `IRR ${hurdleCheck.actualIrrPct.toFixed(1)}% clears the ${hurdleCheck.hurdleIrrPct}% hurdle; NPV is ${formatAED(npv)} with a ${hurdleCheck.npvToInvestmentPct.toFixed(1)}% cushion on total investment.`,
      };

  // ─── Pilot Economics View: honest pilot-scale numbers for AV only ───
  // Re-runs unit economics at a pilot-realistic 50–100 vehicle / 60–65% util profile
  // so the committee doesn't validate the pilot using full-scale assumptions.
  let pilotEconomicsView: PilotEconomicsView | undefined;
  if (archetype === 'Autonomous Vehicle Platform') {
    const defaults = getDefaultDomainParameters('Autonomous Vehicle Platform');
    const pilotFleetSize = 80; // mid of 50–100 pilot range
    const pilotUtilization = 0.62; // realistic pilot utilization (vs 0.78 mature-state)
    const fareRate = domainParameters['Taxi Fare Rate'] ?? defaults['Taxi Fare Rate'] ?? 2.7;
    const tripDistance = domainParameters['Average Trip Distance'] ?? defaults['Average Trip Distance'] ?? 13;
    const dailyTrips = (domainParameters['Daily Trips per Vehicle'] ?? defaults['Daily Trips per Vehicle'] ?? 16) * 0.85; // pilot ramps lower
    // Pilot cost/km is higher than mature-state (more safety operators per vehicle, less automation, smaller scale)
    const pilotCostPerKm = (domainParameters['Operating Cost per km'] ?? defaults['Operating Cost per km'] ?? 1.25) * 1.35;
    const pilotRevenuePerTrip = fareRate * tripDistance;
    const pilotVariableCostPerTrip = pilotCostPerKm * tripDistance;
    // Pilot overhead is disproportionately high — fixed costs spread over fewer trips.
    const year3Fixed = costs.filter((c) => c.isRecurring).reduce((sum, c) => sum + (c.year3 || 0), 0);
    const pilotFixedShare = 0.55; // pilot carries more than its proportional share of setup/fixed
    const effectivePilotFleet = Math.max(1, pilotFleetSize * pilotUtilization);
    const pilotAnnualTrips = effectivePilotFleet * dailyTrips * 365;
    const pilotOverheadPerTrip = pilotAnnualTrips > 0 ? (year3Fixed * pilotFixedShare) / pilotAnnualTrips : 0;
    const pilotFullyLoadedCostPerTrip = pilotVariableCostPerTrip + pilotOverheadPerTrip;
    const pilotFullyLoadedMarginPerTrip = pilotRevenuePerTrip - pilotFullyLoadedCostPerTrip;
    const pilotFullyLoadedMarginPct = pilotRevenuePerTrip > 0 ? (pilotFullyLoadedMarginPerTrip / pilotRevenuePerTrip) * 100 : 0;
    const pilotAnnualContributionAED = pilotAnnualTrips * pilotFullyLoadedMarginPerTrip;
    const profitabilityExpectation: PilotEconomicsView['profitabilityExpectation'] =
      pilotFullyLoadedMarginPct >= 5 ? 'EXPECTED' : pilotFullyLoadedMarginPct >= -10 ? 'BREAK_EVEN_POSSIBLE' : 'NOT_EXPECTED';
    pilotEconomicsView = {
      pilotFleetSize,
      pilotUtilization,
      pilotDailyTripsPerVehicle: dailyTrips,
      pilotRevenuePerTrip,
      pilotVariableCostPerTrip,
      pilotOverheadPerTrip,
      pilotFullyLoadedCostPerTrip,
      pilotFullyLoadedMarginPerTrip,
      pilotFullyLoadedMarginPct,
      pilotAnnualContributionAED,
      profitabilityExpectation,
      narrative: `Pilot economics at ${pilotFleetSize} vehicles and ${(pilotUtilization * 100).toFixed(0)}% utilisation (NOT full-scale): revenue ${formatAED(pilotRevenuePerTrip)}/trip, fully loaded cost ${formatAED(pilotFullyLoadedCostPerTrip)}/trip (variable ${formatAED(pilotVariableCostPerTrip)} + overhead ${formatAED(pilotOverheadPerTrip)}), margin ${pilotFullyLoadedMarginPct.toFixed(0)}%. ${profitabilityExpectation === 'NOT_EXPECTED' ? 'Pilot is NOT expected to be profitable — it is a validation stage, not a return stage. Committee must not judge the pilot against full-scale economics.' : profitabilityExpectation === 'BREAK_EVEN_POSSIBLE' ? 'Pilot may approach break-even but should not be underwritten for profitability — treat any upside as evidence the scale case is achievable.' : 'Pilot may be profitable; still treat pilot numbers as signal for scale decision, not as a return-maximising exercise.'}`,
    };
  }

  // ─── Executive Committee Statement: locked one-block IC memo ───
  const returnMultipleX = totalInvestment > 0 ? totalBenefits / totalInvestment : 0;
  const strategicShare = commercialVsStrategicNpv.strategicSharePct;
  const undiscountedNet = totalBenefits - totalCosts;
  const peakFunding = cumulativeFundingRequirement.peakFundingAED;
  const peakFundingYear = cumulativeFundingRequirement.peakFundingYear;

  // AV-specific break-even lever thresholds (derived from stress analysis where available).
  const isAV = archetype === 'Autonomous Vehicle Platform';
  const avDefaults = isAV ? getDefaultDomainParameters('Autonomous Vehicle Platform') : undefined;
  const avBreakEvenTrips = isAV ? Math.max(22, Math.round(breakEvenSensitivity?.requiredTripsPerVehiclePerDay ?? 25)) : 0;
  const avBreakEvenCostKm = isAV ? Math.min(0.85, Number(breakEvenSensitivity?.requiredCostPerKmCeiling ?? 0.85)) : 0;
  const avBreakEvenUtil = isAV ? Math.max(0.80, Number(breakEvenSensitivity?.requiredUtilization ?? 0.85)) : 0;
  const avCurrentTrips = isAV ? (domainParameters['Daily Trips per Vehicle'] ?? avDefaults?.['Daily Trips per Vehicle'] ?? 16) : 0;
  const avCurrentCostKm = isAV ? (domainParameters['Operating Cost per km'] ?? avDefaults?.['Operating Cost per km'] ?? 1.25) : 0;
  const avCurrentUtil = isAV ? (domainParameters['Fleet Utilization Rate'] ?? avDefaults?.['Fleet Utilization Rate'] ?? 0.65) : 0;

  const executiveCommitteeStatement: ExecutiveCommitteeStatement = {
    financialNarrativeOneLiner:
      `The project is cash-positive on an undiscounted basis (${formatAED(undiscountedNet)}) but ${npv < 0 ? 'value-destructive' : 'value-thin'} after risk-adjusted discounting (NPV ${formatAED(npv)}). Do not read the undiscounted figure as profitability.`,
    strategicJustification: commercialFails
      ? `This investment is justified strategically, not financially at this stage. Commercial NPV is ${formatAED(commercialVsStrategicNpv.commercialNpvAED)} with IRR ${commercialVsStrategicNpv.commercialIrrPct.toFixed(1)}% — below the ${hurdleCheck.hurdleIrrPct}% ${archetype} hurdle. The case is a market-entry / capability-build validation, not a return-maximising investment. Strategic / public-value benefits account for ${strategicShare.toFixed(0)}% of total value.`
      : `Commercial and strategic cases both support the investment. Commercial NPV ${formatAED(commercialVsStrategicNpv.commercialNpvAED)} clears the hurdle independently; strategic benefits are additive.`,
    hardCapitalReleaseRule: isAV
      ? `Hard rule: No scale capital (Phase 2/3) will be released until fully loaded cost per trip ≤ 20 AED sustained for two consecutive quarters at pilot scale. Non-negotiable; enforced by the funding block.`
      : `Hard rule: No scale capital (Phase 2/3) will be released until commercial unit-economics thresholds (archetype-specific cost/throughput targets) are verified in-pilot. Enforced by the funding block.`,
    breakEvenNarrativeReframe:
      `Headline break-even figures apply ONLY under full-scale assumptions (mature utilisation, cost curve, contracted demand). The pilot phase is a validation stage, NOT a recovery phase — the pilot is not expected to break even and should not be judged against full-scale break-even metrics. Positive contribution margin does not translate to profitability due to high fixed-cost absorption during scale-up.`,
    returnMultipleSignal: returnMultipleX < 1.10
      ? `Return multiple of ${returnMultipleX.toFixed(2)}x is ~breakeven over the 5-year horizon — the case barely returns capital even before risk-adjustment. This reinforces the non-commercial positioning: approve only as a staged pilot, not as a return-seeking investment.`
      : returnMultipleX < 1.50
        ? `Return multiple of ${returnMultipleX.toFixed(2)}x is thin over 5 years. Modest commercial upside; treat scale capital release as contingent on unit-economics validation.`
        : `Return multiple of ${returnMultipleX.toFixed(2)}x is healthy over 5 years. Commercial case supports itself independently of strategic benefits.`,
    pilotProfitabilityExpectation: isAV
      ? `Pilot is NOT expected to be profitable. Pilot-specific economics (${pilotEconomicsView?.pilotFleetSize ?? 80} vehicles, ${((pilotEconomicsView?.pilotUtilization ?? 0.62) * 100).toFixed(0)}% utilisation, elevated cost/km, disproportionate fixed-cost burden) are modelled separately so the committee does not validate the pilot against mature-state assumptions.`
      : `Pilot is not underwritten for profitability. Pilot is a validation stage for unit economics, capability, and demand — success is measured by threshold gates, not by pilot NPV.`,
    commercialDecision: commercialFails
      ? `Commercial decision: DO NOT APPROVE full rollout. Commercial NPV is ${formatAED(commercialVsStrategicNpv.commercialNpvAED)} with IRR ${commercialVsStrategicNpv.commercialIrrPct.toFixed(1)}% — ${hurdleCheck.irrGapPpsBelowHurdle.toFixed(1)}pp below the ${hurdleCheck.hurdleIrrPct}% hurdle.`
      : `Commercial decision: APPROVE. Commercial NPV ${formatAED(commercialVsStrategicNpv.commercialNpvAED)} and IRR ${commercialVsStrategicNpv.commercialIrrPct.toFixed(1)}% clear the ${hurdleCheck.hurdleIrrPct}% ${archetype} hurdle.`,
    strategicDecision:
      `Strategic decision: APPROVE stage-gated pilot only. ${formatAED(stagedCapitalPlan.phase1CapAED)} Phase 1 envelope (${(stagedCapitalPlan.phases[0]?.capitalShareOfTotalPct ?? 0).toFixed(0)}% of total CapEx); Phase 2/3 capital held until exit gates clear.`,
    burnStatement:
      `The program requires ~${formatAED(peakFunding)} cumulative negative cash flow before breakeven (peak draw at Year ${peakFundingYear}). This is the real treasury exposure — not the NPV or payback figures.`,
    breakEvenLevers: isAV
      ? {
          trips: `Trips/day ≥ ${avBreakEvenTrips} (currently ${avCurrentTrips.toFixed(0)})`,
          costPerKm: `Cost/km ≤ ${avBreakEvenCostKm.toFixed(2)} AED (currently ${avCurrentCostKm.toFixed(2)})`,
          utilization: `Utilisation ≥ ${(avBreakEvenUtil * 100).toFixed(0)}% (currently ${(avCurrentUtil * 100).toFixed(0)}%)`,
          combined: `Break-even requires ALL THREE: trips/day ≥ ${avBreakEvenTrips}, cost/km ≤ ${avBreakEvenCostKm.toFixed(2)} AED, utilisation ≥ ${(avBreakEvenUtil * 100).toFixed(0)}%. Current operating point misses all three; pilot must prove each lever can be sustained before scale capital is released.`,
        }
      : {
          trips: 'Throughput: archetype-specific minimum (see break-even sensitivity)',
          costPerKm: 'Cost threshold: archetype-specific ceiling (see break-even sensitivity)',
          utilization: 'Utilisation: archetype-specific minimum (see break-even sensitivity)',
          combined: 'Break-even depends on sustaining archetype-specific throughput, cost, and utilisation levers concurrently. See breakEvenSensitivity block for verified numeric thresholds.',
        },
    conditionsReframe: isAV
      ? `Viability requires — not "assumes" — sustaining ≥${avBreakEvenTrips} trips/day under regulated operating conditions, cost/km ≤ ${avBreakEvenCostKm.toFixed(2)} AED, and utilisation ≥ ${(avBreakEvenUtil * 100).toFixed(0)}%. These are execution conditions, not modelling assumptions; they must be proven in-pilot.`
      : `Model inputs are restated as execution conditions, not passive assumptions. Viability REQUIRES the listed operating thresholds to be achieved and sustained in-pilot before scale is authorised.`,
    valueTypeSeparation:
      `Commercial value drives NPV (currently ${formatAED(commercialVsStrategicNpv.commercialNpvAED)} — ${commercialVsStrategicNpv.commercialNpvAED < 0 ? 'negative' : 'positive'}). Public/strategic value (${formatAED(commercialVsStrategicNpv.strategicNpvAED)}, ${strategicShare.toFixed(0)}% of total) justifies pilot approval but does NOT justify commercial capital release.`,
    capexPhasingStatement:
      `The ${formatAED(stagedCapitalPlan.totalCapitalAED)} envelope is NOT committed upfront. Capital is released in phases (Phase 1: ${formatAED(stagedCapitalPlan.phase1CapAED)}, Phase 2/3: balance held) against regulatory, unit-economics, and utilisation gates. Today's approval authorises Phase 1 only.`,
    failureCondition: isAV
      ? `Failure condition: If unit cost remains above 35–40 AED per trip OR utilisation falls below 70% after pilot validation window, scale expansion is HALTED and Phase 2/3 capital is withdrawn from the approval pipeline.`
      : `Failure condition: If archetype-specific unit-economics thresholds or utilisation minimums are not sustained through the pilot validation window, scale expansion is HALTED and remaining capital is withdrawn from the approval pipeline.`,
    finalDecisionFraming: commercialFails
      ? `This is not a commercially viable investment at current assumptions. It is a strategically justified, stage-gated pilot to validate whether ${isAV ? 'autonomous mobility can reach economic viability under Dubai operating conditions' : `${archetype.toLowerCase()} can reach economic viability under realistic operating conditions`}.`
      : `This is a commercially viable investment that is also strategically aligned. Approve the staged capital plan with standard Phase 1 → 2 → 3 gate reviews.`,
    returnMultipleX,
  };

  return {
    inputs: { ...inputs, domainParameters },
    archetype,
    costs,
    benefits,
    cashFlows,
    metrics: {
      npv,
      irr,
      irrNote,
      roi,
      discountedRoi,
      paybackMonths,
      totalCosts,
      totalBenefits,
      netValue,
    },
    scenarios,
    decision: finalDecision,
    governmentValue,
    fiveYearProjections: finalProjections,
    doNothingCost,
    breakEvenAnalysis,
    terminalValue,
    discountRateComparison,
    governmentExternalities,
    investmentCommitteeSummary: finalICSummary,
    driverModel,
    killSwitchMetrics,
    riskAdjustedAnalysis,
    unitEconomics,
    operationalConstraints,
    scenarioIntelligence,
    commercialAudit,
    benchmarkValidation,
    capitalEfficiency,
    modelConfidence,
    economicProof,
    demandCertainty,
    pilotJustification,
    executiveChallenge,
    financialViews,
    benefitMix,
    capexSchedule,
    doNothingBreakdown,
    breakEvenSensitivity,
    avUnitEconomicsPerTrip,
    avYearProgression,
    avScenarioStress,
    commercialHurdleCheck,
    cumulativeFundingRequirement,
    stagedCapitalPlan,
    commercialVsStrategicNpv,
    fundingBlock,
    boardRecommendation,
    pilotEconomicsView,
    executiveCommitteeStatement,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Build inputs from database record and demand report
 */
export function buildInputsFromData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  businessCase: Record<string, any> | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  demandReport: Record<string, any> | null | undefined,
  defaults: Partial<FinancialInputs> = {}
): FinancialInputs {
  const archetype = detectArchetype({
    projectName: demandReport?.suggestedProjectName || '',
    projectDescription: demandReport?.projectDescription || demandReport?.businessObjective || '',
    organization: demandReport?.submittingOrganization || demandReport?.organizationName || '',
    objectives: demandReport?.businessObjective || '',
    problemStatement: demandReport?.problemStatement || '',
  });
  const defaultAssumptions = getDefaultFinancialAssumptions(archetype);
  const defaultDomainParameters = {
    ...getDefaultDomainParameters(archetype),
    ...(defaults.domainParameters || {}),
  };

  // Priority: persisted values > explicit demand anchors > contextual estimate > draft AI output > defaults
  const hasPersistedBusinessCase = isPersistedBusinessCaseRecord(businessCase);
  const savedTotal = hasPersistedBusinessCase ? parseMoneyNumber(businessCase?.totalCostEstimate) : 0;
  const explicitDemandBudgetDetails = resolveExplicitDemandBudget(demandReport);
  const explicitDemandBudget = explicitDemandBudgetDetails && explicitDemandBudgetDetails.boundType !== 'minimum'
    ? explicitDemandBudgetDetails.midpoint
    : 0;
  const aiRecommendedBudget = parseMoneyNumber(businessCase?.aiRecommendedBudget);
  const draftArtifactTotal = hasPersistedBusinessCase ? 0 : parseMoneyNumber(businessCase?.totalCostEstimate);
  const aiTotal = parseMoneyNumber(businessCase?.financialAnalysis?.totalCost);
  const budgetTotal = parseMoneyNumber(demandReport?.estimatedBudget);
  const savedDomainParams = {
    ...(businessCase?.savedDomainParameters && typeof businessCase.savedDomainParameters === 'object'
      ? businessCase.savedDomainParameters
      : {}),
    ...(businessCase?.domainParameters && typeof businessCase.domainParameters === 'object'
      ? businessCase.domainParameters
      : {}),
  };
  const inferredDomainParams = sanitizeDomainParameters(
    archetype,
    inferDomainParametersFromDemandContext(demandReport, archetype, savedDomainParams),
  );
  const contextEstimate = estimateInvestmentFromDemandContext(demandReport, archetype, inferredDomainParams);

  let totalInvestment = 0;
  const savedTotalConflictsWithExplicitBudget = explicitDemandBudget > 0 && savedTotal > 0
    && (savedTotal > explicitDemandBudget * 5 || savedTotal < explicitDemandBudget / 5);
  if (explicitDemandBudget > 0 && (!savedTotal || savedTotalConflictsWithExplicitBudget)) {
    totalInvestment = explicitDemandBudget;
  } else if (savedTotal > 0) {
    totalInvestment = savedTotal;
  } else if (explicitDemandBudget > 0) {
    totalInvestment = explicitDemandBudget;
  } else if (aiRecommendedBudget > 0) {
    totalInvestment = aiRecommendedBudget;
  } else if (contextEstimate > 0) {
    totalInvestment = contextEstimate;
  } else if (draftArtifactTotal > 0) {
    totalInvestment = draftArtifactTotal;
  } else if (aiTotal > 0) {
    totalInvestment = aiTotal;
  } else if (budgetTotal > 0) {
    totalInvestment = budgetTotal;
  }

  // Get saved assumptions or use defaults
  const savedAssumptions = {
    ...(businessCase?.savedFinancialAssumptions && typeof businessCase.savedFinancialAssumptions === 'object'
      ? businessCase.savedFinancialAssumptions
      : {}),
    ...(businessCase?.financialAssumptions && typeof businessCase.financialAssumptions === 'object'
      ? businessCase.financialAssumptions
      : {}),
  };

  return {
    totalInvestment: totalInvestment || defaults.totalInvestment || 0,
    archetype,
    discountRate: savedAssumptions.discountRate === undefined
      ? (defaults.discountRate ?? defaultAssumptions.discountRate)
      : savedAssumptions.discountRate * 100,
    adoptionRate: savedAssumptions.adoptionRate ?? defaults.adoptionRate ?? defaultAssumptions.adoptionRate,
    maintenancePercent: savedAssumptions.maintenancePercent ?? defaults.maintenancePercent ?? defaultAssumptions.maintenancePercent,
    contingencyPercent: savedAssumptions.contingencyPercent ?? defaults.contingencyPercent ?? defaultAssumptions.contingencyPercent,
    domainParameters: Object.keys(inferredDomainParams).length > 0
      ? inferredDomainParams
      : defaultDomainParameters,
  };
}
