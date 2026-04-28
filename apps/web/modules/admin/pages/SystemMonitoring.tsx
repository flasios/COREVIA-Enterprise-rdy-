import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Clock,
  Database,
  Globe,
  Server,
  Shield,
  Users,
  Zap,
  Bell,
  FileText,
  BarChart3,
  Wifi,
  WifiOff,
  Monitor,
  TrendingUp
} from "lucide-react";
import { useSystemMonitoring } from "@/modules/admin/hooks/useSystemMonitoring";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";

export default function SystemMonitoring() {
  const {
    notifications,
    systemHealth,
    workflowMetrics,
    acknowledgeNotification,
    getStatusColor,
    getStatusIcon,
    getNotificationIcon,
    getNotificationColor,
    getTrendIcon
  } = useSystemMonitoring();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background constellation-grid relative overflow-hidden" data-testid="page-system-monitoring">
      <div className="container mx-auto p-6 relative z-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
              <Monitor className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('admin.systemMonitoring')}</h1>
              <p className="text-muted-foreground">{t('admin.systemMonitoringDesc')}</p>
            </div>
          </div>
        </div>

        {/* Mission Control - System Health Overview */}
        <Card className="w-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                <Activity className="h-4 w-4" />
              </div>
              {t('admin.missionControl')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {systemHealth.map((service, index) => (
                <div key={index} className="p-4 rounded-lg border bg-card/50 space-y-3" data-testid={`service-health-${index}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const iconData = getStatusIcon(service.status);
                        const Icon = iconData.component;
                        return <Icon className={iconData.className} />;
                      })()}
                      <span className="font-medium text-sm">{service.service}</span>
                    </div>
                    <Badge className={getStatusColor(service.status)}>
                      {service.status}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>{t('admin.uptime')}</span>
                      <span className="font-medium">{service.uptime}%</span>
                    </div>
                    <Progress value={service.uptime} className="h-1" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t('admin.latency')}</span>
                      <span>{service.latency}ms</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Infrastructure Monitoring */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-5 w-5 text-blue-500" />
                {t('admin.infrastructure')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">{t('admin.database')}</span>
                  </div>
                  <Badge className="bg-green-500/10 text-green-700 border-green-200">
                    {t('app.healthy')}
                  </Badge>
                </div>
                <div className="flex justify-between text-xs">
                  <span>{t('admin.cpuUsage')}</span>
                  <span>23%</span>
                </div>
                <Progress value={23} className="h-2" />

                <div className="flex justify-between text-xs">
                  <span>{t('admin.memory')}</span>
                  <span>67%</span>
                </div>
                <Progress value={67} className="h-2" />
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">{t('admin.regionalStatus')}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>{t('admin.uaeNorth')}</span>
                    <Wifi className="h-3 w-3 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>{t('admin.uaeCentral')}</span>
                    <Wifi className="h-3 w-3 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>{t('admin.backupEu')}</span>
                    <WifiOff className="h-3 w-3 text-gray-400" />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>{t('admin.backupUs')}</span>
                    <Wifi className="h-3 w-3 text-yellow-500" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workflow Analytics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5 text-emerald-500" />
                {t('admin.workflowAnalytics')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {workflowMetrics.map((metric, index) => (
                <div key={index} className="space-y-2" data-testid={`workflow-metric-${index}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{metric.name}</span>
                    <div className="flex items-center gap-1">
                      {(() => {
                        const iconData = getTrendIcon(metric.trend);
                        if (!iconData) return null;
                        if ('element' in iconData) {
                          return <div className={iconData.className} />;
                        } else {
                          const Icon = iconData.component;
                          return <Icon className={iconData.className} />;
                        }
                      })()}
                      <span className="text-sm font-bold">
                        {metric.name.includes('Time') ? `${metric.current}min` :
                         metric.name.includes('%') || metric.name.includes('Satisfaction') || metric.name.includes('Compliance') ?
                         `${metric.current}%` : metric.current}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{`${t('app.target')}: `}{metric.name.includes('Time') ? `${metric.target}min` :
                                   metric.name.includes('%') || metric.name.includes('Satisfaction') || metric.name.includes('Compliance') ?
                                   `${metric.target}%` : metric.target}</span>
                    <span className={metric.current >= metric.target ? 'text-green-600' : 'text-yellow-600'}>
                      {metric.current >= metric.target ? t('app.onTarget') : t('app.belowTarget')}
                    </span>
                  </div>
                  <Progress
                    value={(metric.current / metric.target) * 100}
                    className="h-2"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* AI & Compliance Intelligence */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <HexagonLogoFrame px={20} />
                {t('admin.aiCompliance')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium">{t('admin.aiProcessing')}</span>
                  </div>
                  <Badge className="bg-green-500/10 text-green-700 border-green-200">
                    {t('app.active')}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('admin.processingDemands', { count: 3 })}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">{t('admin.securityAudit')}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 rounded bg-muted/50">
                    <div className="text-lg font-bold text-green-600">0</div>
                    <div className="text-xs text-muted-foreground">{t('admin.critical')}</div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/50">
                    <div className="text-lg font-bold text-yellow-600">2</div>
                    <div className="text-xs text-muted-foreground">{t('admin.warnings')}</div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium">{t('admin.userActivity')}</span>
                </div>
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span>{t('admin.activeUsers')}</span>
                    <span className="font-medium">24</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t('admin.peakToday')}</span>
                    <span>67 at 10:30 AM</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Engagement Layer - Notifications & Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Real-time Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-5 w-5 text-orange-500" />
                {t('admin.systemNotifications')}
                {notifications.filter(n => !n.acknowledged).length > 0 && (
                  <Badge className="bg-red-500/10 text-red-700 border-red-200">
                    {t('admin.newCount', { count: notifications.filter(n => !n.acknowledged).length })}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border-l-4 ${getNotificationColor(notification.type)} ${
                        notification.acknowledged ? 'opacity-60' : ''
                      }`}
                      data-testid={`notification-${notification.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1">
                          {(() => {
                            const iconData = getNotificationIcon(notification.type);
                            const Icon = iconData.component;
                            return <Icon className={iconData.className} />;
                          })()}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium">{notification.title}</h4>
                            <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Clock className="h-3 w-3" />
                              <span className="text-xs text-muted-foreground">{notification.timestamp}</span>
                            </div>
                          </div>
                        </div>
                        {!notification.acknowledged && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-6"
                            onClick={() => acknowledgeNotification(notification.id)}
                            data-testid={`acknowledge-${notification.id}`}
                          >
                            {t('app.acknowledge')}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Predictive Insights */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-green-500" />
                {t('admin.predictiveInsights')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">{t('admin.demandForecast')}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {t('admin.demandForecastDesc')}
                </p>
                <div className="text-xs text-blue-600 font-medium">
                  {t('admin.demandForecastRec')}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <HexagonLogoFrame px={16} />
                  <span className="text-sm font-medium">{t('admin.aiOptimization')}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {t('admin.aiOptimizationDesc')}
                </p>
                <div className="text-xs text-green-600 font-medium">
                  {t('admin.aiOptimizationStatus')}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">{t('admin.securityInsight')}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {t('admin.securityInsightDesc')}
                </p>
                <div className="text-xs text-purple-600 font-medium">
                  {t('admin.securityInsightNext')}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
