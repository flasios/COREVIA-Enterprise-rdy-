import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Clock, ShieldCheck, Target, Users } from 'lucide-react';

interface RequiredResources {
  teamSize?: string;
  budgetEstimate?: string;
  timelineEstimate?: string;
  infrastructure?: string[];
}

interface DetailedRequirementsRequiredResourcesProps {
  requiredResources: RequiredResources;
  isEditMode: boolean;
  highlightedSection?: string | null;
  hasFieldChanged: boolean;
  changeBadgeText: string;
  statusControls: ReactNode;
  assignmentPanel: ReactNode;
  onChangeField: (patch: Partial<RequiredResources>) => void;
}

export function DetailedRequirementsRequiredResources({
  requiredResources,
  isEditMode,
  highlightedSection,
  hasFieldChanged,
  changeBadgeText,
  statusControls,
  assignmentPanel,
  onChangeField,
}: DetailedRequirementsRequiredResourcesProps) {
  const { t } = useTranslation();

  return (
    <Card
      id="section-requiredResources"
      className={`${hasFieldChanged && isEditMode ? 'ring-2 ring-primary' : ''} ${highlightedSection === 'requiredResources' ? 'ring-4 ring-primary ring-offset-2 ring-offset-background shadow-2xl' : ''}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                <Users className="h-4 w-4" />
              </div>
              {t('demand.tabs.requirements.requiredResources')}
              {hasFieldChanged && isEditMode && (
                <Badge variant="default" className="ml-2">{changeBadgeText}</Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{t('demand.tabs.requirements.resourcesDescription')}</p>
          </div>
          <div className="flex items-center gap-2">{!isEditMode && statusControls}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isEditMode && assignmentPanel}
        {isEditMode ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs">{t('demand.tabs.requirements.labels.teamSize')}</Label>
                <Input
                  value={requiredResources.teamSize || ''}
                  onChange={(e) => onChangeField({ teamSize: e.target.value })}
                  data-testid="input-team-size"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t('demand.tabs.requirements.labels.budgetEstimate')}</Label>
                <Input
                  value={requiredResources.budgetEstimate || ''}
                  onChange={(e) => onChangeField({ budgetEstimate: e.target.value })}
                  data-testid="input-budget-estimate"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t('demand.tabs.requirements.labels.timelineEstimate')}</Label>
                <Input
                  value={requiredResources.timelineEstimate || ''}
                  onChange={(e) => onChangeField({ timelineEstimate: e.target.value })}
                  data-testid="input-timeline-estimate"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t('demand.tabs.requirements.labels.infrastructureRequirements')}</Label>
              <Textarea
                value={requiredResources.infrastructure?.join('\n') || ''}
                onChange={(e) => onChangeField({
                  infrastructure: e.target.value.split('\n').filter((item) => item.trim()),
                })}
                className="min-h-[80px]"
                data-testid="textarea-infrastructure"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              {requiredResources.teamSize && (
                <div className="bg-muted/30 border border-border/50 p-4 rounded-md space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-indigo-500" />
                    {t('demand.tabs.requirements.teamSize')}
                  </p>
                  <p className="text-sm font-semibold" data-testid="text-team-size">{requiredResources.teamSize}</p>
                </div>
              )}
              {requiredResources.budgetEstimate && (
                <div className="bg-muted/30 border border-border/50 p-4 rounded-md space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-indigo-500" />
                    {t('demand.tabs.requirements.budgetEstimate')}
                  </p>
                  <p className="text-sm font-semibold" data-testid="text-budget-estimate">{requiredResources.budgetEstimate}</p>
                </div>
              )}
              {requiredResources.timelineEstimate && (
                <div className="bg-muted/30 border border-border/50 p-4 rounded-md space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-indigo-500" />
                    {t('demand.tabs.requirements.timelineEstimate')}
                  </p>
                  <p className="text-sm font-semibold" data-testid="text-timeline-estimate">{requiredResources.timelineEstimate}</p>
                </div>
              )}
            </div>
            {requiredResources.infrastructure && requiredResources.infrastructure.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-indigo-500" />
                    {t('demand.tabs.requirements.infrastructureRequirements')}
                  </h4>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {requiredResources.infrastructure.map((item, index) => (
                      <div key={index} className="bg-muted/30 border border-border/50 p-3 rounded-md" data-testid={`text-infrastructure-${index}`}>
                        <p className="text-sm text-muted-foreground">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}