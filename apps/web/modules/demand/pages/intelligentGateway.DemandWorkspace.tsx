import { Link } from "wouter";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp, MessageSquare, Lightbulb, BarChart, Sparkles,
  Users, Shield, Settings, Award, FileText, CheckCircle2, Target,
  Layers, Zap, Clock, Activity,
} from "lucide-react";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import type { DemandSubService } from "./intelligentGateway.data";

// ============================================================================
// COLOR MAP
// ============================================================================

const colorMap: Record<string, {bg: string; border: string; text: string; light: string; btnBg: string}> = {
  "bg-emerald-500": { bg: "from-emerald-500 to-teal-600", border: "border-emerald-300 dark:border-emerald-700", text: "text-emerald-600 dark:text-emerald-400", light: "from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/40 dark:to-teal-950/40", btnBg: "bg-emerald-500 hover:bg-emerald-600" },
  "bg-purple-500": { bg: "from-purple-500 to-violet-600", border: "border-purple-300 dark:border-purple-700", text: "text-purple-600 dark:text-purple-400", light: "from-purple-50/80 to-violet-50/80 dark:from-purple-950/40 dark:to-violet-950/40", btnBg: "bg-purple-500 hover:bg-purple-600" },
  "bg-rose-500": { bg: "from-rose-500 to-pink-600", border: "border-rose-300 dark:border-rose-700", text: "text-rose-600 dark:text-rose-400", light: "from-rose-50/80 to-pink-50/80 dark:from-rose-950/40 dark:to-pink-950/40", btnBg: "bg-rose-500 hover:bg-rose-600" },
  "bg-amber-500": { bg: "from-amber-500 to-orange-600", border: "border-amber-300 dark:border-amber-700", text: "text-amber-600 dark:text-amber-400", light: "from-amber-50/80 to-orange-50/80 dark:from-amber-950/40 dark:to-orange-950/40", btnBg: "bg-amber-500 hover:bg-amber-600" },
};

// ============================================================================
// PROPS
// ============================================================================

interface DemandWorkspaceContentProps {
  demandSubServices: DemandSubService[];
  selectedSubService: string | null;
  successRate: number;
  onNavigate: (path: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function DemandWorkspaceContent({
  demandSubServices,
  selectedSubService,
  successRate,
  onNavigate,
}: DemandWorkspaceContentProps) {
  const { t } = useTranslation();
  const subService = (demandSubServices.find(s => s.id === selectedSubService) ?? demandSubServices[0])!;
  const svcColors = (colorMap[subService.color] ?? colorMap["bg-emerald-500"])!;
  const dm = subService.detailedMetrics;

  return (
    <div className="flex gap-4 h-full min-w-0 overflow-hidden">
      {/* LEFT: Enhanced Smart Panel with Real Information */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden pb-2">
        {/* Top KPIs Row - Service-Specific Metrics */}
        <div className="flex-shrink-0 mb-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {/* SLA Compliance KPI with Progress Ring */}
            <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${svcColors.light} border ${svcColors.border} p-4 shadow-sm hover:shadow-md transition-all duration-300`} data-testid="card-kpi-sla">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/20 to-transparent rounded-bl-full"></div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <svg className="w-12 h-12 transform -rotate-90">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/20" />
                    <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4"
                      strokeDasharray={`${dm.slaCompliance * 1.26} 126`}
                      className={dm.slaCompliance >= 90 ? "text-emerald-500" : dm.slaCompliance >= 75 ? "text-amber-500" : "text-rose-500"} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${svcColors.text}`} data-testid="text-sla">{dm.slaCompliance}%</div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{t('demand.gateway.demandWorkspace.slaCompliance')}</div>
                </div>
              </div>
            </div>

            {/* Pending Approval KPI */}
            <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${svcColors.light} border ${svcColors.border} p-4 shadow-sm hover:shadow-md transition-all duration-300`} data-testid="card-kpi-pending">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/20 to-transparent rounded-bl-full"></div>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${svcColors.bg} flex items-center justify-center text-white shadow-md`}>
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <div className={`text-2xl font-bold ${svcColors.text}`} data-testid="text-pending">{dm.pendingApproval}</div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{t('demand.gateway.demandWorkspace.pendingApproval')}</div>
                </div>
              </div>
            </div>

            {/* This Month KPI */}
            <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${svcColors.light} border ${svcColors.border} p-4 shadow-sm hover:shadow-md transition-all duration-300`} data-testid="card-kpi-month">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/20 to-transparent rounded-bl-full"></div>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${svcColors.bg} flex items-center justify-center text-white shadow-md`}>
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <div className={`text-2xl font-bold ${svcColors.text}`} data-testid="text-month">{dm.thisMonth}</div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{t('demand.gateway.demandWorkspace.thisMonth')}</div>
                </div>
              </div>
            </div>

            {/* Avg Processing Time KPI */}
            <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${svcColors.light} border ${svcColors.border} p-4 shadow-sm hover:shadow-md transition-all duration-300`} data-testid="card-kpi-processing">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/20 to-transparent rounded-bl-full"></div>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${svcColors.bg} flex items-center justify-center text-white shadow-md`}>
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-bold ${svcColors.text}`} data-testid="text-processing">{dm.avgProcessingDays}</span>
                    <span className="text-xs text-muted-foreground">{t('demand.gateway.demandWorkspace.daysUnit')}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{t('demand.gateway.demandWorkspace.avgProcessing')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Process & Procedures Panel */}
        <div className="flex-1 min-h-0 bg-white/40 dark:bg-card/40 backdrop-blur-sm rounded-xl border border-border/30 shadow-inner overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 h-full">
            <div className="p-4 space-y-4">
              {/* Process Flow Header */}
              <div className={`p-4 rounded-xl bg-gradient-to-br ${svcColors.bg} text-white relative overflow-hidden`} data-testid="process-flow-header">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full"></div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{subService.processFlow.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-white/80">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{t('demand.gateway.demandWorkspace.targetSla', { value: subService.processFlow.sla.target })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Workflow Stages Visualization */}
              <div className="bg-white/60 dark:bg-card/60 rounded-xl border border-border/50 p-4" data-testid="workflow-stages">
                <h4 className={`text-sm font-semibold ${svcColors.text} mb-4 flex items-center gap-2`}>
                  <Activity className="h-4 w-4" />
                  {t('demand.gateway.demandWorkspace.workflowStages')}
                </h4>
                <div className="relative">
                  {subService.processFlow.stages.map((stage, idx) => (
                    <div key={stage.id} className="flex items-start gap-3 mb-4 last:mb-0" data-testid={`stage-${stage.id}`}>
                      {/* Stage Number Circle */}
                      <div className="relative flex flex-col items-center">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          stage.status === 'active'
                            ? `bg-gradient-to-br ${svcColors.bg} text-white shadow-lg ring-2 ring-offset-2 ring-offset-background`
                            : stage.status === 'completed'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {stage.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : stage.id}
                        </div>
                        {idx < subService.processFlow.stages.length - 1 && (
                          <div className={`w-0.5 h-12 ${
                            stage.status === 'completed' ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-border'
                          }`}></div>
                        )}
                      </div>
                      {/* Stage Content */}
                      <div className={`flex-1 pb-4 ${idx < subService.processFlow.stages.length - 1 ? 'border-b border-border/30' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <h5 className={`font-semibold text-sm ${
                            stage.status === 'active' ? svcColors.text : 'text-foreground'
                          }`}>{stage.name}</h5>
                          <Badge variant={stage.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                            {stage.duration}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{stage.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RACI Matrix */}
              <div className="bg-white/60 dark:bg-card/60 rounded-xl border border-border/50 p-4" data-testid="raci-matrix">
                <h4 className={`text-sm font-semibold ${svcColors.text} mb-3 flex items-center gap-2`}>
                  <Users className="h-4 w-4" />
                  {t('demand.gateway.demandWorkspace.responsibilityMatrix')}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">{t('demand.gateway.demandWorkspace.role')}</th>
                        <th className="text-center py-2 px-2 font-semibold text-blue-600 dark:text-blue-400">R</th>
                        <th className="text-center py-2 px-2 font-semibold text-purple-600 dark:text-purple-400">A</th>
                        <th className="text-center py-2 px-2 font-semibold text-amber-600 dark:text-amber-400">C</th>
                        <th className="text-center py-2 px-2 font-semibold text-emerald-600 dark:text-emerald-400">I</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subService.processFlow.raci.map((item, idx) => (
                        <tr key={idx} className="border-b border-border/20 last:border-0">
                          <td className="py-2 pr-3 font-medium text-foreground">{item.role}</td>
                          <td className="text-center py-2 px-2">
                            {item.responsible && <div className="h-4 w-4 rounded-full bg-blue-500 mx-auto"></div>}
                          </td>
                          <td className="text-center py-2 px-2">
                            {item.accountable && <div className="h-4 w-4 rounded-full bg-purple-500 mx-auto"></div>}
                          </td>
                          <td className="text-center py-2 px-2">
                            {item.consulted && <div className="h-4 w-4 rounded-full bg-amber-500 mx-auto"></div>}
                          </td>
                          <td className="text-center py-2 px-2">
                            {item.informed && <div className="h-4 w-4 rounded-full bg-emerald-500 mx-auto"></div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border/30">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500"></div>
                    <span>{t('demand.gateway.demandWorkspace.responsible')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <div className="h-2.5 w-2.5 rounded-full bg-purple-500"></div>
                    <span>{t('demand.gateway.demandWorkspace.accountable')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500"></div>
                    <span>{t('demand.gateway.demandWorkspace.consulted')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500"></div>
                    <span>{t('demand.gateway.demandWorkspace.informed')}</span>
                  </div>
                </div>
              </div>

              {/* SLA & Approval Levels */}
              <div className="grid grid-cols-2 gap-3">
                {/* SLA Information */}
                <div className={`bg-gradient-to-br ${svcColors.light} rounded-xl border ${svcColors.border} p-4`} data-testid="sla-info">
                  <h4 className={`text-xs font-semibold ${svcColors.text} mb-3 flex items-center gap-2`}>
                    <Clock className="h-3.5 w-3.5" />
                    {t('demand.gateway.demandWorkspace.slaTimelines')}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t('demand.gateway.demandWorkspace.target')}</span>
                      <span className={`text-xs font-bold ${svcColors.text}`}>{subService.processFlow.sla.target}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t('demand.gateway.demandWorkspace.warning')}</span>
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{subService.processFlow.sla.warning}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t('demand.gateway.demandWorkspace.critical')}</span>
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{subService.processFlow.sla.critical}</span>
                    </div>
                  </div>
                </div>

                {/* Current Performance */}
                <div className={`bg-gradient-to-br ${svcColors.light} rounded-xl border ${svcColors.border} p-4`} data-testid="current-performance">
                  <h4 className={`text-xs font-semibold ${svcColors.text} mb-3 flex items-center gap-2`}>
                    <BarChart className="h-3.5 w-3.5" />
                    {t('demand.gateway.demandWorkspace.currentPerformance')}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t('demand.gateway.demandWorkspace.slaCompliance')}</span>
                      <span className={`text-xs font-bold ${dm.slaCompliance >= 90 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{dm.slaCompliance}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t('demand.gateway.demandWorkspace.avgProcessing')}</span>
                      <span className={`text-xs font-bold ${svcColors.text}`}>{dm.avgProcessingDays} {t('demand.gateway.demandWorkspace.daysUnit')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t('demand.gateway.demandWorkspace.pending')}</span>
                      <span className={`text-xs font-bold ${svcColors.text}`}>{dm.pendingApproval}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Approval Workflow */}
              <div className="bg-white/60 dark:bg-card/60 rounded-xl border border-border/50 p-4" data-testid="approval-workflow">
                <h4 className={`text-sm font-semibold ${svcColors.text} mb-3 flex items-center gap-2`}>
                  <Shield className="h-4 w-4" />
                  {t('demand.gateway.demandWorkspace.approvalAuthorityLevels')}
                </h4>
                <div className="space-y-3">
                  {subService.processFlow.approvalLevels.map((level) => (
                    <div key={level.level} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30" data-testid={`approval-level-${level.level}`}>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-gradient-to-br ${svcColors.bg} text-white`}>
                        L{level.level}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-semibold text-sm text-foreground">{level.authority}</span>
                          {level.autoApprove && (
                            <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              {t('demand.gateway.demandWorkspace.autoApprove')}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{level.threshold}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Stats Summary */}
              <div className={`bg-gradient-to-br ${svcColors.light} rounded-xl border ${svcColors.border} p-4`} data-testid="quick-stats-summary">
                <h4 className={`text-xs font-semibold ${svcColors.text} mb-3 flex items-center gap-2`}>
                  <Target className="h-3.5 w-3.5" />
                  {t('demand.gateway.demandWorkspace.keyInsights')}
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {dm.quickStats.map((stat, idx) => (
                    <div key={idx} className="text-center p-2 rounded-lg bg-white/50 dark:bg-card/50">
                      <div className={`text-lg font-bold ${svcColors.text}`}>{stat.value}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* RIGHT: Smart Canvas - Context-Aware Detail Panel */}
      <div className="w-[300px] xl:w-[320px] flex-shrink-0 h-full flex flex-col bg-gradient-to-b from-white/50 to-white/30 dark:from-card/50 dark:to-card/30 rounded-xl border border-border/30 overflow-hidden mb-2">
        <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-4">
          {/* Sub-Service Header */}
          <div className={`p-4 rounded-xl bg-gradient-to-br ${svcColors.bg} text-white relative`} data-testid={`canvas-${subService.id}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-lg bg-white/20 flex items-center justify-center">
                {subService.icon}
              </div>
              <div>
                <h3 className="text-lg font-bold">{subService.title}</h3>
                <p className="text-sm text-white/80">{subService.metrics.status}</p>
              </div>
            </div>
            <p className="text-sm text-white/90 leading-relaxed">{subService.description}</p>
          </div>

          {/* Primary Actions */}
          <div className="space-y-2">
            {subService.id === "demand-request-form" ? (
              <>
                <Link href="/demand-analysis" className="block">
                  <Button
                    className={`w-full gap-2 ${subService.color} text-white font-semibold shadow-lg hover:shadow-xl transition-all`}
                    data-testid={`button-primary-action-${subService.id}`}
                  >
                    <TrendingUp className="h-4 w-4" />
                    {t('demand.gateway.demandWorkspace.submitNewDemandRequest')}
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full gap-2 font-semibold"
                  onClick={() => onNavigate("/demand-submitted")}
                  data-testid={`button-configure-${subService.id}`}
                >
                  <BarChart className="h-4 w-4" />
                  {t('demand.gateway.demandWorkspace.viewSubmittedRequests')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  className={`w-full gap-2 ${subService.color} text-white font-semibold shadow-lg hover:shadow-xl transition-all`}
                  data-testid={`button-primary-action-${subService.id}`}
                >
                  <HexagonLogoFrame px={16} />
                  {t('demand.gateway.demandWorkspace.launch', { title: subService.title })}
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2 font-semibold"
                  data-testid={`button-configure-${subService.id}`}
                >
                  <Settings className="h-4 w-4" />
                  {t('demand.gateway.demandWorkspace.configureSettings')}
                </Button>
              </>
            )}
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`p-3 rounded-lg bg-gradient-to-br ${svcColors.light} border ${svcColors.border}`}>
              <div className={`text-xl font-bold ${svcColors.text}`}>{subService.metrics.value}</div>
              <div className="text-xs text-muted-foreground">{subService.metrics.label}</div>
            </div>
            <div className={`p-3 rounded-lg bg-gradient-to-br ${svcColors.light} border ${svcColors.border}`}>
              <div className={`text-xl font-bold ${svcColors.text}`}>{successRate}%</div>
              <div className="text-xs text-muted-foreground">{t('demand.gateway.demandWorkspace.successRate')}</div>
            </div>
          </div>

          {/* Demand Intake Process - Only for demand-request-form */}
          {subService.id === "demand-request-form" && (
            <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-300 dark:border-emerald-700">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Sparkles className="h-4 w-4" />
                {t('demand.gateway.demandWorkspace.demandIntakeProcess')}
              </h4>
              <div className="space-y-2">
                {[
                  { step: 1, title: t('demand.gateway.demandWorkspace.submitRequest'), desc: t('demand.gateway.demandWorkspace.strategicObjectivesForm'), color: "bg-blue-500" },
                  { step: 2, title: t('demand.gateway.demandWorkspace.aiAnalysis'), desc: t('demand.gateway.demandWorkspace.businessCaseGeneration'), color: "bg-purple-500" },
                  { step: 3, title: t('demand.gateway.demandWorkspace.reviewApproval'), desc: t('demand.gateway.demandWorkspace.multiLevelWorkflow'), color: "bg-amber-500" },
                  { step: 4, title: t('demand.gateway.demandWorkspace.portfolioIntegration'), desc: t('demand.gateway.demandWorkspace.kpiDashboards'), color: "bg-emerald-500" },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-2">
                    <div className={`h-5 w-5 rounded-full ${item.color} text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0`}>{item.step}</div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold">{item.title}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">- {item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Governance Structure - Only for demand-request-form */}
          {subService.id === "demand-request-form" && (
            <div className="p-3 rounded-lg bg-white/60 dark:bg-card/60 border border-border/50">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {t('demand.gateway.demandWorkspace.governanceStructure')}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { title: t('demand.gateway.demandWorkspace.demandReview'), icon: <FileText className="h-3 w-3" />, color: "border-l-blue-500" },
                  { title: t('demand.gateway.demandWorkspace.strategyCommittee'), icon: <Target className="h-3 w-3" />, color: "border-l-purple-500" },
                  { title: t('demand.gateway.demandWorkspace.technicalReview'), icon: <Settings className="h-3 w-3" />, color: "border-l-emerald-500" },
                  { title: t('demand.gateway.demandWorkspace.steeringCommittee'), icon: <Award className="h-3 w-3" />, color: "border-l-amber-500" },
                ].map((item, idx) => (
                  <div key={idx} className={`p-2 rounded-md bg-muted/30 border-l-2 ${item.color}`}>
                    <div className="flex items-center gap-1.5">
                      {item.icon}
                      <span className="text-[10px] font-medium">{item.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* IMS Analysis specific content */}
          {subService.id === "ims-analysis" && (
            <div className="p-3 rounded-lg bg-gradient-to-br from-purple-50/80 to-violet-50/80 dark:from-purple-950/40 dark:to-violet-950/40 border border-purple-300 dark:border-purple-700">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-purple-700 dark:text-purple-400">
                <HexagonLogoFrame px={16} />
                {t('demand.gateway.demandWorkspace.imsCapabilities')}
              </h4>
              <div className="space-y-1.5">
                {[t('demand.gateway.demandWorkspace.systemIntegration'), t('demand.gateway.demandWorkspace.performanceOptimization'), t('demand.gateway.demandWorkspace.complianceMonitoring'), t('demand.gateway.demandWorkspace.riskAssessment')].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-purple-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Complaints Analysis specific content */}
          {subService.id === "complaints-analysis" && (
            <div className="p-3 rounded-lg bg-gradient-to-br from-rose-50/80 to-pink-50/80 dark:from-rose-950/40 dark:to-pink-950/40 border border-rose-300 dark:border-rose-700">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-rose-700 dark:text-rose-400">
                <MessageSquare className="h-4 w-4" />
                {t('demand.gateway.demandWorkspace.analysisFeatures')}
              </h4>
              <div className="space-y-1.5">
                {[t('demand.gateway.demandWorkspace.sentimentAnalysis'), t('demand.gateway.demandWorkspace.rootCauseIdentification'), t('demand.gateway.demandWorkspace.resolutionTracking'), t('demand.gateway.demandWorkspace.trendDetection')].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-rose-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Innovations specific content */}
          {subService.id === "innovations" && (
            <div className="p-3 rounded-lg bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-300 dark:border-amber-700">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Lightbulb className="h-4 w-4" />
                {t('demand.gateway.demandWorkspace.innovationTracking')}
              </h4>
              <div className="space-y-1.5">
                {[t('demand.gateway.demandWorkspace.ideaSubmission'), t('demand.gateway.demandWorkspace.feasibilityAssessment'), t('demand.gateway.demandWorkspace.impactEvaluation'), t('demand.gateway.demandWorkspace.implementationRoadmap')].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
