import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal as _SlidersHorizontal,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowUpRight,
  ShieldCheck,
  ShieldAlert,
  Gavel,
  Layers,
  FolderOpen,
} from "lucide-react";
import { fetchDecisions } from "@/api/brain";
import type { DecisionStats, DecisionListItem } from "@/api/brain";

const PAGE_SIZE = 20;

// ---------------------------
// Small utilities (prod-safe)
// ---------------------------

function safeLower(x: unknown, fallback = "") {
  if (x == null) return fallback;
  return String(x).toLowerCase();
}

function safeDateLabel(input?: string | null) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "-";
  // Stable, short, readable
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

type StatusFilter =
  | "all"
  | "pending_approval"
  | "approved"
  | "blocked"
  | "needs_info"
  | "processing"
  | "executed"
  | "actions_running";

type DecisionRow = DecisionListItem & {
  projectName: string;
  title: string;
  owner: string | null;
  updatedAtLabel: string;
  classification: string | null;
  riskLevel: string | null;
  needsApproval: boolean;
  approvalVerdict: string | null;
};

export function DecisionsList() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"decisions" | "reasoning" | "rag">("decisions");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [filters, setFilters] = useState({
    search: "",
    serviceId: "all",
    classification: "all",
    risk: "all",
  });

  const debouncedSearch = useDebouncedValue(filters.search, 250);

  // IMPORTANT: queryKey must represent what the UI depends on, or cache gets stale.
  // Even if your server currently ignores these, this makes the UI correct + future-ready.
  const queryKey = useMemo(
    () => [
      "decisions",
      {
        // If later you make server-side filtering, you’ll already be correct.
        view,
        statusFilter,
        search: debouncedSearch,
        serviceId: filters.serviceId,
        classification: filters.classification,
        risk: filters.risk,
        page,
        pageSize: PAGE_SIZE,
      },
    ],
    [view, statusFilter, debouncedSearch, filters.serviceId, filters.classification, filters.risk, page]
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const scope = view === "decisions" ? "governance" : view;
      return fetchDecisions(scope);
    },
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const serverStats: DecisionStats = data?.stats || {
    total: 0,
    pendingApproval: 0,
    approved: 0,
    blocked: 0,
    needsInfo: 0,
    processing: 0,
  };

  const allDecisions = useMemo<DecisionRow[]>(() => {
    const raw: DecisionListItem[] = data?.decisions || [];

    return raw.map((d): DecisionRow => {
      const classificationRaw = safeLower(d.classification);
      const riskRaw = safeLower(d.riskLevel);
      const classification = classificationRaw || null;
      const riskLevel = riskRaw || null;

      const policyVerdict = d.policyOps?.verdict || null;
      const status = d.status || null;

      const needsApproval = status === "validation" || status === "pending_approval";

      // Show a verdict only when the system has actually produced one.
      const approvalVerdict = policyVerdict || (status === "blocked" ? "BLOCK" : null);

      const projectName =
        d.projectName || d.title || d.routeKey || d.id;

      const title =
        d.title || d.projectName || d.routeKey || d.id;

      return {
        ...d,
        projectName,
        title,
        owner: d.owner || "",
        updatedAtLabel: safeDateLabel(d.updatedAt),
        classification,
        riskLevel,
        needsApproval,
        approvalVerdict,
      };
    });
  }, [data?.decisions]);

  const viewScopedDecisions = useMemo<DecisionRow[]>(() => {
    const service = (d: any) => String(d?.serviceId || "").toLowerCase(); // eslint-disable-line @typescript-eslint/no-explicit-any
    const route = (d: any) => String(d?.routeKey || "").toLowerCase(); // eslint-disable-line @typescript-eslint/no-explicit-any
    const isReasoning = (d: any) => service(d) === "reasoning"; // eslint-disable-line @typescript-eslint/no-explicit-any
    const _isRag = (d: DecisionRow) => {
      const s = service(d);
      const r = route(d);
      return (
        s.includes("rag") ||
        r.includes("rag") ||
        s.includes("knowledge") ||
        r.includes("knowledge") ||
        r.includes("evidence") ||
        s === "portfolio_ai" ||
        s === "language" ||
        s.includes("portfolio") ||
        r.startsWith("portfolio.") ||
        r.startsWith("language.")
      );
    };

    const isCoreGovernance = (d: DecisionRow) => {
      const s = service(d); // already lowercased
      // Core Brain governance workflows — demand & closure journey services
      return [
        "demand_decision",
        "demand_management",
        "demand_analysis",
        "demand_request",
        "demand_intake",
        "business_case",
        "requirements_analysis",
        "assessment",
        "strategic_fit",
        "wbs_generation",
        "wbs",
        "closure_report",
        "lessons_learned",
        "final_assessment",
      ].includes(s);
    };

    if (view === "reasoning") return allDecisions.filter(isReasoning);
    if (view === "rag") return allDecisions.filter((d: any) => !isReasoning(d) && !isCoreGovernance(d)); // eslint-disable-line @typescript-eslint/no-explicit-any
    // default: core governance decisions only
    return allDecisions.filter((d: any) => !isReasoning(d) && isCoreGovernance(d)); // eslint-disable-line @typescript-eslint/no-explicit-any
  }, [allDecisions, view]);

  const viewStats: DecisionStats = useMemo(() => {
    const arr = viewScopedDecisions as DecisionRow[];
    const pendingApproval = arr.filter((d) => d.status === "validation" || d.status === "pending_approval").length;
    const approved = arr.filter((d) => d.status === "approved" || d.status === "executed").length;
    const blocked = arr.filter((d) => d.status === "blocked").length;
    const needsInfo = arr.filter((d) => d.status === "needs_info").length;
    const processing = arr.filter((d) => d.status === "processing" || d.status === "actions_running" || d.status === "intake").length;
    return {
      total: arr.length,
      pendingApproval,
      approved,
      blocked,
      needsInfo,
      processing,
    };
  }, [viewScopedDecisions]);

  const statsForView = viewStats || serverStats;

  // Reset page when filters or status tab changes (prevents empty page “bug”)
  useEffect(() => {
    setPage(1);

  }, [view, statusFilter, debouncedSearch, filters.serviceId, filters.classification, filters.risk]);

  const filteredDecisions = useMemo(() => {
    let filtered: DecisionRow[] = viewScopedDecisions;

    if (statusFilter !== "all") {
      if (statusFilter === "pending_approval") {
        // Pending approval in the Brain pipeline is represented as `validation`.
        filtered = filtered.filter((d) => d.status === "validation" || d.status === "pending_approval");
      } else if (statusFilter === "processing") {
        filtered = filtered.filter((d) => d.status === "processing" || d.status === "actions_running" || d.status === "intake");
      } else {
        filtered = filtered.filter((d) => d.status === statusFilter);
      }
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase().trim();
      filtered = filtered.filter((d) =>
        safeLower(d.id).includes(q) ||
        safeLower(d.projectName).includes(q) ||
        safeLower(d.title).includes(q) ||
        safeLower(d.owner).includes(q)
      );
    }

    if (filters.serviceId && filters.serviceId !== "all") {
      filtered = filtered.filter((d) => d.serviceId === filters.serviceId);
    }
    if (filters.classification && filters.classification !== "all") {
      filtered = filtered.filter((d) => d.classification === filters.classification);
    }
    if (filters.risk && filters.risk !== "all") {
      filtered = filtered.filter((d) => d.riskLevel === filters.risk);
    }

    return filtered;
  }, [
    viewScopedDecisions,
    statusFilter,
    debouncedSearch,
    filters.serviceId,
    filters.classification,
    filters.risk,
  ]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredDecisions.length / PAGE_SIZE)),
    [filteredDecisions.length]
  );

  // Clamp page if list shrinks
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const paginatedDecisions = useMemo(
    () => filteredDecisions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredDecisions, page]
  );

  const statusTabs = [
    { value: "all", label: t('brain.decisions.all'), icon: FileText, count: statsForView.total },
    { value: "processing", label: t('brain.decisions.processing'), icon: Clock, count: statsForView.processing },
    { value: "pending_approval", label: t('brain.decisions.pending'), icon: Clock, count: statsForView.pendingApproval },
    { value: "approved", label: t('brain.decisions.approved'), icon: CheckCircle2, count: statsForView.approved },
    { value: "blocked", label: t('brain.decisions.blocked'), icon: XCircle, count: statsForView.blocked },
    { value: "needs_info", label: t('brain.decisions.needsInfo'), icon: AlertTriangle, count: statsForView.needsInfo },
  ] as const;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "intake":
        return <Badge className="bg-cyan-500/10 text-cyan-600 border-cyan-500/20">{t('brain.decisions.processing')}</Badge>;
      case "validation":
      case "pending_approval":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">{t('brain.decisions.pendingApproval')}</Badge>;
      case "blocked":
        return <Badge variant="destructive">{t('brain.decisions.blocked')}</Badge>;
      case "needs_info":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">{t('brain.decisions.needsInfo')}</Badge>;
      case "executed":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{t('brain.decisions.executed')}</Badge>;
      case "approved":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{t('brain.decisions.approved')}</Badge>;
      case "processing":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">{t('brain.decisions.processing')}</Badge>;
      case "actions_running":
        return <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20">{t('brain.decisions.actionsRunning')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRiskBadge = (risk: string | null) => {
    if (!risk) return <Badge variant="outline" className="text-xs">{t('brain.decisions.notRecorded')}</Badge>;
    switch (risk) {
      case "high":
        return <Badge variant="destructive" className="text-xs">{t('brain.decisions.high')}</Badge>;
      case "medium":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">{t('brain.decisions.medium')}</Badge>;
      case "low":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">{t('brain.decisions.low')}</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{risk}</Badge>;
    }
  };

  const getClassBadge = (classification: string | null) => {
    if (!classification) return <Badge variant="outline" className="text-xs">{t('brain.decisions.notRecorded')}</Badge>;
    switch (classification) {
      case "sovereign":
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-xs">{t('brain.decisions.sovereign')}</Badge>;
      case "confidential":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">{t('brain.decisions.confidential')}</Badge>;
      case "internal":
        return <Badge variant="outline" className="text-xs">{t('brain.decisions.internal')}</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{classification}</Badge>;
    }
  };

  const getApprovalBadge = (verdict: string | null, needsApproval: boolean) => {
    if (needsApproval) {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          <Gavel className="h-3 w-3 mr-1" /> {t('brain.decisions.pending')}
        </Badge>
      );
    }

    if (!verdict) {
      return <Badge variant="outline">{t('brain.decisions.notRecorded')}</Badge>;
    }

    const v = String(verdict).toUpperCase();
    if (v === "BLOCK") {
      return (
        <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
          <ShieldAlert className="h-3 w-3 mr-1" /> {t('brain.decisions.blocked')}
        </Badge>
      );
    }

    if (v === "ALLOW") {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
          <ShieldCheck className="h-3 w-3 mr-1" /> {t('brain.decisions.allowed')}
        </Badge>
      );
    }

    return <Badge variant="outline">{verdict}</Badge>;
  };

  const getServiceLabel = (serviceId: string) => {
    const s = (serviceId || "").toLowerCase().replace(/[\s-]+/g, "_");
    // Journey hierarchy: DEMAND_DECISION (spine) → sub-decisions
    if (["requirements_analysis", "requirements", "detailed_requirements"].includes(s)) return "DEMAND_DECISION";
    if (["demand_management", "demand_request", "demand_intake", "demand", "demand_analysis"].includes(s)) return "DEMAND_REQUEST";
    if (["business_case", "businesscase"].includes(s)) return "BUSINESS_CASE";
    if (["strategic_fit", "strategicfit"].includes(s)) return "STRATEGIC_FIT";
    if (["assessment"].includes(s)) return "ASSESSMENT";
    // Closure journey spine
    if (["closure_report"].includes(s)) return "CLOSURE_DECISION";
    if (["lessons_learned"].includes(s)) return "LESSONS_LEARNED";
    if (["final_assessment"].includes(s)) return "FINAL_ASSESSMENT";
    // Passthrough for other services
    const pascalMap: Record<string, string> = {
      BusinessCase: "BUSINESS_CASE",
      DemandMgmt: "DEMAND_REQUEST",
      Assessment: "ASSESSMENT",
      StrategicFit: "STRATEGIC_FIT",
      RequirementsAnalysis: "DEMAND_DECISION",
    };
    return pascalMap[serviceId] || serviceId;
  };

  const getDecisionHref = (decision: DecisionRow) => {
    // Journey-level service IDs don't map to a DB use_case_type — load spine without filter
    if (!decision.serviceId || decision.serviceId === "DEMAND_DECISION" || decision.serviceId === "CLOSURE_DECISION") {
      return `/brain-console/decisions/${decision.id}`;
    }
    const useCaseType = encodeURIComponent(decision.serviceId);
    return `/brain-console/decisions/${decision.id}?useCaseType=${useCaseType}`;
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border bg-[linear-gradient(135deg,hsl(var(--brain-console-ice))_0%,hsl(var(--brain-surface))_55%,hsl(var(--brain-console-ash))_100%)] p-6">
        <div className="absolute right-0 top-0 h-36 w-36 translate-x-10 -translate-y-10 rounded-full bg-[radial-gradient(circle,hsl(var(--brain-console-teal)/0.3)_0%,transparent_70%)]" />
        <div className="absolute left-0 bottom-0 h-40 w-40 -translate-x-12 translate-y-10 rounded-full bg-[radial-gradient(circle,hsl(var(--brain-console-copper)/0.22)_0%,transparent_70%)]" />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-overline text-muted-foreground">{t('brain.decisions.decisionLifecycle')}</p>
            <h1 className="text-display text-3xl">{t('brain.decisions.title')}</h1>
            <p className="text-body-lg text-muted-foreground mt-2">
              {t('brain.decisions.description')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                {t('brain.decisions.policyOpsActive')}
              </Badge>
              <Badge variant="outline" className="text-xs">{statsForView.total} {t('brain.decisions.total')}</Badge>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="inline-flex rounded-lg border bg-background/60 p-1">
              <Button
                type="button"
                size="sm"
                variant={view === "decisions" ? "secondary" : "ghost"}
                className="h-8"
                onClick={() => setView("decisions")}
              >
                {t('brain.decisions.decisions')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === "reasoning" ? "secondary" : "ghost"}
                className="h-8"
                onClick={() => setView("reasoning")}
              >
                {t('brain.decisions.reasoning')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === "rag" ? "secondary" : "ghost"}
                className="h-8"
                onClick={() => setView("rag")}
              >
                {t('brain.decisions.rag')}
              </Button>
            </div>
            <Button variant="outline" size="sm" className="gap-2" disabled={isLoading || isError}>
              <Download className="h-4 w-4" />
              {t('brain.decisions.export')}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={`hover-elevate cursor-pointer executive-panel ${statusFilter === "all" ? "ring-2 ring-primary/30" : ""}`} onClick={() => setStatusFilter("all")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-muted">
                <Layers className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="metric-value text-2xl">{statsForView.total}</p>
                <p className="text-caption text-muted-foreground">{t('brain.decisions.totalDecisions')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`hover-elevate cursor-pointer executive-panel ${statusFilter === "pending_approval" ? "ring-2 ring-amber-500/50" : ""}`} onClick={() => setStatusFilter("pending_approval")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-500/10">
                <Gavel className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="metric-value text-2xl text-amber-700">{statsForView.pendingApproval}</p>
                <p className="text-caption text-muted-foreground">{t('brain.decisions.pendingApproval')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`hover-elevate cursor-pointer executive-panel ${statusFilter === "approved" ? "ring-2 ring-emerald-500/50" : ""}`} onClick={() => setStatusFilter("approved")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="metric-value text-2xl text-emerald-700">{statsForView.approved}</p>
                <p className="text-caption text-muted-foreground">{t('brain.decisions.approved')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`hover-elevate cursor-pointer executive-panel ${statusFilter === "blocked" ? "ring-2 ring-red-500/50" : ""}`} onClick={() => setStatusFilter("blocked")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="metric-value text-2xl text-red-700">{statsForView.blocked}</p>
                <p className="text-caption text-muted-foreground">{t('brain.decisions.blocked')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('brain.decisions.searchPlaceholder')}
                className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
                value={filters.search}
                onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Select value={filters.serviceId} onValueChange={(v) => setFilters((p) => ({ ...p, serviceId: v }))}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('brain.decisions.service')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('brain.decisions.allServices')}</SelectItem>
                  <SelectItem value="DEMAND_DECISION">{t('brain.decisions.demandDecision')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.classification} onValueChange={(v) => setFilters((p) => ({ ...p, classification: v }))}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder={t('brain.decisions.classification')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('brain.decisions.allClasses')}</SelectItem>
                  <SelectItem value="internal">{t('brain.decisions.internal')}</SelectItem>
                  <SelectItem value="confidential">{t('brain.decisions.confidential')}</SelectItem>
                  <SelectItem value="sovereign">{t('brain.decisions.sovereign')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.risk} onValueChange={(v) => setFilters((p) => ({ ...p, risk: v }))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder={t('brain.decisions.risk')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('brain.decisions.allRisks')}</SelectItem>
                  <SelectItem value="low">{t('brain.decisions.low')}</SelectItem>
                  <SelectItem value="medium">{t('brain.decisions.medium')}</SelectItem>
                  <SelectItem value="high">{t('brain.decisions.high')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 mt-3 flex-wrap">
            {statusTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = statusFilter === tab.value;
              return (
                <Button
                  key={tab.value}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setStatusFilter(tab.value)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.count > 0 && (
                    <Badge variant={isActive ? "outline" : "secondary"} className="ml-1 text-xs h-5 px-1.5">
                      {tab.count}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">{t('brain.decisions.failedToLoad')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {(error as Error)?.message || "Unknown error"}
              </p>
            </div>
          ) : paginatedDecisions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">{t('brain.decisions.noDecisions')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {statusFilter !== "all"
                  ? t('brain.decisions.noDecisionsWithStatus', { status: statusFilter.replace(/_/g, " ") })
                  : t('brain.decisions.noDecisionsHint')}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="bg-muted/60 border-b">
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 w-[100px]">{t('brain.decisions.id')}</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">{t('brain.decisions.projectDecision')}</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 w-[130px]">{t('brain.decisions.service')}</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 w-[100px]">{t('brain.decisions.class')}</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 w-[80px]">{t('brain.decisions.risk')}</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 w-[100px]">{t('brain.decisions.approval')}</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 w-[130px]">{t('brain.decisions.status')}</th>
                      <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 w-[120px]">{t('brain.decisions.updated')}</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {paginatedDecisions.map((decision) => (
                      <tr key={decision.id} className="hover:bg-muted/30 transition-colors cursor-pointer group">
                        <td className="px-4 py-3">
                          <Link href={getDecisionHref(decision)}>
                            <span className="font-mono text-sm font-semibold text-primary">
                              {decision.id?.length > 8 ? decision.id.slice(0, 8) + "..." : decision.id}
                            </span>
                          </Link>
                        </td>

                        <td className="px-4 py-3">
                          <Link href={getDecisionHref(decision)}>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium truncate text-sm">{decision.projectName}</p>
                                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                              </div>
                              {decision.projectName !== decision.title && (
                                <p className="text-xs text-muted-foreground truncate max-w-[300px]">{decision.title}</p>
                              )}
                              <p className="text-xs text-muted-foreground">{decision.owner || "—"}</p>
                            </div>
                          </Link>
                        </td>

                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">
                            {getServiceLabel(decision.serviceId)}
                          </Badge>
                        </td>

                        <td className="px-4 py-3">{getClassBadge(decision.classification)}</td>

                        <td className="px-4 py-3">{getRiskBadge(decision.riskLevel)}</td>

                        <td className="px-4 py-3">{getApprovalBadge(decision.approvalVerdict, decision.needsApproval)}</td>

                        <td className="px-4 py-3">{getStatusBadge(decision.status)}</td>

                        <td className="px-4 py-3 text-right">
                          <span className="text-xs text-muted-foreground">{decision.updatedAtLabel}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {t('brain.pagination.showing', { start: (page - 1) * PAGE_SIZE + 1, end: Math.min(page * PAGE_SIZE, filteredDecisions.length), total: filteredDecisions.length })} {t('brain.decisions.decisionsLabel')}
                </p>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('app.previous')}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="gap-1"
                  >
                    {t('app.next')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
