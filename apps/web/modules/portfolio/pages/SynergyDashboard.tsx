import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingDown, Users, CheckCircle2, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface SynergyOpportunity {
  id: string;
  status: string;
  estimatedSavings?: string | number | null;
  recommendation?: {
    summary?: string;
    benefits?: string[];
  } | null;
  relatedDemandIds?: string[] | null;
  similarityScore?: number | string | null;
}

export default function SynergyDashboard() {
  const { t } = useTranslation();
  const { data: opportunities, isLoading } = useQuery<{ success: boolean; data: SynergyOpportunity[] }>({
    queryKey: ['/api/synergy-opportunities'],
  });

  const synergies: SynergyOpportunity[] = opportunities?.data || [];
  
  const draftSynergies = synergies.filter(s => s.status === 'draft');
  const validatedSynergies = synergies.filter(s => s.status === 'validated');
  const archivedSynergies = synergies.filter(s => s.status === 'archived');

  const totalSavings = synergies
    .filter(s => s.status !== 'archived')
    .reduce((sum, s) => sum + parseFloat(String(s.estimatedSavings ?? '0')), 0);

  if (isLoading) {
    return <div className="p-8" data-testid="text-loading-synergies">{t('portfolio.synergy.loading')}</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('portfolio.synergy.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('portfolio.synergy.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('portfolio.synergy.totalOpportunities')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-opportunities">{synergies.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('portfolio.synergy.acrossDepartments')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('portfolio.synergy.potentialSavings')}</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-potential-savings">
              {formatCurrency(totalSavings, 'AED')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('portfolio.synergy.fromConsolidation')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('portfolio.synergy.pendingReview')}</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-review">{draftSynergies.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('portfolio.synergy.awaitingValidation')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('portfolio.synergy.validated')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-validated-count">{validatedSynergies.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('portfolio.synergy.readyForAction')}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="draft" className="w-full">
        <TabsList>
          <TabsTrigger value="draft" data-testid="tab-draft-synergies">
            {t('portfolio.synergy.pendingReviewTab', { count: draftSynergies.length })}
          </TabsTrigger>
          <TabsTrigger value="validated" data-testid="tab-validated-synergies">
            {t('portfolio.synergy.validatedTab', { count: validatedSynergies.length })}
          </TabsTrigger>
          <TabsTrigger value="archived" data-testid="tab-archived-synergies">
            {t('portfolio.synergy.archivedTab', { count: archivedSynergies.length })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draft" className="space-y-4 mt-4">
          {draftSynergies.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground" data-testid="text-empty-draft">
                {t('portfolio.synergy.noPendingSynergies')}
              </CardContent>
            </Card>
          ) : (
            draftSynergies.map((synergy) => (
              <SynergyOpportunityCard key={synergy.id} synergy={synergy} />
            ))
          )}
        </TabsContent>

        <TabsContent value="validated" className="space-y-4 mt-4">
          {validatedSynergies.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground" data-testid="text-empty-validated">
                {t('portfolio.synergy.noValidatedSynergies')}
              </CardContent>
            </Card>
          ) : (
            validatedSynergies.map((synergy) => (
              <SynergyOpportunityCard key={synergy.id} synergy={synergy} />
            ))
          )}
        </TabsContent>

        <TabsContent value="archived" className="space-y-4 mt-4">
          {archivedSynergies.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground" data-testid="text-empty-archived">
                {t('portfolio.synergy.noArchivedSynergies')}
              </CardContent>
            </Card>
          ) : (
            archivedSynergies.map((synergy) => (
              <SynergyOpportunityCard key={synergy.id} synergy={synergy} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SynergyOpportunityCard({ synergy }: { synergy: SynergyOpportunity }) {
  const { t } = useTranslation();
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest(`/api/synergy-opportunities/${synergy.id}`, 'PATCH', { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/synergy-opportunities'] });
    }
  });

  const savings = parseFloat(String(synergy.estimatedSavings ?? '0'));
  const recommendation = synergy.recommendation || {};
  const relatedCount = synergy.relatedDemandIds?.length || 0;
  const similarityScore = Number(synergy.similarityScore ?? 0);

  return (
    <Card className="hover-elevate" data-testid={`card-synergy-${synergy.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span data-testid={`text-department-count-${synergy.id}`}>
                {t('portfolio.synergy.departmentsSimilar', { count: relatedCount + 1 })}
              </span>
            </CardTitle>
            <CardDescription className="mt-1" data-testid={`text-recommendation-${synergy.id}`}>
              {recommendation.summary || t('portfolio.synergy.collaborationDetected')}
            </CardDescription>
          </div>
          <Badge 
            variant={synergy.status === 'validated' ? 'default' : 'secondary'}
            data-testid={`status-synergy-${synergy.id}`}
          >
            {synergy.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
          <TrendingDown className="h-5 w-5 text-green-600" />
          <div>
            <div className="text-sm font-medium">{t('portfolio.synergy.estimatedSavings')}</div>
            <div className="text-2xl font-bold text-green-600" data-testid={`text-savings-${synergy.id}`}>
              {formatCurrency(savings, 'AED')}
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">{t('portfolio.synergy.similarityScore')}</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${similarityScore}%` }}
                />
              </div>
            <span className="text-sm font-medium" data-testid={`text-similarity-${synergy.id}`}>{similarityScore}%</span>
          </div>
        </div>

        {recommendation.benefits && recommendation.benefits.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">{t('portfolio.synergy.keyBenefits')}</div>
            <ul className="space-y-1">
              {recommendation.benefits.slice(0, 3).map((benefit: string, i: number) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span data-testid={`text-benefit-${synergy.id}-${i}`}>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {synergy.status === 'draft' && (
            <>
              <Button
                size="sm"
                onClick={() => updateStatusMutation.mutate('validated')}
                disabled={updateStatusMutation.isPending}
                data-testid={`button-validate-synergy-${synergy.id}`}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {t('portfolio.synergy.validate')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStatusMutation.mutate('archived')}
                disabled={updateStatusMutation.isPending}
                data-testid={`button-archive-synergy-${synergy.id}`}
              >
                {t('portfolio.synergy.archive')}
              </Button>
            </>
          )}
          {synergy.status === 'validated' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatusMutation.mutate('archived')}
              disabled={updateStatusMutation.isPending}
              data-testid={`button-archive-synergy-${synergy.id}`}
            >
              {t('portfolio.synergy.archive')}
            </Button>
          )}
          <Button size="sm" variant="ghost" data-testid={`button-view-details-${synergy.id}`}>
            {t('portfolio.synergy.viewDetails')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
