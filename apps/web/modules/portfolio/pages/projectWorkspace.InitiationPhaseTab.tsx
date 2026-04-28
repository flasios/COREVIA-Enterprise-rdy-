import { useMemo, Suspense, lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GitBranch, Target, Layers } from 'lucide-react';
import type {
  ProjectData,
  GateData,
  StakeholderData,
  ManagementSummary,
  DemandReportData,
  BusinessCaseData,
  DependencyData,
  AssumptionData,
  ConstraintData,
} from '@/modules/portfolio/workspace';
import {
  normalizeFinancialData,
  normalizeScope,
  normalizeStakeholders,
  isTimelineObject,
  type RawBusinessCaseFinancials,
  type NormalizedStakeholder,
} from '@/modules/portfolio/workspace';
import { PhaseGateWorkflow } from '@/modules/portfolio/workspace';

// Lazy load sub-tab components
const ProjectFoundationTab = lazy(() => import('@/modules/portfolio/workspace').then((m) => ({ default: m.ProjectFoundationTab })));
const StakeholderHubTab = lazy(() => import('@/modules/portfolio/workspace').then((m) => ({ default: m.StakeholderHubTab })));
const RiskConstraintsTab = lazy(() => import('@/modules/portfolio/workspace').then((m) => ({ default: m.RiskConstraintsTab })));
const SuccessFrameworkTab = lazy(() => import('@/modules/portfolio/workspace').then((m) => ({ default: m.SuccessFrameworkTab })));
const StrategicFitTab = lazy(() => import('@/modules/demand').then((m) => ({ default: m.StrategicFitTab })));

const TabLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

export default function InitiationPhaseTab({
  project,
  businessCase,
  demandReport,
  gate,
  stakeholders,
  management,
  activeSubTab = 'strategic-fit',

  onSubTabChange: _onSubTabChange,
  onGateApproval,

  onAssignPM: _onAssignPM,
  onAddStakeholder,
  onAddRisk,
  onAddDependency,
  onAddAssumption,
  onAddConstraint,
  onEditDependency,
  onEditAssumption,
  onEditConstraint,
  onDeleteDependency,
  onDeleteAssumption,
  onDeleteConstraint,
  effectiveCurrentPhase = 'initiation',
}: {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  demandReport?: DemandReportData;
  gate?: GateData;
  stakeholders: StakeholderData[];
  management?: ManagementSummary;
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
  onGateApproval: (gate: GateData) => void;
  onAssignPM: (pmId: string) => void;
  onAddStakeholder: () => void;
  onAddRisk: () => void;
  onAddDependency: () => void;
  onAddAssumption: () => void;
  onAddConstraint: () => void;
  onEditDependency: (dep: DependencyData) => void;
  onEditAssumption: (assumption: AssumptionData) => void;
  onEditConstraint: (constraint: ConstraintData) => void;
  onDeleteDependency: (id: string) => void;
  onDeleteAssumption: (id: string) => void;
  onDeleteConstraint: (id: string) => void;
  effectiveCurrentPhase?: string;
}) {
  const { t } = useTranslation();

  // Get demand report ID for StrategicFitTab
  const demandReportId = project.demandReportId || (demandReport as Record<string, unknown> | undefined)?.id as string | undefined;

  const shouldPollVersions = activeSubTab === 'strategic-fit';

  // Fetch versions to determine Business Case and Requirements approval status
  const { data: versionsData } = useQuery({
    queryKey: ['/api/demand-reports', demandReportId, 'versions'],
    enabled: !!demandReportId && shouldPollVersions,
    refetchOnWindowFocus: true,
    refetchInterval: shouldPollVersions ? 30000 : false,
    staleTime: 30000,
  });

  // Memoize version approval calculations to avoid recalculating on every render
  const { businessCaseApproved, requirementsApproved, enterpriseArchitectureApproved } = useMemo(() => {
    const vData = versionsData as Record<string, unknown> | undefined;
    const versions = vData && vData.success && vData.data;
    if (!versions || !Array.isArray(versions) || versions.length === 0) {
      return { businessCaseApproved: false, requirementsApproved: false, enterpriseArchitectureApproved: false };
    }

    const approvedStatuses = ['published'];
    return {
      businessCaseApproved: versions.some((v: Record<string, unknown>) =>
        v.versionType === 'business_case' && approvedStatuses.includes(v.status as string)
      ),
      requirementsApproved: versions.some((v: Record<string, unknown>) =>
        v.versionType === 'requirements' && approvedStatuses.includes(v.status as string)
      ),
      enterpriseArchitectureApproved: versions.some((v: Record<string, unknown>) =>
        v.versionType === 'enterprise_architecture' && approvedStatuses.includes(v.status as string)
      ),
    };
  }, [versionsData]);

  const _formatCurrency = (amount?: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (num === undefined || num === null || num === 0) return 'N/A';
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Normalize financial data from business case
  const _financials = normalizeFinancialData(businessCase as unknown as RawBusinessCaseFinancials);

  // Helper to access nested content - business case and demand report data can be at root or under content
  const bc = businessCase?.content || businessCase;
  const dr = demandReport?.content || demandReport;
  const stakeholderAnalysis = bc?.stakeholderAnalysis;

  // Extract business case sections with lineage tracking
  const _executiveSummary = bc?.executiveSummary;
  const _objectives = bc?.smartObjectives || bc?.objectives;
  const rawScope = bc?.scopeDefinition || bc?.scope;
  const _normalizedScopeData = normalizeScope(rawScope);
  const _deliverables = bc?.expectedDeliverables || bc?.deliverables;
  const rawTimeline = bc?.timeline || bc?.implementationTimeline;
  const _timelineData = isTimelineObject(rawTimeline) ? rawTimeline : undefined;
  const _budget = bc?.budgetEstimates || bc?.financialOverview;
  const structuredStakeholderAnalysis = Array.isArray(stakeholderAnalysis) ? undefined : stakeholderAnalysis;
  const _bcStakeholders = structuredStakeholderAnalysis?.stakeholders ||
                         structuredStakeholderAnalysis?.keyStakeholders ||
                         (Array.isArray(stakeholderAnalysis) ? stakeholderAnalysis : undefined) ||
                         bc?.stakeholders ||
                         bc?.keyStakeholders;

  // Normalize stakeholders from demand report and business case - with safety checks
  let _normalizedBcStakeholders: NormalizedStakeholder[] = [];
  try {
    const drRecord = dr as Record<string, unknown> | undefined;
    _normalizedBcStakeholders = normalizeStakeholders({
      demandReport: dr ? {
        requestorName: drRecord?.requestorName as string | undefined,
        requestorEmail: drRecord?.requestorEmail as string | undefined,
        demandOwner: drRecord?.demandOwner as string | undefined,
        contactPerson: drRecord?.contactPerson as string | undefined,
        stakeholders: drRecord?.stakeholders as string | null | undefined,
        keyStakeholders: drRecord?.keyStakeholders as string | null | undefined,
        organizationName: drRecord?.organizationName as string | undefined,
        department: drRecord?.department as string | undefined,
      } : undefined,
      businessCase: bc ? {
        stakeholders: bc.stakeholders,
        keyStakeholders: bc.keyStakeholders,
        stakeholderAnalysis: structuredStakeholderAnalysis,
      } : undefined,
    });
  } catch (e) {
    console.error('Error normalizing stakeholders:', e);
  }

  const _LineageTag = ({ source, field }: { source: string; field: string }) => (
    <Badge variant="outline" className="text-[10px] gap-1 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
      <Layers className="w-2.5 h-2.5" />
      {source} → {field}
    </Badge>
  );

  return (
    <div className="space-y-6">
      {/* Gate Status Banner - always visible */}
      {gate && (
        <Card className={`border-2 ${
          gate.status === 'approved' || gate.status === 'passed' ? 'bg-emerald-900/20 border-emerald-500/50' :
          gate.status === 'pending' || gate.status === 'in_review' ? 'bg-amber-900/20 border-amber-500/50' :
          gate.status === 'rejected' || gate.status === 'failed' ? 'bg-red-900/20 border-red-500/50' :
          'bg-card/60 border-border'
        }`}>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                gate.status === 'approved' || gate.status === 'passed' ? 'bg-emerald-500/20' :
                gate.status === 'pending' || gate.status === 'in_review' ? 'bg-amber-500/20' :
                gate.status === 'rejected' || gate.status === 'failed' ? 'bg-red-500/20' :
                'bg-muted'
              }`}>
                <GitBranch className={`w-5 h-5 ${
                  gate.status === 'approved' || gate.status === 'passed' ? 'text-emerald-600 dark:text-emerald-400' :
                  gate.status === 'pending' || gate.status === 'in_review' ? 'text-amber-600 dark:text-amber-400' :
                  gate.status === 'rejected' || gate.status === 'failed' ? 'text-red-600 dark:text-red-400' :
                  'text-muted-foreground'
                }`} />
              </div>
              <div>
                <div className="font-medium">{gate.gateName}</div>
                <div className="text-sm text-muted-foreground">
                  {gate.status === 'approved' || gate.status === 'passed' ? t('portfolio.initiation.phaseApproved') :
                   gate.status === 'pending' || gate.status === 'in_review' ? t('portfolio.initiation.awaitingApproval') :
                   gate.status === 'rejected' || gate.status === 'failed' ? t('portfolio.initiation.approvalRejected') :
                   t('portfolio.initiation.gateNotStarted')}
                </div>
              </div>
            </div>
            {(gate.status === 'pending' || gate.status === 'not_started') && (
              <Button size="sm" onClick={() => onGateApproval(gate)} data-testid="button-review-initiation-gate">
                {t('portfolio.initiation.reviewGate')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Project Foundation - Charter + Governance */}
      {activeSubTab === 'foundation' && (
        <Suspense fallback={<TabLoader />}>
          <ProjectFoundationTab
            project={project}
            businessCase={businessCase}
            demandReport={demandReport}
          />
        </Suspense>
      )}

      {/* Stakeholder Hub - Stakeholders + Communication */}
      {activeSubTab === 'stakeholders' && (
        <Suspense fallback={<TabLoader />}>
          <StakeholderHubTab
            project={project}
            businessCase={businessCase}
            stakeholders={stakeholders}
            demandReport={demandReport}
            onAddStakeholder={onAddStakeholder}
          />
        </Suspense>
      )}

      {/* Risk & Constraints - Risks + Dependencies + Assumptions */}
      {activeSubTab === 'risk-controls' && (
        <Suspense fallback={<TabLoader />}>
          <RiskConstraintsTab
            project={project}
            businessCase={businessCase}
            management={management}
            onAddRisk={onAddRisk}
            onAddDependency={onAddDependency}
            onAddAssumption={onAddAssumption}
            onAddConstraint={onAddConstraint}
            onEditDependency={onEditDependency}
            onEditAssumption={onEditAssumption}
            onEditConstraint={onEditConstraint}
            onDeleteDependency={onDeleteDependency}
            onDeleteAssumption={onDeleteAssumption}
            onDeleteConstraint={onDeleteConstraint}
          />
        </Suspense>
      )}

      {/* Success Framework - Metrics + Readiness */}
      {activeSubTab === 'success' && (
        <Suspense fallback={<TabLoader />}>
          <SuccessFrameworkTab
            project={project}
            businessCase={businessCase}
            demandReport={demandReport}
            stakeholders={stakeholders}
          />
        </Suspense>
      )}

      {/* Strategic Fit Sub-Tab */}
      {activeSubTab === 'strategic-fit' && demandReportId && (
        <Suspense fallback={<TabLoader />}>
          <StrategicFitTab
            reportId={demandReportId}
            canAccess={true}
            businessCaseApproved={businessCaseApproved}
            requirementsApproved={requirementsApproved}
            enterpriseArchitectureApproved={enterpriseArchitectureApproved}
            enableIntelligenceRail={false}
          />
        </Suspense>
      )}

      {activeSubTab === 'strategic-fit' && !demandReportId && (
        <Card className="bg-card/60 border-border">
          <CardContent className="py-12 text-center">
            <Target className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('portfolio.initiation.strategicFitAnalysis')}</h3>
            <p className="text-muted-foreground">
              {t('portfolio.initiation.noDemandReportLinked')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Governance / Gate Workflow Sub-Tab */}
      {activeSubTab === 'governance' && (
        <PhaseGateWorkflow
          projectId={project.id}
          currentPhase={effectiveCurrentPhase}
          onPhaseChange={(phase) => console.log('Phase changed to:', phase)}
        />
      )}

    </div>
  );
}
