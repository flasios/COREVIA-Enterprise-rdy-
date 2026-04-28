import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Radar, AlertCircle, AlertTriangle, CheckCircle2, Clock as _Clock,
  TrendingUp, Eye, Loader2, RefreshCw as _RefreshCw, Sparkles, Activity,
  XCircle, Search, Filter as _Filter, Bell, Zap as _Zap, Target, FileQuestion
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { InsightEvent } from "@shared/schema";
import type { LucideIcon } from "lucide-react";

// Category configuration with proper icon typing
interface CategoryConfig {
  icon: LucideIcon;
  color: string;
  label: string;
}

// Mutation response types
type MutationResponse = {
  data?: {
    eventsCreated?: number;
  };
} & Record<string, unknown>;

// Recommended actions structure
interface RecommendedActions {
  actions: string[];
  [key: string]: unknown;
}

// Evidence structure
interface Evidence {
  points: string[];
  [key: string]: unknown;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  knowledge_gap: { icon: FileQuestion, color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "knowledge.insightRadar.types.knowledgeGap" },
  regulatory_update: { icon: AlertCircle, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "knowledge.insightRadar.types.regulatoryUpdate" },
  risk_signal: { icon: AlertTriangle, color: "bg-red-500/20 text-red-400 border-red-500/30", label: "knowledge.insightRadar.types.riskSignal" },
  opportunity: { icon: Target, color: "bg-green-500/20 text-green-400 border-green-500/30", label: "knowledge.insightRadar.types.opportunity" },
  trend_shift: { icon: TrendingUp, color: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: "knowledge.insightRadar.types.trendShift" },
  compliance_alert: { icon: Bell, color: "bg-rose-500/20 text-rose-400 border-rose-500/30", label: "knowledge.insightRadar.types.complianceAlert" },
};

const PRIORITY_CONFIG: Record<string, { color: string; bgColor: string }> = {
  critical: { color: "text-red-500", bgColor: "bg-red-500/20" },
  high: { color: "text-orange-400", bgColor: "bg-orange-500/20" },
  medium: { color: "text-amber-400", bgColor: "bg-amber-500/20" },
  low: { color: "text-gray-400", bgColor: "bg-gray-500/20" },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  new: { color: "bg-blue-500/20 text-blue-400", label: "knowledge.insightRadar.status.new" },
  acknowledged: { color: "bg-amber-500/20 text-amber-400", label: "knowledge.insightRadar.status.acknowledged" },
  in_progress: { color: "bg-purple-500/20 text-purple-400", label: "knowledge.insightRadar.status.inProgress" },
  resolved: { color: "bg-green-500/20 text-green-400", label: "knowledge.insightRadar.status.resolved" },
  dismissed: { color: "bg-gray-500/20 text-gray-400", label: "knowledge.insightRadar.status.dismissed" },
};

interface DashboardData {
  activeAlerts: InsightEvent[];
  recentInsights: InsightEvent[];
  gapSummary: {
    totalGaps: number;
    criticalGaps: number;
    highPriorityGaps: number;
  };
  trendingTopics: Array<{ topic: string; frequency: number; trend: 'up' | 'down' | 'stable' }>;
  healthScore: number;
}

interface DashboardResponse {
  success: boolean;
  data: DashboardData;
}

interface EventsData {
  events: InsightEvent[];
  total: number;
}

interface EventsResponse {
  success: boolean;
  data: EventsData;
}

export function InsightRadarDashboard() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedEvent, setSelectedEvent] = useState<InsightEvent | null>(null);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const { data: dashboardResponse, isLoading: dashboardLoading, refetch: refetchDashboard, error: _dashboardError } = useQuery<DashboardResponse>({
    queryKey: ["/api/knowledge/insights/dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/knowledge/insights/dashboard", { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text() || response.statusText}`);
      }
      return response.json();
    },
    retry: false,
  });

  const { data: eventsResponse, isLoading: eventsLoading, refetch: refetchEvents, error: _eventsError } = useQuery<EventsResponse>({
    queryKey: ["/api/knowledge/insights/events", categoryFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      params.append("limit", "50");
      const response = await fetch(`/api/knowledge/insights/events?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text() || response.statusText}`);
      }
      return response.json();
    },
    retry: false,
  });

  const dashboard = dashboardResponse?.success ? dashboardResponse.data : null;
  const events = eventsResponse?.success ? eventsResponse.data.events : [];

  const analyzeGapsMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/knowledge/insights/analyze-gaps");
      return result as unknown as MutationResponse;
    },
    onSuccess: (result: MutationResponse) => {
      toast({ 
        title: t('knowledge.insightRadar.gapAnalysisComplete'),
        description: t('knowledge.insightRadar.gapAnalysisDescription', { count: result.data?.eventsCreated || 0 })
      });
      refetchDashboard();
      refetchEvents();
    },
    onError: (error: Error) => {
      toast({ title: t('knowledge.insightRadar.analysisFailed'), description: error.message, variant: "destructive" });
    },
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/knowledge/insights/generate");
      return result as unknown as MutationResponse;
    },
    onSuccess: (result: MutationResponse) => {
      toast({ 
        title: t('knowledge.insightRadar.insightsGenerated'),
        description: t('knowledge.insightRadar.insightsGeneratedDescription', { count: result.data?.eventsCreated || 0 })
      });
      refetchDashboard();
      refetchEvents();
    },
    onError: (error: Error) => {
      toast({ title: t('knowledge.insightRadar.generationFailed'), description: error.message, variant: "destructive" });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return apiRequest("POST", `/api/knowledge/insights/events/${eventId}/acknowledge`);
    },
    onSuccess: () => {
      toast({ title: t('knowledge.insightRadar.eventAcknowledged') });
      refetchDashboard();
      refetchEvents();
      setSelectedEvent(null);
    },
    onError: (error: Error) => {
      toast({ title: t('knowledge.insightRadar.failedToAcknowledge'), description: error.message, variant: "destructive" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ eventId, notes }: { eventId: string; notes: string }) => {
      return apiRequest("POST", `/api/knowledge/insights/events/${eventId}/resolve`, {
        resolutionNotes: notes
      });
    },
    onSuccess: () => {
      toast({ title: t('knowledge.insightRadar.eventResolved') });
      setIsResolveOpen(false);
      setResolutionNotes("");
      refetchDashboard();
      refetchEvents();
      setSelectedEvent(null);
    },
    onError: (error: Error) => {
      toast({ title: t('knowledge.insightRadar.failedToResolve'), description: error.message, variant: "destructive" });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async ({ eventId, reason }: { eventId: string; reason: string }) => {
      return apiRequest("POST", `/api/knowledge/insights/events/${eventId}/dismiss`, { reason });
    },
    onSuccess: () => {
      toast({ title: t('knowledge.insightRadar.eventDismissed') });
      refetchDashboard();
      refetchEvents();
      setSelectedEvent(null);
    },
    onError: (error: Error) => {
      toast({ title: t('knowledge.insightRadar.failedToDismiss'), description: error.message, variant: "destructive" });
    },
  });

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-amber-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const renderEventCard = (event: InsightEvent, isActive: boolean = false) => {
    const categoryConfig = (CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.knowledge_gap)!;
    const priorityConfig = (PRIORITY_CONFIG[event.priority] || PRIORITY_CONFIG.medium)!;
    const statusConfig = (STATUS_CONFIG[event.status] || STATUS_CONFIG.new)!;
    const CategoryIcon = categoryConfig.icon;

    return (
      <Card 
        key={event.id}
        className={`cursor-pointer transition-all hover-elevate ${
          selectedEvent?.id === event.id ? "ring-2 ring-primary" : ""
        } ${isActive ? "border-l-4 border-l-red-500" : ""}`}
        onClick={() => setSelectedEvent(event)}
        data-testid={`card-event-${event.id}`}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${priorityConfig.bgColor}`}>
              <CategoryIcon className={`h-4 w-4 ${priorityConfig.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-sm line-clamp-2">{event.title}</h4>
                <Badge className={statusConfig.color} variant="outline">
                  {t(statusConfig.label)}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={categoryConfig.color} variant="outline">
                  {t(categoryConfig.label)}
                </Badge>
                <Badge variant="secondary" className={`text-xs ${priorityConfig.color}`}>
                  {event.priority}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {formatDistanceToNow(new Date(event.triggeredAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
            <Radar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{t('knowledge.insightRadar.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('knowledge.insightRadar.subtitle')}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => analyzeGapsMutation.mutate()}
            disabled={analyzeGapsMutation.isPending}
            className="gap-2"
            data-testid="button-analyze-gaps"
          >
            {analyzeGapsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {t('knowledge.insightRadar.analyzeGaps')}
          </Button>
          <Button
            onClick={() => generateInsightsMutation.mutate()}
            disabled={generateInsightsMutation.isPending}
            className="gap-2"
            data-testid="button-generate-insights"
          >
            {generateInsightsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {t('knowledge.insightRadar.generateInsights')}
          </Button>
        </div>
      </div>

      {dashboardLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : dashboard && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="border-none bg-gradient-to-br from-background to-muted/30">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('knowledge.insightRadar.healthScore')}</p>
                  <div className={`text-3xl font-bold ${getHealthColor(dashboard.healthScore)}`}>
                    {dashboard.healthScore}%
                  </div>
                </div>
                <div className="relative h-16 w-16">
                  <svg className="h-16 w-16 -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="text-muted/30"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeDasharray={`${dashboard.healthScore * 1.76} 176`}
                      className={getHealthColor(dashboard.healthScore)}
                    />
                  </svg>
                  <Activity className={`absolute inset-0 m-auto h-6 w-6 ${getHealthColor(dashboard.healthScore)}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <span className="text-sm text-muted-foreground">{t('knowledge.insightRadar.criticalGaps')}</span>
              </div>
              <div className="text-3xl font-bold text-red-400">{dashboard.gapSummary.criticalGaps}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('knowledge.insightRadar.highPriority', { count: dashboard.gapSummary.highPriorityGaps })}
              </p>
            </CardContent>
          </Card>

          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-muted-foreground">{t('knowledge.insightRadar.activeAlerts')}</span>
              </div>
              <div className="text-3xl font-bold text-amber-400">{dashboard.activeAlerts.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('knowledge.insightRadar.requiringAttention')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <FileQuestion className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-muted-foreground">{t('knowledge.insightRadar.totalGaps')}</span>
              </div>
              <div className="text-3xl font-bold text-blue-400">{dashboard.gapSummary.totalGaps}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('knowledge.insightRadar.knowledgeCoverage')}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card className="h-[600px] overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t('knowledge.insightRadar.insightEvents')}</CardTitle>
                <div className="flex gap-2">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-40" data-testid="select-category-filter">
                      <SelectValue placeholder={t('knowledge.insightRadar.category')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('knowledge.insightRadar.allCategories')}</SelectItem>
                      {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{t(config.label)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-32" data-testid="select-priority-filter">
                      <SelectValue placeholder={t('knowledge.insightRadar.priority')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('knowledge.insightRadar.all')}</SelectItem>
                      <SelectItem value="critical">{t('knowledge.insightRadar.critical')}</SelectItem>
                      <SelectItem value="high">{t('knowledge.insightRadar.high')}</SelectItem>
                      <SelectItem value="medium">{t('knowledge.insightRadar.medium')}</SelectItem>
                      <SelectItem value="low">{t('knowledge.insightRadar.low')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100%-4rem)]">
              {eventsLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Radar className="h-16 w-16 mb-4 opacity-30" />
                  <p>{t('knowledge.insightRadar.noInsightEvents')}</p>
                  <p className="text-sm">{t('knowledge.insightRadar.runGapAnalysis')}</p>
                </div>
              ) : (
                <ScrollArea className="h-full px-4 pb-4">
                  <div className="space-y-2">
                    {events.map(event => renderEventCard(event, event.status === 'new'))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-[600px] overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{t('knowledge.insightRadar.eventDetails')}</CardTitle>
              <CardDescription>
                {selectedEvent ? t('knowledge.insightRadar.reviewAndAction') : t('knowledge.insightRadar.selectEvent')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100%-5rem)]">
              {!selectedEvent ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Eye className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">{t('knowledge.insightRadar.clickEventToSee')}</p>
                </div>
              ) : (
                <ScrollArea className="h-full px-4 pb-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold">{selectedEvent.title}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={CATEGORY_CONFIG[selectedEvent.category]?.color}>
                          {t(CATEGORY_CONFIG[selectedEvent.category]!.label)}
                        </Badge>
                        <Badge variant="secondary" className={PRIORITY_CONFIG[selectedEvent.priority]?.color}>
                          {selectedEvent.priority}
                        </Badge>
                        <Badge className={STATUS_CONFIG[selectedEvent.status]?.color}>
                          {t(STATUS_CONFIG[selectedEvent.status]!.label)}
                        </Badge>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {selectedEvent.description || t('knowledge.insightRadar.noDescription')}
                    </p>

                    {selectedEvent.confidenceScore && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{t('knowledge.insightRadar.confidence')}</span>
                          <span>{Math.round((selectedEvent.confidenceScore as number) * 100)}%</span>
                        </div>
                        <Progress value={(selectedEvent.confidenceScore as number) * 100} className="h-1" />
                      </div>
                    )}

                    {selectedEvent.impactScore && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{t('knowledge.insightRadar.impact')}</span>
                          <span>{Math.round((selectedEvent.impactScore as number) * 100)}%</span>
                        </div>
                        <Progress value={(selectedEvent.impactScore as number) * 100} className="h-1" />
                      </div>
                    )}

                    {selectedEvent.recommendedActions ? (() => {
                      const recommendedActions = selectedEvent.recommendedActions as unknown as RecommendedActions;
                      const actions = recommendedActions.actions || [];
                      return actions.length > 0 ? (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">{t('knowledge.insightRadar.recommendedActions')}</h4>
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                            {actions.map((action: string, i: number) => (
                              <li key={i}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null;
                    })() : null}

                    {selectedEvent.evidence ? (() => {
                      const evidence = selectedEvent.evidence as unknown as Evidence;
                      const points = evidence.points || [];
                      return points.length > 0 ? (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">{t('knowledge.insightRadar.evidence')}</h4>
                          <div className="text-sm text-muted-foreground">
                            {points.map((point: string, i: number) => (
                              <p key={i} className="mb-1">{point}</p>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })() : null}

                    <div className="pt-4 border-t space-y-2">
                      {selectedEvent.status === 'new' && (
                        <Button
                          className="w-full gap-2"
                          onClick={() => acknowledgeMutation.mutate(selectedEvent.id)}
                          disabled={acknowledgeMutation.isPending}
                          data-testid="button-acknowledge-event"
                        >
                          {acknowledgeMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          {t('knowledge.insightRadar.acknowledge')}
                        </Button>
                      )}
                      
                      {(selectedEvent.status === 'new' || selectedEvent.status === 'acknowledged') && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1 gap-2"
                            onClick={() => setIsResolveOpen(true)}
                            data-testid="button-resolve-event"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {t('knowledge.insightRadar.resolve')}
                          </Button>
                          <Button
                            variant="ghost"
                            className="gap-2"
                            onClick={() => dismissMutation.mutate({ 
                              eventId: selectedEvent.id, 
                              reason: "Manually dismissed" 
                            })}
                            disabled={dismissMutation.isPending}
                            data-testid="button-dismiss-event"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {t('knowledge.insightRadar.triggered')} {format(new Date(selectedEvent.triggeredAt), "PPpp")}
                    </p>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isResolveOpen} onOpenChange={setIsResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('knowledge.insightRadar.resolveEvent')}</DialogTitle>
            <DialogDescription>
              {t('knowledge.insightRadar.resolveEventDescription')}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={t('knowledge.insightRadar.resolutionPlaceholder')}
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            rows={4}
            data-testid="textarea-resolution-notes"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResolveOpen(false)}>{t('knowledge.insightRadar.cancel')}</Button>
            <Button
              onClick={() => selectedEvent && resolveMutation.mutate({
                eventId: selectedEvent.id,
                notes: resolutionNotes
              })}
              disabled={!resolutionNotes || resolveMutation.isPending}
              className="gap-2"
              data-testid="button-submit-resolution"
            >
              {resolveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {t('knowledge.insightRadar.resolveEvent')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
