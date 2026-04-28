import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuthorization } from "@/hooks/useAuthorization";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  TrendingUp,
  FileText,
  Target,
  Users as _Users,
  Shield,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  BarChart3,
  Clock,
  Zap,
  Globe,
  Award,
  Layers,
  Play,
  ChevronRight as _ChevronRight,
  Star as _Star,
  Building2,
  Lightbulb,
  MessageSquare,
  Settings,
  Activity
} from "lucide-react";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";

export default function DemandProductHome() {
  const [activeFeature, setActiveFeature] = useState(0);
  const { t } = useTranslation();
  const { canAccess: canAccessBrain } = useAuthorization({ requiredPermissions: ["brain:view"] });

  const { data: demandStats } = useQuery<{
    total: number; pending: number; approved: number; inReview: number;
    converted: number; rejected: number; pendingApproval: number;
    createdThisMonth: number; avgProcessingDays: number; slaCompliancePercent: number;
    priorityHigh: number; priorityMedium: number; priorityLow: number; priorityCritical: number;
  }>({
    queryKey: ["/api/demand-reports/stats"],
    queryFn: () => apiRequest("GET", "/api/demand-reports/stats").then(r => r.json()),
  });

  const { data: portfolioRes } = useQuery<{ success?: boolean; data?: { totalBudget: number } }>({
    queryKey: ["/api/portfolio/stats"],
    queryFn: () => apiRequest("GET", "/api/portfolio/stats").then(r => r.json()),
  });

  const demandTotal = demandStats?.total ?? 0;
  const approvalRate = demandTotal > 0
    ? Math.round((demandStats!.approved / demandTotal) * 100)
    : 0;
  const avgDays = demandStats?.avgProcessingDays ?? 0;
  const portfolioValue = portfolioRes?.data?.totalBudget ?? 0;

  const stats = [
    { value: String(demandTotal), label: t('demand.productHome.demandsProcessed'), icon: <FileText className="h-5 w-5" /> },
    { value: `${approvalRate}%`, label: t('demand.productHome.approvalRate'), icon: <CheckCircle2 className="h-5 w-5" /> },
    { value: `${avgDays}d`, label: t('demand.productHome.avgProcessing'), icon: <Clock className="h-5 w-5" /> },
    { value: portfolioValue > 0 ? `AED ${(portfolioValue / 1e6).toFixed(1)}M` : "AED 0", label: t('demand.productHome.portfolioValue'), icon: <TrendingUp className="h-5 w-5" /> },
  ];

  const features = [
    {
      id: "ai-intake",
      title: t('demand.productHome.title'),
      description: t('demand.productHome.aiIntakeDescription'),
      icon: <HexagonLogoFrame px={24} />,
      color: "from-violet-500 to-purple-600",
      capabilities: [t('demand.productHome.capabilities.naturalLanguageProcessing'), t('demand.productHome.capabilities.autoClassification'), t('demand.productHome.capabilities.smartValidation'), t('demand.productHome.capabilities.duplicateDetection')]
    },
    {
      id: "business-case",
      title: t('demand.productHome.aiBusinessCase'),
      description: t('demand.productHome.aiBusinessCaseDescription'),
      icon: <BarChart3 className="h-6 w-6" />,
      color: "from-blue-500 to-cyan-600",
      capabilities: [t('demand.productHome.capabilities.npvIrrCalculations'), t('demand.productHome.capabilities.financialArchetypes'), t('demand.productHome.capabilities.riskScoring'), t('demand.productHome.capabilities.investmentVerdicts')]
    },
    {
      id: "strategic-fit",
      title: t('demand.productHome.strategicFitAnalysis'),
      description: t('demand.productHome.strategicFitDescription'),
      icon: <Target className="h-6 w-6" />,
      color: "from-emerald-500 to-teal-600",
      capabilities: [t('demand.productHome.capabilities.visionAlignment'), t('demand.productHome.capabilities.priorityScoring'), t('demand.productHome.capabilities.gapAnalysis'), t('demand.productHome.capabilities.routeRecommendations')]
    },
    {
      id: "requirements",
      title: t('demand.productHome.detailedRequirements'),
      description: t('demand.productHome.requirementsDescription'),
      icon: <Layers className="h-6 w-6" />,
      color: "from-amber-500 to-orange-600",
      capabilities: [t('demand.productHome.capabilities.functionalRequirements'), t('demand.productHome.capabilities.technicalSpecs'), t('demand.productHome.capabilities.integrationPoints'), t('demand.productHome.capabilities.resourceEstimation')],
      link: null
    },
    {
      id: "brain-console",
      title: t('demand.productHome.brainConsole'),
      description: t('demand.productHome.brainConsoleDescription'),
      icon: <Shield className="h-6 w-6" />,
      color: "from-rose-500 to-pink-600",
      capabilities: [t('demand.productHome.capabilities.eightLayerPipeline'), t('demand.productHome.capabilities.threeIntelligenceEngines'), t('demand.productHome.capabilities.policyGovernance'), t('demand.productHome.capabilities.approvalWorkflows')],
      link: "/brain-console"
    },
  ].filter((feature) => feature.id !== "brain-console" || canAccessBrain);

  const workflowSteps = [
    { step: 1, title: t('demand.pipeline.submitRequest'), desc: t('demand.productHome.subtitle'), icon: <MessageSquare className="h-5 w-5" />, color: "bg-blue-500" },
    { step: 2, title: t('demand.productHome.aiAnalysis'), desc: t('demand.productHome.automatedProcessing'), icon: <HexagonLogoFrame px={20} />, color: "bg-purple-500" },
    { step: 3, title: t('demand.productHome.reviewApprove'), desc: t('demand.productHome.multiLevelWorkflow'), icon: <CheckCircle2 className="h-5 w-5" />, color: "bg-amber-500" },
    { step: 4, title: t('demand.productHome.portfolioIntegration'), desc: t('demand.productHome.projectConversion'), icon: <Layers className="h-5 w-5" />, color: "bg-emerald-500" },
  ];

  const useCases = [
    { title: t('demand.productHome.categories.digitalTransformation'), icon: <Globe className="h-5 w-5" />, count: t('demand.productHome.demandsCount', { num: String(demandStats?.priorityHigh ?? 0) }) },
    { title: t('demand.productHome.categories.infrastructureProjects'), icon: <Building2 className="h-5 w-5" />, count: t('demand.productHome.demandsCount', { num: String(demandStats?.priorityMedium ?? 0) }) },
    { title: t('demand.productHome.categories.innovationInitiatives'), icon: <Lightbulb className="h-5 w-5" />, count: t('demand.productHome.demandsCount', { num: String(demandStats?.priorityLow ?? 0) }) },
    { title: t('demand.productHome.categories.processOptimization'), icon: <Settings className="h-5 w-5" />, count: t('demand.productHome.demandsCount', { num: String(demandStats?.priorityCritical ?? 0) }) },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-primary/10 via-violet-500/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-blue-500/10 via-cyan-500/5 to-transparent rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-24">
          {/* Logo Header */}
          <div className="flex items-center justify-center lg:justify-start gap-4 mb-10">
            <div className="relative h-20 w-20 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
              <HexagonLogoFrame size="sm" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 bg-clip-text text-transparent">COREVIA</h2>
              <p className="text-sm text-muted-foreground">{t('demand.productHome.enterpriseIntelligencePlatform')}</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Left Content */}
            <div className="flex-1 text-center lg:text-left">
              <Badge variant="outline" className="mb-6 px-4 py-1.5 text-sm font-medium border-primary/30 bg-primary/5">
                <Sparkles className="h-3.5 w-3.5 mr-2 text-primary" />
                {t('demand.productHome.enterpriseDemandIntelligence')}
              </Badge>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                <span className="bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text">
                  {t('demand.productHome.heroTitleLine1')}
                </span>
                <br />
                <span className="bg-gradient-to-r from-primary via-violet-500 to-blue-500 bg-clip-text text-transparent">
                  {t('demand.productHome.heroTitleLine2')}
                </span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8 leading-relaxed">
                {t('demand.productHome.heroDescription')}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/demand-analysis">
                  <Button size="lg" className="gap-2 px-8 h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all">
                    <Play className="h-4 w-4" />
                    {t('demand.productHome.submitNewDemand')}
                  </Button>
                </Link>
                <Link href="/intelligent-gateway">
                  <Button size="lg" variant="outline" className="gap-2 px-8 h-12 text-base font-semibold">
                    {t('demand.productHome.exploreFeatures')}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Visual */}
            <div className="flex-1 w-full max-w-lg">
              <Link href="/ai-assistant">
              <div className="relative cursor-pointer group">
                {/* Main Card */}
                <Card className="relative z-10 border-2 border-primary/20 shadow-2xl bg-gradient-to-br from-card via-card to-muted/20 transition-transform group-hover:scale-[1.02]">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <HexagonLogoFrame px={24} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{t('demand.productHome.coveriaAiAssistant')}</h3>
                        <p className="text-sm text-muted-foreground">{t('demand.productHome.strategicIntelligenceAdvisor')}</p>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                        <p className="text-sm text-muted-foreground italic">
                          "{t('demand.productHome.sampleUserQuery')}"
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-sm">
                          <span className="text-primary font-medium">{t('demand.productHome.sampleAiResponsePrefix')}</span> {t('demand.productHome.sampleAiResponseBody')}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Badge variant="secondary" className="text-xs">{t('demand.productHome.badgeAutoGenerated')}</Badge>
                      <Badge variant="secondary" className="text-xs">{t('demand.productHome.badgeAiValidated')}</Badge>
                      <Badge variant="secondary" className="text-xs">{t('demand.productHome.badgeReadyToSubmit')}</Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Floating Elements */}
                <div className="absolute -top-4 -right-4 h-20 w-20 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg z-20">
                  <div className="text-center">
                    <div className="text-xl font-bold">{approvalRate}%</div>
                    <div className="text-[10px] opacity-80">{t('demand.productHome.accuracy')}</div>
                  </div>
                </div>

                <div className="absolute -bottom-4 -left-4 h-16 w-32 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg z-20 px-3">
                  <Clock className="h-4 w-4 mr-2" />
                  <div className="text-sm font-semibold">{avgDays}d avg</div>
                </div>
              </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y border-border/50 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center p-4">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 text-primary mb-3">
                  {stat.icon}
                </div>
                <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">{t('demand.productHome.aiPoweredCapabilities')}</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('demand.productHome.completeDemandSuite')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('demand.productHome.completeDemandSuiteDesc')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, idx) => {
              const cardContent = (
                <Card
                  key={feature.id}
                  className={`group cursor-pointer transition-all duration-300 hover:shadow-xl border-2 ${activeFeature === idx ? 'border-primary shadow-lg' : 'border-transparent hover:border-primary/30'}`}
                  onClick={() => setActiveFeature(idx)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white shadow-lg flex-shrink-0`}>
                        {feature.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                          {feature.title}
                        </h3>
                        <p className="text-muted-foreground mb-4">{feature.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {feature.capabilities.map((cap, capIdx) => (
                            <Badge key={capIdx} variant="secondary" className="text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {cap}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
              return feature.link ? (
                <Link key={feature.id} href={feature.link}>
                  {cardContent}
                </Link>
              ) : (
                <div key={feature.id}>{cardContent}</div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">{t('demand.productHome.streamlinedProcess')}</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('demand.productHome.fromRequestToPortfolio')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('demand.productHome.fromRequestToPortfolioDesc')}
            </p>
          </div>

          <div className="relative">
            {/* Connection Line */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 via-amber-500 to-emerald-500 hidden md:block" style={{ transform: 'translateY(-50%)' }} />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
              {workflowSteps.map((step, _idx) => (
                <div key={step.step} className="text-center">
                  <div className={`mx-auto h-16 w-16 rounded-full ${step.color} flex items-center justify-center text-white shadow-lg mb-4`}>
                    {step.icon}
                  </div>
                  <div className="bg-card rounded-xl p-4 border shadow-sm">
                    <div className="text-xs text-muted-foreground mb-1">{t('demand.productHome.stepLabel', { number: step.step })}</div>
                    <h4 className="font-semibold mb-1">{step.title}</h4>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1">
              <Badge variant="outline" className="mb-4">{t('demand.productHome.enterpriseReady')}</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {t('demand.productHome.builtForGovScale')}
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                {t('demand.productHome.builtForGovScaleDesc')}
              </p>

              <div className="grid grid-cols-2 gap-4">
                {useCases.map((useCase, idx) => (
                  <div key={idx} className="p-4 rounded-xl border bg-card hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        {useCase.icon}
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">{useCase.title}</h4>
                        <p className="text-xs text-muted-foreground">{useCase.count}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 w-full max-w-md">
              <Card className="border-2 border-primary/20 shadow-xl">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Award className="h-5 w-5 text-amber-500" />
                    <span className="font-semibold">{t('demand.productHome.governmentExcellence')}</span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm">{t('demand.productHome.uaeVision2071')}</span>
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm">{t('demand.productHome.dubaiPaperless')}</span>
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm">{t('demand.productHome.dgepExcellence')}</span>
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm">{t('demand.productHome.enterpriseDataSecurity')}</span>
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/5 via-violet-500/5 to-blue-500/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t('demand.productHome.ctaTitle')}
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t('demand.productHome.ctaDescription')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/demand-analysis">
              <Button size="lg" className="gap-2 px-8 h-12 text-base font-semibold shadow-lg">
                <Zap className="h-4 w-4" />
                {t('demand.productHome.getStartedNow')}
              </Button>
            </Link>
            <Link href="/intelligent-gateway">
              <Button size="lg" variant="outline" className="gap-2 px-8 h-12 text-base font-semibold">
                <Activity className="h-4 w-4" />
                {t('demand.productHome.viewFullPlatform')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>{t('demand.productHome.footerText')}</p>
        </div>
      </footer>
    </div>
  );
}
