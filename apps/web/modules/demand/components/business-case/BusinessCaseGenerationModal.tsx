import { useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Briefcase,
  Brain,
  Lightbulb,
  HelpCircle,
  TrendingUp,
  Shield,
  Gauge,
  Route,
  Cpu,
  Layers,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { VideoLogo } from "@/components/ui/video-logo";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import type { BusinessCaseGenerationModalProps, LayerNarration, ClarificationDomain, ClarificationResponse } from "./types";
import {
  GENERATION_PHASES,
  LAYER_STATUS,
  TOTAL_LAYERS,
  PHASE_MESSAGES,
  GRADIENT_CLASSES,
  getLayerClassName,
  getIconClassName,
  getBadgeClassName,
  getClarificationKey,
  STATUS_LABELS,
} from "./helpers";

function getRouteNoticeClassName(variant?: string): string {
  if (variant === "internal") return "border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100";
  if (variant === "hybrid") return "border-sky-200 bg-sky-50/90 text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100";
  return "border-slate-200 bg-slate-50/90 text-slate-900 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-100";
}

export function BusinessCaseGenerationModal({
  generationPhase,
  coveriaLayers,
  currentCoveriaMessage,
  engineRouteNotice,
  clarifications,
  expandedDomains,
  setExpandedDomains,
  clarificationResponses,
  setClarificationResponses,
  generateWithClarificationsMutation,
  onStartGeneration,
  isAutoBackground,
  isPendingApproval,
}: Readonly<BusinessCaseGenerationModalProps>) {
  const { t } = useTranslation();
  const isGenerating = generationPhase !== GENERATION_PHASES.IDLE && generationPhase !== GENERATION_PHASES.COMPLETE;
  const routeNoticeClassName = getRouteNoticeClassName(engineRouteNotice?.variant);

  const completedCount = useMemo(
    () => coveriaLayers.filter(l => l.status === LAYER_STATUS.COMPLETED).length,
    [coveriaLayers]
  );

  const progressPercentage = useMemo(
    () => (completedCount / TOTAL_LAYERS) * 100,
    [completedCount]
  );

  // PMO approval gate (top-level): when the Brain pipeline is held on Layer-7 approval,
  // BC generation cannot proceed regardless of whether the user clicks Generate. Always
  // surface this state before any other branch so the user sees why nothing is happening.
  if (isPendingApproval && !isGenerating) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center space-y-6 max-w-lg">
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 flex items-center justify-center shadow-2xl mx-auto">
            <Shield className="h-12 w-12 text-white" />
          </div>
          <div>
            <h2 className={`text-3xl font-bold ${GRADIENT_CLASSES.primary} bg-clip-text text-transparent mb-3`}>
              Awaiting PMO Approval
            </h2>
            <p className="text-base text-muted-foreground">
              Business case generation is on hold until the PMO approves this demand via the Brain governance gate. Generation will start automatically once approved.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span>Checking for approval status every few seconds…</span>
          </div>
        </div>
      </div>
    );
  }

  // Background server-side generation: show a stable screen that doesn't depend on
  // resettable client animation state. This prevents the loader from visually "restarting"
  // every time the user navigates away and returns to the Business Case tab.
  if (isGenerating && isAutoBackground) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center space-y-6 max-w-lg">
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-violet-500 via-indigo-600 to-blue-600 flex items-center justify-center shadow-2xl mx-auto">
            <Loader2 className="h-12 w-12 text-white animate-spin" />
          </div>
          <div>
            <h2 className={`text-3xl font-bold ${GRADIENT_CLASSES.primary} bg-clip-text text-transparent mb-3`}>
              Processing in Background
            </h2>
            <p className="text-base text-muted-foreground">
              COREVIA is generating your business case in the background. You can navigate away and return — your results will appear here automatically when ready.
            </p>
          </div>
          {engineRouteNotice && (
            <Alert className={`text-left ${getRouteNoticeClassName(engineRouteNotice.variant)}`} data-testid="alert-generation-route-notice">
              <Cpu className="h-4 w-4" />
              <AlertTitle className="flex items-center gap-2">
                <Badge variant="outline" className="border-current/20 bg-white/60 text-[10px] uppercase tracking-[0.18em] dark:bg-black/10">
                  {engineRouteNotice.badge}
                </Badge>
                <span>{engineRouteNotice.title}</span>
              </AlertTitle>
              <AlertDescription>{engineRouteNotice.description}</AlertDescription>
            </Alert>
          )}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
            <span>Checking for results every few seconds…</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isGenerating) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center space-y-6 max-w-2xl">
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-blue-500 via-blue-600 to-emerald-600 flex items-center justify-center shadow-2xl mx-auto">
            <Briefcase className="h-12 w-12 text-white" />
          </div>
          <div>
            <h2 className={`text-4xl font-bold ${GRADIENT_CLASSES.primary} bg-clip-text text-transparent mb-4`}>
              {t('demand.businessCase.generation.aiPoweredTitle')}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t('demand.businessCase.generation.description')}
            </p>
          </div>
          {engineRouteNotice && (
            <Alert className={`mx-auto max-w-xl text-left ${routeNoticeClassName}`} data-testid="alert-generation-route-notice">
              <Route className="h-4 w-4" />
              <AlertTitle className="flex items-center gap-2">
                <Badge variant="outline" className="border-current/20 bg-white/60 text-[10px] uppercase tracking-[0.18em] dark:bg-black/10">
                  {engineRouteNotice.badge}
                </Badge>
                <span>{engineRouteNotice.title}</span>
              </AlertTitle>
              <AlertDescription>
                {engineRouteNotice.description}
              </AlertDescription>
            </Alert>
          )}
          {onStartGeneration && (
            <Button
              onClick={onStartGeneration}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white px-8 py-3 text-lg shadow-lg"
              data-testid="button-start-generation"
            >
              <HexagonLogoFrame px={20} className="mr-2" />
              {t('demand.businessCase.generation.generateButton')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <div className="relative w-fit mx-auto lg:mx-0">
            <VideoLogo size="lg" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 animate-spin" style={{ animationDuration: '3s' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-violet-400 rounded-full shadow-lg"></div>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-indigo-400 rounded-full shadow-lg"></div>
            </div>
          </div>

          <div className="text-center lg:text-left space-y-4">
            <div className="flex items-center gap-3 justify-center lg:justify-start">
              <h2 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                Coveria
              </h2>
              <Badge variant="outline" className="border-violet-300 text-violet-600">
                {t('demand.businessCase.generation.brainActive')}
              </Badge>
            </div>
            <p className="text-lg text-muted-foreground">
              {PHASE_MESSAGES[generationPhase] || 'Processing...'}
            </p>
          </div>

          {engineRouteNotice && (
            <Alert className={routeNoticeClassName} data-testid="alert-generation-route-notice">
              <Cpu className="h-4 w-4" />
              <AlertTitle className="flex items-center gap-2">
                <Badge variant="outline" className="border-current/20 bg-white/60 text-[10px] uppercase tracking-[0.18em] dark:bg-black/10">
                  {engineRouteNotice.badge}
                </Badge>
                <span>{engineRouteNotice.title}</span>
              </AlertTitle>
              <AlertDescription>
                {engineRouteNotice.description}
              </AlertDescription>
            </Alert>
          )}

          <div className={`relative ${GRADIENT_CLASSES.violet} border border-violet-200 dark:border-violet-800 rounded-2xl p-6 shadow-lg`}>
            <div className="absolute -top-3 left-8 w-6 h-6 bg-violet-50 dark:bg-violet-950/30 border-l border-t border-violet-200 dark:border-violet-800 transform rotate-45"></div>
            <div className="flex items-start gap-4">
              <Avatar
                className="h-10 w-10 border-2 border-violet-300"
                aria-label="Coveria AI Assistant"
              >
                <AvatarFallback className="bg-violet-600 text-white font-bold">C</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-semibold text-violet-700 dark:text-violet-300 mb-1">{t('demand.businessCase.generation.coveriaSays')}:</p>
                <p className="text-foreground italic" data-testid="text-coveria-message">
                  "{currentCoveriaMessage}"
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">{t('demand.businessCase.generation.brainProgress')}</span>
              <span className="font-semibold text-violet-600">
                {completedCount}/{TOTAL_LAYERS} layers
              </span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
          </div>
        </div>

        <div className="space-y-5">
          {generationPhase === GENERATION_PHASES.WAITING_CLARIFICATIONS && clarifications && clarifications.length > 0 ? (
            <ClarificationsForm
              clarifications={clarifications}
              expandedDomains={expandedDomains}
              setExpandedDomains={setExpandedDomains}
              clarificationResponses={clarificationResponses}
              setClarificationResponses={setClarificationResponses}
              generateWithClarificationsMutation={generateWithClarificationsMutation}
            />
          ) : (
            <DecisionBrainPipeline coveriaLayers={coveriaLayers} />
          )}
        </div>
      </div>
    </div>
  );
}

interface ClarificationsFormProps {
  clarifications: ClarificationDomain[];
  expandedDomains: Record<string, boolean>;
  setExpandedDomains: (value: Record<string, boolean>) => void;
  clarificationResponses: Record<string, ClarificationResponse>;
  setClarificationResponses: (value: Record<string, ClarificationResponse>) => void;
  generateWithClarificationsMutation: { mutate: (options?: { bypassClarifications?: boolean }) => void; isPending: boolean };
}

function ClarificationsForm({
  clarifications,
  expandedDomains,
  setExpandedDomains,
  clarificationResponses,
  setClarificationResponses,
  generateWithClarificationsMutation,
}: Readonly<ClarificationsFormProps>) {
  const { t } = useTranslation();
  return (
    <>
      <Alert className={`${GRADIENT_CLASSES.amber} border-amber-200 dark:border-amber-800`}>
        <HelpCircle className="h-4 w-4 text-amber-600" />
        <AlertTitle>{t('demand.businessCase.generation.helpTitle')}</AlertTitle>
        <AlertDescription>
          {t('demand.businessCase.generation.helpDescription')}
        </AlertDescription>
      </Alert>

      <p className="text-sm text-muted-foreground">
        Layer 4 completeness found missing context. Answer these questions to strengthen the draft before AI synthesis, or explicitly override and continue with a lower-confidence draft.
      </p>

      <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
        {clarifications.map((clarification) => (
          <Collapsible
            key={clarification.domain}
            open={expandedDomains[clarification.domain]}
            onOpenChange={(isOpen) => {
              setExpandedDomains({ ...expandedDomains, [clarification.domain]: isOpen });
            }}
          >
            <Card className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{clarification.domain}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {clarification.questions?.length || 0} questions
                    </span>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" aria-label={expandedDomains[clarification.domain] ? "Collapse" : "Expand"}>
                      {expandedDomains[clarification.domain] ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-3">
                  {clarification.questions?.map((q, idx) => {
                    const key = getClarificationKey(clarification.domain, idx);
                    return (
                      <div key={key} className="space-y-2">
                        <Label className="text-sm font-medium">{q.question}</Label>
                        {q.context && (
                          <p className="text-xs text-muted-foreground">{q.context}</p>
                        )}
                        <Textarea
                          placeholder={t('demand.businessCase.generation.yourAnswer')}
                          value={clarificationResponses[key]?.answer || ''}
                          onChange={(e) => {
                            setClarificationResponses({
                              ...clarificationResponses,
                              [key]: {
                                domain: clarification.domain,
                                questionId: idx,
                                answer: e.target.value
                              }
                            });
                          }}
                          className="min-h-20"
                          data-testid={`input-clarification-${clarification.domain}-${idx}`}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          onClick={() => generateWithClarificationsMutation.mutate()}
          disabled={generateWithClarificationsMutation.isPending || !Object.values(clarificationResponses).some((r) => r.answer.trim() !== '')}
          className={`flex-1 ${GRADIENT_CLASSES.primary}`}
          data-testid="button-continue-generation"
        >
          {generateWithClarificationsMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('demand.businessCase.generation.generating')}
            </>
          ) : (
            <>
              <TrendingUp className="mr-2 h-4 w-4" />
              Generate With My Answers
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => generateWithClarificationsMutation.mutate({ bypassClarifications: true })}
          disabled={generateWithClarificationsMutation.isPending}
          className="flex-1"
          data-testid="button-bypass-clarifications"
        >
          Continue With Override
        </Button>
      </div>
    </>
  );
}

// Layer icon mapping
const LAYER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  intake: Briefcase,
  governance: Shield,
  readiness: Gauge,
  routing: Route,
  reasoning: Cpu,
  synthesis: Layers,
  recording: BookOpen,
  learning: GraduationCap,
};

// Layer label mapping
const LAYER_LABELS: Record<string, string> = {
  intake: 'Intake',
  governance: 'Governance',
  readiness: 'Readiness',
  routing: 'Routing',
  reasoning: 'Reasoning',
  synthesis: 'Synthesis',
  recording: 'Recording',
  learning: 'Learning',
};

// Get status icon based on layer status
function getStatusIcon(
  status: string,
  DefaultIcon: React.ComponentType<{ className?: string }>
): React.ReactNode {
  const iconClass = "h-4 w-4";

  switch (status) {
    case LAYER_STATUS.COMPLETED:
      return <CheckCircle2 className={iconClass} />;
    case LAYER_STATUS.IN_PROGRESS:
      return <Loader2 className={`${iconClass} animate-spin`} />;
    case LAYER_STATUS.BLOCKED:
      return <AlertTriangle className={iconClass} />;
    default:
      return <DefaultIcon className={iconClass} />;
  }
}

function DecisionBrainPipeline({ coveriaLayers }: Readonly<{ coveriaLayers: LayerNarration[] }>) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <HexagonLogoFrame px={20} />
        <h3 className="font-semibold text-lg">{t('demand.businessCase.generation.pipelineTitle')}</h3>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {coveriaLayers.map((layer) => {
          const Icon = LAYER_ICONS[layer.layer] || Brain;

          return (
            <div
              key={layer.layer}
              className={getLayerClassName(layer.status)}
              data-testid={`layer-${layer.layer}`}
            >
              <div className={getIconClassName(layer.status)}>
                {getStatusIcon(layer.status, Icon)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{LAYER_LABELS[layer.layer] || layer.layer}</p>
                  <Badge
                    variant="outline"
                    className={getBadgeClassName(layer.status)}
                  >
                    {STATUS_LABELS[layer.status] || 'Pending'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2" data-testid={`message-${layer.layer}`}>
                  {layer.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className={`flex items-start gap-3 p-4 rounded-lg ${GRADIENT_CLASSES.violet} border border-violet-200 dark:border-violet-800 mt-4`}>
        <Lightbulb className="h-5 w-5 text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm mb-1">{t('demand.businessCase.generation.enterpriseBrainTitle')}</p>
          <p className="text-xs text-muted-foreground">
            Your request is being processed through our {TOTAL_LAYERS}-layer governance-first decision infrastructure,
            ensuring compliance with UAE Vision 2071 objectives.
          </p>
        </div>
      </div>
    </>
  );
}
