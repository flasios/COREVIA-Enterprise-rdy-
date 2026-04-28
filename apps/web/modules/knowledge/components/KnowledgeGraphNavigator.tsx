import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Network, Search, Filter, RefreshCw, Loader2, 
  GitBranch, CircleDot, ArrowRight, Check, X as _X,
  ZoomIn, ZoomOut, Maximize2, FileText, Building2,
  User, Cpu, Activity, Target, AlertTriangle, FileCheck
} from "lucide-react";
import type { KnowledgeEntity, KnowledgeRelationship } from "@shared/schema";

const ENTITY_TYPE_COLORS: Record<string, string> = {
  document: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  policy: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  regulation: "bg-red-500/20 text-red-400 border-red-500/30",
  project: "bg-green-500/20 text-green-400 border-green-500/30",
  initiative: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  department: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  person: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  technology: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  process: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  kpi: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  risk: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  requirement: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  standard: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  framework: "bg-sky-500/20 text-sky-400 border-sky-500/30",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ENTITY_TYPE_ICONS: Record<string, any> = {
  document: FileText,
  policy: FileCheck,
  regulation: AlertTriangle,
  project: Target,
  initiative: Activity,
  department: Building2,
  person: User,
  technology: Cpu,
  process: GitBranch,
  kpi: Activity,
  risk: AlertTriangle,
  requirement: FileCheck,
  standard: FileCheck,
  framework: Network,
};

interface GraphStats {
  totalEntities: number;
  totalRelationships: number;
  entityTypeDistribution: Record<string, number>;
  relationshipTypeDistribution: Record<string, number>;
  topConnectedEntities: Array<{ id: string; name: string; connections: number }>;
}

interface GraphData {
  entities: KnowledgeEntity[];
  relationships: KnowledgeRelationship[];
}

interface EntityDetails {
  entity: KnowledgeEntity;
  incomingRelationships: KnowledgeRelationship[];
  outgoingRelationships: KnowledgeRelationship[];
  relatedEntities: KnowledgeEntity[];
}

export function KnowledgeGraphNavigator() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const { data: graphStatsResponse, isLoading: statsLoading, error: _statsError } = useQuery<{ success: boolean; data: GraphStats }>({
    queryKey: ["/api/knowledge/graph/stats"],
    queryFn: async () => {
      const response = await fetch("/api/knowledge/graph/stats", { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text() || response.statusText}`);
      }
      return response.json();
    },
    retry: false,
  });

  const { data: graphDataResponse, isLoading: graphLoading, refetch: refetchGraph, error: _graphError } = useQuery<{ success: boolean; data: GraphData }>({
    queryKey: ["/api/knowledge/graph", selectedType, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedType && selectedType !== "all") params.append("entityTypes", selectedType);
      if (searchTerm) params.append("search", searchTerm);
      params.append("limit", "100");
      const response = await fetch(`/api/knowledge/graph?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text() || response.statusText}`);
      }
      return response.json();
    },
    retry: false,
  });

  const { data: entityDetailsResponse, isLoading: detailsLoading, error: _detailsError } = useQuery<{ success: boolean; data: EntityDetails }>({
    queryKey: ["/api/knowledge/graph/entity", selectedEntity],
    enabled: !!selectedEntity,
    queryFn: async () => {
      const response = await fetch(`/api/knowledge/graph/entity/${selectedEntity}`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text() || response.statusText}`);
      }
      return response.json();
    },
    retry: false,
  });

  const stats = graphStatsResponse?.success ? graphStatsResponse.data : null;
   
  const graphData = graphDataResponse?.success ? graphDataResponse.data : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entities = graphData?.entities || [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const relationships = graphData?.relationships || [];
  const details = entityDetailsResponse?.success ? entityDetailsResponse.data : null;

  const verifyEntityMutation = useMutation({
    mutationFn: async (entityId: string) => {
      return apiRequest("POST", `/api/knowledge/graph/entity/${entityId}/verify`);
    },
    onSuccess: () => {
      toast({ title: t('knowledge.graphNavigator.entityVerified') });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/graph"] });
      if (selectedEntity) {
        queryClient.invalidateQueries({ queryKey: ["/api/knowledge/graph/entity", selectedEntity] });
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({ 
        title: t('knowledge.graphNavigator.failedToVerify'), 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const entityTypes = useMemo(() => {
    const types = new Set<string>();
    entities.forEach(e => types.add(e.entityType));
    return Array.from(types).sort();
  }, [entities]);

  const getEntityIcon = useCallback((type: string) => {
    const Icon = ENTITY_TYPE_ICONS[type] || CircleDot;
    return Icon;
  }, []);

  const getRelationshipsForEntity = useCallback((entityId: string) => {
    return {
      outgoing: relationships.filter(r => r.sourceEntityId === entityId),
      incoming: relationships.filter(r => r.targetEntityId === entityId),
    };
  }, [relationships]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Network className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{t('knowledge.graphNavigator.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('knowledge.graphNavigator.subtitle')}
            </p>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => refetchGraph()}
          className="gap-2"
          data-testid="button-refresh-graph"
        >
          <RefreshCw className="h-4 w-4" />
          {t('knowledge.graphNavigator.refresh')}
        </Button>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="border-violet-500/20 bg-violet-500/5">
            <CardContent className="pt-4">
              <div className="text-3xl font-bold text-violet-400">{stats.totalEntities}</div>
              <div className="text-sm text-muted-foreground">{t('knowledge.graphNavigator.totalEntities')}</div>
            </CardContent>
          </Card>
          <Card className="border-cyan-500/20 bg-cyan-500/5">
            <CardContent className="pt-4">
              <div className="text-3xl font-bold text-cyan-400">{stats.totalRelationships}</div>
              <div className="text-sm text-muted-foreground">{t('knowledge.graphNavigator.relationships')}</div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="pt-4">
              <div className="text-3xl font-bold text-amber-400">
                {Object.keys(stats.entityTypeDistribution).length}
              </div>
              <div className="text-sm text-muted-foreground">{t('knowledge.graphNavigator.entityTypes')}</div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="pt-4">
              <div className="text-3xl font-bold text-emerald-400">
                {stats.topConnectedEntities?.[0]?.connections || 0}
              </div>
              <div className="text-sm text-muted-foreground">{t('knowledge.graphNavigator.maxConnections')}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('knowledge.graphNavigator.searchEntities')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-entities"
          />
        </div>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-48" data-testid="select-entity-type">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder={t('knowledge.graphNavigator.filterByType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('knowledge.graphNavigator.allTypes')}</SelectItem>
            {entityTypes.map(type => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card className="h-[600px] overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t('knowledge.graphNavigator.entityNetwork')}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">{Math.round(zoom * 100)}%</span>
                  <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setZoom(1)}>
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100%-4rem)]">
              {graphLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : entities.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Network className="h-16 w-16 mb-4 opacity-30" />
                  <p>{t('knowledge.graphNavigator.noEntitiesFound')}</p>
                  <p className="text-sm">{t('knowledge.graphNavigator.uploadDocuments')}</p>
                </div>
              ) : (
                <ScrollArea className="h-full p-4">
                  <div 
                    className="grid grid-cols-3 gap-3"
                    style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
                  >
                    <TooltipProvider>
                      {entities.map((entity) => {
                        const Icon = getEntityIcon(entity.entityType);
                        const rels = getRelationshipsForEntity(entity.id);
                        const connectionCount = rels.outgoing.length + rels.incoming.length;
                        
                        return (
                          <Tooltip key={entity.id}>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                className={`h-auto p-3 flex flex-col items-start gap-2 text-left ${
                                  selectedEntity === entity.id ? "ring-2 ring-primary" : ""
                                } ${ENTITY_TYPE_COLORS[entity.entityType] || ""}`}
                                onClick={() => setSelectedEntity(entity.id)}
                                data-testid={`button-entity-${entity.id}`}
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <Icon className="h-4 w-4 shrink-0" />
                                  <span className="font-medium truncate flex-1">{entity.name}</span>
                                  {entity.isVerified && (
                                    <Check className="h-3 w-3 text-green-500" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs opacity-70">
                                  <Badge variant="secondary" className="text-[10px] px-1">
                                    {entity.entityType}
                                  </Badge>
                                  <span>{connectionCount} {t('knowledge.graphNavigator.connections')}</span>
                                </div>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              <p className="font-medium">{entity.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {entity.description || t('knowledge.graphNavigator.noDescription')}
                              </p>
                              <p className="text-xs mt-1">
                                {t('knowledge.graphNavigator.confidence')}: {Math.round((entity.confidence || 0) * 100)}%
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </TooltipProvider>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-[600px] overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{t('knowledge.graphNavigator.entityDetails')}</CardTitle>
              <CardDescription>
                {selectedEntity ? t('knowledge.graphNavigator.viewRelationships') : t('knowledge.graphNavigator.selectEntity')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100%-5rem)]">
              {!selectedEntity ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <CircleDot className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">{t('knowledge.graphNavigator.clickEntityToSee')}</p>
                </div>
              ) : detailsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : details ? (
                <ScrollArea className="h-full px-4 pb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const Icon = getEntityIcon(details.entity.entityType);
                          return <Icon className="h-5 w-5" />;
                        })()}
                        <h3 className="font-semibold">{details.entity.name}</h3>
                      </div>
                      <Badge className={ENTITY_TYPE_COLORS[details.entity.entityType]}>
                        {details.entity.entityType}
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        {details.entity.description || t('knowledge.graphNavigator.noDescriptionAvailable')}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{t('knowledge.graphNavigator.confidence')}: {Math.round((details.entity.confidence || 0) * 100)}%</span>
                        <span>{t('knowledge.graphNavigator.usage')}: {details.entity.usageCount || 0}</span>
                      </div>
                      
                      {!details.entity.isVerified && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 gap-2"
                          onClick={() => verifyEntityMutation.mutate(details.entity.id)}
                          disabled={verifyEntityMutation.isPending}
                          data-testid="button-verify-entity"
                        >
                          {verifyEntityMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          {t('knowledge.graphNavigator.verifyEntity')}
                        </Button>
                      )}
                    </div>

                    {details.outgoingRelationships.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <ArrowRight className="h-3 w-3" />
                          {t('knowledge.graphNavigator.outgoing')} ({details.outgoingRelationships.length})
                        </h4>
                        <div className="space-y-1">
                          {details.outgoingRelationships.map(rel => {
                            const target = details.relatedEntities.find(e => e.id === rel.targetEntityId);
                            return (
                              <div 
                                key={rel.id} 
                                className="text-xs p-2 rounded-md bg-muted/50 flex items-center gap-2"
                              >
                                <Badge variant="outline" className="text-[10px]">
                                  {rel.relationshipType}
                                </Badge>
                                <span className="truncate">{target?.name || t('knowledge.graphNavigator.unknown')}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {details.incomingRelationships.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <ArrowRight className="h-3 w-3 rotate-180" />
                          {t('knowledge.graphNavigator.incoming')} ({details.incomingRelationships.length})
                        </h4>
                        <div className="space-y-1">
                          {details.incomingRelationships.map(rel => {
                            const source = details.relatedEntities.find(e => e.id === rel.sourceEntityId);
                            return (
                              <div 
                                key={rel.id} 
                                className="text-xs p-2 rounded-md bg-muted/50 flex items-center gap-2"
                              >
                                <span className="truncate">{source?.name || t('knowledge.graphNavigator.unknown')}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {rel.relationshipType}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {details.relatedEntities.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">
                          {t('knowledge.graphNavigator.relatedEntities')} ({details.relatedEntities.length})
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {details.relatedEntities.map(e => (
                            <Badge 
                              key={e.id} 
                              variant="secondary" 
                              className="cursor-pointer hover-elevate"
                              onClick={() => setSelectedEntity(e.id)}
                            >
                              {e.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      {stats && Object.keys(stats.entityTypeDistribution).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t('knowledge.graphNavigator.entityTypeDistribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.entityTypeDistribution)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => {
                  const Icon = ENTITY_TYPE_ICONS[type] || CircleDot;
                  return (
                    <Badge 
                      key={type} 
                      className={`gap-2 py-1.5 px-3 ${ENTITY_TYPE_COLORS[type] || ""}`}
                    >
                      <Icon className="h-3 w-3" />
                      {type}: {count}
                    </Badge>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
