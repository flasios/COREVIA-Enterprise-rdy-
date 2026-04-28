import type { FinancialEditData } from "@/modules/demand/business-case/financial";
import type { BadgeVariant } from "../business-case";
import {
  DollarSign, Briefcase, Target, Shield, HelpCircle,
} from "lucide-react";

// ── Execution & status class resolvers ─────────────────────────────

export function resolveExecutionVariantClass(variant: string): string {
  if (variant === 'internal') return 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/20';
  if (variant === 'hybrid') return 'border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/20';
  return 'border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/20';
}

export function resolveStatusBannerClass(status: string): string {
  if (status === 'under_review') return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800';
  if (status === 'approved' || status === 'manager_approval') return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800';
  if (status === 'published') return 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800';
  if (status === 'rejected') return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
  return 'bg-muted/50 border-border';
}

export function resolveStatusTextClass(status: string): string {
  if (status === 'under_review') return 'text-amber-700 dark:text-amber-300';
  if (status === 'approved' || status === 'manager_approval') return 'text-green-700 dark:text-green-300';
  if (status === 'published') return 'text-purple-700 dark:text-purple-300';
  if (status === 'rejected') return 'text-red-700 dark:text-red-300';
  return 'text-foreground';
}

export function resolveStatusBadgeClass(status: string): string {
  if (status === 'under_review') return 'border-amber-300 text-amber-700 dark:text-amber-300';
  if (status === 'approved' || status === 'manager_approval') return 'border-green-300 text-green-700 dark:text-green-300';
  if (status === 'published') return 'border-purple-300 text-purple-700 dark:text-purple-300';
  if (status === 'rejected') return 'border-red-300 text-red-700 dark:text-red-300';
  return '';
}

// ── Watermark resolvers ────────────────────────────────────────────

export function resolveWatermarkOpacity(status: string): string {
  if (status === 'draft') return '0.12';
  if (status === 'under_review') return '0.10';
  if (status === 'approved' || status === 'manager_approval') return '0.08';
  if (status === 'published') return '0.15';
  return '0.10';
}

export function resolveWatermarkColor(status: string): string {
  if (status === 'draft') return 'hsl(var(--muted-foreground))';
  if (status === 'under_review') return 'hsl(var(--accent-amber))';
  if (status === 'approved' || status === 'manager_approval') return 'hsl(var(--accent-cyan))';
  if (status === 'published') return 'hsl(var(--accent-purple))';
  return 'hsl(var(--muted-foreground))';
}

export function resolveWatermarkText(status: string): string {
  if (status === 'draft') return 'DRAFT';
  if (status === 'under_review') return 'UNDER REVIEW';
  if (status === 'approved') return 'APPROVED';
  if (status === 'manager_approval') return 'FINAL APPROVAL';
  if (status === 'published') return 'PUBLISHED';
  return '';
}

// ── Compliance resolvers ───────────────────────────────────────────

export function resolveComplianceAlertClass(complianceStatus: { criticalViolations: number; overallScore: number }): string {
  if (complianceStatus.criticalViolations > 0) return 'border-red-500 dark:border-red-900';
  if (complianceStatus.overallScore < 70) return 'border-yellow-500 dark:border-yellow-900';
  return 'border-green-500 dark:border-green-900';
}

export function resolveComplianceMessage(
  complianceStatus: { criticalViolations: number; totalViolations: number },
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  if (complianceStatus.criticalViolations > 0) {
    return t('demand.tabs.businessCase.criticalIssuesMustBeResolved', { count: complianceStatus.criticalViolations });
  }
  if (complianceStatus.totalViolations > 0) {
    return t('demand.tabs.businessCase.violationsFound', { count: complianceStatus.totalViolations });
  }
  return t('demand.tabs.businessCase.allCompliancePassed');
}

// ── Data source resolvers ──────────────────────────────────────────

export function resolveDataSourceVariant(dataSource: string): BadgeVariant {
  if (dataSource.includes('Knowledge Base')) return 'default';
  if (dataSource.includes('AI Estimates')) return 'secondary';
  return 'outline';
}

export function resolveDataSourceClass(dataSource: string): string {
  if (dataSource.includes('Knowledge Base')) return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30';
  if (dataSource.includes('AI Estimates')) return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
  return '';
}

export function resolveDataSourceLabel(dataSource: string, t: (key: string) => string): string {
  if (dataSource.includes('Knowledge Base')) return t('demand.tabs.businessCase.knowledgeBaseData');
  if (dataSource.includes('AI Estimates')) return t('demand.tabs.businessCase.aiEstimatesOnly');
  return dataSource;
}

export function normalizePercentValue(value: unknown): number | null {
  if (value == null || value === '') return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  const scaledValue = numericValue > 1 ? numericValue : numericValue * 100;
  return Math.max(0, Math.min(100, Math.round(scaledValue)));
}

// ── Recommendation resolvers ───────────────────────────────────────

export function resolveRecommendationCardClass(label: string): string {
  if (label === 'RECOMMENDED') return 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800';
  if (label === 'CONDITIONAL') return 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800';
  return 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800';
}

export function resolveRecommendationBadgeVariant(label: string): BadgeVariant {
  if (label === 'RECOMMENDED') return 'default';
  if (label === 'CONDITIONAL') return 'secondary';
  return 'destructive';
}

export function resolveRecommendationBadgeClass(label: string): string {
  if (label === 'RECOMMENDED') return 'bg-emerald-500';
  if (label === 'CONDITIONAL') return 'bg-amber-500 text-white';
  return '';
}

export function resolveApproachVariant(approach: string | undefined): BadgeVariant {
  if (approach === 'Go') return 'default';
  if (approach === 'No Go') return 'destructive';
  return 'secondary';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveDomainIcon(domain: string): any {
  if (domain === 'Finance') return DollarSign;
  if (domain === 'Business') return Briefcase;
  if (domain === 'Technical') return Target;
  if (domain === 'Security') return Shield;
  return HelpCircle;
}

export function resolvePriorityVariant(priority: string | undefined): BadgeVariant {
  if (priority === 'high') return 'destructive';
  if (priority === 'medium') return 'default';
  return 'secondary';
}

// ── Validation & utilities ─────────────────────────────────────────

export interface BusinessCaseFields {
  executiveSummary?: string;
  totalCostEstimate?: string | number;
  riskScore?: number;
}

export function validateBusinessCaseFields(
  data: BusinessCaseFields & Record<string, unknown>,
  t: (k: string) => string,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.executiveSummary?.trim()) {
    errors.executiveSummary = t('demand.tabs.businessCase.executiveSummaryRequired');
  }

  if (!data.totalCostEstimate || Number.parseFloat(String(data.totalCostEstimate)) <= 0) {
    errors.totalCostEstimate = t('demand.tabs.businessCase.totalCostPositive');
  }

  const totalBenefitEstimate = data.totalBenefitEstimate;
  if (!totalBenefitEstimate || Number.parseFloat(typeof totalBenefitEstimate === 'string' ? totalBenefitEstimate : JSON.stringify(totalBenefitEstimate)) <= 0) {
    errors.totalBenefitEstimate = t('demand.tabs.businessCase.totalBenefitPositive');
  }

  if (data.riskScore && (data.riskScore < 0 || data.riskScore > 100)) {
    errors.riskScore = "Risk score must be between 0 and 100";
  }

  return errors;
}

export function buildChangesSummary(
  changedFields: Set<string>,
  t: (key: string) => string,
): string {
  if (changedFields.size === 0) return t('demand.tabs.businessCase.noChangesDetected');

  const fieldLabels: Record<string, string> = {
    executiveSummary: t('demand.tabs.businessCase.executiveSummary'),
    totalCostEstimate: t('demand.tabs.businessCase.totalCost'),
    totalBenefitEstimate: t('demand.tabs.businessCase.totalBenefit'),
    roiPercentage: t('demand.tabs.businessCase.roiPercentage'),
    riskScore: t('demand.tabs.businessCase.riskScore'),
    riskLevel: t('demand.tabs.businessCase.riskLevel'),
    npvValue: t('demand.tabs.businessCase.npvValue'),
    paybackPeriod: t('demand.tabs.businessCase.paybackPeriod'),
    tcoBreakdown: t('demand.tabs.businessCase.tcoBreakdown'),
    recommendations: t('demand.tabs.businessCase.recommendations'),
    nextSteps: t('demand.tabs.businessCase.nextStepsLabel'),
    stakeholderAnalysis: t('demand.tabs.businessCase.stakeholderAnalysis'),
    implementationPlan: t('demand.tabs.businessCase.implementationPlan'),
    kpisAndMetrics: t('demand.tabs.businessCase.kpisAndMetrics'),
    businessRequirements: t('demand.tabs.businessCase.businessRequirements'),
    alternativeAnalysis: t('demand.tabs.businessCase.alternativeAnalysis'),
    complianceRequirements: t('demand.tabs.businessCase.complianceRequirements'),
    projectDependencies: t('demand.tabs.businessCase.projectDependencies'),
    backgroundContext: t('demand.tabs.businessCase.backgroundContext'),
    problemStatement: t('demand.tabs.businessCase.problemStatement'),
    objectivesAndScope: t('demand.tabs.businessCase.objectivesAndScope')
  };

  const changed = Array.from(changedFields)
    .map(field => fieldLabels[field] || field)
    .slice(0, 5);

  if (changed.length === 1) {
    return `Updated ${changed[0]}`;
  }
  if (changed.length <= 3) {
    return `Updated ${changed.join(", ")}`;
  }
  const remaining = changedFields.size - 3;
  return `Updated ${changed.slice(0, 3).join(", ")} and ${remaining} more section${remaining > 1 ? 's' : ''}`;
}

export function computeRoi(cost: string, benefit: string): string {
  const costNum = Number.parseFloat(cost);
  const benefitNum = Number.parseFloat(benefit);
  if (costNum > 0 && benefitNum > 0) {
    return (((benefitNum - costNum) / costNum) * 100).toFixed(2);
  }
  return "0.00";
}

export interface SaveClickCtx {
  latestVersion: { status: string } | null;
  editedData: (BusinessCaseFields & Record<string, unknown>) | null;
  financialEditData?: FinancialEditData | null;
  getLatestFinancialEditData?: () => FinancialEditData | null;
  versionScopeKey?: 'pilot' | 'full';
  versionScopeLabel?: string;
  validateFields: (data: Record<string, unknown>) => Record<string, string>;
  setValidationErrors: (v: Record<string, string>) => void;
  setPreparedVersionEditedContent?: (value: Record<string, unknown> | null) => void;
  setShowVersionDialog: (v: boolean) => void;
  setIsEditMode: (v: boolean) => void;
  setEditedData: (v: null) => void;
  toast: (v: Record<string, unknown>) => void;
  t: (key: string) => string;
}

export function handleSaveClick(ctx: SaveClickCtx): void {
  if (ctx.latestVersion && (ctx.latestVersion.status === 'manager_approval' || ctx.latestVersion.status === 'published')) {
    ctx.toast({
      title: ctx.t('demand.tabs.businessCase.cannotSave'),
      description: ctx.t('demand.tabs.businessCase.documentLocked'),
      variant: "destructive"
    });
    ctx.setIsEditMode(false);
    ctx.setEditedData(null);
    return;
  }

  globalThis.setTimeout(() => {
    const latestFinancialEditData = ctx.getLatestFinancialEditData?.() ?? ctx.financialEditData ?? null;
    const hasFinancialChanges = Boolean(latestFinancialEditData?.hasChanges);
    const mergedEditedData = {
      ...(ctx.editedData ?? {}),
      ...(ctx.versionScopeKey ? { _businessCaseViewScope: ctx.versionScopeKey } : {}),
      ...(ctx.versionScopeLabel ? { _businessCaseViewScopeLabel: ctx.versionScopeLabel } : {}),
      ...(hasFinancialChanges ? {
        totalCostEstimate: latestFinancialEditData?.totalCostEstimate,
        savedFinancialAssumptions: latestFinancialEditData?.financialAssumptions,
        savedDomainParameters: latestFinancialEditData?.domainParameters,
        aiRecommendedBudget: latestFinancialEditData?.aiRecommendedBudget,
        costOverrides: latestFinancialEditData?.costOverrides ?? {},
        benefitOverrides: latestFinancialEditData?.benefitOverrides ?? {},
        _hasFinancialChanges: true,
      } : {}),
    };

    if (!ctx.editedData && !hasFinancialChanges) {
      ctx.toast({
        title: ctx.t('demand.tabs.businessCase.error'),
        description: ctx.t('demand.tabs.businessCase.waitForData'),
        variant: "destructive"
      });
      return;
    }

    const errors = ctx.validateFields(mergedEditedData);
    ctx.setValidationErrors(errors);

    if (Object.keys(errors).length === 0) {
      ctx.setPreparedVersionEditedContent?.(mergedEditedData);
      ctx.setShowVersionDialog(true);
    } else {
      ctx.toast({
        title: ctx.t('demand.tabs.businessCase.validationError'),
        description: ctx.t('demand.tabs.businessCase.fixErrorsFirst'),
        variant: "destructive"
      });
    }
  }, 0);
}
