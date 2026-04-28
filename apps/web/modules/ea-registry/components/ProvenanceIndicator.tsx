import { Sparkles, User, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface ProvenanceIndicatorProps {
  sourceType?: string | null;
  sourceDemandId?: string | null;
  confidenceScore?: number | null;
}

export function ProvenanceIndicator({ sourceType, sourceDemandId, confidenceScore }: ProvenanceIndicatorProps) {
  if (sourceType === "demand_ingested") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="text-xs gap-1 bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
            >
              <Sparkles className="h-3 w-3" />
              Demand Ingested
              {confidenceScore != null && (
                <span className="ml-1 px-1 py-0.5 rounded bg-indigo-200/60 dark:bg-indigo-800/60 text-[10px] font-mono">
                  {confidenceScore}%
                </span>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="text-xs space-y-1">
              <p className="font-medium flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-indigo-500" />
                Auto-ingested from approved demand report
              </p>
              {sourceDemandId && (
                <p className="text-muted-foreground flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Source: DR-{sourceDemandId.slice(0, 8)}
                </p>
              )}
              {confidenceScore != null && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">AI Confidence:</span>
                  <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full">
                    <div
                      className={`h-1.5 rounded-full ${
                        confidenceScore >= 80 ? "bg-emerald-500" :
                        confidenceScore >= 60 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${confidenceScore}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px]">{confidenceScore}%</span>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (sourceType === "manual") {
    return (
      <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
        <User className="h-3 w-3" />
        Manual
      </Badge>
    );
  }

  return null;
}
