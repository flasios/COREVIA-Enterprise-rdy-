import { Button } from "@/components/ui/button";
import { useTranslation } from 'react-i18next';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain, BarChart, Sparkles, Award, FileText, CheckCircle2, Target,
  Layers, Zap, Star, Clock, Activity, LayoutGrid, List, PlayCircle,
  ChevronRight, X, Compass, Trophy, Users, Settings, Building2, Globe, Shield,
} from "lucide-react";
import type { AssessmentSubService, Framework } from "./intelligentGateway.data";

// ============================================================================
// ICON MAP - resolve string icon names to components
// ============================================================================

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Compass, BarChart, Trophy, Target, Users, Award, Layers, Zap,
  Settings, Building2, Globe, Brain, Shield, Sparkles,
};

// ============================================================================
// COLOR MAPS
// ============================================================================

const dimColorMap: Record<string, {bg: string; border: string; text: string; light: string; btnBg: string}> = {
  violet: { bg: "from-violet-500 to-purple-600", border: "border-violet-300 dark:border-violet-700", text: "text-violet-600 dark:text-violet-400", light: "from-violet-50/80 to-purple-50/80 dark:from-violet-950/40 dark:to-purple-950/40", btnBg: "bg-violet-500 hover:bg-violet-600" },
  sky: { bg: "from-sky-500 to-blue-600", border: "border-sky-300 dark:border-sky-700", text: "text-sky-600 dark:text-sky-400", light: "from-sky-50/80 to-blue-50/80 dark:from-sky-950/40 dark:to-blue-950/40", btnBg: "bg-sky-500 hover:bg-sky-600" },
  emerald: { bg: "from-emerald-500 to-teal-600", border: "border-emerald-300 dark:border-emerald-700", text: "text-emerald-600 dark:text-emerald-400", light: "from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/40 dark:to-teal-950/40", btnBg: "bg-emerald-500 hover:bg-emerald-600" },
  orange: { bg: "from-orange-500 to-amber-600", border: "border-orange-300 dark:border-orange-700", text: "text-orange-600 dark:text-orange-400", light: "from-orange-50/80 to-amber-50/80 dark:from-orange-950/40 dark:to-amber-950/40", btnBg: "bg-orange-500 hover:bg-orange-600" },
  indigo: { bg: "from-indigo-500 to-blue-600", border: "border-indigo-300 dark:border-indigo-700", text: "text-indigo-600 dark:text-indigo-400", light: "from-indigo-50/80 to-blue-50/80 dark:from-indigo-950/40 dark:to-blue-950/40", btnBg: "bg-indigo-500 hover:bg-indigo-600" },
  rose: { bg: "from-rose-500 to-pink-600", border: "border-rose-300 dark:border-rose-700", text: "text-rose-600 dark:text-rose-400", light: "from-rose-50/80 to-pink-50/80 dark:from-rose-950/40 dark:to-pink-950/40", btnBg: "bg-rose-500 hover:bg-rose-600" },
  amber: { bg: "from-amber-500 to-orange-600", border: "border-amber-300 dark:border-amber-700", text: "text-amber-600 dark:text-amber-400", light: "from-amber-50/80 to-orange-50/80 dark:from-amber-950/40 dark:to-orange-950/40", btnBg: "bg-amber-500 hover:bg-amber-600" },
};

const fwColorMap: Record<string, {bg: string; border: string; text: string; btnBg: string}> = {
  violet: { bg: "from-violet-500 to-purple-600", border: "border-violet-400", text: "text-violet-600 dark:text-violet-400", btnBg: "bg-violet-500 hover:bg-violet-600" },
  blue: { bg: "from-blue-500 to-cyan-600", border: "border-blue-400", text: "text-blue-600 dark:text-blue-400", btnBg: "bg-blue-500 hover:bg-blue-600" },
  emerald: { bg: "from-emerald-500 to-teal-600", border: "border-emerald-400", text: "text-emerald-600 dark:text-emerald-400", btnBg: "bg-emerald-500 hover:bg-emerald-600" },
  amber: { bg: "from-amber-500 to-orange-600", border: "border-amber-400", text: "text-amber-600 dark:text-amber-400", btnBg: "bg-amber-500 hover:bg-amber-600" },
  rose: { bg: "from-rose-500 to-pink-600", border: "border-rose-400", text: "text-rose-600 dark:text-rose-400", btnBg: "bg-rose-500 hover:bg-rose-600" },
  sky: { bg: "from-sky-500 to-blue-600", border: "border-sky-400", text: "text-sky-600 dark:text-sky-400", btnBg: "bg-sky-500 hover:bg-sky-600" },
  indigo: { bg: "from-indigo-500 to-purple-600", border: "border-indigo-400", text: "text-indigo-600 dark:text-indigo-400", btnBg: "bg-indigo-500 hover:bg-indigo-600" },
  purple: { bg: "from-purple-500 to-violet-600", border: "border-purple-400", text: "text-purple-600 dark:text-purple-400", btnBg: "bg-purple-500 hover:bg-purple-600" },
  teal: { bg: "from-teal-500 to-emerald-600", border: "border-teal-400", text: "text-teal-600 dark:text-teal-400", btnBg: "bg-teal-500 hover:bg-teal-600" },
  orange: { bg: "from-orange-500 to-amber-600", border: "border-orange-400", text: "text-orange-600 dark:text-orange-400", btnBg: "bg-orange-500 hover:bg-orange-600" },
};

// ============================================================================
// PROPS
// ============================================================================

interface AssessmentWorkspaceContentProps {
  assessmentSubServices: AssessmentSubService[];
  frameworksByDimension: Record<string, Framework[]>;
  selectedSubService: string | null;
  selectedFramework: string | null;
  setSelectedFramework: (id: string | null) => void;
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function durationToWeeks(d: string): number {
  const match = d.match(/(\d+)-?(\d+)?/);
  if (!match) return 2;
  return match[2] ? (parseInt(match[1]!) + parseInt(match[2]!)) / 2 : parseInt(match[1]!);
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AssessmentWorkspaceContent({
  assessmentSubServices,
  frameworksByDimension,
  selectedSubService,
  selectedFramework,
  setSelectedFramework,
  viewMode,
  setViewMode,
}: AssessmentWorkspaceContentProps) {
  const { t } = useTranslation();
  const dimension = (assessmentSubServices.find(d => d.id === selectedSubService) ?? assessmentSubServices[0])!;
  const frameworks = frameworksByDimension[dimension.id] ?? [];
  const selectedFw = selectedFramework ? frameworks.find(f => f.id === selectedFramework) ?? null : null;
  const dimColors = (dimColorMap[dimension.color] ?? dimColorMap.violet)!;
  const fwColors = (selectedFw ? (fwColorMap[selectedFw.color] ?? fwColorMap.violet) : fwColorMap.violet)!;
  const SelectedIconComponent = selectedFw ? (iconMap[selectedFw.icon] || Brain) : Brain;

  // Calculate aggregate metrics
  const avgRating = frameworks.length > 0 
    ? (frameworks.reduce((sum, f) => sum + f.rating, 0) / frameworks.length).toFixed(1) 
    : "0";
  const avgDuration = frameworks.length > 0 
    ? Math.round(frameworks.reduce((sum, f) => sum + durationToWeeks(f.duration), 0) / frameworks.length)
    : 0;

  return (
    <div className="flex gap-4 h-full overflow-hidden">
      {/* LEFT: Framework Cards Grid - Takes majority of space */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden pb-2">
        {/* KPIs Dashboard */}
        <div className="flex-shrink-0 mb-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Frameworks KPI */}
            <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${dimColors.light} border ${dimColors.border} p-4 shadow-sm hover:shadow-md transition-all duration-300`} data-testid="card-kpi-frameworks">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/20 to-transparent rounded-bl-full"></div>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${dimColors.bg} flex items-center justify-center text-white shadow-md`}>
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <div className={`text-2xl font-bold ${dimColors.text}`} data-testid="text-framework-count">{frameworks.length}</div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{t('demand.gateway.assessment.frameworks')}</div>
                </div>
              </div>
            </div>
            
            {/* Average Rating KPI */}
            <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${dimColors.light} border ${dimColors.border} p-4 shadow-sm hover:shadow-md transition-all duration-300`} data-testid="card-kpi-rating">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/20 to-transparent rounded-bl-full"></div>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${dimColors.bg} flex items-center justify-center text-white shadow-md`}>
                  <Star className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-bold ${dimColors.text}`} data-testid="text-average-rating">{avgRating}</span>
                    <span className="text-xs text-muted-foreground">{t('demand.gateway.assessment.outOfFive')}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{t('demand.gateway.assessment.avgRating')}</div>
                </div>
              </div>
            </div>
            
            {/* Estimated Duration KPI */}
            <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${dimColors.light} border ${dimColors.border} p-4 shadow-sm hover:shadow-md transition-all duration-300`} data-testid="card-kpi-duration">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/20 to-transparent rounded-bl-full"></div>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${dimColors.bg} flex items-center justify-center text-white shadow-md`}>
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-bold ${dimColors.text}`} data-testid="text-avg-duration">{avgDuration}</span>
                    <span className="text-xs text-muted-foreground">{t('demand.gateway.assessment.weeksUnit')}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{t('demand.gateway.assessment.avgDuration')}</div>
                </div>
              </div>
            </div>
            
            {/* Dimension KPIs */}
            <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${dimColors.light} border ${dimColors.border} p-4 shadow-sm hover:shadow-md transition-all duration-300`} data-testid="card-kpi-dimension">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/20 to-transparent rounded-bl-full"></div>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${dimColors.bg} flex items-center justify-center text-white shadow-md`}>
                  <Activity className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-bold ${dimColors.text} truncate`} data-testid="text-dimension-kpi">{dimension.kpis[0]}</div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {dimension.kpis.slice(1).map((kpi, idx) => (
                      <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/60 dark:bg-card/60 text-muted-foreground">{kpi}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Dimension Overview Briefing */}
        <div className={`flex-shrink-0 bg-gradient-to-r ${dimColors.light} rounded-xl border ${dimColors.border} p-4 mb-4 shadow-md`}>
          <div className="flex items-start gap-3">
            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${dimColors.bg} flex items-center justify-center text-white shadow-lg flex-shrink-0`}>
              {dimension.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className={`text-lg font-bold ${dimColors.text}`}>{dimension.title}</h2>
                <Badge variant="secondary" className={`text-xs ${dimColors.text}`}>{frameworks.length} {t('demand.gateway.assessment.frameworks')}</Badge>
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">{dimension.executiveSummary}</p>
            </div>
          </div>
        </div>
        
        {/* Framework Cards with Scrollable Container and View Toggle */}
        <div className="flex-1 min-h-0 bg-white/40 dark:bg-card/40 backdrop-blur-sm rounded-xl border border-border/30 shadow-inner overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 h-full">
            <div className="p-4">
              {/* Framework Section Header with View Toggle */}
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-sm font-semibold ${dimColors.text}`}>{t('demand.gateway.assessment.frameworks')}</h3>
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-white dark:bg-card shadow-sm" : "hover:bg-white/50 dark:hover:bg-card/50"}`}
                    data-testid="button-view-grid"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-white dark:bg-card shadow-sm" : "hover:bg-white/50 dark:hover:bg-card/50"}`}
                    data-testid="button-view-list"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              {/* Framework Cards Grid/List */}
              <div className={viewMode === "grid" ? "grid grid-cols-3 gap-3" : "flex flex-col gap-2"}>
                {frameworks.map((framework) => {
                  const cardColors = (fwColorMap[framework.color] ?? fwColorMap.violet)!;
                  const IconComponent = iconMap[framework.icon] || Brain;
                  const isSelected = selectedFramework === framework.id;
                  
                  return viewMode === "grid" ? (
                    <button
                      key={framework.id}
                      onClick={() => setSelectedFramework(isSelected ? null : framework.id)}
                      className={`text-left p-3 rounded-xl transition-all duration-200 ${
                        isSelected 
                          ? `bg-gradient-to-br ${cardColors.bg} text-white shadow-lg ring-2 ring-offset-2 ring-${framework.color}-500` 
                          : 'bg-white/90 dark:bg-card/90 border border-border/50 hover:shadow-md hover:border-border'
                      }`}
                      data-testid={`card-${framework.id}`}
                    >
                      <div className="flex items-start gap-2.5 mb-2">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-white/20' : `bg-gradient-to-br ${cardColors.bg} text-white`
                        }`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-bold leading-tight ${isSelected ? 'text-white' : cardColors.text}`}>
                            {framework.shortTitle}
                          </div>
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`h-2.5 w-2.5 ${
                                i < framework.rating 
                                  ? isSelected ? 'text-white fill-white' : 'text-amber-500 fill-amber-500' 
                                  : isSelected ? 'text-white/30' : 'text-muted-foreground/30'
                              }`} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className={`text-xs leading-relaxed line-clamp-2 ${isSelected ? 'text-white/90' : 'text-foreground/70'}`}>
                        {framework.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {framework.metrics.slice(0, 2).map((metric, idx) => (
                          <span key={idx} className={`text-[10px] px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                          }`}>
                            {metric}
                          </span>
                        ))}
                        <span className={`text-[10px] ${isSelected ? 'text-white/70' : 'text-muted-foreground'}`}>
                          {framework.duration}
                        </span>
                      </div>
                    </button>
                  ) : (
                    <button
                      key={framework.id}
                      onClick={() => setSelectedFramework(isSelected ? null : framework.id)}
                      className={`text-left p-2.5 rounded-lg transition-all duration-200 flex items-center gap-3 ${
                        isSelected 
                          ? `bg-gradient-to-r ${cardColors.bg} text-white shadow-md` 
                          : 'bg-white/90 dark:bg-card/90 border border-border/50 hover:shadow-sm hover:border-border'
                      }`}
                      data-testid={`card-${framework.id}`}
                    >
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-white/20' : `bg-gradient-to-br ${cardColors.bg} text-white`
                      }`}>
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${isSelected ? 'text-white' : cardColors.text}`}>
                            {framework.shortTitle}
                          </span>
                          <div className="flex items-center gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`h-2 w-2 ${
                                i < framework.rating 
                                  ? isSelected ? 'text-white fill-white' : 'text-amber-500 fill-amber-500' 
                                  : isSelected ? 'text-white/30' : 'text-muted-foreground/30'
                              }`} />
                            ))}
                          </div>
                        </div>
                        <p className={`text-[11px] leading-snug truncate ${isSelected ? 'text-white/80' : 'text-foreground/60'}`}>
                          {framework.description}
                        </p>
                      </div>
                      <div className={`text-[10px] px-2 py-1 rounded-full flex-shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                      }`}>
                        {framework.duration}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
      
      {/* RIGHT: Smart Canvas - Context-Aware Detail Panel */}
      <div className="w-[420px] flex-shrink-0 h-full flex flex-col bg-gradient-to-b from-white/50 to-white/30 dark:from-card/50 dark:to-card/30 rounded-xl border border-border/30 overflow-hidden mb-2">
        <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-4">
          {selectedFw ? (
            <>
              {/* Framework Header with Close Button */}
              <div className={`p-4 rounded-xl bg-gradient-to-br ${fwColors.bg} text-white relative`} data-testid={`canvas-${selectedFw.id}`}>
                <button 
                  onClick={() => setSelectedFramework(null)}
                  className="absolute top-2 right-2 h-6 w-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  data-testid="button-close-framework"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    <SelectedIconComponent className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <h3 className="text-base font-bold truncate">{selectedFw.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < selectedFw.rating ? 'text-amber-300 fill-amber-300' : 'text-white/30'}`} />
                        ))}
                      </div>
                      <span className="text-xs text-white/70">{dimension.shortTitle}</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-white/80 mt-3 leading-relaxed">{selectedFw.description}</p>
              </div>
              
              {/* Metrics Card */}
              <div className="p-3 rounded-xl bg-white/90 dark:bg-card/90 border border-border/50">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-muted/30">
                    <div className={`text-sm font-bold ${fwColors.text}`}>{selectedFw.metrics[0]}</div>
                    <div className="text-[10px] text-muted-foreground">{t('demand.gateway.assessment.coverage')}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30">
                    <div className={`text-sm font-bold ${fwColors.text}`}>{selectedFw.metrics[1]}</div>
                    <div className="text-[10px] text-muted-foreground">{t('demand.gateway.assessment.depth')}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30">
                    <div className={`text-sm font-bold ${fwColors.text}`}>{selectedFw.duration}</div>
                    <div className="text-[10px] text-muted-foreground">{t('demand.gateway.assessment.duration')}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{t('demand.gateway.assessment.active')}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{t('demand.gateway.assessment.status')}</div>
                  </div>
                </div>
              </div>
              
              {/* Summary Card */}
              <div className="p-3 rounded-xl bg-white/90 dark:bg-card/90 border border-border/50">
                <h4 className={`text-xs font-semibold ${fwColors.text} mb-2 flex items-center gap-1.5`}>
                  <FileText className="h-3.5 w-3.5" />
                  {t('demand.gateway.assessment.aboutThisFramework')}
                </h4>
                <p className="text-xs text-foreground/70 leading-relaxed">{selectedFw.details}</p>
              </div>
              
              {/* Process Card */}
              <div className="p-3 rounded-xl bg-white/90 dark:bg-card/90 border border-border/50">
                <h4 className={`text-xs font-semibold ${fwColors.text} mb-3 flex items-center gap-1.5`}>
                  <Activity className="h-3.5 w-3.5" />
                  {t('demand.gateway.assessment.assessmentProcess')}
                </h4>
                <div className="flex items-center justify-between">
                  {[t('demand.gateway.assessment.prep'), t('demand.gateway.assessment.collect'), t('demand.gateway.assessment.analyze'), t('demand.gateway.assessment.report')].map((step, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${fwColors.bg} flex items-center justify-center text-white text-xs font-bold`}>
                        {idx + 1}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Benefits */}
              <div className="p-3 rounded-xl bg-white/90 dark:bg-card/90 border border-border/50">
                <h4 className={`text-xs font-semibold ${fwColors.text} mb-2 flex items-center gap-1.5`}>
                  <Award className="h-3.5 w-3.5" />
                  {t('demand.gateway.assessment.keyBenefits')}
                </h4>
                <div className="grid grid-cols-2 gap-1.5">
                  {[t('demand.gateway.assessment.benchmarking'), t('demand.gateway.assessment.gapAnalysis'), t('demand.gateway.assessment.roadmap'), t('demand.gateway.assessment.insights')].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-xs text-foreground/80">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Dimension Overview - Default State */}
              <div className={`p-4 rounded-xl bg-gradient-to-br ${dimColors.bg} text-white`} data-testid="canvas-dimension-overview">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    {dimension.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold">{dimension.title}</h3>
                    <p className="text-xs text-white/70">{frameworks.length} {t('demand.gateway.assessment.frameworksAvailable')}</p>
                  </div>
                </div>
                <p className="text-xs text-white/90 leading-relaxed">{dimension.description}</p>
              </div>
              
              {/* Executive Summary Card */}
              <div className="p-3 rounded-xl bg-white/90 dark:bg-card/90 border border-border/50">
                <h4 className={`text-xs font-semibold ${dimColors.text} mb-2 flex items-center gap-1.5`}>
                  <FileText className="h-3.5 w-3.5" />
                  {t('demand.gateway.assessment.executiveSummary')}
                </h4>
                <p className="text-xs text-foreground/70 leading-relaxed">{dimension.executiveSummary}</p>
              </div>
              
              {/* KPIs Card */}
              <div className="p-3 rounded-xl bg-white/90 dark:bg-card/90 border border-border/50">
                <h4 className={`text-xs font-semibold ${dimColors.text} mb-2 flex items-center gap-1.5`}>
                  <Target className="h-3.5 w-3.5" />
                  {t('demand.gateway.assessment.keyPerformanceIndicators')}
                </h4>
                <div className="space-y-1.5">
                  {dimension.kpis.map((kpi, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className={`h-5 w-5 rounded bg-gradient-to-br ${dimColors.bg} flex items-center justify-center text-white text-[10px] font-bold`}>
                        {idx + 1}
                      </div>
                      <span className="text-xs text-foreground">{kpi}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Metrics Overview Card */}
              <div className="p-3 rounded-xl bg-white/90 dark:bg-card/90 border border-border/50">
                <h4 className={`text-xs font-semibold ${dimColors.text} mb-2 flex items-center gap-1.5`}>
                  <BarChart className="h-3.5 w-3.5" />
                  {t('demand.gateway.assessment.assessmentMetrics')}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${dimColors.light}`}>
                    <div className={`text-lg font-bold ${dimColors.text}`}>{dimension.metrics.value}</div>
                    <div className="text-[10px] text-muted-foreground">{dimension.metrics.label}</div>
                  </div>
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${dimColors.light}`}>
                    <div className={`text-lg font-bold ${dimColors.text}`}>{frameworks.length}</div>
                    <div className="text-[10px] text-muted-foreground">{t('demand.gateway.assessment.frameworks')}</div>
                  </div>
                </div>
              </div>
              
              {/* Available Frameworks List */}
              <div className="p-3 rounded-xl bg-white/90 dark:bg-card/90 border border-border/50">
                <h4 className={`text-xs font-semibold ${dimColors.text} mb-2 flex items-center gap-1.5`}>
                  <Layers className="h-3.5 w-3.5" />
                  {t('demand.gateway.assessment.availableFrameworks')}
                </h4>
                <div className="space-y-1.5">
                  {frameworks.map((fw) => {
                    const FwIcon = iconMap[fw.icon] || Brain;
                    return (
                      <button
                        key={fw.id}
                        onClick={() => setSelectedFramework(fw.id)}
                        className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className={`h-6 w-6 rounded bg-gradient-to-br ${fwColorMap[fw.color]?.bg || 'from-violet-500 to-purple-600'} flex items-center justify-center text-white`}>
                          <FwIcon className="h-3 w-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-foreground truncate block">{fw.shortTitle}</span>
                        </div>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Quick Start Hint */}
              <div className={`p-3 rounded-xl bg-gradient-to-br ${dimColors.light} border ${dimColors.border}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className={`h-3.5 w-3.5 ${dimColors.text}`} />
                  <span className={`text-xs font-semibold ${dimColors.text}`}>{t('demand.gateway.assessment.getStarted')}</span>
                </div>
                <p className="text-[11px] text-foreground/70 leading-relaxed">
                  {t('demand.gateway.assessment.getStartedDesc')}
                </p>
              </div>
            </>
          )}
        </div>
        
        {/* Action Footer - Always visible */}
        <div className="p-3 border-t border-border/30 bg-white/50 dark:bg-card/50">
          {selectedFw ? (
            <Button 
              className={`${fwColors.btnBg} text-white gap-2 w-full`}
              data-testid={`button-start-${selectedFw.id}`}
            >
              <PlayCircle className="h-4 w-4" />
              {t('demand.gateway.assessment.startAssessment')}
            </Button>
          ) : (
            <Button 
              className={`${dimColors.btnBg} text-white gap-2 w-full`}
              data-testid="button-compare-frameworks"
            >
              <BarChart className="h-4 w-4" />
              {t('demand.gateway.assessment.compareAllFrameworks')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
