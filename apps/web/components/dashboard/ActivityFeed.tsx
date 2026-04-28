import { useQuery } from "@tanstack/react-query";
import { memo, useState } from "react";
import { useTranslation } from 'react-i18next';
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import {
  FileText, Zap, CheckCircle2, AlertTriangle,
  Clock, XCircle, ArrowRight, Activity, Sparkles,
  ChevronDown, ChevronUp, FolderOpen, TrendingUp,
} from "lucide-react";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuthorization } from "@/hooks/useAuthorization";

/* ── Fetch Functions ── */
async function fetchActivityFeed(canAccessBrain: boolean) {
  const [decisionsRes, demandsRes] = await Promise.all([
    canAccessBrain
      ? fetch("/api/corevia/decisions?limit=10").then((r) => (r.ok ? r.json() : { decisions: [] }))
      : Promise.resolve({ decisions: [] }),
    fetch("/api/demands?limit=10").then((r) => (r.ok ? r.json() : { data: [] })),
  ]);

  const decisions = (decisionsRes.decisions || []).map((d: Record<string, unknown>) => ({
    id: `decision-${d.id}`,
    type: "decision" as const,
    title: (d.title as string) || `Decision #${d.id}`,
    status: (d.status as string) || "unknown",
    serviceId: d.serviceId as string,
    timestamp: d.createdAt as string || d.updatedAt as string,
    href: `/brain-console/decisions/${d.id}`,
    classification: d.classification as string,
  }));

  const demands = (demandsRes.data || demandsRes.demands || []).map((d: Record<string, unknown>) => ({
    id: `demand-${d.id}`,
    type: "demand" as const,
    title: (d.projectName as string) || (d.title as string) || `Demand #${d.id}`,
    status: (d.status as string) || "submitted",
    department: d.department as string,
    timestamp: d.createdAt as string || d.updatedAt as string,
    href: `/demand-reports/${d.id}`,
  }));

  return [...decisions, ...demands]
    .sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 15);
}

/* ── Status Config ── */
function getStatusMeta(status: string) {
  const s = status.toLowerCase().replace(/[_-]/g, "");
  if (s.includes("complete") || s.includes("concluded") || s.includes("approved"))
    return { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "dashboard.activityFeed.status.completed" };
  if (s.includes("processing") || s.includes("inprogress") || s.includes("running"))
    return { icon: <Zap className="h-3.5 w-3.5" />, color: "text-blue-500", bg: "bg-blue-500/10", label: "dashboard.activityFeed.status.processing" };
  if (s.includes("pending") || s.includes("review") || s.includes("validation"))
    return { icon: <Clock className="h-3.5 w-3.5" />, color: "text-amber-500", bg: "bg-amber-500/10", label: "dashboard.activityFeed.status.pending" };
  if (s.includes("blocked") || s.includes("rejected") || s.includes("failed"))
    return { icon: <XCircle className="h-3.5 w-3.5" />, color: "text-red-500", bg: "bg-red-500/10", label: "dashboard.activityFeed.status.blocked" };
  if (s.includes("need") || s.includes("info"))
    return { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "text-orange-500", bg: "bg-orange-500/10", label: "dashboard.activityFeed.status.needsInfo" };
  if (s.includes("submitted") || s.includes("new"))
    return { icon: <Sparkles className="h-3.5 w-3.5" />, color: "text-violet-500", bg: "bg-violet-500/10", label: "dashboard.activityFeed.status.new" };
  return { icon: <Activity className="h-3.5 w-3.5" />, color: "text-slate-500", bg: "bg-slate-500/10", label: status };
}

function getTypeIcon(type: string) {
  if (type === "decision") return <HexagonLogoFrame px={16} />;
  if (type === "demand") return <FolderOpen className="h-4 w-4 text-blue-500" />;
  return <FileText className="h-4 w-4 text-slate-500" />;
}

/* ── Activity Item ── */
interface ActivityItem {
  id: string;
  type: "decision" | "demand";
  title: string;
  status: string;
  timestamp?: string;
  href: string;
  serviceId?: string;
  department?: string;
  classification?: string;
}

function ActivityRow({ item, onClick }: { item: ActivityItem; onClick: () => void }) {
  const { t } = useTranslation();
  const statusMeta = getStatusMeta(item.status);
  const timeAgo = item.timestamp
    ? formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })
    : "";

  return (
    <button
      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left group"
      onClick={onClick}
    >
      {/* Timeline dot */}
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${statusMeta.bg}`}>
          {getTypeIcon(item.type)}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate text-foreground">
            {item.title}
          </span>
          <Badge
            variant="outline"
            className={`shrink-0 text-[9px] px-1.5 py-0 h-4 border-0 font-semibold ${statusMeta.color} ${statusMeta.bg}`}
          >
            {t(statusMeta.label)}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="capitalize">{t(`dashboard.activityFeed.type.${item.type}`)}</span>
          {item.serviceId && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="truncate">{item.serviceId}</span>
            </>
          )}
          {item.department && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="truncate">{item.department}</span>
            </>
          )}
          {item.classification && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="uppercase text-[9px] font-mono">{item.classification}</span>
            </>
          )}
        </div>
        {timeAgo && (
          <div className="text-[10px] text-muted-foreground/60">{timeAgo}</div>
        )}
      </div>

      {/* Arrow */}
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0 mt-1" />
    </button>
  );
}

/* ── Summary Stats ── */
function SummaryStats({ items }: { items: ActivityItem[] }) {
  const { t } = useTranslation();
  const decisions = items.filter((i) => i.type === "decision");
  const demands = items.filter((i) => i.type === "demand");
  const completed = items.filter((i) => {
    const s = i.status.toLowerCase();
    return s.includes("complete") || s.includes("concluded") || s.includes("approved");
  });
  const pending = items.filter((i) => {
    const s = i.status.toLowerCase();
    return s.includes("pending") || s.includes("review") || s.includes("need") || s.includes("blocked");
  });

  const stats = [
    { label: t('dashboard.activityFeed.stats.decisions'), value: decisions.length, icon: <HexagonLogoFrame px={12} /> },
    { label: t('dashboard.activityFeed.stats.demands'), value: demands.length, icon: <FolderOpen className="h-3 w-3 text-blue-500" /> },
    { label: t('dashboard.activityFeed.stats.completed'), value: completed.length, icon: <CheckCircle2 className="h-3 w-3 text-emerald-500" /> },
    { label: t('dashboard.activityFeed.stats.attention'), value: pending.length, icon: <AlertTriangle className="h-3 w-3 text-amber-500" /> },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 px-3 py-2">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted/40"
        >
          {s.icon}
          <div>
            <div className="text-xs font-bold leading-none">{s.value}</div>
            <div className="text-[9px] text-muted-foreground">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main Component ── */
function ActivityFeed() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [expanded, setExpanded] = useState(true);
  const { canAccess: canAccessBrain } = useAuthorization({ requiredPermissions: ["brain:view"] });

  const { data: activities, isLoading } = useQuery({
    queryKey: ["/dashboard/activity-feed"],
    queryFn: () => fetchActivityFeed(canAccessBrain),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const items = activities || [];

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-foreground">{t('dashboard.activityFeed.title')}</h3>
            <p className="text-[10px] text-muted-foreground">{t('dashboard.activityFeed.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5">
              {t('dashboard.activityFeed.itemsCount', { count: items.length })}
            </Badge>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <>
          {/* Summary Stats */}
          {items.length > 0 && (
            <>
              <SummaryStats items={items} />
              <Separator />
            </>
          )}

          {/* Activity List */}
          <ScrollArea className="max-h-[380px]">
            <div className="p-1.5 space-y-0.5">
              {isLoading ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="h-8 w-8 rounded-lg bg-muted" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 bg-muted rounded w-3/4" />
                        <div className="h-2.5 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">{t('dashboard.activityFeed.noActivity')}</p>
                  <p className="text-xs text-muted-foreground/60">
                    {t('dashboard.activityFeed.noActivityHint')}
                  </p>
                </div>
              ) : (
                items.map((item) => (
                  <ActivityRow
                    key={item.id}
                    item={item}
                    onClick={() => setLocation(item.href)}
                  />
                ))
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          {items.length > 0 && (
            <>
              <Separator />
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t('dashboard.activityFeed.liveUpdates')}
                </span>
                {canAccessBrain ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-2"
                    onClick={() => setLocation("/brain-console/decisions")}
                  >
                    {t('dashboard.activityFeed.viewAll')}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default memo(ActivityFeed);
