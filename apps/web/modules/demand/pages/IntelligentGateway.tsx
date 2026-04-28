import { useState, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNowStrict } from "date-fns";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, Shield, FileText, CheckCircle2, Search, ChevronRight, X, Send, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { ConstellationLandingLayout, GatewayCard } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { useCreateDemand } from "@/modules/demand";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { frameworksByDimension, getAssessmentSubServices, buildDemandSubServices, buildServices, buildAssessmentServices } from "./intelligentGateway.data";
import DemandWorkspaceContent from "./intelligentGateway.DemandWorkspace";
import AssessmentWorkspaceContent from "./intelligentGateway.AssessmentWorkspace";

export default function IntelligentGateway() {
  const { t } = useTranslation();
  const services = useMemo(() => buildServices(t), [t]);
  const assessmentSvcs = useMemo(() => buildAssessmentServices(t), [t]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedSubService, setSelectedSubService] = useState<string | null>("demand-request-form");
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [mode, setMode] = useState<"landing" | "workspace">("landing");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedAssessmentService, setSelectedAssessmentService] = useState<string>("intelligent-frameworks");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Coveria AI Assistant state - Agentic mode
  const [isCoveriaExpanded, setIsCoveriaExpanded] = useState(false);
  const [isCoveriaAnimating, setIsCoveriaAnimating] = useState(false);
  const [coveriaStep, setCoveriaStep] = useState<'idle' | 'listening' | 'processing' | 'done' | 'error'>('idle');
  const [coveriaInput, setCoveriaInput] = useState('');
  const [coveriaMessages, setCoveriaMessages] = useState<Array<{role: 'assistant' | 'user'; content: string}>>([]);
  const [createdDemandId, setCreatedDemandId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingDemandData, setPendingDemandData] = useState<any>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const coveriaInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createDemandMutation = useCreateDemand();
  const { currentUser } = useAuth();
  const userDemandContext = useMemo(() => {
    const userRecord = (currentUser ?? {}) as Record<string, unknown>;
    const stringValue = (...keys: string[]) => {
      for (const key of keys) {
        const value = userRecord[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
      return "";
    };
    const email = typeof currentUser?.email === "string" ? currentUser.email : "";
    const displayName = typeof currentUser?.displayName === "string" ? currentUser.displayName : "";
    const department = stringValue("departmentName", "department", "businessUnit", "organizationUnit");
    const organizationName = stringValue("organizationName", "organization", "companyName", "agencyName");
    const organizationType = stringValue("organizationType", "industryType");

    return {
      userName: displayName || email || "User",
      requestorEmail: email || undefined,
      department: department || undefined,
      departmentName: department || undefined,
      organizationName: organizationName || undefined,
      organizationType: organizationType || undefined,
    };
  }, [currentUser]);

  const { data: demandStats, dataUpdatedAt: demandStatsUpdatedAt } = useQuery({
    queryKey: ["/api/demand-reports/stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/demand-reports/stats");
      return response.json();
    },
  });

  const demandKpis = useMemo(() => ({
    total: Number(demandStats?.total ?? 0),
    pending: Number(demandStats?.pending ?? 0),
    approved: Number(demandStats?.approved ?? 0),
    converted: Number(demandStats?.converted ?? 0),
    rejected: Number(demandStats?.rejected ?? 0),
    inReview: Number(demandStats?.inReview ?? 0),
    pendingApproval: Number(demandStats?.pendingApproval ?? 0),
    createdThisMonth: Number(demandStats?.createdThisMonth ?? 0),
    avgProcessingDays: Number(demandStats?.avgProcessingDays ?? 0),
    slaCompliancePercent: Number(demandStats?.slaCompliancePercent ?? 0),
    priorityBreakdown: {
      high: Number(demandStats?.priorityHigh ?? 0),
      medium: Number(demandStats?.priorityMedium ?? 0),
      low: Number(demandStats?.priorityLow ?? 0),
      critical: Number(demandStats?.priorityCritical ?? 0),
    }
  }), [demandStats]);
  const queueInCount = demandKpis.pending + demandKpis.inReview;
  const queuePendingApprovalCount = demandKpis.pendingApproval;
  const successRateDenominator = demandKpis.approved + demandKpis.converted + demandKpis.rejected;
  const successRate = successRateDenominator > 0
    ? Math.round(((demandKpis.approved + demandKpis.converted) / successRateDenominator) * 100)
    : 0;
  const lastSyncLabel = demandStatsUpdatedAt
    ? formatDistanceToNowStrict(new Date(demandStatsUpdatedAt), { addSuffix: true })
    : t('demand.gateway.notSynced');

  // Voice/TTS is intentionally disabled in the demand gateway.
  const speakAndWait = async (text: string): Promise<void> => {
    void text;
  };

  // Track if user is speaking Arabic for consistent responses
  const [userLanguage, setUserLanguage] = useState<'en' | 'ar'>('en');

  // Detect if text contains Arabic characters (defined early for use in functions)
  const isArabic = (text: string): boolean => {
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
    return arabicPattern.test(text);
  };

  const isConfirmationOnlyMessage = (text: string): boolean => {
    const normalized = text.toLowerCase().trim();
    const phrases = ['yes', 'confirm', 'submit', 'proceed', 'go ahead', 'do it', 'approved', 'approve', 'yes please submit', 'no', 'cancel', 'stop', 'wait', 'hold', 'decline', 'reject'];
    const arabicPhrases = ['نعم', 'موافق', 'أرسل', 'تابع', 'اوكي', 'حسنا', 'لا', 'الغاء', 'توقف', 'انتظر', 'ارفض'];
    return phrases.includes(normalized) || arabicPhrases.some((phrase) => text.includes(phrase));
  };

  // Agentic: Use AI to generate full demand details with confirmation
  const processCoveriaMessage = async (userMessage: string) => {
    // Detect and remember user's language
    const speaksArabic = isArabic(userMessage);
    if (speaksArabic) setUserLanguage('ar');
    else setUserLanguage('en');

    setIsProcessing(true);
    setCoveriaStep('processing');

    if (!pendingDemandData && isConfirmationOnlyMessage(userMessage)) {
      const noDraftMsg = speaksArabic
        ? "لا يوجد مسودة طلب جاهزة للتقديم. صف طلبك أولاً، ثم سأعرضه عليك للمراجعة قبل أي تقديم."
        : "I do not have a demand draft ready to submit. Describe the demand first, then I will prepare it for review before any submission.";
      setCoveriaMessages(prev => [...prev, { role: 'assistant', content: noDraftMsg }]);
      setCoveriaStep('listening');
      setIsProcessing(false);
      return;
    }

    const processingMsg = speaksArabic
      ? "ممتاز، اسمحي لي بتحليل طلبك وإعداد التفاصيل لمراجعتك."
      : t('demand.gateway.analyzing');
    setCoveriaMessages(prev => [...prev, { role: 'assistant', content: processingMsg }]);
    await speakAndWait(processingMsg);

    try {
      // Call AI to generate all demand fields from the description
      const userName = currentUser?.displayName || currentUser?.email || 'User';
      const generateResponse = await fetch('/api/ai/coveria-generate-demand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          description: userMessage,
          requestorName: userName,
          requestorEmail: userDemandContext.requestorEmail,
          department: userDemandContext.department,
          departmentName: userDemandContext.departmentName,
          organizationName: userDemandContext.organizationName,
          organizationType: userDemandContext.organizationType,
        })
      });

      if (!generateResponse.ok) {
        throw new Error('Failed to generate demand details');
      }

      const { demandData, aiMetadata } = await generateResponse.json();

      // Store pending data and ask for confirmation
      setPendingDemandData(demandData);
      setAwaitingConfirmation(true);
      setCoveriaStep('listening');

      // Build fallback notice if AI was degraded
      const fallbackNotice = aiMetadata?.isFallback
        ? speaksArabic
          ? '\n\n⚠️ *ملاحظة: تم إنشاء التفاصيل بتحليل مبسط لأن مزود الذكاء الاصطناعي غير متوفر مؤقتاً. يمكنك تعديل الحقول بعد التقديم.*'
          : '\n\n⚠️ *Note: Details were generated using simplified analysis as the AI provider is temporarily unavailable. You can edit the fields after submission.*'
        : '';

      // Show professional summary with confirmation request
      const summaryMsg = speaksArabic
        ? `لقد أعددت الطلب التالي لموافقتك:\n\n**المشروع:** ${demandData.suggestedProjectName}\n**الجهة:** ${demandData.organizationName || userDemandContext.organizationName || 'غير محددة'}\n**الإدارة:** ${demandData.department || userDemandContext.department || 'غير محددة'}\n**الإلحاح:** ${demandData.urgency}\n**الميزانية:** ${demandData.budgetRange || 'سيتم تحديدها'}${fallbackNotice}\n\nهل أتابع التقديم؟ قل "نعم" للمتابعة، أو اطلب تعديل أي جزء قبل التقديم، أو قل "لا" للإلغاء.`
        : `I've prepared the following demand for your approval:\n\n**Project:** ${demandData.suggestedProjectName}\n**Organization:** ${demandData.organizationName || userDemandContext.organizationName || 'Not specified'}\n**Department:** ${demandData.department || userDemandContext.department || 'Not specified'}\n**Urgency:** ${demandData.urgency}\n**Budget:** ${demandData.budgetRange || 'To be determined'}\n**Category:** ${demandData.category || 'General'}${fallbackNotice}\n\nShall I proceed with the submission? Say "Yes" to submit, tell me what to change, or say "No" to cancel.`;
      setCoveriaMessages(prev => [...prev, { role: 'assistant', content: summaryMsg }]);

      const speakMsg = speaksArabic
        ? `لقد أعددت الطلب التالي لموافقتك. اسم المشروع: ${demandData.suggestedProjectName}. الإلحاح: ${demandData.urgency}. الميزانية: ${demandData.budgetRange || 'سيتم تحديدها'}. هل أتابع التقديم؟`
        : `I've prepared the following demand for your approval. Project name: ${demandData.suggestedProjectName}. Urgency: ${demandData.urgency}. Budget: ${demandData.budgetRange || 'To be determined'}. Shall I proceed with the submission?`;
      await speakAndWait(speakMsg);

    } catch (error) {
      console.error('[Coveria] Error:', error);
      setCoveriaStep('error');
      const errorMsg = speaksArabic
        ? "أعتذر، واجهنا صعوبة في إنشاء طلبك. يمكنك المحاولة مرة أخرى أو استخدام النموذج العادي."
        : "I do apologise, but we've encountered a difficulty generating your demand. You may try again or use the standard form.";
      setCoveriaMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
      await speakAndWait(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle confirmation response (supports Arabic)
  const handleConfirmationResponse = async (userResponse: string) => {
    const response = userResponse.toLowerCase().trim();
    const speaksArabic = isArabic(userResponse) || userLanguage === 'ar';

    // English and Arabic confirmation/cancel phrases
    const confirmPhrases = ['yes', 'confirm', 'submit', 'proceed', 'go ahead', 'do it', 'approved', 'approve', 'نعم', 'موافق', 'أرسل', 'تابع', 'اوكي', 'حسنا'];
    const cancelPhrases = ['no', 'cancel', 'stop', 'wait', 'hold', 'decline', 'reject', 'لا', 'الغاء', 'توقف', 'انتظر', 'ارفض'];

    const isConfirm = confirmPhrases.some(phrase => response.includes(phrase) || userResponse.includes(phrase));
    const isCancel = cancelPhrases.some(phrase => response.includes(phrase) || userResponse.includes(phrase));

    if (isConfirm && pendingDemandData) {
      setIsProcessing(true);
      setCoveriaStep('processing');

      const submittingMsg = speaksArabic
        ? "ممتاز، جاري تقديم الطلب الآن."
        : t('demand.gateway.submitting');
      setCoveriaMessages(prev => [...prev, { role: 'assistant', content: submittingMsg }]);
      await speakAndWait(submittingMsg);

      try {
        const userName = currentUser?.displayName || currentUser?.email || 'User';
        const demandWithRequestor = {
          ...pendingDemandData,
          organizationName: pendingDemandData.organizationName || userDemandContext.organizationName,
          industryType: pendingDemandData.industryType || userDemandContext.organizationType,
          department: pendingDemandData.department || userDemandContext.department,
          requestorName: `Coveria AI Assistant on behalf of ${userName}`,
          requestorEmail: userDemandContext.requestorEmail || 'coveria@corevia.ae'
        };
        const result = await createDemandMutation.mutateAsync(demandWithRequestor);

        setCoveriaStep('done');
        setCreatedDemandId(result.id);
        setPendingDemandData(null);
        setAwaitingConfirmation(false);

        const successMsg = speaksArabic
          ? `رائع! تم تقديم طلبك بنجاح. سيتم مراجعته من قبل فريقنا المتخصص. سأبقيك على اطلاع بأي تحديثات.`
          : `Marvellous! I've successfully submitted your demand request. Your submission will now be reviewed by our specialist team who will assess the requirements and strategic alignment. I shall keep you informed of any updates.`;
        const displayMsg = speaksArabic
          ? `رائع! تم تقديم طلبك "${pendingDemandData.suggestedProjectName}" بنجاح.\n\nسيتم مراجعته من قبل فريقنا المتخصص. سأبقيك على اطلاع بأي تحديثات.\n\nيمكنك مشاهدة التقرير الكامل في أي وقت.`
          : `Marvellous! I've successfully submitted your demand request "${pendingDemandData.suggestedProjectName}".\n\nYour submission will now be reviewed by our specialist team who will assess the requirements and strategic alignment. I shall keep you informed of any updates.\n\nYou may view the full report at any time.`;
        setCoveriaMessages(prev => [...prev, { role: 'assistant', content: displayMsg }]);
        await speakAndWait(successMsg);

        toast({
          title: speaksArabic ? "تم تقديم الطلب" : t('demand.demandSubmitted'),
          description: t('demand.gateway.coveriaCreated', { projectName: pendingDemandData.suggestedProjectName }),
        });
      } catch (error) {
        console.error('[Coveria] Submission error:', error);
        setCoveriaStep('error');
        const errorMsg = speaksArabic
          ? "أعتذر، واجهنا صعوبة في تقديم طلبك. هل تريد المحاولة مرة أخرى؟"
          : "I do apologise, but we've encountered a difficulty submitting your demand. Would you like me to try again?";
        setCoveriaMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
        await speakAndWait(errorMsg);
      } finally {
        setIsProcessing(false);
      }
    } else if (isCancel) {
      setPendingDemandData(null);
      setAwaitingConfirmation(false);
      setCoveriaStep('listening');

      const cancelMsg = speaksArabic
        ? "مفهوم. تم إلغاء التقديم. هل تريد وصف طلب مختلف؟"
        : "Understood. I've cancelled the submission. Would you like to describe a different demand, or shall I revise this one?";
      setCoveriaMessages(prev => [...prev, { role: 'assistant', content: cancelMsg }]);
      await speakAndWait(cancelMsg);
    } else {
      const revisionMsg = speaksArabic
        ? "فهمت، سأحدّث مسودة الطلب بناءً على ملاحظتك ثم أعرضها عليك مرة أخرى."
        : "Understood. I’ll revise the draft with that instruction and bring it back for your approval.";
      setCoveriaMessages(prev => [...prev, { role: 'assistant', content: revisionMsg }]);
      setAwaitingConfirmation(false);
      const priorDraft = JSON.stringify(pendingDemandData, null, 2);
      await processCoveriaMessage(`Revise this pending demand draft using the requester instruction.\n\nRequester instruction: ${userResponse}\n\nCurrent draft:\n${priorDraft}`);
    }
  };

  // Detect if message is a greeting or small talk vs actual demand
  const isGreetingOrSmallTalk = (message: string): boolean => {
    const lower = message.toLowerCase().trim();

    // English greetings
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'greetings', 'yo', 'sup'];
    const smallTalk = ['how are you', 'what can you do', 'who are you', 'what are you', 'help', 'thanks', 'thank you', 'bye', 'goodbye', 'ok', 'okay'];

    // Arabic greetings
    const arabicGreetings = ['مرحبا', 'السلام عليكم', 'اهلا', 'صباح الخير', 'مساء الخير', 'شكرا', 'كيف حالك'];

    // Check Arabic greetings
    if (arabicGreetings.some(g => message.includes(g))) return true;

    // Check if it's just a greeting or small talk (short messages)
    if (lower.length < 30) {
      if (greetings.some(g => lower === g || lower.startsWith(g + ' ') || lower.startsWith(g + '!'))) return true;
      if (smallTalk.some(s => lower.includes(s))) return true;
    }
    return false;
  };

  // Handle greetings and small talk (supports Arabic)
  const handleSmallTalk = async (message: string) => {
    const lower = message.toLowerCase().trim();
    const userSpeaksArabic = isArabic(message);
    let response = '';

    if (userSpeaksArabic) {
      // Arabic responses
      if (message.includes('كيف حالك')) {
        response = "أنا بخير، شكراً لسؤالك! أنا جاهزة لمساعدتك في تقديم طلب. فقط صف حاجتك التجارية - ما تريد تحقيقه، وأي اعتبارات للميزانية، ومدى إلحاحها.";
      } else if (message.includes('شكرا')) {
        response = "عفواً! هل هناك شيء آخر يمكنني مساعدتك به اليوم؟";
      } else {
        // Generic Arabic greeting
        response = "أهلاً وسهلاً! أنا كوفيريا، مستشارتك للذكاء الاستراتيجي. فقط صف لي ما تحتاجه - هدفك التجاري، والميزانية إن وجدت، ومدى الإلحاح. سأجهز كل شيء لموافقتك.";
      }
    } else {
      // English responses
      if (lower.includes('how are you')) {
        response = "I'm quite well, thank you for asking! I'm ready to help you submit a demand request. Simply describe your business need - what you're trying to achieve, any budget considerations, and how urgent it is.";
      } else if (lower.includes('what can you do') || lower.includes('help')) {
        response = "I'm here to help you submit demand requests effortlessly. Just describe your business objective in your own words - for example, 'I need a new HR system with a budget of 500 thousand, it's quite urgent.' I'll generate all the required details and submit it for you after your approval.";
      } else if (lower.includes('who are you') || lower.includes('what are you')) {
        response = "I'm Coveria, your Strategic Intelligence Advisor. I use AI to transform your natural language descriptions into complete demand requests. Simply tell me what you need, and I'll handle all the paperwork.";
      } else if (lower.includes('thank')) {
        response = "You're most welcome! Is there anything else I can help you with today?";
      } else if (lower.includes('bye') || lower.includes('goodbye')) {
        response = "Cheerio! Do come back whenever you need assistance with a new demand request.";
      } else {
        // Generic greeting response
        response = "Hello! Lovely to chat with you. Whenever you're ready, simply describe your business need - what you want to achieve, your budget if you have one in mind, and how urgent it is. I'll prepare everything for your approval.";
      }
    }

    setCoveriaMessages(prev => [...prev, { role: 'assistant', content: response }]);
    await speakAndWait(response);
  };

  // Coveria conversation handler - Agentic
  const handleCoveriaSubmit = async () => {
    if (!coveriaInput.trim() || isProcessing) return;

    const userMessage = coveriaInput.trim();
    setCoveriaInput('');
    setCoveriaMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    // If awaiting confirmation, handle the response
    if (awaitingConfirmation) {
      await handleConfirmationResponse(userMessage);
    } else if (isGreetingOrSmallTalk(userMessage)) {
      // Handle greetings and small talk conversationally
      await handleSmallTalk(userMessage);
    } else {
      // Otherwise, process as demand request
      await processCoveriaMessage(userMessage);
    }
  };

  // Retry failed submission
  const retryCoveriaSubmission = () => {
    const lastUserMessage = coveriaMessages.filter(m => m.role === 'user').pop();
    if (lastUserMessage) {
      processCoveriaMessage(lastUserMessage.content);
    }
  };

  // Start Coveria conversation with animation
  const startCoveriaConversation = async () => {
    setIsCoveriaAnimating(true);

    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 150));

    setIsCoveriaExpanded(true);
    setCoveriaStep('listening');
    const greeting = t('demand.gateway.greeting');
    setCoveriaMessages([{ role: 'assistant', content: greeting }]);
    setCreatedDemandId(null);

    // Wait a bit then focus input
    await new Promise(resolve => setTimeout(resolve, 300));
    setIsCoveriaAnimating(false);
    coveriaInputRef.current?.focus();

    // Speak greeting (user already clicked, so autoplay should work)
    await speakAndWait(greeting);
  };

  // Reset Coveria with animation
  const resetCoveria = () => {
    setIsCoveriaAnimating(true);
    setTimeout(() => {
      setIsCoveriaExpanded(false);
      setCoveriaStep('idle');
      setCoveriaMessages([]);
      setCoveriaInput('');
      setCreatedDemandId(null);
      setIsProcessing(false);
      setPendingDemandData(null);
      setAwaitingConfirmation(false);
      setTimeout(() => setIsCoveriaAnimating(false), 150);
    }, 150);
  };

  // Quick confirm/cancel handlers for buttons
  const handleQuickConfirm = async () => {
    setCoveriaMessages(prev => [...prev, { role: 'user', content: 'Yes, please submit' }]);
    await handleConfirmationResponse('yes');
  };

  const handleQuickCancel = async () => {
    setCoveriaMessages(prev => [...prev, { role: 'user', content: 'No, cancel this' }]);
    await handleConfirmationResponse('no');
  };

  // Build demand sub-services from live KPIs
  const demandSubServices = useMemo(() => buildDemandSubServices(demandKpis), [demandKpis]);


  // Handle service selection with smooth transition
  const handleServiceSelect = (serviceId: string, isActive: boolean) => {
    if (!isActive) return;

    if (serviceId === "intelligent-workspace") {
      setLocation("/intelligent-workspace");
      return;
    }

    setIsTransitioning(true);
    setSelectedService(serviceId);

    // Set default sub-service based on selected service
    if (serviceId === "intelligent-assessments") {
      setSelectedSubService("strategy-leadership");
      setSelectedFramework(null);
    } else if (serviceId === "intelligent-demand") {
      setSelectedSubService("demand-request-form");
    }

    // Smooth transition to workspace
    setTimeout(() => {
      setMode("workspace");
      setTimeout(() => setIsTransitioning(false), 300);
    }, 500);
  };

  // Return to constellation
  const handleReturnToConstellation = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setMode("landing");
      setTimeout(() => setIsTransitioning(false), 300);
    }, 300);
  };

  // Landing page - Constellation view
  if (mode === "landing") {
    return (
      <ConstellationLandingLayout
        title={t('demand.gateway.pageTitle')}
        icon={<HexagonLogoFrame size="sm" />}
        accentColor="blue"
        testId="gateway-intelligent-demand"
      >
        <div className={`w-full max-w-5xl px-8 transition-all duration-500 ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
          {/* Central Title */}
          <div className="text-center mb-10">
            <h1 className="text-4xl font-light tracking-tight">
              <span className="font-bold bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 dark:from-amber-300 dark:via-orange-400 dark:to-amber-300 bg-clip-text text-transparent">{t('demand.gateway.pageTitle')}</span>
            </h1>
            <p className="text-amber-800/70 dark:text-amber-200/60 mt-3 text-lg">{t('demand.gateway.aiPoweredServices')}</p>
          </div>

          {/* Unified Service Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {services.map((service, index) => (
              <GatewayCard
                key={service.id}
                title={service.title}
                description={service.description}
                icon={service.icon}
                accentColor={index === 0 ? "emerald" : index === 1 ? "violet" : "amber"}
                isActive={service.isActive}
                onClick={() => handleServiceSelect(service.id, service.isActive)}
                testId={`landing-service-${service.id}`}
              />
            ))}
          </div>
        </div>
      </ConstellationLandingLayout>
    );
  }

  // Workspace mode - Service content view
  return (
    <div className={`h-screen bg-background constellation-grid relative overflow-hidden transition-all duration-500 ${isTransitioning ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}>
      <div className="w-full px-6 relative z-10 h-full flex flex-col">
        {/* Compact Header with Return to Constellation button */}
        <div className="flex items-center gap-3 flex-shrink-0 py-3 border-b border-border/40">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={handleReturnToConstellation}
            data-testid="button-back-constellation"
          >
            <HexagonLogoFrame size="sm" animated />
            {t('demand.gateway.backToGateway')}
          </Button>
          <div className="h-5 w-px bg-border"></div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                {services.find(s => s.id === selectedService)?.title || t('demand.gateway.selectServiceFallback')}
              </h1>
              <p className="text-xs text-muted-foreground">
                {services.find(s => s.id === selectedService)?.description}
              </p>
            </div>
          </div>

          {/* Service Switcher */}
          <div className="ml-auto flex items-center gap-2">
            {services.filter(s => s.isActive).map(service => (
              <button
                key={service.id}
                onClick={() => {
                  if (service.id === "intelligent-workspace") {
                    setLocation("/intelligent-workspace");
                    return;
                  }

                  setSelectedService(service.id);
                  if (service.id === "intelligent-assessments") {
                    setSelectedSubService("strategy-leadership");
                    setSelectedFramework(null);
                  } else if (service.id === "intelligent-demand") {
                    setSelectedSubService("demand-request-form");
                  }
                }}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                  selectedService === service.id
                    ? 'bg-primary text-white shadow-lg'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                data-testid={`quick-switch-${service.id}`}
              >
                <div className="h-4 w-4">{service.icon}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
          {/* Left - Service Information Panel */}
          <div className="w-[28rem] xl:w-[30rem] flex-shrink-0" data-testid="service-info-section">
            <div className="intelligence-panel rounded-xl p-4 flex flex-col h-full relative overflow-hidden">
              {/* Animated background accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full animate-pulse" style={{animationDuration: '4s'}}></div>

              {selectedService === "intelligent-demand" ? (
                <div className="h-full relative z-10 bg-gradient-to-b from-white via-emerald-50/30 to-teal-50/50 dark:from-card dark:via-emerald-950/20 dark:to-teal-950/30 rounded-xl border border-emerald-200/50 dark:border-emerald-800/30 shadow-xl overflow-hidden flex flex-col">
                  {/* Brand Header with Coveria Button */}
                  <div className="p-4 border-b border-emerald-200/50 dark:border-emerald-800/30 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-transparent to-purple-500/5"></div>
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-violet-400/10 to-transparent rounded-bl-full"></div>
                    <div className="relative flex items-center gap-3">
                      {!isCoveriaExpanded && (() => {
                        const serviceColors: Record<string, {border: string, dot: string}> = {
                          "intelligent-demand": { border: "border-emerald-400/30", dot: "bg-violet-400" },
                          "intelligent-assessments": { border: "border-violet-400/30", dot: "bg-emerald-400" },
                          "intelligent-frameworks": { border: "border-indigo-400/30", dot: "bg-amber-400" }
                        };
                        const colors = (serviceColors[selectedService] || serviceColors["intelligent-demand"])!;
                        return (
                          <button
                            onClick={startCoveriaConversation}
                            className="relative h-12 w-12 flex items-center justify-center"
                            data-testid="button-coveria-open"
                          >
                            <div className={`absolute inset-0 rounded-xl border-2 ${colors.border} animate-pulse`} style={{animationDuration: '2s'}}></div>
                            <div className="absolute inset-[-4px] rounded-xl border border-current/20 animate-spin" style={{animationDuration: '8s'}}></div>
                            <div className="h-12 w-12 rounded-full flex items-center justify-center float-animation transition-all duration-300">
                              <HexagonLogoFrame size="sm" animated />
                            </div>
                            <div className={`absolute -top-1 -right-1 h-3 w-3 ${colors.dot} rounded-full border-2 border-white dark:border-card animate-pulse`}></div>
                          </button>
                        );
                      })()}
                      <div className="flex-1">
                        <h3 className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 text-sm tracking-wide">{t('demand.gateway.coveriaName')}</h3>
                        <p className="text-[10px] text-muted-foreground">{t('demand.gateway.strategicAdvisor')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Coveria AI Chat Interface - Expanded State */}
                  {isCoveriaExpanded ? (
                    <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-out ${isCoveriaAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                      {/* Coveria Header */}
                      <div className="p-3 border-b border-purple-200/30 dark:border-purple-800/20 bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-indigo-500/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-indigo-500/20">
                              <HexagonLogoFrame size="sm" animated />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400">{t('demand.gateway.coveriaName')}</h4>
                              <p className="text-[9px] text-muted-foreground">{t('demand.gateway.strategicAdvisor')}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={resetCoveria}
                              className="h-6 w-6 rounded-md bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
                              data-testid="button-coveria-close"
                            >
                              <X className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Input Area - At Top */}
                      {coveriaStep === 'listening' && (
                        <div className="p-3 border-b border-purple-200/30 dark:border-purple-800/20 bg-white/50 dark:bg-card/30">
                          <div className="flex gap-1">
                            <Input
                              ref={coveriaInputRef}
                              value={coveriaInput}
                              onChange={(e) => setCoveriaInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleCoveriaSubmit()}
                              placeholder={t('demand.gateway.placeholder')}
                              className="flex-1 h-8 text-xs bg-white dark:bg-card/50 border-purple-200/50 dark:border-purple-800/30"
                              data-testid="input-coveria-message"
                              disabled={isProcessing}
                            />
                            <Button
                              onClick={handleCoveriaSubmit}
                              size="sm"
                              className="h-8 w-8 p-0 bg-gradient-to-r from-violet-500 to-indigo-500"
                              data-testid="button-coveria-send"
                              disabled={isProcessing || !coveriaInput.trim()}
                            >
                              <Send className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Chat Messages */}
                      <ScrollArea className="flex-1 p-3">
                        <div className="space-y-3">
                          {coveriaMessages.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-[85%] rounded-lg p-2.5 text-xs leading-relaxed ${
                                msg.role === 'user'
                                  ? 'bg-emerald-500 text-white rounded-br-sm'
                                  : 'bg-white dark:bg-card/80 border border-purple-200/50 dark:border-purple-800/30 text-foreground rounded-bl-sm shadow-sm'
                              }`}>
                                {msg.content}
                              </div>
                            </div>
                          ))}
                          {coveriaStep === 'processing' && (
                            <div className="flex justify-start">
                              <div className="bg-white dark:bg-card/80 border border-purple-200/50 dark:border-purple-800/30 rounded-lg p-2.5 flex items-center gap-2">
                                <Loader2 className="h-3 w-3 animate-spin text-purple-500" />
                                <span className="text-xs text-muted-foreground">{t('demand.gateway.processingRequest')}</span>
                              </div>
                            </div>
                          )}

                          {/* Confirmation Buttons */}
                          {awaitingConfirmation && !isProcessing && (
                            <div className="flex justify-center gap-2 pt-2">
                              <Button
                                onClick={handleQuickConfirm}
                                size="sm"
                                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                                data-testid="button-confirm-submission"
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1.5" />
                                {t('demand.gateway.yesSubmit')}
                              </Button>
                              <Button
                                onClick={handleQuickCancel}
                                size="sm"
                                variant="outline"
                                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                                data-testid="button-cancel-submission"
                              >
                                <X className="h-3 w-3 mr-1.5" />
                                {t('demand.gateway.noCancel')}
                              </Button>
                            </div>
                          )}
                        </div>
                      </ScrollArea>

                      {/* Action Buttons at Bottom - only for done/error states */}
                      {(coveriaStep === 'done' || coveriaStep === 'error') && (
                        <div className="p-3 border-t border-purple-200/30 dark:border-purple-800/20 bg-white/50 dark:bg-card/30">
                          {coveriaStep === 'done' && createdDemandId ? (
                            <div className="space-y-2">
                              <Button
                                onClick={() => {
                                  setLocation(`/demand-reports/${createdDemandId}`);
                                }}
                                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                                size="sm"
                                data-testid="button-view-demand"
                              >
                                <FileText className="h-3 w-3 mr-2" />
                                {t('demand.gateway.viewDemandReport')}
                              </Button>
                              <Button
                                onClick={startCoveriaConversation}
                                variant="outline"
                                className="w-full"
                                size="sm"
                                data-testid="button-new-demand"
                              >
                                {t('demand.gateway.startNewRequest')}
                              </Button>
                            </div>
                          ) : coveriaStep === 'error' ? (
                            <div className="space-y-2">
                              <Button
                                onClick={retryCoveriaSubmission}
                                className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white"
                                size="sm"
                                data-testid="button-coveria-retry"
                              >
                                <Loader2 className={`h-3 w-3 mr-2 ${isProcessing ? 'animate-spin' : 'hidden'}`} />
                                {t('demand.gateway.tryAgain')}
                              </Button>
                              <Button
                                onClick={() => {
                                  resetCoveria();
                                  setSelectedSubService('demand-request-form');
                                }}
                                variant="outline"
                                className="w-full"
                                size="sm"
                                data-testid="button-use-form"
                              >
                                {t('demand.gateway.useStandardForm')}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Real-time Queue Status */}
                  <div className="p-3 border-b border-emerald-200/30 dark:border-emerald-800/20">
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">{t('demand.gateway.queueStatus')}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-2 text-center border border-emerald-100 dark:border-emerald-800/30">
                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{queueInCount.toLocaleString()}</div>
                        <div className="text-[9px] text-muted-foreground">{t('demand.gateway.inQueue')}</div>
                      </div>
                      <div className="bg-white/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-2 text-center border border-emerald-100 dark:border-emerald-800/30">
                        <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{queuePendingApprovalCount.toLocaleString()}</div>
                        <div className="text-[9px] text-muted-foreground">{t('demand.gateway.pendingApproval')}</div>
                      </div>
                    </div>
                  </div>

                  {/* Service Selector */}
                  <div className="p-2 border-b border-emerald-200/30 dark:border-emerald-800/20">
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 px-1">{t('demand.gateway.selectService')}</div>
                    <div className="space-y-1">
                      {demandSubServices.map((svc) => {
                        const isSelected = selectedSubService === svc.id;
                        const colorClasses: Record<string, {bg: string, text: string}> = {
                          "bg-emerald-500": { bg: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
                          "bg-purple-500": { bg: "bg-purple-500", text: "text-purple-600 dark:text-purple-400" },
                          "bg-rose-500": { bg: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
                          "bg-amber-500": { bg: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" }
                        };
                        const colors = (colorClasses[svc.color] || colorClasses["bg-emerald-500"])!;
                        return (
                          <button
                            key={svc.id}
                            onClick={() => setSelectedSubService(svc.id)}
                            className={`w-full px-3 py-2 rounded-lg text-left transition-all duration-200 ${
                              isSelected
                                ? `${colors.bg} text-white shadow-md`
                                : 'bg-white/60 dark:bg-card/40 hover:bg-white dark:hover:bg-card/60 text-foreground border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800'
                            }`}
                            data-testid={`demand-service-${svc.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                                isSelected ? 'bg-white/20' : `${colors.bg} text-white`
                              }`}>
                                {svc.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : ''}`}>
                                  {svc.title}
                                </div>
                                <div className={`text-[10px] ${isSelected ? 'text-white/70' : 'text-muted-foreground'}`}>
                                  {svc.metrics.value} {svc.metrics.label}
                                </div>
                              </div>
                              {isSelected && <ChevronRight className="h-3 w-3 text-white/70" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="flex-1 overflow-y-auto p-3">
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">{t('demand.gateway.performance')}</div>
                    <div className="space-y-2">
                      {/* SLA Compliance */}
                      <div className="bg-white/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-2.5 border border-emerald-100 dark:border-emerald-800/30">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-medium">{t('demand.gateway.slaCompliance')}</span>
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{Math.round(demandKpis.slaCompliancePercent)}%</span>
                        </div>
                        <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{width: `${Math.min(100, Math.max(0, Math.round(demandKpis.slaCompliancePercent)))}%`}}></div>
                        </div>
                      </div>

                      {/* Avg Processing */}
                      <div className="bg-white/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-2.5 border border-emerald-100 dark:border-emerald-800/30">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium">{t('demand.gateway.avgProcessing')}</span>
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{demandKpis.avgProcessingDays.toFixed(1)} {t('demand.gateway.days')}</span>
                        </div>
                      </div>

                      {/* This Month */}
                      <div className="bg-white/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-2.5 border border-emerald-100 dark:border-emerald-800/30">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium">{t('demand.gateway.completedThisMonth')}</span>
                          <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{demandKpis.createdThisMonth.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Total Requests */}
                      <div className="bg-white/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-2.5 border border-emerald-100 dark:border-emerald-800/30">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium">{t('demand.gateway.totalRequests')}</span>
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{demandKpis.total.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Status */}
                  <div className="p-3 border-t border-emerald-200/30 dark:border-emerald-800/20 bg-white/50 dark:bg-card/30">
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span>{t('demand.gateway.systemOnline')}</span>
                      <div className="w-1 h-1 rounded-full bg-muted-foreground/30"></div>
                      <span>{t('demand.gateway.lastSync')} {lastSyncLabel}</span>
                    </div>
                  </div>
                    </>
                  )}
                </div>
              ) : selectedService === "intelligent-assessments" ? (
                <div className="h-full relative z-10 bg-gradient-to-b from-white via-violet-50/30 to-indigo-50/50 dark:from-card dark:via-violet-950/20 dark:to-indigo-950/30 rounded-xl border border-violet-200/50 dark:border-violet-800/30 shadow-xl overflow-hidden flex flex-col">
                  {/* Animated COREVIA Brand Header */}
                  <div className="p-4 border-b border-violet-200/50 dark:border-violet-800/30 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-transparent to-indigo-500/5"></div>
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-violet-400/10 to-transparent rounded-bl-full"></div>
                    <div className="relative flex items-center gap-3">
                      {/* Animated COREVIA Logo */}
                      <div className="relative h-12 w-12 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-2 border-violet-400/30 animate-pulse" style={{animationDuration: '2s'}}></div>
                        <div className="absolute inset-[-2px] rounded-full border border-indigo-400/20 animate-spin" style={{animationDuration: '12s'}}></div>
                        <div className="h-12 w-12 rounded-full flex items-center justify-center shadow-lg shadow-violet-500/30 float-animation bg-gradient-to-br from-violet-500/20 to-indigo-500/20">
                          <HexagonLogoFrame size="sm" animated />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 text-sm tracking-wide animate-pulse" style={{animationDuration: '3s'}}>COREVIA</h3>
                        <p className="text-[10px] text-muted-foreground">{t('demand.gateway.intelligenceAtlas')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Assessment Service Selector */}
                  <div className="p-2 border-b border-violet-200/30 dark:border-violet-800/20">
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 px-1">{t('demand.gateway.selectService')}</div>
                    <div className="space-y-1">
                      {assessmentSvcs.map((svc) => {
                        const isSelected = selectedAssessmentService === svc.id;
                        const colorClasses: Record<string, {bg: string, text: string}> = {
                          violet: { bg: "bg-violet-500", text: "text-violet-600 dark:text-violet-400" },
                          emerald: { bg: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
                          blue: { bg: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" }
                        };
                        const colors = (colorClasses[svc.color] || colorClasses.violet)!;
                        return (
                          <button
                            key={svc.id}
                            onClick={() => setSelectedAssessmentService(svc.id)}
                            className={`w-full px-3 py-2 rounded-lg text-left transition-all duration-200 ${
                              isSelected
                                ? `${colors.bg} text-white shadow-md`
                                : 'bg-white/60 dark:bg-card/40 hover:bg-white dark:hover:bg-card/60 text-foreground border border-transparent hover:border-violet-200 dark:hover:border-violet-800'
                            }`}
                            data-testid={`assessment-service-${svc.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                                isSelected ? 'bg-white/20' : `${colors.bg} text-white`
                              }`}>
                                {svc.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : ''}`}>
                                  {svc.shortTitle}
                                </div>
                              </div>
                              {isSelected && (
                                <ChevronRight className="h-3 w-3 text-white/70" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Service-specific Content */}
                  {selectedAssessmentService === "intelligent-frameworks" ? (
                    <>
                      {/* Stats Row */}
                      <div className="grid grid-cols-3 gap-2 p-3 border-b border-violet-200/30 dark:border-violet-800/20">
                        <div className="bg-white/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-2 text-center border border-violet-100 dark:border-violet-800/30">
                          <div className="text-base font-bold text-violet-600 dark:text-violet-400">6</div>
                          <div className="text-[9px] text-muted-foreground">{t('demand.gateway.dimensions')}</div>
                        </div>
                        <div className="bg-white/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-2 text-center border border-violet-100 dark:border-violet-800/30">
                          <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">20</div>
                          <div className="text-[9px] text-muted-foreground">{t('demand.gateway.frameworks')}</div>
                        </div>
                        <div className="bg-white/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-2 text-center border border-violet-100 dark:border-violet-800/30">
                          <div className="text-base font-bold text-amber-600 dark:text-amber-400">139</div>
                          <div className="text-[9px] text-muted-foreground">{t('demand.gateway.criteria')}</div>
                        </div>
                      </div>

                      {/* Dimension Navigation Tabs */}
                      <div className="flex-1 overflow-y-auto p-2">
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 px-1">{t('demand.gateway.assessmentDimensions')}</div>
                        <div className="space-y-1">
                          {getAssessmentSubServices().map((dim) => {
                            const isSelected = selectedSubService === dim.id;
                            const frameworks = frameworksByDimension[dim.id] || [];
                            return (
                              <button
                                key={dim.id}
                                onClick={() => {
                                  setSelectedSubService(dim.id);
                                  setSelectedFramework(null);
                                }}
                                className={`w-full px-3 py-2.5 rounded-lg text-left transition-all duration-200 group ${
                                  isSelected
                                    ? `${dim.colorClass} text-white shadow-lg`
                                    : 'bg-white/60 dark:bg-card/40 hover:bg-white dark:hover:bg-card/60 text-foreground border border-transparent hover:border-violet-200 dark:hover:border-violet-800'
                                }`}
                                data-testid={`dimension-tab-${dim.id}`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                                    isSelected
                                      ? 'bg-white/20'
                                      : `${dim.colorClass} text-white`
                                  }`}>
                                    {dim.icon}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : ''}`}>
                                      {dim.shortTitle}
                                    </div>
                                    <div className={`text-[9px] ${isSelected ? 'text-white/70' : 'text-muted-foreground'}`}>
                                      {t('demand.gateway.nFrameworks', { count: frameworks.length })}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <ChevronRight className="h-4 w-4 text-white/70" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : selectedAssessmentService === "intelligent-iso" ? (
                    <>
                      {/* ISO Stats Row */}
                      <div className="grid grid-cols-3 gap-2 p-3 border-b border-emerald-200/30 dark:border-emerald-800/20">
                        <div className="bg-white/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-2 text-center border border-emerald-100 dark:border-emerald-800/30">
                          <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">—</div>
                          <div className="text-[9px] text-muted-foreground">{t('demand.gateway.standards')}</div>
                        </div>
                        <div className="bg-white/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-2 text-center border border-emerald-100 dark:border-emerald-800/30">
                          <div className="text-base font-bold text-teal-600 dark:text-teal-400">—</div>
                          <div className="text-[9px] text-muted-foreground">{t('demand.gateway.controls')}</div>
                        </div>
                        <div className="bg-white/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-2 text-center border border-emerald-100 dark:border-emerald-800/30">
                          <div className="text-base font-bold text-green-600 dark:text-green-400">—</div>
                          <div className="text-[9px] text-muted-foreground">{t('demand.gateway.compliance')}</div>
                        </div>
                      </div>

                      {/* ISO Content */}
                      <div className="flex-1 overflow-y-auto p-3">
                        <div className="text-center py-8">
                          <div className="h-16 w-16 mx-auto rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg mb-4">
                            <Shield className="h-8 w-8" />
                          </div>
                          <h3 className="font-bold text-emerald-600 dark:text-emerald-400 mb-2">{t('demand.gateway.intelligentIso')}</h3>
                          <p className="text-xs text-muted-foreground mb-4">{t('demand.gateway.isoDesc')}</p>
                          <Badge variant="secondary" className="text-emerald-600">{t('demand.gateway.comingSoon')}</Badge>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Auditor Stats Row */}
                      <div className="grid grid-cols-3 gap-2 p-3 border-b border-blue-200/30 dark:border-blue-800/20">
                        <div className="bg-white/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-2 text-center border border-blue-100 dark:border-blue-800/30">
                          <div className="text-base font-bold text-blue-600 dark:text-blue-400">—</div>
                          <div className="text-[9px] text-muted-foreground">{t('demand.gateway.activeAudits')}</div>
                        </div>
                        <div className="bg-white/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-2 text-center border border-blue-100 dark:border-blue-800/30">
                          <div className="text-base font-bold text-sky-600 dark:text-sky-400">—</div>
                          <div className="text-[9px] text-muted-foreground">{t('demand.gateway.findings')}</div>
                        </div>
                        <div className="bg-white/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-2 text-center border border-blue-100 dark:border-blue-800/30">
                          <div className="text-base font-bold text-cyan-600 dark:text-cyan-400">—</div>
                          <div className="text-[9px] text-muted-foreground">{t('demand.gateway.resolved')}</div>
                        </div>
                      </div>

                      {/* Auditor Content */}
                      <div className="flex-1 overflow-y-auto p-3">
                        <div className="text-center py-8">
                          <div className="h-16 w-16 mx-auto rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white shadow-lg mb-4">
                            <Search className="h-8 w-8" />
                          </div>
                          <h3 className="font-bold text-blue-600 dark:text-blue-400 mb-2">{t('demand.gateway.intelligentAuditor')}</h3>
                          <p className="text-xs text-muted-foreground mb-4">{t('demand.gateway.auditorDesc')}</p>
                          <Badge variant="secondary" className="text-blue-600">{t('demand.gateway.comingSoon')}</Badge>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Compliance Footer */}
                  <div className="p-3 border-t border-violet-200/30 dark:border-violet-800/20 bg-white/50 dark:bg-card/30">
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                      <Shield className="h-3 w-3 text-emerald-500" />
                      <span>ISO 27001</span>
                      <div className="w-1 h-1 rounded-full bg-muted-foreground/30"></div>
                      <span>SOC 2 Type II</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full relative z-10">
                  <div className="text-center space-y-3">
                    <div className="relative mx-auto">
                      {/* Subtle animated ring */}
                      <div className="absolute inset-[-6px] rounded-2xl border border-muted/30 animate-pulse" style={{animationDuration: '3s'}}></div>
                      <div className="h-14 w-14 mx-auto rounded-xl bg-muted/40 border border-muted/50 flex items-center justify-center">
                        {services.find(s => s.id === selectedService)?.icon || <HexagonLogoFrame px={24} />}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground">
                        {services.find(s => s.id === selectedService)?.title}
                      </h3>
                      <p className="text-xs text-muted-foreground/70">{t('demand.gateway.comingSoon')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Main Service Content */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {selectedService === "intelligent-demand" ? (
              <div className="h-full min-w-0 flex gap-4 overflow-hidden" data-testid="intelligent-demand-workspace">
                <DemandWorkspaceContent
                  demandSubServices={demandSubServices}
                  selectedSubService={selectedSubService}
                  successRate={successRate}
                  onNavigate={setLocation}
                />
              </div>
            ) : selectedService === "intelligent-assessments" ? (
              <div className="h-full" data-testid="intelligent-assessments-workspace">
                <AssessmentWorkspaceContent
                  assessmentSubServices={getAssessmentSubServices()}
                  frameworksByDimension={frameworksByDimension}
                  selectedSubService={selectedSubService}
                  selectedFramework={selectedFramework}
                  setSelectedFramework={setSelectedFramework}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                />
              </div>
            ) : (
              <div className="intelligence-panel rounded-xl p-12 text-center flex items-center justify-center h-full">
                <div className="space-y-4">
                  <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mx-auto float-animation">
                    <HexagonLogoFrame size="lg" animated />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-muted-foreground">{t('demand.gateway.comingSoon')}</h3>
                    <p className="text-sm text-muted-foreground">{t('demand.gateway.underDevelopment')}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
