import { useTranslation } from 'react-i18next';
import type { ComponentType, ReactNode } from 'react';
import { Can } from '@/components/auth/Can';
import { AssignmentStatusPanel, SectionAssignmentPopover } from '@/components/shared/collaboration';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle, CheckCircle2, Code, Lightbulb, Plus, Settings, Shield, ShieldCheck, Target, Trash2 } from 'lucide-react';
import { REQUIREMENTS_SECTIONS } from '@shared/demandSections';
import type { ReportVersion, SectionAssignment, User } from '@shared/schema';

type Priority = 'High' | 'Medium' | 'Low';

interface Capability {
  name: string;
  description: string;
  priority: Priority;
  reasoning: string;
}

interface FunctionalRequirement {
  id: string;
  requirement: string;
  description?: string;
  category: string;
  priority: Priority;
  priorityRationale?: string;
  source?: string;
  acceptanceCriteria?: string[];
  subRequirements?: string[];
  designGuidance?: string[];
  referenceOptions?: string[];
  metricJustification?: string;
  failureImpact?: string;
  testMethod?: string;
  moscow?: string;
  phase?: string;
  linkedCapability?: string;
  businessOutcome?: string;
  owner?: string;
  risk?: string;
  bestPractice?: string;
}

interface NonFunctionalRequirement {
  id: string;
  requirement: string;
  category: string;
  metric: string;
  priority: Priority;
  priorityRationale?: string;
  source?: string;
  scope?: string;
  measurement?: string;
  target?: string;
  threshold?: string;
  rationale?: string;
  metricJustification?: string;
  failureImpact?: string;
  testMethod?: string;
  phase?: string;
  owner?: string;
  bestPractice?: string;
}

interface SecurityRequirement {
  id: string;
  requirement: string;
  category: string;
  priority: Priority;
  priorityRationale?: string;
  source?: string;
  compliance: string;
  implementation: string;
  control?: string;
  owner?: string;
  logging?: string;
  auditRetention?: string;
  monitoring?: string;
  keyManagement?: string;
  keyRotation?: string;
  secretsManagement?: string;
  privilegedAccess?: string;
  dataMasking?: string;
  modelSecurity?: string;
  incidentResponse?: string;
  incidentSeverity?: string;
  testingRequirement?: string;
  failureImpact?: string;
  phase?: string;
}

interface CoreDisplayRequirements {
  capabilities?: Capability[];
  functionalRequirements?: FunctionalRequirement[];
  nonFunctionalRequirements?: NonFunctionalRequirement[];
  securityRequirements?: SecurityRequirement[];
}

interface SectionProvenanceTagsProps {
  sectionName: string;
  versionNumber?: string;
  lastModified?: string;
  lastModifiedBy?: string;
}

interface DataGovernanceIndicatorsProps {
  dataSource: 'ai-generated' | 'manual' | 'hybrid';
  complianceLevel?: string;
  traceabilityLink?: string;
}

type PanelAssignment = SectionAssignment & {
  team?: { id: string; name: string; color?: string | null } | null;
  user?: User | null;
  assignedByUser: User;
  statusUpdatedByUser?: User | null;
};

interface DetailedRequirementsCoreSectionsProps {
  reportId: string;
  displayRequirements: CoreDisplayRequirements | null;
  isEditMode: boolean;
  highlightedSection?: string | null;
  currentUser: User | null;
  latestVersion: ReportVersion | null | undefined;
  hasFieldChanged: (fieldName: string) => boolean;
  getChangeBadgeText: (fieldName: string) => string;
  getPriorityColor: (priority: string) => string;
  renderStatusBadge: (sectionName: string, testId: string) => ReactNode;
  getSectionAssignmentForUser: (sectionName: string) => PanelAssignment | null;
  onUpdateCapability: (index: number, patch: Partial<Capability>) => void;
  onDeleteCapability: (index: number) => void;
  onAddCapability: () => void;
  onUpdateFunctionalRequirement: (index: number, patch: Partial<FunctionalRequirement>) => void;
  onDeleteFunctionalRequirement: (index: number) => void;
  onAddFunctionalRequirement: () => void;
  onUpdateNonFunctionalRequirement: (index: number, patch: Partial<NonFunctionalRequirement>) => void;
  onDeleteNonFunctionalRequirement: (index: number) => void;
  onAddNonFunctionalRequirement: () => void;
  onUpdateSecurityRequirement: (index: number, patch: Partial<SecurityRequirement>) => void;
  onDeleteSecurityRequirement: (index: number) => void;
  onAddSecurityRequirement: () => void;
  PrioritySparkline: ComponentType<{ items: Array<{ priority: Priority }> }>;
  SectionProvenanceTags: ComponentType<SectionProvenanceTagsProps>;
  DataGovernanceIndicators: ComponentType<DataGovernanceIndicatorsProps>;
}

export function DetailedRequirementsCoreSections({
  reportId,
  displayRequirements,
  isEditMode,
  highlightedSection,
  currentUser,
  latestVersion,
  hasFieldChanged,
  getChangeBadgeText,
  getPriorityColor,
  renderStatusBadge,
  getSectionAssignmentForUser,
  onUpdateCapability,
  onDeleteCapability,
  onAddCapability,
  onUpdateFunctionalRequirement,
  onDeleteFunctionalRequirement,
  onAddFunctionalRequirement,
  onUpdateNonFunctionalRequirement,
  onDeleteNonFunctionalRequirement,
  onAddNonFunctionalRequirement,
  onUpdateSecurityRequirement,
  onDeleteSecurityRequirement,
  onAddSecurityRequirement,
  PrioritySparkline,
  SectionProvenanceTags,
  DataGovernanceIndicators,
}: DetailedRequirementsCoreSectionsProps) {
  const { t } = useTranslation();

  if (!displayRequirements) {
    return null;
  }

  return (
    <>
      {displayRequirements.capabilities && displayRequirements.capabilities.length > 0 && (
        <Card
          id="section-capabilities"
          className={`${hasFieldChanged('capabilities') && isEditMode ? 'ring-2 ring-primary' : ''} ${highlightedSection === 'capabilities' ? 'ring-4 ring-primary ring-offset-2 ring-offset-background shadow-2xl' : ''}`}
        >
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-3">
                <CardTitle className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                    <Lightbulb className="h-4 w-4" />
                  </div>
                  {t('demand.tabs.requirements.identifiedCapabilities')}
                  {hasFieldChanged('capabilities') && isEditMode && (
                    <Badge variant="default" className="ml-2">{getChangeBadgeText('capabilities')}</Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs font-semibold">
                    <Target className="h-3 w-3 mr-1" />
                    {t('demand.tabs.requirements.strategicPlanning')}
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-semibold">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {t('demand.tabs.requirements.alignmentReady')}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <div className="px-4 py-2 bg-primary/5 rounded-lg flex items-center gap-3">
                  <span className="font-bold text-primary">{displayRequirements.capabilities.length}</span>
                  <span className="text-sm text-muted-foreground">{t('demand.tabs.requirements.capabilities')}</span>
                  <Separator orientation="vertical" className="h-4" />
                  <PrioritySparkline items={displayRequirements.capabilities} />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap mt-3">
              <p className="text-sm text-muted-foreground font-medium">{t('demand.tabs.requirements.capabilitiesDescription')}</p>
              {!isEditMode && (
                <div className="flex items-center gap-2">
                  {renderStatusBadge(REQUIREMENTS_SECTIONS.CAPABILITIES, 'badge-status-capabilities')}
                  <Can permissions={['requirements:assign-sections']}>
                    <SectionAssignmentPopover
                      reportId={reportId}
                      sectionName={REQUIREMENTS_SECTIONS.CAPABILITIES}
                      sectionLabel={t('demand.tabs.requirements.identifiedCapabilities')}
                    />
                  </Can>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEditMode && getSectionAssignmentForUser(REQUIREMENTS_SECTIONS.CAPABILITIES) && currentUser && (
              <AssignmentStatusPanel
                reportId={reportId}
                sectionName={REQUIREMENTS_SECTIONS.CAPABILITIES}
                assignment={getSectionAssignmentForUser(REQUIREMENTS_SECTIONS.CAPABILITIES)!}
                currentUserId={currentUser.id}
              />
            )}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayRequirements.capabilities.map((capability, index) => (
                <div key={index} className="bg-muted/30 border border-border/50 p-4 rounded-md space-y-2 relative">
                  {isEditMode ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteCapability(index)}
                        className="absolute top-2 right-2 h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
                        data-testid={`button-delete-capability-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="space-y-2 pr-8">
                        <Label className="text-xs">{t('demand.tabs.requirements.labels.name')}</Label>
                        <Input
                          value={capability.name}
                          onChange={(event) => onUpdateCapability(index, { name: event.target.value })}
                          data-testid={`input-capability-name-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('demand.tabs.requirements.labels.priority')}</Label>
                        <Select
                          value={capability.priority}
                          onValueChange={(value: Priority) => onUpdateCapability(index, { priority: value })}
                        >
                          <SelectTrigger data-testid={`select-capability-priority-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="High">{t('demand.tabs.requirements.priorityHigh')}</SelectItem>
                            <SelectItem value="Medium">{t('demand.tabs.requirements.priorityMedium')}</SelectItem>
                            <SelectItem value="Low">{t('demand.tabs.requirements.priorityLow')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('demand.tabs.requirements.labels.description')}</Label>
                        <Textarea
                          value={capability.description}
                          onChange={(event) => onUpdateCapability(index, { description: event.target.value })}
                          className="min-h-[60px]"
                          data-testid={`textarea-capability-description-${index}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('demand.tabs.requirements.labels.reasoning')}</Label>
                        <Textarea
                          value={capability.reasoning}
                          onChange={(event) => onUpdateCapability(index, { reasoning: event.target.value })}
                          className="min-h-[60px]"
                          data-testid={`textarea-capability-reasoning-${index}`}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold">{capability.name}</h4>
                        <Badge className={getPriorityColor(capability.priority)} variant="outline">
                          {capability.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{capability.description}</p>
                      <Separator />
                      <p className="text-xs text-muted-foreground italic">{capability.reasoning}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
            {isEditMode && (
              <Button variant="outline" size="sm" onClick={onAddCapability} className="mt-4" data-testid="button-add-capability">
                <Plus className="h-4 w-4 mr-2" />
                {t('demand.tabs.requirements.addNewCapability')}
              </Button>
            )}
          </CardContent>
          {!isEditMode && (
            <div className="px-6 pb-4 space-y-3 border-t pt-3 mt-4">
              <SectionProvenanceTags
                sectionName={REQUIREMENTS_SECTIONS.CAPABILITIES}
                versionNumber={latestVersion?.versionNumber}
                lastModified={latestVersion?.createdAt ? new Date(latestVersion.createdAt).toISOString() : undefined}
                lastModifiedBy={latestVersion?.createdByName}
              />
              <DataGovernanceIndicators
                dataSource="ai-generated"
                complianceLevel="UAE Gov Standard"
                traceabilityLink={`Version ${latestVersion?.versionNumber}`}
              />
            </div>
          )}
        </Card>
      )}

      {displayRequirements.functionalRequirements && displayRequirements.functionalRequirements.length > 0 && (
        <Card
          id="section-functionalRequirements"
          className={`${hasFieldChanged('functionalRequirements') && isEditMode ? 'ring-2 ring-primary' : ''} ${highlightedSection === 'functionalRequirements' ? 'ring-4 ring-primary ring-offset-2 ring-offset-background shadow-2xl' : ''}`}
        >
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-3">
                <CardTitle className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  {t('demand.tabs.requirements.functionalRequirements')}
                  {hasFieldChanged('functionalRequirements') && isEditMode && (
                    <Badge variant="default" className="ml-2">{getChangeBadgeText('functionalRequirements')}</Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs font-semibold">
                    <Code className="h-3 w-3 mr-1" />
                    {t('demand.tabs.requirements.featureDefinition')}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <div className="px-4 py-2 bg-primary/5 rounded-lg space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-primary">{displayRequirements.functionalRequirements.length}</span>
                    <span className="text-sm text-muted-foreground">{t('demand.tabs.requirements.requirements')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-red-600">
                      {displayRequirements.functionalRequirements.filter((requirement) => requirement.priority === 'High').length} {t('demand.tabs.requirements.highPriority')}
                    </span>
                  </div>
                </div>
                <PrioritySparkline items={displayRequirements.functionalRequirements} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap mt-2">
              <p className="text-sm text-muted-foreground">Structured functional requirements aligned to the approved scope.</p>
              {!isEditMode && (
                <div className="flex items-center gap-2">
                  {renderStatusBadge(REQUIREMENTS_SECTIONS.FUNCTIONAL, 'badge-status-functionalRequirements')}
                  <Can permissions={['requirements:assign-sections']}>
                    <SectionAssignmentPopover
                      reportId={reportId}
                      sectionName={REQUIREMENTS_SECTIONS.FUNCTIONAL}
                      sectionLabel={t('demand.tabs.requirements.functionalRequirements')}
                    />
                  </Can>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEditMode && getSectionAssignmentForUser(REQUIREMENTS_SECTIONS.FUNCTIONAL) && currentUser && (
              <AssignmentStatusPanel
                reportId={reportId}
                sectionName={REQUIREMENTS_SECTIONS.FUNCTIONAL}
                assignment={getSectionAssignmentForUser(REQUIREMENTS_SECTIONS.FUNCTIONAL)!}
                currentUserId={currentUser.id}
              />
            )}
            <div className="space-y-4">
              {displayRequirements.functionalRequirements.map((requirement, reqIdx) => (
                <div key={requirement.id} className="bg-muted/30 border border-border/50 p-4 rounded-md space-y-3 relative">
                  {isEditMode ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteFunctionalRequirement(reqIdx)}
                        className="absolute top-2 right-2 h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
                        data-testid={`button-delete-functional-req-${reqIdx}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="grid grid-cols-2 gap-3 pr-8">
                        <div className="space-y-2">
                          <Label className="text-xs">{t('demand.tabs.requirements.labels.id')}</Label>
                          <Input
                            value={requirement.id}
                            onChange={(event) => onUpdateFunctionalRequirement(reqIdx, { id: event.target.value })}
                            data-testid={`input-func-req-id-${reqIdx}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">{t('demand.tabs.requirements.labels.category')}</Label>
                          <Input
                            value={requirement.category}
                            onChange={(event) => onUpdateFunctionalRequirement(reqIdx, { category: event.target.value })}
                            data-testid={`input-func-req-category-${reqIdx}`}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('demand.tabs.requirements.labels.priority')}</Label>
                        <Select
                          value={requirement.priority}
                          onValueChange={(value: Priority) => onUpdateFunctionalRequirement(reqIdx, { priority: value })}
                        >
                          <SelectTrigger data-testid={`select-func-req-priority-${reqIdx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="High">{t('demand.tabs.requirements.priorityHigh')}</SelectItem>
                            <SelectItem value="Medium">{t('demand.tabs.requirements.priorityMedium')}</SelectItem>
                            <SelectItem value="Low">{t('demand.tabs.requirements.priorityLow')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('demand.tabs.requirements.labels.requirement')}</Label>
                        <Textarea
                          value={requirement.requirement}
                          onChange={(event) => onUpdateFunctionalRequirement(reqIdx, { requirement: event.target.value })}
                          className="min-h-[60px]"
                          data-testid={`textarea-func-req-requirement-${reqIdx}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('demand.tabs.requirements.labels.acceptanceCriteria')}</Label>
                        <Textarea
                          value={(requirement.acceptanceCriteria || []).join('\n')}
                          onChange={(event) => onUpdateFunctionalRequirement(reqIdx, { acceptanceCriteria: event.target.value.split('\n').filter((criteria) => criteria.trim()) })}
                          className="min-h-[80px]"
                          data-testid={`textarea-func-req-acceptance-criteria-${reqIdx}`}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <code className="text-xs bg-muted px-2 py-0.5 rounded">{requirement.id}</code>
                          {requirement.category && <Badge variant="outline" className="text-xs">{requirement.category}</Badge>}
                          <Badge className={getPriorityColor(requirement.priority)} variant="outline">
                            {requirement.priority}
                          </Badge>
                          {requirement.moscow && <Badge variant="secondary" className="text-xs">{requirement.moscow}</Badge>}
                          {requirement.phase && <Badge variant="outline" className="text-xs">{requirement.phase}</Badge>}
                          {requirement.businessOutcome && (
                            <Badge variant="outline" className="text-xs bg-primary/5">
                              Outcome: {requirement.businessOutcome}
                            </Badge>
                          )}
                        </div>
                        {/* Block A — Requirement (WHAT) */}
                        <div className="mb-3">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">A · Requirement (WHAT)</p>
                          <h4 className="font-semibold leading-snug">{requirement.requirement}</h4>
                          {requirement.description && <p className="text-sm text-muted-foreground mt-1">{requirement.description}</p>}
                        </div>
                        {(requirement.linkedCapability || requirement.owner || requirement.source || requirement.priorityRationale || requirement.testMethod || requirement.risk) && (
                          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                            {requirement.linkedCapability && (
                              <div>
                                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Capability</p>
                                <p>{requirement.linkedCapability}</p>
                              </div>
                            )}
                            {requirement.owner && (
                              <div>
                                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Owner</p>
                                <p>{requirement.owner}</p>
                              </div>
                            )}
                            {requirement.source && (
                              <div>
                                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Source</p>
                                <p>{requirement.source}</p>
                              </div>
                            )}
                            {requirement.priorityRationale && (
                              <div className="col-span-2 md:col-span-3">
                                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Priority rationale</p>
                                <p>{requirement.priorityRationale}</p>
                              </div>
                            )}
                            {requirement.testMethod && (
                              <div>
                                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Test method</p>
                                <p>{requirement.testMethod}</p>
                              </div>
                            )}
                            {requirement.risk && (
                              <div>
                                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Risk if missed</p>
                                <p>{requirement.risk}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {requirement.subRequirements && requirement.subRequirements.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Testable sub-requirements:</p>
                          <ul className="space-y-1">
                            {requirement.subRequirements.map((sub, idx) => (
                              <li key={idx} className="text-sm flex items-start gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/70 flex-shrink-0" />
                                <span>{sub}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {requirement.acceptanceCriteria && requirement.acceptanceCriteria.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">B · Acceptance Criteria (HOW MEASURED)</p>
                          <ul className="space-y-1">
                            {requirement.acceptanceCriteria.map((criteria, idx) => (
                              <li key={idx} className="text-sm flex items-start gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>{criteria}</span>
                              </li>
                            ))}
                          </ul>
                          {requirement.metricJustification && (
                            <p className="text-xs text-muted-foreground mt-2 border-l-2 border-blue-500/40 pl-3 py-1 bg-blue-500/5 rounded-sm">
                              <span className="font-medium text-blue-700 dark:text-blue-400">Metric justification: </span>
                              {requirement.metricJustification}
                            </p>
                          )}
                        </div>
                      )}
                      {requirement.designGuidance && requirement.designGuidance.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">C · Design Guidance <span className="font-normal normal-case">(architecture pattern, not vendor)</span></p>
                          <ul className="space-y-1">
                            {requirement.designGuidance.map((guidance, idx) => (
                              <li key={idx} className="text-sm flex items-start gap-2">
                                <Code className="h-3.5 w-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                                <span>{guidance}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {requirement.referenceOptions && requirement.referenceOptions.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">D · Reference Options <span className="font-normal normal-case">(non-binding)</span></p>
                          <div className="flex flex-wrap gap-1.5">
                            {requirement.referenceOptions.map((option, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs font-normal">
                                {option}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {requirement.failureImpact && (
                        <div className="border-l-2 border-red-500/60 pl-3 py-1.5 bg-red-500/5 rounded-sm">
                          <p className="text-[10px] uppercase tracking-wide text-red-700 dark:text-red-400 font-semibold mb-0.5">Failure impact</p>
                          <p className="text-xs">{requirement.failureImpact}</p>
                        </div>
                      )}
                      {requirement.bestPractice && (
                        <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                          Best practice: {requirement.bestPractice}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            {isEditMode && (
              <Button variant="outline" size="sm" onClick={onAddFunctionalRequirement} className="mt-4" data-testid="button-add-functional-req">
                <Plus className="h-4 w-4 mr-2" />
                {t('demand.tabs.requirements.addNewFunctionalReq')}
              </Button>
            )}
          </CardContent>
          {!isEditMode && (
            <div className="px-6 pb-4 space-y-3 border-t pt-3 mt-4">
              <SectionProvenanceTags
                sectionName={REQUIREMENTS_SECTIONS.FUNCTIONAL}
                versionNumber={latestVersion?.versionNumber}
                lastModified={latestVersion?.createdAt ? new Date(latestVersion.createdAt).toISOString() : undefined}
                lastModifiedBy={latestVersion?.createdByName}
              />
              <DataGovernanceIndicators
                dataSource="ai-generated"
                complianceLevel="ISO 27001"
                traceabilityLink={`Version ${latestVersion?.versionNumber}`}
              />
            </div>
          )}
        </Card>
      )}

      {displayRequirements.nonFunctionalRequirements && displayRequirements.nonFunctionalRequirements.length > 0 && (
        <Card
          id="section-nonFunctionalRequirements"
          className={`${hasFieldChanged('nonFunctionalRequirements') && isEditMode ? 'ring-2 ring-primary' : ''} ${highlightedSection === 'nonFunctionalRequirements' ? 'ring-4 ring-primary ring-offset-2 ring-offset-background shadow-2xl' : ''}`}
        >
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-3">
                <CardTitle className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                    <Settings className="h-4 w-4" />
                  </div>
                  {t('demand.tabs.requirements.nonFunctionalRequirements')}
                  {hasFieldChanged('nonFunctionalRequirements') && isEditMode && (
                    <Badge variant="default" className="ml-2">{getChangeBadgeText('nonFunctionalRequirements')}</Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs font-semibold">
                    <Target className="h-3 w-3 mr-1" />
                    {t('demand.tabs.requirements.qualityAttributes')}
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-semibold">
                    <Settings className="h-3 w-3 mr-1" />
                    {t('demand.tabs.requirements.performanceMetrics')}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <div className="px-4 py-2 bg-primary/5 rounded-lg flex items-center gap-3">
                  <span className="font-bold text-primary">{displayRequirements.nonFunctionalRequirements.length}</span>
                  <span className="text-sm text-muted-foreground">{t('demand.tabs.requirements.requirements')}</span>
                  <Separator orientation="vertical" className="h-4" />
                  <PrioritySparkline items={displayRequirements.nonFunctionalRequirements} />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap mt-3">
              <p className="text-sm text-muted-foreground font-medium">{t('demand.tabs.requirements.nfrDescription')}</p>
              {!isEditMode && (
                <div className="flex items-center gap-2">
                  {renderStatusBadge(REQUIREMENTS_SECTIONS.NON_FUNCTIONAL, 'badge-status-nonFunctionalRequirements')}
                  <Can permissions={['requirements:assign-sections']}>
                    <SectionAssignmentPopover
                      reportId={reportId}
                      sectionName={REQUIREMENTS_SECTIONS.NON_FUNCTIONAL}
                      sectionLabel={t('demand.tabs.requirements.nonFunctionalRequirements')}
                    />
                  </Can>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEditMode && getSectionAssignmentForUser(REQUIREMENTS_SECTIONS.NON_FUNCTIONAL) && currentUser && (
              <AssignmentStatusPanel
                reportId={reportId}
                sectionName={REQUIREMENTS_SECTIONS.NON_FUNCTIONAL}
                assignment={getSectionAssignmentForUser(REQUIREMENTS_SECTIONS.NON_FUNCTIONAL)!}
                currentUserId={currentUser.id}
              />
            )}
            <div className="space-y-4">
              {displayRequirements.nonFunctionalRequirements.map((requirement, reqIdx) => (
                <div key={requirement.id} className="bg-muted/30 border border-border/50 p-4 rounded-md space-y-3 relative">
                  {isEditMode ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteNonFunctionalRequirement(reqIdx)}
                        className="absolute top-2 right-2 h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
                        data-testid={`button-delete-nonfunctional-req-${reqIdx}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="grid grid-cols-2 gap-3 pr-8">
                        <div className="space-y-2">
                          <Label className="text-xs">{t('demand.tabs.requirements.labels.id')}</Label>
                          <Input
                            value={requirement.id}
                            onChange={(event) => onUpdateNonFunctionalRequirement(reqIdx, { id: event.target.value })}
                            data-testid={`input-nonfunc-req-id-${reqIdx}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">{t('demand.tabs.requirements.labels.category')}</Label>
                          <Input
                            value={requirement.category}
                            onChange={(event) => onUpdateNonFunctionalRequirement(reqIdx, { category: event.target.value })}
                            data-testid={`input-nonfunc-req-category-${reqIdx}`}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('demand.tabs.requirements.labels.priority')}</Label>
                        <Select
                          value={requirement.priority}
                          onValueChange={(value: Priority) => onUpdateNonFunctionalRequirement(reqIdx, { priority: value })}
                        >
                          <SelectTrigger data-testid={`select-nonfunc-req-priority-${reqIdx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="High">{t('demand.tabs.requirements.priorityHigh')}</SelectItem>
                            <SelectItem value="Medium">{t('demand.tabs.requirements.priorityMedium')}</SelectItem>
                            <SelectItem value="Low">{t('demand.tabs.requirements.priorityLow')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('demand.tabs.requirements.labels.requirement')}</Label>
                        <Textarea
                          value={requirement.requirement}
                          onChange={(event) => onUpdateNonFunctionalRequirement(reqIdx, { requirement: event.target.value })}
                          className="min-h-[60px]"
                          data-testid={`textarea-nonfunc-req-requirement-${reqIdx}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('demand.tabs.requirements.labels.metric')}</Label>
                        <Input
                          value={requirement.metric}
                          onChange={(event) => onUpdateNonFunctionalRequirement(reqIdx, { metric: event.target.value })}
                          data-testid={`input-nonfunc-req-metric-${reqIdx}`}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <code className="text-xs bg-muted px-2 py-0.5 rounded">{requirement.id}</code>
                          {requirement.category && <Badge variant="outline" className="text-xs">{requirement.category}</Badge>}
                          <Badge className={getPriorityColor(requirement.priority)} variant="outline">
                            {requirement.priority}
                          </Badge>
                          {requirement.phase && <Badge variant="outline" className="text-xs">{requirement.phase}</Badge>}
                          {requirement.scope && <Badge variant="secondary" className="text-xs">Scope: {requirement.scope}</Badge>}
                        </div>
                        <h4 className="font-semibold text-sm">{requirement.requirement}</h4>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">{t('demand.tabs.requirements.metric')}:</span>
                        <span className="text-muted-foreground">{requirement.metric}</span>
                      </div>
                      {(requirement.target || requirement.threshold || requirement.measurement || requirement.rationale || requirement.testMethod || requirement.owner || requirement.source || requirement.priorityRationale) && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs border-t pt-2">
                          {requirement.target && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Target</p>
                              <p>{requirement.target}</p>
                            </div>
                          )}
                          {requirement.threshold && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Breach threshold</p>
                              <p>{requirement.threshold}</p>
                            </div>
                          )}
                          {requirement.measurement && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Measured by</p>
                              <p>{requirement.measurement}</p>
                            </div>
                          )}
                          {requirement.testMethod && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Test method</p>
                              <p>{requirement.testMethod}</p>
                            </div>
                          )}
                          {requirement.owner && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Owner</p>
                              <p>{requirement.owner}</p>
                            </div>
                          )}
                          {requirement.source && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Source</p>
                              <p>{requirement.source}</p>
                            </div>
                          )}
                          {requirement.rationale && (
                            <div className="col-span-2 md:col-span-3">
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Rationale</p>
                              <p className="italic">{requirement.rationale}</p>
                            </div>
                          )}
                          {requirement.priorityRationale && (
                            <div className="col-span-2 md:col-span-3">
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Priority rationale</p>
                              <p>{requirement.priorityRationale}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {requirement.metricJustification && (
                        <div className="text-xs border-l-2 border-blue-500/40 pl-3 py-1 bg-blue-500/5 rounded-sm">
                          <span className="font-medium text-blue-700 dark:text-blue-400">Metric justification: </span>
                          <span className="text-muted-foreground">{requirement.metricJustification}</span>
                        </div>
                      )}
                      {requirement.failureImpact && (
                        <div className="border-l-2 border-red-500/60 pl-3 py-1.5 bg-red-500/5 rounded-sm">
                          <p className="text-[10px] uppercase tracking-wide text-red-700 dark:text-red-400 font-semibold mb-0.5">Failure impact</p>
                          <p className="text-xs">{requirement.failureImpact}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            {isEditMode && (
              <Button variant="outline" size="sm" onClick={onAddNonFunctionalRequirement} className="mt-4" data-testid="button-add-nonfunctional-req">
                <Plus className="h-4 w-4 mr-2" />
                {t('demand.tabs.requirements.addNewNonFunctionalReq')}
              </Button>
            )}
          </CardContent>
          {!isEditMode && (
            <div className="px-6 pb-4 space-y-3 border-t pt-3 mt-4">
              <SectionProvenanceTags
                sectionName={REQUIREMENTS_SECTIONS.NON_FUNCTIONAL}
                versionNumber={latestVersion?.versionNumber}
                lastModified={latestVersion?.createdAt ? new Date(latestVersion.createdAt).toISOString() : undefined}
                lastModifiedBy={latestVersion?.createdByName}
              />
              <DataGovernanceIndicators
                dataSource="ai-generated"
                complianceLevel="UAE Gov Standard"
                traceabilityLink={`Version ${latestVersion?.versionNumber}`}
              />
            </div>
          )}
        </Card>
      )}

      {displayRequirements.securityRequirements && displayRequirements.securityRequirements.length > 0 && (
        <Card
          id="section-securityRequirements"
          className={`${hasFieldChanged('securityRequirements') && isEditMode ? 'ring-2 ring-primary' : ''} ${highlightedSection === 'securityRequirements' ? 'ring-4 ring-primary ring-offset-2 ring-offset-background shadow-2xl' : ''}`}
        >
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-3">
                <CardTitle className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  {t('demand.tabs.requirements.securityRequirements')}
                  {hasFieldChanged('securityRequirements') && isEditMode && (
                    <Badge variant="default" className="ml-2">{getChangeBadgeText('securityRequirements')}</Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs font-semibold">
                    <Shield className="h-3 w-3 mr-1" />
                    {t('demand.tabs.requirements.securityControls')}
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-semibold">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {t('demand.tabs.requirements.complianceReady')}
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-semibold">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    {t('demand.tabs.requirements.uaeStandards')}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <div className="px-4 py-2 bg-primary/5 rounded-lg space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-primary">{displayRequirements.securityRequirements.length}</span>
                    <span className="text-sm text-muted-foreground">{t('demand.tabs.requirements.securityControls')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs font-semibold text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {t('demand.tabs.requirements.complianceReady')}
                    </Badge>
                  </div>
                </div>
                <PrioritySparkline items={displayRequirements.securityRequirements} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap mt-3">
              <p className="text-sm text-muted-foreground font-medium">{t('demand.tabs.requirements.securityDescription')}</p>
              {!isEditMode && (
                <div className="flex items-center gap-2">
                  {renderStatusBadge(REQUIREMENTS_SECTIONS.SECURITY, 'badge-status-securityRequirements')}
                  <Can permissions={['requirements:assign-sections']}>
                    <SectionAssignmentPopover
                      reportId={reportId}
                      sectionName={REQUIREMENTS_SECTIONS.SECURITY}
                      sectionLabel={t('demand.tabs.requirements.securityRequirements')}
                    />
                  </Can>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEditMode && getSectionAssignmentForUser(REQUIREMENTS_SECTIONS.SECURITY) && currentUser && (
              <AssignmentStatusPanel
                reportId={reportId}
                sectionName={REQUIREMENTS_SECTIONS.SECURITY}
                assignment={getSectionAssignmentForUser(REQUIREMENTS_SECTIONS.SECURITY)!}
                currentUserId={currentUser.id}
              />
            )}
            <div className="space-y-4">
              {displayRequirements.securityRequirements.map((requirement, reqIdx) => (
                <div key={requirement.id} className="bg-muted/30 border border-border/50 p-4 rounded-md space-y-3 relative">
                  {isEditMode ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteSecurityRequirement(reqIdx)}
                        className="absolute top-2 right-2 h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
                        data-testid={`button-delete-security-req-${reqIdx}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="grid grid-cols-2 gap-3 pr-8">
                        <div className="space-y-2">
                          <Label className="text-xs">{t('demand.tabs.requirements.labels.id')}</Label>
                          <Input
                            value={requirement.id}
                            onChange={(event) => onUpdateSecurityRequirement(reqIdx, { id: event.target.value })}
                            data-testid={`input-security-req-id-${reqIdx}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">{t('demand.tabs.requirements.labels.category')}</Label>
                          <Input
                            value={requirement.category}
                            onChange={(event) => onUpdateSecurityRequirement(reqIdx, { category: event.target.value })}
                            data-testid={`input-security-req-category-${reqIdx}`}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('demand.tabs.requirements.labels.priority')}</Label>
                        <Select
                          value={requirement.priority}
                          onValueChange={(value: Priority) => onUpdateSecurityRequirement(reqIdx, { priority: value })}
                        >
                          <SelectTrigger data-testid={`select-security-req-priority-${reqIdx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="High">{t('demand.tabs.requirements.priorityHigh')}</SelectItem>
                            <SelectItem value="Medium">{t('demand.tabs.requirements.priorityMedium')}</SelectItem>
                            <SelectItem value="Low">{t('demand.tabs.requirements.priorityLow')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('demand.tabs.requirements.labels.requirement')}</Label>
                        <Textarea
                          value={requirement.requirement}
                          onChange={(event) => onUpdateSecurityRequirement(reqIdx, { requirement: event.target.value })}
                          className="min-h-[60px]"
                          data-testid={`textarea-security-req-requirement-${reqIdx}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('demand.tabs.requirements.labels.compliance')}</Label>
                        <Input
                          value={requirement.compliance}
                          onChange={(event) => onUpdateSecurityRequirement(reqIdx, { compliance: event.target.value })}
                          data-testid={`input-security-req-compliance-${reqIdx}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t('demand.tabs.requirements.labels.implementation')}</Label>
                        <Textarea
                          value={requirement.implementation}
                          onChange={(event) => onUpdateSecurityRequirement(reqIdx, { implementation: event.target.value })}
                          className="min-h-[60px]"
                          data-testid={`textarea-security-req-implementation-${reqIdx}`}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <code className="text-xs bg-muted px-2 py-0.5 rounded">{requirement.id}</code>
                          <Badge variant="outline" className="text-xs">{requirement.category}</Badge>
                          <Badge className={getPriorityColor(requirement.priority)} variant="outline">
                            {requirement.priority}
                          </Badge>
                          {requirement.control && <Badge variant="secondary" className="text-xs">Control: {requirement.control}</Badge>}
                          {requirement.phase && <Badge variant="outline" className="text-xs">{requirement.phase}</Badge>}
                        </div>
                        <h4 className="font-semibold">{requirement.requirement}</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-start gap-2">
                          <ShieldCheck className="h-4 w-4 text-purple-500 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">{t('demand.tabs.requirements.compliance')}</p>
                            <p className="text-sm">{requirement.compliance}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Settings className="h-4 w-4 text-purple-500 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">{t('demand.tabs.requirements.implementation')}</p>
                            <p className="text-sm">{requirement.implementation}</p>
                          </div>
                        </div>
                      </div>
                      {(requirement.owner || requirement.source || requirement.priorityRationale || requirement.logging || requirement.auditRetention || requirement.monitoring || requirement.keyManagement || requirement.keyRotation || requirement.secretsManagement || requirement.privilegedAccess || requirement.dataMasking || requirement.modelSecurity || requirement.incidentResponse || requirement.incidentSeverity || requirement.testingRequirement) && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs border-t pt-2">
                          {requirement.owner && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Owner</p>
                              <p>{requirement.owner}</p>
                            </div>
                          )}
                          {requirement.source && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Source</p>
                              <p>{requirement.source}</p>
                            </div>
                          )}
                          {requirement.priorityRationale && (
                            <div className="col-span-2 md:col-span-3">
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Priority rationale</p>
                              <p>{requirement.priorityRationale}</p>
                            </div>
                          )}
                          {requirement.logging && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Logging</p>
                              <p>{requirement.logging}</p>
                            </div>
                          )}
                          {requirement.auditRetention && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Audit retention (immutable)</p>
                              <p>{requirement.auditRetention}</p>
                            </div>
                          )}
                          {requirement.monitoring && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">SIEM / monitoring</p>
                              <p>{requirement.monitoring}</p>
                            </div>
                          )}
                          {requirement.keyManagement && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Key management (KMS / HSM)</p>
                              <p>{requirement.keyManagement}</p>
                            </div>
                          )}
                          {requirement.keyRotation && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Key rotation</p>
                              <p>{requirement.keyRotation}</p>
                            </div>
                          )}
                          {requirement.secretsManagement && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Secrets management</p>
                              <p>{requirement.secretsManagement}</p>
                            </div>
                          )}
                          {requirement.privilegedAccess && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Privileged access (PAM)</p>
                              <p>{requirement.privilegedAccess}</p>
                            </div>
                          )}
                          {requirement.dataMasking && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Data masking (PII)</p>
                              <p>{requirement.dataMasking}</p>
                            </div>
                          )}
                          {requirement.modelSecurity && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Model security (AI)</p>
                              <p>{requirement.modelSecurity}</p>
                            </div>
                          )}
                          {requirement.incidentResponse && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Incident response</p>
                              <p>{requirement.incidentResponse}</p>
                            </div>
                          )}
                          {requirement.incidentSeverity && (
                            <div className="col-span-2 md:col-span-3">
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Incident severity + SLA</p>
                              <p>{requirement.incidentSeverity}</p>
                            </div>
                          )}
                          {requirement.testingRequirement && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Testing</p>
                              <p>{requirement.testingRequirement}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {requirement.failureImpact && (
                        <div className="border-l-2 border-red-500/60 pl-3 py-1.5 bg-red-500/5 rounded-sm">
                          <p className="text-[10px] uppercase tracking-wide text-red-700 dark:text-red-400 font-semibold mb-0.5">Failure impact</p>
                          <p className="text-xs">{requirement.failureImpact}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            {isEditMode && (
              <Button variant="outline" size="sm" onClick={onAddSecurityRequirement} className="mt-4" data-testid="button-add-security-req">
                <Plus className="h-4 w-4 mr-2" />
                {t('demand.tabs.requirements.addNewSecurityReq')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}