import type {
  Assumption,
  BusinessCaseData,
  Dependency,
  ImplementationPhase,
  KpiItem,
  Milestone,
  NextStep,
  Risk,
  ScopeDefinition,
  SmartObjective,
  SuccessCriterion,
} from "../business-case";

import {
  FULL_SCOPE_KEYWORDS,
  PILOT_SCOPE_KEYWORDS,
  asFiniteNumber,
  asRecord,
  asString,
  buildSentenceList,
  countKeywordHits,
  formatCompactAed,
  joinNarrativeParts,
  normalizeObjectArray,
  normalizeRatio,
  pickScopedSentences,
  pickStageSpecificList,
  rewriteDroneStageText,
  type BusinessCaseViewMode,
} from "./BusinessCaseTab.stage-scope.utils";
export {
  STAGE_EDITABLE_FIELDS,
  asFiniteNumber,
  asRecord,
  asString,
  formatCompactAed,
  normalizeRateDecimal,
  normalizeRatio,
  normalizeRecordNumbers,
  type BusinessCaseLayerKey,
  type BusinessCaseViewMode,
  type StageEditableField,
} from "./BusinessCaseTab.stage-scope.utils";

export interface StageScopedContext {
  projectTitle: string;
  activeStage: Record<string, unknown> | undefined;
  activeFinancialView: Record<string, unknown> | undefined;
  metrics: Record<string, unknown> | undefined;
  view: BusinessCaseViewMode;
}

export interface StageFinancialMetricsOverride {
  roiPercent?: number;
  npvValue?: number;
  paybackMonths?: number;
  recognizedAnnualRevenue?: number;
  recognizedAnnualDeliveries?: number;
  recognizedRevenuePerDelivery?: number;
  preRealizationRevenuePerDelivery?: number;
  annualRevenue?: number;
  annualDeliveries?: number;
  realizedRevenuePerDelivery?: number;
  effectiveCostPerDelivery?: number;
  nominalRevenuePerDelivery?: number;
}

export function getScenarioOverride(businessCase: BusinessCaseData, view: BusinessCaseViewMode): Record<string, unknown> | undefined {
  const overrides = asRecord(businessCase.scenarioOverrides);
  return asRecord(overrides?.[view]);
}

export function hasOwnScenarioField(override: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(override, field);
}

export function applyScenarioOverride(businessCase: BusinessCaseData, view: BusinessCaseViewMode): BusinessCaseData {
  const override = getScenarioOverride(businessCase, view);
  if (!override) {
    return businessCase;
  }

  const {
    computedFinancialModel: _overrideComputedFinancialModel,
    financialAssumptions: _overrideFinancialAssumptions,
    savedFinancialAssumptions: _overrideSavedFinancialAssumptions,
    domainParameters: _overrideDomainParameters,
    savedDomainParameters: _overrideSavedDomainParameters,
    costOverrides: _overrideCostOverrides,
    benefitOverrides: _overrideBenefitOverrides,
    totalCostEstimate: _overrideTotalCostEstimate,
    aiRecommendedBudget: _overrideAiRecommendedBudget,
    ...safeOverride
  } = override;

  const overrideAssumptions = normalizeObjectArray<Assumption>(safeOverride.keyAssumptions ?? safeOverride.assumptions);
  const hasAssumptionOverride = hasOwnScenarioField(safeOverride, 'keyAssumptions') || hasOwnScenarioField(safeOverride, 'assumptions');
  const overrideProjectDependencies = asRecord(safeOverride.projectDependencies);
  const overrideDependencies = normalizeObjectArray<Dependency>(safeOverride.dependencies ?? overrideProjectDependencies?.dependencies);
  const hasDependencyOverride = hasOwnScenarioField(safeOverride, 'dependencies') || hasOwnScenarioField(safeOverride, 'projectDependencies');
  const overrideImplementationPhases = normalizeObjectArray<ImplementationPhase>(safeOverride.implementationPhases);
  const overrideMilestones = normalizeObjectArray<Milestone>(safeOverride.milestones);
  const overrideTimeline = asRecord(safeOverride.implementationTimeline);
  const hasImplementationOverride = hasOwnScenarioField(safeOverride, 'implementationPhases') || hasOwnScenarioField(safeOverride, 'milestones') || hasOwnScenarioField(safeOverride, 'implementationTimeline');

  return {
    ...businessCase,
    ...safeOverride,
    ...(hasAssumptionOverride ? {
      keyAssumptions: overrideAssumptions,
      assumptions: overrideAssumptions,
    } : {}),
    ...(hasDependencyOverride ? {
      dependencies: overrideDependencies,
      projectDependencies: {
        ...(businessCase.projectDependencies ?? {}),
        ...(overrideProjectDependencies ?? {}),
        dependencies: overrideDependencies,
      },
    } : {}),
    ...(hasImplementationOverride ? {
      implementationPhases: overrideImplementationPhases,
      milestones: overrideMilestones,
      implementationTimeline: {
        ...(asRecord(businessCase.implementationTimeline) ?? {}),
        ...(overrideTimeline ?? {}),
        phases: overrideImplementationPhases,
        milestones: overrideMilestones,
      },
    } : {}),
  };
}

export function applyStageEdits(
  businessCase: BusinessCaseData,
  view: BusinessCaseViewMode,
  field: string,
  value: unknown,
): BusinessCaseData {
  const existingOverrides = asRecord(businessCase.scenarioOverrides);
  const currentOverride = asRecord(existingOverrides?.[view]) ?? {};
  const nextOverride: Record<string, unknown> = {
    ...currentOverride,
    [field]: value,
  };

  if (field === 'keyAssumptions' || field === 'assumptions') {
    nextOverride.keyAssumptions = value;
    nextOverride.assumptions = value;
  }

  if (field === 'projectDependencies') {
    const projectDependencies = asRecord(value);
    nextOverride.dependencies = normalizeObjectArray<Dependency>(projectDependencies?.dependencies);
  }

  if (field === 'dependencies') {
    nextOverride.projectDependencies = {
      ...(asRecord(currentOverride.projectDependencies) ?? {}),
      dependencies: value,
    };
  }

  if (field === 'implementationPhases') {
    nextOverride.implementationTimeline = {
      ...(asRecord(currentOverride.implementationTimeline) ?? {}),
      phases: value,
      milestones: nextOverride.milestones ?? asRecord(currentOverride.implementationTimeline)?.milestones,
    };
  }

  if (field === 'milestones') {
    nextOverride.implementationTimeline = {
      ...(asRecord(currentOverride.implementationTimeline) ?? {}),
      milestones: value,
      phases: nextOverride.implementationPhases ?? asRecord(currentOverride.implementationTimeline)?.phases,
    };
  }

  if (field === 'implementationTimeline') {
    const timeline = asRecord(value);
    if (Array.isArray(timeline?.phases)) {
      nextOverride.implementationPhases = timeline.phases;
    }
    if (Array.isArray(timeline?.milestones)) {
      nextOverride.milestones = timeline.milestones;
    }
  }

  return {
    ...businessCase,
    scenarioOverrides: {
      ...(existingOverrides ?? {}),
      [view]: nextOverride,
    },
  };
}

export function hasScenarioOverrideField(
  businessCase: BusinessCaseData,
  view: BusinessCaseViewMode,
  field: string,
): boolean {
  const override = getScenarioOverride(businessCase, view);
  return Boolean(override && hasOwnScenarioField(override, field));
}

export function resolveStageFinancialMetrics(activeFinancialView: Record<string, unknown> | undefined) {
  const metrics = asRecord(activeFinancialView?.metrics);
  const fiveYearProjections = asRecord(activeFinancialView?.fiveYearProjections);
  const summary = asRecord(activeFinancialView?.summary) ?? asRecord(fiveYearProjections?.summary);

  return {
    metrics,
    lifecycleCost: asFiniteNumber(summary?.totalCosts) ?? asFiniteNumber(activeFinancialView?.lifecycleCost),
    lifecycleBenefit: asFiniteNumber(summary?.totalRevenue) ?? asFiniteNumber(activeFinancialView?.lifecycleBenefit),
    roiPercent: asFiniteNumber(metrics?.roi) ?? asFiniteNumber(metrics?.roiPercent),
    npvValue: asFiniteNumber(metrics?.npv) ?? asFiniteNumber(summary?.totalPresentValue),
    paybackMonths: asFiniteNumber(metrics?.paybackMonths),
  };
}

export function getStageScopedContext(businessCase: BusinessCaseData, view: BusinessCaseViewMode): StageScopedContext {
  const computedFinancialModel = asRecord(businessCase.computedFinancialModel);
  const financialViews = asRecord(computedFinancialModel?.financialViews);
  const activeFinancialView = asRecord(financialViews?.[view]);
  const driverModel = asRecord(computedFinancialModel?.driverModel);
  const stagedEconomics = asRecord(driverModel?.stagedEconomics);
  const activeStage = asRecord(view === 'pilot' ? stagedEconomics?.pilotCase : stagedEconomics?.scaleCase);

  return {
    projectTitle: asString(businessCase.projectTitle) || 'This program',
    activeStage,
    activeFinancialView,
    metrics: asRecord(activeFinancialView?.metrics),
    view,
  };
}

export function shouldDisplayPayback(
  view: BusinessCaseViewMode,
  paybackMonths: number | null,
  roiPercent: number | null,
  npvValue: number | null,
): boolean {
  return view === 'full'
    && paybackMonths != null
    && Number.isFinite(paybackMonths)
    && paybackMonths > 0
    && (roiPercent == null || roiPercent > 0)
    && (npvValue == null || npvValue > 0);
}

export function _formatUnitAed(value: number | null): string {
  if (value == null) {
    return 'AED 0';
  }

  return `AED ${Math.round(value).toLocaleString('en-AE')}`;
}

export function formatPreciseUnitAed(value: number | null): string {
  if (value == null) {
    return 'AED 0.0';
  }

  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatRoundedK(value: number | null): string {
  if (value == null) {
    return '0K';
  }

  return `${Math.round(value / 10000) * 10}K`;
}

export function buildPilotAssumptionCredibilitySentence(activeStage: Record<string, unknown> | undefined): string {
  const variableCostPerDelivery = asFiniteNumber(activeStage?.variableCostPerDelivery);
  const contractedVolumeShare = normalizeRatio(activeStage?.contractedVolumeShare);
  const dailyDeliveriesPerDrone = asFiniteNumber(activeStage?.dailyDeliveriesPerDrone);

  return joinNarrativeParts([
    'Assumption credibility is now explicit rather than implied.',
    variableCostPerDelivery != null
      ? `${formatPreciseUnitAed(variableCostPerDelivery)} variable cost per delivery is a benchmark-based input that still needs live partner, compliance, insurance, and incident-response validation.`
      : '',
    contractedVolumeShare != null
      ? `${Math.round(contractedVolumeShare * 100)}% contracted demand share remains a demand hypothesis until secured commitments are evidenced.`
      : 'Contracted demand remains a demand hypothesis until secured commitments are evidenced.',
    dailyDeliveriesPerDrone != null
      ? `${Math.round(dailyDeliveriesPerDrone)} deliveries/day per drone remains an operating hypothesis until dispatch telemetry proves that cadence under real pilot conditions.`
      : '',
  ]);
}

export function buildPilotEvidencePurchaseSentence(): string {
  return 'This pilot should be approved only as an evidence purchase: it is buying non-negotiable proof on regulatory feasibility, true throughput ceiling, real demand conversion, and the controllable cost curve before any scale capital is released.';
}

export function buildPilotCostRealismSentence(): string {
  return 'Cost realism watchlist: the pilot cost curve must still prove regulatory approvals and audit effort, insurance and liability coverage, airspace and UTM coordination, safety redundancy, and partner economics under the 65% partner-led model.';
}

export function buildPilotStrategicAdvantageSentence(projectTitle: string): string {
  return `${projectTitle} should not justify the pilot on generic innovation language. The strategic bet is whether Dubai Taxi can win where pure logistics players such as Aramex, Careem, or Talabat do not start with the same regulator adjacency, dispatch discipline, public-service trust, and multimodal fleet-control base. The first credible demand should come from priority healthcare, government, and premium urban-delivery lanes where service assurance matters more than commodity volume, and where the pilot can prove this is not just another drone demo but a controlled mobility-service extension.`;
}

export function buildPilotFragilitySentence(businessCase: BusinessCaseData): string {
  const { activeStage } = getStageScopedContext(businessCase, 'pilot');
  const dailyDeliveriesPerDrone = asFiniteNumber(activeStage?.dailyDeliveriesPerDrone);
  const conservativeThroughput = dailyDeliveriesPerDrone != null
    ? Math.max(1, Math.round(dailyDeliveriesPerDrone * 0.75))
    : null;

  return joinNarrativeParts([
    'The top pilot value drivers are throughput, contracted-demand conversion, and fully loaded cost per delivery.',
    'The pilot economics are highly sensitive to throughput and demand realization; a 20-25% deviation materially worsens unit performance.',
    conservativeThroughput != null
      ? `If throughput falls below roughly ${conservativeThroughput} deliveries/day per drone, fixed-cost absorption deteriorates quickly and the unit spread compresses.`
      : '',
    'If contracted demand remains below 50%, expansion stays blocked regardless of other progress.',
    'If fully loaded cost stays above AED 45 per delivery for 2 consecutive months, the pilot pauses and the operating model must be reworked before additional capital is released.',
  ]);
}

export function buildPilotUnitEconomicsSentence(activeStage: Record<string, unknown> | undefined, metricsOverride?: StageFinancialMetricsOverride): string {
  const recognizedRevenuePerDelivery = metricsOverride?.recognizedRevenuePerDelivery
    ?? metricsOverride?.realizedRevenuePerDelivery
    ?? asFiniteNumber(activeStage?.recognizedRevenuePerDelivery)
    ?? asFiniteNumber(activeStage?.realizedRevenuePerDelivery);
  const effectiveCostPerDelivery = metricsOverride?.effectiveCostPerDelivery ?? asFiniteNumber(activeStage?.effectiveCostPerDelivery);
  const annualDeliveries = metricsOverride?.recognizedAnnualDeliveries
    ?? metricsOverride?.annualDeliveries
    ?? asFiniteNumber(activeStage?.recognizedAnnualDeliveries)
    ?? asFiniteNumber(activeStage?.annualDeliveries);
  const contractedVolumeShare = normalizeRatio(activeStage?.contractedVolumeShare);

  if (recognizedRevenuePerDelivery == null || effectiveCostPerDelivery == null) {
    return '';
  }

  const recognizedUnitSpread = recognizedRevenuePerDelivery - effectiveCostPerDelivery;
  const volumeSentence = annualDeliveries != null
    ? `${Math.round(annualDeliveries).toLocaleString('en-AE')} modeled annual deliveries`
    : 'the modeled delivery volume';
  const contractedDemandSentence = contractedVolumeShare != null
    ? `${Math.round(contractedVolumeShare * 100)}% contracted demand share`
    : 'the contracted demand assumption';

  return `Canonical pilot unit economics are locked at ${formatPreciseUnitAed(recognizedRevenuePerDelivery)} recognized revenue per delivery, ${formatPreciseUnitAed(effectiveCostPerDelivery)} fully loaded cost, and ${formatPreciseUnitAed(recognizedUnitSpread)} recognized unit spread. This is the single operating baseline that should be read across the pilot summary, KPI view, and gate narrative; ${volumeSentence} and ${contractedDemandSentence} remain validation assumptions to prove, not evidence of commercial readiness.`;
}

export function buildPilotRevenueBenefitReconciliationSentence(
  activeStage: Record<string, unknown> | undefined,
  activeFinancialView: Record<string, unknown> | undefined,
  metricsOverride?: StageFinancialMetricsOverride,
): string {
  const annualRevenue = metricsOverride?.recognizedAnnualRevenue
    ?? metricsOverride?.annualRevenue
    ?? asFiniteNumber(activeStage?.annualRecognizedRevenue)
    ?? asFiniteNumber(activeStage?.annualRevenue);
  const { lifecycleBenefit } = resolveStageFinancialMetrics(activeFinancialView);

  if (annualRevenue == null || lifecycleBenefit == null) {
    return '';
  }

  return `Pilot benefits (${formatCompactAed(lifecycleBenefit)}) represent only realized and attributable value after ramp, conversion loss, and excluded non-cash or non-recurring components from total recognized revenue of ${formatCompactAed(annualRevenue)}.`;
}

export function buildPilotRevenueBridgeSentence(activeStage: Record<string, unknown> | undefined, metricsOverride?: StageFinancialMetricsOverride): string {
  const annualDeliveries = metricsOverride?.recognizedAnnualDeliveries
    ?? metricsOverride?.annualDeliveries
    ?? asFiniteNumber(activeStage?.recognizedAnnualDeliveries)
    ?? asFiniteNumber(activeStage?.annualDeliveries);
  const annualRevenue = metricsOverride?.recognizedAnnualRevenue
    ?? metricsOverride?.annualRevenue
    ?? asFiniteNumber(activeStage?.annualRecognizedRevenue)
    ?? asFiniteNumber(activeStage?.annualRevenue);
  const annualIntegrationRevenue = asFiniteNumber(activeStage?.annualIntegrationRevenue) ?? 0;
  const recognizedRevenuePerDelivery = metricsOverride?.recognizedRevenuePerDelivery
    ?? metricsOverride?.realizedRevenuePerDelivery
    ?? asFiniteNumber(activeStage?.recognizedRevenuePerDelivery)
    ?? asFiniteNumber(activeStage?.realizedRevenuePerDelivery)
    ?? (annualDeliveries != null && annualRevenue != null && annualDeliveries > 0
      ? annualRevenue / annualDeliveries
      : null);
  const preRealizationRevenuePerDelivery = metricsOverride?.preRealizationRevenuePerDelivery
    ?? metricsOverride?.nominalRevenuePerDelivery
    ?? asFiniteNumber(activeStage?.preRealizationRevenuePerDelivery)
    ?? asFiniteNumber(activeStage?.nominalRevenuePerDelivery);
  const revenueRealizationFactor = normalizeRatio(activeStage?.revenueRealizationFactor);
  const contractedVolumeShare = normalizeRatio(activeStage?.contractedVolumeShare);
  const fleetSize = asFiniteNumber(activeStage?.fleetSize);
  const dailyDeliveriesPerDrone = asFiniteNumber(activeStage?.dailyDeliveriesPerDrone);

  if (annualDeliveries == null || annualRevenue == null || recognizedRevenuePerDelivery == null) {
    return '';
  }

  const grossDeliveryCapacity = fleetSize != null && dailyDeliveriesPerDrone != null
    ? fleetSize * dailyDeliveriesPerDrone * 365
    : null;
  const rampFactor = grossDeliveryCapacity != null && grossDeliveryCapacity > 0
    ? annualDeliveries / grossDeliveryCapacity
    : null;
  const integrationSentence = annualIntegrationRevenue > 0
    ? ` plus ${formatCompactAed(annualIntegrationRevenue)} of integration revenue`
    : '';

  return joinNarrativeParts([
    `Recognized revenue per delivery is the executive KPI for this case: ${formatPreciseUnitAed(recognizedRevenuePerDelivery)} must stay aligned across the executive summary, KPI stack, and decision recommendation.`,
    'Pre-realization yield inputs are bridge mechanics only. They explain how the model gets to recognized revenue, but they are not the executive KPI.',
    'Recognized pilot revenue is explicit: effective revenue = gross delivery capacity x ramp factor x revenue-realization factor, plus contracted platform monetization and integration revenue.',
    grossDeliveryCapacity != null && rampFactor != null && revenueRealizationFactor != null && contractedVolumeShare != null
      ? `In the current pilot model that is ${Math.round(grossDeliveryCapacity).toLocaleString('en-AE')} gross delivery slots x ${Math.round(rampFactor * 100)}% ramp x ${Math.round(revenueRealizationFactor * 100)}% realization with ${Math.round(contractedVolumeShare * 100)}% contracted-share weighting on platform monetization${integrationSentence}.`
      : '',
    preRealizationRevenuePerDelivery != null
      ? `The model's pre-realization delivery yield is ${formatPreciseUnitAed(preRealizationRevenuePerDelivery)} before ramp, conversion loss, and other realization effects are fully applied.`
      : '',
    `This effectively translates to ${formatRoundedK(annualDeliveries)} completed deliveries at ${formatPreciseUnitAed(recognizedRevenuePerDelivery)} recognized revenue per delivery.`,
    `That collapses to ${Math.round(annualDeliveries).toLocaleString('en-AE')} recognized deliveries at ${formatPreciseUnitAed(recognizedRevenuePerDelivery)} recognized revenue per delivery, or ${formatCompactAed(annualRevenue)} of annual recognized revenue.`,
  ]);
}

export function buildPilotThroughputAnchorSentence(businessCase: BusinessCaseData): string {
  const computedFinancialModel = asRecord(businessCase.computedFinancialModel);
  const driverModel = asRecord(computedFinancialModel?.driverModel);
  const demandDrivers = asRecord(driverModel?.demandDrivers);
  const { activeStage } = getStageScopedContext(businessCase, 'pilot');
  const dailyDeliveries = asFiniteNumber(activeStage?.dailyDeliveriesPerDrone);
  const annualDeliveries = asFiniteNumber(activeStage?.annualDeliveries);
  const fleetSize = asFiniteNumber(activeStage?.fleetSize);
  const fleetAvailability = normalizeRatio(demandDrivers?.fleetAvailability);
  const weatherAvailability = normalizeRatio(demandDrivers?.weatherRegulationFactor);

  if (dailyDeliveries == null || annualDeliveries == null || fleetSize == null || fleetSize <= 0) {
    return '';
  }

  const operatingDays = annualDeliveries / Math.max(1, fleetSize * dailyDeliveries);
  const illustrativeCycleMinutes = Math.round((12 * 60) / Math.max(1, dailyDeliveries));
  const conservativeThroughput = Math.max(1, Math.round(dailyDeliveries * 0.75));
  const stretchThroughput = Math.max(conservativeThroughput + 1, Math.round(dailyDeliveries * 1.15));

  return joinNarrativeParts([
    `${Math.round(dailyDeliveries)} deliveries/day per drone is the current base-case throughput assumption, resting on roughly ${Math.round(operatingDays)} pilot operating days${fleetAvailability != null ? `, ${Math.round(fleetAvailability * 100)}% fleet availability` : ''}${weatherAvailability != null ? `, and ${Math.round(weatherAvailability * 100)}% weather-adjusted availability` : ''}.`,
    `Executives should read ${conservativeThroughput}/day as a conservative validation floor, ${Math.round(dailyDeliveries)}/day as the modeled base case, and ${stretchThroughput}/day as stretch performance; anything materially below the base case compresses revenue and increases fixed-cost absorption.`,
    `If operated across a 12-hour dispatch day, that equates to roughly one completed drop every ${illustrativeCycleMinutes} minutes; that cadence is an operating hypothesis to prove during the pilot rather than a proven steady-state fact.`,
  ]);
}

export function buildPilotKillSwitchActionsSentence(): string {
  return 'Enforced pilot actions: if cost per delivery stays above AED 45 for 2 consecutive months, PAUSE the pilot; if delivery success rate drops below 90%, STOP operations; if contracted demand remains below 50%, NO EXPANSION is authorized.';
}

export function quantifyPilotRiskImpact(risk: Risk, businessCase: BusinessCaseData): string | Record<string, unknown> | undefined {
  const existingImpact = typeof risk.impact === 'string' ? risk.impact.trim() : risk.impact;
  if (typeof existingImpact === 'string' && /aed|month|week|year|%|percent|delay|exposure/i.test(existingImpact)) {
    return existingImpact;
  }

  const { activeStage } = getStageScopedContext(businessCase, 'pilot');
  const annualFixedCost = asFiniteNumber(activeStage?.annualFixedCost);
  const monthlyFixedExposure = annualFixedCost != null ? annualFixedCost / 12 : null;
  const riskText = [risk.name, risk.description, risk.mitigation].filter(Boolean).join(' ').toLowerCase();

  if (/regulator|regulatory|gcaa|approval|corridor|permit/.test(riskText) && monthlyFixedExposure != null) {
    return `2-4 month launch delay and ${formatCompactAed(monthlyFixedExposure * 2)}-${formatCompactAed(monthlyFixedExposure * 4)} fixed-cost exposure.`;
  }

  if (/contract|demand|customer|volume|loi/.test(riskText)) {
    return 'If contracted demand remains below 50%, expansion is blocked and revenue coverage deteriorates materially.';
  }

  if (/success|safety|incident|reliability|sla/.test(riskText)) {
    return 'If service success falls below 90%, operations stop until the safety and reliability issue is corrected.';
  }

  if (/cost|unit cost|opex|economics|delivery cost/.test(riskText)) {
    return 'If cost per delivery stays above AED 45 for 2 consecutive months, the pilot pauses and the operating model is reworked.';
  }

  return existingImpact;
}

export function getPilotKillSwitchThresholds(businessCase: BusinessCaseData): Array<Record<string, unknown>> {
  const computedFinancialModel = asRecord(businessCase.computedFinancialModel);
  const killSwitchMetrics = asRecord(computedFinancialModel?.killSwitchMetrics);
  const thresholds = Array.isArray(killSwitchMetrics?.thresholds)
    ? killSwitchMetrics.thresholds
    : [];

  return thresholds.filter((threshold): threshold is Record<string, unknown> => Boolean(asRecord(threshold)));
}

export function buildPilotGateKeyFindings(businessCase: BusinessCaseData): string[] {
  const { activeStage, activeFinancialView } = getStageScopedContext(businessCase, 'pilot');
  const { lifecycleCost, lifecycleBenefit, roiPercent, npvValue } = resolveStageFinancialMetrics(activeFinancialView);
  const thresholdSummaries = getPilotKillSwitchThresholds(businessCase);
  const exitCriteria = thresholdSummaries
    .slice(0, 3)
    .map((threshold) => `${asString(threshold.metric) || 'Pilot metric'} target ${asString(threshold.target) || 'defined'}; current ${asString(threshold.current) || 'pending'}.`)
    .join(' ');
  const killSwitchCriteria = thresholdSummaries
    .filter((threshold) => threshold.critical === true)
    .slice(0, 3)
    .map((threshold) => `${asString(threshold.metric) || 'Critical metric'} breaches ${asString(threshold.target) || 'its threshold'}${threshold.met === false ? ` and is currently ${asString(threshold.current) || 'off track'}` : ''}.`)
    .join(' ');

  return [
    'Minimum pilot approval conditions: confirm the GCAA approval path, secure the launch corridor and safety case, baseline the dispatch and telemetry integration design, evidence named pilot customers or contracted demand, cap funding at the approved pilot envelope, and prohibit scale-expansion spend before the exit gate.',
    buildPilotEvidencePurchaseSentence(),
    lifecycleCost != null || lifecycleBenefit != null || roiPercent != null || npvValue != null
      ? `Pilot economics remain a controlled learning investment rather than a commercial case: ${formatCompactAed(lifecycleCost)} of pilot cost against ${formatCompactAed(lifecycleBenefit)} of pilot benefit, ${roiPercent != null ? `${Math.round(roiPercent)}% ROI` : 'ROI pending'}, and ${npvValue != null ? `${formatCompactAed(npvValue)} NPV` : 'NPV pending'}.`
      : 'Pilot economics should be judged as a capped learning investment with explicit evidence targets, not as proof of immediate commercial attractiveness.',
    buildPilotRevenueBenefitReconciliationSentence(activeStage, activeFinancialView),
    buildPilotRevenueBridgeSentence(activeStage, activeFinancialView),
    buildPilotAssumptionCredibilitySentence(activeStage),
    buildPilotCostRealismSentence(),
    buildPilotStrategicAdvantageSentence(asString(businessCase.projectTitle) || 'This program'),
    buildPilotThroughputAnchorSentence(businessCase),
    buildPilotFragilitySentence(businessCase),
    exitCriteria
      ? `Pilot exit criteria: ${exitCriteria}`
      : 'Pilot exit criteria: prove service reliability, regulator readiness, cost per completed delivery, contracted-demand conversion, and weather-adjusted operating throughput before any scale decision.',
    killSwitchCriteria
      ? `Kill-switch conditions: ${killSwitchCriteria} ${buildPilotKillSwitchActionsSentence()}`
      : 'Kill-switch conditions: stop or re-scope the pilot if approvals slip materially, safety incidents breach tolerance, cost per delivery remains outside tolerance, contracted demand does not convert, or dispatch reliability cannot be proven inside the pilot window.',
    buildPilotUnitEconomicsSentence(activeStage, activeFinancialView),
  ].filter(Boolean);
}

export function filterStageCollection<T>(
  items: T[] | undefined,
  view: BusinessCaseViewMode,
  keywords: string[],
  getSearchText: (item: T) => string,
  fallbackCount: number,
): T[] | undefined {
  if (!items || items.length === 0 || view === 'full') {
    return items;
  }

  const matchedItems = items.filter((item) => countKeywordHits(getSearchText(item), keywords) > 0);
  if (matchedItems.length > 0) {
    return matchedItems;
  }

  return items.slice(0, Math.min(fallbackCount, items.length));
}

export function filterStageRisks(risks: Risk[] | undefined, view: BusinessCaseViewMode, businessCase?: BusinessCaseData): Risk[] | undefined {
  if (!risks || risks.length === 0 || view === 'full') {
    return risks;
  }

  const filteredRisks = risks.filter((risk) => {
    const riskText = [risk.name, risk.description, risk.mitigation].filter(Boolean).join(' ').toLowerCase();
    return !riskText.includes('no payback')
      && !riskText.includes('full commercial')
      && !riskText.includes('scale-out')
      && !riskText.includes('network expansion')
      && !riskText.includes('current model indicates roi');
  });

  const scopedRisks = filteredRisks.length > 0 ? filteredRisks : risks;

  if (view !== 'pilot' || !businessCase) {
    return scopedRisks;
  }

  return scopedRisks.map((risk) => ({
    ...risk,
    impact: quantifyPilotRiskImpact(risk, businessCase),
  }));
}

export function filterImplementationPhases(phases: ImplementationPhase[] | undefined, view: BusinessCaseViewMode): ImplementationPhase[] | undefined {
  return filterStageCollection(
    phases,
    view,
    PILOT_SCOPE_KEYWORDS,
    (phase) => [phase.name, phase.description, ...(phase.tasks ?? []), ...(phase.deliverables ?? [])].filter(Boolean).join(' '),
    2,
  );
}

export function filterMilestones(milestones: Milestone[] | undefined, view: BusinessCaseViewMode): Milestone[] | undefined {
  return filterStageCollection(
    milestones,
    view,
    PILOT_SCOPE_KEYWORDS,
    (milestone) => [milestone.name, milestone.owner, milestone.status, ...(milestone.deliverables ?? [])].filter(Boolean).join(' '),
    4,
  );
}

export function buildScopedBusinessRequirements(businessCase: BusinessCaseData, view: BusinessCaseViewMode): string {
  const baseRequirements = asString(businessCase.businessRequirements);
  if (!baseRequirements) {
    return view === 'pilot'
      ? 'Pilot requirements prioritize corridor approval, partner readiness, dispatch integration, telemetry capture, and governed launch controls before expansion is considered.'
      : 'Commercial requirements prioritize scaled hub operations, network control, service management, contracted demand governance, and sustained unit economics.';
  }

  const scopedSentences = pickScopedSentences(baseRequirements, view, 3);
  return joinNarrativeParts(scopedSentences.length > 0 ? scopedSentences : [baseRequirements]);
}

export function buildScopedAlternativeSolutions(
  alternatives: BusinessCaseData['alternativeSolutions'],
  view: BusinessCaseViewMode,
): BusinessCaseData['alternativeSolutions'] {
  if (!Array.isArray(alternatives) || alternatives.length === 0 || view === 'full') {
    return alternatives;
  }

  const filteredAlternatives = filterStageCollection(
    alternatives,
    view,
    PILOT_SCOPE_KEYWORDS,
    (alternative) => {
      if (typeof alternative === 'string') {
        return alternative;
      }

      return [
        alternative.name,
        alternative.description,
        ...(alternative.pros ?? []),
        ...(alternative.cons ?? []),
        ...(alternative.risks ?? []),
        alternative.cost,
      ].filter(Boolean).join(' ');
    },
    2,
  );

  return filteredAlternatives ?? alternatives;
}

export function buildScopedStrategicObjectives(objectives: string[] | undefined, view: BusinessCaseViewMode): string[] | undefined {
  if (!Array.isArray(objectives) || objectives.length === 0) {
    return objectives;
  }

  return pickStageSpecificList(objectives, view, objectives.slice(0, Math.min(4, objectives.length)));
}

export function buildScopedDepartmentImpact(
  impact: BusinessCaseData['departmentImpact'],
  view: BusinessCaseViewMode,
): BusinessCaseData['departmentImpact'] {
  if (!impact) {
    return impact;
  }

  return {
    positive: pickStageSpecificList(impact.positive, view, impact.positive ?? []),
    negative: pickStageSpecificList(impact.negative, view, impact.negative ?? []),
    mitigation: pickStageSpecificList(impact.mitigation, view, impact.mitigation ?? []),
  };
}

export function buildScopedComplianceRequirements(requirements: string[] | undefined, view: BusinessCaseViewMode): string[] | undefined {
  if (!Array.isArray(requirements) || requirements.length === 0) {
    return requirements;
  }

  return pickStageSpecificList(requirements, view, requirements.slice(0, Math.min(5, requirements.length)));
}

export function buildScopedPolicyReferences(references: string[] | undefined, view: BusinessCaseViewMode): string[] | undefined {
  if (!Array.isArray(references) || references.length === 0) {
    return references;
  }

  return pickStageSpecificList(references, view, references.slice(0, Math.min(5, references.length)));
}

export function buildScopedKpis(kpis: BusinessCaseData['kpis'], view: BusinessCaseViewMode): BusinessCaseData['kpis'] {
  if (!Array.isArray(kpis) || kpis.length === 0 || view === 'full') {
    return kpis;
  }

  if (kpis.every((kpi): kpi is string => typeof kpi === 'string')) {
    return pickStageSpecificList(kpis, view, kpis.slice(0, Math.min(4, kpis.length))).map((kpi) => rewriteDroneStageText(kpi, view));
  }

  const objectKpis = kpis.filter((kpi): kpi is KpiItem => typeof kpi === 'object' && kpi !== null);

  const filteredKpis = filterStageCollection(
    objectKpis,
    view,
    PILOT_SCOPE_KEYWORDS,
    (kpi) => [kpi.name, kpi.description, kpi.baseline, kpi.target].filter(Boolean).join(' '),
    3,
  );

  return (filteredKpis ?? objectKpis).map((kpi) => ({
    ...kpi,
    name: rewriteDroneStageText(kpi.name, view),
    description: rewriteDroneStageText(kpi.description, view),
    baseline: rewriteDroneStageText(kpi.baseline, view),
    target: rewriteDroneStageText(kpi.target, view),
  }));
}

export function buildScopedSuccessCriteria(
  criteria: BusinessCaseData['successCriteria'],
  view: BusinessCaseViewMode,
): BusinessCaseData['successCriteria'] {
  if (!Array.isArray(criteria) || criteria.length === 0 || view === 'full') {
    return criteria;
  }

  if (criteria.every((criterion): criterion is string => typeof criterion === 'string')) {
    return pickStageSpecificList(criteria, view, criteria.slice(0, Math.min(4, criteria.length))).map((criterion) => rewriteDroneStageText(criterion, view));
  }

  const objectCriteria = criteria.filter((criterion): criterion is SuccessCriterion => typeof criterion === 'object' && criterion !== null);

  const filteredCriteria = filterStageCollection(
    objectCriteria,
    view,
    PILOT_SCOPE_KEYWORDS,
    (criterion) => [criterion.criterion, criterion.target].filter(Boolean).join(' '),
    3,
  );

  return (filteredCriteria ?? objectCriteria).map((criterion) => ({
    ...criterion,
    criterion: rewriteDroneStageText(criterion.criterion, view),
    target: rewriteDroneStageText(criterion.target, view),
  }));
}

export function buildScopedStakeholderAnalysis(
  stakeholderAnalysis: BusinessCaseData['stakeholderAnalysis'],
  view: BusinessCaseViewMode,
): BusinessCaseData['stakeholderAnalysis'] {
  if (!stakeholderAnalysis || view === 'full') {
    return stakeholderAnalysis;
  }

  const stakeholders = filterStageCollection(
    stakeholderAnalysis.stakeholders,
    view,
    PILOT_SCOPE_KEYWORDS,
    (stakeholder) => [
      stakeholder.name,
      stakeholder.role,
      stakeholder.department,
      stakeholder.engagementStrategy,
    ].filter(Boolean).join(' '),
    4,
  );

  const analysis = asString(stakeholderAnalysis.analysis);

  return {
    ...stakeholderAnalysis,
    stakeholders: stakeholders ?? stakeholderAnalysis.stakeholders,
    analysis: analysis ? joinNarrativeParts(pickScopedSentences(analysis, view, 2)) : stakeholderAnalysis.analysis,
  };
}

export function buildScopedAssumptions(assumptions: Assumption[] | undefined, view: BusinessCaseViewMode): Assumption[] | undefined {
  if (!assumptions || assumptions.length === 0 || view === 'full') {
    return assumptions;
  }

  const filteredAssumptions = filterStageCollection(
    assumptions,
    view,
    PILOT_SCOPE_KEYWORDS,
    (assumption) => [assumption.name, assumption.description, assumption.impact, assumption.owner].filter(Boolean).join(' '),
    4,
  );
  const hasPilotSpecificAssumptions = assumptions.some((assumption) => countKeywordHits(
    [assumption.name, assumption.description, assumption.impact, assumption.owner].filter(Boolean).join(' '),
    PILOT_SCOPE_KEYWORDS,
  ) > 0);

  const matchesLegacyPilotDefaults = assumptions.length <= 4 && assumptions.every((assumption) => {
    const name = assumption.name?.trim();
    return name === 'Pilot demand remains bounded to the approved launch corridor and contracted early-adopter volume.'
      || name === 'Safety approvals, corridor permissions, and operating controls must be validated before expansion is authorized.'
      || name === 'Partner mobilization, dispatch integration, and telemetry evidence can be completed inside the pilot window.'
      || name === 'Unit economics must trend toward the scale gate before any full commercial commitment is approved.';
  });

  if (hasPilotSpecificAssumptions && !matchesLegacyPilotDefaults) {
    return filteredAssumptions;
  }

  return [
    {
      name: 'Pilot demand remains bounded to approved launch corridors, a limited set of service windows, and contracted early-adopter volume rather than assuming network-wide demand capture.',
      impact: 'High',
    },
    {
      name: 'Pilot throughput assumes a constrained operating calendar and a progressive ramp in utilization while safety approvals, corridor permissions, and dispatch controls are being proven.',
      impact: 'High',
    },
    {
      name: 'Recognized pilot revenue is limited to completed contracted deliveries and partial integration monetization; the 65% contracted-volume figure is an assumed validation target to be tested during the pilot, not booked network demand.',
      impact: 'High',
    },
    {
      name: 'Partner mobilization, dispatch integration, telemetry evidence, and incident-response readiness can be completed inside the pilot window without assuming steady-state automation.',
      impact: 'Medium',
    },
    {
      name: 'Pilot economics carry higher fixed-cost absorption and should be judged on glide-path credibility toward the scale gate, not on immediate commercial-level ROI.',
      impact: 'High',
    },
    {
      name: 'Expansion is justified only after pilot evidence shows repeatable service reliability, acceptable cost per delivery, and sufficient contracted demand to support corridor scale-out.',
      impact: 'High',
    },
  ];
}

export function buildScopedDependencies(dependencies: Dependency[] | undefined, view: BusinessCaseViewMode): Dependency[] | undefined {
  if (!dependencies || dependencies.length === 0 || view === 'full') {
    return dependencies;
  }

  const filteredDependencies = filterStageCollection(
    dependencies,
    view,
    PILOT_SCOPE_KEYWORDS,
    (dependency) => [dependency.name, dependency.description, dependency.impact, dependency.owner].filter(Boolean).join(' '),
    4,
  );
  const hasPilotSpecificDependencies = dependencies.some((dependency) => countKeywordHits(
    [dependency.name, dependency.description, dependency.impact, dependency.owner].filter(Boolean).join(' '),
    PILOT_SCOPE_KEYWORDS,
  ) > 0);

  if (hasPilotSpecificDependencies) {
    return filteredDependencies;
  }

  return [
    {
      name: 'GCAA and municipal pilot approvals',
      owner: 'Regulatory',
    },
    {
      name: 'Dispatch integration and telemetry evidence capture',
      owner: 'Technology',
    },
    {
      name: 'Pilot operator mobilization and training readiness',
      owner: 'Operations',
    },
    {
      name: 'Governance sign-off for the expansion gate decision',
      owner: 'PMO',
    },
  ];
}

export function buildScopedExecutiveSummary(businessCase: BusinessCaseData, view: BusinessCaseViewMode, metricsOverride?: StageFinancialMetricsOverride): string {
  const { projectTitle, activeStage, activeFinancialView } = getStageScopedContext(businessCase, view);
  const stageObjective = asString(activeStage?.objective);
  const stageHorizon = asString(activeStage?.horizon);
  const { lifecycleCost, lifecycleBenefit, roiPercent: resolvedRoiPercent, npvValue: resolvedNpvValue, paybackMonths: resolvedPaybackMonths } = resolveStageFinancialMetrics(activeFinancialView);
  const roiPercent = metricsOverride?.roiPercent ?? resolvedRoiPercent;
  const npvValue = metricsOverride?.npvValue ?? resolvedNpvValue;
  const paybackMonths = metricsOverride?.paybackMonths ?? resolvedPaybackMonths;
  const includePayback = shouldDisplayPayback(view, paybackMonths, roiPercent, npvValue);
  const topRisks = filterStageRisks(businessCase.identifiedRisks, view, businessCase) ?? [];
  const riskHeadline = buildSentenceList(topRisks.slice(0, 2).map((risk) => risk.name), 2);
  const riskSentence = riskHeadline
    ? (view === 'pilot'
      ? `Current pilot gating risks center on ${riskHeadline}.`
      : `Scale-up readiness still depends on closing ${riskHeadline}.`)
    : '';

  const stageLead = view === 'pilot'
    ? `${projectTitle} is being assessed as a pilot business case focused on ${stageObjective || 'validating corridor readiness, service demand, and operating economics'}${stageHorizon ? ` across ${stageHorizon}` : ' across the pilot window'}.`
    : `${projectTitle} is being assessed as a full commercial business case focused on ${stageObjective || 'scaling into the target operating model with sustained unit economics'}${stageHorizon ? ` across ${stageHorizon}` : ' across the full rollout horizon'}.`;

  const financeLead = lifecycleCost != null || lifecycleBenefit != null || roiPercent != null || npvValue != null || paybackMonths != null
    ? `${view === 'pilot' ? 'Pilot' : 'Full commercial'} economics currently model ${formatCompactAed(lifecycleCost)} of cost against ${formatCompactAed(lifecycleBenefit)} of benefit${roiPercent != null ? `, ${Math.round(roiPercent)}% ROI` : ''}${npvValue != null ? `, ${formatCompactAed(npvValue)} NPV` : ''}${includePayback ? `, and ${Math.max(1, Math.round(paybackMonths!))} month payback` : ''}.`
    : '';

  const decisionLead = view === 'pilot'
    ? 'The decision at this stage is whether to authorize a controlled validation pilot, lock the corridor and safety controls, and measure whether the operating model justifies expansion.'
    : 'The decision at this stage is whether the validated pilot can be scaled into a durable commercial network with acceptable unit economics and operating controls.';

  const pilotLearningLead = view === 'pilot'
    ? 'This stage should be judged as a controlled validation investment that buys learning, demand evidence, and strategic option value rather than as an immediately profitable commercial rollout.'
    : '';
  const pilotEvidencePurchaseLead = view === 'pilot'
    ? buildPilotEvidencePurchaseSentence()
    : '';
  const pilotStrategicLead = view === 'pilot'
    ? buildPilotStrategicAdvantageSentence(projectTitle)
    : '';

  const pilotRevenueBridgeLead = view === 'pilot'
    ? buildPilotRevenueBridgeSentence(activeStage, metricsOverride)
    : '';

  const pilotRevenueBenefitReconciliationLead = view === 'pilot'
    ? buildPilotRevenueBenefitReconciliationSentence(activeStage, activeFinancialView, metricsOverride)
    : '';

  const pilotThroughputLead = view === 'pilot'
    ? buildPilotThroughputAnchorSentence(businessCase)
    : '';

  const pilotUnitEconomicsLead = view === 'pilot'
    ? buildPilotUnitEconomicsSentence(activeStage, metricsOverride)
    : '';

  return joinNarrativeParts([stageLead, decisionLead, pilotLearningLead, pilotEvidencePurchaseLead, pilotStrategicLead, pilotRevenueBenefitReconciliationLead, pilotRevenueBridgeLead, pilotThroughputLead, financeLead, pilotUnitEconomicsLead, riskSentence]);
}

export function buildScopedBackgroundContext(businessCase: BusinessCaseData, view: BusinessCaseViewMode): string {
  const { projectTitle, activeStage } = getStageScopedContext(businessCase, view);
  const stageObjective = asString(activeStage?.objective);
  const stageHorizon = asString(activeStage?.horizon);
  const partneringStrategy = asString(activeStage?.partneringStrategy);
  const gatedNarrative = asString(activeStage?.gateSummary);
  const selectedBaseSentences = pickScopedSentences(asString(businessCase.backgroundContext), view, 2).join(' ');

  const scopeLead = view === 'pilot'
    ? `${projectTitle} is currently positioned as a pilot mobilization effort aimed at ${stageObjective || 'proving service demand, safety, and corridor readiness'}${stageHorizon ? ` over ${stageHorizon}` : ''}.`
    : `${projectTitle} is currently positioned as a full commercial rollout aimed at ${stageObjective || 'scaling the validated operating model into sustained service delivery'}${stageHorizon ? ` over ${stageHorizon}` : ''}.`;
  const operatingLead = partneringStrategy
    ? `${view === 'pilot' ? 'The pilot operating model' : 'The commercial operating model'} assumes ${partneringStrategy}.`
    : '';

  return joinNarrativeParts([scopeLead, operatingLead, gatedNarrative, selectedBaseSentences]);
}

export function buildScopedProblemStatement(businessCase: BusinessCaseData, view: BusinessCaseViewMode): string {
  const { projectTitle, activeStage } = getStageScopedContext(businessCase, view);
  const stageObjective = asString(activeStage?.objective);
  const horizon = asString(activeStage?.horizon);
  const baseSentences = pickScopedSentences(asString(businessCase.problemStatement), view, 2).join(' ');

  return view === 'pilot'
    ? joinNarrativeParts([
        `${projectTitle} needs a pilot-stage decision because leadership still needs proof that ${stageObjective || 'the service can operate safely, economically, and under controlled governance'}${horizon ? ` within ${horizon}` : ''}.`,
        'Without a bounded pilot, the program would move into scale commitments without validated corridor readiness, demand evidence, or exit-gate data.',
        baseSentences,
      ])
    : joinNarrativeParts([
        `${projectTitle} needs a full-commercial decision because the pilot evidence must now be translated into a durable operating model that can scale across the target network${horizon ? ` over ${horizon}` : ''}.`,
        'Without a staged rollout plan, the organization risks committing scale capital before throughput, partner capacity, and operating controls are durable at network level.',
        baseSentences,
      ]);
}

export function buildScopedSolutionOverview(businessCase: BusinessCaseData, view: BusinessCaseViewMode): string {
  const { projectTitle, activeStage } = getStageScopedContext(businessCase, view);
  const partneringStrategy = asString(activeStage?.partneringStrategy);
  const gateSummary = asString(activeStage?.gateSummary);
  const baseSentences = pickScopedSentences(asString(businessCase.solutionOverview), view, 2).join(' ');

  return view === 'pilot'
    ? joinNarrativeParts([
        `${projectTitle} should be delivered as a controlled pilot mobilization tranche with tightly bounded scope, operating evidence capture, and explicit expansion gates.`,
        partneringStrategy ? `Pilot operating approach: ${partneringStrategy}.` : '',
        gateSummary,
        baseSentences,
      ])
    : joinNarrativeParts([
        `${projectTitle} should be delivered as a phased commercial rollout with corridor-by-corridor expansion, platform hardening, and service-management controls.`,
        partneringStrategy ? `Commercial operating approach: ${partneringStrategy}.` : '',
        gateSummary,
        baseSentences,
      ]);
}

export function buildScopedSmartObjectives(businessCase: BusinessCaseData, view: BusinessCaseViewMode): SmartObjective[] | undefined {
  const objectives = normalizeObjectArray<SmartObjective>(businessCase.smartObjectives);
  const { activeStage } = getStageScopedContext(businessCase, view);
  const dailyDeliveries = asFiniteNumber(activeStage?.dailyDeliveriesPerDrone);
  const annualDeliveries = asFiniteNumber(activeStage?.annualDeliveries);
  const effectiveCostPerDelivery = asFiniteNumber(activeStage?.effectiveCostPerDelivery);
  const horizon = asString(activeStage?.horizon) || (view === 'pilot' ? 'pilot window' : 'commercial horizon');

  const defaults: SmartObjective[] = view === 'pilot'
    ? [{
        objective: 'Prove the pilot operating model under controlled governance gates.',
        specific: 'Launch the pilot corridor, validate safety controls, and establish the operating baseline.',
        measurable: `Sustain ${dailyDeliveries != null ? Math.round(dailyDeliveries) : 120} deliveries per drone per day and ${annualDeliveries != null ? Math.round(annualDeliveries).toLocaleString('en-AE') : 'at least one evidence-backed pilot demand run-rate'} during the pilot.`,
        achievable: 'Use partner-led operations, corridor approvals, and tightly scoped delivery zones to reduce early execution risk.',
        relevant: 'Builds the evidence needed for the expansion gate before any network-scale commitment.',
        timeBound: `Complete pilot proof points within the ${horizon}.`,
      }]
    : [{
        objective: 'Scale the service into a durable full commercial operating model.',
        specific: 'Expand from pilot proof points into a commercially governed network with repeatable operating controls.',
        measurable: `Hold cost per delivery at or below ${formatCompactAed(effectiveCostPerDelivery)} while sustaining network throughput and contracted demand.`,
        achievable: 'Sequence scale-up by corridor, partner readiness, and platform hardening rather than a single cutover.',
        relevant: 'Supports durable revenue growth and sustained operational governance after pilot approval.',
        timeBound: `Reach the target scale posture across the ${horizon}.`,
      }];

  if (objectives.length === 0) {
    return defaults;
  }

  return objectives.slice(0, Math.min(2, objectives.length)).map((objective, index) => ({
    ...objective,
    measurable: index === 0 ? defaults[0]!.measurable : objective.measurable,
    timeBound: index === 0 ? defaults[0]!.timeBound : objective.timeBound,
    relevant: index === 0 ? defaults[0]!.relevant : objective.relevant,
  }));
}

export function buildScopedScopeDefinition(businessCase: BusinessCaseData, view: BusinessCaseViewMode): ScopeDefinition | undefined {
  const baseScope = businessCase.scopeDefinition;
  const { activeStage } = getStageScopedContext(businessCase, view);
  const gateSummary = asString(activeStage?.gateSummary);

  const pilotDefaults: ScopeDefinition = {
    inScope: [
      'Pilot corridor approval, safety case, and operating governance controls.',
      'Pilot delivery operations, partner mobilization, and evidence capture for the expansion gate.',
      'Measurement of unit economics, throughput, and customer service proof points.',
    ],
    outOfScope: [
      'Citywide rollout before pilot gate approval.',
      'Network expansion beyond the approved pilot envelope.',
      'Enterprise hardening work that only becomes economic at scale.',
    ],
  };

  const fullDefaults: ScopeDefinition = {
    inScope: [
      'Commercial rollout sequencing across approved corridors and operating hubs.',
      'Scale economics, partner readiness, and platform hardening for full service operations.',
      'Commercial governance, demand ramp, and network-level service management.',
    ],
    outOfScope: [
      'Pilot-only constraints that were already retired by the expansion gate.',
      'Unapproved expansion beyond the validated commercial operating plan.',
    ],
  };

  const defaults = view === 'pilot' ? pilotDefaults : fullDefaults;

  const scopedInScope = pickStageSpecificList(baseScope?.inScope, view, defaults.inScope ?? []);
  const scopedOutOfScope = pickStageSpecificList(baseScope?.outOfScope, view, defaults.outOfScope ?? []);

  return {
    inScope: view === 'pilot' ? [...defaults.inScope!.slice(0, 2), ...scopedInScope.slice(0, 2)] : scopedInScope,
    outOfScope: view === 'pilot' ? [...scopedOutOfScope.slice(0, 1), ...defaults.outOfScope!.slice(0, 2)] : scopedOutOfScope,
    constraints: pickStageSpecificList(baseScope?.constraints, view, gateSummary ? [gateSummary] : []),
    assumptions: pickStageSpecificList(baseScope?.assumptions, view, baseScope?.assumptions ?? []),
    deliverables: pickStageSpecificList(baseScope?.deliverables, view, defaults.inScope ?? []),
  };
}

export function buildScopedImplementationPhases(businessCase: BusinessCaseData, view: BusinessCaseViewMode): ImplementationPhase[] {
  const existingPhases = filterImplementationPhases(businessCase.implementationPhases, view) ?? [];

  const pilotPhases: ImplementationPhase[] = [
    {
      name: 'Regulatory and corridor approval',
      description: 'Secure pilot corridor approval, safety case acceptance, and launch controls.',
      durationMonths: 2,
      tasks: ['Finalize pilot safety case', 'Approve launch corridor', 'Confirm governance and incident controls'],
    },
    {
      name: 'Partner mobilization and system readiness',
      description: 'Stand up partner-led operations, dispatch integration, and telemetry capture for the pilot.',
      durationMonths: 2,
      tasks: ['Mobilize pilot operator', 'Integrate dispatch and telemetry', 'Validate operating playbooks'],
    },
    {
      name: 'Controlled pilot operations',
      description: 'Run the pilot window and measure throughput, service quality, and cost per delivery.',
      durationMonths: 3,
      tasks: ['Launch pilot deliveries', 'Measure unit economics', 'Collect service reliability evidence'],
    },
    {
      name: 'Expansion gate decision',
      description: 'Assess whether the pilot satisfies the expansion gate for scale-up.',
      durationMonths: 1,
      tasks: ['Review pilot KPIs', 'Approve or stop expansion', 'Document scale decision'],
    },
  ];

  const fullPhases: ImplementationPhase[] = [
    {
      name: 'Commercial design finalization',
      description: 'Lock the scale operating model, partner structure, and release sequencing for commercial rollout.',
      durationMonths: 3,
      tasks: ['Finalize target operating model', 'Confirm partner and service roles', 'Approve rollout blueprint'],
    },
    {
      name: 'Hub and fleet scale-out',
      description: 'Expand hubs, fleet capacity, and corridor coverage in phased deployment waves.',
      durationMonths: 6,
      tasks: ['Stand up additional hubs', 'Expand fleet capacity', 'Sequence corridor activation'],
    },
    {
      name: 'Platform hardening and service management',
      description: 'Industrialize dispatch, monitoring, incident management, and compliance operations.',
      durationMonths: 6,
      tasks: ['Harden dispatch and monitoring', 'Operationalize service management', 'Scale compliance controls'],
    },
    {
      name: 'Network optimization and demand ramp',
      description: 'Optimize network economics, contracted demand, and service quality at commercial scale.',
      durationMonths: 9,
      tasks: ['Optimize route economics', 'Track contracted demand ramp', 'Tune network performance'],
    },
  ];

  if (existingPhases.length === 0) {
    return view === 'pilot' ? pilotPhases : fullPhases;
  }

  return (view === 'pilot' ? pilotPhases : fullPhases).map((defaultPhase, index) => ({
    ...defaultPhase,
    ...existingPhases[index],
    description: defaultPhase.description,
    tasks: defaultPhase.tasks,
  }));
}

export function buildScopedMilestones(businessCase: BusinessCaseData, view: BusinessCaseViewMode): Milestone[] {
  const existingMilestones = filterMilestones(businessCase.milestones, view) ?? [];
  const pilotMilestones: Milestone[] = [
    { name: 'Pilot corridor approved', date: '', status: 'pending' },
    { name: 'First governed pilot flight', date: '', status: 'pending' },
    { name: 'Pilot KPI review complete', date: '', status: 'pending' },
    { name: 'Expansion gate decision', date: '', status: 'pending' },
  ];
  const fullMilestones: Milestone[] = [
    { name: 'Commercial operating model approved', date: '', status: 'pending' },
    { name: 'First scale deployment wave live', date: '', status: 'pending' },
    { name: 'Service management hardening complete', date: '', status: 'pending' },
    { name: 'Network economics review', date: '', status: 'pending' },
  ];

  if (existingMilestones.length === 0) {
    return view === 'pilot' ? pilotMilestones : fullMilestones;
  }

  return (view === 'pilot' ? pilotMilestones : fullMilestones).map((defaultMilestone, index) => ({
    ...defaultMilestone,
    ...existingMilestones[index],
  }));
}

export function buildScopedConclusionSummary(businessCase: BusinessCaseData, view: BusinessCaseViewMode, metricsOverride?: StageFinancialMetricsOverride): string {
  const { activeStage, activeFinancialView } = getStageScopedContext(businessCase, view);
  const { roiPercent: resolvedRoiPercent, npvValue: resolvedNpvValue } = resolveStageFinancialMetrics(activeFinancialView);
  const roiPercent = metricsOverride?.roiPercent ?? resolvedRoiPercent;
  const npvValue = metricsOverride?.npvValue ?? resolvedNpvValue;
  const gateSummary = asString(activeStage?.gateSummary);

  return view === 'pilot'
    ? joinNarrativeParts([
        'Conclusion: approve the pilot only as a controlled validation investment, and advance beyond it only if the pilot exits with evidence that safety, throughput, contracted demand, and unit economics are moving inside the expansion gate.',
        buildPilotEvidencePurchaseSentence(),
        roiPercent != null || npvValue != null ? `Current pilot signal: ${roiPercent != null ? `${Math.round(roiPercent)}% ROI` : ''}${roiPercent != null && npvValue != null ? ' and ' : ''}${npvValue != null ? `${formatCompactAed(npvValue)} NPV` : ''}.` : '',
        buildPilotRevenueBenefitReconciliationSentence(activeStage, activeFinancialView, metricsOverride),
        buildPilotRevenueBridgeSentence(activeStage, metricsOverride),
        buildPilotThroughputAnchorSentence(businessCase),
        'Negative pilot ROI can be acceptable at this stage if it is explicitly funding learning, corridor proof, and hard evidence on safety, throughput, contracted demand, and controllable unit cost rather than pretending the pilot is already a commercial business.',
        buildPilotKillSwitchActionsSentence(),
        gateSummary,
      ])
    : joinNarrativeParts([
        'Conclusion: scale only if the validated pilot can sustain the target network economics, partner readiness, and operational control environment.',
        roiPercent != null || npvValue != null ? `Current commercial signal: ${roiPercent != null ? `${Math.round(roiPercent)}% ROI` : ''}${roiPercent != null && npvValue != null ? ' and ' : ''}${npvValue != null ? `${formatCompactAed(npvValue)} NPV` : ''}.` : '',
        gateSummary,
      ]);
}

export function buildScopedNextSteps(recommendations: Record<string, unknown> | undefined, view: BusinessCaseViewMode): Array<string | NextStep> | undefined {
  const existingSteps = Array.isArray(recommendations?.nextSteps) ? recommendations?.nextSteps as Array<string | NextStep> : [];
  if (view === 'full' && existingSteps.length > 0) {
    return existingSteps;
  }

  if (view === 'pilot' && existingSteps.length > 0) {
    const filteredSteps = existingSteps.filter((step) => {
      const text = typeof step === 'string'
        ? step
        : [step.step, step.text, step.description, step.action, step.timeline, step.owner].filter(Boolean).join(' ');
      return countKeywordHits(text, FULL_SCOPE_KEYWORDS) === 0;
    });

    if (filteredSteps.length > 0) {
      return filteredSteps;
    }
  }

  return view === 'pilot'
    ? [
        'Authorize the pilot envelope and lock the corridor, safety, and governance controls.',
        'Complete partner mobilization, operating readiness checks, and evidence instrumentation.',
        'Run the pilot until throughput, cost-per-delivery, and service reliability can be measured against the expansion gate.',
      ]
    : [
        'Finalize the commercial rollout sequence across approved hubs and corridors.',
        'Lock partner capacity, platform hardening, and service management controls for scale operations.',
        'Track network-level economics and operating KPIs against the full commercial business case each release cycle.',
      ];
}

export function buildScopedRecommendations(businessCase: BusinessCaseData, view: BusinessCaseViewMode) {
  const recommendations = asRecord(businessCase.recommendations);
  if (!recommendations) {
    return businessCase.recommendations;
  }

  const decisionPrefix = view === 'pilot'
    ? 'Approve only the pilot as a capped evidence-purchase experiment, and hold all expansion behind measurable exit criteria.'
    : 'Approve only the full commercial business case if pilot evidence and network economics support scale.';
  const roadmapValue = typeof recommendations.implementationRoadmap === 'string'
    ? recommendations.implementationRoadmap
    : asRecord(recommendations.implementationRoadmap);
  const roadmap = typeof roadmapValue === 'string' ? undefined : roadmapValue;
  const nextSteps = buildScopedNextSteps(recommendations, view);

  const roadmapObject = roadmap
    ? {
        ...roadmap,
        quickWins: Array.isArray(roadmap.quickWins) && view === 'pilot'
          ? (roadmap.quickWins as Array<Record<string, unknown>>).filter((item) => countKeywordHits(JSON.stringify(item), FULL_SCOPE_KEYWORDS) === 0)
          : roadmap.quickWins,
        strategicInitiatives: Array.isArray(roadmap.strategicInitiatives) && view === 'pilot'
          ? (roadmap.strategicInitiatives as Array<Record<string, unknown>>).filter((item) => countKeywordHits(JSON.stringify(item), FULL_SCOPE_KEYWORDS) === 0)
          : roadmap.strategicInitiatives,
      }
    : undefined;

  return {
    ...recommendations,
    primaryRecommendation: decisionPrefix,
    summary: joinNarrativeParts([
      decisionPrefix,
      view === 'pilot'
        ? 'Keep the recommendation bounded to pilot authorization, pilot controls, and the expansion gate. Do not present the pilot as near-term commercial approval, and keep any full commercial economics outside the main pilot narrative.'
        : 'Keep the recommendation bounded to corridor-by-corridor scale-up after pilot approval.',
      view === 'pilot' ? buildPilotEvidencePurchaseSentence() : '',
    ]),
    commercialCase: view === 'pilot'
      ? joinNarrativeParts([
          'The pilot case is justified only as a bounded validation tranche with capped downside, explicit evidence targets, and no claim that the pilot itself proves the full commercial case.',
          buildPilotEvidencePurchaseSentence(),
          'Full commercial economics should be treated as appendix material until the pilot exits cleanly and governance formally opens the expansion decision.',
          buildPilotRevenueBridgeSentence(getStageScopedContext(businessCase, 'pilot').activeStage, getStageScopedContext(businessCase, 'pilot').activeFinancialView),
          buildPilotUnitEconomicsSentence(getStageScopedContext(businessCase, 'pilot').activeStage, getStageScopedContext(businessCase, 'pilot').activeFinancialView),
        ])
      : 'The commercial case is justified only if the scale operating model keeps unit costs and throughput within the validated target range.',
    publicValueCase: view === 'pilot'
      ? joinNarrativeParts([
          'Strategic value comes from corridor proof, regulator confidence, delivery-demand evidence, operating data, and the option to scale later if the pilot exits cleanly. That public-value logic should not be used to hide weak pilot economics.',
          buildPilotStrategicAdvantageSentence(asString(businessCase.projectTitle) || 'This program'),
        ])
      : asString(recommendations.publicValueCase),
    implementationRoadmap: roadmapObject ?? roadmapValue,
    phasedApproach: view === 'pilot'
      ? 'Phase 1 is constrained to pilot deployment, pilot proof points, and the expansion decision gate.'
      : 'Phases beyond pilot are constrained to commercial rollout sequencing, hardening, and demand ramp management.',
    keyFindings: view === 'pilot'
      ? buildPilotGateKeyFindings(businessCase)
      : Array.isArray(recommendations.keyFindings)
        ? recommendations.keyFindings.filter((item): item is string => typeof item === 'string')
        : undefined,
    nextSteps,
  };
}

export function buildStageScopedBusinessCase(businessCase: BusinessCaseData, view: BusinessCaseViewMode): BusinessCaseData {
  const overrideAwareBusinessCase = applyScenarioOverride(businessCase, view);
  const implementationPhases = buildScopedImplementationPhases(overrideAwareBusinessCase, view);
  const milestones = buildScopedMilestones(overrideAwareBusinessCase, view);
  const { activeStage } = getStageScopedContext(overrideAwareBusinessCase, view);
  const hasOverrideValue = (field: string) => hasScenarioOverrideField(businessCase, view, field);
  const scopedDependencies = buildScopedDependencies(
    overrideAwareBusinessCase.projectDependencies?.dependencies ?? overrideAwareBusinessCase.dependencies,
    view,
  );
  const scopedImplementationTimeline = {
    ...(asRecord(overrideAwareBusinessCase.implementationTimeline) ?? {}),
    phases: implementationPhases,
    milestones,
    duration: asString(activeStage?.horizon)
      || (view === 'pilot'
        ? `${implementationPhases.reduce((total, phase) => total + (phase.durationMonths ?? 0), 0)} months planned execution`
        : '18-36 months'),
  };
  const scenarioProjectDependencies = hasOverrideValue('projectDependencies') || hasOverrideValue('dependencies')
    ? {
        ...(overrideAwareBusinessCase.projectDependencies ?? {}),
        dependencies: normalizeObjectArray<Dependency>(
          overrideAwareBusinessCase.projectDependencies?.dependencies ?? overrideAwareBusinessCase.dependencies,
        ),
      }
    : overrideAwareBusinessCase.projectDependencies
      ? {
          ...overrideAwareBusinessCase.projectDependencies,
          dependencies: scopedDependencies,
        }
      : overrideAwareBusinessCase.projectDependencies;

  return {
    ...overrideAwareBusinessCase,
    executiveSummary: hasOverrideValue('executiveSummary')
      ? asString(overrideAwareBusinessCase.executiveSummary)
      : buildScopedExecutiveSummary(overrideAwareBusinessCase, view),
    backgroundContext: hasOverrideValue('backgroundContext')
      ? asString(overrideAwareBusinessCase.backgroundContext)
      : buildScopedBackgroundContext(overrideAwareBusinessCase, view),
    problemStatement: hasOverrideValue('problemStatement')
      ? asString(overrideAwareBusinessCase.problemStatement)
      : buildScopedProblemStatement(overrideAwareBusinessCase, view),
    smartObjectives: hasOverrideValue('smartObjectives')
      ? normalizeObjectArray<SmartObjective>(overrideAwareBusinessCase.smartObjectives)
      : buildScopedSmartObjectives(overrideAwareBusinessCase, view),
    scopeDefinition: hasOverrideValue('scopeDefinition')
      ? (overrideAwareBusinessCase.scopeDefinition as ScopeDefinition | undefined)
      : buildScopedScopeDefinition(overrideAwareBusinessCase, view),
    businessRequirements: hasOverrideValue('businessRequirements')
      ? asString(overrideAwareBusinessCase.businessRequirements)
      : buildScopedBusinessRequirements(overrideAwareBusinessCase, view),
    solutionOverview: hasOverrideValue('solutionOverview')
      ? asString(overrideAwareBusinessCase.solutionOverview)
      : buildScopedSolutionOverview(overrideAwareBusinessCase, view),
    alternativeSolutions: hasOverrideValue('alternativeSolutions')
      ? overrideAwareBusinessCase.alternativeSolutions
      : buildScopedAlternativeSolutions(overrideAwareBusinessCase.alternativeSolutions, view),
    identifiedRisks: hasOverrideValue('identifiedRisks')
      ? normalizeObjectArray<Risk>(overrideAwareBusinessCase.identifiedRisks)
      : filterStageRisks(overrideAwareBusinessCase.identifiedRisks, view, overrideAwareBusinessCase),
    implementationPhases: hasOverrideValue('implementationPhases') || hasOverrideValue('implementationTimeline')
      ? normalizeObjectArray<ImplementationPhase>(overrideAwareBusinessCase.implementationPhases)
      : implementationPhases,
    milestones: hasOverrideValue('milestones') || hasOverrideValue('implementationTimeline')
      ? normalizeObjectArray<Milestone>(overrideAwareBusinessCase.milestones)
      : milestones,
    strategicObjectives: hasOverrideValue('strategicObjectives')
      ? (overrideAwareBusinessCase.strategicObjectives as string[] | undefined)
      : buildScopedStrategicObjectives(overrideAwareBusinessCase.strategicObjectives, view),
    departmentImpact: hasOverrideValue('departmentImpact')
      ? overrideAwareBusinessCase.departmentImpact
      : buildScopedDepartmentImpact(overrideAwareBusinessCase.departmentImpact, view),
    complianceRequirements: hasOverrideValue('complianceRequirements')
      ? (overrideAwareBusinessCase.complianceRequirements as string[] | undefined)
      : buildScopedComplianceRequirements(overrideAwareBusinessCase.complianceRequirements, view),
    policyReferences: hasOverrideValue('policyReferences')
      ? (overrideAwareBusinessCase.policyReferences as string[] | undefined)
      : buildScopedPolicyReferences(overrideAwareBusinessCase.policyReferences, view),
    kpis: hasOverrideValue('kpis')
      ? overrideAwareBusinessCase.kpis
      : buildScopedKpis(overrideAwareBusinessCase.kpis, view),
    successCriteria: hasOverrideValue('successCriteria')
      ? overrideAwareBusinessCase.successCriteria
      : buildScopedSuccessCriteria(overrideAwareBusinessCase.successCriteria, view),
    stakeholderAnalysis: hasOverrideValue('stakeholderAnalysis')
      ? overrideAwareBusinessCase.stakeholderAnalysis
      : buildScopedStakeholderAnalysis(overrideAwareBusinessCase.stakeholderAnalysis, view),
    keyAssumptions: hasOverrideValue('keyAssumptions') || hasOverrideValue('assumptions')
      ? normalizeObjectArray<Assumption>(overrideAwareBusinessCase.keyAssumptions ?? overrideAwareBusinessCase.assumptions)
      : buildScopedAssumptions(overrideAwareBusinessCase.keyAssumptions, view),
    assumptions: hasOverrideValue('assumptions') || hasOverrideValue('keyAssumptions')
      ? normalizeObjectArray<Assumption>(overrideAwareBusinessCase.assumptions ?? overrideAwareBusinessCase.keyAssumptions)
      : buildScopedAssumptions(overrideAwareBusinessCase.assumptions, view),
    projectDependencies: scenarioProjectDependencies,
    dependencies: hasOverrideValue('dependencies') || hasOverrideValue('projectDependencies')
      ? normalizeObjectArray<Dependency>(overrideAwareBusinessCase.dependencies ?? overrideAwareBusinessCase.projectDependencies?.dependencies)
      : scopedDependencies,
    implementationTimeline: hasOverrideValue('implementationTimeline') || hasOverrideValue('implementationPhases') || hasOverrideValue('milestones')
      ? (overrideAwareBusinessCase.implementationTimeline as Record<string, unknown> | undefined)
      : scopedImplementationTimeline,
    recommendations: hasOverrideValue('recommendations')
      ? overrideAwareBusinessCase.recommendations
      : buildScopedRecommendations(overrideAwareBusinessCase, view),
    nextSteps: hasOverrideValue('nextSteps')
      ? overrideAwareBusinessCase.nextSteps
      : overrideAwareBusinessCase.nextSteps,
    conclusionSummary: hasOverrideValue('conclusionSummary')
      ? asString(overrideAwareBusinessCase.conclusionSummary)
      : buildScopedConclusionSummary(overrideAwareBusinessCase, view),
  };
}
