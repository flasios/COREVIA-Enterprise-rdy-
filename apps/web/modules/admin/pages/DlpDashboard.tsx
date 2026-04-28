/**
 * DLP Dashboard Page — Data Loss Prevention Admin Console
 *
 * Shows real-time DLP scan statistics, recent events, pattern configs.
 * Admin-only page (super_admin / pmo_director).
 *
 * @module admin
 */
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Eye,
  EyeOff,
  FileWarning,
  Activity,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Ban,
  Clock,
  Fingerprint,
  Lock,
  Unlock,
  Download,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// ── Types ───────────────────────────────────────────────────────────────────

interface DlpFinding {
  pattern: string;
  severity: string;
  count: number;
}

interface DlpEvent {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  path: string;
  method: string;
  userId?: string;
  findings: DlpFinding[];
  action: "allowed" | "redacted" | "blocked";
  timestamp: string;
  scanDurationMs?: number;
}

interface DlpStats {
  totalScans: number;
  totalBlocked: number;
  totalRedacted: number;
  totalClean: number;
  totalExportBlocked: number;
  byPattern: Record<string, number>;
  bySeverity: Record<string, number>;
  byHour: Array<{ hour: string; scans: number; blocked: number; redacted: number }>;
  topPaths: Array<{ path: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
  windowStart: string;
}

interface DlpPattern {
  name: string;
  severity: string;
  description: string;
}

interface DlpConfig {
  enabled: boolean;
  classificationLevels: string[];
  policies: {
    defaultApi: { minSeverity: string; action: string };
    aiResponses: { minSeverity: string; action: string };
    exports: { maxExportsPerWindow: number; maxRecordsPerWindow: number; windowMinutes: number };
    uploads: { minSeverity: string; action: string };
  };
  piiPatterns: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function severityColor(severity: string): string {
  switch (severity) {
    case "critical": return "bg-red-500/15 text-red-600 border-red-500/30";
    case "high": return "bg-orange-500/15 text-orange-600 border-orange-500/30";
    case "medium": return "bg-yellow-500/15 text-yellow-700 border-yellow-500/30";
    case "low": return "bg-blue-500/15 text-blue-600 border-blue-500/30";
    default: return "bg-gray-500/15 text-gray-600 border-gray-500/30";
  }
}

function actionColor(action: string): string {
  switch (action) {
    case "blocked": return "bg-red-500/15 text-red-600 border-red-500/30";
    case "redacted": return "bg-amber-500/15 text-amber-600 border-amber-500/30";
    case "allowed": return "bg-green-500/15 text-green-600 border-green-500/30";
    default: return "bg-gray-500/15 text-gray-600 border-gray-500/30";
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case "response_scan": return "Response Scan";
    case "response_blocked": return "Response Blocked";
    case "response_redacted": return "Response Redacted";
    case "export_blocked": return "Export Blocked";
    case "classification_denied": return "Classification Denied";
    case "upload_scan": return "Upload Scan";
    case "ai_scan": return "AI Scan";
    default: return type;
  }
}

function typeIcon(type: string) {
  switch (type) {
    case "response_blocked": return <ShieldX className="h-4 w-4 text-red-500" />;
    case "response_redacted": return <EyeOff className="h-4 w-4 text-amber-500" />;
    case "export_blocked": return <Ban className="h-4 w-4 text-red-500" />;
    case "classification_denied": return <Lock className="h-4 w-4 text-purple-500" />;
    case "upload_scan": return <FileWarning className="h-4 w-4 text-blue-500" />;
    case "ai_scan": return <Eye className="h-4 w-4 text-cyan-500" />;
    default: return <Shield className="h-4 w-4 text-gray-500" />;
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function DlpDashboard() {

  const [stats, setStats] = useState<DlpStats | null>(null);
  const [events, setEvents] = useState<DlpEvent[]>([]);
  const [patterns, setPatterns] = useState<DlpPattern[]>([]);
  const [config, setConfig] = useState<DlpConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, eventsRes, patternsRes, configRes] = await Promise.all([
        apiRequest("GET", "/api/admin/dlp/stats"),
        apiRequest("GET", "/api/admin/dlp/events?limit=100"),
        apiRequest("GET", "/api/admin/dlp/patterns"),
        apiRequest("GET", "/api/admin/dlp/config"),
      ]);

      const [statsJson, eventsJson, patternsJson, configJson] = await Promise.all([
        statsRes.json(),
        eventsRes.json(),
        patternsRes.json(),
        configRes.json(),
      ]);

      setStats(statsJson.data);
      setEvents(eventsJson.data);
      setPatterns(patternsJson.data);
      setConfig(configJson.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load DLP data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <p className="text-destructive text-lg">{error}</p>
        <Button onClick={fetchData} variant="outline">Retry</Button>
      </div>
    );
  }

  const totalEvents = (stats?.totalBlocked ?? 0) + (stats?.totalRedacted ?? 0) + (stats?.totalClean ?? 0);
  const blockRate = totalEvents > 0 ? ((stats?.totalBlocked ?? 0) / totalEvents) * 100 : 0;
  const redactRate = totalEvents > 0 ? ((stats?.totalRedacted ?? 0) / totalEvents) * 100 : 0;
  const cleanRate = totalEvents > 0 ? ((stats?.totalClean ?? 0) / totalEvents) * 100 : 0;

  return (
    <div className="min-h-screen bg-background constellation-grid relative overflow-hidden">
      <div className="container mx-auto p-6 relative z-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Data Loss Prevention</h1>
              <p className="text-muted-foreground">DLP Engine — Real-time PII & data classification monitoring</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className={config?.enabled ? "bg-green-500/15 text-green-600 border-green-500/30" : "bg-red-500/15 text-red-600 border-red-500/30"}>
              {config?.enabled ? <ShieldCheck className="h-3 w-3 mr-1" /> : <ShieldX className="h-3 w-3 mr-1" />}
              {config?.enabled ? "Engine Active" : "Engine Disabled"}
            </Badge>
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-1">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Scans</p>
                  <p className="text-3xl font-bold">{stats?.totalScans?.toLocaleString() ?? 0}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Blocked</p>
                  <p className="text-3xl font-bold text-red-600">{stats?.totalBlocked ?? 0}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-red-500/15 flex items-center justify-center">
                  <ShieldX className="h-5 w-5 text-red-500" />
                </div>
              </div>
              {totalEvents > 0 && (
                <p className="text-xs text-muted-foreground mt-2">{blockRate.toFixed(1)}% of total</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Redacted</p>
                  <p className="text-3xl font-bold text-amber-600">{stats?.totalRedacted ?? 0}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <EyeOff className="h-5 w-5 text-amber-500" />
                </div>
              </div>
              {totalEvents > 0 && (
                <p className="text-xs text-muted-foreground mt-2">{redactRate.toFixed(1)}% of total</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Clean</p>
                  <p className="text-3xl font-bold text-green-600">{stats?.totalClean ?? 0}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-green-500/15 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                </div>
              </div>
              {totalEvents > 0 && (
                <p className="text-xs text-muted-foreground mt-2">{cleanRate.toFixed(1)}% of total</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Export Blocked</p>
                  <p className="text-3xl font-bold text-purple-600">{stats?.totalExportBlocked ?? 0}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
                  <Download className="h-5 w-5 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Overview / Events / Patterns / Config */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Live Events
            </TabsTrigger>
            <TabsTrigger value="patterns" className="gap-1.5">
              <Fingerprint className="h-3.5 w-3.5" />
              PII Patterns
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Configuration
            </TabsTrigger>
          </TabsList>

          {/* ── Overview Tab ────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Detection by Pattern */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-primary" />
                    Detections by Pattern
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats && Object.keys(stats.byPattern).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(stats.byPattern)
                        .sort((a, b) => b[1] - a[1])
                        .map(([pattern, count]) => {
                          const patternDef = patterns.find((p) => p.name === pattern);
                          const total = Object.values(stats.byPattern).reduce((s, c) => s + c, 0);
                          const pct = total > 0 ? (count / total) * 100 : 0;
                          return (
                            <div key={pattern} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={severityColor(patternDef?.severity || "medium")}>
                                    {patternDef?.severity || "?"}
                                  </Badge>
                                  <span className="font-medium">{pattern.replace(/_/g, " ")}</span>
                                </div>
                                <span className="font-mono text-muted-foreground">{count}</span>
                              </div>
                              <Progress value={pct} className="h-1.5" />
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">No detections recorded yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Top Scanned Paths */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Top Scanned Paths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats && stats.topPaths.length > 0 ? (
                    <div className="space-y-2">
                      {stats.topPaths.map((p) => (
                        <div key={p.path} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-muted/40">
                          <code className="text-xs font-mono truncate max-w-[250px]">{p.path}</code>
                          <Badge variant="secondary">{p.count}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">No path data yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Severity Distribution */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    Severity Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats && Object.keys(stats.bySeverity).length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {(["critical", "high", "medium", "low"] as const).map((sev) => (
                        <div key={sev} className={`rounded-lg border px-3 py-2 ${severityColor(sev)}`}>
                          <p className="text-xs uppercase font-medium">{sev}</p>
                          <p className="text-2xl font-bold">{stats.bySeverity[sev] ?? 0}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">No severity data yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Hourly Activity (simple bar chart via divs) */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Hourly Activity (Last 24h)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats && stats.byHour.length > 0 ? (
                    <div className="flex items-end gap-1 h-32">
                      {stats.byHour.map((h) => {
                        const maxScans = Math.max(...stats.byHour.map((x) => x.scans), 1);
                        const height = (h.scans / maxScans) * 100;
                        const blockedPct = h.scans > 0 ? (h.blocked / h.scans) * 100 : 0;
                        return (
                          <div
                            key={h.hour}
                            className="flex-1 flex flex-col justify-end rounded-t"
                            title={`${formatDate(h.hour)}\nScans: ${h.scans}\nBlocked: ${h.blocked}\nRedacted: ${h.redacted}`}
                          >
                            <div
                              className="rounded-t transition-all"
                              style={{
                                height: `${Math.max(height, 2)}%`,
                                background: blockedPct > 20
                                  ? "linear-gradient(to top, rgb(239 68 68), rgb(249 115 22))"
                                  : h.redacted > 0
                                  ? "linear-gradient(to top, rgb(245 158 11), rgb(234 179 8))"
                                  : "linear-gradient(to top, rgb(59 130 246), rgb(99 102 241))",
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">No hourly data yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Events Tab ────────────────────────────────────────────── */}
          <TabsContent value="events" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  Recent DLP Events
                  <Badge variant="secondary" className="ml-auto">{events.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Type</TableHead>
                        <TableHead>Path</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Findings</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead className="text-right">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.length > 0 ? events.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>
                            <div className="flex items-center gap-1.5" title={typeLabel(event.type)}>
                              {typeIcon(event.type)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded truncate max-w-[200px] block">
                              {event.method} {event.path}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={severityColor(event.severity)}>
                              {event.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={actionColor(event.action)}>
                              {event.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {event.findings.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {event.findings.slice(0, 3).map((f, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {f.pattern.replace(/_/g, " ")} ({f.count})
                                  </Badge>
                                ))}
                                {event.findings.length > 3 && (
                                  <Badge variant="secondary" className="text-xs">+{event.findings.length - 3}</Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-mono text-muted-foreground">
                              {event.userId ? event.userId.slice(0, 8) + "…" : "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-xs text-muted-foreground">{formatTime(event.timestamp)}</span>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                            <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-green-500" />
                            No DLP events recorded yet — all clear
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Patterns Tab ──────────────────────────────────────────── */}
          <TabsContent value="patterns" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Fingerprint className="h-4 w-4 text-primary" />
                  PII Detection Patterns
                  <Badge variant="secondary" className="ml-auto">{patterns.length} active</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pattern</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead className="text-right">Detections</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patterns.map((pattern) => (
                      <TableRow key={pattern.name}>
                        <TableCell>
                          <code className="text-sm font-mono font-medium">{pattern.name}</code>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{pattern.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={severityColor(pattern.severity)}>
                            {pattern.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono font-bold">
                            {stats?.byPattern[pattern.name]?.toLocaleString() ?? 0}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Config Tab ────────────────────────────────────────────── */}
          <TabsContent value="config" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    Engine Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm">DLP Engine</span>
                    <Badge className={config?.enabled ? "bg-green-500" : "bg-red-500"}>
                      {config?.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm">Active PII Patterns</span>
                    <span className="font-mono font-bold">{config?.piiPatterns ?? 0}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm">Monitoring Since</span>
                    <span className="text-sm text-muted-foreground">
                      {stats?.windowStart ? formatDate(stats.windowStart) : "—"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Unlock className="h-4 w-4 text-primary" />
                    Classification Levels
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(config?.classificationLevels ?? []).map((level, i) => (
                      <div key={level} className="flex items-center gap-3 py-1.5">
                        <div className={`h-3 w-3 rounded-full ${
                          i === 0 ? "bg-green-500" :
                          i === 1 ? "bg-blue-500" :
                          i === 2 ? "bg-yellow-500" :
                          i === 3 ? "bg-orange-500" :
                          "bg-red-500"
                        }`} />
                        <span className="text-sm font-medium capitalize">{level.replace(/_/g, " ")}</span>
                        <span className="text-xs text-muted-foreground ml-auto">Level {i}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Scanning Policies
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {config?.policies && (
                    <>
                      <div className="rounded-lg border p-3 space-y-1">
                        <p className="text-sm font-medium">Default API</p>
                        <div className="flex gap-2">
                          <Badge variant="outline">Min: {config.policies.defaultApi.minSeverity}</Badge>
                          <Badge variant="outline">Action: {config.policies.defaultApi.action}</Badge>
                        </div>
                      </div>
                      <div className="rounded-lg border p-3 space-y-1">
                        <p className="text-sm font-medium">AI Responses</p>
                        <div className="flex gap-2">
                          <Badge variant="outline">Min: {config.policies.aiResponses.minSeverity}</Badge>
                          <Badge variant="outline">Action: {config.policies.aiResponses.action}</Badge>
                        </div>
                      </div>
                      <div className="rounded-lg border p-3 space-y-1">
                        <p className="text-sm font-medium">File Uploads</p>
                        <div className="flex gap-2">
                          <Badge variant="outline">Min: {config.policies.uploads.minSeverity}</Badge>
                          <Badge variant="outline">Action: {config.policies.uploads.action}</Badge>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Download className="h-4 w-4 text-primary" />
                    Exfiltration Limits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {config?.policies?.exports && (
                    <>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm">Max exports per window</span>
                        <span className="font-mono font-bold">{config.policies.exports.maxExportsPerWindow}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm">Max records per window</span>
                        <span className="font-mono font-bold">{config.policies.exports.maxRecordsPerWindow.toLocaleString()}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm">Window duration</span>
                        <span className="font-mono font-bold">{config.policies.exports.windowMinutes} min</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
