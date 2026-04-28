import { useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Briefcase,
  TrendingUp,
  Shield,
  Target,
  CheckCircle,
  X,
} from "lucide-react";
import {
  BusinessCaseSectionProps,
  KpiItem,
  SuccessCriterion,
  Stakeholder,
  safeRender,
  getStakeholders,
  computePowerInterestMatrix,
  getAssumptionItems,
  getDependencyItems,
  getKpiItems,
  getSuccessCriteriaItems,
  AssumptionItem,
  DependencyItem,
} from ".";
import {
  createArrayUpdater,
  createDepartmentImpactUpdater,
  createEmptyKpi,
  createEmptySuccessCriterion,
  createEmptyStakeholder,
  createEmptyAssumption,
  createEmptyDependency,
} from "./helpers";
import { PowerInterestMatrix, RiskHeatMap } from "@/components/shared/visualization";

interface ImpactTextAreaProps {
  label: string;
  labelColor: string;
  value: string[];
  onChange: (value: string) => void;
  testId: string;
}

function ImpactTextArea({ label, labelColor, value, onChange, testId }: ImpactTextAreaProps) {
  return (
    <div>
      <label className={`text-xs font-medium ${labelColor}`} id={`${testId}-label`}>
        {label}
      </label>
      <Textarea
        value={value.join('\n')}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-[80px]"
        data-testid={testId}
        aria-labelledby={`${testId}-label`}
      />
    </div>
  );
}

export function StrategicAlignmentSection({
  businessCase,
  isEditMode,
  updateField,
}: BusinessCaseSectionProps) {
  const { t } = useTranslation();
  const impactUpdater = createDepartmentImpactUpdater(businessCase.departmentImpact, updateField);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
          </div>
          {t('demand.businessCase.strategic.strategicAlignment')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t('demand.businessCase.strategic.strategicObjectives')} {isEditMode && <span className="text-xs text-muted-foreground">({t('demand.businessCase.strategic.onePerLine')})</span>}</p>
          {isEditMode ? (
            <Textarea
              value={(businessCase.strategicObjectives || []).join('\n')}
              onChange={(e) => updateField('strategicObjectives', e.target.value.split('\n').filter((line: string) => line.trim()))}
              className="min-h-[80px]"
              data-testid="textarea-strategic-objectives"
              aria-label="Strategic Objectives"
            />
          ) : Array.isArray(businessCase.strategicObjectives) && businessCase.strategicObjectives.length > 0 ? (
            <ul className="list-disc list-inside space-y-1">
              {businessCase.strategicObjectives.map((obj: string, idx: number) => (
                <li key={idx} className="text-sm">{safeRender(obj)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t('demand.businessCase.strategic.noStrategicObjectives')}</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">{t('demand.businessCase.strategic.departmentImpact')}</p>
          {isEditMode ? (
            <div className="space-y-3">
              <ImpactTextArea
                label={t('demand.businessCase.strategic.positiveImpactsLabel')}
                labelColor="text-green-600"
                value={impactUpdater.getItems('positive')}
                onChange={(value) => impactUpdater.updateArray('positive', value)}
                testId="textarea-impact-positive"
              />
              <ImpactTextArea
                label={t('demand.businessCase.strategic.challengesLabel')}
                labelColor="text-red-600"
                value={impactUpdater.getItems('negative')}
                onChange={(value) => impactUpdater.updateArray('negative', value)}
                testId="textarea-impact-negative"
              />
              <ImpactTextArea
                label={t('demand.businessCase.strategic.mitigationLabel')}
                labelColor="text-blue-600"
                value={impactUpdater.getItems('mitigation')}
                onChange={(value) => impactUpdater.updateArray('mitigation', value)}
                testId="textarea-impact-mitigation"
              />
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {impactUpdater.getItems('positive').length > 0 && (
                <div>
                  <p className="font-medium text-green-600">{t('demand.businessCase.strategic.positiveImpacts')}:</p>
                  <ul className="list-disc list-inside ml-2">
                    {impactUpdater.getItems('positive').map((item, idx) => (
                      <li key={idx}>{safeRender(item)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {impactUpdater.getItems('negative').length > 0 && (
                <div>
                  <p className="font-medium text-red-600">{t('demand.businessCase.strategic.challenges')}:</p>
                  <ul className="list-disc list-inside ml-2">
                    {impactUpdater.getItems('negative').map((item, idx) => (
                      <li key={idx}>{safeRender(item)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {impactUpdater.getItems('mitigation').length > 0 && (
                <div>
                  <p className="font-medium text-blue-600">{t('demand.businessCase.strategic.mitigationStrategies')}:</p>
                  <ul className="list-disc list-inside ml-2">
                    {impactUpdater.getItems('mitigation').map((item, idx) => (
                      <li key={idx}>{safeRender(item)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {impactUpdater.getItems('positive').length === 0 &&
               impactUpdater.getItems('negative').length === 0 &&
               impactUpdater.getItems('mitigation').length === 0 && (
                <p className="text-muted-foreground italic">{t('demand.businessCase.strategic.noDepartmentImpact')}</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ComplianceGovernanceSection({
  businessCase,
  isEditMode,
  updateField,
}: BusinessCaseSectionProps) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white">
            <Shield className="h-4 w-4" aria-hidden="true" />
          </div>
          {t('demand.businessCase.strategic.complianceGovernance')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t('demand.businessCase.strategic.complianceRequirements')} {isEditMode && <span className="text-xs text-muted-foreground">({t('demand.businessCase.strategic.onePerLine')})</span>}</p>
          {isEditMode ? (
            <Textarea
              value={(businessCase.complianceRequirements || []).join('\n')}
              onChange={(e) => updateField('complianceRequirements', e.target.value.split('\n').filter((line: string) => line.trim()))}
              className="min-h-[80px]"
              data-testid="textarea-compliance-requirements"
              aria-label="Compliance Requirements"
            />
          ) : Array.isArray(businessCase.complianceRequirements) && businessCase.complianceRequirements.length > 0 ? (
            <ul className="list-disc list-inside space-y-1">
              {businessCase.complianceRequirements.map((req: string, idx: number) => (
                <li key={idx} className="text-sm">{safeRender(req)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t('demand.businessCase.strategic.noComplianceRequirements')}</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">{t('demand.businessCase.strategic.policyReferences')} {isEditMode && <span className="text-xs text-muted-foreground">({t('demand.businessCase.strategic.onePerLine')})</span>}</p>
          {isEditMode ? (
            <Textarea
              value={(businessCase.policyReferences || []).join('\n')}
              onChange={(e) => updateField('policyReferences', e.target.value.split('\n').filter((line: string) => line.trim()))}
              className="min-h-[80px]"
              data-testid="textarea-policy-references"
              aria-label="Policy References"
            />
          ) : Array.isArray(businessCase.policyReferences) && businessCase.policyReferences.length > 0 ? (
            <ul className="list-disc list-inside space-y-1">
              {businessCase.policyReferences.map((policy: string, idx: number) => (
                <li key={idx} className="text-sm">{safeRender(policy)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t('demand.businessCase.strategic.noPolicyReferences')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function KPIsSection({
  businessCase,
  isEditMode,
  updateField,
}: BusinessCaseSectionProps) {
  const { t } = useTranslation();
  const kpis = getKpiItems(businessCase.kpis);
  const kpiUpdater = createArrayUpdater<KpiItem>(kpis, updateField, 'kpis');

  const successCriteria = getSuccessCriteriaItems(businessCase.successCriteria);
  const criteriaUpdater = createArrayUpdater<SuccessCriterion>(successCriteria, updateField, 'successCriteria');

  const hasKpis = kpis.length > 0;
  const hasCriteria = successCriteria.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white">
            <Target className="h-4 w-4" aria-hidden="true" />
          </div>
          {t('demand.businessCase.strategic.kpisSuccessMetrics')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t('demand.businessCase.strategic.kpis')}</p>
          {isEditMode ? (
            <div className="space-y-3">
              {!hasKpis && (
                <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Target className="h-10 w-10 mx-auto mb-2 opacity-30" aria-hidden="true" />
                  <p className="text-sm">{t('demand.businessCase.strategic.noKpisDefined')}</p>
                  <p className="text-xs mt-1">{t('demand.businessCase.strategic.addKpiHint')}</p>
                </div>
              )}
              {kpis.map((kpi, idx) => (
                <div key={idx} className="p-3 border rounded-lg space-y-2" data-testid={`edit-kpi-${idx}`}>
                  <div>
                    <label htmlFor={`kpi-name-${idx}`} className="text-xs text-muted-foreground">{t('demand.businessCase.strategic.kpiName')}</label>
                    <Input
                      id={`kpi-name-${idx}`}
                      value={kpi.name || ''}
                      onChange={(e) => kpiUpdater.updateItem(idx, { name: e.target.value })}
                      className="mt-1"
                      data-testid={`input-kpi-name-${idx}`}
                    />
                  </div>
                  <div>
                    <label htmlFor={`kpi-desc-${idx}`} className="text-xs text-muted-foreground">{t('demand.businessCase.strategic.description')}</label>
                    <Textarea
                      id={`kpi-desc-${idx}`}
                      value={kpi.description || ''}
                      onChange={(e) => kpiUpdater.updateItem(idx, { description: e.target.value })}
                      className="mt-1 min-h-[50px]"
                      data-testid={`textarea-kpi-description-${idx}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor={`kpi-baseline-${idx}`} className="text-xs text-muted-foreground">{t('demand.businessCase.strategic.baseline')}</label>
                      <Input
                        id={`kpi-baseline-${idx}`}
                        value={kpi.baseline || ''}
                        onChange={(e) => kpiUpdater.updateItem(idx, { baseline: e.target.value })}
                        className="mt-1"
                        data-testid={`input-kpi-baseline-${idx}`}
                      />
                    </div>
                    <div>
                      <label htmlFor={`kpi-target-${idx}`} className="text-xs text-muted-foreground">{t('demand.businessCase.strategic.target')}</label>
                      <Input
                        id={`kpi-target-${idx}`}
                        value={kpi.target || ''}
                        onChange={(e) => kpiUpdater.updateItem(idx, { target: e.target.value })}
                        className="mt-1"
                        data-testid={`input-kpi-target-${idx}`}
                      />
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => kpiUpdater.removeItem(idx)}
                    data-testid={`button-remove-kpi-${idx}`}
                    aria-label={`Remove KPI ${idx + 1}`}
                  >
                    {t('demand.businessCase.strategic.removeKpi')}
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => kpiUpdater.addItem(createEmptyKpi())}
                data-testid="button-add-kpi"
              >
                + {t('demand.businessCase.strategic.addKpi')}
              </Button>
            </div>
          ) : hasKpis ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kpis.map((kpi, idx) => (
                <div key={idx} className="p-4 border rounded-lg" data-testid={`kpi-${idx}`}>
                  <p className="font-medium text-sm mb-1">{kpi.name || <span className="italic text-muted-foreground">{t('demand.businessCase.strategic.untitledKpi')}</span>}</p>
                  <p className="text-xs text-muted-foreground mb-2">{kpi.description || '-'}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span>{t('demand.businessCase.strategic.baseline')}: {kpi.baseline || '-'}</span>
                    <span className="font-semibold text-primary">{t('demand.businessCase.strategic.target')}: {kpi.target || '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t('demand.businessCase.strategic.noKpisDefined')}</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">{t('demand.businessCase.strategic.successCriteria')}</p>
          {isEditMode ? (
            <div className="space-y-3">
              {!hasCriteria && (
                <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                  <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-30" aria-hidden="true" />
                  <p className="text-sm">{t('demand.businessCase.strategic.noSuccessCriteria')}</p>
                  <p className="text-xs mt-1">{t('demand.businessCase.strategic.addCriterionHint')}</p>
                </div>
              )}
              {successCriteria.map((criterion, idx) => (
                <div key={idx} className="p-3 border rounded-lg space-y-2" data-testid={`edit-criterion-${idx}`}>
                  <div>
                    <label htmlFor={`criterion-name-${idx}`} className="text-xs text-muted-foreground">{t('demand.businessCase.strategic.criterion')}</label>
                    <Input
                      id={`criterion-name-${idx}`}
                      value={criterion.criterion || ''}
                      onChange={(e) => criteriaUpdater.updateItem(idx, { criterion: e.target.value })}
                      className="mt-1"
                      data-testid={`input-criterion-name-${idx}`}
                    />
                  </div>
                  <div>
                    <label htmlFor={`criterion-target-${idx}`} className="text-xs text-muted-foreground">{t('demand.businessCase.strategic.target')}</label>
                    <Input
                      id={`criterion-target-${idx}`}
                      value={criterion.target || ''}
                      onChange={(e) => criteriaUpdater.updateItem(idx, { target: e.target.value })}
                      className="mt-1"
                      data-testid={`input-criterion-target-${idx}`}
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => criteriaUpdater.removeItem(idx)}
                    data-testid={`button-remove-criterion-${idx}`}
                    aria-label={`Remove criterion ${idx + 1}`}
                  >
                    {t('demand.businessCase.strategic.removeCriterion')}
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => criteriaUpdater.addItem(createEmptySuccessCriterion())}
                data-testid="button-add-criterion"
              >
                + {t('demand.businessCase.strategic.addSuccessCriterion')}
              </Button>
            </div>
          ) : hasCriteria ? (
            <div className="space-y-2">
              {successCriteria.map((criterion, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" aria-hidden="true" />
                  <p className="text-sm flex-1">{criterion.criterion || t('demand.businessCase.strategic.untitled')}: {criterion.target || '-'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t('demand.businessCase.strategic.noSuccessCriteria')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function StakeholderAnalysisSection({
  businessCase,
  isEditMode,
  updateField,
}: BusinessCaseSectionProps) {
  const { t } = useTranslation();
  const stakeholders = getStakeholders(businessCase.stakeholderAnalysis);
  const stakeholderUpdater = createArrayUpdater<Stakeholder>(stakeholders, updateField, 'stakeholderAnalysis');

  const matrixData = useMemo(
    () => computePowerInterestMatrix(stakeholders),
    [stakeholders]
  );

  const hasStakeholders = stakeholders.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white">
            <Briefcase className="h-4 w-4" aria-hidden="true" />
          </div>
          {t('demand.businessCase.strategic.stakeholderAnalysis')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t('demand.businessCase.strategic.keyStakeholders')}</p>
          {isEditMode ? (
            <div className="space-y-3">
              {!hasStakeholders && (
                <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-30" aria-hidden="true" />
                  <p className="text-sm">{t('demand.businessCase.strategic.noStakeholders')}</p>
                  <p className="text-xs mt-1">{t('demand.businessCase.strategic.addStakeholderHint')}</p>
                </div>
              )}
              {stakeholders.map((stakeholder, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label htmlFor={`stakeholder-name-${idx}`} className="sr-only">Stakeholder name</label>
                      <Input
                        id={`stakeholder-name-${idx}`}
                        placeholder={t('demand.businessCase.strategic.nameRole')}
                        value={stakeholder.name || ''}
                        onChange={(e) => stakeholderUpdater.updateItem(idx, { name: e.target.value })}
                        data-testid={`input-stakeholder-name-${idx}`}
                      />
                    </div>
                    <Select
                      value={stakeholder.influence || ''}
                      onValueChange={(val) => stakeholderUpdater.updateItem(idx, { influence: val })}
                    >
                      <SelectTrigger className="w-32" data-testid={`select-stakeholder-influence-${idx}`} aria-label="Power level">
                        <SelectValue placeholder={t('demand.businessCase.strategic.power')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">{t('demand.businessCase.strategic.highPower')}</SelectItem>
                        <SelectItem value="Medium">{t('demand.businessCase.strategic.medPower')}</SelectItem>
                        <SelectItem value="Low">{t('demand.businessCase.strategic.lowPower')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={stakeholder.interest || ''}
                      onValueChange={(val) => stakeholderUpdater.updateItem(idx, { interest: val })}
                    >
                      <SelectTrigger className="w-32" data-testid={`select-stakeholder-interest-${idx}`} aria-label="Interest level">
                        <SelectValue placeholder={t('demand.businessCase.strategic.interest')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">{t('demand.businessCase.strategic.highInterest')}</SelectItem>
                        <SelectItem value="Medium">{t('demand.businessCase.strategic.medInterest')}</SelectItem>
                        <SelectItem value="Low">{t('demand.businessCase.strategic.lowInterest')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => stakeholderUpdater.removeItem(idx)}
                      data-testid={`button-remove-stakeholder-${idx}`}
                      aria-label={`Remove stakeholder ${idx + 1}`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                  <div>
                    <label htmlFor={`stakeholder-strategy-${idx}`} className="sr-only">Engagement strategy</label>
                    <Input
                      id={`stakeholder-strategy-${idx}`}
                      placeholder={t('demand.businessCase.strategic.engagementStrategy')}
                      value={stakeholder.engagementStrategy || ''}
                      onChange={(e) => stakeholderUpdater.updateItem(idx, { engagementStrategy: e.target.value })}
                      data-testid={`input-stakeholder-strategy-${idx}`}
                    />
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => stakeholderUpdater.addItem(createEmptyStakeholder())}
                data-testid="button-add-stakeholder"
              >
                {t('demand.businessCase.strategic.addStakeholder')}
              </Button>
            </div>
          ) : hasStakeholders ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {stakeholders.map((stakeholder, idx) => (
                <div key={idx} className="border rounded-lg p-3" data-testid={`item-stakeholder-${idx}`}>
                  <p className="font-medium text-sm">{stakeholder.name || <span className="italic text-muted-foreground">{t('demand.businessCase.strategic.unnamed')}</span>}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant={stakeholder.influence === 'High' ? 'default' : 'outline'} className="text-xs">
                      {stakeholder.influence || t('demand.businessCase.strategic.unknown')} {t('demand.businessCase.strategic.influence')}
                    </Badge>
                    <Badge variant={stakeholder.interest === 'High' ? 'default' : 'outline'} className="text-xs">
                      {stakeholder.interest || t('demand.businessCase.strategic.unknown')} {t('demand.businessCase.strategic.interest')}
                    </Badge>
                  </div>
                  {stakeholder.engagementStrategy && (
                    <p className="text-xs text-muted-foreground mt-2">{stakeholder.engagementStrategy}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t('demand.businessCase.strategic.noStakeholders')}</p>
          )}
        </div>

        {hasStakeholders && matrixData && (
          <div className="mt-6">
            <PowerInterestMatrix data={matrixData} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AssumptionsDependenciesSectionInline({
  businessCase,
  isEditMode,
  updateField,
}: BusinessCaseSectionProps) {
  const { t } = useTranslation();
  const assumptions = getAssumptionItems(businessCase.keyAssumptions);
  const assumptionsUpdater = createArrayUpdater<AssumptionItem>(assumptions, updateField, 'keyAssumptions');

  const dependencies = getDependencyItems(businessCase.projectDependencies) .length > 0
    ? getDependencyItems(businessCase.projectDependencies)
    : getDependencyItems(businessCase.dependencies);
  const dependenciesUpdater = createArrayUpdater<DependencyItem>(dependencies, updateField, 'projectDependencies');

  const hasAssumptions = assumptions.length > 0;
  const hasDependencies = dependencies.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white">
            <Shield className="h-4 w-4" aria-hidden="true" />
          </div>
          {t('demand.businessCase.strategic.assumptionsDependencies')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t('demand.businessCase.strategic.keyAssumptions')}</p>
          {isEditMode ? (
            <div className="space-y-3">
              {!hasAssumptions && (
                <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Shield className="h-10 w-10 mx-auto mb-2 opacity-30" aria-hidden="true" />
                  <p className="text-sm">{t('demand.businessCase.strategic.noAssumptions')}</p>
                  <p className="text-xs mt-1">{t('demand.businessCase.strategic.addAssumptionHint')}</p>
                </div>
              )}
              {assumptions.map((item, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label htmlFor={`assumption-${idx}`} className="sr-only">{t('demand.businessCase.strategic.assumption')}</label>
                      <Input
                        id={`assumption-${idx}`}
                        placeholder={t('demand.businessCase.strategic.assumption')}
                        value={item.assumption || ''}
                        onChange={(e) => assumptionsUpdater.updateItem(idx, { assumption: e.target.value })}
                        data-testid={`input-assumption-${idx}`}
                      />
                    </div>
                    <Select
                      value={item.impact || ''}
                      onValueChange={(val) => assumptionsUpdater.updateItem(idx, { impact: val })}
                    >
                      <SelectTrigger className="w-32" data-testid={`select-assumption-impact-${idx}`} aria-label={t('demand.businessCase.strategic.impactLevel')}>
                        <SelectValue placeholder={t('demand.businessCase.strategic.impact')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">{t('demand.businessCase.strategic.highImpact')}</SelectItem>
                        <SelectItem value="Medium">{t('demand.businessCase.strategic.medImpact')}</SelectItem>
                        <SelectItem value="Low">{t('demand.businessCase.strategic.lowImpact')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={item.likelihood || ''}
                      onValueChange={(val) => assumptionsUpdater.updateItem(idx, { likelihood: val })}
                    >
                      <SelectTrigger className="w-32" data-testid={`select-assumption-likelihood-${idx}`} aria-label={t('demand.businessCase.strategic.likelihoodLevel')}>
                        <SelectValue placeholder={t('demand.businessCase.strategic.likelihood')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">{t('demand.businessCase.strategic.highLikely')}</SelectItem>
                        <SelectItem value="Medium">{t('demand.businessCase.strategic.medLikely')}</SelectItem>
                        <SelectItem value="Low">{t('demand.businessCase.strategic.lowLikely')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => assumptionsUpdater.removeItem(idx)}
                      data-testid={`button-remove-assumption-${idx}`}
                      aria-label={`Remove assumption ${idx + 1}`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => assumptionsUpdater.addItem(createEmptyAssumption())}
                data-testid="button-add-assumption"
              >
                {t('demand.businessCase.strategic.addAssumption')}
              </Button>
            </div>
          ) : hasAssumptions ? (
            <div className="space-y-2">
              {assumptions.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2" data-testid={`item-assumption-${idx}`}>
                  <Badge variant="outline" className="text-xs mt-0.5">
                    {item.impact || t('demand.businessCase.strategic.unknown')} {t('demand.businessCase.strategic.impact')}
                  </Badge>
                  <Badge variant="outline" className="text-xs mt-0.5">
                    {item.likelihood || t('demand.businessCase.strategic.unknown')} {t('demand.businessCase.strategic.likelihood')}
                  </Badge>
                  <p className="text-sm flex-1">{item.assumption || <span className="italic text-muted-foreground">{t('demand.businessCase.strategic.untitled')}</span>}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t('demand.businessCase.strategic.noAssumptions')}</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">{t('demand.businessCase.strategic.projectDependencies')}</p>
          {isEditMode ? (
            <div className="space-y-3">
              {!hasDependencies && (
                <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Shield className="h-10 w-10 mx-auto mb-2 opacity-30" aria-hidden="true" />
                  <p className="text-sm">{t('demand.businessCase.strategic.noDependencies')}</p>
                  <p className="text-xs mt-1">{t('demand.businessCase.strategic.addDependencyHint')}</p>
                </div>
              )}
              {dependencies.map((dep, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label htmlFor={`dependency-${idx}`} className="sr-only">{t('demand.businessCase.strategic.dependency')}</label>
                      <Input
                        id={`dependency-${idx}`}
                        placeholder={t('demand.businessCase.strategic.dependency')}
                        value={dep.dependency || ''}
                        onChange={(e) => dependenciesUpdater.updateItem(idx, { dependency: e.target.value })}
                        data-testid={`input-dependency-${idx}`}
                      />
                    </div>
                    <div>
                      <label htmlFor={`dependency-owner-${idx}`} className="sr-only">{t('demand.businessCase.strategic.owner')}</label>
                      <Input
                        id={`dependency-owner-${idx}`}
                        placeholder={t('demand.businessCase.strategic.owner')}
                        value={dep.owner || ''}
                        onChange={(e) => dependenciesUpdater.updateItem(idx, { owner: e.target.value })}
                        className="w-40"
                        data-testid={`input-dependency-owner-${idx}`}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dependenciesUpdater.removeItem(idx)}
                      data-testid={`button-remove-dependency-${idx}`}
                      aria-label={`Remove dependency ${idx + 1}`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => dependenciesUpdater.addItem(createEmptyDependency())}
                data-testid="button-add-dependency"
              >
                {t('demand.businessCase.strategic.addDependency')}
              </Button>
            </div>
          ) : hasDependencies ? (
            <div className="space-y-2">
              {dependencies.map((dep, idx) => (
                <div key={idx} className="flex items-start gap-2" data-testid={`item-dependency-${idx}`}>
                  <Badge variant="outline" className="text-xs mt-0.5">
                    {dep.owner || t('demand.businessCase.strategic.unassigned')}
                  </Badge>
                  <p className="text-sm flex-1">{dep.dependency || <span className="italic text-muted-foreground">{t('demand.businessCase.strategic.untitled')}</span>}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t('demand.businessCase.strategic.noDependencies')}</p>
          )}
        </div>

        {hasAssumptions && (
          <div className="mt-6">
            <RiskHeatMap assumptions={assumptions} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
