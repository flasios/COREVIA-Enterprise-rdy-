import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Calendar,
  FileText,
  TrendingUp,
  X,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";
import { GanttChart } from "@/components/shared/visualization";
import type {
  BusinessCaseSectionProps,
  Risk,
  RiskMatrix,
  ImplementationPhase,
  Milestone,
  NextStep,
} from "./types";
import {
  safeRender,
  getRiskLevelColor,
  getSeverityColor,
  getRiskImpactText,
  parseNumberInput,
  getAssumptions,
  getDependencies,
  getRecommendationsText,
  isEnrichedRecommendations,
} from "./helpers";

function isIsoDateString(value: string | undefined): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getAlternativeSolutionItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        return safeRender(record.description || record.name || item).trim();
      }
      return '';
    })
    .filter(Boolean);
}

function isStaleNoPaybackRisk(risk: Risk): boolean {
  const name = (risk.name || '').toLowerCase();
  const description = (risk.description || '').toLowerCase();
  return name.includes('no payback period') || description.includes('never breaks even within the projection horizon');
}

export function RiskAssessmentSection({
  businessCase,
  isEditMode,
  updateField,
  validationErrors,
  computedRecommendation,
}: Readonly<BusinessCaseSectionProps & {
  computedRecommendation?: {
    financialView?: 'pilot' | 'full';
    paybackMonths?: number;
  } | null;
}>) {
  const { t } = useTranslation();
  const rawIdentifiedRisks: Risk[] = Array.isArray(businessCase.identifiedRisks) ? businessCase.identifiedRisks : [];
  const shouldFilterNoPaybackRisk = computedRecommendation?.financialView === 'pilot'
    && typeof computedRecommendation.paybackMonths === 'number'
    && Number.isFinite(computedRecommendation.paybackMonths)
    && computedRecommendation.paybackMonths >= 0;
  const identifiedRisks = shouldFilterNoPaybackRisk
    ? rawIdentifiedRisks.filter((risk) => !isStaleNoPaybackRisk(risk))
    : rawIdentifiedRisks;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white">
            <AlertTriangle className="h-4 w-4" />
          </div>
          {t('demand.businessCase.additional.riskAssessment')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t('demand.businessCase.additional.riskLevel')}</p>
            {isEditMode ? (
              <Select
                value={businessCase.riskLevel || ''}
                onValueChange={(value) => updateField('riskLevel', value)}
              >
                <SelectTrigger className="w-[180px]" data-testid="select-risk-level">
                  <SelectValue placeholder={t('demand.businessCase.additional.selectLevel')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge className={getRiskLevelColor(businessCase.riskLevel || 'low')} data-testid="badge-risk-level">
                {businessCase.riskLevel?.toUpperCase()}
              </Badge>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t('demand.businessCase.additional.riskScore')}</p>
            {isEditMode ? (
              <div className="space-y-1">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={businessCase.riskScore || ''}
                  onChange={(e) => updateField('riskScore', e.target.value)}
                  className={`w-24 ${validationErrors.riskScore ? 'border-red-500' : ''}`}
                  data-testid="input-risk-score"
                />
                {validationErrors.riskScore && (
                  <p className="text-xs text-red-600">{validationErrors.riskScore}</p>
                )}
              </div>
            ) : (
              <p className="text-2xl font-bold" data-testid="text-risk-score">{businessCase.riskScore}/100</p>
            )}
          </div>
        </div>

        {/* Risk Matrix - auto-computed from identified risks if riskMatrixData exists */}
        {(() => {
          // Always compute from current identified risks when available so matrix updates immediately after edits.
          const matrix: RiskMatrix = identifiedRisks.length > 0
            ? (() => {
                const m: RiskMatrix = { highProbabilityHighImpact: [], highProbabilityLowImpact: [], lowProbabilityHighImpact: [], lowProbabilityLowImpact: [] };
                const highSet = new Set(['high', 'critical', 'very high']);
                identifiedRisks.forEach((r: Risk) => {
                  const prob = (r.probability || r.severity || 'medium').toLowerCase();
                  const imp = (typeof r.impact === 'string' ? r.impact : r.severity || 'medium').toLowerCase();
                  if (highSet.has(prob) && highSet.has(imp)) m.highProbabilityHighImpact.push(r);
                  else if (highSet.has(prob)) m.highProbabilityLowImpact.push(r);
                  else if (highSet.has(imp)) m.lowProbabilityHighImpact.push(r);
                  else m.lowProbabilityLowImpact.push(r);
                });
                return m;
              })()
            : (businessCase.riskMatrixData || { highProbabilityHighImpact: [], highProbabilityLowImpact: [], lowProbabilityHighImpact: [], lowProbabilityLowImpact: [] });
          const hasAnyRisk = Object.values(matrix).some(arr => arr.length > 0);
          if (!hasAnyRisk) return null;
          return (
            <div className="space-y-2">
              <p className="text-sm font-semibold">{t('demand.businessCase.additional.riskMatrix')}</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'highProbabilityHighImpact' as keyof RiskMatrix, label: 'High Impact / High Probability', bg: 'bg-red-500/10 border-red-200 dark:border-red-800' },
                  { key: 'highProbabilityLowImpact' as keyof RiskMatrix, label: 'Low Impact / High Probability', bg: 'bg-yellow-500/10 border-yellow-200 dark:border-yellow-800' },
                  { key: 'lowProbabilityHighImpact' as keyof RiskMatrix, label: 'High Impact / Low Probability', bg: 'bg-orange-500/10 border-orange-200 dark:border-orange-800' },
                  { key: 'lowProbabilityLowImpact' as keyof RiskMatrix, label: 'Low Impact / Low Probability', bg: 'bg-green-500/10 border-green-200 dark:border-green-800' },
                ]).map(({ key, label, bg }) => {
                  const items = matrix[key] || [];
                  return (
                    <div key={key} className={`p-3 border rounded-lg ${bg}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold">{label}</p>
                        <Badge variant="outline" className="text-[10px] h-5">{items.length}</Badge>
                      </div>
                      <div className="space-y-1">
                        {items.length > 0 ? items.map((risk: Risk) => (
                          <div key={risk.name || risk.description || crypto.randomUUID()} className="text-xs flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                            <span className="font-medium">{risk.name || safeRender(risk)}</span>
                          </div>
                        )) : (
                          <p className="text-xs text-muted-foreground italic">{t('demand.businessCase.additional.none')}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {identifiedRisks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{t('demand.businessCase.additional.identifiedRisks')} ({identifiedRisks.length})</p>
              {isEditMode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    const risks = [...identifiedRisks];
                    risks.push({ name: '', severity: 'medium', description: '', probability: 'medium', impact: 'medium', mitigation: '', owner: '' } as Risk);
                    updateField('identifiedRisks', risks);
                  }}
                  data-testid="button-add-risk"
                >
                  + {t('demand.businessCase.additional.addRisk', 'Add Risk')}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {identifiedRisks.map((risk: Risk, idx: number) => (
                <div key={`risk-${risk.name}-${idx}`} className="flex items-start gap-2 p-2.5 border rounded-lg bg-muted/30" data-testid={`risk-item-${idx}`}>
                  {isEditMode ? (
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={risk.name || ''}
                          onChange={(e) => {
                            const risks = [...identifiedRisks];
                            risks[idx] = { ...risks[idx]!, name: e.target.value };
                            updateField('identifiedRisks', risks);
                          }}
                          placeholder="Risk name"
                          className="h-7 text-xs flex-1"
                          data-testid={`input-risk-name-${idx}`}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                          onClick={() => {
                            const risks = [...identifiedRisks];
                            risks.splice(idx, 1);
                            updateField('identifiedRisks', risks);
                          }}
                          data-testid={`button-remove-risk-${idx}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Textarea
                        value={risk.description || ''}
                        onChange={(e) => {
                          const risks = [...identifiedRisks];
                          risks[idx] = { ...risks[idx]!, description: e.target.value };
                          updateField('identifiedRisks', risks);
                        }}
                        placeholder="Description"
                        className="text-xs min-h-[40px] resize-none"
                        rows={2}
                        data-testid={`textarea-risk-desc-${idx}`}
                      />
                      <div className="grid grid-cols-3 gap-1.5">
                        <Select
                          value={risk.severity || 'medium'}
                          onValueChange={(value) => {
                            const risks = [...identifiedRisks];
                            risks[idx] = { ...risks[idx]!, severity: value as Risk['severity'] };
                            updateField('identifiedRisks', risks);
                          }}
                        >
                          <SelectTrigger className="h-7 text-[10px]" data-testid={`select-risk-severity-${idx}`}>
                            <SelectValue placeholder="Severity" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={(risk.probability as string) || 'medium'}
                          onValueChange={(value) => {
                            const risks = [...identifiedRisks];
                            risks[idx] = { ...risks[idx]!, probability: value };
                            updateField('identifiedRisks', risks);
                          }}
                        >
                          <SelectTrigger className="h-7 text-[10px]" data-testid={`select-risk-prob-${idx}`}>
                            <SelectValue placeholder="Probability" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">P: Low</SelectItem>
                            <SelectItem value="medium">P: Medium</SelectItem>
                            <SelectItem value="high">P: High</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={typeof risk.impact === 'string' ? risk.impact : 'medium'}
                          onValueChange={(value) => {
                            const risks = [...identifiedRisks];
                            risks[idx] = { ...risks[idx]!, impact: value };
                            updateField('identifiedRisks', risks);
                          }}
                        >
                          <SelectTrigger className="h-7 text-[10px]" data-testid={`select-risk-impact-${idx}`}>
                            <SelectValue placeholder="Impact" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">I: Low</SelectItem>
                            <SelectItem value="medium">I: Medium</SelectItem>
                            <SelectItem value="high">I: High</SelectItem>
                            <SelectItem value="critical">I: Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        value={risk.mitigation || ''}
                        onChange={(e) => {
                          const risks = [...identifiedRisks];
                          risks[idx] = { ...risks[idx]!, mitigation: e.target.value };
                          updateField('identifiedRisks', risks);
                        }}
                        placeholder="Mitigation strategy"
                        className="h-7 text-xs"
                        data-testid={`input-risk-mitigation-${idx}`}
                      />
                    </div>
                  ) : (
                    <>
                  <Badge className={`${getSeverityColor(risk.severity)} text-[10px] px-1.5 py-0 h-5 flex-shrink-0`}>
                    {risk.severity}
                  </Badge>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="font-medium text-xs leading-tight truncate" title={risk.name}>{risk.name}</p>
                    {risk.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{risk.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {risk.probability && (
                        <span>P: <strong className="text-foreground">{risk.probability}</strong></span>
                      )}
                      {risk.impact && (
                        <span>I: <strong className="text-foreground">{getRiskImpactText(risk.impact)}</strong></span>
                      )}
                    </div>
                    {risk.mitigation && (
                      <details className="mt-0.5">
                        <summary className="text-[10px] text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                          {t('demand.businessCase.additional.mitigation')}
                        </summary>
                        <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-1 pl-2 border-l-2 border-blue-200">
                          {risk.mitigation}
                        </p>
                      </details>
                    )}
                  </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {isEditMode && (!businessCase.identifiedRisks || businessCase.identifiedRisks.length === 0) && (
          <div className="text-center py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                updateField('identifiedRisks', [{ name: '', severity: 'medium', description: '', probability: 'medium', impact: 'medium', mitigation: '', owner: '' }]);
              }}
              data-testid="button-add-first-risk"
            >
              + {t('demand.businessCase.additional.addRisk', 'Add Risk')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BusinessRequirementsSection({
  businessCase,
  isEditMode,
  updateField,
}: Readonly<BusinessCaseSectionProps>) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white">
            <FileText className="h-4 w-4" />
          </div>
          {t('demand.businessCase.additional.businessRequirements')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEditMode ? (
          <Textarea
            value={businessCase.businessRequirements || ''}
            onChange={(e) => updateField('businessRequirements', e.target.value)}
            className="min-h-[100px]"
            data-testid="textarea-business-requirements"
          />
        ) : (
          <p className="text-sm leading-relaxed">{businessCase.businessRequirements}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function SolutionOverviewSection({
  businessCase,
  isEditMode,
  updateField,
}: Readonly<BusinessCaseSectionProps>) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white">
            <TrendingUp className="h-4 w-4" />
          </div>
          {t('demand.businessCase.additional.solutionOverview')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEditMode ? (
          <Textarea
            value={businessCase.solutionOverview || ''}
            onChange={(e) => updateField('solutionOverview', e.target.value)}
            className="min-h-[100px]"
            data-testid="textarea-solution-overview"
          />
        ) : (
          <p className="text-sm leading-relaxed">{businessCase.solutionOverview}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function AlternativeSolutionsSection({
  businessCase,
  isEditMode,
  updateField,
}: Readonly<BusinessCaseSectionProps>) {
  const alternatives = getAlternativeSolutionItems(businessCase.alternativeSolutions);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center text-white">
            <FileText className="h-4 w-4" />
          </div>
          Alternative Options
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isEditMode ? (
          <div className="space-y-2">
            {alternatives.map((alternative, idx) => (
              <div key={`alternative-${idx}`} className="flex gap-2">
                <Textarea
                  value={alternative}
                  onChange={(e) => {
                    const updated = [...alternatives];
                    updated[idx] = e.target.value;
                    updateField('alternativeSolutions', updated);
                  }}
                  className="min-h-[84px]"
                  data-testid={`textarea-alternative-${idx}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    updateField('alternativeSolutions', alternatives.filter((_, i) => i !== idx));
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateField('alternativeSolutions', [...alternatives, ''])}
              data-testid="button-add-alternative"
            >
              Add Alternative
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {alternatives.map((alternative, idx) => (
              <div key={`alternative-view-${idx}`} className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Option {idx + 1}</p>
                <p className="mt-1 text-sm leading-relaxed">{alternative}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ImplementationPlanSection({
  businessCase,
  isEditMode,
  updateField,
}: Readonly<BusinessCaseSectionProps>) {
  const { t } = useTranslation();
  const implementationPhases = Array.isArray(businessCase.implementationPhases) ? businessCase.implementationPhases : [];
  const milestones = Array.isArray(businessCase.milestones) ? businessCase.milestones : [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white">
            <Calendar className="h-4 w-4" />
          </div>
          {t('demand.businessCase.additional.implementationPlan')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isEditMode && implementationPhases.length > 0 && (
          <GanttChart
            phases={implementationPhases}
            milestones={milestones}
          />
        )}

        {isEditMode && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t('demand.businessCase.additional.implementationPhases')}</p>
            <div className="space-y-3">
              {implementationPhases.map((phase: ImplementationPhase, idx: number) => (
                <div key={`phase-${phase.name}-${idx}`} className="p-3 border rounded-lg space-y-2" data-testid={`edit-phase-${idx}`}>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">{t('demand.businessCase.additional.phaseName')}</label>
                      <Input
                        value={phase.name || ''}
                        onChange={(e) => {
                          const updated = [...(businessCase.implementationPhases || [])];
                          updated[idx] = { ...phase, name: e.target.value };
                          updateField('implementationPhases', updated);
                        }}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">{t('demand.businessCase.additional.durationMonths')}</label>
                        <Input
                          type="number"
                          min="0"
                          value={String(phase.durationMonths || phase.duration || '')}
                          onChange={(e) => {
                            const duration = parseNumberInput(e.target.value, 0);
                            const updated = [...implementationPhases];
                            updated[idx] = { ...phase, durationMonths: duration };
                            updateField('implementationPhases', updated);
                          }}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const updated = implementationPhases.filter((_: ImplementationPhase, i: number) => i !== idx);
                          updateField('implementationPhases', updated);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const updated = [...implementationPhases, { name: '', durationMonths: 1 }];
                  updateField('implementationPhases', updated);
                }}
                data-testid="button-add-phase"
              >
                {t('demand.businessCase.additional.addPhase')}
              </Button>
            </div>
          </div>
        )}

        {isEditMode && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t('demand.businessCase.additional.milestones')}</p>
            <div className="space-y-2">
              {milestones.map((milestone: Milestone, idx: number) => (
                <div key={`milestone-${milestone.name}-${idx}`} className="flex gap-2" data-testid={`edit-milestone-${idx}`}>
                  <Input
                    placeholder={t('demand.businessCase.additional.milestoneName')}
                    value={milestone.name || ''}
                    onChange={(e) => {
                      const updated = [...(businessCase.milestones || [])];
                      updated[idx] = { ...milestone, name: e.target.value };
                      updateField('milestones', updated);
                    }}
                    className="flex-1"
                  />
                  <Input
                    type="date"
                    value={isIsoDateString(milestone.date) ? milestone.date : ''}
                    onChange={(e) => {
                      const updated = [...milestones];
                      updated[idx] = { ...milestone, date: e.target.value };
                      updateField('milestones', updated);
                    }}
                    className="w-40"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const updated = milestones.filter((_: Milestone, i: number) => i !== idx);
                      updateField('milestones', updated);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const updated = [...milestones, { name: '', date: '' }];
                  updateField('milestones', updated);
                }}
                data-testid="button-add-milestone"
              >
                {t('demand.businessCase.additional.addMilestone')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AssumptionsDependenciesSection({
  businessCase,
  isEditMode,
  updateField,
}: Readonly<BusinessCaseSectionProps>) {
  const { t } = useTranslation();
  const assumptions = getAssumptions(businessCase.assumptions || businessCase.keyAssumptions);
  const dependencies = getDependencies(businessCase.dependencies || businessCase.projectDependencies);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center text-white">
            <Lightbulb className="h-4 w-4" />
          </div>
          {t('demand.businessCase.additional.assumptionsDependencies')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="font-semibold text-sm mb-3">{t('demand.businessCase.additional.keyAssumptions')}</h4>
          {isEditMode ? (
            <div className="space-y-2">
              {assumptions.map((assumption: string, idx: number) => (
                <div key={`assumption-${idx}`} className="flex gap-2">
                  <Input
                    value={assumption}
                    onChange={(e) => {
                      const updated = [...assumptions];
                      updated[idx] = e.target.value;
                      updateField('assumptions', updated);
                    }}
                    data-testid={`input-assumption-${idx}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const updated = assumptions.filter((_: string, i: number) => i !== idx);
                      updateField('assumptions', updated);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  updateField('assumptions', [...assumptions, '']);
                }}
                data-testid="button-add-assumption"
              >
                {t('demand.businessCase.additional.addAssumption')}
              </Button>
            </div>
          ) : (
            <ul className="list-disc list-inside space-y-1 text-sm">
              {assumptions.map((item: string, idx: number) => (
                <li key={`assumption-view-${idx}`}>{item}</li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="font-semibold text-sm mb-3">{t('demand.businessCase.additional.projectDependencies')}</h4>
          {isEditMode ? (
            <div className="space-y-2">
              {dependencies.map((dep: string, idx: number) => (
                <div key={`dep-${idx}`} className="flex gap-2">
                  <Input
                    value={dep}
                    onChange={(e) => {
                      const updated = [...dependencies];
                      updated[idx] = e.target.value;
                      updateField('dependencies', updated);
                    }}
                    data-testid={`input-dependency-${idx}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const updated = dependencies.filter((_: string, i: number) => i !== idx);
                      updateField('dependencies', updated);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  updateField('dependencies', [...dependencies, '']);
                }}
                data-testid="button-add-dependency"
              >
                {t('demand.businessCase.additional.addDependency')}
              </Button>
            </div>
          ) : (
            <ul className="list-disc list-inside space-y-1 text-sm">
              {dependencies.map((item: string, idx: number) => (
                <li key={`dep-view-${idx}`}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ComputedRecommendation {
  decision: string;
  rationale: string;
}

interface RecommendationsSectionProps extends BusinessCaseSectionProps {
  computedRecommendation?: ComputedRecommendation;
}

export function RecommendationsSection({
  businessCase,
  isEditMode,
  updateField,
  computedRecommendation,
}: Readonly<RecommendationsSectionProps>) {
  const { t } = useTranslation();
  const recommendationText = getRecommendationsText(businessCase.recommendations);
  const hasEnrichedRecommendations = isEnrichedRecommendations(businessCase.recommendations);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          {t('demand.businessCase.additional.recommendationsConclusion')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {computedRecommendation && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-emerald-600">{computedRecommendation.decision}</Badge>
              <span className="text-sm font-medium">{t('demand.businessCase.additional.financialModelDecision')}</span>
            </div>
            <p className="text-sm text-muted-foreground">{computedRecommendation.rationale}</p>
          </div>
        )}

        <div>
          <h4 className="font-semibold text-sm mb-2">{t('demand.businessCase.additional.primaryRecommendation')}</h4>
          {isEditMode ? (
            <Textarea
              value={recommendationText}
              onChange={(e) => updateField('recommendations', e.target.value)}
              className="min-h-[120px]"
              data-testid="textarea-recommendations"
            />
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {recommendationText}
            </p>
          )}
        </div>

        {hasEnrichedRecommendations && !isEditMode && businessCase.recommendations && typeof businessCase.recommendations === 'object' && (
          <div className="space-y-4">
            {businessCase.recommendations.commercialCase && (
              <div className="rounded-lg border border-slate-300/60 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <h4 className="font-semibold text-sm mb-2">{t('demand.businessCase.additional.commercialCase')}</h4>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{businessCase.recommendations.commercialCase as string}</p>
              </div>
            )}
            {businessCase.recommendations.publicValueCase && (
              <div className="rounded-lg border border-emerald-300/60 bg-emerald-50/80 p-4 dark:border-emerald-700 dark:bg-emerald-950/30">
                <h4 className="font-semibold text-sm mb-2">{t('demand.businessCase.additional.publicValueCase')}</h4>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{businessCase.recommendations.publicValueCase as string}</p>
              </div>
            )}
            {businessCase.recommendations.keyFindings && (
              <div>
                <h4 className="font-semibold text-sm mb-2">{t('demand.businessCase.additional.keyFindings')}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {(businessCase.recommendations.keyFindings || []).map((finding: string) => (
                    <li key={finding}>{finding}</li>
                  ))}
                </ul>
              </div>
            )}
            {businessCase.recommendations.nextSteps && (
              <div>
                <h4 className="font-semibold text-sm mb-2">{t('demand.businessCase.additional.nextSteps')}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {(businessCase.recommendations.nextSteps || []).map((step: string | NextStep) => {
                    const nextStepText = typeof step === 'string'
                      ? step
                      : step.step || step.text || step.description || step.action || '';

                    return nextStepText ? <li key={nextStepText}>{nextStepText}</li> : null;
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
