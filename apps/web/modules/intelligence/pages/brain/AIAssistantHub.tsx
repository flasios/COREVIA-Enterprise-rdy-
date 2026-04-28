import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, ArrowRight, Bell, BellOff, BellRing, Bot, Brain,
  Calendar, CheckCircle2, ChevronDown, ChevronRight, Clock, Gavel,
  Inbox, Lightbulb, Mail, MailOpen, MessageCircle, MessageSquare, Monitor, Package,
  Phone as _Phone, Power, PowerOff, RefreshCw, Search, Settings, Shield,
  Sparkles, Target, ToggleLeft, ToggleRight, TrendingUp,
  Users, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from 'react-i18next';
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { DeliveryServicesPanel } from "./DeliveryServicesPanel";

// ── Types ──────────────────────────────────────────────────────────────────

interface NotificationChannel {
  id: string;
  serviceName: string;
  category: string;
  name: string;
  description: string;
  enabled: boolean;
  deliveryMethods: string[];
  config: Record<string, unknown>;
  priority: string;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ChannelStats {
  [channelId: string]: { total24h: number; total7d: number; total30d: number };
}

interface UnifiedNotification {
  id: string;
  source: "system" | "ai" | "tender" | "brain";
  category: string;
  title: string;
  message: string;
  priority: string;
  isRead: boolean;
  isDismissed: boolean;
  actionUrl: string | null;
  relatedType: string | null;
  relatedId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface UnifiedMeta {
  total: number;
  unreadCounts: { system: number; ai: number; tender: number; brain: number };
  totalUnread: number;
}

// ── Icon map (lucide icon name → component) ────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Activity, AlertTriangle, ArrowRight, Bell, BellRing, Bot, Brain, Calendar,
  CheckCircle2, Clock, Gavel, Lightbulb, Mail, MessageSquare,
  Monitor, Package, Shield, Sparkles, Target, TrendingUp, Users, Zap,
};

function getIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Bell;
  return ICON_MAP[name] || Bell;
}

// ── Category display config ────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; icon: LucideIcon; color: string; bg: string; gradient: string }> = {
  pmo: {
    label: "brain.assistant.categories.pmo",
    icon: Users,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    gradient: "from-indigo-500 to-indigo-600",
  },
  demand: {
    label: "brain.assistant.categories.demand",
    icon: Activity,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    gradient: "from-blue-500 to-blue-600",
  },
  communications: {
    label: "brain.assistant.categories.communications",
    icon: MessageSquare,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-50 dark:bg-pink-950/30",
    gradient: "from-pink-500 to-rose-600",
  },
  ai: {
    label: "brain.assistant.categories.ai",
    icon: Brain,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    gradient: "from-violet-500 to-purple-600",
  },
  tender: {
    label: "brain.assistant.categories.tender",
    icon: Package,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    gradient: "from-amber-500 to-orange-600",
  },
  risk: {
    label: "brain.assistant.categories.risk",
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
    gradient: "from-red-500 to-red-600",
  },
  compliance: {
    label: "brain.assistant.categories.compliance",
    icon: Shield,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    gradient: "from-emerald-500 to-green-600",
  },
  system: {
    label: "brain.assistant.categories.system",
    icon: Zap,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    gradient: "from-cyan-500 to-teal-600",
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200",
};

const DELIVERY_ICONS: Record<string, { icon: LucideIcon; label: string; color: string; activeColor: string }> = {
  in_app: { icon: Monitor, label: "brain.assistant.delivery.inApp", color: "text-slate-400", activeColor: "text-blue-600 dark:text-blue-400" },
  email: { icon: Mail, label: "brain.assistant.delivery.email", color: "text-slate-400", activeColor: "text-amber-600 dark:text-amber-400" },
  whatsapp: { icon: MessageCircle, label: "brain.assistant.delivery.whatsapp", color: "text-slate-400", activeColor: "text-emerald-600 dark:text-emerald-400" },
  websocket: { icon: Zap, label: "brain.assistant.delivery.realtime", color: "text-slate-400", activeColor: "text-violet-600 dark:text-violet-400" },
};

// ── Data fetchers ──────────────────────────────────────────────────────────

async function fetchChannels() {
  const res = await fetch("/api/notification-orchestrator/channels");
  if (!res.ok) throw new Error("Failed to fetch channels");
  return res.json() as Promise<{
    success: boolean;
    data: {
      channels: Record<string, NotificationChannel[]>;
      summary: { total: number; enabled: number; disabled: number; categories: string[] };
    };
  }>;
}

async function fetchStats() {
  const res = await fetch("/api/notification-orchestrator/stats");
  if (!res.ok) return {};
  const data = await res.json();
  return data.data as ChannelStats;
}

async function fetchUnifiedNotifications(source?: string) {
  const params = new URLSearchParams();
  params.set("limit", "50");
  if (source && source !== "all") params.set("source", source);
  const res = await fetch(`/api/ai-assistant/unified-notifications?${params}`);
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json() as Promise<{ success: boolean; data: UnifiedNotification[]; meta: UnifiedMeta }>;
}

// ── Main Component ─────────────────────────────────────────────────────────

export function AIAssistantHub() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("channels");
  const [searchQuery, setSearchQuery] = useState("");
  const [configDialogChannel, setConfigDialogChannel] = useState<NotificationChannel | null>(null);

  // Queries
  const { data: channelData, isLoading: channelsLoading, refetch: refetchChannels } = useQuery({
    queryKey: ["/api/notification-orchestrator/channels"],
    queryFn: fetchChannels,
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/notification-orchestrator/stats"],
    queryFn: fetchStats,
    refetchInterval: 60000,
  });

  const { data: notifData, isLoading: notifsLoading } = useQuery({
    queryKey: ["/api/ai-assistant/unified-notifications"],
    queryFn: () => fetchUnifiedNotifications(),
    refetchInterval: 15000,
  });

  // Mutations
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await apiRequest("PATCH", `/api/notification-orchestrator/channels/${id}/toggle`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-orchestrator/channels"] });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: unknown }) => {
      await apiRequest("PATCH", `/api/notification-orchestrator/channels/${id}/config`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-orchestrator/channels"] });
      setConfigDialogChannel(null);
      toast({ title: t('ai.assistantHub.channelConfigUpdated') });
    },
  });

  const deliveryMutation = useMutation({
    mutationFn: async ({ id, deliveryMethods }: { id: string; deliveryMethods: string[] }) => {
      await apiRequest("PATCH", `/api/notification-orchestrator/channels/${id}/config`, { deliveryMethods });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-orchestrator/channels"] });
    },
  });

  const bulkToggleMutation = useMutation({
    mutationFn: async ({ channelIds, enabled }: { channelIds: string[]; enabled: boolean }) => {
      await apiRequest("POST", "/api/notification-orchestrator/channels/bulk-toggle", { channelIds, enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-orchestrator/channels"] });
      toast({ title: t('ai.assistantHub.channelsUpdated') });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/ai-assistant/unified-notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/unified-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: t('ai.assistantHub.allNotificationsRead') });
    },
  });

  const summary = channelData?.data?.summary || { total: 0, enabled: 0, disabled: 0, categories: [] };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const grouped = channelData?.data?.channels || {};
  const meta = notifData?.meta || { total: 0, unreadCounts: { system: 0, ai: 0, tender: 0, brain: 0 }, totalUnread: 0 };
  const allNotifications = notifData?.data || [];

  // Filter channels by search
  const filteredGrouped = useMemo(() => {
    if (!searchQuery.trim()) return grouped;
    const q = searchQuery.toLowerCase();
    const result: Record<string, NotificationChannel[]> = {};
    for (const [cat, channels] of Object.entries(grouped)) {
      const filtered = channels.filter(
        (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
      );
      if (filtered.length > 0) result[cat] = filtered;
    }
    return result;
  }, [grouped, searchQuery]);

  const handleToggle = useCallback((id: string, enabled: boolean) => {
    toggleMutation.mutate({ id, enabled });
  }, [toggleMutation]);

  const handleUpdateDelivery = useCallback((id: string, methods: string[]) => {
    deliveryMutation.mutate({ id, deliveryMethods: methods });
  }, [deliveryMutation]);

  const handleEnableAll = useCallback(() => {
    const allIds = Object.values(grouped).flat().map((c) => c.id);
    bulkToggleMutation.mutate({ channelIds: allIds, enabled: true });
  }, [grouped, bulkToggleMutation]);

  const handleDisableAll = useCallback(() => {
    const allIds = Object.values(grouped).flat().map((c) => c.id);
    bulkToggleMutation.mutate({ channelIds: allIds, enabled: false });
  }, [grouped, bulkToggleMutation]);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-5 py-4 rounded-xl text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, #7c3aed 0%, #2563eb 45%, #0891b2 100%)" }}>
        <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-white/15 shadow-inner">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight">{t('ai.assistantHub.title')}</h1>
          <p className="text-[11px] text-white/70 font-medium">{t('ai.assistantHub.subtitle')}</p>
        </div>
        <Separator orientation="vertical" className="h-6 bg-white/30 mx-2" />
        <div className="flex items-center gap-4 text-sm">
          <HeaderStat icon={Bell} label={t('ai.assistantHub.channels')} value={summary.total} />
          <HeaderStat icon={Power} label={t('ai.assistantHub.activeLabel')} value={summary.enabled} />
          <HeaderStat icon={PowerOff} label={t('ai.assistantHub.mutedLabel')} value={summary.disabled} />
          <HeaderStat icon={BellRing} label={t('ai.assistantHub.unreadLabel')} value={meta.totalUnread} pulse={meta.totalUnread > 0} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/80 hover:text-white hover:bg-white/15 text-xs"
            onClick={() => refetchChannels()}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            {t('ai.assistantHub.refresh')}
          </Button>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 h-auto">
          <TabsTrigger value="channels" className="gap-1.5 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
            <Settings className="h-3.5 w-3.5" />
            {t('ai.assistantHub.channelControl')}
            <Badge variant="outline" className="h-4 px-1 text-[10px] ml-1">{summary.total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
            <Activity className="h-3.5 w-3.5" />
            {t('ai.assistantHub.liveFeed')}
            {meta.totalUnread > 0 && (
              <Badge variant="destructive" className="h-4 px-1 text-[10px] ml-1">{meta.totalUnread}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
            <TrendingUp className="h-3.5 w-3.5" />
            {t('ai.assistantHub.analytics')}
          </TabsTrigger>
          <TabsTrigger value="delivery" className="gap-1.5 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
            <MessageCircle className="h-3.5 w-3.5" />
            {t('ai.assistantHub.deliveryServices')}
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAB 1: Channel Control ═══ */}
        <TabsContent value="channels" className="mt-4 space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={t('ai.assistantHub.searchChannels')}
                className="h-8 pl-8 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Separator orientation="vertical" className="h-6" />
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleEnableAll}>
              <ToggleRight className="h-3.5 w-3.5 text-emerald-500" />
              {t('ai.assistantHub.enableAll')}
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleDisableAll}>
              <ToggleLeft className="h-3.5 w-3.5 text-slate-400" />
              {t('ai.assistantHub.muteAll')}
            </Button>
          </div>

          {/* Channel groups */}
          {channelsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(filteredGrouped).map(([category, channels]) => (
                <ChannelCategoryGroup
                  key={category}
                  category={category}
                  channels={channels}
                  stats={stats || {}}
                  onToggle={handleToggle}
                  onConfigure={setConfigDialogChannel}
                  onBulkToggle={(ids, enabled) => bulkToggleMutation.mutate({ channelIds: ids, enabled })}
                  onUpdateDelivery={handleUpdateDelivery}
                />
              ))}
              {Object.keys(filteredGrouped).length === 0 && (
                <EmptyState icon={Search} title={t('ai.assistantHub.noChannelsFound')} message={t('ai.assistantHub.tryDifferentSearch')} />
              )}
            </div>
          )}
        </TabsContent>

        {/* ═══ TAB 2: Live Feed ═══ */}
        <TabsContent value="activity" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{t('ai.assistantHub.latestNotifications')}</p>
            {meta.totalUnread > 0 && (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => markAllReadMutation.mutate()}>
                <MailOpen className="h-3.5 w-3.5" />
                {t('ai.assistantHub.markAllRead')}
              </Button>
            )}
          </div>
          {notifsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : allNotifications.length === 0 ? (
            <EmptyState icon={Inbox} title={t('ai.assistantHub.allCaughtUp')} message={t('ai.assistantHub.noNotificationsToShow')} />
          ) : (
            <ScrollArea className="h-[calc(100vh-340px)]">
              <div className="space-y-2 pr-4">
                {allNotifications.map((n) => (
                  <LiveNotificationRow key={`${n.source}-${n.id}`} notification={n} />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* ═══ TAB 3: Analytics ═══ */}
        <TabsContent value="analytics" className="mt-4 space-y-4">
          <ChannelAnalytics grouped={grouped} stats={stats || {}} />
        </TabsContent>

        {/* ═══ TAB 4: Delivery Services ═══ */}
        <TabsContent value="delivery" className="mt-4 space-y-4">
          <DeliveryServicesPanel />
        </TabsContent>
      </Tabs>

      {/* ── Channel Config Dialog ── */}
      {configDialogChannel && (
        <ChannelConfigDialog
          channel={configDialogChannel}
          onClose={() => setConfigDialogChannel(null)}
          onSave={(updates) => {
            updateConfigMutation.mutate({ id: configDialogChannel.id, updates });
          }}
          isSaving={updateConfigMutation.isPending}
        />
      )}
    </div>
  );
}

// ── Sub-Components ─────────────────────────────────────────────────────────

function HeaderStat({ icon: Icon, label, value, pulse }: { icon: LucideIcon; label: string; value: number; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10">
      <Icon className={`h-3.5 w-3.5 text-white/80 ${pulse ? "animate-pulse" : ""}`} />
      <span className="text-white/70 text-xs">{label}</span>
      <span className="text-white font-bold font-mono text-sm">{value}</span>
    </div>
  );
}

function ChannelCategoryGroup({
  category,
  channels,
  stats,
  onToggle,
  onConfigure,
  onBulkToggle,
  onUpdateDelivery,
}: {
  category: string;
  channels: NotificationChannel[];
  stats: ChannelStats;
  onToggle: (id: string, enabled: boolean) => void;
  onConfigure: (ch: NotificationChannel) => void;
  onBulkToggle: (ids: string[], enabled: boolean) => void;
  onUpdateDelivery: (id: string, methods: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const { t } = useTranslation();
  const config = (CATEGORY_CONFIG[category] || CATEGORY_CONFIG.system)!;
  const CatIcon = config.icon;
  const enabledCount = channels.filter((c) => c.enabled).length;
  const totalVolume = channels.reduce((sum, c) => {
    const s = stats[c.id];
    return sum + (s?.total24h || 0);
  }, 0);

  return (
    <Card className="overflow-hidden">
      {/* Group header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${config.bg}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${config.gradient}`}>
          <CatIcon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <h3 className={`text-sm font-semibold ${config.color}`}>{t(config.label)}</h3>
          <p className="text-[11px] text-muted-foreground">
            {enabledCount}/{channels.length} {t('ai.assistantHub.active')} · {totalVolume} {t('ai.assistantHub.notificationsToday')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] gap-1"
            onClick={(e) => {
              e.stopPropagation();
              const allEnabled = channels.every((c) => c.enabled);
              onBulkToggle(channels.map((c) => c.id), !allEnabled);
            }}
          >
            {channels.every((c) => c.enabled) ? (
              <><BellOff className="h-3 w-3" /> {t('ai.assistantHub.muteAll')}</>
            ) : (
              <><Bell className="h-3 w-3" /> {t('ai.assistantHub.enableAll')}</>
            )}
          </Button>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Channel rows */}
      {expanded && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {channels.map((channel) => (
            <ChannelRow
              key={channel.id}
              channel={channel}
              stats={stats[channel.id]}
              onToggle={onToggle}
              onConfigure={onConfigure}
              onUpdateDelivery={onUpdateDelivery}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function ChannelRow({
  channel,
  stats,
  onToggle,
  onConfigure,
  onUpdateDelivery,
}: {
  channel: NotificationChannel;
  stats?: { total24h: number; total7d: number; total30d: number };
  onToggle: (id: string, enabled: boolean) => void;
  onConfigure: (ch: NotificationChannel) => void;
  onUpdateDelivery: (id: string, methods: string[]) => void;
}) {
  const ChIcon = getIcon(channel.icon);
  const { t } = useTranslation();
  const deliveryMethods = Array.isArray(channel.deliveryMethods) ? channel.deliveryMethods : [];

  const toggleDelivery = (method: string) => {
    const current = [...deliveryMethods];
    const idx = current.indexOf(method);
    if (idx >= 0) {
      // Don't allow removing the last method
      if (current.length <= 1) return;
      current.splice(idx, 1);
    } else {
      current.push(method);
    }
    onUpdateDelivery(channel.id, current);
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 group transition-colors ${
      channel.enabled
        ? "hover:bg-slate-50 dark:hover:bg-slate-800/50"
        : "opacity-60 bg-slate-50/50 dark:bg-slate-900/50"
    }`}>
      {/* Icon */}
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        channel.enabled ? "bg-slate-100 dark:bg-slate-800" : "bg-slate-200 dark:bg-slate-700"
      }`}>
        <ChIcon className={`h-4 w-4 ${channel.enabled ? "text-slate-700 dark:text-slate-300" : "text-slate-400"}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium truncate">{channel.name}</h4>
          <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${PRIORITY_COLORS[channel.priority] || PRIORITY_COLORS.medium}`}>
            {channel.priority}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-1">{channel.description}</p>
        <span className="text-[10px] text-muted-foreground/60 font-mono">{channel.id}</span>
      </div>

      {/* Delivery Method Toggles - inline for quick access */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {Object.entries(DELIVERY_ICONS).map(([key, { icon: DIcon, label, activeColor }]) => {
          const active = deliveryMethods.includes(key);
          return (
            <button
              key={key}
              onClick={() => toggleDelivery(key)}
              title={`${active ? t('ai.assistantHub.disable') : t('ai.assistantHub.enable')} ${t(label)}`}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                active
                  ? `bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 ${activeColor} shadow-sm`
                  : "bg-transparent border-transparent text-slate-300 dark:text-slate-600 hover:border-slate-200 dark:hover:border-slate-700 hover:text-slate-500"
              }`}
            >
              <DIcon className="h-[18px] w-[18px]" />
              <span className="hidden xl:inline">{t(label)}</span>
            </button>
          );
        })}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-right flex-shrink-0">
        <div className="hidden md:block">
          <p className="text-xs font-mono font-bold">{stats?.total24h ?? "—"}</p>
          <p className="text-[10px] text-muted-foreground">24h</p>
        </div>
        <div className="hidden lg:block">
          <p className="text-xs font-mono font-bold">{stats?.total7d ?? "—"}</p>
          <p className="text-[10px] text-muted-foreground">7d</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onConfigure(channel)}
          title="Configure"
        >
          <Settings className="h-3.5 w-3.5 text-slate-500" />
        </Button>
        <Switch
          checked={channel.enabled}
          onCheckedChange={(checked) => onToggle(channel.id, checked)}
          className="data-[state=checked]:bg-emerald-500"
        />
      </div>
    </div>
  );
}

function LiveNotificationRow({ notification: n }: { notification: UnifiedNotification }) {
  const sourceConfig: Record<string, { dot: string }> = {
    system: { dot: "bg-blue-500" },
    ai: { dot: "bg-violet-500" },
    tender: { dot: "bg-amber-500" },
    brain: { dot: "bg-cyan-500" },
  };
  const sc = (sourceConfig[n.source] || sourceConfig.system)!;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
      n.isRead
        ? "bg-white dark:bg-slate-900"
        : "bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800"
    }`}>
      {!n.isRead && <div className={`h-2 w-2 rounded-full flex-shrink-0 mt-1.5 ${sc.dot}`} />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h4 className="text-xs font-semibold truncate">{n.title}</h4>
          <Badge variant="outline" className={`text-[10px] h-4 px-1 ${PRIORITY_COLORS[n.priority] || PRIORITY_COLORS.medium}`}>
            {n.priority}
          </Badge>
          <Badge variant="outline" className="text-[10px] h-4 px-1 capitalize">{n.source}</Badge>
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-1">{n.message}</p>
        <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}

function ChannelAnalytics({
  grouped,
  stats,
}: {
  grouped: Record<string, NotificationChannel[]>;
  stats: ChannelStats;
}) {
  const categories = Object.entries(grouped);
  const { t } = useTranslation();

  if (categories.length === 0) {
    return <EmptyState icon={TrendingUp} title={t('ai.assistantHub.noAnalyticsYet')} message={t('ai.assistantHub.analyticsWillAppear')} />;;
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(CATEGORY_CONFIG).map(([cat, config]) => {
          const channels = grouped[cat] || [];
          const volume24h = channels.reduce((sum, c) => sum + (stats[c.id]?.total24h || 0), 0);
          const CIcon = config.icon;
          return (
            <Card key={cat}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${config.bg}`}>
                  <CIcon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div>
                  <p className="text-lg font-bold font-mono leading-none">{volume24h}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t(config.label)}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Per-channel breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            {t('ai.assistantHub.channelVolumeBreakdown')}
          </CardTitle>
          <CardDescription className="text-xs">{t('ai.assistantHub.notificationCountsPerChannel')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 text-[11px] text-muted-foreground font-semibold uppercase tracking-wider pb-2 border-b">
              <span>{t('ai.assistantHub.channel')}</span>
              <span className="text-right">24h</span>
              <span className="text-right">7d</span>
              <span className="text-right">30d</span>
            </div>
            {Object.values(grouped).flat().map((ch) => {
              const s = stats[ch.id];
              const ChIcon = getIcon(ch.icon);
              return (
                <div key={ch.id} className="grid grid-cols-[1fr_80px_80px_80px] gap-2 items-center py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <ChIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate font-medium">{ch.name}</span>
                    {!ch.enabled && <Badge variant="outline" className="text-[9px] h-3.5 px-1 bg-slate-100">{t('ai.assistantHub.muted')}</Badge>}
                  </div>
                  <span className="text-right font-mono">{s?.total24h ?? "—"}</span>
                  <span className="text-right font-mono">{s?.total7d ?? "—"}</span>
                  <span className="text-right font-mono">{s?.total30d ?? "—"}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ChannelConfigDialog({
  channel,
  onClose,
  onSave,
  isSaving,
}: {
  channel: NotificationChannel;
  onClose: () => void;
  onSave: (updates: unknown) => void;
  isSaving: boolean;
}) {
  const [priority, setPriority] = useState(channel.priority);
  const { t } = useTranslation();
  const [methods, setMethods] = useState<string[]>(
    Array.isArray(channel.deliveryMethods) ? channel.deliveryMethods : ["in_app"]
  );

  const toggleMethod = (method: string) => {
    setMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Settings className="h-4 w-4" />
            {t('ai.assistantHub.configure')}: {channel.name}
          </DialogTitle>
          <DialogDescription className="text-xs">{channel.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Channel ID */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('ai.assistantHub.channelId')}</label>
            <p className="text-xs font-mono mt-0.5 text-slate-600 dark:text-slate-400">{channel.id}</p>
          </div>

          {/* Service */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('ai.assistantHub.service')}</label>
            <p className="text-xs mt-0.5">{channel.serviceName}</p>
          </div>

          {/* Priority */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('ai.assistantHub.defaultPriority')}</label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">{t('ai.assistantHub.priority.critical')}</SelectItem>
                <SelectItem value="high">{t('ai.assistantHub.priority.high')}</SelectItem>
                <SelectItem value="medium">{t('ai.assistantHub.priority.medium')}</SelectItem>
                <SelectItem value="low">{t('ai.assistantHub.priority.low')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Delivery Methods */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('ai.assistantHub.deliveryMethods')}</label>
            <div className="flex items-center gap-3 mt-2">
              {Object.entries(DELIVERY_ICONS).map(([key, { icon: DIcon, label }]) => {
                const active = methods.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleMethod(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      active
                        ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-300"
                        : "bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700"
                    }`}
                  >
                    <DIcon className="h-3.5 w-3.5" />
                    {t(label)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>{t('ai.assistantHub.cancel')}</Button>
            <Button
              size="sm"
              disabled={isSaving}
              onClick={() => onSave({ priority, deliveryMethods: methods })}
            >
              {isSaving ? t('ai.assistantHub.saving') : t('ai.assistantHub.saveConfiguration')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ icon: Icon, title, message }: { icon: LucideIcon; title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 mb-4">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-xs">{message}</p>
    </div>
  );
}
