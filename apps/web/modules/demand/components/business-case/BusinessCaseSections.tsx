import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Target,
  AlertTriangle,
  X,
} from "lucide-react";
import type { BusinessCaseSectionProps, BusinessCaseData, SmartObjective } from "./types";
import { 
  createArrayUpdater, 
  createScopeUpdater,
  createEmptySmartObjective,
  TEXT_SECTION_CONFIGS,
  type TextSectionConfig 
} from "./helpers";

interface GenericTextSectionProps extends BusinessCaseSectionProps {
  config: TextSectionConfig;
  icon: React.ComponentType<{ className?: string }>;
}

function normalizeDisplayNarrative(text: string): string {
  return text
    .replace(/\.{2,}/g, '.')
    .replace(/\s+([.!?])/g, '$1')
    .replace(/([.!?])\s*([.!?])/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

function GenericTextSection({
  businessCase,
  isEditMode,
  updateField,
  validationErrors,
  config,
  icon: Icon,
}: GenericTextSectionProps) {
  const { t } = useTranslation();
  const { field, title, gradientFrom, gradientTo, minHeightClass } = config;
  const value = (businessCase[field as keyof BusinessCaseData] as string) || '';
  const displayValue = normalizeDisplayNarrative(value);
  const error = validationErrors[field];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center text-white`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEditMode ? (
          <div className="space-y-2">
            <Textarea
              value={value}
              onChange={(e) => updateField(field, e.target.value)}
              className={`${minHeightClass} ${error ? 'border-red-500' : ''}`}
              data-testid={`textarea-${field.replace(/([A-Z])/g, '-$1').toLowerCase()}`}
              aria-label={title}
              aria-invalid={!!error}
            />
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          </div>
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid={`text-${field.replace(/([A-Z])/g, '-$1').toLowerCase()}`}>
            {displayValue || <span className="text-muted-foreground italic">{t('demand.businessCase.sections.noContentProvided')}</span>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ExecutiveSummarySection(props: BusinessCaseSectionProps) {
  return (
    <GenericTextSection
      {...props}
      config={TEXT_SECTION_CONFIGS.executiveSummary}
      icon={FileText}
    />
  );
}

export function BackgroundContextSection(props: BusinessCaseSectionProps) {
  return (
    <GenericTextSection
      {...props}
      config={TEXT_SECTION_CONFIGS.backgroundContext}
      icon={FileText}
    />
  );
}

export function ProblemStatementSection(props: BusinessCaseSectionProps) {
  return (
    <GenericTextSection
      {...props}
      config={TEXT_SECTION_CONFIGS.problemStatement}
      icon={AlertTriangle}
    />
  );
}

export function ObjectivesScopeSection({
  businessCase,
  isEditMode,
  updateField,
  validationErrors: _validationErrors,
}: BusinessCaseSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white">
            <Target className="h-4 w-4" aria-hidden="true" />
          </div>
          Objectives & Scope
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <SmartObjectivesSubsection
          businessCase={businessCase}
          isEditMode={isEditMode}
          updateField={updateField}
        />
        <ScopeDefinitionSubsection
          businessCase={businessCase}
          isEditMode={isEditMode}
          updateField={updateField}
        />
      </CardContent>
    </Card>
  );
}

function SmartObjectivesSubsection({
  businessCase,
  isEditMode,
  updateField,
}: {
  businessCase: BusinessCaseData;
  isEditMode: boolean;
  updateField: (field: string, value: unknown) => void;
}) {
  const { t } = useTranslation();
  const objectivesUpdater = createArrayUpdater<SmartObjective>(
    businessCase.smartObjectives,
    updateField,
    'smartObjectives'
  );
  
  const objectives = objectivesUpdater.getItems();
  const hasObjectives = objectives.length > 0;

  return (
    <div>
      <h4 className="font-semibold text-sm mb-3">{t('demand.businessCase.sections.smartObjectives')}</h4>
      {isEditMode ? (
        <div className="space-y-4">
          {!hasObjectives && (
            <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
              <Target className="h-10 w-10 mx-auto mb-2 opacity-30" aria-hidden="true" />
              <p className="text-sm">No objectives defined yet</p>
              <p className="text-xs mt-1">{t('demand.businessCase.sections.addObjectiveHint')}</p>
            </div>
          )}
          {objectives.map((obj, idx) => (
            <div key={idx} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <label htmlFor={`objective-${idx}`} className="sr-only">
                    Objective {idx + 1}
                  </label>
                  <Input
                    id={`objective-${idx}`}
                    placeholder="Objective"
                    value={obj.objective || ''}
                    onChange={(e) => objectivesUpdater.updateItem(idx, { objective: e.target.value })}
                    data-testid={`input-smart-objective-${idx}`}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => objectivesUpdater.removeItem(idx)}
                  data-testid={`button-remove-objective-${idx}`}
                  aria-label={`Remove objective ${idx + 1}`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={`specific-${idx}`} className="sr-only">Specific</label>
                  <Input
                    id={`specific-${idx}`}
                    placeholder="Specific"
                    value={obj.specific || ''}
                    onChange={(e) => objectivesUpdater.updateItem(idx, { specific: e.target.value })}
                    data-testid={`input-objective-specific-${idx}`}
                  />
                </div>
                <div>
                  <label htmlFor={`measurable-${idx}`} className="sr-only">Measurable</label>
                  <Input
                    id={`measurable-${idx}`}
                    placeholder="Measurable"
                    value={obj.measurable || ''}
                    onChange={(e) => objectivesUpdater.updateItem(idx, { measurable: e.target.value })}
                    data-testid={`input-objective-measurable-${idx}`}
                  />
                </div>
                <div>
                  <label htmlFor={`achievable-${idx}`} className="sr-only">Achievable</label>
                  <Input
                    id={`achievable-${idx}`}
                    placeholder="Achievable"
                    value={obj.achievable || ''}
                    onChange={(e) => objectivesUpdater.updateItem(idx, { achievable: e.target.value })}
                    data-testid={`input-objective-achievable-${idx}`}
                  />
                </div>
                <div>
                  <label htmlFor={`relevant-${idx}`} className="sr-only">Relevant</label>
                  <Input
                    id={`relevant-${idx}`}
                    placeholder="Relevant"
                    value={obj.relevant || ''}
                    onChange={(e) => objectivesUpdater.updateItem(idx, { relevant: e.target.value })}
                    data-testid={`input-objective-relevant-${idx}`}
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor={`timebound-${idx}`} className="sr-only">Time-Bound</label>
                  <Input
                    id={`timebound-${idx}`}
                    placeholder="Time-Bound"
                    value={obj.timeBound || ''}
                    onChange={(e) => objectivesUpdater.updateItem(idx, { timeBound: e.target.value })}
                    data-testid={`input-objective-timebound-${idx}`}
                  />
                </div>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => objectivesUpdater.addItem(createEmptySmartObjective())}
            data-testid="button-add-smart-objective"
          >
            Add Objective
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {!hasObjectives && (
            <p className="text-sm text-muted-foreground italic">{t('demand.businessCase.sections.noObjectivesDefined')}</p>
          )}
          {objectives.map((obj, idx) => (
            <div key={idx} className="border-l-4 border-amber-500 pl-4 py-2" data-testid={`item-smart-objective-${idx}`}>
              <p className="font-medium text-sm mb-2">{obj.objective || <span className="italic text-muted-foreground">{t('demand.businessCase.sections.untitledObjective')}</span>}</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div><strong>{t('demand.businessCase.sections.specific')}:</strong> {obj.specific || '-'}</div>
                <div><strong>{t('demand.businessCase.sections.measurable')}:</strong> {obj.measurable || '-'}</div>
                <div><strong>{t('demand.businessCase.sections.achievable')}:</strong> {obj.achievable || '-'}</div>
                <div><strong>{t('demand.businessCase.sections.relevant')}:</strong> {obj.relevant || '-'}</div>
                <div className="col-span-2"><strong>{t('demand.businessCase.sections.timeBound')}:</strong> {obj.timeBound || '-'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScopeDefinitionSubsection({
  businessCase,
  isEditMode,
  updateField,
}: {
  businessCase: BusinessCaseData;
  isEditMode: boolean;
  updateField: (field: string, value: unknown) => void;
}) {
  const { t } = useTranslation();
  const scopeUpdater = createScopeUpdater(businessCase.scopeDefinition, updateField);
  const inScopeItems = scopeUpdater.getItems('inScope');
  const outOfScopeItems = scopeUpdater.getItems('outOfScope');
  
  if (!businessCase.scopeDefinition && !isEditMode) return null;

  return (
    <div>
      <h4 className="font-semibold text-sm mb-3">{t('demand.businessCase.sections.scopeDefinition')}</h4>
      {isEditMode ? (
        <div className="space-y-4">
          <div>
            <label id="in-scope-label" className="text-xs font-medium mb-1 block">{t('demand.businessCase.sections.inScope')}</label>
            <div role="list" aria-labelledby="in-scope-label" className="space-y-2">
              {inScopeItems.length === 0 && (
                <p className="text-xs text-muted-foreground italic py-2">{t('demand.businessCase.sections.noInScopeItems')}</p>
              )}
              {inScopeItems.map((item, idx) => (
                <div key={idx} className="flex gap-2" role="listitem">
                  <label htmlFor={`scope-in-${idx}`} className="sr-only">In scope item {idx + 1}</label>
                  <Input
                    id={`scope-in-${idx}`}
                    value={item}
                    onChange={(e) => scopeUpdater.updateItem('inScope', idx, e.target.value)}
                    data-testid={`input-scope-in-${idx}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => scopeUpdater.removeItem('inScope', idx)}
                    aria-label={`Remove in-scope item ${idx + 1}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => scopeUpdater.addItem('inScope')}
              data-testid="button-add-scope-in"
              className="mt-2"
            >
              {t('demand.businessCase.sections.addInScopeItem')}
            </Button>
          </div>
          <div>
            <label id="out-scope-label" className="text-xs font-medium mb-1 block">{t('demand.businessCase.sections.outOfScope')}</label>
            <div role="list" aria-labelledby="out-scope-label" className="space-y-2">
              {outOfScopeItems.length === 0 && (
                <p className="text-xs text-muted-foreground italic py-2">{t('demand.businessCase.sections.noOutOfScopeItems')}</p>
              )}
              {outOfScopeItems.map((item, idx) => (
                <div key={idx} className="flex gap-2" role="listitem">
                  <label htmlFor={`scope-out-${idx}`} className="sr-only">Out of scope item {idx + 1}</label>
                  <Input
                    id={`scope-out-${idx}`}
                    value={item}
                    onChange={(e) => scopeUpdater.updateItem('outOfScope', idx, e.target.value)}
                    data-testid={`input-scope-out-${idx}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => scopeUpdater.removeItem('outOfScope', idx)}
                    aria-label={`Remove out-of-scope item ${idx + 1}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => scopeUpdater.addItem('outOfScope')}
              data-testid="button-add-scope-out"
              className="mt-2"
            >
              {t('demand.businessCase.sections.addOutOfScopeItem')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong className="text-green-600">{t('demand.businessCase.sections.inScope')}:</strong>
            {inScopeItems.length === 0 ? (
              <p className="text-muted-foreground italic mt-1">{t('demand.businessCase.sections.noneDefined')}</p>
            ) : (
              <ul className="list-disc list-inside mt-1">
                {inScopeItems.map((item, idx) => (
                  <li key={idx}>{item || <span className="italic text-muted-foreground">{t('demand.businessCase.sections.emptyItem')}</span>}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <strong className="text-red-600">{t('demand.businessCase.sections.outOfScope')}:</strong>
            {outOfScopeItems.length === 0 ? (
              <p className="text-muted-foreground italic mt-1">{t('demand.businessCase.sections.noneDefined')}</p>
            ) : (
              <ul className="list-disc list-inside mt-1">
                {outOfScopeItems.map((item, idx) => (
                  <li key={idx}>{item || <span className="italic text-muted-foreground">{t('demand.businessCase.sections.emptyItem')}</span>}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
