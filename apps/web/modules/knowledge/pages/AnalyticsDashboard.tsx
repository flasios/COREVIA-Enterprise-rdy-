import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { KPICard } from "@/components/analytics/KPICard";
import { TrendChart } from "@/components/analytics/TrendChart";
import { DocumentLeaderboard } from "@/components/analytics/DocumentLeaderboard";
import { ROIEstimator } from "@/components/analytics/ROIEstimator";
import { 
  RefreshCw, 
  BarChart3, 
  Users, 
  FileSearch, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  FileText 
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState("30");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Fetch analytics summary
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ['/api/analytics/summary', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/summary?days=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch analytics summary');
      const json = await res.json();
      return json.data;
    },
  });

  // Fetch trends data
  const { data: queryTrends, isLoading: trendsLoading } = useQuery({
    queryKey: ['/api/analytics/trends', 'queries', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/trends?metric=queries&days=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch query trends');
      const json = await res.json();
      return json.data;
    },
  });

  const { data: confidenceTrends } = useQuery({
    queryKey: ['/api/analytics/trends', 'confidence', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/trends?metric=confidence&days=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch confidence trends');
      const json = await res.json();
      return json.data;
    },
  });

  // Fetch top documents
  const { data: topDocuments, isLoading: docsLoading } = useQuery({
    queryKey: ['/api/analytics/documents'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/documents?sortBy=citations&limit=10');
      if (!res.ok) throw new Error('Failed to fetch top documents');
      const json = await res.json();
      return json.data;
    },
  });

  // Fetch knowledge gaps
  const { data: knowledgeGaps, isLoading: gapsLoading } = useQuery({
    queryKey: ['/api/analytics/gaps'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/gaps?limit=5');
      if (!res.ok) throw new Error('Failed to fetch knowledge gaps');
      const json = await res.json();
      return json.data;
    },
  });

  // Fetch ROI metrics
  const { data: roiMetrics, isLoading: roiLoading } = useQuery({
    queryKey: ['/api/analytics/roi', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/roi?days=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch ROI metrics');
      const json = await res.json();
      return json.data;
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await apiRequest('POST', '/api/analytics/refresh');
      
      // Invalidate ALL analytics queries using predicate
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/analytics/');
        }
      });
      
      toast({
        title: t('knowledge.analyticsDash.refreshed'),
        description: t('knowledge.analyticsDash.refreshedDesc'),
      });
    } catch (error) {
      console.error('Refresh failed:', error);
      toast({
        title: t('knowledge.analyticsDash.refreshFailed'),
        description: t('knowledge.analyticsDash.refreshFailedDesc'),
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (summaryError) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t('knowledge.analyticsDash.loadError')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="analytics-dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="dashboard-title">
            {t('knowledge.analyticsDash.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('knowledge.analyticsDash.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]" data-testid="select-time-range">
              <SelectValue placeholder={t('knowledge.analyticsDash.selectTimeRange')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t('knowledge.analyticsDash.last7days')}</SelectItem>
              <SelectItem value="30">{t('knowledge.analyticsDash.last30days')}</SelectItem>
              <SelectItem value="90">{t('knowledge.analyticsDash.last90days')}</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="default"
            disabled={isRefreshing}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t('knowledge.analyticsDash.refresh')}
          </Button>
        </div>
      </div>

      {/* KPI Tiles */}
      {summaryLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title={t('knowledge.analyticsDash.totalQueries')}
            value={summary.totalQueries}
            icon={<BarChart3 className="h-4 w-4" />}
            description={t('knowledge.analyticsDash.fromAllUsers')}
          />
          <KPICard
            title={t('knowledge.analyticsDash.avgConfidence')}
            value={`${(summary.avgConfidence * 100).toFixed(0)}%`}
            icon={<TrendingUp className="h-4 w-4" />}
            description={t('knowledge.analyticsDash.searchRelevance')}
          />
          <KPICard
            title={t('knowledge.analyticsDash.activeUsers')}
            value={summary.activeUsers}
            icon={<Users className="h-4 w-4" />}
            description={t('knowledge.analyticsDash.usingKnowledgeCentre')}
          />
          <KPICard
            title={t('knowledge.analyticsDash.timeSaved')}
            value={`${summary.timeSaved.toFixed(0)} hrs`}
            icon={<Clock className="h-4 w-4" />}
            description={t('knowledge.analyticsDash.fromAiGenerations')}
          />
        </div>
      ) : null}

      {/* Charts Row 1 - Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('knowledge.analyticsDash.queryVolumeTrends')}</CardTitle>
            <CardDescription>{t('knowledge.analyticsDash.dailyQueryCounts')}</CardDescription>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-[300px]" />
            ) : queryTrends ? (
              <TrendChart 
                data={queryTrends} 
                title={t('knowledge.analytics.queriesTitle')}
                color="#3b82f6"
                yAxisLabel={t('knowledge.analytics.queriesYAxis')}
              />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                {t('knowledge.analyticsDash.noTrendData')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('knowledge.analyticsDash.confidenceTrends')}</CardTitle>
            <CardDescription>{t('knowledge.analyticsDash.avgSearchConfidence')}</CardDescription>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-[300px]" />
            ) : confidenceTrends ? (
              <TrendChart 
                data={confidenceTrends} 
                title={t('knowledge.analytics.confidenceTitle')}
                color="#10b981"
                yAxisLabel={t('knowledge.analytics.confidenceScoreYAxis')}
              />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                {t('knowledge.analyticsDash.noTrendData')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 - Documents & Gaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('knowledge.analyticsDash.topDocuments')}</CardTitle>
            <CardDescription>{t('knowledge.analyticsDash.topDocumentsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {docsLoading ? (
              <Skeleton className="h-[400px]" />
            ) : topDocuments && topDocuments.length > 0 ? (
              <DocumentLeaderboard documents={topDocuments} sortBy="citations" />
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">{t('knowledge.analyticsDash.noDocuments')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('knowledge.analyticsDash.knowledgeGaps')}</CardTitle>
            <CardDescription>{t('knowledge.analyticsDash.knowledgeGapsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {gapsLoading ? (
              <Skeleton className="h-[400px]" />
            ) : knowledgeGaps && knowledgeGaps.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-auto">
                {knowledgeGaps.map((gap: { query: string; avgConfidence: number; count: number; suggestedCategory: string }, index: number) => (
                  <Alert key={index}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-medium text-sm">{gap.query}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{t('knowledge.analytics.confidenceLabel', { value: (gap.avgConfidence * 100).toFixed(0) })}</span>
                          <span>{t('knowledge.analyticsDash.count')}: {gap.count}</span>
                          <span>{t('knowledge.analyticsDash.category')}: {gap.suggestedCategory}</span>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center text-center">
                <FileSearch className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">{t('knowledge.analyticsDash.noGaps')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('knowledge.analyticsDash.noGapsDesc')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ROI Calculator */}
      <Card>
        <CardHeader>
          <CardTitle>{t('knowledge.analyticsDash.roiCalculator')}</CardTitle>
          <CardDescription>
            {t('knowledge.analyticsDash.roiCalculatorDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roiLoading ? (
            <Skeleton className="h-[400px]" />
          ) : roiMetrics ? (
            <ROIEstimator initialMetrics={roiMetrics} />
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              {t('knowledge.analyticsDash.noRoiData')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
