import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  Target,
  Layers,
  CheckCircle2,
  XCircle,
  TrendingUp,
  CalendarDays,
  Users,
  MessageSquare,
  Shield,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';

import type {
  ProjectData,
  StakeholderData,
  ManagementSummary,
  BusinessCaseData,
  DemandReportData,
  DependencyData,
  AssumptionData,
  ConstraintData,
} from '../../types';

import { ProjectFoundationTab } from './wrappers/ProjectFoundationTab';
import { StakeholderHubTab } from './wrappers/StakeholderHubTab';
import { RiskConstraintsTab } from './wrappers/RiskConstraintsTab';
import { SuccessFrameworkTab } from './wrappers/SuccessFrameworkTab';
import { formatCurrency } from '../../utils';
import { normalizeStakeholders } from '../../utils/normalizers';

type Dependency = DependencyData;
type Assumption = AssumptionData;
type Constraint = ConstraintData;

interface ProjectObjective {
  objective?: string;
  name?: string;
  title?: string;
  measure?: string;
  target?: string;
}

interface Deliverable {
  name?: string;
  title?: string;
  deliverable?: string;
  description?: string;
}

interface ScopeObject {
  inScope?: string[];
  outOfScope?: string[];
}

interface TimelineObject {
  startDate?: string | Date;
  endDate?: string | Date;
  duration?: string;
  totalDuration?: string;
}

function isScopeObject(value: unknown): value is ScopeObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function _isTimelineObject(value: unknown): value is TimelineObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isObjectiveObject(value: unknown): value is ProjectObjective {
  return typeof value === 'object' && value !== null;
}

function isDeliverableObject(value: unknown): value is Deliverable {
  return typeof value === 'object' && value !== null;
}

interface InitiationPhaseTabProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  demandReport?: DemandReportData;
  stakeholders: StakeholderData[];
  management?: ManagementSummary;
  onAssignPM: (pmId: string) => void;
  onAddStakeholder: () => void;
  onAddRisk: () => void;
  onAddDependency: () => void;
  onAddAssumption: () => void;
  onAddConstraint: () => void;
  onEditDependency: (dep: Dependency) => void;
  onEditAssumption: (assumption: Assumption) => void;
  onEditConstraint: (constraint: Constraint) => void;
  onDeleteDependency: (id: string) => void;
  onDeleteAssumption: (id: string) => void;
  onDeleteConstraint: (id: string) => void;
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
}

export const INITIATION_SUB_TABS = [
  { id: 'overview', label: 'Overview', icon: FileText, description: 'Business case & objectives' },
  { id: 'foundation', label: 'Project Foundation', icon: Shield, description: 'Charter & governance' },
  { id: 'stakeholders', label: 'Stakeholder Hub', icon: MessageSquare, description: 'Stakeholders & communication' },
  { id: 'risk-controls', label: 'Risk & Constraints', icon: AlertTriangle, description: 'Risks, dependencies, assumptions' },
  { id: 'success', label: 'Success Framework', icon: Target, description: 'KPIs & readiness tracking' },
];

export function InitiationPhaseTab({
  project,
  businessCase,
  demandReport,
  stakeholders,
  management,
   
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
  activeSubTab: externalActiveSubTab,
  onSubTabChange,
}: InitiationPhaseTabProps) {
  const [internalActiveSubTab, setInternalActiveSubTab] = useState('overview');
  
  const activeSubTab = externalActiveSubTab ?? internalActiveSubTab;
  const setActiveSubTab = onSubTabChange ?? setInternalActiveSubTab;
  const showInlineSubTabs = !externalActiveSubTab;

  const bc = businessCase?.content || businessCase;
  const stakeholderAnalysis = bc?.stakeholderAnalysis;
  const structuredStakeholderAnalysis =
    stakeholderAnalysis && typeof stakeholderAnalysis === 'object' && !Array.isArray(stakeholderAnalysis)
      ? stakeholderAnalysis
      : undefined;

  const executiveSummary = bc?.executiveSummary;
  const objectives = bc?.smartObjectives || bc?.objectives;
  const scope = bc?.scopeDefinition || bc?.scope;
  const deliverables = bc?.expectedDeliverables || bc?.deliverables;
  const timeline = bc?.timeline || bc?.implementationTimeline;
  const timelineData = typeof timeline === 'string' ? undefined : timeline;
  const budget = bc?.budgetEstimates || bc?.financialOverview;
  const bcStakeholders = structuredStakeholderAnalysis?.stakeholders ||
    structuredStakeholderAnalysis?.keyStakeholders ||
    bc?.stakeholders ||
    bc?.keyStakeholders;
  const derivedStakeholders = normalizeStakeholders({
    demandReport: demandReport ? {
      requestorName: demandReport.requestorName,
      requestorEmail: demandReport.requestorEmail,
      demandOwner: demandReport.demandOwner,
      contactPerson: demandReport.contactPerson,
      stakeholders: demandReport.stakeholders,
      keyStakeholders: demandReport.keyStakeholders,
      organizationName: demandReport.organizationName,
      department: demandReport.department,
    } : undefined,
    businessCase: bc ? {
      stakeholders: bc.stakeholders,
      keyStakeholders: bc.keyStakeholders,
      stakeholderAnalysis: structuredStakeholderAnalysis,
    } : undefined,
  });
  const visibleStakeholders = stakeholders.length > 0
    ? stakeholders.slice(0, 5).map((stakeholder) => ({
        id: stakeholder.id,
        name: stakeholder.name,
        role: stakeholder.role || stakeholder.stakeholderType || '',
        source: 'project' as const,
      }))
    : derivedStakeholders.slice(0, 5).map((stakeholder) => ({
        id: stakeholder.id,
        name: stakeholder.name,
        role: stakeholder.role || stakeholder.title || stakeholder.organization || 'Derived stakeholder',
        source: stakeholder.source,
      }));
  const hasBusinessCase = Boolean(businessCase);
  const hasDemandReport = Boolean(demandReport);
  const stakeholderCount = stakeholders.length;
  const dependencyCount = management?.dependencies?.length || 0;
  const assumptionCount = management?.assumptions?.length || 0;
  const constraintCount = management?.constraints?.length || 0;

  const LineageTag = ({ source, field }: { source: string; field: string }) => (
    <Badge variant="outline" className="text-[10px] gap-1 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
      <Layers className="w-2.5 h-2.5" />
      {source} → {field}
    </Badge>
  );

  return (
    <div className="space-y-6">
      {showInlineSubTabs && (
        <div className="flex gap-1 border-b border-border pb-1.5">
          {INITIATION_SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeSubTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
              data-testid={`button-initiation-subtab-${tab.id}`}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeSubTab === 'foundation' && (
        <ProjectFoundationTab
          project={project}
          businessCase={businessCase}
          demandReport={demandReport}
        />
      )}

      {activeSubTab === 'stakeholders' && (
        <StakeholderHubTab
          project={project}
          businessCase={businessCase}
          stakeholders={stakeholders}
          demandReport={demandReport}
          onAddStakeholder={onAddStakeholder}
        />
      )}

      {activeSubTab === 'risk-controls' && (
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
      )}

      {activeSubTab === 'success' && (
        <SuccessFrameworkTab
          project={project}
          businessCase={businessCase}
          demandReport={demandReport}
          stakeholders={stakeholders}
        />
      )}

      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          <Card className="relative overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 via-white to-slate-50/70">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.12)_0%,_transparent_55%)]" />
            <CardContent className="relative p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-indigo-500/80">Initiation Command Deck</p>
                  <h3 className="text-2xl font-semibold text-slate-900">Business Case Readiness</h3>
                  <p className="text-sm text-muted-foreground max-w-2xl">
                    Confirm the project foundation, governance, and stakeholder alignment before moving into planning.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="gap-2" onClick={onAddRisk}>
                    <AlertTriangle className="h-4 w-4" />
                    Log Risk
                  </Button>
                  <Button size="sm" variant="outline" className="gap-2" onClick={onAddStakeholder}>
                    <Users className="h-4 w-4" />
                    Add Stakeholder
                  </Button>
                  <Button size="sm" variant="outline" className="gap-2" onClick={onAddDependency}>
                    <Layers className="h-4 w-4" />
                    Add Dependency
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-indigo-100/70 bg-white/90 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Demand Report</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {hasDemandReport ? 'Approved' : 'Missing'}
                  </div>
                  <Badge variant="secondary" className="mt-2 text-[10px]">
                    {hasDemandReport ? 'Ready' : 'Action needed'}
                  </Badge>
                </div>
                <div className="rounded-xl border border-indigo-100/70 bg-white/90 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Business Case</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {hasBusinessCase ? 'Available' : 'Pending'}
                  </div>
                  <Badge variant="secondary" className="mt-2 text-[10px]">
                    {hasBusinessCase ? 'In sync' : 'Awaiting approval'}
                  </Badge>
                </div>
                <div className="rounded-xl border border-indigo-100/70 bg-white/90 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Stakeholders</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{stakeholderCount.toLocaleString()} mapped</div>
                  <div className="text-[11px] text-muted-foreground">{dependencyCount} dependencies logged</div>
                </div>
                <div className="rounded-xl border border-indigo-100/70 bg-white/90 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Constraints</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{constraintCount.toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground">{assumptionCount} assumptions tracked</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    Executive Summary
                  </CardTitle>
                  {executiveSummary && <LineageTag source="Business Case" field="executiveSummary" />}
                </div>
              </CardHeader>
              <CardContent>
                {executiveSummary ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <p className="text-foreground/80 whitespace-pre-wrap leading-relaxed">
                      {typeof executiveSummary === 'string' ? executiveSummary : JSON.stringify(executiveSummary, null, 2)}
                    </p>
                  </div>
                ) : (
                  <div className="text-muted-foreground/70 italic py-4 text-center">
                    Executive summary will be populated from the approved business case
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    Project Objectives
                  </CardTitle>
                  {objectives && <LineageTag source="Business Case" field="smartObjectives" />}
                </div>
              </CardHeader>
              <CardContent>
                {objectives ? (
                  <div className="space-y-3">
                    {Array.isArray(objectives) ? objectives.map((objItem, i: number) => {
                      const obj = isObjectiveObject(objItem) ? objItem : { name: String(objItem) };
                      const objectiveText = ('objective' in obj ? obj.objective : undefined) || obj.name || ('title' in obj ? obj.title : undefined);
                      const measure = 'measure' in obj ? obj.measure : undefined;
                      const target = 'target' in obj ? obj.target : undefined;
                      return (
                        <div key={i} className="p-3 bg-muted/40 rounded-lg border border-border/50">
                          <div className="flex items-start gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5">
                              {i + 1}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-sm">{objectiveText}</div>
                              {measure && <div className="text-xs text-muted-foreground mt-1">Measure: {measure}</div>}
                              {target && <div className="text-xs text-muted-foreground">Target: {target}</div>}
                            </div>
                          </div>
                        </div>
                      );
                    }) : (
                      <p className="text-foreground/80">{typeof objectives === 'string' ? objectives : JSON.stringify(objectives)}</p>
                    )}
                  </div>
                ) : (
                  <div className="text-muted-foreground/70 italic py-4 text-center">
                    Objectives will be populated from the approved business case
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Scope Definition
                  </CardTitle>
                  {scope && <LineageTag source="Business Case" field="scopeDefinition" />}
                </div>
              </CardHeader>
              <CardContent>
                {scope ? (
                  isScopeObject(scope) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {scope.inScope && (
                        <div className="p-3 bg-emerald-900/20 border border-emerald-700/30 rounded-lg">
                          <div className="flex items-center gap-2 mb-2 text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            In Scope
                          </div>
                          <ul className="space-y-1">
                            {Array.isArray(scope.inScope) ? scope.inScope.map((item: string, i: number) => (
                              <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                                <span className="text-emerald-500">•</span>
                                {item}
                              </li>
                            )) : <li className="text-sm text-foreground/80">{String(scope.inScope)}</li>}
                          </ul>
                        </div>
                      )}
                      {scope.outOfScope && (
                        <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
                          <div className="flex items-center gap-2 mb-2 text-red-600 dark:text-red-400 font-medium text-sm">
                            <XCircle className="w-4 h-4" />
                            Out of Scope
                          </div>
                          <ul className="space-y-1">
                            {Array.isArray(scope.outOfScope) ? scope.outOfScope.map((item: string, i: number) => (
                              <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                                <span className="text-red-500">•</span>
                                {item}
                              </li>
                            )) : <li className="text-sm text-foreground/80">{String(scope.outOfScope)}</li>}
                          </ul>
                        </div>
                      )}
                      {!scope.inScope && !scope.outOfScope && (
                        <p className="text-foreground/80 col-span-2">{JSON.stringify(scope)}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-foreground/80">{String(scope)}</p>
                  )
                ) : (
                  <div className="text-muted-foreground/70 italic py-4 text-center">
                    Scope will be populated from the approved business case
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    Expected Deliverables
                  </CardTitle>
                  {deliverables && <LineageTag source="Business Case" field="expectedDeliverables" />}
                </div>
              </CardHeader>
              <CardContent>
                {deliverables && Array.isArray(deliverables) && deliverables.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {deliverables.map((delItem, i: number) => {
                      const del = isDeliverableObject(delItem) ? delItem : { name: String(delItem) };
                      const deliverableTitle = ('title' in del ? del.title : undefined) || del.name || ('deliverable' in del ? del.deliverable : undefined);
                      const description = 'description' in del ? del.description : undefined;
                      return (
                        <div key={i} className="p-3 bg-muted/40 rounded-lg border border-border/50 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{deliverableTitle}</div>
                            {description && <div className="text-xs text-muted-foreground mt-1">{description}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : deliverables ? (
                  <p className="text-foreground/80">{typeof deliverables === 'string' ? deliverables : JSON.stringify(deliverables)}</p>
                ) : (
                  <div className="text-muted-foreground/70 italic py-4 text-center">
                    Deliverables will be populated from the approved business case
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

            <div className="space-y-6">
            <Card className="bg-gradient-to-br from-emerald-100 to-background dark:from-emerald-900/30 dark:to-slate-900/60 border-emerald-800/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    Financial Summary
                  </CardTitle>
                  {budget && <LineageTag source="Business Case" field="financialOverview" />}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total Budget</div>
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(businessCase?.totalCost || budget?.totalCost || project.totalBudget)}
                  </div>
                </div>
                <Separator className="bg-muted" />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">ROI</div>
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">{businessCase?.roi || budget?.roi || 'N/A'}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">NPV</div>
                    <div className="font-semibold">{formatCurrency(businessCase?.npv || budget?.npv)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Payback Period</div>
                    <div className="font-semibold">{businessCase?.paybackPeriod || budget?.paybackPeriod || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total Benefit</div>
                    <div className="font-semibold">{formatCurrency(businessCase?.totalBenefit || budget?.totalBenefit)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Timeline
                  </CardTitle>
                  {timeline && <LineageTag source="Business Case" field="timeline" />}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Start Date</div>
                    <div className="text-sm font-medium">
                      {project.startDate ? new Date(project.startDate).toLocaleDateString() :
                       timelineData?.startDate ? new Date(timelineData.startDate).toLocaleDateString() : 'TBD'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">End Date</div>
                    <div className="text-sm font-medium">
                      {project.endDate ? new Date(project.endDate).toLocaleDateString() :
                       timelineData?.endDate ? new Date(timelineData.endDate).toLocaleDateString() : 'TBD'}
                    </div>
                  </div>
                </div>
                {(timelineData?.duration || timelineData?.totalDuration) && (
                  <>
                    <Separator className="bg-muted" />
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Duration</div>
                      <div className="text-sm font-medium">{timelineData?.duration || timelineData?.totalDuration}</div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    Key Stakeholders
                  </CardTitle>
                  {bcStakeholders && <LineageTag source="Business Case" field="stakeholderAnalysis" />}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {visibleStakeholders.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xs font-bold text-white">
                        {(s.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.role}</div>
                      </div>
                      {s.source !== 'project' && (
                        <Badge variant="outline" className="text-[10px] capitalize">{s.source.replace('_', ' ')}</Badge>
                      )}
                    </div>
                  ))}
                  {!visibleStakeholders.length && (
                    <div className="text-sm text-muted-foreground/70 italic text-center py-3">
                      No stakeholders registered yet
                    </div>
                  )}
                  {!stakeholders.length && visibleStakeholders.length > 0 && (
                    <div className="text-xs text-muted-foreground/70 text-center pt-1">
                      Showing stakeholders derived from approved source artifacts until the stakeholder register is populated.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Source Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {demandReport && (
                  <div className="p-3 bg-muted/40 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-medium">Demand Report</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{demandReport.organizationName}</div>
                  </div>
                )}
                {businessCase && (
                  <div className="p-3 bg-muted/40 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-medium">Business Case</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{businessCase.projectName || businessCase.title || 'Approved'}</div>
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
