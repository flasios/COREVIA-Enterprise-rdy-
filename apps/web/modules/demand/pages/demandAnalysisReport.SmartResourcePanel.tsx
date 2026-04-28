import { useState, useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { DemandReport, Specialist, WorkflowUpdateData } from "./demandAnalysisReport.types";
import {
  Sparkles, Lightbulb, CheckCircle, CalendarClock, Loader2, ArrowRight,
  Users, DollarSign, Shield, Settings, Calendar, Briefcase, Gauge,
  AlertTriangle, TrendingDown, BarChart3, Send,
} from "lucide-react";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";

// ============================================================================
// SMART RESOURCE PANEL COMPONENT (COREVIA Decision Panel)
// ============================================================================

interface SmartResourcePanelProps {
  report: DemandReport;
  showSmartPanel: boolean;
  setShowSmartPanel: (show: boolean) => void;
  updateWorkflowMutation: { mutate: (data: WorkflowUpdateData) => void; isPending: boolean };
  id: string;
  toast: (props: { title?: string; description?: string; variant?: "default" | "destructive" }) => void;
}

export function SmartResourcePanel({
  report,
  showSmartPanel,
  setShowSmartPanel,
  updateWorkflowMutation,
  id,
  toast,
}: SmartResourcePanelProps) {
  // ALL HOOKS MUST BE AT TOP - unconditionally called
  const { t } = useTranslation();
  const [notificationSent, setNotificationSent] = useState(false);
  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null);

  // COREVIA's specialist recommendation - memoized to prevent recalculation
  const specialistRecommendation = useMemo(() => {
    const urgency = report?.urgency?.toLowerCase() || 'medium';
    const budgetRange = report?.budgetRange?.toLowerCase() || '';
    const objective = report?.businessObjective?.toLowerCase() || '';

    if (budgetRange.includes('million') || budgetRange.includes('large') || objective.includes('budget') || objective.includes('cost')) {
      return { role: 'finance_analyst', displayName: 'Finance Analyst', reason: "This demand involves significant budget considerations. I recommend engaging our Finance Analyst for proper cost-benefit analysis and budget allocation review.", icon: DollarSign };
    }
    if (objective.includes('security') || objective.includes('compliance') || objective.includes('risk') || objective.includes('audit')) {
      return { role: 'security_analyst', displayName: 'Security Analyst', reason: "I've detected security and compliance elements in this request. Our Security Analyst should review the requirements to ensure proper safeguards.", icon: Shield };
    }
    if (objective.includes('technical') || objective.includes('system') || objective.includes('infrastructure') || objective.includes('integration')) {
      return { role: 'technical_analyst', displayName: 'Technical Analyst', reason: "This demand has significant technical implications. I suggest involving our Technical Analyst to assess feasibility and architecture requirements.", icon: Settings };
    }
    if (objective.includes('project') || objective.includes('timeline') || objective.includes('delivery') || objective.includes('milestone')) {
      return { role: 'project_analyst', displayName: 'Project Analyst', reason: "Project planning and delivery coordination is crucial here. Our Project Analyst should be notified to help structure the implementation roadmap.", icon: Calendar };
    }
    if (urgency === 'high' || urgency === 'critical') {
      return { role: 'business_analyst', displayName: 'Business Analyst', reason: "Given the high urgency of this request, I recommend immediate engagement with our Business Analyst to expedite requirements clarification.", icon: Briefcase };
    }
    return { role: 'business_analyst', displayName: 'Business Analyst', reason: "Based on my analysis, this demand would benefit from Business Analyst review to ensure alignment with organizational objectives.", icon: Briefcase };
  }, [report?.urgency, report?.budgetRange, report?.businessObjective]);

  const SpecialistIcon = specialistRecommendation.icon;

  // Query specialists by role - stable query key
  const { data: specialistsData, isLoading: specialistsLoading } = useQuery({
    queryKey: ['/api/users', 'role', specialistRecommendation.role],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/users?role=${specialistRecommendation.role}`);
      return response.json();
    },
    enabled: showSmartPanel,
  });

  const specialists = specialistsData?.data || specialistsData || [];
  const primarySpecialist = selectedSpecialist || (Array.isArray(specialists) && specialists.length > 0 ? specialists[0] : null);

  // Mutation to notify specialist
  const notifySpecialistMutation = useMutation({
    mutationFn: async () => {
      if (!primarySpecialist) throw new Error("No specialist found");
      const response = await apiRequest("POST", `/api/demand-reports/${id}/coveria-notify-specialist`, {
        specialistEmail: primarySpecialist.email,
        specialistName: primarySpecialist.displayName || primarySpecialist.username,
        specialistRole: specialistRecommendation.role,
        coveriaInsight: specialistRecommendation.reason
      });
      return response.json();
    },
    onSuccess: () => {
      setNotificationSent(true);
      toast({
        title: t('demand.analysis.smartResource.specialistNotified'),
        description: t('demand.analysis.smartResource.specialistNotifiedDesc', { name: primarySpecialist?.displayName || primarySpecialist?.username }),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('demand.analysis.smartResource.notificationFailed'),
        description: error.message || t('demand.analysis.smartResource.notificationFailedDesc'),
        variant: "destructive",
      });
    }
  });

  // Animation variants for staggered reveal
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    }
  };

  const pulseVariants = {
    initial: { scale: 1, boxShadow: "0 0 0 0 rgba(139, 92, 246, 0)" },
    pulse: {
      scale: [1, 1.02, 1],
      boxShadow: [
        "0 0 0 0 rgba(139, 92, 246, 0.4)",
        "0 0 20px 4px rgba(139, 92, 246, 0.2)",
        "0 0 0 0 rgba(139, 92, 246, 0)"
      ],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  // Coveria personality phrases - memoized to prevent jittery UI on re-renders
  const randomPhrase = useMemo(() => {
    const coveriaPhrases = [
      "Brilliant! Based on my analysis...",
      "Rather interesting findings here...",
      "Splendid! Let me share my insights...",
      "Shall we proceed with confidence?"
    ];
    return coveriaPhrases[Math.floor(Math.random() * coveriaPhrases.length)];
  }, []);

  // Resource metrics - derived from actual report data
  const resourceMetrics = useMemo(() => {
    const urgency = report?.urgency?.toLowerCase() || 'medium';
    const budgetRange = report?.budgetRange || '';
    const timeframe = report?.timeframe || '';

    // Derive capacity from urgency and report context
    const urgencyCapacity = urgency === 'critical' ? 15 : urgency === 'high' ? 25 : urgency === 'low' ? 55 : 35;

    // Derive budget utilization from budgetRange
    let budgetUtil = 50;
    if (budgetRange) {
      const lower = budgetRange.toLowerCase();
      if (lower.includes('high') || lower.includes('large') || lower.includes('>1m') || lower.includes('million')) budgetUtil = 80;
      else if (lower.includes('medium') || lower.includes('500k') || lower.includes('moderate')) budgetUtil = 55;
      else if (lower.includes('low') || lower.includes('small') || lower.includes('<100k')) budgetUtil = 30;
    }

    // Derive timeline from timeframe
    let timelineUtil = 40;
    if (timeframe) {
      const lower = timeframe.toLowerCase();
      if (lower.includes('immediate') || lower.includes('urgent') || lower.includes('1 month') || lower.includes('asap')) timelineUtil = 85;
      else if (lower.includes('quarter') || lower.includes('3 month') || lower.includes('90 day')) timelineUtil = 60;
      else if (lower.includes('year') || lower.includes('12 month') || lower.includes('long')) timelineUtil = 25;
    }

    return {
      teamCapacity: {
        current: 100 - urgencyCapacity,
        available: urgencyCapacity,
        allocated: 100 - urgencyCapacity,
        label: 'Team Capacity',
      },
      budgetUtilization: {
        current: budgetUtil,
        available: 100 - budgetUtil,
        allocated: budgetUtil,
        label: 'Budget Utilization',
      },
      timelineSlots: {
        current: timelineUtil,
        available: 100 - timelineUtil,
        allocated: timelineUtil,
        label: 'Timeline Availability',
      },
      _dataSource: 'derived' as const
    };
  }, [report?.urgency, report?.budgetRange, report?.timeframe]);

  const getAIRecommendation = () => {
    const urgency = report?.urgency?.toLowerCase() || 'medium';

    if (urgency === 'high' || urgency === 'critical') {
      if (resourceMetrics.teamCapacity.available >= 20) {
        return {
          action: 'acknowledge',
          label: 'Acknowledge & Implement This Year',
          confidence: 87,
          reasoning: 'High priority request with sufficient team capacity available. Recommend immediate acknowledgment to begin implementation within current fiscal year.',
          color: 'from-emerald-500 to-green-600',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-300 dark:border-emerald-700',
          icon: CheckCircle
        };
      } else {
        return {
          action: 'defer',
          label: 'Defer to Q1 Next Year',
          confidence: 72,
          reasoning: 'High priority but current team capacity is constrained. Recommend deferring to Q1 next year when resources become available.',
          color: 'from-amber-500 to-orange-600',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-300 dark:border-amber-700',
          icon: CalendarClock
        };
      }
    } else if (urgency === 'low') {
      return {
        action: 'defer',
        label: 'Defer to Upcoming Years',
        confidence: 91,
        reasoning: 'Low priority request can be scheduled for future planning cycles. Current resources should focus on higher priority initiatives.',
        color: 'from-blue-500 to-indigo-600',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-300 dark:border-blue-700',
        icon: CalendarClock
      };
    } else {
      if (resourceMetrics.budgetUtilization.available >= 30 && resourceMetrics.teamCapacity.available >= 15) {
        return {
          action: 'acknowledge',
          label: 'Acknowledge & Plan Implementation',
          confidence: 79,
          reasoning: 'Medium priority with adequate resources available. Recommend acknowledgment to begin planning and implementation assessment.',
          color: 'from-emerald-500 to-green-600',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-300 dark:border-emerald-700',
          icon: CheckCircle
        };
      } else {
        return {
          action: 'defer',
          label: 'Defer to Next Quarter',
          confidence: 68,
          reasoning: 'Resource constraints suggest deferring to next quarter when capacity improves. Monitor resource availability for earlier implementation.',
          color: 'from-amber-500 to-orange-600',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-300 dark:border-amber-700',
          icon: CalendarClock
        };
      }
    }
  };

  const recommendation = getAIRecommendation();
  const RecommendationIcon = recommendation.icon;

  return (
    <Sheet open={showSmartPanel} onOpenChange={setShowSmartPanel}>
      <SheetContent side="left" className="w-[400px] sm:w-[540px] overflow-y-auto bg-gradient-to-b from-violet-50/30 via-background to-purple-50/20 dark:from-violet-950/20 dark:via-background dark:to-purple-950/10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <SheetHeader className="pb-4">
            <motion.div variants={itemVariants}>
              <SheetTitle className="flex items-center gap-3">
                <motion.div
                  className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/25"
                  variants={pulseVariants}
                  initial="initial"
                  animate="pulse"
                >
                  <Sparkles className="h-5 w-5 text-white" />
                </motion.div>
                <div>
                  <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent font-bold">
                    COREVIA's Decision Panel
                  </span>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">{t('demand.analysis.smartResource.strategicIntelligenceAdvisor')}</p>
                </div>
              </SheetTitle>
            </motion.div>
            <motion.div variants={itemVariants}>
              <SheetDescription className="flex items-center gap-2 mt-2">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                  C
                </div>
                <span className="italic text-violet-700 dark:text-violet-400">{randomPhrase}</span>
              </SheetDescription>
            </motion.div>
          </SheetHeader>

          <div className="space-y-5 py-4">
            {/* AI Recommendation Card */}
            <motion.div variants={itemVariants}>
              <motion.div
                variants={pulseVariants}
                initial="initial"
                animate="pulse"
              >
                <Card className={`${recommendation.borderColor} ${recommendation.bgColor} overflow-hidden`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-purple-500/5 pointer-events-none" />
                  <CardHeader className="pb-3 relative">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                          <HexagonLogoFrame px={14} />
                        </div>
                        COREVIA's Recommendation
                      </CardTitle>
                      <Badge className="bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-700 dark:text-violet-300 border-violet-300/50">
                        <Sparkles className="h-3 w-3 mr-1" />
                        {recommendation.confidence}% {t('demand.analysis.smartResource.confidence')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 relative">
                    <motion.div
                      className={`p-4 rounded-xl bg-gradient-to-br ${recommendation.color} text-white shadow-lg`}
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <RecommendationIcon className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-xs opacity-90 uppercase tracking-wide font-medium">{t('demand.analysis.smartResource.suggestedAction')}</p>
                          <p className="font-bold text-lg">{recommendation.label}</p>
                        </div>
                      </div>
                    </motion.div>

                    <div className="p-3 rounded-xl bg-gradient-to-br from-violet-50/50 to-purple-50/50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200/30 dark:border-violet-800/30">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        <Lightbulb className="h-4 w-4 inline-block mr-1.5 text-violet-500" />
                        {recommendation.reasoning}
                      </p>
                    </div>

                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={() => {
                          if (recommendation.action === 'acknowledge') {
                            updateWorkflowMutation.mutate({
                              workflowStatus: 'acknowledged',
                              decisionReason: `COREVIA AI-assisted decision: ${recommendation.reasoning}`
                            });
                          } else {
                            updateWorkflowMutation.mutate({
                              workflowStatus: 'deferred',
                              decisionReason: `COREVIA AI-assisted decision: ${recommendation.reasoning}`
                            });
                          }
                          setShowSmartPanel(false);
                        }}
                        disabled={updateWorkflowMutation.isPending}
                        className={`w-full bg-gradient-to-r ${recommendation.color} hover:opacity-90 shadow-lg`}
                        data-testid="button-apply-ai-recommendation"
                      >
                        {updateWorkflowMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            {t('demand.analysis.smartResource.applyingAdvice')}
                          </>
                        ) : (
                          <>
                            <ArrowRight className="h-4 w-4 mr-2" />
                            {t('demand.analysis.smartResource.applyRecommendation')}
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>

            {/* Resource Capacity Analysis */}
            <motion.div variants={itemVariants}>
              <Card className="border-violet-200/30 dark:border-violet-800/30 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 via-transparent to-violet-500/3 pointer-events-none" />
                <CardHeader className="pb-3 relative">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <BarChart3 className="h-3.5 w-3.5 text-white" />
                      </div>
                      Resource Capacity Analysis
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                      Estimated
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{t('demand.analysis.smartResource.capacityEstimatesDesc')}</p>
                </CardHeader>
                <CardContent className="space-y-4 relative">
                  <div className="space-y-3">
                    <motion.div
                      className="space-y-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/30 dark:border-blue-800/30"
                      whileHover={{ scale: 1.01 }}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-500" />
                          {t('demand.analysis.smartResource.teamCapacity')}
                        </span>
                        <span className="font-semibold text-blue-700 dark:text-blue-300">{t('demand.analysis.smartResource.percentAvailable', { value: resourceMetrics.teamCapacity.available })}</span>
                      </div>
                      <Progress value={resourceMetrics.teamCapacity.allocated} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{t('demand.analysis.smartResource.percentAllocated', { value: resourceMetrics.teamCapacity.allocated })}</span>
                        <span className="text-emerald-600 font-medium">{t('demand.analysis.smartResource.percentFree', { value: resourceMetrics.teamCapacity.available })}</span>
                      </div>
                    </motion.div>

                    <motion.div
                      className="space-y-2 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/30 dark:border-emerald-800/30"
                      whileHover={{ scale: 1.01 }}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-emerald-500" />
                          {t('demand.analysis.smartResource.budgetUtilization')}
                        </span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">{t('demand.analysis.smartResource.percentAvailable', { value: resourceMetrics.budgetUtilization.available })}</span>
                      </div>
                      <Progress value={resourceMetrics.budgetUtilization.allocated} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{t('demand.analysis.smartResource.percentCommitted', { value: resourceMetrics.budgetUtilization.allocated })}</span>
                        <span className="text-emerald-600 font-medium">{t('demand.analysis.smartResource.percentRemaining', { value: resourceMetrics.budgetUtilization.available })}</span>
                      </div>
                    </motion.div>

                    <motion.div
                      className="space-y-2 p-3 rounded-lg bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/30 dark:border-violet-800/30"
                      whileHover={{ scale: 1.01 }}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4 text-violet-500" />
                          {t('demand.analysis.smartResource.timelineAvailability')}
                        </span>
                        <span className="font-semibold text-violet-700 dark:text-violet-300">{t('demand.analysis.smartResource.percentAvailable', { value: resourceMetrics.timelineSlots.available })}</span>
                      </div>
                      <Progress value={resourceMetrics.timelineSlots.allocated} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{t('demand.analysis.smartResource.percentScheduled', { value: resourceMetrics.timelineSlots.allocated })}</span>
                        <span className="text-emerald-600 font-medium">{t('demand.analysis.smartResource.percentOpen', { value: resourceMetrics.timelineSlots.available })}</span>
                      </div>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Risk Assessment Card */}
            <motion.div variants={itemVariants}>
              <Card className="border-amber-200/50 dark:border-amber-800/50 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5 pointer-events-none" />
                <CardHeader className="pb-2 relative">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <AlertTriangle className="h-3.5 w-3.5 text-white" />
                    </div>
                    {t('demand.analysis.smartResource.riskAssessment')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <div className="space-y-2">
                    {resourceMetrics.teamCapacity.available < 25 && (
                      <motion.div
                        className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 p-2 rounded-lg bg-amber-100/50 dark:bg-amber-900/20"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <TrendingDown className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{t('demand.analysis.smartResource.limitedTeamCapacity')}</span>
                      </motion.div>
                    )}
                    {resourceMetrics.budgetUtilization.available < 30 && (
                      <motion.div
                        className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 p-2 rounded-lg bg-amber-100/50 dark:bg-amber-900/20"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                      >
                        <TrendingDown className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{t('demand.analysis.smartResource.budgetConstraints')}</span>
                      </motion.div>
                    )}
                    {report?.urgency?.toLowerCase() === 'high' && (
                      <motion.div
                        className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 p-2 rounded-lg bg-amber-100/50 dark:bg-amber-900/20"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        <Gauge className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{t('demand.analysis.smartResource.highUrgencyRisk')}</span>
                      </motion.div>
                    )}
                    {resourceMetrics.teamCapacity.available >= 25 && resourceMetrics.budgetUtilization.available >= 30 && (
                      <motion.div
                        className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 p-2 rounded-lg bg-emerald-100/50 dark:bg-emerald-900/20"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{t('demand.analysis.smartResource.noSignificantRisks')}</span>
                      </motion.div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* COREVIA's Agentic Specialist Notification */}
            <motion.div variants={itemVariants}>
              <Card className="border-violet-200/50 dark:border-violet-800/50 bg-gradient-to-br from-violet-50/50 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-purple-500/5 pointer-events-none" />
                <CardHeader className="pb-2 relative">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Send className="h-3.5 w-3.5 text-white" />
                    </div>
                    {t('demand.analysis.smartResource.specialistNotificationTitle')}
                    {notificationSent && (
                      <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 ml-auto">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {t('demand.analysis.smartResource.sent')}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 relative">
                  {/* COREVIA's reasoning */}
                  <div className="p-3 rounded-lg bg-violet-100/50 dark:bg-violet-900/20 border border-violet-200/30 dark:border-violet-800/30">
                    <div className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                        C
                      </div>
                      <p className="text-xs text-violet-700 dark:text-violet-300 italic">
                        "{specialistRecommendation.reason}"
                      </p>
                    </div>
                  </div>

                  {/* Specialist Info */}
                  {specialistsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                      <span className="ml-2 text-sm text-muted-foreground">{t('demand.analysis.smartResource.findingSpecialist')}</span>
                    </div>
                  ) : primarySpecialist ? (
                    <motion.div
                      className="p-3 rounded-lg bg-background/50 border border-violet-200/30 dark:border-violet-800/30"
                      whileHover={{ scale: 1.01 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                          {(primarySpecialist.displayName || primarySpecialist.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {primarySpecialist.displayName || primarySpecialist.username}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{primarySpecialist.email}</p>
                          <Badge className="mt-1 bg-violet-500/10 text-violet-700 dark:text-violet-300 text-[10px]">
                            <SpecialistIcon className="h-2.5 w-2.5 mr-1" />
                            {specialistRecommendation.displayName}
                          </Badge>
                        </div>
                      </div>
                      {/* Show other specialists if available */}
                      {Array.isArray(specialists) && specialists.length > 1 && (
                        <div className="mt-2 pt-2 border-t border-violet-200/20 dark:border-violet-800/20">
                          <Select
                            value={selectedSpecialist?.id?.toString() || ''}
                            onValueChange={(val) => {
                              const found = (specialists as Specialist[]).find((s: Specialist) => s.id?.toString() === val);
                              if (found) setSelectedSpecialist(found);
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder={t('demand.analysis.smartResource.chooseDifferentSpecialist')} />
                            </SelectTrigger>
                            <SelectContent>
                              {(specialists as Specialist[]).map((s: Specialist) => (
                                <SelectItem key={s.id} value={s.id?.toString()}>
                                  {s.displayName || s.username} ({s.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/30 dark:border-amber-800/30">
                      <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {t('demand.analysis.smartResource.noSpecialistFound', { role: specialistRecommendation.displayName })}
                      </p>
                    </div>
                  )}

                  {/* Notify Button */}
                  <Button
                    onClick={() => notifySpecialistMutation.mutate()}
                    disabled={notifySpecialistMutation.isPending || notificationSent || !primarySpecialist}
                    className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                    data-testid="button-coveria-notify-specialist"
                  >
                    {notifySpecialistMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        {t('demand.analysis.smartResource.sendingNotification')}
                      </>
                    ) : notificationSent ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {t('demand.analysis.smartResource.notificationSent')}
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        {t('demand.analysis.smartResource.notifySpecialist', { name: primarySpecialist?.displayName || primarySpecialist?.username || t('demand.analysis.smartResource.specialist') })}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* COREVIA footer */}
            <motion.div variants={itemVariants}>
              <div className="p-4 rounded-xl bg-gradient-to-br from-violet-100/50 via-purple-50/30 to-fuchsia-100/50 dark:from-violet-950/30 dark:via-purple-950/20 dark:to-fuchsia-950/30 border border-violet-200/40 dark:border-violet-800/40">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-500/25">
                    C
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-violet-700 dark:text-violet-300">{t('demand.analysis.smartResource.coreviaSays')}:</p>
                    <p className="text-sm text-muted-foreground italic">"{t('demand.analysis.smartResource.proceedConfident')}"</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}
