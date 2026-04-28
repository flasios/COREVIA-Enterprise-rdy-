import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menu, PanelLeftClose } from "lucide-react";

interface StrategicFitIntelligenceRailProps {
  isFullscreen: boolean;
  showIntelligenceRail: boolean;
  onShowRail: () => void;
  onHideRail: () => void;
  headerContent: ReactNode;
  decisionSpineContent: ReactNode;
}

export function StrategicFitIntelligenceRail({
  isFullscreen,
  showIntelligenceRail,
  onShowRail,
  onHideRail,
  headerContent,
  decisionSpineContent,
}: StrategicFitIntelligenceRailProps) {
  if (isFullscreen) {
    return null;
  }

  if (!showIntelligenceRail) {
    return (
      <div className="flex-shrink-0 h-full flex flex-col border-r bg-muted/20">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 rounded-none border-b"
          onClick={onShowRail}
          data-testid="button-show-intelligence-rail-strategic-fit"
          aria-label="Show Intelligence Rail"
        >
          <span className="sr-only">Show Intelligence Rail</span>
          <Menu className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-[328px] h-full min-h-0 flex-shrink-0 flex flex-col border-r border-slate-200/70 overflow-hidden bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(241,245,249,0.55))] dark:border-slate-800/70 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))]">
      <div className="flex-shrink-0 border-b border-slate-200/70 bg-white/75 text-foreground backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/40">
        <div className="flex items-start justify-between px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none tracking-tight text-foreground">Intelligence Rail</p>
            <p className="mt-1 text-[11px] text-muted-foreground truncate">Decision support, quality, and workflow cockpit</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="h-5 border-emerald-400/30 bg-emerald-500/10 px-1.5 text-[9px] text-emerald-700 dark:text-emerald-300">
              Live
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={onHideRail}
              data-testid="button-hide-intelligence-rail-strategic-fit"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3.5 space-y-3.5">
        <div className="space-y-3" data-testid="intelligence-rail-moved-header-strategic-fit">
          {headerContent}
        </div>

        {decisionSpineContent ? (
          <div data-testid="intelligence-rail-decision-spine-content-strategic-fit">
            {decisionSpineContent}
          </div>
        ) : null}
      </div>
    </div>
  );
}