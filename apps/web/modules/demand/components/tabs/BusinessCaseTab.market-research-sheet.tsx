import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { HexagonLogoFrame } from '@/components/shared/misc';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle,
  Clock,
  Globe,
  Lightbulb,
  MapPin,
  Package,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import type {
  LocalPlayer,
  MarketCountry,
  MarketPlayer,
  MarketResearch,
  Supplier,
  UseCase,
} from '../business-case';

interface BusinessCaseMarketResearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketResearch: MarketResearch | null;
}

export function BusinessCaseMarketResearchSheet({
  open,
  onOpenChange,
  marketResearch,
}: BusinessCaseMarketResearchSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-4xl">
        <div className="sticky top-0 z-10 border-b border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white">
          <div className="flex items-center gap-4">
            <HexagonLogoFrame size="lg" animated={true} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">COREVIA</h1>
                <Badge className="border-violet-400/50 bg-violet-500/30 text-violet-200">{t('demand.tabs.businessCase.marketIntelligence')}</Badge>
              </div>
              <p className="mt-0.5 text-sm text-violet-200/80">{t('demand.tabs.businessCase.enterprisePlatformDescription')}</p>
            </div>
            {marketResearch?.generatedAt && (
              <div className="text-right text-xs text-violet-300/70">
                <p>{t('demand.tabs.businessCase.generated')}</p>
                <p className="font-medium">{new Date(marketResearch.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            )}
          </div>
        </div>

        {marketResearch ? (
          <div className="space-y-6 p-6">
            {marketResearch.projectContext && (
              <Card className="border-2 border-violet-500/40 bg-gradient-to-br from-violet-500/5 via-indigo-500/5 to-purple-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5 text-violet-500" />
                    {t('demand.tabs.businessCase.researchFocus')}
                    <Badge className="ml-auto bg-violet-500 text-white">{t('demand.tabs.businessCase.projectSpecific')}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-4">
                    <p className="text-lg font-semibold text-violet-700 dark:text-violet-300">{marketResearch.projectContext.focusArea}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-muted-foreground">{t('demand.tabs.businessCase.keyObjectivesAddressed')}</h4>
                      <div className="space-y-1">
                        {marketResearch.projectContext.keyObjectives?.map((objective: string, index: number) => (
                          <div key={index} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                            <span>{objective}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-muted-foreground">{t('demand.tabs.businessCase.targetCapabilities')}</h4>
                      <div className="flex flex-wrap gap-2">
                        {marketResearch.projectContext.targetCapabilities?.map((capability: string, index: number) => (
                          <Badge key={index} variant="outline" className="border-violet-500/50 text-violet-600 dark:text-violet-400">{capability}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-blue-500/30">
              <CardHeader className="rounded-t-lg bg-gradient-to-r from-blue-500/10 to-blue-600/5 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Globe className="h-5 w-5 text-blue-500" />
                  {t('demand.tabs.businessCase.globalMarketOverview')}
                  <Badge className="ml-auto bg-blue-500 text-white">{marketResearch.globalMarket?.growthRate || 'N/A'}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('demand.tabs.businessCase.marketSize')}</p>
                    <p className="mt-1 text-xl font-bold text-blue-600 dark:text-blue-400">{marketResearch.globalMarket?.marketSize || 'N/A'}</p>
                  </div>
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('demand.tabs.businessCase.growthRateCagr')}</p>
                    <p className="mt-1 text-xl font-bold text-blue-600 dark:text-blue-400">{marketResearch.globalMarket?.growthRate || 'N/A'}</p>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    {t('demand.tabs.businessCase.keyMarketTrends')}
                  </h4>
                  <div className="grid gap-2">
                    {marketResearch.globalMarket?.keyTrends?.map((trend: string, index: number) => (
                      <div key={index} className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/30 p-3 text-sm">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-600">{index + 1}</div>
                        <span>{trend}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {(marketResearch.globalMarket?.technologyLandscape?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">{t('demand.tabs.businessCase.technologyLandscape')}</h4>
                    <div className="flex flex-wrap gap-2">
                      {marketResearch.globalMarket?.technologyLandscape?.map((technology: string, index: number) => (
                        <Badge key={index} className="border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300">{technology}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(marketResearch.globalMarket?.topCountries?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Globe className="h-4 w-4 text-blue-500" />
                      {t('demand.tabs.businessCase.top3MarketsBySize')}
                    </h4>
                    <div className="grid gap-3">
                      {marketResearch.globalMarket?.topCountries?.slice(0, 3).map((country: MarketCountry, index: number) => (
                        <div key={index} className="rounded-lg border bg-gradient-to-r from-blue-500/5 to-transparent p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-blue-600">#{country.rank}</span>
                              <span className="text-base font-semibold">{country.country}</span>
                            </div>
                            <Badge
                              className={
                                country.adoptionMaturity === 'Leading' ? 'bg-emerald-500 text-white' :
                                country.adoptionMaturity === 'Mature' ? 'bg-blue-500 text-white' :
                                country.adoptionMaturity === 'Growing' ? 'bg-amber-500 text-white' :
                                'bg-slate-500 text-white'
                              }
                            >
                              {country.adoptionMaturity}
                            </Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-4">
                            <div className="rounded bg-blue-500/10 p-2">
                              <p className="text-xs text-muted-foreground">{t('demand.tabs.businessCase.marketSize')}</p>
                              <p className="font-bold text-blue-600">{country.marketSize}</p>
                            </div>
                            <div className="rounded border border-emerald-500/20 bg-emerald-500/10 p-2">
                              <p className="text-xs text-muted-foreground">{t('demand.tabs.businessCase.growthRate')}</p>
                              <p className="font-bold text-emerald-600">{country.growthRate}</p>
                            </div>
                          </div>
                          {(country.keyDrivers?.length ?? 0) > 0 && (
                            <div className="mt-3">
                              <p className="mb-1 text-xs text-muted-foreground">{t('demand.tabs.businessCase.keyDrivers')}</p>
                              <div className="flex flex-wrap gap-1">
                                {country.keyDrivers?.slice(0, 3).map((driver: string, driverIndex: number) => (
                                  <Badge key={driverIndex} variant="outline" className="text-xs">{driver}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {country.regulatoryEnvironment && (
                            <p className="mt-2 text-xs italic text-muted-foreground">{country.regulatoryEnvironment}</p>
                          )}
                          {(country.majorLocalPlayers?.length ?? 0) > 0 && (
                            <div className="mt-2 flex flex-wrap items-center gap-1">
                              <span className="text-xs text-muted-foreground">{t('demand.tabs.businessCase.localLeaders')}:</span>
                              {country.majorLocalPlayers?.slice(0, 3).map((player: string, playerIndex: number) => (
                                <Badge key={playerIndex} className="bg-blue-500/10 text-[10px] text-blue-700 dark:text-blue-300">{player}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Building2 className="h-4 w-4 text-violet-500" />
                    {t('demand.tabs.businessCase.majorGlobalPlayers')}
                  </h4>
                  <div className="grid gap-3">
                    {marketResearch.globalMarket?.majorPlayers?.map((player: MarketPlayer, index: number) => (
                      <div key={index} className="rounded-lg border bg-card p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-base font-semibold">{player.name}</span>
                          <div className="flex items-center gap-2">
                            {player.marketShare && <Badge className="bg-violet-500 text-white">{player.marketShare}</Badge>}
                            {player.annualRevenue && <Badge variant="outline" className="border-emerald-500/50 text-emerald-600">{player.annualRevenue}</Badge>}
                          </div>
                        </div>
                        <p className="mb-2 text-xs text-muted-foreground">{player.headquarters}</p>
                        <p className="mb-3 text-sm text-muted-foreground">{player.relevance}</p>

                        {(player.flagshipSolutions?.length ?? 0) > 0 && (
                          <div className="mb-2">
                            <p className="mb-1 text-xs text-muted-foreground">{t('demand.tabs.businessCase.flagshipSolutions')}</p>
                            <div className="flex flex-wrap gap-1">
                              {player.flagshipSolutions?.map((solution: string, solutionIndex: number) => (
                                <Badge key={solutionIndex} className="bg-violet-500/10 text-[10px] text-violet-700 dark:text-violet-300">{solution}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {(player.regionalStrength?.length ?? 0) > 0 && (
                          <div className="mb-2">
                            <p className="mb-1 text-xs text-muted-foreground">{t('demand.tabs.businessCase.regionalStrength')}</p>
                            <div className="flex flex-wrap gap-1">
                              {player.regionalStrength?.map((region: string, regionIndex: number) => (
                                <Badge key={regionIndex} variant="outline" className="text-[10px]">{region}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {(player.keyClients?.length ?? 0) > 0 && (
                          <div>
                            <p className="mb-1 text-xs text-muted-foreground">{t('demand.tabs.businessCase.notableClients')}</p>
                            <div className="flex flex-wrap gap-1">
                              {player.keyClients?.slice(0, 4).map((client: string, clientIndex: number) => (
                                <Badge key={clientIndex} className="bg-blue-500/10 text-[10px] text-blue-700 dark:text-blue-300">{client}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/30">
              <CardHeader className="rounded-t-lg bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-emerald-500" />
                  {t('demand.tabs.businessCase.uaeMarketAnalysis')}
                  <Badge className="ml-auto bg-emerald-500 text-white">{marketResearch.uaeMarket?.growthRate || 'N/A'}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('demand.tabs.businessCase.uaeMarketSize')}</p>
                    <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">{marketResearch.uaeMarket?.marketSize || 'N/A'}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('demand.tabs.businessCase.growthRate')}</p>
                    <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">{marketResearch.uaeMarket?.growthRate || 'N/A'}</p>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    {t('demand.tabs.businessCase.alignedGovernmentInitiatives')}
                  </h4>
                  <div className="grid gap-2">
                    {marketResearch.uaeMarket?.governmentInitiatives?.map((initiative: string, index: number) => (
                      <div key={index} className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">
                        <Target className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{initiative}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {(marketResearch.uaeMarket?.regulatoryConsiderations?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      {t('demand.tabs.businessCase.regulatoryConsiderations')}
                    </h4>
                    <div className="space-y-2">
                      {marketResearch.uaeMarket?.regulatoryConsiderations?.map((consideration: string, index: number) => (
                        <div key={index} className="rounded border border-amber-500/20 bg-amber-500/5 p-2 text-sm">{consideration}</div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="mb-3 text-sm font-semibold">{t('demand.tabs.businessCase.localPlayersIntegrators')}</h4>
                  <div className="grid gap-3">
                    {marketResearch.uaeMarket?.localPlayers?.map((player: LocalPlayer, index: number) => (
                      <div key={index} className="rounded-lg border bg-card p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-semibold">{player.name}</span>
                          <Badge variant="outline" className="border-emerald-500/50 text-emerald-600">{player.sector}</Badge>
                        </div>
                        <p className="mb-2 text-sm text-muted-foreground">{player.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {player.capabilities?.map((capability: string, capabilityIndex: number) => (
                            <Badge key={capabilityIndex} className="bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300">{capability}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/30">
              <CardHeader className="rounded-t-lg bg-gradient-to-r from-amber-500/10 to-amber-600/5 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5 text-amber-500" />
                  {t('demand.tabs.businessCase.suppliersSolutionProviders')}
                  <Badge className="ml-auto bg-amber-500 text-white">{marketResearch.suppliers?.length || 0} {t('demand.tabs.businessCase.identified')}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid gap-3">
                  {marketResearch.suppliers?.map((supplier: Supplier, index: number) => (
                    <div key={index} className="rounded-lg border bg-card p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-semibold">{supplier.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{supplier.category}</Badge>
                          {supplier.uaePresence && <Badge className="bg-emerald-500 text-[10px] text-white">UAE Office</Badge>}
                        </div>
                      </div>
                      {supplier.strengths && <p className="mb-2 text-sm text-muted-foreground">{supplier.strengths}</p>}
                      <div className="flex flex-wrap gap-1">
                        {supplier.services?.map((service: string, serviceIndex: number) => (
                          <Badge key={serviceIndex} className="bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300">{service}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-violet-500/30">
              <CardHeader className="rounded-t-lg bg-gradient-to-r from-violet-500/10 to-violet-600/5 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lightbulb className="h-5 w-5 text-violet-500" />
                  {t('demand.tabs.businessCase.implementationUseCases')}
                  <Badge className="ml-auto bg-violet-500 text-white">{marketResearch.useCases?.length || 0} {t('demand.tabs.businessCase.opportunities')}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {marketResearch.useCases?.map((useCase: UseCase, index: number) => (
                    <div key={index} className="space-y-3 rounded-lg border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-base font-semibold">{useCase.title}</h4>
                        <Badge
                          className={
                            useCase.implementationComplexity === 'Low' ? 'bg-emerald-500 text-white' :
                            useCase.implementationComplexity === 'Medium' ? 'bg-amber-500 text-white' :
                            'bg-red-500 text-white'
                          }
                        >
                          {useCase.implementationComplexity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{useCase.description}</p>

                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{useCase.estimatedROI}</span>
                        </div>
                        {useCase.timeframe && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                            <span className="text-muted-foreground">{useCase.timeframe}</span>
                          </div>
                        )}
                      </div>

                      {(useCase.benefits?.length ?? 0) > 0 && (
                        <div className="border-t pt-2">
                          <p className="mb-1 text-xs text-muted-foreground">{t('demand.tabs.businessCase.keyBenefits')}:</p>
                          <div className="flex flex-wrap gap-1">
                            {useCase.benefits?.map((benefit: string, benefitIndex: number) => (
                              <Badge key={benefitIndex} variant="outline" className="text-[10px]">{benefit}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {marketResearch.competitiveAnalysis && (
              <Card className="border-cyan-500/30">
                <CardHeader className="rounded-t-lg bg-gradient-to-r from-cyan-500/10 to-cyan-600/5 pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5 text-cyan-500" />
                    {t('demand.tabs.businessCase.competitiveAnalysis')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {(marketResearch.competitiveAnalysis?.marketGaps?.length ?? 0) > 0 && (
                    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                      <h4 className="mb-2 text-sm font-semibold text-cyan-600 dark:text-cyan-400">{t('demand.tabs.businessCase.marketGapsOpportunities')}</h4>
                      <div className="space-y-2">
                        {marketResearch.competitiveAnalysis?.marketGaps?.map((gap: string, index: number) => (
                          <div key={index} className="flex items-start gap-2 text-sm">
                            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" />
                            <span>{gap}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {Array.isArray(marketResearch.riskFactors) && marketResearch.riskFactors.length > 0 && (
              <Card className="border-red-500/30">
                <CardHeader className="rounded-t-lg bg-gradient-to-r from-red-500/10 to-red-600/5 pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    {t('demand.tabs.businessCase.riskFactors')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    {(marketResearch.riskFactors as string[]).map((risk: string, index: number) => (
                      <div key={index} className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                        <span>{risk}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-2 border-primary/40">
              <CardHeader className="rounded-t-lg bg-gradient-to-r from-primary/10 to-primary/5 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {t('demand.tabs.businessCase.coreviaStrategicRecommendations')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {marketResearch.recommendations?.map((recommendation: string, index: number) => (
                    <div key={index} className="flex items-start gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                        {index + 1}
                      </div>
                      <p className="pt-1 text-sm">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="border-t pt-4 text-center text-xs text-muted-foreground">
              <p>{t('demand.tabs.businessCase.marketReportGenerated')}</p>
              <p className="mt-1">{t('demand.tabs.businessCase.basedOnObjectives')}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20">
              <Globe className="h-10 w-10 text-violet-500" />
            </div>
            <h3 className="text-xl font-semibold text-muted-foreground">{t('demand.tabs.businessCase.noMarketResearch')}</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {t('demand.tabs.businessCase.clickMarketResearch')}
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}