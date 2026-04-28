import { Link } from "wouter";
import { useTranslation } from 'react-i18next';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Briefcase,
  Clock,
  Users,
  ChevronRight,
  GitBranch,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Project = {
  id: string;
  name: string;
  code: string;
  phase: string;
  progress: number;
  health: string;
  dueDate: string;
  plannedEndDate?: string | null;
  team: number;
  currentGate?: string;
  hasPendingGate?: boolean;
};

export type MyStats = {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  atRiskProjects: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  totalBudget: number;
  totalSpend: number;
  avgProgress: number;
};

export type MyTask = {
  id: string;
  name: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectName: string;
  projectCode: string;
};

// ─── ProjectRow ──────────────────────────────────────────────────────────────

export function ProjectRow({ project }: { project: Project }) {
  const { t } = useTranslation();
  const healthColors: Record<string, string> = {
    on_track: "bg-emerald-500",
    at_risk: "bg-amber-500",
    critical: "bg-red-500",
  };

  const phaseColors: Record<string, string> = {
    intake: "bg-slate-500",
    initiation: "bg-indigo-500",
    planning: "bg-cyan-500",
    execution: "bg-amber-500",
    monitoring: "bg-blue-500",
    closure: "bg-emerald-500",
    completed: "bg-emerald-600",
  };

  return (
    <Link href={`/project/${project.id}`}>
      <div
        className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
        data-testid={`row-project-${project.id}`}
      >
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Briefcase className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="text-xs font-mono">{project.code}</Badge>
            <Badge className={`${phaseColors[project.phase] || "bg-slate-500"} text-white text-xs border-0 capitalize`}>
              {project.phase}
            </Badge>
            {project.hasPendingGate && (
              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs animate-pulse">
                <Clock className="h-3 w-3 mr-1" />
                {t('portfolio.hubComps.pendingPmoApproval')}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{project.name}</p>
            {project.currentGate && (
              <span className="text-xs text-muted-foreground">
                <GitBranch className="h-3 w-3 inline mr-1" />
                {project.currentGate}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{t('portfolio.hubComps.progress')}</p>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={project.progress} className="w-20 h-2" />
              <span className="text-sm font-medium">{project.progress}%</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{t('portfolio.hubComps.team')}</p>
            <div className="flex items-center gap-1 mt-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{project.team}</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{t('portfolio.hubComps.due')}</p>
            <p className="text-sm font-medium mt-1">{project.dueDate}</p>
          </div>
          <div className={`h-3 w-3 rounded-full ${healthColors[project.health] || "bg-slate-400"}`} />
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}

// ─── TaskCard ────────────────────────────────────────────────────────────────

export function TaskCard({
  title,
  project,
  priority,
  dueDate,
  testId,
}: {
  title: string;
  project: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
  testId?: string;
}) {
  const priorityColors = {
    high: "border-l-red-500",
    medium: "border-l-amber-500",
    low: "border-l-emerald-500",
  };

  return (
    <div 
      className={`p-4 rounded-lg bg-muted/50 border-l-4 ${priorityColors[priority]} hover-elevate cursor-pointer`}
      data-testid={testId || `task-${priority}-${title.slice(0, 20).replace(/\s+/g, "-").toLowerCase()}`}
    >
      <p className="font-medium">{title}</p>
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>{project}</span>
        <span>{dueDate}</span>
      </div>
    </div>
  );
}
