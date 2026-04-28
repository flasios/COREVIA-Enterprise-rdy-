import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Plus, Trash2, UserCircle } from 'lucide-react';

interface Stakeholder {
  name: string;
  role: string;
  interest?: string;
  influence?: 'Low' | 'Medium' | 'High';
}

interface StakeholderSectionProps {
  stakeholders: Stakeholder[];
  isEditMode: boolean;
  onChange: (stakeholders: Stakeholder[]) => void;
  maxStakeholders?: number;
}

const influenceVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
  Low: 'secondary',
  Medium: 'outline',
  High: 'default',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function StakeholderSection({
  stakeholders,
  isEditMode,
  onChange,
  maxStakeholders = 20,
}: StakeholderSectionProps) {
  const { t } = useTranslation();
  const handleAddStakeholder = () => {
    if (stakeholders.length >= maxStakeholders) return;
    onChange([
      ...stakeholders,
      { name: '', role: '', interest: '', influence: 'Medium' },
    ]);
  };

  const handleRemoveStakeholder = (index: number) => {
    onChange(stakeholders.filter((_, i) => i !== index));
  };

  const handleUpdateStakeholder = (index: number, field: keyof Stakeholder, value: string) => {
    const updated = [...stakeholders];
    updated[index] = { ...updated[index]!, [field]: value };
    onChange(updated);
  };

  return (
    <section aria-labelledby="stakeholder-section-title">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle id="stakeholder-section-title" className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" aria-hidden="true" />
              Stakeholder Analysis
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {stakeholders.length} stakeholder{stakeholders.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {stakeholders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserCircle className="h-8 w-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
              <p className="text-sm">No stakeholders identified yet</p>
              {isEditMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddStakeholder}
                  className="mt-3"
                  aria-label="Add first stakeholder"
                >
                  <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                  Add Stakeholder
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3" role="list" aria-label="Stakeholder list">
              {stakeholders.map((stakeholder, index) => (
                <div 
                  key={index}
                  className="p-4 rounded-lg border bg-card"
                  role="listitem"
                >
                  {isEditMode ? (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor={`stakeholder-${index}-name`} className="text-xs">
                              Name
                            </Label>
                            <Input
                              id={`stakeholder-${index}-name`}
                              value={stakeholder.name}
                              onChange={(e) => handleUpdateStakeholder(index, 'name', e.target.value)}
                              placeholder={t('businessCase.stakeholder.namePlaceholder')}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`stakeholder-${index}-role`} className="text-xs">
                              Role
                            </Label>
                            <Input
                              id={`stakeholder-${index}-role`}
                              value={stakeholder.role}
                              onChange={(e) => handleUpdateStakeholder(index, 'role', e.target.value)}
                              placeholder={t('businessCase.stakeholder.rolePlaceholder')}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`stakeholder-${index}-interest`} className="text-xs">
                              Interest / Concern
                            </Label>
                            <Input
                              id={`stakeholder-${index}-interest`}
                              value={stakeholder.interest || ''}
                              onChange={(e) => handleUpdateStakeholder(index, 'interest', e.target.value)}
                              placeholder={t('businessCase.stakeholder.interestPlaceholder')}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`stakeholder-${index}-influence`} className="text-xs">
                              Influence Level
                            </Label>
                            <Select
                              value={stakeholder.influence || 'Medium'}
                              onValueChange={(value) => handleUpdateStakeholder(index, 'influence', value)}
                            >
                              <SelectTrigger id={`stakeholder-${index}-influence`} className="mt-1">
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveStakeholder(index)}
                          aria-label={`Remove stakeholder ${stakeholder.name || index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-sm">
                          {stakeholder.name ? getInitials(stakeholder.name) : '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            {stakeholder.name || 'Unnamed stakeholder'}
                          </p>
                          {stakeholder.influence && (
                            <Badge 
                              variant={influenceVariants[stakeholder.influence] || 'secondary'}
                              className="text-xs"
                            >
                              {stakeholder.influence}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {stakeholder.role || 'No role specified'}
                        </p>
                        {stakeholder.interest && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            <span className="font-medium">Interest:</span> {stakeholder.interest}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isEditMode && stakeholders.length > 0 && stakeholders.length < maxStakeholders && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddStakeholder}
              className="w-full"
              aria-label="Add another stakeholder"
            >
              <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
              Add Stakeholder
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
