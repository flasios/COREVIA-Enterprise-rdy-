import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Zap, Target, ListChecks, Users, Rocket, Hammer, FileText, Scale, CheckCircle2, Plus, Columns3, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StrategicFitTab } from '@/modules/demand';
import { RfpDocumentTab } from '../tabs/RfpDocumentTab';
import { VendorEvaluationTab } from '../tabs/VendorEvaluationTab';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type {
  ProjectData,
  BusinessCaseData,
  DemandReportData,
  WbsTaskData,
  AgileSprintData,
  AgileEpicData,
  AgileWorkItemData,
  AgileProjectMemberData,
  AgileWorkItemStatus,
  AgileWorkItemType,
  AgileProjectRole,
} from '../../types';

interface AcceleratorWorkspaceProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  demandReport?: DemandReportData;
  tasks: WbsTaskData[];
  activePhase: string;
  onPhaseChange: (phase: string) => void;
}

const AGILE_SELECT_BACKLOG = '__agile_backlog__';
const AGILE_SELECT_NO_EPIC = '__agile_no_epic__';

const ACCELERATOR_PHASES = [
  { id: 'sprint-planning', name: 'Sprint Planning', icon: Zap, color: 'text-indigo-600 dark:text-indigo-400' },
  { id: 'build', name: 'Build', icon: Hammer, color: 'text-blue-600 dark:text-blue-400' },
  { id: 'launch', name: 'Launch', icon: Rocket, color: 'text-purple-600 dark:text-purple-400' },
];

export function AcceleratorWorkspace({
  project,
  businessCase,
  demandReport,
  tasks,
  activePhase,
  onPhaseChange,
}: AcceleratorWorkspaceProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {ACCELERATOR_PHASES.map((phase, index) => {
          const PhaseIcon = phase.icon;
          const isActive = activePhase === phase.id;

          return (
            <div key={phase.id} className="flex items-center">
              <Button
                variant={isActive ? "default" : "outline"}
                size="sm"
                className={`gap-2 ${isActive ? '' : 'bg-card/60'}`}
                onClick={() => onPhaseChange(phase.id)}
                data-testid={`button-phase-${phase.id}`}
              >
                <PhaseIcon className={`w-4 h-4 ${isActive ? '' : phase.color}`} />
                <span className="hidden sm:inline">{phase.name}</span>
              </Button>
              {index < ACCELERATOR_PHASES.length - 1 && (
                <div className="w-8 h-px bg-border mx-2" />
              )}
            </div>
          );
        })}
      </div>

      {activePhase === 'sprint-planning' && (
        <AcceleratorSprintPlanningTab
          project={project}
          businessCase={businessCase}
          demandReport={demandReport}
          tasks={tasks}
        />
      )}

      {activePhase === 'build' && (
        <AcceleratorBuildTab
          project={project}
          tasks={tasks}
        />
      )}

      {activePhase === 'launch' && (
        <AcceleratorLaunchTab
          project={project}
        />
      )}
    </div>
  );
}

export function AcceleratorSprintPlanningTab({
  project,

  businessCase: _businessCase,
  demandReport,
  tasks: _tasks = [],
}: {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  demandReport?: DemandReportData;
  tasks?: WbsTaskData[];
}) {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState('strategic-fit');
  const queryClient = useQueryClient();
  const projectId = project.id;

  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);

  const [newSprintOpen, setNewSprintOpen] = useState(false);
  const [newEpicOpen, setNewEpicOpen] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);

  const [newSprintName, setNewSprintName] = useState('');
  const [newSprintGoal, setNewSprintGoal] = useState('');
  const [newSprintStart, setNewSprintStart] = useState('');
  const [newSprintEnd, setNewSprintEnd] = useState('');

  const [newEpicTitle, setNewEpicTitle] = useState('');
  const [newEpicDescription, setNewEpicDescription] = useState('');

  const [newItemType, setNewItemType] = useState<AgileWorkItemType>('story');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemPriority, setNewItemPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [newItemStoryPoints, setNewItemStoryPoints] = useState<string>('');
  const [newItemEpicId, setNewItemEpicId] = useState<string | null>(null);

  const demandReportId = project.demandReportId || (demandReport as Record<string, unknown> | undefined)?.id as string | undefined;

  const { data: sprintsData } = useQuery<{ success: boolean; sprints: AgileSprintData[] }>({
    queryKey: ['/api/portfolio/projects', projectId, 'agile', 'sprints'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/portfolio/projects/${projectId}/agile/sprints`);
      return response.json();
    },
    staleTime: 10_000,
  });

  const { data: epicsData } = useQuery<{ success: boolean; epics: AgileEpicData[] }>({
    queryKey: ['/api/portfolio/projects', projectId, 'agile', 'epics'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/portfolio/projects/${projectId}/agile/epics`);
      return response.json();
    },
    staleTime: 10_000,
  });

  const { data: itemsData } = useQuery<{ success: boolean; items: AgileWorkItemData[] }>({
    queryKey: ['/api/portfolio/projects', projectId, 'agile', 'work-items'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/portfolio/projects/${projectId}/agile/work-items`);
      return response.json();
    },
    staleTime: 5_000,
  });

  const { data: membersData } = useQuery<{ success: boolean; members: AgileProjectMemberData[] }>({
    queryKey: ['/api/portfolio/projects', projectId, 'agile', 'members'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/portfolio/projects/${projectId}/agile/members`);
      return response.json();
    },
    staleTime: 30_000,
  });

  const sprints = (sprintsData?.success ? sprintsData.sprints : []) || [];
  const epics = (epicsData?.success ? epicsData.epics : []) || [];
  const items = (itemsData?.success ? itemsData.items : []) || [];
  const members = (membersData?.success ? membersData.members : []) || [];

  const activeSprint = sprints.find((s) => s.status === 'active') || null;
  const effectiveSelectedSprintId = selectedSprintId || activeSprint?.id || (sprints[0]?.id ?? null);

  const sprintItems = effectiveSelectedSprintId
    ? items.filter((i) => i.sprintId === effectiveSelectedSprintId)
    : [];
  const backlogItems = items.filter((i) => !i.sprintId);

  const createSprintMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/portfolio/projects/${projectId}/agile/sprints`, {
        name: newSprintName,
        goal: newSprintGoal || null,
        startDate: newSprintStart || null,
        endDate: newSprintEnd || null,
        status: 'planned',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'agile', 'sprints'] });
      setNewSprintOpen(false);
      setNewSprintName('');
      setNewSprintGoal('');
      setNewSprintStart('');
      setNewSprintEnd('');
    },
  });

  const createEpicMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/portfolio/projects/${projectId}/agile/epics`, {
        title: newEpicTitle,
        description: newEpicDescription || null,
        status: 'open',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'agile', 'epics'] });
      setNewEpicOpen(false);
      setNewEpicTitle('');
      setNewEpicDescription('');
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async () => {
      const storyPoints = newItemStoryPoints.trim() ? Number.parseInt(newItemStoryPoints, 10) : null;
      const response = await apiRequest('POST', `/api/portfolio/projects/${projectId}/agile/work-items`, {
        type: newItemType,
        title: newItemTitle,
        description: newItemDescription || null,
        priority: newItemPriority,
        storyPoints: Number.isFinite(storyPoints) ? storyPoints : null,
        status: 'backlog',
        epicId: newItemEpicId || null,
        sprintId: null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'agile', 'work-items'] });
      setNewItemOpen(false);
      setNewItemType('story');
      setNewItemTitle('');
      setNewItemDescription('');
      setNewItemPriority('medium');
      setNewItemStoryPoints('');
      setNewItemEpicId(null);
    },
  });

  const updateSprintMutation = useMutation({
    mutationFn: async ({ sprintId, status }: { sprintId: string; status: 'planned' | 'active' | 'completed' }) => {
      // Ensure at most 1 active sprint per project
      if (status === 'active') {
        const currentlyActive = sprints.filter((s) => s.status === 'active' && s.id !== sprintId);
        for (const s of currentlyActive) {
          await apiRequest('PATCH', `/api/portfolio/agile/sprints/${s.id}`, { status: 'completed' });
        }
      }
      await apiRequest('PATCH', `/api/portfolio/agile/sprints/${sprintId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'agile', 'sprints'] });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<AgileWorkItemData, 'status' | 'sprintId' | 'epicId' | 'priority'>> }) => {
      await apiRequest('PATCH', `/api/portfolio/agile/work-items/${id}`, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'agile', 'work-items'] });
    },
  });

  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<AgileProjectRole>('viewer');
  const upsertMemberMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/portfolio/projects/${projectId}/agile/members`, {
        userId: newMemberUserId,
        role: newMemberRole,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'agile', 'members'] });
      setNewMemberUserId('');
      setNewMemberRole('viewer');
    },
  });

  const { data: versionsData } = useQuery({
    queryKey: ['/api/demand-reports', demandReportId, 'versions'],
    enabled: !!demandReportId,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/demand-reports/${demandReportId}/versions`);
      return response.json();
    },
    staleTime: 30_000,
  });

  const { businessCaseApproved, requirementsApproved, enterpriseArchitectureApproved } = useMemo(() => {
    const versions = versionsData && (versionsData as Record<string, unknown>).success && (versionsData as Record<string, unknown>).data;
    if (!versions || !Array.isArray(versions) || versions.length === 0) {
      return { businessCaseApproved: false, requirementsApproved: false, enterpriseArchitectureApproved: false };
    }

    return {
      businessCaseApproved: versions.some((v: { versionType: string; status: string }) =>
        v.versionType === 'business_case' && v.status === 'published'
      ),
      requirementsApproved: versions.some((v: { versionType: string; status: string }) =>
        v.versionType === 'requirements' && v.status === 'published'
      ),
      enterpriseArchitectureApproved: versions.some((v: { versionType: string; status: string }) =>
        v.versionType === 'enterprise_architecture' && v.status === 'published'
      ),
    };
  }, [versionsData]);

  return (
    <div className="space-y-6">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 h-auto p-0.5 bg-muted/40">
          <TabsTrigger
            value="strategic-fit"
            className="flex items-center gap-1.5 py-1.5 text-xs font-medium data-[state=active]:bg-background"
            data-testid="tab-accelerator-strategic-fit"
          >
            <Target className="w-3 h-3" />
            <span className="hidden sm:inline">{t('accelerator.strategicFit')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="rfp-document"
            className="flex items-center gap-1.5 py-1.5 text-xs font-medium data-[state=active]:bg-background"
            data-testid="tab-accelerator-rfp"
          >
            <FileText className="w-3 h-3" />
            <span className="hidden sm:inline">RFP</span>
          </TabsTrigger>
          <TabsTrigger
            value="vendor-evaluation"
            className="flex items-center gap-1.5 py-1.5 text-xs font-medium data-[state=active]:bg-background"
            data-testid="tab-accelerator-vendor-evaluation"
          >
            <Scale className="w-3 h-3" />
            <span className="hidden sm:inline">Vendors</span>
          </TabsTrigger>
          <TabsTrigger
            value="sprint-backlog"
            className="flex items-center gap-1.5 py-1.5 text-xs font-medium data-[state=active]:bg-background"
            data-testid="tab-accelerator-sprint-backlog"
          >
            <ListChecks className="w-3 h-3" />
            <span className="hidden sm:inline">Backlog</span>
          </TabsTrigger>
          <TabsTrigger
            value="team-setup"
            className="flex items-center gap-1.5 py-1.5 text-xs font-medium data-[state=active]:bg-background"
            data-testid="tab-accelerator-team-setup"
          >
            <Users className="w-3 h-3" />
            <span className="hidden sm:inline">Team</span>
          </TabsTrigger>
          <TabsTrigger
            value="sprint-goals"
            className="flex items-center gap-1.5 py-1.5 text-xs font-medium data-[state=active]:bg-background"
            data-testid="tab-accelerator-sprint-goals"
          >
            <Rocket className="w-3 h-3" />
            <span className="hidden sm:inline">Goals</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="strategic-fit" className="mt-6">
          {demandReportId ? (
            <StrategicFitTab
              reportId={demandReportId}
              canAccess={true}
              businessCaseApproved={businessCaseApproved}
              requirementsApproved={requirementsApproved}
              enterpriseArchitectureApproved={enterpriseArchitectureApproved}
              enableIntelligenceRail={false}
            />
          ) : (
            <Card className="bg-card/60 border-border">
              <CardContent className="p-12 text-center">
                <Target className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold mb-2">{t('accelerator.strategicFitAnalysis')}</h3>
                <p className="text-muted-foreground">
                  {t('accelerator.noStrategicFitDesc')}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rfp-document" className="mt-6">
          {demandReportId ? (
            <RfpDocumentTab
              demandReportId={demandReportId}
              projectName={project.projectName}
              organizationName={(demandReport as Record<string, unknown> | undefined)?.organizationName as string | undefined}
            />
          ) : (
            <Card className="bg-card/60 border-border">
              <CardContent className="p-12 text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold mb-2">{t('accelerator.rfpDocument')}</h3>
                <p className="text-muted-foreground">
                  {t('accelerator.noRfpDesc')}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="vendor-evaluation" className="mt-6">
          {demandReportId ? (
            <VendorEvaluationTab demandReportId={demandReportId} />
          ) : (
            <Card className="bg-card/60 border-border">
              <CardContent className="p-12 text-center">
                <Scale className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold mb-2">{t('accelerator.vendorEvaluation')}</h3>
                <p className="text-muted-foreground">
                  {t('accelerator.noVendorEvalDesc')}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sprint-backlog" className="mt-6">
          <Card className="bg-card/60 border-border">
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5" />
                  {t('accelerator.backlogAndSprints')}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => setNewSprintOpen(true)} data-testid="button-agile-new-sprint">
                    <Plus className="h-4 w-4" />
                    {t('accelerator.newSprint')}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => setNewEpicOpen(true)} data-testid="button-agile-new-epic">
                    <Plus className="h-4 w-4" />
                    {t('accelerator.newEpic')}
                  </Button>
                  <Button size="sm" className="gap-2" onClick={() => setNewItemOpen(true)} data-testid="button-agile-new-item">
                    <Plus className="h-4 w-4" />
                    {t('accelerator.newWorkItem')}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="min-w-[240px]">
                  <Select value={effectiveSelectedSprintId || ''} onValueChange={(v) => setSelectedSprintId(v)}>
                    <SelectTrigger className="h-9" data-testid="select-agile-sprint">
                      <SelectValue placeholder={t('accelerator.selectSprint')} />
                    </SelectTrigger>
                    <SelectContent>
                      {sprints.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {effectiveSelectedSprintId && (
                  <>
                    <Badge variant="outline" className="capitalize">
                      {(sprints.find((s) => s.id === effectiveSelectedSprintId)?.status || 'planned').replace(/_/g, ' ')}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateSprintMutation.isPending}
                      onClick={() => updateSprintMutation.mutate({ sprintId: effectiveSelectedSprintId, status: 'active' })}
                      data-testid="button-agile-start-sprint"
                    >
                      {t('accelerator.start')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateSprintMutation.isPending}
                      onClick={() => updateSprintMutation.mutate({ sprintId: effectiveSelectedSprintId, status: 'completed' })}
                      data-testid="button-agile-complete-sprint"
                    >
                      {t('accelerator.complete')}
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {sprints.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <ListChecks className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="mb-4">{t('accelerator.noSprintsYet')}</p>
                  <Button onClick={() => setNewSprintOpen(true)} className="gap-2" data-testid="button-agile-create-first-sprint">
                    <Plus className="h-4 w-4" />
                    {t('accelerator.createSprint')}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">{t('accelerator.backlog')}</h4>
                    <div className="rounded-lg border bg-muted/10 overflow-hidden">
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-muted-foreground border-b bg-muted/20">
                        <div className="col-span-3">Key</div>
                        <div className="col-span-5">Title</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-2">Sprint</div>
                      </div>
                      <div className="max-h-[380px] overflow-y-auto">
                        {backlogItems.length === 0 ? (
                          <div className="p-6 text-sm text-muted-foreground">{t('accelerator.noBacklogItems')}</div>
                        ) : (
                          backlogItems.map((it) => (
                            <div key={it.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm border-b last:border-b-0 items-center">
                              <div className="col-span-3">
                                <div className="flex items-center gap-2">
                                  <code className="text-[11px] bg-muted/40 px-1.5 py-0.5 rounded">{it.itemKey}</code>
                                  <Badge variant="outline" className="text-[10px] capitalize">{it.type}</Badge>
                                </div>
                              </div>
                              <div className="col-span-5 truncate" title={it.title}>{it.title}</div>
                              <div className="col-span-2">
                                <Select
                                  value={it.status}
                                  onValueChange={(v) => updateItemMutation.mutate({ id: it.id, patch: { status: v as AgileWorkItemStatus } })}
                                >
                                  <SelectTrigger className="h-8" data-testid={`select-agile-item-status-${it.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {['backlog','selected','todo','in_progress','in_review','done'].map((s) => (
                                      <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-2">
                                <Select
                                  value={it.sprintId || AGILE_SELECT_BACKLOG}
                                  onValueChange={(v) => updateItemMutation.mutate({ id: it.id, patch: { sprintId: v === AGILE_SELECT_BACKLOG ? null : v } })}
                                >
                                  <SelectTrigger className="h-8" data-testid={`select-agile-item-sprint-${it.id}`}>
                                    <SelectValue placeholder={t('accelerator.backlog')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={AGILE_SELECT_BACKLOG}>{t('accelerator.backlog')}</SelectItem>
                                    {sprints.map((s) => (
                                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">{t('accelerator.selectedSprint')}</h4>
                    <div className="rounded-lg border bg-muted/10 overflow-hidden">
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-muted-foreground border-b bg-muted/20">
                        <div className="col-span-3">Key</div>
                        <div className="col-span-7">Title</div>
                        <div className="col-span-2">Status</div>
                      </div>
                      <div className="max-h-[380px] overflow-y-auto">
                        {sprintItems.length === 0 ? (
                          <div className="p-6 text-sm text-muted-foreground">{t('accelerator.noSprintItems')}</div>
                        ) : (
                          sprintItems.map((it) => (
                            <div key={it.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm border-b last:border-b-0 items-center">
                              <div className="col-span-3">
                                <div className="flex items-center gap-2">
                                  <code className="text-[11px] bg-muted/40 px-1.5 py-0.5 rounded">{it.itemKey}</code>
                                  <Badge variant="outline" className="text-[10px] capitalize">{it.type}</Badge>
                                </div>
                              </div>
                              <div className="col-span-7 truncate" title={it.title}>{it.title}</div>
                              <div className="col-span-2">
                                <Select
                                  value={it.status}
                                  onValueChange={(v) => updateItemMutation.mutate({ id: it.id, patch: { status: v as AgileWorkItemStatus } })}
                                >
                                  <SelectTrigger className="h-8" data-testid={`select-agile-sprint-item-status-${it.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {['todo','in_progress','in_review','done','selected'].map((s) => (
                                      <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Dialog open={newSprintOpen} onOpenChange={setNewSprintOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('accelerator.newSprint')}</DialogTitle>
                    <DialogDescription>{t('accelerator.newSprintDesc')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input value={newSprintName} onChange={(e) => setNewSprintName(e.target.value)} placeholder={t('accelerator.sprintName')} />
                    <Textarea value={newSprintGoal} onChange={(e) => setNewSprintGoal(e.target.value)} placeholder={t('accelerator.sprintGoal')} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={newSprintStart} onChange={(e) => setNewSprintStart(e.target.value)} placeholder={t('accelerator.startDate')} />
                      <Input value={newSprintEnd} onChange={(e) => setNewSprintEnd(e.target.value)} placeholder={t('accelerator.endDate')} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewSprintOpen(false)}>{t('accelerator.cancel')}</Button>
                    <Button
                      disabled={!newSprintName.trim() || createSprintMutation.isPending}
                      onClick={() => createSprintMutation.mutate()}
                      data-testid="button-agile-create-sprint"
                    >
                      {t('accelerator.create')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={newEpicOpen} onOpenChange={setNewEpicOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('accelerator.newEpic')}</DialogTitle>
                    <DialogDescription>{t('accelerator.newEpicDesc')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input value={newEpicTitle} onChange={(e) => setNewEpicTitle(e.target.value)} placeholder={t('accelerator.epicTitle')} />
                    <Textarea value={newEpicDescription} onChange={(e) => setNewEpicDescription(e.target.value)} placeholder={t('accelerator.epicDescription')} />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewEpicOpen(false)}>{t('accelerator.cancel')}</Button>
                    <Button
                      disabled={!newEpicTitle.trim() || createEpicMutation.isPending}
                      onClick={() => createEpicMutation.mutate()}
                      data-testid="button-agile-create-epic"
                    >
                      {t('accelerator.create')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={newItemOpen} onOpenChange={setNewItemOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('accelerator.newWorkItem')}</DialogTitle>
                    <DialogDescription>{t('accelerator.newWorkItemDesc')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={newItemType} onValueChange={(v) => setNewItemType(v as AgileWorkItemType)}>
                        <SelectTrigger><SelectValue placeholder={t('accelerator.type')} /></SelectTrigger>
                        <SelectContent>
                          {['epic','story','task','bug','subtask'].map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={newItemPriority} onValueChange={(v) => setNewItemPriority(v as 'critical' | 'high' | 'medium' | 'low')}>
                        <SelectTrigger><SelectValue placeholder={t('accelerator.priority')} /></SelectTrigger>
                        <SelectContent>
                          {['critical','high','medium','low'].map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Input value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} placeholder={t('accelerator.title')} />
                    <Textarea value={newItemDescription} onChange={(e) => setNewItemDescription(e.target.value)} placeholder={t('accelerator.description')} />

                    <div className="grid grid-cols-2 gap-2">
                      <Input value={newItemStoryPoints} onChange={(e) => setNewItemStoryPoints(e.target.value)} placeholder={t('accelerator.storyPoints')} />
                      <Select value={newItemEpicId || AGILE_SELECT_NO_EPIC} onValueChange={(v) => setNewItemEpicId(v === AGILE_SELECT_NO_EPIC ? null : v)}>
                        <SelectTrigger><SelectValue placeholder={t('accelerator.epicOptional')} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={AGILE_SELECT_NO_EPIC}>{t('accelerator.noEpic')}</SelectItem>
                          {epics.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.epicKey}: {e.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewItemOpen(false)}>{t('accelerator.cancel')}</Button>
                    <Button
                      disabled={!newItemTitle.trim() || createItemMutation.isPending}
                      onClick={() => createItemMutation.mutate()}
                      data-testid="button-agile-create-item"
                    >
                      {t('accelerator.create')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team-setup" className="mt-6">
          <Card className="bg-card/60 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('accelerator.teamSetup')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border bg-muted/20">
                    <p className="text-sm text-muted-foreground mb-1">{t('accelerator.projectManager')}</p>
                    <p className="font-medium">{project.projectManager || t('accelerator.notAssigned')}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/20">
                    <p className="text-sm text-muted-foreground mb-1">{t('accelerator.sponsor')}</p>
                    <p className="font-medium">{project.sponsor || t('accelerator.notAssigned')}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/20">
                    <p className="text-sm text-muted-foreground mb-1">{t('accelerator.workspacePath')}</p>
                    <Badge variant="outline" className="capitalize">{project.workspacePath || 'accelerator'}</Badge>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/20">
                    <p className="text-sm text-muted-foreground mb-1">{t('accelerator.allocatedFte')}</p>
                    <p className="font-medium">{(project.metadata as Record<string, unknown> | undefined)?.allocatedFte as string || '—'}</p>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold">{t('accelerator.agileRoles')}</p>
                      <p className="text-xs text-muted-foreground">{t('accelerator.agileRolesDesc')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Input
                      value={newMemberUserId}
                      onChange={(e) => setNewMemberUserId(e.target.value)}
                      placeholder={t('accelerator.userId')}
                      data-testid="input-agile-member-userId"
                    />
                    <Select value={newMemberRole} onValueChange={(v) => setNewMemberRole(v as AgileProjectRole)}>
                      <SelectTrigger data-testid="select-agile-member-role">
                        <SelectValue placeholder={t('accelerator.role')} />
                      </SelectTrigger>
                      <SelectContent>
                        {['product_owner','scrum_master','developer','stakeholder','viewer'].map((r) => (
                          <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => upsertMemberMutation.mutate()}
                      disabled={!newMemberUserId.trim() || upsertMemberMutation.isPending}
                      className="gap-2"
                      data-testid="button-agile-add-member"
                    >
                      <Plus className="h-4 w-4" />
                      {t('accelerator.addUpdate')}
                    </Button>
                  </div>

                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('accelerator.noAgileMembers')}</p>
                  ) : (
                    <div className="space-y-2">
                      {members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border bg-background/50">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{m.userId}</p>
                            <p className="text-xs text-muted-foreground">{t('accelerator.member')}</p>
                          </div>
                          <Badge variant="outline" className="capitalize">{m.role.replace(/_/g, ' ')}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sprint-goals" className="mt-6">
          <Card className="bg-card/60 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                {t('accelerator.sprintGoals')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const goalSprintId = activeSprint?.id || effectiveSelectedSprintId;
                const sprintWork = goalSprintId ? items.filter((i) => i.sprintId === goalSprintId) : [];
                const totalItems = sprintWork.length;
                const completedItems = sprintWork.filter((i) => i.status === 'done').length;
                const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

                return (
                  <div className="space-y-6">
                    <div className="p-4 rounded-lg border bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{t('accelerator.sprintProgress')}</h4>
                        <span className="text-sm font-bold">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-2">{t('accelerator.itemsCompleted', { completed: completedItems, total: totalItems })}</p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">{t('accelerator.goalTracking')}</h4>
                      <div className="p-3 rounded-lg border bg-muted/20 flex items-start gap-3">
                        <Target className="h-5 w-5 text-indigo-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">{t('accelerator.completeSprintDeliverables')}</p>
                          <p className="text-xs text-muted-foreground">{t('accelerator.completeSprintDeliverablesDesc')}</p>
                          <div className="mt-2">
                            <Progress value={progress} className="h-1.5" />
                          </div>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/20 flex items-start gap-3">
                        <Target className="h-5 w-5 text-purple-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">{t('accelerator.qualityGate')}</p>
                          <p className="text-xs text-muted-foreground">{t('accelerator.qualityGateDesc')}</p>
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">{project.healthStatus === 'on_track' ? t('accelerator.onTrack') : t('accelerator.needsAttention')}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function AcceleratorBuildTab({
  project,
}: {
  project: ProjectData;
  tasks: WbsTaskData[];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const projectId = project.id;

  const { data: sprintsData } = useQuery<{ success: boolean; sprints: AgileSprintData[] }>({
    queryKey: ['/api/portfolio/projects', projectId, 'agile', 'sprints'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/portfolio/projects/${projectId}/agile/sprints`);
      return response.json();
    },
    staleTime: 10_000,
  });

  const { data: itemsData } = useQuery<{ success: boolean; items: AgileWorkItemData[] }>({
    queryKey: ['/api/portfolio/projects', projectId, 'agile', 'work-items'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/portfolio/projects/${projectId}/agile/work-items`);
      return response.json();
    },
    staleTime: 5_000,
  });

  const sprints = (sprintsData?.success ? sprintsData.sprints : []) || [];
  const items = useMemo(() => (itemsData?.success ? itemsData.items : []) || [], [itemsData]);

  const activeSprint = sprints.find((s) => s.status === 'active') || null;
  const activeSprintItems = useMemo(() => activeSprint ? items.filter((i) => i.sprintId === activeSprint.id) : [], [activeSprint, items]);

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AgileWorkItemStatus }) => {
      await apiRequest('PATCH', `/api/portfolio/agile/work-items/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'agile', 'work-items'] });
    },
  });

  const byStatus = useMemo(() => {
    const buckets: Record<string, AgileWorkItemData[]> = {
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
    };
    for (const it of activeSprintItems) {
      const key = (it.status || 'todo') as string;
      if (buckets[key]) buckets[key].push(it);
    }
    return buckets;
  }, [activeSprintItems]);

  const total = activeSprintItems.length;
  const done = activeSprintItems.filter((i) => i.status === 'done').length;
  const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card className="bg-card/60 border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Hammer className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Active Sprint Board
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!activeSprint ? (
            <div className="text-center py-10 text-muted-foreground">
              <Columns3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('accelerator.noActiveSprint')}</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold">{activeSprint.name}</p>
                  <p className="text-xs text-muted-foreground">{activeSprint.goal || 'No sprint goal set'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{done}/{total} done</Badge>
                  <div className="min-w-[200px]">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span className="font-medium text-foreground">{progressPercent}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {([
                  { key: 'todo', label: t('accelerator.toDo') },
                  { key: 'in_progress', label: t('accelerator.inProgress') },
                  { key: 'in_review', label: t('accelerator.inReview') },
                  { key: 'done', label: t('accelerator.done') },
                ] as const).map((col) => (
                  <div key={col.key} className="rounded-lg border bg-muted/10 overflow-hidden">
                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b bg-muted/20 flex items-center justify-between">
                      <span>{col.label}</span>
                      <Badge variant="outline" className="text-[10px]">{byStatus[col.key]?.length || 0}</Badge>
                    </div>
                    <div className="p-2 space-y-2 min-h-[240px]">
                      {(byStatus[col.key] || []).map((it) => (
                        <div key={it.id} className="p-2 rounded-md border bg-background/60">
                          <div className="flex items-center justify-between gap-2">
                            <code className="text-[10px] bg-muted/40 px-1.5 py-0.5 rounded">{it.itemKey}</code>
                            <Badge variant="outline" className="text-[10px] capitalize">{it.type}</Badge>
                          </div>
                          <p className="text-sm font-medium mt-2 line-clamp-2">{it.title}</p>
                          <div className="mt-2">
                            <Select
                              value={it.status}
                              onValueChange={(v) => updateItemMutation.mutate({ id: it.id, status: v as AgileWorkItemStatus })}
                            >
                              <SelectTrigger className="h-8" data-testid={`select-agile-board-status-${it.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {['todo','in_progress','in_review','done'].map((s) => (
                                  <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                      {(byStatus[col.key] || []).length === 0 && (
                        <div className="text-xs text-muted-foreground p-2">{t('accelerator.noItems')}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AcceleratorLaunchTab({
  project,
}: {
  project: ProjectData;
}) {
  const { t } = useTranslation();
  const projectId = project.id;

  const { data: sprintsData } = useQuery<{ success: boolean; sprints: AgileSprintData[] }>({
    queryKey: ['/api/portfolio/projects', projectId, 'agile', 'sprints'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/portfolio/projects/${projectId}/agile/sprints`);
      return response.json();
    },
    staleTime: 30_000,
  });

  const { data: itemsData } = useQuery<{ success: boolean; items: AgileWorkItemData[] }>({
    queryKey: ['/api/portfolio/projects', projectId, 'agile', 'work-items'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/portfolio/projects/${projectId}/agile/work-items`);
      return response.json();
    },
    staleTime: 10_000,
  });

  const sprints = (sprintsData?.success ? sprintsData.sprints : []) || [];
  const items = (itemsData?.success ? itemsData.items : []) || [];

  const completedSprints = sprints.filter((s) => s.status === 'completed');
  const activeSprint = sprints.find((s) => s.status === 'active') || null;

  const velocityBySprint = completedSprints.map((s) => {
    const sprintItems = items.filter((i) => i.sprintId === s.id);
    const doneItems = sprintItems.filter((i) => i.status === 'done');
    const velocity = doneItems.reduce((acc, it) => acc + (typeof it.storyPoints === 'number' ? it.storyPoints : 0), 0);
    return { sprint: s, velocity, doneCount: doneItems.length, totalCount: sprintItems.length };
  });

  const launchChecklist = [
    { id: 1, label: 'Active sprint has no remaining work', checked: activeSprint ? items.filter((i) => i.sprintId === activeSprint.id && i.status !== 'done').length === 0 : false },
    { id: 2, label: 'At least one sprint completed', checked: completedSprints.length > 0 },
    { id: 3, label: 'Stakeholder approval obtained', checked: false },
    { id: 4, label: 'Documentation finalized', checked: false },
    { id: 5, label: 'Go-live plan confirmed', checked: false },
  ];

  return (
    <div className="space-y-6">
      <Card className="bg-card/60 border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            Sprint Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          {velocityBySprint.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('accelerator.noCompletedSprints')}</div>
          ) : (
            <div className="space-y-3">
              {velocityBySprint.map(({ sprint, velocity, doneCount, totalCount }) => (
                <div key={sprint.id} className="p-3 rounded-lg border bg-muted/10 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{sprint.name}</p>
                    <p className="text-xs text-muted-foreground">{doneCount}/{totalCount} items done</p>
                  </div>
                  <Badge variant="outline">Velocity: {velocity} pts</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/60 border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Rocket className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            Launch Readiness Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {launchChecklist.map((item) => (
              <div key={item.id} className="p-3 bg-muted/40 border border-border/50 rounded-lg flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  item.checked ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground'
                }`}>
                  {item.checked && <CheckCircle2 className="w-4 h-4 text-white" />}
                </div>
                <span className={`text-sm ${item.checked ? 'line-through text-muted-foreground' : ''}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border-purple-500/30">
        <CardContent className="p-8 text-center">
          <Rocket className="w-16 h-16 mx-auto mb-4 text-purple-600 dark:text-purple-400" />
          <h3 className="text-xl font-bold mb-2">{t('accelerator.readyForLaunch')}</h3>
          <p className="text-muted-foreground mb-6">
            {t('accelerator.readyForLaunchDesc')}
          </p>
          <Button size="lg" className="gap-2" data-testid="button-initiate-launch">
            <Rocket className="w-5 h-5" />
            Initiate Launch Sequence
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default AcceleratorWorkspace;
