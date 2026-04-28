import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Users,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Briefcase as _Briefcase,
  Shield,
  Clock,
  TrendingUp,
  UserPlus,
  Building2,
  Wrench,
  Lightbulb,
  Target,
} from "lucide-react";
import { VideoLogo } from "@/components/ui/video-logo";
import { queryClient } from "@/lib/queryClient";

interface TeamRole {
  role: string;
  count: number;
  duration: string;
  priority: "critical" | "high" | "medium" | "optional";
  skills: string[];
  experienceLevel: "junior" | "mid" | "senior" | "expert";
  estimatedFTEMonths: number;
  responsibilities: string[];
  availability: "available" | "limited" | "unavailable" | "unknown";
  availableCount?: number;
  gapCount?: number;
}

interface ExternalResource {
  type: string;
  description: string;
  priority: "critical" | "high" | "medium" | "optional";
  estimatedCost?: string;
  alternatives?: string[];
}

interface EquipmentResource {
  name: string;
  quantity: number;
  priority: "critical" | "high" | "medium" | "optional";
  availability: "available" | "procurement_needed" | "unavailable";
  leadTime?: string;
}

interface ResourceGap {
  type: "personnel" | "external" | "equipment";
  name: string;
  gapSize: number | string;
  impact: "critical" | "high" | "medium" | "low";
  recommendations: string[];
  riskLevel: "high" | "medium" | "low";
}

interface TeamRecommendation {
  projectId: string;
  projectName: string;
  generatedAt: string;
  summary: {
    totalRoles: number;
    totalHeadcount: number;
    totalFTEMonths: number;
    criticalRoles: number;
    resourceGaps: number;
    overallReadiness: "ready" | "needs_attention" | "critical_gaps";
  };
  teamStructure: {
    leadership: TeamRole[];
    core: TeamRole[];
    support: TeamRole[];
    external: ExternalResource[];
    equipment: EquipmentResource[];
  };
  resourceGaps: ResourceGap[];
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    contingency: string[];
  };
  riskAssessment: {
    overallRisk: "low" | "medium" | "high" | "critical";
    factors: Array<{
      factor: string;
      risk: "low" | "medium" | "high";
      mitigation: string;
    }>;
  };
}

interface AITeamAdvisorPanelProps {
  projectId: string;
}

export function AITeamAdvisorPanel({ projectId }: AITeamAdvisorPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    leadership: true,
    core: true,
    support: false,
    external: false,
    equipment: false,
    gaps: true,
    recommendations: true,
    risks: false,
  });

  const { data: recommendation, isLoading, error, refetch } = useQuery<{ success: boolean; data: TeamRecommendation }>({
    queryKey: ['/api/portfolio/projects', projectId, 'team-recommendations'],
    enabled: !!projectId,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40";
      case "high": return "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40";
      case "medium": return "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/40";
      case "optional": return "bg-muted/20 text-muted-foreground border-border/40";
      default: return "bg-muted/20 text-muted-foreground border-border/40";
    }
  };

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case "available": return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400";
      case "limited": return "bg-amber-500/20 text-amber-600 dark:text-amber-400";
      case "unavailable": return "bg-red-500/20 text-red-600 dark:text-red-400";
      case "procurement_needed": return "bg-amber-500/20 text-amber-600 dark:text-amber-400";
      default: return "bg-muted/20 text-muted-foreground";
    }
  };

  const getReadinessColor = (readiness: string) => {
    switch (readiness) {
      case "ready": return "text-emerald-600 dark:text-emerald-400";
      case "needs_attention": return "text-amber-600 dark:text-amber-400";
      case "critical_gaps": return "text-red-600 dark:text-red-400";
      default: return "text-muted-foreground";
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low": return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400";
      case "medium": return "bg-amber-500/20 text-amber-600 dark:text-amber-400";
      case "high": return "bg-red-500/20 text-red-600 dark:text-red-400";
      case "critical": return "bg-red-600/30 text-red-700 dark:text-red-300";
      default: return "bg-muted/20 text-muted-foreground";
    }
  };

  const renderRoleCard = (role: TeamRole, index: number) => (
    <div key={index} className="p-4 bg-muted/30 rounded-lg border border-border/30 hover:border-border/50 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold text-sm">{role.role}</div>
            <div className="text-xs text-muted-foreground">{role.experienceLevel} level</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={getPriorityColor(role.priority)}>
            {role.priority}
          </Badge>
          <Badge variant="outline" className={getAvailabilityColor(role.availability)}>
            {role.availability === "available" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : 
             role.availability === "unavailable" ? <AlertCircle className="w-3 h-3 mr-1" /> :
             <AlertTriangle className="w-3 h-3 mr-1" />}
            {role.availability}
          </Badge>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center p-2 bg-background/50 rounded">
          <div className="text-lg font-bold text-primary">{role.count}</div>
          <div className="text-[10px] text-muted-foreground uppercase">Headcount</div>
        </div>
        <div className="text-center p-2 bg-background/50 rounded">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{role.estimatedFTEMonths}</div>
          <div className="text-[10px] text-muted-foreground uppercase">FTE Months</div>
        </div>
        <div className="text-center p-2 bg-background/50 rounded">
          <div className="text-xs font-semibold text-foreground">{role.duration}</div>
          <div className="text-[10px] text-muted-foreground uppercase">Duration</div>
        </div>
      </div>

      {role.gapCount !== undefined && role.gapCount > 0 && (
        <div className="mb-3 p-2 bg-red-500/10 rounded border border-red-500/20">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium">Resource Gap: {role.gapCount} position(s) unavailable</span>
          </div>
        </div>
      )}

      {role.skills && role.skills.length > 0 && (
        <div className="mb-2">
          <div className="text-xs font-medium text-muted-foreground mb-1">Required Skills:</div>
          <div className="flex flex-wrap gap-1">
            {role.skills.slice(0, 5).map((skill, i) => (
              <Badge key={i} variant="secondary" className="text-[10px]">{skill}</Badge>
            ))}
            {role.skills.length > 5 && (
              <Badge variant="outline" className="text-[10px]">+{role.skills.length - 5} more</Badge>
            )}
          </div>
        </div>
      )}

      {role.responsibilities && role.responsibilities.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Key Responsibilities:</div>
          <ul className="text-xs text-foreground/80 space-y-0.5">
            {role.responsibilities.slice(0, 3).map((resp, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-primary mt-0.5">•</span>
                <span>{resp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <Card className="bg-card/60 border-border">
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center gap-4">
            <VideoLogo size="sm" />
            <div className="text-center">
              <div className="font-semibold text-foreground">AI Team Advisor Analyzing...</div>
              <div className="text-sm text-muted-foreground mt-1">Generating optimal team structure recommendations</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !recommendation?.data) {
    return (
      <Card className="bg-card/60 border-border">
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-foreground">Unable to Generate Recommendations</div>
              <div className="text-sm text-muted-foreground mt-1">
                {error instanceof Error ? error.message : "Please try again later"}
              </div>
            </div>
            <Button onClick={() => refetch()} className="gap-2" data-testid="button-retry-team-recommendations">
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = recommendation.data;

  return (
    <div className="space-y-4">
      {/* Header with Summary */}
      <Card className="bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-background border-purple-500/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">AI Team Advisor</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Generated {new Date(data.generatedAt).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                data.summary.overallReadiness === 'ready' ? 'bg-emerald-500/20' :
                data.summary.overallReadiness === 'needs_attention' ? 'bg-amber-500/20' : 'bg-red-500/20'
              }`}>
                {data.summary.overallReadiness === 'ready' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> :
                 data.summary.overallReadiness === 'needs_attention' ? <AlertTriangle className="w-4 h-4 text-amber-500" /> :
                 <AlertCircle className="w-4 h-4 text-red-500" />}
                <span className={`text-sm font-medium ${getReadinessColor(data.summary.overallReadiness)}`}>
                  {data.summary.overallReadiness.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'team-recommendations'] });
                }}
                className="gap-2"
                data-testid="button-refresh-team-recommendations"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 rounded-lg bg-background/50 text-center">
              <div className="text-lg font-bold text-primary">{data.summary.totalRoles}</div>
              <div className="text-xs text-muted-foreground">Total Roles</div>
            </div>
            <div className="p-3 rounded-lg bg-background/50 text-center">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{data.summary.totalHeadcount}</div>
              <div className="text-xs text-muted-foreground">Headcount</div>
            </div>
            <div className="p-3 rounded-lg bg-background/50 text-center">
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{data.summary.totalFTEMonths}</div>
              <div className="text-xs text-muted-foreground">FTE Months</div>
            </div>
            <div className="p-3 rounded-lg bg-background/50 text-center">
              <div className="text-lg font-bold text-red-600 dark:text-red-400">{data.summary.criticalRoles}</div>
              <div className="text-xs text-muted-foreground">Critical Roles</div>
            </div>
            <div className="p-3 rounded-lg bg-background/50 text-center">
              <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{data.summary.resourceGaps}</div>
              <div className="text-xs text-muted-foreground">Resource Gaps</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resource Gaps Alert */}
      {data.resourceGaps && data.resourceGaps.length > 0 && (
        <Card className="bg-red-500/5 border-red-500/20">
          <Collapsible open={expandedSections.gaps} onOpenChange={() => toggleSection('gaps')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-red-500/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <CardTitle className="text-base text-red-600 dark:text-red-400">
                      Resource Gaps Detected ({data.resourceGaps.length})
                    </CardTitle>
                  </div>
                  {expandedSections.gaps ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {data.resourceGaps.map((gap, i) => (
                    <div key={i} className="p-3 bg-background/50 rounded-lg border border-red-500/20">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          {gap.type === 'personnel' ? <Users className="w-4 h-4 text-red-500" /> :
                           gap.type === 'external' ? <Building2 className="w-4 h-4 text-red-500" /> :
                           <Wrench className="w-4 h-4 text-red-500" />}
                          <span className="font-medium text-sm">{gap.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getRiskColor(gap.riskLevel)}>
                            {gap.riskLevel} risk
                          </Badge>
                          <Badge variant="outline" className={getPriorityColor(gap.impact)}>
                            {gap.impact} impact
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">Gap: {gap.gapSize}</div>
                      {gap.recommendations && gap.recommendations.length > 0 && (
                        <div className="mt-2 p-2 bg-amber-500/10 rounded border border-amber-500/20">
                          <div className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
                            <Lightbulb className="w-3 h-3" />
                            Recommendations:
                          </div>
                          <ul className="text-xs text-foreground/80 space-y-0.5">
                            {gap.recommendations.map((rec, j) => (
                              <li key={j} className="flex items-start gap-1">
                                <span className="text-amber-500 mt-0.5">•</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Leadership Roles */}
      {data.teamStructure.leadership && data.teamStructure.leadership.length > 0 && (
        <Card className="bg-card/60 border-border">
          <Collapsible open={expandedSections.leadership} onOpenChange={() => toggleSection('leadership')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-amber-500" />
                    <CardTitle className="text-base">Leadership Team ({data.teamStructure.leadership.length})</CardTitle>
                  </div>
                  {expandedSections.leadership ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid gap-3 md:grid-cols-2">
                  {data.teamStructure.leadership.map((role, i) => renderRoleCard(role, i))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Core Team */}
      {data.teamStructure.core && data.teamStructure.core.length > 0 && (
        <Card className="bg-card/60 border-border">
          <Collapsible open={expandedSections.core} onOpenChange={() => toggleSection('core')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-blue-500" />
                    <CardTitle className="text-base">Core Team ({data.teamStructure.core.length})</CardTitle>
                  </div>
                  {expandedSections.core ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid gap-3 md:grid-cols-2">
                  {data.teamStructure.core.map((role, i) => renderRoleCard(role, i))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Support Team */}
      {data.teamStructure.support && data.teamStructure.support.length > 0 && (
        <Card className="bg-card/60 border-border">
          <Collapsible open={expandedSections.support} onOpenChange={() => toggleSection('support')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserPlus className="w-5 h-5 text-purple-500" />
                    <CardTitle className="text-base">Support Team ({data.teamStructure.support.length})</CardTitle>
                  </div>
                  {expandedSections.support ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid gap-3 md:grid-cols-2">
                  {data.teamStructure.support.map((role, i) => renderRoleCard(role, i))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* External Resources */}
      {data.teamStructure.external && data.teamStructure.external.length > 0 && (
        <Card className="bg-card/60 border-border">
          <Collapsible open={expandedSections.external} onOpenChange={() => toggleSection('external')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-emerald-500" />
                    <CardTitle className="text-base">External Resources ({data.teamStructure.external.length})</CardTitle>
                  </div>
                  {expandedSections.external ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {data.teamStructure.external.map((ext, i) => (
                    <div key={i} className="p-3 bg-muted/30 rounded-lg border border-border/30">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <Badge variant="outline" className="text-xs mb-1">{ext.type}</Badge>
                          <div className="text-sm text-foreground">{ext.description}</div>
                        </div>
                        <Badge variant="outline" className={getPriorityColor(ext.priority)}>
                          {ext.priority}
                        </Badge>
                      </div>
                      {ext.estimatedCost && (
                        <div className="text-xs text-muted-foreground">Est. Cost: {ext.estimatedCost}</div>
                      )}
                      {ext.alternatives && ext.alternatives.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-muted-foreground mb-1">Alternatives:</div>
                          <div className="flex flex-wrap gap-1">
                            {ext.alternatives.map((alt, j) => (
                              <Badge key={j} variant="secondary" className="text-[10px]">{alt}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Recommendations */}
      {data.recommendations && (
        <Card className="bg-gradient-to-br from-emerald-500/5 to-background border-emerald-500/20">
          <Collapsible open={expandedSections.recommendations} onOpenChange={() => toggleSection('recommendations')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-emerald-500/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-emerald-500" />
                    <CardTitle className="text-base">AI Recommendations</CardTitle>
                  </div>
                  {expandedSections.recommendations ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid gap-4 md:grid-cols-3">
                  {data.recommendations.immediate && data.recommendations.immediate.length > 0 && (
                    <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-semibold text-red-600 dark:text-red-400">Immediate Actions</span>
                      </div>
                      <ul className="text-xs text-foreground/80 space-y-1">
                        {data.recommendations.immediate.map((rec, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-red-500 mt-0.5">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.recommendations.shortTerm && data.recommendations.shortTerm.length > 0 && (
                    <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">Short-Term (2-4 weeks)</span>
                      </div>
                      <ul className="text-xs text-foreground/80 space-y-1">
                        {data.recommendations.shortTerm.map((rec, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-amber-500 mt-0.5">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.recommendations.contingency && data.recommendations.contingency.length > 0 && (
                    <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Contingency Plans</span>
                      </div>
                      <ul className="text-xs text-foreground/80 space-y-1">
                        {data.recommendations.contingency.map((rec, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-blue-500 mt-0.5">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Risk Assessment */}
      {data.riskAssessment && (
        <Card className="bg-card/60 border-border">
          <Collapsible open={expandedSections.risks} onOpenChange={() => toggleSection('risks')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                    <CardTitle className="text-base">Risk Assessment</CardTitle>
                    <Badge variant="outline" className={getRiskColor(data.riskAssessment.overallRisk)}>
                      Overall: {data.riskAssessment.overallRisk}
                    </Badge>
                  </div>
                  {expandedSections.risks ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {data.riskAssessment.factors?.map((factor, i) => (
                    <div key={i} className="p-3 bg-muted/30 rounded-lg border border-border/30">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <span className="text-sm font-medium">{factor.factor}</span>
                        <Badge variant="outline" className={getRiskColor(factor.risk)}>{factor.risk}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Mitigation:</span> {factor.mitigation}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}
    </div>
  );
}
