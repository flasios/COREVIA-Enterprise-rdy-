import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HexagonLogoFrame } from "@/components/shared/misc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import {
  Send, Plus, MessageSquare, CheckSquare, Bell, Clock,
  Calendar, CheckCircle, Mail, FileEdit, BookOpen, Sparkles, Brain, User, Loader2,
  RefreshCw
} from "lucide-react";

interface Conversation {
  id: string;
  userId: string;
  title: string;
  mode: string;
  contextType?: string;
  contextId?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  structuredOutput?: unknown;
  outputType?: string;
  createdAt: string;
}

interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  dueDate?: string;
  relatedType?: string;
  relatedId?: string;
  source: string;
  createdAt: string;
}

interface Reminder {
  id: string;
  userId: string;
  title: string;
  message?: string;
  remindAt: string;
  status: string;
  isRecurring: boolean;
  createdAt: string;
}

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  relatedType?: string;
  relatedId?: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: string;
}

const MODES = [
  { value: "general", labelKey: "ai.assistantPage.modes.general", icon: MessageSquare },
  { value: "email", labelKey: "ai.assistantPage.modes.email", icon: Mail },
  { value: "policy", labelKey: "ai.assistantPage.modes.policy", icon: FileEdit },
  { value: "playbook", labelKey: "ai.assistantPage.modes.playbook", icon: BookOpen },
  { value: "task_management", labelKey: "ai.assistantPage.modes.taskManagement", icon: CheckSquare },
  { value: "system_query", labelKey: "ai.assistantPage.modes.systemQuery", icon: Brain },
];

export default function AIAssistant() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("chat");
  const [focusedArtifactId, setFocusedArtifactId] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newConversationMode, setNewConversationMode] = useState("general");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { currentUser } = useAuth();
  
  // Get user's first name for personalized greeting
  const userName = currentUser?.displayName?.split(' ')[0] || 'there';

  const { data: conversationsData, isLoading: loadingConversations } = useQuery<{ success: boolean; data: Conversation[] }>({
    queryKey: ["/api/ai-assistant/conversations"],
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 2 * 60 * 1000,
  });

  const { data: messagesData, isLoading: loadingMessages, refetch: refetchMessages } = useQuery<{ success: boolean; data: Message[] }>({
    queryKey: ["/api/ai-assistant/conversations", selectedConversation?.id, "messages"],
    enabled: !!selectedConversation,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 30 * 1000,
  });

  const { data: tasksData, isLoading: loadingTasks } = useQuery<{ success: boolean; data: Task[] }>({
    queryKey: ["/api/ai-assistant/tasks"],
    retry: 3,
    staleTime: 2 * 60 * 1000,
  });

  const { data: remindersData } = useQuery<{ success: boolean; data: Reminder[] }>({
    queryKey: ["/api/ai-assistant/reminders"],
    retry: 3,
    staleTime: 2 * 60 * 1000,
  });

  const { data: notificationsData, isLoading: _loadingNotifications } = useQuery<{ success: boolean; data: Notification[] }>({
    queryKey: ["/api/ai-assistant/notifications"],
    retry: 3,
    staleTime: 60 * 1000,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const conversations = conversationsData?.data || [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const messages = messagesData?.data || [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tasks = tasksData?.data || [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reminders = remindersData?.data || [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const notifications = notificationsData?.data || [];

  const activeConversations = useMemo(
    () => conversations.filter(c => !c.isArchived),
    [conversations]
  );

  const pendingTasks = useMemo(
    () => tasks.filter(t => t.status !== "completed"),
    [tasks]
  );

  const pendingReminders = useMemo(
    () => reminders.filter(r => r.status === "pending"),
    [reminders]
  );

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.isRead).length,
    [notifications]
  );

  const createConversationMutation = useMutation({
    mutationFn: async (data: { title?: string; mode: string }) => {
      return apiRequest("POST", "/api/ai-assistant/conversations", data);
    },
    onSuccess: async (response) => {
      const result = await response.json();
      setSelectedConversation(result.data);
      setShowNewConversation(false);
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/conversations"] });
    },
    onError: (err: unknown) => {
      console.error('[AI Assistant] Failed to create conversation:', err);
      toast({
        title: t('ai.assistantPage.error'),
        description: t('ai.assistantPage.failedCreateConversation'),
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, message }: { conversationId: string; message: string }) => {
      return apiRequest("POST", `/api/ai-assistant/conversations/${conversationId}/chat`, { message });
    },
    onSuccess: () => {
      setNewMessage("");
      if (selectedConversation) {
        localStorage.removeItem(`draft-${selectedConversation.id}`);
      }
      refetchMessages();
    },
    onError: (err: unknown) => {
      console.error('[AI Assistant] Message send failed:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to send message. Please try again.";
      toast({
        title: t('ai.assistantPage.error'),
        description: errorMessage,
        variant: "destructive",
      });
    },
    retry: 2,
    retryDelay: 1000,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      return apiRequest("PATCH", `/api/ai-assistant/tasks/${id}`, data);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/ai-assistant/tasks"] });
      const previousTasks = queryClient.getQueryData(["/api/ai-assistant/tasks"]);
      queryClient.setQueryData(["/api/ai-assistant/tasks"], (old: unknown) => {
        const previous = (old && typeof old === "object")
          ? (old as Record<string, unknown> & { data?: Task[] })
          : {};
        return {
          ...previous,
          data: (previous.data ?? []).map((t: Task) =>
            t.id === id ? { ...t, ...data } : t
          ),
        };
      });
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(["/api/ai-assistant/tasks"], context?.previousTasks);
      toast({
        title: t('ai.assistantPage.error'),
        description: t('ai.assistantPage.failedUpdateTask'),
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/tasks"] });
    },
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/ai-assistant/notifications/${id}/read`, {});
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["/api/ai-assistant/notifications"] });
      const previousNotifications = queryClient.getQueryData(["/api/ai-assistant/notifications"]);
      queryClient.setQueryData(["/api/ai-assistant/notifications"], (old: unknown) => {
        const previous = (old && typeof old === "object")
          ? (old as Record<string, unknown> & { data?: Notification[] })
          : {};
        return {
          ...previous,
          data: (previous.data ?? []).map((n: Notification) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
        };
      });
      return { previousNotifications };
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(["/api/ai-assistant/notifications"], context?.previousNotifications);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/notifications"] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedConversation) return;
    const key = `draft-${selectedConversation.id}`;
    const draft = localStorage.getItem(key);
    if (draft) {
      setNewMessage(draft);
    } else {
      setNewMessage('');
    }
  }, [selectedConversation]);

  useEffect(() => {
    if (!selectedConversation || !newMessage) return;
    const key = `draft-${selectedConversation.id}`;
    const debounce = setTimeout(() => {
      if (newMessage.trim()) {
        localStorage.setItem(key, newMessage);
      }
    }, 500);
    return () => clearTimeout(debounce);
  }, [newMessage, selectedConversation]);

  useEffect(() => {
    const handleKeyboardShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector<HTMLTextAreaElement>('[data-testid="input-message"]')?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setShowNewConversation(true);
      }
      if (e.key === 'Escape') {
        setShowNewConversation(false);
      }
    };
    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, []);

  const handleSendMessage = useCallback(() => {
    if (!newMessage.trim() || !selectedConversation) return;
    sendMessageMutation.mutate({
      conversationId: selectedConversation.id,
      message: newMessage,
    });
  }, [newMessage, selectedConversation, sendMessageMutation]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const startNewConversation = useCallback(() => {
    createConversationMutation.mutate({
      title: `${t(MODES.find(m => m.value === newConversationMode)?.labelKey || 'ai.assistantPage.modes.general')} - ${format(new Date(), "MMM d, HH:mm")}`,
      mode: newConversationMode,
    });
  }, [newConversationMode, createConversationMutation, t]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyUrlState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      const focus = params.get("focus");
      const allowedTabs = new Set(["chat", "tasks", "reminders", "notifications"]);

      if (tab && allowedTabs.has(tab)) {
        setActiveTab(tab);
      }

      setFocusedArtifactId(focus || "");
    };

    applyUrlState();
    window.addEventListener("popstate", applyUrlState);
    return () => window.removeEventListener("popstate", applyUrlState);
  }, []);

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4" data-testid="ai-assistant-page">
      <Card className="w-80 flex flex-col shrink-0">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <HexagonLogoFrame size="md" />
            <div>
              <CardTitle className="text-lg">{t('ai.assistantPage.corevia')}</CardTitle>
              <CardDescription>{t('ai.assistantPage.strategicAdvisor')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4 pt-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="chat" className="relative" data-testid="tab-chat">
                <MessageSquare className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="tasks" data-testid="tab-tasks">
                <CheckSquare className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="reminders" data-testid="tab-reminders">
                <Clock className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="notifications" className="relative" data-testid="tab-notifications">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 flex flex-col mt-4">
              <Button 
                onClick={() => setShowNewConversation(true)} 
                className="w-full mb-3"
                data-testid="button-new-conversation"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('ai.assistantPage.newConversation')}
              </Button>
              <ScrollArea className="flex-1">
                <div className="space-y-2" role="list" aria-label="Conversation list">
                  {loadingConversations && (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  )}
                  {!loadingConversations && activeConversations.map(conv => (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={`p-3 rounded-lg cursor-pointer hover-elevate ${
                        selectedConversation?.id === conv.id ? "bg-primary/10 border border-primary/30" : "bg-muted/50"
                      }`}
                      data-testid={`conversation-${conv.id}`}
                      role="listitem"
                      aria-selected={selectedConversation?.id === conv.id}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedConversation(conv)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs capitalize">
                          {conv.mode}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(conv.updatedAt), "MMM d, HH:mm")}
                      </p>
                    </div>
                  ))}
                  {!loadingConversations && activeConversations.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t('ai.assistantPage.noConversationsYet')}</p>
                      <p className="text-xs">{t('ai.assistantPage.startNewConversationAbove')}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="tasks" className="flex-1 flex flex-col mt-4">
              <ScrollArea className="flex-1">
                <div className="space-y-2" role="list" aria-label="Task list">
                  {loadingTasks && (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  )}
                  {!loadingTasks && pendingTasks.map(task => (
                    <div
                      key={task.id}
                      id={`ai-task-${task.id}`}
                      className={`p-3 rounded-lg hover-elevate ${
                        focusedArtifactId === task.id
                          ? "bg-cyan-50 border border-cyan-300 dark:bg-cyan-500/15 dark:border-cyan-500/40"
                          : "bg-muted/50"
                      }`}
                      data-testid={`task-${task.id}`}
                      role="listitem"
                    >
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={task.status === "completed"}
                          onCheckedChange={() => updateTaskMutation.mutate({
                            id: task.id,
                            data: { status: "completed" }
                          })}
                          data-testid={`checkbox-task-${task.id}`}
                          aria-label={`Mark "${task.title}" as complete`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{task.title}</p>
                          {task.dueDate && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(task.dueDate), "MMM d")}
                            </p>
                          )}
                        </div>
                        <Badge variant={task.priority === "high" ? "destructive" : "secondary"} className="text-xs shrink-0">
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {!loadingTasks && pendingTasks.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t('ai.assistantPage.allCaughtUp')}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="reminders" className="flex-1 flex flex-col mt-4">
              <ScrollArea className="flex-1">
                <div className="space-y-2" role="list" aria-label="Reminders list">
                  {pendingReminders.map(reminder => (
                    <div
                      key={reminder.id}
                      id={`ai-reminder-${reminder.id}`}
                      className={`p-3 rounded-lg hover-elevate ${
                        focusedArtifactId === reminder.id
                          ? "bg-cyan-50 border border-cyan-300 dark:bg-cyan-500/15 dark:border-cyan-500/40"
                          : "bg-muted/50"
                      }`}
                      data-testid={`reminder-${reminder.id}`}
                      role="listitem"
                    >
                      <p className="text-sm font-medium">{reminder.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(reminder.remindAt), "MMM d, HH:mm")}
                      </p>
                    </div>
                  ))}
                  {pendingReminders.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t('ai.assistantPage.noUpcomingReminders')}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="notifications" className="flex-1 flex flex-col mt-4">
              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      id={`ai-notification-${notification.id}`}
                      onClick={() => !notification.isRead && markNotificationReadMutation.mutate(notification.id)}
                      className={`p-3 rounded-lg cursor-pointer hover-elevate ${
                        focusedArtifactId === notification.id
                          ? "bg-cyan-50 border border-cyan-300 dark:bg-cyan-500/15 dark:border-cyan-500/40"
                          : notification.isRead
                            ? "bg-muted/30"
                            : "bg-muted/50 border-l-2 border-l-primary"
                      }`}
                      data-testid={`notification-${notification.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                          notification.priority === "urgent" ? "bg-destructive" :
                          notification.priority === "high" ? "bg-amber-500" : "bg-primary"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{notification.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(notification.createdAt), "MMM d, HH:mm")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t('ai.assistantPage.noNotifications')}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <HexagonLogoFrame size="sm" />
                  <div>
                    <CardTitle className="text-base">{selectedConversation.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs capitalize">
                        {selectedConversation.mode}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" data-testid="button-refresh-messages" onClick={() => refetchMessages()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.length === 0 && !loadingMessages && (
                    <div className="text-center py-12">
                      <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">{t('ai.assistantPage.greeting', { name: userName })}</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        {t('ai.assistantPage.greetingDescription')}
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center mt-6">
                        {[
                          t('ai.assistantPage.suggestion.draftEmail'),
                          t('ai.assistantPage.suggestion.createPolicy'),
                          t('ai.assistantPage.suggestion.generatePlaybook'),
                          t('ai.assistantPage.suggestion.showPendingTasks'),
                        ].map((suggestion, i) => (
                          <Button
                            key={i}
                            variant="outline"
                            size="sm"
                            onClick={() => setNewMessage(suggestion)}
                            data-testid={`suggestion-${i}`}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map(message => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}
                      data-testid={`message-${message.id}`}
                    >
                      {message.role !== "user" && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-xs">
                            C
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`max-w-[75%] rounded-lg p-3 ${
                        message.role === "user" 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted"
                      }`}>
                        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                        <p className={`text-xs mt-2 ${
                          message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}>
                          {format(new Date(message.createdAt), "HH:mm")}
                        </p>
                      </div>
                      {message.role === "user" && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                  {sendMessageMutation.isPending && (
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-xs">
                          E
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-muted rounded-lg p-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t('ai.assistantPage.thinking')}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={t('ai.assistantPage.typeMessage')}
                    className="min-h-[44px] max-h-32 resize-none"
                    data-testid="input-message"
                    aria-label="Message input"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    data-testid="button-send-message"
                    aria-label="Send message"
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="mx-auto mb-6">
                <HexagonLogoFrame size="xl" animated />
              </div>
              <h2 className="text-2xl font-bold mb-2">{t('ai.assistantPage.greeting', { name: userName })}</h2>
              <p className="text-muted-foreground mb-6">
                {t('ai.assistantPage.landingDescription')}
              </p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {MODES.slice(0, 4).map(mode => (
                  <Button
                    key={mode.value}
                    variant="outline"
                    className="flex flex-col items-center gap-2 h-auto py-4 hover-elevate"
                    onClick={() => {
                      setNewConversationMode(mode.value);
                      setShowNewConversation(true);
                    }}
                    data-testid={`quick-start-${mode.value}`}
                  >
                    <mode.icon className="h-6 w-6" />
                    <span className="text-sm">{t(mode.labelKey)}</span>
                  </Button>
                ))}
              </div>
              <Button onClick={() => setShowNewConversation(true)} data-testid="button-start-conversation">
                <Plus className="h-4 w-4 mr-2" />
                {t('ai.assistantPage.startConversation')}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ai.assistantPage.newConversation')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('ai.assistantPage.mode')}</label>
              <Select value={newConversationMode} onValueChange={setNewConversationMode}>
                <SelectTrigger data-testid="select-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map(mode => (
                    <SelectItem key={mode.value} value={mode.value}>
                      <div className="flex items-center gap-2">
                        <mode.icon className="h-4 w-4" />
                        {t(mode.labelKey)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">
                {newConversationMode === "general" && t('ai.assistantPage.modeDesc.general')}
                {newConversationMode === "email" && t('ai.assistantPage.modeDesc.email')}
                {newConversationMode === "policy" && t('ai.assistantPage.modeDesc.policy')}
                {newConversationMode === "playbook" && t('ai.assistantPage.modeDesc.playbook')}
                {newConversationMode === "task_management" && t('ai.assistantPage.modeDesc.taskManagement')}
                {newConversationMode === "system_query" && t('ai.assistantPage.modeDesc.systemQuery')}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewConversation(false)} data-testid="button-cancel">
                {t('ai.assistantPage.cancel')}
              </Button>
              <Button 
                onClick={startNewConversation}
                disabled={createConversationMutation.isPending}
                data-testid="button-create-conversation"
              >
                {createConversationMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                {t('ai.assistantPage.start')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
