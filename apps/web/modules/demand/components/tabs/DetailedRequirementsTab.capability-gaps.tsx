import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Lightbulb, Plus, Target, Trash2 } from 'lucide-react';

interface CapabilityGap {
  gap: string;
  currentState: string;
  targetState: string;
  recommendation: string;
}

interface DetailedRequirementsCapabilityGapsProps {
  capabilityGaps: CapabilityGap[];
  isEditMode: boolean;
  highlightedSection?: string | null;
  hasFieldChanged: boolean;
  changeBadgeText: string;
  statusControls: ReactNode;
  assignmentPanel: ReactNode;
  onUpdateCapabilityGap: (index: number, patch: Partial<CapabilityGap>) => void;
  onDeleteCapabilityGap: (index: number) => void;
  onAddCapabilityGap: () => void;
}

export function DetailedRequirementsCapabilityGaps({
  capabilityGaps,
  isEditMode,
  highlightedSection,
  hasFieldChanged,
  changeBadgeText,
  statusControls,
  assignmentPanel,
  onUpdateCapabilityGap,
  onDeleteCapabilityGap,
  onAddCapabilityGap,
}: DetailedRequirementsCapabilityGapsProps) {
  const { t } = useTranslation();

  if (capabilityGaps.length === 0) {
    return null;
  }

  return (
    <Card
      id="section-capabilityGaps"
      className={`${hasFieldChanged && isEditMode ? 'ring-2 ring-primary' : ''} ${highlightedSection === 'capabilityGaps' ? 'ring-4 ring-primary ring-offset-2 ring-offset-background shadow-2xl' : ''}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-3">
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
              </div>
              {t('demand.tabs.requirements.capabilityGaps')}
              {hasFieldChanged && isEditMode && (
                <Badge variant="default" className="ml-2">{changeBadgeText}</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs font-semibold">
                <Target className="h-3 w-3 mr-1" />
                {t('demand.tabs.requirements.gapAnalysis')}
              </Badge>
              <Badge variant="secondary" className="text-xs font-semibold">
                <Lightbulb className="h-3 w-3 mr-1" />
                {t('demand.tabs.requirements.recommendations')}
              </Badge>
            </div>
          </div>
          <div className="px-4 py-2 bg-primary/5 rounded-lg">
            <span className="font-semibold text-primary">{capabilityGaps.length} {t('demand.tabs.requirements.gapsIdentified')}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap mt-2">
          <p className="text-sm text-muted-foreground">{t('demand.tabs.requirements.gapsDescription')}</p>
          {!isEditMode && <div className="flex items-center gap-2">{statusControls}</div>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isEditMode && assignmentPanel}
        <div className="space-y-4">
          {capabilityGaps.map((gap, index) => (
            <div key={index} className="bg-muted/30 border border-border/50 p-4 rounded-md space-y-3 relative">
              {isEditMode ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDeleteCapabilityGap(index)}
                    className="absolute top-2 right-2 h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
                    data-testid={`button-delete-capability-gap-${index}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="space-y-2 pr-8">
                    <Label className="text-xs">{t('demand.tabs.requirements.labels.gap')}</Label>
                    <Input
                      value={gap.gap}
                      onChange={(e) => onUpdateCapabilityGap(index, { gap: e.target.value })}
                      data-testid={`input-gap-name-${index}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t('demand.tabs.requirements.labels.currentState')}</Label>
                    <Textarea
                      value={gap.currentState}
                      onChange={(e) => onUpdateCapabilityGap(index, { currentState: e.target.value })}
                      className="min-h-[60px]"
                      data-testid={`textarea-gap-current-${index}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t('demand.tabs.requirements.labels.targetState')}</Label>
                    <Textarea
                      value={gap.targetState}
                      onChange={(e) => onUpdateCapabilityGap(index, { targetState: e.target.value })}
                      className="min-h-[60px]"
                      data-testid={`textarea-gap-target-${index}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t('demand.tabs.requirements.labels.recommendation')}</Label>
                    <Textarea
                      value={gap.recommendation}
                      onChange={(e) => onUpdateCapabilityGap(index, { recommendation: e.target.value })}
                      className="min-h-[60px]"
                      data-testid={`textarea-gap-recommendation-${index}`}
                    />
                  </div>
                </>
              ) : (
                <>
                  <h4 className="font-semibold text-sm">{gap.gap}</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-md">
                      <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">{t('demand.tabs.requirements.currentState')}</p>
                      <p className="text-sm text-red-600 dark:text-red-300">{gap.currentState}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-md">
                      <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">{t('demand.tabs.requirements.targetState')}</p>
                      <p className="text-sm text-green-600 dark:text-green-300">{gap.targetState}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md">
                    <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">{t('demand.tabs.requirements.recommendation')}</p>
                      <p className="text-sm text-blue-600 dark:text-blue-300">{gap.recommendation}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        {isEditMode && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddCapabilityGap}
            className="mt-4"
            data-testid="button-add-capability-gap"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('demand.tabs.requirements.addNewCapabilityGap')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}