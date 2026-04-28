import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { CheckCircle, CheckCircle2, Lightbulb, Loader2, Settings, ShieldCheck, Target } from 'lucide-react';
import { VideoLogo } from '@/components/ui/video-logo';

export interface DetailedRequirementsGenerationProgress {
  message: string;
  percentage: number;
  step: number;
  elapsedSeconds: number;
  startTime: number;
}

interface DetailedRequirementsEmptyStateProps {
  isGenerating: boolean;
  generationProgress: DetailedRequirementsGenerationProgress | null;
}

export function DetailedRequirementsEmptyState({
  isGenerating,
  generationProgress,
}: DetailedRequirementsEmptyStateProps) {
  const { t } = useTranslation();
  const currentStep = generationProgress?.step || 0;

  return (
    <Card className="flex-1 border-2 flex flex-col overflow-hidden">
      {isGenerating ? (
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="relative w-fit mx-auto lg:mx-0">
                <VideoLogo size="lg" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 animate-spin" style={{ animationDuration: '3s' }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-purple-400 rounded-full shadow-lg"></div>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-400 rounded-full shadow-lg"></div>
                </div>
              </div>

              <div className="text-center lg:text-left space-y-4">
                <h2 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  {t('demand.tabs.requirements.aiRequirementsAnalysis')}
                </h2>
                <p className="text-lg text-muted-foreground">
                  {t('demand.tabs.requirements.aiAnalyzingDescription')}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">
                    {generationProgress ? t('demand.tabs.requirements.progress.elapsed', { seconds: generationProgress.elapsedSeconds }) : t('demand.tabs.requirements.progress.analysisProgress')}
                  </span>
                  <span className="font-semibold text-primary">
                    {generationProgress
                      ? t('demand.tabs.requirements.progress.remaining', { percentage: generationProgress.percentage, seconds: Math.max(0, 50 - generationProgress.elapsedSeconds) })
                      : t('demand.tabs.requirements.progress.estimated')}
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${generationProgress?.percentage || 5}%` }}
                  />
                </div>
                {generationProgress && (
                  <div className="text-xs text-muted-foreground text-center">
                    {generationProgress.message}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-300 ${
                currentStep >= 1
                  ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800'
                  : 'bg-muted/50 border opacity-50'
              }`}>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  currentStep >= 1 ? 'bg-blue-500' : 'bg-muted'
                }`}>
                  {currentStep > 1 ? (
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  ) : (
                    <CheckCircle2 className={`h-5 w-5 ${currentStep >= 1 ? 'text-white' : 'text-muted-foreground'}`} />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{t('demand.tabs.requirements.progress.analyzingDemand')}</p>
                  <p className="text-xs text-muted-foreground">{t('demand.tabs.requirements.progress.extractingRequirements')}</p>
                </div>
                {currentStep === 1 && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                {currentStep > 1 && <CheckCircle className="h-4 w-4 text-green-500" />}
              </div>

              <div className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-300 ${
                currentStep >= 2
                  ? 'bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border border-purple-200 dark:border-purple-800'
                  : 'bg-muted/50 border opacity-50'
              }`}>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  currentStep >= 2 ? 'bg-purple-500' : 'bg-muted'
                }`}>
                  <Target className={`h-5 w-5 ${currentStep >= 2 ? 'text-white' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{t('demand.tabs.requirements.progress.identifyingCapabilities')}</p>
                  <p className="text-xs text-muted-foreground">{t('demand.tabs.requirements.progress.mappingCapabilities')}</p>
                </div>
                {currentStep === 2 && <Loader2 className="h-4 w-4 animate-spin text-purple-600" />}
                {currentStep > 2 && <CheckCircle className="h-4 w-4 text-green-500" />}
              </div>

              <div className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-300 ${
                currentStep >= 3
                  ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-muted/50 border opacity-50'
              }`}>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  currentStep >= 3 ? 'bg-emerald-500' : 'bg-muted'
                }`}>
                  <Settings className={`h-5 w-5 ${currentStep >= 3 ? 'text-white' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{t('demand.tabs.requirements.progress.generatingRequirements')}</p>
                  <p className="text-xs text-muted-foreground">{t('demand.tabs.requirements.progress.creatingRequirements')}</p>
                </div>
                {currentStep === 3 && <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />}
                {currentStep > 3 && <CheckCircle className="h-4 w-4 text-green-500" />}
              </div>

              <div className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-300 ${
                currentStep >= 4
                  ? 'bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800'
                  : 'bg-muted/50 border opacity-50'
              }`}>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  currentStep >= 4 ? 'bg-amber-500' : 'bg-muted'
                }`}>
                  <ShieldCheck className={`h-5 w-5 ${currentStep >= 4 ? 'text-white' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{t('demand.tabs.requirements.progress.securityAnalysis')}</p>
                  <p className="text-xs text-muted-foreground">{t('demand.tabs.requirements.progress.applyingSecurity')}</p>
                </div>
                {currentStep === 4 && <Loader2 className="h-4 w-4 animate-spin text-amber-600" />}
                {currentStep > 4 && <CheckCircle className="h-4 w-4 text-green-500" />}
              </div>

              <div className="flex items-start gap-3 p-5 rounded-lg bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800">
                <Lightbulb className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1.5">{t('demand.tabs.requirements.progress.aiPoweredAnalysis')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('demand.tabs.requirements.progress.aiPoweredDescription')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="text-center space-y-6 max-w-2xl">
            <VideoLogo size="md" className="mx-auto" />
            <div>
              <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
                {t('demand.tabs.requirements.aiPoweredRequirementsAnalysis')}
              </h2>
              <p className="text-lg text-muted-foreground">
                {t('demand.tabs.requirements.generateComprehensiveDescription')}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}