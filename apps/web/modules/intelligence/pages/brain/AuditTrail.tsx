import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ScrollText,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock as _Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Activity,
  Layers,
  Filter,
  Calendar as _Calendar,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface BrainEvent {
  eventId: number;
  occurredAt: string;
  correlationId: string | null;
  decisionSpineId: string | null;
  requestId: string | null;
  eventType: string;
  actorId: string | null;
  payload: Record<string, unknown>;
}

function EventTypeBadge({ eventType }: { eventType: string }) {
  if (eventType.includes("blocked")) {
    return (
      <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
        <ShieldAlert className="h-3 w-3 mr-1" />
        {eventType}
      </Badge>
    );
  }
  if (eventType.includes("allowed") || eventType.includes("completed")) {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
        <ShieldCheck className="h-3 w-3 mr-1" />
        {eventType}
      </Badge>
    );
  }
  if (eventType.includes("failed") || eventType.includes("error")) {
    return (
      <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
        <AlertTriangle className="h-3 w-3 mr-1" />
        {eventType}
      </Badge>
    );
  }
  if (eventType.includes("monitor")) {
    return (
      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
        <Eye className="h-3 w-3 mr-1" />
        {eventType}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Activity className="h-3 w-3 mr-1" />
      {eventType}
    </Badge>
  );
}

async function fetchAuditTrail(params: {
  limit: number;
  offset: number;
  eventType?: string;
  decisionSpineId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ events: BrainEvent[]; total: number }> {
  const sp = new URLSearchParams();
  sp.set("limit", String(params.limit));
  sp.set("offset", String(params.offset));
  if (params.eventType && params.eventType !== "all") sp.set("eventType", params.eventType);
  if (params.decisionSpineId) sp.set("decisionSpineId", params.decisionSpineId);
  if (params.dateFrom) sp.set("dateFrom", params.dateFrom);
  if (params.dateTo) sp.set("dateTo", params.dateTo);
  const res = await fetch(`/api/corevia/audit-trail?${sp}`);
  if (!res.ok) throw new Error("Failed to fetch audit trail");
  return res.json();
}

async function fetchEventTypes(): Promise<string[]> {
  const res = await fetch("/api/corevia/audit-trail/event-types");
  if (!res.ok) return [];
  const data = await res.json();
  return data.eventTypes || [];
}

async function fetchTodaySummary(): Promise<{
  totalToday: number;
  blocked: number;
  allowed: number;
  errors: number;
  totalAll: number;
  blockedAll: number;
  allowedAll: number;
  errorsAll: number;
  latestEventAt: string | null;
}> {
  const res = await fetch("/api/corevia/audit-trail/today-summary");
  if (!res.ok) return { totalToday: 0, blocked: 0, allowed: 0, errors: 0, totalAll: 0, blockedAll: 0, allowedAll: 0, errorsAll: 0, latestEventAt: null };
  const data = await res.json();
  return data.summary;
}

export function AuditTrail() {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [searchDecisionId, setSearchDecisionId] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<BrainEvent | null>(null);
  const pageSize = 25;

  const { data: eventTypes } = useQuery({
    queryKey: ["audit-event-types"],
    queryFn: fetchEventTypes,
  });

  const { data: todaySummary } = useQuery({
    queryKey: ["audit-today-summary"],
    queryFn: fetchTodaySummary,
    refetchInterval: 30000,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["audit-trail", page, eventTypeFilter, searchDecisionId],
    queryFn: () =>
      fetchAuditTrail({
        limit: pageSize,
        offset: page * pageSize,
        eventType: eventTypeFilter !== "all" ? eventTypeFilter : undefined,
        decisionSpineId: searchDecisionId || undefined,
      }),
    refetchInterval: 15000,
  });

  const events = data?.events || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-2xl border bg-[linear-gradient(135deg,hsl(var(--brain-console-ice))_0%,hsl(var(--brain-surface))_55%,hsl(var(--brain-console-ash))_100%)] p-6">
        <div className="absolute right-0 top-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full bg-[radial-gradient(circle,hsl(var(--brain-console-copper)/0.2)_0%,transparent_70%)]" />
        <div className="absolute left-0 bottom-0 h-36 w-36 -translate-x-12 translate-y-10 rounded-full bg-[radial-gradient(circle,hsl(var(--brain-console-teal)/0.2)_0%,transparent_70%)]" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-overline text-muted-foreground">{t('brain.audit.governanceAssurance')}</p>
            <h1 className="text-2xl font-bold">{t('brain.audit.title')}</h1>
            <p className="text-muted-foreground">
              {t('brain.audit.description')}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('app.refresh')}
          </Button>
        </div>
      </section>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ScrollText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('brain.audit.totalEvents')}</p>
                <p className="text-2xl font-bold">{todaySummary?.totalAll ?? 0}</p>
                <p className="text-xs text-muted-foreground">{t('brain.audit.todayEvents')}: {todaySummary?.totalToday ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('brain.audit.allowed')}</p>
                <p className="text-2xl font-bold text-emerald-600">{todaySummary?.allowedAll ?? 0}</p>
                <p className="text-xs text-muted-foreground">{t('brain.audit.todayEvents')}: {todaySummary?.allowed ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('brain.audit.blocked')}</p>
                <p className="text-2xl font-bold text-red-600">{todaySummary?.blockedAll ?? 0}</p>
                <p className="text-xs text-muted-foreground">{t('brain.audit.todayEvents')}: {todaySummary?.blocked ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('brain.audit.errors')}</p>
                <p className="text-2xl font-bold text-orange-600">{todaySummary?.errorsAll ?? 0}</p>
                <p className="text-xs text-muted-foreground">{t('brain.audit.todayEvents')}: {todaySummary?.errors ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t('brain.audit.filters')}</span>
            </div>
            <Select value={eventTypeFilter} onValueChange={(v) => { setEventTypeFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All Event Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('brain.audit.allEventTypes')}</SelectItem>
                {(eventTypes || []).map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Decision ID..."
                className="pl-10 w-[260px] font-mono text-sm"
                value={searchDecisionId}
                onChange={(e) => { setSearchDecisionId(e.target.value); setPage(0); }}
              />
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              {total.toLocaleString()} {t('brain.audit.totalEvents')}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('brain.audit.eventLog')}</CardTitle>
          <CardDescription>
            {t('brain.audit.eventLogDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{t('brain.audit.noEvents')}</p>
              <p className="text-sm mt-1">{t('brain.audit.noEventsDescription')}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">#</TableHead>
                    <TableHead className="w-[160px]">{t('brain.audit.timestamp')}</TableHead>
                    <TableHead className="w-[220px]">{t('brain.audit.eventType')}</TableHead>
                    <TableHead className="w-[180px]">{t('brain.audit.decision')}</TableHead>
                    <TableHead className="w-[120px]">{t('brain.audit.actor')}</TableHead>
                    <TableHead>{t('brain.audit.details')}</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.eventId} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedEvent(event)}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {event.eventId}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">
                            {format(new Date(event.occurredAt), "MMM d, HH:mm:ss")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(event.occurredAt), { addSuffix: true })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <EventTypeBadge eventType={event.eventType} />
                      </TableCell>
                      <TableCell>
                        {event.decisionSpineId ? (
                          <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                            {event.decisionSpineId.substring(0, 12)}...
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {event.actorId ? (
                          <span className="text-xs">{event.actorId}</span>
                        ) : (
                          <Badge variant="outline" className="text-xs">{t('brain.audit.system')}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {event.payload?.layer !== undefined && (
                          <Badge variant="secondary" className="text-xs mr-2">
                            <Layers className="h-3 w-3 mr-1" />
                            Layer {String(event.payload.layer)}
                          </Badge>
                        )}
                        {(() => {
                          const eventData = event.payload?.eventData as { result?: string; policyMode?: string } | undefined;
                          return (
                            <>
                              {eventData?.result && (
                                <span className="text-xs">{eventData.result}</span>
                              )}
                              {eventData?.policyMode && (
                                <span className="text-xs ml-1">({eventData.policyMode})</span>
                              )}
                            </>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  {t('brain.pagination.showing', { start: page * pageSize + 1, end: Math.min((page + 1) * pageSize, total), total })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    {t('app.previous')}
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    {t('brain.pagination.pageOf', { page: page + 1, totalPages: totalPages || 1 })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                  >
                    {t('app.next')}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Event Detail — #{selectedEvent?.eventId}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('brain.audit.eventType')}</p>
                  <EventTypeBadge eventType={selectedEvent.eventType} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('brain.audit.timestamp')}</p>
                  <p className="text-sm font-mono">{format(new Date(selectedEvent.occurredAt), "yyyy-MM-dd HH:mm:ss.SSS")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('brain.audit.decisionSpineId')}</p>
                  <p className="text-sm font-mono">{selectedEvent.decisionSpineId || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('brain.audit.correlationId')}</p>
                  <p className="text-sm font-mono">{selectedEvent.correlationId || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('brain.audit.actor')}</p>
                  <p className="text-sm">{selectedEvent.actorId || t('brain.audit.system')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('brain.audit.requestId')}</p>
                  <p className="text-sm font-mono">{selectedEvent.requestId || "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">{t('brain.audit.fullPayload')}</p>
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-[300px] font-mono">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
