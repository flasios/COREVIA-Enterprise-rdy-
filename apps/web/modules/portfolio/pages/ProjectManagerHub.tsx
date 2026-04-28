import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { GatewayLayout } from "@/components/layout";
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  Users,
  BarChart3,
  Target,
  AlertTriangle,
  ChevronRight,
  Briefcase,
  ListTodo,
  Milestone,
  GitBranch,
  MessageSquare,
  Zap,
  Award,
} from "lucide-react";
import { ProjectRow, TaskCard } from "./projectManagerHub.components";
import type { Project, MyStats, MyTask } from "./projectManagerHub.components";

export default function ProjectManagerHub() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("projects");

  // Fetch only MY projects (where I am the project manager)
  const { data: projectsData, isLoading: projectsLoading } = useQuery<{ success: boolean; data: Record<string, unknown>[] }>({
    queryKey: ['/api/portfolio/my-projects'],
  });

  // Fetch MY stats
  const { data: statsData } = useQuery<{ success: boolean; data: MyStats }>({
    queryKey: ['/api/portfolio/my-stats'],
  });

  // Fetch MY tasks
  const { data: tasksData, isLoading: tasksLoading } = useQuery<{ success: boolean; data: Record<string, unknown>[] }>({
    queryKey: ['/api/portfolio/my-tasks'],
  });

  const myStats = statsData?.data;
  
  const myTasks: MyTask[] = (tasksData?.data || []).map((t: Record<string, unknown>) => ({
    id: String(t.id || ""),
    name: String(t.name || t.taskName || 'Not recorded'),
    status: String(t.status || 'pending'),
    priority: String(t.priority || 'medium'),
    dueDate: (t.dueDate || t.due_date || null) as string | null,
    projectName: String(t.projectName || 'Not recorded'),
    projectCode: String(t.projectCode || 'PRJ'),
  }));

  const projects: Project[] = (projectsData?.data || []).map((p: Record<string, unknown>) => ({
    id: String(p.id || ""),
    name: String(p.projectName || p.project_name || 'Not recorded'),
    code: String(p.projectCode || p.project_code || `PRJ-${String(p.id || "").slice(0, 4).toUpperCase()}`),
    phase: String(p.currentPhase || p.current_phase || 'intake'),
    progress: Number(p.overallProgress || p.overall_progress || 0),
    health: String(p.healthStatus || p.health_status || 'on_track'),
    dueDate: p.plannedEndDate || p.planned_end_date
      ? new Date((p.plannedEndDate || p.planned_end_date) as string | number | Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'TBD',
    plannedEndDate: (p.plannedEndDate || p.planned_end_date || null) as string | null,
    team: Number(p.allocatedFte || p.allocated_fte || 0),
    currentGate: String(p.currentGate || p.current_gate || ''),
    hasPendingGate: Boolean(p.hasPendingGate || p.has_pending_gate || false),
  }));

  const pendingGateCount = projects.filter((project) => project.hasPendingGate).length;
  const tasksByStatus = {
    pending: myTasks.filter((task) => ['pending', 'not_started'].includes(task.status)).length,
    inProgress: myTasks.filter((task) => task.status === 'in_progress').length,
    completed: myTasks.filter((task) => task.status === 'completed').length,
    overdue: myTasks.filter((task) => {
      if (!task.dueDate || task.status === 'completed') return false;
      return new Date(task.dueDate).getTime() < Date.now();
    }).length,
  };
  const tasksByPriority = {
    high: myTasks.filter((task) => task.priority === 'high' && task.status !== 'completed').length,
    medium: myTasks.filter((task) => task.priority === 'medium' && task.status !== 'completed').length,
    low: myTasks.filter((task) => task.priority === 'low' && task.status !== 'completed').length,
  };
  const upcomingProjects = projects
    .filter((project) => project.plannedEndDate)
    .sort((a, b) => new Date(a.plannedEndDate as string).getTime() - new Date(b.plannedEndDate as string).getTime())
    .slice(0, 6);
  const healthMapProjects = projects.slice(0, 12);
  const phaseCounts = projects.reduce<Record<string, number>>((acc, project) => {
    const key = project.phase || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <GatewayLayout
      title={t('portfolio_pages.projectManagerWorkspace')}
      subtitle={t('portfolio_pages.projectManagerSubtitle')}
      icon={<FolderKanban className="w-7 h-7 text-white" />}
      accentColor="teal"
      testId="gateway-project-manager"
      headerActions={
        <div className="flex items-center gap-2">
          <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30">
            <Zap className="h-3 w-3 mr-1" />
            {t('portfolio_pages.agileEnabled')}
          </Badge>
          <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30">
            <GitBranch className="h-3 w-3 mr-1" />
            {t('portfolio_pages.versionControl')}
          </Badge>
          <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30">
            <Award className="h-3 w-3 mr-1" />
            {t('portfolio_pages.pmStandards')}
          </Badge>
        </div>
      }
    >
      <div className="mb-8 relative overflow-hidden rounded-[32px] border border-teal-200/40 bg-gradient-to-br from-teal-50/80 via-white to-cyan-50/70 p-8 shadow-[0_36px_90px_-55px_rgba(15,23,42,0.4)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.16)_0%,_transparent_55%)]" />
        <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-teal-200/40 blur-3xl" />
        <div className="absolute -left-16 bottom-[-120px] h-56 w-56 rounded-full bg-cyan-100/50 blur-3xl" />
        <div className="relative space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.4em] text-teal-600/80">{t('portfolio_pages.projectManagerGateway')}</p>
              <h2 className="text-3xl font-semibold text-slate-900">{t('portfolio_pages.myDeliveryCommandDesk')}</h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                {t('portfolio_pages.deliveryCommandDeskDescription')}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{myStats?.activeProjects ?? 0} {t('portfolio_pages.activeProjects')}</Badge>
                <Badge variant="secondary" className="text-[10px]">{tasksByStatus.overdue} {t('portfolio_pages.overdueTasks')}</Badge>
                <Badge variant="secondary" className="text-[10px]">{pendingGateCount} {t('portfolio_pages.pendingGates')}</Badge>
                <Badge variant="secondary" className="text-[10px]">{t('portfolio_pages.avgProgress')} {Math.round(myStats?.avgProgress ?? 0)}%</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setActiveTab("projects")} className="gap-2">
                <FolderKanban className="h-4 w-4" />
                {t('portfolio_pages.viewProjects')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setActiveTab("tasks")} className="gap-2">
                <ListTodo className="h-4 w-4" />
                {t('portfolio_pages.openTasks')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setActiveTab("milestones")} className="gap-2">
                <Milestone className="h-4 w-4" />
                {t('portfolio_pages.milestones')}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-teal-100/70 bg-white/90">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('portfolio_pages.myProjects')}</span>
                  <FolderKanban className="h-4 w-4 text-teal-500" />
                </div>
                <div className="text-2xl font-semibold text-slate-900">{myStats?.totalProjects ?? projects.length}</div>
                <div className="text-xs text-muted-foreground">{myStats?.completedProjects ?? 0} {t('app.completed')}</div>
              </CardContent>
            </Card>
            <Card className="border-teal-100/70 bg-white/90">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('portfolio_pages.deliveryHealth')}</span>
                  <Target className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-semibold text-slate-900">{Math.round(myStats?.avgProgress ?? 0)}%</div>
                <div className="text-xs text-muted-foreground">{myStats?.atRiskProjects ?? 0} {t('portfolio_pages.atRisk')}</div>
              </CardContent>
            </Card>
            <Card className="border-teal-100/70 bg-white/90">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('portfolio_pages.tasksInFlight')}</span>
                  <ListTodo className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-2xl font-semibold text-slate-900">{tasksByStatus.inProgress}</div>
                <div className="text-xs text-muted-foreground">{tasksByStatus.pending} {t('app.pending')}</div>
              </CardContent>
            </Card>
            <Card className="border-teal-100/70 bg-white/90">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('portfolio_pages.budgetUtilization')}</span>
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-semibold text-slate-900">
                  {myStats?.totalBudget ? Math.round((myStats.totalSpend / Math.max(myStats.totalBudget, 1)) * 100) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">AED {Math.round(myStats?.totalSpend ?? 0).toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-teal-100/70 bg-white/90 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('portfolio_pages.executionSignal')}</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {tasksByStatus.inProgress} {t('portfolio_pages.tasksInFlight')}
              </div>
              <div className="text-[11px] text-muted-foreground">{t('portfolio_pages.keepVelocityStable')}</div>
            </div>
            <div className="rounded-xl border border-teal-100/70 bg-white/90 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('portfolio_pages.riskPosture')}</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {myStats?.atRiskProjects ?? 0} {t('portfolio_pages.projectsAtRisk')}
              </div>
              <div className="text-[11px] text-muted-foreground">{t('portfolio_pages.mitigationInProgress')}</div>
            </div>
            <div className="rounded-xl border border-teal-100/70 bg-white/90 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('portfolio_pages.gateMomentum')}</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {pendingGateCount} {t('portfolio_pages.approvalsPending')}
              </div>
              <div className="text-[11px] text-muted-foreground">{t('portfolio_pages.clearToUnlockPhases')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <Card className="border-teal-100/70 bg-white/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-teal-600" />
              {t('portfolio_pages.projectHealthMap')}
            </CardTitle>
            <CardDescription>{t('portfolio_pages.projectHealthMapDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {healthMapProjects.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">{t('portfolio_pages.noProjectsAvailable')}</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {healthMapProjects.map((project) => (
                  <Link key={project.id} href={`/project/${project.id}`}>
                    <div className="group rounded-xl border border-border/60 bg-muted/40 p-3 transition hover:border-teal-200 hover:bg-teal-50/40">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px] font-mono">{project.code}</Badge>
                        <div className={`h-2.5 w-2.5 rounded-full ${
                          project.health === 'on_track' ? 'bg-emerald-500' :
                          project.health === 'at_risk' ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900 line-clamp-1">{project.name}</div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="capitalize">{project.phase}</span>
                        <span>{t('portfolio_pages.eta')} {project.dueDate}</span>
                      </div>
                      <div className="mt-2">
                        <Progress value={project.progress} className="h-1.5" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-teal-100/70 bg-white/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-600" />
              {t('portfolio_pages.phaseDistribution')}
            </CardTitle>
            <CardDescription>{t('portfolio_pages.phaseDistributionDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(phaseCounts).length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">{t('portfolio_pages.noPhaseData')}</div>
            ) : (
              Object.entries(phaseCounts).map(([phase, count]) => (
                <div key={phase} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                  <span className="capitalize text-muted-foreground">{phase}</span>
                  <span className="font-semibold text-slate-900">{count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl" data-testid="pm-tabs">
            <TabsTrigger value="projects" data-testid="tab-projects">{t('portfolio_pages.projects')}</TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-tasks">{t('portfolio_pages.myTasks')}</TabsTrigger>
            <TabsTrigger value="milestones" data-testid="tab-milestones">{t('portfolio_pages.milestones')}</TabsTrigger>
            <TabsTrigger value="team" data-testid="tab-team">{t('portfolio_pages.team')}</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-primary" />
                        {t('portfolio_pages.myPortfolio')}
                      </CardTitle>
                      <CardDescription>{t('portfolio_pages.myPortfolioDescription')}</CardDescription>
                    </div>
                    <Link href="/intelligent-portfolio">
                      <Button data-testid="button-view-all">
                        {t('portfolio_pages.viewAllProjects')}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {projectsLoading ? (
                      <div className="text-center py-8 text-muted-foreground">{t('app.loadingProjects')}</div>
                    ) : projects.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {t('portfolio_pages.noProjectsFound')}
                      </div>
                    ) : (
                      projects.map((project) => (
                        <ProjectRow key={project.id} project={project} />
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="border-teal-100/70 bg-white/90">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                      <BarChart3 className="h-4 w-4 text-teal-600" />
                      {t('portfolio_pages.executionRadar')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-teal-100/70 bg-teal-50/60 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('portfolio_pages.pendingGates')}</div>
                        <div className="text-xl font-semibold text-slate-900">{pendingGateCount}</div>
                      </div>
                      <div className="rounded-lg border border-teal-100/70 bg-teal-50/60 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('portfolio_pages.atRisk')}</div>
                        <div className="text-xl font-semibold text-slate-900">{myStats?.atRiskProjects ?? 0}</div>
                      </div>
                      <div className="rounded-lg border border-teal-100/70 bg-teal-50/60 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('portfolio_pages.averageProgress')}</div>
                        <div className="text-xl font-semibold text-slate-900">{Math.round(myStats?.avgProgress ?? 0)}%</div>
                      </div>
                      <div className="rounded-lg border border-teal-100/70 bg-teal-50/60 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('portfolio_pages.overdueTasks')}</div>
                        <div className="text-xl font-semibold text-slate-900">{tasksByStatus.overdue}</div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-teal-100/70 bg-white/80 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('portfolio_pages.priorityWorkload')}</div>
                      <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>{t('task.highPriority')}</span>
                          <span className="font-semibold text-slate-900">{tasksByPriority.high}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{t('task.mediumPriority')}</span>
                          <span className="font-semibold text-slate-900">{tasksByPriority.medium}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{t('task.lowPriority')}</span>
                          <span className="font-semibold text-slate-900">{tasksByPriority.low}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    {t('task.highPriority')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tasksLoading ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">{t('app.loading')}</div>
                    ) : myTasks.filter(t => t.priority === 'high' && t.status !== 'completed').length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">{t('task.noHighPriorityTasks')}</div>
                    ) : (
                      myTasks.filter(t => t.priority === 'high' && t.status !== 'completed').map(task => (
                        <TaskCard
                          key={task.id}
                          title={task.name}
                          project={task.projectName}
                          priority="high"
                          dueDate={task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : t('app.noDate')}
                        />
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-amber-500" />
                    {t('task.inProgress')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tasksLoading ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">{t('app.loading')}</div>
                    ) : myTasks.filter(t => t.status === 'in_progress').length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">{t('task.noTasksInProgress')}</div>
                    ) : (
                      myTasks.filter(t => t.status === 'in_progress').map(task => (
                        <TaskCard
                          key={task.id}
                          title={task.name}
                          project={task.projectName}
                          priority={task.priority as "high" | "medium" | "low"}
                          dueDate={task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : t('app.noDate')}
                        />
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    {t('app.pending')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tasksLoading ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">{t('app.loading')}</div>
                    ) : myTasks.filter(t => t.status === 'pending' || t.status === 'not_started').length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">{t('task.noPendingTasks')}</div>
                    ) : (
                      myTasks.filter(t => t.status === 'pending' || t.status === 'not_started').slice(0, 5).map(task => (
                        <TaskCard
                          key={task.id}
                          title={task.name}
                          project={task.projectName}
                          priority={task.priority as "high" | "medium" | "low"}
                          dueDate={task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : t('app.noDate')}
                        />
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="milestones" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Milestone className="h-5 w-5 text-primary" />
                  {t('portfolio_pages.upcomingDeadlines')}
                </CardTitle>
                <CardDescription>{t('portfolio_pages.upcomingDeadlinesDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingProjects.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      {t('portfolio_pages.noUpcomingDeadlines')}
                    </div>
                  ) : (
                    upcomingProjects.map((project) => (
                      <div key={project.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-4">
                          <div className={`h-3 w-3 rounded-full ${
                            project.health === "on_track" ? "bg-emerald-500" :
                            project.health === "at_risk" ? "bg-amber-500" : "bg-red-500"
                          }`} />
                          <div>
                            <p className="font-medium">{project.name}</p>
                            <p className="text-sm text-muted-foreground capitalize">{project.phase} {t('project.phase')}</p>
                          </div>
                        </div>
                        <Badge variant="outline">{project.dueDate}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    {t('portfolio_pages.workloadMix')}
                  </CardTitle>
                  <CardDescription>{t('portfolio_pages.workloadMixDescription')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                      <div className="text-xs text-muted-foreground">{t('task.activeTasks')}</div>
                      <div className="text-2xl font-semibold text-slate-900">{tasksByStatus.inProgress}</div>
                      <div className="text-xs text-muted-foreground">{tasksByStatus.pending} {t('app.pending')} • {tasksByStatus.overdue} {t('app.overdue')}</div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                      <div className="text-xs text-muted-foreground">{t('portfolio_pages.priorityMix')}</div>
                      <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>{t('task.highPriority')}</span>
                          <span className="font-semibold text-slate-900">{tasksByPriority.high}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{t('task.mediumPriority')}</span>
                          <span className="font-semibold text-slate-900">{tasksByPriority.medium}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{t('task.lowPriority')}</span>
                          <span className="font-semibold text-slate-900">{tasksByPriority.low}</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                      <div className="text-xs text-muted-foreground">{t('portfolio_pages.portfolioLoad')}</div>
                      <div className="text-2xl font-semibold text-slate-900">{myStats?.activeProjects ?? 0}</div>
                      <div className="text-xs text-muted-foreground">{myStats?.completedProjects ?? 0} {t('app.completed')}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    {t('portfolio_pages.collaborationPulse')}
                  </CardTitle>
                  <CardDescription>{t('portfolio_pages.collaborationPulseDescription')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                      <div className="text-xs text-muted-foreground">{t('portfolio_pages.atRiskProjects')}</div>
                      <div className="text-2xl font-semibold text-slate-900">{myStats?.atRiskProjects ?? 0}</div>
                      <div className="text-xs text-muted-foreground">{t('portfolio_pages.focusOnMitigationPlans')}</div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                      <div className="text-xs text-muted-foreground">{t('task.completedTasks')}</div>
                      <div className="text-2xl font-semibold text-slate-900">{tasksByStatus.completed}</div>
                      <div className="text-xs text-muted-foreground">{t('portfolio_pages.deliveryThroughput')}</div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                      <div className="text-xs text-muted-foreground">{t('portfolio_pages.overdueTasks')}</div>
                      <div className="text-2xl font-semibold text-slate-900">{tasksByStatus.overdue}</div>
                      <div className="text-xs text-muted-foreground">{t('portfolio_pages.reviewDependencies')}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
    </GatewayLayout>
  );
}
