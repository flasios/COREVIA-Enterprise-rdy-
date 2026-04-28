import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Eye,
  Bell,
  FileWarning as _FileWarning,
  Calendar,
  RefreshCw,
  Loader2,
  ChevronRight,
  AlertCircle,
  Info,
  Zap,
  Target as _Target,
  BarChart3,
  FileText
} from "lucide-react";

interface PolicyAlert {
  id: string;
  type: "warning" | "critical" | "info";
  title: string;
  description: string;
  documentName: string;
  documentId: string;
  detectedAt: Date;
  dueDate?: Date;
  status: "new" | "acknowledged" | "resolved";
  riskScore: number;
}

interface ComplianceMetric {
  category: string;
  compliant: number;
  total: number;
  trend: "up" | "down" | "stable";
}

const getAlertIcon = (type: string) => {
  switch (type) {
    case "critical": return <AlertCircle className="h-5 w-5 text-red-500" />;
    case "warning": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case "info": return <Info className="h-5 w-5 text-blue-500" />;
    default: return <Info className="h-5 w-5" />;
  }
};

const getAlertBadgeVariant = (type: string) => {
  switch (type) {
    case "critical": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "warning": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "info": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    default: return "";
  }
};

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case "up": return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    case "down": return <TrendingDown className="h-4 w-4 text-red-500" />;
    default: return <span className="h-4 w-4 text-muted-foreground">—</span>;
  }
};

export function PolicyWatchtower() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);
  const [alerts, setAlerts] = useState<PolicyAlert[]>([]);
  const [metrics, setMetrics] = useState<ComplianceMetric[]>([]);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: documents, isLoading: _isLoading } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['/api/knowledge/documents'],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateAlertsFromDocuments = useCallback((docs: any[]): PolicyAlert[] => {
    const generatedAlerts: PolicyAlert[] = [];
    const policyDocs = docs.filter(d => 
      d.category?.toLowerCase().includes('policy') || 
      d.folderPath?.includes('policies') ||
      d.filename?.toLowerCase().includes('policy')
    );
    
    policyDocs.forEach((doc, _idx) => {
      const uploadDate = new Date(doc.uploadedAt);
      const daysSinceUpload = Math.floor((Date.now() - uploadDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceUpload > 365) {
        generatedAlerts.push({
          id: `alert-${doc.id}`,
          type: "critical",
          title: "Policy Review Required",
          description: `${doc.filename} ${t('knowledge.policyWatchtower.uploadedDaysAgo', { days: daysSinceUpload })}`,
          documentName: doc.filename,
          documentId: doc.id,
          detectedAt: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: "new",
          riskScore: Math.min(90, 50 + Math.floor(daysSinceUpload / 30))
        });
      } else if (daysSinceUpload > 180) {
        generatedAlerts.push({
          id: `alert-${doc.id}`,
          type: "warning",
          title: "Upcoming Review",
          description: `${doc.filename} ${t('knowledge.policyWatchtower.daysOld', { days: daysSinceUpload })}`,
          documentName: doc.filename,
          documentId: doc.id,
          detectedAt: new Date(),
          status: "new",
          riskScore: 40 + Math.floor(daysSinceUpload / 10)
        });
      }
    });
    
    const duplicates = docs.filter((doc, idx) => 
      docs.some((other, otherIdx) => 
        idx < otherIdx && 
        doc.filename?.toLowerCase().split(/[\s_-]+/).some((word: string) => 
          word.length > 4 && other.filename?.toLowerCase().includes(word)
        )
      )
    );
    
    if (duplicates.length > 0) {
      generatedAlerts.push({
        id: `alert-duplicates`,
        type: "info",
        title: "Potential Duplicate Documents",
        description: t('knowledge.policyWatchtower.duplicatesFound', { count: duplicates.length }),
        documentName: duplicates.map(d => d.filename).slice(0, 2).join(', '),
        documentId: duplicates[0]?.id || '',
        detectedAt: new Date(),
        status: "new",
        riskScore: 30
      });
    }
    
    return generatedAlerts.slice(0, 10);
  }, [t]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateMetricsFromDocuments = (docs: any[]): ComplianceMetric[] => {
    const categories = ['IT', 'HR', 'Operational', 'Strategic', 'Regulatory'];
    return categories.map(cat => {
      const catDocs = docs.filter(d => 
        d.category?.toLowerCase().includes(cat.toLowerCase()) ||
        d.folderPath?.toLowerCase().includes(cat.toLowerCase())
      );
      const recentDocs = catDocs.filter(d => {
        const uploadDate = new Date(d.uploadedAt);
        return (Date.now() - uploadDate.getTime()) < 365 * 24 * 60 * 60 * 1000;
      });
      return {
        category: `${cat} Policies`,
        compliant: recentDocs.length,
        total: Math.max(catDocs.length, 1),
        trend: recentDocs.length > catDocs.length * 0.7 ? "up" as const : 
               recentDocs.length < catDocs.length * 0.5 ? "down" as const : "stable" as const
      };
    }).filter(m => m.total > 0);
  };

  useEffect(() => {
    if (documents?.data) {
      setAlerts(generateAlertsFromDocuments(documents.data));
      setMetrics(generateMetricsFromDocuments(documents.data));
    }
  }, [documents, generateAlertsFromDocuments]);

  const runComplianceScan = async () => {
    setIsScanning(true);
    
    if (documents?.data) {
      const newAlerts = generateAlertsFromDocuments(documents.data);
      setAlerts(newAlerts);
      
      toast({
        title: t('knowledge.policyWatchtower.scanComplete'),
        description: t('knowledge.policyWatchtower.scanCompleteDesc', { docCount: documents.data.length, alertCount: newAlerts.length }),
      });
    }
    
    setIsScanning(false);
  };

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, status: "acknowledged" as const } : a
    ));
    toast({
      title: t('knowledge.policyWatchtower.alertAcknowledged'),
      description: t('knowledge.policyWatchtower.alertAcknowledgedDesc'),
    });
  };

  const resolveAlert = (alertId: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, status: "resolved" as const } : a
    ));
    toast({
      title: t('knowledge.policyWatchtower.alertResolved'),
      description: t('knowledge.policyWatchtower.alertResolvedDesc'),
    });
  };

  const overallCompliance = Math.round(
    (metrics.reduce((acc, m) => acc + m.compliant, 0) / 
     metrics.reduce((acc, m) => acc + m.total, 0)) * 100
  );

  const criticalCount = alerts.filter(a => a.type === "critical" && a.status !== "resolved").length;
  const warningCount = alerts.filter(a => a.type === "warning" && a.status !== "resolved").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            {t('knowledge.policyWatchtower.title')}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t('knowledge.policyWatchtower.subtitle')}
          </p>
        </div>
        <Button 
          onClick={runComplianceScan}
          disabled={isScanning}
          data-testid="button-run-scan"
        >
          {isScanning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('knowledge.policyWatchtower.scanning')}
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('knowledge.policyWatchtower.runScan')}
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                  {t('knowledge.policyWatchtower.overallCompliance')}
                </p>
                <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                  {overallCompliance}%
                </p>
              </div>
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <Progress value={overallCompliance} className="mt-3 bg-emerald-200 dark:bg-emerald-800" />
          </CardContent>
        </Card>

        <Card className={criticalCount > 0 
          ? "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-200 dark:border-red-800"
          : ""
        }>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">{t('knowledge.policyWatchtower.criticalAlerts')}</p>
                <p className={`text-3xl font-bold ${criticalCount > 0 ? 'text-red-600' : ''}`}>
                  {criticalCount}
                </p>
              </div>
              <AlertCircle className={`h-10 w-10 ${criticalCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>

        <Card className={warningCount > 0
          ? "bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-amber-200 dark:border-amber-800"
          : ""
        }>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">{t('knowledge.policyWatchtower.warnings')}</p>
                <p className={`text-3xl font-bold ${warningCount > 0 ? 'text-amber-600' : ''}`}>
                  {warningCount}
                </p>
              </div>
              <AlertTriangle className={`h-10 w-10 ${warningCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">{t('knowledge.policyWatchtower.documentsMonitored')}</p>
                <p className="text-3xl font-bold">45</p>
              </div>
              <Eye className="h-10 w-10 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {t('knowledge.policyWatchtower.activeAlerts')}
              </CardTitle>
              <CardDescription>
                {t('knowledge.policyWatchtower.activeAlertsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {alerts
                    .filter(a => a.status !== "resolved")
                    .sort((a, b) => {
                      const priority = { critical: 0, warning: 1, info: 2 };
                      return priority[a.type] - priority[b.type];
                    })
                    .map((alert) => (
                    <div 
                      key={alert.id}
                      className={`p-4 rounded-lg border ${
                        alert.type === "critical" 
                          ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10'
                          : alert.type === "warning"
                          ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10'
                          : 'border-border bg-muted/30'
                      }`}
                      data-testid={`alert-${alert.id}`}
                    >
                      <div className="flex items-start gap-3">
                        {getAlertIcon(alert.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold">{alert.title}</h4>
                            <Badge variant="secondary" className={getAlertBadgeVariant(alert.type)}>
                              {alert.type}
                            </Badge>
                            {alert.status === "acknowledged" && (
                              <Badge variant="outline">{t('knowledge.policyWatchtower.acknowledged')}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {alert.description}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {alert.documentName}
                            </span>
                            {alert.dueDate && (
                              <span className="flex items-center gap-1 text-red-600">
                                <Calendar className="h-3 w-3" />
                                {t('knowledge.policyWatchtower.due')}: {alert.dueDate.toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            {alert.status === "new" && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => acknowledgeAlert(alert.id)}
                                data-testid={`button-acknowledge-${alert.id}`}
                              >
                                Acknowledge
                              </Button>
                            )}
                            <Button 
                              size="sm"
                              onClick={() => resolveAlert(alert.id)}
                              data-testid={`button-resolve-${alert.id}`}
                            >
                              {t('knowledge.policyWatchtower.markResolved')}
                            </Button>
                            <Button size="sm" variant="ghost">
                              {t('knowledge.policyWatchtower.viewDocument')}
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold" style={{
                            color: alert.riskScore > 70 ? '#ef4444' : alert.riskScore > 50 ? '#f59e0b' : '#6b7280'
                          }}>
                            {alert.riskScore}
                          </div>
                          <div className="text-xs text-muted-foreground">{t('knowledge.policyWatchtower.riskScore')}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {alerts.filter(a => a.status !== "resolved").length === 0 && (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                      <h4 className="font-medium">{t('knowledge.policyWatchtower.allClear')}</h4>
                      <p className="text-sm text-muted-foreground">
                        {t('knowledge.policyWatchtower.allClearDesc')}
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {t('knowledge.policyWatchtower.complianceByCategory')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.map((metric) => (
                  <div key={metric.category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{metric.category}</span>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(metric.trend)}
                        <span className="text-sm text-muted-foreground">
                          {metric.compliant}/{metric.total}
                        </span>
                      </div>
                    </div>
                    <Progress 
                      value={(metric.compliant / metric.total) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {t('knowledge.policyWatchtower.upcomingReviews')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div>
                    <p className="text-sm font-medium">{t('knowledge.policyWatchtower.itProcurementPolicy')}</p>
                    <p className="text-xs text-muted-foreground">{t('knowledge.policyWatchtower.reviewDue15')}</p>
                  </div>
                  <Badge variant="destructive">{t('knowledge.policyWatchtower.urgent')}</Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div>
                    <p className="text-sm font-medium">{t('knowledge.policyWatchtower.digitalMaturityPolicy')}</p>
                    <p className="text-xs text-muted-foreground">{t('knowledge.policyWatchtower.reviewDue45')}</p>
                  </div>
                  <Badge variant="secondary">{t('knowledge.policyWatchtower.upcoming')}</Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div>
                    <p className="text-sm font-medium">{t('knowledge.policyWatchtower.cityApiPolicy')}</p>
                    <p className="text-xs text-muted-foreground">{t('knowledge.policyWatchtower.reviewDue90')}</p>
                  </div>
                  <Badge variant="outline">{t('knowledge.policyWatchtower.scheduled')}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/5 to-blue-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Zap className="h-8 w-8 text-primary" />
                <div>
                  <h4 className="font-semibold">{t('knowledge.policyWatchtower.aiInsight')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('knowledge.policyWatchtower.aiInsightDesc')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
