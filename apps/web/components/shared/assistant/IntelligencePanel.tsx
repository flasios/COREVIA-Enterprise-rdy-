import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { nanoid } from "nanoid";
import { Bell, ChevronRight, ChevronDown, Users, Circle, Check, X, MessageSquare, Zap, Send, Volume2, VolumeX, Mic, AlertTriangle, TrendingUp, FileText, Play, CheckSquare, Globe, Building2, Briefcase, Target, Loader2, RefreshCw, MapPin, Lightbulb, Package } from "lucide-react";
import { HexagonLogoFrame } from "@/components/shared/misc";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCoveria } from "@/contexts/CoveriaContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Notification } from "@shared/schema";
import { getNotificationActionUrl, isDemandNotification } from "@/shared/lib/notification-routing";

interface Portal {
  id: string;
  title: string;
  description: string;
  icon: JSX.Element;
  features: string[];
  color: string;
  usageLevel: number;
}

interface BusinessCaseContext {
  reportId: string;
  reportName: string;
  archetype: string;
}

interface IntelligencePanelProps {
  selectedPortal?: Portal | null;
  businessCaseContext?: BusinessCaseContext | null;
  compact?: boolean;
}

// Types for portfolio data
interface PortfolioStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  atRiskProjects: number;
  criticalProjects: number;
  totalBudget: number;
  utilizationRate: number;
}

interface PortfolioProject {
  id: string;
  projectName: string;
  healthStatus: string;
  currentPhase: string;
  overallProgress: number;
  approvedBudget: number;
  actualSpend: number;
}

// Market Research Types
interface MarketPlayer {
  name: string;
  description: string;
  marketShare?: string;
  headquarters: string;
  relevance: string;
  annualRevenue?: string;
  flagshipSolutions?: string[];
  regionalStrength?: string[];
  keyClients?: string[];
}

interface TopCountry {
  country: string;
  rank: number;
  marketSize: string;
  growthRate: string;
  adoptionMaturity: "Emerging" | "Growing" | "Mature" | "Leading";
  keyDrivers: string[];
  regulatoryEnvironment: string;
  majorLocalPlayers: string[];
}

interface UAEPlayer {
  name: string;
  description: string;
  sector: string;
  capabilities: string[];
}

interface UseCase {
  title: string;
  description: string;
  benefits: string[];
  implementationComplexity: "Low" | "Medium" | "High";
  estimatedROI: string;
  relevantPlayers: string[];
}

interface SupplierProvider {
  name: string;
  category: string;
  services: string[];
  uaePresence: boolean;
  contactInfo?: string;
}

interface MarketResearchResult {
  globalMarket: {
    marketSize: string;
    growthRate: string;
    keyTrends: string[];
    topCountries?: TopCountry[];
    majorPlayers: MarketPlayer[];
  };
  uaeMarket: {
    marketSize: string;
    growthRate: string;
    governmentInitiatives: string[];
    localPlayers: UAEPlayer[];
    opportunities: string[];
  };
  suppliers: SupplierProvider[];
  useCases: UseCase[];
  recommendations: string[];
  generatedAt: string;
}

export default function IntelligencePanel({ selectedPortal, businessCaseContext, compact = false }: IntelligencePanelProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { openCoveria, closeCoveria, isOpen: isCoveriaOpen, avatarRef, voiceEnabled, toggleVoice, speak, isSpeaking, stopSpeaking, chatMessages, setChatMessages, clearChat, hasSpokenGreeting, setHasSpokenGreeting } = useCoveria();
  const { onlineUsers } = useWebSocket();
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  // Fetch real portfolio data for dynamic insights
  const { data: portfolioStats } = useQuery<PortfolioStats>({
    queryKey: ["/api/portfolio/stats"],
    staleTime: 30000, // Refresh every 30 seconds
  });

  const { data: projectsData } = useQuery<{ success: boolean; data: PortfolioProject[] }>({
    queryKey: ["/api/portfolio/projects"],
    staleTime: 30000,
  });

  const projects = projectsData?.data || [];
  const atRiskProjects = projects.filter(p => p.healthStatus === 'at_risk' || p.healthStatus === 'critical');
  const budgetOverruns = projects.filter(p => p.actualSpend > p.approvedBudget);
  const totalBudgetVariance = budgetOverruns.reduce((sum, p) => sum + (p.actualSpend - p.approvedBudget), 0);
  const [_expandedAlert, _setExpandedAlert] = useState<string | null>(null);
  const [_isListening, _setIsListening] = useState(false);
  const [listeningState, setListeningState] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [chatMessage, setChatMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [pendingVoiceMessage, setPendingVoiceMessage] = useState<string | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  // Market Research State
  const [marketResearch, setMarketResearch] = useState<MarketResearchResult | null>(null);
  const [isGeneratingResearch, setIsGeneratingResearch] = useState(false);
  const [expandedMarketSection, setExpandedMarketSection] = useState<string | null>(null);

  // Generate market research for a project
  const generateMarketResearch = useCallback(async (projectData?: {
    projectName: string;
    projectDescription: string;
    projectType?: string;
    organization?: string;
    estimatedBudget?: number;
    businessCaseSummary?: string;
    archetype?: string;
  }) => {
    setIsGeneratingResearch(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 270_000); // Align with server-side market-research timeout (300s)
    try {
      const requestData = projectData || {
        projectName: businessCaseContext?.reportName || selectedPortal?.title || "Not recorded",
        projectDescription: selectedPortal?.description || "Not recorded",
        projectType: businessCaseContext?.archetype || "Not recorded",
        organization: "Not recorded"
      };

      const response = await fetch('/api/ai-assistant/market-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestData),
        signal: controller.signal,
      });

      const data = await response.json();
      if (data.success) {
        setMarketResearch(data.data);
        toast({
          title: t('ai.intelligencePanel.marketResearchGenerated'),
          description: t('ai.intelligencePanel.marketResearchDescription')
        });
      } else {
        throw new Error(data.error || data.message || "Failed to generate research");
      }
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      console.error("Error generating market research:", error);
      toast({
        title: t('ai.intelligencePanel.error'),
        description: isAbort
          ? 'Market research request timed out. Please try again.'
          : t('ai.intelligencePanel.marketResearchError'),
        variant: "destructive"
      });
    } finally {
      clearTimeout(timeoutId);
      setIsGeneratingResearch(false);
    }
  }, [selectedPortal, businessCaseContext, toast, t]);

  // Simple push-to-talk speech recognition
  const startListeningSimple = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({ title: t('ai.intelligencePanel.notSupported'), description: t('ai.intelligencePanel.voiceNotSupported'), variant: "destructive" });
      return;
    }
    if (recognitionRef.current) return;

    stopSpeaking(); // Stop COREVIA if speaking

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; // eslint-disable-line @typescript-eslint/no-explicit-any
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';

    let finalTranscript = '';

    recognition.onstart = () => {
      setListeningState('listening');
    };

    recognition.onresult = (event: { resultIndex: number; results: SpeechRecognitionResultList }) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i]!.isFinal) {
          finalTranscript += event.results[i]![0]!.transcript;
        } else {
          interim += event.results[i]![0]!.transcript;
        }
      }
      setChatMessage(finalTranscript || interim);
    };

    recognition.onend = () => {
      if (finalTranscript.trim()) {
        setPendingVoiceMessage(finalTranscript.trim());
        setChatMessage('');
      }
      recognitionRef.current = null;
      setListeningState('idle');
    };

    recognition.onerror = () => {
      recognitionRef.current = null;
      setListeningState('idle');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [toast, stopSpeaking, t]);

  const stopVoiceInput = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // Process pending voice message - send it to COREVIA
  useEffect(() => {
    if (!pendingVoiceMessage || isSending) return;

    const sendVoiceMessage = async () => {
      const userMessage = pendingVoiceMessage;
      setPendingVoiceMessage(null);

      const isFirstUserMessage = chatMessages.filter(m => m.role === 'user').length === 0;
      const conversationHistory = chatMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      setChatMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date(), messageId: nanoid() }]);
      setIsSending(true);

      try {
        const response = await fetch('/api/ai-assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: userMessage,
            isFirstMessage: isFirstUserMessage,
            conversationHistory
          })
        });
        const data = await response.json();
        if (data.success && data.response) {
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: data.response,
            structuredOutput: data.structuredOutput,
            timestamp: new Date(),
            messageId: nanoid()
          }]);
          if (voiceEnabled) speak(data.response);
        }
      } catch (_error) {
        toast({ title: t('ai.intelligencePanel.error'), description: t('ai.intelligencePanel.failedToSendMessage'), variant: "destructive" });
      } finally {
        setIsSending(false);
        setListeningState('idle');
      }
    };

    sendVoiceMessage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVoiceMessage, isSending, chatMessages, voiceEnabled, speak, toast]);

  const handleSendChat = async () => {
    if (!chatMessage.trim() || isSending) return;
    const userMessage = chatMessage.trim();
    // Check if this is the first user message (only the initial greeting exists)
    const isFirstUserMessage = chatMessages.filter(m => m.role === 'user').length === 0;
    setChatMessage("");

    // Build conversation history to send to backend (for memory)
    const conversationHistory = chatMessages.map(m => ({
      role: m.role,
      content: m.content
    }));

    setChatMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date(), messageId: nanoid() }]);
    setIsSending(true);
    try {
      const response = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          isFirstMessage: isFirstUserMessage,
          conversationHistory // Send history for memory
        })
      });
      const data = await response.json();
      if (data.success && data.response) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response,
          structuredOutput: data.structuredOutput,
          timestamp: new Date(),
          messageId: nanoid()
        }]);
        if (voiceEnabled) speak(data.response);
      }
    } catch (_error) {
      toast({ title: t('ai.intelligencePanel.error'), description: t('ai.intelligencePanel.failedToSendMessage'), variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  // Direct action - sends message to COREVIA immediately without needing to press send
  const executeDirectAction = async (actionMessage: string) => {
    if (isSending) return;
    const isFirstUserMessage = chatMessages.filter(m => m.role === 'user').length === 0;

    // Build conversation history to send to backend (for memory)
    const conversationHistory = chatMessages.map(m => ({
      role: m.role,
      content: m.content
    }));

    setChatMessages(prev => [...prev, { role: 'user', content: actionMessage, timestamp: new Date(), messageId: nanoid() }]);
    setIsSending(true);
    try {
      const response = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: actionMessage,
          isFirstMessage: isFirstUserMessage,
          conversationHistory // Send history for memory
        })
      });
      const data = await response.json();
      if (data.success && data.response) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response,
          structuredOutput: data.structuredOutput,
          timestamp: new Date(),
          messageId: nanoid()
        }]);
        if (voiceEnabled) speak(data.response);
      }
    } catch (_error) {
      toast({ title: t('ai.intelligencePanel.error'), description: t('ai.intelligencePanel.failedToExecuteAction'), variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  // Test all notification types
  const _triggerTestNotifications = async () => {
    try {
      const response = await fetch('/api/ai-assistant/test-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        toast({
          title: t('ai.intelligencePanel.testNotificationsSent'),
          description: t('ai.intelligencePanel.testNotificationsDescription', { count: data.notifications?.length ?? 0 })
        });
        // Refresh notification queries
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/notifications"] });
      } else {
        toast({ title: t('ai.intelligencePanel.error'), description: data.error || t('ai.intelligencePanel.failedToSendTestNotifications'), variant: "destructive" });
      }
    } catch (_error) {
      toast({ title: t('ai.intelligencePanel.error'), description: t('ai.intelligencePanel.failedToSendTestNotifications'), variant: "destructive" });
    }
  };

  const handleExecuteAction = async (actionType: string, actionData: unknown) => {
    setActiveAction(actionType);
    try {
      await fetch('/api/ai-assistant/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ actionType, actionData })
      });
      toast({ title: t('ai.intelligencePanel.actionExecuted'), description: t('ai.intelligencePanel.actionCompleted', { action: actionType }) });
    } catch (_error) {
      toast({ title: t('ai.intelligencePanel.error'), description: t('ai.intelligencePanel.failedToExecuteAction'), variant: "destructive" });
    } finally {
      setActiveAction(null);
    }
  };

  // Initialize COREVIA's personalized greeting with user's name
  // Also reset chat when user changes (to prevent "Hello Ahmed" showing for Fatma)
  useEffect(() => {
    if (currentUser) {
      const firstName = currentUser.displayName?.split(' ')[0] || 'there';
      const storedUserId = sessionStorage.getItem('coveria-chat-user-id');
      const greetingVersion = sessionStorage.getItem('corevia-greeting-version');
      const currentVersion = '2'; // Increment to force greeting refresh

      // If user changed, version changed, or no messages exist, reset the greeting
      if (storedUserId !== currentUser.id || greetingVersion !== currentVersion || chatMessages.length === 0) {
        sessionStorage.setItem('coveria-chat-user-id', currentUser.id);
        sessionStorage.setItem('corevia-greeting-version', currentVersion);
        setChatMessages([{
          role: 'assistant',
          content: `Hello ${firstName}, I'm Coveria, your Strategic Intelligence Advisor for the COREVIA platform. Delighted to assist you today.`,
          timestamp: new Date(),
          messageId: nanoid()
        }]);
        setHasSpokenGreeting(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Speak Coveria's greeting when chat opens for the first time
  useEffect(() => {
    if (isCoveriaOpen && !hasSpokenGreeting && voiceEnabled && chatMessages.length > 0) {
      const greeting = chatMessages[0]?.content;
      // Check for Coveria or COREVIA (case-insensitive)
      if (greeting && (greeting.toLowerCase().includes("coveria") || greeting.toLowerCase().includes("corevia"))) {
        // Small delay to ensure UI is ready and user interaction has occurred
        const timer = setTimeout(() => {
          speak(greeting);
          setHasSpokenGreeting(true);
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCoveriaOpen, hasSpokenGreeting, voiceEnabled, chatMessages]);

  // Fetch regular notifications
  const { data: regularNotificationsData } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const response = await fetch("/api/notifications?limit=10");
      if (!response.ok) throw new Error("Failed to fetch notifications");
      const result = await response.json();
      return result.data as Notification[];
    },
    refetchInterval: 30000,
  });

  // Fetch COREVIA AI notifications
  const { data: aiNotificationsData } = useQuery({
    queryKey: ["/api/ai-assistant/notifications"],
    queryFn: async () => {
      const response = await fetch("/api/ai-assistant/notifications");
      if (!response.ok) throw new Error("Failed to fetch AI notifications");
      const result = await response.json();
      return result.data as Array<{
        id: string;
        title: string;
        message: string;
        type: string;
        priority: string;
        actionUrl?: string;
        isRead: boolean;
        createdAt: string;
      }>;
    },
    refetchInterval: 30000,
  });

  // Merge both notification sources into unified list
  const regularNotifications = Array.isArray(regularNotificationsData) ? regularNotificationsData : [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const aiNotifications = Array.isArray(aiNotificationsData) ? aiNotificationsData : [];

  // Track last spoken notification to avoid repeating
  const [lastSpokenNotificationId, setLastSpokenNotificationId] = useState<string | null>(null);

  // Auto-speak new unread COREVIA notifications when voice is enabled
  useEffect(() => {
    if (!voiceEnabled || aiNotifications.length === 0) return;

    // Find the newest unread notification
    const newestUnread = aiNotifications.find(n => !n.isRead);
    if (newestUnread && newestUnread.id !== lastSpokenNotificationId) {
      // Speak the notification after a short delay
      const timer = setTimeout(() => {
        speak(`${newestUnread.title}. ${newestUnread.message}`);
        setLastSpokenNotificationId(newestUnread.id);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [aiNotifications, voiceEnabled, lastSpokenNotificationId, speak]);

  // Convert AI notifications to match regular notification format and merge
  const allNotifications = [
    ...regularNotifications.map(n => ({ ...n, source: 'regular' as const })),
    ...aiNotifications.map(n => ({
      ...n,
      source: 'coveria' as const,
      metadata: { projectId: n.actionUrl?.match(/\/project\/([^?]+)/)?.[1] || n.actionUrl?.match(/\/project-workspace\/([^?]+)/)?.[1] }
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const notifications = allNotifications.slice(0, 10);
  const unreadCount = allNotifications.filter((n) => !n.isRead).length;
  const visibleNotifications = notifications;

  const teamOnlineSection = (
    <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full pulse-glow"></div>
        <h4 className="font-semibold text-sm text-primary">{t('ai.intelligencePanel.teamOnline')}</h4>
        <Badge variant="secondary" className="h-5 px-2 text-xs ml-auto">
          {onlineUsers.filter(u => u.status === 'online').length}
        </Badge>
      </div>

      {onlineUsers.length > 0 ? (
        <div className="space-y-2">
          {onlineUsers.slice(0, 6).map((user) => (
            <div
              key={user.userId}
              className="glass-card rounded-lg p-2.5 flex items-center gap-3 group hover:shadow-md transition-all"
              data-testid={`online-user-${user.userId}`}
            >
              <div className="relative">
                <Avatar className="h-8 w-8 border-2 border-background">
                  <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-purple-500/20">
                    {user.displayName?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <Circle
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                    user.status === 'online' ? 'fill-emerald-500 text-emerald-500' :
                    user.status === 'away' ? 'fill-amber-500 text-amber-500' :
                    user.status === 'busy' ? 'fill-red-500 text-red-500' :
                    'fill-muted text-muted'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                  {user.displayName || t('ai.intelligencePanel.unknownUser')}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {user.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-lg p-4 border-dashed">
          <div className="text-center">
            <Users className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">{t('ai.intelligencePanel.noTeamMembersOnline')}</p>
          </div>
        </div>
      )}

      {onlineUsers.length > 6 && (
        <p className="text-xs text-center text-muted-foreground">
          +{t('ai.intelligencePanel.moreOnline', { count: onlineUsers.length - 6 })}
        </p>
      )}
    </div>
  );

  const handleMarkAsRead = (e: React.MouseEvent, notificationId: string, source: 'regular' | 'coveria') => {
    e.stopPropagation();
    const endpoint = source === 'coveria'
      ? `/api/ai-assistant/notifications/${notificationId}/read`
      : `/api/notifications/${notificationId}/read`;
    apiRequest("PATCH", endpoint)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/notifications"] });
        toast({ title: t('ai.intelligencePanel.markedAsRead') });
      })
      .catch(() => toast({ title: t('ai.intelligencePanel.error'), description: t('ai.intelligencePanel.failedToMarkAsRead'), variant: "destructive" }));
  };

  const handleGoToSection = (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    const actionUrl = getNotificationActionUrl(notification);
    if (actionUrl) {
      setLocation(actionUrl);
    }
  };

  const getNotificationActionLabel = (notification: Notification & { actionUrl?: string; source?: 'regular' | 'coveria' }): string => {
    if (isDemandNotification(notification)) {
      return t('notifications.reviewRequestStatus');
    }
    return t('notifications.open');
  };

  const handleDeleteNotification = (e: React.MouseEvent, notificationId: string, source: 'regular' | 'coveria') => {
    e.stopPropagation();
    const endpoint = source === 'coveria'
      ? `/api/ai-assistant/notifications/${notificationId}/dismiss`
      : `/api/notifications/${notificationId}`;
    const method = source === 'coveria' ? 'PATCH' : 'DELETE';
    apiRequest(method, endpoint)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/notifications"] });
        toast({ title: t('ai.intelligencePanel.notificationDismissed') });
      })
      .catch(() => toast({ title: t('ai.intelligencePanel.error'), description: t('ai.intelligencePanel.failedToDismiss'), variant: "destructive" }));
  };


  return (
    <div className={`intelligence-panel rounded-xl flex flex-col h-full relative overflow-hidden ${compact ? 'p-4 min-h-0 max-h-full' : 'p-5 min-h-[400px] max-h-[85vh]'}`}>
      {selectedPortal ? (
        // Dynamic Portal View with Animations
        <div className="space-y-6 h-full relative z-10">
          {/* Holographic Avatar Section */}
          <div className="text-center relative">
            <div className="relative mx-auto mb-4">
              <div className={`h-20 w-20 rounded-2xl ${selectedPortal.color} flex items-center justify-center text-white shadow-2xl float-animation pulse-glow`}>
                <div className="text-xl">
                  {selectedPortal.icon}
                </div>
              </div>
              {/* Orbital Rings */}
              <div className="absolute inset-0 rounded-full border border-primary/20 animate-spin" style={{animationDuration: '8s'}}></div>
              <div className="absolute inset-2 rounded-full border border-primary/10 animate-spin" style={{animationDuration: '12s', animationDirection: 'reverse'}}></div>
            </div>
            <h3 className="font-bold text-xl mb-2 bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              {selectedPortal.title}
            </h3>
            <p className="text-sm text-muted-foreground/80 mb-4">
              {selectedPortal.description}
            </p>
          </div>

          {/* Radial Progress & Features */}
          <div className="space-y-4 flex-1">
            {/* Usage Analytics Circle */}
            <div className="glass-card rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">{t('ai.intelligencePanel.systemHealth')}</span>
                <span className="text-sm font-bold text-primary">{selectedPortal.usageLevel}%</span>
              </div>
              <div className="relative w-full bg-muted/30 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-1000 ${selectedPortal.color} relative overflow-hidden`}
                  style={{width: `${selectedPortal.usageLevel}%`}}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Features Timeline */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-primary">{t('ai.intelligencePanel.activeFeatures')}</h4>
              {selectedPortal.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3 text-sm group">
                  <div className="h-2 w-2 bg-gradient-to-r from-primary to-purple-500 rounded-full pulse-glow"></div>
                  <span className="group-hover:text-primary transition-colors duration-200">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // Default Intelligence Hub View with Animations
        <>
          {/* COREVIA - Strategic Intelligence Advisor */}
          <div className={`text-center relative ${compact ? 'mb-2' : 'mb-3'}`}>
            <button
              ref={avatarRef}
              onClick={() => {
                console.log('[COREVIA] Button clicked, opening chat...');
                openCoveria();
              }}
              className="relative mx-auto mb-2 cursor-pointer group focus:outline-none flex items-center justify-center z-50"
              style={{ width: compact ? 104 : 140, height: compact ? 104 : 140 }}
              data-testid="button-open-coveria"
              aria-label="Open COREVIA chat"
              type="button"
            >
              <div className="relative flex items-center justify-center transition-transform duration-300 group-hover:scale-105" style={{ width: compact ? 104 : 140, height: compact ? 104 : 140 }}>
                {/* Orbiting colorful dots — no lines */}
                <div className="absolute inset-0 pointer-events-none" style={{ animation: 'cvOrbitIP 12s linear infinite' }}>
                  <div className="absolute w-3 h-3 rounded-full" style={{ top: 0, left: '50%', marginLeft: -6, background: 'linear-gradient(135deg, #06b6d4, #22d3ee)', boxShadow: '0 0 8px 2px rgba(6,182,212,0.5)' }} />
                  <div className="absolute w-2.5 h-2.5 rounded-full" style={{ top: '50%', right: 0, marginTop: -5, background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', boxShadow: '0 0 8px 2px rgba(139,92,246,0.5)' }} />
                  <div className="absolute w-2 h-2 rounded-full" style={{ bottom: 0, left: '50%', marginLeft: -4, background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', boxShadow: '0 0 8px 2px rgba(245,158,11,0.5)' }} />
                  <div className="absolute w-2.5 h-2.5 rounded-full" style={{ top: '50%', left: 0, marginTop: -5, background: 'linear-gradient(135deg, #10b981, #34d399)', boxShadow: '0 0 8px 2px rgba(16,185,129,0.5)' }} />
                </div>
                {/* Second orbit — counter-rotating */}
                <div className="absolute pointer-events-none" style={{ inset: compact ? 6 : 8, animation: 'cvOrbitIPReverse 9s linear infinite' }}>
                  <div className="absolute w-[7px] h-[7px] rounded-full" style={{ top: '12%', right: '5%', background: 'linear-gradient(135deg, #ec4899, #f472b6)', boxShadow: '0 0 6px 1px rgba(236,72,153,0.5)' }} />
                  <div className="absolute w-[6px] h-[6px] rounded-full" style={{ bottom: '12%', left: '5%', background: 'linear-gradient(135deg, #3b82f6, #60a5fa)', boxShadow: '0 0 6px 1px rgba(59,130,246,0.5)' }} />
                  <div className="absolute w-[5px] h-[5px] rounded-full" style={{ top: '5%', left: '20%', background: 'linear-gradient(135deg, #14b8a6, #5eead4)', boxShadow: '0 0 5px 1px rgba(20,184,166,0.4)' }} />
                </div>
                {/* Logo */}
                <HexagonLogoFrame px={compact ? 64 : 96} animated />
                {/* Notification dot orbiting */}
                {unreadCount > 0 && (
                  <div className="absolute pointer-events-none" style={{ inset: -2, animation: 'cvOrbitIP 4s linear infinite' }}>
                    <div className="absolute min-w-[20px] h-[20px] rounded-full bg-rose-500 flex items-center justify-center shadow-[0_2px_10px_rgba(244,63,94,0.45)] ring-2 ring-white dark:ring-slate-900"
                      style={{ top: 0, left: '50%', marginLeft: -10 }}>
                      <span className="text-[9px] font-bold text-white px-1">{unreadCount > 9 ? '9+' : unreadCount}</span>
                    </div>
                  </div>
                )}
              </div>
              <style>{`
                @keyframes cvOrbitIP {
                  from { transform: rotate(0deg); }
                  to   { transform: rotate(360deg); }
                }
                @keyframes cvOrbitIPReverse {
                  from { transform: rotate(360deg); }
                  to   { transform: rotate(0deg); }
                }
              `}</style>

              {/* Hover Tooltip */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="bg-foreground text-background text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                  Click to chat with COREVIA
                </div>
              </div>
            </button>

            <div className={`flex flex-col items-center ${compact ? 'gap-0' : 'gap-0.5'}`}>
              <h3 className={`font-bold bg-gradient-to-r from-violet-400 via-primary to-indigo-400 bg-clip-text text-transparent ${compact ? 'text-base' : 'text-lg'}`}>
                COREVIA
              </h3>
              <Badge variant="secondary" className={compact ? 'text-[10px] h-5' : 'text-xs'}>
                {t('ai.intelligencePanel.hello', { name: currentUser?.displayName?.split(' ')[0] })}
              </Badge>
            </div>
          </div>

          {/* Scrollable Content - Shows Chat or Notifications */}
          <ScrollArea className={`flex-1 ${compact ? '-mx-4 px-4' : '-mx-5 px-5'}`}>
            <div className={`relative z-10 ${compact ? 'space-y-3' : 'space-y-4'}`}>
              {/* COREVIA Chat or Notifications Section */}
              {!isCoveriaOpen && (
              <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-gradient-to-r from-primary to-purple-500 rounded-full pulse-glow"></div>
                  <h4 className="font-semibold text-sm text-primary">{t('ai.intelligencePanel.notifications')}</h4>
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="h-5 px-2 text-xs animate-pulse ml-auto">
                      {unreadCount}
                    </Badge>
                  )}
                </div>

                {visibleNotifications.length > 0 ? (
                  <div className="space-y-2">
                    {visibleNotifications.map((notification) => (
                      <div
                        key={`${notification.source}-${notification.id}`}
                        className={`glass-card rounded-lg transition-all ${compact ? 'p-2.5' : 'p-3'} ${
                          !notification.isRead
                            ? notification.source === 'coveria'
                              ? "border-violet-500/40"
                              : "border-primary/40"
                            : "border-border/30"
                        }`}
                        data-testid={`notification-${notification.source}-${notification.id}`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${
                            !notification.isRead
                              ? notification.source === 'coveria'
                                ? "bg-gradient-to-r from-violet-500 to-indigo-500 pulse-glow"
                                : "bg-gradient-to-r from-primary to-purple-500 pulse-glow"
                              : "bg-muted-foreground/30"
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <p className="text-xs font-medium">
                                {notification.title}
                              </p>
                              {notification.source === 'coveria' && (
                                <Badge variant="outline" className="text-[8px] h-4 px-1 border-violet-500/50 text-violet-600 dark:text-violet-400">
                                  COREVIA
                                </Badge>
                              )}
                            </div>
                            <p
                              className={`text-muted-foreground mb-1.5 ${compact ? 'text-[11px] leading-4.5' : 'text-xs'}`}
                              style={compact ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}
                            >
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground/60 mb-2">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </p>
                            <div className="flex items-center gap-1 mt-1.5">
                              {notification.source === 'regular' && (((notification as any).reportId) || typeof ((notification as any).metadata?.actionUrl) === 'string') && ( // eslint-disable-line @typescript-eslint/no-explicit-any
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-5 text-[9px] px-1.5 border-purple-500/50 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
                                  onClick={(e) => handleGoToSection(e, notification as any)} // eslint-disable-line @typescript-eslint/no-explicit-any
                                  data-testid={`button-view-${notification.id}`}
                                >
                                  <ChevronRight className="h-2.5 w-2.5 mr-0.5" />
                                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                  {getNotificationActionLabel(notification as any)}
                                </Button>
                              )}
                              {/* Take Action button for charter signature notifications */}
                              {(notification.type === 'charter_signature_required' || notification.type === 'action_required') && (notification.metadata as any)?.projectId && ( // eslint-disable-line @typescript-eslint/no-explicit-any
                                <Button
                                  size="sm"
                                  className="h-5 text-[9px] px-1.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLocation(`/project/${(notification.metadata as any).projectId}?tab=charter`); // eslint-disable-line @typescript-eslint/no-explicit-any
                                  }}
                                  data-testid={`button-action-${notification.id}`}
                                >
                                  <ChevronRight className="h-2.5 w-2.5 mr-0.5" />
                                  {t('ai.intelligencePanel.takeAction')}
                                </Button>
                              )}
                              {/* Take Action for COREVIA notifications with actionUrl */}
                              {notification.source === 'coveria' && (notification as any).actionUrl && ( // eslint-disable-line @typescript-eslint/no-explicit-any
                                <Button
                                  size="sm"
                                  className="h-5 text-[9px] px-1.5 bg-violet-600 hover:bg-violet-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const url = ((notification as any).actionUrl || '').replace('/project-workspace/', '/project/'); // eslint-disable-line @typescript-eslint/no-explicit-any
                                    setLocation(url);
                                  }}
                                  data-testid={`button-coveria-action-${notification.id}`}
                                >
                                  <ChevronRight className="h-2.5 w-2.5 mr-0.5" />
                                  {t('ai.intelligencePanel.takeAction')}
                                </Button>
                              )}
                              {!notification.isRead && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-5 text-[9px] px-1.5 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                                  onClick={(e) => handleMarkAsRead(e, notification.id, notification.source)}
                                  data-testid={`button-mark-read-${notification.id}`}
                                >
                                  <Check className="h-2.5 w-2.5 mr-0.5" />
                                  {t('ai.intelligencePanel.read')}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 text-[9px] px-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => handleDeleteNotification(e, notification.id, notification.source)}
                                data-testid={`button-delete-${notification.id}`}
                              >
                                <X className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="glass-card rounded-lg p-4 border-dashed">
                    <div className="text-center">
                      <Bell className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-xs text-muted-foreground">{t('ai.intelligencePanel.noNotifications')}</p>
                    </div>
                  </div>
                )}

                {notifications.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs hover-elevate"
                    onClick={() => setLocation("/intelligent-library")}
                    data-testid="button-view-all-notifications"
                  >
                    {t('ai.intelligencePanel.viewAll')}
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
              )}

              {/* Inline COREVIA Chat - Strategic Intelligence Console */}
              {isCoveriaOpen && (
                <div className="coveria-inline-chat-emerge glass-card rounded-xl p-3 border-violet-500/30">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/40 via-primary/40 to-indigo-500/40 rounded-full blur animate-pulse" style={{ animationDuration: '3s' }} />
                        <HexagonLogoFrame size="sm" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-xs bg-gradient-to-r from-violet-400 to-primary bg-clip-text text-transparent">COREVIA</h4>
                        <p className="text-[9px] text-muted-foreground">{t('ai.intelligencePanel.strategicIntelligenceAdvisor')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[9px] h-5 border-emerald-500/50 text-emerald-600">
                        <Circle className="h-1.5 w-1.5 fill-emerald-500 mr-1" />
                        {t('ai.intelligencePanel.online')}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={closeCoveria}
                        data-testid="button-close-inline-coveria"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Tabs for Chat, Insights, Market, Actions */}
                  <Tabs defaultValue="chat" className="flex-1 flex flex-col">
                    <TabsList className="grid grid-cols-4 h-7 mb-2">
                      <TabsTrigger value="chat" className="text-[10px] h-6 px-1" data-testid="coveria-tab-chat">
                        <MessageSquare className="h-3 w-3 mr-0.5" />
                        {t('ai.intelligencePanel.tabChat')}
                      </TabsTrigger>
                      <TabsTrigger value="insights" className="text-[10px] h-6 px-1" data-testid="coveria-tab-insights">
                        <Zap className="h-3 w-3 mr-0.5" />
                        {t('ai.intelligencePanel.tabInsights')}
                      </TabsTrigger>
                      <TabsTrigger value="market" className="text-[10px] h-6 px-1" data-testid="coveria-tab-market">
                        <Globe className="h-3 w-3 mr-0.5" />
                        {t('ai.intelligencePanel.tabMarket')}
                      </TabsTrigger>
                      <TabsTrigger value="actions" className="text-[10px] h-6 px-1" data-testid="coveria-tab-actions">
                        <CheckSquare className="h-3 w-3 mr-0.5" />
                        {t('ai.intelligencePanel.tabActions')}
                      </TabsTrigger>
                    </TabsList>

                    {/* Chat Tab */}
                    <TabsContent value="chat" className="flex-1 flex flex-col mt-0 space-y-2">
                      {/* Voice status indicator */}
                      {listeningState !== 'idle' && (
                        <div className={`flex items-center justify-center gap-2 py-1.5 px-2 rounded-md text-[10px] ${
                          listeningState === 'listening' ? 'bg-emerald-500/20 text-emerald-600' :
                          'bg-violet-500/20 text-violet-600'
                        }`}>
                          <div className="flex items-center gap-1.5">
                            {listeningState === 'listening' && (
                              <>
                                <Mic className="h-3 w-3" />
                                <span>{t('ai.intelligencePanel.listening')}</span>
                              </>
                            )}
                            {listeningState === 'processing' && (
                              <>
                                <div className="flex gap-0.5">
                                  <div className="w-1 h-3 bg-violet-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                                  <div className="w-1 h-3 bg-violet-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                                  <div className="w-1 h-3 bg-violet-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span>{t('ai.intelligencePanel.listening')}</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Voice controls */}
                      <div className="flex items-center justify-between gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 text-[9px] px-1.5"
                          onClick={() => {
                            const firstName = currentUser?.displayName?.split(' ')[0] || 'there';
                            clearChat(`Hello ${firstName}, I'm COREVIA, your Strategic Intelligence Advisor. Delighted to assist you today.`);
                          }}
                          data-testid="button-clear-chat"
                        >
                          <X className="h-2.5 w-2.5 mr-0.5" />
                          {t('ai.intelligencePanel.clear')}
                        </Button>
                        <div className="flex items-center gap-1">
                          <Button
                            variant={voiceEnabled ? "default" : "ghost"}
                            size="sm"
                            className={`h-5 text-[9px] px-1.5 ${voiceEnabled ? 'bg-primary/20' : ''} ${isSpeaking ? 'animate-pulse' : ''}`}
                            onClick={() => {
                              if (isSpeaking) {
                                stopSpeaking();
                              } else {
                                toggleVoice();
                              }
                            }}
                            data-testid="button-toggle-voice"
                          >
                            {isSpeaking ? (
                              <>
                                <Volume2 className="h-2.5 w-2.5 mr-0.5 text-primary" />
                                {t('ai.intelligencePanel.stop')}
                              </>
                            ) : voiceEnabled ? (
                              <>
                                <Volume2 className="h-2.5 w-2.5 mr-0.5" />
                                {t('ai.intelligencePanel.voice')}
                              </>
                            ) : (
                              <>
                                <VolumeX className="h-2.5 w-2.5 mr-0.5" />
                                {t('ai.intelligencePanel.muted')}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Messages area - fixed height with scroll */}
                      <div className="h-64 overflow-y-auto space-y-2 pr-1">
                        {chatMessages.map((msg, i) => (
                          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            <div className={`rounded-lg px-2 py-1.5 text-[11px] max-w-[85%] ${
                              msg.role === 'assistant' ? 'bg-violet-500/10' : 'bg-primary/10'
                            }`}>
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                              {msg.timestamp && (
                                <p className="text-[8px] text-muted-foreground mt-1">
                                  {formatDistanceToNow(msg.timestamp, { addSuffix: true })}
                                </p>
                              )}
                              {/* Structured Output - Agentic Actions */}
                              {msg.structuredOutput && msg.structuredOutput.length > 0 && (
                                <div className="mt-2 space-y-1 pt-2 border-t border-border/30">
                                  <p className="text-[9px] font-medium text-primary flex items-center gap-1">
                                    <Zap className="h-2.5 w-2.5" />
                    {t('ai.intelligencePanel.actions')}
                                  </p>
                                  {msg.structuredOutput.map((output, j) => (
                                    <div key={j} className="flex items-center justify-between gap-1 p-1 rounded bg-primary/5">
                                      <div className="flex items-center gap-1">
                                        {output.type === 'task' && <FileText className="h-2.5 w-2.5 text-primary" />}
                                        {output.type === 'report' && <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />}
                                        {output.type === 'alert' && <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />}
                                        <span className="text-[9px]">{output.title}</span>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-4 text-[8px] px-1"
                                        onClick={() => handleExecuteAction(output.type, output.data)}
                                        disabled={activeAction === output.type}
                                      >
                                        <Play className="h-2 w-2" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {msg.role === 'user' && (
                              <Avatar className="h-5 w-5 flex-shrink-0">
                                <AvatarFallback className="text-[8px] bg-primary/20">
                                  {currentUser?.displayName?.[0] || 'U'}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        ))}
                        {isSending && (
                          <div className="flex gap-2">
                            <div className="bg-violet-500/10 rounded-lg px-2 py-1.5 text-[11px]">
                              <div className="flex items-center gap-1">
                                <div className="flex gap-0.5">
                                  <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span className="text-muted-foreground text-[10px]">{t('ai.intelligencePanel.analysing')}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Input area with mic */}
                      <div className="flex gap-1.5">
                        <Button
                          variant={listeningState !== 'idle' ? "destructive" : "outline"}
                          size="sm"
                          className={`h-7 w-7 p-0 ${listeningState !== 'idle' ? 'animate-pulse' : ''}`}
                          onClick={listeningState !== 'idle' ? stopVoiceInput : startListeningSimple}
                          data-testid="button-mic-coveria"
                        >
                          <Mic className="h-3 w-3" />
                        </Button>
                        <input
                          type="text"
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          onFocus={stopSpeaking}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                          placeholder={t('ai.intelligencePanel.askCorevia')}
                          className="flex-1 h-7 px-2 text-[11px] rounded-lg bg-background/50 border border-violet-500/30 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                          data-testid="input-inline-coveria"
                        />
                        <Button
                          size="sm"
                          className="h-7 w-7 p-0 bg-gradient-to-r from-violet-600 to-primary hover:from-violet-500 hover:to-primary/90"
                          onClick={handleSendChat}
                          disabled={isSending || !chatMessage.trim()}
                          data-testid="button-send-inline-coveria"
                        >
                          <Send className="h-3 w-3" />
                        </Button>
                      </div>
                    </TabsContent>

                    {/* Insights Tab - Dynamic Data */}
                    <TabsContent value="insights" className="mt-0">
                      <div className="h-64 overflow-y-auto space-y-2">
                        <div className="space-y-3 pr-3">
                          {/* Portfolio Health Insight - Dynamic */}
                          {atRiskProjects.length > 0 ? (
                            <Card
                              className={`cursor-pointer transition-all hover:border-amber-500/60 ${expandedInsight === 'portfolio' ? 'border-amber-500/60' : 'border-border/50'}`}
                              onClick={() => setExpandedInsight(expandedInsight === 'portfolio' ? null : 'portfolio')}
                              data-testid="insight-portfolio-health"
                            >
                              <div className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2">
                                    <div className="p-1.5 rounded-md bg-amber-500/10">
                                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold">{t('ai.intelligencePanel.portfolioHealthAlert')}</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">{t('ai.intelligencePanel.requireAttention', { count: atRiskProjects.length })}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className="text-[9px] h-5 border-amber-500/50 text-amber-600">
                                      {atRiskProjects.some(p => p.healthStatus === 'critical') ? t('ai.intelligencePanel.critical') : t('ai.intelligencePanel.atRisk')}
                                    </Badge>
                                    {expandedInsight === 'portfolio' ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                  </div>
                                </div>

                                {expandedInsight === 'portfolio' && (
                                  <div className="mt-3 pt-3 border-t border-border/50">
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-[10px]">
                                        <span className="text-muted-foreground w-16">{t('ai.intelligencePanel.total')}:</span>
                                        <span>{t('ai.intelligencePanel.projectsInPortfolio', { count: portfolioStats?.totalProjects || projects.length })}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px]">
                                        <span className="text-muted-foreground w-16">{t('ai.intelligencePanel.active')}:</span>
                                        <span>{t('ai.intelligencePanel.activeProjects', { count: portfolioStats?.activeProjects || projects.filter(p => p.healthStatus !== 'completed').length })}</span>
                                      </div>
                                      <Separator className="my-2" />
                                      <p className="text-[10px] font-medium">{t('ai.intelligencePanel.projectsRequiringAttention')}:</p>
                                      <ul className="text-[10px] text-muted-foreground space-y-1 ml-2">
                                        {atRiskProjects.slice(0, 5).map((p, i) => (
                                          <li key={i}>• {p.projectName} - {p.healthStatus === 'critical' ? t('ai.intelligencePanel.critical') : t('ai.intelligencePanel.atRisk')} ({p.overallProgress}% complete)</li>
                                        ))}
                                      </ul>
                                      <div className="flex gap-2 mt-3">
                                        <Button size="sm" className="h-7 text-[10px] flex-1" onClick={(e) => { e.stopPropagation(); closeCoveria(); setLocation('/intelligent-portfolio'); }}>
                                          <TrendingUp className="h-3 w-3 mr-1" />
                                          {t('ai.intelligencePanel.viewPortfolio')}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </Card>
                          ) : (
                            <Card className="border-emerald-500/30" data-testid="insight-portfolio-healthy">
                              <div className="p-3">
                                <div className="flex items-start gap-2">
                                  <div className="p-1.5 rounded-md bg-emerald-500/10">
                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold">{t('ai.intelligencePanel.portfolioHealthGood')}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{t('ai.intelligencePanel.allProjectsOnTrack', { count: projects.length })}</p>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          )}

                          {/* Budget Insight - Dynamic */}
                          <Card
                            className={`cursor-pointer transition-all hover:border-${budgetOverruns.length > 0 ? 'amber' : 'emerald'}-500/60 ${expandedInsight === 'budget' ? `border-${budgetOverruns.length > 0 ? 'amber' : 'emerald'}-500/60` : 'border-border/50'}`}
                            onClick={() => setExpandedInsight(expandedInsight === 'budget' ? null : 'budget')}
                            data-testid="insight-budget"
                          >
                            <div className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2">
                                  <div className={`p-1.5 rounded-md ${budgetOverruns.length > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                                    <TrendingUp className={`h-3.5 w-3.5 ${budgetOverruns.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold">
                                      {budgetOverruns.length > 0 ? t('ai.intelligencePanel.budgetVarianceDetected') : t('ai.intelligencePanel.budgetStatusOnTrack')}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      {budgetOverruns.length > 0
                                        ? t('ai.intelligencePanel.projectsOverBudget', { count: budgetOverruns.length })
                                        : t('ai.intelligencePanel.projectsWithinBudget', { count: projects.length })}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className={`text-[9px] h-5 ${budgetOverruns.length > 0 ? 'border-amber-500/50 text-amber-600' : 'border-emerald-500/50 text-emerald-600'}`}>
                                    {budgetOverruns.length > 0 ? t('ai.intelligencePanel.review') : t('ai.intelligencePanel.good')}
                                  </Badge>
                                  {expandedInsight === 'budget' ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                </div>
                              </div>

                              {expandedInsight === 'budget' && (
                                <div className="mt-3 pt-3 border-t border-border/50">
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[10px]">
                                      <span className="text-muted-foreground w-20">{t('ai.intelligencePanel.totalBudget')}:</span>
                                      <span>AED {((portfolioStats?.totalBudget || 0) / 1000000).toFixed(1)}M</span>
                                    </div>
                                    {budgetOverruns.length > 0 && (
                                      <>
                                        <div className="flex items-center gap-2 text-[10px]">
                                          <span className="text-muted-foreground w-20">{t('ai.intelligencePanel.variance')}:</span>
                                          <span className="text-amber-600 font-medium">AED {(totalBudgetVariance / 1000000).toFixed(2)}M over</span>
                                        </div>
                                        <Separator className="my-2" />
                                        <p className="text-[10px] font-medium">{t('ai.intelligencePanel.overBudgetProjects')}:</p>
                                        <ul className="text-[10px] text-muted-foreground space-y-1 ml-2">
                                          {budgetOverruns.slice(0, 3).map((p, i) => (
                                            <li key={i}>• {p.projectName} (+AED {((p.actualSpend - p.approvedBudget) / 1000).toFixed(0)}K)</li>
                                          ))}
                                        </ul>
                                      </>
                                    )}
                                    <div className="flex gap-2 mt-3">
                                      <Button size="sm" className="h-7 text-[10px] flex-1" onClick={(e) => { e.stopPropagation(); closeCoveria(); setLocation('/intelligent-portfolio'); }}>
                                        <FileText className="h-3 w-3 mr-1" />
                                        {t('ai.intelligencePanel.viewDetails')}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </Card>

                          {/* Utilization Rate Insight */}
                          <Card
                            className={`cursor-pointer transition-all hover:border-blue-500/60 ${expandedInsight === 'utilization' ? 'border-blue-500/60' : 'border-border/50'}`}
                            onClick={() => setExpandedInsight(expandedInsight === 'utilization' ? null : 'utilization')}
                            data-testid="insight-utilization"
                          >
                            <div className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2">
                                  <div className="p-1.5 rounded-md bg-blue-500/10">
                                    <Users className="h-3.5 w-3.5 text-blue-500" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold">{t('ai.intelligencePanel.resourceUtilization')}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{t('ai.intelligencePanel.capacityUtilized', { value: portfolioStats?.utilizationRate || 0 })}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className="text-[9px] h-5 border-blue-500/50 text-blue-600">{t('ai.intelligencePanel.info')}</Badge>
                                  {expandedInsight === 'utilization' ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                </div>
                              </div>
                            </div>
                          </Card>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Market Research Tab - AI-Powered Market Intelligence */}
                    <TabsContent value="market" className="mt-0">
                      <div className="h-64 overflow-y-auto space-y-2">
                        {!marketResearch ? (
                          <div className="flex flex-col items-center justify-center h-full space-y-3 p-4">
                            <div className="p-3 rounded-full bg-gradient-to-br from-primary/10 to-violet-500/10">
                              <Globe className="h-8 w-8 text-primary" />
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-semibold">{t('ai.intelligencePanel.aiMarketIntelligence')}</p>
                              <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px]">
                                {t('ai.intelligencePanel.marketResearchPrompt')}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              className="h-8 text-[11px]"
                              onClick={() => generateMarketResearch()}
                              disabled={isGeneratingResearch}
                              data-testid="button-generate-market-research"
                            >
                              {isGeneratingResearch ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                  {t('ai.intelligencePanel.analyzing')}
                                </>
                              ) : (
                                <>
                                  <Zap className="h-3 w-3 mr-1.5" />
                                  {t('ai.intelligencePanel.generateResearch')}
                                </>
                              )}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2 pr-1">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[9px] text-muted-foreground">
                                Generated {formatDistanceToNow(new Date(marketResearch.generatedAt), { addSuffix: true })}
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 text-[9px] px-1.5"
                                onClick={() => generateMarketResearch()}
                                disabled={isGeneratingResearch}
                                data-testid="button-refresh-research"
                              >
                                <RefreshCw className={`h-2.5 w-2.5 mr-0.5 ${isGeneratingResearch ? 'animate-spin' : ''}`} />
                                {t('ai.intelligencePanel.refresh')}
                              </Button>
                            </div>

                            {/* Global Market Section */}
                            <Card
                              className={`cursor-pointer transition-all hover:border-blue-500/60 ${expandedMarketSection === 'global' ? 'border-blue-500/60' : 'border-border/50'}`}
                              onClick={() => setExpandedMarketSection(expandedMarketSection === 'global' ? null : 'global')}
                              data-testid="market-section-global"
                            >
                              <div className="p-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2">
                                    <div className="p-1.5 rounded-md bg-blue-500/10">
                                      <Globe className="h-3 w-3 text-blue-500" />
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-semibold">{t('ai.intelligencePanel.globalMarket')}</p>
                                      <p className="text-[9px] text-muted-foreground">{marketResearch.globalMarket.marketSize}</p>
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-[8px] h-4 border-blue-500/50 text-blue-600">
                                    {marketResearch.globalMarket.growthRate}
                                  </Badge>
                                </div>

                                {expandedMarketSection === 'global' && (
                                  <div className="mt-2 pt-2 border-t border-border/50 space-y-3">
                                    {/* Top 3 Countries */}
                                    {marketResearch.globalMarket.topCountries && marketResearch.globalMarket.topCountries.length > 0 && (
                                      <div>
                                        <p className="text-[9px] font-medium mb-1.5 flex items-center gap-1">
                                          <Globe className="h-2.5 w-2.5 text-blue-500" />
                                          {t('ai.intelligencePanel.top3Markets')}
                                        </p>
                                        <div className="space-y-1.5">
                                          {marketResearch.globalMarket.topCountries.slice(0, 3).map((country, i) => (
                                            <div key={i} className="p-1.5 rounded bg-muted/30 border border-border/30">
                                              <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-1.5">
                                                  <span className="text-[10px] font-bold text-blue-500">#{country.rank}</span>
                                                  <span className="text-[9px] font-semibold">{country.country}</span>
                                                </div>
                                                <Badge
                                                  variant="outline"
                                                  className={`text-[7px] h-3.5 px-1 ${
                                                    country.adoptionMaturity === 'Leading' ? 'border-emerald-500/50 text-emerald-600' :
                                                    country.adoptionMaturity === 'Mature' ? 'border-blue-500/50 text-blue-600' :
                                                    country.adoptionMaturity === 'Growing' ? 'border-amber-500/50 text-amber-600' :
                                                    'border-slate-500/50 text-slate-600'
                                                  }`}
                                                >
                                                  {country.adoptionMaturity}
                                                </Badge>
                                              </div>
                                              <div className="flex items-center gap-2 text-[8px] text-muted-foreground">
                                                <span>{country.marketSize}</span>
                                                <span className="text-emerald-500">{country.growthRate}</span>
                                              </div>
                                              {country.keyDrivers && country.keyDrivers.length > 0 && (
                                                <p className="text-[7px] text-muted-foreground mt-0.5 line-clamp-1">
                                                  {country.keyDrivers[0]}
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Key Trends */}
                                    <div>
                                      <p className="text-[9px] font-medium mb-1">{t('ai.intelligencePanel.keyTrends')}</p>
                                      <ul className="text-[9px] text-muted-foreground space-y-0.5">
                                        {marketResearch.globalMarket.keyTrends.slice(0, 4).map((trend, i) => (
                                          <li key={i} className="flex items-start gap-1">
                                            <TrendingUp className="h-2.5 w-2.5 text-emerald-500 mt-0.5 shrink-0" />
                                            <span>{trend}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>

                                    {/* Major Players - Enhanced */}
                                    <div>
                                      <p className="text-[9px] font-medium mb-1.5 flex items-center gap-1">
                                        <Building2 className="h-2.5 w-2.5 text-violet-500" />
                                        {t('ai.intelligencePanel.majorGlobalPlayers')}
                                      </p>
                                      <div className="space-y-1.5">
                                        {marketResearch.globalMarket.majorPlayers.slice(0, 6).map((player, i) => (
                                          <div key={i} className="p-1.5 rounded bg-muted/30 border border-border/30">
                                            <div className="flex items-center justify-between mb-0.5">
                                              <span className="text-[9px] font-semibold">{player.name}</span>
                                              {player.marketShare && (
                                                <Badge variant="secondary" className="text-[7px] h-3.5 px-1">
                                                  {player.marketShare}
                                                </Badge>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[7px] text-muted-foreground">
                                              <span>{player.headquarters}</span>
                                              {player.annualRevenue && (
                                                <span className="text-emerald-500">{player.annualRevenue}</span>
                                              )}
                                            </div>
                                            {player.flagshipSolutions && player.flagshipSolutions.length > 0 && (
                                              <div className="flex flex-wrap gap-0.5 mt-1">
                                                {player.flagshipSolutions.slice(0, 3).map((solution, j) => (
                                                  <Badge key={j} variant="outline" className="text-[6px] h-3 px-1 border-violet-500/30 text-violet-600">
                                                    {solution}
                                                  </Badge>
                                                ))}
                                              </div>
                                            )}
                                            {player.regionalStrength && player.regionalStrength.length > 0 && (
                                              <p className="text-[7px] text-blue-500 mt-0.5">
                                                {t('ai.intelligencePanel.strongIn')}: {player.regionalStrength.slice(0, 3).join(', ')}
                                              </p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </Card>

                            {/* UAE Market Section */}
                            <Card
                              className={`cursor-pointer transition-all hover:border-emerald-500/60 ${expandedMarketSection === 'uae' ? 'border-emerald-500/60' : 'border-border/50'}`}
                              onClick={() => setExpandedMarketSection(expandedMarketSection === 'uae' ? null : 'uae')}
                              data-testid="market-section-uae"
                            >
                              <div className="p-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2">
                                    <div className="p-1.5 rounded-md bg-emerald-500/10">
                                      <MapPin className="h-3 w-3 text-emerald-500" />
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-semibold">{t('ai.intelligencePanel.uaeMarket')}</p>
                                      <p className="text-[9px] text-muted-foreground">{marketResearch.uaeMarket.marketSize}</p>
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-[8px] h-4 border-emerald-500/50 text-emerald-600">
                                    {marketResearch.uaeMarket.growthRate}
                                  </Badge>
                                </div>

                                {expandedMarketSection === 'uae' && (
                                  <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
                                    <div>
                                      <p className="text-[9px] font-medium mb-1">{t('ai.intelligencePanel.governmentInitiatives')}</p>
                                      <ul className="text-[9px] text-muted-foreground space-y-0.5">
                                        {marketResearch.uaeMarket.governmentInitiatives.slice(0, 3).map((init, i) => (
                                          <li key={i} className="flex items-start gap-1">
                                            <Building2 className="h-2.5 w-2.5 text-primary mt-0.5 shrink-0" />
                                            <span>{init}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                    <div>
                                      <p className="text-[9px] font-medium mb-1">{t('ai.intelligencePanel.localPlayers')}</p>
                                      <div className="flex flex-wrap gap-1">
                                        {marketResearch.uaeMarket.localPlayers.slice(0, 5).map((player, i) => (
                                          <Badge key={i} variant="secondary" className="text-[8px] h-4">
                                            {player.name}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </Card>

                            {/* Suppliers Section */}
                            <Card
                              className={`cursor-pointer transition-all hover:border-amber-500/60 ${expandedMarketSection === 'suppliers' ? 'border-amber-500/60' : 'border-border/50'}`}
                              onClick={() => setExpandedMarketSection(expandedMarketSection === 'suppliers' ? null : 'suppliers')}
                              data-testid="market-section-suppliers"
                            >
                              <div className="p-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2">
                                    <div className="p-1.5 rounded-md bg-amber-500/10">
                                      <Package className="h-3 w-3 text-amber-500" />
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-semibold">{t('ai.intelligencePanel.suppliersAndProviders')}</p>
                                      <p className="text-[9px] text-muted-foreground">{t('ai.intelligencePanel.vendorsIdentified', { count: marketResearch.suppliers.length })}</p>
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-[8px] h-4 border-amber-500/50 text-amber-600">
                                    {marketResearch.suppliers.filter(s => s.uaePresence).length} UAE
                                  </Badge>
                                </div>

                                {expandedMarketSection === 'suppliers' && (
                                  <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
                                    {marketResearch.suppliers.slice(0, 5).map((supplier, i) => (
                                      <div key={i} className="flex items-center justify-between text-[9px] py-0.5">
                                        <div className="flex items-center gap-1.5">
                                          <Briefcase className="h-2.5 w-2.5 text-muted-foreground" />
                                          <span className="font-medium">{supplier.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Badge variant="outline" className="text-[7px] h-3.5 px-1">
                                            {supplier.category}
                                          </Badge>
                                          {supplier.uaePresence && (
                                            <Badge className="text-[7px] h-3.5 px-1 bg-emerald-500/20 text-emerald-600">UAE</Badge>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </Card>

                            {/* Use Cases Section */}
                            <Card
                              className={`cursor-pointer transition-all hover:border-violet-500/60 ${expandedMarketSection === 'usecases' ? 'border-violet-500/60' : 'border-border/50'}`}
                              onClick={() => setExpandedMarketSection(expandedMarketSection === 'usecases' ? null : 'usecases')}
                              data-testid="market-section-usecases"
                            >
                              <div className="p-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2">
                                    <div className="p-1.5 rounded-md bg-violet-500/10">
                                      <Target className="h-3 w-3 text-violet-500" />
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-semibold">{t('ai.intelligencePanel.useCases')}</p>
                                      <p className="text-[9px] text-muted-foreground">{t('ai.intelligencePanel.opportunitiesIdentified', { count: marketResearch.useCases.length })}</p>
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-[8px] h-4 border-violet-500/50 text-violet-600">
                                    {t('ai.intelligencePanel.innovation')}
                                  </Badge>
                                </div>

                                {expandedMarketSection === 'usecases' && (
                                  <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
                                    {marketResearch.useCases.slice(0, 4).map((useCase, i) => (
                                      <div key={i} className="p-1.5 rounded bg-muted/30">
                                        <div className="flex items-start justify-between gap-1">
                                          <p className="text-[9px] font-medium">{useCase.title}</p>
                                          <Badge
                                            variant="outline"
                                            className={`text-[7px] h-3.5 px-1 ${
                                              useCase.implementationComplexity === 'Low' ? 'border-emerald-500/50 text-emerald-600' :
                                              useCase.implementationComplexity === 'Medium' ? 'border-amber-500/50 text-amber-600' :
                                              'border-red-500/50 text-red-600'
                                            }`}
                                          >
                                            {useCase.implementationComplexity}
                                          </Badge>
                                        </div>
                                        <p className="text-[8px] text-muted-foreground mt-0.5 line-clamp-2">{useCase.description}</p>
                                        <div className="flex items-center gap-1 mt-1">
                                          <Lightbulb className="h-2 w-2 text-amber-500" />
                                          <span className="text-[8px] text-amber-600">{useCase.estimatedROI}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </Card>

                            {/* Recommendations Section */}
                            {marketResearch.recommendations.length > 0 && (
                              <div className="mt-2 p-2 rounded-md bg-gradient-to-r from-primary/5 to-violet-500/5 border border-primary/20">
                                <p className="text-[9px] font-semibold text-primary mb-1.5 flex items-center gap-1">
                                  <Lightbulb className="h-3 w-3" />
                                  {t('ai.intelligencePanel.strategicRecommendations')}
                                </p>
                                <ul className="text-[9px] text-muted-foreground space-y-1">
                                  {marketResearch.recommendations.slice(0, 3).map((rec, i) => (
                                    <li key={i} className="flex items-start gap-1">
                                      <ChevronRight className="h-2.5 w-2.5 text-primary mt-0.5 shrink-0" />
                                      <span>{rec}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* Actions Tab - COREVIA's Autonomous Capabilities */}
                    <TabsContent value="actions" className="mt-0">
                      <div className="h-64 overflow-y-auto space-y-2">
                        <div className="space-y-2 pr-1">
                          <p className="text-[10px] text-muted-foreground text-center mb-2">
                            {t('ai.intelligencePanel.canExecuteActions')}
                          </p>

                          <Button
                            variant="outline"
                            className="w-full justify-start text-left h-auto py-2 px-2"
                            onClick={() => executeDirectAction("Generate my daily briefing")}
                            disabled={isSending}
                            data-testid="action-daily-briefing"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                              <div>
                                <p className="text-[11px] font-medium">{t('ai.intelligencePanel.dailyBriefing')}</p>
                                <p className="text-[9px] text-muted-foreground">{t('ai.intelligencePanel.dailyBriefingDescription')}</p>
                              </div>
                            </div>
                          </Button>

                          <Button
                            variant="outline"
                            className="w-full justify-start text-left h-auto py-2 px-2"
                            onClick={() => executeDirectAction("Detect anomalies across all projects and demands")}
                            disabled={isSending}
                            data-testid="action-detect-anomalies"
                          >
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              <div>
                                <p className="text-[11px] font-medium">{t('ai.intelligencePanel.detectAnomalies')}</p>
                                <p className="text-[9px] text-muted-foreground">{t('ai.intelligencePanel.detectAnomaliesDescription')}</p>
                              </div>
                            </div>
                          </Button>

                          <Button
                            variant="outline"
                            className="w-full justify-start text-left h-auto py-2 px-2"
                            onClick={() => executeDirectAction("Analyze risks across the portfolio")}
                            disabled={isSending}
                            data-testid="action-analyze-risks"
                          >
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                              <div>
                                <p className="text-[11px] font-medium">{t('ai.intelligencePanel.riskAnalysis')}</p>
                                <p className="text-[9px] text-muted-foreground">{t('ai.intelligencePanel.riskAnalysisDescription')}</p>
                              </div>
                            </div>
                          </Button>

                          <Button
                            variant="outline"
                            className="w-full justify-start text-left h-auto py-2 px-2"
                            onClick={() => executeDirectAction("Check everything and auto-generate alerts for critical issues")}
                            disabled={isSending}
                            data-testid="action-auto-alerts"
                          >
                            <div className="flex items-center gap-2">
                              <Bell className="h-3.5 w-3.5 text-destructive shrink-0" />
                              <div>
                                <p className="text-[11px] font-medium">{t('ai.intelligencePanel.autoGenerateAlerts')}</p>
                                <p className="text-[9px] text-muted-foreground">{t('ai.intelligencePanel.autoGenerateAlertsDescription')}</p>
                              </div>
                            </div>
                          </Button>

                          <Button
                            variant="outline"
                            className="w-full justify-start text-left h-auto py-2 px-2"
                            onClick={() => executeDirectAction("Give me an executive summary of the portfolio health")}
                            disabled={isSending}
                            data-testid="action-portfolio-health"
                          >
                            <div className="flex items-center gap-2">
                              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <div>
                                <p className="text-[11px] font-medium">{t('ai.intelligencePanel.portfolioHealthCheck')}</p>
                                <p className="text-[9px] text-muted-foreground">{t('ai.intelligencePanel.portfolioHealthCheckDescription')}</p>
                              </div>
                            </div>
                          </Button>

                          <Separator className="my-2" />

                          <p className="text-[9px] text-muted-foreground text-center">
                            {t('ai.intelligencePanel.agenticToolsNote')}
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {!compact && (
                <>
                  <Separator />
                  {teamOnlineSection}
                </>
              )}
            </div>
          </ScrollArea>
          {compact && (
            <div className="mt-3 pt-3 border-t border-border/40 shrink-0">
              {teamOnlineSection}
            </div>
          )}
        </>
      )}

      {/* Background Constellation Effect */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-4 right-4 w-2 h-2 bg-primary rounded-full orbit-animation"></div>
        <div className="absolute bottom-8 left-6 w-1 h-1 bg-purple-500 rounded-full orbit-animation-reverse"></div>
        <div className="absolute top-1/2 left-4 w-1.5 h-1.5 bg-blue-400 rounded-full float-animation"></div>
      </div>
    </div>
  );
}
