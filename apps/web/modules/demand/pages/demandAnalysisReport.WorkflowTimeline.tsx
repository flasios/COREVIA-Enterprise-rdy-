import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Workflow,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { getWorkflowStages, getWorkflowStatusColor, getWorkflowStatusLabel, resolveDemandDisplayWorkflowStatus } from "./demandAnalysisReport.utils";
import type { DemandReport } from "./demandAnalysisReport.types";

// ============================================================================
// HORIZONTAL WORKFLOW TIMELINE COMPONENT
// ============================================================================

interface HorizontalWorkflowTimelineProps {
  workflowStatus: string;
  workflowHistory?: DemandReport["workflowHistory"];
  workflowExpanded: boolean;
  setWorkflowExpanded: (expanded: boolean) => void;
}

export function HorizontalWorkflowTimeline({
  workflowStatus,
  workflowHistory,
  workflowExpanded,
  setWorkflowExpanded,
}: HorizontalWorkflowTimelineProps) {
  const { t } = useTranslation();
  const workflowStages = getWorkflowStages();
  const displayWorkflowStatus = resolveDemandDisplayWorkflowStatus(workflowStatus, workflowHistory);
  const getCurrentStageIndex = () => {
    const currentStatus = displayWorkflowStatus || "generated";
    const index = workflowStages.findIndex((stage) => stage.id === currentStatus);
    return index === -1 ? 0 : index;
  };

  const currentStageIndex = getCurrentStageIndex();
  const progressPercentage = ((currentStageIndex + 1) / workflowStages.length) * 100;
  const currentStage = workflowStages[currentStageIndex];

  // Collapsed View - Minimal space
  if (!workflowExpanded) {
    return (
      <div
        className="border-t bg-gradient-to-r from-blue-50/30 via-purple-50/30 to-blue-50/30 dark:from-blue-950/10 dark:via-purple-950/10 dark:to-blue-950/10 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
        onClick={() => setWorkflowExpanded(true)}
        data-testid="workflow-progress-collapsed"
      >
        <div className="py-1.5 px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Mini Progress Circle */}
            <div className="relative h-6 w-6 flex-shrink-0">
              <svg className="transform -rotate-90 h-6 w-6">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" className="text-muted/30" />
                <circle
                  cx="12" cy="12" r="10"
                  stroke="url(#progressGradientMini)"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 10}`}
                  strokeDashoffset={`${2 * Math.PI * 10 * (1 - progressPercentage / 100)}`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="progressGradientMini" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgb(59, 130, 246)" />
                    <stop offset="100%" stopColor="rgb(168, 85, 247)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Workflow className="h-2.5 w-2.5 text-blue-600" />
              </div>
            </div>

            {/* Compact Info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{Math.round(progressPercentage)}%</span>
              <span className="hidden sm:inline">|</span>
              <span className="hidden sm:inline">{t('demand.analysis.workflowTimeline.stageOf', { current: currentStageIndex + 1, total: workflowStages.length })}</span>
              <span className="hidden md:inline">-</span>
              <span className="hidden md:inline font-medium text-foreground">{currentStage?.label}</span>
            </div>

            {/* Mini Progress Bar */}
            <div className="hidden lg:block flex-1 max-w-48 h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className={`${getWorkflowStatusColor(displayWorkflowStatus)} text-[10px] px-2 py-0.5`}>
              {getWorkflowStatusLabel(displayWorkflowStatus || "generated")}
            </Badge>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  // Expanded View - Full timeline
  return (
    <div className="border-t bg-gradient-to-r from-blue-50/50 via-purple-50/50 to-blue-50/50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-blue-950/20">
      <div className="py-3 px-4">
        {/* Professional Header with Circular Progress */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Circular Progress Indicator */}
            <div className="relative h-12 w-12">
              <svg className="transform -rotate-90 h-12 w-12">
                <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="3" fill="none" className="text-muted/30" />
                <circle
                  cx="24" cy="24" r="20"
                  stroke="url(#progressGradient)"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - progressPercentage / 100)}`}
                  className="transition-all duration-1000 ease-out"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgb(59, 130, 246)" />
                    <stop offset="50%" stopColor="rgb(168, 85, 247)" />
                    <stop offset="100%" stopColor="rgb(16, 185, 129)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                  <Workflow className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>

            {/* Progress Info */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{t('demand.analysis.workflowTimeline.workflowProgress')}</h3>
                <div className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span className="text-xs text-muted-foreground font-medium">
                  {t('demand.analysis.workflowTimeline.stageOf', { current: currentStageIndex + 1, total: workflowStages.length })}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {Math.round(progressPercentage)}%
                </span>
                <span className="text-xs text-muted-foreground">{t('demand.analysis.workflowTimeline.complete')}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className={`${getWorkflowStatusColor(displayWorkflowStatus)} px-3 py-1 text-xs font-medium shadow-sm`}>
              {getWorkflowStatusLabel(displayWorkflowStatus || "generated")}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWorkflowExpanded(false)}
              data-testid="button-collapse-workflow"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Professional Stage Timeline */}
        <div className="relative">
          <div className="absolute top-3 left-6 right-6 h-1 bg-gradient-to-r from-muted/30 via-muted/20 to-muted/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 rounded-full transition-all duration-1000 ease-out shadow-sm"
              style={{ width: `${(currentStageIndex / (workflowStages.length - 1)) * 100}%` }}
            />
          </div>

          <div className="flex justify-between items-start relative z-10 px-3">
            {workflowStages.map((stage, index) => {
              const Icon = stage.icon;
              const isCompleted = index <= currentStageIndex;
              const isCurrent = index === currentStageIndex;

              return (
                <div
                  key={stage.id}
                  className={`flex flex-col items-center transition-all duration-300 ${
                    isCompleted ? "opacity-100" : "opacity-50"
                  }`}
                  style={{ width: `${100 / workflowStages.length}%` }}
                >
                  <div
                    className={`relative flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                      isCurrent
                        ? "bg-gradient-to-br from-blue-500 to-purple-600 border-blue-400 text-white shadow-lg shadow-blue-500/50 scale-110"
                        : isCompleted
                          ? "bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-400 text-white shadow-md"
                          : "bg-background border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    <Icon className={`h-3 w-3 ${isCurrent ? "animate-pulse" : ""}`} />
                    {isCurrent && (
                      <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                    )}
                  </div>

                  <div className="mt-1.5 text-center max-w-20">
                    <h4
                      className={`font-medium text-xs leading-tight transition-colors duration-300 ${
                        isCurrent
                          ? "text-primary font-semibold"
                          : isCompleted
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {stage.label.split(" ")[0]}
                    </h4>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// VERSION MANAGEMENT HEADER COMPONENT
// ============================================================================

interface VersionManagementHeaderProps {
  report: DemandReport;
  workflowStatus: string;
  workflowExpanded: boolean;
  setWorkflowExpanded: (expanded: boolean) => void;
  showWorkflowPanel: boolean;
  setShowWorkflowPanel: (show: boolean) => void;
  isMaximized: boolean;
  setIsMaximized: (maximized: boolean) => void;
  onNavigateBack: () => void;
}

export function VersionManagementHeader({
  report,
  workflowStatus,
  workflowExpanded,
  setWorkflowExpanded,
  showWorkflowPanel: _showWorkflowPanel,
  setShowWorkflowPanel: _setShowWorkflowPanel,
  isMaximized: _isMaximized,
  setIsMaximized: _setIsMaximized,
  onNavigateBack,
}: VersionManagementHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="border-b bg-card/50 backdrop-blur-sm relative">
      <Button
        variant="ghost"
        size="sm"
        className="absolute left-3 top-2 h-7 px-2 z-10"
        onClick={onNavigateBack}
        data-testid="button-back-to-library"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className="ml-1.5 text-xs">{t('demand.analysis.workflowTimeline.backToLibrary')}</span>
      </Button>

      <HorizontalWorkflowTimeline
        workflowStatus={workflowStatus}
        workflowHistory={report.workflowHistory}
        workflowExpanded={workflowExpanded}
        setWorkflowExpanded={setWorkflowExpanded}
      />
    </div>
  );
}
