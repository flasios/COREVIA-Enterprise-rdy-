import { type IStorage } from "@interfaces/storage";
import { addMonths, subMonths, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { z } from "zod";
import type { DemandReport } from "@shared/schema";
import { logger } from "@platform/logging/Logger";

// ============================================================================
// ANALYTICS INTERFACES & TYPES
// ============================================================================

interface AllocatedResources {
  teamMembers?: Array<{
    userId: string;
    role: string;
    fte: number;
    startDate: string;
    endDate: string;
  }>;
  totalFTE?: number | string;
}

interface RiskAssessment {
  overallRiskLevel?: string;
}

interface BusinessCase {
  totalCostEstimate?: number | string;
  totalBenefitEstimate?: number | string;
  riskAssessment?: RiskAssessment;
}

interface RequirementItem {
  category?: string;
  name?: string;
}

interface RequirementsAnalysis {
  functionalRequirements?: RequirementItem[];
  capabilities?: RequirementItem[];
}

interface ExtendedDemandReport extends DemandReport {
  businessCases?: BusinessCase[];
  allocatedResources: AllocatedResources | string | null;
  requirementsAnalysis: RequirementsAnalysis | string | null;
}

// ============================================================================
// ANALYTICS UTILITY FUNCTIONS
// ============================================================================

// Parse monetary values (supports AED and USD symbols)
function parseMonetaryValue(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const cleaned = String(value).replace(/[AED$,د.إ\s]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Linear regression for trend analysis
function linearRegression(data: number[]): { slope: number, intercept: number } {
  if (data.length < 2) return { slope: 0, intercept: 0 };

  const n = data.length;
  const xValues = Array.from({ length: n }, (_, i) => i);
  const yValues = data;

  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i]!, 0);
  const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

// Standard deviation for confidence intervals
function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

// Exponential smoothing for forecasting
function exponentialSmoothing(data: number[], alpha: number = 0.3): number {
  if (data.length === 0) return 0;
  let smoothed = data[0]!;
  for (let i = 1; i < data.length; i++) {
    smoothed = alpha * data[i]! + (1 - alpha) * smoothed;
  }
  return smoothed;
}

// ============================================================================
// ENDPOINT 1: PORTFOLIO HEALTH
// Returns real-time KPIs for portfolio management
// ============================================================================

export async function getPortfolioHealth(storage: IStorage) {
  const reports = await storage.getAllDemandReports() as ExtendedDemandReport[];

  if (reports.length === 0) {
    return {
      overallHealthScore: 0,
      deliveryPerformance: 0,
      budgetPerformance: 0,
      riskExposure: 0,
      capacityUtilization: 0,
      totalReports: 0,
      metrics: {
        onTimeDelivery: 0,
        withinBudget: 0,
        lowRiskCount: 0,
        mediumRiskCount: 0,
        highRiskCount: 0,
        criticalRiskCount: 0,
        totalFTEAllocated: 0,
        baselineFTECapacity: 0,
      }
    };
  }

  // Calculate delivery performance (% completed on time)
  const completedReports = reports.filter(r => r.completedAt !== null);

  let onTimeCount = 0;
  completedReports.forEach(report => {
    if (report.completedAt && report.createdAt) {
      const actualDays = differenceInDays(new Date(report.completedAt), new Date(report.createdAt));
      // Assume 30 days is on-time if no specific timeline
      const expectedDays = report.estimatedTimeline ? parseInt(report.estimatedTimeline) : 30;
      if (actualDays <= expectedDays) {
        onTimeCount++;
      }
    }
  });

  const deliveryPerformance = completedReports.length > 0
    ? (onTimeCount / completedReports.length) * 100
    : 0;

  // Calculate budget performance (% within budget)
  const reportsWithBudget = reports.filter(r =>
    r.approvedBudget && r.actualSpend
  );

  let withinBudgetCount = 0;
  reportsWithBudget.forEach(report => {
    const approved = parseMonetaryValue(report.approvedBudget);
    const actual = parseMonetaryValue(report.actualSpend);
    if (actual <= approved) {
      withinBudgetCount++;
    }
  });

  const budgetPerformance = reportsWithBudget.length > 0
    ? (withinBudgetCount / reportsWithBudget.length) * 100
    : 100;

  // Calculate risk exposure (weighted by risk level)
  const riskCounts = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0
  };

  reports.forEach(report => {
    const businessCase = report.businessCases?.[0];
    const riskLevel = businessCase?.riskAssessment?.overallRiskLevel?.toLowerCase() || 'medium';
    if (Object.prototype.hasOwnProperty.call(riskCounts, riskLevel)) {
      riskCounts[riskLevel as keyof typeof riskCounts]++;
    }
  });

  // Weighted risk score: Critical=4, High=3, Medium=2, Low=1
  const totalRiskWeight =
    riskCounts.critical * 4 +
    riskCounts.high * 3 +
    riskCounts.medium * 2 +
    riskCounts.low * 1;
  const maxPossibleRisk = reports.length * 4; // All critical
  const riskExposure = maxPossibleRisk > 0 ? (totalRiskWeight / maxPossibleRisk) * 100 : 0;

  // Calculate capacity utilization (actual vs baseline FTE)
  let totalFTEAllocated = 0;
  let baselineFTECapacity = 0;

  reports.forEach(report => {
    if (report.allocatedResources) {
      const resources = typeof report.allocatedResources === 'string'
        ? (JSON.parse(report.allocatedResources) as AllocatedResources)
        : (report.allocatedResources as AllocatedResources);
      if (resources.totalFTE) {
        totalFTEAllocated += parseFloat(String(resources.totalFTE));
      }
    }
    if (report.baselineCapacityFTE) {
      baselineFTECapacity += parseFloat(String(report.baselineCapacityFTE));
    }
  });

  // If no baseline set, assume 100 FTE per organization
  if (baselineFTECapacity === 0) {
    baselineFTECapacity = 100;
  }

  const capacityUtilization = Math.min((totalFTEAllocated / baselineFTECapacity) * 100, 100);

  // Calculate overall health score (weighted average)
  // 30% delivery, 30% budget, 20% risk (inverse), 20% capacity
  const overallHealthScore =
    (deliveryPerformance * 0.3) +
    (budgetPerformance * 0.3) +
    ((100 - riskExposure) * 0.2) +
    (Math.min(capacityUtilization, 100) * 0.2);

  return {
    overallHealthScore: Math.round(overallHealthScore * 10) / 10,
    deliveryPerformance: Math.round(deliveryPerformance * 10) / 10,
    budgetPerformance: Math.round(budgetPerformance * 10) / 10,
    riskExposure: Math.round(riskExposure * 10) / 10,
    capacityUtilization: Math.round(capacityUtilization * 10) / 10,
    totalReports: reports.length,
    metrics: {
      onTimeDelivery: onTimeCount,
      withinBudget: withinBudgetCount,
      lowRiskCount: riskCounts.low,
      mediumRiskCount: riskCounts.medium,
      highRiskCount: riskCounts.high,
      criticalRiskCount: riskCounts.critical,
      totalFTEAllocated,
      baselineFTECapacity,
    }
  };
}

// ============================================================================
// ENDPOINT 2: DEMAND FORECAST
// 12-month forecast with exponential smoothing and confidence intervals
// ============================================================================

export async function getDemandForecast(storage: IStorage) {
  const reports = await storage.getAllDemandReports();

  // Get historical data for last 12 months
  const historicalMonths: Array<{ month: string, count: number, date: Date }> = [];
  for (let i = 11; i >= 0; i--) {
    const monthDate = subMonths(new Date(), i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    const monthReports = reports.filter(r => {
      const createdDate = new Date(r.createdAt);
      return createdDate >= monthStart && createdDate <= monthEnd;
    });

    historicalMonths.push({
      month: monthDate.toISOString().substring(0, 7), // YYYY-MM format
      count: monthReports.length,
      date: monthDate
    });
  }

  // Calculate historical statistics
  const historicalCounts = historicalMonths.map(m => m.count);
  const avgCount = historicalCounts.reduce((a, b) => a + b, 0) / historicalCounts.length;
  const stdDev = standardDeviation(historicalCounts);

  // Apply exponential smoothing for forecasting
  const alpha = 0.3;
  const forecast: Array<{ month: string, forecast: number, lower95: number, upper95: number, isHistorical: boolean }> = [];

  // Add historical data
  historicalMonths.forEach(m => {
    forecast.push({
      month: m.month,
      forecast: m.count,
      lower95: m.count,
      upper95: m.count,
      isHistorical: true
    });
  });

  // Forecast next 12 months
  let lastValue = exponentialSmoothing(historicalCounts, alpha);
  const { slope } = linearRegression(historicalCounts);

  for (let i = 1; i <= 12; i++) {
    const futureMonth = addMonths(new Date(), i);
    const monthStr = futureMonth.toISOString().substring(0, 7);

    // Forecast with trend
    const forecastValue = lastValue + (slope * i);
    const adjustedForecast = Math.max(0, forecastValue);

    // 95% confidence interval (approximately ±2 standard deviations)
    const confidenceMargin = 1.96 * stdDev * Math.sqrt(i); // Increases with forecast horizon

    forecast.push({
      month: monthStr,
      forecast: Math.round(adjustedForecast * 10) / 10,
      lower95: Math.max(0, Math.round((adjustedForecast - confidenceMargin) * 10) / 10),
      upper95: Math.round((adjustedForecast + confidenceMargin) * 10) / 10,
      isHistorical: false
    });
  }

  // Detect seasonality patterns
  const seasonalityPattern = detectSeasonality(historicalCounts);

  return {
    historical: historicalMonths.map(m => ({
      month: m.month,
      count: m.count
    })),
    forecast: forecast.filter(f => !f.isHistorical),
    statistics: {
      averageMonthlyDemands: Math.round(avgCount * 10) / 10,
      standardDeviation: Math.round(stdDev * 10) / 10,
      trend: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
      trendSlope: Math.round(slope * 100) / 100,
      seasonality: seasonalityPattern
    }
  };
}

function detectSeasonality(data: number[]): string {
  if (data.length < 12) return 'insufficient_data';

  // Simple seasonality detection: check if there's a repeating pattern
  const firstHalf = data.slice(0, 6);
  const secondHalf = data.slice(6, 12);

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const difference = Math.abs(avgFirst - avgSecond);
  const overall = data.reduce((a, b) => a + b, 0) / data.length;

  if (difference / overall > 0.3) {
    return avgFirst > avgSecond ? 'higher_first_half' : 'higher_second_half';
  }

  return 'no_clear_pattern';
}

// ============================================================================
// ENDPOINT 3: MONTE CARLO SIMULATION
// Portfolio optimization with 1000 simulations
// ============================================================================

export async function runMonteCarloSimulation(
  storage: IStorage,
  constraints: {
    budgetConstraint?: number;
    resourceConstraint?: number;
    timeConstraint?: number;
  }
) {
  const reports = await storage.getAllDemandReports() as ExtendedDemandReport[];

  // Historical success rates by risk level
  const successRates = calculateHistoricalSuccessRates(reports);

  const simulations = 1000;
  const results: Array<{
    selectedProjects: number;
    totalCost: number;
    totalValue: number;
    totalFTE: number;
    roi: number;
    successProbability: number;
  }> = [];

  // Run Monte Carlo simulations
  for (let sim = 0; sim < simulations; sim++) {
    let selectedProjects = 0;
    let totalCost = 0;
    let totalValue = 0;
    let totalFTE = 0;
    let successCount = 0;

    // Randomly select projects based on constraints
    const shuffled = [...reports].sort(() => Math.random() - 0.5);

    for (const report of shuffled) {
      const businessCase = report.businessCases?.[0];
      const cost = parseMonetaryValue(businessCase?.totalCostEstimate || report.estimatedBudget || 0);
      const benefit = parseMonetaryValue(businessCase?.totalBenefitEstimate || 0);
      const riskLevel = businessCase?.riskAssessment?.overallRiskLevel || 'Medium';

      const fte = report.allocatedResources
        ? parseFloat(String(typeof report.allocatedResources === 'string'
            ? (JSON.parse(report.allocatedResources) as AllocatedResources).totalFTE || 0
            : (report.allocatedResources as AllocatedResources).totalFTE || 0))
        : 5; // Default 5 FTE

      // Check constraints
      const budgetOk = !constraints.budgetConstraint || (totalCost + cost <= constraints.budgetConstraint);
      const resourceOk = !constraints.resourceConstraint || (totalFTE + fte <= constraints.resourceConstraint);

      if (budgetOk && resourceOk) {
        selectedProjects++;
        totalCost += cost;
        totalValue += benefit;
        totalFTE += fte;

        // Simulate success based on historical success rate for this risk level
        const successRate = successRates[riskLevel] || 0.5;
        if (Math.random() < successRate) {
          successCount++;
        }
      }
    }

    const roi = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
    const successProbability = selectedProjects > 0 ? (successCount / selectedProjects) * 100 : 0;

    results.push({
      selectedProjects,
      totalCost,
      totalValue,
      totalFTE,
      roi,
      successProbability
    });
  }

  // Calculate statistics
  const avgProjects = results.reduce((sum, r) => sum + r.selectedProjects, 0) / simulations;
  const avgCost = results.reduce((sum, r) => sum + r.totalCost, 0) / simulations;
  const avgValue = results.reduce((sum, r) => sum + r.totalValue, 0) / simulations;
  const avgROI = results.reduce((sum, r) => sum + r.roi, 0) / simulations;
  const avgSuccess = results.reduce((sum, r) => sum + r.successProbability, 0) / simulations;

  // Probability distribution (10 buckets)
  const roiBuckets = Array(10).fill(0);
  results.forEach(r => {
    const bucketIndex = Math.min(9, Math.floor(r.roi / 20)); // 20% buckets
    if (bucketIndex >= 0) {
      roiBuckets[bucketIndex]++;
    }
  });

  const distribution = roiBuckets.map((count, idx) => ({
    roiRange: `${idx * 20}-${(idx + 1) * 20}%`,
    probability: (count / simulations) * 100
  }));

  // Recommended portfolio (median scenario)
  const sortedByROI = [...results].sort((a, b) => b.roi - a.roi);
  const medianResult = sortedByROI[Math.floor(sortedByROI.length / 2)]!;

  return {
    simulationCount: simulations,
    constraints,
    averageResults: {
      projectsSelected: Math.round(avgProjects * 10) / 10,
      totalCost: Math.round(avgCost),
      totalValue: Math.round(avgValue),
      roi: Math.round(avgROI * 10) / 10,
      successProbability: Math.round(avgSuccess * 10) / 10
    },
    probabilityDistribution: distribution,
    recommendedPortfolio: {
      projectsSelected: medianResult.selectedProjects,
      totalCost: Math.round(medianResult.totalCost),
      totalValue: Math.round(medianResult.totalValue),
      roi: Math.round(medianResult.roi * 10) / 10,
      successProbability: Math.round(medianResult.successProbability * 10) / 10
    },
    successRatesByRiskLevel: successRates
  };
}

function calculateHistoricalSuccessRates(reports: ExtendedDemandReport[]): Record<string, number> {
  const riskLevels = ['Low', 'Medium', 'High', 'Critical'];
  const rates: Record<string, number> = {};

  riskLevels.forEach(level => {
    const reportsAtLevel = reports.filter(r => {
      const businessCase = r.businessCases?.[0];
      return businessCase?.riskAssessment?.overallRiskLevel === level;
    });

    if (reportsAtLevel.length > 0) {
      const successCount = reportsAtLevel.filter(r =>
        r.workflowStatus === 'manager_approved' || r.workflowStatus === 'approved'
      ).length;
      rates[level] = successCount / reportsAtLevel.length;
    } else {
      // Default success rates
      rates[level] = level === 'Low' ? 0.9 : level === 'Medium' ? 0.7 : level === 'High' ? 0.5 : 0.3;
    }
  });

  return rates;
}

// ============================================================================
// ENDPOINT 4: INTEGRATION STATUS
// Cross-module synchronization metrics
// ============================================================================

export async function getIntegrationStatus(storage: IStorage) {
  const reports = await storage.getAllDemandReports() as ExtendedDemandReport[];

  if (reports.length === 0) {
    return {
      totalReports: 0,
      completeWorkflowCount: 0,
      completionRate: 0,
      averageIntegrationTime: 0,
      successRate: 0,
      breakdown: {
        hasBusinessCase: 0,
        hasRequirements: 0,
        hasStrategicFit: 0,
        hasAll: 0
      }
    };
  }

  let hasBusinessCaseCount = 0;
  let hasRequirementsCount = 0;
  let hasStrategicFitCount = 0;
  let completeWorkflowCount = 0;
  let totalIntegrationTime = 0;
  let integrationTimeCount = 0;

  reports.forEach(report => {
    const hasBusinessCase = report.businessCases && report.businessCases.length > 0;
    const hasRequirements = report.requirementsAnalysis && Object.keys(report.requirementsAnalysis).length > 0;
    const hasStrategicFit = report.strategicFitAnalysis && Object.keys(report.strategicFitAnalysis).length > 0;

    if (hasBusinessCase) hasBusinessCaseCount++;
    if (hasRequirements) hasRequirementsCount++;
    if (hasStrategicFit) hasStrategicFitCount++;

    // Complete workflow = has all three modules
    if (hasBusinessCase && hasRequirements && hasStrategicFit) {
      completeWorkflowCount++;

      // Calculate integration time (creation to approval)
      if (report.managerApprovedAt && report.createdAt) {
        const days = differenceInDays(new Date(report.managerApprovedAt), new Date(report.createdAt));
        totalIntegrationTime += days;
        integrationTimeCount++;
      } else if (report.approvedAt && report.createdAt) {
        const days = differenceInDays(new Date(report.approvedAt), new Date(report.createdAt));
        totalIntegrationTime += days;
        integrationTimeCount++;
      }
    }
  });

  const completionRate = (completeWorkflowCount / reports.length) * 100;
  const averageIntegrationTime = integrationTimeCount > 0
    ? totalIntegrationTime / integrationTimeCount
    : 0;

  // Success rate = % of complete workflows that got approved
  const successfulReports = reports.filter(r =>
    r.workflowStatus === 'manager_approved' || r.workflowStatus === 'approved'
  ).length;
  const successRate = reports.length > 0 ? (successfulReports / reports.length) * 100 : 0;

  return {
    totalReports: reports.length,
    completeWorkflowCount,
    completionRate: Math.round(completionRate * 10) / 10,
    averageIntegrationTime: Math.round(averageIntegrationTime * 10) / 10,
    successRate: Math.round(successRate * 10) / 10,
    breakdown: {
      hasBusinessCase: hasBusinessCaseCount,
      hasRequirements: hasRequirementsCount,
      hasStrategicFit: hasStrategicFitCount,
      hasAll: completeWorkflowCount
    }
  };
}

// ============================================================================
// ENDPOINT 5: DEMAND MANAGEMENT PLAN SERVICE
// AI-powered strategic analysis and recommendations
// ============================================================================

// Zod schema for AI-powered strategic insights
const RiskMitigationSchema = z.object({
  risk: z.string(),
  mitigation: z.string(),
  severity: z.string()
});

const ImplementationStrategySchema = z.object({
  q1Focus: z.string(),
  q2Focus: z.string(),
  q3Q4Focus: z.string()
});

const AiInsightsSchema = z.object({
  strategicOverview: z.string(),
  keyInsights: z.array(z.string()),
  riskMitigation: z.array(RiskMitigationSchema),
  implementationStrategy: ImplementationStrategySchema,
  budgetOptimization: z.string(),
  successMetrics: z.array(z.string())
});

// Safe defaults for AI insights
const DEFAULT_AI_INSIGHTS = {
  strategicOverview: 'Strategic analysis of approved demands for implementation planning.',
  keyInsights: [],
  riskMitigation: [],
  implementationStrategy: {
    q1Focus: '',
    q2Focus: '',
    q3Q4Focus: ''
  },
  budgetOptimization: 'Optimize budget allocation across priority initiatives.',
  successMetrics: []
};

// Helper function to validate and normalize AI response with field-by-field defaults
function validateAiInsights(response: unknown): z.infer<typeof AiInsightsSchema> {
  try {
    // First try to parse with Zod - if successful, we have a valid response
    return AiInsightsSchema.parse(response);
  } catch (error) {
    logger.warn('AI response validation failed, applying field-by-field defaults:', error);

    // If parsing fails, validate field by field and apply defaults
    const normalized: z.infer<typeof AiInsightsSchema> = {
      strategicOverview: DEFAULT_AI_INSIGHTS.strategicOverview,
      keyInsights: DEFAULT_AI_INSIGHTS.keyInsights,
      riskMitigation: DEFAULT_AI_INSIGHTS.riskMitigation,
      implementationStrategy: { ...DEFAULT_AI_INSIGHTS.implementationStrategy },
      budgetOptimization: DEFAULT_AI_INSIGHTS.budgetOptimization,
      successMetrics: DEFAULT_AI_INSIGHTS.successMetrics
    };

    // Try to extract valid fields from the response
    if (response && typeof response === 'object') {
      const resp = response as Record<string, unknown>;

      // Validate strategicOverview
      if (typeof resp.strategicOverview === 'string' && resp.strategicOverview.length > 0) {
        normalized.strategicOverview = resp.strategicOverview;
      }

      // Validate keyInsights
      if (Array.isArray(resp.keyInsights)) {
        const validInsights = resp.keyInsights.filter(i => typeof i === 'string' && i.length > 0);
        if (validInsights.length > 0) {
          normalized.keyInsights = validInsights.slice(0, 5);
        }
      }

      // Validate riskMitigation
      if (Array.isArray(resp.riskMitigation)) {
        const validRisks = resp.riskMitigation.filter(r =>
          r && typeof r === 'object' &&
          typeof r.risk === 'string' && r.risk.length > 0 &&
          typeof r.mitigation === 'string' && r.mitigation.length > 0 &&
          typeof r.severity === 'string' && r.severity.length > 0
        );
        if (validRisks.length > 0) {
          normalized.riskMitigation = validRisks.slice(0, 3).map(r => ({
            risk: r.risk,
            mitigation: r.mitigation,
            severity: r.severity
          }));
        }
      }

      // Validate implementationStrategy
      if (resp.implementationStrategy && typeof resp.implementationStrategy === 'object') {
        const strategy = resp.implementationStrategy as Record<string, unknown>;
        if (typeof strategy.q1Focus === 'string') {
          normalized.implementationStrategy.q1Focus = strategy.q1Focus;
        }
        if (typeof strategy.q2Focus === 'string') {
          normalized.implementationStrategy.q2Focus = strategy.q2Focus;
        }
        if (typeof strategy.q3Q4Focus === 'string') {
          normalized.implementationStrategy.q3Q4Focus = strategy.q3Q4Focus;
        }
      }

      // Validate budgetOptimization
      if (typeof resp.budgetOptimization === 'string' && resp.budgetOptimization.length > 0) {
        normalized.budgetOptimization = resp.budgetOptimization;
      }

      // Validate successMetrics
      if (Array.isArray(resp.successMetrics)) {
        const validMetrics = resp.successMetrics.filter(m => typeof m === 'string' && m.length > 0);
        if (validMetrics.length > 0) {
          normalized.successMetrics = validMetrics.slice(0, 6);
        }
      }
    }

    return normalized;
  }
}

export async function getDemandPlanService(storage: IStorage) {
  const reports = await storage.getAllDemandReports() as ExtendedDemandReport[];

  // Filter approved demands for analysis
  const approvedReports = reports.filter(r =>
    r.workflowStatus === 'approved' || r.workflowStatus === 'manager_approved'
  );

  if (approvedReports.length === 0) {
    return {
      executiveSummary: {
        totalApproved: 0,
        totalBudget: 0,
        readyForImplementation: 0,
        analysisDate: new Date().toISOString()
      },
      capabilityAnalysis: {
        required: [],
        existing: [],
        gaps: []
      },
      pipelineOverview: {
        inProgress: [],
        planned: [],
        onHold: []
      },
      yearAheadRecommendations: [],
      aiInsights: { ...DEFAULT_AI_INSIGHTS }
    };
  }

  // Calculate total budget and classify demands
  let totalBudget = 0;
  const inProgress: ExtendedDemandReport[] = [];
  const planned: ExtendedDemandReport[] = [];
  const onHold: ExtendedDemandReport[] = [];
  const readyForImplementation: ExtendedDemandReport[] = [];

  approvedReports.forEach(report => {
    const budget = parseMonetaryValue(report.approvedBudget);
    totalBudget += budget;

    // Classify based on status
    if (report.completedAt) {
      // Already completed
    } else if (report.workflowStatus === 'manager_approved') {
      readyForImplementation.push(report);
    } else {
      planned.push(report);
    }
  });

  // Extract capabilities from all approved demands
  const requiredCapabilities = new Set<string>();
  const existingSystems = new Set<string>();

  approvedReports.forEach(report => {
    // Extract from requirements analysis
    if (report.requirementsAnalysis) {
      try {
        const analysis = typeof report.requirementsAnalysis === 'string'
          ? (JSON.parse(report.requirementsAnalysis) as RequirementsAnalysis)
          : (report.requirementsAnalysis as RequirementsAnalysis);

        if (analysis.functionalRequirements) {
          analysis.functionalRequirements.forEach((req: RequirementItem) => {
            if (req.category) requiredCapabilities.add(req.category);
          });
        }

        if (analysis.capabilities) {
          analysis.capabilities.forEach((cap: RequirementItem) => {
            if (cap.name) requiredCapabilities.add(cap.name);
          });
        }
      } catch (_e) {
        // Skip if parsing fails
      }
    }

    // Extract existing systems
    if (report.existingSystems) {
      const systems = report.existingSystems.split(',').map(s => s.trim());
      systems.forEach(s => existingSystems.add(s));
    }
  });

  // Prepare data for AI analysis
  const _analysisContext = {
    totalApprovedDemands: approvedReports.length,
    totalBudget,
    readyForImplementationCount: readyForImplementation.length,
    plannedCount: planned.length,
    topDemands: approvedReports
      .slice(0, 10)
      .map(r => ({
        id: r.id,
        title: r.businessObjective?.substring(0, 100) || 'Untitled',
        department: r.department,
        urgency: r.urgency,
        budget: parseMonetaryValue(r.approvedBudget),
        businessObjective: r.businessObjective?.substring(0, 200),
        expectedOutcomes: r.expectedOutcomes?.substring(0, 200),
        industryType: r.industryType
      })),
    requiredCapabilities: Array.from(requiredCapabilities),
    existingSystems: Array.from(existingSystems)
  };

  // Production readiness enforcement:
  // Analytics must not call external LLM providers directly.
  // If strategic insights are needed, they must be produced via Corevia Brain governance.
  const aiInsights: z.infer<typeof AiInsightsSchema> = validateAiInsights(null);

  // Build capability gap analysis
  const capabilityAnalysis = {
    required: Array.from(requiredCapabilities).map(cap => ({
      name: cap,
      demandCount: approvedReports.filter(r => {
        try {
          const analysis = typeof r.requirementsAnalysis === 'string'
            ? JSON.parse(r.requirementsAnalysis)
            : r.requirementsAnalysis;
          return JSON.stringify(analysis).includes(cap);
        } catch {
          return false;
        }
      }).length
    })),
    existing: Array.from(existingSystems).map(sys => ({ name: sys })),
    gaps: Array.from(requiredCapabilities)
      .filter(cap => !Array.from(existingSystems).some(sys =>
        sys.toLowerCase().includes(cap.toLowerCase()) ||
        cap.toLowerCase().includes(sys.toLowerCase())
      ))
      .map(cap => ({ capability: cap, severity: 'high' }))
  };

  // Build year-ahead recommendations with priority scoring (using urgency as priority)
  const recommendations = readyForImplementation
    .map(report => {
      const budget = parseMonetaryValue(report.approvedBudget);
      const urgencyLower = report.urgency.toLowerCase();
      const priorityScore = urgencyLower === 'critical' ? 100
        : urgencyLower === 'high' ? 80
        : urgencyLower === 'medium' ? 60
        : urgencyLower === 'low' ? 40 : 50;

      // Use industry type as a proxy for strategic alignment
      const industryScore = report.industryType === 'government' ? 20
        : report.industryType === 'semi-government' ? 18
        : report.industryType === 'public-private-partnership' ? 16
        : 15;

      const totalScore = priorityScore + industryScore;

      return {
        demandId: report.id,
        title: report.businessObjective?.substring(0, 100) || 'Untitled',
        department: report.department,
        urgency: report.urgency,
        budget,
        industryType: report.industryType,
        recommendationScore: totalScore,
        implementationQuarter: totalScore >= 110 ? 'Q1'
          : totalScore >= 95 ? 'Q2'
          : totalScore >= 80 ? 'Q3' : 'Q4',
        rationale: `Urgency: ${report.urgency}, Industry: ${report.industryType}, Budget: ${formatCurrency(budget)}`
      };
    })
    .sort((a, b) => b.recommendationScore - a.recommendationScore);

  return {
    executiveSummary: {
      totalApproved: approvedReports.length,
      totalBudget: Math.round(totalBudget),
      readyForImplementation: readyForImplementation.length,
      analysisDate: new Date().toISOString()
    },
    capabilityAnalysis,
    pipelineOverview: {
      inProgress: inProgress.map(r => ({ id: r.id, title: r.businessObjective || r.suggestedProjectName || r.projectId || 'Untitled', status: r.workflowStatus })),
      planned: planned.map(r => ({ id: r.id, title: r.businessObjective || r.suggestedProjectName || r.projectId || 'Untitled', budget: parseMonetaryValue(r.approvedBudget) })),
      onHold: onHold.map(r => ({ id: r.id, title: r.businessObjective || r.suggestedProjectName || r.projectId || 'Untitled' }))
    },
    yearAheadRecommendations: recommendations.slice(0, 20),
    aiInsights
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
