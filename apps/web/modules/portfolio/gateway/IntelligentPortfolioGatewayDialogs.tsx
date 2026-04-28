import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PortfolioProject, WorkspacePath } from "@shared/schema";
import { PROJECT_PHASES } from "@shared/schema";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Compass,
  FileCheck,
  FileText,
  Flame,
  Loader2,
  Rocket,
  RotateCcw,
  Shield,
  Target,
  Timer,
  Users,
  Zap,
} from "lucide-react";

type PipelinePathItem = {
  businessObjective: string;
  organizationName: string;
  department: string;
  urgency: string;
};

const PHASE_COLORS: Record<string, string> = {
  intake: "bg-slate-500",
  triage: "bg-slate-600",
  governance: "bg-blue-500",
  analysis: "bg-purple-500",
  approved: "bg-indigo-500",
  planning: "bg-cyan-500",
  execution: "bg-amber-500",
  monitoring: "bg-orange-500",
  closure: "bg-emerald-500",
  completed: "bg-green-600",
  on_hold: "bg-gray-400",
  cancelled: "bg-red-500",
};

const MAIN_LIFECYCLE_PHASES = PROJECT_PHASES.filter((p): p is typeof p => !["on_hold", "cancelled"].includes(p));
const TERMINAL_PHASES = ["completed", "cancelled"];

export function WorkspacePathSelectionDialog({
  open,
  onOpenChange,
  item,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PipelinePathItem | null;
  onSelect: (path: WorkspacePath) => void;
}) {
  const [hoveredPath, setHoveredPath] = useState<WorkspacePath | null>(null);
  const [selectedPath, setSelectedPath] = useState<WorkspacePath | null>(null);
  const { t } = useTranslation();

  if (!item) return null;

  const workspaceOptions = [
    {
      id: 'standard' as WorkspacePath,
      title: t('portfolio.gateway.pathStandard'),
      subtitle: t('portfolio.gateway.pathStandardSubtitle'),
      description: t('portfolio.gateway.pathStandardFullDesc'),
      icon: Briefcase,
      gradient: 'from-blue-600 to-indigo-600',
      bgGradient: 'from-blue-500/10 to-indigo-500/10',
      borderColor: 'border-blue-500/30',
      phases: [t('portfolio.gateway.phaseInitiation'), t('portfolio.gateway.phasePlanning'), t('portfolio.gateway.phaseExecution'), t('portfolio.gateway.phaseMonitoring'), t('portfolio.gateway.phaseClosure')],
      features: [
        { icon: Shield, label: t('portfolio.gateway.featureFullGovernance') },
        { icon: FileCheck, label: t('portfolio.gateway.featureDetailedDocs') },
        { icon: Users, label: t('portfolio.gateway.featureStakeholderMgmt') },
        { icon: BarChart3, label: t('portfolio.gateway.featureKpiTracking') },
      ],
      bestFor: t('portfolio.gateway.pathStandardBestFor'),
      timeline: t('portfolio.gateway.timeline6Months'),
    },
    {
      id: 'accelerator' as WorkspacePath,
      title: t('portfolio.gateway.pathAccelerator'),
      subtitle: t('portfolio.gateway.pathAcceleratorSubtitle'),
      description: t('portfolio.gateway.pathAcceleratorFullDesc'),
      icon: Rocket,
      gradient: 'from-purple-600 to-pink-600',
      bgGradient: 'from-purple-500/10 to-pink-500/10',
      borderColor: 'border-purple-500/30',
      phases: [t('portfolio.gateway.phaseSprintPlanning'), t('portfolio.gateway.phaseBuild'), t('portfolio.gateway.phaseLaunch')],
      features: [
        { icon: Zap, label: t('portfolio.gateway.featureRapidSetup') },
        { icon: Timer, label: t('portfolio.gateway.featureSprintBased') },
        { icon: Target, label: t('portfolio.gateway.featureGoalFocused') },
        { icon: Flame, label: t('portfolio.gateway.featureQuickWins') },
      ],
      bestFor: t('portfolio.gateway.pathAcceleratorBestFor'),
      timeline: t('portfolio.gateway.timeline13Months'),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(95vh,940px)] w-[calc(100vw-1rem)] max-w-6xl p-0 overflow-hidden">
        <div className="relative flex h-full min-h-0 flex-col">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/5 pointer-events-none" />

          <div className="relative flex min-h-0 flex-1 flex-col p-4 sm:p-6">
            <DialogHeader className="mb-5 pr-8 text-center sm:mb-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-lg sm:h-16 sm:w-16">
                <Compass className="h-8 w-8 text-primary-foreground" />
              </div>
              <DialogTitle className="text-xl font-bold leading-tight sm:text-2xl">
                {t('portfolio.gateway.chooseProjectPath')}
              </DialogTitle>
              <DialogDescription className="mx-auto max-w-2xl text-sm leading-6 sm:text-base">
                {t('portfolio.gateway.chooseProjectPathDesc')}
              </DialogDescription>
            </DialogHeader>

            <div className="mb-5 rounded-lg bg-muted/30 p-3 sm:mb-6 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-5 break-words">{item.businessObjective}</p>
                  <p className="text-xs text-muted-foreground">{item.organizationName} • {item.department}</p>
                </div>
                <Badge variant="outline" className="w-fit shrink-0 self-start sm:self-center">
                  {item.urgency || 'Medium'} {t('portfolio.gateway.priorityLabel')}
                </Badge>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1 sm:pr-2">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {workspaceOptions.map((option) => {
                const isSelected = selectedPath === option.id;
                const isHovered = hoveredPath === option.id;
                const Icon = option.icon;

                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedPath(option.id)}
                    onMouseEnter={() => setHoveredPath(option.id)}
                    onMouseLeave={() => setHoveredPath(null)}
                    className={`relative group grid h-full min-h-[520px] grid-rows-[auto_auto_1fr_auto] text-left rounded-2xl border-2 p-5 transition-all duration-300 sm:p-6 ${
                      isSelected
                        ? `${option.borderColor} shadow-xl ring-2 ring-offset-2 ring-primary/50`
                        : isHovered
                          ? `${option.borderColor} shadow-lg`
                          : 'border-border/50 hover:border-border'
                    }`}
                    data-testid={`button-select-${option.id}`}
                  >
                    <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${option.bgGradient} ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`} />

                    {isSelected && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}

                    <div className="relative grid h-full grid-rows-[auto_auto_1fr_auto]">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${option.gradient} flex items-center justify-center shadow-lg`}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {option.timeline}
                        </Badge>
                      </div>

                      <div className="mb-4 rounded-xl border border-border/50 bg-background/70 p-4">
                        <h3 className="mb-1 text-lg font-bold leading-tight">{option.title}</h3>
                        <p className="mb-2 text-sm font-medium text-primary">{option.subtitle}</p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {option.description}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-border/50 bg-background/70 p-4">
                          <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground">PHASES</p>
                          <div className="flex flex-wrap gap-2">
                            {option.phases.map((phase) => (
                              <Badge
                                key={phase}
                                variant="outline"
                                className={`text-xs py-1 ${isSelected || isHovered ? option.borderColor : ''}`}
                              >
                                {phase}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-xl border border-border/50 bg-background/70 p-4">
                          <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground">FEATURES</p>
                          <div className="grid grid-cols-1 gap-2">
                            {option.features.map((feature) => {
                              const FeatureIcon = feature.icon;
                              return (
                                <div key={feature.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <div className={`flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br ${option.bgGradient}`}>
                                    <FeatureIcon className="h-3.5 w-3.5" />
                                  </div>
                                  <span className="leading-5">{feature.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-border/50 bg-background/70 p-4">
                        <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">{t('portfolio.gateway.bestFor')}</p>
                        <p className="text-sm leading-6 text-foreground/90">
                          {option.bestFor}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between rounded-xl border border-border/50 bg-background/80 px-4 py-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">{t('portfolio.gateway.continueWith', { path: option.title })}</p>
                          <p className="text-sm font-semibold">{option.timeline}</p>
                        </div>
                        <ArrowRight className={`h-5 w-5 transition-transform ${isSelected || isHovered ? 'translate-x-1 text-primary' : 'text-muted-foreground'}`} />
                      </div>
                    </div>
                  </button>
                );
              })}
              </div>
            </div>

            <DialogFooter className="mt-4 gap-3 border-t pt-4 sm:mt-6">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-path">
                {t('portfolio.gateway.cancel')}
              </Button>
              <Button
                onClick={() => selectedPath && onSelect(selectedPath)}
                disabled={!selectedPath}
                className="gap-2"
                data-testid="button-confirm-path"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t('portfolio.gateway.continueWith', { path: selectedPath === 'accelerator' ? t('portfolio.gateway.pathAccelerator') : selectedPath === 'standard' ? t('portfolio.gateway.pathStandard') : t('portfolio.gateway.selected') })}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PhaseTransitionDialog({
  open,
  onOpenChange,
  project,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: PortfolioProject | null;
  onConfirm: (toPhase: string, reason: string, transitionType: string) => void;
  isPending: boolean;
}) {
  const [transitionType, setTransitionType] = useState<"advance" | "revert">("advance");
  const [reason, setReason] = useState("");
  const { t } = useTranslation();

  if (!project) return null;

  const currentPhase = project.currentPhase;
  const isTerminal = TERMINAL_PHASES.includes(currentPhase);
  const isOnHold = currentPhase === "on_hold";

  const mainIdx = MAIN_LIFECYCLE_PHASES.indexOf(currentPhase as typeof MAIN_LIFECYCLE_PHASES[number]);

  const nextPhase = mainIdx >= 0 && mainIdx < MAIN_LIFECYCLE_PHASES.length - 1
    ? MAIN_LIFECYCLE_PHASES[mainIdx + 1]
    : null;
  const prevPhase = mainIdx > 0
    ? MAIN_LIFECYCLE_PHASES[mainIdx - 1]
    : null;

  const canAdvance = !isTerminal && !isOnHold && nextPhase !== null;
  const canRevert = !isTerminal && (isOnHold || prevPhase !== null);

  const targetPhase = transitionType === "advance" ? nextPhase : prevPhase;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-phase-transition">
        <DialogHeader>
          <DialogTitle>{t('portfolio.gateway.transitionPhase')}</DialogTitle>
          <DialogDescription>
            {isTerminal
              ? t('portfolio.gateway.terminalState')
              : t('portfolio.gateway.transitionPhaseDesc')
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm font-medium">{project.projectName}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`${PHASE_COLORS[currentPhase] || "bg-slate-500"} text-white text-xs border-0`}>
                {currentPhase}
              </Badge>
              <span className="text-xs text-muted-foreground">Current Phase</span>
              {isTerminal && (
                <Badge variant="destructive" className="text-xs">{t('portfolio.gateway.terminal')}</Badge>
              )}
            </div>
          </div>

          {!isTerminal && (
            <>
              <div className="space-y-2">
                <Label>{t('portfolio.gateway.transitionType')}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={transitionType === "advance" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTransitionType("advance")}
                    disabled={!canAdvance}
                    className="flex-1"
                    data-testid="button-advance-type"
                  >
                    <ArrowRight className="h-4 w-4 mr-1" />
                    {t('portfolio.gateway.advance')}
                  </Button>
                  <Button
                    type="button"
                    variant={transitionType === "revert" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTransitionType("revert")}
                    disabled={!canRevert}
                    className="flex-1"
                    data-testid="button-revert-type"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    {t('portfolio.gateway.revert')}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('portfolio.gateway.targetPhase')}</Label>
                <div className="p-3 rounded-lg border bg-muted/30">
                  {targetPhase ? (
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <Badge className={`${PHASE_COLORS[targetPhase] || "bg-slate-500"} text-white text-xs border-0`}>
                        {targetPhase}
                      </Badge>
                      <span className="text-xs text-muted-foreground capitalize">
                        {transitionType === "advance" ? t('portfolio.gateway.nextPhase') : t('portfolio.gateway.previousPhase')}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {transitionType === "advance"
                        ? t('portfolio.gateway.cannotAdvance')
                        : t('portfolio.gateway.cannotRevert')
                      }
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">{t('portfolio.gateway.reasonForTransition')}</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('portfolio.gateway.reasonForTransitionPlaceholder')}
                  rows={3}
                  data-testid="textarea-reason"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending} data-testid="button-cancel-transition">
            {t('portfolio.gateway.cancel')}
          </Button>
          {!isTerminal && targetPhase && (
            <Button
              onClick={() => onConfirm(targetPhase, reason, transitionType)}
              disabled={isPending || !targetPhase}
              data-testid="button-confirm-transition"
            >
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
              {t('portfolio.gateway.transitionTo', { phase: targetPhase })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
