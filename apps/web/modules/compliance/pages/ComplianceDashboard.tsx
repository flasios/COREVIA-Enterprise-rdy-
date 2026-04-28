import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ComplianceScoreCard } from '@/modules/compliance/components/ComplianceScoreCard';
import { ViolationRow } from '@/modules/compliance/components/ViolationRow';
import { FixPreviewModal } from '@/modules/compliance/components/FixPreviewModal';
import { CategoryBreakdownChart } from '@/modules/compliance/components/CategoryBreakdownChart';
import { ComplianceHistoryChart } from '@/modules/compliance/components/ComplianceHistoryChart';
import { RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { ComplianceStatus, ComplianceViolation } from '@shared/complianceTypes';

interface ComplianceDashboardProps {
  reportId: string;
  embedded?: boolean;
}

interface ComplianceStatusResponse {
  data?: ComplianceStatus;
}

interface ComplianceRunItem {
  runAt: string;
  overallScore?: number;
}

interface ComplianceRunsResponse {
  data?: ComplianceRunItem[];
}

export default function ComplianceDashboard({ reportId, embedded = false }: ComplianceDashboardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedViolation, setSelectedViolation] = useState<ComplianceViolation | null>(null);

  // Fetch compliance status
  const { data: statusResponse, isLoading: isLoadingStatus, error: statusError } = useQuery<ComplianceStatusResponse>({
    queryKey: ['/api/compliance/status', reportId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/compliance/status/${reportId}`);
      return response.json();
    },
    enabled: !!reportId,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Fetch compliance history
  const { data: historyResponse } = useQuery<ComplianceRunsResponse>({
    queryKey: ['/api/compliance/runs', reportId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/compliance/runs/${reportId}`);
      return response.json();
    },
    enabled: !!reportId,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Run compliance check mutation
  const runCompliance = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/compliance/run/${reportId}`, {
        triggerSource: 'manual'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/compliance/status', reportId] });
      queryClient.invalidateQueries({ queryKey: ['/api/compliance/runs', reportId] });
      toast({
        title: t('compliance.checkComplete'),
        description: t('compliance.checkCompleteDesc'),
      });
    },
    onError: (error) => {
      toast({
        title: t('compliance.checkFailed'),
        description: error instanceof Error ? error.message : t('compliance.checkFailedDesc'),
        variant: 'destructive',
      });
    },
  });

  // Apply fix mutation
  const applyFix = useMutation({
    mutationFn: async (violationId: number) => {
      const response = await apiRequest('POST', `/api/compliance/apply-fix/${violationId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/compliance/status', reportId] });
      queryClient.invalidateQueries({ queryKey: ['/api/compliance/runs', reportId] });
      queryClient.invalidateQueries({ queryKey: ['/api/demand-reports', reportId] });
      toast({
        title: t('compliance.fixApplied'),
        description: t('compliance.fixAppliedDesc'),
      });
      setSelectedViolation(null);
    },
    onError: (error) => {
      toast({
        title: t('compliance.fixFailed'),
        description: error instanceof Error ? error.message : t('compliance.fixFailedDesc'),
        variant: 'destructive',
      });
    },
  });

  const complianceStatus: ComplianceStatus | null = statusResponse?.data || null;
  const complianceHistory = historyResponse?.data || [];

  // Prepare history chart data
  const historyChartData = complianceHistory.map((run) => ({
    date: run.runAt,
    score: run.overallScore || 0,
  }));

  // Loading state
  if (isLoadingStatus) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Error state
  if (statusError) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {statusError instanceof Error ? statusError.message : t('compliance.loadFailed')}
        </AlertDescription>
      </Alert>
    );
  }

  // No data state
  if (!complianceStatus) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('compliance.noCheckRunYet')}</CardTitle>
            <CardDescription>
              {t('compliance.noCheckRunYetDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => runCompliance.mutate()}
              disabled={runCompliance.isPending}
              data-testid="button-run-initial-check"
            >
              {runCompliance.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('compliance.runningCheck')}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t('compliance.runComplianceCheck')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={embedded ? 'space-y-6' : 'space-y-6 p-6'} data-testid="page-compliance-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('compliance.checkResults')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('compliance.lastCheck')}: {format(new Date(complianceStatus.run.runAt), 'MMM dd, yyyy HH:mm')}
          </p>
        </div>
        <Button
          onClick={() => runCompliance.mutate()}
          disabled={runCompliance.isPending}
          data-testid="button-rerun-check"
        >
          {runCompliance.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-run Check
            </>
          )}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ComplianceScoreCard
          score={complianceStatus.overallScore}
          label={t('compliance.overallComplianceScore')}
          data-testid="card-overall-score"
        />
        <ComplianceScoreCard
          score={complianceStatus.criticalViolations}
          label={t('compliance.criticalViolations')}
          className="bg-red-50 dark:bg-red-950/20"
          data-testid="card-critical-violations"
        />
        <ComplianceScoreCard
          score={complianceStatus.totalViolations}
          label={t('compliance.totalViolations')}
          data-testid="card-total-violations"
        />
        <Card data-testid="card-last-check">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('compliance.lastCheck')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">
                {format(new Date(complianceStatus.run.runAt), 'MMM dd, HH:mm')}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {complianceStatus.categoryScores.length > 0 && (
          <CategoryBreakdownChart data={complianceStatus.categoryScores} />
        )}
        {historyChartData.length > 0 && (
          <ComplianceHistoryChart data={historyChartData} />
        )}
      </div>

      {/* Violations Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('compliance.complianceViolations')}</CardTitle>
          <CardDescription>
            {complianceStatus.totalViolations === 0
              ? t('compliance.noViolationsFound')
              : t('compliance.violationsFound', { count: complianceStatus.totalViolations, categories: complianceStatus.categoryScores.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {complianceStatus.violations.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('compliance.allClear')}</h3>
              <p className="text-muted-foreground">
                {t('compliance.allClearDesc')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-violations">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-sm">{t('compliance.severity')}</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">{t('compliance.rule')}</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">{t('compliance.section')}</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">{t('compliance.issue')}</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">{t('compliance.suggestedFix')}</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">{t('app.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {complianceStatus.violations.map((violation) => (
                    <ViolationRow
                      key={violation.id}
                      violation={violation}
                      onApplyFix={(id) => applyFix.mutate(id)}
                      onPreview={(v) => setSelectedViolation(v)}
                      isApplying={applyFix.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fix Preview Modal */}
      <FixPreviewModal
        violation={selectedViolation}
        onClose={() => setSelectedViolation(null)}
        onApply={(id) => applyFix.mutate(id)}
        isApplying={applyFix.isPending}
      />
    </div>
  );
}
