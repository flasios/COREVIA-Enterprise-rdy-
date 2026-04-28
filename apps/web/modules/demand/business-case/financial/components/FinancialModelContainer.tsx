import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  Target,
  Clock,
  BarChart3,
  Shield,
  Building2
} from 'lucide-react';
import { Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart, Bar, Line, Cell } from 'recharts';
import type {
  CostLineItem,
  BenefitLineItem,
  BusinessCaseData,
  FinancialSaveData,
  GovernmentValueFactor,
  FiveYearProjection,
  DriverModelOutput,
  KillSwitchMetrics,
  FinancialViewSnapshotData,
} from '../types/financialTypes';
import {
  buildCashFlows,
  calculateBreakEvenYear,
  calculateScenarios,
  calculateDoNothingScenario,
  calculateKeyMetrics,
} from '../utils/financialCalculations';
import { formatCurrency, formatPercentage, formatPaybackPeriod, formatCompactNumber } from '../utils/financialFormatters';
import {
  BENEFIT_YEAR_KEYS,
  COST_YEAR_KEYS,
  PILOT_BENEFIT_YEAR_KEYS,
  PILOT_COST_YEAR_KEYS,
  applyLineItemOverride,
  buildOverrideFromYearValues,
  cloneFinancialLineItemOverrides,
  formatPreciseAed,
  getOverrideTotalValue,
  lineItemOverridesChanged,
  materializeBreakdownComponents,
  materializeYearOverride,
  normalizeFinancialLineItemOverrides,
  readNumber,
  scaleLineItemBreakdown,
  scaleOverrideToTotal,
  updateBreakdownComponentOverride,
  type FinancialLineItemOverride,
  type FinancialViewMode,
  type FinancialYearKey,
} from '../utils/financialOverrides';
import { ValueRecoveryBridge, buildTransformationValueLevers } from '@/modules/demand/components/shared/ValueRecoveryBridge';
import {
  detectArchetype as detectSharedArchetype,
  buildCashFlows as sharedBuildCashFlows,
  calculateNPV as sharedCalculateNPV,
  calculateIRR as sharedCalculateIRR,
  calculatePaybackMonths as sharedCalculatePaybackMonths,
  calculateROI as sharedCalculateROI,
} from '@shared/financialCalculations';
import { computeUnifiedFinancialModel as computeUnifiedFinancialPreviewModel, computeScenarios as computeUnifiedScenarios } from '@domains/demand/infrastructure/financialModel';
import { InvestmentCommitteeAnalytics } from './InvestmentCommitteeAnalytics';
import { OperationalIntelligencePanel } from './OperationalIntelligencePanel';

import {
  applyEditInputsToFinancialViewSnapshot,
  applyOverridesToFinancialViewSnapshot,
  assumptionCredibilityClasses,
  buildStageFinancialSnapshot,
  buildStageSpecificAssumptions,
  calculateAIRecommendedBudget,
  extractFinancialModel,
  findKillSwitchThreshold,
  formatDomainAssumptionValue,
  formatFinancialLabelValue,
  formatStageSpecificAssumptionValue,
  getArchetypeDisplayData,
  getFinancialViewLabel,
  isDroneStageSnapshotStale,
  mapStoredFinancialViewSnapshot,
  normalizeGovernmentFactorRationale,
  normalizeGovernmentFactors,
  normalizeRateDecimal,
  normalizeRecordNumbers,
  parsePercentText,
  relativeDelta,
  type FinancialEditData,
  type VerdictConfig,
  type VerdictConfigWithTextColor,
} from './FinancialModelContainer.model';
export { extractFinancialModel } from './FinancialModelContainer.model';
export type { FinancialEditData } from './FinancialModelContainer.model';

interface FinancialModelContainerProps {
  businessCaseData: BusinessCaseData;
  reportId: string;
  onSave?: (data: FinancialSaveData) => Promise<void>;
  canEdit?: boolean;
  isEditMode?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onRecommendationComputed?: (recommendation: {
    verdict: string;
    label: string;
    summary: string;
    roi?: number;
    npv?: number;
    paybackMonths?: number;
    paybackYears?: number;
    financialView?: FinancialViewMode;
    roiLabel?: string;
    recognizedAnnualRevenue?: number;
    recognizedAnnualDeliveries?: number;
    recognizedRevenuePerDelivery?: number;
    preRealizationRevenuePerDelivery?: number;
    annualRevenue?: number;
    annualDeliveries?: number;
    effectiveCostPerDelivery?: number;
    nominalRevenuePerDelivery?: number;
  }) => void;
  onFinancialDataChange?: (data: FinancialEditData) => void;
  registerFinancialDataProvider?: (provider: (() => FinancialEditData | null) | null) => void;
  unifiedSaveMode?: boolean;
  activeFinancialView?: FinancialViewMode;
  onActiveFinancialViewChange?: (view: FinancialViewMode) => void;
  showStageTabs?: boolean;
}

export function FinancialModelContainer({ businessCaseData, reportId: _reportId, canEdit: _canEdit, isEditMode, onEdit: _onEdit, onCancel: _onCancel, onSave: _onSave, onRecommendationComputed, onFinancialDataChange, registerFinancialDataProvider, unifiedSaveMode = false, activeFinancialView: controlledFinancialView, onActiveFinancialViewChange, showStageTabs = true }: FinancialModelContainerProps) {
  // Use specific dependencies to ensure recomputation when demandReport loads
  const demandReportKey = businessCaseData?.demandReport?.suggestedProjectName ||
                           businessCaseData?.suggestedProjectName ||
                           '';
  const model = useMemo(
    () => extractFinancialModel(businessCaseData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [businessCaseData, demandReportKey]
  );

  // Memoize archetype data to prevent unnecessary re-renders
  const archetypeData = useMemo(
    () => getArchetypeDisplayData(model.archetype),
    [model.archetype]
  );
  const isDroneFinancialArchetype = model.archetype === 'Drone Last Mile Delivery' || model.archetype === 'Drone First Mile Delivery';

  const canonicalInvestment = useMemo(() => {
    const saved = businessCaseData?.savedTotalCostEstimate;
    const savedNum = saved != null ? Number(saved) : NaN;
    if (Number.isFinite(savedNum) && savedNum > 0) return savedNum;

    const computed = ((businessCaseData?.computedFinancialModel as Record<string, unknown> | undefined)?.inputs as Record<string, unknown> | undefined)?.totalInvestment;
    const computedNum = computed != null && computed !== '' ? Number(computed) : NaN;
    if (Number.isFinite(computedNum) && computedNum > 0) return computedNum;

    const raw = businessCaseData?.totalCostEstimate;
    const rawNum = raw != null && raw !== '' ? Number(raw) : NaN;
    if (Number.isFinite(rawNum) && rawNum > 0) return rawNum;

    return model.initialInvestment.value;
  }, [businessCaseData, model.initialInvestment.value]);

  const persistedFinancialInputs = useMemo(() => {
    const computedInputs = ((businessCaseData?.computedFinancialModel as Record<string, unknown> | undefined)?.inputs as Record<string, unknown> | undefined) || {};
    const persistedAssumptions = businessCaseData?.financialAssumptions || businessCaseData?.savedFinancialAssumptions || {};
    const configuredDomainParams = archetypeData.domainAssumptions?.reduce<Record<string, number>>((acc, param) => {
      const numeric = readNumber(param.value);
      if (numeric !== undefined) {
        acc[param.name] = numeric;
      }
      return acc;
    }, {}) || {};
    const domainParameters = {
      ...configuredDomainParams,
      ...normalizeRecordNumbers(businessCaseData?.savedDomainParameters),
      ...normalizeRecordNumbers(businessCaseData?.domainParameters),
      ...normalizeRecordNumbers(computedInputs.domainParameters),
    };

    return {
      archetype: typeof computedInputs.archetype === 'string' && computedInputs.archetype.trim().length > 0
        ? computedInputs.archetype
        : model.archetype,
      totalInvestment: readNumber(computedInputs.totalInvestment) ?? canonicalInvestment,
      adoptionRate: readNumber(persistedAssumptions.adoptionRate) ?? readNumber(computedInputs.adoptionRate) ?? archetypeData.adoptionRate,
      maintenancePercent: readNumber(persistedAssumptions.maintenancePercent) ?? readNumber(computedInputs.maintenancePercent) ?? archetypeData.maintenancePercent,
      contingencyPercent: readNumber(persistedAssumptions.contingencyPercent) ?? readNumber(computedInputs.contingencyPercent) ?? archetypeData.contingencyPercent,
      discountRate: normalizeRateDecimal(persistedAssumptions.discountRate) ?? normalizeRateDecimal(computedInputs.discountRate) ?? archetypeData.discountRate,
      aiRecommendedBudget: readNumber(businessCaseData?.aiRecommendedBudget),
      domainParameters,
    };
  }, [archetypeData, businessCaseData, canonicalInvestment, model.archetype]);

  // Display values: use saved values if available, otherwise archetype defaults
  // This ensures view mode shows persisted edits after page refresh
  const displayValues = useMemo(() => {
    return {
      initialInvestment: persistedFinancialInputs.totalInvestment,
      adoptionRate: persistedFinancialInputs.adoptionRate,
      maintenancePercent: persistedFinancialInputs.maintenancePercent,
      contingencyPercent: persistedFinancialInputs.contingencyPercent,
      discountRate: persistedFinancialInputs.discountRate,
      domainParams: persistedFinancialInputs.domainParameters,
    };
  }, [persistedFinancialInputs]);

  // VIEW MODE METRICS: Use cached unified model from database if available
  // This ensures the recommendation, ROI, NPV, and charts reflect the actual saved data
  const viewModeMetrics = useMemo(() => {
    // PRIORITY 1: Use cached unified financial model from database (computed by server)
    // This is the single source of truth after any save
    const cachedModel = businessCaseData?.computedFinancialModel;
    if (cachedModel && cachedModel.metrics && cachedModel.decision) {
      const cachedBreakEvenYear = Number((cachedModel.metrics as Record<string, unknown>).breakEvenYear);
      // Server returns ROI/IRR as percentages already (e.g., 77 = 77%)
      return {
        keyMetrics: {
          npv: cachedModel.metrics.npv,
          roi5Year: cachedModel.metrics.roi, // Already a percentage
          irr: cachedModel.metrics.irr, // Already a percentage
          paybackMonths: cachedModel.metrics.paybackMonths,
          breakEvenYear: Number.isFinite(cachedBreakEvenYear) ? cachedBreakEvenYear : calculateBreakEvenYear(cachedModel.cashFlows || []),
          paybackYears: cachedModel.metrics.paybackMonths / 12
        },
        cashFlows: cachedModel.cashFlows || [],
        scenarios: cachedModel.scenarios || model.scenarios,
        scaledCosts: cachedModel.costs || model.costs,
        scaledBenefits: cachedModel.benefits || model.benefits,
        decision: cachedModel.decision,
        governmentValue: cachedModel.governmentValue || null,
        fiveYearProjections: cachedModel.fiveYearProjections || null
      };
    }

    // FALLBACK: Calculate locally if no cached model exists
    // Calculate scaling ratios relative to archetype defaults
    const baseAdoptionRate = archetypeData.adoptionRate || 0.75;
    const baseMaintenancePercent = archetypeData.maintenancePercent || 0.15;
    const baseContingencyPercent = archetypeData.contingencyPercent || 0.10;
    // For investment, we use the model's value as the base since it already incorporates
    // totalCostEstimate. Investment scaling is only for relative changes.
    const baseInvestment = model.initialInvestment.value || 1;

    // Investment ratio is 1.0 since displayValues.initialInvestment == model.initialInvestment.value
    // (both come from the same saved totalCostEstimate)
    const investmentRatio = displayValues.initialInvestment / baseInvestment;
    const adoptionRatio = displayValues.adoptionRate / baseAdoptionRate;
    const maintenanceRatio = isDroneFinancialArchetype ? 1 : (displayValues.maintenancePercent / baseMaintenancePercent);
    const contingencyRatio = displayValues.contingencyPercent / baseContingencyPercent;

    // Calculate domain parameter multipliers
    let domainCostMultiplier = 1;
    let domainBenefitMultiplier = 1;

    if (archetypeData.domainAssumptions) {
      archetypeData.domainAssumptions.forEach(param => {
        const baseValue = typeof param.value === 'number' ? param.value : parseFloat(String(param.value)) || 1;
        const currentValue = displayValues.domainParams[param.name] ?? baseValue;

        if (baseValue > 0) {
          const paramRatio = currentValue / baseValue;
          const impact = param.impact || 'both';

          if (impact === 'benefit') {
            domainBenefitMultiplier *= paramRatio;
          } else if (impact === 'cost') {
            domainCostMultiplier *= paramRatio;
          } else {
            domainCostMultiplier *= Math.pow(paramRatio, 0.5);
            domainBenefitMultiplier *= Math.pow(paramRatio, 0.5);
          }
        }
      });
    }

    // Scale costs
    const scaledCosts = model.costs.map(c => {
      const isOngoing = c.category === 'operational';
      const costMultiplier = isOngoing
        ? investmentRatio * maintenanceRatio * domainCostMultiplier
        : investmentRatio * contingencyRatio * domainCostMultiplier;

      return {
        ...c,
        year0: c.year0 * investmentRatio * contingencyRatio * domainCostMultiplier,
        year1: c.year1 * costMultiplier,
        year2: c.year2 * costMultiplier,
        year3: c.year3 * costMultiplier,
        year4: c.year4 * costMultiplier,
        year5: c.year5 * costMultiplier
      };
    });

    // Scale benefits
    const scaledBenefits = model.benefits.map(b => {
      const benefitMultiplier = adoptionRatio * domainBenefitMultiplier;
      return {
        ...b,
        year1: b.year1 * benefitMultiplier,
        year2: b.year2 * benefitMultiplier,
        year3: b.year3 * benefitMultiplier,
        year4: b.year4 * benefitMultiplier,
        year5: b.year5 * benefitMultiplier
      };
    });

    const discountRatePercent = displayValues.discountRate * 100;
    const cashFlows = buildCashFlows(scaledCosts, scaledBenefits, discountRatePercent, 5);
    const scenarios = calculateScenarios(scaledCosts, scaledBenefits, discountRatePercent, 5);
    const keyMetrics = calculateKeyMetrics(cashFlows, scenarios, discountRatePercent);

    return { keyMetrics, cashFlows, scenarios, scaledCosts, scaledBenefits, decision: null, governmentValue: null, fiveYearProjections: null };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessCaseData, displayValues, archetypeData, isDroneFinancialArchetype, model.costs, model.benefits, model.initialInvestment.value, model.keyMetrics, model.scenarios]);

  // Track if we've initialized edit values for current edit session
  const hasInitializedRef = useRef(false);

  // Comprehensive edit state for all editable financial parameters
  const [editValues, setEditValues] = useState({
    // Investment Summary
    initialInvestment: 0,
    // Key Assumptions
    adoptionRate: 0,
    maintenancePercent: 0,
    contingencyPercent: 0,
    discountRate: 0,
    // Domain-Specific Parameters (dynamic based on archetype)
    domainParams: {} as Record<string, number>,
    // AI Recommended Investment
    aiRecommendedBudget: 0,
    // User overrides for individual line items
    costOverrides: {} as Record<string, FinancialLineItemOverride>,
    // User overrides for individual line items
    benefitOverrides: {} as Record<string, FinancialLineItemOverride>,
  });

  const persistedCostOverrides = useMemo(
    () => {
      const topLevelOverrides = normalizeFinancialLineItemOverrides(
        (businessCaseData as unknown as { costOverrides?: Record<string, unknown> } | undefined)?.costOverrides,
      );
      if (Object.keys(topLevelOverrides).length > 0) {
        return topLevelOverrides;
      }
      const nestedOverrides = (businessCaseData?.savedFinancialAssumptions as Record<string, unknown> | undefined)?.costOverrides;
      return normalizeFinancialLineItemOverrides(nestedOverrides);
    },
    [businessCaseData]
  );

  const persistedBenefitOverrides = useMemo(
    () => {
      const topLevelOverrides = normalizeFinancialLineItemOverrides(
        (businessCaseData as unknown as { benefitOverrides?: Record<string, unknown> } | undefined)?.benefitOverrides,
      );
      if (Object.keys(topLevelOverrides).length > 0) {
        return topLevelOverrides;
      }
      const nestedOverrides = (businessCaseData?.savedFinancialAssumptions as Record<string, unknown> | undefined)?.benefitOverrides;
      return normalizeFinancialLineItemOverrides(nestedOverrides);
    },
    [businessCaseData]
  );

  const currentUpfrontInvestment = isEditMode
    ? editValues.initialInvestment || persistedFinancialInputs.totalInvestment
    : persistedFinancialInputs.totalInvestment;
  const [activeFinancialView, setActiveFinancialView] = useState<FinancialViewMode>('full');
  const hasUserSelectedFinancialViewRef = useRef(false);
  const isFinancialViewControlled = controlledFinancialView !== undefined;
  const defaultAiRecommendedBudget = useMemo(() => {
    return persistedFinancialInputs.aiRecommendedBudget
      ?? (calculateAIRecommendedBudget(model.archetype, archetypeData.domainAssumptions).value || (persistedFinancialInputs.totalInvestment * 1.1));
  }, [archetypeData.domainAssumptions, model.archetype, persistedFinancialInputs.aiRecommendedBudget, persistedFinancialInputs.totalInvestment]);

  // Initialize edit values ONLY when transitioning into edit mode (not on every render)
  useEffect(() => {
    if (isEditMode && !hasInitializedRef.current) {
      // Read saved assumptions from version data (if user previously saved edits)
      setEditValues({
        initialInvestment: persistedFinancialInputs.totalInvestment,
        adoptionRate: persistedFinancialInputs.adoptionRate * 100,
        maintenancePercent: persistedFinancialInputs.maintenancePercent * 100,
        contingencyPercent: persistedFinancialInputs.contingencyPercent * 100,
        discountRate: persistedFinancialInputs.discountRate * 100,
        domainParams: persistedFinancialInputs.domainParameters,
        aiRecommendedBudget: defaultAiRecommendedBudget,
        costOverrides: { ...persistedCostOverrides },
        benefitOverrides: { ...persistedBenefitOverrides },
      });
      hasInitializedRef.current = true;
    } else if (!isEditMode) {
      // Reset the flag when exiting edit mode
      hasInitializedRef.current = false;
    }
  }, [isEditMode, defaultAiRecommendedBudget, persistedFinancialInputs, persistedCostOverrides, persistedBenefitOverrides]);

  // Track whether baseline has been captured for current edit session
  const baselineCapturedRef = useRef(false);

  // Store the baseline values captured when edit mode is first entered
  // These don't change during the edit session. Used by hasFinancialEdits
  // to detect real user edits without being fooled by the parent's round-trip
  // of edited data back into businessCaseData (which would otherwise cause
  // persistedFinancialInputs/persistedCostOverrides to equal editValues and
  // mark the edit as "no change", reverting the live preview).
  const baselineValuesRef = useRef<{
    investment: number;
    adoption: number;
    maintenance: number;
    contingency: number;
    discount: number;
    aiRecommendedBudget: number;
    domainParams: Record<string, number>;
    costOverrides: Record<string, FinancialLineItemOverride>;
    benefitOverrides: Record<string, FinancialLineItemOverride>;
  } | null>(null);

  // Capture baseline values when edit mode first becomes active
  useEffect(() => {
    if (isEditMode && hasInitializedRef.current && !baselineCapturedRef.current) {
      // Capture the initial edit values as baseline for ratio calculations AND
      // for change detection. Snapshot by value so later parent round-trips of
      // edited data cannot mutate the baseline.
      baselineValuesRef.current = {
        investment: editValues.initialInvestment,
        adoption: editValues.adoptionRate / 100,
        maintenance: editValues.maintenancePercent / 100,
        contingency: editValues.contingencyPercent / 100,
        discount: editValues.discountRate / 100,
        aiRecommendedBudget: editValues.aiRecommendedBudget,
        domainParams: { ...editValues.domainParams },
        costOverrides: cloneFinancialLineItemOverrides(persistedCostOverrides),
        benefitOverrides: cloneFinancialLineItemOverrides(persistedBenefitOverrides),
      };
      baselineCapturedRef.current = true;
    } else if (!isEditMode) {
      // Reset baseline capture flag when exiting edit mode
      baselineCapturedRef.current = false;
      baselineValuesRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, editValues.initialInvestment]); // Only trigger on edit mode change or initial investment set

  // Notify parent of financial data changes for unified save mode
  // Compare against the IMMUTABLE baseline captured at edit-mode entry.
  // NEVER compare against persistedFinancialInputs/persistedCostOverrides —
  // those drift because the parent round-trips the edited values back into
  // businessCaseData, which would make hasFinancialEdits flip to false and
  // wipe out the live preview.
  const hasFinancialEdits = useMemo(() => {
    if (!isEditMode || !hasInitializedRef.current) {
      return false;
    }

    const baseline = baselineValuesRef.current;
    if (!baseline) {
      // Baseline not captured yet — compare against persisted state so we
      // don't suppress edits made in the very first paint.
      return (
        Math.abs(editValues.initialInvestment - persistedFinancialInputs.totalInvestment) > 0.01 ||
        Math.abs(editValues.adoptionRate / 100 - persistedFinancialInputs.adoptionRate) > 0.0001 ||
        Math.abs(editValues.maintenancePercent / 100 - persistedFinancialInputs.maintenancePercent) > 0.0001 ||
        Math.abs(editValues.contingencyPercent / 100 - persistedFinancialInputs.contingencyPercent) > 0.0001 ||
        Math.abs(editValues.discountRate / 100 - persistedFinancialInputs.discountRate) > 0.0001 ||
        Math.abs(editValues.aiRecommendedBudget - defaultAiRecommendedBudget) > 0.01 ||
        Object.keys(editValues.domainParams).some((key) =>
          Math.abs((editValues.domainParams[key] || 0) - (persistedFinancialInputs.domainParameters[key] || 0)) > 0.01
        ) ||
        lineItemOverridesChanged(editValues.costOverrides, persistedCostOverrides, COST_YEAR_KEYS) ||
        lineItemOverridesChanged(editValues.benefitOverrides, persistedBenefitOverrides, BENEFIT_YEAR_KEYS)
      );
    }

    return (
      Math.abs(editValues.initialInvestment - baseline.investment) > 0.01 ||
      Math.abs(editValues.adoptionRate / 100 - baseline.adoption) > 0.0001 ||
      Math.abs(editValues.maintenancePercent / 100 - baseline.maintenance) > 0.0001 ||
      Math.abs(editValues.contingencyPercent / 100 - baseline.contingency) > 0.0001 ||
      Math.abs(editValues.discountRate / 100 - baseline.discount) > 0.0001 ||
      Math.abs(editValues.aiRecommendedBudget - baseline.aiRecommendedBudget) > 0.01 ||
      Object.keys(editValues.domainParams).some((key) =>
        Math.abs((editValues.domainParams[key] || 0) - (baseline.domainParams[key] || 0)) > 0.01
      ) ||
      lineItemOverridesChanged(editValues.costOverrides, baseline.costOverrides, COST_YEAR_KEYS) ||
      lineItemOverridesChanged(editValues.benefitOverrides, baseline.benefitOverrides, BENEFIT_YEAR_KEYS)
    );
  }, [defaultAiRecommendedBudget, isEditMode, editValues, persistedFinancialInputs, persistedCostOverrides, persistedBenefitOverrides]);

  const latestFinancialEditData = useMemo<FinancialEditData | null>(() => {
    if (!isEditMode || !hasInitializedRef.current) {
      return null;
    }

    const currentAdoption = editValues.adoptionRate / 100;
    const currentMaintenance = editValues.maintenancePercent / 100;
    const currentContingency = editValues.contingencyPercent / 100;
    const currentDiscount = editValues.discountRate / 100;

    return {
      totalCostEstimate: editValues.initialInvestment,
      financialAssumptions: {
        adoptionRate: currentAdoption,
        maintenancePercent: currentMaintenance,
        contingencyPercent: currentContingency,
        discountRate: currentDiscount,
      },
      domainParameters: editValues.domainParams,
      aiRecommendedBudget: editValues.aiRecommendedBudget,
      costOverrides: { ...editValues.costOverrides },
      benefitOverrides: { ...editValues.benefitOverrides },
      hasChanges: hasFinancialEdits,
    };
  }, [editValues, hasFinancialEdits, isEditMode]);
  const latestFinancialEditDataRef = useRef<FinancialEditData | null>(latestFinancialEditData);
  latestFinancialEditDataRef.current = latestFinancialEditData;

  useEffect(() => {
    if (latestFinancialEditData && onFinancialDataChange) {
      onFinancialDataChange(latestFinancialEditData);
    }
  }, [latestFinancialEditData, onFinancialDataChange]);

  useEffect(() => {
    if (!registerFinancialDataProvider) {
      return;
    }

    registerFinancialDataProvider(() => latestFinancialEditDataRef.current);
    return () => {
      registerFinancialDataProvider(null);
    };
  }, [registerFinancialDataProvider]);

  // Compute preview metrics from edit values for live recalculation
  // Uses the same shared calculation module as the backend for consistency
  const previewMetrics = useMemo(() => {
    if (!isEditMode || !hasFinancialEdits) {
      return null;
    }

    // Get project name to detect archetype
    const projectName =
      businessCaseData?.demandReport?.suggestedProjectName ||
      businessCaseData?.suggestedProjectName ||
      businessCaseData?.projectName ||
      '';
    const archetype = persistedFinancialInputs.archetype || detectSharedArchetype(projectName);

    // Prepare inputs matching the backend format
    // All rates must be in decimal form (e.g., 0.08 for 8%) as the shared calculation
    // module expects decimals — NOT percentages.
    const inputs = {
      totalInvestment: editValues.initialInvestment,
      archetype,
      discountRate: editValues.discountRate / 100, // Convert to decimal (e.g., 8 → 0.08)
      adoptionRate: editValues.adoptionRate / 100, // Convert to decimal
      maintenancePercent: editValues.maintenancePercent / 100, // Convert to decimal
      contingencyPercent: editValues.contingencyPercent / 100, // Convert to decimal
      domainParameters: editValues.domainParams, // Pass domain parameters for archetype-specific calculations
    };

    // Use the unified financial model — the SAME function the backend uses when persisting
    // `computedFinancialModel`. The older `computeSharedFinancialModel` in
    // `packages/financialCalculations.ts` has diverged defaults (e.g. Transaction Volume
    // 10000 vs unified 500000) and uses legacy domain-parameter keys ("Citizens Served"
    // vs unified "Citizen Users"), which would cause the live preview benefit multiplier
    // to differ by 30×+ from the persisted numbers. Always route previews through the
    // unified model to keep edit-mode math consistent with the saved business case.
    const result = computeUnifiedFinancialPreviewModel(inputs);
    const computedCosts = result.costs as CostLineItem[];
    const computedBenefits = result.benefits as BenefitLineItem[];

    // Apply user cost/benefit overrides by scaling each line item's yearly values
    // proportionally so the 5-year lifecycle total matches the user-specified value.
    const applyTotalOverride = <T extends { id: string }>(
      items: T[],
      overrides: Record<string, FinancialLineItemOverride>,
      sumOfItem: (item: T) => number,
      scaleItem: (item: T, factor: number) => T,
      yearKeys: FinancialYearKey[],
    ): T[] => {
      if (!overrides || Object.keys(overrides).length === 0) return items;
      return items.map((item) => {
        const override = overrides[item.id];
        if (override === undefined) return item;
        if (typeof override !== 'number') {
          return applyLineItemOverride(item as unknown as Record<string, unknown>, override, yearKeys) as T;
        }
        if (Number.isNaN(override)) return item;
        const originalTotal = sumOfItem(item);
        if (originalTotal <= 0) return item;
        const factor = override / originalTotal;
        if (Math.abs(factor - 1) < 1e-6) return item;
        return scaleLineItemBreakdown(item as unknown as Record<string, unknown>, scaleItem(item, factor) as unknown as Record<string, unknown>, yearKeys) as T;
      });
    };

    const overriddenCosts = applyTotalOverride(
      computedCosts,
      editValues.costOverrides,
      (c) => (c.year0 ?? 0) + (c.year1 ?? 0) + (c.year2 ?? 0) + (c.year3 ?? 0) + (c.year4 ?? 0) + (c.year5 ?? 0),
      (c, f) => ({
        ...c,
        year0: (c.year0 ?? 0) * f,
        year1: (c.year1 ?? 0) * f,
        year2: (c.year2 ?? 0) * f,
        year3: (c.year3 ?? 0) * f,
        year4: (c.year4 ?? 0) * f,
        year5: (c.year5 ?? 0) * f,
      }),
      COST_YEAR_KEYS,
    );

    const overriddenBenefits = applyTotalOverride(
      computedBenefits,
      editValues.benefitOverrides,
      (b) => (b.year1 ?? 0) + (b.year2 ?? 0) + (b.year3 ?? 0) + (b.year4 ?? 0) + (b.year5 ?? 0),
      (b, f) => ({
        ...b,
        year1: (b.year1 ?? 0) * f,
        year2: (b.year2 ?? 0) * f,
        year3: (b.year3 ?? 0) * f,
        year4: (b.year4 ?? 0) * f,
        year5: (b.year5 ?? 0) * f,
      }),
      BENEFIT_YEAR_KEYS,
    );

    // If any overrides were applied, recompute downstream metrics from the adjusted arrays
    const hasOverrides = Object.keys(editValues.costOverrides).length > 0 || Object.keys(editValues.benefitOverrides).length > 0;
    if (hasOverrides) {
      const discount = editValues.discountRate / 100;
      const recomputedCashFlows = sharedBuildCashFlows(overriddenCosts, overriddenBenefits, discount);
      const recomputedNpv = sharedCalculateNPV(recomputedCashFlows);
      const recomputedIrr = sharedCalculateIRR(recomputedCashFlows);
      const recomputedPayback = sharedCalculatePaybackMonths(recomputedCashFlows);
      const totalCostsAdj = recomputedCashFlows.reduce((s, cf) => s + cf.costs, 0);
      const totalBenefitsAdj = recomputedCashFlows.reduce((s, cf) => s + cf.benefits, 0);
      const recomputedRoi = sharedCalculateROI(totalBenefitsAdj, totalCostsAdj);
      // Recompute scenarios from the overridden arrays so downstream surfaces
      // (Value Recovery Bridge, scenario cards) reflect the user's edits.
      const recomputedScenarios = computeUnifiedScenarios(
        overriddenCosts as unknown as Parameters<typeof computeUnifiedScenarios>[0],
        overriddenBenefits as unknown as Parameters<typeof computeUnifiedScenarios>[1],
        discount,
        archetype,
      );

      return {
        keyMetrics: {
          npv: recomputedNpv,
          roi5Year: recomputedRoi,
          irr: recomputedIrr,
          paybackMonths: recomputedPayback,
          paybackYears: recomputedPayback / 12,
        },
        cashFlows: recomputedCashFlows,
        scenarios: recomputedScenarios,
        scaledCosts: overriddenCosts,
        scaledBenefits: overriddenBenefits,
        decision: result.decision,
      };
    }

    // Return in format compatible with existing component usage
    return {
      keyMetrics: {
        npv: result.metrics.npv,
        roi5Year: result.metrics.roi,
        irr: result.metrics.irr,
        paybackMonths: result.metrics.paybackMonths,
        paybackYears: result.metrics.paybackMonths / 12
      },
      cashFlows: result.cashFlows,
      scenarios: result.scenarios,
        scaledCosts: computedCosts,
        scaledBenefits: computedBenefits,
      decision: result.decision
    };
  }, [hasFinancialEdits, isEditMode, editValues, businessCaseData, persistedFinancialInputs.archetype]);

  const previewUnifiedModel = useMemo(() => {
    if (!isEditMode || !hasFinancialEdits) {
      return null;
    }

    const projectName =
      businessCaseData?.demandReport?.suggestedProjectName ||
      businessCaseData?.suggestedProjectName ||
      businessCaseData?.projectName ||
      '';
    const archetype = persistedFinancialInputs.archetype || detectSharedArchetype(projectName);

    return computeUnifiedFinancialPreviewModel({
      totalInvestment: editValues.initialInvestment,
      archetype,
      discountRate: editValues.discountRate / 100,
      adoptionRate: editValues.adoptionRate / 100,
      maintenancePercent: editValues.maintenancePercent / 100,
      contingencyPercent: editValues.contingencyPercent / 100,
      domainParameters: editValues.domainParams,
    });
  }, [hasFinancialEdits, isEditMode, editValues, businessCaseData, persistedFinancialInputs.archetype]);

  const persistedUnifiedModel = useMemo(() => {
    const projectName =
      businessCaseData?.demandReport?.suggestedProjectName ||
      businessCaseData?.suggestedProjectName ||
      businessCaseData?.projectName ||
      '';
    const archetype = persistedFinancialInputs.archetype || detectSharedArchetype(projectName);

    return computeUnifiedFinancialPreviewModel({
      totalInvestment: persistedFinancialInputs.totalInvestment,
      archetype,
      discountRate: persistedFinancialInputs.discountRate,
      adoptionRate: persistedFinancialInputs.adoptionRate,
      maintenancePercent: persistedFinancialInputs.maintenancePercent,
      contingencyPercent: persistedFinancialInputs.contingencyPercent,
      domainParameters: persistedFinancialInputs.domainParameters,
    });
  }, [businessCaseData, persistedFinancialInputs]);

  // Helper to update domain param
  const updateDomainParam = (name: string, value: number) => {
    setEditValues(prev => ({
      ...prev,
      domainParams: { ...prev.domainParams, [name]: value }
    }));
  };

  // Active costs and benefits: use preview when editing, view mode values otherwise
  const activeCosts = isEditMode && previewMetrics
    ? previewMetrics.scaledCosts
    : (viewModeMetrics.scaledCosts ?? model.costs);
  const activeBenefits = isEditMode && previewMetrics
    ? previewMetrics.scaledBenefits
    : (viewModeMetrics.scaledBenefits ?? model.benefits);
  const activeDoNothingScenario = useMemo(
    () => calculateDoNothingScenario(activeBenefits, model.projectDuration),
    [activeBenefits, model.projectDuration]
  );

  // Compute totals from ACTIVE scaled costs/benefits (so they match ROI/NPV)
  const totalCosts = activeCosts.reduce((sum: number, c: CostLineItem) => sum + c.year0 + c.year1 + c.year2 + c.year3 + c.year4 + c.year5, 0);
  const totalBenefits = activeBenefits.reduce((sum: number, b: BenefitLineItem) => sum + b.year1 + b.year2 + b.year3 + b.year4 + b.year5, 0);
  const displayedLifecycleCost = !isEditMode
    ? readNumber(businessCaseData?.lifecycleCostEstimate)
      ?? readNumber(((businessCaseData?.computedFinancialModel as Record<string, unknown> | undefined)?.metrics as Record<string, unknown> | undefined)?.totalCosts)
      ?? totalCosts
    : totalCosts;
  const displayedLifecycleBenefit = !isEditMode
    ? readNumber(businessCaseData?.lifecycleBenefitEstimate)
      ?? readNumber(((businessCaseData?.computedFinancialModel as Record<string, unknown> | undefined)?.metrics as Record<string, unknown> | undefined)?.totalBenefits)
      ?? totalBenefits
    : totalBenefits;
  const displayedNetLifecycleValue = displayedLifecycleBenefit - displayedLifecycleCost;
  const displayedOperatingRunCost = Math.max(0, displayedLifecycleCost - currentUpfrontInvestment);
  const shouldPreferDerivedUnifiedModel = useMemo(() => {
    if (isEditMode || persistedFinancialInputs.archetype !== 'Drone Last Mile Delivery') {
      return false;
    }

    const storedModel = businessCaseData?.computedFinancialModel as Record<string, unknown> | undefined;
    const storedFinancialViews = storedModel?.financialViews as { pilot?: FinancialViewSnapshotData; full?: FinancialViewSnapshotData } | undefined;
    const storedDriverModel = storedModel?.driverModel as DriverModelOutput | undefined;
    const derivedDriverModel = persistedUnifiedModel.driverModel;

    if (!storedFinancialViews?.pilot || !storedFinancialViews?.full) {
      return true;
    }

    if (isDroneStageSnapshotStale(storedFinancialViews.pilot, persistedUnifiedModel.financialViews?.pilot, persistedFinancialInputs.discountRate)) {
      return true;
    }

    if (isDroneStageSnapshotStale(storedFinancialViews.full, persistedUnifiedModel.financialViews?.full, persistedFinancialInputs.discountRate)) {
      return true;
    }

    const storedPilotStage = storedDriverModel?.stagedEconomics?.pilotCase;
    const derivedPilotStage = derivedDriverModel?.stagedEconomics?.pilotCase;

    if (!storedPilotStage || !derivedPilotStage) {
      return false;
    }

    return relativeDelta(storedPilotStage.annualDeliveries, derivedPilotStage.annualDeliveries) > 0.2
      || relativeDelta(storedPilotStage.dailyDeliveriesPerDrone, derivedPilotStage.dailyDeliveriesPerDrone) > 0.2
      || relativeDelta(storedPilotStage.annualRevenue, derivedPilotStage.annualRevenue) > 0.2;
  }, [businessCaseData, isEditMode, persistedFinancialInputs, persistedUnifiedModel]);
  const activeComputedFinancialModel = (isEditMode && previewUnifiedModel
    ? previewUnifiedModel
    : shouldPreferDerivedUnifiedModel
      ? persistedUnifiedModel
    : businessCaseData?.computedFinancialModel) as (BusinessCaseData['computedFinancialModel'] | ReturnType<typeof computeUnifiedFinancialPreviewModel> | undefined);
  const activeComputedFinancialModelRecord = activeComputedFinancialModel as Record<string, unknown> | undefined;
  const computedDriverModel = (activeComputedFinancialModel as Record<string, unknown> | undefined)?.driverModel as DriverModelOutput | undefined;
  const storedFinancialViews = activeComputedFinancialModel?.financialViews;
  const stagedEconomics = computedDriverModel?.stagedEconomics;
  const pilotCapitalRatio = stagedEconomics
    ? Math.max(0.12, Math.min(0.3, stagedEconomics.pilotCase.fleetSize / Math.max(1, stagedEconomics.scaleCase.fleetSize)))
    : 0;
  const pilotCapitalProxy = currentUpfrontInvestment * pilotCapitalRatio;
  const persistedPilotCapitalProxy = persistedFinancialInputs.totalInvestment * pilotCapitalRatio;
  const lifecycleNarrative = computedDriverModel?.stagedEconomics
    ? '5-year lifecycle cost across pilot launch in Year 1 and commercial ramp through Years 2-5'
    : '5-year lifecycle cost including implementation, operations, and maintenance';

  // Compute preview verdict based on edited values (for live updates during editing)
  // Uses the decision computed by the shared calculation module
  const getPreviewVerdict = () => {
    if (!isEditMode || !previewMetrics) return null;

    // Use decision from shared calculation for consistency with backend
    const decision = (previewMetrics as Record<string, unknown>).decision as { verdict?: string; label?: string } | undefined;
    if (decision && decision.verdict) {
      const verdictMap: Record<string, VerdictConfig> = {
        'STRONG_INVEST': { bg: 'bg-emerald-600', icon: <CheckCircle className="h-6 w-6" />, label: 'STRONG INVEST' },
        'INVEST': { bg: 'bg-emerald-600', icon: <CheckCircle className="h-6 w-6" />, label: 'INVEST' },
        'CONDITIONAL': { bg: 'bg-amber-500', icon: <AlertTriangle className="h-6 w-6" />, label: 'CONDITIONAL' },
        'CAUTION': { bg: 'bg-orange-500', icon: <AlertTriangle className="h-6 w-6" />, label: 'CAUTION' },
        'DO_NOT_INVEST': { bg: 'bg-red-600', icon: <XCircle className="h-6 w-6" />, label: 'DO NOT INVEST' },
        'HOLD': { bg: 'bg-amber-500', icon: <AlertTriangle className="h-6 w-6" />, label: 'HOLD' },
        'DEFER': { bg: 'bg-red-600', icon: <XCircle className="h-6 w-6" />, label: 'DEFER' },
      };
      const mapped = verdictMap[decision.verdict] || { bg: 'bg-amber-500', icon: <AlertTriangle className="h-6 w-6" />, label: decision.label || decision.verdict };
      return { verdict: decision.verdict, ...mapped };
    }

    // Fallback: Determine verdict based on ROI and NPV thresholds
    const roi = previewMetrics.keyMetrics.roi5Year;
    const npv = previewMetrics.keyMetrics.npv;
    const payback = previewMetrics.keyMetrics.paybackMonths;

    if (roi > 50 && npv > 0 && payback < 36) {
      return { verdict: 'INVEST', bg: 'bg-emerald-600', icon: <CheckCircle className="h-6 w-6" />, label: 'INVEST' };
    }
    if (roi > 20 && npv > 0 && payback < 48) {
      return { verdict: 'INVEST', bg: 'bg-emerald-600', icon: <CheckCircle className="h-6 w-6" />, label: 'INVEST' };
    }
    if (roi > 0 && npv >= 0) {
      return { verdict: 'CONDITIONAL', bg: 'bg-amber-500', icon: <AlertTriangle className="h-6 w-6" />, label: 'CONDITIONAL' };
    }
    return { verdict: 'DO_NOT_INVEST', bg: 'bg-red-600', icon: <XCircle className="h-6 w-6" />, label: 'DO NOT INVEST' };
  };

  // Compute view mode verdict based on saved values (viewModeMetrics)
  // Uses cached decision from unified model if available
  const getViewModeVerdict = () => {
    // PRIORITY 1: Use cached decision from unified financial model
    const cachedDecision = (viewModeMetrics as Record<string, unknown>).decision as { verdict?: string; label?: string; summary?: string } | undefined;
    if (cachedDecision && cachedDecision.verdict) {
      // Map both server-returned verdicts (INVEST, HOLD, DEFER) and legacy values
      const verdictMap: Record<string, VerdictConfig> = {
        // Server-returned verdicts (uppercase)
        'STRONG_INVEST': { bg: 'bg-emerald-600', icon: <CheckCircle className="h-6 w-6" />, label: 'STRONG INVEST' },
        'INVEST': { bg: 'bg-emerald-600', icon: <CheckCircle className="h-6 w-6" />, label: 'INVEST' },
        'CONDITIONAL': { bg: 'bg-amber-500', icon: <AlertTriangle className="h-6 w-6" />, label: 'CONDITIONAL' },
        'CAUTION': { bg: 'bg-orange-500', icon: <AlertTriangle className="h-6 w-6" />, label: 'CAUTION' },
        'HOLD': { bg: 'bg-amber-500', icon: <AlertTriangle className="h-6 w-6" />, label: 'HOLD' },
        'DEFER': { bg: 'bg-red-600', icon: <XCircle className="h-6 w-6" />, label: 'DEFER' },
        'DO_NOT_INVEST': { bg: 'bg-red-600', icon: <XCircle className="h-6 w-6" />, label: 'DO NOT INVEST' },
        // Legacy verdicts for backward compatibility
        'strongly_recommended': { bg: 'bg-emerald-600', icon: <CheckCircle className="h-6 w-6" />, label: 'RECOMMENDED' },
        'recommended': { bg: 'bg-emerald-600', icon: <CheckCircle className="h-6 w-6" />, label: 'RECOMMENDED' },
        'conditional': { bg: 'bg-amber-500', icon: <AlertTriangle className="h-6 w-6" />, label: 'CONDITIONAL' },
        'not_recommended': { bg: 'bg-red-600', icon: <XCircle className="h-6 w-6" />, label: 'NOT RECOMMENDED' },
      };
      const mapped = verdictMap[cachedDecision.verdict] || { bg: 'bg-amber-500', icon: <AlertTriangle className="h-6 w-6" />, label: cachedDecision.verdict };
      return { verdict: cachedDecision.verdict, ...mapped };
    }

    // FALLBACK: Calculate verdict from metrics
    const roi = viewModeMetrics.keyMetrics.roi5Year;
    const npv = viewModeMetrics.keyMetrics.npv;
    const payback = viewModeMetrics.keyMetrics.paybackMonths;

    // Strong recommendation: ROI > 50%, NPV positive, payback < 36 months
    if (roi > 50 && npv > 0 && payback < 36) {
      return { verdict: 'strongly_recommended', bg: 'bg-emerald-600', icon: <CheckCircle className="h-6 w-6" />, label: 'RECOMMENDED' };
    }
    // Recommended: ROI > 20%, NPV positive, payback < 48 months
    if (roi > 20 && npv > 0 && payback < 48) {
      return { verdict: 'recommended', bg: 'bg-emerald-600', icon: <CheckCircle className="h-6 w-6" />, label: 'RECOMMENDED' };
    }
    // Conditional: ROI > 0%, NPV >= 0
    if (roi > 0 && npv >= 0) {
      return { verdict: 'conditional', bg: 'bg-amber-500', icon: <AlertTriangle className="h-6 w-6" />, label: 'CONDITIONAL' };
    }
    // Not recommended
    return { verdict: 'not_recommended', bg: 'bg-red-600', icon: <XCircle className="h-6 w-6" />, label: 'NOT RECOMMENDED' };
  };

  const getVerdictConfig = () => {
    // Use preview verdict when in edit mode
    const previewVerdict = getPreviewVerdict();
    if (previewVerdict) return previewVerdict;

    // Use view mode verdict (calculated from saved values)
    return getViewModeVerdict();
  };

  const verdict = getVerdictConfig();

  // Government Value Framework - get the public sector perspective verdict
  const getGovernmentValueConfig = () => {
    const govValue = (viewModeMetrics as Record<string, unknown>).governmentValue as { verdict?: string; summary?: string; score?: number; factors?: unknown; label?: string } | null;
    const verdictMap: Record<string, VerdictConfigWithTextColor> = {
      'HIGH_VALUE': { bg: 'bg-blue-600', icon: <Shield className="h-5 w-5" />, label: 'High Public Value', textColor: 'text-blue-600' },
      'RECOMMENDED': { bg: 'bg-teal-600', icon: <CheckCircle className="h-5 w-5" />, label: 'Recommended', textColor: 'text-teal-600' },
      'MODERATE_VALUE': { bg: 'bg-amber-500', icon: <AlertTriangle className="h-5 w-5" />, label: 'Moderate Value', textColor: 'text-amber-500' },
      'LIMITED_VALUE': { bg: 'bg-orange-500', icon: <AlertTriangle className="h-5 w-5" />, label: 'Limited Value', textColor: 'text-orange-500' },
      'LOW_VALUE': { bg: 'bg-red-600', icon: <XCircle className="h-5 w-5" />, label: 'Low Value', textColor: 'text-red-600' },
    };

    if (!govValue) {
      const archetype = String((activeComputedFinancialModelRecord?.archetype)
        || (activeComputedFinancialModelRecord?.inputs as Record<string, unknown> | undefined)?.archetype
        || model.archetype
        || '');
      const roi = Number(viewModeMetrics.keyMetrics.roi5Year || 0);
      const npv = Number(viewModeMetrics.keyMetrics.npv || 0);
      const payback = Number(viewModeMetrics.keyMetrics.paybackMonths || 0);

      let score = 52;
      if (/government|crm|platform|smart city/i.test(archetype)) score += 18;
      if (/healthcare|education/i.test(archetype)) score += 22;
      if (roi >= 50) score += 12;
      else if (roi >= 20) score += 8;
      else if (roi >= 0) score += 4;
      if (npv > 0) score += 8;
      if (payback > 0 && payback <= 36) score += 8;
      else if (payback > 0 && payback <= 60) score += 4;
      score = Math.max(20, Math.min(95, Math.round(score)));

      const fallbackVerdict = score >= 85
        ? 'HIGH_VALUE'
        : score >= 70
        ? 'RECOMMENDED'
        : score >= 55
        ? 'MODERATE_VALUE'
        : score >= 40
        ? 'LIMITED_VALUE'
        : 'LOW_VALUE';
      const mappedFallback = verdictMap[fallbackVerdict]!;

      return {
        verdict: fallbackVerdict,
        summary: 'Derived from the current financial model because a cached public-value decision was not stored on this record.',
        score,
        factors: [],
        ...mappedFallback,
        label: mappedFallback.label,
      };
    }

    const mapped = verdictMap[govValue.verdict ?? ''] || { bg: 'bg-slate-500', icon: <AlertTriangle className="h-5 w-5" />, textColor: 'text-slate-600', label: '' };
    return {
      verdict: govValue.verdict,
      summary: govValue.summary,
      score: govValue.score,
      factors: govValue.factors,
      ...mapped,
      label: govValue.label || mapped.label || 'Calculating...'
    };
  };

  const governmentValue = getGovernmentValueConfig();

  // Active metrics: use preview when editing, view mode metrics otherwise
  const activeMetrics = isEditMode && previewMetrics ? previewMetrics.keyMetrics : viewModeMetrics.keyMetrics;

  // Active chart data: use preview when editing, cached server data otherwise
  const activeCashFlows = isEditMode && previewMetrics
    ? previewMetrics.cashFlows
    : (viewModeMetrics.cashFlows && viewModeMetrics.cashFlows.length > 0
        ? viewModeMetrics.cashFlows
        : model.cashFlows);
  const activeScenarios = isEditMode && previewMetrics
    ? previewMetrics.scenarios
    : (viewModeMetrics.scenarios && viewModeMetrics.scenarios.length > 0
        ? viewModeMetrics.scenarios
        : model.scenarios);

  // 5-Year Financial Projections - use cached server data when available
  const fiveYearProjections = useMemo(() => {
    // PRIORITY 1: Use cached server-computed projections in view mode
    if (!isEditMode && viewModeMetrics.fiveYearProjections) {
      return viewModeMetrics.fiveYearProjections;
    }

    // FALLBACK: Calculate locally (needed during edit mode or when no cached data)
    // Amortize Year 0 CapEx across Y1-Y5 for realistic margin calculation
    const y0Costs = activeCashFlows.find((cf: { year: number }) => cf.year === 0)?.costs ?? 0;
    const annualCapExAmort = y0Costs / 5;

    // Use driver model margins when available
    const driverMargins = computedDriverModel?.margins?.ebitdaMargin as number[] | undefined;

    const projections = activeCashFlows.map((cf: { year: number; benefits: number; costs: number; netCashFlow: number; cumulativeCashFlow: number }, idx: number) => {
      const year = cf.year;
      const revenue = cf.benefits; // Benefits represent value/revenue generated
      const costs = cf.costs;
      const netCashFlow = cf.netCashFlow;
      const cumulativeCashFlow = cf.cumulativeCashFlow;

      // Operating margin: prefer driver model EBITDA margins, else use amortized CapEx calc
      let operatingMargin: number;
      if (driverMargins && year > 0 && year <= driverMargins.length) {
        operatingMargin = driverMargins[year - 1]!;
      } else {
        const marginCosts = year > 0 ? costs + annualCapExAmort : costs;
        operatingMargin = revenue > 0 ? ((revenue - marginCosts) / revenue) * 100 : 0;
      }

      // Efficiency ratio: Revenue generated per unit cost
      const efficiencyRatio = costs > 0 ? revenue / costs : 0;

      // Year-over-year growth (from year 1 onwards)
      const prevBenefits = idx > 0 ? activeCashFlows[idx - 1]!.benefits : 0;
      const yoyGrowth = prevBenefits > 0 ? ((revenue - prevBenefits) / prevBenefits) * 100 : 0;

      return {
        year,
        yearLabel: year === 0 ? 'Initial Investment' : `Year ${year}`,
        revenue,
        costs,
        netCashFlow,
        cumulativeCashFlow,
        operatingMargin,
        efficiencyRatio,
        yoyGrowth,
        // Discounted values
        discountFactor: Math.pow(1 + displayValues.discountRate, -year),
        presentValue: netCashFlow * Math.pow(1 + displayValues.discountRate, -year)
      };
    });

    // Summary metrics
    const totalRevenue = projections.reduce((sum: number, p: { revenue: number }) => sum + p.revenue, 0);
    const totalCosts = projections.reduce((sum: number, p: { costs: number }) => sum + p.costs, 0);
    // Average margin from per-year margins (which already incorporate amortized CapEx / driver model)
    const operatingYearProjs = projections.filter((p: { year: number }) => p.year > 0);
    const avgOperatingMargin = operatingYearProjs.length > 0
      ? operatingYearProjs.reduce((sum: number, p: { operatingMargin: number }) => sum + p.operatingMargin, 0) / operatingYearProjs.length
      : 0;
    const avgEfficiencyRatio = totalCosts > 0 ? totalRevenue / totalCosts : 0;
    const cagr = projections.length > 2 && projections[1]!.revenue > 0 && projections[projections.length - 1]!.revenue > 0
      ? (Math.pow(projections[projections.length - 1]!.revenue / projections[1]!.revenue, 1 / 4) - 1) * 100
      : 0;

    return {
      yearly: projections,
      summary: {
        totalRevenue,
        totalCosts,
        avgOperatingMargin,
        avgEfficiencyRatio,
        cagr,
        totalPresentValue: projections.reduce((sum: number, p: { presentValue: number }) => sum + p.presentValue, 0)
      }
    };
  }, [isEditMode, viewModeMetrics.fiveYearProjections, activeCashFlows, computedDriverModel, displayValues.discountRate]);

  const normalizedFiveYearProjections = useMemo(() => {
    if (!fiveYearProjections) return null;
    if (!Array.isArray(fiveYearProjections)) return fiveYearProjections;

    // Amortize Year 0 CapEx for margin calc; use driver margins when available
    const y0CostItem = fiveYearProjections.find((p: FiveYearProjection) => (p.year ?? 0) === 0);
    const y0CostVal = y0CostItem?.costs ?? 0;
    const capExAmort = y0CostVal / 5;
    const driverM = computedDriverModel?.margins?.ebitdaMargin as number[] | undefined;

    const yearly = fiveYearProjections.map((proj, idx) => {
      const revenue = proj.benefits ?? 0;
      const costs = proj.costs ?? 0;
      const netCashFlow = proj.net ?? (revenue - costs);
      const cumulativeCashFlow = proj.cumulative ?? 0;
      const yr = proj.year ?? idx;
      let operatingMargin: number;
      if (driverM && yr > 0 && yr <= driverM.length) {
        operatingMargin = driverM[yr - 1]!;
      } else {
        const mc = yr > 0 ? costs + capExAmort : costs;
        operatingMargin = revenue > 0 ? ((revenue - mc) / revenue) * 100 : 0;
      }
      const efficiencyRatio = costs > 0 ? revenue / costs : 0;
      const prevRevenue = idx > 0 ? (fiveYearProjections[idx - 1]?.benefits ?? 0) : 0;
      const yoyGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;

      return {
        year: proj.year ?? idx,
        yearLabel: (proj.year ?? idx) === 0 ? 'Initial Investment' : `Year ${proj.year ?? idx}`,
        revenue,
        costs,
        netCashFlow,
        cumulativeCashFlow,
        operatingMargin,
        efficiencyRatio,
        yoyGrowth,
        discountFactor: 1,
        presentValue: netCashFlow,
      };
    });

    const totalRevenue = yearly.reduce((sum, p) => sum + p.revenue, 0);
    const totalCosts = yearly.reduce((sum, p) => sum + p.costs, 0);
    // Average margin from per-year margins (which already incorporate amortized CapEx / driver model)
    const operatingYears = yearly.filter(p => p.year > 0);
    const avgOperatingMargin = operatingYears.length > 0
      ? operatingYears.reduce((sum, p) => sum + p.operatingMargin, 0) / operatingYears.length
      : 0;
    const avgEfficiencyRatio = totalCosts > 0 ? totalRevenue / totalCosts : 0;
    const cagr = yearly.length > 2 && yearly[1]!.revenue > 0 && yearly[yearly.length - 1]!.revenue > 0
      ? (Math.pow(yearly[yearly.length - 1]!.revenue / yearly[1]!.revenue, 1 / 4) - 1) * 100
      : 0;

    return {
      yearly,
      summary: {
        totalRevenue,
        totalCosts,
        avgOperatingMargin,
        avgEfficiencyRatio,
        cagr,
        totalPresentValue: yearly.reduce((sum, p) => sum + p.presentValue, 0),
      }
    };
  }, [computedDriverModel, fiveYearProjections]);

  const fiveYearSummary = normalizedFiveYearProjections?.summary ?? {
    totalRevenue: 0,
    totalCosts: 0,
    avgOperatingMargin: 0,
    avgEfficiencyRatio: 0,
    cagr: 0,
    totalPresentValue: 0,
  };
  const fiveYearYearly = normalizedFiveYearProjections?.yearly ?? [];
  const stageViewEnabled = Boolean(storedFinancialViews?.pilot || storedFinancialViews?.full || stagedEconomics);
  const hidesGenericMaintenanceInput = stageViewEnabled && isDroneFinancialArchetype;
  const defaultFinancialView: FinancialViewMode = storedFinancialViews?.defaultView === 'pilot' ? 'pilot' : 'full';

  useEffect(() => {
    if (isFinancialViewControlled || !stageViewEnabled || hasUserSelectedFinancialViewRef.current) {
      return;
    }
    setActiveFinancialView(defaultFinancialView);
  }, [defaultFinancialView, isFinancialViewControlled, stageViewEnabled]);

  const currentFinancialView: FinancialViewMode = stageViewEnabled ? (controlledFinancialView ?? activeFinancialView) : 'full';
  const handleFinancialViewChange = (view: FinancialViewMode) => {
    hasUserSelectedFinancialViewRef.current = true;
    if (!isFinancialViewControlled) {
      setActiveFinancialView(view);
    }
    onActiveFinancialViewChange?.(view);
  };
  const editableInvestmentEnvelope = currentFinancialView === 'pilot' ? pilotCapitalProxy : editValues.initialInvestment;
  const editableInvestmentLabel = currentFinancialView === 'pilot' ? 'Pilot Mobilization Envelope (AED)' : 'Upfront Investment Envelope (AED)';
  const editableInvestmentHelperText = currentFinancialView === 'pilot'
    ? 'Pilot envelope maps back to the shared program investment using the backend pilot scope ratio.'
    : 'Approved upfront capital envelope before recurring operating years';

  const handleInvestmentEnvelopeChange = (nextValue: number) => {
    const normalizedValue = Number.isFinite(nextValue) ? nextValue : 0;
    if (currentFinancialView === 'pilot' && pilotCapitalRatio > 0) {
      setEditValues((prev) => ({ ...prev, initialInvestment: normalizedValue / pilotCapitalRatio }));
      return;
    }
    setEditValues((prev) => ({ ...prev, initialInvestment: normalizedValue }));
  };

  const selectedFinancialSnapshot = useMemo(() => {
    if (!stageViewEnabled) return null;

    const storedSnapshot = currentFinancialView === 'pilot' ? storedFinancialViews?.pilot : storedFinancialViews?.full;
    const mappedStoredSnapshot = storedSnapshot ? mapStoredFinancialViewSnapshot(storedSnapshot) : null;
    const previewSnapshot = previewUnifiedModel?.financialViews
      ? (currentFinancialView === 'pilot'
        ? previewUnifiedModel.financialViews.pilot
        : previewUnifiedModel.financialViews.full)
      : null;
    const mappedPreviewSnapshot = previewSnapshot ? mapStoredFinancialViewSnapshot(previewSnapshot as FinancialViewSnapshotData) : null;

    const baseSnapshot = mappedStoredSnapshot ?? (stagedEconomics
      ? buildStageFinancialSnapshot({
          mode: currentFinancialView,
          stage: currentFinancialView === 'pilot' ? stagedEconomics.pilotCase : stagedEconomics.scaleCase,
          upfrontInvestment: currentFinancialView === 'pilot' ? persistedPilotCapitalProxy : persistedFinancialInputs.totalInvestment,
          discountRate: persistedFinancialInputs.discountRate,
          variableCostDrivers: computedDriverModel?.costDrivers?.variableCostBreakdown,
        })
      : null);

    const persistedSnapshot = baseSnapshot
      ? applyOverridesToFinancialViewSnapshot(
          baseSnapshot,
          persistedCostOverrides,
          persistedBenefitOverrides,
          persistedFinancialInputs.discountRate,
        )
      : null;

    if (persistedSnapshot && !isEditMode) {
      return persistedSnapshot;
    }

    if (persistedSnapshot && isEditMode) {
      if (!hasFinancialEdits) {
        return persistedSnapshot;
      }

      const snapshotForEdit = mappedPreviewSnapshot
        ? mappedPreviewSnapshot
        : applyEditInputsToFinancialViewSnapshot({
            snapshot: persistedSnapshot,
            persistedInputs: persistedFinancialInputs,
            editValues,
            pilotCapitalRatio,
            domainAssumptions: archetypeData.domainAssumptions,
            ignoreMaintenanceScaling: hidesGenericMaintenanceInput,
          });

      return applyOverridesToFinancialViewSnapshot(
        snapshotForEdit,
        editValues.costOverrides,
        editValues.benefitOverrides,
        editValues.discountRate / 100,
      );
    }

    return baseSnapshot;
  }, [
    stageViewEnabled,
    storedFinancialViews,
    isEditMode,
    stagedEconomics,
    currentFinancialView,
    persistedPilotCapitalProxy,
    persistedFinancialInputs,
    persistedCostOverrides,
    persistedBenefitOverrides,
    pilotCapitalRatio,
    archetypeData.domainAssumptions,
    editValues,
    hasFinancialEdits,
    hidesGenericMaintenanceInput,
    previewUnifiedModel,
    computedDriverModel?.costDrivers?.variableCostBreakdown,
  ]);

  const stageSummarySnapshot = selectedFinancialSnapshot;
  const financialViewUpfrontInvestment = stageSummarySnapshot?.upfrontInvestment ?? currentUpfrontInvestment;
  const financialViewLifecycleCost = stageSummarySnapshot?.lifecycleCost ?? displayedLifecycleCost;
  const financialViewLifecycleBenefit = stageSummarySnapshot?.lifecycleBenefit ?? displayedLifecycleBenefit;
  const financialViewOperatingRunCost = stageSummarySnapshot?.operatingRunCost ?? displayedOperatingRunCost;
  const financialViewNetLifecycleValue = stageSummarySnapshot?.netLifecycleValue ?? displayedNetLifecycleValue;
  const financialViewNarrative = stageSummarySnapshot?.lifecycleNarrative ?? lifecycleNarrative;
  const financialViewCosts = stageSummarySnapshot?.costs ?? activeCosts;
  const financialViewBenefits = stageSummarySnapshot?.benefits ?? activeBenefits;
  const financialViewMetrics = stageSummarySnapshot?.metrics ?? activeMetrics;
  const financialViewScenarios = stageSummarySnapshot?.scenarios ?? activeScenarios;
  const financialViewSummary = stageSummarySnapshot?.summary ?? fiveYearSummary;
  const financialViewDisplayTotalCosts = financialViewLifecycleCost;
  const financialViewYearly = stageSummarySnapshot?.yearly ?? fiveYearYearly;
  const financialViewVerdict = stageSummarySnapshot?.verdict ?? verdict;
  const financialViewVerdictValue = stageSummarySnapshot?.verdictValue ?? (verdict as { verdict?: string }).verdict;
  const demandDrivers = computedDriverModel?.demandDrivers;
  const killSwitchMetrics = activeComputedFinancialModelRecord?.killSwitchMetrics as KillSwitchMetrics | undefined;
  const isPilotFinancialView = stageViewEnabled && currentFinancialView === 'pilot';
  const activeCostYearKeys = isPilotFinancialView ? PILOT_COST_YEAR_KEYS : COST_YEAR_KEYS;
  const activeBenefitYearKeys = isPilotFinancialView ? PILOT_BENEFIT_YEAR_KEYS : BENEFIT_YEAR_KEYS;
  const financialViewCostTitle = isPilotFinancialView ? 'Pilot Program Cost' : '5-Year Total Cost of Ownership';
  const financialViewBenefitTitle = isPilotFinancialView ? 'Pilot Benefits' : 'Projected Benefits';
  const financialViewNetValueTitle = isPilotFinancialView ? 'Net Pilot Value' : 'Net Lifecycle Value';
  const financialViewOpExTitle = isPilotFinancialView ? 'Pilot OpEx Run Rate' : '5-Year OpEx Ramp';
  const financialViewSummarySubtitle = isPilotFinancialView
    ? 'Capital outlay, pilot operating cost, and projected value during the pilot validation window'
    : 'Capital outlay, total cost of ownership, and projected value over a 5-year horizon';
  const financialViewBenefitSubtitle = isPilotFinancialView
    ? 'Revenue, savings & efficiency gains during the pilot validation window'
    : 'Revenue, savings & efficiency gains over 5 years';
  const financialViewCostTotalLabel = isPilotFinancialView ? 'Pilot Total' : '5-Year Total';
  const financialOverviewSubtitle = isPilotFinancialView
    ? 'Upfront investment and pilot-window financial analysis'
    : 'Upfront investment and 5-year lifecycle analysis';
  const visibleFinancialViewYearly = useMemo(
    () => (isPilotFinancialView
      ? financialViewYearly.filter((entry) => entry.year <= 1 || entry.revenue > 0 || entry.costs > 0 || entry.netCashFlow !== 0)
      : financialViewYearly),
    [isPilotFinancialView, financialViewYearly],
  );
  const activeStageEconomics = useMemo(() => {
    if (!stageViewEnabled || !stagedEconomics) {
      return null;
    }

    const baseStage = currentFinancialView === 'pilot' ? stagedEconomics.pilotCase : stagedEconomics.scaleCase;
    const operatingYears = visibleFinancialViewYearly.filter((entry) => entry.year > 0 && (entry.revenue > 0 || entry.costs > 0));
    const referenceYear = currentFinancialView === 'pilot'
      ? (operatingYears.find((entry) => entry.year === 1) ?? operatingYears[0])
      : (operatingYears[operatingYears.length - 1] ?? operatingYears[0]);

    if (!referenceYear || baseStage.annualDeliveries <= 0) {
      return baseStage;
    }

    const annualRevenue = referenceYear.revenue > 0 ? referenceYear.revenue : baseStage.annualRecognizedRevenue;
    const annualRunCost = referenceYear.costs > 0 ? referenceYear.costs : (baseStage.effectiveCostPerDelivery * baseStage.annualDeliveries);
    const recognizedRevenuePerDelivery = annualRevenue / baseStage.annualDeliveries;
    const effectiveCostPerDelivery = annualRunCost / baseStage.annualDeliveries;

    return {
      ...baseStage,
      recognizedAnnualDeliveries: baseStage.annualDeliveries,
      annualRecognizedRevenue: annualRevenue,
      annualRevenue,
      annualEbitda: referenceYear.netCashFlow,
      annualFixedCost: currentFinancialView === 'pilot' ? annualRunCost : baseStage.annualFixedCost,
      recognizedRevenuePerDelivery,
      realizedRevenuePerDelivery: recognizedRevenuePerDelivery,
      effectiveCostPerDelivery,
      contributionMarginPerDelivery: recognizedRevenuePerDelivery - effectiveCostPerDelivery,
    };
  }, [currentFinancialView, stageViewEnabled, stagedEconomics, visibleFinancialViewYearly]);
  const executiveDisplayNpv = financialViewMetrics.npv;
  const executiveDisplayRoi = financialViewLifecycleCost > 0
    ? ((financialViewLifecycleBenefit - financialViewLifecycleCost) / financialViewLifecycleCost) * 100
    : financialViewMetrics.roi5Year;
  const pilotRecognizedAnnualRevenue = activeStageEconomics?.annualRevenue ?? stagedEconomics?.pilotCase.annualRevenue;
  const pilotYearZero = visibleFinancialViewYearly.find((entry) => entry.year === 0);
  const pilotYearOne = visibleFinancialViewYearly.find((entry) => entry.year === 1);
  const pilotSuccessThreshold = findKillSwitchThreshold(killSwitchMetrics, 'delivery success rate');
  const pilotSuccessRate = parsePercentText(pilotSuccessThreshold?.current);
  const pilotScenarioDriverNotes = useMemo(() => {
    if (!activeStageEconomics) {
      return [
        { name: 'best', text: 'Stretch case assumes stronger demand conversion and better operating cost control than the base pilot.' },
        { name: 'base', text: 'Base case holds the canonical pilot revenue and cost baseline, while throughput and contracted demand remain assumptions still to be proved.' },
        { name: 'downside', text: 'Conservative case assumes weaker demand realization and higher run costs during the validation window.' },
      ] as const;
    }

    return [
      {
        name: 'best',
        text: `Stretch case assumes stronger demand conversion and better cost control than the current base of ${formatPreciseAed(activeStageEconomics.recognizedRevenuePerDelivery)} recognized revenue and ${formatPreciseAed(activeStageEconomics.effectiveCostPerDelivery)} cost per delivery.`,
      },
      {
        name: 'base',
        text: `Base case locks the canonical pilot baseline at ${formatPreciseAed(activeStageEconomics.recognizedRevenuePerDelivery)} recognized revenue and ${formatPreciseAed(activeStageEconomics.effectiveCostPerDelivery)} fully loaded cost, while ${activeStageEconomics.dailyDeliveriesPerDrone} deliveries/day and ${formatPercentage(activeStageEconomics.contractedVolumeShare * 100)} contracted demand remain assumptions that still require operating proof and secured commitments.`,
      },
      {
        name: 'downside',
        text: 'Conservative case assumes lower throughput, weaker demand conversion, and higher run costs during the validation window.',
      },
    ] as const;
  }, [activeStageEconomics]);
  const visibleScenarioCards = useMemo(
    () => financialViewScenarios.map((scenario) => (
      isPilotFinancialView && scenario.name === 'base'
        ? { ...scenario, npv: executiveDisplayNpv }
        : scenario
    )),
    [executiveDisplayNpv, financialViewScenarios, isPilotFinancialView],
  );
  const programScenarioBaseNpv = useMemo(
    () => financialViewScenarios.find((scenario) => scenario.name === 'base')?.npv ?? executiveDisplayNpv,
    [executiveDisplayNpv, financialViewScenarios],
  );
  const programRecoveryInvestmentBasis = Number.isFinite(financialViewUpfrontInvestment) && financialViewUpfrontInvestment > 0
    ? financialViewUpfrontInvestment
    : canonicalInvestment;
  const programInitiativeLabel = businessCaseData?.demandReport?.suggestedProjectName
    || businessCaseData?.suggestedProjectName
    || businessCaseData?.projectName
    || 'This program';
  const programValueRecoveryGap = !isPilotFinancialView && Number.isFinite(programScenarioBaseNpv) && programScenarioBaseNpv < 0
    ? Math.abs(programScenarioBaseNpv)
    : 0;
  const programValueRecoveryLevers = useMemo(
    () => (
      programValueRecoveryGap > 0
        ? buildTransformationValueLevers(programValueRecoveryGap, programRecoveryInvestmentBasis, programInitiativeLabel)
        : []
    ),
    [programInitiativeLabel, programRecoveryInvestmentBasis, programValueRecoveryGap],
  );
  const pilotBenefitsVsCostsChartData = useMemo(() => {
    if (!isPilotFinancialView) {
      return [] as { name: string; amount: number; fill: string }[];
    }

    return [
      {
        name: 'Initial Investment',
        amount: -(pilotYearZero?.costs ?? financialViewUpfrontInvestment),
        fill: '#64748b',
      },
      {
        name: 'Operating Cost',
        amount: -(pilotYearOne?.costs ?? Math.max(financialViewLifecycleCost - financialViewUpfrontInvestment, 0)),
        fill: '#f43f5e',
      },
      {
        name: 'Pilot Benefits',
        amount: financialViewLifecycleBenefit,
        fill: '#10b981',
      },
      {
        name: 'Net Value',
        amount: financialViewNetLifecycleValue,
        fill: financialViewNetLifecycleValue >= 0 ? '#2563eb' : '#dc2626',
      },
    ];
  }, [financialViewLifecycleBenefit, financialViewLifecycleCost, financialViewNetLifecycleValue, financialViewUpfrontInvestment, isPilotFinancialView, pilotYearOne, pilotYearZero]);
  const pilotCashFlowChartData = useMemo(() => {
    if (!isPilotFinancialView) {
      return [] as { name: string; net: number; cumulative: number }[];
    }

    const initialCost = -(pilotYearZero?.costs ?? financialViewUpfrontInvestment);
    const yearOneNet = pilotYearOne?.netCashFlow ?? (financialViewLifecycleBenefit - Math.max(financialViewLifecycleCost - financialViewUpfrontInvestment, 0));
    const finalCumulative = financialViewNetLifecycleValue;

    return [
      { name: 'Initial', net: initialCost, cumulative: initialCost },
      { name: 'Year 1', net: yearOneNet, cumulative: pilotYearOne?.cumulativeCashFlow ?? finalCumulative },
      { name: 'Pilot Total', net: finalCumulative, cumulative: finalCumulative },
    ];
  }, [financialViewLifecycleBenefit, financialViewLifecycleCost, financialViewNetLifecycleValue, financialViewUpfrontInvestment, isPilotFinancialView, pilotYearOne, pilotYearZero]);
  const pilotCostStructureChartData = useMemo(() => {
    if (!isPilotFinancialView) {
      return [] as { name: string; capex: number; opex: number; total: number }[];
    }

    const initialCapex = pilotYearZero?.costs ?? financialViewUpfrontInvestment;
    const yearOneOpEx = pilotYearOne?.costs ?? Math.max(financialViewLifecycleCost - financialViewUpfrontInvestment, 0);

    return [
      { name: 'Initial', capex: initialCapex, opex: 0, total: initialCapex },
      { name: 'Year 1', capex: 0, opex: yearOneOpEx, total: yearOneOpEx },
      { name: 'Pilot Total', capex: financialViewUpfrontInvestment, opex: Math.max(financialViewLifecycleCost - financialViewUpfrontInvestment, 0), total: financialViewLifecycleCost },
    ];
  }, [financialViewLifecycleCost, financialViewUpfrontInvestment, isPilotFinancialView, pilotYearOne, pilotYearZero]);
  const pilotPerformanceKpis = useMemo(() => {
    if (!isPilotFinancialView || !activeStageEconomics) {
      return [] as { label: string; value: string; detail: string; tone: string }[];
    }

    return [
      {
        label: 'Cost / Delivery',
        value: formatPreciseAed(activeStageEconomics.effectiveCostPerDelivery),
        detail: 'Fully loaded pilot cost per completed delivery',
        tone: 'text-red-600 dark:text-red-400',
      },
      {
        label: 'Recognized Revenue / Delivery',
        value: formatPreciseAed(activeStageEconomics.recognizedRevenuePerDelivery),
        detail: 'Recognized revenue after ramp and conversion loss',
        tone: 'text-emerald-600 dark:text-emerald-400',
      },
      {
        label: 'Unit Spread',
        value: formatPreciseAed(activeStageEconomics.recognizedRevenuePerDelivery - activeStageEconomics.effectiveCostPerDelivery),
        detail: 'Recognized revenue minus fully loaded cost',
        tone: activeStageEconomics.recognizedRevenuePerDelivery - activeStageEconomics.effectiveCostPerDelivery >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400',
      },
      {
        label: 'Success Rate',
        value: pilotSuccessRate != null ? formatPercentage(pilotSuccessRate) : '90% gate',
        detail: pilotSuccessRate != null ? 'Current delivery success against the pilot gate' : 'Kill-switch threshold for service reliability',
        tone: pilotSuccessRate != null && pilotSuccessRate >= 90 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
      },
      {
        label: 'Contracted Volume',
        value: formatPercentage(activeStageEconomics.contractedVolumeShare * 100),
        detail: 'Weak demand assumption unless secured commitments are actually evidenced',
        tone: 'text-slate-700 dark:text-slate-200',
      },
    ];
  }, [activeStageEconomics, isPilotFinancialView, pilotSuccessRate]);
  const currentDomainParams = isEditMode ? editValues.domainParams : displayValues.domainParams;
  const activeStageConfiguredThroughput = currentFinancialView === 'pilot'
    ? currentDomainParams['Pilot Deliveries per Drone']
    : currentDomainParams['Scale Deliveries per Drone'];
  const activeStageAssumptions = activeStageEconomics
    ? buildStageSpecificAssumptions(currentFinancialView, activeStageEconomics, activeStageConfiguredThroughput)
    : [];
  const pilotStageAssumptions = stagedEconomics
    ? buildStageSpecificAssumptions('pilot', stagedEconomics.pilotCase, currentDomainParams['Pilot Deliveries per Drone'])
    : [];
  const fullStageAssumptions = stagedEconomics
    ? buildStageSpecificAssumptions('full', stagedEconomics.scaleCase, currentDomainParams['Scale Deliveries per Drone'])
    : [];
  const normalizedGovernmentFactors = useMemo(
    () => normalizeGovernmentFactors(governmentValue?.factors as GovernmentValueFactor[] | undefined, financialViewMetrics, currentFinancialView),
    [governmentValue?.factors, financialViewMetrics, currentFinancialView],
  );
  const governmentValueAssessmentScore = normalizedGovernmentFactors.length > 0
    ? Math.round(normalizedGovernmentFactors.reduce((total, factor) => total + factor.score, 0) / normalizedGovernmentFactors.length)
    : governmentValue?.score;
  const activeFinancialViewLabel = getFinancialViewLabel(currentFinancialView);
  const activeStageSummary = useMemo(() => {
    if (isEditMode) {
      return '';
    }

    const gateSummary = typeof activeStageEconomics?.gateSummary === 'string'
      ? activeStageEconomics.gateSummary.trim()
      : '';

    if (currentFinancialView === 'pilot') {
      const opening = financialViewVerdictValue === 'DO_NOT_INVEST'
        ? 'Do not approve the pilot in its current form.'
        : 'Approve the pilot only as a controlled evidence-purchase experiment.';

      return [
        opening,
        gateSummary || 'Pilot economics are being judged as a bounded validation case, not as a full commercial return case. Hold expansion until safety, service quality, contracted demand, and unit economics satisfy the pilot exit gate.',
        'The pilot loss is acceptable only if it buys hard evidence on regulatory feasibility, true throughput ceiling, real demand conversion, and cost-curve trajectory that cannot be obtained in any cheaper way.',
      ].filter(Boolean).join(' ');
    }

    const opening = financialViewVerdictValue === 'INVEST'
      ? 'Proceed to full commercial rollout.'
      : financialViewVerdictValue === 'CONDITIONAL'
        ? 'Proceed conditionally to full commercial rollout.'
        : 'Defer full commercial rollout.';

    return [
      opening,
      gateSummary || 'Scale only when network economics, partner readiness, and operating controls remain inside the approved thresholds.',
    ].filter(Boolean).join(' ');
  }, [activeStageEconomics, currentFinancialView, financialViewVerdictValue, isEditMode]);

  // Notify parent of computed recommendation for alignment with Recommendations section
  useEffect(() => {
    if (onRecommendationComputed) {
      const summary = activeStageSummary || (isEditMode ? '' : model.recommendation.summary || '');

      onRecommendationComputed({
        verdict: financialViewVerdictValue || model.recommendation.verdict,
        label: financialViewVerdict.label,
        summary,
        roi: financialViewMetrics?.roi5Year,
        npv: financialViewMetrics?.npv,
        paybackMonths: financialViewMetrics?.paybackMonths,
        paybackYears: financialViewMetrics?.paybackMonths ? financialViewMetrics.paybackMonths / 12 : undefined,
        financialView: currentFinancialView,
        roiLabel: isPilotFinancialView ? 'Pilot ROI' : '5-Year ROI',
        recognizedAnnualRevenue: activeStageEconomics?.annualRecognizedRevenue,
        recognizedAnnualDeliveries: activeStageEconomics?.recognizedAnnualDeliveries,
        recognizedRevenuePerDelivery: activeStageEconomics?.recognizedRevenuePerDelivery,
        preRealizationRevenuePerDelivery: activeStageEconomics?.preRealizationRevenuePerDelivery,
        annualRevenue: activeStageEconomics?.annualRevenue,
        annualDeliveries: activeStageEconomics?.annualDeliveries,
        effectiveCostPerDelivery: activeStageEconomics?.effectiveCostPerDelivery,
        nominalRevenuePerDelivery: activeStageEconomics?.nominalRevenuePerDelivery,
      });
    }
  }, [
    activeStageSummary,
    viewModeMetrics,
    previewMetrics,
    isEditMode,
    financialViewVerdict.label,
    financialViewVerdictValue,
    financialViewMetrics,
    model.recommendation,
    onRecommendationComputed,
    currentFinancialView,
    isPilotFinancialView,
    activeStageEconomics?.annualRecognizedRevenue,
    activeStageEconomics?.recognizedAnnualDeliveries,
    activeStageEconomics?.recognizedRevenuePerDelivery,
    activeStageEconomics?.preRealizationRevenuePerDelivery,
    activeStageEconomics?.annualRevenue,
    activeStageEconomics?.annualDeliveries,
    activeStageEconomics?.effectiveCostPerDelivery,
    activeStageEconomics?.nominalRevenuePerDelivery,
  ]);

  return (
    <div className="space-y-6" data-testid="financial-model-dashboard">
      {/* Section Title */}
      <div className="flex items-center justify-between" data-testid="section-header">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">Financial Overview</h1>
            <p className="text-sm text-muted-foreground">{financialOverviewSubtitle}</p>
          </div>
          {isEditMode && unifiedSaveMode && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              Editing
            </Badge>
          )}
        </div>
        <div className="text-right" data-testid="initial-investment">
          <p className="text-xs font-medium text-muted-foreground">Upfront Investment</p>
          <p className="text-xl font-bold" data-testid="value-initial-investment">{formatFinancialLabelValue(financialViewUpfrontInvestment)}</p>
          {(model.initialInvestment.source || model.initialInvestment.methodology) && (
            <p className="text-[10px] text-muted-foreground">
              {[model.initialInvestment.source, model.initialInvestment.methodology].filter(Boolean).join(' | ')}
            </p>
          )}
        </div>
      </div>

      {/* Comprehensive Editable Fields Panel - Only shown in edit mode */}
      {isEditMode && (
        <div className="space-y-4" data-testid="financial-edit-panel">
          {/* Section 1: Investment Summary */}
          {!stageViewEnabled && (
            <Card className="border-2 border-primary/20">
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Investment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="py-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="initialInvestment">{editableInvestmentLabel}</Label>
                    <Input
                      id="initialInvestment"
                      type="number"
                      value={Number.isFinite(editableInvestmentEnvelope) ? editableInvestmentEnvelope : 0}
                      onChange={(e) => handleInvestmentEnvelopeChange(Number(e.target.value))}
                      data-testid="input-initial-investment"
                    />
                    <p className="text-xs text-muted-foreground">{editableInvestmentHelperText}</p>
                    {currentFinancialView === 'pilot' && (
                      <p className="text-xs text-muted-foreground">Full program envelope: {formatCurrency(editValues.initialInvestment, 'AED', true)}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aiRecommendedBudget">AI Recommended Budget (AED)</Label>
                    <Input
                      id="aiRecommendedBudget"
                      type="number"
                      value={editValues.aiRecommendedBudget}
                      onChange={(e) => setEditValues(prev => ({ ...prev, aiRecommendedBudget: Number(e.target.value) }))}
                      data-testid="input-ai-budget"
                    />
                    <p className="text-xs text-muted-foreground">Suggested budget with contingency buffer</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section 2: Shared Operating Drivers */}
          {stageViewEnabled ? (
            <Card className="border-2 border-amber-200 dark:border-amber-800">
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-amber-600" />
                  Shared Operating Drivers
                </CardTitle>
              </CardHeader>
              <CardContent className="py-3 space-y-5">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Edit one shared driver model here. These inputs feed both pilot and full-commercial calculations. The two snapshots below are read-only outputs from the same live model so you can compare both scenarios while editing.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Throughput is deliveries per drone per day. Recognized revenue is the decision KPI in AED per delivery; any gross yield inputs are bridge-only and should not be compared as competing business-case numbers.
                  </p>
                  {hidesGenericMaintenanceInput && (
                    <p className="text-xs text-muted-foreground">
                      Drone maintenance is already modeled inside per-flight and fixed operating costs. Use the operating drivers below such as Maintenance per Flight Hour, fleet size, throughput, and fare mix rather than a generic maintenance percentage.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Investment Envelope</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="initialInvestment">{editableInvestmentLabel}</Label>
                      <Input
                        id="initialInvestment"
                        type="number"
                        value={Number.isFinite(editableInvestmentEnvelope) ? editableInvestmentEnvelope : 0}
                        onChange={(e) => handleInvestmentEnvelopeChange(Number(e.target.value))}
                        data-testid="input-initial-investment"
                      />
                      <p className="text-xs text-muted-foreground">{editableInvestmentHelperText}</p>
                      {currentFinancialView === 'pilot' && (
                        <p className="text-xs text-muted-foreground">Full program envelope: {formatCurrency(editValues.initialInvestment, 'AED', true)}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="aiRecommendedBudget">AI Recommended Budget (AED)</Label>
                      <Input
                        id="aiRecommendedBudget"
                        type="number"
                        value={editValues.aiRecommendedBudget}
                        onChange={(e) => setEditValues(prev => ({ ...prev, aiRecommendedBudget: Number(e.target.value) }))}
                        data-testid="input-ai-budget"
                      />
                      <p className="text-xs text-muted-foreground">Suggested budget with contingency buffer</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Shared Financial Controls</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="adoptionRate">Adoption Rate (%)</Label>
                      <Input
                        id="adoptionRate"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={editValues.adoptionRate}
                        onChange={(e) => setEditValues(prev => ({ ...prev, adoptionRate: Number(e.target.value) }))}
                        data-testid="input-adoption-rate"
                      />
                    </div>
                    {!hidesGenericMaintenanceInput && (
                      <div className="space-y-2">
                        <Label htmlFor="maintenancePercent">Maintenance (%)</Label>
                        <Input
                          id="maintenancePercent"
                          type="number"
                          min="0"
                          max="50"
                          step="1"
                          value={editValues.maintenancePercent}
                          onChange={(e) => setEditValues(prev => ({ ...prev, maintenancePercent: Number(e.target.value) }))}
                          data-testid="input-maintenance"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="contingencyPercent">Contingency (%)</Label>
                      <Input
                        id="contingencyPercent"
                        type="number"
                        min="0"
                        max="50"
                        step="1"
                        value={editValues.contingencyPercent}
                        onChange={(e) => setEditValues(prev => ({ ...prev, contingencyPercent: Number(e.target.value) }))}
                        data-testid="input-contingency"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="discountRate">Discount Rate (%)</Label>
                      <Input
                        id="discountRate"
                        type="number"
                        min="0"
                        max="30"
                        step="0.5"
                        value={editValues.discountRate}
                        onChange={(e) => setEditValues(prev => ({ ...prev, discountRate: Number(e.target.value) }))}
                        data-testid="input-discount-rate"
                      />
                    </div>
                  </div>
                </div>

                {archetypeData.domainAssumptions && archetypeData.domainAssumptions.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Shared Domain Drivers</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {archetypeData.domainAssumptions.map((param) => (
                        <div key={param.name} className="space-y-2">
                          <Label htmlFor={`domain-${param.name}`}>
                            {param.name} ({param.unit})
                          </Label>
                          <Input
                            id={`domain-${param.name}`}
                            type="number"
                            value={editValues.domainParams[param.name] || 0}
                            onChange={(e) => updateDomainParam(param.name, Number(e.target.value))}
                            data-testid={`input-domain-${param.name.toLowerCase().replace(/\s+/g, '-')}`}
                          />
                          <p className="text-xs text-muted-foreground truncate" title={param.description}>
                            {param.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {!isEditMode && pilotStageAssumptions.length > 0 && (
                    <div className="space-y-3 rounded-lg border bg-background p-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Pilot Operating Snapshot</p>
                        <p className="text-xs text-muted-foreground">Derived from the current shared edit inputs for the pilot validation stage.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {pilotStageAssumptions.map((assumption) => (
                          <div key={`pilot-${assumption.name}`} className="rounded border bg-card p-3 text-center" title={assumption.description}>
                            <p className="text-xs text-muted-foreground truncate">{assumption.name}</p>
                            {assumption.credibility ? (
                              <div className="mt-1">
                                <Badge variant="outline" className={assumptionCredibilityClasses[assumption.credibility]}>{assumption.credibility}</Badge>
                              </div>
                            ) : null}
                            <p className="text-sm font-bold">{formatStageSpecificAssumptionValue(assumption.value, assumption.unit)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isEditMode && fullStageAssumptions.length > 0 && (
                    <div className="space-y-3 rounded-lg border bg-background p-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Full Commercial Operating Snapshot</p>
                        <p className="text-xs text-muted-foreground">Derived from the same shared inputs for the scaled commercial stage.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {fullStageAssumptions.map((assumption) => (
                          <div key={`full-${assumption.name}`} className="rounded border bg-card p-3 text-center" title={assumption.description}>
                            <p className="text-xs text-muted-foreground truncate">{assumption.name}</p>
                            {assumption.credibility ? (
                              <div className="mt-1">
                                <Badge variant="outline" className={assumptionCredibilityClasses[assumption.credibility]}>{assumption.credibility}</Badge>
                              </div>
                            ) : null}
                            <p className="text-sm font-bold">{formatStageSpecificAssumptionValue(assumption.value, assumption.unit)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="space-y-3 rounded-lg border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Cost Editing Mode</p>
                        <p className="text-xs text-muted-foreground">Edit cost lines here. Driver breakdown annual values now live in this workspace instead of being split across the lower presentation cards.</p>
                      </div>
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">{formatCurrency(financialViewDisplayTotalCosts, 'AED', true)}</span>
                    </div>
                    <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Primary editor</p>
                          <p className="mt-1 text-sm font-medium text-foreground">Unified cost workspace</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">What you can edit</p>
                          <p className="mt-1 text-sm text-foreground">Line totals, year timing, and breakdown annual values like energy, maintenance, handling, and service cost.</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active scope</p>
                          <p className="mt-1 text-sm text-foreground">{currentFinancialView === 'pilot' ? 'Pilot business case' : 'Full commercial business case'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[...financialViewCosts]
                        .map((cost: CostLineItem) => ({
                          ...cost,
                          _total: cost.year0 + cost.year1 + cost.year2 + cost.year3 + cost.year4 + cost.year5,
                        }))
                        .sort((a, b) => b._total - a._total)
                        .map((cost) => {
                          const overrideValue = editValues.costOverrides[cost.id];
                          const isOverridden = overrideValue != null;
                          const yearOverrides = materializeYearOverride(cost as unknown as Record<string, unknown>, overrideValue, activeCostYearKeys);
                          const breakdownComponents = materializeBreakdownComponents(cost as unknown as Record<string, unknown>, overrideValue, activeCostYearKeys);
                          const shareOfTotal = financialViewDisplayTotalCosts > 0 ? (cost._total / financialViewDisplayTotalCosts) * 100 : 0;
                          const costTypeLabel = cost.year0 > 0 && (cost.year1 + cost.year2 + cost.year3 + cost.year4 + cost.year5) <= 0
                            ? 'CapEx'
                            : cost.year0 <= 0 && (cost.year1 + cost.year2 + cost.year3 + cost.year4 + cost.year5) > 0
                              ? 'OpEx'
                              : 'CapEx + OpEx';

                          return (
                            <div key={`workspace-cost-${cost.id}`} className="rounded-xl border border-border/70 bg-card/95 p-4 shadow-sm">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-foreground">{cost.name}</p>
                                    {isOverridden && <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">Edited</Badge>}
                                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">{cost.subcategory || cost.category || 'Cost line'}</Badge>
                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{costTypeLabel}</Badge>
                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{shareOfTotal.toFixed(0)}% of {financialViewCostTotalLabel}</Badge>
                                  </div>
                                  {cost.description && <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{cost.description}</p>}
                                </div>
                                <div className="flex flex-col gap-3 xl:min-w-[520px] xl:items-end">
                                  <div className="flex flex-wrap items-end gap-3 xl:justify-end">
                                    <div className="w-36">
                                      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Line total</Label>
                                      <Input
                                        type="number"
                                        className={`mt-1 h-9 text-right text-sm tabular-nums ${isOverridden ? 'ring-1 ring-amber-400' : ''}`}
                                        value={Math.round(getOverrideTotalValue(overrideValue, cost as unknown as Record<string, unknown>, activeCostYearKeys))}
                                        onChange={(e) => {
                                          const next = Number(e.target.value);
                                          setEditValues(prev => ({
                                            ...prev,
                                            costOverrides: {
                                              ...prev.costOverrides,
                                              [cost.id]: scaleOverrideToTotal(
                                                cost as unknown as Record<string, unknown>,
                                                prev.costOverrides[cost.id],
                                                Number.isFinite(next) ? next : 0,
                                                activeCostYearKeys,
                                              ),
                                            },
                                          }));
                                        }}
                                        data-testid={`input-cost-${cost.id}`}
                                        aria-label={`Edit total for ${cost.name}`}
                                      />
                                    </div>
                                    {activeCostYearKeys.map((yearKey, yearIndex) => (
                                      <div key={`header-${cost.id}-${yearKey}`} className="w-[92px]">
                                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Year {yearIndex}</Label>
                                        <Input
                                          type="number"
                                          className="mt-1 h-9 text-right text-xs tabular-nums"
                                          value={Math.round(yearOverrides[yearKey] ?? 0)}
                                          onChange={(e) => {
                                            const next = Number(e.target.value);
                                            const nextYearValues = {
                                              ...materializeYearOverride(
                                                cost as unknown as Record<string, unknown>,
                                                editValues.costOverrides[cost.id],
                                                activeCostYearKeys,
                                              ),
                                              [yearKey]: Number.isFinite(next) ? next : 0,
                                            };
                                            setEditValues((prev) => ({
                                              ...prev,
                                              costOverrides: {
                                                ...prev.costOverrides,
                                                [cost.id]: buildOverrideFromYearValues(
                                                  cost as unknown as Record<string, unknown>,
                                                  prev.costOverrides[cost.id],
                                                  activeCostYearKeys,
                                                  nextYearValues,
                                                ),
                                              },
                                            }));
                                          }}
                                          data-testid={`input-cost-${cost.id}-${yearKey}`}
                                          aria-label={`Edit ${yearKey} for ${cost.name}`}
                                        />
                                      </div>
                                    ))}
                                    {isOverridden && (
                                      <button
                                        type="button"
                                        className="mb-2 text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2"
                                        onClick={() => {
                                          setEditValues(prev => {
                                            const next = { ...prev.costOverrides };
                                            delete next[cost.id];
                                            return { ...prev, costOverrides: next };
                                          });
                                        }}
                                        data-testid={`button-reset-cost-${cost.id}`}
                                      >
                                        Reset
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 rounded-lg border border-border/70 bg-background/80 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Driver breakdown</p>
                                  {breakdownComponents.length > 0 ? (
                                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                                      {breakdownComponents.map((component) => (
                                        <div key={`${cost.id}-${component.name}`} className="rounded-md border border-border/70 bg-background p-3">
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/85">{component.name}</p>
                                              {typeof component.perDelivery === 'number' && Number.isFinite(component.perDelivery) && (
                                                <p className="mt-1 text-[11px] text-muted-foreground">{formatCurrency(component.perDelivery, 'AED', true)} / delivery</p>
                                              )}
                                            </div>
                                            <span className="text-[10px] text-muted-foreground">Annual value</span>
                                          </div>
                                          <Input
                                            type="number"
                                            className="mt-2 h-8 text-right text-xs tabular-nums"
                                            value={Math.round(component.annualValue)}
                                            onChange={(e) => {
                                              const next = Number(e.target.value);
                                              setEditValues((prev) => ({
                                                ...prev,
                                                costOverrides: {
                                                  ...prev.costOverrides,
                                                  [cost.id]: updateBreakdownComponentOverride(
                                                    cost as unknown as Record<string, unknown>,
                                                    prev.costOverrides[cost.id],
                                                    activeCostYearKeys,
                                                    component.name,
                                                    Number.isFinite(next) ? next : 0,
                                                  ),
                                                },
                                              }));
                                            }}
                                            data-testid={`input-cost-${cost.id}-breakdown-${component.name}`}
                                            aria-label={`Edit ${component.name} annual value for ${cost.name}`}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-3 text-sm text-muted-foreground">No driver-level breakdown is available for this cost line.</p>
                                  )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Editable Benefit Breakdown</p>
                        <p className="text-xs text-muted-foreground">Adjust the active value drivers from the same shared financial workspace.</p>
                      </div>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(financialViewSummary.totalRevenue, 'AED', true)}</span>
                    </div>
                    <div className="space-y-2">
                      {[...financialViewBenefits]
                        .map((benefit: BenefitLineItem) => ({
                          ...benefit,
                          _total: benefit.year1 + benefit.year2 + benefit.year3 + benefit.year4 + benefit.year5,
                        }))
                        .sort((a, b) => b._total - a._total)
                        .map((benefit) => {
                          const overrideValue = editValues.benefitOverrides[benefit.id];
                          const isOverridden = overrideValue != null;
                          const pct = financialViewSummary.totalRevenue > 0 ? (benefit._total / financialViewSummary.totalRevenue) * 100 : 0;
                          return (
                            <div key={`workspace-benefit-${benefit.id}`} className="rounded-lg border border-border/70 bg-card p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium">{benefit.name}</p>
                                    {isOverridden && <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">Edited</Badge>}
                                  </div>
                                  {benefit.description && <p className="mt-1 text-[11px] text-muted-foreground">{benefit.description}</p>}
                                  <p className="mt-1 text-[11px] text-muted-foreground">{pct.toFixed(0)}% of total benefits</p>
                                </div>
                                <div className="w-36 space-y-2">
                                  <Input
                                    type="number"
                                    className={`h-9 text-sm text-right tabular-nums ${isOverridden ? 'ring-1 ring-amber-400' : ''}`}
                                    value={Math.round(getOverrideTotalValue(overrideValue, benefit as unknown as Record<string, unknown>, activeBenefitYearKeys))}
                                    onChange={(e) => {
                                      const next = Number(e.target.value);
                                      setEditValues(prev => ({
                                        ...prev,
                                        benefitOverrides: {
                                          ...prev.benefitOverrides,
                                          [benefit.id]: scaleOverrideToTotal(
                                            benefit as unknown as Record<string, unknown>,
                                            prev.benefitOverrides[benefit.id],
                                            Number.isFinite(next) ? next : 0,
                                            activeBenefitYearKeys,
                                          ),
                                        },
                                      }));
                                    }}
                                    data-testid={`workspace-benefit-${benefit.id}`}
                                    aria-label={`Edit total for ${benefit.name}`}
                                  />
                                  {isOverridden && (
                                    <button
                                      type="button"
                                      className="w-full text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2"
                                      onClick={() => {
                                        setEditValues(prev => {
                                          const next = { ...prev.benefitOverrides };
                                          delete next[benefit.id];
                                          return { ...prev, benefitOverrides: next };
                                        });
                                      }}
                                    >
                                      Reset
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-2 border-blue-200 dark:border-blue-800">
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-600" />
                    {`Key Assumptions: ${model.archetype}`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-3">
                  {hidesGenericMaintenanceInput && (
                    <p className="mb-4 text-xs text-muted-foreground">
                      Pilot maintenance is already modeled inside per-flight and fixed operating costs. For drone scenarios, adjust operating realism using the driver inputs below such as Maintenance per Flight Hour, fleet size, throughput, and fare mix rather than a generic capital maintenance percentage.
                    </p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="adoptionRate">Adoption Rate (%)</Label>
                      <Input
                        id="adoptionRate"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={editValues.adoptionRate}
                        onChange={(e) => setEditValues(prev => ({ ...prev, adoptionRate: Number(e.target.value) }))}
                        data-testid="input-adoption-rate"
                      />
                    </div>
                    {!hidesGenericMaintenanceInput && (
                      <div className="space-y-2">
                        <Label htmlFor="maintenancePercent">Maintenance (%)</Label>
                        <Input
                          id="maintenancePercent"
                          type="number"
                          min="0"
                          max="50"
                          step="1"
                          value={editValues.maintenancePercent}
                          onChange={(e) => setEditValues(prev => ({ ...prev, maintenancePercent: Number(e.target.value) }))}
                          data-testid="input-maintenance"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="contingencyPercent">Contingency (%)</Label>
                      <Input
                        id="contingencyPercent"
                        type="number"
                        min="0"
                        max="50"
                        step="1"
                        value={editValues.contingencyPercent}
                        onChange={(e) => setEditValues(prev => ({ ...prev, contingencyPercent: Number(e.target.value) }))}
                        data-testid="input-contingency"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="discountRate">Discount Rate (%)</Label>
                      <Input
                        id="discountRate"
                        type="number"
                        min="0"
                        max="30"
                        step="0.5"
                        value={editValues.discountRate}
                        onChange={(e) => setEditValues(prev => ({ ...prev, discountRate: Number(e.target.value) }))}
                        data-testid="input-discount-rate"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {archetypeData.domainAssumptions && archetypeData.domainAssumptions.length > 0 && (
                <Card className="border-2 border-amber-200 dark:border-amber-800">
                  <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-amber-600" />
                      Domain-Specific Parameters
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-3">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {archetypeData.domainAssumptions.map((param) => (
                        <div key={param.name} className="space-y-2">
                          <Label htmlFor={`domain-${param.name}`}>
                            {param.name} ({param.unit})
                          </Label>
                          <Input
                            id={`domain-${param.name}`}
                            type="number"
                            value={editValues.domainParams[param.name] || 0}
                            onChange={(e) => updateDomainParam(param.name, Number(e.target.value))}
                            data-testid={`input-domain-${param.name.toLowerCase().replace(/\s+/g, '-')}`}
                          />
                          <p className="text-xs text-muted-foreground truncate" title={param.description}>
                            {param.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Live Auto-Calculated Metrics Preview */}
          <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Live Preview - Auto-Calculated Metrics</span>
              </div>
              <div className={`grid gap-4 text-center ${isPilotFinancialView ? 'grid-cols-3' : 'grid-cols-3'}`}>
                <div>
                  <p className="text-xs text-muted-foreground">NPV</p>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(executiveDisplayNpv, 'AED', true)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ROI</p>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatPercentage(executiveDisplayRoi, 0)}
                  </p>
                </div>
                {isPilotFinancialView ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Pilot Scope</p>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">Validation Only</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground">Payback</p>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatPaybackPeriod(financialViewMetrics.paybackMonths)}
                    </p>
                  </div>
                )}
              </div>
              <p className="text-xs text-center text-emerald-600 dark:text-emerald-500 mt-2">
                Updates in real-time as you modify inputs above
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Executive Summary Hero - Dual Verdict System */}
      <Card className="border-0 overflow-hidden" data-testid="executive-hero">
        <CardContent className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Left: Financial Verdict */}
            <div className={`${financialViewVerdict.bg} text-white p-6 space-y-4`}>
              <div className="flex items-center gap-3">
                <DollarSign className="h-6 w-6" />
                <div>
                  <p className="text-xs opacity-80 uppercase tracking-wide">Financial Analysis</p>
                  <h2 className="text-2xl font-bold">{financialViewVerdict.label}</h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {financialViewVerdict.icon}
                <p className="text-sm opacity-90">
                  {isPilotFinancialView ? 'Pilot Validation Perspective' : 'Commercial Investment Perspective'}
                  {isEditMode && <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded">Live Preview</span>}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 rounded bg-white/10">
                  <p className="text-xs opacity-70">NPV</p>
                  <p className="font-semibold">{formatCurrency(executiveDisplayNpv, 'AED', true)}</p>
                </div>
                <div className="p-2 rounded bg-white/10">
                  <p className="text-xs opacity-70">ROI</p>
                  <p className="font-semibold">{formatPercentage(executiveDisplayRoi, 0)}</p>
                </div>
              </div>
            </div>

            {/* Right: Government Value Verdict */}
            <div className={`${governmentValue ? governmentValue.bg : 'bg-slate-600'} text-white p-6 space-y-4`}>
              <div className="flex items-center gap-3">
                <Building2 className="h-6 w-6" />
                <div>
                  <p className="text-xs opacity-80 uppercase tracking-wide">Government Value</p>
                  <h2 className="text-2xl font-bold">{governmentValue?.label || 'Calculating...'}</h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {governmentValue?.icon || <Shield className="h-5 w-5" />}
                <p className="text-sm opacity-90">
                  Public Sector Perspective
                  {governmentValueAssessmentScore != null && <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded">Score: {governmentValueAssessmentScore}%</span>}
                </p>
              </div>
              {governmentValue && (
                <div className="text-xs opacity-90 leading-relaxed line-clamp-3">
                  {governmentValue.summary}
                </div>
              )}
            </div>
          </div>

          {/* Bottom: Key Metrics & Archetype */}
          <div className="bg-slate-900 text-white p-4">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/10">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs opacity-70">Project Archetype</p>
                  <p className="font-semibold text-sm" data-testid="archetype-name">{model.archetype}</p>
                </div>
              </div>
              {isPilotFinancialView ? (
                <>
                  <div className="p-2 rounded-lg bg-white/10 text-center" data-testid="metric-pilot-horizon">
                    <p className="text-xs opacity-70">Pilot Horizon</p>
                    <p className="font-bold">{activeStageEconomics?.horizon || 'Validation Window'}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-white/10 text-center" data-testid="metric-unit-cost">
                    <p className="text-xs opacity-70">Unit Cost</p>
                    <p className="font-bold">{activeStageEconomics ? formatCurrency(activeStageEconomics.effectiveCostPerDelivery, 'AED', true) : 'N/A'}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-white/10 text-center" data-testid="metric-contracted-volume">
                    <p className="text-xs opacity-70">Contracted Volume</p>
                    <p className="font-bold">{activeStageEconomics ? formatPercentage(activeStageEconomics.contractedVolumeShare * 100) : 'N/A'}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 rounded-lg bg-white/10 text-center" data-testid="metric-payback">
                    <p className="text-xs opacity-70">Payback</p>
                    <p className="font-bold">{formatPaybackPeriod(financialViewMetrics.paybackMonths)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-white/10 text-center" data-testid="metric-irr">
                    <p className="text-xs opacity-70">IRR</p>
                    <p className="font-bold">{formatPercentage((financialViewMetrics as Record<string, number>).irr || 0, 1)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-white/10 text-center" data-testid="metric-breakeven">
                    <p className="text-xs opacity-70">Break-Even</p>
                    <p className="font-bold">{formatPaybackPeriod(financialViewMetrics.paybackMonths)}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Government Value Factors - Expandable Details */}
      {governmentValue && normalizedGovernmentFactors.length > 0 && (
        <Card data-testid="government-value-factors">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Government Value Assessment
              <Badge variant="outline" className="ml-auto">{governmentValueAssessmentScore}% Score</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {normalizedGovernmentFactors.map((factor: GovernmentValueFactor) => (
                <div key={factor.name} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">{factor.name}</p>
                    <Badge variant={factor.score >= 70 ? "default" : factor.score >= 50 ? "secondary" : "destructive"} className="text-xs">
                      {factor.score}%
                    </Badge>
                  </div>
                  <Progress value={factor.score} className="h-1.5 mb-2" />
                  <p className="text-xs text-muted-foreground line-clamp-2">{normalizeGovernmentFactorRationale(factor.rationale)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stagedEconomics && (
        <Card className="border-slate-200 dark:border-slate-800" data-testid="financial-model-stage-tabs">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Financial Model Views
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">These tabs switch between the backend-generated pilot view and the backend-generated full commercial view. Edit mode stays on the active tab and recalculates that view from the current planning inputs.</p>
              </div>
              <Badge variant="outline" className={stagedEconomics.expansionDecision === 'GO' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300'}>
                {stagedEconomics.expansionDecision === 'GO' ? 'Expansion Approved' : 'Pilot Validation Only'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs
              value={currentFinancialView}
              onValueChange={(value) => {
                handleFinancialViewChange(value as FinancialViewMode);
              }}
              className="space-y-4"
            >
              {showStageTabs && (
                <TabsList className="grid w-full grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100 p-1.5 dark:border-slate-800 dark:bg-slate-950/70">
                  <TabsTrigger
                    value="pilot"
                    className="rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-slate-600 transition-all data-[state=active]:border-amber-300 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-900 data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:border-amber-700 dark:data-[state=active]:bg-amber-950/60 dark:data-[state=active]:text-amber-100"
                  >
                    Pilot Financial Model
                  </TabsTrigger>
                  <TabsTrigger
                    value="full"
                    className="rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-slate-600 transition-all data-[state=active]:border-emerald-300 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-900 data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:border-emerald-700 dark:data-[state=active]:bg-emerald-950/60 dark:data-[state=active]:text-emerald-100"
                  >
                    Scale Hypothesis (Reference)
                  </TabsTrigger>
                </TabsList>
              )}

              <TabsContent value="pilot" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pilot Mobilization Envelope</p>
                    <p className="mt-2 text-xl font-bold text-amber-700 dark:text-amber-300">{formatCurrency(financialViewUpfrontInvestment, 'AED', true)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Proxy from backend pilot fleet scope against upfront investment</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pilot Annual Revenue</p>
                    <p className="mt-2 text-xl font-bold">{formatCurrency(pilotRecognizedAnnualRevenue ?? 0, 'AED', true)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Active pilot-stage revenue run-rate</p>
                    <p className="text-[11px] text-foreground/80 mt-2">Pilot benefits ({formatCurrency(financialViewLifecycleBenefit, 'AED', true)}) represent only realized and attributable value after ramp, conversion loss, and excluded non-cash or non-recurring components from total recognized revenue of {formatCurrency(pilotRecognizedAnnualRevenue ?? 0, 'AED', true)}.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pilot Program Cost</p>
                    <p className="mt-2 text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(financialViewLifecycleCost, 'AED', true)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Total cost across the active pilot validation window</p>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pilot Net Value</p>
                    <p className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(financialViewNetLifecycleValue, 'AED', true)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Pilot benefits less pilot program cost</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-muted/30 border">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pilot Operating Design</p>
                    <p className="mt-2 text-sm font-medium">{stagedEconomics.pilotCase.partneringStrategy}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Deliveries / drone / day</p>
                        <p className="font-semibold">{stagedEconomics.pilotCase.dailyDeliveriesPerDrone}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Annual deliveries</p>
                        <p className="font-semibold">{formatCompactNumber(stagedEconomics.pilotCase.annualDeliveries)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] text-foreground/80">{stagedEconomics.pilotCase.dailyDeliveriesPerDrone} deliveries/day currently rests on roughly {Math.round(stagedEconomics.pilotCase.annualDeliveries / Math.max(1, stagedEconomics.pilotCase.fleetSize * stagedEconomics.pilotCase.dailyDeliveriesPerDrone))} pilot operating days{demandDrivers?.fleetAvailability != null ? `, ${Math.round(demandDrivers.fleetAvailability * 100)}% fleet availability` : ''}{demandDrivers?.weatherRegulationFactor != null ? `, and ${Math.round(demandDrivers.weatherRegulationFactor * 100)}% weather-adjusted availability` : ''}. If operated across a 12-hour dispatch day, that is roughly one completed drop every {Math.round((12 * 60) / Math.max(1, stagedEconomics.pilotCase.dailyDeliveriesPerDrone))} minutes.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30 border">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pilot Gate</p>
                    <p className="mt-2 text-sm text-foreground/90">{stagedEconomics.pilotCase.gateSummary}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="full" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upfront Investment</p>
                    <p className="mt-2 text-xl font-bold">{formatFinancialLabelValue(financialViewUpfrontInvestment)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Program-level capital envelope</p>
                  </div>
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">5-Year TCO</p>
                    <p className="mt-2 text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(financialViewLifecycleCost, 'AED', true)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Full commercial lifecycle cost</p>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">5-Year Benefits</p>
                    <p className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(financialViewLifecycleBenefit, 'AED', true)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Backend modeled full commercial value</p>
                  </div>
                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reference Scale Cost / Delivery</p>
                    <p className="mt-2 text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(stagedEconomics.scaleCase.effectiveCostPerDelivery, 'AED', true)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Scale hypothesis benchmark, not part of the current pilot approval decision</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-muted/30 border">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reference Scale Operating Design</p>
                    <p className="mt-2 text-sm font-medium">{stagedEconomics.scaleCase.partneringStrategy}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Deliveries / drone / day</p>
                        <p className="font-semibold">{stagedEconomics.scaleCase.dailyDeliveriesPerDrone}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Annual deliveries</p>
                        <p className="font-semibold">{formatCompactNumber(stagedEconomics.scaleCase.annualDeliveries)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30 border">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scale Hypothesis Controls</p>
                    <p className="mt-2 text-sm text-foreground/90">{stagedEconomics.enforcementSummary}</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* ── Investment & Lifecycle Summary ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] gap-6">
        <Card data-testid="investment-summary" className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Investment &amp; Lifecycle Summary
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {financialViewSummarySubtitle}
                </p>
              </div>
              {isEditMode && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">Editable</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Primary Financial Metrics */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="totals-grid">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800" data-testid="upfront-investment">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-slate-500" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upfront Investment</p>
                </div>
                <p className="text-xl font-bold text-slate-700 dark:text-slate-200" data-testid="value-upfront-investment">{formatFinancialLabelValue(financialViewUpfrontInvestment)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Initial capital required before operations begin</p>
              </div>
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40" data-testid="total-cost">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{financialViewCostTitle}</p>
                </div>
                <p className="text-xl font-bold text-red-600 dark:text-red-400" data-testid="value-total-cost">{formatCurrency(financialViewLifecycleCost, 'AED', true)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{financialViewNarrative}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-background/70 border border-border/60 px-2.5 py-2">
                    <p className="text-muted-foreground">Upfront CapEx</p>
                    <p className="font-semibold text-foreground">{formatCurrency(financialViewUpfrontInvestment, 'AED', true)}</p>
                  </div>
                  <div className="rounded-lg bg-background/70 border border-border/60 px-2.5 py-2">
                    <p className="text-muted-foreground">{financialViewOpExTitle}</p>
                    <p className="font-semibold text-foreground">{formatCurrency(financialViewOperatingRunCost, 'AED', true)}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40" data-testid="total-benefit">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{financialViewBenefitTitle}</p>
                </div>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="value-total-benefit">{formatCurrency(financialViewLifecycleBenefit, 'AED', true)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{financialViewBenefitSubtitle}</p>
                {isPilotFinancialView && (
                  <p className="text-[11px] text-foreground/80 mt-2">Pilot benefits ({formatCurrency(financialViewLifecycleBenefit, 'AED', true)}) represent only realized and attributable value after ramp, conversion loss, and excluded non-cash or non-recurring components from total recognized revenue of {formatCurrency(pilotRecognizedAnnualRevenue ?? 0, 'AED', true)}.</p>
                )}
              </div>
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40" data-testid="net-value">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{financialViewNetValueTitle}</p>
                </div>
                <p className={`text-xl font-bold ${financialViewNetLifecycleValue >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`} data-testid="value-net">
                  {formatCurrency(financialViewNetLifecycleValue, 'AED', true)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Total benefits minus total cost in the active financial window</p>
              </div>
            </div>

            {/* Cost & Benefit Drivers */}
            <div className="space-y-3">
              {/* Cost Drivers — sorted by lifecycle total, CapEx/OpEx split */}
              <div className="space-y-3 rounded-xl border bg-muted/30 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="text-sm font-semibold">Cost Breakdown</p>
                      <p className="text-[11px] text-muted-foreground">
                        {isEditMode
                          ? `Editing the ${currentFinancialView === 'pilot' ? 'pilot' : 'full commercial'} cost lines.`
                          : `Reading the ${currentFinancialView === 'pilot' ? 'pilot' : 'full commercial'} cost picture as CapEx, OpEx, and driver-level cost components.`}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">{formatCurrency(financialViewDisplayTotalCosts, 'AED', true)}</span>
                </div>
                {(() => {
                  const sorted = [...financialViewCosts].map((c: CostLineItem) => ({
                    ...c,
                    _total: c.year0 + c.year1 + c.year2 + c.year3 + c.year4 + c.year5,
                    _capex: c.year0,
                    _opex: c.year1 + c.year2 + c.year3 + c.year4 + c.year5,
                  })).sort((a, b) => b._total - a._total);
                  const capexTotal = sorted.reduce((s, c) => s + c._capex, 0);
                  const opexTotal = sorted.reduce((s, c) => s + c._opex, 0);
                  return (
                    <>
                      <div className="rounded-xl border border-border/70 bg-background/95 shadow-sm">
                        <div className="grid grid-cols-2 gap-2 border-b border-border/60 bg-slate-50/90 px-3 py-2.5 text-xs sm:grid-cols-4 dark:bg-slate-950/40">
                          <div className="rounded-lg border border-red-200/70 bg-red-50 px-3 py-2 dark:border-red-900/60 dark:bg-red-950/20">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-red-700/80 dark:text-red-300/80">CapEx</p>
                            <p className="font-bold text-red-600 dark:text-red-400 tabular-nums">{formatCurrency(capexTotal, 'AED', true)}</p>
                          </div>
                          <div className="rounded-lg border border-amber-200/70 bg-amber-50 px-3 py-2 dark:border-amber-900/60 dark:bg-amber-950/20">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-800/80 dark:text-amber-300/80">OpEx</p>
                            <p className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatCurrency(opexTotal, 'AED', true)}</p>
                          </div>
                          <div className="rounded-lg border border-slate-200/70 bg-background px-3 py-2 dark:border-slate-800/80 dark:bg-slate-950/30">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Cost</p>
                            <p className="font-bold tabular-nums">{formatCurrency(financialViewDisplayTotalCosts, 'AED', true)}</p>
                          </div>
                          <div className="rounded-lg border border-slate-200/70 bg-background px-3 py-2 dark:border-slate-800/80 dark:bg-slate-950/30">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active View</p>
                            <p className="font-medium">{currentFinancialView === 'pilot' ? 'Pilot' : 'Full Commercial'}</p>
                          </div>
                        </div>

                        <div className="space-y-3 p-3">
                          {sorted.map((cost) => {
                            const overrideValue = editValues.costOverrides[cost.id];
                            const isOverridden = isEditMode && overrideValue != null;
                            const breakdownComponents = materializeBreakdownComponents(cost as unknown as Record<string, unknown>, overrideValue, activeCostYearKeys);
                            const shareOfTotal = financialViewDisplayTotalCosts > 0 ? (cost._total / financialViewDisplayTotalCosts) * 100 : 0;
                            const costTypeLabel = cost._capex > 0 && cost._opex <= 0
                              ? 'CapEx'
                              : cost._capex <= 0 && cost._opex > 0
                                ? 'OpEx'
                                : 'CapEx + OpEx';

                            return (
                              <div key={cost.id} className="rounded-xl border border-border/70 bg-card/90 p-4 shadow-sm">
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1 space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-base font-semibold text-foreground">{cost.name}</span>
                                        {isOverridden && <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">Edited</Badge>}
                                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">{cost.subcategory || cost.category || 'Cost line'}</Badge>
                                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{costTypeLabel}</Badge>
                                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{shareOfTotal.toFixed(0)}% of {financialViewCostTotalLabel}</Badge>
                                      </div>
                                      {cost.description && <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{cost.description}</p>}
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lifecycle total</span>
                                      {isEditMode ? (
                                        <div className="flex items-center gap-2">
                                          <Input
                                            type="number"
                                            className={`h-9 w-40 text-right text-sm tabular-nums ${isOverridden ? 'ring-1 ring-amber-400' : ''}`}
                                            value={Math.round(getOverrideTotalValue(overrideValue, cost as unknown as Record<string, unknown>, activeCostYearKeys))}
                                            onChange={(e) => {
                                              const next = Number(e.target.value);
                                              setEditValues(prev => ({
                                                ...prev,
                                                costOverrides: {
                                                  ...prev.costOverrides,
                                                  [cost.id]: scaleOverrideToTotal(
                                                    cost as unknown as Record<string, unknown>,
                                                    prev.costOverrides[cost.id],
                                                    Number.isFinite(next) ? next : 0,
                                                    activeCostYearKeys,
                                                  ),
                                                },
                                              }));
                                            }}
                                            data-testid={`input-cost-breakdown-${cost.id}`}
                                            aria-label={`Edit total for ${cost.name}`}
                                          />
                                          {isOverridden && (
                                            <button
                                              type="button"
                                              className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                              onClick={() => {
                                                setEditValues(prev => {
                                                  const next = { ...prev.costOverrides };
                                                  delete next[cost.id];
                                                  return { ...prev, costOverrides: next };
                                                });
                                              }}
                                              data-testid={`button-reset-cost-breakdown-${cost.id}`}
                                            >
                                              Reset
                                            </button>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="inline-flex min-w-[140px] justify-end rounded-md bg-red-50 px-2.5 py-1 text-sm font-semibold text-red-700 tabular-nums dark:bg-red-950/30 dark:text-red-300">
                                          {formatCurrency(cost._total, 'AED', true)}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {breakdownComponents.length > 0 && (
                                    <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                                      {breakdownComponents.map((component) => (
                                        <div key={component.name} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/85">{component.name}</p>
                                              {typeof component.perDelivery === 'number' && Number.isFinite(component.perDelivery) && (
                                                <p className="mt-1 text-[11px] text-muted-foreground">{formatCurrency(component.perDelivery, 'AED', true)} / delivery</p>
                                              )}
                                            </div>
                                            <p className="text-xs font-semibold tabular-nums text-muted-foreground">{formatCurrency(component.annualValue, 'AED', true)}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {isEditMode && (
                                    <p className="text-[11px] text-muted-foreground">Edited in Cost Editing Mode above.</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Benefit Drivers — sorted by lifecycle total */}
              <div className="space-y-3 rounded-xl border bg-muted/30 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <div>
                      <p className="text-sm font-semibold">Benefit Breakdown</p>
                      <p className="text-[11px] text-muted-foreground">Projected value drivers across the same active financial view.</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(financialViewSummary.totalRevenue, 'AED', true)}</span>
                </div>
                <div className="rounded-lg border border-emerald-200/60 bg-background/90 p-2.5 dark:border-emerald-900/40">
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    <div className="rounded-lg border border-emerald-200/70 bg-emerald-50 px-3 py-2 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/80 dark:text-emerald-300/80">Total Benefits</p>
                      <p className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{formatCurrency(financialViewSummary.totalRevenue, 'AED', true)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200/70 bg-background px-3 py-2 dark:border-slate-800/80 dark:bg-slate-950/30">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active View</p>
                      <p className="font-medium">{currentFinancialView === 'pilot' ? 'Pilot' : 'Full Commercial'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200/70 bg-background px-3 py-2 dark:border-slate-800/80 dark:bg-slate-950/30">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Edit Mode</p>
                      <p className="font-medium">{isEditMode ? 'Live editing' : 'View only'}</p>
                    </div>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/60 bg-background text-left">
                          <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Benefit Line</th>
                          <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-right text-emerald-700 dark:text-emerald-300">{financialViewCostTotalLabel}</th>
                          {isEditMode && <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-right text-muted-foreground">Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                  {[...financialViewBenefits].map((b: BenefitLineItem) => ({
                    ...b,
                    _total: b.year1 + b.year2 + b.year3 + b.year4 + b.year5,
                  })).sort((a, b) => b._total - a._total).map((benefit) => {
                    const pct = financialViewSummary.totalRevenue > 0 ? (benefit._total / financialViewSummary.totalRevenue) * 100 : 0;
                    const overrideValue = editValues.benefitOverrides[benefit.id];
                    const isOverridden = isEditMode && overrideValue != null;
                    return (
                      <tr key={benefit.id} className="border-b border-border/40 align-top hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10">
                        <td className="px-3 py-3">
                          <div className="min-w-[220px]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-foreground">{benefit.name}</span>
                              {isOverridden && <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">Edited</Badge>}
                            </div>
                            {benefit.description && <p className="mt-1 text-[11px] text-muted-foreground">{benefit.description}</p>}
                            <p className="mt-1 text-[11px] text-muted-foreground">{pct.toFixed(0)}% of total benefits</p>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {isEditMode ? (
                            <Input
                              type="number"
                              className={`ml-auto h-9 w-36 text-sm text-right tabular-nums ${isOverridden ? 'ring-1 ring-amber-400' : ''}`}
                              value={Math.round(getOverrideTotalValue(overrideValue, benefit as unknown as Record<string, unknown>, activeBenefitYearKeys))}
                              onChange={(e) => {
                                const next = Number(e.target.value);
                                setEditValues(prev => ({
                                  ...prev,
                                  benefitOverrides: {
                                    ...prev.benefitOverrides,
                                    [benefit.id]: scaleOverrideToTotal(
                                      benefit as unknown as Record<string, unknown>,
                                      prev.benefitOverrides[benefit.id],
                                      Number.isFinite(next) ? next : 0,
                                      activeBenefitYearKeys,
                                    ),
                                  },
                                }));
                              }}
                              data-testid={`input-benefit-${benefit.id}`}
                              aria-label={`Edit total for ${benefit.name}`}
                            />
                          ) : (
                            <span className="inline-flex min-w-[92px] justify-end rounded-md bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                              {formatCurrency(benefit._total, 'AED', true)}
                            </span>
                          )}
                        </td>
                        {isEditMode && (
                          <td className="px-3 py-3 text-right">
                            {isOverridden && (
                              <button
                                type="button"
                                className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2"
                                onClick={() => {
                                  setEditValues(prev => {
                                    const next = { ...prev.benefitOverrides };
                                    delete next[benefit.id];
                                    return { ...prev, benefitOverrides: next };
                                  });
                                }}
                                data-testid={`button-reset-benefit-${benefit.id}`}
                              >
                                Reset
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Financial Analytics Dashboard */}
        <Card data-testid="cashflow-scenarios" className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Financial Analytics
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Cash flow projections, cost structure &amp; operating efficiency</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* 2x2 Chart Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Chart 1: Annual Benefits vs Costs */}
              <div className="space-y-2 p-3 rounded-xl bg-muted/20 border border-border/50">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{isPilotFinancialView ? 'Pilot Value Bridge' : 'Benefits vs Costs'}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    {isPilotFinancialView ? (
                      <span>Pilot-only comparison of investment, operating cost, benefits, and net value</span>
                    ) : (
                      <>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Benefits</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />Costs</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-blue-500 rounded inline-block" />Net</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    {isPilotFinancialView ? (
                      <ComposedChart data={pilotBenefitsVsCostsChartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={formatCompactNumber} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.4} />
                        <Bar dataKey="amount" name="Amount" barSize={28} radius={[4, 4, 0, 0]}>
                          {pilotBenefitsVsCostsChartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} fillOpacity={0.88} />
                          ))}
                        </Bar>
                      </ComposedChart>
                    ) : (
                      <ComposedChart data={visibleFinancialViewYearly.map((p: { year: number; revenue: number; costs: number; netCashFlow: number }) => ({
                        name: p.year === 0 ? 'Y0' : `Y${p.year}`,
                        benefits: p.revenue,
                        costs: p.costs,
                        net: p.netCashFlow,
                      }))} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={formatCompactNumber} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                        <Bar dataKey="benefits" name="Benefits" fill="#10b981" fillOpacity={0.8} barSize={14} radius={[2, 2, 0, 0]} />
                        <Bar dataKey="costs" name="Costs" fill="#f43f5e" fillOpacity={0.7} barSize={14} radius={[2, 2, 0, 0]} />
                        <Line type="monotone" dataKey="net" name="Net Cash Flow" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
                      </ComposedChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Net Cash Flow (Bars) + Cumulative (Line) */}
              <div className="space-y-2 p-3 rounded-xl bg-muted/20 border border-border/50">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Net Cash Flow &amp; Cumulative</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />Positive</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500 inline-block" />Negative</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 rounded inline-block" />Cumulative</span>
                  </div>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={isPilotFinancialView ? pilotCashFlowChartData : visibleFinancialViewYearly.map((p: { year: number; netCashFlow: number; cumulativeCashFlow: number }) => ({
                      name: p.year === 0 ? 'Y0' : `Y${p.year}`,
                      net: p.netCashFlow,
                      cumulative: p.cumulativeCashFlow,
                    }))} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cumulativeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={formatCompactNumber} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.4} />
                      <Area type="monotone" dataKey="cumulative" name="Cumulative Area" fill="url(#cumulativeGrad)" stroke="none" />
                      <Bar dataKey="net" name="Net Cash Flow" barSize={22} radius={[3, 3, 0, 0]}>
                        {(isPilotFinancialView ? pilotCashFlowChartData : visibleFinancialViewYearly).map((p: { netCashFlow?: number; net?: number }, i: number) => (
                          <Cell key={i} fill={((p.netCashFlow ?? p.net ?? 0) >= 0) ? '#10b981' : '#ef4444'} fillOpacity={0.85} />
                        ))}
                      </Bar>
                      <Line type="monotone" dataKey="cumulative" name="Cumulative" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3.5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 3: Cost Structure (CapEx vs OpEx) */}
              <div className="space-y-2 p-3 rounded-xl bg-muted/20 border border-border/50">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Cost Structure (CapEx vs OpEx)</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-500 inline-block" />CapEx</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" />OpEx</span>
                  </div>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={isPilotFinancialView ? pilotCostStructureChartData : (() => {
                      return [0, 1, 2, 3, 4, 5].map((yi) => {
                        let capex = 0;
                        let opex = 0;
                        financialViewCosts.forEach((c: CostLineItem) => {
                          const val = [c.year0, c.year1, c.year2, c.year3, c.year4, c.year5][yi] || 0;
                          if (c.isRecurring) { opex += val; } else { capex += val; }
                        });
                        return { name: yi === 0 ? 'Y0' : `Y${yi}`, capex, opex, total: capex + opex };
                      });
                    })()} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={formatCompactNumber} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                      <Bar dataKey="capex" name="CapEx" stackId="cost" fill="#64748b" fillOpacity={0.85} barSize={26} />
                      <Bar dataKey="opex" name="OpEx" stackId="cost" fill="#f59e0b" fillOpacity={0.85} barSize={26} radius={[3, 3, 0, 0]} />
                      <Line type="monotone" dataKey="total" name="Total Spend" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 2.5, fill: '#ef4444', strokeWidth: 0 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 4: Operating Efficiency Trend */}
              <div className="space-y-2 p-3 rounded-xl bg-muted/20 border border-border/50">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{isPilotFinancialView ? 'Pilot Operating KPIs' : 'Operating Efficiency'}</p>
                  {!isPilotFinancialView && (
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 rounded inline-block" />Margin %</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-violet-500 rounded inline-block" />B/C Ratio</span>
                    </div>
                  )}
                </div>
                {isPilotFinancialView ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {pilotPerformanceKpis.map((item) => (
                      <div key={item.label} className="rounded-xl border border-border/60 bg-background/80 p-3">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
                        <p className={`mt-1 text-lg font-semibold ${item.tone}`}>{item.value}</p>
                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={visibleFinancialViewYearly.filter((p: { year: number }) => p.year > 0).map((p: { year: number; operatingMargin: number; efficiencyRatio: number }) => ({
                        name: `Y${p.year}`,
                        margin: Math.round(p.operatingMargin * 10) / 10,
                        ratio: Math.round(p.efficiencyRatio * 10) / 10,
                      }))} margin={{ top: 8, right: 30, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}x`} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} formatter={(v: number, name: string) => name === 'Margin %' ? `${v}%` : `${v}x`} />
                        <defs>
                          <linearGradient id="marginGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area yAxisId="left" type="monotone" dataKey="margin" fill="url(#marginGrad)" stroke="none" />
                        <Line yAxisId="left" type="monotone" dataKey="margin" name="Margin %" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
                        <Line yAxisId="right" type="monotone" dataKey="ratio" name="B/C Ratio" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }} strokeDasharray="6 3" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Scenario Analysis */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Scenario Analysis</p>
              <div className="grid grid-cols-3 gap-3" data-testid="scenario-grid">
                {visibleScenarioCards.map((scenario: { name: string; label: string; npv: number; probability: number }) => (
                  <div
                    key={scenario.name}
                    className={`p-3 rounded-xl border text-center transition-colors ${scenario.name === 'base' ? 'border-primary/50 bg-primary/5 shadow-sm' : scenario.name === 'best' ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20'}`}
                    data-testid={`scenario-${scenario.name}`}
                  >
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{scenario.label}</p>
                    <p className={`text-sm font-bold tabular-nums ${scenario.npv >= 0 ? 'text-emerald-600' : 'text-red-600'}`} data-testid={`value-scenario-npv-${scenario.name}`}>
                      {formatCompactNumber(scenario.npv)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{Math.round(scenario.probability * 100)}% probability</p>
                    {isPilotFinancialView && (
                      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                        {pilotScenarioDriverNotes.find((note) => note.name === scenario.name)?.text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {programValueRecoveryGap > 0 ? (
                <div className="mt-4" data-testid="program-value-recovery-bridge">
                  <ValueRecoveryBridge
                    gapAed={programValueRecoveryGap}
                    levers={programValueRecoveryLevers}
                    horizonLabel="Program horizon"
                  />
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Archetype Assumptions */}
      <Card data-testid="archetype-assumptions">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5" />
              {stageViewEnabled ? `${activeFinancialViewLabel} Financial Assumptions Snapshot` : `Key Assumptions: ${model.archetype}`}
            </CardTitle>
            <Badge variant="outline" className="text-xs">{archetypeData.source}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {stageViewEnabled && (
            <p className="text-xs text-muted-foreground">
              This is the saved assumption snapshot for the active {activeFinancialViewLabel.toLowerCase()} financial view. Edit mode changes the shared planning inputs and recomputes these derived stage values.
            </p>
          )}
          {/* Standard Assumptions Row - uses saved values if available */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-2 rounded bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Adoption Rate</p>
              <p className="text-sm font-bold">{Math.round(displayValues.adoptionRate * 100)}%</p>
            </div>
            {!hidesGenericMaintenanceInput ? (
              <div className="p-2 rounded bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Maintenance</p>
                <p className="text-sm font-bold">{Math.round(displayValues.maintenancePercent * 100)}%</p>
              </div>
            ) : (
              <div className="p-2 rounded bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Maintenance Model</p>
                <p className="text-sm font-bold">Per-flight ops</p>
              </div>
            )}
            <div className="p-2 rounded bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Contingency</p>
              <p className="text-sm font-bold">{Math.round(displayValues.contingencyPercent * 100)}%</p>
            </div>
            <div className="p-2 rounded bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Discount Rate</p>
              <p className="text-sm font-bold">{Math.round(displayValues.discountRate * 100)}%</p>
            </div>
          </div>

          {/* Domain-Specific Assumptions - uses saved values if available */}
          {!isEditMode && stageViewEnabled && activeStageAssumptions.length > 0 ? (
            <div className="space-y-2" data-testid="domain-assumptions">
              <p className="text-sm font-medium text-muted-foreground">Derived {activeFinancialViewLabel} Operating Snapshot</p>
              <p className="text-xs text-muted-foreground">Throughput is deliveries per drone per day. Recognized revenue is the decision KPI in AED per delivery; gross yield inputs are bridge-only.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {activeStageAssumptions.map((assumption) => (
                  <div
                    key={assumption.name}
                    className="p-2 rounded border bg-card text-center"
                    title={assumption.description}
                  >
                    <p className="text-xs text-muted-foreground truncate">{assumption.name}</p>
                    {assumption.credibility ? (
                      <div className="mt-1">
                        <Badge variant="outline" className={assumptionCredibilityClasses[assumption.credibility]}>{assumption.credibility}</Badge>
                      </div>
                    ) : null}
                    <p className="text-sm font-bold">
                      {formatStageSpecificAssumptionValue(assumption.value, assumption.unit)}
                      {assumption.unit && assumption.unit !== '%' && assumption.unit !== 'AED' && assumption.unit !== 'AED / delivery' ? (
                        <span className="text-xs font-normal text-muted-foreground ml-1">{assumption.unit}</span>
                      ) : null}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : archetypeData.domainAssumptions && archetypeData.domainAssumptions.length > 0 ? (
            <div className="space-y-2" data-testid="domain-assumptions">
              <p className="text-sm font-medium text-muted-foreground">Domain-Specific Parameters</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {archetypeData.domainAssumptions.map((assumption, idx) => {
                  // Use saved value if available, otherwise archetype default
                  const savedValue = displayValues.domainParams[assumption.name];
                  const displayValue = savedValue !== undefined ? savedValue : assumption.value;
                  return (
                    <div
                      key={idx}
                      className="p-2 rounded border bg-card text-center"
                      data-testid={`domain-assumption-${idx}`}
                      title={`${assumption.description} (Source: ${assumption.source})`}
                    >
                      <p className="text-xs text-muted-foreground truncate">{assumption.name}</p>
                      <p className="text-sm font-bold">
                        {typeof displayValue === 'number' ? formatDomainAssumptionValue(displayValue, assumption.unit) : displayValue}
                        <span className="text-xs font-normal text-muted-foreground ml-1">{assumption.unit}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Do-Nothing Comparison */}
      {!isPilotFinancialView && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20" data-testid="do-nothing-comparison">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium">Cost of Inaction</p>
                  <p className="text-xs text-muted-foreground">5-year opportunity cost if the commercial rollout is not implemented</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-amber-600">{formatCurrency(activeDoNothingScenario.totalCostOfInaction, 'AED', true)}</p>
                <p className="text-xs text-muted-foreground">vs Net Value: {formatCurrency(financialViewNetLifecycleValue, 'AED', true)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Financial Projections ── */}
      <Card data-testid="five-year-projections" className="border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {isPilotFinancialView ? 'Pilot Financial Projection' : '5-Year Financial Projections'}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {isPilotFinancialView
                  ? 'Initial investment and pilot-window cash flow analysis for the active validation stage'
                  : 'Detailed year-by-year cash flow analysis derived from the investment and lifecycle model above'}
              </p>
            </div>
            <Badge variant="outline" className="text-xs bg-muted/50">Auto-Calculated</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="projections-summary">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Value Created</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5" data-testid="value-total-revenue">
                {formatCurrency(financialViewSummary.totalRevenue, 'AED', true)}
              </p>
              <p className="text-[10px] text-muted-foreground">Cumulative benefits &amp; revenue</p>
            </div>
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Investment</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400 mt-0.5" data-testid="value-total-costs">
                {formatCurrency(financialViewSummary.totalCosts, 'AED', true)}
              </p>
              <p className="text-[10px] text-muted-foreground">{isPilotFinancialView ? 'All mobilization and Year 1 pilot costs' : 'All costs over 5-year period'}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Operating Margin</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5" data-testid="value-avg-margin">
                {financialViewSummary.avgOperatingMargin.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground">Average annual margin</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Return Multiple</p>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5" data-testid="value-efficiency">
                {financialViewSummary.avgEfficiencyRatio.toFixed(2)}x
              </p>
              <p className="text-[10px] text-muted-foreground">Value per AED invested</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Growth Rate (CAGR)</p>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5" data-testid="value-cagr">
                {financialViewSummary.cagr.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground">Compound annual growth</p>
            </div>
            <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isPilotFinancialView ? 'Pilot Net Value' : 'Net Present Value'}</p>
              <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400 mt-0.5" data-testid="value-pv">
                {formatCurrency(isPilotFinancialView ? executiveDisplayNpv : financialViewSummary.totalPresentValue, 'AED', true)}
              </p>
              <p className="text-[10px] text-muted-foreground">{isPilotFinancialView ? 'Canonical pilot benefits less pilot cost' : 'Discounted cash flow value'}</p>
            </div>
          </div>

          {/* Year-by-Year Breakdown Table */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Annual Cash Flow Breakdown</p>
              <p className="text-[11px] text-muted-foreground ml-1">— projected performance by fiscal year</p>
            </div>
            <div className="overflow-x-auto rounded-lg border" data-testid="projections-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left py-2.5 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Period</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Benefits</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Costs</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Net Cash Flow</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Margin</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">YoY Growth</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Cumulative</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Present Value</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFinancialViewYearly.map((proj: { year: number; yearLabel: string; revenue: number; costs: number; netCashFlow: number; operatingMargin: number; yoyGrowth: number; cumulativeCashFlow: number; discountFactor: number; presentValue?: number }, idx: number) => {
                    const pv = proj.presentValue ?? proj.netCashFlow * proj.discountFactor;
                    const prevHadRevenue = idx > 0 && (visibleFinancialViewYearly[idx - 1]?.revenue ?? 0) > 0;
                    return (
                    <tr
                      key={proj.year}
                      className={`border-t border-muted/40 transition-colors hover:bg-muted/20 ${idx === 0 ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''}`}
                      data-testid={`projection-row-${proj.year}`}
                    >
                      <td className="py-2.5 px-3 font-semibold text-sm">
                        {proj.yearLabel}
                        {idx === 0 && <span className="block text-[10px] font-normal text-muted-foreground">Capital outlay</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {proj.revenue > 0 ? formatCurrency(proj.revenue, 'AED', true) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-red-600 dark:text-red-400 tabular-nums">
                        {formatCurrency(proj.costs, 'AED', true)}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-semibold tabular-nums ${proj.netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(proj.netCashFlow, 'AED', true)}
                      </td>
                      <td className={`py-2.5 px-3 text-right tabular-nums ${proj.operatingMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {proj.revenue > 0 ? `${proj.operatingMargin.toFixed(1)}%` : '—'}
                      </td>
                      <td className={`py-2.5 px-3 text-right tabular-nums ${proj.yoyGrowth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {prevHadRevenue && proj.revenue > 0 ? `${proj.yoyGrowth > 0 ? '+' : ''}${proj.yoyGrowth.toFixed(1)}%` : '—'}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-semibold tabular-nums ${proj.cumulativeCashFlow >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(proj.cumulativeCashFlow, 'AED', true)}
                      </td>
                      <td className={`py-2.5 px-3 text-right tabular-nums ${pv >= 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(pv, 'AED', true)}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 dark:bg-slate-900/50 font-semibold border-t-2 border-slate-300 dark:border-slate-700">
                    <td className="py-2.5 px-3 text-sm">{financialViewCostTotalLabel}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatCurrency(financialViewSummary.totalRevenue, 'AED', true)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-red-600 dark:text-red-400 tabular-nums">
                      {formatCurrency(financialViewSummary.totalCosts, 'AED', true)}
                    </td>
                    <td className={`py-2.5 px-3 text-right tabular-nums ${financialViewSummary.totalRevenue - financialViewSummary.totalCosts >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(financialViewSummary.totalRevenue - financialViewSummary.totalCosts, 'AED', true)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {financialViewSummary.avgOperatingMargin.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400 tabular-nums text-xs">
                      CAGR {financialViewSummary.cagr.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {formatCurrency(visibleFinancialViewYearly[visibleFinancialViewYearly.length - 1]?.cumulativeCashFlow ?? 0, 'AED', true)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-cyan-600 dark:text-cyan-400 tabular-nums">
                      {formatCurrency(isPilotFinancialView ? executiveDisplayNpv : financialViewSummary.totalPresentValue, 'AED', true)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Financial Health Indicators */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Financial Health Indicators</p>
              <p className="text-[11px] text-muted-foreground ml-1">— key performance benchmarks</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="financial-health">
              <div className="p-4 rounded-xl border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Profitability Index</span>
                  <Badge variant={financialViewSummary.avgEfficiencyRatio >= 1 ? 'default' : 'destructive'} className={financialViewSummary.avgEfficiencyRatio >= 1 ? 'bg-emerald-500' : ''}>
                    {financialViewSummary.avgEfficiencyRatio >= 1.5 ? 'Strong' : financialViewSummary.avgEfficiencyRatio >= 1 ? 'Positive' : 'Negative'}
                  </Badge>
                </div>
                <Progress
                  value={Math.min(financialViewSummary.avgEfficiencyRatio * 50, 100)}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {financialViewSummary.avgEfficiencyRatio.toFixed(2)}x return per AED invested — measures how much value each dirham of investment generates over the forecast period
                </p>
              </div>

              <div className="p-4 rounded-xl border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Value Growth Trajectory</span>
                  <Badge variant={financialViewSummary.cagr >= 10 ? 'default' : 'secondary'} className={financialViewSummary.cagr >= 10 ? 'bg-emerald-500' : ''}>
                    {financialViewSummary.cagr >= 20 ? 'High Growth' : financialViewSummary.cagr >= 10 ? 'Moderate' : 'Stable'}
                  </Badge>
                </div>
                <Progress
                  value={Math.min(financialViewSummary.cagr * 2, 100)}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {financialViewSummary.cagr.toFixed(1)}% CAGR — the compound annual growth rate of projected benefits, reflecting the acceleration of returns over the lifecycle
                </p>
              </div>

              <div className="p-4 rounded-xl border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Operating Efficiency</span>
                  <Badge variant={financialViewSummary.avgOperatingMargin >= 20 ? 'default' : 'secondary'} className={financialViewSummary.avgOperatingMargin >= 20 ? 'bg-emerald-500' : ''}>
                    {financialViewSummary.avgOperatingMargin >= 30 ? 'Excellent' : financialViewSummary.avgOperatingMargin >= 20 ? 'Good' : 'Moderate'}
                  </Badge>
                </div>
                <Progress
                  value={Math.min(financialViewSummary.avgOperatingMargin, 100)}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {financialViewSummary.avgOperatingMargin.toFixed(1)}% average operating margin — proportion of benefits retained after covering operating costs each year
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== OPERATIONAL INTELLIGENCE PANEL ===== */}
      <OperationalIntelligencePanel computedFinancialModel={activeComputedFinancialModelRecord} costs={financialViewCosts} fiveYearYearly={visibleFinancialViewYearly} activeFinancialView={stageViewEnabled ? currentFinancialView : undefined} activeStageEconomics={activeStageEconomics ?? undefined} />

      {/* ===== INVESTMENT COMMITTEE ANALYTICS ===== */}
      {(!stageViewEnabled || currentFinancialView === 'full') && <InvestmentCommitteeAnalytics computedFinancialModel={activeComputedFinancialModelRecord} />}
    </div>
  );
}
