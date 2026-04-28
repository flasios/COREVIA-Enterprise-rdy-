import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Users } from 'lucide-react';

interface RoleEntry {
  role: string;
  count: string;
  responsibilities: string[];
  skills: string[];
}

interface DetailedRequirementsRolesProps {
  roles: RoleEntry[];
  isEditMode: boolean;
  highlightedSection?: string | null;
  hasFieldChanged: boolean;
  changeBadgeText: string;
  statusControls: ReactNode;
  assignmentPanel: ReactNode;
  onUpdateRole: (index: number, patch: Partial<RoleEntry>) => void;
  onDeleteRole: (index: number) => void;
  onAddRole: () => void;
}

export function DetailedRequirementsRoles({
  roles,
  isEditMode,
  highlightedSection,
  hasFieldChanged,
  changeBadgeText,
  statusControls,
  assignmentPanel,
  onUpdateRole,
  onDeleteRole,
  onAddRole,
}: DetailedRequirementsRolesProps) {
  const { t } = useTranslation();

  return (
    <Card
      id="section-rolesAndResponsibilities"
      className={`${hasFieldChanged && isEditMode ? 'ring-2 ring-primary' : ''} ${highlightedSection === 'rolesAndResponsibilities' ? 'ring-4 ring-primary ring-offset-2 ring-offset-background shadow-2xl' : ''}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                <Users className="h-4 w-4" />
              </div>
              {t('demand.tabs.requirements.rolesAndResponsibilities')}
              {hasFieldChanged && isEditMode && (
                <Badge variant="default" className="ml-2">{changeBadgeText}</Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{t('demand.tabs.requirements.rolesDescription')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-semibold">
              {roles.length} {t('demand.tabs.requirements.roles')}
            </Badge>
            {!isEditMode && statusControls}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isEditMode && assignmentPanel}
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((role, index) => (
            <div key={index} className="bg-muted/30 border border-border/50 p-4 rounded-md space-y-3 relative" data-testid={`card-role-${index}`}>
              {isEditMode ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDeleteRole(index)}
                    className="absolute top-2 right-2 h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
                    data-testid={`button-delete-role-${index}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="grid grid-cols-2 gap-3 pr-8">
                    <div className="space-y-2">
                      <Label className="text-xs">{t('demand.tabs.requirements.labels.role')}</Label>
                      <Input
                        value={role.role}
                        onChange={(e) => onUpdateRole(index, { role: e.target.value })}
                        data-testid={`input-role-name-${index}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">{t('demand.tabs.requirements.labels.count')}</Label>
                      <Input
                        value={role.count}
                        onChange={(e) => onUpdateRole(index, { count: e.target.value })}
                        data-testid={`input-role-count-${index}`}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t('demand.tabs.requirements.labels.responsibilities')}</Label>
                    <Textarea
                      value={role.responsibilities.join('\n')}
                      onChange={(e) => onUpdateRole(index, {
                        responsibilities: e.target.value.split('\n').filter((item) => item.trim()),
                      })}
                      className="min-h-[80px]"
                      data-testid={`textarea-role-responsibilities-${index}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t('demand.tabs.requirements.labels.skills')}</Label>
                    <Textarea
                      value={role.skills.join('\n')}
                      onChange={(e) => onUpdateRole(index, {
                        skills: e.target.value.split('\n').filter((item) => item.trim()),
                      })}
                      className="min-h-[80px]"
                      data-testid={`textarea-role-skills-${index}`}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold">{role.role}</h4>
                    <Badge variant="outline" className="text-xs" data-testid={`badge-role-count-${index}`}>
                      {role.count}
                    </Badge>
                  </div>
                  {role.responsibilities.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">{t('demand.tabs.requirements.responsibilities')}</p>
                      <ul className="space-y-1 pl-6">
                        {role.responsibilities.map((responsibility, responsibilityIndex) => (
                          <li key={responsibilityIndex} className="text-sm text-muted-foreground list-disc" data-testid={`text-responsibility-${index}-${responsibilityIndex}`}>
                            {responsibility}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {role.skills.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">{t('demand.tabs.requirements.requiredSkills')}</p>
                        <div className="flex flex-wrap gap-1">
                          {role.skills.map((skill, skillIndex) => (
                            <Badge key={skillIndex} variant="outline" className="text-xs" data-testid={`badge-skill-${index}-${skillIndex}`}>
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        {isEditMode && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddRole}
            className="mt-4"
            data-testid="button-add-role"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('demand.tabs.requirements.addNewRole')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}