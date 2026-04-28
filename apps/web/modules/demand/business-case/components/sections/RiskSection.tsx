import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Plus, Trash2, Shield, AlertCircle } from 'lucide-react';

interface RiskItem {
  description: string;
  impact: 'Low' | 'Medium' | 'High' | 'Critical';
  likelihood?: 'Low' | 'Medium' | 'High';
  mitigation: string;
}

interface RiskSectionProps {
  risks: RiskItem[];
  isEditMode: boolean;
  onChange: (risks: RiskItem[]) => void;
  maxRisks?: number;
}

const impactVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Low: 'secondary',
  Medium: 'outline',
  High: 'outline',
  Critical: 'destructive',
};

export function RiskSection({
  risks,
  isEditMode,
  onChange,
  maxRisks = 10,
}: RiskSectionProps) {
  const { t } = useTranslation();
  const riskStats = useMemo(() => {
    const counts = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    risks.forEach(r => {
      if (r.impact in counts) counts[r.impact as keyof typeof counts]++;
    });
    return counts;
  }, [risks]);

  const handleAddRisk = () => {
    if (risks.length >= maxRisks) return;
    onChange([
      ...risks,
      { description: '', impact: 'Medium', likelihood: 'Medium', mitigation: '' },
    ]);
  };

  const handleRemoveRisk = (index: number) => {
    onChange(risks.filter((_, i) => i !== index));
  };

  const handleUpdateRisk = (index: number, field: keyof RiskItem, value: string) => {
    const updated = [...risks];
    updated[index] = { ...updated[index]!, [field]: value };
    onChange(updated);
  };

  return (
    <section aria-labelledby="risk-section-title">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle id="risk-section-title" className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Risk Assessment
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {risks.length} risk{risks.length !== 1 ? 's' : ''} identified
              </Badge>
              {riskStats.Critical > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {riskStats.Critical} Critical
                </Badge>
              )}
              {riskStats.High > 0 && (
                <Badge variant="outline" className="text-xs">
                  {riskStats.High} High
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {risks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
              <p className="text-sm">{t('businessCase.risk.noRisks')}</p>
              {isEditMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddRisk}
                  className="mt-3"
                  aria-label="Add first risk"
                >
                  <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                  Add Risk
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3" role="list" aria-label="Risk list">
              {risks.map((risk, index) => (
                <div 
                  key={index}
                  className="p-4 rounded-lg border bg-muted"
                  role="listitem"
                >
                  {isEditMode ? (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-3">
                          <div>
                            <Label htmlFor={`risk-${index}-desc`} className="text-xs">
                              Risk Description
                            </Label>
                            <Input
                              id={`risk-${index}-desc`}
                              value={risk.description}
                              onChange={(e) => handleUpdateRisk(index, 'description', e.target.value)}
                              placeholder={t('businessCase.risk.describeRisk')}
                              className="mt-1"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor={`risk-${index}-impact`} className="text-xs">
                                Impact
                              </Label>
                              <Select
                                value={risk.impact}
                                onValueChange={(value) => handleUpdateRisk(index, 'impact', value)}
                              >
                                <SelectTrigger id={`risk-${index}-impact`} className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Low">Low</SelectItem>
                                  <SelectItem value="Medium">Medium</SelectItem>
                                  <SelectItem value="High">High</SelectItem>
                                  <SelectItem value="Critical">Critical</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor={`risk-${index}-likelihood`} className="text-xs">
                                Likelihood
                              </Label>
                              <Select
                                value={risk.likelihood || 'Medium'}
                                onValueChange={(value) => handleUpdateRisk(index, 'likelihood', value)}
                              >
                                <SelectTrigger id={`risk-${index}-likelihood`} className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Low">Low</SelectItem>
                                  <SelectItem value="Medium">Medium</SelectItem>
                                  <SelectItem value="High">High</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label htmlFor={`risk-${index}-mitigation`} className="text-xs">
                              Mitigation Strategy
                            </Label>
                            <Textarea
                              id={`risk-${index}-mitigation`}
                              value={risk.mitigation}
                              onChange={(e) => handleUpdateRisk(index, 'mitigation', e.target.value)}
                              placeholder={t('businessCase.risk.mitigationPlaceholder')}
                              className="mt-1"
                              rows={2}
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveRisk(index)}
                          aria-label={`Remove risk ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertCircle className="h-4 w-4" aria-hidden="true" />
                            <span className="font-medium text-sm">{risk.description || 'Untitled risk'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant={impactVariants[risk.impact] || 'outline'}>
                              {risk.impact} Impact
                            </Badge>
                            {risk.likelihood && (
                              <Badge variant="secondary" className="text-xs">
                                {risk.likelihood} likelihood
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {risk.mitigation && (
                        <div className="pt-2 border-t border-current/10">
                          <p className="text-xs text-muted-foreground flex items-start gap-1">
                            <Shield className="h-3 w-3 mt-0.5 flex-shrink-0" aria-hidden="true" />
                            <span><strong>Mitigation:</strong> {risk.mitigation}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isEditMode && risks.length > 0 && risks.length < maxRisks && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddRisk}
              className="w-full"
              aria-label="Add another risk"
            >
              <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
              Add Risk
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
