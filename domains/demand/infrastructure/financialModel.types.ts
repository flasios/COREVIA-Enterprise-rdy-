export interface FinancialInputs {
  totalInvestment: number;
  archetype: string;
  discountRate: number;
  adoptionRate: number;
  maintenancePercent: number;
  contingencyPercent: number;
  domainParameters: Record<string, number>;
}

export interface CostLineItem {
  id: string;
  category: string;
  subcategory: string;
  name: string;
  description: string;
  year0: number;
  year1: number;
  year2: number;
  year3: number;
  year4: number;
  year5: number;
  isRecurring: boolean;
  breakdown?: { name: string; annualValue: number; perDelivery?: number }[];
}

export interface BenefitLineItem {
  id: string;
  category: string;
  name: string;
  description: string;
  year1: number;
  year2: number;
  year3: number;
  year4: number;
  year5: number;
  realization: string;
  confidence: string;
}

export interface YearlyCashFlow {
  year: number;
  label: string;
  costs: number;
  benefits: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
  discountedCashFlow: number;
}

export interface ScenarioResult {
  name: string;
  label: string;
  npv: number;
  irr: number;
  roi: number;
  paybackMonths: number;
  probability: number;
}

export interface InvestmentDecision {
  verdict: 'STRONG_INVEST' | 'INVEST' | 'CONDITIONAL' | 'CAUTION' | 'DO_NOT_INVEST';
  label: string;
  summary: string;
  confidence: number;
  approvalScope?: 'FULL_SCALE' | 'PILOT_ONLY' | 'HALT';
  conditions?: string[];
  triggers?: string[];
  automaticHalt?: boolean;
  factors: {
    name: string;
    score: number;
    weight: number;
  }[];
}

export interface WeightedScoreFactor {
  name: string;
  score: number;
  weight: number;
}

export interface ScoredAssessment {
  score: number;
  rationale: string;
}

export interface GovernmentValueDecision {
  verdict: 'HIGH_VALUE' | 'RECOMMENDED' | 'MODERATE_VALUE' | 'LIMITED_VALUE' | 'LOW_VALUE';
  label: string;
  summary: string;
  score: number;
  factors: {
    name: string;
    description: string;
    score: number;
    weight: number;
    rationale: string;
  }[];
}

export interface FiveYearProjection {
  year: number;
  yearLabel: string;
  revenue: number;
  costs: number;
  netCashFlow: number;
  operatingMargin: number;
  yoyGrowth: number;
  cumulativeCashFlow: number;
  discountFactor: number;
}

export interface FinancialViewScenario {
  name: string;
  label: string;
  npv: number;
  probability: number;
}

export interface FinancialViewSnapshot {
  mode: 'pilot' | 'full';
  title: string;
  scopeLabel: string;
  upfrontInvestment: number;
  lifecycleCost: number;
  lifecycleBenefit: number;
  operatingRunCost: number;
  /** @deprecated Use `undiscountedNetBenefit` for committee-grade framing. Kept for UI compatibility. */
  netLifecycleValue: number;
  /**
   * Undiscounted Net Benefit = lifecycleBenefit − lifecycleCost. This is NOT present-value.
   * A positive undiscounted figure can coexist with a deeply negative NPV; always display
   * alongside NPV so a committee cannot read it as "the project makes money".
   */
  undiscountedNetBenefit: number;
  /** Warning text to render next to undiscountedNetBenefit when its sign disagrees with NPV. */
  npvDivergenceWarning?: string;
  lifecycleNarrative: string;
  costs: CostLineItem[];
  benefits: BenefitLineItem[];
  metrics: {
    npv: number;
    roi: number;
    irr: number;
    paybackMonths: number;
    paybackYears: number;
  };
  scenarios: FinancialViewScenario[];
  fiveYearProjections: {
    yearly: FiveYearProjection[];
    summary: {
      totalRevenue: number;
      totalCosts: number;
      avgOperatingMargin: number;
      avgEfficiencyRatio: number;
      cagr: number;
      totalPresentValue: number;
    };
  };
  verdict: {
    verdict: string;
    label: string;
    summary: string;
  };
}

export interface UnifiedFinancialOutput {
  inputs: FinancialInputs;
  archetype: string;
  costs: CostLineItem[];
  benefits: BenefitLineItem[];
  cashFlows: YearlyCashFlow[];
  metrics: {
    npv: number;
    irr: number;
    irrNote: string;
    roi: number;
    /**
     * Discounted (IRR-consistent) ROI. Aligns with NPV logic so a thin/negative NPV
     * cannot coexist with an inflated simple-return headline.
     */
    discountedRoi: number;
    paybackMonths: number;
    totalCosts: number;
    totalBenefits: number;
    netValue: number;
  };
  scenarios: ScenarioResult[];
  decision: InvestmentDecision;
  governmentValue: GovernmentValueDecision;
  fiveYearProjections: {
    yearly: FiveYearProjection[];
    summary: {
      totalRevenue: number;
      totalCosts: number;
      avgOperatingMargin: number;
      avgEfficiencyRatio: number;
      cagr: number;
      totalPresentValue: number;
    };
  };
  doNothingCost: number;
  breakEvenAnalysis: BreakEvenAnalysis;
  terminalValue: TerminalValueAnalysis;
  discountRateComparison: DiscountRateComparison[];
  governmentExternalities: GovernmentExternality[];
  investmentCommitteeSummary: InvestmentCommitteeSummary;
  driverModel?: DriverModelOutput;
  killSwitchMetrics?: KillSwitchMetrics;
  riskAdjustedAnalysis?: RiskAdjustedAnalysis;
  unitEconomics?: UnitEconomicsAnalysis;
  operationalConstraints?: OperationalConstraintAnalysis;
  scenarioIntelligence?: ScenarioIntelligence;
  commercialAudit?: CommercialAudit;
  benchmarkValidation?: BenchmarkValidation;
  capitalEfficiency?: CapitalEfficiencyLens;
  modelConfidence?: ModelConfidenceScore;
  economicProof?: EconomicProofLayer;
  demandCertainty?: DemandCertaintyAssessment;
  pilotJustification?: PilotJustificationAssessment;
  executiveChallenge?: ExecutiveChallengeLayer;
  financialViews?: {
    pilot?: FinancialViewSnapshot;
    full?: FinancialViewSnapshot;
    defaultView: 'pilot' | 'full';
  };
  // Committee-grade analytics (see interface docs above)
  benefitMix?: BenefitMixBreakdown;
  capexSchedule?: CapexPhaseSchedule;
  doNothingBreakdown?: DoNothingCostBreakdown;
  breakEvenSensitivity?: BreakEvenSensitivity;
  avUnitEconomicsPerTrip?: AVUnitEconomicsPerTrip;
  avYearProgression?: AVYearProgression;
  avScenarioStress?: AVScenarioStress;
  commercialHurdleCheck?: CommercialHurdleCheck;
  cumulativeFundingRequirement?: CumulativeFundingRequirement;
  stagedCapitalPlan?: StagedCapitalPlan;
  commercialVsStrategicNpv?: CommercialVsStrategicNpv;
  fundingBlock?: FundingBlockSignal;
  boardRecommendation?: BoardRecommendation;
  pilotEconomicsView?: PilotEconomicsView;
  executiveCommitteeStatement?: ExecutiveCommitteeStatement;
  generatedAt: string;
}

export interface DriverModelOutput {
  demandDrivers: {
    fleetSize: number;
    maxCapacityPerDrone: number;
    fleetAvailability: number;
    demandUtilization: number;
    weatherRegulationFactor: number;
    effectiveDailyDeliveries: number;
    yearlyDeliveries: number[];
  };
  revenueDrivers: {
    weightedAverageFare: number;
    segments: { name: string; fare: number; share: number }[];
    contributionMarginPerDelivery: number;
    variableCostPerDelivery: number;
  };
  costDrivers: {
    variableCostBreakdown: { name: string; value: number }[];
    fixedCostBreakdown: { name: string; annualValue: number }[];
    totalVariableCostPerDelivery: number;
    totalFixedAnnual: number;
    effectiveCostPerDelivery: number[];
  };
  rampSchedule: { year: number; fleetActive: number; utilization: number; deliveries: number }[];
  margins: {
    ebitdaMargin: number[];
    netMargin: number[];
    contributionMargin: number;
  };
  stagedEconomics?: {
    pilotCase: DroneStageEconomics;
    scaleCase: DroneStageEconomics;
    narrative: string;
    scaleGateOpen: boolean;
    expansionDecision: 'GO' | 'STOP';
    enforcementSummary: string;
  };
}

export interface DroneStageEconomics {
  objective: string;
  horizon: string;
  fleetSize: number;
  dailyDeliveriesPerDrone: number;
  annualDeliveries: number;
  recognizedAnnualDeliveries: number;
  revenueRealizationFactor: number;
  weightedAverageFare: number;
  platformRevenuePerDelivery: number;
  preRealizationRevenuePerDelivery: number;
  nominalRevenuePerDelivery: number;
  recognizedRevenuePerDelivery: number;
  realizedRevenuePerDelivery: number;
  contractedVolumeShare: number;
  variableCostPerDelivery: number;
  fixedCostPerDelivery: number;
  effectiveCostPerDelivery: number;
  contributionMarginPerDelivery: number;
  annualRecognizedRevenue: number;
  annualRevenue: number;
  annualIntegrationRevenue: number;
  annualFixedCost: number;
  annualEbitda: number;
  partneringStrategy: string;
  automationRate: number;
  idleTimeReduction: number;
  gateSummary: string;
}

export interface KillSwitchMetrics {
  thresholds: { metric: string; target: string; current: string; met: boolean; critical: boolean }[];
  pilotGateStatus: 'PASS' | 'CONDITIONAL' | 'FAIL';
  summary: string;
}

export interface RiskAdjustedAnalysis {
  baseRate: number;
  baseNpv: number;
  riskAdjustedRate: number;
  riskAdjustedNpv: number;
  stressRate: number;
  stressNpv: number;
  summary: string;
}

export interface UnitEconomicsAnalysis {
  revenuePerDelivery: number;
  variableCostPerDelivery: number;
  fullyLoadedCostPerDelivery: number;
  contributionMarginPerDelivery: number;
  variableCostShareOfTotalCost: number;
  breakEvenDeliveriesPerDronePerDay: number;
  operationalDependencyFlag: boolean;
  scaleRiskFlag: boolean;
  minimumViableCheck: 'PASS' | 'CONDITIONAL' | 'FAIL';
  summary: string;
}

export interface OperationalConstraintAnalysis {
  theoreticalDeliveriesPerDronePerDay: number;
  realisticRangeLow: number;
  realisticRangeHigh: number;
  confidenceAdjustedDeliveriesPerDronePerDay: number;
  executionConfidence: number;
  constraintFactors: {
    name: string;
    impactPercent: number;
    rationale: string;
  }[];
  summary: string;
}

export interface ScenarioIntelligence {
  probabilityNegativeNpv: number;
  expectedNpv: number;
  downsideNpv: number;
  sensitivityRanking: {
    driver: string;
    currentValue: string;
    sensitivityIndex: number;
    rationale: string;
  }[];
  summary: string;
}

export interface CommercialAudit {
  verdict: 'GREEN' | 'AMBER' | 'RED';
  redFlags: string[];
  missingAssumptions: string[];
  optimismIndicators: string[];
  summary: string;
}

export interface BenchmarkValidation {
  checks: {
    metric: string;
    actual: string;
    benchmarkRange: string;
    status: 'VALID' | 'WATCH' | 'REQUIRES_JUSTIFICATION';
  }[];
  summary: string;
}

export interface CapitalEfficiencyLens {
  revenueToCapex: number;
  paybackThresholdMonths: number;
  capitalIntensity: number;
  costOfCapitalPercent: number;
  excessReturnPercent: number;
  classification: 'PRIVATE_CASE' | 'PILOT_ONLY' | 'PUBLIC_VALUE';
  summary: string;
}

export interface ModelConfidenceScore {
  score: number;
  level: 'High' | 'Medium' | 'Low';
  drivers: string[];
  summary: string;
}

export interface EconomicProofLayer {
  currentUnitCost: number;
  pilotExitTarget: number;
  scaleTarget: number;
  scaleConfidenceAdjustedThroughput: number;
  automationRateDelta: number;
  utilizationLiftRequired: number;
  evidenceVerdict: 'PROVEN' | 'PARTIAL' | 'UNPROVEN';
  blockers: string[];
  summary: string;
}

export interface DemandCertaintyAssessment {
  contractedRevenueShare: number;
  speculativeRevenueShare: number;
  minimumRequiredShare: number;
  namedAnchorEvidence: boolean;
  revenueConfidenceScore: number;
  level: 'High' | 'Medium' | 'Low';
  summary: string;
}

export interface PilotJustificationAssessment {
  hardestUnknown: string;
  pilotFocus: string;
  alignment: 'ALIGNED' | 'PARTIAL' | 'MISALIGNED';
  provenUnknowns: string[];
  unprovenUnknowns: string[];
  summary: string;
}

export interface ExecutiveChallengeLayer {
  mustBeTrue: string[];
  breakpoints: string[];
  missingEvidence: string[];
  summary: string;
}

export interface BreakEvenAnalysis {
  revenueMultiplierRequired: number;
  costReductionRequired: number;
  isAchievable: boolean;
  summary: string;
}

export interface TerminalValueAnalysis {
  residualAssetValue: number;
  methodology: string;
  adjustedNPV: number;
  adjustedROI: number;
}

export interface DiscountRateComparison {
  rate: number;
  label: string;
  npv: number;
  roi: number;
}

export interface GovernmentExternality {
  name: string;
  description: string;
  annualValue: number;
  fiveYearValue: number;
  methodology: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface InvestmentCommitteeSummary {
  expectedNPV: number;
  valueAtRisk: number;
  benefitToInvestmentRatio: number;
  marginalCostOverDoNothing: number;
  terminalValueAdjustedNPV: number;
  publicValueAdjustedNPV: number;
  keyDecisionFactors: string[];
  readinessGrade: string;
  gradingNotes: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Committee-grade analytics (address advisor critique on AV-class cases):
//  1. Cash vs strategic benefit split — strategic (non-cash) public-value benefits
//     must be surfaced separately from cash-generating contribution, not blended
//     into a single NPV.
//  2. Phase-gated CapEx schedule — capital deployment is staged by pilot/scale
//     gates, not front-loaded into year 0.
//  3. Adjusted cost-of-inaction — applies a competitor-leakage factor so
//     "do-nothing cost" is not equal to full project benefits.
//  4. Break-even sensitivity — the operating thresholds (trips/day, cost/km,
//     utilisation) the project *must* hit to clear NPV zero, not just a
//     revenue multiplier.
//  5. AV per-trip unit economics — explicit revenue/variable-cost/contribution
//     per trip plus break-even trips per vehicle per day.
// ───────────────────────────────────────────────────────────────────────────

export interface BenefitMixBreakdown {
  totalCashBenefits: number;
  totalStrategicBenefits: number;
  totalBenefits: number;
  strategicBenefitSharePct: number;
  cashCategories: { category: string; fiveYearValue: number }[];
  strategicCategories: { category: string; fiveYearValue: number }[];
  // Cash-only financials — the numbers a commercial committee should price against.
  // Strategic / public-value benefits are additive but should NOT inflate headline NPV/ROI.
  cashOnlyNpv: number;
  cashOnlyRoi: number;
  summary: string;
}

export interface CapexPhaseEntry {
  phase: string;
  year: number;
  amount: number;
  gateCondition: string;
  description: string;
  isGated: boolean;
}

export interface CapexPhaseSchedule {
  entries: CapexPhaseEntry[];
  totalCapex: number;
  year0SharePct: number;
  gatedSharePct: number;
  summary: string;
}

export interface DoNothingCostBreakdown {
  rawOpportunityCost: number;
  leakageFactor: number;
  leakageAssumption: string;
  adjustedOpportunityCost: number;
  /** Realistic revenue that would be captured by competitors if the organisation does nothing. */
  lostRevenueOpportunity: number;
  /** Strategic positioning / future-option loss — not directly monetisable; kept separate so it never inflates commercial NPV. */
  strategicPositioningLoss: number;
  /** Narrative separating lost-revenue cash from strategic positioning loss. */
  splitNarrative: string;
  summary: string;
}

export interface BreakEvenSensitivity {
  archetype: string;
  requiredTripsPerVehiclePerDay?: number;
  currentTripsPerVehiclePerDay?: number;
  tripsMarginOfSafetyPct?: number;
  requiredCostPerKmCeiling?: number;
  currentCostPerKm?: number;
  costPerKmMarginOfSafetyPct?: number;
  requiredUtilization?: number;
  currentUtilization?: number;
  isAchievable: boolean;
  summary: string;
}

export interface AVUnitEconomicsPerTrip {
  fareRatePerKm: number;
  tripDistanceKm: number;
  revenuePerTrip: number;
  // Variable cost per trip = operatingCostPerKm × tripDistance
  // (energy, maintenance, tyres, consumables, per-km insurance allocation)
  variableCostPerTrip: number;
  contributionMarginPerTrip: number;
  contributionMarginPct: number;
  // Overhead per trip = allocated share of recurring fixed operating costs
  // (safety-operator staffing, remote ops centre, compliance, software/OEM licensing,
  // platform connectivity, insurance fixed component) divided by annual trip volume.
  overheadPerTrip: number;
  fullyLoadedCostPerTrip: number;
  fullyLoadedMarginPerTrip: number;
  fullyLoadedMarginPct: number;
  fleetSize: number;
  currentDailyTripsPerVehicle: number;
  breakEvenTripsPerVehiclePerDay: number;
  marginOfSafetyPct: number;
  verdict: 'PASS' | 'CONDITIONAL' | 'FAIL';
  /**
   * Explicit reconciliation table: Avg Fare − Variable Cost = Contribution.
   * Lets the committee read the unit-economics math line-by-line without reverse-engineering.
   */
  reconciliationTable: { metric: string; valueAED: number; note?: string }[];
  /** Plain-English reconciliation string suitable for a memo. */
  contributionReconciliation: string;
  /** Utilization disclaimer — flags that target util is top-quartile mature-state and must be pilot-validated. */
  utilizationDisclaimer: string;
  summary: string;
}

export interface CommercialHurdleCheck {
  hurdleIrrPct: number;
  actualIrrPct: number;
  /** IRR gap in percentage points below the risk-class hurdle. 0 when meetsHurdle=true. */
  irrGapPpsBelowHurdle: number;
  meetsHurdle: boolean;
  npvToInvestmentPct: number;
  valueDestructionRisk: 'LOW' | 'MODERATE' | 'HIGH';
  stressBreakpointRatePct: number;
  summary: string;
}

/**
 * Cumulative funding requirement — what the treasury actually has to finance.
 * This is the maximum negative cumulative cash position across the lifecycle,
 * not the headline payback. Committee needs to see "you must fund X AED of losses
 * before this case turns cash positive" separate from the NPV/ROI view.
 */
export interface CumulativeFundingRequirement {
  peakFundingAED: number;
  peakFundingYear: number;
  yearsBeforeCashPositive: number;
  cumulativeByYear: { year: number; cumulativeCashAED: number }[];
  narrative: string;
}

/**
 * Staged capital plan — the committee-grade alternative to "approve all CapEx now".
 * Phase 1 is a capital-capped pilot; Phase 2 releases scale capital ONLY if measurable
 * gates are met; Phase 3 is full rollout. Every future case that fails the commercial
 * hurdle should render this structure so the default action becomes "fund the pilot,
 * hold the rest" instead of "approve headline CapEx".
 */
export interface StagedCapitalPhase {
  phase: 1 | 2 | 3;
  label: string;
  capitalShareOfTotalPct: number;
  capitalEnvelopeAED: number;
  durationMonths: number;
  purpose: string;
  exitGates: string[];
}

export interface StagedCapitalPlan {
  phases: StagedCapitalPhase[];
  totalCapitalAED: number;
  phase1CapAED: number;
  gatesToScale: string[];
  framing: string;
}

/**
 * Pilot-specific economics for AV. The headline engine defaults to full-scale
 * assumptions (500-vehicle fleet, 78% utilization). A committee cannot validate
 * a 50–100 vehicle pilot against those numbers — it would overstate efficiency
 * and understate cost/trip. This block re-runs unit economics at pilot-realistic
 * parameters so the committee sees the honest "pilot will lose money" picture
 * separately from the scale case.
 */
export interface PilotEconomicsView {
  pilotFleetSize: number;
  pilotUtilization: number;
  pilotDailyTripsPerVehicle: number;
  pilotRevenuePerTrip: number;
  pilotVariableCostPerTrip: number;
  pilotOverheadPerTrip: number;
  pilotFullyLoadedCostPerTrip: number;
  pilotFullyLoadedMarginPerTrip: number;
  pilotFullyLoadedMarginPct: number;
  pilotAnnualContributionAED: number;
  profitabilityExpectation: 'NOT_EXPECTED' | 'BREAK_EVEN_POSSIBLE' | 'EXPECTED';
  narrative: string;
}

/**
 * Executive committee statement — the five sharpened one-liners a CFO / board
 * member expects to read at the top of an IC memo for a sub-hurdle case:
 *   - Why the investment is being made at all (strategic, not financial)
 *   - The hard capital-release rule (cost/trip ≤ target before Phase 2)
 *   - Break-even reframed (pilot is validation, not recovery)
 *   - Return multiple as a caution signal (≈1x = non-commercial positioning)
 *   - Explicit pilot profitability expectation ("pilot is NOT expected to be profitable")
 */
export interface ExecutiveCommitteeStatement {
  /** #1: single line reconciling undiscounted net vs NPV so nobody reads +AED 5.4M as "the project makes money". */
  financialNarrativeOneLiner: string;
  strategicJustification: string;
  hardCapitalReleaseRule: string;
  breakEvenNarrativeReframe: string;
  returnMultipleSignal: string;
  pilotProfitabilityExpectation: string;
  /** #3: two explicit decisions — commercial vs strategic — the committee can read instantly. */
  commercialDecision: string;
  strategicDecision: string;
  /** #4: cumulative negative cash flow before breakeven. */
  burnStatement: string;
  /** #5: the three break-even levers stated explicitly with numeric thresholds. */
  breakEvenLevers: { trips: string; costPerKm: string; utilization: string; combined: string };
  /** #6: "assumes → viability requires" language flip. */
  conditionsReframe: string;
  /** #7: value-type separation one-liner. */
  valueTypeSeparation: string;
  /** #8: explicit CapEx phasing statement to prevent "approve all now" fear reaction. */
  capexPhasingStatement: string;
  /** #9: explicit failure/halt condition. */
  failureCondition: string;
  /** #10: the exact final decision framing the committee should read. */
  finalDecisionFraming: string;
  returnMultipleX: number;
}

/**
 * Commercial vs Strategic NPV split — committee should price commercial cash alone,
 * and evaluate strategic/public-value NPV as an *additive* decision input, never a
 * substitute. This structure makes the distinction unambiguous in the IC memo.
 *
 * FundingBlockSignal: kill-switch financial enforcement (defined below).
 */
export interface FundingBlockSignal {
  blocked: boolean;
  reasons: string[];
  narrative: string;
}

/**
 * Sharpened board recommendation — replaces soft "approve as stage-gated pilot" with
 * decisive language: what to reject, what to approve, what conditions release further capital.
 */
export interface BoardRecommendation {
  headline: string;
  rejectAction: string;
  approveAction: string;
  capitalReleaseCondition: string;
  rationale: string;
}

/**
 * Commercial vs Strategic NPV split — committee should price commercial cash alone,
 * and evaluate strategic/public-value NPV as an *additive* decision input, never a
 * substitute. This structure makes the distinction unambiguous in the IC memo.
 */
export interface CommercialVsStrategicNpv {
  commercialNpvAED: number;
  commercialIrrPct: number;
  commercialRoiPct: number;
  strategicNpvAED: number;
  blendedNpvAED: number;
  strategicSharePct: number;
  verdict: 'COMMERCIALLY_VIABLE' | 'STRATEGICALLY_JUSTIFIED_ONLY' | 'NOT_VIABLE';
  framing: string;
}

/**
 * AV per-trip economics across lifecycle years. Committee needs to see Y1 (pilot loss),
 * Y3 (target steady state), Y5 (optimised) — not a blended average that hides Year-1 bleed.
 */
export interface AVYearProgressionPoint {
  year: number;
  dailyTripsPerVehicle: number;
  revenuePerTrip: number;
  variableCostPerTrip: number;
  overheadPerTrip: number;
  fullyLoadedCostPerTrip: number;
  contributionMarginPerTrip: number;
  fullyLoadedMarginPerTrip: number;
  fullyLoadedMarginPct: number;
}

export interface AVCostStackComponent {
  component: 'Fixed AV vehicle amortisation' | 'Remote operations' | 'Energy' | 'Maintenance' | 'Insurance' | 'Software / OEM licensing' | 'Safety oversight';
  perTripAED: number;
  shareOfFullyLoadedPct: number;
}

export interface AVYearProgression {
  perYear: AVYearProgressionPoint[];
  costStackY3: AVCostStackComponent[];
  /** Caveat that Y5 profitability depends on full utilization + cost maturity and is NOT yet validated. */
  y5MarginCaveat: string;
  summary: string;
}

/**
 * AV scenario stress — the thing the committee actually asks for:
 *  - utilization at 60% / 70% / 78%
 *  - fare at -20% / base / +10%
 *  - trips/day sensitivity curve
 *  - per-vehicle revenue + payback
 *  - explicit "kill zone" thresholds
 */
export interface AVScenarioPoint {
  label: string;
  value: number;
  fullyLoadedMarginPct: number;
  annualContribution: number;
  indicativeNpv: number;
}

export interface AVKillZoneThreshold {
  lever: 'Cost per km' | 'Daily trips per vehicle' | 'Utilization' | 'Fare per km';
  stopIfBelow?: number;
  stopIfAbove?: number;
  currentValue: number;
  unit: string;
  rationale: string;
}

export interface AVPerVehiclePayback {
  capexPerVehicleAED: number;
  annualRevenuePerVehicleAED: number;
  annualContributionPerVehicleAED: number;
  paybackYears: number;
  verdict: 'PASS' | 'CONDITIONAL' | 'FAIL';
}

export interface AVScenarioStress {
  utilizationScenarios: AVScenarioPoint[];
  fareElasticityScenarios: AVScenarioPoint[];
  tripsPerDayCurve: AVScenarioPoint[];
  perVehicle: AVPerVehiclePayback;
  killZones: AVKillZoneThreshold[];
  /**
   * Probability-weighted interpretation of worst/base/best scenarios. Forces the IC memo
   * to state whether the expected outcome is positive or negative rather than letting the
   * reader draw their own conclusion from three raw numbers.
   */
  probabilityWeightedInterpretation: string;
  summary: string;
}
