import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation, useSearch } from "wouter";
import { VideoLogo } from "@/components/ui/video-logo";
import { NeedsInfoDialog } from "./NeedsInfoDialog";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import { resolveDemandDisplayWorkflowStatus } from "@/modules/demand/pages/demandAnalysisReport.utils";
import {
  Search,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Eye,
  Download,
  Sparkles,
  Calendar,
  UserCheck,
  XCircle,
  List,
  Grid3X3,
  Table,
  ArrowRightCircle,
  Lightbulb,
  Building2,
  Shield,
  Activity,
  Timer
} from "lucide-react";

interface DemandReport {
  id: string;
  projectId?: string | null;
  suggestedProjectName?: string | null;
  organizationName: string;
  requestorName: string;
  requestorEmail: string;
  department: string;
  urgency: string;
  businessObjective: string;
  workflowStatus: string;
  workflowHistory?: Array<{ newStatus?: string | null; reason?: string | null; correction?: unknown }> | null;
  requestType?: string;
  classificationConfidence?: number;
  estimatedBudget?: string;
  estimatedTimeline?: string;
  createdAt: string;
  updatedAt: string;
  requirementsVersionStatus?: string;
  businessCaseVersionStatus?: string;
  enterpriseArchitectureVersionStatus?: string;
  strategicFitVersionStatus?: string;
  decisionId?: string;
  decisionSpineId?: string | null;
  decisionStatus?: string;
  aiAnalysis?: Record<string, unknown> | null;
  missingFields?: string[];
  dataClassification?: string | null;
  dataClassificationConfidence?: number | null;
}

interface Decision {
  id: string;
  correlationId: string;
  status: string;
  serviceId: string;
  routeKey: string;
  currentLayer: number;
  createdAt: string;
  input?: Record<string, unknown>;
}

// Enhanced workflow status functions for consistency
function getStatusVariant(status: string | undefined): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case 'resubmitted':
      return 'secondary';
    case 'manager_approved':
      return 'default';
    case 'initially_approved':
      return 'default';
    case 'manager_approval':
      return 'secondary';
    case 'pending_conversion':
      return 'default';
    case 'converted':
      return 'default';
    case 'under_review':
      return 'secondary';
    case 'meeting_scheduled':
      return 'secondary';
    case 'acknowledged':
      return 'secondary';
    case 'generated':
      return 'outline';
    case 'rejected':
      return 'destructive';
    case 'deferred':
      return 'outline';
    default:
      return 'outline';
  }
}

function getStatusDisplayName(status: string | undefined): string {
  switch (status) {
    case 'resubmitted':
      return 'Resubmitted';
    case 'generated':
      return i18next.t('demand.dashboard.status.generated');
    case 'acknowledged':
      return i18next.t('demand.dashboard.status.acknowledged');
    case 'meeting_scheduled':
      return i18next.t('demand.dashboard.status.meetingScheduled');
    case 'under_review':
      return i18next.t('demand.dashboard.status.underReview');
    case 'initially_approved':
      return i18next.t('demand.dashboard.status.initiallyApproved');
    case 'manager_approval':
      return i18next.t('demand.dashboard.status.pendingFinalApproval');
    case 'manager_approved':
      return i18next.t('demand.dashboard.status.approved');
    case 'pending_conversion':
      return i18next.t('demand.dashboard.status.pendingConversion');
    case 'converted':
      return i18next.t('demand.dashboard.status.converted');
    case 'rejected':
      return i18next.t('demand.dashboard.status.rejected');
    case 'deferred':
      return i18next.t('demand.dashboard.status.deferred');
    default:
      return status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || i18next.t('demand.dashboard.status.unknown');
  }
}

function getStatusIcon(status: string | undefined) {
  switch (status) {
    case 'resubmitted': return <Sparkles className="h-3 w-3" />;
    case 'generated': return <Sparkles className="h-3 w-3" />;
    case 'acknowledged': return <CheckCircle className="h-3 w-3" />;
    case 'meeting_scheduled': return <Calendar className="h-3 w-3" />;
    case 'under_review': return <Search className="h-3 w-3" />;
    case 'initially_approved': return <CheckCircle className="h-3 w-3" />;
    case 'manager_approval': return <Clock className="h-3 w-3" />;
    case 'manager_approved': return <UserCheck className="h-3 w-3" />;
    case 'pending_conversion': return <ArrowRightCircle className="h-3 w-3" />;
    case 'converted': return <CheckCircle className="h-3 w-3" />;
    case 'rejected': return <XCircle className="h-3 w-3" />;
    case 'deferred': return <Clock className="h-3 w-3" />;
    default: return <FileText className="h-3 w-3" />;
  }
}

const urgencyColors = {
  low: "bg-gray-500",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  critical: "bg-red-500"
};

const classificationColors: Record<string, string> = {
  public: "bg-emerald-500",
  internal: "bg-blue-500",
  confidential: "bg-amber-500",
  [String.fromCharCode(115, 101, 99, 114, 101, 116)]: "bg-orange-600",
  [`top_${String.fromCharCode(115, 101, 99, 114, 101, 116)}`]: "bg-red-600",
  auto: "bg-gray-500"
};

// Helper function to get urgency color safely
function getUrgencyColor(urgency: string): string {
  const normalizedUrgency = urgency?.toLowerCase();
  return urgencyColors[normalizedUrgency as keyof typeof urgencyColors] || "bg-gray-500";
}

// Helper function to get classification color safely
function getClassificationColor(classification: string | null | undefined): string {
  const normalized = classification?.toLowerCase() || "internal";
  return classificationColors[normalized] || "bg-blue-500";
}

// Helper function to get classification display name
function getClassificationDisplay(classification: string | null | undefined): string {
  if (!classification || classification === "auto") return i18next.t('demand.dashboard.classification.internal');
  const display: Record<string, string> = {
    public: i18next.t('demand.dashboard.classification.public'),
    internal: i18next.t('demand.dashboard.classification.internal'),
    confidential: i18next.t('demand.dashboard.classification.confidential'),
    secret: i18next.t('demand.dashboard.classification.secret'),
    top_secret: i18next.t('demand.dashboard.classification.topSecret')
  };
  return display[classification.toLowerCase()] || classification;
}

// Helper function for requirements version status display
function getRequirementsStatusDisplay(status: string | undefined): { label: string; className: string } {
  switch (status) {
    case 'published':
      return { label: i18next.t('demand.dashboard.reqStatus.published'), className: 'border-emerald-500 text-emerald-600' };
    case 'approved':
      return { label: i18next.t('demand.dashboard.reqStatus.approved'), className: 'border-blue-500 text-blue-600' };
    case 'manager_approval':
      return { label: i18next.t('demand.dashboard.reqStatus.pendingApproval'), className: 'border-amber-500 text-amber-600' };
    case 'under_review':
      return { label: i18next.t('demand.dashboard.reqStatus.underReview'), className: 'border-purple-500 text-purple-600' };
    case 'draft':
      return { label: i18next.t('demand.dashboard.reqStatus.draft'), className: 'border-slate-400 text-slate-500' };
    case 'not_generated':
    default:
      return { label: i18next.t('demand.dashboard.reqStatus.notGenerated'), className: 'border-slate-300 text-slate-400' };
  }
}

function getArtifactStatusDisplay(status: string | undefined): { label: string; className: string } {
  return getRequirementsStatusDisplay(status);
}

function getEnterpriseArchitectureStatusDisplay(status: string | undefined): { label: string; className: string } {
  switch (status) {
    case 'published':
      return { label: i18next.t('demand.dashboard.eaStatus.published'), className: 'border-emerald-500 text-emerald-600' };
    case 'approved':
      return { label: i18next.t('demand.dashboard.eaStatus.approved'), className: 'border-cyan-500 text-cyan-600' };
    case 'manager_approval':
      return { label: i18next.t('demand.dashboard.eaStatus.pendingApproval'), className: 'border-amber-500 text-amber-600' };
    case 'under_review':
      return { label: i18next.t('demand.dashboard.eaStatus.underReview'), className: 'border-violet-500 text-violet-600' };
    case 'draft':
      return { label: i18next.t('demand.dashboard.eaStatus.draft'), className: 'border-slate-400 text-slate-500' };
    case 'not_generated':
    default:
      return { label: i18next.t('demand.dashboard.eaStatus.notGenerated'), className: 'border-slate-300 text-slate-400' };
  }
}

function DemandDashboard() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'table' | 'grid'>('table');
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const mineFilter = searchParams.get("mine") === "true";
  const queryClient = useQueryClient();

  const [needsInfoDialog, setNeedsInfoDialog] = useState<{
    open: boolean;
    decisionId: string;
    missingFields: string[];
    demandTitle?: string;
  }>({
    open: false,
    decisionId: "",
    missingFields: [],
  });

  // Virtual scrolling refs
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  // Fetch demand reports
  const { data: reportsData, isLoading, error } = useQuery({
    queryKey: ['/api/demand-reports', statusFilter, debouncedSearchTerm, mineFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
        includeRequirementsStatus: "true",
        includeBusinessCaseStatus: "true",
        includeEnterpriseArchitectureStatus: "true",
        includeStrategicFitStatus: "true",
      });
      if (mineFilter) {
        params.set("mine", "true");
      }
      if (statusFilter !== 'all') {
        params.set("status", statusFilter);
      }
      if (debouncedSearchTerm.length >= 2) {
        params.set("q", debouncedSearchTerm);
      }
      const url = `/api/demand-reports?${params.toString()}`;
      const response = await apiRequest("GET", url);
      return response.json();
    }
  });

  // Fetch decisions to map decision status to demands
  const { data: decisionsData } = useQuery({
    queryKey: ['/api/corevia/decisions'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/corevia/decisions");
      return response.json();
    }
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const decisions = decisionsData?.success ? decisionsData.decisions : [];

  // Create a map of correlationId to decision for quick lookup
  const decisionMap = useMemo(() => {
    const map = new Map<string, Decision>();
    decisions.forEach((d: Decision) => {
      map.set(d.correlationId, d);
      map.set(d.id, d);
    });
    return map;
  }, [decisions]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reports = reportsData?.success ? reportsData.data : [];

  // Enrich reports with decision status
  const enrichedReports = useMemo(() => {
    return reports.map((report: DemandReport) => {
      const aiAnalysisRecord = report.aiAnalysis;
      const aiDecisionId = aiAnalysisRecord && typeof aiAnalysisRecord === "object"
        ? (aiAnalysisRecord.decisionId as string | undefined)
        : undefined;
      const candidateDecisionId =
        report.decisionId
        || report.decisionSpineId
        || aiDecisionId
        || report.projectId
        || undefined;

      const decision = (candidateDecisionId ? decisionMap.get(candidateDecisionId) : undefined)
        || decisionMap.get(report.id);

      return {
        ...report,
        decisionId: report.decisionId || decision?.id,
        decisionStatus: report.decisionStatus || decision?.status,
      };
    });
  }, [reports, decisionMap]);

  // Memoize expensive filtering and stats calculations
  const filteredReports = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return enrichedReports.filter((report: DemandReport) => {
      const matchesSearch = !searchTerm || (
        report.organizationName.toLowerCase().includes(searchLower) ||
        report.requestorName.toLowerCase().includes(searchLower) ||
        report.department.toLowerCase().includes(searchLower) ||
        report.businessObjective.toLowerCase().includes(searchLower)
      );

      const matchesStatus = statusFilter === 'all' ||
        (report.workflowStatus || 'generated') === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [enrichedReports, searchTerm, statusFilter]);

  // Decision status helpers
  const getDecisionStatusDisplay = useCallback((status: string | undefined): { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string } => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return { label: t('demand.dashboard.decision.completed'), variant: 'default', className: 'bg-emerald-500 text-white' };
      case 'needs_info':
        return { label: t('demand.dashboard.decision.needsInfo'), variant: 'outline', className: 'border-amber-500 text-amber-600' };
      case 'blocked':
        return { label: t('demand.dashboard.decision.blocked'), variant: 'destructive' };
      case 'rejected':
        return { label: t('demand.dashboard.decision.rejected'), variant: 'destructive' };
      case 'validation':
        return { label: t('demand.dashboard.decision.pendingApproval'), variant: 'secondary' };
      case 'orchestration':
      case 'reasoning':
        return { label: t('demand.dashboard.decision.processing'), variant: 'secondary', className: 'bg-blue-500 text-white' };
      case 'intake':
      case 'classification':
      case 'policy_check':
      case 'context_check':
        return { label: t('demand.dashboard.decision.inPipeline'), variant: 'outline', className: 'border-blue-500 text-blue-600' };
      default:
        return { label: status ? status.replace(/_/g, ' ') : t('demand.dashboard.decision.noDecision'), variant: 'outline' };
    }
  }, [t]);

  const handleNeedsInfoClick = useCallback((report: DemandReport) => {
    if (report.decisionId && report.decisionStatus === 'needs_info') {
      setNeedsInfoDialog({
        open: true,
        decisionId: report.decisionId,
        missingFields: report.missingFields || ['estimatedBudget', 'estimatedTimeline', 'businessObjective'],
        demandTitle: report.organizationName,
      });
    }
  }, []);

  // Virtual scrolling setup with dynamic sizing
  const { data: demandStats } = useQuery({
    queryKey: ['/api/demand-reports/stats'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/demand-reports/stats");
      return response.json();
    }
  });

  const kpiStats = useMemo(() => {
    const slaCompliancePercent = Number(demandStats?.slaCompliancePercent ?? 0);
    const avgProcessingDays = Number(demandStats?.avgProcessingDays ?? 0);
    return {
      slaCompliancePercent,
      pendingApproval: Number(demandStats?.pendingApproval ?? 0),
      createdThisMonth: Number(demandStats?.createdThisMonth ?? 0),
      avgProcessingDays,
    };
  }, [demandStats]);

  // Memoize event handlers
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value);
  }, []);

  const handleReportSelect = useCallback((reportId: string) => {
    setSelectedReport(prev => prev === reportId ? null : reportId);
  }, []);

  const handleViewReport = useCallback((reportId: string) => {
    setLocation(mineFilter ? `/demand-submitted/${reportId}` : `/demand-analysis/${reportId}`);
  }, [setLocation, mineFilter]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <VideoLogo size="sm" className="mx-auto" />
          <div>
            <h3 className="font-semibold">{t('demand.dashboard.loadingReports')}</h3>
            <p className="text-sm text-muted-foreground">{t('demand.dashboard.fetchingReports')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-xl bg-red-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <div>
            <h3 className="font-semibold text-red-500">{t('demand.dashboard.errorLoadingReports')}</h3>
            <p className="text-sm text-muted-foreground">{t('demand.dashboard.errorLoadingDesc')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 flex-shrink-0">
        <div className="glass-card rounded-md px-3 py-2 flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-md bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
            <Shield className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground min-w-0">
            <span className="truncate">{t('demand.dashboard.slaCompliance')}</span>
            <span className="text-base font-semibold text-emerald-600 normal-case tracking-normal">
              {Math.round(kpiStats.slaCompliancePercent)}%
            </span>
          </div>
        </div>

        <div className="glass-card rounded-md px-3 py-2 flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-md bg-amber-500/15 text-amber-600 flex items-center justify-center">
            <Clock className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground min-w-0">
            <span className="truncate">{t('demand.dashboard.pendingApproval')}</span>
            <span className="text-base font-semibold text-amber-600 normal-case tracking-normal">
              {kpiStats.pendingApproval.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="glass-card rounded-md px-3 py-2 flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-md bg-blue-500/15 text-blue-600 flex items-center justify-center">
            <Activity className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground min-w-0">
            <span className="truncate">{t('demand.dashboard.thisMonth')}</span>
            <span className="text-base font-semibold text-blue-600 normal-case tracking-normal">
              {kpiStats.createdThisMonth.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="glass-card rounded-md px-3 py-2 flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-md bg-teal-500/15 text-teal-600 flex items-center justify-center">
            <Timer className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground min-w-0">
            <span className="truncate">{t('demand.dashboard.avgProcessing')}</span>
            <span className="text-base font-semibold text-teal-600 normal-case tracking-normal">
              {kpiStats.avgProcessingDays.toFixed(1)} days
            </span>
          </div>
        </div>
      </div>

      {/* Filters and Search - Compact */}
      <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('demand.dashboard.searchPlaceholder')}
            value={searchTerm}
            onChange={handleSearchChange}
            className="pl-10 h-9"
            data-testid="input-search-reports"
          />
        </div>

        <Select value={statusFilter} onValueChange={handleStatusFilterChange} data-testid="select-status-filter">
          <SelectTrigger className="w-full sm:w-40 h-9">
            <SelectValue placeholder={t('demand.dashboard.filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('demand.dashboard.allStatus')}</SelectItem>
            <SelectItem value="generated">{t('demand.dashboard.status.generated')}</SelectItem>
            <SelectItem value="acknowledged">{t('demand.dashboard.status.acknowledged')}</SelectItem>
            <SelectItem value="meeting_scheduled">{t('demand.dashboard.status.meetingScheduled')}</SelectItem>
            <SelectItem value="under_review">{t('demand.dashboard.status.underReview')}</SelectItem>
            <SelectItem value="initially_approved">{t('demand.dashboard.status.initiallyApproved')}</SelectItem>
            <SelectItem value="manager_approved">{t('demand.dashboard.status.approved')}</SelectItem>
            <SelectItem value="pending_conversion">{t('demand.dashboard.status.pendingConversion')}</SelectItem>
            <SelectItem value="converted">{t('demand.dashboard.status.converted')}</SelectItem>
            <SelectItem value="deferred">{t('demand.dashboard.status.deferred')}</SelectItem>
            <SelectItem value="rejected">{t('demand.dashboard.status.rejected')}</SelectItem>
          </SelectContent>
        </Select>

        {/* View Mode Toggle */}
        <div className="flex items-center border rounded-lg p-1">
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode('list')}
            data-testid="button-view-list"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode('table')}
            data-testid="button-view-table"
          >
            <Table className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode('grid')}
            data-testid="button-view-grid"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
        </div>

      </div>

      {/* Reports List - Virtualized */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto min-h-0 pr-2"
        style={{
          scrollbarWidth: 'thin',
          paddingBottom: '40px' // Add bottom padding to ensure buttons are accessible
        }}
      >
        {filteredReports.length === 0 ? (
          <div className="text-center py-16">
            <div className="h-20 w-20 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
              <FileText className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">{t('demand.dashboard.noReportsFound')}</h3>
            <p className="text-muted-foreground">
              {searchTerm ? t('demand.dashboard.adjustSearch') : t('demand.dashboard.createFirstReport')}
            </p>
          </div>
        ) : viewMode === 'table' ? (
          /* Table View */
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-[1180px] w-full">
              <thead className="bg-muted/30">
                <tr className="text-left">
                  <th className="p-3 text-sm font-medium">{t('demand.dashboard.table.organization')}</th>
                  <th className="p-3 text-sm font-medium">{t('demand.dashboard.suggestedProjectName')}</th>
                  <th className="p-3 text-sm font-medium">{t('demand.dashboard.table.requestor')}</th>
                  <th className="p-3 text-sm font-medium">{t('demand.dashboard.table.decision')}</th>
                  <th className="p-3 text-sm font-medium">{t('demand.dashboard.table.status')}</th>
                  <th className="p-3 text-sm font-medium">Business Case</th>
                  <th className="p-3 text-sm font-medium">{t('demand.dashboard.table.requirements')}</th>
                  <th className="p-3 text-sm font-medium">{t('demand.dashboard.table.ea')}</th>
                  <th className="p-3 text-sm font-medium">Strategic Fit</th>
                  <th className="p-3 text-sm font-medium">{t('demand.dashboard.table.classification')}</th>
                  <th className="p-3 text-sm font-medium">{t('demand.dashboard.table.urgency')}</th>
                  <th className="p-3 text-sm font-medium">{t('demand.dashboard.table.date')}</th>
                  <th className="p-3 text-sm font-medium">{t('demand.dashboard.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report: DemandReport) => (
                  <tr
                    key={report.id}
                    className="border-t hover:bg-muted/20 cursor-pointer"
                    onClick={() => handleReportSelect(report.id)}
                    data-testid={`row-report-${report.id}`}
                  >
                    <td className="p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {report.organizationName}
                          </span>
                          {report.projectId && (
                            <span className="text-xs text-muted-foreground" data-testid={`text-project-id-${report.id}`}>
                              - {report.projectId}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{report.department}</div>
                      </div>
                    </td>
                    <td className="p-3 text-sm">
                      <div className="font-medium line-clamp-2">
                        {report.suggestedProjectName || report.businessObjective}
                      </div>
                      {report.suggestedProjectName && report.businessObjective && report.suggestedProjectName !== report.businessObjective && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {report.businessObjective}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-sm">
                      <div>{report.requestorName}</div>
                      <div className="text-xs text-muted-foreground">{report.requestorEmail}</div>
                    </td>
                    <td className="p-3">
                      {(() => {
                        const statusDisplay = getDecisionStatusDisplay(report.decisionStatus);
                        const isNeedsInfo = report.decisionStatus === 'needs_info';
                        return (
                          <Badge
                            variant={statusDisplay.variant}
                            className={`text-xs ${statusDisplay.className || ''} ${isNeedsInfo ? 'cursor-pointer hover:opacity-80' : ''}`}
                            onClick={isNeedsInfo ? (e: React.MouseEvent) => { e.stopPropagation(); handleNeedsInfoClick(report); } : undefined}
                            data-testid={`badge-decision-status-${report.id}`}
                          >
                            {statusDisplay.label}
                            {isNeedsInfo && <AlertCircle className="h-3 w-3 ml-1" />}
                          </Badge>
                        );
                      })()}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={getStatusVariant(resolveDemandDisplayWorkflowStatus(report.workflowStatus, report.workflowHistory))}
                        className="text-xs"
                      >
                        {getStatusDisplayName(resolveDemandDisplayWorkflowStatus(report.workflowStatus, report.workflowHistory))}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getArtifactStatusDisplay(report.businessCaseVersionStatus).className}`}
                        data-testid={`badge-business-case-status-${report.id}`}
                      >
                        {getArtifactStatusDisplay(report.businessCaseVersionStatus).label}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getRequirementsStatusDisplay(report.requirementsVersionStatus).className}`}
                        data-testid={`badge-requirements-status-${report.id}`}
                      >
                        {getRequirementsStatusDisplay(report.requirementsVersionStatus).label}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getEnterpriseArchitectureStatusDisplay(report.enterpriseArchitectureVersionStatus).className}`}
                        data-testid={`badge-ea-status-${report.id}`}
                      >
                        {getEnterpriseArchitectureStatusDisplay(report.enterpriseArchitectureVersionStatus).label}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getArtifactStatusDisplay(report.strategicFitVersionStatus).className}`}
                        data-testid={`badge-strategic-fit-status-${report.id}`}
                      >
                        {getArtifactStatusDisplay(report.strategicFitVersionStatus).label}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={`${getClassificationColor(report.dataClassification)} text-white text-xs`}
                        data-testid={`badge-classification-${report.id}`}
                      >
                        {getClassificationDisplay(report.dataClassification)}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={`${getUrgencyColor(report.urgency)} text-white text-xs`}
                      >
                        {report.urgency?.toUpperCase() || 'MEDIUM'}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewReport(report.id);
                          }}
                          data-testid={`button-table-view-${report.id}`}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          data-testid={`button-table-analyze-${report.id}`}
                        >
                          <HexagonLogoFrame px={12} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          data-testid={`button-table-export-${report.id}`}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map((report: DemandReport) => (
              <Card
                key={report.id}
                className="portal-galaxy-card cursor-pointer transition-all duration-300 hover:shadow-lg border-l-4 border-l-primary/20"
                onClick={() => handleReportSelect(report.id)}
                data-testid={`grid-card-report-${report.id}`}
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-1">
                          <h3 className="font-semibold text-sm">
                            {report.organizationName}
                          </h3>
                          {report.projectId && (
                            <span className="text-xs text-muted-foreground" data-testid={`text-project-id-${report.id}`}>
                              - {report.projectId}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{report.department}</p>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <Badge
                          variant={getStatusVariant(resolveDemandDisplayWorkflowStatus(report.workflowStatus, report.workflowHistory))}
                          className="text-xs"
                        >
                          {getStatusDisplayName(resolveDemandDisplayWorkflowStatus(report.workflowStatus, report.workflowHistory))}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getArtifactStatusDisplay(report.businessCaseVersionStatus).className}`}
                          data-testid={`badge-grid-business-case-status-${report.id}`}
                        >
                          BC: {getArtifactStatusDisplay(report.businessCaseVersionStatus).label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getRequirementsStatusDisplay(report.requirementsVersionStatus).className}`}
                          data-testid={`badge-grid-requirements-status-${report.id}`}
                        >
                          Req: {getRequirementsStatusDisplay(report.requirementsVersionStatus).label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getEnterpriseArchitectureStatusDisplay(report.enterpriseArchitectureVersionStatus).className}`}
                          data-testid={`badge-grid-ea-status-${report.id}`}
                        >
                          EA: {getEnterpriseArchitectureStatusDisplay(report.enterpriseArchitectureVersionStatus).label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getArtifactStatusDisplay(report.strategicFitVersionStatus).className}`}
                          data-testid={`badge-grid-strategic-fit-status-${report.id}`}
                        >
                          Fit: {getArtifactStatusDisplay(report.strategicFitVersionStatus).label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`${getClassificationColor(report.dataClassification)} text-white text-xs`}
                          data-testid={`badge-grid-classification-${report.id}`}
                        >
                          {getClassificationDisplay(report.dataClassification)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`${getUrgencyColor(report.urgency)} text-white text-xs`}
                        >
                          {report.urgency?.toUpperCase() || 'MEDIUM'}
                        </Badge>
                      </div>
                    </div>

                    {/* Suggested Project Name */}
                    {report.suggestedProjectName && (
                      <div>
                        <p className="text-xs text-muted-foreground">{t('demand.dashboard.suggestedProjectName')}:</p>
                        <p className="text-xs text-foreground font-medium mt-0.5">{report.suggestedProjectName}</p>
                      </div>
                    )}

                    {/* Business Objective */}
                    <div>
                      <p className="text-xs text-muted-foreground">{t('demand.dashboard.businessObjective')}:</p>
                      <p className="text-xs text-foreground line-clamp-2 mt-1">
                        {report.businessObjective}
                      </p>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 min-w-0">
                        <Users className="h-3 w-3 shrink-0" />
                        <div className="truncate">
                          <span>{report.requestorName}</span>
                          <span className="ml-1 opacity-70">{report.requestorEmail}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(report.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 pt-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewReport(report.id);
                        }}
                        data-testid={`button-grid-view-${report.id}`}
                      >
                        <Eye className="h-3 w-3" />
                        {t('demand.dashboard.view')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        data-testid={`button-grid-analyze-${report.id}`}
                      >
                        <HexagonLogoFrame px={12} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        data-testid={`button-grid-export-${report.id}`}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* List View (Default) - Professional Enterprise Card Layout */
          <div className="space-y-4">
            {filteredReports.map((report: DemandReport) => (
              <Card
                key={report.id}
                className="cursor-pointer transition-all duration-300 hover:shadow-lg border-l-4 border-l-primary"
                onClick={() => handleReportSelect(report.id)}
                data-testid={`card-report-${report.id}`}
              >
                <CardContent className="p-5">
                  <div className="space-y-4">
                    {/* Header Section - Organization & Status */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                          <h3 className="font-semibold text-base text-foreground">
                            {report.organizationName}
                          </h3>
                          {report.projectId && (
                            <Badge variant="outline" className="text-xs font-mono" data-testid={`text-project-id-${report.id}`}>
                              {report.projectId}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{report.department}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                        <Badge
                          variant={getStatusVariant(resolveDemandDisplayWorkflowStatus(report.workflowStatus, report.workflowHistory))}
                          className="gap-1 text-xs"
                        >
                          {getStatusIcon(resolveDemandDisplayWorkflowStatus(report.workflowStatus, report.workflowHistory))}
                          {getStatusDisplayName(resolveDemandDisplayWorkflowStatus(report.workflowStatus, report.workflowHistory))}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getArtifactStatusDisplay(report.businessCaseVersionStatus).className}`}
                          data-testid={`badge-list-business-case-status-${report.id}`}
                        >
                          BC: {getArtifactStatusDisplay(report.businessCaseVersionStatus).label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getRequirementsStatusDisplay(report.requirementsVersionStatus).className}`}
                          data-testid={`badge-list-requirements-status-${report.id}`}
                        >
                          Req: {getRequirementsStatusDisplay(report.requirementsVersionStatus).label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getEnterpriseArchitectureStatusDisplay(report.enterpriseArchitectureVersionStatus).className}`}
                          data-testid={`badge-list-ea-status-${report.id}`}
                        >
                          EA: {getEnterpriseArchitectureStatusDisplay(report.enterpriseArchitectureVersionStatus).label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getArtifactStatusDisplay(report.strategicFitVersionStatus).className}`}
                          data-testid={`badge-list-strategic-fit-status-${report.id}`}
                        >
                          Fit: {getArtifactStatusDisplay(report.strategicFitVersionStatus).label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`${getClassificationColor(report.dataClassification)} text-white text-xs`}
                          data-testid={`badge-list-classification-${report.id}`}
                        >
                          {getClassificationDisplay(report.dataClassification)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`${getUrgencyColor(report.urgency)} text-white text-xs`}
                        >
                          {report.urgency?.toUpperCase() || 'MEDIUM'}
                        </Badge>
                      </div>
                    </div>

                    {/* Suggested Project Name - Always Visible, Highlighted */}
                    <div
                      className={`rounded-md p-3 border ${
                        report.suggestedProjectName
                          ? 'bg-primary/5 border-primary/20'
                          : 'bg-muted/30 border-dashed border-muted-foreground/30'
                      }`}
                      data-testid={`suggested-project-name-${report.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <Lightbulb className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                          report.suggestedProjectName
                            ? 'text-primary'
                            : 'text-muted-foreground'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            {t('demand.dashboard.suggestedProjectName')}
                          </p>
                          <p className={`text-sm font-semibold ${
                            report.suggestedProjectName
                              ? 'text-foreground'
                              : 'text-muted-foreground italic'
                          }`}>
                            {report.suggestedProjectName || t('demand.dashboard.notYetAssigned')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Business Objective */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {t('demand.dashboard.businessObjective')}
                      </p>
                      <p className="text-sm text-foreground line-clamp-2 leading-relaxed">
                        {report.businessObjective}
                      </p>
                    </div>

                    {/* Metadata Row - Professional Layout */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          <span className="font-medium">{report.requestorName}</span>
                          <span className="opacity-70">{report.requestorEmail}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                        </div>
                        {report.requestType && (
                          <div className="flex items-center gap-1.5">
                            <HexagonLogoFrame px={14} />
                            <span className="font-medium">{report.requestType.toUpperCase()}</span>
                            {report.classificationConfidence && (
                              <span className="text-muted-foreground">({Math.round(Number(report.classificationConfidence) > 0 && Number(report.classificationConfidence) <= 1 ? Number(report.classificationConfidence) * 100 : Number(report.classificationConfidence))}%)</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {selectedReport === report.id && (
                      <div className="pt-4 border-t space-y-4">
                        {/* Additional Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {report.estimatedBudget && (
                            <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{t('demand.dashboard.estimatedBudget')}</p>
                              <p className="text-sm font-semibold text-foreground">{report.estimatedBudget}</p>
                            </div>
                          )}
                          {report.estimatedTimeline && (
                            <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{t('demand.dashboard.estimatedTimeline')}</p>
                              <p className="text-sm font-semibold text-foreground">{report.estimatedTimeline}</p>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="default"
                            className="gap-1.5"
                            data-testid={`button-view-${report.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewReport(report.id);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {t('demand.dashboard.viewDetails')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            data-testid={`button-analyze-${report.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <HexagonLogoFrame px={14} />
                            {t('demand.dashboard.aiAnalysis')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            data-testid={`button-export-${report.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download className="h-3.5 w-3.5" />
                            {t('demand.dashboard.export')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* NEEDS_INFO Dialog */}
      <NeedsInfoDialog
        open={needsInfoDialog.open}
        onOpenChange={(open) => setNeedsInfoDialog(prev => ({ ...prev, open }))}
        decisionId={needsInfoDialog.decisionId}
        missingFields={needsInfoDialog.missingFields}
        demandTitle={needsInfoDialog.demandTitle}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/demand-reports'] });
          queryClient.invalidateQueries({ queryKey: ['/api/corevia/decisions'] });
        }}
      />
    </div>
  );
}

export { DemandDashboard };
