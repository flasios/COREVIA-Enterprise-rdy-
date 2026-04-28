import type { PortfolioProject } from './PMOOfficePage.types';

export function asText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

export function normalizeConversionRequestStatus(value: unknown): 'pending' | 'under_review' | 'approved' | 'rejected' {
  return value === 'under_review' || value === 'approved' || value === 'rejected' ? value : 'pending';
}

// ── Extracted PMO Document Classification Helpers ──

const PMO_KEYWORDS = ["pmo", "portfolio", "governance", "standard", "template", "playbook", "policy"];

export function isPmoDocument(doc: Record<string, unknown>): boolean {
  const category = (typeof doc.category === 'string' ? doc.category : '').toLowerCase();
  const folderPath = String((doc as { folderPath?: string }).folderPath || "").toLowerCase();
  const tagsValue = (doc as { tags?: unknown }).tags;
  let tags: string;
  if (Array.isArray(tagsValue)) {
    tags = tagsValue.map((tag) => String(tag).toLowerCase()).join(" ");
  } else {
    tags = (typeof tagsValue === 'string' ? tagsValue : '').toLowerCase();
  }
  const haystack = `${category} ${folderPath} ${tags}`;
  return PMO_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

const FOLDER_CLASSIFY_RULES: ReadonlyArray<[string[], string]> = [
  [["pmo/policies", "pmo/policy"], "Policies"],
  [["pmo/process", "pmo/procedure", "pmo/sop"], "Process"],
  [["pmo/research"], "Research"],
  [["pmo/guidelines", "pmo/guideline", "pmo/standards"], "Guidelines"],
];

const CATEGORY_CLASSIFY_MAP: Record<string, string> = {
  research: "Research", regulatory: "Policies", legal: "Policies", operational: "Process",
};

const HAYSTACK_CLASSIFY_RULES: ReadonlyArray<[string[], string]> = [
  [["policy", "policies"], "Policies"],
  [["process", "procedure", "sop"], "Process"],
  [["research", "study", "insight"], "Research"],
  [["guideline", "guide", "playbook", "standard"], "Guidelines"],
];

export function classifyPmoDoc(doc: Record<string, unknown>): string {
  const category = (typeof doc.category === 'string' ? doc.category : '').toLowerCase();
  const tagsValue = (doc as { tags?: unknown }).tags;
  let tags: string;
  if (Array.isArray(tagsValue)) {
    tags = tagsValue.map((tag) => String(tag).toLowerCase()).join(" ");
  } else {
    tags = (typeof tagsValue === 'string' ? tagsValue : '').toLowerCase();
  }
  const folderPath = String((doc as { folderPath?: string }).folderPath || "").toLowerCase();

  for (const [patterns, label] of FOLDER_CLASSIFY_RULES) {
    if (patterns.some((p) => folderPath.includes(p))) return label;
  }
  if (CATEGORY_CLASSIFY_MAP[category]) return CATEGORY_CLASSIFY_MAP[category];

  const haystack = `${category} ${tags} ${folderPath}`;
  for (const [keywords, label] of HAYSTACK_CLASSIFY_RULES) {
    if (keywords.some((k) => haystack.includes(k))) return label;
  }
  return "Guidelines";
}

// ── Dashboard Color Helpers (extracted to eliminate nested ternaries) ──

export function healthBg(status: string): string {
  if (status === 'on_track') return 'bg-emerald-500';
  if (status === 'at_risk') return 'bg-amber-500';
  return 'bg-red-500';
}

export function healthHex(status: string): string {
  if (status === 'on_track') return '#10b981';
  if (status === 'at_risk') return '#f59e0b';
  return '#ef4444';
}

export function thresholdBg(value: number, good: number, mid: number): string {
  if (value >= good) return 'bg-emerald-500';
  if (value >= mid) return 'bg-amber-500';
  return 'bg-red-500';
}

export function thresholdBgInverse(value: number, good: number, mid: number): string {
  if (value <= good) return 'bg-emerald-500';
  if (value <= mid) return 'bg-amber-500';
  return 'bg-red-500';
}

export function utilThresholdText(value: number): string {
  if (value > 90) return 'text-red-600';
  if (value > 70) return 'text-amber-600';
  return 'text-emerald-600';
}

export function utilThresholdBg(value: number): string {
  if (value > 90) return 'bg-red-500';
  if (value > 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function progressBg(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-blue-500';
  return 'bg-slate-400';
}

export function priorityBadgeClass(priority: string): string {
  if (priority === 'critical') return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400';
  if (priority === 'high') return 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400';
  if (priority === 'medium') return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400';
}

export function badgeVariantByThreshold(value: number, high: number, mid: number): 'destructive' | 'secondary' | 'outline' {
  if (value >= high) return 'destructive';
  if (value >= mid) return 'secondary';
  return 'outline';
}

export function budgetBadgeVariant(util: number): 'destructive' | 'secondary' | 'default' {
  if (util > 90) return 'destructive';
  if (util > 70) return 'secondary';
  return 'default';
}

export function _eventDotColor(status: string): string {
  if (status === 'approved') return 'bg-emerald-500';
  if (status === 'rejected') return 'bg-red-500';
  return 'bg-slate-400';
}

export function budgetRemainingLabel(overageVal: number, remainingVal: number): string {
  if (overageVal > 0) return `${(overageVal / 1000000).toFixed(1)}M`;
  if (remainingVal > 0) return `${(remainingVal / 1000000).toFixed(1)}M`;
  return '0';
}

// ── Score-to-Color Helpers (extracted from nested ternaries) ──

export function _scoreHex(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

export function perfBgBorder(value: number | null): string {
  if (value == null) return 'bg-slate-50/80 border-slate-200/60 dark:bg-slate-800/40 dark:border-slate-700/40';
  if (value >= 1) return 'bg-emerald-50/80 border-emerald-200/60 dark:bg-emerald-500/10 dark:border-emerald-500/20';
  if (value >= 0.8) return 'bg-amber-50/80 border-amber-200/60 dark:bg-amber-500/10 dark:border-amber-500/20';
  return 'bg-red-50/80 border-red-200/60 dark:bg-red-500/10 dark:border-red-500/20';
}

export function perfText(value: number | null): string {
  if (value == null) return 'text-muted-foreground/70';
  if (value >= 1) return 'text-emerald-600';
  if (value >= 0.8) return 'text-amber-600';
  return 'text-red-600';
}

export function cpiLabel(value: number | null): string {
  if (value == null) return 'Insufficient data';
  if (value >= 1) return 'Under budget';
  if (value >= 0.8) return 'Near budget';
  return 'Over budget';
}

export function spiLabel(value: number | null): string {
  if (value == null) return 'Insufficient data';
  if (value >= 1) return 'Ahead of plan';
  if (value >= 0.8) return 'Slight delay';
  return 'Behind schedule';
}

export function _scoreTextColor(value: number, inverse: boolean): string {
  if (inverse) {
    if (value < 30) return 'text-emerald-600';
    if (value < 70) return 'text-amber-600';
    return 'text-red-600';
  }
  if (value >= 70) return 'text-emerald-600';
  if (value >= 40) return 'text-amber-600';
  return 'text-red-600';
}

export function _riskBg(score: number): string {
  if (score < 30) return 'bg-emerald-500';
  if (score < 70) return 'bg-amber-500';
  return 'bg-red-500';
}

export function velocityText(days: number): string {
  if (days > 90) return 'text-red-600';
  if (days > 30) return 'text-amber-600';
  return 'text-emerald-600';
}

export function velocityBg(days: number): string {
  if (days > 90) return 'bg-red-500';
  if (days > 30) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function _ribbonColor(ok: boolean, warn: boolean): string {
  if (ok) return 'text-emerald-600 dark:text-emerald-400';
  if (warn) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

// ── Extracted Evidence & Governance Score Computations ──

export function computeEvidenceFlags(lengths: {
  gateHistory: number;
  pendingGates: number;
  pendingWbs: number;
  changeRequests: number;
  portfolioTotal: number;
  portfolioActive: number;
  portfolioCompleted: number;
  portfolioBudget: number;
  portfolioSpend: number;
  approvedDemand: number;
  conversionTotal: number;
}) {
  const hasGovernanceOperationalEvidence =
    lengths.gateHistory > 0 ||
    lengths.pendingGates > 0 ||
    lengths.pendingWbs > 0 ||
    lengths.changeRequests > 0;
  const hasPortfolioExecutionEvidence =
    lengths.portfolioTotal > 0 ||
    lengths.portfolioActive > 0 ||
    lengths.portfolioCompleted > 0 ||
    lengths.portfolioBudget > 0 ||
    lengths.portfolioSpend > 0;
  const _hasStrategicExecutionEvidence =
    lengths.approvedDemand > 0 ||
    hasPortfolioExecutionEvidence ||
    hasGovernanceOperationalEvidence ||
    lengths.conversionTotal > 0;
  return { hasGovernanceOperationalEvidence, hasPortfolioExecutionEvidence, _hasStrategicExecutionEvidence };
}

export function computeGovernanceScores(params: {
  hasGovernanceEvidence: boolean;
  averageGateReadiness: number;
  insightHealthScore: number;
  insightCriticalGaps: number;
  portfolioHealth: number;
  conversionSuccessRate: number;
  portfolioBudget: number;
  budgetUtilization: number;
  changeRequestsLength: number;
  implementedChangeRequests: number;
  healthBreakdown: { at_risk: number; critical: number };
  pendingRequestsLength: number;
  pendingGateApprovalsLength: number;
  highImpactChanges: number;
  totalPendingApprovals: number;
  insightAlerts: number;
}) {
  const gapDeduction = params.insightCriticalGaps > 0 ? Math.max(0, 100 - (params.insightCriticalGaps * 8)) : 0;
  const governanceReadinessScore = params.hasGovernanceEvidence
    ? Math.max(0, Math.min(100, Math.round(
        (params.averageGateReadiness * 0.45) + (params.insightHealthScore * 0.35) + (gapDeduction * 0.2),
      )))
    : 0;
  const valueRealizationScore = Math.max(0, Math.min(100, Math.round(
    (params.portfolioHealth * 0.4)
      + (params.conversionSuccessRate * 0.25)
      + ((params.portfolioBudget > 0 ? Math.max(0, 100 - params.budgetUtilization) : 0) * 0.15)
      + ((params.changeRequestsLength > 0 ? (params.implementedChangeRequests / params.changeRequestsLength) * 100 : 0) * 0.2),
  )));
  const portfolioDragIndex = Math.max(0, Math.min(100, Math.round(
    (params.healthBreakdown.at_risk * 7) + (params.healthBreakdown.critical * 12) + (params.pendingRequestsLength * 3) + (params.pendingGateApprovalsLength * 6),
  )));
  const approvalPressureScore = Math.max(0, Math.min(100,
    (params.totalPendingApprovals * 8) + (params.highImpactChanges * 6) + (params.pendingGateApprovalsLength * 10) + (params.insightAlerts * 2),
  ));
  return { governanceReadinessScore, valueRealizationScore, portfolioDragIndex, approvalPressureScore };
}

export function computeHighAttentionProjects(activeProjects: PortfolioProject[]) {
  return activeProjects
    .map((project) => {
      const budget = Number(project.approvedBudget || 0);
      const spend = Number(project.actualSpend || 0);
      const burnRate = budget > 0 ? Math.round((spend / budget) * 100) : 0;
      let healthPenalty = 8;
      if (project.healthStatus === 'critical') healthPenalty = 40;
      else if (project.healthStatus === 'at_risk') healthPenalty = 24;
      const riskScore = Number(project.riskScore || 0);
      const deliveryScore = Math.max(0, 100 - Number(project.overallProgress || 0));
      return {
        id: String(project.id),
        name: project.projectName || project.projectCode || 'Project',
        phase: String(project.currentPhase || 'intake').replaceAll('_', ' '),
        health: String(project.healthStatus || 'on_track'),
        burnRate,
        riskScore,
        score: healthPenalty + Math.min(40, riskScore) + Math.min(30, Math.max(0, burnRate - 100)) + Math.round(deliveryScore * 0.15),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}

export function buildExecutiveDecisionAgenda(counts: {
  pendingGates: number;
  highImpactChanges: number;
  pendingRequests: number;
  pendingWbs: number;
}) {
  return [
    counts.pendingGates > 0
      ? { title: 'Clear gate decisions', description: `${counts.pendingGates} phase gate items are waiting for board-level disposition.`, action: 'Review gates', tab: 'gates' as const, tone: 'amber' as const }
      : null,
    counts.highImpactChanges > 0
      ? { title: 'Resolve high-impact change requests', description: `${counts.highImpactChanges} changes could affect value, timeline, or executive commitments.`, action: 'Review changes', tab: 'change-requests' as const, tone: 'rose' as const }
      : null,
    counts.pendingRequests > 0
      ? { title: 'Accelerate demand conversion', description: `${counts.pendingRequests} demands are waiting to become governed portfolio work.`, action: 'Review conversions', tab: 'conversion' as const, tone: 'sky' as const }
      : null,
    counts.pendingWbs > 0
      ? { title: 'Lock execution baselines', description: `${counts.pendingWbs} WBS packages are pending approval before controlled execution.`, action: 'Review WBS', tab: 'wbs' as const, tone: 'violet' as const }
      : null,
  ].filter(Boolean) as Array<{
    title: string;
    description: string;
    action: string;
    tab: 'conversion' | 'wbs' | 'gates' | 'change-requests';
    tone: 'amber' | 'rose' | 'sky' | 'violet';
  }>;
}

// ── Extracted helpers to reduce PMOOffice cognitive complexity ──

export function _openEvidencePanelIfPending(
  pendingCount: number,
  setOpen: (v: boolean) => void,
) {
  if (pendingCount > 0) {
    setOpen(true);
  }
}

export function resetEvidencePanelIfEmpty(
  pendingCount: number,
  setOpen: (v: boolean) => void,
  setDismissed: (v: boolean) => void,
) {
  if (pendingCount === 0) {
    setOpen(false);
    setDismissed(false);
  }
}
