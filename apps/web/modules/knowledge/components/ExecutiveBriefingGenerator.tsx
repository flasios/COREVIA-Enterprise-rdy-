import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  FileText, Plus, Loader2, Calendar, CheckCircle2,
  AlertCircle as _AlertCircle, TrendingUp, Lightbulb, AlertTriangle,
  Download as _Download, Share2 as _Share2, Archive, Eye, Clock as _Clock, User as _User,
  Sparkles, RefreshCw as _RefreshCw, Send, FileCheck
} from "lucide-react";
import { format } from "date-fns";
import type { ExecutiveBriefing, BriefingSection } from "@shared/schema";

interface KeyFinding {
  title: string;
  summary: string;
  importance: 'high' | 'medium' | 'low';
  dataPoints?: Record<string, string | number | boolean>;
}

interface Trend {
  title: string;
  direction: 'increasing' | 'decreasing' | 'emerging' | 'stable';
  description: string;
  impactAreas?: string[];
}

interface Recommendation {
  title: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  expectedOutcome: string;
  timeline?: string;
}

interface RiskAlert {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  mitigationSuggestions?: string[];
}

interface BriefingMutationResponse {
  success: boolean;
  data?: {
    id: string;
  };
}

interface MutationError extends Error {
  message: string;
}

const BRIEFING_TYPES = [
  { value: "weekly_digest", labelKey: "knowledge.briefing.types.weeklyDigest", descKey: "knowledge.briefing.types.weeklyDigestDesc" },
  { value: "topic_deep_dive", labelKey: "knowledge.briefing.types.topicDeepDive", descKey: "knowledge.briefing.types.topicDeepDiveDesc" },
  { value: "trend_analysis", labelKey: "knowledge.briefing.types.trendAnalysis", descKey: "knowledge.briefing.types.trendAnalysisDesc" },
  { value: "gap_assessment", labelKey: "knowledge.briefing.types.gapAssessment", descKey: "knowledge.briefing.types.gapAssessmentDesc" },
  { value: "custom", labelKey: "knowledge.briefing.types.customBriefing", descKey: "knowledge.briefing.types.customBriefingDesc" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  generating: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ready: "bg-green-500/20 text-green-400 border-green-500/30",
  published: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  archived: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

interface BriefingListResponse {
  success: boolean;
  data: {
    briefings: ExecutiveBriefing[];
    total: number;
  };
}

interface BriefingDetailResponse {
  success: boolean;
  data: {
    briefing: ExecutiveBriefing;
    sections: BriefingSection[];
  };
}

export function ExecutiveBriefingGenerator() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBriefing, setSelectedBriefing] = useState<string | null>(null);
  const [newBriefing, setNewBriefing] = useState({
    title: "",
    briefingType: "weekly_digest" as string,
    customTopic: "",
    categories: [] as string[],
  });

  const { data: briefingsResponse, isLoading: briefingsLoading, refetch, error: _briefingsError } = useQuery<BriefingListResponse>({
    queryKey: ["/api/knowledge/briefings"],
    queryFn: async () => {
      const response = await fetch("/api/knowledge/briefings", { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text() || response.statusText}`);
      }
      return response.json();
    },
    retry: false,
  });

  const { data: briefingDetailResponse, isLoading: detailLoading, error: _detailError } = useQuery<BriefingDetailResponse>({
    queryKey: ["/api/knowledge/briefings", selectedBriefing],
    enabled: !!selectedBriefing,
    queryFn: async () => {
      const response = await fetch(`/api/knowledge/briefings/${selectedBriefing}`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text() || response.statusText}`);
      }
      return response.json();
    },
    retry: false,
  });

  const briefings = briefingsResponse?.success ? briefingsResponse.data.briefings : [];
  const briefingsTotal = briefingsResponse?.success ? briefingsResponse.data.total : 0;
  const detail = briefingDetailResponse?.success ? briefingDetailResponse.data : null;

  const createBriefingMutation = useMutation({
    mutationFn: async (data: typeof newBriefing): Promise<BriefingMutationResponse> => {
      const response = await apiRequest("POST", "/api/knowledge/briefings", {
        title: data.title,
        briefingType: data.briefingType,
        customTopic: data.customTopic || undefined,
        scope: data.categories.length > 0 ? { categories: data.categories } : {},
      });
      return response.json();
    },
    onSuccess: (result: BriefingMutationResponse) => {
      toast({ title: t('knowledge.briefingGenerator.briefingCreated') });
      setIsCreateOpen(false);
      setNewBriefing({ title: "", briefingType: "weekly_digest", customTopic: "", categories: [] });
      refetch();
      if (result?.data?.id) {
        setSelectedBriefing(result.data.id);
      }
    },
    onError: (error: MutationError) => {
      toast({ 
        title: t('knowledge.briefingGenerator.failedToCreate'), 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const generateWeeklyMutation = useMutation({
    mutationFn: async (): Promise<BriefingMutationResponse> => {
      const response = await apiRequest("POST", "/api/knowledge/briefings/weekly-digest");
      return response.json();
    },
    onSuccess: (result: BriefingMutationResponse) => {
      toast({ title: t('knowledge.briefingGenerator.weeklyDigestGenerated') });
      refetch();
      if (result?.data?.id) {
        setSelectedBriefing(result.data.id);
      }
    },
    onError: (error: MutationError) => {
      toast({ 
        title: t('knowledge.briefingGenerator.failedWeeklyDigest'), 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (briefingId: string) => {
      return apiRequest("POST", `/api/knowledge/briefings/${briefingId}/publish`);
    },
    onSuccess: () => {
      toast({ title: t('knowledge.briefingGenerator.briefingPublished') });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/briefings", selectedBriefing] });
    },
    onError: (error: MutationError) => {
      toast({ title: t('knowledge.briefingGenerator.failedToPublish'), description: error.message, variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (briefingId: string) => {
      return apiRequest("POST", `/api/knowledge/briefings/${briefingId}/archive`);
    },
    onSuccess: () => {
      toast({ title: t('knowledge.briefingGenerator.briefingArchived') });
      refetch();
    },
    onError: (error: MutationError) => {
      toast({ title: t('knowledge.briefingGenerator.failedToArchive'), description: error.message, variant: "destructive" });
    },
  });

  const renderKeyFindings = (findings: KeyFinding[] | null | undefined) => {
    if (!findings || findings.length === 0) return null;
    return (
      <div className="space-y-3">
        {findings.map((finding: KeyFinding, idx: number) => (
          <div key={idx} className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <div className="flex items-start gap-2">
              <CheckCircle2 className={`h-4 w-4 mt-1 ${
                finding.importance === 'high' ? 'text-red-400' : 
                finding.importance === 'medium' ? 'text-amber-400' : 'text-green-400'
              }`} />
              <div className="flex-1">
                <h4 className="font-medium text-sm">{finding.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{finding.summary}</p>
                {finding.dataPoints && Object.keys(finding.dataPoints).length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {Object.entries(finding.dataPoints).map(([key, value]) => (
                      <Badge key={key} variant="secondary" className="text-xs">
                        {key}: {String(value)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTrends = (trends: Trend[] | null | undefined) => {
    if (!trends || trends.length === 0) return null;
    return (
      <div className="space-y-3">
        {trends.map((trend: Trend, idx: number) => (
          <div key={idx} className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <div className="flex items-start gap-2">
              <TrendingUp className={`h-4 w-4 mt-1 ${
                trend.direction === 'increasing' ? 'text-green-400' :
                trend.direction === 'decreasing' ? 'text-red-400' :
                trend.direction === 'emerging' ? 'text-blue-400' : 'text-amber-400'
              }`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm">{trend.title}</h4>
                  <Badge variant="outline" className="text-xs">{trend.direction}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{trend.description}</p>
                {trend.impactAreas && trend.impactAreas.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {trend.impactAreas.map((area: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">{area}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderRecommendations = (recommendations: Recommendation[] | null | undefined) => {
    if (!recommendations || recommendations.length === 0) return null;
    return (
      <div className="space-y-3">
        {recommendations.map((rec: Recommendation, idx: number) => (
          <div key={idx} className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <div className="flex items-start gap-2">
              <Lightbulb className={`h-4 w-4 mt-1 ${
                rec.priority === 'critical' ? 'text-red-400' :
                rec.priority === 'high' ? 'text-amber-400' :
                rec.priority === 'medium' ? 'text-blue-400' : 'text-gray-400'
              }`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm">{rec.title}</h4>
                  <Badge variant={rec.priority === 'critical' ? 'destructive' : 'outline'} className="text-xs">
                    {rec.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="font-medium">{t('knowledge.briefingGenerator.expectedOutcome')}:</span> {rec.expectedOutcome}
                </p>
                {rec.timeline && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{t('knowledge.briefingGenerator.timeline')}:</span> {rec.timeline}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderRiskAlerts = (alerts: RiskAlert[] | null | undefined) => {
    if (!alerts || alerts.length === 0) return null;
    return (
      <div className="space-y-3">
        {alerts.map((alert: RiskAlert, idx: number) => (
          <div key={idx} className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className={`h-4 w-4 mt-1 ${
                alert.severity === 'critical' ? 'text-red-500' :
                alert.severity === 'high' ? 'text-orange-400' :
                alert.severity === 'medium' ? 'text-amber-400' : 'text-gray-400'
              }`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm">{alert.title}</h4>
                  <Badge variant="destructive" className="text-xs">{alert.severity}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                {alert.mitigationSuggestions && alert.mitigationSuggestions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{t('knowledge.briefingGenerator.mitigation')}:</p>
                    <ul className="list-disc list-inside text-xs text-muted-foreground">
                      {alert.mitigationSuggestions.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{t('knowledge.briefingGenerator.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('knowledge.briefingGenerator.subtitle')}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => generateWeeklyMutation.mutate()}
            disabled={generateWeeklyMutation.isPending}
            className="gap-2"
            data-testid="button-generate-weekly"
          >
            {generateWeeklyMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {t('knowledge.briefingGenerator.weeklyDigest')}
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-create-briefing">
                <Plus className="h-4 w-4" />
                {t('knowledge.briefingGenerator.newBriefing')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t('knowledge.briefingGenerator.createBriefing')}</DialogTitle>
                <DialogDescription>
                  {t('knowledge.briefingGenerator.createBriefingDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t('knowledge.briefingGenerator.titleLabel')}</Label>
                  <Input
                    placeholder={t('knowledge.briefingGenerator.titlePlaceholder')}
                    value={newBriefing.title}
                    onChange={(e) => setNewBriefing({ ...newBriefing, title: e.target.value })}
                    data-testid="input-briefing-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('knowledge.briefingGenerator.briefingType')}</Label>
                  <Select
                    value={newBriefing.briefingType}
                    onValueChange={(v) => setNewBriefing({ ...newBriefing, briefingType: v })}
                  >
                    <SelectTrigger data-testid="select-briefing-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BRIEFING_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <div className="font-medium">{t(type.labelKey)}</div>
                            <div className="text-xs text-muted-foreground">{t(type.descKey)}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(newBriefing.briefingType === "topic_deep_dive" || newBriefing.briefingType === "custom") && (
                  <div className="space-y-2">
                    <Label>{t('knowledge.briefingGenerator.topicFocusArea')}</Label>
                    <Textarea
                      placeholder={t('knowledge.briefingGenerator.topicPlaceholder')}
                      value={newBriefing.customTopic}
                      onChange={(e) => setNewBriefing({ ...newBriefing, customTopic: e.target.value })}
                      data-testid="textarea-custom-topic"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{t('knowledge.briefingGenerator.cancel')}</Button>
                <Button
                  onClick={() => createBriefingMutation.mutate(newBriefing)}
                  disabled={!newBriefing.title || createBriefingMutation.isPending}
                  className="gap-2"
                  data-testid="button-submit-briefing"
                >
                  {createBriefingMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {t('knowledge.briefingGenerator.generate')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <Card className="h-[700px] overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{t('knowledge.briefingGenerator.briefings')}</CardTitle>
              <CardDescription>
                {t('knowledge.briefingGenerator.briefingsAvailable', { count: briefingsTotal })}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100%-5rem)]">
              {briefingsLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-lg" />
                  ))}
                </div>
              ) : briefings.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                  <FileText className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm text-center">{t('knowledge.briefingGenerator.noBriefingsYet')}</p>
                  <p className="text-xs text-center">{t('knowledge.briefingGenerator.createFirst')}</p>
                </div>
              ) : (
                <ScrollArea className="h-full px-4 pb-4">
                  <div className="space-y-2">
                    {briefings.map((briefing) => (
                      <Card
                        key={briefing.id}
                        className={`cursor-pointer transition-all hover-elevate ${
                          selectedBriefing === briefing.id ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => setSelectedBriefing(briefing.id)}
                        data-testid={`card-briefing-${briefing.id}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">{briefing.title}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {briefing.briefingType.replace("_", " ")}
                                </Badge>
                                <Badge className={`text-xs ${STATUS_COLORS[briefing.status]}`}>
                                  {briefing.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(briefing.createdAt), "MMM d, yyyy")}
                            </span>
                            {briefing.qualityScore && (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {briefing.qualityScore}%
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-2">
          <Card className="h-[700px] overflow-hidden">
            {!selectedBriefing ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Eye className="h-16 w-16 mb-4 opacity-30" />
                <p>{t('knowledge.briefingGenerator.selectBriefing')}</p>
              </div>
            ) : detailLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : detail ? (
              <>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{detail.briefing.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Badge className={STATUS_COLORS[detail.briefing.status]}>
                          {detail.briefing.status}
                        </Badge>
                        <span>
                          {format(new Date(detail.briefing.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {detail.briefing.status === 'ready' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => publishMutation.mutate(detail.briefing.id)}
                          disabled={publishMutation.isPending}
                          className="gap-1"
                          data-testid="button-publish-briefing"
                        >
                          <Send className="h-3 w-3" />
                          {t('knowledge.briefingGenerator.publish')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => archiveMutation.mutate(detail.briefing.id)}
                        disabled={archiveMutation.isPending}
                        data-testid="button-archive-briefing"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 h-[calc(100%-6rem)]">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-6">
                      {detail.briefing.executiveSummary && (
                        <div className="space-y-2">
                          <h3 className="font-semibold flex items-center gap-2">
                            <FileCheck className="h-4 w-4 text-primary" />
                            {t('knowledge.briefingGenerator.executiveSummary')}
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {detail.briefing.executiveSummary}
                          </p>
                        </div>
                      )}

                      <Separator />

                      <Tabs defaultValue="findings" className="w-full">
                        <TabsList className="w-full justify-start">
                          <TabsTrigger value="findings" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('knowledge.briefingGenerator.keyFindings')}
                          </TabsTrigger>
                          <TabsTrigger value="trends" className="gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {t('knowledge.briefingGenerator.trends')}
                          </TabsTrigger>
                          <TabsTrigger value="recommendations" className="gap-1">
                            <Lightbulb className="h-3 w-3" />
                            {t('knowledge.briefingGenerator.recommendations')}
                          </TabsTrigger>
                          <TabsTrigger value="risks" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {t('knowledge.briefingGenerator.risks')}
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="findings" className="mt-4">
                          {renderKeyFindings(detail.briefing.keyFindings as KeyFinding[] | null)}
                        </TabsContent>
                        <TabsContent value="trends" className="mt-4">
                          {renderTrends(detail.briefing.trends as Trend[] | null)}
                        </TabsContent>
                        <TabsContent value="recommendations" className="mt-4">
                          {renderRecommendations(detail.briefing.recommendations as Recommendation[] | null)}
                        </TabsContent>
                        <TabsContent value="risks" className="mt-4">
                          {renderRiskAlerts(detail.briefing.riskAlerts as RiskAlert[] | null)}
                        </TabsContent>
                      </Tabs>

                      {detail.briefing.sourceDocumentIds && 
                       (detail.briefing.sourceDocumentIds as string[]).length > 0 && (
                        <div className="pt-4 border-t">
                          <p className="text-xs text-muted-foreground">
                            {t('knowledge.briefingGenerator.basedOnDocuments', { count: (detail.briefing.sourceDocumentIds as string[]).length })}
                            {detail.briefing.confidenceScore && (
                              <> | {t('knowledge.briefingGenerator.confidence')}: {Math.round((detail.briefing.confidenceScore as number) * 100)}%</>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
