import {
  LogOut,
  Zap,
  FileText,
  Activity,
  Sparkles,
  Users,
  Shield,
  BarChart3,
  ChevronRight,
  UserPlus,
  MessageSquare,
  Video,
  Send,
  Phone,
  PhoneOff,
  Bell,
  X,
  Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Link, useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNow } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Notification } from "@shared/schema";
import { getNotificationActionUrl, isDemandNotification } from "@/shared/lib/notification-routing";

interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  message: string;
  timestamp: Date;
  senderName?: string;
}

interface ReportsResponse {
  data: unknown[];
}

interface ChatTypingPayload {
  isTyping: boolean;
  userId: string;
}

type SmartPanelProps = {
  mode?: "floating" | "embedded";
  contextTitle?: string;
  contextSubtitle?: string;
  contextData?: {
    title?: string;
    status?: string;
    feedback?: string;
    actions?: string[];
    urgency?: string;
    organization?: string;
    department?: string;
  };
  className?: string;
};

export default function SmartPanel({
  mode = "floating",
  contextTitle,
  contextSubtitle,
  contextData,
  className,
}: SmartPanelProps) {
  const isEmbedded = mode === "embedded";
  const { currentUser, logout, hasPermission } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const [isCollaborationExpanded, setIsCollaborationExpanded] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [videoCall, setVideoCall] = useState<{
    isActive: boolean;
    recipientId?: string;
    recipientName?: string;
  }>({ isActive: false });
  const [isPanelPinned, setIsPanelPinned] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [floatingTab, setFloatingTab] = useState<"alerts" | "chat" | "team">("alerts");
  const [coreviaMessages, setCoreviaMessages] = useState<Array<{ role: "assistant" | "user"; content: string }>>([
    { role: "assistant", content: "Welcome. I can help you refine your demand request, address feedback, and prepare updates." }
  ]);
  const [coreviaInput, setCoreviaInput] = useState("");
  const [isCoreviaSending, setIsCoreviaSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  const { isConnected, onlineUsers, send, subscribe } = useWebSocket();

  const { data: reportsResponse } = useQuery<ReportsResponse>({
    queryKey: ['/api/demand-reports'],
  });

  const reports = reportsResponse?.data || [];

  // Fetch notifications
  const { data: notificationsData } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const response = await fetch("/api/notifications?limit=50");
      if (!response.ok) throw new Error("Failed to fetch notifications");
      const result = await response.json();
      return result.data as Notification[];
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const notifications = notificationsData || [];
  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  const getNotificationActionLabel = (notification: Notification): string => {
    if (isDemandNotification(notification)) {
      return t('notifications.reviewRequestStatus');
    }
    return t('notifications.open');
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setIsPanelPinned(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
      setIsPanelPinned(false);
    }
  };

  const handlePanelMouseLeave = () => {
    if (isPanelPinned || isLoggingOut) return;

    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      if (!isPanelPinned && !isLoggingOut) {
        setIsHovered(false);
      }
    }, 500);
  };

  const handlePanelMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const quickCommands = [
    { icon: FileText, label: t('ai.smartPanel.newAssessment'), href: "/intelligent-gateway" },
    { icon: Activity, label: t('ai.smartPanel.viewReports'), href: "/intelligent-library" },
    ...(hasPermission?.("brain:view") ? [
      { icon: Shield, label: t('demand.productHome.brainConsole'), href: "/brain-console" }
    ] : []),
    ...(hasPermission?.("dlp:view") ? [
      { icon: Shield, label: "DLP Dashboard", href: "/admin/dlp" }
    ] : []),
    // Show admin links when user has management permissions
    ...(hasPermission?.("user:manage") || hasPermission?.("user:read") || hasPermission?.("team:manage") ? [
      { icon: Users, label: t('ai.smartPanel.userManagement'), href: "/admin/users" },
      { icon: UserPlus, label: t('ai.smartPanel.teamManagement'), href: "/admin/teams" }
    ] : []),
  ];

  // Subscribe to chat messages
  useEffect(() => {
    const unsubscribe = subscribe("chat:message", (payload: ChatMessage) => {
      setMessages((prev) => [...prev, payload]);
    });

    return unsubscribe;
  }, [subscribe]);

  // Subscribe to chat history
  useEffect(() => {
    const unsubscribe = subscribe("chat:history", (payload: ChatMessage[]) => {
      setMessages(payload.reverse());
    });

    return unsubscribe;
  }, [subscribe]);

  // Subscribe to typing indicators
  useEffect(() => {
    const unsubscribe = subscribe<ChatTypingPayload>("chat:typing", (payload) => {
      if (payload.isTyping && payload.userId !== currentUser?.id) {
        setTypingUsers((prev) => new Set(prev).add(payload.userId));
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(payload.userId);
            return next;
          });
        }, 3000);
      }
    });

    return unsubscribe;
  }, [subscribe, currentUser]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Request chat history when selecting a user
  useEffect(() => {
    if (selectedUser && currentUser) {
      send({
        type: "chat:history",
        payload: {
          userId: currentUser.id,
          recipientId: selectedUser,
          limit: 100,
        },
      });
    }
  }, [selectedUser, currentUser, send]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !currentUser || !selectedUser) return;

    send({
      type: "chat:message",
      payload: {
        senderId: currentUser.id,
        recipientId: selectedUser,
        message: newMessage,
      },
    });

    setNewMessage("");
  };

  const handleCoreviaSend = async () => {
    if (!coreviaInput.trim()) return;
    const userMessage = coreviaInput.trim();
    setCoreviaInput("");
    setCoreviaMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsCoreviaSending(true);
    try {
      const contextLines = [
        contextData?.title ? `Title: ${contextData.title}` : null,
        contextData?.status ? `Status: ${contextData.status}` : null,
        contextData?.urgency ? `Urgency: ${contextData.urgency}` : null,
        contextData?.organization ? `Organization: ${contextData.organization}` : null,
        contextData?.department ? `Department: ${contextData.department}` : null,
        contextData?.feedback ? `Feedback: ${contextData.feedback}` : null,
        contextData?.actions && contextData.actions.length > 0 ? `Action Required: ${contextData.actions.join("; ")}` : null,
      ].filter(Boolean);
      const contextMessage = contextLines.length > 0
        ? { role: "user" as const, content: `Demand context\n${contextLines.join("\n")}` }
        : null;

      const response = await apiRequest("POST", "/api/ai-assistant/chat", {
        message: userMessage,
        isFirstMessage: coreviaMessages.length === 0,
        conversationHistory: contextMessage ? [contextMessage, ...coreviaMessages] : coreviaMessages,
        context: "demand_submissions",
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || "Assistant service unavailable.");
      }
      const payload = await response.json();
      if (payload?.response) {
        setCoreviaMessages((prev) => [...prev, { role: "assistant", content: payload.response }]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "I could not reach the assistant service. Please try again.";
      setCoreviaMessages((prev) => [
        ...prev,
        { role: "assistant", content: errorMessage }
      ]);
    } finally {
      setIsCoreviaSending(false);
    }
  };

  useEffect(() => {
    if (!isEmbedded || !contextData?.title) return;
    const statusText = contextData.status ? `Current status: ${contextData.status}. ` : "";
    const feedbackText = contextData.feedback ? `Latest feedback: ${contextData.feedback}. ` : "";
    const actionText = contextData.actions && contextData.actions.length > 0
      ? `Required actions: ${contextData.actions.join("; ")}. `
      : "";
    setCoreviaMessages([
      {
        role: "assistant",
        content: `I am ready to help with “${contextData.title}”. ${statusText}${feedbackText}${actionText}Ask me how to enhance your request or respond to the feedback.`
      }
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextData?.title, contextData?.status, contextData?.feedback, isEmbedded]);

  const handleTyping = () => {
    if (selectedUser && currentUser) {
      send({
        type: "chat:typing",
        payload: {
          userId: currentUser.id,
          recipientId: selectedUser,
          isTyping: true,
        },
      });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(() => {
        send({
          type: "chat:typing",
          payload: {
            userId: currentUser.id,
            recipientId: selectedUser,
            isTyping: false,
          },
        });
      }, 1000);
    }
  };

  const startVideoCall = (recipientId: string, recipientName: string) => {
    setVideoCall({
      isActive: true,
      recipientId,
      recipientName,
    });

    send({
      type: "video:call-start",
      payload: {
        recipientId,
        callerId: currentUser?.id,
        callerName: currentUser?.displayName,
      },
    });
  };

  const endVideoCall = () => {
    if (videoCall.recipientId) {
      send({
        type: "video:call-end",
        payload: {
          recipientId: videoCall.recipientId,
        },
      });
    }

    setVideoCall({ isActive: false });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-primary";
      case "away":
        return "bg-muted-foreground";
      case "busy":
        return "bg-destructive";
      default:
        return "bg-muted-foreground";
    }
  };

  const _handleNotificationClick = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.isRead) {
      apiRequest("PATCH", `/api/notifications/${notification.id}/read`)
        .then(() => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }))
        .catch(() => toast({ title: t('ai.smartPanel.error'), description: t('ai.smartPanel.failedToMarkAsRead'), variant: "destructive" }));
    }

    // Navigate to the report if this is a section assignment notification
    const actionUrl = getNotificationActionUrl(notification);
    if (actionUrl) {
      setLocation(actionUrl);
    }
  };

  const selectedUserPresence = onlineUsers.find((u) => u.userId === selectedUser);
  const filteredMessages = messages.filter(
    (m) =>
      (m.senderId === currentUser?.id && m.recipientId === selectedUser) ||
      (m.senderId === selectedUser && m.recipientId === currentUser?.id)
  );

  const panelVisible = isEmbedded || isHovered;
  const panelClassName = isEmbedded
    ? `relative w-full h-full bg-background/95 backdrop-blur-2xl border border-border/60 rounded-xl shadow-xl ${className || ""}`
    : `fixed top-20 right-0 h-[calc(100vh-10rem)] ${isCollaborationExpanded ? 'w-[460px]' : 'w-[420px]'} bg-background/75 backdrop-blur-2xl border border-border/50 rounded-l-3xl transition-all duration-300 ease-out z-50 shadow-lg ${
        panelVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
      }`;
  const panelBodyClassName = isEmbedded
    ? "p-3 space-y-2 h-full overflow-y-auto"
    : "px-3 pb-3 pt-2 space-y-2 h-[calc(100vh-10rem)] overflow-y-auto";

  return (
    <>
      {!isEmbedded && (
        <>
          {/* Floating Notification Bell - Always Visible - Higher z-index than panel */}
          <div className="fixed bottom-6 right-6 z-[60]">
            <Button
              variant="secondary"
              size="sm"
              className="relative h-10 px-3.5 rounded-full shadow-md border border-border/60 bg-background/80 backdrop-blur hover:bg-background/90 transition-colors flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setIsPanelPinned(true);
                setIsHovered(true);
                setIsCollaborationExpanded(true);
              }}
              data-testid="button-notification-bell"
            >
              <Bell className="h-4 w-4" />
              <span className="text-xs font-semibold">{t('ai.smartPanel.copilot')}</span>
              {unreadNotificationsCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 px-1 text-[10px] font-bold"
                  data-testid="badge-unread-count"
                >
                  {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Hover Trigger Area - Right Edge */}
          <div
            className="fixed top-0 right-0 h-full w-3 z-40 cursor-pointer group"
            onMouseEnter={() => setIsHovered(true)}
            data-testid="hover-trigger"
          >
            <div className="absolute top-1/2 -translate-y-1/2 right-0 w-1.5 h-28 bg-primary/30 opacity-60 group-hover:opacity-100 transition-opacity duration-200 rounded-l-full shadow" />
            <div className="absolute top-1/2 -translate-y-1/2 right-0 w-[3px] h-10 bg-primary/60 rounded-l-full" />
          </div>
        </>
      )}

      {/* Smart Panel */}
      <div
        className={panelClassName}
        onMouseEnter={!isEmbedded ? handlePanelMouseEnter : undefined}
        onMouseLeave={!isEmbedded ? handlePanelMouseLeave : undefined}
        data-testid="smart-panel"
      >
        {/* Subtle Accent */}
        <div className="absolute left-0 top-0 w-px h-full bg-border/60 rounded-l-3xl" />

        {/* Close button for the panel */}
        {!isEmbedded && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 z-10"
            onClick={(e) => {
              e.stopPropagation();
              setIsHovered(false);
              setIsPanelPinned(false);
            }}
            data-testid="button-close-panel"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Floating Header */}
        {!isEmbedded && (
          <div className="px-4 pt-4 pb-3 border-b border-border/60">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-9 w-9 rounded-2xl bg-muted/40 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{t('ai.smartPanel.copilot')}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {isConnected ? t('ai.smartPanel.liveCollaboration') : t('ai.smartPanel.offlineCollaboration')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-primary" : "bg-muted-foreground"}`} />
                <span className="text-[11px] text-muted-foreground">
                  {unreadNotificationsCount > 0 ? t('ai.smartPanel.alertsCount', { count: unreadNotificationsCount }) : t('ai.smartPanel.noAlerts')}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className={panelBodyClassName}>
          {/* User Profile - Compact */}
          <Card className="bg-muted/30 border-border/60 overflow-hidden">
            <CardContent className="p-2.5 relative">
              <div className="flex items-center gap-2">
                <div className="relative flex-shrink-0">
                  <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-semibold text-xs shadow-sm">
                    {currentUser?.displayName?.charAt(0).toUpperCase()}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-primary' : 'bg-muted-foreground'} border-2 border-background`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{currentUser?.displayName || t('ai.smartPanel.user')}</p>
                  <Badge variant="secondary" className="capitalize text-[10px] h-4 px-1 mt-0.5">
                    {currentUser?.role}
                  </Badge>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleLogout();
                  }}
                  variant="ghost"
                  size="icon"
                  disabled={isLoggingOut}
                  className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive flex-shrink-0 relative z-10"
                  data-testid="button-logout"
                >
                  {isLoggingOut ? (
                    <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <LogOut className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {isEmbedded && (contextTitle || contextSubtitle) && (
            <Card className="bg-gradient-to-br from-primary/8 to-background border-primary/20">
              <CardContent className="p-3">
                {contextTitle && <div className="text-sm font-semibold">{contextTitle}</div>}
                {contextSubtitle && <div className="text-xs text-muted-foreground mt-1">{contextSubtitle}</div>}
              </CardContent>
            </Card>
          )}

          {isEmbedded && (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
              <CardHeader className="p-2.5 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <CardTitle className="text-xs">{t('ai.smartPanel.coreviaAssistant')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-2.5 pt-0 space-y-2">
                {contextData?.title && (
                  <div className="rounded-lg border border-border/50 bg-background/60 px-2.5 py-2 text-[11px]">
                    <div className="font-semibold">{contextData.title}</div>
                    {contextData.status && <div className="text-muted-foreground">{t('ai.smartPanel.status')}: {contextData.status}</div>}
                    {contextData.feedback && <div className="text-muted-foreground">{t('ai.smartPanel.feedback')}: {contextData.feedback}</div>}
                  </div>
                )}
                <ScrollArea className="h-48 pr-2">
                  <div className="space-y-2">
                    {coreviaMessages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={`rounded-lg px-2.5 py-2 text-xs ${
                          message.role === "assistant"
                            ? "bg-primary/10 text-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {message.content}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex items-center gap-2">
                  <Input
                    value={coreviaInput}
                    onChange={(event) => setCoreviaInput(event.target.value)}
                    placeholder={t('ai.smartPanel.askCoreviaPlaceholder')}
                    className="h-8 text-xs"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleCoreviaSend();
                      }
                    }}
                  />
                  <Button size="sm" className="h-8" onClick={handleCoreviaSend} disabled={isCoreviaSending}>
                    {isCoreviaSending ? "..." : t('ai.smartPanel.send')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!isEmbedded && (
            <Tabs value={floatingTab} onValueChange={(v) => setFloatingTab(v as "alerts" | "chat" | "team")} className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-8 bg-muted/20">
                <TabsTrigger value="alerts" className="text-[10px] px-1 relative">
                  <Bell className="h-3 w-3 mr-1" /> {t('ai.smartPanel.alerts')}
                  {unreadNotificationsCount > 0 && (
                    <Badge variant="destructive" className="ml-1 h-4 px-1 text-[9px]">
                      {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="chat" className="text-[10px] px-1">
                  <MessageSquare className="h-3 w-3 mr-1" /> {t('ai.smartPanel.tabChat')}
                </TabsTrigger>
                <TabsTrigger value="team" className="text-[10px] px-1">
                  <Users className="h-3 w-3 mr-1" /> {t('ai.smartPanel.tabTeam')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="alerts" className="mt-2">
                <Card className="border-border/60 bg-muted/20">
                  <CardHeader className="p-3 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs">{t('ai.smartPanel.alerts')}</CardTitle>
                      {notifications.length > 0 && unreadNotificationsCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            apiRequest("PATCH", "/api/notifications/read-all")
                              .then(() => {
                                queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
                                toast({ title: t('ai.smartPanel.allAlertsMarkedAsRead') });
                              })
                              .catch(() => toast({ title: t('ai.smartPanel.error'), description: t('ai.smartPanel.failedToMarkAllAsRead'), variant: "destructive" }));
                          }}
                        >
                          <Check className="h-3 w-3 mr-1.5" /> {t('ai.smartPanel.readAll')}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <ScrollArea className="h-72 pr-2">
                      <div className="space-y-2">
                        {notifications.length > 0 ? (
                          notifications.map((notification) => (
                            <div
                              key={notification.id}
                              className={`p-2.5 rounded-lg border ${notification.isRead ? "border-border/50 bg-background/50" : "border-border/70 bg-muted/30"}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Bell className="h-3 w-3 text-primary flex-shrink-0" />
                                    <p className="text-xs font-semibold truncate">{notification.title}</p>
                                    {!notification.isRead && (
                                      <Badge variant="destructive" className="h-3 px-1 text-[9px]">{t('ai.smartPanel.new')}</Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-1.5">{notification.message}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                  </p>
                                </div>
                                {!notification.isRead && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-[10px]"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      apiRequest("PATCH", `/api/notifications/${notification.id}/read`)
                                        .then(() => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }))
                                        .catch(() => toast({ title: t('ai.smartPanel.error'), description: t('ai.smartPanel.failedToMarkAsRead'), variant: "destructive" }));
                                    }}
                                  >
                                    <Check className="h-3 w-3 mr-1" /> {t('ai.smartPanel.read')}
                                  </Button>
                                )}
                                {getNotificationActionUrl(notification) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-[10px] px-2 border-purple-500/50 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      _handleNotificationClick(notification);
                                    }}
                                  >
                                    <ChevronRight className="h-3 w-3 mr-1" /> {getNotificationActionLabel(notification)}
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-10">
                            <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-xs text-muted-foreground">{t('ai.smartPanel.noAlerts')}</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="chat" className="mt-2">
                <Card className="border-border/60 bg-muted/20">
                  <CardHeader className="p-3 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs">{t('ai.smartPanel.tabChat')}</CardTitle>
                      <Badge variant="secondary" className="text-[10px]">{t('ai.smartPanel.onlineCount', { count: onlineUsers.length })}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-2">
                    {!selectedUser ? (
                      <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                        <p className="text-xs font-semibold">{t('ai.smartPanel.selectTeammate')}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t('ai.smartPanel.selectTeammateHint')}</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="relative">
                              <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                                {selectedUserPresence?.displayName?.charAt(0).toUpperCase()}
                              </div>
                              <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 ${getStatusColor(selectedUserPresence?.status || "offline")} rounded-full border-2 border-background`} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate">{selectedUserPresence?.displayName}</p>
                              <p className="text-[10px] text-muted-foreground capitalize truncate">{selectedUserPresence?.status}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startVideoCall(selectedUser, selectedUserPresence?.displayName || "")}>
                              <Video className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedUser(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <ScrollArea className="h-44 pr-2">
                          <div className="space-y-2">
                            {filteredMessages.map((msg) => {
                              const isOwn = msg.senderId === currentUser?.id;
                              return (
                                <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                                  <div className={`max-w-[82%] ${isOwn ? "bg-primary text-primary-foreground" : "bg-background/60"} rounded-lg px-3 py-2`}>
                                    <p className="text-xs break-words">{msg.message}</p>
                                    <p className="text-[10px] opacity-70 mt-1">{format(new Date(msg.timestamp), "HH:mm")}</p>
                                  </div>
                                </div>
                              );
                            })}
                            {typingUsers.has(selectedUser) && (
                              <div className="flex justify-start">
                                <div className="bg-background/60 rounded-lg px-3 py-2">
                                  <p className="text-xs text-muted-foreground italic">{t('ai.smartPanel.typing')}</p>
                                </div>
                              </div>
                            )}
                            <div ref={messagesEndRef} />
                          </div>
                        </ScrollArea>

                        <div className="flex gap-2">
                          <Input
                            value={newMessage}
                            onChange={(e) => {
                              setNewMessage(e.target.value);
                              handleTyping();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                            placeholder={t('ai.smartPanel.typeMessage')}
                            className="text-xs h-8"
                          />
                          <Button size="icon" onClick={handleSendMessage} disabled={!newMessage.trim()} className="h-8 w-8 flex-shrink-0">
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="team" className="mt-2">
                <Card className="border-border/60 bg-muted/20">
                  <CardHeader className="p-3 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs">{t('ai.smartPanel.teamPresence')}</CardTitle>
                      <Badge variant="secondary" className="text-[10px]">{onlineUsers.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <ScrollArea className="h-72 pr-2">
                      <div className="space-y-2">
                        {onlineUsers.map((user) => (
                          <button
                            key={user.userId}
                            className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                              selectedUser === user.userId
                                ? "border-primary/40 bg-primary/5"
                                : "border-border/50 hover:bg-muted/30"
                            }`}
                            onClick={() => {
                              setSelectedUser(user.userId);
                              setFloatingTab("chat");
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="relative">
                                  <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold">
                                    {user.displayName?.charAt(0).toUpperCase()}
                                  </div>
                                  <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 ${getStatusColor(user.status)} rounded-full border-2 border-background`} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold truncate">{user.displayName}</p>
                                  <p className="text-[10px] text-muted-foreground capitalize truncate">{user.status}</p>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </button>
                        ))}

                        {onlineUsers.length === 0 && (
                          <div className="text-center py-10">
                            <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-xs text-muted-foreground">{t('ai.smartPanel.noTeamMembersOnline')}</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {/* Video Call Modal */}
          {videoCall.isActive && (
            <Card className="border-border/60 bg-muted/20">
              <CardContent className="p-3">
                <div className="text-center space-y-3">
                  <div className="h-12 w-12 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                    <Phone className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{t('ai.smartPanel.videoCall')}</p>
                    <p className="text-xs text-muted-foreground">{videoCall.recipientName}</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={endVideoCall}
                    className="w-full h-7 text-xs"
                    data-testid="button-end-call"
                  >
                    <PhoneOff className="h-3 w-3 mr-1.5" />
                    {t('ai.smartPanel.endCall')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!isEmbedded && (
            <Card className="border-border/60 bg-muted/20">
              <CardContent className="p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 mb-1.5 px-1">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">{t('ai.smartPanel.quickActions')}</span>
                </div>
                {quickCommands.map((cmd) => (
                  <Link key={cmd.href} href={cmd.href}>
                    <div className="group flex items-center justify-between p-2 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors" data-testid={`action-${cmd.label.toLowerCase().replace(/\s+/g, '-')}`}>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                          <cmd.icon className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-xs font-medium">{cmd.label}</span>
                      </div>
                      <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Live Metrics - Compact Grid */}
          <div className="grid grid-cols-2 gap-2">
            <Card className="border-border/60 bg-muted/20 overflow-hidden">
              <CardContent className="p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">{t('ai.smartPanel.status')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`h-1.5 w-1.5 ${isConnected ? 'bg-primary' : 'bg-muted-foreground'} rounded-full ${isConnected ? 'animate-pulse' : ''}`} />
                  <span className={`text-xs font-semibold ${isConnected ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {isConnected ? t('ai.smartPanel.live') : t('ai.smartPanel.offline')}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-muted/20 overflow-hidden">
              <CardContent className="p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">{t('ai.smartPanel.reports')}</span>
                </div>
                <div className="text-lg font-bold text-foreground">{reports.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* AI Assistant - Featured */}
          <Card className="border-border/60 bg-muted/20 overflow-hidden">
            <CardContent className="p-3 relative">
              <div className="flex items-start gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold mb-0.5">{t('ai.smartPanel.assistant')}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t('ai.smartPanel.operationalPanelActive')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
