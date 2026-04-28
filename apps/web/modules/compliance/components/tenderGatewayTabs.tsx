import { useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles, FileText, Eye, ArrowLeft, Loader2,
  Clock, AlertTriangle, CheckCircle2, TrendingUp,
  Bell, Target, Shield, Zap,
  ChevronRight, ArrowUpRight, Timer, AlertCircle, Building,
} from 'lucide-react';
import { RfpDocumentTab } from '@/modules/portfolio';
import { useToast } from '@/hooks/use-toast';
import type { TenderPackage, DemandReport } from '@shared/schema';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TenderWithDemandData extends TenderPackage {
  projectTitle?: string;
  organizationName?: string;
  demandId?: string;
}

export interface DemandForSelect extends DemandReport {
  projectTitle?: string;
  title?: string;
}

// ─── OverviewTab ─────────────────────────────────────────────────────────────

export function OverviewTab() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  
  const { data: tendersData, isLoading } = useQuery<{ success: boolean; data: TenderWithDemandData[] }>({
    queryKey: ['/api/tenders'],
  });

  const tenders = tendersData?.data || [];
  
  const draftCount = tenders.filter(t => t.status === 'draft').length;
  const reviewCount = tenders.filter(t => t.status === 'review').length;
  const publishedCount = tenders.filter(t => t.status === 'published').length;
  
  const recentTenders = tenders.slice(0, 5);

  const slaMetrics = {
    onTrack: Math.round((publishedCount / (tenders.length || 1)) * 100),
    atRisk: draftCount > 0 ? 1 : 0,
    breached: 0,
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('compliance.tenderTabs.totalDocuments')}</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{tenders.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/20">
                <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-500">+12%</span> {t('compliance.tenderTabs.fromLastMonth')}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('compliance.tenderTabs.inReview')}</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{reviewCount + draftCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/20">
                <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Timer className="w-3 h-3" />
              {t('compliance.tenderTabs.avgDaysToPublish')}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('compliance.tenderTabs.published')}</p>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{publishedCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/20">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3 h-3 text-emerald-500" />
              {t('compliance.tenderTabs.uaeCompliant')}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('compliance.tenderTabs.slaHealth')}</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{slaMetrics.onTrack}%</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/20">
                <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="mt-4">
              <Progress value={slaMetrics.onTrack} className="h-1.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SLA Status and Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SLA Health Panel */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-500" />
                {t('compliance.tenderTabs.slaStatusOverview')}
              </CardTitle>
              <Badge variant="outline" className="text-xs">{t('compliance.tenderTabs.lastUpdatedJustNow')}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-medium">{t('compliance.tenderTabs.onTrack')}</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{tenders.length - slaMetrics.atRisk}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('compliance.tenderTabs.withinDeadline')}</p>
              </div>
              
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium">{t('compliance.tenderTabs.atRisk')}</span>
                </div>
                <p className="text-2xl font-bold text-amber-600">{slaMetrics.atRisk}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('compliance.tenderTabs.actionNeeded')}</p>
              </div>
              
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium">{t('compliance.tenderTabs.breached')}</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{slaMetrics.breached}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('compliance.tenderTabs.pastDeadline')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-500" />
              {t('compliance.tenderTabs.alertsNotifications')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {draftCount > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t('compliance.tenderTabs.draftsPendingReview', { count: draftCount })}</p>
                  <p className="text-xs text-muted-foreground">{t('compliance.tenderTabs.actionRequiredByReviewer')}</p>
                </div>
              </div>
            )}
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Clock className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t('compliance.tenderTabs.upcomingDeadline')}</p>
                <p className="text-xs text-muted-foreground">{t('compliance.tenderTabs.documentsDueIn7Days')}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t('compliance.tenderTabs.slaComplianceAchieved')}</p>
                <p className="text-xs text-muted-foreground">{t('compliance.tenderTabs.allTargetsMet')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Documents */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              {t('compliance.tenderTabs.recentDocuments')}
            </CardTitle>
            <Button variant="ghost" size="sm" className="gap-1">
              {t('compliance.tenderTabs.viewAll')} <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentTenders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>{t('compliance.tenderTabs.noTenderDocuments')}</p>
              <p className="text-sm">{t('compliance.tenderTabs.generateFirstRfp')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTenders.map((tender: TenderWithDemandData) => (
                <div 
                  key={tender.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/tenders/${tender.id}`)}
                  data-testid={`recent-tender-${tender.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-indigo-500/10">
                      <FileText className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <p className="font-medium">{tender.projectTitle || t('compliance.tenderTabs.tenderNumber', { id: tender.id.substring(0, 8) })}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Building className="w-3 h-3" />
                        {tender.organizationName || t('compliance.tenderTabs.notRecorded')}
                        <span className="text-muted-foreground/50">•</span>
                        {new Date(tender.generatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-600 border-indigo-500/30">
                      {t('compliance.tenderTabs.projectAccelerator')}
                    </Badge>
                    <Badge variant={tender.status === 'published' ? 'default' : 'secondary'}>
                      {tender.status}
                    </Badge>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── DocumentsTab ────────────────────────────────────────────────────────────

export function DocumentsTab() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  
  const { data: tendersData, isLoading } = useQuery<{ success: boolean; data: TenderWithDemandData[] }>({
    queryKey: ['/api/tenders'],
  });

  const tenders = tendersData?.data || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t('compliance.tenderTabs.rfpDocuments')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('compliance.tenderTabs.allTenderDocuments')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="all">
            <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
              <SelectValue placeholder={t('compliance.tenderTabs.filterStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('compliance.tenderTabs.allStatus')}</SelectItem>
              <SelectItem value="draft">{t('compliance.tenderTabs.draft')}</SelectItem>
              <SelectItem value="review">{t('compliance.tenderTabs.inReviewStatus')}</SelectItem>
              <SelectItem value="published">{t('compliance.tenderTabs.publishedStatus')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {tenders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground/20" />
            <h3 className="text-lg font-semibold mb-2">{t('compliance.tenderTabs.noDocumentsYet')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('compliance.tenderTabs.generateRfpFromAccelerator')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tenders.map((tender: TenderWithDemandData) => (
            <Card
              key={tender.id}
              className="hover-elevate cursor-pointer transition-all"
              onClick={() => navigate(`/tenders/${tender.id}`)}
              data-testid={`card-tender-${tender.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="p-2 rounded-lg bg-indigo-500/10">
                    <FileText className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-600 border-indigo-500/30">
                      {t('compliance.tenderTabs.projectAccelerator')}
                    </Badge>
                    <Badge variant={tender.status === 'published' ? 'default' : 'secondary'}>
                      {tender.status}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="mt-3 text-base">
                  {tender.projectTitle || t('compliance.tenderTabs.tenderNumber', { id: tender.id.substring(0, 8) })}
                </CardTitle>
                <CardDescription className="text-xs flex items-center gap-1">
                  <Building className="w-3 h-3" />
                  {tender.organizationName || t('compliance.tenderTabs.notRecorded')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Separator className="my-3" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {t('compliance.tenderTabs.generated')} {new Date(tender.generatedAt).toLocaleDateString()}
                  </span>
                  <Button size="sm" variant="ghost" className="h-7 gap-1">
                    <Eye className="h-3 w-3" />
                    {t('compliance.tenderTabs.view')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── GenerateTab ─────────────────────────────────────────────────────────────

export function GenerateTab() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedDemandId, setSelectedDemandId] = useState('');
  const [selectedSlaType, setSelectedSlaType] = useState('standard');

  const { data: demandsData, isLoading: isLoadingDemands } = useQuery<{ success: boolean; data: DemandForSelect[] }>({
    queryKey: ['/api/demand-reports'],
  });

  const demands = (demandsData?.data || []).filter((d: DemandForSelect) => d.workflowStatus !== 'draft');

  const generateMutation = useMutation({
    mutationFn: async (demandId: string) => {
      const response = await apiRequest('POST', `/api/tenders/generate/${demandId}`, {});
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenders'] });
      toast({
        title: t('compliance.tenderTabs.rfpGenerated'),
        description: t('compliance.tenderTabs.rfpGeneratedDescription'),
      });
      const tenderId = data?.data?.id;
      if (tenderId) {
        navigate(`/tenders/${tenderId}`);
      }
    },
    onError: (error: Error) => {
      toast({
        title: t('compliance.tenderTabs.generationFailed'),
        description: error.message || t('compliance.tenderTabs.failedToGenerate'),
        variant: 'destructive',
      });
    },
  });

  const handleGenerate = () => {
    if (selectedDemandId) {
      generateMutation.mutate(selectedDemandId);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="border-2 border-dashed">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto p-4 rounded-full bg-indigo-500/10 w-fit mb-4">
            <Sparkles className="w-8 h-8 text-indigo-500" />
          </div>
          <CardTitle className="text-2xl">{t('compliance.tenderTabs.generateNewRfp')}</CardTitle>
          <CardDescription>
            {t('compliance.tenderTabs.generateNewRfpDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Demand Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('compliance.tenderTabs.selectDemandRequest')}</label>
            {isLoadingDemands ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : demands.length === 0 ? (
              <div className="p-4 border border-dashed rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  {t('compliance.tenderTabs.noDemandRequests')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('compliance.tenderTabs.createDemandFirst')}
                </p>
              </div>
            ) : (
              <Select value={selectedDemandId} onValueChange={setSelectedDemandId}>
                <SelectTrigger data-testid="select-demand">
                  <SelectValue placeholder={t('compliance.tenderTabs.chooseDemandRequest')} />
                </SelectTrigger>
                <SelectContent>
                  {demands.map((demand: DemandForSelect) => (
                    <SelectItem key={demand.id} value={demand.id}>
                      <div className="flex items-center gap-2">
                        <span>{demand.projectTitle || demand.title}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {demand.workflowStatus}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* SLA Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('compliance.tenderTabs.slaType')}</label>
            <Select value={selectedSlaType} onValueChange={setSelectedSlaType}>
              <SelectTrigger data-testid="select-sla-type">
                <SelectValue placeholder={t('compliance.tenderTabs.selectSlaType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <div>
                      <span className="font-medium">{t('compliance.tenderTabs.standard')}</span>
                      <span className="text-xs text-muted-foreground ml-2">{t('compliance.tenderTabs.30DaySubmission')}</span>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="urgent">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <div>
                      <span className="font-medium">{t('compliance.tenderTabs.urgent')}</span>
                      <span className="text-xs text-muted-foreground ml-2">{t('compliance.tenderTabs.14DaySubmission')}</span>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="strategic">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-purple-500" />
                    <div>
                      <span className="font-medium">{t('compliance.tenderTabs.strategic')}</span>
                      <span className="text-xs text-muted-foreground ml-2">{t('compliance.tenderTabs.45DaySubmission')}</span>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* SLA Preview */}
          <div className="p-4 rounded-lg bg-muted/50 border">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-500" />
              {t('compliance.tenderTabs.slaTimelinePreview')}
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('compliance.tenderTabs.submissionDeadline')}</span>
                <span className="font-medium">
                  {selectedSlaType === 'urgent' ? t('compliance.tenderTabs.14Days') : selectedSlaType === 'strategic' ? t('compliance.tenderTabs.45Days') : t('compliance.tenderTabs.30Days')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('compliance.tenderTabs.reviewPeriod')}</span>
                <span className="font-medium">{t('compliance.tenderTabs.7Days')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('compliance.tenderTabs.approvalWindow')}</span>
                <span className="font-medium">{t('compliance.tenderTabs.3Days')}</span>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button
            className="flex-1 gap-2"
            onClick={handleGenerate}
            disabled={!selectedDemandId || generateMutation.isPending || demands.length === 0}
            data-testid="button-generate-tender"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('compliance.tenderTabs.generating')}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {t('compliance.tenderTabs.generateRfpDocument')}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// ─── TenderPreview ───────────────────────────────────────────────────────────

export function TenderPreview({ tenderId }: { tenderId: string }) {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  const { data: tenderData, isLoading } = useQuery<{ success: boolean; data: TenderWithDemandData }>({
    queryKey: ['/api/tenders', tenderId],
  });

  const tender = tenderData?.data;
  const demandId = tender?.demandId;

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center" data-testid="text-loading-preview">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        {t('compliance.tenderTabs.loadingTender')}
      </div>
    );
  }

  if (!demandId) {
    return (
      <div className="p-8">
        <Button variant="ghost" onClick={() => navigate('/tenders')} className="mb-4" data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('compliance.tenderTabs.backToGateway')}
        </Button>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            {t('compliance.tenderTabs.unableToLoadTender')}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Button variant="ghost" onClick={() => navigate('/tenders')} className="mb-4" data-testid="button-back">
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t('compliance.tenderTabs.backToGateway')}
      </Button>
      
      <RfpDocumentTab 
        demandReportId={demandId}
        projectName={tender?.projectTitle}
        organizationName={tender?.organizationName}
      />
    </div>
  );
}
