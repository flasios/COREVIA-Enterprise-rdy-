import { useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  FileCheck,
  ShieldCheck,
  Scale,
  Target,
} from "lucide-react";
import type { ComplianceRule } from "@shared/complianceTypes";

type RulesResponse = {
  success: boolean;
  data: ComplianceRule[];
};

const categoryLabels: Record<string, string> = {
  financial: "Financial",
  strategic: "Strategic",
  security: "Security",
  technical: "Technical",
  legal: "Legal",
};

const severityOrder = ["critical", "high", "medium", "low"] as const;

export default function ComplianceTracking() {
  const { t } = useTranslation();
  const { data: rulesData } = useQuery<RulesResponse>({
    queryKey: ["/api/compliance/rules"],
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rules = rulesData?.data || [];

  const {
    totalRules,
    publishedRules,
    draftRules,
    archivedRules,
    criticalRules,
    highRules,
    expiringSoon,
    categoryCounts,
    latestRules,
  } = useMemo(() => {
    const now = new Date();
    const soonCutoff = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);

    const total = rules.length;
    const published = rules.filter((rule) => rule.status === "published").length;
    const draft = rules.filter((rule) => rule.status === "draft").length;
    const archived = rules.filter((rule) => rule.status === "archived").length;
    const critical = rules.filter((rule) => rule.severity === "critical").length;
    const high = rules.filter((rule) => rule.severity === "high").length;
    const expiring = rules.filter((rule) => {
      if (!rule.expiryDate) return false;
      const expiry = new Date(rule.expiryDate);
      return expiry <= soonCutoff;
    }).length;

    const categories = rules.reduce<Record<string, number>>((acc, rule) => {
      const key = rule.category || "other";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const latest = [...rules]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
      .slice(0, 6);

    return {
      totalRules: total,
      publishedRules: published,
      draftRules: draft,
      archivedRules: archived,
      criticalRules: critical,
      highRules: high,
      expiringSoon: expiring,
      categoryCounts: categories,
      latestRules: latest,
    };
  }, [rules]);

  const categoryEntries = Object.entries(categoryCounts).filter(([, count]) => count > 0);
  const maxCategory = Math.max(...categoryEntries.map((entry) => entry[1]), 1);

  const severityCounts = severityOrder.reduce<Record<string, number>>((acc, level) => {
    acc[level] = rules.filter((rule) => rule.severity === level).length;
    return acc;
  }, {});
  const severityTotal = Math.max(Object.values(severityCounts).reduce((sum, value) => sum + value, 0), 1);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/pmo-office">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t('compliance.pmoOffice')}
              </Button>
            </Link>
            <div>
              <div className="text-sm font-semibold">{t('compliance.trackingCommand')}</div>
              <div className="text-xs text-muted-foreground">{t('compliance.trackingCommandDesc')}</div>
            </div>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
            <ShieldCheck className="h-3 w-3 mr-1" />
            {publishedRules} {t('compliance.activeControls')}
          </Badge>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        <div className="grid gap-4 lg:grid-cols-4">
          {[
            { title: t('compliance.totalRules'), value: totalRules, icon: Scale },
            { title: t('compliance.published'), value: publishedRules, icon: CheckCircle2 },
            { title: t('compliance.critical'), value: criticalRules, icon: AlertTriangle },
            { title: t('compliance.expiring30d'), value: expiringSoon, icon: Calendar },
          ].map((card) => (
            <Card key={card.title} className="border-emerald-200/40 bg-white/80">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{card.title}</span>
                  <card.icon className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-semibold text-slate-900">{card.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-emerald-200/40 bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                {t('compliance.complianceCoverage')}
              </CardTitle>
              <CardDescription>{t('compliance.complianceCoverageDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('compliance.categoryCoverage')}</span>
                  <span>{categoryEntries.length} {t('compliance.categories')}</span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {categoryEntries.length === 0 ? (
                    <div className="text-sm text-muted-foreground">{t('compliance.noRulesPublished')}</div>
                  ) : (
                    categoryEntries.map(([category, count]) => (
                      <div key={category} className="rounded-lg border border-emerald-100 bg-white/70 p-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{categoryLabels[category] || category}</span>
                          <span>{count}</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-emerald-100 overflow-hidden">
                          <div className="h-2 bg-emerald-500" style={{ width: `${Math.round((count / maxCategory) * 100)}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('compliance.severityMix')}</span>
                  <span>{severityTotal} total</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-emerald-100 overflow-hidden flex">
                  <div className="h-2 bg-rose-500" style={{ width: `${Math.round(((severityCounts.critical ?? 0) / severityTotal) * 100)}%` }} />
                  <div className="h-2 bg-amber-500" style={{ width: `${Math.round(((severityCounts.high ?? 0) / severityTotal) * 100)}%` }} />
                  <div className="h-2 bg-emerald-500" style={{ width: `${Math.round(((severityCounts.medium ?? 0) / severityTotal) * 100)}%` }} />
                  <div className="h-2 bg-slate-400" style={{ width: `${Math.round(((severityCounts.low ?? 0) / severityTotal) * 100)}%` }} />
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-500" />Critical {severityCounts.critical}</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />High {severityCounts.high}</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />Medium {severityCounts.medium}</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-400" />Low {severityCounts.low}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200/40 bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-600" />
                {t('compliance.controlReadiness')}
              </CardTitle>
              <CardDescription>{t('compliance.controlReadinessDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-emerald-100 bg-white/70 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('compliance.ruleLifecycle')}</span>
                  <span>{totalRules} {t('compliance.rules')}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-emerald-100 overflow-hidden flex">
                  <div className="h-2 bg-emerald-500" style={{ width: `${Math.round((publishedRules / Math.max(totalRules, 1)) * 100)}%` }} />
                  <div className="h-2 bg-amber-500" style={{ width: `${Math.round((draftRules / Math.max(totalRules, 1)) * 100)}%` }} />
                  <div className="h-2 bg-slate-400" style={{ width: `${Math.round((archivedRules / Math.max(totalRules, 1)) * 100)}%` }} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />Published {publishedRules}</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />Draft {draftRules}</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-400" />Archived {archivedRules}</div>
                </div>
              </div>

              <div className="rounded-lg border border-emerald-100 bg-white/70 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('compliance.highImpactControls')}</span>
                  <span>{highRules} {t('compliance.high')}</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>{highRules + criticalRules} {t('compliance.criticalHighRulesActive')}</span>
                </div>
              </div>

              <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-muted-foreground">
                {t('compliance.reviewExpiringControls')}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-emerald-200/40 bg-white/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-emerald-600" />
                {t('compliance.complianceRuleCatalog')}
              </CardTitle>
              <CardDescription>{t('compliance.complianceRuleCatalogDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {latestRules.length === 0 ? (
              <div className="py-6 text-sm text-muted-foreground">{t('compliance.noRulesPublished')}</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {latestRules.map((rule) => (
                  <div key={rule.id} className="rounded-xl border border-emerald-100 bg-white/80 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {categoryLabels[rule.category] || rule.category}
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        {rule.severity}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900 line-clamp-1">{rule.name}</div>
                    <div className="mt-2 text-xs text-muted-foreground line-clamp-2">{rule.description}</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full border border-emerald-100 bg-emerald-50/70 px-2 py-0.5">
                        {rule.status}
                      </span>
                      {rule.effectiveDate && (
                        <span className="rounded-full border border-emerald-100 bg-emerald-50/70 px-2 py-0.5">
                          Effective {new Date(rule.effectiveDate).toLocaleDateString()}
                        </span>
                      )}
                      {rule.expiryDate && (
                        <span className="rounded-full border border-emerald-100 bg-emerald-50/70 px-2 py-0.5">
                          Expires {new Date(rule.expiryDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
