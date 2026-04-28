import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AIConfidenceBadge, AICitationsList } from '@/components/shared/ai';
import { apiRequest } from '@/lib/queryClient';
import { Search, AlertTriangle, Sparkles, Clock, TrendingUp, DollarSign, Shield, Cpu, Briefcase, Bot } from 'lucide-react';
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import type { AICitation } from '@shared/aiAdapters';

// Form schema
const querySchema = z.object({
  query: z.string().min(10, 'Query must be at least 10 characters').max(500, 'Query must be less than 500 characters'),
});

type QueryFormValues = z.infer<typeof querySchema>;

// API response types
interface OrchestrationResponse {
  runId: string;
  summary: string;
  agentResponses: Array<{
    domain: string;
    answer: string;
    confidence: number;
    citationCount: number;
  }>;
  citations: AICitation[];
  confidence: number;
  conflicts: Array<{
    domains: string[];
    type: string;
    severity: string;
    description: string;
  }>;
  classification: {
    domains: string[];
    confidence: number;
    method: string;
  };
  timings: {
    totalTime: number;
    classificationTime: number;
    retrievalTime: number;
    agentTimings: Record<string, number>;
  };
}

export function AskExperts() {
  const [result, setResult] = useState<OrchestrationResponse | null>(null);
  const { t } = useTranslation();

  const form = useForm<QueryFormValues>({
    resolver: zodResolver(querySchema),
    defaultValues: {
      query: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: QueryFormValues) => {
      const response = await apiRequest('POST', '/api/rag/orchestrate', values);
      const json = await response.json();
      return json.data as OrchestrationResponse;
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const onSubmit = (values: QueryFormValues) => {
    mutation.mutate(values);
  };

  const getDomainIcon = (domain: string, size: 'sm' | 'lg' = 'sm') => {
    const iconClass = size === 'lg' ? "h-6 w-6" : "h-4 w-4";
    switch (domain.toLowerCase()) {
      case 'finance':
        return <DollarSign className={iconClass} />;
      case 'security':
        return <Shield className={iconClass} />;
      case 'technical':
        return <Cpu className={iconClass} />;
      case 'business':
        return <Briefcase className={iconClass} />;
      default:
        return <Bot className={iconClass} />;
    }
  };

  const getDomainColor = (domain: string) => {
    switch (domain.toLowerCase()) {
      case 'finance':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'security':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      case 'technical':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'business':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6" data-testid="container-ask-experts">
      {/* Query Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HexagonLogoFrame px={20} />
            <CardTitle>{t('ai.askExperts.title')}</CardTitle>
          </div>
          <CardDescription>
            {t('ai.askExperts.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="query"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('ai.askExperts.yourQuestion')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('ai.askExperts.placeholder')}
                        {...field}
                        disabled={mutation.isPending}
                        data-testid="input-query"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="w-full"
                data-testid="button-submit-query"
              >
                {mutation.isPending ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                    {t('ai.askExperts.consultingExperts')}
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    {t('ai.askExperts.askExperts')}
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Loading State */}
      {mutation.isPending && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {mutation.isError && (
        <Alert variant="destructive" data-testid="alert-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('ai.askExperts.error')}</AlertTitle>
          <AlertDescription>
            {mutation.error instanceof Error ? mutation.error.message : t('ai.askExperts.defaultError')}
          </AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {result && !mutation.isPending && (
        <div className="space-y-6">
          {/* Conflicts Banner */}
          {result.conflicts && result.conflicts.length > 0 && (
            <Alert variant="destructive" data-testid="alert-conflicts">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('ai.askExperts.conflictsTitle')}</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{t('ai.askExperts.conflictsDescription')}</p>
                <ul className="list-disc list-inside space-y-1">
                  {result.conflicts.map((conflict, index) => (
                    <li key={index} className="text-sm">
                      <span className="font-medium">{conflict.type.toUpperCase()}:</span> {conflict.description}
                    </li>
                  ))}
                </ul>
                <p className="text-xs mt-2">
                  {t('ai.askExperts.conflictsSynthesis')}
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Executive Summary */}
          <Card data-testid="card-executive-summary">
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                    <CardTitle>{t('ai.askExperts.executiveSummary')}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <AIConfidenceBadge
                    confidence={{
                      tier: result.confidence >= 0.7 ? 'high' : result.confidence >= 0.4 ? 'medium' : 'low',
                      percentage: Math.round(result.confidence * 100),
                      score: result.confidence,
                      breakdown: {
                        maxScore: result.confidence,
                        meanScore: result.confidence,
                        uniqueDocumentCount: result.citations.length,
                        coverageScore: result.confidence,
                      }
                    }}
                  />
                  <Badge variant="outline" className="gap-1" data-testid="badge-agent-count">
                    <HexagonLogoFrame px={12} />
                    {t('ai.askExperts.experts', { count: result.agentResponses.length })}
                  </Badge>
                  <Badge variant="outline" className="gap-1" data-testid="badge-processing-time">
                    <Clock className="h-3 w-3" />
                    {(result.timings.totalTime / 1000).toFixed(2)}s
                  </Badge>
                </div>
              </div>
              <CardDescription>
                {t('ai.askExperts.synthesizedInsights', { domains: result.classification.domains.join(', ') })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {result.summary.split('\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Per-Agent Responses */}
          <Card data-testid="card-agent-responses">
            <CardHeader>
              <CardTitle>{t('ai.askExperts.expertAnalysis')}</CardTitle>
              <CardDescription>
                {t('ai.askExperts.expertAnalysisDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={result.agentResponses[0]?.domain} className="w-full">
                <TabsList className="w-full flex-wrap h-auto gap-2">
                  {result.agentResponses.map((response) => (
                    <TabsTrigger
                      key={response.domain}
                      value={response.domain}
                      className="flex items-center gap-2"
                      data-testid={`tab-trigger-${response.domain}`}
                    >
                      <span>{getDomainIcon(response.domain)}</span>
                      <span className="capitalize">{response.domain}</span>
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(response.confidence * 100)}%
                      </Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {result.agentResponses.map((response) => (
                  <TabsContent
                    key={response.domain}
                    value={response.domain}
                    className="mt-4"
                    data-testid={`tab-content-${response.domain}`}
                  >
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            {getDomainIcon(response.domain, 'lg')}
                            <CardTitle className="capitalize">{t('ai.askExperts.expert', { domain: response.domain })}</CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getDomainColor(response.domain)}>
                              <TrendingUp className="h-3 w-3 mr-1" />
                              {t('ai.askExperts.confidence', { value: Math.round(response.confidence * 100) })}
                            </Badge>
                            <Badge variant="outline">
                              {t('ai.askExperts.citations', { count: response.citationCount })}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          {response.answer.split('\n').map((paragraph, index) => (
                            <p key={index}>{paragraph}</p>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          {/* Citations */}
          {result.citations.length > 0 && (
            <AICitationsList citations={result.citations} />
          )}

          {/* Performance Metrics */}
          <Card data-testid="card-performance-metrics">
            <CardHeader>
              <CardTitle className="text-sm">{t('ai.askExperts.performanceMetrics')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">{t('ai.askExperts.classification')}</p>
                  <p className="font-medium">{result.timings.classificationTime}ms</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('ai.askExperts.retrieval')}</p>
                  <p className="font-medium">{result.timings.retrievalTime}ms</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('ai.askExperts.totalTime')}</p>
                  <p className="font-medium">{result.timings.totalTime}ms</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('ai.askExperts.method')}</p>
                  <p className="font-medium capitalize">{result.classification.method}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
