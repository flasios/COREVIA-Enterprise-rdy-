import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import * as d3 from "d3";
import { 
  Network, 
  Search as _Search, 
  ZoomIn, 
  ZoomOut, 
  Maximize2 as _Maximize2, 
  Filter,
  FileText,
  Link,
  ArrowRight as _ArrowRight,
  Eye,
  Loader2,
  RefreshCw as _RefreshCw,
  Target,
  Sparkles
} from "lucide-react";

interface DocumentNode {
  id: string;
  name: string;
  category: string;
  folderPath: string;
  connections: number;
}

interface DocumentLink {
  source: string | DocumentNode;
  target: string | DocumentNode;
  strength: number;
  type: "category" | "semantic" | "reference";
}

interface D3Node extends DocumentNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface _D3Link extends DocumentLink {
  source: D3Node;
  target: D3Node;
}

interface GraphData {
  nodes: DocumentNode[];
  links: DocumentLink[];
}

interface DocumentRecord {
  id: string;
  filename: string;
  category?: string;
  folderPath?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Business": "#8b5cf6",
  "Human Resources": "#ec4899",
  "Information Technology": "#3b82f6",
  "Operational": "#10b981",
  "Regulatory": "#f59e0b",
  "Research": "#6366f1",
  "Strategic": "#ef4444",
  "Technical": "#14b8a6"
};

export function DocumentConnections() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [selectedNode, setSelectedNode] = useState<DocumentNode | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [_searchQuery, _setSearchQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [zoom, setZoom] = useState(1);

  const { data: documents, isLoading } = useQuery<{ success: boolean; data: DocumentRecord[] }>({
    queryKey: ['/api/knowledge/documents'],
  });

  const analyzeConnections = useCallback(async () => {
    if (!documents?.data) return;
    
    setIsAnalyzing(true);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const nodes: DocumentNode[] = documents.data.slice(0, 30).map(doc => ({
      id: doc.id,
      name: doc.filename,
      category: doc.category || "Unknown",
      folderPath: doc.folderPath || "",
      connections: 0
    }));
    
    const links: DocumentLink[] = [];
    
    nodes.forEach((node, i) => {
      nodes.forEach((other, j) => {
        if (i >= j) return;
        
        if (node.category === other.category) {
          links.push({
            source: node.id,
            target: other.id,
            strength: 0.8,
            type: "category"
          });
          node.connections++;
          other.connections++;
        }
        
        if (node.folderPath && other.folderPath && 
            node.folderPath.split('/')[0] === other.folderPath.split('/')[0]) {
          if (!links.find(l => 
            (l.source === node.id && l.target === other.id) ||
            (l.source === other.id && l.target === node.id)
          )) {
            links.push({
              source: node.id,
              target: other.id,
              strength: 0.6,
              type: "reference"
            });
            node.connections++;
            other.connections++;
          }
        }
        
        const nodeName = node.name.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(' ').filter(w => w.length > 3);
        const otherName = other.name.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(' ').filter(w => w.length > 3);
        const commonWords = nodeName.filter(w => otherName.includes(w));
        const nameSimilarity = commonWords.length / Math.max(nodeName.length, otherName.length, 1);
        
        if (nameSimilarity > 0.3 && !links.find(l => 
          (l.source === node.id && l.target === other.id) ||
          (l.source === other.id && l.target === node.id)
        )) {
          links.push({
            source: node.id,
            target: other.id,
            strength: 0.5 + nameSimilarity * 0.5,
            type: "semantic"
          });
          node.connections++;
          other.connections++;
        }
      });
    });
    
    setGraphData({ nodes, links });
    setIsAnalyzing(false);
    
    toast({
      title: t('knowledge.documentConnections.analysisComplete'),
      description: t('knowledge.documentConnections.analysisCompleteDescription', { links: links.length, nodes: nodes.length }),
    });
  }, [documents, toast, t]);

  useEffect(() => {
    if (documents?.data && !graphData) {
      analyzeConnections();
    }
  }, [documents, graphData, analyzeConnections]);

  useEffect(() => {
    if (!graphData || !svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = 500;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    const g = svg.append("g");

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoom(event.transform.k);
      });

    svg.call(zoomBehavior);

    const filteredNodes = filterCategory === "all" 
      ? graphData.nodes 
      : graphData.nodes.filter(n => n.category === filterCategory);
    
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = graphData.links.filter(
      l => filteredNodeIds.has(l.source as string) && filteredNodeIds.has(l.target as string)
    );

    const simulation = d3.forceSimulation(filteredNodes as unknown as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(filteredLinks as unknown as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
        .id((d) => (d as unknown as DocumentNode).id)
        .distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    const link = g.append("g")
      .selectAll("line")
      .data(filteredLinks)
      .join("line")
      .attr("stroke", d => {
        switch (d.type) {
          case "category": return "#8b5cf6";
          case "semantic": return "#3b82f6";
          case "reference": return "#10b981";
          default: return "#999";
        }
      })
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => d.strength * 2);

    const node = g.append("g")
      .selectAll("g")
      .data(filteredNodes)
      .join("g")
      .attr("cursor", "pointer")
      .call((selection) => {
        const drag = d3.drag<SVGGElement, D3Node>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          });
        (selection as unknown as d3.Selection<SVGGElement, D3Node, SVGGElement, unknown>).call(drag);
      });

    node.append("circle")
      .attr("r", d => 8 + (d.connections * 2))
      .attr("fill", d => CATEGORY_COLORS[d.category] || "#6b7280")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    node.append("text")
      .text(d => d.name.slice(0, 15) + (d.name.length > 15 ? "..." : ""))
      .attr("x", 12)
      .attr("y", 4)
      .attr("font-size", "10px")
      .attr("fill", "currentColor")
      .attr("opacity", 0.8);

    node.on("click", (event, d) => {
      setSelectedNode(d);
    });

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => ((d.source as unknown as D3Node).x) || 0)
        .attr("y1", (d) => ((d.source as unknown as D3Node).y) || 0)
        .attr("x2", (d) => ((d.target as unknown as D3Node).x) || 0)
        .attr("y2", (d) => ((d.target as unknown as D3Node).y) || 0);

      node.attr("transform", (d) => `translate(${(d as unknown as D3Node).x || 0},${(d as unknown as D3Node).y || 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, filterCategory]);

  const categories = graphData 
    ? Array.from(new Set(graphData.nodes.map(n => n.category))) 
    : [];

  const connectedDocs = selectedNode && graphData
    ? graphData.links
        .filter(l => l.source === selectedNode.id || l.target === selectedNode.id)
        .map(l => {
          const otherId = l.source === selectedNode.id ? l.target : l.source;
          const otherNode = graphData.nodes.find(n => n.id === otherId);
          return { ...l, node: otherNode };
        })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />
            {t('knowledge.documentConnections.title')}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t('knowledge.documentConnections.subtitle')}
          </p>
        </div>
        <Button 
          onClick={analyzeConnections}
          disabled={isAnalyzing}
          data-testid="button-analyze"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('knowledge.documentConnections.analyzing')}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              {t('knowledge.documentConnections.reanalyze')}
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t('knowledge.documentConnections.connectionGraph')}</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-[180px]" data-testid="select-filter-category">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder={t('knowledge.documentConnections.filterByCategory')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('knowledge.documentConnections.allCategories')}</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: CATEGORY_COLORS[cat] || "#6b7280" }}
                            />
                            {cat}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <ZoomOut className="h-4 w-4" />
                    {Math.round(zoom * 100)}%
                    <ZoomIn className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div 
                ref={containerRef}
                className="border rounded-lg bg-muted/20 relative overflow-hidden"
                style={{ height: 500 }}
              >
                {isLoading || isAnalyzing ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <p className="text-sm text-muted-foreground mt-2">
                        {isAnalyzing ? t('knowledge.documentConnections.analyzingConnections') : t('knowledge.documentConnections.loadingDocuments')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <svg ref={svgRef} className="w-full h-full" />
                )}
              </div>
              
              <div className="flex items-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-purple-500" />
                  <span className="text-muted-foreground">{t('knowledge.documentConnections.sameCategory')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-blue-500" />
                  <span className="text-muted-foreground">{t('knowledge.documentConnections.semanticSimilarity')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-emerald-500" />
                  <span className="text-muted-foreground">{t('knowledge.documentConnections.sameClassification')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                {t('knowledge.documentConnections.selectedDocument')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedNode ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm truncate" title={selectedNode.name}>
                      {selectedNode.name}
                    </h4>
                    <Badge 
                      variant="secondary" 
                      className="mt-1"
                      style={{ 
                        backgroundColor: `${CATEGORY_COLORS[selectedNode.category]}20`,
                        color: CATEGORY_COLORS[selectedNode.category]
                      }}
                    >
                      {selectedNode.category}
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Link className="h-3 w-3" />
                      {t('knowledge.documentConnections.connections', { count: selectedNode.connections })}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <FileText className="h-3 w-3" />
                      {selectedNode.folderPath || t('knowledge.documentConnections.noFolder')}
                    </div>
                  </div>
                  
                  <Button size="sm" className="w-full" variant="outline">
                    <Eye className="h-4 w-4 mr-2" />
                    {t('knowledge.documentConnections.viewDocument')}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <Network className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('knowledge.documentConnections.clickNodeToSee')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedNode && connectedDocs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link className="h-5 w-5" />
                  {t('knowledge.documentConnections.relatedDocuments')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {connectedDocs.map((conn, i) => (
                      <div 
                        key={i}
                        className="p-2 bg-muted/30 rounded-lg text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => conn.node && setSelectedNode(conn.node)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate flex-1" title={conn.node?.name}>
                            {conn.node?.name}
                          </span>
                          <Badge variant="outline" className="ml-2 flex-shrink-0">
                            {conn.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: CATEGORY_COLORS[conn.node?.category || ""] || "#6b7280" }}
                          />
                          {conn.node?.category}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          <Card className="bg-gradient-to-br from-primary/5 to-blue-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-primary" />
                <div>
                  <h4 className="font-semibold text-sm">{t('knowledge.documentConnections.aiInsight')}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('knowledge.documentConnections.aiInsightDescription')}
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
