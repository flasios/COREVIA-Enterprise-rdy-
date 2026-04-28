import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import HexagonLogoFrame from '@/components/shared/misc/HexagonLogoFrame';
import type { MarketResearch } from '@/modules/demand/components/business-case';
import { AlertCircle, AlertTriangle, CheckCircle, Clock, Globe, Lightbulb, ShieldCheck, Sparkles, Target, Users } from 'lucide-react';

interface DetailedRequirementsMarketResearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketResearch: MarketResearch | null;
}

export function DetailedRequirementsMarketResearchSheet({
  open,
  onOpenChange,
  marketResearch,
}: DetailedRequirementsMarketResearchSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Requirements Market Research</SheetTitle>
          <SheetDescription>
            Market, vendor, and benchmark insight aligned to the requirements scope.
          </SheetDescription>
        </SheetHeader>
        <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 border-b border-cyan-500/30">
          <div className="flex items-center gap-4">
            <HexagonLogoFrame px={28} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">COREVIA</h1>
                <Badge className="bg-sky-500/30 text-sky-100 border-sky-400/50">Requirements Research</Badge>
              </div>
              <p className="text-sky-100/80 text-sm mt-0.5">Market, vendor, and benchmark insight aligned to the requirements scope.</p>
            </div>
            {marketResearch?.generatedAt && (
              <div className="text-right text-xs text-sky-200/70">
                <p>Generated</p>
                <p className="font-medium">{new Date(marketResearch.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            )}
          </div>
        </div>

        {marketResearch ? (
          <div className="p-6 space-y-6">
            {marketResearch.projectContext && (
              <Card className="border-2 border-sky-500/40 bg-gradient-to-br from-sky-500/5 via-cyan-500/5 to-blue-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5 text-sky-500" />
                    Research focus
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg bg-sky-500/10 border border-sky-500/30">
                    <p className="font-semibold text-lg text-sky-700 dark:text-sky-300">{marketResearch.projectContext.focusArea}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-medium text-sm mb-2 text-muted-foreground">Key objectives</h4>
                      <div className="space-y-1">
                        {marketResearch.projectContext.keyObjectives?.map((objective: string, index: number) => (
                          <div key={index} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            <span>{objective}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm mb-2 text-muted-foreground">Target capabilities</h4>
                      <div className="flex flex-wrap gap-2">
                        {marketResearch.projectContext.targetCapabilities?.map((capability: string, index: number) => (
                          <Badge key={index} variant="outline" className="border-sky-500/50 text-sky-600 dark:text-sky-400">{capability}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-blue-500/30">
                <CardHeader className="pb-3 bg-gradient-to-r from-blue-500/10 to-blue-600/5 rounded-t-lg">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-500" />
                    Global market
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Market size</p>
                      <p className="font-bold text-lg text-blue-600 dark:text-blue-400 mt-1">{marketResearch.globalMarket?.marketSize || 'N/A'}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Growth rate</p>
                      <p className="font-bold text-lg text-blue-600 dark:text-blue-400 mt-1">{marketResearch.globalMarket?.growthRate || 'N/A'}</p>
                    </div>
                  </div>
                  {(marketResearch.globalMarket?.keyTrends?.length ?? 0) > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-3">Key trends</h4>
                      <div className="grid gap-2">
                        {marketResearch.globalMarket?.keyTrends?.map((trend: string, index: number) => (
                          <div key={index} className="flex items-start gap-3 text-sm p-3 rounded-lg bg-muted/30 border border-border/50">
                            <div className="h-5 w-5 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0">{index + 1}</div>
                            <span>{trend}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-emerald-500/30">
                <CardHeader className="pb-3 bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 rounded-t-lg">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    UAE market
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Market size</p>
                      <p className="font-bold text-lg text-emerald-600 dark:text-emerald-400 mt-1">{marketResearch.uaeMarket?.marketSize || 'N/A'}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Growth rate</p>
                      <p className="font-bold text-lg text-emerald-600 dark:text-emerald-400 mt-1">{marketResearch.uaeMarket?.growthRate || 'N/A'}</p>
                    </div>
                  </div>
                  {(marketResearch.uaeMarket?.governmentInitiatives?.length ?? 0) > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-3">Government initiatives</h4>
                      <div className="grid gap-2">
                        {marketResearch.uaeMarket?.governmentInitiatives?.map((initiative: string, index: number) => (
                          <div key={index} className="flex items-start gap-3 text-sm p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                            <Target className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            <span>{initiative}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-amber-500/30">
                <CardHeader className="pb-3 bg-gradient-to-r from-amber-500/10 to-amber-600/5 rounded-t-lg">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-amber-500" />
                    Suppliers
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {marketResearch.suppliers?.length ? marketResearch.suppliers.map((supplier, index) => (
                    <div key={index} className="p-4 rounded-lg border bg-card">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{supplier.name}</span>
                        <Badge variant="outline">{supplier.category}</Badge>
                      </div>
                      {supplier.strengths && <p className="text-sm text-muted-foreground mb-2">{supplier.strengths}</p>}
                      <div className="flex flex-wrap gap-1">
                        {supplier.services?.map((service, serviceIndex) => (
                          <Badge key={serviceIndex} className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300">{service}</Badge>
                        ))}
                      </div>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No suppliers identified yet.</p>}
                </CardContent>
              </Card>

              <Card className="border-violet-500/30">
                <CardHeader className="pb-3 bg-gradient-to-r from-violet-500/10 to-violet-600/5 rounded-t-lg">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-violet-500" />
                    Use cases
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {marketResearch.useCases?.length ? marketResearch.useCases.map((useCase, index) => (
                    <div key={index} className="p-4 rounded-lg border bg-card space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-semibold text-base">{useCase.title}</h4>
                        <Badge className={useCase.implementationComplexity === 'Low' ? 'bg-emerald-500 text-white' : useCase.implementationComplexity === 'Medium' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'}>
                          {useCase.implementationComplexity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{useCase.description}</p>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-emerald-500" />
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{useCase.estimatedROI}</span>
                        </div>
                        {useCase.timeframe && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                            <span className="text-muted-foreground">{useCase.timeframe}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No use cases identified yet.</p>}
                </CardContent>
              </Card>
            </div>

            {Array.isArray(marketResearch.riskFactors) && marketResearch.riskFactors.length > 0 && (
              <Card className="border-red-500/30">
                <CardHeader className="pb-3 bg-gradient-to-r from-red-500/10 to-red-600/5 rounded-t-lg">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Market risks
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    {marketResearch.riskFactors.map((risk: string, index: number) => (
                      <div key={index} className="flex items-start gap-3 text-sm p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        <span>{risk}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-2 border-primary/40">
              <CardHeader className="pb-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {marketResearch.recommendations?.map((recommendation: string, index: number) => (
                    <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
                        {index + 1}
                      </div>
                      <p className="text-sm pt-1">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-sky-500/20 to-cyan-500/20 flex items-center justify-center mb-6">
              <Globe className="h-10 w-10 text-sky-500" />
            </div>
            <h3 className="text-xl font-semibold text-muted-foreground">No requirements market research</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">Generate research from the Requirements intelligence panel to review vendors, trends, and benchmarks.</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}